#!/usr/bin/env node

import assert from "node:assert/strict";

const baseUrl = (process.env.SMOKE_AIDREAMCAPES_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const host = process.env.SMOKE_AIDREAMCAPES_HOST || "www.aidreamcapes.com";
const retiredRoutes = [
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/save-the-date",
  "/best-save-the-date",
  "/holidays-events/christmas",
  "/ai-video-generation/christmas",
  "/ai-video-generation/save-the-date"
];

async function get(path, redirect = "manual") {
  return fetch(`${baseUrl}${path}`, {
    headers: {
      host,
      "x-forwarded-host": host,
      "user-agent": "aidreamcapes-save-the-date-retirement-smoke"
    },
    redirect
  });
}

for (const path of retiredRoutes) {
  const response = await get(path);
  assert.equal(response.status, 404, `${path}: retired Aidreamcapes route must return 404`);
  assert.equal(response.headers.get("location"), null, `${path}: retired route must not redirect`);
}

const sitemap = await get("/sitemap.xml", "follow");
assert.equal(sitemap.status, 200, "Aidreamcapes sitemap must remain available");
const sitemapBody = await sitemap.text();
assert.doesNotMatch(sitemapBody, /<loc>[^<]*(?:ai-save-the-date|best-save-the-date|holidays-events)[^<]*<\/loc>/i, "retired Save the Date URLs must not be in sitemap loc entries");

const home = await get("/", "follow");
assert.equal(home.status, 200, "Aidreamcapes homepage must remain available");
const homeBody = await home.text();
const hrefs = [...homeBody.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
assert.equal(
  hrefs.some((href) => /(?:ai-save-the-date|best-save-the-date|holidays-events)/i.test(href)),
  false,
  "Aidreamcapes homepage must not expose retired Save the Date hrefs"
);

console.log(JSON.stringify({ ok: true, host, retiredRoutes: retiredRoutes.length }));
