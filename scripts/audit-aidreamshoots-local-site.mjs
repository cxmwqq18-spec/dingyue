import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const baseUrl = (process.env.AIDREAMSHOOTS_LOCAL_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const siteSlug = "aidreamshoots";
const siteId = "site_mydreamshoots_xby";
const prisma = new PrismaClient();
const reportArg = process.argv.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function likelyEnglish(text) {
  return /\b(?:AI Video Generation|AI Tools|AI Tools Collection|How it works|View all|View All|Learn more|Read more|Save the Date|Best for|Production notes|Visual focus|Recommended input|Video format|Your photos|Your Samples|Operated by|A guided place|Explore scene|private gallery example|photo packages|video generation|image generation|source photos?|choose a|create your|upload your|what is|how do I|what can I|is .* free)\b/i.test(text);
}

function visibleBodyText(body) {
  return body.replace(/\s+/g, " ").trim();
}

async function main() {
  const pages = await prisma.livePage.findMany({
    where: { siteId },
    select: { slug: true, pageType: true, title: true },
    orderBy: { slug: "asc" }
  });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const rows = [];
  try {
    for (const entry of pages) {
      const route = entry.slug === "/" ? "" : entry.slug;
      const url = `${baseUrl}/site/${siteSlug}${route}`;
      const failedMedia = [];
      const responseHandler = (response) => {
        if (response.request().resourceType() === "image" || response.request().resourceType() === "media") {
          if (response.status() >= 400) failedMedia.push({ url: response.url(), status: response.status() });
        }
      };
      page.on("response", responseHandler);
      let status = null;
      let error = null;
      try {
        const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
        status = response?.status() ?? null;
        await page.waitForTimeout(150);
        await page.evaluate(async () => {
          for (let i = 0; i < 8; i += 1) {
            window.scrollTo(0, document.body.scrollHeight);
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(250);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
      }
      let seo = null;
      for (let attempt = 0; attempt < 3 && !seo; attempt += 1) {
        try {
          seo = await page.evaluate(() => {
            const visible = document.body.cloneNode(true);
            visible.querySelectorAll("script,style,noscript,template").forEach((node) => node.remove());
            const body = visible.textContent || "";
            const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") || "";
            const ogUrl = document.querySelector('meta[property="og:url"]')?.getAttribute("content") || "";
            const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") || "";
            const description = document.querySelector('meta[name="description"]')?.getAttribute("content") || "";
            const h1 = [...document.querySelectorAll("h1")].map((node) => (node.textContent || "").replace(/\s+/g, " ").trim()).filter(Boolean);
            const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map((node) => node.textContent || "").filter(Boolean);
            const images = [...document.images].map((image) => ({ src: image.currentSrc || image.src, complete: image.complete, width: image.naturalWidth }));
            return { title: document.title, lang: document.documentElement.lang, body, canonical, ogUrl, robots, description, h1, jsonLd, images };
          });
        } catch {
          await page.waitForLoadState("domcontentloaded", { timeout: 5000 }).catch(() => undefined);
          await page.waitForTimeout(150);
        }
      }
      seo ??= { title: "", lang: "", body: "", canonical: "", ogUrl: "", robots: "", description: "", h1: [], jsonLd: [], images: [] };
      page.off("response", responseHandler);
      const body = visibleBodyText(seo.body);
      rows.push({
        ...entry,
        url,
        status,
        error,
        title: seo.title,
        lang: seo.lang,
        canonical: seo.canonical,
        ogUrl: seo.ogUrl,
        robots: seo.robots,
        description: seo.description,
        h1: seo.h1,
        jsonLdCount: seo.jsonLd.length,
        brokenImages: seo.images.filter((image) => image.complete && image.src && image.width === 0).map((image) => image.src),
        failedMedia: unique(failedMedia.map((item) => `${item.status} ${item.url}`)),
        sourceBrandLeaks: unique((body.match(/(?:mydreamshoots\.com|MyDreamShoots|assets\/dreamshoot)/gi) || [])),
        likelyEnglish: likelyEnglish(body),
        bodySample: body.slice(0, 420)
      });
    }
  } finally {
    await context.close().catch(() => undefined);
    await browser.close().catch(() => undefined);
    await prisma.$disconnect();
  }

  const report = {
    createdAt: new Date().toISOString(),
    baseUrl,
    siteId,
    siteSlug,
    routeCount: rows.length,
    summary: {
      non200: rows.filter((row) => row.status !== 200).map((row) => ({ slug: row.slug, status: row.status, error: row.error })),
      wrongLanguage: rows.filter((row) => row.lang !== "es").map((row) => ({ slug: row.slug, lang: row.lang })),
      missingCanonical: rows.filter((row) => !row.canonical).map((row) => row.slug),
      canonicalOutsideTarget: rows.filter((row) => row.canonical && !/aidreamshoots\.eu|127\.0\.0\.1:3002/.test(row.canonical)).map((row) => ({ slug: row.slug, canonical: row.canonical })),
      wrongOgUrl: rows.filter((row) => row.ogUrl && !/aidreamshoots\.eu|127\.0\.0\.1:3002/.test(row.ogUrl)).map((row) => ({ slug: row.slug, ogUrl: row.ogUrl })),
      missingH1: rows.filter((row) => row.h1.length === 0).map((row) => row.slug),
      brokenImages: rows.filter((row) => row.brokenImages.length || row.failedMedia.length).map((row) => ({ slug: row.slug, brokenImages: row.brokenImages, failedMedia: row.failedMedia })),
      sourceBrandLeaks: rows.filter((row) => row.sourceBrandLeaks.length).map((row) => ({ slug: row.slug, leaks: row.sourceBrandLeaks })),
      likelyEnglish: rows.filter((row) => row.likelyEnglish).map((row) => ({ slug: row.slug, h1: row.h1, title: row.title, sample: row.bodySample }))
    },
    rows
  };
  const reportPath = path.resolve(process.cwd(), reportArg || `releases/manifests/aidreamshoots-local-site-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ reportPath, routeCount: rows.length, summary: report.summary }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
