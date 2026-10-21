# AIVideosUGC 生产 SSR 内存稳定性整改计划（2026-10-21）

> 状态：待评审；P0 配置变更需明确批准后执行
> 站点范围：`site_aidreamcapes`（`www.aivideosugc.com` / `www.aidreamcapes.com`，服务 `aidreamcapes.service`，端口 3013）
> 触发事件：2026-10-21 线上流程测试中，16 并发抓取 sitemap 的 177 条 URL，生产 Node 进程两次 OOM
> 与既有文档的关系：本文只处理「生产 SSR 容量与内存稳定性」，不改动
> `aidreamcapes-media-detail-link-remediation-2026-10-21.md` 已上线的媒体详情页行为

---

## 0. 结论摘要

媒体详情整改本身没有引入这次崩溃：新增详情页 4 并发实测 200、耗时 0.37–0.55s、RSS 仅 +10MB；
崩溃发生在大量**既有重页面**并发 SSR 时。根因是四件事叠加：

1. 入口没有并发/速率上限（Nginx `location /` 直接反代，无 `limit_conn`/`limit_req`）；
2. 每次公开页请求都在一个 `RepeatableRead` 事务里加载站点公开数据，并重建整站发布投影
   （`createPublishedSiteSnapshot`），主加载器**没有跨请求缓存**（`siteReadCache.get(..., 0)`）；
3. 数据库连接池只有 `connection_limit=3`，而应用层并发闸门默认 6，闸门大于池 → 排队 5s 后
   `Prisma P2028: Unable to start a transaction`，请求继续占着内存等待；
4. Node 默认堆上限 4144MB，进程基线 RSS 已约 1.3GB，主机 15.8GB 内存中还有约 6.6GB swap 被其他服务占用，
   没有 `MemoryMax` 护栏；16 个重页面同时渲染即越过 4GB。

整改主线：**先限流止损（P0），再按内容修订号做进程内派生缓存并降低单请求成本（P1），最后补并发压测门禁与容量运营（P2）**。
缓存是内存派生数据，不是发布快照，也不能在任何情况下作为回退源；修订探针失败时必须失败关闭（503），不得回退旧内容。

---

## 1. 证据

### 1.1 崩溃时间线

| 时间（CST） | 事件 | 版本 |
|---|---|---|
| 10-20 20:43:18 | OOM，systemd 重启 | 旧版本 |
| 10-21 01:18:23 | OOM | 旧版本 |
| 10-21 01:48:28 | OOM | 旧版本 |
| 10-21 02:22:45 | OOM | 旧版本 |
| 10-21 06:16:34 | 当前 release 启动 | `360efb26c` |
| 10-21 12:46:21 | OOM（16 并发抓取 sitemap） | `360efb26c` |
| 10-21 12:56:41 | OOM（同一压测重试） | `360efb26c` |

崩溃信息：`FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`。
并发期间同时出现 `PrismaClientKnownRequestError: Transaction API error: Unable to start a transaction in the given time`。
最近 24 小时 journal 中 `Started Aidreamcapes` 共 **21 次**（含发布与崩溃重启），服务重启频繁本身也需要纳入告警。

结论：OOM 在本 release 之前已出现 4 次，属于既有问题；本次压测只是把它稳定复现出来。

### 1.2 运行时参数

| 项 | 当前值 | 备注 |
|---|---|---|
| CPU / 内存 | 8 vCPU / 15.8GB | swap 16GB，已用约 6.6GB |
| Node 堆上限 | 4144MB | 未设置 `NODE_OPTIONS` |
| 进程基线 RSS | 约 1.3GB | 服务重启后少量请求即达到 |
| DB 连接池 | `connection_limit=3` | 生产 `.env` 的 `DATABASE_URL` |
| 应用事务闸门 | `STOREFRONT_PUBLIC_TX_CONCURRENCY` 默认 6 | 未在 `.env` 设置 |
| 事务等待/超时 | `maxWait` 5s / `timeout` 30s | `site-store.ts` |
| Postgres `max_connections` | 100 | 同机还有其他站点服务 |
| Nginx | `proxy_cache off`，无 `limit_conn`/`limit_req` | `aivideosugc.com.conf` |
| systemd | 无 `MemoryHigh`/`MemoryMax` | `Restart=always`，`RestartSec=5` |

### 1.3 单请求成本来源

- `src/lib/stores/site-store.ts:1443` `getStorefrontPublicRuntimeStateForSite`：
  每次请求 `siteReadCache.get(..., 0)`，TTL=0 等价于不缓存；在 `RepeatableRead` 事务内读取站点、
  页面、商品、素材、模板等公开数据。
- `src/lib/storefront-context/snapshot.ts:230` `createPublishedSiteSnapshot`：
  每次请求重建发布投影（页面实体、路由、事实修订、链接引用、媒体投影等）。
- 首页 / `best-media` / `save-the-date` 会读取全部 268 个 `LivePage`（1.7MB JSON），其余路由按页范围读取，
  但仍会加载站点壳层与全局导航。
- `server.mjs`：把整个 HTML 响应缓冲到 `chunks`，`Buffer.concat` + `toString` + 多轮正则重排 `<head>`，
  再重新编码发送；同时把上游 `accept-encoding` 固定为 `identity`。这项不是 OOM 主因，但会放大瞬时分配和带宽。

### 1.4 已排除项

- 新增媒体详情页不是触发器：4 并发全部 200（0.37–0.55s），RSS 1315MB → 1325MB。
- 串行访问重页面正常：`/` 3.5s，`/ai-video-generation`、`/ai-actors`、演员分面页 1.5–2.2s。
- 不是数据库数据量爆炸：`site_aidreamcapes` 共 268 个 `LivePage`，`contentJson` 合计约 1.7MB，
  最大单页 44KB。问题在**每请求重复构建**，不在数据规模。

---

## 2. 目标与非目标

### 2.1 目标

1. 16 并发抓取 sitemap 全量 URL 不再 OOM、不再触发 systemd 重启，公开页零 5xx。
2. 单请求成本与并发上限可被量化、可被压测门禁验证。
3. LivePage 更新仍在**下一次请求**生效；不使用任何历史快照/发布物作为回退。
4. 只影响 Aidreamcapes；MyDreamShoots 与 Aidreamshoots 页面、链接、sitemap、SEO 零差异。

### 2.2 非目标

- 不改媒体详情页的 URL、CTA、`noindex`、sitemap 规则。
- 不做内容写入、不做发布/快照/回滚操作。
- 不通过加机器、加 worker 掩盖单请求成本（P2 才评估容量扩展）。
- 不把 `SitePublishedState` 或任何历史 payload 接回公开读路径。

---

## 3. 整改方案

### P0 止损（配置，0.5 天）

> 目标：先把「16 并发同时进 Node」变成「最多 4–6 个在飞，其余排队/429」，
> 并把连接池与闸门对齐，消除 P2028。此阶段不改代码。

#### P0-1 Nginx 入口限流

只对 `location /`（HTML 反代）生效，静态资源与媒体 `alias` 不受影响。

全局 nginx 配置已经定义了可复用的并发 zone（当前未被使用）：

```nginx
limit_conn_zone $binary_remote_addr zone=perip:10m;
limit_conn_zone $server_name zone=perserver:10m;
```

需要新增的只有速率 zone（放在 `aivideosugc.com.conf` 顶部、`server` 块之外，该文件在 `http` 上下文内）：

```nginx
limit_req_zone $binary_remote_addr zone=storefront_req:10m rate=6r/s;

# www.aivideosugc.com 的 server 块内
location / {
    limit_conn perserver 4;          # 复用现有 $server_name zone，按整站并发封顶
    limit_conn_status 429;
    limit_req  zone=storefront_req burst=12 nodelay;
    limit_req_status 429;
    # 原有 proxy_pass 配置保持不变
}
```

- 初始值取保守的 4（先保护内存），P1 缓存上线、压测通过后再逐步提高到 8/16。
- `aidreamcapes.com` 已退役为 410、`aivideosugc.com`（非 www）301 到 www，实际到达 3013 的只有
  `www.aivideosugc.com` 这个 server 块，因此 `$server_name` 维度的并发上限等价于整进程上限。
- 注意：本次故障压测是**直连 3013**，绕过了 Nginx；P0-1 只能保护经 Nginx 的流量，
  直连/内部客户端仍可打满进程。根治依赖 P1 的缓存，P2 压测要分别覆盖「直连」与「经 Nginx」两条路径。
- 4xx/429 会记录到现有 access log；上线后观察 24h，确认没有误伤正常用户与 Googlebot。
- 变更前备份：`cp aivideosugc.com.conf aivideosugc.com.conf.bak-oom-$(date +%Y%m%d%H%M%S)`，
  `nginx -t && systemctl reload nginx`；回滚即恢复备份并 reload。

#### P0-2 连接池与闸门对齐

生产 `.env`：

```bash
# DATABASE_URL 追加/修改
connection_limit=6        # 3 → 6
pool_timeout=10           # 秒

# 新增
STOREFRONT_PUBLIC_TX_CONCURRENCY=3   # 闸门必须小于池；留 3 个连接给其他查询
STOREFRONT_PUBLIC_TX_MAX_WAIT_MS=8000
STOREFRONT_PUBLIC_TX_TIMEOUT_MS=15000
```

- 先确认同机其他服务的连接占用，`6` 不能把 Postgres `max_connections=100` 吃满。
- 修改后 `systemctl restart aidreamcapes.service`；观察 `P2028` 是否归零。
- 回滚：恢复 `.env` 原值并重启。

#### P0-3 运行时护栏与告警

```ini
# /etc/systemd/system/aidreamcapes.service
[Service]
MemoryLimit=6G
```

- 目的：在 V8 堆耗尽前由 cgroup 兜底，避免拖垮整机；`Restart=always` 已有。
- 主机是 systemd 219（cgroup v1），只支持 `MemoryLimit`；`MemoryHigh`/`MemoryMax` 需要 systemd ≥ 231，
  不要直接照搬新版指令。
- 暂不调整 `--max-old-space-size`：P0 先限流；P1 量测后再决定堆上限。
- 告警（接入现有渠道，待确认）：
  - `ActiveEnterTimestamp` 变化 / journal 中 `Started Aidreamcapes` 次数增长（systemd 219 不保证 `NRestarts` 可用）；
  - journal 出现 `Ineffective mark-compacts`；
  - Nginx 5xx/429 比例、`P2028` 日志条数。

#### P0-4 基线量测（执行 P0 后、P1 前）

用与故障相同的脚本，分档 1/2/4/6 并发访问 sitemap 全量 URL（经 Nginx，不再直连 3013），记录：

- HTTP 状态分布、p50/p95；
- 进程 RSS、`heapUsed`/`heapTotal`（临时用 `process.memoryUsage()` 日志或 `/api/health`）；
- 是否出现重启、429、P2028。

产出基线表，作为 P1 验收对照。

---

### P1 主修复（代码，3–5 天）

> 目标：把每请求「读全站 + 重建投影」变成「一次廉价修订探针 + 命中进程内派生缓存」。
> 缓存只服务 `site_aidreamcapes`（feature flag），MyDreamShoots 默认不启用。

#### P1-1 内容修订号（数据库，additive migration）

新增 `SiteContentRevision`：

```sql
create table if not exists "SiteContentRevision" (
  "siteId"   text primary key,
  "revision" bigint not null default 0,
  "updatedAt" timestamptz not null default now()
);
```

统一辅助函数（触发器按表取到站点 id 后调用）：

```sql
create or replace function bump_site_content_revision(p_site_id text)
returns void language plpgsql as $$
begin
  insert into "SiteContentRevision" ("siteId", "revision", "updatedAt")
  values (p_site_id, 1, now())
  on conflict ("siteId") do update
  set "revision" = "SiteContentRevision"."revision" + 1,
      "updatedAt" = now();
end $$;
```

覆盖表与取站点 id 的方式（实施时以 `prisma/schema.prisma` 与公开读路径逐一核对）：

| 类型 | 表 | 站点 id 来源 |
|---|---|---|
| 直接带 `siteId` | `LivePage`、`SiteDomain`、`ThemeSettings`、`StorefrontProfile`、`Product`、`Price`、`MediaAsset`、`CreativePack`、`CreativePackCategory`、`VideoTheme`、`VideoThemeCategory`、`SiteAiApp` | `coalesce(NEW."siteId", OLD."siteId")` |
| 主键即站点 id | `Site` | `coalesce(NEW.id, OLD.id)` |

`AiApp` 是全局表，不单独建触发器；通过 `SiteAiApp` 的变更覆盖。
批量写入（manifest 一次更新几十行）会逐行触发，单行只做一次主键 upsert，成本可接受；
如后续出现大批量导入，再改为语句级触发器 + transition table。

- 迁移为新增表 + 触发器，不改现有列、不重写数据；触发器创建时对每张表短暂加锁，安排在低峰执行。
- 提供兜底探针（未部署触发器时）：`select max("updatedAt"), count(*)` 对上述表 `union all`，
  结果拼成修订字符串；成本约 1–5ms。
- 写入纪律：所有 manifest / 脚本写入继续经过 Prisma 或显式更新 `updatedAt`。抽查现有 manifest 使用
  `updateMany`（`@updatedAt` 自动更新）、`src` 与 `scripts` 中未发现裸 SQL 更新 `LivePage`；
  迁移实施前再全量核查一次，发现裸 SQL 就在同一迁移里补 `updatedAt = now()`。

#### P1-2 修订号缓存公开运行时与快照

在 `src/lib/stores/site-store.ts` / `src/lib/storefront-context` 增加：

- 每请求先读 `SiteContentRevision`（单行、主键），得到 `revision`；
- 缓存键：`${siteId}:${revision}:${scopeKey}`，`scopeKey` 为当前路由页范围（现有 `publicRuntimePageWhere` 的输入）；
- 命中：直接返回已解析的 bundle + `PublishedSiteSnapshot`，**不开启数据库事务**；
- 未命中：按现有逻辑加载并构建一次，然后写入缓存；
- 修订变化：清空该站点所有 scope 的缓存（只保留当前修订）；
- 容量：每进程最多保留 1 个修订 × 最多 8 个 scope；实现前先量测单 scope 快照占用，超过 150MB 则降为 4 个 scope；
- 失败语义：修订探针失败、缓存条目损坏、或加载失败 → 返回 503/500，**不得**回退缓存旧值；
- feature flag：`STOREFRONT_SNAPSHOT_CACHE_SITES=site_aidreamcapes`，未列出的站点行为不变；
- 不可变性：缓存对象在开发/测试环境 `deepFreeze`，并补一条「渲染后对象哈希不变」的单测，防止渲染层意外改写。

验收要点：更新一个 `LivePage` 后，**下一次**请求必须返回新内容（自动化测试，见 4.3）。

#### P1-3 降低单请求分配

- 对 `home` / `best-media` / `save-the-date` 的全量 268 页读取，确认是否可改为「页面索引 + 按需页面内容」；
  无法改的，依赖 P1-2 缓存摊销。
- `server.mjs`：评估把整页缓冲改为「只缓冲到 `</head>` 后流式输出」；若 JSON-LD body marker 必须移动，
  评估在 React 层直接输出到 head，移除传输层重排。该项在 P1 量测后决定是否实施，避免为次要问题引入风险。
- 上游 `accept-encoding` 不再强制 `identity`；若保留，确认 Nginx 对 HTML 的 gzip 生效（当前全局 `gzip on`）。

#### P1-4 sitemap 缓存

- `src/app/sitemap.xml/route.ts` 仍 `force-dynamic`，但按 P1-1 修订号缓存 `payload.entries`；
- 修订不变时零数据库事务；修订变化时下一次请求重建；
- 保留现有 `Cache-Control`，不引入 CDN 依赖。

#### P1-5 健康与观测端点

新增 `src/app/api/health/route.ts`（仅本机/令牌访问，`Cache-Control: no-store`）：

```json
{ "ok": true, "commit": "360efb26c", "uptimeSec": 123, "rssMb": 1320,
  "heapUsedMb": 420, "heapTotalMb": 900, "heapLimitMb": 4144 }
```

用于压测采样与告警；不暴露任何内容数据。

---

### P2 门禁与运营（2–3 天）

#### P2-1 并发压测门禁

新增 `scripts/smoke-aidreamcapes-concurrency.mjs`：

- 输入：origin、sitemap URL 列表、并发档位 `[1,2,4,8,16]`、每档请求数；支持 `--edge`（经 Nginx）
  与 `--direct`（直连 3013）两种模式，两种都要跑；
- 采样：状态码、p50/p95、`/api/health` 的 RSS/heap、服务 `ActiveEnterTimestamp` 与 journal 启动次数；
- 判定：
  - 档位 ≤ Nginx 上限：0 个非 200、0 次重启、p95 ≤ 2.5s、heap < 70% 上限、RSS < 2.5GB；
  - 档位 > 上限：允许 429，不允许 5xx/OOM；
- 先在本地 production build + 本地库跑通，再在发布候选实例跑；生产全量压测需单独审批窗口。

#### P2-2 发布验收挂钩

- `scripts/deploy-aidreamcapes-release.mjs` 增加可选 `--verify-load`（默认关闭）；
- 候选实例验收阶段跑 4/8 并发档，通过后才切换；
- 发布记录中登记压测结果（与现有 release 记录同格式）。

#### P2-3 容量与架构（视 P1 结果）

- P1 缓存命中率 > 95% 后，再评估提高 Nginx 并发上限到 8/16；
- 若单进程仍吃紧，再评估 2 个 worker + Nginx upstream（必须先有缓存，否则内存翻倍）；
- 评估把 `server.mjs` 传输层重排迁移到 React 层，去掉整页缓冲。

---

## 4. 验收标准

### 4.1 稳定性

- 16 并发抓取 sitemap 177 条 URL：0 次 OOM/重启、0 个 5xx、p95 ≤ 2.5s、RSS < 2.5GB、heap < 70%。
- 32 并发：允许 429 排队，不允许 5xx/OOM；服务不重启（`ActiveEnterTimestamp` 不变）。
- 压测后 10 分钟内 RSS 不持续单调上升（排除泄漏）。

### 4.2 功能与 SEO 不回退

- 媒体详情页契约保持不变：200、`noindex, follow`、自引用 canonical、唯一 `media:{kind,slug}` CTA。
- sitemap 仍为 177 条、嵌套演员 0、扁平演员 53、派生详情页 0。
- 演员扁平/嵌套跳转、退役路径 301、未知 slug 404 全部保持。

### 4.3 内容新鲜度

自动化用例：

1. 在测试站点更新一个 `LivePage.contentJson`（Prisma `update`，自动更新 `updatedAt`）；
2. 立即请求该页，断言返回新内容（不得等待 TTL）；
3. 再更新一次，重复断言；
4. 断言 `SiteContentRevision.revision` 单调递增。

### 4.4 站点隔离

- P1 feature flag 关闭时，MyDreamShoots / Aidreamshoots 的公开页 HTML、链接、sitemap 与开启前逐字节一致；
- 数据库写入仅限新增 `SiteContentRevision` 表与触发器，不触碰其他站点数据；
- 按 `docs/audits/aidreamcapes-media-detail-store-isolation-2026-10-21.md` 的口径复核。

---

## 5. 实施顺序与回滚

| 步骤 | 内容 | 回滚 |
|---|---|---|
| 0 | 备份 vhost、unit、`.env`；记录当前 `ActiveEnterTimestamp` 与 journal 启动次数 | — |
| 1 | P0-1 Nginx 限流 | 恢复备份 + `nginx -t && systemctl reload nginx` |
| 2 | P0-2 池/闸门 | 恢复 `.env` + 重启服务 |
| 3 | P0-3 unit 护栏 | 恢复 unit 备份 + `daemon-reload` + 重启 |
| 4 | P0-4 基线量测 | 只读 |
| 5 | P1-1 迁移（表 + 触发器） | `drop trigger` + `drop table`（不影响业务数据） |
| 6 | P1-2 缓存（flag 默认关） | 清空 flag 并重启，即回到旧行为 |
| 7 | P1-3/4/5 | 单独提交，可单独 revert |
| 8 | P2 门禁 | 仅测试脚本，无生产影响 |

每次生产变更都必须是独立提交/独立操作，禁止把 P0 与 P1 合并为一次发布。

---

## 6. 风险与缓解

| 风险 | 缓解 |
|---|---|
| 修订号漏记某些写入 → 缓存陈旧 | 触发器覆盖所有公开表；另加 `updatedAt` 兜底探针；4.3 新鲜度用例进 CI |
| 触发器增加写入延迟 | 写入量低；触发器只做单行 upsert；上线后观察写路径 p95 |
| 缓存对象被渲染层改写 | `deepFreeze` + 渲染前后哈希断言 |
| 缓存占用过大 | 每站点 1 个修订、最多 8 个 scope；量测后调整；超限淘汰 |
| Nginx 限流误伤用户/爬虫 | 先 4 并发、观察 429 与转化；按 UA/IP 白名单微调；P1 后再提高 |
| 提高连接数影响其他站点 | 先核对 Postgres 连接占用；`6` 为上限，不继续上调 |
| 共享代码影响 MyDreamShoots | feature flag 只开 `site_aidreamcapes`；隔离审计逐字节比对 |
| systemd `MemoryMax` 触发误杀 | 先设 6G（高于当前峰值 4.1G 堆），观察一周再收紧 |

---

## 7. 改动清单

| 文件/位置 | 变更 |
|---|---|
| `/www/server/panel/vhost/nginx/aivideosugc.com.conf` | 新增 `limit_req_zone`；`location /` 使用现有 `perserver` 并发 zone + 速率限制 |
| `/www/wwwroot/aidreamcapes.com/current/.env` | `connection_limit`、`STOREFRONT_PUBLIC_TX_*`、`STOREFRONT_SNAPSHOT_CACHE_SITES` |
| `/etc/systemd/system/aidreamcapes.service` | `MemoryHigh` / `MemoryMax` |
| `prisma/schema.prisma` + migration | `SiteContentRevision` 表与触发器 |
| `src/lib/stores/site-store.ts` | 修订探针 + 缓存键 + 失败关闭 |
| `src/lib/storefront-context/snapshot.ts` | 快照缓存接入、不可变性 |
| `src/lib/storefront-context/index.ts` | 缓存生命周期与失效 |
| `server.mjs` | （P1 可选）传输层缓冲/压缩 |
| `src/app/sitemap.xml/route.ts` | 修订号缓存 |
| `src/app/api/health/route.ts` | 新增健康端点（本机/令牌） |
| `scripts/smoke-aidreamcapes-concurrency.mjs` | 新增并发压测门禁 |
| `scripts/deploy-aidreamcapes-release.mjs` | 可选 `--verify-load` |

---

## 8. 排期（建议）

| 阶段 | 内容 | 工期 | 依赖 |
|---|---|---|---|
| P0 | 限流、池/闸门、护栏、基线量测 | 0.5 天 | 批准 Nginx 上限与连接数 |
| P1 | 修订号 + 缓存 + sitemap + health | 3–5 天 | P0 基线；迁移窗口 |
| P2 | 压测门禁 + 发布挂钩 + 容量评估 | 2–3 天 | P1 上线观察 3 天 |

---

## 9. 待确认决策

1. 是否批准 P0-1：`www.aivideosugc.com` 的 HTML 反代全局并发上限 **4**、单 IP **6r/s（burst 12）**，超限返回 429。
2. 是否批准 P0-2：`connection_limit` 3 → **6**，应用闸门 6 → **3**。
3. 是否批准 P0-3：`MemoryHigh=5G` / `MemoryMax=6G`。
4. 是否批准 P1-1 的 **additive migration**（`SiteContentRevision` + 触发器）。
5. 是否同意 P1 缓存先只对 `site_aidreamcapes` 开启（feature flag），MyDreamShoots 保持原行为。
6. 告警接入渠道（现有 IM/邮件/监控）与值班人。

批准后按第 5 节顺序执行；P0 完成即回报基线量测，P1 合并前提供本地与候选实例压测报告。

---

## 10. 实施结果（2026-10-21）

状态：P0 + P1 核心已上线。生产提交 `918ab3a19e421ac515015b94b6264535452fe6a7`，服务 `aidreamcapes.service`（`127.0.0.1:3013`）保持 active。

### 10.1 实际生效配置

| 项 | 结果 |
|---|---|
| Nginx | 先以 4 并发止血；P1 验证后提高到 `limit_conn perserver 8`，`limit_req 6r/s burst=12 nodelay`，超限 429 |
| DB 连接 | `connection_limit=6&pool_timeout=10` |
| 应用闸门 | `STOREFRONT_PUBLIC_TX_CONCURRENCY=3`，wait 8000ms，timeout 15000ms |
| systemd | `MemoryLimit=6G`，`NODE_OPTIONS=--max-old-space-size=3584`（drop-in `memory.conf`） |
| 迁移 | `20261021150000_add_site_content_revision` 于 14:58:36 应用；15 个触发器；`site_aidreamcapes` 修订行 revision=0 |
| 缓存开关 | `STOREFRONT_SNAPSHOT_CACHE_SITES=site_aidreamcapes`，TTL 300000ms，MAX 8 |

触发器统一调用带 `p_site_id <> 'site_aidreamcapes'` 早退守卫的函数；已核对 15 张表均具备 `siteId`（`Site` 使用 `id`），MyDreamShoots/Aidreamshoots 写入不产生修订记录。

### 10.2 验收结果

本地：

- `tsc`、生产构建、5 项媒体/演员/卡片/工作区审计通过。
- 177 个 URL 在并发 1/4/8/16 下全部 200；16 并发峰值约 3.33GB（4GB heap），无 OOM。
- 新鲜度：更新本地 `LivePage.updatedAt` 后 revision 0→1，下一请求缓存 miss 并重新加载，再下一请求命中；未使用快照或历史 publication。

生产：

| 场景 | 结果 |
|---|---|
| 直连 3013，并发 4 | 177/177 200，123.7s，p50 2.72s，p95 3.78s，RSS 0.70→2.33→1.40GB |
| 直连 3013，并发 8 | 177/177 200，108.3s，p50 5.10s，p95 6.97s，RSS 0.87→2.52→2.27GB |
| 直连 3013，并发 16 | 177/177 200，117.6s，p50 10.43s，p95 15.27s，RSS 2.33→2.93→2.63GB |
| Nginx 入口，并发 4（cap 4） | 177/177 200，115.0s，p50 2.53s，p95 3.70s，RSS 1.96→2.71→1.69GB |
| Nginx 入口，并发 8（cap 8） | 177/177 200，112.2s，p50 5.27s，p95 6.72s，RSS 1.05→2.58→2.24GB |
| Nginx 入口，并发 16（cap 8） | 8×200 + 169×429，5.96s；429 为并发上限预期行为 |

- 部署后服务无 OOM、无 P2028；最终 RSS 约 1.8GB（限制 6G）。
- 媒体详情页 200，`noindex, follow`，自引用 canonical，单一工作区 CTA；演员页扁平 canonical、可索引；sitemap 177 条、0 条嵌套演员 URL。
- MyDreamShoots 服务未改动；首页只读回读 200，部署后无错误日志。

上述直连/入口 p50 是 **177 个不同 URL 的冷遍历**；重复访问同一页面时详情页约 0.12s、演员页约 0.6s。

### 10.3 回滚路径

- 代码：`current` 指回 `360efb26c955451bafdf9ab8022b2c22ffff13dc-seo` 并重启服务。迁移为 additive，旧代码忽略 `SiteContentRevision`。
- Nginx：`/root/aidreamcapes-nginx-cap8-20261021152312.conf`（cap 8 之前的配置）。
- 环境变量：`/root/aidreamcapes-env-backup-20261021144206.env`、`.local`。
- P0 配置备份：`/root/aidreamcapes-oom-fix-20261021135625`。
- 回滚不使用历史 publication/snapshot；本次未写入任何公开内容。

### 10.4 未完成 / P2

- 并发压测目前为临时脚本，尚未并入发布门禁；健康端点、sitemap 修订号缓存、告警渠道未实施。
- Nginx 当前上限 8 是运行期安全阀；16 并发仍会快速 429。后续应根据真实 429 率、RSS 和 p95 决定是否提高到 12。
- 冷遍历在 8 并发下 p50 约 5s，主要受单机 CPU/SSR 成本限制；缓存命中路径已明显更快，但 SEO 大规模冷爬仍需评估容量或预热策略。
