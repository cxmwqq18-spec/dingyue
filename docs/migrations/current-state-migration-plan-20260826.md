# 全平台唯一当前状态迁移记录（2026-08-26）

状态：`REVIEW_REQUIRED / MIGRATION_REQUIRED / PUBLISH_BLOCKED / DEPLOYMENT_UNVERIFIED`

本记录依据 `platform-current-state-only-contract.md`，并以当前工作区、正确 `DATABASE_TARGET`、Prisma schema/client、只读数据库和 origin/public readback 为准。

## 已确认差异

- 当前 HEAD 为 `49e6aa9a521f8d04496737dfb8d410f5f901c286`，不是合同记录的 `a79a5294...`；工作区存在用户未提交和未跟踪文件，均保留。
- 正确 local target 为 `127.0.0.1:15433/dingyue_local`。当前数据库尚无 `SitePublishedState`，因此新 migration 仅已生成，未应用。
- local/remote 仍存在 `ThemePublication`、`ActiveThemePublication` 和 `publishedJson`；两套内容不一致，不能互作迁移源。
- 现有外部归档只有 SHA-256 和 archive-list 证据，缺少合同要求的 receipt、隔离恢复和关键 readback，不能作为 `VerifiedBackupReceipt`。
- origin 存在多个旧 Next 进程，且 app/current symlink 与 serving release 不一致；单 serving commit 尚未证明。

## 本轮允许范围

- 本轮记录调整只允许修改本文件和同目录整改清单；不执行代码、schema、迁移、数据库、远程写入、删除、历史清理或部署。
- 现有代码改动属于 staged migration，不能被记录解释为已完成迁移；当前公开运行必须继续保持发布/部署阻断。
- 旧 publication activate/restore/rollback/page-publish HTTP 入口已返回 `410 legacy_publication_route_retired`，但脚本、guard、fixture 和后台仍有历史模型命中，必须完成分类后才能解除阻断。

## 必须补充的实现调整

### 1. 候选来源与 current-state owner

- `compileCurrentPublishedPayloadRelational` 必须只读取 draft/source、商品事实、媒体、套餐、链接和 SEO source；不得 include 或读取 `activePublication`、`publications`、`latestPublication`。
- 候选编译不得把 `ThemePage.publishedJson`、`ThemeSettings.publishedJson` 或 `StorefrontProfile.publishedJson` 当作公开事实源；这些字段在迁移期只允许用于只读差异核对。
- runtime、SSR、SEO、JSON-LD、sitemap、robots、guard 和缓存只允许读取 `SitePublishedState(siteId)`；缺失、无效或 hash 不一致必须 fail closed。
- 代码中临时构造的 publication-shaped 对象只能作为过渡适配，不能继续暴露 `publicationId`、version 或历史身份；最终应移除旧类型依赖。

### 2. 审批与 candidate hash

- 审批记录必须绑定 `siteId`、draft/source revision、最终 candidate `contentHash`、candidate `revision`、对象范围、申请人、审批人、审批时间和过期时间。
- approve action 必须只允许合规 owner/admin 审批 pending 记录；过期、已消费、站点不匹配或对象范围变化均拒绝。
- publish 必须在同一事务中重新编译 candidate、校验 candidate hash/revision 与审批完全一致、锁定 site、最多写一行 current state，并一次性消费审批。
- 相同 hash 的 no-op 也必须明确消费或拒绝审批，不能留下可无限重放的 approved 记录。

### 3. VerifiedBackupReceipt 与回滚

- receipt 不能只做字段格式校验；生成/验证流程必须实际确认 target、database identity、外部路径、文件大小、SHA-256、archive-list、隔离恢复和每个 tenant 的关键 readback hash。
- receipt 文件必须位于数据库和 runtime 之外，并有 runtime 不可查询的路径/权限策略；发布 API 不得信任客户端随意提交的未验证 JSON。
- 发布前必须核对 receipt 的关键 readback 与变更前 current-state hash（首次建立 current state 时记录“缺失前状态”证明）。
- 新增 `restoreVerifiedBackup` 流程设计：只接受已验证外部 receipt，先恢复隔离 target，完成 schema/current-state/readback，再按批准流程恢复运行数据库。
- 禁止通过 `publicationId`、version、active pointer 或历史 JSON 执行回滚。

### 4. 全平台旧代码分类

所有命中 `ThemePublication`、`ActiveThemePublication`、`activePublication`、`latestPublication`、`publicationId`、`publishedJson` 的文件必须逐项分类：

| 分类 | 允许行为 |
|---|---|
| `REPLACE` | runtime、SSR、SEO、sitemap、robots、JSON-LD、公开 guard 改读 current state |
| `DRAFT_ONLY` | sync/import/repair 只写 draft/source，不写公开 current state |
| `TEST_REWRITE` | smoke/fixture 改为 hash、唯一行、备份恢复和 fail-closed 测试 |
| `KEEP_NONRUNTIME` | 迁移审计、只读差异、历史归档索引；不得被 runtime 导入 |
| `DELETE` | activate、restore、rollback、history/latest 查询和对应 UI/API |

任何未分类命中都保持 `PUBLISH_BLOCKED`。当前已知仍需处理的类别包括：历史一致性 guard、publication lifecycle smoke、repair/sync 脚本、admin publication timeline、snapshot count 和 latest 查询。

## Tenant 盘点登记表（只读，待人工确认）

| target | siteId | 当前观察 | 候选 hash/revision | backup receipt | 人工确认/readback |
|---|---|---|---|---|---|
| local | `site_dreamshoot` | 167 historical publications，1 active pointer | 待 draft-only 编译 | 未验证 | 未确认 |
| local | `site_grownstride_test` | historical publications，无/待确认 active | 待编译 | 未验证 | 未确认 |
| local | `site_aidreamcapes` | 无 active pointer | 待编译 | 未验证 | 未确认 |
| local | `site_aidreamcapes_xby` | 无 active pointer | 待编译 | 未验证 | 未确认 |
| local | `site_mydreamshoots_xby` | 无 active pointer | 待编译 | 未验证 | 未确认 |
| local | `site_lumen` | 无 active pointer | 待编译 | 未验证 | 未确认 |
| local | `site_atlas` | draft/test fixture，归属待确认 | 不得猜测 | 未验证 | 未确认 |
| remote-readonly | 8 tenants（含 designer smoke） | remote 内容与 local 不一致；active 2 行 | 不得以 local 作为迁移源 | 未验证 | 未确认 |

缺失 active pointer 不代表可以直接发布；必须完成人工唯一当前内容确认。designer/test fixture 必须明确保留或废弃归属，未确认前禁止删除。

## 两阶段 migration 门禁

### 阶段一：current-state 建立

1. 为每个 target 生成外部 VerifiedPreChangeBackup，并完成隔离恢复与 tenant readback。
2. 完成上表每个 tenant 的 draft/source、候选 hash/revision、人工确认和来源记录。
3. 只应用新增 `SitePublishedState`/审批字段 migration；不得删除旧表、旧字段或历史数据。
4. Prisma generate 后验证每个 siteId 至多一行、payload hash、SSR、origin、public、sitemap、robots 一致。

### 阶段二：旧模型清理

只有阶段一所有 tenant 通过、runtime 不再导入旧模型、单 serving commit 已证明、外部备份可恢复后，才允许单独提出并审查 destructive cleanup migration。清理前必须再次保留 Git 历史、外部备份和 readback receipt。

## 部署与 serving commit 门禁

- 每个域名必须登记 Nginx upstream、systemd/PM2 service、端口、release 路径和 build/commit hash。
- 只能有一个实际承接流量的 serving commit；旧进程可以存在但必须证明不接收流量。
- app/current symlink、Nginx upstream、systemd 主进程和公网 HTML/build metadata 不一致时，保持 `DEPLOYMENT_UNVERIFIED`。

## 后续门禁

1. 为每个 target 生成位于 runtime/数据库之外的备份，并完成 archive-list、隔离恢复和关键 readback，形成可验证 receipt。
2. 重新盘点所有 tenant，完成唯一当前内容确认单，明确 draft/test/公开归属及人工确认人。
3. 在隔离恢复和全 tenant 确认完成前，不应用 migration，不写生产，不删除历史，不部署。
4. 应用 migration 后执行 Prisma generate、唯一行/内容 hash/readback、SSR、origin、public、sitemap、robots 逐层验证。
5. 只有在 runtime 单 serving commit 已证明且所有 tenant readback 一致后，才安排独立的历史表清理 migration。
## 验收标准

- 每个 `siteId` 最多一行 `SitePublishedState`；内容变化覆盖同一行，相同 hash 为明确 no-op。
- candidate hash/revision 与审批不一致、审批过期/重复消费、receipt 缺失/伪造/未隔离恢复/readback 不匹配时，写入被阻断。
- runtime、SSR、SEO、JSON-LD、sitemap、robots、guard 不再查询 active/history/latest，也不把 `publishedJson` 当公开 owner。
- 回滚只接受 VerifiedBackupReceipt 恢复，不接受 publication/version/history JSON。
- local DB → origin → public → sitemap/robots 的 current revision/content hash 逐层一致。
- 线上只有一个实际 serving commit，旧进程不承接流量。

## 当前结论

在上述调整完成前，固定保持：

```text
LOCAL_CODE: REVIEW_REQUIRED
DATABASE: MIGRATION_REQUIRED
PUBLICATION: PUBLISH_BLOCKED
DEPLOYMENT: UNVERIFIED
```
