#!/usr/bin/env node
// Production apply of the aidreamcapes home brand tools v3 demo data.
// Mirrors scripts/apply-aidreamcapes-home-tools-v3-local.mjs (same deterministic
// payload), but targets the production database and asserts assets on the
// server's shared public-media tree.
//
// Usage (on the production server, from the current release dir):
//   node scripts/apply-aidreamcapes-home-tools-v3-production.mjs                     # plan
//   node scripts/apply-aidreamcapes-home-tools-v3-production.mjs --apply-production  # apply
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertAllowedSite, assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: 'production', requireProductionConfirmation: applying, productionConfirmed: applying });
const siteId = assertAllowedSite('site_aidreamcapes');
const pageId = 'site_aidreamcapes_home';
const applying = process.argv.includes('--apply-production');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

// Public asset existence on the production server.
const mediaRoot = '/www/wwwroot/aidreamcapes.com/shared/sites/public-media';
const sharedMediaFileFor = rel => {
  if (rel.startsWith('ai-image-generation/actors/')) return `${mediaRoot}/actor/${rel.slice('ai-image-generation/actors/'.length)}`;
  if (rel.startsWith('ai-image-generation/')) return `${mediaRoot}/image/${rel.slice('ai-image-generation/'.length)}`;
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
const mustExist = rel => { assetsChecked.add(rel); return rel; };
const img = (src, alt, width, height) => { mustExist(src.replace(/^\//, '')); return { src, alt, width, height }; };
const video = (src, poster) => { mustExist(src.replace(/^\//, '')); return { src, poster }; };

const ACTORS = '/ai-image-generation/actors';
const REF = '/assets/sites/site_aidreamcapes/v2-responsive/ai-image-generation';

const importGallery = [
  { image: img('/ai-image-generation/fx14-white-input-tote-good-r1-640.webp', 'Canvas tote bag main product photo standing on a wooden table', 640, 640), label: 'Main photo' },
  { image: img('/ai-image-generation/b2f1-social-ad-photos-picker-tote-r1-640.webp', 'Model carrying the canvas tote bag outdoors', 640, 640), label: 'Model shot' },
  { image: img('/ai-image-generation/fx18-social-use-tote-640.webp', 'Canvas tote bag in use holding a green water bottle', 640, 640), label: 'In use' }
];
const phoneVideo = video('/ai-video-generation/bathroom-review-moisturizer-p10.mp4', img(`${REF}/bathroom-review-moisturizer-ref--640.webp`, 'AI presenter reviewing a moisturizer jar in a bathroom', 640, 1138));
const formula = {
  actor: img(`${ACTORS}/sofia-640.webp`, 'AI actor Sofia, a sporty blonde presenter in a gym', 640, 1138),
  product: img('/ai-image-generation/q16-wellness-mat-source-640.webp', 'Teal yoga mat product photo on a plain background', 640, 640),
  video: video('/ai-video-generation/gym-pre-workout-greeting-p10.mp4', img(`${ACTORS}/sofia-640.webp`, 'AI actor Sofia presenting a teal yoga mat in a gym', 640, 1138)),
  actorLabel: 'AI actor · Sofia',
  productLabel: 'Your product · Yoga mat',
  videoLabel: 'Your video · 0:15',
  hint: 'Same presenter, same product — assembled into one cut.'
};
const imageToVideo = {
  source: img('/ai-image-generation/im01-video-hub-balm-r1-640.webp', 'Peachy tinted balm product photo on a marble vanity', 640, 640),
  video: video('/ai-video-generation/tinted-balm-vanity-reel-p10.mp4', img(`${REF}/tinted-balm-vanity-reel-ref--640.webp`, 'Model picking up the peachy tinted balm from the vanity', 640, 1138)),
  sourceLabel: 'Product photo',
  videoLabel: 'Generated motion',
  promptTyping: 'She picks it up and takes one swipe — naturally flushed lips'
};
const twinPair = {
  source: img(`${ACTORS}/dev-640.webp`, 'Your photo: a portrait of Dev, an AI presenter', 640, 1138),
  result: video('/ai-video-generation/home-sofa-welcome-p10.mp4', img(`${ACTORS}/dev-640.webp`, 'AI twin of Dev talking on a sofa at home', 640, 1138)),
  hint: 'Same face, same voice — your twin is ready to film.'
};
const actorWall = {
  rows: [
    [
      { image: img(`${ACTORS}/ari-640.webp`, 'AI actor Ari in an entryway', 640, 1138), name: 'Ari', role: 'Entryway', video: '/ai-video-generation/indoor-entryway-greeting-p10.mp4' },
      { image: img(`${ACTORS}/nisha-640.webp`, 'AI actor Nisha in an office', 640, 1138), name: 'Nisha', role: 'Office', video: '/ai-video-generation/office-workday-update-p10.mp4' },
      { image: img(`${ACTORS}/lola-640.webp`, 'AI actor Lola on a beach boardwalk', 640, 1138), name: 'Lola', role: 'Beach', video: '/ai-video-generation/beach-boardwalk-update-p10.mp4' },
      { image: img(`${ACTORS}/mara-640.webp`, 'AI actor Mara in a kitchen', 640, 1138), name: 'Mara', role: 'Kitchen', video: '/ai-video-generation/kitchen-counter-chat-p10.mp4' },
      { image: img(`${ACTORS}/yara-640.webp`, 'AI actor Yara at a café counter', 640, 1138), name: 'Yara', role: 'Café', video: '/ai-video-generation/cafe-counter-introduction-p10.mp4' },
      { image: img(`${ACTORS}/jon-640.webp`, 'AI actor Jon on an outdoor walkway', 640, 1138), name: 'Jon', role: 'Outdoors', video: '/ai-video-generation/outdoor-walkway-update-p10.mp4' },
      { image: img(`${ACTORS}/elena-640.webp`, 'AI actor Elena at a home desk', 640, 1138), name: 'Elena', role: 'Home desk', video: '/ai-video-generation/home-table-explanation-p10.mp4' },
      { image: img(`${ACTORS}/tess-640.webp`, 'AI actor Tess at a café window seat', 640, 1138), name: 'Tess', role: 'Café seat', video: '/ai-video-generation/cafe-window-seat-chat-p10.mp4' }
    ],
    [
      { image: img(`${ACTORS}/ravi-640.webp`, 'AI actor Ravi in a studio', 640, 1138), name: 'Ravi', role: 'Studio', video: '/ai-video-generation/studio-creator-intro-p10.mp4' },
      { image: img(`${ACTORS}/tara-640.webp`, 'AI actor Tara at a poolside', 640, 1138), name: 'Tara', role: 'Poolside', video: '/ai-video-generation/pool-poolside-greeting-p10.mp4' },
      { image: img(`${ACTORS}/tessa-640.webp`, 'AI actor Tessa on a balcony', 640, 1138), name: 'Tessa', role: 'Balcony', video: '/ai-video-generation/balcony-railing-greeting-p10.mp4' },
      { image: img(`${ACTORS}/anika-640.webp`, 'AI actor Anika cuddling a cat', 640, 1138), name: 'Anika', role: 'With pet', video: '/ai-video-generation/pet-cat-cuddle-chat-p10.mp4' },
      { image: img(`${ACTORS}/anjali-640.webp`, 'AI actor Anjali doing yoga', 640, 1138), name: 'Anjali', role: 'Yoga', video: '/ai-video-generation/yoga-breathing-introduction-p10.mp4' },
      { image: img(`${ACTORS}/caleb-640.webp`, 'AI actor Caleb sharing a fitness tip', 640, 1138), name: 'Caleb', role: 'Fitness', video: '/ai-video-generation/fitness-recovery-tip-p10.mp4' },
      { image: img(`${ACTORS}/damon-640.webp`, 'AI actor Damon on a sports court', 640, 1138), name: 'Damon', role: 'Sports', video: '/ai-video-generation/sports-racket-court-tip-p10.mp4' },
      { image: img(`${ACTORS}/elise-640.webp`, 'AI actor Elise on a rooftop terrace', 640, 1138), name: 'Elise', role: 'Rooftop', video: '/ai-video-generation/terrace-rooftop-greeting-p10.mp4' },
      { image: img(`${ACTORS}/jade-640.webp`, 'AI actor Jade in the passenger seat of a car', 640, 1138), name: 'Jade', role: 'In car', video: '/ai-video-generation/car-passenger-seat-chat-p10.mp4' },
      { image: img(`${ACTORS}/luis-640.webp`, 'AI actor Luis at a garage storage shelf', 640, 1138), name: 'Luis', role: 'Garage', video: '/ai-video-generation/garage-storage-shelf-update-p10.mp4' }
    ]
  ]
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
    const d = next.sections.v2_main.settings.data;
    const demo = d.brandToolsDemo;
    assert.ok(demo, 'brandToolsDemo missing');
    assert.equal(d.benefits.length, 6);
    const descriptions = [
      'Paste a product URL — AI imports the photos and details for you, then turns them into a ready-to-post video ad.',
      'Type one sentence about your product. AI writes the script and scenes, and turns it into an editable video brief.',
      'Pick an AI actor, add your product photo — AI puts the two together into a complete product video you can post.',
      'Upload one product photo and add a short prompt — watch the photo come alive as a moving product clip.',
      'Pick a lifelike AI presenter in any scene — café, gym, beach — to introduce your product and read your script on camera.',
      'Create an AI twin of yourself from one photo — the same face and voice, ready to present your products without filming.'
    ];
    const v3Demo = {
      ...demo,
      version: 3,
      labels: { ...demo.labels, importNoteShort: 'review the photos from the import', importStatus: 'Description parsed · ready to brief', promptValue: 'Give this moisturizer a 15-second review.' },
      urlTyping: 'yourstore.com/products/canvas-tote',
      importTitle: 'Canvas tote bag',
      importCount: '3 found',
      importGallery,
      ideaTyping: 'Give this moisturizer a 15-second review.',
      phoneVideo,
      formula,
      imageToVideo,
      actorWall,
      twinPair
    };
    const fields = [
      ['benefitsLead', 'Start from a product URL, one sentence, or a single product photo — build your next AI UGC video ad in one workspace.'],
      ['benefits', d.benefits.map((item, index) => ({ ...item, d: descriptions[index] }))],
      ['brandToolsDemo', v3Demo]
    ];
    const operations = [];
    for (const [field, value] of fields) {
      const previousValue = d[field];
      if (hash(previousValue) === hash(value)) continue;
      operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/sections/v2_main/settings/data/${field}`, baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value });
      d[field] = value;
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
    return { ok: true, target: 'production', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), derivedState: { relation: relation.relation, record: derived }, protectedBefore, protectedAfter, operations, historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-home-tools-v3-20261103';
  await fsPromises.mkdir(out, { recursive: true });
  await fsPromises.writeFile(`${out}/production-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
