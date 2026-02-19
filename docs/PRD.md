好的！以下是 **ClaudePad** 的完整 PRD 文档，已整理为可直接使用的 Markdown 格式：

---

```markdown
# ClaudePad PRD (Product Requirements Document)

> 将 Claude Code 变为移动端友好的 Web 任务管理中心  
> 版本: v1.0  
> 日期: 2025-01-15

---

## 1. 产品概述

### 1.1 核心价值
解决 Claude Code 在 SSH 终端下的使用痛点：
- 终端刷新卡顿
- 手机屏幕太小，tmux 操作困难
- 无法直观管理多个任务

### 1.2 一句话描述
**ClaudePad** = Claude Code 的 Web 化任务管理器 + 移动端看板 + Git 自动集成

### 1.3 目标用户
- 使用 Claude Code 进行日常开发的工程师
- 需要在手机/iPad 上随时查看任务进度的用户
- 管理多个 Git 项目的开发者

---

## 2. 技术架构

| 层级 | 技术 | 说明 |
|:---|:---|:---|
| 前端 | HTML5 + TailwindCSS + Alpine.js | 零构建，原生开发 |
| 后端 | FastAPI (Python) | 异步支持，WebSocket |
| 存储 | 本地 JSON 文件 | 简单，可手动编辑 |
| 部署 | Uvicorn (0.0.0.0) | 局域网内手机可访问 |
| 集成 | Claude CLI + Git | 子进程调用 |

---

## 3. 核心功能

### 3.1 多 Git 项目管理

**自动检测：**
- 启动时检测当前目录是否为 Git 仓库
- 非仓库时弹出配置向导，提示输入项目路径
- 支持动态添加/删除/切换项目

**数据隔离：**
```
data/
├── projects.json              # 项目列表 & 当前项目
├── projects/
│   ├── project-a/
│   │   ├── tasks.json         # 任务数据
│   │   ├── outputs/           # Claude 输出日志
│   │   └── attachments/       # 附件
│   └── project-b/
│       └── ...
└── archive/                   # 已删除任务的日志归档
```

---

### 3.2 任务管理

**任务编号：** `YYYYMMDD-NNN`（如 `20250115-001`）

| 字段 | 说明 |
|:---|:---|
| id | 唯一编号 |
| title | 任务标题 |
| description | 详细描述 |
| status | 待开发 / 开发中 / 待 Review / 已完成 / 失败 / 已取消 |
| is_plan | 是否为 Plan 模式（标记）|
| prompt | 发送给 Claude 的完整指令 |
| attachments | 附件列表 |
| git_branch | 自动创建的分支名 |
| git_commits | 执行过程中的 commit 列表 |
| git_parent_commit | 任务开始时的 commit |
| output_file | 日志文件路径 |
| deleted | 软删除标记 |

**状态流转：**
```
创建 → 待开发 → 开发中 → 待 Review → 已完成
                    ↓         ↓
                  失败      已取消
```

---

### 3.3 移动端看板 (垂直堆叠)

**布局：**
- 6 个状态区块垂直排列
- 每个区块可折叠/展开
- 显示任务数量徽章
- 点击标题展开任务列表

**交互：**
- 移动端：下拉菜单变更状态（替代拖拽）
- 桌面端：支持拖拽排序
- 点击卡片进入任务详情

---

### 3.4 交互式 Claude 执行 (默认模式)

**WebSocket 实时通信：**

```javascript
// 连接
WS /ws/{project}/tasks/{task_id}

// 发送用户输入
→ {"type": "input", "content": "yes"}

// 接收 Claude 输出
← {"type": "output", "content": "...", "requires_input": true}

// 任务完成
← {"type": "complete", "git_commit": "abc123"}

// 错误
← {"type": "error", "message": "..."}
```

**界面：**
- 聊天式界面（类似微信）
- 底部固定输入框
- 显示"等待输入"状态提示
- 支持发送文件/截图

**输入检测：**
- 正则匹配常见提示符：`(Y/n)`, `[Enter]`, `?` 等
- 超时检测（10秒无输出）

---

### 3.5 Git 自动集成

| 时机 | 操作 |
|:---|:---|
| 创建任务 | `git checkout -b claude/{task_id}`，记录 parent_commit |
| Claude 修改代码 | 用户触发或自动检测 → `git add -A` → `git commit` |
| 任务完成 | 最终 commit，可选 checkout 回原分支 |

**提交信息格式：**
```
claude(20250115-001): {自动描述或用户输入}
```

---

## 4. API 设计

### 4.1 REST API

```
# 项目管理
GET    /api/projects
POST   /api/projects                    # {name, path}
PUT    /api/projects/{name}/switch
DELETE /api/projects/{name}

# 任务管理
GET    /api/{project}/tasks             # ?status=developing&keyword=xxx
POST   /api/{project}/tasks             # 创建任务
GET    /api/{project}/tasks/{id}
PUT    /api/{project}/tasks/{id}        # 更新信息
DELETE /api/{project}/tasks/{id}        # 软删除
POST   /api/{project}/tasks/{id}/status # 变更状态

# Claude 执行
POST   /api/{project}/tasks/{id}/start  # ?mode=interactive|batch
POST   /api/{project}/tasks/{id}/cancel

# 文件
GET    /api/{project}/tasks/{id}/output # 流式读取日志
POST   /api/upload                      # 上传附件
```

### 4.2 WebSocket API

```
WS /ws/{project}/tasks/{id}
```

**消息类型：**

| 方向 | 类型 | 说明 |
|:---|:---|:---|
| C→S | `input` | 用户输入文本 |
| C→S | `file` | 用户上传文件 |
| S→C | `output` | Claude 标准输出 |
| S→C | `stderr` | Claude 错误输出 |
| S→C | `requires_input` | 需要用户输入 |
| S→C | `git_commit` | 新的 commit 记录 |
| S→C | `complete` | 任务完成 |
| S→C | `error` | 执行错误 |
| S→C | `cancelled` | 任务已取消 |

---

## 5. 页面结构

```
/
├── /                              # 重定向到当前项目看板
├── /project/{name}                # 项目看板（垂直堆叠）
├── /project/{name}/task/{id}      # 任务详情（交互式终端）
├── /project/{name}/new            # 新建任务
├── /settings                      # 项目配置、Git 设置
└── /help                          # 使用说明
```

---

## 6. 界面设计

### 6.1 配色方案

| 用途 | 颜色 |
|:---|:---|
| 背景 | `#f5f5f4` (stone-100) |
| 卡片 | `#ffffff` |
| 主文字 | `#1c1917` (stone-900) |
| 次要文字 | `#78716c` (stone-500) |
| 边框 | `#e7e5e4` (stone-200) |

**状态标签色：**
- 待开发: `bg-gray-100 text-gray-700`
- 开发中: `bg-blue-100 text-blue-700`
- 待 Review: `bg-purple-100 text-purple-700`
- 已完成: `bg-green-100 text-green-700`
- 失败: `bg-red-100 text-red-700`
- 已取消: `bg-yellow-100 text-yellow-700`

### 6.2 移动端适配

- 视口: `width=device-width, initial-scale=1.0`
- 触摸目标最小 44px
- 支持 PWA (manifest.json + service worker)
- 底部安全区适配 (env(safe-area-inset-bottom))

---

## 7. 配置

**config.yaml:**

```yaml
server:
  host: "0.0.0.0"
  port: 8080
  
claude:
  command: "claude"           # 假设在 PATH 中
  timeout: 300                # 默认超时 5 分钟
  
git:
  auto_commit: true           # 自动提交修改
  commit_prefix: "claude"     # 提交信息前缀
  
app:
  default_mode: "interactive" # 默认交互式
  max_attachment_size: 5242880 # 5MB
  log_retention: "forever"    # 日志保留策略
```

---

## 8. 开发里程碑

| 阶段 | 功能 | 预计时间 |
|:---|:---|:---|
| **MVP** | 单项目、任务 CRUD、交互式执行、垂直看板 | 3 天 |
| **v0.2** | 多项目管理、Git 自动集成、附件上传 | +2 天 |
| **v0.3** | PWA 支持、状态拖拽、任务模板 | +2 天 |
| **v1.0** | 性能优化、完善错误处理、文档 | +3 天 |

---

## 9. 命名规范

| 类型 | 规范 |
|:---|:---|
| 项目目录 | 使用项目名（Git 仓库文件夹名）|
| 分支名 | `claude/{task_id}` 如 `claude/20250115-001` |
| 提交信息 | `claude({task_id}): {description}` |
| 日志文件 | `{task_id}.log` |
| API 路径 | 小写，连字符分隔 |

---

## 10. 后续扩展 (Backlog)

- [ ] 任务模板（常用 prompt）
- [ ] 定时任务 / 批处理模式
- [ ] 多语言支持
- [ ] 团队协作（多用户）
- [ ] 与 GitHub/GitLab PR 集成
- [ ] 任务统计与导出

---

## 附录

### A. 快速启动

```bash
# 安装
pip install fastapi uvicorn aiofiles

# 启动
python main.py

# 手机访问（同一局域网）
http://{电脑IP}:8080
```

### B. 技术参考

- FastAPI: https://fastapi.tiangolo.com/
- Alpine.js: https://alpinejs.dev/
- TailwindCSS: https://tailwindcss.com/

---

> Built with ❤️ for Claude Code users
```

---

已保存为 PRD 格式，你可以：
1. 复制到项目根目录的 `PRD.md`
2. 让 Claude Code 直接读取并基于此开发
3. 开发过程中随时调整，保持文档同步

需要我直接开始写代码框架吗？