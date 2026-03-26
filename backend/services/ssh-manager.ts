/**
 * SSH Connection Manager for ClaudePad
 * Manages SSH connections to remote servers with in-memory password storage
 */
import { Client, ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { SSHServerConfig, SSHServer, PTYSession } from '../types/index.js';

// In-memory storage for server configs
const serverConfigs = new Map<string, SSHServerConfig>();

// Active SSH connections pool (Persistent Clients)
const activeConnections = new Map<string, Client>();
const activeConnectionPromises = new Map<string, Promise<Client>>();

// Active PTY sessions (Active Shells)
const activeSessions = new Map<string, PTYSession>();
const MAX_OUTPUT_BUFFER_BYTES = 64 * 1024;
const invalidSessionIdsByServer = new Map<string, Set<string>>();
const invalidSessionsStorePath = join(process.cwd(), '.cache', 'invalid-remote-sessions.json');
const trustedWorkspacesByServer = new Map<string, Set<string>>();
const trustedWorkspacesStorePath = join(process.cwd(), '.cache', 'trusted-remote-workspaces.json');
const validationCache = new Map<string, { valid: boolean; checkedAt: number }>();
const historyMetadataCache = new Map<string, { hint: string | null; projectPath: string | null; checkedAt: number }>();
const VALIDATION_TTL_MS = 10 * 60 * 1000;
const HISTORY_METADATA_TTL_MS = 5 * 60 * 1000;

function buildHistoryHint(display: string | undefined): string | null {
  if (!display) return null;
  const normalized = display.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const candidate = normalized
    .replace(/^\[Pasted text.*?\]\s*/i, '')
    .replace(/[^\p{L}\p{N}\u4e00-\u9fff/_:\-. ]+/gu, '')
    .trim();

  if (candidate.length < 4) return null;
  return candidate.slice(0, 12);
}

function loadInvalidSessions(): void {
  try {
    if (!existsSync(invalidSessionsStorePath)) return;
    const raw = readFileSync(invalidSessionsStorePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    for (const [serverId, ids] of Object.entries(parsed || {})) {
      invalidSessionIdsByServer.set(serverId, new Set(ids || []));
    }
  } catch {}
}

function saveInvalidSessions(): void {
  try {
    const dir = join(process.cwd(), '.cache');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const obj: Record<string, string[]> = {};
    for (const [serverId, ids] of invalidSessionIdsByServer.entries()) {
      obj[serverId] = Array.from(ids);
    }
    writeFileSync(invalidSessionsStorePath, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

function loadTrustedWorkspaces(): void {
  try {
    if (!existsSync(trustedWorkspacesStorePath)) return;
    const raw = readFileSync(trustedWorkspacesStorePath, 'utf8');
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    for (const [serverId, paths] of Object.entries(parsed || {})) {
      trustedWorkspacesByServer.set(serverId, new Set((paths || []).filter(Boolean)));
    }
  } catch {}
}

function saveTrustedWorkspaces(): void {
  try {
    const dir = join(process.cwd(), '.cache');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const obj: Record<string, string[]> = {};
    for (const [serverId, paths] of trustedWorkspacesByServer.entries()) {
      obj[serverId] = Array.from(paths);
    }
    writeFileSync(trustedWorkspacesStorePath, JSON.stringify(obj, null, 2), 'utf8');
  } catch {}
}

function markSessionInvalid(serverId: string, sessionId: string): void {
  let set = invalidSessionIdsByServer.get(serverId);
  if (!set) {
    set = new Set<string>();
    invalidSessionIdsByServer.set(serverId, set);
  }
  set.add(sessionId);
  saveInvalidSessions();
}

function clearSessionInvalid(serverId: string, sessionId: string): void {
  const set = invalidSessionIdsByServer.get(serverId);
  if (!set) return;
  if (!set.delete(sessionId)) return;
  if (set.size === 0) invalidSessionIdsByServer.delete(serverId);
  saveInvalidSessions();
}

function isSessionInvalid(serverId: string, sessionId: string): boolean {
  return invalidSessionIdsByServer.get(serverId)?.has(sessionId) || false;
}

function markTrustedWorkspace(serverId: string, projectPath: string | null): void {
  if (!projectPath) return;
  const normalized = projectPath.trim();
  if (!normalized) return;
  let set = trustedWorkspacesByServer.get(serverId);
  if (!set) {
    set = new Set<string>();
    trustedWorkspacesByServer.set(serverId, set);
  }
  if (set.has(normalized)) return;
  set.add(normalized);
  saveTrustedWorkspaces();
}

function isTrustedWorkspace(serverId: string, projectPath: string | null): boolean {
  if (!projectPath) return false;
  const normalized = projectPath.trim();
  if (!normalized) return false;
  return trustedWorkspacesByServer.get(serverId)?.has(normalized) || false;
}

function getValidationCacheKey(serverId: string, sessionId: string): string {
  return `${serverId}:${sessionId}`;
}

function getHistoryMetadataCacheKey(serverId: string, sessionId: string): string {
  return `${serverId}:${sessionId}`;
}

function getCachedValidation(serverId: string, sessionId: string): boolean | null {
  const cached = validationCache.get(getValidationCacheKey(serverId, sessionId));
  if (!cached) return null;
  if (Date.now() - cached.checkedAt > VALIDATION_TTL_MS) {
    validationCache.delete(getValidationCacheKey(serverId, sessionId));
    return null;
  }
  return cached.valid;
}

function setCachedValidation(serverId: string, sessionId: string, valid: boolean): void {
  validationCache.set(getValidationCacheKey(serverId, sessionId), {
    valid,
    checkedAt: Date.now()
  });
}

function getCachedHistoryMetadata(serverId: string, sessionId: string): { hint: string | null; projectPath: string | null } | null {
  const cached = historyMetadataCache.get(getHistoryMetadataCacheKey(serverId, sessionId));
  if (!cached) return null;
  if (Date.now() - cached.checkedAt > HISTORY_METADATA_TTL_MS) {
    historyMetadataCache.delete(getHistoryMetadataCacheKey(serverId, sessionId));
    return null;
  }
  return {
    hint: cached.hint,
    projectPath: cached.projectPath
  };
}

function setCachedHistoryMetadata(serverId: string, sessionId: string, metadata: { hint: string | null; projectPath: string | null }): void {
  historyMetadataCache.set(getHistoryMetadataCacheKey(serverId, sessionId), {
    ...metadata,
    checkedAt: Date.now()
  });
}

/**
 * Build SSH connection config
 */
function buildSSHConfig(config: SSHServerConfig): any {
  const sshConfig: any = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: 15000,
    keepaliveInterval: 10000,
    keepaliveCountMax: 3
  };

  if (config.password) {
    sshConfig.password = config.password;
    return sshConfig;
  }

  const home = homedir();
  const keyPaths = [
    join(home, '.ssh', 'id_ed25519'),
    join(home, '.ssh', 'id_rsa')
  ];

  for (const keyPath of keyPaths) {
    if (existsSync(keyPath)) {
      try {
        sshConfig.privateKey = readFileSync(keyPath);
        break;
      } catch (e) {}
    }
  }

  return sshConfig;
}

/**
 * Get or Create a persistent SSH connection
 */
function getOrCreateConnection(serverId: string): Promise<Client> {
  const existing = activeConnections.get(serverId);
  if (existing && (existing as any)._state === 'authenticated') {
    return Promise.resolve(existing);
  }

  const inflight = activeConnectionPromises.get(serverId);
  if (inflight) return inflight;

  const config = serverConfigs.get(serverId);
  if (!config) return Promise.reject(new Error('Server config not found'));

  const promise = new Promise<Client>((resolve, reject) => {
    console.log(`[SSH] Establishing new persistent connection to ${serverId}...`);
    const conn = new Client();
    let settled = false;

    conn.on('ready', () => {
      if (settled) return;
      settled = true;
      console.log(`[SSH] Connection established and pooled: ${serverId}`);
      activeConnections.set(serverId, conn);
      activeConnectionPromises.delete(serverId);
      resolve(conn);
    });

    conn.on('error', (err) => {
      console.error(`[SSH] Connection error on ${serverId}:`, err.message);
      activeConnections.delete(serverId);
      activeConnectionPromises.delete(serverId);
      if (settled) return;
      settled = true;
      reject(err);
    });

    conn.on('close', () => {
      console.log(`[SSH] Connection closed: ${serverId}`);
      activeConnections.delete(serverId);
      activeConnectionPromises.delete(serverId);
    });

    conn.connect(buildSSHConfig(config));
  });

  activeConnectionPromises.set(serverId, promise);
  return promise;
}

/**
 * Add a remote server configuration
 */
export function addServer(id: string, config: SSHServerConfig): void {
  serverConfigs.set(id, {
    ...config,
    port: config.port || 22,
    name: config.name || config.host
  });
}

/**
 * Remove a server configuration
 */
export function removeServer(id: string): boolean {
  const conn = activeConnections.get(id);
  if (conn) {
    conn.end();
    activeConnections.delete(id);
  }
  return serverConfigs.delete(id);
}

/**
 * Get all configured servers
 */
export function getServers(): SSHServer[] {
  const servers: SSHServer[] = [];
  for (const [id, config] of serverConfigs) {
    servers.push({
      id,
      name: config.name,
      host: config.host,
      port: config.port,
      username: config.username,
      connected: activeConnections.has(id)
    });
  }
  return servers;
}

/**
 * Test SSH connection
 */
export async function testConnection(id: string): Promise<boolean> {
  const conn = await getOrCreateConnection(id);
  return !!conn;
}

/**
 * Execute a command on remote server (uses pooled connection)
 */
export async function execCommand(id: string, command: string): Promise<{ stdout: string; stderr: string; code?: number; signal?: string }> {
  const conn = await getOrCreateConnection(id);
  
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';

    console.log(`[SSH EXEC] ${id} > ${command}`);
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);

      stream.on('data', (data: Buffer) => { stdout += data.toString(); });
      stream.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });
      
      stream.on('close', (code: number | null, signal: string | null) => {
        resolve({ stdout, stderr, code: code ?? undefined, signal: signal ?? undefined });
      });
    });
  });
}

/**
 * Get Claude sessions from a remote server
 */
export async function getRemoteSessions(id: string): Promise<any[]> {
  try {
    const execSafe = async (command: string): Promise<string> => {
      try {
        const { stdout } = await execCommand(id, command);
        return stdout || '';
      } catch {
        return '';
      }
    };

    const { stdout: homeOut } = await execCommand(id, 'echo $HOME');
    const baseDir = homeOut.trim() || '/root';
    const claudePath = `${baseDir}/.claude`;

    const sources: { id: string; source: string }[] = [];

    // 1. Get history
    const { stdout: historyRaw } = await execCommand(id, `cat ${claudePath}/history.jsonl 2>/dev/null || echo ""`);
    const historyData = historyRaw.trim().split('\n').filter(l => l).map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(Boolean);
    
    const historyIdSet = new Set<string>();
    for (const entry of historyData) {
      if (entry.sessionId && !sources.find(s => s.id === entry.sessionId)) {
        sources.push({ id: entry.sessionId, source: 'history' });
        historyIdSet.add(entry.sessionId);
      }
    }

    // 2. Check sessions artifacts (cross-structure):
    // - Linux/macOS: ~/.claude/sessions/*.jsonl|*.json and ~/.claude/file-history/<uuid>
    // - Windows:    ~/.claude/sessions/*.json and ~/.claude/file-history/<uuid>
    const sessionFilesLinux = await execSafe(
      `sh -lc 'for f in ${claudePath}/sessions/*; do [ -f "$f" ] || continue; n=$(basename "$f"); case "$n" in *.jsonl|*.json) echo "$n";; esac; done 2>/dev/null'`
    );
    const sessionEnvLinux = await execSafe(
      `sh -lc 'for d in ${claudePath}/session-env/*; do [ -d "$d" ] || continue; basename "$d"; done 2>/dev/null'`
    );
    const projectFilesLinux = await execSafe(
      `sh -lc 'for d in ${claudePath}/projects/*; do [ -d "$d" ] || continue; for f in "$d"/*.jsonl; do [ -f "$f" ] || continue; basename "$f"; done; done 2>/dev/null'`
    );
    const fileHistoryLinux = await execSafe(
      `sh -lc 'for d in ${claudePath}/file-history/*; do [ -d "$d" ] || continue; basename "$d"; done 2>/dev/null'`
    );
    const sessionFilesPs = await execSafe(
      `powershell -NoProfile -Command "$p = Join-Path $HOME '.claude\\\\sessions'; if (Test-Path $p) { Get-ChildItem -Path $p -File | Where-Object { $_.Extension -in '.json','.jsonl' } | ForEach-Object { $_.Name } }"`
    );
    const sessionEnvPs = await execSafe(
      `powershell -NoProfile -Command "$p = Join-Path $HOME '.claude\\\\session-env'; if (Test-Path $p) { Get-ChildItem -Path $p -Directory | ForEach-Object { $_.Name } }"`
    );
    const projectFilesPs = await execSafe(
      `powershell -NoProfile -Command "$p = Join-Path $HOME '.claude\\\\projects'; if (Test-Path $p) { Get-ChildItem -Path $p -Directory | ForEach-Object { Get-ChildItem -Path $_.FullName -File -Filter '*.jsonl' | ForEach-Object { $_.Name } } }"`
    );
    const fileHistoryPs = await execSafe(
      `powershell -NoProfile -Command "$p = Join-Path $HOME '.claude\\\\file-history'; if (Test-Path $p) { Get-ChildItem -Path $p -Directory | ForEach-Object { $_.Name } }"`
    );

    const sessionFiles = `${sessionFilesLinux}\n${sessionFilesPs}`
      .trim()
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const sessionEnvDirs = `${sessionEnvLinux}\n${sessionEnvPs}`
      .trim()
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const projectFiles = `${projectFilesLinux}\n${projectFilesPs}`
      .trim()
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    const fileHistoryDirs = `${fileHistoryLinux}\n${fileHistoryPs}`
      .trim()
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const strongArtifactIds = new Set<string>();
    const fallbackArtifactIds = new Set<string>();

    // A) Direct UUID filenames
    const jsonlNames = sessionFiles.filter(n => n.endsWith('.jsonl'));
    const jsonNames = sessionFiles.filter(n => n.endsWith('.json'));
    for (const fileName of [...jsonlNames, ...jsonNames]) {
      const base = fileName.replace(/\.(jsonl|json)$/i, '');
      if (uuidPattern.test(base)) strongArtifactIds.add(base);
    }

    // B) UUID embedded in *.json file content (new Claude session format)
    if (jsonNames.length > 0) {
      const escapedJsonFiles = jsonNames
        .map(name => `'${name.replace(/'/g, `'\\''`)}'`)
        .join(' ');
      const extractedLinux = await execSafe(
        `sh -lc 'for n in ${escapedJsonFiles}; do f="${claudePath}/sessions/$n"; grep -Eo "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" "$f" 2>/dev/null | head -n1; done'`
      );
      const extractedPs = await execSafe(
        `powershell -NoProfile -Command "$p = Join-Path $HOME '.claude\\\\sessions'; if (Test-Path $p) { Get-ChildItem -Path $p -File | Where-Object { $_.Extension -eq '.json' } | ForEach-Object { try { $c = Get-Content $_.FullName -Raw -ErrorAction Stop; if ($c -match '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}') { $Matches[0] } } catch {} } }"`
      );
      const extracted = `${extractedLinux}\n${extractedPs}`;
      for (const sid of extracted.trim().split('\n').filter(Boolean)) {
        if (uuidPattern.test(sid)) strongArtifactIds.add(sid);
      }
    }

    // C) session-env directory names are strong session candidates on newer Linux layouts.
    for (const dirName of sessionEnvDirs) {
      if (uuidPattern.test(dirName)) strongArtifactIds.add(dirName);
    }

    // D) project session files are also strong resumable artifacts.
    for (const fileName of projectFiles) {
      const base = fileName.replace(/\.jsonl$/i, '');
      if (uuidPattern.test(base)) strongArtifactIds.add(base);
    }

    // E) UUID directory names under file-history are fallback candidates.
    for (const dirName of fileHistoryDirs) {
      if (uuidPattern.test(dirName)) fallbackArtifactIds.add(dirName);
    }

    const candidateArtifactIds = strongArtifactIds.size > 0 ? strongArtifactIds : fallbackArtifactIds;
    const resumableIds = Array.from(candidateArtifactIds).filter(sessionId => historyIdSet.has(sessionId));
    console.log(
      `[SSH][Scan][${id}] history=${historyIdSet.size} sessions=${sessionFiles.length} sessionEnv=${sessionEnvDirs.length} projects=${projectFiles.length} fileHistory=${fileHistoryDirs.length} strong=${strongArtifactIds.size} fallback=${fallbackArtifactIds.size} resumable=${resumableIds.length}`
    );

    const sessions: any[] = [];
    for (const sessionId of resumableIds) {
      const history = historyData.find(h => h.sessionId === sessionId);
      const timestamp = history?.timestamp || Date.now();
      const ageMs = Date.now() - timestamp;
      
      let status: 'running' | 'idle' | 'completed' = ageMs < 3600000 ? 'running' : (ageMs < 10800000 ? 'idle' : 'completed');

      sessions.push({
        id: sessionId,
        name: history?.display?.slice(0, 50) || `Remote Session ${sessionId.slice(0, 8)}`,
        status,
        startTime: new Date(timestamp).toISOString(),
        projectPath: history?.project || '~',
        invalid: isSessionInvalid(id, sessionId),
        remote: true,
        serverId: id
      });
    }

    return sessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  } catch (err) {
    console.error(`[SSH] Discovery failed on ${id}:`, err);
    throw err;
  }
}

/**
 * Create an interactive PTY session (uses pooled connection)
 */
export async function createPTYSession(
  serverId: string,
  sessionId: string,
  options?: { awaitReady?: boolean }
): Promise<PTYSession> {
  const sessionKey = `${serverId}:${sessionId}`;
  const traceId = `${serverId}:${sessionId}`;
  const tCreateStart = Date.now();
  const awaitReady = options?.awaitReady !== false;
  console.log(`[Perf][SSH][${traceId}] create_pty_start=${tCreateStart}`);

  // 🚀 HOT-PLUG: If the session is already running, just return it!
  const existingSession = activeSessions.get(sessionKey);
  if (existingSession) {
    console.log(`[SSH] Hot-plugging into existing PTY session: ${sessionKey}`);
    console.log(`[Perf][SSH][${traceId}] hot_plug_reuse elapsed=${Date.now() - tCreateStart}ms`);
    return existingSession;
  }

  const conn = await getOrCreateConnection(serverId);
  console.log(`[Perf][SSH][${traceId}] ssh_connection_ready elapsed=${Date.now() - tCreateStart}ms`);

  const historyMeta = await getRemoteHistoryMetadata(serverId, sessionId);
  const historyHint = historyMeta.hint;
  const historyProjectPath = historyMeta.projectPath;
  const trustedWorkspace = isTrustedWorkspace(serverId, historyProjectPath);

  return new Promise((resolve, reject) => {
    const startCmd = buildRemoteResumeCommand(historyProjectPath, sessionId);

    conn.exec(startCmd, {
      pty: {
        term: 'xterm-256color',
        cols: 120,
        rows: 30
      }
    }, async (err: Error | undefined, stream: ClientChannel) => {
      if (err) return reject(err);
      const tPtyExecReady = Date.now();
      let tResumeCommandStarted = 0;
      let firstRemoteChunkLogged = false;
      console.log(`[Perf][SSH][${traceId}] pty_exec_ready elapsed=${tPtyExecReady - tCreateStart}ms`);

      const session: PTYSession = {
        conn,
        stream,
        serverId,
        sessionId,
        emitter: new EventEmitter(),
        outputBuffer: [],
        outputBufferBytes: 0,
        resumeReady: false
      };
      activeSessions.set(sessionKey, session);
      let startupSettled = false;
      let startupTimer: NodeJS.Timeout | null = null;
      let startupOutput = '';
      let safetyConfirmed = false;
      let startupReleased = false;
      let startupReplaySent = false;

      const releaseStartup = () => {
        if (startupReleased) return;
        startupReleased = true;
        resolve(session);
      };

      const flushStartupOutputToBrowser = () => {
        if (startupReplaySent) return;
        const buffered = startupOutput;
        if (!buffered) return;
        startupReplaySent = true;
        session.emitter.emit('data', buffered);
      };

      const finishFromWeakValidation = (fallbackReason: string) => {
        const startupState = evaluateStartupResume(startupOutput, sessionId, historyHint, true);
        if (startupState === 'valid') {
          finalizeStartup(true);
        } else if (startupState === 'invalid') {
          finalizeStartup(false, `Remote session ${sessionId} opened a blank welcome screen instead of resuming conversation`, { persistInvalid: true });
        } else {
          finalizeStartup(false, fallbackReason);
        }
      };

      const armStartupTimer = (delayMs: number) => {
        if (startupTimer) clearTimeout(startupTimer);
        startupTimer = setTimeout(() => {
          finishFromWeakValidation(`Timed out while validating remote session ${sessionId}`);
        }, delayMs);
      };

      const finalizeStartup = (
        ok: boolean,
        reason?: string,
        options?: { persistInvalid?: boolean }
      ) => {
        if (startupSettled) return;
        startupSettled = true;
        if (startupTimer) clearTimeout(startupTimer);
        if (ok) {
          clearSessionInvalid(serverId, sessionId);
          setCachedValidation(serverId, sessionId, true);
          session.resumeReady = true;
          session.emitter.emit('ready');
          releaseStartup();
          flushStartupOutputToBrowser();
          return;
        }

        const persistInvalid = options?.persistInvalid === true;
        if (persistInvalid) {
          markSessionInvalid(serverId, sessionId);
          setCachedValidation(serverId, sessionId, false);
        } else {
          validationCache.delete(getValidationCacheKey(serverId, sessionId));
        }
        const excerpt = sanitizeTerminalOutput(startupOutput)
          .slice(-1200)
          .replace(/\s+/g, ' ')
          .trim();
        console.log(
          `[SSH][Startup][${serverId}/${sessionId}] reject persistInvalid=${persistInvalid} reason="${reason || 'Remote session could not be resumed'}" excerpt="${excerpt}"`
        );
        activeSessions.delete(sessionKey);
        try { stream.end('exit\r'); } catch {}
        try { stream.close(); } catch {}
        if (!startupReleased) {
          reject(new Error(reason || 'Remote session could not be resumed'));
        }
      };

      stream.on('data', (data: Buffer) => {
        const chunk = data.toString();
        startupOutput += chunk;
        if (startupOutput.length > 32000) startupOutput = startupOutput.slice(-32000);
        session.outputBuffer.push(chunk);
        session.outputBufferBytes += Buffer.byteLength(chunk, 'utf8');
        while (session.outputBufferBytes > MAX_OUTPUT_BUFFER_BYTES && session.outputBuffer.length > 1) {
          const dropped = session.outputBuffer.shift();
          if (dropped) session.outputBufferBytes -= Buffer.byteLength(dropped, 'utf8');
        }

        if (!firstRemoteChunkLogged) {
          firstRemoteChunkLogged = true;
          const now = Date.now();
          console.log(
            `[Perf][SSH][${traceId}] remote_first_chunk total=${now - tCreateStart}ms from_pty_exec=${now - tPtyExecReady}ms from_resume_command=${tResumeCommandStarted ? now - tResumeCommandStarted : -1}ms bytes=${data.length}`
          );
        }
        if (/No conversation found with session ID/i.test(chunk)) {
          console.log(`[SSH] Marked invalid remote session: ${serverId}/${sessionId}`);
          if (startupSettled) {
            markSessionInvalid(serverId, sessionId);
            setCachedValidation(serverId, sessionId, false);
            session.emitter.emit('data', chunk);
          } else {
            finalizeStartup(false, `No conversation found with session ID: ${sessionId}`, { persistInvalid: true });
          }
          return;
        }
        const sanitizedOutput = sanitizeTerminalOutput(startupOutput);
        const compactOutput = sanitizedOutput.replace(/\s+/g, '');
        if (
          !safetyConfirmed &&
          /quicksafetycheck/i.test(compactOutput) &&
          /yes,?itrustthisfolder/i.test(compactOutput)
        ) {
          safetyConfirmed = true;
          markTrustedWorkspace(serverId, historyProjectPath);
          console.log(`[SSH] Auto-confirmed Claude safety check: ${serverId}/${sessionId}`);
          stream.write('1\r');
          armStartupTimer(18000);
          finalizeStartup(true);
          return;
        }
        const startupState = evaluateStartupResume(startupOutput, sessionId, historyHint);
        if (startupState === 'valid') {
          finalizeStartup(true);
          return;
        }
        if (startupState === 'invalid') {
          finalizeStartup(false, `Remote session ${sessionId} opened a blank welcome screen instead of resuming conversation`, { persistInvalid: true });
          return;
        }
        session.emitter.emit('data', chunk);
      });
      stream.on('close', () => {
        if (!startupSettled) {
          finishFromWeakValidation(`Remote session ${sessionId} closed before a recoverable conversation appeared`);
          return;
        }
        session.emitter.emit('close');
        activeSessions.delete(sessionKey);
      });
      stream.on('error', (err: Error) => session.emitter.emit('error', err));

      console.log(`[SSH] Fast startup command: ${startCmd}`);
      if (trustedWorkspace && historyProjectPath) {
        console.log(`[SSH] Trusted workspace cache hit: ${serverId} ${historyProjectPath}`);
      }
      tResumeCommandStarted = Date.now();
      console.log(`[Perf][SSH][${traceId}] resume_command_started elapsed=${tResumeCommandStarted - tCreateStart}ms`);
      if (!awaitReady) {
        releaseStartup();
      } else {
        armStartupTimer(18000);
      }
    });
  });
}

async function getRemoteHistoryMetadata(
  serverId: string,
  sessionId: string
): Promise<{ hint: string | null; projectPath: string | null }> {
  const cached = getCachedHistoryMetadata(serverId, sessionId);
  if (cached) return cached;

  try {
    const { stdout: homeOut } = await execCommand(serverId, 'echo $HOME');
    const baseDir = homeOut.trim() || '/root';
    const claudePath = `${baseDir}/.claude`;
    const { stdout } = await execCommand(
      serverId,
      `grep -F '"sessionId":"${sessionId}"' ${claudePath}/history.jsonl 2>/dev/null || true`
    );
    const lines = (stdout || '').split('\n').filter(Boolean);
    for (const line of lines.reverse()) {
      try {
        const parsed = JSON.parse(line);
        const metadata = {
          hint: buildHistoryHint(parsed.display),
          projectPath: typeof parsed.project === 'string' && parsed.project.trim() ? parsed.project.trim() : null
        };
        setCachedHistoryMetadata(serverId, sessionId, metadata);
        return metadata;
      } catch {}
    }
  } catch {}
  const emptyMetadata = { hint: null, projectPath: null };
  setCachedHistoryMetadata(serverId, sessionId, emptyMetadata);
  return emptyMetadata;
}

export async function getRemoteSessionStartupHint(
  serverId: string,
  sessionId: string
): Promise<{ trustedWorkspace: boolean; projectPath: string | null }> {
  const historyMeta = await getRemoteHistoryMetadata(serverId, sessionId);
  return {
    trustedWorkspace: isTrustedWorkspace(serverId, historyMeta.projectPath),
    projectPath: historyMeta.projectPath
  };
}

function evaluateStartupResume(output: string, sessionId: string, hint: string | null, allowWeakFallback = false): 'valid' | 'invalid' | 'pending' {
  const combined = sanitizeTerminalOutput(output).trim();
  if (!combined) return 'pending';
  if (/No conversation found with session ID/i.test(combined)) return 'invalid';
  if (/command not found|not recognized|permission denied|eacces/i.test(combined)) return 'invalid';

  const normalizedOutput = combined.replace(/\s+/g, ' ');
  const compactOutput = combined.replace(/\s+/g, '');
  if (hint && normalizedOutput.includes(hint.replace(/\s+/g, ' '))) return 'valid';
  if (!allowWeakFallback) return 'pending';

  const hasWelcomeBack = /Welcome back!/i.test(combined);
  const hasResumeFooter = new RegExp(`Resume this session with:\\s*claude --resume ${sessionId}`, 'i').test(combined);
  const hasNoRecentActivity = /No recent activity/i.test(combined);
  const hasSafetyPrompt = /quicksafetycheck|yes,?itrustthisfolder/i.test(compactOutput);
  const hasPromptWithContent = /[❯>]\s*(?!1\.?Yes,?Itrustthisfolder)\S+/i.test(compactOutput);
  const hasAssistantTurn = /[●•]\s*\S+/i.test(combined) || /[●•][A-Za-z\u4e00-\u9fff]/i.test(compactOutput);
  const hasWorkIndicators = /bash\(|read\b|update\(|searchedfor|churnedfor|cogitatedfor|try"/i.test(compactOutput);
  const hasConversationEvidence = hasPromptWithContent || hasAssistantTurn;

  if (!hasSafetyPrompt && (hasAssistantTurn || (hasPromptWithContent && hasWorkIndicators))) return 'valid';
  if ((hasWelcomeBack || hasResumeFooter) && hasConversationEvidence) return 'valid';
  if ((hasWelcomeBack || hasResumeFooter) && hasNoRecentActivity && !hasConversationEvidence) return 'invalid';
  return 'pending';
}

function sanitizeTerminalOutput(output: string): string {
  return output
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\r/g, '')
    .replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '');
}

function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildRemoteResumeCommand(projectPath: string | null, sessionId: string): string {
  if (projectPath && /^[A-Za-z]:\\/.test(projectPath)) {
    const escapedPath = projectPath.replace(/'/g, "''");
    return `powershell -NoProfile -Command "Set-Location -LiteralPath '${escapedPath}'; claude --resume ${sessionId}"`;
  }

  const workdirPart = projectPath ? `cd ${shellSingleQuote(projectPath)} && ` : '';
  return `sh -lc ${shellSingleQuote(`${workdirPart}exec claude --resume ${sessionId}`)}`;
}

export function writeToPTY(serverId: string, sessionId: string, data: string): boolean {
  const session = activeSessions.get(`${serverId}:${sessionId}`);
  if (session?.stream) {
    session.stream.write(data);
    return true;
  }
  return false;
}

export function closePTYSession(serverId: string, sessionId: string): void {
  const session = activeSessions.get(`${serverId}:${sessionId}`);
  if (session) {
    session.stream.close();
    activeSessions.delete(`${serverId}:${sessionId}`);
  }
}

export function getPTYSession(serverId: string, sessionId: string): PTYSession | undefined {
  return activeSessions.get(`${serverId}:${sessionId}`);
}

export function resizePTY(serverId: string, sessionId: string, cols: number, rows: number): void {
  const session = activeSessions.get(`${serverId}:${sessionId}`);
  if (session?.stream) session.stream.setWindow(rows, cols);
}

/**
 * Pre-configured Test Server
 */
addServer('insanelysane', {
  name: 'insanelysane',
  host: 'ssh.insanelysane.online',
  port: 22,
  username: 'lucas'
});

loadInvalidSessions();
loadTrustedWorkspaces();
