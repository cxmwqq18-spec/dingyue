#!/usr/bin/env node
import assert from "node:assert/strict";

const origin = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const host = process.env.SMOKE_PUBLIC_HOST || "www.mydreamshoots.com";
const legacyWatchPaths = [
  "/watch/ai-video-creation-tutorial",
  "/watch/ai-video-generation-tutorial",
  "/watch/image-to-video-mobile-tutorial-45s",
  "/watch/ai-image-mobile-tutorial-55s",
  "/watch/image-to-video-mobile-tutorial-55s",
  "/watch/christmas-family-gift",
  "/watch/valentines-day-save-the-date"
];

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

async function fetchText(path) {
  const response = await fetch(`${origin}${path}`, {
    headers: { host, "x-forwarded-host": host, connection: "close" }
  });
  return { response, body: await response.text() };
}

function jsonLdNodes(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const parsed = JSON.parse(match[1]);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [];
      }
    })
    .flatMap((node) => Array.isArray(node?.["@graph"]) ? node["@graph"] : [node]);
}

const sitemapResult = await fetchText("/sitemap.xml");
assert.equal(sitemapResult.response.status, 200, "sitemap.xml must return HTTP 200");
assert.match(sitemapResult.response.headers.get("content-type") || "", /application\/xml/i, "sitemap must be XML");
assert.doesNotMatch(sitemapResult.body, /noindex/i, "sitemap must not contain noindex");

const urls = [...sitemapResult.body.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((match) => match[1]);
const watchPaths = urls
  .map((urlBlock) => decodeXml(urlBlock.match(/<loc>([^<]+)<\/loc>/i)?.[1]))
  .filter((url) => {
    try { return new URL(url).pathname.startsWith("/watch/"); } catch { return false; }
  })
  .map((url) => new URL(url).pathname);
const uniqueWatchPaths = [...new Set(watchPaths)];
const allowEmptySitemap = process.env.SMOKE_ALLOW_EMPTY_SITEMAP === "1";
if (allowEmptySitemap && uniqueWatchPaths.length === 0) {
  console.log(JSON.stringify({ ok: true, origin, runtimeDataUnavailable: true, watchPages: 0, uniqueVideoAssets: 0 }, null, 2));
  process.exit(0);
}
assert(uniqueWatchPaths.length >= legacyWatchPaths.length, "sitemap must expose all legacy and dynamically discovered watch pages");
for (const path of legacyWatchPaths) assert(uniqueWatchPaths.includes(path), `${path} must be present in sitemap.xml`);

const contentLocations = urls
  .map((urlBlock) => decodeXml(urlBlock.match(/<video:content_loc>([^<]+)<\/video:content_loc>/i)?.[1]))
  .filter(Boolean);
assert.equal(new Set(contentLocations).size, contentLocations.length, "sitemap must not duplicate video content_loc values");
if (!allowEmptySitemap) assert.equal(contentLocations.length, uniqueWatchPaths.length, "every watch URL must have one video content_loc in sitemap.xml");

for (const watchPath of uniqueWatchPaths) {
  const { response, body } = await fetchText(watchPath);
  assert.equal(response.status, 200, `${watchPath} must return HTTP 200`);
  assert.equal((body.match(/<video\b/gi) || []).length, 1, `${watchPath} must contain exactly one video element`);
  assert.match(body, /<video\b[^>]*\bcontrols(?:\s|=|>)/i, `${watchPath} video must expose controls`);
  assert.match(body, /<video\b[^>]*\bposter=["'][^"']+["']/i, `${watchPath} video must expose a poster`);
  assert.doesNotMatch(body, /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i, `${watchPath} must not be noindex`);
  assert.match(body, new RegExp(`<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']*${watchPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"']*["']`, "i"), `${watchPath} must self-canonicalize`);
  const videoNodes = jsonLdNodes(body).filter((node) => node?.["@type"] === "VideoObject");
  assert.equal(videoNodes.length, 1, `${watchPath} must expose exactly one VideoObject JSON-LD node`);
  const videoJsonLdPosition = body.search(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?"@type":"VideoObject"/i);
  assert(videoJsonLdPosition >= 0 && videoJsonLdPosition < body.indexOf("</head>"), `${watchPath} VideoObject JSON-LD must be in the document head`);
  assert(videoNodes[0].contentUrl, `${watchPath} VideoObject must expose contentUrl`);
  assert(videoNodes[0].thumbnailUrl, `${watchPath} VideoObject must expose thumbnailUrl`);
  assert(videoNodes[0].uploadDate, `${watchPath} VideoObject must expose uploadDate`);
  assert(videoNodes[0].duration, `${watchPath} VideoObject must expose duration`);
}

console.log(JSON.stringify({ ok: true, origin, watchPages: uniqueWatchPaths.length, uniqueVideoAssets: contentLocations.length }, null, 2));
