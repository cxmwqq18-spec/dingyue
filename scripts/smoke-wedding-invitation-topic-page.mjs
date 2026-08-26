#!/usr/bin/env node
import assert from "node:assert/strict";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const siteId = "site_dreamshoot";
const pathName = "/holidays-events/wedding-invitation";
const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === siteId);
assert(site, `missing_site:${siteId}`);
const snapshot = site.activePublication?.snapshot;
assert(snapshot, "missing_active_publication_snapshot");
const route = snapshot.publishedRoutes.find((candidate) => candidate.canonicalPath === pathName);
const page = site.pages.find((candidate) => candidate.slug === pathName);
assert(page, `${pathName}: missing page entity`);
const json = page.publishedJson;

assert.equal(route?.routeKind, "standard-content", `${pathName}: route kind`);
assert.equal(route?.status, "published", `${pathName}: route must be published for review while indexation is held`);
assert.equal(route?.indexable, false, `${pathName}: must remain noindex until product evidence is verified`);
assert.equal(route?.sitemapEligible, false, `${pathName}: must remain out of sitemap until product evidence is verified`);
assert.equal(json.seo?.canonicalPath, pathName, `${pathName}: canonical path`);
assert.equal(json.seo?.canonical, `https://www.mydreamshoots.com${pathName}`, `${pathName}: canonical URL`);
assert.equal(json.seo?.title, "AI Wedding Invitation Maker | Create Custom Wedding Invites", `${pathName}: title`);
assert.equal(json.seo?.robots?.index, false, `${pathName}: robots index`);
assert.equal(json.seo?.robots?.follow, true, `${pathName}: robots follow`);
assert.equal(json.contentContract?.pageKey, "wedding_invitation", `${pathName}: distinct page key`);
assert.equal(json.contentContract?.faqCount, 8, `${pathName}: FAQ count`);
assert.equal(json.contentContract?.mediaCount, 10, `${pathName}: media count`);
assert.equal(json.sections?.wedding_invitation_hero?.settings?.title, "Create a Personalized Wedding Invitation with AI", `${pathName}: H1`);
assert(!json.sectionsOrder.some((id) => id.startsWith("save_date_")), `${pathName}: must not reuse Save the Date sections`);
assert.equal(json.sections?.wedding_invitation_faq?.blocks?.length, 8, `${pathName}: FAQ blocks`);
assert.equal(json.mediaManifest?.length, 10, `${pathName}: media manifest`);
assert.equal(new Set(json.mediaManifest.map((image) => image.src)).size, 10, `${pathName}: unique media`);
assert(json.mediaManifest.every((image) => image.src.startsWith("/assets/dreamshoot/wedding-invitation/") && image.alt), `${pathName}: owned media`);
assert(json.relatedLinks.some((link) => link.href === "/holidays-events/save-the-date"), `${pathName}: Save the Date separation link`);
assert(json.relatedLinks.some((link) => link.href === "/ai-video-generation/wedding-ceremony"), `${pathName}: Wedding Ceremony link`);

const standardMedia = snapshot.publishedStandardPageMedia.find((candidate) => candidate.canonicalPath === pathName);
assert.equal(standardMedia?.status, "ready", `${pathName}: media projection must be ready`);
assert.equal(standardMedia?.primaryImage, json.seo?.ogImage, `${pathName}: OG image owner`);
console.log(JSON.stringify({ ok: true, publicationVersion: site.activePublication.version, path: pathName, status: route.status, indexable: route.indexable, faq: json.contentContract.faqCount, media: json.contentContract.mediaCount }, null, 2));
