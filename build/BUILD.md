# Build Artifacts

This folder is reserved for single-file binaries produced by `pkg`.

## Windows (x64)

```powershell
cd C:\Users\yangjing\Project\ClaudePad
$env:NPM_CONFIG_CACHE="$PWD\.cache\npm-cache"
$env:PKG_CACHE_PATH="$PWD\.cache\pkg-cache"
npm install -D pkg --no-fund --no-audit
npm run package:win
```

Expected output:

```
build\claudepad-v<version>-win-x64.exe
```

## Linux (x64)

Run on a Linux x64 machine.

```bash
cd /path/to/ClaudePad
export NPM_CONFIG_CACHE="$PWD/.cache/npm-cache"
export PKG_CACHE_PATH="$PWD/.cache/pkg-cache"
npm install -D pkg --no-fund --no-audit
npm run build
npx pkg dist/index.js --targets node18-linux-x64 --output build/claudepad-v<version>-linux-x64
```

## Linux (ARM64)

Run on a Linux ARM64 machine.

```bash
cd /path/to/ClaudePad
export NPM_CONFIG_CACHE="$PWD/.cache/npm-cache"
export PKG_CACHE_PATH="$PWD/.cache/pkg-cache"
npm install -D pkg --no-fund --no-audit
npm run build
npx pkg dist/index.js --targets node18-linux-arm64 --output build/claudepad-v<version>-linux-arm64
```

## Notes

- `pkg` is not reliable for cross-compiling native modules. Build on the target platform.
- If you hit `EPERM` on Windows, run the build in an elevated PowerShell and allow `build/` and `.cache/` in your AV/Defender.
