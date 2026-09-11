import fs from "node:fs";

const base = (process.env.AIDREAMSHOOTS_PRODUCTION_READBACK_BASE_URL || "http://127.0.0.1:3003/site/aidreamshoots").replace(/\/$/, "");
const sourceReportPath = "releases/manifests/aidreamshoots-local-http-audit-2026-09-11-final-v5.json";
const reportPath = process.env.AIDREAMSHOOTS_PRODUCTION_READBACK_REPORT
  || "releases/manifests/aidreamshoots-local-http-audit-2026-09-11-production-v3.json";
const sourceReport = JSON.parse(fs.readFileSync(sourceReportPath, "utf8"));

const likelyEnglishPattern = /\b(?:AI Video Generation|AI Tools|AI Tools Collection|How it works|View all|View All|Learn more|Read more|Save the Date|Best for|Production notes|Visual focus|Recommended input|Video format|Your photos|Your Samples|Operated by|A guided place|Explore scene|private gallery example|photo packages|video generation|image generation|source photos?|choose a|create your|upload your|what is|how do I|what can I|is .* free|held|variations|website|websites|announcement|announcements|workflows|states|generated scene references|Campaign variants|Training & Routine|relationship-led|Happy birthday|Customer problem|people-focused|company update|performance claim|product value|meme culture|internet slang|subscription|customer|customers|partner|partners|recommended usage|Most Popular|Best value|Coming soon|Checkout coming soon|No active price|Price available soon|\/ month|\/ year|\/ months|Monthly credits|Quarterly credits|Semiannual|Private gallery|private album|Saved results|My account|Upload photos|View my albums|Open request|Recent requests|credits held|Customer media|The workspace|Only the current|delivery standard|written instructions|safe photo edits|style adjustments|image variations|Creator channel|Album status|Job status|Account and billing)\b/i;

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

function parseHtml(html) {
  const body = stripHtml(html);
  const imageUrls = allMatches(html, /<(?:img|source)[^>]+(?:src|srcset)=["']([^"']+)["']/gi)
    .flatMap((value) => value.split(/\s+/).map((item) => item.replace(/,\d+w$/, "")))
    .filter((value) => value.startsWith("/assets/"));
  return {
    title: firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i),
    lang: firstMatch(html, /<html[^>]+lang=["']([^"']+)["']/i),
    canonical: firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || firstMatch(html, /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i),
    ogUrl: firstMatch(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) || firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i),
    description: firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i),
    robots: firstMatch(html, /<meta[^>]+name=["']robots["'][^>]+content=["']([^"']*)["']/i),
    h1: allMatches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi).map(stripHtml),
    jsonLdCount: (html.match(/<script[^>]+type=["']application\/ld\+json["']/gi) || []).length,
    sourceBrandLeaks: [...new Set(body.match(/(?:mydreamshoots\.com|MyDreamShoots|assets\/dreamshoot)/gi) || [])],
    likelyEnglish: likelyEnglishPattern.test(body),
    bodySample: body.slice(0, 420),
    imageUrls: [...new Set(imageUrls)]
  };
}

async function fetchWithRetry(url) {
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(60000) });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function main() {
  const rows = [];
  for (const entry of sourceReport.rows) {
    const route = entry.slug === "/" ? "" : entry.slug;
    const url = `${base}${route}`;
    try {
      const response = await fetchWithRetry(url);
      const html = await response.text();
      rows.push({ ...entry, url, status: response.status, finalUrl: response.url, ...parseHtml(html), error: "" });
    } catch (error) {
      rows.push({ ...entry, url, status: null, finalUrl: "", title: "", lang: "", canonical: "", ogUrl: "", description: "", robots: "", h1: [], jsonLdCount: 0, sourceBrandLeaks: [], likelyEnglish: false, bodySample: "", imageUrls: [], error: error instanceof Error ? error.message : String(error) });
    }
  }

  const assetUrls = [...new Set(sourceReport.assetChecks.map((asset) => asset.url))];
  const assetChecks = [];
  for (let offset = 0; offset < assetUrls.length; offset += 12) {
    const batch = assetUrls.slice(offset, offset + 12);
    const checks = await Promise.all(batch.map(async (url) => {
      try {
        const response = await fetchWithRetry(`${base.replace("/site/aidreamshoots", "")}${url}`);
        return { url, fsExists: true, status: response.status, ok: response.ok };
      } catch (error) {
        return { url, fsExists: true, status: null, ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }));
    assetChecks.push(...checks);
  }

  const summary = {
    requestFailures: rows.filter((row) => row.status === null || row.error).map((row) => ({ slug: row.slug, status: row.status, error: row.error })),
    non200: rows.filter((row) => row.status !== 200).map((row) => ({ slug: row.slug, status: row.status, finalUrl: row.finalUrl })),
    wrongLanguage: rows.filter((row) => row.lang !== "es").map((row) => ({ slug: row.slug, lang: row.lang })),
    missingCanonical: rows.filter((row) => !row.canonical).map((row) => row.slug),
    canonicalOutsideTarget: rows.filter((row) => row.canonical && !/aidreamshoots\.eu|127\.0\.0\.1:3003/.test(row.canonical)).map((row) => ({ slug: row.slug, canonical: row.canonical })),
    wrongOgUrl: rows.filter((row) => row.ogUrl && !/aidreamshoots\.eu|127\.0\.0\.1:3003/.test(row.ogUrl)).map((row) => ({ slug: row.slug, ogUrl: row.ogUrl })),
    missingH1: rows.filter((row) => row.status === 200 && row.h1.length === 0).map((row) => row.slug),
    sourceBrandLeaks: rows.filter((row) => row.sourceBrandLeaks.length).map((row) => ({ slug: row.slug, leaks: row.sourceBrandLeaks })),
    likelyEnglish: rows.filter((row) => row.likelyEnglish).map((row) => ({ slug: row.slug, h1: row.h1, title: row.title, sample: row.bodySample })),
    missingLocalAssets: assetChecks.filter((row) => !row.fsExists).map((row) => row.url),
    failedAssetResponses: assetChecks.filter((row) => !row.ok).map((row) => ({ url: row.url, status: row.status, error: row.error }))
  };

  const report = { createdAt: new Date().toISOString(), baseUrl: base, siteId: "site_mydreamshoots_xby", siteSlug: "aidreamshoots", routeCount: rows.length, assetCount: assetChecks.length, summary, rows, assetChecks };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ reportPath, routeCount: rows.length, assetCount: assetChecks.length, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
