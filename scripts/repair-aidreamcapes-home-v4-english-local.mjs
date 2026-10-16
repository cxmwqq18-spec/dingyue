#!/usr/bin/env node
/** Restore only the translated fields against the CURRENT local LivePage. No snapshot import. */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget, hasArgument } from './lib/database-target.mjs';
import { aidreamcapesHomeExperienceEnglish as english } from './lib/aidreamcapes-home-v4-english.mjs';

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
const SITE_ID = 'site_aidreamcapes';
const PAGE_ID = 'site_aidreamcapes_home';
const APPLY = hasArgument('--apply-local');
const OUT = 'releases/aidreamcapes-home-v4-english-fix';
const prisma = new PrismaClient();
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(JSON.stringify(stable(value ?? null))).digest('hex');
const encode = key => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const parts = pointer => pointer.slice(1).split('/').map(key => key.replace(/~1/g, '/').replace(/~0/g, '~'));
const read = (object, pointer) => parts(pointer).reduce((value, key) => value?.[key], object);
const write = (object, pointer, value) => {
  const keys = parts(pointer);
  const parent = keys.slice(0, -1).reduce((value, key) => value?.[key], object);
  assert(parent && typeof parent === 'object', `Missing current parent: ${pointer}`);
  parent[keys.at(-1)] = structuredClone(value);
};

// Expand the prior FIELD manifest into individual string edits. Arrays are never restored wholesale.
function originalStrings(before, after, pointer) {
  if (typeof before === 'string' && typeof after === 'string') return before === after ? [] : [{ pointer, before, after }];
  if (!before || !after || typeof before !== 'object' || typeof after !== 'object') return [];
  return Object.keys(before).filter(key => Object.hasOwn(after, key))
    .flatMap(key => originalStrings(before[key], after[key], `${pointer}/${encode(key)}`));
}

async function protectedDataHash() {
  const [pages, settings, profile] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: 'site_dreamshoot' }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: 'site_dreamshoot' }, select: { draftJson: true, publishedJson: true } }),
    prisma.storefrontProfile.findUnique({ where: { siteId: 'site_dreamshoot' }, select: { publishedJson: true } })
  ]);
  return hash({ pages, settings, profile });
}

try {
  const inverseSource = JSON.parse(await fs.readFile('releases/aidreamcapes-home-v4-implementation/home-v4-original-field-manifest.json', 'utf8'));
  assert.equal(inverseSource.siteId, SITE_ID);
  assert.equal(inverseSource.pageId, PAGE_ID);
  const protectedBefore = await protectedDataHash();
  const current = await prisma.livePage.findFirst({ where: { id: PAGE_ID, siteId: SITE_ID, slug: '/' } });
  assert(current, 'Current relational homepage must exist');
  const next = structuredClone(current.contentJson);
  const originalData = current.contentJson.sections.v2_main.settings.data;
  assert.equal(originalData.homeExperience.version, 1);
  const operations = [], conflicts = [];
  const patch = (pointer, expected, desired, reason) => {
    const actual = read(next, pointer);
    if (hash(actual) === hash(desired)) return;
    if (hash(actual) !== hash(expected)) {
      conflicts.push({ path: pointer, reason: 'Current field differs from the last edit; preserved' });
      return;
    }
    operations.push({ path: pointer, baseHash: hash(actual), before: actual ?? null, after: desired, reason });
    write(next, pointer, desired);
  };
  for (const operation of inverseSource.operations) {
    if (['/sections/v2_main/settings/data/homeExperience', '/mediaManifest', '/contentContract/sourceRevision', '/seo/jsonLd/@graph'].includes(operation.path)) continue;
    for (const edit of originalStrings(operation.before, operation.after, operation.path)) {
      patch(edit.pointer, edit.after, edit.before, 'Restore original English copy');
    }
  }

  const experiencePath = '/sections/v2_main/settings/data/homeExperience';
  const previous = inverseSource.operations.find(operation => operation.path === experiencePath)?.after;
  assert(previous, 'Expected field manifest for the added modules');
  patch(`${experiencePath}/language`, 'zh-CN', 'en', 'English is the source language');
  patch(`${experiencePath}/labels`, previous.labels, {}, 'Use original English navigation, footer and pricing labels');
  const experience = read(next, experiencePath);
  assert.deepEqual(experience.blocks.map(block => block.after), english.blocks.map(block => block.after));
  for (const [index, block] of english.blocks.entries()) {
    for (const [key, value] of Object.entries(block.copy)) {
      patch(`${experiencePath}/blocks/${index}/copy/${encode(key)}`, previous.blocks[index].copy[key], value, 'English copy for the added module');
    }
  }
  for (const [key, image] of Object.entries(english.media)) {
    assert.equal(experience.media[key].src, image.src, 'Do not change current media URLs');
    patch(`${experiencePath}/media/${key}/alt`, previous.media[key].alt, image.alt, 'English image description');
    for (const [index, item] of next.mediaManifest.entries()) {
      if (item.src === image.src && item.alt === previous.media[key].alt) {
        patch(`/mediaManifest/${index}/alt`, item.alt, image.alt, 'English media manifest description');
      }
    }
  }

  // Keep schema language and visible FAQ synchronized without replacing the graph.
  for (const [index, node] of (next.seo.jsonLd?.['@graph'] ?? []).entries()) {
    if (node['@type'] === 'WebPage') {
      patch(`/seo/jsonLd/@graph/${index}/name`, node.name, next.seo.title, 'Schema title matches current English metadata');
      patch(`/seo/jsonLd/@graph/${index}/description`, node.description, next.seo.description, 'Schema description matches current English metadata');
    }
    if (['WebPage', 'WebSite', 'FAQPage'].includes(node['@type'])) {
      patch(`/seo/jsonLd/@graph/${index}/inLanguage`, node.inLanguage, 'en', 'English structured data');
    }
    if (node['@type'] === 'FAQPage') {
      const desiredFaq = next.sections.v2_main.settings.data.faq.map(item => ({ '@type': 'Question', name: item.q, acceptedAnswer: { '@type': 'Answer', text: item.a } }));
      patch(`/seo/jsonLd/@graph/${index}/mainEntity`, node.mainEntity, desiredFaq, 'FAQ schema matches current visible English FAQ');
    }
  }
  patch('/contentContract/sourceRevision', current.contentJson.contentContract.sourceRevision, 'aidreamcapes-home-v4-en', 'Current English content revision');
  assert.deepEqual(next.sections.v2_main.settings.data.blockOrder, originalData.blockOrder);
  assert.equal(next.sections.v2_main.settings.data.visual.picker.cards.length, 38);
  assert.equal(next.sections.v2_main.settings.data.homeExperience.blocks.length, 6);
  assert.equal(next.mediaManifest.length, current.contentJson.mediaManifest.length, 'All current media retained');
  assert(!/[\u3400-\u9fff]/u.test(JSON.stringify(next)), 'Chinese text remains in the homepage relational content');
  const manifest = { siteId: SITE_ID, pageId: PAGE_ID, target: 'local', baseRevision: hash(current.contentJson), nextRevision: hash(next), operations, conflicts };
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(`${OUT}/${operations.length ? 'english-field-manifest' : 'english-current-plan'}.json`, JSON.stringify(manifest, null, 2));
  assert.equal(conflicts.length, 0, 'Current content changed; inspect conflicts before applying');
  if (APPLY && operations.length) {
    // CAS protects all unrelated current edits even though Prisma serializes the merged JSONB value.
    const changed = await prisma.livePage.updateMany({ where: { id: PAGE_ID, siteId: SITE_ID, slug: '/', updatedAt: current.updatedAt }, data: { contentJson: next } });
    assert.equal(changed.count, 1, 'Homepage changed concurrently; re-plan against the current row');
  }
  const readback = await prisma.livePage.findFirst({ where: { id: PAGE_ID, siteId: SITE_ID, slug: '/' } });
  if (APPLY) assert.equal(hash(readback.contentJson), manifest.nextRevision);
  const protectedAfter = await protectedDataHash();
  assert.equal(protectedBefore, protectedAfter, 'MyDreamShoots current relational data must remain unchanged');
  const [derived] = await prisma.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
  const evidence = { ok: true, applied: APPLY, siteId: SITE_ID, pageId: PAGE_ID, operations: operations.length, conflicts, beforeRevision: manifest.baseRevision, afterRevision: manifest.nextRevision, sourceRevision: next.contentContract.sourceRevision, language: experience.language, retainedSceneCards: 38, retainedAddedModules: 6, myDreamShootsHashBefore: protectedBefore, myDreamShootsHashAfter: protectedAfter, derivedState: { ...derived, runtimeUse: 'Current LivePage read on every public SSR request; no snapshot activated or restored' } };
  if (APPLY) await fs.writeFile(`${OUT}/english-apply-evidence.json`, JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally { await prisma.$disconnect(); }
