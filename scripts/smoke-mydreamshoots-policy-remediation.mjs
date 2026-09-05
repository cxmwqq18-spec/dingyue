#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_dreamshoot";
const canonicalPaths = ["/privacy", "/terms", "/refunds", "/children-privacy", "/cookies", "/content", "/shipping"];
const aliases = [
  "/privacy-policy", "/policies/privacy", "/terms-of-service", "/policies/terms", "/refund-policy", "/policies/refund", "/policies/refunds",
  "/children-privacy-policy", "/childrens-privacy", "/policies/children-privacy", "/cookie-policy", "/policies/cookies", "/content-policy", "/policies/content",
  "/shipping-policy", "/delivery-policy", "/policies/shipping"
];
const forbidden = [
  "AES-256 at rest",
  "TLS 256-bit in transit",
  "Our footer links include KIDS Act",
  "100% money-back guarantee",
  "KIDS Act",
  "COPPA-aware",
  "Do not upload minors, non-consenting people",
  "AI photo service."
];
const termsUploadRule = "Do not upload photos of minors or non-consenting people unless you have the legal right and consent required for the requested use.";

function serialized(value) {
  return JSON.stringify(value ?? {});
}

function assertClean(value, label) {
  const text = serialized(value);
  for (const phrase of forbidden) assert.equal(text.includes(phrase), false, `${label} must not contain ${phrase}`);
}

function policyBody(json) {
  return String(json?.sections?.policy_1?.settings?.body ?? "");
}

const prisma = new PrismaClient();
try {
  const [themePages, livePages, settings, siteThemes] = await Promise.all([
    prisma.themePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true, title: true, draftJson: true, publishedJson: true } }),
    prisma.livePage.findMany({ where: { siteId: SITE_ID }, select: { slug: true, title: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } }),
    prisma.siteTheme.findMany({ where: { siteId: SITE_ID }, select: { id: true, templates: true, settings: true } })
  ]);
  assert(settings, "MyDreamShoots ThemeSettings must exist");
  for (const slug of canonicalPaths) {
    assert(themePages.some((page) => page.slug === slug), `ThemePage ${slug} must exist`);
    assert(livePages.some((page) => page.slug === slug), `LivePage ${slug} must exist`);
  }
  const targetThemePages = themePages.filter((page) => canonicalPaths.includes(page.slug) || aliases.includes(page.slug));
  const targetLivePages = livePages.filter((page) => canonicalPaths.includes(page.slug) || aliases.includes(page.slug));
  for (const page of targetThemePages) {
    assertClean(page, `ThemePage ${page.slug}`);
    assertClean(page.draftJson, `ThemePage ${page.slug} draftJson`);
    assertClean(page.publishedJson, `ThemePage ${page.slug} publishedJson`);
  }
  for (const page of targetLivePages) {
    assertClean(page, `LivePage ${page.slug}`);
    assertClean(page.contentJson, `LivePage ${page.slug} contentJson`);
  }
  assertClean(settings, "ThemeSettings");
  for (const theme of siteThemes) assertClean(theme, `SiteTheme ${theme.id}`);

  // LivePage.contentJson is the public source of truth. ThemePage rows are
  // retained only for editor compatibility and are checked above for drift.
  const page = (slug) => {
    const live = livePages.find((row) => row.slug === slug);
    return live ? { ...live, draftJson: live.contentJson, publishedJson: live.contentJson } : undefined;
  };
  const privacy = page("/privacy");
  const terms = page("/terms");
  const refunds = page("/refunds");
  const children = page("/children-privacy");
  const cookies = page("/cookies");
  const content = page("/content");
  const shipping = page("/shipping");
  for (const [label, row] of [["privacy", privacy], ["terms", terms], ["refunds", refunds], ["children", children], ["cookies", cookies], ["content", content], ["shipping", shipping]]) {
    assert(row?.draftJson?.seo?.canonicalPath, `${label} canonical path must be present`);
    assert.equal(row.draftJson.seo.index, true, `${label} must remain indexable`);
    assert.equal(row.draftJson.seo.follow, true, `${label} must remain followable`);
  }
  assert(policyBody(privacy.draftJson).includes("generated images and videos"), "Privacy must mention generated images and videos");
  assert(policyBody(privacy.draftJson).includes("Separate Children's Privacy and State Privacy notices"), "Privacy must use customer-facing policy notice copy");
  assert(policyBody(terms.draftJson).includes(termsUploadRule), "Terms must use the conditional minor-photo consent rule");
  assert(policyBody(terms.draftJson).includes("AI photo and video results can vary"), "Terms must cover AI video variability");
  assert(policyBody(terms.draftJson).includes("results-based refund review"), "Terms must reference results-based refund review");
  assert(policyBody(refunds.draftJson).includes("<h3>1. Results-based refund review</h3>"), "Refunds heading must be results-based");
  assert(policyBody(refunds.draftJson).includes("If the result does not look like you, contact support with the affected order and a short explanation."), "Refunds support instruction must be exact");
  assert.equal(children.title, "Children's Privacy Notice");
  assert.equal(children.draftJson.seo.title, "Children's Privacy Notice | myDreamshoots");
  assert.equal(children.draftJson.sections.intro_1.settings.body.includes("COPPA-related privacy questions"), true);
  assert.equal(children.draftJson.sections.policy_1.settings.body.includes("COPPA-related handling"), true);
  assert.equal(children.draftJson.sections.policy_1.settings.body.includes("A parent, legal guardian, or other authorized adult must manage any child-related request"), true);
  assert.equal(cookies.draftJson.sections.header_1.settings.body.includes("AI photo and video service"), true);
  assert.equal(content.draftJson.seo.title, "Content Policy for myDreamshoots Uploads and AI Photo and Video Outputs");
  assert.equal(shipping.draftJson.sections.policy_1.settings.body.includes("digital credits for AI photo and video generation, generated image packages, video outputs"), true);
  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, checkedCanonicalPages: canonicalPaths.length, checkedAliases: targetThemePages.filter((page) => aliases.includes(page.slug)).length, checkedSiteThemes: siteThemes.length }, null, 2));
} finally {
  await prisma.$disconnect();
}
