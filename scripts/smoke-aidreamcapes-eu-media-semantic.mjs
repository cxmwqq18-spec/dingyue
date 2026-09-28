#!/usr/bin/env node

// Regression smoke for the French storefront's semantic media ownership.
// This is read-only: it checks current relational content and local assets.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const ASSET_ROOT = "/assets/sites/site_aidreamcapes_eu/";
const PAGE_EXPECTATIONS = {
  "/ai-save-the-date/valentines-day": "/valentines-photo/",
  "/ai-save-the-date/engagement": "/engagement-photo/",
  "/ai-save-the-date/proposal": "ai-engagement-proposal-moment.",
  "/ai-save-the-date/save-the-date": "save-the-date-",
  "/ai-save-the-date/wedding-ceremony": "/wedding-photo/",
  "/ai-save-the-date/wedding-invitation": "wedding-invitation-",
  "/ai-save-the-date/christmas": "/christmas-photo/",
  "/ai-save-the-date/halloween": "/halloween-photo/",
  "/ai-save-the-date/thanksgiving": "/thanksgiving-photo/",
  "/ai-save-the-date/new-year": "/holiday/",
  "/ai-save-the-date/mothers-day": "/thanksgiving-photo/",
  "/ai-save-the-date/fathers-day": "/rich-lifestyle/"
};

function localPath(url) { return path.resolve("public", String(url).split(/[?#]/)[0].replace(/^\//, "")); }
function collectStrings(value, output = []) {
  if (typeof value === "string") output.push(value);
  else if (Array.isArray(value)) value.forEach((item) => collectStrings(item, output));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectStrings(item, output));
  return output;
}

assertDatabaseTarget({ expectedTarget: "local" });
const db = new PrismaClient();
try {
  const [site, livePages, themePages, settings] = await Promise.all([
    db.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    db.livePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true, contentJson: true } }),
    db.themePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true, draftJson: true, publishedJson: true } }),
    db.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert.deepEqual(site, { id: SITE_ID, slug: "aidreamcapes-eu", primaryDomain: "aidreamcapes.eu" });
  const liveBySlug = new Map(livePages.map((row) => [row.slug, row.contentJson]));
  const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
  const checks = [];
  for (const [slug, expectedFragment] of Object.entries(PAGE_EXPECTATIONS)) {
    const jsons = [liveBySlug.get(slug), themeBySlug.get(slug)?.draftJson, themeBySlug.get(slug)?.publishedJson].filter(Boolean);
    assert.equal(jsons.length, 3, `Expected LivePage and both ThemePage states for ${slug}`);
    for (const json of jsons) {
      const manifest = json.mediaManifest ?? [];
      assert.equal(manifest.length, 11, `Expected 11 manifest images for ${slug}`);
      assert.equal(new Set(manifest.map((item) => item.src)).size, 11, `Manifest images must be unique for ${slug}`);
      assert(manifest.every((item) => item.src.startsWith(ASSET_ROOT) && !item.src.includes("/mirror/")), `Foreign/mirror manifest media in ${slug}`);
      assert(manifest[0].src.includes(expectedFragment), `Wrong hero media for ${slug}: ${manifest[0].src}`);
      for (const item of manifest) assert(fs.existsSync(localPath(item.src)), `Missing local image asset: ${item.src}`);
      const strings = collectStrings(json);
      assert(!strings.some((value) => value.includes("/mirror/") || value.includes("site_aidreamshoots") || value.includes("mydreamshoots.com")), `Cross-store media in ${slug}`);
    }
    checks.push({ slug, hero: jsons[0].mediaManifest[0].src, manifestCount: jsons[0].mediaManifest.length });
  }

  for (const json of [liveBySlug.get("/"), themeBySlug.get("/")?.draftJson, themeBySlug.get("/")?.publishedJson]) {
    assert(json, "Homepage current content is missing.");
    const tutorial = json.sections?.tutorial_video_1?.settings?.videoUrl;
    assert.equal(tutorial, "/assets/sites/site_aidreamcapes_eu/visuals/tutorial/aidreamcapes-ai-image-tutorial-20260814.mp4", `Homepage tutorial is not the French Aidreamcapes tutorial: ${tutorial}`);
    assert(!tutorial.includes("talking-photo") && !tutorial.includes("/mirror/"), "Homepage tutorial crossed a topic or mirror namespace.");
    assert(fs.existsSync(localPath(tutorial)), `Missing homepage tutorial asset: ${tutorial}`);
  }

  for (const json of [settings?.draftJson, settings?.publishedJson]) {
    assert(json, "ThemeSettings current state is missing.");
    for (const item of (json.saveTheDateNavigation?.groups ?? []).flatMap((group) => group.items ?? [])) {
      const page = liveBySlug.get(item.href);
      if (!page) continue;
      assert.equal(item.imageUrl, page.mediaManifest[0].src, `Homepage navigation image drift: ${item.href}`);
    }
  }
  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, pages: checks.length, checks }, null, 2));
} finally {
  await db.$disconnect();
}
