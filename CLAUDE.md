# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClaudePad** is a web-based Claude Code session monitor with xterm.js terminal, idea capture, and CC tips. Designed for mobile accessibility and SSH remote session management.

Core value: Solve Claude Code pain points when used over SSH (terminal lag, small mobile screens, difficulty managing multiple sessions).

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | HTML5 + TailwindCSS + Alpine.js (zero-build, no bundler) |
| Backend | Node.js + TypeScript with WebSocket support |
| Storage | `~/.claude/` directory + local cache |
| Server | Node.js on 0.0.0.0:8080 (LAN accessible) |
| Integration | Claude CLI + node-pty + SSH2 |

## Project Structure

```
ClaudePad/
├── backend/                    # Backend source code
│   ├── index.ts                # Entry point
│   ├── routes/                 # HTTP API routes
│   │   ├── sessions.ts         # Session list/detail
│   │   ├── servers.ts          # SSH server management
│   │   ├── config.ts           # App configuration
│   │   ├── cache.ts            # Cache management
│   │   └── terminals.ts        # Terminal pool status
│   ├── services/               # Business logic
│   │   ├── session-cache.ts    # Session discovery & caching
│   │   ├── terminal-pool.ts    # Local PTY management
│   │   ├── ssh-manager.ts      # SSH connection manager
│   │   └── config.ts           # Settings management
│   ├── websocket/              # WebSocket handlers
│   │   ├── terminal.ts         # Local terminal WS
│   │   └── ssh.ts              # SSH remote terminal WS
│   ├── types/                  # TypeScript definitions
│   └── utils/                  # Utility functions
│
├── frontend/                   # Frontend (zero-build)
│   ├── index.html              # Session monitor
│   ├── terminal.html           # xterm.js terminal
│   ├── idea.html               # Idea capture
│   ├── tips.html               # CC tips browser
│   └── playground.html         # Agent playground
│
├── docs/                       # Documentation
├── tests/                      # Test files
├── asserts/                    # Static assets
└── .cache/                     # Runtime cache
```

## Commands

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start

# Server runs at http://0.0.0.0:8080
```

## Key Features

### Session Management
- Discover sessions from `~/.claude/sessions/`, `~/.claude/session-env/`, `~/.claude/projects/`
- Multi-level caching (memory + file)
- Status detection: running (30min), idle (2h), completed

### SSH Remote Sessions
- Connect to remote servers via SSH
- Password or SSH key authentication
- Remote session discovery and terminal access
- See `docs/SSH-REMOTE-SERVER-DESIGN.md` for details

### WebSocket Protocol

**Local Terminal**: `/ws/terminal/:sessionId`
**SSH Terminal**: `/ws/ssh/:serverId/:sessionId`

```json
// Client → Server
{"type": "input", "data": "command"}
{"type": "resize", "cols": 120, "rows": 30}

// Server → Client
{"type": "output", "data": "terminal output"}
{"type": "connected", "sessionId": "..."}
{"type": "exit", "code": 0}
{"type": "error", "data": "error message"}
```

## API Routes

```
# Sessions
GET  /api/sessions              # List sessions (paginated)
GET  /api/sessions/:id          # Get session detail
POST /api/sessions/:id/terminal # Start local terminal

# SSH Servers
GET    /api/servers                      # List servers
POST   /api/servers                      # Add server
DELETE /api/servers/:id                  # Remove server
POST   /api/servers/:id/test             # Test connection
GET    /api/servers/:id/sessions         # Get remote sessions
POST   /api/servers/:serverId/sessions/:sessionId/terminal  # Start remote terminal

# Config
GET  /api/config                 # Get configuration
POST /api/config                 # Update configuration

# Cache
GET  /api/cache                  # Get cache status
POST /api/cache                  # Clear cache

# Terminal Pool
GET  /api/terminal-pool          # Get terminal pool status
```

## Design Guidelines

### Sheikah Slate Theme
- Dark background with bronze/cyan accents
- Ancient futurism aesthetic
- See frontend HTML for color variables

### Mobile-First Design
- Vertical stacked layout
- Touch targets minimum 44px
- Responsive terminal sizing

## Session Data Structure

```typescript
interface SessionInfo {
  id: string;                  // Session ID
  name: string;                // Display name
  status: 'running' | 'idle' | 'completed';
  startTime: string;           // ISO timestamp
  projectPath: string;         // Working directory
  lastActivity: string;        // ISO timestamp
  duration: number;            // Seconds
  tokenCount: number;          // Total tokens
  remote?: boolean;            // Is remote session
  serverId?: string;           // Remote server ID
  serverName?: string;         // Remote server name
}
```

## Documentation

- `docs/PRD.md` - Original product requirements (historical)
- `docs/SSH-REMOTE-SERVER-DESIGN.md` - SSH feature design
- `docs/UI.md` - UI design specifications

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

**Installation for teammates:**
```bash
git clone https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

### Sprint Workflow (Think → Plan → Build → Review → Test → Ship → Reflect)

gstack is a process, not just tools. Each skill feeds into the next. Use in this order:

**1. Think & Plan:**
- `/office-hours` - **Start here.** YC-style forcing questions that reframe your product. Challenges framing, generates alternatives, writes a design doc that feeds into downstream skills.
- `/plan-ceo-review` - Rethink the problem from CEO/founder perspective. Find the 10-star product hiding in the request.
- `/plan-eng-review` - Lock architecture, data flow, edge cases, test matrix. Forces hidden assumptions into the open.
- `/plan-design-review` - Rates design 0-10, explains what a 10 looks like, edits plan to get there. Catches AI slop.

**2. Build & Review:**
- `/review` - Find bugs that pass CI but blow up in production. Auto-fixes obvious ones, flags completeness gaps.
- `/investigate` - Systematic root-cause debugging. No fixes without investigation.

**3. Test & Ship:**
- `/qa` - Test your app with real browser, find bugs, fix them, re-verify. Auto-generates regression tests.
- `/qa-only` - Same as /qa but report only, no code changes.
- `/ship` - Sync main, run tests, audit coverage, push, open PR.
- `/land-and-deploy` - Merge PR, wait for CI/deploy, verify production health.
- `/canary` - Post-deploy monitoring loop. Watches for errors, regressions.

**4. Reflect:**
- `/retro` - Weekly retrospective with per-person breakdowns, shipping streaks, test health trends.

### Power Tools
- `/browse` - Real Chromium browser for QA testing
- `/careful` - Warns before destructive commands (rm -rf, DROP TABLE)
- `/freeze` - Restrict file edits to one directory
- `/guard` - `/careful` + `/freeze` combined
- `/unfreeze` - Remove the freeze boundary
- `/cso` - Security audit (OWASP Top 10 + STRIDE)
- `/benchmark` - Baseline performance, compare before/after
- `/codex` - Second opinion from OpenAI Codex CLI
- `/autoplan` - One command: CEO → design → eng review automatically
- `/design-consultation` - Build a complete design system from scratch
- `/document-release` - Update docs to match what you shipped
- `/setup-browser-cookies` - Import cookies for authenticated page testing
- `/setup-deploy` - One-time setup for `/land-and-deploy`
- `/gstack-upgrade` - Upgrade gstack to latest

### Example Session
```
You: /office-hours
Claude: [asks forcing questions, challenges your framing, writes design doc]

You: /plan-ceo-review
Claude: [challenges scope, runs 10-section review]

You: /plan-eng-review
Claude: [ASCII diagrams, test matrix, failure modes]

You: [implement the feature]

You: /review
Claude: [finds and auto-fixes bugs]

You: /qa http://localhost:8080
Claude: [opens browser, tests flows, fixes bugs]

You: /ship
Claude: [runs tests, opens PR]
```

### Troubleshooting
- Skill not showing? Run: `cd ~/.claude/skills/gstack && ./setup`
- `/browse` fails? Run: `cd ~/.claude/skills/gstack && bun install && bun run build`