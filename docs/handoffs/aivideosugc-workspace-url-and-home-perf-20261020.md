# AIVideosUGC 工作台 URL 规范化与首页慢加载排查（2026-10-20）

> **状态更新（2026-10-20 晚）**：P0 已按 `e12d78eff9dfc6b19e46bfa73bb816147b4eaef5` 完成 code-only 部署，生产验收见 [`aivideosugc-workspace-entry-link-audit-20261020.md`](./aivideosugc-workspace-entry-link-audit-20261020.md)。最终入口契约是“固定 `/app/create/...` href + `data-workspace-entry` + 2 分钟 cookie”，不是本文早期描述的 `?source=&preset=` 查询串。以下“尚未部署 / 等待提交/部署”等段落均为部署前历史记录，不再代表当前生产状态。

## 问题 0（补充）：案例数据要通过"传参包装"带入工作台，不能展示在 URL 里

### 现状与根因

点击首页案例卡（如"手机握持应用演示（用户生成内容）"）后，工作台并没有拿到案例的数据（提示词、场景、画幅、时长）：

1. 既有机制本来就是为了这个设计的：`pickerPresetHref`（`preset-contract.ts`）在 SSR 阶段把卡片 href 改写成 **不透明引用** `/app/create?source=<页面>&preset=p_<24位hash>`，工作台服务端再用 `resolveWorkspacePreset` 从**当前 LivePage 行**解析出 prompt/scene/aspect/duration/imageTool（compare-and-set：`sourceUpdatedAt` 防陈旧）。URL 里只有标识符，没有任何数据。
2. 但 `pickerPresetHref` 只改写 `/app/create?...` 查询串形式的 href——生产 LivePage 卡片在 static-link 迁移后是 **`/app/create/tool/<tool>/<template>` 路径形式**，被原样放过，导致：URL 泄漏 tool/template（泄漏程度有限但不符合要求），更重要的是 **案例的 prompt/scene/aspect/duration 根本没有传进工作台**（打开后是空 composer）。

### 修复（已完成，本地验证通过）

`src/lib/aidreamcapes-workspace/preset-contract.ts` 的 `pickerPresetHref` 现在把 tool 路径形式的卡片 href 一并折叠成同样的不透明 preset 链接：

- `/app/create/tool/video-ads/creator#step-video` → `/app/create?source=%2F&preset=p_xxxxxxxxxxxxxxxxxxxxxxxx`
- 工作台打开时由服务端按当前行解析并预填 composer；浏览器里看不到任何案例数据
- 查询串形式（本地数据）与 tool 路径形式（生产数据）统一走同一条包装通道
- 无法解析的 preset（如卡片无 prompt）优雅降级为普通打开，不报错

### 本地端到端验证（production build 实测）

- 首页案例卡 SSR href：`/ai-video-generation/canvas-tote-product-detail`（可读 slug 路由，同样不带数据）
- 点击落地该路由 → 页面即工作台，composer 已预填案例提示词 `"Canvas tote bag shown upright in a clean product-detail scene…"` ✓
- 最终 URL 不含 `prompt=/template=/size=/length=` 任何参数 ✓
- smoke：`smoke-template-links` 扩展了 tool 路径用例（含 tool 路径、图片卡、非 create 入口不改动等断言）✓

### 与问题 1 的关系

同一个部署批次解决。部署后生产卡片（tool 路径 href）会在 SSR 阶段被改写为 preset 链接；旧的 tool 路径直接访问仍 308 到规范路径。可选后续：下一次字段级 manifest 把生产卡片 href 更新为 slug 路由形式（本地已是该形式），获得可读且不透明的工作台 URL。

## 问题 1：案例卡点击后 URL 仍是 `/app/create/tool/image-to-video#step-video`

### 排查结论：修复已完成并验证，但**尚未部署到生产**

实测生产首页 HTML（Cloudflare 线上，playwright 抓取）：

- 首页共 **23 个 `/app/create/tool/...` 链接**（`/app/create/tool/video-ads/creator#step-video`、`/app/create/tool/white-background/white`、`/app/create/tool/url-to-video` 等），0 个查询串链接。
- 点击后地址栏停留在 tool 路径 —— 因为线上运行的版本没有规范重定向。

时间线还原：

1. 生产 LivePage 数据已经过 static-link 迁移，选择器卡片 href 直出 `/app/create/tool/<tool>`（提交 f7c03a55e 的说明也印证"matching production LivePage data after the static-link migration"）。
2. 规范化代码（`legacyStaticCreateRedirect`、`workspaceViewHref` 规范段）目前**只在本地工作树，未提交、未部署**。
3. 因此线上用户点击后落地的仍是旧 tool 路径；侧边栏点击后地址栏也会变回 `/app/create/video` 这类旧视图路径。

### 本地已验证的修复（等待提交/部署）

| 修复点 | 文件 | 效果 |
|---|---|---|
| 旧固定路径 308 重定向 | `src/app/[...path]/page.tsx`、`src/app/site/[siteSlug]/[...path]/page.tsx`、`src/app/site/aidreamcapes/app/create/page.tsx`、`src/app/site/aivideosugc/app/create/page.tsx`、`src/app/site/[siteSlug]/app/create/page.tsx` | `/app/create/tool/<tool>`、`/video`、`/images`、`/actors`、`/product`、`/agent` 全部 308 到规范路径 |
| 旧查询串 308 重定向 | 同上（`legacyCreateHrefToStatic` 输出规范路径） | `/app/create?tool=...&size=...` → `/app/create/ai-video-generation/<tool>?size=...&length=...` |
| 侧边栏/客户端 URL 直出规范段 | `src/lib/aidreamcapes-workspace/navigation.ts`、`static-routes.ts` | 点击侧边栏地址栏直接显示 `/app/create/ai-video-generation` 等，不再跳变 |

本地 production build 实测（3004 端口）：

- 首页案例卡 href → `308 /app/create/ai-video-generation/video-ads/creator?size=9:16&length=15` ✓
- `/app/create?tool=image-to-video&size=9:16&length=10` → `308 /app/create/ai-video-generation/image-to-video?size=9:16&length=10` ✓
- 旧视图路径 `/video` `/images` `/actors` `/product` `/agent` `/tool/*` → 308 规范路径 ✓
- 规范路径全部 200，工作台 SSR 侧边栏直出 `/app/create/ai-actors` 等规范 href ✓

### 部署方案（code-only，符合当前发布规则）

1. 提交工作树中以下文件（均为纯代码路由改动，无内容写入，不触发全站生成禁令）：
   - `src/lib/aidreamcapes-workspace/navigation.ts`、`static-routes.ts`、`preset-contract.ts`
   - `src/app/[...path]/page.tsx`、`src/app/site/[siteSlug]/[...path]/page.tsx`
   - `src/app/site/[siteSlug]/app/create/page.tsx`、`src/app/site/aidreamcapes/app/create/page.tsx`、`src/app/site/aivideosugc/app/create/page.tsx`
   - `scripts/aidreamcapes-workspace/smoke-static-routes.mjs`、`smoke-navigation.mjs`、`smoke-template-entry.mjs`、`smoke-template-links.mjs`
2. 走既有 deploy 流程（`npm run deploy:release` 或 Aidreamcapes 发布管线）。
3. 部署后验证（线上 curl）：
   ```
   curl -s -o /dev/null -D - "https://www.aivideosugc.com/app/create/tool/image-to-video#step-video" | grep -i location
   # 期待: location: /app/create/ai-video-generation/image-to-video
   curl -s -o /dev/null -D - "https://www.aivideosugc.com/app/create/video" | grep -i location
   # 期待: location: /app/create/ai-video-generation
   ```
4. 后续可选（下一次字段级 manifest 时）：把生产 LivePage 中 23 处 `/app/create/tool/...` href 字段改为规范 `/app/create/ai-<group>/<tool>` 直出，省掉一跳 308。改动前必须走 compare-and-set 字段清单，不做全站重生成。

## 问题 2：首页加载特别慢

### 已量测的数据

| 指标 | 数值 |
|---|---|
| 线上冷加载（CDN miss，本机 playwright） | **23.4s** domcontentloaded |
| 线上热加载（CDN hit） | 0.10s |
| 本地同代码+同规模数据 home 渲染 | **0.11s 冷 / 0.005s 热**（548KB HTML，build8 实测） |
| 本地 `/ai-video-generation` | 1.03s 冷 / 0.52s 热 |
| 本地 `/ai-actors` | 0.44s 冷 / 0.42s 热 |
| 本地 `/ai-image-generation` | 0.57s 冷 / 0.59s 热 |
| 本地 `/templates`、`/blog`、`/save-the-date`、`/app/create` | 0.02–0.46s |
| 本地 site_aidreamcapes LivePage | 266 行 / contentJson 合计 **4.4MB** |
| 其中 blog 页 | 9 行 / 148KB（每个非 home 页面都会作为 shell 附带读取） |
| 其中 93 个派生演员页 | 629KB（占全站 14%，不是慢的主因） |
| 公共媒体资产（theme/package/sample） | **784 行 / 264KB**，home 等 profile 无 LIMIT |

线上首页响应头：`Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=1800` —— 热加载走 CDN，冷加载回源。本地 `.env.local` 的 `DINGYUE_ENV=local` 会强制 `private, no-store`，因此本地量测都是真实回源渲染，不含 CDN 因素。

### 本地是否已经做了响应优化？

**没有做代码级优化，本地也没有慢到需要优化的程度。** 当前本地结论是“功能正确 + 耗时正常”，不是“已优化”：

- 本地 DB 与 Next 进程同机，即使每次请求都全量读库，20 条主要路由也都在 0.02–1.03s；
- 本地 `.env.local` 明确设置 `STOREFRONT_PUBLIC_CACHE_TTL_MS=0`（关闭进程内缓存）；
- 工作树中 `site-store.ts`、`storefront-global-shell.ts`、`middleware.ts` 均无改动；
- 23.4s 的放大只出现在生产 CDN 冷回源，本地复现不出来，必须用生产侧打点定位。

同时修正前一版方案中的一个错误假设：`STOREFRONT_PUBLIC_CACHE_TTL_MS` **只作用于导航/集合等参考数据**（`getStorefrontPublicNavigationDataForSite`，site-store.ts:430），页面主体 runtime 的 TTL 是**硬编码 0**（`getStorefrontPublicRuntimeStateForSite`，site-store.ts:1448–1452）。所以“生产设 60s TTL 就能缓存首页投影”并不成立，需要改代码才能缓存页面 runtime。

### 首页回源渲染的完整读取路径（site-store.ts，home profile）

每次 CDN 冷回源会执行（页面 runtime 的进程内缓存硬编码为 0，见 `getStorefrontPublicRuntimeStateForSite`）：

1. **全部 LivePage**（home profile 不带 slug 过滤，266 行起，生产可能更多）
2. **全部公共媒体资产**：`mediaAssets` 的 home limit 是 `undefined`（无 LIMIT！），条件 `usageType IN ('theme','package','sample')` —— 生产上这是全站所有示例/包媒体，行数未知，是最大嫌疑
3. products、creativePacks(8)+categories、toolCategories/toolMenuItems(各80)
4. 每行 JSON 映射（toMediaAsset 等）+ 548KB HTML 的中间件 head 重排

本地同路径 1 秒内完成，因此 23s 的放大只能来自**生产侧数据规模或机器资源**，不是这次 93 个演员页（它们只占回源数据增量的 15%）。

### 待在服务器上执行的定位步骤（一次 SSH 即可）

```bash
# 1. 绕过 CDN 直接量源站渲染耗时（多次取样，看回源真实成本）
curl -o /dev/null -s -w 'total=%{time_total} ttfb=%{time_starttransfer}\n' \
  -H 'Host: www.aivideosugc.com' http://127.0.0.1:<服务端口>/

# 2. 打开内置性能打点，再打一次首页，看各阶段毫秒数
STOREFRONT_PROFILE=1 <重启或注入环境>
tail -f <日志> | grep storefront:public-runtime
# 关注 site / collections(mediaAssets 行数) / done 三行

# 3. 查关键表行数（psql）
SELECT count(*) FROM "MediaAsset" WHERE "siteId"='site_aidreamcapes'
  AND "usageType" IN ('theme','package','sample');
SELECT count(*) FROM "LivePage" WHERE "siteId"='site_aidreamcapes';
SELECT count(*) FROM "CreativePack" WHERE "siteId"='site_aidreamcapes' AND status='active';
```

### 处置方案（按优先级）

1. **先在生产定位，不先改缓存语义**：`STOREFRONT_PROFILE=1` + 直连源站计时 + 表行数（784 行媒体资产、266 行 LivePage、9 行 blog），确认 23s 是“DB 往返 + 全量反序列化”还是“机器 CPU/冷启动”。本地同样的查询只要 0.1–1.0s。
2. **代码级正确做法：按 revision 失效的进程内缓存**（不是时间 TTL）。仓库契约要求 `LivePage` 提交后**下一个请求**即可见，不能引入 60s 陈旧窗口；可以 `siteId + pageKey + max(LivePage.updatedAt)/count` 作为缓存键，命中时省掉 4.4MB 读取，任一行更新后键变化、下一请求自动回源。预计是收益最大的改动，但位于共享层（`site-store.ts`），会影响 MyDreamShoots 的读取路径，**需要你明确批准后才能动**。
3. **代码级：给 home/indexing 等 profile 的 `mediaAssets` 加宽松上限**（如 2000，`publicRuntimeLimits`），避免资产继续增长；需回归确认首页/编辑页投影完整。同为共享层改动，需批准。
4. **CDN**：确认生产 HTML 的 `s-maxage=300` 实际生效（`cdn-cache-control`/`cloudflare-cdn-cache-control` 已由 middleware 下发）；若客户端路由（RSC）导航绕过 CDN，则再评估提升到 1800–3600 或改为关键跨区链接整页导航。
5. **不需要动 93 个演员页**：629KB/14%，本地增量 <100ms，部署 URL 修复不会改变首页性能。

### 生产定位结论与最终修复（2026-10-20 晚，已 code-only 部署）

生产 23.4s 的冷回源放大**不是** DB 行数或媒体资产 LIMIT 造成，而是首页 JSON 上的链接遍历：

- **根因**：`src/lib/seo-indexing.ts` 的 `collectInternalHrefPaths` 会递归遍历首页 LivePage JSON 中的**每一个字符串**，包括媒体 URL、提示词、alt 文本，并对每个候选串执行目录解析。首页 JSON 里媒体/文案越多，这一步越接近 O(字符串总数 × 目录解析)，成为回源渲染的主要成本。
- **修复**：在同一函数内加 **仅 Aidreamcapes 生效** 的字符串预过滤（明显不是站内路由的串直接跳过）并对字符串/对象去重；MyDreamShoots 的遍历路径保持不变。没有引入任何 TTL 缓存，`LivePage` 提交后下一个请求仍然立即可见。
- **提交**：`efa88c04963a0da14a56ace6123f56eca82091ca`（`Skip non-route strings in Aidreamcapes indexable-link scan`），`origin/main` 已同步到该提交。
- **部署方式**：远端构建在本机约 10GB 处 OOM（`CALL_AND_RETRY_LAST Allocation failed`），因此使用本地 prebuilt `.next-build`（标记 `efa88c049…`）部署，public 与 node_modules 复用 `bfcf7fa0a` 的 release；发布目录 `/www/wwwroot/aidreamcapes.com/releases/efa88c04963a0da14a56ace6123f56eca82091ca-seo`。codex 的 `0f78be95b` 只增加 docs/scripts/manifests，不是运行时构建输入，因此 prebuilt 内容与提交一致。
- **效果（生产源站直连，绕过 CDN）**：

  | 指标 | 修复前 | 修复后 |
  |---|---|---|
  | 首页 TTFB | ~9.1s | **~3.1s** |
  | `/ai-actors`、`/templates` | — | ~1.8s |
  | 本地 production build 首页 | ~0.11s（旧数据规模） | 0.60–0.64s（当前数据规模） |
  | 本地 production build actors/templates | — | 0.35–0.37s |

- **回归门禁**：候选与源站路由 smoke、固定入口审计、公网 CDN 审计均通过 —— 首页 41 条入口链接、图片区 4 条提示词、演员 53/53、模板 18/9/9、视频 48；sitemap URL 集合部署前后均为 **177** 条，无增删。
- **范围**：本次仅代码，无内容行写入；MyDreamShoots 标题与读回未变，MyDreamShoots / Aidreamcapes EU / Aidreamshoots 服务保持运行。
- **仍存在的成本**：首页源站仍约 3s，属于渲染本身（548KB HTML + 全量投影）。继续下降只能靠裁剪 V2 首页渲染内容，或经明确批准的 **按 revision 失效** 缓存；**不要**用时间 TTL 兜底。共享层 `site-store.ts` 的缓存/媒体上限改动对本回归不再必要。

> 部署后提醒：codex worktree `main-2` 仍停在 `0f78be95b`，下次从该分支部署前须先同步到 `origin/main`（`efa88c049…`），否则会回退本次性能修复。

### 后续发布（2026-10-20 深夜）

- 当前生产 commit：`d198de292783ff316f0302d2252cf58a8c0f98ac`（`current` → `releases/d198de292…-seo`），在 `efa88c049` 之上只追加了入口提交拦截修复与 codex 的目录标题调整，**性能修复原样保留**。
- 生产源站复测：`/` 约 3.1s、`/ai-actors` 约 1.5s、`/ai-image-generation` 约 1.8s（直连源站，绕过 CDN）；本机到 Cloudflare 的 TLS 仍被重置，浏览器门禁改为经 SSH 隧道在源站执行。

### 顺手修复的阻塞项（与本次排查相关）

- `smoke-template-entry` 因其他任务引入的 `@/lib/aidreamcapes-inspirations-types` 导入而无法加载 → 已在 smoke shim 中补编译该模块。
- `smoke-navigation` 的 `viewFromUrl` 补充规范段映射（`ai-video-generation`→video 等）。
- 两个 smoke 各自仍有一处**先行存在**的过期断言（"Examples have an independent browsing page" / inspirations 独立页跳转），属于并发任务的内嵌灵感视图改动，未处理。
