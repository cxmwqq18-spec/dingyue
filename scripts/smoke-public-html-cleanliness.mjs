import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const layout = read("src/app/layout.tsx");
const metadata = read("src/lib/storefront-metadata.ts");
const themeSeo = read("src/lib/theme/seo.ts");
const middleware = read("src/middleware.ts");
const robots = read("src/app/robots.txt/route.ts");
const sitemap = read("src/app/sitemap.xml/route.ts");
const renderer = read("src/components/theme-renderer.tsx");
const designerPreview = read("src/components/designer/preview-frame.tsx");
const designerListener = read("src/components/designer/iframe-patch-listener.tsx");
const saasAction = read("src/app/api/sites/[siteId]/theme/saas-action/route.ts");
const deploy = read("scripts/deploy-release.mjs");
const nextConfig = read("next.config.mjs");

const publicMetadataSources = `${layout}\n${metadata}\n${themeSeo}`;
for (const marker of [
  "release-commit",
  "storefront-build",
  "storefront-data-source",
  "storefront-facts-revision"
]) {
  assert.doesNotMatch(publicMetadataSources, new RegExp(marker), `public metadata must not expose ${marker}`);
}
assert.doesNotMatch(themeSeo, /\bkeywords:\s*seo\.keywords\b/, "public metadata must not serialize CMS keywords");
assert.doesNotMatch(middleware, /x-storefront-build/i, "public HTML responses must not expose a build header");
assert.doesNotMatch(middleware, /headers\.set\(["']x-storefront-/i, "middleware must not add internal x-storefront response headers");
assert.doesNotMatch(robots, /x-storefront-/i, "robots.txt must not expose storefront identity headers");
assert.doesNotMatch(sitemap, /x-(?:storefront|sitemap)-/i, "sitemap.xml must not expose internal diagnostic headers");
assert.match(nextConfig, /poweredByHeader:\s*false/, "Next.js implementation header must be disabled");

assert.doesNotMatch(renderer, /data-xfcart-block-legacy-id/, "renderer must not emit legacy block identifiers");
assert.doesNotMatch(designerPreview, /data-xfcart-block-legacy-id/, "designer preview must use canonical block identifiers only");
assert.doesNotMatch(designerListener, /data-xfcart-block-legacy-id/, "designer listener must use canonical block identifiers only");
assert.doesNotMatch(`${renderer}\n${saasAction}`, /data-section-style/, "empty section style attributes must not be emitted");
assert.doesNotMatch(renderer, /AI shoot packages, creator portraits, headshots, fan photos, and private albums/, "hidden keyword copy must not be rendered");
assert.doesNotMatch(renderer, /private fan-scene photo albums and holiday memory sets/, "hidden keyword copy must not be rendered");

assert.doesNotMatch(deploy, /<meta name="release-commit"/, "deployment must not depend on public release metadata");
assert.match(deploy, /\.deployed-commit/, "deployment must verify the release manifest");

console.log(JSON.stringify({ ok: true, contract: "public-html-cleanliness" }, null, 2));
