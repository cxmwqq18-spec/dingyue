# AIVideosUGC 配音、音色选择与自动字幕落地计划

- 日期：2026-10-14
- 状态：方案；本文件只记录实施计划，不代表功能已上线
- 范围：仅 `site_aidreamcapes` 的私有 AI 视频工作台，不改 MyDreamShoots 或公开页面
- 相关资料：`docs/plans/aidreamcapes-speech-28-voice-match-clone-plan.md`

## 1. 决策摘要

角色卡与对应音色作为一个资产维护，不另建面向用户的音色目录，也不提供独立音色选择器。每张 `ActorAsset` 的嵌套 `voice` 字段保存角色专属音色资料和试听文件。选择角色即选择这张卡绑定的音色；如需调整听感，应更新该角色卡本身的映射。

服务端任务快照仍需要记录 `actorId` 与该角色当时的音色映射，避免后续修改角色卡时悄悄改变已有任务。角色 ID 与 voice ID 可在内部快照中分别标识，但用户操作始终以角色卡为单位。现有 53 张角色卡、性别匹配与配对结果继续使用，不重建角色库。

## 2. 当前工作区核对

以下描述来自当前工作区源码和现有音色计划文件；它们不代表生产环境已经验收。

### 已有的角色与音色资料

- 角色源数据：`scripts/data/aidreamcapes-site-v2/content/ai-actors.json`。
- 53 个角色对应的供应商预设 voice ID、显示名、语言和试听文件映射：`scripts/aidreamcapes-workspace/actor-voice-assets.json`。
- 工作台目录：`src/lib/aidreamcapes-workspace/actors.json`。卡片含音色标签、声音描述、语言和 `refAudio` 试听地址。
- 生成目录的脚本：`scripts/build-aidreamcapes-ugc-actor-catalog.mjs`。
- 现有样音是预设音色的 TTS 试听素材，不是克隆声音。用户已确认完成 53 条样音人工听审；声纹克隆尚未开始。

运行时 `ActorAsset.voice.voiceId` 与任务 `voiceSnapshot.voiceId` 使用 Aidreamcapes mock namespace；53 个 Buming 实际预设 voice ID 保存在服务端资产映射 manifest。任务与镜头快照及性别匹配校验已实现，但真实 TTS adapter 尚未接通，视频能力也不接受音频参考，因此 mock 快照不能证明真实成片使用了指定 Buming 音色或已完成口型同步。

### 已有的工作台流程

- `workspace.tsx` 让客户选角色，显示绑定音色的标签和试听 MP3；目前没有独立的音色下拉框。
- `WorkspaceTask` 与 shot/version 保存角色及 `ActorVoiceSnapshot`；当前快照使用 mock voice namespace，不直接调用 Buming。
- `pipeline.ts` 会把角色的声音描述、语速和音高写进视频提示词，要求视频模型朗读台词并同步口型。
- 当前视频能力声明 `audioReference: false`。因此 prompt 里的声音描述只能引导模型，不能保证输出与角色卡的供应商音色 ID 相同。试听 MP3 目前也不是视频生成请求的音频参考。
- `media-render.ts` 已有字幕处理流程：提取成片音轨，调用配置的 ASR 接口取得带时间戳的片段，核对识别文本与台词，再生成 SRT 并用 FFmpeg 烧录。工作台有字幕开关和三种样式；字幕可用性取决于 ASR 服务配置。

## 3. 角色与音色数据契约

第一阶段不引入新的数据库表，也不另造一份手工维护的音色目录。先把现有 manifest 明确成音色资源清单，并让运行时任务保存实际选择结果。

角色音色继续嵌套在角色资产内；服务端连接真实 TTS 时从受控 manifest 解析供应商映射。内部快照字段建议：

```ts
type ActorVoiceBinding = {
  voiceId: string;              // 项目内稳定 ID；不可由目录列表位置生成
  label: string;
  languages: VideoLanguage[];
  timbre: string;
  vocalProfile: string;
  refAudio: string;             // 角色卡试听素材
};

type ActorProfile = {
  actorId: string;
  // 肖像、外观和角色资料……
  voice: ActorVoiceBinding;
};
```

任务创建时保存 `actorId`、角色卡音色快照、语言和最终台词；每个 shot version 快照也保存同一组值。后续角色卡映射被调整，不得悄悄改变已创建任务的声音。服务端只接受当前角色卡中存在且与语言/视频模式兼容的音色绑定；浏览器不接触供应商密钥。

现有 `voice` 嵌套字段继续作为角色卡唯一音色资料；TTS 调用必须从服务端稳定映射读取 `providerVoiceId`。试听 MP3 只负责预览，不能代替克隆参考音频。

## 4. 配音实现方案

### 4.1 生成文案与选择音色

1. 剧本阶段仍按镜头生成 `voiceover` 台词，并按语言、时长和镜头长度校验字数。
2. 角色选择后，默认音色取 `ActorProfile.defaultVoiceProfileId`；工作台显示音色名、语言和试听按钮。
3. 若用户手动换音色，只改 `voiceProfileId`，不改 `actorId`。只展示支持当前语言且可用于当前生成模式的音色。
4. 每个 shot 使用任务快照中的同一个 voice profile，防止分镜或重试时声音漂移。用户明确重新选择音色后，重新生成相关音频和成片。

### 4.2 TTS 调用

- 通过服务端音频 provider adapter 调用 TTS；复用现有 `actor-voice-assets.json` 映射和平台供应商配置，不在前端直连 API。
- 每条台词使用选定 voice ID、语言和受控的语速/音高参数生成音频，保存为该客户、任务和镜头所有的私有素材。
- 幂等键绑定 task、shot version、voice profile、语言、台词和 TTS 参数。重复请求复用同一次结果；编辑台词或音色时创建新版本。
- 记录 provider/model、voice ID、请求状态、输出资产和计费信息；日志不写 API key 或完整敏感素材。

### 4.3 口型同步必须先过能力门槛

当前视频调用支持提示词驱动的原生语音，但声明不支持音频参考。单独生成 TTS 后直接盖到一个正在说话的角色视频上，容易产生口型与声音不一致，不能当成“角色配音已接通”。

上线精确音色前，需选择并验证以下一种路径：

1. **视频模型支持音频参考/音频驱动口型**：把已生成 TTS 音频作为输入，并在 provider capability 中显式声明支持；成片后检查音轨和口型结果。
2. **增加独立 lip-sync 步骤**：先得到角色视频，再由经过验证的 lip-sync provider 用 TTS 音轨重做口型；保存该步骤的 provider、任务 ID 和结果。

若当前供应商两种路径都不支持，第一版继续使用视频模型原生语音，并把角色音色描述作为风格引导；界面不得宣称精确匹配到 voice ID。若业务接受非口型同步的旁白，可把它作为单独的旁白模式，不能与角色对镜说话混为一项。启用任何真实生成前，先确认供应商能力、收费和样片验收口径。

## 5. 自动字幕实现方案

1. 字幕以最终混音后的实际音轨为准，不直接把脚本当作字幕时间轴。
2. 优先使用 TTS/lip-sync provider 返回的精确词级或句级时间戳；没有时间戳时，用当前 ASR 流程识别最终音轨并取得分段时间。
3. 将每个镜头的时间戳加上镜头起始偏移，生成整片字幕 cues 和 SRT；限制 cue 顺序、时长、镜头边界和空文本。
4. 对识别文本与确认台词做规范化比对。明显不一致或缺少有效时间戳时，不把未验证台词烧进视频；标记字幕步骤失败，允许用户关闭字幕后重新渲染。
5. 烧录时按用户选择的样式处理，并为中文、日文、韩文、泰文等语言配置可用字体和安全边距。保留独立 SRT 下载，同时输出带字幕成片。
6. 字幕语言必须与已确认的台词语言和实际音轨一致。换语言时先重写/确认台词，再重新合成语音和字幕。

当前已有的 ASR→SRT→FFmpeg 烧录流程可作为起点；需要补齐最终 TTS/视频音轨的对接、非英语字体覆盖、任务快照和错误恢复，再做端到端验收。

## 6. 分阶段交付

### P0：锁定映射与样音（映射和样音已完成；人工听审已完成）

- 校验 53 个 actorId 到 voiceProfileId/providerVoiceId 的映射唯一且稳定。
- 用户已人工试听 53 条现有样音。若后续发现新的不合格项，只调整角色卡内的音色映射，不重建角色卡。
- 确认实际可用的 TTS provider、voice 参数和费用；不从列表位置动态推导 voice ID。

### P1：任务绑定与角色卡音色展示（内部 mock 绑定已完成）

- 服务端目录输出角色卡自身的音色字段，并校验男女声与角色性别一致。
- 选择角色即选该角色自己的音色；显示试听与语言。
- 角色与默认音色作为同一张角色卡管理，不新增独立音色下拉；任务和镜头快照保留已选角色及其音色映射。
- 在 task/shot version 中保存 actorId 与角色音色快照；该内部 mock snapshot 已通过验收。

### P2：TTS 与视频同步

- 服务端接入 TTS adapter，生成、保存、重试和复用镜头语音。
- 先完成一个短镜头的供应商能力验证：音轨确实使用目标 voice ID，角色口型和语句时长可接受。
- 根据验证结果接视频音频参考或 lip-sync。无法同步时保持功能不可用，不偷偷用另一条音轨替换。

### P3：字幕与成片

- 对最终语音取得时间戳、校验文本、生成 SRT、烧录样式并提供字幕文件下载。
- 接上现有三种字幕样式和可用性状态；ASR 未配置或失败时禁止生成未校验的字幕成片。
- 检查多镜头偏移、不同画幅、长短视频及受支持语言的字形和安全区域。

### P4：验收与开放

- 同一角色连续生成多条时 voiceProfileId 稳定；切换音色不换演员；切换角色自动回到新角色默认音色。
- TTS 生成音轨确实使用所选 voice ID，口型同步通过人工样片验收。
- 字幕逐句对应实际声音、时序无明显漂移、不跨镜头；SRT 与烧录成片一致。
- 每个 provider 失败、超时、重复请求和重试都不会重复扣费或产生两条相互冲突的任务。
- 正式启用前按当前账务规则核对 TTS、ASR、视频和 lip-sync 的成本；对用户展示或扣取规则需单独确认。

## 7. 暂不纳入

- 创建用户声纹克隆或上传客户声音；现有角色试听样音不能直接当作克隆参考音频。
- 重做或复制 53 张角色卡和已有音色匹配。
- 在未验证口型同步前，默认把外部 TTS 音频覆盖到对镜说话的视频。
- 将音色 ID、API key 或内部模型提示词暴露给浏览器。

## 8. 相关代码入口

- 角色数据生成：`scripts/build-aidreamcapes-ugc-actor-catalog.mjs`
- 角色运行目录：`src/lib/aidreamcapes-workspace/actors.json`
- 音色映射和试听资源：`scripts/aidreamcapes-workspace/actor-voice-assets.json`
- 角色、任务、字幕类型：`src/lib/aidreamcapes-workspace/types.ts`
- 台词校验和提示词编译：`src/lib/aidreamcapes-workspace/pipeline.ts`
- 视频/字幕合成：`src/lib/aidreamcapes-workspace/media-render.ts`
- 角色与配音设置 UI：`src/components/aidreamcapes-workspace/workspace.tsx`
- provider 能力与 ASR 配置：`src/lib/aidreamcapes-workspace/provider.ts`
