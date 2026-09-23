#!/usr/bin/env node

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGET_SITE_ID = "site_mydreamshoots_xby";
const TARGET_URL = "http://127.0.0.1:3002/site/aidreamshoots";
const ALIASES = new Map([
  ["/collections", "/ai-image-generation"],
  ["/tools", "/ai-video-generation"]
]);
const NON_PUBLIC_DISPOSITIONS = new Map([
  ["/ai-video-generation/image-to-video", "source_route_not_found"],
  ["/ai-video-generation/text-to-video", "source_route_not_found"],
  ["/partner-registration", "source_route_not_found"]
]);
const MACHINE_KEYS = new Set([
  "id", "siteId", "slug", "href", "url", "src", "imageUrl", "videoUrl", "posterUrl", "storageKey", "canonicalPath",
  "type", "status", "pageType", "templateKey", "routeKey", "locale", "language", "inLanguage", "index", "follow",
  "sortOrder", "creditCost", "outputCount", "durationSeconds", "maxFrames", "generationCount", "conversionRate", "width", "height"
]);
const VISIBLE_KEYS = /(?:title|name|description|subtitle|body|intro|text|question|answer|label|caption|alt|meta|eyebrow|headline|heading|badge|tag|value|summary|note|tip|problem|solution|script|highlight|support|usage|role|content|cta|placeholder|journey|feature|social|company|market|message|detail|copy)/i;
const SPANISH_SIGNALS = /\b(?:para|con|desde|antes|después|despues|privad[oa]s?|créditos?|creditos?|galería|galeria|álbum|album|fotos?|retratos?|vídeos?|videos?|imagen|imágenes|imagenes|sube|elige|revisa|recibe|descarga|cuenta|saldo|pedido|entrega|ayuda|soporte|precios|herramientas|paquetes|política|politica|términos|terminos|sesión|sesion|correo|contraseña|contrasena|actualizado|contacto|guía|guia|preguntas|generación|generacion|privacidad)\b/i;
const ENGLISH_WORDS = /\b(?:the|and|with|from|your|you|what|when|where|how|choose|upload|review|before|after|private|source|account|customer|workspace|pricing|checkout|download|view|start|privacy|terms|help|create|credits|gallery|photo|photos|portrait|portraits|image|images|works|working|ready|team|page|studio|day|different|tool|tools|story|stories|campaign|audience|delivery|frequently|asked|results|workflow|generated|generation|input|output|publish|sharing|rights|permission|policy|refund|contact|email|company|address|children|state|service|refunds|subscription|monthly|annual|package|packages|professional|headshot|creator|wedding|holiday|christmas|birthday|message|script|example|motion|client|save|date|browse|current|new|year|visuals|explainer|talking|analytics)\b/gi;
const CORRUPT_PATTERNS = [
  /^Contenido de AIdreamshoots$/i,
  /Cuando se descuentan los créditos\?/i,
  /Qué selfies funcionan mejor\?/i,
  /Los créditos se reservan cuando confirmas una generación/i,
  /inputs hijo never used/i,
  /Browse vídeo IA generación/i,
  /starting asset/i,
  /encryption standards across la stack/i,
  /galer[ií]un/i
];

function normalizePath(value) {
  const path = String(value ?? "/").split(/[?#]/)[0] || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function visitStrings(value, path = "$", key = "", output = []) {
  if (typeof value === "string") {
    output.push({ path, key, value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitStrings(item, `${path}[${index}]`, key, output));
    return output;
  }
  if (value && typeof value === "object") {
    for (const [childKey, childValue] of Object.entries(value)) visitStrings(childValue, `${path}.${childKey}`, childKey, output);
  }
  return output;
}

function visibleCopy(item) {
  return !MACHINE_KEYS.has(item.key)
    && !/^filename$/i.test(item.key)
    && !/\.mediaManifest(?:\.|\[)/i.test(item.path)
    && VISIBLE_KEYS.test(item.key)
    && !/^https?:\/\//i.test(item.value)
    && !/^\//.test(item.value);
}

function visibleText(value) {
  return String(value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/(?:https?:\/\/|mailto:)[^\s<>"]+/gi, " ")
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sourceComparable(value) {
  return String(value ?? "")
    .replace(/mydreamshoots/gi, "aidreamshoots")
    .replace(/mydreamshoots\.com/gi, "aidreamshoots.eu")
    .replace(/^faq$/i, "frequently asked questions")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function pathShape(value, path = "$", output = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => pathShape(item, `${path}[${index}]`, output));
    return output;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) pathShape(child, `${path}.${key}`, output);
    return output;
  }
  output.add(path);
  return output;
}

function addIssue(issues, type, detail) {
  issues.push({ type, ...detail });
}

async function fetchWithTimeout(url, timeoutMs = 12000) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal, redirect: "manual" });
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}

async function fetchHtmlWithRetry(url, timeoutMs = 30000) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);
      return { response, html: await response.text() };
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw lastError;
}

async function main() {
  const prisma = new PrismaClient();
  const issues = [];
  try {
    const [source, target, site] = await Promise.all([
      prisma.themePage.findMany({ where: { siteId: SOURCE_SITE_ID }, select: { slug: true, title: true, publishedJson: true }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: TARGET_SITE_ID }, select: { slug: true, title: true, publishedJson: true }, orderBy: { slug: "asc" } }),
      prisma.site.findUnique({ where: { id: TARGET_SITE_ID }, select: { slug: true, primaryDomain: true } })
    ]);
    const [sourceLive, targetLive] = await Promise.all([
      prisma.livePage.findMany({ where: { siteId: SOURCE_SITE_ID }, select: { slug: true, title: true, contentJson: true }, orderBy: { slug: "asc" } }),
      prisma.livePage.findMany({ where: { siteId: TARGET_SITE_ID }, select: { slug: true, title: true, contentJson: true }, orderBy: { slug: "asc" } })
    ]);
    assert.deepEqual(site, { slug: "aidreamshoots", primaryDomain: "aidreamshoots.eu" });

    const sourceBySlug = new Map(source.map((row) => [normalizePath(row.slug), row]));
    const targetBySlug = new Map(target.map((row) => [normalizePath(row.slug), row]));
    const sourceLiveBySlug = new Map(sourceLive.map((row) => [normalizePath(row.slug), row]));
    const targetLiveBySlug = new Map(targetLive.map((row) => [normalizePath(row.slug), row]));
    const matchedTheme = [...sourceBySlug.keys()].filter((slug) => targetBySlug.has(slug));
    const matchedLive = [...sourceLiveBySlug.keys()].filter((slug) => targetLiveBySlug.has(slug));
    const expectedSourceTheme = 95;
    const expectedTargetTheme = 97;
    const expectedSourceLive = 92;
    const expectedTargetLive = 94;
    if (source.length !== expectedSourceTheme || target.length !== expectedTargetTheme) addIssue(issues, "page_count", { entity: "ThemePage", source: source.length, target: target.length, expectedSource: expectedSourceTheme, expectedTarget: expectedTargetTheme });
    if (sourceLive.length !== expectedSourceLive || targetLive.length !== expectedTargetLive) addIssue(issues, "page_count", { entity: "LivePage", source: sourceLive.length, target: targetLive.length, expectedSource: expectedSourceLive, expectedTarget: expectedTargetLive });
    for (const slug of sourceBySlug.keys()) if (!targetBySlug.has(slug)) addIssue(issues, "missing_page", { entity: "ThemePage", slug });
    for (const slug of sourceLiveBySlug.keys()) if (!targetLiveBySlug.has(slug)) addIssue(issues, "missing_page", { entity: "LivePage", slug });

    for (const slug of matchedTheme) {
      const sourcePage = sourceBySlug.get(slug);
      const targetPage = targetBySlug.get(slug);
      const sourcePaths = pathShape(sourcePage.publishedJson);
      const targetPaths = pathShape(targetPage.publishedJson);
      for (const path of sourcePaths) if (!targetPaths.has(path)) addIssue(issues, "missing_field_path", { entity: "ThemePage", slug, path });
      const sourceStrings = visitStrings(sourcePage.publishedJson).filter(visibleCopy);
      const targetStrings = visitStrings(targetPage.publishedJson).filter(visibleCopy);
      const targetByPath = new Map(targetStrings.map((item) => [item.path, item.value]));
      for (const item of sourceStrings) {
        const targetValue = targetByPath.get(item.path);
        if (targetValue === undefined) continue;
        if (CORRUPT_PATTERNS.some((pattern) => pattern.test(targetValue))) addIssue(issues, "corrupt_copy", { entity: "ThemePage", slug, path: item.path, value: targetValue });
        const targetText = visibleText(targetValue);
        const englishHits = [...new Set(targetText.match(ENGLISH_WORDS) ?? [])].filter((word) => !/^(?:AI|UGC|TikTok|Instagram|YouTube|Google|Apple|Mastercard|Visa|PayPal)$/i.test(word));
        if (englishHits.length >= 2 && SPANISH_SIGNALS.test(targetText)) addIssue(issues, "mixed_language", { entity: "ThemePage", slug, path: item.path, value: targetValue, englishHits });
        if (englishHits.length >= 3 && !SPANISH_SIGNALS.test(targetText) && targetText.length > 24) addIssue(issues, "untranslated", { entity: "ThemePage", slug, path: item.path, source: item.value, target: targetValue });
      }
    }
    for (const slug of matchedLive) {
      const sourcePage = sourceLiveBySlug.get(slug);
      const targetPage = targetLiveBySlug.get(slug);
      const sourcePaths = pathShape(sourcePage.contentJson);
      const targetPaths = pathShape(targetPage.contentJson);
      for (const path of sourcePaths) if (!targetPaths.has(path)) addIssue(issues, "missing_field_path", { entity: "LivePage", slug, path });
      const sourceStrings = visitStrings(sourcePage.contentJson).filter(visibleCopy);
      const targetStrings = visitStrings(targetPage.contentJson).filter(visibleCopy);
      const targetByPath = new Map(targetStrings.map((item) => [item.path, item.value]));
      for (const item of sourceStrings) {
        const targetValue = targetByPath.get(item.path);
        if (targetValue === undefined) continue;
        if (CORRUPT_PATTERNS.some((pattern) => pattern.test(targetValue))) addIssue(issues, "corrupt_copy", { entity: "LivePage", slug, path: item.path, value: targetValue });
        const targetText = visibleText(targetValue);
        const englishHits = [...new Set(targetText.match(ENGLISH_WORDS) ?? [])].filter((word) => !/^(?:AI|UGC|TikTok|Instagram|YouTube|Google|Apple|Mastercard|Visa|PayPal)$/i.test(word));
        if (englishHits.length >= 2 && SPANISH_SIGNALS.test(targetText)) addIssue(issues, "mixed_language", { entity: "LivePage", slug, path: item.path, value: targetValue, englishHits });
        if (englishHits.length >= 3 && !SPANISH_SIGNALS.test(targetText) && targetText.length > 24) addIssue(issues, "untranslated", { entity: "LivePage", slug, path: item.path, source: item.value, target: targetValue });
      }
    }

    for (const entity of [
      { name: "ThemePage", source: sourceBySlug, target: targetBySlug, jsonKey: "publishedJson" },
      { name: "LivePage", source: sourceLiveBySlug, target: targetLiveBySlug, jsonKey: "contentJson" }
    ]) {
      const fields = new Map();
      for (const slug of entity.source.keys()) {
        const sourcePage = entity.source.get(slug);
        const targetPage = entity.target.get(slug);
        if (!targetPage) continue;
        const sourceStrings = visitStrings(sourcePage[entity.jsonKey]).filter(visibleCopy);
        const targetStrings = visitStrings(targetPage[entity.jsonKey]).filter(visibleCopy);
        const targetByPath = new Map(targetStrings.map((item) => [item.path, item.value]));
        for (const item of sourceStrings) {
          const targetValue = targetByPath.get(item.path);
          if (!targetValue || targetValue.length < 12) continue;
          if (/^(?:seo\.(?:canonical|canonicalPath|ogImage)|.*\.(?:alt|caption))$/i.test(item.path)) continue;
          const record = fields.get(item.path) ?? { sourceValues: new Set(), targets: new Map() };
          record.sourceValues.add(sourceComparable(item.value));
          const sourceValues = record.targets.get(targetValue) ?? new Set();
          sourceValues.add(sourceComparable(item.value));
          record.targets.set(targetValue, sourceValues);
          fields.set(item.path, record);
        }
      }
      for (const [path, record] of fields) {
        if (record.sourceValues.size < 2) continue;
        for (const [targetValue, sourceValues] of record.targets) {
          if (sourceValues.size > 1) addIssue(issues, "template_reuse", { entity: entity.name, path, targetValue, sourceVariantCount: sourceValues.size });
        }
      }
    }

    const talkingPhoto = targetBySlug.get("/ai-video-generation/talking-photo");
    const sourceTalkingPhoto = sourceBySlug.get("/ai-video-generation/talking-photo");
    const extractTalkingPhotoUseCases = (page) => Object.values(page?.publishedJson?.sections ?? {}).find((section) => section?.type === "talking_photo_landing")?.settings?.content?.useCases?.items ?? [];
    const sourceUseCases = extractTalkingPhotoUseCases(sourceTalkingPhoto);
    const targetUseCases = extractTalkingPhotoUseCases(talkingPhoto);
    if (targetUseCases.length !== sourceUseCases.length) addIssue(issues, "talking_photo_count", { source: sourceUseCases.length, target: targetUseCases.length });
    for (const field of ["title", "body", "script"]) {
      if (new Set(targetUseCases.map((item) => item?.[field])).size !== targetUseCases.length) addIssue(issues, "talking_photo_duplicate", { field });
    }

    const routeSlugs = [...new Set([...targetBySlug.keys(), ...targetLiveBySlug.keys()])].filter((slug) => !ALIASES.has(slug) && !NON_PUBLIC_DISPOSITIONS.has(slug) && slug !== "/404").sort();
    for (const slug of routeSlugs) {
      try {
        const routeTimeout = /^(?:\/app(?:\/|$)|\/account$|\/login$|\/cart$)/i.test(slug) ? 30000 : 12000;
        const response = await fetchWithTimeout(`${TARGET_URL}${slug}`, routeTimeout);
        if (![200, 301, 302, 307, 308].includes(response.status)) addIssue(issues, "route_status", { slug, status: response.status });
      } catch (error) {
        addIssue(issues, "route_error", { slug, error: String(error?.message ?? error) });
      }
    }
    for (const [slug, disposition] of NON_PUBLIC_DISPOSITIONS) {
      try {
        const response = await fetchWithTimeout(`${TARGET_URL}${slug}`);
        if (response.status !== 404) addIssue(issues, "non_public_status", { slug, disposition, status: response.status });
      } catch (error) {
        addIssue(issues, "non_public_error", { slug, disposition, error: String(error?.message ?? error) });
      }
    }
    for (const alias of ALIASES.keys()) {
      try {
        const response = await fetchWithTimeout(`${TARGET_URL}${alias}`);
        if (![200, 301, 302, 307, 308].includes(response.status)) addIssue(issues, "alias_status", { slug: alias, status: response.status });
      } catch (error) {
        addIssue(issues, "alias_error", { slug: alias, error: String(error?.message ?? error) });
      }
    }
    try {
      const notFoundResponse = await fetchWithTimeout(`${TARGET_URL}/404`);
      if (notFoundResponse.status !== 404) addIssue(issues, "not_found_status", { slug: "/404", status: notFoundResponse.status });
    } catch (error) {
      addIssue(issues, "not_found_error", { slug: "/404", error: String(error?.message ?? error) });
    }
    try {
      const { html: homepageHtml } = await fetchHtmlWithRetry(`${TARGET_URL}/`);
      if (!/\<html[^>]*\blang=["']es["']/i.test(homepageHtml)) addIssue(issues, "locale_attribute", { expected: "lang=es" });
      if (!/\<html[^>]*\btranslate=["']yes["']/i.test(homepageHtml) || !/\<body[^>]*\btranslate=["']yes["']/i.test(homepageHtml)) addIssue(issues, "translate_attribute", { expected: "html/body translate=yes" });
      if (/<meta[^>]+name=["']google["'][^>]+content=["'][^"']*notranslate/i.test(homepageHtml) || /class=["'][^"']*notranslate/i.test(homepageHtml)) addIssue(issues, "translate_blocker", {});
    } catch (error) {
      addIssue(issues, "homepage_error", { error: String(error?.message ?? error) });
    }

    const byType = Object.fromEntries([...new Set(issues.map((issue) => issue.type))].map((type) => [type, issues.filter((issue) => issue.type === type).length]));
    const report = {
      ok: issues.length === 0,
      source: { themePages: source.length, livePages: sourceLive.length },
      target: { themePages: target.length, livePages: targetLive.length },
      matched: { themePages: matchedTheme.length, livePages: matchedLive.length },
      aliases: Object.fromEntries(ALIASES),
      issueCounts: byType,
      issues: issues.slice(0, 200)
    };
    console.log(JSON.stringify(report, null, 2));
    if (issues.length) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
