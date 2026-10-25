# AIVideosUGC 试点：四个模板卡片的参考图资产生成提示词

## 文档说明

- **用途**：为四个试点模板各生成 2 张补充参考图（**背面图 product-back** + **材质特写图 product-macro**），作为多参考图生成链路的素材。内部工作文档，不得进入前端
- **背景**：单张产品正面照无法提供背面/标签区域与材质微观细节，模型生成视频时会自行脑补。补充这两类参考图后，提示词的【参考】块可重编译为多图版本，产品锁更严
- **现状**：这些参考图**尚未生成**（生产与本地均无对应 `MediaAsset`）。44 张 scene 场景图为站内已有素材，无需处理
- **统一规格**：9:16 竖幅，640×1138，WebP，浅灰无缝背景；与卡片现有展示图同一命名序列（`<slug>-a2-back` / `<slug>-a3-macro`）
- **主体短语修正**：清单中的主体短语来自机器拼接，其中 3 个有误，下文已人工修正并标注原文，生成时以修正后的提示词为准

| # | 模板 | 中文 | 主体短语（修正后） | 原短语（机器拼接） |
|---:|---|---|---|---|
| 1 | `folding-bike-commute` | 折叠自行车通勤 | the full-size commuter bicycle with two large wheels | `the folding bike commute` |
| 2 | `earbud-box-reveal` | 耳机盒揭秘 | the sage-green earbud charging case with earbuds inside | `the tissue and lift` |
| 3 | `olive-overshirt-fit-reel` | 橄榄绿衬衫搭配合身 | the olive-green cotton overshirt | `the olive overshirt with` |
| 4 | `knit-sweater-mirror` | 针织毛衣镜 | the cream knit sweater | `the cream knit sweater` |

## 1. 折叠自行车通勤（Folding Bike Commute）

- **详情页**：`/ai-video-generation/folding-bike-commute`
- **当前展示图**：`/ai-image-generation/im01-video-hub-bike-r2-640.webp`（正面参考的来源基调）

### 背面图（product-back）

- **目标文件名**：`/ai-image-generation/folding-bike-commute-a2-back-r1-640.webp`
- **尺寸**：640x1138
- **用途**：One product photo cannot show the back or the label area, so the model invents a second product.
- **生成提示词（主体短语已修正）**：

```
Vertical 9:16 studio product reference photo of the full-size commuter bicycle with two large wheels, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.
```

### 材质特写图（product-macro）

- **目标文件名**：`/ai-image-generation/folding-bike-commute-a3-macro-r1-640.webp`
- **尺寸**：640x1138
- **用途**：One product photo cannot hold a true material close-up, so the model invents the surface.
- **生成提示词（主体短语已修正）**：

```
Vertical 9:16 macro detail photo of the full-size commuter bicycle with two large wheels, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.
```

## 2. 耳机盒揭秘（Earbud Box Reveal）

- **详情页**：`/ai-video-generation/earbud-box-reveal`
- **当前展示图**：`/ai-image-generation/img3-video-earbud-box-r1-640.webp`（正面参考的来源基调）

### 背面图（product-back）

- **目标文件名**：`/ai-image-generation/earbud-box-reveal-a2-back-r1-640.webp`
- **尺寸**：640x1138
- **用途**：One product photo cannot show the back or the label area, so the model invents a second product.
- **生成提示词（主体短语已修正）**：

```
Vertical 9:16 studio product reference photo of the sage-green earbud charging case with earbuds inside, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.
```

### 材质特写图（product-macro）

- **目标文件名**：`/ai-image-generation/earbud-box-reveal-a3-macro-r1-640.webp`
- **尺寸**：640x1138
- **用途**：One product photo cannot hold a true material close-up, so the model invents the surface.
- **生成提示词（主体短语已修正）**：

```
Vertical 9:16 macro detail photo of the sage-green earbud charging case with earbuds inside, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.
```

## 3. 橄榄绿衬衫搭配合身（Olive Overshirt Fit Reel）

- **详情页**：`/ai-video-generation/olive-overshirt-fit-reel`
- **当前展示图**：`/ai-image-generation/mx1w-video-hub-apparel-1-r1-640.webp`（正面参考的来源基调）

### 背面图（product-back）

- **目标文件名**：`/ai-image-generation/olive-overshirt-fit-reel-a2-back-r1-640.webp`
- **尺寸**：640x1138
- **用途**：One product photo cannot show the back or the label area, so the model invents a second product.
- **生成提示词（主体短语已修正）**：

```
Vertical 9:16 studio product reference photo of the olive-green cotton overshirt, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.
```

### 材质特写图（product-macro）

- **目标文件名**：`/ai-image-generation/olive-overshirt-fit-reel-a3-macro-r1-640.webp`
- **尺寸**：640x1138
- **用途**：One product photo cannot hold a true material close-up, so the model invents the surface.
- **生成提示词（主体短语已修正）**：

```
Vertical 9:16 macro detail photo of the olive-green cotton overshirt, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.
```

## 4. 针织毛衣镜（Knit Sweater Mirror）

- **详情页**：`/ai-video-generation/knit-sweater-mirror`
- **当前展示图**：`/ai-image-generation/im01-video-hub-sweater-r1-640.webp`（正面参考的来源基调）

### 背面图（product-back）

- **目标文件名**：`/ai-image-generation/knit-sweater-mirror-a2-back-r1-640.webp`
- **尺寸**：640x1138
- **用途**：One product photo cannot show the back or the label area, so the model invents a second product.
- **生成提示词（主体短语已修正）**：

```
Vertical 9:16 studio product reference photo of the cream knit sweater, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.
```

### 材质特写图（product-macro）

- **目标文件名**：`/ai-image-generation/knit-sweater-mirror-a3-macro-r1-640.webp`
- **尺寸**：640x1138
- **用途**：One product photo cannot hold a true material close-up, so the model invents the surface.
- **生成提示词（主体短语已修正）**：

```
Vertical 9:16 macro detail photo of the cream knit sweater, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.
```

## 生成与接入流程（建议）

1. 按上述提示词生成 8 张参考图（4 模板 × 2 类），人工审核：背面轮廓与正面自洽、材质与正面一致、背景与规格统一
2. 审核通过的图按目标文件名入 `public/ai-image-generation/`，以媒体记录（单文件 SHA-256 校验）入内容管道
3. 确认工作区生成请求支持携带多张产品参考图后，重编译这 4 张卡片的【参考】块（单图版 → 多图版），走 field-level manifest + CAS 更新
4. 试点对比生成质量后，再决定是否推广到其余 889 张卡片
