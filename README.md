# ClaudePad

Claude Code Session Monitor with xterm.js Web Terminal, Idea Capture and CC Tips.

## Update

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

## Quick Start

```bash
npm install
npm run build
npm start
```

Visit http://localhost:8080

## Navigation

- **Sessions** (`/`) - View and manage Claude Code sessions
- **Ideas** (`/idea.html`) - Capture and track inspiration
- **Tips** (`/tips.html`) - Browse CC Tips

## License

MIT
