# GPT10 跨页正文相似度证据

原始抓取时间：2026-08-17T15:27:50.828Z

## 方法

- 只使用每页可见文章正文的有序内容，排除全站 Header/Footer。
- 仅把每页自己的主题别名替换为 `TOPIC`，把模板大类名替换为 `CATEGORY`，然后转小写、移除标点、合并空格。
- 指标是“唯一连续 5 词组集合”的 Jaccard 相似度；1.0000 表示归一化后 5 词组集合相同。
- 该指标证明共享措辞程度，不单独等同于搜索引擎惩罚或人工处置。

## 结果

- 共比较 36 对页面；最小 0.9363，最大 1.0000，平均 0.9819。
- 全部页面标题层级序列相同：是。
- 全部页面正文标签序列相同：是。
- 全部页面有序内容块数量相同：是。

| 页面 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| 1. Cyberpunk | 1.0000 | 0.9787 | 0.9787 | 0.9787 | 0.9787 | 0.9787 | 0.9787 | 0.9451 | 0.9787 |
| 2. Mafia | 0.9787 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9363 | 1.0000 |
| 3. Magic Upscaler | 0.9787 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9363 | 1.0000 |
| 4. Nature | 0.9787 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9363 | 1.0000 |
| 5. Outdoor Creator Scenes | 0.9787 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9363 | 1.0000 |
| 6. Valentines Photo | 0.9787 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9363 | 1.0000 |
| 7. Virtual Try-On | 0.9787 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9363 | 1.0000 |
| 8. Wedding Photo | 0.9451 | 0.9363 | 0.9363 | 0.9363 | 0.9363 | 0.9363 | 0.9363 | 1.0000 | 0.9363 |
| 9. Soccer | 0.9787 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 1.0000 | 0.9363 | 1.0000 |

## 页面结构

| # | 页面 | 原始词数 | 有序内容块 | 归一化词数 | 唯一 5 词组 |
|---:|---|---:|---:|---:|---:|
| 1 | [Cyberpunk](https://www.mydreamshoots.com/blog/cyberpunk-photo-package-guide) | 1080 | 37 | 1012 | 975 |
| 2 | [Mafia](https://www.mydreamshoots.com/blog/mafia-photo-package-guide) | 1077 | 37 | 1009 | 972 |
| 3 | [Magic Upscaler](https://www.mydreamshoots.com/blog/magic-upscaler-photo-package-guide) | 1111 | 37 | 1009 | 972 |
| 4 | [Nature](https://www.mydreamshoots.com/blog/nature-photo-package-guide) | 1077 | 37 | 1009 | 972 |
| 5 | [Outdoor Creator Scenes](https://www.mydreamshoots.com/blog/outdoor-creator-scenes-photo-package-guide) | 1145 | 37 | 1009 | 972 |
| 6 | [Valentines Photo](https://www.mydreamshoots.com/blog/valentine-photos-photo-package-guide) | 1111 | 37 | 1009 | 972 |
| 7 | [Virtual Try-On](https://www.mydreamshoots.com/blog/virtual-try-on-photo-package-guide) | 1111 | 37 | 1009 | 972 |
| 8 | [Wedding Photo](https://www.mydreamshoots.com/blog/wedding-portraits-photo-package-guide) | 1117 | 37 | 1012 | 974 |
| 9 | [Soccer](https://www.mydreamshoots.com/blog/world-cup-fan-photos-photo-package-guide) | 1077 | 37 | 1009 | 972 |

详细机器可读结果见 `similarity-analysis.json`。
