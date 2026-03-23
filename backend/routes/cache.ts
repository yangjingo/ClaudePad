/**
 * Cache Routes
 * GET /api/cache - Get cache status
 * POST /api/cache - Clear cache
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import { json } from '../utils/response.js';
import * as sessionCache from '../services/session-cache.js';

export async function handleCacheRoutes(
  url: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  // POST /api/cache - Clear cache
  if (url === '/api/cache' && method === 'POST') {
    await sessionCache.clearCache();
    json(res, { status: 'cleared' });
    return true;
  }

  // GET /api/cache - Get cache status
  if (url === '/api/cache' && method === 'GET') {
    json(res, sessionCache.getCacheStatus());
    return true;
  }

  return false;
}