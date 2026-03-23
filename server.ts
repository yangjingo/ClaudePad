/**
 * ClaudePad - Claude Code Session Monitor
 * Web-based terminal using xterm.js + node-pty
 */

import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import * as pty from 'node-pty';
import { homedir, userInfo, networkInterfaces } from 'node:os';
import * as sshManager from './ssh-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '8080');
const CLAUDE_DIR = join(homedir(), '.claude');

// ========== 缓存配置 ==========
interface CachedData {
  sessions: any[];
  timestamp: number;
  expiresAt: number;
}

const CACHE_DIR = join(process.cwd(), '.cache');
const CACHE_FILE = join(CACHE_DIR, 'sessions.json');
const MEMORY_CACHE_TTL = 5000;      // 内存缓存 TTL: 5 秒
const FILE_CACHE_TTL = 300000;      // 文件缓存 TTL: 5 分钟
const MAX_SESSIONS = 50;            // 最多返回 50 个 session

let sessionCache: CachedData | null = null;
let cacheStats = { hits: 0, misses: 0 };
const MIME: Record<string, string> = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

const terminals = new Map<string, { pty: pty.IPty; ws?: WebSocket; createdAt: number; lastActivity?: number }>();

// ========== 终端池配置 ==========
const TERMINAL_POOL_SIZE = 3;           // 预启动终端池大小
const TERMINAL_IDLE_TIMEOUT = 300000;   // 空闲超时 (5 分钟)
const terminalPool: string[] = [];      // 预启动的 session ID 池

async function parseHistory(): Promise<Map<string, { name: string; timestamp: number; project: string }>> {
  const sessions = new Map();
  try {
    const content = await readFile(join(CLAUDE_DIR, 'history.jsonl'), 'utf-8');
    content.trim().split('\n').filter(l => l).forEach(line => {
      const { sessionId, display, timestamp, project } = JSON.parse(line);
      if (sessionId && !sessions.has(sessionId)) {
        sessions.set(sessionId, { name: display?.slice(0, 50) || 'Session', timestamp, project });
      }
    });
  } catch (e: any) { console.error('History parse error:', e.message); }
  return sessions;
}

// ========== 缓存相关函数 ==========

// 确保缓存目录存在
async function ensureCacheDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
}

// 从文件缓存加载
async function loadFromFileCache(): Promise<{ sessions: any[]; timestamp: number } | null> {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8');
    const data = JSON.parse(content);
    if (Date.now() - data.timestamp < FILE_CACHE_TTL) {
      return data;
    }
  } catch (e) {
    // 缓存不存在或损坏
  }
  return null;
}

// 保存到文件缓存
async function saveToFileCache(sessions: any[]): Promise<void> {
  try {
    await ensureCacheDir();
    await writeFile(CACHE_FILE, JSON.stringify({
      sessions,
      timestamp: Date.now()
    }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save file cache:', e.message);
  }
}

// 计算特定 session 的 token 数量
async function getTokenCount(sessionId: string): Promise<number> {
  // 尝试多个可能的 session 日志位置
  const possiblePaths = [
    join(CLAUDE_DIR, 'sessions', `${sessionId}.jsonl`),           // 新版本: sessions/{id}.jsonl
    join(CLAUDE_DIR, 'session-env', sessionId),                   // 旧版本: session-env/{id}/*.jsonl
  ];

  for (const sessionPath of possiblePaths) {
    try {
      // 检查是文件还是目录
      const stat = await import('node:fs/promises').then(fs => fs.stat(sessionPath));

      if (stat.isFile() && sessionPath.endsWith('.jsonl')) {
        // 新版本: 单个 jsonl 文件
        const content = await readFile(sessionPath, 'utf-8');
        return countTokensFromJsonl(content);
      } else if (stat.isDirectory()) {
        // 旧版本: 目录下的多个 jsonl 文件
        const files = await readdir(sessionPath);
        const logFiles = files.filter(f => f.endsWith('.jsonl'));

        let totalTokens = 0;
        for (const file of logFiles) {
          const content = await readFile(join(sessionPath, file), 'utf-8');
          totalTokens += countTokensFromJsonl(content);
        }
        return totalTokens;
      }
    } catch {
      continue;
    }
  }

  // 尝试从 projects 目录查找
  try {
    const projectsDir = join(CLAUDE_DIR, 'projects');
    const projects = await readdir(projectsDir);

    for (const project of projects) {
      const sessionFile = join(projectsDir, project, `${sessionId}.jsonl`);
      try {
        const content = await readFile(sessionFile, 'utf-8');
        return countTokensFromJsonl(content);
      } catch {
        continue;
      }
    }
  } catch {
    // projects 目录不存在
  }

  return 0;
}

function countTokensFromJsonl(content: string): number {
  let totalTokens = 0;
  for (const line of content.trim().split('\n').filter(l => l)) {
    try {
      const entry = JSON.parse(line);
      totalTokens += entry.usage?.input_tokens || 0;
      totalTokens += entry.usage?.output_tokens || 0;
    } catch {
      continue;
    }
  }
  return totalTokens;
}

// 发现所有 session ID (支持多版本)
async function discoverSessions(): Promise<Set<string>> {
  const sessionIds = new Set<string>();

  // 1. 从 history.jsonl 获取所有已知的 session ID
  const history = await parseHistory();
  history.forEach((_, id) => sessionIds.add(id));

  // 2. 从 sessions/ 目录发现 (新版本)
  try {
    const sessionsDir = join(CLAUDE_DIR, 'sessions');
    const files = await readdir(sessionsDir);
    files.filter(f => f.endsWith('.jsonl')).forEach(f => {
      sessionIds.add(f.replace('.jsonl', ''));
    });
  } catch {
    // sessions 目录不存在
  }

  // 3. 从 session-env/ 目录发现 (旧版本)
  try {
    const sessionEnvDir = join(CLAUDE_DIR, 'session-env');
    const dirs = await readdir(sessionEnvDir);
    dirs.forEach(id => sessionIds.add(id));
  } catch {
    // session-env 目录不存在
  }

  // 4. 从 projects/ 目录发现
  try {
    const projectsDir = join(CLAUDE_DIR, 'projects');
    const projects = await readdir(projectsDir);

    for (const project of projects) {
      try {
        const projectDir = join(projectsDir, project);
        const files = await readdir(projectDir);
        files.filter(f => f.endsWith('.jsonl')).forEach(f => {
          sessionIds.add(f.replace('.jsonl', ''));
        });
      } catch {
        continue;
      }
    }
  } catch {
    // projects 目录不存在
  }

  return sessionIds;
}

// 从磁盘加载 session 数据的函数
async function loadSessionsFromDisk(): Promise<any[]> {
  const startTime = Date.now();
  try {
    const ids = await discoverSessions();
    const history = await parseHistory();

    const sessions = await Promise.all(Array.from(ids).map(async id => {
      const h = history.get(id);
      const ts = h?.timestamp || Date.now();
      // 基于时间戳判断状态：
      // - running: 30 分钟内有时间戳更新
      // - idle: 30 分钟 -2 小时
      // - completed: 超过 2 小时
      const ageMinutes = (Date.now() - ts) / 60000;
      let status;
      if (ageMinutes < 30) {
        status = 'running';
      } else if (ageMinutes < 120) {
        status = 'idle';
      } else {
        status = 'completed';
      }
      const duration = Math.floor((Date.now() - ts) / 1000);

      // 异步获取 token 计数
      const tokenCount = await getTokenCount(id);

      return {
        id,
        name: h?.name || id.slice(0, 8),
        status,
        startTime: new Date(ts).toISOString(),
        projectPath: h?.project || process.cwd(),
        lastActivity: new Date(ts).toISOString(),
        duration,
        tokenCount
      };
    }));

    const result = sessions
      .filter(s => s)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    // 统计状态分布
    const statusCount = result.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`[Disk] Status distribution: ${JSON.stringify(statusCount)}`);
    console.log(`[Disk] Loaded ${result.length} sessions in ${Date.now() - startTime}ms`);
    return result;
  } catch (e: any) {
    console.error('Failed to load sessions:', e.message);
    return [];
  }
}

// 主函数：带缓存和分页的 getSessions
async function getSessions(limit?: number, offset?: number): Promise<any[]> {
  const now = Date.now();

  // 1. 检查内存缓存
  if (sessionCache && now < sessionCache.expiresAt) {
    cacheStats.hits++;
    console.log(`[Cache HIT] Memory (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
    const sessions = sessionCache.sessions;
    const start = offset || 0;
    const end = limit ? start + limit : sessions.length;
    return sessions.slice(start, end);
  }

  cacheStats.misses++;

  // 2. 检查文件缓存
  const fileCache = await loadFromFileCache();
  if (fileCache) {
    console.log(`[Cache HIT] File (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
    // 更新内存缓存（存储全部 sessions）
    sessionCache = {
      sessions: fileCache.sessions,
      timestamp: now,
      expiresAt: now + MEMORY_CACHE_TTL
    };
    // 应用分页和限制
    const start = offset || 0;
    const end = limit ? start + limit : fileCache.sessions.length;
    return fileCache.sessions.slice(start, end);
  }

  console.log(`[Cache MISS] Loading from disk (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);

  // 3. 从磁盘加载
  const allSessions = await loadSessionsFromDisk();

  // 更新两层缓存（存储全部 sessions）
  sessionCache = {
    sessions: allSessions,
    timestamp: now,
    expiresAt: now + MEMORY_CACHE_TTL
  };
  await saveToFileCache(allSessions);

  // 应用分页和限制
  const start = offset || 0;
  const end = limit ? start + limit : allSessions.length;
  return allSessions.slice(start, end);
}

const json = (res: ServerResponse, data: any, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data)); };

// 清除缓存端点
async function clearCache() {
  sessionCache = null;
  cacheStats = { hits: 0, misses: 0 };
  try {
    await writeFile(CACHE_FILE, JSON.stringify({ sessions: [], timestamp: 0, expired: true }), 'utf-8');
  } catch (e) {
    console.error('Failed to clear file cache:', e.message);
  }
  console.log('[Cache] Cleared');
}

// ========== 终端池管理 ==========

// 启动单个终端
async function spawnTerminal(sessionId: string): Promise<{ pty: pty.IPty }> {
  return new Promise((resolve, reject) => {
    // 使用 env 直接清除 CLAUDECODE 变量
    const cleanEnv = { ...process.env, TERM: 'xterm-256color', CLAUDECODE: '', CLAUDE_CODE_RUNNING: '' };
    delete cleanEnv.CLAUDECODE;
    delete cleanEnv.CLAUDE_CODE_RUNNING;

    const proc = pty.spawn(process.env.SHELL || 'bash', ['-c', `env -u CLAUDECODE -u CLAUDE_CODE_RUNNING claude --resume ${sessionId}`], {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: process.cwd(),
      env: cleanEnv
    });

    let started = false;

    // 等待初始输出（表示进程已启动）
    const onDataHandler = (data: string) => {
      if (!started) {
        started = true;
        proc.removeListener('data', onDataHandler);
        resolve({ pty: proc });
      }
      // 如果有 WebSocket，发送数据
      const term = terminals.get(sessionId);
      if (term?.ws?.readyState === WebSocket.OPEN) {
        term.ws.send(JSON.stringify({ type: 'output', data }));
      }
    };

    proc.on('data', onDataHandler);

    // 超时处理 - 2 秒后强制认为已启动
    setTimeout(() => {
      if (!started) {
        proc.removeListener('data', onDataHandler);
        resolve({ pty: proc }); // 即使没有输出也认为已启动
      }
    }, 2000);

    proc.onExit(({ exitCode }) => {
      terminals.delete(sessionId);
      console.log(`[Terminal] Session ${sessionId} exited with code ${exitCode}`);
      // 从池中移除
      const idx = terminalPool.indexOf(sessionId);
      if (idx !== -1) terminalPool.splice(idx, 1);
    });

    terminals.set(sessionId, { pty: proc, createdAt: Date.now(), lastActivity: Date.now() });
  });
}

// 预启动终端池
async function refillTerminalPool() {
  // 确保池中有足够的预启动终端
  while (terminalPool.length < TERMINAL_POOL_SIZE) {
    // 随机生成一个假的session ID来填充池子，实际在连接时再启动真实的session
    // 实际的实现是在用户真正需要时才启动终端
    console.log(`[Terminal Pool] Terminal pool size: ${terminalPool.length}/${TERMINAL_POOL_SIZE}`);
    break; // 暂时停止填充，因为我们将在用户请求时再启动真实终端
  }
}

// 清理空闲终端
function cleanupIdleTerminals() {
  const now = Date.now();
  for (const [id, term] of terminals.entries()) {
    if (!term.ws && now - term.createdAt > TERMINAL_IDLE_TIMEOUT) {
      console.log(`[Terminal Pool] Cleaning up idle terminal ${id}`);
      term.pty.kill();
      terminals.delete(id);
      const idx = terminalPool.indexOf(id);
      if (idx !== -1) terminalPool.splice(idx, 1);
    }
  }
  // 重新填充池
  refillTerminalPool();
}

// 定期清理空闲终端（每 2 分钟）
setInterval(cleanupIdleTerminals, 120000);

// 启动时预填充终端池
setTimeout(() => {
  refillTerminalPool();
}, 3000);

async function getConfig() {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  let settings: any = {};
  try {
    const content = await readFile(settingsPath, 'utf-8');
    settings = JSON.parse(content);
  } catch (e: any) { console.error('Settings parse error:', e.message); }

  const nics = networkInterfaces();
  let ip = '127.0.0.1';
  for (const nic of Object.values(nics)) {
    for (const addr of (nic || [])) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ip = addr.address;
        break;
      }
    }
    if (ip !== '127.0.0.1') break;
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

async function saveConfig(newConfig: { model?: string; apiUrl?: string; apiKey?: string }) {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  let settings: any = {};
  try {
    const content = await readFile(settingsPath, 'utf-8');
    settings = JSON.parse(content);
  } catch (e: any) { console.error('Settings parse error:', e.message); }

  if (newConfig.model) settings.model = newConfig.model;
  if (!settings.env) settings.env = {};
  if (newConfig.apiUrl) settings.env.ANTHROPIC_BASE_URL = newConfig.apiUrl;
  if (newConfig.apiKey && newConfig.apiKey !== 'not set' && !newConfig.apiKey.includes('...')) {
    settings.env.ANTHROPIC_AUTH_TOKEN = newConfig.apiKey;
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  return getConfig();
}

const server = createServer(async (req, res) => {
  const url = req.url || '/', method = req.method || 'GET';
  // 添加缓存控制头
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (url === '/api/config' && method === 'GET') return json(res, await getConfig());
  if (url === '/api/config' && method === 'POST') {
    try {
      const body = await new Promise<any>((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
        req.on('error', reject);
      });
      return json(res, await saveConfig(body));
    } catch (e: any) { res.writeHead(400); res.end(e.message); return; }
  }
  // 单个 Session 详情 API (必须在 sessions 列表之前匹配)
  const singleSessionMatch = url.match(/^\/api\/sessions\/([^\/\?]+)$/);
  if (singleSessionMatch && method === 'GET') {
    const sessionId = singleSessionMatch[1];
    const allSessions = await getSessions(); // 获取所有 sessions
    const session = allSessions.find(s => s.id === sessionId);
    if (session) {
      return json(res, session);
    } else {
      return json(res, { error: 'Session not found' }, 404);
    }
  }

  // Sessions 列表 API
  if (url.startsWith('/api/sessions') && method === 'GET') {
    const urlObj = new URL(`http://localhost${url}`);
    const limit = parseInt(urlObj.searchParams.get('limit') || '20');
    const offset = parseInt(urlObj.searchParams.get('offset') || '0');
    console.log(`[API] GET /api/sessions limit=${limit} offset=${offset}`);
    const sessions = await getSessions(limit, offset);
    return json(res, {
      sessions,
      pagination: { limit, offset, total: sessions.length }
    });
  }
  if (url === '/api/cache' && method === 'POST') {
    await clearCache();
    return json(res, { status: 'cleared' });
  }
  if (url === '/api/cache' && method === 'GET') {
    return json(res, {
      memory: sessionCache ? { valid: true, expiresAt: sessionCache.expiresAt } : { valid: false },
      stats: cacheStats
    });
  }

  // ========== SSH Server Management APIs ==========
  // GET /api/servers - List all configured servers
  if (url === '/api/servers' && method === 'GET') {
    return json(res, { servers: sshManager.getServers() });
  }

  // POST /api/servers - Add a new server
  if (url === '/api/servers' && method === 'POST') {
    try {
      const body = await new Promise<any>((resolve, reject) => {
        let data = '';
        req.on('data', chunk => data += chunk);
        req.on('end', () => { try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); } });
        req.on('error', reject);
      });
      if (!body.id || !body.host || !body.username) {
        return json(res, { error: 'Missing required fields: id, host, username' }, 400);
      }
      sshManager.addServer(body.id, body);
      console.log(`[SSH] Added server: ${body.id} (${body.host})`);
      return json(res, { status: 'added', id: body.id });
    } catch (e: any) { return json(res, { error: e.message }, 400); }
  }

  // DELETE /api/servers/:id - Remove a server
  const serverDeleteMatch = url.match(/^\/api\/servers\/([^\/]+)$/);
  if (serverDeleteMatch && method === 'DELETE') {
    const serverId = serverDeleteMatch[1];
    const removed = sshManager.removeServer(serverId);
    console.log(`[SSH] Removed server: ${serverId}`);
    return json(res, removed ? { status: 'removed' } : { error: 'Server not found' }, removed ? 200 : 404);
  }

  // POST /api/servers/:id/test - Test SSH connection
  const serverTestMatch = url.match(/^\/api\/servers\/([^\/]+)\/test$/);
  if (serverTestMatch && method === 'POST') {
    const serverId = serverTestMatch[1];
    try {
      await sshManager.testConnection(serverId);
      console.log(`[SSH] Connection test passed: ${serverId}`);
      return json(res, { status: 'connected', serverId });
    } catch (e: any) {
      console.error(`[SSH] Connection test failed: ${serverId}`, e.message);
      return json(res, { status: 'failed', error: e.message }, 400);
    }
  }

  // GET /api/servers/:id/sessions - Get remote sessions
  const serverSessionsMatch = url.match(/^\/api\/servers\/([^\/]+)\/sessions$/);
  if (serverSessionsMatch && method === 'GET') {
    const serverId = serverSessionsMatch[1];
    try {
      const sessions = await sshManager.getRemoteSessions(serverId);
      console.log(`[SSH] Fetched ${sessions.length} sessions from ${serverId}`);
      return json(res, { sessions, serverId });
    } catch (e: any) {
      return json(res, { error: e.message }, 500);
    }
  }

  // POST /api/servers/:serverId/sessions/:sessionId/terminal - Start remote terminal
  const remoteTerminalMatch = url.match(/^\/api\/servers\/([^\/]+)\/sessions\/([^\/]+)\/terminal$/);
  if (remoteTerminalMatch && method === 'POST') {
    const [, serverId, sessionId] = remoteTerminalMatch;
    try {
      const session = await sshManager.createPTYSession(serverId, sessionId);
      console.log(`[SSH] Started PTY session: ${serverId}/${sessionId}`);
      return json(res, { status: 'started', serverId, sessionId });
    } catch (e: any) {
      console.error(`[SSH] Failed to start PTY: ${e.message}`);
      return json(res, { error: e.message }, 500);
    }
  }

  if (url === '/api/terminal-pool' && method === 'GET') {
    return json(res, {
      pool: terminalPool,
      active: Array.from(terminals.entries()).map(([id, t]) => ({
        id,
        hasWs: !!t.ws,
        createdAt: t.createdAt,
        lastActivity: t.lastActivity
      }))
    });
  }
  const m = url.match(/^\/api\/sessions\/([^\/]+)/);
  if (m && method === 'GET') {
    const allSessions = await getSessions(); // 获取所有 sessions
    const session = allSessions.find(x => x.id === m[1]);
    return session ? json(res, session) : json(res, { error: 'Not found' }, 404);
  }
  if (m && method === 'POST' && url.includes('/terminal')) {
    const sessionId = m[1];

    // 检查终端是否已在活动列表中
    if (terminals.has(sessionId)) {
      console.log(`[Terminal] Session ${sessionId} already running`);
      // 如果已有终端但没有WebSocket连接，尝试关联
      const term = terminals.get(sessionId);
      if (term) {
        console.log(`[Terminal] Resuming connection to existing terminal for ${sessionId}`);
      }
      return json(res, { status: 'running', pooled: true });
    }

    // 启动新终端
    try {
      // 设置 git-bash 路径（Windows 需要）
      const env = { ...process.env, TERM: 'xterm-256color', CLAUDECODE: undefined };

      if (process.platform === 'win32' && !process.env.CLAUDE_CODE_GIT_BASH_PATH) {
        const homedir = (await import('node:os')).homedir();
        const fs = await import('node:fs/promises');

        // 直接使用已知的 Git 安装路径，不依赖 PATH
        const possiblePaths = [
          // Scoop 安装路径
          join(homedir, 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
          // 标准安装路径
          'C:\\Program Files\\Git\\bin\\bash.exe',
          'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
          join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
        ].filter(Boolean);

        for (const p of possiblePaths) {
          try {
            await fs.access(p);
            env.CLAUDE_CODE_GIT_BASH_PATH = p;
            console.log(`[Terminal] Using git-bash: ${p}`);
            break;
          } catch {}
        }

        if (!env.CLAUDE_CODE_GIT_BASH_PATH) {
          console.warn('[Terminal] Warning: Could not find git-bash, using default');
        }
      }

      const proc = pty.spawn(process.env.SHELL || 'bash', ['-c', `unset CLAUDECODE && claude --resume ${sessionId}`], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: process.cwd(),
        env
      });

      // 设置 onData 处理器
      proc.onData(data => {
        const t = terminals.get(sessionId);
        if (t?.ws?.readyState === WebSocket.OPEN) {
          t.ws.send(JSON.stringify({ type: 'output', data }));
        }
      });

      terminals.set(sessionId, { pty: proc, createdAt: Date.now(), lastActivity: Date.now() });

      proc.onExit(({ exitCode }) => {
        console.log(`[Terminal] Session ${sessionId} exited with code ${exitCode}`);
        // 通知 WebSocket 客户端
        const t = terminals.get(sessionId);
        if (t?.ws?.readyState === WebSocket.OPEN) {
          t.ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
          t.ws.close();
        }
        terminals.delete(sessionId);
        // 从池中移除
        const idx = terminalPool.indexOf(sessionId);
        if (idx !== -1) terminalPool.splice(idx, 1);
      });

      return json(res, { status: 'started', pooled: false });
    } catch (error) {
      console.error(`[Terminal] Failed to start terminal for session ${sessionId}:`, error);
      return json(res, { error: 'Failed to start terminal', details: error.message }, 500);
    }
  }
  if (url === '/' || url === '/index.html') { const html = await readFile(join(__dirname, 'frontend', 'index.html')).catch(() => null); if (html) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; } }
  if (url === '/idea.html' || url === '/ideas') { const html = await readFile(join(__dirname, 'frontend', 'idea.html')).catch(() => null); if (html) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; } }
  if (url === '/tips.html' || url === '/tips') { const html = await readFile(join(__dirname, 'frontend', 'tips.html')).catch(() => null); if (html) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; } }
  if (url === '/playground.html' || url === '/playground') { const html = await readFile(join(__dirname, 'frontend', 'playground.html')).catch(() => null); if (html) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; } }
  const tm = url.match(/^\/terminal\/(.+)/);
  if (tm) { const html = await readFile(join(__dirname, 'frontend', 'terminal.html')).catch(() => null); if (html) { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(html); return; } }

  // 静态文件服务：asserts 目录
  if (url.startsWith('/asserts/')) {
    const filePath = join(__dirname, url);
    try {
      const fileContent = await readFile(filePath);
      const ext = filePath.split('.').pop();
      const contentType = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'md': 'text/markdown',
        'txt': 'text/plain',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon'
      }[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fileContent);
      return;
    } catch (e) {
      console.log(`Asserts file not found: ${filePath}`);
    }
  }

  // 静态文件服务：docs目录
  if (url.startsWith('/docs/')) {
    const filePath = join(__dirname, url);
    try {
      const fileContent = await readFile(filePath, 'utf-8');
      const ext = filePath.split('.').pop();
      const contentType = {
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'json': 'application/json',
        'md': 'text/markdown',
        'txt': 'text/plain'
      }[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(fileContent);
      return;
    } catch (e) {
      console.log(`Static file not found: ${filePath}`);
    }
  }

  res.writeHead(404); res.end('Not found');
});

const wss = new WebSocketServer({ server });
wss.on('connection', (ws, req) => {
  const url = req.url || '';

  // ========== SSH Remote Terminal WebSocket ==========
  const sshMatch = url.match(/^\/ws\/ssh\/([^\/]+)\/([^\/]+)/);
  if (sshMatch) {
    const [, serverId, sessionId] = sshMatch;
    console.log(`[WebSocket SSH] Connecting to ${serverId}/${sessionId}`);

    // Check if PTY session exists
    const session = sshManager.getPTYSession(serverId, sessionId);
    if (!session) {
      ws.send(JSON.stringify({ type: 'error', data: 'PTY session not found. Start it first via POST /api/servers/:serverId/sessions/:sessionId/terminal' }));
      ws.close();
      return;
    }

    // Send output from SSH stream to WebSocket
    session.emitter.on('data', (data: string) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'output', data }));
      }
    });

    session.emitter.on('close', () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'close' }));
        ws.close();
      }
    });

    session.emitter.on('error', (err: Error) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'error', data: err.message }));
      }
    });

    // Handle input from WebSocket to SSH stream
    ws.on('message', data => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'input') {
          sshManager.writeToPTY(serverId, sessionId, msg.data);
        } else if (msg.type === 'resize') {
          sshManager.resizePTY(serverId, sessionId, msg.cols || 120, msg.rows || 30);
        }
      } catch {
        sshManager.writeToPTY(serverId, sessionId, data.toString());
      }
    });

    ws.on('close', () => {
      console.log(`[WebSocket SSH] Disconnected from ${serverId}/${sessionId}`);
      // Don't close PTY session on WebSocket close - allow reconnection
    });

    ws.send(JSON.stringify({ type: 'connected', serverId, sessionId }));
    return;
  }

  // ========== Local Terminal WebSocket ==========
  const m = url.match(/^\/ws\/terminal\/([^\/]+)/);
  if (!m) { ws.close(); return; }

  // 检查是否有已预启动的终端
  const term = terminals.get(m[1]);
  if (!term) {
    // 终端尚未启动，等待 POST /api/sessions/{id}/terminal 启动
    ws.send(JSON.stringify({ type: 'waiting', data: 'Waiting for terminal to start...' }));
    // 不关闭连接，等待终端启动
  } else {
    term.ws = ws;
    ws.send(JSON.stringify({ type: 'connected', sessionId: m[1] }));
    console.log(`[WebSocket] Connected to pre-warmed terminal ${m[1]}`);
  }

  ws.on('message', data => {
    const t = terminals.get(m[1]);
    if (t) {
      try {
        const { type, data: input } = JSON.parse(data.toString());
        if (type === 'input') t.pty.write(input);
      } catch {
        t.pty.write(data.toString());
      }
    }
  });

  ws.on('close', () => {
    const t = terminals.get(m[1]);
    if (t) {
      t.ws = undefined;
      t.lastActivity = Date.now();
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🗡️  ClaudePad running on http://0.0.0.0:${PORT}`);
  console.log(`📁 Cache directory: ${CACHE_DIR}`);
  console.log(`⏱️  Memory cache TTL: ${MEMORY_CACHE_TTL}ms, File cache TTL: ${FILE_CACHE_TTL}ms`);
  getSessions().then(s => console.log(`📚 Sessions: ${s.length}`));
});
