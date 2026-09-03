#!/usr/bin/env node
import assert from "node:assert/strict";
import { MYDREAMSHOOTS_P0_COPY_REPLACEMENTS, MYDREAMSHOOTS_P0_COPY_SLUGS } from "./lib/mydreamshoots-p0-copy-replacements.mjs";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
const publicOrigin = process.env.SMOKE_PUBLIC_ORIGIN || "https://www.mydreamshoots.com";
const host = new URL(publicOrigin).host;
const headers = { host, "x-forwarded-host": host, connection: "close" };
const oldPhrases = [...new Set(MYDREAMSHOOTS_P0_COPY_REPLACEMENTS.map((item) => item.oldText))];

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function readHtml(path) {
  let error;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, { headers });
      return { status: response.status, html: await response.text() };
    } catch (caught) {
      error = caught;
      if (attempt < 2) await wait(7_000);
    }
  }
  throw error;
}

for (const slug of MYDREAMSHOOTS_P0_COPY_SLUGS) {
  const path = `/ai-video-generation/${slug}`;
  const { status, html } = await readHtml(path);
  assert.equal(status, 200, `${path} must render with 200`);
  for (const phrase of oldPhrases) assert.equal(html.includes(phrase), false, `${path} must not render retired P0 copy`);
  for (const replacement of MYDREAMSHOOTS_P0_COPY_REPLACEMENTS.filter((item) => item.slug === slug)) {
    assert.ok(html.includes(replacement.newText), `${path} must render the approved replacement`);
  }
  assert.match(html, /<meta[^>]+name="robots"[^>]+content="index, ?follow"/i, `${path} must be index, follow`);
  assert.match(html, new RegExp(`<link[^>]+rel="canonical"[^>]+href="${publicOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}${path}"`, "i"), `${path} must self-canonicalize`);
}

const creators = await readHtml("/creators-circle");
assert.equal(creators.status, 200, "Creators Circle must render with 200");
const creatorsHtml = creators.html;
assert.equal((creatorsHtml.match(/<h1\b/gi) ?? []).length, 1, "Creators Circle must contain one H1");
assert.match(creatorsHtml, /id="partner-application"/, "Creators Circle must expose partner-application anchor");
assert.match(creatorsHtml, /\/api\/sites\/site_dreamshoot\/partner-applications/, "Creators Circle must use the existing partner application API");

console.log(JSON.stringify({ ok: true, baseUrl, checkedPages: MYDREAMSHOOTS_P0_COPY_SLUGS.length, oldPhraseHits: 0, creatorsCircleForm: true }, null, 2));
