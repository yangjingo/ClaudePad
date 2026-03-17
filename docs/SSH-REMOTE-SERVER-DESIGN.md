# SSH Remote Server Feature Design Document

**版本：** 1.0
**日期：** 2026-03-16
**状态：** 后端已完成，前端进行中

---

## 1. 功能概述

### 1.1 目标
实现通过 SSH 连接远程服务器，并在远程服务器上恢复和管理 Claude Code 会话的功能。

### 1.2 核心价值
- **远程会话管理**：通过 Web 界面管理多台服务器上的 Claude Code 会话
- **统一入口**：本地和远程会话在同一界面展示
- **安全连接**：密码仅存储在内存中，不持久化到磁盘
- **无缝体验**：远程会话终端与本地会话体验一致

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  Browser        │ ◄────────────────► │  ClaudePad       │
│  (xterm.js)     │                    │  Server          │
└─────────────────┘                    └────────┬─────────┘
                                                │
                                         SSH Connection
                                         (ssh2 library)
                                                │
                                         ┌──────┴──────┐
                                         │             │
                                    ┌────▼────┐   ┌────▼────┐
                                    │Remote   │   │Remote   │
                                    │Server 1 │   │Server 2 │
                                    └─────────┘   └─────────┘
```

### 2.2 数据流

```
1. 添加服务器 → 内存存储 (不持久化密码)
2. 测试连接 → 建立临时 SSH 连接验证
3. 获取会话 → 远程执行命令读取 ~/.claude/session-env/
4. 启动终端 → 创建 PTY 会话 → 执行 claude --resume
5. WebSocket → 桥接 PTY 流与浏览器
```

---

## 3. 后端实现 (✅ 已完成)

### 3.1 文件结构

| 文件 | 说明 |
|------|------|
| `ssh-manager.js` | SSH 连接管理模块 |
| `server.js` | HTTP/WebSocket 服务器 (已集成 SSH API) |

### 3.2 SSH Manager API

```javascript
// ssh-manager.js - 完整功能已实现

// 服务器配置管理
export function addServer(id, config)           // ✅ 添加服务器配置
export function removeServer(id)                // ✅ 移除服务器
export function getServers()                    // ✅ 获取服务器列表 (不含密码)
export function getServerConfig(id)             // ✅ 获取完整配置 (含密码)

// 连接与会话
export function testConnection(id)              // ✅ 测试 SSH 连接
export function execCommand(id, command)        // ✅ 执行远程命令
export function getRemoteSessions(id)           // ✅ 获取远程会话列表

// PTY 会话管理
export function createPTYSession(serverId, sessionId)   // ✅ 创建交互式 PTY
export function writeToPTY(serverId, sessionId, data)   // ✅ 写入 PTY
export function closePTYSession(serverId, sessionId)    // ✅ 关闭 PTY
export function resizePTY(serverId, sessionId, cols, rows)  // ✅ 调整终端大小
export function getPTYSession(serverId, sessionId)      // ✅ 获取活跃会话
```

### 3.3 REST API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/servers` | 获取所有服务器列表 |
| POST | `/api/servers` | 添加新服务器 |
| DELETE | `/api/servers/:id` | 删除服务器 |
| POST | `/api/servers/:id/test` | 测试 SSH 连接 |
| GET | `/api/servers/:id/sessions` | 获取远程会话列表 |
| POST | `/api/servers/:serverId/sessions/:sessionId/terminal` | 启动远程终端 |

### 3.4 WebSocket 协议

**本地会话**: `/ws/terminal/:sessionId`
**远程会话**: `/ws/ssh/:serverId/:sessionId`

**消息格式**:
```json
// Client → Server
{"type": "input", "data": "command"}
{"type": "resize", "cols": 120, "rows": 30}

// Server → Client
{"type": "output", "data": "terminal output"}
{"type": "close"}
{"type": "error", "data": "error message"}
```

### 3.5 安全设计

- 密码仅存储在内存 (`Map` 中)，**不持久化到磁盘**
- `getServers()` 返回的服务器信息不包含密码字段
- 连接使用 `readyTimeout: 10000` 防止连接挂起

---

## 4. 前端实现

### 4.1 HTML 结构 (✅ 已完成)

位置: `frontend/index.html` 第 740-794 行

**Servers Panel**:
```html
<div class="config-bar">
  <div class="config-row">
    <div class="config-item" style="flex: 1;">
      <span class="config-label">
        <span class="icon">▣</span> Remote Servers
        <button class="btn-edit-model" onclick="openAddServerModal()">+ Add</button>
      </span>
      <div id="servers-list" class="servers-list">...</div>
    </div>
  </div>
</div>
```

**Add Server Modal**:
```html
<div class="edit-modal-overlay" id="add-server-modal-overlay">
  <div class="edit-modal">
    <!-- Form fields: server-id, server-name, host, port, username, password -->
    <!-- Buttons: Cancel, Test Connection, Add Server -->
  </div>
</div>
```

### 4.2 TODO: JavaScript 函数实现

位置: `frontend/index.html` `<script>` 标签内

#### TODO 1: 服务器管理函数

```javascript
/**
 * 加载并显示服务器列表
 * API: GET /api/servers
 * 渲染到: #servers-list
 */
function loadServers() {
  // TODO: 实现服务器列表加载
  // 1. fetch GET /api/servers
  // 2. 清空 #servers-list
  // 3. 为每个服务器创建 server-tag 元素
  // 4. 显示服务器名称、连接状态、删除按钮
  // 5. 点击服务器展开/收起会话列表
}

/**
 * 打开添加服务器模态框
 * 显示: #add-server-modal-overlay
 */
function openAddServerModal() {
  // TODO: 显示模态框，重置表单
  document.getElementById('add-server-modal-overlay').style.display = 'flex';
}

/**
 * 关闭添加服务器模态框
 * 隐藏: #add-server-modal-overlay
 */
function closeAddServerModal() {
  // TODO: 隐藏模态框，清空表单
  document.getElementById('add-server-modal-overlay').style.display = 'none';
  // 清空表单字段...
}

/**
 * 添加新服务器
 * API: POST /api/servers
 * 表单字段: server-id, server-name, host, port, username, password
 */
async function addServer() {
  // TODO: 实现添加服务器逻辑
  // 1. 收集表单数据
  const id = document.getElementById('add-server-id').value;
  const name = document.getElementById('add-server-name').value;
  const host = document.getElementById('add-server-host').value;
  const port = parseInt(document.getElementById('add-server-port').value) || 22;
  const username = document.getElementById('add-server-username').value;
  const password = document.getElementById('add-server-password').value;

  // 2. validate 必填字段
  if (!id || !host || !username || !password) {
    alert('Please fill in all required fields');
    return;
  }

  // 3. POST /api/servers
  // 4. 成功后调用 loadServers() + closeAddServerModal()
}

/**
 * 删除服务器
 * API: DELETE /api/servers/:id
 */
async function deleteServer(serverId) {
  // TODO: 实现删除逻辑
  // 1. confirm 确认对话框
  if (!confirm(`Delete server "${serverId}"?`)) return;
  // 2. DELETE /api/servers/${serverId}
  // 3. 成功后调用 loadServers()
}

/**
 * 测试 SSH 连接
 * API: POST /api/servers/:id/test
 */
async function testServerConnection() {
  // TODO: 实现连接测试
  // 1. 先调用 addServer() 临时保存到内存
  // 2. POST /api/servers/:id/test
  // 3. 显示成功/失败状态（按钮颜色变化或 toast）
}
```

#### TODO 2: 会话列表整合

```javascript
/**
 * 加载所有会话（本地 + 远程）
 * 合并本地 /api/sessions 和远程 /api/servers/:id/sessions
 * 标记远程会话 remote: true, serverId, serverName
 */
async function loadAllSessions() {
  // TODO: 整合本地和远程会话
  // 1. fetch GET /api/sessions (本地)
  // 2. 对每个服务器 fetch GET /api/servers/:id/sessions
  // 3. 合并数组，远程会话添加 remote: true
  // 4. 按时间排序
  // 5. 调用 renderSessions() 渲染
}

/**
 * 修改现有的 viewSession() 函数
 * 区分本地和远程会话的 WebSocket 连接
 */
function viewSession(session) {
  // TODO: 修改现有函数支持远程会话
  // if (session.remote) {
  //   // 需要先 POST /api/servers/:serverId/sessions/:sessionId/terminal
  //   await fetch(`/api/servers/${session.serverId}/sessions/${session.id}/terminal`, {method: 'POST'});
  //   ws = new WebSocket(`ws://${host}/ws/ssh/${session.serverId}/${session.id}`);
  // } else {
  //   // 原有本地会话逻辑
  //   ws = new WebSocket(`ws://${host}/ws/terminal/${session.id}`);
  // }
}

/**
 * 修改会话渲染逻辑
 * 在会话卡片上显示远程/本地指示器
 */
function renderSessions(sessions) {
  // TODO: 修改现有渲染逻辑
  // 远程会话添加 .remote-session 类和 .remote-badge 标签
  // 显示服务器名称标签
}
```

### 4.3 TODO: CSS 样式

位置: `frontend/index.html` `<style>` 标签内

```css
/* === 服务器列表样式 === */
.servers-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.server-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--surface-dark);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.server-tag:hover {
  border-color: var(--accent-primary);
}

.server-tag .server-name {
  font-weight: 500;
  color: var(--text-primary);
}

.server-tag .server-host {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.server-tag .server-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.server-tag .server-status.connected {
  background: #22c55e; /* green-500 */
  box-shadow: 0 0 4px #22c55e;
}

.server-tag .server-status.error {
  background: #ef4444; /* red-500 */
}

.server-tag .btn-delete-server {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 2px;
  font-size: 0.75rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.server-tag:hover .btn-delete-server {
  opacity: 1;
}

.server-tag .btn-delete-server:hover {
  color: #ef4444;
}

/* === 远程会话指示器 === */
.session-card.remote-session {
  border-color: var(--accent-primary);
  box-shadow: 0 0 8px rgba(var(--accent-primary-rgb), 0.2);
}

.session-card .remote-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  background: rgba(var(--accent-primary-rgb), 0.15);
  color: var(--accent-primary);
  border-radius: 3px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* === 添加服务器模态框 === */
/* 复用现有的 .edit-modal 样式，如需调整在此添加 */
```

---

## 5. 会话数据结构

### 5.1 本地会话
```json
{
  "id": "abc123def",
  "name": "Session Name",
  "status": "running",
  "startTime": "2026-03-16T10:00:00Z",
  "projectPath": "/home/user/project",
  "lastActivity": "2026-03-16T10:30:00Z",
  "duration": 1800,
  "tokenCount": 0
}
```

### 5.2 远程会话
```json
{
  "id": "xyz789abc",
  "name": "Remote Session Name",
  "status": "running",
  "startTime": "2026-03-16T10:00:00Z",
  "projectPath": "~/project",
  "lastActivity": "2026-03-16T10:30:00Z",
  "duration": 1800,
  "tokenCount": 0,
  "remote": true,
  "serverId": "my-server-01",
  "serverName": "Production Server"
}
```

---

## 6. 实现清单

### 6.1 已完成 ✅

- [x] `ssh-manager.js` - 完整的 SSH 连接管理模块
- [x] `server.js` - REST API 端点实现
- [x] `server.js` - WebSocket 路由支持 (本地 + SSH)
- [x] HTML - Servers Panel 结构
- [x] HTML - Add Server Modal 结构

### 6.2 待办 ⏳

**JavaScript 实现**:
- [ ] `loadServers()` - 加载并显示服务器列表
- [ ] `addServer()` - 添加新服务器
- [ ] `deleteServer()` - 删除服务器
- [ ] `testServerConnection()` - 测试 SSH 连接
- [ ] `openAddServerModal()` / `closeAddServerModal()` - 模态框控制
- [ ] `loadAllSessions()` - 整合本地和远程会话
- [ ] `viewSession()` - 支持远程会话终端连接

**CSS 样式**:
- [ ] 服务器列表样式
- [ ] 远程会话指示器 (青色 glow)
- [ ] 服务器连接状态样式
- [ ] 服务器标签样式

**测试**:
- [ ] SSH 连接测试
- [ ] 远程会话列表获取
- [ ] 远程终端功能
- [ ] 错误处理 (连接失败、认证失败等)

---

## 7. 技术要点

### 7.1 关键库

| 库 | 用途 |
|---|------|
| `ssh2` | Node.js SSH 客户端，支持 exec/shell/PTY |
| `node-pty` | 本地 PTY 创建 (已用于本地会话) |
| `ws` | WebSocket 服务器 |
| `xterm.js` | 浏览器终端渲染 (已集成) |

### 7.2 远程会话发现机制

```
1. SSH 连接到远程服务器
2. 执行 ls -la ~/.claude/session-env/
3. 读取 ~/.claude/history.jsonl 获取会话元数据
4. 解析并返回会话列表
```

### 7.3 PTY 会话生命周期

```
1. Client POST /api/servers/:id/sessions/:session/terminal
2. Server 创建 SSH shell PTY
3. Server 执行 claude --resume <session>
4. Server 返回 {status: "started"}
5. Client 连接 WebSocket /ws/ssh/:server/:session
6. Server 桥接 SSH stream ↔ WebSocket
7. 任一方断开时清理资源
```

---

## 8. 注意事项

### 8.1 安全
- 密码仅内存存储，页面刷新后需重新配置
- 建议后续支持 SSH key 认证

### 8.2 性能
- 每个远程会话保持一个 SSH 连接
- 连接断开时自动清理资源

### 8.3 兼容性
- 远程服务器必须安装 Claude Code CLI
- 远程服务器必须有 `~/.claude/` 目录结构

---

## 9. 后续优化方向

1. **SSH Key 认证** - 替代密码认证
2. **连接池** - 复用 SSH 连接
3. **会话持久化** - 服务器配置持久化 (不含密码)
4. **文件传输** - SCP/SFTP 文件上传下载
5. **端口转发** - 远程服务本地访问

---

## 10. 测试清单

### 10.1 功能测试

- [ ] **服务器管理**
  - [ ] 添加服务器（所有字段验证）
  - [ ] 删除服务器（确认对话框）
  - [ ] 服务器列表显示（不含密码）
  - [ ] 重复 ID 处理

- [ ] **连接测试**
  - [ ] 有效凭据连接成功
  - [ ] 无效密码提示认证失败
  - [ ] 无效主机提示连接失败
  - [ ] 超时处理（10秒）

- [ ] **会话列表**
  - [ ] 本地会话正常显示
  - [ ] 远程会话正确获取
  - [ ] 远程/本地标识正确
  - [ ] 空会话状态处理

- [ ] **终端功能**
  - [ ] 本地会话终端连接
  - [ ] 远程会话终端连接
  - [ ] 输入输出双向传输
  - [ ] 终端大小调整
  - [ ] 断开连接处理

### 10.2 边界情况

- [ ] 远程服务器无 Claude CLI
- [ ] 远程服务器无 ~/.claude/ 目录
- [ ] 网络中断后的重连
- [ ] 同时打开多个远程终端
- [ ] 页面刷新后服务器配置丢失（符合预期）

---

## 11. API 快速参考

### 11.1 REST 端点

```
GET    /api/servers              # 获取服务器列表
POST   /api/servers              # 添加服务器
DELETE /api/servers/:id          # 删除服务器
POST   /api/servers/:id/test     # 测试连接
GET    /api/servers/:id/sessions # 获取远程会话
POST   /api/servers/:serverId/sessions/:sessionId/terminal  # 启动终端
```

### 11.2 WebSocket 路径

```
/ws/terminal/:sessionId          # 本地会话
/ws/ssh/:serverId/:sessionId     # 远程会话
```

### 11.3 数据格式

**服务器配置 (POST /api/servers)**:
```json
{
  "id": "my-server",
  "name": "Production Server",
  "host": "192.168.1.100",
  "port": 22,
  "username": "admin",
  "password": "secret"
}
```

**会话对象 (含远程标记)**:
```json
{
  "id": "session-abc",
  "name": "My Session",
  "status": "running",
  "remote": true,
  "serverId": "my-server",
  "serverName": "Production Server"
}
```
