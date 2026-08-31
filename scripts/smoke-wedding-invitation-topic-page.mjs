#!/usr/bin/env node
import assert from "node:assert/strict";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const siteId = "site_dreamshoot";
const pathName = "/ai-video-generation/wedding-invitation";
const retiredPath = "/holidays-events/wedding-invitation";
const state = await readPlatformStateFromSql();
const site = state.sites.find((candidate) => candidate.id === siteId);
assert(site, `missing_site:${siteId}`);

const page = site.pages.find((candidate) => candidate.slug === pathName);
assert(page, `${pathName}: missing AI Video detail page`);
assert.equal(page.pageType, "ai_tool", `${pathName}: must remain an AI Video tool detail`);
assert.equal(page.draftJson?.seo?.canonicalPath, pathName, `${pathName}: canonical path`);
assert.equal(page.draftJson?.seo?.robots?.index, true, `${pathName}: indexable`);
assert.equal(site.pages.some((candidate) => candidate.slug === retiredPath), false, `${retiredPath}: retired page must be removed`);

console.log(JSON.stringify({ ok: true, path: pathName, retiredPath, pageType: page.pageType }, null, 2));
