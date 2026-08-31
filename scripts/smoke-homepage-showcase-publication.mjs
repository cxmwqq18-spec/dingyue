#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const types = read("src/lib/types.ts");
const themeStore = read("src/lib/stores/theme-store.ts");
const renderer = read("src/components/theme-renderer.tsx");
const logoShowcase = read("src/components/storefront/mydreamshoots-logo-showcase.tsx");
const globalStyles = read("src/app/globals.css");
const templates = read("src/lib/theme/packages/dreamshoot-ai-studio/templates.ts");
const packageCatalog = read("src/components/storefront/dreamshoot-package-catalog-client.tsx");
const homepageCopy = JSON.parse(read("src/lib/mydreamshoots-homepage-copy.json"));
const expectedReviewKeys = [
  "review_ava",
  "review_lucas",
  "review_mia",
  "review_noah",
  "review_chloe",
  "review_eli",
  "review_jordan",
  "review_riley"
];
const expectedLogoFiles = [
  "30-ikraddy.webp", "09-hana-pet.webp", "07-fumei.webp", "15-mrlin.webp", "20-popo.webp",
  "04-coffee-swap.webp", "05-ezzy.webp", "26-xraz.webp", "08-giantdc.webp", "24-smart-check.webp",
  "22-prevence.webp", "10-heart-beat.webp", "23-shurong-lim.webp", "27-yu-kidsrooms.webp", "14-mr-sdm.webp",
  "02-bison.webp", "25-tosaco.webp", "06-fb.webp", "11-jo.webp", "12-laboom.webp",
  "16-mashtacore.webp", "17-monkey.webp", "13-moonpizza.webp", "18-observer.webp", "19-oficina.webp",
  "21-panda-ber.webp", "28-yx.webp", "29-beer.webp", "01-anteater.webp", "03-chinawuzhougem.webp"
];

assert.match(types, /publishedHomepageShowcases:\s*PublishedHomepageShowcaseItem\[\]/, "publication snapshot must expose homepage showcases");
assert.match(types, /homepageShowcaseRevision\?:\s*string/, "homepage showcase revision must be tracked");
assert.match(themeStore, /function buildHomepageShowcases/, "publication compiler must build homepage showcases");
assert.match(themeStore, /imageUrl:\s*pageMediaItem\.primaryImage/, "homepage video covers must come from the relational page-media projection");
assert.match(themeStore, /item\.status === "published"/, "Save the Date projection must gate on published status");
assert.match(themeStore, /publishedStandardPageMedia/, "Save the Date projection must require published media");
assert.match(renderer, /homepageShowcases/, "renderer must consume the publication projection");
assert.match(renderer, /Featured AI Video Generators/, "homepage must render the video-first heading");
assert.match(renderer, /AI Save the Date Videos/, "homepage must support the Save the Date module");
assert.match(renderer, /Featured AI Photo Generators/, "homepage must retain the photo module");
assert.match(logoShowcase, /CREATIVE SHOWCASE/, "MyDreamShoots logo wall must render the supplied HTML eyebrow");
assert.match(logoShowcase, /<h2 id="mydreamshoots-logo-showcase-title">\s*<span>\{title\}<\/span>/, "MyDreamShoots logo wall must render the database-driven HTML heading");
assert.match(logoShowcase, /Ideas, brands and visual experiments brought together with AI\./, "MyDreamShoots logo wall must render the supplied HTML subtitle");
assert.match(logoShowcase, /<h2 id="mydreamshoots-logo-showcase-title">/, "MyDreamShoots logo wall must retain the example HTML heading semantics");
assert.match(logoShowcase, /<LogoGroup duplicate logos=\{logos\} \/>/, "MyDreamShoots logo rows must duplicate their groups for seamless animation");
assert.match(globalStyles, /mydreamshoots-logo-row--left[\s\S]*animation:\s*mydreamshoots-logo-marquee-left var\(--mydreamshoots-logo-duration\) linear infinite/, "MyDreamShoots logo wall must retain the supplied HTML animation timing");
assert.match(globalStyles, /\.mydreamshoots-logo-card img[\s\S]*width:\s*68px;[\s\S]*height:\s*68px;/, "MyDreamShoots logo art must use the requested 68px homepage dimensions");
assert.doesNotMatch(packageCatalog, /<h2[^>]*>\{card\.title\}<\/h2>/, "package cards must not render card titles as H2");
assert.match(packageCatalog, /Want to bring your photos to life\? Explore AI Video Generation/, "photo package catalog must link to AI Video Generation");
assert.equal(homepageCopy.reviewTitle, "What Our Customers Say", "homepage copy contract must use the approved review heading");
assert.equal(homepageCopy.packageVideoLinkHref, "/ai-video-generation", "homepage copy contract must use the AI Video Generation route");
assert.deepEqual(Object.keys(homepageCopy.reviewQuotes ?? {}), expectedReviewKeys, "homepage review copy must contain exactly eight ordered quote keys");
for (const key of expectedReviewKeys) {
  assert.equal(typeof homepageCopy.reviewQuotes[key], "string", `${key} must have a string quote`);
  assert.ok(homepageCopy.reviewQuotes[key].trim(), `${key} quote must not be empty`);
  assert.match(templates, new RegExp(`reviewQuotes\\.${key}\\b`), `template must read the approved ${key} quote`);
  assert.match(read("scripts/sync-dreamshoot-homepage-layout.mjs"), new RegExp(`reviewQuotes\\.${key}\\b`), `layout sync must read the approved ${key} quote`);
  assert.match(read("scripts/sync-mydreamshoots-public-content-local.mjs"), new RegExp(`reviewQuotes\\.${key}\\b`), `content sync must read the approved ${key} quote`);
}
assert.match(renderer, /projectedVideosByPath = new Map/, "homepage video showcase must use active-publication projection rows");
assert.match(renderer, /MYDREAMSHOOTS_HOMEPAGE_VIDEO_ORDER/, "homepage video showcase must use the approved nine-item order");
assert.match(renderer, /slice\(0, Math\.max\(1, Math\.min\(6, numberSetting\(section, "saveTheDateItemLimit", 6\)\)\)\)/, "MyDreamShoots Save the Date showcase must render up to six published cards");
assert.match(renderer, /const raw = setting\(section, key, ""\)\.trim\(\);[\s\S]{0,100}if \(!raw\) return fallback;/, "numeric section settings must fall back when empty");
assert.match(renderer, /data-dreamshoot-showcase-heading=\{kind\}/, "homepage Save the Date showcase must expose a semantic heading marker");
const homeShowcaseTemplate = templates.match(/generation_showcase_1:[\s\S]*?\n  \),\n  flow_bridge_1:/)?.[0] ?? "";
assert.ok(homeShowcaseTemplate, "homepage showcase template must be present");
assert.doesNotMatch(homeShowcaseTemplate, /imageSlugs\s*:/, "homepage template must not persist static image slugs");
assert.doesNotMatch(homeShowcaseTemplate, /videoSlugs\s*:/, "homepage template must not persist static video slugs");
for (const logoFile of expectedLogoFiles) {
  assert.ok(fs.existsSync(path.join(root, "public/assets/dreamshoot/brand/logo-wall-demo", logoFile)), `${logoFile} must be bundled with the logo wall`);
  assert.match(templates, new RegExp(logoFile.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${logoFile} must be wired into the homepage template`);
}

console.log(JSON.stringify({ ok: true, check: "homepage-showcase-publication" }, null, 2));
