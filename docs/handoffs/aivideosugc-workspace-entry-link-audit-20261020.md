# AIVideosUGC 公共目录卡 → 工作台入口链路审计（2026-10-20）

## 结论

用户反馈属实。部署前，生产环境上 `/`、`/ai-image-generation`、`/templates`、`/templates/photo`、`/templates/video` 的图片卡链接指向的是**公共 slug 路由**（如 `/ai-video-generation/close-up-unboxing-makeup-tools-templates`），而不是工作台的固定目录 URL（`/app/create/ai-video-generation` 等）。点击后页面内容确实是工作台、提示词也已预填，但地址栏一直停留在公共 slug 上。

同时确认了 3 个同源问题：模板页 photo/video 两个 URL 内容完全相同；图片页所有 “Make a photo like this” 指向同一个通用工具；演员页所有 “Use <actor>” 指向同一个通用工具，卡片身份没有带过去。

**2026-10-20 晚已按 P0 完成 code-only 部署并通过生产验收，见下一节。** P1 的三项（演员身份、图片 preset、模板 photo/video 过滤）与 P2 门禁随后也已实现并部署，最终状态见文末“最终验收”。

## P0 部署与生产验收（2026-10-20 晚）

- 部署 commit：`e12d78eff9dfc6b19e46bfa73bb816147b4eaef5`（已推送到 `origin/main`）。
- 目标：`www.aivideosugc.com` / `aidreamcapes.service` / `site_aidreamcapes`；`current` 指向 `/www/wwwroot/aidreamcapes.com/releases/e12d78eff...-seo`。
- 远端首次构建在 10GB heap 处 OOM（服务器 15GB RAM，swap 已大量占用）；随后用 `deploy-aidreamcapes-release.mjs --prebuilt-build`，从干净的 `e12d78eff` worktree 本地构建（`.next-build/BUILD_ID` + `.build-commit` 校验），远端只安装依赖、解包构建产物并做候选验证。候选与原位 release route smoke 均通过。
- 部署为 code-only，没有内容写入、没有 LivePage 迁移、没有快照导入；`mydreamshoots.service` 的 PID 与 WorkingDirectory 在部署前后保持不变。

生产验收（Cloudflare 边缘与直连生产 Nginx 均返回新 HTML；边缘 `cf-cache-status: DYNAMIC`）：

| 页面 | 入口 | 点击后地址栏 | composer |
|---|---|---|---|
| `/` | 20/20 `.v-pick-card` 均为 `/app/create/ai-video-generation` | `/app/create/ai-video-generation`，无 query/hash | 已预填（103 字符） |
| `/templates` | 37/37 卡片均为 `/app/create/ai-video-generation` | 同上 | 已预填（124 字符） |
| `/templates/photo` | 37/37（仍与 `/templates` 同内容） | 同上 | 已预填；P1 伪过滤未修 |
| `/templates/video` | 37/37（仍与 `/templates` 同内容） | 同上 | 已预填；P1 伪过滤未修 |
| `/ai-image-generation` | 9 个入口（含 4 个 “Make a photo like this”）均为 `/app/create/ai-image-generation` | `/app/create/ai-image-generation`，无 query/hash | 为空；P1 图片身份未修 |
| `/ai-actors` | 54 个 “Use” 入口均为 `/app/create/ai-video-generation` | 同上 | 为空；P1 演员身份未修，目标 view 仍为 video |

补充断言与观察：

- 所有点击后的 URL 均不含 `prompt/size/length/source/preset/tool_id/view/template`，也没有 hash。
- 首页点击后刷新，composer 恢复为空，入口 cookie 已被服务端消费。
- `/app/create/video`、`/app/create/images`、`/app/create?view=images` 均 308 到对应固定 view；`/app/create/tool/image-to-video` 返回 200（现有 release smoke 的预期行为，内容落到规范 view，不是 308）。
- 生产页面仍有指向 `/ai-video-generation/<slug>` 的普通导航/示例链接（首页 38 个、图片页 26 个、模板页 21 个），但它们都不是 `.v-pick-card` 的卡片入口；卡片入口已全部固定。
- 本机直连 Cloudflare 边缘出现 TLS reset（`curl` 与 Node fetch 均复现），但从生产服务器访问 `https://www.aivideosugc.com` 正常，且直连 Nginx 正常。Playwright 点击验收使用 `--host-resolver-rules` 直连生产 Nginx，避开了本机到边缘的网络问题；不是应用 5xx。
- `/templates/photo` 与 `/templates/video` 的 HTML 字节数仍与 `/templates` 相同（515012），确认 P1 第 4 条仍未解决。

## 实测证据（部署前，生产 www.aivideosugc.com，Playwright 2026-10-20）

| 页面 | 卡片链接 | 点击落点 | 地址栏 |
|---|---|---|---|
| `/` | 20 个 `.v-pick-card`，全部 `/ai-video-generation/<slug>`，例：`/ai-video-generation/canvas-tote-product-detail` | 200，标题 `Workspace \| AIVideosUGC`，composer 已预填 | **保持 slug URL** |
| `/templates` | 37 个卡片：35 个 `/ai-video-generation/<slug>-templates` + 2 个 `/ai-video-generation/<slug>` | 200 Workspace，composer 已预填 | **保持 slug URL** |
| `/templates/photo` | 与 `/templates` 完全相同的 37 个视频模板 | 内容、canonical、卡片列表均相同 | 保持 slug URL |
| `/templates/video` | 与 `/templates` 完全相同 | 同上 | 保持 slug URL |
| `/ai-image-generation` | 2 个目录卡指向公共工具页；4 个 “Make a photo like this” 全部指向 `/app/create/tool/photo-hub/white` | 通用图片工作台 | 工具路径，非卡片对应 URL |
| `/ai-actors` | 每个 “Use <actor>” 都指向 `/app/create/tool/spokesperson-videos#step-video` | 通用演员工作台 | 工具路径，演员身份丢失 |

补充事实：

- 工作台落地后，左侧栏链接是固定的 `/app/create/ai-video-generation`、`/app/create/ai-image-generation`、`/app/create/ai-actors`（用户所说“工作台目录是固定住的”）。
- 工作台 slug 页返回 `meta robots: noindex, nofollow`、无 canonical —— 没有索引风险，但 URL 形态错误。
- 生产 HTML 中 `data-workspace-entry` 入口节点数量：部署前为 **0**；部署后首页 33、`/templates` 52、`/ai-image-generation` 9、`/ai-actors` 54（Playwright DOM 计数）。
- 生产已经会规范化 `/app/create/*`：`/app/create/tool/image-to-video` 最终变为 `/app/create/ai-video-generation/image-to-video`；但不会规范化 `/ai-video-generation/<slug>`（因为它不在 `/app/create` 下）。

## 部署前本地验证（2026-10-20 晚，production build）

用当前 HEAD 重新构建并在本地起服务（3005）实测，入口契约已经生效：

| 页面 | 卡片 href | `data-workspace-entry` | 点击结果 |
|---|---|---|---|
| 首页 | 33 个卡片全部 `/app/create/ai-video-generation` 或 `/app/create/ai-image-generation` | 33/33 | URL 固定，composer 预填该卡提示词 |
| `/templates` | 52 个卡片全部 `/app/create/ai-video-generation` | 52/52 | 两张不同卡片打开后提示词不同（preset 解析正确） |
| `/ai-image-generation` | 9 个卡片全部 `/app/create/ai-image-generation` | 9/9 | URL 固定，但 composer 为空（payload 只有通用 tool/template） |
| `/ai-actors` | 54 个 “Use” 全部 `/app/create/ai-video-generation` | 54/54 | payload 只有 `tool: spokesperson-videos`，没有演员身份 |

本地点击首页第一张卡：地址栏 `.../app/create/ai-video-generation`，无 `prompt/template/size/length/preset/source` 参数，composer 为 `Canvas tote bag shown upright...`。

→ **URL 固定化本身已经实现；该构建已于 2026-10-20 晚部署并通过生产验收（见上节）。** 仍存在的三个数据/页面问题见下。

## 根因

1. **`pickerPresetHref` 的优先级错误**（`src/lib/aidreamcapes-workspace/preset-contract.ts:111-124`）：先返回 `workspaceMediaRoutePath`（publicSlug）和 scene 路由，最后才考虑 preset 包装。卡片因此永远拿不到 `/app/create/...`。
2. **数据交接机制部署前未上线**：工作树里有一套 `entry-transfer`（cookie + `data-workspace-entry`），会在 SSR 把 href 改写成固定工作台路径、点击时把卡片选择写入 2 分钟 cookie，工作台服务端解析后清掉 URL 参数。该机制已随 `e12d78eff` 部署。
3. **内容里硬编码通用链接**：`/ai-image-generation` 的 4 个 “Make a photo like this” 全部写死 `photo-hub/white`；演员卡全部写死 `spokesperson-videos`。这些链接即使落到 `/app/create/...`，也带不出卡片对应的图片/演员。
4. **模板页没有 photo 数据**：`/templates` 的 picker 共 37 张，`kind` 全部是 `video`；`/templates/photo` 只是复用了同一页，没有按 kind 过滤，也没有 photo 模板卡片。
5. 公共目录卡与工作台详情页共用 `/ai-(video|image)-generation/<slug>` 前缀，链接生成端把“可读 slug”当成了默认入口。

## 整改方案

### P0：部署已实现的入口契约（已完成）

入口契约代码已经提交（URL 规范化 `66d6392c4` / `649acfc06`，入口交接 `e12d78eff`），本地 production build 已验证，并已于 2026-10-20 晚完成 **code-only 部署 + 生产验收**，不再需要新的入口实现：

1. `pickerPresetHref` + `WorkspaceEntryLink` 已把卡片 href 统一为固定工作台路径；数据通过 `data-workspace-entry` → 2 分钟 cookie → 服务端 preset 解析，URL 不含数据。
2. 旧链接兼容已在 `static-routes.ts` / 5 个 create 入口实现（`/app/create/video`、`/app/create/images`、`/app/create?view=*` 等 308 到规范路径；`/app/create/tool/*` 保持 200 并由路由渲染规范 view，现有 release smoke 按此断言）。
3. `/ai-video-generation/<slug>`、`/ai-image-generation/<slug>` 仍作为旧书签别名保留；是否 308 到固定路径可作为后续收敛项（当前是 200 workspace + noindex，无索引风险）。

### P1：三个仍然存在的页面/数据问题

4. **`/templates/photo`、`/templates/video` 是伪过滤**：middleware 把两个路径都 rewrite 到 `/templates`（`src/middleware.ts:925-927`），没有按 `kind` 过滤；模板 picker 的 37 张卡全部是 `video`，photo 路由没有数据。整改：给 `/templates/<kind>` 增加服务端过滤 + 补 photo 模板卡（字段级 manifest），或在 photo 数据就绪前把 `/templates/photo` 308 到 `/templates` 并下线 “Browse all images” 入口。
5. **演员卡没有带演员身份**：54 个 “Use <actor>” 的 payload 都是 `{view:"video", query:{tool:"spokesperson-videos"}}`，所以所有演员打开同一个通用视频工作台。整改：payload 增加 `actor`（服务端白名单 + 解析演员 preset），或改成每演员一个 preset 身份；落到 `/app/create/ai-actors` 还是 `/app/create/ai-video-generation` 需要产品确认（当前是 video）。
6. **图片页 “Make a photo like this” 没有带图片数据**：payload 只有 `{tool:"photo-hub", tool_id:"image_generator", template:"white"}`，composer 为空。整改：每张图生成自己的 preset 身份（source + card identity），或在该 section 的渲染器里把图片/提示词写进 entry；属于内容字段级修订。

### P2：回归与验收

7. 新增 SSR 链接审计 smoke（覆盖 5 个页面）：所有 `.v-pick-card[href]` 必须匹配 `^/app/create/(ai-video-generation|ai-image-generation|ai-actors)(/|$)`；禁止出现 `/ai-(video|image)-generation/<slug>` 卡片链接。
8. 点击 E2E：每个页面点 1 张卡，断言最终 URL 精确等于固定路径、无 `prompt/size/length/source/preset` 参数、无 hash；composer 已预填；刷新后回到通用工作台（cookie 已消费）。
9. `/templates/photo` 与 `/templates/video` 卡片集合必须不同（或按第 4 条 308）；canonical/robots 与策略一致。
10. 旧路径回归：`/app/create/tool/*`、`/app/create?view=*` 全部落到固定路径；无 404、无循环。

## 实施顺序与注意事项

1. 入口交接与 URL 规范化已经提交（`e12d78eff`、`66d6392c4`、`649acfc06`）；部署前再跑一次 `typecheck`、入口相关 smoke 与 production build。
2. P0 已部署（`data-workspace-entry` 入口节点已上线）；第 7–10 条随后已实现为发布门禁（见文末“最终验收”），但仍不能替代人工验收。
3. P1 第 4–6 条涉及内容字段（photo 模板、演员身份、图片 preset），走字段级 compare-and-set manifest，禁止全站生成或快照回滚；不触碰 MyDreamShoots。

## 验收标准（用户视角）

- 从 `/`、`/ai-image-generation`、`/templates`、`/templates/photo`、`/templates/video` 点击任意图片卡，地址栏都是 `https://www.aivideosugc.com/app/create/ai-video-generation` 或 `/app/create/ai-image-generation`（及对应 tool 子路径），**看不到任何案例数据**。
- 工作台打开时提示词/画幅/时长/场景已按所点卡片预填。
- 工作台左侧栏 href 与落地 URL 一致，均为固定目录。
- 模板页 photo/video 不再展示同一批视频模板。

## 验收结果（P0 阶段，历史记录）

- **P0 通过**：5 个公共页面的卡片入口全部是固定 `/app/create/...`；点击后 URL 无案例数据、无 hash；首页与模板页 composer 已预填；刷新后入口 cookie 已消费。
- **P1 当时未通过**：`/ai-image-generation` 的 “Make a photo like this” composer 仍为空；`/ai-actors` 的 “Use” 仍落到 video view 且 composer 为空；`/templates/photo` 与 `/templates/video` 仍与 `/templates` 展示同一批 37 张视频模板。
- **P2 当时未实现**：SSR 链接审计 smoke 与点击 E2E 尚未加入发布门禁。

## 最终验收（2026-10-20 晚，已部署）

P1 三项与 P2 门禁已完成；本节取代上一节的“P1 未通过 / P2 未实现”。

- **部署批次**：`bfcf7fa0a`（演员卡栅格/导航与页面调整）→ `efa88c049`（首页回源性能修复）。生产 `current` 指向 `efa88c04963a0da14a56ace6123f56eca82091ca-seo`，均为 code-only 部署，无内容全站生成、无快照导入。
- **演员入口**（P1-5）：演员卡固定落到 `/app/create/ai-actors`，演员身份通过入口 payload 传入（`actor.id`），工作台 `initialActorId` 预选对应头像；53 个演员 ID 与 `actors.json` **53/53** 匹配。演示者（presenter）入口仅对 Aidreamcapes 或含 `actors` 的来源开放，其他站点/页面不受影响。
- **图片入口**（P1-6）：`/ai-image-generation` 的 4 张 “Make a photo like this” 现在各自携带提示词与画幅，composer 打开即预填；文案/title/alt/分组通过字段级 compare-and-set manifest 写入，最终内容哈希 `788590224a74081a6af4343a17e5080d61f51c0b79b1d12997122a1e3ae4a8d2`，本地与生产读回一致。
- **模板目录**（P1-4）：`/templates` 卡片改用工作台 preset 固定 URL，匹配键为 `href + name + kind` 唯一命中；`/templates/photo` 与 `/templates/video` 按 `kind` 服务端过滤，分别输出 **9 / 9** 张不同卡片，不再复用同一批视频模板。
- **P2 门禁**：`scripts/aidreamcapes-workspace/audit-card-entry-links.mjs`（SSR 链接审计，纳入发布门禁）与 `scripts/aidreamcapes-workspace/smoke-card-entry-browser.mjs`（Playwright 点击 E2E）已加入并通过；本地 production build 全绿。
- **公网复核**：首页 41 条入口链接、图片区 4 条提示词、演员 53/53、模板 18/9/9、视频页 48 条；所有卡片 href 为固定 `/app/create/...`，无案例数据参数。sitemap URL 集合保持 177 条不变。
- **范围确认**：未改动 MyDreamShoots 的页面、内容、路由、SEO 或导航输出；MyDreamShoots 服务与读回在部署前后一致。

