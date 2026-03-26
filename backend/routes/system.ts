/**
 * System Routes
 * GET  /api/system/version - Get version (local or remote)
 * POST /api/system/update  - Execute update
 */
import { IncomingMessage, ServerResponse } from 'node:http';
import { json } from '../utils/response.js';
import { execSync } from 'node:child_process';

// Helper to find the binary
function getClaudeBin(): string {
  try {
    const findCmd = process.platform === 'win32' ? 'where.exe claude' : 'which claude';
    const output = execSync(findCmd, { encoding: 'utf-8' }).trim();
    const paths = output.split(/\r?\n/).filter(p => p.trim());
    if (paths.length > 0) {
      if (process.platform === 'win32') {
        return paths.find(p => p.toLowerCase().endsWith('.cmd')) || paths[0];
      }
      return paths[0];
    }
  } catch (e) {}
  return 'claude';
}

export async function handleSystemRoutes(
  url: string,
  method: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const claudeBin = getClaudeBin();
  
  // Use URL parser to handle query params
  const fullUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
  const serverId = fullUrl.searchParams.get('serverId');

  // GET /api/system/version
  if (fullUrl.pathname === '/api/system/version' && method === 'GET') {
    try {
      let current = 'unknown';
      let latest = 'unknown';

      if (serverId && serverId !== 'local') {
        // 🌐 REMOTE MODE: Get version via SSH
        try {
          const { execCommand } = await import('../services/ssh-manager.js');
          const { stdout, stderr } = await execCommand(serverId, 'sh -lc "claude --version 2>&1 || claude -v 2>&1"');
          const combined = `${stdout || ''}\n${stderr || ''}`.trim();
          const match = combined.match(/(\d+\.\d+\.\d+)/);
          current = match ? match[1] : (combined || 'unknown');
        } catch (e: any) {
          console.error(`[System] Remote version check failed for ${serverId}:`, e.message);
        }
      } else {
        // 🏠 LOCAL MODE
        try {
          const output = execSync(`"${claudeBin}" --version`, { encoding: 'utf-8' });
          const match = output.match(/(\d+\.\d+\.\d+)/);
          current = match ? match[1] : output.trim();
        } catch (e) {}
      }

      // Always get latest from NPM for comparison
      try {
        latest = execSync('npm view @anthropic-ai/claude-code version', { encoding: 'utf-8' }).trim();
      } catch (e) {}

      const cleanCurrent = (current || '').trim() || 'unknown';
      const cleanLatest = latest.trim();

      json(res, { 
        current: cleanCurrent, 
        latest: cleanLatest, 
        needsUpdate: cleanCurrent !== 'unknown' && cleanLatest !== 'unknown' && cleanCurrent !== cleanLatest,
        isRemote: !!serverId && serverId !== 'local',
        serverId
      });
    } catch (error: any) {
      json(res, { error: error.message }, 500);
    }
    return true;
  }

  // POST /api/system/update
  if (fullUrl.pathname === '/api/system/update' && method === 'POST') {
    try {
      const { parseBody } = await import('../utils/response.js');
      const body = await parseBody<any>(req);
      const updateMethod = body.method || 'npm';
      
      console.log(`[System] Starting Claude Code update via ${updateMethod}...`);
      
      let command = '';
      if (updateMethod === 'npm') {
        command = 'npm install -g @anthropic-ai/claude-code@latest --registry=https://registry.npmmirror.com';
      } else {
        command = `"${claudeBin}" update`;
      }

      const output = execSync(command, { encoding: 'utf-8' });
      json(res, { status: 'success', output });
    } catch (error: any) {
      json(res, { error: error.message }, 500);
    }
    return true;
  }

  return false;
}
