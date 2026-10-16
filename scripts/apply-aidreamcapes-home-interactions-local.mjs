#!/usr/bin/env node
/** Exact-site current relational content patch; no historical publications or customer data. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget, hasArgument } from './lib/database-target.mjs';
import { improveAidreamcapesHome } from './lib/aidreamcapes-home-interactions.mjs';

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
const siteId = 'site_aidreamcapes', pageId = 'site_aidreamcapes_home';
const apply = hasArgument('--apply-local');
const out = 'releases/aidreamcapes-home-interactions';
const db = new PrismaClient();
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(stable(value ?? null))).digest('hex');
const escape = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
function diff(before, after, path = '') {
  if (hash(before) === hash(after)) return [];
  if (before && after && typeof before === 'object' && typeof after === 'object' && Array.isArray(before) === Array.isArray(after)) {
    return [...new Set([...Object.keys(before), ...Object.keys(after)])].flatMap(key => diff(before[key], after[key], `${path}/${escape(key)}`));
  }
  return [{ path, baseHash: hash(before), before: before ?? null, after: after ?? null }];
}
async function myDreamShootsHash() {
  const [pages, settings, profile] = await Promise.all([
    db.livePage.findMany({ where: { siteId: 'site_dreamshoot' }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } }),
    db.themeSettings.findUnique({ where: { siteId: 'site_dreamshoot' }, select: { draftJson: true, publishedJson: true } }),
    db.storefrontProfile.findUnique({ where: { siteId: 'site_dreamshoot' }, select: { publishedJson: true } })
  ]);
  return hash({ pages, settings, profile });
}
try {
  const protectedBefore = await myDreamShootsHash();
  const current = await db.livePage.findFirst({ where: { id: pageId, siteId, slug: '/' } });
  assert(current, 'Current local homepage must exist');
  const next = structuredClone(current.contentJson);
  const beforeData = current.contentJson.sections.v2_main.settings.data;
  next.sections.v2_main.settings.data = improveAidreamcapesHome(beforeData);
  Object.assign(next.seo, {
    title: 'AI UGC Video Generator & Product Photos | AIVideosUGC',
    description: 'Create AI product videos and photos from your own product images. Choose a scene or AI presenter, save editable drafts, then review and download your content.',
    primaryKeyword: 'AI UGC video generator',
    keywords: 'AI UGC video generator, AI product videos, AI presenter videos, product video templates, AI product photos'
  });
  next.seo.twitterDescription = next.seo.description;
  for (const node of next.seo.jsonLd?.['@graph'] ?? []) {
    if (node['@type'] === 'WebPage') Object.assign(node, { name: next.seo.title, description: next.seo.description, inLanguage: 'en' });
  }
  next.contentContract.sourceRevision = 'aidreamcapes-home-interactions-en';
  assert.deepEqual(next.sections.v2_main.settings.data.blockOrder, beforeData.blockOrder, 'Original module order is retained');
  assert.deepEqual(next.sections.v2_main.settings.data.visual.picker.cards, beforeData.visual.picker.cards, 'All original scene cards and stable preset IDs are retained');
  assert.deepEqual(next.mediaManifest, current.contentJson.mediaManifest, 'Current media ownership is unchanged');
  assert(!/[\u3400-\u9fff]/u.test(JSON.stringify(next)), 'Public homepage source must remain English');
  const actions = next.sections.v2_main.settings.data.homeExperience.blocks.flatMap(block => [block.href, ...Object.values(block.actions)]);
  for (const href of actions) {
    const url = new URL(href, 'https://www.aivideosugc.com');
    assert.equal(url.origin, 'https://www.aivideosugc.com');
    assert.equal(url.pathname, '/app/create');
    assert(!['task', 'actor', 'actorId', 'reference', 'asset', 'generate', 'quote', 'reserve', 'checkout'].some(key => url.searchParams.has(key)), 'Handoff must not refer to customer records or generation operations');
  }
  const operations = diff(current.contentJson, next);
  assert(!operations.some(operation => operation.after === null), 'This patch must not delete current page fields');
  const manifest = { siteId, pageId, target: 'local', baseRevision: hash(current.contentJson), nextRevision: hash(next), operations };
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/${operations.length ? 'interaction-field-manifest' : 'interaction-current-plan'}.json`, JSON.stringify(manifest, null, 2));
  if (apply && operations.length) {
    const changed = await db.livePage.updateMany({ where: { id: pageId, siteId, slug: '/', updatedAt: current.updatedAt }, data: { contentJson: next } });
    assert.equal(changed.count, 1, 'Concurrent content edit detected; re-plan against the current relational row');
  }
  const readback = await db.livePage.findFirst({ where: { id: pageId, siteId, slug: '/' } });
  if (apply) assert.equal(hash(readback.contentJson), manifest.nextRevision);
  const protectedAfter = await myDreamShootsHash();
  assert.equal(protectedBefore, protectedAfter, 'MyDreamShoots public relational output changed');
  const [derived] = await db.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
  const evidence = { ok: true, applied: apply, siteId, pageId, owner: 'LivePage.contentJson', operations: operations.length, actions: actions.length, beforeRevision: manifest.baseRevision, afterRevision: manifest.nextRevision, sourceRevision: next.contentContract.sourceRevision, language: 'en', sceneCards: beforeData.visual.picker.cards.length, addedModules: 6, myDreamShootsHashBefore: protectedBefore, myDreamShootsHashAfter: protectedAfter, derivedState: { ...derived, runtimeUse: 'Public SSR reads the current LivePage; no historical state is restored or activated' } };
  if (apply) await fs.writeFile(`${out}/interaction-apply-evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await db.$disconnect(); }
