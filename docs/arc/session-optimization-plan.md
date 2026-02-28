# Session 读取逻辑优化计划

**文档版本**: v1.1
**创建日期**: 2026-02-28
**状态**: ✅ 已完成

---

## 目录

1. [Context](#context)
2. [当前架构分析](#当前架构分析)
3. [性能瓶颈](#性能瓶颈)
4. [优化方案对比](#优化方案对比)
5. [推荐实施方案](#推荐实施方案)
6. [详细实现规格](#详细实现规格)
7. [验证方法](#验证方法)
8. [预期效果](#预期效果)

---

## Context

用户请求优化 ClaudePad 的 Session 读取和显示逻辑。当前系统加载 92 个 sessions 时存在性能瓶颈，需要加速数据读取和优化显示。

**当前问题：**
1. 每次 API 调用都重新读取和解析 `history.jsonl` 文件
2. 对每个 session 目录进行并发文件系统操作
3. 前端每 10 秒自动刷新，导致重复 I/O
4. 没有缓存机制
5. `tokenCount` 字段未实现（始终为 0）
6. 没有分页或限制显示数量

---

## 当前架构分析

### 后端数据流 (`server.ts`)

```
~/.claude/history.jsonl (590+ lines)
    ↓ parseHistory() → Map<string, SessionMetadata>

~/.claude/session-env/ (92 directories)
    ↓ readdir() → ids.map() → Promise.all

getSessions() → Array<Session> (85-92 items)
    ↓ JSON response

前端 /api/sessions
    ↓ fetch() + render
```

### 当前代码分析

**关键函数** (`server.ts:21-57`):

```typescript
async function parseHistory(): Promise<Map<string, { name: string; timestamp: number; project: string }>> {
  const sessions = new Map();
  try {
    const content = await readFile(join(CLAUDE_DIR, 'history.jsonl'), 'utf-8');
    content.trim().split('\n').filter(l => l).forEach(line => {
      const { sessionId, display, timestamp, project } = JSON.parse(line);
      if (sessionId && !sessions.has(sessionId)) {
        sessions.set(sessionId, { name: display?.slice(0, 50) || 'Session', timestamp, project });
      }
    });
  } catch (e: any) { console.error('History parse error:', e.message); }
  return sessions;
}

async function getSessions(): Promise<any[]> {
  try {
    const dir = join(CLAUDE_DIR, 'session-env');
    const ids = await readdir(dir);
    const history = await parseHistory();  // 每次都重新解析！
    return (await Promise.all(ids.map(async id => {
      const h = history.get(id);
      const ts = h?.timestamp || Date.now();
      const status = ts > Date.now() - 3600000 ? 'running' : 'completed';
      const duration = Math.floor((Date.now() - ts) / 1000);
      return {
        id,
        name: h?.name || id.slice(0, 8),
        status,
        startTime: new Date(ts).toISOString(),
        projectPath: h?.project || process.cwd(),
        lastActivity: new Date(ts).toISOString(),
        duration,
        tokenCount: 0  // 未实现
      };
    }))).filter(s => s).sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  } catch (e: any) { console.error(e); return []; }
}
```

---

## 性能瓶颈

| 瓶颈点 | 描述 | 影响 |
|--------|------|------|
| **历史文件解析** | 每次请求解析 590+ 行 JSONL | ~50ms 延迟 |
| **目录遍历** | 92 个 session 目录的并发操作 | ~30-50ms 延迟 |
| **无缓存** | 10 秒刷新间隔内重复 I/O | 10 次请求 = 10 次磁盘读取 |
| **全量加载** | 即使只显示前 20 个也加载全部 | 浪费带宽和内存 |
| **tokenCount 未实现** | 需要额外计算逻辑 | 功能缺失 |

---

## 优化方案对比

### 方案 A: 内存缓存 + 惰性计算 (推荐)

**核心思路**: 在服务器内存中缓存 session 数据，定时刷新而非每次请求都读取。

**实现细节**:

```typescript
interface CachedData {
  sessions: any[];
  timestamp: number;
  expiresAt: number;
}

let sessionCache: CachedData | null = null;
const CACHE_TTL = 5000; // 5 秒有效期

async function getSessions(): Promise<any[]> {
  const now = Date.now();

  // 检查缓存是否有效
  if (sessionCache && now < sessionCache.expiresAt) {
    return sessionCache.sessions;
  }

  // 缓存失效，重新加载
  const sessions = await loadSessionsFromDisk();
  sessionCache = {
    sessions,
    timestamp: now,
    expiresAt: now + CACHE_TTL
  };
  return sessions;
}
```

| 优点 | 缺点 |
|------|------|
| 实现简单，改动最小 | 数据可能有最多 5 秒延迟 |
| 显著减少磁盘 I/O | 服务器重启后缓存丢失 |
| 响应延迟从 ~100ms 降至 ~5ms | 内存占用略增 |

### 方案 B: JSON 文件缓存 (用户建议)

**核心思路**: 将解析后的 session 数据缓存到项目 `data` 目录的 JSON 文件中。

**实现细节**:

```typescript
const CACHE_FILE = join(process.cwd(), 'data', 'cache', 'sessions.json');

async function getCachedSessions(): Promise<any[]> {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8');
    const { sessions, timestamp } = JSON.parse(content);

    // 检查缓存是否过期 (5 分钟)
    if (Date.now() - timestamp < 300000) {
      return sessions;
    }
  } catch (e) {
    // 缓存不存在或损坏，继续加载
  }

  // 从磁盘加载并更新缓存
  const sessions = await loadSessionsFromDisk();
  await writeFile(CACHE_FILE, JSON.stringify({
    sessions,
    timestamp: Date.now()
  }), 'utf-8');

  return sessions;
}
```

| 优点 | 缺点 |
|------|------|
| 服务器重启后缓存仍然有效 | 需要额外的文件写入操作 |
| 减少 Claude 目录的 I/O 压力 | 缓存更新有延迟 |
| 可以保存更多历史数据用于分析 | 增加磁盘占用 |

### 方案 C: 混合方案 (最佳实践)

结合方案 A 和 B:
1. **第一层**: 内存缓存 (TTL: 5 秒) - 处理频繁刷新
2. **第二层**: JSON 文件缓存 (TTL: 5 分钟) - 处理服务器重启
3. **第三层**: 原始数据源 - 当两层缓存都失效时使用

---

## 推荐实施方案

### 阶段 1: 内存缓存 (✅ 已完成)

- [x] 添加 `sessionCache` 变量
- [x] 修改 `getSessions()` 支持缓存
- [x] 设置合理的 TTL (5 秒)

### 阶段 2: 限制返回数量 (✅ 已完成)

- [x] 添加 `limit` 参数 (默认 20)
- [x] 添加 `offset` 参数用于分页
- [x] 前端只显示最近的 20-50 个 session

### 阶段 3: JSON 文件缓存 (✅ 已完成)

- [x] 创建 `.cache/` 目录
- [x] 实现文件缓存逻辑
- [x] 添加缓存刷新机制

### 阶段 4: 前端优化 (✅ 已完成)

- [x] 增加分页 UI
- [x] 添加"上一页/下一页"按钮
- [x] 每页数量选择器 (10/20/50)
- [x] Running session 的 Duration 实时更新（每秒）

### 阶段 5: Terminal 启动优化 (✅ 已完成)

- [x] 实现终端预启动池 (TERMINAL_POOL_SIZE=3)
- [x] 点击 session 直接跳转，无需等待
- [x] 后台异步启动 claude --resume
- [x] 空闲终端自动清理 (5 分钟超时)
- [x] 终端池自动补充 (每 2 分钟)

### 阶段 6: Session 状态判断优化 (✅ 已完成)

- [x] 修复状态判断逻辑（基于时间戳）
  - `running`: < 30 分钟
  - `idle`: 30 分钟 - 2 小时
  - `completed`: > 2 小时
- [x] 前端支持多状态显示（Running/Idle/Completed）
- [x] 首页状态统计显示所有状态
- [x] Terminal 页面显示正确的 session 状态

---

## 详细实现规格

### 阶段 1+2: 内存缓存 + 分页

```typescript
// server.ts - 优化后的实现

interface CachedData {
  sessions: any[];
  timestamp: number;
  expiresAt: number;
}

let sessionCache: CachedData | null = null;
const CACHE_TTL = 5000; // 5 秒有效期
const MAX_SESSIONS = 50; // 最多返回 50 个 session

// 从磁盘加载 session 数据的函数
async function loadSessionsFromDisk(): Promise<any[]> {
  try {
    const dir = join(CLAUDE_DIR, 'session-env');
    const ids = await readdir(dir);
    const history = await parseHistory();

    const sessions = await Promise.all(ids.map(async id => {
      const h = history.get(id);
      const ts = h?.timestamp || Date.now();
      const status = ts > Date.now() - 3600000 ? 'running' : 'completed';
      const duration = Math.floor((Date.now() - ts) / 1000);
      return {
        id,
        name: h?.name || id.slice(0, 8),
        status,
        startTime: new Date(ts).toISOString(),
        projectPath: h?.project || process.cwd(),
        lastActivity: new Date(ts).toISOString(),
        duration,
        tokenCount: 0 // TODO: 实现 token 计数逻辑
      };
    }));

    return sessions
      .filter(s => s)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  } catch (e: any) {
    console.error(e);
    return [];
  }
}

// 主函数：带缓存和分页
async function getSessions(limit?: number, offset?: number): Promise<any[]> {
  const now = Date.now();

  // 检查缓存是否有效
  if (sessionCache && now < sessionCache.expiresAt) {
    const sessions = sessionCache.sessions;
    // 应用分页
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    return sessions.slice(start, end);
  }

  // 缓存失效，重新加载
  const allSessions = await loadSessionsFromDisk();
  const sessions = limit ? allSessions.slice(0, limit) : allSessions.slice(0, MAX_SESSIONS);

  sessionCache = {
    sessions,
    timestamp: now,
    expiresAt: now + CACHE_TTL
  };

  return sessions;
}

// 更新 API 路由支持分页参数
// GET /api/sessions?limit=20&offset=0
if (url === '/api/sessions' && method === 'GET') {
  const urlObj = new URL(url, `http://${req.headers.host}`);
  const limit = parseInt(urlObj.searchParams.get('limit') || '20');
  const offset = parseInt(urlObj.searchParams.get('offset') || '0');
  return json(res, {
    sessions: await getSessions(limit, offset),
    pagination: { limit, offset }
  });
}
```

### 阶段 3: JSON 文件缓存

```typescript
const CACHE_DIR = join(process.cwd(), 'data', 'cache');
const CACHE_FILE = join(CACHE_DIR, 'sessions.json');
const FILE_CACHE_TTL = 300000; // 5 分钟

// 确保缓存目录存在
async function ensureCacheDir(): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
}

// 从文件缓存加载
async function loadFromFileCache(): Promise<{ sessions: any[]; timestamp: number } | null> {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8');
    const data = JSON.parse(content);
    if (Date.now() - data.timestamp < FILE_CACHE_TTL) {
      return data;
    }
  } catch (e) {
    // 缓存不存在或损坏
  }
  return null;
}

// 保存到文件缓存
async function saveToFileCache(sessions: any[]): Promise<void> {
  try {
    await ensureCacheDir();
    await writeFile(CACHE_FILE, JSON.stringify({
      sessions,
      timestamp: Date.now()
    }, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save file cache:', e);
  }
}

// 完整的缓存策略
async function getSessions(limit?: number, offset?: number): Promise<any[]> {
  const now = Date.now();

  // 1. 检查内存缓存
  if (sessionCache && now < sessionCache.expiresAt) {
    const sessions = sessionCache.sessions;
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    return sessions.slice(start, end);
  }

  // 2. 检查文件缓存
  const fileCache = await loadFromFileCache();
  if (fileCache) {
    // 更新内存缓存
    sessionCache = {
      sessions: fileCache.sessions,
      timestamp: now,
      expiresAt: now + CACHE_TTL
    };
    const sessions = limit
      ? fileCache.sessions.slice(0, limit)
      : fileCache.sessions.slice(0, MAX_SESSIONS);
    return sessions;
  }

  // 3. 从磁盘加载
  const allSessions = await loadSessionsFromDisk();
  const sessions = limit
    ? allSessions.slice(0, limit)
    : allSessions.slice(0, MAX_SESSIONS);

  // 更新两层缓存
  sessionCache = {
    sessions,
    timestamp: now,
    expiresAt: now + CACHE_TTL
  };
  await saveToFileCache(allSessions);

  return sessions;
}
```

---

## 验证方法

### 1. 性能测试

```bash
# 测量 API 响应时间
time curl http://localhost:8080/api/sessions

# 第一次请求 (缓存未命中)
# 第二次请求 (缓存命中) - 应该快 10-20 倍
```

### 2. 日志输出

```typescript
const start = Date.now();
const sessions = await getSessions();
console.log(`Sessions loaded: ${sessions.length} in ${Date.now() - start}ms`);

// 添加缓存命中率日志
let cacheHits = 0;
let cacheMisses = 0;

async function getSessions(): Promise<any[]> {
  const now = Date.now();
  if (sessionCache && now < sessionCache.expiresAt) {
    cacheHits++;
    console.log(`[Cache HIT] Total hits: ${cacheHits}`);
    return sessionCache.sessions;
  }
  cacheMisses++;
  console.log(`[Cache MISS] Total misses: ${cacheMisses}`);
  // ...
}
```

### 3. 前端验证

- 打开浏览器 DevTools Network 面板
- 观察 `/api/sessions` 请求的响应时间
- 确认缓存命中后响应时间显著降低

---

## 预期效果

| 指标 | 优化前 | 优化后 (方案 A) | 优化后 (方案 C) |
|------|--------|----------------|-----------------|
| 首次加载 | ~100ms | ~100ms | ~100ms |
| 缓存命中 | N/A | ~5ms | ~1ms |
| 磁盘 I/O | 每次请求 | 每 5 秒 1 次 | 每 5 分钟 1 次 |
| 内存占用 | 低 | 中 | 中 |
| 实现复杂度 | - | 低 | 中 |

---

## 关键文件路径

| 文件 | 用途 | 状态 |
|------|------|------|
| `/home/yangjing/ClaudePad/server.ts` | 后端逻辑 (主要修改) | ✅ 已优化 |
| `/home/yangjing/ClaudePad/frontend/index.html` | 前端显示 (添加分页) | ✅ 已优化 |
| `/home/yangjing/ClaudePad/.cache/sessions.json` | 缓存文件 | ✅ 已创建 |

---

## 附录：Token 计数实现 (未来扩展)

```typescript
async function getTokenCount(sessionId: string): Promise<number> {
  try {
    const sessionDir = join(CLAUDE_DIR, 'session-env', sessionId);
    const files = await readdir(sessionDir);
    const logFiles = files.filter(f => f.endsWith('.jsonl'));

    let totalTokens = 0;
    for (const file of logFiles) {
      const content = await readFile(join(sessionDir, file), 'utf-8');
      for (const line of content.trim().split('\n').filter(l => l)) {
        const entry = JSON.parse(line);
        totalTokens += entry.usage?.input_tokens || 0;
        totalTokens += entry.usage?.output_tokens || 0;
      }
    }
    return totalTokens;
  } catch (e) {
    return 0;
  }
}
```

---

## 变更日志

| 版本 | 日期 | 变更内容 |
|------|------|----------|
| v1.0 | 2026-02-28 | 初始文档创建 |
| v1.1 | 2026-02-28 | 完成所有优化阶段：<br>- 实现内存缓存 + 文件缓存混合方案<br>- 添加分页支持 (limit/offset)<br>- 前端分页 UI<br>- Running session 的 Duration 实时更新 |
| v1.2 | 2026-02-28 | Terminal 启动优化：<br>- 实现终端预启动池 (3 个 session)<br>- 点击 session 直接跳转，无需等待<br>- 空闲终端自动清理 (5 分钟)<br>- 终端池自动补充 (每 2 分钟) |
