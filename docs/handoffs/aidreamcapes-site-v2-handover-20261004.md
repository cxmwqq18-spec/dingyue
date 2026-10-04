# Aidreamcapes.com v2 站点交接说明(2026-10-04)

写给接手或同时在这个仓库工作的人(Red、Codex)。范围只限 `site_aidreamcapes`(aidreamcapes.com)。
遵守 `AGENTS.md`:Aidreamcapes 的工作不得写入 MyDreamShoots(`site_dreamshoot`)的数据、页面、素材或部署记录。

## 1. 现在线上是什么状态

| 项目 | 内容 |
| --- | --- |
| 线上版本 | `857fd8743bfd0394ff59bab8f87f358c1d4b4917`,发布目录 `/www/wwwroot/aidreamcapes.com/releases/857fd8743bfd0394ff59bab8f87f358c1d4b4917-seo`,`current` 指向它 |
| 数据 | 78 个 v2 页面已写入生产库 `LivePage`(`siteId = site_aidreamcapes`),回读校验 PASS |
| 数据备份 | `/www/wwwroot/aidreamcapes.com/releases/backups/site-v2/site-v2-production-20261004073623.json`(仅供审计,不得用来回滚或恢复,见第 6 节) |
| 线上校验 | 85 个页面全部 200;565 个图片地址全部可打开;同页无重复图片;任何一张图最多出现在 6 个页面;站点地图 85 个页面、376 条图片记录 |
| 其他站点 | `www.mydreamshoots.com`、`aidreamcapes.eu` 的 robots、站点地图、首页、`/pricing` 在发布前后逐字节一致 |

本次发布内容:新增 12 个产品(口红、连帽衫、手提包、切尔西靴、墨镜、手机壳、瑜伽垫、蛋白粉罐、咖啡袋、辣酱、香薰蜡烛、绿植花盆),
每个 1 张白底图加 3 张场景图,共 48 张,用在行业页、平台页、节日页、照片工具页、文章头图、`/inspiration`(15 个示例)和首页(3 个示例)。
示例行排版改为按图片比例分配宽度。

## 2. 代码和你们新 `main` 的关系

GitHub `main` 在 2026-10-04 被改写(提交 `6c9969f3e` "Move public media outside code releases" 起,历史与我本地分支没有共同祖先)。
我对比了本地 `857fd8743` 和 `origin/main`(`79b113dd4`):**除 `public/` 和 `docs/` 外,Aidreamcapes 相关的代码和数据没有差异**,
也就是新 `main` 已经包含了这次发布的全部 Aidreamcapes 代码与数据(`scripts/data/aidreamcapes-site-v2/**`、
`scripts/lib/aidreamcapes-site-v2-content.mjs`、`src/components/storefront/aidreamcapes-v2/**` 等)。差异只在 MyDreamShoots 的文件和被移出仓库的媒体。
我没有强推,也没有改动 `main` 的历史。

## 3. 媒体文件(最需要注意的一点)

新 `main` 不再在 Git 里放 `public/assets/`,媒体由仓库外同步(见 `docs/public-static-media.md`)。对 aidreamcapes.com 这意味着:

- aidreamcapes.com 的图片和视频**只存在于服务器当前发布目录的 `public/`**:
  `/www/wwwroot/aidreamcapes.com/current/public/assets/sites/site_aidreamcapes/**`。
  其中本次新增的 132 个文件在 `.../site-v2/gen/`(12 个产品 × 4 张,每张含原图、`--640`、`--1280` 三个尺寸;
  1024 的白底图只有原图和 `--640`)。
- `scripts/deploy-aidreamcapes-release.mjs` 新建发布目录时从现有 `current` 复制 `public/`(`cp -a "$BASE/public" "$RELEASE/public"`),
  所以只要沿用这个脚本,新版本会自动带上这些文件。**不要换成不复制 `public/` 的部署方式,也不要清理旧发布目录的 `public/`,
  在确认新发布目录里这些文件齐全之前不要删除旧发布目录。**
- `scripts/sync-public-media.mjs` 的目标里没有 `aidreamcapes.com`(只有 `www.mydreamshoots.com`、`aidreamshoots.eu`、`aidreamcapes.eu`)。
  如果要把 aidreamcapes.com 也改成共享静态目录,需要新增目标并先同步、再切换,不能只改一半。
- 页面里每个图片地址都要求对应文件真实存在,否则站点地图和冒烟检查会失败(`image-page-membership`、`image-status`)。
- 不要在文件还没上线时用公网域名去探测这些地址:Cloudflare 会把 404 缓存很久(记忆条目 `never-probe-undeployed-asset-urls`)。
- 这 132 个新图片的本地副本在我的机器 `public/assets/sites/site_aidreamcapes/site-v2/gen/` 里。
  如果服务器上的发布目录被清理,请从那里或服务器上的 `current` 复制,不要重新生成(生成需要中转站密钥和余额)。

## 4. 页面是怎么生成并写入数据库的

内容来源在 `scripts/data/aidreamcapes-site-v2/`(`master.json`、`content/*.json` 共 78 个、`media-plan.json`、`media-catalog.json`、`utility-pages.json`),
由 `scripts/lib/aidreamcapes-site-v2-content.mjs` 的 `buildSiteV2` 生成,并用 `validateSiteV2` 校验(标题长度、描述长度、同页不重复图片、开头段落包含主关键词、文章入链数量等)。
页面渲染走 section 类型 `aidreamcapes_v2_page`,全部服务器端渲染,公开页面不做任何客户端取数。

写入命令(默认只预演):

```sh
# 本地
DINGYUE_ENV=local DATABASE_TARGET=local node scripts/migrate-aidreamcapes-site-v2.mjs --apply-local --confirm=site_aidreamcapes
# 生产(在服务器当前发布目录里运行;先不带参数预演,看改动清单)
DINGYUE_ENV=production DATABASE_TARGET=production node scripts/migrate-aidreamcapes-site-v2.mjs
DINGYUE_ENV=production DATABASE_TARGET=production node scripts/migrate-aidreamcapes-site-v2.mjs \
  --apply-production --confirm=production --backup-dir=/www/wwwroot/aidreamcapes.com/releases/backups/site-v2
```

要点:
- 脚本只允许 `site_aidreamcapes`,写入前备份、写入后逐页回读比对哈希。
- 政策页、商品、站点品牌、页脚税号等采用字段级补丁:只有字段仍是旧值时才替换,遇到线上已被改过的值会报冲突而不是覆盖。线上编辑优先。
- 页面内容的唯一公开来源是 `LivePage.contentJson`;不要再读 `ThemePage`、`draftJson`、`publishedJson`。

## 5. 发布顺序(已验证有效)

1. 先把新增的 `public/` 文件传到**当前线上发布目录**的 `public/` 里(tar 用 `-C public`、相对路径、`--no-same-owner`,传完删除 macOS 的 `._*` 文件并 `chown root`)。
2. 把提交推到 GitHub `main`(要求 `origin/main` 与发布提交完全相同),先 `git fetch` 再推,不强推。
3. `node scripts/deploy-aidreamcapes-release.mjs --commit=<40位SHA> --apply --confirm=deploy-aidreamcapes`:
   在服务器上构建候选版本,用 `scripts/smoke-aidreamcapes-seo-contract.mjs` 对**当前生产数据**跑冒烟,通过后才切换 `current`。
4. 在新发布目录里先预演、再执行页面数据迁移(第 4 节)。
5. 线上验证时给页面加 `?cb=<时间戳>`(HTML 在 Cloudflare 缓存 300 秒)。

因为第 3 步的冒烟发生在第 4 步迁移之前,**新代码必须能渲染旧数据**:改页面数据结构时要保留对旧结构的兼容,
并且冒烟里只能放由代码决定的断言,不能放"迁移后才成立"的文案断言。我曾因此被拒绝过两次候选版本(没有切换到坏版本)。

## 6. 约束(请继续遵守)

- 不要切换、恢复、导入任何历史发布或快照;历史快照只用于审计。文案回滚只能做成针对当前关系型数据的字段级反向清单。
- 公开页面文案只能写给最终用户:不得出现内部说明、SEO 策略、提示词或设计备注。生成的图片必须没有可读文字、水印和品牌标志。
- 共享层(`src/components/theme-renderer.tsx`、共享导航、共享主题、迁移、同步脚本、部署配置)的改动不得影响 MyDreamShoots。
  本次在 `theme-renderer.tsx` 只增加了向 v2 外壳传公司信息的一处,并且只在 `aidreamcapesV2Navigation?.version === 2` 分支内生效。
- 完成 Aidreamcapes 任务前检查 `git diff --name-only` 都在 Aidreamcapes 范围内,数据库命令必须带 `site_aidreamcapes` 过滤。

## 7. 验证方法

```sh
# 生成并校验全部页面数据(应输出 0 个错误)
node -e "import('./scripts/lib/aidreamcapes-site-v2-content.mjs').then(m=>{const b=m.buildSiteV2();console.log(b.pages.length,m.validateSiteV2(b).length)})"
# 官方冒烟(对本地或候选服务)
AIDREAMCAPES_SEO_ORIGIN=http://127.0.0.1:3002 node scripts/smoke-aidreamcapes-seo-contract.mjs
```

本机访问线上需要代理:`HTTPS_PROXY=http://127.0.0.1:7897 node --use-env-proxy ...`,或 `curl -x http://127.0.0.1:7897`。
Cloudflare 的邮箱混淆会把页面里的邮箱显示成 `[email protected]`,检查邮箱文字时不要把它当成页面缺陷。

## 8. 未完成事项

- 在 Google Search Console 和 Bing Webmaster Tools 提交 `https://aidreamcapes.com/sitemap.xml`,并对首页、`/inspiration`、`/industries`、`/ai-video-generation` 请求编入索引(需要站点所有者账号)。
- 价格页"Choose"按钮应指向 `/app/create?plan=`,结账仍显示"coming soon"。
- Cloudflare Scrape Shield 的邮箱混淆需要在后台关闭。
- 站上没有真实评价和客户案例,没有编造;有真实内容时再补。
- 生图中转站的密钥曾出现在聊天记录里,建议更换。
- `/state-privacy` 只有约 275 字(简短的法律声明),没有为凑字数而扩写。

## 9. 2026-10-04 之后的变更

- 提交 `828898005`(已上线,线上数据已迁移,回读 PASS):
  - v2 页面里所有指向 `/app/...` 的开始按钮,在渲染时改成 `/login?mode=register&next=<原地址>`,新访客直接看到注册表单;已登录用户会被登录页直接转到 `next`。
    转换只在 `src/components/storefront/aidreamcapes-v2/parts.tsx` 的 `withStartLinks` 里做;链接产品页地址的表单仍直接提交到 `/app/create`。
  - 每页数据新增 `startNote`(由 `PLANS` 生成的价格与失败退回积分说明),显示在开始按钮下方;旧数据没有这个字段时不显示。
  - 列表页、`/inspiration`、FAQ、Trust & Safety 增加收尾按钮;每篇文章中间加一个对应工具的试用框(`ARTICLE_TOOL`);每个示例加"Try this with your product"(`FLOW_TOOL`)。
  - 购物车 `/cart` 的 `cart_intro_1` 原本没有图片,共享渲染器会显示旧的人像相册文案;现在通过 `utility-pages.json` 的字段补丁给它加了一张产品图,不改共享代码。

## 10. 域名迁移:网站现在是 https://www.aivideosugc.com(2026-10-04)

站点所有者要求以 `www.aivideosugc.com` 作为网站域名,`aidreamcapes.com` 不再使用(品牌名 Aidreamcapes 不变)。

- 代码(`099c54dd3`、`6ba487328`,已上线):规范地址、站点地图、robots、llms.txt、结构化数据、HSTS(`server.mjs`)都使用 `https://www.aivideosugc.com`。
  中间件把 `aivideosugc.com`、`aidreamcapes.com`、`www.aidreamcapes.com` 以及 http 访问 301 到 `https://www.aivideosugc.com`(保留路径和查询)。
  渲染时会把旧数据里残留的旧域名统一换成新域名(`seo-projection.ts`、`json-ld.ts`)。
- 数据库(仅 `site_aidreamcapes`):`scripts/migrate-aidreamcapes-domain.mjs` 新增 `www.aivideosugc.com`(主域名)和 `aivideosugc.com` 两条 `SiteDomain`,
  `Site.primaryDomain` 改为 `www.aivideosugc.com`;旧的 aidreamcapes.com 记录保留为非主域名、状态 active。
  条款、Cookie、State Privacy 页里写网站地址的地方已改为新域名(`utility-pages.json` 的 replace 补丁)。
- 服务器 nginx:`/www/server/panel/vhost/nginx/aivideosugc.com.conf` 负责 `www.aivideosugc.com` 的网站反代(端口 3013);
  `aidreamcapes.com.conf` 现在只做 301 到新域名,并保留 ACME 验证路径(新域名在源站沿用 aidreamcapes.com 的证书,证书续期仍走这个路径)。
  旧配置备份在 `/www/wwwroot/aidreamcapes.com/releases/backups/nginx/`。
- 部署脚本和冒烟检查都改为用 `www.aivideosugc.com` 访问;服务目录名仍是 `/www/wwwroot/aidreamcapes.com`、服务名 `aidreamcapes.service`,没有改。
- 客服邮箱仍是 `support@aidreamcapes.com`(邮件依赖该域名的邮箱服务)。**不要让 aidreamcapes.com 过期**:跳转、证书续期和邮箱都还依赖它。
- 需要站点所有者在 Google Search Console 添加新域名、提交新站点地图,并在旧域名属性里使用"更改地址"工具指向新域名。
