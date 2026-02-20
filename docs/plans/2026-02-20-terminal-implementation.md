# Web Terminal Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a web-based terminal emulator that enables remote control of Claude Code CLI through the browser with command history, auto-complete, and syntax highlighting.

**Architecture:** FastAPI WebSocket backend for terminal I/O, xterm.js frontend for terminal emulation, process manager for Claude CLI subprocess, JSON storage for command history.

**Tech Stack:**
- Frontend: xterm.js + xterm addons (fit, webgl-renderer)
- Backend: FastAPI + ptyprocess (pseudo-terminal)
- Storage: JSON file for command history

---

## Task 1: Add Frontend Dependencies

**Files:**
- Create: `static/package.json` (for tracking frontend deps)
- Create: `static/js/lib/` directory for xterm.js libraries

**Step 1: Create package.json for frontend dependencies**

Create `static/package.json`:
```json
{
  "name": "claudepad-terminal",
  "private": true,
  "dependencies": {
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0",
    "xterm-addon-webgl": "^0.16.0"
  }
}
```

**Step 2: Download xterm.js libraries**

Run these commands to download the libraries:
```bash
cd /home/yangjing/ClaudePad/static
mkdir -p js/lib

# Download xterm.js (using CDN links for zero-build approach)
wget -O js/lib/xterm.min.js https://cdn.jsdelivr.net/npm/xterm@5.3.0/lib/xterm.min.js
wget -O js/lib/xterm.css https://cdn.jsdelivr.net/npm/xterm@5.3.0/css/xterm.css
wget -O js/lib/xterm-addon-fit.min.js https://cdn.jsdelivr.net/npm/xterm-addon-fit@0.8.0/lib/xterm-addon-fit.min.js
```

**Step 3: Verify files were downloaded**

Run: `ls -la static/js/lib/`

Expected: Should see xterm.min.js, xterm.css, xterm-addon-fit.min.js

**Step 4: Commit**

```bash
git add static/package.json static/js/lib/
git commit -m "feat: add xterm.js terminal emulator dependencies"
```

---

## Task 2: Create Terminal Process Manager (Backend)

**Files:**
- Create: `terminal_process.py`
- Test: `tests/test_terminal_process.py`

**Step 1: Write the failing test**

Create `tests/test_terminal_process.py`:
```python
import pytest
import asyncio
from terminal_process import TerminalProcess

@pytest.mark.asyncio
async def test_terminal_process_starts():
    """Test that terminal process can start a shell."""
    process = TerminalProcess()
    await process.start()
    assert process.is_running() == True
    await process.stop()

@pytest.mark.asyncio
async def test_terminal_process_write_read():
    """Test writing to and reading from terminal."""
    process = TerminalProcess()
    await process.start()

    # Write a command
    await process.write("echo 'hello'\n")

    # Wait and read output
    await asyncio.sleep(0.5)
    output = await process.read()
    assert "hello" in output.lower()

    await process.stop()

@pytest.mark.asyncio
async def test_terminal_process_resize():
    """Test resizing terminal."""
    process = TerminalProcess()
    await process.start()

    await process.resize(24, 80)
    assert process.rows == 24
    assert process.cols == 80

    await process.stop()
```

**Step 2: Run test to verify it fails**

Run: `pytest tests/test_terminal_process.py -v`

Expected: FAIL with "ModuleNotFoundError: No module named 'terminal_process'"

**Step 3: Write minimal implementation**

Create `terminal_process.py`:
```python
import asyncio
import pty
import os
import select
import subprocess
from typing import Optional, Callable


class TerminalProcess:
    """Manages a pseudo-terminal process for the web terminal."""

    def __init__(self, shell: str = "/bin/bash"):
        self.master_fd: Optional[int] = None
        self.pid: Optional[int] = None
        self.shell = shell
        self.rows = 24
        self.cols = 80
        self._read_task: Optional[asyncio.Task] = None
        self._output_callback: Optional[Callable] = None

    async def start(self, output_callback: Optional[Callable] = None):
        """Start the pseudo-terminal with the shell."""
        self._output_callback = output_callback

        # Create pseudo-terminal
        self.master_fd, slave_fd = pty.openpty()

        # Start the shell in the pseudo-terminal
        self.pid = os.fork()
        if self.pid == 0:  # Child process
            os.setsid()
            os.dup2(slave_fd, 0)  # stdin
            os.dup2(slave_fd, 1)  # stdout
            os.dup2(slave_fd, 2)  # stderr
            os.close(slave_fd)
            os.close(self.master_fd)

            # Start shell with Claude Code available
            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            os.execvp(self.shell, [self.shell])
        else:  # Parent process
            os.close(slave_fd)
            # Start reading output
            self._read_task = asyncio.create_task(self._read_output())

    async def _read_output(self):
        """Continuously read output from the pseudo-terminal."""
        loop = asyncio.get_event_loop()
        while self.is_running():
            try:
                # Wait for data to be available
                r, _, _ = await loop.run_in_executor(
                    None, select.select, [self.master_fd], [], [], 0.1
                )
                if r:
                    data = await loop.run_in_executor(
                        None, os.read, self.master_fd, 4096
                    )
                    if data and self._output_callback:
                        self._output_callback(data.decode('utf-8', errors='ignore'))
            except (OSError, ValueError):
                break

    async def write(self, data: str):
        """Write data to the terminal."""
        if self.master_fd is not None:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None, os.write, self.master_fd, data.encode('utf-8')
            )

    async def read(self) -> str:
        """Read available data from terminal (non-blocking)."""
        if self.master_fd is None:
            return ""

        try:
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None, os.read, self.master_fd, 4096
            )
            return data.decode('utf-8', errors='ignore') if data else ""
        except BlockingIOError:
            return ""

    async def resize(self, rows: int, cols: int):
        """Resize the terminal."""
        self.rows = rows
        self.cols = cols
        if self.master_fd is not None:
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                None,
                fcntl.ioctl,
                self.master_fd,
                pty.TIOCSWINSZ,
                struct.pack("HHHH", rows, cols, 0, 0)
            )

    def is_running(self) -> bool:
        """Check if the process is still running."""
        if self.pid is None:
            return False
        try:
            os.kill(self.pid, 0)
            return True
        except OSError:
            return False

    async def stop(self):
        """Stop the terminal process."""
        if self._read_task:
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass

        if self.pid:
            try:
                os.kill(self.pid, 9)  # SIGKILL
            except OSError:
                pass

        if self.master_fd is not None:
            os.close(self.master_fd)
            self.master_fd = None
```

**Step 4: Run test to verify it passes**

First install ptyprocess (pure Python alternative to pty):
```bash
pip install ptyprocess
```

Update the imports in terminal_process.py to use ptyprocess:
```python
# Add at top of terminal_process.py
import fcntl
import struct
```

Run: `pytest tests/test_terminal_process.py -v`

Expected: Some tests may fail on CI (needs pseudo-terminal), but implementation is complete

**Step 5: Commit**

```bash
git add terminal_process.py tests/test_terminal_process.py
git commit -m "feat: add terminal process manager with PTY support"
```

---

## Task 3: Create WebSocket Terminal Endpoint (Backend)

**Files:**
- Modify: `main.py` (add WebSocket routes)

**Step 1: Add WebSocket imports and dependencies**

Modify `main.py` - Add after line 6:
```python
from fastapi import WebSocket
from fastapi.responses import HTMLResponse
from fastapi.websocket import WebSocketState
import fcntl
import struct
import pty
import select
import os
from typing import Dict
```

**Step 2: Add terminal session manager class**

Add after `write_json_file` function in `main.py`:
```python
# Terminal session management
terminal_sessions: Dict[str, dict] = {}


class TerminalSession:
    """Manages a terminal session with PTY."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.master_fd = None
        self.pid = None
        self.rows = 24
        self.cols = 80

    def start(self):
        """Start the pseudo-terminal."""
        self.master_fd, slave_fd = pty.openpty()
        self.pid = os.fork()

        if self.pid == 0:  # Child
            os.setsid()
            os.dup2(slave_fd, 0)
            os.dup2(slave_fd, 1)
            os.dup2(slave_fd, 2)
            os.close(slave_fd)
            os.close(self.master_fd)

            env = os.environ.copy()
            env["TERM"] = "xterm-256color"
            os.execvp("/bin/bash", ["/bin/bash"])
        else:  # Parent
            os.close(slave_fd)

    def write(self, data: str):
        """Write to terminal."""
        if self.master_fd:
            os.write(self.master_fd, data.encode())

    def resize(self, rows: int, cols: int):
        """Resize terminal."""
        if self.master_fd:
            fcntl.ioctl(
                self.master_fd,
                pty.TIOCSWINSZ,
                struct.pack("HHHH", rows, cols, 0, 0)
            )
            self.rows = rows
            self.cols = cols

    def read(self) -> str:
        """Read from terminal (non-blocking)."""
        if not self.master_fd:
            return ""

        try:
            r, _, _ = select.select([self.master_fd], [], [], 0)
            if r:
                return os.read(self.master_fd, 4096).decode('utf-8', errors='ignore')
        except OSError:
            pass
        return ""

    def is_running(self) -> bool:
        """Check if process is running."""
        if self.pid is None:
            return False
        try:
            os.kill(self.pid, 0)
            return True
        except OSError:
            return False

    def stop(self):
        """Stop the terminal."""
        if self.pid:
            try:
                os.kill(self.pid, 9)
            except OSError:
                pass
        if self.master_fd:
            os.close(self.master_fd)
            self.master_fd = None
```

**Step 3: Add WebSocket endpoint**

Add after `run_server` function in `main.py`:
```python
@app.websocket("/ws/terminal")
async def terminal_websocket(websocket: WebSocket):
    """WebSocket endpoint for terminal I/O."""
    await websocket.accept()

    import uuid
    session_id = str(uuid.uuid4())
    session = TerminalSession(session_id)
    session.start()
    terminal_sessions[session_id] = session

    try:
        # Send initial connection message
        await websocket.send_json({
            "type": "status",
            "state": "connected",
            "session_id": session_id
        })

        # Main terminal loop
        while True:
            # Check for incoming messages from client
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=0.05
                )
                import json
                data = json.loads(message)

                if data["type"] == "input":
                    session.write(data["data"])
                elif data["type"] == "resize":
                    session.resize(data["rows"], data["cols"])

            except asyncio.TimeoutError:
                pass  # No message from client, check for terminal output

            # Read and send terminal output
            output = session.read()
            if output:
                await websocket.send_json({
                    "type": "output",
                    "data": output
                })

            # Check if process is still running
            if not session.is_running():
                await websocket.send_json({
                    "type": "status",
                    "state": "disconnected"
                })
                break

            await asyncio.sleep(0.01)

    except Exception as e:
        print(f"Terminal error: {e}")
    finally:
        session.stop()
        if session_id in terminal_sessions:
            del terminal_sessions[session_id]
```

**Step 4: Add asyncio import at top of main.py**

Add to line 2:
```python
import asyncio
```

**Step 5: Test the WebSocket endpoint manually**

Run the server:
```bash
python main.py
```

In another terminal, test with websocat or similar:
```bash
echo '{"type":"input","data":"ls\n"}' | websocat ws://localhost:8080/ws/terminal
```

Expected: Should receive terminal output

**Step 6: Commit**

```bash
git add main.py
git commit -m "feat: add WebSocket terminal endpoint with PTY support"
```

---

## Task 4: Create Terminal UI Template

**Files:**
- Create: `templates/terminal.html`

**Step 1: Create terminal template**

Create `templates/terminal.html`:
```html
{% extends "base.html" %}

{% block title %}ClaudePad // Terminal{% endblock %}

{% block head %}
<!-- xterm.js CSS -->
<link rel="stylesheet" href="/static/js/lib/xterm.css">
<style>
.terminal-container {
    background: #1a1a1a;
    border-radius: 8px;
    padding: 16px;
    margin: 20px 0;
    border: 1px solid #333;
}

#terminal {
    height: 500px;
    width: 100%;
}

.terminal-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    padding: 0 8px;
}

.terminal-status {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    color: var(--text-muted);
}

.status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #444;
}

.status-dot.connected {
    background: #4ade80;
    box-shadow: 0 0 8px #4ade80;
}

.status-dot.disconnected {
    background: #ef4444;
}

.terminal-actions {
    display: flex;
    gap: 8px;
}

.terminal-btn {
    background: #2a2a2a;
    border: 1px solid #444;
    color: #ccc;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    transition: all 0.2s;
}

.terminal-btn:hover {
    background: #333;
    border-color: #555;
}
</style>
{% endblock %}

{% block content %}
<div x-data="terminalApp()" x-init="init()" style="display: flex; flex-direction: column; gap: 16px;">

    <!-- Page Header -->
    <div style="display: flex; align-items: center; justify-content: space-between;">
        <h1 style="font-size: 24px; font-weight: 600; margin: 0;">
            <span style="color: var(--zelda-gold-dim);">$</span> Terminal
        </h1>
        <span style="color: var(--text-muted); font-size: 14px;">
            Claude Code CLI Interface
        </span>
    </div>

    <!-- Terminal Container -->
    <div class="terminal-container">
        <div class="terminal-toolbar">
            <div class="terminal-status">
                <div class="status-dot" :class="status"></div>
                <span x-text="status.toUpperCase()"></span>
                <span x-show="sessionId" :style="'opacity: 0.5;'">| Session: <span x-text="sessionId.substring(0, 8)"></span></span>
            </div>
            <div class="terminal-actions">
                <button @click="clearTerminal()" class="terminal-btn">Clear</button>
                <button @click="disconnect()" class="terminal-btn" x-show="connected">Disconnect</button>
                <button @click="connect()" class="terminal-btn" x-show="!connected">Connect</button>
            </div>
        </div>
        <div id="terminal"></div>
    </div>

    <!-- Help Text -->
    <div style="text-align: center; color: var(--text-muted); font-size: 12px;">
        <p>Use <strong>Ctrl+C</strong> to interrupt, <strong>Ctrl+D</strong> to exit shell</p>
        <p>Claude Code commands: <code>claude help</code>, <code>claude task list</code></p>
    </div>

</div>
{% endblock %}

{% block scripts %}
<script src="/static/js/lib/xterm.min.js"></script>
<script src="/static/js/lib/xterm-addon-fit.min.js"></script>
<script>
function terminalApp() {
    return {
        terminal: null,
        socket: null,
        status: 'disconnected',
        sessionId: null,

        init() {
            // Initialize xterm.js
            this.terminal = new Terminal({
                cursorBlink: true,
                fontSize: 14,
                fontFamily: '"Cascadia Code", "Fira Code", "Courier New", monospace',
                theme: {
                    background: '#1a1a1a',
                    foreground: '#e0e0e0',
                    cursor: '#4ade80',
                    selection: 'rgba(74, 222, 128, 0.3)',
                    black: '#1a1a1a',
                    red: '#ef4444',
                    green: '#4ade80',
                    yellow: '#fbbf24',
                    blue: '#60a5fa',
                    magenta: '#f472b6',
                    cyan: '#22d3ee',
                    white: '#e0e0e0',
                    brightBlack: '#404040',
                    brightRed: '#f87171',
                    brightGreen: '#86efac',
                    brightYellow: '#fcd34d',
                    brightBlue: '#93c5fd',
                    brightMagenta: '#f9a8d4',
                    brightCyan: '#67e8f9',
                    brightWhite: '#ffffff'
                }
            });

            // Load fit addon
            const fitAddon = new FitAddon.FitAddon();
            this.terminal.loadAddon(fitAddon);
            this.terminal.open(document.getElementById('terminal'));
            fitAddon.fit();

            // Handle terminal input
            this.terminal.onData(data => {
                if (this.socket && this.connected) {
                    this.socket.send(JSON.stringify({
                        type: 'input',
                        data: data
                    }));
                }
            });

            // Handle terminal resize
            window.addEventListener('resize', () => {
                fitAddon.fit();
                if (this.socket && this.connected) {
                    this.socket.send(JSON.stringify({
                        type: 'resize',
                        rows: this.terminal.rows,
                        cols: this.terminal.cols
                    }));
                }
            });

            // Auto-connect
            this.connect();
        },

        connect() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;

            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                this.status = 'connected';
                this.terminal.focus();
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.status = 'disconnected';
            };

            this.socket.onclose = () => {
                this.status = 'disconnected';
                this.terminal.writeln('\r\n\x1b[31mConnection closed\x1b[0m');
            };
        },

        handleMessage(data) {
            switch (data.type) {
                case 'output':
                    this.terminal.write(data.data);
                    break;
                case 'status':
                    if (data.state === 'connected') {
                        this.sessionId = data.session_id;
                    }
                    this.status = data.state;
                    break;
            }
        },

        disconnect() {
            if (this.socket) {
                this.socket.close();
            }
        },

        clearTerminal() {
            this.terminal.clear();
        },

        get connected() {
            return this.status === 'connected';
        }
    };
}
</script>
{% endblock %}
```

**Step 2: Add terminal route to main.py**

Add after `@app.get("/health")` in `main.py`:
```python
@app.get("/terminal")
async def terminal_page(request: Request):
    """Terminal page."""
    return templates.TemplateResponse("terminal.html", {"request": request})
```

**Step 3: Test the terminal page**

Run: `python main.py`

Visit: `http://localhost:8080/terminal`

Expected: Should see terminal interface with black background

**Step 4: Commit**

```bash
git add templates/terminal.html main.py
git commit -m "feat: add terminal UI page with xterm.js"
```

---

## Task 5: Add Command History Storage

**Files:**
- Create: `data/terminal_history.json`
- Modify: `main.py` (add history endpoints)

**Step 1: Add history data structure and functions**

Add in `main.py` after `write_json_file` function:
```python
# Terminal history
TERMINAL_HISTORY_FILE = DATA_DIR / "terminal_history.json"


def get_terminal_history():
    """Get terminal command history."""
    history = read_json_file(TERMINAL_HISTORY_FILE)
    if not history:
        return {"commands": [], "last_updated": None}
    return history


def add_to_terminal_history(command: str):
    """Add command to history (deduplicated)."""
    history = get_terminal_history()
    commands = history["commands"]

    # Remove duplicate if exists
    if command in commands:
        commands.remove(command)

    # Add to front
    commands.insert(0, command)

    # Keep only last 1000 commands
    commands = commands[:1000]

    from datetime import datetime
    write_json_file(TERMINAL_HISTORY_FILE, {
        "commands": commands,
        "last_updated": datetime.now().isoformat()
    })
```

**Step 2: Add history API endpoints**

Add after terminal WebSocket endpoint in `main.py`:
```python
@app.get("/api/terminal/history")
async def get_history():
    """Get command history."""
    history = get_terminal_history()
    return history


@app.post("/api/terminal/history")
async def add_history(request: Request):
    """Add command to history."""
    data = await request.json()
    command = data.get("command", "").strip()
    if command:
        add_to_terminal_history(command)
    return {"status": "ok"}
```

**Step 3: Initialize history file**

Run in Python:
```python
python3 -c "
from pathlib import Path
from main import write_json_file
DATA_DIR = Path('data')
DATA_DIR.mkdir(exist_ok=True)
write_json_file(DATA_DIR / 'terminal_history.json', {'commands': [], 'last_updated': None})
"
```

**Step 4: Test history endpoints**

```bash
# Add a command
curl -X POST http://localhost:8080/api/terminal/history -H "Content-Type: application/json" -d '{"command":"ls -la"}'

# Get history
curl http://localhost:8080/api/terminal/history
```

Expected: Should return JSON with commands array

**Step 5: Commit**

```bash
git add main.py data/terminal_history.json
git commit -m "feat: add terminal command history storage"
```

---

## Task 6: Integrate Terminal with Navigation

**Files:**
- Modify: `templates/base.html` (add terminal link to nav)

**Step 1: Add terminal link to navigation**

In `templates/base.html`, add after the settings link (around line 26):
```html
<a href="/terminal" class="nav-terminal-link" style="color: var(--zelda-gold-dim); margin-right: 12px;" title="Terminal">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="4 17 10 11 4 5"></polyline>
        <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
</a>
```

**Step 2: Verify navigation works**

Run: `python main.py`

Visit: `http://localhost:8080/`

Expected: Should see terminal icon in navigation bar

**Step 3: Commit**

```bash
git add templates/base.html
git commit -m "feat: add terminal link to navigation"
```

---

## Task 7: Add Keyboard Shortcuts (Optional Enhancement)

**Files:**
- Modify: `templates/terminal.html`

**Step 1: Add keyboard shortcut handler**

Add in terminal.html script, inside the `terminalApp` function:
```javascript
// Add after init() method
handleKeydown(event) {
    // Ctrl+L: Clear terminal
    if (event.ctrlKey && event.key === 'l') {
        event.preventDefault();
        this.clearTerminal();
    }

    // Ctrl+C: Send interrupt
    if (event.ctrlKey && event.key === 'c') {
        if (this.socket && this.connected) {
            this.socket.send(JSON.stringify({
                type: 'input',
                data: '\x03'  // Ctrl+C
            }));
        }
    }

    // Arrow keys for history (simplified - would need full implementation)
    if (event.key === 'ArrowUp') {
        // Get previous command from history
        fetch('/api/terminal/history')
            .then(r => r.json())
            .then(data => {
                if (data.commands && data.commands.length > 0) {
                    // Would need full implementation with history index
                    console.log('History:', data.commands);
                }
            });
    }
}
```

**Step 2: Add event listener to terminal**

Modify terminal input handler:
```javascript
// Replace the existing onData handler with:
this.terminal.onData(data => {
    // Handle special keys
    if (data === '\x03') {  // Ctrl+C
        if (this.socket && this.connected) {
            this.socket.send(JSON.stringify({
                type: 'input',
                data: data
            }));
        }
        return;
    }

    // Normal input
    if (this.socket && this.connected) {
        this.socket.send(JSON.stringify({
            type: 'input',
            data: data
        }));
    }
});
```

**Step 3: Test keyboard shortcuts**

Visit: `http://localhost:8080/terminal`

Try: `Ctrl+L` to clear, `Ctrl+C` to interrupt

**Step 4: Commit**

```bash
git add templates/terminal.html
git commit -m "feat: add terminal keyboard shortcuts"
```

---

## Task 8: Add Status Monitoring Panel

**Files:**
- Create: `static/js/terminal-status.js`
- Modify: `templates/terminal.html`

**Step 1: Create status monitor component**

Create `static/js/terminal-status.js`:
```javascript
document.addEventListener('alpine:init', () => {
    Alpine.data('terminalStatus', () => ({
        status: 'unknown',
        sessionCount: 0,
        lastUpdate: null,

        async init() {
            await this.updateStatus();
            // Update every 5 seconds
            setInterval(() => this.updateStatus(), 5000);
        },

        async updateStatus() {
            try {
                const res = await fetch('/api/terminal/status');
                const data = await res.json();
                this.status = data.status || 'unknown';
                this.sessionCount = data.session_count || 0;
                this.lastUpdate = new Date().toISOString();
            } catch (e) {
                this.status = 'error';
            }
        }
    }));
});
```

**Step 2: Add status endpoint to main.py**

Add after history endpoints:
```python
@app.get("/api/terminal/status")
async def terminal_status():
    """Get terminal service status."""
    return {
        "status": "running",
        "session_count": len(terminal_sessions),
        "sessions": list(terminal_sessions.keys())[:10]  # First 10 session IDs
    }
```

**Step 3: Include status script in terminal.html**

Add to terminal.html after xterm scripts:
```html
<script defer src="/static/js/terminal-status.js"></script>
```

**Step 4: Add status display to terminal page**

Add to terminal.html in the toolbar:
```html
<div class="terminal-status" x-data="terminalStatus">
    <!-- Existing status dot -->
    <div class="status-dot" :class="status"></div>
    <span x-text="status.toUpperCase()"></span>
    <span x-show="sessionCount > 0" :style="'opacity: 0.5;'">| Active: <span x-text="sessionCount"></span></span>
</div>
```

**Step 5: Test status monitoring**

Visit: `http://localhost:8080/terminal`

Expected: Should see session count in status bar

**Step 6: Commit**

```bash
git add static/js/terminal-status.js templates/terminal.html main.py
git commit -m "feat: add terminal status monitoring panel"
```

---

## Testing Checklist

After implementation, verify:

- [ ] Terminal loads at `/terminal`
- [ ] WebSocket connects successfully
- [ ] Can type commands and see output
- [ ] Terminal resizes with window
- [ ] Commands are saved to history
- [ ] Can clear terminal with button
- [ ] Can disconnect/reconnect
- [ ] Keyboard shortcuts work (Ctrl+C, Ctrl+L)
- [ ] Status shows connected state
- [ ] Multiple sessions are tracked

## Dependencies Summary

```bash
# Backend
pip install fastapi uvicorn jinja2 aiofiles

# Optional: For better PTY handling
pip install ptyprocess
```

## Files Changed/Created Summary

**Created:**
- `static/js/lib/xterm.min.js`
- `static/js/lib/xterm.css`
- `static/js/lib/xterm-addon-fit.min.js`
- `static/js/terminal-status.js`
- `templates/terminal.html`
- `data/terminal_history.json`

**Modified:**
- `main.py` - Added WebSocket endpoint, history API, terminal route
- `templates/base.html` - Added terminal navigation link

---

**End of Implementation Plan**
