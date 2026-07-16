# ClaudePad 产品需求文档

**版本：** 2.2

**更新日期：** 2026-07-16

**发布基线：** ClaudePad 0.4.0

## 1. 产品定位

ClaudePad 是 Claude Code 的本地与远端工作台，将会话监控、Web Terminal、Ideas、Tips 和 Multi-Agent 交付视图集中在一个轻量 Web 应用中。

核心价值：

- 自动发现 `~/.claude` 中的会话，并显示状态、Token、持续时间和最近活动。
- 通过 xterm.js、WebSocket 与 node-pty 恢复和操作真实 Claude Code 会话。
- 通过 SSH 管理远端环境，并保持每个环境独立的配置与版本状态。
- 在 Sessions 与 Multi-Agent 之间传递会话上下文，让故障定位与协作演练连续发生。
- 使用原生 HTML/CSS/JavaScript 与 Node.js + TypeScript，保持部署和维护成本可控。

## 2. 信息架构

| 区域 | 路由 | 主要任务 |
| --- | --- | --- |
| Sessions | `/` | 查看本地/远端会话、刷新、配置、恢复终端、发起 Bug 修复 |
| Multi-Agent | `/playground.html` | 将会话映射到五个角色，在可探索地图中演练交付事件 |
| Terminal | `/terminal.html` | 恢复指定本地或远端会话 |
| Ideas | `/idea.html` | 本地记录、搜索、分类和归档想法 |
| Tips | `/tips.html` | 搜索、随机浏览和复制 Claude Code 技巧 |

顶部导航保留 Ideas、Tips 工具入口，并将 Sessions、Multi-Agent 组成紧凑的工作区 Tab。所有页面使用同一视觉主题与键盘焦点规范。

## 3. 功能需求

### 3.1 Sessions

- 自动加载本地会话，支持分页、缓存和手动刷新。
- 展示本地与远端运行环境，配置和版本状态互不混淆。
- 会话卡片支持键盘访问，并提供恢复终端与 `◈ 修复 Bug` 操作。
- 所有会话 ID、服务器 ID 在 DOM 和 URL 中必须转义或编码。
- 空列表、加载失败和离线远端必须提供明确的可恢复状态。

### 3.2 Web Terminal

- 通过 WebSocket 双向传输终端数据，窗口变化时同步尺寸。
- 本地会话使用 node-pty；远端会话通过 SSH 连接。
- 页面只能显示一次短暂的恢复状态；连接成功或失败后动画必须终止。
- 断开、错误和手动关闭均释放终端及连接资源。

### 3.3 Multi-Agent

- 从 URL 接收 `session` 与 `server`，优先绑定指定会话，再分配近期会话。
- 五个角色分别承担协调、分析、前端、后端、QA/DevOps 职责。
- 顶部进度条使用真实软件交付阶段术语。
- 大陆支持拖动、缩放、复位、随机种子和小地图导航。
- 事件模拟不得修改真实会话；终端入口仍需显式用户操作。
- 详细设计见 [PLAYGOUND.md](./PLAYGOUND.md)。

### 3.4 Ideas 与 Tips

- Ideas 使用浏览器本地存储，支持创建、搜索、状态流转、复制和删除。
- Tips 从随包静态数据加载，支持搜索、随机选择和复制。
- 两项工具在工作区视觉改版后必须继续保留。

### 3.5 Remote Environments

- 支持服务器的添加、编辑、测试、连接和移除。
- 支持密码与 SSH Key 认证；敏感配置不写入前端日志或文档截图。
- 远端 Session、Terminal、配置和版本请求必须携带明确的 server ID。

## 4. 非功能要求

- **兼容性**：Node.js 18+；现代 Chromium、Firefox 和 Safari。
- **性能**：首次页面可交互不依赖远端连接；会话读取使用缓存与分页。
- **安全**：静态文件路径限制在允许目录；动态标识不进入内联脚本；生产依赖不得存在已知高危漏洞。
- **可访问性**：键盘可达、可见焦点、合理的 ARIA 标签、支持减少动态效果。
- **发布质量**：构建、静态脚本解析、HTTP smoke、npm audit 与 npm pack 清单全部通过。

## 5. 技术架构

```text
Browser
  ├─ Sessions / Ideas / Tips / Multi-Agent (native HTML/CSS/JS)
  ├─ Terminal (xterm.js)
  └─ REST + WebSocket
         │
Node.js + TypeScript
  ├─ session cache and routes
  ├─ config / version / server routes
  ├─ terminal pool and WebSocket handlers
  └─ SSH manager
         │
  ~/.claude / Claude CLI / remote SSH hosts
```

## 6. 当前边界与后续方向

- Multi-Agent 当前是会话映射和交付可视化，不是分布式 Agent 调度器。
- Ideas 当前存储在单个浏览器中，不跨设备同步。
- 后续版本可增加 Agent 编排 API、事件持久化、更多终端审计与可配置角色，但不得破坏现有 Sessions 工作流。

## 7. 0.4.0 验收标准

- Sessions 与 Multi-Agent 双 Tab 联动，本地和远端会话均可传递。
- 地图支持平移、缩放、中央塔复位、随机大陆和小地图。
- Ideas、Tips、配置、版本检查和终端入口保持可用。
- 不再显示多余的 `RESUMING...`，底部连接动画不会无限运行。
- 生产依赖审计为 0，发布包不包含历史设计中间产物。
