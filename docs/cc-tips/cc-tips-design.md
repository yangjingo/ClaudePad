# CC Tips 功能设计文档

## 1. 概述

### 1.1 功能目标
在 ClaudePad 主页上添加一个 CC Tips 功能，让用户可以随机学习 Claude Code 的使用技巧。

### 1.2 核心价值
- 帮助用户发现 Claude Code 的新功能和使用技巧
- 提高用户对 Claude Code 的熟练使用程度
- 以轻松的方式提供学习体验

---

## 2. 数据结构

### 2.1 Tips JSON 格式

```json
{
  "tips": [
    {
      "id": 1,
      "category": "快捷键",
      "title": "清除输入",
      "content": "按 `Esc + Esc` 可以快速清除所有输入，重新开始。",
      "source": "cli-guide.md"
    }
  ],
  "categories": ["快捷键", "命令", "模型选择", ...],
  "meta": {
    "total_tips": 80,
    "last_updated": "2026-02-27",
    "version": "1.0.0"
  }
}
```

### 2.2 字段说明
| 字段 | 类型 | 说明 |
|------|------|------|
| id | number | 技巧唯一标识 |
| category | string | 技巧分类 |
| title | string | 技巧标题 |
| content | string | 技巧内容描述 |
| source | string | 来源文档 |

---

## 3. UI 设计

### 3.1 按钮设计
- **位置**: 页面左上角，CLAUDEPAD logo 右侧
- **样式**: 小型按钮，青色主题（与整体 Sheikah 风格一致）
- **文字**: "CC Tips"
- **交互**: 鼠标悬停时背景变色，有发光效果

### 3.2 弹窗设计
- **类型**: 模态框（Modal Overlay）
- **尺寸**: 最大宽度 420px，居中显示
- **边框**: 青色边框，带发光阴影
- **背景**: 半透明遮罩层 + 毛玻璃效果

### 3.3 弹窗内容
```
┌─────────────────────────────────┐
│ ◈ CC Tips                    ✕ │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ [分类标签]                  │ │
│ │ 技巧标题                    │ │
│ │ 技巧内容描述...             │ │
│ │ 来源：xxx.md                │ │
│ └─────────────────────────────┘ │
│                                 │
│ Total: 80 tips    [Next Tip]    │
└─────────────────────────────────┘
```

---

## 4. 功能需求

### 4.1 核心功能
1. **加载技巧**: 页面加载时从 `/docs/cc-tips/tips.json` 获取数据
2. **随机显示**: 点击按钮随机选择一个技巧显示
3. **切换技巧**: 弹窗内可点击 "Next Tip" 切换到下一个随机技巧
4. **关闭弹窗**: 支持点击遮罩层、关闭按钮、按 ESC 键关闭

### 4.2 状态处理
- **空状态**: 技巧数据为空时显示加载提示
- **错误处理**: 加载失败时显示错误信息
- **计数显示**: 显示当前技巧总数

---

## 5. 技术实现

### 5.1 前端组件

#### 5.1.1 HTML 结构
```html
<!-- Logo 区域按钮 -->
<button class="btn-cc-tips" onclick="showRandomTip()">CC Tips</button>

<!-- 弹窗结构 -->
<div id="tips-modal" class="tips-modal-overlay">
  <div class="tips-modal">
    <div class="tips-modal-header">
      <span class="tips-modal-title">◈ CC Tips</span>
      <button class="tips-modal-close" onclick="hideRandomTip()">✕</button>
    </div>
    <div id="tip-display">...</div>
    <div class="tips-modal-footer">
      <span class="tip-count">Total: <span id="tip-count">0</span> tips</span>
      <button class="btn-next-tip" onclick="showRandomTip()">Next Tip</button>
    </div>
  </div>
</div>
```

#### 5.1.2 CSS 变量
```css
:root {
  --bg-primary: #0a0a0f;
  --bg-panel: #111118;
  --bg-card: #1a1a24;
  --text-primary: #e0e0e0;
  --text-secondary: #78716c;
  --cyan: #00d4ff;
  --border: rgba(0, 212, 255, 0.2);
}
```

#### 5.1.3 JavaScript 函数
```javascript
// 全局变量
let tipsData = [];
let isTipsModalOpen = false;

// 加载技巧
async function loadTips() {
  const response = await fetch('/docs/cc-tips/tips.json');
  const data = await response.json();
  tipsData = data.tips || [];
}

// 显示随机技巧
function showRandomTip() {
  const randomIndex = Math.floor(Math.random() * tipsData.length);
  const tip = tipsData[randomIndex];
  // 渲染弹窗内容
}

// 隐藏弹窗
function hideRandomTip() {
  document.getElementById('tips-modal').classList.remove('active');
}
```

### 5.2 后端路由

#### 5.2.1 静态文件服务
```javascript
// Serve docs/cc-tips/tips.json
if (url.startsWith('/docs/')) {
  const relativePath = url.replace('/docs/', '');
  const filePath = join(__dirname, 'docs', relativePath);
  if (await serveStatic(res, filePath))
    return;
}
```

---

## 6. 交互流程

```
用户点击 CC Tips 按钮
        ↓
检查 tipsData 是否已加载
        ↓
生成随机索引 → 获取技巧数据
        ↓
渲染弹窗内容
        ↓
用户操作:
  - 点击 Next Tip → 重新随机显示
  - 点击关闭按钮 → 关闭弹窗
  - 点击遮罩层 → 关闭弹窗
  - 按 ESC 键 → 关闭弹窗
```

---

## 7. 视觉规范

### 7.1 颜色
| 元素 | 颜色值 | 用途 |
|------|--------|------|
| 主边框 | `#00d4ff` | 按钮、弹窗边框 |
| 背景色 | `rgba(0, 212, 255, 0.1)` | 悬停背景 |
| 发光效果 | `rgba(0, 212, 255, 0.2)` | 阴影 |
| 文字色 | `#e0e0e0` | 主要内容 |
| 次要文字 | `#78716c` | 来源、计数 |

### 7.2 动画
```css
transition: all 0.2s;  /* 所有交互动画 */
@keyframes pulse { ... }  /* 未来可扩展 */
```

### 7.3 响应式
- 弹窗最大宽度：420px
- 移动端自适应：宽度 100%，保留边距

---

## 8. 文件清单

```
docs/cc-tips/
├── tips.json           # 技巧数据
└── cc-tips-design.md   # 设计文档（本文档）

frontend/
├── index.html          # 主页面（包含 CC Tips 功能）

server.js               # 服务器（添加 /docs/ 路由）
```

---

## 9. 验收标准

### 9.1 功能验收
- [ ] 页面加载时技巧数据正确加载
- [ ] 点击按钮弹出模态框
- [ ] 随机显示技巧内容正确
- [ ] Next Tip 按钮可切换技巧
- [ ] 三种关闭方式均可用（按钮、遮罩、ESC）
- [ ] 技巧总数正确显示

### 9.2 视觉验收
- [ ] 按钮样式与主题一致
- [ ] 弹窗样式符合设计规范
- [ ] 悬停效果正常
- [ ] 响应式布局正常

### 9.3 性能验收
- [ ] 技巧加载时间 < 500ms
- [ ] 弹窗响应时间 < 100ms
- [ ] 无内存泄漏

---

## 10. 后续优化

### 10.1 短期优化
- 按分类筛选技巧
- 标记已读技巧
- 收藏喜欢的技巧

### 10.2 长期优化
- 每日推荐一个技巧
- 用户贡献技巧
- 技巧评分系统

---

*文档版本：1.0*
*最后更新：2026-02-27*
