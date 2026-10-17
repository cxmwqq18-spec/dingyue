#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
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
    const m = d.homeExperience.media;
    assert.equal(d.benefits.length, 6);
    const descriptions = [
      'Import product details and photos from a public URL. Shape them into your next video ad.',
      'Describe your product, scene and message. Turn your idea into an editable video brief.',
      'Build product videos with AI scenes and presenters. Refine your storyboard and assemble the shots you choose.',
      'Start with a product photo. Add a prompt to guide the scene and movement.',
      'Choose an AI presenter to introduce your product and deliver your script.',
      'Explore a consistent digital presenter for your product stories and recurring campaigns.'
    ];
    const ids = ['url', 'text', 'video', 'image', 'avatar', 'twin'];
    const demo = {
      version: 2,
      labels: {
        enlarge: 'Enlarge preview', previewTitle: 'Explore the example', close: 'Close preview',
        urlExample: 'yourstore.com/product', previewImport: 'Preview URL import', importExample: 'Try the import example', reviewProduct: 'Review product',
        importNote: 'This sample shows the photos and details you can review after an import.',
        promptLabel: 'Your video idea', promptValue: 'Create a 15-second video for this serum.', promptPlaceholder: 'Describe your product and the story you want to tell.',
        previewBrief: 'Preview my brief', modeLabel: 'Choose a creation mode', productLabel: 'Product', avatarLabel: 'Presenter', formatLabel: 'Video format', durationLabel: 'Video length',
        sampleProduct: 'Example product. Add your own photos in the workspace.', samplePresenter: 'Example presenter. Browse available hosts in the workspace.',
        exampleLabel: 'Motion preview', playMotion: 'Play motion preview', pauseMotion: 'Pause motion preview',
        storyboardLabel: 'Storyboard preview', playStoryboard: 'Play storyboard sequence', pauseStoryboard: 'Pause storyboard sequence', storyDuration: '0:15',
        photoLabel: 'Product photo', motionLabel: 'Presenter visual', choosePresenter: 'Choose an example presenter', scriptLabel: 'Your presenter script',
        scriptValue: 'Here is a closer look at our serum, the bottle and the details worth knowing.', previewPresenter: 'Preview the selected presenter and script',
        conceptBadge: 'Preview', twinSource: 'Your photo', twinResult: 'AI Twin concept', compareLabel: 'Drag to compare', previewConcept: 'Explore the Twin concept',
        previewNotice: 'Interactive examples. Open a tool to create with your own product.',
        briefTitle: 'Your video brief', briefNote: 'Review your idea here. Continue in the workspace to add your product and choose your creation settings.', continueLabel: 'Continue in workspace'
      },
      product: m.m01, presenter: m.m02, twin: d.benefits[5].img,
      shots: [{ id: 'product', label: 'Shot 01 · Product', image: m.m01 }, { id: 'presenter', label: 'Shot 02 · Presenter', image: m.m02 }, { id: 'details', label: 'Shot 03 · Details', image: { ...m.m01, alt: 'A closer view of the serum bottle and dropper' } }],
      actors: [{ id: 'product-host', label: 'Product host', image: m.m02 }, { id: 'home', label: 'At home', image: m.m08 }, { id: 'work', label: 'At work', image: m.m09 }, { id: 'outdoor', label: 'Outdoors', image: m.m10 }, { id: 'lifestyle', label: 'Lifestyle', image: m.m07 }],
      tabs: [{ value: 'home', label: 'AI Video Agent' }, { value: 'video', label: 'AI Video' }, { value: 'images', label: 'AI Image' }],
      aspects: [{ value: '9:16', label: '9:16' }, { value: '1:1', label: '1:1' }, { value: '16:9', label: '16:9' }],
      durations: [{ value: '15', label: '15s' }, { value: '10', label: '10s' }]
    };
    const fields = [
      ['benefitsEyebrow', 'AI VIDEO TOOLS'],
      ['benefitsH2', 'Everything you need to create AI UGC ads'],
      ['benefitsLead', 'Start with a URL, a prompt or a product photo. Create your next ad in one workspace.'],
      ['benefits', d.benefits.map((item, index) => ({ ...item, id: ids[index], d: descriptions[index] }))],
      ['brandToolsDemo', demo],
      ['blockOrder', ['hero', 'definition', 'picker', 'steps', 'benefits', 'features', 'reviews', 'audience', 'pricing', 'compare', 'trust', 'related', 'faq', 'cta']]
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
    assert.deepEqual(d.visual, row.contentJson.sections.v2_main.settings.data.visual);
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
    return { ok: true, target: 'local', siteId, pageId, owner: 'LivePage.contentJson', applying, sourceRevisionBefore: hash(row.contentJson), sourceRevisionAfter: hash(next), derivedState: { relation: relation.relation, record: derived }, protectedBefore, protectedAfter, operations, historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  const out = 'releases/aidreamcapes-home-tools-bento-20261017';
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/local-${applying ? 'apply' : 'plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.map(op => op.path) }, null, 2));
} finally { await db.$disconnect(); }
