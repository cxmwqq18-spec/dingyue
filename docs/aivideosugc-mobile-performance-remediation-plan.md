# AIVideosUGC 移动端性能整改计划（全列表页同步）

> 生成于 2026-11-02。基线：/templates 移动 PSI 83（性能已近拉满、SEO 有所下滑）；/ai-video-generation 移动 PSI 仍低。
> 本文是 /templates 五批优化（见 aivideosugc-templates-page-performance-plan.md）之后，把同一套优化同步到全部列表页、并处理剩余瓶颈的总计划。

## 0. 诊断结论（生产实测，2026-11-02）

### 渲染阻塞 CSS —— 全列表页共性瓶颈（P0）

- 每个公开页（含 Aidreamcapes）都加载 **6 个 render-blocking CSS，共 ~700KB 原始 / ~116KB gzip**。
- 最大文件 `c40ea7adb54239b0.css` **508KB 原始 / 77KB gzip**，来源唯一：`src/app/layout.tsx` 顶层 `import "./globals.css"`（7009 行，含 Tailwind 全层 + 各站点手写主题：MyDreamShoots 主题、Aidreamcapes 账户台、workspace 面板等）。
- **选择器使用率审计（对 /ai-video-generation 实测）：该文件 1298 个 class 选择器中本页仅用 2 个（0.2%），规则字节 ~474KB/494KB 未使用**——即每个列表页都为完全无关的样式付出 ~77KB gzip 的阻塞渲染成本。PSI「渲染阻塞请求 1,570ms」的主要成分。
- 其余 5 个 CSS（~194KB 原始 / ~39KB gzip）是共享组件的 CSS module，需同样做使用率审计（量级小得多）。

### 图片传送 154 KiB —— 照片卡未进变体管线（P0）

- hub 页 36 个 `<img>` **全部无 srcset**：31 个是 `/ai-image-generation/<slug>` 照片案例原图（视频 poster 已 100% 走 640 WebP 变体，但**照片卡的 image.src 从未进变体管线**）。
- 影响范围：/templates 照片卡、hub 全量目录照片卡、facet 目录照片卡、VisualStrip、（hero Collage 有 srcset 机制但取决于索引覆盖）。
- 根因：`generate-aidreamcapes-v2-responsive-variants.mjs` 的枚举范围只覆盖视频 poster（426 条索引），未覆盖照片案例图。

### SEO 下滑（/templates）—— 分页控件 tap targets（P0，低成本）

- 分页控件实际触达尺寸 38~40px（`.pageNum` 38px、跳页输入框/Go 按钮 ~40px），低于 Lighthouse「Tap targets are sized appropriately」（SEO 类目）要求的 48px；跳页控件与 Next 按钮间距 6px < 8px。数字页码上线于第二批（当时 SEO 98-100），跳页表单上线于第三批——与「SEO 有所下降」的时间线吻合。
- 修复：分页控件统一放大到 ≥48px、相邻间距 ≥8px。仅改 `template-directory.module.css`。

### 缓存生命周期 29 KiB —— 媒体文件 7 天 TTL（P1）

- nginx 对 `/ai-image-generation/*.{img}`、`/ai-video-generation/*.{mp4}`（含 300KB 的 10s 预览片段）下发 `max-age=604800`。`/assets/`（变体）已是 1y immutable。

### 其余观察项（P2）

- **旧版 JavaScript 22 KiB**：Next 兼容性 polyfill，可通过 browserslist 收窄（全站共享构建配置，需评估）。
- **优化 DOM 大小**：hub 现含精选 20 + 全量 20 + hero + 编辑器面板，节点数偏高。`content-visibility` 已把渲染成本推迟，DOM 传输量是 HTML gzip 的一部分，进一步压缩需结构性裁剪（暂缓）。
- **强制自动重排**：仓库内布局读取点仅在首页组件（home-brand-tools/home-experience behavior），hub 上来源需用追踪确认（可能来自第三方或字体交换）。
- **第三方**：页脚合作伙伴徽章 `semilaunch.com/assets/badge.png` 外链图（可自托管进 /assets 并入站）。

## 1. 整改项与顺序

### P0-1 共享 CSS 拆分（用户已批准，共享层——按以下护栏执行）

目标：公开页不再加载与其无关的 508KB globals.css；workspace/账户/管理路由不受影响。

方案（加法拆分、路由组双根布局）：

1. **审计阶段**（先做，只读）：
   - 本地构建确认 `c40ea7…` chunk 的源构成（globals.css 是否 1:1）。
   - 对**每个公开站点**（mydreamshoots、aidreamshoots、aivideosugc 各域）的生产 home + 关键列表页跑同一选择器使用率脚本，量化各站点在 globals.css 上的真实依赖。
   - 确认 workspace/admin/账户路由对 globals.css 的依赖为「全量需要」。
2. **实施阶段**：
   - `src/app` 拆两组路由组根布局：公开组（catch-all storefront + 公开静态页）不 import globals.css，改 import 新建 `public-base.css`（Tailwind base + 各公开页实测用到的规则，加法合并、逐条注释来源）；重任务组（/app、/account、/site/*、管理）保持 `globals.css`。
   - 字体 preconnect/link（已在根布局 head）在两个根布局中都保留。
   - 若其他站点公开页对 globals.css 有真实依赖（>5% 规则），它们的依赖规则同样并入 public-base.css，保证零回归。
3. **验证**：
   - 每个站点生产 home + 一个列表页的渲染前后截图/选择器覆盖率对比；
   - release 冒烟全绿；MyDreamShoots 关键页回归清单（首页、能力页、博客、结账入口）。
   - 回滚：单 commit revert 即恢复。

预期收益：每页 render-blocking -77KB gzip（-66%），PSI「渲染阻塞请求」项直接消除或大幅收窄，全部列表页同步受益。

### P0-2 照片卡进变体管线（Aidreamcapes 范围）

1. 扩展 `generate-aidreamcapes-v2-responsive-variants.mjs` 枚举源：公开卡片 photo kind 的 `image.src`（当前只有视频 poster），生成 320/640 变体并入索引（含 `git add -f` 变体文件入库，沿 batch 1 先例）。
2. 渲染端补 srcset：`GalleryCards` 照片 img、facet 目录照片 img、VisualStrip（给 sizes）、Collage 索引补齐。
3. 预期收益：hub「改进图片传送 154 KiB」清零，照片卡在移动端下载 320px 变体（约 -60~70%/张）。

### P1-1 分页 tap targets ≥48px（本轮已实施）

`.pageNum` 48×48、跳页输入框/Go 48px 高、间距 ≥8px；恢复 /templates SEO 满分并改善移动端可用性。

### P1-2 媒体缓存 TTL 7 天 → 30 天（本轮已实施）

nginx 站点配置（aivideosugc.com.conf）中 `/ai-image-generation/*.{img}`、`/ai-video-generation/*.{mp4,webm,mov,m4v}`、actors 两段与音频段统一 `max-age=2592000`。带备份 + 改后 curl 验证 + 回滚路径。

### P2（后续批次）

- 自托管页脚徽章图（第三方项清零）。
- browserslist 收窄旧版 JS（需与多站点共享构建配置评估）。
- hub 强制重排来源追踪（移动端 trace）。
- DOM 大小：观察 P0 落地后的分数再决定是否结构性裁剪。

## 2. 实施状态

| 项 | 状态 |
|---|---|
| P0-1 CSS 拆分 | 已批准，审计阶段待启动 |
| P0-2 照片变体 | 待实施（媒体管线批次） |
| P1-1 tap targets | 本轮实施 |
| P1-2 缓存 TTL | 本轮实施 |
| P2 | 排队 |
