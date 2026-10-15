import '../load-runtime-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { assertDatabaseTarget, parseDatabaseUrl } from '../lib/database-target.mjs';

// Explicit, local-only installation. Never run a pending shared migration wave.
assertDatabaseTarget({ expectedTarget: 'local' });
const names = ['20261014170000_add_aidreamcapes_clone_consent_jobs', '20261015130000_aidreamcapes_clone_taskless_analysis'];
const db = new PrismaClient();
const apply = process.argv.includes('--apply');
try {
  const tables = await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('Site','Customer','AssetUpload','AidreamcapesVideoTask','AidreamcapesWorkspaceActor','_prisma_migrations','AidreamcapesCloneConsent','AidreamcapesCloneJob')`;
  const found = new Set(tables.map(row => row.table_name));
  for (const dependency of ['Site','Customer','AssetUpload','AidreamcapesVideoTask','AidreamcapesWorkspaceActor','_prisma_migrations']) {
    if (!found.has(dependency)) throw new Error(`Missing prerequisite ${dependency}; no changes applied.`);
  }
  const completed = await db.$queryRaw`SELECT migration_name FROM "_prisma_migrations" WHERE migration_name IN ('20261014170000_add_aidreamcapes_clone_consent_jobs','20261015130000_aidreamcapes_clone_taskless_analysis') AND finished_at IS NOT NULL AND rolled_back_at IS NULL`;
  const recorded = new Set(completed.map(row => row.migration_name));
  const hasConsent = found.has('AidreamcapesCloneConsent'), hasJob = found.has('AidreamcapesCloneJob');
  if (hasConsent !== hasJob) throw new Error('Partial clone schema detected; inspect current state before repair.');
  if (recorded.has(names[0]) && !hasConsent) throw new Error('Migration history conflicts with current tables; no restore or fallback permitted.');
  const pending = names.filter(name => !recorded.has(name));
  console.log(JSON.stringify({ target: 'local', ...parseDatabaseUrl(), apply, cloneTablesPresent: hasConsent, pending }));
  if (!apply || !pending.length) process.exitCode = 0;
  else {
    // Table existence without history can mean a previously interrupted resolve.
    // Verify the expected current guards before marking that migration applied.
    if (hasConsent && !recorded.has(names[0])) {
      const guards = await db.$queryRaw`SELECT tgname FROM pg_trigger WHERE tgrelid IN ('"AidreamcapesCloneConsent"'::regclass,'"AidreamcapesCloneJob"'::regclass) AND NOT tgisinternal`;
      if (!['aidreamcapes_clone_consent_guard','aidreamcapes_clone_job_guard'].every(name => guards.some(row => row.tgname === name))) throw new Error('Existing clone schema guards differ; manual inspection required.');
    }
    const sql = pending.filter(name => name !== names[0] || !hasConsent)
      .map(name => fs.readFileSync(path.join('prisma/migrations', name, 'migration.sql'), 'utf8')).join('\n');
    if (sql) {
      const url = new URL(process.env.DATABASE_URL);
      const result = spawnSync('psql', ['-X', '--quiet', '--single-transaction', '-v', 'ON_ERROR_STOP=1'], {
        input: `SET search_path TO public;\n${sql}`,
        encoding: 'utf8',
        env: { ...process.env, PGHOST: url.hostname, PGPORT: url.port || '5432', PGDATABASE: decodeURIComponent(url.pathname.slice(1)), PGUSER: decodeURIComponent(url.username), PGPASSWORD: decodeURIComponent(url.password) },
      });
      if (result.status !== 0) throw new Error(`Scoped clone installation failed: ${result.stderr || result.error?.message || 'psql error'}`);
    }
    for (const name of pending) {
      const resolved = spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'resolve', '--applied', name], { env: process.env, encoding: 'utf8' });
      if (resolved.status !== 0) throw new Error(`Clone tables installed but migration history needs reconciliation for ${name}: ${resolved.stderr}`);
    }
    const ready = await db.$queryRaw`SELECT to_regclass('"AidreamcapesCloneConsent"')::text AS consent_table, to_regclass('"AidreamcapesCloneJob"')::text AS job_table`;
    console.log(JSON.stringify({ installed: pending, ready }));
  }
} finally { await db.$disconnect(); }
