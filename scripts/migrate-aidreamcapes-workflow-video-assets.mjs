#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const SITE_ID = "site_aidreamcapes";
const PAGE_SLUG = "/workflow";
const APPLY = process.argv.includes("--apply");
const PRODUCTION_CONFIRMATION = "--confirm-production-aidreamcapes-workflow-video-assets";
const APPLY_PRODUCTION = process.argv.includes(PRODUCTION_CONFIRMATION);

const replacements = {
  "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-20260814.mp4":
    "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-55s.mp4",
  "/assets/sites/site_aidreamcapes/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-video-tutorial-20260814.mp4":
    "/assets/sites/site_aidreamcapes/homepage-showcase/videos/aidreamcapes-i2v-tutorial-55s.mp4"
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function patchVideoUrls(json) {
  const next = clone(json);
  let changed = 0;
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    for (const [key, current] of Object.entries(value)) {
      if (key === "videoUrl" && typeof current === "string" && replacements[current]) {
        value[key] = replacements[current];
        changed += 1;
      } else {
        visit(current);
      }
    }
  };
  visit(next);
  return { next, changed };
}

async function assertProductionTarget(prisma) {
  assert(APPLY, `${PRODUCTION_CONFIRMATION} requires --apply`);
  assert.equal(process.env.DINGYUE_ENV, "production", "Production migration requires DINGYUE_ENV=production");
  assert.equal(process.env.DATABASE_TARGET, "production", "Production migration requires DATABASE_TARGET=production");
  const site = await prisma.site.findUnique({
    where: { id: SITE_ID },
    select: { primaryDomain: true, domains: { select: { domain: true, status: true } } }
  });
  assert(site, `Missing site: ${SITE_ID}`);
  assert.equal(site.primaryDomain?.toLowerCase(), "www.aidreamcapes.com", "Migration target is not www.aidreamcapes.com");
  assert(site.domains.some((domain) => domain.domain.toLowerCase() === "www.aidreamcapes.com" && domain.status === "active"), "Active Aidreamcapes production domain mapping is missing");
}

async function assertAssets() {
  for (const asset of Object.values(replacements)) {
    assert(asset.startsWith("/assets/sites/site_aidreamcapes/"), `asset escaped Aidreamcapes root: ${asset}`);
    await fs.access(path.resolve(process.cwd(), `public${asset}`));
  }
}

const prisma = new PrismaClient();
try {
  await assertProductionTarget(prisma);
  await assertAssets();
  const [themePage, livePage] = await Promise.all([
    prisma.themePage.findFirst({ where: { siteId: SITE_ID, slug: PAGE_SLUG } }),
    prisma.livePage.findFirst({ where: { siteId: SITE_ID, slug: PAGE_SLUG } })
  ]);
  assert(themePage, `Missing ThemePage: ${PAGE_SLUG}`);
  assert(livePage, `Missing LivePage: ${PAGE_SLUG}`);

  const draft = patchVideoUrls(themePage.draftJson);
  const published = patchVideoUrls(themePage.publishedJson);
  const live = patchVideoUrls(livePage.contentJson);
  const changed = draft.changed + published.changed + live.changed;
  const report = { ok: true, mode: APPLY ? "apply" : "dry-run", siteId: SITE_ID, pageSlug: PAGE_SLUG, changed };

  if (APPLY) {
    const backupPath = path.join(process.cwd(), "releases/backups/aidreamcapes", `workflow-video-assets-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    await fs.mkdir(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    await fs.writeFile(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId: SITE_ID, pageSlug: PAGE_SLUG, themePage, livePage }, null, 2)}\n`, { mode: 0o600 });
    report.backupPath = backupPath;
    await prisma.$transaction(async (tx) => {
      await tx.themePage.update({ where: { id: themePage.id }, data: { draftJson: draft.next, publishedJson: published.next, updatedAt: new Date() } });
      await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: live.next, updatedAt: new Date() } });
    });
    report.readback = await prisma.livePage.findUnique({ where: { id: livePage.id }, select: { contentJson: true } }).then((row) => patchVideoUrls(row.contentJson).changed === 0);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await prisma.$disconnect();
}
