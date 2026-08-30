#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_ORIGIN = "https://www.mydreamshoots.com";
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_BATCH_SIZE = Number(process.env.MYDREAMSHOOTS_AUDIT_BATCH_SIZE || 2);
const MAX_REDIRECTS = 5;

const INTERNAL_MARKERS = [
  /\brelease-commit\b/i,
  /\bstorefront-data-source\b/i,
  /\bstorefront-build\b/i,
  /\bstorefront-facts-revision\b/i,
  /\bx-storefront-/i,
  /\bx-sitemap-/i,
  /\bsearch intent\b/i,
  /\bkeyword ownership\b/i,
  /\bquery ownership\b/i,
  /\bdo not index\b/i,
  /\bbefore launch\b/i,
  /\blanding-page hero\b/i,
  /\breview required\b/i
];
const FORBIDDEN_HEADER_MARKERS = [/^x-storefront-/i, /^x-sitemap-/i, /^x-powered-by$/i];
const FORBIDDEN_DOM_MARKERS = [
  /<meta\b[^>]*\bname=["']keywords["']/i,
  /data-xfcart-block-legacy-id\s*=/i,
  /data-section-(?:id|type|style)\s*=/i
];
const FORBIDDEN_ALT_MARKERS = /\b(?:scene\s*\d+|visual reference|production prompt|prompt(?:ed)?|camera shot|toma|encuadre|recorte)\b/i;

function normalizeUrl(value, origin = DEFAULT_ORIGIN) {
  const url = new URL(value, origin);
  url.protocol = "https:";
  url.hash = "";
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString();
}

function attrValue(tag, name) {
  const match = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1] ?? "";
}

function firstTag(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, "i"))?.[0] ?? "";
}

function allTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function extractMeta(html, key, attribute = "name") {
  for (const tag of allTags(html, "meta")) {
    if (attrValue(tag, attribute).toLowerCase() === key.toLowerCase()) return attrValue(tag, "content");
  }
  return "";
}

function extractLink(html, relation) {
  for (const tag of allTags(html, "link")) {
    const rel = attrValue(tag, "rel").split(/\s+/).map((item) => item.toLowerCase());
    if (rel.includes(relation.toLowerCase())) return attrValue(tag, "href");
  }
  return "";
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function pageTypeForUrl(value) {
  const pathname = new URL(value).pathname;
  if (pathname === "/") return "home";
  if (/^\/(?:privacy|terms|cookies|refunds|content|shipping|children-privacy|state-privacy)$/.test(pathname)) return "policy";
  if (pathname === "/blog") return "blog-directory";
  if (pathname.startsWith("/blog/")) return "article";
  if (/^\/ai-(?:image|video)-generation$/.test(pathname) || /^\/best-/.test(pathname)) return "directory";
  if (/^\/ai-(?:image|video)-generation\//.test(pathname) || pathname.startsWith("/ai-save-the-date/")) return "theme-detail";
  return "standard-page";
}

function pageFamily(value) {
  const parts = new URL(value).pathname.split("/").filter(Boolean);
  return parts.length > 1 ? `/${parts[0]}` : "/";
}

function firstMainAction(html, origin) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? "";
  for (const match of main.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attrValue(`<a ${match[1]}>`, "href");
    const label = stripTags(match[2]);
    if (!href || !label || /^(?:#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try {
      const url = new URL(href, origin);
      if (url.host === new URL(origin).host) return { label, url: url.toString() };
    } catch {
      // Invalid public hrefs are handled by the link checks.
    }
  }
  return null;
}

function parseJsonLd(html) {
  const nodes = [];
  const errors = [];
  const appendNode = (value) => {
    if (Array.isArray(value)) {
      value.forEach(appendNode);
      return;
    }
    if (!value || typeof value !== "object") return;
    nodes.push(value);
    if (Array.isArray(value["@graph"])) value["@graph"].forEach(appendNode);
  };
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    const raw = match[1].trim();
    try {
      const parsed = JSON.parse(raw);
      appendNode(parsed);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { nodes, errors };
}

function jsonLdTypes(nodes) {
  return nodes.flatMap((node) => {
    const type = node && typeof node === "object" ? node["@type"] : undefined;
    return Array.isArray(type) ? type : typeof type === "string" ? [type] : [];
  });
}

function breadcrumbLastUrl(nodes) {
  const breadcrumb = nodes.find((node) => {
    const type = node && typeof node === "object" ? node["@type"] : undefined;
    return type === "BreadcrumbList" || (Array.isArray(type) && type.includes("BreadcrumbList"));
  });
  const items = breadcrumb?.itemListElement;
  const last = Array.isArray(items) ? items.at(-1) : undefined;
  const item = last && typeof last === "object" ? last.item : last;
  if (typeof item === "string") return item;
  if (item && typeof item === "object" && typeof item["@id"] === "string") return item["@id"];
  return "";
}

export function parseSitemap(xml, origin = DEFAULT_ORIGIN) {
  const entries = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((match) => {
    const block = match[1];
    const loc = block.match(/<loc>([^<]+)<\/loc>/i)?.[1]?.trim() ?? "";
    const images = [...block.matchAll(/<image:loc>([^<]+)<\/image:loc>/gi)].map((item) => item[1].trim());
    return { loc, images };
  });
  const urls = entries.map((entry) => entry.loc).filter(Boolean);
  const normalized = urls.map((url) => normalizeUrl(url, origin));
  const expectedHost = new URL(origin).host;
  const issues = [];
  if (new Set(urls).size !== urls.length) issues.push("duplicate_loc");
  if (urls.some((url) => new URL(url, origin).host !== expectedHost)) issues.push("cross_host_loc");
  if (urls.some((url) => new URL(url, origin).protocol !== "https:")) issues.push("non_https_loc");
  return { entries, urls, normalizedUrls: normalized, issues };
}

export function evaluatePage({ requestedUrl, status, finalUrl, headers = {}, html = "", error = "" }) {
  const normalizedRequested = normalizeUrl(requestedUrl);
  const normalizedFinal = finalUrl ? normalizeUrl(finalUrl) : "";
  const title = stripTags(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const description = extractMeta(html, "description");
  const canonical = extractLink(html, "canonical");
  const ogUrl = extractMeta(html, "og:url", "property");
  const twitterUrl = extractMeta(html, "twitter:url");
  const robots = extractMeta(html, "robots");
  const htmlLang = attrValue(firstTag(html, "html"), "lang");
  const h1Count = allTags(html, "h1").length;
  const h1 = stripTags(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  const jsonLd = parseJsonLd(html);
  const breadcrumb = breadcrumbLastUrl(jsonLd.nodes);
  const internalMarkers = [
    ...INTERNAL_MARKERS,
    ...FORBIDDEN_DOM_MARKERS
  ].filter((marker) => marker.test(html)).map((marker) => marker.source);
  const altMarkers = [...html.matchAll(/\balt=["']([^"']*)["']/gi)]
    .filter((match) => !/mydreamshoots\b.*\blogo\b/i.test(match[1]) && FORBIDDEN_ALT_MARKERS.test(match[1]))
    .map((match) => match[1]);
  const internalHeaderMarkers = Object.keys(headers)
    .filter((name) => FORBIDDEN_HEADER_MARKERS.some((marker) => marker.test(name)));
  const hasMainBody = /<(?:main|body)\b/i.test(html) && stripTags(html.replace(/<head[\s\S]*?<\/head>/i, "")).length > 80;
  const nextAction = firstMainAction(html, normalizedFinal || normalizedRequested);
  const jsonTypes = jsonLdTypes(jsonLd.nodes);
  const pageSpecificEvidence = {
    h2Count: allTags(html, "h2").length,
    h3Count: allTags(html, "h3").length,
    imageCount: allTags(html, "img").length,
    faqCount: allTags(html, "details").length,
    internalLinkCount: allTags(html, "a").filter((tag) => {
      const href = attrValue(tag, "href");
      try {
        return Boolean(href) && new URL(href, normalizedFinal || normalizedRequested).host === new URL(normalizedRequested).host;
      } catch {
        return false;
      }
    }).length,
    jsonLdTypes: jsonTypes
  };
  const failures = [];

  if (error) failures.push("request_error");
  if (status === 200 && !title) failures.push("missing_title");
  if (status === 200 && !description) failures.push("missing_description");
  if (status === 200 && !extractMeta(html, "og:title", "property")) failures.push("missing_og_title");
  if (status === 200 && !extractMeta(html, "og:description", "property")) failures.push("missing_og_description");
  if (status === 200 && !extractMeta(html, "og:url", "property")) failures.push("missing_og_url");
  if (status === 200 && !extractMeta(html, "twitter:card")) failures.push("missing_twitter_card");
  if (status === 200 && !extractMeta(html, "twitter:title")) failures.push("missing_twitter_title");
  if (status === 200 && !extractMeta(html, "twitter:description")) failures.push("missing_twitter_description");
  if (status === 200 && h1Count !== 1) failures.push(`h1_count_${h1Count}`);
  if (status === 200 && !canonical) failures.push("missing_canonical");
  if (status === 200 && canonical && normalizeUrl(canonical, normalizedFinal || normalizedRequested) !== normalizedRequested) failures.push("canonical_mismatch");
  if (status === 200 && ogUrl && normalizeUrl(ogUrl, normalizedFinal || normalizedRequested) !== normalizedRequested) failures.push("og_url_mismatch");
  if (status === 200 && twitterUrl && normalizeUrl(twitterUrl, normalizedFinal || normalizedRequested) !== normalizedRequested) failures.push("twitter_url_mismatch");
  if (status === 200 && breadcrumb && normalizeUrl(breadcrumb, normalizedFinal || normalizedRequested) !== normalizedRequested) failures.push("breadcrumb_mismatch");
  if (status === 200 && !hasMainBody) failures.push("missing_ssr_body");
  if (status === 200 && jsonLd.nodes.length === 0) failures.push("missing_json_ld");
  if (status === 200 && jsonLd.errors.length) failures.push("invalid_json_ld");
  if (status === 200 && internalMarkers.length) failures.push("internal_information_leak");
  if (status === 200 && altMarkers.length) failures.push("forbidden_alt_content");
  if (internalHeaderMarkers.length) failures.push("internal_response_header");
  if (status === 200 && !html.includes("/_next/static/")) failures.push("missing_next_static");
  if (status === 200 && /\bnoindex\b/i.test(robots)) failures.push("sitemap_page_noindex");
  if (status === 200 && headers["x-robots-tag"] && /\bnoindex\b/i.test(headers["x-robots-tag"])) failures.push("header_noindex");
  if (status === 200 && normalizedFinal !== normalizedRequested) failures.push("final_url_mismatch");

  let state = "REVIEW_REQUIRED";
  if (status >= 300 && status < 400) state = "REDIRECT";
  else if (status === 404 || status === 410) state = "NOT_FOUND";
  else if (status === 200 && /\bnoindex\b/i.test(robots)) state = "NOINDEX";
  else if (status === 200 && failures.length === 0) state = "INDEXABLE";

  return {
    requestedUrl: normalizedRequested,
    finalUrl: normalizedFinal,
    status,
    state,
    title,
    description,
    h1,
    h1Count,
    htmlLang,
    robots,
    canonical,
    ogUrl,
    twitterUrl,
    breadcrumb,
    jsonLdTypes: jsonTypes,
    hasMainBody,
    internalMarkers,
    altMarkers,
    internalHeaderMarkers,
    seoSummary: {
      site: new URL(normalizedRequested).host,
      route: new URL(normalizedRequested).pathname,
      finalUrl: normalizedFinal,
      pageType: pageTypeForUrl(normalizedRequested),
      userProblem: description,
      mainObjectScenarioOrFunction: h1 || title,
      adjacentPageFamily: pageFamily(normalizedRequested),
      primaryKeywordTheme: h1 || title,
      nextAction,
      pageSpecificEvidence,
      allowedIndexState: state
    },
    failures,
    error: error || undefined
  };
}

async function fetchWithRedirects(url, timeoutMs, fetchBaseUrl, publicOrigin) {
  const chain = [];
  let current = url;
  for (let index = 0; index <= MAX_REDIRECTS; index += 1) {
    const publicUrl = new URL(current, publicOrigin);
    const requestUrl = new URL(`${publicUrl.pathname}${publicUrl.search}`, fetchBaseUrl);
    let response;
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await fetch(requestUrl, {
          redirect: "manual",
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            host: publicOrigin.host,
            "x-forwarded-host": publicOrigin.host,
            "user-agent": "mydreamshoots-public-contract-audit/1.0"
          }
        });
        break;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    if (!response) throw lastError ?? new Error(`request_failed:${requestUrl}`);
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      const next = new URL(location, requestUrl);
      const nextPublicUrl = new URL(`${next.pathname}${next.search}`, publicOrigin).toString();
      chain.push({ url: current, status: response.status, location: nextPublicUrl });
      current = nextPublicUrl;
      continue;
    }
    const headers = Object.fromEntries(response.headers.entries());
    return { status: response.status, finalUrl: current, headers, chain, html: await response.text() };
  }
  throw new Error(`redirect_limit_exceeded:${url}`);
}

function imageDuplicateGroups(entries) {
  const owners = new Map();
  for (const entry of entries) {
    if (!/^https:\/\/www\.mydreamshoots\.com\/ai-(?:image|video)-generation\/[^/]+$/.test(entry.loc)) continue;
    for (const image of entry.images) {
      const key = image.split("?")[0];
      const current = owners.get(key) ?? new Set();
      current.add(entry.loc);
      owners.set(key, current);
    }
  }
  return [...owners.entries()]
    .filter(([, urls]) => urls.size > 1)
    .map(([image, urls]) => ({ image, owners: [...urls].sort() }));
}

async function audit(origin, timeoutMs, maxPages, fetchBaseUrl) {
  const sitemapUrl = `${origin}/sitemap.xml`;
  const publicOrigin = new URL(origin);
  const sitemapResponse = await fetchWithRedirects(sitemapUrl, timeoutMs, fetchBaseUrl, publicOrigin);
  const sitemap = parseSitemap(sitemapResponse.html, origin);
  const sitemapHeaderLeaks = Object.keys(sitemapResponse.headers).filter((name) => FORBIDDEN_HEADER_MARKERS.some((marker) => marker.test(name)));
  if (sitemapResponse.status !== 200) sitemap.issues.push(`sitemap_status_${sitemapResponse.status}`);
  if (sitemapHeaderLeaks.length) sitemap.issues.push(`sitemap_internal_headers:${sitemapHeaderLeaks.join(",")}`);
  const robotsResponse = await fetchWithRedirects(`${origin}/robots.txt`, timeoutMs, fetchBaseUrl, publicOrigin);
  const robotsHeaderLeaks = Object.keys(robotsResponse.headers).filter((name) => FORBIDDEN_HEADER_MARKERS.some((marker) => marker.test(name)));
  const robotsIssues = [];
  if (robotsResponse.status !== 200) robotsIssues.push(`robots_status_${robotsResponse.status}`);
  if (robotsHeaderLeaks.length) robotsIssues.push(`robots_internal_headers:${robotsHeaderLeaks.join(",")}`);
  if (INTERNAL_MARKERS.some((marker) => marker.test(robotsResponse.html))) robotsIssues.push("robots_internal_body_marker");
  const urls = sitemap.normalizedUrls.slice(0, maxPages || sitemap.normalizedUrls.length);
  const pages = [];
  for (let start = 0; start < urls.length; start += MAX_BATCH_SIZE) {
    const batch = urls.slice(start, start + MAX_BATCH_SIZE);
    const results = await Promise.all(batch.map(async (url) => {
      try {
        const response = await fetchWithRedirects(url, timeoutMs, fetchBaseUrl, publicOrigin);
        return evaluatePage({ requestedUrl: url, ...response });
      } catch (error) {
        return evaluatePage({ requestedUrl: url, status: 0, finalUrl: "", error: error instanceof Error ? error.message : String(error) });
      }
    }));
    pages.push(...results);
  }
  const titleOwners = new Map();
  const descriptionOwners = new Map();
  for (const page of pages) {
    for (const [value, owners] of [[page.title, titleOwners], [page.description, descriptionOwners]]) {
      if (!value) continue;
      const current = owners.get(value) ?? [];
      current.push(page.requestedUrl);
      owners.set(value, current);
    }
  }
  for (const page of pages) {
    const duplicateTitleUrls = (titleOwners.get(page.title) ?? []).filter((url) => url !== page.requestedUrl);
    const duplicateDescriptionUrls = (descriptionOwners.get(page.description) ?? []).filter((url) => url !== page.requestedUrl);
    page.seoSummary.adjacentDifferentiation = {
      uniqueTitle: duplicateTitleUrls.length === 0,
      uniqueDescription: duplicateDescriptionUrls.length === 0,
      duplicateTitleUrls,
      duplicateDescriptionUrls
    };
    if (page.status === 200 && duplicateTitleUrls.length) page.failures.push("duplicate_title");
    if (page.status === 200 && duplicateDescriptionUrls.length) page.failures.push("duplicate_description");
    if (page.status === 200 && page.failures.length) page.state = "REVIEW_REQUIRED";
    page.seoSummary.allowedIndexState = page.state;
  }
  const statusCounts = Object.fromEntries([...new Set(pages.map((page) => page.status || "error"))].map((status) => [status, pages.filter((page) => (page.status || "error") === status).length]));
  const stateCounts = Object.fromEntries([...new Set(pages.map((page) => page.state))].map((state) => [state, pages.filter((page) => page.state === state).length]));
  const result = {
    recordedAt: new Date().toISOString(),
    origin,
    batchSize: MAX_BATCH_SIZE,
    coverageComplete: !maxPages || maxPages >= sitemap.normalizedUrls.length,
    sitemap: {
      url: sitemapUrl,
      status: sitemapResponse.status,
      finalUrl: sitemapResponse.finalUrl,
      urlCount: sitemap.urls.length,
      uniqueUrlCount: new Set(sitemap.normalizedUrls).size,
      imageReferenceCount: sitemap.entries.reduce((count, entry) => count + entry.images.length, 0),
      issues: sitemap.issues,
      robotsIssues,
      detailImageDuplicateGroups: imageDuplicateGroups(sitemap.entries)
    },
    summary: {
      pageCount: pages.length,
      statusCounts,
      stateCounts,
      pagesWithFailures: pages.filter((page) => page.failures.length).length,
      internalLeakPages: pages.filter((page) => page.internalMarkers.length).length,
      timeoutOrRequestErrorPages: pages.filter((page) => page.error).length
    },
    performance: {
      status: "REVIEW_REQUIRED",
      reason: "PageSpeed Insights API key was not supplied; no performance claim was made."
    },
    pages
  };
  result.liveWebStandard = result.summary.internalLeakPages > 0 || result.sitemap.issues.length > 0 || result.sitemap.robotsIssues.length > 0
    ? "PUBLISH_BLOCKED"
    : result.summary.pagesWithFailures > 0 || result.performance.status === "REVIEW_REQUIRED"
      ? "REVIEW_REQUIRED"
      : "READY_FOR_APPROVAL";
  return result;
}

function cliValue(args, name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

async function main() {
  const args = process.argv.slice(2);
  const origin = cliValue(args, "--base-url", process.env.MYDREAMSHOOTS_PUBLIC_ORIGIN || DEFAULT_ORIGIN).replace(/\/$/, "");
  const timeoutMs = Number(cliValue(args, "--timeout-ms", DEFAULT_TIMEOUT_MS));
  const maxPagesValue = cliValue(args, "--max-pages", "");
  const maxPages = maxPagesValue ? Number(maxPagesValue) : undefined;
  const output = cliValue(args, "--output", "");
  const fetchBaseUrl = cliValue(args, "--fetch-base-url", process.env.MYDREAMSHOOTS_FETCH_BASE_URL || origin).replace(/\/$/, "");
  const result = await audit(origin, timeoutMs, maxPages, fetchBaseUrl);
  if (output) {
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify({
    ok: result.coverageComplete && result.sitemap.issues.length === 0 && result.sitemap.robotsIssues.length === 0 && result.summary.pagesWithFailures === 0,
    output: output || null,
    coverageComplete: result.coverageComplete,
    liveWebStandard: result.liveWebStandard,
    sitemap: result.sitemap,
    summary: result.summary
  }, null, 2));
  if (!result.coverageComplete || result.sitemap.issues.length || result.sitemap.robotsIssues.length || result.summary.pagesWithFailures) process.exitCode = 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) await main();
