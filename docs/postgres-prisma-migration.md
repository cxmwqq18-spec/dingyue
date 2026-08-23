# Postgres + Prisma Migration

The website runtime uses PostgreSQL through Prisma. The legacy JSON state file is not a runtime source.

## Modes

- `PERSISTENCE_BACKEND=postgres`: required runtime mode. Public pages, admin, accounts, jobs, billing, theme editing and publishing read relational PostgreSQL tables.
- `STOREFRONT_PATH_MODE_READS=database`: required storefront read mode. Local preview and JSON modes are disabled.

`PlatformStateDocument` is retained only as a compatibility snapshot for explicit migration tooling. It is not a website content source; relational tables and published theme snapshots are authoritative.

## Local / Server Env

Keep real credentials in `.env.local` locally and in the server process environment online. Do not commit real secrets.

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public'
PERSISTENCE_BACKEND=postgres
```

## Server Postgres Setup Template

Run on the application server or database host after confirming the OS, sudo access, and firewall policy.

```bash
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib

sudo -u postgres psql <<'SQL'
create role dingyue with login password '<strong-password>';
create database dingyue owner dingyue;
grant all privileges on database dingyue to dingyue;
SQL
```

If local development must connect to the online database, configure `postgresql.conf`, `pg_hba.conf`, firewall, and SSL according to your hosting policy. Prefer a VPN or SSH tunnel over opening Postgres publicly.

## Initialize Schema

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run prisma:generate
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run prisma:push
```

## Historical JSON Import

These commands are one-time migration tooling only. They must never be part of a build, deploy, sync, or runtime command. The current database is the migration baseline and is not overwritten automatically.

Dry run:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-state -- --source archive/legacy/platform-state.json --dry-run
```

Apply:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-state -- --source archive/legacy/platform-state.json
```

Smoke:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run smoke:postgres-state
```

## Import Legacy State Into Relational Tables

After the normalized Prisma schema has been pushed and `@prisma/client` has been regenerated, import the legacy `PlatformState` arrays into relational tables.

Dry run from a JSON file:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-relational-state -- --source archive/legacy/platform-state.json --dry-run
```

Apply from a JSON file and verify counts:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-relational-state -- --source archive/legacy/platform-state.json --verify
```

Apply from the default `PlatformStateDocument(id=platform)` bridge row:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-relational-state -- --verify
```

Run verification only:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:verify-relational-state -- --source archive/legacy/platform-state.json
```

The relational importer flattens `products[].prices`, creates `CreditBalance` rows from `customers[].balance`, imports nested `site.pages` and `site.themeSettings`, converts `site.connect` to `StripeConnectAccount`, and maps `siteAiApps[].aiApp.id` to `aiAppId`. It uses id-based upserts in small transactions so repeated imports update rows instead of failing on duplicates. Duplicate or missing legacy IDs are reported in the JSON summary and skipped.

`--replace` deletes all imported relational rows before rebuilding them, including customer accounts, sessions, credits, generation jobs, and asset metadata. Run `--dry-run` first and create a verified database backup. A destructive replacement is rejected unless both `--replace` and `--allow-data-loss` are passed explicitly:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-relational-state -- --source archive/legacy/platform-state.json --replace --allow-data-loss --verify
```

If a normalized model has not been merged into `prisma/schema.prisma` yet, that section reports `missing_prisma_model`; regenerate Prisma Client after the schema worker lands the remaining models and rerun the same command.

## Run App Against Postgres

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' \
PERSISTENCE_BACKEND=postgres \
npm run dev -- -p 3002
```

Then run the existing smoke suite against the server.

```bash
SMOKE_BASE_URL=http://localhost:3002 npm run smoke:security-baseline
SMOKE_BASE_URL=http://localhost:3002 SMOKE_PROVIDER_MOCK=1 npm run smoke:ai-providers
SMOKE_BASE_URL=http://localhost:3002 npm run smoke:core
```

## Important Limits

- The current bridge stores the full platform state as one JSONB document in Postgres.
- This is a production-hardening step over local JSON files, but it is not the final relational Prisma model.
- Normalized tables and Prisma transactions should be introduced next for billing, workers, customers, assets, and theme publishing.
