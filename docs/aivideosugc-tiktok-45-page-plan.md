# AIVIDEOSUGC — TikTok 归档素材 45 个详情页上线计划（待站长批准执行）

状态：**仅计划与数据整理，尚未写入任何线上数据。**
数据清单：`/Users/a1/work/3000课程21个skill/TikTok素材归档_2026-10-28/aivideosugc_45_pages_manifest.json`（机器可读）与同目录 `aivideosugc_45_pages_清单.md`（人类可读）。

## 素材概况

- 来源：TikTok 关键词检索归档（2026-10-28），45 条已出片记录。
- 每条素材四件套齐全且已逐一核验存在：
  - 参考图（`参考图片/NN_<taskId>_参考图.png`，45/45）
  - 英文字幕成片（`生成输出/…_英文字幕.mp4`，45/45，9:16，约 30 秒）
  - 英文字幕 SRT（45/45）
  - 完整英文提示词（docx 内逐条提取，45/45）
- 其中 5 组（1/19、2/9、3/10、4/11、5/20）为同一产品同一脚本的两次独立生成（成片 SHA-256 不同，属两条不同片子）。**站长已拍板：45 条全部上线**，5 组已按各自镜头侧重差异化命名并改写描述（见清单）。

## 页面与数据形状

- 每条素材 = 一个新增 `LivePage`（`site_aidreamcapes`，`pageType=content`）模板详情页，路径形如 `/ai-video-generation/<slug>`，`contentJson` 携带 `templateDefinition`：
  - `card`：`kind="video"`、`label`（页面名称）、9:16 卡片图（用参考图）、`publicSlug`（唯一，如 `washed-graphic-tee-fit-check`）、提示词、时长；
  - `industries[] / platforms[] / occasions[]`：目录页筛选标签（行业 8 目录、平台、场合均从现有目录 slug 词表选取，未造新词）；
  - 详情页展示：参考图 + 成片视频 + 完整英文提示词。
- 目录页（/industries/*、/platforms/*、/occasions/*）与 /templates 依据 `templateDefinition` 标签自动收录，无需改动目录页。
- 工具模块展示位（图片转视频/视频广告/前后对比/产品视频/发言人视频）为建议性二级映射，见清单 `toolModules` 字段，执行阶段按工具页现有示例区结构接入或仅保留目录标签。

## 命名

- 45 个英文页面名称 + slug 全部独立生成，已与站内现有 18 个模板卡 label 及全部公开 slug 查重：**零冲突**。
- 命名规则：产品 + 场景/卖点（如 "Mint Shower Speaker Bathroom Concert"），对第二拍摄组用 "Second Take" 后缀区分。

## 标签覆盖

- 行业：科技与电子产品 14、美容及个人护理 8、衣服 9、家居生活 7、食品和饮料 3、健康与健身 2、珠宝及配饰 2（个别条目双行业）。
- 平台：TikTok 45、Instagram 27、YouTube Shorts 17、Facebook 7。
- 场合：黑色星期五 2（#6 牙贴、#27 绿色洁面）、促销及折扣 3；无节假日场景。
- 每条均打 TikTok 平台标签（素材即 TikTok UGC 风格）。

## 执行阶段（待批准后）

1. **媒体上传**：45 段成片 + 45 张参考图上传至站点媒体存储，记录返回的媒体 URL（候选：既有 workspace 媒体管道/资产端点）。
2. **内容落库**：按 manifest 逐条创建 `LivePage` 行（site_aidreamcapes 显式过滤；新行创建属字段级显式清单操作，不走任何历史快照/发布回滚；不触碰 MyDreamShoots）。
3. **SEO**：每页 title/description 由页面名称与描述派生；确认 sitemap 收录与 no-JS SSR 回归（公开静态回归检查）。
4. **验证**：详情页、目录筛选页、/templates 计数（18 → 58 或 63）逐页抽检；`git diff --name-only` 确认改动范围。

## 决策点

1. ~~45 条全上还是 40 条~~ → **已拍板：45 条全部上线，命名全部不同**（5 组双生成已差异化命名 + 描述改写）。
2. ~~工具模块展示位是否接入~~ → **已接入**：每条视频挂到对应工具页/模板页（见下）。
3. ~~版权/来源确认~~：素材为站长自有生成内容，可直接上传站点媒体存储。

## 执行结果（2026-10-29 已上线）

**媒体**（nginx 直服，`/www/wwwroot/aidreamcapes.com/shared/sites/public-media/`，部署不触及）：

- 成片 45 段 → `video/<slug>.mp4`（1080×1920，30s，共约 1.04GB，SHA 抽验一致）
- 海报 45 张 → `image/<slug>-640.webp`（参考图 cwebp 转码）
- 访问 URL：`/ai-video-generation/<slug>.mp4`、`/ai-image-generation/<slug>-640.webp`

**内容**（两轮字段级 manifest，全部 CAS + 读回断言，未写 SitePublishedState/快照）：

- v1：45 张视频卡片追加到各归属页 `visual.picker.cards`（每条含 label/9:16 海报/英文提示词/30s/publicSlug/video/referenceImages/placement）。
- v2（渲染层适配）：模板页（layout=template）的 picker 被渲染层设计为只显示模板自身卡片（`resolveTemplateCardLinks`），故将 22 张卡从 picker 移入新建 `data.examples` 画廊并在 blockOrder 插入 `examples` 块；`image-to-video`/`product-video` 两个工具页在 blockOrder 插入 `picker` 块。

最终归属（7 页）：

| 页面 | 形态 | 卡片数 |
|---|---|---|
| /ai-video-generation/product-video | 工具 picker | 13（+原有 10） |
| /ai-video-generation/fashion-try-on-reel | 模板 examples 画廊 | 11 |
| /ai-video-generation/beauty-routine | 模板 examples 画廊 | 7 |
| /ai-video-generation/food-video | 模板 examples 画廊 | 4 |
| /ai-video-generation/before-after-video | 工具 picker | 4 |
| /ai-video-generation/image-to-video | 工具 picker | 4 |
| /ai-video-generation/video-ads | 工具 picker | 2 |

**公开入口**：

- 详情页 `/ai-video-generation/<slug>` 45 个（服务端直出，含 <video> 播放、英文提示词、参考图、分类链接）；与既有卡片详情页一致为 noindex,follow（全站既有策略）。
- 行业/平台/场合目录网格自动收录（placement 标签）：电子 32、衣服 30、美容 24、食品 8、家居 12、健康 16、珠宝 14；TikTok 90、IG 56、YT Shorts 22、FB 12；黑五 4、促销 6。
- sitemap 维持 178 条（卡片详情页与既有行为一致，不经 sitemap，经页面链接可抓取）。

**验证**：本地（dev:local + 本地库）与生产分别抽检 7 个归属页、多个详情页（200 + <video> + mp4 引用 + 提示词文案）、目录网格计数；脚本幂等重跑 0 ops；Cloudflare 边缘缓存已按部署同款 purge（30 文件 + 9 前缀）。`publicRuntimeCache` 以修订探针在下次请求自动生效。

**审计工件**：`scripts/manifests/aidreamcapes-tiktok-case-cards-{source,local,production}-2026-10-28*.json` + plan/apply 脚本。

## v3（2026-10-29）：视频卡进列表自动播放 + 45 条视频上视频总览页

站长反馈两点并确认实施：

1. **列表网格要直接播放视频**。数据层 45 条卡的 `video`/`referenceImages` 字段本就齐全，
   但 `VisualPicker` 只渲染 `<img>`，忽略了 `card.video`。修复（Aidreamcapes 组件内）：
   - `visual.tsx` `VisualPicker`：卡片带 `video` 时渲染 `<video autoPlay muted loop playsInline controls preload="none">`（与模板页画廊 `CaseCard` 行为一致），无 `video` 时照旧渲染参考图；
   - `types.ts` `V2VisualPickerCard` 增加 `video?: V2Video`；
   - `styles.ts` `.v-pick-card video` 复用图片的 1:1 cover 规则；
   - `page.tsx` `oneRowWhenSingles`（仅视频总览页使用）：单项组压为一行展示的行为保留，多项目组（如 45 条案例组）作为独立命名组渲染，互不影响。
2. **`/ai-video-generation` 视频总览页要能找到这批视频**。该页 `data.examples` 画廊此前只有
   5 个旧单项示例。v3 manifest 以一个 `examplesEnsure` op 在该页追加命名组
   "TikTok Shop case studies"（45 条视频 item，形状与 v2 模板页画廊完全一致，
   `publicSlug` 不变、详情页归属不变）。

- 计划脚本：`scripts/plan-aidreamcapes-tiktok-hub-examples.mjs`（只读库 + 产出可审阅 manifest）。
- manifest：`scripts/manifests/aidreamcapes-tiktok-hub-examples-{local,production}-2026-10-29.json`，
  复用 v2 apply 脚本（contract v2、updatedAt CAS、读回断言、幂等）。

**⚠️ v3 事故与 v4 修复（2026-10-29）**：v3 的 hub 画廊 item 带 `publicSlug`，使 45 个 slug
各出现两个 owner；`resolveMediaDetail` 要求 slug 全站恰好 1 个 owner（`pages.length !== 1`
即 404），导致 45 个详情页短暂 404。v4 manifest 以新 op `examplesDetachPublicSlug`
剥掉 hub item 的 `publicSlug`（保留 `href`，画廊链接照常跳详情页），详情归属恢复唯一，
目录网格计数恢复基线。教训：**详情 owner 是全站唯一的；跨页引用画廊一律不得携带
`publicSlug`**（v2 的 slug-owner 不变量只拦截了 count<1，未拦截引用性复制）。

- v4 计划脚本：`scripts/plan-aidreamcapes-tiktok-hub-detail-ownership-fix.mjs`
  （含 orphan 校验：剥离前每个 slug 必须在 hub 之外仍有唯一 owner）。
- v4 manifest：`scripts/manifests/aidreamcapes-tiktok-hub-detail-ownership-fix-{local,production}-2026-10-29.json`。
- 本地与生产均已应用（各 1 op，CAS + 读回断言）；生产复验：45 个详情页 200、hub 45 个 mp4。
- 本地执行：apply 成功（1 op），examples 50 条（45 新 + 5 旧），dev:local 浏览器验证
  hub 新组 45 视频卡渲染、product-video picker 23 卡（13 视频 + 10 图片）、
  video-ads/before-after/image-to-video picker 视频 2/4/4、无页面错误。
- 生产执行：apply 成功后经 Cloudflare 直连源站复验（见执行报告）。
- 部署：代码随 release commit 上线（code-only），内容经 manifest 字段落库，
  无快照/发布状态写入。
