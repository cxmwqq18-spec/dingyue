#!/usr/bin/env node
// Read-only probe for the P1-4 metadata gaps on the Aidreamcapes storefront.
//
// Reports, for every sitemap URL:
//   * the robots meta content and whether max-image-preview:large is present
//   * whether the page emits a BreadcrumbList JSON-LD node
//   * whether any JSON-LD image url is relative instead of absolute
//
// It never writes. Usage:
//   node scripts/audit-aidreamcapes-metadata-gaps.mjs --origin=https://www.aivideosugc.com
import fs from "node:fs/promises";
import http from "node:http";
import https from "node:https";

const args = new Map(
  process.argv.slice(2).map((raw) => {
    const [key, ...rest] = raw.replace(/^--/, "").split("=");
    return [key, rest.join("=") || "true"];
  })
);
const origin = (args.get("origin") || "https://www.aivideosugc.com").replace(/\/+$/, "");
const concurrency = Math.max(1, Number(args.get("concurrency") || 6));
const outPath = args.get("out") || "";
// A loopback origin has no host mapping, so allow the probe to send the public
// storefront host the same way the cache benchmark does.
const probeHost = args.get("host") || "";
const requestHeaders = {
  "User-Agent": "AidreamcapesMetadataProbe/1.0",
  ...(probeHost ? { Host: probeHost, "X-Forwarded-Host": probeHost, "X-Forwarded-Proto": "https" } : {})
};

function getOnce(rawUrl) {
  return new Promise((resolve, reject) => {
    const client = rawUrl.startsWith("https:") ? https : http;
    const req = client.request(rawUrl, { method: "GET", headers: requestHeaders }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
    });
    req.setTimeout(30000, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

// Edge resets are common when a probe run crosses a proxy; retry once before
// reporting a page as unreachable so a single ECONNRESET does not fail the gate.
async function get(rawUrl) {
  try {
    return await getOnce(rawUrl);
  } catch (error) {
    if (process.env.METADATA_PROBE_NO_RETRY === "1") throw error;
    await new Promise((resolve) => setTimeout(resolve, 500));
    return getOnce(rawUrl);
  }
}

function metaContent(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]+name=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*name=["']${name}["']`, "i")
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }
  return "";
}

function jsonLdBlocks(html) {
  const blocks = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html))) {
    try {
      blocks.push(JSON.parse(match[1]));
    } catch {
      // A malformed block is itself a defect; record it as unparsable.
      blocks.push({ __unparsable: true });
    }
  }
  return blocks;
}

function collectTypes(node, found = new Set(), images = []) {
  if (!node || typeof node !== "object") return { found, images };
  if (Array.isArray(node)) {
    for (const item of node) collectTypes(item, found, images);
    return { found, images };
  }
  if (Array.isArray(node["@graph"])) collectTypes(node["@graph"], found, images);
  if (typeof node["@type"] === "string") {
    for (const type of node["@type"].split("/")) found.add(type);
  }
  if (node.image) {
    const imagesNode = node.image;
    const list = Array.isArray(imagesNode) ? imagesNode : [imagesNode];
    for (const entry of list) {
      if (typeof entry === "string") images.push(entry);
      else if (entry && typeof entry.url === "string") images.push(entry.url);
    }
  }
  if (node.contentUrl && typeof node.contentUrl === "string") images.push(node.contentUrl);
  return { found, images };
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await fn(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

const sitemap = await get(`${origin}/sitemap.xml`);
const urls = [...sitemap.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1].trim());
if (!urls.length) throw new Error("no sitemap urls");

// Sitemap entries are absolute public URLs. Request them from the supplied
// origin so the same probe works against a loopback candidate build.
function requestUrlFor(url) {
  const parsed = new URL(url);
  return `${origin}${parsed.pathname}${parsed.search}`;
}

const rows = await mapLimit(urls, concurrency, async (url) => {
  try {
    const res = await get(requestUrlFor(url));
    const html = res.body;
    const robots = metaContent(html, "robots");
    const blocks = jsonLdBlocks(html);
    const found = new Set();
    const images = [];
    for (const block of blocks) collectTypes(block, found, images);
    const relativeImages = images.filter((value) => value && !/^https?:\/\//i.test(value));
    return {
      url,
      status: res.status,
      robots: robots || null,
      maxImagePreview: /max-image-preview\s*[:=]\s*"?large"?/i.test(robots),
      hasBreadcrumb: found.has("BreadcrumbList"),
      jsonLdTypes: [...found].sort(),
      relativeImageCount: relativeImages.length,
      relativeImages: relativeImages.slice(0, 3),
      jsonLdBlockCount: blocks.length,
      unparsableJsonLd: blocks.filter((b) => b && b.__unparsable).length
    };
  } catch (error) {
    return { url, status: 0, error: String(error) };
  }
});

// The home page is the breadcrumb root, so a single-item BreadcrumbList would
// add no navigation path. Every other public page must list Home + itself.
const isHomePage = (url) => new URL(url).pathname === "/";
const missingMaxImagePreview = rows.filter((r) => r.status === 200 && !r.maxImagePreview);
const missingBreadcrumb = rows.filter((r) => r.status === 200 && !isHomePage(r.url) && !r.hasBreadcrumb);
const relativeImagePages = rows.filter((r) => r.status === 200 && r.relativeImageCount > 0);

const summary = {
  total: rows.length,
  ok: rows.filter((r) => r.status === 200).length,
  missingMaxImagePreviewCount: missingMaxImagePreview.length,
  missingMaxImagePreview: missingMaxImagePreview.map((r) => ({ url: r.url, robots: r.robots })),
  missingBreadcrumbCount: missingBreadcrumb.length,
  missingBreadcrumb: missingBreadcrumb.map((r) => r.url),
  homePageBreadcrumbException: rows.filter((r) => r.status === 200 && isHomePage(r.url) && !r.hasBreadcrumb).map((r) => r.url),
  relativeImagePageCount: relativeImagePages.length,
  relativeImagePages: relativeImagePages.slice(0, 20).map((r) => ({ url: r.url, count: r.relativeImageCount, samples: r.relativeImages })),
  unparsableJsonLdPages: rows.filter((r) => r.unparsableJsonLd > 0).map((r) => r.url)
};

console.log(JSON.stringify(summary, null, 2));
if (outPath) {
  await fs.writeFile(outPath, `${JSON.stringify({ summary, rows }, null, 2)}\n`);
  console.log(`[metadata-probe] wrote ${outPath}`);
}

// Non-zero exit makes this usable as a release gate: any robot directive gap,
// missing breadcrumb (home excluded), relative JSON-LD image or unparsable
// block fails the run.
const failureCount =
  summary.missingMaxImagePreviewCount +
  summary.missingBreadcrumbCount +
  summary.relativeImagePageCount +
  summary.unparsableJsonLdPages.length +
  (rows.length - summary.ok);
if (failureCount > 0) {
  console.error(`[metadata-probe] ${failureCount} gap(s) found`);
  process.exitCode = 1;
} else {
  console.log("[metadata-probe] no metadata gaps");
}
