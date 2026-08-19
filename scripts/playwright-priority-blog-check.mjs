import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "playwright";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reportDir = path.join(repoRoot, "docs/audits/mydreamshoots-gpt10-2026-08-17/local-playwright");
const baseUrl = (process.env.BLOG_PREVIEW_BASE_URL ?? "http://127.0.0.1:3002").replace(/\/$/, "");
fs.mkdirSync(reportDir, { recursive: true });

const pages = [
  {
    slug: "/blog/cyberpunk-photo-package-guide",
    h1: "Cyberpunk AI Photos: Neon Styles, Source Photos, and a Review Checklist",
    targetHrefs: ["/ai-image-generation/cyberpunk"]
  },
  {
    slug: "/blog/mafia-photo-package-guide",
    h1: "Mafia-Style AI Photos: Wardrobe, Lighting, and Scene Guide",
    targetHrefs: ["/ai-image-generation/mafia"]
  },
  {
    slug: "/blog/magic-upscaler-photo-package-guide",
    h1: "Magic Upscaler Guide: Improve Clarity Without Overprocessing Your Photo",
    targetHrefs: ["/ai-image-generation/photo-enhancer"]
  },
  {
    slug: "/blog/nature-photo-package-guide",
    h1: "Nature AI Portraits: Plan Forest, Mountain, and Lakeside Scenes",
    targetHrefs: ["/ai-image-generation/travel"]
  },
  {
    slug: "/blog/outdoor-creator-scenes-photo-package-guide",
    h1: "Outdoor Creator Photos: Urban Streets vs Scenic Locations",
    targetHrefs: ["/ai-image-generation/urban", "/ai-image-generation/travel"]
  },
  {
    slug: "/blog/valentine-photos-photo-package-guide",
    h1: "Valentine's Day AI Photos: Couple Portraits, Cards, and Gifts",
    targetHrefs: ["/ai-image-generation/valentines-photo"]
  },
  {
    slug: "/blog/virtual-try-on-photo-package-guide",
    h1: "AI Virtual Try-On Guide: Plan Outfits Without Treating the Preview as Exact Fit",
    targetHrefs: ["/ai-image-generation/virtual-try-on"]
  },
  {
    slug: "/blog/wedding-portraits-photo-package-guide",
    h1: "AI Wedding Portraits: Plan Save-the-Dates, Moodboards, and Keepsakes",
    targetHrefs: ["/ai-image-generation/wedding-photo"]
  },
  {
    slug: "/blog/world-cup-fan-photos-photo-package-guide",
    h1: "AI Soccer Fan Photos: Match-Day Posters Without Official Marks",
    targetHrefs: ["/ai-image-generation/soccer"],
    forbiddenVisibleText: /world cup/i
  },
  {
    slug: "/blog/anime-avatar-photo-package-guide",
    h1: "How to Plan an Anime Avatar Photo Set",
    targetHrefs: ["/ai-image-generation/avatar"],
    dateModified: "2026-08-19"
  },
  {
    slug: "/blog/creator-portraits-photo-package-guide",
    h1: "Creator Portraits for Media Kits, Thumbnails, and Brand Profiles",
    targetHrefs: ["/ai-image-generation/portrait-photo"],
    dateModified: "2026-08-19"
  },
  {
    slug: "/blog/fashion-editorial-photo-package-guide",
    h1: "How to Plan AI Fashion Editorial Photos",
    targetHrefs: ["/ai-image-generation"],
    dateModified: "2026-08-19"
  },
  {
    slug: "/blog/gala-photos-photo-package-guide",
    h1: "AI Gala Photos for Formal and Evening Portraits",
    targetHrefs: ["/ai-image-generation/gala-photo"],
    dateModified: "2026-08-19"
  },
  {
    slug: "/blog/hairstyle-photo-package-guide",
    h1: "AI Hairstyle Preview: What to Prepare and What to Check",
    targetHrefs: ["/ai-image-generation/hairstyle-generator"],
    dateModified: "2026-08-19"
  },
  {
    slug: "/blog/product-style-photo-package-guide",
    h1: "AI Product Style Photos for Lifestyle and Campaign Drafts",
    targetHrefs: ["/ai-image-generation"],
    dateModified: "2026-08-19"
  },
  {
    slug: "/blog/professional-headshots-photo-package-guide",
    h1: "Professional AI Headshots for LinkedIn, Resumes, and Team Profiles",
    targetHrefs: ["/ai-image-generation/headshot"],
    dateModified: "2026-08-19"
  },
  {
    slug: "/blog/profile-cards-photo-package-guide",
    h1: "Profile Card Photos for Consistent Bios and Social Profiles",
    targetHrefs: ["/ai-image-generation/avatar"],
    dateModified: "2026-08-19"
  },
  {
    slug: "/blog/social-cards-photo-package-guide",
    h1: "AI Social Card Photos for Shareable Content and Publishing",
    targetHrefs: ["/ai-image-generation"],
    dateModified: "2026-08-19"
  }
];
const selectedPages = process.env.BLOG_PRIORITY_SCOPE === "seo-remediation"
  ? pages.filter((page) => page.dateModified === "2026-08-19")
  : pages;

const viewports = {
  desktop: { width: 1440, height: 1000 },
  mobile: { width: 390, height: 844 }
};

function normalizedPublicPath(href) {
  const pathname = new URL(href, baseUrl).pathname;
  return pathname.replace(/^\/site\/mydreamshoots(?=\/|$)/, "") || "/";
}

function unique(values) {
  return [...new Set(values)];
}

async function linkedRouteStatuses(context, hrefs) {
  const results = [];
  for (const href of unique(hrefs)) {
    try {
      const response = await context.request.get(new URL(href, baseUrl).href, {
        maxRedirects: 5,
        timeout: 15_000
      });
      results.push({ href, status: response.status(), finalUrl: response.url() });
    } catch (error) {
      results.push({ href, status: null, finalUrl: "", error: String(error) });
    }
  }
  return results;
}

async function inspect(context, spec, routeKind, viewportName, index) {
  const routePrefix = routeKind === "site" ? "/site/mydreamshoots" : "";
  const requestedUrl = `${baseUrl}${routePrefix}${spec.slug}`;
  const expectedCanonical = `https://www.mydreamshoots.com${spec.slug}`;
  const browserErrors = [];
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${String(error)}`));

  let responseStatus = null;
  let location = "";
  let headStatus = null;
  let headLocation = "";
  let navigationError = null;
  try {
    const headResponse = await context.request.head(requestedUrl, { maxRedirects: 0, timeout: 15_000 });
    headStatus = headResponse.status();
    headLocation = headResponse.headers().location ?? "";
    const response = await context.request.get(requestedUrl, { maxRedirects: 0, timeout: 15_000 });
    responseStatus = response.status();
    location = response.headers().location ?? "";
    if (responseStatus === 200) {
      await page.goto(requestedUrl, { waitUntil: "networkidle", timeout: 30_000 });
    }
  } catch (error) {
    navigationError = String(error);
  }

  const screenshotName = `${routeKind}-${viewportName}-${String(index + 1).padStart(2, "0")}.png`;
  let signals = {};
  if (!navigationError && responseStatus === 200) {
    signals = await page.evaluate(() => {
      const article = document.querySelector('section[data-saas-section-renderer="blog_article"] article');
      const articleBody = article?.querySelector(":scope > div.text-lg");
      const actionLinks = [...(article?.querySelectorAll('[data-blog-article-actions="true"] a') ?? [])];
      const relatedLinks = [...(article?.querySelectorAll('nav[aria-label="More guides"] a') ?? [])];
      const contentLinks = [...(articleBody?.querySelectorAll("a") ?? [])];
      const contentsLinks = [...(article?.querySelectorAll('nav[aria-label="Article contents"] a') ?? [])];
      const images = [...(article?.querySelectorAll("img") ?? [])];
      const structuredData = [...document.querySelectorAll('script[type="application/ld+json"]')].flatMap((script) => {
        try {
          const parsed = JSON.parse(script.textContent || "null");
          if (Array.isArray(parsed)) return parsed;
          if (Array.isArray(parsed?.["@graph"])) return parsed["@graph"];
          return parsed ? [parsed] : [];
        } catch {
          return [];
        }
      });
      const blogPostings = structuredData.filter((entry) => entry?.["@type"] === "BlogPosting");
      const faqSchemas = structuredData.filter((entry) => entry?.["@type"] === "FAQPage");
      const overflowingArticleElements = article
        ? [...article.querySelectorAll("*")].filter((element) => {
            const style = getComputedStyle(element);
            if (style.display === "none" || style.visibility === "hidden") return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1);
          }).slice(0, 10).map((element) => ({
            tag: element.tagName.toLowerCase(),
            text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
            left: Math.round(element.getBoundingClientRect().left),
            right: Math.round(element.getBoundingClientRect().right)
          }))
        : [];
      const posting = blogPostings[0];
      return {
        title: document.title,
        description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? "",
        h1: article?.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
        htmlLang: document.documentElement.lang,
        htmlTranslate: document.documentElement.getAttribute("translate") ?? "",
        bodyTranslate: document.body.getAttribute("translate") ?? "",
        articleText: article?.textContent?.replace(/\s+/g, " ").trim() ?? "",
        bodyCharacters: articleBody?.textContent?.replace(/\s+/g, " ").trim().length ?? 0,
        h2Count: articleBody?.querySelectorAll("h2").length ?? 0,
        h3Count: articleBody?.querySelectorAll("h3").length ?? 0,
        tableCount: articleBody?.querySelectorAll("table").length ?? 0,
        actionHrefs: actionLinks.map((link) => link.getAttribute("href") ?? ""),
        relatedHrefs: relatedLinks.map((link) => link.getAttribute("href") ?? ""),
        contentHrefs: contentLinks.map((link) => link.getAttribute("href") ?? ""),
        contentsHrefs: contentsLinks.map((link) => link.getAttribute("href") ?? ""),
        missingContentsTargets: contentsLinks.map((link) => link.getAttribute("href") ?? "").filter((href) => !href.startsWith("#") || !document.getElementById(href.slice(1))),
        imageCount: images.length,
        brokenImages: images.filter((image) => !image.complete || image.naturalWidth === 0).map((image) => image.getAttribute("src") ?? ""),
        imageAlts: images.map((image) => image.getAttribute("alt") ?? ""),
        blogPostingCount: blogPostings.length,
        faqSchemaCount: faqSchemas.length,
        postingHeadline: posting?.headline ?? "",
        postingAuthorType: posting?.author?.["@type"] ?? "",
        postingDateModified: posting?.dateModified ?? "",
        postingImage: posting?.image ?? "",
        postingMainEntity: typeof posting?.mainEntityOfPage === "string" ? posting.mainEntityOfPage : posting?.mainEntityOfPage?.["@id"] ?? "",
        ogType: document.querySelector('meta[property="og:type"]')?.getAttribute("content") ?? "",
        ogPublishedTime: document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ?? "",
        ogModifiedTime: document.querySelector('meta[property="article:modified_time"]')?.getAttribute("content") ?? "",
        articleImageDimensions: images.map((image) => ({ width: image.getAttribute("width") ?? "", height: image.getAttribute("height") ?? "" })),
        organizationCount: structuredData.filter((entry) => entry?.["@type"] === "Organization").length,
        breadcrumbCount: structuredData.filter((entry) => entry?.["@type"] === "BreadcrumbList").length,
        viewportWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        overflowingArticleElements
      };
    });
    await page.screenshot({ path: path.join(reportDir, screenshotName), fullPage: true });
  }
  await page.close();

  const internalHrefs = unique([
    ...(signals.actionHrefs ?? []),
    ...(signals.relatedHrefs ?? []),
    ...(signals.contentHrefs ?? [])
  ].filter((href) => href.startsWith("/")));
  const linkedRoutes = responseStatus === 200 ? await linkedRouteStatuses(context, internalHrefs) : [];
  const expectedTargets = spec.targetHrefs;
  const actualTargets = (signals.actionHrefs ?? []).map(normalizedPublicPath);
  const failures = [];
  if (responseStatus !== 200) failures.push(`expected HTTP 200, received ${responseStatus}`);
  if (location) failures.push(`unexpected redirect location ${location}`);
  if (headStatus !== 200) failures.push(`expected HEAD 200, received ${headStatus}`);
  if (headLocation) failures.push(`unexpected HEAD redirect location ${headLocation}`);
  if (navigationError) failures.push(navigationError);
  if (signals.title === "") failures.push("missing title");
  if ((signals.description ?? "").length < 80) failures.push("meta description is missing or too short");
  if (signals.h1 !== spec.h1) failures.push(`unexpected H1: ${signals.h1 || "<missing>"}`);
  if (signals.canonical !== expectedCanonical) failures.push(`unexpected canonical: ${signals.canonical || "<missing>"}`);
  if (signals.htmlLang !== "en" || signals.htmlTranslate !== "yes" || signals.bodyTranslate !== "yes") failures.push("Google Translate compatibility attributes are incomplete");
  if ((signals.bodyCharacters ?? 0) < 3_000) failures.push(`article body is too short: ${signals.bodyCharacters ?? 0} characters`);
  if ((signals.h2Count ?? 0) < 5) failures.push(`expected at least 5 H2 sections, received ${signals.h2Count ?? 0}`);
  if ((signals.h3Count ?? 0) < 3) failures.push(`expected at least 3 H3 FAQ headings, received ${signals.h3Count ?? 0}`);
  if ((signals.tableCount ?? 0) < 1) failures.push("article table is missing");
  if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) failures.push(`unexpected CTA targets: ${JSON.stringify(actualTargets)}`);
  if ((signals.relatedHrefs ?? []).length !== 3) failures.push(`expected 3 related links, received ${(signals.relatedHrefs ?? []).length}`);
  if ((signals.contentsHrefs ?? []).length < 5) failures.push("article contents navigation is incomplete");
  if ((signals.missingContentsTargets ?? []).length) failures.push(`missing contents targets: ${signals.missingContentsTargets.join(", ")}`);
  if ((signals.imageCount ?? 0) < 1 || (signals.brokenImages ?? []).length) failures.push(`article images failed: ${JSON.stringify(signals.brokenImages ?? [])}`);
  if ((signals.imageAlts ?? []).some((alt) => !alt.trim())) failures.push("article image alt text is missing");
  if (signals.blogPostingCount !== 1) failures.push(`expected one BlogPosting schema, received ${signals.blogPostingCount ?? 0}`);
  if (signals.faqSchemaCount !== 0) failures.push(`unexpected FAQPage schema count ${signals.faqSchemaCount}`);
  if (signals.postingHeadline !== spec.h1) failures.push(`BlogPosting headline mismatch: ${signals.postingHeadline || "<missing>"}`);
  if (signals.postingAuthorType !== "Organization") failures.push(`BlogPosting author type is ${signals.postingAuthorType || "<missing>"}`);
  if (signals.postingDateModified !== (spec.dateModified ?? "2026-08-18")) failures.push(`BlogPosting dateModified is ${signals.postingDateModified || "<missing>"}`);
  if (spec.dateModified && signals.ogType !== "article") failures.push(`Open Graph type is ${signals.ogType || "<missing>"}`);
  if (spec.dateModified && !signals.ogPublishedTime) failures.push("article published time is missing");
  if (spec.dateModified && !signals.ogModifiedTime) failures.push("article modified time is missing");
  if (spec.dateModified && (signals.organizationCount < 1 || signals.breadcrumbCount < 1)) failures.push("Organization or BreadcrumbList schema is missing");
  if (spec.dateModified && (signals.articleImageDimensions ?? []).some((item) => !item.width || !item.height)) failures.push("article cover image dimensions are missing");
  if (!signals.postingImage) failures.push("BlogPosting image is missing");
  if (signals.postingMainEntity !== expectedCanonical) failures.push(`BlogPosting canonical mismatch: ${signals.postingMainEntity || "<missing>"}`);
  if ((signals.documentScrollWidth ?? 0) > (signals.viewportWidth ?? 0) + 1) failures.push(`document overflows horizontally: ${signals.documentScrollWidth}px > ${signals.viewportWidth}px`);
  if ((signals.overflowingArticleElements ?? []).length) failures.push(`article elements overflow viewport: ${JSON.stringify(signals.overflowingArticleElements)}`);
  if (browserErrors.length) failures.push(`browser errors: ${browserErrors.join(" | ")}`);
  if ((signals.articleText ?? "").includes("photo package category")) failures.push("legacy generic article phrase remains");
  if ((signals.articleText ?? "").includes("Start with Headshot")) failures.push("legacy Headshot CTA remains");
  if (spec.forbiddenVisibleText?.test(signals.articleText ?? "")) failures.push("official event name remains in visible soccer article text");
  for (const linkedRoute of linkedRoutes) {
    if (linkedRoute.status !== 200) failures.push(`linked route failed: ${linkedRoute.href} (${linkedRoute.status})`);
  }

  return {
    routeKind,
    viewport: viewportName,
    requestedUrl,
    status: responseStatus,
    location,
    headStatus,
    headLocation,
    screenshot: responseStatus === 200 ? screenshotName : "",
    navigationError,
    browserErrors,
    ...signals,
    linkedRoutes,
    failures
  };
}

const browser = await chromium.launch({ headless: true });
const results = [];
for (const [routeKind, extraHTTPHeaders] of [["host", { "x-forwarded-host": "www.mydreamshoots.com" }], ["site", {}]]) {
  for (const [viewportName, viewport] of Object.entries(viewports)) {
    const context = await browser.newContext({ extraHTTPHeaders, viewport });
    for (const [index, spec] of selectedPages.entries()) {
      results.push(await inspect(context, spec, routeKind, viewportName, index));
    }
    await context.close();
  }
}
await browser.close();

const desktopHostResults = results.filter((result) => result.routeKind === "host" && result.viewport === "desktop");
const globalFailures = [];
for (const field of ["title", "description", "h1"]) {
  const values = desktopHostResults.map((result) => result[field]);
  if (new Set(values).size !== selectedPages.length) globalFailures.push(`${field} values are not unique across selected pages`);
}

const report = {
  status: "local-only-not-published",
  generatedAt: new Date().toISOString(),
  baseUrl,
  host: "www.mydreamshoots.com",
  checks: results.length,
  globalFailures,
  results
};
fs.writeFileSync(path.join(reportDir, "report.json"), `${JSON.stringify(report, null, 2)}\n`);

const failedChecks = results.filter((result) => result.failures.length);
console.log(JSON.stringify({
  status: report.status,
  checks: results.length,
  failedChecks: failedChecks.length,
  globalFailures,
  httpStatusCounts: results.reduce((counts, result) => ({ ...counts, [result.status]: (counts[result.status] ?? 0) + 1 }), {}),
  report: path.join(reportDir, "report.json")
}, null, 2));
if (failedChecks.length || globalFailures.length) process.exitCode = 1;
