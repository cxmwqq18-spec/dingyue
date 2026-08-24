#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const SITE_ID = "site_dreamshoot";
const PAGE_PATH = "/best-save-the-date";
const expectedThemePaths = [
  "/ai-save-the-date/valentines-day",
  "/holidays-events/engagement",
  "/holidays-events/proposal",
  "/holidays-events/save-the-date",
  "/ai-video-generation/wedding-ceremony",
  "/holidays-events/thanksgiving",
  "/holidays-events/christmas",
  "/holidays-events/new-year"
];

const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === SITE_ID);
assert(site, `missing_site:${SITE_ID}`);

const route = site.latestPublication?.snapshot?.publishedRoutes?.find((candidate) => candidate.canonicalPath === PAGE_PATH);
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
assert(expectedThemePaths.every((href) => items.some((item) => item.href === href)), "core Save the Date themes must remain published");
for (const item of items) {
  assert(item.description?.trim(), `${item.href}: description required`);
  assert(item.imageUrl?.trim(), `${item.href}: cover image required`);
  assert(item.imageAlt?.trim(), `${item.href}: image alt required`);
}

const renderer = fs.readFileSync(path.join(process.cwd(), "src/components/theme-renderer.tsx"), "utf8");
const directory = fs.readFileSync(path.join(process.cwd(), "src/components/storefront/save-the-date-directory.tsx"), "utf8");
assert.match(renderer, /dreamshoot_save_the_date_directory/);
assert.match(renderer, /hrefFor\(site, "\/app\/create"\)/);
assert.match(directory, /data-save-the-date-card/);
assert.match(directory, /loading=\{index === 0 \? "eager" : "lazy"\}/);
assert.match(directory, /alt=\{imageAlt\}/);
assert.match(directory, /status === "published"/);

console.log(JSON.stringify({ ok: true, route: PAGE_PATH, categories: navigation.groups.length, themes: items.length }, null, 2));
