import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const read = (relative) => readFileSync(path.join(root, relative), "utf8");

const themeRenderer = read("src/components/theme-renderer.tsx");
const instantLink = read("src/components/storefront/storefront-instant-link.tsx");
const routePrefetch = read("src/components/storefront/customer-route-prefetch.tsx");
const showcasePreview = read("src/components/storefront/dreamshoot-showcase-preview.tsx");
const sectionApi = read("src/app/api/site-slugs/[siteSlug]/storefront-section/route.ts");

assert.doesNotMatch(themeRenderer, /import .*LazyStorefrontSection|<LazyStorefrontSection\b/, "public renderer must not mount lazy section API fetches");
assert.doesNotMatch(themeRenderer, /<CustomerRoutePrefetch/, "public renderer must not mount route prefetchers");
assert.match(themeRenderer, /function NativeMegaMenu/, "public navigation must have a native details menu");
assert.match(themeRenderer, /pagePath\.startsWith\("\/holidays-events\/"\)/, "holiday detail routes must be in the public SSR inventory");
assert.doesNotMatch(instantLink, /useRouter|router\.prefetch|\bfetch\s*\(/, "public links must use ordinary document navigation");
assert.doesNotMatch(routePrefetch, /useEffect|useRouter|\bfetch\s*\(/, "public route prefetch component must be inert");
assert.doesNotMatch(showcasePreview, /use client|useEffect|document\.|window\./, "public media preview must be server-only");
assert.match(sectionApi, /x-storefront-preview/, "section API must require an explicit preview marker");
assert.match(sectionApi, /public_section_fetch_disabled/, "public section API calls must be rejected");

console.log(JSON.stringify({ ok: true, rule: "public-storefront-ssr-only" }));
