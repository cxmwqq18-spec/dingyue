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

### P0-1 共享 CSS 拆分 —— 阶段 1 已上线（release `6e9b7f771`）

阶段 1（表面拆分，2026-11-02）已实施并验证：

- `globals.css`（7010 行）按表面切为 5 个文件：`globals.css`（保留 Tailwind + 公开编辑页规则 + mydreamshoots 展示区，69KB 源码）、`aidreamcapes-account-surfaces.css`（账户台，经 customer-account-shell/data-island 加载）、`aidreamcapes-admin-surfaces.css`（admin/ERP + 登录页 + designer，`@layer components` + `@tailwind components` 指令，经 admin layout/platform/login 加载）、`aidreamcapes-guest-workspace.css`（guest 弹层，随组件加载）、`aidreamcapes-video-topic-detail.css`（详情主题，随 video-topic-landing / ecommerce-main-image-detail 加载）。
- 审计结论（生产实测）：公开站对旧 globals 的真实依赖只有 Tailwind 工具层 + 9 个自定义类；aivideosugc 全系页面几乎为 0（0-3 类）。
- 验证：13 个页面×站点覆盖率断言 **0 类丢失**；release 冒烟全绿；旧 508KB chunk 已不被任何页面引用；行级 reassembly 校验守恒。
- 效果：公开页渲染阻塞 CSS /templates 121→103KB gz（-15%）、首页 116→87KB gz（-25%）；globals chunk 77→56KB gz；公开页不再下载 ~190KB 源码的账户/admin 样式。

**阶段 2（待批准，共享层）**：剩余大头是 Tailwind utilities 全量层（新 globals 387KB raw / 56KB gz 中约 300KB raw / ~45KB gz），由根布局 `@tailwind` 指令 + 全仓 content 扫描产生，所有路由共享。需要把 `src/app` 拆为路由组（公开组 vs 工作台组）并按组收窄 tailwind `content` 扫描范围，公开页 utilities 可再降到 ~6-10KB gz。涉及全站路由结构，需站点所有者批准后实施。

### P0-2 照片卡进变体管线（Aidreamcapes 范围）—— 已上线（release `b07d8cd6`，2026-11-02）

1. ✅ 生成器扩展：`generate-aidreamcapes-v2-responsive-variants.mjs` 新增 `--site-wide-images` 全站扫描模式（递归遍历 site_aidreamcapes 全部 208 个 LivePage 行的 contentJson，收集 1510 个图片源），生成 **1787 个新 WebP 变体**（manifest 426 → 1636 条），变体文件沿 batch 1 先例 `git add -f` 入库（2241 个）。缺失的 45 张源图已从生产补齐后生成。移动端预估 **-78.3% 图片字节**（91.7MB → 19.9MB）。
2. ✅ 渲染端接线（全部经 `r.asset` 保持 EU 镜像一致）：`template-directory.tsx` 四处 `cardImage`（含 `?kind=photo` 目录卡）、`shell.tsx` MenuLink 导航缩略图（120px）、`parts.tsx` ToolLink（46px）；新增 `aidreamcapesV2ResponsiveImagePropsFor(src, sizes, asset)` 带资产解析包装，保留原 `aidreamcapesV2ResponsiveImageProps` 兼容导出。
3. ✅ 生产验证：`/templates` 13、`/templates?kind=photo` 37、`/ai-video-generation` 26、`/ai-image-generation` 28、`/ai-actors` 78 处 srcSet 属性（React 19 输出驼峰 `srcSet`，浏览器等价处理）。视频卡 poster 沿用第五批映射。残余 3 张 hub hero 图（各 ~66KB）带 srcSet 且浏览器按 DPR 正确选 640w，属审计口径误差。
4. 实测（隧道 Lighthouse，PSI 同款移动节流模拟）：`/templates` **88 → 92**，「properly size images」机会项清零；`/ai-video-generation` 66 → 67（该页主要机会项已转为 SSR 服务器响应，见 §0.1）。

### P0-3 测量能力与剩余瓶颈（2026-11-02 建立）

- 已建立自测回路：SSH 隧道（本地 18443 → 源站 443）+ 本地 Lighthouse CLI（PSI 同款移动节流模拟），不再依赖用户截图。注意点：lighthouse CLI 的 `--chrome-flags` 值含空格需内层单引号；本机系统代理需 `--no-proxy-server`；本机网络 `fonts.googleapis.com` 挂起需 MAP 到 127.0.0.1 快速失败（真实中国大陆用户同样受此影响——**自托管字体是新的候选优化**）。
- 当前两页机会项排序：① **SSR 服务器响应 1.1~1.4s**（两页共同的第一大项，源站本机 TTFB 0.6~0.9s、偶发 2.4s——需要页面级缓存/派生态方案，涉合约需站点所有者拍板）② 渲染阻塞资源 750ms ③ 未用 CSS 450~600ms/85~112KB（Tailwind 层，即 CSS 拆分阶段 2）④ 未用 JS。
- 源站证书仅覆盖 aidreamcapes.com；aivideosugc.com 依赖 Cloudflare 边缘证书（若绕过 CF 直连或升级 Full (strict) 会出证书问题，已记录）。

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
| P0-1 CSS 拆分 | 阶段 1 已上线（6e9b7f771）；阶段 2（路由组+tailwind content 收窄）待批准 |
| P0-2 照片变体 | 待实施（媒体管线批次） |
| P1-1 tap targets | 本轮实施 |
| P1-2 缓存 TTL | 本轮实施 |
| P2 | 排队 |
