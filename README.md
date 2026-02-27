# ClaudePad

Claude Code Session Monitor with xterm.js Web Terminal.

## Screenshot

asserts/claudepad-v0227.png

## Update

- V0227, `.asserts/claudepad-v0227.png`

## Features

- **Session List** - View all Claude Code sessions from `~/.claude/`
- **Web Terminal** - Interactive xterm.js terminal for each session
- **Real-time I/O** - WebSocket-based terminal streaming via node-pty

## Quick Start

```bash
npm install
npm run build
npm start
```

Visit http://localhost:8080

## Architecture

```
ClaudePad/
├── server.ts          # Main server (TypeScript)
├── frontend/
│   ├── index.html     # Session list
│   └── terminal.html  # xterm.js terminal
└── package.json
```

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/sessions` | GET | List all sessions |
| `/api/sessions/:id` | GET | Get session details |
| `/api/sessions/:id/terminal` | POST | Start terminal for session |
| `/ws/terminal/:id` | WS | WebSocket for terminal I/O |

## Tech Stack

- **Backend**: Node.js + TypeScript
- **Terminal**: xterm.js (frontend) + node-pty (backend)
- **Real-time**: WebSocket (ws)
- **Storage**: Claude CLI data in `~/.claude/`

## License

MIT
