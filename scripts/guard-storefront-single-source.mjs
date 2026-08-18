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
  "src/app/robots.ts",
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
const result = { ok: failures.length === 0, checked: files, failures, allowlist: ["data/platform-state.json", "prisma/migrations", "scripts/migrate-storefront-single-source.mjs"] };
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exitCode = 1;
