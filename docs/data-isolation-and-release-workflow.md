# Data Isolation And Release Workflow

This project keeps local, test, and production data separate. The default local development server uses the production database through an SSH read-write tunnel; local database development is explicit.

## Environment Targets

- `npm run dev`, `npm run dev:3002`, and `npm run dev:remote-readonly` use `DINGYUE_ENV=remote-readonly`, `DATABASE_TARGET=remote-readonly`, and the production database through `127.0.0.1:15432`. These default development paths are read-only.
- `npm run dev:remote` is an explicit remote read-write mode and must only be used for approved operational work.
- `npm run dev:local` uses `DINGYUE_ENV=local`, `DATABASE_TARGET=local`, and `127.0.0.1:15433/dingyue_local`.
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

## Release Manifest Flow

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
