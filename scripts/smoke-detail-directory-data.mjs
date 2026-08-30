#!/usr/bin/env node
import assert from "node:assert/strict";

const origin = process.env.STOREFRONT_ORIGIN || "http://127.0.0.1:3002";

async function read(path) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, `${path}: expected HTTP 200`);
  return response.text();
}

const videoHtml = await read("/site/mydreamshoots/best-ai-video");
assert.match(videoHtml, /data-dreamshoot-media-gallery-grid="video"/);
const videoCards = (videoHtml.match(/data-dreamshoot-showcase-preview="video"/g) ?? []).length;
assert.ok(videoCards > 0, "Best AI video must render current visual themes");
assert.doesNotMatch(videoHtml, />Video examples are being prepared\.</);

const saveTheDateHtml = await read("/site/mydreamshoots/best-save-the-date");
assert.match(saveTheDateHtml, /data-save-the-date-directory="true"/);
const saveTheDateCards = (saveTheDateHtml.match(/data-save-the-date-card="/g) ?? []).length;
assert.ok(saveTheDateCards > 0, "Save the Date must render published cards");
assert.doesNotMatch(saveTheDateHtml, />Save the Date themes are being prepared\.</);

console.log(JSON.stringify({ ok: true, videoCards, saveTheDateCards }, null, 2));
