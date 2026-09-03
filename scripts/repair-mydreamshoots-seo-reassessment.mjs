#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";
import { MYDREAMSHOOTS_REASSESSMENT_P0_COPY, MYDREAMSHOOTS_REASSESSMENT_P1, MYDREAMSHOOTS_REASSESSMENT_P1_PATHS } from "./lib/mydreamshoots-seo-reassessment.mjs";

const SITE_ID = "site_dreamshoot";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply") && !hasArgument("--dry-run");
const productionConfirmed = hasArgument("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-seo-reassessment";
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: target === "production", productionConfirmed });
if (apply && target !== "production") assertNonProductionWriteTarget();
if (target === "production" && apply && !productionConfirmed) throw new Error("Production remediation requires --confirm-production --confirm=mydreamshoots-seo-reassessment.");

const clone = (value) => structuredClone(value ?? {});
const stable = (value) => JSON.stringify(value);
const p0ByPath = new Map();
for (const item of MYDREAMSHOOTS_REASSESSMENT_P0_COPY) p0ByPath.set(item.path, [...(p0ByPath.get(item.path) ?? []), item]);

function replaceStrings(value, replacements) {
  if (typeof value === "string") return replacements.reduce((text, [from, to]) => text.split(from).join(to), value);
  if (Array.isArray(value)) return value.map((child) => replaceStrings(child, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceStrings(child, replacements)]));
}

function countQuestions(value, question) {
  if (Array.isArray(value)) return value.reduce((count, child) => count + countQuestions(child, question), 0);
  if (!value || typeof value !== "object") return 0;
  return Object.entries(value).reduce((count, [key, child]) => count + (key === "question" && child === question ? 1 : countQuestions(child, question)), 0);
}

function replaceFaqAnswer(value, item, currentPath = "") {
  if (Array.isArray(value)) return value.map((child, index) => replaceFaqAnswer(child, item, `${currentPath}[${index}]`));
  if (!value || typeof value !== "object") return value;
  const next = { ...value };
  if (next.question === item.question && typeof next.answer === "string") {
    assert(next.answer === item.oldText || next.answer === item.newText, `${item.path} FAQ answer differs from the audited source at ${currentPath}`);
    next.answer = item.newText;
  }
  for (const [key, child] of Object.entries(next)) next[key] = replaceFaqAnswer(child, item, `${currentPath}/${key}`);
  return next;
}

const allowedStateTitles = ["myDreamshoots DPDPA", MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyTitle];
const allowedStateDescriptions = [
  "Review myDreamshoots DPDPA information for California privacy requests, access, deletion, correction, opt-out choices, and company contact details.",
  "Review State Privacy Notice for California and Other U.S. Residents | myDreamshoots information for California privacy requests, access, deletion, correction, and opt-out choices.",
  "Review State Privacy Notice for California and Other U.S. Residents | myDreamshoots information for California privacy requests, access, deletion, correction, opt-out choices, and company contact details.",
  MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyDescription
];

function updateStatePrivacyJson(json) {
  const next = clone(json);
  assert(!next.seo?.title || allowedStateTitles.includes(next.seo.title), "state privacy SEO title has an unexpected manual edit");
  assert(!next.seo?.description || allowedStateDescriptions.includes(next.seo.description), "state privacy SEO description has an unexpected manual edit");
  next.title = MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH1;
  next.seo = { ...(next.seo ?? {}), title: MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyTitle, description: MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyDescription };
  if (next.sections?.intro_1?.settings) {
    assert(!next.sections.intro_1.settings.title || ["DPDPA", MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH2].includes(next.sections.intro_1.settings.title), "state privacy intro heading has an unexpected manual edit");
    next.sections.intro_1.settings.title = MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH2;
  }
  if (next.sections?.policy_1?.settings) {
    assert(!next.sections.policy_1.settings.title || ["DPDPA", MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH1].includes(next.sections.policy_1.settings.title), "state privacy policy heading has an unexpected manual edit");
    next.sections.policy_1.settings.title = MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH1;
  }
  return replaceStrings(next, [["<h3>1. DPDPA</h3>", `<h3>${MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyH3}</h3>`], [">DPDPA</a>", ">State Privacy</a>"]]);
}

function updateChildrenPrivacyJson(json) {
  return replaceStrings(clone(json), [["<h3>5. DPDPA requests</h3>", `<h3>${MYDREAMSHOOTS_REASSESSMENT_P1.childrenPrivacyH3}</h3>`], [">DPDPA</a>", ">State Privacy</a>"]]);
}

function updatePageJson(slug, json) {
  let next = clone(json);
  for (const item of p0ByPath.get(slug) ?? []) {
    assert.equal(countQuestions(next, item.question), 1, `${slug} must contain exactly one audited FAQ question: ${item.question}`);
    next = replaceFaqAnswer(next, item);
  }
  if (slug === "/pricing" && next.sections?.pricing_intro_1?.settings) {
    assert(!next.sections.pricing_intro_1.settings.title || ["How credits work for private AI photo packages.", MYDREAMSHOOTS_REASSESSMENT_P1.pricingH1].includes(next.sections.pricing_intro_1.settings.title), "pricing H1 has an unexpected manual edit");
    next.sections.pricing_intro_1.settings.title = MYDREAMSHOOTS_REASSESSMENT_P1.pricingH1;
  }
  if (slug === "/terms") next.seo = { ...(next.seo ?? {}), title: MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle };
  if (slug === "/state-privacy") next = updateStatePrivacyJson(next);
  if (slug === "/children-privacy") next = updateChildrenPrivacyJson(next);
  if (slug === "/ai-video-generation/youtube-video") {
    const topic = next.sections?.ai_video_topic_landing_1?.settings?.content;
    assert(topic?.hero && typeof topic.hero === "object", "YouTube Video must keep dedicated topic content");
    assert(!topic.hero.title || ["Turn a Bigger Idea Into a YouTube Video Worth Watching", MYDREAMSHOOTS_REASSESSMENT_P1.youtubeH1].includes(topic.hero.title), "YouTube H1 has an unexpected manual edit");
    topic.hero.title = MYDREAMSHOOTS_REASSESSMENT_P1.youtubeH1;
  }
  return next;
}

function updateThemeSettings(value) {
  const next = clone(value);
  const footerLists = [next.navigation?.footerLinks, next.globalSections?.footer?.blocks];
  for (const list of footerLists) for (const item of Array.isArray(list) ? list : []) {
    const settings = item?.settings ?? item;
    if (settings?.href === "/state-privacy") {
      assert(!settings.label || ["DPDPA", MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyFooterLabel].includes(settings.label), "state privacy footer label has an unexpected manual edit");
      settings.label = MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyFooterLabel;
    }
  }
  const seoPages = next.seo?.pages;
  for (const [key, page] of Object.entries(seoPages && typeof seoPages === "object" && !Array.isArray(seoPages) ? seoPages : {})) {
    if (!page || typeof page !== "object" || Array.isArray(page)) continue;
    if (/state_privacy/i.test(key)) {
      assert(!page.title || allowedStateTitles.includes(page.title), `state privacy template SEO title has an unexpected manual edit: ${key}`);
      assert(!page.description || allowedStateDescriptions.includes(page.description), `state privacy template SEO description has an unexpected manual edit: ${key}`);
      page.title = MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyTitle;
      page.description = MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyDescription;
    }
    if (/terms(?:_service)?$/i.test(key)) {
      assert(!page.title || ["Terms of Service for myDreamshoots AI Headshot Photo Package", MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle].includes(page.title), `terms template SEO title has an unexpected manual edit: ${key}`);
      page.title = MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle;
    }
  }
  return next;
}

const allSlugs = [...new Set([...MYDREAMSHOOTS_REASSESSMENT_P0_COPY.map((item) => item.path), ...MYDREAMSHOOTS_REASSESSMENT_P1_PATHS])];
const prisma = new PrismaClient();
try {
  const [themePages, livePages, settings] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { in: allSlugs } }, select: { id: true, slug: true, title: true, draftJson: true, publishedJson: true }, orderBy: { slug: "asc" } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: allSlugs } }, select: { id: true, slug: true, title: true, contentJson: true }, orderBy: { slug: "asc" } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { id: true, draftJson: true, publishedJson: true } })
  ]);
  assert.equal(themePages.length, allSlugs.length, "all reassessment ThemePage rows must exist");
  assert.equal(livePages.length, allSlugs.length, "all reassessment LivePage rows must exist");
  assert(settings, "MyDreamShoots ThemeSettings row must exist");
  const themeBySlug = new Map(themePages.map((page) => [page.slug, page]));
  const liveBySlug = new Map(livePages.map((page) => [page.slug, page]));
  const updates = [];
  for (const slug of allSlugs) {
    const live = liveBySlug.get(slug); const theme = themeBySlug.get(slug);
    const liveNext = updatePageJson(slug, live.contentJson); const draftNext = updatePageJson(slug, theme.draftJson); const publishedNext = updatePageJson(slug, theme.publishedJson);
    const pageTitle = slug === "/state-privacy" ? MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyTitle : slug === "/terms" ? MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle : theme.title;
    const liveTitle = slug === "/state-privacy" ? MYDREAMSHOOTS_REASSESSMENT_P1.statePrivacyTitle : slug === "/terms" ? MYDREAMSHOOTS_REASSESSMENT_P1.termsTitle : live.title;
    if (stable(liveNext) !== stable(live.contentJson) || stable(draftNext) !== stable(theme.draftJson) || stable(publishedNext) !== stable(theme.publishedJson) || pageTitle !== theme.title || liveTitle !== live.title) updates.push({ slug, live, theme, liveNext, draftNext, publishedNext, pageTitle, liveTitle });
  }
  const settingsDraftNext = updateThemeSettings(settings.draftJson); const settingsPublishedNext = updateThemeSettings(settings.publishedJson);
  const settingsChanged = stable(settingsDraftNext) !== stable(settings.draftJson) || stable(settingsPublishedNext) !== stable(settings.publishedJson);
  const report = { ok: true, mode: apply ? "apply" : "dry-run", target, siteId: SITE_ID, pagesChecked: allSlugs.length, changedPages: updates.map((item) => item.slug), settingsChanged, backupPath: null };
  if (apply && (updates.length || settingsChanged)) {
    const backupDir = path.join(process.cwd(), "releases", "backups"); fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `mydreamshoots-seo-reassessment-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, pages: updates.map(({ live, theme }) => ({ live, theme })), settings }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.livePage.update({ where: { id: update.live.id }, data: { title: update.liveTitle, contentJson: update.liveNext } });
        await tx.themePage.update({ where: { id: update.theme.id }, data: { title: update.pageTitle, draftJson: update.draftNext, publishedJson: update.publishedNext } });
      }
      if (settingsChanged) await tx.themeSettings.update({ where: { id: settings.id }, data: { draftJson: settingsDraftNext, publishedJson: settingsPublishedNext } });
    }, { timeout: 120_000 });
    report.backupPath = backupPath;
    const readback = await prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { in: allSlugs } }, select: { slug: true, title: true, contentJson: true } });
    for (const update of updates) {
      const saved = readback.find((page) => page.slug === update.slug); assert(saved, `missing LivePage readback: ${update.slug}`);
      assert.equal(saved.title, update.liveTitle); assert.deepEqual(saved.contentJson, update.liveNext, `LivePage content readback mismatch: ${update.slug}`);
    }
  }
  report.manifestHash = crypto.createHash("sha256").update(JSON.stringify({ allSlugs, updates: updates.map((item) => item.slug), settingsChanged })).digest("hex").slice(0, 20);
  console.log(JSON.stringify(report, null, 2));
} finally { await prisma.$disconnect(); }
