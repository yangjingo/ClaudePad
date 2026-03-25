/**
 * Terminal Pool Service
 * Manages local PTY terminals for Claude sessions
 */
import * as pty from 'node-pty';
import { WebSocket } from 'ws';
import { TerminalInfo } from '../types/index.js';

interface TerminalSession {
  pty: pty.IPty;
  ws?: WebSocket;
  createdAt: number;
  lastActivity: number;
}

const terminals = new Map<string, TerminalSession>();
const terminalPool: string[] = [];
const TERMINAL_IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

export function getTerminalWs(sessionId: string): WebSocket | undefined {
  return terminals.get(sessionId)?.ws;
}

export function setTerminalWs(sessionId: string, ws: WebSocket | undefined): void {
  const term = terminals.get(sessionId);
  if (term) {
    term.ws = ws;
    term.lastActivity = Date.now();
  }
}

export function hasTerminal(sessionId: string): boolean {
  return terminals.has(sessionId);
}

export async function startTerminal(sessionId: string, env: Record<string, string | undefined> = {}): Promise<{ status: string; pooled: boolean }> {
  // Check if session already exists
  if (terminals.has(sessionId)) {
    console.log(`[Terminal Pool] Reusing existing session ${sessionId}`);
    return { status: 'reused', pooled: true };
  }

  // 1. Determine the shell to use and find git-bash for Claude Code requirements
  let shellPath = process.env.SHELL || (process.platform === 'win32' ? 'powershell.exe' : 'bash');
  let foundBashPath = process.env.CLAUDE_CODE_GIT_BASH_PATH;

  if (process.platform === 'win32') {
    const { homedir } = await import('node:os');
    const { access } = await import('node:fs/promises');
    const osHomedir = homedir();
    const possiblePaths = [
      process.env.CLAUDE_CODE_GIT_BASH_PATH,
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      `${process.env.USERPROFILE}\\scoop\\apps\\git\\current\\bin\\bash.exe`,
      `${process.env.LOCALAPPDATA}\\Programs\\Git\\bin\\bash.exe`,
      'D:\\Program Files\\Git\\bin\\bash.exe', // Common alternative drive
    ].filter(Boolean) as string[];

    for (const p of possiblePaths) {
      try {
        await access(p);
        foundBashPath = p;
        shellPath = p; // Use git-bash as the primary shell if found
        console.log(`[Terminal] Using git-bash: ${p}`);
        break;
      } catch {}
    }
  }

  // 2. Dynamically find the claude binary path
  let claudeBin = 'claude';
  try {
    const { execSync } = await import('node:child_process');
    const findCmd = process.platform === 'win32' ? 'where.exe claude' : 'which claude';
    const output = execSync(findCmd, { encoding: 'utf-8' }).trim();
    const paths = output.split(/\r?\n/).filter(p => p.trim());
    
    if (paths.length > 0) {
      if (process.platform === 'win32') {
        claudeBin = paths.find(p => p.toLowerCase().endsWith('.cmd')) || 
                    paths.find(p => p.toLowerCase().endsWith('.exe')) || 
                    paths[0];
      } else {
        claudeBin = paths[0];
      }
      console.log(`[Terminal] Detected claude binary at: ${claudeBin}`);
    }
  } catch (err) {
    console.warn('[Terminal] Could not find absolute path for claude, using PATH fallback');
  }

  // 3. Prepare environment variables
  const ptyEnv: Record<string, string | undefined> = {
    ...process.env,
    ...env,
    TERM: 'xterm-256color',
    CLAUDECODE: undefined,
    CLAUDE_CODE_GIT_BASH_PATH: foundBashPath 
  };
  
  if (process.platform === 'win32') {
    ptyEnv.HOME = process.env.USERPROFILE;
  } else {
    ptyEnv.HOME = process.env.HOME;
  }

  // 4. Determine Working Directory
  let cwd = process.cwd();
  try {
    const { getSessions } = await import('./session-cache.js');
    const allSessions = await getSessions();
    const session = allSessions.find(s => s.id === sessionId);
    if (session && session.projectPath) {
      cwd = session.projectPath;
      console.log(`[Terminal] Setting CWD to: ${cwd}`);
    }
  } catch (err) {}

  // 5. Construct shell arguments
  let shellArgs: string[] = [];
  const isPowerShell = shellPath.toLowerCase().includes('powershell') || shellPath.toLowerCase().includes('pwsh');
  const isBash = shellPath.toLowerCase().includes('bash') || shellPath.toLowerCase().includes('sh');

  if (isPowerShell) {
    const envSetter = foundBashPath ? `$env:CLAUDE_CODE_GIT_BASH_PATH='${foundBashPath}';` : '';
    shellArgs = ['-NoProfile', '-Command', `${envSetter} $env:CLAUDECODE=''; & "${claudeBin}" --resume ${sessionId}`];
  } else if (isBash) {
    const envSetter = foundBashPath ? `export CLAUDE_CODE_GIT_BASH_PATH="${foundBashPath}" && ` : '';
    shellArgs = ['-c', `${envSetter} unset CLAUDECODE && "${claudeBin}" --resume ${sessionId}`];
  } else {
    shellArgs = [claudeBin, '--resume', sessionId];
  }

  console.log(`[Terminal] Spawning ${shellPath} for ${sessionId}`);
  if (foundBashPath) console.log(`[Terminal] Injecting variable: CLAUDE_CODE_GIT_BASH_PATH=${foundBashPath}`);

  let proc: pty.IPty;
  try {
    proc = pty.spawn(shellPath, shellArgs, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: cwd,
      env: ptyEnv
    });
    console.log(`[Terminal] PTY spawned, PID: ${proc.pid}`);
  } catch (err: any) {
    console.error(`[Terminal] Failed to spawn pty:`, err);
    throw err;
  }

  let firstDataReceived = false;

  proc.onData((data: string) => {
    firstDataReceived = true;
    const t = terminals.get(sessionId);
    if (t?.ws?.readyState === WebSocket.OPEN) {
      t.ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  terminals.set(sessionId, { pty: proc, createdAt: Date.now(), lastActivity: Date.now() });

  proc.onExit(({ exitCode, signal }) => {
    console.log(`[Terminal] Session ${sessionId} exited. Code: ${exitCode}`);
    const t = terminals.get(sessionId);
    if (t?.ws?.readyState === WebSocket.OPEN) {
      if (!firstDataReceived && exitCode !== 0) {
        t.ws.send(JSON.stringify({ 
          type: 'output', 
          data: `\r\n\x1b[31m✕ Failed to resume session.\x1b[0m\r\n` 
        }));
      }
      t.ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      setTimeout(() => { if (t.ws?.readyState === WebSocket.OPEN) t.ws.close(); }, 1000);
    }
    terminals.delete(sessionId);
    const idx = terminalPool.indexOf(sessionId);
    if (idx !== -1) terminalPool.splice(idx, 1);
  });

  return { status: 'started', pooled: false };
}

export function writeToTerminal(sessionId: string, data: string): boolean {
  const term = terminals.get(sessionId);
  if (term) {
    term.pty.write(data);
    return true;
  }
  return false;
}

export function resizeTerminal(sessionId: string, cols: number, rows: number): boolean {
  const term = terminals.get(sessionId);
  if (term && term.pty) {
    try {
      term.pty.resize(cols, rows);
      return true;
    } catch (err) {
      console.error(`[Terminal] Failed to resize:`, err);
    }
  }
  return false;
}

// ========== Pool Management ==========

export function getPoolStatus() {
  return {
    pool: terminalPool,
    active: Array.from(terminals.entries()).map(([id, t]) => ({
      id,
      hasWs: !!t.ws,
      createdAt: t.createdAt,
      lastActivity: t.lastActivity
    }))
  };
}

export function cleanupIdleTerminals(): void {
  const now = Date.now();
  for (const [id, term] of terminals.entries()) {
    if (!term.ws && now - term.createdAt > TERMINAL_IDLE_TIMEOUT) {
      term.pty.kill();
      terminals.delete(id);
      const idx = terminalPool.indexOf(id);
      if (idx !== -1) terminalPool.splice(idx, 1);
    }
  }
}

setInterval(cleanupIdleTerminals, 120000);
