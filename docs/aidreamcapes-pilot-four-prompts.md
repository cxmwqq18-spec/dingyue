# 试点：四个模板的视频提示词与资产清单

内部工作文档（非页面文案）。所有电商商品展示提示词均指定人物出镜展示操作（站内 AI 演员），手部动作由角色资产带出，不再单独生成手部特写图。每案例挂载 5 张参考图 + 1 条演员音色参考音频。三类资产严格分开：

1. **演员（人物资产）**：直接指定站内 AI 演员；头像取自**线上演员库（LivePage `/ai-actors`，与创建流程「选择一位主持人」弹窗同源）**，音色参考音频从演员库取用，均不生成；
2. **道具图（纯产品，无人物）**：产品背面、材质特写，按提示词生成；
3. **场景图（无人物、无产品）**：现有展示图都含人物，不引用；按提示词生成空场景图。

## 真人实质感规范（所有生成图必须遵守）

- **真实摄影质感**：按全画幅相机实拍标准输出，真实光学虚化与光衰减，透视自然；
- **真实材质**：皮肤可见毛孔、指节细纹与自然瑕疵；面料可见织纹与纤维；硬质材料可见加工纹理与使用痕迹；
- **拒绝渲染感**：not CGI / not 3D render / no illustration look，禁止塑料感、过度平滑、假光影；
- **产品一致**：道具图的形状、颜色、材质必须与产品正面图自洽，供视频提示词跨镜引用。

## 公共资产职责规范（按资产类别，不绑定图片编号）

### 角色资产

每张角色资产图展示同一个人的不同观察角度。仅参考面容、体型、服装和配饰，不继承白底、排版或图中身体投影的数量。保证人物唯一性：每个角色在世界空间中仅有一人。台词音色以 @Audio 1 附件音频为准，全片同一音色，不换人声。

### 场景资产

场景资产图定义地点。仅参考空间结构、光源方向与氛围，作为真实地点使用；镜头在场景内自由取景，不锁死构图。分镜引入产品或人物之前，场景保持空镜。

### 道具资产

所有道具资产图展示同一实物。仅参考形制、材质与颜色，不继承白底背景与排版。产品全程唯一：不增加、不减少、不换色、不变形。

## 引用规范（@Image 附件顺序 + @Audio 音色，通用标准）

模型**只识别附件上传顺序，不识别文件名**，因此引用一律按挂载位置编号（图像与音频各自从 1 连续编号）：

- 视频提示词开头的【Reference Order】块是**固定通用标准**，逐行定义 `@Image 1–5` 的类别与职责（场景=空间光位基准、角色=人物身份基准、产品=唯一道具基准、背面/特写=道具补充）与 `@Audio 1`（角色音色基准）；
- 换模板时只换挂载的文件，规范措辞不变，可直接推广到全部模板；
- 各资产的通用职责与防混用规则见上方「公共资产职责规范」，不在提示词里重复；
- 每个案例给出**附件挂载清单**（第几张 → 哪个文件），操作者按顺序挂载，顺序不能错；产品未覆盖细节一律回退到产品正面图（@Image 3）；
- 【Sound】节的旁白音色统一写「the attached voice reference @Audio 1」，匹配演员音色的音色、语速与口音。

统一生成规格：9:16 竖幅 640×1138 WebP；提示词为英文（模型按英文消费）。

| 案例        | 指定演员             | 音色              | 需生成道具图        | 需生成场景图  | 挂载附件       |
| --------- | ---------------- | --------------- | ------------- | ------- | ---------- |
| 折叠自行车通勤   | Jon（outdoor-2）   | Warm & grounded | 背面 / 特写 共 2 张 | 空场景 1 张 | 5 图 + 1 音频 |
| 耳机盒揭秘     | Mila（indoor-2）   | Calm & clear    | 背面 / 特写 共 2 张 | 空场景 1 张 | 5 图 + 1 音频 |
| 橄榄绿衬衫搭配合身 | Dev（home-1）      | Low & grounded  | 背面 / 特写 共 2 张 | 空场景 1 张 | 5 图 + 1 音频 |
| 针织毛衣镜     | Elise（terrace-1） | Bright & lively | 背面 / 特写 共 2 张 | 空场景 1 张 | 5 图 + 1 音频 |

共需生成 12 张资产图（每案例 3 张：背面、材质特写、空场景）；头像与音色音频随演员直接取用。

## 1. 折叠自行车通勤（Folding Bike Commute）

**演员（人物资产，直接取用）**：Jon（`outdoor-2` · Men · 30s）— an adult Latino man in his thirties

![Jon](https://www.aivideosugc.com/ai-image-generation/actors/ac1-actor-card-outdoor-2-r1-640.webp)

**音频（角色音色参考，@Audio 1）**：Warm & grounded — A warm male voice in a relaxed mid register, with natural phrasing and clear articulation.。文件 `/ai-actors/outdoor-2.mp3`，可直接打开试听：<https://www.aivideosugc.com/ai-actors/outdoor-2.mp3>

**附件挂载清单（按上传顺序）**：

| 附件顺序 | 句柄            | 素材文件                                                               | 说明                             |
| ---: | ------------- | ------------------------------------------------------------------ | ------------------------------ |
|    1 | @Image 1 场景   | `/ai-image-generation/folding-bike-commute-s1-scene-r1-640.webp`   | 空镜全景，空间与光位基准                   |
|    2 | @Image 2 角色   | `/ai-image-generation/actors/ac1-actor-card-outdoor-2-r1-640.webp` | 演员 Jon，人物身份基准（与创建流程头像库一致）      |
|    3 | @Image 3 产品正面 | `客户上传的产品照片`                                                        | 道具一致性基准                        |
|    4 | @Image 4 产品背面 | `/ai-image-generation/folding-bike-commute-a2-back-r1-640.webp`    | 同一实物形制基准（背面）                   |
|    5 | @Image 5 材质特写 | `/ai-image-generation/folding-bike-commute-a3-macro-r1-640.webp`   | 表面微纹理基准                        |
|   音频 | @Audio 1 角色音色 | `/ai-actors/outdoor-2.mp3`                                         | 演员 Jon 台词音色参考（Warm & grounded） |

### 视频提示词（@Image 附件顺序引用，人物与音色已对齐演员）

```
A 30-second vertical 9:16 e-commerce product display film for a full-size bicycle beside a train platform.

【Reference Order】The model only sees the upload position of each attached image, so every position is defined here once and referenced by its @Image number afterwards. This block is a fixed standard: only the attached files change from template to template, the wording stays the same.
@Image 1 — Scene「the attached empty-scene photo」(space, light and mood baseline): the place comes from this image; keep its space and light as the real location and adapt the framing freely to the action.
@Image 2 — Character「the attached actor portrait」(identity and default-look baseline): the person's face, hair, build and presence come from this image and never change.
@Image 3 — Product「the uploaded product photo」(single source of truth for the product): its shape, proportions, colour, material and finish come from this image, reproduced exactly, never a second one and never a changed part.
@Image 4 — Product back「the attached product rear view」(same physical item seen from behind): extends @Image 3 for the rear and the far side in the turning beat only.
@Image 5 — Product macro「the attached material close-up」(surface micro-texture baseline): controls the surface texture in the close-up beat only.
@Audio 1 — Voice「the attached actor voice sample」(voice baseline): the narrator's voice, timbre and pace come from this audio and stay the same for the whole film.
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
【Sound】Voice: the narrator's voice is the attached voice reference @Audio 1; match its timbre, pace and accent, unhurried, five short lines across the film — "A full-size bicycle, beside a train platform" / "The commuter folds it beside a train platform" / "The hands do the work, one movement at a time" / "Two large wheels" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The full-size bicycle stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

### 需生成的资产图提示词（真人实质感规范已内置）

**1）产品背面** → `/ai-image-generation/folding-bike-commute-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the full-size commuter bicycle with two large wheels, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography. True-to-life material realism: real surface micro-texture with visible material grain and honest finish, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**2）材质特写** → `/ai-image-generation/folding-bike-commute-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the full-size commuter bicycle with two large wheels, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography. True-to-life material realism: real surface micro-texture with visible material grain, weave or machining, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**3）场景图**（挂载为第 1 张附件） → `/ai-image-generation/folding-bike-commute-s1-scene-r1-640.webp`

```
Vertical 9:16 scene reference photo of an empty train platform beside a stationary train with one open doorway, yellow safety line on the ground, warm daylight, clean and uncluttered composition, no people, no product, no text, no logos, no watermark. True-to-life photographic realism: real materials with visible surface grain, natural light falloff and believable shadows, shot on a full-frame camera with natural perspective, not CGI, not 3D render, no illustration look.
```

## 2. 耳机盒揭秘（Earbud Box Reveal）

**演员（人物资产，直接取用）**：Mila（`indoor-2` · Women · 30s）— an adult white woman in her thirties

![Mila](https://www.aivideosugc.com/ai-image-generation/actors/ac1-actor-card-indoor-2-r1-640.webp)

**音频（角色音色参考，@Audio 1）**：Calm & clear — A calm, thoughtful female voice with a slower pace and clear articulation.。文件 `/ai-actors/indoor-2.mp3`，可直接打开试听：<https://www.aivideosugc.com/ai-actors/indoor-2.mp3>


**附件挂载清单（按上传顺序）**：

| 附件顺序 | 句柄            | 素材文件                                                              | 说明                           |
| ---: | ------------- | ----------------------------------------------------------------- | ---------------------------- |
|    1 | @Image 1 场景   | `/ai-image-generation/earbud-box-reveal-s1-scene-r1-640.webp`     | 空镜全景，空间与光位基准                 |
|    2 | @Image 2 角色   | `/ai-image-generation/actors/ac1-actor-card-indoor-2-r1-640.webp` | 演员 Mila，人物身份基准（与创建流程头像库一致）   |
|    3 | @Image 3 产品正面 | `客户上传的产品照片`                                                       | 道具一致性基准                      |
|    4 | @Image 4 产品背面 | `/ai-image-generation/earbud-box-reveal-a2-back-r1-640.webp`      | 同一实物形制基准（背面）                 |
|    5 | @Image 5 材质特写 | `/ai-image-generation/earbud-box-reveal-a3-macro-r1-640.webp`     | 表面微纹理基准                      |
|   音频 | @Audio 1 角色音色 | `/ai-actors/indoor-2.mp3`                                         | 演员 Mila 台词音色参考（Calm & clear） |

### 视频提示词（@Image 附件顺序引用，人物与音色已对齐演员）

```
A 30-second vertical 9:16 e-commerce product display film in which the creator presents a round matte sage-green charging case in stemless bean-shaped earbuds from a kraft box.

【Reference Order】The model only sees the upload position of each attached image, so every position is defined here once and referenced by its @Image number afterwards. This block is a fixed standard: only the attached files change from template to template, the wording stays the same.
@Image 1 — Scene「the attached empty-scene photo」(space, light and mood baseline): the place comes from this image; keep its space and light as the real location and adapt the framing freely to the action.
@Image 2 — Character「the attached actor portrait」(identity and default-look baseline): the person's face, hair, build and presence come from this image and never change.
@Image 3 — Product「the uploaded product photo」(single source of truth for the product): its shape, proportions, colour, material and finish come from this image, reproduced exactly, never a second one and never a changed part.
@Image 4 — Product back「the attached product rear view」(same physical item seen from behind): extends @Image 3 for the rear and the far side in the turning beat only.
@Image 5 — Product macro「the attached material close-up」(surface micro-texture baseline): controls the surface texture in the close-up beat only.
@Audio 1 — Voice「the attached actor voice sample」(voice baseline): the narrator's voice, timbre and pace come from this audio and stay the same for the whole film.
【Overall Style】E-commerce product display style, warm lifestyle tone, natural colour, the product clearly separated from the background. Information first: every beat adds a new angle or a new piece of the action. Soft product light from one large source at the left, one warm bounce from the right, a gentle shadow under the product, no hard strobe.
【Product Lock】The round matte sage-green charging case keeps the same shape, colour, material, finish and details in every frame, including the round case centered; nothing is added, removed or recoloured and the quantity never changes.
【Action Logic】One real action, followed from start to finish in one place, with the product never leaving the frame. Each beat is a step of that action, and no beat invents a different event, a different place or a second product.
【0.0-5.0s | Wide display】Wide shot at eye level: the round matte sage-green charging case is set in place in stemless bean-shaped earbuds from a kraft box, the whole shape readable against the background. Camera pushes in slowly from 35mm to 50mm, and the lines of the place keep their screen direction.
【5.0-11.0s | Front close-up】The front of the round matte sage-green charging case fills the frame, the whole silhouette readable, and the light rakes across the surface so the material reads instead of being described. Camera arcs gently. Visible here: the round case centered.
【11.0-17.0s | Hand turns it】The creator, an adult white woman in her thirties, reaches in from the top and lifts the round matte sage-green charging case a little and turns it so the back and the far side come into view, then turns it back to the front. The grip stays relaxed and anatomically correct, and the product never leaves the frame.
【17.0-23.0s | The action】The creator holds the round matte sage-green charging case in stemless bean-shaped earbuds from a kraft box. Camera follows the hands closely with one small reframe and no cut, so the action reads as one movement.
【23.0-27.5s | Point held】The result of that action is held still in the frame: the same round matte sage-green charging case, now in the state the action produced. The point is shown rather than claimed — no superimposed words, no price, no badge.
【27.5-30.0s | Closing hold】The product returns to a full front view, centred and complete. Camera locks off, and the last frame matches the first frame.
【Camera】Controlled movement only: one slow push in, one gentle arc, one close follow and one locked hold, all keeping the same light direction and screen direction.
【Sound】Voice: the narrator's voice is the attached voice reference @Audio 1; match its timbre, pace and accent, unhurried, five short lines across the film — "A round matte sage-green charging case, in stemless bean-shaped earbuds from a kraft box" / "The creator holds it in stemless bean-shaped earbuds from a kraft box" / "The hands do the work, one movement at a time" / "The round case centered" / "One action, start to finish". Effects: the handling…
【Continuity】The product stays identical from the first to the last frame, the hands keep correct anatomy, and the same light and screen direction carry between beats. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

### 需生成的资产图提示词（真人实质感规范已内置）

**1）产品背面** → `/ai-image-generation/earbud-box-reveal-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the sage-green earbud charging case with earbuds inside, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography. True-to-life material realism: real surface micro-texture with visible material grain and honest finish, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**2）材质特写** → `/ai-image-generation/earbud-box-reveal-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the sage-green earbud charging case with earbuds inside, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography. True-to-life material realism: real surface micro-texture with visible material grain, weave or machining, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**3）场景图**（挂载为第 1 张附件） → `/ai-image-generation/earbud-box-reveal-s1-scene-r1-640.webp`

```
Vertical 9:16 scene reference photo of a warm wooden table with an open kraft shipping box and soft cream tissue paper spilling over the edge, gentle window light, calm home tabletop mood, no people, no product, no text, no logos, no watermark. True-to-life photographic realism: real cardboard and paper fibre texture, natural light falloff and believable shadows, shot on a full-frame camera with natural perspective, not CGI, not 3D render, no illustration look.
```

## 3. 橄榄绿衬衫搭配合身（Olive Overshirt Fit Reel）

**演员（人物资产，直接取用）**：Dev（`home-1` · Men · 30s）— an adult South Asian man in his thirties

![Dev](https://www.aivideosugc.com/ai-image-generation/actors/ac1-actor-card-home-1-r1-640.webp)

**音频（角色音色参考，@Audio 1）**：Low & grounded — An adult male voice with a natural, trustworthy tone, a medium-low register, measured pacing and clear articulation.。文件 `/ai-actors/home-1.mp3`，可直接打开试听：<https://www.aivideosugc.com/ai-actors/home-1.mp3>

**附件挂载清单（按上传顺序）**：

| 附件顺序 | 句柄            | 素材文件                                                                 | 说明                            |
| ---: | ------------- | -------------------------------------------------------------------- | ----------------------------- |
|    1 | @Image 1 场景   | `/ai-image-generation/olive-overshirt-fit-reel-s1-scene-r1-640.webp` | 空镜全景，空间与光位基准                  |
|    2 | @Image 2 角色   | `/ai-image-generation/actors/ac1-actor-card-home-1-r1-640.webp`      | 演员 Dev，人物身份基准（与创建流程头像库一致）     |
|    3 | @Image 3 产品正面 | `客户上传的产品照片`                                                          | 道具一致性基准                       |
|    4 | @Image 4 产品背面 | `/ai-image-generation/olive-overshirt-fit-reel-a2-back-r1-640.webp`  | 同一实物形制基准（背面）                  |
|    5 | @Image 5 材质特写 | `/ai-image-generation/olive-overshirt-fit-reel-a3-macro-r1-640.webp` | 表面微纹理基准                       |
|   音频 | @Audio 1 角色音色 | `/ai-actors/home-1.mp3`                                              | 演员 Dev 台词音色参考（Low & grounded） |

### 视频提示词（@Image 附件顺序引用，人物与音色已对齐演员）

```
A 30-second vertical 9:16 e-commerce product display film for an olive overshirt in a real room.

【Reference Order】The model only sees the upload position of each attached image, so every position is defined here once and referenced by its @Image number afterwards. This block is a fixed standard: only the attached files change from template to template, the wording stays the same.
@Image 1 — Scene「the attached empty-scene photo」(space, light and mood baseline): the place comes from this image; keep its space and light as the real location and adapt the framing freely to the action.
@Image 2 — Character「the attached actor portrait」(identity and default-look baseline): the person's face, hair, build and presence come from this image and never change.
@Image 3 — Product「the uploaded product photo」(single source of truth for the product): its shape, proportions, colour, material and finish come from this image, reproduced exactly, never a second one and never a changed part.
@Image 4 — Product back「the attached product rear view」(same physical item seen from behind): extends @Image 3 for the rear and the far side in the turning beat only.
@Image 5 — Product macro「the attached material close-up」(surface micro-texture baseline): controls the surface texture in the close-up beat only.
@Audio 1 — Voice「the attached actor voice sample」(voice baseline): the narrator's voice, timbre and pace come from this audio and stay the same for the whole film.
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
【Sound】Voice: the narrator's voice is the attached voice reference @Audio 1; match its timbre, pace and accent, unhurried, five short lines across the film — "An olive overshirt, in a real room" / "The model presents it in a real room" / "The hands do the work, one movement at a time" / "The full front" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The olive overshirt stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```


### 需生成的资产图提示词（真人实质感规范已内置）

**1）产品背面** → `/ai-image-generation/olive-overshirt-fit-reel-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the olive-green cotton overshirt, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography. True-to-life material realism: real surface micro-texture with visible material grain and honest finish, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**2）材质特写** → `/ai-image-generation/olive-overshirt-fit-reel-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the olive-green cotton overshirt, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography. True-to-life material realism: real surface micro-texture with visible material grain, weave or machining, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**3）场景图**（挂载为第 1 张附件） → `/ai-image-generation/olive-overshirt-fit-reel-s1-scene-r1-640.webp`

```
Vertical 9:16 scene reference photo of a calm real-life room corner with a neutral wall, a wooden bench and soft window light, everyday home mood, clean and uncluttered, no people, no garments, no text, no logos, no watermark. True-to-life photographic realism: real wall plaster and wood grain texture, natural light falloff and believable shadows, shot on a full-frame camera with natural perspective, not CGI, not 3D render, no illustration look.
```

## 4. 针织毛衣镜（Knit Sweater Mirror）

**演员（人物资产，直接取用）**：Elise（`terrace-1` · Women · 30s）— an adult Latina woman in her thirties with a straight chin-length copper-red bob

![Elise](https://www.aivideosugc.com/ai-image-generation/actors/ac1-actor-card-terrace-1-r3-640.webp)

**音频（角色音色参考，@Audio 1）**：Bright & lively — A bright, lively female voice with a medium-fast pace and expressive intonation.。文件 `/ai-actors/terrace-1.mp3`，可直接打开试听：<https://www.aivideosugc.com/ai-actors/terrace-1.mp3>

**附件挂载清单（按上传顺序）**：

| 附件顺序 | 句柄            | 素材文件                                                               | 说明                               |
| ---: | ------------- | ------------------------------------------------------------------ | -------------------------------- |
|    1 | @Image 1 场景   | `/ai-image-generation/knit-sweater-mirror-s1-scene-r1-640.webp`    | 空镜全景，空间与光位基准                     |
|    2 | @Image 2 角色   | `/ai-image-generation/actors/ac1-actor-card-terrace-1-r3-640.webp` | 演员 Elise，人物身份基准（与创建流程头像库一致）      |
|    3 | @Image 3 产品正面 | `客户上传的产品照片`                                                        | 道具一致性基准                          |
|    4 | @Image 4 产品背面 | `/ai-image-generation/knit-sweater-mirror-a2-back-r1-640.webp`     | 同一实物形制基准（背面）                     |
|    5 | @Image 5 材质特写 | `/ai-image-generation/knit-sweater-mirror-a3-macro-r1-640.webp`    | 表面微纹理基准                          |
|   音频 | @Audio 1 角色音色 | `/ai-actors/terrace-1.mp3`                                         | 演员 Elise 台词音色参考（Bright & lively） |

### 视频提示词（@Image 附件顺序引用，人物与音色已对齐演员）

```
A 30-second vertical 9:16 e-commerce product display film for a cream knit sweater in a mirror.

【Reference Order】The model only sees the upload position of each attached image, so every position is defined here once and referenced by its @Image number afterwards. This block is a fixed standard: only the attached files change from template to template, the wording stays the same.
@Image 1 — Scene「the attached empty-scene photo」(space, light and mood baseline): the place comes from this image; keep its space and light as the real location and adapt the framing freely to the action.
@Image 2 — Character「the attached actor portrait」(identity and default-look baseline): the person's face, hair, build and presence come from this image and never change.
@Image 3 — Product「the uploaded product photo」(single source of truth for the product): its shape, proportions, colour, material and finish come from this image, reproduced exactly, never a second one and never a changed part.
@Image 4 — Product back「the attached product rear view」(same physical item seen from behind): extends @Image 3 for the rear and the far side in the turning beat only.
@Image 5 — Product macro「the attached material close-up」(surface micro-texture baseline): controls the surface texture in the close-up beat only.
@Audio 1 — Voice「the attached actor voice sample」(voice baseline): the narrator's voice, timbre and pace come from this audio and stay the same for the whole film.
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
【Sound】Voice: the narrator's voice is the attached voice reference @Audio 1; match its timbre, pace and accent, unhurried, five short lines across the film — "A cream knit sweater, in a mirror" / "The woman adjusts it in a mirror" / "The hands do the work, one movement at a time" / "The full garment visible" / "One action, start to finish". Effects: the handling sounds of the product, one surface rustle, the room tone. BGM: a light modern retail bed, low, instrumental, no vocals.
【Continuity】The cream knit sweater stays identical from the first frame to the last, the hands keep correct anatomy, and the same light and screen direction carry between beats, so nothing teleports. Final frame: the product centred and unchanged from the first frame.
【Negative】no readable text, numbers, signs or labels anywhere in the frame; no logos, brand marks or watermark; no extra or swapped product and no changed parts; no distorted hands or warped anatomy; no flicker, colour shift or shape drift of the product; no price, discount badge or promotional graphic; no slow motion, no speed ramp, no lens flare.
```

### 需生成的资产图提示词（真人实质感规范已内置）

**1）产品背面** → `/ai-image-generation/knit-sweater-mirror-a2-back-r1-640.webp`

```
Vertical 9:16 studio product reference photo of the cream knit sweater, back and side view, the whole item visible and centred, plain seamless light grey background, soft even light with one gentle shadow, sharp focus, no text, no logo, no watermark, no props, photorealistic commercial product photography. True-to-life material realism: real surface micro-texture with visible material grain and honest finish, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**2）材质特写** → `/ai-image-generation/knit-sweater-mirror-a3-macro-r1-640.webp`

```
Vertical 9:16 macro detail photo of the cream knit sweater, close crop on the surface and construction, raking soft light describing the texture, shallow depth of field, plain background, no text, no logo, no watermark, photorealistic macro product photography. True-to-life material realism: real surface micro-texture with visible material grain, weave or machining, natural optical falloff, not CGI, not 3D render, no illustration look.
```

**3）场景图**（挂载为第 1 张附件） → `/ai-image-generation/knit-sweater-mirror-s1-scene-r1-640.webp`

```
Vertical 9:16 scene reference photo of a bright bedroom corner with a full-length mirror and a bed with neutral linen bedding, soft window light, calm morning mood, clean and uncluttered, no people, no garments, no text, no logos, no watermark. True-to-life photographic realism: real fabric weave and wall texture, natural light falloff and believable shadows, shot on a full-frame camera with natural perspective, not CGI, not 3D render, no illustration look.
```
