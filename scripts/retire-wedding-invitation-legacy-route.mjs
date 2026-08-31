#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const retiredPath = "/holidays-events/wedding-invitation";
const legacySaveTheDatePath = "/ai-save-the-date/wedding-invitation";
const apply = process.argv.includes("--apply");

assertDatabaseTarget({ expectedTarget: "local" });

const prisma = new PrismaClient();
try {
  const [page, settings] = await Promise.all([
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug: retiredPath } }, select: { id: true, slug: true } }),
    prisma.themeSettings.findUnique({ where: { siteId }, select: { draftJson: true, publishedJson: true } })
  ]);
  assert(page, `${retiredPath}: legacy page is already absent`);
  assert(settings, `${siteId}: missing theme settings`);

  const withoutRetiredNavigation = (source) => {
    const json = structuredClone(source ?? {});
    for (const group of json.saveTheDateNavigation?.groups ?? []) {
      group.items = (group.items ?? []).filter((item) => item.href !== retiredPath && item.href !== legacySaveTheDatePath);
    }
    return json;
  };
  const draftJson = withoutRetiredNavigation(settings.draftJson);
  const publishedJson = withoutRetiredNavigation(settings.publishedJson);

  if (apply) {
    await prisma.$transaction(async (tx) => {
      await tx.themePage.delete({ where: { id: page.id } });
      await tx.themeSettings.update({ where: { siteId }, data: { draftJson, publishedJson } });
    });
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "applied" : "dry-run",
    siteId,
    retiredPageId: page.id,
    retiredPath,
    removedNavigationPaths: [retiredPath, legacySaveTheDatePath]
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
