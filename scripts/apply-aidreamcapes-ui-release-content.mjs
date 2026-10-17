#!/usr/bin/env node
// A site-scoped, current-field UI release. No historical publication is read or activated.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertAllowedSite, assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const args = process.argv.slice(2);
const value = key => args.find(arg => arg.startsWith(`${key}=`))?.slice(key.length + 1);
const applying = args.includes('--apply');
assertDatabaseTarget({ expectedTarget: 'production', requireProductionConfirmation: true, productionConfirmed: args.includes('--confirm-production') });
const siteId = assertAllowedSite('site_aidreamcapes');
const manifest = JSON.parse(await fs.readFile(value('--manifest'), 'utf8'));
assert.equal(manifest.siteId, siteId);
assert.equal(manifest.target, 'production');
assert(/^[a-f0-9]{40}$/.test(manifest.codeCommit));
assert(manifest.operations.length > 0 && manifest.operations.length < 500);
if (applying) {
  assert.equal(value('--deployed-commit'), manifest.codeCommit);
  assert.equal((await fs.readFile('.deployed-commit', 'utf8')).trim(), manifest.codeCommit);
}
const stable = v => v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const hash = v => crypto.createHash('sha256').update(v === undefined ? '<undefined>' : JSON.stringify(stable(v))).digest('hex');
const keys = pointer => pointer.slice(1).split('/').map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
const get = (object, path) => keys(path).reduce((v, k) => v?.[k], object);
const put = (object, path, value) => {
  const parts = keys(path); let parent = object;
  for (const key of parts.slice(0, -1)) parent = parent[key] ??= {};
  parent[parts.at(-1)] = structuredClone(value);
};
const homePrefix = '/sections/v2_main/settings/data/';
for (const op of manifest.operations) {
  assert.equal(op.entityType, 'live_page'); assert.equal(op.field, 'contentJson');
  assert(keys(op.path).every(k => !['__proto__', 'prototype', 'constructor'].includes(k)));
  assert(Object.hasOwn(op, 'value'), 'No deletion in a UI update');
  if (op.id === 'site_aidreamcapes_home') {
    assert(op.path.startsWith(homePrefix) || /^\/seo\/(title|keywords|description|jsonLd\/@graph\/\d+\/(name|description))$/.test(op.path));
  } else {
    assert(op.path === `${homePrefix}breadcrumbs` || /^\/seo\/jsonLd\/@graph\/\d+\/itemListElement$/.test(op.path), 'Detail pages permit breadcrumb edits only');
  }
}
const db = new PrismaClient();
async function protectedFingerprint(tx) {
  const publicPages = await tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
  const prices = await tx.price.findMany({ where: { siteId }, orderBy: { id: 'asc' } });
  const result = { otherSites: hash(publicPages), prices: hash(prices) };
  for (const model of ['customer', 'customerSession', 'subscription', 'order', 'paymentEvent', 'creditBalance', 'creditLedger', 'generationJob', 'customerModel', 'assetUpload', 'album']) {
    const rows = await tx[model].findMany({ where: { siteId }, orderBy: { id: 'asc' } });
    result[model] = { count: rows.length, hash: hash(rows) };
  }
  return result;
}
try {
  const report = await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('site_aidreamcapes-ui-release'))`;
    const before = await protectedFingerprint(tx);
    const groups = new Map(), conflicts = [], skipped = [];
    for (const op of manifest.operations) {
      if (!groups.has(op.id)) {
        const row = await tx.livePage.findFirstOrThrow({ where: { id: op.id, siteId } });
        assert(row.contentJson?.sections?.v2_main?.settings?.data, 'Current V2 relational page required');
        groups.set(op.id, { row, next: structuredClone(row.contentJson), pending: [] });
      }
      const group = groups.get(op.id), actual = get(group.row.contentJson, op.path);
      if (hash(actual) === hash(op.value)) skipped.push({ id: op.id, path: op.path });
      else if (hash(actual) !== op.baseHash) conflicts.push({ id: op.id, path: op.path });
      else { put(group.next, op.path, op.value); group.pending.push({ id: op.id, path: op.path }); }
    }
    assert.equal(conflicts.length, 0, `Online edits preserved; re-plan conflicts: ${JSON.stringify(conflicts)}`);
    if (applying) for (const group of groups.values()) {
      if (!group.pending.length) continue;
      const result = await tx.livePage.updateMany({ where: { id: group.row.id, siteId, updatedAt: group.row.updatedAt }, data: { contentJson: group.next } });
      assert.equal(result.count, 1, 'Concurrent page edit; no overwrite');
      const readback = await tx.livePage.findFirstOrThrow({ where: { id: group.row.id, siteId } });
      assert.equal(hash(readback.contentJson), hash(group.next));
    }
    const after = await protectedFingerprint(tx);
    assert.deepEqual(after, before, 'Other stores, prices and private business rows must not change');
    const [derived] = await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
    const storedCache = derived.relation ? await tx.sitePublishedState.findUnique({ where: { siteId }, select: { revision: true, contentHash: true, publishedAt: true } }) : null;
    return { ok: true, siteId, target: 'production', codeCommit: manifest.codeCommit, owner: 'LivePage.contentJson', mode: applying ? 'apply' : 'plan', applied: applying ? [...groups.values()].flatMap(g => g.pending) : [], planned: [...groups.values()].flatMap(g => g.pending), conflicts, skipped, protectedBefore: before, protectedAfter: after, revisions: [...groups.values()].map(g => ({ id: g.row.id, slug: g.row.slug, before: hash(g.row.contentJson), after: hash(g.next) })), derivedState: { ...derived, storedCache, runtime: 'Current relational LivePage on each server request; stored cache is not an activation source' }, historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 120000 });
  if (value('--report')) await fs.writeFile(value('--report'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally { await db.$disconnect(); }
