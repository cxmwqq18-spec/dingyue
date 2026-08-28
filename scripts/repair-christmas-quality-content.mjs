#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = process.env.SITE_ID || "site_dreamshoot";
const PAGE_PATH = "/ai-save-the-date/christmas";
const APPLY = process.argv.includes("--apply");
const TARGET = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase();

assertDatabaseTarget({ expectedTarget: TARGET, env: process.env });

const QUALITY_BLOCKS = [
  {
    id: "christmas_quality_people",
    type: "item",
    settings: {
      title: "Review people and objects",
      text: "Review people and objects — check faces, hands, pets, decorations, gift shapes, clothing, and scene continuity."
    }
  },
  {
    id: "christmas_quality_details",
    type: "item",
    settings: {
      title: "What should I check before sharing AI Christmas content?",
      text: "Review faces, hands, pets, clothing, ornaments, text, object geometry, background continuity, and any personal information."
    }
  },
  {
    id: "christmas_quality_text",
    type: "item",
    settings: {
      title: "Keep important text editable",
      text: "Keep important text editable — names, dates, personal greetings, event details, and URLs should not depend on AI-generated image text."
    }
  },
  {
    id: "christmas_quality_crop",
    type: "item",
    settings: {
      title: "Prepare the final crop",
      text: "Prepare the final crop — keep enough safe space for desktop, mobile, social, card, or video output needs."
    }
  }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)]))
    : value;
const same = (left, right) => JSON.stringify(stable(left)) === JSON.stringify(stable(right));

const prisma = new PrismaClient();
try {
  const page = await prisma.themePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_PATH } },
    select: { id: true, slug: true, draftJson: true, publishedJson: true }
  });
  assert(page, `missing_page:${PAGE_PATH}`);

  const nextDraft = clone(page.draftJson);
  const section = nextDraft.sections?.christmas_quality;
  assert(section?.type === "editorial_quality", "unexpected_christmas_quality_section");
  assert.equal(section.settings?.title, "What to Check Before Sharing AI Christmas Content", "unexpected_christmas_quality_title");

  const before = { intro: section.settings?.intro || "", blocks: section.blocks || [] };
  const alreadyRepaired = same(before.blocks, QUALITY_BLOCKS)
    && before.intro === "Review faces, hands, pets, clothing, ornaments, text, object geometry, background continuity, and any personal information.";
  const previousRepair = before.blocks.length === 4
    && before.blocks.every((block) => block.type === "item");
  const safelyEmpty = before.intro === "" && Array.isArray(before.blocks) && before.blocks.length === 0;
  assert(safelyEmpty || previousRepair || alreadyRepaired, "christmas_quality_has_unexpected_content");

  section.settings.intro = "Review faces, hands, pets, clothing, ornaments, text, object geometry, background continuity, and any personal information.";
  section.blocks = QUALITY_BLOCKS;

  if (APPLY && !alreadyRepaired) {
    await prisma.themePage.update({
      where: { id: page.id },
      data: { draftJson: nextDraft, updatedAt: new Date() }
    });
  }

  console.log(JSON.stringify({
    ok: true,
    siteId: SITE_ID,
    pagePath: PAGE_PATH,
    mode: APPLY ? "draft-repair" : "dry-run",
    changed: !alreadyRepaired,
    publishedJsonChanged: false,
    intro: section.settings.intro,
    blocks: section.blocks.map((block) => block.settings.title),
    publicationRequired: true
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
