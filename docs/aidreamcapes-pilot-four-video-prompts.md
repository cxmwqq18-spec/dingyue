# AIVideosUGC 试点：四个模板卡片的视频生成提示词

## 文档说明

- **用途**：人工审阅与试点生成用的工作文档（内部资料，不是页面文案，不得进入前端）
- **数据来源**：`LivePage`（`/ai-video-generation` → `sections.v2_main.settings.data.visual.picker.cards[0..3]`），本地库与生产库均为 2026-10-25 同步后的 v3 终态（生产部署 commit `41d1cad4b`，content apply 2668 项全量 applied）
- **提示词语言**：提示词按英文编写与消费（模型输入），浏览器翻译仅供阅读
- **对应页面**：`/ai-video-generation/<slug>`

## 1. 折叠自行车通勤（Folding Bike Commute）

- **slug**：`folding-bike-commute`
- **详情页**：`/ai-video-generation/folding-bike-commute`
- **工具**：`image-to-video`　**时长**：30 秒　**画幅**：9:16
- **分类 chips**：accessories
- **当前展示图**：`/ai-image-generation/im01-video-hub-bike-r2-640.webp`
- **提示词长度**：3925 字符

### 视频生成提示词（原文）

```
A 30-second vertical 9:16 e-commerce product display film for a full-size bicycle beside a train platform.

【Reference】The uploaded product photo is the only product reference. Reproduce the full-size bicycle exactly — same shape, proportions, colour, material, finish and details — and never show a second one or a changed part.
【Overall Style】E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action. Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.
【Product Lock】The full-size bicycle keeps the same shape, colour, material, finish and details in every frame, including two large wheels; nothing is added, removed or recoloured and the quantity never changes.
【Action Logic】One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.
【0.0-5.0s | Wide display】Wide shot at eye level: an adult commuter stands with the full-size bicycle beside a train platform, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.
【5.0-11.0s | Front close-up】The front of the full-size bicycle fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently. Visible here: two large wheels.
【11.0-17.0s | Hand turns it】A hand enters from the top, lifts the full-size bicycle a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.
【17.0-23.0s | The action】An adult commuter folds a full-size bicycle beside a train platform before carrying it aboard. Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.
【23.0-27.5s | Point held】The result of that action is held still in the frame: the same full-size bicycle, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.
【27.5-30.0s | Closing hold】The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.
【Camera】Controlled movement that serves the information: one slow push in, one gentle arc, one close follow of the hands and one locked hold. Every beat keeps the same light direction and the same screen direction, so the cuts read as one continuous action, and no beat invents an angle the product photo does not support.
【Sound】Voice: a calm adult voice, mid-range, neutral accent, unhurried pace, five short lines across the film — "A full-size bicycle, beside a train platform" / "The commuter folds it beside a train platform" / "The hands do the work, one movement at a time" / "Two large wheels" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The full-size bicycle stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

## 2. 耳机盒揭秘（Earbud Box Reveal）

- **slug**：`earbud-box-reveal`
- **详情页**：`/ai-video-generation/earbud-box-reveal`
- **工具**：`image-to-video`　**时长**：30 秒　**画幅**：9:16
- **分类 chips**：accessories
- **当前展示图**：`/ai-image-generation/img3-video-earbud-box-r1-640.webp`
- **提示词长度**：3888 字符

### 视频生成提示词（原文）

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

## 3. 橄榄绿衬衫搭配合身（Olive Overshirt Fit Reel）

- **slug**：`olive-overshirt-fit-reel`
- **详情页**：`/ai-video-generation/olive-overshirt-fit-reel`
- **工具**：`image-to-video`　**时长**：30 秒　**画幅**：9:16
- **分类 chips**：apparel
- **当前展示图**：`/ai-image-generation/mx1w-video-hub-apparel-1-r1-640.webp`
- **提示词长度**：3852 字符

### 视频生成提示词（原文）

```
A 30-second vertical 9:16 e-commerce product display film for an olive overshirt in a real room.

【Reference】The uploaded product photo is the only product reference. Reproduce the olive overshirt exactly — same shape, proportions, colour, material, finish and details — and never show a second one or a changed part.
【Overall Style】E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action. Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.
【Product Lock】The olive overshirt keeps the same shape, colour, material, finish and details in every frame, including the full front; nothing is added, removed or recoloured and the quantity never changes.
【Action Logic】One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.
【0.0-5.0s | Wide display】Wide shot at eye level: an adult model stands with the olive overshirt in a real room, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.
【5.0-11.0s | Front close-up】The front of the olive overshirt fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently. Visible here: the full front.
【11.0-17.0s | Hand turns it】A hand enters from the top, lifts the olive overshirt a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.
【17.0-23.0s | The action】An adult model presents a olive overshirt with the full front and sleeves visible. Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.
【23.0-27.5s | Point held】The result of that action is held still in the frame: the same olive overshirt, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.
【27.5-30.0s | Closing hold】The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.
【Camera】Controlled movement that serves the information: one slow push in, one gentle arc, one close follow of the hands and one locked hold. Every beat keeps the same light direction and the same screen direction, so the cuts read as one continuous action, and no beat invents an angle the product photo does not support.
【Sound】Voice: a calm adult voice, mid-range, neutral accent, unhurried pace, five short lines across the film — "An olive overshirt, in a real room" / "The model presents it in a real room" / "The hands do the work, one movement at a time" / "The full front" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The olive overshirt stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

## 4. 针织毛衣镜（Knit Sweater Mirror）

- **slug**：`knit-sweater-mirror`
- **详情页**：`/ai-video-generation/knit-sweater-mirror`
- **工具**：`image-to-video`　**时长**：30 秒　**画幅**：9:16
- **分类 chips**：apparel
- **当前展示图**：`/ai-image-generation/im01-video-hub-sweater-r1-640.webp`
- **提示词长度**：3966 字符

### 视频生成提示词（原文）

```
A 30-second vertical 9:16 e-commerce product display film for a cream knit sweater in a mirror.

【Reference】The uploaded product photo is the only product reference. Reproduce the cream knit sweater exactly — same shape, proportions, colour, material, finish and details — and never show a second one or a changed part.
【Overall Style】E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action. Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.
【Product Lock】The cream knit sweater keeps the same shape, colour, material, finish and details in every frame, including the full garment visible; nothing is added, removed or recoloured and the quantity never changes.
【Action Logic】One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.
【0.0-5.0s | Wide display】Wide shot at eye level: an adult woman with short copper pixie haircut stands with the cream knit sweater in a mirror, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.
【5.0-11.0s | Front close-up】The front of the cream knit sweater fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently. Visible here: the full garment visible.
【11.0-17.0s | Hand turns it】A hand enters from the top, lifts the cream knit sweater a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.
【17.0-23.0s | The action】An adult woman with a short copper pixie haircut adjusts a cream knit sweater in a mirror with the full garment visible. Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.
【23.0-27.5s | Point held】The result of that action is held still in the frame: the same cream knit sweater, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.
【27.5-30.0s | Closing hold】The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.
【Camera】Controlled movement that serves the information: one slow push in, one gentle arc, one close follow of the hands and one locked hold. Every beat keeps the same light direction and the same screen direction, so the cuts read as one continuous action, and no beat invents an angle the product photo does not support.
【Sound】Voice: a calm adult voice, mid-range, neutral accent, unhurried pace, five short lines across the film — "A cream knit sweater, in a mirror" / "The haircut adjusts it in a mirror" / "The hands do the work, one movement at a time" / "The full garment visible" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The cream knit sweater stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```
