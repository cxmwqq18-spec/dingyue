# SmartPickLid Grok Video 参考图生成异常排查材料

整理时间：2026-07-21 20:43 CST (+0800)

## 1. 问题摘要

我们在调用 SmartPickLid 的 Grok Video 接口做 image-to-video 时，接口返回 `succeeded`，并且可以下载到 MP4，但生成内容和上传参考图、提示词完全无关。

预期结果：使用上传的猫图作为首帧/参考图，生成“小猫从包里跳出来，走两步，然后做后空翻”的视频。

实际结果：返回的是湖泊、山景、日出类视频，没有猫、背包、街景，也没有执行用户 prompt 里的动作。

同一张参考图在 2026-07-17 通过 SmartPickLid Grok Video 生成过正确的猫相关视频；2026-07-21 同图、同类 prompt 再次调用时变成无关湖景视频。因此怀疑 SmartPickLid 侧近期模型路由、字段映射、参考图转发或 fallback 逻辑发生异常。

## 2. 上游接口

SmartPickLid 文档地址：

https://api.smartpicklid.com/docs/

本次涉及接口：

```text
POST https://api.smartpicklid.com/v1/videos
GET  https://api.smartpicklid.com/v1/videos/{taskId}
GET  https://api.smartpicklid.com/v1/videos/{taskId}/content
```

请求头：

```text
Authorization: Bearer <redacted>
Content-Type: application/json
```

或 multipart 请求：

```text
Authorization: Bearer <redacted>
Content-Type: multipart/form-data; boundary=<auto>
```

说明：API Key、完整 base64 图片内容、内部下载 URL 已脱敏。参考图实际已作为 `image` data URI 或 `input_reference` 文件随请求发送。

## 3. 业务入参

站点：

```text
siteId: site_dreamshoot
aiApp: Image to Video
aiAppSlug: video_generator
flowName: Image to Video
routeKey: local.video.grok
provider: SmartPickLid Grok Video
```

用户输入：

```text
promptNote: 根据上传的图片，生成小猫咪从包里跳出来，走两步然后做一个后空翻的动作的视频
videoInputMode: image_to_video
videoThemeName: Prompt Directed Motion
durationSeconds: 10
aspectRatio: 16:9
resolution: 720p
outputType: video
selectedCreditCost: 39
```

参考素材：

```text
assetId: asset_mromnkes_4xms3y
mimeType: image/webp
role: input
visibility: private
createdAt: 2026-07-17T07:39:32.502Z
source image description: 猫在黄色背包里，背景是街景和车辆
```

Worker 处理后的供应商参考图信息：

```text
referenceFrameCount: 1
requestedReferenceFrameCount: 1
providerReferenceSize: 1280x720
providerReferenceLimit: 20
```

## 4. 测试 A：JSON image data URI 路径

我们的 job 信息：

```text
jobId: job_mruhnjla_3c4549
requestId: req_job_mruhnjla_3c4549
createdAt: 2026-07-21T10:06:10.417Z UTC
createdAt CST: 2026-07-21 18:06:10
status in our system: succeeded
providerTrace: SmartPickLid Grok Video, attempts=1
output mimeType: video/mp4
output storageKey: sites/site_dreamshoot/customers/cust_dreamshoot_mqq9gas9_i1vjal/assets/job_mruhnjla_3c4549-video-1.mp4
```

实际调用：

```text
POST https://api.smartpicklid.com/v1/videos
Content-Type: application/json
```

脱敏后的请求体：

```json
{
  "model": "grok-imagine-video",
  "prompt": "Image-to-video task: create exactly one 10-second realistic MP4 at 16:9 720P.\n\nThe uploaded images are the source of truth. The video must feature the same uploaded subject, pet, person, product, prop, and scene facts, not a newly cast subject and not an unrelated location or crowd scene.\n\nReference requirement: keep the uploaded subject, pet, person, product, or prop as the main visible subject.\n\nReference image count: 1. Use every uploaded reference image as a mandatory visual source.\nReference image 1: assetId=asset_mromnkes_4xms3y; Character A. Preserve this uploaded subject's face shape, hair, skin tone, apparent age range, wardrobe cues, and visual identity.\n\nCustomer direction, highest priority: 根据上传的图片，生成小猫咪从包里跳出来，走两步然后做一个后空翻的动作的视频\n\nUse the uploaded image as the opening visual anchor. Keep the camera focused on that uploaded subject and the requested action.\n\nMake the action continuous and natural. Preserve recognizable fur, face, body shape, wardrobe or object cues, props, background cues, and lighting continuity throughout.\n\nReturn only one clean video clip: no captions, no UI, no watermark, no split screen, no collage, no storyboard panels.",
  "seconds": "10",
  "aspect_ratio": "16:9",
  "resolution": "720P",
  "image": "data:image/jpeg;base64,<redacted: prepared 1280x720 reference image from asset_mromnkes_4xms3y>"
}
```

说明：

- 该请求只传了 `image`，没有同时传 `images`。
- `image` 是完整 data URI，不是远程 URL。
- 请求成功，轮询成功，下载到 MP4。
- 但生成视频和 `image`、`prompt` 无关，实际为湖泊/山景/日出画面。

## 5. 测试 B：multipart input_reference 路径

我们的 job 信息：

```text
jobId: job_mruib4dl_e88831
requestId: req_job_mruib4dl_e88831
createdAt: 2026-07-21T10:24:30.443Z UTC
createdAt CST: 2026-07-21 18:24:30
status in our system: succeeded
providerTrace: SmartPickLid Grok Video, attempts=1
output mimeType: video/mp4
output storageKey: sites/site_dreamshoot/customers/cust_dreamshoot_mqq9gas9_i1vjal/assets/job_mruib4dl_e88831-video-1.mp4
```

实际调用：

```text
POST https://api.smartpicklid.com/v1/videos
Content-Type: multipart/form-data
```

等价 curl 结构如下：

```bash
curl -X POST "https://api.smartpicklid.com/v1/videos" \
  -H "Authorization: Bearer <redacted>" \
  -F "model=grok-video-3-pro" \
  -F "prompt=<see prompt below>" \
  -F "seconds=10" \
  -F "aspect_ratio=16:9" \
  -F "resolution=720P" \
  -F "input_reference=@input-reference-1-asset_mromnkes_4xms3y.jpg;type=image/jpeg"
```

其中 `input_reference` 文件由原始 `image/webp` 参考图处理成 `1280x720 image/jpeg` 后上传。文件名格式：

```text
input-reference-1-asset_mromnkes_4xms3y.jpg
```

发送给供应商的 prompt 摘要：

```text
Create one polished realistic image-to-video MP4 from the supplied frame image.
User direction: 根据上传的图片，生成小猫咪从包里跳出来，走两步然后做一个后空翻的动作的视频
Use 1 ordered frame image as visual anchors:
Frame 1: assetId=asset_mromnkes_4xms3y. Use as the opening frame anchor.
Use the uploaded first frame as a visual anchor, not as a frozen still or slideshow source.
Animate a complete continuous motion sequence with visible subject movement...
Return one polished video clip with no text overlay, no watermark, and no UI.
```

说明：

- 该请求没有用 JSON 的 `image/images` 字段，而是按 multipart 方式上传 `input_reference`。
- 请求成功，轮询成功，下载到 MP4。
- 但生成视频仍然和参考图、prompt 无关，实际仍为湖泊/山景/日出画面。

## 6. 历史对比

以下历史 job 使用同一张参考图 `asset_mromnkes_4xms3y`，供应商同样是 SmartPickLid Grok Video，2026-07-17 可以正常生成猫相关视频：

```text
jobId: job_mroteu7d_440e19
createdAt: 2026-07-17T10:48:42.606Z UTC
promptNote: 根据给你的一张图片，生成小猫从包里跳出来的视频
providerTrace: SmartPickLid Grok Video, attempts=1
status: succeeded
observed result: 猫相关视频，符合参考图
```

```text
jobId: job_mrou1atc_03f5fa
createdAt: 2026-07-17T11:06:10.564Z UTC
promptNote: 根据上传的图片，生成一个视频，视频描述如下：小猫咪从书包里跳到地上，做出两个后空翻的动作，并且比了个✌️的的动作
providerTrace: SmartPickLid Grok Video, attempts=1
status: succeeded
observed result: 猫相关视频，符合参考图
```

```text
jobId: job_mrp3eofc_df50f1
createdAt: 2026-07-17T15:28:31.274Z UTC
promptNote: Use the uploaded cat frame as the visual reference. Create a gentle realistic video where the cat steps out of the backpack, turns toward the camera, and blinks naturally.
providerTrace: SmartPickLid Grok Video, attempts=1
status: succeeded
observed result: 猫相关视频，符合参考图
```

2026-07-21 开始，同一张参考图、同类 prompt 出现异常：

```text
jobId: job_mru3jlfp_23ffb4
createdAt: 2026-07-21T03:31:11.560Z UTC
promptNote: 根据上传的图片，生成小猫咪从包里跳出来，走两步然后做一个后空翻的动作的视频
providerTrace: SmartPickLid Grok Video, attempts=1
status: succeeded
observed result: 湖泊/山景/日出视频，和参考图及 prompt 无关
```

## 7. 我们希望上游协助确认的问题

请 SmartPickLid 协助按我们的账号日志检查上述时间窗口内的 `/v1/videos` 请求：

1. `grok-imagine-video` 的 JSON 请求中，`image: data:image/jpeg;base64,...` 是否被服务端正确接收并传递给实际 Grok Video 上游？
2. `grok-video-3-pro` 的 multipart 请求中，`input_reference` 文件是否被服务端正确接收并传递给实际 Grok Video 上游？
3. `prompt` 字段是否被完整使用？是否存在字段名变更、模型路由变更、prompt 被覆盖、或 fallback 到默认 prompt/示例视频的情况？
4. 当参考图处理失败时，SmartPickLid 是否仍返回 `succeeded` 并返回默认湖景视频？如果是，希望返回明确的 error，而不是成功状态。
5. `seconds` 字段在 JSON 中是否必须为 number，而不是 string？当前实际请求为 `"seconds": "10"`；multipart form 中字段天然是字符串。
6. 2026-07-17 到 2026-07-21 之间，`/v1/videos`、`grok-imagine-video`、`grok-video-3-pro` 或参考图转发链路是否有发布、路由或字段兼容性调整？

## 8. 上游网关更新后的复测

上游反馈 2026-07-21 已更新线上 API 容器，并说明 `grok-imagine-video` 应使用 `application/json`，单图只传 `image`，多图只传 `images`，不要使用 multipart / `input_reference`，也不要混用 `image`、`images`、`reference_images`。

我们按该说明重新测试，结论是：冲突字段校验已生效，但合法的单字段 JSON 请求仍然生成了和参考图、prompt 无关的视频。

### 8.1 协议类型确认：seconds 必须是 string

测试请求：

```json
{
  "model": "grok-imagine-video",
  "prompt": "<same cat prompt>",
  "seconds": 10,
  "aspect_ratio": "16:9",
  "resolution": "720P",
  "image": "data:image/webp;base64,<redacted>"
}
```

返回：

```json
{
  "code": "invalid_json",
  "message": "json: cannot unmarshal number into Go struct field .Alias.seconds of type string",
  "data": null
}
```

说明：该 400 响应没有创建有效生成任务。后续复测均改为 `"seconds": "10"`。

### 8.2 复测 C：单字段 image，WebP data URI

```text
submittedAt: 2026-07-21T14:18:17.810Z UTC
endpoint: POST https://api.smartpicklid.com/v1/videos
model: grok-imagine-video
reference field: image only
image mime: image/webp
image bytes: 176648
seconds: "10"
aspect_ratio: 16:9
resolution: 720P
provider task id: task_GrGdstVDc25D1t6RPc2ZTnJt5A2ar6i3
status: completed
video_url returned by provider: https://r2.geeknow.top/magic/videos/518/task_yYDJALBj6BUWGrFkrKZn4gjB2KOQ1pTH.mp4
observed result: 海边灯塔/日落视频，无猫、无背包、无用户指定动作
```

脱敏请求体结构：

```json
{
  "model": "grok-imagine-video",
  "prompt": "Image-to-video task: create exactly one 10-second realistic MP4 at 16:9 720P... Customer direction, highest priority: 根据上传的图片，生成小猫咪从包里跳出来，走两步然后做一个后空翻的动作的视频 ...",
  "seconds": "10",
  "aspect_ratio": "16:9",
  "resolution": "720P",
  "image": "data:image/webp;base64,<redacted>"
}
```

### 8.3 复测 D：单字段 image，PNG data URI

为排除 WebP 格式被上游静默忽略的可能，我们将同一张参考图转换为 PNG 后再次提交。

```text
submittedAt: 2026-07-21T14:39:16.400Z UTC
endpoint: POST https://api.smartpicklid.com/v1/videos
model: grok-imagine-video
reference field: image only
image mime: image/png
image bytes: 2553917
seconds: "10"
aspect_ratio: 16:9
resolution: 720P
provider task id: task_a6mQZxsanfatSpfthJGE8vMEpbOi5GD2
status: completed
video_url returned by provider: https://r2.geeknow.top/magic/videos/518/task_Wb9QdIEpu2ilGMJk8tOuKSOkhcPz6iRW.mp4
observed result: 秋天树林道路视频，无猫、无背包、无用户指定动作
```

脱敏请求体结构：

```json
{
  "model": "grok-imagine-video",
  "prompt": "Image-to-video task: create exactly one 10-second realistic MP4 at 16:9 720P... Customer direction, highest priority: 根据上传的图片，生成小猫咪从包里跳出来，走两步然后做一个后空翻的动作的视频 ...",
  "seconds": "10",
  "aspect_ratio": "16:9",
  "resolution": "720P",
  "image": "data:image/png;base64,<redacted>"
}
```

### 8.4 复测结论

请上游重点检查这两个有效 task：

```text
task_GrGdstVDc25D1t6RPc2ZTnJt5A2ar6i3
task_a6mQZxsanfatSpfthJGE8vMEpbOi5GD2
```

它们都满足新的单字段 JSON 要求，没有混用 `image`、`images`、`reference_images`，也没有使用 multipart / `input_reference`。但是结果仍然完全没有使用参考图和 prompt，疑似 SmartPickLid 网关到实际 Grok Video 上游之间仍存在参考图或 prompt 丢失、被覆盖、模型 fallback、或默认素材兜底的问题。

## 9. 2026-07-22 再次复测

2026-07-22 22:47 CST 左右，我们再次按上游推荐的单字段 JSON 协议复测。

```text
submittedAt: 2026-07-22T14:47:17.754Z UTC
endpoint: POST https://api.smartpicklid.com/v1/videos
model: grok-imagine-video
reference field: image only
image mime: image/png
image bytes: 2553917
seconds: "10"
aspect_ratio: 16:9
resolution: 720P
provider task id: task_W7qPuqkMQwGc3y5jK44kaNr2GKav1HCY
provider internal video url: https://r2.geeknow.top/magic/videos/518/task_f2SHwaQmS3B8Ac5U0qy5yi6Fa714PsG9.mp4
status: completed
downloaded bytes: 28809683
sha256: 71c3b8e35a74315bf10a757d91ab5266ecf62f857c2c8cc960dac94c38c22a8c
```

结果：仍然不是猫图相关视频。并且该视频 SHA256 与 2026-07-21 的 PNG 复测坏样本 `task_a6mQZxsanfatSpfthJGE8vMEpbOi5GD2` 完全一致，说明上游再次返回了同一个默认/兜底视频。

该请求仍然满足：

```text
application/json
只传 image
未传 images
未传 reference_images
未使用 multipart
未使用 input_reference
```

请上游继续重点检查：

```text
task_W7qPuqkMQwGc3y5jK44kaNr2GKav1HCY
```

## 10. 2026-07-23 两个 Grok Video 通道复测

2026-07-23 11:43-12:00 CST，我们对后台配置的两个 Grok Video 通道做了供应商直连复测：

```text
SmartPickLid Grok Video
baseUrl: https://api.smartpicklid.com
model: grok-imagine-video
gateway status: /api/status 200

Magic666 Grok Video
baseUrl: https://magic666.top
model: grok-imagine-video
gateway status: /api/status 200
```

复测使用同一张参考图：

```text
assetId: asset_mromnkes_4xms3y
image mime: image/png
image bytes: 2553917
image content: 黄色背包里的猫，背景是夜间街景和车辆
```

复测 prompt 仍然要求：

```text
根据上传的图片，生成小猫咪从包里跳出来，走两步然后做一个后空翻的动作的视频
```

### 10.1 SmartPickLid：单字段 image

```text
submittedAt: 2026-07-23T03:43:50.153Z UTC
endpoint: POST https://api.smartpicklid.com/v1/videos
field: image
task id: task_IbkBHN9a6o6LLRSLP06ztWrKAiuABzNM
status: completed
video url: https://r2.geeknow.top/magic/videos/518/task_bBufq8oX6BLETpM8GS0qndaPOMwfLwAq.mp4
downloaded bytes: 28809683
sha256: 71c3b8e35a74315bf10a757d91ab5266ecf62f857c2c8cc960dac94c38c22a8c
observed result: 与 2026-07-21/2026-07-22 的 PNG 坏样本完全相同，仍为无关秋天树林道路/兜底视频
```

### 10.2 SmartPickLid：单图 images 数组

```text
submittedAt: 2026-07-23T03:59:25.594Z UTC
endpoint: POST https://api.smartpicklid.com/v1/videos
field: images
task id: task_32QPNKwdnUob12M4y7SrcovCVZnfzP6I
status: completed
video url: https://r2.geeknow.top/magic/videos/518/task_Pc67ANdQL62TeGvLLfccTCyQCHrJCgLL.mp4
downloaded bytes: 6159576
sha256: f2b51832fb8ab18e5ea0b817ef46688fa51cf6040f67d7bfc0efad6641dd7eff
observed result: 湖泊/山景/日出视频，无猫、无黄色背包、无街景、无指定动作
```

### 10.3 Magic666：单字段 image

```text
submittedAt: 2026-07-23T03:44:23.541Z UTC
endpoint: POST https://magic666.top/v1/videos
field: image
task id: task_3uCJ0mcOaHJgdy94wiM7ocw8oHt2aQVe
status: completed
video url: https://r2.geeknow.top/magic/videos/518/task_3uCJ0mcOaHJgdy94wiM7ocw8oHt2aQVe.mp4
downloaded bytes: 5353165
sha256: 8ec917b8ef4a3142f2f1e09feffd9522b6a271ffab062d6499b0989babe2b2b9
observed result: 室内窗台灰猫视频；有“猫”语义，但不是上传的猫，没有黄色背包，没有街景，未遵循参考图视觉信息
```

### 10.4 Magic666：单图 images 数组

```text
submittedAt: 2026-07-23T03:59:53.471Z UTC
endpoint: POST https://magic666.top/v1/videos
field: images
task id: task_8e8bdXiejj7zeAgE4zIcR5iJ9TgiSVYI
status: completed
video url: https://r2.geeknow.top/magic/videos/518/task_8e8bdXiejj7zeAgE4zIcR5iJ9TgiSVYI.mp4
downloaded bytes: 5353165
sha256: 8ec917b8ef4a3142f2f1e09feffd9522b6a271ffab062d6499b0989babe2b2b9
observed result: 与 Magic666 的 image 单字段结果完全相同，仍为室内窗台灰猫，不使用上传图的黄色背包/街景视觉信息
```

### 10.5 2026-07-23 结论

两个通道的请求都能创建任务、轮询完成、下载 MP4，说明不是 API Key、网络、接口路径、任务轮询或下载链路问题。

入参层面已经测试：

```text
application/json
model: grok-imagine-video
seconds: "10"
aspect_ratio: 16:9
resolution: 720P
image: data:image/png;base64,...
images: ["data:image/png;base64,..."]
```

结果：

```text
SmartPickLid: image/images 都没有使用参考图，多次返回固定/无关风景兜底视频。
Magic666: image/images 都没有保留参考图，只生成了 prompt 语义里的普通猫，且 image 与 images 结果完全相同。
```

因此，当前问题不是我们站内 job 流程或扣费流程导致，也不是请求没有打到接口；更像是这两个代理通道没有把参考图 payload 正确传给实际 Grok Video 上游，或上游当前图生视频能力没有启用/没有生效。

生产 worker 当前仍保持保护状态：

```text
AI_WORKER_ALLOW_SMARTPICKLID_UNVERIFIED_VIDEO != 1
AI_WORKER_ALLOW_MAGIC666_UNVERIFIED_VIDEO != 1
AI_WORKER_ALLOW_SMARTPICKLID_REFERENCE_VIDEO != 1
```

所以后台可以看到这两个供应商配置，但实际用户生成链路默认会拦截它们，避免继续交付无关视频。

## 11. 2026-07-23 LK888 / Lingke 新供应商验证

用户提供的文档页：

```text
https://jiushi.lk666.ai/apidoc#model/grok-imagine-video-1.5-preview
```

### 11.1 文档页与真实 API base

`jiushi.lk666.ai` 是前端文档站 / SPA 站点，不是实际 API base。直接请求该域名的 `/v1/models`、`/v1/media/status` 会返回 HTML 兜底页面。

可用 API base：

```text
https://api.lk888.ai
https://api.lk666.ai
https://api.lingkeai.ai
```

其中接口提示推荐：

```text
主域名: https://api.lk888.ai
备用域名: https://api.lk666.ai
```

鉴权方式：

```text
Authorization: Bearer <API_KEY>
```

### 11.2 模型与参数定义

模型列表接口确认该 key 可用：

```text
GET https://api.lk888.ai/v1/skills/models?type=video
model: grok-imagine-video-1.5-preview
available_for_this_key: true
```

单模型详情接口：

```text
GET https://api.lk888.ai/v1/skills/models/grok-imagine-video-1.5-preview
```

返回的必填参数：

```text
prompt       textarea required
images       upload   required  # first-frame reference image
aspect_ratio radio    required  # 16:9 / 9:16 / 1:1 / 3:2 / 2:3
resolution   radio    required  # 720p / 480p
duration     select   required  # "1" ... "15"
```

重要差异：

```text
参考图字段名是 params.images，不是 image / reference_images。
resolution 使用小写 720p / 480p，不是 SmartPickLid 旧适配里的 720P。
duration 是字符串秒数 "1" 到 "15"。
该模型只支持图生视频，images 必填。
```

### 11.3 推荐接入协议

官方 guide 对媒体类模型推荐异步媒体协议：

```text
POST https://api.lk888.ai/v1/media/generate
GET  https://api.lk888.ai/v1/skills/task-status?task_id={task_id}
```

正确请求体示例：

```json
{
  "model": "grok-imagine-video-1.5-preview",
  "prompt": "根据上传的图片，生成小猫咪从包里跳出来，走两步然后做一个后空翻的动作的视频。Use the uploaded image as the exact first-frame visual reference: the same yellow backpack cat on a city street.",
  "params": {
    "images": "data:image/png;base64,...",
    "aspect_ratio": "16:9",
    "resolution": "480p",
    "duration": "1"
  }
}
```

图片参数说明：`images` 可传公网直链 URL，也可传 `data:image/...;base64,...`。单文件解码后默认不超过 10MB，单次所有 base64 合计不超过 30MB，请求体不超过 50MB。

### 11.4 实测结果

使用同一张猫图：

```text
asset: /tmp/mydreamshoots-video-test/smartpicklid-after-gateway-20260721-v2/asset_mromnkes_4xms3y.png
image: PNG 1279x1706, 2.4MB
```

完整正确 body 提交结果：

```text
submittedAt: 2026-07-23
endpoint: POST https://api.lk888.ai/v1/media/generate
model: grok-imagine-video-1.5-preview
params.images: data:image/png;base64,...
params.aspect_ratio: 16:9
params.resolution: 480p
params.duration: "1"
HTTP: 200
response: {"code":402,"data":null,"msg":"余额不足，本次任务预计需要 0.1008 算力，请充值后重试"}
```

结论：该 key、base URL、模型名、媒体接口和参数格式都已验证到供应商业务层；当前无法完成真实生成，不是因为接口不通，而是因为 API key 余额不足。余额补足后可用上面的最小 1 秒 / 480p 请求继续验证视频是否真正保留参考图。

### 11.5 余额补足后的完整生成复测

补余额后再次使用同一张猫图、同一条 prompt，按完整 10 秒 / 720p 参数提交：

```text
submittedAt: 2026-07-23 15:14:50 +08:00
endpoint: POST https://api.lk888.ai/v1/media/generate
model: grok-imagine-video-1.5-preview
params.images: data:image/png;base64,...
params.aspect_ratio: 16:9
params.resolution: 720p
params.duration: "10"
task_id: 82005041
channel_group: MC-gork1.5官转分组
status: success
completedAt: 2026-07-23 15:16:07 +08:00
duration_seconds: 77
cost: 1.008
result_url: https://cos.lingkeai.vip/uploads/2026.07/23/20260723151608_18c4d9edfde2bc217222.mp4
sha256: 42bb63ef4dfb50d260d38e5d5fea38ac551199d46badfb47053f857a684f341c
local_video: /tmp/mydreamshoots-video-test/lk888-retry-20260723/result.mp4
contact_sheet: /tmp/mydreamshoots-video-test/lk888-retry-20260723/contact-sheet.jpg
```

视频元信息：

```text
duration: 10.04s
resolution: 1280x720
fps: 24
audio: AAC stereo
downloaded bytes: 11078010
```

视觉检查结论：输出视频保留了上传参考图中的金色猫、黄/棕色背包、夜间街景和红车背景。动作表现为猫从包里探出、出来、在街边行走并跳起/翻转尝试。与 SmartPickLid / Magic666 的无关风景或灰猫兜底不同，该通道确实使用了参考图。

### 11.6 对我们平台的接入建议

如果要接入该供应商，不能直接复用 SmartPickLid / Magic666 当前的 `/v1/videos` 旧适配字段。

建议新增或扩展 provider adapter：

```text
baseUrl: https://api.lk888.ai
create: POST /v1/media/generate
poll:   GET /v1/skills/task-status?task_id={task_id}
model:  grok-imagine-video-1.5-preview
body:
  model: string
  prompt: string
  params:
    images: string | string[]
    aspect_ratio: "16:9" | "9:16" | "1:1" | "3:2" | "2:3"
    resolution: "720p" | "480p"
    duration: "1" ... "15"
```

## 12. English summary for provider support

We are calling SmartPickLid `POST /v1/videos` for image-to-video generation. The API returns `succeeded` and we can download an MP4, but the output is unrelated to both the uploaded reference image and the prompt.

Expected: a video featuring the uploaded cat in a yellow backpack, following the user prompt.

Actual: unrelated mountain/lake/sunrise footage.

We tested both documented request styles:

- JSON with `model: "grok-imagine-video"` and `image: "data:image/jpeg;base64,..."`.
- Multipart form with `model: "grok-video-3-pro"` and `input_reference=@...jpg`.

Both requests succeeded but produced unrelated footage. The same reference image worked through SmartPickLid on 2026-07-17, but failed on 2026-07-21. Please verify whether SmartPickLid is currently dropping or not forwarding the reference image and/or prompt to the underlying Grok Video provider, or falling back to a default sample scene while still returning success.

After the 2026-07-21 gateway update, we retested with the provider-recommended single-field JSON contract:

- `task_GrGdstVDc25D1t6RPc2ZTnJt5A2ar6i3`: `image` only, `data:image/webp;base64,...`, completed, output was an unrelated lighthouse/sunset scene.
- `task_a6mQZxsanfatSpfthJGE8vMEpbOi5GD2`: `image` only, `data:image/png;base64,...`, completed, output was an unrelated autumn forest road scene.

These requests did not mix `image`, `images`, or `reference_images`, and did not use multipart / `input_reference`. Please inspect these two task IDs specifically to confirm whether the reference image and prompt reached the actual Grok Video upstream request.

We retested again on 2026-07-22 with the same valid single-field JSON request:

- `task_W7qPuqkMQwGc3y5jK44kaNr2GKav1HCY`: `image` only, `data:image/png;base64,...`, completed, but returned the exact same unrelated autumn forest road video as the previous bad sample.
- SHA256: `71c3b8e35a74315bf10a757d91ab5266ecf62f857c2c8cc960dac94c38c22a8c`

This strongly suggests the gateway or upstream generation path is still using a default/fallback video instead of the submitted reference image and prompt.
