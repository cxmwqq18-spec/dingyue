#!/usr/bin/env node
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3010").replace(/\/+$/, "");
const host = process.env.MYDREAMSHOOTS_HOST || "www.mydreamshoots.com";

function fetchText(pathname, accept, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    const url = new URL(pathname, `${baseUrl}/`);
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request(url, {
      headers: { accept, host }
    }, (response) => {
      const chunks = [];
      response.setEncoding("utf8");
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", async () => {
        const status = response.statusCode || 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location && redirectCount < 5) {
          const nextUrl = new URL(location, url);
          const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
          resolve(await fetchText(nextPath, accept, redirectCount + 1));
          return;
        }
        resolve({ body: chunks.join(""), headers: response.headers, status });
      });
    });
    request.on("error", reject);
    request.end();
  });
}

async function fetchHtml(pathname) {
  const response = await fetchText(pathname, "text/html");
  assert.equal(response.status, 200, `${pathname} should return HTTP 200`);
  return response.body;
}

function graphNodes(html) {
  return [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap((match) => {
      try {
        const payload = JSON.parse(match[1]);
        return Array.isArray(payload?.["@graph"]) ? payload["@graph"] : [];
      } catch {
        return [];
      }
    });
}

const homepage = await fetchHtml("/");
const pricing = await fetchHtml("/pricing");
const collection = await fetchHtml("/collections/professional-headshots");
const sitemap = (await fetchText("/sitemap.xml", "application/xml")).body;
const homepageGraph = graphNodes(homepage);
const collectionGraph = graphNodes(collection);

assert.equal(homepage.includes("Reviews and trust signals are loading now"), false, "homepage must not SSR the review placeholder");
assert.equal(homepage.includes("Preparing credits and plan options"), false, "homepage must not SSR the pricing placeholder");
assert.equal(pricing.includes("Reviews and trust signals are loading now"), false, "pricing must not SSR the review placeholder");
assert.equal(pricing.includes("Preparing credits and plan options"), false, "pricing must not SSR the pricing placeholder");
assert.ok(pricing.includes("Starter") && (pricing.includes("$24.50") || pricing.includes("24.50")), "pricing HTML must contain real plan content");
assert.equal(homepageGraph.filter((node) => node?.["@type"] === "VideoObject").length, 8, "homepage SSR must contain 8 VideoObject nodes");
assert.equal(collectionGraph.filter((node) => node?.["@type"] === "Product").length, 1, "collection SSR must contain one Product node");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/pricing"), "sitemap must contain the canonical pricing URL");
assert.ok(sitemap.includes("https://www.mydreamshoots.com/collections/headshots"), "sitemap must contain the canonical headshots URL");

console.log(JSON.stringify({
  ok: true,
  pages: ["/", "/pricing", "/collections/professional-headshots"],
  placeholders: 0,
  homepageVideoObjects: homepageGraph.filter((node) => node?.["@type"] === "VideoObject").length,
  collectionProductObjects: collectionGraph.filter((node) => node?.["@type"] === "Product").length
}, null, 2));
