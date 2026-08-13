#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const repoRoot = process.cwd();
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
const statePath = path.resolve(repoRoot, String(args.get("state-path") ?? path.join("data", "platform-state.json")));
const writeJson = flags.has("write-json");
const writeLock = flags.has("write-lock");
const refreshHomepageLockOnly = flags.has("refresh-homepage-lock-only");
const dryRun = flags.has("dry-run") || (!writeJson && !writeLock);
const now = new Date();

const brand = "myDreamshoots";
const copyTargets = {
  trustedLogoTitle: `Most Trusted Creators. | ${brand}`,
  aboutTitle: `What is ${brand}?`,
  aboutBody: `${brand} is an AI photo and video studio produced by MRNARUEBET LLC. No studio, no outfits, no photographer, and nothing to book, just magic. Turn your selfies into stunning photo and video in seconds with ${brand}'s: upload your photos, choose a theme, and create realistic headshots, creator portraits, fan photos, seasonal cards, private albums, and short video-ready images. Plans start at $24.50/month, and every package shows the credit cost before generation.`,
  imageTitle: "Best Photo Generator",
  imageAllLabel: "VIEW ALL PHOTO",
  imageAllHref: "/best-ai-image",
  videoTitle: "Best Video Generator",
  videoAllLabel: "VIEW ALL VIDEO",
  videoAllHref: "/best-ai-video",
  pricingTitle: "Subscription Plans",
  pricingSubtitle: "Choose the plan that works for you",
  pricingMarketComparison: `The average professional photoshoot can cost around $725. ${brand} keeps plan selection simple with monthly or quarterly and semiannually subscriptions.`,
  pricingDescription: "Choose Starter, Pro, or Premium. Each package shows its credit cost before generation; failed requests can return reserved credits according to request status.",
  pricingSidePanelEyebrow: "Why people subscribe",
  pricingSidePanelTitle: "Our plans starts from $24.50 and are designed to be more affordable and flexible.",
  pricingSidePanelBody: "Credits stay predictable while packs stay flexible. You can generate private photo albums after reviewing credits, keep credit use predictable, and top up only when they need more runs.",
  mobileTitle: "How it works",
  mobileSubtitle: "Upload selfies and start creating your AI photshoot now",
  mobileSupportingCopy: `Use ${brand}'s AI Video design your videos with your own creativity. Your next video content can instantly go viral.`,
  packageLabel: "AI PHOTO STUDIOS",
  packageTitle: "Professional AI Photo Packages",
  packageSubtitle: `Whether solo or with a partner, you can create stunning AI photo albums in just one click with ${brand}'s themed photo packs. We've curated the best poses, outfit ideas, and hairstyles for you. Plus, we're always adding new photo packs to our collection. Send a ❤️ to a special someone. Or use it just for fun!`,
  directoryLabel: "AI PHOTO THEMED",
  directorySubtitle: "Use your own creativity surprise your partner with a romantic video or photo.",
  reviewTitle: "What Our Customers Say",
  reviewSubtitle: "Our users love us and we love them!",
  reviewBody: `${brand} is an AI photo and video creator platform with creativity creators from all over the world. Creators are not simply content distributors. At their best, they are brokers of trust.`,
  conversionEyebrow: "BEST AI MAKER",
  conversionTitle: `Ready to try the ${brand}'s Best AI Maker?`,
  conversionSubtitle: `We've designed ${brand} to be as easy as possible to use, allowing you to focus on unleashing your creativity with complete peace of mind. Subscribe, upload, choose packages, generate results, and keep delivery in one workspace.`
};
const issueGroupOrder = [
  "01_about_copy",
  "02_generator_headings_links",
  "03_pricing_heading",
  "04_pricing_copy_order",
  "05_mobile_tutorial",
  "06_package_catalog",
  "07_theme_directory",
  "08_reviews",
  "09_conversion"
];
const aboutBody =
  copyTargets.aboutBody;
const subscriptionSubtitle = copyTargets.pricingSubtitle;

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

const exactReplacements = new Map([
  ["Trusted by creators worldwide", copyTargets.trustedLogoTitle],
  [`Most Trusted Creators | ${brand}`, copyTargets.trustedLogoTitle],
  ["What is MyDreamShoots?", copyTargets.aboutTitle],
  ["What customers like about MyDreamShoots.", "What Our Customers Say"],
  ["Ways people use MyDreamShoots.", "What Our Customers Say"],
  ["Common ways people use MyDreamShoots.", "What Our Customers Say"],
  ["Plans & Pricing", "Subscription Plans"],
  ["Simple, Transparent Pricing", "Subscription Plans"],
  ["Open your private MyDreamShoots studio.", copyTargets.conversionTitle],
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

function noteStructuredChange(stats, group, source, key, before, after) {
  if (before === after) return;
  stats.stringsChanged += 1;
  stats.sectionFieldsChanged += 1;
  const groupStats = stats.issueGroups[group] ?? { fieldsChanged: 0, examples: [] };
  groupStats.fieldsChanged += 1;
  if (groupStats.examples.length < 4) {
    groupStats.examples.push({ source, key, before: String(before ?? "").slice(0, 160), after: String(after ?? "").slice(0, 160) });
  }
  stats.issueGroups[group] = groupStats;
  stats.examples.push({ key: `${group}:${key}`, before: String(before ?? "").slice(0, 180), after: String(after ?? "").slice(0, 180) });
}

function createIssueGroups() {
  return Object.fromEntries(issueGroupOrder.map((group) => [group, { fieldsChanged: 0, examples: [] }]));
}

function setSectionSetting(sections, sectionId, key, value, stats, group, source) {
  const section = sections?.[sectionId];
  if (!section || typeof section !== "object") return;
  const settings = section.settings && typeof section.settings === "object" ? section.settings : (section.settings = {});
  const before = settings[key];
  if (before === value) return;
  settings[key] = value;
  noteStructuredChange(stats, group, `${source}.sections.${sectionId}`, key, before, value);
}

function syncKnownMydreamSections(pageJson, stats, source) {
  if (!pageJson || typeof pageJson !== "object" || !pageJson.sections || typeof pageJson.sections !== "object") return;
  const { sections } = pageJson;

  for (const [key, value] of [
    ["trustedLogoTitle", copyTargets.trustedLogoTitle],
    ["aboutTitle", copyTargets.aboutTitle],
    ["aboutBody", copyTargets.aboutBody]
  ]) {
    setSectionSetting(sections, "generation_showcase_1", key, value, stats, "01_about_copy", source);
  }

  for (const [key, value] of [
    ["imageTitle", copyTargets.imageTitle],
    ["imageAllLabel", copyTargets.imageAllLabel],
    ["imageAllHref", copyTargets.imageAllHref],
    ["videoTitle", copyTargets.videoTitle],
    ["videoAllLabel", copyTargets.videoAllLabel],
    ["videoAllHref", copyTargets.videoAllHref]
  ]) {
    setSectionSetting(sections, "generation_showcase_1", key, value, stats, "02_generator_headings_links", source);
  }

  for (const [key, value] of [
    ["title", copyTargets.pricingTitle]
  ]) {
    setSectionSetting(sections, "pricing_1", key, value, stats, "03_pricing_heading", source);
  }

  for (const [key, value] of [
    ["subtitle", copyTargets.pricingSubtitle],
    ["marketComparison", copyTargets.pricingMarketComparison],
    ["description", copyTargets.pricingDescription],
    ["sidePanelEyebrow", copyTargets.pricingSidePanelEyebrow],
    ["sidePanelTitle", copyTargets.pricingSidePanelTitle],
    ["sidePanelBody", copyTargets.pricingSidePanelBody]
  ]) {
    setSectionSetting(sections, "pricing_1", key, value, stats, "04_pricing_copy_order", source);
  }

  for (const [key, value] of [
    ["title", copyTargets.mobileTitle],
    ["subtitle", copyTargets.mobileSubtitle],
    ["supportingCopy", copyTargets.mobileSupportingCopy]
  ]) {
    setSectionSetting(sections, "mobile_video_1", key, value, stats, "05_mobile_tutorial", source);
  }

  for (const [key, value] of [
    ["label", copyTargets.packageLabel],
    ["title", copyTargets.packageTitle],
    ["subtitle", copyTargets.packageSubtitle]
  ]) {
    setSectionSetting(sections, "package_catalog_1", key, value, stats, "06_package_catalog", source);
  }

  for (const [key, value] of [
    ["directoryLabel", copyTargets.directoryLabel],
    ["directorySubtitle", copyTargets.directorySubtitle]
  ]) {
    setSectionSetting(sections, "package_catalog_1", key, value, stats, "07_theme_directory", source);
  }

  for (const [key, value] of [
    ["title", copyTargets.reviewTitle],
    ["subtitle", copyTargets.reviewSubtitle],
    ["summaryTitle", copyTargets.reviewTitle],
    ["summaryBody", copyTargets.reviewBody],
    ["summaryRating", ""],
    ["summaryMeta", ""]
  ]) {
    setSectionSetting(sections, "proof_1", key, value, stats, "08_reviews", source);
  }

  for (const [key, value] of [
    ["eyebrow", copyTargets.conversionEyebrow],
    ["title", copyTargets.conversionTitle],
    ["subtitle", copyTargets.conversionSubtitle]
  ]) {
    setSectionSetting(sections, "conversion_1", key, value, stats, "09_conversion", source);
  }
}

function syncKnownMydreamSectionsDeep(value, stats, source = "state") {
  if (!value || typeof value !== "object") return;
  syncKnownMydreamSections(value, stats, source);
  if (Array.isArray(value)) {
    value.forEach((item, index) => syncKnownMydreamSectionsDeep(item, stats, `${source}[${index}]`));
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object") continue;
    syncKnownMydreamSectionsDeep(entry, stats, `${source}.${key}`);
  }
}

function templateKeyForPage(page) {
  const slug = normalizePath(page?.slug ?? page?.draftJson?.slug ?? page?.publishedJson?.slug ?? "");
  if (slug === "/") return "index";
  return slug.replace(/^\/+/, "").replace(/\/+$/g, "") || "index";
}

function pageJsonToThemeTemplate(page) {
  const pageJson = clone(page?.draftJson ?? page?.publishedJson ?? {});
  if (!pageJson || typeof pageJson !== "object") return undefined;
  const order = Array.isArray(pageJson.sectionsOrder)
    ? pageJson.sectionsOrder
    : Array.isArray(pageJson.content_for_page)
      ? pageJson.content_for_page
      : [];
  pageJson.content_for_page = [...order];
  return pageJson;
}

function syncSiteThemeTemplatesFromPages(state, site, stats) {
  const templates = {};
  for (const page of asArray(site.pages)) {
    const key = templateKeyForPage(page);
    const template = pageJsonToThemeTemplate(page);
    if (template) templates[key] = template;
  }
  if (!Object.keys(templates).length) return;

  for (const theme of asArray(state.siteThemes).filter((entry) => entry.siteId === siteId)) {
    if (!siteThemeNeedsTemplateRebuild(theme)) continue;
    const before = JSON.stringify(theme.templates ?? {});
    theme.templates = clone(templates);
    const after = JSON.stringify(theme.templates);
    if (before !== after) {
      stats.siteThemeTemplatesChanged += 1;
      stats.examples.push({
        key: `siteThemeTemplates:${theme.id ?? "site_theme"}`,
        before: before.slice(0, 180),
        after: after.slice(0, 180)
      });
    }
  }
}

function siteThemeNeedsTemplateRebuild(theme) {
  const templates = theme?.templates && typeof theme.templates === "object" ? theme.templates : {};
  const home = templates.index;
  if (home?.sections?.generation_showcase_1?.type !== "dreamshoot_generation_showcase") return true;
  if (home?.sections?.mobile_video_1?.settings?.title !== copyTargets.mobileTitle) return true;
  if (templates["best-packages"]?.sections?.featured_pack_1?.type !== "dreamshoot_featured_pack") return true;
  if (templates["best-ai-image"]?.sections?.best_ai_image_1?.type !== "dreamshoot_media_gallery") return true;
  if (templates["best-ai-video"]?.sections?.best_ai_video_1?.type !== "dreamshoot_media_gallery") return true;
  return false;
}

function syncTargetState(state) {
  const stats = { stringsChanged: 0, sectionFieldsChanged: 0, siteThemeTemplatesChanged: 0, examples: [], issueGroups: createIssueGroups() };
  const site = asArray(state.sites).find((item) => item.id === siteId);
  if (!site) throw new Error(`site ${siteId} not found in ${statePath}`);

  syncCopy(site, stats);
  syncKnownMydreamSectionsDeep(site, stats, `site:${site.id}`);
  syncSiteThemeTemplatesFromPages(state, site, stats);

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
      syncKnownMydreamSectionsDeep(item, stats, `${collectionName}:${item.id ?? "item"}`);
    }
  }

  for (const publication of asArray(state.themePublications).filter((entry) => entry.siteId === siteId)) {
    if (!publication.snapshot || typeof publication.snapshot !== "object") continue;
    publication.snapshot.themeSettings = clone(site.themeSettings?.publishedJson ?? {});
  }

  stats.examples = stats.examples.slice(0, 36);
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
  const site = asArray(state.sites).find((item) => item.id === siteId);
  if (!site) throw new Error(`site ${siteId} not found in ${statePath}`);
  const stats = refreshHomepageLockOnly
    ? { stringsChanged: 0, sectionFieldsChanged: 0, siteThemeTemplatesChanged: 0, examples: [], issueGroups: createIssueGroups() }
    : syncTargetState(state).stats;
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

  if (!refreshHomepageLockOnly && writeLock && !writeJson && jsonChanged) {
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
    refreshHomepageLockOnly,
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
      sectionFieldsChanged: stats.sectionFieldsChanged,
      siteThemeTemplatesChanged: stats.siteThemeTemplatesChanged,
      issueGroups: stats.issueGroups,
      examples: stats.examples
    },
    homepageLock: homepageLock.fingerprints
  }, null, 2));
}

main();
