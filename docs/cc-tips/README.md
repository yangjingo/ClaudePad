# Claude Code 使用技巧合集

> 本文档整理了 Claude Code 的实用技巧、最佳实践和高级用法，帮助提升开发效率。

## 📚 文档索引

| 文档 | 内容 | 适用场景 |
|------|------|----------|
| [cli-guide.md](./cli-guide.md) | CLI 命令和快捷键 | 日常操作参考 |
| [core-workflows.md](./core-workflows.md) | 核心工作流程 | 学习标准开发流程 |
| [advanced-tips.md](./advanced-tips.md) | 高级技巧与优化 | 提升效率的进阶用法 |
| [mcp-skills.md](./mcp-skills.md) | MCP 与 Skills 详解 | 扩展 Claude 能力 |
| [troubleshooting.md](./troubleshooting.md) | 常见问题解决 | 遇到问题查阅 |
| [best-practices.md](./best-practices.md) | 最佳实践总结 | 提升使用效果 |

## 🚀 快速开始

### 安装与启动

```bash
# 安装
npm install -g @anthropic-ai/claude-code

# 启动交互式会话
claude

# 一次性查询（非交互模式）
claude -p "你的问题"

# 恢复上次对话
claude --continue

# 按名称恢复特定会话
claude --resume 会话名称
```

### 三种聊天模式

| 模式 | 切换方式 | 特点 |
|------|----------|------|
| **默认模式** | Shift+Tab | 每次操作需确认，最安全 |
| **自动模式** | Shift+Tab | 自动执行编辑，适合信任的任务 |
| **计划模式** | Shift+Tab | 先制定计划再执行，适合复杂任务 |

## 💡 核心技巧速查

### 1. 文件引用
- `@文件路径` - 快速引用文件内容到对话
- `@目录路径` - 引用目录结构
- `@github:repos/owner/repo/issues` - 引用 MCP 资源

### 2. 快捷键
| 快捷键 | 功能 |
|--------|------|
| `Esc + Esc` | 清除输入 |
| `Shift + Tab` | 切换权限模式 |
| `Ctrl + O` | 查看详细输出 |
| `Shift + Enter` | 换行 |
| `Ctrl + _` | 撤销 |

### 3. 常用命令
| 命令 | 说明 |
|------|------|
| `/clear` | 清空会话上下文 |
| `/cost` | 查看当前会话费用 |
| `/rename` | 重命名会话 |
| `/resume` | 恢复历史会话 |
| `/model sonnet` | 切换到 Sonnet 模型（更便宜） |
| `/model opus` | 切换到 Opus 模型（更强） |
| `/init` | 初始化 CLAUDE.md |
| `/memory` | 编辑项目记忆文件 |

### 4. 模型选择策略

| 模型 | 价格 | 适用场景 |
|------|------|----------|
| **Sonnet** | $3/MTok 输入，$15/MTok 输出 | 90% 日常开发任务 |
| **Opus** | $15/MTok 输入，$75/MTok 输出 | 复杂架构、深度分析 |

**建议**: 默认使用 Sonnet，遇到复杂问题再切换到 Opus。

## 📝 CLAUDE.md - 项目配置

CLAUDE.md 是 Claude Code 的核心配置文件，放在项目根目录可自动加载：

```markdown
# CLAUDE.md

## 常用命令
- `npm run build`: 构建项目
- `npm run test`: 运行测试
- `npm run lint`: 代码检查

## 代码规范
- 使用 ES modules (import/export)
- 优先解构导入
- 函数使用 JSDoc 注释

## 工作流程
- 修改后运行类型检查
- 优先运行单个测试而非全量
- PR 前执行完整测试套件
```

**存放位置**（按优先级）：
1. 项目根目录 `.claude/CLAUDE.md`
2. 父目录（适合 monorepo）
3. 用户目录 `~/.claude/CLAUDE.md`

## 🔧 MCP 与 Skills

### MCP（模型上下文协议）
连接外部工具的通用标准：

```bash
# 添加 MySQL MCP
claude mcp add mysql npx @benborla29/mcp-server-mysql

# 添加 Playwright 浏览器自动化
claude mcp add playwright npx @playwright/mcp@latest

# 查看已配置的 MCP
claude mcp
```

### Skills（技能包）
封装可复用的工作流程：

```bash
# 查看可用 Skills
/skills

# 使用官方 Skills（需先安装）
# 1. 注册插件市场
/plugin marketplace add anthropics/skills

# 2. 安装 Skills
/plugin install document-skills
```

## 🎯 高效提示词技巧

### 1. 任务描述要具体
```
❌ 错误：生成一个登录页面
✅ 正确：生成一个 React 登录页面，包含表单验证、错误处理、响应式设计
```

### 2. 使用触发词激活深度思考
- `think` - 基础思考
- `think hard` - 深入分析
- `ultrathink` - 深度推理

### 3. 结构化提问
```
请分析这个功能的：
1. 技术实现方案
2. 潜在风险点
3. 测试策略
4. 性能考虑
```

### 4. 上下文管理
- 使用 `/clear` 定期清理避免 Token 溢出
- 使用 `@文件` 精确引用所需文件
- 复杂任务拆分为小步骤

## 💰 成本控制

1. **默认使用 Sonnet** 模型
2. **使用 `/cost`** 监控消耗
3. **精简 CLAUDE.md** 内容，避免过长
4. **及时 `/clear`** 清理不需要的上下文
5. **使用 `--max-budget-usd`** 限制预算：
   ```bash
   claude -p --max-budget-usd 5.00 "你的任务"
   ```

## 📖 推荐阅读顺序

1. 新手 → [cli-guide.md](./cli-guide.md) → [core-workflows.md](./core-workflows.md)
2. 进阶 → [advanced-tips.md](./advanced-tips.md)
3. 扩展 → [mcp-skills.md](./mcp-skills.md)
4. 排查 → [troubleshooting.md](./troubleshooting.md)
5. 提升 → [best-practices.md](./best-practices.md)

## 🔗 参考资源

- [官方文档](https://code.claude.com/docs)
- [官方 Skills 仓库](https://github.com/anthropics/skills)
- [Claude Code 插件](https://github.com/anthropics/claude-code)

---

*本文档持续更新，欢迎补充更多技巧！*
