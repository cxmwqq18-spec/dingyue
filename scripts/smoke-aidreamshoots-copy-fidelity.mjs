#!/usr/bin/env node

import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_mydreamshoots_xby";
const SOURCE_SITE_ID = "site_dreamshoot";
const PAGE_SLUG = "/ai-video-generation/talking-photo";
const LOCAL_URL = "http://127.0.0.1:3002/site/aidreamshoots/ai-video-generation/talking-photo";

const corruptCopyPatterns = [
  /^Contenido de AIdreamshoots$/i,
  /^Ideas de fotos parlantes con IA$/i,
  /^Generación de vídeo con IA hablado foto$/i,
  /^AIdreamshoots permite crear fotos privadas con IA desde selfies/i,
  /^Sube fotos claras, elige un paquete, revisa los créditos y recibe resultados/i,
  /^Sube fotos claras, elige un paquete, revisa los creditos y recibe resultados/i,
  /galer[ií]un privada/i
];

function visitStrings(value, path = "$", output = []) {
  if (typeof value === "string") {
    output.push({ path, value });
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitStrings(item, `${path}[${index}]`, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) visitStrings(child, `${path}.${key}`, output);
  return output;
}

function talkingPhotoContent(pageJson) {
  const section = Object.values(pageJson?.sections ?? {}).find((item) => item?.type === "talking_photo_landing");
  return section?.settings?.content ?? null;
}

function assertNoCorruptCopy(rows, label) {
  const hits = rows.flatMap((row) => visitStrings(row.json, `${label}:${row.slug ?? row.id ?? "row"}`))
    .flatMap((item) => corruptCopyPatterns.some((pattern) => pattern.test(item.value)) ? [item] : []);
  assert.equal(hits.length, 0, `Corrupt generic copy remains in ${label}: ${JSON.stringify(hits.slice(0, 8))}`);
}

const prisma = new PrismaClient();
try {
  const [site, sourcePage, targetPage, targetLivePages, targetThemePages] = await Promise.all([
    prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SOURCE_SITE_ID, slug: PAGE_SLUG } }, select: { publishedJson: true } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_SLUG } }, select: { publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, contentJson: true } }),
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, publishedJson: true } })
  ]);

  assert.deepEqual(site, { id: SITE_ID, slug: "aidreamshoots", primaryDomain: "aidreamshoots.eu" });
  assert(sourcePage, `Source ThemePage is missing: ${PAGE_SLUG}`);
  assert(targetPage, `Target ThemePage is missing: ${PAGE_SLUG}`);

  const sourceContent = talkingPhotoContent(sourcePage.publishedJson);
  const targetContent = talkingPhotoContent(targetPage.publishedJson);
  assert(sourceContent, "Source talking-photo content is missing.");
  assert(targetContent, "Target talking-photo content is missing.");

  const sourceItems = Array.isArray(sourceContent.useCases?.items) ? sourceContent.useCases.items : [];
  const targetItems = Array.isArray(targetContent.useCases?.items) ? targetContent.useCases.items : [];
  assert.equal(targetItems.length, sourceItems.length, "Target talking-photo must preserve the source use-case count.");
  assert.equal(new Set(targetItems.map((item) => item.title)).size, targetItems.length, "Target talking-photo use-case titles must remain distinct.");
  assert.equal(new Set(targetItems.map((item) => item.body)).size, targetItems.length, "Target talking-photo use-case bodies must remain distinct.");
  assert.equal(new Set(targetItems.map((item) => item.script)).size, targetItems.length, "Target talking-photo scripts must remain distinct.");

  assertNoCorruptCopy(targetThemePages.map((row) => ({ ...row, json: row.publishedJson })), "ThemePage");
  assertNoCorruptCopy(targetLivePages.map((row) => ({ ...row, json: row.contentJson })), "LivePage");

  const response = await fetch(LOCAL_URL);
  assert.equal(response.status, 200, `Local storefront returned HTTP ${response.status}.`);
  const html = await response.text();
  assert(!corruptCopyPatterns.some((pattern) => pattern.test(html)), "Local storefront HTML still contains corrupt generic copy.");

  console.log(JSON.stringify({
    ok: true,
    site: site.slug,
    pageSlug: PAGE_SLUG,
    targetLocale: targetPage.publishedJson?.locale ?? null,
    talkingPhotoUseCases: targetItems.length,
    themePagesChecked: targetThemePages.length,
    livePagesChecked: targetLivePages.length,
    httpStatus: response.status
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
