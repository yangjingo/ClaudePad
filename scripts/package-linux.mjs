import { execSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const pkgJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf-8'));
const version = pkgJson.version || '0.0.0';

// 支持通过参数指定架构: node package-linux.mjs arm64
const arch = process.argv[2] || 'x64';
const target = `node18-linux-${arch}`;

const outDir = join(root, 'build');
const pkgCache = join(root, '.cache', 'pkg-cache');
mkdirSync(outDir, { recursive: true });
mkdirSync(pkgCache, { recursive: true });

const exeName = `claudepad-v${version}-linux-${arch}`;
const outPath = join(outDir, exeName);

console.log(`[package] building ${exeName}`);
const env = { ...process.env, PKG_CACHE_PATH: pkgCache };
execSync('npm run build', { stdio: 'inherit', cwd: root, env });

const cmd = [
  'npx',
  'pkg',
  'dist/index.js',
  '--targets',
  target,
  '--output',
  `"${outPath}"`
].join(' ');

execSync(cmd, { stdio: 'inherit', cwd: root, env });
console.log(`[package] done: ${outPath}`);