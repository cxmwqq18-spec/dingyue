#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { buildTunneledReadonlyDatabaseUrl, assertDatabaseTarget, assertAllowedSite } from "./lib/database-target.mjs";

const siteId = assertAllowedSite(process.env.RELEASE_SITE_ID || "site_dreamshoot");
const buildPath = process.env.SEASONAL_BUILD_OUTPUT || "/tmp/seasonal-remediation.json";
const outPath = process.env.SEASONAL_RELEASE_MANIFEST || path.join(process.cwd(), "releases/manifests/mothers-fathers-remediation.json");
assertDatabaseTarget({ expectedTarget: "remote-readonly", env: { ...process.env, DATABASE_TARGET: "remote-readonly", DINGYUE_ENV: "remote-readonly", DATABASE_URL: buildTunneledReadonlyDatabaseUrl(process.env.REMOTE_DB_READONLY_DATABASE_URL) } });
const prisma = new PrismaClient({ datasources: { db: { url: buildTunneledReadonlyDatabaseUrl(process.env.REMOTE_DB_READONLY_DATABASE_URL) } } });
const build = JSON.parse(fs.readFileSync(buildPath, "utf8"));
const targetPages = new Map(build.pages.filter((page) => ["mothers-day", "fathers-day", "halloween"].includes(page.key)).map((page) => [page.pagePath, page]));
const git = (args) => { try { return execFileSync("git", args, { encoding: "utf8" }).trim(); } catch { return "unknown"; } };
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const stable = (value) => value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(stable).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
const hash = (value) => createHash("sha256").update(stable(value)).digest("hex");
const tables = ["toolCategories", "toolMenuItems", "creativePackCategories", "creativePacks", "videoThemeCategories", "videoThemes", "themePages", "themeSettings", "siteThemes", "themePublications", "mediaAssets", "products", "prices"];
function normalizeRows(rows) { return rows.map((row) => clone(row)).sort((a, b) => stable(a).localeCompare(stable(b))); }
function pageIdFor(pathname) { return `page_${siteId}_${pathname.split("/").filter(Boolean).join("_")}`; }
function mediaIdFor(pathname, filename) { return `media_${siteId}_${pathname.split("/").filter(Boolean).join("_")}_${filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`; }

try {
  // The production read-only tunnel intentionally exposes a small connection
  // pool. Read the release baseline sequentially so manifest generation does
  // not exhaust that pool before the content diff is built.
  const toolCategories = await prisma.toolCategory.findMany({ where: { siteId } });
  const toolMenuItems = await prisma.toolMenuItem.findMany({ where: { siteId } });
  const creativePackCategories = await prisma.creativePackCategory.findMany({ where: { siteId } });
  const creativePacks = await prisma.creativePack.findMany({ where: { siteId } });
  const videoThemeCategories = await prisma.videoThemeCategory.findMany({ where: { siteId } });
  const videoThemes = await prisma.videoTheme.findMany({ where: { siteId } });
  const themePages = await prisma.themePage.findMany({ where: { siteId } });
  const themeSettings = await prisma.themeSettings.findMany({ where: { siteId } });
  const siteThemes = await prisma.siteTheme.findMany({ where: { siteId } });
  const themePublications = await prisma.themePublication.findMany({ where: { siteId } });
  const mediaAssets = await prisma.mediaAsset.findMany({ where: { siteId } });
  const products = await prisma.product.findMany({ where: { siteId } });
  const prices = await prisma.price.findMany({ where: { product: { siteId } } });
  const pages = [...themePages];
  const assets = [...mediaAssets];
  const availablePaths = new Set(themePages.map((page) => page.slug));
  for (const [pathname, item] of targetPages) {
    const page = pages.find((candidate) => candidate.slug === pathname);
    const pageJson = item.pageJson;
    pageJson.relatedLinks = [
      { label: "How it works", href: availablePaths.has("/workflow") ? "/workflow" : "/best-save-the-date" },
      { label: "Explore Save the Date themes", href: availablePaths.has("/holidays-events/save-the-date") ? "/holidays-events/save-the-date" : "/best-save-the-date" }
    ].filter((link, index, links) => links.findIndex((candidate) => candidate.href === link.href) === index);
    const nextPage = { ...(page || { id: pageIdFor(pathname), siteId, pageType: "standard-content", templateKey: "seasonal-editorial", slug: pathname, createdAt: new Date().toISOString() }), pageType: "standard-content", templateKey: "seasonal-editorial", title: pageJson.seo?.h1 || pageJson.sections[pageJson.sectionsOrder[0]]?.settings?.title || item.key, draftJson: pageJson, publishedJson: pageJson, updatedAt: new Date().toISOString() };
    if (page) Object.assign(page, nextPage); else pages.push(nextPage);
    for (const image of pageJson.mediaManifest) {
      const existing = assets.find((candidate) => candidate.storageKey === image.src);
      const nextAsset = { ...(existing || { id: mediaIdFor(pathname, image.filename), siteId, label: image.filename, storageKey: image.src, mimeType: "image/jpeg", usageType: "theme", sourceType: `seasonal-${item.key}-source` }), previewUrl: image.src, originUrl: image.src, altText: image.alt, notes: image.caption, updatedAt: new Date().toISOString() };
      if (existing) Object.assign(existing, nextAsset); else assets.push(nextAsset);
    }
  }
  const settings = themeSettings[0] || { id: `settings_${siteId}`, siteId, draftJson: {}, publishedJson: {} };
  const current = settings.publishedJson || settings.draftJson || {};
  const navigation = current.saveTheDateNavigation || { menuLabel: "Save the Date", groups: [] };
  const existingItems = navigation.groups.flatMap((group) => group.items || []);
  const additions = [...targetPages.values()].map((item) => ({ label: item.key === "mothers-day" ? "Mother's Day" : item.key === "fathers-day" ? "Father's Day" : "Halloween", slug: item.key, href: item.pagePath, status: "published", sortOrder: 20 }));
  const merged = [...existingItems, ...additions].filter((item, index, values) => values.findIndex((candidate) => candidate.href === item.href) === index);
  const love = merged.filter((item) => ["/ai-save-the-date/valentines-day", "/holidays-events/engagement", "/holidays-events/proposal", "/holidays-events/save-the-date", "/ai-video-generation/wedding-ceremony"].includes(item.href)).map((item, index) => ({ ...item, sortOrder: index + 1 }));
  const seasonal = merged.filter((item) => item.href.startsWith("/holidays-events/") && !["/holidays-events/engagement", "/holidays-events/proposal", "/holidays-events/save-the-date"].includes(item.href)).map((item, index) => ({ ...item, sortOrder: index + 1 }));
  const nextSettings = { ...settings, draftJson: { ...current, saveTheDateNavigation: { menuLabel: "Save the Date", groups: [{ label: "Love & Wedding", slug: "love-wedding", sortOrder: 1, items: love }, { label: "Seasonal Holidays", slug: "seasonal-holidays", sortOrder: 2, items: seasonal }] } }, publishedJson: { ...current, saveTheDateNavigation: { menuLabel: "Save the Date", groups: [{ label: "Love & Wedding", slug: "love-wedding", sortOrder: 1, items: love }, { label: "Seasonal Holidays", slug: "seasonal-holidays", sortOrder: 2, items: seasonal }] } }, updatedAt: new Date().toISOString() };
  if (themeSettings.length) Object.assign(themeSettings[0], nextSettings); else themeSettings.push(nextSettings);
  const snapshot = { themePages: normalizeRows(pages), themeSettings: normalizeRows(themeSettings), mediaAssets: normalizeRows(assets) };
  const releaseId = process.env.SEASONAL_RELEASE_ID || `mothers-fathers-remediation-${Date.now()}`;
  const base = { formatVersion: 1, releaseId, codeCommit: git(["rev-parse", "HEAD"]), workingTreeDirty: true, sites: [siteId], scope: ["public-content", "navigation"], schemaMigrations: [], contentMigrations: [`${releaseId}:public-content`], replaceTables: [], protectedTables: ["customers", "customerSessions", "subscriptions", "orders", "paymentEvents", "creditBalances", "creditLedger", "generationJobs", "customerModels", "assetUploads", "albums"], tables: snapshot };
  const manifest = { ...base, createdAt: new Date().toISOString(), manifestHash: hash(base) };
  fs.mkdirSync(path.dirname(outPath), { recursive: true }); fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ ok: true, outPath, releaseId, manifestHash: manifest.manifestHash, baseline: { pages: themePages.length, mediaAssets: mediaAssets.length, publications: themePublications.length }, candidate: { pages: targetPages.size, mediaAssets: [...targetPages.values()].reduce((sum, item) => sum + item.pageJson.mediaManifest.length, 0) } }, null, 2));
} finally { await prisma.$disconnect(); }
