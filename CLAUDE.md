# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ClaudePad** is a web-based task management interface for Claude Code, designed for mobile accessibility and Git integration. It transforms Claude Code from a terminal-based tool into a web-based Kanban system.

Core value: Solve Claude Code pain points when used over SSH (terminal lag, small mobile screens, difficulty managing multiple tasks).

## Architecture

| Layer | Technology |
|-------|------------|
| Frontend | HTML5 + TailwindCSS + Alpine.js (zero-build, no bundler) |
| Backend | FastAPI (Python) with async/WebSocket support |
| Storage | Local JSON files in `data/` directory |
| Server | Uvicorn on 0.0.0.0 (LAN accessible) |
| Integration | Claude CLI + Git via subprocess |

## Data Structure

```
data/
├── projects.json              # Project list & current project
├── projects/
│   └── {project-name}/
│       ├── tasks.json         # Task data
│       ├── outputs/           # Claude output logs
│       └── attachments/       # Uploaded files
└── archive/                   # Soft-deleted task logs
```

## Commands (After Implementation)

```bash
# Install dependencies
pip install fastapi uvicorn aiofiles

# Start server
python main.py

# Server runs at http://0.0.0.0:8080
```

## Key Implementation Details

### Task ID Format
`YYYYMMDD-NNN` (e.g., `20250115-001`)

### Task Status Flow
```
待开发 → 开发中 → 待Review → 已完成
           ↓         ↓
         失败      已取消
```

### Git Integration
- Task creation: `git checkout -b claude/{task_id}`
- Commit format: `claude({task_id}): {description}`
- Records parent commit for rollback capability

### WebSocket Protocol
```
WS /ws/{project}/tasks/{id}

Client → Server: {"type": "input", "content": "..."}
Server → Client: {"type": "output", "content": "...", "requires_input": true}
Server → Client: {"type": "complete", "git_commit": "abc123"}
```

## Design Guidelines

### Color Palette (Tailwind)
- Background: `stone-100` (#f5f5f4)
- Cards: white
- Primary text: `stone-900`
- Secondary text: `stone-500`

### Status Badge Colors
- 待开发: gray
- 开发中: blue
- 待Review: purple
- 已完成: green
- 失败: red
- 已取消: yellow

### Mobile-First Design
- Vertical stacked Kanban (not horizontal columns)
- Touch targets minimum 44px
- Status changes via dropdown (mobile) / drag (desktop)
- PWA support planned

## API Routes

```
# Projects
GET/POST /api/projects
PUT /api/projects/{name}/switch
DELETE /api/projects/{name}

# Tasks
GET/POST /api/{project}/tasks
GET/PUT/DELETE /api/{project}/tasks/{id}
POST /api/{project}/tasks/{id}/status
POST /api/{project}/tasks/{id}/start
POST /api/{project}/tasks/{id}/cancel

# Files
GET /api/{project}/tasks/{id}/output
POST /api/upload
```

## Full Specification

See `PRD.md` for complete product requirements including:
- Detailed API specifications
- WebSocket message types
- Configuration options
- Development milestones
