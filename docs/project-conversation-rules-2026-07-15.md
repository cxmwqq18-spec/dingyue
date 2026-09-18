# 项目历史对话规则整理

生成日期：2026-07-15
项目路径：`/Users/a1/work/ai-project/dingyue`

## 1. 来源与范围

本文件整理的是 Codex 本机历史对话中，和当前 `ai-project/dingyue` 项目相关的用户要求、反复修改点、不能动的规则、不能再出现的问题，以及已沉淀到项目技能和上线文档里的规则。

本次扫描来源：

- Codex 当前会话目录：`~/.codex/sessions`
- Codex 归档会话目录：`~/.codex/archived_sessions`
- 会话索引：`~/.codex/session_index.jsonl`
- 项目技能：`/Users/a1/.codex/skills/dreamshoot-frontend-english/SKILL.md`
- 项目上线清单：`docs/storefront-launch-checklist.md`
- 项目交接说明：`项目交接说明书_20260622.md`

本次统计口径：

- 相关主对话合计：`87` 条
- 未归档主对话：`54` 条
- 已归档主对话：`33` 条
- 子智能体原始会话不单独计入主对话数量；但如果子智能体结果已经汇总回主对话，会作为规则证据参考。
- “你是什么模型”这类低规则价值对话只做目录完整性统计，不作为项目长期规则来源。
- API key、服务器密码、临时 session、账号密码等敏感信息不写入本文档。

## 2. 一句话总规则

当前客户前台按四个店铺维护：正常站 MyDreamShoots（`www.mydreamshoots.com`）、AIdreamcapes（`www.aidreamcapes.com`），西班牙站 AIdreamshoots（`aidreamshoots.eu`）、AIdreamcapes（`aidreamcapes.eu`）。后续展开西班牙站工作时，不能影响正常两个 `.com` 站；做功能优化、路由修复、性能优化、SEO 结构修复、菜单/分类/工具修复时，默认覆盖所有适用店铺，不能只改一半。四店之间必须保持品牌、语言、域名、SEO 文案、图片资产和客户数据隔离。

## 3. 反复出现的修改点

| 主题 | 反复程度 | 用户反复强调的核心意思 | 必须沉淀的规则 |
| --- | --- | --- | --- |
| 主题分类和工具分类下拉框 | 极高 | 多入口数据不一致、详情页只剩当前分类、点击后布局变形、接口不能各查各的 | Browse packages 和 Tools 必须使用站点级完整导航数据。详情页正文可以按当前分类裁剪，但 Header 菜单不能被当前查询参数污染。 |
| 主题图片质量 | 极高 | 每个主题要 12 张图、不能重复、不能模糊、不能不符合主题、要有 alt | 每个主题详情页必须有 12 张清晰、可解码、主题相关、非重复图片。必要时用 AI 重新生成，不用共享素材池凑数。 |
| 视频生成 | 高 | 生图正确但视频失败、视频和上传图片无关、供应商接口变更、任务卡 running、credits 要退回 | 图生视频必须使用真正的 image-to-video 模型和正确参考图协议。供应商失败要有明确错误、结算重试、credits 释放。 |
| 前台 Google Translate | 高 | 有页面不能翻译，用户明确要求写入 skill 和上线文档 | 客户前台所有页面必须支持 Chrome/Google Translate。不能出现 `notranslate`、`translate=no` 或阻断翻译的 meta。 |
| 客户前台语言 | 高 | 客户可见前台不能混入中文或其它非预期语言 | 正常 `.com` 店铺前台必须英文；西班牙 `.eu` 店铺前台按西班牙语展开；后台/平台运营界面可以中文。 |
| 店铺同步与品牌隔离 | 高 | MyDreamShoots 改过的优化，AIdreamcapes 也要同步；但 AIdreamcapes 不能像 MyDreamShoots | 行为同步，文案隔离。不能出现跨站品牌泄漏、同句式套壳、同 SEO 结构、同分类命名痕迹。 |
| 四店覆盖与西班牙站隔离 | 高 | 新增两个西班牙站后，功能优化不能只改一半，也不能影响正常两站 | 功能/路由/菜单/性能/SEO 结构优化覆盖所有适用店铺；西班牙站内容、域名、客户数据与正常 `.com` 店铺隔离。 |
| 页面刷新和 loading | 高 | 切换模块不能像整个浏览器刷新；已有数据不能被 loading 遮罩盖掉 | 避免路由级全屏 loading、重复 runtime 请求、已有内容被全区遮罩覆盖。优化性能不能牺牲可见完整性。 |
| SEO 结构 | 高 | TDK、H1/H2/H3、alt、JSON-LD、nofollow 都被多次要求检查 | SEO 标签必须在 head 靠前；Header 菜单、弹层、一级/二级导航目录不要占用 H1/H2/H3；首页、目录正文和详情页要有合理 heading；图片/艺术字有可访问名称；Footer 页面链接 nofollow。 |
| 路由和内链 | 高 | 点击具体分类要跳详情页，不要停留首页过滤；404 要全站查 | 内链必须是真实可访问路由。老路径要归一或重定向，不能静默 404。 |
| 数据源一致性 | 高 | 后台数据和前端硬编码数据混用导致分类不一致 | 前台展示应走统一数据源或共享归一化模块。不能一边后台数据、一边硬编码 fallback。 |
| 本地端口和部署 | 中高 | 多次要求启动 3002，排查断开、部署、线上旧版本 | 本地默认用 `3002` 验证客户前台。线上排障先区分源站、Nginx、Cloudflare、应用代码。 |
| 登录和用户数据 | 中 | 用户没改密码却登不进去；如果数据被清要还原 | 登录问题先查数据库、session、认证链路和当前数据源。不能随便清用户数据。 |
| UI 布局一致性 | 中 | 顶栏、2x2、右侧卡片、详情页空白、下拉自适应高度 | 修布局要保留既有设计意图，解决目标问题，不能顺手大改架构或删模块。 |

## 4. 不能动的规则

这些是当前项目的硬约束。除非用户明确要求改掉，否则不能删除、弱化或随手重构。

| 规则 | 说明 |
| --- | --- |
| 客户前台 Google Translate 兼容 | 保留 `html/body translate="yes"`、正确 `lang`、`Content-Language`、`HtmlLangSync` 和根 layout 的翻译守护。不能加 `.notranslate` 或 `google notranslate`。 |
| 客户前台语言 | MyDreamShoots、AIdreamcapes `.com` 的客户可见页面必须英文；AIdreamshoots、AIdreamcapes `.eu` 的客户可见页面按西班牙语维护。中文只允许在后台、平台、内部运营和诊断界面。 |
| 导航完整性 | 不允许为了性能截断、隐藏、抽样 `packages`、`creativePacks`、`tools`、`toolMenuItems`、Header 菜单、移动端菜单、目录页。 |
| MyDreamShoots 艺术字 | 当前技能记录的可视品牌标题是 `myᕲreamshoots`；可访问名称用 `MyDreamShoots`。之前试过的 `ʍʏƉʀɛǟʍֆhoots` 已被标记为废弃，不要重新引入。 |
| AIdreamcapes 艺术字 | 上线清单记录可视品牌标题为 `ልiጋreamርapes`；可访问名称用 `Aidreamcapes`。 |
| SEO head 位置 | `<title>`、description、keywords、canonical、OG/Twitter、JSON-LD 必须在 `<head>` 里且靠前，不能挪到 body 或 client-only effect。 |
| Storefront Four-Store Rule | 任一店铺的客户前台功能修复，默认检查所有适用店铺。同步功能行为，但品牌、语言、文案、SEO、分类、图片、客户数据必须隔离。 |
| 西班牙店铺隔离规则 | AIdreamshoots（`aidreamshoots.eu`）和 AIdreamcapes（`aidreamcapes.eu`）是独立西班牙店铺，展开站点结构时不得影响 MyDreamShoots / AIdreamcapes 正常 `.com` 店铺。 |
| 域名绑定规则 | `www.mydreamshoots.com`、`www.aidreamcapes.com` 是正常店铺前台域名；`aidreamshoots.eu`、`aidreamcapes.eu` 是西班牙店铺前台域名；`www.mydreamshoots.xyz` 是平台后台域名；旧 `www.javawebshop.site` 已废弃。 |
| Nginx 店铺 vhost | 不要改 `/www/server/panel/vhost/nginx/mydreamshoots.com.conf`，除非明确是修 MyDreamShoots 店铺线上故障。改 Nginx 必须 `nginx -t` 再 reload。 |
| 敏感凭据 | API key、SSH 密码、Cloudflare token、供应商 key、临时登录 session 不写入仓库文档，不在最终回复完整打印。 |
| 脏工作树保护 | 当前工作区长期有大量未提交改动。不能 `git reset --hard`、不能回滚他人改动、不能覆盖正在修改的文件。 |
| 数据迁移可重复 | 站点数据、footer、policy、主题图片、分类数据要优先走迁移/同步脚本，不要只手改单个本地 JSON。 |
| 生成资产展示 | 生成结果页不要把用户上传的原始照片当成产出资产展示；产出列表应展示 AI 生成结果。 |

## 5. 不能再出现的问题

| 问题 | 风险 | 检查方式 |
| --- | --- | --- |
| Header 主题菜单在详情页只剩 1 个分类或 1 个主题 | 用户会认为分类数据乱了 | 在 package detail、tool detail、workspace、多站点入口打开 Browse packages 和 Tools，确认完整分类数量。 |
| 主题下拉框样式被 header 或页面内容切穿 | 视觉明显错误 | 用宽屏、移动端、登录态 workspace 和公共页都测菜单 top、宽度、遮挡。 |
| 主题图片重复、模糊、损坏、不符合主题 | 影响转化和 SEO | 跑图片数量、尺寸、SHA、pHash、清晰度、可解码、alt 审计。 |
| 用共享 fallback 素材池凑 12 张图 | 会导致跨主题重复 | 如果没有独立图，使用 AI 生成或补独立素材，不用同一套后半段图。 |
| 图库 DOM 把 cover、CTA、favorite 预览也算进 12 张 | 会造成“图片数量不对” | 检查脚本只匹配真正的 gallery/example 区域。 |
| 客户前台出现中文 | 违背 skill 和上线清单 | 修改前台后跑中文扫描并人工区分 admin/internal 命中。 |
| Google Translate 失效 | 用户已多次要求不要再改坏 | 检查 DOM 翻译属性、无 `notranslate`，并抽查 Chrome 翻译弹窗。 |
| 页面切换整页白屏或像浏览器刷新 | 用户体验差 | 避免 route-level loading 替换整页；用延迟进度条或局部 loading。 |
| 已有数据被 loading 遮罩盖住 | 用户以为数据丢失 | runtime refresh 不应把已有工作区全区覆盖。 |
| `/customer/runtime?profile=workspace` 持续刷新 | 造成右侧工作区闪烁 | 检查 hook/effect 依赖和 refresh 参数，缓存 bootstrap/runtime。 |
| `/help` 和 `/faq` 重复或文案错成 Help | SEO 分流和用户困惑 | 统一 FAQ 路由和 canonical；界面文案该是 FAQ 就显示 FAQ。 |
| 具体分类点击停留首页过滤 | 与用户定义的导航行为冲突 | 首页标签点击应跳对应分类详情页。 |
| 视频和上传图片没有关系 | 核心功能失真 | 确认 starter image 正确、参考图尺寸正确、模型是 image-to-video、供应商协议正确。 |
| 视频 job failed 但总状态 running | credits 和 UI 状态错误 | result callback 需要重试，失败要 settle 并释放 credits。 |
| 供应商接口改了但 worker 还用旧协议 | 视频创建失败或 524 | 对照 SmartPickLid 文档更新 JSON/multipart 分支和 smoke 断言。 |
| 跨站品牌或文案泄漏 | 两站看起来像复制站 | 抽查 AIdreamcapes 是否出现 MyDreamShoots 文案、分类、CTA、邮件、SEO 句式。 |
| SEO 标签进入 body 或太晚 | 搜索引擎读取不稳定 | 查 raw HTML source，确认 head 靠前。 |
| 图片缺 alt 或艺术字不可访问 | SEO/可访问性缺陷 | 静态扫描 `<img>`，页面抽查 img alt、aria-label、title。 |
| 404 未全站检查 | 用户不断发现坏页 | 新增路由或修 404 时跑公共链接扫描。 |
| 线上还是旧版本 | 用户误判修复无效 | 排查服务器运行目录、构建产物、systemd、Nginx、Cloudflare 缓存。 |

## 6. 主题分类和工具分类规则

### 6.1 数据来源

- Browse packages、Tools、移动端菜单、公开页 Header、登录后 Header、workspace、账号页、详情页都必须使用统一归一化数据。
- 已经出现过的问题是：公开页走后台 `toolMenuItems`，登录态走硬编码 `toolGroups`，`/login` 又传了空 render data，导致不同入口显示不同分类。
- 主题分类已经沉淀为共享方向：`photo-package-taxonomy.ts` 这类公共分类模块必须作为单一来源。
- 工具分类也应该走共享菜单视图，不能继续保留多套 fallback 命名，例如 `Photo Package Edit` 与 `AI Photo Edit` 混用。

### 6.2 缓存和完整性

- 用户明确要求：主题分类和工具分类数据基本固定，第一次查询后可以记录在前端缓存，后续下拉直接取缓存，避免每次点击乱变化。
- 性能优化不能通过删减分类、只返回当前主题、只返回首屏几项来实现。
- 详情页可以让正文只展示当前主题，但 Header 导航必须拿完整站点级 categories/packs/tools。

### 6.3 交互规则

- 首页具体主题标签点击应跳到具体分类详情页，不是在首页过滤当前列表。
- 下拉框顶层按钮应负责展开/收起；具体链接在下拉内容中跳转。
- 下拉框高度要自适应，宽度和 top 要根据当前 header 动态计算，不能写死导致切穿或变形。
- 所有入口点击查询到的数据和布局必须一致。

## 7. 图片资产规则

| 规则 | 当前标准 |
| --- | --- |
| 每个主题数量 | 每个主题详情页 `12` 张图库图。 |
| 尺寸 | 历史验证标准多次使用 `1024x1024 webp`，至少要清晰、可解码、无空白。 |
| 重复 | 同主题和跨主题都不能出现明显重复。 |
| 主题相关性 | 图片必须符合当前主题，不能用不相干婚礼、旅行、泛化人物图凑数。 |
| alt | 每张客户需要理解的图片必须有描述性 alt；生成视频用 `aria-label/title`。 |
| AI 生成 | 当本地独立素材不足时，必须用 AI 生图重新生成，不用裁切共享素材池糊弄。 |
| 供应商原图 | 供应商/API 生成图必须保留未改动的原始文件，并作为原图预览与下载源；未经用户明确同意，不得裁切、重构图、拉伸、改画幅或覆盖原图。布局适配只能用 CSS 完整展示，或另存明确标注的 derivative，不能覆盖 master。 |
| MyDreamShoots 参考 | MyDreamShoots 曾验证为 `26` 个主题、`312` 张图、每类 `12` 张、精确重复 `0`、近重复 `0`。 |
| AIdreamcapes 修复方向 | AIdreamcapes 曾出现 `300` 张里只有 `144` 个唯一图的严重重复，需要 AI 重新生成并审计。 |

建议每次图片相关修改后跑：

```bash
node scripts/audit-creative-pack-covers.mjs
npm run typecheck
```

如果有专用图库审计脚本，应同时检查：

- 目录数量
- 每目录图片数
- 文件尺寸
- 图片可解码
- SHA 精确重复
- pHash/dHash/aHash 近重复
- 清晰度指标
- DOM 中 img alt

## 8. 视频生成和供应商规则

### 8.1 用户关注点

- 生图正常但视频失败，通常是视频步骤或供应商协议问题。
- 视频必须和上传图片、starter image 保持关系，不能变成泛化人物。
- 管理员或客户账号不能因为视频生成流程被错误要求订阅方案。
- 失败要清晰提示，不能泛泛显示 generator failed。
- credits 必须正确释放，job 不能卡 running。

### 8.2 SmartPickLid 规则

- 需要以最新文档为准：`https://api.smartpicklid.com/docs/`
- `grok-imagine-video` 当前按 JSON/data URI 方式适配，使用 `image/images`、`aspect_ratio`、`resolution`、`seconds`。
- 旧 multipart `input_reference` 只适合部分 Grok Video 3 类模型，不能一律套用。
- 创建、轮询、下载都要有 smoke 断言，防止回退旧协议。

### 8.3 Magic666 / NewAPI 规则

- Magic666 是 OpenAI-compatible 视频接口供应商。
- 供应商 key 不能完整打印或写入文档。
- 新增供应商不应设为全局图片默认，避免影响生图；视频 provider 队列可单独调整优先级。

### 8.4 回归点

- 带参考图的请求必须优先 image-to-video 模型，不要先用 text-to-video 消耗 credits。
- 如果供应商返回 `524`，前端应提示“视频供应商创建任务超时”。
- result callback 对 5xx/网络错误要重试，4xx 签名或参数错误快速失败。
- 修改 worker 后跑：

```bash
node scripts/smoke-worker-video-provider.mjs
npm run smoke:video-workspace
npm run typecheck
```

## 9. 前台语言、SEO、合规规则

| 类别 | 规则 |
| --- | --- |
| 前台语言 | 正常 `.com` 店铺客户可见页面必须英文；西班牙 `.eu` 店铺客户可见页面按西班牙语维护。后台、平台、内部诊断可中文。 |
| Google Translate | 所有客户前台页面支持 Chrome/Google Translate，是上线门槛。 |
| TDK | 两站首页 title、description、keywords 按 `docs/storefront-launch-checklist.md` 记录检查。 |
| Head 顺序 | SEO 标签、canonical、JSON-LD 必须在 head 内靠前。 |
| H1/H2/H3 | Header 弹层、移动菜单、一级/二级导航目录名只用普通导航文本；首页正文用 H1/H2/H3，Browse packages / collections 正文套餐入口用 H2，Tools 正文工具分类和入口用 H3，详情页保持合理 H1/H2/H3。 |
| Footer nofollow | Footer 页面链接带 `rel="nofollow"`；外部社交链接带 `nofollow noopener noreferrer`。 |
| FAQ/Help | FAQ 是主要语义；`/help` 可归一到 `/faq`，避免重复内容。 |
| Policy | 儿童隐私、州隐私、公司资料需要两站同步维护。 |

客户前台改动后，至少检查：

```bash
npm run typecheck
rg -n "[\p{Han}]" src/components/storefront src/components/app src/lib/storefront-render.tsx src/components/theme-renderer.tsx
```

并抽查 DOM：

```js
({
  lang: document.documentElement.lang,
  htmlTranslate: document.documentElement.getAttribute("translate"),
  bodyTranslate: document.body.getAttribute("translate"),
  googleNoTranslate: !!document.querySelector('meta[name="google"][content*="notranslate" i]'),
  blockedTranslateNodes: document.querySelectorAll('[translate="no"], .notranslate').length
})
```

## 10. 两店公司和政策资料

这些资料已经写入上线清单，不要随意改动。调整 footer、policy、JSON-LD、结构化公司信息时要同步检查。

| 站点 | 公司 | 地址 | 电话 | 邮箱 | 税号 |
| --- | --- | --- | --- | --- | --- |
| `www.aidreamcapes.com` | `BLYDEYUS INC` | `30 N GOULD ST STE R,SHERIDAN,WY 82801` | `(+1)307-310-3014` | `support@aidreamcapes.com` | `41-5317529` |
| `www.mydreamshoots.com` | `MRNARUEBET LLC` | `8 THE GREEN STE B,DOVER,DE 19901` | `(+1)302-200-5780` | `support@mydreamshoots.com` | `98-1926243` |

州名规则：

- `WY` = `Wyoming`
- `DE` = `Delaware`

政策页规则：

- 两站都有 `/children-privacy`
- 两站都有 `/state-privacy`
- 相关别名要归一到短路径
- Footer 最底部要有 `Children's Privacy` 与 `State Privacy Rights`
- 链接带 `rel="nofollow"`

## 11. 性能和 loading 规则

| 规则 | 说明 |
| --- | --- |
| 不要整页白屏 | 模块切换不能因为 route-level loading 变成整页刷新感。 |
| 不要全区遮罩已有数据 | 刷新 runtime 或任务状态时，已有内容要保留可见。 |
| 不要持续重复 runtime 查询 | 工作区生图/视频时不能不断触发 `/customer/runtime?profile=workspace` 造成闪烁。 |
| 优化查询形状 | 性能优化应从字段裁剪、缓存、memo、按需加载、请求去重做起。 |
| 不删可见内容 | 不能用减少主题、工具、目录项的方式提高速度。 |
| Google Translate payload | 页面 RSC/HTML 过大可能影响翻译，详情页数据可裁剪，但 Header 完整导航必须单独保留。 |

## 12. 开发和部署规则

- 本地常用端口：`3002`。
- 端口断开曾定位为 Next dev server 内存阈值重启，`dev:3002` heap 调到 `12288MB`。
- 如果 3002 已被占用，先确认是不是当前应用，不要随便杀进程。
- 线上排障顺序：应用源站、Nginx、Cloudflare、构建产物、运行目录、systemd。
- `www.mydreamshoots.com` 店铺前台和 `www.mydreamshoots.xyz` 平台后台不要混。
- 服务器 SSH 密码、API key 不进仓库和文档。
- 改 Nginx 后必须 `nginx -t`。
- 部署前应跑 `typecheck`、相关 smoke、必要时 `build`。

## 13. 按对话整理的主线索引

标记说明：

- `U` = 未归档
- `A` = 已归档
- “规则价值”只表示该对话对本文档规则的贡献，不评价任务重要性。

| 状态 | 日期 | 对话标题 | 主要要求 / 规则价值 |
| --- | --- | --- | --- |
| U | 2026-07-15 | 整理对话归档 | 本次整理请求。 |
| U | 2026-07-16 | 西班牙店铺名称和域名调整 | 两个西班牙店铺固定为 AIdreamshoots（`aidreamshoots.eu`）和 AIdreamcapes（`aidreamcapes.eu`）；西班牙站工作不得影响正常 `.com` 两站；功能优化必须覆盖所有适用店铺。 |
| U | 2026-07-15 | 修复分类模块联动问题 | 生图视频选择分类时首页文案只展示 title；分类后数据对不上；应用提示和标签是否并入提示词要明确。 |
| U | 2026-07-15 | 创建智能体排查店铺问题 | 工具分类下拉自适应高度；FAQ 不要变 Help；账号密码登录异常要排查并恢复数据。 |
| U | 2026-07-15 | 新增10个主题分类 | AIdreamcapes 增加非旅游一级分类；详情、12 张图、封面、alt、AI 生图、非重复。 |
| U | 2026-07-15 | 同步店铺优化 | MyDreamShoots 的优化要同步到 AIdreamcapes，但文案要按品牌隔离。 |
| U | 2026-07-15 | 补充主题分类图片 | 12 图、alt、清晰、参考 MyDreamShoots；重复图必须用 AI 生图处理。 |
| U | 2026-07-15 | 统一工具分类下拉数据 | 工具分类多入口数据和布局必须一致；后台数据与前端分类不能混乱。 |
| U | 2026-07-15 | 丰富主题分类内容 | 所有主题详情都要统一丰富，不只改截图页。 |
| U | 2026-07-15 | 排查中文翻译失效 | Google Translate 支持是硬规则，不能再被改坏。 |
| U | 2026-07-15 | 修复下拉框样式异常 | 下拉框布局变形、详情页菜单只剩当前结果、404 全站排查。 |
| U | 2026-07-15 | 统一主题分类查询入口 | 主题分类查询接口要统一；固定数据应缓存，不能每个入口不同。 |
| U | 2026-07-15 | 启动本地项目 | 3002、SmartPickLid 接口调整、Magic666、新视频供应商、worker 协议。 |
| U | 2026-07-15 | 识别模型 | 夹杂图片 SEO/alt 审计和主题详情 SEO 修复，规则价值中。 |
| A | 2026-07-15 | 查看对话进度 | 继续已有任务，规则价值低。 |
| A | 2026-07-15 | 识别当前模型 | 启动 3002，规则价值低。 |
| A | 2026-07-15 | 识别模型 | 主题详情图片重复、图片不符合主题、图片展示不全和模糊，规则价值高。 |
| U | 2026-07-15 | 排查视频生成失败 | 生图正常但视频失败；视频 provider create 阶段、代理和 524 处理。 |
| U | 2026-07-15 | 优化工具分类详情布局 | 工具详情左侧空白、右侧卡片上移、Header 完整导航。 |
| U | 2026-07-15 | 修复首页主题分类查询 | 首页主题直接查询全部数据；封面图必须唯一且符合主题。 |
| A | 2026-07-14 | 内链整理 Excel | 整理 MyDreamShoots 内链，规则价值中。 |
| U | 2026-07-14 | 后台账号密码登录 | 后台账号密码登录异常要排查数据和认证链路。 |
| U | 2026-07-14 | 修复默认封面图与加载态 | 上传图片不能显示错误默认封面；需要 loading 动作。 |
| A | 2026-07-14 | 内链整理续做 | 内链整理延续，规则价值中。 |
| U | 2026-07-14 | 首页分类标签跳详情页 | 首页具体主题标签应跳详情页；生图/视频不能触发整页刷新。 |
| A | 2026-07-14 | 排查并修复视频生成报错 | 视频报错和供应商排查，规则价值高。 |
| U | 2026-07-14 | 儿童隐私页和页脚 | COPPA、州隐私、公司资料、footer 最底部入口、政策互链。 |
| A | 2026-07-14 | 排查视频生成报错 | 视频生成延续，规则价值中。 |
| U | 2026-07-14 | Identify model | 后台已删除 `image1` 后不应再调用旧图片，规则价值中。 |
| A | 2026-07-14 | 排查视频生成失败 | 视频失败延续，规则价值中。 |
| A | 2026-07-13 | 检查 Google SEO 合规 | SEO 合规、翻译、结构化数据，规则价值高。 |
| U | 2026-07-13 | H2/H3 分类模块 | 用 H2/H3 划分分类模块，`/workflow` 回归。 |
| U | 2026-07-13 | 视频人物不像 | 视频生成不能忽略人物参考；提示文字颜色要清晰。 |
| U | 2026-07-13 | 启动本地项目 | Google Translate 不能再改坏，并要求写入 skill 和上线文档。 |
| A | 2026-07-13 | 西班牙店铺文案 | 回复用中文；多语言店铺另有隔离要求。 |
| U | 2026-07-13 | 步骤三生图编辑流程 | 生图编辑流程、步骤和提示词逻辑，规则价值中。 |
| U | 2026-07-12 | 视频无法播放 | 视频播放故障排查，规则价值中。 |
| U | 2026-07-11 | 图视频问题 | 视频看不了要排查并修复。 |
| U | 2026-07-08 | 两店合规性 | 图片损坏、两店合规、前台检查。 |
| A | 2026-07-08 | 登录跳转与本地报错 | 选择图片卡顿、多图支持、生成视频报错。 |
| U | 2026-07-07 | section 视口懒挂载 | 性能优化要按视口挂载，不删内容。 |
| U | 2026-07-07 | 上下文窗口限制 | 长任务延续，规则价值低。 |
| A | 2026-07-07 | fast 无法打开 | 工具读取失败影响排查，规则价值低。 |
| A | 2026-07-07 | skills 分类组合 | 电商和前端任务要对症使用 skills。 |
| A | 2026-07-06 | 生图提示词逻辑 | 服务端 SSR 首屏，后续 section 视口请求渲染。 |
| A | 2026-07-06 | 生图列表和走马灯 | 工具启动报错排查，规则价值低。 |
| A | 2026-07-06 | 终端控制台交互遮罩 | 线上登录旧页面、本地登录报错、补丁上线。 |
| U | 2026-07-05 | 查明模型 | 低规则价值。 |
| U | 2026-07-05 | 图文交互 | 生图完成后关闭弹窗并切到 All 模块，不能跳 404。 |
| U | 2026-07-05 | 标题变形与保存上线 | 左上角回首页要响应迅速；上线保存要有效。 |
| U | 2026-07-02 | 当前文件调整 | 所有页面顶部 top 栏布局大小一致。 |
| U | 2026-07-01 | 婚礼主题封面重复 | 婚礼主题封面重复修复，规则价值高。 |
| A | 2026-07-01 | 了解模型 | 首次查询慢、产出资产不显示上传原图、图片左右布局。 |
| A | 2026-06-30 | gpt-image-2 API | 图像供应商/API 接入，规则价值中。 |
| A | 2026-06-30 | 启动本地项目 | 长任务延续和启动，规则价值中。 |
| U | 2026-06-29 | 分批优化站点文案 | 站点文案批量优化，不能有 AI 味和跨站痕迹。 |
| U | 2026-06-29 | 继续修复 | 延续站点修复，规则价值中。 |
| U | 2026-06-28 | 部署相关 | 部署凭据相关内容已脱敏；规则是敏感信息不入文档和 git。 |
| U | 2026-06-27 | 首页主题分类数量不全 | 首页主题分类数量必须完整。 |
| U | 2026-06-27 | 推广合作者申请页 | 线上变化验证、版本是否回退。 |
| U | 2026-06-27 | 艺术标题 | 早期曾要求恢复艺术字；当前 skill 以后来批准的 `myᕲreamshoots` 为准。 |
| A | 2026-06-26 | 登录白屏和部署 | AIdreamcapes 不要重复主题图片、不要婚礼图泄漏、文案分类工具不能像 MyDreamShoots。 |
| U | 2026-06-26 | 继续修复 | sitemap、政策路径、工具页文案、TDK 清洗。 |
| U | 2026-06-25 | 首字母大写 | 前台回归：账户、工作区、套餐、工具、上传、多图、estimated outputs。 |
| U | 2026-06-25 | 静态路径与内链 | 静态地址、内链路径、DreamShootAI 生图步骤分析。 |
| U | 2026-06-25 | 启动本地项目 | 3002 启动、旧进程处理。 |
| U | 2026-06-25 | 切换模块整页刷新 | 删除或避免后台路由级 loading 导致整页白屏。 |
| U | 2026-06-22 | 工具下拉跳转 | 工具下拉点击跳工具操作页；2x2 布局还原。 |
| A | 2026-06-22 | CRUD 数据存储位置 | 数据库/JSON/Prisma、creative pack 编辑字段、部署同步。 |
| U | 2026-06-22 | 项目交接内容 | 交接、性能、模块切换、请求去重、AbortController。 |
| U | 2026-06-21 | 重启项目查看功能 | 本地/线上数据源、线上接口是否来自线上服务器。 |
| A | 2026-06-21 | 生成多个智能体 | 前台性能、公开页面轻量数据、预取、无整页 skeleton。 |
| U | 2026-06-21 | 分析 DreamShootAI | 竞品功能和架构分析，影响后续功能规划。 |
| U | 2026-06-20 | 拉取并启动项目 | 初始项目拉取、启动、部署和账号保存问题。 |

## 14. 后续做任何改动前的检查清单

1. 先确认这次改动属于客户前台、后台、平台、worker、部署还是数据迁移。
2. 如果碰客户前台，默认启用 `dreamshoot-frontend-english` 规则。
3. 如果改任一客户前台功能，检查所有适用店铺：MyDreamShoots、AIdreamcapes `.com`、AIdreamshoots `.eu`、AIdreamcapes `.eu`。品牌、语言、SEO、素材、客户数据保持隔离。
4. 如果改菜单、分类、工具、详情页，确认 Header 使用完整站点级导航数据。
5. 如果改图片，跑数量、重复、清晰、alt、主题相关性检查。
6. 如果改视频，跑 worker provider smoke、视频工作区 smoke、credits/job settle 检查。
7. 如果改 SEO 或路由，查 raw HTML head、canonical、JSON-LD、H1/H2/H3、404。
8. 如果改客户前台文案，扫中文字符并抽查页面可见文本。
9. 如果改 layout 或 route shell，检查 Google Translate 兼容属性。
10. 如果改部署或服务器，先确认域名绑定、Nginx、systemd、源站、Cloudflare，不暴露敏感凭据。

## 15. 建议新增自动化守护

这些问题重复出现，建议长期保留或新增 smoke/audit 脚本：

- `smoke-storefront-mega-menu-position.mjs`：菜单定位、宽度、完整分类、多入口矩阵。
- `smoke-storefront-public-routes.mjs`：两站公共路由和 404 扫描。
- `smoke-public-translation-policy.mjs`：Google Translate 属性和 notranslate 阻断检查。
- 图片图库审计脚本：数量、尺寸、重复、清晰、alt。
- `smoke-worker-video-provider.mjs`：SmartPickLid/Magic666 协议、模型候选、状态兼容、callback retry。
- `smoke-video-workspace-regression.mjs`：视频工作区错误文案、job 状态、credits。
- SEO raw HTML 检查：head 靠前、JSON-LD、canonical、TDK。

## 16. 结论

历史对话里最明显的模式是：同类问题反复出现，往往不是单个页面 bug，而是共享数据源、fallback、迁移脚本、客户前台规则和回归测试没有统一。后续修复要优先把规则放进共享模块、迁移脚本和 smoke，而不是只修截图页面。

最需要守住的底线是：

- 分类和工具数据完整一致。
- 图片独立、清晰、12 张、有 alt。
- 客户前台语言正确且可 Google Translate。
- 四店功能优化覆盖所有适用店铺，但品牌/语言/文案/SEO/素材/客户数据隔离。
- 视频任务和 credits 状态可靠。
- 不泄露敏感信息，不回滚脏工作树。
