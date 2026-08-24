import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliasPath = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : "";
  const resolvedRequest = aliasPath && fs.existsSync(`${aliasPath}.ts`) ? `${aliasPath}.ts` : aliasPath || request;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};
const jiti = createJiti(import.meta.url);
const { sitemapEntriesForSite } = jiti("../src/lib/seo-indexing.ts");
const baseUrl = new URL((process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, ""));
const stateArgument = process.argv.find((value) => value.startsWith("--state="))?.slice("--state=".length);
if (stateArgument || process.env.SEO_REVIEW_STATE_PATH) {
  throw new Error("Sitemap state fixtures are disabled; read the PostgreSQL publication source instead.");
}
const state = await readPlatformStateFromSql();
const timeoutMs = Number(process.env.SITEMAP_SMOKE_SITEMAP_TIMEOUT_MS ?? 120_000);
const pageTimeoutMs = Number(process.env.SITEMAP_SMOKE_PAGE_TIMEOUT_MS ?? 45_000);
const pageConcurrency = Math.max(1, Number(process.env.SITEMAP_SMOKE_PAGE_CONCURRENCY ?? 2));
const targets = [
  { siteId: "site_dreamshoot", host: "www.mydreamshoots.com" },
  { siteId: "site_aidreamcapes", host: "www.aidreamcapes.com" }
];

function originForHost(host) {
  const configured = process.env[`SITEMAP_SMOKE_${host.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_BASE_URL`];
  if (configured) return new URL(configured.replace(/\/$/, ""));
  if (baseUrl.hostname === host || baseUrl.hostname === `www.${host}`) return baseUrl;
  return new URL(`https://${host}`);
}

function normalizePath(value, fallback = "/") {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (/^https?:\/\//i.test(raw)) return normalizePath(new URL(raw).pathname, fallback);
  const pathname = raw.split("?")[0].split("#")[0] || fallback;
  return pathname === "/" ? "/" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
}

function expectedCanonicalPaths(state, site) {
  const publication = site.latestPublication;
  if (!publication?.id || !publication.snapshot) {
    throw new Error(`missing_published_theme_snapshot:${site.id}`);
  }
  const entries = sitemapEntriesForSite(state, site);
  return new Set(entries.map((entry) => normalizePath(new URL(entry.loc).pathname)));
}

function publicationIdentity(site) {
  const publication = site.latestPublication;
  return {
    publicationId: publication?.id ?? null,
    publicationVersion: publication?.version ?? null,
    snapshotHash: publication?.snapshot?.snapshotHash ?? null,
    factsRevision: publication?.factsRevision ?? publication?.snapshot?.revisions?.factsRevision ?? null
  };
}

function pathFamily(pathname) {
  if (pathname === "/" || pathname === "/workflow" || pathname === "/pricing" || pathname === "/faq" || pathname === "/about-us" || pathname === "/contact-us") return "base";
  if (["/privacy", "/terms", "/cookies", "/refunds", "/content", "/shipping", "/children-privacy", "/state-privacy"].includes(pathname)) return "policy";
  if (pathname === "/collections" || pathname.startsWith("/collections/")) return "collections";
  if (pathname === "/tools" || pathname.startsWith("/tools/")) return "tools";
  if (pathname === "/ai-image-generation" || pathname.startsWith("/ai-image-generation/")) return "image-themes";
  if (pathname === "/ai-video-generation" || pathname.startsWith("/ai-video-generation/")) return "video-themes";
  if (pathname === "/blog" || pathname.startsWith("/blog/")) return "blog";
  return "other";
}

function familyCounts(paths) {
  return [...paths].reduce((counts, pathname) => {
    const family = pathFamily(pathname);
    counts[family] = (counts[family] ?? 0) + 1;
    return counts;
  }, {});
}

function requestSitemap(host, method = "GET") {
  const origin = originForHost(host);
  const startedAt = Date.now();
  const client = origin.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request({
      protocol: origin.protocol,
      hostname: origin.hostname,
      port: origin.port,
      path: "/sitemap.xml",
      method,
      headers: { ...(origin.hostname === "localhost" || origin.hostname === "127.0.0.1" ? { host } : {}), accept: "application/xml" },
      timeout: timeoutMs
    }, (response) => {
      const chunks = [];
      let settled = false;
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        callback();
      };
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => finish(() => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8"), elapsedMs: Date.now() - startedAt })));
      response.on("aborted", () => finish(() => reject(new Error(`sitemap_aborted:${host}`))));
      response.on("error", (error) => finish(() => reject(error)));
      response.on("close", () => {
        if (!response.complete) finish(() => reject(new Error(`sitemap_incomplete:${host}`)));
      });
    });
    request.on("timeout", () => request.destroy(new Error(`sitemap_timeout:${host}`)));
    request.on("error", reject);
    request.end();
  });
}

function requestPage(host, pathname) {
  const origin = originForHost(host);
  const client = origin.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request({
      protocol: origin.protocol,
      hostname: origin.hostname,
      port: origin.port,
      path: pathname,
      method: "GET",
      headers: { ...(origin.hostname === "localhost" || origin.hostname === "127.0.0.1" ? { host } : {}), accept: "text/html" },
      timeout: pageTimeoutMs
    }, (response) => {
      const chunks = [];
      let settled = false;
      const finish = (callback) => {
        if (settled) return;
        settled = true;
        callback();
      };
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => finish(() => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") })));
      response.on("aborted", () => finish(() => reject(new Error(`page_aborted:${host}:${pathname}`))));
      response.on("error", (error) => finish(() => reject(error)));
      response.on("close", () => {
        if (!response.complete) finish(() => reject(new Error(`page_incomplete:${host}:${pathname}`)));
      });
    });
    request.on("timeout", () => request.destroy(new Error(`page_timeout:${host}:${pathname}`)));
    request.on("error", reject);
    request.end();
  });
}

async function requestPageWithRetry(host, pathname) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await requestPage(host, pathname);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
    }
  }
  throw lastError;
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html.match(new RegExp(`<meta\\s+name=["']${escaped}["']\\s+content=["']([^"']*)`, "i"))?.[1] ?? "";
}

function canonicalHref(html) {
  return html.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']*)/i)?.[1] ?? "";
}

async function validateLivePublishedPages(host, paths) {
  const failures = [];
  const publications = new Set();
  const factsRevisions = new Set();
  const queue = [...paths];
  const workers = Array.from({ length: Math.min(pageConcurrency, queue.length) }, async () => {
    while (queue.length) {
      const pathname = queue.shift();
      const response = await requestPageWithRetry(host, pathname);
      const expectedCanonical = new URL(pathname, `https://${host}`).toString().replace(/\/$/, pathname === "/" ? "" : "/");
      const canonical = canonicalHref(response.body).replace(/\/$/, pathname === "/" ? "" : "/");
      const robots = metaContent(response.body, "robots").toLowerCase();
      const publication = metaContent(response.body, "storefront-publication");
      const factsRevision = metaContent(response.body, "storefront-facts-revision");
      if (response.status !== 200 || canonical !== expectedCanonical || !robots.includes("index") || robots.includes("noindex") || !publication || publication === "unpublished" || !factsRevision) {
        failures.push({ pathname, status: response.status, canonical, expectedCanonical, robots, publication, factsRevision });
      }
      if (publication && publication !== "unpublished") publications.add(publication);
      if (factsRevision) factsRevisions.add(factsRevision);
    }
  });
  await Promise.all(workers);
  return { failures, publications: [...publications], factsRevisions: [...factsRevisions] };
}

function sitemapPaths(xml, host) {
  const urls = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (match) => match[1]);
  return {
    foreignHosts: urls.filter((value) => new URL(value).host !== host),
    paths: new Set(urls.map((value) => normalizePath(new URL(value).pathname)))
  };
}

const results = [];
for (const target of targets) {
  const response = await requestSitemap(target.host);
  if (response.status !== 200) throw new Error(`sitemap_status:${target.host}:${response.status}`);
  if (response.elapsedMs > timeoutMs) throw new Error(`sitemap_response_too_slow:${target.host}:${response.elapsedMs}`);
  const warmResponse = await requestSitemap(target.host);
  if (warmResponse.status !== 200 || warmResponse.elapsedMs > timeoutMs) throw new Error(`sitemap_warm_response_invalid:${target.host}:${warmResponse.status}:${warmResponse.elapsedMs}`);
  const head = await requestSitemap(target.host, "HEAD");
  if (head.status !== 200 || head.body.length !== 0) throw new Error(`sitemap_head_invalid:${target.host}:${head.status}:${head.body.length}`);
  const actual = sitemapPaths(response.body, target.host);
  const site = state?.sites.find((candidate) => candidate.id === target.siteId);
  if (state && !site) throw new Error(`missing_site:${target.siteId}`);
  const expected = state && site ? expectedCanonicalPaths(state, site) : undefined;
  const live = state ? undefined : await validateLivePublishedPages(target.host, actual.paths);
  results.push({
    siteId: target.siteId,
    host: target.host,
    mode: state ? "snapshot-set" : "live-publication",
    publication: site ? publicationIdentity(site) : null,
    expected: expected?.size ?? null,
    actual: actual.paths.size,
    coldElapsedMs: response.elapsedMs,
    warmElapsedMs: warmResponse.elapsedMs,
    expectedPathFamilies: expected ? familyCounts(expected) : {},
    actualPathFamilies: familyCounts(actual.paths),
    missing: expected ? [...expected].filter((value) => !actual.paths.has(value)) : [],
    unexpected: expected ? [...actual.paths].filter((value) => !expected.has(value)) : [],
    foreignHosts: actual.foreignHosts,
    liveFailures: live?.failures ?? [],
    publications: live?.publications ?? [],
    factsRevisions: live?.factsRevisions ?? []
  });
}

const failures = results.filter((result) =>
  result.missing.length ||
  result.unexpected.length ||
  result.foreignHosts.length ||
  result.liveFailures.length ||
  (result.mode === "live-publication" && (result.publications.length !== 1 || result.factsRevisions.length !== 1))
);
console.log(JSON.stringify({ ok: failures.length === 0, stateSource: "postgres:active-or-latest-theme-publication+seo-indexer", results }, null, 2));
if (failures.length) process.exitCode = 1;
