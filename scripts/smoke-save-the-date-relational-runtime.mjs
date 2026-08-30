#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

const siteStore = read("src/lib/stores/site-store.ts");
const contextCore = read("src/lib/storefront-context/core.ts");
const tdk = read("src/lib/mydreamshoots-tdk.ts");
const alt = read("src/lib/storefront-media-alt.ts");
const renderer = read("src/components/theme-renderer.tsx");
const topicSmoke = read("scripts/smoke-save-the-date-topic-pages.mjs");
const storefrontMetadata = read("src/lib/storefront-metadata.ts");
const themeSeo = read("src/lib/theme/seo.ts");

assert.match(siteStore, /const isEditorialThemeDetail =/,
  "editorial detail routes must have an explicit relational runtime profile");
assert.match(siteStore, /mediaAssets:\s*isHome[^\n]+isEditorialThemeDetail/,
  "editorial detail SSR must load its MediaAsset owners");
assert.match(siteStore, /public-page-metadata-host:[\s\S]+?toPublicSiteShell\(site, mappedMediaAssets\)/,
  "editorial metadata SSR must load the same relational MediaAsset owners");
assert.match(siteStore, /public-page-metadata:\$\{canonicalSlug\}[\s\S]+?toPublicSiteShell\(site, mappedMediaAssets\)/,
  "slug-based editorial metadata SSR must load the same relational MediaAsset owners");
assert.doesNotMatch(contextCore, /snapshotFailClosed|published\.seo\.snapshot/,
  "public indexability must not depend on a historical snapshot");
assert.match(tdk, /keywords:\s*clean\(tdk\.keywords\)\s*\|\|/,
  "explicit relational SEO keywords must win over generated fallbacks");
assert.match(alt, /if \(explicit && !genericFileAlt\) return explicit;/,
  "reviewed relational alt text must be emitted without lossy compaction");
assert.match(renderer, /const stepTitle = blockValue\(block, "title"\);/,
  "step headings must be conditional so empty h3 elements are not emitted");
assert.match(renderer, /stepImage/,
  "editorial step media configured in relational data must render in SSR");
assert.doesNotMatch(topicSmoke, /sitePublishedState|currentState|snapshot\./,
  "Save the Date smoke must validate relational ThemePage data, not snapshots");
assert.doesNotMatch(`${storefrontMetadata}\n${themeSeo}`, /storefront-(?:publication|snapshot-hash|current-revision)/,
  "public metadata must not expose obsolete publication or snapshot state");
assert.doesNotMatch(`${storefrontMetadata}\n${themeSeo}`, /storefront-data-source/,
  "public metadata must not identify the relational data source");

console.log("Save the Date relational runtime remediation contract passed.");
