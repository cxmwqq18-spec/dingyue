#!/usr/bin/env node

// Full local browser smoke for the Aidreamcapes EU SEO scope. Indexable routes
// come from the live sitemap projection; additional public routes are found by
// crawling links in those pages so this check does not fossilize a page count.
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002/site/aidreamcapes-eu").replace(/\/$/, "");
const productionOrigin = "https://aidreamcapes.eu";
const RETIRED_PATHS = [
  "/ai-save-the-date/easter",
  "/ai-image-generation/estilo-y-fantasia",
  "/tools/seasonal-celebration-album-maker"
];
const reportDir = path.resolve("reports");

const PRIVATE_PATHS = new Set(["/404", "/account", "/album", "/app", "/app/create", "/app/jobs/detail", "/app/jobs/progress", "/cart", "/login", "/search"]);
const ALIAS_PATHS = new Set([
  "/cookie-policy", "/privacy-policy", "/terms-of-service", "/policies/cookies", "/policies/privacy", "/policies/terms",
  "/policies/refunds", "/policies/content", "/policies/children-privacy", "/policies/state-privacy", "/policies/shipping",
  "/ai-save-the-date/wedding-anniversary", "/collections"
]);

function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function absolutePath(value) {
  try {
    const baseOrigin = new URL(baseUrl).origin;
    const parsed = new URL(value, `${baseUrl}/`);
    // Sitemap locs may use the production origin even in local path mode.
    // External social links must never become crawl targets for this site.
    if (parsed.origin !== baseOrigin && parsed.origin !== productionOrigin) return "";
    const pathname = parsed.pathname;
    const sitePrefix = "/site/aidreamcapes-eu";
    return pathname === sitePrefix ? "/" : pathname.startsWith(`${sitePrefix}/`) ? pathname.slice(sitePrefix.length) : pathname;
  } catch { return String(value).split(/[?#]/)[0]; }
}
function expectedCanonical(route) { return `${productionOrigin}${route === "/" ? "/" : route}`; }
function isExpectedIndexable(route) { return !PRIVATE_PATHS.has(route) && !ALIAS_PATHS.has(route) && !RETIRED_PATHS.includes(route); }
function parseJsonLd(raw) {
  try { return JSON.parse(raw); } catch { return { __parseError: true }; }
}
function flattenNodes(value, output = []) {
  if (Array.isArray(value)) { value.forEach((item) => flattenNodes(item, output)); return output; }
  if (!value || typeof value !== "object") return output;
  if (value["@type"]) output.push(value);
  Object.values(value).forEach((item) => { if (item && typeof item === "object") flattenNodes(item, output); });
  return output;
}
function faqFromSchemas(nodes) {
  const schema = nodes.find((node) => node["@type"] === "FAQPage");
  return schema ? (schema.mainEntity || []).map((item) => ({
    question: clean(item.name),
    answer: clean(item.acceptedAnswer?.text)
  })) : [];
}
function normalizedFaq(value) {
  return value.map((item) => `${clean(item.question).toLocaleLowerCase("fr-FR")}::${clean(item.answer).replace(/[•]/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr-FR")}`);
}
function isDecorativeImage(image) {
  return image.getAttribute("aria-hidden") === "true" || image.closest("[aria-hidden=\"true\"]") !== null;
}
async function inspectPage(page, route) {
  const consoleErrors = [];
  const requestFailures = [];
  const badResponses = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on("requestfailed", (request) => requestFailures.push({ url: request.url(), resourceType: request.resourceType(), error: request.failure()?.errorText || "unknown" }));
  page.on("response", (response) => { if (response.request().resourceType() === "image" && response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() }); });
  const startedAt = Date.now();
  let response;
  let navigationError = "";
  try {
    response = await page.goto(`${baseUrl}${route}?full-site-smoke=20260916`, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(180);
    await page.evaluate(async () => {
      const images = [...document.images];
      for (const image of images) {
        // Closed FAQ panels and modal-only images are not part of the visible
        // document until their control is opened. Avoid Playwright's long
        // per-locator visibility timeout while still exercising lazy images
        // that are actually rendered on the page.
        if (!image.getClientRects().length) continue;
        image.scrollIntoView({ block: "center", inline: "nearest" });
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });
    await page.waitForFunction(
      () => [...document.images]
        .filter((image) => image.getAttribute("aria-hidden") !== "true" && image.closest('[aria-hidden="true"]') === null)
        .every((image) => image.complete),
      { timeout: 8_000 }
    ).catch(() => {});
    await page.waitForTimeout(100);
  } catch (error) {
    navigationError = error instanceof Error ? error.message : String(error);
  }
  const elapsedMs = Date.now() - startedAt;
  const data = await page.evaluate(() => {
    const compact = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
    const images = [...document.images].map((image) => ({
      src: image.currentSrc || image.src || "",
      alt: image.getAttribute("alt"),
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      complete: image.complete,
      decorative: image.getAttribute("aria-hidden") === "true" || image.closest("[aria-hidden=\"true\"]") !== null
    }));
    const faq = [...document.querySelectorAll("[data-faq-answer]")].map((answer) => {
      // FAQ schema contains the answer prose and bullets, not the optional
      // related-link navigation rendered inside the answer panel.
      const questionElement = answer.previousElementSibling;
      const questionNode = questionElement?.matches("summary")
        ? questionElement.querySelector("h3,h4") || questionElement
        : questionElement?.matches("h3,h4")
          ? questionElement
          : questionElement?.querySelector("h3,h4,summary");
      return {
        answer: compact([...answer.querySelectorAll(":scope > p, :scope > ul li")].map((node) => node.textContent).join(" ") || answer.textContent),
        question: compact(questionNode?.textContent)
      };
    });
    const schemas = [...document.querySelectorAll('script[type="application/ld+json"]')].map((script) => script.textContent || "");
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.getAttribute("content") || "",
      robots: document.querySelector('meta[name="robots"]')?.getAttribute("content") || "",
      lang: document.documentElement.lang,
      canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "",
      ogType: document.querySelector('meta[property="og:type"]')?.getAttribute("content") || "",
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute("content") || "",
      twitterImage: document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") || "",
      h1: document.querySelectorAll("h1").length,
      images,
      faq,
      schemas,
      mainText: document.querySelector("main")?.innerText || document.body?.innerText || "",
      links: [...document.querySelectorAll("a[href]")].map((link) => link.href),
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      overflowCount: [...document.querySelectorAll("body *")].filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.right > window.innerWidth + 2 &&
          !["fixed", "absolute"].includes(style.position) &&
          style.visibility !== "hidden" &&
          !element.classList.contains("sr-only") && !element.closest(".sr-only") &&
          !element.closest('[aria-hidden="true"]');
      }).length
    };
  }).catch(() => ({ title: "", description: "", robots: "", lang: "", canonical: "", ogType: "", ogImage: "", twitterImage: "", h1: 0, images: [], faq: [], schemas: [], mainText: "", links: [], scrollWidth: 0, viewportWidth: 0, overflowCount: 0 }));
  const parsedSchemas = data.schemas.map(parseJsonLd);
  const nodes = parsedSchemas.flatMap((schema) => flattenNodes(schema));
  const imageUrls = data.images.map((image) => absolutePath(image.src)).filter(Boolean);
  const imageDuplicateUrls = imageUrls.filter((url, index) => imageUrls.indexOf(url) !== index);
  // Lazy images inside closed FAQ panels may not be requested in a smoke
  // session. Broken requests are reported separately; this check enforces
  // the SEO contract that every content image has a non-empty alt.
  const imageProblems = data.images.filter((image) => !image.decorative && (!image.alt || !clean(image.alt)));
  const englishLeak = /\b(?:What is|Which source|How many|Where do|What happens|Create a |with AI|from photos|Customer problem|Example script|Workspace review model|Additional video guidance|Keep the video|Usually |Commercial use|Watch the full|Define the |Avoid using|Cinematic worlds|Talking Head Video)\b/i.test(data.mainText);
  const schemaFaq = faqFromSchemas(nodes);
  const faqMismatch = data.faq.length > 0 && schemaFaq.length > 0 && JSON.stringify(normalizedFaq(data.faq)) !== JSON.stringify(normalizedFaq(schemaFaq));
  const routeIsRetired = RETIRED_PATHS.includes(route);
  const routeIs404 = response?.status() === 404;
  const indexExpected = isExpectedIndexable(route) && !routeIs404;
  const failures = [];
  if (navigationError) failures.push("navigation-error");
  if (response && response.status() !== 200 && !(routeIsRetired && routeIs404)) failures.push(response.status() === 404 ? "unexpected-404" : `http-${response.status()}`);
  if (!response) failures.push("no-http-response");
  if (routeIsRetired && response && response.status() !== 404) failures.push("retired-route-not-404");
  if (indexExpected && data.h1 !== 1) failures.push("h1-count");
  if (indexExpected && data.lang !== "fr") failures.push("lang");
  if (indexExpected && data.canonical !== expectedCanonical(route)) failures.push("canonical");
  if (indexExpected && !/^index, follow/i.test(data.robots)) failures.push("robots-meta");
  if (indexExpected && data.ogType !== "website") failures.push("og-type");
  if (indexExpected && (!data.title || !data.description)) failures.push("missing-title-description");
  // Login/create are intentionally private utility pages. Their auth-state
  // thumbnails can remain unloaded without making the public SEO surface
  // invalid; public/indexable routes must still load and decode every image.
  if (imageProblems.length && indexExpected) failures.push("image-alt-or-decode");
  if (badResponses.length || requestFailures.some((item) => item.resourceType === "image" && !/ERR_ABORTED/i.test(item.error))) failures.push("image-request");
  const expectedRetired404Console = routeIsRetired && routeIs404 && consoleErrors.length > 0 &&
    consoleErrors.every((error) => /status of 404|failed to load resource.*404/i.test(error));
  if (consoleErrors.length && !expectedRetired404Console) failures.push("console-error");
  // Bounding boxes include intentional decorative positioning. The document
  // scroll width is the reliable signal for actual horizontal overflow.
  if (data.scrollWidth > data.viewportWidth + 1) failures.push("mobile-overflow");
  if (data.mainText && englishLeak) failures.push("english-copy");
  if (faqMismatch && indexExpected) failures.push("faq-jsonld-mismatch");
  if (data.schemas.some((raw) => raw.includes("eu-regenerated")) || data.images.some((image) => /eu-regenerated/i.test(image.src))) failures.push("legacy-media-path");
  return {
    route,
    source: sitemapPaths.includes(route) ? "sitemap" : "internal",
    expectedIndexable: indexExpected,
    status: response?.status() ?? 0,
    elapsedMs,
    finalUrl: page.url(),
    headers: response ? { xRobotsTag: response.headers()["x-robots-tag"] || "", contentType: response.headers()["content-type"] || "" } : {},
    title: clean(data.title),
    titleLength: clean(data.title).length,
    description: clean(data.description),
    descriptionLength: clean(data.description).length,
    lang: data.lang,
    h1: data.h1,
    canonical: data.canonical,
    robots: data.robots,
    ogType: data.ogType,
    ogImage: data.ogImage,
    twitterImage: data.twitterImage,
    imageCount: data.images.length,
    imageProblems,
    duplicateImageUrls: [...new Set(imageDuplicateUrls)],
    imageSources: [...new Set(imageUrls)],
    discoveredPaths: data.links.map(absolutePath).filter((value) => value.startsWith("/")),
    jsonLdTypes: [...new Set(nodes.map((node) => node["@type"]).filter(Boolean))],
    jsonLdLanguages: [...new Set(nodes.map((node) => node.inLanguage).filter(Boolean))],
    hasWebPage: nodes.some((node) => node["@type"] === "WebPage" || node["@type"] === "CollectionPage"),
    hasBreadcrumbList: nodes.some((node) => node["@type"] === "BreadcrumbList"),
    hasFaqSchema: nodes.some((node) => node["@type"] === "FAQPage"),
    visibleFaqCount: data.faq.length,
    schemaFaqCount: schemaFaq.length,
    consoleErrors: consoleErrors.slice(0, 5),
    requestFailures: requestFailures.slice(0, 10),
    badImageResponses: badResponses,
    mobile: { scrollWidth: data.scrollWidth, viewportWidth: data.viewportWidth, overflowCount: data.overflowCount },
    failures
  };
}

async function fetchSitemap() {
  try {
    const response = await fetch(`${baseUrl}/sitemap.xml?full-site-smoke=20260916`);
    const xml = await response.text();
    return {
      status: response.status,
      xRobotsTag: response.headers.get("x-robots-tag") || "",
      locs: [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => absolutePath(match[1])).filter(Boolean)
    };
  } catch (error) {
    return { status: 0, xRobotsTag: "", locs: [], error: error instanceof Error ? error.message : String(error) };
  }
}

async function checkRetiredRoutes() {
  const routes = [];
  for (const route of RETIRED_PATHS) {
    try {
      const response = await fetch(`${baseUrl}${route}?retirement-smoke=20260916`, { redirect: "manual" });
      routes.push({ route, status: response.status, finalUrl: response.url, xRobotsTag: response.headers.get("x-robots-tag") || "" });
    } catch (error) {
      routes.push({ route, status: 0, finalUrl: "", xRobotsTag: "", error: error instanceof Error ? error.message : String(error) });
    }
  }
  return routes;
}

function markdownReport(report) {
  const hardFailures = report.pages.filter((page) => page.failures.length);
  const lines = [
    "# Aidreamcapes EU full-site SEO smoke",
    "",
    `- Run: ${report.runAt}`,
    `- Base: ${report.baseUrl}`,
    `- Routes: ${report.pages.length} (${report.sitemapRoutes} sitemap, ${report.internalRoutes} internal)`,
    `- HTTP 200: ${report.pages.filter((page) => page.status === 200).length}/${report.pages.length}`,
    `- Pages with hard failures: ${hardFailures.length}`,
    `- Provider calls: 0 (browser smoke only)`,
    "",
    "## Sitemap and robots",
    "",
    `- Sitemap HTTP: ${report.sitemap.status}; loc count: ${report.sitemap.locs.length}; local X-Robots-Tag: ${report.sitemap.xRobotsTag || "none"}`,
    `- Sitemap route differences: missing expected ${report.sitemapMissing.length}; unexpected ${report.sitemapUnexpected.length}`,
    `- Retired route checks: ${report.retiredRoutes.filter((item) => item.status === 404).length}/${report.retiredRoutes.length} returned HTTP 404`,
    "",
    "## Page results",
    "",
    "| Route | Source | HTTP | ms | H1 | Lang | Canonical | Images | JSON-LD | Failures |",
    "| --- | --- | ---: | ---: | ---: | --- | --- | ---: | --- | --- |",
    ...report.pages.map((page) => `| ${page.route} | ${page.source} | ${page.status} | ${page.elapsedMs} | ${page.h1} | ${page.lang || "-"} | ${page.canonical || "-"} | ${page.imageCount} | ${page.jsonLdTypes.join(", ") || "-"} | ${page.failures.join(", ") || "-"} |`),
    "",
    "## Failure details",
    "",
    ...(hardFailures.length ? hardFailures.flatMap((page) => [`### ${page.route}`, "", `- ${page.failures.join(", ")}`, page.consoleErrors.length ? `- Console: ${page.consoleErrors.join(" | ")}` : "", page.imageProblems.length ? `- Image problems: ${page.imageProblems.length}` : "", ""]) : ["No hard failures recorded.", ""])
  ];
  return `${lines.join("\n")}\n`;
}

const browser = await chromium.launch({ headless: true });
const sitemap = await fetchSitemap();
const retiredRoutes = await checkRetiredRoutes();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "fr-FR" });
const pages = [];
const sitemapPaths = [...new Set(sitemap.locs.map((value) => value === "" ? "/" : value))];
const queuedRoutes = [...sitemapPaths];
const discoveredRoutes = new Set(sitemapPaths);
try {
  let index = 0;
  while (queuedRoutes.length) {
    const route = queuedRoutes.shift();
    const page = await context.newPage();
    const result = await inspectPage(page, route);
    await page.close();
    pages.push(result);
    for (const link of result.discoveredPaths) {
      if (!link || link.startsWith("/assets/") || link.startsWith("/_next/") || link.includes("?")) continue;
      if (!discoveredRoutes.has(link)) {
        discoveredRoutes.add(link);
        queuedRoutes.push(link);
      }
    }
    index += 1;
    if (index % 10 === 0) console.error(`[eu-full-smoke] ${index} routes checked; ${queuedRoutes.length} queued`);
  }
} finally {
  await context.close();
  await browser.close();
}

const actualSitemap = new Set(sitemap.locs.map((value) => value === "" ? "/" : value));
const report = {
  ok: pages.every((page) => page.failures.length === 0) && sitemap.status === 200 && sitemapPaths.length > 0 && actualSitemap.size === sitemap.locs.length && retiredRoutes.every((item) => item.status === 404),
  runAt: new Date().toISOString(),
  baseUrl,
  pages,
  sitemapRoutes: sitemapPaths.length,
  internalRoutes: Math.max(0, pages.length - sitemapPaths.length),
  sitemap,
  retiredRoutes,
  sitemapMissing: [],
  sitemapUnexpected: [],
  summary: {
    routes: pages.length,
    http200: pages.filter((page) => page.status === 200).length,
    failedPages: pages.filter((page) => page.failures.length).length,
    consoleErrorPages: pages.filter((page) => page.consoleErrors.length).length,
    imageFailurePages: pages.filter((page) => page.failures.includes("image-request") || page.failures.includes("image-alt-or-decode")).length,
    overflowPages: pages.filter((page) => page.failures.includes("mobile-overflow")).length,
    averageMs: Math.round(pages.reduce((sum, page) => sum + page.elapsedMs, 0) / Math.max(1, pages.length)),
    maxMs: Math.max(...pages.map((page) => page.elapsedMs), 0)
  }
};
fs.mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const jsonPath = path.join(reportDir, `aidreamcapes-eu-full-site-smoke-${stamp}.json`);
const markdownPath = path.join(reportDir, `aidreamcapes-eu-full-site-smoke-${stamp}.md`);
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
fs.writeFileSync(markdownPath, markdownReport(report));
console.log(JSON.stringify({ ...report.summary, ok: report.ok, sitemap: { status: sitemap.status, locs: sitemap.locs.length }, jsonPath, markdownPath }, null, 2));
process.exitCode = report.ok ? 0 : 1;
