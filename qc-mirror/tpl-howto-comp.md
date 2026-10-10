# tpl-howto competitor decomposition

Main competitor: Tagshop AI `/templates` (`bench/live-20261010/ts-templates.json/.jpg`). The reference gallery is organized by category and uses concise template names.

## Competitor blocks (top to bottom)

| Type | Competitor text | Chars |
|---|---|---:|
| Hero | See It. Recreate It. Launch It. | 31 |
| Hero lead | Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes. | 157 |
| Gallery | All, Skincare, Beauty, Fashion, Food & Drink, Technology, Fitness, Home Decor, Explore More | 90 |
| Gallery cards | Fitness Coach UGC Hook; Beauty Education Talking Head UGC; Home Cleaning Product UGC; Food Beverage Product Demo UGC | 119 |
| FAQ | Frequently Asked Questions | 26 |
| CTA | Create Your First Video | 23 |

## 区块对照

| 竞品区块（原文标题） | 我们对应区块 | 处理 |
|---|---|---|
| See It. Recreate It. Launch It. | PageHero + maker | 照写结构，换成自有工具演示 |
| Template gallery + category filters | visual.picker | 使用 Fitness/Fashion/Home Decor/Food & Drink 四个竞品分类，卡名沿用模板库公式 |
| Brands are Switching to AI Video Ads | benefits | 保留真实卖家结果，不伪造评价 |
| Frequently Asked Questions | faq | 使用竞品式模板问题，答案写视频输出、credits、无水印事实 |
| Create Your First Video | maker/CTA | 保留 |
| Three steps (甲方要求) | visual.steps | 保留，第二步只选任务样式 |
| 操作指南、场景配方、下载后处理、规格/示例墙 | intro/input_guide/results/scene_recipes/after_download/fit/examples、visual uses/input/outputs/after | 删除；依赖主控组件守卫空字段 |

## 场景对照

| 竞品模板场景名 | 我们的卡（图 ref） | 图对不对得上 |
|---|---|---|
| Fitness Coach UGC Hook | n:guide:k6-industries-card-yoga | 对得上：瑜伽砖/训练动作 |
| Beauty Education Talking Head UGC | n:q10-howto-picker-2 | 对得上：电动牙刷使用演示 |
| Electronics Desk Review UGC | n:guide:k6-templates-card-creator | 对得上：耳机创作者演示 |
| Food Beverage ASMR Unboxing Ad | n:q10-howto-picker-4 | 对得上：花草茶冲泡 |
| Home Cleaning Product UGC | n:q10-howto-picker-5 | 对得上：蒸汽挂烫 |
| Fashion Clothing TikTok UGC Hook | n:q10-howto-picker-6 | 对得上：外套穿着讲解 |
| Home Cleaning Product Demo UGC | n:q10-howto-picker-7 | 对得上：刷洗瓷砖缝 |
| Food Beverage Product Demo UGC | n:q10-howto-picker-8 | 对得上：压蒜动作 |
| Fashion Footwear Lifestyle UGC | n:guide:k7-ind-shoes-strip-4-n-boots-doorway | 对得上：靴子门口使用 |

无待换图、无待补场景。图片不进入 git。

## 不抄整句检查

`overlap.py tpl-howto.json bench/raw/comp-b99b6d032753.html`: PASS（最长相同 3 词；7 词重合 0 条）。

## 舍弃的区块

- tpl-howto｜intro、input_guide、results、scene_recipes、after_download、fit、examples｜模板竞品没有对应长篇操作、配方或示例墙，按 strict 清空。
- tpl-howto｜visual.uses、visual.input、visual.outputs、visual.after｜模板竞品没有用途/输入对比/规格/下载后区块，依赖主控组件守卫不渲染。
