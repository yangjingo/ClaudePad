/**
 * SSH Connection Manager for ClaudePad
 * Manages SSH connections to remote servers with in-memory password storage
 */
import { Client } from 'ssh2';
import { EventEmitter } from 'events';

// In-memory storage for server configs (passwords are not persisted)
const serverConfigs = new Map();

// Active SSH connections pool
const activeConnections = new Map();

// Active PTY sessions
const activeSessions = new Map();

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

    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    });
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

    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    });
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
    // Try to get sessions from remote server's session-env directory
    const { stdout } = await execCommand(
      id,
      'ls -la ~/.claude/session-env/ 2>/dev/null || echo "[]"'
    );

    // Also try to get history for session names
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
    const sessionIds = stdout
      .split('\n')
      .filter(line => line.includes('drwx'))
      .map(line => line.split(/\s+/).pop())
      .filter(id => id && !id.startsWith('.') && id !== 'session-env');

    for (const sessionId of sessionIds) {
      const history = historyData.find(h => h.sessionId === sessionId);
      const timestamp = history?.timestamp || Date.now();
      const status = timestamp > Date.now() - 3600000 ? 'running' : 'completed';

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

        // Handle stream events
        stream.on('data', (data) => {
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

    conn.connect({
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      readyTimeout: 10000
    });
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
