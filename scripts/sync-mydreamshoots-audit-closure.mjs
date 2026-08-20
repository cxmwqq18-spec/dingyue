import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data/platform-state.json");
const dryRun = process.argv.includes("--dry-run") || !process.argv.includes("--write");
const updateDb = process.argv.includes("--db");
const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
const site = state.sites?.find((item) => item.id === "site_dreamshoot");
if (!site) throw new Error("Missing site_dreamshoot in platform-state.json");

function assertLocalDbWriteAllowed() {
  if (dryRun) throw new Error("--db requires --write; refusing to mutate the database during a dry run.");
  if (process.env.ALLOW_LOCAL_BLOG_DB_SYNC !== "1") {
    throw new Error("Database sync requires ALLOW_LOCAL_BLOG_DB_SYNC=1.");
  }
  if (process.env.LOCAL_BLOG_DB_CONTAINER_CONFIRMED !== "1") {
    throw new Error("Database sync requires LOCAL_BLOG_DB_CONTAINER_CONFIRMED=1.");
  }
  const databaseUrl = process.env.DATABASE_URL ?? "";
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Database sync requires a valid DATABASE_URL.");
  }
  if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
    throw new Error(`Refusing non-local DATABASE_URL host: ${parsed.hostname}`);
  }
  if (!["15432", "15433", ""].includes(parsed.port)) {
    throw new Error(`Refusing unexpected local database port: ${parsed.port}`);
  }
}

if (updateDb) assertLocalDbWriteAllowed();

const policySlugs = new Set([
  "/privacy",
  "/policies/privacy",
  "/privacy-policy",
  "/refunds",
  "/policies/refunds",
  "/refund-policy",
  "/terms",
  "/policies/terms",
  "/terms-of-service",
  "/content",
  "/policies/content",
  "/content-policy",
  "/cookies",
  "/policies/cookies",
  "/cookie-policy"
]);

// These records belong to the retired video-theme framework. Keep the rows for
// history, but make their inactive state explicit so the AI Video Generation
// route is the only public video taxonomy.
const legacyVideoThemeSlugs = new Set([
  "cinematic-portrait-motion",
  "social-profile-clip",
  "travel-route-story",
  "wedding-memory-film",
  "holiday-card-motion",
  "product-showcase-motion",
  "prompt-directed-motion",
  "creator-intro-motion"
]);

const unsupportedPublicNavigationHrefs = new Set(["/creators-circle"]);

const exactReplacements = [
  ["Money-back guarantee", "Refund review"],
  ["money-back guarantee review", "refund review"],
  ["Your inputs are never used to train models.", "The current policy describes how inputs are handled for service delivery; confirm the live Privacy Policy and provider terms before relying on a retention or training assumption."],
  ["Your uploaded photos, prompts, and generated private results are used to provide the myDreamshoots service you request. They are never used to train models or build public datasets.", "Your uploaded photos, prompts, and generated private results are handled to provide the requested service. Review the live Privacy Policy and provider terms for the current data-use boundaries."],
  ["Your uploaded photos, prompts, and generated private results are used to provide the MyDreamShoots service you request. They are never used to train models or build public datasets.", "Your uploaded photos, prompts, and generated private results are handled to provide the requested service. Review the live Privacy Policy and provider terms for the current data-use boundaries."],
  ["Input photos automatically delete 30 days after generation.", "Input-photo deletion follows the current retention process described in the Privacy Policy; confirm the applicable window before relying on it."],
  ["Private uploads and generated account records stay inside signed-in account workflows with access controls and provider safeguards.", "Private uploads and account records are handled through signed-in account workflows; review current provider and security documentation for applicable safeguards."],
  ["No AI training on your photos", "Photo-use terms"],
  ["30-day auto-delete for input photos", "Input-photo retention"],
  ["30-day auto-delete", "Input-photo retention"],
  ["AES-256", "account and provider safeguards"],
  ["no AI training", "photo-use policy"]
];

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function replaceText(value) {
  if (typeof value !== "string") return value;
  return exactReplacements.reduce((next, [from, to]) => next.replaceAll(from, to), value)
    .replace(
      /Read how myDreamshoots keeps account data, uploaded source photos, generated portraits, credit activity, checkout records, and private album access private\. Your photos are never used to train models, input photos auto-delete 30 days after generation, and account workflows use secure storage and access controls\./gi,
      "Review how myDreamshoots handles account data, uploaded source photos, generated portraits, credit activity, checkout records, and private album access. Confirm the effective policy and provider terms for current data-use and retention details."
    )
    .replace(
      /Review the myDreamshoots terms for customer accounts, AI photo credits, uploads, generation limits, refunds, and private gallery access\. The service does not use your photos for model training, applies (?:30-day auto-delete|Input-photo retention) to input photos, and keeps uploads inside secure account workflows\./gi,
      "Review the myDreamshoots terms for customer accounts, AI photo credits, uploads, generation limits, refunds, private gallery access, and the current data-handling policy."
    )
    .replace(/Your photos are never used to train models\.?/gi, "Review the effective Privacy Policy and provider terms for current photo-use details.")
    .replace(/The service does not use your photos for model training\.?/gi, "Review the effective Privacy Policy and provider terms for current photo-use details.")
    .replace(/input photos auto-delete 30 days after generation\.?/gi, "input-photo retention follows the effective Privacy Policy.");
}

function replacePolicyBody(value) {
  if (typeof value !== "string") return value;
  return replaceText(value)
    .replaceAll(
      'Email <a href="mailto:support@mydreamshoots.com">support@mydreamshoots.com</a>',
      'Use the <a href="/contact-us">Contact page</a>'
    )
    .replaceAll(
      "Refund requests should be submitted within 30 days of the purchase date.",
      "Submit refund requests promptly; support will confirm the applicable review window from the purchase and account record."
    );
}

function mapTree(value, visitor) {
  const replaced = visitor(value);
  if (replaced !== value) return replaced;
  if (Array.isArray(value)) return value.map((item) => mapTree(item, visitor));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, mapTree(item, visitor)]));
  }
  return value;
}

const unverifiedClaimPattern = /(?:never used to train models|no ai training|30-day auto-delete|automatically delete 30 days|auto-delete 30 days|AES-256|TLS 256(?:-bit)?|100% money-back guarantee)/i;

function countMatchingStrings(value, pattern) {
  if (typeof value === "string") return pattern.test(value) ? 1 : 0;
  if (Array.isArray(value)) return value.reduce((total, item) => total + countMatchingStrings(item, pattern), 0);
  if (value && typeof value === "object") {
    return Object.values(value).reduce((total, item) => total + countMatchingStrings(item, pattern), 0);
  }
  return 0;
}

function updatePage(page) {
  const before = JSON.stringify(page);
  for (const jsonKey of ["draftJson", "publishedJson"]) {
    const json = page[jsonKey];
    if (!json) continue;
    page[jsonKey] = removeUnsupportedPublicNavigation(mapTree(json, replaceText));
    if (page.slug === "/policies/cookies" || page.slug === "/cookie-policy") {
      page[jsonKey].seo = {
        ...(page[jsonKey].seo ?? {}),
        title: "Cookie Policy | myDreamShoots",
        description: "How myDreamShoots uses essential browser storage for sign-in, checkout continuity, security, preferences, and private galleries.",
        canonicalPath: "/cookies",
        canonical: "/cookies",
        index: true,
        follow: true,
        robots: { index: true, follow: true }
      };
    }
    if (policySlugs.has(page.slug) && page[jsonKey]?.sections) {
      for (const section of Object.values(page[jsonKey].sections)) {
        if (section.type === "policy_content" || section.type === "rich_text") {
          section.settings.body = replacePolicyBody(section.settings.body);
        }
      }
    }
  }
  return before !== JSON.stringify(page);
}

let changedPages = 0;
const changedPageSlugs = new Set();
site.pages = site.pages.map((page) => {
  const next = clone(page);
  if (updatePage(next)) {
    changedPages += 1;
    changedPageSlugs.add(next.slug);
  }
  return next;
});

let changedLegacyVideoThemes = 0;
for (const theme of state.videoThemes ?? []) {
  if (theme.siteId !== site.id || !legacyVideoThemeSlugs.has(theme.slug)) continue;
  if (theme.status !== "inactive") {
    theme.status = "inactive";
    changedLegacyVideoThemes += 1;
  }
}

function updateSiteText(value) {
  return mapTree(value, (item) => {
    if (typeof item !== "string") return item;
    let next = replaceText(item);
    next = next.replaceAll("<h3>Company</h3><p>myDreamshoots.com</p>", "<h3>Brand</h3><p>myDreamshoots.com</p>");
    next = next.replaceAll("myDreamshoots company name.", "Public storefront brand.");
    return next;
  });
}

function removeUnsupportedPublicNavigation(value) {
  if (Array.isArray(value)) {
    return value
      .filter((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return true;
        const href = typeof item.href === "string" ? item.href : item.settings?.href;
        return !unsupportedPublicNavigationHrefs.has(href);
      })
      .map(removeUnsupportedPublicNavigation);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, removeUnsupportedPublicNavigation(item)]));
  }
  return value;
}

function updateMydreamshootsValue(value) {
  return removeUnsupportedPublicNavigation(updateSiteText(value));
}

function ensureCookiePolicyLink(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const next = clone(value);
  for (const settingsKey of ["draftJson", "publishedJson"]) {
    const navigation = next[settingsKey]?.navigation;
    if (!navigation || !Array.isArray(navigation.footerLinks)) continue;
    if (!navigation.footerLinks.some((link) => link?.href === "/cookies")) {
      navigation.footerLinks.push({ label: "Cookie Policy", href: "/cookies", group: "support" });
    }
  }
  return next;
}

site.themeSettings = ensureCookiePolicyLink(updateMydreamshootsValue(site.themeSettings));
let changedEmbeddedSiteThemes = 0;
site.siteThemes = (site.siteThemes ?? []).map((theme) => {
  const next = {
    ...theme,
    templates: updateMydreamshootsValue(theme.templates),
    settings: updateMydreamshootsValue(theme.settings)
  };
  if (JSON.stringify(next) !== JSON.stringify(theme)) changedEmbeddedSiteThemes += 1;
  return next;
});
const requiredVideoTopicPages = site.pages.filter((page) =>
  page.slug.startsWith("/ai-video-generation/") &&
  !["/ai-video-generation/text-to-video", "/ai-video-generation/image-to-video"].includes(page.slug)
);

function normalizePublicationSnapshot(value) {
  const next = updateMydreamshootsValue(value);
  if (next?.snapshot && typeof next.snapshot === "object" && next.snapshot.themeSettings) {
    next.snapshot.themeSettings = clone(site.themeSettings?.publishedJson ?? next.snapshot.themeSettings);
  }
  if (Array.isArray(next?.snapshot?.pages)) {
    const requiredBySlug = new Map(requiredVideoTopicPages.map((page) => [page.slug, page]));
    next.snapshot.pages = next.snapshot.pages.map((page) => clone(requiredBySlug.get(page.slug) ?? page));
    const publishedSlugs = new Set(next.snapshot.pages.map((page) => page.slug));
    for (const page of requiredVideoTopicPages) {
      if (!publishedSlugs.has(page.slug)) next.snapshot.pages.push(clone(page));
    }
    next.pageCount = next.snapshot.pages.length;
  }
  return next;
}

const embeddedPublicationsBefore = JSON.stringify(site.themePublications ?? []);
site.themePublications = (site.themePublications ?? []).map(normalizePublicationSnapshot);
const changedEmbeddedPublications = embeddedPublicationsBefore === JSON.stringify(site.themePublications) ? 0 : site.themePublications.length;
site.latestPublication = normalizePublicationSnapshot(site.latestPublication);
let changedSiteThemes = 0;
for (const siteTheme of state.siteThemes ?? []) {
  if (siteTheme.siteId !== site.id) continue;
  const before = JSON.stringify(siteTheme);
  siteTheme.templates = updateMydreamshootsValue(siteTheme.templates);
  siteTheme.settings = updateMydreamshootsValue(siteTheme.settings);
  if (before !== JSON.stringify(siteTheme)) changedSiteThemes += 1;
}
for (const publication of state.themePublications ?? []) {
  if (publication.siteId !== site.id) continue;
  publication.snapshot = normalizePublicationSnapshot({ snapshot: publication.snapshot }).snapshot;
}
const unresolvedUnverifiedClaimStrings = countMatchingStrings([
  site,
  ...(state.siteThemes ?? []).filter((theme) => theme.siteId === site.id),
  ...(state.themePublications ?? []).filter((publication) => publication.siteId === site.id)
], unverifiedClaimPattern);
if (unresolvedUnverifiedClaimStrings > 0) {
  throw new Error(`MyDreamShoots still contains ${unresolvedUnverifiedClaimStrings} unverified absolute claim strings.`);
}

if (!dryRun) fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);

function cloneJson(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function jsonSize(value) {
  return Buffer.byteLength(JSON.stringify(value ?? {}), "utf8");
}

function clearLocalStateCaches() {
  for (const dir of [".next", ".next-dev", ".next-3002", ".next-docx-verify"]) {
    const cacheFile = path.join(repoRoot, dir, "cache/platform-state-postgres.json");
    if (fs.existsSync(cacheFile)) fs.rmSync(cacheFile, { force: true });
  }
}

async function syncDatabase() {
  if (!updateDb) return undefined;
  const prisma = new PrismaClient();
  const result = { themeSettings: 0, themePages: 0, siteThemes: 0, themePublications: 0, legacyVideoThemes: 0, platformStateDocument: 0 };
  try {
    const sourcePages = new Map(site.pages.filter((page) => changedPageSlugs.has(page.slug)).map((page) => [page.slug, page]));
    for (const page of requiredVideoTopicPages) sourcePages.set(page.slug, page);
    const sourceSiteThemes = new Map((state.siteThemes ?? []).filter((theme) => theme.siteId === site.id).map((theme) => [theme.id, theme]));
    const updatePublicationSnapshot = (value) => {
      const snapshot = updateMydreamshootsValue(cloneJson(value ?? {}));
      if (!Array.isArray(snapshot.pages)) return snapshot;
      snapshot.pages = snapshot.pages.map((page) => {
        const source = sourcePages.get(page.slug);
        return source ? cloneJson(source) : page;
      });
      const publishedSlugs = new Set(snapshot.pages.map((page) => page.slug));
      for (const page of requiredVideoTopicPages) {
        if (!publishedSlugs.has(page.slug)) snapshot.pages.push(cloneJson(page));
      }
      if (snapshot.themeSettings) snapshot.themeSettings = cloneJson(site.themeSettings?.publishedJson ?? snapshot.themeSettings);
      return snapshot;
    };
    await prisma.$transaction(async (tx) => {
      const settings = await tx.themeSettings.findUnique({ where: { siteId: site.id } });
      if (settings) {
        const draftJson = cloneJson(site.themeSettings?.draftJson ?? settings.draftJson);
        const publishedJson = cloneJson(site.themeSettings?.publishedJson ?? settings.publishedJson);
        if (JSON.stringify(draftJson) !== JSON.stringify(settings.draftJson) || JSON.stringify(publishedJson) !== JSON.stringify(settings.publishedJson)) {
          await tx.themeSettings.update({ where: { siteId: site.id }, data: { draftJson, publishedJson } });
          result.themeSettings += 1;
        }
      }

      for (const page of await tx.themePage.findMany({ where: { siteId: site.id } })) {
        const source = sourcePages.get(page.slug);
        if (!source) continue;
        const draftJson = cloneJson(source.draftJson ?? page.draftJson);
        const publishedJson = cloneJson(source.publishedJson ?? page.publishedJson);
        if (JSON.stringify(draftJson) === JSON.stringify(page.draftJson) && JSON.stringify(publishedJson) === JSON.stringify(page.publishedJson)) continue;
        await tx.themePage.update({ where: { id: page.id }, data: { draftJson, publishedJson, title: source.title ?? page.title } });
        result.themePages += 1;
      }

      for (const theme of await tx.siteTheme.findMany({ where: { siteId: site.id } })) {
        const source = sourceSiteThemes.get(theme.id);
        if (!source) continue;
        const templates = cloneJson(source.templates ?? theme.templates);
        const settings = cloneJson(source.settings ?? theme.settings);
        if (JSON.stringify(templates) === JSON.stringify(theme.templates) && JSON.stringify(settings) === JSON.stringify(theme.settings)) continue;
        await tx.siteTheme.update({ where: { id: theme.id }, data: { templates, settings } });
        result.siteThemes += 1;
      }

      // Historical publications are immutable. Audit-closure changes require a new publication.

      const legacyVideoThemeUpdate = await tx.videoTheme.updateMany({
        where: { siteId: site.id, slug: { in: [...legacyVideoThemeSlugs] } },
        data: { status: "inactive" }
      });
      result.legacyVideoThemes += legacyVideoThemeUpdate.count;

      const current = await tx.platformStateDocument.findUnique({ where: { id: "platform" } });
      const documentState = cloneJson(current?.state ?? {});
      const documentSite = documentState.sites?.find((item) => item.id === site.id);
      if (documentSite) {
        documentSite.pages = (documentSite.pages ?? []).map((page) => sourcePages.get(page.slug) ?? page);
        documentSite.themeSettings = cloneJson(site.themeSettings ?? documentSite.themeSettings);
        documentSite.siteThemes = cloneJson(site.siteThemes ?? documentSite.siteThemes);
        documentSite.themePublications = cloneJson(site.themePublications ?? documentSite.themePublications);
        documentSite.latestPublication = cloneJson(site.latestPublication ?? documentSite.latestPublication);
        documentState.siteThemes = (documentState.siteThemes ?? []).map((theme) => (
          theme.siteId === site.id ? cloneJson(sourceSiteThemes.get(theme.id) ?? theme) : theme
        ));
        documentState.themePublications = (documentState.themePublications ?? []).map((publication) => publication.siteId === site.id
          ? { ...publication, snapshot: updatePublicationSnapshot(publication.snapshot) }
          : publication);
        documentState.videoThemes = (documentState.videoThemes ?? []).map((theme) => (
          theme.siteId === site.id && legacyVideoThemeSlugs.has(theme.slug)
            ? { ...theme, status: "inactive" }
            : theme
        ));
        await tx.platformStateDocument.update({ where: { id: "platform" }, data: { state: documentState } });
        result.platformStateDocument += 1;
      }
    }, { timeout: 120000 });
    clearLocalStateCaches();
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

const database = await syncDatabase();
console.log(JSON.stringify({
  ok: true,
  dryRun,
  database,
  writeTarget: statePath,
  changedPages,
  changedPageSlugs: [...changedPageSlugs],
  changedSiteThemes,
  changedEmbeddedSiteThemes,
  changedEmbeddedPublications,
  unresolvedUnverifiedClaimStrings,
  changedLegacyVideoThemes,
  legacyVideoThemeSlugs: [...legacyVideoThemeSlugs],
  policySlugs: [...policySlugs]
}, null, 2));
