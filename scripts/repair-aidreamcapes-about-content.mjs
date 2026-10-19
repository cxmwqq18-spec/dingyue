#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { buildSiteV2 } from "./lib/aidreamcapes-site-v2-content.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_ID = "site_aidreamcapes_about_us";
const PAGE_PATH = "/about-us";
const ACCOUNTABILITY_H2 = "Who Is Accountable for AIVideosUGC";
const ACCOUNTABILITY_BEFORE = [
  "AIVideosUGC is operated by BLYDEY INC. NARUEBET NAKPHONG is the company's legal representative.",
  "We want shop owners to know which company operates the service and where to reach us when they need help. For account, billing, or export questions, contact support@aivideosugc.com."
];
const ADDED_SECTION_HEADINGS = new Set([
  "The Team Behind AIVideosUGC",
  "Company Background and Contact Details",
  "A Workspace for Product Work, Wherever You Are",
  "From Product Details to a Reviewed Result"
]);
const ADDED_FAQ_QUESTIONS = new Set([
  "Do I need to book a studio to prepare product content?",
  "Who is AIVideosUGC designed for?"
]);
const CONFIRMATION = "site_aidreamcapes-about-content";
const target = argumentValue("--target") ?? "local";
const apply = hasArgument("--apply");

assert(["local", "production"].includes(target), `Unsupported target: ${target}`);
if (target === "production") {
  const confirmed = argumentValue("--confirm") === CONFIRMATION;
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: confirmed });
  if (apply) assert(confirmed, `Use --confirm=${CONFIRMATION}.`);
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function aboutDataFrom(contentJson) {
  const sections = contentJson?.sections;
  assert(sections && typeof sections === "object", "About LivePage has no sections object.");
  const main = sections.v2_main;
  assert(main?.type === "aidreamcapes_v2_page" && main?.settings?.layout === "about", "About LivePage is not the expected current Aidreamcapes page.");
  const data = main.settings.data;
  assert(data && typeof data === "object", "About LivePage has no page data.");
  return data;
}

function withoutAboutSectionsAndFaq(contentJson) {
  const copy = structuredClone(contentJson);
  const data = aboutDataFrom(copy);
  delete data.sections;
  delete data.faq;
  return copy;
}

const payloadPath = argumentValue("--payload");
let generatedAccountability;
let addedSections;
let addedFaqs;
if (payloadPath) {
  const payload = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), payloadPath), "utf8"));
  generatedAccountability = payload.accountabilitySection;
  addedSections = payload.addedSections;
  addedFaqs = payload.addedFaqs ?? (payload.addedFaq ? [payload.addedFaq] : []);
} else {
  const generatedPage = buildSiteV2().pages.find((page) => page.slug === PAGE_PATH);
  assert(generatedPage?.contentJson, "Aidreamcapes source builder did not produce the About page.");
  const generatedData = aboutDataFrom(generatedPage.contentJson);
  const generatedSections = generatedData.sections;
  assert(Array.isArray(generatedSections), "Aidreamcapes About source has no prose sections.");
  const sectionByHeading = new Map(generatedSections.map((section) => [section.h2, section]));
  addedSections = [...ADDED_SECTION_HEADINGS].map((heading) => {
    const section = sectionByHeading.get(heading);
    assert(section, `Missing reviewed About section in source: ${heading}`);
    return structuredClone(section);
  });
  generatedAccountability = sectionByHeading.get(ACCOUNTABILITY_H2);
  addedFaqs = generatedData.faq?.filter((item) => ADDED_FAQ_QUESTIONS.has(item.q));
}
assert(generatedAccountability, "Missing reviewed About accountability section.");
assert(Array.isArray(addedSections) && addedSections.length === ADDED_SECTION_HEADINGS.size, "About payload has the wrong number of new sections.");
for (const section of addedSections) assert(ADDED_SECTION_HEADINGS.has(section?.h2), `Unexpected About section in payload: ${section?.h2}`);
assert(Array.isArray(addedFaqs) && addedFaqs.length === ADDED_FAQ_QUESTIONS.size, "About payload has the wrong number of new FAQs.");
for (const faq of addedFaqs) assert(ADDED_FAQ_QUESTIONS.has(faq?.q), `Unexpected About FAQ in payload: ${faq?.q}`);

const db = new PrismaClient();
try {
  const page = await db.livePage.findUnique({
    where: { id: PAGE_ID },
    select: { id: true, siteId: true, slug: true, title: true, updatedAt: true, contentJson: true }
  });
  assert(page && page.siteId === SITE_ID && page.slug === PAGE_PATH, "Aidreamcapes About LivePage was not found.");

  const beforeData = aboutDataFrom(page.contentJson);
  const beforeSections = beforeData.sections;
  const beforeFaq = beforeData.faq;
  assert(Array.isArray(beforeSections) && Array.isArray(beforeFaq), "About LivePage sections or FAQ are missing.");
  const nextContent = structuredClone(page.contentJson);
  const nextData = aboutDataFrom(nextContent);

  const accountabilityIndex = beforeSections.findIndex((section) => section.h2 === ACCOUNTABILITY_H2);
  assert(accountabilityIndex >= 0, "About LivePage accountability section was not found.");
  const currentAccountability = beforeSections[accountabilityIndex];
  assert(
    JSON.stringify(currentAccountability.paras) === JSON.stringify(ACCOUNTABILITY_BEFORE)
      || JSON.stringify(currentAccountability.paras) === JSON.stringify(generatedAccountability.paras),
    "About accountability copy differs from the reviewed value; refusing to overwrite a newer edit."
  );
  const nextSections = [...beforeSections];
  nextSections[accountabilityIndex] = structuredClone(generatedAccountability);
  for (const section of addedSections) {
    const existing = nextSections.find((candidate) => candidate.h2 === section.h2);
    if (existing) {
      assert.deepEqual(existing, section, `About section ${section.h2} already exists with different content; refusing to overwrite it.`);
    } else {
      nextSections.push(section);
    }
  }

  const nextFaq = [...beforeFaq];
  for (const faq of addedFaqs) {
    const existing = nextFaq.find((item) => item.q === faq.q);
    if (existing) assert.deepEqual(existing, faq, `About FAQ ${faq.q} already exists with different content; refusing to overwrite it.`);
    else nextFaq.push(structuredClone(faq));
  }
  nextData.sections = nextSections;
  nextData.faq = nextFaq;

  const nonTargetHash = hash(withoutAboutSectionsAndFaq(page.contentJson));
  assert.equal(hash(withoutAboutSectionsAndFaq(nextContent)), nonTargetHash, "A non-target About LivePage field changed.");
  const result = {
    target,
    siteId: SITE_ID,
    owner: `LivePage:${PAGE_ID}`,
    publicPath: PAGE_PATH,
    targetFields: ["contentJson.sections.v2_main.settings.data.sections", "contentJson.sections.v2_main.settings.data.faq"],
    sectionCountBefore: beforeSections.length,
    sectionCountAfter: nextSections.length,
    faqCountBefore: beforeFaq.length,
    faqCountAfter: nextFaq.length,
    addedHeadings: [...ADDED_SECTION_HEADINGS],
    addedFaqs: [...ADDED_FAQ_QUESTIONS],
    baseUpdatedAt: page.updatedAt,
    nonTargetContentHash: nonTargetHash,
    mode: apply ? "apply" : "plan-only"
  };
  console.log(JSON.stringify(result, null, 2));

  const alreadyCurrent = JSON.stringify(beforeSections) === JSON.stringify(nextSections)
    && JSON.stringify(beforeFaq) === JSON.stringify(nextFaq);
  if (apply && !alreadyCurrent) {
    const updated = await db.livePage.updateMany({
      where: { id: PAGE_ID, siteId: SITE_ID, slug: PAGE_PATH, updatedAt: page.updatedAt },
      data: { contentJson: nextContent }
    });
    assert.equal(updated.count, 1, "About LivePage changed concurrently; no update was applied.");
  }
  if (apply) {
    const readback = await db.livePage.findUnique({
      where: { id: PAGE_ID },
      select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
    });
    const readbackData = aboutDataFrom(readback.contentJson);
    assert.deepEqual(readbackData.sections, nextSections, "About section readback failed.");
    assert.deepEqual(readbackData.faq, nextFaq, "About FAQ readback failed.");
    assert.equal(hash(withoutAboutSectionsAndFaq(readback.contentJson)), nonTargetHash, "A non-target About field changed.");
    console.log(JSON.stringify({
      result: alreadyCurrent ? "already-current-and-read-back" : "applied-and-read-back",
      siteId: readback.siteId,
      livePageId: readback.id,
      publicPath: readback.slug,
      updatedAt: readback.updatedAt,
      sectionCount: readbackData.sections.length,
      faqCount: readbackData.faq.length,
      nonTargetContentUnchanged: true
    }, null, 2));
  }
} finally {
  await db.$disconnect();
}
