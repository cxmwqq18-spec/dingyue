#!/usr/bin/env node
import assert from "node:assert/strict";

const origin = process.env.STOREFRONT_ORIGIN || "http://127.0.0.1:3002";
const oldFaqCaption = "A guided place to compare AI photo directions, review credits, and keep finished work organized.";
const newFaqCaption = "A guided place to compare AI video directions, review credits, and keep finished work organized.";

function countExact(value, needle) {
  return value.split(needle).length - 1;
}

function renderedHtml(value) {
  return value.replace(/<script\b[\s\S]*?<\/script>/gi, "");
}

async function read(path) {
  const response = await fetch(`${origin}${path}`);
  assert.equal(response.status, 200, `${path}: expected HTTP 200`);
  return response.text();
}

const videoHtml = await read("/site/mydreamshoots/best-ai-video");
const renderedVideoHtml = renderedHtml(videoHtml);
assert.match(videoHtml, /data-dreamshoot-media-gallery-grid="video"/);
const videoCards = (videoHtml.match(/data-dreamshoot-showcase-preview="video"/g) ?? []).length;
assert.ok(videoCards > 0, "Best AI video must render current visual themes");
assert.doesNotMatch(videoHtml, />Video examples are being prepared\.</);
assert.equal(countExact(renderedVideoHtml, newFaqCaption), 1, "Best AI video FAQ must use the video directions caption once");
assert.equal(countExact(renderedVideoHtml, oldFaqCaption), 0, "Best AI video FAQ must not retain the photo directions caption");

const imageHtml = await read("/site/mydreamshoots/best-ai-image");
const renderedImageHtml = renderedHtml(imageHtml);
assert.equal(countExact(renderedImageHtml, oldFaqCaption), 1, "Best AI image FAQ must retain the photo directions caption once");
assert.equal(countExact(renderedImageHtml, newFaqCaption), 0, "Best AI image FAQ must not use the video directions caption");

const saveTheDateHtml = await read("/site/mydreamshoots/best-save-the-date");
assert.match(saveTheDateHtml, /data-save-the-date-directory="true"/);
const saveTheDateCards = (saveTheDateHtml.match(/data-save-the-date-card="/g) ?? []).length;
assert.ok(saveTheDateCards > 0, "Save the Date must render published cards");
assert.doesNotMatch(saveTheDateHtml, />Save the Date themes are being prepared\.</);

console.log(JSON.stringify({ ok: true, videoCards, saveTheDateCards }, null, 2));
