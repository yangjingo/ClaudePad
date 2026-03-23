/**
 * SSH Connection Manager for ClaudePad
 * Manages SSH connections to remote servers with in-memory password storage
 */
import { Client } from 'ssh2';
import { EventEmitter } from 'events';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// In-memory storage for server configs (passwords are not persisted)
const serverConfigs = new Map();

// Active SSH connections pool
const activeConnections = new Map();

// Active PTY sessions
const activeSessions = new Map();

/**
 * Build SSH connection config with password or SSH key
 * @param {Object} config - Server config { host, port, username, password }
 * @returns {Object} SSH connection config for ssh2
 */
function buildSSHConfig(config) {
  const sshConfig = {
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
      } catch (e) {
        console.warn(`[SSH] Failed to read key ${keyPath}: ${e.message}`);
      }
    }
  }

  return sshConfig;
}

/**
 * Add a remote server configuration
 * @param {string} id - Unique server ID
 * @param {Object} config - Server config { host, port, username, password }
 */
export function addServer(id, config) {
  serverConfigs.set(id, {
    host: config.host,
    port: config.port || 22,
    username: config.username,
    password: config.password,  // Stored only in memory
    name: config.name || config.host
  });
}

/**
 * Remove a server configuration
 * @param {string} id - Server ID
 */
export function removeServer(id) {
  // Close any active connections
  if (activeConnections.has(id)) {
    const conn = activeConnections.get(id);
    conn.end();
    activeConnections.delete(id);
  }
  return serverConfigs.delete(id);
}

/**
 * Get all configured servers (without passwords)
 */
export function getServers() {
  const servers = [];
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
 * @param {string} id - Server ID
 */
export function getServerConfig(id) {
  return serverConfigs.get(id);
}

/**
 * Test SSH connection to a server
 * @param {string} id - Server ID
 * @returns {Promise<boolean>}
 */
export function testConnection(id) {
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

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect(buildSSHConfig(config));
  });
}

/**
 * Execute a command on remote server via SSH
 * @param {string} id - Server ID
 * @param {string} command - Command to execute
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
export function execCommand(id, command) {
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
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        stream.on('close', (code, signal) => {
          conn.end();
          resolve({ stdout, stderr, code, signal });
        });

        stream.on('data', (data) => {
          stdout += data.toString();
        });

        stream.stderr.on('data', (data) => {
          stderr += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.connect(buildSSHConfig(config));
  });
}

/**
 * Get Claude sessions from a remote server
 * @param {string} id - Server ID
 * @returns {Promise<Array>}
 */
export async function getRemoteSessions(id) {
  const config = serverConfigs.get(id);
  if (!config) {
    throw new Error('Server not found');
  }

  try {
    // Try multiple sources for session discovery
    const sources = [];

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
    let historyData = [];
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

    const sessions = [];
    for (const { id: sessionId, source } of sources) {
      const history = historyData.find(h => h.sessionId === sessionId);
      const timestamp = history?.timestamp || Date.now();
      const ageMs = Date.now() - timestamp;
      let status;
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
  } catch (err) {
    console.error('Failed to get remote sessions:', err);
    return [];
  }
}

/**
 * Create an interactive PTY session for claude --resume
 * @param {string} serverId - Server ID
 * @param {string} sessionId - Claude session ID to resume
 * @returns {Promise<{stream: Object, conn: Client}>}
 */
export function createPTYSession(serverId, sessionId) {
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
      }, (err, stream) => {
        if (err) {
          conn.end();
          reject(err);
          return;
        }

        // Store the session
        const session = {
          conn,
          stream,
          serverId,
          sessionId,
          emitter: new EventEmitter()
        };
        activeSessions.set(sessionKey, session);
        console.log(`[SSH] PTY session created: ${sessionKey}`);

        // Handle stream events
        stream.on('data', (data) => {
          console.log(`[SSH] Stream data (${data.length} bytes): ${data.toString().substring(0, 30).replace(/\n/g, '\\n')}...`);
          session.emitter.emit('data', data.toString());
        });

        stream.on('close', () => {
          session.emitter.emit('close');
          activeSessions.delete(sessionKey);
          conn.end();
        });

        stream.on('error', (err) => {
          session.emitter.emit('error', err);
        });

        // Execute claude --resume after a short delay to let shell initialize
        setTimeout(() => {
          stream.write(`claude --resume ${sessionId}\r`);
        }, 500);

        resolve(session);
      });
    });

    conn.on('error', (err) => {
      reject(err);
    });

    conn.on('end', () => {
      activeSessions.delete(sessionKey);
    });

    conn.connect(buildSSHConfig(config));
  });
}

/**
 * Write data to a PTY session
 * @param {string} serverId - Server ID
 * @param {string} sessionId - Claude session ID
 * @param {string} data - Data to write
 */
export function writeToPTY(serverId, sessionId, data) {
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
 * @param {string} serverId - Server ID
 * @param {string} sessionId - Claude session ID
 */
export function closePTYSession(serverId, sessionId) {
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
 * @param {string} serverId - Server ID
 * @param {string} sessionId - Claude session ID
 */
export function getPTYSession(serverId, sessionId) {
  const sessionKey = `${serverId}:${sessionId}`;
  return activeSessions.get(sessionKey);
}

/**
 * Resize PTY terminal
 * @param {string} serverId - Server ID
 * @param {string} sessionId - Claude session ID
 * @param {number} cols - Columns
 * @param {number} rows - Rows
 */
export function resizePTY(serverId, sessionId, cols, rows) {
  const sessionKey = `${serverId}:${sessionId}`;
  const session = activeSessions.get(sessionKey);
  if (session && session.stream) {
    session.stream.setWindow(rows, cols);
  }
}
