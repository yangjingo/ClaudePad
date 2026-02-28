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
const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8080');
const CLAUDE_DIR = join(homedir(), '.claude');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };
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
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    if (url === '/api/config' && method === 'GET')
        return json(res, await getConfig());
    if (url === '/api/config' && method === 'POST') {
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
    if (url === '/api/sessions' && method === 'GET')
        return json(res, { sessions: await getSessions() });
    const m = url.match(/^\/api\/sessions\/([^\/]+)/);
    if (m && method === 'GET') {
        const s = (await getSessions()).find(x => x.id === m[1]);
        return s ? json(res, s) : json(res, { error: 'Not found' }, 404);
    }
    if (m && method === 'POST' && url.includes('/terminal')) {
        if (terminals.has(m[1]))
            return json(res, { error: 'Running' }, 400);
        const proc = pty.spawn(process.env.SHELL || 'bash', ['-c', `unset CLAUDECODE && claude --resume ${m[1]}`], { name: 'xterm-256color', cols: 120, rows: 30, cwd: process.cwd(), env: { ...process.env, TERM: 'xterm-256color', CLAUDECODE: undefined } });
        terminals.set(m[1], { pty: proc });
        proc.onData(data => { const t = terminals.get(m[1]); if (t?.ws?.readyState === WebSocket.OPEN)
            t.ws.send(JSON.stringify({ type: 'output', data })); });
        proc.onExit(() => terminals.delete(m[1]));
        return json(res, { status: 'started' });
    }
    if (url === '/' || url === '/index.html') {
        const html = await readFile(join(__dirname, 'frontend', 'index.html')).catch(() => null);
        if (html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
    }
    if (url === '/idea.html' || url === '/ideas') {
        const html = await readFile(join(__dirname, 'frontend', 'idea.html')).catch(() => null);
        if (html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
    }
    if (url === '/tips.html' || url === '/tips') {
        const html = await readFile(join(__dirname, 'frontend', 'tips.html')).catch(() => null);
        if (html) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
            return;
        }
    }
    const tm = url.match(/^\/terminal\/([^\/]+)/);
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
    const m = (req.url || '').match(/^\/ws\/terminal\/([^\/]+)/);
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
