#!/usr/bin/env node
// Purge the public Aidreamcapes HTML cache on the edge.
//
// The HTML cache rule and this purge must stay in step: a release is only
// allowed to serve new content after the cached copies of the public surface
// are dropped. The purge set is derived from the live sitemap, so a page that
// is added later is covered without editing this script.

import fs from "node:fs";
import assert from "node:assert/strict";
import "./load-runtime-env.mjs";
import {
  PUBLIC_HOST,
  buildPublicSurface,
  chunk,
  parseSitemapPaths,
  PURGE_FILE_BATCH,
  PURGE_PREFIX_BATCH
} from "./lib/aidreamcapes-public-cache-surface.mjs";

function argumentValue(name) {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const apply = process.argv.includes("--apply");
const origin = (argumentValue("--origin") || `https://${PUBLIC_HOST}`).replace(/\/$/, "");
const zoneId = (process.env.AIDREAMCAPES_PUBLIC_ZONE_ID || "").trim();
const token = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
const reportPath = argumentValue("--report") || ".edge-purge.json";
const maxAttempts = Number(process.env.AIDREAMCAPES_PURGE_ATTEMPTS || "3");

assert(token, "CLOUDFLARE_API_TOKEN is required to purge the edge cache");

async function cloudflareFetch(apiPath, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${apiPath}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    const detail = (body.errors ?? []).map((error) => `${error.code ?? "?"}: ${error.message ?? "failed"}`).join("; ");
    const error = new Error(detail || `Cloudflare returned ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return body.result;
}

async function resolveZone() {
  if (zoneId) {
    const zone = await cloudflareFetch(`/zones/${zoneId}`);
    assert.equal(zone.name, PUBLIC_HOST.replace(/^www\./, ""),
      `Configured zone ${zone.name} does not serve ${PUBLIC_HOST}; set AIDREAMCAPES_PUBLIC_ZONE_ID`);
    return zone.id;
  }
  const zones = await cloudflareFetch(`/zones?name=${encodeURIComponent(PUBLIC_HOST.replace(/^www\./, ""))}&per_page=5`);
  const zone = (zones ?? []).find((item) => item.name === PUBLIC_HOST.replace(/^www\./, ""));
  assert(zone, `No Cloudflare zone serves ${PUBLIC_HOST}`);
  return zone.id;
}

async function fetchSitemap() {
  const response = await fetch(`${origin}/sitemap.xml`, { headers: { accept: "application/xml,text/xml" } });
  assert(response.ok, `Sitemap request failed with ${response.status}`);
  return response.text();
}

async function purgeRequest(zone, body, label) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const result = await cloudflareFetch(`/zones/${zone}/purge_cache`, { method: "POST", body: JSON.stringify(body) });
      return { label, ok: true, attempt, id: result?.id ?? null, keys: Object.values(body)[0].length };
    } catch (error) {
      lastError = error;
      if (error.status !== 429) break;
      await new Promise((resolve) => setTimeout(resolve, 12_000 * attempt));
    }
  }
  throw new Error(`${label} purge failed: ${lastError?.message ?? "unknown error"}`);
}

const sitemapXml = await fetchSitemap();
const paths = parseSitemapPaths(sitemapXml);
const surface = buildPublicSurface(paths);
const zone = await resolveZone();

const fileBatches = chunk(surface.files, PURGE_FILE_BATCH);
const prefixBatches = chunk(surface.prefixes, PURGE_PREFIX_BATCH);
const results = [];

if (apply) {
  for (const batch of fileBatches) {
    results.push(await purgeRequest(zone, { files: batch.map((path) => `https://${PUBLIC_HOST}${path}`) }, "files"));
  }
  for (const batch of prefixBatches) {
    results.push(await purgeRequest(zone, { prefixes: batch.map((prefix) => `${PUBLIC_HOST}${prefix}`) }, "prefixes"));
  }
}

const report = {
  ok: true,
  mode: apply ? "apply" : "dry-run",
  host: PUBLIC_HOST,
  zoneId: zone,
  origin,
  sitemapPaths: paths.length,
  purgeFiles: surface.files.length,
  purgePrefixes: surface.prefixes.length,
  fileBatches: fileBatches.length,
  prefixBatches: prefixBatches.length,
  files: surface.files,
  prefixes: surface.prefixes,
  results,
  completedAt: new Date().toISOString()
};
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({
  ok: report.ok,
  mode: report.mode,
  zoneId: report.zoneId,
  sitemapPaths: report.sitemapPaths,
  purgeFiles: report.purgeFiles,
  purgePrefixes: report.purgePrefixes,
  requests: results.length,
  report: reportPath
}, null, 2));
