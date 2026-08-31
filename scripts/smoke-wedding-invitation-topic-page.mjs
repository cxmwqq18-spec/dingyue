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
assert.equal(page.draftJson?.seo?.robots?.index, true, `${pathName}: indexable`);

console.log(JSON.stringify({ ok: true, path: pathName, sourcePath: page.slug, retiredPath, pageType: page.pageType }, null, 2));
