#!/usr/bin/env node
/** Field-level manifest: replace the /ai-actors "Related tools and guides" link
 * module (data.relatedGroups, two groups / 11 links pointing at tool, guide and
 * blog pages) with two groups of industry pages (/industries/*) per the site
 * owner's request. Display-layer only; the bottom "Related pages" module and the
 * module heading (relatedH2) are untouched; previousValue carries the full prior
 * array for rollback. Current relational rows only; compare-and-set; readback.
 *
 * Rollback: restore /sections/v2_main/settings/data/relatedGroups from the
 * operation's previousValue below.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
const siteId = 'site_aidreamcapes', pageId = 'aidreamcapes_v2_ai_actors';
const applying = process.argv.includes('--apply-local');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

// Industry labels reuse the site's existing industry naming (video-hub example
// module / footer). Every href is asserted to exist in LivePage below.
const INDUSTRY_GROUPS = [
  {
    title: 'Ads for what you sell',
    links: [
      { href: '/industries/fashion-clothing', label: 'Clothing' },
      { href: '/industries/beauty-skincare', label: 'Beauty & Personal Care' },
      { href: '/industries/food-drinks', label: 'Food & Beverage' },
      { href: '/industries/electronics', label: 'Tech & Electronics' },
      { href: '/industries/home-living', label: 'Home & Living' },
      { href: '/industries/jewelry-accessories', label: 'Jewelry & Accessories' }
    ]
  },
  {
    title: 'More industries',
    links: [
      { href: '/industries/health-wellness', label: 'Health & Fitness' },
      { href: '/industries/shoes', label: 'Shoes & Footwear' },
      { href: '/industries/pet', label: 'Pet Products' },
      { href: '/industries/kids-toy', label: 'Kids & Toys' },
      { href: '/industries/sports-gym', label: 'Sports & Gym' },
      { href: '/industries', label: 'All Industries' }
    ]
  }
];

try {
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    for (const group of INDUSTRY_GROUPS) {
      for (const link of group.links) {
        const target = await tx.livePage.findUnique({ where: { siteId_slug: { siteId, slug: link.href } }, select: { slug: true } });
        assert.ok(target, `industry target missing in LivePage: ${link.href}`);
      }
    }
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId } });
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    const groups = data.relatedGroups;
    assert.ok(Array.isArray(groups) && groups.length === 2, 'unexpected relatedGroups shape');
    assert.equal(groups[0].title, 'Formats for an actor-led ad');
    assert.equal(groups[1].title, 'Ad sizes and testing');
    assert.equal(groups.reduce((sum, group) => sum + group.links.length, 0), 11, 'unexpected link count');
    assert.equal(typeof data.relatedH2, 'string');
    const operations = [];
    const previousValue = groups;
    if (hash(previousValue) !== hash(INDUSTRY_GROUPS)) {
      operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: '/sections/v2_main/settings/data/relatedGroups', baseHash: hash(previousValue), previousValue, value: INDUSTRY_GROUPS });
      data.relatedGroups = INDUSTRY_GROUPS;
    }
    assert.deepEqual(data.relatedLinks?.map(link => link.href), ['/ai-video-generation/spokesperson-video', '/ai-video-generation/url-to-video', '/ai-video-generation/video-ads', '/platforms/instagram-ads', '/ai-video-generation/image-to-video', '/ai-video-generation/product-video'], 'relatedLinks must stay untouched');
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
    return { ok: true, target: 'local', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), derivedState: { relation: relation.relation, record: derived }, protectedBefore, protectedAfter, operations: operations.map(op => ({ path: op.path, replacedLinkCount: op.previousValue.reduce((sum, group) => sum + group.links.length, 0) })), historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-ai-actors-industry-links-20261104';
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/local-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
