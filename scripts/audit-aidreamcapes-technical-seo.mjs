#!/usr/bin/env node

// Read-only technical SEO audit for the Aidreamcapes storefront.
//
// Crawls every sitemap URL plus the internal links those pages expose, then
// reports metadata, canonical, indexability, structured data, link graph,
// redirect and header signals. Dependency free so it can run on the release
// host itself when the operator's network is rate limited by the CDN.
//
//   node scripts/audit-aidreamcapes-technical-seo.mjs \
//     --origin=https://www.aivideosugc.com --out=/tmp/seo-audit.json
//
// Optional flags: --concurrency=4 --timeout=25000 --max-extra=250 --skip-extra

import fs from "node:fs/promises";
import path from "node:path";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  }),
);
const origin = (args.get("origin") || "https://www.aivideosugc.com").replace(/\/+$/, "");
const originUrl = new URL(origin);
const concurrency = Number(args.get("concurrency") || 4);
const timeoutMs = Number(args.get("timeout") || 25_000);
const maxExtra = Number(args.get("max-extra") || 250);
const skipExtra = args.has("skip-extra");
const outPath = path.resolve(args.get("out") || "reports/aidreamcapes-technical-seo.json");
const userAgent = "Mozilla/5.0 (compatible; AidreamcapesSEOAudit/1.0; +https://www.aivideosugc.com)";

const pages = new Map();
const failures = [];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function compact(value) {
  return String(value ?? "").replace(/[\s\u00a0]+/g, " ").trim();
}

function decodeEntities(value) {
  return compact(
    String(value ?? "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;|&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec))),
  );
}

function attr(tag, name) {
  return decodeEntities(tag?.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "");
}

function tags(html, name) {
  return [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function metaContent(html, key, keyName = "name") {
  const lowered = key.toLowerCase();
  for (const tag of tags(html, "meta")) {
    const name = attr(tag, keyName).toLowerCase();
    if (name === lowered) return attr(tag, "content");
  }
  return "";
}

function textOnly(html) {
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  );
}

function normalizeUrl(raw, base) {
  try {
    const url = new URL(decodeEntities(raw), base);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function pageKey(url) {
  const parsed = typeof url === "string" ? new URL(url) : new URL(url.toString());
  let pathname = parsed.pathname.replace(/\/{2,}/g, "/");
  if (pathname.length > 1) pathname = pathname.replace(/\/+$/, "");
  return `${parsed.hostname}${pathname}`.toLowerCase();
}

function sameOrigin(url) {
  return url.hostname === originUrl.hostname;
}

async function fetchWithTrace(target, redirectMode = "manual") {
  const chain = [];
  let current = typeof target === "string" ? target : target.toString();
  for (let hop = 0; hop < 8; hop += 1) {
    const started = performance.now();
    let response;
    try {
      response = await fetch(current, {
        redirect: redirectMode,
        headers: { "user-agent": userAgent, accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "accept-encoding": "gzip, br" },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (error) {
      return { error: String(error?.cause?.code || error?.name || error), chain, headersMs: performance.now() - started };
    }
    const headersMs = performance.now() - started;
    const location = response.headers.get("location");
    chain.push({ url: current, status: response.status, location: location || null, headersMs: Math.round(headersMs) });
    if (redirectMode === "manual" && response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      if (!sameOrigin(new URL(current))) break;
      continue;
    }
    const body = await response.text();
    return {
      status: response.status,
      finalUrl: current,
      chain,
      headersMs: Math.round(headersMs),
      totalMs: Math.round(performance.now() - started),
      bytes: Buffer.byteLength(body),
      headers: Object.fromEntries(
        ["content-type", "content-encoding", "cache-control", "server", "cf-cache-status", "x-nextjs-cache", "x-robots-tag", "strict-transport-security", "content-security-policy", "x-content-type-options", "referrer-policy", "vary", "link"]
          .map((name) => [name, response.headers.get(name)])
          .filter(([, value]) => value),
      ),
      body,
    };
  }
  return { error: "redirect-loop", chain };
}

function parsePage(html, url) {
  const title = decodeEntities(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description = metaContent(html, "description");
  const robots = metaContent(html, "robots") || metaContent(html, "googlebot");
  const canonicalTags = tags(html, "link").filter((tag) => /\brel\s*=\s*["'][^"']*canonical/i.test(tag));
  const canonical = attr(canonicalTags[0] || "", "href");
  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => textOnly(match[1])).filter(Boolean);
  const h2 = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((match) => textOnly(match[1])).filter(Boolean);
  const h3 = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)].map((match) => textOnly(match[1])).filter(Boolean);
  const text = textOnly(html);
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  // The whole page includes the site wide navigation and footer, which every
  // page repeats. The main column is what a visitor came for and what a search
  // engine reads as this page's own copy, so it is measured separately.
  const mainHtml = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] || "";
  const mainText = mainHtml ? textOnly(mainHtml) : "";
  const mainWords = mainText ? mainText.split(/\s+/).filter(Boolean).length : 0;
  const lang = attr(html.match(/<html\b[^>]*>/i)?.[0] || "", "lang");
  const viewport = metaContent(html, "viewport");

  const jsonLd = [];
  for (const match of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      const nodes = [];
      const walk = (value) => {
        if (Array.isArray(value)) return value.forEach(walk);
        if (!value || typeof value !== "object") return;
        if (value["@type"]) nodes.push(value);
        Object.values(value).forEach(walk);
      };
      walk(parsed);
      jsonLd.push({ ok: true, nodes });
    } catch (error) {
      jsonLd.push({ ok: false, error: String(error.message).slice(0, 120), raw: raw.slice(0, 200) });
    }
  }
  const jsonLdTypes = [...new Set(jsonLd.flatMap((block) => block.nodes || []).flatMap((node) => (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]).filter(Boolean).map(String)))].sort();

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((match) => match[0]);
  // An empty alt is the correct markup for a decorative picture, so only a
  // picture with no alt attribute at all is missing one.
  const imgMissingAlt = images.filter((tag) => !/\balt\s*=/.test(tag)).length;
  const imgDecorativeAlt = images.filter((tag) => /\balt\s*=\s*["']\s*["']/.test(tag)).length;
  const imgLazy = images.filter((tag) => /loading\s*=\s*["']lazy/i.test(tag)).length;
  const imgNextGen = images.filter((tag) => /\.(webp|avif)(\?|$|["'])/i.test(attr(tag, "src") || attr(tag, "srcset"))).length;

  const links = [...html.matchAll(/<a\b[^>]*>/gi)].map((match) => match[0]);
  const anchors = [];
  for (const tag of links) {
    const href = attr(tag, "href");
    if (!href) continue;
    const resolved = normalizeUrl(href, url);
    if (!resolved) continue;
    anchors.push({ href: resolved.toString(), text: decodeEntities(html.slice(html.indexOf(tag) + tag.length, html.indexOf(tag) + tag.length + 160).replace(/<[^>]+>/g, " ")).slice(0, 80), rel: attr(tag, "rel") });
  }
  const internal = anchors.filter((anchor) => sameOrigin(new URL(anchor.href)));
  const external = anchors.filter((anchor) => !sameOrigin(new URL(anchor.href)));

  const scripts = tags(html, "script");
  const externalScripts = scripts.filter((tag) => /\bsrc\s*=/.test(tag) && !/type\s*=\s*["']application\/ld\+json/i.test(tag));
  const blockingScripts = externalScripts.filter((tag) => !/\b(async|defer|type\s*=\s*["']module["'])/i.test(tag));
  const stylesheets = tags(html, "link").filter((tag) => /\brel\s*=\s*["'][^"']*stylesheet/i.test(tag));
  const preloads = tags(html, "link").filter((tag) => /\brel\s*=\s*["'][^"']*preload/i.test(tag));
  const hreflang = tags(html, "link")
    .filter((tag) => /\bhreflang\s*=/i.test(tag))
    .map((tag) => ({ hreflang: attr(tag, "hreflang"), href: attr(tag, "href") }));

  return {
    title,
    titleLength: title.length,
    description,
    descriptionLength: description.length,
    robots,
    canonical,
    lang,
    viewport,
    h1,
    h2Count: h2.length,
    h3Count: h3.length,
    words,
    mainWords,
    textHtmlRatio: html.length ? Math.round((text.length / html.length) * 1000) / 10 : 0,
    jsonLdTypes,
    jsonLdErrors: jsonLd.filter((block) => !block.ok),
    jsonLdNodes: jsonLd.flatMap((block) => block.nodes || []),
    ogTitle: metaContent(html, "og:title", "property"),
    ogDescription: metaContent(html, "og:description", "property"),
    ogImage: metaContent(html, "og:image", "property"),
    twitterCard: metaContent(html, "twitter:card"),
    images: images.length,
    imgMissingAlt,
    imgDecorativeAlt,
    imgLazy,
    imgNextGen,
    linkCount: anchors.length,
    internalLinkCount: internal.length,
    externalLinkCount: external.length,
    internalLinks: internal,
    externalLinks: external.slice(0, 40),
    externalScripts: externalScripts.length,
    blockingScripts: blockingScripts.length,
    stylesheets: stylesheets.length,
    preloads: preloads.length,
    hreflang,
  };
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
}

async function crawl(target, { extra = false } = {}) {
  const key = pageKey(target);
  if (pages.has(key)) return pages.get(key);
  const record = { url: target, key, extra, fetchedAt: new Date().toISOString() };
  pages.set(key, record);
  const result = await fetchWithTrace(target);
  Object.assign(record, {
    status: result.status ?? null,
    finalUrl: result.finalUrl ?? null,
    chain: result.chain,
    headersMs: result.headersMs,
    totalMs: result.totalMs ?? null,
    bytes: result.bytes ?? null,
    headers: result.headers ?? {},
    error: result.error ?? null,
  });
  if (result.error) {
    failures.push({ url: target, error: result.error });
    return record;
  }
  const contentType = result.headers?.["content-type"] || "";
  if (!contentType.includes("text/html")) {
    record.nonHtml = contentType;
    return record;
  }
  Object.assign(record, parsePage(result.body, result.finalUrl || target), { body: undefined });
  return record;
}

const startedAt = Date.now();
console.log(`[seo] origin=${origin} concurrency=${concurrency}`);
const robotsResult = await fetchWithTrace(`${origin}/robots.txt`, "follow");
const robotsBody = robotsResult.body || "";
const robots = {
  status: robotsResult.status ?? null,
  bytes: robotsResult.bytes ?? 0,
  content: robotsBody,
  sitemaps: [...robotsBody.matchAll(/^\s*sitemap\s*:\s*(\S+)/gim)].map((match) => match[1]),
  disallow: [...robotsBody.matchAll(/^\s*disallow\s*:\s*(\S*)/gim)].map((match) => match[1]),
  allow: [...robotsBody.matchAll(/^\s*allow\s*:\s*(\S*)/gim)].map((match) => match[1]),
  hasStar: /^\s*user-agent\s*:\s*\*/gim.test(robotsBody),
  host: (robotsBody.match(/^\s*host\s*:\s*(\S+)/gim) || [])[1] || null,
};

const sitemapResult = await fetchWithTrace(`${origin}/sitemap.xml`, "follow");
const sitemapXml = sitemapResult.body || "";
const sitemapUrls = [...sitemapXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((match) => match[1].trim());
const sitemap = {
  status: sitemapResult.status ?? null,
  bytes: sitemapResult.bytes ?? 0,
  urlCount: sitemapUrls.length,
  imageEntries: (sitemapXml.match(/<image:image>/g) || []).length,
  videoEntries: (sitemapXml.match(/<video:video>/g) || []).length,
  newsEntries: (sitemapXml.match(/<news:news>/g) || []).length,
  lastmods: [...new Set([...sitemapXml.matchAll(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/gi)].map((match) => match[1]))].sort(),
  isIndex: /<sitemapindex/i.test(sitemapXml),
};

console.log(`[seo] sitemap urls=${sitemapUrls.length} images=${sitemap.imageEntries} videos=${sitemap.videoEntries}`);

const primary = await mapLimit(sitemapUrls, concurrency, async (url) => {
  const record = await crawl(url);
  if (record && record.status !== 200) failures.push({ url, status: record.status, error: record.error || null, chain: record.chain });
  return record;
});

const extras = new Map();
if (!skipExtra) {
  const seen = new Set(sitemapUrls.map((url) => pageKey(url)));
  for (const record of primary) {
    for (const link of record?.internalLinks || []) {
      const url = new URL(link.href);
      if (url.search) continue;
      const key = pageKey(url);
      if (seen.has(key) || extras.has(key)) continue;
      extras.set(key, url.toString());
    }
  }
  const list = [...extras.values()].slice(0, maxExtra);
  console.log(`[seo] discovered internal-only urls=${extras.size} crawling=${list.length}`);
  await mapLimit(list, concurrency, async (url) => {
    const record = await crawl(url, { extra: true });
    if (record && record.status !== 200) failures.push({ url, status: record.status, error: record.error || null, chain: record.chain });
    return record;
  });
}

// Redirect / canonical / host behavior probes.
const probes = [
  { name: "http-root", url: `http://${originUrl.hostname}/` },
  { name: "apex-root", url: `https://${originUrl.hostname.replace(/^www\./, "")}/` },
  { name: "trailing-slash", url: `${origin}/about-us/` },
  { name: "uppercase", url: `${origin}/ABOUT-US` },
  { name: "utm", url: `${origin}/about-us?utm_source=seo-audit` },
  { name: "index-html", url: `${origin}/index.html` },
  { name: "404", url: `${origin}/this-page-does-not-exist-seo-audit-2026` },
  { name: "null-route", url: `${origin}/undefined` },
  { name: "platform-filter", url: `${origin}/platforms/instagram` },
];
const probeResults = {};
for (const probe of probes) {
  const result = await fetchWithTrace(probe.url);
  probeResults[probe.name] = {
    url: probe.url,
    status: result.status ?? null,
    finalUrl: result.finalUrl ?? null,
    chain: result.chain,
    error: result.error ?? null,
    xRobotsTag: result.headers?.["x-robots-tag"] ?? null,
    canonical: result.body ? attr(tags(result.body, "link").find((tag) => /canonical/i.test(tag)) || "", "href") : null,
    title: result.body ? decodeEntities(result.body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "") : null,
    robotsMeta: result.body ? metaContent(result.body, "robots") : null,
    words: result.body ? textOnly(result.body).split(/\s+/).filter(Boolean).length : 0,
  };
  await sleep(150);
}

const all = [...pages.values()];
const htmlPages = all.filter((page) => page.status === 200 && page.title !== undefined);
const canonicalMismatch = htmlPages.filter((page) => page.canonical && page.canonical.replace(/\/+$/, "") !== (page.finalUrl || page.url).replace(/\/+$/, ""));
const noindexPages = htmlPages.filter((page) => /noindex/i.test(page.robots || "") || /noindex/i.test(page.headers?.["x-robots-tag"] || ""));
const missingCanonical = htmlPages.filter((page) => !page.canonical);
const canonicalOutsideSitemap = htmlPages.filter((page) => page.canonical && !sitemapUrls.some((url) => pageKey(url) === pageKey(page.canonical)));

const titleGroups = new Map();
const descGroups = new Map();
// Only the pages that can reach an index are compared. A private page may
// repeat a title without costing the storefront an impression, and counting
// those repeats hid the pages that actually compete for a query.
const indexablePages = htmlPages.filter((page) => !/noindex/i.test(page.robots || "") && !/noindex/i.test(page.headers?.["x-robots-tag"] || ""));
for (const page of indexablePages) {
  const t = page.title.toLowerCase();
  if (t) titleGroups.set(t, [...(titleGroups.get(t) || []), page.url]);
  const d = page.description.toLowerCase();
  if (d) descGroups.set(d, [...(descGroups.get(d) || []), page.url]);
}
const duplicateTitles = [...titleGroups.entries()].filter(([, urls]) => urls.length > 1).map(([value, urls]) => ({ value, count: urls.length, urls }));
const duplicateDescriptions = [...descGroups.entries()].filter(([, urls]) => urls.length > 1).map(([value, urls]) => ({ value, count: urls.length, urls }));

// Link graph over crawled HTML pages.
const graph = new Map();
for (const page of htmlPages) graph.set(page.key, new Set());
for (const page of htmlPages) {
  for (const link of page.internalLinks || []) {
    const target = pageKey(link.href);
    if (!graph.has(target)) graph.set(target, new Set());
    graph.get(page.key).add(target);
  }
}
const inbound = new Map([...graph.keys()].map((key) => [key, 0]));
for (const targets of graph.values()) for (const target of targets) inbound.set(target, (inbound.get(target) || 0) + 1);
const homeKey = pageKey(`${origin}/`);
const depth = new Map([[homeKey, 0]]);
const queue = [homeKey];
while (queue.length) {
  const current = queue.shift();
  for (const next of graph.get(current) || []) {
    if (!depth.has(next)) {
      depth.set(next, depth.get(current) + 1);
      queue.push(next);
    }
  }
}
const sitemapKeys = new Set(sitemapUrls.map((url) => pageKey(url)));
const crawlKeys = new Set(graph.keys());
const orphans = [...sitemapKeys].filter((key) => (inbound.get(key) || 0) === 0 && key !== homeKey);
const unreachable = [...sitemapKeys].filter((key) => !depth.has(key));
const depthHistogram = {};
for (const key of sitemapKeys) {
  const value = depth.has(key) ? depth.get(key) : "unreachable";
  depthHistogram[value] = (depthHistogram[value] || 0) + 1;
}

// Broken internal links: targets that were crawled and are not 200.
const brokenLinks = [];
for (const page of htmlPages) {
  for (const link of page.internalLinks || []) {
    const key = pageKey(link.href);
    const target = pages.get(key);
    if (target && target.status && target.status !== 200) brokenLinks.push({ from: page.url, to: link.href, status: target.status });
    if (target && target.chain?.some((hop) => hop.status >= 300 && hop.status < 400)) brokenLinks.push({ from: page.url, to: link.href, redirect: target.chain.map((hop) => hop.status) });
  }
}

const thinPages = htmlPages.filter((page) => page.words < 300).map((page) => ({ url: page.url, words: page.words }));
const thinMainPages = htmlPages.filter((page) => page.mainWords > 0 && page.mainWords < 300).map((page) => ({ url: page.url, mainWords: page.mainWords, words: page.words }));
const longTitles = htmlPages.filter((page) => page.titleLength > 60).map((page) => ({ url: page.url, length: page.titleLength, title: page.title }));
const shortTitles = htmlPages.filter((page) => page.titleLength > 0 && page.titleLength < 30).map((page) => ({ url: page.url, length: page.titleLength, title: page.title }));
const longDescriptions = htmlPages.filter((page) => page.descriptionLength > 160).map((page) => ({ url: page.url, length: page.descriptionLength }));
const missingDescriptions = htmlPages.filter((page) => !page.description).map((page) => page.url);
const missingH1 = htmlPages.filter((page) => !page.h1.length).map((page) => page.url);
const multipleH1 = htmlPages.filter((page) => page.h1.length > 1).map((page) => ({ url: page.url, h1: page.h1 }));
const noJsonLd = htmlPages.filter((page) => !page.jsonLdTypes.length).map((page) => page.url);

const timings = htmlPages.map((page) => page.totalMs).filter(Boolean).sort((a, b) => a - b);
const ttfb = htmlPages.map((page) => page.headersMs).filter(Boolean).sort((a, b) => a - b);
const percentile = (list, p) => (list.length ? list[Math.min(list.length - 1, Math.floor((list.length - 1) * p))] : null);

const report = {
  generatedAt: new Date().toISOString(),
  durationMs: Date.now() - startedAt,
  origin,
  robots,
  sitemap,
  probes: probeResults,
  counts: {
    crawled: all.length,
    sitemapUrls: sitemapUrls.length,
    html200: htmlPages.length,
    extras: all.filter((page) => page.extra).length,
    non200: all.filter((page) => page.status !== 200).length,
    noindex: noindexPages.length,
    missingCanonical: missingCanonical.length,
    canonicalMismatch: canonicalMismatch.length,
    canonicalOutsideSitemap: canonicalOutsideSitemap.length,
    duplicateTitles: duplicateTitles.length,
    duplicateDescriptions: duplicateDescriptions.length,
    thinPages: thinPages.length,
    thinMainPages: thinMainPages.length,
    imgMissingAlt: htmlPages.reduce((sum, page) => sum + page.imgMissingAlt, 0),
    imgDecorativeAlt: htmlPages.reduce((sum, page) => sum + page.imgDecorativeAlt, 0),
    orphans: orphans.length,
    unreachableFromHome: unreachable.length,
    brokenLinks: brokenLinks.length,
    noJsonLd: noJsonLd.length,
    missingH1: missingH1.length,
    multipleH1: multipleH1.length,
  },
  timing: {
    ttfbMs: { p50: percentile(ttfb, 0.5), p90: percentile(ttfb, 0.9), max: ttfb.at(-1) ?? null },
    totalMs: { p50: percentile(timings, 0.5), p90: percentile(timings, 0.9), max: timings.at(-1) ?? null },
    avgBytes: Math.round(htmlPages.reduce((sum, page) => sum + (page.bytes || 0), 0) / Math.max(1, htmlPages.length)),
    largestBytes: Math.max(0, ...htmlPages.map((page) => page.bytes || 0)),
  },
  issues: {
    noindexPages: noindexPages.map((page) => page.url),
    missingCanonical: missingCanonical.map((page) => page.url),
    canonicalMismatch: canonicalMismatch.map((page) => ({ url: page.url, canonical: page.canonical })),
    canonicalOutsideSitemap: canonicalOutsideSitemap.map((page) => ({ url: page.url, canonical: page.canonical })),
    duplicateTitles,
    duplicateDescriptions,
    thinPages,
    thinMainPages,
    orphans,
    unreachableFromHome: unreachable,
    depthHistogram,
    brokenLinks,
    noJsonLd,
    missingH1,
    multipleH1,
    longTitles,
    shortTitles,
    longDescriptions,
    missingDescriptions,
    failures,
    sitemapLastmods: sitemap.lastmods,
  },
  pages: all.map((page) => ({
    url: page.url,
    finalUrl: page.finalUrl,
    extra: page.extra,
    status: page.status,
    chain: page.chain,
    headersMs: page.headersMs,
    totalMs: page.totalMs,
    bytes: page.bytes,
    headers: page.headers,
    title: page.title,
    titleLength: page.titleLength,
    description: page.description,
    descriptionLength: page.descriptionLength,
    robots: page.robots,
    canonical: page.canonical,
    lang: page.lang,
    viewport: page.viewport,
    h1: page.h1,
    h2Count: page.h2Count,
    h3Count: page.h3Count,
    words: page.words,
    mainWords: page.mainWords,
    textHtmlRatio: page.textHtmlRatio,
    jsonLdTypes: page.jsonLdTypes,
    jsonLdErrors: page.jsonLdErrors,
    ogTitle: page.ogTitle,
    ogDescription: page.ogDescription,
    ogImage: page.ogImage,
    twitterCard: page.twitterCard,
    images: page.images,
    imgMissingAlt: page.imgMissingAlt,
    imgDecorativeAlt: page.imgDecorativeAlt,
    imgLazy: page.imgLazy,
    imgNextGen: page.imgNextGen,
    internalLinkCount: page.internalLinkCount,
    externalLinkCount: page.externalLinkCount,
    externalScripts: page.externalScripts,
    blockingScripts: page.blockingScripts,
    stylesheets: page.stylesheets,
    preloads: page.preloads,
    hreflang: page.hreflang,
    depth: depth.get(page.key) ?? null,
    inbound: inbound.get(page.key) ?? 0,
  })),
};

await fs.mkdir(path.dirname(outPath), { recursive: true });
await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`[seo] wrote ${outPath} in ${Math.round((Date.now() - startedAt) / 1000)}s`);
console.log(
  JSON.stringify(
    {
      counts: report.counts,
      timing: report.timing,
      robots: { status: robots.status, sitemaps: robots.sitemaps, disallow: robots.disallow.slice(0, 6) },
      probes: Object.fromEntries(Object.entries(probeResults).map(([name, probe]) => [name, { status: probe.status, final: probe.finalUrl, title: probe.title }])),
    },
    null,
    2,
  ),
);
