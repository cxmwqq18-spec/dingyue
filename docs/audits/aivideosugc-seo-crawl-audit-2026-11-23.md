# AIVideosUGC 全站 SEO / 爬虫审计

日期：2026-11-23  
审计对象：`https://www.aivideosugc.com`  
生产 commit：`207351656`  
审计方式：生产库清单 + sitemap 全量抓取（792 URL）+ 内链图 + 爬取陷阱探针 + 移动端性能抽查 + 隐藏文案/脏数据扫描

---

## 0. 结论摘要

**技术 SEO 基线整体健康，没有发现密钥、内部备注、调试文案或 HTML 注释泄露。** 792 条 sitemap URL 全部 200、self-canonical、indexable，标题和描述唯一，H1 唯一，结构化数据可解析，无 soft 404、无薄页、无断链。

**仍有 4 类需要处理的问题：**

| 优先级 | 问题 | 影响 |
|---|---|---|
| P0 | `/ai-video-generation/<tool>?page=N` 工具页分页 canonical 指回第一页，且未进 sitemap | 违背“所有分页可收录”目标 |
| P0 | `/site/mydreamshoots` 在 AIVideosUGC 域名下返回 MyDreamShoots 首页 | 跨站脏页/内容泄露 |
| P1 | 9 个视频详情页在 sitemap 中，但没有任何内链指向 | 孤儿页，抓取深度和权重传递差 |
| P1 | 列表页视频预览导致 2–3MB 传输，LCP 是视频 | Core Web Vitals / 抓取预算 |
| P2 | 仍有 94 张图片缺有效 alt（已从 340 降下来） | 可访问性/图片 SEO |
| P2 | 14 组分页 H1 与第一页重复 | 轻微重复信号，非主因 |
| P3 | `.env` / `.git/config` 返回 403 而非 404 | 暴露文件存在性，无内容泄露 |
| P3 | HTTP→HTTPS→WWW 已改为一跳，但 HSTS 未开启 | 首访 HTTP 明文一跳，安全加固项 |

---

## 1. 审计范围与方法

- 生产库 `site_aidreamcapes` 全部 221 条 LivePage。
- `sitemap.xml` 792 条 URL 全量抓取。
- 从 792 页提取内链，构建链接图：可达性、深度、孤儿页、非 sitemap 目标。
- 探针：旧 WordPress/后台/env/git、无效 slug、参数空间、大小写、双斜杠、编码路径、旧域名路径。
- 隐藏内容扫描：HTML 注释、`hidden`、`display:none`、`visibility:hidden`、`aria-hidden` 文本。
- 敏感词扫描：TODO/FIXME/draft/internal/password/secret/api key/Bearer/sk- 等。
- 移动端性能：Playwright 390×844，LCP/CLS、传输量、视频数量、横向溢出。

---

## 2. 全量抓取结果

| 检查项 | 结果 |
|---|---|
| sitemap URL | 792 |
| HTTP 200 | 792 / 792 |
| 3xx / 404 / 5xx | 0 |
| canonical 与自身不一致 | 0 |
| sitemap 内 noindex | 0 |
| 缺 title / description | 0 / 0 |
| 重复 title | 0 |
| 重复 description | 0（watch/detail 已分叉） |
| H1 数量不等于 1 | 0 |
| 缺 lang / viewport | 0 / 0 |
| JSON-LD 解析错误 | 0 |
| 无 JSON-LD 的页面 | 0 |
| soft 404 | 0 |
| 薄页（<80 words） | 0 |
| 无内链的页面 | 0 |
| 图片缺有效 alt | 94 / 21,879（0.43%） |
| HTML 注释 | 0 |
| 外部链接域名 | 9 个社交平台 + support.google.com，无垃圾站 |
| 移动端横向溢出 | 0 |
| CLS（抽查） | 0 |

---

## 3. 分页审计

| 项目 | 结果 |
|---|---|
| sitemap 分页 URL | 54 |
| 分页 200 | 54 / 54 |
| 分页 self-canonical | 54 / 54 |
| 分页 index,follow | 54 / 54 |
| 页码标题 | 全部 |
| 页码范围 + ItemList | 全部 |
| `?page=1` / 0 / 负数 / abc / 小数 | 308 到基础 URL |
| 超范围 | 308 到最后一页 |
| sitemap `page=1` | 0 |
| 分页契约 smoke | 12 / 12 通过 |

### 仍存在的分页缺口：`/ai-video-generation/<tool>?page=N`

这些工具页本身有分页器，但不在分页 canonical 规则和 sitemap 内：

| 页面 | 卡片数 | 总页数 | 实测 canonical |
|---|---:|---:|---|
| `/ai-video-generation/product-video` | 23 | 2 | `?page=2` → 指回基础页 |
| `/ai-video-generation/spokesperson-video` | 53 | 3 | `?page=2/3` → 指回基础页 |
| `/ai-video-generation/video-ads` | 39 | 2 | `?page=2` → 指回基础页 |
| `/ai-video-generation/image-to-video?page=2` | — | — | 内链存在，canonical 基础页 |

内链审计发现 5 个这样的 `?page=` 目标：  
`image-to-video?page=2`、`spokesperson-video?page=2`、`spokesperson-video?page=3`、`video-ads?page=2`、`product-video?page=2`。

**结果**：这些分页页返回 200，但 canonical 指向第一页，且不在 sitemap，谷歌不会把它们当作独立分页收录。这就是“所有分页都支持收录”目标的最后一个缺口。

**修复方向**：把 `/ai-video-generation/<tool>` 纳入分页 metadata 和 sitemap，或确认这些工具页不应分页，去掉分页器并把 `?page` 308 回基础页。需要按实际页面数据判断，不能直接用正则把所有 `/ai-video-generation/<slug>` 都当工具页（详情页也在同一前缀下）。

---

## 4. 重复内容与结构化数据

| 项目 | 修改前 | 现在 |
|---|---|---|
| `/watch/<slug>` 与 `/ai-video-generation/<slug>` description 相同 | 181 对 | **0 对** |
| 两者 H1 相同 | 181 对 | **0 对**（观看页 H1 变为 `Watch: ...`） |
| 重复 description 总数 | 181 组 | **0** |
| 重复 H1 组 | 195 组 | **14 组**（全部是分页） |
| 观看页/详情页正文重合 | 约 62% | 仍有一定重合，但 H1/描述/结构化数据已分工 |
| VideoObject | 观看页 | 观看页（未变） |

分页 H1 仍与第一页相同（14 组），但这属于常见分页模式，已有独立 title、self-canonical、页码范围、ItemList 区分，不列为高优先级。

---

## 5. 谷歌爬虫视角：会不会迷路？

### 没有发现无限爬取陷阱

| 探针 | 结果 |
|---|---|
| `/templates?page=999` | 308 → `?page=17` |
| `/templates?page=abc` | 308 → `/templates` |
| 无效 slug（video/image/actor/watch/blog/industry/platform/tool） | 404 + noindex |
| `/wp-admin`、`/wp-login.php`、`/xmlrpc.php`、`/feed` | 404 + noindex |
| `/admin`、`/platform`、`/platform/login` | 404 + noindex |
| `/app`、`/login`、`/checkout`、`/account` | 307/200 + noindex |
| `/cart`、`/album` | 200 + noindex |
| `/Templates`、`/TEMPLATES`、`//templates`、`/templates/` | 301 → `/templates` |
| `/%74emplates` | 200，canonical `/templates`（重复但已收敛） |
| `?kind=invalid` | 200，canonical `/templates` |
| `?foo`、`?utm_source`、`?ref`、`?q`、`?sort` | 200，canonical `/templates` |
| `?galleryPage=2` | 200，canonical `/ai-video-generation`（图库未启用） |
| `/policies/*`、`/privacy-policy`、`/help`、`/templates/video` | 308 到正确页面 |
| `/dreamshoot`、`/mydreamshoots`、`/aidreamcapes` | 404 |

**结论**：没有发现会无限生成 URL 的参数组合；分页和非法页码都被 308 收敛；无效 slug 全部 404。爬虫不会陷入死循环。

### 内链图

| 指标 | 结果 |
|---|---|
| 内链图节点 | 792 |
| 最大点击深度 | 8 |
| 深度 ≥5 的页面 | 9（全部是 `/templates` 深分页） |
| 从首页不可达的 sitemap 页面 | **9** |
| 非 sitemap 内链目标 | 43 |
| 断链（404） | **0** |
| 非 sitemap 目标状态 | 41×200、1×301、1×307 |

非 sitemap 的 200 目标主要是私有 `/app/*`、`/login`、`/checkout`（均 noindex）、工具页分页（见第 3 节）、以及被 HTML 转义误判的 `kind&page` 分页。

### 孤儿页（9 个）

以下视频详情页在 sitemap 中，但没有任何内链指向：

```text
/ai-video-generation/evening-demo-of-a-kitchen-appliance
/ai-video-generation/desk-review-of-a-thin-keyboard
/ai-video-generation/bathroom-routine-with-moisturizer
/ai-video-generation/asmr-unboxing-makeup-tools
/ai-video-generation/grwm-unboxing-knitwear
/ai-video-generation/pov-discovery-court-gear
/ai-video-generation/app-reaction-clip
/ai-video-generation/close-up-unboxing-makeup-tools-templates
/ai-video-generation/opening-line-phone-demo
```

这 9 页本身 200、self-canonical、有独立 H1/标题，不是脏页；问题是**没有内链**，只能靠 sitemap 发现，权重传递弱。建议从相关分类页/详情页补内链，或确认是否应继续保留在 sitemap。

---

## 6. 脏数据与隐藏文案扫描

### 没有发现内部备注/密钥/调试信息

- HTML 注释：**0**。
- 敏感词扫描命中的页面（12 个）全部是正常产品文案的误报：
  - `product staging`（“AI Product Staging”）
  - `the whole secret`（视频脚本台词）
  - `key visual`（图片模板名）
- 没有发现 TODO/FIXME/draft/internal use/password/secret/API key/Bearer/sk- 等。
- `hidden` / `aria-hidden` 文本只出现在首页：30 个隐藏面板，内容都是正常的 UI 选择器、示例图说明、字幕预览，没有内部指令。
- 外部链接只有 9 个社交平台和 `support.google.com`，没有垃圾外链。

### 跨站脏页：`/site/mydreamshoots`

```text
GET https://www.aivideosugc.com/site/mydreamshoots
200
<title>AI Video &amp; Photo Generator | myDreamshoots</title>
canonical: https://www.mydreamshoots.com/
robots: index, follow
```

这是 MyDreamShoots 首页，被 AIVideosUGC 域名以 path-mode 方式返回。`robots.txt` 已 `Disallow: /site/`，正常爬虫不会从 sitemap 或页面链接发现它；但外部链接、手工访问或某些抓取路径仍能拿到，属于**跨站内容泄露/脏页**。建议在 AIVideosUGC 生产 host 上对 `/site/<other-site>` 返回 404 或 301 到对应站点域名。

### 文件存在性

```text
/.env         403
/.env.local   403
/.git/config  403
```

没有返回内容，但 403 会暴露“文件存在”。建议改为 404，减少指纹信息。低优先级。

---

## 7. 图片 alt

- 修复前：340 张缺有效 alt。
- 修复后：**94 张**，分布在 58 个页面。
- 主要剩余页面：

| 页面 | 缺失数 |
|---|---:|
| `/ai-actors/scene` | 26 |
| `/blog` | 5 |
| `/ai-actors/age-range` | 5 |
| `/blog/ai-ugc-video-ads-guide` | 2 |
| `/ai-video-generation?page=10` | 2 |
| `/ai-video-generation/url-to-video` | 2 |
| `/industries` | 1 |

这些多为演员场景卡、博客作者头像/社交图标、工具页配图。建议继续用“人物/场景/用途”描述补齐；纯装饰图标保留 `alt=""` 即可。

---

## 8. 性能 / Core Web Vitals（移动端实验室）

| 页面 | 传输量 | 视频传输 | LCP | LCP 元素 | CLS |
|---|---:|---:|---:|---|---:|
| `/templates` | 2.28 MB | 2.2 MB | 2.1s | **视频** | 0 |
| `/ai-video-generation` | 2.79 MB | 2.37 MB | 1.77s | 图片 | 0 |
| 首页 | 1.17 MB | — | 2.65s | H1 | 0 |
| `/industries/beauty-skincare` | 1.55 MB | 1.45 MB | 0.66s | H1 | 0 |
| 详情页 | 40 KB | — | 1.22s | 视频 | 0 |
| 观看页 | 2 KB | — | 1.16s | 视频 | 0 |
| `/blog` | 77 KB | — | 0.58s | 文字 | 0 |
| `/guides` | 24 KB | — | 2.7s | 文字 | 0 |

问题：列表页首屏挂载并自动播放 6 个 10 秒预览，视频成为 LCP，移动端传输 2–3MB。修复需要调整播放时序/数量，属于用户可见行为，需站主确认。

---

## 9. 重定向 / robots / sitemap

| 项目 | 结果 |
|---|---|
| `http://aivideosugc.com` | 301 → `https://www.aivideosugc.com/`（一跳） |
| `http://www.aivideosugc.com` | 301 → `https://www.aivideosugc.com/`（一跳） |
| `https://aivideosugc.com` | 301 → `https://www.aivideosugc.com/` |
| 尾斜杠 | 301 去斜杠 |
| 不存在的 URL | 404 |
| robots.txt | 200，允许公开页，禁止 `/app/`、`/api/`、`/login`、`/site/` |
| sitemap.xml | 200，792 URL，全部 lastmod，无重复、无 noindex、无非 www |
| 私有路由 | `/app`、`/login`、`/checkout`、`/account`、`/cart`、`/album` 均 noindex |

**注意**：为使 HTTP 一跳，Cloudflare `Always Use HTTPS` 已关闭，改由源站 nginx 301 处理；当前 HSTS 未开启。安全上建议后续在 Cloudflare 配好一跳重定向规则后重新开启 Always Use HTTPS，并启用 HSTS。

---

## 10. 已执行变更（本轮）

| 变更 | 结果 |
|---|---|
| watch/detail 差异化 | 观看页 H1 改为 `Watch: ...`，description 独立；详情页保留 prompt/复刻意图 |
| 图片 alt | 新增演员卡/示例卡/流程卡/审核卡 fallback，缺失从 340 降到 94 |
| HTTP→HTTPS→WWW | 合并为一跳 301 |
| 旧 policy canonical | 12 条旧地址的存储 canonical 清理为 www 正确 URL |
| 分页质量（此前） | 页码范围、每页 description、ItemList、facet 进 sitemap、超范围 308 |

生产 commit：`207351656`

---

## 11. 优先级建议

| 优先级 | 事项 | 说明 |
|---|---|---|
| P0 | 修工具页分页 | `/ai-video-generation/product-video|spokesperson-video|video-ads` 的 `?page=N` 纳入 self-canonical + sitemap，或确认不分页并 308 回基础页 |
| P0 | 隔离 `/site/mydreamshoots` | AIVideosUGC host 上返回 404，或 301 到 `https://www.mydreamshoots.com/` |
| P1 | 9 个孤儿详情页补内链 | 从相关分类/详情页链接，或移出 sitemap |
| P1 | 视频预览性能 A+B | 首屏只立即播第 1 张，其余进视口再播；视频延后到 LCP 之后 |
| P2 | 剩余 94 张 alt | 演员场景、博客作者/图标、工具配图 |
| P2 | 分页 H1 加页码 | 可选，收益低 |
| P3 | `.env` 403 改 404 | 减少文件指纹 |
| P3 | HSTS + Cloudflare 一跳规则 | 安全加固，需 Cloudflare 写权限 |

---

## 12. 附录：关键证据

- sitemap：`https://www.aivideosugc.com/sitemap.xml`（792 URL）
- 分页 smoke：`scripts/smoke-aidreamcapes-listing-pages.mjs` 12/12
- 跨站页：`https://www.aivideosugc.com/site/mydreamshoots`
- 工具分页：`https://www.aivideosugc.com/ai-video-generation/product-video?page=2`
- 孤儿页示例：`https://www.aivideosugc.com/ai-video-generation/evening-demo-of-a-kitchen-appliance`
- 文件指纹：`https://www.aivideosugc.com/.env`（403）
- 重定向：`http://aivideosugc.com/`（301 一跳）

---

## 13. 结论

- **能抓、能收录的基础已经具备**：792/792 sitemap URL 200、self-canonical、indexable、标题/描述唯一、H1 唯一、结构化数据有效。
- **没有发现内部备注、密钥、调试文案或隐藏关键词**。
- **没有发现无限爬取陷阱、断链或 soft 404**。
- 剩下的核心不是“能不能抓”，而是：工具页分页缺口、跨站 `/site/` 脏页、9 个孤儿页、视频预览性能、少量 alt。
- 修复 P0 后，分页收录目标和跨站隔离目标才算完整闭环。
