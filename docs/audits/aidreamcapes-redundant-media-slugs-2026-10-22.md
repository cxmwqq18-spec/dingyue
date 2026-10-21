# AIVideosUGC 冗余媒体详情 URL 审计（2026-10-22）

> 只读审计，未写内容库，未改生产配置。
> 站点：`site_aidreamcapes`（www.aivideosugc.com）
> 数据真源：当前 `LivePage.contentJson`（生产关系库，267 行）
> 回读来源：生产 `aidreamcapes.service`（`127.0.0.1:3013`）
> 机器报告：`docs/audits/aidreamcapes-redundant-media-slugs-2026-10-22.json`

## 1. 问题

媒体详情 URL 的 `publicSlug` 被拼成了「产品名 + 目录页路径」：

```
/ai-video-generation/bedroom-try-on-knitwear-ai-video-generation-ugc-ad-video
                                                  └──── 所属目录页路径 ────┘
└──────────────── 产品 base slug ─────────────────┘
```

即 slug 规则 = `slugify(card.label) + "-" + slugify(owner page path)`。路径尾部与父目录重复，且把父目录页整段路径复制进了 slug。

对照：`/ai-video-generation/bedroom-try-on-knitwear`（用户期望形式）当前 **404**；`/ai-video-generation/cinematic-watch-detail` 同样 **404**。

## 2. 总量

| 项目 | 数量 |
|---|---:|
| `LivePage` 行（site_aidreamcapes） | 267 |
| 唯一详情 slug | 982 |
| **冗余 slug（尾部带目录路径）** | **678** |
| 干净 slug | 304 |
| 冗余 slug 背后的真实产品数 | 80 |
| 单个产品最多副本数 | 19 |
| 冗余 URL 线上返回 200 | 678 |
| 其中被公开页链出 | 39 |
| 其中被详情页链出 | 60 |
| 线上可点合计（去重） | 90 |
| 线上无入口但直接可访问 | 588 |
| sitemap 中的冗余 URL | 0 |

678 个冗余 URL 只对应 103 个真实产品标题，其中 85 个标题各自散落在多个 URL 上（例如「Bedroom Try-On: Knitwear」有 17 个 URL，「Street Style: Linen Set」有 19 个）。

## 3. 冗余 URL 从哪里来

两个 JSON 家族：

| 家族 | 数量 | 说明 |
|---|---:|---|
| `data.workspaceCases[*]` | 639 | 目录页（image/video generation 各页）里的「workspace 用例」卡，每张卡复制一份整页路径 |
| `data.visual.picker.cards[*]` | 39 | 目录页选择器卡 |

owner 页面分布：

| owner 页面 | 冗余 URL 数 |
|---|---:|
| `/ai-image-generation/packaging-mockup` | 37 |
| `/ai-image-generation/packshot-multi-angle` | 37 |
| `/ai-image-generation/professional-headshot` | 37 |
| `/ai-image-generation/ugc-still-ad` | 37 |
| `/ai-image-generation/virtual-try-on` | 37 |
| `/ai-video-generation/black-friday-countdown` | 37 |
| `/ai-video-generation/cinematic-video` | 37 |
| `/ai-video-generation/fashion-try-on-reel` | 37 |
| `/ai-video-generation/food-video` | 37 |
| `/ai-video-generation/how-to-video` | 37 |
| `/ai-video-generation/spark-ads-style-video` | 37 |
| `/ai-image-generation/sale-campaign-key-visual` | 36 |
| `/ai-image-generation/story-ad-vertical` | 36 |
| `/ai-video-generation/promo-video` | 36 |
| `/ai-video-generation/video-ads` | 35 |
| `/ai-video-generation/beauty-routine` | 35 |
| `/ai-video-generation/home-organization` | 35 |
| `/ai-image-generation/jewelry-positioning` | 34 |
| `/ai-image-generation/colorway-variations` | 20 |
| `/ai-video-generation` | 4 |

全部 678 个冗余 URL 归属 **video** 类型（父目录 `/ai-video-generation`），但其中 639 个挂在 **image generation 目录页** 下——父目录与实际内容族不匹配，是同一批卡片被复制到两个族目录页的结果。

## 4. 线上可达性

- 公开页链出的 39 个只出现在两个页面：`/ai-video-generation`（4 个）与 `/ai-video-generation/video-ads`（35 个）。
- 其余 60 个只在详情页「相关推荐」里被链出，涉及 89 个详情页。
- 从公开页出发做深度 2 的可达性遍历，只新增 0 个，说明这些 URL 基本是孤岛，仅靠详情页互链存在。
- 全部 678 个冗余 URL 都返回 200、canonical 指向自身、robots 为 `noindex, follow`；sitemap 中 0 条。

## 5. 命名不一致

同一批「同一素材」在不同页面上有三种 slug 写法：

1. `bedroom-try-on-knitwear` — 期望形式（当前 404，仅本地规划存在）
2. `bedroom-try-on-knitwear-templates` — `/templates` 页上的模板卡（35 个产品有此形态）
3. `bedroom-try-on-knitwear-ai-video-generation-ugc-ad-video` — 目录页副本（当前生产形态）

35 个产品在 `/templates` 的模板卡上还有一个 `-templates` 形态的 slug（直接访问 200，但 `/templates` 页面本身不链出）；其余 45 个产品连一个干净 slug 都没有，只有带目录路径的冗余形态。

## 6. 与既有设计的关系

仓库里已有针对同一问题的一半方案，但**未落到生产**：

- `scripts/manifests/aidreamcapes-seo-media-alias-local-2026-10-21.json`：5 条 alias 操作，目标 slug 就是 `bathroom-review-moisturizer` 这种短名，`publicAliases` 保留旧 slug。**target = local，未执行。**
- `scripts/smoke-aidreamcapes-seo-paths.mjs`：已断言旧 URL 308 → 新 URL、新 URL canonical 正确、sitemap 不含旧 URL。**未接入发布门禁。**
- 运行时已支持 alias：`media-alias.server.ts` 查 `publicAliases`，`renderAidreamcapesMediaDetailPage` 在 `detail.slug !== slug` 时发 308。
- 生产实测：`publicAliases` = 0，`placement` = 0，说明 alias 与产品级 placement 都还没上线。
- 短 base slug 冲突检查：80 个 base slug 全部 **未被任何卡占用**，也 **不与现有页面路径冲突**，可安全作为规范 slug。

## 7. 建议处理顺序（尚未执行）

1. 先落 alias 机制：按 `owner page + card` 字段级写 `publicAliases`，把 678 个旧 slug 指向对应 base slug 短名，旧 URL 308 到新 URL。写入必须 compare-and-set，在线编辑优先。
2. 再改目录页卡的 `publicSlug` 为短名 base slug（80 个规范 slug）。
3. 同步 `href` 字段与页面内链，去掉已迁走的旧地址。
4. 把 `smoke-aidreamcapes-seo-paths.mjs` 接入发布门禁，并扩展为覆盖全部 678 个旧 URL。
5. 规范化后再评估 `placement` 产品级标签，避免同一产品继续被复制成 19 张卡。

## 8. 本次审计未做的事

- 未写任何内容库行，未改生产配置，未触碰 MyDreamShoots / Aidreamshoots。
- 未部署任何代码，未变更 Nginx / systemd。
- 全部结论来自生产关系库读取 + 生产服务 HTTP 回读。

## 9. 附：80 个产品分组

| 产品 base slug | 产品名 | 副本数 | 公开页可点 | 详情页可点 | 副本所在目录页数 |
|---|---|---:|---:|---:|---:|
| `bathroom-review-moisturizer` | Bathroom Review: Moisturizer | 19 | 1 | 0 | 19 |
| `bedroom-try-on-knitwear` | Bedroom Try-on: Knitwear | 19 | 1 | 10 | 19 |
| `dog-harness-park-setup` | Dog Harness Park Setup | 19 | 1 | 0 | 19 |
| `mirror-selfie-denim` | Mirror Selfie: Denim | 19 | 1 | 0 | 19 |
| `pendant-creator-try-on` | Pendant Creator Try-On | 19 | 1 | 0 | 19 |
| `pet-brush-living-room-demo` | Pet Brush Living Room Demo | 19 | 1 | 0 | 19 |
| `post-workout-bottle-check-in` | Post-Workout Bottle Check-In | 19 | 1 | 0 | 19 |
| `realtor-walkthrough-home` | Realtor Walkthrough: Home | 19 | 1 | 0 | 19 |
| `resistance-band-home-demo` | Resistance Band Home Demo | 19 | 1 | 0 | 19 |
| `routine-demo-cream` | Routine Demo: Cream | 19 | 1 | 1 | 19 |
| `running-shoe-creator-showcase` | Running Shoe Creator Showcase | 19 | 1 | 0 | 19 |
| `sage-overshirt-unboxing` | Sage Overshirt Unboxing | 19 | 1 | 0 | 19 |
| `stadium-hydration-fan-moment` | Stadium Hydration Fan Moment | 19 | 1 | 0 | 19 |
| `street-interview-fitness-gear` | Street Interview: Fitness Gear | 19 | 1 | 0 | 19 |
| `street-interview-snack-bite` | Street Interview: Snack Bite | 19 | 1 | 0 | 19 |
| `street-style-linen-set` | Street Style: Linen Set | 19 | 1 | 10 | 19 |
| `trail-shoe-lace-up-demo` | Trail Shoe Lace-Up Demo | 19 | 1 | 0 | 19 |
| `tutor-demo-study-tool` | Tutor Demo: Study Tool | 19 | 1 | 0 | 19 |
| `wooden-toy-parent-play` | Wooden Toy Parent Play | 19 | 1 | 0 | 19 |
| `lifestyle-app-recommendation` | Lifestyle App Recommendation | 18 | 2 | 9 | 18 |
| `finance-opening-phone-demo` | Finance Opening: Phone Demo | 14 | 0 | 0 | 14 |
| `mint-face-mist-opening` | Mint Face Mist Opening | 14 | 0 | 0 | 14 |
| `low-profile-keyboard-review` | Low Profile Keyboard Review | 13 | 1 | 0 | 13 |
| `streamer-reaction-app` | Streamer Reaction: App | 13 | 2 | 7 | 13 |
| `face-to-camera-skin-lesson` | Face to Camera: Skin Lesson | 11 | 0 | 0 | 11 |
| `first-sip-citrus-drink` | First sip: Citrus drink | 10 | 0 | 0 | 10 |
| `full-spin-linen-shirt` | Full Spin: Linen Shirt | 10 | 0 | 0 | 10 |
| `cinematic-watch-detail` | Cinematic Watch Detail | 9 | 1 | 3 | 9 |
| `get-ready-unboxing-knitwear` | Get-ready unboxing: Knitwear | 9 | 1 | 0 | 9 |
| `kitchen-appliance-evening-demo` | Kitchen Appliance Evening Demo | 9 | 0 | 0 | 9 |
| `opening-home-app-walkthrough` | Opening: Home app walkthrough | 9 | 0 | 0 | 9 |
| `close-unboxing-makeup-tools` | Close Unboxing: Makeup Tools | 8 | 0 | 5 | 8 |
| `silver-signet-close-up` | Silver Signet Close-up | 8 | 0 | 0 | 8 |
| `berry-bowl-first-bite-clip` | Berry Bowl First Bite Clip | 7 | 0 | 0 | 7 |
| `kettlebell-powder-reveal-clip` | Kettlebell Powder Reveal Clip | 7 | 0 | 0 | 7 |
| `pump-moisturizer-routine-clip` | Pump Moisturizer Routine Clip | 7 | 0 | 0 | 7 |
| `berry-bowl-first-bite` | Berry Bowl First Bite | 6 | 0 | 0 | 6 |
| `close-up-silver-signet-ring` | Close-up: Silver signet ring | 6 | 0 | 0 | 6 |
| `close-up-unboxing-makeup-tools` | Close-up unboxing: Makeup tools | 6 | 0 | 2 | 6 |
| `pump-moisturizer-routine` | Pump Moisturizer Routine | 6 | 0 | 0 | 6 |
| `berry-bowl-first-bite-reel` | Berry Bowl First Bite Reel | 5 | 1 | 0 | 5 |
| `home-app-opening-walkthrough` | Home App Opening Walkthrough | 5 | 0 | 0 | 5 |
| `kettlebell-powder-reveal` | Kettlebell Powder Reveal | 5 | 0 | 0 | 5 |
| `kettlebell-powder-reveal-reel` | Kettlebell Powder Reveal Reel | 5 | 1 | 0 | 5 |
| `kitchen-appliance-evening-demo-reel` | Kitchen Appliance Evening Demo Reel | 5 | 1 | 0 | 5 |
| `pump-moisturizer-routine-reel` | Pump Moisturizer Routine Reel | 5 | 1 | 0 | 5 |
| `close-up-sip-citrus-drink` | Close-up Sip: Citrus Drink | 4 | 0 | 0 | 4 |
| `evening-kitchen-appliance-demo` | Evening Kitchen Appliance Demo | 4 | 0 | 0 | 4 |
| `first-look-court-gear` | First Look: Court Gear | 4 | 0 | 0 | 4 |
| `first-person-look-court-gear` | First-Person Look: Court Gear | 4 | 0 | 0 | 4 |
| `first-person-view-court-gear` | First-person view: Court gear | 4 | 0 | 0 | 4 |
| `getting-ready-unboxing-knitwear` | Getting-Ready Unboxing: Knitwear | 4 | 0 | 0 | 4 |
| `morning-unboxing-knitwear` | Morning Unboxing: Knitwear | 4 | 0 | 0 | 4 |
| `spin-view-linen-shirt` | Spin View: Linen Shirt | 4 | 0 | 0 | 4 |
| `warm-light-watch-detail` | Warm Light Watch Detail | 4 | 0 | 3 | 4 |
| `first-person-find-court-gear` | First-person find: court gear | 3 | 0 | 0 | 3 |
| `slim-keyboard-desk-review` | Slim Keyboard Desk Review | 3 | 0 | 0 | 3 |
| `straight-to-camera-skin-lesson` | Straight to Camera: Skin Lesson | 3 | 0 | 0 | 3 |
| `talking-head-skin-lesson` | Talking Head: Skin Lesson | 3 | 1 | 0 | 3 |
| `360-showcase-linen-shirt` | 360 Showcase: Linen Shirt | 2 | 1 | 0 | 2 |
| `film-style-watch-detail` | Film-Style Watch Detail | 2 | 0 | 2 | 2 |
| `finance-hook-phone-demo` | Finance Hook: Phone Demo | 2 | 1 | 0 | 2 |
| `first-sip-reaction-citrus` | First-Sip Reaction: Citrus | 2 | 0 | 0 | 2 |
| `full-turn-linen-shirt` | Full turn: Linen shirt | 2 | 0 | 0 | 2 |
| `hook-home-app-walkthrough` | Hook: Home App Walkthrough | 2 | 1 | 0 | 2 |
| `live-stream-reaction-app` | Live-Stream Reaction: App | 2 | 0 | 2 | 2 |
| `live-style-reaction-app` | Live-style Reaction: App | 2 | 0 | 1 | 2 |
| `mint-face-mist-hook` | Mint Face Mist Hook | 2 | 1 | 0 | 2 |
| `money-tip-phone-demo` | Money tip: Phone demo | 2 | 0 | 0 | 2 |
| `movie-style-watch-close-up` | Movie-style Watch Close-up | 2 | 0 | 1 | 2 |
| `opening-line-home-app-tour` | Opening Line: Home App Tour | 2 | 0 | 0 | 2 |
| `opening-reaction-mint-face-mist` | Opening reaction: Mint face mist | 2 | 0 | 0 | 2 |
| `quiet-close-up-unboxing-makeup-tools` | Quiet Close-Up Unboxing: Makeup Tools | 2 | 0 | 2 | 2 |
| `sensory-hook-citrus-sip` | Sensory Hook: Citrus Sip | 2 | 1 | 0 | 2 |
| `silver-ring-extreme-close-up` | Silver Ring Extreme Close-Up | 2 | 0 | 0 | 2 |
| `silver-signet-macro-reveal` | Silver Signet Macro Reveal | 2 | 1 | 0 | 2 |
| `thin-keyboard-review` | Thin Keyboard Review | 2 | 0 | 0 | 2 |
| `daily-life-app-recommendation` | Daily-Life App Recommendation | 1 | 0 | 1 | 1 |
| `tinted-balm-vanity-reel` | Tinted Balm Vanity Reel | 1 | 1 | 1 | 1 |
| `trousers-fold-demo` | Trousers Fold Demo | 1 | 1 | 0 | 1 |

每个分组下的全部 URL 见机器报告 `groups[].urls` 与 `urls[]`。
