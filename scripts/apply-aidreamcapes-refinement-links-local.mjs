#!/usr/bin/env node
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { PrismaClient } from '@prisma/client';
import { loadRuntimeEnv } from './load-runtime-env.mjs';
import { assertAllowedSite, assertDatabaseTarget, hasArgument } from './lib/database-target.mjs';

loadRuntimeEnv();
assertDatabaseTarget({ expectedTarget: 'local' });
const siteId = assertAllowedSite('site_aidreamcapes');
const apply = hasArgument('--apply-local');
const out = 'releases/aidreamcapes-refinements-20261017/links';
const db = new PrismaClient();
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
const hash = value => crypto.createHash('sha256').update(value === undefined ? '<undefined>' : JSON.stringify(stable(value))).digest('hex');
const pageId = 'site_aidreamcapes_home';

try {
  const report = await db.$transaction(async tx => {
    const site = await tx.site.findUniqueOrThrow({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.equal(site.slug, 'aidreamcapes');
    assert.match(site.primaryDomain, /aivideosugc\.com$/);

    const protectedRows = () => tx.livePage.findMany({ where: { siteId: 'site_dreamshoot' }, orderBy: { id: 'asc' }, select: { id: true, contentJson: true } });
    const protectedBefore = hash(await protectedRows());
    const page = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId, slug: '/' } });
    const nextPage = structuredClone(page.contentJson);
    const data = nextPage.sections.v2_main.settings.data;
    const pageOps = [];
    const setPage = (path, value) => {
      const keys = path.split('/').slice(1).map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'));
      let cursor = nextPage;
      for (const key of keys.slice(0, -1)) cursor = cursor[key];
      const key = keys.at(-1), previousValue = cursor[key];
      if (hash(previousValue) === hash(value)) return;
      pageOps.push({ entityType: 'live_page', id: pageId, field: 'contentJson', path, baseHash: hash(previousValue), previousValue, value });
      cursor[key] = value;
    };

    const textTool = data.benefits.find(item => item.id === 'text');
    const twinTool = data.benefits.find(item => item.id === 'twin');
    assert(textTool && twinTool, 'Expected current text and twin tool cards');
    setPage(`/sections/v2_main/settings/data/benefits/${data.benefits.findIndex(item => item.id === 'text')}/href`, '/text-to-video');
    setPage(`/sections/v2_main/settings/data/benefits/${data.benefits.findIndex(item => item.id === 'twin')}/href`, '/ai-twin');

    const blocks = data.homeExperience.blocks;
    const presenterBlock = blocks.find(block => block.after === 'steps');
    assert(presenterBlock, 'Expected current homepage presenter block');
    const presenterIndex = blocks.findIndex(block => block.after === 'steps');
    setPage(`/sections/v2_main/settings/data/homeExperience/blocks/${presenterIndex}/actions/main`, '/ai-actors');
    setPage(`/sections/v2_main/settings/data/homeExperience/blocks/${presenterIndex}/copy/t013`, 'Explore AI presenters →');
    setPage('/sections/v2_main/settings/data/stepsEyebrow', 'Image to Video');
    setPage('/sections/v2_main/settings/data/visual/picker/href', '/templates');
    setPage('/sections/v2_main/settings/data/visual/picker/button', 'Browse all templates');
    const settings = await tx.themeSettings.findUniqueOrThrow({ where: { siteId }, select: { siteId: true, draftJson: true, publishedJson: true, updatedAt: true } });
    const oldNavigation = settings.draftJson?.aidreamcapesV2Navigation;
    assert.equal(oldNavigation?.version, 2, 'Current Aidreamcapes navigation must be present');
    const nextSettings = structuredClone(settings.draftJson);
    const videoMenu = nextSettings.aidreamcapesV2Navigation.menus.find(menu => menu.label === 'Video');
    assert(videoMenu?.groups?.[0]?.items, 'Video menu group must exist');
    const items = videoMenu.groups[0].items;
    const existing = new Map(items.map(item => [item.href, item]));
    const textEntry = { label: 'Text to Video', href: '/text-to-video', description: 'Create a short video from a written scene prompt.', image: '/assets/sites/site_aidreamcapes/site-v2/guide/gen2guide-white-background-canvas-tote--640.webp' };
    const twinEntry = { label: 'AI Twin', href: '/ai-twin', description: 'Explore a consistent digital presenter for product stories and recurring campaigns.', image: '/assets/sites/site_aidreamcapes/site-v2/guide/teams1-home-aud5-r1--640.webp' };
    const menuEntries = [textEntry, twinEntry];
    for (const entry of menuEntries) {
      const old = existing.get(entry.href);
      if (old) Object.assign(old, entry);
      else items.push(entry);
    }
    const existingImage = items.find(item => item.label === 'Image to Video' && item.href === '/ai-video-generation/image-to-video');
    assert(existingImage, 'The current Image to Video menu entry must remain present');
    const settingsOps = hash(settings.draftJson) === hash(nextSettings) ? [] : [{ entityType: 'theme_settings', id: siteId, field: 'draftJson', path: '/aidreamcapesV2Navigation/menus', baseHash: hash(oldNavigation.menus), previousValue: oldNavigation.menus, value: nextSettings.aidreamcapesV2Navigation.menus }];

    assert.deepEqual(nextPage.seo, page.contentJson.seo);
    assert.deepEqual(nextPage.mediaManifest, page.contentJson.mediaManifest);
    const expectedVisual = structuredClone(page.contentJson.sections.v2_main.settings.data.visual);
    expectedVisual.picker.href = '/templates';
    expectedVisual.picker.button = 'Browse all templates';
    assert.deepEqual(nextPage.sections.v2_main.settings.data.visual, expectedVisual);
    const operations = [...pageOps, ...settingsOps];
    if (apply && operations.length) {
      if (pageOps.length) {
        const result = await tx.livePage.updateMany({ where: { siteId, id: pageId, slug: '/', updatedAt: page.updatedAt }, data: { contentJson: nextPage } });
        assert.equal(result.count, 1, 'Homepage changed during plan; re-run against current relational content');
      }
      if (settingsOps.length) {
        const changed = await tx.$executeRaw`UPDATE "ThemeSettings" SET "draftJson" = jsonb_set("draftJson"::jsonb, '{aidreamcapesV2Navigation,menus}', ${JSON.stringify(nextSettings.aidreamcapesV2Navigation.menus)}::jsonb, false), "updatedAt" = now() WHERE "siteId" = ${siteId} AND "draftJson"::jsonb #> '{aidreamcapesV2Navigation,menus}' = ${JSON.stringify(oldNavigation.menus)}::jsonb`;
        assert.equal(changed, 1, 'Navigation menus changed during plan; re-run against current relational settings');
      }
    }
    const pageReadback = await tx.livePage.findFirstOrThrow({ where: { siteId, id: pageId }, select: { contentJson: true } });
    const settingsReadback = await tx.themeSettings.findUniqueOrThrow({ where: { siteId }, select: { draftJson: true, publishedJson: true } });
    if (apply) {
      assert.equal(hash(pageReadback.contentJson), hash(nextPage));
      assert.equal(hash(settingsReadback.draftJson), hash(nextSettings));
    }
    const protectedAfter = hash(await protectedRows());
    assert.equal(protectedBefore, protectedAfter, 'MyDreamShoots public relational content changed');
    const relationRows = await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS relation`;
    const derived = relationRows[0]?.relation ? await tx.sitePublishedState.findUnique({ where: { siteId }, select: { revision: true, contentHash: true } }) : null;
    return {
      ok: true, target: 'local', siteId, applying: apply,
      owners: { homepage: 'LivePage.contentJson', navigation: 'ThemeSettings.draftJson.aidreamcapesV2Navigation (current SSR source)' },
      homepage: { id: pageId, beforeRevision: hash(page.contentJson), afterRevision: hash(nextPage), operations: pageOps },
      navigation: { beforeRevision: hash(settings.draftJson), afterRevision: hash(nextSettings), operations: settingsOps, publishedJsonRevisionUnchanged: hash(settings.publishedJson), requestedEntries: menuEntries, preexistingImageToVideo: { label: existingImage.label, href: existingImage.href, description: existingImage.description, image: existingImage.image }, pendingDesignOnlyDestinations: ['/text-to-video', '/ai-twin'] },
      currentReadback: {
        homepageRevision: hash(pageReadback.contentJson),
        threeStepEyebrow: pageReadback.contentJson.sections.v2_main.settings.data.stepsEyebrow,
        videoExamplesMoreHref: pageReadback.contentJson.sections.v2_main.settings.data.visual.picker.href,
        videoExamplesMoreLabel: pageReadback.contentJson.sections.v2_main.settings.data.visual.picker.button,
        textToVideoHref: pageReadback.contentJson.sections.v2_main.settings.data.benefits.find(item => item.id === 'text')?.href,
        aiTwinHref: pageReadback.contentJson.sections.v2_main.settings.data.benefits.find(item => item.id === 'twin')?.href,
        presenterChooseHref: pageReadback.contentJson.sections.v2_main.settings.data.homeExperience.blocks.find(block => block.after === 'steps')?.actions?.main,
        videoMenuItems: settingsReadback.draftJson?.aidreamcapesV2Navigation?.menus?.find(menu => menu.label === 'Video')?.groups?.flatMap(group => group.items ?? []).filter(item => ['Text to Video', 'Image to Video', 'AI Twin'].includes(item.label)).map(({ label, href, description, image }) => ({ label, href, description, image }))
      },
      protectedMyDreamShootsBefore: protectedBefore, protectedMyDreamShootsAfter: protectedAfter,
      derivedState: { relation: relationRows[0]?.relation ?? null, record: derived, refreshed: false },
      historicalStateActivated: false
    };
  }, { isolationLevel: 'Serializable', timeout: 60000 });
  await fs.mkdir(out, { recursive: true });
  const manifest = { siteId, target: 'local', applying: apply, mutationStatus: (report.homepage.operations.length + report.navigation.operations.length) ? 'fields-written' : 'already-current', operations: report.homepage.operations.concat(report.navigation.operations), revisions: { homepage: { before: report.homepage.beforeRevision, after: report.homepage.afterRevision }, navigation: { before: report.navigation.beforeRevision, after: report.navigation.afterRevision } }, currentValues: report.currentReadback, intendedFields: [
    '/sections/v2_main/settings/data/benefits/*/href',
    '/sections/v2_main/settings/data/homeExperience/blocks/*/actions/main',
    '/sections/v2_main/settings/data/stepsEyebrow',
    '/sections/v2_main/settings/data/visual/picker/href',
    '/sections/v2_main/settings/data/visual/picker/button',
    '/aidreamcapesV2Navigation/menus (ThemeSettings.draftJson runtime field)'
  ], pendingDesignOnlyDestinations: ['/text-to-video', '/ai-twin'] };
  await fs.writeFile(`${out}/${apply ? 'field-manifest.json' : 'plan.json'}`, JSON.stringify(manifest, null, 2));
  await fs.writeFile(`${out}/${apply ? 'apply-report.json' : 'plan-report.json'}`, JSON.stringify(report, null, 2));
  await fs.writeFile(`${out}/current-readback.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, homepage: { ...report.homepage, operations: report.homepage.operations.map(op => op.path) }, navigation: { ...report.navigation, operations: report.navigation.operations.map(op => op.path) } }, null, 2));
} finally { await db.$disconnect(); }
