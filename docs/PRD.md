# 希卡之石 (Sheikah Slate) - Claude Code 监控系统

## 产品需求文档 (PRD)

**版本：** 2.0
**日期：** 2026-02-27
**状态：** 草案

---

## 1. 产品概述

### 1.1 产品名称
**希卡之石 (Sheikah Slate)** - Claude Code 会话监控系统

### 1.2 产品定位
一个简洁的 Web 面板，用于监控和管理 Claude Code 会话，灵感来自《塞尔达传说》中的希卡之石。

### 1.3 核心价值
- **实时监控**：查看 Claude Code 会话状态（运行中、已完成、Token 消耗、运行时间）
- **会话管理**：浏览、恢复、管理历史会话
- **终端集成**：Web 终端直接连接 Claude Code 会话
- **零配置**：自动扫描 `~/.claude` 目录，无需手动配置

---

## 2. 设计原则

### 2.1 简洁 (Simplicity)
- 前后端交互逻辑保持简单、一致
- 单一 HTML 文件实现前端逻辑
- RESTful API 设计，端点数量最小化

### 2.2 前端 (Frontend)
- 单个 HTML 文件包含所有逻辑
- 使用原生 JavaScript，无框架依赖
- 内联 CSS，保持样式一致
- 模块化代码结构（函数分离、职责单一）

### 2.3 后端 (Backend)
- Node.js 原生模块，零运行时依赖
- SSE (Server-Sent Events) 实现终端流式输出
- 自动认证：首次启动时处理服务器密码
- 直接调用 `claude` CLI 命令

---

## 3. 功能需求

### 第一阶段：会话监控面板

#### 3.1.1 会话列表
**功能描述**：展示所有 Claude Code 会话的基本信息

**显示内容**：
| 字段 | 说明 |
|------|------|
| 会话 ID | Claude Code 会话唯一标识（前 8 位） |
| 状态 | 运行中 (Running) / 已完成 (Completed) / 已停止 (Stopped) |
| Token 消耗 | 当前会话消耗的 Token 总数 |
| 运行时间 | 会话启动至今的时间 |
| 最后活动 | 最后一次交互时间 |

**数据来源**：
- 扫描 `~/.claude/session-env/` 目录
- 解析 `~/.claude/history.jsonl` 获取会话元数据

#### 3.1.2 状态指示器
- **运行中**：青色 pulsing 圆点
- **已完成**：绿色圆点
- **已停止**：红色圆点

#### 3.1.3 自动刷新
- 每 10 秒自动刷新会话列表
- 手动刷新按钮

---

### 第二阶段：会话详情与终端集成

#### 3.2.1 会话选择
- 点击会话卡片进入详情
- 显示完整会话信息
- 提供操作按钮（恢复、停止、查看历史）

#### 3.2.2 Web 终端
**功能描述**：在浏览器中直接操作 Claude Code 会话

**技术实现**：
- 使用 xterm.js 作为终端模拟器
- SSE 接收后端输出流
- POST 发送用户输入到后端

**操作流程**：
1. 用户点击「终端」按钮
2. 后端执行 `claude --resume <session-id>`
3. 建立 SSE 连接，流式输出终端内容
4. 用户输入通过 POST 发送到后端
5. 后端写入 claude 进程的 stdin

#### 3.2.3 会话操作
| 操作 | CLI 命令 | 说明 |
|------|---------|------|
| 恢复会话 | `claude --resume <id>` | 连接到现有会话 |
| 停止会话 | `kill <pid>` | 终止会话进程 |
| 重命名 | `claude --rename` | 重命名会话 |
| 查看历史 | `claude --history` | 查看会话历史 |

---

## 4. 技术架构

### 4.1 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Frontend)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Sessions   │  │   Session   │  │     Web Terminal    │  │
│  │    List     │  │   Detail    │  │     (xterm.js)      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         │ GET /api/      │ GET /api/           │ SSE / POST  │
│         │ sessions       │ sessions/:id        │ /terminal/* │
│         └────────────────┴─────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Node.js Server (Backend)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Session   │  │   Session   │  │    Terminal Proxy   │  │
│  │    Scanner  │  │   Manager   │  │   (SSE + stdin)     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Claude CLI Commands                         │ │
│  │  claude --resume   claude --list   claude --history     │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    File System Access                        │
│  ~/.claude/session-env/   ~/.claude/history.jsonl           │
│  ~/.claude/skills/        ~/.claude/settings.json           │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 数据流

#### 4.2.1 会话列表获取
```
User Click Refresh
       ↓
Frontend: GET /api/sessions
       ↓
Backend: Scan ~/.claude/session-env/
       ↓
Backend: Parse history.jsonl
       ↓
Backend: Return JSON [{id, status, tokens, duration}]
       ↓
Frontend: Render Session Cards
```

#### 4.2.2 终端连接
```
User Click Terminal
       ↓
Frontend: Open SSE /terminal/stream?id=xxx
       ↓
Backend: Spawn `claude --resume <id>`
       ↓
Backend: Pipe stdout → SSE clients
       ↓
Frontend: xterm.js write(output)
       ↓
User Input → POST /terminal/input
       ↓
Backend: Write to claude stdin
```

---

## 5. API 设计

### 5.1 会话 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | 获取所有会话列表 |
| GET | `/api/sessions/:id` | 获取单个会话详情 |
| POST | `/api/sessions/:id/resume` | 恢复指定会话 |
| POST | `/api/sessions/:id/stop` | 停止指定会话 |

### 5.2 终端 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/terminal/stream?id=xxx` | SSE 终端输出流 |
| POST | `/terminal/input` | 发送用户输入 |

### 5.3 系统 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | 健康检查 |
| GET | `/api/skills` | 获取已安装 Skills |
| GET | `/api/settings` | 获取 Claude 设置 |

---

## 6. 数据结构

### 6.1 Session 对象
```json
{
  "id": "abc12345-6789-40ab-cdef-123456789012",
  "name": "Fix login bug",
  "status": "running",
  "tokenCount": 15000,
  "startTime": "2026-02-27T10:30:00Z",
  "lastActivity": "2026-02-27T11:45:00Z",
  "projectPath": "/home/user/project"
}
```

### 6.2 Terminal Output
```json
{
  "type": "output",
  "data": "Claude is thinking...\n"
}
```

### 6.3 Terminal Input
```json
{
  "session_id": "abc12345",
  "data": "Hello, Claude!"
}
```

---

## 7. 前端结构

### 7.1 单文件组织
```html
<!DOCTYPE html>
<html>
<head>
  <title>希卡之石 // Claude Code Monitor</title>
  <style>
    /* CSS Variables */
    :root { --colors... }

    /* Global Styles */
    * { reset... }

    /* Layout Components */
    .header { ... }
    .container { ... }
    .panel { ... }

    /* Session Components */
    .session-card { ... }
    .session-status { ... }
  </style>
</head>
<body>
  <!-- Header -->
  <header>...</header>

  <!-- Main Content -->
  <main>
    <!-- Sessions Panel -->
    <section id="sessions">...</section>

    <!-- Terminal Panel (hidden by default) -->
    <section id="terminal" style="display:none">...</section>
  </main>

  <script>
    // State
    let sessions = [];
    let currentSession = null;

    // API Functions
    async function fetchSessions() { ... }
    async function resumeSession(id) { ... }

    // UI Functions
    function renderSessions() { ... }
    function showTerminal() { ... }

    // Terminal Functions
    function initTerminal() { ... }
    function streamOutput() { ... }

    // Event Handlers
    function init() { ... }
  </script>
</body>
</html>
```

---

## 8. 后端结构

### 8.1 服务器模块
```javascript
// server.js
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

// Routes
const routes = {
  'GET /health': healthCheck,
  'GET /api/sessions': getSessions,
  'GET /api/sessions/:id': getSession,
  'POST /api/sessions/:id/resume': resumeSession,
  'GET /terminal/stream': terminalStream,
  'POST /terminal/input': terminalInput,
};

// Main Server
const server = createServer(async (req, res) => {
  // Route matching
  // CORS headers
  // Response handling
});

// Session Scanner
async function scanSessions() {
  // Read ~/.claude/session-env/
  // Parse history.jsonl
  // Return session list
}

// Terminal Manager
function spawnClaude(sessionId) {
  // Spawn `claude --resume <id>`
  // Pipe stdout to SSE
  // Handle stdin from POST
}
```

---

## 9. 安全考虑

### 9.1 服务器认证
- 首次启动时生成随机密码
- 密码保存在 `~/.claudepad/token`
- 前端首次访问时提示输入密码
- 认证成功后保存 token 到 localStorage

### 9.2 命令执行安全
- 仅允许执行 `claude` CLI 命令
- 不暴露任意命令执行接口
- 会话 ID 验证防止未授权访问

---

## 10. 性能要求

| 指标 | 目标 |
|------|------|
| 会话列表加载时间 | < 500ms |
| 终端输出延迟 | < 100ms |
| 页面首屏渲染 | < 1s |
| 自动刷新间隔 | 10s |

---

## 11. 开发路线图

### Phase 1 (MVP) - 会话监控
- [ ] 后端：扫描会话目录
- [ ] 后端：`/api/sessions` 端点
- [ ] 前端：会话列表 UI
- [ ] 前端：状态指示器
- [ ] 前端：自动刷新

### Phase 2 - 终端集成
- [ ] 后端：SSE 终端流
- [ ] 后端：`/terminal/input` 端点
- [ ] 前端：xterm.js 集成
- [ ] 前端：终端 UI 面板
- [ ] 前端：会话切换

### Phase 3 - 增强功能
- [ ] Skills 管理
- [ ] 会话搜索
- [ ] Token 统计图表
- [ ] 会话导出

---

## 12. 参考资源

### 12.1 Claude CLI 命令
```bash
claude --list           # 列出所有会话
claude --resume <id>    # 恢复会话
claude --rename         # 重命名会话
claude --help           # 查看帮助
```

### 12.2 数据目录
```
~/.claude/
├── session-env/        # 会话环境文件
├── history.jsonl       # 会话历史
├── skills/             # 安装的 Skills
└── settings.json       # 用户设置
```

### 12.3 技术栈
- **前端**：原生 HTML/CSS/JS + xterm.js
- **后端**：Node.js 原生模块
- **通信**：REST API + SSE

---

*文档结束*
