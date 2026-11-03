#!/usr/bin/env node
// Local apply of the aidreamcapes homepage example clips (dev database, repo public/ assets).
//   - hero phone loops the serum clip (presentation.heroVideo)
//   - seller example ad phones loop serum/candle/supplement/sneaker clips (data.reviews.items[].video)
//   - workflow step 06 plays the candle clip (homeExperience.videos.workflowExample)
// Mirrors scripts/apply-aidreamcapes-home-platforms-production.mjs (same deterministic
// operation pattern, protected-row guard, updatedAt optimistic write, readback assert).
//
// Usage (on the production server, from the current release dir):
//   node scripts/apply-aidreamcapes-home-example-clips-local.mjs                     # plan
//   node scripts/apply-aidreamcapes-home-example-clips-local.mjs --apply-production  # apply
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const applying = process.argv.includes('--apply-local');
assertDatabaseTarget({ expectedTarget: 'local' });
const siteId = 'site_aidreamcapes';
const pageId = 'site_aidreamcapes_home';
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

import path from 'node:path';
import fsSync from 'node:fs';
const publicDir = path.resolve('public');
const mustExist = rel => { const p = path.join(publicDir, rel.replace(/^\//, '')); return fsSync.existsSync(p) && fsSync.statSync(p).isFile() ? rel : assert.fail(`missing public asset: ${rel}`); };
const poster = (src, alt) => ({ alt, src: mustExist(src), width: 640, height: 960 });

// The four 10-second clips cut from the creator recordings. Posters reuse the
// seller-example stills the ad phones already show, so the frame is identical
// before playback starts.
const adClips = {
  sellerSerumAd: {
    src: mustExist('/ai-video-generation/serum-nightly-glow-p10.mp4'), width: 540, height: 960, duration: 10,
    name: 'Serum ad: my new nightly glow step',
    poster: poster('/ai-image-generation/teams1-home-r1-ad-640.webp', 'A presenter in a bathrobe holds the serum bottle and talks to the camera')
  },
  sellerCandleAd: {
    src: mustExist('/ai-video-generation/candle-cozy-gift-p10.mp4'), width: 540, height: 960, duration: 10,
    name: 'Candle ad: the candle everyone asks about',
    poster: poster('/ai-image-generation/teams1-home-r2-ad-640.webp', 'A presenter in a cozy living room holds the same lit candle toward the camera')
  },
  sellerSupplementAd: {
    src: mustExist('/ai-video-generation/supplement-morning-routine-p10.mp4'), width: 540, height: 960, duration: 10,
    name: 'Supplement ad: my morning routine, simplified',
    poster: poster('/ai-image-generation/teams1-home-r3-ad-640.webp', 'A presenter in a kitchen holds the supplement bottle beside a glass of water')
  },
  sellerSneakerAd: {
    src: mustExist('/ai-video-generation/sneakers-every-day-p10.mp4'), width: 540, height: 960, duration: 10,
    name: 'Sneaker ad: clean white sneakers, every day',
    poster: poster('/ai-image-generation/teams1-home-r4-ad-640.webp', 'A presenter on front steps holds up one of the same white sneakers')
  }
};
const workflowExample = {
  src: mustExist('/ai-video-generation/candle-cozy-gift-p10.mp4'), width: 540, height: 960, duration: 10,
  name: 'Real example: a candle gift ad',
  poster: poster('/ai-image-generation/teams1-home-r2-ad-640.webp', 'Example of a presenter showing a scented candle at home')
};
// Item title -> videos key; the order must match data.reviews.items exactly.
const itemVideos = {
  'A Serum Ad That Sells the Glow': 'sellerSerumAd',
  'A Cozy Gift Ad Concept': 'sellerCandleAd',
  'A Bottle Pitch That Builds Trust': 'sellerSupplementAd',
  'A Sneaker Ad Without a Crew': 'sellerSneakerAd'
};

try {
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId, slug: '/' } });
    const next = structuredClone(row.contentJson);
    const data = next.sections.v2_main.settings.data;
    const hx = data.homeExperience;
    assert.equal(hx.version, 1);
    const base = 'sections/v2_main/settings/data';
    const operations = [];
    const push = (path, previousValue, value) => { if (hash(previousValue) === hash(value)) return; operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/${path}`, baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value }); };

    // 1. videos map: four seller clips plus the workflow example clip swap.
    for (const [key, value] of Object.entries(adClips)) push(`${base}/homeExperience/videos/${key}`, hx.videos?.[key], value);
    hx.videos = { ...(hx.videos ?? {}), ...adClips };
    push(`${base}/homeExperience/videos/workflowExample`, row.contentJson.sections.v2_main.settings.data.homeExperience.videos?.workflowExample, workflowExample);
    hx.videos.workflowExample = workflowExample;

    // 2. hero block: loop the serum clip in the hero phone.
    const heroIndex = hx.blocks.findIndex(item => item.after === 'hero');
    assert.equal(heroIndex, 0, 'hero block expected at index 0');
    const heroPresentation = { ...(hx.blocks[heroIndex].presentation ?? {}), heroVideo: 'sellerSerumAd' };
    push(`${base}/homeExperience/blocks/${heroIndex}/presentation`, hx.blocks[heroIndex].presentation, heroPresentation);
    hx.blocks[heroIndex].presentation = heroPresentation;

    // 3. seller example items: point every ad phone at its clip.
    const items = data.reviews?.items ?? [];
    assert.equal(items.length, 4, `expected 4 seller example items, found ${items.length}`);
    items.forEach((item, index) => {
      const key = itemVideos[item.t];
      assert.ok(key, `no clip mapping for seller item: ${item.t}`);
      push(`${base}/reviews/items/${index}/video`, item.video, key);
      item.video = key;
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
    return { ok: true, target: 'local', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), protectedBefore, protectedAfter, operations, historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-home-example-clips-20261104-local';
  await fs.promises.mkdir(out, { recursive: true });
  await fs.promises.writeFile(`${out}/production-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
