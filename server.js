/**
 * ClaudePad - Claude Code Session Monitor
 * Web-based terminal using xterm.js + node-pty
 */
import { createServer } from 'node:http';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { homedir, userInfo, networkInterfaces } from 'node:os';
import {
  addServer, removeServer, getServers, getServerConfig,
  testConnection, execCommand, getRemoteSessions,
  createPTYSession, writeToPTY, closePTYSession, resizePTY, getPTYSession
} from './ssh-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8080');
const CLAUDE_DIR = join(homedir(), '.claude');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

// Serve static files from a directory
async function serveStaticFile(res, filePath) {
    try {
        const ext = filePath.slice(filePath.lastIndexOf('.'));
        const contentType = MIME[ext] || 'application/octet-stream';
        const content = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
        return true;
    } catch (e) {
        return false;
    }
}
const terminals = new Map();
async function parseHistory() {
    const sessions = new Map();
    try {
        const content = await readFile(join(CLAUDE_DIR, 'history.jsonl'), 'utf-8');
        content.trim().split('\n').filter(l => l).forEach(line => {
            const { sessionId, display, timestamp, project } = JSON.parse(line);
            if (sessionId && !sessions.has(sessionId)) {
                sessions.set(sessionId, { name: display?.slice(0, 50) || 'Session', timestamp, project });
            }
        });
    }
    catch (e) {
        console.error('History parse error:', e.message);
    }
    return sessions;
}
async function getSessions() {
    try {
        const dir = join(CLAUDE_DIR, 'session-env');
        const ids = await readdir(dir);
        const history = await parseHistory();
        return (await Promise.all(ids.map(async (id) => {
            const h = history.get(id);
            const ts = h?.timestamp || Date.now();
            const status = ts > Date.now() - 3600000 ? 'running' : 'completed';
            const duration = Math.floor((Date.now() - ts) / 1000);
            return {
                id,
                name: h?.name || id.slice(0, 8),
                status,
                startTime: new Date(ts).toISOString(),
                projectPath: h?.project || process.cwd(),
                lastActivity: new Date(ts).toISOString(),
                duration,
                tokenCount: 0
            };
        }))).filter(s => s).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    }
    catch (e) {
        console.error(e);
        return [];
    }
}
const json = (res, data, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

// Helper to parse request body
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}
async function getConfig() {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    let settings = {};
    try {
        const content = await readFile(settingsPath, 'utf-8');
        settings = JSON.parse(content);
    }
    catch (e) {
        console.error('Settings parse error:', e.message);
    }
    const nics = networkInterfaces();
    let ip = '127.0.0.1';
    for (const nic of Object.values(nics)) {
        for (const addr of (nic || [])) {
            if (addr.family === 'IPv4' && !addr.internal) {
                ip = addr.address;
                break;
            }
        }
        if (ip !== '127.0.0.1')
            break;
    }
    return {
        claudePath: CLAUDE_DIR,
        model: settings.model || 'unknown',
        apiUrl: settings.env?.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        apiKey: settings.env?.ANTHROPIC_AUTH_TOKEN ?
            settings.env.ANTHROPIC_AUTH_TOKEN.slice(0, 8) + '...' + settings.env.ANTHROPIC_AUTH_TOKEN.slice(-4) : 'not set',
        ip: ip,
        user: userInfo().username || process.env.USER || 'unknown',
        port: PORT
    };
}
async function saveConfig(newConfig) {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    let settings = {};
    try {
        const content = await readFile(settingsPath, 'utf-8');
        settings = JSON.parse(content);
    }
    catch (e) {
        console.error('Settings parse error:', e.message);
    }
    if (newConfig.model)
        settings.model = newConfig.model;
    if (!settings.env)
        settings.env = {};
    if (newConfig.apiUrl)
        settings.env.ANTHROPIC_BASE_URL = newConfig.apiUrl;
    if (newConfig.apiKey && newConfig.apiKey !== 'not set' && !newConfig.apiKey.includes('...')) {
        settings.env.ANTHROPIC_AUTH_TOKEN = newConfig.apiKey;
    }
    await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
    return getConfig();
}
const server = createServer(async (req, res) => {
    const url = req.url || '/', method = req.method || 'GET';
    // Parse URL to handle query params
    const urlPath = url.split('?')[0];
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // ===== Remote Server Management API =====
    // GET /api/servers - List all configured remote servers
    if (urlPath === '/api/servers' && method === 'GET') {
        return json(res, { servers: getServers() });
    }

    // POST /api/servers - Add a new remote server
    if (urlPath === '/api/servers' && method === 'POST') {
        try {
            const body = await parseBody(req);
            if (!body.id || !body.host || !body.username || !body.password) {
                return json(res, { error: 'Missing required fields: id, host, username, password' }, 400);
            }
            addServer(body.id, {
                name: body.name || body.host,
                host: body.host,
                port: body.port || 22,
                username: body.username,
                password: body.password
            });
            return json(res, { success: true, server: { id: body.id, name: body.name || body.host, host: body.host, port: body.port || 22, username: body.username } });
        } catch (e) {
            return json(res, { error: e.message }, 400);
        }
    }

    // DELETE /api/servers/:id - Remove a remote server
    const serverDeleteMatch = urlPath.match(/^\/api\/servers\/([^\/]+)$/);
    if (serverDeleteMatch && method === 'DELETE') {
        const serverId = serverDeleteMatch[1];
        removeServer(serverId);
        return json(res, { success: true });
    }

    // POST /api/servers/:id/test - Test SSH connection
    const serverTestMatch = urlPath.match(/^\/api\/servers\/([^\/]+)\/test$/);
    if (serverTestMatch && method === 'POST') {
        const serverId = serverTestMatch[1];
        try {
            await testConnection(serverId);
            return json(res, { success: true, connected: true });
        } catch (e) {
            return json(res, { success: false, error: e.message }, 500);
        }
    }

    // GET /api/servers/:id/sessions - Get remote sessions from a server
    const remoteSessionsMatch = urlPath.match(/^\/api\/servers\/([^\/]+)\/sessions$/);
    if (remoteSessionsMatch && method === 'GET') {
        const serverId = remoteSessionsMatch[1];
        try {
            const sessions = await getRemoteSessions(serverId);
            return json(res, { sessions });
        } catch (e) {
            return json(res, { error: e.message }, 500);
        }
    }

    // POST /api/servers/:serverId/sessions/:sessionId/terminal - Start SSH terminal
    const sshTerminalMatch = urlPath.match(/^\/api\/servers\/([^\/]+)\/sessions\/([^\/]+)\/terminal$/);
    if (sshTerminalMatch && method === 'POST') {
        const serverId = sshTerminalMatch[1];
        const sessionId = sshTerminalMatch[2];

        // Check if session already exists
        const existingSession = getPTYSession(serverId, sessionId);
        if (existingSession) {
            return json(res, { status: 'already_running' });
        }

        try {
            // Create PTY session via SSH
            const session = await createPTYSession(serverId, sessionId);

            // Store session info for WebSocket connection
            const wsKey = `ssh:${serverId}:${sessionId}`;
            terminals.set(wsKey, {
                type: 'ssh',
                serverId,
                sessionId,
                session,
                emitter: session.emitter
            });

            // Handle session close
            session.emitter.on('close', () => {
                terminals.delete(wsKey);
            });

            return json(res, { status: 'started', serverId, sessionId });
        } catch (e) {
            return json(res, { error: e.message }, 500);
        }
    }

    // ===== Existing Local API =====
    if (urlPath === '/api/config' && method === 'GET')
        return json(res, await getConfig());
    if (urlPath === '/api/config' && method === 'POST') {
        try {
            const body = await new Promise((resolve, reject) => {
                let data = '';
                req.on('data', chunk => data += chunk);
                req.on('end', () => { try {
                    resolve(JSON.parse(data));
                }
                catch {
                    reject(new Error('Invalid JSON'));
                } });
                req.on('error', reject);
            });
            return json(res, await saveConfig(body));
        }
        catch (e) {
            res.writeHead(400);
            res.end(e.message);
            return;
        }
    }
    if (urlPath === '/api/sessions' && method === 'GET')
        return json(res, { sessions: await getSessions() });
    const m = urlPath.match(/^\/api\/sessions\/([^\/]+)/);
    if (m && method === 'GET') {
        const s = (await getSessions()).find(x => x.id === m[1]);
        return s ? json(res, s) : json(res, { error: 'Not found' }, 404);
    }
    if (m && method === 'POST' && urlPath.includes('/terminal')) {
        if (terminals.has(m[1]))
            return json(res, { error: 'Running' }, 400);
        const proc = pty.spawn(process.env.SHELL || 'bash', ['-c', `unset CLAUDECODE && claude --resume ${m[1]}`], { name: 'xterm-256color', cols: 120, rows: 30, cwd: process.cwd(), env: { ...process.env, TERM: 'xterm-256color', CLAUDECODE: undefined } });
        terminals.set(m[1], { pty: proc });
        proc.onData(data => { const t = terminals.get(m[1]); if (t?.ws?.readyState === WebSocket.OPEN)
            t.ws.send(JSON.stringify({ type: 'output', data })); });
        proc.onExit(() => terminals.delete(m[1]));
        return json(res, { status: 'started' });
    }
    if (urlPath === '/' || urlPath === '/index.html') {
        const html = await readFile(join(__dirname, 'frontend', 'index.html')).catch(() => null);
        if (html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
    }
    // Serve static files from asserts directory
    if (urlPath.startsWith('/asserts/')) {
        const filePath = join(__dirname, urlPath);
        if (await serveStaticFile(res, filePath)) {
            return;
        }
    }
    // Serve static files from docs directory
    if (urlPath.startsWith('/docs/')) {
        const filePath = join(__dirname, urlPath);
        if (await serveStaticFile(res, filePath)) {
            return;
        }
    }
    if (urlPath === '/idea.html' || urlPath === '/ideas') {
        const html = await readFile(join(__dirname, 'frontend', 'idea.html')).catch(() => null);
        if (html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
    }
    if (urlPath === '/tips.html' || urlPath === '/tips') {
        const html = await readFile(join(__dirname, 'frontend', 'tips.html')).catch(() => null);
        if (html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
    }
    if (urlPath === '/playground.html' || urlPath === '/playground') {
        const html = await readFile(join(__dirname, 'frontend', 'playground.html')).catch(() => null);
        if (html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
    }
    const tm = urlPath.match(/^\/terminal\/([^\/]+)/);
    if (tm) {
        const html = await readFile(join(__dirname, 'frontend', 'terminal.html')).catch(() => null);
        if (html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
    }
    res.writeHead(404);
    res.end('Not found');
});
const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => {
    const url = req.url || '';

    // Check for SSH session WebSocket: /ws/ssh/:serverId/:sessionId
    const sshMatch = url.match(/^\/ws\/ssh\/([^\/]+)\/([^\/]+)/);
    if (sshMatch) {
        const serverId = sshMatch[1];
        const sessionId = sshMatch[2];
        const wsKey = `ssh:${serverId}:${sessionId}`;

        const term = terminals.get(wsKey);
        if (!term) {
            ws.send(JSON.stringify({ type: 'error', data: 'SSH session not found' }));
            ws.close();
            return;
        }

        term.ws = ws;

        // Listen for data from SSH stream via EventEmitter
        const dataHandler = (data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'output', data }));
            }
        };

        const closeHandler = () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'close' }));
            }
            ws.close();
        };

        const errorHandler = (err) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'error', data: err.message }));
            }
        };

        term.emitter.on('data', dataHandler);
        term.emitter.on('close', closeHandler);
        term.emitter.on('error', errorHandler);

        // Handle messages from browser
        ws.on('message', data => {
            try {
                const { type, data: input, cols, rows } = JSON.parse(data.toString());
                if (type === 'input') {
                    writeToPTY(serverId, sessionId, input);
                } else if (type === 'resize') {
                    resizePTY(serverId, sessionId, cols, rows);
                }
            } catch {
                // Raw data fallback
                writeToPTY(serverId, sessionId, data.toString());
            }
        });

        ws.on('close', () => {
            term.emitter.off('data', dataHandler);
            term.emitter.off('close', closeHandler);
            term.emitter.off('error', errorHandler);
            term.ws = undefined;
        });

        return;
    }

    // Local PTY session WebSocket: /ws/terminal/:sessionId
    const m = url.match(/^\/ws\/terminal\/([^\/]+)/);
    if (!m) {
        ws.close();
        return;
    }
    const term = terminals.get(m[1]);
    if (!term) {
        ws.send(JSON.stringify({ type: 'error', data: 'Not found' }));
        ws.close();
        return;
    }
    term.ws = ws;
    ws.on('message', data => { try {
        const { type, data: input } = JSON.parse(data.toString());
        if (type === 'input')
            term.pty.write(input);
    }
    catch {
        term.pty.write(data.toString());
    } });
    ws.on('close', () => { const t = terminals.get(m[1]); if (t)
        t.ws = undefined; });
});
server.listen(PORT, '0.0.0.0', () => { console.log(`🗡️ ClaudePad running on http://0.0.0.0:${PORT}`); getSessions().then(s => console.log(`📚 Sessions: ${s.length}`)); });
