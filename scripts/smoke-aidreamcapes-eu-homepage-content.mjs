#!/usr/bin/env node

// Read-only regression check for the EU homepage content contract.
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const EXPECTED_FAQ_IDS = [
  "faq_about",
  "faq_use",
  "faq_use_cases",
  "faq_free",
  "faq_plans",
  "faq_credits",
  "faq_uploads",
  "faq_couples",
  "faq_photo_generator",
  "faq_video",
  "faq_styling",
  "faq_operator",
  "faq_publishing",
  "faq_privacy",
  "faq_refunds"
];

const prisma = new PrismaClient();
try {
  const page = await prisma.livePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: "/" } },
    select: { contentJson: true }
  });
  assert.ok(page, "EU homepage LivePage is missing");

  const faq = page.contentJson?.sections?.faq_1;
  assert.ok(faq, "EU homepage FAQ section is missing");
  assert.deepEqual(
    faq.blocks?.map((block) => block?.id).slice(0, EXPECTED_FAQ_IDS.length),
    EXPECTED_FAQ_IDS,
    "EU homepage FAQ blocks are incomplete or out of order"
  );

  const imageList = String(faq.settings?.imageList ?? "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
  assert.ok(imageList.length >= 6, `EU homepage FAQ image list has only ${imageList.length} images`);
  assert.equal(faq.settings?.imageUrl, imageList[0], "FAQ cover image must match the first image-list item");

  const imageBlockCount = faq.blocks.filter((block) => typeof block?.settings?.imageUrl === "string" && block.settings.imageUrl.trim()).length;
  assert.ok(imageBlockCount >= 6, `EU homepage FAQ has only ${imageBlockCount} image-backed blocks`);
  assert.match(faq.blocks[0]?.settings?.question ?? "", /AIdreamcapes/i);
  assert.match(faq.blocks[14]?.settings?.question ?? "", /remboursement/i);

  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, faqCount: faq.blocks.length, imageCount: imageList.length, imageBlockCount }, null, 2));
} finally {
  await prisma.$disconnect();
}
