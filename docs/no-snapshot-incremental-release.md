# 无快照增量发布

## 发布原则

- 代码发布和公开内容发布分离。
- 代码只允许部署 GitHub `origin/main` 的完整 commit SHA。
- 服务器只执行 `prisma migrate deploy`，禁止生产 `prisma db push`。
- 公开内容只允许写入关系表字段，禁止导入 `platform-state`、整库 dump 或历史 publication snapshot。
- 客户、订单、支付、订阅、积分、任务、私有上传、相册、会话和密钥不属于内容发布范围。

## 代码发布

先在本地完成检查：

```sh
npm run typecheck
npm run deploy:precheck -- --target=production --commit=$(git rev-parse HEAD)
```

生产部署必须显式确认：

```sh
npm run deploy:release -- \
  --target=production \
  --commit=<full-40-char-sha> \
  --apply \
  --confirm=deploy-production
```

测试环境使用 `--target=test`，不会触碰生产服务。部署脚本会在服务器校验 `origin/main` 等于指定 SHA，再构建、执行迁移、切换 release 和重启对应 systemd 服务。

## 内容同步

内容同步从本地隔离 PostgreSQL 生成字段级 manifest。规划阶段必须同时提供目标数据库 URL；目标 URL 只用于读取当前线上关系表，绝不导入快照：

```sh
npm run content:baseline -- --target=local --site-id=site_dreamshoot
npm run content:plan -- --target=production --site-id=site_dreamshoot \
  --source-site=site_dreamshoot --source-url="$LOCAL_DATABASE_URL" \
  --target-url="$PRODUCTION_DATABASE_URL" --bridge --confirm-production \
  --out=releases/manifests/content-v2.json
npm run content:apply -- --target=production --site-id=site_dreamshoot \
  --manifest=releases/manifests/content-v2.json \
  --deployed-commit=<full-40-char-sha> --apply --confirm-production
```

manifest 使用 JSON Pointer 字段路径和 `baseHash`。目标字段仍等于 baseline 时才写入；线上已经修改时跳过并返回 conflict。删除必须单独列在 `deletions`，并额外传入 `--confirm-deletions`。

本地 `public/` 图片会以单文件 SHA-256 写入对应媒体操作，并且必须已被 Git 跟踪；应用时会重新校验 checksum。manifest 的 `codeCommit` 必须与线上已部署 commit 一致，因此图片由同一精确 release 交付，数据库仅增量写入媒体记录。

`ContentSyncBaseline` 只保存目标、实体、字段和 hash，不保存字段值，因此不能作为快照恢复源。

## 线上编辑

公开页面继续使用 SSR。首页、详情页、导航、SEO、公开媒体和套餐编辑保存后直接更新关系表，并刷新当前公开状态；不需要创建审批记录、点击发布或等待审核。客户素材、合作申请等合规审核仍保持原流程。

## 回滚

- 代码回滚只能切换到已验证的旧 commit release。
- 内容回滚只能生成字段级逆向 manifest。
- 禁止通过 publication/version/active pointer、历史 JSON 或数据库快照回滚公开内容。
