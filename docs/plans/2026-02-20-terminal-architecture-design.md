# Terminal Component Architecture Design

**Date:** 2026-02-20
**Status:** Design Phase

## Overview

Web-based terminal emulator component for ClaudePad that enables remote control of Claude Code CLI through the browser.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser (Frontend)                      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Kanban     │  │   Terminal   │  │  Status Panel    │  │
│  │   Board      │  │   (xterm.js) │  │  (New)           │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │ WebSocket
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Backend                           │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Task API    │  │  Terminal    │  │  Process         │  │
│  │  (Existing)  │  │  WebSocket   │  │  Manager         │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│                            │                                  │
│                            ▼                                  │
│                    ┌──────────────┐                          │
│                    │  Claude CLI  │                          │
│                    │  Subprocess  │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## WebSocket Protocol

### Client → Server (User Input)

| Message Type | Payload | Description |
|--------------|---------|-------------|
| `input` | `{data: string}` | Send command input to terminal |
| `resize` | `{rows: int, cols: int}` | Terminal resize event |
| `history` | `{action: "get|add|clear"}` | Command history operations |
| `autocomplete` | `{prefix: string}` | Request command suggestions |

**Examples:**
```json
{"type": "input", "data": "help me with this task\n"}
{"type": "resize", "rows": 24, "cols": 80}
{"type": "history", "action": "get"}
{"type": "autocomplete", "prefix": "git"}
```

### Server → Client (Terminal Output)

| Message Type | Payload | Description |
|--------------|---------|-------------|
| `output` | `{data: string}` | Terminal output to display |
| `status` | `{state: "idle|running|error"}` | Claude CLI status update |
| `history` | `{commands: string[]}` | Command history response |
| `autocomplete` | `{suggestions: string[]}` | Auto-complete suggestions |

**Examples:**
```json
{"type": "output", "data": "Processing your request..."}
{"type": "status", "state": "running"}
{"type": "history", "commands": ["git status", "ls -la"]}
{"type": "autocomplete", "suggestions": ["git status", "git push", "git pull"]}
```

## Terminal Session Flow

```
1. Browser connects to WS://host/ws/terminal
2. Server spawns Claude CLI subprocess with PTY
3. I/O streams bidirectional via WebSocket
4. Process kept alive for session duration
5. On disconnect - optional cleanup or keep running
```

## Features

### Enhanced Terminal Features
- **Command History**: Navigate previous commands with up/down arrows
- **Auto-complete**: Tab completion for Claude commands
- **Syntax Highlighting**: Colorized terminal output
- **Status Indicators**: Show Claude CLI state (idle/running/error)

### Components
- **xterm.js**: Terminal emulator in browser
- **WebSocket**: Bidirectional communication for terminal I/O
- **Process Manager**: Spawn and manage Claude CLI subprocess
- **Command Storage**: Persistent command history

## Data Storage

### Command History
```json
// data/terminal_history.json
{
  "session_id": "uuid",
  "commands": [
    "git status",
    "claude task list",
    "help me with this task"
  ],
  "timestamp": "2026-02-20T10:30:00Z"
}
```

## API Endpoints

```
WS /ws/terminal          # Terminal WebSocket connection
GET  /api/terminal/history  # Get command history
POST /api/terminal/execute  # Execute command (alternative to WS)
GET  /api/terminal/status   # Get Claude CLI status
```

## Dependencies

### Frontend
- `xterm.js` - Terminal emulator
- `xterm-addon-fit` - Terminal size fitting
- `xterm-addon-web-links` - Clickable links

### Backend
- `ptyprocess` or `pyte` - Pseudo-terminal handling
- `asyncio` - Async process management

## Integration Points

### Existing ClaudePad Components
- Uses existing WebSocket infrastructure
- Shares session/auth with main app
- Terminal accessible via new tab in UI
- Status panel shows Claude CLI state alongside tasks
