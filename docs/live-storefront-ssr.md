# Live Storefront SSR

公开站点唯一的数据路径是服务端实时读取 PostgreSQL。页面正文、SEO 和页面媒体配置只读取 `LivePage.contentJson`；事务提交后，下一次服务端请求立即读取新值。这个过程不创建草稿、不点击发布、不等待部署，也不使用应用层内容缓存或浏览器端数据 `fetch()`。

公开渲染不得读取 `ThemePage`、`ThemePage.draftJson`、`ThemePage.publishedJson`、`SitePublishedState`、`ThemePublication`、`ActiveThemePublication` 或历史 publication 文件，也不得在 `LivePage` 缺失时回退到这些旧数据。`ThemePage` 仅作为尚未迁移完的内部后台兼容表保留；修改它不会改变公开页面。客户、订单、支付、积分、任务和私有素材继续沿用各自的会话与权限模型。

`LivePage.contentJson` 写入应在事务内扫描公开图片/视频 URL，要求存在站点 `MediaAsset` 记录；本地 `/assets/` URL 还必须对应实际文件。校验失败时整个写入回滚。渲染时如果实时页面缺少 sections 或引用无效，页面阻断为错误响应，不回退旧版本。

## 上线顺序

1. 创建并验证一次加密数据库备份。
2. 部署实时 SSR 代码，并执行 `20260901020000_add_live_pages` 迁移。该迁移只在首次执行时将当时的 `ThemePage.draftJson` 复制到 `LivePage.contentJson`。
3. 执行 HTTP/HTML/资源冒烟测试，确认所有公开路由均来自 `LivePage`。
4. 重启服务，复核首页、详情页、导航、metadata、JSON-LD、sitemap 和 robots。

迁移完成后，运行时不会继续同步或读取 `ThemePage`。备份只用于迁移失败恢复，不作为应用或部署数据源。
