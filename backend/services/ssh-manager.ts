/**
 * SSH Connection Manager for ClaudePad
 * Manages SSH connections to remote servers with in-memory password storage
 */
import { Client, ClientChannel } from 'ssh2';
import { EventEmitter } from 'events';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { SSHServerConfig, SSHServer, PTYSession } from '../types/index.js';

// In-memory storage for server configs (passwords are not persisted)
const serverConfigs = new Map<string, SSHServerConfig>();

// Active SSH connections pool
const activeConnections = new Map<string, Client>();

// Active PTY sessions
const activeSessions = new Map<string, PTYSession>();

/**
 * Build SSH connection config with password or SSH key
 */
function buildSSHConfig(config: SSHServerConfig): any {
  const sshConfig: any = {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    readyTimeout: 10000
  };

  // If password provided, use password auth
  if (config.password) {
    sshConfig.password = config.password;
    return sshConfig;
  }

  // Otherwise, try SSH key authentication
  const home = homedir();
  const keyPaths = [
    join(home, '.ssh', 'id_ed25519'),
    join(home, '.ssh', 'id_rsa'),
    join(home, '.ssh', 'id_ecdsa'),
    join(home, '.ssh', 'id_dsa')
  ];

  for (const keyPath of keyPaths) {
    if (existsSync(keyPath)) {
      try {
        sshConfig.privateKey = readFileSync(keyPath);
        console.log(`[SSH] Using key: ${keyPath}`);
        break;
      } catch (e: any) {
        console.warn(`[SSH] Failed to read key ${keyPath}: ${e.message}`);
      }
    }
  }

  return sshConfig;
}

/**
 * Add a remote server configuration
 */
export function addServer(id: string, config: SSHServerConfig): void {
  serverConfigs.set(id, {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    password: config.password,
    name: config.name || config.host
  });
}

/**
 * Remove a server configuration
 */
export function removeServer(id: string): boolean {
  // Close any active connections
  if (activeConnections.has(id)) {
    const conn = activeConnections.get(id)!;
    conn.end();
    activeConnections.delete(id);
  }
  return serverConfigs.delete(id);
}

/**
 * Get all configured servers (without passwords)
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
 * Get a server config (with password, for internal use)
 */
export function getServerConfig(id: string): SSHServerConfig | undefined {
  return serverConfigs.get(id);
}

/**
 * Test SSH connection to a server
 */
export function testConnection(id: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const config = serverConfigs.get(id);
    if (!config) {
      reject(new Error('Server not found'));
      return;
    }

    const conn = new Client();

    conn.on('ready', () => {
      conn.end();
      resolve(true);
    });

    conn.on('error', (err: Error) => {
      reject(err);
    });

    conn.connect(buildSSHConfig(config));
  });
}

/**
 * Execute a command on remote server via SSH
 */
export function execCommand(id: string, command: string): Promise<{ stdout: string; stderr: string; code?: number; signal?: string }> {
  return new Promise((resolve, reject) => {
    const config = serverConfigs.get(id);
    if (!config) {
      reject(new Error('Server not found'));
      return;
    }

    const conn = new Client();
    let stdout = '';
    let stderr = '';

    conn.on('ready', () => {
      conn.exec(command, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        stream.on('close', (code: number | null, signal: string | null) => {
          conn.end();
          resolve({ stdout, stderr, code: code ?? undefined, signal: signal ?? undefined });
        });

        stream.on('data', (data: Buffer) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          stderr += data.toString();
        });
      });
    });

    conn.on('error', (err: Error) => {
      reject(err);
    });

    conn.connect(buildSSHConfig(config));
  });
}

/**
 * Get Claude sessions from a remote server
 */
export async function getRemoteSessions(id: string): Promise<any[]> {
  const config = serverConfigs.get(id);
  if (!config) {
    throw new Error('Server not found');
  }

  try {
    // Try multiple sources for session discovery
    const sources: { id: string; source: string }[] = [];

    // 1. Check session-env directory (older format)
    const { stdout: sessionEnvOut } = await execCommand(
      id,
      'ls ~/.claude/session-env/ 2>/dev/null || echo ""'
    );
    const sessionEnvIds = sessionEnvOut.trim().split('\n').filter(s => s && !s.startsWith('.'));
    sources.push(...sessionEnvIds.map(s => ({ id: s, source: 'session-env' })));

    // 2. Check sessions directory (newer format - .jsonl files)
    const { stdout: sessionsOut } = await execCommand(
      id,
      'ls ~/.claude/sessions/*.jsonl 2>/dev/null | xargs -n1 basename | sed "s/.jsonl$//" || echo ""'
    );
    const sessionsIds = sessionsOut.trim().split('\n').filter(s => s && !s.startsWith('.'));
    // Add only if not already in list
    for (const s of sessionsIds) {
      if (!sources.find(src => src.id === s)) {
        sources.push({ id: s, source: 'sessions' });
      }
    }

    // 3. Get history for session names and metadata
    let historyData: any[] = [];
    try {
      const { stdout: historyRaw } = await execCommand(
        id,
        'cat ~/.claude/history.jsonl 2>/dev/null || echo ""'
      );
      historyData = historyRaw
        .trim()
        .split('\n')
        .filter(l => l)
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(Boolean);
    } catch (e) {
      // History not available
    }

    const sessions: any[] = [];
    for (const { id: sessionId, source } of sources) {
      const history = historyData.find(h => h.sessionId === sessionId);
      const timestamp = history?.timestamp || Date.now();
      const ageMs = Date.now() - timestamp;
      let status: 'running' | 'idle' | 'completed';
      if (ageMs < 30 * 60 * 1000) { // 30 minutes
        status = 'running';
      } else if (ageMs < 2 * 60 * 60 * 1000) { // 2 hours
        status = 'idle';
      } else {
        status = 'completed';
      }

      sessions.push({
        id: sessionId,
        name: history?.display?.slice(0, 50) || `Remote Session ${sessionId.slice(0, 8)}`,
        status,
        startTime: new Date(timestamp).toISOString(),
        projectPath: history?.project || '~',
        lastActivity: new Date(timestamp).toISOString(),
        duration: Math.floor((Date.now() - timestamp) / 1000),
        tokenCount: 0,
        remote: true,
        serverId: id,
        serverName: config.name
      });
    }

    return sessions.sort((a, b) =>
      new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  } catch (err: any) {
    console.error('Failed to get remote sessions:', err);
    return [];
  }
}

/**
 * Helper to translate raw SSH errors into user-friendly messages
 */
function translateSSHError(err: any): string {
  if (err.code === 'ENOTFOUND') return `Host not found: ${err.hostname}`;
  if (err.code === 'ECONNREFUSED') return `Connection refused at ${err.address}:${err.port}`;
  if (err.code === 'ETIMEDOUT') return `Connection timed out. Check your firewall and server status.`;
  if (err.level === 'client-authentication') return `Authentication failed. Check your password or SSH keys.`;
  if (err.level === 'client-timeout') return `Connection handshake timed out.`;
  
  return err.message || 'Unknown SSH error';
}

/**
 * Create an interactive PTY session for claude --resume
 */
export function createPTYSession(serverId: string, sessionId: string): Promise<PTYSession> {
  return new Promise((resolve, reject) => {
    const config = serverConfigs.get(serverId);
    if (!config) {
      reject(new Error('Server not found'));
      return;
    }

    const conn = new Client();
    const sessionKey = `${serverId}:${sessionId}`;

    conn.on('ready', () => {
      conn.shell({
        term: 'xterm-256color',
        cols: 120,
        rows: 30
      }, (err: Error | undefined, stream: ClientChannel) => {
        if (err) {
          conn.end();
          reject(new Error(`Failed to open shell: ${err.message}`));
          return;
        }

        // Store the session
        const session: PTYSession = {
          conn,
          stream,
          serverId,
          sessionId,
          emitter: new EventEmitter()
        };
        activeSessions.set(sessionKey, session);
        console.log(`[SSH] PTY session created: ${sessionKey}`);

        // Handle stream events
        stream.on('data', (data: Buffer) => {
          session.emitter.emit('data', data.toString());
        });

        stream.on('close', () => {
          session.emitter.emit('close');
          activeSessions.delete(sessionKey);
          conn.end();
        });

        stream.on('error', (err: Error) => {
          const friendlyMsg = translateSSHError(err);
          session.emitter.emit('error', new Error(friendlyMsg));
        });

        // Execute claude --resume after a short delay to let shell initialize
        setTimeout(() => {
          stream.write(`claude --resume ${sessionId}\r`);
        }, 800); // Slightly longer delay for remote shells

        resolve(session);
      });
    });

    conn.on('error', (err: any) => {
      const friendlyMsg = translateSSHError(err);
      console.error(`[SSH] Connection error (${serverId}):`, friendlyMsg);
      reject(new Error(friendlyMsg));
    });

    conn.on('end', () => {
      activeSessions.delete(sessionKey);
    });

    try {
      conn.connect(buildSSHConfig(config));
    } catch (err: any) {
      reject(new Error(`Failed to initiate connection: ${err.message}`));
    }
  });
}

/**
 * Write data to a PTY session
 */
export function writeToPTY(serverId: string, sessionId: string, data: string): boolean {
  const sessionKey = `${serverId}:${sessionId}`;
  const session = activeSessions.get(sessionKey);
  if (session && session.stream) {
    session.stream.write(data);
    return true;
  }
  return false;
}

/**
 * Close a PTY session
 */
export function closePTYSession(serverId: string, sessionId: string): void {
  const sessionKey = `${serverId}:${sessionId}`;
  const session = activeSessions.get(sessionKey);
  if (session) {
    if (session.stream) {
      session.stream.close();
    }
    if (session.conn) {
      session.conn.end();
    }
    activeSessions.delete(sessionKey);
  }
}

/**
 * Get an active PTY session
 */
export function getPTYSession(serverId: string, sessionId: string): PTYSession | undefined {
  const sessionKey = `${serverId}:${sessionId}`;
  return activeSessions.get(sessionKey);
}

/**
 * Resize PTY terminal
 */
export function resizePTY(serverId: string, sessionId: string, cols: number, rows: number): void {
  const sessionKey = `${serverId}:${sessionId}`;
  const session = activeSessions.get(sessionKey);
  if (session && session.stream) {
    session.stream.setWindow(rows, cols);
  }
}