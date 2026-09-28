#!/usr/bin/env node

// Relational/local parity audit for the three storefront sitemap projections.
// It intentionally reads current state only; it never mutates the database.
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const serverOnlyStub = path.join(repoRoot, "scripts", "server-only-stub.js");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request === "server-only") return serverOnlyStub;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};

const map = JSON.parse(fs.readFileSync(path.join(repoRoot, "scripts/data/storefront-source-page-map-2026-09-27.json"), "utf8"));
const jiti = createJiti(import.meta.url);
const { createPublishedSiteSnapshot } = jiti("../src/lib/storefront-context/snapshot.ts");
const { sitemapEntriesForSite } = jiti("../src/lib/seo-indexing.ts");
const { mydreamshootsVideoWatchPagesForState } = jiti("../src/lib/mydreamshoots-video-watch.ts");
const { readStorefrontPlatformStateFromDatabase } = jiti("../src/lib/storefront-state.ts");

function pathname(value) {
  return new URL(value).pathname;
}

function sitePageMap(key) {
  return new Map(map.pages.map((page) => [page[key], page]));
}

function expectedHost(site) {
  return new URL(`https://${site.primaryDomain}`).host.toLowerCase();
}

function expectedMediaRoot(site) {
  if (site.id === "site_aidreamcapes_xby") return "/assets/sites/site_aidreamcapes_eu/";
  if (site.id === "site_mydreamshoots_xby") return "/assets/sites/site_aidreamshoots/";
  return "";
}

function sitemapUrlViolations(site, entries) {
  const host = expectedHost(site);
  const mediaRoot = expectedMediaRoot(site);
  const urls = [];
  for (const entry of entries) {
    urls.push({ field: "loc", value: entry.loc });
    for (const image of entry.images ?? []) urls.push({ field: "image:loc", value: image.loc });
    if (entry.video) {
      urls.push({ field: "video:thumbnail_loc", value: entry.video.thumbnailLoc });
      urls.push({ field: "video:content_loc", value: entry.video.contentLoc });
    }
  }
  return urls.flatMap(({ field, value }) => {
    try {
      const parsed = new URL(value);
      const violations = [];
      if (parsed.host.toLowerCase() !== host) violations.push({ field, value, reason: "foreign-host" });
      if (field !== "loc" && mediaRoot && !parsed.pathname.startsWith(mediaRoot)) violations.push({ field, value, reason: "foreign-media-root" });
      if (parsed.pathname.includes("/mirror/")) violations.push({ field, value, reason: "mirror-media" });
      return violations;
    } catch {
      return [{ field, value, reason: "invalid-url" }];
    }
  });
}

function snapshotVideoPages(state, site, snapshot) {
  return mydreamshootsVideoWatchPagesForState(state, site, {
    pages: snapshot.pages.map((page) => ({
      ...page,
      slug: page.publishedJson.seo?.canonicalPath ?? page.publishedJson.seo?.canonical ?? page.slug
    })),
    homepageShowcases: snapshot.publishedHomepageShowcases,
    themeSettingsJson: snapshot.themeSettings
  });
}

function auditSite(state, site, key) {
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "postgres" });
  const entries = sitemapEntriesForSite(state, site);
  const paths = entries.map((entry) => pathname(entry.loc));
  const expectedPaths = sitePageMap(key);
  const missingRoutes = [...expectedPaths.keys()].filter((route) => !paths.includes(route));
  const unexpectedRoutes = paths.filter((route) => !expectedPaths.has(route));
  const watchPages = snapshotVideoPages(state, site, snapshot);
  const mediaViolations = watchPages.flatMap((page) => [page.contentPath, page.thumbnailPath].filter((value) =>
    site.id === "site_aidreamcapes_xby"
      ? !value.startsWith("/assets/sites/site_aidreamcapes_eu/") || value.includes("/mirror/")
      : !value.startsWith("/assets/sites/site_aidreamshoots/")
  ).map((value) => ({ watchPath: page.watchPath, value })));
  const sitemapUrlMediaViolations = sitemapUrlViolations(site, entries);
  return {
    siteId: site.id,
    origin: `https://${site.primaryDomain}`,
    sitemap: entries.length,
    expected: map.source.expectedUrlCount,
    watchPages: watchPages.length,
    watchPaths: watchPages.map((page) => page.watchPath),
    missingRoutes,
    unexpectedRoutes: [...new Set(unexpectedRoutes)],
    mediaViolations,
    sitemapUrlMediaViolations,
    sourceRoutes: expectedPaths.size
    ,...(process.argv.includes("--paths") ? { paths } : {})
  };
}

const state = await readStorefrontPlatformStateFromDatabase();
const source = state.sites.find((site) => site.id === map.source.siteId);
assert(source, `Missing source site ${map.source.siteId}`);
const capes = state.sites.find((site) => site.id === map.targets.aidreamcapes.siteId);
const shoots = state.sites.find((site) => site.id === map.targets.aidreamshoots.siteId);
assert(capes && shoots, "Missing one or more EU target sites");

const report = {
  source: { siteId: source.id, sitemap: map.source.expectedUrlCount },
  aidreamcapes: auditSite(state, capes, "aidreamcapesPath"),
  aidreamshoots: auditSite(state, shoots, "aidreamshootsPath")
};
console.log(JSON.stringify(report, null, 2));

if (process.argv.includes("--strict")) {
  for (const target of [report.aidreamcapes, report.aidreamshoots]) {
    assert.equal(target.sitemap, target.expected, `${target.siteId}: sitemap count mismatch`);
    assert.equal(target.missingRoutes.length, 0, `${target.siteId}: missing mapped route(s)`);
    assert.equal(target.unexpectedRoutes.length, 0, `${target.siteId}: unexpected indexable route(s)`);
    assert.equal(target.mediaViolations.length, 0, `${target.siteId}: cross-site watch media reference(s)`);
    assert.equal(target.sitemapUrlMediaViolations.length, 0, `${target.siteId}: sitemap host/media policy violation(s)`);
    assert.equal(target.watchPages, 21, `${target.siteId}: expected 21 watch pages`);
  }
}
