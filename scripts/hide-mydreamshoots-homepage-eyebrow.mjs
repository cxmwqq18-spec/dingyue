#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
assertDatabaseTarget({ expectedTarget: "local" });
if (apply) assertNonProductionWriteTarget();

function clone(value) {
  return structuredClone(value ?? {});
}

function hideEyebrow(json, label) {
  const next = clone(json);
  const section = next.sections?.tutorial_video_1;
  assert.equal(section?.type, "video_feature", `${label} homepage tutorial section must be video_feature`);
  assert(section.settings && typeof section.settings === "object", `${label} homepage tutorial settings are required`);
  section.settings.showEyebrow = false;
  return next;
}

const prisma = new PrismaClient();
try {
  const [themePage, livePage] = await Promise.all([
    prisma.themePage.findUnique({
      where: { siteId_slug: { siteId, slug: "/" } },
      select: { id: true, draftJson: true, publishedJson: true }
    }),
    prisma.livePage.findUnique({
      where: { siteId_slug: { siteId, slug: "/" } },
      select: { id: true, contentJson: true }
    })
  ]);
  assert(themePage, "MyDreamShoots homepage ThemePage is required");
  assert(livePage, "MyDreamShoots homepage LivePage is required");

  const nextDraft = hideEyebrow(themePage.draftJson, "ThemePage draft");
  const nextPublished = hideEyebrow(themePage.publishedJson, "ThemePage published");
  const nextLive = hideEyebrow(livePage.contentJson, "LivePage");
  const changed = JSON.stringify(nextDraft) !== JSON.stringify(themePage.draftJson)
    || JSON.stringify(nextPublished) !== JSON.stringify(themePage.publishedJson)
    || JSON.stringify(nextLive) !== JSON.stringify(livePage.contentJson);
  const backupPath = path.join(process.cwd(), "releases", "backups", "local", `mydreamshoots-homepage-eyebrow-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);

  if (apply && changed) {
    fs.mkdirSync(path.dirname(backupPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, themePage, livePage }, null, 2)}\n`, { mode: 0o600 });
    await prisma.$transaction(async (tx) => {
      await tx.themePage.update({ where: { id: themePage.id }, data: { draftJson: nextDraft, publishedJson: nextPublished, updatedAt: new Date() } });
      await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: nextLive, updatedAt: new Date() } });
    });
  }

  const readback = await Promise.all([
    prisma.themePage.findUnique({ where: { id: themePage.id }, select: { draftJson: true, publishedJson: true } }),
    prisma.livePage.findUnique({ where: { id: livePage.id }, select: { contentJson: true } })
  ]);
  if (apply) {
    assert.equal(readback[0]?.draftJson?.sections?.tutorial_video_1?.settings?.showEyebrow, false, "ThemePage draft readback must hide the homepage eyebrow");
    assert.equal(readback[0]?.publishedJson?.sections?.tutorial_video_1?.settings?.showEyebrow, false, "ThemePage published readback must hide the homepage eyebrow");
    assert.equal(readback[1]?.contentJson?.sections?.tutorial_video_1?.settings?.showEyebrow, false, "LivePage readback must hide the homepage eyebrow");
  }
  console.log(JSON.stringify({ ok: true, mode: apply ? "apply" : "dry-run", siteId, changed, field: "sections.tutorial_video_1.settings.showEyebrow", value: false, backupPath: apply && changed ? backupPath : null }, null, 2));
} finally {
  await prisma.$disconnect();
}
