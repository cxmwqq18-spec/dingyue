# tpl-compare competitor decomposition

Main competitor: Tagshop AI `/templates` (`bench/live-20261010/ts-templates.json/.jpg`). Its gallery uses category filters and concise category + technique + format template names.

## Competitor blocks (top to bottom)

| Type | Competitor text | Chars |
|---|---|---:|
| Hero | See It. Recreate It. Launch It. | 31 |
| Hero lead | Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes. | 157 |
| Gallery | All, Skincare, Beauty, Fashion, Food & Drink, Technology, Fitness, Home Decor, Explore More | 90 |
| Gallery card formula | Beauty Product Comparison UGC; Fitness Wear Test UGC; Tech Product Fit Review UGC | 87 |
| FAQ | Frequently Asked Questions | 26 |
| CTA | Create Your First Video | 23 |

## 区块对照

| 竞品区块（原文标题） | 我们对应区块 | 处理 |
|---|---|---|
| See It. Recreate It. Launch It. | PageHero + maker | 照写结构，换成自有选项比较 |
| Template gallery + category filters | visual.picker | 使用 Beauty/Fitness/Explore More 三个有图筛选，卡名按模板库公式 |
| Brands are Switching to AI Video Ads | benefits | 保留真实卖家收益，不伪造评价 |
| Frequently Asked Questions | faq | 使用竞品式模板问题，答案写自有选项、credits、无水印事实 |
| Create Your First Video | maker/CTA | 保留 |
| Three steps (甲方要求) | visual.steps | 保留，第二步只选比较样式 |
| 操作指南、场景配方、下载后处理、规格/示例墙 | intro/input_guide/results/scene_recipes/after_download/fit/examples、visual uses/input/outputs/after | 删除；依赖主控组件守卫空字段 |

## 场景对照

| 竞品模板场景名 | 我们的卡（图 ref） | 图对不对得上 |
|---|---|---|
| Beauty Product Comparison UGC | n:guide:q12-tpl-compare-card-01-serum-review | 对得上：两种精华质地比较 |
| Tech Product Fit Review UGC | n:guide:q12-tpl-compare-card-02-headphone-review | 对得上：耳机佩戴比较 |
| Beauty Product Side-by-Side Demo | n:guide:q12-tpl-compare-card-03-skincare-bottles | 对得上：护肤瓶并列 |
| Fitness Wear Test UGC | n:guide:q12-tpl-compare-card-04-athletic-fits | 对得上：运动裤穿着比较 |
| Fitness Sneaker Colorway Comparison | n:guide:q12-tpl-compare-card-05-sneaker-colors | 对得上：鞋款颜色比较 |
| Pet Harness Fit Check UGC | n:guide:q12-tpl-compare-card-06-pet-harness-sizes | 对得上：宠物背带尺寸比较 |
| Beauty Flavor Comparison UGC | n:guide:q12-tpl-compare-card-07-supplement-flavors | 对得上：两种饮品口味比较 |
| Beauty Package Comparison UGC | n:guide:q12-tpl-compare-card-08-package-refresh | 对得上：包装版本比较 |

无待换图、无待补场景。图片不进入 git。

## 不抄整句检查

`overlap.py tpl-compare.json bench/raw/comp-b99b6d032753.html`: PASS（最长相同 3 词；7 词重合 0 条）。

## 舍弃的区块

- tpl-compare｜intro、input_guide、results、scene_recipes、after_download、fit、examples｜模板竞品没有对应的长篇操作、配方或示例墙，按 strict 清空。
- tpl-compare｜visual.uses、visual.input、visual.outputs、visual.after｜模板竞品没有用途/输入对比/规格/下载后区块，依赖主控组件守卫不渲染。
