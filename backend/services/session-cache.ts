/**
 * Session Cache Service
 * Handles session discovery and caching
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
const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

function normalizeSession(session: any): SessionInfo {
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    startTime: session.startTime,
    projectPath: session.projectPath,
    lastActivity: session.lastActivity,
    duration: session.duration,
    remote: session.remote,
    serverId: session.serverId,
    serverName: session.serverName
  };
}

// ========== History Parsing ==========

type HistoryMeta = { name: string; timestamp: number; project: string };

async function parseHistory(): Promise<Map<string, HistoryMeta>> {
  const sessions = new Map<string, HistoryMeta>();
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
      return {
        timestamp: data.timestamp,
        sessions: Array.isArray(data.sessions) ? data.sessions.map(normalizeSession) : []
      };
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

function extractSessionIdFromText(content: string): string | null {
  const match = content.match(UUID_PATTERN);
  return match ? match[0] : null;
}

async function discoverSessionIdsFromSessionsDir(): Promise<Set<string>> {
  const sessionIds = new Set<string>();
  try {
    const sessionsDir = join(CLAUDE_DIR, 'sessions');
    const files = await readdir(sessionsDir);
    for (const file of files) {
      if (!file.endsWith('.jsonl') && !file.endsWith('.json')) continue;

      const base = file.replace(/\.(jsonl|json)$/i, '');
      if (UUID_PATTERN.test(base)) {
        sessionIds.add(base);
        continue;
      }

      if (!file.endsWith('.json')) continue;

      try {
        const content = await readFile(join(sessionsDir, file), 'utf-8');
        const extractedId = extractSessionIdFromText(content);
        if (extractedId) sessionIds.add(extractedId);
      } catch {
        continue;
      }
    }
  } catch {
    // sessions directory not found
  }
  return sessionIds;
}

async function discoverSessionIdsFromSessionEnv(): Promise<Set<string>> {
  const sessionIds = new Set<string>();
  try {
    const sessionEnvDir = join(CLAUDE_DIR, 'session-env');
    const dirs = await readdir(sessionEnvDir);
    dirs.forEach(id => {
      if (id) sessionIds.add(id);
    });
  } catch {
    // session-env directory not found
  }
  return sessionIds;
}

async function discoverSessionIdsFromProjects(): Promise<Set<string>> {
  const sessionIds = new Set<string>();
  try {
    const projectsDir = join(CLAUDE_DIR, 'projects');
    const projects = await readdir(projectsDir);
    for (const project of projects) {
      try {
        const projectDir = join(projectsDir, project);
        const files = await readdir(projectDir);
        files.filter(f => f.endsWith('.jsonl')).forEach(f => {
          sessionIds.add(f.replace(/\.jsonl$/i, ''));
        });
      } catch {
        continue;
      }
    }
  } catch {
    // projects directory not found
  }
  return sessionIds;
}

async function discoverSessionIdsFromFileHistory(): Promise<Set<string>> {
  const sessionIds = new Set<string>();
  try {
    const fileHistoryDir = join(CLAUDE_DIR, 'file-history');
    const dirs = await readdir(fileHistoryDir);
    dirs.forEach(dirName => {
      if (UUID_PATTERN.test(dirName)) sessionIds.add(dirName);
    });
  } catch {
    // file-history directory not found
  }
  return sessionIds;
}

// ========== Session Discovery ==========

async function discoverSessions(): Promise<Set<string>> {
  const history = await parseHistory();
  const historyIds = new Set(history.keys());

  const artifactSources = await Promise.all([
    discoverSessionIdsFromSessionsDir(),
    discoverSessionIdsFromSessionEnv(),
    discoverSessionIdsFromProjects(),
    discoverSessionIdsFromFileHistory()
  ]);

  const artifactIds = new Set<string>();
  for (const ids of artifactSources) {
    ids.forEach(id => artifactIds.add(id));
  }

  const sessionIds = new Set<string>();
  historyIds.forEach(id => {
    if (artifactIds.has(id)) sessionIds.add(id);
  });

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

      return {
        id,
        name: h?.name || id.slice(0, 8),
        status,
        startTime: new Date(ts).toISOString(),
        projectPath: h?.project || process.cwd(),
        lastActivity: new Date(ts).toISOString(),
        duration: Math.floor((Date.now() - ts) / 1000)
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

async function getAllSessions(): Promise<SessionInfo[]> {
  const now = Date.now();

  if (sessionCache && now < sessionCache.expiresAt) {
    cacheStats.hits++;
    console.log(`[Cache HIT] Memory (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
    return sessionCache.sessions;
  }

  cacheStats.misses++;

  const fileCache = await loadFromFileCache();
  if (fileCache) {
    console.log(`[Cache HIT] File (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
    sessionCache = {
      sessions: fileCache.sessions,
      timestamp: now,
      expiresAt: now + MEMORY_CACHE_TTL
    };
    return fileCache.sessions;
  }

  console.log(`[Cache MISS] Loading from disk (${cacheStats.hits}/${cacheStats.hits + cacheStats.misses})`);
  const allSessions = await loadSessionsFromDisk();
  sessionCache = { sessions: allSessions, timestamp: now, expiresAt: now + MEMORY_CACHE_TTL };
  await saveToFileCache(allSessions);
  return allSessions;
}

export async function getSessions(limit?: number, offset?: number): Promise<SessionInfo[]> {
  const allSessions = await getAllSessions();
  const start = offset || 0;
  const end = limit ? start + limit : allSessions.length;
  return allSessions.slice(start, end);
}

export async function getSessionsPage(limit?: number, offset?: number): Promise<{ sessions: SessionInfo[]; total: number }> {
  const allSessions = await getAllSessions();
  const start = offset || 0;
  const end = limit ? start + limit : allSessions.length;
  return {
    sessions: allSessions.slice(start, end),
    total: allSessions.length
  };
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
