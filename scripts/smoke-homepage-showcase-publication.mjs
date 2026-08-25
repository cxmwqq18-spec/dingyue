#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const types = read("src/lib/types.ts");
const themeStore = read("src/lib/stores/theme-store.ts");
const renderer = read("src/components/theme-renderer.tsx");
const templates = read("src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const packageCatalog = read("src/components/storefront/dreamshoot-package-catalog-client.tsx");
const homepageCopy = JSON.parse(read("src/lib/mydreamshoots-homepage-copy.json"));
const trustedProofRenderer = renderer.match(/const trustedProof = showTrustedLogoIntro[\s\S]*?\n\s+const renderPublishedSection/)?.[0] ?? "";

assert.match(types, /publishedHomepageShowcases:\s*PublishedHomepageShowcaseItem\[\]/, "publication snapshot must expose homepage showcases");
assert.match(types, /homepageShowcaseRevision\?:\s*string/, "homepage showcase revision must be tracked");
assert.match(themeStore, /function buildHomepageShowcases/, "publication compiler must build homepage showcases");
assert.match(themeStore, /item\.status === "published"/, "Save the Date projection must gate on published status");
assert.match(themeStore, /publishedStandardPageMedia/, "Save the Date projection must require published media");
assert.match(renderer, /homepageShowcases/, "renderer must consume the publication projection");
assert.match(renderer, /Featured AI Video Generators/, "homepage must render the video-first heading");
assert.match(renderer, /AI Save the Date Videos/, "homepage must support the Save the Date module");
assert.match(renderer, /Featured AI Photo Generators/, "homepage must retain the photo module");
assert.match(trustedProofRenderer, /mydreamProfileSite \? \([\s\S]*?<p[\s\S]*?Creative workflow examples built with myDreamshoots/, "MyDreamShoots workflow examples title must be ordinary text");
assert.doesNotMatch(trustedProofRenderer, /mydreamProfileSite \? \([\s\S]*?<h2[\s\S]*?Creative workflow examples built with myDreamshoots/, "MyDreamShoots workflow examples title must not be an H2");
assert.doesNotMatch(packageCatalog, /<h2[^>]*>\{card\.title\}<\/h2>/, "package cards must not render card titles as H2");
assert.match(packageCatalog, /Want to bring your photos to life\? Explore AI Video Generation/, "photo package catalog must link to AI Video Generation");
assert.equal(homepageCopy.reviewTitle, "What Our Customers Say", "homepage copy contract must use the approved review heading");
assert.equal(homepageCopy.packageVideoLinkHref, "/ai-video-generation", "homepage copy contract must use the AI Video Generation route");
assert.match(renderer, /projectedVideosByPath = new Map/, "homepage video showcase must use active-publication projection rows");
assert.match(renderer, /MYDREAMSHOOTS_HOMEPAGE_VIDEO_ORDER/, "homepage video showcase must use the approved eight-item order");
assert.match(renderer, /slice\(0, Math\.max\(1, Math\.min\(6, numberSetting\(section, "saveTheDateItemLimit", 6\)\)\)\)/, "MyDreamShoots Save the Date showcase must render up to six published cards");
assert.match(renderer, /const raw = setting\(section, key, ""\)\.trim\(\);[\s\S]{0,100}if \(!raw\) return fallback;/, "numeric section settings must fall back when empty");
assert.match(renderer, /data-dreamshoot-showcase-heading=\{kind\}/, "homepage Save the Date showcase must expose a semantic heading marker");
const homeShowcaseTemplate = templates.match(/generation_showcase_1:[\s\S]*?\n  \),\n  flow_bridge_1:/)?.[0] ?? "";
assert.ok(homeShowcaseTemplate, "homepage showcase template must be present");
assert.doesNotMatch(homeShowcaseTemplate, /imageSlugs\s*:/, "homepage template must not persist static image slugs");
assert.doesNotMatch(homeShowcaseTemplate, /videoSlugs\s*:/, "homepage template must not persist static video slugs");

console.log(JSON.stringify({ ok: true, check: "homepage-showcase-publication" }, null, 2));
