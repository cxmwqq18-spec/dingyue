#!/usr/bin/env node
// v3 scene module: six mainstream-category product video scenes (Wan 3.0 batch).
// Two writes against the homepage LivePage (site_aidreamcapes_home):
//   1. sections.v2_main.settings.data.examples.groups — six ownership cards that
//      publish the /ai-video-generation/<publicSlug> detail pages (hidden: the
//      homepage blockOrder renders no examples block).
//   2. sections.v2_main.settings.data.homeExperience — picker block gains
//      sceneCardsV3 + sceneTabsV3 (motion scene cards + category pills).
// Local DB by default; dry run unless --apply-local.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertAllowedSite, assertDatabaseTarget } from './lib/database-target.mjs';

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
const siteId = assertAllowedSite('site_aidreamcapes');
const pageId = 'site_aidreamcapes_home';
const applying = process.argv.includes('--apply-local');
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const db = new PrismaClient();

const V = '/ai-video-generation';
const I = '/ai-image-generation';
const scenes = [
  {
    slug: 'pink-serum-dropper-routine', group: '04 化妆品', category: 'beauty', industry: 'ind-beauty-skincare',
    title: 'Pink Serum Dropper · Vanity Routine',
    alt: 'Pink glass serum dropper bottle and cream jar on a marble vanity',
    prompt: 'Wan 3.0; 30s; 9:16; sound on; product/vanity + identity reference, non-first-frame mode. Soft natural skincare demo on a sunlit vanity: a pink glass dropper bottle beside a pink cream jar. The presenter explains the dropper format ("A dropper lets you apply this serum a little at a time"), draws one drop onto her fingertip, presses it gently onto her cheek, and closes with a routine recommendation. Lip-synced natural English female voice; hand and skin close-ups stay silent; no background music.'
  },
  {
    slug: 'matcha-whisk-morning-ugc', group: '07 食品 UGC', category: 'food', industry: 'ind-food-drinks',
    title: 'Matcha Whisk · Home Café UGC',
    alt: 'Matcha tin, whisk and a glass bowl on a bright kitchen counter',
    prompt: 'Wan 3.0; 30s; 9:16; sound on; phone-shot UGC framing, product + identity reference, non-first-frame mode. Bright home kitchen: matcha tin, bowl, bamboo whisk and milk. She walks through a homemade matcha drink — start with matcha and water, whisk, then combine with milk — with hard-cut omissions for tool handling ("For a matcha drink at home, start with matcha and water"). Lip-synced natural English female voice; realistic UGC texture; no added branding.'
  },
  {
    slug: 'phone-stand-speaker-desk', group: '01 电子产品', category: 'tech', industry: 'ind-electronics',
    title: 'Phone Stand Speaker · Desk Demo',
    alt: 'Metal phone stand with built-in round speaker and glowing light ring on a desk',
    prompt: 'Wan 3.0; 30s; 9:16; sound on; product + identity reference, non-first-frame mode. Real desk e-commerce ad for a phone stand with built-in speaker: she places the phone into the cradle ("The cradle keeps your phone upright, and the built-in speaker plays your audio"), the speaker plays a prepared sample clip, and the light ring holds a steady glow. Lip-synced natural English female voice; contact sounds only in close-ups; no background music.'
  },
  {
    slug: 'pickleball-paddle-intro', group: '03 运动装备', category: 'sports', industry: 'sports',
    title: 'Pickleball Paddle · Court Introduction',
    alt: 'Pickleball paddles and bright yellow perforated balls on an outdoor court',
    prompt: 'Wan 3.0; 30s; 9:16; sound on; court/product + two identity references, non-first-frame mode. Outdoor pickleball court in natural daylight: she introduces the paddle ("Check the grip, paddle face, and bright perforated ball before you play"), points out the grip and face pattern, then returns one slow practice ball with a single controlled swing. Lip-synced natural English female voice; one real hit sound; no background music.'
  },
  {
    slug: 'berry-citrus-iced-drink', group: '08 饮品广告', category: 'food', industry: 'ind-food-drinks',
    title: 'Berry Citrus Drink · Iced Pour',
    alt: 'Clear cup of iced berry and citrus drink with a straw on a bright bar counter',
    prompt: 'Wan 3.0; 30s; 9:16; sound on; finished-drink + identity reference, non-first-frame mode. Bright bar counter: a clear cup of berry and citrus iced drink with condensation ("A chilled fruit drink with citrus, berries, and ice, ready to serve"). The camera glides along the cup wall past orange slices, berries and ice, then she lifts the cup to show it upright to the camera. Lip-synced natural English female voice; light ice sounds only; no background music.'
  },
  {
    slug: 'white-laceup-sneaker-styling', group: '11 白色系带休闲鞋', category: 'shoes', industry: 'ind-shoes',
    title: 'White Sneaker · Denim Pairing',
    alt: 'White low-top lace-up sneaker held at a sunlit doorstep',
    prompt: 'Wan 3.0; 30s; 9:16; sound on; product + identity reference, non-first-frame mode. Sunlit doorstep: a white low-top lace-up sneaker shown in hand ("A simple white sneaker pairs easily with a casual denim outfit") — rotating to show the upper, stitching and lace structure, then worn for a few natural steps. Purchase reasons stay on the clean white look and denim pairing. Lip-synced natural English female voice; no background music.'
  }
];
const imageDims = {
  'pink-serum-dropper-routine': [720, 960],
  'matcha-whisk-morning-ugc': [720, 960],
  'green-label-supplement-bottle': [720, 720],
  'phone-stand-speaker-desk': [720, 960],
  'pickleball-paddle-intro': [720, 960],
  'berry-citrus-iced-drink': [720, 960],
  'white-laceup-sneaker-styling': [720, 720]
};
const tabLabels = [
  ['all', 'All'],
  ['beauty', 'Beauty & personal care'],
  ['food', 'Food & beverage'],
  ['tech', 'Tech & electronics'],
  ['sports', 'Sports & fitness'],
  ['shoes', 'Shoes']
];

try {
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const row = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId, slug: '/' } });
    const next = structuredClone(row.contentJson);
    const d = next.sections.v2_main.settings.data;
    const experience = d.homeExperience;
    assert.ok(experience, 'homeExperience missing');
    const picker = experience.blocks.find(block => block.after === 'picker');
    assert.ok(picker, 'picker block missing');
    for (const scene of scenes) {
      const [w, h] = imageDims[scene.slug];
      assert.ok(fsSync.existsSync(`public${I}/${scene.slug}-product.jpg`), `missing product image for ${scene.slug}`);
      assert.ok(fsSync.existsSync(`public${V}/${scene.slug}.mp4`), `missing video for ${scene.slug}`);
      assert.ok(fsSync.existsSync(`public${V}/${scene.slug}-p10.mp4`), `missing preview for ${scene.slug}`);
    }
    const ownershipCards = scenes.map(scene => {
      const [w, h] = imageDims[scene.slug];
      return {
        key: `scene-${scene.slug}`,
        title: scene.title,
        product: scene.title.split(' · ')[0],
        kind: 'video',
        publicSlug: scene.slug,
        industries: [scene.industry],
        aspect: '9:16',
        duration: 30,
        image: { src: `${I}/${scene.slug}-product.jpg`, alt: scene.alt, w, h },
        video: {
          src: `${V}/${scene.slug}.mp4`,
          previewSrc: `${V}/${scene.slug}-p10.mp4`,
          poster: { src: `${I}/${scene.slug}-product.jpg`, alt: scene.alt },
          width: 720, height: 1280
        },
        prompt: scene.prompt,
        referenceImages: [{ src: `${I}/${scene.slug}-product.jpg`, alt: `Reference product photo — ${scene.alt}` }]
      };
    });
    const sceneCardsV3 = scenes.map(scene => ({
      key: scene.slug,
      title: scene.title,
      category: scene.category,
      publicSlug: scene.slug,
      image: { src: `${I}/${scene.slug}-product.jpg`, alt: scene.alt },
      video: { src: `${V}/${scene.slug}-p10.mp4`, poster: { src: `${I}/${scene.slug}-product.jpg`, alt: scene.alt } },
      detailHref: `/ai-video-generation/${scene.slug}`
    }));
    const fields = [
      ['examples', (() => {
        const previous = d.examples && Array.isArray(d.examples.groups) ? d.examples : { groups: [] };
        const groups = previous.groups.filter(group => group.label !== 'Mainstream product scenes (Wan 3.0)');
        groups.push({ label: 'Mainstream product scenes (Wan 3.0)', items: ownershipCards });
        return { ...previous, groups };
      })()],
      ['homeExperience', (() => {
        const cloned = structuredClone(experience);
        const pickerClone = cloned.blocks.find(block => block.after === 'picker');
        assert.ok(pickerClone, 'picker block missing in clone');
        pickerClone.presentation = { ...(pickerClone.presentation ?? {}), sceneCardsV3, sceneTabsV3: tabLabels.map(([key, label]) => ({ key, label })) };
        return cloned;
      })()]
    ];
    const operations = [];
    for (const [field, value] of fields) {
      const previousValue = d[field];
      if (hash(previousValue) === hash(value)) continue;
      operations.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path: `/sections/v2_main/settings/data/${field}`, baseHash: hash(previousValue), ...(previousValue === undefined ? {} : { previousValue }), value });
      d[field] = value;
    }
    assert.deepEqual(next.seo, row.contentJson.seo);
    if (applying && operations.length) {
      const result = await tx.livePage.updateMany({ where: { siteId, id: pageId, updatedAt: row.updatedAt }, data: { contentJson: next } });
      assert.equal(result.count, 1);
      const readback = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId } });
      assert.equal(hash(readback.contentJson), hash(next));
    }
    const protectedAfter = hash(await protectedRows());
    assert.equal(protectedBefore, protectedAfter);
    return { ok: true, target: 'local', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), protectedBefore, protectedAfter, operations, slugs: scenes.map(scene => `/ai-video-generation/${scene.slug}`) };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-scenes-v3-20261104';
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/local-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
