#!/usr/bin/env node
import assert from "node:assert/strict";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:3002").replace(/\/$/, "");
const publicOrigin = process.env.SMOKE_PUBLIC_ORIGIN || "https://www.mydreamshoots.com";
const publicHost = new URL(publicOrigin).host;
const redirects = [
  ["/ai-image-generation/motion-generator", "/ai-video-generation/motion-generator"],
  ["/ai-video-generation/ai-avatar-video", "/ai-video-generation"],
  ["/corporate-video", "/ai-video-generation"],
  ["/fitness-video", "/ai-video-generation"],
  ["/partner-registration", "/creators-circle"]
];
const legacyPaths = redirects.map(([path]) => path);
const headers = baseUrl.startsWith("http://localhost") || baseUrl.startsWith("http://127.0.0.1") ? { host: publicHost, "x-forwarded-host": publicHost } : {};

async function request(path, method = "GET") {
  return fetch(`${baseUrl}${path}`, { method, redirect: "manual", headers });
}

for (const [alias, target] of redirects) {
  for (const method of ["GET", "HEAD"]) {
    const response = await request(alias, method);
    assert.equal(response.status, 301, `${method} ${alias} must be a single 301`);
    const location = response.headers.get("location");
    assert.ok(location, `${method} ${alias} must include Location`);
    const expectedPublic = `${publicOrigin}${target}`;
    assert.equal(location, expectedPublic, `${method} ${alias} must expose the exact public HTTPS Location`);
    const targetResponse = await request(target);
    assert.equal(targetResponse.status, 200, `${target} must resolve to 200 after the alias`);
    assert.equal(targetResponse.headers.get("location"), null, `${alias} must not create a redirect chain`);
  }
  const siteResponse = await request(`/site/mydreamshoots${alias}`, "HEAD");
  assert.equal(siteResponse.status, 301, `site alias ${alias} must be a single 301`);
  assert.equal(siteResponse.headers.get("location"), `${publicOrigin}${target}`, `site alias ${alias} must use the same exact public HTTPS Location`);
}

const sitemap = await request("/sitemap.xml");
assert.equal(sitemap.status, 200, "MyDreamShoots sitemap must resolve");
const sitemapText = await sitemap.text();
for (const legacyPath of legacyPaths) assert.equal(sitemapText.includes(legacyPath), false, `${legacyPath} must not appear in sitemap`);

const targetHtml = await request("/creators-circle");
const html = await targetHtml.text();
for (const legacyPath of legacyPaths) assert.equal(html.includes(legacyPath), false, `${legacyPath} must not appear in internal links`);
assert.equal((html.match(/<h1\b/gi) ?? []).length, 1, "/creators-circle must render exactly one H1");
assert.match(html, /partner-application/i, "Creators Circle must expose the partner application anchor");

console.log(JSON.stringify({ ok: true, baseUrl, checkedRedirects: redirects.length, checkedMethods: ["GET", "HEAD"], sitemapLegacyHits: 0 }, null, 2));
