#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_dreamshoot";
const PAGE_PATH = "/ai-save-the-date/christmas";
const requirePublished = process.argv.includes("--published");

function assertQuality(section, source) {
  assert.equal(section?.type, "editorial_quality", `${source}: section type`);
  assert.equal(section?.settings?.title, "What to Check Before Sharing AI Christmas Content", `${source}: title`);
  assert.equal(section?.settings?.intro, "Review faces, hands, pets, clothing, ornaments, text, object geometry, background continuity, and any personal information.", `${source}: intro`);
  assert.equal(section?.blocks?.length, 4, `${source}: checklist count`);
  assert(section.blocks.every((block) => block.settings?.title?.trim() && block.settings?.text?.trim()), `${source}: checklist fields`);
}

const prisma = new PrismaClient();
try {
  const page = await prisma.themePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_PATH } },
    select: { id: true, draftJson: true }
  });
  assert(page, `missing_page:${PAGE_PATH}`);
  assertQuality(page.draftJson?.sections?.christmas_quality, "draft");

  let currentRevision = null;
  if (requirePublished) {
    const state = await prisma.sitePublishedState.findUnique({ where: { siteId: SITE_ID }, select: { payload: true, revision: true } });
    assert(state?.payload, "missing_current_published_state");
    const publishedPage = state.payload.pages?.find((candidate) => candidate.id === page.id);
    assert(publishedPage, "missing_christmas_page_in_current_state");
    assertQuality(publishedPage.publishedJson?.sections?.christmas_quality, "current state");
    currentRevision = state.revision;
  }

  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, pagePath: PAGE_PATH, source: requirePublished ? "draft-and-current-state" : "draft", currentRevision }, null, 2));
} finally {
  await prisma.$disconnect();
}
