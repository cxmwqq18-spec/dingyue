#!/usr/bin/env node

import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const ASSET_PREFIX = "/assets/sites/site_aidreamcapes_eu/";
const PUBLIC_ROOT = path.resolve("public");
const WORKSPACE_ROOT = path.resolve(".");
const REPORT_PATH = path.resolve(process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) || "reports/aidreamcapes-eu-image-source-map.json");
const IMAGE_EXT_RE = /\.(?:jpe?g|png|webp|avif|gif|svg)(?:$|[?#])/i;
const PAGE_MODELS = [
  "livePage",
  "themePage",
  "themeSettings",
  "videoTheme",
  "videoThemeExample",
  "videoThemeCategory",
  "creativePack",
  "creativePackCategory",
  "storefrontProfile",
  "sitePublishedState"
];
const EU_SOURCE_ROOTS = [
  path.resolve("public/assets/sites/site_aidreamcapes_eu/generated"),
  path.resolve("public/assets/sites/site_aidreamcapes_eu/restored"),
  path.resolve("public/assets/dreamshoot/generated/pack-galleries")
];
const STAGED_SOURCE_ROOTS = [
  path.resolve(".tmp/aidreamcapes-eu-image-regeneration"),
  path.resolve(".tmp/aidreamcapes-eu-video-topic-regeneration"),
  path.resolve(".tmp/aidreamcapes-eu-talking-photo-regeneration")
];
const PROVIDER_MANIFEST_ROOTS = [
  path.resolve(".tmp/aidreamcapes-eu-video-topic-regeneration"),
  path.resolve(".tmp/aidreamcapes-eu-talking-photo-regeneration")
];

function stripQuery(value) {
  return String(value || "").split(/[?#]/)[0];
}

function isImageUrl(value) {
  return typeof value === "string" && IMAGE_EXT_RE.test(stripQuery(value));
}

function isEuAssetUrl(value) {
  return isImageUrl(value) && stripQuery(value).startsWith(ASSET_PREFIX);
}

function localPathForUrl(value) {
  const clean = stripQuery(value);
  if (!clean.startsWith("/assets/")) return null;
  const filePath = path.resolve(PUBLIC_ROOT, clean.slice(1));
  if (filePath !== PUBLIC_ROOT && !filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`)) return null;
  return filePath;
}

function urlForLocalPath(filePath) {
  const resolved = path.resolve(filePath);
  if (resolved !== PUBLIC_ROOT && !resolved.startsWith(`${PUBLIC_ROOT}${path.sep}`)) return null;
  return `/${path.relative(PUBLIC_ROOT, resolved).split(path.sep).join("/")}`;
}

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function walkFiles(root, output = []) {
  if (!fs.existsSync(root)) return output;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    if (IMAGE_EXT_RE.test(root)) output.push(root);
    return output;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    walkFiles(path.join(root, entry.name), output);
  }
  return output;
}

function walkAllFiles(root, output = []) {
  if (!fs.existsSync(root)) return output;
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    output.push(root);
    return output;
  }
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    walkAllFiles(path.join(root, entry.name), output);
  }
  return output;
}

function addRef(refMap, url, ref) {
  const clean = stripQuery(url);
  if (!isEuAssetUrl(clean)) return;
  const existing = refMap.get(clean) || { url: clean, refs: [] };
  existing.refs.push(ref);
  refMap.set(clean, existing);
}

function collectAssetUrls(value, pathParts, refMap, refBase) {
  if (typeof value === "string") {
    const matches = value.match(/\/assets\/[^?#"'\s]+/g) || [];
    for (const match of matches) {
      if (!isEuAssetUrl(match)) continue;
      addRef(refMap, match, { ...refBase, fieldPath: `/${pathParts.join("/")}` });
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectAssetUrls(item, [...pathParts, String(index)], refMap, refBase));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collectAssetUrls(item, [...pathParts, key], refMap, refBase));
  }
}

function loadHistoricalSourceMap() {
  const sourceMap = new Map();
  const batchFiles = fs.readdirSync(path.resolve(".tmp"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("aidreamcapes-eu-content-production-batch-") && entry.name.endsWith(".json"))
    .map((entry) => path.resolve(".tmp", entry.name));
  for (const batchFile of batchFiles) {
    let batch;
    try {
      batch = JSON.parse(fs.readFileSync(batchFile, "utf8"));
    } catch {
      continue;
    }
    for (const operation of batch.operations || []) {
      const value = operation.value;
      if (operation.entityType !== "media_asset" || !value?.storageKey) continue;
      const storageKey = `/${String(value.storageKey).replace(/^\//, "")}`;
      if (!storageKey.startsWith(ASSET_PREFIX)) continue;
      const copiedFrom = String(value.notes || "").match(/Copied from (\/assets\/[^;]+);/)?.[1] || "";
      if (!sourceMap.has(storageKey) || (!sourceMap.get(storageKey).copiedFrom && copiedFrom)) {
        sourceMap.set(storageKey, { copiedFrom, batchFile });
      }
    }
  }
  return sourceMap;
}

function buildBasenameIndex() {
  const index = new Map();
  for (const root of EU_SOURCE_ROOTS) {
    for (const filePath of walkFiles(root)) {
      const basename = path.basename(filePath);
      const stem = basename.replace(/\.[^.]+$/, "");
      const list = index.get(stem) || [];
      list.push(filePath);
      index.set(stem, list);
    }
  }
  return index;
}

function loadProviderStagedSourceMap() {
  const sourceMap = new Map();
  for (const root of PROVIDER_MANIFEST_ROOTS) {
    for (const manifestPath of walkAllFiles(root).filter((filePath) => path.basename(filePath) === "manifest.json")) {
      let manifest;
      try {
        manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch {
        continue;
      }
      for (const task of manifest.tasks || []) {
        if (!task?.filename || !task?.stageFile || !fs.existsSync(task.stageFile)) continue;
        const stem = path.basename(task.filename).replace(/\.[^.]+$/, "");
        const existing = sourceMap.get(stem) || [];
        existing.push({ sourcePath: path.resolve(task.stageFile), manifestPath, batchId: manifest.batchId || null });
        sourceMap.set(stem, existing);
      }
    }
  }
  return sourceMap;
}

function buildStagedHashIndex() {
  const index = new Map();
  for (const root of STAGED_SOURCE_ROOTS) {
    for (const filePath of walkFiles(root)) {
      const digest = sha256(filePath);
      const matches = index.get(digest) || [];
      matches.push(filePath);
      index.set(digest, matches);
    }
  }
  return index;
}

function inferredSourceBasename(currentUrl) {
  const basename = path.basename(stripQuery(currentUrl));
  const withoutExtension = basename.replace(/\.[^.]+$/, "");
  return withoutExtension
    .replace(/^cover-/, "")
    .replace(/^gallery-\d+-/, "");
}

function classifyFamily(url) {
  const clean = stripQuery(url);
  if (clean.includes("/restored/originals/aidreamcapes-eu-no-crop-v1/")) return "restored-local-original";
  if (clean.includes("/generated/recovered/aidreamcapes-eu-image-pack-4k-")) return "image-pack-recovered";
  if (clean.includes("/generated/recovered/aidreamcapes-eu-provider-4k-")) return "provider-recovered";
  if (clean.includes("/generated/recovered/aidreamcapes-eu-legacy-paths-")) return "legacy-path-recovered";
  if (clean.includes("/mirror/aidreamcapes/dreamshoot/save-the-date/vendor-api-gpt-image-2-4k-")) return "supplier-save-the-date-final";
  if (clean.includes("/generated/eu-regenerated/")) return "eu-regenerated-legacy";
  if (clean.includes("/generated/regenerated/")) return "generated-regenerated-legacy";
  if (clean.includes("/creative-packs/")) return "creative-pack-source";
  if (clean.includes("/mirror/")) return "eu-mirror-asset";
  return "other-eu-asset";
}

function sourceScope(filePath) {
  if (!filePath) return "none";
  const resolved = path.resolve(filePath);
  if (resolved.startsWith(path.resolve("public/assets/sites/site_aidreamcapes_eu/") + path.sep)) return "eu-site-local";
  if (resolved.startsWith(path.resolve("public/assets/dreamshoot/generated/") + path.sep)) return "shared-dreamshoot-source";
  if (resolved.includes("/sites/site_aidreamshoots/")) return "forbidden-other-site-aidreamshoots";
  if (resolved.includes("/sites/site_aidreamcapes/")) return "other-aidreamcapes-site";
  if (STAGED_SOURCE_ROOTS.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`))) return "eu-workspace-staged-source";
  return "outside-allowed-roots";
}

async function findManyOptional(client, modelName, args) {
  try {
    return await client[modelName].findMany(args);
  } catch (error) {
    if (error?.code === "P2021") return [];
    throw error;
  }
}

function rebindPolicy({ family, sourcePath, sourceScopeValue, sourceIsCurrentFile }) {
  if (sourceIsCurrentFile) return "already-canonical-source";
  if (family === "supplier-save-the-date-final") return "blocked-supplier-raw-not-retained";
  if (!sourcePath) return "blocked-no-local-source";
  if (sourceScopeValue === "forbidden-other-site-aidreamshoots" || sourceScopeValue === "other-aidreamcapes-site") return "blocked-cross-site-source";
  if (sourceScopeValue === "eu-site-local") return "eligible-eu-local-original";
  if (sourceScopeValue === "eu-workspace-staged-source") return "eligible-eu-staged-original";
  if (sourceScopeValue === "shared-dreamshoot-source") return "review-shared-source-before-rebind";
  return "blocked-source-scope";
}

async function inspectFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return { exists: false };
  try {
    const metadata = await sharp(filePath).metadata();
    return {
      exists: true,
      bytes: fs.statSync(filePath).size,
      format: metadata.format || null,
      width: metadata.width || null,
      height: metadata.height || null,
      sha256: sha256(filePath)
    };
  } catch (error) {
    return { exists: true, decodeError: error instanceof Error ? error.message : String(error) };
  }
}

function writeMarkdown(result) {
  const lines = [
    "# Aidreamcapes EU image source map",
    "",
    `- Site: \`${result.siteId}\` / \`${result.siteSlug}\``,
    `- Current unique EU image URLs: ${result.summary.currentUniqueImageUrls}`,
    `- Existing current files: ${result.summary.currentFilesPresent}`,
    `- Missing current files: ${result.summary.currentFilesMissing}`,
    `- Local EU-original candidates: ${result.summary.eligibleEuLocalOriginals}`,
    `- EU staged-generation original candidates: ${result.summary.eligibleEuStagedOriginals}`,
    `- Blocked because supplier raw output is not retained: ${result.summary.blockedSupplierRaw}`,
    `- Blocked because source belongs to another site: ${result.summary.blockedCrossSite}`,
    `- Review required for shared source roots: ${result.summary.reviewSharedSource}`,
    "",
    "The report intentionally excludes site_aidreamshoots assets from the rebind allow-list. Existing 3840×2160 derivatives are not treated as originals.",
    "",
    "## Family counts",
    "",
    "| Family | Count | Crop/source status | Rebind policy |",
    "| --- | ---: | --- | --- |"
  ];
  for (const [family, count] of Object.entries(result.summary.byFamily)) {
    const crop = Object.entries(result.summary.byFamilyStatus[family] || {}).map(([status, value]) => `${status}: ${value}`).join(", ");
    const policy = Object.entries(result.summary.byFamilyPolicy[family] || {}).map(([status, value]) => `${status}: ${value}`).join(", ");
    lines.push(`| ${family} | ${count} | ${crop || "-"} | ${policy || "-"} |`);
  }
  lines.push("", "## Unresolved examples", "");
  for (const item of result.assets.filter((asset) => asset.rebindPolicy.startsWith("blocked") || asset.rebindPolicy.startsWith("review")).slice(0, 40)) {
    lines.push(`- \`${item.currentUrl}\` — ${item.rebindPolicy}; source: ${item.sourcePath || "none"}`);
  }
  lines.push("");
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH.replace(/\.json$/i, ".md"), `${lines.join("\n")}\n`);
}

const prisma = new PrismaClient();
try {
  assertDatabaseTarget({ expectedTarget: "local" });
  const site = await prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } });
  if (!site || site.slug !== SITE_SLUG || site.primaryDomain !== "aidreamcapes.eu") throw new Error("EU site identity check failed.");

  const rowsByModel = {};
  for (const modelName of PAGE_MODELS) rowsByModel[modelName] = await findManyOptional(prisma, modelName, { where: { siteId: SITE_ID } });
  const siteContent = await prisma.site.findUnique({ where: { id: SITE_ID } });
  const mediaAssets = await prisma.mediaAsset.findMany({ where: { siteId: SITE_ID }, select: { storageKey: true, previewUrl: true, originUrl: true, sourceType: true, usageType: true, notes: true, altText: true } });
  const refs = new Map();
  for (const [modelName, rows] of Object.entries(rowsByModel)) {
    for (const row of rows) collectAssetUrls(row, [], refs, { model: modelName, rowId: row.id, status: row.status || null });
  }
  if (siteContent) collectAssetUrls(siteContent, [], refs, { model: "site", rowId: siteContent.id, status: siteContent.status || null });

  const historicalSourceMap = loadHistoricalSourceMap();
  const basenameIndex = buildBasenameIndex();
  const providerStagedSourceMap = loadProviderStagedSourceMap();
  let stagedHashIndex = null;
  const mediaByStorage = new Map();
  for (const asset of mediaAssets) {
    const key = `/${String(asset.storageKey || "").replace(/^\//, "")}`;
    mediaByStorage.set(key, asset);
    if (asset.previewUrl) mediaByStorage.set(stripQuery(asset.previewUrl), asset);
    if (asset.originUrl) mediaByStorage.set(stripQuery(asset.originUrl), asset);
  }

  const assets = [];
  for (const ref of refs.values()) {
    const currentUrl = ref.url;
    const currentPath = localPathForUrl(currentUrl);
    const currentFile = await inspectFile(currentPath);
    const family = classifyFamily(currentUrl);
    const media = mediaByStorage.get(currentUrl) || null;
    let sourcePath = null;
    let sourceKind = "none";
    let sourceReason = "No source mapping found.";

    const historical = historicalSourceMap.get(currentUrl);
    if (historical?.copiedFrom) {
      sourcePath = localPathForUrl(historical.copiedFrom);
      sourceKind = "historical-batch-source";
      sourceReason = `Historical batch ${path.basename(historical.batchFile)} recorded the source.`;
    } else if (family === "image-pack-recovered") {
      const inferredBasename = inferredSourceBasename(currentUrl);
      const candidates = basenameIndex.get(inferredBasename) || [];
      if (candidates.length === 1) {
        sourcePath = candidates[0];
        sourceKind = "inferred-eu-source";
        sourceReason = "Matched the role-stripped current basename to one local EU generated source.";
      } else if (candidates.length > 1) {
        sourceKind = "ambiguous-inferred-source";
        sourceReason = `Matched ${candidates.length} local candidates; no automatic rebind allowed.`;
      }
    } else if (family === "provider-recovered") {
      const stem = path.basename(stripQuery(currentUrl)).replace(/\.[^.]+$/, "");
      const candidates = providerStagedSourceMap.get(stem) || [];
      if (candidates.length === 1) {
        sourcePath = candidates[0].sourcePath;
        sourceKind = "provider-staged-output";
        sourceReason = `Matched the provider recovery manifest ${path.basename(candidates[0].manifestPath)}; the current 4K file is a derivative.`;
      } else if (candidates.length > 1) {
        sourceKind = "ambiguous-provider-staged-source";
        sourceReason = `Matched ${candidates.length} provider stage files; no automatic rebind allowed.`;
      }
    } else if (family === "legacy-path-recovered" && currentFile.exists) {
      stagedHashIndex ||= buildStagedHashIndex();
      const candidates = stagedHashIndex.get(currentFile.sha256) || [];
      if (candidates.length === 1) {
        sourcePath = candidates[0];
        sourceKind = "exact-hash-staged-output";
        sourceReason = "Matched the legacy recovered file byte-for-byte to one EU staged generation output.";
      } else if (candidates.length > 1) {
        sourceKind = "ambiguous-exact-hash-staged-output";
        sourceReason = `Matched ${candidates.length} staged outputs with the same hash; no automatic rebind allowed.`;
      }
    } else if (media?.notes) {
      const absoluteSource = String(media.notes).match(/from (\/Users\/[^;]+);/)?.[1] || "";
      if (absoluteSource) {
        sourcePath = path.resolve(absoluteSource);
        sourceKind = "media-asset-notes-source";
        sourceReason = "MediaAsset notes recorded the source path.";
      }
    }

    if (!sourcePath && currentFile.exists && (family === "creative-pack-source" || family === "restored-local-original")) {
      sourcePath = currentPath;
      sourceKind = "current-file-is-source";
      sourceReason = "The current URL already points to the original creative-pack file.";
    }

    const sourceFile = await inspectFile(sourcePath);
    const sourceScopeValue = sourceScope(sourcePath);
    const sourceIsCurrentFile = Boolean(sourcePath && currentPath && path.resolve(sourcePath) === path.resolve(currentPath));
    let cropStatus = "unknown";
    if (family === "image-pack-recovered" && currentFile.exists && sourceFile.exists) {
      cropStatus = sourceFile.width / sourceFile.height === currentFile.width / currentFile.height
        ? "aspect-ratio-matches-source"
        : "known-cropped-by-legacy-cover-normalizer";
    } else if (family === "supplier-save-the-date-final") {
      cropStatus = "known-or-likely-cropped-final-without-raw-source";
    } else if (family === "provider-recovered" && sourceFile.exists) {
      cropStatus = "normalized-derivative-has-different-aspect-ratio-than-staged-source";
    } else if (family === "legacy-path-recovered" && sourceFile.exists) {
      cropStatus = "recovered-file-matches-staged-source-byte-for-byte";
    } else if (sourceIsCurrentFile) {
      cropStatus = "current-file-is-natural-source";
    } else if (currentFile.exists && sourceFile.exists && currentFile.sha256 === sourceFile.sha256) {
      cropStatus = "restored-file-is-byte-identical-to-source";
    }

    const policy = rebindPolicy({ family, sourcePath, sourceScopeValue, sourceIsCurrentFile });
    assets.push({
      currentUrl,
      family,
      currentFile,
      cropStatus,
      sourceUrl: sourceScopeValue === "eu-site-local" ? urlForLocalPath(sourcePath) : null,
      sourcePath,
      sourceKind,
      sourceReason,
      sourceScope: sourceScopeValue,
      sourceFile,
      rebindPolicy: policy,
      refs: ref.refs,
      mediaAsset: media ? { usageType: media.usageType, sourceType: media.sourceType, altText: media.altText } : null
    });
  }

  const summary = {
    currentUniqueImageUrls: assets.length,
    currentFilesPresent: assets.filter((asset) => asset.currentFile.exists).length,
    currentFilesMissing: assets.filter((asset) => !asset.currentFile.exists).length,
    eligibleEuLocalOriginals: assets.filter((asset) => asset.rebindPolicy === "eligible-eu-local-original").length,
    eligibleEuStagedOriginals: assets.filter((asset) => asset.rebindPolicy === "eligible-eu-staged-original").length,
    blockedSupplierRaw: assets.filter((asset) => asset.rebindPolicy === "blocked-supplier-raw-not-retained").length,
    blockedCrossSite: assets.filter((asset) => asset.rebindPolicy === "blocked-cross-site-source").length,
    reviewSharedSource: assets.filter((asset) => asset.rebindPolicy === "review-shared-source-before-rebind").length,
    byFamily: {},
    byFamilyStatus: {},
    byFamilyPolicy: {}
  };
  for (const asset of assets) {
    summary.byFamily[asset.family] = (summary.byFamily[asset.family] || 0) + 1;
    summary.byFamilyStatus[asset.family] ||= {};
    summary.byFamilyStatus[asset.family][asset.cropStatus] = (summary.byFamilyStatus[asset.family][asset.cropStatus] || 0) + 1;
    summary.byFamilyPolicy[asset.family] ||= {};
    summary.byFamilyPolicy[asset.family][asset.rebindPolicy] = (summary.byFamilyPolicy[asset.family][asset.rebindPolicy] || 0) + 1;
  }

  const result = {
    generatedAt: new Date().toISOString(),
    siteId: SITE_ID,
    siteSlug: SITE_SLUG,
    primaryDomain: site.primaryDomain,
    policy: {
      providerCalls: 0,
      copiedFromSiteAidreamshoots: 0,
      existingFourKFilesTreatedAsOriginal: 0,
      databaseWrites: 0
    },
    summary,
    assets
  };
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(result, null, 2)}\n`);
  writeMarkdown(result);
  console.log(JSON.stringify({ report: REPORT_PATH, markdown: REPORT_PATH.replace(/\.json$/i, ".md"), summary }, null, 2));
} finally {
  await prisma.$disconnect();
}
