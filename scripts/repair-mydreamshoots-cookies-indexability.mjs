#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

assertDatabaseTarget({ expectedTarget: "local" });

const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
const siteId = "site_dreamshoot";
const slug = "/cookies";
const prisma = new PrismaClient();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function nextDraftMeta(page) {
  const revision = (page.draftMeta?.revision ?? page.draftJson?.version ?? 0) + 1;
  const updatedAt = new Date().toISOString();
  return { revision, updatedAt, etag: `W/"${revision}-${Date.parse(updatedAt).toString(36)}"` };
}

try {
  const page = await prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug } } });
  if (!page) throw new Error("mydreamshoots_cookies_page_missing");

  const draftJson = clone(page.draftJson ?? {});
  const seo = draftJson.seo ?? {};
  draftJson.seo = {
    ...seo,
    canonical: "https://www.mydreamshoots.com/cookies",
    canonicalPath: slug,
    index: true,
    follow: true,
    robots: { ...(seo.robots ?? {}), index: true, follow: true }
  };

  const contentChanged = JSON.stringify(page.draftJson) !== JSON.stringify(draftJson);
  const draftMeta = contentChanged ? nextDraftMeta(page) : page.draftMeta;
  const changed = contentChanged;
  let backupPath;
  if (apply && changed) {
    const backupRoot = path.join(process.cwd(), "releases", "backups");
    fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
    backupPath = path.join(backupRoot, `mydreamshoots-cookies-indexability-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, page }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      await tx.themePage.update({ where: { id: page.id }, data: { draftJson, draftMeta } });
      const readback = await tx.themePage.findUnique({ where: { id: page.id }, select: { draftJson: true, draftMeta: true } });
      if (readback?.draftJson?.seo?.canonical !== "https://www.mydreamshoots.com/cookies" || readback?.draftJson?.seo?.index !== true || readback?.draftMeta?.etag !== draftMeta.etag) {
        throw new Error("mydreamshoots_cookies_indexability_readback_failed");
      }
    });
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "applied" : "dry-run",
    siteId,
    pageId: page.id,
    changed,
    before: page.draftJson?.seo,
    after: draftJson.seo,
    readback: apply && changed ? { draftIndex: true, canonical: draftJson.seo.canonical, draftMeta } : null,
    backupPath
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
