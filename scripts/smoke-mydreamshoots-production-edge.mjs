#!/usr/bin/env node
import assert from "node:assert/strict";
const origin = (process.env.SMOKE_PUBLIC_ORIGIN || "https://www.mydreamshoots.com").replace(/\/$/, "");
const publicCacheControl = "public, max-age=60, s-maxage=300, stale-while-revalidate=1800";
const publicCdnCacheControl = "public, s-maxage=300, stale-while-revalidate=1800";
const publicSitemapCacheControl = "public, max-age=300, s-maxage=900, stale-while-revalidate=86400";
const publicSitemapCdnCacheControl = "public, s-maxage=900, stale-while-revalidate=86400";
const requiredWatchPaths = [
  "/watch/ai-video-creation-tutorial",
  "/watch/mydreamshoots-ai-video-tutorial-20260814",
  "/watch/turn-your-photos-and-ideas-into-tiktok-first-videos",
  "/watch/christmas-family-gift",
  "/watch/valentines-day-save-the-date"
];
const publicPaths = [
  "/",
  ...requiredWatchPaths,
  "/watch/turn-photos-and-ideas-into-tiktok-first-videos",
  "/pricing",
  "/state-privacy",
  "/terms",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-video-generation/cinematic-video",
  "/ai-video-generation/meme-video",
  "/ai-video-generation/music-video",
  "/ai-video-generation/social-media-video",
  "/ai-video-generation/youtube-video"
];
const privatePaths = ["/app/create", "/account", "/login"];
const retiredPublicMarkers = [
  "/cdn-cgi/l/email-protection",
  "__cf_email__",
  "Only publish verified output formats.",
  "Only publish privacy, storage, and deletion claims",
  "List only the real export formats",
  "Only promise built-in trending-audio access",
  "Do not promise automatic music upload",
  "Only promise batch or automation behavior",
  "DPDPA",
  "Terms of Service for myDreamshoots AI Headshot Photo Package",
  "Turn a Bigger Idea Into a Video Worth Watching Through"
];

function xmlDecode(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchText(path) {
  const response = await fetch(`${origin}${path}`, { redirect: "follow" });
  return { status: response.status, headers: Object.fromEntries(response.headers.entries()), body: await response.text() };
}

async function fetchTimed(path) {
  const started = performance.now();
  const response = await fetch(`${origin}${path}`, { redirect: "follow" });
  const headersAt = performance.now();
  await response.arrayBuffer();
  return {
    path,
    startTransferSeconds: (headersAt - started) / 1000,
    totalSeconds: (performance.now() - started) / 1000,
    cfCacheStatus: response.headers.get("cf-cache-status") ?? ""
  };
}

async function sitemapPaths() {
  const response = await fetch(`${origin}/sitemap.xml`, { redirect: "follow" });
  assert.equal(response.status, 200, "sitemap.xml must return HTTP 200");
  assert.equal(response.headers.get("cache-control"), publicSitemapCacheControl, "sitemap.xml must expose a public cache policy");
  assert.equal(response.headers.get("cdn-cache-control"), publicSitemapCdnCacheControl, "sitemap.xml must expose a public CDN cache policy");
  assert.equal(response.headers.get("cloudflare-cdn-cache-control"), publicSitemapCdnCacheControl, "sitemap.xml must expose a Cloudflare cache policy");
  const xml = await response.text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)]
    .map((match) => xmlDecode(match[1]))
    .map((url) => {
      try {
        const parsed = new URL(url);
        if (parsed.origin !== origin) return "";
        return `${parsed.pathname}${parsed.search}`;
      } catch {
        return "";
      }
    })
    .filter((path) => path && !path.startsWith("/app") && !path.startsWith("/account"));
  assert(paths.length > 0, "sitemap.xml must expose public storefront URLs");
  return [...new Set(paths)];
}

async function assertPublicPage(path) {
  const result = await fetchText(path);
  assert.equal(result.status, 200, `${path} must return HTTP 200`);
  assert.equal(result.headers["cache-control"], publicCacheControl, `${path} must expose the public HTML Cache-Control policy`);
  assert.equal(result.headers["cdn-cache-control"], publicCdnCacheControl, `${path} must expose the public CDN cache policy`);
  assert(!/no-store|private/i.test(result.headers["cache-control"] ?? ""), `${path} must not be no-store/private`);
  for (const marker of retiredPublicMarkers) assert.equal(result.body.includes(marker), false, `${path} must not expose retired marker ${marker}`);
}

const discoveredPublicPaths = await sitemapPaths();
const discoveredWatchPaths = discoveredPublicPaths.filter((path) => path.startsWith("/watch/"));
assert(discoveredWatchPaths.length >= requiredWatchPaths.length, "sitemap.xml must expose dynamically discovered watch pages");
for (const path of requiredWatchPaths) assert(discoveredWatchPaths.includes(path), `${path} must remain in sitemap.xml`);
const allPublicPaths = [...new Set([...publicPaths, ...discoveredPublicPaths])];
const publicConcurrency = 8;
for (let index = 0; index < allPublicPaths.length; index += publicConcurrency) {
  await Promise.all(allPublicPaths.slice(index, index + publicConcurrency).map(assertPublicPage));
}

for (const path of privatePaths) {
  const result = await fetchText(path);
  assert(/no-store/i.test(result.headers["cache-control"] ?? ""), `${path} must remain no-store`);
  assert(/private/i.test(result.headers["cache-control"] ?? ""), `${path} must remain private`);
}

const performancePath = process.env.SMOKE_EDGE_PERFORMANCE_PATH || "/";
assert(allPublicPaths.includes(performancePath), `${performancePath} must be a public path in the sitemap`);
for (let warmup = 0; warmup < 5; warmup += 1) await fetchTimed(performancePath);
const sequentialResults = [];
for (const path of publicPaths) sequentialResults.push(await fetchTimed(path));
const concurrentResults = await Promise.all(Array.from({ length: 10 }, () => fetchTimed(performancePath)));
const timings = [...sequentialResults, ...concurrentResults]
  .map((item) => item.startTransferSeconds)
  .sort((left, right) => left - right);
const concurrentTimings = concurrentResults.map((item) => item.startTransferSeconds).sort((left, right) => left - right);
const percentile = (values, fraction) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))];
const summary = {
  ok: true,
  origin,
  publicPages: allPublicPaths.length,
  privatePages: privatePaths.length,
  warmSequentialStartTransferSeconds: sequentialResults,
  warmConcurrentStartTransferSeconds: concurrentResults,
  warmP50Seconds: percentile(timings, 0.5),
  warmP95Seconds: percentile(timings, 0.95),
  warmConcurrentP50Seconds: percentile(concurrentTimings, 0.5),
  warmConcurrentP95Seconds: percentile(concurrentTimings, 0.95),
  cacheStatuses: [...new Set([...sequentialResults, ...concurrentResults].map((item) => item.cfCacheStatus).filter(Boolean))]
};
assert(summary.warmP50Seconds < 2, `warm public HTML p50 must be <2s; got ${summary.warmP50Seconds}s`);
assert(summary.warmConcurrentP95Seconds < 5, `warm concurrent public HTML p95 must be <5s; got ${summary.warmConcurrentP95Seconds}s`);
console.log(JSON.stringify(summary, null, 2));
