# AIVideosUGC SEO 路径整改计划

状态：第一至第三阶段及 5 条案例短地址试点已在本地实施并验收；尚未发布到生产。案例继续保持 noindex，开放索引须满足第七节的内容条件。

实施结果见 [本地整改与验收记录](../audits/aidreamcapes-seo-path-local-implementation-2026-10-21.md)。原始线上基线与下述生产发布要求仍然有效。

范围：`site_aidreamcapes` 与 `https://www.aivideosugc.com`。

## 1 目标与实施顺序

先补齐平台目录，统一分类页与筛选地址的规则，再修正行业素材相关性；案例地址简化安排为独立的后续迁移。保留已正常工作的首页、工具页、模板目录、演员页和工作台地址。

完成后的用户链路为：

```text
首页或导航
  → 模板目录 / 行业目录 / 平台目录 / 场合分类
  → 对应的模板页或素材详情
  → 固定的工作台功能地址，携带所选素材
```

目录可引用同一个素材；素材保持一个身份与一个规范详情地址。分类变化不能再生成一份素材或第二个详情页。

## 2 线上检查基线

基线为 2026-10-21 15:33 至 15:38（北京时间）的生产只读结果。生产代码为 `918ab3a19e421ac515015b94b6264535452fe6a7`。实施前重新核实当前代码与关系数据，不能直接套用旧计数。

| 检查项 | 已确认结果 | 整改处理 |
|---|---|---|
| sitemap | 177 个唯一地址，均为规范 HTTPS 主机，不包含工作台 | 保持规范，新增目录后按实际可索引实体计算数量 |
| 模板目录 | `/templates`、`/templates/photo`、`/templates/video` 抽检 200、自引用 canonical | 保留这些地址 |
| 平台总目录 | `/platforms` 301 到 `/ai-video-generation`；站内存在 By platform 链接 | P1：补真实平台目录 |
| 平台详情 | `/platforms/youtube-shorts-ads` 200，可索引 | 保留有效地址，不为贴近菜单文字而强行改名 |
| 类型筛选 | `/templates?kind=photo` 返回 200，canonical 为 `/templates` | P1：与固定图片目录统一 |
| 行业和平台筛选 | 过滤生效，但 canonical 均为 `/templates` | P1：明确等价分类、组合筛选的不同处理 |
| 行业示例 | `/industries/shoes` 的模板卡展示皂液瓶、音箱、行李箱 | P1：区分可复用工具与鞋类实例，补真实对应素材 |
| 素材详情 | 抽检 200、自引用 canonical、`noindex, follow` | 保留当前索引策略，另行评审可索引案例 |
| 演员旧地址 | `/ai-actors/men/adrian` 308 到 `/ai-actors/adrian` | 保持已有修复 |
| 工作台 | `noindex, nofollow`，不在 sitemap | 保持私有功能边界 |
| 场合总目录 | `/occasions` 404；具体场合页可访问 | P2：根据真实导航需求补目录，不把父路径 404 自动认定为 SEO 故障 |

数据中存在 1005 处 `publicSlug` 引用，按 slug 去重为 987 个；18 处重复来自同一 owner 的模板卡与 picker 引用，不能当成 18 个重复页面。其中 674 处引用含来源目录的重复文字；该数量不等于死链数量，也不等于必须迁移的页面数量。

注意媒体类型：

```text
/ai-video-generation/close-unboxing-makeup-tools-ai-image-generation-sale-campaign-key-visual
```

该案例类型为 video，线上返回 200。把相同 slug 拼到图片前缀下返回 404，不构成当前站内死链证据。后续检查必须使用实际卡片类型、公开链接和 owner。

原始证据：

- [生产路径读回](../../releases/aidreamcapes/seo-path-assessment-20261021/production-readback.json)
- [目录与筛选读回](../../releases/aidreamcapes/seo-path-assessment-20261021/followup-readback.json)
- [案例类型与长地址核验](../../releases/aidreamcapes/seo-path-assessment-20261021/long-slug-check.json)

## 3 URL 与页面职责

| 页面职责 | 本轮规范地址 | 索引策略 |
|---|---|---|
| 模板总目录 | `/templates` | 内容完整时 index，进入 sitemap |
| 图片模板目录 | `/templates/photo` | index，进入 sitemap |
| 视频模板目录 | `/templates/video` | index，进入 sitemap |
| 行业目录与行业页 | `/industries`、`/industries/{现有slug}` | 有真实独立内容时 index |
| 平台目录与平台页 | `/platforms`、`/platforms/{现有slug}` | 有真实独立内容时 index |
| 场合分类 | `/occasions/{现有slug}` | 保留；总目录作为后续补项 |
| 工具或模板介绍页 | 现有 `/ai-image-generation/{slug}`、`/ai-video-generation/{slug}` | 保留各页当前有效索引状态 |
| 具体素材详情 | 现有按 photo/video 区分的规范地址 | 默认 `noindex, follow`，不进入 sitemap |
| 演员详情 | `/ai-actors/{actorSlug}` | 保留已验证的规范地址 |
| 工作台 | `/app/create/ai-image-generation`、`/app/create/ai-video-generation` 等固定功能地址 | noindex，不进入 sitemap |

目录名称与 URL 的含义应一致，但不要求菜单文字逐字等于 slug。例如 YouTube Shorts 菜单可以继续指向 `/platforms/youtube-shorts-ads`。第一阶段不新增 `/tags/*`，也不批量重命名有效地址。

面包屑明确“分类 → 模板或工具 → 素材”的关系。一个素材被多个目录引用时，返回分类链接可以展示多个真实归属，canonical 仍只有一个。

## 4 第一阶段补齐平台目录

### 4.1 页面内容与数据

为 `/platforms` 建立独立的当前 `LivePage` owner，采用现有目录视觉，展示当前六个平台页：TikTok、Instagram、Facebook、YouTube Shorts、Amazon、Shopify。

平台名称、说明、图片和链接由当前关系数据提供。页面需要独立 title、description、H1、简短导语和平台入口；说明实际支持的广告或商品图片用途，避免承诺未提供的平台集成功能。

不复制六个平台页的正文，不通过前端请求加载目录数据，不在代码中硬编码整页公开文案。

### 4.2 路由与上线顺序

1. 核查 `/platforms` 的重定向来源及路由优先级，列出确切修改文件。
2. 准备完整的新页面字段清单；新建操作使用 `expectedAbsent`，已有记录使用当前版本 CAS。
3. 若现有解析器已支持“当前 LivePage 优先”，先验证新 owner 即可正常渲染；否则先交付受站点限制的支持代码，再应用页面清单。
4. 最后解除将 `/platforms` 指向视频总页的规则，确保其稳定返回 200。
5. 导航、目录间链接、canonical、面包屑和 sitemap 统一到 `/platforms`。

验收：`/platforms` 返回 200，只有一个 H1 与 canonical；六个入口落到对应平台页；禁用 JavaScript 后仍可完整浏览。

## 5 第二阶段统一筛选地址

### 5.1 参数契约

以当前真正支持的 `kind`、`industries`、`platforms`、`occasions` 为有效筛选键。`type` 等历史键只在已验证的兼容映射内处理。

分类值解析到当前有效目录 owner。查询参数不得成为任意跳转地址；外部 URL、未知分类、重复键和非法编码必须有明确的校验结果，不能悄悄展示全部模板。

### 5.2 地址处理表

| 输入示例 | 目标规则 |
|---|---|
| `/templates?kind=photo` | 308 到 `/templates/photo` |
| `/templates?kind=video` | 308 到 `/templates/video` |
| `/templates?type=photo` | 经兼容映射直接到 `/templates/photo`，避免两次中转 |
| `/templates?industries=/industries/shoes` | 先比较实际列表与分类用途；确实等价时直接到 `/industries/shoes` |
| `/templates?platforms=/platforms/youtube-shorts-ads` | 同样通过等价检查后才归到平台页 |
| `/templates?kind=photo&industries=/industries/shoes` | 规范成 `/templates/photo?industries=...`，保留行业条件；若目的页丢失图片条件则不得跳过去 |
| 多维组合筛选 | 保留可分享、可服务端渲染的规范参数地址，默认 `noindex, follow`，不进入 sitemap |
| 类型目录带重复或冲突 kind | 路径类型优先，移除 kind 并一次跳到规范地址，页面选择器与最终结果一致 |
| 空筛选值、重复排序形式 | 规范化参数与顺序，不能造成循环重定向 |

未能归到等价固定页面的有效筛选结果，保留 SSR 结果，采用 `noindex, follow` 与规范化后的自引用 canonical，不再一律 canonical 到未筛选总目录。未知分类应展示真实空结果并 noindex；语法非法输入返回明确的请求错误，不伪造分类页。

含追踪参数的地址不进入 canonical 或 sitemap；如分析系统需要先记录参数，应保留采集能力，不能为清理 URL 破坏归因。不得把业务筛选参数当成追踪参数删除。

### 5.3 索引与抓取

固定分类页承担搜索落地职责；任意组合筛选不批量生成可索引页面。导航与正文优先链接固定目录，不枚举全部筛选组合。

不依靠 robots.txt 屏蔽来让搜索引擎读取 noindex；若未来需要控制筛选抓取预算，应结合实际爬虫日志与 Search Console 单独设计。

验收：同一筛选在归一化前后返回相同素材集合；排序、分页和空结果不丢失；所有重定向无循环，站内链接直接指向最终地址。

## 6 第三阶段改进行业素材与归属

以 `/industries/shoes` 为试点，将目录的“通用模板能力”与“鞋类实际示例”分开展示。保留确实适用的颜色变化、多角度等能力入口，同时展示经核验的鞋类素材，避免通用示例被误认为鞋类案例。

采用已有 [素材分类投放设计](aidreamcapes-media-category-placement-design-2026-10-21.md) 的归属方案，不再建设另一套标签系统：

- 模板归属保持 `templateDirectory.paths` 的实际展示关系，并校验模板定义一致性。
- 非模板素材按经确认的卡片 `placement` 投放；不从旧 chips 或 owner 页自动继承行业。
- 同一素材可进入多个分类，分类页引用相同素材身份与详情地址。
- 详情页显示某分类时，该分类必须实际能找到素材；分页后应给到可定位的页码或入口。
- 不为增加行业页数量复制相同正文和相同示例；没有合适素材时列为待补，不生成虚假示例。

首批仅处理经人工确认的鞋类素材。图片、alt、标题必须与实际素材相符，不通过把音箱 alt 改成鞋子来完成验收。需要新素材时单独列明需求，不自动运行生成任务。

验收：鞋类示例真实为鞋类，素材详情与目录双向可达；多个目录复用素材不产生多个规范详情地址。

## 7 第四阶段评审案例索引和地址简化

### 7.1 索引评审

本轮先保持现有案例详情的 `noindex, follow`，不批量开放索引。以下条件全部满足后，才将少量案例列为可索引试点：

1. 有稳定的素材身份与独立当前数据 owner。
2. 内容能回答用户关于该案例的具体问题，具有真实示例、适用场景、操作说明或输出限制。
3. title、description、H1、主图与正文对应，没有内部提示词或生成要求泄漏。
4. 与工具页及相似案例之间有明确内容区别，具备目录入口。
5. canonical、OG、JSON-LD、robots 和 sitemap 都消费同一身份与索引决定。

开放索引是独立的内容变更，先提交逐页清单。没有独立价值的素材详情继续用于浏览与工作台转化。

### 7.2 地址简化试点

在前三阶段稳定后，仅选择公开可达、确需简化的长地址迁移。首批建议 5 至 10 个；具体数量以查重和当前 owner 核验为准。

建议示例：

```text
旧：/ai-video-generation/close-unboxing-makeup-tools-ai-image-generation-sale-campaign-key-visual
新：/ai-video-generation/close-unboxing-makeup-tools
```

新地址只是规划示例，必须先验证没有现有 owner、别名或大小写冲突。`beauty-routine` 已被模板页占用，不能把另一个素材强行迁移到该地址。

迁移清单必须绑定素材稳定身份，记录旧地址、新地址、当前 owner、预期字段版本和冲突情况。来源 owner、分类或展示标题变化，不得再次自动重命名规范 URL。

执行要求：

- 每个旧地址精确 301 或 308 到对应新地址，目标返回 200；不用通配规则把所有旧案例送到首页或工具页。
- 新地址、自引用 canonical、OG URL、JSON-LD 和全部可见内链同步一致。
- 只有已获索引资格的新地址进入 sitemap；noindex 素材迁移不顺便开放索引。
- 更新分类引用与工作台选中素材的解析，保证迁移后仍选择同一素材。
- 保留历史重定向兼容，后续迁移时把已有别名直接指向最终目标，避免形成链。
- 对未知、未曾存在的路径正常返回 404；有真实等价替代页时才创建旧地址映射。

本阶段不整体迁移 `/ai-image-generation`、`/ai-video-generation` 到新的 `/examples` 或 `/tags` 命名空间。

## 8 实施拆分与交付物

| 批次 | 工作 | 交付物 | 前置条件 |
|---|---|---|---|
| A | 当前生产路由、owner、索引状态与内链清点 | 路由清单、变更范围、冲突报告 | 只读，确认最新生产提交 |
| B | 平台总目录 | SSR 页面支持、新页面字段清单、原错误重定向处理 | 公开文案和字段变更清单核准 |
| C | 筛选归一化 | 参数规则、等价映射、索引规则、回归用例 | 核对每个目标分类的真实列表与语义 |
| D | 鞋类素材试点 | 经核验的归属及展示字段清单、双向链接结果 | 与素材分类投放功能协调 |
| E | 可索引案例和短地址试点 | 逐案例评审、旧新 URL 映射、迁移验收 | 前几批稳定后，另行确认清单 |

不将其他文档中仅基于本地数据推断的退役页、政策合并等项目并入本次发布；需要生产核验后另行排期。现有并行会话的素材归属代码先核对提交与功能边界，避免重复修改。

## 9 数据与代码发布边界

### 9.1 内容变更

所有公开文案、导航、目录与素材字段以当前 `LivePage.contentJson` 为源。只操作 `site_aidreamcapes`。

每个操作记录站点、实体、JSON Pointer、旧值 hash、目标值与预期版本；新页面操作记录不存在条件。执行前检查冲突，遇到线上修改停止该批次并重新评审，不覆盖线上编辑。关联路由、页面内容和引用需要保持一批一致，不能留下半完成状态。

记录 `SiteContentRevision` 与实际缓存失效结果。下一服务器请求必须读到已提交数据，不通过历史 publication、snapshot、旧 JSON 或部署产物恢复内容。

不运行全站生成，不导入整库或历史内容，不改客户、订单、积分、套餐、支付、私有素材和密钥。

### 9.2 代码与站点隔离

代码使用已推送 `origin/main` 的精确提交，在独立候选版本验证。Aidreamcapes 之外的服务不切换。

优先修改 Aidreamcapes 专属路由辅助模块、目录组件、metadata 解析及审计。若平台重定向、参数处理或 sitemap 修复必须修改可能影响 MyDreamShoots 的共享层，先列出具体文件、调用范围与隔离方案，按 AGENTS.md 获得明确批准后再改。

用户已授权按计划实施。本轮执行本地代码与明确清单内的本地数据变更；生产部署与生产字段应用尚未执行，需使用上线时当前关系数据重新准备清单，不能直接把本地清单当作生产当前值。

## 10 验收标准

### 10.1 本地与候选版本

- TypeScript、公开 SSR 契约、SEO 契约和现有媒体详情检查通过。
- 新目录及变更分类页在禁用 JavaScript 后，仍有完整正文、链接、筛选结果和 metadata。
- 单一 H1；canonical、OG、JSON-LD 主体 URL 及面包屑末项一致。
- 对目标站生成完整路由清单；对受影响路由全量检查状态码，不把已知跳过项算作通过。
- 参数覆盖：空值、单类型、单分类、多维组合、非法值、重复键、编码、路径与 kind 冲突、追踪参数及分页。
- 对归一化前后相同请求比较素材身份集合与结果数量，不能只检查 HTTP 200。
- 工作台选中素材、固定功能 URL、登录流程和浏览器前进后退正常；不执行收费生成或支付。
- 无新增 hydration 错误或控制台运行错误。
- 使用相同环境、相同 URL、相同并发与缓存条件比较响应时间和内存；p95 增加超过 10% 时先定位，不直接上线。

### 10.2 生产验收

- 先候选版本，再源站，再公网；记录具体 commit、时间、地址、状态码、Location 和 SEO 标签。
- `/platforms` 200；六个平台入口正确；不再跳到视频总页。
- 可索引规范页才进入 sitemap；无重定向、404、noindex 或工作台条目；新增数量由真实页面清单确定。
- 受影响站内链接直接指向最终地址；旧 URL 精确永久跳转且无循环。
- 重测目录 → 模板或素材详情 → 工作台的完整链路。
- 生产爬取先串行、低速执行；遇 429 降速并按 Retry-After 重试，持续 5xx 或内存异常则停止检查与发布。
- 内容 readback 只包含批准字段差异；无关页面和受保护业务数据不变；确认关系 owner 与修订号。
- MyDreamShoots 进行只读回归，页面、SEO、导航、服务配置不受本次变更影响。

### 10.3 搜索表现观察

上线后 7、14、28 天检查 Search Console 的 canonical 选择、重复页面、抓取错误、索引状态与分类流量。没有 Search Console 访问时，技术验收仍可记录，搜索表现保留待观察，不能宣称收录或排名已提升。

## 11 失败处置

候选检查失败不切换生产。代码回退仅回到经过验证且与当前关系数据兼容的版本；不能因为旧代码不认识新字段就恢复旧数据。

内容撤销使用经过复核的逐字段逆向清单与 CAS，保留此后发生的线上编辑。URL 迁移后应优先修正目标或保留兼容映射，避免把已发布的新旧地址同时变成死链。禁止通过 snapshot、整页历史副本或整库恢复撤销变更。

## 12 关联规范与依据

- [仓库开发合同](../../AGENTS.md)
- [无快照增量发布](../no-snapshot-incremental-release.md)
- [素材分类投放设计](aidreamcapes-media-category-placement-design-2026-10-21.md)
- [模板目录数据链审计](aidreamcapes-template-directory-data-chain-audit-2026-10-21.md)：本地结论以本计划生产证据与实施前复核为准。
- [Google URL 结构建议](https://developers.google.com/search/docs/crawling-indexing/url-structure)
- [Google canonical 指南](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Google noindex 指南](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Google sitemap 指南](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
