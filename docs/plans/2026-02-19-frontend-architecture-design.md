# ClaudePad Frontend Architecture Design

> Date: 2026-02-19
> Status: Approved

## Overview

This design establishes the frontend architecture for ClaudePad, a web-based task management interface for Claude Code. The key decision is **zero-build with self-hosted assets** to optimize for mobile performance over LAN.

## Design Decision

**Chosen approach: Zero-build + Self-hosted Assets**

Rationale:
- For a LAN app, serving assets locally is faster than CDN (no internet hop)
- Mobile devices on weak networks get consistent performance
- No build step simplifies development and deployment
- Tailwind purge can run as a one-time step for production

---

## Section 1: Project Structure

```
ClaudePad/
├── main.py                    # FastAPI app entry
├── config.yaml                # Configuration
├── static/
│   ├── css/
│   │   └── tailwind.css       # Pre-built (purged for production)
│   ├── js/
│   │   ├── alpine.min.js      # Self-hosted Alpine.js (~15KB gzip)
│   │   └── app.js             # Application code
│   └── icons/                 # SVG icons
├── templates/
│   ├── base.html              # Base layout with head/meta
│   ├── index.html             # Kanban board
│   ├── task.html              # Task detail + terminal
│   ├── new-task.html          # Task creation form
│   └── settings.html          # Project config
├── data/                      # JSON storage
└── requirements.txt
```

---

## Section 2: Frontend JavaScript Architecture

### Global State (Alpine.store)

```javascript
document.addEventListener('alpine:init', () => {
    Alpine.store('app', {
        project: null,
        tasks: [],
        socket: null,

        // Task operations
        async fetchTasks(project) { ... },
        async createTask(data) { ... },
        async updateTaskStatus(id, status) { ... },

        // WebSocket management
        connectTask(id) { ... },
        sendInput(content) { ... },
        disconnect() { ... }
    });
});
```

### State Management Approach

- **Alpine.store**: Global state (tasks, websocket)
- **x-data**: Local component state (form inputs, UI toggles)
- **Server**: Source of truth (no optimistic updates)

### WebSocket Manager

```javascript
const TaskSocket = {
    ws: null,
    listeners: new Map(),

    connect(project, taskId, onMessage, onOpen, onClose) { ... },
    send(type, content) { ... },
    disconnect() { ... }
};
```

---

## Section 3: CSS & TailwindCSS Setup

### Development Setup

```bash
# One-time: download Tailwind standalone CLI
curl -sLO https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64
chmod +x tailwindcss-linux-x64
mv tailwindcss-linux-x64 tailwindcss
```

### Configuration

```javascript
// tailwind.config.js
module.exports = {
  content: ['./templates/**/*.html', './static/js/**/*.js'],
  theme: {
    extend: {
      colors: {
        stone: { /* keep defaults */ }
      }
    }
  },
  plugins: []
}
```

### Build Commands

```bash
# Development: watch mode
./tailwindcss -i ./static/css/input.css -o ./static/css/tailwind.css --watch

# Production: purge and minify
./tailwindcss -i ./static/css/input.css -o ./static/css/tailwind.css --minify
```

### Expected CSS Sizes

| Mode | Size |
|------|------|
| Development (full Tailwind) | ~3MB |
| Production (purged) | ~10-20KB |

---

## Section 4: Mobile Optimization

### Base Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>ClaudePad</title>
    <link href="/static/css/tailwind.css" rel="stylesheet">
    <script defer src="/static/js/alpine.min.js"></script>
    <script defer src="/static/js/app.js"></script>
    <style>
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        .safe-top { padding-top: env(safe-area-inset-bottom); }
    </style>
</head>
<body class="bg-stone-100 min-h-screen">
    {% block content %}{% endblock %}
</body>
</html>
```

### Mobile-Specific Patterns

| Pattern | Implementation |
|---------|----------------|
| Touch targets | Min 44px (`min-h-11 min-w-11`) |
| Status change | Dropdown `<select>` instead of drag |
| Terminal scroll | `-webkit-overflow-scrolling: touch` |
| Input focus | `font-size: 16px` (prevents iOS zoom) |
| Long press | Prevent context menu on task cards |

### PWA Manifest (Future)

```json
{
  "name": "ClaudePad",
  "display": "standalone",
  "background_color": "#f5f5f4",
  "icons": [{"src": "/static/icons/icon-192.png", "sizes": "192x192"}]
}
```

---

## Section 5: Backend API & Template Integration

### FastAPI Structure

```python
# main.py
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/")
async def index(request: Request):
    return templates.TemplateResponse("index.html", {
        "request": request,
        "project": await get_current_project()
    })

@app.get("/project/{name}/task/{task_id}")
async def task_detail(request: Request, name: str, task_id: str):
    return templates.TemplateResponse("task.html", {
        "request": request,
        "task": await get_task(name, task_id)
    })
```

### API + Template Hybrid Approach

| Scenario | Approach |
|----------|----------|
| Initial page load | Server renders full HTML with data |
| Status updates | Fetch API → JSON response → Alpine updates DOM |
| Task creation | Form POST → redirect to task page |
| Terminal output | WebSocket streaming |

### Data Hydration Pattern

```html
<div x-data="kanban()" x-init="tasks = {{ tasks | tojson }}">
    <!-- Server injects initial data, Alpine takes over -->
</div>
```

### WebSocket Endpoint

```python
@app.websocket("/ws/{project}/tasks/{task_id}")
async def websocket_endpoint(websocket: WebSocket, project: str, task_id: str):
    await websocket.accept()
    async for output in run_claude_task(project, task_id):
        await websocket.send_json({"type": "output", "content": output})
```

---

## Section 6: Error Handling & Edge Cases

### Frontend Error States

```javascript
{
    error: null,
    loading: false,

    async fetchTasks() {
        this.loading = true;
        this.error = null;
        try {
            const res = await fetch(`/api/${this.project}/tasks`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            this.tasks = await res.json();
        } catch (e) {
            this.error = 'Failed to load tasks. Check connection.';
        } finally {
            this.loading = false;
        }
    }
}
```

### WebSocket Error Handling

| Scenario | Handling |
|----------|----------|
| Connection failed | Show "Connecting..." with retry button |
| Connection lost | Auto-reconnect with exponential backoff (1s, 2s, 4s, max 30s) |
| Claude CLI error | Display error in terminal, allow restart |
| Timeout (10s no output) | Show "Waiting for input?" prompt |

### Error UI Pattern

```html
<div x-show="error" class="bg-red-50 border border-red-200 p-4 rounded-lg">
    <p x-text="error" class="text-red-700"></p>
    <button @click="retry()" class="mt-2 text-red-600 underline">Retry</button>
</div>
```

### Loading States

```html
<div x-show="loading" class="flex items-center gap-2 text-stone-500">
    <svg class="animate-spin h-5 w-5"><!-- spinner --></svg>
    <span>Loading...</span>
</div>
```

---

## Summary

This architecture prioritizes:

1. **Mobile performance** - Self-hosted assets, minimal JS, touch-optimized UI
2. **Simplicity** - Zero build step, single JS file, server-rendered templates
3. **Reliability** - Proper error handling, WebSocket reconnection, loading states
4. **Maintainability** - Clear structure, Alpine.js patterns, documented decisions
