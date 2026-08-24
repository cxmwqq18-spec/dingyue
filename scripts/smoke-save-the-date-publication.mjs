#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliasPath = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : "";
  if (!aliasPath) return originalResolveFilename.call(this, request, ...args);
  const resolved = [aliasPath, `${aliasPath}.ts`, `${aliasPath}.tsx`, `${aliasPath}.json`].find((candidate) => fs.existsSync(candidate));
  return originalResolveFilename.call(this, resolved ?? aliasPath, ...args);
};

const SITE_ID = "site_dreamshoot";
const PAGE_PATH = "/ai-save-the-date/valentines-day";
const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === SITE_ID);
assert(site, `missing_site:${SITE_ID}`);
const publication = site.latestPublication;
assert(publication?.snapshot, "missing_active_publication_snapshot");
const snapshot = publication.snapshot;
const route = snapshot.publishedRoutes.find((candidate) => candidate.canonicalPath === PAGE_PATH);
assert.equal(route?.routeKind, "standard-content");
assert.equal(route?.disposition, "render");
assert.equal(route?.status, "published");
assert.equal(route?.indexable, true);
assert.equal(route?.sitemapEligible, true);

const page = site.pages.find((candidate) => candidate.id === route.pageId && candidate.slug === PAGE_PATH);
assert(page, "missing_theme_page_entity");
const entity = snapshot.publishedPageEntities.find((candidate) => candidate.pageEntityId === route.pageEntityId);
assert.equal(entity?.status, "published");
assert.equal(entity?.canonicalPath, PAGE_PATH);
const media = snapshot.publishedStandardPageMedia.find((candidate) => candidate.canonicalPath === PAGE_PATH);
assert.equal(media?.status, "ready");
assert.equal(media?.mediaEntityId, route.mediaEntityId);
assert.equal(page.publishedJson?.mediaManifest?.length, 11);
assert.equal(new Set(page.publishedJson?.mediaManifest?.map((item) => item.src)).size, 11);
assert(page.publishedJson?.mediaManifest?.every((item) => ["hero", "content"].includes(item.role)), "manifest_roles_not_normalized");
assert(page.publishedJson?.mediaManifest?.every((item) => item.alt && item.width > 0 && item.height > 0), "manifest_metadata_incomplete");
assert(page.publishedJson?.mediaManifest?.every((item) => state.mediaAssets.some((asset) => asset.siteId === SITE_ID && asset.storageKey === item.src && asset.altText === item.alt)), "manifest_media_owner_missing");
assert.deepEqual(page.publishedJson?.contentContract?.requiredSections, ["hero", "positioning", "story-styles", "details", "workflow", "ideas", "formats", "checklist", "faq", "final-cta"]);
assert.equal(page.publishedJson?.sectionsOrder?.length, 10);
assert.deepEqual(page.publishedJson?.sectionsOrder?.map((id) => page.publishedJson.sections[id]?.type), ["editorial_hero", "editorial_rich_text", "editorial_story_grid", "editorial_detail_list", "editorial_steps", "editorial_ideas", "editorial_formats", "editorial_checklist", "faq", "editorial_cta"]);
assert.equal(page.publishedJson?.sections?.save_date_faq?.blocks?.length, 6);
assert(page.publishedJson?.sections?.save_date_final_cta?.settings?.primaryCta && page.publishedJson?.sections?.save_date_final_cta?.settings?.secondaryCta, "cta_content_missing");
assert.equal(page.publishedJson?.seo?.robots?.maxImagePreview, "large");
assert(!JSON.stringify(page.publishedJson).match(/---|```|`[^`]+`|\[[^\]]+\]\([^)]*\)/), "raw_markdown_in_published_page");
assert.equal(media?.sitemapImages?.length, 6);

const pageSeo = page.publishedJson?.seo;
assert.equal(pageSeo?.canonicalPath, PAGE_PATH);
assert.equal(pageSeo?.canonical, "https://www.mydreamshoots.com/ai-save-the-date/valentines-day");
assert.equal(pageSeo?.robots?.index, true);
assert.equal(pageSeo?.robots?.follow, true);
assert.equal(pageSeo?.ogImage, media.ogImage);
assert.equal(entity.metadata.canonicalPath, PAGE_PATH);
assert.equal(`https://${site.primaryDomain}${entity.metadata.canonicalPath}`, pageSeo.canonical);
assert.equal(state.mediaAssets.filter((asset) => asset.siteId === SITE_ID && asset.storageKey.startsWith("/assets/dreamshoot/save-the-date/valentines-day/")).length, 11);

const navigationConfig = site.themeSettings?.publishedJson?.saveTheDateNavigation ?? { menuLabel: "", groups: [] };
assert.equal(navigationConfig.menuLabel, "Save the Date");
const navigation = navigationConfig.groups ?? [];
const publishedItems = navigation.flatMap((group) => group.items.filter((item) => item.status === "published"));
assert.equal(publishedItems.length, 1);
assert.equal(publishedItems[0].href, PAGE_PATH);
assert.equal(publishedItems[0].label, "Valentine's Day");
assert.equal(navigation[0]?.label, "Love & Wedding");

const ownedLinks = snapshot.publishedLinkRefs.filter((link) => link.ownerPageEntityId === route.pageEntityId);
const cta = ownedLinks.find((link) => link.kind === "cta");
assert.equal(cta?.href, "/app/create");
assert.equal(cta?.targetType, "private_action");
for (const link of ownedLinks.filter((candidate) => candidate.kind === "related")) {
  assert(snapshot.publishedRoutes.some((candidate) => candidate.disposition === "render" && candidate.status === "published" && candidate.canonicalPath === link.href), `unpublished_related_link:${link.href}`);
}

const jiti = createJiti(import.meta.url);
const { sitemapEntriesForSite } = jiti("../src/lib/seo-indexing.ts");
const sitemap = sitemapEntriesForSite(state, site);
assert(sitemap.some((entry) => new URL(entry.loc).pathname === PAGE_PATH), "missing_save_the_date_sitemap_entry");

const themeRenderer = fs.readFileSync(path.join(repoRoot, "src/components/theme-renderer.tsx"), "utf8");
const megaMenu = fs.readFileSync(path.join(repoRoot, "src/components/storefront/header-mega-menu-panels.tsx"), "utf8");
for (const source of [themeRenderer, megaMenu]) {
  assert(!source.includes(PAGE_PATH), "page_path_hardcoded_in_renderer");
  assert(!source.includes("hero-valentines-day-save-the-date"), "image_filename_hardcoded_in_renderer");
  assert(!source.includes("valentines-save-date-faq"), "faq_copy_hardcoded_in_renderer");
}

console.log(JSON.stringify({
  siteId: SITE_ID,
  publicationId: publication.id,
  publicationVersion: publication.version,
  snapshotHash: snapshot.snapshotHash,
  pagePath: PAGE_PATH,
  mediaCount: page.publishedJson.mediaManifest.length,
  sitemapImages: media.sitemapImages.length,
  faqCount: entity.content.faqItems.length,
  navigationItems: publishedItems.length
}, null, 2));
