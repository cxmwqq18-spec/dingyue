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

## 7. 生产变更单（待审批）

目标 `.env.local`（当前 release 根目录，部署脚本会复制到新 release）：

```
STOREFRONT_SNAPSHOT_CACHE_SITES=site_aidreamcapes
STOREFRONT_SNAPSHOT_CACHE_MAX=512
STOREFRONT_SNAPSHOT_CACHE_TTL_MS=300000
```

执行步骤：

1. 部署新迁移（`prisma migrate deploy` 已在发布脚本内执行），
   确认生产 `SiteContentRevision` 触发器数量由 15 增至 18。
2. 写 `.env.local`，`systemctl restart aidreamcapes.service`。
   重启期间 Nginx 会返回 503 维护页（`error_page 502 503 504 =503 /__maintenance`）。
3. 顺序爬取 178 个 sitemap URL 两遍，记录 TTFB p50/p90、`MemoryCurrent`。
4. `systemctl show aidreamcapes.service -p MemoryCurrent` 应 < 2.5 GB。

回滚：把 `STOREFRONT_SNAPSHOT_CACHE_MAX` 改回 `8`、`TTL` 改回 `300000`，
重启即可，不涉及数据变更。

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

- 生产 `MAX=512` 变更需要停服务窗口，待审批。
- `SiteContentRevision` 触发器守卫仍写死 `site_aidreamcapes`；缓存扩容到其他
  站点前需要另开迁移放宽守卫。
- `VideoThemeExample` 缺口今天不产生可见错误（该站点当前不投影 video themes），
  迁移属于前瞻性修复。
- P0-2（传输层重复 `ssr` 计时）未开始。
