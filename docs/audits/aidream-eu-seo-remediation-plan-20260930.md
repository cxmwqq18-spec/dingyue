# Aidreamshoots.eu / Aidreamcapes.eu SEO 整改方案

日期：2026-09-30

本次范围只覆盖公开页面 SEO、公开路由、内链、metadata、结构化数据、渲染稳定性和对应验收脚本。支付、Stripe、账单、积分扣减、checkout、套餐可购买状态均明确排除，不因本次整改改变。

## 结论与上线门槛

当前版本不建议直接作为正式 SEO 投放版本上线。完成本方案的 P0/P1 项并通过本地及预发布冒烟后，可以先上线“非支付公开页面/封闭测试”版本；支付链路仍按独立项目验收。

此前线上审计的关键证据：

- Aidreamshoots.eu：98 个内部 URL，未发现正常页面缺 title、description、H1 或图片 alt；`/tools` canonical 错指 `/ai-video-generation`，并出现 React hydration #418。
- Aidreamcapes.eu：98 个内部 URL 中有 2 个链接直接落到 Next 404：`/ai-image-generation/estilo-y-fantasia`、`/ai-image-generation/urbano`；约 90 个页面出现重复 JSON-LD；有英文残留和元数据超长问题。
- 两站 hreflang、robots/sitemap 的线上读取在当前审计环境中无法完成验证；PageSpeed Insights API Key 按用户要求跳过，不作为本轮阻塞项。

## 已实施的代码整改

### P0：阻断错误入口和结构化数据重复

- 顶部菜单不再维护独立的 EU 失效路径副本，改用统一的退休路径表，因此 `/urbano` 和 `/estilo-y-fantasia` 不再被菜单输出。
- JSON-LD 恢复为显式 script 节点，保留 body marker 供中间件搬运到 head，避免 `div + dangerouslySetInnerHTML` 引起的 React hydration mismatch。
- 中间件对搬运后的 JSON-LD 做精确内容去重，并兼容 `application/json` 与 `application/ld+json` 的 hydration 惰性副本。

### P1：修复 canonical 与 metadata 质量

- Aidreamshoots.eu 的 `/tools` 在站点上下文和 Next metadata 两层强制保持自 canonical，不再接受历史页面 JSON 中的 `/ai-video-generation` 投影。
- Aidreamcapes.eu 的最终 title 限制为不超过 60 个字符，description 限制为不超过 160 个字符；超长文本按词边界截断且不追加会造成“伪完整”的省略号。

## 仍需在发布数据/环境执行的工作

### P0

- 在 Aidreamcapes.eu 公开首页、菜单、卡片和 sitemap 重新抓取一遍，确认两个退休路径不再出现在 HTML 内链和 sitemap；如数据库中仍有旧 catalog/media 记录，只做停用或隐藏，不删除历史数据。
- 预发布环境确认真实 HTTP 状态：退休路径应为 404 或明确的 noindex 退役响应，不能被软 200 内容页接住。

### P1

- 运行 EU 法语内容 smoke，清理公开 SEO 文案中的英文残留；支付页面的“Paiement bientôt disponible”等状态保留，不在本次改动。
- 线上分别验证 `/robots.txt`、`/sitemap.xml`、canonical、robots、OG/Twitter 和 JSON-LD；检查 sitemap 不含私有页、别名页、退休页和重复 loc。
- 对两站核心页面做移动端人工检查，确认修复 hydration 后首屏内容、导航和图片仍正常。

### P2

- 补充法语/西语 hreflang 策略后再上线，不在本次用错误语言映射强行填充。
- 配置 PageSpeed Insights API Key 后单独记录 LCP、CLS、INP、图片体积和第三方脚本数据；API 缺失不阻断本轮 SEO 代码验收。

## 验收命令

```bash
npm run typecheck
npx eslint src/components/storefront/storefront-json-ld.tsx src/components/storefront/header-mega-menu-panels.tsx src/lib/storefront-context/core.ts src/lib/storefront-metadata.ts src/middleware.ts
npm run repair:aidreamcapes-eu-seo
npm run smoke:aidreamcapes-eu-seo
npm run smoke:aidreamshoots-seo-remediation
```

需要启动预发布/本地公开站点后再运行 HTTP smoke；若环境没有服务，命令失败只代表环境未启动，不代表支付链路需要补做。

## 放行标准

- 两站公开页面无新增 404 内链；Aidreamcapes.eu 两个退休路径不出现在 HTML 内链和 sitemap。
- Aidreamshoots.eu `/tools` canonical 为自身 URL。
- Aidreamcapes.eu indexable 页面 title ≤ 60、description ≤ 160，且不再因中间件搬运产生重复 JSON-LD。
- 浏览器控制台不再出现 React hydration #418；JSON-LD 可解析，且每个页面的同一图谱只输出一次。
- 不修改任何支付、账单、Stripe、checkout、积分扣减或套餐可购买状态逻辑。
