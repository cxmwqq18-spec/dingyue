#!/usr/bin/env node
// Applies only an explicit, current relational field manifest for this homepage release.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const args = process.argv.slice(2);
const value = key => args.find(arg => arg.startsWith(key + '='))?.slice(key.length + 1);
const applying = args.includes('--apply');
assertDatabaseTarget({ expectedTarget: 'production', requireProductionConfirmation: true, productionConfirmed: args.includes('--confirm-production') });
const manifest = JSON.parse(await fs.readFile(value('--manifest'), 'utf8'));
assert.equal(manifest.siteId, 'site_aidreamcapes');
assert.equal(manifest.target, 'production');
assert(/^[a-f0-9]{40}$/.test(manifest.codeCommit));
assert(manifest.operations.length > 0 && manifest.operations.length < 500);
if (applying) {
  assert.equal(value('--deployed-commit'), manifest.codeCommit);
  assert.equal((await fs.readFile('.deployed-commit', 'utf8')).trim(), manifest.codeCommit);
}
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const hash = v => crypto.createHash('sha256').update(v === undefined ? '<undefined>' : JSON.stringify(stable(v))).digest('hex');
const parts = path => path.split('/').slice(1).map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
const get = (object, path) => parts(path).reduce((v, k) => v?.[k], object);
function put(object, path, value) {
  const keys = parts(path); let cursor = object;
  for (const key of keys.slice(0, -1)) cursor = cursor[key] ??= {};
  cursor[keys.at(-1)] = structuredClone(value);
}
const models = { live_page: 'livePage', theme_settings: 'themeSettings', product: 'product' };
for (const op of manifest.operations) {
  assert(Object.hasOwn(models, op.entityType));
  assert(parts(op.path).every(k => !['__proto__', 'prototype', 'constructor'].includes(k)));
  assert(Object.hasOwn(op, 'value'), 'Deletion is outside this release');
  if (op.entityType === 'live_page') {
    assert.equal(op.id, 'site_aidreamcapes_home'); assert.equal(op.field, 'contentJson');
    assert(/^\/(sections\/v2_main\/settings\/data\/|seo\/|mediaManifest\/|contentContract\/sourceRevision$)/.test(op.path));
  } else if (op.entityType === 'theme_settings') {
    assert.equal(op.field, 'draftJson'); assert.equal(op.path, '/aidreamcapesV2Navigation/footer/socialLinks');
  } else {
    assert(['prod_aidreamcapes_starter', 'prod_aidreamcapes_pro', 'prod_aidreamcapes_premium'].includes(op.id));
    assert.equal(op.field, 'metadata'); assert(/^\/(summary|features|badgeLabel|outputEstimate)(\/|$)/.test(op.path));
  }
}
const db = new PrismaClient();
async function protectedHash(tx) {
  const [pages, settings, profile, prices] = await Promise.all([
    tx.livePage.findMany({ where: { siteId: 'site_dreamshoot' }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } }),
    tx.themeSettings.findUnique({ where: { siteId: 'site_dreamshoot' }, select: { draftJson: true, publishedJson: true } }),
    tx.storefrontProfile.findUnique({ where: { siteId: 'site_dreamshoot' }, select: { publishedJson: true } }),
    tx.price.findMany({ where: { siteId: 'site_aidreamcapes' }, orderBy: { id: 'asc' } })
  ]);
  return hash({ pages, settings, profile, prices });
}
try {
  const report = await db.$transaction(async tx => {
    const before = await protectedHash(tx);
    const groups = new Map(); const skipped = []; const conflicts = [];
    for (const op of manifest.operations) {
      const key = op.entityType + ':' + op.id;
      if (!groups.has(key)) {
        const row = await tx[models[op.entityType]].findFirst({ where: { id: op.id, siteId: 'site_aidreamcapes' } });
        assert(row, 'Current relational owner is required: ' + key);
        groups.set(key, { row, next: structuredClone(row[op.field]), field: op.field, model: models[op.entityType], pending: [] });
      }
      const group = groups.get(key); const current = get(group.row[op.field], op.path);
      if (hash(current) === hash(op.value)) skipped.push({ id: op.id, path: op.path });
      else if (hash(current) !== op.baseHash) conflicts.push({ id: op.id, path: op.path });
      else { put(group.next, op.path, op.value); group.pending.push({ id: op.id, path: op.path }); }
    }
    assert.equal(conflicts.length, 0, 'Online edits win. Re-plan conflicting fields: ' + JSON.stringify(conflicts));
    if (applying) for (const group of groups.values()) {
      if (!group.pending.length) continue;
      const result = await tx[group.model].updateMany({ where: { id: group.row.id, siteId: 'site_aidreamcapes', updatedAt: group.row.updatedAt }, data: { [group.field]: group.next } });
      assert.equal(result.count, 1, 'Concurrent edit detected');
      const readback = await tx[group.model].findFirst({ where: { id: group.row.id, siteId: 'site_aidreamcapes' } });
      assert.equal(hash(readback[group.field]), hash(group.next));
    }
    const after = await protectedHash(tx); assert.equal(after, before, 'Protected stores and price facts must remain unchanged');
    const derived = await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
    return { ok: true, mode: applying ? 'apply' : 'plan', target: 'production', siteId: 'site_aidreamcapes', codeCommit: manifest.codeCommit, owner: 'Current relational LivePage.contentJson, ThemeSettings footer and Product metadata', applied: applying ? [...groups.values()].flatMap(g => g.pending) : [], planned: [...groups.values()].flatMap(g => g.pending), skipped, conflicts, protectedHashBefore: before, protectedHashAfter: after, derivedState: { relation: derived[0]?.relation, restored: false }, revisions: [...groups.values()].map(g => ({ id: g.row.id, field: g.field, before: hash(g.row[g.field]), after: hash(g.next) })) };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  if (value('--report')) await fs.writeFile(value('--report'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await db.$disconnect(); }
