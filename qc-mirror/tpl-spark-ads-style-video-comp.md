# tpl-spark-ads-style-video competitor decomposition

Main competitor: Tagshop AI `/templates` (`bench/live-20261010/ts-templates.json/.jpg`). Supplement: Creatify Spark Ads page (`bench/raw2/comp2-56a68c5cde25.html`).

## Competitor blocks (top to bottom)

| Type | Competitor text | Chars |
|---|---|---:|
| Hero | See It. Recreate It. Launch It. | 31 |
| Hero lead | Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes. | 157 |
| Supplement hero | TikTok Spark Ads | 16 |
| Supplement benefits | A/B testing; Unique style; Product-specific video ad; Social media ads | 68 |
| Supplement three steps | Get started in 3 steps | 22 |
| Gallery cards | Talking Head Product Recommendation; GRWM Fashion Get Ready Reel; Sensory Food Beverage TikTok Hook | 103 |
| FAQ | Frequently Asked Questions | 26 |
| CTA | Deliver results with free AI-generated video ads! | 49 |

## 区块对照

| 竞品区块（原文标题） | 我们对应区块 | 处理 |
|---|---|---|
| See It. Recreate It. Launch It. / TikTok Spark Ads | PageHero + maker | 采用模板画廊骨架，换成 TikTok Spark Ads 真实边界 |
| Template gallery + category filters | visual.picker | 使用 Food & Drink/Fashion/Technology/Home Decor 分类，8 张图对应 creator 场景 |
| Why should you create spark ads using AI? | benefits | 保留真实卖家收益，说明授权仍在 TikTok |
| Get started in 3 steps | visual.steps | 保留三步，第二步只选创作者样式 |
| Frequently Asked Questions | faq | 使用竞品式问题，明确不自动授权、不承诺审核或效果 |
| CTA | maker/CTA | 保留 |
| 长篇操作指南、配方、下载后流程、示例墙 | intro/input_guide/results/scene_recipes/after_download/fit/examples、visual uses/input/outputs/after | 删除；依赖主控组件守卫空字段 |

## 场景对照

| 竞品模板场景名 | 我们的卡（图 ref） | 图对不对得上 |
|---|---|---|
| Talking Head Product Recommendation | n:guide:q14-spark-picker-snack | 对得上：创作者手持零食袋讲解 |
| GRWM Fashion Get Ready Reel | n:guide:q14-spark-picker-hairclaw | 对得上：浴室镜前发夹造型 |
| Electronics Desk Review UGC | n:guide:q14-spark-picker-headphones | 对得上：耳机从托特包拿出 |
| Tech Product Demo UGC | n:guide:q14-spark-picker-phonecase-r2 | 对得上：手机壳安装动作 |
| Sensory Food Beverage TikTok Hook | n:guide:q14-spark-picker-street-interview-r2 | 对得上：蛋白棒试吃反应 |
| Home Cleaning Product UGC | n:gen2:tpl-spark-ads-style-video-c4 | 对得上：宠物毛发清理动作 |
| Electronics Desk Review UGC | n:guide:f5-r10-spark-card-6-keyboard-brush | 对得上：桌面键盘清理 |
| Fashion Lifestyle Reel | n:guide:q14-spark-picker-backpack | 对得上：通勤背包日常 |

无待换图、无待补场景。图片不进入 git。

## 不抄整句检查

`overlap.py tpl-spark-ads-style-video.json bench/raw/comp-b99b6d032753.html bench/raw2/comp2-56a68c5cde25.html`: PASS（最长相同 4 词；7 词重合 0 条）。

## 舍弃的区块

- tpl-spark-ads-style-video｜intro、input_guide、results、scene_recipes、after_download、fit、examples｜模板/工具竞品没有对应的长篇操作、配方或示例墙，按 strict 清空。
- tpl-spark-ads-style-video｜visual.uses、visual.input、visual.outputs、visual.after｜竞品没有用途/输入对比/规格/下载后区块，依赖主控组件守卫不渲染。
