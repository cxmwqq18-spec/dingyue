#!/usr/bin/env node
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const wanted = [
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day",
  "/ai-save-the-date/halloween",
];
const image = (settings) => settings?.imageUrl || settings?.image?.src || settings?.src;
const title = (settings) => settings?.title || settings?.heading || settings?.name || settings?.question || "";
const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({ where: { siteId, pageType: "standard-content" }, orderBy: { slug: "asc" }, select: { slug: true, pageType: true, publishedJson: true, draftJson: true } });
  for (const page of pages) {
    const json = page.publishedJson || page.draftJson || {};
    const sections = json.sections || {};
    const rows = [];
    for (const [id, section] of Object.entries(sections)) {
      const blocks = Array.isArray(section?.blocks) ? section.blocks : [];
      const blockImageCount = blocks.filter((b) => image(b?.settings)).length;
      const missingBlocks = blocks.filter((b) => !image(b?.settings)).map((b) => title(b?.settings)).filter(Boolean);
      rows.push({ id, type: section?.type, title: title(section?.settings), blocks: blocks.length, sectionImage: Boolean(image(section?.settings)), blockImages: blockImageCount, missingBlocks });
    }
    console.log(JSON.stringify({ slug: page.slug, pageType: page.pageType, manifest: Array.isArray(json.mediaManifest) ? json.mediaManifest.length : 0, sectionsOrder: json.sectionsOrder || [], sections: rows }, null, 2));
  }
  if (pages.length !== wanted.length) console.error(JSON.stringify({ missingPages: wanted.filter((path) => !pages.some((p) => p.slug === path)) }));
} finally { await prisma.$disconnect(); }
