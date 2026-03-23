/**
 * Servers Routes (SSH Remote Servers)
 * As defined in SSH-REMOTE-SERVER-DESIGN.md
 *
 * GET    /api/servers              - List servers
 * POST   /api/servers              - Add server
 * DELETE /api/servers/:id          - Delete server
 * POST   /api/servers/:id/test     - Test connection
 * GET    /api/servers/:id/sessions - Get remote sessions
 * POST   /api/servers/:serverId/sessions/:sessionId/terminal - Start terminal
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import { json, parseBody } from '../utils/response.js';
import * as sshManager from '../services/ssh-manager.js';

export async function handleServersRoutes(
  url: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  // GET /api/servers - List all servers
  if (url === '/api/servers' && method === 'GET') {
    json(res, { servers: sshManager.getServers() });
    return true;
  }

  // POST /api/servers - Add new server
  if (url === '/api/servers' && method === 'POST') {
    try {
      const body = await parseBody<any>(req);
      if (!body.id || !body.host || !body.username) {
        json(res, { error: 'Missing required fields: id, host, username' }, 400);
        return true;
      }
      sshManager.addServer(body.id, body);
      console.log(`[SSH] Added server: ${body.id} (${body.host})`);
      json(res, { status: 'added', id: body.id });
    } catch (e: any) {
      json(res, { error: e.message }, 400);
    }
    return true;
  }

  // DELETE /api/servers/:id - Delete server
  const deleteMatch = url.match(/^\/api\/servers\/([^\/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    const serverId = deleteMatch[1];
    const removed = sshManager.removeServer(serverId);
    console.log(`[SSH] Removed server: ${serverId}`);
    json(res, removed ? { status: 'removed' } : { error: 'Server not found' }, removed ? 200 : 404);
    return true;
  }

  // POST /api/servers/:id/test - Test connection
  const testMatch = url.match(/^\/api\/servers\/([^\/]+)\/test$/);
  if (testMatch && method === 'POST') {
    const serverId = testMatch[1];
    try {
      await sshManager.testConnection(serverId);
      console.log(`[SSH] Connection test passed: ${serverId}`);
      json(res, { status: 'connected', serverId });
    } catch (e: any) {
      console.error(`[SSH] Connection test failed: ${serverId}`, e.message);
      json(res, { status: 'failed', error: e.message }, 400);
    }
    return true;
  }

  // GET /api/servers/:id/sessions - Get remote sessions
  const sessionsMatch = url.match(/^\/api\/servers\/([^\/]+)\/sessions$/);
  if (sessionsMatch && method === 'GET') {
    const serverId = sessionsMatch[1];
    try {
      const sessions = await sshManager.getRemoteSessions(serverId);
      console.log(`[SSH] Fetched ${sessions.length} sessions from ${serverId}`);
      json(res, { sessions, serverId });
    } catch (e: any) {
      json(res, { error: e.message }, 500);
    }
    return true;
  }

  // POST /api/servers/:serverId/sessions/:sessionId/terminal - Start remote terminal
  const terminalMatch = url.match(/^\/api\/servers\/([^\/]+)\/sessions\/([^\/]+)\/terminal$/);
  if (terminalMatch && method === 'POST') {
    const [, serverId, sessionId] = terminalMatch;
    try {
      await sshManager.createPTYSession(serverId, sessionId);
      console.log(`[SSH] Started PTY session: ${serverId}/${sessionId}`);
      json(res, { status: 'started', serverId, sessionId });
    } catch (e: any) {
      console.error(`[SSH] Failed to start PTY: ${e.message}`);
      json(res, { error: e.message }, 500);
    }
    return true;
  }

  return false;
}