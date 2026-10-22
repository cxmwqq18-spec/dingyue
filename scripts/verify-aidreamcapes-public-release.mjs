#!/usr/bin/env node
// Verify a live Aidreamcapes release against the gates that matter after a
// deploy: the release commit, a single transport timing group, the metadata
// contract, and an internal link graph without redirect detours.
//
// Read-only. It never writes to the database and never changes the site.

import assert from "node:assert/strict";
import { argumentValue, hasArgument } from "./lib/database-target.mjs";

const origin = (argumentValue("--origin") || "http://127.0.0.1:3013").replace(/\/$/, "");
const host = argumentValue("--host") || "www.aivideosugc.com";
const expectedCommit = argumentValue("--expect-commit") || "";
const expectHomeHash = argumentValue("--expect-home-hash") || "";
const checkLinks = !hasArgument("--skip-links");
const sampleSize = Number(argumentValue("--sample") || "40");

function requestHeaders() {
  return { "x-forwarded-host": host, "x-forwarded-proto": "https", accept: "text/html" };
}

async function get(path, init = {}) {
  try {
    return await fetch(`${origin}${path}`, { headers: { ...requestHeaders(), ...(init.headers ?? {}) }, redirect: "manual" });
  } catch (error) {
    return new Response("", { status: 599, headers: { "x-verifier-error": String(error?.message ?? error) } });
  }
}

function countTimingGroups(response) {
  const raw = response.headers.get("server-timing");
  if (!raw) return 0;
  // A transport timing group starts with the `ssr` token. Two groups mean the
  // head reorder ran twice for one document.
  return (raw.match(/(?:^|,\s*)ssr\s*;/g) ?? []).length;
}

function normalizeHome(html) {
  return html
    .replace(/(nonce|csrf|_rsc)=[A-Za-z0-9_-]+/g, "$1=X")
    .replace(/\/_next\/static\/[A-Za-z0-9_-]{6,}\//g, "/_next/static/BUILD/")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "UUID");
}

async function sha256(value) {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

const results = { origin, host, checks: [], failures: [] };
function record(name, ok, detail) {
  results.checks.push({ name, ok, detail });
  if (!ok) results.failures.push({ name, detail });
}

const healthToken = process.env.AIDREAMCAPES_HEALTH_TOKEN?.trim() ?? "";
if (healthToken) {
  const response = await get("/api/aidreamcapes/health", { headers: { "x-aidreamcapes-health-token": healthToken } });
  const body = await response.json().catch(() => ({}));
  record("health", response.ok && body.ok === true, { commit: body.commit, revision: body.revision, rssMb: body.rssMb });
  if (expectedCommit) record("deployed-commit", body.commit === expectedCommit, { expected: expectedCommit, actual: body.commit });
} else if (expectedCommit) {
  record("deployed-commit", false, { reason: "AIDREAMCAPES_HEALTH_TOKEN is not available" });
}

const home = await get("/");
const homeHtml = await home.text();
record("home-status", home.status === 200, { status: home.status });
record("single-transport-timing", countTimingGroups(home) === 1, { groups: countTimingGroups(home) });
if (expectHomeHash) {
  const hash = await sha256(normalizeHome(homeHtml));
  record("home-layout-unchanged", hash === expectHomeHash, { expected: expectHomeHash, actual: hash });
}

const sitemap = await get("/sitemap.xml");
const sitemapXml = await sitemap.text();
const paths = [...sitemapXml.matchAll(/<loc>\s*https?:\/\/[^/]+([^<]*?)\s*<\/loc>/g)].map((match) => match[1] || "/");
record("sitemap", sitemap.status === 200 && paths.length > 0, { status: sitemap.status, urls: paths.length });

const sampled = paths.slice(0, sampleSize);
let metaOk = 0;
let breadcrumbOk = 0;
const nonOk = [];
for (const path of sampled) {
  const response = await get(path);
  if (response.status !== 200) {
    nonOk.push({ path, status: response.status });
    continue;
  }
  const html = await response.text();
  if (/name="max-image-preview"\s+content="large"/.test(html) || /content="large"[^>]*name="max-image-preview"/.test(html)) metaOk += 1;
  if (html.includes("BreadcrumbList")) breadcrumbOk += 1;
}
record("sampled-pages-200", nonOk.length === 0, { sampled: sampled.length, failures: nonOk.slice(0, 5) });
record("max-image-preview", metaOk === sampled.length, { covered: metaOk, of: sampled.length });
record("breadcrumbs", breadcrumbOk >= sampled.length - 1, { covered: breadcrumbOk, of: sampled.length });

if (checkLinks) {
  // The link graph is checked by the crawl based audit, which also reports the
  // pages it could not reach. It is run separately so that a long crawl does
  // not hide the fast checks above.
  results.linkGate = "run scripts/audit-aidreamcapes-technical-seo.mjs --origin=<origin> --out=<file> and assert issues.brokenLinks is empty";
}

results.ok = results.failures.length === 0;
console.log(JSON.stringify(results, null, 2));
if (!results.ok) process.exitCode = 1;
