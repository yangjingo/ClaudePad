/**
 * Terminal Pool Service
 * Manages local PTY terminals for Claude sessions
 */
import * as pty from 'node-pty';
import { WebSocket } from 'ws';
import { join } from 'node:path';
import { TerminalInfo } from '../types/index.js';

const terminals = new Map<string, TerminalInfo>();
const terminalPool: string[] = [];

const TERMINAL_POOL_SIZE = 3;
const TERMINAL_IDLE_TIMEOUT = 300000; // 5 minutes

// ========== Terminal Management ==========

export function hasTerminal(sessionId: string): boolean {
  return terminals.has(sessionId);
}

export function getTerminal(sessionId: string): TerminalInfo | undefined {
  return terminals.get(sessionId);
}

export function setTerminalWs(sessionId: string, ws: WebSocket | undefined): void {
  const term = terminals.get(sessionId);
  if (term) {
    term.ws = ws;
    term.lastActivity = Date.now();
  }
}

export async function startTerminal(sessionId: string): Promise<{ status: string; pooled: boolean }> {
  if (terminals.has(sessionId)) {
    console.log(`[Terminal] Session ${sessionId} already running`);
    return { status: 'running', pooled: true };
  }

  const env: Record<string, string | undefined> = {
    ...process.env,
    TERM: 'xterm-256color',
    CLAUDECODE: undefined
  };

  // Windows: find git-bash
  if (process.platform === 'win32' && !process.env.CLAUDE_CODE_GIT_BASH_PATH) {
    const { homedir } = await import('node:os');
    const fs = await import('node:fs/promises');
    const osHomedir = homedir();

    const possiblePaths = [
      join(osHomedir, 'scoop', 'apps', 'git', 'current', 'bin', 'bash.exe'),
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

  const proc = pty.spawn(
    process.env.SHELL || 'bash',
    ['-c', `unset CLAUDECODE && claude --resume ${sessionId}`],
    { name: 'xterm-256color', cols: 120, rows: 30, cwd: process.cwd(), env }
  );

  proc.onData((data: string) => {
    const t = terminals.get(sessionId);
    if (t?.ws?.readyState === WebSocket.OPEN) {
      t.ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  terminals.set(sessionId, { pty: proc, createdAt: Date.now(), lastActivity: Date.now() });

  proc.onExit(({ exitCode }) => {
    console.log(`[Terminal] Session ${sessionId} exited with code ${exitCode}`);
    const t = terminals.get(sessionId);
    if (t?.ws?.readyState === WebSocket.OPEN) {
      t.ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      t.ws.close();
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
      console.error(`[Terminal] Failed to resize pty for session ${sessionId}:`, err);
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
      console.log(`[Terminal Pool] Cleaning up idle terminal ${id}`);
      term.pty.kill();
      terminals.delete(id);
      const idx = terminalPool.indexOf(id);
      if (idx !== -1) terminalPool.splice(idx, 1);
    }
  }
}

// Start cleanup interval
setInterval(cleanupIdleTerminals, 120000);