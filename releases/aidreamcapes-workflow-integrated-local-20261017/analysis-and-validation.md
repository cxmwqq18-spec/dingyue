# Aidreamcapes 本地整改与数据追查

本次仅本地，不部署、不触碰生产数据库，不激活任何历史 publication/snapshot。

## 六步流程

依据 workflow-integrated-v2.png 实现 3×2 图文一体卡片。标题、阶段示意图和简介位于同一卡片，删除旧的过滤器与重复说明列表。图片放大、人物/版本选择、可编辑简报、原生表单工作台跳转、用户主动播放镜头序列为本地交互。序列明确标为示例，不假装生成或提供不存在的 MP4。

## 面包屑

修正 AI Video Generation、AI Image Generation 的父级名称和归属；例如图片模板不再错误指向 Templates。对各分类下已审阅的名称进行对应修正，同步 LivePage 可见面包屑与 BreadcrumbList。保留现有 URL、canonical、页面营销 H1 和正文。生成输入使用相同的 Aidreamcapes 专属 taxonomy，公共运行时仍仅读取 LivePage。

## “卖家信任”追查

1. 10 月 16 日生产字段清单的旧值为 Responsive Customer Support / Get help whenever you need it, so your campaigns never miss a launch.
2. 同一清单明确将它改为 Email Support When a Job Sticks / A billing question or a stuck export can go to support@aivideosugc.com. Send the product page and the file name. content-apply.json 记录了这两个字段被应用，final-email-readback.json 记录了上线读取结果。
3. 本次只读访问 www.aivideosugc.com 返回 200，支持卡片仍是第二版。本地也相同。因此现有证据不能认定这张卡片最近发生了数据库回退。
4. 确认另一个具体差异：本地导出说明仍包含旧的无水印/直接发布说法；当前线上已经改为按所选工作流检查支持比例的说明。
5. 本地英语修复脚本 repair-aidreamcapes-home-v4-english-local.mjs 会按旧编辑清单逐字符串逆转翻译。相关执行证据显示这类操作确实执行过；这解释了为何本地保留旧英语措辞，但不能据此推断未记录的生产操作。
6. 本次以当前关系数据为基础，单独重写六张信任卡片：人物、语言、账户/账单/导出支持、渠道比例、下载前审核和品牌一致性。支持邮箱为可点击邮件链接。删除未经当前工作流确认的数量和能力承诺。没有恢复任何整页旧数据。

## 数据边界

owner 为 site_aidreamcapes 的 LivePage.contentJson；字段级完整差异见 final-field-manifest.json。所有其他站点 LivePage hash 前后均为 e4837ab6af10f64648964f42b1d733b2fb28855d9cc0bef81432e7bf16e3f7bd。当前本地没有 SitePublishedState 表，公共 SSR 直接读取关系数据。首页 TDK、其他 SEO 字段、媒体 manifest 和指定的七模块顺序保持不变。详情页只更改面包屑和对应 schema。

## 验证

最终结果见 browser-check.json、ssr-breadcrumb-check.json。TypeScript、局部 ESLint、git diff --check、LivePage SSR 数据守卫与内容构建输入检查已执行。

全仓 public-storefront-ssr 守卫仍被工作区开始前就存在的 staged dreamshoot-showcase-video.tsx 客户端化修改阻挡。这不是 Aidreamcapes 改动，本次未修改该文件；因此没有声称全仓发布检查通过。

最终结果：71 个页面的公开 HTML 均返回 200，可见面包屑与各自 BreadcrumbList 一致。六步卡片、七模块顺序、360/390/768/1100/1566px 排版、图片加载、邮件链接、简报表单、弹窗焦点恢复、镜头序列和无 JavaScript SSR 均通过。浏览器无页面错误、无业务内容 fetch/XHR。TypeScript 通过；局部 ESLint 无错误，仅 parts.tsx 已有的两个原生 img 性能提示。首次批量并发读取遇到开发服务 503，服务恢复后以串行方式完整重跑 71 页成功；开发 HMR 的静态热更新请求不计作业务内容请求。
