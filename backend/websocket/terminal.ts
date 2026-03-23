/**
 * Local Terminal WebSocket Handler
 * Path: /ws/terminal/:sessionId
 */
import { WebSocket } from 'ws';
import * as terminalPool from '../services/terminal-pool.js';

export function handleLocalTerminalWS(ws: WebSocket, sessionId: string): void {
  const term = terminalPool.getTerminal(sessionId);

  if (!term) {
    ws.send(JSON.stringify({ type: 'waiting', data: 'Waiting for terminal to start...' }));
  } else {
    terminalPool.setTerminalWs(sessionId, ws);
    ws.send(JSON.stringify({ type: 'connected', sessionId }));
    console.log(`[WebSocket] Connected to terminal ${sessionId}`);
  }

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'input') {
        terminalPool.writeToTerminal(sessionId, msg.data);
      }
    } catch {
      terminalPool.writeToTerminal(sessionId, data.toString());
    }
  });

  ws.on('close', () => {
    terminalPool.setTerminalWs(sessionId, undefined);
  });
}