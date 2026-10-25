# 试点：四个模板的视频提示词与资产清单

内部工作文档（非页面文案）。每个案例包含：指定演员（直接使用站内 AI 演员资产，无需生成人物图）、场景图（线上已有）、需生成的道具参考图及其提示词、对齐演员后的完整视频提示词。

视频提示词已按 Wan3.0 标准编写（参考锁定 / 风格 / 产品锁 / 动作逻辑 / 时间轴分镜 / 镜头 / 音效 / 连续性 / 负面清单），完整覆盖 0–30 秒；其中人物描述已改为指定演员的真实外貌。图片均可点开查看（演员头像与场景图为线上素材，直接取用）。

统一生成规格：9:16 竖幅 640×1138 WebP，浅灰无缝背景，无文字无水印。

| 案例 | 指定演员 | 场景图 | 需生成道具图 |
|---|---|---|---|
| 折叠自行车通勤 | Jon（outdoor-2） | 已有 | 背面 / 特写 / 手部 共 3 张 |
| 耳机盒揭秘 | —（仅手部出镜） | 已有 | 背面 / 特写 / 手部 共 3 张 |
| 橄榄绿衬衫搭配合身 | Dev（home-1） | 已有 | 背面 / 特写 / 手部 共 3 张 |
| 针织毛衣镜 | Elise（terrace-1） | 已有 | 背面 / 特写 / 手部 共 3 张 |

## 1. 折叠自行车通勤（Folding Bike Commute）

**指定演员：Jon**（`outdoor-2` · Men · 30s）— an adult Latino man in his thirties

![Jon](https://www.aivideosugc.com/ai-image-generation/actors/outdoor-2.webp)

**场景图（线上已有，即展示图基调）**

![场景图](https://www.aivideosugc.com/ai-image-generation/im01-video-hub-bike-r2-640.webp)

### 视频提示词（人物描述已对齐指定演员）

```
A 30-second vertical 9:16 e-commerce product display film for a full-size bicycle beside a train platform.

【Reference】The uploaded product photo is the only product reference. Reproduce the full-size bicycle exactly — same shape, proportions, colour, material, finish and details — and never show a second one or a changed part.
【Overall Style】E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action. Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.
【Product Lock】The full-size bicycle keeps the same shape, colour, material, finish and details in every frame, including two large wheels; nothing is added, removed or recoloured and the quantity never changes.
【Action Logic】One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.
【0.0-5.0s | Wide display】Wide shot at eye level: an adult Latino man in his thirties stands as the commuter with the full-size bicycle beside a train platform, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.
【5.0-11.0s | Front close-up】The front of the full-size bicycle fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently. Visible here: two large wheels.
【11.0-17.0s | Hand turns it】A hand enters from the top, lifts the full-size bicycle a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.
【17.0-23.0s | The action】The same man folds the full-size bicycle beside a train platform before carrying it aboard. Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.
【23.0-27.5s | Point held】The result of that action is held still in the frame: the same full-size bicycle, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.
【27.5-30.0s | Closing hold】The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.
【Camera】Controlled movement that serves the information: one slow push in, one gentle arc, one close follow of the hands and one locked hold. Every beat keeps the same light direction and the same screen direction, so the cuts read as one continuous action, and no beat invents an angle the product photo does not support.
【Sound】Voice: a calm adult voice, mid-range, neutral accent, unhurried pace, five short lines across the film — "A full-size bicycle, beside a train platform" / "The commuter folds it beside a train platform" / "The hands do the work, one movement at a time" / "Two large wheels" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The full-size bicycle stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

### 需生成的道具参考图

**1）产品背面** → `/ai-image-generation/folding-bike-commute-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the full-size commuter bicycle with two large wheels, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.
```

**2）材质特写** → `/ai-image-generation/folding-bike-commute-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the full-size commuter bicycle with two large wheels, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.
```

**3）手部特写** → `/ai-image-generation/folding-bike-commute-h1-hands-r1-640.webp`

```
Vertical 9:16 reference photo of adult hands, short clean nails and natural skin texture, one hand relaxed and open as if about to grip a handlebar, the other hand holding a slim tube, plain seamless light grey background, soft even light, sharp focus on skin and knuckles, no text, no logo, no watermark, photorealistic commercial photography.
```

## 2. 耳机盒揭秘（Earbud Box Reveal）

**指定演员：无**（全片仅手部与产品出镜，手部用生成的参考图锁定）

**场景图（线上已有，即展示图基调）**

![场景图](https://www.aivideosugc.com/ai-image-generation/img3-video-earbud-box-r1-640.webp)

### 视频提示词（人物描述已对齐指定演员）

```
A 30-second vertical 9:16 e-commerce product display film for a round matte sage-green charging case in stemless bean-shaped earbuds from a kraft box.

【Reference】The uploaded product photo is the only product reference. Reproduce the round matte sage-green charging case exactly — same shape, proportions, colour, material, finish and details — and never show a second one or a changed part.
【Overall Style】E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action. Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.
【Product Lock】The round matte sage-green charging case keeps the same shape, colour, material, finish and details in every frame, including the round case centered; nothing is added, removed or recoloured and the quantity never changes.
【Action Logic】One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.
【0.0-5.0s | Wide display】Wide shot at eye level: the round matte sage-green charging case is set in place in stemless bean-shaped earbuds from a kraft box, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.
【5.0-11.0s | Front close-up】The front of the round matte sage-green charging case fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently. Visible here: the round case centered.
【11.0-17.0s | Hand turns it】A hand enters from the top, lifts the round matte sage-green charging case a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.
【17.0-23.0s | The action】The creator holds the round matte sage-green charging case in stemless bean-shaped earbuds from a kraft box. Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.
【23.0-27.5s | Point held】The result of that action is held still in the frame: the same round matte sage-green charging case, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.
【27.5-30.0s | Closing hold】The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.
【Camera】Controlled movement only: one slow push in, one gentle arc, one close follow and one locked hold, all keeping the same light direction and screen direction.
【Sound】Voice: a calm adult voice, mid-range, neutral accent, unhurried pace, five short lines across the film — "A round matte sage-green charging case, in stemless bean-shaped earbuds from a kraft box" / "The creator holds it in stemless bean-shaped earbuds from a kraft box" / "The hands do the work, one movement at a time" / "The round case centered" / "One action, start to finish". Effects: the handling…
【Continuity】The product stays identical from the first to the last frame, the hands keep correct anatomy, and the same light and screen direction carry between beats. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

### 需生成的道具参考图

**1）产品背面** → `/ai-image-generation/earbud-box-reveal-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the sage-green earbud charging case with earbuds inside, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.
```

**2）材质特写** → `/ai-image-generation/earbud-box-reveal-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the sage-green earbud charging case with earbuds inside, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.
```

**3）手部特写** → `/ai-image-generation/earbud-box-reveal-h1-hands-r1-640.webp`

```
Vertical 9:16 reference photo of adult hands, short clean nails and natural skin texture, one hand pinching the edge of a tissue sheet as if lifting it from a box, the other hand cupped open below, plain seamless light grey background, soft even light, sharp focus on skin and knuckles, no text, no logo, no watermark, photorealistic commercial photography.
```

## 3. 橄榄绿衬衫搭配合身（Olive Overshirt Fit Reel）

**指定演员：Dev**（`home-1` · Men · 30s）— an adult South Asian man in his thirties

![Dev](https://www.aivideosugc.com/ai-image-generation/actors/home-1.webp)

**场景图（线上已有，即展示图基调）**

![场景图](https://www.aivideosugc.com/ai-image-generation/mx1w-video-hub-apparel-1-r1-640.webp)

### 视频提示词（人物描述已对齐指定演员）

```
A 30-second vertical 9:16 e-commerce product display film for an olive overshirt in a real room.

【Reference】The uploaded product photo is the only product reference. Reproduce the olive overshirt exactly — same shape, proportions, colour, material, finish and details — and never show a second one or a changed part.
【Overall Style】E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action. Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.
【Product Lock】The olive overshirt keeps the same shape, colour, material, finish and details in every frame, including the full front; nothing is added, removed or recoloured and the quantity never changes.
【Action Logic】One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.
【0.0-5.0s | Wide display】Wide shot at eye level: an adult model stands with the olive overshirt in a real room, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.
【5.0-11.0s | Front close-up】The front of the olive overshirt fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently. Visible here: the full front.
【11.0-17.0s | Hand turns it】A hand enters from the top, lifts the olive overshirt a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.
【17.0-23.0s | The action】An adult South Asian man in his thirties presents the olive overshirt with the full front and sleeves visible. Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.
【23.0-27.5s | Point held】The result of that action is held still in the frame: the same olive overshirt, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.
【27.5-30.0s | Closing hold】The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.
【Camera】Controlled movement that serves the information: one slow push in, one gentle arc, one close follow of the hands and one locked hold. Every beat keeps the same light direction and the same screen direction, so the cuts read as one continuous action, and no beat invents an angle the product photo does not support.
【Sound】Voice: a calm adult voice, mid-range, neutral accent, unhurried pace, five short lines across the film — "An olive overshirt, in a real room" / "The model presents it in a real room" / "The hands do the work, one movement at a time" / "The full front" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The olive overshirt stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

### 需生成的道具参考图

**1）产品背面** → `/ai-image-generation/olive-overshirt-fit-reel-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the olive-green cotton overshirt, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.
```

**2）材质特写** → `/ai-image-generation/olive-overshirt-fit-reel-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the olive-green cotton overshirt, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.
```

**3）手部特写** → `/ai-image-generation/olive-overshirt-fit-reel-h1-hands-r1-640.webp`

```
Vertical 9:16 reference photo of adult hands, short clean nails and natural skin texture, one hand pinching a soft cotton fabric edge between thumb and fingers, the other hand flat and open, plain seamless light grey background, soft even light, sharp focus on skin and knuckles, no text, no logo, no watermark, photorealistic commercial photography.
```

## 4. 针织毛衣镜（Knit Sweater Mirror）

**指定演员：Elise**（`terrace-1` · Women · 30s）— an adult Latina woman in her thirties with a straight chin-length copper-red bob

![Elise](https://www.aivideosugc.com/ai-image-generation/actors/terrace-1.webp)

**场景图（线上已有，即展示图基调）**

![场景图](https://www.aivideosugc.com/ai-image-generation/im01-video-hub-sweater-r1-640.webp)

### 视频提示词（人物描述已对齐指定演员）

```
A 30-second vertical 9:16 e-commerce product display film for a cream knit sweater in a mirror.

【Reference】The uploaded product photo is the only product reference. Reproduce the cream knit sweater exactly — same shape, proportions, colour, material, finish and details — and never show a second one or a changed part.
【Overall Style】E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action. Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.
【Product Lock】The cream knit sweater keeps the same shape, colour, material, finish and details in every frame, including the full garment visible; nothing is added, removed or recoloured and the quantity never changes.
【Action Logic】One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.
【0.0-5.0s | Wide display】Wide shot at eye level: an adult Latina woman in her thirties with a straight chin-length copper-red bob stands with the cream knit sweater in a mirror, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.
【5.0-11.0s | Front close-up】The front of the cream knit sweater fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently. Visible here: the full garment visible.
【11.0-17.0s | Hand turns it】A hand enters from the top, lifts the cream knit sweater a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.
【17.0-23.0s | The action】The same woman with a straight chin-length copper-red bob adjusts the cream knit sweater in a mirror with the full garment visible. Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.
【23.0-27.5s | Point held】The result of that action is held still in the frame: the same cream knit sweater, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.
【27.5-30.0s | Closing hold】The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.
【Camera】Controlled movement that serves the information: one slow push in, one gentle arc, one close follow of the hands and one locked hold. Every beat keeps the same light direction and the same screen direction, so the cuts read as one continuous action, and no beat invents an angle the product photo does not support.
【Sound】Voice: a calm adult voice, mid-range, neutral accent, unhurried pace, five short lines across the film — "A cream knit sweater, in a mirror" / "The woman adjusts it in a mirror" / "The hands do the work, one movement at a time" / "The full garment visible" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The cream knit sweater stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

### 需生成的道具参考图

**1）产品背面** → `/ai-image-generation/knit-sweater-mirror-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the cream knit sweater, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography.
```

**2）材质特写** → `/ai-image-generation/knit-sweater-mirror-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the cream knit sweater, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography.
```

**3）手部特写** → `/ai-image-generation/knit-sweater-mirror-h1-hands-r1-640.webp`

```
Vertical 9:16 reference photo of adult hands, short clean nails and natural skin texture, fingers gently holding a soft knitted fabric edge, plain seamless light grey background, soft even light, sharp focus on skin and knuckles, no text, no logo, no watermark, photorealistic commercial photography.
```
