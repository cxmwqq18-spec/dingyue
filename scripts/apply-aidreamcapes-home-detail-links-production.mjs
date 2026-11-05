#!/usr/bin/env node
// Production apply of the aidreamcapes homepage detail-link content:
//   - platformsFlow platform cards gain href to their public platform directory
//     page (/platforms/tiktok-ads, /platforms/instagram-ads, /platforms/facebook-ads)
//   - seller example items (data.reviews.items) gain detailHref pointing at four
//     NEW public video detail slugs owned by this same homepage row
//   - data.examples.groups[0].items appends the four matching detail cards
//     (kind video, publicSlug, prompt, reference images) so resolveMediaDetail
//     has exactly one owner per slug and the sitemap enumerates them
//
// The four 10s seller clips already exist as public media and already play on
// the homepage ad phones; this change only gives them public detail pages.
// Prompts follow the Wan 3.0 brief style used by the existing scene cards and
// stay inside the claim boundaries documented for each product family.
//
// Mirrors scripts/apply-aidreamcapes-home-example-clips-production.mjs (same
// deterministic operation pattern, protected-row guard, updatedAt optimistic
// write, readback assert).
//
// Usage (on the production server, from the current release dir):
//   node scripts/apply-aidreamcapes-home-detail-links-production.mjs                     # plan
//   node scripts/apply-aidreamcapes-home-detail-links-production.mjs --apply-production  # apply
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const applying = process.argv.includes('--apply-production');
assertDatabaseTarget({ expectedTarget: 'production', requireProductionConfirmation: applying, productionConfirmed: applying });
const siteId = 'site_aidreamcapes';
const pageId = 'site_aidreamcapes_home';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

const mediaRoot = '/www/wwwroot/aidreamcapes.com/shared/sites/public-media';
const sharedMediaFileFor = rel => {
  if (rel.startsWith('ai-video-generation/')) return `${mediaRoot}/video/${rel.slice('ai-video-generation/'.length)}`;
  if (rel.startsWith('ai-image-generation/')) return `${mediaRoot}/image/${rel.slice('ai-image-generation/'.length)}`;
  return null;
};
const assetsChecked = new Set();
const checkAssets = () => {
  for (const rel of assetsChecked) {
    const file = sharedMediaFileFor(rel);
    if (file) { assert.ok(fs.existsSync(file), `missing public asset: ${rel} (${file})`); continue; }
    throw new Error(`unrecognized asset location: ${rel}`);
  }
};
const mustExist = rel => { assetsChecked.add(rel.replace(/^\//, '')); return rel; };
const adStill = (row, alt) => ({ src: mustExist(`/ai-image-generation/teams1-home-r${row}-ad-640.webp`), alt, w: 640, h: 960 });
const plainPhoto = (row, alt) => ({ alt: `Reference product photo — ${alt}`, src: mustExist(`/ai-image-generation/teams1-home-r${row}-src-640.webp`) });

// Platform directory addresses for the three platform cards.
const platformHrefs = { tiktok: '/platforms/tiktok-ads', instagram: '/platforms/instagram-ads', facebook: '/platforms/facebook-ads' };

// Seller example title -> new public detail slug. Order must match data.reviews.items.
const sellerDetailHrefs = {
  'A Serum Ad That Sells the Glow': '/ai-video-generation/serum-nightly-glow',
  'A Cozy Gift Ad Concept': '/ai-video-generation/candle-cozy-gift',
  'A Bottle Pitch That Builds Trust': '/ai-video-generation/supplement-morning-routine',
  'A Sneaker Ad Without a Crew': '/ai-video-generation/sneakers-every-day'
};

// One detail card per seller clip. The ad still is the card image and video
// poster; the seller's plain phone photo is the reference product photo.
const sellerCards = [
  {
    key: 'scene-serum-nightly-glow',
    kind: 'video',
    image: adStill(1, 'A presenter in a bathrobe holds an amber serum dropper bottle and talks to the camera'),
    title: 'Serum Bottle · Nightly Glow UGC',
    video: {
      src: mustExist('/ai-video-generation/serum-nightly-glow-p10.mp4'), width: 540, height: 960,
      poster: { alt: 'A presenter in a bathrobe holds an amber serum dropper bottle and talks to the camera', src: mustExist('/ai-image-generation/teams1-home-r1-ad-640.webp') }
    },
    aspect: '9:16',
    prompt: 'Wan 3.0; 10s; 9:16; sound on; product photo + identity reference, non-first-frame mode. A creator-style skincare ad in soft evening light: a presenter in a cozy bathrobe holds up an amber glass serum dropper bottle and tells the camera this is her new nightly glow step. One continuous 50mm medium close-up, mouth and bottle clearly visible, relaxed hand movement, no cuts. Lip-synced natural English female voice with a personal, unhurried tone; quiet room ambience only, no background music. Keep the bottle shape and label exactly as referenced; no ingredient, treatment, or before-and-after claims, no skin changes, and no added text or overlays.',
    product: 'Serum Dropper Bottle',
    duration: 10,
    industries: ['ind-beauty-skincare'],
    publicSlug: 'serum-nightly-glow',
    referenceImages: [plainPhoto(1, 'A plain phone photo of an amber serum dropper bottle on a counter')]
  },
  {
    key: 'scene-candle-cozy-gift',
    kind: 'video',
    image: adStill(2, 'A presenter in a cozy living room holds a lit ribbed glass candle toward the camera'),
    title: 'Glass Candle · Cozy Gift Ad',
    video: {
      src: mustExist('/ai-video-generation/candle-cozy-gift-p10.mp4'), width: 540, height: 960,
      poster: { alt: 'A presenter in a cozy living room holds a lit ribbed glass candle toward the camera', src: mustExist('/ai-image-generation/teams1-home-r2-ad-640.webp') }
    },
    aspect: '9:16',
    prompt: 'Wan 3.0; 10s; 9:16; sound on; product photo + identity reference, non-first-frame mode. A warm creator-style gift ad in a cozy living room at golden hour: a presenter lifts a ribbed glass candle with a wooden lid toward the camera, showing the single lit wick and the glass detail while the candle rests on a stable tray away from fabrics and curtains. One continuous 50mm medium shot, mouth and candle clearly visible, gentle natural movement. Lip-synced natural English female voice with a warm, gifting tone; soft room ambience only, no music. One wick and one small steady flame throughout; no scent-type, burn-time, or wellness claims, and no added text or watermarks.',
    product: 'Glass Jar Candle',
    duration: 10,
    industries: ['ind-home-living'],
    publicSlug: 'candle-cozy-gift',
    referenceImages: [plainPhoto(2, 'A plain phone photo of a ribbed glass candle with a wooden lid')]
  },
  {
    key: 'scene-supplement-morning-routine',
    kind: 'video',
    image: adStill(3, 'A presenter in a kitchen holds a white supplement bottle with a green label beside a glass of water'),
    title: 'Supplement Bottle · Morning Pitch',
    video: {
      src: mustExist('/ai-video-generation/supplement-morning-routine-p10.mp4'), width: 540, height: 960,
      poster: { alt: 'A presenter in a kitchen holds a white supplement bottle with a green label beside a glass of water', src: mustExist('/ai-image-generation/teams1-home-r3-ad-640.webp') }
    },
    aspect: '9:16',
    prompt: 'Wan 3.0; 10s; 9:16; sound on; product photo + identity reference, non-first-frame mode. A friendly creator-style pitch in a bright home kitchen: a presenter holds a white supplement bottle with a plain green label toward the camera and explains where it fits in her morning routine; a glass of water sits nearby, untouched. One continuous 50mm medium close-up, mouth and label clearly visible, steady hands, cap stays closed. Lip-synced natural English female voice with a trustworthy, everyday tone; no background music. Keep the label blank exactly as referenced; no ingredient, dosage, or health-effect claims, and no opening or drinking shown.',
    product: 'Supplement Bottle',
    duration: 10,
    industries: ['ind-health-wellness'],
    publicSlug: 'supplement-morning-routine',
    referenceImages: [plainPhoto(3, 'A plain phone photo of a white supplement bottle with a green label')]
  },
  {
    key: 'scene-sneakers-every-day',
    kind: 'video',
    image: adStill(4, 'A presenter on front steps holds up one white low-top lace-up sneaker to the camera'),
    title: 'White Sneaker · Front Steps Ad',
    video: {
      src: mustExist('/ai-video-generation/sneakers-every-day-p10.mp4'), width: 540, height: 960,
      poster: { alt: 'A presenter on front steps holds up one white low-top lace-up sneaker to the camera', src: mustExist('/ai-image-generation/teams1-home-r4-ad-640.webp') }
    },
    aspect: '9:16',
    prompt: 'Wan 3.0; 10s; 9:16; sound on; product photo + identity reference, non-first-frame mode. A casual creator-style sneaker ad on sunlit front steps: a presenter holds up one white low-top lace-up sneaker to the camera, turning it slightly to show the stitching, laces and clean white sole, dressed for an everyday outing. One continuous 50mm medium shot, natural daylight, relaxed pacing. Lip-synced natural English female voice with a casual tone; soft outdoor ambience only, no music. This single pair is the only one in the scene; no leather, waterproof, or performance claims, and no added text, logos, or watermarks.',
    product: 'White Sneakers',
    duration: 10,
    industries: ['ind-shoes'],
    publicSlug: 'sneakers-every-day',
    referenceImages: [plainPhoto(4, 'A plain phone photo of a pair of white sneakers')]
  }
];

try {
  checkAssets();
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId, slug: '/' } });

    // Single-owner guard: before this change no other row may reference the
    // new detail slugs, so resolveMediaDetail keeps exactly one owner per slug.
    for (const card of sellerCards) {
      const others = await tx.livePage.findMany({ where: { siteId, id: { not: pageId }, contentJson: { string_contains: card.publicSlug } }, select: { slug: true } });
      assert.equal(others.length, 0, `slug ${card.publicSlug} is already referenced by: ${others.map(o => o.slug).join(', ')}`);
    }

    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    const hx = data.homeExperience;
    assert.equal(hx.version, 1);
    const base = 'sections/v2_main/settings/data';
    const operations = [];
    const push = (path, previousValue, value) => { if (hash(previousValue) === hash(value)) return; operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/${path}`, baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value }); };

    // 1. platform cards: public platform directory addresses.
    const pfIndex = hx.blocks.findIndex(item => item.presentation?.platformsFlow);
    assert.ok(pfIndex >= 0, 'platformsFlow block not found');
    const platforms = hx.blocks[pfIndex].presentation.platformsFlow.platforms;
    assert.equal(platforms.length, 3, `expected 3 platform cards, found ${platforms.length}`);
    platforms.forEach((entry, index) => {
      const href = platformHrefs[entry.key];
      assert.ok(href, `no platform directory address for key: ${entry.key}`);
      push(`${base}/homeExperience/blocks/${pfIndex}/presentation/platformsFlow/platforms/${index}/href`, entry.href, href);
      entry.href = href;
    });

    // 2. seller example items: detailHref to the new public detail pages.
    const items = data.reviews?.items ?? [];
    assert.equal(items.length, 4, `expected 4 seller example items, found ${items.length}`);
    items.forEach((item, index) => {
      const href = sellerDetailHrefs[item.t];
      assert.ok(href, `no detail slug mapping for seller item: ${item.t}`);
      push(`${base}/reviews/items/${index}/detailHref`, item.detailHref, href);
      item.detailHref = href;
    });

    // 3. detail card registry: append the four seller cards so each new slug
    // has exactly one owner (this homepage row) and enters the sitemap.
    const exampleItems = data.examples.groups[0].items;
    assert.equal(exampleItems.length, 6, `expected 6 example items before append, found ${exampleItems.length}`);
    const existingSlugs = new Set(exampleItems.map(item => item.publicSlug).filter(Boolean));
    for (const card of sellerCards) assert.ok(!existingSlugs.has(card.publicSlug), `duplicate publicSlug in examples: ${card.publicSlug}`);
    sellerCards.forEach((card, offset) => {
      const index = exampleItems.length + offset;
      push(`${base}/examples/groups/0/items/${index}`, undefined, card);
      exampleItems.push(card);
    });

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
    return { ok: true, target: 'production', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), protectedBefore, protectedAfter, operations, historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-home-detail-links-20261105';
  await fs.promises.mkdir(out, { recursive: true });
  await fs.promises.writeFile(`${out}/production-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
