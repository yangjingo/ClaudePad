/**
 * SSH Remote Terminal WebSocket Handler
 * Path: /ws/ssh/:serverId/:sessionId
 */
import { WebSocket } from 'ws';
import * as sshManager from '../services/ssh-manager.js';

export function handleSSHTerminalWS(ws: WebSocket, serverId: string, sessionId: string): void {
  console.log(`[WebSocket SSH] Connecting to ${serverId}/${sessionId}`);

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
  session.emitter.on('data', (data: string) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  session.emitter.on('close', () => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'close' }));
      ws.close();
    }
  });

  session.emitter.on('error', (err: Error) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', data: err.message }));
    }
  });

  // Handle WebSocket input -> SSH
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'input') {
        sshManager.writeToPTY(serverId, sessionId, msg.data);
      } else if (msg.type === 'resize') {
        sshManager.resizePTY(serverId, sessionId, msg.cols || 120, msg.rows || 30);
      }
    } catch {
      sshManager.writeToPTY(serverId, sessionId, data.toString());
    }
  });

  ws.on('close', () => {
    console.log(`[WebSocket SSH] Disconnected from ${serverId}/${sessionId}`);
  });

  ws.send(JSON.stringify({ type: 'connected', serverId, sessionId }));
}