import fs from "fs/promises";
import path from "path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const workspaceRoot = process.cwd();
const themeRendererPath = path.join(workspaceRoot, "src", "components", "theme-renderer.tsx");
const dreamshootTemplatePath = path.join(workspaceRoot, "src", "lib", "theme", "packages", "dreamshoot-ai-studio", "templates.ts");
const themeSeoPath = path.join(workspaceRoot, "src", "lib", "theme", "seo.ts");
const aidreamcapesMigrationPath = path.join(workspaceRoot, "scripts", "migrate-aidreamcapes-demo.mjs");
const aidreamcapesGalleryGeneratorPath = path.join(workspaceRoot, "scripts", "generate-aidreamcapes-theme-galleries.mjs");
const aidreamcapesAssetRoot = path.join(workspaceRoot, "public", "assets", "sites", "site_aidreamcapes");
const mydreamshootsAssetRoot = path.join(workspaceRoot, "public", "assets", "dreamshoot");
const state = await readPlatformStateFromSql();
const themeRendererSource = await fs.readFile(themeRendererPath, "utf8");
const dreamshootTemplateSource = await fs.readFile(dreamshootTemplatePath, "utf8");
const themeSeoSource = await fs.readFile(themeSeoPath, "utf8");
const aidreamcapesMigrationSource = await fs.readFile(aidreamcapesMigrationPath, "utf8");
const aidreamcapesGalleryGeneratorSource = await fs.readFile(aidreamcapesGalleryGeneratorPath, "utf8");

const aidreamcapesSite = (state.sites ?? []).find((site) => site.id === "site_aidreamcapes" || site.slug === "aidreamcapes");
const mydreamshootsSite = (state.sites ?? []).find((site) => site.id === "site_dreamshoot" || site.slug === "mydreamshoots");
if (!aidreamcapesSite) throw new Error("missing_site_aidreamcapes");

const forbiddenPatterns = [
  /MyDreamShoots/i,
  /mydreamshoots/i,
  /support@mydreamshoots\.com/i,
  /Fashion Editorial/i,
  /Creator Portraits/i,
  /pack_dreamshoot/i,
  /sai_dreamshoot/i,
  /n8n\.image\.dreamshoot/i,
  /World Cup/i,
  /cyberpunk/i,
  /background changer/i,
  /background-changer/i,
  /mafia/i,
  /noir/i,
  /gala photo/i,
  /free AI tools/i,
  /\/tools\/headshot/i,
  /\/tools\/world-cup-fan-photos/i,
  /\/tools\/cyberpunk-portrait/i,
  /\/tools\/background-changer/i,
  /\/tools\/gala-photo/i,
  /\/tools\/noir-portrait/i,
  /honeymoon/i,
  /wedding/i,
  /marriage/i,
  /bridal/i,
  /bride/i,
  /groom/i,
  /engagement/i,
  /valentine/i,
  /romantic/i
];

const forbiddenMydreamshootsPatterns = [
  /Aidreamcapes/i,
  /aidreamcapes/i,
  /support@aidreamcapes\.com/i,
  /aidreamcapes\.com/i,
  /\/assets\/sites\/site_aidreamcapes/i
];

const forbiddenAidreamcapesImageNames = [
  "cinematic-travel",
  "coastal-escapes",
  "desi-wedding",
  "golden-hour-couples",
  "honeymoon-itinerary-scenes",
  "proof-couple-engagement",
  "social-keepsakes"
];

const aidreamcapesLaunchKeywords = "Dream Photos,Dream Photoshoot,Wedding Photoshoot,Wedding Photos,AI Photos,AI Photoshoot,Couple Photos";

const allowedAidreamcapesRoutes = new Set([
  "/",
  "/pricing",
  "/collections",
  "/tools",
  "/tools/portrait-generator",
  "/tools/portrait-maker",
  "/tools/headshot",
  "/tools/route-portrait-engine",
  "/tools/coastal-portrait",
  "/tools/island-resort-scenes",
  "/tools/scenic-overlook-story",
  "/tools/golden-hour-route-story",
  "/tools/celestial-profile-story",
  "/tools/travel-profile-story",
  "/tools/editorial-getaway",
  "/tools/cafe-street-story",
  "/tools/cinematic-travel",
  "/tools/route-moodboard",
  "/tools/social-keepsake",
  "/tools/lagoon-portrait-mixer",
  "/tools/desert-road-portraits",
  "/tools/rail-journey-frames",
  "/tools/market-morning-portraits",
  "/tools/rooftop-skyline-set",
  "/tools/rainy-city-album",
  "/tools/private-villa-portraits",
  "/tools/wellness-retreat-scenes",
  "/tools/snow-lodge-portraits",
  "/tools/lake-house-weekend",
  "/tools/shared-route-album",
  "/tools/family-travel-keepsakes",
  "/tools/solo-traveler-profile-set",
  "/tools/travel-journal-cover-maker",
  "/tools/private-album-curator",
  "/collections/coastal-light-sets",
  "/collections/golden-hour-route-stories",
  "/collections/celestial-profile-stories",
  "/collections/editorial-getaways",
  "/collections/cafe-corner-stories",
  "/collections/cinematic-travel",
  "/collections/route-moodboard",
  "/collections/social-keepsakes",
  "/collections/route-portrait-albums",
  "/collections/coastal-getaways",
  "/collections/old-city-walks",
  "/collections/island-resort-scenes",
  "/collections/cafe-street-stories",
  "/collections/scenic-overlooks",
  "/collections/mountain-trails",
  "/collections/road-trip-frames",
  "/collections/itinerary-moodboards",
  "/collections/postcard-social-sets",
  "/help",
  "/workflow",
  "/creators-circle",
  "/partner-registration",
  "/faq",
  "/about-us",
  "/contact-us",
  "/blog",
  "/blog/planning-dreamscape-source-photos",
  "/search",
  "/cart",
  "/login",
  "/account",
  "/app",
  "/app/jobs/progress",
  "/app/jobs/detail",
  "/privacy",
  "/terms",
  "/refunds",
  "/content",
  "/cookies",
  "/children-privacy",
  "/state-privacy",
  "/policies/privacy",
  "/policies/shipping",
  "/policies/refunds",
  "/policies/terms",
  "/policies/content",
  "/policies/cookies",
  "/policies/children-privacy",
  "/policies/state-privacy",
  "/tools/destination-portrait-engine",
  "/tools/soft-glam",
  "/ai-image-generation/ecommerce-main-image",
  "/tools/couple-escape-album",
  "/collections/destination-portrait-albums"
]);

function normalizeImageUrl(url) {
  return String(url ?? "").trim().split("?")[0];
}

function duplicateGroups(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function stableStringify(value) {
  return JSON.stringify(value, null, 2);
}

function stripAllowedAidreamcapesLaunchSeo(value) {
  return String(value ?? "").split(aidreamcapesLaunchKeywords).join("");
}

function collectText(value, out = []) {
  if (typeof value === "string") {
    const trimmed = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    if (trimmed) out.push(trimmed);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectText(entry, out);
  }
  return out;
}

function collectAssetUrls(value, out = []) {
  if (typeof value === "string") {
    for (const part of value.split("|").map((item) => item.trim()).filter(Boolean)) {
      if (part.startsWith("/assets/")) out.push(part);
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAssetUrls(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const entry of Object.values(value)) collectAssetUrls(entry, out);
  }
  return out;
}

function visibleStringsForSite(site) {
  const parts = [
    site.name,
    site.primaryDomain,
    site.branding,
    site.themeSettings?.publishedJson,
    ...(site.pages ?? []).map((page) => page.publishedJson)
  ];
  const sitePacks = (state.creativePacks ?? []).filter((pack) => pack.siteId === site.id);
  const siteCategories = (state.creativePackCategories ?? []).filter((category) => category.siteId === site.id);
  const siteToolCategories = (state.toolCategories ?? []).filter((category) => category.siteId === site.id);
  const siteToolMenuItems = (state.toolMenuItems ?? []).filter((item) => item.siteId === site.id);
  parts.push(sitePacks, siteCategories, siteToolCategories, siteToolMenuItems);
  return collectText(parts)
    .map((text) => text.replace(/\s+/g, " ").trim())
    .filter((text) => text.length >= 12)
    .filter((text) => !text.startsWith("/assets/"))
    .filter((text) => !text.startsWith("@font-face"))
    .filter((text) => !text.includes("var(--font"))
    .filter((text) => !text.includes("linear-gradient("))
    .filter((text) => !/^[a-z0-9_:-]+$/.test(text))
    .filter((text) => !/^#[0-9a-f]{3,8}$/i.test(text));
}

function normalizeForDupes(text) {
  return text
    .toLowerCase()
    .replace(/aidreamcapes|mydreamshoots|dreamshootai|dreamshoot/g, "{brand}")
    .replace(/www\.aidreamcapes\.com|aidreamcapes\.com|www\.mydreamshoots\.com|mydreamshoots\.com/g, "{domain}")
    .replace(/[^a-z0-9{} ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractHrefs(value, out = []) {
  if (typeof value === "string") {
    const hrefMatches = value.matchAll(/href=["']([^"']+)["']/g);
    for (const match of hrefMatches) out.push(match[1]);
    if (/^\/(tools|collections|blog|help|pricing|policies|cart|login|account|app|search)(\/|$|\?)/.test(value)) out.push(value);
    return out;
  }
  if (Array.isArray(value)) {
    for (const item of value) extractHrefs(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      if (key === "href" && typeof entry === "string") out.push(entry);
      extractHrefs(entry, out);
    }
  }
  return out;
}

async function listFiles(root, out = []) {
  let entries = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await listFiles(fullPath, out);
    } else {
      out.push(path.relative(workspaceRoot, fullPath));
    }
  }
  return out;
}

async function referencedAssetExists(url) {
  const cleanUrl = String(url || "").split("?")[0];
  if (!cleanUrl.startsWith("/assets/")) return true;
  try {
    const stat = await fs.stat(path.join(workspaceRoot, "public", cleanUrl.slice(1)));
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function assertReferencedAssetsExist(scope, value, failures) {
  const seen = new Set();
  for (const url of collectAssetUrls(value)) {
    const cleanUrl = String(url).split("?")[0];
    if (seen.has(cleanUrl)) continue;
    seen.add(cleanUrl);
    if (!await referencedAssetExists(cleanUrl)) failures.push(`missing_asset:${scope}:${url}`);
  }
}

function collectCollectionImageCards(value, out = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectCollectionImageCards(item, out);
    return out;
  }
  if (!value || typeof value !== "object") return out;

  const href = typeof value.href === "string" ? value.href.split("#")[0].split("?")[0] : "";
  const imageUrl = typeof value.imageUrl === "string" ? value.imageUrl : "";
  const title = typeof value.title === "string" ? value.title : typeof value.label === "string" ? value.label : href;
  if (href.startsWith("/collections/") && imageUrl) {
    out.push({ href, imageUrl, title });
  }

  for (const entry of Object.values(value)) collectCollectionImageCards(entry, out);
  return out;
}

const failures = [];
const aidreamcapesBundle = {
  site: aidreamcapesSite,
  packs: (state.creativePacks ?? []).filter((pack) => pack.siteId === aidreamcapesSite.id),
  categories: (state.creativePackCategories ?? []).filter((category) => category.siteId === aidreamcapesSite.id),
  toolCategories: (state.toolCategories ?? []).filter((category) => category.siteId === aidreamcapesSite.id),
  toolMenuItems: (state.toolMenuItems ?? []).filter((item) => item.siteId === aidreamcapesSite.id),
  jobs: (state.jobs ?? []).filter((job) => job.siteId === aidreamcapesSite.id),
  assetUploads: (state.assetUploads ?? []).filter((asset) => asset.siteId === aidreamcapesSite.id),
  mediaAssets: (state.mediaAssets ?? []).filter((asset) => asset.siteId === aidreamcapesSite.id)
};
const aidreamcapesJson = stableStringify(aidreamcapesBundle);
const aidreamcapesBrandScanJson = stripAllowedAidreamcapesLaunchSeo(aidreamcapesJson);

for (const pattern of forbiddenPatterns) {
  if (pattern.test(aidreamcapesBrandScanJson)) failures.push(`forbidden_content:${pattern}`);
}
await assertReferencedAssetsExist("aidreamcapes", aidreamcapesBundle, failures);

if (mydreamshootsSite) {
  const mydreamshootsBundle = {
    site: mydreamshootsSite,
    packs: (state.creativePacks ?? []).filter((pack) => pack.siteId === mydreamshootsSite.id),
    categories: (state.creativePackCategories ?? []).filter((category) => category.siteId === mydreamshootsSite.id),
    toolCategories: (state.toolCategories ?? []).filter((category) => category.siteId === mydreamshootsSite.id),
    toolMenuItems: (state.toolMenuItems ?? []).filter((item) => item.siteId === mydreamshootsSite.id),
    jobs: (state.jobs ?? []).filter((job) => job.siteId === mydreamshootsSite.id),
    assetUploads: (state.assetUploads ?? []).filter((asset) => asset.siteId === mydreamshootsSite.id),
    mediaAssets: (state.mediaAssets ?? []).filter((asset) => asset.siteId === mydreamshootsSite.id)
  };
  const mydreamshootsJson = stableStringify(mydreamshootsBundle);
  for (const pattern of forbiddenMydreamshootsPatterns) {
    if (pattern.test(mydreamshootsJson)) failures.push(`mydreamshoots_forbidden_content:${pattern}`);
  }
  await assertReferencedAssetsExist("mydreamshoots", mydreamshootsBundle, failures);
}

const aidreamcapesPacks = (state.creativePacks ?? []).filter(
  (pack) => pack.siteId === aidreamcapesSite.id && pack.status === "active"
);
const missingPackImages = aidreamcapesPacks.filter((pack) => !normalizeImageUrl(pack.imageUrl));
if (missingPackImages.length) {
  failures.push(`missing_pack_images:${missingPackImages.map((pack) => pack.name).join(" | ")}`);
}
for (const [imageUrl, packs] of duplicateGroups(aidreamcapesPacks, (pack) => normalizeImageUrl(pack.imageUrl))) {
  failures.push(`duplicate_pack_image:${imageUrl}:${packs.map((pack) => pack.name).join(" | ")}`);
}

const collectionImageCards = [];
for (const page of aidreamcapesSite.pages ?? []) {
  collectCollectionImageCards(page.publishedJson, collectionImageCards);
}
const uniqueCollectionCards = [...collectionImageCards.reduce((map, card) => {
  if (!map.has(card.href)) map.set(card.href, card);
  return map;
}, new Map()).values()];
for (const [imageUrl, cards] of duplicateGroups(uniqueCollectionCards, (card) => normalizeImageUrl(card.imageUrl))) {
  failures.push(`duplicate_collection_card_image:${imageUrl}:${cards.map((card) => `${card.title}(${card.href})`).join(" | ")}`);
}
for (const card of uniqueCollectionCards) {
  const normalizedImage = normalizeImageUrl(card.imageUrl).toLowerCase();
  for (const forbiddenName of forbiddenAidreamcapesImageNames) {
    if (normalizedImage.includes(forbiddenName)) {
      failures.push(`forbidden_collection_image:${card.title}(${card.href}):${normalizedImage}`);
    }
  }
}

const aidreamcapesToolMenuItems = (state.toolMenuItems ?? []).filter(
  (item) => item.siteId === aidreamcapesSite.id && item.status === "active"
);
for (const [imageUrl, items] of duplicateGroups(aidreamcapesToolMenuItems, (item) => normalizeImageUrl(item.imageUrl))) {
  failures.push(`duplicate_tool_menu_image:${imageUrl}:${items.map((item) => `${item.title}(${item.href})`).join(" | ")}`);
}

for (const assetPath of await listFiles(aidreamcapesAssetRoot)) {
  for (const forbiddenName of forbiddenAidreamcapesImageNames) {
    if (assetPath.toLowerCase().includes(forbiddenName)) failures.push(`forbidden_asset_filename:${assetPath}`);
  }
  for (const pattern of [/cyberpunk/i, /noir/i, /wedding/i, /engagement/i, /romantic/i, /honeymoon/i]) {
    if (pattern.test(assetPath)) failures.push(`forbidden_asset_filename:${assetPath}`);
  }
}

for (const assetPath of await listFiles(mydreamshootsAssetRoot)) {
  for (const pattern of forbiddenMydreamshootsPatterns) {
    if (pattern.test(assetPath)) failures.push(`mydreamshoots_forbidden_asset_filename:${assetPath}`);
  }
}

const fallbackSeedMatch = themeRendererSource.match(/const aidreamcapesFallbackCatalogCardsSeed:[\s\S]*?\n\];/);
if (!fallbackSeedMatch) {
  failures.push("missing_aidreamcapes_fallback_catalog_seed");
} else {
  const fallbackSeedSource = fallbackSeedMatch[0];
  const fallbackBrandScanSource = stripAllowedAidreamcapesLaunchSeo(fallbackSeedSource);
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(fallbackBrandScanSource)) failures.push(`forbidden_fallback_content:${pattern}`);
  }

  const fallbackCards = [...fallbackSeedSource.matchAll(/title:\s*"([^"]+)"[\s\S]*?imageUrl:\s*"([^"]+)"/g)]
    .map((match) => ({ title: match[1], imageUrl: match[2] }));
  const missingFallbackImages = fallbackCards.filter((card) => !normalizeImageUrl(card.imageUrl));
  if (missingFallbackImages.length) {
    failures.push(`missing_fallback_images:${missingFallbackImages.map((card) => card.title).join(" | ")}`);
  }
  for (const [imageUrl, cards] of duplicateGroups(fallbackCards, (card) => normalizeImageUrl(card.imageUrl))) {
    failures.push(`duplicate_fallback_image:${imageUrl}:${cards.map((card) => card.title).join(" | ")}`);
  }
}

const aidreamcapesSyntheticTemplateMatch = dreamshootTemplateSource.match(/const aidreamcapesPublicAssets[\s\S]*?\nexport function dreamshootAiStudioTemplatesForSite/);
if (!aidreamcapesSyntheticTemplateMatch) {
  failures.push("missing_aidreamcapes_synthetic_template_copy");
} else {
  const aidreamcapesSyntheticTemplateSource = aidreamcapesSyntheticTemplateMatch[0];
  const syntheticBrandScanSource = stripAllowedAidreamcapesLaunchSeo(aidreamcapesSyntheticTemplateSource);
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(syntheticBrandScanSource)) failures.push(`forbidden_synthetic_template_content:${pattern}`);
  }
  if (!/partner-registration/.test(aidreamcapesSyntheticTemplateSource) || !/support@aidreamcapes\.com/.test(aidreamcapesSyntheticTemplateSource)) {
    failures.push("missing_aidreamcapes_partner_template_routes_or_email");
  }
}

const aidreamcapesSeoMatch = themeSeoSource.match(/if \(isAidreamcapesSeoSite\(site\)\) \{\s*return \{[\s\S]*?\n\s*\};\n\s*\}/);
if (!aidreamcapesSeoMatch) {
  failures.push("missing_aidreamcapes_launch_seo_override");
} else {
  const seoBrandScanSource = stripAllowedAidreamcapesLaunchSeo(aidreamcapesSeoMatch[0]);
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(seoBrandScanSource)) failures.push(`forbidden_aidreamcapes_seo_source:${pattern}`);
  }
}
if (/\/assets\/dreamshoot\/brand\/aidreamcapes/i.test(themeSeoSource)) {
  failures.push("forbidden_cross_store_brand_asset_source:theme_seo");
}

const aidreamcapesMigrationSeedMatch = aidreamcapesMigrationSource.match(/const parentCategoryRows = \[[\s\S]*?\nconst categoryBySlug = new Map/);
if (!aidreamcapesMigrationSeedMatch) {
  failures.push("missing_aidreamcapes_migration_seed");
} else {
  const migrationBrandScanSource = stripAllowedAidreamcapesLaunchSeo(aidreamcapesMigrationSeedMatch[0]);
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(migrationBrandScanSource)) failures.push(`forbidden_aidreamcapes_migration_seed:${pattern}`);
  }
  for (const requiredSlug of ["city-light-night-walks", "evening-route-portraits", "milestone-postcard-sets", "heritage-celebration-portraits"]) {
    if (!aidreamcapesMigrationSeedMatch[0].includes(requiredSlug)) failures.push(`missing_aidreamcapes_migration_seed_slug:${requiredSlug}`);
  }
}
for (const pattern of forbiddenPatterns) {
  if (pattern.test(stripAllowedAidreamcapesLaunchSeo(aidreamcapesGalleryGeneratorSource))) failures.push(`forbidden_aidreamcapes_gallery_generator:${pattern}`);
}

const hrefs = [...new Set(extractHrefs(aidreamcapesSite).map((href) => href.split("#")[0].split("?")[0]).filter((href) => href.startsWith("/")))];
for (const href of hrefs) {
  if (!allowedAidreamcapesRoutes.has(href)) {
    failures.push(`unexpected_internal_link:${href}`);
  }
}

if (mydreamshootsSite) {
  const mydreamText = new Set(visibleStringsForSite(mydreamshootsSite).map(normalizeForDupes).filter((text) => text.length >= 24));
  const duplicates = visibleStringsForSite(aidreamcapesSite)
    .map((text) => ({ raw: text, normalized: normalizeForDupes(text) }))
    .filter((item) => item.normalized.length >= 24 && mydreamText.has(item.normalized))
    .filter((item) => !/privacy|terms|cookie|refund|credits|checkout|account|gallery|upload|download|subscription|source photos|all rights reserved|plans start|customers|private|secure|help center|pricing|company address|mailing address|business correspondence|8 THE GREEN|contact .*support|support or sales/i.test(item.raw))
    .slice(0, 30);
  if (duplicates.length) {
    failures.push(`visible_copy_duplicates:${duplicates.map((item) => item.raw).join(" || ")}`);
  }
}

if (failures.length) {
  console.error("Aidreamcapes brand/link smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Aidreamcapes brand/link smoke passed. Checked ${hrefs.length} internal links and ${visibleStringsForSite(aidreamcapesSite).length} text strings.`);
