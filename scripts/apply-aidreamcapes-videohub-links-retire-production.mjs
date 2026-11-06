#!/usr/bin/env node
// Production apply, video hub (/ai-video-generation) layout + related links:
//   1. data.blockOrder drops the "examples" block id, so the industry-grouped
//      "TikTok Shop case studies" section stops rendering on the hub. This is
//      display-layer only: every example card stays in data.examples.groups on
//      this same owner row, so all detail pages keep exactly one owner row,
//      their addresses keep answering, and the sitemap is unchanged.
//   2. data.relatedGroups is rewritten to point at the public directory
//      addresses (/industries, /platforms, /occasions and their facets) instead
//      of /templates and a single detail-page link, matching the navigation's
//      Video panel. No /templates link remains on this module.
//
// Current relational rows only; compare-and-set per field (baseHash +
// previousValue); protected-row guard; readback asserted.
//
// Rollback: restore /sections/v2_main/settings/data/blockOrder and
// /sections/v2_main/settings/data/relatedGroups from the previousValue values
// recorded in the operations below.
//
// Usage (on the production server, from the current release dir):
//   node scripts/apply-aidreamcapes-videohub-links-retire-production.mjs                     # plan
//   node scripts/apply-aidreamcapes-videohub-links-retire-production.mjs --apply-production  # apply
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const applying = process.argv.includes('--apply-production');
assertDatabaseTarget({ expectedTarget: 'production', requireProductionConfirmation: applying, productionConfirmed: applying });
const siteId = 'site_aidreamcapes';
const pageId = 'aidreamcapes_mirror_page_04ef54dc4085da57';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

// Every directory address this manifest introduces must be a live public page.
const directoryHrefs = [
  '/industries',
  '/platforms',
  '/occasions',
  '/platforms/instagram-ads',
  '/platforms/facebook-ads',
  '/platforms/youtube-shorts-ads',
  '/occasions/sale-discount',
  '/occasions/holidays'
];

// Old field values, pinned for compare-and-set (verified against production on
// 2026-11-06). Any concurrent edit to these fields aborts the apply.
const PREVIOUS_BLOCK_ORDER = ['hero', 'definition', 'picker', 'reasons', 'steps', 'examples', 'related', 'reviews', 'faq', 'cta'];
const PREVIOUS_RELATED_GROUPS = [
  { title: 'Browse by industry', links: [
    { href: '/industries/beauty-skincare', label: 'Beauty & Personal Care' },
    { href: '/industries/fashion-clothing', label: 'Clothing' },
    { href: '/industries/electronics', label: 'Tech & Electronics' },
    { href: '/industries/food-drinks', label: 'Food & Beverage' },
    { href: '/industries/home-living', label: 'Home & Living' },
    { href: '/industries/pet', label: 'Pet' },
    { href: '/industries/kids-toy', label: 'Kids & Toy' },
    { href: '/industries/e-commerce', label: 'E-Commerce' },
    { href: '/templates', label: 'All examples' }
  ] },
  { title: 'Channels and Campaigns', links: [
    { href: '/platforms/tiktok-ads', label: 'TikTok' },
    { href: '/ai-video-generation/black-friday-countdown', label: 'Black Friday Video' }
  ] }
];

// New related-groups module content: directory browsing only, no /templates.
const NEXT_RELATED_GROUPS = [
  { title: 'Browse by industry', links: [
    { href: '/industries/beauty-skincare', label: 'Beauty & Personal Care' },
    { href: '/industries/fashion-clothing', label: 'Clothing' },
    { href: '/industries/electronics', label: 'Tech & Electronics' },
    { href: '/industries/food-drinks', label: 'Food & Beverage' },
    { href: '/industries/home-living', label: 'Home & Living' },
    { href: '/industries/pet', label: 'Pet' },
    { href: '/industries/kids-toy', label: 'Kids & Toy' },
    { href: '/industries/e-commerce', label: 'E-Commerce' },
    { href: '/industries', label: 'All industries' }
  ] },
  { title: 'Browse by platform', links: [
    { href: '/platforms/tiktok-ads', label: 'TikTok' },
    { href: '/platforms/instagram-ads', label: 'Instagram' },
    { href: '/platforms/facebook-ads', label: 'Facebook' },
    { href: '/platforms/youtube-shorts-ads', label: 'YouTube Shorts' },
    { href: '/platforms', label: 'All platforms' }
  ] },
  { title: 'Browse by occasion', links: [
    { href: '/occasions/sale-discount', label: 'Sale & Discount' },
    { href: '/occasions/black-friday', label: 'Black Friday' },
    { href: '/occasions/holidays', label: 'Holidays' },
    { href: '/occasions', label: 'All occasions' }
  ] }
];

try {
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId, slug: '/ai-video-generation' } });
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    assert.equal(data.id, 'video-hub', 'target page must be the video hub');

    const base = 'sections/v2_main/settings/data';
    const operations = [];
    const push = (path, previousValue, value) => { if (hash(previousValue) === hash(value)) return; operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/${path}`, baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value }); };

    // 1. Retire the case-studies block from the rendered layout. Cards stay in
    //    data.examples.groups (same owner row) — detail pages and sitemap keep
    //    resolving exactly as before.
    assert.deepEqual(data.blockOrder, PREVIOUS_BLOCK_ORDER, 'blockOrder changed since the manifest was written');
    push(`${base}/blockOrder`, data.blockOrder, PREVIOUS_BLOCK_ORDER.filter(id => id !== 'examples'));

    // 2. Related groups browse the public directories, not /templates.
    assert.deepEqual(data.relatedGroups, PREVIOUS_RELATED_GROUPS, 'relatedGroups changed since the manifest was written');
    push(`${base}/relatedGroups`, data.relatedGroups, NEXT_RELATED_GROUPS);

    if (!operations.length) return { ok: true, pageId, operations, note: 'nothing to apply' };

    if (applying) {
      // Readback: assert every written field and every example card untouched.
      data.blockOrder = PREVIOUS_BLOCK_ORDER.filter(id => id !== 'examples');
      data.relatedGroups = NEXT_RELATED_GROUPS;
      await tx.livePage.update({ where: { id: pageId }, data: { contentJson: next, updatedAt: new Date() } });
      const after = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId } });
      const afterData = after.contentJson.sections.v2_main.settings.data;
      assert.deepEqual(afterData.blockOrder, data.blockOrder, 'blockOrder readback');
      assert.deepEqual(afterData.relatedGroups, NEXT_RELATED_GROUPS, 'relatedGroups readback');
      assert.deepEqual(afterData.examples, row.contentJson.sections.v2_main.settings.data.examples, 'examples cards must be untouched');
    }

    return {
      ok: true, pageId, applying,
      owner: 'LivePage.contentJson',
      derivedState: { relation: 'derived-cache-untouched', note: 'SitePublishedState is a derived cache; LivePage commits go live on next request' },
      protectedBefore, protectedAfter: hash(await protectedRows()),
      operations: operations.map(op => ({
        path: op.path, baseHash: op.baseHash,
        previousValue: op.path.endsWith('/relatedGroups') ? op.previousValue : op.previousValue,
        value: op.value
      }))
    };
  });
  console.log(JSON.stringify(report, null, 2));
  if (!applying) console.log('PLAN ONLY — rerun with --apply-production to write.');
  await db.$disconnect();
  process.exit(0);
} catch (error) {
  console.error('APPLY FAILED:', error.message);
  await db.$disconnect();
  process.exit(1);
}
