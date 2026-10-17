#!/usr/bin/env node
// Field-level current-data edits only. This command cannot target production.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertDatabaseTarget, assertAllowedSite } from './lib/database-target.mjs';
import { aidreamcapesBreadcrumbs } from './lib/aidreamcapes-breadcrumb-taxonomy.mjs';

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
const siteId = assertAllowedSite('site_aidreamcapes');
const apply = process.argv.includes('--apply-local');
const out = 'releases/aidreamcapes-workflow-integrated-local-20261017';
const stable = x => Array.isArray(x) ? x.map(stable) : x && typeof x === 'object' ? Object.fromEntries(Object.keys(x).sort().map(k => [k, stable(x[k])])) : x;
const hash = x => crypto.createHash('sha256').update(JSON.stringify(stable(x ?? null))).digest('hex');
const prefix = '/sections/v2_main/settings/data';
const db = new PrismaClient();
try {
  const report = await db.$transaction(async tx => {
    const protectedRows = () => tx.livePage.findMany({ where: { siteId: { not: siteId } }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const pages = await tx.livePage.findMany({ where: { siteId }, orderBy: { id: 'asc' } });
    const operations = [], revisions = [];
    for (const row of pages) {
      const next = structuredClone(row.contentJson);
      const d = next.sections?.v2_main?.settings?.data;
      if (!d) continue;
      const patch = (path, value) => {
        const keys = path.slice(1).split('/');
        const parent = keys.slice(0, -1).reduce((x, k) => x[k], next);
        const key = keys.at(-1), before = parent[key];
        if (hash(before) === hash(value)) return;
        operations.push({ entityType: 'live_page', id: row.id, field: 'contentJson', path, baseHash: hash(before), previousValue: before ?? null, value });
        parent[key] = value;
      };
      if (d.breadcrumbs?.length) {
        const crumbs = aidreamcapesBreadcrumbs(row.slug, d.breadcrumbs);
        patch(`${prefix}/breadcrumbs`, crumbs);
        for (const [index, node] of (next.seo?.jsonLd?.['@graph'] ?? []).entries()) {
          if (node['@type'] === 'BreadcrumbList') patch(`/seo/jsonLd/@graph/${index}/itemListElement`, crumbs.map((crumb, i) => ({ '@type': 'ListItem', position: i + 1, name: crumb.label, item: `https://www.aivideosugc.com${crumb.href}` })));
        }
      }
      if (row.slug === '/') {
        assert.equal(row.id, 'site_aidreamcapes_home');
        const workflow = d.more_sections[0];
        assert.equal(workflow.items.length, 6);
        const heroIndex = d.homeExperience.blocks.findIndex(b => b.after === 'hero');
        assert(heroIndex >= 0);
        patch(`${prefix}/homeExperience/blocks/${heroIndex}/actions`, {
          ...d.homeExperience.blocks[heroIndex].actions,
          anchorProductPhoto: '#home-seller-examples',
          anchorScenes: '#home-product-scenes',
          anchorPresenters: '#home-experience-steps-title',
          anchorFormats: '#home-ai-ugc',
          anchorPathProduct: '#home-product-image-steps',
          anchorPathScene: '#home-experience-picker',
          anchorPathStoryboard: '#home-experience-features',
          anchorPathReview: '#home-product-image-steps'
        });
        patch(`${prefix}/stepsH2`, 'Create Product Images in Three Steps');
        const blockIndex = d.homeExperience.blocks.findIndex(b => b.after === 'audience');
        assert(blockIndex >= 0);
        const titles = ['Add your product', 'Choose a scene & presenter', 'Shape your video brief', 'Save & refine the storyboard', 'Generate & assemble shots', 'Review & download'];
        const descriptions = [
          'Upload a product photo or import a public product URL. Review the photos and details you want to use.',
          'Choose a scene and an AI presenter when your video needs someone to introduce or demonstrate the product.',
          'Describe your product, audience and creative idea. Choose the tone, format and available video length.',
          'Save an editable draft to your Library. Review each shot, visual and line before generating.',
          'Check the credit estimate, generate selected shots and compare versions. Arrange your chosen clips into a video.',
          'Preview the complete video and check the product details and voiceover. Download it for ads, social media or your product page.'
        ];
        patch(`${prefix}/more_sections/0/eyebrow`, 'HOW IT WORKS');
        patch(`${prefix}/more_sections/0/h2`, 'From your product to a finished AI video');
        patch(`${prefix}/more_sections/0/lead`, 'Six clear steps. One editable workflow, from your product details to the final video.');
        titles.forEach((t, i) => { patch(`${prefix}/more_sections/0/items/${i}/t`, t); patch(`${prefix}/more_sections/0/items/${i}/d`, descriptions[i]); });
        patch(`${prefix}/homeExperience/blocks/${blockIndex}/presentation/workflowDemo`, {
          version: 1,
          labels: {
            enlarge: 'Enlarge example', upload: 'Upload photo', import: 'Import URL', product: 'Example product', details: 'Product details',
            uploadHref: '/app/create?view=home', importHref: '/app/create?view=product&tool=url-to-video', libraryHref: '/app/create?view=library', startHref: '/app/create?view=home', reviewHref: '/app/create?view=library&filter=completed',
            scene: 'Product scene', choosePresenter: 'Choose an example presenter', agent: 'AI Video Agent', briefLabel: 'Your video idea', prompt: 'Introduce this serum with a calm product demonstration.', format: 'Video format', length: 'Video length', continue: 'Continue with my brief in the workspace',
            draftPreview: 'Editable draft preview', openLibrary: 'Open my Library', compare: 'Compare versions', versionOne: 'Version 1', versionTwo: 'Version 2',
            previewSequence: 'Preview the example shot sequence', sequenceLabel: 'Example shot sequence', finalPreview: 'Review your final video', reviewNote: 'Check every detail before downloading.', reviewInWorkspace: 'Open my videos',
            notice: 'Use your own product details and review the result before publishing.', start: 'Start my video', close: 'Close preview', play: 'Play sequence', pause: 'Pause sequence', sequenceNotice: 'This sequence illustrates how the shots fit together. Create and review your own video in the workspace.'
          },
          scenes: [{ id: 'product-host', label: 'Product host', media: 'm02' }, { id: 'at-home', label: 'At home', media: 'm08' }, { id: 'at-work', label: 'At work', media: 'm09' }],
          shots: [{ label: 'Shot 01', media: 'm01', description: 'Show the product clearly, including the bottle and packaging.' }, { label: 'Shot 02', media: 'm02', description: 'Introduce the product with a presenter and your approved script.' }, { label: 'Shot 03', media: 'm01', description: 'Return to the product details and give viewers a clear next step.' }],
          aspects: ['9:16', '1:1', '16:9'], durations: [{ value: '15', label: '15s' }, { value: '10', label: '10s' }]
        });
        // A new, explicit edit against current fields, never a historical page import.
        patch(`${prefix}/trust/lead`, 'Choose your presenter, prepare your message and review the result before you publish.');
        const trust = [
          ['Find the Right AI Presenter', 'Explore AI presenters and choose a profile that fits your product and audience. Review the available voice and language options before creating.'],
          ['Speak to Your Audience', 'Write your product message and select a supported language and voice. Preview the result to check the delivery before using it in your campaign.'],
          ['Help With Accounts, Billing and Exports', 'Need help with your account, billing or an export? Email [support@aivideosugc.com](mailto:support@aivideosugc.com) with the page link, file name and a short description of the issue.'],
          ['Choose a Format for Your Channel', 'Create videos in supported formats such as 9:16, 1:1 and 16:9. Check the available aspect ratios for your selected video or image workflow, then review the output before posting.'],
          ['Review Before You Download', 'Open the completed video in your Library. Check the product details, visuals and voiceover, then download the file for your product page or social channels.'],
          ['Keep Your Product Story Consistent', 'Use your own product photos and approved messages throughout the brief and storyboard. Review each shot to keep the final video aligned with your brand.']
        ];
        trust.forEach(([t, description], i) => { patch(`${prefix}/trust/items/${i}/t`, t); patch(`${prefix}/trust/items/${i}/d`, description); });
        assert.deepEqual(next.seo, row.contentJson.seo, 'Homepage approved TDK and schema unchanged');
        assert.deepEqual(d.blockOrder, row.contentJson.sections.v2_main.settings.data.blockOrder, 'Keep the requested local section order');
      }
      assert.deepEqual(next.mediaManifest, row.contentJson.mediaManifest);
      const changed = hash(row.contentJson) !== hash(next);
      if (!changed) continue;
      if (apply) {
        const result = await tx.livePage.updateMany({ where: { id: row.id, siteId, updatedAt: row.updatedAt }, data: { contentJson: next } });
        assert.equal(result.count, 1, 'Concurrent edit detected; re-plan');
        const readback = await tx.livePage.findFirstOrThrow({ where: { id: row.id, siteId } });
        assert.equal(hash(readback.contentJson), hash(next));
      }
      revisions.push({ id: row.id, slug: row.slug, before: hash(row.contentJson), after: hash(next) });
    }
    const protectedAfter = hash(await protectedRows());
    assert.equal(protectedBefore, protectedAfter);
    const [derived] = await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
    return { ok: true, siteId, target: 'local', apply, owner: 'LivePage.contentJson', operations, revisions, protectedBefore, protectedAfter, derivedState: derived, historicalStateActivated: false };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(`${out}/${apply ? 'local-apply' : 'local-plan'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, operations: report.operations.length }, null, 2));
} finally { await db.$disconnect(); }
