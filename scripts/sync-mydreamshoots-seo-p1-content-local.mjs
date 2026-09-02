#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_dreamshoot";
const APPLY = process.argv.includes("--apply");
const TARGET_SLUGS = [
  "/",
  "/creators-circle",
  "/ai-image-generation",
  "/about-us",
  "/contact-us",
  "/pricing",
  "/workflow",
  "/ai-save-the-date/christmas"
];
const CONVERSION_TITLE = "Ready to try myDreamshoots?";
const CONVERSION_EYEBROW = "AI VIDEO + PHOTO CREATION";
const CONVERSION_SUBTITLE = "Create AI videos, personalized Save the Date videos, and professional photo sets from your images—all in one private workspace.";
const PRICING_SEO_TITLE = "myDreamshoots Pricing | AI Photo and Video Credits";
const PRICING_SIDE_PANEL_TITLE = "Plans start at {LIVE_LOWEST_ACTIVE_PLAN_PRICE}, with the current credit allowance and billing interval shown for each option.";

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function setSetting(json, sectionId, field, value, manifest) {
  const section = json?.sections?.[sectionId];
  assert(section?.settings && typeof section.settings === "object", `missing section settings: ${sectionId}`);
  if (section.settings[field] === value) return false;
  section.settings[field] = value;
  manifest.push(`/sections/${sectionId}/settings/${field}`);
  return true;
}

function transform(slug, input) {
  const json = clone(input ?? {});
  const manifest = [];
  if (slug === "/ai-save-the-date/christmas") {
    setSetting(json, "christmas_hero", "title", "Create AI Christmas Photos and Videos", manifest);
    setSetting(json, "christmas_hero", "h1", "Create AI Christmas Photos and Videos", manifest);
    return { json, manifest };
  }
  if (slug === "/creators-circle") {
    setSetting(json, "creators_intro_1", "primaryCta", "Contact us about the Creators Circle", manifest);
    setSetting(json, "creators_intro_1", "primaryHref", "/contact-us", manifest);
    setSetting(json, "creators_fit_1", "primaryCta", "Contact us about the Creators Circle", manifest);
    setSetting(json, "creators_fit_1", "primaryHref", "/contact-us", manifest);
    setSetting(json, "pricing_1", "sidePanelTitle", PRICING_SIDE_PANEL_TITLE, manifest);
  }
  if (slug === "/") {
    setSetting(json, "generation_showcase_1", "embeddedPricingSectionId", "pricing_1", manifest);
  }
  if (["/", "/creators-circle", "/ai-image-generation", "/about-us", "/contact-us", "/pricing", "/workflow"].includes(slug)) {
    setSetting(json, "conversion_1", "title", CONVERSION_TITLE, manifest);
    setSetting(json, "conversion_1", "eyebrow", CONVERSION_EYEBROW, manifest);
    setSetting(json, "conversion_1", "subtitle", CONVERSION_SUBTITLE, manifest);
  }
  if (slug === "/ai-image-generation") {
    setSetting(json, "taxonomy_1", "subtitle", "Browse all 37 myDreamshoots themes across professional, lifestyle, creative, magic, and photo tools before spending credits.", manifest);
  }
  if (slug === "/pricing") {
    if (json.seo?.title !== PRICING_SEO_TITLE) {
      json.seo = { ...(json.seo ?? {}), title: PRICING_SEO_TITLE };
      manifest.push("/seo/title");
    }
    setSetting(json, "pricing_1", "sidePanelTitle", PRICING_SIDE_PANEL_TITLE, manifest);
  }
  return { json, manifest };
}

assertDatabaseTarget({ expectedTarget: "local" });
const prisma = new PrismaClient();
const backupDir = path.join(process.cwd(), "releases", "backups", "local");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `mydreamshoots-seo-p1-content-${runId}.json`);

try {
  const [themePages, livePages, document] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: TARGET_SLUGS } }, select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: TARGET_SLUGS } }, select: { id: true, siteId: true, slug: true, title: true, contentJson: true } }),
    prisma.platformStateDocument.findUnique({ where: { id: "platform" }, select: { state: true } })
  ]);
  assert.equal(themePages.length, TARGET_SLUGS.length, "all targeted ThemePage rows must exist");
  assert.equal(livePages.length, TARGET_SLUGS.length, "all targeted LivePage rows must exist");
  assert(document?.state && typeof document.state === "object", "platform state document is required");

  const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
  const changes = [];
  const backups = [];
  const state = clone(document.state);
  const stateSite = (state.sites ?? []).find((site) => site.id === SITE_ID);
  assert(stateSite, `platform state site missing: ${SITE_ID}`);
  for (const page of themePages) {
    const draft = transform(page.slug, page.draftJson);
    const published = transform(page.slug, page.publishedJson);
    const live = liveBySlug.get(page.slug);
    const liveNext = transform(page.slug, live.contentJson);
    const pageChanged = JSON.stringify(draft.json) !== JSON.stringify(page.draftJson) || JSON.stringify(published.json) !== JSON.stringify(page.publishedJson);
    const liveChanged = JSON.stringify(liveNext.json) !== JSON.stringify(live.contentJson);
    if (!pageChanged && !liveChanged) continue;
    backups.push({ slug: page.slug, themePage: { id: page.id, draftJson: page.draftJson, publishedJson: page.publishedJson }, livePage: { id: live.id, contentJson: live.contentJson } });
    changes.push({ slug: page.slug, themePageId: page.id, livePageId: live.id, fieldPaths: [...new Set([...draft.manifest, ...published.manifest, ...liveNext.manifest])], themePageChanged: pageChanged, livePageChanged: liveChanged });
    const statePage = (stateSite.pages ?? []).find((candidate) => candidate.id === page.id || candidate.slug === page.slug);
    if (statePage) {
      statePage.draftJson = clone(draft.json);
      statePage.publishedJson = clone(published.json);
    }
    if (APPLY) {
      await prisma.$transaction(async (tx) => {
        if (pageChanged) await tx.themePage.update({ where: { id: page.id }, data: { draftJson: draft.json, publishedJson: published.json } });
        if (liveChanged) await tx.livePage.update({ where: { id: live.id }, data: { contentJson: liveNext.json } });
      });
    }
  }

  const report = { ok: true, mode: APPLY ? "apply" : "dry-run", siteId: SITE_ID, targetedSlugs: TARGET_SLUGS, changes, changedRecords: changes.length, backupPath: APPLY && backups.length ? backupPath : null };
  if (APPLY && backups.length) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, backups }, null, 2)}\n`, { mode: 0o600 });
    await prisma.platformStateDocument.update({ where: { id: "platform" }, data: { state } });
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
