#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const homepageLockPath = path.join(repoRoot, "docs", "content-locks", "mydreamshoots-homepage-approved.json");
const prisma = new PrismaClient();
const rawArgs = process.argv.slice(2);
const flags = new Set();
const args = new Map();

for (let index = 0; index < rawArgs.length; index += 1) {
  const rawArg = rawArgs[index];
  if (!rawArg.startsWith("--")) continue;
  const [key, ...rest] = rawArg.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
  } else {
    const next = rawArgs[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }
}

const siteId = String(args.get("site-id") ?? process.env.MYDREAMSHOOTS_SITE_ID ?? "site_dreamshoot");
const liveOrigin = cleanOrigin(args.get("origin") ?? process.env.MYDREAMSHOOTS_CONTENT_GUARD_ORIGIN ?? "https://www.mydreamshoots.com");
const localOrigin = cleanOrigin(args.get("local-origin") ?? process.env.MYDREAMSHOOTS_CONTENT_GUARD_LOCAL_ORIGIN ?? "");
const guardPaths = parsePaths(args.get("paths") ?? process.env.MYDREAMSHOOTS_CONTENT_GUARD_PATHS, ["/", "/pricing", "/tools", "/collections", "/workflow", "/faq"]);
const skipLive = flags.has("skip-live") || process.env.MYDREAMSHOOTS_CONTENT_GUARD_LIVE === "0";
const includeLocalJson = flags.has("include-local-json") || process.env.MYDREAMSHOOTS_CONTENT_GUARD_LOCAL_JSON === "1";
const skipLocalJson = flags.has("skip-local-json") || !includeLocalJson;
const skipHomepageLock = flags.has("skip-homepage-lock");
const writeHomepageLock = flags.has("write-homepage-lock");
const timeoutMs = positiveInt(args.get("timeout-ms") ?? process.env.MYDREAMSHOOTS_CONTENT_GUARD_TIMEOUT_MS, 45_000);
const minLiveCoverage = boundedNumber(args.get("min-live-coverage") ?? process.env.MYDREAMSHOOTS_CONTENT_GUARD_MIN_LIVE_COVERAGE, 0.62, 0, 1);
const pathMinLiveCoverage = parsePathCoverage(args.get("min-live-coverage-by-path") ?? process.env.MYDREAMSHOOTS_CONTENT_GUARD_MIN_LIVE_COVERAGE_BY_PATH, { "/tools": 0.58 });
const maxLiveRecords = positiveInt(args.get("max-live-records") ?? process.env.MYDREAMSHOOTS_CONTENT_GUARD_MAX_LIVE_RECORDS, 90);
const failures = [];
const warnings = [];

const visibleTextKeys = new Set([
  "answer",
  "badge",
  "body",
  "buttonLabel",
  "campaignLabel",
  "caption",
  "credits",
  "ctaLabel",
  "description",
  "detail",
  "directoryLabel",
  "directorySubtitle",
  "eyebrow",
  "headline",
  "heading",
  "includedOutputs",
  "includedTitle",
  "label",
  "location",
  "marketComparison",
  "meta",
  "name",
  "nextCampaignLabel",
  "overlayChips",
  "overlaySubtitle",
  "overlayTitle",
  "photos",
  "primaryCta",
  "privacy",
  "question",
  "quote",
  "role",
  "safetyCopy",
  "secondaryCta",
  "sidePanelBody",
  "sidePanelEyebrow",
  "sidePanelTitle",
  "subheading",
  "subheadline",
  "subtitle",
  "supportingCopy",
  "text",
  "title"
]);

const highSignalKeys = new Set([
  "answer",
  "body",
  "caption",
  "description",
  "directorySubtitle",
  "eyebrow",
  "headline",
  "heading",
  "marketComparison",
  "primaryCta",
  "question",
  "quote",
  "secondaryCta",
  "sidePanelBody",
  "sidePanelTitle",
  "subheading",
  "subheadline",
  "subtitle",
  "supportingCopy",
  "text",
  "title"
]);

function cleanOrigin(value) {
  const raw = String(value ?? "").trim();
  return raw ? raw.replace(/\/+$/, "") : "";
}

function parsePaths(value, fallback) {
  const raw = String(value ?? "").trim();
  const paths = raw ? raw.split(",") : fallback;
  return Array.from(new Set(paths.map(normalizePath).filter(Boolean)));
}

function normalizePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "/") return "/";
  return `/${raw.replace(/^\/+/, "").replace(/\/+$/, "")}`;
}

function slugCandidates(slug) {
  if (slug === "/faq") return ["/faq", "/help"];
  if (slug === "/help") return ["/help", "/faq"];
  return [slug];
}

function positiveInt(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parsePathCoverage(value, fallback = {}) {
  const thresholds = new Map(Object.entries(fallback).map(([slug, threshold]) => [normalizePath(slug), boundedNumber(threshold, minLiveCoverage, 0, 1)]));
  const raw = String(value ?? "").trim();
  if (!raw) return thresholds;
  for (const entry of raw.split(",")) {
    const [pathPart, thresholdPart] = entry.split(":");
    const slug = normalizePath(pathPart);
    const threshold = boundedNumber(thresholdPart, Number.NaN, 0, 1);
    if (slug && Number.isFinite(threshold)) thresholds.set(slug, threshold);
  }
  return thresholds;
}

function minCoverageForSlug(slug) {
  return pathMinLiveCoverage.get(normalizePath(slug)) ?? minLiveCoverage;
}

function decodeHtmlEntities(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForCompare(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isProbablyVisibleText(value) {
  const text = cleanText(value);
  if (text.length < 3) return false;
  if (/^https?:\/\//i.test(text) || text.startsWith("/assets/") || text.startsWith("/images/") || text.startsWith("/videos/")) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(text) || /linear-gradient\(|url\(/i.test(text)) return false;
  if (/^[\d\s.,:$%/-]+$/.test(text) && text.length < 8) return false;
  return true;
}

function splitVisibleText(value) {
  return cleanText(value)
    .split(/\s*\|\s*|\n+/)
    .map((item) => item.trim())
    .filter(isProbablyVisibleText);
}

function addRecord(records, source, key, value, priority = 2) {
  for (const text of splitVisibleText(value)) {
    const normalized = normalizeForCompare(text);
    if (!normalized) continue;
    records.push({ source, key, text, normalized, priority });
  }
}

function collectVisibleRecordsFromNode(records, source, value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectVisibleRecordsFromNode(records, `${source}[${index}]`, item));
    return;
  }

  const settings = value.settings && typeof value.settings === "object" ? value.settings : value;
  for (const [key, entry] of Object.entries(settings)) {
    if (!visibleTextKeys.has(key) || typeof entry !== "string") continue;
    addRecord(records, source, key, entry, recordPriority(key));
  }

  for (const [key, entry] of Object.entries(value)) {
    if (key === "settings") continue;
    collectVisibleRecordsFromNode(records, `${source}.${key}`, entry);
  }
}

function recordPriority(key) {
  if (key === "title" || key === "headline" || key === "heading" || key === "question") return 0;
  if (key === "description" || key === "subtitle" || key === "subheadline" || key === "text" || key === "answer" || key === "body") return 1;
  if (highSignalKeys.has(key)) return 2;
  return 3;
}

function extractSeoValue(seo, key) {
  if (!seo || typeof seo !== "object") return "";
  if (key === "title") return cleanText(seo.title ?? seo.seoTitle ?? seo.metaTitle ?? "");
  if (key === "description") return cleanText(seo.description ?? seo.seoDescription ?? seo.metaDescription ?? "");
  if (key === "keywords") return cleanText(Array.isArray(seo.keywords) ? seo.keywords.join(", ") : seo.keywords ?? "");
  return "";
}

function collectPageRecords(page, settings, sourcePrefix) {
  const records = [];
  const pageJson = page?.publishedJson ?? page?.draftJson ?? page;
  const seo = pageJson?.seo;
  addRecord(records, `${sourcePrefix}:seo`, "seo.title", extractSeoValue(seo, "title"), 0);
  addRecord(records, `${sourcePrefix}:seo`, "seo.description", extractSeoValue(seo, "description"), 1);

  const settingsSeo = settings?.seo?.pages?.[page?.id] ?? settings?.seo?.pages?.[page?.slug];
  addRecord(records, `${sourcePrefix}:themeSettings.seo`, "seo.title", extractSeoValue(settingsSeo, "title"), 0);
  addRecord(records, `${sourcePrefix}:themeSettings.seo`, "seo.description", extractSeoValue(settingsSeo, "description"), 1);
  collectVisibleRecordsFromNode(records, `${sourcePrefix}:publishedJson`, pageJson);
  return dedupeRecords(records);
}

function collectSettingsRecords(settings, sourcePrefix) {
  const records = [];
  collectVisibleRecordsFromNode(records, sourcePrefix, settings);
  return dedupeRecords(records);
}

function dedupeRecords(records) {
  const deduped = new Map();
  for (const record of records) {
    if (!record.normalized) continue;
    const existing = deduped.get(record.normalized);
    if (!existing || record.priority < existing.priority) deduped.set(record.normalized, record);
  }
  return [...deduped.values()].sort((left, right) =>
    left.priority - right.priority ||
    left.normalized.localeCompare(right.normalized) ||
    left.source.localeCompare(right.source)
  );
}

function fingerprintRecords(records) {
  const payload = dedupeRecords(records).map((record) => record.normalized).sort().join("\n");
  return createHash("sha256").update(payload).digest("hex");
}

function stableJsonValue(value) {
  if (Array.isArray(value)) return value.map(stableJsonValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableJsonValue(value[key])])
  );
}

function stableJsonFingerprint(value) {
  return createHash("sha256")
    .update(JSON.stringify(stableJsonValue(value)))
    .digest("hex");
}

function fingerprintSummary(records) {
  return {
    fingerprint: fingerprintRecords(records),
    recordCount: dedupeRecords(records).length
  };
}

function homepageSectionsOrder(publishedJson) {
  if (Array.isArray(publishedJson?.sectionsOrder)) return publishedJson.sectionsOrder.map(String);
  if (publishedJson?.sections && typeof publishedJson.sections === "object" && !Array.isArray(publishedJson.sections)) {
    return Object.keys(publishedJson.sections);
  }
  return [];
}

function homepageHeroSettings(publishedJson) {
  const hero = publishedJson?.sections?.hero_1;
  if (!hero || typeof hero !== "object" || Array.isArray(hero)) return {};
  const settings = hero.settings && typeof hero.settings === "object" && !Array.isArray(hero.settings) ? hero.settings : hero;
  return Object.fromEntries(
    Object.entries(settings)
      .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null)
      .sort(([left], [right]) => left.localeCompare(right))
  );
}

function lockVisibleRecord(record) {
  return {
    source: String(record.source ?? "").replace(/^db:/, "approved-lock:"),
    key: record.key,
    text: record.text,
    normalized: record.normalized
  };
}

function buildHomepageLock({ dbPage, dbRecords, latestPublication, settings, site }) {
  const visibleRecords = dedupeRecords(dbRecords).map(lockVisibleRecord);
  return {
    lockVersion: 1,
    lockedAt: new Date().toISOString(),
    policy: {
      owner: "myDreamshoots site owner",
      rule: "This homepage copy baseline is locked. Do not modify, switch versions, import old JSON, or roll back production copy unless the site owner explicitly requests a homepage copy change.",
      deployRequirement: "npm run guard:mydreamshoots-content must compare Postgres published content, the latest ThemePublication snapshot, production HTML, and this approved homepage lock before release."
    },
    sourceOfTruth: "Postgres ThemePage.publishedJson for site_dreamshoot / plus ThemeSettings.publishedJson SEO records used by the guard",
    site: {
      id: site.id,
      slug: site.slug,
      primaryDomain: site.primaryDomain
    },
    page: {
      id: dbPage.id,
      slug: dbPage.slug,
      title: dbPage.title,
      pageType: dbPage.pageType
    },
    latestPublication: latestPublication
      ? { id: latestPublication.id, version: latestPublication.version, publishedAt: latestPublication.publishedAt }
      : null,
    seo: {
      title: extractSeoValue(dbPage.publishedJson?.seo ?? settings?.seo, "title"),
      description: extractSeoValue(dbPage.publishedJson?.seo ?? settings?.seo, "description"),
      keywords: extractSeoValue(dbPage.publishedJson?.seo ?? settings?.seo, "keywords")
    },
    hero: homepageHeroSettings(dbPage.publishedJson),
    sectionsOrder: homepageSectionsOrder(dbPage.publishedJson),
    fingerprints: {
      publishedJsonSha256: stableJsonFingerprint(dbPage.publishedJson),
      visibleTextSha256: fingerprintRecords(dbRecords),
      visibleRecordCount: visibleRecords.length
    },
    visibleRecords
  };
}

function findPageBySlug(pages, slug) {
  const candidates = new Set(slugCandidates(slug));
  return (pages ?? []).find((page) => candidates.has(normalizePath(page.slug ?? page.publishedJson?.slug ?? "")));
}

function addFailure(type, message, details = {}) {
  failures.push({ type, message, ...details });
}

function loadLocalState() {
  if (!fs.existsSync(statePath)) return undefined;
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function findLocalSite(state) {
  return (state?.sites ?? []).find((site) =>
    site.id === siteId ||
    site.slug === "mydreamshoots" ||
    site.slug === "dreamshoot" ||
    site.primaryDomain === "www.mydreamshoots.com"
  );
}

function loadHomepageLock() {
  if (!fs.existsSync(homepageLockPath)) {
    addFailure("homepage-lock-missing", "MyDreamShoots approved homepage lock file is missing", {
      homepageLockPath,
      likelyCause: "the approved homepage copy baseline was removed or the repository checkout is incomplete"
    });
    return undefined;
  }

  try {
    return JSON.parse(fs.readFileSync(homepageLockPath, "utf8"));
  } catch (error) {
    addFailure("homepage-lock-invalid-json", "MyDreamShoots approved homepage lock file is not valid JSON", {
      homepageLockPath,
      error: error instanceof Error ? error.message : String(error)
    });
    return undefined;
  }
}

function compareHomepageLock({ dbPage, dbRecords }) {
  if (skipHomepageLock) {
    warnings.push({
      type: "homepage-lock-skipped",
      homepageLockPath,
      message: "The approved homepage lock was skipped. Do not use --skip-homepage-lock in deploy/build prechecks."
    });
    return { status: "skipped", path: homepageLockPath };
  }

  const lock = loadHomepageLock();
  if (!lock) return { status: "missing", path: homepageLockPath };

  const lockedVisibleRecords = Array.isArray(lock.visibleRecords) ? lock.visibleRecords : [];
  const lockedVisibleFingerprint = lock.fingerprints?.visibleTextSha256 ?? fingerprintRecords(lockedVisibleRecords);
  const dbVisibleFingerprint = fingerprintRecords(dbRecords);
  const lockedPublishedFingerprint = lock.fingerprints?.publishedJsonSha256;
  const dbPublishedFingerprint = stableJsonFingerprint(dbPage.publishedJson);
  const summary = {
    status: "checked",
    path: homepageLockPath,
    lockedAt: lock.lockedAt ?? null,
    policy: lock.policy?.rule ?? null,
    page: lock.page ?? null,
    fingerprints: {
      approvedPublishedJson: lockedPublishedFingerprint,
      databasePublishedJson: dbPublishedFingerprint,
      approvedVisibleText: lockedVisibleFingerprint,
      databaseVisibleText: dbVisibleFingerprint
    }
  };

  if (lock.site?.id && lock.site.id !== siteId) {
    addFailure("homepage-lock-site-mismatch", "MyDreamShoots approved homepage lock belongs to a different site", {
      homepageLockPath,
      expectedSiteId: siteId,
      lockSite: lock.site
    });
  }

  if (normalizePath(lock.page?.slug ?? "/") !== "/") {
    addFailure("homepage-lock-page-mismatch", "MyDreamShoots approved homepage lock does not describe the homepage", {
      homepageLockPath,
      lockPage: lock.page
    });
  }

  if (!lockedPublishedFingerprint) {
    addFailure("homepage-lock-published-fingerprint-missing", "MyDreamShoots approved homepage lock is missing the published JSON fingerprint", {
      homepageLockPath
    });
  } else if (lockedPublishedFingerprint !== dbPublishedFingerprint) {
    addFailure("homepage-lock-published-json-mismatch", "MyDreamShoots homepage publishedJson no longer matches the approved locked baseline", {
      homepageLockPath,
      slug: "/",
      approvedPublishedJsonSha256: lockedPublishedFingerprint,
      databasePublishedJsonSha256: dbPublishedFingerprint,
      likelyCause: "homepage content was modified, imported from another source, switched to a different version, or rolled back without updating the approved lock"
    });
  }

  if (!lockedVisibleRecords.length) {
    addFailure("homepage-lock-visible-records-missing", "MyDreamShoots approved homepage lock does not contain visible text records", {
      homepageLockPath
    });
  } else {
    const visibleComparison = compareStructuredFingerprints({
      leftLabel: "approved homepage lock",
      rightLabel: "database ThemePage.publishedJson",
      slug: "/",
      leftRecords: lockedVisibleRecords,
      rightRecords: dbRecords
    });
    summary.visibleComparison = visibleComparison;
  }

  if (lockedVisibleFingerprint !== dbVisibleFingerprint) {
    addFailure("homepage-lock-visible-fingerprint-mismatch", "MyDreamShoots homepage visible copy no longer matches the approved locked baseline", {
      homepageLockPath,
      slug: "/",
      approvedVisibleTextSha256: lockedVisibleFingerprint,
      databaseVisibleTextSha256: dbVisibleFingerprint,
      likelyCause: "customer-facing homepage copy changed without an explicit approved copy update"
    });
  }

  return summary;
}

function compareStructuredFingerprints({ leftLabel, rightLabel, slug, leftRecords, rightRecords }) {
  const left = fingerprintSummary(leftRecords);
  const right = fingerprintSummary(rightRecords);
  if (left.fingerprint === right.fingerprint) return { ok: true, left, right };
  const leftTexts = new Map(leftRecords.map((record) => [record.normalized, record]));
  const rightTexts = new Map(rightRecords.map((record) => [record.normalized, record]));
  const missingFromRight = [...leftTexts.values()]
    .filter((record) => !rightTexts.has(record.normalized))
    .slice(0, 12)
    .map(shortRecord);
  const extraInRight = [...rightTexts.values()]
    .filter((record) => !leftTexts.has(record.normalized))
    .slice(0, 12)
    .map(shortRecord);
  addFailure("structured-fingerprint-mismatch", `${slug} ${leftLabel} and ${rightLabel} visible text fingerprints differ`, {
    slug,
    leftLabel,
    rightLabel,
    left,
    right,
    missingFromRight,
    extraInRight
  });
  return { ok: false, left, right };
}

function shortRecord(record) {
  return {
    key: record.key,
    source: record.source,
    text: record.text.length > 180 ? `${record.text.slice(0, 177)}...` : record.text
  };
}

function selectLiveExpectationRecords(records) {
  return dedupeRecords(records)
    .filter((record) => record.normalized.length >= 10)
    .sort((left, right) =>
      left.priority - right.priority ||
      right.normalized.length - left.normalized.length ||
      left.normalized.localeCompare(right.normalized)
    )
    .slice(0, maxLiveRecords);
}

function tokenSet(value) {
  return new Set(normalizeForCompare(value).split(/\s+/).filter((token) => token.length > 2));
}

function recordAppearsInHtml(record, htmlBundle) {
  if (!record.normalized) return true;
  if (htmlBundle.normalized.includes(record.normalized)) return true;
  const expectedTokens = tokenSet(record.text);
  if (!expectedTokens.size) return true;
  let hitCount = 0;
  for (const token of expectedTokens) {
    if (htmlBundle.tokens.has(token)) hitCount += 1;
  }
  return hitCount / expectedTokens.size >= (expectedTokens.size >= 12 ? 0.78 : 0.9);
}

function extractHtmlBundle(html) {
  const title = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/gi)].map((match) => match[1]).join(" ");
  const meta = [...html.matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:title|og:description|twitter:title|twitter:description)["'][^>]+content=["']([^"']*)["'][^>]*>/gi)]
    .map((match) => match[1])
    .join(" ");
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  const text = cleanText(`${title} ${meta} ${body}`);
  return {
    text,
    normalized: normalizeForCompare(text),
    tokens: tokenSet(text)
  };
}

async function fetchHtml(origin, slug) {
  const url = `${origin}${slug === "/" ? "/" : slug}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        accept: "text/html",
        "user-agent": "mydreamshoots-content-guard/1.0"
      }
    });
    const body = await response.text();
    return { url, status: response.status, body };
  } finally {
    clearTimeout(timeout);
  }
}

async function compareOriginToDatabase({ origin, originLabel, slug, records }) {
  const selectedRecords = selectLiveExpectationRecords(records);
  if (!selectedRecords.length) {
    warnings.push({ type: "no-live-expectations", originLabel, slug });
    return { slug, originLabel, expected: 0, matched: 0, coverage: 1 };
  }

  let fetched;
  try {
    fetched = await fetchHtml(origin, slug);
  } catch (error) {
    addFailure("origin-fetch-failed", `${originLabel} ${slug} could not be fetched`, {
      slug,
      originLabel,
      origin,
      error: error instanceof Error ? error.message : String(error)
    });
    return { slug, originLabel, expected: selectedRecords.length, matched: 0, coverage: 0 };
  }

  if (fetched.status < 200 || fetched.status >= 300) {
    addFailure("origin-http-status", `${originLabel} ${slug} returned HTTP ${fetched.status}`, {
      slug,
      originLabel,
      url: fetched.url,
      status: fetched.status
    });
    return { slug, originLabel, expected: selectedRecords.length, matched: 0, coverage: 0 };
  }

  const htmlBundle = extractHtmlBundle(fetched.body);
  const missing = selectedRecords.filter((record) => !recordAppearsInHtml(record, htmlBundle));
  const matched = selectedRecords.length - missing.length;
  const coverage = selectedRecords.length ? matched / selectedRecords.length : 1;
  const minCoverage = minCoverageForSlug(slug);
  if (coverage < minCoverage) {
    addFailure("origin-content-coverage", `${originLabel} ${slug} does not contain enough database-published copy`, {
      slug,
      originLabel,
      url: fetched.url,
      expected: selectedRecords.length,
      matched,
      coverage: Number(coverage.toFixed(3)),
      minLiveCoverage: minCoverage,
      missing: missing.slice(0, 14).map(shortRecord),
      likelyCause: originLabel === "production"
        ? "production page is stale, cached, or reading a different content source than the database"
        : "local render is stale or reading local JSON instead of database-published content"
    });
  }

  return { slug, originLabel, expected: selectedRecords.length, matched, coverage: Number(coverage.toFixed(3)), minLiveCoverage: minCoverage };
}

async function loadDatabaseSite() {
  return prisma.site.findFirst({
    where: {
      OR: [
        { id: siteId },
        { slug: "mydreamshoots" },
        { slug: "dreamshoot" },
        { primaryDomain: "www.mydreamshoots.com" }
      ]
    },
    select: {
      id: true,
      slug: true,
      primaryDomain: true,
      settings: { select: { publishedJson: true } },
      pages: {
        where: { slug: { in: Array.from(new Set(guardPaths.flatMap(slugCandidates))) } },
        orderBy: [{ slug: "asc" }],
        select: {
          id: true,
          slug: true,
          pageType: true,
          title: true,
          publishedJson: true
        }
      },
      publications: {
        orderBy: [{ version: "desc" }],
        take: 1,
        select: {
          id: true,
          version: true,
          publishedAt: true,
          snapshot: true
        }
      }
    }
  });
}

async function main() {
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL is required so the content guard can verify the database source of truth.");
  }

  if (!skipHomepageLock && !guardPaths.includes("/")) {
    addFailure("homepage-lock-path-not-guarded", "MyDreamShoots homepage lock requires / to be included in guarded paths", {
      homepageLockPath,
      guardedPaths: guardPaths,
      likelyCause: "--paths excluded the homepage; do not bypass the approved homepage baseline in deploy/build prechecks"
    });
  }

  const site = await loadDatabaseSite();
  if (!site) throw new Error("MyDreamShoots site was not found in Postgres.");
  const settings = site.settings?.publishedJson ?? {};
  const latestPublication = site.publications?.[0];
  const localState = skipLocalJson ? undefined : loadLocalState();
  const localSite = skipLocalJson ? undefined : findLocalSite(localState);
  const localSettings = localSite?.themeSettings?.publishedJson;
  const perPage = [];
  const originReports = [];
  let homepageLockReport = skipHomepageLock ? { status: "skipped", path: homepageLockPath } : null;

  if (!skipLocalJson && !localSite) {
    addFailure("local-json-site-missing", "data/platform-state.json does not contain the MyDreamShoots site", { statePath });
  }

  if (latestPublication?.snapshot?.themeSettings) {
    const snapshotSettings = latestPublication.snapshot.themeSettings.publishedJson ?? latestPublication.snapshot.themeSettings;
    compareStructuredFingerprints({
      leftLabel: "ThemeSettings.publishedJson",
      rightLabel: `latest themePublication v${latestPublication.version} settings`,
      slug: "themeSettings",
      leftRecords: collectSettingsRecords(settings, "db:themeSettings.publishedJson"),
      rightRecords: collectSettingsRecords(snapshotSettings, `publication:${latestPublication.id}:themeSettings`)
    });
  } else {
    addFailure("publication-settings-missing", "latest ThemePublication does not contain a themeSettings snapshot", {
      publicationId: latestPublication?.id,
      version: latestPublication?.version
    });
  }

  if (!skipLocalJson && localSettings) {
    compareStructuredFingerprints({
      leftLabel: "database ThemeSettings.publishedJson",
      rightLabel: "local data/platform-state.json themeSettings.publishedJson",
      slug: "themeSettings",
      leftRecords: collectSettingsRecords(settings, "db:themeSettings.publishedJson"),
      rightRecords: collectSettingsRecords(localSettings, "local-json:themeSettings.publishedJson")
    });
  }

  if (writeHomepageLock) {
    const dbPage = findPageBySlug(site.pages, "/");
    if (!dbPage) {
      addFailure("homepage-lock-write-db-page-missing", "Cannot write MyDreamShoots approved homepage lock because the homepage is missing from database ThemePage records", {
        homepageLockPath
      });
    } else {
      const dbRecords = collectPageRecords(dbPage, settings, `db:themePage:${dbPage.slug}`);
      const lock = buildHomepageLock({ dbPage, dbRecords, latestPublication, settings, site });
      fs.writeFileSync(homepageLockPath, `${JSON.stringify(lock, null, 2)}\n`);
      warnings.push({
        type: "homepage-lock-written",
        homepageLockPath,
        message: "The approved homepage lock was refreshed from the current Postgres published homepage. Re-run the guard without --write-homepage-lock before deploying."
      });
    }
  }

  for (const slug of guardPaths) {
    const dbPage = findPageBySlug(site.pages, slug);
    if (!dbPage) {
      addFailure("db-page-missing", `${slug} is missing from database ThemePage records`, { slug, candidates: slugCandidates(slug) });
      continue;
    }

    const dbRecords = collectPageRecords(dbPage, settings, `db:themePage:${dbPage.slug}`);
    const snapshotPage = findPageBySlug(latestPublication?.snapshot?.pages ?? [], slug);
    const localPage = findPageBySlug(localSite?.pages ?? [], slug);
    const pageSummary = {
      slug,
      dbSlug: dbPage.slug,
      db: fingerprintSummary(dbRecords),
      publication: undefined,
      localJson: undefined
    };

    if (normalizePath(slug) === "/") {
      homepageLockReport = compareHomepageLock({ dbPage, dbRecords });
      pageSummary.approvedHomepageLock = homepageLockReport;
    }

    if (snapshotPage?.publishedJson) {
      const snapshotRecords = collectPageRecords(snapshotPage, latestPublication?.snapshot?.themeSettings?.publishedJson ?? latestPublication?.snapshot?.themeSettings ?? settings, `publication:${latestPublication.id}:${snapshotPage.slug ?? slug}`);
      pageSummary.publication = fingerprintSummary(snapshotRecords);
      compareStructuredFingerprints({
        leftLabel: "database ThemePage.publishedJson",
        rightLabel: `latest themePublication v${latestPublication.version}`,
        slug,
        leftRecords: dbRecords,
        rightRecords: snapshotRecords
      });
    } else {
      addFailure("publication-page-missing", `${slug} is missing from the latest ThemePublication snapshot`, {
        slug,
        publicationId: latestPublication?.id,
        version: latestPublication?.version,
        candidates: slugCandidates(slug)
      });
    }

    if (!skipLocalJson) {
      if (localPage?.publishedJson) {
        const localRecords = collectPageRecords(localPage, localSettings ?? settings, `local-json:${localPage.slug ?? slug}`);
        pageSummary.localJson = fingerprintSummary(localRecords);
        compareStructuredFingerprints({
          leftLabel: "database ThemePage.publishedJson",
          rightLabel: "local data/platform-state.json publishedJson",
          slug,
          leftRecords: dbRecords,
          rightRecords: localRecords
        });
      } else {
        addFailure("local-json-page-missing", `${slug} is missing from local data/platform-state.json`, { slug, candidates: slugCandidates(slug) });
      }
    }

    if (!skipLive) {
      originReports.push(await compareOriginToDatabase({ origin: liveOrigin, originLabel: "production", slug, records: dbRecords }));
    }
    if (localOrigin) {
      originReports.push(await compareOriginToDatabase({ origin: localOrigin, originLabel: "local", slug, records: dbRecords }));
    }

    perPage.push(pageSummary);
  }

  const payload = {
    ok: failures.length === 0,
    site: { id: site.id, slug: site.slug, primaryDomain: site.primaryDomain },
    sourceOfTruth: "postgres: ThemePage.publishedJson + ThemeSettings.publishedJson",
    guardedPaths: guardPaths,
    latestPublication: latestPublication
      ? { id: latestPublication.id, version: latestPublication.version, publishedAt: latestPublication.publishedAt }
      : null,
    live: skipLive ? "skipped" : { origin: liveOrigin, minLiveCoverage },
    localRender: localOrigin ? { origin: localOrigin, minLiveCoverage } : "skipped",
    pathMinLiveCoverage: Object.fromEntries(pathMinLiveCoverage),
    localJson: skipLocalJson ? "reference-only; skipped unless --include-local-json is passed" : statePath,
    approvedHomepageLock: homepageLockReport ?? "not checked; / was not included in guarded paths",
    pages: perPage,
    originReports,
    warnings,
    failures
  };

  if (failures.length) {
    console.error(JSON.stringify(payload, null, 2));
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
