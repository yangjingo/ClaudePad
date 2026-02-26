/**
 * ClaudePad - Sheikah Slate Edition
 * Minimal TypeScript server - zero runtime dependencies
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, ChildProcess } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 8080;
const DATA_DIR = join(__dirname, 'data');

// MIME types
const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Terminal sessions
const sessions = new Map<string, { process: ChildProcess; clients: Set<ServerResponse> }>();

// Simple JSON response helper
const json = (res: ServerResponse, data: unknown, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

// Read JSON file
async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const data = await readFile(path, 'utf-8');
    return JSON.parse(data) as T;
  } catch {
    return fallback;
  }
}

// Write JSON file
async function writeJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2));
}

// API Routes
const routes: Record<string, (req: IncomingMessage, res: ServerResponse, body?: unknown) => Promise<void>> = {
  // Health check
  'GET /health': async (_, res) => json(res, { status: 'ok' }),

  // Get projects
  'GET /api/projects': async (_, res) => {
    const data = await readJson(join(DATA_DIR, 'projects.json'), { projects: [] as any[], current_project: null as string | null });
    json(res, data);
  },

  // Create project
  'POST /api/projects': async (req, res, body) => {
    const { name, path: projectPath = '' } = (body || {}) as { name?: string; path?: string };
    if (!name) return json(res, { error: 'Name required' }, 400);

    const data = await readJson(join(DATA_DIR, 'projects.json'), { projects: [] as any[], current_project: null as string | null });
    if (data.projects.find((p: any) => p.name === name)) {
      return json(res, { error: 'Project exists' }, 400);
    }

    data.projects.push({ name, path: projectPath, created_at: new Date().toISOString() });
    if (data.projects.length === 1) data.current_project = name;

    await writeJson(join(DATA_DIR, 'projects.json'), data);
    await writeJson(join(DATA_DIR, 'projects', name, 'tasks.json'), { tasks: [] as any[] });
    json(res, { name, path: projectPath });
  },

  // Switch project
  'PUT /api/projects/:name/switch': async (req, res) => {
    const name = req.url?.split('/')[3];
    const data = await readJson(join(DATA_DIR, 'projects.json'), { projects: [] as any[], current_project: null as string | null });
    if (!data.projects.find((p: any) => p.name === name)) {
      return json(res, { error: 'Project not found' }, 404);
    }
    data.current_project = name || null;
    await writeJson(join(DATA_DIR, 'projects.json'), data);
    json(res, { current_project: name });
  },

  // Get tasks
  'GET /api/:project/tasks': async (req, res) => {
    const project = req.url?.split('/')[2];
    const data = await readJson(join(DATA_DIR, 'projects', project!, 'tasks.json'), { tasks: [] as any[] });
    json(res, data.tasks);
  },

  // Create task
  'POST /api/:project/tasks': async (req, res, body) => {
    const project = req.url?.split('/')[2];
    const data = await readJson(join(DATA_DIR, 'projects', project!, 'tasks.json'), { tasks: [] as any[] });

    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const existing = data.tasks.filter((t: any) => t.id.startsWith(today));
    const id = `${today}-${String(existing.length + 1).padStart(3, '0')}`;

    const task = {
      id,
      title: (body as any)?.title || '',
      description: (body as any)?.description || '',
      status: 'pending',
      is_plan: (body as any)?.is_plan || false,
      prompt: (body as any)?.prompt || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    data.tasks.push(task);
    await writeJson(join(DATA_DIR, 'projects', project!, 'tasks.json'), data);
    json(res, task);
  },

  // Update task status
  'POST /api/:project/tasks/:id/status': async (req, res, body) => {
    const parts = req.url?.split('/') || [];
    const project = parts[2];
    const id = parts[4];
    const data = await readJson(join(DATA_DIR, 'projects', project!, 'tasks.json'), { tasks: [] as any[] });

    const task = data.tasks.find((t: any) => t.id === id);
    if (!task) return json(res, { error: 'Task not found' }, 404);

    task.status = (body as any)?.status || task.status;
    task.updated_at = new Date().toISOString();
    await writeJson(join(DATA_DIR, 'projects', project!, 'tasks.json'), data);
    json(res, task);
  },

  // Get terminal history
  'GET /api/terminal/history': async (_, res) => {
    const data = await readJson(join(DATA_DIR, 'terminal_history.json'), { commands: [] as string[] });
    json(res, data);
  },

  // Add to terminal history
  'POST /api/terminal/history': async (_, res, body) => {
    const cmd = (body as any)?.command?.trim();
    if (!cmd) return json(res, { ok: true });

    const data = await readJson(join(DATA_DIR, 'terminal_history.json'), { commands: [] as string[], last_updated: null as string | null });
    data.commands = data.commands.filter((c: string) => c !== cmd);
    data.commands.unshift(cmd);
    if (data.commands.length > 1000) data.commands = data.commands.slice(0, 1000);
    data.last_updated = new Date().toISOString();

    await writeJson(join(DATA_DIR, 'terminal_history.json'), data);
    json(res, { ok: true });
  },

  // Terminal status
  'GET /api/terminal/status': async (_, res) => {
    json(res, {
      status: 'running',
      session_count: sessions.size,
      sessions: Array.from(sessions.keys()).slice(0, 10),
    });
  },
};

// Parse body
async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve({});
      }
    });
  });
}

// Match route
function matchRoute(method: string, url: string): { handler: typeof routes[string]; params: Record<string, string> } | null {
  // Direct match
  const key = `${method} ${url}`;
  if (routes[key]) return { handler: routes[key], params: {} };

  // Pattern match
  for (const [pattern, handler] of Object.entries(routes)) {
    const [pMethod, pPath] = pattern.split(' ');
    if (pMethod !== method) continue;

    const pParts = pPath.split('/');
    const uParts = url.split('/');
    if (pParts.length !== uParts.length) continue;

    const params: Record<string, string> = {};
    let match = true;

    for (let i = 0; i < pParts.length; i++) {
      if (pParts[i].startsWith(':')) {
        params[pParts[i].slice(1)] = uParts[i];
      } else if (pParts[i] !== uParts[i]) {
        match = false;
        break;
      }
    }

    if (match) return { handler, params };
  }

  return null;
}

// Serve static file
async function serveStatic(res: ServerResponse, url: string) {
  const filePath = join(__dirname, 'static', url.replace('/static/', ''));
  const ext = extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';

  try {
    await access(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    createReadStream(filePath).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
}

// Terminal SSE
function handleTerminalStream(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '', `http://localhost:${PORT}`);
  const sessionId = url.searchParams.get('id') || `term_${Date.now()}`;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Get or create session
  let session = sessions.get(sessionId);
  if (!session) {
    const proc = spawn('bash', [], { env: { ...process.env, TERM: 'xterm-256color' } });
    session = { process: proc, clients: new Set() };
    sessions.set(sessionId, session);

    proc.stdout.on('data', (data) => {
      session!.clients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`);
      });
    });

    proc.stderr.on('data', (data) => {
      session!.clients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'output', data: data.toString() })}\n\n`);
      });
    });

    proc.on('close', () => {
      session!.clients.forEach(client => {
        client.write(`data: ${JSON.stringify({ type: 'status', state: 'disconnected' })}\n\n`);
        client.end();
      });
      sessions.delete(sessionId);
    });
  }

  session.clients.add(res);
  res.write(`data: ${JSON.stringify({ type: 'status', state: 'connected', session_id: sessionId })}\n\n`);

  req.on('close', () => {
    session!.clients.delete(res);
  });
}

// Terminal input (POST)
async function handleTerminalInput(req: IncomingMessage, res: ServerResponse, body: unknown) {
  const { session_id, data } = body as { session_id?: string; data?: string };
  if (!session_id || !data) return json(res, { error: 'Missing params' }, 400);

  const session = sessions.get(session_id);
  if (!session) return json(res, { error: 'Session not found' }, 404);

  session.process.stdin?.write(data);
  json(res, { ok: true });
}

// Main server
const server = createServer(async (req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Static files
  if (url.startsWith('/static/')) {
    return serveStatic(res, url);
  }

  // Terminal SSE
  if (url.startsWith('/terminal/stream')) {
    return handleTerminalStream(req, res);
  }

  // Terminal input
  if (url === '/terminal/input' && method === 'POST') {
    return handleTerminalInput(req, res, await parseBody(req));
  }

  // Pages
  if (url === '/' || url === '/terminal') {
    const page = url === '/' ? 'index.html' : 'terminal.html';
    const html = await readFile(join(__dirname, 'templates', page), 'utf-8').catch(() => null);
    if (html) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  // API routes
  const match = matchRoute(method, url);
  if (match) {
    const body = method === 'POST' || method === 'PUT' ? await parseBody(req) : undefined;
    return match.handler(req, res, body);
  }

  // 404
  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🗡️  ClaudePad (Sheikah Slate Edition) running on http://0.0.0.0:${PORT}`);
});
