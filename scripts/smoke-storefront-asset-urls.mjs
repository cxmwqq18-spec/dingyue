#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const configuredRoutes = (process.env.STOREFRONT_ASSET_URL_ROUTES || "/").split(",").map((value) => value.trim()).filter(Boolean);
const configuredHosts = (process.env.STOREFRONT_ASSET_URL_HOSTS || "www.mydreamshoots.com").split(",").map((value) => value.trim()).filter(Boolean);
const timeoutMs = Number(process.env.STOREFRONT_ASSET_URL_TIMEOUT_MS || 20_000);

function absoluteUrl(value) {
  try {
    return new URL(value, `${baseUrl}/`);
  } catch {
    return undefined;
  }
}

function localAssetPath(value) {
  const url = absoluteUrl(value);
  if (!url) return "";
  if (url.pathname === "/_next/image") {
    const nested = url.searchParams.get("url");
    return nested ? localAssetPath(nested) : "";
  }
  if (!url.pathname.startsWith("/assets/")) return "";
  return `${url.pathname}${url.search}`;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function assetReferencesFromHtml(html) {
  const references = new Set();
  for (const match of html.matchAll(/<(?:img|source|video)\b[^>]*(?:src|poster)=["']([^"']+)["']/gi)) {
    const asset = localAssetPath(match[1]);
    if (asset) references.add(asset);
  }
  for (const match of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    for (const candidate of match[1].split(",")) {
      const asset = localAssetPath(candidate.trim().split(/\s+/, 1)[0]);
      if (asset) references.add(asset);
    }
  }
  for (const match of html.matchAll(/url\((?:"|')?(\/assets\/[^"')\s]+)(?:"|')?\)/gi)) references.add(match[1]);
  return [...references];
}

async function checkRoute(host, route) {
  const pageUrl = new URL(route, `${baseUrl}/`).toString();
  const headers = { Host: host, "x-forwarded-host": host };
  const pageResponse = await fetchWithTimeout(pageUrl, { headers });
  assert.ok(pageResponse.status < 400, `${host}${route} returned ${pageResponse.status}`);
  const html = await pageResponse.text();
  const assets = assetReferencesFromHtml(html);
  assert.ok(assets.length > 0, `${host}${route} rendered no local asset references`);

  const failures = [];
  for (const asset of assets) {
    const assetUrl = new URL(asset, `${baseUrl}/`);
    let response = await fetchWithTimeout(assetUrl, { method: "HEAD", headers });
    let contentType = response.headers.get("content-type") || "";
    let contentLength = Number(response.headers.get("content-length") || 0);
    // Some CDNs omit Content-Length on HEAD even when the asset is valid.
    if (response.status >= 200 && response.status < 300 && contentLength <= 0) {
      const probe = await fetchWithTimeout(assetUrl, { headers: { ...headers, Range: "bytes=0-0" } });
      contentType = probe.headers.get("content-type") || contentType;
      contentLength = Number(probe.headers.get("content-length") || 0);
      if (contentLength <= 0 && probe.body) {
        const reader = probe.body.getReader();
        const firstChunk = await reader.read();
        contentLength = firstChunk.value?.byteLength || 0;
        await reader.cancel();
      }
      response = probe;
    }
    if (response.status < 200 || response.status >= 300 || contentLength <= 0 || !/^(image|video|font)\//i.test(contentType) && !/application\/svg\+xml/i.test(contentType)) {
      failures.push({ asset, status: response.status, contentType, contentLength });
    }
  }
  assert.deepEqual(failures, [], `${host}${route} has unavailable local assets: ${JSON.stringify(failures.slice(0, 8))}`);
  return { host, route, assets: assets.length };
}

const results = [];
for (const host of configuredHosts) {
  for (const route of configuredRoutes) results.push(await checkRoute(host, route));
}
console.log(JSON.stringify({ ok: true, baseUrl, checked: results }, null, 2));
