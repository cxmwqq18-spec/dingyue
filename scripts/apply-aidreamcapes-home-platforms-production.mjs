#!/usr/bin/env node
// Production apply of the aidreamcapes homepage platform video styles module
// (reviews block + presentation.platformsFlow). Mirrors
// scripts/apply-aidreamcapes-home-platforms-local.mjs (same deterministic
// payload), but targets the production database and asserts the three p10
// clips on the server's shared public-media tree and the poster variants over
// the running origin.
//
// Usage (on the production server, from the current release dir):
//   node scripts/apply-aidreamcapes-home-platforms-production.mjs                     # plan
//   node scripts/apply-aidreamcapes-home-platforms-production.mjs --apply-production  # apply
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertAllowedSite, assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const applying = process.argv.includes('--apply-production');
assertDatabaseTarget({ expectedTarget: 'production', requireProductionConfirmation: applying, productionConfirmed: applying });
const siteId = assertAllowedSite('site_aidreamcapes');
const pageId = 'site_aidreamcapes_home';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

const mediaRoot = '/www/wwwroot/aidreamcapes.com/shared/sites/public-media';
const sharedMediaFileFor = rel => {
  if (rel.startsWith('ai-video-generation/')) return `${mediaRoot}/video/${rel.slice('ai-video-generation/'.length)}`;
  return null;
};
const assetsChecked = new Set();
const checkAssets = () => {
  for (const rel of assetsChecked) {
    const file = sharedMediaFileFor(rel);
    if (file) { assert.ok(fs.existsSync(file), `missing public asset: ${rel} (${file})`); continue; }
    if (rel.startsWith('assets/')) {
      const code = execFileSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', '-H', 'Host: www.aivideosugc.com', '-H', 'X-Forwarded-Proto: https', `http://127.0.0.1:3013/${rel}`], { encoding: 'utf8' }).trim();
      assert.equal(code, '200', `missing public asset over origin: ${rel} (HTTP ${code})`);
      continue;
    }
    throw new Error(`unrecognized asset location: ${rel}`);
  }
};
const mustExist = rel => { assetsChecked.add(rel.replace(/^\//, '')); return rel; };
const img = (src, alt, width, height) => { mustExist(src.replace(/^\//, '')); return { src, alt, width, height }; };

const REF = '/assets/sites/site_aidreamcapes/v2-responsive/ai-image-generation';
const pfVideos = {
  pfTikTokUnbox: {
    src: mustExist('/ai-video-generation/skincare-gift-set-unbox-routine-p10.mp4'), width: 540, height: 960, duration: 10,
    name: 'AI TikTok-style unboxing of a skincare gift set',
    poster: img(`${REF}/skincare-gift-set-unbox-routine-640--640.webp`, 'Skincare gift set with cleanser, serum and cream unboxed on marble', 640, 640)
  },
  pfInstagramReel: {
    src: mustExist('/ai-video-generation/everyday-lipstick-vanity-check-p10.mp4'), width: 540, height: 960, duration: 10,
    name: 'AI Instagram Reels get-ready moment with a lipstick at a marble vanity',
    poster: img(`${REF}/everyday-lipstick-vanity-check-640--640.webp`, 'Black lipstick tube on a marble vanity in soft light', 640, 640)
  },
  pfFacebookOffer: {
    src: mustExist('/ai-video-generation/green-cleanser-black-friday-deal-p10.mp4'), width: 540, height: 960, duration: 10,
    name: 'AI Facebook feed ad testimonial for a body wash deal',
    poster: img(`${REF}/green-cleanser-black-friday-deal-640--640.webp`, 'Green body wash bottle held by a presenter in a bathroom', 640, 640)
  }
};
const pfCopy = {
  t001: 'Platform video styles',
  t002: 'Platform-native AI videos',
  t003: 'for TikTok, Instagram & Facebook',
  t004: 'Turn one product photo into videos made for each feed — a creator-style TikTok unboxing, an Instagram get-ready reel and a Facebook offer testimonial, all ready to post.',
  pfTiktokTitle: 'TikTok creator unboxings',
  pfTiktokSpec: '9:16 vertical · 10-second loop',
  pfTiktokDescLead: 'Hook first, captions selling.',
  pfTiktokDesc: 'A creator-style video that opens with a strong hook and walks viewers through the product, the way top-performing TikTok ads do.',
  pfTiktokTag1: 'Creator unboxing',
  pfTiktokTag2: 'Talking head',
  pfTiktokTag3: 'On-screen captions',
  pfInstagramTitle: 'Instagram Reels that get saved',
  pfInstagramSpec: '9:16 vertical · 10-second loop',
  pfInstagramDescLead: 'The scene leads, text stays quiet.',
  pfInstagramDesc: 'A soft-light get-ready moment with short captions — the aesthetic Reels format people save and share.',
  pfInstagramTag1: 'Get-ready reel',
  pfInstagramTag2: 'Soft light',
  pfInstagramTag3: 'Minimal captions',
  pfFacebookTitle: 'Facebook feed ads that convert',
  pfFacebookSpec: '9:16 vertical · 10-second loop',
  pfFacebookDescLead: 'The offer opens the ad.',
  pfFacebookDesc: 'A customer testimonial that leads with the deal, shows the product in use and closes on value — the UGC format that performs in feeds.',
  pfFacebookTag1: 'UGC testimonial',
  pfFacebookTag2: 'Offer hook',
  pfFacebookTag3: 'Product demo',
  pfSelected: 'Selected platform',
  pfCta: 'Create my {platform} video',
  t017: 'Examples show possible creative directions. Upload your own product photos and review generated details before using the content.',
  uiClose: 'Close preview'
};
const pfActions = {
  pfTiktok: '/app/create/demo/skincare-presenter-intro',
  pfInstagram: '/app/create/demo/clean-reference-photo',
  pfFacebook: '/app/create/demo/new-product-intro'
};
const pfFlow = {
  version: 1,
  platforms: [
    { key: 'tiktok', platform: 'TikTok', title: 'pfTiktokTitle', descriptionLead: 'pfTiktokDescLead', description: 'pfTiktokDesc', spec: 'pfTiktokSpec', tags: ['pfTiktokTag1', 'pfTiktokTag2', 'pfTiktokTag3'], video: 'pfTikTokUnbox', ctaKey: 'pfTiktok' },
    { key: 'instagram', platform: 'Instagram', title: 'pfInstagramTitle', descriptionLead: 'pfInstagramDescLead', description: 'pfInstagramDesc', spec: 'pfInstagramSpec', tags: ['pfInstagramTag1', 'pfInstagramTag2', 'pfInstagramTag3'], video: 'pfInstagramReel', ctaKey: 'pfInstagram' },
    { key: 'facebook', platform: 'Facebook', title: 'pfFacebookTitle', descriptionLead: 'pfFacebookDescLead', description: 'pfFacebookDesc', spec: 'pfFacebookSpec', tags: ['pfFacebookTag1', 'pfFacebookTag2', 'pfFacebookTag3'], video: 'pfFacebookOffer', ctaKey: 'pfFacebook' }
  ],
  selectedLabel: 'pfSelected',
  ctaLabel: 'pfCta'
};

try {
  checkAssets();
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId, slug: '/' } });
    const next = structuredClone(row.contentJson);
    const hx = next.sections.v2_main.settings.data.homeExperience;
    assert.equal(hx.version, 1);
    const blockIndex = hx.blocks.findIndex(item => item.after === 'reviews');
    assert.equal(blockIndex, 5, 'reviews block expected at index 5');
    const block = hx.blocks[blockIndex];
    assert.ok(block.copy.t001, 'reviews block copy missing');
    const base = `sections/v2_main/settings/data/homeExperience`;
    const operations = [];
    const push = (path, previousValue, value) => { if (hash(previousValue) === hash(value)) return; operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/${path}`, baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value }); };
    for (const [key, value] of Object.entries(pfVideos)) push(`${base}/videos/${key}`, hx.videos?.[key], value);
    hx.videos = { ...(hx.videos ?? {}), ...pfVideos };
    push(`${base}/blocks/${blockIndex}/copy`, block.copy, pfCopy);
    block.copy = pfCopy;
    push(`${base}/blocks/${blockIndex}/actions`, block.actions, { ...block.actions, ...pfActions });
    block.actions = { ...block.actions, ...pfActions };
    push(`${base}/blocks/${blockIndex}/presentation/platformsFlow`, block.presentation?.platformsFlow, pfFlow);
    block.presentation = { ...block.presentation, platformsFlow: pfFlow };
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
    return { ok: true, target: 'production', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), derivedState: { relation: relation.relation, record: derived }, protectedBefore, protectedAfter, operations, historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-home-platforms-20261103';
  await fsPromises.mkdir(out, { recursive: true });
  await fsPromises.writeFile(`${out}/production-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
