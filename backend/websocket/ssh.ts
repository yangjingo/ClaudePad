/**
 * SSH Remote Terminal WebSocket Handler
 * Path: /ws/ssh/:serverId/:sessionId
 */
import { WebSocket } from 'ws';
import * as sshManager from '../services/ssh-manager.js';

export function handleSSHTerminalWS(ws: WebSocket, serverId: string, sessionId: string): void {
  const traceId = `${serverId}:${sessionId}`;
  const tWsConnect = Date.now();
  let firstForwardLogged = false;
  console.log(`[WebSocket SSH] Connecting to ${serverId}/${sessionId}`);
  console.log(`[Perf][WS][${traceId}] ws_connected=${tWsConnect}`);

  const session = sshManager.getPTYSession(serverId, sessionId);
  if (!session) {
    ws.send(JSON.stringify({
      type: 'error',
      data: 'PTY session not found. Start it first via POST /api/servers/:serverId/sessions/:sessionId/terminal'
    }));
    ws.close();
    return;
  }

  // Forward SSH output to WebSocket
  const onData = (data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      if (!firstForwardLogged) {
        firstForwardLogged = true;
        console.log(`[Perf][WS][${traceId}] first_forward_to_browser elapsed=${Date.now() - tWsConnect}ms bytes=${Buffer.byteLength(data || '', 'utf8')}`);
      }
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  };

  const onClose = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'close' }));
      ws.close();
    }
  };

  const onReady = () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resume_ready' }));
    }
  };

  const onError = (err: Error) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', data: err.message }));
    }
  };

  session.emitter.on('data', onData);
  session.emitter.on('close', onClose);
  session.emitter.on('error', onError);
  session.emitter.on('ready', onReady);

  // Replay buffered early output so the first screen is not lost
  if (session.outputBuffer?.length && ws.readyState === WebSocket.OPEN) {
    const replay = session.outputBuffer.join('');
    if (replay.length > 0) {
      if (!firstForwardLogged) {
        firstForwardLogged = true;
        console.log(`[Perf][WS][${traceId}] first_forward_to_browser elapsed=${Date.now() - tWsConnect}ms bytes=${Buffer.byteLength(replay, 'utf8')} source=buffer`);
      }
      ws.send(JSON.stringify({ type: 'output', data: replay }));
    }
  }

  if (session.resumeReady && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: 'resume_ready' }));
  }

  // Handle WebSocket input -> SSH
  ws.on('message', (data) => {
    const dataStr = data.toString();
    try {
      // Try parsing as JSON first for control messages
      if (dataStr.startsWith('{') && dataStr.endsWith('}')) {
        const msg = JSON.parse(dataStr);
        if (msg.type === 'input') {
          sshManager.writeToPTY(serverId, sessionId, msg.data);
          return;
        } else if (msg.type === 'resize') {
          sshManager.resizePTY(serverId, sessionId, msg.cols || 120, msg.rows || 30);
          return;
        }
      }
      
      // If not a control JSON or parse fails, treat as raw input
      sshManager.writeToPTY(serverId, sessionId, dataStr);
    } catch {
      // Fallback for non-JSON or partial data
      sshManager.writeToPTY(serverId, sessionId, dataStr);
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket SSH] Disconnected from ${serverId}/${sessionId}`);
    // Clean up listeners to prevent memory leaks on hot-plug
    session.emitter.removeListener('data', onData);
    session.emitter.removeListener('close', onClose);
    session.emitter.removeListener('error', onError);
    session.emitter.removeListener('ready', onReady);
  });

  ws.send(JSON.stringify({ type: 'connected', serverId, sessionId }));
}
