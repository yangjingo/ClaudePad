/**
 * Config Service
 * Manages Claude settings and application configuration
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir, userInfo, networkInterfaces } from 'node:os';
import { AppConfig, ConfigUpdate } from '../types/index.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const PORT = parseInt(process.env.PORT || '8080');

export async function getConfig(): Promise<AppConfig> {
  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  let settings: any = {};
  try {
    const content = await readFile(settingsPath, 'utf-8');
    settings = JSON.parse(content);
  } catch (e: any) {
    console.error('Settings parse error:', e.message);
  }

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
    apiKey: settings.env?.ANTHROPIC_AUTH_TOKEN
      ? settings.env.ANTHROPIC_AUTH_TOKEN.slice(0, 8) + '...' + settings.env.ANTHROPIC_AUTH_TOKEN.slice(-4)
      : 'not set',
    ip,
    user: userInfo().username || process.env.USER || 'unknown',
    port: PORT
  };
}

export async function saveConfig(newConfig: ConfigUpdate): Promise<AppConfig> {
  const settingsPath = join(CLAUDE_DIR, 'settings.json');
  let settings: any = {};
  try {
    const content = await readFile(settingsPath, 'utf-8');
    settings = JSON.parse(content);
  } catch (e: any) {
    console.error('Settings parse error:', e.message);
  }

  if (newConfig.model) settings.model = newConfig.model;
  if (!settings.env) settings.env = {};
  if (newConfig.apiUrl) settings.env.ANTHROPIC_BASE_URL = newConfig.apiUrl;
  if (newConfig.apiKey && newConfig.apiKey !== 'not set' && !newConfig.apiKey.includes('...')) {
    settings.env.ANTHROPIC_AUTH_TOKEN = newConfig.apiKey;
  }

  await writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  return getConfig();
}