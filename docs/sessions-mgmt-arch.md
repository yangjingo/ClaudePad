# Sessions Management Architecture

This document summarizes the current session management flow across local and remote sessions, including discovery, validation, and SSH performance paths. It is intended as a stable reference for future changes.

## 1. High-Level Flow (Sequence)

```text
[Browser]             [Backend]                       [Remote]
   |                      |                              |
   |  GET /api/sessions   |                              |
   |--------------------->|  session-cache (local scan)  |
   |<---------------------|  cached list                 |
   |                      |                              |
   |  GET /api/servers/:id/sessions                      |
   |--------------------->|  ssh-manager (remote scan)   |
   |                      |  execCommand -> .claude      |
   |<---------------------|  candidate list              |
   |                      |                              |
   |  POST /api/servers/:id/sessions/:sid/terminal       |
   |--------------------->|  createPTYSession            |
   |                      |  conn.exec(claude --resume)  |
   |                      |                              |
   |  WS /ws/ssh/:id/:sid  |  attach PTY stream           |
   |<====================>|  output -> WS                |
   |                      |                              |
```

## 2. Local Session Discovery

Entry point
- `GET /api/sessions`
- Backend: `backend/routes/sessions.ts`

Implementation
- `backend/services/session-cache.ts`

Discovery sources
- `~/.claude/history.jsonl`
- `~/.claude/sessions/*.{jsonl,json}`
- `~/.claude/session-env/*`
- `~/.claude/projects/*/*.jsonl`
- `~/.claude/file-history/*`

Rules
- `historyId ∩ artifactId` only
- Memory cache TTL: `5s`
- File cache TTL: `5min`

Frontend behavior
- `frontend/index.html` renders from `sessionStorage` cache first
- then refreshes in background

## 3. Remote Session Discovery

Entry point
- `GET /api/servers/:id/sessions`
- Backend: `backend/routes/servers.ts`

Implementation
- `backend/services/ssh-manager.ts`

Discovery sources (via SSH)
- `~/.claude/history.jsonl`
- `~/.claude/sessions/*.{jsonl,json}`
- `~/.claude/session-env/*`
- `~/.claude/projects/*/*.jsonl`
- `~/.claude/file-history/*`

Rules
- `historyId ∩ artifactId` only
- `invalid` only applied when remote returns hard failure

## 4. Resume Validation Logic

Goal
- Avoid false success on first output
- Only emit `resume_ready` once recovery is verified

Backend (`ssh-manager.ts`)
- Hard fail:
  - `No conversation found with session ID`
  - `command not found / permission denied`
- Safety check:
  - Detect `Quick safety check` screen (compact match)
  - Auto-send `1` confirmation
  - Persist trusted workspace

Signals
- `resume_ready` is emitted from backend
- Frontend only shows `[CORE LINK STABLE ...]` after `resume_ready`

Relevant files
- `backend/services/ssh-manager.ts`
- `backend/websocket/ssh.ts`
- `frontend/terminal.html`

## 5. SSH Performance and Stability

Connection de-duplication
- `getOrCreateConnection()` shares in-flight promises
- Prevents multiple concurrent handshakes for same server

Direct exec (no login shell)
- Use `conn.exec(..., { pty })`
- Avoids `Last login` + prompt noise
- Faster and cleaner output

Trusted workspace cache
- File: `.cache/trusted-remote-workspaces.json`
- Key: `serverId + projectPath`
- Used to shortcut future safety confirmation

History metadata cache
- In-memory TTL: `5min`
- Reduces repeated SSH reads of `history.jsonl`

## 6. Known Failure Modes

- Remote session listed but not resumable:
  - `history.jsonl` contains ID
  - but Claude returns `No conversation found`
  - mark as `invalid`

- Remote project path missing:
  - `cd` fails and resume stops
  - detected by `sh: cd: can't cd to ...`

- Fast UI success but resume failed:
  - fixed by `resume_ready` event

## 7. Key Modules

- Local sessions: `backend/services/session-cache.ts`
- Remote sessions: `backend/services/ssh-manager.ts`
- Remote WS: `backend/websocket/ssh.ts`
- Frontend terminal state: `frontend/terminal.html`
- Frontend sessions list: `frontend/index.html`
