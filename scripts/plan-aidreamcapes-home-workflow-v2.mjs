#!/usr/bin/env node
// Plans the field-level manifest for the Aidreamcapes homepage "How it works"
// workflow module release (workflow demo v2).
//
// Read-only: reads the current relational LivePage row for site_aidreamcapes
// slug "/" and emits a JSON-pointer manifest whose per-op `baseHash` pins the
// reviewed before state. The manifest is applied by
// scripts/apply-aidreamcapes-home-release-content.mjs, which re-verifies every
// baseHash inside a serializable transaction (online edits win) and only then
// writes the reviewed fields.
//
// Usage: node --env-file=<env> scripts/plan-aidreamcapes-home-workflow-v2.mjs \
//          --target=production --commit=<deployed 40-char sha> --out=<manifest path>
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
const args = process.argv.slice(2);
const value = key => args.find(arg => arg.startsWith(key + '='))?.slice(key.length + 1);
assertDatabaseTarget({ expectedTarget: 'production' });
const commit = value('--commit');
assert(/^[a-f0-9]{40}$/.test(commit || ''), 'Supply --commit=<40-character deployed sha>');
const out = value('--out');
assert(out, 'Supply --out=<manifest path>');

const db = new PrismaClient();
const row = await db.livePage.findFirst({ where: { id: 'site_aidreamcapes_home', siteId: 'site_aidreamcapes' } });
assert(row, 'site_aidreamcapes_home LivePage row is required');
const data = row.contentJson?.sections?.v2_main?.settings?.data;
assert(data?.more_sections?.[0]?.items?.length === 6, 'Current workflow section shape changed; re-plan');
const homeExperience = data.homeExperience;
const demo = homeExperience?.blocks?.find(block => block.presentation?.workflowDemo)?.presentation?.workflowDemo;
assert(demo, 'workflowDemo is required');
assert(demo.version === 1 && demo.shots.length === 3 && demo.scenes.length === 3, 'workflowDemo must be at reviewed v1 shape; re-plan');

const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const hash = v => crypto.createHash('sha256').update(v === undefined ? '<undefined>' : JSON.stringify(stable(v))).digest('hex');
const parts = path => path.split('/').slice(1).map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
const get = (object, path) => parts(path).reduce((v, k) => v?.[k], object);

const base = '/sections/v2_main/settings/data';
const operations = [];
const op = (path, next) => operations.push({
  entityType: 'live_page',
  id: 'site_aidreamcapes_home',
  field: 'contentJson',
  path,
  baseHash: hash(get(row.contentJson, path)),
  value: next
});

// 1. Section lead + six step descriptions + step 05 title (SEO rewrite, public copy only).
op(`${base}/more_sections/0/lead`, 'Add your product, choose an AI presenter and approve the storyboard — then download a finished product video, ready for ads and social media.');
op(`${base}/more_sections/0/items/0/d`, 'Start from one product photo or paste your product page URL. The workspace reads the photos and details for you — confirm them before anything is generated.');
op(`${base}/more_sections/0/items/1/d`, 'Choose where the video takes place and who presents it. Pick an AI presenter, preview the voice, and the scene is set up around your product automatically.');
op(`${base}/more_sections/0/items/2/d`, 'Write one short brief — what you sell, who it is for, and your idea. Pick a video format (9:16, 1:1 or 16:9) and length, then check the credit estimate before you generate.');
op(`${base}/more_sections/0/items/3/d`, 'The storyboard splits your idea into shots — product photo, presenter and dialogue for each one. Edit any line, save the draft to your Library, and approve it when it looks right.');
op(`${base}/more_sections/0/items/4/t`, 'Wait for your video to generate');
op(`${base}/more_sections/0/items/4/d`, 'Generate every shot and follow the progress here or in your Library. You can close the page while the clips render and come back when they are ready.');
op(`${base}/more_sections/0/items/5/d`, 'Watch the finished video with captions, check the product and the voiceover, then download it — or export the script and single clips — ready for ads, social media and your product page.');

// 2. New page-owned media index entry: candle product photo (step 01/04/06 thread).
assert(homeExperience.media.m01 && homeExperience.media.m07 && !homeExperience.media.m18, 'Media index changed; re-plan');
op(`${base}/homeExperience/media/m18`, {
  src: '/ai-image-generation/teams1-home-r2-src-640.webp',
  alt: 'A scented candle in the original product photo',
  width: 640,
  height: 640
});

// 3. New page-owned example video entry for step 06 (real finished customer-style clip).
assert(homeExperience.videos && !homeExperience.videos.workflowExample, 'videos index changed; re-plan');
op(`${base}/homeExperience/videos/workflowExample`, {
  src: '/ai-video-generation/living-room-sofa-check-in.mp4',
  previewSrc: '/ai-video-generation/living-room-sofa-check-in-p10.mp4',
  width: 540,
  height: 960,
  duration: 10,
  name: 'Home: Sofa Check-In',
  poster: {
    src: '/ai-image-generation/teams1-home-r2-ad-640.webp',
    alt: 'Example of a presenter showing a scented candle at home',
    width: 640,
    height: 960
  }
});

// 4. workflowDemo v2: candle thread, draft sheet, generation state and example video reference.
op(`${base}/homeExperience/blocks/${homeExperience.blocks.findIndex(block => block.presentation?.workflowDemo)}/presentation/workflowDemo/version`, 2);
const demoBase = `${base}/homeExperience/blocks/${homeExperience.blocks.findIndex(block => block.presentation?.workflowDemo)}/presentation/workflowDemo`;
op(`${demoBase}/video`, 'workflowExample');
op(`${demoBase}/defaultDuration`, '15');
op(`${demoBase}/shots/0/media`, 'm18');
op(`${demoBase}/shots/0/description`, 'Show the candle clearly, including the glass jar and the wooden lid.');
op(`${demoBase}/shots/1/media`, 'm07');
op(`${demoBase}/shots/2/media`, 'm18');
op(`${demoBase}/scenes/0/media`, 'm07');
op(`${demoBase}/durations`, [
  { value: '10', label: '10s' },
  { value: '15', label: '15s' },
  { value: '30', label: '30s' }
]);

// 5. Labels: candle brief, saved-draft state, generation states and new v2 strings.
assert(demo.labels.draftPreview === 'Editable draft preview', 'label draftPreview changed; re-plan');
op(`${demoBase}/labels/prompt`, 'Introduce this candle in a cozy evening scene.');
op(`${demoBase}/labels/notice`, 'Your draft is saved to the Library, and finished videos are kept for 15 days — download the ones you want to keep.');
op(`${demoBase}/labels/draftPreview`, 'All changes saved');
for (const [key, label] of Object.entries({
  optimize: 'Optimize',
  optimizeNote: 'Optimize the prompt in the workspace',
  productRef: 'Product',
  presenterRef: 'Presenter',
  dialogue: 'Dialogue',
  dialogueText: 'Hand-poured soy wax with up to 40 hours of burn time.',
  genReady: '✓ Ready',
  genWorking: 'Generating',
  genQueued: 'Queued',
  genProgress: 'Generating your video — 1 of 3 shots ready',
  genNote: 'You can close the page — follow the progress in your Library.',
  videoLabel: 'Real example video'
})) {
  assert(demo.labels[key] === undefined, `label ${key} already exists; re-plan`);
  op(`${demoBase}/labels/${key}`, label);
}

const manifest = {
  siteId: 'site_aidreamcapes',
  target: 'production',
  codeCommit: commit,
  kind: 'homepage workflow module v2: section copy, workflow demo v2 (draft sheet, generation state, real example video)',
  operations
};
fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
console.log(`planned ${operations.length} operations for site_aidreamcapes_home (contentJson) -> ${out}`);
console.log('paths:');
for (const operation of operations) console.log(' ', operation.path, operation.baseHash.slice(0, 10));
await db.$disconnect();
