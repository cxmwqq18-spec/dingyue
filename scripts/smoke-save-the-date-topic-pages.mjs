#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const SITE_ID = "site_dreamshoot";
const pages = [
  { path: "/holidays-events/engagement", key: "engagement", media: 11, sections: ["hero", "intent", "story-structures", "workflow", "scene-directions", "quality", "formats", "boundaries", "evidence", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_story_grid", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_formats", "editorial_boundaries", "editorial_evidence", "faq", "editorial_cta"] },
  { path: "/holidays-events/proposal", key: "proposal", media: 10, sections: ["hero", "definition", "use-cases", "story-flow", "workflow", "source-media", "accuracy", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_story_flow", "editorial_steps", "editorial_quality", "editorial_quality", "faq", "editorial_cta"] },
  { path: "/holidays-events/save-the-date", key: "save_date", media: 11, sections: ["hero", "definition", "use-cases", "workflow", "scene-ideas", "quality", "formats", "boundaries", "evidence", "faq", "final-cta"], types: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_formats", "editorial_boundaries", "editorial_evidence", "faq", "editorial_cta"] }
];
const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === SITE_ID);
assert(site, `missing_site:${SITE_ID}`);
const snapshot = site.latestPublication?.snapshot;
assert(snapshot, "missing_active_publication_snapshot");

for (const expected of pages) {
  const route = snapshot.publishedRoutes.find((candidate) => candidate.canonicalPath === expected.path);
  assert.equal(route?.routeKind, "standard-content", `${expected.path}: route kind`);
  assert.equal(route?.status, "published", `${expected.path}: route status`);
  assert.equal(route?.indexable, true, `${expected.path}: indexability`);
  assert.equal(route?.sitemapEligible, true, `${expected.path}: sitemap eligibility`);
  const page = site.pages.find((candidate) => candidate.id === route.pageId && candidate.slug === expected.path);
  assert(page, `${expected.path}: missing page entity`);
  const json = page.publishedJson;
  assert.deepEqual(json.contentContract?.requiredSections, expected.sections, `${expected.path}: section contract`);
  assert.deepEqual(json.contentContract?.sectionTypes, expected.types, `${expected.path}: section types`);
  assert.equal(json.contentContract?.faqCount, 8, `${expected.path}: faq contract`);
  assert.equal(json.contentContract?.mediaCount, expected.media, `${expected.path}: media contract`);
  assert.deepEqual(json.sectionsOrder, expected.sections.map((id) => `${expected.key}_${id.replace(/-/g, "_")}`), `${expected.path}: section order`);
  assert.deepEqual(json.sectionsOrder.map((id) => json.sections[id]?.type), expected.types, `${expected.path}: rendered section order`);
  const faq = json.sectionsOrder.map((id) => json.sections[id]).find((section) => section?.type === "faq");
  assert.equal(faq?.blocks?.length, 8, `${expected.path}: faq blocks`);
  assert(faq.blocks.every((block) => block.settings.question && block.settings.answer), `${expected.path}: faq fields`);
  const cta = json.sectionsOrder.map((id) => json.sections[id]).find((section) => section?.type === "editorial_cta");
  assert(cta?.settings?.primaryCta && cta?.settings?.primaryHref && cta?.settings?.secondaryCta && cta?.settings?.secondaryHref, `${expected.path}: cta fields`);
  assert.equal(json.mediaManifest.length, expected.media, `${expected.path}: manifest count`);
  assert.equal(new Set(json.mediaManifest.map((item) => item.src)).size, expected.media, `${expected.path}: manifest uniqueness`);
  assert(json.mediaManifest.every((item) => item.alt && item.width === 1600 && item.height === 1000 && ["hero", "content"].includes(item.role)), `${expected.path}: manifest metadata`);
  assert(json.mediaManifest.every((item) => state.mediaAssets.some((asset) => asset.siteId === SITE_ID && asset.storageKey === item.src && asset.altText === item.alt)), `${expected.path}: media owner`);
  assert.equal(json.seo?.canonicalPath, expected.path, `${expected.path}: canonical path`);
  assert.equal(json.seo?.robots?.index, true, `${expected.path}: robots index`);
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
assert.deepEqual(items.map((item) => item.href), ["/ai-save-the-date/valentines-day", ...pages.map((page) => page.path)]);
assert.equal(navigation.groups[0]?.label, "Love & Wedding");
const sitemap = snapshot.publishedStandardPageMedia.map((media) => media.canonicalPath);
for (const page of pages) assert(sitemap.includes(page.path), `${page.path}: missing sitemap media projection`);
const renderer = fs.readFileSync(path.join(process.cwd(), "src/components/theme-renderer.tsx"), "utf8");
for (const token of ["/holidays-events/engagement", "/holidays-events/proposal", "/holidays-events/save-the-date", "hero-ai-proposal-rooftop-surprise-night.jpg"]) assert(!renderer.includes(token), `renderer contains page-specific token: ${token}`);
console.log(JSON.stringify({ siteId: SITE_ID, publicationVersion: site.latestPublication.version, pages: pages.map((page) => ({ path: page.path, media: page.media, faq: 8 })) }, null, 2));
