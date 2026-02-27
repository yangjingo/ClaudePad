# Claude Code 最佳实践总结

> 基于 Anthropic 官方推荐和社区经验的实践指南

## 🎯 黄金法则

### 1. 先探索，后编码

```
❌ 错误做法：
"帮我实现用户登录功能"
（Claude 可能会在不理解现有架构的情况下直接写代码）

✅ 正确做法：
"先帮我理解一下这个项目的认证模块是如何设计的？"
"查看相关的文件，告诉我登录流程是怎样的"
"基于现有模式，添加 OAuth2 登录支持"
```

### 2. 使用 Plan Mode 规划复杂任务

对于任何涉及多文件修改的任务：

```bash
# 启动时进入计划模式
claude --permission-mode plan

# 或在会话中按 Shift+Tab 切换到 plan mode
```

好处：
- Claude 会先分析代码库，制定详细计划
- 你可以在执行前审查和调整计划
- 避免盲目修改导致的问题

### 3. 维护高质量的 CLAUDE.md

```markdown
# CLAUDE.md 最佳结构

## 项目概述
- 一句话描述项目
- 技术栈
- 核心架构

## 常用命令
（最常用的 3-5 个命令）

## 代码规范
（关键规范，不要超过 5 条）

## 注意事项
（项目特有的坑和解决方案）
```

**提示**：
- 保持简洁（建议 < 200 行）
- 使用强调词如"必须"、"重要"提升遵循度
- 定期用 Claude 优化 CLAUDE.md 内容

### 4. 命名你的会话

```bash
# 使用 /rename 给会话起有意义的名称
> /rename auth-refactor

# 之后可以通过名称恢复
claude --resume auth-refactor
```

好的命名：
- `auth-refactor` ✓
- `payment-integration` ✓
- `fix-memory-leak` ✓

差的命名：
- `fix bug` ✗（太笼统）
- `help` ✗（无意义）
- `test` ✗（太简单）

## 💡 提示工程技巧

### 技巧 1：提供上下文

```
❌ 帮我修复这个错误

✅ 我在运行 npm test 时遇到这个错误：
[错误信息]
这是测试文件：@tests/auth.test.js
这是被测试的代码：@src/auth.js
```

### 技巧 2：明确要求验证

```
添加用户注册功能。

要求：
1. 包含邮箱验证
2. 密码强度检查
3. 写入数据库前加密
4. 返回合适的错误信息

完成后运行测试验证。
```

### 技巧 3：使用增量开发

```
第一步：分析现有数据库 schema
第二步：设计用户表结构
第三步：实现数据访问层
第四步：实现 API 端点
第五步：添加测试

我们从第一步开始。
```

## 🔧 工具使用建议

### Bash 命令管理

**推荐配置**（添加到 `.claude/settings.json`）：

```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(npm test)",
      "Bash(npm run build)"
    ]
  }
}
```

### 文件编辑权限

对于信任的仓库，可以允许自动编辑：

```json
{
  "permissions": {
    "allow": [
      "Edit",
      "Write"
    ]
  }
}
```

⚠️ **警告**：仅在个人项目或已备份的仓库中启用

## 📊 性能优化

### Token 使用优化

| 做法 | 效果 |
|------|------|
| 使用 `@文件` 精确引用 | 避免加载不必要的内容 |
| 定期 `/clear` | 释放上下文空间 |
| 精简 CLAUDE.md | 减少固定开销 |
| 使用 Sonnet 模型 | 成本降低 80% |

### 响应速度优化

1. **小步快跑**：将大任务拆分为小步骤
2. **预加载知识**：使用 Skills 封装常用流程
3. **限制搜索范围**：指定具体目录或文件类型

## 🛡️ 安全实践

### 权限管理

```bash
# 安全的权限配置原则：

# 1. 默认拒绝所有修改操作
# 2. 按需添加允许列表
# 3. 敏感操作始终询问

# 查看当前权限
/permissions

# 添加允许的命令
/permissions allow Bash(git commit *)
```

### 敏感数据处理

```
❌ 不要：
"这是生产环境的数据库密码：xxx"

✅ 应该：
"使用环境变量 DB_PASSWORD 连接数据库"
```

## 🔄 团队协作

### 共享配置

将以下内容提交到版本控制：

```
.claude/
├── CLAUDE.md          # 项目规范
├── settings.json      # 共享权限配置
└── skills/            # 项目特定技能
```

### 代码审查工作流

```bash
# 创建代码审查 Skill
# .claude/skills/code-review/SKILL.md

---
name: code-review
description: 进行代码审查，检查安全、性能和风格问题
---

# 代码审查清单

## 安全检查
- [ ] 无硬编码密钥
- [ ] 输入验证
- [ ] SQL 注入防护

## 性能检查
- [ ] 无 N+1 查询
- [ ] 适当的索引使用

## 风格检查
- [ ] 符合项目规范
- [ ] 有适当的注释
```

## 📈 效率提升清单

### 每日使用

- [ ] 使用 `--continue` 快速恢复工作
- [ ] 用 `@` 快速引用文件
- [ ] 及时 `/rename` 命名会话
- [ ] 用 `/cost` 监控消耗

### 每周优化

- [ ] 检查并更新 CLAUDE.md
- [ ] 清理历史会话 `/resume` → 删除旧的
- [ ] 优化常用命令的权限配置

### 每月复盘

- [ ] 创建新的 Skills 封装重复工作流
- [ ] 评估 MCP 工具的使用效果
- [ ] 更新团队共享配置

## 🎓 进阶技巧

### 1. 多实例并行

使用 Git worktrees：

```bash
# 创建新的 worktree
git worktree add ../project-feature-a -b feature-a
git worktree add ../project-bugfix -b bugfix-123

# 在不同目录同时运行 Claude
cd ../project-feature-a && claude
cd ../project-bugfix && claude
```

### 2. 管道集成

```bash
# 作为代码审查工具
git diff main...HEAD | claude -p "审查这些更改，列出潜在问题"

# 作为文档生成器
cat src/api.js | claude -p "生成 API 文档" > api-docs.md

# 作为测试生成器
claude -p "为 @src/utils.js 生成单元测试" > src/utils.test.js
```

### 3. 自定义 Subagents

```bash
# 启动时定义自定义 agent
claude --agents '{
  "security-reviewer": {
    "description": "安全专家，检查代码安全漏洞",
    "prompt": "你是安全专家，专注于发现安全漏洞...",
    "tools": ["Read", "Grep", "Glob"]
  }
}'
```

## ❌ 常见反模式

### 1. 过度依赖

```
❌ 任何问题都问 Claude
✅ 先自己思考，Claude 用于验证和补充
```

### 2. 上下文污染

```
❌ 一个会话做多个不相关的任务
✅ 不同任务使用不同会话，或及时 /clear
```

### 3. 权限过于宽松

```
❌ 使用 --dangerously-skip-permissions
✅ 显式配置允许的命令列表
```

### 4. 忽视验证

```
❌ Claude 说完成了就相信
✅ 运行测试、检查代码、验证功能
```

## 📚 学习资源

- [官方最佳实践](https://www.anthropic.com/engineering/claude-code-best-practices)
- [社区技巧合集](https://github.com/affaan-m/everything-claude-code)
- [Skills 开发指南](https://github.com/anthropics/skills)

---

*记住：Claude Code 是增强你能力的工具，不是替代你思考的黑盒。最好的结果来自于人与 AI 的协作。*
