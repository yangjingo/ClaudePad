/**
 * Config Routes
 * GET /api/config - Get configuration
 * POST /api/config - Update configuration
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import { json, parseBody } from '../utils/response.js';
import * as configService from '../services/config.js';

export async function handleConfigRoutes(
  url: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  // GET /api/config
  if (url === '/api/config' && method === 'GET') {
    json(res, await configService.getConfig());
    return true;
  }

  // POST /api/config
  if (url === '/api/config' && method === 'POST') {
    try {
      const body = await parseBody<any>(req);
      json(res, await configService.saveConfig(body));
    } catch (e: any) {
      res.writeHead(400);
      res.end(e.message);
    }
    return true;
  }

  return false;
}