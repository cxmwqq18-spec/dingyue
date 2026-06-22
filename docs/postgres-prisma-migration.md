# Postgres + Prisma Migration

This project can run with the legacy JSON state file or a Postgres-backed platform state document.

## Modes

- `PERSISTENCE_BACKEND=json`: default local/demo mode, reads `data/platform-state.json`.
- `PERSISTENCE_BACKEND=postgres`: reads and writes the `PlatformStateDocument` row in Postgres through Prisma.

The Postgres document mode is a migration bridge. It moves runtime state off the local JSON file without forcing every existing API/page call site to become asynchronous in one large rewrite. After this bridge is stable, high-traffic domains can be moved to normalized Prisma tables module by module.

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

## Import Current JSON State

Dry run:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-state -- --source data/platform-state.json --dry-run
```

Apply:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run db:import-state -- --source data/platform-state.json
```

Smoke:

```bash
DATABASE_URL='postgresql://dingyue:<password>@<host>:5432/dingyue?schema=public' npm run smoke:postgres-state
```

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
