#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGET_SITE_ID = "site_aidreamcapes_xby";
const GENERIC_FALLBACK = "Créez une photo parlante à partir de sources autorisées, puis vérifiez chaque détail avant le partage.";
const RESIDUAL_ENGLISH = /\b(?:the|and|with|from|your|you|create|creating|customer|private|workspace|problem|example|eyes|mouth|sunglasses|side|video|story|brand|before|after|need|want|what|how|cannot|record|happy|thank)\b/i;
const DEDICATED_TYPES = new Set(["ai_video_topic_landing", "talking_photo_landing"]);

function dedicatedContent(page, payloadKey = "contentJson") {
  const section = Object.values(page?.[payloadKey]?.sections ?? {}).find((candidate) => DEDICATED_TYPES.has(candidate?.type));
  return section?.settings?.content;
}

function assertNoRepeatedFallback(content, slug) {
  const items = Array.isArray(content?.useCases?.items) ? content.useCases.items : [];
  if (items.length < 3) return;
  const titles = new Set(items.map((item) => String(item?.title ?? "").trim()).filter(Boolean));
  const bodies = new Set(items.map((item) => String(item?.body ?? "").trim()).filter(Boolean));
  assert(titles.size >= Math.ceil(items.length / 2), `${slug}: use-case titles were collapsed into a generic template`);
  assert(bodies.size >= Math.ceil(items.length / 2), `${slug}: use-case bodies were collapsed into a generic template`);
  assert(!JSON.stringify(content).includes(GENERIC_FALLBACK), `${slug}: generic fallback copy leaked into the published topic payload`);
}

function assertFrenchCopy(content, slug) {
  const values = [];
  const walk = (value, key = "") => {
    if (typeof value === "string") {
      if (!/^(?:https?:|\/|data:)/i.test(value) && !/^(?:id|slug|type|fit|canonicalPath)$/i.test(key)) values.push(value);
      return;
    }
    if (Array.isArray(value)) return value.forEach((item) => walk(item, key));
    if (value && typeof value === "object") return Object.entries(value).forEach(([childKey, childValue]) => walk(childValue, childKey));
  };
  walk(content);
  const residual = values.filter((value) => RESIDUAL_ENGLISH.test(value));
  assert.equal(residual.length, 0, `${slug}: residual English copy found: ${residual.slice(0, 3).join(" | ")}`);
}

const prisma = new PrismaClient();
try {
  const [sourcePages, targetPages, sourceThemes, targetThemes] = await Promise.all([
    prisma.livePage.findMany({ where: { siteId: SOURCE_SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, select: { slug: true, contentJson: true } }),
    prisma.livePage.findMany({ where: { siteId: TARGET_SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, select: { slug: true, contentJson: true } }),
    prisma.themePage.findMany({ where: { siteId: SOURCE_SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, select: { slug: true, publishedJson: true } }),
    prisma.themePage.findMany({ where: { siteId: TARGET_SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, select: { slug: true, publishedJson: true } })
  ]);
  let checkedPages = 0;
  for (const [sourceRows, targetRows, payloadKey] of [[sourcePages, targetPages, "contentJson"], [sourceThemes, targetThemes, "publishedJson"]]) {
    const sourceBySlug = new Map(sourceRows.map((page) => [page.slug, page]));
    const dedicatedTargets = targetRows.filter((page) => dedicatedContent(page, payloadKey));
    assert(dedicatedTargets.length >= 20, `expected at least 20 dedicated EU video pages in ${payloadKey}, found ${dedicatedTargets.length}`);
    for (const targetPage of dedicatedTargets) {
      const target = dedicatedContent(targetPage, payloadKey);
      const source = dedicatedContent(sourceBySlug.get(targetPage.slug), payloadKey);
      assert(source, `${targetPage.slug} (${payloadKey}): source topic content is missing`);
      const sourceItems = Array.isArray(source?.useCases?.items) ? source.useCases.items : [];
      const targetItems = Array.isArray(target?.useCases?.items) ? target.useCases.items : [];
      assert.equal(targetItems.length, sourceItems.length, `${targetPage.slug} (${payloadKey}): target/source use-case count differs`);
      assertNoRepeatedFallback(target, `${targetPage.slug} (${payloadKey})`);
      assertFrenchCopy(target, `${targetPage.slug} (${payloadKey})`);
      checkedPages += 1;
    }
  }
  console.log(JSON.stringify({ ok: true, checkedPages }));
} finally {
  await prisma.$disconnect();
}
