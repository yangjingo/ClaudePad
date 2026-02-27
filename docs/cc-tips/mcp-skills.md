# MCP 与 Skills 详解

MCP（Model Context Protocol）和 Skills 是扩展 Claude Code 能力的两大核心机制，两者相辅相成。

## 📖 概念对比

| 特性 | MCP | Skills |
|------|-----|--------|
| **本质** | 连接协议（如何连接） | 知识封装（连接后做什么） |
| **作用** | 提供外部工具/数据访问能力 | 封装工作流程和最佳实践 |
| **范围** | 跨模型通用 | 仅限 Claude Code |
| **开发者** | 工具开发者 | Claude Code 用户 |

**一句话理解**：MCP 是 USB 接口标准，Skills 是 USB 设备。

---

## 🔌 MCP（模型上下文协议）

### 什么是 MCP？

MCP 是一个开放协议，让 AI 模型能够安全地连接外部工具和数据源。

```
用户 → Claude → MCP 客户端 → MCP 服务器 → 外部工具（数据库/API/文件等）
```

### 常用 MCP 服务器

| 名称 | 功能 | 安装命令 |
|------|------|----------|
| **MySQL** | 数据库操作 | `claude mcp add mysql npx @benborla29/mcp-server-mysql` |
| **Playwright** | 浏览器自动化 | `claude mcp add playwright npx @playwright/mcp@latest` |
| **GitHub** | GitHub 操作 | `claude mcp add github npx @anthropic-ai/mcp-github` |
| **Puppeteer** | 网页抓取 | `claude mcp add puppeteer npx @anthropic-ai/mcp-puppeteer` |

### MCP 配置示例

在项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": ["@benborla29/mcp-server-mysql"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "password",
        "MYSQL_DATABASE": "test"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["@playwright/mcp@latest"]
    }
  }
}
```

### MCP 管理命令

```bash
# 列出已配置的 MCP
claude mcp

# 添加 MCP
claude mcp add <name> <command>

# 移除 MCP
claude mcp remove <name>
```

---

## 🎯 Skills（技能包）

### 什么是 Skill？

Skill 是一组打包的指令，教 Claude 如何处理特定任务或工作流。

### Skill 的结构

```
my-skill/
├── SKILL.md          # 必需：指令和元数据
├── scripts/          # 可选：可执行脚本
├── references/       # 可选：参考文档
└── assets/           # 可选：模板资源
```

### SKILL.md 格式

```markdown
---
name: my-skill-name
description: 描述该 Skill 的功能和使用场景
---

# Skill 名称

## 使用场景
- 场景 1：什么时候使用
- 场景 2：适用条件

## 执行步骤
1. 步骤一
2. 步骤二
3. 步骤三

## 示例
输入：用户请求示例
输出：期望的执行结果

## 注意事项
- 重要提示 1
- 重要提示 2
```

### Skill 存放位置

| 级别 | 路径 | 范围 |
|------|------|------|
| 个人级 | `~/.claude/skills/<skill-name>/` | 所有项目 |
| 项目级 | `.claude/skills/<skill-name>/` | 仅当前项目 |
| 企业级 | 管理控制台配置 | 组织内所有用户 |

### 官方 Skills

Anthropic 官方提供了一系列 Skills：

```bash
# 注册官方 Skills 市场
/plugin marketplace add anthropics/skills

# 安装文档处理 Skills
/plugin install document-skills

# 安装前端设计 Skill
/plugin install frontend-design
```

常用官方 Skills：

| Skill | 功能 |
|-------|------|
| `frontend-design` | 创建高质量前端界面 |
| `docx` | 处理 Word 文档 |
| `pptx` | 创建演示文稿 |
| `xlsx` | 处理电子表格 |
| `pdf` | 处理 PDF 文档 |
| `skill-creator` | 创建新 Skill 的向导 |
| `mcp-builder` | 创建 MCP 服务器的向导 |

### 自定义 Skill 示例

创建一个代码审查 Skill：

```bash
mkdir -p ~/.claude/skills/code-review
cat > ~/.claude/skills/code-review/SKILL.md << 'EOF'
---
name: code-review
description: 代码审查专家，分析代码质量、安全问题和最佳实践
---

# 代码审查 Skill

## 审查清单
- [ ] 代码风格是否符合项目规范
- [ ] 是否有潜在的安全漏洞
- [ ] 错误处理是否完善
- [ ] 是否有适当的注释和文档
- [ ] 性能是否可优化

## 审查步骤
1. 读取相关代码文件
2. 检查代码规范和风格
3. 识别潜在 bug 和安全问题
4. 提出改进建议
5. 总结审查结果

## 输出格式
```
## 审查结果

### 问题列表
1. [严重性] 问题描述 + 建议修复

### 优点
- 代码的亮点

### 建议
- 改进建议
```
EOF
```

---

## 🔗 MCP + Skills 协同

### 协同工作示例

**场景**：生成数据库报表并发送邮件

```
用户：生成本月销售报表并发送给团队

Claude:
1. 加载"报表生成" Skill
2. 通过 MCP 连接 MySQL 查询数据
3. 通过 MCP 连接邮件服务发送报表
4. 按 Skill 规定的格式输出结果
```

### 创建基于 MCP 的 Skill

```markdown
---
name: db-report
description: 连接数据库生成报表，需要 MySQL MCP
---

# 数据库报表 Skill

## 前置要求
- MySQL MCP 已配置
- 有数据库读取权限

## 执行流程
1. 使用 MCP MySQL 工具查询数据
2. 分析数据并生成图表
3. 格式化为 Markdown 报表

## SQL 模板
```sql
-- 月度销售统计
SELECT
  DATE_FORMAT(created_at, '%Y-%m') as month,
  SUM(amount) as total_sales,
  COUNT(*) as order_count
FROM orders
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
GROUP BY month
ORDER BY month;
```
```

---

## 💡 最佳实践

### MCP 最佳实践

1. **安全配置**：敏感信息使用环境变量
2. **权限最小化**：只授予必要的权限
3. **本地优先**：优先使用本地 MCP 服务器
4. **版本锁定**：指定 MCP 服务器版本

### Skills 最佳实践

1. **描述清晰**：description 要准确描述触发条件
2. **渐进式加载**：使用 YAML frontmatter 控制加载
3. **可组合**：设计时考虑与其他 Skills 配合
4. **持续迭代**：根据使用效果不断优化

---

## 📚 参考资源

- [MCP 官方文档](https://modelcontextprotocol.io/)
- [官方 Skills 仓库](https://github.com/anthropics/skills)
- [MCP 服务器列表](https://github.com/modelcontextprotocol/servers)
