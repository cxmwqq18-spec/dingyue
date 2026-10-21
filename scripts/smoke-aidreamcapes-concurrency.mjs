#!/usr/bin/env node
// Concurrency and memory gate for the Aidreamcapes public storefront.
//
// The default origin is the loopback production listener, so the command is
// safe to run on the release host. Pass --edge (or an https origin) to exercise
// Nginx/Cloudflare as well.
//
// Usage:
//   node scripts/smoke-aidreamcapes-concurrency.mjs --origin=http://127.0.0.1:3013 --concurrency=8 --pid=1234
//   node scripts/smoke-aidreamcapes-concurrency.mjs --edge --concurrency=8 --allow-429
//   node scripts/smoke-aidreamcapes-concurrency.mjs --limit=24 --concurrency=4 --max-p95-ms=20000
//
// Exit codes: 0 pass, 1 failure/threshold, 2 invalid invocation or sitemap.
import { execFileSync } from "node:child_process";
import fs from "node:fs";

const args = process.argv.slice(2);
const hasFlag = (name) => args.includes(`--${name}`);
const value = (name, fallback) => {
  const prefix = `--${name}=`;
  const found = args.find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
};

function fail(message) {
  console.error(`[aidreamcapes-concurrency] ${message}`);
  process.exit(2);
}

function intValue(name, fallback, min, max) {
  const raw = String(value(name, fallback)).trim();
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    fail(`--${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

const origin = String(value("origin", process.env.AIDREAMCAPES_LOAD_ORIGIN || "http://127.0.0.1:3013")).replace(/\/$/, "");
if (!/^https?:\/\//i.test(origin)) fail("--origin must be an http(s) URL");
const publicHost = String(value("public-host", process.env.AIDREAMCAPES_LOAD_PUBLIC_HOST || "www.aivideosugc.com")).trim();
const concurrency = intValue("concurrency", process.env.AIDREAMCAPES_LOAD_CONCURRENCY || 4, 1, 64);
const limit = intValue("limit", process.env.AIDREAMCAPES_LOAD_LIMIT || 0, 0, 5000);
const timeoutMs = intValue("timeout-ms", process.env.AIDREAMCAPES_LOAD_TIMEOUT_MS || 45000, 1000, 120000);
const maxFailures = intValue("max-failures", process.env.AIDREAMCAPES_LOAD_MAX_FAILURES || 0, 0, 10000);
const maxP95Ms = intValue("max-p95-ms", process.env.AIDREAMCAPES_LOAD_MAX_P95_MS || 0, 0, 600000);
const pid = String(value("pid", process.env.AIDREAMCAPES_LOAD_PID || "")).trim();
const allow429 = hasFlag("allow-429") || process.env.AIDREAMCAPES_LOAD_ALLOW_429 === "1";
const edgeFlag = hasFlag("edge");
const directFlag = hasFlag("direct");

if (edgeFlag && directFlag) fail("--edge and --direct cannot be combined");
if (pid && !/^\d+$/.test(pid)) fail("--pid must be numeric");

const loopback = /^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/i.test(origin);
const mode = edgeFlag ? "edge" : directFlag ? "direct" : loopback ? "direct" : "edge";
const headers = {
  "user-agent": "aidreamcapes-concurrency-gate/1.0",
  ...(mode === "direct" ? { "x-forwarded-host": publicHost, "x-forwarded-proto": "https" } : {})
};

function readRssKb() {
  if (!pid) return 0;
  try {
    const statusPath = `/proc/${pid}/status`;
    if (fs.existsSync(statusPath)) {
      const match = fs.readFileSync(statusPath, "utf8").match(/^VmRSS:\s+(\d+)\s+kB/m);
      return match ? Number(match[1]) : 0;
    }
    const value = execFileSync("ps", ["-o", "rss=", "-p", pid], { encoding: "utf8" }).trim();
    return Number(value) || 0;
  } catch {
    return 0;
  }
}

async function fetchPath(path, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();
  try {
    const response = await fetch(`${origin}${path}`, {
      headers: { ...headers, accept },
      redirect: "manual",
      signal: controller.signal
    });
    const text = await response.text();
    return {
      status: response.status,
      text,
      ms: Math.round(performance.now() - startedAt)
    };
  } catch (error) {
    return {
      status: -1,
      text: "",
      ms: Math.round(performance.now() - startedAt),
      error: error?.name === "AbortError" ? "timeout" : String(error?.message || error)
    };
  } finally {
    clearTimeout(timer);
  }
}

const rssSamples = pid ? [readRssKb()] : [];
if (pid && rssSamples[0] === 0) fail(`could not read RSS for pid ${pid}`);
const sampler = pid ? setInterval(() => rssSamples.push(readRssKb()), 500) : null;

const sitemap = await fetchPath("/sitemap.xml", "application/xml");
if (sitemap.status !== 200) {
  fail(`sitemap returned ${sitemap.status}${sitemap.error ? ` (${sitemap.error})` : ""}`);
}
const locs = [...sitemap.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
if (!locs.length) fail("sitemap contains no URLs");
const paths = [];
for (const loc of locs) {
  try {
    const url = new URL(loc);
    paths.push(`${url.pathname}${url.search}`);
  } catch {
    fail(`sitemap contains an invalid URL: ${loc}`);
  }
}
const uniquePaths = [...new Set(paths)];
const selected = limit > 0 && limit < uniquePaths.length
  ? [...new Set(Array.from({ length: limit }, (_, index) => uniquePaths[Math.floor((index * uniquePaths.length) / limit)]))]
  : uniquePaths;

const startedAt = Date.now();
let nextIndex = 0;
const results = [];

async function worker() {
  for (;;) {
    const index = nextIndex++;
    if (index >= selected.length) return;
    const path = selected[index];
    const result = await fetchPath(path, "text/html,application/xhtml+xml");
    results.push({
      path,
      status: result.status,
      ms: result.ms,
      ...(result.error ? { error: result.error } : {})
    });
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
if (sampler) clearInterval(sampler);
if (pid) rssSamples.push(readRssKb());
const elapsedMs = Date.now() - startedAt;

const durations = results.map((result) => result.ms).sort((a, b) => a - b);
const percentile = (p) => durations.length
  ? durations[Math.min(durations.length - 1, Math.floor((durations.length - 1) * p))]
  : 0;
const statusCounts = {};
for (const result of results) {
  const key = String(result.status);
  statusCounts[key] = (statusCounts[key] || 0) + 1;
}
const failures = results.filter((result) => result.status !== 200 && !(allow429 && result.status === 429));
const p95Ms = percentile(0.95);
const toMb = (kb) => Math.round(kb / 1024);
const ok = failures.length <= maxFailures && (maxP95Ms === 0 || p95Ms <= maxP95Ms);
const summary = {
  ok,
  origin,
  mode,
  concurrency,
  sitemapUrls: uniquePaths.length,
  requested: selected.length,
  elapsedMs,
  statusCounts,
  p50Ms: percentile(0.5),
  p95Ms,
  maxMs: durations[durations.length - 1] || 0,
  rssStartMb: pid ? toMb(rssSamples[0]) : null,
  rssPeakMb: pid ? toMb(Math.max(...rssSamples)) : null,
  rssEndMb: pid ? toMb(rssSamples[rssSamples.length - 1]) : null,
  allow429,
  maxFailures,
  maxP95Ms,
  failures: failures.slice(0, 20)
};

console.log(JSON.stringify(summary, null, 2));
if (!ok) process.exitCode = 1;
