# Aidreamcapes.com 新站（v2）代码改造规划

- 日期：2026-10-02
- 分支：`aidreamcapes/site-v2`（基于 `main` 9e6a5f17）
- 状态：`PLAN_READY`，阶段 0 至阶段 2 开工
- 范围：只改 `site_aidreamcapes`（aidreamcapes.com）。不改 aidreamcapes.eu（`site_aidreamcapes_xby`），不改 MyDreamShoots（`site_dreamshoot`）。
- 验收依据：
  - 已通过评审的静态原型：`docs/prototypes/aidreamcapes-site/`，共 75 页，包含 SEO 字段、结构化数据和 301 跳转表；
  - 文案源文件：`scratchpad/site2/content/*.json`，会搬进仓库。

## 0. 必须遵守的约束

依据 AGENTS.md 和 `docs/no-snapshot-incremental-release.md`：

1. **数据：** 公开页面的内容只能从 `LivePage.contentJson` 读取，并由服务端渲染。浏览器端不能请求正文、导航或 SEO 数据。不能写死文案，也不能用快照兜底。
2. **前台文案：** 页面上只出现写给客户看的文案。内部说明、SEO 策略、提示词一律不能进入前台，包括 HTML 注释、隐藏 DOM 和前端变量。
3. **站点隔离：**
   - 所有数据库写入都必须带 `site_aidreamcapes` 过滤；
   - 改 MyDreamShoots 也在用的共用文件之前，要拿到明确批准；
   - 共用文件里的改动必须用站点判断隔离，保证 MyDreamShoots 和 .eu 的输出不变。
4. **发布：**
   - 代码通过 `scripts/deploy-aidreamcapes-release.mjs` 发布（要求代码已合并到 `main`）；
   - 页面数据通过迁移脚本 `--apply-production --confirm=production` 写入；
   - 两者都要单独批准。
   - 注意：发布脚本**不会上传 `public/` 下的新文件**，新图片要另走素材同步。

## 1. 现状摸底结论（带代码位置）

| 项目 | 现状 | 对改造的影响 |
|---|---|---|
| 路由 | 中间件把 aidreamcapes.com 的请求内部转到 `/site/aidreamcapes<path>`（`src/middleware.ts:976-1005`），再按 slug 读取 LivePage（`storefront-context/snapshot.ts:423-467`） | 新页面（如 /templates、/industries/*、/platforms/*、/guides/*、/trust-and-safety、/ai-info）只要写 LivePage 就能打开、能被收录、会进 sitemap |
| 例外 1：图片页 | `/ai-image-generation/<slug>` 只认 30 个已登记的 slug（`src/lib/aidreamcapes-image-theme-routes.ts:3-34`） | 新站沿用的图片页 slug 都在名单里，新增 slug 要同步改这个 Aidreamcapes 专用文件 |
| 例外 2：视频页 | `/ai-video-generation/<slug>` 要在导航派生的名单里（`src/lib/aidreamcapes-navigation.ts:54-60`） | 新增 image-to-video 时要更新名单（Aidreamcapes 专用文件） |
| 例外 3：标准页 | `/about-us`、`/faq`、`/pricing` 必须有主图，否则返回 404（`snapshot.ts:537-545`） | 这几页的内容里要带主图 |
| 渲染 | 按 section type 选择组件（`theme-renderer.tsx:11076-11128`），没有新 section type 的页面会落到通用渲染器 | 新增 Aidreamcapes 专用 section type `aidreamcapes_v2_page`，加一套新组件 |
| 导航 | 数据在 `ThemeSettings.draftJson/publishedJson.aidreamcapesZipNavigation`；菜单项是 `{label, href}`，不能带说明和图片（`types.ts:69-97`）；页脚分组写死在 `storefront-render.tsx:2993-3002`、`theme-renderer.tsx:2132-2134` | 新增 v2 导航结构和 Aidreamcapes 专用的表头、页脚组件 |
| SEO | `<head>` 的字段取自 LivePage 的 `seo`（`storefront-metadata.ts:106-111`），但结构化数据优先读一张写死的标题表（`json-ld.ts:1741`），两者可能不一致；canonical 固定为 https://aidreamcapes.com（`seo-projection.ts:17-23`） | 结构化数据要新增 v2 分支，从 contentJson 生成 |
| 301 | 退役路由名单在 `aidreamcapes-image-theme-routes.ts:42-191`，由中间件执行（`middleware.ts:851-864`） | 37 条 301 写进这份 Aidreamcapes 专用名单 |
| llms.txt | 目前会被转到页面兜底路由，返回 404 | 需要新加 route 文件，中间件放行（共用文件） |
| 工作台 | 只读取 `tool_id`、`pack`、`category`，`videoMode` 没有被读取；默认 16:9、15 秒（`customer-video-workspace.tsx:535-540`）；已有 `VideoRetryDraft` 机制可以预填风格、尺寸、时长和描述 | 增加参数预选（共用组件） |
| URL to Video | 没有任何安全抓取外部链接的代码（没有 SSRF 防护）；上传、存储、建任务的链路都有现成实现可以复用 | 新写抓取库、API 和工作台入口 |
| 本地环境 | 项目规定本地库在 `127.0.0.1:15433`（原本用 Docker 起）；这台电脑没装 Docker，现有库在 5432、结构太旧、缺 LivePage 表；也没有把线上 Aidreamcapes 数据拉到本地的脚本 | 阶段 0 先搭好本地库 |

## 2. 分阶段计划

### 阶段 0：本地环境（不改代码）

1. 用 Homebrew 的 Postgres 在 `127.0.0.1:15433` 起一个独立实例，数据目录放在仓库外。现有 5432 的库不动。
2. 把 5432 本地库的数据复制过去，用 `prisma db push` 把表结构补到最新，再把已有迁移全部标记为已应用，让 `npm run dev` 的 `migrate deploy` 能正常通过。
3. `.env.local` 的端口改成 15433，改之前先备份原文件。
4. 稀疏检出加回 `public/assets/sites/site_aidreamcapes/site-v2/`，用来放新站图片。

### 阶段 1：页面组件（全部是 Aidreamcapes 专用的新文件）

- 新增 `src/components/storefront/aidreamcapes-v2/`，覆盖这些页面类型：
  - 首页、视频总入口；
  - 工具页、模板页；
  - 行业页、平台页、节点页；
  - 列表页（模板库、行业、平台、指南、博客）；
  - 文章页；
  - 定价、FAQ、联系、关于、示例；
  - 信任与安全、AI 信息页。
- 组件只读 `contentJson` 和导航数据，服务端渲染。
- 客户端只保留纯展示交互：下拉菜单、模板筛选（只是隐藏或显示服务端已经渲染出来的卡片）、FAQ 折叠。不发任何请求。
- 视觉沿用原型：黑底、紫粉蓝、Outfit 字体。

### 阶段 2：内容与数据迁移（Aidreamcapes 专用）

1. 把原型的 75 页文案和 master 清单搬进 `scripts/data/aidreamcapes-site-v2/`。
2. 新增 `scripts/lib/aidreamcapes-site-v2-content.mjs`，负责校验内容并生成 LivePage 的 contentJson。
3. 新增 `scripts/migrate-aidreamcapes-site-v2.mjs`，按 ads-testing 迁移脚本的规范写：
   - 默认只预演，`--apply-local` 和 `--apply-production` 二选一；
   - 必须带 `--confirm`，写入前备份到 `releases/backups/aidreamcapes/`；
   - 写入后按哈希逐页回读核对；
   - 导航同时写进 draftJson 和 publishedJson。
4. 新增「信任与安全」和「AI 信息」两页的内容，补全原型里还缺的部分。

### 阶段 3：接入共用层（需要你批准，全部按站点隔离）

| # | 文件（共用） | 改动 | 对 MyDreamShoots 的影响 |
|---|---|---|---|
| S1 | `src/components/theme-renderer.tsx` | 在 section 分发处加一个分支：Aidreamcapes .com 且 type 为 `aidreamcapes_v2_page` 时，交给新组件渲染 | 无。MyDreamShoots 没有这个 type |
| S2 | `src/lib/types.ts` | `ThemeNavLink` 增加可选字段 `description`、`image` | 无。只增加可选字段 |
| S3 | `src/lib/storefront-render.tsx`、`theme-renderer.tsx` 页脚和表头部分 | Aidreamcapes .com 改为读取 v2 导航和页脚数据，不再用写死的页脚分组 | 无。有站点判断 |
| S4 | `src/lib/theme/json-ld.ts` | 新增 v2 分支，从 contentJson 生成结构化数据（WebPage / CollectionPage / Article / FAQPage / BreadcrumbList / SoftwareApplication，不带 Offer 和评分） | 无。有站点判断 |
| S5 | `src/lib/storefront-metadata.ts`、`src/lib/dreamshoot-seo-content.ts` | Aidreamcapes v2 页面一律使用 LivePage 的 SEO，去掉写死标题表的覆盖 | 无。只删 Aidreamcapes 的条目 |
| S6 | `src/middleware.ts` | 放行 `/llms.txt`；接入 37 条 301（名单放在 Aidreamcapes 专用文件里） | 无。只在 aidreamcapes.com 的 host 分支里生效 |
| S7 | 新增 `src/app/llms.txt/route.ts` | 按 host 输出，内容取自 LivePage 数据 | 无。其他站点返回 404 |
| S8 | `storefront-render.tsx`、`customer-workspace-shell.tsx`、`customer-video-workspace.tsx` | 工作台读取 `template`、`size`、`length`、`prompt` 参数，预选风格、尺寸、时长和描述 | 无参数时行为不变 |
| S9 | `src/lib/seo-indexing.ts` | sitemap 排除 noindex 页面和已退役页面（只对 Aidreamcapes 生效） | 无 |

### 阶段 4：URL to Video（新功能）

1. **抓取库** `src/lib/product-url-import.ts`：
   - 只允许公网 https 链接，DNS 解析后拦截内网、回环和保留地址；
   - 限制跳转次数、超时、响应大小；
   - 只解析 HTML 里的 og:image、商品结构化数据中的 image 和 title；
   - 图片下载后按字节判断真实格式，用 sharp 规范化。
2. **API**：新增 `POST /api/sites/[siteId]/customers/[customerId]/assets/import-url`。
   - 用 `requireCustomerMutation` 做登录、CSRF 和限流校验；
   - 复用上传链路写入素材，标记为 `video_frame`；
   - 返回素材 id 和标题。
3. **工作台**：视频页加一个「Paste a product link」输入框。抓到的图片放进参考图，标题填进描述，客户可以修改。用功能开关只对 Aidreamcapes 开放。
4. **公开页**：新增 `/ai-video-generation/url-to-video`。首屏放链接输入框，旁边配一个示例链接按钮。文案按真实能力写：自动抓取商品图和标题，再生成视频。

### 阶段 5：素材

- 新站图片先用原型里验过的那批，放到 `public/assets/sites/site_aidreamcapes/site-v2/`。
- 视频样片要重做：9:16，画面里不烧录 AI 字幕。调用供应商生成前，先报预计费用和调用次数，等你确认。
- 线上发布时，图片和视频通过素材同步上传，因为代码发布脚本不会带 `public/` 下的文件。

### 阶段 6：验收

1. `npm run typecheck`、`npm run lint`。
2. 守卫脚本：`guard:public-storefront-ssr`、`guard:live-storefront-ssr`、`guard:storefront-launch-seo-contract`。
3. Aidreamcapes 冒烟：`smoke:aidreamcapes-seo-contract` 和 `smoke:aidreamcapes-seo-browser`，在本地 3002 端口跑。
4. 用原型的校验规则对本地 SSR 输出再跑一遍：
   - Title 和 Description 的长度、全站唯一；
   - 每页一个 H1；
   - 禁用说法、内部用语；
   - 链接是否有效；
   - FAQ 结构化数据和页面一致。
5. 截图：1440px 和 390px，覆盖首页、各类型代表页和菜单。
6. MyDreamShoots 只读回归：`smoke:mydreamshoots-seo-fingerprint`、`audit:store-isolation`。核对 `git diff --name-only`，确认所有改动都在 Aidreamcapes 范围内，或在已批准的共用层清单里。

### 阶段 7：上线（每一步都要单独批准）

1. 合并到 `main`，用 `deploy-aidreamcapes-release.mjs` 发布代码（脚本会先在候选端口跑冒烟，失败自动回滚）。
2. 素材同步到线上 `public/assets/sites/site_aidreamcapes/site-v2/`。
3. 用迁移脚本 `--apply-production` 写入 LivePage 和导航（写入前备份，写入后回读核对）。
4. 线上核对：
   - 75 页都返回 200；
   - 37 条 301 都生效；
   - sitemap、robots、llms.txt 都正常；
   - 抽查页面没有浏览器端取数。
5. 在 Search Console 提交新的 sitemap。

## 3. 待你确认的事项

1. 批准阶段 3 的共用层改动 S1–S9（全部按站点隔离，MyDreamShoots 输出不变）。
2. 批准阶段 0 的本地环境改动：新起 15433 实例；`.env.local` 端口改成 15433，改前备份。
3. 运营主体名称：页脚和法律页要用。
4. 积分换算：每条视频、每张图消耗多少积分。
5. 视频样片重做的供应商费用上限。
