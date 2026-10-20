# AIVideosUGC 公共案例卡 → 工作台入口链路审计（2026-10-21）

## 结论

用户的问题有两个，答案都是肯定的：

1. **所有公共页面的案例卡都跳到固定的工作台 URL**：`/app/create/ai-video-generation`、`/app/create/ai-image-generation`、`/app/create/ai-actors`。7 个公共页面共 **278 张入口卡**，没有任何一个把案例数据写进 URL 的 query 或 hash。
2. **每张卡都会把自己的案例参数带进工作台**：身份不放在 URL 里，而是放在服务端渲染的 `data-workspace-entry` 惰性载荷中；点击时浏览器把它写入 2 分钟 cookie，工作台服务端用这个载荷回到**当前关系行**（`LivePage.contentJson`）解析出该案例自己的 prompt / 场景 / 画幅 / 时长 / 模板标题 / 预览图，并预填到对应模块。

审计脚本用真实 HTTP 请求**重放了浏览器的那次交接**（构造同样的 cookie → 请求工作台落地页 → 检查落地页 HTML），因此验证的是真实落地结果，而不是只相信载荷本身。生产环境结果：**0 失败**。

## 审计方法

新增脚本 `scripts/aidreamcapes-workspace/audit-workspace-entry-transfer.mjs`（只读，不写任何数据）：

1. 抓取公共页面 HTML，解析所有 `href` 指向 `/app/create` 的锚点。
2. 断言每个工作台链接都是固定路径段，且没有 `prompt/actor/scene/aspect/duration/source/preset/template/tool/view` 等参数泄漏。
3. 解析 `data-workspace-entry`，把载荷还原成点击时浏览器写入的 cookie：
   `adc_workspace_entry_<view>=encodeURIComponent(JSON.stringify({...entry, expires: now+120000}))`。
4. 带上该 cookie 请求卡片自己的工作台落地路径，检查落地页 SSR HTML：
   - 案例卡：必须出现该案例的模板标题、预览图（媒体/模板类）或自己的提示词（提示词类）或自己的演员名（演员类）；
   - 通用工具入口：必须落在正确模块，并且**不得**显示任何模板；
   - 模板类还必须显示与模块一致的徽标（视频模块 = Video template，图像模块 = Image template），出现另一个模块的模板即判失败。

运行方式：

```sh
# 生产环境（在能访问 Cloudflare 边缘的机器上执行）
AIDREAMCAPES_AUDIT_ORIGIN=https://www.aivideosugc.com \
  node scripts/aidreamcapes-workspace/audit-workspace-entry-transfer.mjs

# 本地/候选环境
AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3015/site/aivideosugc \
  node scripts/aidreamcapes-workspace/audit-workspace-entry-transfer.mjs
```

## 生产实测（2026-10-21，www.aivideosugc.com）

| 页面 | 入口卡 | 案例卡 | 工具入口 | 案例交接 | 模板标题命中 | 预览图命中 | 提示词命中 | 演员名命中 | 工具入口落在正确模块 |
|---|---|---|---|---|---|---|---|---|---|
| `/` | 33 | 28 | 5 | 28/28 | 20/20 | 20/20 | 8/8 | — | 2/2 |
| `/ai-image-generation` | 9 | 4 | 5 | 4/4 | — | — | 4/4 | — | 5/5 |
| `/ai-actors` | 54 | 53 | 1 | 53/53 | — | — | — | 53/53 | 1/1 |
| `/ai-video-generation` | 47 | 38 | 9 | 38/38 | 38/38 | 38/38 | — | — | 9/9 |
| `/templates` | 54 | 54 | 0 | 54/54 | 54/54 | 54/54 | — | — | — |
| `/templates/photo` | 27 | 27 | 0 | 27/27 | 27/27 | 27/27 | — | — | — |
| `/templates/video` | 27 | 27 | 0 | 27/27 | 27/27 | 27/27 | — | — | — |

说明：

- `/` 的 28 张案例卡里，20 张是媒体/模板型（标题+预览图命中），8 张是提示词型（agent 演示提示词命中）。
- `/ai-actors` 的 53 张演员卡全部带 `actor` 身份，落地页确实渲染出该演员本人（53/53）。
- `/ai-image-generation` 的 4 张案例卡都带自己的提示词，落地页 composer 预填（4/4）；另外 5 个是通用工具入口，落地页只打开图像模块、不显示任何模板。
- `/templates/photo` 与 `/templates/video` 已经是**不同**的两批卡（各 27 张），早前“photo 路由复用 video 内容”的伪过滤问题在当前生产上已不存在。
- 7 个页面上的普通工作台导航链接（`/app/create/home`、`/app/create/library`、`/app/create/text-to-video`）不带任何案例数据。

## 结论性判断

| 用户诉求 | 状态 | 说明 |
|---|---|---|
| 案例卡跳到指定工作台 URL | 已满足 | 全部为固定路径段，无 query / hash |
| 案例卡把自己的参数带进工作台 | 已满足 | 载荷 → cookie → 服务端按当前关系行解析 → 落地页预填 |
| 切换模版后另一个模块仍显示同一份模版数据 | **未满足（工作台缺陷）** | 工作台内部把 photo / video 模版存在同一个状态里，模版库也把两种模版混在同一个弹窗中 |
| 视频时长只有 15s / 30s 两档 | **未满足（工作台缺陷）** | 生产模型能力仍是 6/10/15s，30s 档位没有出现 |
| 下拉框观感 | **未满足（工作台缺陷）** | 仍是系统原生 `select` 控件 |

后三项属于工作台内部实现，已在同日的《AIVideosUGC 工作台模块隔离与控件整改》文档中修复并验证。

## 边界说明

- 本次审计与整改都是**代码级**改动：没有写入任何 `LivePage` 内容、没有发布动作、没有快照导入，也没有触碰 MyDreamShoots。
- 公共门店文案中仍有 “6, 10, 15, or 30 seconds” 之类的旧时长描述（例如 `scripts/data/aidreamcapes-site-v2/content/*.json`）。它属于公共内容，需要单独的字段级 manifest 才能修改，本次未改动，已在整改文档中列为待办。
