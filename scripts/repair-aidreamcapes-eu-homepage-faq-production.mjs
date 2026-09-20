#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const HOME_SLUG = "/";
const CONFIRMATION = "aidreamcapes-eu-homepage-faq-production";
const FAQ_IMAGE_BLOCK_IDS = ["faq_about", "faq_uploads", "faq_couples", "faq_photo_generator", "faq_video", "faq_styling"];
const NO_CROP_PREFIX = "/assets/sites/site_aidreamcapes_eu/restored/originals/aidreamcapes-eu-no-crop-v1/";
const apply = process.argv.includes("--apply");

assertDatabaseTarget({
  expectedTarget: "production",
  requireProductionConfirmation: apply,
  productionConfirmed: hasArgument(`--confirm=${CONFIRMATION}`)
});
if (apply) assert.equal(String(process.argv.find((arg) => arg.startsWith("--confirm=")) ?? ""), `--confirm=${CONFIRMATION}`);

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function faqRepair(json, label) {
  assert.ok(json && typeof json === "object", `${label} JSON is missing`);
  const faq = json.sections?.faq_1;
  assert.ok(faq && typeof faq === "object", `${label} FAQ section is missing`);
  const blocksById = new Map((faq.blocks ?? []).filter((block) => block?.id).map((block) => [block.id, block]));
  const imageBlocks = FAQ_IMAGE_BLOCK_IDS.map((id) => blocksById.get(id));
  assert.ok(imageBlocks.every(Boolean), `${label} FAQ image blocks are incomplete`);
  const imageUrls = imageBlocks.map((block) => String(block.settings?.imageUrl ?? "").trim());
  const imageAlts = imageBlocks.map((block) => String(block.settings?.imageAlt ?? "").trim());
  assert.ok(imageUrls.every((value) => value.startsWith(NO_CROP_PREFIX)), `${label} FAQ image blocks must use no-crop assets`);
  assert.ok(imageAlts.every(Boolean), `${label} FAQ image block alt text is incomplete`);
  return {
    ...json,
    sections: {
      ...json.sections,
      faq_1: {
        ...faq,
        settings: {
          ...(faq.settings ?? {}),
          imageUrl: imageUrls[0],
          imageList: imageUrls.join("|"),
          imageListAlt: imageAlts.join("|")
        }
      }
    }
  };
}

const prisma = new PrismaClient();
try {
  const [livePage, themePage] = await Promise.all([
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: HOME_SLUG } } }),
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: HOME_SLUG } } })
  ]);
  assert.ok(livePage, "Aidreamcapes EU LivePage homepage is missing");
  assert.ok(themePage, "Aidreamcapes EU ThemePage homepage is missing");

  const nextLive = faqRepair(clone(livePage.contentJson), "LivePage");
  const nextDraft = faqRepair(clone(themePage.draftJson), "ThemePage draft");
  const nextPublished = faqRepair(clone(themePage.publishedJson), "ThemePage published");
  const currentCount = String(livePage.contentJson?.sections?.faq_1?.settings?.imageList ?? "").split("|").filter(Boolean).length;
  const report = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    siteId: SITE_ID,
    pageSlug: HOME_SLUG,
    previousImageCount: currentCount,
    nextImageCount: 6,
    changedLivePage: JSON.stringify(livePage.contentJson) !== JSON.stringify(nextLive),
    changedThemePage: JSON.stringify(themePage.draftJson) !== JSON.stringify(nextDraft) || JSON.stringify(themePage.publishedJson) !== JSON.stringify(nextPublished),
    backup: null
  };

  if (apply) {
    const backupPath = path.resolve(".tmp", "aidreamcapes-eu-homepage-faq-production", `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(backupPath, {
      livePage: { id: livePage.id, contentJson: livePage.contentJson },
      themePage: { id: themePage.id, draftJson: themePage.draftJson, publishedJson: themePage.publishedJson }
    });
    report.backup = backupPath;
    await prisma.$transaction(async (tx) => {
      await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: nextLive } });
      await tx.themePage.update({ where: { id: themePage.id }, data: { draftJson: nextDraft, publishedJson: nextPublished } });
    });
  }

  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
