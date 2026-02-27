# 高级技巧与优化

本文档介绍 Claude Code 的高级用法和效率优化技巧。

## 🚀 效率提升技巧

### 1. 模型选择优化

| 场景 | 推荐模型 | 原因 |
|------|----------|------|
| 日常编码 | Sonnet | 成本低，速度快 |
| 复杂架构设计 | Opus | 推理能力强 |
| 代码审查 | Sonnet | 平衡性能与成本 |
| 调试复杂 Bug | Opus | 深度分析能力 |
| 生成文档 | Sonnet | 简单任务 |

**快速切换**:
```bash
# 切换到 Sonnet（默认）
> /model sonnet

# 切换到 Opus
> /model opus

# 查看当前模型
> /model
```

### 2. Token 优化策略

**减少 Token 消耗**:
1. 精简 CLAUDE.md 内容
2. 使用 `/clear` 清理不相关上下文
3. 精确引用文件（`@文件` 而非整个目录）
4. 分步骤处理复杂任务

**监控 Token 使用**:
```bash
# 查看当前会话消耗
> /cost

# 限制预算
claude -p --max-budget-usd 5.00 "任务"

# 限制对话轮数
claude -p --max-turns 10 "任务"
```

### 3. 上下文管理技巧

**精确控制上下文**:
```bash
# 只引用需要的文件
> @src/utils/auth.js 请解释这个文件的逻辑

# 引用多个文件进行对比
> @ComponentA.tsx 和 @ComponentB.tsx 有什么区别？

# 使用目录引用查看结构
> @src/components 目录结构是什么？
```

**清理上下文**:
```bash
# 清空对话历史（保留系统提示）
> /clear

# 精简模式（保留摘要）
> /compact

# 完全重新开始
> /exit 然后重新启动 claude
```

## 🔧 高级配置

### 1. 自定义系统提示

**追加到默认提示**:
```bash
# 交互模式
claude --append-system-prompt "Always use TypeScript"

# 打印模式
claude -p --append-system-prompt-file ./style-rules.txt "任务"
```

**完全替换提示**（谨慎使用）:
```bash
claude --system-prompt "You are a Python expert who only writes type-annotated code"
```

### 2. 权限配置

**配置文件方式**（推荐）:
```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Edit",
      "Bash(git commit:*)",
      "Bash(git push:*)"
    ],
    "deny": [
      "Bash(rm -rf *)"
    ]
  }
}
```

**命令行方式**:
```bash
claude --allowedTools "Edit" "Bash(git commit:*)"
```

**会话中动态修改**:
```bash
> /permissions add "Bash(git commit:*)"
> /permissions remove "Bash(rm -rf *)"
```

### 3. 输出格式控制

**结构化输出**（适合脚本）:
```bash
# JSON 格式
claude -p "分析这段代码" --output-format json > analysis.json

# 纯文本格式
claude -p "总结这个文件" --output-format text > summary.txt

# 流式 JSON（实时输出）
claude -p "解析日志" --output-format stream-json
```

**JSON Schema 验证**:
```bash
claude -p --json-schema '{
  "type": "object",
  "properties": {
    "issues": { "type": "array" },
    "severity": { "type": "string" }
  }
}' "审查这段代码"
```

## 🎨 提示词工程

### 1. 结构化提示模板

**功能实现模板**:
```
我需要实现 [功能描述]：

背景：
- [相关背景信息]

需求：
1. [具体需求 1]
2. [具体需求 2]

约束：
- [技术约束]
- [性能要求]

验收标准：
- [可验证的标准]
```

**代码审查模板**:
```
请审查这段代码：

重点关注：
1. 安全性（SQL 注入、XSS 等）
2. 错误处理
3. 性能问题
4. 代码可读性
5. 是否符合项目规范

请按以下格式输出：
- 问题级别：[严重/警告/建议]
- 位置：[文件：行号]
- 描述：[具体问题]
- 建议：[改进方案]
```

### 2. 触发词使用

| 触发词 | 效果 |
|--------|------|
| `think` | 基础思考 |
| `think hard` | 深入分析 |
| `think harder` | 更深度分析 |
| `ultrathink` | 最高级别思考 |

**示例**:
```
请 ultrathink 这个架构设计：
- 高并发场景下的性能优化
- 数据一致性保证
- 扩展性考虑
```

### 3. 多轮对话策略

**迭代细化**:
```
第一轮：给出初步方案
第二轮：优化特定部分
第三轮：处理边界情况
第四轮：最终验证
```

**快速修正**:
```bash
# 按 Esc 暂停当前操作
# 输入修正指令
# 或按 Ctrl+_ 撤销上一步
```

## 🔄 自动化与脚本化

### 1. 作为 Unix 工具使用

**代码审查脚本**:
```bash
#!/bin/bash
# code-review.sh

git diff main...HEAD | claude -p '
  You are a code reviewer.
  Review the changes and report:
  1. Any bugs or issues
  2. Security concerns
  3. Performance problems
  4. Style violations

  Format: Filename:Line - Description
' > review.txt

cat review.txt
```

**提交信息生成**:
```bash
#!/bin/bash
# commit-msg.sh

git diff --staged | claude -p '
  Generate a conventional commit message for these changes.
  Format: <type>(<scope>): <description>
  Types: feat, fix, docs, style, refactor, test, chore
' | git commit -F -
```

### 2. CI/CD 集成

**GitHub Actions 示例**:
```yaml
name: Claude Code Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Claude Code Review
        run: |
          npm install -g @anthropic-ai/claude-code
          git diff origin/main | claude -p '
            Review these changes and report any issues.
          '
        env:
          ANTHROPIC_AUTH_TOKEN: ${{ secrets.ANTHROPIC_TOKEN }}
```

### 3. 批量处理

**批量文件处理**:
```bash
# 批量加文档注释
find src -name "*.js" | while read file; do
  echo "$file" | claude -p '
    Add JSDoc comments to this file.
  ' > "$file.new" && mv "$file.new" "$file"
done
```

## 🧪 高级调试技巧

### 1. 复杂问题分析

**分层分析法**:
```
问题：[描述问题]

请分析：
1. 可能的原因（列出 3-5 个）
2. 每个原因的验证方法
3. 最可能的原因
4. 修复方案
5. 预防措施
```

**日志分析**:
```bash
cat app.log | claude -p '
  Analyze this log file:
  1. Identify all errors
  2. Find patterns
  3. Suggest root causes
  4. Recommend fixes
'
```

### 2. 性能分析

**代码性能审查**:
```
请分析这段代码的性能：
1. 时间复杂度
2. 空间复杂度
3. 瓶颈识别
4. 优化建议
5. 优化后的代码
```

**数据库查询优化**:
```
请优化这个查询：
1. 分析执行计划
2. 识别低效操作
3. 建议索引
4. 重写查询
```

## 📊 项目分析技巧

### 1. 代码库健康度检查

```bash
# 技术债务分析
> analyze the codebase for technical debt

# 依赖分析
> check for outdated dependencies and security vulnerabilities

# 测试覆盖率分析
> analyze test coverage and identify gaps

# 代码复杂度分析
> find the most complex functions in the codebase
```

### 2. 架构分析

```
请分析当前架构：
1. 架构模式识别
2. 模块依赖关系
3. 潜在的单点故障
4. 扩展性评估
5. 改进建议
```

## 🎯 个人效率提升

### 1. 快速启动配置

**Shell 别名**:
```bash
# ~/.bashrc 或 ~/.zshrc

alias cc='claude'
alias ccp='claude -p'
alias ccc='claude --continue'
alias ccs='claude --resume'
```

**项目快捷方式**:
```bash
# 进入项目自动启动 Claude
function ccd() {
  cd "$1" && claude
}
```

### 2. 常用提示词收藏

创建 `~/.claude/prompts/` 目录存放常用提示词：

```bash
# ~/.claude/prompts/code-review.txt
请审查这段代码，关注：
1. 功能正确性
2. 代码质量
3. 安全漏洞
4. 性能问题
5. 可维护性
```

使用方式:
```bash
claude -p --system-prompt-file ~/.claude/prompts/code-review.txt "@src/main.js"
```

### 3. 会话模板

为新项目创建标准会话：

```bash
# 1. 启动并命名
claude
> /rename project-setup

# 2. 初始化项目
> /init

# 3. 了解项目
> give me an overview

# 4. 保存会话
# 使用 --resume project-setup 恢复
```

## 🔗 相关文档

- [CLI 指南](./cli-guide.md) - 命令参考
- [核心工作流](./core-workflows.md) - 标准流程
- [MCP 与 Skills](./mcp-skills.md) - 扩展能力
- [故障排除](./troubleshooting.md) - 问题解决
