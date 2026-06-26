import fs from "fs";
import path from "path";

const repoRoot = process.cwd();

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function fail(message, details = {}) {
  console.error(`MydreamShoots SEO indexing smoke failed: ${message}`);
  if (Object.keys(details).length) console.error(JSON.stringify(details, null, 2));
  process.exit(1);
}

function assert(condition, message, details) {
  if (!condition) fail(message, details);
}

const seoIndexing = readText("src/lib/seo-indexing.ts");
const seoContent = readText("src/lib/dreamshoot-seo-content.ts");
const jsonLd = readText("src/lib/theme/json-ld.ts");
const storefrontRender = readText("src/lib/storefront-render.tsx");
const siteToolPage = readText("src/app/site/[siteSlug]/tools/[toolSlug]/page.tsx");
const hostCatchAllPage = readText("src/app/[...path]/page.tsx");

for (const pathName of ["/tools/image-studio", "/tools/travel-portraits"]) {
  assert(seoIndexing.includes(`"${pathName}"`), "sitemap non-indexable tool exclusions must include blocked legacy paths", { pathName });
}

assert(
  seoContent.includes("explicit: boolean") &&
    seoContent.includes("isExplicitSeoDirectoryContent") &&
    seoContent.includes("index: item.explicit"),
  "fallback directory metadata must default to noindex unless content is explicitly configured"
);
assert(
  seoContent.includes("defaultOgImage") &&
    seoContent.includes("openGraph") &&
    seoContent.includes("twitter") &&
    seoContent.includes("summary_large_image"),
  "dynamic directory metadata must include the site default OG/Twitter image when configured"
);
assert(
  seoIndexing.includes('isExplicitSeoDirectoryContent("collection"') &&
    seoIndexing.includes('isExplicitSeoDirectoryContent("tool"') &&
    seoIndexing.includes("addCollectionPath(paths, collectionPath)"),
  "sitemap dynamic directory collection must exclude fallback collection/tool paths"
);
assert(
  jsonLd.includes("buildCollectionDirectoryJsonLd") &&
    jsonLd.includes('"@type": "CollectionPage"') &&
    jsonLd.includes('"@type": "ItemList"') &&
    jsonLd.includes("breadcrumbs(site, routeMode, pagePath, item.label)") &&
    storefrontRender.includes("buildCollectionDirectoryJsonLd") &&
    storefrontRender.includes("buildToolDirectoryJsonLd"),
  "focused collection pages must have BreadcrumbList and CollectionPage/ItemList JSON-LD without replacing tool JSON-LD"
);

assert(
  siteToolPage.includes("permanentRedirect(`/site/${publicSiteSlug}${redirectPath}`)"),
  "site-slug tool route must permanently redirect MydreamShoots legacy tool paths"
);
assert(
  hostCatchAllPage.includes("permanentRedirect(redirectPath)"),
  "host storefront route must permanently redirect MydreamShoots legacy tool paths"
);
assert(
  siteToolPage.includes('"image-studio": "/tools"') &&
    hostCatchAllPage.includes('"image-studio": "/tools"') &&
    siteToolPage.includes('"travel-portraits": "/tools/nature-adventure"') &&
    hostCatchAllPage.includes('"travel-portraits": "/tools/nature-adventure"'),
  "legacy tool redirect map must keep image-studio and travel-portraits explicit"
);

console.log(JSON.stringify({
  ok: true,
  sitemapExcludedTools: ["/tools/image-studio", "/tools/travel-portraits"],
  fallbackDirectoryIndexing: "noindex",
  focusedCollectionJsonLd: ["BreadcrumbList", "CollectionPage", "ItemList"],
  redirects: {
    "/tools/image-studio": "/tools",
    "/tools/travel-portraits": "/tools/nature-adventure"
  }
}, null, 2));
