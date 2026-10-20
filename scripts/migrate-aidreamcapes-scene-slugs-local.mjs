#!/usr/bin/env node

import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const target = argumentValue("--target") || "local";
assertDatabaseTarget({ expectedTarget: target });
if (target !== "local") throw new Error("This migration is local-only; production writes must use the incremental content release pipeline.");
const apply = hasArgument("--apply-local");
const outPath = argumentValue("--out");
const prisma = new PrismaClient();
const allowedHosts = new Set(["www.aivideosugc.com", "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"]);
const safePreviewPath = /^\/(?:media\/site_aidreamcapes|assets\/sites\/site_aidreamcapes)\/[A-Za-z0-9_./@%+-]+(?:\.(?:avif|gif|jpe?g|png|webp|mp4|webm))?$/i;
const sceneSlugPattern = /^[a-z0-9][a-z0-9-]{0,159}$/;

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function pointerPart(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function pageFromHref(value) {
  if (typeof value !== "string") return undefined;
  try {
    const href = new URL(value, "https://www.aivideosugc.com");
    if (!allowedHosts.has(href.hostname) || href.pathname !== "/app/create") return undefined;
    return href;
  } catch { return undefined; }
}

function presetCard(card) {
  const image = record(card?.image);
  const href = pageFromHref(card?.href);
  if (!image || typeof image.src !== "string" || !safePreviewPath.test(image.src)) return false;
  if (!(card.kind === "video" || card.kind === "photo")) return false;
  if (typeof card.label !== "string" || !card.label.trim()) return false;
  if (typeof card.prompt !== "string" || !card.prompt.trim() || card.prompt.length > 4000) return false;
  return Boolean(href);
}

function slugText(value) {
  const slug = String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
  return slug || "scene";
}

function cardSignature(pageSlug, card) {
  const image = record(card.image);
  return crypto.createHash("sha256").update(JSON.stringify([
    SITE_ID,
    pageSlug,
    card.kind,
    card.key ?? card.id ?? "",
    card.label,
    card.prompt,
    image?.src,
    card.tool ?? ""
  ])).digest("hex");
}

function workspaceSceneRouteSlug(pageSlug, sceneSlug) {
  return `${Buffer.from(pageSlug, "utf8").toString("base64url")}.${sceneSlug}`;
}

function collectPagePlan(page, globalRouteSlugs) {
  const contentJson = structuredClone(page.contentJson);
  const sections = record(contentJson?.sections);
  const order = Array.isArray(contentJson?.sectionsOrder) ? contentJson.sectionsOrder : Object.keys(sections ?? {});
  const writes = [];
  const mappings = [];
  let eligible = 0;

  for (const sectionId of order) {
    if (typeof sectionId !== "string") continue;
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const settings = record(section.settings);
    const data = record(settings?.data);
    const visual = record(data?.visual);
    const picker = record(visual?.picker);
    if (!Array.isArray(picker?.cards)) continue;

    picker.cards.forEach((value, index) => {
      const card = record(value);
      if (!card || !presetCard(card)) return;
      eligible += 1;
      const ptr = `/sections/${pointerPart(sectionId)}/settings/data/visual/picker/cards/${index}/sceneSlug`;
      const image = record(card.image);
      let sceneSlug = typeof card.sceneSlug === "string" ? card.sceneSlug : "";
      if (sceneSlug && !sceneSlugPattern.test(sceneSlug)) {
        throw new Error(`invalid_existing_scene_slug:${page.slug}:${ptr}`);
      }
      if (!sceneSlug) {
        const digest = cardSignature(page.slug, card);
        sceneSlug = `${slugText(card.label)}-${digest.slice(0, 12)}`;
        while (globalRouteSlugs.has(`${page.slug}\0${sceneSlug}`)) {
          sceneSlug = `${slugText(card.label)}-${crypto.randomBytes(5).toString("hex")}`;
        }
        card.sceneSlug = sceneSlug;
        writes.push({ pointer: ptr, sceneSlug, before: "absent" });
      }
      const routeSlug = workspaceSceneRouteSlug(page.slug, sceneSlug);
      const uniqueKey = `${page.slug}\0${sceneSlug}`;
      if (globalRouteSlugs.has(uniqueKey)) throw new Error(`duplicate_scene_slug:${page.slug}:${sceneSlug}`);
      globalRouteSlugs.add(uniqueKey);
      mappings.push({
        pageId: page.id,
        sourcePage: page.slug,
        pointer: ptr,
        sceneSlug,
        routeSlug,
        cardSignature: cardSignature(page.slug, { ...card, image })
      });
    });
  }

  return { contentJson, writes, mappings, eligible };
}

try {
  const pages = await prisma.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { id: true, siteId: true, slug: true, contentJson: true, updatedAt: true },
    orderBy: { slug: "asc" }
  });
  const globalRouteSlugs = new Set();
  const plans = pages.map((page) => ({ page, ...collectPagePlan(page, globalRouteSlugs) }));
  const changed = plans.filter((plan) => plan.writes.length > 0);
  const fieldWrites = changed.flatMap((plan) => plan.mappings.filter((mapping) => plan.writes.some((write) => write.pointer === mapping.pointer)).map((mapping) => ({
    ...mapping,
    baseUpdatedAt: plan.page.updatedAt.toISOString(),
    baseContentHash: crypto.createHash("sha256").update(JSON.stringify(plan.page.contentJson)).digest("hex")
  })));
  const summary = {
    generatedAt: new Date().toISOString(),
    target,
    siteId: SITE_ID,
    source: "current PostgreSQL LivePage.contentJson",
    mode: apply ? "apply-local" : "dry-run",
    pages: pages.length,
    eligiblePickerCards: plans.reduce((sum, plan) => sum + plan.eligible, 0),
    existingSceneSlugs: plans.reduce((sum, plan) => sum + plan.mappings.length, 0) - fieldWrites.length,
    newSceneSlugs: fieldWrites.length,
    changedPages: changed.length,
    fieldWrites
  };

  if (apply && changed.length) {
    await prisma.$transaction(async (tx) => {
      for (const plan of changed) {
        const result = await tx.livePage.updateMany({
          where: { id: plan.page.id, siteId: SITE_ID, updatedAt: plan.page.updatedAt },
          data: { contentJson: plan.contentJson }
        });
        if (result.count !== 1) throw new Error(`live_page_revision_conflict:${plan.page.slug}`);
      }
    });

    const reread = await prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { id: true, slug: true, contentJson: true } });
    const seen = new Set();
    const expected = new Set(plans.flatMap((plan) => plan.mappings.map((mapping) => mapping.routeSlug)));
    const actualSlugs = new Set();
    for (const page of reread) {
      const actual = collectPagePlan(page, seen);
      for (const mapping of actual.mappings) {
        actualSlugs.add(mapping.routeSlug);
      }
    }
    if (actualSlugs.size !== expected.size || [...expected].some((slug) => !actualSlugs.has(slug))) {
      throw new Error("scene_slug_readback_mismatch:current LivePage scene slugs differ from the migration manifest");
    }
    summary.readback = "passed";
  }

  if (outPath) {
    const resolved = path.resolve(outPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify({ written: resolved, ...Object.fromEntries(Object.entries(summary).filter(([key]) => key !== "fieldWrites")) }, null, 2));
  } else {
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
