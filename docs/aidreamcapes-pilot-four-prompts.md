# 试点：四个模板的视频提示词与资产清单

内部工作文档（非页面文案）。三类资产严格分开：

1. **演员（人物资产）**：直接指定站内 AI 演员，用现有头像，不生成；
2. **道具图（纯产品，无人物）**：产品背面、材质特写、手部特写，按提示词生成；
3. **场景图（无人物、无产品）**：现有展示图都含人物，不引用；按提示词生成空场景图。

## 真人实质感规范（所有生成图必须遵守）

- **真实摄影质感**：按全画幅相机实拍标准输出，真实光学虚化与光衰减，透视自然；
- **真实材质**：皮肤可见毛孔、指节细纹与自然瑕疵；面料可见织纹与纤维；硬质材料可见加工纹理与使用痕迹；
- **拒绝渲染感**：not CGI / not 3D render / no illustration look，禁止塑料感、过度平滑、假光影；
- **产品一致**：道具图的形状、颜色、材质必须与产品正面图自洽，供视频提示词跨镜引用。

## 图片引用规范（@Image 附件顺序）

模型**只识别附件上传顺序，不识别文件名**，因此引用一律按挂载位置编号：

- 视频提示词开头的【Reference Order】块逐一定义 `@Image 1 / @Image 2 / …`：类别「内容」（基准性质）：控制的属性范围；
- 正文与防穿模规则全部用 `@Image N` 指代，例如：角色（@Image 2）不得沾染场景（@Image 1）或产品（@Image 3）的属性；
- 每个案例给出**附件挂载清单**（第几张 → 哪个文件），操作者按顺序挂载，顺序不能错。未覆盖细节一律回退到产品正面图。

统一生成规格：9:16 竖幅 640×1138 WebP；提示词为英文（模型按英文消费）。

| 案例 | 指定演员 | 需生成道具图 | 需生成场景图 | 附件总数 |
|---|---|---|---|---|
| 折叠自行车通勤 | Jon（outdoor-2） | 背面 / 特写 / 手部 共 3 张 | 空场景 1 张 | 6 张 |
| 耳机盒揭秘 | —（仅手部出镜） | 背面 / 特写 / 手部 共 3 张 | 空场景 1 张 | 5 张 |
| 橄榄绿衬衫搭配合身 | Dev（home-1） | 背面 / 特写 / 手部 共 3 张 | 空场景 1 张 | 6 张 |
| 针织毛衣镜 | Elise（terrace-1） | 背面 / 特写 / 手部 共 3 张 | 空场景 1 张 | 6 张 |

## 1. 折叠自行车通勤（Folding Bike Commute）

**演员（人物资产，直接取用）**：Jon（`outdoor-2` · Men · 30s）— an adult Latino man in his thirties

![Jon](https://www.aivideosugc.com/ai-image-generation/actors/outdoor-2.webp)

**附件挂载清单（按上传顺序）**：

| 附件顺序 | 句柄 | 素材文件 | 说明 |
|---:|---|---|---|
| 第 1 张 | @Image 1 场景 | `/ai-image-generation/folding-bike-commute-s1-scene-r1-640.webp` | 空镜全景，空间与光位基准 |
| 第 2 张 | @Image 2 角色 | `/ai-image-generation/actors/outdoor-2.webp` | 演员 Jon，人物身份基准 |
| 第 3 张 | @Image 3 产品正面 | `客户上传的产品照片` | 道具一致性基准 |
| 第 4 张 | @Image 4 产品背面 | `/ai-image-generation/folding-bike-commute-a2-back-r1-640.webp` | 同一实物形制基准（背面） |
| 第 5 张 | @Image 5 材质特写 | `/ai-image-generation/folding-bike-commute-a3-macro-r1-640.webp` | 表面微纹理基准 |
| 第 6 张 | @Image 6 手部 | `/ai-image-generation/folding-bike-commute-h1-hands-r1-640.webp` | 手部解剖与指甲基准 |

### 视频提示词（@Image 附件顺序引用，人物已对齐演员）

```
A 30-second vertical 9:16 e-commerce product display film for a full-size bicycle beside a train platform.

【Reference Order】The model only sees the upload position of each attached image, so every position is defined here once and referenced by its @Image number afterwards. Each image controls only its own attribute, and no image blends into another:
@Image 1 — Scene「empty train platform with a stationary train and one open doorway」(space topology and light-position baseline, empty set): controls the place, the light mood and the set dressing, and nothing else.
@Image 2 — Character「Jon, an adult Latino man in his thirties」(identity and default-look baseline, actor asset): controls the face, hair, build and presence of the person, and nothing else.
@Image 3 — Product「the uploaded product photo of the full-size commuter bicycle」(single source of truth for shape, proportions, colour, material and finish): controls the product in every beat. Reproduce it exactly and never show a second one or a changed part.
@Image 4 — Prop「the full-size commuter bicycle, rear view」(same physical item, rear form baseline): extends @Image 3 for the rear and the far side in the turning beat only.
@Image 5 — Prop「the full-size commuter bicycle, material macro」(surface micro-texture baseline): controls the surface micro-texture in the close-up beat only.
@Image 6 — Hands「adult hands, short clean nails」(hand anatomy and nail baseline): controls hand anatomy and nails in the close hand beats only.
Keep every image independent so nothing blends: the character (@Image 2) never takes on attributes from the scene (@Image 1) or the product (@Image 3), the scene (@Image 1) never grows product parts, the product (@Image 3, @Image 4) never changes with the camera, and the hands (@Image 6) never pick up clothing or product texture. Any product detail not covered by an image follows @Image 3 and stays consistent with it.
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

### 需生成的资产图提示词（真人实质感规范已内置）

**1）产品背面**（挂载为产品正面后的第 1 张道具） → `/ai-image-generation/folding-bike-commute-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the full-size commuter bicycle with two large wheels, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography. True-to-life material realism: real surface micro-texture with visible material grain and honest finish, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**2）材质特写** → `/ai-image-generation/folding-bike-commute-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the full-size commuter bicycle with two large wheels, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography. True-to-life material realism: real surface micro-texture with visible material grain, weave or machining, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**3）手部特写** → `/ai-image-generation/folding-bike-commute-h1-hands-r1-640.webp`

```
Vertical 9:16 reference photo of adult hands only, short clean nails and natural skin texture, one hand relaxed and open as if about to grip a handlebar, the other hand holding a slim tube, no face, no body, plain seamless light grey background, soft even light, sharp focus on skin and knuckles, no text, no logo, no watermark. True-to-life photographic realism: real skin with visible pores, fine knuckle wrinkles and subtle natural imperfections, shot on a full-frame camera with natural optical falloff, not CGI, not 3D render, no illustration look.
```

**4）场景图**（挂载为第 1 张附件） → `/ai-image-generation/folding-bike-commute-s1-scene-r1-640.webp`

```
Vertical 9:16 scene reference photo of an empty train platform beside a stationary train with one open doorway, yellow safety line on the ground, warm daylight, clean and uncluttered composition, no people, no product, no text, no logos, no watermark. True-to-life photographic realism: real materials with visible surface grain, natural light falloff and believable shadows, shot on a full-frame camera with natural perspective, not CGI, not 3D render, no illustration look.
```

## 2. 耳机盒揭秘（Earbud Box Reveal）

**演员**：无（全片仅手部与产品出镜，手部用生成的参考图锁定）

**附件挂载清单（按上传顺序）**：

| 附件顺序 | 句柄 | 素材文件 | 说明 |
|---:|---|---|---|
| 第 1 张 | @Image 1 场景 | `/ai-image-generation/earbud-box-reveal-s1-scene-r1-640.webp` | 空镜全景，空间与光位基准 |
| 第 2 张 | @Image 2 产品正面 | `客户上传的产品照片` | 道具一致性基准 |
| 第 3 张 | @Image 3 产品背面 | `/ai-image-generation/earbud-box-reveal-a2-back-r1-640.webp` | 同一实物形制基准（背面） |
| 第 4 张 | @Image 4 材质特写 | `/ai-image-generation/earbud-box-reveal-a3-macro-r1-640.webp` | 表面微纹理基准 |
| 第 5 张 | @Image 5 手部 | `/ai-image-generation/earbud-box-reveal-h1-hands-r1-640.webp` | 手部解剖与指甲基准 |

### 视频提示词（@Image 附件顺序引用，人物已对齐演员）

```
A 30-second vertical 9:16 e-commerce product display film for a round matte sage-green charging case in stemless bean-shaped earbuds from a kraft box.

【Reference Order】The model only sees the upload position of each attached image, so every position is defined here once and referenced by its @Image number afterwards. Each image controls only its own attribute, and no image blends into another:
@Image 1 — Scene「wooden table with an open kraft box and cream tissue paper」(space topology and light-position baseline, empty set): controls the place, the light mood and the set dressing, and nothing else.
@Image 2 — Product「the uploaded product photo of the sage-green earbud charging case」(single source of truth for shape, proportions, colour, material and finish): controls the product in every beat. Reproduce it exactly and never show a second one or a changed part.
@Image 3 — Prop「the sage-green earbud charging case, rear view」(same physical item, rear form baseline): extends @Image 2 for the rear and the far side in the turning beat only.
@Image 4 — Prop「the sage-green earbud charging case, material macro」(surface micro-texture baseline): controls the surface micro-texture in the close-up beat only.
@Image 5 — Hands「adult hands, short clean nails」(hand anatomy and nail baseline): controls hand anatomy and nails in the close hand beats only.
Keep every image independent so nothing blends: the scene (@Image 1) never grows product parts, the product (@Image 2) never changes with the camera, and the hands (@Image 5) never pick up product texture or scene materials. Any product detail not covered by an image follows @Image 2 and stays consistent with it.
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

### 需生成的资产图提示词（真人实质感规范已内置）

**1）产品背面**（挂载为产品正面后的第 1 张道具） → `/ai-image-generation/earbud-box-reveal-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the sage-green earbud charging case with earbuds inside, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography. True-to-life material realism: real surface micro-texture with visible material grain and honest finish, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**2）材质特写** → `/ai-image-generation/earbud-box-reveal-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the sage-green earbud charging case with earbuds inside, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography. True-to-life material realism: real surface micro-texture with visible material grain, weave or machining, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**3）手部特写** → `/ai-image-generation/earbud-box-reveal-h1-hands-r1-640.webp`

```
Vertical 9:16 reference photo of adult hands only, short clean nails and natural skin texture, one hand pinching the edge of a tissue sheet as if lifting it from a box, the other hand cupped open below, no face, no body, plain seamless light grey background, soft even light, sharp focus on skin and knuckles, no text, no logo, no watermark. True-to-life photographic realism: real skin with visible pores, fine knuckle wrinkles and subtle natural imperfections, shot on a full-frame camera with natural optical falloff, not CGI, not 3D render, no illustration look.
```

**4）场景图**（挂载为第 1 张附件） → `/ai-image-generation/earbud-box-reveal-s1-scene-r1-640.webp`

```
Vertical 9:16 scene reference photo of a warm wooden table with an open kraft shipping box and soft cream tissue paper spilling over the edge, gentle window light, calm home tabletop mood, no people, no product, no text, no logos, no watermark. True-to-life photographic realism: real cardboard and paper fibre texture, natural light falloff and believable shadows, shot on a full-frame camera with natural perspective, not CGI, not 3D render, no illustration look.
```

## 3. 橄榄绿衬衫搭配合身（Olive Overshirt Fit Reel）

**演员（人物资产，直接取用）**：Dev（`home-1` · Men · 30s）— an adult South Asian man in his thirties

![Dev](https://www.aivideosugc.com/ai-image-generation/actors/home-1.webp)

**附件挂载清单（按上传顺序）**：

| 附件顺序 | 句柄 | 素材文件 | 说明 |
|---:|---|---|---|
| 第 1 张 | @Image 1 场景 | `/ai-image-generation/olive-overshirt-fit-reel-s1-scene-r1-640.webp` | 空镜全景，空间与光位基准 |
| 第 2 张 | @Image 2 角色 | `/ai-image-generation/actors/home-1.webp` | 演员 Dev，人物身份基准 |
| 第 3 张 | @Image 3 产品正面 | `客户上传的产品照片` | 道具一致性基准 |
| 第 4 张 | @Image 4 产品背面 | `/ai-image-generation/olive-overshirt-fit-reel-a2-back-r1-640.webp` | 同一实物形制基准（背面） |
| 第 5 张 | @Image 5 材质特写 | `/ai-image-generation/olive-overshirt-fit-reel-a3-macro-r1-640.webp` | 表面微纹理基准 |
| 第 6 张 | @Image 6 手部 | `/ai-image-generation/olive-overshirt-fit-reel-h1-hands-r1-640.webp` | 手部解剖与指甲基准 |

### 视频提示词（@Image 附件顺序引用，人物已对齐演员）

```
A 30-second vertical 9:16 e-commerce product display film for an olive overshirt in a real room.

【Reference Order】The model only sees the upload position of each attached image, so every position is defined here once and referenced by its @Image number afterwards. Each image controls only its own attribute, and no image blends into another:
@Image 1 — Scene「calm real-life room corner with a wooden bench and window light」(space topology and light-position baseline, empty set): controls the place, the light mood and the set dressing, and nothing else.
@Image 2 — Character「Dev, an adult South Asian man in his thirties」(identity and default-look baseline, actor asset): controls the face, hair, build and presence of the person, and nothing else.
@Image 3 — Product「the uploaded product photo of the olive-green cotton overshirt」(single source of truth for shape, proportions, colour, material and finish): controls the product in every beat. Reproduce it exactly and never show a second one or a changed part.
@Image 4 — Prop「the olive-green cotton overshirt, rear view」(same physical item, rear form baseline): extends @Image 3 for the rear and the far side in the turning beat only.
@Image 5 — Prop「the olive-green cotton overshirt, material macro」(surface micro-texture baseline): controls the surface micro-texture in the close-up beat only.
@Image 6 — Hands「adult hands, short clean nails」(hand anatomy and nail baseline): controls hand anatomy and nails in the close hand beats only.
Keep every image independent so nothing blends: the character (@Image 2) never takes on attributes from the scene (@Image 1) or the product (@Image 3), the scene (@Image 1) never grows product parts, the product (@Image 3, @Image 4) never changes with the camera, and the hands (@Image 6) never pick up clothing or product texture. Any product detail not covered by an image follows @Image 3 and stays consistent with it.
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

### 需生成的资产图提示词（真人实质感规范已内置）

**1）产品背面**（挂载为产品正面后的第 1 张道具） → `/ai-image-generation/olive-overshirt-fit-reel-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the olive-green cotton overshirt, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography. True-to-life material realism: real surface micro-texture with visible material grain and honest finish, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**2）材质特写** → `/ai-image-generation/olive-overshirt-fit-reel-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the olive-green cotton overshirt, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography. True-to-life material realism: real surface micro-texture with visible material grain, weave or machining, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**3）手部特写** → `/ai-image-generation/olive-overshirt-fit-reel-h1-hands-r1-640.webp`

```
Vertical 9:16 reference photo of adult hands only, short clean nails and natural skin texture, one hand pinching a soft cotton fabric edge between thumb and fingers, the other hand flat and open, no face, no body, plain seamless light grey background, soft even light, sharp focus on skin and knuckles, no text, no logo, no watermark. True-to-life photographic realism: real skin with visible pores, fine knuckle wrinkles and subtle natural imperfections, shot on a full-frame camera with natural optical falloff, not CGI, not 3D render, no illustration look.
```

**4）场景图**（挂载为第 1 张附件） → `/ai-image-generation/olive-overshirt-fit-reel-s1-scene-r1-640.webp`

```
Vertical 9:16 scene reference photo of a calm real-life room corner with a neutral wall, a wooden bench and soft window light, everyday home mood, clean and uncluttered, no people, no garments, no text, no logos, no watermark. True-to-life photographic realism: real wall plaster and wood grain texture, natural light falloff and believable shadows, shot on a full-frame camera with natural perspective, not CGI, not 3D render, no illustration look.
```

## 4. 针织毛衣镜（Knit Sweater Mirror）

**演员（人物资产，直接取用）**：Elise（`terrace-1` · Women · 30s）— an adult Latina woman in her thirties with a straight chin-length copper-red bob

![Elise](https://www.aivideosugc.com/ai-image-generation/actors/terrace-1.webp)

**附件挂载清单（按上传顺序）**：

| 附件顺序 | 句柄 | 素材文件 | 说明 |
|---:|---|---|---|
| 第 1 张 | @Image 1 场景 | `/ai-image-generation/knit-sweater-mirror-s1-scene-r1-640.webp` | 空镜全景，空间与光位基准 |
| 第 2 张 | @Image 2 角色 | `/ai-image-generation/actors/terrace-1.webp` | 演员 Elise，人物身份基准 |
| 第 3 张 | @Image 3 产品正面 | `客户上传的产品照片` | 道具一致性基准 |
| 第 4 张 | @Image 4 产品背面 | `/ai-image-generation/knit-sweater-mirror-a2-back-r1-640.webp` | 同一实物形制基准（背面） |
| 第 5 张 | @Image 5 材质特写 | `/ai-image-generation/knit-sweater-mirror-a3-macro-r1-640.webp` | 表面微纹理基准 |
| 第 6 张 | @Image 6 手部 | `/ai-image-generation/knit-sweater-mirror-h1-hands-r1-640.webp` | 手部解剖与指甲基准 |

### 视频提示词（@Image 附件顺序引用，人物已对齐演员）

```
A 30-second vertical 9:16 e-commerce product display film for a cream knit sweater in a mirror.

【Reference Order】The model only sees the upload position of each attached image, so every position is defined here once and referenced by its @Image number afterwards. Each image controls only its own attribute, and no image blends into another:
@Image 1 — Scene「bright bedroom corner with a full-length mirror and neutral bedding」(space topology and light-position baseline, empty set): controls the place, the light mood and the set dressing, and nothing else.
@Image 2 — Character「Elise, an adult Latina woman in her thirties with a straight chin-length copper-red bob」(identity and default-look baseline, actor asset): controls the face, hair, build and presence of the person, and nothing else.
@Image 3 — Product「the uploaded product photo of the cream knit sweater」(single source of truth for shape, proportions, colour, material and finish): controls the product in every beat. Reproduce it exactly and never show a second one or a changed part.
@Image 4 — Prop「the cream knit sweater, rear view」(same physical item, rear form baseline): extends @Image 3 for the rear and the far side in the turning beat only.
@Image 5 — Prop「the cream knit sweater, material macro」(surface micro-texture baseline): controls the surface micro-texture in the close-up beat only.
@Image 6 — Hands「adult hands, short clean nails」(hand anatomy and nail baseline): controls hand anatomy and nails in the close hand beats only.
Keep every image independent so nothing blends: the character (@Image 2) never takes on attributes from the scene (@Image 1) or the product (@Image 3), the scene (@Image 1) never grows product parts, the product (@Image 3, @Image 4) never changes with the camera, and the hands (@Image 6) never pick up clothing or product texture. Any product detail not covered by an image follows @Image 3 and stays consistent with it.
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

### 需生成的资产图提示词（真人实质感规范已内置）

**1）产品背面**（挂载为产品正面后的第 1 张道具） → `/ai-image-generation/knit-sweater-mirror-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the cream knit sweater, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography. True-to-life material realism: real surface micro-texture with visible material grain and honest finish, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**2）材质特写** → `/ai-image-generation/knit-sweater-mirror-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the cream knit sweater, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography. True-to-life material realism: real surface micro-texture with visible material grain, weave or machining, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**3）手部特写** → `/ai-image-generation/knit-sweater-mirror-h1-hands-r1-640.webp`

```
Vertical 9:16 reference photo of adult hands only, short clean nails and natural skin texture, fingers gently holding a soft knitted fabric edge, no face, no body, plain seamless light grey background, soft even light, sharp focus on skin and knuckles, no text, no logo, no watermark. True-to-life photographic realism: real skin with visible pores, fine knuckle wrinkles and subtle natural imperfections, shot on a full-frame camera with natural optical falloff, not CGI, not 3D render, no illustration look.
```

**4）场景图**（挂载为第 1 张附件） → `/ai-image-generation/knit-sweater-mirror-s1-scene-r1-640.webp`

```
Vertical 9:16 scene reference photo of a bright bedroom corner with a full-length mirror and a bed with neutral linen bedding, soft window light, calm morning mood, clean and uncluttered, no people, no garments, no text, no logos, no watermark. True-to-life photographic realism: real fabric weave and wall texture, natural light falloff and believable shadows, shot on a full-frame camera with natural perspective, not CGI, not 3D render, no illustration look.
```
