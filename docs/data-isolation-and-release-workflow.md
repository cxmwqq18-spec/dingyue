# Data Isolation And Release Workflow

This project keeps local, test, and production data separate. The default local development server uses the isolated local PostgreSQL database; remote database development is explicit.

## Environment Targets

- `npm run dev`, `npm run dev:local`, and `npm run dev:3002` use `DINGYUE_ENV=local`, `DATABASE_TARGET=local`, and `127.0.0.1:15433/dingyue_local`. The launcher starts the local PostgreSQL compose service, waits for its health check, applies pending Prisma migrations, and then starts Next.js.
- `npm run dev:remote-readonly` uses `DINGYUE_ENV=remote-readonly`, `DATABASE_TARGET=remote-readonly`, and the production database through `127.0.0.1:15432`. This remote read-only path is explicit.
- `npm run dev:remote` is an explicit remote read-write mode and must only be used for approved operational work.
- Test releases must use `DINGYUE_ENV=test` and `DATABASE_TARGET=test` with a test-only database account.
- Production releases must use `DINGYUE_ENV=production` and `DATABASE_TARGET=production` with the systemd production environment.
- Remote production inspection remains explicit and read-only. Start the tunnel with `npm run db:tunnel -- --readonly` only after setting `REMOTE_DB_READONLY_DATABASE_URL`.
- Remote read-write development is explicit at the tunnel layer: `npm run db:tunnel -- --readwrite` uses `REMOTE_DB_DATABASE_URL`.
- Remote-readonly development mode remains available with `npm run dev:remote-readonly`. It sets `DINGYUE_ENV=remote-readonly`, `DATABASE_TARGET=remote-readonly`, and keeps all Prisma writes blocked.

## Local Database

Start the isolated local Postgres with:

```sh
docker compose -f ops/local-postgres.compose.yml up -d
npm run db:target -- --target=local
npm run prisma:push
```

The guard fails if `DATABASE_URL` points at port `15432`, a production database name, or anything other than `127.0.0.1:15433/dingyue_local` for local work.

## Public Content Scope

Release manifests may include only public storefront content:

- Header, footer, navigation, and menu configuration.
- `toolCategories` and `toolMenuItems`.
- `videoThemeCategories` and `videoThemes`.
- `creativePackCategories` and public `creativePacks`.
- Published theme pages/settings/snapshots.
- Public media asset indexes and metadata.

Do not publish customer, order, payment, credit, generation job, customer model, album, upload, private asset, session, secret, or audit data from local.

## SQL Public Content Promotion

> This legacy section is retained for migration history only. The old full-table
> manifest flow is disabled. Use `docs/no-snapshot-incremental-release.md` and
> the `content:baseline`, `content:plan`, and `content:apply` commands.

`data/platform-state.json` is retired and must not be used as a runtime or deployment source. Public storefront promotion reads PostgreSQL rows only and publishes a new immutable `ThemePublication` after the scoped update:

```sh
npm run sync:mydreamshoots-public-sql -- --target=test --dry-run
npm run sync:mydreamshoots-public-sql -- --target=test --apply --confirm=sync-mydreamshoots-public-sql
```

The default source is `site_dreamshoot`. The command never deletes or imports customers, orders, subscriptions, credits, generation jobs, uploads, albums, sessions, or payment rows. Test publication SEO is forced to `noindex`; production requires `--confirm-production` and remains opt-in.

## Release Manifest Flow

> 本节旧的整表 release manifest 已停用。当前命令和安全规则见
> [`no-snapshot-incremental-release.md`](no-snapshot-incremental-release.md)。

Export from local:

```sh
npm run release:content-export -- --target=local --site-id=site_dreamshoot --release-id=<release-id>
```

Review the plan:

```sh
npm run release:content-plan -- --target=local --manifest=releases/manifests/<release-id>.json
```

Run the local gate after committing code and manifest:

```sh
npm run release:precheck -- --target=local --manifest=releases/manifests/<release-id>.json --skip-live
```

Apply to test or production only from a verified release checkout:

```sh
npm run prisma:migrate:deploy -- --target=test
npm run release:content-apply -- --target=test --manifest=releases/manifests/<release-id>.json --apply --confirm=release-content-apply
```

Production requires an explicit confirmation flag for database target checks:

```sh
npm run prisma:migrate:deploy -- --target=production --confirm-production
npm run release:content-apply -- --target=production --confirm-production --manifest=releases/manifests/<release-id>.json --apply --confirm=release-content-apply
```

## Failure Rules

- If precheck, migration, content plan, content apply, smoke, or route validation fails, do not switch the production release symlink and do not restart production services.
- Content apply writes a scoped backup under `releases/backups/` before the transaction.
- Protected business tables are fingerprinted before and after content apply. Any count/hash change aborts the transaction.
- Full JSON/platform-state imports are local/test initialization tools only; production must use scoped content manifests.
- Development and release tooling must not select, restore, import, or fall back to a historical publication/snapshot without explicit approval for the current task. Reusing an approved historical field requires compiling a new publication from the latest current data; it must never reactivate the old snapshot in place.
