#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import { assertProviderAspectRatio } from "./lib/provider-image-output.mjs";
import { assertAidreamcapesEuHomepageIntegrity } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_ASSET_SLUG = "site_aidreamcapes_eu";
const PUBLIC_ROOT = path.resolve("public");
const ASSET_PREFIX = `/assets/sites/${SITE_ASSET_SLUG}/`;
const RECOVERY_RELATIVE_ROOT = `assets/sites/${SITE_ASSET_SLUG}/generated/recovered/aidreamcapes-eu-provider-4k-20260916-v1`;
const RECOVERY_PUBLIC_ROOT = `/${RECOVERY_RELATIVE_ROOT}/`;
const RECOVERY_FS_ROOT = path.resolve(PUBLIC_ROOT, RECOVERY_RELATIVE_ROOT);
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-provider-recovery");
const VERSION = "20260916euproviderrecovery1";

const MANIFEST_PATHS = [
  path.resolve(".tmp", "aidreamcapes-eu-video-topic-regeneration", "aidreamcapes-eu-video-topics-diverse-20260914-v1", "manifest.json"),
  path.resolve(".tmp", "aidreamcapes-eu-video-topic-regeneration", "aidreamcapes-eu-video-topics-independent-duplicates-20260915-v1", "manifest.json"),
  path.resolve(".tmp", "aidreamcapes-eu-video-topic-regeneration", "aidreamcapes-eu-motion-generator-4k-20260915-v1", "manifest.json"),
  path.resolve(".tmp", "aidreamcapes-eu-talking-photo-regeneration", "aidreamcapes-eu-talking-photo-diverse-20260914-v1", "manifest.json")
];

const PROVIDER_BATCH_SOURCE_TYPES = new Map([
  ["aidreamcapes-eu-video-topics-diverse-20260914-v1", "aidreamcapes-eu-provider-existing-output-normalized-4k"],
  ["aidreamcapes-eu-video-topics-independent-duplicates-20260915-v1", "aidreamcapes-eu-provider-existing-output-duplicate-fix-normalized-4k"],
  ["aidreamcapes-eu-motion-generator-4k-20260915-v1", "aidreamcapes-eu-provider-existing-output-motion-normalized-4k"],
  ["aidreamcapes-eu-talking-photo-diverse-20260914-v1", "aidreamcapes-eu-provider-existing-output-talking-photo-normalized-4k"]
]);

const SLUG_LABELS = {
  "brand-video": "vidéo de marque",
  "cinematic-video": "vidéo cinématographique",
  "explainer-video": "vidéo explicative",
  "fashion-video": "vidéo de mode",
  "food-video": "vidéo culinaire",
  "how-to-video": "vidéo tutorielle",
  "instagram-reels": "vidéo Instagram Reels",
  "meme-video": "vidéo humoristique",
  "music-video": "clip musical",
  "pet-video": "vidéo avec animal de compagnie",
  "product-ad-video": "publicité produit",
  "product-video": "vidéo produit",
  "promo-video": "vidéo promotionnelle",
  "social-media-video": "vidéo pour réseaux sociaux",
  "story-video": "récit vidéo",
  "talking-head-video": "vidéo face caméra",
  "tiktok-video": "vidéo TikTok",
  "ugc-ad-video": "publicité UGC",
  "video-ad": "annonce vidéo",
  "youtube-video": "vidéo YouTube",
  "motion-generator": "générateur de mouvement",
  "talking-photo": "photo parlante"
};

const TOKEN_TRANSLATIONS = new Map(Object.entries({
  adult: "adulte", adults: "adultes", announcement: "annonce", artist: "artiste", atmosphere: "ambiance", before: "avant", behind: "coulisses", birthday: "anniversaire", broll: "séquence d’illustration", camera: "caméra", candlelit: "éclairé à la bougie", capture: "capture", card: "carte", charts: "graphiques", close: "rapproché", closing: "final", coastal: "côtier", collaboration: "collaboration", community: "communauté", concept: "concept", conversation: "conversation", creator: "créateur", cultural: "culturel", customer: "client", data: "données", detail: "détail", direct: "direct", editing: "montage", ecommerce: "commerce en ligne", evening: "soirée", expert: "expert", fashion: "mode", feed: "fil", floor: "sol", food: "cuisine", founder: "fondateur", frame: "cadre", friends: "amis", gift: "cadeau", hands: "mains", hero: "principal", how: "comment", idea: "idée", identity: "identité", influencer: "influenceur", ingredients: "ingrédients", introduction: "présentation", kitchen: "cuisine", launch: "lancement", library: "bibliothèque", live: "en direct", meaning: "sens", message: "message", mini: "mini", moment: "moment", music: "musique", night: "nuit", overhead: "vue plongeante", performance: "performance", personal: "personnel", phone: "téléphone", placement: "placement", portfolio: "portfolio", product: "produit", professional: "professionnel", promotion: "promotion", review: "avis", rooftop: "toit-terrasse", safety: "sécurité", scene: "scène", scripted: "scénarisé", screen: "écran", self: "soi-même", shared: "partagé", shopping: "achat", social: "social", spokesperson: "porte-parole", stage: "scène", story: "récit", street: "rue", studio: "studio", style: "style", talking: "face caméra", team: "équipe", technology: "technologie", tiny: "petite", tutorial: "tutoriel", unboxing: "déballage", user: "utilisateur", variant: "variante", values: "valeurs", video: "vidéo", walkthrough: "démonstration", window: "fenêtre", workflow: "flux de travail", youtube: "YouTube"
}));

const IMAGE_EXT_RE = /\.(?:jpe?g|png|webp|avif)$/i;

const args = parseArgs(process.argv.slice(2));
const APPLY = Boolean(args.apply || String(args.mode || "").toLowerCase() === "apply");

function parseArgs(items) {
  const out = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equal = raw.indexOf("=");
    const key = (equal >= 0 ? raw.slice(0, equal) : raw).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equal >= 0) out[key] = raw.slice(equal + 1);
    else if (items[index + 1] && !items[index + 1].startsWith("--")) out[key] = items[++index];
    else out[key] = true;
  }
  return out;
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function stripQuery(value) {
  return String(value || "").split(/[?#]/)[0];
}

function withVersion(value) {
  const base = stripQuery(value);
  return `${base}?v=${VERSION}`;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function storageKey(value) {
  return stripQuery(value).replace(/^\//, "");
}

function publicPathToFile(value) {
  const pathname = stripQuery(value);
  assert(pathname.startsWith(ASSET_PREFIX), `Expected EU asset URL: ${value}`);
  const filePath = path.resolve(PUBLIC_ROOT, pathname.slice(1));
  assert(filePath.startsWith(`${PUBLIC_ROOT}${path.sep}`), `Asset escaped public root: ${value}`);
  return filePath;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function listFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (IMAGE_EXT_RE.test(entry.name)) out.push(filePath);
    }
  };
  visit(root);
  return out;
}

function indexByBasename(files) {
  const map = new Map();
  for (const filePath of files) {
    const basename = path.basename(filePath);
    const list = map.get(basename) || [];
    list.push(filePath);
    map.set(basename, list);
  }
  return map;
}

function humanizeFilename(filename) {
  let value = path.basename(filename, path.extname(filename)).toLowerCase();
  value = value.replace(/^video-topic-\d+-/, "").replace(/^\d+-/, "");
  value = value.replace(/(?:^|-)hero(?:-|$)/g, "-").replace(/(?:^|-)slot-\d+$/g, "");
  const words = value.split(/-+/).filter(Boolean).filter((word) => !/^\d+$/.test(word));
  const translated = words.map((word) => TOKEN_TRANSLATIONS.get(word) || word);
  return translated.join(" ").replace(/\s+/g, " ").trim();
}

function canonicalAltForTask(task) {
  const label = SLUG_LABELS[task.slug] || "création visuelle";
  const scene = humanizeFilename(task.filename).replace(/\b(?:vidéo|video)\b/gi, "").trim();
  const role = task.slotRole === "visuel principal" ? "Visuel principal" : task.slotRole === "variante du visuel principal" ? "Variante de visuel" : "Scène de référence";
  return `${role} pour une ${label}${scene ? `, avec ${scene}` : ""}.`;
}

function canonicalAltForPath(value, existingAlt = "") {
  if (existingAlt && /[àâçéèêëîïôûùüÿœæ]/i.test(existingAlt) && !/\b(?:the|with|and|dans a|ou a|pour a|en a)\b/i.test(existingAlt)) return existingAlt.trim();
  const file = humanizeFilename(value);
  return `Image illustrant ${file || "une scène éditoriale"}.`;
}

function currentUrl(value) {
  return typeof value === "string" && value.startsWith(ASSET_PREFIX) ? stripQuery(value) : null;
}

function isImageUrl(value) {
  return typeof value === "string" && value.startsWith(ASSET_PREFIX) && IMAGE_EXT_RE.test(stripQuery(value));
}

async function validateImage(filePath) {
  const buffer = fs.readFileSync(filePath);
  const metadata = await sharp(buffer).metadata();
  assert(metadata.width && metadata.height, `Image has no dimensions: ${filePath}`);
  assert(buffer.length > 1024, `Image is unexpectedly small: ${filePath}`);
  return { width: metadata.width, height: metadata.height, format: metadata.format, bytes: buffer.length, sha256: sha256(buffer) };
}

function providerTaskMap() {
  const tasks = [];
  for (const manifestPath of MANIFEST_PATHS) {
    assert(fs.existsSync(manifestPath), `Missing existing provider manifest: ${manifestPath}`);
    const manifest = readJson(manifestPath);
    assert(PROVIDER_BATCH_SOURCE_TYPES.has(manifest.batchId), `Unexpected recovery manifest: ${manifest.batchId}`);
    assert(Array.isArray(manifest.tasks) && manifest.tasks.length > 0, `Provider manifest has no tasks: ${manifest.batchId}`);
    for (const task of manifest.tasks) {
      assert(task.status === "succeeded", `Existing provider output is not successful: ${manifest.batchId}/${task.id}`);
      assert(typeof task.stageFile === "string" && fs.existsSync(task.stageFile), `Missing staged provider output: ${task.stageFile}`);
      tasks.push({ manifest, task, sourceType: PROVIDER_BATCH_SOURCE_TYPES.get(manifest.batchId) });
    }
  }
  const byKey = new Map();
  for (const item of tasks) {
    const keys = new Set([item.task.filename, item.task.sourceBasename, path.basename(item.task.publicUrl || "")].filter(Boolean));
    for (const key of keys) {
      assert(!byKey.has(key), `Provider source basename collision: ${key}`);
      byKey.set(key, item);
    }
  }
  return { tasks, byKey };
}

function recoveryUrl(filename) {
  const jpg = `${path.basename(filename, path.extname(filename))}.jpg`;
  return withVersion(`${RECOVERY_PUBLIC_ROOT}${jpg}`);
}

function chooseTargetCandidate(candidates, oldUrl) {
  assert(candidates.length > 0);
  if (candidates.length === 1) return candidates[0];
  const tokens = stripQuery(oldUrl).toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);
  return [...candidates].sort((left, right) => scoreCandidate(right, tokens) - scoreCandidate(left, tokens))[0];
}

function scoreCandidate(candidate, tokens) {
  const value = candidate.toLowerCase();
  return tokens.reduce((score, token) => score + (value.includes(token) ? 1 : 0), 0);
}

function backupRows(rows) {
  return rows.map(({ model, row }) => ({ model, row }));
}

function walkAndRewrite(value, context, rewriteUrl, altForUrl) {
  if (Array.isArray(value)) return value.map((item, index) => walkAndRewrite(item, `${context}[${index}]`, rewriteUrl, altForUrl));
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && isImageUrl(value)) return rewriteUrl(value);
    return value;
  }
  const next = Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walkAndRewrite(item, `${context}.${key}`, rewriteUrl, altForUrl)]));
  const directImage = typeof next.src === "string" && isImageUrl(next.src) ? next.src : typeof next.imageUrl === "string" && isImageUrl(next.imageUrl) ? next.imageUrl : null;
  if (directImage) {
    const alt = altForUrl(directImage);
    for (const key of ["alt", "imageAlt", "altText", "alt_text"]) if (Object.prototype.hasOwnProperty.call(next, key)) next[key] = alt;
  }
  if (typeof next.imageList === "string") {
    const urls = next.imageList.split("|").filter(Boolean);
    if (urls.some(isImageUrl)) {
      const rewrittenUrls = urls.map((url) => isImageUrl(url) ? rewriteUrl(url) : url);
      next.imageList = rewrittenUrls.join("|");
      if (typeof next.imageListAlt === "string") next.imageListAlt = rewrittenUrls.map((url) => altForUrl(url)).join("|");
    }
  }
  if (typeof next.galleryImages === "string" && next.galleryImages.includes("/assets/sites/")) {
    next.galleryImages = next.galleryImages.split("|").map((url) => isImageUrl(url) ? rewriteUrl(url) : url).join("|");
  }
  if (Array.isArray(next.galleryImages) && next.galleryImages.some(isImageUrl) && Array.isArray(next.galleryImageAlts)) {
    next.galleryImageAlts = next.galleryImages.map((url) => isImageUrl(url) ? altForUrl(url) : "");
  }
  return next;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY) assertNonProductionWriteTarget();

  const { tasks: providerTasks, byKey: providerByKey } = providerTaskMap();
  const targetFiles = listFiles(path.join(PUBLIC_ROOT, "assets", "sites", SITE_ASSET_SLUG));
  const normalFiles = listFiles(path.join(PUBLIC_ROOT, "assets", "sites", "site_aidreamcapes"));
  const targetByBasename = indexByBasename(targetFiles);
  const normalByBasename = indexByBasename(normalFiles);
  const prisma = new PrismaClient();
  try {
    const rows = [];
    const models = ["themePage", "livePage", "themeSettings", "siteTheme", "videoTheme", "videoThemeExample", "videoThemeCategory", "creativePack", "creativePackCategory", "mediaAsset"];
    for (const model of models) {
      const records = await prisma[model].findMany({ where: { siteId: SITE_ID } });
      rows.push(...records.map((row) => ({ model, row })));
    }

    const existingAltByBasename = new Map();
    for (const item of rows.filter(({ model }) => model === "mediaAsset")) {
      for (const key of ["previewUrl", "originUrl"]) {
        const basename = item.row[key] ? path.basename(stripQuery(item.row[key])) : "";
        if (basename && item.row.altText) existingAltByBasename.set(basename, item.row.altText);
      }
    }

    const generated = [];
    const urlMap = new Map();
    const altMap = new Map();
    for (const item of providerTasks) {
      const url = recoveryUrl(item.task.filename);
      const sourceInfo = await validateImage(item.task.stageFile);
      generated.push({ item, url, sourceInfo, targetFile: path.join(RECOVERY_FS_ROOT, path.basename(stripQuery(url)))});
      for (const key of new Set([item.task.filename, item.task.sourceBasename, path.basename(item.task.publicUrl || "")].filter(Boolean))) {
        urlMap.set(key, url);
        altMap.set(url, canonicalAltForTask(item.task));
      }
    }

    const copied = [];
    const unresolved = [];
    const rewriteUrl = (value) => {
      if (!isImageUrl(value)) return value;
      const oldBase = stripQuery(value);
      const basename = path.basename(oldBase);
      const provider = providerByKey.get(basename);
      if (provider) return recoveryUrl(provider.task.filename);
      const direct = urlMap.get(basename);
      if (direct) return direct;
      const targetCandidate = targetByBasename.get(basename);
      if (targetCandidate?.length) {
        const relative = `/${path.relative(PUBLIC_ROOT, chooseTargetCandidate(targetCandidate, oldBase)).split(path.sep).join("/")}`;
        const result = withVersion(relative);
        altMap.set(result, canonicalAltForPath(result, existingAltByBasename.get(basename)));
        return result;
      }
      const normalCandidate = normalByBasename.get(basename);
      if (normalCandidate?.length) {
        const source = chooseTargetCandidate(normalCandidate, oldBase);
        const targetName = `${sha256(Buffer.from(source)).slice(0, 12)}-${basename}`;
        const targetFile = path.join(RECOVERY_FS_ROOT, "reused-local", targetName);
        const relative = `/${path.relative(PUBLIC_ROOT, targetFile).split(path.sep).join("/")}`;
        const result = withVersion(relative);
        const existing = copied.find((entry) => entry.source === source);
        if (!existing) copied.push({ source, targetFile, url: result, basename });
        altMap.set(result, canonicalAltForPath(result, existingAltByBasename.get(basename)));
        return result;
      }
      unresolved.push({ value, basename });
      return value;
    };

    const rewrittenRows = rows.map(({ model, row }) => {
      const next = clone(row);
      if (model === "themePage") {
        next.draftJson = walkAndRewrite(next.draftJson, `${model}:${row.id}.draftJson`, rewriteUrl, (url) => altMap.get(url) || canonicalAltForPath(url));
        next.publishedJson = walkAndRewrite(next.publishedJson, `${model}:${row.id}.publishedJson`, rewriteUrl, (url) => altMap.get(url) || canonicalAltForPath(url));
      } else if (model === "livePage") {
        next.contentJson = walkAndRewrite(next.contentJson, `${model}:${row.id}.contentJson`, rewriteUrl, (url) => altMap.get(url) || canonicalAltForPath(url));
      } else if (model === "themeSettings") {
        next.draftJson = walkAndRewrite(next.draftJson, `${model}:${row.id}.draftJson`, rewriteUrl, (url) => altMap.get(url) || canonicalAltForPath(url));
        next.publishedJson = walkAndRewrite(next.publishedJson, `${model}:${row.id}.publishedJson`, rewriteUrl, (url) => altMap.get(url) || canonicalAltForPath(url));
      } else if (model === "siteTheme") {
        next.templates = walkAndRewrite(next.templates, `${model}:${row.id}.templates`, rewriteUrl, (url) => altMap.get(url) || canonicalAltForPath(url));
        next.settings = walkAndRewrite(next.settings, `${model}:${row.id}.settings`, rewriteUrl, (url) => altMap.get(url) || canonicalAltForPath(url));
      } else if (model === "mediaAsset") {
        for (const key of ["previewUrl", "originUrl"]) if (isImageUrl(next[key])) next[key] = rewriteUrl(next[key]);
        const canonical = isImageUrl(next.previewUrl) ? next.previewUrl : isImageUrl(next.originUrl) ? next.originUrl : null;
        if (canonical) next.altText = altMap.get(canonical) || canonicalAltForPath(canonical, next.altText || "");
      } else if (model === "videoTheme" || model === "videoThemeExample" || model === "videoThemeCategory" || model === "creativePack" || model === "creativePackCategory") {
        if (isImageUrl(next.imageUrl)) next.imageUrl = rewriteUrl(next.imageUrl);
        if (Array.isArray(next.galleryImages)) next.galleryImages = next.galleryImages.map((url) => isImageUrl(url) ? rewriteUrl(url) : url);
        if (Array.isArray(next.galleryImageAlts)) next.galleryImageAlts = next.galleryImages.map((url) => isImageUrl(url) ? (altMap.get(url) || canonicalAltForPath(url)) : "");
      }
      return { model, row, next };
    });

    assert.equal(unresolved.length, 0, `Unresolved EU image references: ${JSON.stringify(unresolved.slice(0, 20))}`);
    const changed = rewrittenRows.filter(({ row, next }) => JSON.stringify(row) !== JSON.stringify(next));
    const referencedRecoveryUrls = new Set();
    for (const { next } of rewrittenRows) {
      const collect = (value) => {
        if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === "object") Object.values(value).forEach(collect);
        else if (typeof value === "string" && value.startsWith(RECOVERY_PUBLIC_ROOT)) referencedRecoveryUrls.add(stripQuery(value));
      };
      collect(next);
    }
    assert.equal(referencedRecoveryUrls.size, generated.length + copied.length, `Not all recovered assets are referenced: ${referencedRecoveryUrls.size}/${generated.length + copied.length}`);

    const report = {
      ok: true,
      mode: APPLY ? "apply-local" : "dry-run",
      siteId: SITE_ID,
      providerCalls: 0,
      sourceBatches: providerTasks.reduce((out, item) => { out[item.manifest.batchId] = (out[item.manifest.batchId] || 0) + 1; return out; }, {}),
      providerOutputCount: providerTasks.length,
      normalized4kCount: generated.length,
      targetExistingBasenameRebindings: changed.length,
      reusedNormalSiteAssets: copied.length,
      changedRows: changed.length,
      recoveryRoot: `/${RECOVERY_RELATIVE_ROOT}/`,
      unresolved: unresolved.length,
      outputValidation: { sourceDimensions: [...new Set(generated.map((item) => `${item.sourceInfo.width}x${item.sourceInfo.height}`))], targetDimensions: "3840x2160", targetFormat: "jpeg" },
      note: "Existing supplier outputs were recovered and locally normalized; no image-generation API request was made."
    };

    if (APPLY) {
      fs.mkdirSync(RECOVERY_FS_ROOT, { recursive: true });
      for (const item of generated) {
        await assertProviderAspectRatio({
          filePath: item.item.task.stageFile,
          expectedWidth: 3840,
          expectedHeight: 2160,
          label: item.item.task.stageFile
        });
        if (!fs.existsSync(item.targetFile)) {
          await sharp(item.item.task.stageFile)
            .resize(3840, 2160, { fit: "inside", withoutEnlargement: false })
            .jpeg({ quality: 90, mozjpeg: true })
            .toFile(item.targetFile);
        }
        const metadata = await sharp(item.targetFile).metadata();
        assert.equal(metadata.width, 3840, `Recovered asset width mismatch: ${item.targetFile}`);
        assert.equal(metadata.height, 2160, `Recovered asset height mismatch: ${item.targetFile}`);
        assert.equal(metadata.format, "jpeg", `Recovered asset format mismatch: ${item.targetFile}`);
      }
      for (const item of copied) {
        if (!fs.existsSync(item.targetFile)) {
          fs.mkdirSync(path.dirname(item.targetFile), { recursive: true });
          fs.copyFileSync(item.source, item.targetFile);
        }
        await validateImage(item.targetFile);
      }

      const backupPath = path.join(REPORT_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, backupRows(rows));
      await prisma.$transaction(async (tx) => {
        for (const entry of rewrittenRows) {
          const { model, row, next } = entry;
          if (JSON.stringify(row) === JSON.stringify(next)) continue;
          if (model === "themePage") await tx.themePage.update({ where: { id: row.id }, data: { draftJson: next.draftJson, publishedJson: next.publishedJson } });
          else if (model === "livePage") await tx.livePage.update({ where: { id: row.id }, data: { contentJson: next.contentJson } });
          else if (model === "themeSettings") await tx.themeSettings.update({ where: { id: row.id }, data: { draftJson: next.draftJson, publishedJson: next.publishedJson } });
          else if (model === "siteTheme") await tx.siteTheme.update({ where: { id: row.id }, data: { templates: next.templates, settings: next.settings } });
          else if (model === "mediaAsset") await tx.mediaAsset.update({ where: { id: row.id }, data: { previewUrl: next.previewUrl, originUrl: next.originUrl, altText: next.altText } });
          else if (model === "videoTheme") await tx.videoTheme.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl, galleryImages: next.galleryImages } });
          else if (model === "videoThemeExample") await tx.videoThemeExample.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl, galleryImages: next.galleryImages } });
          else if (model === "videoThemeCategory") await tx.videoThemeCategory.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl } });
          else if (model === "creativePack") await tx.creativePack.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl, galleryImages: next.galleryImages, galleryImageAlts: next.galleryImageAlts } });
          else if (model === "creativePackCategory") await tx.creativePackCategory.update({ where: { id: row.id }, data: { imageUrl: next.imageUrl } });
        }
        for (const item of generated) {
          const assetUrl = item.url;
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId: SITE_ID, storageKey: storageKey(assetUrl) } },
            create: { id: `media_${SITE_ID}_provider_recovery_${sha256(Buffer.from(assetUrl)).slice(0, 24)}`, siteId: SITE_ID, label: path.basename(stripQuery(assetUrl)), storageKey: storageKey(assetUrl), mimeType: "image/jpeg", usageType: "theme", sourceType: item.sourceType, previewUrl: assetUrl, originUrl: assetUrl, altText: altMap.get(assetUrl), notes: `Existing supplier output recovered from ${item.item.manifest.batchId}; provider=${item.item.manifest.provider?.label || "unknown"}/${item.item.manifest.provider?.model || "unknown"}; no new request.` },
            update: { mimeType: "image/jpeg", previewUrl: assetUrl, originUrl: assetUrl, altText: altMap.get(assetUrl), sourceType: item.sourceType, notes: `Existing supplier output recovered from ${item.item.manifest.batchId}; no new request.` }
          });
        }
        for (const item of copied) {
          const assetUrl = item.url;
          const info = await validateImage(item.targetFile);
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId: SITE_ID, storageKey: storageKey(assetUrl) } },
            create: { id: `media_${SITE_ID}_local_reuse_${sha256(Buffer.from(assetUrl)).slice(0, 24)}`, siteId: SITE_ID, label: item.basename, storageKey: storageKey(assetUrl), mimeType: info.format === "jpeg" ? "image/jpeg" : `image/${info.format || "webp"}`, usageType: "theme", sourceType: "aidreamcapes-eu-existing-local-asset-reused", previewUrl: assetUrl, originUrl: assetUrl, altText: altMap.get(assetUrl), notes: `Existing local asset reused from ${item.source}; no provider request.` },
            update: { previewUrl: assetUrl, originUrl: assetUrl, altText: altMap.get(assetUrl), sourceType: "aidreamcapes-eu-existing-local-asset-reused" }
          });
        }
        await assertAidreamcapesEuHomepageIntegrity(tx);
      }, { maxWait: 20_000, timeout: 120_000 });
      report.backupPath = backupPath;
    }

    writeJson(path.join(REPORT_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), report);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
