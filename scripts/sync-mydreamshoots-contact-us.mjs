#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_dreamshoot";
const SLUG = "/contact-us";
const APPLY = process.argv.includes("--apply");

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function contactIntroBlocks() {
  return [
    {
      id: "contact_support",
      type: "rich_text_card",
      settings: {
        meta: "Support",
        title: "support@mydreamshoots.com",
        description: "Email us for account, billing, upload, privacy, AI image, AI video, Save the Date, or digital delivery questions."
      }
    },
    {
      id: "contact_company",
      type: "rich_text_card",
      settings: {
        meta: "Company",
        title: "MRNARUEBET LLC",
        description: "myDreamshoots.com is operated by MRNARUEBET LLC, a Delaware company founded by NARUEBET NAKPHONG."
      }
    },
    {
      id: "contact_address",
      type: "rich_text_card",
      settings: {
        meta: "Address",
        title: "8 THE GREEN STE B, DOVER, DE, 19901, US",
        description: "Published business correspondence address."
      }
    }
  ];
}

function contactDetailsBlocks() {
  return [
    ["contact_before_account", "01", "Account or billing", "Include the account email, order or payment reference, and the question you need answered."],
    ["contact_before_generation", "02", "Upload or generation", "Tell us which workflow you used, what happened, and whether the result is missing, delayed, or different from what you expected."],
    ["contact_before_privacy", "03", "Privacy or content", "Describe the request clearly and include the relevant page or job details. Only upload or share photos you own or are authorized to use."],
    ["contact_process_describe", "01", "Describe the issue", "Tell us the page, workflow, account area, or transaction involved."],
    ["contact_process_review", "02", "Review the details", "We review the relevant account, billing, upload, or delivery context."],
    ["contact_process_followup", "03", "Follow up by email", "We reply with the next step, a clarification, or the applicable policy path."]
  ].map(([id, meta, title, description]) => ({
    id,
    type: "rich_text_card",
    settings: { meta, title, description }
  }));
}

function updateContactPage(input) {
  const page = clone(input);
  assert(page?.sections && typeof page.sections === "object", "contact page sections are required");
  const intro = page.sections.contact_intro_1;
  const details = page.sections.contact_details_1;
  const conversion = page.sections.conversion_1;
  assert(intro?.settings && details?.settings && conversion?.settings, "contact page sections are incomplete");

  intro.settings = {
    ...intro.settings,
    eyebrow: "Contact us",
    title: "Contact myDreamshoots support.",
    body: "Need help with an account, an upload, credits, billing, privacy, or a finished result? Contact myDreamshoots and include the details below so we can understand the request and route it to the right support path.",
    headingLevel: "h1",
    tone: "dark",
    primaryCta: "Email support",
    primaryHref: "mailto:support@mydreamshoots.com"
  };
  delete intro.settings.secondaryCta;
  delete intro.settings.secondaryHref;
  intro.blocks = contactIntroBlocks();

  details.settings = {
    ...details.settings,
    eyebrow: "Before you contact us",
    title: "Include the details that help us solve the issue.",
    headingLevel: "h2",
    body: "For faster support, tell us what you were trying to do, which account email you used, and where the problem occurred. Do not send passwords, one-time codes, payment card numbers, or other sensitive secrets by email.",
    contactPageVariant: "support_guidance",
    supportProcessEyebrow: "Support process",
    supportProcessTitle: "A clear path from question to resolution.",
    supportProcessBody: "Tell us what happened, and we will use the information you provide to identify the right next step for your account or project."
  };
  delete details.settings.lastUpdated;
  delete details.settings.contactEmail;
  details.blocks = contactDetailsBlocks();

  conversion.settings = {
    ...conversion.settings,
    eyebrow: "AI IMAGE + VIDEO CREATION",
    title: "Ready to create something from your photos?",
    subtitle: "Create AI images, AI videos, personalized Save the Date videos, and themed photo packages in one private workspace.",
    primaryCta: "Start creating",
    primaryHref: "/login",
    secondaryCta: "View pricing",
    secondaryHref: "/pricing"
  };
  conversion.blocks = [
    { id: "cta_metric_credits", type: "stat", settings: { value: "200", label: "starter credits" } },
    { id: "cta_metric_styles", type: "stat", settings: { value: "15+", label: "live scene packs" } },
    { id: "cta_metric_private", type: "stat", settings: { value: "Private", label: "uploads and albums" } }
  ];

  return page;
}

assertDatabaseTarget({ expectedTarget: "local" });
const prisma = new PrismaClient();
const backupDir = path.join(process.cwd(), "releases", "backups", "local");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = path.join(backupDir, `mydreamshoots-contact-us-${runId}.json`);

try {
  const [themePage, livePage, document] = await Promise.all([
    prisma.themePage.findUnique({
      where: { siteId_slug: { siteId: SITE_ID, slug: SLUG } },
      select: { id: true, siteId: true, slug: true, title: true, draftJson: true, publishedJson: true }
    }),
    prisma.livePage.findUnique({
      where: { siteId_slug: { siteId: SITE_ID, slug: SLUG } },
      select: { id: true, siteId: true, slug: true, title: true, contentJson: true }
    }),
    prisma.platformStateDocument.findUnique({ where: { id: "platform" }, select: { state: true } })
  ]);
  assert(themePage, `ThemePage missing: ${SITE_ID}${SLUG}`);
  assert(livePage, `LivePage missing: ${SITE_ID}${SLUG}`);
  assert(document?.state && typeof document.state === "object", "platform state document is required");

  const draftJson = updateContactPage(themePage.draftJson);
  const publishedJson = updateContactPage(themePage.publishedJson);
  const liveJson = updateContactPage(livePage.contentJson);
  const state = clone(document.state);
  const stateSite = (state.sites ?? []).find((site) => site.id === SITE_ID);
  assert(stateSite, `platform state site missing: ${SITE_ID}`);
  const statePage = (stateSite.pages ?? []).find((page) => page.id === themePage.id || page.slug === SLUG);
  assert(statePage, `platform state page missing: ${SITE_ID}${SLUG}`);
  statePage.draftJson = clone(draftJson);
  statePage.publishedJson = clone(publishedJson);

  const changed = JSON.stringify(stable({ draftJson, publishedJson, liveJson })) !== JSON.stringify(stable({ draftJson: themePage.draftJson, publishedJson: themePage.publishedJson, liveJson: livePage.contentJson }));
  const report = {
    ok: true,
    mode: APPLY ? "apply" : "dry-run",
    siteId: SITE_ID,
    slug: SLUG,
    changed,
    backupPath: null
  };

  if (APPLY && changed) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, slug: SLUG, themePage, livePage }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      await tx.themePage.update({ where: { id: themePage.id }, data: { draftJson, publishedJson } });
      await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: liveJson } });
      await tx.platformStateDocument.update({ where: { id: "platform" }, data: { state } });
    }, { timeout: 120_000 });

    const [themeReadback, liveReadback, stateReadback] = await Promise.all([
      prisma.themePage.findUnique({ where: { id: themePage.id }, select: { draftJson: true, publishedJson: true } }),
      prisma.livePage.findUnique({ where: { id: livePage.id }, select: { contentJson: true } }),
      prisma.platformStateDocument.findUnique({ where: { id: "platform" }, select: { state: true } })
    ]);
    assert.deepEqual(themeReadback?.draftJson, draftJson, "ThemePage draft readback mismatch");
    assert.deepEqual(themeReadback?.publishedJson, publishedJson, "ThemePage published readback mismatch");
    assert.deepEqual(liveReadback?.contentJson, liveJson, "LivePage readback mismatch");
    const stateReadbackPage = (stateReadback?.state?.sites ?? []).find((site) => site.id === SITE_ID)?.pages?.find((page) => page.id === themePage.id || page.slug === SLUG);
    assert.deepEqual(stateReadbackPage?.draftJson, draftJson, "platform draft readback mismatch");
    assert.deepEqual(stateReadbackPage?.publishedJson, publishedJson, "platform published readback mismatch");
    report.backupPath = backupPath;
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
