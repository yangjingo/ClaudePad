# CLI 命令与快捷键指南

> Claude Code 命令行工具的快速参考手册

## 📋 命令分类

### 基础命令

| 命令 | 描述 | 示例 |
|------|------|------|
| `claude` | 启动交互式 REPL | `claude` |
| `claude "query"` | 带初始提示启动 | `claude "explain this project"` |
| `claude -p "query"` | 打印模式（非交互） | `claude -p "explain this function"` |
| `claude -c` | 继续最近对话 | `claude -c` |
| `claude -r "name"` | 按名称恢复会话 | `claude -r "auth-refactor"` |
| `claude update` | 更新到最新版 | `claude update` |

### 权限模式切换

使用 `Shift + Tab` 在以下模式间切换：

| 模式 | 指示符 | 说明 |
|------|--------|------|
| **默认模式** | 无 | 每次操作需确认 |
| **自动模式** | `⏵⏵ accept edits on` | 自动接受编辑 |
| **计划模式** | `⏸ plan mode on` | 先规划再执行 |

### 符号命令

| 符号 | 用途 | 示例 |
|------|------|------|
| `!` | Bash 模式 | `!git status` |
| `/` | 斜杠命令 | `/clear` |
| `@` | 引用文件/目录 | `@src/utils.js` |
| `&` | 后台运行 | `&` |

## ⌨️ 快捷键大全

### 输入编辑

| 快捷键 | 功能 |
|--------|------|
| `Esc + Esc` | 清除所有输入 |
| `Shift + Enter` | 换行 |
| `Ctrl + S` | 暂存提示词 |

### 视图控制

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + O` | 切换详细输出 |
| `Shift + Tab` | 切换权限模式 |

### 历史与撤销

| 快捷键 | 功能 |
|--------|------|
| `Ctrl + _` | 撤销上次操作 |
| `Ctrl + Z` | 暂停 Claude |

### 其他

| 快捷键 | 功能 |
|--------|------|
| `Cmd + V` (Mac) / `Ctrl + V` (Linux) | 粘贴图片 |
| `Option + T` (Mac) / `Alt + T` (Win/Linux) | 切换思考模式 |

## 🔧 常用 CLI 标志

### 权限控制

```bash
# 以计划模式启动
claude --permission-mode plan

# 跳过所有权限提示（谨慎使用）
claude --dangerously-skip-permissions

# 指定允许的工具
claude --allowedTools "Bash(git log *)" "Edit"

# 限制可用工具
claude --tools "Bash,Edit,Read"
```

### 会话管理

```bash
# 指定会话 ID
claude --session-id "550e8400..."

# 恢复时创建新分支
claude --resume abc123 --fork-session

# 从 PR 恢复会话
claude --from-pr 123

# 禁用会话持久化
claude -p --no-session-persistence "query"
```

### 输出控制

```bash
# JSON 输出格式
claude -p "query" --output-format json

# 流式 JSON
claude -p "query" --output-format stream-json

# 详细日志
claude --verbose

# 调试模式
claude --debug "api,mcp"
```

### 模型与配置

```bash
# 指定模型
claude --model sonnet
claude --model opus

# 加载自定义设置
claude --settings ./settings.json

# 附加系统提示
claude --append-system-prompt "Always use TypeScript"
```

### MCP 与代理

```bash
# 从 JSON 加载 MCP 配置
claude --mcp-config ./mcp.json

# 仅使用指定 MCP 配置
claude --strict-mcp-config --mcp-config ./mcp.json

# 动态定义子代理
claude --agents '{"reviewer":{"description":"...","prompt":"..."}}'
```

## 📁 文件引用

### 引用语法

```
# 引用文件
@src/utils/auth.js

# 引用目录
@src/components

# 引用 MCP 资源
@github:repos/owner/repo/issues

# 多文件引用
@file1.js and @file2.js
```

### 注意事项

- 文件路径可以是相对或绝对路径
- 引用文件会自动加载其目录及父目录的 CLAUDE.md
- 目录引用显示文件列表而非内容

## 💡 实用技巧

### 1. 管道输入输出

```bash
# 分析日志
cat error.log | claude -p 'explain this error'

# 生成代码并保存
claude -p 'generate a python fibonacci function' > fib.py

# 作为 linter 使用
claude -p 'review this code for typos' < file.js
```

### 2. Git 集成

```bash
# 审查变更
git diff | claude -p 'review these changes'

# 生成提交信息
git diff --staged | claude -p 'write a commit message'
```

### 3. 多工作目录

```bash
# 添加额外工作目录
claude --add-dir ../lib ../shared
```

### 4. 后台任务

```bash
# 在后台运行任务
claude -p "long running task" &
```

## 🎯 配置示例

### 项目级设置 (`.claude/settings.json`)

```json
{
  "permissions": {
    "defaultMode": "plan",
    "allow": [
      "Edit",
      "Bash(git commit:*)",
      "Bash(git push:*)"
    ]
  },
  "env": {
    "ANTHROPIC_MODEL": "claude-sonnet-4-6"
  }
}
```

### 用户级设置 (`~/.claude/settings.json`)

```json
{
  "permissions": {
    "allow": [
      "Bash(ls:*)",
      "Bash(cat:*)",
      "Read"
    ]
  }
}
```

---

> 💡 **提示**: 使用 `claude --help` 查看完整命令列表
