#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertDatabaseTarget,
  buildTunneledDatabaseUrl,
  hasArgument,
  parseDatabaseUrl
} from "./lib/database-target.mjs";
import {
  copyReplacements,
  profiles,
  repairStandardPage,
  repairWeddingInvitationPage
} from "./repair-aidreamshoots-save-the-date-spanish-seo.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const PRODUCTION_DOMAIN = "aidreamshoots.eu";
const PRODUCTION_ORIGIN = `https://${PRODUCTION_DOMAIN}`;
const PRODUCTION_CONFIRMATION = "aidreamshoots-livepage-seo-production";
const WEDDING_INVITATION_SOURCE = "/ai-video-generation/wedding-invitation";
const WEDDING_INVITATION_PUBLIC = "/ai-save-the-date/wedding-invitation";
const BACKUP_DIRECTORY = path.resolve("releases/backups/production");

const SAVE_THE_DATE_ALIASES = new Map([
  ["christmas", "christmas"],
  ["engagement", "engagement"],
  ["fathers-day", "fathers-day"],
  ["halloween", "halloween"],
  ["mothers-day", "mothers-day"],
  ["new-year", "new-year"],
  ["proposal", "proposal"],
  ["save-the-date", "save-the-date"],
  ["thanksgiving", "thanksgiving"],
  ["valentines-day", "valentines-day"],
  ["wedding-ceremony", "wedding-ceremony"],
  ["wedding-invitation", "wedding-invitation"]
]);

const NON_INDEXABLE_ORPHANS = new Set([
  "/ai-save-the-date/easter",
  "/ai-save-the-date/wedding-anniversary",
  "/best-ai-video"
]);

const POLICY_CANONICALS = new Map([
  ["/about", "/about-us"],
  ["/contact", "/contact-us"],
  ["/help", "/faq"],
  ["/how-it-works", "/workflow"],
  ["/examples", "/ai-image-generation"],
  ["/packages", "/ai-image-generation"],
  ["/privacy-policy", "/privacy"],
  ["/policies/privacy", "/privacy"],
  ["/policies/privacy-policy", "/privacy"],
  ["/terms-of-service", "/terms"],
  ["/policies/terms", "/terms"],
  ["/policies/terms-of-service", "/terms"],
  ["/cookie-policy", "/cookies"],
  ["/policies/cookies", "/cookies"],
  ["/refund-policy", "/refunds"],
  ["/policies/refund", "/refunds"],
  ["/policies/refunds", "/refunds"],
  ["/content-policy", "/content"],
  ["/policies/content", "/content"],
  ["/children-privacy-policy", "/children-privacy"],
  ["/childrens-privacy", "/children-privacy"],
  ["/policies/children-privacy", "/children-privacy"],
  ["/state-privacy-rights", "/state-privacy"],
  ["/california-privacy", "/state-privacy"],
  ["/ccpa", "/state-privacy"]
]);

const POLICY_H1S = new Map([
  ["/cookies", "Política de cookies"],
  ["/digital-delivery", "Entrega digital"],
  ["/children-privacy", "Privacidad infantil"],
  ["/state-privacy", "Aviso de privacidad estatal"],
  ["/privacy", "Política de privacidad"],
  ["/terms", "Términos de servicio"],
  ["/refunds", "Política de reembolsos"],
  ["/content", "Política de contenido"]
]);

const BLOG_COPY = {
  title: "Guía para preparar fotos y vídeos con IA",
  eyebrow: "Guía práctica",
  summary: "Aprende a preparar fotos fuente autorizadas, elegir un paquete, revisar los créditos y comprobar tus resultados privados.",
  body: "AIdreamshoots permite crear fotos y vídeos privados con IA desde tus imágenes, revisar los créditos antes de generar y descargar los resultados desde una galería privada.",
  tags: "fotos con IA|vídeos con IA|créditos|galería privada|AIdreamshoots",
  author: "Contenido de AIdreamshoots",
  entityName: "Guía de fotos y vídeos con IA",
  primaryCta: "Explorar paquetes de fotos con IA",
  targetHref: "/ai-image-generation",
  targetLabel: "Explorar paquetes de fotos con IA",
  userIntent: "Preparar fotos fuente autorizadas y elegir un paquete de fotos o vídeos con IA.",
  evidenceType: "Contenido editorial de AIdreamshoots",
  reviewOwner: "Contenido de AIdreamshoots",
  reviewChecklist: [
    "Comprueba la estabilidad de los rostros y las manos.",
    "Revisa el cabello, el fondo y los recortes.",
    "Usa fotos propias o autorizadas y conserva los resultados en tu espacio privado.",
    "Verifica el resultado antes de descargarlo o compartirlo."
  ],
  rightsWarnings: ["Usa solo imágenes propias o autorizadas y evita marcas protegidas o semejanzas no aprobadas."],
  inputRequirements: ["Una foto fuente nítida", "Una dirección visual clara", "Permiso para usar las imágenes"],
  verifiedLimitations: ["La estabilidad de la identidad, las manos y los recortes debe revisarse en cada resultado."],
  relatedGuides: ["retratos profesionales", "vídeos con IA", "galería privada"],
  relatedLinks: [
    { href: "/ai-video-generation/motion-generator", label: "Explorar generación de movimiento" },
    { href: "/ai-image-generation/avatar", label: "Explorar avatares con IA" }
  ],
  imageAlt: "Guía de AIdreamshoots para preparar fotos fuente, elegir estilos y revisar resultados privados creados con IA."
};

function deepClone(value) {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(typeof value === "string" ? value : stableStringify(value)).digest("hex");
}

function normalizePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  const withoutQuery = withSlash.split(/[?#]/)[0] || "/";
  const normalized = withoutQuery.replace(/\/+/g, "/").replace(/\/$/, "");
  return normalized || "/";
}

function isHrefKey(key) {
  return /(?:href|targethref|ctahref|primaryhref|secondaryhref|actionhref|returnhref|videoallhref|imageallhref)$/i.test(key);
}

function isMediaReferenceKey(key) {
  return /^(?:src|url|imageurl|image|poster|posterurl|thumbnail|thumbnailurl|avatar|avatarurl|logo|logourl|cover|coverurl|filename|filepath|path|storagekey|originurl|previewurl|downloadurl|contenturl|ogimage)$/i.test(key);
}

function isLikelyMediaReference(value) {
  return /(?:^https?:\/\/|^\/assets\/|\.(?:avif|jpe?g|png|webp|svg|gif|mp4|webm)(?:[?#]|$))/i.test(String(value ?? ""));
}

function isLikelyImageReference(value) {
  const normalized = String(value ?? "");
  if (/\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(normalized)) return false;
  return /(?:^https?:\/\/|^\/assets\/|\.(?:avif|jpe?g|png|webp|svg|gif)(?:[?#]|$))/i.test(normalized);
}

function mapText(value) {
  if (Object.hasOwn(copyReplacements, value)) return copyReplacements[value];
  return value
    .replaceAll("unño", "año")
    .replaceAll("díun", "día")
    .replaceAll("galeríun", "galería")
    .replaceAll("unñade", "añade")
    .replaceAll("con IA con IA", "con IA")
    .replaceAll("Guia", "Guía");
}

function mapAlt(value) {
  const normalized = mapText(value).trim();
  if (/^(?:Ejemplo visual|Contenido de AIdreamshoots|Imagen generada|Foto generada|Vídeo generado)\b/i.test(normalized)) {
    return "Vista previa de una creación fotográfica con IA para explorar los estilos de AIdreamshoots.";
  }
  return normalized;
}

function sanitizeText(value, key = "") {
  if (typeof value === "string") {
    if (isHrefKey(key) || (isMediaReferenceKey(key) && isLikelyMediaReference(value))) return value;
    if (/^(?:alt|imageAlt|ogImageAlt)$/i.test(key)) return mapAlt(value);
    return mapText(value);
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeText(item, key));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, sanitizeText(child, childKey)]));
}

function collectMissingImageAlts(value, slug, pathName = "", output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectMissingImageAlts(item, slug, `${pathName}.${index}`, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const hasDirectImage = Object.entries(value).some(([key, child]) =>
    typeof child === "string" && isLikelyImageReference(child) && /^(?:src|image|imageSrc|imagePath|poster|thumbnail|avatar|cover|hero)$/i.test(key)
  ) || (typeof value.imageUrl === "string" && isLikelyImageReference(value.imageUrl) && ("alt" in value || "imageAlt" in value));
  if (hasDirectImage) {
    const alt = typeof value.alt === "string" ? value.alt.trim() : typeof value.imageAlt === "string" ? value.imageAlt.trim() : "";
    if (!alt) output.push({ slug, path: pathName, reason: "missing-alt" });
    else if (alt.length < 18) output.push({ slug, path: pathName, reason: "short-alt", value: alt });
  }
  for (const [key, child] of Object.entries(value)) collectMissingImageAlts(child, slug, `${pathName}.${key}`, output);
  return output;
}

function ensureImageAlts(value, context = "AIdreamshoots") {
  if (Array.isArray(value)) return value.map((item) => ensureImageAlts(item, context));
  if (!value || typeof value !== "object") return value;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, ensureImageAlts(child, context)]));
  const imageSource = typeof next.src === "string" && isLikelyImageReference(next.src)
    ? next.src
    : typeof next.poster === "string" && isLikelyImageReference(next.poster)
      ? next.poster
      : "";
  if (imageSource && !String(next.alt ?? next.imageAlt ?? "").trim()) {
    const isVideoPoster = typeof next.src === "string" && /\.(?:mp4|webm|mov)(?:[?#]|$)/i.test(next.src);
    next.alt = isVideoPoster
      ? "Fotograma de vídeo con IA para una escena de AIdreamshoots, listo para revisar antes de generar."
      : `Vista previa de una escena visual de ${context} creada con IA.`;
  }
  return next;
}

function canonicalPathForHref(pathname, search = "") {
  let normalized = normalizePath(pathname);
  const sitePrefixes = ["/site/aidreamshoots", "/site/aidreamshoots-eu", "/site/mydreamshoots-xby"];
  for (const prefix of sitePrefixes) {
    if (normalized === prefix) normalized = "/";
    else if (normalized.startsWith(`${prefix}/`)) normalized = normalizePath(normalized.slice(prefix.length));
  }
  if (normalized === "/collections" || normalized.startsWith("/collections/")) {
    const suffix = normalized.slice("/collections".length);
    const category = search ? new URLSearchParams(search).get("category") : "";
    normalized = category ? `/ai-image-generation/${encodeURIComponent(category)}` : `/ai-image-generation${suffix}`;
  }
  if (normalized === "/ai-video-generation/image-to-video" || normalized === "/ai-video-generation/text-to-video") {
    normalized = "/ai-video-generation/motion-generator";
  }
  const saveDateMatch = normalized.match(/^\/ai-video-generation\/([^/]+)$/i);
  if (saveDateMatch && SAVE_THE_DATE_ALIASES.has(saveDateMatch[1].toLowerCase())) {
    normalized = `/ai-save-the-date/${SAVE_THE_DATE_ALIASES.get(saveDateMatch[1].toLowerCase())}`;
  }
  if (normalized === "/holidays-events/wedding-invitation") normalized = WEDDING_INVITATION_PUBLIC;
  if (normalized === WEDDING_INVITATION_SOURCE) normalized = WEDDING_INVITATION_PUBLIC;
  normalized = POLICY_CANONICALS.get(normalized) ?? normalized;
  return normalized;
}

function normalizeHref(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return raw;
  if (/^(?:#|javascript:|mailto:|sms:|tel:)/i.test(raw)) return raw;
  if (/^(?:Contenido de AIdreamshoots|Crear vídeo|Usa fotos propias o autorizadas|Crear video)/i.test(raw)) return "/app/create";

  let parsed;
  try {
    parsed = /^https?:\/\//i.test(raw) ? new URL(raw) : new URL(raw, PRODUCTION_ORIGIN);
  } catch {
    return raw.includes(" ") ? "/app/create" : raw;
  }
  const isInternal = parsed.hostname.toLowerCase() === PRODUCTION_DOMAIN || parsed.hostname.toLowerCase() === `www.${PRODUCTION_DOMAIN}`;
  if (!isInternal && /^https?:\/\//i.test(raw)) return raw;
  const pathname = canonicalPathForHref(parsed.pathname, parsed.search);
  return `${pathname}${parsed.search && !parsed.searchParams.has("category") ? parsed.search : ""}${parsed.hash}`;
}

function normalizeHrefs(value) {
  if (Array.isArray(value)) return value.map(normalizeHrefs);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [
    key,
    typeof child === "string" && isHrefKey(key) ? normalizeHref(child) : normalizeHrefs(child)
  ]));
}

function canonicalPathForPage(slug, seo = {}) {
  const normalizedSlug = normalizePath(slug);
  if (normalizedSlug === "/collections" || normalizedSlug.startsWith("/collections/")) {
    return canonicalPathForHref(normalizedSlug);
  }
  const sourceValue = typeof seo.canonicalPath === "string" && seo.canonicalPath.trim()
    ? seo.canonicalPath
    : typeof seo.canonical === "string" && seo.canonical.trim()
      ? seo.canonical
      : normalizedSlug;
  let pathname = sourceValue;
  if (/^https?:\/\//i.test(sourceValue)) {
    try { pathname = new URL(sourceValue).pathname; } catch { pathname = normalizedSlug; }
  }
  return canonicalPathForHref(pathname);
}

function isAliasPage(slug) {
  const normalized = normalizePath(slug);
  return normalized === "/collections"
    || normalized === "/holidays-events/wedding-invitation"
    || normalized === WEDDING_INVITATION_SOURCE
    || (normalized.startsWith("/ai-video-generation/") && SAVE_THE_DATE_ALIASES.has(normalized.slice("/ai-video-generation/".length)));
}

function applySeo(json, slug) {
  const next = deepClone(json) ?? {};
  const currentSeo = next.seo && typeof next.seo === "object" ? next.seo : {};
  const canonicalPath = canonicalPathForPage(slug, currentSeo);
  const alias = isAliasPage(slug) || NON_INDEXABLE_ORPHANS.has(normalizePath(slug));
  const index = alias ? false : currentSeo.index !== false;
  next.seo = {
    ...currentSeo,
    index,
    follow: true,
    robots: { ...(currentSeo.robots ?? {}), index, follow: true },
    canonicalPath,
    canonical: `${PRODUCTION_ORIGIN}${canonicalPath}`
  };
  if (normalizePath(slug) === "/blog/video-photo-package-guide") {
    next.seo.title = `${BLOG_COPY.title} | AIdreamshoots`;
    next.seo.description = "Aprende a preparar fotos fuente autorizadas, elegir estilos, revisar créditos y conservar resultados privados en AIdreamshoots.";
    next.seo.keywords = "fotos con IA,vídeos con IA,créditos,galería privada,AIdreamshoots";
  }
  if (/^Vídeos con IA con IA\b/i.test(String(next.seo.title ?? ""))) next.seo.title = String(next.seo.title).replace(/^Vídeos con IA con IA/i, "Vídeos con IA");
  return next;
}

function applyPolicyHeadings(json, slug) {
  const heading = POLICY_H1S.get(normalizePath(slug));
  if (!heading) return json;
  const next = deepClone(json);
  if (typeof next.title === "string") next.title = heading;
  for (const [key, section] of Object.entries(next.sections ?? {})) {
    if (!section || typeof section !== "object" || !section.settings || typeof section.settings !== "object") continue;
    if (/^(?:footer|header|intro|policy)_/i.test(key)) section.settings.title = heading;
  }
  return next;
}

function applyBlogCopy(json) {
  const next = deepClone(json);
  const settings = next.sections?.blog_detail_1?.settings;
  if (!settings || typeof settings !== "object") return next;
  Object.assign(settings, BLOG_COPY);
  settings.authorUrl = "/about-us";
  settings.publishedAt = settings.publishedAt || "2026-07-28";
  settings.updatedAt = "2026-09-16";
  settings.reviewedAt = "2026-09-16";
  settings.evidenceDate = "2026-09-16";
  settings.headingLevel = "h1";
  return next;
}

function prepareContent(row) {
  const canonicalPath = canonicalPathForPage(row.slug, row.contentJson?.seo ?? {});
  let content;
  if (profiles[canonicalPath]) {
    content = repairStandardPage(row.contentJson, profiles[canonicalPath], canonicalPath);
  } else if (row.slug === WEDDING_INVITATION_SOURCE) {
    content = repairWeddingInvitationPage(row.contentJson);
  } else {
    content = deepClone(row.contentJson);
  }
  content = sanitizeText(content);
  content = normalizeHrefs(content);
  content = ensureImageAlts(content);
  content = applyPolicyHeadings(content, row.slug);
  if (normalizePath(row.slug) === "/blog/video-photo-package-guide") content = applyBlogCopy(content);
  content = applySeo(content, row.slug);
  return content;
}

function mediaReferences(value, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => mediaReferences(item, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && isMediaReferenceKey(key) && isLikelyMediaReference(child)) output.push(`${key}:${child}`);
    mediaReferences(child, output);
  }
  return output.sort();
}

function mediaDigest(rows) {
  return sha256(rows.map((row) => ({ slug: row.slug, refs: mediaReferences(row.contentJson) })).sort((a, b) => a.slug.localeCompare(b.slug)));
}

function collectInvalidHrefs(value, slug, pathName = "", output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectInvalidHrefs(item, slug, `${pathName}.${index}`, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${pathName}.${key}`;
    if (typeof child === "string" && isHrefKey(key)) {
      const normalized = child.trim();
      if (normalized && !/^(?:#|javascript:|mailto:|sms:|tel:|https?:\/\/|\/)/i.test(normalized)) output.push({ slug, path: childPath, value: normalized });
      if (/^\/site\/aidreamshoots|^\/collections(?:\/|$)|^\/holidays-events\/wedding-invitation$|^\/ai-video-generation\/(?:image-to-video|text-to-video|wedding-invitation|christmas|engagement|fathers-day|halloween|mothers-day|new-year|proposal|save-the-date|thanksgiving|valentines-day|wedding-ceremony)$/i.test(normalized)) {
        output.push({ slug, path: childPath, value: normalized, reason: "legacy-or-alias-href" });
      }
    }
    collectInvalidHrefs(child, slug, childPath, output);
  }
  return output;
}

function normalizeRows(rows) {
  const nextRows = rows.map((row) => {
    const contentJson = prepareContent(row);
    return {
      ...row,
      title: row.slug === "/blog/video-photo-package-guide"
        ? `${BLOG_COPY.title} | AIdreamshoots`
        : String(contentJson.seo?.title ?? row.title),
      contentJson
    };
  });
  const invitationSource = nextRows.find((row) => row.slug === WEDDING_INVITATION_SOURCE);
  assert(invitationSource, `Missing source LivePage ${WEDDING_INVITATION_SOURCE}.`);
  const publicInvitation = nextRows.find((row) => row.slug === WEDDING_INVITATION_PUBLIC);
  if (!publicInvitation) {
    const contentJson = deepClone(invitationSource.contentJson);
    contentJson.seo = {
      ...contentJson.seo,
      index: true,
      follow: true,
      robots: { ...(contentJson.seo?.robots ?? {}), index: true, follow: true },
      canonicalPath: WEDDING_INVITATION_PUBLIC,
      canonical: `${PRODUCTION_ORIGIN}${WEDDING_INVITATION_PUBLIC}`
    };
    nextRows.push({
      id: `page_${SITE_ID}_ai_save_the_date_wedding_invitation`,
      siteId: SITE_ID,
      pageType: "standard-content",
      templateKey: "save-the-date",
      slug: WEDDING_INVITATION_PUBLIC,
      title: "Invitación de boda: fotos y vídeos con IA | AIdreamshoots",
      contentJson,
      __new: true
    });
  }
  return nextRows.sort((a, b) => a.slug.localeCompare(b.slug));
}

function assertPreparedRows(beforeRows, afterRows) {
  const afterBySlug = new Map(afterRows.map((row) => [row.slug, row]));
  assert(afterBySlug.has(WEDDING_INVITATION_PUBLIC), "The public wedding invitation LivePage was not prepared.");
  for (const row of afterRows) {
    assert(row.contentJson?.seo?.canonicalPath, `Missing canonicalPath for ${row.slug}.`);
    assert(/^https:\/\/aidreamshoots\.eu\//.test(row.contentJson.seo.canonical), `Non-production canonical for ${row.slug}.`);
    assert.equal(collectInvalidHrefs(row.contentJson, row.slug).length, 0, `Invalid internal href remains on ${row.slug}.`);
    const imageAltIssues = collectMissingImageAlts(row.contentJson, row.slug);
    assert.equal(imageAltIssues.length, 0, `Image alt issues remain on ${row.slug}: ${JSON.stringify(imageAltIssues.slice(0, 3))}; sample=${JSON.stringify(row.contentJson?.sections?.ai_video_topic_landing_1?.settings?.content?.hero?.video ?? null)}`);
  }
  const beforeMedia = mediaDigest(beforeRows);
  const afterExistingMedia = mediaDigest(afterRows.filter((row) => !row.__new));
  assert.equal(afterExistingMedia, beforeMedia, "Existing LivePage media references changed; production script refuses to overwrite image assets.");
  return {
    changed: afterRows.filter((row) => {
      const before = beforeRows.find((candidate) => candidate.slug === row.slug);
      return row.__new || !before || stableStringify(before.contentJson) !== stableStringify(row.contentJson) || before.title !== row.title;
    }),
    invalidHrefs: []
  };
}

async function crossSiteSentinel(prisma) {
  // Hash in PostgreSQL instead of transferring every non-target JSON document
  // over the SSH tunnel. The query text and table names are constants; the
  // only parameter is the protected target site ID.
  const definitions = [
    ["sites", "Site", "id", ["id", "name", "slug", "status", "primaryDomain", "branding", "createdAt", "updatedAt"]],
    ["domains", "SiteDomain", "siteId", ["id", "siteId", "domain", "isPrimary", "status", "allowedAiProviderIds", "createdAt", "updatedAt"]],
    ["livePages", "LivePage", "siteId", ["id", "siteId", "pageType", "templateKey", "slug", "title", "contentJson", "createdAt", "updatedAt"]],
    ["themePages", "ThemePage", "siteId", ["id", "siteId", "pageType", "templateKey", "slug", "title", "draftJson", "publishedJson", "draftMeta", "createdAt", "updatedAt"]],
    ["categories", "CreativePackCategory", "siteId", ["id", "siteId", "parentId", "slug", "label", "description", "heroTitle", "heroSubtitle", "icon", "imageUrl", "sortOrder", "status", "createdAt", "updatedAt"]],
    ["packs", "CreativePack", "siteId", ["id", "siteId", "categoryId", "name", "headline", "description", "prompt", "category", "aiAppSlug", "status", "creditCost", "outputCount", "trainingRequired", "generationCount", "conversionRate", "imageUrl", "galleryImages", "galleryImageAlts", "createdAt", "updatedAt"]],
    ["mediaAssets", "MediaAsset", "siteId", ["id", "siteId", "label", "storageKey", "mimeType", "usageType", "sourceType", "previewUrl", "originUrl", "altText", "notes", "createdAt", "updatedAt"]]
  ];
  const sentinels = {};
  for (const [name, tableName, _siteColumn, columns] of definitions) {
    const expressions = columns.map((column) => `COALESCE("${column}"::text, '')`).join(", '¦', ");
    const where = tableName === "Site" ? `"id" <> $1` : `"siteId" <> $1`;
    const group = tableName === "Site" ? `"id"` : `"siteId"`;
    const order = columns[0] === "id" ? `"id"` : `"id"`;
    const query = `SELECT ${tableName === "Site" ? '"id" AS "siteId"' : '"siteId"'}, COUNT(*)::int AS "count", md5(COALESCE(string_agg(md5(concat_ws('¦', ${expressions})), ',' ORDER BY ${order}), '')) AS "hash" FROM "${tableName}" WHERE ${where} GROUP BY ${group} ORDER BY ${group}`;
    const rows = await prisma.$queryRawUnsafe(query, SITE_ID);
    sentinels[name] = rows.map((row) => ({ siteId: row.siteId, count: Number(row.count), hash: row.hash }));
  }
  return sentinels;
}

function targetBackupPayload(site, livePages, themePages) {
  return {
    createdAt: new Date().toISOString(),
    site: { id: site.id, slug: site.slug, primaryDomain: site.primaryDomain, status: site.status },
    target: { siteId: SITE_ID, domain: PRODUCTION_DOMAIN },
    livePages,
    themePageReferenceAudit: {
      count: themePages.length,
      slugs: themePages.map((page) => page.slug).sort(),
      publishedJsonHash: sha256(themePages.map((page) => ({ slug: page.slug, publishedJson: page.publishedJson })).sort((a, b) => a.slug.localeCompare(b.slug)))
    },
    mediaReferenceHash: mediaDigest(livePages)
  };
}

function writeBackup(payload) {
  fs.mkdirSync(BACKUP_DIRECTORY, { recursive: true, mode: 0o700 });
  const backupPath = path.join(BACKUP_DIRECTORY, `aidreamshoots-livepage-seo-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(backupPath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  fs.chmodSync(backupPath, 0o600);
  return backupPath;
}

function ensureProductionDatabaseConnection() {
  const current = parseDatabaseUrl(process.env.DATABASE_URL);
  if (current.database === "dingyue_local" || current.port === 15433) {
    if (!process.env.REMOTE_DB_DATABASE_URL) throw new Error("Production operation refuses the local database and requires REMOTE_DB_DATABASE_URL.");
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
  }
  const target = parseDatabaseUrl(process.env.DATABASE_URL);
  if (target.port !== 15432 && target.host !== "127.0.0.1" && target.host !== "localhost") {
    throw new Error(`Production writes must use the protected local SSH tunnel; received ${target.host}:${target.port}/${target.database}.`);
  }
}

async function main() {
  const apply = hasArgument("--apply");
  const confirmation = argumentValue("--confirm");
  ensureProductionDatabaseConnection();
  assertDatabaseTarget({
    expectedTarget: "production",
    requireProductionConfirmation: apply,
    productionConfirmed: confirmation === PRODUCTION_CONFIRMATION
  });
  if (apply && confirmation !== PRODUCTION_CONFIRMATION) throw new Error(`Production writes require --confirm=${PRODUCTION_CONFIRMATION}.`);

  const prisma = new PrismaClient();
  try {
    const site = await prisma.site.findUnique({ where: { id: SITE_ID }, include: { domains: true } });
    assert(site, `Target site ${SITE_ID} does not exist.`);
    assert.equal(site.primaryDomain.toLowerCase(), PRODUCTION_DOMAIN, `Target site domain is not ${PRODUCTION_DOMAIN}.`);
    assert(site.domains.some((domain) => domain.domain.toLowerCase() === PRODUCTION_DOMAIN && domain.status === "active"), `Active ${PRODUCTION_DOMAIN} domain mapping is missing.`);

    const [livePages, themePages, beforeCrossSite] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, publishedJson: true, updatedAt: true }, orderBy: { slug: "asc" } }),
      crossSiteSentinel(prisma)
    ]);
    assert(livePages.some((page) => page.slug === WEDDING_INVITATION_SOURCE), `Target source page ${WEDDING_INVITATION_SOURCE} is missing.`);
    const prepared = normalizeRows(livePages);
    const { changed } = assertPreparedRows(livePages, prepared);
    const changedSlugs = changed.map((row) => row.slug);

    const summary = {
      ok: true,
      mode: apply ? "apply" : "dry-run",
      target: { siteId: SITE_ID, domain: PRODUCTION_DOMAIN },
      beforeLivePages: livePages.length,
      afterLivePages: prepared.length,
      changedLivePages: changed.length,
      changedSlugs,
      publicWeddingInvitation: prepared.some((row) => row.slug === WEDDING_INVITATION_PUBLIC),
      sourceWeddingInvitationAlias: prepared.find((row) => row.slug === WEDDING_INVITATION_SOURCE)?.contentJson?.seo,
      existingMediaReferencesPreserved: true,
      themePageReadOnly: true,
      crossSiteSentinelHash: sha256(beforeCrossSite),
      paidProviderCalls: 0,
      pageSpeed: "skipped"
    };
    if (!apply) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const backupPath = writeBackup(targetBackupPayload(site, livePages, themePages));
    await prisma.$transaction(async (tx) => {
      for (const row of prepared.filter((candidate) => !candidate.__new)) {
        const before = livePages.find((candidate) => candidate.id === row.id);
        if (!before || before.title !== row.title || stableStringify(before.contentJson) !== stableStringify(row.contentJson)) {
          await tx.livePage.update({ where: { id: row.id }, data: { title: row.title, contentJson: row.contentJson } });
        }
      }
      for (const row of prepared.filter((candidate) => candidate.__new)) {
        await tx.livePage.create({
          data: {
            id: row.id,
            siteId: SITE_ID,
            pageType: row.pageType,
            templateKey: row.templateKey,
            slug: row.slug,
            title: row.title,
            contentJson: row.contentJson
          }
        });
      }
    }, { maxWait: 10000, timeout: 120000 });

    const [afterLivePages, afterCrossSite] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
      crossSiteSentinel(prisma)
    ]);
    assert.equal(sha256(afterCrossSite), sha256(beforeCrossSite), "A non-target site's database sentinel changed; production write is not considered safe.");
    assert(afterLivePages.some((row) => row.slug === WEDDING_INVITATION_PUBLIC && row.contentJson?.seo?.index === true), "Public wedding invitation was not indexed after write.");
    assert(afterLivePages.some((row) => row.slug === WEDDING_INVITATION_SOURCE && row.contentJson?.seo?.index === false), "Wedding invitation alias was not noindexed after write.");
    assert.equal(mediaDigest(livePages), mediaDigest(afterLivePages.filter((row) => !row.slug || row.slug !== WEDDING_INVITATION_PUBLIC)), "Existing target media references changed unexpectedly.");
    console.log(JSON.stringify({ ...summary, mode: "applied", backupPath, afterCrossSiteSentinelHash: sha256(afterCrossSite) }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
