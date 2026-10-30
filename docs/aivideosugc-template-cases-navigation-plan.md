# Aivideosugc /templates 案例画廊与目录导航整改方案（v2）

状态：口径已拍板（2026-10-30），待实施
范围：仅 `site_aidreamcapes`（aivideosugc.com）；不触碰 MyDreamShoots；不写快照/发布状态；数据改动走字段级 manifest + CAS + 读回断言 + 回滚文件。

v1 方案（模板案例聚合页 / cases 路由）已废弃：用户拍板 18 个模板属旧数据不展示，`/templates` 直接改为全部案例画廊。

## 1. 已核实问题与拍板口径

| # | 问题（已核实） | 拍板口径 |
|---|---------------|----------|
| P1 | `/templates` 18 张模板卡指向工具页，要多套一层才到案例详情；工具页与详情页 URL 格式雷同 | 18 个模板属旧数据：**全站隐藏**（facet 页模板网格一并隐藏），工具页**路由保留**（详情页「Made with」链仍指向），后期有用再归入行业 |
| P2 | 模板无案例聚合页 | `/templates` 改为**全部案例画廊**：所有可进详情页的案例（约 200 条），默认 20 条 + SSR「加载更多」，**最新优先**排序 |
| P3 | mega menu 组标题（By industry / By platform / By occasion）纯文本不可点 | 组标题加 `hubHref` 变可点 |
| P4 | `/occasions` 404（/industries、/platforms 正常，3 个 occasion facet 页存在） | 新建 `/occasions` hub 页 |
| P5 | `/templates/photo`、`/templates/video` 子目录 + chips 入口 | **砍掉**，只留：全部案例 + 按行业 + 按平台 + 按场合 |

## 2. 实施方案

### A. `/templates` → 全部案例画廊（核心）

**页面**：保留 `/templates` 路由与 LivePage 行，v2 数据改为案例画廊配置（字段级 manifest 重写该行相关字段）。

**数据源**：渲染时实时推导——扫描全部 v2 页 `cardsFromContent`（与详情页/sitemap 完全同源），取带 `publicSlug` 的卡、href 去重。**零复制存储**，工具页案例更新自动同步。

**排序**：最新优先 = 案例详情页 LivePage 行 `createdAt` 降序，slug 升序作稳定 tiebreak。

**分页（SSR 合规）**：默认渲染前 20 条；「加载更多」为 SSR 链接（`?page=2` 服务端渲染累计 1–40 条，依此累加），浏览器不发数据请求。约 200 条 → 10 页封顶。

**页面构成**：面包屑 + 页头（标题/引导语）+ 顶部 chips（全部案例 / 按行业 / 按平台 / 按场合）+ 案例网格（复用现有媒体卡组件，每卡 → 详情页）+ 加载更多。JSON-LD CollectionPage + ItemList（ itemList 为当前页案例，或全量——以 facet 页同规约为准）。

**导航/入口同步（数据 manifest）**：
- home `siteNavigation.menus` Templates 组 `footerLink` 文案由「See all 18 templates」改为面向案例画廊的文案（如 "Browse all examples"），href 仍 `/templates`。
- 全站 href 清扫：渲染产物中不得再出现 `/templates/photo`、`/templates/video` 链接（audit 断言）。

### B. 砍掉 `/templates/photo`、`/templates/video`

- 两行 LivePage 下线；为不破坏可能的外链，路由层 301 → `/templates`（若路由层不支持重定向则直接下线 404，回流由 audit 监控）。
- sitemap 同步移除这两条。
- 详情页「目录」chips 组此前会产出「视频模板」等 chip（派生自 templateDirectory.links），随 A 中数据重写自然消失，回归断言确认。

### C. 18 个模板工具页全站隐藏（保留路由）

- facet 页（/industries/*、/platforms/*、/occasions/*）移除「模板网格」区块，仅保留案例媒体网格（placement 聚合，不动）。
- facet 页存储 jsonLd ItemList 重建：原 ItemList 引用模板 paths，模板隐藏后改为引用媒体网格条目（沿用 Round 2 的重建脚本机制，paths 为空则移除节点——本次等价改为模板节点移除 + 媒体节点补齐）。
- 工具页本身：路由/内容/Made with 反向链全部不动，继续可访问、可索引（仅不再被目录展示）。
- audit：facet 页断言改为「模板网格缺席 + 媒体网格完整」；`templateCardPlacementIgnored` 类断言随网格移除调整。

### D. `/occasions` hub 新建（404 修复）

- 新建 `/occasions` LivePage（与 `/industries`、`/platforms` 同构），列 3 个 occasion facet 卡（black-friday / holidays / sale-discount）+ 案例数。
- 渲染器补 occasions hub 分支（facet registry 已有 occasions 定义，复用 industries hub 渲染路径）；SSR-only + sitemap + JSON-LD 同规约。

### E. mega menu 组标题可点

- home `siteNavigation.menus` Templates 三个 group 增加 `hubHref`（/industries、/platforms、/occasions），字段级 manifest；其他菜单组不动。
- `shell.tsx` `.pcol .ph` 有 `hubHref` 时渲染为 `<a>`（视觉不变，hover 下划线/箭头）；无 `hubHref` 组保持纯文本。

## 3. 实施顺序（每步独立可验证、可回滚）

1. **Step 1 = D**：/occasions hub 新建（修 404，独立小步）。
2. **Step 2 = E**：mega menu 组标题可点（依赖 Step 1）。
3. **Step 3 = A + B**：/templates 案例画廊 + photo/video 子页下线（同批，chips/入口一体切换）。
4. **Step 4 = C**：facet 页模板网格隐藏 + jsonLd 重建 + audit 调整（可与 Step 3 同批或紧随）。

每步：plan/apply 脚本 + manifest/rollback 工件 + CAS + 读回断言 → 本地 dev 回归 → 独立 worktree 预构建 + 部署 → 生产回归。

## 4. 回归清单

- `/occasions` 200，内容/JSON-LD/sitemap 正确，3 个 facet 链接全通。
- `/templates` 200：案例数与数据镜像脚本（cardsFromContent 全站重算 + href 去重）一致；排序 = createdAt desc；`?page=2` 渲染累计 40 条；加载更多为 SSR 链接；无任何浏览器数据请求。
- `/templates/photo`、`/templates/video`：下线生效（301 或 404），sitemap 无；全站渲染产物 grep 无这两个 href。
- 18 个工具页：URL 200 可访问（Made with 链不断）。
- facet 页：模板网格缺席、媒体网格零差漏、jsonLd ItemList 与媒体网格一致。
- mega menu：三组标题可点、href 正确、hover 样式；footerLink 文案更新；其他菜单组零变化。
- 详情页：目录 chips 无「视频模板/照片模板」残留；Made with 组不回归。
- SSR-only 双 guard（静态 + no-JS）；sitemap 增 1（/occasions）减 2；no-snapshot 合同合规。

## 5. 实施记录（2026-10-30）

四步全部实施并上线，最终 release `228a450c279f34b40869cfb4f52250ccd702f5ca`。

- **Step 1（/occasions hub）**：`aidreamcapes_v2_occasions` LivePage 行（layout=platform-directory，3 张 occasion 卡）；plan/apply `scripts/{plan,apply}-aidreamcapes-occasions-hub.mjs`。revision 3198→3199。
- **Step 2（mega menu 组标题可点）**：`AidreamcapesZipNavigationGroup.hubHref` 字段 + `shell.tsx` `.ph-link` 渲染 + 样式；home 行三组 hubHref manifest `scripts/{plan,apply}-aidreamcapes-nav-hub-hrefs.mjs`。revision 3199→3200。release `4715c9687`。
- **Step 3（/templates 案例画廊）**：`ExampleDirectory` 渲染分支 + `listAidreamcapesExampleGalleryEntries`（单属主枚举复用，updatedAt desc / slug asc）；`/templates` 行重写（exampleDirectory，4 chips，pageSize 20，删 stored ItemList/FAQPage）；28 行 facet links 统一为 All examples/By industry/By platform/By occasion；home 三菜单 footerLink 更新；删除 `/templates/photo`、`/templates/video` 行（middleware normalize + `redirectLegacyAidreamcapesTemplateDirectory` 308 回 `/templates?kind=`）。manifest `scripts/{plan,apply}-aidreamcapes-template-gallery.mjs`，revision 3200→3232。releases `e3d80ebb0`、`0bf49021d`（永久重定向 + routeMode basePath）、`7ce11cd90`（kind 规范化到 `?kind=`）。
- **Step 4（facet example-first）**：`templateDirectory.hideTemplates` 标记（paths 保留为词表/注册源）+ 渲染器纯媒体分支（无模板网格/筛选表单）+ 存储ItemList 移除（详情 URL 由 sitemap 覆盖）+ audit `templateCardWithoutDirectory` 规则退休。manifest `scripts/{plan,apply}-aidreamcapes-facet-example-first.mjs`，28 行。release `228a450c2`。
- **实际案例总量**：328 条（video 234 / photo 94），单一属主 + 无别名口径与 sitemap 完全同源。
- audit 既有已知项维持：45 placementOnUnroutableCard（example-gallery 无 publicSlug 卡）+ 36 templateCardPlacementIgnored。
