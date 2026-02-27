# 核心工作流程

本文档介绍使用 Claude Code 进行日常开发的标准工作流程。

## 📋 标准开发流程

```
探索 → 规划 → 编码 → 验证 → 提交
```

### 1. 探索阶段

**目标**: 理解代码库结构和相关代码

```bash
# 获取项目概览
> give me an overview of this codebase

# 了解架构模式
> explain the main architecture patterns used here

# 查找特定功能相关代码
> find the files that handle user authentication

# 追踪执行流程
> trace the login process from front-end to database
```

**技巧**:
- 从广泛问题开始，逐步聚焦到具体领域
- 使用项目特有的术语
- 询问编码约定和模式

### 2. 规划阶段

**目标**: 制定详细的实现计划

```bash
# 进入计划模式（更安全）
# 按 Shift+Tab 切换到 Plan Mode

# 或启动时进入计划模式
claude --permission-mode plan

# 要求创建详细计划
> I need to refactor our authentication system to use OAuth2.
> Create a detailed migration plan.
```

**计划内容应包括**:
1. 当前状态分析
2. 目标状态描述
3. 具体实施步骤
4. 风险评估
5. 回滚方案

### 3. 编码阶段

**目标**: 按计划实现功能

```bash
# 基于计划执行
> implement step 1 of the plan

# 或一次性描述需求
> add user authentication with JWT tokens

# 使用特定技术栈
> create a React component for the login form using TypeScript
```

**编码最佳实践**:
- 小步提交，频繁验证
- 让 Claude 解释代码逻辑
- 要求添加必要的注释和文档

### 4. 验证阶段

**目标**: 确保代码质量

```bash
# 运行测试
> run tests for the auth module

# 类型检查
> run typecheck

# 代码审查
> review the authentication code for security issues

# 检查测试覆盖率
> check test coverage for the new code
```

### 5. 提交阶段

**目标**: 完成并提交代码

```bash
# 查看变更摘要
> summarize the changes I've made

# 创建提交
> commit the changes with a descriptive message

# 创建 PR
> create a pull request

# 或使用快捷命令
/commit-push-pr
```

## 🔄 特定场景工作流

### 调试流程

```bash
# 1. 分享错误信息
> I'm seeing this error: [粘贴错误]

# 2. 获取修复建议
> suggest a few ways to fix this

# 3. 应用修复
> fix the error using approach 2

# 4. 验证修复
> run the tests to verify the fix
```

### 重构流程

```bash
# 1. 识别待重构代码
> find deprecated API usage in our codebase

# 2. 获取重构建议
> suggest how to refactor utils.js to use modern features

# 3. 安全地应用更改
> refactor utils.js while maintaining the same behavior

# 4. 验证重构
> run tests for the refactored code
```

### 测试驱动开发 (TDD)

```bash
# 1. 编写测试（先失败）
> add tests for the new notification service

# 2. 确认测试失败
> run the new tests

# 3. 实现功能（使测试通过）
> implement the notification service to pass the tests

# 4. 重构优化
> refactor the implementation for better performance
```

### 文档编写流程

```bash
# 1. 识别未文档化的代码
> find functions without proper JSDoc comments

# 2. 生成文档
> add JSDoc comments to the undocumented functions

# 3. 审查和增强
> improve the documentation with more context and examples

# 4. 验证规范
> check if the documentation follows our project standards
```

## 🎯 高级工作流模式

### 多文件协同编辑

```bash
# 同时处理多个相关文件
> I need to modify a feature that involves:
> 1. ComponentA.js - view layer
> 2. ComponentB.js - business logic
> 3. api.js - data fetching
>
> Please analyze all three files and provide a unified solution
```

### 基于视觉目标的开发

```bash
# 使用截图指导实现
> Here's a screenshot of the UI design. Implement this component.

# 迭代优化
> Make the spacing match the design more closely

# 最终确认
> Compare the implementation with the screenshot
```

### 代码审查工作流

```bash
# 请求审查
> review my recent code changes

# 特定关注领域
> check the authentication code for security vulnerabilities

# 性能审查
> analyze this function for performance bottlenecks
```

## 📊 工作流效率技巧

### 1. 使用 Git Worktrees 并行开发

```bash
# 创建新 worktree
git worktree add ../project-feature-a -b feature-a

# 在隔离环境中工作
cd ../project-feature-a
claude

# 完成后清理
git worktree remove ../project-feature-a
```

### 2. 会话命名与管理

```bash
# 命名会话（便于后续恢复）
> /rename auth-refactor

# 按名称恢复
claude --resume auth-refactor

# 查看所有会话
claude --resume
```

### 3. 自定义命令（Skills）

```bash
# 创建常用命令
# 在项目 .claude/commands/ 目录下创建文件

# 例如：.claude/commands/run-tests
# 内容：npm run test -- --watch

# 使用自定义命令
> /run-tests
```

### 4. 管道集成

```bash
# 将 Claude 用作 Unix 工具
cat error.log | claude -p 'explain the root cause' > analysis.txt

# 代码审查脚本
git diff | claude -p 'review these changes and list any issues'

# 生成提交信息
git diff --staged | claude -p 'generate a conventional commit message'
```

## 🛡️ 安全最佳实践

### 1. 权限管理

```bash
# 使用计划模式处理不确定的任务
claude --permission-mode plan

# 预授权安全命令
/permissions add "Bash(git commit:*)"
/permissions add "Bash(git push:*)"

# 避免使用（除非完全信任）
# claude --dangerously-skip-permissions
```

### 2. 代码审查检查清单

请求 Claude 审查时关注：
- 安全漏洞（SQL 注入、XSS 等）
- 错误处理
- 输入验证
- 敏感信息泄露
- 性能问题

### 3. 验证循环

```bash
# 为 Claude 提供验证机制
> implement the feature and verify with tests

# 要求自我检查
> before finishing, verify that all edge cases are handled
```

## 📈 持续改进

### 更新 CLAUDE.md

```bash
# 在编码过程中记录新发现
# 按 # 键让 Claude 记录到 CLAUDE.md

# 定期审查和优化
> review the CLAUDE.md and suggest improvements
```

### 团队知识共享

1. 将 CLAUDE.md 提交到版本控制
2. 共享自定义 Skills
3. 记录常见错误和解决方案
4. 建立团队编码规范

## 🔗 相关文档

- [CLI 指南](./cli-guide.md) - 命令参考
- [高级技巧](./advanced-tips.md) - 进阶用法
- [MCP 与 Skills](./mcp-skills.md) - 扩展能力
- [故障排除](./troubleshooting.md) - 问题解决
