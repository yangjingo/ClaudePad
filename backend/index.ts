/**
 * ClaudePad - Claude Code Session Monitor
 * Main entry point - composes all routes and services
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

// Services
import * as sessionCache from './services/session-cache.js';

// Routes
import { handleSessionsRoutes } from './routes/sessions.js';
import { handleServersRoutes } from './routes/servers.js';
import { handleConfigRoutes } from './routes/config.js';
import { handleCacheRoutes } from './routes/cache.js';
import { handleTerminalRoutes } from './routes/terminals.js';
import { handleSystemRoutes } from './routes/system.js';

// WebSocket
import { handleLocalTerminalWS } from './websocket/terminal.js';
import { handleSSHTerminalWS } from './websocket/ssh.js';

// Utils
import { setCorsHeaders } from './utils/response.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8080');

// ========== HTTP Server ==========

const server = createServer(async (req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  setCorsHeaders(res);

  // Handle OPTIONS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Try route handlers in order
  let handled = false;

  // Config routes
  handled = await handleConfigRoutes(url, method, req, res);
  if (handled) return;

  // Cache routes
  handled = await handleCacheRoutes(url, method, req, res);
  if (handled) return;

  // Servers (SSH) routes
  handled = await handleServersRoutes(url, method, req, res);
  if (handled) return;

  // Sessions routes
  handled = await handleSessionsRoutes(url, method, req, res);
  if (handled) return;

  // Terminal pool routes
  handled = await handleTerminalRoutes(url, method, req, res);
  if (handled) return;

  // System routes (version/update)
  handled = await handleSystemRoutes(url, method, req, res);
  if (handled) return;

  // Simple health probe for startup verification
  if (url === '/healthz' && method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, port: PORT, ts: Date.now() }));
    return;
  }

  // Static files
  handled = await serveStaticFiles(url, res);
  if (handled) return;

  // 404
  res.writeHead(404);
  res.end('Not found');
});

// ========== Static File Serving ==========

async function serveStaticFiles(url: string, res: ServerResponse): Promise<boolean> {
  const projectRoot = join(__dirname, '..');

  // Frontend HTML pages
  const pageMap: Record<string, string> = {
    '/': 'index.html',
    '/index.html': 'index.html',
    '/idea.html': 'idea.html',
    '/ideas': 'idea.html',
    '/tips.html': 'tips.html',
    '/tips': 'tips.html',
    '/playground.html': 'playground.html',
    '/playground': 'playground.html'
  };

  if (pageMap[url]) {
    const html = await readFile(join(projectRoot, 'frontend', pageMap[url])).catch(() => null);
    if (html) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return true;
    }
  }

  // Terminal page (with session ID)
  const terminalMatch = url.match(/^\/terminal\/(.+)/);
  if (terminalMatch) {
    const html = await readFile(join(projectRoot, 'frontend', 'terminal.html')).catch(() => null);
    if (html) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return true;
    }
  }

  // Browser default favicon request
  if (url === '/favicon.ico') {
    const filePath = join(projectRoot, 'asserts', 'zelda-icon', 'link.png');
    try {
      const content = await readFile(filePath);
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(content);
      return true;
    } catch {
      console.log(`Favicon file not found: ${filePath}`);
    }
  }

  // Asserts directory
  if (url.startsWith('/asserts/')) {
    const filePath = join(projectRoot, url);
    try {
      const content = await readFile(filePath);
      const ext = filePath.split('.').pop();
      const contentTypes: Record<string, string> = {
        html: 'text/html', css: 'text/css', js: 'application/javascript',
        json: 'application/json', md: 'text/markdown', txt: 'text/plain',
        png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
        gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon'
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext || ''] || 'application/octet-stream' });
      res.end(content);
      return true;
    } catch {
      console.log(`Asserts file not found: ${filePath}`);
    }
  }

  // Docs directory
  if (url.startsWith('/docs/')) {
    const filePath = join(projectRoot, url);
    try {
      const content = await readFile(filePath, 'utf-8');
      const ext = filePath.split('.').pop();
      const contentTypes: Record<string, string> = {
        html: 'text/html', css: 'text/css', js: 'application/javascript',
        json: 'application/json', md: 'text/markdown', txt: 'text/plain'
      };
      res.writeHead(200, { 'Content-Type': contentTypes[ext || ''] || 'application/octet-stream' });
      res.end(content);
      return true;
    } catch {
      console.log(`Docs file not found: ${filePath}`);
    }
  }

  return false;
}

// ========== WebSocket Server ==========

const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  const url = req.url || '';

  // SSH Remote Terminal: /ws/ssh/:serverId/:sessionId
  const sshMatch = url.match(/^\/ws\/ssh\/([^\/]+)\/([^\/]+)/);
  if (sshMatch) {
    const [, serverId, sessionId] = sshMatch;
    handleSSHTerminalWS(ws, serverId, sessionId);
    return;
  }

  // Local Terminal: /ws/terminal/:sessionId
  const terminalMatch = url.match(/^\/ws\/terminal\/([^\/]+)/);
  if (terminalMatch) {
    const sessionId = terminalMatch[1];
    handleLocalTerminalWS(ws, sessionId);
    return;
  }

  // Unknown path
  ws.close();
});

// ========== Startup ==========

const cacheInfo = sessionCache.getCacheInfo();

server.listen(PORT, '0.0.0.0', async () => {
  console.log(`🗡️  ClaudePad running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Cache directory: ${cacheInfo.dir}`);
  console.log(`⏱️  Memory TTL: ${cacheInfo.memoryTTL}ms, File TTL: ${cacheInfo.fileTTL}ms`);

  const sessions = await sessionCache.getSessions();
  console.log(`📚 Sessions: ${sessions.length}`);
});
