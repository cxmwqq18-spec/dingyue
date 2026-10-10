# tpl-box competitor decomposition

Main competitor: Tagshop AI `/templates` (`bench/live-20261010/ts-templates.json/.jpg`), with category filters and short category + technique + format names.

## Competitor blocks (top to bottom)

| Type | Competitor text | Chars |
|---|---|---:|
| Hero | See It. Recreate It. Launch It. | 31 |
| Hero lead | Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes. | 157 |
| Gallery | All, Skincare, Beauty, Fashion, Food & Drink, Technology, Fitness, Home Decor, Explore More | 90 |
| Gallery cards | Beauty Accessories ASMR Unboxing; Food Beverage ASMR Unboxing Ad; Tech Product Unboxing UGC; Pet Product Living Room UGC | 120 |
| FAQ | Frequently Asked Questions | 26 |
| CTA | Create Your First Video | 23 |

## 区块对照

| 竞品区块（原文标题） | 我们对应区块 | 处理 |
|---|---|---|
| See It. Recreate It. Launch It. | PageHero + maker | 照写结构，换成完整套装事实 |
| Template gallery + category filters | visual.picker | 使用 Beauty/Food & Drink/Technology/Explore More 分类；8 张图均对应套装场景 |
| Brands are Switching to AI Video Ads | benefits | 保留真实 bundle 卖家收益，不伪造评价 |
| Frequently Asked Questions | faq | 采用竞品式模板问题，答案写套装照片、24 credits/无水印事实 |
| Create Your First Video | maker/CTA | 保留 |
| Three steps (甲方要求) | visual.steps | 保留，第二步只选套装样式 |
| 操作指南、场景配方、下载后处理、规格/示例墙 | intro/input_guide/results/scene_recipes/after_download/fit/examples、visual uses/input/outputs/after | 删除；依赖主控组件守卫空字段 |

## 场景对照

| 竞品模板场景名 | 我们的卡（图 ref） | 图对不对得上 |
|---|---|---|
| Beauty Product Unboxing UGC | f:q8-tpl-box-pick-01 | 对得上：婴儿护理套装拆箱 |
| GRWM Skincare Morning Routine | f:q8-tpl-box-pick-02 | 对得上：护肤套装镜前展示 |
| Pet Product Living Room UGC | f:q8-tpl-box-pick-03 | 对得上：宠物护理套装与狗 |
| Food Beverage ASMR Unboxing Ad | f:q8-tpl-box-pick-04 | 对得上：零食盒拆箱/试吃 |
| Tech Product Unboxing UGC | f:q8-tpl-box-pick-05-r2 | 对得上：耳机套装拆箱 |
| Sensory Food Beverage TikTok Hook | f:q8-tpl-box-pick-06-r2 | 对得上：蛋白棒套装试吃 |
| Phone Accessories Unboxing UGC | f:q8-tpl-box-pick-07 | 对得上：手机壳套装 |
| Pet Product Problem Solution UGC | f:q8-tpl-box-pick-08-r2 | 对得上：宠物毛发清理套装 |

无待换图、无待补场景。图片不进入 git。

## 不抄整句检查

`overlap.py tpl-box.json bench/raw/comp-b99b6d032753.html`: PASS（最长相同 3 词；7 词重合 0 条）。

## 舍弃的区块

- tpl-box｜intro、input_guide、results、scene_recipes、after_download、fit、examples｜模板竞品没有对应长篇操作、配方或示例墙，按 strict 清空。
- tpl-box｜visual.uses、visual.input、visual.outputs、visual.after｜模板竞品没有用途/输入对比/规格/下载后区块，依赖主控组件守卫不渲染。
