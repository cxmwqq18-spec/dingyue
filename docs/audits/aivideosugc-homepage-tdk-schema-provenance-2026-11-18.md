# AIVideosUGC 首页 TDK / JSON-LD 数据溯源审计

- 站点：`site_aidreamcapes`（对外品牌 AIVideosUGC，主域 `www.aivideosugc.com`）
- 页面：`/`（`site_aidreamcapes_home`）
- 审计时间：2026-11-18（UTC 08:12 抓取，绕过缓存）
- 结论一句话：**首页源码里的三段“描述”不是同一条数据，而是三个不同字段、三个不同数据源；社媒 `sameAs` 与可见页脚互相矛盾；两者都是历史迁移遗留，不是本次账号/积分发布引入的。**

---

## 1. 现象

`view-source:https://www.aivideosugc.com/` 中同时存在三段长文案：

| # | 出现位置 | 当前实际值 | 长度 |
|---|---|---|---|
| A | `<meta name="description">`、`og:description`、`twitter:description`，以及 JSON-LD `SoftwareApplication.description` | Turn one product image into UGC video ads and product photos. One-time credit packages from $24 — no subscription, all models and AI actors included, watermark-free export. | 172 |
| B | JSON-LD `WebPage.description` | Turn product URL, image, or prompt into authentic, high-converting UGC video ads in minutes with AI video agent and AI actors, ready-to-use video templates. | 156 |
| C | JSON-LD `Organization.description` | AIVideosUGC is an online tool that turns a product photo or a product page link into short video ads and store-ready product images for online stores. | 150 |

同一个 `<script type="application/ld+json">` 图里，`SoftwareApplication`（A）和 `WebPage`（B）用了两段不同文案，因此看起来“有历史数据”。

同一页面还有第二处矛盾：**JSON-LD `Organization.sameAs` 指向 Aidreamcapes 的 6 个社媒账号，而页面可见页脚指向 AIVideosUGC 的 9 个账号。**

| 位置 | 账号 |
|---|---|
| JSON-LD `Organization.sameAs`（全站每页） | `instagram.com/aidreamcapes`、`facebook.com/aidreamcapes`、`pinterest.com/aidreamcapes`、`youtube.com/@aidreamcapes`、`x.com/aidreamcapes`、`tiktok.com/@aidreamcapes` |
| 可见页脚 `socialLinks`（首页、/pricing、/ai-video-generation、/about-us 一致） | `facebook.com/AiVideosUGC/`、`instagram.com/aivideosugc/`、`pinterest.com/AiVideosUGC/`、`x.com/AiVideosUGC`、`youtube.com/@AiVideosUGC`、`tiktok.com/@aivideosugc`、`reddit.com/user/AiVideosUGC/`、WhatsApp 频道、Discord |

> 说明：当前线上 JSON-LD 中**没有** `keywords` 字段（只有 `<meta name="keywords">` 一处，值为关键词列表 `AI UGC ads,AI UGC video ads,AI UGC image ads,AI UGC ad Generator,AI Generated UGC ads,AI Actors ads`）。今天三个发布版本的 `.origin.html` / `.candidate.html` 快照中也不存在 `"keywords": "Turn product URL…"` 这种形态，属于更早缓存/旧渲染的截图。

---

## 2. 逐字段溯源

| 输出字段 | 数据来源（owner） | 最后写入 | 写入者 / 机制 |
|---|---|---|---|
| `<title>`、`og:title`、`twitter:title`、JSON-LD `WebPage.name` | `LivePage.contentJson.seo.title`（渲染）+ 存储图 `WebPage.name`（原值） | 页面行 2026-11-14 13:49:40；TDK 值本身自 2026-10-17 未变 | 内容构建 + TDK 锁基线 |
| A：meta/og/twitter description、`SoftwareApplication.description` | `LivePage.contentJson.seo.description` + `seo.twitterDescription` | **2026-11-14 13:49:40** | `scripts/apply-aivideosugc-credit-reprice-display-2026-11-12.mjs`（提交 `524f8b5a7`，2026-11-12），只改这两个字段 |
| B：`WebPage.description` | `LivePage.contentJson.seo.jsonLd.@graph` 里已存储的 WebPage 节点 | 2026-10-22（内部链接批次的 `homeDescriptionOperations`） | 提交 `4a18b1608`；11-12 的定价清单**没有**同步该节点 |
| C：`Organization.description` | `Site.branding.description`（站点级品牌 JSON） | 早于本次审计；无页面级时间戳 | 站点品牌数据，独立于页面 TDK |
| `Organization.name` / `legalName` / 地址 / 电话 | `Site.name` + `StorefrontProfile.publishedJson.identity`（`BLYDEY INC`、`support@aivideosugc.com`、`(+1)307-310-3014`） | 10 月迁移批次 | 数据正确，仅 logo/social 遗留 |
| `Organization.sameAs` | **代码常量** `src/lib/theme/json-ld.ts:476-483`（`aidreamcapesPublicSocialProfiles`） | 2026-09-30（提交 `cd2ba3003`） | 硬编码；`StorefrontProfile.identity.sameAs` 为空数组，页脚数据不被读取 |
| 可见页脚社媒 | `LivePage.contentJson.siteNavigation.footer.socialLinks`（9 条，AIVideosUGC） | 2026-10-24 导航批次（提交 `69bd362dc`，规范列表见 `scripts/lib/aidreamcapes-social-links.mjs`） | 关系型内容写入 |
| `ThemeSettings` 全局页脚社媒 | `ThemeSettings` 行（仍为 6 条 Aidreamcapes 链接） | 2026-11-01 23:16:45 | 遗留配置；v2 渲染读 `siteNavigation.footer`，该行当前未被公开页使用 |

### 2.1 渲染层如何拼出这三段

`src/lib/theme/json-ld.ts`：

1. `organizationSchema()`（`json-ld.ts:463`）用 `site.branding.description` 生成 Organization 节点 → C；`sameAs` 常量在这个函数里注入（`json-ld.ts:476-483`）。
2. `aidreamcapesV2JsonLd()`（`json-ld.ts:1981`）按顺序拼：生成的 Organization / WebSite / SoftwareApplication（用当前 `seo.description`）/ 面包屑 → 再拼存储图。
3. `normalizeAidreamcapesV2StoredGraph()`（`json-ld.ts:1879`）只过滤掉存储图里的 Organization / WebSite 节点（避免重复），**WebPage / FAQPage 原样输出** → B。
4. 因此同一个图里 `SoftwareApplication` 用新值、`WebPage` 用旧值，是拼装机制直接结果。

### 2.2 分叉的直接原因

2026-10-22 的 internal-links 批次有 3 个 `homeDescriptionOperations`：

- `/seo/description`
- `/seo/jsonLd/@graph/2/description`
- `/seo/twitterDescription`

即当时 meta 与 JSON-LD 是**成对**改的，所以一致。

2026-11-12 的定价展示清单（`apply-aivideosugc-credit-reprice-display-2026-11-12.mjs:135-137`）只改：

```js
contentJson.seo.description = manifest.home.seoDescription;
if (typeof contentJson.seo.twitterDescription === "string") contentJson.seo.twitterDescription = manifest.home.seoDescription;
```

**没有**再改 `seo.jsonLd`，于是 B 与 A 从 2026-11-14 起永久分叉。脚本里虽然有 `assert(!contentJson.seo.description.includes("Turn product URL"), …)`，但只校验 meta 字段，不校验 JSON-LD 图。

### 2.3 为什么没有护栏拦住

`scripts/smoke-aidreamcapes-seo-contract.mjs`：

- `TARGET_PATHS`（`smoke-aidreamcapes-seo-contract.mjs:25`）**不包含 `/`**，所以首页不跑 `title.length<=60`、`description 140–160`、`canonical`、`WebPage.description === metadata description` 这组断言（`…:315-320`、`…:330-333`）。
- 首页单独断言（`…:202-210`）只检查 canonical、`SoftwareApplication.applicationCategory`、`OfferCatalog.name`、offers 形态。
- 没有任何断言检查 `Organization.sameAs` 与页脚一致性。

结果：172 字符的 description、WebPage 与 meta 不一致、sameAs 品牌错位，都可以长期存在于生产环境而不报警。

---

## 3. 根因（按层归类）

### 3.1 站点身份迁移不彻底（历史数据的主要来源）

2026-10-04 提交 `099c54dd3` 把站点迁到 `www.aivideosugc.com`，但：

- 数据库主键仍是 `site_aidreamcapes`，slug 仍是 `aidreamcapes`（`Site` 行：`name=AIVideosUGC`、`slug=aidreamcapes`、`primaryDomain=www.aivideosugc.com`）。
- 品牌资产继续用旧路径：`branding.logoImageUrl=/assets/sites/site_aidreamcapes/brand/aidreamcapesai-logo-refined.svg`，`branding.market` 仍写 “AI video, photo, Save the Date, and private gallery creation”（Aidreamcapes 的定位）。
- 9 月 30 日新增的 `sameAs` 常量按 `site.id === "site_aidreamcapes"` 生效，迁移域名后没有改，于是 AIVideosUGC 的结构化数据持续声明 Aidreamcapes 的社媒账号。
- `ThemeSettings` 的全局页脚在 2026-11-01 仍是 Aidreamcapes 链接，与 v2 页脚数据（`siteNavigation`）脱节，成为第二套“历史数据”。

### 3.2 存储型 JSON-LD 与页面 TDK 是两套 owner

`LivePage.contentJson` 同时存放：

- `seo.description`（页面 TDK，可被 TDK/内容批次改写）
- `seo.jsonLd.@graph`（随页面文案一起生成的结构化数据快照）

代码把后者当作“与页面副本一起生成的完整图”，渲染时只补站点级节点。只要有人只改 `seo.description`（本次定价清单就是这么做的），WebPage 节点就会保留旧文案。这不是快照回滚，而是**同一行数据内两个字段缺少联动**。

### 3.3 硬编码绕过关系型数据

`sameAs` 常量优先，`StorefrontProfile.identity.sameAs`（空数组）和 `siteNavigation.footer.socialLinks`（正确数据）都不被读取。这与仓库契约“公开内容必须来自关系型数据、不得用硬编码替代”相冲突。

### 3.4 TDK 锁文件已过期

`docs/content-locks/aivideosugc-homepage-tdk-approved.json`（2026-10-17）仍记录旧的 description；而 2026-11-14 已按定价清单改成新文案。锁文件没有随批准变更同步，后续任何按锁文件做校验/回归的流程都会与线上不一致。

---

## 4. 时间线

| 日期 | 提交/动作 | 影响 |
|---|---|---|
| 2026-09-30 | `cd2ba3003` EU storefront SEO hardening | 加入 `aidreamcapesPublicSocialProfiles` 常量（当时站点还是 aidreamcapes.com） |
| 2026-10-04 | `099c54dd3` 迁移到 www.aivideosugc.com | 域名/品牌切换；社媒常量未同步 |
| 2026-10-17 | `0b9f4d522` + `docs/content-locks/aivideosugc-homepage-tdk-approved.json` | 首页 TDK 基线锁定（description = “Turn product URL …”，156 字符） |
| 2026-10-22 | `4a18b1608` internal-links 批次 | meta description 与 JSON-LD WebPage.description 成对修正（AI 大小写/空格） |
| 2026-10-24 | `69bd362dc` 导航批次 | 页脚 socialLinks 更新为 AIVideosUGC 9 个账号 |
| 2026-11-01 | ThemeSettings 全局页脚写入 | 仍为 Aidreamcapes 6 个账号，遗留未清理 |
| 2026-11-12 | `524f8b5a7` 定价展示清单（2026-11-14 13:49:40 落库） | 只改 `seo.description` / `seo.twitterDescription` → JSON-LD WebPage 开始分叉 |
| 2026-11-16 ~ 11-18 | 账号/积分代码发布、今日 3 次代码发布 | 未写首页 `LivePage`（`updatedAt` 仍为 11-14 13:49:40） |

---

## 5. 影响评估

1. **实体混淆**：`Organization.sameAs` 把 AIVideosUGC 实体与 Aidreamcapes 的社媒账号绑定；Google/Bing 实体图、GEO/AI 摘要可能把两个品牌混为一谈。
2. **结构化数据与可见页面不一致**：`WebPage.description` 与 meta description 不同，违反仓库内页 SEO 合同同一断言（首页目前不在断言范围）。
3. **旧定位/旧价格外泄**：旧 description 强调 “URL / image / prompt”，与当前信用点定价、无订阅定位不一致；AI 摘要与富结果可能引用旧文案。
4. **描述超长**：172 字符，超过 160 字符建议上限，SERP 可能截断。
5. **`WebPage.name` 大小写漂移**：存储图里是 `… | AivideosUGC`，`<title>` 是 `… | AIVideosUGC`；首页同样未被断言覆盖。
6. **后续发布容易再次分叉**：只要有人只改 `seo.description`，B 就会再次落后。

---

## 6. 修复方案（全部按字段、可回读，不使用任何快照）

### 6.1 数据层（需要站点 owner 明确批准；TDK 锁文件写明改动 TDK 需 owner 授权）

1. **同步 JSON-LD WebPage 节点**（修 B）
   - 目标：`LivePage` id `site_aidreamcapes_home`，路径 `seo.jsonLd.@graph` 中 `@type=WebPage` 的节点。
   - 操作：`description := seo.description`（172 字符版本，或先缩短，见 6.1.3）；`name := seo.title`（修正 `AivideosUGC` → `AIVideosUGC`）。
   - 机制：CAS（对当前 `contentJson` hash）+ readback hash 校验；只写这两个 JSON 路径，图形其余节点不动。
2. **更新站点级实体描述**（修 C）
   - 目标：`Site` id `site_aidreamcapes`，字段 `branding.description`。
   - 新文案需与 AIVideosUGC 当前定位一致（一次性信用点、无订阅、水印免费、AI actor）；与首页 description 同源最容易长期一致。
   - 机制：字段级 CAS + readback。
3. **TDK 锁文件更新**
   - `docs/content-locks/aivideosugc-homepage-tdk-approved.json` 更新为新基线（title/keywords/description），并在 lock 里记录批准时间与来源 manifest。
4. **可选：压到 ≤160 字符**
   - 当前 172 字符；给出 1–2 个候选后由你定稿，再一起进 manifest。

### 6.2 代码层（代码发布即可，不改内容）

1. **移除 `sameAs` 硬编码**
   - `src/lib/theme/json-ld.ts:476-483` 改为读取关系型数据：优先 `context.profile.identity.sameAs`，否则 `siteNavigation.footer.socialLinks`（与页脚完全同源）。
   - 若 Aidreamcapes 确属同一法律实体的第二品牌、需要互相声明，则改为显式配置字段（例如 `StorefrontProfile.identity.companySameAs`），只在需要的站点启用，而不是按 `site.id` 写死。
2. **让 WebPage 节点跟随当前 TDK**
   - 在 `normalizeAidreamcapesV2StoredGraph()` 中对 `WebPage` 节点强制 `name = title`、`description = description`（与 `SoftwareApplication` 同源），从机制上消灭分叉；或在每次内容写入时强制同步存储图。二选一，优先渲染层覆盖（幂等、无需补数据）。
3. **扩展 SEO 合同 smoke**
   - 把 `/` 纳入首页断言：`WebPage.name === <title>`、`WebPage.description === meta description`、description 长度 140–160、`Organization.sameAs` 必须与页脚社媒同品牌（至少：不得出现另一品牌域）。
   - 首页 title 的唯一性/品牌后缀规则可单独豁免，不影响内页断言。
4. **清理遗留页脚配置**
   - `ThemeSettings` 全局页脚 Aidreamcapes 链接：确认无公开页使用后清除，或改为与 `scripts/lib/aidreamcapes-social-links.mjs` 同源，避免再次被某个渲染路径读到。

---

## 7. 验证清单

1. 本地 dev + `npm run smoke:aidreamcapes-seo-contract`（含新增首页断言）通过。
2. `npm run guard:public-storefront-ssr` 通过；无 JS 抓取首页仍返回完整 HTML。
3. 生产 readback：`curl` 检查 meta/og/twitter 与 JSON-LD WebPage、Organization 三段一致；`psql` 读取对应字段 + `updatedAt`。
4. 回归：`/pricing`、`/ai-video-generation`、`/about-us` 的 sameAs 与页脚一致；sitemap/robots 不变。
5. 回滚预案：字段级反向 manifest（写回旧值 + CAS），不使用历史快照。

---

## 8. 复现命令（本次审计所用）

```bash
# 1. 线上 TDK（绕过缓存）
curl -s -H 'Cache-Control: no-cache' "https://www.aivideosugc.com/?v=$(date +%s)" -o /tmp/home.html
grep -o '<meta name="description" content="[^"]*"' /tmp/home.html
grep -o '"sameAs":\[[^]]*\]' /tmp/home.html

# 2. 生产库字段（在发布机上）
psql "$DATABASE_URL" -c "select \"contentJson\"->'seo'->>'description', to_char(\"updatedAt\",'YYYY-MM-DD HH24:MI:SS') from \"LivePage\" where \"siteId\"='site_aidreamcapes' and slug='/'"
psql "$DATABASE_URL" -c "select n->>'@type', n->>'description' from \"LivePage\", jsonb_array_elements(\"contentJson\"->'seo'->'jsonLd'->'@graph') n where \"siteId\"='site_aidreamcapes' and slug='/'"
psql "$DATABASE_URL" -c "select jsonb_pretty(branding) from \"Site\" where id='site_aidreamcapes'"
psql "$DATABASE_URL" -c "select jsonb_pretty(\"contentJson\"->'siteNavigation'->'footer'->'socialLinks') from \"LivePage\" where \"siteId\"='site_aidreamcapes' and slug='/'"
```

证据快照（2026-11-18 UTC 08:12）：

```
LivePage updatedAt = 2026-11-14 13:49:40
seo.description   = Turn one product image into … watermark-free export.        (172)
jsonLd WebPage.description = Turn product URL, image, or prompt into …           (156)
Site.branding.description  = AIVideosUGC is an online tool that turns …          (150)
```

---

## 9. 关于“是否改动过数据”的结论

- 2026-11-16 ~ 11-18 的账号/积分发布（`c35901148`、`fa97962ec`、`8e69c6537`）只改 `src/app/api/.../customer/*`、`src/lib/stores/*`、`src/components/storefront/customer-account-data-island.tsx`、`src/lib/types.ts`、`scripts/smoke-customer-account-center.mjs`、`src/lib/aidreamcapes-workspace/clone-media.ts` 等代码文件，没有任何 `LivePage` / `Site` / 导航 / JSON-LD 写入。
- 首页 `LivePage` 的 `updatedAt` 停在 **2026-11-14 13:49:40**，来自已批准的定价展示清单 `524f8b5a7`（只改 `seo.description` + `seo.twitterDescription`）。
- 2026-11-18 的三次发布（`89988184a` 11:36、`c1502b512` 12:15、`d2a1f594b` 14:27）由其他会话完成；三个发布目录的 `.origin.html` / `.candidate.html` 快照中 meta description 与 `sameAs` 均与当前线上一致，未产生新写入。
- 因此：**今天看到的“三段描述”与“sameAs 指向 Aidreamcapes”都是 2026-09-30 ~ 2026-11-14 之间遗留的数据/代码状态，不是本次发布产生的。**

---

## 10. 后续状态（2026-11-18 更新）

- 站点所有者决定**暂不替换首页 TDK**。本文档仅作为溯源审计记录；生产首页 title/description/keywords 保持当前值，相关写入清单与守卫未应用、未发布。
- 本轮实际执行的是页脚社媒外链统一：`ThemeSettings` 中 `globalSections.footer.settings` 与 `saasSettingsCurrent` 两处遗留的 `@aidreamcapes` 外链，已按页脚实际展示的 9 个 AIVideosUGC 账号归一；`threads` 没有对应官方账号，已清空。
- 代码侧 `Organization.sameAs` 不再使用硬编码名单，改为读取页脚同一份 `siteNavigation.footer.socialLinks`；公开页脚与结构化数据从此只有一个数据来源。
