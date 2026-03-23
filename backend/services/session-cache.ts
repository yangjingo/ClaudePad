/**
 * Session Cache Service
 * Handles session discovery, caching, and token counting
 */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { SessionInfo, CachedData, CacheStats } from '../types/index.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const CACHE_DIR = join(process.cwd(), '.cache');
const CACHE_FILE = join(CACHE_DIR, 'sessions.json');
const MEMORY_CACHE_TTL = 5000;      // 5 seconds
const FILE_CACHE_TTL = 300000;      // 5 minutes

let sessionCache: CachedData | null = null;
let cacheStats: CacheStats = { hits: 0, misses: 0 };

// ========== History Parsing ==========

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
  } catch (e: any) {
    console.error('History parse error:', e.message);
  }
  return sessions;
}

// ========== Cache Functions ==========

async function ensureCacheDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
}

async function loadFromFileCache(): Promise<{ sessions: SessionInfo[]; timestamp: number } | null> {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8');
    const data = JSON.parse(content);
    if (Date.now() - data.timestamp < FILE_CACHE_TTL) {
      return data;
    }
  } catch {
    // Cache not found or corrupted
  }
  return null;
}

async function saveToFileCache(sessions: SessionInfo[]): Promise<void> {
  try {
    await ensureCacheDir();
    await writeFile(CACHE_FILE, JSON.stringify({ sessions, timestamp: Date.now() }, null, 2), 'utf-8');
  } catch (e: any) {
    console.error('Failed to save file cache:', e.message);
  }
}

// ========== Token Counting ==========

async function getTokenCount(sessionId: string): Promise<number> {
  const possiblePaths = [
    join(CLAUDE_DIR, 'sessions', `${sessionId}.jsonl`),
    join(CLAUDE_DIR, 'session-env', sessionId),
  ];

  for (const sessionPath of possiblePaths) {
    try {
      const { stat } = await import('node:fs/promises');
      const s = await stat(sessionPath);

      if (s.isFile() && sessionPath.endsWith('.jsonl')) {
        const content = await readFile(sessionPath, 'utf-8');
        return countTokensFromJsonl(content);
      } else if (s.isDirectory()) {
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

  // Try projects directory
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
    // projects directory not found
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

// ========== Session Discovery ==========

async function discoverSessions(): Promise<Set<string>> {
  const sessionIds = new Set<string>();
  const history = await parseHistory();
  history.forEach((_, id) => sessionIds.add(id));

  // sessions/ directory (new format)
  try {
    const sessionsDir = join(CLAUDE_DIR, 'sessions');
    const files = await readdir(sessionsDir);
    files.filter(f => f.endsWith('.jsonl')).forEach(f => {
      sessionIds.add(f.replace('.jsonl', ''));
    });
  } catch {}

  // session-env/ directory (old format)
  try {
    const sessionEnvDir = join(CLAUDE_DIR, 'session-env');
    const dirs = await readdir(sessionEnvDir);
    dirs.forEach(id => sessionIds.add(id));
  } catch {}

  // projects/ directory
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
  } catch {}

  return sessionIds;
}

async function loadSessionsFromDisk(): Promise<SessionInfo[]> {
  const startTime = Date.now();
  try {
    const ids = await discoverSessions();
    const history = await parseHistory();

    const sessions = await Promise.all(Array.from(ids).map(async id => {
      const h = history.get(id);
      const ts = h?.timestamp || Date.now();
      const ageMinutes = (Date.now() - ts) / 60000;
      let status: 'running' | 'idle' | 'completed';
      if (ageMinutes < 30) status = 'running';
      else if (ageMinutes < 120) status = 'idle';
      else status = 'completed';

      const tokenCount = await getTokenCount(id);

      return {
        id,
        name: h?.name || id.slice(0, 8),
        status,
        startTime: new Date(ts).toISOString(),
        projectPath: h?.project || process.cwd(),
        lastActivity: new Date(ts).toISOString(),
        duration: Math.floor((Date.now() - ts) / 1000),
        tokenCount
      };
    }));

    const result = sessions.filter(s => s).sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );

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

// ========== Main API ==========

export async function getSessions(limit?: number, offset?: number): Promise<SessionInfo[]> {
  const now = Date.now();

  // Check memory cache
  if (sessionCache && now < sessionCache.expiresAt) {
    cacheStats.hits++;
    console.log(`[Cache HIT] Memory (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
    const start = offset || 0;
    const end = limit ? start + limit : sessionCache.sessions.length;
    return sessionCache.sessions.slice(start, end);
  }

  cacheStats.misses++;

  // Check file cache
  const fileCache = await loadFromFileCache();
  if (fileCache) {
    console.log(`[Cache HIT] File (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
    sessionCache = {
      sessions: fileCache.sessions,
      timestamp: now,
      expiresAt: now + MEMORY_CACHE_TTL
    };
    const start = offset || 0;
    const end = limit ? start + limit : fileCache.sessions.length;
    return fileCache.sessions.slice(start, end);
  }

  // Load from disk
  console.log(`[Cache MISS] Loading from disk (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
  const allSessions = await loadSessionsFromDisk();
  sessionCache = { sessions: allSessions, timestamp: now, expiresAt: now + MEMORY_CACHE_TTL };
  await saveToFileCache(allSessions);

  const start = offset || 0;
  const end = limit ? start + limit : allSessions.length;
  return allSessions.slice(start, end);
}

export async function clearCache(): Promise<void> {
  sessionCache = null;
  cacheStats = { hits: 0, misses: 0 };
  try {
    await writeFile(CACHE_FILE, JSON.stringify({ sessions: [], timestamp: 0, expired: true }), 'utf-8');
  } catch (e: any) {
    console.error('Failed to clear file cache:', e.message);
  }
  console.log('[Cache] Cleared');
}

export function getCacheStatus() {
  return {
    memory: sessionCache ? { valid: true, expiresAt: sessionCache.expiresAt } : { valid: false },
    stats: cacheStats
  };
}

export function getCacheInfo() {
  return {
    dir: CACHE_DIR,
    memoryTTL: MEMORY_CACHE_TTL,
    fileTTL: FILE_CACHE_TTL
  };
}