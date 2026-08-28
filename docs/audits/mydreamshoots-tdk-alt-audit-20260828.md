# MyDreamShoots TDK 与图片 Alt 全量复核

审计时间：2026-08-28（Asia/Shanghai）
审计对象：`https://www.mydreamshoots.com` 公开 sitemap 及其 108 个 URL

## 结论

- TDK 三字段（`title`、`description`、`keywords`）在当前线上 108 个 sitemap 页面中均已配置，且没有发现字段级重复或空值。
- 通过路径、页面标题、首个 H1 和描述的交叉检查，未发现明显把另一页面主题写入当前页面 TDK 的情况。少数博客/政策页 H1 为空或使用通用模板，属于页面内容结构问题，不是 TDK 重复。
- 图片 `alt` 没有缺失、空值、文件名式文本；但当前线上仍有一组不同图片共用同一个 `alt`，同一资源在多个页面有多个版本的 `alt`，因此不能宣称“所有图片 alt 完全唯一且资源级一致”。

## TDK 结果

| 检查项 | 结果 |
| --- | ---: |
| Sitemap URL | 108 |
| HTTP 200 | 108 |
| 空 title / description / keywords | 0 / 0 / 0 |
| 重复 title | 0 组 |
| 重复 description | 0 组 |
| 重复 keywords | 0 组 |

### 主题相关性

页面 TDK 均包含与路径或页面主体相符的主题词。例如图片生成、视频生成、博客主题、政策页分别使用对应的主题词。自动词法启发式对 18 个页面给出低重合提示，主要原因是首页/博客/政策页的 H1 为空或采用编辑型标题，人工抽查未发现 TDK 串页；这些页面仍建议补充明确的首个 H1，提升内容与 TDK 的可验证一致性。

## 图片 Alt 结果

| 检查项 | 结果 |
| --- | ---: |
| 图片渲染次数 | 1,233 |
| 唯一图片资源（去 query/hash） | 727 |
| 缺失 `alt` 属性 | 0 |
| 空 `alt` | 0 |
| 文件名/URL 式 `alt` | 0 |
| 超过 125 字符 | 30 |
| 带“visual reference / gallery example / used as”等实现语境 | 8 |
| 不同资源共用同一 `alt` | 1 组 |
| 同一资源存在多个 `alt` 版本 | 39 组（91 个版本，52 个额外版本） |

### 必须修复的重复资源

以下两个不同资源共用同一描述：

`Bride and groom reviewing wedding invitation cards together at a candlelit reception table.`

- `/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-garden-couple.jpg`
- `/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-couple-reviewing.jpg`

应依据画面分别描述，例如为花园场景加入 `garden`，为另一张保留 `comparing/reviewing invitation cards` 的动作差异；最终文案需以实际图片为准。

### 同一资源的多版本

同一图片在首页、目录页和详情页使用了不同上下文文案。对同一资源，建议以资源 URL（去 query/hash）建立唯一 alt 注册表，在所有页面复用同一个资源级描述；页面主题应由邻近标题、链接和正文表达，而不是改写图片 alt。相同 logo 在多页面复用同一 alt 是正确的，不应为了“唯一”而人为添加页码或关键词。

### 规范性问题

- 30 条超过 125 字符的 alt 大多包含 `used as ... reference`，信息过长且混入实现语境；建议压缩为主体、动作、关键环境的一句话。
- 8 条包含 `private gallery`、`visual reference` 或类似展示用途短语；应保留画面事实，删除“用于展示/浏览/参考”等非视觉说明。
- 当前无空 alt，但纯装饰图标/背景若不传达内容，应明确使用 `alt=""` 或改为 CSS 背景；不应为装饰图强行添加 SEO 文案。

## 本地代码验证

- `node scripts/guard-mydreamshoots-tdk-uniqueness.mjs`：通过，检查活动快照 132 个页面的三字段唯一性。
- `node scripts/rectify-mydreamshoots-media-alt.mjs`：通过，559 个图库 alt、714 个媒体资源通过唯一性与非空校验；幂等复跑页面清单更新为 0。
- `npm run typecheck`：通过。
- `node scripts/smoke-storefront-media-alt.mjs`：通过；已更新断言以匹配当前资源级场景 alt 生成规则。

## 本轮修复

- `storefront-media-alt.ts` 为视频主题、图库、首页专属素材、FAQ/编辑素材、季节素材和婚礼素材建立稳定的资源级 alt；同一资源不再因页面上下文改变描述。
- 两张婚礼邀请 hero 图使用独立且符合画面的描述，并在 `sync-wedding-invitation-topic-page.mjs` 中增加不同资源 alt 必须唯一的发布前校验。
- 视频主题图片种子统一移除 `used as ... reference` 等实现语境，并将图片描述压缩到 118 字符以内。
- 视频主题 hero 与图库统一经过资源级 alt 生成器，避免同一图片在首页、目录页、详情页产生不同版本。

本地验证结果：视频种子 224 张图片的超长/实现语境文案均为 0；媒体 smoke、类型检查、TDK 唯一性校验均通过。

## 发布状态

本报告的线上结论来自 2026-08-28 对 `www.mydreamshoots.com` 的实时抓取。仓库修复已推送，但本轮未执行生产部署；因此报告中列出的线上图片重复仍需在生产数据/快照发布后重新抓取确认。
