# Aidreamcapes 媒体详情短地址规范化方案（2026-10-22）

数据所有者：`site_aidreamcapes`（PostgreSQL `LivePage.contentJson`）
审计依据：`docs/audits/aidreamcapes-redundant-media-slugs-2026-10-22.md`（678 个冗余 slug）
线上提交：`fcbb33460ffb6e994fe000dc631f0d256dc05ee5`（alias 运行时已上线，生产 `publicAliases` 仍为 0）

## 1. 现状

- 生产 `site_aidreamcapes` 共 267 行 `LivePage`。
- 978 个媒体详情 slug 中有 678 个是「产品名 + 目录页路径」形态，例如
  `/ai-video-generation/bedroom-try-on-knitwear-ai-video-generation-ugc-ad-video`。
- 期望形态 `bedroom-try-on-knitwear` 目前线上 404（本地只存在 5 条规划）。
- 39 个冗余 slug 由公开页链出（`/ai-video-generation` 4 个、`/ai-video-generation/video-ads` 35 个），
  其余 60 个只在详情页「相关推荐」里被链出，588 个只能直接访问。

## 2. 运行时约束（已逐条核实线上部署代码）

1. `media-detail.server.ts` 的 `pagesOwningSlug` 用 `jsonb_path_exists` 匹配
   `publicSlug == slug` **或** `$.**.publicAliases[*] == slug`，且 `LIMIT 3`。
2. `resolveMediaDetail` 要求 `pages.length === 1`，否则该 slug 解析为 undefined（404）。
3. `media-alias.server.ts` 的 `mediaAliasTarget` 收集所有「`publicAliases` 含该 alias 的卡」的
   `publicSlug`，要求 **恰好 1 个** 去重目标；并要求 alias 不等于任何已上线的
   `/ai-video-generation/<alias>` 页面路径。
4. `renderAidreamcapesMediaDetailPage` 在 `detail.slug !== slug` 时发 `permanentRedirect`，
   因此 alias 命中后落到规范 slug 上会得到 308。

由 1+2 得出硬约束：**同一个 slug 不得同时是某张卡的 `publicSlug` 又出现在某张卡的
`publicAliases` 里**，否则 `pagesOwningSlug` 返回 2 行，`resolveMediaDetail` 直接 404。
由 3 得出：同一个 alias 不得被两张卡指向两个不同 `publicSlug`。

## 3. 落地方案（每个产品一张规范卡 + 旧长名进 publicAliases）

对每个产品组（media 身份，见审计 §9 的 80 个 base slug）：

- **规范卡**：取该产品在公开产品墙（`/ai-video-generation` 或 `/ai-video-generation/video-ads`）
  上被渲染的那张卡；`publicSlug` 改为 base slug（如 `bedroom-try-on-knitwear`）。
- **旧长名**：规范卡 `publicAliases` 追加该卡自己的旧长名
  （如 `bedroom-try-on-knitwear-ai-video-generation-ugc-ad-video`）。
- **其余副本**（19 个目录页上的 `workspaceCases` 副本、其它墙副本）：保持 `publicSlug` 不变。

这样：

- 旧长名 URL 命中 `publicAliases` 分支 → `pagesOwningSlug` 只返回规范卡所在那一页
  （旧长名已不是任何卡的 `publicSlug`）→ `mediaAliasTarget` 找到唯一目标 base slug →
  `resolveMediaDetail` 解析出 base → `detail.slug !== slug` → 308。
- base slug 作为 `publicSlug` 只存在一处 → 规范 URL 200。

### 3.1 同一产品跨两张墙的情况

`lifestyle-app-recommendation` 与 `streamer-reaction-app` 各有两张渲染卡
（`/ai-video-generation` 一张、`/ai-video-generation/video-ads` 一张）。
两张卡不能同时持有同一个 base slug（`pagesOwningSlug` 会返回 2 行 → 404），
因此同一产品的两张渲染卡必须拿到 **不同** 的规范 slug。

处理：以 video-ads 墙的卡为规范卡，base slug 归它；hub 墙的卡使用
「base slug + 墙面后缀」形态的唯一 slug（例如 `lifestyle-app-recommendation-ai-video-generation`），
即保留它现在的 `publicSlug` 不动。hub 墙这张卡因此不产生 308，保留原有地址。

## 4. 为什么不一次性覆盖全部 678 个旧地址

- 678 个旧长名分布在 19 个目录页的 `workspaceCases` 副本上。这些副本的 `publicSlug`
  同时是它们唯一的公开详情路由（`pagesOwningSlug` 唯一 owner 约束下，多张卡不能共用一个 slug）。
- 把它们全部改写成 alias，等于把 19 个目录页的 639 个副本卡全部改成「无 `publicSlug`」，
  会让这些目录页失去自己的详情路由，且违反「每张媒体卡都拥有自己的详情路由」契约
  （`audit-card-entry-links` 对 `picker`/`examples` 卡强制 `publicSlug` 存在）。
- 因此本方案先规范 **公开可点的 39 个** 冗余地址：它们是 42 个产品中用户真正会点击的入口。
  目录页副本的 639 个旧长名仍保持 200 自指（noindex, follow），不在本次范围内。

## 5. 字段级写入范围

只写 `LivePage.contentJson` 里的两个字段，且只在两张产品墙上：

| 字段 | 变更 |
|---|---|
| `sections.*.settings.data.visual.picker.cards[N].publicSlug` | 长名 → base slug（仅当该卡是规范卡） |
| `sections.*.settings.data.visual.picker.cards[N].publicAliases` | 追加该卡旧长名（仅当该卡是规范卡） |

不写 `placement`、不写 `prompt`/`label`/`image`/`href`、不写 `workspaceCases`、
不写任何 `LivePage` 之外的对象、不写 publication/snapshot、不碰 `site_dreamshoot`。

## 6. 门禁

- 计划脚本只读产出 manifest（`planHash`、每张卡的 `before`/`after`、每页 `baseHash`）。
- 应用脚本为字段级 compare-and-set：写前校验 `baseHash`、卡指纹（`label`+`image.src`+`kind`）、
  目标 slug 未被任何其他卡占用、alias 未与任何现有 `publicSlug`/`publicAliases` 冲突；
  写后回读并断言 `SiteContentRevision` 恰好 +1、`MyDreamShoots` 内容哈希不变。
- `scripts/smoke-aidreamcapes-seo-paths.mjs` 扩展为覆盖全部迁移后的旧地址，
  并接入发布门禁（`scripts/deploy-aidreamcapes-release.mjs`）。
- 回归：`audit-card-entry-links`、`audit-media-detail-routes`、
  `audit-workspace-entry-transfer`（三者都在媒体详情门禁内）。
