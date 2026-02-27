# 希卡之石 UI 设计规范

## 1. 颜色系统

### 1.1 基础色板

```css
:root {
  /* 背景色系 */
  --bg-primary: #0d1117;      /* 主背景 - 页面底色 */
  --bg-secondary: #161b22;    /* 次级背景 - 卡片、面板 */
  --bg-tertiary: #21262d;     /* 第三背景 - 悬停、选中 */
  --bg-elevated: #30363d;     /* 浮层背景 - 弹窗、菜单 */

  /* 边框色系 */
  --border-default: #30363d;  /* 默认边框 */
  --border-muted: #21262d;    /* 弱化边框 */
  --border-emphasis: #58a6ff; /* 强调边框（选中、焦点） */

  /* 文本色系 */
  --text-primary: #c9d1d9;    /* 主文本 - 标题、正文 */
  --text-secondary: #8b949e;  /* 次文本 - 描述、辅助信息 */
  --text-muted: #6e7681;      /* 弱化文本 - 占位符、禁用 */
  --text-inverse: #0d1117;    /* 反色文本 - 深色背景上的文字 */

  /* 功能色系 */
  --accent-blue: #58a6ff;     /* 强调蓝 - 链接、选中 */
  --accent-blue-hover: #79c0ff;
  --success-green: #2ea043;   /* 成功绿 - 完成状态 */
  --success-green-hover: #3fb950;
  --warning-yellow: #d29922;  /* 警告黄 - 进行中 */
  --warning-yellow-hover: #e3a328;
  --danger-red: #da3633;      /* 危险红 - 错误、删除 */
  --danger-red-hover: #f85149;

  /* 透明色系 */
  --overlay-black: rgba(0, 0, 0, 0.8);
  --overlay-white: rgba(255, 255, 255, 0.1);
}
```

### 1.2 颜色使用指南

| 场景 | 推荐颜色 | 示例 |
|------|----------|------|
| 页面背景 | `--bg-primary` | `<body background>` |
| 卡片背景 | `--bg-secondary` | 任务卡片、面板 |
| 按钮背景 | `--accent-blue` | 主操作按钮 |
| 成功状态 | `--success-green` | 完成标签 |
| 进行中 | `--warning-yellow` | 运行中标签 |
| 错误状态 | `--danger-red` | 错误提示 |
| 边框 | `--border-default` | 卡片边框 |
| 主文本 | `--text-primary` | 标题、内容 |
| 次文本 | `--text-secondary` | 时间、计数 |

---

## 2. 排版系统

### 2.1 字体栈

```css
:root {
  /* 等宽字体（终端、代码） */
  --font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', 'Cascadia Code', monospace;

  /* 系统字体（UI 文本） */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
}
```

### 2.2 字号层级

```css
:root {
  --text-xs: 0.75rem;    /* 12px - 标签、计数 */
  --text-sm: 0.875rem;   /* 14px - 辅助文本 */
  --text-base: 1rem;     /* 16px - 正文 */
  --text-lg: 1.125rem;   /* 18px - 小标题 */
  --text-xl: 1.25rem;    /* 20px - 卡片标题 */
  --text-2xl: 1.5rem;    /* 24px - 页面标题 */
  --text-3xl: 2rem;      /* 32px - 大标题 */
}
```

### 2.3 字重

```css
:root {
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
}
```

### 2.4 行高

```css
:root {
  --leading-none: 1;
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

---

## 3. 间距系统

### 3.1 基础单位 (4px 基准)

```css
:root {
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
}
```

### 3.2 间距使用指南

| 场景 | 间距值 | 说明 |
|------|--------|------|
| 元素内边距 | `--space-2` ~ `--space-4` | 按钮、标签内部 |
| 卡片内边距 | `--space-6` | 面板内容区 |
| 组件间距 | `--space-4` | 相邻元素 |
| 区块间距 | `--space-8` | 段落、区域 |
| 页面边距 | `--space-6` ~ `--space-10` | 容器 padding |

---

## 4. 圆角系统

```css
:root {
  --radius-none: 0;           /* 无圆角 */
  --radius-sm: 0.25rem;       /* 4px - 小按钮 */
  --radius-md: 0.375rem;      /* 6px - 默认按钮 */
  --radius-lg: 0.5rem;        /* 8px - 卡片 */
  --radius-xl: 0.75rem;       /* 12px - 大卡片 */
  --radius-2xl: 1rem;         /* 16px - 弹窗 */
  --radius-full: 9999px;      /* 圆形 - 头像、状态点 */
}
```

---

## 5. 阴影系统

```css
:root {
  /* 基础阴影 */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.4);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.5);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.6);

  /* 强调阴影（发光效果） */
  --glow-blue: 0 0 20px rgba(88, 166, 255, 0.4);
  --glow-green: 0 0 20px rgba(46, 160, 67, 0.4);
  --glow-yellow: 0 0 20px rgba(210, 153, 34, 0.4);
  --glow-red: 0 0 20px rgba(218, 54, 51, 0.4);
}
```

---

## 6. 动画系统

### 6.1 过渡时间

```css
:root {
  --duration-instant: 0ms;
  --duration-fast: 100ms;
  --duration-normal: 200ms;
  --duration-slow: 300ms;
  --duration-slower: 500ms;
}
```

### 6.2 缓动函数

```css
:root {
  --ease-linear: linear;
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
}
```

### 6.3 关键帧动画

```css
/* 脉冲动画（运行中状态） */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* 旋转动画（加载中） */
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 淡入动画 */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* 滑入动画 */
@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 缩放动画 */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

---

## 7. 组件样式

### 7.1 按钮

```css
/* 基础按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2) var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: var(--font-medium);
  line-height: var(--leading-none);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-in-out);
}

.btn:hover {
  background: var(--bg-elevated);
  border-color: var(--text-secondary);
}

.btn:active {
  transform: scale(0.98);
}

/* 主按钮 */
.btn-primary {
  color: var(--text-inverse);
  background: var(--accent-blue);
  border-color: transparent;
}

.btn-primary:hover {
  background: var(--accent-blue-hover);
}

/* 成功按钮 */
.btn-success {
  color: var(--text-inverse);
  background: var(--success-green);
  border-color: transparent;
}

.btn-success:hover {
  background: var(--success-green-hover);
}

/* 危险按钮 */
.btn-danger {
  color: var(--text-inverse);
  background: var(--danger-red);
  border-color: transparent;
}

.btn-danger:hover {
  background: var(--danger-red-hover);
}

/* 按钮尺寸 */
.btn-sm {
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
}

.btn-lg {
  padding: var(--space-3) var(--space-6);
  font-size: var(--text-base);
}
```

### 7.2 卡片

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-default);
}

.card-title {
  font-size: var(--text-sm);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-body {
  padding: var(--space-5);
}

.card-footer {
  padding: var(--space-4) var(--space-5);
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border-default);
}
```

### 7.3 状态标签

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-1) var(--space-2);
  font-size: var(--text-xs);
  font-weight: var(--font-medium);
  border-radius: var(--radius-full);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-running {
  color: var(--text-inverse);
  background: var(--accent-blue);
}

.badge-completed {
  color: var(--text-inverse);
  background: var(--success-green);
}

.badge-developing {
  color: var(--text-inverse);
  background: var(--warning-yellow);
}

.badge-stopped {
  color: var(--text-inverse);
  background: var(--danger-red);
}
```

### 7.4 状态指示器

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--text-muted);
}

.status-dot.running {
  background: var(--accent-blue);
  animation: pulse 2s var(--ease-in-out) infinite;
}

.status-dot.completed {
  background: var(--success-green);
}

.status-dot.stopped {
  background: var(--danger-red);
}
```

### 7.5 输入框

```css
.input {
  width: 100%;
  padding: var(--space-2) var(--space-3);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
  transition: border-color var(--duration-fast) var(--ease-in-out);
}

.input::placeholder {
  color: var(--text-muted);
}

.input:focus {
  outline: none;
  border-color: var(--accent-blue);
  box-shadow: var(--glow-blue);
}

.input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### 7.6 终端样式

```css
.terminal {
  background: var(--bg-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  line-height: var(--leading-relaxed);
  color: var(--text-primary);
  overflow: auto;
  min-height: 400px;
  max-height: 600px;
}

.terminal-prompt {
  color: var(--accent-blue);
}

.terminal-output {
  color: var(--text-secondary);
}

.terminal-error {
  color: var(--danger-red);
}

.terminal-success {
  color: var(--success-green);
}
```

### 7.7 弹窗/模态框

```css
.modal-overlay {
  position: fixed;
  inset: 0;
  background: var(--overlay-black);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
  animation: fadeIn var(--duration-normal) var(--ease-out);
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-2xl);
  padding: var(--space-6);
  width: 100%;
  max-width: 500px;
  box-shadow: var(--shadow-xl);
  animation: scaleIn var(--duration-normal) var(--ease-out);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-4);
  border-bottom: 1px solid var(--border-default);
}

.modal-title {
  font-size: var(--text-lg);
  font-weight: var(--font-semibold);
  color: var(--text-primary);
}

.modal-close {
  background: transparent;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  transition: all var(--duration-fast);
}

.modal-close:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  margin-top: var(--space-6);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border-default);
}
```

---

## 8. 布局工具类

```css
/* Flexbox */
.flex { display: flex; }
.flex-col { flex-direction: column; }
.items-center { align-items: center; }
.items-start { align-items: flex-start; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.gap-1 { gap: var(--space-1); }
.gap-2 { gap: var(--space-2); }
.gap-3 { gap: var(--space-3); }
.gap-4 { gap: var(--space-4); }
.gap-6 { gap: var(--space-6); }

/* Grid */
.grid { display: grid; }
.grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
.grid-cols-3 { grid-template-columns: repeat(3, 1fr); }

/* Spacing */
.p-0 { padding: 0; }
.p-2 { padding: var(--space-2); }
.p-4 { padding: var(--space-4); }
.p-6 { padding: var(--space-6); }
.px-4 { padding-inline: var(--space-4); }
.py-2 { padding-block: var(--space-2); }

/* Text */
.text-xs { font-size: var(--text-xs); }
.text-sm { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg { font-size: var(--text-lg); }
.text-primary { color: var(--text-primary); }
.text-secondary { color: var(--text-secondary); }
.text-muted { color: var(--text-muted); }
.font-medium { font-weight: var(--font-medium); }
.font-semibold { font-weight: var(--font-semibold); }

/* Utilities */
.hidden { display: none; }
.overflow-auto { overflow: auto; }
.rounded { border-radius: var(--radius-md); }
.rounded-lg { border-radius: var(--radius-lg); }
.border { border: 1px solid var(--border-default); }
```

---

## 9. 响应式断点

```css
/* 移动优先 */
@media (min-width: 640px) {
  /* sm: ≥640px */
}

@media (min-width: 768px) {
  /* md: ≥768px */
}

@media (min-width: 1024px) {
  /* lg: ≥1024px */
}

@media (min-width: 1280px) {
  /* xl: ≥1280px */
}
```

---

## 10. 设计检查清单

### 10.1 颜色使用
- [ ] 背景色使用正确的层级
- [ ] 文本颜色符合对比度要求
- [ ] 状态颜色一致（绿=完成，黄=进行中，红=错误）

### 10.2 间距一致
- [ ] 使用 4px 基准系统
- [ ] 卡片内边距统一
- [ ] 组件间距统一

### 10.3 动画流畅
- [ ] 过渡时间适中（100-300ms）
- [ ] 缓动函数自然
- [ ] 动画不卡顿

### 10.4 响应式
- [ ] 移动端优先
- [ ] 断点测试通过
- [ ] 触摸友好（按钮 ≥ 44px）

---

*最后更新：2026-02-27*
