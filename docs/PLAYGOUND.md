# Agent Playground - 设计与实现文档

## 概述

Agent Playground 是一个受 **Star-Office-UI** 和 **Pixel-Agents** 启发的软件开发团队可视化监控页面，集成 Zelda 主题图标，采用软件开发流程架构设计（Link 作为项目经理/技术负责人，四大 Champion 作为开发团队成员）。

**核心概念**: 将软件开发流程中的各个角色映射到塞尔达传说中的角色，实现游戏化的开发团队监控。

**角色映射**:
- **Link (♔)** - Project Manager / Tech Lead - 项目管理与架构决策
- **Revali (💨)** - Requirements Analyst - 需求分析与技术调研
- **Mipha (💚)** - Frontend / UX Designer - 前端开发与界面设计
- **Urbosa (⚡)** - Backend Developer - 后端开发与API构建
- **Daruk (🛡️)** - QA / DevOps Engineer - 测试验证与持续集成

**参考项目**:
- [Star-Office-UI](https://github.com/ringhyacinth/Star-Office-UI) - 游戏化界面设计
- [Pixel-Agents](https://github.com/pablodelucca/pixel-agents) - Agent 可视化与状态监控

**在线访问**: http://localhost:8080/playground.html

---

## 设计原则

### 1. 游戏化界面设计 (Star-Office-UI 风格)
- **角色化开发岗位**: 不同开发角色由不同游戏角色代表
- **像素艺术风格**: 使用复古像素艺术元素
- **沉浸式体验**: 通过游戏化视觉和交互提升开发体验
- **主题一致性**: 保持希卡之石主题（青铜色 + 青色）

### 2. 软件开发流程可视化 (Pixel-Agents 风格)
- **状态指示系统**: 直观展示开发阶段和任务状态
- **实时活动跟踪**: 显示每个开发角色的活动历史和任务
- **协作监控**: 展示团队间的协作流程和数据流转
- **动态交互**: 悬停效果、状态动画、实时更新

### 3. 主从架构设计
```
Link (Commander)
├── Mipha (Healer/Support)
├── Revali (Scout/Recon)
├── Urbosa (Assault/Power)
└── Daruk (Defense/Tank)
```

---

## 页面结构

```
playground.html
├── Header (导航栏)
├── Command Center Header (标题区)
├── Stats Bar (统计概览)
├── Main Dashboard
│   ├── Commander Panel (Link 主控)
│   │   ├── 大头像 + 王冠标识
│   │   ├── 统计数据 (Active/Tasks/Uptime/Load)
│   │   └── 控制按钮 (Deploy/Recall/Refresh/Simulate)
│   └── Sub-Agents Panel (四大 Champion)
│       └── 2x2 Grid Layout
│           ├── Mipha (💚 Healer)
│           ├── Revali (💨 Scout)
│           ├── Urbosa (⚡ Assault)
│           └── Daruk (🛡️ Defense)
└── Command Log (活动日志)
```

---

## 图标资源

### 路径
- **图标目录**: `/asserts/zelda-icon/`
- **数据目录**: `/asserts/data/`

### Agent 映射

| Agent | 图标文件 | 角色 | 类型标识 | 功能 |
|-------|----------|------|----------|------|
| **Link** | link.png | Hero | ♔ Commander | 主控/指挥 |
| Mipha | mipha.png | Champion | 💚 Healer | 治疗/支援 |
| Revali | revali.png | Champion | 💨 Scout | 侦察/飞行 |
| Urbosa | urbosa.png | Champion | ⚡ Assault | 攻击/雷电 |
| Daruk | darurk.png | Champion | 🛡️ Defense | 防御/护盾 |

### 状态指示器

| 状态 | 颜色 | 样式 |
|------|------|------|
| active | #00d4ff | 青色 + 脉冲动画 |
| idle | #666 | 灰色 + 静态 |
| busy | #ff9800 | 橙色 + 闪烁动画 |
| offline | #444 | 深灰 + 半透明 |

---

## 技术实现

### 1. 响应式布局 (CSS Grid + Flexbox)

```css
/* 主面板布局 */
.dashboard {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 24px;
}

/* 2x2 子 Agent 网格 */
.subagent-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 16px;
}

/* 响应式适配 */
@media (max-width: 900px) {
  .dashboard { grid-template-columns: 1fr; }
}

@media (max-width: 600px) {
  .subagent-grid { grid-template-columns: 1fr; }
}
```

### 2. 图标加载与错误处理

```html
<div class="agent-avatar">
  <img src="/asserts/zelda-icon/link.png"
       alt="Link"
       onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
  <div class="fallback-initial">L</div>
</div>
```

### 3. 动态状态更新

```javascript
// Agent 数据结构
const subAgents = [
  {
    id: 'mipha',
    name: 'Mipha',
    role: 'Healer / Support',
    type: 'healer',
    icon: '💚',
    avatar: '/asserts/zelda-icon/mipha.png',
    status: 'active', // active | idle | busy
    task: 'Healing Wave',
    progress: 78,
    tasksDone: 67,
    cpu: 32
  },
  // ... 其他 agents
];

// 模拟实时更新
function toggleSimulation() {
  setInterval(() => {
    subAgents.forEach(agent => {
      agent.cpu = Math.max(5, Math.min(95, agent.cpu + (Math.random() - 0.5) * 10));
      agent.progress = Math.max(0, Math.min(100, agent.progress + (Math.random() - 0.5) * 5));
    });
    renderSubAgents();
  }, 2000);
}
```

---

## 性能优化

### 1. 图片优化
- 使用 PNG 格式保持透明度
- 图标尺寸标准化：48px (显示) / 原始高分辨率
- CSS `object-fit: cover` 确保正确填充

### 2. 动画性能
- 使用 `transform` 和 `opacity` 实现动画
- 避免触发重排的属性
- 使用 `will-change` 提示浏览器优化

### 3. 内存管理
- 卡片使用 flex 布局约束高度
- 日志列表限制最大条目数 (20条)
- 响应式适配减少 DOM 节点

---

## 交互功能

| 功能 | 描述 |
|------|------|
| **Deploy All** | 激活所有子 Agent |
| **Recall All** | 召回所有子 Agent |
| **Refresh** | 刷新状态数据 |
| **Simulate** | 开/关实时模拟 |
| **Select All** | 选中所有 Agent |
| **Clear** | 清除选中状态 |
| **Card Click** | 选中/取消选中单个 Agent |

---

## 整合架构设计

本节描述如何将 Pixel Agents 的 FSM 状态机架构与塞尔达 Champion 角色体系进行深度整合，实现游戏化的 Agent 活动监控。

### 1. 整体架构

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Agent Playground 整合架构                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         数据层 (Data Layer)                              │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐ │   │
│  │  │  FileWatcher    │    │TranscriptParser │    │   AgentStateStore   │ │   │
│  │  │  - 三层监听      │    │  - JSONL解析    │    │  - 状态管理          │ │   │
│  │  │  - 增量读取      │───▶│  - 状态提取     │───▶│  - WebSocket推送     │ │   │
│  │  └─────────────────┘    └─────────────────┘    └─────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                       │                                         │
│                                       ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      游戏逻辑层 (Game Logic Layer)                        │   │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────┐ │   │
│  │  │ Character FSM   │    │ Pathfinding     │    │   Animation System  │ │   │
│  │  │  - IDLE/WALK/TYPE│   │  - BFS寻路       │   │  - 精灵动画          │ │   │
│  │  │  - 状态转换      │    │  - 座位分配      │   │  - 特效渲染          │ │   │
│  │  └────────┬────────┘    └─────────────────┘    └─────────────────────┘ │   │
│  └───────────┼────────────────────────────────────────────────────────────┘   │
│              │                                                                  │
│              ▼                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                      渲染层 (Render Layer) - 海拉鲁大陆                    │   │
│  │                                                                         │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │   │   Link      │  │   Mipha     │  │   Revali    │  │   Urbosa    │   │   │
│  │   │  (Commander)│  │  (Healer)   │  │  (Scout)    │  │  (Assault)  │   │   │
│  │   │   ♔ 主控    │  │   💚 支援   │  │   💨 侦察   │  │   ⚡ 攻击   │   │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  │                                                                         │   │
│  │   ┌─────────────────────────────────────────────────────────────────┐   │   │
│  │   │                      Daruk (Defense)                           │   │   │
│  │   │                      🛡️ 防御/护盾                              │   │   │
│  │   └─────────────────────────────────────────────────────────────────┘   │   │
│  │                                                                         │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 2. 角色映射方案

#### 2.1 软件开发流程映射

基于软件工程的标准开发流程，将 Champion 角色映射到各个开发阶段：

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     软件开发流程 - Champion 映射                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   📋 需求阶段 → 🔷 设计阶段 → 💻 开发阶段 → 🧪 测试阶段 → 🚀 部署阶段    │
│                                                                         │
│      Revali      Mipha        Urbosa       Daruk        Link           │
│     (侦察需求)   (设计界面)    (后端构建)    (质量保证)    (项目管理)      │
│        💨          💚           ⚡           🛡️          ♔              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

| 角色 | 开发角色 | 类型 | 职责定位 | 工作场景 |
|------|----------|------|----------|----------|
| **Link** | Project Manager / Tech Lead | Commander | 项目管理、架构决策、资源协调 | 制定计划、分配任务、监控进度 |
| **Revali** | Requirements Analyst | Champion | 需求分析、技术调研、可行性评估 | 阅读文档、分析需求、技术选型 |
| **Mipha** | Frontend Dev / UX Designer | Champion | 前端开发、UI/UX设计、用户体验优化 | 界面实现、交互设计、样式调整 |
| **Urbosa** | Backend Developer | Champion | 后端开发、数据库设计、API构建 | 业务逻辑、数据处理、服务构建 |
| **Daruk** | QA Engineer / DevOps | Champion | 测试验证、代码审查、质量保证 | 编写测试、执行验证、CI/CD |

#### 2.2 开发阶段到 Champion 映射

```javascript
// 开发阶段到 Champion 的映射规则
const DEV_PHASE_CHAMPION_MAP = {
  // 需求阶段 - Revali (侦察者)
  'requirement': 'revali',
  'analysis': 'revali',
  'research': 'revali',
  'investigation': 'revali',
  'documentation': 'revali',

  // 设计阶段 - Mipha (设计者)
  'design': 'mipha',
  'ui': 'mipha',
  'ux': 'mipha',
  'prototype': 'mipha',
  'styling': 'mipha',

  // 开发阶段 - Urbosa (构建者)
  'backend': 'urbosa',
  'api': 'urbosa',
  'database': 'urbosa',
  'logic': 'urbosa',
  'implementation': 'urbosa',

  // 测试阶段 - Daruk (守护者)
  'testing': 'daruk',
  'review': 'daruk',
  'qa': 'daruk',
  'validation': 'daruk',
  'security': 'daruk',

  // 管理阶段 - Link (指挥官)
  'planning': 'link',
  'coordination': 'link',
  'architecture': 'link',
  'deployment': 'link',
};

// 文件类型到 Champion 映射（开发场景）
const FILE_TYPE_CHAMPION_MAP = {
  // Revali - 需求/文档类
  '.md': 'revali',
  '.txt': 'revali',
  'README': 'revali',
  'PRD': 'revali',
  'SPEC': 'revali',

  // Mipha - 前端/UI类
  '.html': 'mipha',
  '.css': 'mipha',
  '.scss': 'mipha',
  '.tsx': 'mipha',
  '.jsx': 'mipha',
  '.vue': 'mipha',
  '.svg': 'mipha',
  '.png': 'mipha',

  // Urbosa - 后端/逻辑类
  '.py': 'urbosa',
  '.js': 'urbosa',
  '.ts': 'urbosa',
  '.go': 'urbosa',
  '.rs': 'urbosa',
  '.java': 'urbosa',
  '.sql': 'urbosa',
  '.json': 'urbosa',

  // Daruk - 测试/配置类
  '.test.js': 'daruk',
  '.spec.ts': 'daruk',
  '.test.py': 'daruk',
  'Dockerfile': 'daruk',
  '.yml': 'daruk',
  '.yaml': 'daruk',
  '.toml': 'daruk',
};

// 根据任务类型获取 Champion
function getChampionByTask(taskType) {
  return DEV_PHASE_CHAMPION_MAP[taskType] || 'link';
}

// 根据文件类型获取 Champion
function getChampionByFile(filename) {
  for (const [ext, champion] of Object.entries(FILE_TYPE_CHAMPION_MAP)) {
    if (filename.includes(ext)) return champion;
  }
  return 'link';
}
```

#### 2.3 角色详细设定

##### Link - Project Manager / Tech Lead ♔

```yaml
角色: 项目经理 / 技术负责人
图标: ♔ (王冠)
位置: 指挥中心 (Canvas 中心)
职责:
  - 项目规划与任务分解
  - 协调各 Champion 之间的工作
  - 技术架构决策
  - 进度监控与风险管理
  - 最终代码审查与合并

工作流:
  1. 接收用户需求
  2. 分解任务并分配给各 Champion
  3. 监控各阶段进度
  4. 解决跨阶段冲突
  5. 最终交付与部署

状态指示:
  - 🟢 Active: 正在协调项目
  - 🟡 Planning: 制定计划
  - 🔵 Reviewing: 审查代码
```

##### Revali - Requirements Analyst 💨

```yaml
角色: 需求分析师
图标: 💨 (风之标记)
位置: 左上角 (侦察位)
职责:
  - 阅读和分析需求文档
  - 技术可行性调研
  - 竞品分析与最佳实践研究
  - 编写技术规格说明书
  - 评估开发工作量

工作流:
  1. 阅读 PRD/需求文档
  2. 进行技术调研 (WebSearch, WebFetch)
  3. 分析现有代码库 (Grep, Glob, Read)
  4. 输出技术方案文档
  5. 参与技术评审

状态指示:
  - 🟢 Active: 正在分析需求
  - 🔵 Researching: 技术调研中
  - 🟡 Documenting: 编写文档
```

##### Mipha - Frontend Dev / UX Designer 💚

```yaml
角色: 前端开发 / UX设计师
图标: 💚 (治愈之心)
位置: 左下角 (设计位)
职责:
  - 用户界面设计与实现
  - 交互逻辑开发
  - CSS 样式与动画
  - 响应式适配
  - 用户体验优化

工作流:
  1. 根据设计稿实现 HTML/CSS
  2. 开发前端交互逻辑 (JS/TS/React)
  3. 优化页面性能与加载速度
  4. 处理浏览器兼容性
  5. 与 Backend 对接 API

状态指示:
  - 🟢 Active: 正在开发界面
  - 🎨 Designing: 设计 UI
  - 🔧 Refining: 优化样式
```

##### Urbosa - Backend Developer ⚡

```yaml
角色: 后端开发工程师
图标: ⚡ (雷电)
位置: 右下角 (构建位)
职责:
  - 业务逻辑实现
  - 数据库设计与操作
  - API 接口开发
  - 服务端性能优化
  - 系统架构实现

工作流:
  1. 设计数据库 Schema
  2. 实现核心业务逻辑
  3. 开发 RESTful/GraphQL API
  4. 编写单元测试
  5. 性能优化与缓存策略

状态指示:
  - 🟢 Active: 正在编写代码
  - ⚡ Building: 构建功能
  - 🔌 Integrating: 集成测试
```

##### Daruk - QA Engineer / DevOps 🛡️

```yaml
角色: 质量保证工程师 / DevOps
图标: 🛡️ (护盾)
位置: 右上角 (守护位)
职责:
  - 测试用例编写与执行
  - 代码审查与质量把控
  - CI/CD 流水线维护
  - 安全审计与漏洞修复
  - 自动化测试框架搭建

工作流:
  1. 根据需求编写测试用例
  2. 执行单元测试与集成测试
  3. 进行代码审查 (Code Review)
  4. 配置 CI/CD 流水线
  5. 监控生产环境稳定性

状态指示:
  - 🟢 Active: 正在测试
  - 🧪 Testing: 执行测试
  - 🔍 Reviewing: 代码审查
```

### 3. 状态机与动画设计

#### 3.1 FSM 状态映射

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Character State Machine                          │
│                        塞尔达主题状态映射                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────┐    assistant/tool_use      ┌─────────┐    到达座位      ┌─────────┐
│  │  IDLE   │ ─────────────────────────▶ │  WALK   │ ──────────────▶ │  TYPE   │
│  │ 休息    │                           │ 行走    │                  │ 工作    │
│  │         │ ◄───────────────────────── │         │ ◄────────────── │         │
│  │ - 站立  │   turn_duration/座位Timer  │ - 移动  │   工具完成      │ - 打字  │
│  │ - 呼吸  │        到期               │ - 寻路  │                  │ - 阅读  │
│  │ - 张望  │                           │ - 转向  │                  │ - 特效  │
│  └────┬────┘                           └────┬────┘                  └────┬────┘
│       │                                      │                            │
│       │ 漫游行为                              │                            │
│       ▼                                      │                            │
│  ┌─────────┐                                 │                            │
│  │ WANDER  │ ◄───────────────────────────────┘                            │
│  │ 随机漫游 │   空闲时随机探索海拉鲁大陆                                        │
│  └─────────┘                                                              │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘
```

#### 3.2 Champion 动画状态对应表 (开发场景)

| 状态 | Link (PM) | Revali (Analyst) | Mipha (Frontend) | Urbosa (Backend) | Daruk (QA) |
|------|-----------|------------------|------------------|------------------|------------|
| **IDLE** | 希卡石板待机 | 风之观察 | 设计稿预览 | 代码构思 | 测试待命 |
| **WALK** | 巡视项目 | 调研走访 | 界面调整 | 逻辑构建 | 测试执行 |
| **TYPE** | 编写计划 | 文档撰写 | 代码实现 | 后端编码 | 编写用例 |
| **Review** | 代码审查 | 需求评审 | UI走查 | API审核 | 质量把关 |

#### 3.3 开发任务动画细分

```javascript
// 根据开发任务类型返回对应动画
function getTaskAnimation(champion, task) {
  const RESEARCH_TASKS = ['requirement', 'analysis', 'research', 'documentation'];
  const DESIGN_TASKS = ['design', 'ui', 'ux', 'prototype'];
  const BUILD_TASKS = ['backend', 'api', 'database', 'logic'];
  const TEST_TASKS = ['testing', 'review', 'qa', 'validation'];

  // 需求分析类任务
  if (RESEARCH_TASKS.includes(task)) {
    return {
      revali: 'wind_survey',      // 风之调研
    }[champion];
  }

  // 设计类任务
  if (DESIGN_TASKS.includes(task)) {
    return {
      mipha: 'graceful_design',   // 优雅设计
    }[champion];
  }

  // 开发类任务
  if (BUILD_TASKS.includes(task)) {
    return {
      urbosa: 'thunder_code',     // 雷电编码
    }[champion];
  }

  // 测试类任务
  if (TEST_TASKS.includes(task)) {
    return {
      daruk: 'shield_guard',      // 护盾守护
    }[champion];
  }

  // 管理类任务
  return {
    link: 'command_wave',         // 指挥波动
  }[champion];
}
```

### 4. 实时数据流设计

#### 4.1 消息协议扩展

```typescript
// 扩展 Pixel Agents 消息协议，添加 Champion 信息
interface ExtensionMessage {
  type: 'agentCreated' | 'agentClosed' | 'agentToolStart' |
        'agentToolDone' | 'agentToolsClear' | 'agentStatus' |
        'agentToolPermission' | 'subagentToolStart' | 'layoutLoaded';
  id: number;
  toolId?: string;
  status?: string;
  parentToolId?: string;

  // 新增：Champion 映射 (开发流程)
  championType?: 'link' | 'revali' | 'mipha' | 'urbosa' | 'daruk';
  devPhase?: 'planning' | 'analysis' | 'design' | 'development' | 'testing' | 'deployment';

  // 新增：游戏化状态
  activity?: {
    type: string;
    target: string;
    progress: number;
  };
}
```

#### 4.2 状态同步时序

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Claude Code │     │  Extension  │     │   Webview   │     │  Character  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │                   │
       │ 1. tool_use       │                   │                   │
       │──────────────────▶│                   │                   │
       │                   │ 2. 识别工具类型    │                   │
       │                   │    → 分配Champion │                   │
       │                   │                   │                   │
       │                   │ 3. subagentToolStart
       │                   │    + championType │                   │
       │                   │──────────────────▶│                   │
       │                   │                   │ 4. spawnCharacter │
       │                   │                   │    (Mipha/Revali) │
       │                   │                   │──────────────────▶│
       │                   │                   │                   │ [出场动画]
       │                   │                   │                   │
       │ 5. tool_result    │                   │                   │
       │──────────────────▶│                   │                   │
       │                   │ 6. agentToolDone  │                   │
       │                   │──────────────────▶│                   │
       │                   │                   │ 7. 播放完成特效    │
       │                   │                   │    Matrix数字雨   │
       │                   │                   │──────────────────▶│
       │                   │                   │                   │ [退场动画]
       │                   │                   │                   │
```

#### 4.3 数据转换层

```javascript
// 将 JSONL 记录转换为游戏状态
class GameStateAdapter {
  convertToCharacterState(agentState) {
    const champion = this.mapToolToChampion(agentState.currentTool);

    return {
      id: agentState.id,
      championType: champion,
      state: this.mapAgentStateToCharacterState(agentState),
      position: this.getSeatPosition(champion),
      activity: {
        tool: agentState.currentTool,
        target: agentState.toolTarget,
        progress: agentState.progress,
      },
      // 塞尔达主题配色
      theme: CHAMPION_THEMES[champion],
    };
  }

  mapToolToChampion(tool) {
    return TOOL_CHAMPION_MAP[tool] || 'link';
  }

  mapAgentStateToCharacterState(agent) {
    if (agent.activeToolIds?.size > 0) return 'TYPE';
    if (agent.isWalking) return 'WALK';
    return 'IDLE';
  }
}
```

### 5. 游戏化 UI 组件设计

#### 5.1 主界面布局 (开发流程版本)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│  🏰 Agent Playground - Sheikah Slate Interface         [Live] ◉ 在线          🔔 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────────┐ │
│  │                           Hyrule Map (Canvas)                             │ │
│  │                                                                           │ │
│  │    ┌─────┐      🦅 Revali                ⚡ Urbosa     ┌─────┐          │ │
│  │    │     │        (Scout)                 (Assault)    │     │          │ │
│  │    │  🏰 │         💨                        ⚡         │ 🏰  │          │ │
│  │    │Link │                                              │Daruk│          │ │
│  │    │ ♔   │                                              │ 🛡️  │          │ │
│  │    └─────┘                                              └─────┘          │ │
│  │                                                                           │ │
│  │                   💚 Mipha                                                │ │
│  │                  (Healer)                                                 │ │
│  │                    💚                                                     │ │
│  │                                                                           │ │
│  │    [Walk Path]  ═══════════════════════                                   │ │
│  │    [Active Tool]  Reading: README.md [████░░░░░░] 45%                     │ │
│  │                                                                           │ │
│  └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  ┌──────────────────────────┐  ┌─────────────────────────────────────────────┐ │
│  │    Champion Status       │  │        Activity Log                         │ │
│  │  ┌──────┬──────┬────────┐│  │  14:32:25  Urbosa ⚡ Write: config.json     │ │
│  │  │💚x12 │💨x5  │⚡x8   ││  │  14:32:20  Revali 💨 Grep: auth logic      │ │
│  │  │Mipha │Revali│Urbosa ││  │  14:32:15  Mipha  💚 Edit: fix bug         │ │
│  │  └──────┴──────┴────────┘│  │  14:32:10  Daruk  🛡️ Test: passing        │ │
│  │       🛡️x3              │  │  14:32:05  Link   ♔  Task: complete        │ │
│  │      Daruk              │  │                                             │ │
│  │  ┌────────────────────┐  │  │  [Command Input...]                         │ │
│  │  │  🎮 Quick Actions  │  │  │  > deploy all                               │ │
│  │  │ [Deploy] [Recall]  │  │  └─────────────────────────────────────────────┘ │
│  │  │ [Refresh][Simulate]│  │                                                  │
│  │  └────────────────────┘  │                                                  │
│  └──────────────────────────┘                                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### 5.2 特效系统 (开发场景)

```javascript
// Champion 特效配置 - 软件开发主题
const CHAMPION_EFFECTS = {
  // 入场特效 - Matrix 代码雨 (代表代码)
  spawn: (champion) => {
    return new MatrixRainEffect({
      color: CHAMPION_COLORS[champion],
      duration: 300,
      chars: '01<>/;{}[]' // 代码字符
    });
  },

  // 出场特效 - 希卡传送
  despawn: (champion) => {
    return new SheikahTeleportEffect({
      color: CHAMPION_COLORS[champion]
    });
  },

  // 工作状态特效
  active: {
    revali: 'wind_survey',      // 风之调研 - 需求分析
    mipha:  'design_sparkle',   // 设计闪光 - UI设计
    urbosa: 'code_thunder',     // 代码雷电 - 后端开发
    daruk:  'shield_guard',     // 护盾守护 - QA测试
  },

  // 开发阶段特效
  phaseEffects: {
    requirement: 'document_scan',  // 文档扫描
    design:      'ui_wireframe',   // UI线框
    development: 'code_matrix',    // 代码矩阵
    testing:     'test_pulse',     // 测试脉冲
    deployment:  'deploy_wave',    // 部署波纹
  }
};
```

---

## 文件清单

```
ClaudePad/
├── frontend/
│   └── playground.html          # 主页面
├── asserts/
│   ├── zelda-icon/
│   │   ├── link.png             # Link 图标
│   │   ├── mipha.png            # Mipha 图标
│   │   ├── revali.png           # Revali 图标
│   │   ├── urbosa.png           # Urbosa 图标
│   │   └── darurk.png           # Daruk 图标
│   └── data/
│       └── tips.json            # 应用数据
├── docs/
│   └── AGENTS.md                # 本文档
└── server.js                    # 路由配置
```

---

## 扩展建议

### 功能路线图 (开发流程版本)

| 阶段 | 功能 | 描述 | 优先级 |
|------|------|------|--------|
| **MVP** | 基础开发团队监控 | Link (PM) + 4 人开发团队角色显示 | P0 |
| **v0.2** | 开发阶段映射 | 需求→设计→开发→测试 流程可视化 | P0 |
| **v0.3** | Canvas 动画 | FSM 状态机动画 + 团队协作路径 | P1 |
| **v0.4** | 特效系统 | Matrix 代码雨 + 开发阶段特效 | P1 |
| **v0.5** | Sprint 统计 | 燃尽图 + 团队效率分析 | P2 |
| **v1.0** | 实时同步 | WebSocket + CI/CD 集成 | P2 |

### 未来功能

1. **WebSocket 实时通信** - 后端真实数据推送，实现毫秒级状态同步
2. **任务分配系统** - Link 向子 Agent 分配具体任务，可视化任务流转
3. **历史统计图表** - CPU/内存使用趋势，Champion 工作效率分析
4. **主题切换** - 多种游戏主题皮肤（马里奥、宝可梦等）
5. **Agent 配置** - 自定义每个 Champion 的参数和触发规则
6. **音效系统** - Champion 出场/退场/技能音效
7. **移动端适配** - 触摸操作优化，PWA 离线支持

### API 设计 (未来)

```javascript
// Agent 管理 API
GET    /api/agents                    # 获取所有 Agent 状态
GET    /api/agents/:id                # 获取单个 Agent 详情
POST   /api/agents/:id/control        # 控制 Agent (start/stop/pause)
GET    /api/agents/:id/logs           # 获取 Agent 日志

// Champion 管理 API
GET    /api/champions                 # 获取所有 Champion 状态
GET    /api/champions/:type/stats     # 获取 Champion 统计
POST   /api/champions/:type/assign    # 分配任务给 Champion

// 实时通信
WS     /ws/agents                     # Agent 状态实时推送
WS     /ws/champions                  # Champion 活动实时推送
```

### 前端架构建议

```javascript
// 游戏引擎核心类
class SheikahEngine {
  constructor() {
    this.canvas = document.getElementById('hyrule-map');
    this.ctx = this.canvas.getContext('2d');
    this.characters = new Map(); // id -> ChampionCharacter
    this.ws = new WebSocket('ws://localhost:8081');
    this.init();
  }

  init() {
    this.setupWebSocket();
    this.startGameLoop();
  }

  // 60 FPS 游戏循环
  gameLoop() {
    this.update();      // 更新角色状态
    this.render();      // 渲染画面
    requestAnimationFrame(() => this.gameLoop());
  }

  // 处理 WebSocket 消息
  handleMessage(msg) {
    switch (msg.type) {
      case 'subagentToolStart':
        this.spawnChampion(msg);
        break;
      case 'agentToolDone':
        this.despawnChampion(msg);
        break;
      case 'agentStatus':
        this.updateChampionState(msg);
        break;
    }
  }
}
```

### 后端集成建议

```javascript
// 扩展现有 server.js，添加 WebSocket 支持
const WebSocket = require('ws');

class AgentPlaygroundServer {
  constructor() {
    this.wss = new WebSocket.Server({ port: 8081 });
    this.setupFileWatcher();
  }

  setupFileWatcher() {
    // 监听 ~/.claude/projects/ 下的 JSONL 文件
    const { FileWatcher } = require('./lib/fileWatcher');
    this.watcher = new FileWatcher({
      projectDir: require('path').join(
        require('os').homedir(),
        '.claude',
        'projects'
      ),
      onNewLine: (data) => this.broadcast(data),
    });
  }

  broadcast(message) {
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

module.exports = { AgentPlaygroundServer };
```

### 部署方案

```bash
# 方案 1: 独立 Web 服务（推荐开发）
npm run dev
# 访问 http://localhost:8080/playground.html

# 方案 2: VS Code Extension（推荐生产）
# 作为 webview 嵌入 VS Code，与 Pixel Agents 集成

# 方案 3: 混合模式
# 独立页面 + VS Code 侧边栏，双向同步
```

---

## 参考资源

- **Star-Office-UI**: 游戏化界面设计原则、角色化功能模块
- **Pixel-Agents**: Agent 可视化方法、状态指示系统
- **ClaudePad**: 希卡之石主题、零构建前端架构

---

*文档版本: 1.0*
*更新日期: 2026-03-08*

---

## 附录 A: 视觉风格规范

### A.1 颜色系统（希卡之石主题）

```css
:root {
  /* 主色调 */
  --sheikah-bronze: #c9a961;
  --sheikah-blue: #00d4ff;
  --sheikah-orange: #ff6b35;

  /* 背景色 */
  --bg-dark: #1a1a2e;
  --bg-panel: rgba(26, 26, 46, 0.95);

  /* Champion 专属色 */
  --mipha-green: #4ade80;
  --revali-cyan: #22d3ee;
  --urbosa-yellow: #facc15;
  --daruk-red: #f87171;

  /* 状态色 */
  --status-active: var(--sheikah-blue);
  --status-idle: #666;
  --status-busy: #ff9800;
  --status-offline: #444;
}
```

### A.2 Champion 主题色映射

```javascript
const CHAMPION_THEMES = {
  link: {
    primary: '#00d4ff',
    secondary: '#c9a961',
    glow: '0 0 20px rgba(0, 212, 255, 0.5)',
  },
  mipha: {
    primary: '#4ade80',
    secondary: '#22c55e',
    glow: '0 0 20px rgba(74, 222, 128, 0.5)',
  },
  revali: {
    primary: '#22d3ee',
    secondary: '#06b6d4',
    glow: '0 0 20px rgba(34, 211, 238, 0.5)',
  },
  urbosa: {
    primary: '#facc15',
    secondary: '#eab308',
    glow: '0 0 20px rgba(250, 204, 21, 0.5)',
  },
  daruk: {
    primary: '#f87171',
    secondary: '#ef4444',
    glow: '0 0 20px rgba(248, 113, 113, 0.5)',
  },
};
```

### A.3 字体规范

```css
/* 标题 - 希卡风格 */
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap');

/* 正文 - 可读性 */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

.font-title {
  font-family: 'Orbitron', sans-serif;
  letter-spacing: 0.05em;
}

.font-body {
  font-family: 'Inter', sans-serif;
}
```

### A.4 状态指示器样式

| 状态 | 颜色 | 动画 |
|------|------|------|
| active | #00d4ff | 青色脉冲动画 |
| idle | #666 | 灰色静态 |
| busy | #ff9800 | 橙色闪烁 |
| offline | #444 | 深灰半透明 |

### A.5 动画时长规范

```javascript
const ANIMATION_DURATION = {
  // 角色动画
  WALK_FRAME: 150,      // 行走帧间隔 (ms)
  TYPE_FRAME: 250,      // 打字帧间隔 (ms)
  IDLE_BREATH: 2000,    // 呼吸动画周期 (ms)

  // 特效动画
  SPAWN_EFFECT: 300,    // 出场特效 (ms)
  DESPAWN_EFFECT: 300,  // 退场特效 (ms)
  TOOL_ACTIVATE: 200,   // 工具激活 (ms)

  // UI 动画
  CARD_HOVER: 200,      // 卡片悬停 (ms)
  STATUS_TRANSITION: 300, // 状态切换 (ms)
};
```



# Pixel Agents Session 状态获取机制架构文档

## 概述

Pixel Agents 通过监控 Claude Code 的 JSONL 会话文件来实时获取每个 Session 的状态。该机制采用**文件系统监听 + 增量解析 + 状态机处理**的混合架构，实现对多代理（Multi-Agent）会话的实时追踪。

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VS Code Extension (Node.js)                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │  AgentManager   │    │  FileWatcher    │    │    TranscriptParser         │  │
│  │                 │    │                 │    │                             │  │
│  │ - launchNew     │    │ - fs.watch      │    │ - JSONL 解析                │  │
│  │ - restoreAgents │◄───┤ - fs.watchFile  │◄───┤ - 工具状态提取              │  │
│  │ - persistAgents │    │ - 轮询备份      │    │ - 状态变更通知              │  │
│  └────────┬────────┘    └─────────────────┘    └─────────────────────────────┘  │
│           │                                                                       │
│           ▼                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │  TimerManager   │    │  PixelAgents    │    │      VS Code API            │  │
│  │                 │    │    ViewProvider │    │                             │  │
│  │ - waitingTimer  │◄───┤                 │◄───┤ - window.terminals          │  │
│  │ - permissionTimer│   │ - webview       │    │ - workspace.workspaceFolders│  │
│  └─────────────────┘    └────────┬────────┘    └─────────────────────────────┘  │
│                                  │                                                │
└──────────────────────────────────┼────────────────────────────────────────────────┘
                                   │ postMessage
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Webview UI (React + TypeScript)                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │useExtensionMessages│   │  OfficeState    │    │    Character FSM            │  │
│  │                 │    │                 │    │                             │  │
│  │ - messageHandler│◄───┤ - addAgent()    │    │ - IDLE: 随机漫游            │  │
│  │ - state update  │    │ - setAgentActive│◄───┤ - WALK: 路径规划            │  │
│  └─────────────────┘    │ - rebuildLayout │    │ - TYPE: 工具执行            │  │
│                         └─────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         File System (JSONL Logs)                                  │
│  ~/.claude/projects/<project-hash>/                                               │
│       └── <session-id>.jsonl  (Claude Code 会话日志)                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件说明

### 1. Session 生命周期管理 (AgentManager)

**文件**: `src/agentManager.ts`

```typescript
// Agent 创建流程
launchNewTerminal() {
  1. 创建 VS Code Terminal
  2. 发送命令: claude --session-id <uuid>
  3. 预期 JSONL 文件路径: ~/.claude/projects/<project-hash>/<uuid>.jsonl
  4. 轮询等待文件创建 (1秒间隔)
  5. 文件出现后启动 FileWatcher
}
```

**关键数据结构**:
```typescript
interface AgentState {
  id: number;                          // 代理唯一ID
  terminalRef: vscode.Terminal;        // 绑定的终端
  projectDir: string;                  // ~/.claude/projects/<hash>
  jsonlFile: string;                   // 监控的 JSONL 文件路径
  fileOffset: number;                  // 已读取的文件偏移量
  lineBuffer: string;                  // 不完整行缓冲区
  activeToolIds: Set<string>;          // 当前活跃的工具ID
  activeToolStatuses: Map<string, string>;  // 工具状态描述
  activeSubagentToolIds: Map<string, Set<string>>;  // 子代理工具
  isWaiting: boolean;                  // 是否等待用户输入
  hadToolsInTurn: boolean;             // 当前回合是否使用过工具
}
```

### 2. 文件监听机制 (FileWatcher)

**文件**: `src/fileWatcher.ts`

采用**三层冗余监听策略**确保可靠性：

```
┌────────────────────────────────────────────────────────┐
│                   文件监听架构                          │
├────────────────────────────────────────────────────────┤
│  Layer 1: fs.watch()    │  事件驱动，可能遗漏          │
│  Layer 2: fs.watchFile()│  基于 stat 的轮询 (2秒)      │
│  Layer 3: setInterval() │  手动轮询 (2秒) 最后防线     │
└────────────────────────────────────────────────────────┘
```

**读取新行逻辑**:
```typescript
readNewLines(agentId, agents) {
  1. 获取文件当前大小 (stat.size)
  2. 读取新增内容 (从 fileOffset 到 size)
  3. 处理行缓冲区: 处理完整行，保留未完整行
  4. 更新 fileOffset
  5. 调用 processTranscriptLine() 解析每一行
}
```

### 3. JSONL 解析与状态提取 (TranscriptParser)

**文件**: `src/transcriptParser.ts`

**支持的记录类型**:

| 类型 | 子类型 | 说明 |
|------|--------|------|
| `assistant` | `tool_use` | AI 开始执行工具 |
| `user` | `tool_result` | 工具执行结果返回 |
| `system` | `turn_duration` | 回合结束信号（最可靠） |
| `progress` | `agent_progress` | 子代理（Task工具）进度 |
| `progress` | `bash_progress` | Bash 命令执行中 |
| `progress` | `mcp_progress` | MCP 工具执行中 |

**状态转换流程**:

```
┌─────────┐    assistant/tool_use    ┌─────────┐
│  IDLE   │ ───────────────────────► │ ACTIVE  │
│ (等待)  │                          │ (执行中)│
└─────────┘                          └────┬────┘
     ▲                                    │
     │ system/turn_duration              │ user/tool_result
     │ (回合结束信号)                     │ (工具完成)
     └────────────────────────────────────┘
              ┌─────────┐
              │ WAITING │ ◄──── 5秒无数据 (文本回合)
              │(等待输入)│
              └─────────┘
```

**权限等待检测**:
- 非豁免工具（Task, AskUserQuestion 除外）启动 5 秒超时
- 超时后显示权限等待气泡（等待用户确认）
- 收到 `bash_progress` / `mcp_progress` 重置计时器

### 4. 终端绑定与恢复

**多根工作区支持**:
```typescript
// 每个工作区文件夹有独立的 projectDir
const dirName = workspacePath.replace(/[^a-zA-Z0-9-]/g, '-');
const projectDir = path.join(os.homedir(), '.claude', 'projects', dirName);
```

**Session 持久化**:
- 代理状态存储在 `context.workspaceState`
- VS Code 重启后通过终端名称匹配恢复 Agent
- 自动重新建立文件监听

**终端领养（Terminal Adoption）**:
```
场景: 用户手动运行 claude 命令
流程:
  1. 项目级扫描 (1秒间隔) 检测新 JSONL 文件
  2. 如果当前有聚焦的终端且无 Agent 绑定 → 领养
  3. 如果当前 Agent 活跃 → 重新分配 (处理 /clear 场景)
```

---

## 消息协议 (Extension ↔ Webview)

```typescript
// Extension → Webview 消息类型
interface ExtensionMessage {
  type: 'agentCreated' | 'agentClosed' | 'agentToolStart' |
        'agentToolDone' | 'agentToolsClear' | 'agentStatus' |
        'agentToolPermission' | 'subagentToolStart' | 'layoutLoaded';
  id: number;           // Agent ID
  toolId?: string;      // 工具唯一ID
  status?: string;      // 工具状态描述
  parentToolId?: string; // 父工具ID（子代理）
}

// Webview → Extension 消息类型
interface WebviewMessage {
  type: 'openClaude' | 'focusAgent' | 'closeAgent' |
        'saveAgentSeats' | 'saveLayout' | 'webviewReady';
  id?: number;
  folderPath?: string;
  seats?: Record<number, AgentSeat>;
}
```

---

## 状态同步时序图

```
Claude Code          Extension              Webview              Character
     │                  │                      │                      │
     │ 1. tool_use      │                      │                      │
     │─────────────────►│                      │                      │
     │                  │ 2. agentToolStart    │                      │
     │                  │─────────────────────►│                      │
     │                  │                      │ 3. setAgentTool()    │
     │                  │                      │─────────────────────►│
     │                  │                      │ 4. setAgentActive()  │
     │                  │                      │─────────────────────►│
     │                  │                      │                      │ [切换到TYPE状态]
     │                  │                      │                      │
     │ 5. tool_result   │                      │                      │
     │─────────────────►│                      │                      │
     │                  │ 6. agentToolDone     │                      │
     │                  │─────────────────────►│                      │
     │                  │                      │                      │ [继续TYPE/切换IDLE]
     │                  │                      │                      │
     │ 7. turn_duration │                      │                      │
     │─────────────────►│                      │                      │
     │                  │ 8. agentStatus       │                      │
     │                  │─────────────────────►│                      │
     │                  │                      │ 9. setAgentActive()  │
     │                  │                      │─────────────────────►│
     │                  │                      │                      │ [切换到IDLE状态]
     │                  │                      │ 10. showWaitingBubble│
     │                  │                      │─────────────────────►│
     │                  │                      │                      │ [显示等待气泡]
```

---

## 关键设计决策

### 1. 为什么选择 JSONL 文件监听？

- **Hook 方案失败**: VS Code 终端环境变量不传播，Hook 无法捕获
- `--output-format stream-json` 需要非 TTY 输入，与 VS Code 终端不兼容
- JSONL 文件是 Claude Code 原生支持的标准日志格式

### 2. 三层监听机制的必要性

| 机制 | 优点 | 缺点 |
|------|------|------|
| `fs.watch()` | 实时、低延迟 | macOS 上不可靠，可能遗漏事件 |
| `fs.watchFile()` | 跨平台、stat 基础 | 2秒轮询，稍有延迟 |
| `setInterval()` | 绝对可靠 | 资源消耗稍高 |

### 3. 行缓冲区的作用

```typescript
// 处理部分写入的情况
const text = agent.lineBuffer + buf.toString('utf-8');
const lines = text.split('\n');
agent.lineBuffer = lines.pop() || ''; // 保留未完整行
```

JSONL 记录可能跨多个读取周期，需要缓冲机制确保不丢失数据。

---

## 性能考虑

1. **增量读取**: 只读取文件新增部分，不重复读取整个文件
2. **偏移量追踪**: `fileOffset` 确保 O(1) 读取复杂度
3. **去抖动**: `TOOL_DONE_DELAY_MS` (300ms) 防止 React 批量渲染导致的闪烁
4. **轮询间隔**: 2秒轮询作为备份，不频繁占用 CPU

---

## 故障处理

| 场景 | 处理策略 |
|------|----------|
| JSONL 文件被删除 | 继续监听，等待重新创建 |
| `/clear` 命令 | 检测到新 JSONL 文件，重新分配 Agent |
| 终端关闭 | 清理所有资源（watchers, timers） |
| 文件解析错误 | 忽略该行，继续处理后续 |
| VS Code 重启 | 从 workspaceState 恢复 Agent 绑定 |




# Pixel Agents Session 状态获取机制架构文档

## 概述

Pixel Agents 通过监控 Claude Code 的 JSONL 会话文件来实时获取每个 Session 的状态。该机制采用**文件系统监听 + 增量解析 + 状态机处理**的混合架构，实现对多代理（Multi-Agent）会话的实时追踪。

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              VS Code Extension (Node.js)                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │  AgentManager   │    │  FileWatcher    │    │    TranscriptParser         │  │
│  │                 │    │                 │    │                             │  │
│  │ - launchNew     │    │ - fs.watch      │    │ - JSONL 解析                │  │
│  │ - restoreAgents │◄───┤ - fs.watchFile  │◄───┤ - 工具状态提取              │  │
│  │ - persistAgents │    │ - 轮询备份      │    │ - 状态变更通知              │  │
│  └────────┬────────┘    └─────────────────┘    └─────────────────────────────┘  │
│           │                                                                       │
│           ▼                                                                       │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │  TimerManager   │    │  PixelAgents    │    │      VS Code API            │  │
│  │                 │    │    ViewProvider │    │                             │  │
│  │ - waitingTimer  │◄───┤                 │◄───┤ - window.terminals          │  │
│  │ - permissionTimer│   │ - webview       │    │ - workspace.workspaceFolders│  │
│  └─────────────────┘    └────────┬────────┘    └─────────────────────────────┘  │
│                                  │                                                │
└──────────────────────────────────┼────────────────────────────────────────────────┘
                                   │ postMessage
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Webview UI (React + TypeScript)                         │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────────┐  │
│  │useExtensionMessages│   │  OfficeState    │    │    Character FSM            │  │
│  │                 │    │                 │    │                             │  │
│  │ - messageHandler│◄───┤ - addAgent()    │    │ - IDLE: 随机漫游            │  │
│  │ - state update  │    │ - setAgentActive│◄───┤ - WALK: 路径规划            │  │
│  └─────────────────┘    │ - rebuildLayout │    │ - TYPE: 工具执行            │  │
│                         └─────────────────┘    └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         File System (JSONL Logs)                                  │
│  ~/.claude/projects/<project-hash>/                                               │
│       └── <session-id>.jsonl  (Claude Code 会话日志)                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心组件说明

### 1. Session 生命周期管理 (AgentManager)

**文件**: `src/agentManager.ts`

```typescript
// Agent 创建流程
launchNewTerminal() {
  1. 创建 VS Code Terminal
  2. 发送命令: claude --session-id <uuid>
  3. 预期 JSONL 文件路径: ~/.claude/projects/<project-hash>/<uuid>.jsonl
  4. 轮询等待文件创建 (1秒间隔)
  5. 文件出现后启动 FileWatcher
}
```

**关键数据结构**:
```typescript
interface AgentState {
  id: number;                          // 代理唯一ID
  terminalRef: vscode.Terminal;        // 绑定的终端
  projectDir: string;                  // ~/.claude/projects/<hash>
  jsonlFile: string;                   // 监控的 JSONL 文件路径
  fileOffset: number;                  // 已读取的文件偏移量
  lineBuffer: string;                  // 不完整行缓冲区
  activeToolIds: Set<string>;          // 当前活跃的工具ID
  activeToolStatuses: Map<string, string>;  // 工具状态描述
  activeSubagentToolIds: Map<string, Set<string>>;  // 子代理工具
  isWaiting: boolean;                  // 是否等待用户输入
  hadToolsInTurn: boolean;             // 当前回合是否使用过工具
}
```

### 2. 文件监听机制 (FileWatcher)

**文件**: `src/fileWatcher.ts`

采用**三层冗余监听策略**确保可靠性：

```
┌────────────────────────────────────────────────────────┐
│                   文件监听架构                          │
├────────────────────────────────────────────────────────┤
│  Layer 1: fs.watch()    │  事件驱动，可能遗漏          │
│  Layer 2: fs.watchFile()│  基于 stat 的轮询 (2秒)      │
│  Layer 3: setInterval() │  手动轮询 (2秒) 最后防线     │
└────────────────────────────────────────────────────────┘
```

**读取新行逻辑**:
```typescript
readNewLines(agentId, agents) {
  1. 获取文件当前大小 (stat.size)
  2. 读取新增内容 (从 fileOffset 到 size)
  3. 处理行缓冲区: 处理完整行，保留未完整行
  4. 更新 fileOffset
  5. 调用 processTranscriptLine() 解析每一行
}
```

### 3. JSONL 解析与状态提取 (TranscriptParser)

**文件**: `src/transcriptParser.ts`

**支持的记录类型**:

| 类型 | 子类型 | 说明 |
|------|--------|------|
| `assistant` | `tool_use` | AI 开始执行工具 |
| `user` | `tool_result` | 工具执行结果返回 |
| `system` | `turn_duration` | 回合结束信号（最可靠） |
| `progress` | `agent_progress` | 子代理（Task工具）进度 |
| `progress` | `bash_progress` | Bash 命令执行中 |
| `progress` | `mcp_progress` | MCP 工具执行中 |

**状态转换流程**:

```
┌─────────┐    assistant/tool_use    ┌─────────┐
│  IDLE   │ ───────────────────────► │ ACTIVE  │
│ (等待)  │                          │ (执行中)│
└─────────┘                          └────┬────┘
     ▲                                    │
     │ system/turn_duration              │ user/tool_result
     │ (回合结束信号)                     │ (工具完成)
     └────────────────────────────────────┘
              ┌─────────┐
              │ WAITING │ ◄──── 5秒无数据 (文本回合)
              │(等待输入)│
              └─────────┘
```

**权限等待检测**:
- 非豁免工具（Task, AskUserQuestion 除外）启动 5 秒超时
- 超时后显示权限等待气泡（等待用户确认）
- 收到 `bash_progress` / `mcp_progress` 重置计时器

### 4. 终端绑定与恢复

**多根工作区支持**:
```typescript
// 每个工作区文件夹有独立的 projectDir
const dirName = workspacePath.replace(/[^a-zA-Z0-9-]/g, '-');
const projectDir = path.join(os.homedir(), '.claude', 'projects', dirName);
```

**Session 持久化**:
- 代理状态存储在 `context.workspaceState`
- VS Code 重启后通过终端名称匹配恢复 Agent
- 自动重新建立文件监听

**终端领养（Terminal Adoption）**:
```
场景: 用户手动运行 claude 命令
流程:
  1. 项目级扫描 (1秒间隔) 检测新 JSONL 文件
  2. 如果当前有聚焦的终端且无 Agent 绑定 → 领养
  3. 如果当前 Agent 活跃 → 重新分配 (处理 /clear 场景)
```

---

## 消息协议 (Extension ↔ Webview)

```typescript
// Extension → Webview 消息类型
interface ExtensionMessage {
  type: 'agentCreated' | 'agentClosed' | 'agentToolStart' |
        'agentToolDone' | 'agentToolsClear' | 'agentStatus' |
        'agentToolPermission' | 'subagentToolStart' | 'layoutLoaded';
  id: number;           // Agent ID
  toolId?: string;      // 工具唯一ID
  status?: string;      // 工具状态描述
  parentToolId?: string; // 父工具ID（子代理）
}

// Webview → Extension 消息类型
interface WebviewMessage {
  type: 'openClaude' | 'focusAgent' | 'closeAgent' |
        'saveAgentSeats' | 'saveLayout' | 'webviewReady';
  id?: number;
  folderPath?: string;
  seats?: Record<number, AgentSeat>;
}
```

---

## 状态同步时序图

```
Claude Code          Extension              Webview              Character
     │                  │                      │                      │
     │ 1. tool_use      │                      │                      │
     │─────────────────►│                      │                      │
     │                  │ 2. agentToolStart    │                      │
     │                  │─────────────────────►│                      │
     │                  │                      │ 3. setAgentTool()    │
     │                  │                      │─────────────────────►│
     │                  │                      │ 4. setAgentActive()  │
     │                  │                      │─────────────────────►│
     │                  │                      │                      │ [切换到TYPE状态]
     │                  │                      │                      │
     │ 5. tool_result   │                      │                      │
     │─────────────────►│                      │                      │
     │                  │ 6. agentToolDone     │                      │
     │                  │─────────────────────►│                      │
     │                  │                      │                      │ [继续TYPE/切换IDLE]
     │                  │                      │                      │
     │ 7. turn_duration │                      │                      │
     │─────────────────►│                      │                      │
     │                  │ 8. agentStatus       │                      │
     │                  │─────────────────────►│                      │
     │                  │                      │ 9. setAgentActive()  │
     │                  │                      │─────────────────────►│
     │                  │                      │                      │ [切换到IDLE状态]
     │                  │                      │ 10. showWaitingBubble│
     │                  │                      │─────────────────────►│
     │                  │                      │                      │ [显示等待气泡]
```

---

## 关键设计决策

### 1. 为什么选择 JSONL 文件监听？

- **Hook 方案失败**: VS Code 终端环境变量不传播，Hook 无法捕获
- `--output-format stream-json` 需要非 TTY 输入，与 VS Code 终端不兼容
- JSONL 文件是 Claude Code 原生支持的标准日志格式

### 2. 三层监听机制的必要性

| 机制 | 优点 | 缺点 |
|------|------|------|
| `fs.watch()` | 实时、低延迟 | macOS 上不可靠，可能遗漏事件 |
| `fs.watchFile()` | 跨平台、stat 基础 | 2秒轮询，稍有延迟 |
| `setInterval()` | 绝对可靠 | 资源消耗稍高 |

### 3. 行缓冲区的作用

```typescript
// 处理部分写入的情况
const text = agent.lineBuffer + buf.toString('utf-8');
const lines = text.split('\n');
agent.lineBuffer = lines.pop() || ''; // 保留未完整行
```

JSONL 记录可能跨多个读取周期，需要缓冲机制确保不丢失数据。

---

## 性能考虑

1. **增量读取**: 只读取文件新增部分，不重复读取整个文件
2. **偏移量追踪**: `fileOffset` 确保 O(1) 读取复杂度
3. **去抖动**: `TOOL_DONE_DELAY_MS` (300ms) 防止 React 批量渲染导致的闪烁
4. **轮询间隔**: 2秒轮询作为备份，不频繁占用 CPU

---

## 故障处理

| 场景 | 处理策略 |
|------|----------|
| JSONL 文件被删除 | 继续监听，等待重新创建 |
| `/clear` 命令 | 检测到新 JSONL 文件，重新分配 Agent |
| 终端关闭 | 清理所有资源（watchers, timers） |
| 文件解析错误 | 忽略该行，继续处理后续 |
| VS Code 重启 | 从 workspaceState 恢复 Agent 绑定 |
root@DESKTOP-M81A3SG:/home/yangjing/pixel-agents/arch#
root@DESKTOP-M81A3SG:/home/yangjing/pixel-agents/arch# ls
character-movement-architecture.md  session-state-architecture.md
root@DESKTOP-M81A3SG:/home/yangjing/pixel-agents/arch# cat character-movement-architecture.md
# Pixel Agents 人物走动控制机制架构文档

## 概述

Pixel Agents 使用**有限状态机（FSM）**控制像素风人物的走动行为。每个人物代表一个 Claude Code Session，根据 Session 状态（空闲/执行工具/等待输入）自动切换行为模式。

---

## 架构图

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              Character Control System                                │
│                                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         Game Loop (60 FPS)                                   │   │
│  │  requestAnimationFrame ──► update(dt) ──► render(ctx)                        │   │
│  └────────────────────────────────┬─────────────────────────────────────────────┘   │
│                                   │                                                   │
│                                   ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                      Finite State Machine (FSM)                              │   │
│  │                                                                              │   │
│  │   ┌─────────┐      激活/有座位      ┌─────────┐      到达座位      ┌─────────┐│   │
│  │   │  IDLE   │ ───────────────────► │  WALK   │ ───────────────► │  TYPE   ││   │
│  │   │ (空闲)  │ ◄─────────────────── │ (行走)  │ ◄─────────────── │ (工作)  ││   │
│  │   └────┬────┘   座位Timer到期/漫游   └────┬────┘   失去激活      └────┬────┘│   │
│  │        │                                  │                         │      │   │
│  │        │ 随机漫游( Wander )               │                         │      │   │
│  │        ▼                                  │                         │      │   │
│  │   寻找随机目标 ──► BFS路径规划 ──► 开始行走 ◄─── 路径规划到座位 ─────┘      │   │
│  │                                                                              │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                   │                                                   │
│                                   ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                        Pathfinding System                                    │   │
│  │                                                                              │   │
│  │   TileMap (Grid) ──► BFS Algorithm ──► Path (Array of {col, row})            │   │
│  │                                                                              │   │
│  │   障碍物处理:                                                                │   │
│  │   - 墙壁 (Wall)                                                              │   │
│  │   - 家具 (Furniture)                                                         │   │
│  │   - 其他Agent的座位 (Seat blocking)                                          │   │
│  │   - 自己的座位临时解除阻挡 (withOwnSeatUnblocked)                            │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                   │                                                   │
│                                   ▼                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                        Animation System                                      │   │
│  │                                                                              │   │
│  │   Character Sprites (112×96)                                                 │   │
│  │   ┌──────────────────────────────────────────────────────────────────┐      │   │
│  │   │ Frame 0 │ Frame 1 │ Frame 2 │ Frame 3 │ Frame 4 │ Frame 5 │ Frame 6│      │   │
│  │   │ (walk1) │ (walk2) │ (walk3) │(type1)  │(type2)  │(read1)  │(read2) │      │   │
│  │   └──────────────────────────────────────────────────────────────────┘      │   │
│  │   Row 0 = Down │ Row 1 = Up │ Row 2 = Right (Left = flipped)                │   │
│  │                                                                              │   │
│  │   Animation Types:                                                           │   │
│  │   - Walk:  4帧循环 (0.15秒/帧)                                               │   │
│  │   - Type:  2帧循环 (0.25秒/帧)                                               │   │
│  │   - Read:  2帧循环 (与Type相同帧)                                            │   │
│  │   - Idle:  静态帧 (walk2)                                                    │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                       │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 核心数据结构

### Character 对象

```typescript
interface Character {
  id: number;                    // Agent ID (正数=主Agent, 负数=Subagent)
  state: CharacterState;         // 当前状态 (IDLE/WALK/TYPE)
  dir: Direction;               // 朝向 (UP/DOWN/LEFT/RIGHT)
  x: number;                    // 像素坐标 X
  y: number;                    // 像素坐标 Y
  tileCol: number;              // 网格列坐标
  tileRow: number;              // 网格行坐标

  // 行走相关
  path: PathNode[];             // BFS路径
  moveProgress: number;         // 0-1 移动进度

  // 动画相关
  frame: number;                // 当前帧索引
  frameTimer: number;           // 帧计时器

  // 行为控制
  isActive: boolean;            // 是否有工具在执行
  currentTool: string | null;   // 当前工具名
  seatId: string | null;        // 分配的座位ID

  // 漫游AI
  wanderTimer: number;          // 漫游计时器
  wanderCount: number;          // 已漫游次数
  wanderLimit: number;          // 漫游上限 (随机)

  // 视觉效果
  palette: number;              // 配色方案 (0-5)
  hueShift: number;             // 色相偏移 (度数)
  matrixEffect: 'spawn' | 'despawn' | null;
  bubbleType: 'waiting' | 'permission' | null;
}
```

### 状态枚举

```typescript
enum CharacterState {
  IDLE = 0,   // 空闲/待机
  WALK = 1,   // 行走中
  TYPE = 2,   // 工作中 (打字/阅读)
}

enum Direction {
  UP = 0,
  DOWN = 1,
  LEFT = 2,
  RIGHT = 3,
}
```

---

## 状态机详细设计

### 1. TYPE 状态（工作）

```typescript
case CharacterState.TYPE: {
  // 动画: 根据工具类型选择
  if (isReadingTool(ch.currentTool)) {
    // Read/Grep/Glob/WebFetch/WebSearch → 阅读动画
    frame = readingFrames[ch.frame % 2];
  } else {
    // Write/Edit/Bash/Task → 打字动画
    frame = typingFrames[ch.frame % 2];
  }

  // 状态转换
  if (!ch.isActive) {
    // Session 空闲了，开始休息倒计时
    ch.seatTimer = random(SEAT_REST_MIN_SEC, SEAT_REST_MAX_SEC); // 2-4分钟
    ch.state = CharacterState.IDLE;
  }
}
```

**座位动画偏移**:
```typescript
// 坐下时向下偏移 6px，视觉呈现坐在椅子上的效果
const CHARACTER_SITTING_OFFSET_PX = 6;
```

### 2. IDLE 状态（空闲）

```typescript
case CharacterState.IDLE: {
  // 静态姿势 (使用 walk2 帧)
  ch.frame = 0;

  if (ch.isActive) {
    // Session 激活了，返回座位工作
    path = findPath(current, seat);
    if (path.length > 0) {
      ch.state = CharacterState.WALK;
    }
  } else if (ch.wanderTimer <= 0) {
    // 漫游Timer到期，决定是否继续漫游或返回休息
    if (ch.wanderCount >= ch.wanderLimit && ch.seatId) {
      // 漫游够了，回座位休息
      path = findPath(current, seat);
      ch.state = CharacterState.WALK;
    } else {
      // 随机选择一个可行走的目标
      target = random(walkableTiles);
      path = findPath(current, target);
      if (path.length > 0) {
        ch.state = CharacterState.WALK;
        ch.wanderCount++;
      }
    }
    ch.wanderTimer = random(WANDER_PAUSE_MIN_SEC, WANDER_PAUSE_MAX_SEC);
  }
}
```

**漫游参数**:
```typescript
WANDER_PAUSE_MIN_SEC = 3;       // 漫游间隔最小3秒
WANDER_PAUSE_MAX_SEC = 8;       // 漫游间隔最大8秒
WANDER_MOVES_BEFORE_REST_MIN = 3;  // 最少漫游3次后休息
WANDER_MOVES_BEFORE_REST_MAX = 6;  // 最多漫游6次后休息
SEAT_REST_MIN_SEC = 120;        // 座位休息最小2分钟
SEAT_REST_MAX_SEC = 240;        // 座位休息最大4分钟
```

### 3. WALK 状态（行走）

```typescript
case CharacterState.WALK: {
  // 动画: 4帧循环
  if (frameTimer >= WALK_FRAME_DURATION_SEC) { // 0.15秒
    ch.frame = (ch.frame + 1) % 4;
  }

  if (ch.path.length === 0) {
    // 到达目的地
    snapToTileCenter();

    if (ch.isActive && atSeat) {
      // 到达座位，开始工作
      ch.state = CharacterState.TYPE;
      ch.dir = seat.facingDir;
    } else if (!ch.isActive && atSeat) {
      // 回到座位休息
      ch.state = CharacterState.TYPE;
      ch.seatTimer = random(SEAT_REST_MIN_SEC, SEAT_REST_MAX_SEC);
    } else {
      // 到达漫游目标，继续空闲
      ch.state = CharacterState.IDLE;
    }
  } else {
    // 向路径下一个节点移动
    nextTile = ch.path[0];
    ch.dir = directionBetween(current, nextTile);
    ch.moveProgress += (WALK_SPEED_PX_PER_SEC / TILE_SIZE) * dt;

    if (ch.moveProgress >= 1) {
      // 到达节点
      ch.tileCol = nextTile.col;
      ch.tileRow = nextTile.row;
      ch.path.shift();
      ch.moveProgress = 0;
    }

    // 插值计算像素位置
    ch.x = lerp(fromCenter.x, toCenter.x, ch.moveProgress);
    ch.y = lerp(fromCenter.y, toCenter.y, ch.moveProgress);
  }
}
```

---

## 路径查找系统

### BFS 算法实现

**文件**: `webview-ui/src/office/layout/tileMap.ts`

```typescript
export function findPath(
  startCol: number,
  startRow: number,
  targetCol: number,
  targetRow: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): Array<{ col: number; row: number }> {
  // 边界检查
  if (!isValidPosition(targetCol, targetRow)) return [];

  // BFS队列
  const queue: Array<{ col: number; row: number; path: Array<{ col: number; row: number }> }> = [];
  const visited = new Set<string>();

  queue.push({ col: startCol, row: startRow, path: [] });
  visited.add(`${startCol},${startRow}`);

  const directions = [
    { dc: 0, dr: -1 }, // Up
    { dc: 0, dr: 1 },  // Down
    { dc: -1, dr: 0 }, // Left
    { dc: 1, dr: 0 },  // Right
  ];

  while (queue.length > 0) {
    const { col, row, path } = queue.shift()!;

    // 到达目标
    if (col === targetCol && row === targetRow) {
      return path;
    }

    // 探索邻居
    for (const { dc, dr } of directions) {
      const newCol = col + dc;
      const newRow = row + dr;
      const key = `${newCol},${newRow}`;

      if (visited.has(key)) continue;
      if (!isWalkable(newCol, newRow, tileMap, blockedTiles)) continue;

      visited.add(key);
      queue.push({
        col: newCol,
        row: newRow,
        path: [...path, { col: newCol, row: newRow }],
      });
    }
  }

  return []; // 无路径
}
```

### 可行走性判断

```typescript
export function isWalkable(
  col: number,
  row: number,
  tileMap: TileType[][],
  blockedTiles: Set<string>,
): boolean {
  // 边界检查
  if (row < 0 || row >= tileMap.length) return false;
  if (col < 0 || col >= tileMap[0].length) return false;

  // 必须是地板 (FLOOR)
  if (tileMap[row][col] !== TileType.FLOOR) return false;

  // 不能被其他物品阻挡
  if (blockedTiles.has(`${col},${row}`)) return false;

  return true;
}
```

### 座位阻挡特殊处理

每个Agent的座位对自己是可通过的，但对其他Agent是阻挡的：

```typescript
// 临时解除自己的座位阻挡
private withOwnSeatUnblocked<T>(ch: Character, fn: () => T): T {
  const key = this.ownSeatKey(ch);  // "col,row"
  if (key) this.blockedTiles.delete(key);
  const result = fn();
  if (key) this.blockedTiles.add(key);
  return result;
}

// 在路径规划时调用
const path = this.withOwnSeatUnblocked(ch, () =>
  findPath(ch.tileCol, ch.tileRow, seat.seatCol, seat.seatRow, tileMap, blockedTiles)
);
```

---

## 动画系统

### 精灵数据结构

**文件**: `webview-ui/src/office/sprites/spriteData.ts`

```typescript
interface CharacterSprites {
  walk: {
    [Direction.DOWN]: SpriteData[4];   // 行走4帧
    [Direction.UP]: SpriteData[4];
    [Direction.RIGHT]: SpriteData[4];
    [Direction.LEFT]: SpriteData[4];   // 运行时翻转
  };
  typing: {
    [Direction.DOWN]: SpriteData[2];   // 打字2帧
    [Direction.UP]: SpriteData[2];
    [Direction.RIGHT]: SpriteData[2];
    [Direction.LEFT]: SpriteData[2];
  };
  reading: {
    [Direction.DOWN]: SpriteData[2];   // 阅读2帧 (与打字相同)
    [Direction.UP]: SpriteData[2];
    [Direction.RIGHT]: SpriteData[2];
    [Direction.LEFT]: SpriteData[2];
  };
}

// 16x24 像素精灵 (底部锚点)
// 112x96 精灵表: 7帧 x 3方向
```

### 动画帧选择逻辑

```typescript
export function getCharacterSprite(ch: Character, sprites: CharacterSprites): SpriteData {
  switch (ch.state) {
    case CharacterState.TYPE:
      if (isReadingTool(ch.currentTool)) {
        return sprites.reading[ch.dir][ch.frame % 2];
      }
      return sprites.typing[ch.dir][ch.frame % 2];

    case CharacterState.WALK:
      return sprites.walk[ch.dir][ch.frame % 4];

    case CharacterState.IDLE:
      // 空闲使用行走的第2帧（站立姿势）
      return sprites.walk[ch.dir][1];

    default:
      return sprites.walk[ch.dir][1];
  }
}
```

### 阅读 vs 打字工具

```typescript
const READING_TOOLS = new Set([
  'Read',      // 阅读文件
  'Grep',      // 搜索代码
  'Glob',      // 查找文件
  'WebFetch',  // 获取网页
  'WebSearch', // 网络搜索
]);

function isReadingTool(tool: string | null): boolean {
  return tool && READING_TOOLS.has(tool);
}
```

---

## 渲染系统

### Z-排序 (深度排序)

```typescript
// 按 Y 坐标排序，实现伪3D效果
entities.sort((a, b) => a.zY - b.zY);

// 座位上的角色 Z 调整
if (ch.state === CharacterState.TYPE) {
  zY = ch.y + TILE_SIZE/2 + 0.5;  // 确保在椅子前面
}

// 椅子的 Z 排序策略
if (chair.orientation === 'back') {
  zY = (row + 1) * TILE_SIZE + 1;  // 靠背椅子在角色前面
} else {
  zY = (row + 1) * TILE_SIZE;      // 普通椅子在角色后面
}
```

### 绘制流程

```typescript
function render(ctx: CanvasRenderingContext2D) {
  // 1. 清空画布
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 2. 绘制地板和墙壁
  renderTiles(ctx);

  // 3. 收集所有实体
  const entities = [
    ...furniture.map(f => ({ type: 'furniture', ...f })),
    ...characters.map(c => ({ type: 'character', ...c })),
  ];

  // 4. 按Z排序
  entities.sort((a, b) => a.zY - b.zY);

  // 5. 绘制实体
  for (const entity of entities) {
    if (entity.type === 'furniture') {
      renderFurniture(ctx, entity);
    } else {
      renderCharacter(ctx, entity);
    }
  }

  // 6. 绘制特效 (Matrix效果、气泡等)
  renderEffects(ctx);
}
```

---

## 子代理 (Sub-agent) 系统

Task 工具创建的子代理也是独立的 Character：

```typescript
addSubagent(parentAgentId: number, parentToolId: string): number {
  const id = this.nextSubagentId--;  // 负数ID

  // 继承父代理的配色
  const parentCh = this.characters.get(parentAgentId);
  const palette = parentCh ? parentCh.palette : 0;
  const hueShift = parentCh ? parentCh.hueShift : 0;

  // 找到离父代理最近的空闲座位
  const bestSeat = findClosestFreeSeat(parentCh.tileCol, parentCh.tileRow);

  const ch = createCharacter(id, palette, bestSeat.id, bestSeat, hueShift);
  ch.isSubagent = true;
  ch.parentAgentId = parentAgentId;

  this.characters.set(id, ch);
  this.subagentIdMap.set(`${parentAgentId}:${parentToolId}`, id);
  this.subagentMeta.set(id, { parentAgentId, parentToolId });

  return id;
}
```

---

## 出生/消失特效

```typescript
// Matrix 风格的数字雨效果
if (ch.matrixEffect === 'spawn') {
  // 0.3秒的绿色雨刷效果
  renderMatrixEffect(ctx, ch, progress, 'green');
  if (completed) ch.matrixEffect = null;
} else if (ch.matrixEffect === 'despawn') {
  renderMatrixEffect(ctx, ch, progress, 'green');
  if (completed) deleteCharacter(ch.id);
}
```

---

## 座位分配系统

### 座位数据结构

```typescript
interface Seat {
  seatCol: number;       // 座位列
  seatRow: number;       // 座位行
  facingDir: Direction;  // 朝向
  assigned: boolean;     // 是否已分配
  furnitureUid: string;  // 关联的家具UID
}
```

### 座位来源

从椅子家具自动生成：

```typescript
function layoutToSeats(furniture: PlacedFurniture[]): Map<string, Seat> {
  const seats = new Map();

  for (const item of furniture) {
    const entry = getCatalogEntry(item.type);
    if (!entry || entry.category !== 'chairs') continue;

    // 每个椅子占据的格子都生成座位
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const seatCol = item.col + dc;
        const seatRow = item.row + dr;
        const uid = entry.footprintW > 1 ? `${item.uid}:${dc}` : item.uid;

        // 确定朝向
        let facingDir = entry.orientation || Direction.DOWN;
        if (adjacentDesk) {
          facingDir = directionToward(seatCol, seatRow, deskCol, deskRow);
        }

        seats.set(uid, {
          seatCol, seatRow, facingDir,
          assigned: false,
          furnitureUid: item.uid,
        });
      }
    }
  }

  return seats;
}
```

---

## 配置参数汇总

```typescript
// 移动速度
WALK_SPEED_PX_PER_SEC = 45;      // 45像素/秒
TILE_SIZE = 16;                   // 每格16像素

// 动画帧率
WALK_FRAME_DURATION_SEC = 0.15;  // 行走帧间隔
TYPE_FRAME_DURATION_SEC = 0.25;  // 打字帧间隔

// AI行为
WANDER_PAUSE_MIN_SEC = 3;        // 漫游最小间隔
WANDER_PAUSE_MAX_SEC = 8;        // 漫游最大间隔
WANDER_MOVES_BEFORE_REST_MIN = 3; // 最小漫游次数
WANDER_MOVES_BEFORE_REST_MAX = 6; // 最大漫游次数
SEAT_REST_MIN_SEC = 120;         // 座位休息最小时间
SEAT_REST_MAX_SEC = 240;         // 座位休息最大时间

// 视觉效果
CHARACTER_SITTING_OFFSET_PX = 6; // 坐下偏移
CHARACTER_HIT_HALF_WIDTH = 6;    // 点击检测半宽
CHARACTER_HIT_HEIGHT = 20;       // 点击检测高度
```
