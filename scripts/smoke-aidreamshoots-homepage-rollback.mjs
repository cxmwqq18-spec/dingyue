#!/usr/bin/env node

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const LOCAL_URL = "http://127.0.0.1:3002/site/aidreamshoots";
const EXPECTED_ORDER = [
  "hero_1",
  "generation_showcase_1",
  "tutorial_video_1",
  "proof_1",
  "faq_1",
  "conversion_1",
  "brand_strip_1"
];

function assertHomepage(json, label) {
  assert.deepEqual(json?.sectionsOrder, EXPECTED_ORDER, `${label}: homepage section order changed`);
  const hero = json?.sections?.hero_1?.settings;
  assert(hero, `${label}: homepage hero is missing`);
  assert.equal(hero.layout, "immersive_dark", `${label}: renderer layout contract changed`);
  assert.match(String(hero.imageUrl ?? ""), /\/generated\/regenerated\/aidreamshoots-/i, `${label}: regenerated hero asset was replaced`);
  assert.match(String(hero.heroGridImages ?? ""), /\/generated\/regenerated\/aidreamshoots-/i, `${label}: regenerated hero grid was replaced`);
  assert.doesNotMatch(String(hero.imageUrl ?? ""), /\/visuals\/generated\/20260622-homepage-unique\//i, `${label}: legacy hero asset was reintroduced`);
}

const prisma = new PrismaClient();
try {
  const [live, theme, response] = await Promise.all([
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } }, select: { contentJson: true } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "/" } }, select: { draftJson: true, publishedJson: true } }),
    fetch(LOCAL_URL)
  ]);
  assert(live, "homepage LivePage is missing");
  assert(theme, "homepage ThemePage is missing");
  assertHomepage(live.contentJson, "LivePage");
  assertHomepage(theme.draftJson, "ThemePage.draftJson");
  assertHomepage(theme.publishedJson, "ThemePage.publishedJson");
  assert.equal(response.status, 200, `local storefront returned HTTP ${response.status}`);
  const html = await response.text();
  assert.match(html, /Crea v[ií]deos con IA, retratos profesionales/i, "local homepage copy is not the restored Spanish homepage");
  // The client bundle still contains a historical fallback constant for other
  // code paths. Inspect actual rendered image tags instead of searching the
  // entire HTML document, which would produce a false rollback alarm.
  const renderedImageSources = [...html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/gi)].map((match) => match[1]);
  assert(renderedImageSources.some((src) => /\/generated\/regenerated\/aidreamshoots-/i.test(src)), "rendered homepage is missing current regenerated assets");
  assert(!renderedImageSources.some((src) => /20260622-homepage-unique|inmersivo_oscuro/i.test(src)), "rendered homepage still uses rollback assets");
  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, url: LOCAL_URL, status: response.status }, null, 2));
} finally {
  await prisma.$disconnect();
}
