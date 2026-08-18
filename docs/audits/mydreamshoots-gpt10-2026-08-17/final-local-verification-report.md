# MyDreamShoots GPT10 本地整改最终验证报告

状态：**local-only-not-published**

验证时间：2026-08-18（本地环境）

本报告只证明本地代码、内容源、本地 PostgreSQL 和本地服务器状态。没有部署、没有 content release、没有测试站同步、没有生产数据库写入。

## 1. 内容源与本地快照

命令：`npm run sync:mydreamshoots-audit-closure`

最终 dry-run：

```json
{
  "ok": true,
  "dryRun": true,
  "changedPages": 0,
  "changedSiteThemes": 0,
  "changedEmbeddedSiteThemes": 0,
  "changedEmbeddedPublications": 0,
  "unresolvedUnverifiedClaimStrings": 0
}
```

最后一次受本地写保护的 DB 同步使用 `ALLOW_LOCAL_BLOG_DB_SYNC=1`、`LOCAL_BLOG_DB_CONTAINER_CONFIRMED=1`，目标为 localhost 数据库，结果为：`themeSettings: 1`、`themePages: 10`、`siteThemes: 2`、`themePublications: 6`、`legacyVideoThemes: 8`、`platformStateDocument: 1`。源文件 `data/platform-state.json` 由脚本生成，没有手工编辑页面内容。

保留历史的 8 个旧视频主题已设为 inactive；当前 publication snapshot 包含必要的 AI Video Generation 主题页。未验证的训练、固定删除、安全和绝对退款声明数量为 0。

## 2. 内容、SEO 和相似度

| 检查 | 结果 |
|---|---|
| `npm run smoke:dreamshoot-blog-content` | 964 checks，2 个站点，0 failure |
| `npm run smoke:mydreamshoots-priority-blog-remediation` | 9 页，0 failure |
| 九页最大五元组 Jaccard | 0.0253，低于 0.70 阈值 |
| 九页正文长度 | 3835–5052 characters |
| 每页结构 | 至少 5 个 H2、3 个 H3、1 个表格、3 个 related links |
| `npm run smoke:mydreamshoots-seo-indexing` | 0 failure；72 个发布页面 slug，0 重复 slug |
| `npm run smoke:mydreamshoots-media-seo-schema` | 38 个 Product，0 legacy VideoObject，媒体 URL 全部通过 |
| `npm run smoke:storefront-media-alt` | 38 packs、456 gallery alt、456 unique gallery images、23 media assets |
| `npm run smoke:mydreamshoots-seo-ssr` | 0 failure；主题页/视频页 SSR 通过，provider-backed price 为 false |
| `npm run smoke:mydreamshoots-video-topic-layout` | 40 checks、10 topics、4 viewports，0 failure |

媒体/价格 smoke 明确显示 `verifiedOffers: 0`、`lowestOffer: not-published-until-provider-verification`，因此 JSON-LD 不输出未经 provider 验证的 Offer。

## 3. 路由与登录

聚焦 `www.mydreamshoots.com` 的 public route smoke 通过：

- 首页、政策页、博客、38 个产品目录页、AI Video Generation 页面和 `/cookies` 返回 200。
- `/site/mydreamshoots/best-packages`、`best-ai-image`、`best-ai-video` 返回 200。
- `/collections/*` 旧路径按预期 307 到 canonical 或 404；隐藏视频工作流和退役 `/tools` 按预期 404。
- 无非预期 Location 链。

`npm run smoke:mydreamshoots-login-redirect` 最终通过：

```text
login restores /site/mydreamshoots/app/create#step-video and renders the video workspace
host-mode Workspace, account, and account-center workspace clicks land on the approved paths for www.mydreamshoots.com
```

该 smoke 同时验证了 next 参数编码、fragment 恢复、同站路径限制和 customer session cookie。期间修正了 smoke 自身错误使用 `Locator.waitForFunction` 的问题，并改为兼容 host/path 两种批准路径的 `waitForURL` 检查。

## 4. Playwright 视觉与结构验收

### 目标博客

报告：[local-playwright/report.json](./local-playwright/report.json)

- `status`: `local-only-not-published`
- 9 个页面 × host/site × desktop/mobile，共 36 checks
- `failedChecks`: 0
- `httpStatusCounts`: 36 个 200
- 桌面 1440px、移动 390px 均无正文横向溢出、图片加载失败或目录锚点断链。
- 每页唯一 H1、唯一 BlogPosting、Organization author、`dateModified: 2026-08-18`、image、canonical 均通过。
- 正文 FAQ 可见但 `FAQPage` 数量为 0。

### 审计闭环

报告：[audit-closure/playwright-report.json](./audit-closure/playwright-report.json)

- `status`: `local-only-not-published`
- `productCount`: 38
- `checkCount`: 172
- `failureCount`: 0
- 覆盖产品详情、政策页、Footer nofollow、内部导航、canonical、robots/index、图片 alt、JSON-LD、桌面/移动视口和 host/`/site` 路由。

截图目录：[audit-closure/screenshots](./audit-closure/screenshots)

## 5. 构建与静态检查

- `npm run typecheck`：通过。
- `npm run build`：通过。Next.js 仅报告现有 `<img>` 性能提示和若干未使用符号 warning，没有 build error。
- `git diff --check`：通过。
- `npm run sync:mydreamshoots-audit-closure`：dry-run 稳定为 0 改动、0 未解决绝对声明。

本地开发服务器曾因并行 Playwright 触发内存重启；在清理限定的 Next 输出缓存、提高本地开发堆上限并串行重跑后，优先博客 Playwright 从 7 个连接中断恢复为 36/36 通过。该现象不代表页面 HTTP 或内容失败。

## 6. 当前不能标记为已发布的事项

1. Virtual Try-On 的人物/服装/图片版权和授权证据仍缺失；现有三面板封面只能作为本地候选。
2. Soccer 新 URL 迁移需要品牌/IP 书面批准；默认迁移开关保持关闭，旧历史 URL 本地保留 200/self-canonical。
3. 法定运营主体资料、作者责任资料、真实受控产品测试资料仍需外部/内部证据。
4. Provider-backed `price_...` 和 `providerVerifiedAt` 尚未存在，不得发布价格 Offer。
5. `No AI training`、固定删除、AES/TLS 和绝对退款能力未取得可验证工程/法律证据，页面继续使用保守措辞。
6. `/aidreamshoots.eu/tools` 属于独立外部域名责任范围，本报告不将其视为本地博客整改通过项。

因此，本次结果是“本地整改和验收通过，但发布门禁仍被事实、授权、法律和价格证据阻塞”，不是线上发布确认。
