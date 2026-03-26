/**
 * Local Terminal WebSocket Handler
 * Path: /ws/terminal/:sessionId
 */
import { WebSocket } from 'ws';
import * as terminalPool from '../services/terminal-pool.js';

export function handleLocalTerminalWS(ws: WebSocket, sessionId: string): void {
  const exists = terminalPool.hasTerminal(sessionId);

  if (!exists) {
    ws.send(JSON.stringify({ type: 'waiting', data: 'Waiting for terminal to start...' }));
  } else {
    terminalPool.setTerminalWs(sessionId, ws);
    ws.send(JSON.stringify({ type: 'connected', sessionId }));
    console.log(`[WebSocket] Connected to terminal ${sessionId}`);
  }

  ws.on('message', (data) => {
    const dataStr = data.toString();
    try {
      if (dataStr.startsWith('{') && dataStr.endsWith('}')) {
        const msg = JSON.parse(dataStr);
        if (msg.type === 'input') {
          terminalPool.writeToTerminal(sessionId, msg.data);
          return;
        } else if (msg.type === 'resize') {
          const cols = msg.cols || 120;
          const rows = msg.rows || 30;
          terminalPool.resizeTerminal(sessionId, cols, rows);
          return;
        }
      }
      terminalPool.writeToTerminal(sessionId, dataStr);
    } catch {
      terminalPool.writeToTerminal(sessionId, dataStr);
    }
  });

  ws.on('close', () => {
    terminalPool.setTerminalWs(sessionId, undefined);
  });
}