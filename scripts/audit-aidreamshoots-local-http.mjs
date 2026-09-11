import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const baseUrl = (process.env.AIDREAMSHOOTS_LOCAL_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const siteId = "site_mydreamshoots_xby";
const siteSlug = "aidreamshoots";
const prisma = new PrismaClient();
const reportArg = process.argv.find((arg) => arg.startsWith("--report="))?.slice("--report=".length);

const likelyEnglishPattern = /\b(?:AI Video Generation|AI Tools|AI Tools Collection|How it works|View all|View All|Learn more|Read more|Save the Date|Best for|Production notes|Visual focus|Recommended input|Video format|Your photos|Your Samples|Operated by|A guided place|Explore scene|private gallery example|photo packages|video generation|image generation|source photos?|choose a|create your|upload your|what is|how do I|what can I|is .* free|held|variations|website|websites|announcement|announcements|workflows|states|generated scene references|Campaign variants|Training & Routine|relationship-led|Happy birthday|Customer problem|people-focused|company update|performance claim|product value|meme culture|internet slang|subscription|customer|customers|partner|partners|recommended usage)\b/i;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function firstMatch(html, pattern) {
  return html.match(pattern)?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function allMatches(html, pattern) {
  return [...html.matchAll(pattern)].map((match) => match[1]).filter(Boolean);
}

async function fetchWithRetry(url, attempts = 5) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(30000) });
    } catch (error) {
      lastError = error;
      // Next dev can restart after a large target-only storefront render.
      // Give the process a short recovery window before treating that route
      // as unavailable; real non-2xx responses still remain visible below.
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function mapConcurrent(values, limit, worker) {
  const output = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor++;
      if (index >= values.length) return;
      output[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, () => run()));
  return output;
}

function parseHtml(html) {
  const body = stripHtml(html);
  const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || firstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i);
  const ogUrl = firstMatch(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) || firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i);
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i) || firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["']/i);
  const robots = firstMatch(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i) || firstMatch(html, /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']robots["']/i);
  return {
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    lang: firstMatch(html, /<html[^>]+lang=["']([^"']+)["']/i),
    canonical,
    ogUrl,
    description,
    robots,
    h1: allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(stripHtml),
    jsonLdCount: (html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length,
    body,
    imageUrls: allMatches(html, /<(?:img|source)[^>]+(?:src|srcset)=["']([^"']+)["']/gi)
      .flatMap((value) => value.split(/\s+/).map((item) => item.replace(/,\d+w$/, "")))
      .filter((value) => value.startsWith("/assets/"))
  };
}

async function main() {
  const pages = await prisma.livePage.findMany({ where: { siteId }, select: { slug: true, pageType: true, title: true }, orderBy: { slug: "asc" } });
  const assetRows = await prisma.mediaAsset.findMany({ where: { siteId }, select: { id: true, previewUrl: true, originUrl: true } });
  await prisma.$disconnect();
  // Next's local dev compiler can restart under the memory pressure of four
  // full storefront renders at once. Keep the audit deterministic and gentle
  // so a terminated request is not mistaken for a broken public route.
  const rows = await mapConcurrent(pages, 1, async (entry) => {
    const route = entry.slug === "/" ? "" : entry.slug;
    const url = `${baseUrl}/site/${siteSlug}${route}`;
    try {
      const response = await fetchWithRetry(url);
      const html = await response.text();
      const parsed = parseHtml(html);
      return {
        ...entry,
        url,
        status: response.status,
        finalUrl: response.url,
        title: parsed.title,
        lang: parsed.lang,
        canonical: parsed.canonical,
        ogUrl: parsed.ogUrl,
        robots: parsed.robots,
        description: parsed.description,
        h1: parsed.h1,
        jsonLdCount: parsed.jsonLdCount,
        imageUrls: [...new Set(parsed.imageUrls)],
        sourceBrandLeaks: [...new Set((parsed.body.match(/(?:mydreamshoots\.com|MyDreamShoots|assets\/dreamshoot)/gi) || []))],
        likelyEnglish: likelyEnglishPattern.test(parsed.body),
        bodySample: parsed.body.slice(0, 420)
      };
    } catch (error) {
      return { ...entry, url, status: null, finalUrl: "", title: "", lang: "", canonical: "", ogUrl: "", robots: "", description: "", h1: [], jsonLdCount: 0, imageUrls: [], sourceBrandLeaks: [], likelyEnglish: false, bodySample: "", error: error instanceof Error ? error.message : String(error) };
    }
  });

  const assetUrls = [...new Set(assetRows.flatMap((asset) => [asset.previewUrl, asset.originUrl]).filter((url) => typeof url === "string" && url.startsWith("/assets/sites/site_aidreamshoots/")))];
  const assetChecks = await mapConcurrent(assetUrls, 12, async (assetUrl) => {
    const localPath = path.join(process.cwd(), "public", assetUrl.split("?")[0].replace(/^\//, ""));
    const fsExists = !assetUrl.includes("..") && fs.existsSync(localPath);
    try {
      const response = await fetchWithRetry(`${baseUrl}${assetUrl}`);
      return { url: assetUrl, fsExists, status: response.status, ok: response.ok };
    } catch (error) {
      return { url: assetUrl, fsExists, status: null, ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  const report = {
    createdAt: new Date().toISOString(),
    baseUrl,
    siteId,
    siteSlug,
    routeCount: rows.length,
    assetCount: assetChecks.length,
    summary: {
      requestFailures: rows.filter((row) => row.status === null || row.error).map((row) => ({ slug: row.slug, status: row.status, error: row.error })),
      non200: rows.filter((row) => row.status !== 200).map((row) => ({ slug: row.slug, status: row.status, finalUrl: row.finalUrl })),
      wrongLanguage: rows.filter((row) => row.lang !== "es").map((row) => ({ slug: row.slug, lang: row.lang })),
      missingCanonical: rows.filter((row) => !row.canonical).map((row) => row.slug),
      canonicalOutsideTarget: rows.filter((row) => row.canonical && !/aidreamshoots\.eu|127\.0\.0\.1:3002/.test(row.canonical)).map((row) => ({ slug: row.slug, canonical: row.canonical })),
      wrongOgUrl: rows.filter((row) => row.ogUrl && !/aidreamshoots\.eu|127\.0\.0\.1:3002/.test(row.ogUrl)).map((row) => ({ slug: row.slug, ogUrl: row.ogUrl })),
      missingH1: rows.filter((row) => row.status === 200 && row.h1.length === 0).map((row) => row.slug),
      sourceBrandLeaks: rows.filter((row) => row.sourceBrandLeaks.length).map((row) => ({ slug: row.slug, leaks: row.sourceBrandLeaks })),
      likelyEnglish: rows.filter((row) => row.likelyEnglish).map((row) => ({ slug: row.slug, h1: row.h1, title: row.title, sample: row.bodySample })),
      missingLocalAssets: assetChecks.filter((row) => !row.fsExists).map((row) => row.url),
      failedAssetResponses: assetChecks.filter((row) => !row.ok).map((row) => ({ url: row.url, status: row.status, error: row.error }))
    },
    rows,
    assetChecks
  };
  const reportPath = path.resolve(process.cwd(), reportArg || `releases/manifests/aidreamshoots-local-http-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ reportPath, routeCount: rows.length, assetCount: assetChecks.length, summary: report.summary }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect().catch(() => undefined);
  process.exitCode = 1;
});
