# ClaudePad Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the frontend architecture for ClaudePad with zero-build, self-hosted assets optimized for mobile performance.

**Architecture:** Alpine.js for client-side interactivity, TailwindCSS (standalone CLI) for styling, Jinja2 templates server-rendered by FastAPI. All static assets self-hosted for LAN mobile performance.

**Tech Stack:** FastAPI, Jinja2, Alpine.js, TailwindCSS standalone CLI, WebSocket

---

## Task 1: Project Structure Setup

**Files:**
- Create: `static/css/input.css`
- Create: `static/js/.gitkeep`
- Create: `static/icons/.gitkeep`
- Create: `templates/.gitkeep`

**Step 1: Create directory structure**

```bash
mkdir -p static/css static/js static/icons templates
touch static/js/.gitkeep static/icons/.gitkeep templates/.gitkeep
```

**Step 2: Create TailwindCSS input file**

Create `static/css/input.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer components {
  .status-badge {
    @apply px-2 py-1 rounded-full text-sm font-medium;
  }
}
```

**Step 3: Commit**

```bash
git add static/ templates/
git commit -m "$(cat <<'EOF'
chore: create project structure for frontend

- static/css for TailwindCSS
- static/js for Alpine.js and app code
- static/icons for SVG icons
- templates for Jinja2 templates

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: TailwindCSS Standalone CLI Setup

**Files:**
- Create: `tailwind.config.js`
- Create: `tailwindcss` (binary)

**Step 1: Download TailwindCSS standalone CLI**

```bash
curl -sLO https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-linux-x64
chmod +x tailwindcss-linux-x64
mv tailwindcss-linux-x64 tailwindcss
```

**Step 2: Create TailwindCSS config**

Create `tailwind.config.js`:

```javascript
module.exports = {
  content: ['./templates/**/*.html', './static/js/**/*.js'],
  theme: {
    extend: {}
  },
  plugins: []
}
```

**Step 3: Build initial TailwindCSS file**

```bash
./tailwindcss -i ./static/css/input.css -o ./static/css/tailwind.css
```

**Step 4: Verify output exists**

```bash
ls -la static/css/tailwind.css
```

Expected: File exists with size > 0

**Step 5: Commit**

```bash
git add tailwindcss tailwind.config.js static/css/tailwind.css
git commit -m "$(cat <<'EOF'
chore: setup TailwindCSS standalone CLI

- Download tailwindcss binary for Linux x64
- Add tailwind.config.js with template paths
- Generate initial tailwind.css

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Download Alpine.js

**Files:**
- Create: `static/js/alpine.min.js`

**Step 1: Download Alpine.js**

```bash
curl -sL https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js -o static/js/alpine.min.js
```

**Step 2: Verify download**

```bash
head -c 100 static/js/alpine.min.js
```

Expected: Minified JavaScript starting with Alpine.js code

**Step 3: Check file size**

```bash
ls -lh static/js/alpine.min.js
```

Expected: ~50-60KB (uncompressed)

**Step 4: Commit**

```bash
git add static/js/alpine.min.js
git commit -m "$(cat <<'EOF'
chore: add self-hosted Alpine.js

Download Alpine.js 3.x for self-hosting instead of CDN.
Improves mobile performance over LAN.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Base Template

**Files:**
- Create: `templates/base.html`

**Step 1: Create base template**

Create `templates/base.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="default">
    <title>{% block title %}ClaudePad{% endblock %}</title>
    <link href="/static/css/tailwind.css" rel="stylesheet">
    <script defer src="/static/js/alpine.min.js"></script>
    <script defer src="/static/js/app.js"></script>
    <style>
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
        .safe-top { padding-top: env(safe-area-inset-bottom); }
    </style>
</head>
<body class="bg-stone-100 min-h-screen text-stone-900">
    <nav class="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div class="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
            <a href="/" class="font-semibold text-lg">ClaudePad</a>
            <div class="flex items-center gap-4">
                <span x-data x-text="$store.app?.project || 'No Project'" class="text-stone-500 text-sm"></span>
                <a href="/settings" class="text-stone-500 hover:text-stone-700">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                    </svg>
                </a>
            </div>
        </div>
    </nav>

    <main class="max-w-7xl mx-auto px-4 py-6">
        {% block content %}{% endblock %}
    </main>

    {% block scripts %}{% endblock %}
</body>
</html>
```

**Step 2: Commit**

```bash
git add templates/base.html
git commit -m "$(cat <<'EOF'
feat: add base HTML template

- Mobile-optimized viewport with safe-area support
- Self-hosted Alpine.js and TailwindCSS
- Navigation header with project display
- Blocks for title, content, and scripts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: FastAPI Static Files Setup

**Files:**
- Create: `main.py`

**Step 1: Create FastAPI application**

Create `main.py`:

```python
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI(title="ClaudePad")

# Paths
BASE_DIR = Path(__file__).parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Templates
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


@app.get("/")
async def index(request: Request):
    """Redirect to current project or show project selector."""
    return templates.TemplateResponse("index.html", {
        "request": request,
        "project": None,
        "tasks": []
    })


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
```

**Step 2: Create index template placeholder**

Create `templates/index.html`:

```html
{% extends "base.html" %}

{% block title %}ClaudePad - Tasks{% endblock %}

{% block content %}
<div x-data="kanban()" x-init="init()" class="space-y-4">
    <!-- Loading state -->
    <div x-show="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-stone-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
    </div>

    <!-- Error state -->
    <div x-show="error" class="bg-red-50 border border-red-200 p-4 rounded-lg">
        <p x-text="error" class="text-red-700"></p>
        <button @click="init()" class="mt-2 text-red-600 underline">Retry</button>
    </div>

    <!-- Empty state -->
    <div x-show="!loading && !error && tasks.length === 0" class="text-center py-12">
        <p class="text-stone-500">No tasks yet. Create your first task to get started.</p>
    </div>

    <!-- Task list placeholder -->
    <div x-show="!loading && tasks.length > 0">
        <p class="text-stone-500">Tasks will appear here.</p>
    </div>
</div>
{% endblock %}
```

**Step 3: Commit**

```bash
git add main.py templates/index.html
git commit -m "$(cat <<'EOF'
feat: add FastAPI application with static files

- FastAPI app with static file mounting
- Jinja2 templates configuration
- Index route with placeholder template
- Health check endpoint

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Alpine.js Application Core

**Files:**
- Create: `static/js/app.js`

**Step 1: Create Alpine.js application file**

Create `static/js/app.js`:

```javascript
// ClaudePad Frontend Application
// Alpine.js-based task management

document.addEventListener('alpine:init', () => {
    // Global application store
    Alpine.store('app', {
        project: null,
        tasks: [],
        loading: false,
        error: null,

        // Fetch tasks for current project
        async fetchTasks() {
            if (!this.project) return;
            this.loading = true;
            this.error = null;
            try {
                const res = await fetch(`/api/${this.project}/tasks`);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                this.tasks = await res.json();
            } catch (e) {
                console.error('Failed to fetch tasks:', e);
                this.error = 'Failed to load tasks. Check connection.';
            } finally {
                this.loading = false;
            }
        },

        // Set current project
        setProject(name) {
            this.project = name;
            this.fetchTasks();
        }
    });
});

// Kanban board component
function kanban() {
    return {
        tasks: [],
        loading: true,
        error: null,

        async init() {
            await this.loadTasks();
        },

        async loadTasks() {
            this.loading = true;
            this.error = null;
            try {
                // Will use actual API once backend is ready
                // const res = await fetch(`/api/${project}/tasks`);
                // this.tasks = await res.json();
                this.tasks = [];
            } catch (e) {
                console.error('Failed to load tasks:', e);
                this.error = 'Failed to load tasks.';
            } finally {
                this.loading = false;
            }
        },

        getStatusLabel(status) {
            const labels = {
                'pending': '待开发',
                'developing': '开发中',
                'review': '待 Review',
                'completed': '已完成',
                'failed': '失败',
                'cancelled': '已取消'
            };
            return labels[status] || status;
        },

        getStatusClass(status) {
            const classes = {
                'pending': 'bg-gray-100 text-gray-700',
                'developing': 'bg-blue-100 text-blue-700',
                'review': 'bg-purple-100 text-purple-700',
                'completed': 'bg-green-100 text-green-700',
                'failed': 'bg-red-100 text-red-700',
                'cancelled': 'bg-yellow-100 text-yellow-700'
            };
            return classes[status] || 'bg-gray-100 text-gray-700';
        }
    };
}

// Task detail component
function taskDetail() {
    return {
        task: null,
        output: '',
        input: '',
        socket: null,
        loading: true,
        error: null,
        requiresInput: false,

        async init() {
            // Task data injected from template
            this.task = window.taskData || null;
            this.loading = false;
        },

        connect() {
            if (!this.task) return;

            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.host}/ws/${this.task.project}/tasks/${this.task.id}`;

            this.socket = new WebSocket(wsUrl);

            this.socket.onopen = () => {
                console.log('WebSocket connected');
            };

            this.socket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            };

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.error = 'Connection error.';
            };

            this.socket.onclose = () => {
                console.log('WebSocket closed');
            };
        },

        handleMessage(data) {
            switch (data.type) {
                case 'output':
                    this.output += data.content;
                    this.requiresInput = data.requires_input || false;
                    break;
                case 'error':
                    this.error = data.message;
                    break;
                case 'complete':
                    this.output += '\n\n✓ Task completed';
                    this.socket?.close();
                    break;
            }
        },

        sendInput() {
            if (!this.input.trim() || !this.socket) return;

            this.socket.send(JSON.stringify({
                type: 'input',
                content: this.input.trim()
            }));

            this.output += `\n> ${this.input}\n`;
            this.input = '';
            this.requiresInput = false;
        },

        disconnect() {
            this.socket?.close();
            this.socket = null;
        }
    };
}

// Task form component
function taskForm() {
    return {
        title: '',
        description: '',
        prompt: '',
        isPlan: false,
        loading: false,
        error: null,

        async submit() {
            if (!this.title.trim()) {
                this.error = 'Title is required.';
                return;
            }

            this.loading = true;
            this.error = null;

            try {
                const res = await fetch(`/api/${window.currentProject}/tasks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: this.title,
                        description: this.description,
                        prompt: this.prompt,
                        is_plan: this.isPlan
                    })
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const task = await res.json();
                window.location.href = `/project/${task.project}/task/${task.id}`;
            } catch (e) {
                console.error('Failed to create task:', e);
                this.error = 'Failed to create task.';
            } finally {
                this.loading = false;
            }
        }
    };
}
```

**Step 2: Commit**

```bash
git add static/js/app.js
git commit -m "$(cat <<'EOF'
feat: add Alpine.js application core

- Global app store for state management
- Kanban component with status labels/classes
- Task detail component with WebSocket handling
- Task form component for creation
- Error and loading state handling

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Requirements and Configuration

**Files:**
- Create: `requirements.txt`
- Create: `config.yaml`
- Create: `.gitignore`

**Step 1: Create requirements.txt**

Create `requirements.txt`:

```
fastapi>=0.104.0
uvicorn[standard]>=0.24.0
aiofiles>=23.2.1
pyyaml>=6.0
```

**Step 2: Create config.yaml**

Create `config.yaml`:

```yaml
server:
  host: "0.0.0.0"
  port: 8080

claude:
  command: "claude"
  timeout: 300

git:
  auto_commit: true
  commit_prefix: "claude"

app:
  default_mode: "interactive"
  max_attachment_size: 5242880
  log_retention: "forever"
```

**Step 3: Create .gitignore**

Create `.gitignore`:

```gitignore
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
venv/
ENV/

# TailwindCSS binary (large)
tailwindcss

# Data directory (user data)
data/

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
```

**Step 4: Commit**

```bash
git add requirements.txt config.yaml .gitignore
git commit -m "$(cat <<'EOF'
chore: add requirements and configuration

- Python dependencies: FastAPI, Uvicorn, aiofiles, pyyaml
- Application config: server, claude, git, app settings
- Gitignore: Python, data, IDE, OS files

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Verify Application Starts

**Files:**
- None (verification only)

**Step 1: Install dependencies**

```bash
pip install -r requirements.txt
```

**Step 2: Start the server**

```bash
python main.py &
```

**Step 3: Test health endpoint**

```bash
curl http://localhost:8080/health
```

Expected: `{"status":"ok"}`

**Step 4: Test index page**

```bash
curl -s http://localhost:8080/ | head -20
```

Expected: HTML with `<!DOCTYPE html>` and Tailwind CSS link

**Step 5: Stop the server**

```bash
pkill -f "python main.py"
```

**Step 6: Commit (if any changes)**

No files to commit - verification only.

---

## Summary

This plan creates the frontend foundation for ClaudePad:

1. **Project structure** - Static files, templates directories
2. **TailwindCSS** - Standalone CLI with self-hosted output
3. **Alpine.js** - Self-hosted for mobile performance
4. **Base template** - Mobile-optimized HTML scaffold
5. **FastAPI** - Static files and template rendering
6. **Application JS** - Alpine components for kanban, tasks, forms
7. **Configuration** - Requirements and app config
8. **Verification** - Confirm server starts and serves pages

**Next steps after this plan:**
- Implement data storage layer (JSON files)
- Implement REST API endpoints
- Implement WebSocket bridge to Claude CLI
- Build out kanban UI with status columns
- Build task detail page with terminal UI
