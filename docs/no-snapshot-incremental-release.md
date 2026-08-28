# 无快照增量发布

## 发布原则

- 代码发布和公开内容发布分离。
- 代码只允许部署 GitHub `origin/main` 的完整 commit SHA。
- 服务器只执行 `prisma migrate deploy`，禁止生产 `prisma db push`。
- 公开内容只允许写入关系表字段，禁止导入 `platform-state`、整库 dump 或历史 publication snapshot。
- 客户、订单、支付、订阅、积分、任务、私有上传、相册、会话和密钥不属于内容发布范围。

## 代码发布

以下顺序是唯一支持的上线顺序。任何一步失败都停止，不切换 `current`，不重启线上服务。

### 1. 本地提交与上线前检查

先确保代码已经提交并推送到 GitHub：

```sh
npm run typecheck
git status --short
git push origin main
git rev-parse HEAD
git rev-parse origin/main
npm run deploy:precheck -- --target=test --commit=$(git rev-parse HEAD)
```

`deploy:precheck` 会执行 TypeScript、公开 SSR、SEO、生产文案和 SEO indexing 检查，并确认工作区没有未提交代码、目标 SHA 存在且等于 `origin/main`。`docs/`、`releases/` 等运维产物可以未跟踪，但源代码、配置、schema 和脚本不能未提交。

生产上线前，把上述命令中的 `--target=test` 改为 `--target=production`，先完成同一套检查。没有通过 precheck 的 commit 不允许上线。

### 2. 代码 release

测试环境：

```sh
npm run deploy:release -- \
  --target=test \
  --commit=<full-40-char-sha> \
  --apply
```

生产环境必须显式确认：

```sh
npm run deploy:release -- \
  --target=production \
  --commit=<full-40-char-sha> \
  --apply \
  --confirm=deploy-production
```

测试 release 使用 `test.grownstride.com` / `grownstride-test.service` / `3011` / `site_grownstride_test`；生产 release 使用 `www.mydreamshoots.com` / `mydreamshoots.service` / `3010` / `site_dreamshoot`。服务器会再次 fetch 并校验 `origin/main` 等于指定 SHA，然后在独立候选端口构建、生成 Prisma client、执行 `prisma migrate deploy`，用 HTML `release-commit` 标记做候选验证。只有候选验证通过后才更新 systemd、切换 `current` 和重启服务；切换后的服务或域名 readback 失败会自动恢复旧 release。

服务器永远不执行 `prisma db push`，不上传本地 `.env`，不导入数据库 dump，也不使用本地未提交代码。

## 内容同步

### 3. 公开内容增量同步（可选）

代码 release 成功后，如果本地有新的首页、详情页、SEO、导航、套餐、视频主题或公开媒体元数据，再执行内容同步。规划阶段只读取目标 PostgreSQL 关系表，不读取或导入 snapshot：

```sh
npm run content:baseline -- --target=local --site-id=site_dreamshoot
npm run content:plan -- --target=production --site-id=site_dreamshoot \
  --source-site=site_dreamshoot --source-url="$LOCAL_DATABASE_URL" \
  --target-url="$PRODUCTION_DATABASE_URL" --bridge --confirm-production \
  --out=releases/manifests/content-v2.json \
  --report=docs/releases/content-v2-plan.md
npm run content:apply -- --target=production --site-id=site_dreamshoot \
  --manifest=releases/manifests/content-v2.json \
  --deployed-commit=<full-40-char-sha> --apply --confirm-production \
  --report=docs/releases/content-v2-apply.md
```

`--deployed-commit` 必须是刚刚成功上线的同一个 SHA。先看 plan 输出，再 apply；apply 会锁定站点、校验 protected business table hash，并在结束时刷新派生公开状态和缓存。线上已经编辑过的同字段会报告 conflict 并跳过，不会覆盖线上。

每次 plan 都会额外生成一个 Markdown 计划文档；每次 apply 都会生成一个 Markdown 执行报告。建议把报告放在 `docs/releases/` 或 `releases/reports/`，上线前由你查看字段差异并确认，上线后保留报告作为变更记录。报告只包含公开字段级值，不包含客户、订单、支付、私有素材或数据库快照。

manifest 使用 JSON Pointer 字段路径和 `baseHash`。目标字段仍等于 baseline 时才写入；线上已经修改时跳过并返回 conflict。删除必须单独列在 `deletions`，并额外传入 `--confirm-deletions`。

本地 `public/` 图片会以单文件 SHA-256 写入对应媒体操作，并且必须已被 Git 跟踪；应用时会重新校验 checksum。manifest 的 `codeCommit` 必须与线上已部署 commit 一致，因此图片由同一精确 release 交付，数据库仅增量写入媒体记录。

`ContentSyncBaseline` 只保存目标、实体、字段和 hash，不保存字段值，因此不能作为快照恢复源。

## 线上编辑

公开页面继续使用 SSR。首页、详情页、导航、SEO、公开媒体和套餐编辑保存后直接更新关系表，并刷新当前公开状态；不需要创建审批记录、点击发布或等待审核。客户素材、合作申请等合规审核仍保持原流程。

## 回滚

- 代码回滚只能切换到已验证的旧 commit release。
- 内容回滚只能生成字段级逆向 manifest。
- 禁止通过 publication/version/active pointer、历史 JSON 或数据库快照回滚公开内容。

## 上线记录

每次上线至少记录以下信息：目标（test/production）、域名、commit SHA、GitHub `origin/main` SHA、release 路径、迁移结果、候选 HTML commit readback、systemd 状态、首页/关键路由 HTTP 结果，以及 content apply 的 applied/conflicts/skipped/deletions 报告。没有这些记录，不视为上线完成。
