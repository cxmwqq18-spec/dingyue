# tpl-beauty competitor decomposition

Main competitor: Tagshop AI `/templates` (`bench/live-20261010/ts-templates.json/.jpg`); the gallery presents category filters and short template names using category + technique + format.

## Competitor blocks (top to bottom)

| Type | Competitor text | Chars |
|---|---|---:|
| Hero | See It. Recreate It. Launch It. | 31 |
| Hero lead | Find a style you love and recreate it with your own product. No prompts required – just select a template, add your product, and generate content in minutes. | 157 |
| Gallery | All, Skincare, Beauty, Fashion, Food & Drink, Technology, Fitness, Home Decor, Explore More | 90 |
| Gallery cards | Skincare Routine TikTok UGC; Beauty Product Close-Up UGC; Beauty Before After UGC Hook; Beauty Accessories ASMR Unboxing | 124 |
| FAQ | Frequently Asked Questions | 26 |
| CTA | Create Your First Video | 23 |

## 区块对照

| 竞品区块（原文标题） | 我们对应区块 | 处理 |
|---|---|---|
| See It. Recreate It. Launch It. | PageHero + maker | 照写结构，换成自有美容产品事实 |
| Template gallery + category filters | visual.picker | 只保留 Beauty 筛选；10 张护肤/美容图均与卡名匹配 |
| Brands are Switching to AI Video Ads | benefits | 保留真实卖家收益，不伪造评价 |
| Frequently Asked Questions | faq | 使用竞品式模板问题，答案写真实时长/credits/无水印口径 |
| Create Your First Video | maker/CTA | 保留 |
| Three steps (甲方要求) | visual.steps | 保留，第二步只选美容样式 |
| 操作指南、场景配方、下载后处理、规格/示例墙 | intro/input_guide/results/scene_recipes/after_download/fit/examples、visual uses/input/outputs/after | 删除；依赖主控组件守卫空字段 |

## 场景对照

| 竞品模板场景名 | 我们的卡（图 ref） | 图对不对得上 |
|---|---|---|
| Beauty Street Interview UGC TikTok | n:guide:f16-r10-beauty-street-review-r1 | 对得上：美容产品街头访谈 |
| Concealer Beauty Review UGC | n:guide:f16-tpl-beauty-picker-lip-tint-r1 | 对得上：彩妆试用讲解 |
| Skincare Problem Solution UGC | n:guide:f16-r10-beauty-problem-solution-r1 | 对得上：问题到解决演示 |
| Skincare Product Close-Up UGC | n:guide:q11-beauty-picker-04 | 对得上：精华滴管近景 |
| Beauty Accessories ASMR Unboxing | n:guide:q11-beauty-picker-05 | 对得上：面霜质地/拆箱感 |
| Beauty Before After UGC Hook | n:guide:q11-beauty-picker-06 | 对得上：唇彩前后对比 |
| GRWM Skincare Morning Routine | n:guide:q11-beauty-picker-07 | 对得上：护肤瓶拆箱与晨间使用 |
| Beauty Talking Head Product Review UGC | n:guide:f16-tpl-beauty-picker-gift-review-r1 | 对得上：护肤套装讲解 |
| Skincare Routine TikTok UGC | n:guide:f16-r10-beauty-problem-solution-alt-r1 | 对得上：日常护肤动作 |
| Toner Skincare Bathroom UGC | n:guide:f16-r10-beauty-street-review-alt-r1 | 对得上：浴室/街头美容场景 |

无待换图、无待补场景。图片不进入 git。

## 不抄整句检查

`overlap.py tpl-beauty.json bench/raw/comp-b99b6d032753.html`: PASS（最长相同 3 词；7 词重合 0 条）。

## 舍弃的区块

- tpl-beauty｜intro、input_guide、results、scene_recipes、after_download、fit、examples｜模板竞品没有对应长篇操作、配方或示例墙，按 strict 清空。
- tpl-beauty｜visual.uses、visual.input、visual.outputs、visual.after｜模板竞品没有用途/输入对比/规格/下载后区块，依赖主控组件守卫不渲染。
