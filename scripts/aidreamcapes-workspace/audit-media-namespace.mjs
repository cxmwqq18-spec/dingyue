#!/usr/bin/env node
// Namespace gate for the AIVideosUGC / site_aidreamcapes media directories.
//
// `/ai-image-generation/*` and `/ai-video-generation/*` are shared by three
// kinds of URLs: published content pages (tool/template owners), derived media
// detail pages, and legacy rows that are explicitly redirected or retired.
// Every relational row in those namespaces must land in exactly one of:
//
//   200        a real page (content owner or media detail page)
//   301 / 308  an explicit redirect whose Location resolves to a 200 page
//   404        ONLY if the row is listed in `ORPHAN_404_ALLOWLIST` below
//
// Anything else (unexpected 404, wildcard redirect, 5xx) fails the gate.
// The allowlist is self-checking: an allowlisted slug that gains an inbound
// in-site link or a sitemap entry fails the run, because the allowlist is then
// stale and the URL is no longer an orphan.
//
// The gate also scans every site-relative `/ai-(image|video)-generation/...`
// value in `LivePage.contentJson` (hrefs, paths, canonical paths) and asserts
// that no in-site link is dead. A value that only references its own page is a
// self canonical, not a link, and is left to the namespace classification.
//
// Usage:
//   node scripts/aidreamcapes-workspace/audit-media-namespace.mjs
import "../load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const origin = String(process.env.AIDREAMCAPES_ROUTE_SMOKE_ORIGIN || "http://127.0.0.1:3003").replace(/\/$/, "");
const siteSlug = String(process.env.AIDREAMCAPES_AUDIT_SITE_SLUG || "aidreamcapes");
const pathMode = process.env.AIDREAMCAPES_AUDIT_PATH_MODE !== "0";
const base = pathMode ? `/site/${siteSlug}` : "";
const siteId = "site_aidreamcapes";
const requestTimeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 60000);
const concurrency = Math.max(1, Math.min(16, Number(process.env.AIDREAMCAPES_AUDIT_CONCURRENCY || 4)));

const NAMESPACES = ["/ai-image-generation/", "/ai-video-generation/"];
const MEDIA_PATH_RE = /^\/ai-(?:image|video)-generation\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)?$/i;

// Known orphans: stale seasonal `ai_tool` rows under /ai-video-generation that
// no public page links to and that are not in the sitemap. Their intended
// replacement is `/ai-save-the-date/<slug>`; that redirect is P1 content work
// and is intentionally not asserted here. Records: docs/plans/
// aidreamcapes-media-detail-link-remediation-2026-10-21.md §2.3.
// The check below fails if any of these ever becomes reachable or linked.
const ORPHAN_404_ALLOWLIST = new Map([
  ["/ai-video-generation/christmas", "seasonal row; replacement /ai-save-the-date/christmas"],
  ["/ai-video-generation/engagement", "seasonal row; replacement /ai-save-the-date/engagement"],
  ["/ai-video-generation/fathers-day", "seasonal row; replacement /ai-save-the-date/fathers-day"],
  ["/ai-video-generation/halloween", "seasonal row; replacement /ai-save-the-date/halloween"],
  ["/ai-video-generation/mothers-day", "seasonal row; replacement /ai-save-the-date/mothers-day"],
  ["/ai-video-generation/new-year", "seasonal row; replacement /ai-save-the-date/new-year"],
  ["/ai-video-generation/proposal", "seasonal row; replacement /ai-save-the-date/proposal"],
  ["/ai-video-generation/save-the-date", "seasonal row; replacement /ai-save-the-date/save-the-date"],
  ["/ai-video-generation/thanksgiving", "seasonal row; replacement /ai-save-the-date/thanksgiving"],
  ["/ai-video-generation/valentines-day", "seasonal row; replacement /ai-save-the-date/valentines-day"],
  ["/ai-video-generation/wedding-ceremony", "seasonal row; replacement /ai-save-the-date/wedding-ceremony"],
  ["/ai-video-generation/wedding-invitation", "seasonal row; replacement /ai-save-the-date/wedding-invitation"]
]);

const failures = [];
const skipped = [];

function fail(scope, message) {
  failures.push(`${scope}: ${message}`);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function pathOf(location) {
  if (!location) return undefined;
  try {
    const url = new URL(location, `${origin}/`);
    let pathname = url.pathname;
    const prefix = pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0];
    if (prefix) pathname = pathname.slice(prefix.length) || "/";
    return `${pathname}${url.search}`;
  } catch {
    return undefined;
  }
}

/** The dev server drops idle sockets while it compiles; retry a reset once. */
async function fetchWithRetry(url, init = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 800 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function request(path, { follow = false } = {}) {
  const response = await fetchWithRetry(`${origin}${base}${path}`, {
    redirect: follow ? "follow" : "manual",
    headers: { "user-agent": "aidreamcapes-media-namespace-audit/1.0" },
    signal: AbortSignal.timeout(requestTimeout)
  });
  // Drain the body so the connection can be reused.
  await response.text();
  return {
    status: response.status,
    location: response.headers.get("location") || undefined,
    finalPath: follow ? new URL(response.url).pathname.replace(base, "") || "/" : undefined
  };
}

async function mapLimit(items, size, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, run));
  return results;
}

/** Every site-relative media value in a LivePage, with its owner page. */
function collectMediaValues(contentJson, pagePath, out) {
  if (typeof contentJson === "string") {
    if (MEDIA_PATH_RE.test(contentJson)) {
      if (!out.has(contentJson)) out.set(contentJson, new Set());
      out.get(contentJson).add(pagePath);
    }
    return out;
  }
  if (Array.isArray(contentJson)) {
    for (const value of contentJson) collectMediaValues(value, pagePath, out);
    return out;
  }
  const object = record(contentJson);
  if (object) for (const value of Object.values(object)) collectMediaValues(value, pagePath, out);
  return out;
}

async function sitemapPaths() {
  const response = await fetchWithRetry(`${origin}${base}/sitemap.xml`, {
    headers: { "user-agent": "aidreamcapes-media-namespace-audit/1.0" },
    signal: AbortSignal.timeout(requestTimeout)
  });
  if (response.status !== 200) return { status: response.status, paths: new Set() };
  const xml = await response.text();
  const paths = new Set();
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const value = pathOf(match[1].trim());
    if (value) paths.add(value);
  }
  return { status: response.status, paths };
}

const prisma = new PrismaClient({ errorFormat: "minimal" });

try {
  const rows = await prisma.livePage.findMany({ where: { siteId }, select: { slug: true, pageType: true, contentJson: true } });
  const namespaced = rows
    .filter((row) => NAMESPACES.some((prefix) => row.slug.startsWith(prefix)))
    .map((row) => ({ slug: row.slug, pageType: row.pageType }))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const internal = new Map();
  for (const row of rows) collectMediaValues(row.contentJson, row.slug, internal);

  let serverAvailable = true;
  let sitemap = { status: 0, paths: new Set() };
  try {
    sitemap = await sitemapPaths();
  } catch (error) {
    serverAvailable = false;
    skipped.push({ check: "sitemap", reason: error instanceof Error ? error.message : String(error) });
  }

  const classification = await mapLimit(namespaced, concurrency, async (row) => {
    if (!serverAvailable) return { slug: row.slug, pageType: row.pageType, status: "skipped" };
    try {
      const result = await request(row.slug);
      const entry = { slug: row.slug, pageType: row.pageType, status: result.status, location: result.location };
      if (result.status === 301 || result.status === 308) {
        const target = pathOf(result.location);
        entry.target = target;
        if (!target) {
          fail(row.slug, `redirect without a usable Location (${result.location || "missing"})`);
          entry.final = "missing-location";
        } else {
          const final = await request(target, { follow: true });
          entry.final = final.status;
          if (final.status !== 200) fail(row.slug, `explicit redirect ${result.status} -> ${target} ends at ${final.status}`);
        }
      }
      if (result.status === 200) {
        entry.orphanAllowlisted = ORPHAN_404_ALLOWLIST.has(row.slug);
        if (entry.orphanAllowlisted) fail(row.slug, "allowlisted orphan now answers 200; remove it from ORPHAN_404_ALLOWLIST");
      }
      if (result.status === 404) {
        const reason = ORPHAN_404_ALLOWLIST.get(row.slug);
        entry.allowlisted = Boolean(reason);
        entry.allowlistReason = reason;
        if (!reason) fail(row.slug, "unexplained 404 outside ORPHAN_404_ALLOWLIST");
      }
      if (![200, 301, 308, 404].includes(result.status)) {
        fail(row.slug, `unexpected status ${result.status}`);
      }
      return entry;
    } catch (error) {
      serverAvailable = false;
      skipped.push({ slug: row.slug, reason: error instanceof Error ? error.message : String(error) });
      return { slug: row.slug, pageType: row.pageType, status: "skipped" };
    }
  });

  const deadLinks = [];
  const orphanAllowlistChecks = [];
  if (serverAvailable) {
    for (const [path, pages] of [...internal.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      const inbound = [...pages].filter((page) => page !== path);
      if (!inbound.length) continue; // self canonical only
      try {
        const result = await request(path, { follow: true });
        if (result.status !== 200) {
          deadLinks.push({ path, status: result.status, referencedBy: inbound.slice(0, 5) });
          fail(path, `in-site media link is dead (${result.status}) from ${inbound.slice(0, 3).join(", ")}`);
        }
      } catch (error) {
        serverAvailable = false;
        skipped.push({ path, reason: error instanceof Error ? error.message : String(error) });
        break;
      }
    }
    for (const [slug, reason] of ORPHAN_404_ALLOWLIST) {
      const inbound = [...(internal.get(slug) || [])].filter((page) => page !== slug);
      const inSitemap = sitemap.paths.has(slug);
      orphanAllowlistChecks.push({ slug, reason, inbound, inSitemap });
      if (inbound.length) fail(slug, `allowlisted orphan is now referenced by ${inbound.slice(0, 3).join(", ")}; remove it from ORPHAN_404_ALLOWLIST`);
      if (inSitemap) fail(slug, "allowlisted orphan is submitted in the sitemap; fix the page instead of allowlisting it");
    }
  }

  if (!serverAvailable) {
    // A server that cannot answer is a failed gate, never a pass.
    console.error(`FAIL: server unavailable at ${origin}${base}; namespace classification needs HTTP readback.`);
    console.error(JSON.stringify({
      ok: false,
      skipped: true,
      origin,
      inventory: {
        rows: namespaced.length,
        image: namespaced.filter((row) => row.slug.startsWith("/ai-image-generation/")).length,
        video: namespaced.filter((row) => row.slug.startsWith("/ai-video-generation/")).length,
        internalMediaValues: internal.size
      },
      skippedChecks: skipped,
      failures: ["server unavailable; the audit could not complete its readback"]
    }, null, 2));
    process.exitCode = 1;
  } else {
    const counts = { 200: 0, "301": 0, "308": 0, "404": 0, other: 0 };
    for (const entry of classification) {
      if (entry.status === 200) counts[200] += 1;
      else if (entry.status === 301 || entry.status === 308) counts[entry.status] += 1;
      else if (entry.status === 404) counts[404] += 1;
      else counts.other += 1;
    }
    const result = {
      ok: failures.length === 0,
      origin,
      pathMode,
      sitemap: { status: sitemap.status, urls: sitemap.paths.size },
      inventory: {
        rows: namespaced.length,
        image: namespaced.filter((row) => row.slug.startsWith("/ai-image-generation/")).length,
        video: namespaced.filter((row) => row.slug.startsWith("/ai-video-generation/")).length,
        internalMediaValues: internal.size
      },
      statusCounts: counts,
      allowlisted404: classification.filter((entry) => entry.allowlisted).length,
      redirects: classification.filter((entry) => entry.status === 301 || entry.status === 308).length,
      deadInternalLinks: deadLinks,
      orphanAllowlist: orphanAllowlistChecks,
      redirectsToFix: classification.filter((entry) => entry.target && entry.final !== 200),
      failures,
      classification
    };
    if (failures.length) {
      console.error(JSON.stringify(result, null, 2));
      process.exitCode = 1;
    } else {
      console.log(JSON.stringify(result, null, 2));
    }
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, origin, error: error instanceof Error ? error.stack : String(error) }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
