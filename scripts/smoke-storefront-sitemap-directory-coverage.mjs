import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import path from "node:path";

const repoRoot = process.cwd();
const baseUrl = new URL((process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, ""));
const stateArgument = process.argv.find((value) => value.startsWith("--state="))?.slice("--state=".length);
const configuredStatePath = stateArgument || process.env.SEO_REVIEW_STATE_PATH;
const statePath = configuredStatePath ? path.resolve(repoRoot, configuredStatePath) : undefined;
const state = statePath ? JSON.parse(fs.readFileSync(statePath, "utf8")) : undefined;
const timeoutMs = Number(process.env.SITEMAP_SMOKE_SITEMAP_TIMEOUT_MS ?? 120_000);
const pageTimeoutMs = Number(process.env.SITEMAP_SMOKE_PAGE_TIMEOUT_MS ?? 45_000);
const pageConcurrency = Math.max(1, Number(process.env.SITEMAP_SMOKE_PAGE_CONCURRENCY ?? 2));
const targets = [
  { siteId: "site_dreamshoot", host: "www.mydreamshoots.com" },
  { siteId: "site_aidreamcapes", host: "www.aidreamcapes.com" }
];

function normalizePath(value, fallback = "/") {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (/^https?:\/\//i.test(raw)) return normalizePath(new URL(raw).pathname, fallback);
  const pathname = raw.split("?")[0].split("#")[0] || fallback;
  return pathname === "/" ? "/" : `/${pathname.replace(/^\/+|\/+$/g, "")}`;
}

function canonicalPath(page) {
  const seo = page.publishedJson?.seo ?? {};
  return normalizePath(seo.canonical ?? seo.canonicalPath, page.slug);
}

function publishedPages(state, site) {
  const current = (site.pages ?? []).filter((page) => Array.isArray(page.publishedJson?.sectionsOrder));
  const publication = site.latestPublication ?? (state.themePublications ?? [])
    .filter((candidate) => candidate.siteId === site.id)
    .sort((left, right) => right.version - left.version)[0];
  const publicationPages = publication?.snapshot?.pages;
  if (!Array.isArray(publicationPages)) return current;
  const byId = new Map(publicationPages.map((page) => [page.id, page]));
  return current
    .filter((page) => byId.has(page.id))
    .map((page) => ({ ...page, ...byId.get(page.id), publishedJson: byId.get(page.id).publishedJson }));
}

function isIndexable(page) {
  const seo = page.publishedJson?.seo ?? {};
  if (page.pageType === "not_found" || page.slug === "/404") return false;
  return seo.index !== false && seo.robots?.index !== false;
}

function expectedCanonicalPaths(state, site) {
  const pages = publishedPages(state, site);
  const paths = new Set();
  for (const requestedPath of new Set(pages.map(canonicalPath))) {
    const directPage = pages.find((page) => normalizePath(page.slug) === requestedPath);
    const page = directPage ?? pages.find((candidate) => canonicalPath(candidate) === requestedPath);
    if (!page || !isIndexable(page)) continue;
    if (directPage && canonicalPath(page) !== requestedPath) continue;
    paths.add(requestedPath);
  }
  return paths;
}

function requestSitemap(host) {
  const client = baseUrl.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request({
      protocol: baseUrl.protocol,
      hostname: baseUrl.hostname,
      port: baseUrl.port,
      path: "/sitemap.xml",
      method: "GET",
      headers: { host, accept: "application/xml" },
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
      response.on("end", () => finish(() => resolve({ status: response.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") })));
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
  const client = baseUrl.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const request = client.request({
      protocol: baseUrl.protocol,
      hostname: baseUrl.hostname,
      port: baseUrl.port,
      path: pathname,
      method: "GET",
      headers: { host, accept: "text/html" },
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
  const actual = sitemapPaths(response.body, target.host);
  const site = state?.sites.find((candidate) => candidate.id === target.siteId);
  if (state && !site) throw new Error(`missing_site:${target.siteId}`);
  const expected = state && site ? expectedCanonicalPaths(state, site) : undefined;
  const live = state ? undefined : await validateLivePublishedPages(target.host, actual.paths);
  results.push({
    siteId: target.siteId,
    host: target.host,
    mode: state ? "snapshot-set" : "live-publication",
    expected: expected?.size ?? null,
    actual: actual.paths.size,
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
console.log(JSON.stringify({ ok: failures.length === 0, statePath: statePath ?? null, results }, null, 2));
if (failures.length) process.exitCode = 1;
