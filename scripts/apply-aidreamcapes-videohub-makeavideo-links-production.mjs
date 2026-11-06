#!/usr/bin/env node
// Production apply, video hub (/ai-video-generation) related module content:
// the relatedGroups field becomes a single "Make a video" group with the eight
// make-a-video tool links (labels + one-line descriptions, matching the nav's
// "Make a video" panel verbatim). The industry/platform/occasion directory
// groups are retired from this module per the owner's decision (approved
// 方案一 of design/related-links-redesign-v3.html).
//
// Current relational rows only; compare-and-set per field (baseHash +
// previousValue); protected-row guard; readback asserted. Display/data layer
// only — no media rows, no detail-page ownership, sitemap untouched.
//
// Rollback: restore /sections/v2_main/settings/data/relatedGroups from the
// previousValue recorded in the operation below.
//
// Usage (on the production server, from the current release dir):
//   node scripts/apply-aidreamcapes-videohub-makeavideo-links-production.mjs                     # plan
//   node scripts/apply-aidreamcapes-videohub-makeavideo-links-production.mjs --apply-production  # apply
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

// Old field value, pinned for compare-and-set (the directory-only groups
// applied by apply-aidreamcapes-videohub-links-retire-production.mjs).
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

// The eight make-a-video tool links, verbatim from the nav panel.
const NEXT_RELATED_GROUPS = [
  { title: 'Make a video', links: [
    { href: '/ai-video-generation/image-to-video', label: 'Image to Video', description: 'Animate one product photo into a short clip' },
    { href: '/ai-video-generation/url-to-video', label: 'URL to Video', description: 'Paste a product link, get a video' },
    { href: '/ai-video-generation/video-ads', label: 'Video Ads', description: 'Short ads for TikTok, Reels and Shorts' },
    { href: '/ai-video-generation/product-video', label: 'Product Video', description: 'Demo how your product works, one action per clip' },
    { href: '/ai-video-generation/before-after-video', label: 'Before & After Video', description: 'Show the difference your product makes' },
    { href: '/ai-video-generation/spokesperson-video', label: 'Spokesperson Video', description: 'A presenter shows your product on camera' },
    { href: '/ai-video-generation/text-to-video', label: 'Text to Video', description: 'Turn a written product brief into an editable video plan' },
    { href: '/ai-video-generation/ai-twin', label: 'AI Twin', description: 'Explore a consistent presenter style for your product stories' }
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

    assert.deepEqual(data.relatedGroups, PREVIOUS_RELATED_GROUPS, 'relatedGroups changed since the manifest was written');
    const path = '/sections/v2_main/settings/data/relatedGroups';
    if (hash(PREVIOUS_RELATED_GROUPS) === hash(NEXT_RELATED_GROUPS)) return { ok: true, pageId, operations: [], note: 'nothing to apply' };
    const operation = { entityType: 'live_page', id: pageId, field: 'contentJson', path, baseHash: hash(PREVIOUS_RELATED_GROUPS), previousValue: PREVIOUS_RELATED_GROUPS, value: NEXT_RELATED_GROUPS };
    const operations = [operation];

    if (applying) {
      data.relatedGroups = NEXT_RELATED_GROUPS;
      await tx.livePage.update({ where: { id: pageId }, data: { contentJson: next, updatedAt: new Date() } });
      const after = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId } });
      const afterData = after.contentJson.sections.v2_main.settings.data;
      assert.deepEqual(afterData.relatedGroups, NEXT_RELATED_GROUPS, 'relatedGroups readback');
      assert.deepEqual(afterData.blockOrder, row.contentJson.sections.v2_main.settings.data.blockOrder, 'blockOrder must be untouched');
      assert.deepEqual(afterData.examples, row.contentJson.sections.v2_main.settings.data.examples, 'examples cards must be untouched');
    }

    return {
      ok: true, pageId, applying,
      owner: 'LivePage.contentJson',
      derivedState: { relation: 'derived-cache-untouched', note: 'SitePublishedState is a derived cache; LivePage commits go live on next request' },
      protectedBefore, protectedAfter: hash(await protectedRows()),
      operations
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
