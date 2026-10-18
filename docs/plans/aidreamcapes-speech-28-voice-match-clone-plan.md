# Aidreamcapes 53 角色卡：speech-2.8 音色匹配与声纹克隆计划

- 日期：2026-10-14
- 状态：PRESET_SAMPLE_REVIEWED；53/53 张角色卡已按一对一预设音色映射生成 speech-2.8 MP3 试听素材，并回填至 `voice.refAudio`。39 张女性角色配女声、14 张男性角色配男声，53 个预设 voice ID 均唯一。按用户听感反馈，Dev 与九位女性角色已改配成年/自然音色并重新生成样音；用户已确认完成 53 份样音人工听审。本阶段没有创建声纹克隆。
- 范围：只覆盖 `site_aidreamcapes` 工作台内的 53 张内置角色卡及其角色音色字段。
- 本阶段：读取 API 文档与 53 张角色卡数据，通过平台预设音色目录将首轮名称/列表位置解析为实际 voice ID，使用各卡 `sampleLine` 调用 speech-2.8 生成 MP3，并将每个音频路径写回对应卡片。没有上传参考音频或创建声纹。

## 1. 目标与现状

依据 Buming 音色卡的名称、短标签和可见完整描述，为 53 张角色卡各选一个一对一候选；声音质地、情绪表达、语速和角色试听文案用于排序，音色性别必须与人物性别一致。候选锁定前需用每张卡的英语 sampleLine 试听，核验英语表现、voice ID 和重复情况，再决定是否进入声纹克隆。角色与音色继续作为同一张卡管理，不单独建一份面向用户的音色目录。

角色数据以 `src/lib/aidreamcapes-workspace/actors.json` 为工作台运行清单，以 `scripts/data/aidreamcapes-site-v2/content/ai-actors.json` 的 `actor_cards` 为源数据。当前共有 53 张卡：女性 39、男性 14；角色台词均为英语；年龄分布为 20s 10 人、30s 37 人、40s 4 人、50s 1 人、60s+ 1 人。现有卡片声音描述分为 warm、calm、bright、low、clear 五类。`voice.refAudio` 已指向本计划生成的角色专属 MP3；预设 voice ID、显示名、语言和采样文本的完整映射保存在 `scripts/aidreamcapes-workspace/actor-voice-assets.json`。

## 2. Buming API 文档核对

核对入口：[Buming API 文档](https://buming001.token6688.com/zh-CN/api-docs)，模型页为 `/zh-CN/api-docs/models/speech-2.8`。speech 请求使用 API Base URL `https://api.tokengo.love`，鉴权方式为 `Authorization: Bearer <API_KEY>`。

| 项目 | 文档/接口核对结果 | 对本任务的影响 |
|---|---|---|
| 模型 | `speech-2.8`，MiniMax / 海螺 Speech 2.8 Voice Clone；支持语音克隆和 TTS | 53 张卡的目标模型 ID 固定为 `speech-2.8` |
| 音色参数 | `voice` 是必填字符串；可传预设音色 ID，也可传声纹库返回的克隆音色 ID | 可保存平台实际 voice ID；模型 schema 本身没有内嵌完整预设音色枚举 |
| 预设音色目录 | 模型 schema 未内嵌完整预设枚举。平台音色目录接口 `GET https://buming001.token6688.com/api/v1/voice-library/presets` 返回 412 项，其中 MiniMax 家族 328 项；该家族包括 115 个女声、81 个男声。按性别及 UI 每页 15 项的列表顺序解析名称对应的 voice ID。目录接口不是 speech 模型 schema 中的字段定义，若平台调整列表顺序，应以 manifest 中已锁定的 voice ID 为准。 |
| 克隆提交 | `POST /v1/audio/voices`，`multipart/form-data` 字段为 `file`、`model=speech-2.8`、`name`；返回 voice ID 与 `task_id` | 每张卡需有自己的合格参考音频；成功后保存 task 与 voice ID |
| 任务轮询 | `GET /v1/tasks/{task_id}`；文档建议约每 3 秒轮询，按终态判断成功或失败 | 只在克隆任务成功且 voice ID 可用后回填角色卡 |
| 参考音频限制 | API 文档列出 MP3/M4A/WAV、10–300 秒（含边界）、严格小于 20 MiB；同一站点声纹库界面文案显示 10–60 秒 | 计划首批采用较严格的 10–60 秒、MP3/M4A/WAV、<20 MiB；真正调用前再以接口校验结果和当前 UI 规则确认 |
| TTS | API `POST https://api.tokengo.love/v1/audio/speech` 可同步返回 MP3 音频；请求的 `voice` 字段可用目录解析出的预设 voice ID。实测使用 `speech-2.8` 和预设 voice ID 返回有效 MP3。 | 已为 53 张卡各生成一份 MP3；每份使用该卡原始 `sampleLine`。这批是预设音色的试听/播放资产，不是克隆音频。 |
| 参数 | `version` 默认 2.8；`tier` 为 `hd` / `turbo`；语速默认 1.0；变声默认 0；情绪默认 auto；音效默认 none | 音色横向试听采用截图参数：2.8、Turbo、1.0x、原声/0、自动情绪、无音效，确保比较条件一致 |

克隆参考音频与试听短句要区分：角色卡的 `sampleLine` 用于试听预设音色，不足以满足克隆接口的 10 秒下限。当前 `voice.refAudio` 指向本轮 3–6 秒试听样音，不可直接作为克隆参考音频。每张卡的合格参考音频来源仍需另行确定；若用所选预设音色合成长参考样本，先核实 Buming 接受这种来源及费用。

截图里 `Ari` 的试听文案为 “I keep this by the door and grab it on the way out, so I never hunt for it.”，本轮沿用卡片中的原始台词生成角色专属样音。该短样音用于角色卡预览，不满足声纹克隆所需的参考音频时长。

本轮 53 份台词音频共 4,020,996 bytes，`ffprobe` 均可解析，时长约 3.19–5.92 秒。所选预设覆盖多个目录语言；尽管输入台词均为英语，接口生成、文件格式和卡片映射已核验，用户也已人工听审全部 53 份样音。逐条听感日志以及英语口音/发音质量评分未单独归档。

## 3. 音色匹配规则

### 本轮匹配口径

1. 女声、男声都纳入候选池，但每张角色卡必须匹配与人物性别一致的音色性别：女性角色配女声，男性角色配男声。性别一致是硬条件；再按声音质地、语速、情绪和试听文案挑选。
2. 先读取音色卡显示的名称、短标签和可见完整描述。列表中不少卡片只显示名称或重复名称的标签；这些候选按可见语义作暂定匹配，不把名字推断成已验证的听感。
3. 角色年龄只用于辅助判断。候选标题若明显指向儿童或不符年龄，需试听确认后再保留。
4. 每个候选都从同一性别的目录池解析出实际 voice ID；本轮已核对 53 个 ID 全部唯一，并将完整匹配固化在 manifest，不依赖后续列表顺序。
5. 角色卡台词为英语。第一轮按卡片文案生成试听样音，所选音色覆盖多个目录语言；用户已确认完成 53 份样音人工听审。本计划不再把人工听审列为待办，具体逐条听感记录未单独归档。

### 角色卡目标音色

| 卡片目标 | 优先匹配的可听描述 |
|---|---|
| warm | 温暖、亲和、放松自然；中慢节奏，可带轻微气息感 |
| calm | 沉静、柔和、清楚；较慢节奏，咬字稳定 |
| bright | 明亮、有活力、表达感较强；中快节奏 |
| low | 低沉、厚实、有共鸣；较慢节奏 |
| clear | 清晰、稳健、节奏克制；吐字准确 |

第一轮匹配依据音色卡标题/标签及上述目标。下表记录每张卡的候选显示名、列表定位和描述匹配理由；对应的实际 voice ID、语言和文件路径见 `scripts/aidreamcapes-workspace/actor-voice-assets.json`。候选已通过名称、性别和唯一 ID 核验，听感仍待人工确认。

## 4. 53 张角色卡的一对一试听清单

表中“试听文本”直接取该卡 sampleLine；“目标”按角色卡原有 timbre 归纳，候选音色性别与人物性别一致。最后一列记录候选音色性别、列表页码/序号及描述匹配理由；准确 voice ID 和语言信息见 manifest，音频听感待人工确认。

| 角色 | actorId | 性别 / 年龄 | 卡片目标 | 试听文本（sampleLine） | 第一轮候选与描述匹配理由（声线性别 / 列表位置；ID 已核验，用户已人工听审） |
|---|---|---|---|---|---|
| Ari | `indoor-1` | 女 / 20s | warm | I keep this by the door and grab it on the way out, so I never hunt for it. | 候选：温暖少女（女声第2/8页·第6项）；名称直接表达温暖、柔和，贴合 warm。 |
| Mila | `indoor-2` | 女 / 30s | calm | I use this at home when the day is done. | 候选：Calm Woman（女声第7/8页·第1项）；名称与沉静、柔和的 calm 目标一致。 |
| Dev | `home-1` | 男 / 30s | low | After a long day I sit down and pull this close, so the evening starts with it in hand. | 候选：Trustworthy Man（男声第2/6页·第9项）；成熟、可信赖的成年男声，低沉而自然，符合 Dev 的成年男性设定。 |
| Elena | `home-2` | 女 / 40s | bright | I set this beside me for the evening at home, so I can reach it without getting up. | 候选：Confident Woman（女声第4/8页·第10项）；自信、有表现力的描述贴合 bright，声线性别与人物一致。 |
| Priyanka | `outdoor-1` | 女 / 30s | warm | I carry this up to the rooftop when I need a break, and I show it there. | 候选：Gentle Lady（女声第8/8页·第4项）；温和自然的成年女声，避开少女感和甜腻声线。 |
| Jon | `outdoor-2` | 男 / 30s | warm | I take this on the city walk and hold it at my side, so the size is easy to see. | 候选：Friendly Man（男声第5/6页·第3项）；友善、自然的表达贴合 warm。 |
| Celine | `living-room-1` | 女 / 30s | calm | I keep this next to me on the living-room couch, so I can reach it without getting up. | 候选：Serene Woman（女声第3/8页·第1项）；平静、安定的名称语义贴合 calm。 |
| Gordon | `living-room-2` | 男 / 60s+ | clear | On a calm evening at home I keep this nearby and talk through why I use it. | 候选：Level-Headed Man（男声第4/6页·第12项）；沉着、清晰、节奏稳定，贴合 clear 和成熟年龄感。 |
| Ravi | `studio-1` | 男 / 30s | low | I pick this up at the studio desk before I record, so the first line is about it. | 候选：Deep-voiced Gentleman（男声第4/6页·第2项）；名称明确指向低沉厚实声线，贴合 low。 |
| Evan | `studio-2` | 男 / 20s | warm | I leave this on the studio desk between takes, so the next line can start on it. | 候选：Friendly Boy（男声第6/6页·第4项）；友善、自然的表达贴合 warm，年龄感需试听核对。 |
| Omar | `office-1` | 男 / 40s | clear | On a busy workday I keep this in reach and hold it up at the desk. | 候选：Assured Presenter（男声第6/6页·第2项）；主持人定位和沉稳自信的表达贴合 clear。 |
| Nisha | `office-2` | 女 / 30s | bright | I keep this on my desk through the workday and point to it while I explain. | 候选：Ambitious Woman（女声第7/8页·第5项）；积极、自信的表达方向贴合 bright。 |
| Claire | `garden-1` | 女 / 30s | warm | I bring this outside for a quiet garden break and set it where the plants are. | 候选：Graceful Lady（女声第3/8页·第2项）；成年女性声线，平稳优雅，避免幼态化表达。 |
| Amara | `garden-2` | 女 / 30s | calm | Among the plants I reach for this when I pause, and I turn it toward the light. | 候选：Calm Lady（女声第3/8页·第6项）；名称直指平静柔和，贴合 calm。 |
| Sofia | `gym-1` | 女 / 30s | bright | Between sets at the gym I keep this close and show it before the next one. | 候选：Energetic Woman（女声第7/8页·第14项）；名称直接匹配明亮、有活力的 bright 目标。 |
| Lana | `gym-2` | 女 / 30s | warm | For indoor training I keep this ready and pick it up between moves. | 候选：善良女声（女声第2/8页·第12项）；亲和、温和的描述贴合 warm。 |
| Tess | `cafe-1` | 女 / 20s | calm | A cafe break is more useful when I set this on the table and talk about it. | 候选：Calm Lady（女声第3/8页·第11项）；成熟平静的成年女声，与 calm 目标一致。 |
| Yara | `cafe-2` | 女 / 30s | bright | I set this in the center of the cafe table so the size is easy to see. | 候选：Confident Woman（女声第5/8页·第7项）；自信、自然的成年女性声线，保留明快表达但不使用少女音标签。 |
| Asha | `kitchen-1` | 女 / 30s | warm | My kitchen counter has a spot for this, so I can grab it while I talk. | 候选：Caring Woman（女声第4/8页·第4项）；关怀、温和的描述贴合 warm。 |
| Mara | `kitchen-2` | 女 / 30s | calm | I reach for this while I cook at the counter, without stopping the meal. | 候选：Tranquil Woman（女声第8/8页·第9项）；平和、舒缓的描述贴合 calm。 |
| Leonie | `podcast-1` | 女 / 30s | bright | At the microphone I bring this up when I have one clear point to share. | 候选：Inspiring Lady（女声第6/8页·第5项）；鼓舞、富有表现力的语义贴合 bright。 |
| Bria | `podcast-2` | 女 / 20s | warm | I lift this beside the microphone and name the one thing it does. | 候选：Charming Girl（女声第6/8页·第15项）；亲和、讨喜的表达贴合 warm，年龄感需试听核对。 |
| Caleb | `fitness-1` | 男 / 30s | low | When training starts I keep this in reach and show it first. | 候选：Dominant Man（男声第3/6页·第3项）；强势、厚实的表达方向适合 low，需试听确认音域是否足够低。 |
| Rina | `fitness-2` | 女 / 30s | calm | I keep this in my indoor training routine and name one reason it stays there. | 候选：Thoughtful Lady（女声第5/8页·第3项）；沉稳、思考感的成年女声，适合 calm 目标。 |
| Nia | `beach-1` | 女 / 30s | bright | I bring this when I walk by the water and hold it against the shoreline. | 候选：Playful Girl（女声第5/8页·第13项）；活泼、俏皮的语义贴合 bright。 |
| Lola | `beach-2` | 女 / 30s | warm | On a beach walk I bring this along and stop so you can see it in my hand. | 候选：Kind Lady（女声第3/8页·第5项）；友善、亲和的语义贴合 warm。 |
| Mateo | `car-1` | 男 / 30s | warm | Before I pull away I check that this is in reach and give it one look. | 候选：Jovial Man（男声第3/6页·第12项）；轻松、开朗的表达贴合 warm。 |
| Jade | `car-2` | 女 / 30s | calm | At a quick stop before I drive, I keep this within reach and show it. | 候选：Dependable Woman（女声第3/8页·第4项）；可靠、平稳的表达贴合 calm。 |
| Adrian | `hospital-1` | 男 / 30s | clear | I pause in the hallway, reach for this, and turn it toward the camera. | 候选：Diligent Man（男声第2/6页·第11项）；清楚、稳妥的表达方向贴合 clear，需试听核对吐字。 |
| Sana | `hospital-2` | 女 / 30s | bright | I keep this close when I get ready for the day. | 候选：Optimistic Youth（女声第8/8页·第2项）；乐观、明快的表达贴合 bright；年龄感需试听核对。 |
| Tessa | `balcony-1` | 女 / 30s | warm | On a sunny balcony break I keep this nearby and lift it into the light. | 候选：Casual Woman（女声第8/8页·第1项）；日常、自然的成年女声，符合 warm 目标且不偏甜。 |
| Iris | `balcony-2` | 女 / 40s | calm | I start my balcony morning with this in hand and say one reason I like it. | 候选：Mature Lady（女声第3/8页·第13项）；成熟、稳重的语义贴合 calm 和年龄感。 |
| Rhea | `pet-1` | 女 / 30s | bright | With my dog beside me I keep this close and show it between pats. | 候选：Athletic Girl（女声第4/8页·第5项）；活力、运动感的表达方向贴合 bright。 |
| Anika | `pet-2` | 女 / 30s | warm | While I cuddle my cat I keep this ready and tilt it toward the camera. | 候选：Girl Next Door（女声第8/8页·第5项）；邻家、亲近的语义贴合 warm。 |
| Lena | `shopping-1` | 女 / 30s | calm | While I browse I spot this, pick it up, and share why it caught my eye. | 候选：Steadfast Narrator（女声第8/8页·第6项）；稳定、克制的旁白定位贴合 calm。 |
| Casey | `shopping-2` | 女 / 20s | bright | In the beauty aisle I stop when I find this and hold it next to my face. | 候选：Confident Woman（女声第7/8页·第2项）；自信清晰的成年女声，替换带有 young girl 标签的候选。 |
| Damon | `sports-1` | 男 / 30s | low | Courtside I keep this ready and show it before the next game starts. | 候选：Male Narrator（男声第4/6页·第14项）；旁白声通常偏稳、厚实，作为 low 候选需试听确认低音共鸣。 |
| Mireya | `sports-2` | 女 / 20s | warm | While I warm up to play I bring this along and keep it where I can reach it. | 候选：Sweet Girl（女声第3/8页·第7项）；甜美、亲和的描述贴合 warm。 |
| Maxwell | `study-room-1` | 男 / 30s | warm | At my study desk I hold this up and walk through the reason I chose it. | 候选：Caring Man（男声第5/6页·第1项）；关怀、温和的表达贴合 warm。 |
| Sora | `study-room-2` | 女 / 30s | calm | At my desk I keep this nearby, so the work stays on one clear point about it. | 候选：Wise Lady（女声第4/8页·第13项）；稳重、审慎的表达贴合 calm。 |
| Noah | `classroom-1` | 男 / 20s | clear | Between lessons I hold this up and share the reason I started using it. | 候选：Rational Man（男声第3/6页·第10项）；理性、克制、吐字清晰的表达贴合 clear。 |
| Elise | `terrace-1` | 女 / 30s | bright | I use a rooftop break to hold this up and recommend it in one sentence. | 候选：Compelling Girl（女声第5/8页·第2项）；感染力和表达感贴合 bright。 |
| Ken | `terrace-2` | 女 / 30s | warm | On this sunny terrace I keep this ready and recommend it while I stand here. | 候选：成熟女性音色（女声第1/8页·第3项）；目录标记为 adult 的成熟女性音色，表达温和但不过度甜美。 |
| Lila | `bathroom-1` | 女 / 30s | calm | After a mirror check I reach for this and show it before I head out. | 候选：Soothing Lady（女声第3/8页·第12项）；舒缓、柔和的描述贴合 calm。 |
| Vera | `exercise-1` | 女 / 40s | bright | After a waterside workout I'm glad I brought this, and I hold it up. | 候选：Assertive Woman（女声第8/8页·第8项；列表拼写 Assetive Woman）；坚定、有力度的表达贴合 bright。 |
| Akio | `exercise-2` | 女 / 20s | warm | During park stretches I hold this up and tell you the reason I chose it. | 候选：Gentle Girl（女声第7/8页·第3项）；温柔、亲和的表达贴合 warm，年龄感需试听核对。 |
| Nora | `bedroom-1` | 女 / 30s | calm | My morning is simpler when I keep this close and use it before I leave. | 候选：Patient Female Presenter（女声第6/8页·第11项）；耐心、稳定的播讲定位贴合 calm。 |
| Luis | `garage-1` | 男 / 50s | low | Before work starts I take a moment, hold this up, and recommend it. | 候选：Thoughtful Mentor（男声第6/6页·第1项）；成熟、稳重的导师感贴合 low，试听确认年龄感和低音共鸣。 |
| Gianna | `interview-1` | 女 / 30s | bright | In a street chat I hold this up and tell you why I picked it. | 候选：Chatty Girl（女声第5/8页·第1项）；健谈、活跃的表达贴合 bright。 |
| Tara | `pool-1` | 女 / 20s | warm | Poolside I keep this ready and give one sunny reason to try it. | 候选：Lovely Lady（女声第5/8页·第15项）；亲切、讨喜的表达贴合 warm。 |
| Dalia | `reporting-1` | 女 / 30s | calm | I look at the camera, hold this up, and share one short update about it. | 候选：News Anchor（女声第8/8页·第10项）；成年新闻主播声线，稳健清晰，适合 Dalia 的播报型卡片。 |
| Avery | `travel-1` | 男 / 20s | warm | From my plane seat I hold this up and tell you why I chose it for the trip. | 候选：Gentle-voiced man（男声第2/6页·第12项）；名称直指柔和声线，贴合 warm。 |
| Anjali | `yoga-1` | 女 / 30s | bright | On my mat I hold this up and share the reason it stays in my routine. | 候选：Whimsical Girl（女声第4/8页·第15项）；轻快、灵动的表达贴合 bright。 |

## 5. 执行阶段与后续步骤

### 阶段 A：核对预设音色目录（已完成）

1. 已按性别读取平台 MiniMax 预设音色目录，解析候选名称、voice ID、语言、性别及列表位置。
2. 已依照计划表中描述候选，为每张角色卡分配同一性别且不重复的预设 voice ID；53/53 项全部通过映射断言。
3. 候选是按名称、可见描述和角色声线目标选出的首轮匹配；本轮没有逐个比较多个候选并进行人工听感评分。

### 阶段 B：生成并人工听审 53 张角色卡试听素材（已完成）

1. 已对每个 actorId 使用卡片原始 `sampleLine` 调用 speech-2.8；设置为版本 2.8、Turbo、语速 1.0、pitch 0、自动情绪、无音效。
2. 已将 MP3 保存到 `public/assets/sites/site_aidreamcapes/workspace/actors/voices/{actorId}.mp3`，并把每个音频路径写进 manifest 与 `actors.json` 对应角色卡的 `voice.refAudio`。
3. 53/53 个映射均使用唯一 voice ID 且 voice gender 与角色 gender 相同；文件均有 MP3 ID3 标头，大小超过 4 KiB，`ffprobe` 可读取时长。
4. 用户已确认完成人工试听。完整 actorId → voice ID → 音色名称/语言 → 音频路径映射见 `scripts/aidreamcapes-workspace/actor-voice-assets.json`；逐条听感日志未单独归档。
5. 按用户反馈，已重新匹配并合成 Dev、Priyanka、Claire、Tess、Yara、Rina、Tessa、Casey、Ken、Dalia 十张卡：Dev 使用成年男声 `Trustworthy Man`，其余九张使用音色目录标注为 `adult` 的自然成年女声；对应卡片声音描述也已重建为平实、成熟的声线提示。

### 阶段 C：准备克隆参考音频（未开始）

1. 每个角色准备一个清晰、无背景音乐/多人声的参考文件；目标 10–60 秒，MP3/M4A/WAV，文件小于 20 MiB。
2. 角色卡短句只用于试听。如果用户提供 53 份声音，逐个按 actorId 绑定；若使用所选预设音色合成长参考样本，先验证该来源可用于 Buming 声纹克隆，并核对费用。
3. 文件按 `actorId` 命名并核验时长、格式、大小；不得把某一角色的参考音频复用给另一角色。

### 阶段 D：逐个创建声纹（未开始）

1. 使用服务端保存的 API Key（不写入前端、源码、计划文档或日志明文），向 `POST /v1/audio/voices` 发送 `file`、`model=speech-2.8`、`name=<actorId>-<actorName>`。
2. 记录每个提交的 `task_id`，约每 3 秒调用 `GET /v1/tasks/{task_id}`；只有任务成功、返回 voice ID 且对应模型可选用时才标为完成。
3. 单卡失败时记录服务端错误码和文件元数据，修复该卡后单独重试；成功卡不重提，防止重复计费和产生孤儿声纹。
4. 最终把 `provider/model/voiceId/presetVoiceId/refAudioUrl/status` 写回该角色卡的语音信息；不要另建与角色脱离的用户可见声纹列表。

### 阶段 E：克隆后合成验证与验收（未开始）

1. 用每张卡原始 `sampleLine` 和返回的克隆 voice ID 做 TTS 验证；对比该角色锁定前的预设试听。
2. 沿用截图基准参数：版本 2.8、Turbo、语速 1.0、pitch 0（原声）、emotion auto、sound_effects none。记录音频文件/URL、长度和试听结论。
3. 验收：53 张卡全部有唯一 voice ID；克隆任务全部成功；每个 ID 都能通过 `speech-2.8` 合成该卡英语试听文案；角色卡的试听控件播放本卡音频；无重复映射、错卡音频或空引用。

## 6. 开始声纹调用前的检查点

- [x] 已取得 53 个 Buming 预设 voice ID，并核对唯一性、性别及计划显示名；53 份试听素材已由用户人工听审。
- [ ] 每个 actorId 都有明确的、可用于克隆的参考音频；时长/格式/大小符合当前 API 实际约束。
- [ ] 已确认预设音色试听/下载或合成长参考音频的授权和平台费用。
- [ ] 已核对账户可用渠道、voice 家族、声纹克隆单价和余额；API Key 仅在服务端安全注入。
- [ ] 本地待写回的角色语音字段方案已确定，失败重试不会重复创建成功声纹。

上述克隆条件未满足前不调用 `POST /v1/audio/voices`。本阶段只创建了预设音色 TTS 短样音；这些 3–6 秒短句不满足声纹克隆的参考音频时长要求。若后续继续克隆，需要先准备每张卡合格的 10–60 秒参考音频，并对当前 Buming 接受的音频来源与费用作单独核实。
