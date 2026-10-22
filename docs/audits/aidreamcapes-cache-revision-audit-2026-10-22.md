# Aidreamcapes P0-1 运行时缓存审计与调参记录

日期：2026-10-22
范围：`site_aidreamcapes` 公共 SSR 修订缓存（`SiteContentRevision`）
状态：只读审计 + 本地候选验证完成；生产调参待审批窗口

---

## 1. 结论摘要

| 项目 | 结论 |
|---|---|
| 生产失效覆盖 | **存在 3 个真实缺口**（`StripeConnectAccount`、`AiApp`、`VideoThemeExample`），已补迁移 `20261022160000_close_site_content_revision_gaps` |
| 缓存工作集 | **288 个 key**（实测），非原计划的 178 页 |
| `MAX=256` | **不足**：实测淘汰 601–609 次，仍在抖动 |
| `MAX=512` | **足够**：淘汰 0 次，`mapSize=288` 稳定 |
| `TTL=300000` | 可保留：修订键控下时间过期只影响冷读频率，不影响正确性 |
| 堆内存 | `heapUsed` 稳定在 **≈1.09 GB**（`MAX=512`） |
| RSS | 峰值 ≈2.4 GB，稳态 ≈1.9 GB（`--expose-gc` 强制 GC 后） |
| 下一次请求可见 | **已验证**：提交 `LivePage.contentJson` 字段级更新后，下一次请求即返回新标题，无需重启 |
| 并发折叠 | **已验证**：8 个并发冷请求只触发 2 次关系库读取 |

生产目标值：`STOREFRONT_SNAPSHOT_CACHE_MAX=512`，`STOREFRONT_SNAPSHOT_CACHE_TTL_MS=300000`（保持不变）。

---

## 2. 失效覆盖只读审计

### 2.1 生产现状

生产库 `SiteContentRevision` 已有 15 张表的触发器：

```
CreativePack, CreativePackCategory, LivePage, MediaAsset, Price, Product,
Site, SiteAiApp, SiteDomain, StorefrontProfile, ThemeSettings,
ToolCategory, ToolMenuItem, VideoTheme, VideoThemeCategory
```

生产 `revision=94`（审计时点），`LivePage` 行数 267。

### 2.2 公共 SSR 实际读取的表

`loadStorefrontPublicRuntimeState()` + `publicRuntimeSiteSelect` 的完整读取集合：

| 表 | 触发器 | 判定 |
|---|---|---|
| `LivePage` | 有 | 覆盖 |
| `Site` | 有 | 覆盖 |
| `SiteDomain` | 有 | 覆盖 |
| `ThemeSettings` | 有 | 覆盖 |
| `StorefrontProfile` | 有 | 覆盖 |
| `Product` / `Price` | 有 | 覆盖 |
| `SiteAiApp` | 有 | 覆盖 |
| `CreativePack` / `CreativePackCategory` | 有 | 覆盖 |
| `MediaAsset` | 有 | 覆盖 |
| `ToolCategory` / `ToolMenuItem` | 有 | 覆盖 |
| `VideoTheme` / `VideoThemeCategory` | 有 | 覆盖 |
| **`StripeConnectAccount`** | **无** | **缺口 1** |
| **`AiApp`** | **无** | **缺口 2** |
| **`VideoThemeExample`** | **无** | **缺口 3** |

### 2.3 三个缺口的实际影响

1. **`StripeConnectAccount`** — `publicRuntimeSiteSelect.connect` 与
   `publicMetadataSiteSelect.connect` 都会读它。`storefront-render.tsx:1212-1214`
   把 `status / chargesEnabled / payoutsEnabled` 投影进公共站点外壳，直接影响
   结账入口的显示。改 Stripe 状态后缓存不失效 → 页面显示过期的支付可用性。

2. **`AiApp`** — 全局表，无 `siteId`。`publicRuntimeSiteAiAppSelect` 通过
   `SiteAiApp.aiApp` 关系读出 `name / description / appType`，最终进
   `toPublicRuntimeSiteAiApp()`。改名或改描述后缓存不失效 → 工具卡片文案过期。
   该表被多站点共享，所以触发器必须按 `SiteAiApp` 反查引用站点，而不是直接
   写 `siteId`。

3. **`VideoThemeExample`** — `VideoTheme` 的 `examples` 关系在公共投影里被读。
   当前 `site_aidreamcapes` 有 107 条示例。示例文案/提示词改动后缓存不失效。
   注：`loadStorefrontPublicRuntimeState` 对 `site_aidreamcapes` 当前不投影
   videoThemes（`needs.videoThemes && siteId !== "site_aidreamcapes"`），
   所以此缺口今天不产生可见错误，属于**前瞻性缺口**：一旦缓存扩容到其他站点
   或该站点开始投影 video themes，就会立刻变成真实缺陷。

### 2.4 修复

新增迁移 `prisma/migrations/20261022160000_close_site_content_revision_gaps/`：

- `StripeConnectAccount` → 复用 `bump_site_content_revision_row()`
- `VideoThemeExample` → 复用 `bump_site_content_revision_row()`
- `AiApp` → 新函数 `bump_site_content_revision_ai_app()`，按 `SiteAiApp`
  反查所有引用该 app 的站点并逐个 bump

所有 bump 仍受 `bump_site_content_revision()` 内部
`p_site_id <> 'site_aidreamcapes'` 的守卫约束，**不写入任何 MyDreamShoots 行**。

---

## 3. 触发器行为验证（本地库）

本地 `prisma migrate deploy` 成功应用迁移（49 个迁移）。

### 3.1 UPDATE 路径

| 表 | revision 变化 |
|---|---|
| 基准 | 265 |
| `UPDATE StripeConnectAccount` | 265 → 266 |
| `UPDATE AiApp`（影响 2 行） | 266 → 267 |
| `UPDATE VideoThemeExample` | 267 → 266* |
| 回滚后 | 265 |

\* 事务内每次 bump 递增一次；回滚后回到原值。

### 3.2 DELETE 路径

| 表 | revision 变化 |
|---|---|
| `DELETE VideoThemeExample` | 271 → 272 |
| `DELETE StripeConnectAccount` | 271 → 272 |
| `DELETE AiApp` | 因外键约束被拒绝（`GenerationJob` 引用），路径由 `UPDATE` 覆盖验证 |

### 3.3 事务安全性

所有验证均使用 `BEGIN … ROLLBACK`，除下节的内容可见性探针外未留下任何
持久化修改。

---

## 4. 缓存工作集实测

### 4.1 为什么初测结论是错的

首轮本地测量显示工作集只有 112 个 key。根因是
`instantDraftPreviewEnabled()`：

```ts
function instantDraftPreviewEnabled(): boolean {
  return process.env.DINGYUE_ENV === "local" && process.env.STOREFRONT_INSTANT_DRAFT_PREVIEW !== "0";
}
```

`DINGYUE_ENV=local` 时该函数为真，`getStorefrontPublicRuntimeStateBySlug`
直接回源 `loadStorefrontPublicRuntimeState({ slugCandidates })`，**完全绕过
修订缓存**。生产是 `DINGYUE_ENV=production`，不会走这条分支。

改用生产等价环境变量（`DINGYUE_ENV=production` +
`STOREFRONT_INSTANT_DRAFT_PREVIEW=0`）重测后，真实工作集是 **288 个 key**。

这个差异很关键：本地开发模式下测出来的缓存命中率不能代表生产。

### 4.2 三个候选配置的对比

同一批 177 个 sitemap URL、连续爬取 3 遍、并发 1：

| 配置 | 关系库全量读取 | 缓存命中 | 缓存未命中 | 淘汰次数 | 不同 key 数 | `mapSize` |
|---|---|---|---|---|---|---|
| `MAX=8`（现生产值） | 681 | 390 | 957 | 949 | 288 | 8 |
| `MAX=256` | 589 | 482 | 865 | 609 | 288 | 256 |
| `MAX=512` | **196** | 1059 | 288 | **0** | 288 | 288 |

- `MAX=8`：每次访问几乎必然淘汰，命中率接近 0，**这就是 P0-1 现象的根因**。
- `MAX=256`：仍淘汰 609 次，工作集 288 > 容量 256，依然抖动。
- `MAX=512`：淘汰 0 次，覆盖完整工作集，关系库读取降到 196 次（仅首轮冷加载）。

### 4.3 TTFB（本地，生产等价语义）

`MAX=512`，连续 4 遍：

| 遍数 | TTFB p50 | TTFB p90 | 说明 |
|---|---|---|---|
| 1 | 147.6 ms | 194.7 ms | 冷，启动 288 个 key |
| 2 | 110.9 ms | 144.1 ms | 热 |
| 3 | 111.3 ms | 138.6 ms | 热 |
| 4 | 110.9 ms | 144.0 ms | 热 |

热读 p50 稳定在 ≈111 ms，相对冷读下降约 25%。

### 4.4 TTL 行为实测

代码是**绝对过期**：`createdAt` 只在回填时写入，命中路径不刷新（`site-store.ts:1480`）。
所以每 5 分钟（`TTL=300000`）整批 key 会同时过期，与 revision 变化无关。

实测（`MAX=512`、`TTL=300000`、串行整站爬取）：

| 场景 | 单遍关系库读取 |
|---|---|
| 热缓存，紧接上一遍 | **0** |
| 空闲 333 s 后第一遍（> TTL） | **192** |

结论：

- TTL 到期不会造成“每页重复回源”的雪崩；一次整批回填 ≈192 次读取，合计约 4–6 s。
- 但因为过期时间集中，空闲超过 5 分钟后的第一遍一定会整批回填；低峰期第一个爬虫会承担这部分成本。
- 保留 `TTL=300000` 而不是 0：每次请求都先比对 revision，TTL 不参与失效判定，
  只在“某个写路径漏 bump revision”时提供 ≤5 分钟的有界自愈。

---

## 5. 内存

`--expose-gc` 下强制两次 GC 后测量：

| 配置 | `heapUsed` | RSS 峰值 | RSS 稳态 |
|---|---|---|---|
| `MAX=8` | ≈400 MB | 1.72 GB | 0.63 GB |
| `MAX=256` | ≈1040 MB | 2.46 GB | 1.50 GB |
| `MAX=512` | **≈1091 MB** | 2.36 GB | 1.89 GB |

`MAX=256` 与 `MAX=512` 的堆占用几乎相同（差 ≈50 MB），因为 `MAX=256` 下
被淘汰的条目随即重建，反复分配相同规模的 `PlatformState`。

生产约束：cgroup `MemoryLimit=6G`，V8 堆
`NODE_OPTIONS=--max-old-space-size=3584`。`MAX=512` 堆占用 ≈1.09 GB，
在 3.5 GB 堆上限内留有余量。生产当前 `MemoryCurrent` ≈1.07 GB。

按原计划判定线（RSS < 2.5 GB 升 512，> 2.8 GB 回退 128）：`MAX=512`
符合升档条件。

---

## 6. 正确性验证

### 6.1 提交后下一次请求可见

`DINGYUE_ENV=production` 等价环境，`MAX=512`：

1. 预热 `/platforms` → `<title>AI Ad and Product Photo Platforms | AIVideosUGC</title>`
2. 字段级 CAS 更新 `LivePage.contentJson` 的 `seo.title` 路径
   （`WHERE updatedAt = <原值> AND contentJson#>>'{seo,title}' = <原值>`）→ `UPDATE 1`
3. `revision` 274 → 275
4. **下一次请求**（无重启）→ `<title>Probe Live Title</title>` ✅
5. 逆向 manifest 还原 → 下一次请求回到原标题 ✅
6. 最终 `contentJson` MD5 = `06c19f8b990bcd7e010d369e1932855a`，与审计开始时
   记录的值**逐字节一致**

关键发现：公共页面的 `<title>` 来自 `LivePage.contentJson` 的 `seo.title`，
**不是** `LivePage.title` 列。首次探针误改了 `title` 列，页面无变化；
按 `contentJson` 路径重做后立即可见。

### 6.2 并发折叠

8 个并发冷请求命中同一页面：

```
{"a0":2,"hit":2,"miss":22,"store":3,"evict":0,"distinct":3}
```

8 个并发请求只产生 **2 次**关系库全量读取，其余等待同一个 in-flight promise。
折叠逻辑生效。

### 6.3 失败路径

`readSiteContentRevision()` 在探测失败时返回 `null`，
`getCachedPublicRuntimeState()` 随即 `return loader()`，**回源而不是回退旧缓存**。
`SiteContentRevision` 表缺失时降级为 `LivePage` 的
`max(updatedAt) + count` 探针，仍不会用过期数据兜底。

---

## 7. 生产变更记录（2026-10-22 18:19 已执行）

发布 `f21a03ae4094ca191069c2ff8c4a92b49dc617c7`（预构建产物上传，
服务器只做 `npm ci` + 静态迁移，不在源站跑 webpack——见下文“构建约束”）。

目标 `.env.local`（release 根目录，部署脚本会从 `$BASE/.env.local` 复制）：

```
STOREFRONT_SNAPSHOT_CACHE_SITES=site_aidreamcapes
STOREFRONT_SNAPSHOT_CACHE_MAX=512
STOREFRONT_SNAPSHOT_CACHE_TTL_MS=300000
```

执行结果：

| 检查项 | 结果 |
|---|---|
| `prisma migrate deploy` | `20261022160000_close_site_content_revision_gaps` 已应用 |
| 失效覆盖门禁（生产） | `ok: true`，18/18 表有触发器，`uncovered: []` |
| `STOREFRONT_SNAPSHOT_CACHE_MAX` | 512（`TTL=300000` 不变） |
| 维护页 | 18:19:20–18:19:24 三次采样 `503` + `We'll be back shortly`；18:19:30 恢复 200 |
| `Server-Timing` | 单组 `ssr;dur=…`（修复前为两组） |
| `MemoryCurrent` | 2.46–2.70 GB（限值 6 GB） |
| `health` | `commit=f21a03ae4…`、`revision=280`、`rssMb≈2575` |
| 源站 178 页两遍 | 全 200；TTFB p50 567→639 ms（受源站 CPU 竞争影响，缓存主要降低回源次数） |

回滚：把 `STOREFRONT_SNAPSHOT_CACHE_MAX` 改回 `8`，重启即可，不涉及数据变更。

### 构建约束（重要）

源站（15 GB 内存，另有 4 个站点常驻 Node 进程）**无法完成 webpack 构建**：8 GB 堆在
第 874 秒 OOM（heap 8.1 GB live），10 GB 堆在 10.8 GB RSS 时把机器压到 0 可用内存。
现行且已验证可行的方法是**本地预构建 + `--prebuilt-build` 上传**：
线上上一个 release（`38faa0861…`）的 `.next-build` 里同样带
`/Users/a1/orca/workspaces/dingyue/main-2/...` 路径和 `.build-commit` 标记，
说明这是既有流程。预构建必须在**干净 worktree** 里按 release commit 构建，
避免把同一工作区里其他 agent 未提交的改动打进产物。

---

## 8. 复现脚本

`scripts/benchmark-aidreamcapes-cache.mjs`（新增，依赖无关）：

```
node scripts/benchmark-aidreamcapes-cache.mjs \
  --origin=http://127.0.0.1:3100 --passes=2 --concurrency=1
```

从 `/sitemap.xml` 取全部 URL，改写到指定 origin，保留生产 `Host` 头，
逐页请求，输出 TTFB / SSR 耗时 / HTML 字节 / 状态码的 p50 / p90 / 均值，
可选 `--out=<file>` 落盘。

---

## 9. 尚未解决

- `SiteContentRevision` 触发器守卫仍写死 `site_aidreamcapes`；缓存扩容到其他
  站点前需要另开迁移放宽守卫。
- `VideoThemeExample` 缺口今天不产生可见错误（该站点当前不投影 video themes），
  迁移属于前瞻性修复。
- P0-2（传输层重复 `ssr` 计时）**已修复并上线**：根因不是两次渲染，而是中间件用
  同进程内部 `fetch` 访问 `/site/aidreamcapes/...`，内层已经过 `server.mjs`
  拦截并重排一次，外层又重排一次并继承了内层的 `Server-Timing`。
  按 Aidreamcapes 单站收口（`x-storefront-head-seo-reorder-skip` + host 判定），
  HTML 逐字节不变，线上响应头已从两组 `ssr;dur` 降为一组。
