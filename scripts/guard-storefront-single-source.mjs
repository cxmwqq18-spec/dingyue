import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const files = [
  "src/components/theme-renderer.tsx",
  "src/lib/section-schema.ts",
  "src/lib/data.ts",
  "src/lib/theme/packages/dreamshoot-ai-studio/templates.ts",
  "src/lib/theme/json-ld.ts",
  "src/lib/storefront-context/core.ts",
  "src/lib/storefront-metadata.ts",
  "src/lib/stores/billing-store.ts",
  "src/lib/stores/storefront-profile-store.ts",
  "src/lib/storefront-render.tsx",
  "src/lib/theme/seo.ts",
  "src/lib/storefront-context/snapshot.ts",
  "src/lib/storefront-context/seo-projection.ts",
  "src/lib/storefront-context/capabilities.ts",
  "src/lib/seo-indexing.ts",
  "src/lib/theme/publish-preflight.ts",
  "src/app/robots.txt/route.ts",
  "src/middleware.ts",
  "src/app/[...path]/page.tsx",
  "src/app/site/[siteSlug]/[...path]/page.tsx",
  "src/lib/dreamshoot-seo-content.ts",
  "src/components/admin/pricing-editor.tsx",
  "scripts/sync-dreamshoot-homepage-layout.mjs",
  "scripts/sync-dreamshoot-homepage-featured-packs.mjs",
  "scripts/sync-dreamshoot-blog-content.mjs",
  "scripts/sync-mydreamshoots-public-content-local.mjs",
  "scripts/sync-mydreamshoots-video-topic-pages.mjs",
  "scripts/sync-mydreamshoots-talking-photo.mjs",
  "scripts/sync-fan-holiday-storefront-theme.mjs"
];
const forbidden = [
  /\$24\.50/,
  /Browse all 38/i,
  /MRNARUEBET LLC/i,
  /8 THE GREEN STE B/i,
  /30 N GOULD ST STE R/i,
  /outputCount\s*\|\|\s*20/,
  /creditCost\s*\|\|\s*20/,
  /support@(?:mydreamshoots|aidreamcapes)\.com/i,
  /credits:\s*["']\d+\s+(?:credits|creditos)["']/i,
  /text\(["']credits["'][^)]*["']\d+(?:-\d+)?\s+(?:credits|creditos)["']/i,
  /Image Studio\s*-\s*\d+\s+credits/i,
  /photoCountLabel:\s*["']\d+\s+Photos["']/i,
  /price(?:Metadata|\.metadata\??)\.(?:planSubtitle|featuresText|generatedPhotos|destinationCount|deliveryDays|revisions|editingLabel|supportLevel)/,
  /knownStorefrontSeoOverride/,
  /(?:seo\?\.|seo\.)pages/,
  /\b\d+-day auto-delete\b/i,
  /lastUpdated:\s*["'](?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+\d{4}["']/
  ,/\/dreamshoot\/i\.test/
  ,/sitemapFallbackEntry|SITEMAP_STATIC_FALLBACK_LASTMOD|publicFallbackSitemapUrlsForHost/
];
const failures = [];
for (const relative of files) {
  const content = fs.readFileSync(path.join(repoRoot, relative), "utf8");
  for (const pattern of forbidden) {
    if (pattern.test(content)) failures.push({ file: relative, pattern: pattern.source });
  }
}
const read = (relative) => fs.readFileSync(path.join(repoRoot, relative), "utf8");
const packProfileSource = read("src/lib/dreamshoot-pack-profiles.ts");
const snapshotSource = read("src/lib/storefront-context/snapshot.ts");
const themeStoreSource = read("src/lib/stores/theme-store.ts");
const metadataSource = read("src/lib/storefront-metadata.ts");
const jsonLdSource = read("src/lib/theme/json-ld.ts");
const indexingSource = read("src/lib/seo-indexing.ts");
const renderSource = read("src/lib/storefront-render.tsx");
const ownershipAssertions = [
  [!/\b(?:seoTitle|galleryTitle|galleryIntro|ctaTitle|ctaSubtitle|faqItems|relatedTitle|relatedSubtitle)\??:/.test(packProfileSource), "Pack Profile still declares page SEO/copy fields"],
  [/publicationSnapshotIntegrity\(publication(?:\?\.|\.)snapshot\)/.test(snapshotSource), "published resolver does not validate snapshot integrity"],
  [!/mydreamshootsPublishedRouteManifest\(/.test(snapshotSource), "published resolver rebuilds routes from current taxonomy"],
  [!/mydreamshootsPublishedPageMediaProjections\(/.test(snapshotSource), "published resolver rebuilds media from current packs"],
  [/publishedPageEntities/.test(themeStoreSource) && /publishedOffers/.test(themeStoreSource) && /publishedFacts/.test(themeStoreSource) && /publishedLinkRefs/.test(themeStoreSource), "publication builder does not persist the complete SEO snapshot"],
  [/publicationSnapshotHash\(snapshot\)/.test(themeStoreSource), "publication builder does not seal snapshots with a hash"],
  [/resolvePublishedSeoEntity/.test(metadataSource), "metadata does not consume the unified published SEO resolver"],
  [/context\.publishedPageMedia/.test(jsonLdSource), "JSON-LD does not consume the published media projection"],
  [/resolvePublishedSeoEntity/.test(indexingSource) && /resolved\.pageMedia/.test(indexingSource), "sitemap does not consume the unified published route/media resolver"],
  [/publishedLeafCopy\(publishedSnapshot/.test(renderSource) && /creativePacks: publishedSnapshot\.creativePacks/.test(renderSource), "visible leaf rendering does not consume the published page entity adapter/collections"]
];
for (const [ok, message] of ownershipAssertions) {
  if (!ok) failures.push({ file: "single-owner-contract", pattern: message });
}
const result = { ok: failures.length === 0, checked: files, failures, allowlist: ["prisma/migrations", "archive/legacy/platform-state.json", "scripts/migrate-storefront-single-source.mjs"] };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
