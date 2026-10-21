# AIVideosUGC 整改计划合并与差异裁决（2026-10-21）

> 性质：**文档合并 + 口径裁决**，不含新方案、不含任何写入
> 目的：把并行产出的多份计划收敛成单一执行视图，逐条裁决相互冲突的结论，
> 并列出"三份文档都没覆盖"的缺口
> 站点范围：`site_aidreamcapes`（`www.aivideosugc.com` / `www.aidreamcapes.com`）

---

## 0. 合并后的文档权威边界

| 文档 | 管什么 | 规模 | 当前状态 |
|---|---|---|---|
| `aidreamcapes-production-ssr-memory-stability-2026-10-21.md` | **可用性与容量**：入口限流、连接池/闸门、内存护栏、修订号缓存、压测门禁 | 20.8 KB | 待评审，P0 需批准 |
| `aidreamcapes-media-detail-link-remediation-2026-10-21.md` | **路由层**：媒体详情页 URL / CTA / `noindex` / sitemap | 35.2 KB | **已上线** `360efb26c` |
| `aidreamcapes-template-directory-data-chain-audit-2026-10-21.md` | **内容数据层**：facet 维度缺失、slug 命名空间、四阶段评估方案 | 16.3 KB | 评估完成，待决策 |
| `aidreamcapes-site-architecture-assessment-2026-10-21.md` | **结构总评**：架构形态、风险 R1–R10、分阶段建议 | 17.5 KB | 评估完成 |
| `aidreamcapes-media-detail-store-isolation-2026-10-21.md` | 店铺隔离复核口径 | 32.1 KB | 已完成 |

**裁决原则：可用性 > 路由 > 内容。**
可用性未修前，任何内容整改都不得进入线上验收——本次评估期间已两次把崩溃窗口误判为线上故障。

---

## 1. 已解决（原先待办、现已不必做）

| 原待办项 | 出处 | 现状 |
|---|---|---|
| 9 个 photo 模板页中 8 个 404 | 媒体详情计划 §2.2 | **已修**：`8e92d0f81` → `5ad07903b`，实测 9/9 → 200 |
| sitemap 13 条 `/ai-image-generation/*` 死链 | 媒体详情计划 §2.2 | **已修**：sitemap 14 条 photo 全部 200 |
| 媒体详情页缺页脚 / 面包屑标签错 / hydration 报错 | 本次会话 | **已修并上线**（`47440da29`、`360efb26c`） |
| 发版 build 堆不足 | 本次会话 | **已修**：`3ce79c1a1` 把 release build heap 传到远端 |
| SSR 每请求重建全站投影 | 内存计划 P1 | **代码已合入** `918ab3a19`，但**生产未启用**（生产 `deployed_commit=360efb26c`） |

---

## 2. 我的文档需要整改的条目

以下是本次与并行产出比对后，**被证伪或已过期**的条目。逐条给出错因与处置。

| # | 我原先写的 | 实际情况 | 处置 |
|---|---|---|---|
| **M1** | Phase 0：加 `NODE_OPTIONS=--max-old-space-size=3072` | **方向性错误**。降低堆上限只会让 OOM **更早**发生（4.1 GB → 3 GB），并不减少每请求分配量。真正的杠杆是入口限流 + 修订号缓存 | **撤销**，改为引用内存计划 P0/P1 |
| **M2** | Phase 0：加 systemd `MemoryMax` | 宿主是 **systemd 219（cgroup v1）**，只支持 `MemoryLimit`；`MemoryMax`/`MemoryHigh` 需 ≥ 231 | 更正为 `MemoryLimit=6G` |
| **M3** | Phase 0：`connection_limit` 3→8~15、`pool_timeout=20` | **过高且方向反**。Postgres `max_connections=100` 与其他服务共用；且**应用闸门（默认 6）必须小于连接池**，否则排队后仍 P2028。正确取值为 pool 3→6、闸门 6→3 | 更正 |
| **M4** | p50 7.0 s / p90 14.3 s / p95 21.1 s 作为站点性能基线 | 那是**崩溃前高压窗口**的读数，不是基线。串行基线为 `/` ≈ 3.5 s、其余重页面 1.5–2.2 s | 标注为"降级窗口读数"，基线引用内存计划 §1.4 |
| **M5** | 30 天 OOM 7 次 | 内存计划时间线列 6 次（其中 2 次由本次压测触发），并明确"本 release 之前已有 4 次" | 以内存计划 §1.1 为准 |
| **M6** | "回滚是静默的，失败原因没有留在日志里" | **部分成立**。`trap rollback EXIT` 保留退出码，失败命令的 stderr 会输出到终端；成功路径有 `trap - EXIT` 正常解除。**但失败原因确实未落盘**，事后无法回答"为什么回滚" | 收窄为"失败原因未持久化" |
| **M7** | `SiteContentRevision` 属"在途改动" | **已合入** `918ab3a19`，本地库已应用迁移（表存在）；**生产未启用** | 更新状态 |
| **M8** | Phase 2/3 前先做 Phase 0 | 顺序仍成立，但 Phase 0 的定义应整体替换为内存计划的 P0 | 引用替换 |

> 处置结果已写回两份文档；本文保留裁决记录，便于追溯为什么改。

---

## 3. 合并后新发现的缺口

以下 **三份文档都没有覆盖**，是本次合并的实际增量。

### F1 新缓存没有闸门，且 300 s TTL 绕过了现有闸门的字面断言

现有闸门（`scripts/guard-live-storefront-ssr.mjs:20`）：

```js
assert.doesNotMatch(publicRuntime, /STOREFRONT_PUBLIC_CACHE_TTL_MS \?\? 120_000/,
  "public runtime must not use a cross-request content TTL");
```

新代码用的是 **另一个变量名**：

```ts
function publicRuntimeCacheTtlMs() {
  const value = Number(process.env.STOREFRONT_SNAPSHOT_CACHE_TTL_MS ?? 300_000);
  ...
}
```

→ 断言按**字面量匹配变量名**，改名即放行。当前 `node scripts/guard-live-storefront-ssr.mjs`
输出 `{"ok":true}`，但一个 300 s 的跨请求 TTL 已经存在。

**事实层面并非致命**：TTL 参与有效性判定，但**修订号是第一道闸**——

```ts
if (cached && cached.revision === revision && (ttl === 0 || Date.now() - cached.createdAt < ttl)) {
  return cached.state;
}
```

即修订号变了必然不命中。所以与 AGENTS.md"下一次请求生效"**不冲突**，前提是触发器覆盖了
所有影响公开输出的写入。TTL 的真实角色是"漏记写入"的兜底：把陈旧上限从"永久"压到 300 秒。

**处置建议（不需要你决策）**：

1. 把闸门从"匹配变量名"改成**意图断言**：公开读路径必须先读修订号且修订号参与缓存键；
   TTL 不得作为唯一失效手段；`ttl === 0` 才允许表示"无 TTL"。
2. 补内存计划 §4.3 要求的新鲜度用例——当前**不存在任何针对缓存的测试**
   （`grep` 全仓无 `siteSnapshotCacheEnabled` / `readSiteContentRevision` 的测试引用）。

### F2 触发器守卫硬编码单站，而 feature flag 接受任意站 → 跨店陈旧陷阱

三处组合起来构成一个**静默的跨店风险**：

```sql
-- migration.sql:16  触发器只对 aidreamcapes 自增
IF p_site_id IS NULL OR p_site_id <> 'site_aidreamcapes' THEN RETURN; END IF;
```

```ts
// site-content-revision.ts:18  flag 却接受任意站点，含 "*"
return cacheAllSites || configuredSites.has(siteId);
```

```ts
// site-content-revision.ts:56  没有该站的行时，返回常量 "0"
if (rows.length > 0) return rows[0].revision.toString();
return "0";
```

**推论**：若有人把 `STOREFRONT_SNAPSHOT_CACHE_SITES` 加上 `site_dreamshoot`（或 `*`），
该站修订号恒为 `"0"`、永不变化 → 缓存只靠 300 s TTL 兜底 →
**MyDreamShoots 内容最多陈旧 5 分钟**，直接违反 AGENTS.md 的"下一次请求生效"。

这正是 AGENTS.md 警告的"共享层改动可能改变他店行为"的形态，而当前**没有任何闸门阻止**。

**处置建议（按代价从低到高，任选其一）**：

- **A（最小）**：`siteSnapshotCacheEnabled` 只接受"已建触发器"的白名单；遇到 `*` 直接抛错。
- **B（最稳）**：加一条闸门脚本，断言"`STOREFRONT_SNAPSHOT_CACHE_SITES` 里每个站点在迁移中都有触发器"。
- **C（最彻底）**：把触发器守卫改成无站点条件（对所有站生效），代价是写路径多一次主键 upsert。

> 注意：生产当前**未启用**该缓存，所以这是潜在缺陷、不是线上故障。但它必须在 P1 启用前修掉。

### F3 部署失败原因未持久化（R8 收窄后的准确形态）

```sh
rollback() {
  STATUS=$?
  ...
  cp "$RELEASE/.previous-release.conf" "$DROPIN"
  ...
  exit "$STATUS"          # 保留退出码，但失败原因只进终端
}
trap rollback EXIT
```

**处置**：在 `rollback()` 内记录触发回滚的具体命令与退出码到
`"$RELEASE/release.failed.txt"`（或 journald `logger -t aidreamcapes-deploy`），
使"为什么回滚"可事后回答。无需你决策。

### F4 仓库卫生：`releases/manifests/.gitkeep` 未跟踪

`releases/` 已被 `.gitignore` 覆盖（`.gitignore:67`），但该文件仍出现在 `git status`。
一行修复，无需决策。

---

## 4. 合并后的统一执行序列

| 序 | 动作 | 归属文档 | 依赖 | 需你批准 |
|---|---|---|---|---|
| 1 | **内存计划 P0**：Nginx 限流 + pool/gate + `MemoryLimit` + 基线量测 | 内存计划 | — | **是** |
| 2 | **内存计划 P1**：启用修订号缓存 + health 端点 + sitemap 缓存 | 内存计划 | 1 | 是（迁移窗口） |
| 3 | **F1 + F2** 闸门加固与新鲜度测试 | 本文 | 2 之前必须完成 | 否 |
| 4 | **F3 + F4** 部署失败落盘、仓库卫生 | 本文 | — | 否 |
| 5 | **Phase 1** 命名空间只读体检 | 模板计划 | 2（否则线上读回不稳） | 否 |
| 6 | **Phase 2** 维度表 A / 策展 B 决策 | 模板计划 | 5 | **是** |
| 7 | **Phase 3** 字段级内容整改 | 模板计划 | 6 | 是 |
| 8 | R4 / R7 结构性优化（本地化入 React、静态图迁 nginx） | 结构评估 | 2 | 否 |

**两条硬约束**：

1. **1 与 2 必须是两次独立发布**，不可合并（内存计划 §5 已明确）。
2. **3 必须先于 2 的生产启用**——否则缓存带着 F2 上线，等于把一个跨店陈旧陷阱装进主线。

---

## 5. 需要你决策（从 8 条收敛为 3 条）

三份文档合计列了 8 个待确认项。按"是否不可逆 / 是否需要预算"过滤后，真正需要你拍板的只有 3 条：

1. **可用性 P0 是否批准？**
   内存计划 §9 的 6 个问题（Nginx 并发 4 / 6r·s / pool 3→6 + 闸门 6→3 /
   `MemoryLimit=6G` / 迁移批准 / 只对 aidreamcapes 开缓存 / 告警渠道）建议打包批一次。
   **不批则第 5–8 项全部无法验收。**
2. **模板维度走 A（`TemplateFacet` 表）还是 B（保持 `templateDirectory.paths` 策展 + 换素材）？**
   决定工作量级别（数天 vs 数周）与是否需要素材预算。
3. **987 条 `publicSlug` 模板详情页是否保留独立 URL？**
   若不保留，可整体收进工具页锚点，模板计划的 §2.3 三层命名问题一步消解。

其余（F1/F2/F3/F4、闸门加固、health 端点、失败落盘）属工程卫生，**不需要单独决策**，
可在 P1 合并前顺手完成。
