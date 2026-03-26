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
  // Use URL parser for query params
  const fullUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
  const serverId = fullUrl.searchParams.get('serverId');

  if (fullUrl.pathname === '/api/config' && method === 'GET') {
    try {
      if (serverId && serverId !== 'local') {
        // 🌐 REMOTE CONFIG: Fetch via SSH
        const { execCommand } = await import('../services/ssh-manager.js');
        const [homeRes, userRes, ipRes] = await Promise.all([
          execCommand(serverId, 'echo $HOME'),
          execCommand(serverId, 'whoami'),
          execCommand(serverId, "hostname -I | awk '{print $1}'")
        ]);

        const remoteHome = homeRes.stdout.trim();
        json(res, {
          claudePath: `${remoteHome}/.claude`,
          model: 'claude-3-5-sonnet-latest', // Default for remote until we can cat settings.json
          ip: ipRes.stdout.trim() || 'unknown',
          user: userRes.stdout.trim() || 'unknown',
          isRemote: true
        });
      } else {
        // 🏠 LOCAL CONFIG
        json(res, await configService.getConfig());
      }
    } catch (e: any) {
      json(res, { error: e.message }, 500);
    }
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