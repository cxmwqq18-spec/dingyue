#!/usr/bin/env node
// Single entry point for the AIVideosUGC media-detail remediation gate.
//
// Runs the focused audits in order against one origin, then adds the checks that
// span several of them: sitemap shape, spoken-for URLs, actor JSON-LD, and the
// legacy redirect map. Read-only: it never writes data.
//
// Usage:
//   AIDREAMCAPES_AUDIT_ORIGIN=http://127.0.0.1:3003 \
//   node scripts/aidreamcapes-workspace/verify-media-detail-remediation.mjs
import { spawn } from "node:child_process";
import { load } from "cheerio";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const origin = String(process.env.AIDREAMCAPES_AUDIT_ORIGIN || "http://127.0.0.1:3003").replace(/\/$/, "");
const pathMode = process.env.AIDREAMCAPES_AUDIT_PATH_MODE !== "0";
const base = pathMode ? `/site/${process.env.AIDREAMCAPES_AUDIT_SITE_SLUG || "aidreamcapes"}` : "";
const sitemapOrigin = "https://www.aivideosugc.com";
const timeout = Number(process.env.AIDREAMCAPES_AUDIT_TIMEOUT || 120000);

const suite = [
  "audit-media-namespace.mjs",
  "audit-media-detail-routes.mjs",
  "audit-actor-flat-routes.mjs",
  "audit-card-entry-links.mjs",
  "audit-workspace-entry-transfer.mjs"
];

const failures = [];
const steps = [];
const auditResults = new Map();
const actorHubs = new Set(["/ai-actors/men", "/ai-actors/women", "/ai-actors/scene", "/ai-actors/age-range"]);

function fail(step, message) {
  failures.push(`${step}: ${message}`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAudit(file) {
  const started = Date.now();
  const child = spawn(process.execPath, [path.join(here, file)], {
    cwd: path.resolve(here, "../.."),
    env: {
      ...process.env,
      AIDREAMCAPES_ROUTE_SMOKE_ORIGIN: origin,
      AIDREAMCAPES_AUDIT_ORIGIN: origin,
      AIDREAMCAPES_AUDIT_PATH_MODE: pathMode ? "1" : "0"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => { stdout += chunk; });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  const code = await new Promise((resolve) => child.on("close", resolve));
  const raw = `${stdout}\n${stderr}`;
  const start = raw.indexOf("{");
  let parsed;
  try {
    parsed = start >= 0 ? JSON.parse(raw.slice(start)) : undefined;
  } catch {
    parsed = undefined;
  }
  const ok = code === 0 && parsed?.ok === true && parsed?.skipped !== true;
  if (!ok) {
    const detail = parsed?.failures?.slice(0, 5) ?? [raw.slice(0, 600).replace(/\s+/g, " ")];
    fail(file, `exit ${code}; ${detail.join(" | ")}`);
  }
  steps.push({ audit: file, ok, ms: Date.now() - started, failures: parsed?.failures?.length ?? (ok ? 0 : 1) });
  return parsed;
}

async function get(url) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "aidreamcapes-media-detail-gate/1.0" },
        signal: AbortSignal.timeout(timeout)
      });
      const html = await response.text();
      if (response.status === 0 || response.status >= 500) throw new Error(`http ${response.status}`);
      return { status: response.status, html, url: response.url };
    } catch (error) {
      if (attempt === 3) throw error;
      // The dev server recompiles routes while the audits run.
      await sleep(1500 * (attempt + 1));
    }
  }
  throw new Error("unreachable");
}

// ---- 1. Focused audits -----------------------------------------------------
for (const file of suite) auditResults.set(file, await runAudit(file));

// ---- 2. Sitemap shape ------------------------------------------------------
let sitemapPaths = [];
try {
  const sitemap = await get(`${origin}${base}/sitemap.xml`);
  if (sitemap.status !== 200) fail("sitemap", `returned ${sitemap.status}`);
  const $ = load(sitemap.html, { xmlMode: true });
  sitemapPaths = $("loc").map((_, node) => $(node).text().trim()).get()
    .map((loc) => new URL(loc).pathname);
  if (!sitemapPaths.length) fail("sitemap", "current sitemap must not be empty");
  if (new Set(sitemapPaths).size !== sitemapPaths.length) fail("sitemap", "duplicate canonical URLs");
  const nestedActors = sitemapPaths.filter((value) => /^\/ai-actors\/(?:men|women)\//.test(value));
  if (nestedActors.length) fail("sitemap", `${nestedActors.length} nested actor URL(s), expected 0`);
  const flatActors = sitemapPaths.filter((value) => /^\/ai-actors\/[a-z0-9][a-z0-9-]*$/.test(value) && !actorHubs.has(value));
  const expectedActors = auditResults.get("audit-actor-flat-routes.mjs")?.database?.flatSlugs;
  if (!expectedActors || flatActors.length !== expectedActors) fail("sitemap", `expected ${expectedActors} current actor URLs, got ${flatActors.length}`);
} catch (error) {
  fail("sitemap", error instanceof Error ? error.message : String(error));
}

// ---- 3. Every sitemap URL answers 200 --------------------------------------
const sitemapDead = [];
for (const [index, pathname] of sitemapPaths.entries()) {
  const url = `${origin}${base}${pathname === "/" ? "" : pathname}`;
  try {
    const page = await get(url);
    if (page.status === 200) continue;
    if (page.status >= 300 && page.status < 400) {
      const final = await get(url.endsWith("/") ? url : `${url}`);
      if (final.status === 200) continue;
    }
    sitemapDead.push(`${page.status} ${pathname}`);
  } catch (error) {
    sitemapDead.push(`ERR ${pathname} (${error instanceof Error ? error.message : String(error)})`);
  }
  if (index % 25 === 0) await sleep(200);
}
if (sitemapDead.length) fail("sitemap-readback", `${sitemapDead.length} URL(s) not 200: ${sitemapDead.slice(0, 6).join(", ")}`);

// ---- 4. Flat actor page: canonical, robots, JSON-LD ------------------------
try {
  const actor = sitemapPaths.find((value) => /^\/ai-actors\/[a-z0-9][a-z0-9-]*$/.test(value)
    && !["/ai-actors/men", "/ai-actors/women", "/ai-actors/scene", "/ai-actors/age-range"].includes(value));
  if (!actor) fail("actor-page", "no flat actor URL found in the sitemap");
  else {
    const page = await get(`${origin}${base}${actor}`);
    if (page.status !== 200) fail("actor-page", `${actor} returned ${page.status}`);
    const $ = load(page.html);
    const canonical = $('link[rel="canonical"]').attr("href") ?? "";
    if (canonical !== `${sitemapOrigin}${actor}`) fail("actor-page", `${actor} canonical is ${canonical}`);
    const robots = $('meta[name="robots"]').attr("content") ?? "";
    if (!/index/.test(robots)) fail("actor-page", `${actor} robots is ${robots}`);
    const graph = $('script[type="application/ld+json"]').map((_, node) => $(node).text()).get().join("\n");
    if (/\/ai-actors\/(?:men|women)\//.test(graph)) fail("actor-page", `${actor} JSON-LD still publishes a nested actor URL`);
    if (!graph.includes(`${sitemapOrigin}${actor}"`)) fail("actor-page", `${actor} JSON-LD is missing its flat URL`);
  }
} catch (error) {
  fail("actor-page", error instanceof Error ? error.message : String(error));
}

// ---- 5. Legacy redirect map: no retired path may stay 404 ------------------
try {
  const fs = await import("node:fs/promises");
  const mapPath = path.resolve(here, "../../src/lib/aidreamcapes-site-v2-redirects.json");
  const legacy = JSON.parse(await fs.readFile(mapPath, "utf8"));
  const dead = [];
  for (const [source] of legacy) {
    const page = await get(`${origin}${base}${source}`);
    if (page.status === 404) dead.push(source);
  }
  const namespace = auditResults.get("audit-media-namespace.mjs");
  const verifiedRetired = new Set((namespace?.classification || []).filter((row) => row.status === 404 && row.allowlisted).map((row) => row.slug));
  const unexpected = dead.filter((slug) => !verifiedRetired.has(slug));
  if (unexpected.length) fail("legacy-redirects", `${unexpected.length} unexplained 404 path(s): ${unexpected.slice(0, 6).join(", ")}`);
} catch (error) {
  fail("legacy-redirects", error instanceof Error ? error.message : String(error));
}

// ---- 6. Report -------------------------------------------------------------
const result = {
  ok: failures.length === 0,
  origin,
  pathMode,
  steps,
  sitemap: { urls: sitemapPaths.length, dead: sitemapDead.length },
  checks: {
    "audits": suite,
    "sitemap": "current canonical URLs, current actor inventory, no duplicates or nested actor URLs, all 200",
    "actor page": "flat canonical, indexable, JSON-LD free of nested actor URLs",
    "legacy redirects": "no unexplained 404; retired orphans independently verified by namespace audit",
    "cards and detail pages": "owned by the focused audits above"
  },
  failures
};
if (failures.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result, null, 2));
}
