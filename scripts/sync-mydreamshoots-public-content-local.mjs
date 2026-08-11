#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const homepageLockPath = path.join(repoRoot, "docs", "content-locks", "mydreamshoots-homepage-approved.json");
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
const writeJson = flags.has("write-json");
const writeLock = flags.has("write-lock");
const dryRun = flags.has("dry-run") || (!writeJson && !writeLock);
const now = new Date();

const brand = "myDreamshoots";
const aboutBody =
  "myDreamshoots is an AI photo and video studio operated by MRNARUEBET LLC. No studio, no outfits, no photographer, and nothing to book, just magic. Turn your selfies into stunning photos and videos in seconds with myDreamshoots: choose a theme, review credits before generation, keep uploads private, and download finished results from your private gallery.";
const subscriptionSubtitle =
  "Choose Starter, Pro, or Premium with monthly, quarterly, or semiannual billing. Each package shows its credit cost before generation; failed requests can return reserved credits according to request status.";

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
  "eyebrow",
  "headline",
  "heading",
  "includedOutputs",
  "includedTitle",
  "label",
  "location",
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
  "subheading",
  "subheadline",
  "subtitle",
  "text",
  "title"
]);

const highSignalKeys = new Set([
  "answer",
  "body",
  "caption",
  "description",
  "eyebrow",
  "headline",
  "heading",
  "primaryCta",
  "question",
  "quote",
  "secondaryCta",
  "subheading",
  "subheadline",
  "subtitle",
  "text",
  "title"
]);

const exactReplacements = new Map([
  ["Trusted by creators worldwide", `Most Trusted Creators | ${brand}`],
  ["What is MyDreamShoots?", `What is ${brand}?`],
  ["What is myᕲreamshoots?", `What is ${brand}?`],
  ["What customers like about MyDreamShoots.", "What Our Customers Say"],
  ["Ways people use MyDreamShoots.", "What Our Customers Say"],
  ["Common ways people use MyDreamShoots.", "What Our Customers Say"],
  ["Plans & Pricing", "Subscription Plans"],
  ["Simple, Transparent Pricing", "Subscription Plans"],
  ["Open your private MyDreamShoots studio.", `Ready to try ${brand} Best AI Maker?`],
  ["Open your private myᕲreamshoots studio.", `Ready to try ${brand} Best AI Maker?`],
  ["Open pricing to select a monthly or yearly subscription plan.", "Open pricing to select a monthly, quarterly, or semiannual subscription plan."],
  ["Open pricing to select a monthly, quarterly, or semisemiannual subscription plan.", "Open pricing to select a monthly, quarterly, or semiannual subscription plan."],
  ["Open pricing to select a monthly, quarterly, or semisemiannual plan.", "Open pricing to select a monthly, quarterly, or semiannual plan."]
]);

const navigationLabelReplacements = new Map([
  ["Photoshoot Studio", "AI Photoshoot"],
  ["Tools", "AI Tools"]
]);

const substringReplacements = [
  [/\bMyDreamShoots\b/g, brand],
  [/\bMydreamShoots\b/g, brand],
  [/\bMydreamshoots\b/g, brand],
  [/\bDreamShootAI\b/g, brand],
  [/myᕲreamshoots/g, brand],
  [/monthly or yearly/gi, "monthly, quarterly, or semiannual"],
  [/monthly and yearly/gi, "monthly, quarterly, and semiannual"],
  [/\byearly subscription plan/gi, "semiannual subscription plan"],
  [/\bannual subscription plan/gi, "semiannual subscription plan"]
];

const protectedStringPattern = /https?:\/\/[^\s"'<>]+|mailto:[^\s"'<>]+|\/(?:assets|images|videos)\/[^\s"'<>]+|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\b(?:www\.)?mydreamshoots\.com\b/gi;

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePath(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw === "/") return "/";
  return `/${raw.replace(/^\/+/, "").replace(/\/+$/, "")}`;
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

function recordPriority(key) {
  if (key === "title" || key === "headline" || key === "heading" || key === "question") return 0;
  if (key === "description" || key === "subtitle" || key === "subheadline" || key === "text" || key === "answer" || key === "body") return 1;
  if (highSignalKeys.has(key)) return 2;
  return 3;
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

function extractSeoValue(seo, key) {
  if (!seo || typeof seo !== "object") return "";
  if (key === "title") return cleanText(seo.title ?? seo.seoTitle ?? seo.metaTitle ?? "");
  if (key === "description") return cleanText(seo.description ?? seo.seoDescription ?? seo.metaDescription ?? "");
  if (key === "keywords") return cleanText(Array.isArray(seo.keywords) ? seo.keywords.join(", ") : seo.keywords ?? "");
  return "";
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

function preserveProtectedStrings(value, transform) {
  const protectedValues = [];
  const masked = value.replace(protectedStringPattern, (match) => {
    const token = `__MDS_PROTECTED_${protectedValues.length}__`;
    protectedValues.push(match);
    return token;
  });
  const transformed = transform(masked);
  return transformed.replace(/__MDS_PROTECTED_(\d+)__/g, (_, index) => protectedValues[Number(index)] ?? "");
}

function applyCopyToString(value, key) {
  return preserveProtectedStrings(value, (unprotectedValue) => {
    let next = exactReplacements.get(unprotectedValue) ?? unprotectedValue;
    if ((key === "label" || key === "title") && navigationLabelReplacements.has(next)) {
      next = navigationLabelReplacements.get(next);
    }
    for (const [pattern, replacement] of substringReplacements) {
      next = next.replace(pattern, replacement);
    }
    return next;
  });
}

function shouldUseSubscriptionSubtitle(key, value) {
  return key === "subtitle" && value === "Choose Starter, Pro, or Premium. Each package shows its credit cost before generation; failed requests can return reserved credits according to request status.";
}

function syncCopy(value, stats, key = "") {
  if (typeof value === "string") {
    const next = key === "aboutBody"
      ? aboutBody
      : shouldUseSubscriptionSubtitle(key, value)
        ? subscriptionSubtitle
        : applyCopyToString(value, key);
    if (next !== value) {
      stats.stringsChanged += 1;
      stats.examples.push({ key, before: value.slice(0, 180), after: next.slice(0, 180) });
    }
    return next;
  }
  if (Array.isArray(value)) {
    return value.map((item) => syncCopy(item, stats, key));
  }
  if (!value || typeof value !== "object") return value;
  for (const [entryKey, entryValue] of Object.entries(value)) {
    value[entryKey] = syncCopy(entryValue, stats, entryKey);
  }
  return value;
}

function syncTargetState(state) {
  const stats = { stringsChanged: 0, examples: [] };
  const site = asArray(state.sites).find((item) => item.id === siteId);
  if (!site) throw new Error(`site ${siteId} not found in ${statePath}`);

  syncCopy(site, stats);

  for (const collectionName of [
    "siteThemes",
    "themePublications",
    "products",
    "siteAiApps",
    "creativePackCategories",
    "creativePacks",
    "mediaAssets",
    "toolCategories",
    "toolMenuItems",
    "videoThemeCategories",
    "videoThemes"
  ]) {
    for (const item of asArray(state[collectionName]).filter((entry) => entry.siteId === siteId)) {
      syncCopy(item, stats);
    }
  }

  for (const publication of asArray(state.themePublications).filter((entry) => entry.siteId === siteId)) {
    if (!publication.snapshot || typeof publication.snapshot !== "object") continue;
    publication.snapshot.themeSettings = clone(site.themeSettings?.publishedJson ?? {});
  }

  stats.examples = stats.examples.slice(0, 24);
  return { site, stats };
}

function latestPublicationForSite(state) {
  return asArray(state.themePublications)
    .filter((publication) => publication.siteId === siteId)
    .sort((left, right) => Number(right.version ?? 0) - Number(left.version ?? 0))[0];
}

function formatLocalIso(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const pad = (number) => String(Math.floor(number)).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}${sign}${pad(abs / 60)}:${pad(abs % 60)}`;
}

function buildHomepageLock(state, site, previousLock) {
  const page = asArray(site.pages).find((entry) => normalizePath(entry.slug) === "/");
  if (!page) throw new Error(`homepage for ${siteId} not found in ${statePath}`);
  const settings = site.themeSettings?.publishedJson ?? {};
  const records = collectPageRecords(page, settings, "approved-lock:themePage:/");
  const publication = latestPublicationForSite(state);
  const seo = page.publishedJson?.seo ?? {};
  const publishedJsonSha256 = stableJsonFingerprint(page.publishedJson);
  const visibleTextSha256 = fingerprintRecords(records);
  const previousFingerprints = previousLock?.fingerprints;
  const lockedAt = previousFingerprints?.publishedJsonSha256 === publishedJsonSha256
    && previousFingerprints?.visibleTextSha256 === visibleTextSha256
    && previousFingerprints?.visibleRecordCount === records.length
    ? previousLock.lockedAt
    : formatLocalIso(now);

  return {
    lockVersion: 1,
    lockedAt,
    policy: {
      owner: `${brand} site owner`,
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
      id: page.id,
      slug: page.slug,
      title: page.title,
      pageType: page.pageType
    },
    latestPublication: publication
      ? {
          id: publication.id,
          version: publication.version,
          publishedAt: publication.publishedAt
        }
      : null,
    seo: {
      title: extractSeoValue(seo, "title"),
      description: extractSeoValue(seo, "description"),
      keywords: extractSeoValue(seo, "keywords")
    },
    hero: page.publishedJson?.sections?.hero_1?.settings ?? {},
    sectionsOrder: page.publishedJson?.sectionsOrder ?? [],
    fingerprints: {
      publishedJsonSha256,
      visibleTextSha256,
      visibleRecordCount: records.length
    },
    visibleRecords: records
  };
}

function writeJsonFile(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  if (!fs.existsSync(statePath)) throw new Error(`${statePath} does not exist`);
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const { site, stats } = syncTargetState(state);
  const previousLock = fs.existsSync(homepageLockPath)
    ? JSON.parse(fs.readFileSync(homepageLockPath, "utf8"))
    : undefined;
  const homepageLock = buildHomepageLock(state, site, previousLock);
  const existingStateRaw = fs.readFileSync(statePath, "utf8");
  const nextStateRaw = `${JSON.stringify(state, null, 2)}\n`;
  const existingLockRaw = previousLock ? `${JSON.stringify(previousLock, null, 2)}\n` : "";
  const nextLockRaw = `${JSON.stringify(homepageLock, null, 2)}\n`;
  const jsonChanged = nextStateRaw !== existingStateRaw;
  const lockChanged = nextLockRaw !== existingLockRaw;

  if (writeLock && !writeJson && jsonChanged) {
    throw new Error("--write-lock cannot be used by itself when data/platform-state.json would change. Re-run with --write-json --write-lock so the approved lock matches persisted local content.");
  }

  if (writeJson && !dryRun && jsonChanged) {
    writeJsonFile(statePath, state);
  }
  if (writeLock && !dryRun && lockChanged) {
    writeJsonFile(homepageLockPath, homepageLock);
  }

  console.log(JSON.stringify({
    ok: true,
    mode: dryRun ? "dry-run" : "write",
    siteId,
    writes: {
      json: writeJson && !dryRun,
      homepageLock: writeLock && !dryRun
    },
    changed: {
      json: jsonChanged,
      homepageLock: lockChanged
    },
    copy: {
      stringsChanged: stats.stringsChanged,
      examples: stats.examples
    },
    homepageLock: homepageLock.fingerprints
  }, null, 2));
}

main();
