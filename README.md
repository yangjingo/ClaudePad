# ClaudePad

Claude Code Session Monitor with xterm.js Web Terminal, Idea Capture and CC Tips.

## Update

- **v0.3.26** - Redesigned symmetric sector-based layout with environment-aware config editing and independent version tracking for local/remote environments. Added custom Sheikah scrollbars and guided empty states.

See [CHANGELOG.md](./CHANGELOG.md) for detailed release notes.

## Features

- **Session List** - View all Claude Code sessions from `~/.claude/`
- **Web Terminal** - Interactive xterm.js terminal for each session
- **Real-time I/O** - WebSocket-based terminal streaming via node-pty
- **CC Ideas** - Capture and manage spontaneous inspiration with status tracking
- **CC Tips** - Browse Claude Code tips with random display, search, and copy functionality
- **Agent Playground** - Zelda-themed Agent activity dashboard with Link as Commander and four Champions (Mipha, Revali, Urbosa, Daruk) for real-time monitoring

## Quick Start

```bash
# Install dependencies
npm install

# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

Visit http://localhost:8080

## Navigation

- **Sessions** (`/`) - View and manage Claude Code sessions
- **Ideas** (`/idea.html`) - Capture and track inspiration
- **Tips** (`/tips.html`) - Browse CC Tips
- **Playground** (`/playground.html`) - Agent activity dashboard with Zelda theme

## License

MIT
