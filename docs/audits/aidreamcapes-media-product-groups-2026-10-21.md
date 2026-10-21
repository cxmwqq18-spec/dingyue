# AIVideosUGC 媒体产品分组审计（2026-10-21）

> 只读审计，不写内容库。  
> 2026-10-21 本地试点已应用 19 个产品组；本报告由只读审计在当前关系库上重新生成，因此包含试点结果。应用证据见 `scripts/manifests/aidreamcapes-media-product-placement-local-2026-10-21-apply-report.json`。  
> 站点：`site_aidreamcapes`  
> 数据源：当前 `LivePage.contentJson`  
> 机器报告：`docs/audits/aidreamcapes-media-product-groups-2026-10-21.json`  
> 复现命令：`npm run audit:aidreamcapes-media-products`

## 1. 口径

用户已确认：**一张图片/视频素材 = 一个产品**。

- `publicSlug` 是页面卡的地址，不是产品身份。
- 同一素材在多个页面出现时，只算一个产品组。
- 产品身份由 `kind + video.src`（无视频时用 `image.src` / poster）派生。
- 标签应写在产品组的一张规范卡上；同组其他副本通过运行时聚合继承，不需要重复写 20 份。

## 2. 总量

| 项目 | 结果 |
|---|---:|
| `LivePage` 页面 | 269 |
| 提取的页面卡 | 1,005 |
| 唯一 `publicSlug` | 987 |
| **产品组** | **285** |
| 多卡产品组中的卡片 | 775 |
| 同一素材被复制成多个 slug 的组 | **37** |
| 这些组涉及的卡片 | **739** |
| 单产品最多卡片数 | 21 |
| label 变体冲突组 | 18 |
| 模板产品组 | 18（每组 2 张同 slug 卡） |
| 当前已有 placement 的产品组 | **25**（6 条本地外部编辑 + 19 条试点写入） |

结论：987 不是 987 个产品，而是 285 个素材产品被页面复制成了 1,005 张卡。按卡片打标会让同一产品在目录页重复出现最多 21 次。

本地试点后，25 个产品组有 placement（6 条外部 Shoes 编辑 + 19 条试点），其余 944 张媒体卡仍未投放；没有做全量回填。

## 3. 37 个重复产品组

每个重复组的卡片数、slug 数、owner 页数和规范卡见 JSON 的 `conflicts.duplicatePublicSlugs`。

典型结构：

| 产品组 | 卡片数 | 页面数 | 现有 chip | 规范卡 |
|---|---:|---:|---|---|
| Streamer Reaction: App | 21 | 21 | `apps` | `streamer-reaction-app-ai-video-generation` |
| Bedroom Try-On: Knitwear | 20 | 20 | `apparel` | `bedroom-try-on-knitwear` |
| Quiet Unboxing: Makeup Tools | 19 | 19 | `accessories` | `quiet-unboxing-makeup-tools` |
| Running Shoe Creator Showcase | 20 | 20 | `footwear` | `running-shoe-creator-showcase-ai-video-generation-ugc-ad-video` |

这些组基本对应旧的 19 个模板墙 chip；chip 可以作为**建议标签**，但不能直接当目录 slug。

## 4. label 冲突

18 个产品组存在同一素材多种 label，例如：

- `Quiet Unboxing: Makeup Tools` 有 8 种写法（`Close Unboxing`、`Close-Up Unboxing`、`ASMR Unboxing` 等）；
- `360 Showcase: Linen Shirt` 有 6 种写法（`Full Spin`、`Spin View`、`Full turn` 等）；
- `First-Person Discovery: Court Gear` 有 10 种写法。

这说明页面副本不仅 slug 不同，文案也会漂移。产品级只保留一个规范 label，其余作为历史副本；目录页只显示规范卡。

## 5. 已应用试点批次（本地）

18 个重复组（358 张卡）+ 1 个单卡产品 `canvas-tote-product-detail`，共 **19 个产品组、359 张卡、19 个字段级写入**。规范卡均在 `/ai-video-generation/video-ads` 的 picker 上，截图页在首页 picker；同组其他副本不写 placement。

| 目录 | 规范卡 | 卡片数 | 备注 |
|---|---|---|---:|---|
| `/industries/beauty-skincare` | `bathroom-review-moisturizer-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/beauty-skincare` | `routine-demo-cream-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/beauty-skincare` | `quiet-unboxing-makeup-tools` | 19 | 内容是化妆工具；按建议归 Beauty，chip 是 accessories |
| `/industries/electronics` | `kitchen-appliance-evening-demo-reel-ai-video-generation-ugc-ad-video` | 20 | 按建议归 Electronics；chip 是 tech-electronics |
| `/industries/electronics` | `low-profile-keyboard-review-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/fashion-clothing` | `bedroom-try-on-knitwear` | 20 | 清晰 |
| `/industries/fashion-clothing` | `get-ready-unboxing-knitwear-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/fashion-clothing` | `mirror-selfie-denim-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/fashion-clothing` | `street-style-linen-set` | 20 | 清晰 |
| `/industries/food-drinks` | `berry-bowl-first-bite-reel-ai-video-generation-ugc-ad-video` | 20 | label 是食物；按建议归 Food，chip 是 health-fitness |
| `/industries/food-drinks` | `sensory-hook-citrus-sip-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/food-drinks` | `street-interview-snack-bite-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/health-wellness` | `resistance-band-home-demo-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/jewelry-accessories` | `canvas-tote-product-detail` | 1 | 单卡；包袋归配件 |
| `/industries/jewelry-accessories` | `cinematic-watch-detail` | 19 | 手表，可归配饰 |
| `/industries/jewelry-accessories` | `pendant-creator-try-on-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/jewelry-accessories` | `silver-signet-macro-reveal-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/shoes` | `running-shoe-creator-showcase-ai-video-generation-ugc-ad-video` | 20 | 清晰 |
| `/industries/shoes` | `trail-shoe-lace-up-demo-ai-video-generation-ugc-ad-video` | 20 | 清晰 |

### 未纳入建议的重复组

以下 chip 没有对应行业目录，或语义不明确，暂不自动映射：

`apps`、`e-commerce`、`education`、`explainer`、`financial-services`、`ugc`、`viral`、`pet`、`kids-toy`、`sports-gym`。

这些需要先决定是否新增目录，或只映射到 platform/occasion；不要强塞进现有 8 个 industry。

## 6. 既有 6 条 placement 与试点读回

审计期间本地库出现了 6 条 `/industries/shoes` 编辑（不是本任务写入）：

- `trail-shoe-step-ad`
- `running-shoe-color-lineup`
- `charcoal-hiking-shoe-city-curb`
- `leather-sandal-strap`
- `performance-shoe-step-ad`
- `trail-shoe-wet-path-reel`

按“线上编辑优先”原则保留，没有覆盖。加上 19 条试点后，`/industries/shoes` 共 8 张产品卡，全部唯一。

本地试点读回：

| 检查 | 结果 |
|---|---|
| 7 个有投放的目录页 | 每页卡片数 = 唯一详情 href 数 = 唯一素材数 |
| 19 个规范详情页 | 全部显示目标目录 chip |
| 18 个别名详情页 | 全部显示与规范卡相同目录 |
| `SiteContentRevision` | 8 → 10 |
| MyDreamShoots 内容指纹 | 不变 |
| 重复产品 | 0 |

## 7. 下一步

1. 内容团队确认 §5 的 3 个歧义判断；若改判，按产品组生成字段级 inverse manifest。
2. 生产应用前重新 plan：本地 manifest 的页面哈希不能复用到生产。
3. 生产 apply 需单独批准；写后按 §6 同一套目录页 / 规范详情页 / 别名详情页 / revision 读回。
4. 第三批按 30–50 个产品组分批回填，不做 285 组一次性覆盖。
