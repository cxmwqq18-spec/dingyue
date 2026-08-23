import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const publicRoot = path.join(repoRoot, "public");
const prisma = new PrismaClient();
const state = await readPlatformStateFromSql(prisma);

const siteIds = ["site_dreamshoot", "site_aidreamcapes"];
const failures = [];
const aidreamcapesThemeParentSlugs = new Set([
  "fan-scene-albums",
  "game-day-group-photos",
  "premiere-style-portraits",
  "christmas-holiday-albums",
  "thanksgiving-memory-sets",
  "halloween-party-portraits",
  "seasonal-celebration-photos"
]);

function normalizeImageUrl(value) {
  if (typeof value !== "string") return "";
  const [url] = value.split("?");
  return url.startsWith("/assets/") && /\.(?:png|jpe?g|webp|avif|svg)$/i.test(url) ? url : "";
}

function localFileForUrl(url) {
  return path.join(publicRoot, url);
}

function uniqueImageUrls(values) {
  const seen = new Set();
  const urls = [];
  for (const value of values) {
    const url = normalizeImageUrl(value);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

function hashFile(url) {
  const filePath = localFileForUrl(url);
  if (!fs.existsSync(filePath)) {
    failures.push(`missing_image_file:${url}`);
    return "";
  }
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function perceptualHashFile(url) {
  if (!/\.(?:png|jpe?g|webp|avif)$/i.test(url)) return "";
  const filePath = localFileForUrl(url);
  if (!fs.existsSync(filePath)) return "";
  const { data } = await sharp(filePath)
    .resize(9, 8, { fit: "fill" })
    .grayscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const left = data[y * 9 + x];
      const right = data[y * 9 + x + 1];
      bits += left > right ? "1" : "0";
    }
  }
  return bits;
}

function hammingDistance(left, right) {
  if (!left || !right || left.length !== right.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) distance += 1;
  }
  return distance;
}

function addImage(records, siteId, scope, context, value) {
  const url = normalizeImageUrl(value);
  if (!url) return;
  if (siteId === "site_aidreamcapes" && url.startsWith("/assets/dreamshoot/")) {
    failures.push(`cross_brand_asset_reference:${siteId}:${scope}:${context}:${url}`);
  }
  if (siteId === "site_dreamshoot" && url.startsWith("/assets/sites/site_aidreamcapes/")) {
    failures.push(`cross_brand_asset_reference:${siteId}:${scope}:${context}:${url}`);
  }
  const stableContext = context.replace(/^(?:site_[^:]+|publication:[^:]+):/, "");
  records.push({ siteId, scope, context: stableContext, url });
}

function collectImageStrings(records, siteId, scope, context, value) {
  if (typeof value === "string") {
    const pipeParts = value.split("|");
    for (const part of pipeParts) {
      addImage(records, siteId, scope, context, part.trim());
    }
    for (const match of value.matchAll(/\/assets\/[^"'|<> )]+\.(?:png|jpe?g|webp|avif|svg)(?:\?[^"'|<> )]+)?/gi)) {
      addImage(records, siteId, scope, context, match[0]);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageStrings(records, siteId, scope, `${context}[${index}]`, item));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    collectImageStrings(records, siteId, scope, `${context}.${key}`, item);
  }
}

function walkThemeObject(value, callback) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkThemeObject(item, callback));
    return;
  }
  callback(value);
  Object.values(value).forEach((item) => walkThemeObject(item, callback));
}

function assertThemedBlockImageReferences() {
  const rules = [
    {
      siteId: "site_dreamshoot",
      token: /thanksgiving/i,
      forbidden: /\/christmas-photos\//i,
      label: "mydreamshoots_thanksgiving_block_uses_christmas_asset"
    },
    {
      siteId: "site_dreamshoot",
      token: /halloween/i,
      forbidden: /\/christmas-photos\//i,
      label: "mydreamshoots_halloween_block_uses_christmas_asset"
    }
  ];
  const imageKey = /(?:^|_)(?:image|img|poster|preview|result|og)(?:url|image)?$/i;

  const checkThemeObject = (siteId, sourceLabel, object) => {
    walkThemeObject(object, (node) => {
      const settings = node.settings;
      if (!settings || typeof settings !== "object") return;
      const semanticText = [
        node.id,
        node.type,
        settings.title,
        settings.description,
        settings.category,
        settings.badge,
        settings.meta,
        settings.href,
        settings.targetHref
      ].filter((value) => typeof value === "string").join(" ");

      for (const [key, value] of Object.entries(settings)) {
        if (typeof value !== "string" || !imageKey.test(key)) continue;
        const imageUrl = normalizeImageUrl(value);
        if (!imageUrl) continue;
        for (const rule of rules) {
          if (siteId !== rule.siteId) continue;
          if (!rule.token.test(semanticText)) continue;
          if (rule.forbidden.test(imageUrl)) failures.push(`${rule.label}:${sourceLabel}:${node.id ?? node.type}:${key}:${imageUrl}`);
        }
      }
    });
  };

  for (const theme of state.siteThemes ?? []) {
    checkThemeObject(theme.siteId, `theme:${theme.id ?? theme.themeId}`, theme);
  }
  for (const publication of state.themePublications ?? []) {
    checkThemeObject(publication.siteId, `publication:${publication.id}`, publication.snapshot);
  }
}

function collectStorefrontImages(siteId) {
  const records = [];

  for (const pack of state.creativePacks ?? []) {
    if (pack.siteId !== siteId) continue;
    addImage(records, siteId, "creative-pack-cover", `pack:${pack.slug ?? pack.id}:cover`, pack.imageUrl ?? pack.coverImageUrl);
    (pack.galleryImages ?? []).forEach((imageUrl, index) => {
      addImage(records, siteId, "creative-pack-gallery", `pack:${pack.slug ?? pack.id}:gallery:${index + 1}`, imageUrl);
    });
  }

  for (const category of state.creativePackCategories ?? []) {
    if (category.siteId !== siteId) continue;
    addImage(records, siteId, "category", `category:${category.slug ?? category.id}`, category.imageUrl);
  }

  for (const item of state.toolMenuItems ?? []) {
    if (item.siteId !== siteId || item.status === "inactive") continue;
    addImage(records, siteId, "tool-menu", `tool-menu:${item.slug ?? item.href ?? item.title}`, item.imageUrl);
  }

  for (const theme of state.videoThemes ?? []) {
    if (theme.siteId !== siteId || theme.status === "inactive") continue;
    addImage(records, siteId, "video-theme-poster", `video-theme:${theme.slug ?? theme.id}`, theme.imageUrl);
  }

  for (const asset of state.mediaAssets ?? []) {
    if (asset.siteId !== siteId) continue;
    addImage(records, siteId, "media-asset", `media-asset:${asset.storageKey ?? asset.id}:preview`, asset.previewUrl);
    addImage(records, siteId, "media-asset", `media-asset:${asset.storageKey ?? asset.id}:origin`, asset.originUrl);
  }

  const site = state.sites.find((item) => item.id === siteId);
  if (site) {
    collectImageStrings(records, siteId, "site-settings-reference", `site:${siteId}:themeSettings`, site.themeSettings);
    for (const page of site.pages ?? []) {
      collectImageStrings(records, siteId, "site-page-reference", `page:${page.slug}`, page);
    }
  }

  for (const theme of state.siteThemes ?? []) {
    if (theme.siteId !== siteId) continue;
    collectImageStrings(records, siteId, "site-theme-reference", `theme:${theme.id ?? theme.themeId}`, theme);
    walkThemeObject(theme, (node) => {
      const type = node.type;
      const settings = node.settings;
      if (!settings || typeof settings !== "object") return;
      if (!["catalog_pack", "proof_card", "taxonomy_card", "tool_card"].includes(type)) return;
      const title = typeof settings.title === "string" ? settings.title : node.id;
      addImage(records, siteId, type, `${theme.themeId ?? theme.id}:${type}:${title}`, settings.imageUrl);
    });
  }

  for (const publication of state.themePublications ?? []) {
    if (publication.siteId !== siteId) continue;
    collectImageStrings(records, siteId, "publication-reference", `publication:${publication.id}`, publication.snapshot);
    walkThemeObject(publication.snapshot, (node) => {
      const type = node.type;
      const settings = node.settings;
      if (!settings || typeof settings !== "object") return;
      if (!["catalog_pack", "proof_card", "taxonomy_card", "tool_card"].includes(type)) return;
      const title = typeof settings.title === "string" ? settings.title : node.id;
      addImage(records, siteId, type, `publication:${publication.id}:${type}:${title}`, settings.imageUrl);
    });
  }

  return records;
}

function duplicateGroups(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
}

function assertNoRenderedDuplicateFallbacks() {
  const sourceChecks = [
    "src/components/theme-renderer.tsx",
    "src/components/storefront/dreamshoot-package-catalog-client.tsx",
    "src/components/storefront/package-taxonomy-client.tsx"
  ];
  const forbiddenPatterns = [
    /\[card\.imageUrl,\s*card\.imageUrl\]/,
    /proofImages\.length\s*===\s*1/,
    /urls\.length\s*===\s*1\s*\?\s*\[urls\[0\]!,\s*urls\[0\]!\]/,
    /images\[0\],\s*images\[0\]/,
    /index\s*%\s*urls\.length/,
    /length:\s*4[^;]+index\s*%/s
  ];
  for (const relativePath of sourceChecks) {
    const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(source)) failures.push(`rendered_duplicate_card_image_fallback:${relativePath}:${pattern}`);
    }
  }
}

function assertMyDreamShootsGenerationPresetIsolation() {
  const generatorPath = path.join(repoRoot, "scripts/generate-mydreamshoots-theme-galleries.mjs");
  if (!fs.existsSync(generatorPath)) return;
  const source = fs.readFileSync(generatorPath, "utf8");
  const oldHolidayTravelPatterns = [
    /holiday:\s*"[^"]*holiday travel/i,
    /holiday:\s*"[^"]*vacation scenes/i,
    /travel\/nature\/holiday themes/i
  ];
  for (const pattern of oldHolidayTravelPatterns) {
    if (pattern.test(source)) failures.push(`mydreamshoots_holiday_generation_allows_travel:${pattern}`);
  }
  if (!/seasonal holiday portraits for Christmas, Thanksgiving, Halloween/i.test(source)) {
    failures.push("mydreamshoots_holiday_generation_missing_seasonal_direction");
  }
}

function assertAidreamcapesThemeCategoryPreviewCandidates() {
  const categoriesBySlug = new Map(
    (state.creativePackCategories ?? [])
      .filter((category) => category.siteId === "site_aidreamcapes" && category.status !== "inactive")
      .map((category) => [category.slug, category])
  );
  const packs = (state.creativePacks ?? []).filter((pack) => pack.siteId === "site_aidreamcapes" && pack.status !== "inactive");
  for (const slug of aidreamcapesThemeParentSlugs) {
    const category = categoriesBySlug.get(slug);
    if (!category) {
      failures.push(`aidreamcapes_missing_theme_parent_category:${slug}`);
      continue;
    }
    const relatedPacks = packs.filter((pack) => {
      const tokens = [
        pack.category,
        pack.categoryRecord?.slug,
        pack.categoryRecord?.parent?.slug
      ].filter(Boolean);
      return tokens.includes(slug);
    });
    const candidates = uniqueImageUrls([
      category.imageUrl,
      ...relatedPacks.flatMap((pack) => [
        pack.categoryRecord?.parent?.imageUrl,
        pack.categoryRecord?.imageUrl,
        ...(pack.galleryImages ?? []),
        pack.imageUrl
      ])
    ]).slice(0, 2);
    if (!candidates[0]?.includes(`/fan-holiday-theme/categories/${slug}.`)) {
      failures.push(`aidreamcapes_theme_card_primary_not_category:${slug}:${candidates[0] ?? "none"}`);
    }
    if (candidates.length > 1 && new Set(candidates).size !== candidates.length) {
      failures.push(`aidreamcapes_theme_card_duplicate_preview_candidate:${slug}:${candidates.join(" | ")}`);
    }
  }
}

assertNoRenderedDuplicateFallbacks();
assertMyDreamShootsGenerationPresetIsolation();
assertAidreamcapesThemeCategoryPreviewCandidates();
assertThemedBlockImageReferences();

const recordsBySite = Object.fromEntries(siteIds.map((siteId) => [siteId, collectStorefrontImages(siteId)]));
const perceptualRecordsBySite = {};

const crossThemePathRules = [
  {
    siteId: "site_dreamshoot",
    pattern: /(?:^|-)thanksgiving(?:-|$)/i,
    forbidden: /\/christmas-photos\//i,
    label: "mydreamshoots_thanksgiving_uses_christmas_asset"
  },
  {
    siteId: "site_dreamshoot",
    pattern: /(?:^|-)halloween(?:-|$)/i,
    forbidden: /\/christmas-photos\//i,
    label: "mydreamshoots_halloween_uses_christmas_asset"
  }
];

for (const pack of state.creativePacks ?? []) {
  if (!siteIds.includes(pack.siteId) || pack.status === "inactive") continue;
  const galleryImages = (pack.galleryImages ?? []).map(normalizeImageUrl).filter(Boolean);
  const packKey = pack.slug ?? pack.category ?? pack.id;
  const coverUrl = normalizeImageUrl(pack.imageUrl ?? pack.coverImageUrl);
  if (galleryImages.length < 12) failures.push(`pack_gallery_under_12:${pack.siteId}:${packKey}:${galleryImages.length}`);
  if (new Set(galleryImages).size !== galleryImages.length) failures.push(`pack_duplicate_gallery_url:${pack.siteId}:${packKey}`);
  if (coverUrl && galleryImages.includes(coverUrl)) failures.push(`pack_cover_repeated_in_gallery:${pack.siteId}:${packKey}:${coverUrl}`);
  for (const rule of crossThemePathRules) {
    if (pack.siteId !== rule.siteId) continue;
    const text = `${pack.category ?? ""} ${pack.slug ?? ""} ${pack.name ?? ""}`;
    if (!rule.pattern.test(text)) continue;
    for (const imageUrl of [coverUrl, ...galleryImages].filter(Boolean)) {
      if (rule.forbidden.test(imageUrl)) failures.push(`${rule.label}:${packKey}:${imageUrl}`);
    }
  }
  const cardCandidates = [pack.imageUrl, ...galleryImages].map(normalizeImageUrl).filter(Boolean).slice(0, 2);
  if (new Set(cardCandidates).size !== cardCandidates.length) failures.push(`pack_duplicate_card_image_url:${pack.siteId}:${packKey}`);
}

for (const siteId of siteIds) {
  for (const url of new Set(recordsBySite[siteId].map((record) => record.url))) {
    const filePath = localFileForUrl(url);
    if (!fs.existsSync(filePath)) failures.push(`missing_image_file:${siteId}:${url}`);
  }
}

function packGalleryGroupKey(record) {
  const match = record.context.match(/^(pack:[^:]+):gallery:/);
  return match?.[1] ?? "";
}

async function assertPackGalleryVisualDiversity(siteId) {
  const galleryRecords = recordsBySite[siteId].filter((record) => record.scope === "creative-pack-gallery");
  const groups = new Map();
  for (const record of galleryRecords) {
    const key = packGalleryGroupKey(record);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  for (const [packKey, group] of groups) {
    const uniqueUrls = [...new Map(group.map((record) => [record.url, record])).values()];
    if (uniqueUrls.length < 12) continue;
    const hashed = [];
    for (const record of uniqueUrls) {
      const perceptualHash = await perceptualHashFile(record.url);
      if (perceptualHash) hashed.push({ ...record, perceptualHash });
    }
    if (hashed.length < 12) continue;
    const uniqueHashCount = new Set(hashed.map((record) => record.perceptualHash)).size;
    if (uniqueHashCount < 8) {
      failures.push(`pack_gallery_low_visual_diversity:${siteId}:${packKey}:unique_hashes=${uniqueHashCount}:images=${hashed.length}`);
    }
    let nearDuplicatePairs = 0;
    for (let leftIndex = 0; leftIndex < hashed.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < hashed.length; rightIndex += 1) {
        const distance = hammingDistance(hashed[leftIndex].perceptualHash, hashed[rightIndex].perceptualHash);
        if (distance <= 6) nearDuplicatePairs += 1;
      }
    }
    if (nearDuplicatePairs > 6) {
      failures.push(`pack_gallery_near_duplicate_pairs:${siteId}:${packKey}:pairs=${nearDuplicatePairs}:images=${hashed.length}`);
    }
  }
}

for (const siteId of siteIds) {
  await assertPackGalleryVisualDiversity(siteId);
}

const duplicateStrictScopes = new Set([
  "creative-pack-cover",
  "category",
  "tool-menu",
  "video-theme-poster"
]);

for (const siteId of siteIds) {
  const uniqueRecords = [
    ...new Map(recordsBySite[siteId].filter((record) => duplicateStrictScopes.has(record.scope)).map((record) => [`${record.scope}:${record.context}`, record])).values()
  ];
  const uniqueContextByUrl = duplicateGroups(uniqueRecords, (record) => `${record.scope}:${record.url}`)
    .map(([url, records]) => [
      url,
      [...new Set(records.map((record) => record.context))]
    ])
    .filter(([, contexts]) => contexts.length > 1);

  for (const [scopeAndUrl, contexts] of uniqueContextByUrl) {
    failures.push(`duplicate_storefront_image_url:${siteId}:${scopeAndUrl}:${contexts.join(" | ")}`);
  }
}

const hashesBySite = {};
for (const siteId of siteIds) {
  const uniqueUrlRecords = [...new Map(recordsBySite[siteId].filter((record) => duplicateStrictScopes.has(record.scope)).map((record) => [`${record.scope}:${record.url}`, record])).values()];
  hashesBySite[siteId] = uniqueUrlRecords.map((record) => ({ ...record, hash: hashFile(record.url) })).filter((record) => record.hash);

  for (const [hash, records] of duplicateGroups(hashesBySite[siteId], (record) => `${record.scope}:${record.hash}`)) {
    failures.push(`duplicate_storefront_image_hash:${siteId}:${hash}:${records.map((record) => `${record.url} (${record.context})`).join(" | ")}`);
  }
}

const nearDuplicateScopes = new Set(["creative-pack-cover", "category", "catalog_pack", "taxonomy_card"]);
const nearDuplicateThreshold = 8;
for (const siteId of siteIds) {
  const perceptualRecords = [];
  const uniqueUrlRecords = [
    ...new Map(
      recordsBySite[siteId]
        .filter((record) => nearDuplicateScopes.has(record.scope))
        .map((record) => [`${record.scope}:${record.url}`, record])
    ).values()
  ];

  for (const record of uniqueUrlRecords) {
    const perceptualHash = await perceptualHashFile(record.url);
    if (perceptualHash) perceptualRecords.push({ ...record, perceptualHash });
  }
  perceptualRecordsBySite[siteId] = perceptualRecords;

  for (let leftIndex = 0; leftIndex < perceptualRecords.length; leftIndex += 1) {
    const left = perceptualRecords[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < perceptualRecords.length; rightIndex += 1) {
      const right = perceptualRecords[rightIndex];
      if (left.scope !== right.scope) continue;
      if (left.url === right.url) continue;
      if (left.context === right.context) continue;
      const distance = hammingDistance(left.perceptualHash, right.perceptualHash);
      if (distance > nearDuplicateThreshold) continue;
      failures.push(
        `near_duplicate_storefront_image:${siteId}:distance=${distance}:${left.url} (${left.context}) <> ${right.url} (${right.context})`
      );
    }
  }
}

for (const left of hashesBySite.site_dreamshoot ?? []) {
  for (const right of hashesBySite.site_aidreamcapes ?? []) {
    if (left.hash !== right.hash) continue;
    failures.push(`cross_storefront_image_hash:${left.hash}:site_dreamshoot:${left.url} (${left.context}) <> site_aidreamcapes:${right.url} (${right.context})`);
  }
}

for (const left of perceptualRecordsBySite.site_dreamshoot ?? []) {
  for (const right of perceptualRecordsBySite.site_aidreamcapes ?? []) {
    if (left.url === right.url) continue;
    const distance = hammingDistance(left.perceptualHash, right.perceptualHash);
    if (distance > nearDuplicateThreshold) continue;
    failures.push(
      `cross_storefront_near_duplicate_image:distance=${distance}:site_dreamshoot:${left.url} (${left.context}) <> site_aidreamcapes:${right.url} (${right.context})`
    );
  }
}

if (failures.length > 0) {
  console.error("Storefront image isolation smoke failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

for (const siteId of siteIds) {
  const urlCount = new Set(recordsBySite[siteId].map((record) => record.url)).size;
  console.log(`${siteId}: ${recordsBySite[siteId].length} checked references, ${urlCount} unique image URLs`);
}
console.log("Storefront image isolation smoke passed.");
await prisma.$disconnect();
