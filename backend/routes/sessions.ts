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
    const { sessions, total } = await sessionCache.getSessionsPage(limit, offset);
    json(res, { sessions, pagination: { limit, offset, total } });
    return true;
  }

  // GET /api/sessions/:id - Single session (must match after list check)
  const singleMatch = url.match(/^\/api\/sessions\/([^\/\?]+)$/);
  if (singleMatch && method === 'GET') {
    const sessionId = singleMatch[1];
    const allSessions = await sessionCache.getSessions();
    let session = allSessions.find(s => s.id === sessionId);
    
    // Fallback: If session not found in cache, provide a minimal placeholder
    // so the frontend can still show the ID and attempt to start it.
    if (!session) {
      console.log(`[API] Session ${sessionId} not found in cache, providing placeholder`);
      session = {
        id: sessionId,
        name: `Session ${sessionId.slice(0, 8)}`,
        status: 'idle',
        startTime: new Date().toISOString(),
        projectPath: process.cwd(),
        lastActivity: new Date().toISOString(),
        duration: 0
      };
    }
    
    json(res, session);
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
