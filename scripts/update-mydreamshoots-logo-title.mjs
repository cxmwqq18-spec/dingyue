#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const target = String(argumentValue("--target") || process.env.DATABASE_TARGET || "").trim().toLowerCase();
const apply = hasArgument("--apply");
const title = "Empowering creators worldwide";
assert(["local", "remote", "production"].includes(target), "--target=local|remote|production is required");
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "remote" || target === "production",
  productionConfirmed: hasArgument("--confirm-production")
});
if (apply && !hasArgument("--confirm=update-mydreamshoots-logo-title")) {
  throw new Error("--apply requires --confirm=update-mydreamshoots-logo-title");
}

const siteId = "site_dreamshoot";
const repoRoot = process.cwd();
const backupDir = path.join(repoRoot, "releases", "backups");
const clone = (value) => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
function updateJson(value) {
  const next = clone(value) ?? {};
  next.sections ??= {};
  const section = next.sections.generation_showcase_1;
  assert(section && typeof section === "object", "homepage generation_showcase_1 is required");
  section.settings = { ...(section.settings ?? {}), trustedLogoTitle: title };
  return next;
}

const prisma = new PrismaClient();
try {
  const page = await prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug: "/" } }, select: { id: true, slug: true, draftJson: true, publishedJson: true } });
  assert(page, "MyDreamShoots homepage is required");
  const nextDraft = updateJson(page.draftJson);
  const nextPublished = updateJson(page.publishedJson);
  const changed = JSON.stringify(nextDraft) !== JSON.stringify(page.draftJson) || JSON.stringify(nextPublished) !== JSON.stringify(page.publishedJson);
  const result = { ok: true, target, mode: apply ? "apply" : "dry-run", siteId, pageId: page.id, title, changed };
  if (apply && changed) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backupPath = path.join(backupDir, `mydreamshoots-logo-title-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    fs.writeFileSync(backupPath, `${JSON.stringify({ createdAt: new Date().toISOString(), siteId, pageId: page.id, draftJson: page.draftJson, publishedJson: page.publishedJson }, null, 2)}\n`, { mode: 0o600 });
    await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: nextDraft, publishedJson: nextPublished, updatedAt: new Date() } });
    result.backupPath = backupPath;
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  await prisma.$disconnect();
}
