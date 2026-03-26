import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkgJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const version = pkgJson.version || '0.0.0';

const outDir = join(root, 'build');
const pkgCache = join(root, '.cache', 'pkg-cache');
mkdirSync(outDir, { recursive: true });
mkdirSync(pkgCache, { recursive: true });

const exeName = `claudepad-v${version}-win-x64.exe`;
const outPath = join(outDir, exeName);

console.log(`[package] building ${exeName}`);
const env = { ...process.env, PKG_CACHE_PATH: pkgCache };
execSync('npm run build', { stdio: 'inherit', cwd: root, env });

const cmd = [
  'npx',
  'pkg',
  'dist/index.js',
  '--targets',
  'node16-win-x64',
  '--output',
  `"${outPath}"`
].join(' ');

execSync(cmd, { stdio: 'inherit', cwd: root, env });
console.log(`[package] done: ${outPath}`);
