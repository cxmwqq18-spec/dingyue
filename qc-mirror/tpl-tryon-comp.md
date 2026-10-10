# tpl-tryon competitor decomposition

Main competitor: Tagshop AI `/templates` (`bench/live-20261010/ts-templates.json/.jpg`); the page uses a template gallery with category filters and template names built as category + technique + format.

## Competitor blocks (top to bottom)

| Type | Competitor text | Chars |
|---|---|---:|
| Hero | See It. Recreate It. Launch It. | 31 |
| Hero lead | Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes. | 157 |
| Gallery | Category filters: All, Skincare, Beauty, Fashion, Food & Drink, Technology, Fitness, Home Decor, Explore More | 105 |
| Gallery cards | Fashion Try-On Cinematic Reel; Fashion Clothing Mirror Selfie UGC; Fashion Whip-Pan Multi-Angle Ad; GRWM Fashion Get Ready Reel | 130 |
| FAQ | Frequently Asked Questions | 26 |
| CTA | Create Your First Video | 23 |

## 区块对照

| 竞品区块（原文标题） | 我们对应区块 | 处理 |
|---|---|---|
| See It. Recreate It. Launch It. | PageHero + maker | 照写结构，换成虚拟试穿事实 |
| Template gallery + category filters | visual.picker | 照模板命名公式；本页只有 Fashion 图，保留 Fashion 筛选 |
| Brands are Switching to AI Video Ads | benefits | 保留卖家结果文案，不伪造竞品评价 |
| Frequently Asked Questions | faq | 采用竞品式模板问题，答案写真实 24 credits/无水印情况 |
| Create Your First Video | maker/CTA | 保留 |
| Three steps (甲方要求) | visual.steps | 保留三步，第二步只写选样式 |
| 操作指南、场景配方、下载后处理、格式/示例墙 | intro/input_guide/results/scene_recipes/after_download/fit/examples、visual uses/input/outputs/after | 删除；依赖主控组件守卫空字段 |

## 场景对照

| 竞品模板场景名 | 我们的卡（图 ref） | 图对不对得上 |
|---|---|---|
| Fashion Clothing Mirror Selfie UGC | n:guide:f7-r10-tryon-mirror-selfie | 对得上：镜前穿着上身 |
| Fashion Try-On Cinematic Reel | n:guide:f7-r10-tryon-mirror-denim | 对得上：牛仔外套试穿 |
| Fashion Whip-Pan Multi-Angle Ad | n:guide:f7-r10-tryon-whip-pan | 对得上：多角度服装展示 |
| Fashion Lifestyle Reel | n:guide:f7-r10-tryon-walk-ivory-puffer | 对得上：穿着走动 |
| Fashion Street UGC | n:guide:f7-r10-tryon-walk-blue-jacket | 对得上：街头走动 |
| Talking Head Product Recommendation | n:guide:f7-r10-look-review-navy-suit | 对得上：镜头前讲解服装 |
| GRWM Fashion Get Ready Reel | n:guide:f7-r10-tryon-grwm-field-jacket | 对得上：GRWM 叠穿 |
| Fashion Clothing TikTok UGC Hook | n:guide:q9-look-pleated-skirt-walk | 对得上：裙装走动 |

无待换图、无待补场景。图片不进入 git。

## 不抄整句检查

`overlap.py tpl-tryon.json bench/raw/comp-b99b6d032753.html`: PASS（最长相同 3 词；7 词重合 0 条）。

## 舍弃的区块

- tpl-tryon｜intro、input_guide、results、scene_recipes、after_download、fit、examples｜模板竞品没有对应的长篇操作、配方或示例墙，按 strict 清空。
- tpl-tryon｜visual.uses、visual.input、visual.outputs、visual.after｜模板竞品没有用途/输入对比/规格/下载后区块，依赖主控组件守卫不渲染。
