#!/usr/bin/env node

import assert from "node:assert/strict";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const BASE_URL = "http://127.0.0.1:3002/site/aidreamshoots";
const NON_PUBLIC_PATHS = new Set([
  "/ai-video-generation/image-to-video",
  "/ai-video-generation/text-to-video",
  "/partner-registration",
  "/404"
]);
const ALIAS_PATHS = new Set(["/collections", "/tools"]);
const PRIVATE_PATH = /^(?:\/app(?:\/|$)|\/account$|\/cart$|\/dashboard$|\/login$|\/reset-password$)/i;
const CORRUPT_COPY = [
  /^Contenido de AIdreamshoots$/i,
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

async function gotoWithRetry(page, url) {
  let lastError;
  // Next.js may restart the local dev server after a full-site crawl crosses
  // its memory threshold. Keep the browser audit resilient to that transient.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 7) await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  throw lastError;
}

const prisma = new PrismaClient();
const browser = await chromium.launch({ headless: true });
const issues = [];
try {
  const [themePages, livePages] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true } })
  ]);
  const paths = [...new Set([...themePages, ...livePages].map((row) => normalizePath(row.slug)))].sort();
  const context = await browser.newContext({ locale: "es-ES" });
  const page = await context.newPage();
  for (const path of paths) {
    if (NON_PUBLIC_PATHS.has(path)) continue;
    try {
      const response = await gotoWithRetry(page, `${BASE_URL}${path}`);
      const status = response?.status() ?? 0;
      if (status < 200 || status >= 400) {
        issues.push({ type: "status", path, status });
        continue;
      }
      const lang = await page.locator("html").getAttribute("lang");
      const htmlTranslate = await page.locator("html").getAttribute("translate");
      const bodyTranslate = await page.locator("body").getAttribute("translate");
      if (lang !== "es") issues.push({ type: "lang", path, value: lang });
      if (htmlTranslate !== "yes" || bodyTranslate !== "yes") issues.push({ type: "translate", path, htmlTranslate, bodyTranslate });
      if (await page.locator('meta[name="google"][content*="notranslate" i], .notranslate').count()) issues.push({ type: "translate_blocker", path });
      const bodyText = await page.locator("body").innerText();
      for (const pattern of CORRUPT_COPY) if (pattern.test(bodyText)) issues.push({ type: "corrupt_copy", path, pattern: String(pattern) });
      if (!PRIVATE_PATH.test(path) && !ALIAS_PATHS.has(path)) {
        const title = await page.title();
        const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
        const jsonLdCount = await page.locator('script[type="application/ld+json"]').count();
        if (!title.trim()) issues.push({ type: "seo_title", path });
        if (!canonical || !canonical.includes("aidreamshoots.eu")) issues.push({ type: "canonical", path, canonical });
        if (!jsonLdCount) issues.push({ type: "json_ld", path });
      } else if (ALIAS_PATHS.has(path)) {
        const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
        const expectedPath = path === "/collections" ? "/ai-image-generation" : "/ai-video-generation";
        if (!canonical || !canonical.includes("aidreamshoots.eu" + expectedPath)) issues.push({ type: "alias_canonical", path, canonical, expectedPath });
      }
    } catch (error) {
      issues.push({ type: "browser_error", path, error: String(error?.message ?? error) });
    }
  }
  const report = { ok: issues.length === 0, checked: paths.length, skipped: [...NON_PUBLIC_PATHS], issueCounts: Object.fromEntries([...new Set(issues.map((item) => item.type))].map((type) => [type, issues.filter((item) => item.type === type).length])), issues: issues.slice(0, 200) };
  console.log(JSON.stringify(report, null, 2));
  assert.equal(issues.length, 0, `AIdreamshoots browser audit failed: ${JSON.stringify(issues.slice(0, 10))}`);
} finally {
  await browser.close();
  await prisma.$disconnect();
}
