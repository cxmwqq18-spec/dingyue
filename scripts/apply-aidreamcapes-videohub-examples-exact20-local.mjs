#!/usr/bin/env node
/** Field-level manifest: finish the video-hub examples restructure — drop the five
 * curated single-item format rows so the module shows exactly 20 cards across the
 * seven industry groups, and align the section heading/lead with the content.
 * Display-layer only; previousValue carries the full prior state for rollback.
 * Current relational rows only; compare-and-set per field; readback asserted.
 *
 * Rollback: restore examples.groups / examples.h2 / examples.lead from the
 * operation previousValue values below.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
const siteId = 'site_aidreamcapes', pageId = 'aidreamcapes_mirror_page_04ef54dc4085da57';
const applying = process.argv.includes('--apply-local');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

// The curated format rows that leave the display (full items stay in previousValue).
const CURATED_LABELS = ['A Spoken Ad With a Person on Camera', 'The Same Product Walkthrough', 'A Showcase in a Real Room', 'An Actor Matched to the Buyer', 'A Clip Sized for the Feed'];
const INDUSTRY_LABELS = ['Clothing', 'Tech & Electronics', 'Beauty & Personal Care', 'Home & Living', 'Jewelry & Accessories', 'Food & Beverage', 'Health & Fitness'];
const newCopy = {
  h2: 'TikTok Shop case studies',
  lead: 'Browse real TikTok Shop video examples by industry, then start the same kind of video from your own product photo.'
};

try {
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId } });
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    assert.equal(data.id, 'video-hub', 'target page must be the video hub');
    const examples = data.examples;
    assert.ok(Array.isArray(examples?.groups), 'examples.groups missing');
    assert.deepEqual(examples.groups.map(g => g.label), [...CURATED_LABELS, ...INDUSTRY_LABELS], 'unexpected current group layout');
    const industry = examples.groups.filter(group => INDUSTRY_LABELS.includes(group.label));
    const total = industry.reduce((sum, group) => sum + (group.items?.length ?? 0), 0);
    assert.equal(total, 20, `expected 20 industry cards, got ${total}`);
    const operations = [];
    const push = (suffix, previousValue, value) => { if (hash(previousValue) !== hash(value)) operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/sections/v2_main/settings/data/examples/${suffix}`, baseHash: hash(previousValue), previousValue, value }); };
    push('groups', examples.groups, industry);
    examples.groups = industry;
    push('h2', examples.h2, newCopy.h2);
    examples.h2 = newCopy.h2;
    push('lead', examples.lead, newCopy.lead);
    examples.lead = newCopy.lead;
    assert.deepEqual(next.seo, row.contentJson.seo);
    assert.deepEqual(next.mediaManifest, row.contentJson.mediaManifest);
    if (applying && operations.length) {
      const result = await tx.livePage.updateMany({ where: { siteId, id: pageId, updatedAt: row.updatedAt }, data: { contentJson: next } });
      assert.equal(result.count, 1);
      const readback = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId } });
      assert.equal(hash(readback.contentJson), hash(next));
    }
    const protectedAfter = hash(await protectedRows());
    assert.equal(protectedBefore, protectedAfter);
    const [relation] = await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
    const derived = relation.relation ? await tx.sitePublishedState.findUnique({ where: { siteId }, select: { revision: true, contentHash: true } }) : null;
    return { ok: true, target: 'local', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), derivedState: { relation: relation.relation, record: derived }, protectedBefore, protectedAfter, operations: operations.map(op => ({ path: op.path, removedItemCount: Array.isArray(op.previousValue) ? op.previousValue.reduce((sum, group) => sum + (group.items?.length ?? 0), 0) : undefined })), historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-videohub-examples-exact20-20261104';
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/local-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
