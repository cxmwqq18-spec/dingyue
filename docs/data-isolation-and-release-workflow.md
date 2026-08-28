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
npm run prisma:migrate:deploy -- --target=local
```

The guard fails if `DATABASE_URL` points at port `15432`, a production database name, or anything other than `127.0.0.1:15433/dingyue_local` for local work.

## Public Content Scope

Release manifests may include only public storefront content:

- Header, footer, navigation, and menu configuration.
- `toolCategories` and `toolMenuItems`.
- `videoThemeCategories` and `videoThemes`.
- `creativePackCategories` and public `creativePacks`.
- Theme page/settings/profile public fields (synced as field-level increments).
- Public media asset indexes and metadata.

Do not publish customer, order, payment, credit, generation job, customer model, album, upload, private asset, session, secret, or audit data from local.

## SQL Public Content Promotion

This project no longer supports SQL snapshot promotion, `platform-state.json`,
full-table manifests, or historical publication activation. Use only the
field-level workflow in [`no-snapshot-incremental-release.md`](no-snapshot-incremental-release.md).

## Release Manifest Flow

The old `release:content-*` commands remain only as blocked compatibility
entrypoints so an accidental invocation fails closed.

## Failure Rules

- If precheck, migration, content plan, content apply, smoke, or route validation fails, do not switch the production release symlink and do not restart production services.
- Content apply writes no database snapshot and does not replace or delete whole tables.
- Protected business tables are fingerprinted before and after content apply. Any count/hash change aborts the transaction.
- Full JSON/platform-state imports are local/test initialization tools only; production must use scoped content manifests.
- Development and release tooling must not select, restore, import, or fall back to a historical publication/snapshot. Content rollback is an explicit inverse field manifest.
