# Live Storefront SSR

公开站点唯一的数据路径是服务端实时读取 PostgreSQL：页面、主题设置和店铺资料使用最新 `draftJson`，保存成功后立即对外生效。公开请求设置为动态渲染，不使用应用层内容缓存，也不在浏览器发起数据 `fetch()`。

公开渲染不得读取 `SitePublishedState`、`ThemePublication`、`ActiveThemePublication` 或历史 publication 文件。`publishedJson` 仅作为兼容存储保留；它不是公开运行时输入。客户、订单、支付、积分、任务和私有素材继续沿用各自的会话与权限模型。

草稿写入会在事务内扫描公开图片/视频 URL，要求存在站点 `MediaAsset` 记录；本地 `/assets/` URL 还必须对应实际文件。校验失败时整个写入回滚。渲染时如果页面草稿缺少 sections 或引用无效，页面阻断为错误响应，不回退旧版本。

## 上线顺序

1. 创建并验证一次加密数据库备份。
2. 部署实时 SSR 代码并执行 HTTP/HTML/资源冒烟测试。
3. 确认数据库数据完整后执行 `20260829090000_remove_publication_snapshot_tables` 迁移。
4. 重启服务，复核首页、详情页、导航、metadata、JSON-LD、sitemap 和 robots。

备份只用于迁移失败恢复，不作为应用或部署数据源。
