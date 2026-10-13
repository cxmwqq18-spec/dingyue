# git 说明（AIVideosUGC 移交，2026-10-12）

仓库：https://github.com/cxmwqq18-spec/dingyue

| 分支 | 放什么 | 最新提交 |
|---|---|---|
| `main` | 网站全部代码（线上就是从 main 部署的） | ccb309676（首页去掉生成框，尚未部署到线上；线上当前是 057b5db43） |
| `handover/aivideosugc-2026-10-12` | 交接文档：`交接/`、`决定/`、`CLAUDE.md`（就是本压缩包里的这些） | 见该分支最新 |

## 取代码
```
git clone git@github.com:cxmwqq18-spec/dingyue.git
cd dingyue && git checkout main
# 看交接文档：
git fetch origin handover/aivideosugc-2026-10-12 && git checkout handover/aivideosugc-2026-10-12 -- 交接 决定 CLAUDE.md
```

## 注意
- 同一仓库还有 MyDreamShoots 站，只改 AIVideosUGC（站点 id `site_aidreamcapes`）相关代码。
- 别人也会往 main 推，推之前先 `git fetch` 再 rebase，不要强推。
- 推到 main 不会自动上线；上线走说明书第 5 节的发布流程。main 上 ccb309676 还没上线，下次发布会带上它（首页首屏改成两个按钮）。
- 页面内容改完要跑迁移脚本写进数据库才会在线上生效（见说明书第 2、5 节）。
- 生产服务器和数据库的访问方式找老板要，不在仓库里。
