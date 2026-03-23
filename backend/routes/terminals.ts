/**
 * Terminal Pool Routes
 * GET /api/terminal-pool - Get terminal pool status
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import { json } from '../utils/response.js';
import * as terminalPool from '../services/terminal-pool.js';

export async function handleTerminalRoutes(
  url: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  // GET /api/terminal-pool
  if (url === '/api/terminal-pool' && method === 'GET') {
    json(res, terminalPool.getPoolStatus());
    return true;
  }

  return false;
}