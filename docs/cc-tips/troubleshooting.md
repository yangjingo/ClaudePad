# 常见问题与解决方案

本文档整理 Claude Code 使用中的常见问题及解决方法。

## 🔧 安装问题

### 1. 安装失败 / 权限错误

**问题**：`npm install -g @anthropic-ai/claude-code` 失败

**解决**：
```bash
# 使用 sudo（macOS/Linux）
sudo npm install -g @anthropic-ai/claude-code

# 或使用 npx 免安装运行
npx @anthropic-ai/claude-code

# 检查 Node.js 版本（需要 >= 18）
node --version

# 升级 Node.js
# macOS
brew upgrade node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo bash -
sudo apt-get install -y nodejs
```

### 2. Windows 安装问题

**问题**：Windows 上安装后无法运行

**解决**：
```powershell
# 以管理员身份运行 PowerShell
# 设置 npm 忽略脚本（解决权限问题）
setx NPM_CONFIG_IGNORE_SCRIPTS true

# 重新安装
npm install -g @anthropic-ai/claude-code

# 添加 npm 全局路径到环境变量
# 路径通常为：C:\Users\<用户名>\AppData\Roaming\npm
```

---

## 🔐 认证问题

### 1. 登录失败 / 认证错误

**问题**：无法登录或提示认证错误

**解决**：
```bash
# 检查认证状态
claude auth status

# 重新登录
claude auth login

# 登出后重新登录
claude auth logout
claude auth login
```

### 2. API Key 配置

**问题**：使用 API Key 时连接失败

**解决**：
```bash
# 配置环境变量（macOS/Linux）
export ANTHROPIC_AUTH_TOKEN="sk-your-api-key"
export ANTHROPIC_BASE_URL="https://api.anthropic.com"

# 永久配置（添加到 ~/.bashrc 或 ~/.zshrc）
echo 'export ANTHROPIC_AUTH_TOKEN="sk-your-api-key"' >> ~/.zshrc
source ~/.zshrc

# Windows PowerShell
$env:ANTHROPIC_AUTH_TOKEN="sk-your-api-key"

# Windows 永久配置（系统环境变量）
setx ANTHROPIC_AUTH_TOKEN "sk-your-api-key"
```

### 3. 国内访问问题

**问题**：连接超时或无法访问

**解决**：
```bash
# 使用国内中转服务（示例）
export ANTHROPIC_BASE_URL="https://your-proxy-url.com"
export ANTHROPIC_AUTH_TOKEN="your-proxy-token"

# 或者在 settings.json 中配置
# ~/.claude/settings.json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://your-proxy-url.com",
    "ANTHROPIC_AUTH_TOKEN": "your-token"
  }
}
```

---

## 🐛 运行问题

### 1. 会话恢复失败

**问题**：`claude --continue` 无法恢复会话

**解决**：
```bash
# 查看可用会话
claude --resume

# 按 ID 恢复特定会话
claude --resume <session-id>

# 如果仍然失败，清除缓存
rm -rf ~/.claude/sessions/
```

### 2. 内存 / Token 超限

**问题**：上下文过长导致错误

**解决**：
```bash
# 在对话中使用 /clear 清理上下文
/clear

# 使用 /compact 保留摘要但清理历史
/compact

# 分批处理大文件
# 不要一次性引用整个目录，而是指定具体文件
```

### 3. 权限被拒绝

**问题**：Claude 无法执行某些操作

**解决**：
```bash
# 添加允许的命令
/permissions add Edit
/permissions add "Bash(git commit:*)"

# 或在启动时指定
claude --allowedTools "Edit,Bash(git:*)"

# 危险模式（不推荐长期使用）
claude --dangerously-skip-permissions
```

---

## 🔧 功能问题

### 1. MCP 无法连接

**问题**：MCP 服务器连接失败

**解决**：
```bash
# 检查 MCP 配置
claude mcp

# 重新添加 MCP
claude mcp remove <name>
claude mcp add <name> <command>

# 检查 MCP 服务器日志
# 查看详细错误信息
claude --debug mcp
```

### 2. Skills 未触发

**问题**：安装了 Skill 但未被使用

**解决**：
- 检查 Skill 的 `description` 是否准确描述了触发条件
- 确保 Skill 放在正确的目录（`~/.claude/skills/` 或 `.claude/skills/`）
- 使用 `/skills` 查看已加载的 Skills

### 3. IDE 集成失败

**问题**：无法连接到 VS Code 等 IDE

**解决**：
```bash
# 检查 IDE 集成状态
/ide

# 手动启用
/ide enable

# 确保 IDE 插件已安装
# VS Code 搜索 "Claude Code" 插件
```

---

## 💰 计费问题

### 1. 费用过高

**问题**：使用成本超出预期

**解决**：
```bash
# 查看当前会话费用
/cost

# 切换到更便宜的模型
/model sonnet

# 限制预算
claude -p --max-budget-usd 5.00 "任务"

# 优化 CLAUDE.md，减少上下文长度
# 定期使用 /clear 清理对话
```

### 2. 订阅问题

**问题**：无法使用或达到限额

**解决**：
```bash
# 查看使用情况
/usage

# 登录查看订阅状态
claude auth status

# 考虑升级计划或联系支持
```

---

## 🐍 Python/Node.js 相关问题

### 1. 虚拟环境识别

**问题**：Claude 无法识别虚拟环境

**解决**：
```bash
# 在 CLAUDE.md 中明确指定
## Python 环境
- 使用 venv: source venv/bin/activate
- Python 版本：3.11
- 包管理：pip

# 或者在对话中先说明
先激活虚拟环境：source venv/bin/activate
```

### 2. 包管理器选择

**问题**：Claude 使用了错误的包管理器

**解决**：
```bash
# 在 CLAUDE.md 中指定
## 包管理器
- 使用 pnpm（不是 npm 或 yarn）
- 安装命令：pnpm install
- 运行命令：pnpm dev

# 或使用环境变量
export CLAUDE_PACKAGE_MANAGER=pnpm
```

---

## 📝 其他问题

### 1. 输出太长被截断

**问题**：Claude 的输出被截断

**解决**：
```bash
# 要求分块输出
"请分批输出，每次输出一部分"

# 使用文件输出
"将结果保存到文件"

# 使用 -p 模式输出到文件
claude -p "任务" > output.txt
```

### 2. 中文显示问题

**问题**：中文乱码或显示异常

**解决**：
```bash
# 设置终端编码
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

# Windows PowerShell
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

### 3. 性能缓慢

**问题**：Claude 响应慢

**解决**：
- 检查网络连接
- 切换到 Sonnet 模型（更快更便宜）
- 使用 `/clear` 清理长对话
- 精简 CLAUDE.md 内容
- 避免一次性引用过多文件

---

## 🔍 调试技巧

### 启用调试模式

```bash
# 查看所有调试信息
claude --debug

# 查看特定类别的调试信息
claude --debug api,mcp

# 排除某些类别
claude --debug "!statsig,!file"
```

### 查看详细输出

```bash
# 交互模式下按 Ctrl+O 切换详细输出

# 打印模式下使用 --verbose
claude -p --verbose "任务"
```

### 诊断安装

```bash
# 运行诊断命令
/doctor

# 或命令行
claude --doctor
```

---

## 📞 获取帮助

### 官方支持

- [官方文档](https://code.claude.com/docs)
- [GitHub Issues](https://github.com/anthropics/claude-code/issues)
- [Discord 社区](https://discord.gg/claude-code)

### 社区资源

- [awesome-claude-code](https://github.com/awesome-claude-code)
- Reddit r/ClaudeAI

---

*遇到未列出的问题？请提交 Issue 补充！*
