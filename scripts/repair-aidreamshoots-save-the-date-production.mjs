#!/usr/bin/env node

// Publish the already-reviewed Spanish Save the Date content from the local
// publication database to the production Aidreamshoots storefront. This is a
// deliberately narrow repair: it only touches the 12 public topic routes,
// their legacy wedding-invitation alias, their ThemePage mirrors, the
// Save-the-Date navigation setting, and referenced MediaAsset rows. It never
// calls an image provider.

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import {
  assertDatabaseTarget,
  buildTunneledDatabaseUrl,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const PRODUCTION_DOMAIN = "aidreamshoots.eu";
const PRODUCTION_ORIGIN = `https://${PRODUCTION_DOMAIN}`;
const CONFIRMATION = "aidreamshoots-save-the-date-content-production";
const BACKUP_DIRECTORY = path.resolve("releases/backups/production");
const PUBLIC_ROOT = "/assets/sites/site_aidreamshoots/";
const TOPIC_PATHS = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-invitation",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day"
];
const WEDDING_INVITATION_SOURCE_PATH = "/ai-video-generation/wedding-invitation";
const TOPIC_LABELS = {
  "valentines-day": "San Valentín",
  engagement: "compromiso",
  proposal: "propuesta de matrimonio",
  "save-the-date": "Guardar la fecha",
  "wedding-invitation": "invitación de boda",
  "wedding-ceremony": "ceremonia de boda",
  christmas: "Navidad",
  halloween: "Halloween",
  thanksgiving: "Acción de Gracias",
  "new-year": "Año Nuevo",
  "mothers-day": "Día de la Madre",
  "fathers-day": "Día del Padre"
};
const IMAGE_KEYS = /^(?:src|imageUrl|imageOriginalUrl|poster|posterUrl|thumbnail|thumbnailUrl|cover|coverUrl|heroImage|backgroundImage|beforeImage|resultImageUrl)$/i;
const ALT_KEYS = /^(?:alt|imageAlt|ogImageAlt|twitterImageAlt)$/i;
const IMAGE_VALUE = /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i;

const apply = hasArgument("--apply");
const confirmed = process.argv.includes(`--confirm=${CONFIRMATION}`);
const repoRoot = process.cwd();

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function stableJson(value) {
  return JSON.stringify(value, (_key, current) => {
    if (current && typeof current === "object" && !Array.isArray(current)) {
      return Object.fromEntries(Object.entries(current).sort(([left], [right]) => left.localeCompare(right)));
    }
    return current;
  });
}

function sha(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

function topicSlug(pagePath) {
  return pagePath.split("/").filter(Boolean).at(-1);
}

function sourceSlugFor(pagePath) {
  return pagePath === "/ai-save-the-date/wedding-invitation" ? WEDDING_INVITATION_SOURCE_PATH : pagePath;
}

function isObject(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function stripQuery(value) {
  return String(value).split(/[?#]/)[0];
}

function normalizeSpanishCopy(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/\b(vídeos?|videos?)\s+AI\b/gi, (_match, word) => `${word.toLowerCase().endsWith("s") ? "vídeos" : "vídeo"} con IA`)
    .replace(/\bAI\s+Guardar la fecha\b/gi, "IA para guardar la fecha")
    .replace(/\bAI\s+guardar la fecha\b/gi, "IA para guardar la fecha")
    .replace(/\bAI\s+guarda la fecha\b/gi, "IA para guardar la fecha")
    .replace(/\bTEMA DE VÍDEO IA\b/gi, "TEMA DE VÍDEO CON IA")
    .replace(/\bAI\b/g, "IA")
    .replace(/\bvideos\b/g, "vídeos");
}

function fallbackAlt(pagePath, currentAlt) {
  const slug = topicSlug(pagePath);
  const label = TOPIC_LABELS[slug] ?? "esta ocasión";
  const normalized = String(currentAlt ?? "").trim().toLowerCase();
  if (normalized === "pareja." || normalized === "una pareja al aire libre.") {
    return `Pareja al aire libre preparando un vídeo de ${label}.`;
  }
  return currentAlt;
}

function normalizeImageAlts(value, pagePath) {
  if (Array.isArray(value)) return value.map((item) => normalizeImageAlts(item, pagePath));
  if (!isObject(value)) return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeImageAlts(child, pagePath)]));
  for (const [key, child] of Object.entries(next)) {
    if (ALT_KEYS.test(key) && typeof child === "string") next[key] = fallbackAlt(pagePath, child);
  }
  return next;
}

function normalizeAllStrings(value, pagePath) {
  if (Array.isArray(value)) return value.map((item) => normalizeAllStrings(item, pagePath));
  if (!isObject(value)) return typeof value === "string" ? normalizeSpanishCopy(value) : value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, normalizeAllStrings(child, pagePath)]));
}

function collectImageObjects(value, output = [], seen = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectImageObjects(item, output, seen);
    return output;
  }
  if (!isObject(value)) return output;
  const src = typeof value.src === "string" ? value.src : "";
  const alt = typeof value.alt === "string" ? value.alt.trim() : "";
  if (src && alt && IMAGE_VALUE.test(src) && !seen.has(src)) {
    seen.add(src);
    output.push({
      src,
      ...(typeof value.originalSrc === "string" ? { originalSrc: value.originalSrc } : {}),
      ...(typeof value.originalUrl === "string" ? { originalUrl: value.originalUrl } : {}),
      ...(typeof value.imageOriginalUrl === "string" ? { imageOriginalUrl: value.imageOriginalUrl } : {}),
      alt,
      width: Number(value.width) || 1600,
      height: Number(value.height) || 1000,
      caption: typeof value.caption === "string" ? value.caption : undefined
    });
  }
  for (const child of Object.values(value)) collectImageObjects(child, output, seen);
  return output;
}

function collectImageRefs(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectImageRefs(item, output);
    return output;
  }
  if (!isObject(value)) return output;
  for (const [key, child] of Object.entries(value)) {
    if (IMAGE_KEYS.test(key) && typeof child === "string" && IMAGE_VALUE.test(child)) output.add(stripQuery(child));
    collectImageRefs(child, output);
  }
  return output;
}

function collectStrings(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output);
    return output;
  }
  if (!isObject(value)) {
    if (typeof value === "string") output.push(value);
    return output;
  }
  for (const child of Object.values(value)) collectStrings(child, output);
  return output;
}

function assetFileForUrl(url) {
  assert(url.startsWith("/assets/"), `Asset URL must be rooted at /assets/: ${url}`);
  const relative = url.slice("/assets/".length);
  assert(!relative.includes(".."), `Asset URL escaped public root: ${url}`);
  return path.resolve(repoRoot, "public", "assets", relative);
}

function normalizeManifest(json, pagePath) {
  const existing = Array.isArray(json.mediaManifest)
    ? json.mediaManifest.filter((item) => isObject(item) && typeof item.src === "string" && IMAGE_VALUE.test(item.src))
    : [];
  const source = existing.length ? existing : collectImageObjects(json);
  const seen = new Set();
  const manifest = source.flatMap((item, index) => {
    const src = stripQuery(item.src);
    if (seen.has(src)) return [];
    seen.add(src);
    const alt = fallbackAlt(pagePath, normalizeSpanishCopy(item.alt));
    return [{
      ...item,
      src,
      alt,
      width: Number(item.width) || 1600,
      height: Number(item.height) || 1000,
      role: index === 0 ? "hero" : item.role,
      loading: index === 0 ? "eager" : item.loading,
      fetchPriority: index === 0 ? "high" : item.fetchPriority
    }];
  });
  assert(manifest.length >= 10, `${pagePath}: expected at least 10 source images, got ${manifest.length}`);
  assert(manifest.every((item) => item.src.startsWith(PUBLIC_ROOT)), `${pagePath}: manifest contains a non-Aidreamshoots asset`);
  assert.equal(new Set(manifest.map((item) => item.src)).size, manifest.length, `${pagePath}: manifest has duplicate image URLs`);
  for (const item of manifest) assert(fs.existsSync(assetFileForUrl(item.src)), `${pagePath}: missing local public asset ${item.src}`);
  return manifest;
}

function preparePageJson(rawJson, pagePath) {
  const source = clone(rawJson);
  assert(isObject(source), `${pagePath}: source page JSON is missing`);
  let next = normalizeAllStrings(source, pagePath);
  next = normalizeImageAlts(next, pagePath);
  const manifest = normalizeManifest(next, pagePath);
  const altByUrl = new Map();
  for (const item of manifest) {
    for (const candidate of [item.src, item.originalSrc, item.originalUrl, item.imageOriginalUrl]) {
      if (candidate) altByUrl.set(stripQuery(candidate), item.alt);
    }
  }
  next.mediaManifest = manifest;
  next.seo = {
    ...(isObject(next.seo) ? next.seo : {}),
    canonicalPath: pagePath,
    canonical: `${PRODUCTION_ORIGIN}${pagePath}`,
    index: true,
    follow: true,
    robots: { ...(isObject(next.seo?.robots) ? next.seo.robots : {}), index: true, follow: true, maxImagePreview: "large" },
    ogImage: manifest[0].src,
    twitterImage: manifest[0].src,
    ogImageAlt: altByUrl.get(manifest[0].src),
    twitterImageAlt: altByUrl.get(manifest[0].src)
  };
  next.contentContract = {
    ...(isObject(next.contentContract) ? next.contentContract : {}),
    schema: "editorial-page-v1",
    pageKey: topicSlug(pagePath).replace(/[^a-z0-9]+/gi, "_"),
    mediaCount: manifest.length,
    faqCount: Number(next.contentContract?.faqCount) || 4,
    sourceRevision: "aidreamshoots-eu-save-the-date-production-20260921"
  };
  const refs = collectImageRefs(next);
  for (const ref of refs) assert(altByUrl.has(ref), `${pagePath}: image reference is outside mediaManifest: ${ref}`);
  const forbidden = collectStrings(next)
    .filter((text) => !IMAGE_VALUE.test(text) && !text.startsWith("/assets/") && !/^https?:\/\/[^\s]+\/assets\//i.test(text))
    .filter((text) => /Contenido de AIdreamshoots|Vista previa de una creación fotográfica|\b(?:photographing|decorated|fireplace|Event details)\b/i.test(text));
  assert.equal(forbidden.length, 0, `${pagePath}: generic or mixed-language copy remains: ${JSON.stringify(forbidden.slice(0, 3))}`);
  return next;
}

function validatePageJson(json, pagePath) {
  const manifest = Array.isArray(json?.mediaManifest) ? json.mediaManifest : [];
  const urls = manifest.map((item) => stripQuery(item?.src ?? ""));
  assert(manifest.length >= 10, `${pagePath}: media manifest is too small`);
  assert.equal(new Set(urls).size, urls.length, `${pagePath}: repeated image URL remains in media manifest`);
  assert(urls.every((url) => url.startsWith(PUBLIC_ROOT)), `${pagePath}: non-site image URL remains`);
  assert.equal(collectImageRefs(json).size >= manifest.length, true, `${pagePath}: image references were lost`);
  assert.equal(json?.seo?.canonical, `${PRODUCTION_ORIGIN}${pagePath}`, `${pagePath}: canonical mismatch`);
  const strings = collectStrings(json).filter((text) => !IMAGE_VALUE.test(text) && !text.startsWith("/assets/") && !/^https?:\/\/[^\s]+\/assets\//i.test(text));
  assert.equal(strings.some((text) => /Contenido de AIdreamshoots|Vista previa de una creación fotográfica|\b(?:photographing|decorated|fireplace|Event details)\b/i.test(text)), false, `${pagePath}: generic copy remains`);
  return { manifestCount: manifest.length, uniqueImageCount: new Set(urls).size, imageRefCount: collectImageRefs(json).size };
}

function mediaRowsFor(pages) {
  const byStorageKey = new Map();
  for (const page of pages) {
    for (const item of page.contentJson.mediaManifest ?? []) {
      const storageKey = stripQuery(item.src);
      byStorageKey.set(storageKey, {
        storageKey,
        label: storageKey.split("/").at(-1) || storageKey,
        mimeType: /\.png$/i.test(storageKey) ? "image/png" : /\.webp$/i.test(storageKey) ? "image/webp" : "image/jpeg",
        usageType: "theme",
        sourceType: "aidreamshoots-save-the-date-production-repair",
        previewUrl: storageKey,
        originUrl: storageKey,
        altText: item.alt,
        notes: typeof item.caption === "string" ? item.caption : ""
      });
    }
  }
  return [...byStorageKey.values()].sort((left, right) => left.storageKey.localeCompare(right.storageKey));
}

async function readSource(sourcePrisma) {
  const [site, livePages, themePages, settings] = await Promise.all([
    sourcePrisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, status: true, domains: { select: { domain: true, isPrimary: true } } } }),
    sourcePrisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...TOPIC_PATHS, WEDDING_INVITATION_SOURCE_PATH] } }, orderBy: { slug: "asc" } }),
    sourcePrisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...TOPIC_PATHS, WEDDING_INVITATION_SOURCE_PATH] } }, orderBy: { slug: "asc" } }),
    sourcePrisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true, updatedAt: true } })
  ]);
  assert(site?.slug === "aidreamshoots", `Unexpected local source site: ${site?.slug ?? "missing"}`);
  assert(settings, "Missing local ThemeSettings source");
  const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
  const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
  const pages = TOPIC_PATHS.map((pagePath) => {
    const live = liveBySlug.get(pagePath);
    const theme = themeBySlug.get(sourceSlugFor(pagePath));
    const rawJson = pagePath === "/ai-save-the-date/wedding-invitation"
      ? theme?.publishedJson ?? theme?.draftJson ?? live?.contentJson
      : live?.contentJson ?? theme?.publishedJson ?? theme?.draftJson;
    assert(rawJson, `${pagePath}: no local published source found`);
    const contentJson = preparePageJson(rawJson, pagePath);
    validatePageJson(contentJson, pagePath);
    const themeJson = theme
      ? {
          id: theme.id,
          pageType: theme.pageType,
          templateKey: theme.templateKey,
          title: theme.title,
          draftJson: preparePageJson(theme.draftJson, pagePath),
          publishedJson: preparePageJson(theme.publishedJson && Object.keys(theme.publishedJson).length ? theme.publishedJson : theme.draftJson, pagePath),
          draftMeta: theme.draftMeta
        }
      : null;
    return {
      path: pagePath,
      title: String(contentJson.seo?.title || live?.title || theme?.title || pagePath),
      pageType: live?.pageType ?? theme?.pageType ?? "standard-content",
      templateKey: live?.templateKey ?? theme?.templateKey ?? "save-the-date-editorial",
      contentJson,
      themeJson,
      source: { liveId: live?.id ?? null, themeId: theme?.id ?? null, sourceSlug: theme?.slug ?? live?.slug ?? null }
    };
  });
  assert.equal(pages.length, TOPIC_PATHS.length);
  return { site, pages, settings };
}

async function readTarget(targetPrisma) {
  const [site, livePages, themePages, settings, mediaAssets] = await Promise.all([
    targetPrisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, status: true, domains: { select: { domain: true, isPrimary: true } } } }),
    targetPrisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...TOPIC_PATHS, WEDDING_INVITATION_SOURCE_PATH] } }, orderBy: { slug: "asc" } }),
    targetPrisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: [...TOPIC_PATHS, WEDDING_INVITATION_SOURCE_PATH] } }, orderBy: { slug: "asc" } }),
    targetPrisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { id: true, draftJson: true, publishedJson: true, updatedAt: true } }),
    targetPrisma.mediaAsset.findMany({ where: { siteId: SITE_ID, storageKey: { startsWith: PUBLIC_ROOT } }, orderBy: { storageKey: "asc" } })
  ]);
  assert(site?.slug === "aidreamshoots", `Unexpected production target site: ${site?.slug ?? "missing"}`);
  const primaryDomain = site.domains.find((domain) => domain.isPrimary)?.domain ?? site.domains[0]?.domain;
  assert(primaryDomain === PRODUCTION_DOMAIN, `Unexpected production domain: ${primaryDomain ?? "missing"}`);
  assert(settings, "Missing production ThemeSettings");
  return { site, livePages, themePages, settings, mediaAssets };
}

function targetPageData(sourcePage, existing) {
  return {
    id: existing?.id ?? `page_${SITE_ID}_${sourcePage.path.slice(1).replace(/[^a-z0-9]+/gi, "_")}`,
    siteId: SITE_ID,
    pageType: existing?.pageType ?? sourcePage.pageType,
    templateKey: existing?.templateKey ?? sourcePage.templateKey,
    slug: sourcePage.path,
    publicPath: sourcePage.publicPath ?? sourcePage.path,
    title: sourcePage.title,
    contentJson: sourcePage.contentJson
  };
}

function targetThemePageData(sourcePage, existing, slug = sourcePage.path) {
  if (!sourcePage.themeJson) return null;
  return {
    id: existing?.id ?? `theme_page_${SITE_ID}_${slug.slice(1).replace(/[^a-z0-9]+/gi, "_")}`,
    siteId: SITE_ID,
    pageType: existing?.pageType ?? sourcePage.themeJson.pageType,
    templateKey: existing?.templateKey ?? sourcePage.themeJson.templateKey,
    slug,
    title: sourcePage.themeJson.title || sourcePage.title,
    draftJson: sourcePage.themeJson.draftJson,
    publishedJson: sourcePage.themeJson.publishedJson,
    draftMeta: sourcePage.themeJson.draftMeta
  };
}

function saveTheDateNavigation(settingsJson) {
  return settingsJson?.saveTheDateNavigation ?? null;
}

function patchSaveTheDateNavigation(currentJson, sourceJson) {
  const next = clone(currentJson);
  const navigation = saveTheDateNavigation(sourceJson);
  assert(navigation, "Source Save the Date navigation is missing");
  next.saveTheDateNavigation = clone(navigation);
  return next;
}

async function main() {
  if (apply && !confirmed) throw new Error(`Production apply requires --confirm=${CONFIRMATION}`);

  const localDatabaseUrl = process.env.DATABASE_URL;
  const localEnvironment = process.env.DINGYUE_ENV;
  const localTarget = process.env.DATABASE_TARGET;
  assertDatabaseTarget({ expectedTarget: "local", env: process.env });
  const sourcePrisma = new PrismaClient();
  let source;
  try {
    source = await readSource(sourcePrisma);
  } finally {
    await sourcePrisma.$disconnect();
  }

  process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
  process.env.DINGYUE_ENV = "production";
  process.env.DATABASE_TARGET = "production";
  assertDatabaseTarget({ expectedTarget: "production", env: process.env, requireProductionConfirmation: apply, productionConfirmed: confirmed });
  const targetPrisma = new PrismaClient();
  try {
    const current = await readTarget(targetPrisma);
    const currentByPath = new Map(current.livePages.map((row) => [row.slug, row]));
    const currentThemeByPath = new Map(current.themePages.map((row) => [row.slug, row]));
    const publicPages = source.pages.map((page) => targetPageData(page, currentByPath.get(page.path)));
    const invitationPage = publicPages.find((page) => page.slug === "/ai-save-the-date/wedding-invitation");
    assert(invitationPage, "Missing prepared wedding invitation page");
    const invitationAlias = {
      ...invitationPage,
      id: currentByPath.get(WEDDING_INVITATION_SOURCE_PATH)?.id ?? `page_${SITE_ID}_ai_video_generation_wedding_invitation`,
      pageType: currentByPath.get(WEDDING_INVITATION_SOURCE_PATH)?.pageType ?? invitationPage.pageType,
      templateKey: currentByPath.get(WEDDING_INVITATION_SOURCE_PATH)?.templateKey ?? invitationPage.templateKey,
      slug: WEDDING_INVITATION_SOURCE_PATH,
      publicPath: invitationPage.slug
    };
    const nextPages = [...publicPages, invitationAlias];
    const nextThemePages = source.pages.flatMap((page) => {
      const publicTheme = targetThemePageData(page, currentThemeByPath.get(page.path), page.path);
      if (!publicTheme) return [];
      if (page.path !== "/ai-save-the-date/wedding-invitation") return [publicTheme];
      const aliasTheme = targetThemePageData(page, currentThemeByPath.get(WEDDING_INVITATION_SOURCE_PATH), WEDDING_INVITATION_SOURCE_PATH);
      return aliasTheme ? [publicTheme, aliasTheme] : [publicTheme];
    });
    const nextSettings = {
      id: current.settings.id,
      draftJson: patchSaveTheDateNavigation(current.settings.draftJson, source.settings.draftJson),
      publishedJson: patchSaveTheDateNavigation(current.settings.publishedJson, source.settings.publishedJson)
    };
    const nextMedia = mediaRowsFor(nextPages);
    const currentMediaByKey = new Map(current.mediaAssets.map((row) => [row.storageKey, row]));
    const changedPages = nextPages.filter((next) => {
      const before = currentByPath.get(next.slug);
      return !before || before.title !== next.title || stableJson(before.contentJson) !== stableJson(next.contentJson);
    });
    const changedThemePages = nextThemePages.filter((next) => {
      const before = currentThemeByPath.get(next.slug);
      return !before
        || before.title !== next.title
        || stableJson(before.draftJson) !== stableJson(next.draftJson)
        || stableJson(before.publishedJson) !== stableJson(next.publishedJson)
        || stableJson(before.draftMeta) !== stableJson(next.draftMeta);
    });
    const settingsChanged = stableJson(current.settings.draftJson) !== stableJson(nextSettings.draftJson)
      || stableJson(current.settings.publishedJson) !== stableJson(nextSettings.publishedJson);
    const report = {
      ok: true,
      mode: apply ? "apply-production" : "dry-run",
      siteId: SITE_ID,
      domain: PRODUCTION_DOMAIN,
      routes: publicPages.map((page) => ({ path: page.slug, beforeExists: currentByPath.has(page.slug), ...validatePageJson(page.contentJson, page.slug) })),
      internalAliases: [{ path: invitationAlias.slug, rendersAs: invitationAlias.publicPath, beforeExists: currentByPath.has(invitationAlias.slug) }],
      changedPages: changedPages.map((page) => page.slug),
      changedThemePages: changedThemePages.map((page) => page.slug),
      settingsChanged,
      mediaAssets: { referenced: nextMedia.length, existing: nextMedia.filter((item) => currentMediaByKey.has(item.storageKey)).length, toUpsert: nextMedia.length },
      before: { livePageCount: current.livePages.length, mediaAssetCount: current.mediaAssets.length, duplicateManifestRoutes: current.livePages.filter((page) => {
        const manifest = Array.isArray(page.contentJson?.mediaManifest) ? page.contentJson.mediaManifest.map((item) => item?.src).filter(Boolean) : [];
        return new Set(manifest).size < manifest.length;
      }).map((page) => page.slug) },
      source: { localSite: source.site.slug, sourceHash: sha(source.pages.map((page) => ({ slug: page.path, title: page.title, contentJson: page.contentJson }))) },
      productionConfirmation: apply ? CONFIRMATION : null
    };

    if (apply) {
      const backupPath = path.join(BACKUP_DIRECTORY, `aidreamshoots-save-the-date-content-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, {
        createdAt: new Date().toISOString(),
        siteId: SITE_ID,
        domain: PRODUCTION_DOMAIN,
        confirmation: CONFIRMATION,
        livePages: current.livePages.map((row) => ({ id: row.id, siteId: row.siteId, pageType: row.pageType, templateKey: row.templateKey, slug: row.slug, title: row.title, contentJson: row.contentJson, createdAt: row.createdAt, updatedAt: row.updatedAt })),
        themePages: current.themePages,
        themeSettings: current.settings,
        mediaAssets: current.mediaAssets
      });
      await targetPrisma.$transaction(async (tx) => {
        for (const page of nextPages) {
          const existing = currentByPath.get(page.slug);
          if (existing) {
            await tx.livePage.update({ where: { id: existing.id }, data: { title: page.title, contentJson: page.contentJson, updatedAt: new Date() } });
          } else {
            await tx.livePage.create({ data: { id: page.id, siteId: page.siteId, pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, contentJson: page.contentJson, createdAt: new Date(), updatedAt: new Date() } });
          }
        }
        for (const page of nextThemePages) {
          const existing = currentThemeByPath.get(page.slug);
          if (existing) {
            await tx.themePage.update({ where: { id: existing.id }, data: { title: page.title, draftJson: page.draftJson, publishedJson: page.publishedJson, draftMeta: page.draftMeta, updatedAt: new Date() } });
          } else {
            await tx.themePage.create({ data: { id: page.id, siteId: page.siteId, pageType: page.pageType, templateKey: page.templateKey, slug: page.slug, title: page.title, draftJson: page.draftJson, publishedJson: page.publishedJson, draftMeta: page.draftMeta, createdAt: new Date(), updatedAt: new Date() } });
          }
        }
        await tx.themeSettings.update({ where: { id: current.settings.id }, data: { draftJson: nextSettings.draftJson, publishedJson: nextSettings.publishedJson, updatedAt: new Date() } });
        for (const media of nextMedia) {
          const id = `media_${SITE_ID}_${sha(media.storageKey).slice(0, 24)}`;
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId: SITE_ID, storageKey: media.storageKey } },
            create: { id, siteId: SITE_ID, ...media },
            update: { label: media.label, mimeType: media.mimeType, usageType: media.usageType, sourceType: media.sourceType, previewUrl: media.previewUrl, originUrl: media.originUrl, altText: media.altText, notes: media.notes, updatedAt: new Date() }
          });
        }
      }, { maxWait: 20_000, timeout: 120_000 });
      const after = await readTarget(targetPrisma);
      const afterByPath = new Map(after.livePages.map((row) => [row.slug, row]));
      const afterThemeByPath = new Map(after.themePages.map((row) => [row.slug, row]));
      for (const page of nextPages) {
        const saved = afterByPath.get(page.slug);
        assert(saved, `${page.slug}: missing LivePage after write`);
        assert.equal(saved.title, page.title, `${page.slug}: title readback mismatch`);
        assert.equal(stableJson(saved.contentJson), stableJson(page.contentJson), `${page.slug}: content readback mismatch`);
        validatePageJson(saved.contentJson, page.publicPath ?? page.slug);
      }
      for (const page of nextThemePages) {
        const saved = afterThemeByPath.get(page.slug);
        assert(saved, `${page.slug}: missing ThemePage after write`);
        assert.equal(stableJson(saved.draftJson), stableJson(page.draftJson), `${page.slug}: draft ThemePage readback mismatch`);
        assert.equal(stableJson(saved.publishedJson), stableJson(page.publishedJson), `${page.slug}: published ThemePage readback mismatch`);
      }
      assert.equal(stableJson(saveTheDateNavigation(after.settings.draftJson)), stableJson(saveTheDateNavigation(nextSettings.draftJson)), "draft Save the Date navigation readback mismatch");
      assert.equal(stableJson(saveTheDateNavigation(after.settings.publishedJson)), stableJson(saveTheDateNavigation(nextSettings.publishedJson)), "published Save the Date navigation readback mismatch");
      const afterMediaKeys = new Set(after.mediaAssets.map((row) => row.storageKey));
      for (const media of nextMedia) assert(afterMediaKeys.has(media.storageKey), `Missing MediaAsset readback: ${media.storageKey}`);
      report.backupPath = backupPath;
      report.readback = { livePageCount: after.livePages.length, themePageCount: after.themePages.length, mediaAssetCount: after.mediaAssets.length, settingsVerified: true, allRoutesVerified: true, allThemePagesVerified: true, allMediaVerified: true };
    }

    const reportPath = path.join(BACKUP_DIRECTORY, `aidreamshoots-save-the-date-content-report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(reportPath, report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally {
    await targetPrisma.$disconnect();
    process.env.DATABASE_URL = localDatabaseUrl;
    process.env.DINGYUE_ENV = localEnvironment;
    process.env.DATABASE_TARGET = localTarget;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
