/**
 * ClaudePad - Type Definitions
 */

import { WebSocket } from 'ws';
import * as pty from 'node-pty';

// ========== Session Types ==========
export interface SessionInfo {
  id: string;
  name: string;
  status: 'running' | 'idle' | 'completed';
  startTime: string;
  projectPath: string;
  lastActivity: string;
  duration: number;
  tokenCount: number;
  remote?: boolean;
  serverId?: string;
  serverName?: string;
}

export interface CachedData {
  sessions: SessionInfo[];
  timestamp: number;
  expiresAt: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
}

// ========== Terminal Types ==========
export interface TerminalInfo {
  pty: pty.IPty;
  ws?: WebSocket;
  createdAt: number;
  lastActivity?: number;
}

// ========== SSH Types ==========
export interface SSHServerConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  name: string;
}

export interface SSHServer {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  connected: boolean;
}

export interface PTYSession {
  conn: any; // ssh2 Client
  stream: any; // ssh2 stream
  serverId: string;
  sessionId: string;
  emitter: NodeJS.EventEmitter;
}

// ========== Config Types ==========
export interface AppConfig {
  claudePath: string;
  model: string;
  apiUrl: string;
  apiKey: string;
  ip: string;
  user: string;
  port: number;
}

export interface ConfigUpdate {
  model?: string;
  apiUrl?: string;
  apiKey?: string;
}