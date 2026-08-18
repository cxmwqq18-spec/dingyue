# MyDreamShoots GPT10 审计未通过项优化整改计划

状态：**本地整改已完成，未发布（local-only-not-published）**

本计划依据 `GPT10-deep-page-by-page-audit.md`，只覆盖本地代码、内容源、本地 PostgreSQL 快照和本地验收脚本。没有执行 content release、Vercel 部署、测试站同步或生产数据库操作。

## 1. 本轮已完成

### 博客内容与实体

- 9 个目标 URL 保留，默认均为 `200`、可索引、自引用 canonical。
- 内容源 `scripts/sync-dreamshoot-blog-content.mjs` 使用完整 slug 覆盖表，绕过重复通用文章生成器。
- 每页拥有独立 H1、H2、表格、检查清单、FAQ、CTA 和 3 条编辑白名单 related links。
- Profile Cards 已重写为独立 profile/card 工作流；本轮未合并或删除 URL。
- 9 页使用统一实体字段：`entityName`、`productSlug`、`userIntent`、`suitableUses`、`unsuitableUses`、`inputRequirements`、`verifiedLimitations`、`comparisonTargets`、`reviewChecklist`、`rightsWarnings`、`relatedGuides`、`authorUrl`、`reviewOwner`、`reviewedAt`、`evidenceDate`、`evidenceType`。
- 当前 9 页均标记 `evidenceType: editorial-guidance`，明确没有声称受控产品性能测试。
- `Magic Upscaler → Photo Enhancer`、`Nature → Travel`、`Outdoor Creator → Urban/Travel` 的产品关系已在正文、CTA 和实体字段中固定。
- 禁止写死 credits、输出数量、处理能力和未经核实的产品保证；正文改为提示用户查看当前产品卡。
- FAQ 保留为可见正文，JSON-LD 只输出一个 `BlogPosting`，不输出 `FAQPage`。

### Virtual Try-On 与 Soccer 门禁

- Virtual Try-On 使用本地三面板候选封面，体现人物原图、服装参考和 AI 预览，准确 alt 为：`Three-panel virtual try-on workflow example showing a source portrait, an outfit reference, and an AI preview.`
- Virtual Try-On 仍保持发布阻塞：人物授权、服装授权、图片版权和内部工作流素材证据尚未核实。
- Soccer 默认不迁移 URL。只有设置 `MDS_SOCCER_MIGRATION_APPROVED=1` 才允许生成 `/blog/soccer-fan-photo-guide` 和旧 URL 的单跳 301；品牌/IP 书面批准缺失时，旧 URL 在本地保持 `200 + self-canonical`，不进入发布候选。
- Soccer 可见 Title、Meta、H1 和正文统一使用通用 Soccer，不使用官方赛事名称、队徽、赞助商、球员肖像或官方关联暗示。

### 共享 SEO、渲染和站内链接

- 38 个 MyDreamShoots 产品详情页增加明确主视觉 H1。
- `/ai-video-generation` 的 Title、Meta、H1 和正文意图保持一致；旧视频主题记录保留历史但已 inactive，AI Video Generation 主题页进入本地 publication snapshot。
- 正常站内 Footer、政策页和导航链接不使用 `nofollow`；外部社交链接继续使用 `nofollow noopener noreferrer`。
- `/app/create#step-video` 登录跳转安全编码目标路径和 fragment，登录后恢复同站路径及视频步骤；外部目标被拒绝。
- `/privacy`、`/cookies`、`/refunds`、`/terms`、`/content`、`/shipping` 等 public policy canonical 页面在 host 与 `/site/mydreamshoots` 路由可渲染；旧 `/policies/*` 形态按 canonical 规则处理。
- Cookie Policy 已恢复为 `/cookies` canonical 页面，隐私正文内链不再指向 404。
- 相关文章选择使用主题标签与编辑白名单，不再固定复用 Avatar、holiday、game-day、premiere 等无关内容。
- sitemap 使用已发布快照中真实可渲染、可索引页面；动态 collection 路由继续通过产品 JSON-LD 和现有目录入口覆盖，不在 smoke 中虚增 ThemePage。
- 图片 sitemap 标题在短标题情况下追加具体工作流描述，避免占位标题。

### 信任、政策和事实边界

- `100% money-back guarantee` 已改为与 Refund Policy 一致的审核、资格、时间窗口和补救措辞。
- `No AI training`、固定 30 天自动删除、AES-256/TLS 等无法由当前公开页面独立验证的绝对表述已改为可核实的流程/政策提示。
- About、Contact、Privacy、Refunds、Terms 和 Footer 不再猜测运营主体；当前缺少法定主体资料时保持阻塞。
- 价格 JSON-LD 只接受 provider-backed `price_...` 且有 `providerVerifiedAt` 的价格；当前已验证价格数量为 0，因此不发布 Offer。

## 2. 九页实体与 CTA 矩阵

| URL | 主实体/产品 | CTA 与独立内容 |
|---|---|---|
| `/blog/cyberpunk-photo-package-guide` | Cyberpunk | Cyberpunk；霓虹风格、服装光线、Urban/Nightlife 对比、溢色和标牌检查 |
| `/blog/mafia-photo-package-guide` | Mafia | Mafia；虚构黑色电影风格、服装场景、肖像权和真实犯罪关联边界 |
| `/blog/magic-upscaler-photo-package-guide` | Magic Upscaler / Photo Enhancer | `/ai-image-generation/photo-enhancer`；可增强与不可恢复内容、Unblur/Restoration 对比 |
| `/blog/nature-photo-package-guide` | Nature / Travel | `/ai-image-generation/travel`；森林、山地、湖畔、季节天气和旅行真实性边界 |
| `/blog/outdoor-creator-scenes-photo-package-guide` | Outdoor Creator / Urban + Travel | 双 CTA；社交裁剪、城市/自然选择、留白、品牌标识和披露 |
| `/blog/valentine-photos-photo-package-guide` | Valentine's Day / Valentines Photo | `/ai-image-generation/valentines-photo`；单人/双人、双方同意、卡片留白、与 Engagement/Wedding 区分 |
| `/blog/virtual-try-on-photo-package-guide` | Virtual Try-On | `/ai-image-generation/virtual-try-on`；不保证尺码/面料/颜色/合身，检查身体衣物边缘 |
| `/blog/wedding-portraits-photo-package-guide` | Wedding Photo | `/ai-image-generation/wedding-photo`；请柬、情绪板、纪念用途，不伪装真实婚礼记录 |
| `/blog/world-cup-fan-photos-photo-package-guide` | Soccer | `/ai-image-generation/soccer`；通用足球粉丝海报，禁止官方标志、队徽、赞助商和球员肖像 |

## 3. 未解除的发布阻塞

这些项目不能靠代码或推测关闭，已在本地验收中明确保留：

1. Virtual Try-On 的人物、服装和图片授权，以及真实“人物原图 + 服装参考 + AI 预览”发布素材证据。
2. Soccer 新 URL 的品牌/IP 书面批准。批准前不得开启迁移环境变量，也不得发布新 URL。
3. 法定运营主体、About/Contact/政策页的统一实体真值。没有内部责任记录或法律资料时不填写公司名称。
4. 隐私、安全、训练和删除能力的工程/法律可验证证据。证据缺失时继续使用保守流程表述。
5. Provider-backed 价格和 checkout 事实。当前不生成价格 Offer。
6. 九页真实产品测试资料。当前内容属于 editorial guidance，不得写成实测结论。
7. `/aidreamshoots.eu/tools` 外部域名路由需要单独责任人和验收，不与本地博客整改合并。

## 4. 执行与发布门禁

每次重新生成内容后执行：

1. `npm run sync:mydreamshoots-audit-closure`，确认 dry-run 只报告 0 个未解决绝对声明，且不超出本地目标。
2. `npm run smoke:dreamshoot-blog-content`、`npm run smoke:mydreamshoots-priority-blog-remediation`。
3. `npm run smoke:mydreamshoots-seo-indexing`、`npm run smoke:mydreamshoots-media-seo-schema`、`npm run smoke:storefront-media-alt`、`npm run smoke:storefront-public-routes`（聚焦 `www.mydreamshoots.com`）。
4. `npm run typecheck` 和 `npm run build`。
5. `npm run smoke:playwright-priority-blog`、`npm run smoke:playwright-mydreamshoots-audit-closure`，检查 1440px 和 390px、host 与 `/site/mydreamshoots`、目录锚点、图片、CTA、JSON-LD 和内链。
6. 只有上述本地门禁、事实资料、法律/IP 批准和发布阻塞全部通过后，才进入后续发布评审。

本文件只记录整改设计和当前阻塞，不代表已经发布。
