# Multi-Agent Hyrule 工作区

**版本：** 0.4.0

**更新日期：** 2026-07-16

**实现入口：** `/playground.html`

## 1. 目标

Multi-Agent 与 Sessions 是同一工作区的两个视图。Sessions 负责发现、筛选和恢复真实的 Claude Code 会话；Multi-Agent 将这些会话映射为 Link 与四位 Champion，用一张可探索的海拉鲁大陆呈现软件交付状态。

该页面是可视化协作与故障演练界面，不会在故事流程中直接修改或终止真实会话。

## 2. 页面结构

- **共享顶部导航**：Ideas、Tips 保留为工具入口；Sessions 与 Multi-Agent 使用紧凑的双 Tab 切换。
- **Delivery Pipeline**：使用软件工程术语展示六个阶段：Requirements Baseline、Incident Triage、Parallel Implementation、Integration Regression、Release Gate、Hardening Retrospective。
- **World Viewport**：展示中央希卡塔、四个区域要塞、四只神兽、Link 摩托车与 Bug 猪猪怪。
- **地图 HUD**：固定在地图顶部，提供缩小、复位、放大、返回中央塔和生成新大陆。
- **小地图**：同步主视口位置和缩放范围，可点击快速定位。
- **Agent / Session 面板**：展示当前 Agent、绑定会话、角色、状态与终端入口。
- **Event Feed**：事件触发后在视口中央显示，完成后自动收束，不保留无期限动画。

## 3. Session 联动

Sessions 卡片提供 `◈ 修复 Bug` 操作，跳转格式如下：

```text
/playground.html?session=<encoded-session-id>&server=<encoded-server-id>
```

Multi-Agent 启动时会：

1. 读取本地 `/api/sessions?limit=20&offset=0`；远端环境读取 `/api/servers/:id/sessions`。
2. 将 URL 指定的会话优先绑定给 Link。
3. 将其余近期会话依次绑定给 Revali、Mipha、Urbosa 和 Daruk。
4. 每 30 秒刷新会话状态，同时保留用户的地图相机位置。
5. 通过 Agent 操作打开对应的本地或远端 Web Terminal。

所有动态会话 ID 都通过 `data-*` 属性和事件委托处理，并在进入 URL 前编码；不得拼接到内联事件处理器。

## 4. 地图与交互

- 大陆画布大于视口，支持鼠标、触控拖动和键盘平移。
- 缩放范围为 `55%–160%`，支持按钮、滚轮与小地图定位。
- `◎ 中央塔` 将相机恢复到中央希卡塔。
- `⟳ 新大陆` 更新种子并重新生成装饰地貌；任务区域与会话绑定保持可识别。
- 中央塔是视觉锚点，不使用十字道路、广场或固定河流切割地图。
- 地貌、建筑和角色共享低饱和青绿、古铜金与希卡青主题色。

## 5. Agent 与区域

| Agent | 工程职责 | 海拉鲁区域 | 视觉锚点 |
| --- | --- | --- | --- |
| Link | Tech Lead / Coordinator | Central Hyrule | 中央希卡塔、Master Cycle |
| Revali | Analyst | Hebra | 风雪高地、Vah Medoh |
| Mipha | Frontend / UX | Zora | 湿润峡谷、Vah Ruta |
| Urbosa | Backend | Gerudo | 沙漠要塞、Vah Naboris |
| Daruk | QA / DevOps | Akkala / Eldin | 火山岩地、Vah Rudania |

## 6. 可访问性与响应式

- 所有地图控制、Agent、事件和 Tab 都需要可访问名称与键盘焦点。
- `aria-live` 只播报关键状态变化，避免持续重复。
- 窄屏下 HUD 自动换行，小地图保持可操作，面板改为单列。
- `prefers-reduced-motion: reduce` 下停用循环动画与大幅位移。
- 加载、恢复和事件动画必须有明确终态，不允许无限运行。

## 7. 资源与边界

运行时素材位于 `asserts/zelda-icon/`，包含地图背景、中央塔、四个区域要塞、四只神兽、Agent、摩托车与猪猪怪。历史设计中间产物位于 `asserts/version/`，不进入 npm 发布包。

当前版本不提供独立的 Agent 后端编排 API。故事事件用于可视化演练；真实会话的创建、恢复和终端输入仍由 Sessions 与 Terminal 路由负责。

## 8. 发布验收

- Sessions 与 Multi-Agent 双向导航有效，Ideas 与 Tips 未丢失。
- 本地、远端会话均可安全绑定和打开终端。
- 地图可拖动、缩放、复位、随机生成，小地图同步。
- 事件内容居中，动画结束后恢复稳定状态。
- 生产依赖审计为 0，TypeScript 构建通过。
- npm 包只包含运行时文件，不包含历史中间产物。
