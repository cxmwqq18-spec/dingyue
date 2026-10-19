#!/usr/bin/env node

/**
 * Aidreamcapes-only public-media readable URL migration.
 *
 * Run from the active production release with DATABASE_TARGET=production.
 * `plan` reads current LivePage.contentJson and MediaAsset rows, `stage` copies
 * verified files into typed persistent directories, and `apply` updates only
 * those relational URL fields. SHA-256 remains an integrity check, never a
 * public filename. Stable sceneSlug fields are opt-in because the
 * Recreate route has a separate host-router release gate. This script never
 * reads ThemePage, snapshots, AssetUpload file URLs, or another site's rows.
 */

import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createReadStream } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { readableMediaTarget, READABLE_STATIC_RE } from "./lib/aidreamcapes-readable-media.mjs";

const SITE_ID = "site_aidreamcapes";
const SITE_ROOT = "/www/wwwroot/aidreamcapes.com";
const HOSTS = new Set(["", "www.aivideosugc.com", "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"]);
const MEDIA_TOKEN_RE = /(?:https?:\/\/|\/)[^\s"'<>()[\]{}]*?\.(?:avif|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|png|svg|wav|webm|webp)(?:\?[^\s"'<>()[\]{}]*)?/gi;
const HASHED_STATIC_RE = /^\/assets\/sites\/site_aidreamcapes\/public-media\/(.+)--sha256-([a-f0-9]{64})\.(avif|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|png|svg|wav|webm|webp)$/i;
const EXTENSION_MIME = {
  avif: "image/avif", gif: "image/gif", jpeg: "image/jpeg", jpg: "image/jpeg",
  m4a: "audio/mp4", m4v: "video/mp4", mov: "video/quicktime", mp3: "audio/mpeg",
  mp4: "video/mp4", ogg: "audio/ogg", png: "image/png", svg: "image/svg+xml",
  wav: "audio/wav", webm: "video/webm", webp: "image/webp",
};
const BROKEN_REFERENCE_REPAIR = new Map([
  [
    "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/generated/video-topic-media/video-ad/video-ad-01.webp",
    "/assets/sites/site_aidreamcapes/ads-testing-v3/hook-lab/hook-lab-hero-output.webp",
  ],
]);

function arg(name) {
  const prefix = `${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const normalized = line.startsWith("export ") ? line.slice(7).trim() : line;
    const index = normalized.indexOf("=");
    if (index <= 0) continue;
    const key = normalized.slice(0, index).trim();
    let value = normalized.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

function assertTarget(mode) {
  if (arg("--target") !== "production" || process.env.DATABASE_TARGET !== "production") {
    throw new Error("This operation requires --target=production and DATABASE_TARGET=production.");
  }
  if (arg("--confirm-site") !== SITE_ID) throw new Error(`Confirm the exact write scope with --confirm-site=${SITE_ID}.`);
  if (!new RegExp(`^${SITE_ROOT.replaceAll("/", "\\/")}\/releases\/[^/]+$`).test(process.cwd())) {
    throw new Error("Run this operation from the active Aidreamcapes release directory.");
  }
  if (fs.realpathSync(path.join(SITE_ROOT, "current")) !== process.cwd()) throw new Error("inactive_release_cannot_migrate_current_media");
  if (mode === "apply" && arg("--apply") !== "aidreamcapes-static-media-20261018") {
    throw new Error("Database writes require --apply=aidreamcapes-static-media-20261018.");
  }
}

function pointerPart(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function plainRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function normalizedMediaUrl(raw) {
  if (typeof raw !== "string" || !raw.trim()) throw new Error("empty_or_non_string_media_url");
  let url;
  try { url = new URL(raw, "https://www.aivideosugc.com"); }
  catch { throw new Error(`invalid_media_url:${raw.slice(0, 180)}`); }
  const rootRelative = raw.startsWith("/") && !raw.startsWith("//");
  const host = rootRelative ? "" : url.hostname.toLowerCase();
  if (!HOSTS.has(host)) throw new Error(`external_media_host:${host}`);
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("non_http_media_url");
  const pathname = decodeURIComponent(url.pathname);
  if (!pathname.startsWith("/assets/sites/site_aidreamcapes/") && !READABLE_STATIC_RE.test(pathname)) throw new Error(`outside_site_media_root:${pathname}`);
  const normalized = path.posix.normalize(pathname);
  if (normalized !== pathname || pathname.includes("..") || pathname.includes("\\")) throw new Error(`unsafe_media_path:${pathname}`);
  if (url.username || url.password) throw new Error("credentialed_media_url");
  return { host, pathname, query: url.search, extension: path.posix.extname(pathname).slice(1).toLowerCase() };
}

function absolutePublicFile(publicRoot, pathname) {
  const filePath = path.resolve(publicRoot, `.${pathname}`);
  if (!filePath.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`media_path_escape:${pathname}`);
  return filePath;
}

async function inspectFile(filePath, extension) {
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) throw new Error(`media_source_not_file:${filePath}`);
  const digest = createHash("sha256");
  const first = Buffer.alloc(32);
  let firstBytes = 0;
  let last = Buffer.alloc(2);
  let lastBytes = 0;
  let bytes = 0;
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => {
      digest.update(chunk);
      if (firstBytes < first.length) {
        const count = Math.min(first.length - firstBytes, chunk.length);
        chunk.copy(first, firstBytes, 0, count);
        firstBytes += count;
      }
      if (chunk.length >= last.length) chunk.copy(last, 0, chunk.length - last.length);
      else {
        last.copy(last, 0, chunk.length);
        chunk.copy(last, last.length - chunk.length);
      }
      lastBytes = Math.min(last.length, lastBytes + chunk.length);
      bytes += chunk.length;
    });
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  const head = first.subarray(0, firstBytes);
  let valid = true;
  if (extension === "webp") valid = head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP";
  else if (extension === "png") valid = head.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  else if (extension === "mp4" || extension === "m4v" || extension === "m4a" || extension === "mov") valid = head.subarray(4, 8).toString("ascii") === "ftyp";
  else if (extension === "jpg" || extension === "jpeg") valid = head[0] === 0xff && head[1] === 0xd8 && lastBytes === 2 && last[0] === 0xff && last[1] === 0xd9;
  else if (extension === "avif") valid = head.subarray(4, 8).toString("ascii") === "ftyp" && head.subarray(8, 12).toString("ascii").startsWith("avif");
  else if (extension === "gif") valid = ["GIF87a", "GIF89a"].includes(head.subarray(0, 6).toString("ascii"));
  else if (extension === "webm") valid = head.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex"));
  else if (extension === "svg") valid = head.toString("utf8").includes("<svg");
  else throw new Error(`unsupported_media_extension:${extension}`);
  if (!valid) throw new Error(`media_signature_mismatch:${filePath}`);
  return { sha256: digest.digest("hex"), bytes, mimeType: EXTENSION_MIME[extension] ?? "application/octet-stream" };
}

function scenePresetCard(card) {
  const image = plainRecord(card?.image);
  if (!image || typeof image.src !== "string" || !/^\/(?:media\/site_aidreamcapes|assets\/sites\/site_aidreamcapes)\/[A-Za-z0-9_./@%+-]+(?:\.(?:avif|gif|jpe?g|png|webp|mp4|webm))?$/i.test(image.src)) return false;
  if (card.kind !== "video" && card.kind !== "photo") return false;
  if (typeof card.label !== "string" || !card.label.trim()) return false;
  if (typeof card.prompt !== "string" || !card.prompt.trim() || card.prompt.length > 4000) return false;
  if (typeof card.href !== "string") return false;
  try {
    const href = new URL(card.href, "https://www.aivideosugc.com");
    return HOSTS.has(href.hostname.toLowerCase()) && href.pathname === "/app/create";
  } catch { return false; }
}

function sceneSlugText(value) {
  const valueSlug = String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
  return valueSlug || "scene";
}

function sceneCardDigest(pageSlug, card) {
  const image = plainRecord(card.image);
  return createHash("sha256").update(JSON.stringify([
    SITE_ID, pageSlug, card.kind, card.key ?? card.id ?? "", card.label, card.prompt, image?.src, card.tool ?? "",
  ])).digest("hex");
}

function addSceneSlugs(contentJson, page, globalRouteSlugs, sceneChanges) {
  const content = structuredClone(contentJson);
  const sections = plainRecord(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : Object.keys(sections ?? {});
  let eligible = 0;
  for (const sectionId of order) {
    if (typeof sectionId !== "string") continue;
    const section = plainRecord(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const cards = section?.settings?.data?.visual?.picker?.cards;
    if (!Array.isArray(cards)) continue;
    cards.forEach((candidate, index) => {
      const card = plainRecord(candidate);
      if (!card || !scenePresetCard(card)) return;
      eligible += 1;
      const uniqueKey = (slug) => `${page.slug}\0${slug}`;
      let sceneSlug = typeof card.sceneSlug === "string" ? card.sceneSlug : "";
      if (sceneSlug && !/^[a-z0-9][a-z0-9-]{0,159}$/.test(sceneSlug)) throw new Error(`invalid_existing_scene_slug:${page.slug}`);
      if (!sceneSlug && arg("--include-scene-slugs") === "true") {
        const digest = sceneCardDigest(page.slug, card);
        const base = sceneSlugText(card.label);
        let digestLength = 12;
        sceneSlug = `${base}-${digest.slice(0, digestLength)}`;
        while (globalRouteSlugs.has(uniqueKey(sceneSlug)) && digestLength < digest.length) {
          digestLength = Math.min(digest.length, digestLength + 4);
          sceneSlug = `${base}-${digest.slice(0, digestLength)}`;
        }
        if (globalRouteSlugs.has(uniqueKey(sceneSlug))) sceneSlug = `${base}-${digest}-${index + 1}`;
        card.sceneSlug = sceneSlug;
        sceneChanges.push({
          pageId: page.id,
          slug: page.slug,
          pointer: `/sections/${pointerPart(sectionId)}/settings/data/visual/picker/cards/${index}/sceneSlug`,
          before: null,
          after: sceneSlug,
        });
      }
      if (!sceneSlug) return;
      if (globalRouteSlugs.has(uniqueKey(sceneSlug))) throw new Error(`duplicate_scene_slug:${page.slug}:${sceneSlug}`);
      globalRouteSlugs.add(uniqueKey(sceneSlug));
    });
  }
  return { contentJson: content, eligible };
}

function collectUrlOccurrences(contentJson, page) {
  const urls = new Map();
  const errors = [];
  function visit(value, pointer) {
    if (typeof value === "string") {
      if (/\/api\/(?:local-assets\/|sites\/[^/]+\/customers\/[^/]+\/assets\/)/i.test(value)) errors.push({ pageId: page.id, slug: page.slug, pointer, reason: "private_asset_api_reference" });
      for (const match of value.matchAll(MEDIA_TOKEN_RE)) {
        const raw = match[0].replace(/[;,]+$/, "");
        let normalized;
        try { normalized = normalizedMediaUrl(raw); }
        catch (error) { errors.push({ pageId: page.id, slug: page.slug, pointer, reason: String(error?.message ?? error) }); continue; }
        const existing = urls.get(raw) ?? { raw, ...normalized, occurrences: [] };
        existing.occurrences.push({ pageId: page.id, slug: page.slug, pointer });
        urls.set(raw, existing);
      }
      return;
    }
    if (Array.isArray(value)) return value.forEach((entry, index) => visit(entry, `${pointer}/${index}`));
    if (value && typeof value === "object") for (const [key, entry] of Object.entries(value)) visit(entry, `${pointer}/${pointerPart(key)}`);
  }
  visit(contentJson, "");
  return { urls, errors };
}

function rewriteString(value, targetByPath, page, pointer, fieldChanges) {
  return value.replace(MEDIA_TOKEN_RE, (raw) => {
    const trailing = raw.match(/[;,]+$/)?.[0] ?? "";
    const clean = trailing ? raw.slice(0, -trailing.length) : raw;
    const normalized = normalizedMediaUrl(clean);
    const repairedPath = BROKEN_REFERENCE_REPAIR.get(normalized.pathname) ?? normalized.pathname;
    const targetUrl = targetByPath.get(repairedPath);
    if (!targetUrl) throw new Error(`unmapped_current_media_url:${page.slug}:${pointer}:${normalized.pathname}`);
    fieldChanges.push({ pageId: page.id, slug: page.slug, pointer, before: clean, after: targetUrl });
    return `${targetUrl}${trailing}`;
  });
}

function rewriteJson(value, targetByPath, page, pointer, fieldChanges) {
  if (typeof value === "string") return rewriteString(value, targetByPath, page, pointer, fieldChanges);
  if (Array.isArray(value)) return value.map((entry, index) => rewriteJson(entry, targetByPath, page, `${pointer}/${index}`, fieldChanges));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, rewriteJson(entry, targetByPath, page, `${pointer}/${pointerPart(key)}`, fieldChanges)]));
}

async function preparePlan(prisma) {
  const publicRoot = fs.realpathSync(path.resolve("public"));
  const mediaRoot = path.join(SITE_ROOT, "shared", "sites", "public-media");
  const legacyMediaRoot = path.join(SITE_ROOT, "shared", "aidreamcapes-public-media");
  const [pages, assets, derivedState] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, siteId: true, slug: true, contentJson: true, updatedAt: true }, orderBy: { slug: "asc" } }),
    prisma.mediaAsset.findMany({ where: { siteId: SITE_ID }, select: { id: true, siteId: true, label: true, mimeType: true, usageType: true, previewUrl: true, originUrl: true, updatedAt: true }, orderBy: { id: "asc" } }),
    prisma.sitePublishedState.findUnique({ where: { siteId: SITE_ID }, select: { revision: true, contentHash: true, publishedAt: true } }),
  ]);
  if (pages.some((page) => page.siteId !== SITE_ID) || assets.some((asset) => asset.siteId !== SITE_ID)) throw new Error("cross_site_row_detected");
  const actorPathSet = new Set();
  for (const asset of assets) {
    if (!/actor|avatar|presenter|spokesperson|voice/i.test(`${asset.usageType} ${asset.sourceType ?? ""}`)) continue;
    for (const value of [asset.previewUrl, asset.originUrl]) if (value) actorPathSet.add(normalizedMediaUrl(value).pathname);
  }

  const sourcePathOccurrences = new Map();
  const uniqueLivePageUrlStrings = new Set();
  const pageUrlResults = pages.map((page) => {
    const collected = collectUrlOccurrences(page.contentJson, page);
    for (const error of collected.errors) throw new Error(`unsafe_public_media_reference:${error.slug}:${error.pointer}:${error.reason}`);
    for (const [raw, occurrence] of collected.urls) {
      uniqueLivePageUrlStrings.add(raw);
      const pathRefs = sourcePathOccurrences.get(occurrence.pathname) ?? { pageUrls: 0, occurrenceCount: 0, firstReference: occurrence.occurrences[0] };
      pathRefs.pageUrls += 1;
      pathRefs.occurrenceCount += occurrence.occurrences.length;
      sourcePathOccurrences.set(occurrence.pathname, pathRefs);
    }
    return { page, urlCount: collected.urls.size, occurrenceCount: [...collected.urls.values()].reduce((sum, item) => sum + item.occurrences.length, 0) };
  });

  const mediaFieldRows = [];
  for (const asset of assets) for (const field of ["previewUrl", "originUrl"]) {
    const value = asset[field];
    if (!value) continue;
    const normalized = normalizedMediaUrl(value);
    mediaFieldRows.push({ asset, field, value, ...normalized });
    if (!sourcePathOccurrences.has(normalized.pathname)) sourcePathOccurrences.set(normalized.pathname, { pageUrls: 0, occurrenceCount: 0, firstReference: { pageId: asset.id, slug: "MediaAsset" } });
  }

  // This single existing marketing fallback is already broken in production.
  // Repair it with the current Hook Lab page's own lead image, never another site's media.
  for (const [brokenPath, replacementPath] of BROKEN_REFERENCE_REPAIR) {
    const refs = sourcePathOccurrences.get(brokenPath);
    if (!refs) continue;
    const replacement = path.resolve(publicRoot, `.${replacementPath}`);
    if (!replacement.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(replacement)) throw new Error(`missing_repair_source:${replacementPath}`);
    if (!sourcePathOccurrences.has(replacementPath)) sourcePathOccurrences.set(replacementPath, { pageUrls: 0, occurrenceCount: 0, firstReference: { pageId: "repair", slug: "Aidreamcapes current Hook Lab page" } });
  }

  const sourceInfoByPath = new Map();
  const usedPublicNames = new Set();
  for (const [pathname, refs] of sourcePathOccurrences) {
    let repairedFrom;
    let sourcePath = pathname;
    if (BROKEN_REFERENCE_REPAIR.has(pathname)) {
      repairedFrom = pathname;
      sourcePath = BROKEN_REFERENCE_REPAIR.get(pathname);
    }
    const staticMatch = sourcePath.match(HASHED_STATIC_RE);
    let sourceFile;
    let targetUrl;
    let relativeOutput;
    let info;
    const readableStatic = sourcePath.match(READABLE_STATIC_RE);
    if (staticMatch) {
      const oldRelative = sourcePath.slice("/assets/sites/site_aidreamcapes/public-media/".length);
      sourceFile = path.resolve(legacyMediaRoot, oldRelative);
      if (!sourceFile.startsWith(`${legacyMediaRoot}${path.sep}`) || !fs.existsSync(sourceFile)) throw new Error(`hashed_static_file_missing:${sourcePath}`);
      const extension = staticMatch[3].toLowerCase();
      info = await inspectFile(sourceFile, extension);
      if (info.sha256 !== staticMatch[2]) throw new Error(`hashed_static_digest_mismatch:${sourcePath}`);
      const isActor = actorPathSet.has(sourcePath) || /(?:^|[\/_-])(?:actor|actors|avatar|presenter|spokesperson)(?:[\/_-]|$)/i.test(sourcePath);
      ({ targetUrl, relativeOutput } = readableMediaTarget(sourcePath, extension, isActor, usedPublicNames));
    } else if (readableStatic) {
      targetUrl = sourcePath;
      const prefix = readableStatic[1];
      const leaf = path.posix.basename(sourcePath);
      const physicalFolder = prefix === "ai-actors" || /\/(?:actors)\//.test(sourcePath) ? "actor"
        : prefix === "ai-video-generation" ? "video" : "image";
      relativeOutput = `${physicalFolder}/${leaf}`;
      sourceFile = path.resolve(mediaRoot, relativeOutput);
      if (!sourceFile.startsWith(`${mediaRoot}${path.sep}`) || !fs.existsSync(sourceFile)) throw new Error(`readable_static_file_missing:${sourcePath}`);
      const extension = path.posix.extname(sourcePath).slice(1).toLowerCase();
      info = await inspectFile(sourceFile, extension);
      usedPublicNames.add(targetUrl);
    } else {
      sourceFile = absolutePublicFile(publicRoot, sourcePath);
      if (!fs.existsSync(sourceFile) || !fs.statSync(sourceFile).isFile()) {
        throw new Error(`unresolved_current_media_source:${pathname}${repairedFrom ? ` (repair target ${sourcePath})` : ""}`);
      }
      const realSource = fs.realpathSync(sourceFile);
      if (!realSource.startsWith(`${publicRoot}${path.sep}`)) throw new Error(`media_symlink_escapes_site_root:${pathname}`);
      const extension = path.posix.extname(sourcePath).slice(1).toLowerCase();
      info = await inspectFile(sourceFile, extension);
      const isActor = actorPathSet.has(sourcePath) || /(?:^|[\/_-])(?:actor|actors|avatar|presenter|spokesperson)(?:[\/_-]|$)/i.test(sourcePath);
      ({ targetUrl, relativeOutput } = readableMediaTarget(sourcePath, extension, isActor, usedPublicNames));
    }
    sourceInfoByPath.set(pathname, { pathname, sourcePath, repairedFrom, sourceFile, relativeOutput, targetUrl, ...info, refs });
  }

  // The built-in Aidreamcapes actor catalog is a code-owned relationally
  // independent asset source used by /app. Keep its portraits and voice samples
  // in the same persistent actor directory, while their public URLs stay short.
  const actorCatalogPath = path.resolve("src/lib/aidreamcapes-workspace/actors.json");
  const actorCatalog = JSON.parse(fs.readFileSync(actorCatalogPath, "utf8"));
  if (actorCatalog.actors?.length !== 53) throw new Error("aidreamcapes_actor_catalog_count_changed_review_required");
  const codeAssetFiles = [];
  for (const actor of actorCatalog.actors) {
    if (!/^[a-z0-9][a-z0-9-]{0,80}$/.test(actor.actorId)) throw new Error(`invalid_builtin_actor_id:${actor.actorId}`);
    const specs = [
      { sourceFile: path.resolve(publicRoot, `media/site_aidreamcapes/workspace/actors/library/${actor.actorId}.webp`), targetUrl: `/ai-image-generation/actors/${actor.actorId}.webp`, extension: "webp" },
      { sourceFile: path.resolve(publicRoot, `assets/sites/site_aidreamcapes/workspace/actors/voices/${actor.actorId}.mp3`), targetUrl: `/ai-actors/${actor.actorId}.mp3`, extension: "mp3" },
    ];
    for (const spec of specs) {
      if (!spec.sourceFile.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(spec.sourceFile)) throw new Error(`builtin_actor_asset_missing:${actor.actorId}:${spec.extension}`);
      const info = await inspectFile(spec.sourceFile, spec.extension);
      const relativeOutput = `actor/${actor.actorId}.${spec.extension}`;
      const existing = codeAssetFiles.find((item) => item.targetUrl === spec.targetUrl);
      if (existing && (existing.sha256 !== info.sha256 || existing.bytes !== info.bytes)) throw new Error(`builtin_actor_asset_conflict:${spec.targetUrl}`);
      if (!existing) codeAssetFiles.push({ sourcePath: spec.sourceFile.slice(publicRoot.length), sourceFile: spec.sourceFile, relativeOutput, targetUrl: spec.targetUrl, ...info, actorId: actor.actorId });
    }
  }

  const targetByPath = new Map([...sourceInfoByPath].map(([pathname, info]) => [pathname, info.targetUrl]));
  for (const [brokenPath, replacementPath] of BROKEN_REFERENCE_REPAIR) {
    if (!sourceInfoByPath.has(brokenPath)) continue;
    targetByPath.set(brokenPath, sourceInfoByPath.get(brokenPath).targetUrl);
    if (!sourceInfoByPath.has(replacementPath)) throw new Error(`repair_target_not_in_plan:${replacementPath}`);
  }

  const fieldChanges = [];
  const sceneChanges = [];
  const globalRouteSlugs = new Set();
  const plannedPages = pageUrlResults.map(({ page }) => {
    const slugged = addSceneSlugs(page.contentJson, page, globalRouteSlugs, sceneChanges);
    const contentJson = rewriteJson(slugged.contentJson, targetByPath, page, "", fieldChanges);
    const beforeHash = createHash("sha256").update(JSON.stringify(page.contentJson)).digest("hex");
    const afterHash = createHash("sha256").update(JSON.stringify(contentJson)).digest("hex");
    return { page, contentJson, beforeHash, afterHash, changed: beforeHash !== afterHash, eligibleSceneCards: slugged.eligible };
  });
  const plannedAssets = assets.map((asset) => {
    const fields = mediaFieldRows.filter((row) => row.asset.id === asset.id).map(({ field, value, pathname }) => {
      const after = targetByPath.get(pathname);
      if (!after) throw new Error(`unmapped_media_asset_field:${asset.id}:${field}`);
      return { field, value, after, pathname, changed: value !== after };
    });
    const actualTypes = new Set(fields.map((field) => sourceInfoByPath.get(field.pathname)?.mimeType).filter(Boolean));
    if (actualTypes.size > 1) throw new Error(`media_asset_has_conflicting_mime_types:${asset.id}`);
    const expectedMimeType = actualTypes.values().next().value;
    const data = Object.fromEntries(fields.filter((field) => field.changed).map((field) => [field.field, field.after]));
    const mimeTypeChanged = Boolean(expectedMimeType && asset.mimeType !== expectedMimeType);
    if (mimeTypeChanged) data.mimeType = expectedMimeType;
    return {
      asset,
      fields,
      data,
      expectedMimeType,
      mimeTypeBefore: asset.mimeType,
      mimeTypeAfter: expectedMimeType ?? asset.mimeType,
      mimeTypeChanged,
      changed: Object.keys(data).length > 0,
    };
  });

  const actualFiles = new Map();
  for (const info of sourceInfoByPath.values()) {
    const key = info.targetUrl;
    const current = actualFiles.get(key);
    if (!current) actualFiles.set(key, info);
  }
  for (const item of codeAssetFiles) {
    const current = actualFiles.get(item.targetUrl);
    if (current && (current.sha256 !== item.sha256 || current.bytes !== item.bytes)) throw new Error(`actor_asset_target_conflict:${item.targetUrl}`);
    if (!current) actualFiles.set(item.targetUrl, item);
  }
  const actualPaths = [...actualFiles.values()];
  const repairedReferences = [...BROKEN_REFERENCE_REPAIR].flatMap(([from, to]) => {
    const refs = sourcePathOccurrences.get(from);
    return refs ? [{ from, to, pageUrlCount: refs.pageUrls, occurrenceCount: refs.occurrenceCount, targetUrl: sourceInfoByPath.get(from)?.targetUrl }] : [];
  });

  const summary = {
    generatedAt: new Date().toISOString(),
    target: "production",
    siteId: SITE_ID,
    dataOwner: "PostgreSQL LivePage.contentJson + site-filtered MediaAsset.previewUrl/originUrl",
    pages: pages.length,
    uniqueLivePageUrlStrings: uniqueLivePageUrlStrings.size,
    livePageOccurrences: pageUrlResults.reduce((sum, item) => sum + item.occurrenceCount, 0),
    livePageSourcePaths: pageUrlResults.length ? [...sourcePathOccurrences.values()].filter((item) => item.pageUrls > 0).length : 0,
    mediaAssetRows: assets.length,
    nonemptyMediaAssetUrlFields: mediaFieldRows.length,
    uniqueSourcePaths: sourceInfoByPath.size,
    uniqueOutputFiles: actualFiles.size,
    outputBytes: actualPaths.reduce((sum, item) => sum + item.bytes, 0),
    changedLivePages: plannedPages.filter((item) => item.changed).length,
    changedMediaAssetRows: plannedAssets.filter((item) => item.changed).length,
    changedMediaAssetUrlFields: plannedAssets.flatMap((item) => item.fields).filter((field) => field.changed).length,
    changedMediaAssetMimeTypes: plannedAssets.filter((item) => item.mimeTypeChanged).length,
    existingMediaAssetMimeMismatches: plannedAssets.reduce((sum, item) => sum + (item.mimeTypeChanged ? item.fields.filter((field) => field.value).length : 0), 0),
    scenePresetCards: plannedPages.reduce((sum, item) => sum + item.eligibleSceneCards, 0),
    newSceneSlugs: sceneChanges.length,
    repairedBrokenReferences: repairedReferences,
    derivedState: derivedState ? { revision: derivedState.revision, contentHash: derivedState.contentHash, publishedAt: derivedState.publishedAt.toISOString() } : null,
    persistentStaticRoot: mediaRoot,
    publicStaticServing: "Extension-qualified Nginx aliases in the www.aivideosugc.com TLS vhost",
    noPrivateAssetUploadsRead: true,
    builtinActorAssets: codeAssetFiles.length,
  };

  const fieldManifest = [];
  for (const planned of plannedPages) {
    if (!planned.changed) continue;
    // URL field changes are emitted by rewriteJson; preserve them as exact field-level inverse entries.
    fieldManifest.push(...fieldChanges.filter((change) => change.pageId === planned.page.id));
    for (const change of sceneChanges) if (change.pageId === planned.page.id) fieldManifest.push(change);
  }
  const mediaManifest = plannedAssets.flatMap((item) => {
    if (!item.changed) return [];
    return [
      ...item.fields.filter((field) => field.changed).map((field) => ({
        entity: "MediaAsset", id: item.asset.id, field: field.field, before: field.value, after: field.after,
        baseUpdatedAt: item.asset.updatedAt.toISOString(),
      })),
      ...(item.mimeTypeChanged ? [{
        entity: "MediaAsset", id: item.asset.id, field: "mimeType", before: item.mimeTypeBefore, after: item.mimeTypeAfter,
        baseUpdatedAt: item.asset.updatedAt.toISOString(),
      }] : []),
    ];
  });
  const pageManifest = plannedPages.filter((item) => item.changed).map((item) => ({
    entity: "LivePage", id: item.page.id, slug: item.page.slug, baseUpdatedAt: item.page.updatedAt.toISOString(),
    beforeContentHash: item.beforeHash, afterContentHash: item.afterHash,
  }));
  return {
    summary,
    publicRoot,
    mediaRoot,
    sourceInfoByPath,
    codeAssetFiles,
    targetByPath,
    actualFiles,
    plannedPages,
    plannedAssets,
    fieldManifest,
    mediaManifest,
    pageManifest,
    sceneChanges,
    repairedReferences,
  };
}

function serializableManifest(plan, mode) {
  return {
    ...plan.summary,
    mode,
    files: [...plan.actualFiles.values()].map(({ sourcePath, relativeOutput, targetUrl, sha256, bytes, mimeType, repairedFrom }) => ({ sourcePath, relativeOutput, targetUrl, sha256, bytes, mimeType, ...(repairedFrom ? { repairedFrom } : {}) })),
    livePageFieldChanges: plan.fieldManifest,
    mediaAssetFieldChanges: plan.mediaManifest,
    pageVersionChanges: plan.pageManifest,
  };
}

function writeAuditFile(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(filePath, 0o600);
}

async function stageFiles(plan) {
  fs.mkdirSync(plan.mediaRoot, { recursive: true, mode: 0o755 });
  const mediaRootStat = fs.lstatSync(plan.mediaRoot);
  if (!mediaRootStat.isDirectory() || mediaRootStat.isSymbolicLink()) throw new Error("persistent_static_root_must_be_a_real_directory");
  const statfs = fs.statfsSync(plan.mediaRoot);
  const available = statfs.bavail * statfs.bsize;
  const newBytes = [...plan.actualFiles.values()].filter((item) => !fs.existsSync(path.join(plan.mediaRoot, item.relativeOutput))).reduce((sum, item) => sum + item.bytes, 0);
  if (available < newBytes + 256 * 1024 * 1024) throw new Error(`insufficient_space_for_static_media:need=${newBytes}:free=${available}`);

  let staged = 0;
  let reused = 0;
  for (const item of plan.actualFiles.values()) {
    const destination = path.resolve(plan.mediaRoot, item.relativeOutput);
    if (!destination.startsWith(`${plan.mediaRoot}${path.sep}`)) throw new Error(`static_target_escape:${item.targetUrl}`);
    fs.mkdirSync(path.dirname(destination), { recursive: true, mode: 0o755 });
    if (fs.existsSync(destination)) {
      const current = await inspectFile(destination, path.extname(destination).slice(1).toLowerCase());
      if (current.sha256 !== item.sha256 || current.bytes !== item.bytes) throw new Error(`existing_static_file_hash_conflict:${item.targetUrl}`);
      reused += 1;
      continue;
    }
    const temporary = `${destination}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
    try {
      try { fs.copyFileSync(item.sourceFile, temporary, fs.constants.COPYFILE_FICLONE); }
      catch (error) {
        if (!new Set(["ENOTSUP", "EOPNOTSUPP", "EXDEV", "EINVAL"]).has(error?.code)) throw error;
        fs.copyFileSync(item.sourceFile, temporary);
      }
      const copied = await inspectFile(temporary, path.extname(destination).slice(1).toLowerCase());
      if (copied.sha256 !== item.sha256 || copied.bytes !== item.bytes) throw new Error(`copied_file_hash_mismatch:${item.targetUrl}`);
      fs.chmodSync(temporary, 0o644);
      fs.renameSync(temporary, destination);
      staged += 1;
    } finally {
      if (fs.existsSync(temporary)) fs.rmSync(temporary, { force: true });
    }
  }

  // Media is served through explicit Nginx aliases. Leave the previous
  // compatibility symlink in place until the new routes are fully verified.
  for (const item of plan.actualFiles.values()) {
    const targetFile = path.join(plan.mediaRoot, item.relativeOutput);
    const check = await inspectFile(targetFile, path.extname(targetFile).slice(1).toLowerCase());
    if (check.sha256 !== item.sha256 || check.bytes !== item.bytes) throw new Error(`static_file_readback_failed:${item.targetUrl}`);
  }
  return { staged, reused, filesVerified: plan.actualFiles.size, copiedBytes: newBytes, servedBy: "www.aivideosugc.com Nginx alias", staticRoot: plan.mediaRoot };
}

async function applyRelationalUpdates(prisma, plan) {
  const pageWrites = plan.plannedPages.filter((item) => item.changed);
  const mediaWrites = plan.plannedAssets.filter((item) => item.changed);
  await prisma.$transaction(async (tx) => {
    for (const item of pageWrites) {
      const updated = await tx.livePage.updateMany({
        where: { id: item.page.id, siteId: SITE_ID, updatedAt: item.page.updatedAt },
        data: { contentJson: item.contentJson },
      });
      if (updated.count !== 1) throw new Error(`live_page_revision_conflict:${item.page.slug}`);
    }
    for (const item of mediaWrites) {
      const current = await tx.mediaAsset.findFirst({
        where: { id: item.asset.id, siteId: SITE_ID, updatedAt: item.asset.updatedAt },
        select: { id: true, previewUrl: true, originUrl: true, mimeType: true },
      });
      if (!current || current.mimeType !== item.mimeTypeBefore || item.fields.some((field) => current[field.field] !== field.value)) {
        throw new Error(`media_asset_field_conflict:${item.asset.id}`);
      }
      const updated = await tx.mediaAsset.updateMany({
        where: { id: item.asset.id, siteId: SITE_ID, updatedAt: item.asset.updatedAt },
        data: item.data,
      });
      if (updated.count !== 1) throw new Error(`media_asset_revision_conflict:${item.asset.id}`);
    }
  }, { maxWait: 10000, timeout: 120000 });

  const [pages, assets] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, contentJson: true, updatedAt: true } }),
    prisma.mediaAsset.findMany({ where: { siteId: SITE_ID }, select: { id: true, previewUrl: true, originUrl: true, mimeType: true, updatedAt: true } }),
  ]);
  const readbackErrors = [];
  let remainingCurrentPaths = 0;
  for (const page of pages) {
    const collected = collectUrlOccurrences(page.contentJson, page);
    if (collected.errors.length) readbackErrors.push(...collected.errors);
    for (const row of collected.urls.values()) {
      if (!READABLE_STATIC_RE.test(row.pathname)) remainingCurrentPaths += 1;
      const target = plan.targetByPath.get(row.pathname);
      if (!target && !READABLE_STATIC_RE.test(row.pathname)) readbackErrors.push({ slug: page.slug, pointer: row.occurrences[0]?.pointer, reason: `unmigrated:${row.pathname}` });
    }
  }
  let remainingMediaFields = 0;
  let remainingMediaMimeMismatches = 0;
  for (const asset of assets) for (const field of ["previewUrl", "originUrl"]) if (asset[field]) {
    if (!READABLE_STATIC_RE.test(new URL(asset[field], "https://www.aivideosugc.com").pathname)) remainingMediaFields += 1;
    const normalized = normalizedMediaUrl(asset[field]);
    const expected = EXTENSION_MIME[normalized.extension];
    if (expected && asset.mimeType !== expected) remainingMediaMimeMismatches += 1;
  }
  if (readbackErrors.length || remainingCurrentPaths || remainingMediaFields || remainingMediaMimeMismatches) {
    throw new Error(`relational_readback_failed:${JSON.stringify({ readbackErrors: readbackErrors.length, remainingCurrentPaths, remainingMediaFields, remainingMediaMimeMismatches })}`);
  }
  return {
    changedLivePages: pageWrites.length,
    changedMediaAssetRows: mediaWrites.length,
    changedMediaAssetUrlFields: plan.plannedAssets.flatMap((item) => item.fields).filter((field) => field.changed).length,
    changedMediaAssetMimeTypes: mediaWrites.filter((item) => item.mimeTypeChanged).length,
    livePagesReadBack: pages.length,
    mediaAssetRowsReadBack: assets.length,
    remainingUnhashedPageReferences: remainingCurrentPaths,
    remainingUnhashedMediaAssetFields: remainingMediaFields,
    remainingMediaMimeMismatches,
    pageRevisions: pageWrites.map((item) => ({ id: item.page.id, slug: item.page.slug, updatedAt: pages.find((page) => page.id === item.page.id)?.updatedAt.toISOString() })),
  };
}

loadEnvFile(path.resolve(".env.local"));
const mode = arg("--mode") ?? "plan";
if (!["plan", "stage", "apply"].includes(mode)) throw new Error("Use --mode=plan, --mode=stage, or --mode=apply.");
assertTarget(mode);
const prisma = new PrismaClient();
try {
  const plan = await preparePlan(prisma);
  const auditRoot = path.join(SITE_ROOT, "ops", "aidreamcapes-static-media-20261018");
  const manifest = serializableManifest(plan, mode);
  if (mode === "plan") {
    writeAuditFile(path.join(auditRoot, "plan-current.json"), manifest);
    console.log(JSON.stringify({ ...plan.summary, planFile: path.join(auditRoot, "plan-current.json") }, null, 2));
  } else if (mode === "stage") {
    if (plan.sourceInfoByPath.size !== plan.actualFiles.size && [...plan.sourceInfoByPath.values()].some((item) => !item.targetUrl)) throw new Error("incomplete_static_file_map");
    const staged = await stageFiles(plan);
    writeAuditFile(path.join(auditRoot, "stage-current.json"), { ...manifest, staged });
    console.log(JSON.stringify({ ...plan.summary, staged, stageFile: path.join(auditRoot, "stage-current.json") }, null, 2));
  } else {
    const stagePath = path.join(auditRoot, "stage-current.json");
    if (!fs.existsSync(stagePath)) throw new Error("Run --mode=stage and pass origin/public HTTP checks before database apply.");
    const stage = JSON.parse(fs.readFileSync(stagePath, "utf8"));
    if (stage.siteId !== SITE_ID || stage.uniqueOutputFiles !== plan.summary.uniqueOutputFiles) throw new Error("staged_manifest_does_not_match_current_plan");
    const currentFilesHash = createHash("sha256").update(JSON.stringify(serializableManifest(plan, mode).files)).digest("hex");
    if (createHash("sha256").update(JSON.stringify(stage.files)).digest("hex") !== currentFilesHash) throw new Error("staged_file_manifest_changed");
    for (const readbackMode of ["origin", "public"]) {
      const report = JSON.parse(fs.readFileSync(path.join(auditRoot, `http-${readbackMode}-current.json`), "utf8"));
      if (report.siteId !== SITE_ID || report.mode !== readbackMode || report.filesHash !== currentFilesHash || report.failed !== 0 || report.passed !== plan.actualFiles.size) {
        throw new Error(`static_http_readback_gate_failed:${readbackMode}`);
      }
    }
    for (const item of plan.actualFiles.values()) {
      const targetFile = path.join(plan.mediaRoot, item.relativeOutput);
      const verified = await inspectFile(targetFile, path.extname(targetFile).slice(1).toLowerCase());
      if (verified.sha256 !== item.sha256 || verified.bytes !== item.bytes) throw new Error(`apply_static_file_preflight_failed:${item.targetUrl}`);
    }
    const applied = await applyRelationalUpdates(prisma, plan);
    writeAuditFile(path.join(auditRoot, "apply-current.json"), { ...manifest, applied, completedAt: new Date().toISOString() });
    console.log(JSON.stringify({ ...plan.summary, applied: { ...applied, pageRevisions: undefined }, applyFile: path.join(auditRoot, "apply-current.json") }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
