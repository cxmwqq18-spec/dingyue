import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const repoRoot = process.cwd();
const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/+$/, "");
const reportDir = path.join(repoRoot, "docs/audits/mydreamshoots-gpt10-2026-08-17/audit-closure");
const screenshotDir = path.join(reportDir, "screenshots");
fs.mkdirSync(screenshotDir, { recursive: true });

const taxonomy = JSON.parse(fs.readFileSync(path.join(repoRoot, "src/lib/mydreamshoots-theme-taxonomy.json"), "utf8"));
const pageCopyProfiles = JSON.parse(fs.readFileSync(path.join(repoRoot, "src/lib/photo-package-use-case-profiles.json"), "utf8")).mydreamshootsCategories ?? {};
const productSlugs = [...new Set((taxonomy.items ?? [])
  .filter((item) => item.slug !== "motion-generator")
  .map((item) => item.slug)
  .filter(Boolean))].sort();
const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 }
};
const policies = ["/privacy", "/refunds", "/terms"];
const checks = [];

function record(kind, route, viewport, data) {
  checks.push({ kind, route, viewport, ...data });
}

function expectedCanonical(route) {
  return `https://www.mydreamshoots.com${route}`;
}

async function gotoWithRetry(page, url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
      await page.waitForLoadState("networkidle", { timeout: 12_000 }).catch(() => undefined);
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 700));
    }
  }
  throw lastError;
}

async function inspectProduct(context, route, routeKind, viewportName, screenshot = false) {
  const prefix = routeKind === "site" ? "/site/mydreamshoots" : "";
  const url = `${baseUrl}${prefix}${route}`;
  const page = await context.newPage();
  const browserErrors = [];
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  page.on("pageerror", (error) => browserErrors.push(String(error)));
  let responseStatus = null;
  let navigationError = "";
  let signals = {};
  try {
    const response = await gotoWithRetry(page, url);
    responseStatus = response?.status() ?? null;
    signals = await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      const images = [...main.querySelectorAll("img")];
      const h1s = [...main.querySelectorAll("h1")];
      const headings = [...main.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((node) => ({
        level: Number(node.tagName.slice(1)),
        text: node.textContent?.replace(/\s+/g, " ").trim() || ""
      }));
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
        h1Count: h1s.length,
        h1: h1s[0]?.textContent?.replace(/\s+/g, " ").trim() || "",
        headings,
        bodyCharacters: main.textContent?.replace(/\s+/g, " ").trim().length || 0,
        imageCount: images.length,
        brokenImages: images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute("src") || ""),
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth
      };
    });
    if (screenshot) await page.screenshot({ path: path.join(screenshotDir, `${routeKind}-${viewportName}-${route.split("/").filter(Boolean).join("-")}.png`), fullPage: true });
  } catch (error) {
    navigationError = String(error);
  } finally {
    await page.close();
  }
  const failures = [];
  if (responseStatus !== 200) failures.push(`HTTP ${responseStatus}`);
  if (navigationError) failures.push(navigationError);
  if (signals.h1Count !== 1 || !signals.h1) failures.push(`H1 count/text invalid (${signals.h1Count}, ${signals.h1})`);
  const pageCopy = pageCopyProfiles[route.split("/").pop()];
  if (pageCopy) {
    if (signals.headings?.[0]?.level !== 1 || signals.headings?.[0]?.text !== pageCopy.headline) {
      failures.push(`first heading invalid (${signals.headings?.[0]?.level ?? "missing"}, ${signals.headings?.[0]?.text ?? ""})`);
    }
    if (!signals.headings?.some((heading) => heading.level === 2 && heading.text === pageCopy.galleryTitle)) {
      failures.push(`gallery title is not H2 (${pageCopy.galleryTitle})`);
    }
    if (signals.headings?.some((heading) => heading.level === 1 && heading.text === pageCopy.galleryTitle)) {
      failures.push("gallery title must not be H1");
    }
  }
  if (!signals.title || !signals.description) failures.push("title or description missing");
  if (signals.canonical !== expectedCanonical(route)) failures.push(`canonical ${signals.canonical || "<missing>"}`);
  if (signals.bodyCharacters < 250) failures.push(`body too short (${signals.bodyCharacters})`);
  if (signals.brokenImages.length) failures.push(`broken images ${signals.brokenImages.join(", ")}`);
  if (signals.scrollWidth > signals.viewportWidth + 1) failures.push(`horizontal overflow ${signals.scrollWidth}/${signals.viewportWidth}`);
  record("product", route, viewportName, { routeKind, url, status: responseStatus, ...signals, warnings: browserErrors, failures });
}

async function inspectVideoRoot(context, routeKind, viewportName) {
  const route = "/ai-video-generation";
  const prefix = routeKind === "site" ? "/site/mydreamshoots" : "";
  const url = `${baseUrl}${prefix}${route}`;
  const page = await context.newPage();
  let status = null;
  let signals = {};
  let error = "";
  try {
    const response = await gotoWithRetry(page, url);
    status = response?.status() ?? null;
    signals = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
      h1s: [...document.querySelectorAll("main h1")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean)
    }));
  } catch (caught) {
    error = String(caught);
  } finally {
    await page.close();
  }
  const failures = [];
  if (status !== 200) failures.push(`HTTP ${status}`);
  if (error) failures.push(error);
  if (signals.h1s?.length !== 1 || signals.h1s[0] !== "AI Video Generation") failures.push(`H1 ${JSON.stringify(signals.h1s)}`);
  if (!signals.title || !signals.description) failures.push("title or description missing");
  if (signals.canonical !== expectedCanonical(route)) failures.push(`canonical ${signals.canonical || "<missing>"}`);
  record("video-root", route, viewportName, { routeKind, url, status, ...signals, failures });
}

async function inspectPolicy(context, routeKind, viewportName, route) {
  const prefix = routeKind === "site" ? "/site/mydreamshoots" : "";
  const url = `${baseUrl}${prefix}${route}`;
  const page = await context.newPage();
  let status = null;
  let signals = {};
  let error = "";
  try {
    const response = await gotoWithRetry(page, url);
    status = response?.status() ?? null;
    signals = await page.evaluate(() => {
      const main = document.querySelector("main") || document.body;
      const description = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
      const visibleText = main.textContent?.replace(/\s+/g, " ").trim() || "";
      const policyText = `${description} ${visibleText}`;
      const unverifiedClaimPatterns = [
        ["absolute training claim", /(?:no ai training|never used to train models|does not use your photos for model training)/i],
        ["fixed source-photo deletion claim", /(?:30-day auto-delete|automatically delete 30 days|auto-delete 30 days)/i],
        ["unverified encryption claim", /(?:AES-256|TLS 256-bit)/i],
        ["absolute refund claim", /100% money-back guarantee/i]
      ];
      return {
        title: document.title,
        description,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
        robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") || "",
        h1s: [...main.querySelectorAll("h1")].map((node) => node.textContent?.replace(/\s+/g, " ").trim()).filter(Boolean),
        bodyCharacters: visibleText.length,
        unverifiedClaims: unverifiedClaimPatterns.filter(([, pattern]) => pattern.test(policyText)).map(([label]) => label),
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth
      };
    });
  } catch (caught) {
    error = String(caught);
  } finally {
    await page.close();
  }
  const failures = [];
  if (status !== 200) failures.push(`HTTP ${status}`);
  if (error) failures.push(error);
  if (signals.h1s?.length !== 1) failures.push(`H1 count ${signals.h1s?.length ?? 0}`);
  if (!signals.title || !signals.description) failures.push("title or description missing");
  if (!signals.bodyCharacters || signals.bodyCharacters < 500) failures.push(`body too short (${signals.bodyCharacters ?? 0})`);
  if (signals.canonical !== expectedCanonical(route)) failures.push(`canonical ${signals.canonical || "<missing>"}`);
  if (!/\bindex\b/i.test(signals.robots) || !/\bfollow\b/i.test(signals.robots)) failures.push(`robots ${signals.robots || "<missing>"}`);
  if (signals.unverifiedClaims?.length) failures.push(`unverified policy claims: ${signals.unverifiedClaims.join(", ")}`);
  if (signals.scrollWidth > signals.viewportWidth + 1) failures.push(`horizontal overflow ${signals.scrollWidth}/${signals.viewportWidth}`);
  record("policy", route, viewportName, { routeKind, url, status, ...signals, failures });
}

async function inspectFooter(context, routeKind, viewportName) {
  const route = "/";
  const prefix = routeKind === "site" ? "/site/mydreamshoots" : "";
  const url = `${baseUrl}${prefix}${route}`;
  const page = await context.newPage();
  let status = null;
  let signals = {};
  let error = "";
  try {
    const response = await gotoWithRetry(page, url);
    status = response?.status() ?? null;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    signals = await page.evaluate(() => {
      const footer = document.querySelector("footer");
      const links = [...(footer?.querySelectorAll("a") ?? [])].map((link) => ({
        href: link.getAttribute("href") || "",
        rel: link.getAttribute("rel") || ""
      }));
      return {
        internalNofollow: links.filter((link) => link.href.startsWith("/") && /\bnofollow\b/i.test(link.rel)),
        externalMissingRel: links.filter((link) => /^https?:\/\//i.test(link.href) && !/\bnofollow\b/i.test(link.rel) && !/\bnoopener\b/i.test(link.rel))
      };
    });
  } catch (caught) {
    error = String(caught);
  } finally {
    await page.close();
  }
  const failures = [];
  if (status !== 200) failures.push(`HTTP ${status}`);
  if (error) failures.push(error);
  if (signals.internalNofollow?.length) failures.push(`internal nofollow: ${JSON.stringify(signals.internalNofollow)}`);
  if (signals.externalMissingRel?.length) failures.push(`external rel missing: ${JSON.stringify(signals.externalMissingRel)}`);
  record("footer", route, viewportName, { routeKind, url, status, ...signals, failures });
}

const browser = await chromium.launch({ headless: true });
try {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    for (const routeKind of ["host", "site"]) {
      const context = await browser.newContext({
        viewport,
        ...(routeKind === "host" ? { extraHTTPHeaders: { "x-forwarded-host": "www.mydreamshoots.com" } } : {})
      });
      try {
        for (const slug of productSlugs) {
          const route = `/ai-image-generation/${slug}`;
          await inspectProduct(context, route, routeKind, viewportName, slug === "headshot" || slug === "virtual-try-on");
        }
        await inspectVideoRoot(context, routeKind, viewportName);
        for (const route of policies) await inspectPolicy(context, routeKind, viewportName, route);
        await inspectFooter(context, routeKind, viewportName);
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

const failures = checks.filter((check) => check.failures.length);
const report = {
  status: "local-only-not-published",
  baseUrl,
  productCount: productSlugs.length,
  routeKinds: ["host", "site"],
  viewports,
  checkCount: checks.length,
  failureCount: failures.length,
  failures,
  checks
};
fs.writeFileSync(path.join(reportDir, "playwright-report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  ok: failures.length === 0,
  status: report.status,
  productCount: report.productCount,
  checkCount: report.checkCount,
  failureCount: report.failureCount,
  report: path.relative(repoRoot, path.join(reportDir, "playwright-report.json"))
}, null, 2));
if (failures.length) process.exitCode = 1;
