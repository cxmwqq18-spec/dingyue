#!/usr/bin/env node
/** Field-level manifest: restructure the video-hub examples module — replace the
 * single 45-item "TikTok Shop case studies" group with seven industry groups
 * totalling 20 items (a few per category). Display-layer only: every removed
 * card's detail page, media URLs and sitemap entry are untouched, and the full
 * original group is preserved in the operation's previousValue for rollback.
 * Current relational rows only; compare-and-set per field; readback asserted.
 *
 * Rollback: restore /sections/v2_main/settings/data/examples/groups from
 * previousValue recorded in the operation below.
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

// Industry facet slug -> public group label (matches the site's industry naming).
const INDUSTRY_GROUPS = [
  { facet: 'fashion-clothing', label: 'Clothing', take: 3 },
  { facet: 'electronics', label: 'Tech & Electronics', take: 4 },
  { facet: 'beauty-skincare', label: 'Beauty & Personal Care', take: 3 },
  { facet: 'home-living', label: 'Home & Living', take: 3 },
  { facet: 'jewelry-accessories', label: 'Jewelry & Accessories', take: 3 },
  { facet: 'food-drinks', label: 'Food & Beverage', take: 2 },
  { facet: 'health-wellness', label: 'Health & Fitness', take: 2 }
];

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
    const curated = examples.groups.filter(group => group.label !== 'TikTok Shop case studies');
    const tiktok = examples.groups.find(group => group.label === 'TikTok Shop case studies');
    assert.ok(tiktok, 'TikTok Shop case studies group missing');
    const originalItems = tiktok.items ?? [];
    assert.equal(originalItems.length, 45, 'expected the 45-item TikTok Shop group');
    const groups = [...curated];
    const usedHrefs = new Set(curated.flatMap(group => (group.items ?? []).map(item => item.href)));
    let kept = 0;
    for (const { facet, label, take } of INDUSTRY_GROUPS) {
      const items = originalItems.filter(item => Array.isArray(item.placement) && item.placement.some(p => String(p).startsWith(`/industries/${facet}`)) && !usedHrefs.has(item.href));
      assert.ok(items.length >= take, `industry ${facet}: only ${items.length} unused items available, need ${take}`);
      for (const item of items.slice(0, take)) usedHrefs.add(item.href);
      groups.push({ label, items: items.slice(0, take) });
      kept += take;
    }
    assert.equal(kept, 20, `expected 20 kept items, got ${kept}`);
    assert.equal(new Set(groups.flatMap(group => group.items.map(item => item.href)).filter(href => href.startsWith('/ai-video-generation/'))).size, kept, 'duplicate detail-page hrefs across industry groups');
    const operations = [];
    const path = 'sections/v2_main/settings/data/examples/groups';
    const previousValue = examples.groups;
    const value = groups;
    if (hash(previousValue) !== hash(value)) {
      operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/${path}`, baseHash: hash(previousValue), previousValue, value });
      examples.groups = groups;
    }
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
    return { ok: true, target: 'local', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), derivedState: { relation: relation.relation, record: derived }, protectedBefore, protectedAfter, operations: operations.map(op => ({ ...op, removedItemCount: op.previousValue.find(g => g.label === 'TikTok Shop case studies')?.items?.length })), historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-videohub-examples-categorize-20261104';
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/local-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
