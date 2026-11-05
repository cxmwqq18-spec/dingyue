#!/usr/bin/env node
// Production apply: upgrade the four seller detail cards to the FULL 30-second
// videos with 30s prompts.
//
// The homepage ad phones keep looping the lightweight muted 10s clips
// (homeExperience.videos.seller*.src stays the -p10 file); the detail cards in
// data.examples.groups[0].items switch to the established detail-page pattern
// used by the six scene cards:
//   video.src        = full 30s file with audio (loads in the sound-on dialog)
//   video.previewSrc = the existing 10s muted clip (ambient loop)
//   video.width/height, duration = the full video's real values
//   prompt           = 30s brief describing the full cut, same claim
//                      boundaries as before (blank labels, no unconfirmed
//                      product claims, no added text)
//
// Mirrors scripts/apply-aidreamcapes-home-detail-links-production.mjs (same
// deterministic operation pattern, protected-row guard, updatedAt optimistic
// write, readback assert).
//
// Usage (on the production server, from the current release dir):
//   node scripts/apply-aidreamcapes-home-seller-full-videos-production.mjs                     # plan
//   node scripts/apply-aidreamcapes-home-seller-full-videos-production.mjs --apply-production  # apply
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

// publicSlug -> full-video upgrade. previewSrc keeps the existing 10s clip.
const upgrades = {
  'serum-nightly-glow': {
    src: mustExist('/ai-video-generation/serum-nightly-glow.mp4'),
    previewSrc: mustExist('/ai-video-generation/serum-nightly-glow-p10.mp4'),
    prompt: 'Wan 3.0; 30s; 9:16; sound on; product photo + identity reference, non-first-frame mode. A creator-style nightly skincare routine in a softly lit bathroom: a presenter in a white bathrobe sits at the vanity with an amber glass dropper bottle and its blank label in front of her. She introduces the bottle to camera, a hand close-up lifts the dropper bulb, she presses serum between her palms and pats it onto clean skin, a fresh-face close-up shows the natural finish, and the bottle closes the frame as she smiles. Lip-synced natural English female voice with a personal, unhurried tone; hand and skin close-ups stay silent; quiet room ambience only, no background music. Keep the label blank exactly as referenced; no ingredient, treatment, or before-and-after claims, no skin changes, and no added text or overlays.'
  },
  'candle-cozy-gift': {
    src: mustExist('/ai-video-generation/candle-cozy-gift.mp4'),
    previewSrc: mustExist('/ai-video-generation/candle-cozy-gift-p10.mp4'),
    prompt: 'Wan 3.0; 30s; 9:16; sound on; product photo + identity reference, non-first-frame mode. A warm creator-style gift ad at a golden-hour living-room table: a presenter in a cream knit sweater introduces a ribbed glass candle with its wooden lid resting beside it on a saucer. A close-up shows the ribbed glass, the wax surface and the single wick unlit; after a clear cut the candle burns on the same table with one small steady flame, followed by a flame close-up and a smiling closing frame behind the lit candle. Lip-synced natural English female voice with a warm, gifting tone; soft room ambience only, no music. One wick and one small flame throughout, and the candle stays on its heat-safe tray away from fabrics; no scent-type, burn-time, or wellness claims, and no added text or watermarks.'
  },
  'supplement-morning-routine': {
    src: mustExist('/ai-video-generation/supplement-morning-routine.mp4'),
    previewSrc: mustExist('/ai-video-generation/supplement-morning-routine-p10.mp4'),
    prompt: 'Wan 3.0; 30s; 9:16; sound on; product photo + identity reference, non-first-frame mode. A friendly creator-style pitch in a bright home kitchen: a presenter in a cream sweater stands at the counter with a white supplement bottle and its plain green label, a glass of water beside it. She introduces the bottle, lifts it with both hands for a label-facing close-up, speaks to camera while holding it, sets it back on the counter, and closes with the bottle and the untouched glass of water in frame. Lip-synced natural English female voice with a trustworthy, everyday tone; hand close-ups stay silent; no background music. Keep the label blank exactly as referenced; no ingredient, dosage, or health-effect claims, and no opening, dosing, or drinking shown.'
  },
  'sneakers-every-day': {
    src: mustExist('/ai-video-generation/sneakers-every-day.mp4'),
    previewSrc: mustExist('/ai-video-generation/sneakers-every-day-p10.mp4'),
    prompt: 'Wan 3.0; 30s; 9:16; sound on; product photo + identity reference, non-first-frame mode. A casual creator-style sneaker ad on sunlit front steps: a presenter in a cream sweater and relaxed jeans sits holding one white low-top lace-up sneaker toward the camera, then a hand close-up turns the shoe to show the stitching, laces and clean sole. Wearing both shoes, she takes a couple of natural steps on the pavement and closes with a full-body outfit frame pairing the sneakers with denim. Lip-synced natural English female voice with a casual tone; walking close-ups stay silent; soft outdoor ambience only, no music. This single pair is the only one in the scene; no leather, waterproof, or performance claims, and no added text, logos, or watermarks.'
  }
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
    const data = next.sections.v2_main.settings.data;
    assert.equal(data.homeExperience.version, 1);
    const base = 'sections/v2_main/settings/data';
    const operations = [];
    const push = (path, previousValue, value) => { if (hash(previousValue) === hash(value)) return; operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/${path}`, baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value }); };

    // Upgrade the four seller detail cards in place, located by publicSlug.
    const items = data.examples.groups[0].items;
    for (const [slug, upgrade] of Object.entries(upgrades)) {
      const index = items.findIndex(item => item.publicSlug === slug);
      assert.ok(index >= 0, `seller detail card not found: ${slug}`);
      const card = items[index];
      assert.equal(card.kind, 'video', `${slug}: kind changed`);
      const videoPath = `${base}/examples/groups/0/items/${index}/video`;
      push(`${videoPath}/src`, card.video?.src, upgrade.src);
      push(`${videoPath}/previewSrc`, card.video?.previewSrc, upgrade.previewSrc);
      push(`${videoPath}/width`, card.video?.width, 720);
      push(`${videoPath}/height`, card.video?.height, 1280);
      push(`${base}/examples/groups/0/items/${index}/duration`, card.duration, 30);
      push(`${base}/examples/groups/0/items/${index}/prompt`, card.prompt, upgrade.prompt);
      card.video = { ...(card.video ?? {}), src: upgrade.src, previewSrc: upgrade.previewSrc, width: 720, height: 1280 };
      card.duration = 30;
      card.prompt = upgrade.prompt;
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
    return { ok: true, target: 'production', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), protectedBefore, protectedAfter, operations, historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-home-seller-full-videos-20261105';
  await fs.promises.mkdir(out, { recursive: true });
  await fs.promises.writeFile(`${out}/production-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
