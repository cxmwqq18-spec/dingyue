#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const SITE_ID = "site_dreamshoot";
const pages = [
  { path: "/ai-save-the-date/engagement", key: "engagement", media: 11, faq: 8, sections: ["hero", "intent", "story-structures", "workflow", "scene-directions", "quality", "formats", "boundaries", "evidence", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_story_grid", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_formats", "editorial_boundaries", "editorial_evidence", "faq", "editorial_cta"] },
  { path: "/ai-save-the-date/proposal", key: "proposal", media: 10, faq: 8, sections: ["hero", "definition", "use-cases", "story-flow", "workflow", "source-media", "accuracy", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_story_flow", "editorial_steps", "editorial_quality", "editorial_quality", "faq", "editorial_cta"] },
  { path: "/ai-save-the-date/save-the-date", key: "save_date", media: 11, faq: 8, sections: ["hero", "definition", "use-cases", "workflow", "scene-ideas", "quality", "formats", "boundaries", "evidence", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_formats", "editorial_boundaries", "editorial_evidence", "faq", "editorial_cta"] },
  { path: "/ai-save-the-date/wedding-ceremony", key: "wedding_ceremony", media: 11, faq: 9, sections: ["hero", "definition", "reasons", "sources", "workflow", "scene-ideas", "quality", "boundaries", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_story_grid", "editorial_quality", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_boundaries", "faq", "editorial_cta"] },
  { path: "/ai-save-the-date/mothers-day", key: "mothers_day", media: 11, faq: 8, sections: ["hero", "definition", "use-cases", "quality", "workflow", "scene-ideas", "formats", "family-match", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_story_grid", "editorial_quality", "editorial_steps", "editorial_scene_grid", "editorial_rich_text", "editorial_rich_text", "faq", "editorial_cta"] },
  { path: "/ai-save-the-date/fathers-day", key: "fathers_day", media: 11, faq: 6, sections: ["hero", "definition", "scene-ideas", "quality", "workflow", "use-cases", "gallery", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_quality", "editorial_steps", "editorial_story_grid", "editorial_scene_grid", "faq", "editorial_cta"] },
];
const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === SITE_ID);
assert(site, `missing_site:${SITE_ID}`);
const snapshot = site.activePublication?.snapshot;
assert(snapshot, "missing_active_publication_snapshot");

for (const expected of pages) {
  const route = snapshot.publishedRoutes.find((candidate) => candidate.canonicalPath === expected.path);
  assert.equal(route?.routeKind, "standard-content", `${expected.path}: route kind`);
  assert.equal(route?.status, "published", `${expected.path}: route status`);
  assert.equal(route?.indexable, expected.indexable !== false, `${expected.path}: indexability`);
  assert.equal(route?.sitemapEligible, expected.indexable !== false, `${expected.path}: sitemap eligibility`);
  const page = site.pages.find((candidate) => candidate.id === route.pageId && candidate.slug === expected.path);
  assert(page, `${expected.path}: missing page entity`);
  const json = page.publishedJson;
  assert.deepEqual(json.contentContract?.requiredSections, expected.sections, `${expected.path}: section contract`);
  assert.deepEqual(json.contentContract?.sectionTypes, expected.types, `${expected.path}: section types`);
  assert.equal(json.contentContract?.faqCount, expected.faq, `${expected.path}: faq contract`);
  assert.equal(json.contentContract?.mediaCount, expected.media, `${expected.path}: media contract`);
  assert.deepEqual(json.sectionsOrder, expected.sections.map((id) => `${expected.key}_${id.replace(/-/g, "_")}`), `${expected.path}: section order`);
  assert.deepEqual(json.sectionsOrder.map((id) => json.sections[id]?.type), expected.types, `${expected.path}: rendered section order`);
  const faq = json.sectionsOrder.map((id) => json.sections[id]).find((section) => section?.type === "faq");
  assert.equal(faq?.blocks?.length, expected.faq, `${expected.path}: faq blocks`);
  assert(faq.blocks.every((block) => block.settings.question && block.settings.answer), `${expected.path}: faq fields`);
  const cta = json.sectionsOrder.map((id) => json.sections[id]).find((section) => section?.type === "editorial_cta");
  assert(cta?.settings?.primaryCta && cta?.settings?.primaryHref && cta?.settings?.secondaryCta && cta?.settings?.secondaryHref, `${expected.path}: cta fields`);
  assert.equal(json.mediaManifest.length, expected.media, `${expected.path}: manifest count`);
  assert.equal(new Set(json.mediaManifest.map((item) => item.src)).size, expected.media, `${expected.path}: manifest uniqueness`);
  assert(json.mediaManifest.every((item) => item.alt && item.width === 1600 && item.height === 1000 && ["hero", "content"].includes(item.role)), `${expected.path}: manifest metadata`);
  assert(json.mediaManifest.every((item) => state.mediaAssets.some((asset) => asset.siteId === SITE_ID && asset.storageKey === item.src && asset.altText === item.alt)), `${expected.path}: media owner`);
  if (expected.path === "/ai-save-the-date/engagement") {
    const sceneSection = json.sections?.["engagement_scene_directions"];
    const sceneBlocks = sceneSection?.blocks?.slice(1) ?? [];
    assert.equal(sceneBlocks.length, 8, `${expected.path}: scene direction count`);
    assert(sceneBlocks.every((block) => block.settings?.imageUrl && block.settings?.imageAlt), `${expected.path}: scene direction media`);
  }
  if (expected.path === "/ai-save-the-date/save-the-date") {
    const sceneBlocks = json.sections?.save_date_scene_ideas?.blocks ?? [];
    assert.equal(sceneBlocks.length, 11, `${expected.path}: scene idea count`);
    assert(sceneBlocks.every((block) => block.settings?.imageUrl && block.settings?.imageAlt), `${expected.path}: scene idea media`);
    const formatBlocks = json.sections?.save_date_formats?.blocks ?? [];
    assert(formatBlocks.every((block) => block.settings?.imageUrl && block.settings?.imageAlt), `${expected.path}: format media`);
    assert(cta.settings?.imageUrl && cta.settings?.imageAlt, `${expected.path}: final CTA media`);
  }
  if (expected.path === "/ai-save-the-date/proposal") {
    const useCaseBlocks = json.sections?.proposal_use_cases?.blocks ?? [];
    const flowBlocks = json.sections?.proposal_story_flow?.blocks ?? [];
    assert.equal(useCaseBlocks.length, 7, `${expected.path}: use-case count`);
    assert.equal(flowBlocks.length, 5, `${expected.path}: story-flow count`);
    assert(useCaseBlocks.every((block) => block.settings?.imageUrl && block.settings?.imageAlt), `${expected.path}: use-case media`);
    assert(flowBlocks.every((block) => block.settings?.imageUrl && block.settings?.imageAlt), `${expected.path}: story-flow media`);
  }
  assert.equal(json.seo?.canonicalPath, expected.path, `${expected.path}: canonical path`);
  assert(json.seo?.title && json.seo?.description, `${expected.path}: SEO title/description`);
  assert.equal(json.sections?.[json.sectionsOrder[0]]?.settings?.themeTone, expected.path.includes("wedding-ceremony") ? "wedding" : expected.path.includes("thanksgiving") ? "thanksgiving" : expected.path.includes("christmas") ? "christmas" : expected.path.includes("new-year") ? "new-year" : expected.path.includes("mothers-day") ? "mothers-day" : expected.path.includes("fathers-day") ? "fathers-day" : expected.path.includes("halloween") ? "halloween" : undefined, `${expected.path}: theme token`);
  assert.equal(json.seo?.robots?.index, expected.indexable !== false, `${expected.path}: robots index`);
  assert.equal(json.seo?.robots?.follow, true, `${expected.path}: robots follow`);
  assert.equal(json.seo?.robots?.maxImagePreview, "large", `${expected.path}: image preview`);
  assert(!JSON.stringify(json).match(/---|```|`[^`]+`|\[[^\]]+\]\([^)]*\)/), `${expected.path}: raw markdown`);
  const media = snapshot.publishedStandardPageMedia.find((candidate) => candidate.canonicalPath === expected.path);
  assert.equal(media?.status, "ready", `${expected.path}: media projection`);
  assert.equal(media?.mediaEntityId, route.mediaEntityId, `${expected.path}: media entity`);
  const links = snapshot.publishedLinkRefs.filter((link) => link.ownerPageEntityId === route.pageEntityId);
  assert(links.some((link) => link.kind === "cta" && link.href.startsWith("/app/create")), `${expected.path}: cta projection`);
  assert(links.filter((link) => link.kind === "related").length >= 2, `${expected.path}: related links`);
  assert(links.filter((link) => link.kind === "related").every((link) => snapshot.publishedRoutes.some((candidate) => candidate.canonicalPath === link.href && candidate.status === "published")), `${expected.path}: unpublished related link`);
}

const navigation = site.themeSettings?.publishedJson?.saveTheDateNavigation;
assert.equal(navigation?.menuLabel, "Save the Date");
const items = navigation.groups.flatMap((group) => group.items.filter((item) => item.status === "published"));
assert.equal(new Set(items.map((item) => item.href)).size, items.length, "Save the Date navigation paths must be unique");
assert(items.every((item) => snapshot.publishedRoutes.some((route) => route.disposition === "render" && route.status === "published" && route.canonicalPath === item.href)), "Save the Date navigation must target published routes");
assert.equal(navigation.groups[1]?.label, "Seasonal Holidays");
assert.equal(navigation.groups[0]?.label, "Love & Wedding");
const sitemap = snapshot.publishedStandardPageMedia.map((media) => media.canonicalPath);
for (const page of pages) assert(sitemap.includes(page.path), `${page.path}: missing sitemap media projection`);
const renderer = fs.readFileSync(path.join(process.cwd(), "src/components/theme-renderer.tsx"), "utf8");
for (const token of ["/ai-save-the-date/engagement", "/ai-save-the-date/proposal", "hero-ai-proposal-rooftop-surprise-night.jpg"]) assert(!renderer.includes(token), `renderer contains page-specific token: ${token}`);
console.log(JSON.stringify({ siteId: SITE_ID, publicationVersion: site.activePublication.version, pages: pages.map((page) => ({ path: page.path, media: page.media, faq: page.faq })) }, null, 2));
