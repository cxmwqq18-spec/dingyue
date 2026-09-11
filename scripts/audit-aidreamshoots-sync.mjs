import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SOURCE = "site_dreamshoot";
const TARGET = "site_mydreamshoots_xby";
const TARGET_DOMAIN = "aidreamshoots.eu";
const reportPathArg = process.argv.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);
const failures = [];
const warnings = [];

function fail(message, detail) {
  failures.push(detail ? { message, detail } : { message });
}

function warn(message, detail) {
  warnings.push(detail ? { message, detail } : { message });
}

function values(value, pathName = "$") {
  if (typeof value === "string") return [{ value, path: pathName }];
  if (Array.isArray(value)) return value.flatMap((item, index) => values(item, `${pathName}[${index}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, item]) => values(item, `${pathName}.${key}`));
}

function publicSiteThemes(rows) {
  return rows.filter((row) => row.status === "active" || row.status === "published" || row.status === "draft");
}

function publicRows(rows) {
  return rows.filter((row) => row.status !== "inactive");
}

function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}

function digest(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

function setDifference(left, right) {
  return [...left].filter((item) => !right.has(item)).sort();
}

function active(rows) {
  return rows.filter((row) => row.status === "active");
}

function publicPayload(state) {
  return {
    site: state.site,
    domains: state.domains,
    settings: state.settings,
    profile: state.profile,
    livePages: state.livePages,
    themePages: state.themePages,
    products: state.products.filter((row) => row.status === "active"),
    packCategories: publicRows(state.packCategories),
    packs: publicRows(state.packs),
    toolCategories: publicRows(state.toolCategories),
    toolItems: publicRows(state.toolItems),
    videoCategories: publicRows(state.videoCategories),
    videos: publicRows(state.videos),
    examples: publicRows(state.examples),
    redirects: state.redirects,
    media: state.media,
    siteThemes: publicSiteThemes(state.siteThemes),
    siteAiApps: state.siteAiApps
  };
}

async function readSite(siteId) {
  const [site, domains, settings, profile, livePages, themePages, products, packCategories, packs, toolCategories, toolItems, videoCategories, videos, examples, redirects, media, siteThemes, siteAiApps] = await Promise.all([
    prisma.site.findUnique({ where: { id: siteId } }),
    prisma.siteDomain.findMany({ where: { siteId }, orderBy: { domain: "asc" } }),
    prisma.themeSettings.findUnique({ where: { siteId } }),
    prisma.storefrontProfile.findUnique({ where: { siteId } }),
    prisma.livePage.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.themePage.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.product.findMany({ where: { siteId }, include: { prices: true }, orderBy: { id: "asc" } }),
    prisma.creativePackCategory.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.creativePack.findMany({ where: { siteId }, orderBy: { id: "asc" } }),
    prisma.toolCategory.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.toolMenuItem.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.videoThemeCategory.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.videoTheme.findMany({ where: { siteId }, orderBy: { slug: "asc" } }),
    prisma.videoThemeExample.findMany({ where: { siteId }, orderBy: { id: "asc" } }),
    prisma.videoThemeSlugRedirect.findMany({ where: { siteId }, orderBy: { oldSlug: "asc" } }),
    prisma.mediaAsset.findMany({ where: { siteId }, orderBy: { storageKey: "asc" } }),
    prisma.siteTheme.findMany({ where: { siteId }, orderBy: { id: "asc" } }),
    prisma.siteAiApp.findMany({ where: { siteId }, include: { aiApp: true }, orderBy: { routeKey: "asc" } })
  ]);
  return { site, domains, settings, profile, livePages, themePages, products, packCategories, packs, toolCategories, toolItems, videoCategories, videos, examples, redirects, media, siteThemes, siteAiApps };
}

function assertSlugParity(sourceRows, targetRows, label) {
  const sourceActive = new Set(active(sourceRows).map((row) => row.slug));
  const targetActive = new Set(active(targetRows).map((row) => row.slug));
  const missing = setDifference(sourceActive, targetActive);
  const extra = setDifference(targetActive, sourceActive);
  if (missing.length || extra.length) fail(`${label} active slug mismatch`, { missing, extra });
}

function assertPageParity(sourceRows, targetRows, label, allowedTargetExtras = []) {
  const sourceSlugs = new Set(sourceRows.map((row) => row.slug));
  const targetSlugs = new Set(targetRows.map((row) => row.slug));
  const missing = setDifference(sourceSlugs, targetSlugs);
  const extra = setDifference(targetSlugs, sourceSlugs).filter((slug) => !allowedTargetExtras.includes(slug));
  if (missing.length || extra.length) fail(`${label} canonical slug mismatch`, { missing, extra });
}

function checkTargetText(state) {
  const sourceLeaks = /MyDreamShoots|mydreamshoots\.com|support@mydreamshoots\.com|assets\/dreamshoot|site_dreamshoot/i;
  const chinese = /[\u3400-\u9fff]/;
  const strongEnglish = /\b(?:from the|your private|private photo|source photos?|create your|choose a|upload your|view all|learn more|stay connected|generation jobs?|checkout history|customer account|travel package choice)\b/i;
  for (const { value, path: pathName } of values(publicPayload(state))) {
    if (/(?:^|\.)id$|(?:^|\.)siteId$|(?:^|\.)themeId$|(?:^|\.)productId$|(?:^|\.)featuredProductId$|(?:^|\.)categoryId$|(?:^|\.)parentId$|(?:^|\.)stripePriceId$|(?:^|\.)routeKey$|(?:^|\.)storageKey$|(?:^|\.)createdBy$|(?:^|\.)source$|(?:^|\.)etag$/.test(pathName)) continue;
    if (/(?:\.skin_|\.threads|\.youtube|\.pinterest|\.card_name)/.test(pathName)) continue;
    if (/(?:\.prompt|\.notes|\.modelPricing|\.workflowConfig|\.providerConfig)(?:$|\.)/.test(pathName)) continue;
    if (/^\$\.siteThemes\[/.test(pathName) && /(?:\.id|\.siteId|\.themeId|\.createdBy|\.source|\.settings\.settings_data\.current\.threads|\.settings\.settings_data\.current\.youtube|\.settings\.settings_data\.current\.pinterest|\.settings\.settings_data\.current\.skin_|\.settings\.globalSections\.)/.test(pathName)) continue;
    if (sourceLeaks.test(value)) fail("target public payload leaks source brand/domain/path", { path: pathName, value: value.slice(0, 220) });
    if (chinese.test(value)) fail("target public payload contains Chinese customer-visible text", { path: pathName, value: value.slice(0, 220) });
    if (strongEnglish.test(value) && !/^https?:\/\//i.test(value)) warn("possible English customer copy remains", { path: pathName, value: value.slice(0, 220) });
  }
}

function checkMediaFiles(state) {
  const missing = [];
  for (const asset of state.media) {
    const urls = [asset.previewUrl, asset.originUrl].filter(Boolean);
    for (const url of urls) {
      if (!url.startsWith("/assets/sites/site_aidreamshoots/")) fail("target media URL is outside target asset scope", { id: asset.id, url });
      const relative = url.split("?")[0].replace(/^\//, "");
      const filePath = path.join(process.cwd(), "public", relative);
      if (relative.includes("..") || !fs.existsSync(filePath)) missing.push({ id: asset.id, url });
    }
  }
  if (missing.length) fail("target media references missing files", missing.slice(0, 20));
}

function checkHomeStructure(source, target) {
  const sourcePage = source.livePages.find((page) => page.slug === "/");
  const targetPage = target.livePages.find((page) => page.slug === "/");
  if (!sourcePage || !targetPage) {
    fail("home LivePage is missing", { source: Boolean(sourcePage), target: Boolean(targetPage) });
    return;
  }
  const sourceJson = sourcePage.contentJson ?? {};
  const targetJson = targetPage.contentJson ?? {};
  const sourceOrder = Array.isArray(sourceJson.sectionsOrder) ? sourceJson.sectionsOrder : [];
  const targetOrder = Array.isArray(targetJson.sectionsOrder) ? targetJson.sectionsOrder : [];
  if (JSON.stringify(sourceOrder) !== JSON.stringify(targetOrder)) fail("home section order mismatch", { source: sourceOrder, target: targetOrder });
  const sourceTypes = sourceOrder.map((id) => sourceJson.sections?.[id]?.type ?? null);
  const targetTypes = targetOrder.map((id) => targetJson.sections?.[id]?.type ?? null);
  if (JSON.stringify(sourceTypes) !== JSON.stringify(targetTypes)) fail("home section type mismatch", { source: sourceTypes, target: targetTypes });
  for (const id of sourceOrder) {
    const sourceBlocks = sourceJson.sections?.[id]?.blocks ?? [];
    const targetBlocks = targetJson.sections?.[id]?.blocks ?? [];
    if (sourceBlocks.length !== targetBlocks.length) fail("home section block count mismatch", { section: id, source: sourceBlocks.length, target: targetBlocks.length });
  }
}

try {
  const [source, target] = await Promise.all([readSite(SOURCE), readSite(TARGET)]);
  if (!target.site || target.site.primaryDomain !== TARGET_DOMAIN || target.site.slug !== "aidreamshoots") fail("target site identity/domain is incorrect", target.site);
  if (!target.domains.some((domain) => domain.domain === TARGET_DOMAIN && domain.isPrimary && domain.status === "active")) fail("target primary domain row is missing or inactive", target.domains);
  assertPageParity(source.livePages, target.livePages, "LivePage", ["/collections", "/tools"]);
  assertPageParity(source.themePages, target.themePages, "ThemePage", ["/collections", "/tools"]);
  if (!target.livePages.some((page) => page.slug === "/collections")) fail("Spanish collection compatibility LivePage is missing");
  if (!target.themePages.some((page) => page.slug === "/collections")) fail("Spanish collection compatibility ThemePage is missing");
  if (!target.livePages.some((page) => page.slug === "/tools")) fail("Spanish tools compatibility LivePage is missing");
  if (!target.themePages.some((page) => page.slug === "/tools")) fail("Spanish tools compatibility ThemePage is missing");
  checkHomeStructure(source, target);
  assertSlugParity(source.packCategories, target.packCategories, "creative pack category");
  assertSlugParity(source.videoCategories, target.videoCategories, "video category");
  assertSlugParity(source.videos, target.videos, "video theme");
  const sourceActivePacks = active(source.packs).length;
  const targetActivePacks = active(target.packs).length;
  if (sourceActivePacks !== targetActivePacks) fail("active creative pack count mismatch", { source: sourceActivePacks, target: targetActivePacks });
  const sourceActiveMedia = source.media.length;
  if (target.media.length !== sourceActiveMedia) fail("media count mismatch", { source: sourceActiveMedia, target: target.media.length });
  const sourceActiveExamples = active(source.examples).length;
  const targetActiveExamples = active(target.examples).length;
  if (sourceActiveExamples !== targetActiveExamples) fail("active video example count mismatch", { source: sourceActiveExamples, target: targetActiveExamples });
  if (target.siteAiApps.some((app) => app.providerConfig && app.providerConfig.secret)) fail("target SiteAiApp contains a copied provider secret");
  checkTargetText(target);
  checkMediaFiles(target);
  const result = {
    ok: failures.length === 0,
    createdAt: new Date().toISOString(),
    sourceSiteId: SOURCE,
    targetSiteId: TARGET,
    targetDomain: TARGET_DOMAIN,
    sourcePublicHash: digest(publicPayload(source)),
    targetPublicHash: digest(publicPayload(target)),
    counts: {
      source: { livePages: source.livePages.length, themePages: source.themePages.length, packCategories: source.packCategories.length, packs: source.packs.length, videoCategories: source.videoCategories.length, videos: source.videos.length, media: source.media.length },
      target: { livePages: target.livePages.length, themePages: target.themePages.length, packCategories: target.packCategories.length, packs: target.packs.length, videoCategories: target.videoCategories.length, videos: target.videos.length, media: target.media.length }
    },
    warnings
  };
  if (reportPathArg) {
    const reportPath = path.resolve(process.cwd(), reportPathArg);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ ...result, failures }, null, 2)}\n`, { mode: 0o600 });
    result.reportPath = reportPath;
  }
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) {
    console.error(JSON.stringify({ failures }, null, 2));
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
