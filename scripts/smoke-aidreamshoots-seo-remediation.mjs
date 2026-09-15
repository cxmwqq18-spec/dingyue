#!/usr/bin/env node

import http from "node:http";
import https from "node:https";
import assert from "node:assert/strict";

const origin = process.env.AIDREAMSHOOTS_SMOKE_ORIGIN || "http://127.0.0.1:3002";
const productionHost = process.env.AIDREAMSHOOTS_SMOKE_HOST || "aidreamshoots.eu";
const productionOrigin = `https://${productionHost}`;
const requestTimeoutMs = Number(process.env.AIDREAMSHOOTS_SMOKE_TIMEOUT_MS || 20000);
const retryCount = Number(process.env.AIDREAMSHOOTS_SMOKE_RETRIES || 2);
const skipSitemapStatus = process.env.AIDREAMSHOOTS_SMOKE_SKIP_SITEMAP_STATUS === "1";

const defaultRepresentativePaths = [
  "/",
  "/pricing",
  "/faq",
  "/workflow",
  "/blog",
  "/blog/video-photo-package-guide",
  "/ai-image-generation",
  "/ai-image-generation/headshot",
  "/ai-save-the-date/christmas"
];
const representativePaths = (process.env.AIDREAMSHOOTS_SMOKE_REPRESENTATIVE_PATHS || "")
  .split(",")
  .map((value) => normalizePath(value.trim()))
  .filter((value, index, values) => values.indexOf(value) === index);
if (!representativePaths.length) representativePaths.push(...defaultRepresentativePaths);

const aliasExpectations = [
  ["/collections", "/ai-image-generation"],
  ["/collections/headshot", "/ai-image-generation/headshot"],
  ["/collections/belleza", "/ai-image-generation/beauty"],
  ["/ai-video-generation/christmas", "/ai-save-the-date/christmas"]
];

const failures = [];
const checks = [];

function check(name, condition, details = undefined) {
  checks.push({ name, ok: Boolean(condition), ...(details ? { details } : {}) });
  if (!condition) failures.push({ name, ...(details ? { details } : {}) });
}

function decodeHtml(value) {
  return String(value ?? "")
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function normalizePath(value) {
  const raw = String(value || "/").split(/[?#]/, 1)[0] || "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

function attr(tag, name) {
  return decodeHtml(tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1] ?? "");
}

function hasAttr(tag, name, value) {
  return new RegExp(`\\b${name}\\s*=\\s*["']${value}["']`, "i").test(tag);
}

function openTags(html, tagName) {
  return [...String(html).matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map((match) => match[0]);
}

function innerTexts(html, tagName) {
  return [...String(html).matchAll(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "gi"))]
    .map((match) => decodeHtml(match[1]).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseJsonLd(html) {
  const scripts = [...String(html).matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1].trim());
  const nodes = [];
  const errors = [];
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(script));
      if (Array.isArray(parsed?.["@graph"])) nodes.push(...parsed["@graph"]);
      else if (Array.isArray(parsed)) nodes.push(...parsed);
      else nodes.push(parsed);
    } catch (error) {
      errors.push(String(error?.message ?? error));
    }
  }
  return { scripts, nodes, errors };
}

function typesFor(node) {
  return new Set((Array.isArray(node?.["@type"]) ? node["@type"] : [node?.["@type"]]).filter(Boolean));
}

function request(pathname, { method = "GET", host = productionHost, maxBytes = 2_000_000 } = {}) {
  const url = new URL(pathname, origin);
  const transport = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    let settled = false;
    let requestInstance;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(totalTimeout);
      callback(value);
    };
    const totalTimeout = setTimeout(() => {
      requestInstance?.destroy();
      finish(reject, new Error(`request timeout after ${requestTimeoutMs}ms`));
    }, requestTimeoutMs);
    requestInstance = transport.request(url, {
      method,
      headers: {
        accept: method === "HEAD" ? "*/*" : "text/html,application/xml;q=0.9,*/*;q=0.8",
        host
      }
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.setEncoding("utf8");
      response.on("data", (chunk) => {
        if (size < maxBytes) {
          chunks.push(chunk.slice(0, maxBytes - size));
          size += chunk.length;
        }
      });
      response.on("end", () => finish(resolve, {
        status: response.statusCode || 0,
        headers: Object.fromEntries(Object.entries(response.headers).map(([key, value]) => [key.toLowerCase(), Array.isArray(value) ? value.join(", ") : String(value ?? "")])),
        body: chunks.join("")
      }));
      response.on("error", (error) => finish(reject, error));
    });
    requestInstance.setTimeout(requestTimeoutMs, () => requestInstance.destroy(new Error(`request timeout after ${requestTimeoutMs}ms`)));
    requestInstance.on("error", (error) => finish(reject, error));
    requestInstance.end();
  });
}

async function requestWithRetry(pathname, options = {}) {
  let lastError;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      return await request(pathname, options);
    } catch (error) {
      lastError = error;
      if (attempt < retryCount) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

function absoluteCanonical(pathname) {
  return `${productionOrigin}${normalizePath(pathname)}`;
}

function locationHeader(response) {
  return response.headers.location ? new URL(response.headers.location, productionOrigin).toString().replace(/\/$/, "") : "";
}

function extractSitemapLocs(xml) {
  return [...String(xml).matchAll(/<loc>([\s\S]*?)<\/loc>/gi)].map((match) => decodeHtml(match[1]).trim()).filter(Boolean);
}

function inspectPage(pathname, response) {
  const htmlTag = response.body.match(/<html\b[^>]*>/i)?.[0] || "";
  const title = response.body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g, "").trim() || "";
  const descriptions = openTags(response.body.match(/<head\b[\s\S]*?<\/head>/i)?.[0] || response.body, "meta")
    .filter((tag) => hasAttr(tag, "name", "description"))
    .map((tag) => attr(tag, "content"));
  const canonicals = openTags(response.body, "link")
    .filter((tag) => /\brel=["']canonical["']/i.test(tag))
    .map((tag) => attr(tag, "href"));
  const robots = openTags(response.body, "meta")
    .filter((tag) => hasAttr(tag, "name", "robots"))
    .map((tag) => attr(tag, "content"));
  const images = openTags(response.body.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || response.body, "img");
  const emptyImageAlts = images.filter((tag) => {
    const alt = attr(tag, "alt").trim();
    return !alt && !hasAttr(tag, "aria-hidden", "true") && !/\brole=["'](?:presentation|none)["']/i.test(tag);
  });
  const sources = [
    ...openTags(response.body, "img").map((tag) => attr(tag, "src")),
    ...[...response.body.matchAll(/<(?:a|link)\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => decodeHtml(match[1]))
  ];
  const badSources = sources.filter((value) => {
    const source = String(value || "").trim();
    return source.includes("localhost") || source.includes("127.0.0.1") || /^http:\/\//i.test(source) || /^\/?collections(?:\/|$)/i.test(source);
  });
  const jsonLd = parseJsonLd(response.body);
  const jsonLdTypes = new Set(jsonLd.nodes.flatMap((node) => [...typesFor(node)]));
  const h1s = innerTexts(response.body.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || response.body, "h1");
  const isBlog = pathname === "/blog" || pathname.startsWith("/blog/");
  const isThemeDetail = /^\/ai-image-generation\/[^/]+$/i.test(pathname);

  check(`${pathname}: HTTP 200`, response.status === 200, response.status);
  check(`${pathname}: lang=es`, attr(htmlTag, "lang") === "es", attr(htmlTag, "lang"));
  check(`${pathname}: one non-empty title`, title.length > 0, title);
  check(`${pathname}: one non-empty description`, descriptions.length === 1 && descriptions[0].trim().length > 0, descriptions);
  check(`${pathname}: canonical is production URL`, canonicals.length === 1 && canonicals[0].replace(/\/$/, "") === absoluteCanonical(pathname).replace(/\/$/, ""), canonicals);
  check(`${pathname}: indexable robots`, robots.length === 1 && /\bindex\b/i.test(robots[0]) && /\bfollow\b/i.test(robots[0]), robots);
  check(`${pathname}: one primary H1`, h1s.length === 1, h1s);
  check(`${pathname}: images have descriptive alt`, emptyImageAlts.length === 0, emptyImageAlts.slice(0, 5));
  check(`${pathname}: no legacy/local/http links`, badSources.length === 0, badSources.slice(0, 10));
  check(`${pathname}: JSON-LD parses`, jsonLd.errors.length === 0, jsonLd.errors);
  if (isBlog) {
    check(`${pathname}: Article/BlogPosting JSON-LD`, jsonLdTypes.has("Article") || jsonLdTypes.has("BlogPosting"), [...jsonLdTypes]);
    check(`${pathname}: BreadcrumbList JSON-LD`, jsonLdTypes.has("BreadcrumbList"), [...jsonLdTypes]);
  }
  if (isThemeDetail) check(`${pathname}: BreadcrumbList JSON-LD`, jsonLdTypes.has("BreadcrumbList"), [...jsonLdTypes]);
}

async function run() {
  const sitemapResponse = await requestWithRetry("/sitemap.xml", { host: productionHost, maxBytes: 8_000_000 });
  check("sitemap.xml: HTTP 200", sitemapResponse.status === 200, sitemapResponse.status);
  check("sitemap.xml: XML content type", /application\/xml/i.test(sitemapResponse.headers["content-type"] || ""), sitemapResponse.headers["content-type"]);
  const sitemapLocs = extractSitemapLocs(sitemapResponse.body);
  const sitemapPaths = sitemapLocs.map((loc) => new URL(loc).pathname);
  check("sitemap.xml: has public URLs", sitemapLocs.length > 0, sitemapLocs.length);
  check("sitemap.xml: no duplicate URLs", new Set(sitemapLocs).size === sitemapLocs.length, { total: sitemapLocs.length });
  check("sitemap.xml: absolute production HTTPS URLs", sitemapLocs.every((loc) => loc.startsWith(`${productionOrigin}/`)), sitemapLocs.filter((loc) => !loc.startsWith(`${productionOrigin}/`)).slice(0, 10));
  check("sitemap.xml: no alias URLs", sitemapPaths.every((path) => !/^\/collections(?:\/|$)/i.test(path) && !/^\/ai-image-generation\/collections-/i.test(path) && !/^\/ai-video-generation\/(christmas|engagement|fathers-day|halloween|mothers-day|new-year|proposal|save-the-date|thanksgiving|valentines-day|wedding-ceremony|wedding-invitation)$/i.test(path)), sitemapPaths.filter((path) => /^\/collections(?:\/|$)/i.test(path) || /^\/ai-image-generation\/collections-/i.test(path)));
  check("sitemap.xml: excludes private/error paths", sitemapPaths.every((path) => !/^\/(login|404|account|app|dashboard|gallery)(?:\/|$)/i.test(path)), sitemapPaths.filter((path) => /^\/(login|404|account|app|dashboard|gallery)(?:\/|$)/i.test(path)));

  if (!skipSitemapStatus) {
    for (const path of sitemapPaths) {
      try {
        const response = await requestWithRetry(path, { method: "HEAD", host: productionHost, maxBytes: 20_000 });
        check(`sitemap route ${path}: HTTP 200`, response.status === 200, response.status);
      } catch (error) {
        check(`sitemap route ${path}: reachable`, false, String(error?.message ?? error));
      }
    }
  }

  for (const pathname of representativePaths) {
    try {
      inspectPage(pathname, await requestWithRetry(pathname, { host: productionHost }));
    } catch (error) {
      check(`${pathname}: request completed`, false, String(error?.message ?? error));
    }
  }

  for (const [source, target] of aliasExpectations) {
    try {
      const response = await requestWithRetry(source, { method: "HEAD", host: productionHost, maxBytes: 20_000 });
      check(`${source}: permanent redirect`, response.status === 308, response.status);
      check(`${source}: redirects to canonical`, locationHeader(response) === absoluteCanonical(target), locationHeader(response));
    } catch (error) {
      check(`${source}: redirect request completed`, false, String(error?.message ?? error));
    }
  }

  try {
    const notFound = await requestWithRetry("/not-found-seo-smoke", { method: "HEAD", host: productionHost, maxBytes: 20_000 });
    check("unknown public path: HTTP 404", notFound.status === 404, notFound.status);
  } catch (error) {
    check("unknown public path: request completed", false, String(error?.message ?? error));
  }

  try {
    const local = await requestWithRetry("/site/aidreamshoots", { host: "localhost:3002" });
    check("local storefront: noindex header", /\bnoindex\b/i.test(local.headers["x-robots-tag"] || "") && /\bnofollow\b/i.test(local.headers["x-robots-tag"] || ""), local.headers["x-robots-tag"]);
  } catch (error) {
    check("local storefront: request completed", false, String(error?.message ?? error));
  }

  const result = {
    ok: failures.length === 0,
    origin,
    productionHost,
    sitemapUrls: sitemapLocs.length,
    sitemapStatusChecked: !skipSitemapStatus,
    checks: checks.length,
    failures
  };
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exitCode = 1;
}

try {
  await run();
} catch (error) {
  assert.fail(String(error?.stack ?? error));
}
