# ClaudePad TODO

> Updated: 2026-03-25
> Status: Terminal stability and platform compatibility (v0.3.1)

## Progress

```
Total: 11 | Done: 10 (91%) | In Progress: 0 | Pending: 1
```

## Priority

`P0` Critical | `P1` High | `P2` Medium | `P3` Low

## Status

`✅` Done | `🔄` In Progress | `⬜` Not Started | `❌` Broken | `🚫` Deferred

---

## ✅ Completed in v0.3.1 (Current Task)

| Task | Notes |
|------|-------|
| 终端 Resize 同步 | 前后端已打通，PTY 随窗口动态缩放 |
| SSH 连接错误详细反馈 | 细化错误码，前端红字回显 |
| 跨平台终端启动 | 自动识别 claude 路径，支持 Win/Linux |
| Windows 环境适配 | 自动注入 CLAUDE_CODE_GIT_BASH_PATH |
| 前端离线化 | xterm.js 库已下载至本地 asserts/lib |

## ✅ Completed in v0.3.0

| Task | Notes |
|------|-------|
| Backend Modular Architecture | Split into routes/services/websocket layers |
| TypeScript Migration | All backend code now in TypeScript |
| Project Structure | `backend/` + `frontend/` directories |
| SSH Key Auth Support | Auto-detect ~/.ssh/id_ed25519 |
| SSH REST APIs | GET/POST/DELETE /api/servers |
| SSH WebSocket Handler | `/ws/ssh/:serverId/:sessionId` |
| Local Terminal WS | `/ws/terminal/:sessionId` |
| Multi-version Session Discovery | Support sessions/, session-env/, projects/ |

---

## Pending Tasks

| # | P | Task | Status | Notes |
|---|---|------|--------|-------|
| 3 | P1 | 断线重连机制 | ⬜ | 实现 WebSocket 指数退避重连 |

---

## Test Server

| ID | Host | User | Auth | Status |
|----|------|------|------|--------|
| insanelysane | ssh.insanelysane.online | lucas | SSH Key | ✅ Connected |

---

## Changelog

| Date | Change |
|------|--------|
| 2026-03-25 | v0.3.1 - Terminal Resize, Cross-platform Support, SSH Feedback |
| 2026-03-24 | v0.3.0 - Backend refactoring with modular architecture |
| 2026-03-23 | SSH Key 认证测试通过，修复 getRemoteSessions |
| 2026-03-23 | SSH REST APIs + WebSocket handler |
| 2026-03-23 | 前端服务器管理 UI |
