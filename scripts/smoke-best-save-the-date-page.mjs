#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const SITE_ID = "site_dreamshoot";
const PAGE_PATH = "/best-save-the-date";
const expectedThemePaths = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-invitation",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day",
  "/ai-save-the-date/halloween"
];

const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === SITE_ID);
assert(site, `missing_site:${SITE_ID}`);

  const route = site.activePublication?.snapshot?.publishedRoutes?.find((candidate) => candidate.canonicalPath === PAGE_PATH);
assert.equal(route?.status, "published", "directory route must be published");
assert.equal(route?.indexable, true, "directory route must be indexable");
assert.equal(route?.sitemapEligible, true, "directory route must be in the sitemap");

const page = site.pages.find((candidate) => candidate.slug === PAGE_PATH);
assert(page, "directory page entity is required");
assert.equal(page.publishedJson?.sections?.best_save_the_date_1?.type, "dreamshoot_save_the_date_directory");
assert.equal(page.publishedJson?.seo?.canonicalPath, PAGE_PATH);
assert.equal(page.publishedJson?.seo?.robots?.index, true);
assert.equal(page.publishedJson?.seo?.robots?.follow, true);
assert.match(page.publishedJson?.seo?.title ?? "", /Save the Date/i);
assert.match(page.publishedJson?.seo?.description ?? "", /myDreamshoots/i);

const navigation = site.themeSettings?.publishedJson?.saveTheDateNavigation;
assert.equal(navigation?.menuLabel, "Save the Date");
assert.equal(navigation?.groups?.length, 2);
const items = navigation.groups.flatMap((group) => group.items.filter((item) => item.status === "published"));
const expectedNavigation = {
  "Love & Wedding": [
    ["Valentine's Day", "/ai-save-the-date/valentines-day"],
    ["Engagement", "/ai-save-the-date/engagement"],
    ["Proposal", "/ai-save-the-date/proposal"],
    ["Save the Date", "/ai-save-the-date/save-the-date"],
    ["Wedding Invitation", "/ai-save-the-date/wedding-invitation"],
    ["Wedding Ceremony", "/ai-save-the-date/wedding-ceremony"]
  ],
  "Seasonal Holidays": [
    ["Christmas", "/ai-save-the-date/christmas"],
    ["Halloween", "/ai-save-the-date/halloween"],
    ["Thanksgiving", "/ai-save-the-date/thanksgiving"],
    ["New Year", "/ai-save-the-date/new-year"],
    ["Mother's Day", "/ai-save-the-date/mothers-day"],
    ["Father's Day", "/ai-save-the-date/fathers-day"]
  ]
};
for (const group of navigation.groups) {
  const expected = expectedNavigation[group.label];
  assert(expected, `unexpected Save the Date navigation group: ${group.label}`);
  assert.deepEqual(group.items.filter((item) => item.status === "published").map((item) => [item.label, item.href]), expected, `${group.label}: canonical navigation taxonomy`);
}
assert(items.every((item) => item.href.startsWith("/")), "Save the Date navigation hrefs must be absolute paths");
assert(!items.some((item) => /photo|holiday|create |videos|engagement-photo/i.test(item.label)), "Save the Date navigation must not reuse image-theme or editorial labels");
assert(expectedThemePaths.every((href) => items.some((item) => item.href === href)), "core Save the Date themes must remain published");
for (const item of items) {
  assert(item.description?.trim(), `${item.href}: description required`);
  assert(item.imageUrl?.trim(), `${item.href}: cover image required`);
  assert(item.imageAlt?.trim(), `${item.href}: image alt required`);
}
assert.equal(new Set(items.map((item) => item.imageUrl)).size, items.length, "published Save the Date cards must not reuse a cover image");
assert.equal(new Set(items.map((item) => item.description)).size, items.length, "published Save the Date cards must not reuse a fallback description");
const publishedShowcases = (site.activePublication?.snapshot?.publishedHomepageShowcases ?? [])
  .filter((item) => item.kind === "save_the_date" && item.status === "published" && item.indexable && item.sitemapEligible);
assert.deepEqual(
  new Set(items.map((item) => item.href)),
  new Set(publishedShowcases.map((item) => item.canonicalPath)),
  "Save the Date navigation and published homepage projection must expose the same theme set"
);
const renderer = fs.readFileSync(path.join(process.cwd(), "src/components/theme-renderer.tsx"), "utf8");
const directory = fs.readFileSync(path.join(process.cwd(), "src/components/storefront/save-the-date-directory.tsx"), "utf8");
assert.match(renderer, /dreamshoot_save_the_date_directory/);
assert.match(renderer, /hrefFor\(site, "\/app\/create"\)/);
assert.match(renderer, /isMydreamshootsRemovedLegacyRoute/);
assert.match(directory, /data-save-the-date-card/);
assert.match(directory, /loading=\{index === 0 \? "eager" : "lazy"\}/);
assert.match(directory, /alt=\{imageAlt\}/);
assert.match(directory, /PublishedSaveTheDateGroup/);
assert.match(renderer, /resolvePublishedSaveTheDateGroups/);
assert.doesNotMatch(directory, /headshot-lifestyle-v1\.png/);
assert.doesNotMatch(directory, /Build a polished Save the Date story/);

  console.log(JSON.stringify({ ok: true, route: PAGE_PATH, categories: navigation.groups.length, themes: items.length }, null, 2));
