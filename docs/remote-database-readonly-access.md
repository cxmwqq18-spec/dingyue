# 线上生产数据库只读连接指南

本文档用于让已获授权的开发者在新电脑上，通过项目的 SSH 隧道连接线上
PostgreSQL 数据库。仅可用于查询、审计和远程只读开发。

不要将 PostgreSQL 直接暴露到公网。不要复制其他人的 `.env.local`、私钥、
密码或既有 SSH 配置。

## 连接方式

```text
本机 -> SSH 隧道（127.0.0.1:15432）-> 线上服务器 -> PostgreSQL
```

数据库始终绑定在线上服务器中。项目启动器会将只读连接串转换为本机
`15432` 端口的连接。

## 1. 申请个人访问权限

管理员需要为每位使用者单独开通以下资料。必须通过团队密码管理器或其他
获批准的密钥交付方式发送，不能提交到 Git、写入工单、聊天记录或共享文档。

- 可访问线上服务器的 SSH 账号或 SSH 公钥授权。建议使用仅允许端口转发的
  专用 `db-tunnel` 账号，不要给新使用者发放服务器 `root` 账号。
- 该人员或团队专用的 PostgreSQL **只读**账号。
- 该账号对应的 `REMOTE_DB_READONLY_DATABASE_URL`。
- SSH 主机、端口和用户名。
- 对应的 SSH 私钥；私钥只保存在本机，且仅所有者可读。

PostgreSQL 必须从数据库权限层面保证只读。项目中的 `remote-readonly`
校验只是第二道保护，不能代替数据库授权。

以下 SQL 由生产数据库管理员执行，并根据实际 schema、表所有者和访问范围
调整：

```sql
CREATE ROLE dingyue_ro_alice LOGIN PASSWORD '<由密钥管理系统生成的密码>';
GRANT CONNECT ON DATABASE dingyue TO dingyue_ro_alice;
GRANT USAGE ON SCHEMA public TO dingyue_ro_alice;
REVOKE CREATE ON SCHEMA public FROM dingyue_ro_alice;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO dingyue_ro_alice;
ALTER DEFAULT PRIVILEGES FOR ROLE <建表角色> IN SCHEMA public
  GRANT SELECT ON TABLES TO dingyue_ro_alice;
ALTER ROLE dingyue_ro_alice SET default_transaction_read_only = on;
```

仅需查看公开站点数据的人员，应进一步限制到必要的表和字段。除非职责确有
需要，不要授予客户、支付、会话、私有素材、密钥或审计表的访问权限。

## 2. 在新电脑准备项目

1. 安装 Node.js、npm、Git 和 OpenSSH。
2. 克隆项目并安装依赖：

   ```sh
   git clone <仓库地址> dingyue
   cd dingyue
   npm ci
   ```

3. 从模板创建本机环境文件。该文件已被 Git 忽略：

   ```sh
   cp .env.example .env.local
   chmod 600 .env.local
   chmod 600 /绝对路径/你的私钥文件
   ```

4. 仅填写管理员发给自己的资料。真实密钥不能写入 `.env.example` 或任何已
   跟踪的文件。

   ```dotenv
   # 分配给当前使用者的只读数据库账号。
   REMOTE_DB_READONLY_DATABASE_URL=postgresql://<只读用户名>:<URL编码后的密码>@<数据库主机>:5432/dingyue?schema=public&connection_limit=3

   # 分配给当前使用者的 SSH 账号。REMOTE_DB_* 的优先级高于为兼容旧配置
   # 保留的 AI_PROJECT_SSH_* 变量。
   REMOTE_DB_SSH_HOST=<线上SSH主机>
   REMOTE_DB_SSH_PORT=<线上SSH端口>
   REMOTE_DB_SSH_USER=<db-tunnel用户名>
   REMOTE_DB_SSH_KEY_PATH=/绝对路径/你的私钥文件

   # 仅当 PostgreSQL 不在 SSH 服务器的本机回环地址时才需要配置。
   # REMOTE_DB_HOST=127.0.0.1
   # REMOTE_DB_PORT=5432
   ```

`.env.local` 中的 `DATABASE_URL` 应保留为本地开发数据库。远程只读启动器会在
自身子进程中临时生成隧道连接串，不要永久替换默认的本地配置。

## 3. 启动并验证只读隧道

在项目根目录执行：

```sh
npm run db:tunnel -- --readonly
```

成功时会显示本地端点，类似：

```text
127.0.0.1:15432
```

该命令可以重复执行：若已存在健康的 PostgreSQL 隧道，会直接复用。端口只绑定
在 `127.0.0.1`，不会向局域网或公网开放。

长时间工作时，可启动隧道守护检查：

```sh
npm run db:tunnel:watch
```

使用 `Ctrl+C` 停止守护检查。若要关闭后台 SSH 隧道，请先确认绑定本机 `15432`
端口的 SSH 进程，再结束该进程；不要误停其他占用该端口的程序。

## 4. 使用远程只读模式

需要查看线上运行数据、或让 Codex 使用线上只读数据模型时，执行：

```sh
npm run dev:remote-readonly
```

该命令会启动或复用 SSH 隧道，并仅在启动的子进程中设置：

```text
DINGYUE_ENV=remote-readonly
DATABASE_TARGET=remote-readonly
DATABASE_URL=postgresql://<只读用户名>:***@127.0.0.1:15432/dingyue?schema=public
```

此模式下，项目的 Prisma 包装器会拦截写操作。禁止在该目标上执行写入、发布、
迁移、导入或同步命令。

需要登录、客户会话、上传或其他必须写入线上数据库的开发验证，请使用
`npm run dev:remote`。当前 `npm run dev` 和 `npm run dev:3002` 默认就是该远程
读写模式；不需要线上写入时请改用 `npm run dev:remote-readonly`。

## 5. 验证连接目标

建立隧道后，在读取业务数据前使用下面的显式临时环境验证目标。该命令不会修改
数据库：

```sh
DATABASE_URL="$(node --input-type=module -e '
  import "./scripts/load-runtime-env.mjs";
  import { buildTunneledReadonlyDatabaseUrl } from "./scripts/lib/database-target.mjs";
  process.stdout.write(buildTunneledReadonlyDatabaseUrl(process.env.REMOTE_DB_READONLY_DATABASE_URL));
')" \
DINGYUE_ENV=remote-readonly \
DATABASE_TARGET=remote-readonly \
npm run db:target -- --target=remote-readonly
```

预期输出为 JSON，包含 `"ok": true`、`"target": "remote-readonly"`，并显示
主机为 `127.0.0.1`、端口为 `15432`。

## 常见问题

| 现象 | 检查方式 |
| --- | --- |
| 提示 `REMOTE_DB_READONLY_DATABASE_URL is required` | 确认变量写在未跟踪的 `.env.local` 中、没有被注释，并且填写的是管理员为你签发的值。 |
| SSH 认证失败 | 确认 SSH 用户名、端口、私钥路径和私钥文件权限；请管理员确认你的公钥已被授权。 |
| 隧道建立后 PostgreSQL 未响应 | 与服务器管理员确认 `REMOTE_DB_HOST`、`REMOTE_DB_PORT`；生产数据库可能不在 `127.0.0.1:5432`。 |
| 目标校验被拒绝 | 不要修改本地默认 `DATABASE_URL`；使用 `npm run dev:remote-readonly` 或上面的显式校验命令。 |
| 查询尝试写入 | 立即停止。即使客户端绕过项目代码，数据库只读角色也必须拒绝写操作。 |

## 管理员检查清单

- 为每个人单独创建 SSH 和数据库凭据，人员离开或不再需要时立即撤销。
- PostgreSQL 保持私网访问，只能经 SSH、VPN 或受管堡垒机进入。
- 在数据库层落实只读授权，定期轮换密钥。
- 记录访问授权对象，并定期检查 SSH 与数据库审计日志。
- 不要将可用的 `.env.local` 或私钥作为入职材料发放。

## 相关项目文件

- `scripts/start-remote-db-tunnel.mjs`：创建本机 SSH 隧道。
- `scripts/dev-remote-readonly.mjs`：以远程只读目标启动 Next.js。
- `scripts/lib/database-target.mjs`：校验远程连接必须使用
  `127.0.0.1:15432`。
- `docs/data-isolation-and-release-workflow.md`：项目的数据隔离规则。
