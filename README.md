# ClaudePad

Claude Code Session Monitor with xterm.js Web Terminal, Idea Capture and CC Tips.

## Update

- **v0.3.0** - Major backend refactoring with modular architecture. Split monolithic server into organized layers: routes, services, websocket handlers. Added TypeScript types, SSH key auth support. New project structure with `backend/` and `frontend/` directories.

- **v0.3.08.2** - Redesigned Agent Playground with software development team theme. Link (PM) coordinates with Revali (Analyst), Mipha (Frontend), Urbosa (Backend), and Daruk (QA). Added Westworld-style character wandering, dialogue system, and Hyrule landscape elements (mountains, hills, trees) to the Canvas map.

- **v0.3.08** - Added Agent Playground with Zelda-themed activity monitoring. Features Link as Commander with Mipha (Healer), Revali (Scout), Urbosa (Assault), and Daruk (Defense) as sub-agents. Real-time status tracking, activity logs, and command center interface with Sheikah Slate theme.

- **v0.2.31** - Optimized session loading with multi-level caching (memory + file cache), pagination support, and enhanced terminal experience. Fixed token counting and improved error handling. Refactored terminal UI for better session information display.

- **v0.2.30** - Added CC Tips page for browsing Claude Code tips. Random tip display with "Next Tip" button, full-text search, and copy to clipboard. Pure HTML frontend with Sheikah Slate theme.

- **v0.2.29** - Updated navigation bar with unified style. Sessions, Ideas, and Tips links with consistent styling.

- **v0.2.28** - Added CC Ideas for capturing spontaneous inspiration. Pure HTML frontend with Sheikah Slate theme. Session monitoring with real-time status, token count, and duration display. Zero framework dependencies.

- **v0.2.27** - Updated theme to Sheikah Slate, loads session information directly from `~/.claude/` directory.

- **v0.2.26** - Implemented basic features with unified color scheme.



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
