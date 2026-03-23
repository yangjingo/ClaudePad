/**
 * Sessions Routes
 * GET /api/sessions - List sessions
 * GET /api/sessions/:id - Get single session
 * POST /api/sessions/:id/terminal - Start terminal
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import { json, parseBody } from '../utils/response.js';
import * as sessionCache from '../services/session-cache.js';
import * as terminalPool from '../services/terminal-pool.js';

export async function handleSessionsRoutes(
  url: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  // GET /api/sessions - List sessions with pagination
  if (url.startsWith('/api/sessions') && method === 'GET') {
    const urlObj = new URL(`http://localhost${url}`);
    const limit = parseInt(urlObj.searchParams.get('limit') || '20');
    const offset = parseInt(urlObj.searchParams.get('offset') || '0');
    console.log(`[API] GET /api/sessions limit=${limit} offset=${offset}`);
    const sessions = await sessionCache.getSessions(limit, offset);
    json(res, { sessions, pagination: { limit, offset, total: sessions.length } });
    return true;
  }

  // GET /api/sessions/:id - Single session (must match after list check)
  const singleMatch = url.match(/^\/api\/sessions\/([^\/\?]+)$/);
  if (singleMatch && method === 'GET') {
    const sessionId = singleMatch[1];
    const allSessions = await sessionCache.getSessions();
    const session = allSessions.find(s => s.id === sessionId);
    if (session) {
      json(res, session);
    } else {
      json(res, { error: 'Session not found' }, 404);
    }
    return true;
  }

  // POST /api/sessions/:id/terminal - Start terminal
  const terminalMatch = url.match(/^\/api\/sessions\/([^\/]+)\/terminal$/);
  if (terminalMatch && method === 'POST') {
    const sessionId = terminalMatch[1];
    try {
      const result = await terminalPool.startTerminal(sessionId);
      json(res, result);
    } catch (error: any) {
      console.error(`[Terminal] Failed to start:`, error);
      json(res, { error: 'Failed to start terminal', details: error.message }, 500);
    }
    return true;
  }

  return false;
}