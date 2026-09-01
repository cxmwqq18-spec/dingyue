#!/usr/bin/env node
import assert from "node:assert/strict";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const siteId = "site_dreamshoot";
const pathName = "/ai-save-the-date/wedding-invitation";
const retiredPath = "/holidays-events/wedding-invitation";
const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === siteId);
assert(site, `missing_site:${siteId}`);

const page = site.pages.find((candidate) => candidate.slug === pathName || candidate.slug === "/ai-video-generation/wedding-invitation");
assert(page, `${pathName}: missing wedding invitation detail page`);
assert.equal(page.pageType, "ai_tool", `${pathName}: detail page type`);
assert.equal(page.slug, "/ai-video-generation/wedding-invitation", `${pathName}: internal source slug`);
assert.equal(site.pages.some((candidate) => candidate.slug === retiredPath), false, `${retiredPath}: retired page must be absent`);
const section = Object.values(page.draftJson?.sections ?? {}).find((candidate) => candidate?.type === "ai_video_topic_landing");
assert(section, `${pathName}: dedicated topic landing section is missing`);
assert.equal(page.draftJson?.seo?.canonicalPath, pathName, `${pathName}: canonical path must belong to Save the Date`);
assert.match(String(section.settings?.content?.hero?.title ?? ""), /Wedding Invitation/i, `${pathName}: topic hero title is missing`);
assert.equal(page.draftJson?.seo?.robots?.index, true, `${pathName}: indexable`);

const content = section.settings?.content ?? {};
const imageUrls = [];
const collectImageUrls = (value) => {
  if (Array.isArray(value)) return value.forEach(collectImageUrls);
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) {
    if (key === "src" && typeof nested === "string" && /\.(?:jpe?g|png|webp)$/i.test(nested)) imageUrls.push(nested);
    else collectImageUrls(nested);
  }
};
collectImageUrls(content);
assert.equal(new Set(imageUrls).size, 10, `${pathName}: complete invitation media package must have ten unique images`);
assert.equal(new Set((content.useCases?.items ?? []).map((item) => item.image?.src)).size, 3, `${pathName}: use-case cards must use unique images`);
assert.equal((content.gallery?.items ?? []).length, 6, `${pathName}: invitation detail gallery must contain six images`);

const navigation = site.themeSettings?.draftJson?.saveTheDateNavigation;
const weddingNavigationItem = navigation?.groups?.flatMap((group) => group.items ?? []).find((item) => item.href === pathName);
assert(weddingNavigationItem, `${pathName}: must be listed in Save the Date navigation`);
assert.equal(navigation.groups.find((group) => group.items?.some((item) => item.href === pathName))?.slug, "love-wedding", `${pathName}: must belong to Love & Wedding`);
const videoTheme = (state.videoThemes ?? []).find((theme) => theme.siteId === siteId && theme.slug === "wedding-invitation");
assert(videoTheme, `${pathName}: VideoTheme source must exist`);
assert.equal(videoTheme.galleryImages?.length, 9, `${pathName}: VideoTheme must retain nine gallery images`);
assert.equal(videoTheme.galleryImages?.length, new Set(videoTheme.galleryImages ?? []).size, `${pathName}: VideoTheme gallery images must be unique`);
assert.equal(videoTheme.imageUrl, content.hero?.image?.src, `${pathName}: VideoTheme cover must match the published hero`);
assert.equal((site.themeSettings?.publishedJson?.saveTheDateNavigation?.groups ?? []).flatMap((group) => group.items ?? []).some((item) => item.href === pathName), true, `${pathName}: published Save the Date navigation must include the theme`);
assert.equal((site.themeSettings?.publishedJson?.saveTheDateNavigation?.groups ?? []).find((group) => (group.items ?? []).some((item) => item.href === pathName))?.slug, "love-wedding", `${pathName}: published navigation must keep the theme in Love & Wedding`);

console.log(JSON.stringify({ ok: true, path: pathName, sourcePath: page.slug, retiredPath, pageType: page.pageType }, null, 2));
