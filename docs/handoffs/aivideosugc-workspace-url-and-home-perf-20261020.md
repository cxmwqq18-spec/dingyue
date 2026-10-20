# AIVideosUGC 工作台 URL 规范化与首页慢加载排查（2026-10-20）

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

### 顺手修复的阻塞项（与本次排查相关）

- `smoke-template-entry` 因其他任务引入的 `@/lib/aidreamcapes-inspirations-types` 导入而无法加载 → 已在 smoke shim 中补编译该模块。
- `smoke-navigation` 的 `viewFromUrl` 补充规范段映射（`ai-video-generation`→video 等）。
- 两个 smoke 各自仍有一处**先行存在**的过期断言（"Examples have an independent browsing page" / inspirations 独立页跳转），属于并发任务的内嵌灵感视图改动，未处理。
