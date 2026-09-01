#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertAllowedSite, assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite(process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot");
assertDatabaseTarget({ expectedTarget: "local" });

const SLUGS = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/easter",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day"
];

const clone = (value) => JSON.parse(JSON.stringify(value));

const prisma = new PrismaClient();
try {
  const [themePages, livePages] = await Promise.all([
    prisma.themePage.findMany({
      where: { siteId: SITE_ID, slug: { in: SLUGS } },
      select: { id: true, slug: true, pageType: true, templateKey: true, title: true, draftJson: true, publishedJson: true }
    }),
    prisma.livePage.findMany({
      where: { siteId: SITE_ID, slug: { in: SLUGS } },
      select: { id: true, slug: true }
    })
  ]);
  assert.equal(themePages.length, SLUGS.length, "expected Save the Date theme pages missing");

  const liveBySlug = new Map(livePages.map((page) => [page.slug, page]));
  const pageWrites = themePages.map((page) => ({
    slug: page.slug,
    id: liveBySlug.get(page.slug)?.id || `live_${SITE_ID}_${page.slug.slice(1).replace(/[^a-z0-9]+/gi, "_")}`,
    pageType: page.pageType,
    templateKey: page.templateKey,
    title: page.title,
    contentJson: clone(page.publishedJson || page.draftJson)
  }));

  await prisma.$transaction(async (tx) => {
    for (const page of pageWrites) {
      await tx.livePage.upsert({
        where: { siteId_slug: { siteId: SITE_ID, slug: page.slug } },
        create: {
          id: page.id,
          siteId: SITE_ID,
          pageType: page.pageType,
          templateKey: page.templateKey,
          slug: page.slug,
          title: page.title,
          contentJson: page.contentJson
        },
        update: {
          pageType: page.pageType,
          templateKey: page.templateKey,
          title: page.title,
          contentJson: page.contentJson
        }
      });
    }
  });

  console.log(JSON.stringify({ ok: true, siteId: SITE_ID, livePages: pageWrites.length }, null, 2));
} finally {
  await prisma.$disconnect();
}
