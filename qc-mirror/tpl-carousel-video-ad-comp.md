# tpl-carousel-video-ad competitor decomposition

Main competitor: Tagshop AI `/templates` (`bench/live-20261010/ts-templates.json/.jpg`). Gallery structure is category filters plus concise category + technique + format names.

## Competitor blocks (top to bottom)

| Type | Competitor text | Chars |
|---|---|---:|
| Hero | See It. Recreate It. Launch It. | 31 |
| Hero lead | Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes. | 157 |
| Gallery | All, Skincare, Beauty, Fashion, Food & Drink, Technology, Fitness, Home Decor, Explore More | 90 |
| Gallery cards | Fashion Lifestyle Reel; Tech Product Demo UGC; Skincare Routine TikTok UGC; Pet Product Living Room UGC | 110 |
| FAQ | Frequently Asked Questions | 26 |
| CTA | Create Your First Video | 23 |

## 区块对照

| 竞品区块（原文标题） | 我们对应区块 | 处理 |
|---|---|---|
| See It. Recreate It. Launch It. | PageHero + maker | 照写结构，换成产品故事视频事实 |
| Template gallery + category filters | visual.picker | 使用 Technology/Fashion/Beauty/Explore More 分类，8 张图对应各自故事场景 |
| Brands are Switching to AI Video Ads | benefits | 保留真实卖家收益，不伪造评价 |
| Frequently Asked Questions | faq | 采用竞品式模板问题，答案写单文件、15 秒/60 credits、无水印事实 |
| Create Your First Video | maker/CTA | 保留 |
| Three steps (甲方要求) | visual.steps | 保留，第二步只选故事样式 |
| 操作指南、场景配方、下载后处理、规格/示例墙 | intro/input_guide/results/scene_recipes/after_download/fit/examples、visual uses/input/outputs/after | 删除；依赖主控组件守卫空字段 |

## 场景对照

| 竞品模板场景名 | 我们的卡（图 ref） | 图对不对得上 |
|---|---|---|
| Fashion Product Lifestyle Reel | n:guide:f5-r10-carousel-card-0-folding-umbrella | 对得上：折叠伞从收纳到展开 |
| Tech Product Demo UGC | n:guide:q13-carousel-picker-1 | 对得上：理线器打开/使用 |
| Fashion Clothing TikTok UGC Hook | n:guide:q13-carousel-picker-2 | 对得上：夹克镜前穿着检查 |
| Skincare Routine TikTok UGC | n:guide:q13-carousel-picker-3 | 对得上：精华晨间使用 |
| Fashion Lifestyle Reel | n:guide:q13-carousel-picker-4 | 对得上：通勤背包故事 |
| Electronics Desk Review UGC | n:guide:q13-carousel-picker-5 | 对得上：耳机三项功能 |
| Pet Product Living Room UGC | n:guide:q13-carousel-picker-6 | 对得上：狗牵引绳遛狗 |
| Sensory Food Beverage TikTok Hook | n:guide:f5-r10-carousel-card-7-water-bottle | 对得上：保温水瓶使用 |

无待换图、无待补场景。图片不进入 git。

## 不抄整句检查

`overlap.py tpl-carousel-video-ad.json bench/raw/comp-b99b6d032753.html`: PASS（最长相同 3 词；7 词重合 0 条）。

## 舍弃的区块

- tpl-carousel-video-ad｜intro、input_guide、results、scene_recipes、after_download、fit、examples｜模板竞品没有对应长篇操作、配方或示例墙，按 strict 清空。
- tpl-carousel-video-ad｜visual.uses、visual.input、visual.outputs、visual.after｜模板竞品没有用途/输入对比/规格/下载后区块，依赖主控组件守卫不渲染。
