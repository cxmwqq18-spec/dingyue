#!/usr/bin/env node

// Read-only cache benchmark for the Aidreamcapes public storefront.
//
// Starts from /sitemap.xml, rewrites every sitemap URL to the supplied origin,
// preserves the production Host header, and requests every page sequentially
// (or with a bounded concurrency) for N passes. It reports TTFB, SSR duration,
// HTML bytes and status per pass. No writes, no content mutations.
//
//   node scripts/benchmark-aidreamcapes-cache.mjs \
//     --origin=http://127.0.0.1:3100 --passes=2 --concurrency=1
//
// Optional: --host=www.aivideosugc.com --limit=20 --out=/tmp/cache.json

import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);

const origin = (args.get("origin") || "http://127.0.0.1:3100").replace(/\/+$/, "");
const originUrl = new URL(origin);
const host = args.get("host") || "www.aivideosugc.com";
const passes = Math.max(1, Number(args.get("passes") || 2));
const concurrency = Math.max(1, Number(args.get("concurrency") || 1));
const timeoutMs = Math.max(1000, Number(args.get("timeout") || 30_000));
const limit = Math.max(0, Number(args.get("limit") || 0));
const outPath = args.get("out") || "";
const sleepMs = Math.max(0, Number(args.get("sleep") || 0));

const headers = {
  Host: host,
  "X-Forwarded-Host": host,
  "X-Forwarded-Proto": "https",
  "Accept-Encoding": "identity",
  "User-Agent": "AidreamcapesCacheBenchmark/1.0"
};

function request(rawUrl) {
  return new Promise((resolve, reject) => {
    const startedAt = performance.now();
    const client = new URL(rawUrl).protocol === "https:" ? https : http;
    const req = client.request(rawUrl, { method: "GET", headers }, (res) => {
      const headersMs = performance.now() - startedAt;
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const totalMs = performance.now() - startedAt;
        const body = Buffer.concat(chunks);
        const contentLength = Number(res.headers["content-length"] || 0);
        const serverTiming = String(res.headers["server-timing"] || "");
        const ssr = Number(serverTiming.match(/ssr;dur=([\d.]+)/)?.[1] ?? NaN);
        resolve({
          status: res.statusCode ?? 0,
          headersMs,
          totalMs,
          bytes: contentLength || body.length,
          ssr: Number.isFinite(ssr) ? ssr : null,
          location: res.headers.location || null,
          serverTiming
        });
      });
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms`)));
    req.on("error", reject);
    req.end();
  });
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function summarize(pass, rows) {
  const ok = rows.filter((row) => row.status === 200);
  const ttfb = ok.map((row) => row.headersMs);
  const ssr = ok.map((row) => row.ssr).filter((value) => typeof value === "number");
  const bytes = ok.map((row) => row.bytes);
  return {
    pass,
    requests: rows.length,
    ok: ok.length,
    non200: rows.filter((row) => row.status !== 200).map((row) => ({ url: row.url, status: row.status, location: row.location })),
    ttfbMs: {
      min: ttfb.length ? Math.min(...ttfb) : null,
      p50: percentile(ttfb, 50),
      p90: percentile(ttfb, 90),
      max: ttfb.length ? Math.max(...ttfb) : null,
      avg: ttfb.length ? ttfb.reduce((sum, value) => sum + value, 0) / ttfb.length : null
    },
    ssrMs: {
      p50: percentile(ssr, 50),
      p90: percentile(ssr, 90),
      avg: ssr.length ? ssr.reduce((sum, value) => sum + value, 0) / ssr.length : null
    },
    htmlBytes: {
      min: bytes.length ? Math.min(...bytes) : null,
      p50: percentile(bytes, 50),
      max: bytes.length ? Math.max(...bytes) : null,
      avg: bytes.length ? bytes.reduce((sum, value) => sum + value, 0) / bytes.length : null
    }
  };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const sitemapResponse = await request(`${origin}/sitemap.xml`);
// request() returns only metrics; fetch the sitemap body separately with the
// same transport so this benchmark remains dependency-free.
const sitemapBody = await new Promise((resolve, reject) => {
  const client = new URL(`${origin}/sitemap.xml`).protocol === "https:" ? https : http;
  const req = client.request(`${origin}/sitemap.xml`, { method: "GET", headers }, (res) => {
    const chunks = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
  req.setTimeout(timeoutMs, () => req.destroy(new Error(`sitemap timeout after ${timeoutMs}ms`)));
  req.on("error", reject);
  req.end();
});
if (sitemapResponse.status !== 200) {
  throw new Error(`sitemap status ${sitemapResponse.status}`);
}
const sitemapUrls = [...sitemapBody.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
  .map((match) => match[1].trim())
  .filter(Boolean)
  .slice(0, limit > 0 ? limit : undefined);
if (!sitemapUrls.length) throw new Error("sitemap has no <loc> URLs");

const urls = sitemapUrls.map((raw) => {
  const parsed = new URL(raw);
  return `${origin}${parsed.pathname}${parsed.search}`;
});

console.log(`[cache] origin=${origin} host=${host} urls=${urls.length} passes=${passes} concurrency=${concurrency}`);
const results = [];
for (let pass = 1; pass <= passes; pass += 1) {
  const startedAt = performance.now();
  const rows = await mapLimit(urls, concurrency, async (url) => {
    try {
      return { url, ...(await request(url)) };
    } catch (error) {
      return { url, status: 0, headersMs: 0, totalMs: 0, bytes: 0, ssr: null, location: null, error: String(error) };
    }
  });
  const summary = summarize(pass, rows);
  summary.elapsedMs = performance.now() - startedAt;
  summary.rows = rows;
  results.push(summary);
  console.log(JSON.stringify({
    pass: summary.pass,
    ok: summary.ok,
    non200: summary.non200.length,
    ttfbP50Ms: Number(summary.ttfbMs.p50?.toFixed(1)),
    ttfbP90Ms: Number(summary.ttfbMs.p90?.toFixed(1)),
    ttfbAvgMs: Number(summary.ttfbMs.avg?.toFixed(1)),
    ssrP50Ms: summary.ssrMs.p50 === null ? null : Number(summary.ssrMs.p50.toFixed(1)),
    htmlP50Bytes: summary.htmlBytes.p50,
    htmlMaxBytes: summary.htmlBytes.max,
    elapsedMs: Number(summary.elapsedMs.toFixed(1))
  }, null, 2));
  if (pass < passes && sleepMs > 0) await new Promise((resolve) => setTimeout(resolve, sleepMs));
}

if (outPath) {
  await fs.writeFile(outPath, `${JSON.stringify({ origin, host, urls: urls.length, results }, null, 2)}\n`);
  console.log(`[cache] wrote ${outPath}`);
}

const failures = results.flatMap((result) => result.non200);
if (failures.length) {
  console.error(`[cache] ${failures.length} non-200 responses`);
  process.exitCode = 1;
}
