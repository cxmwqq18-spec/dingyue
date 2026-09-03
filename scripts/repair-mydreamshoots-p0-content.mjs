#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { MYDREAMSHOOTS_P0_COPY_REPLACEMENTS, MYDREAMSHOOTS_P0_COPY_SLUGS } from "./lib/mydreamshoots-p0-copy-replacements.mjs";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply") && !process.argv.includes("--dry-run");
assertDatabaseTarget({ expectedTarget: "local" });
if (apply) assertNonProductionWriteTarget();

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function replaceExactText(value, replacements, path = "") {
  if (typeof value === "string") {
    return replacements.reduce((text, replacement) => text.split(replacement.oldText).join(replacement.newText), value);
  }
  if (Array.isArray(value)) return value.map((item, index) => replaceExactText(item, replacements, `${path}/${index}`));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, replaceExactText(child, replacements, `${path}/${key}`)]));
  }
  return value;
}

function countText(value, needle) {
  if (typeof value === "string") return needle ? value.split(needle).length - 1 : 0;
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countText(item, needle), 0);
  if (value && typeof value === "object") return Object.values(value).reduce((sum, item) => sum + countText(item, needle), 0);
  return 0;
}

const replacementsBySlug = new Map();
for (const replacement of MYDREAMSHOOTS_P0_COPY_REPLACEMENTS) {
  const list = replacementsBySlug.get(replacement.slug) ?? [];
  list.push(replacement);
  replacementsBySlug.set(replacement.slug, list);
}

const prisma = new PrismaClient();
try {
  const pages = await prisma.livePage.findMany({
    where: { siteId, slug: { in: MYDREAMSHOOTS_P0_COPY_SLUGS.map((slug) => `/ai-video-generation/${slug}`).concat(["/ai-video-generation/talking-photo"]) } },
    select: { id: true, slug: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  const pageBySlug = new Map(pages.map((page) => [page.slug, page]));
  const changes = [];
  for (const slug of MYDREAMSHOOTS_P0_COPY_SLUGS) {
    const path = slug === "talking-photo" ? "/ai-video-generation/talking-photo" : `/ai-video-generation/${slug}`;
    const page = pageBySlug.get(path);
    assert(page, `Missing LivePage ${path}`);
    const replacements = replacementsBySlug.get(slug) ?? [];
    const before = clone(page.contentJson);
    const after = replaceExactText(before, replacements);
    for (const replacement of replacements) {
      const beforeCount = countText(before, replacement.oldText);
      const afterCount = countText(after, replacement.oldText);
      const newCount = countText(after, replacement.newText);
      assert.equal(afterCount, 0, `${path} still contains retired P0 copy`);
      assert.equal(newCount, 1, `${path} must contain exactly one approved replacement`);
      assert.ok(beforeCount === 0 || beforeCount === 1, `${path} has an unexpected duplicate retired phrase`);
    }
    if (JSON.stringify(before) !== JSON.stringify(after)) changes.push({ id: page.id, slug: path, contentJson: after });
  }
  if (apply && changes.length) {
    await prisma.$transaction(async (tx) => {
      for (const change of changes) {
        await tx.livePage.update({ where: { id: change.id }, data: { contentJson: change.contentJson, updatedAt: new Date() } });
      }
    });
  }
  console.log(JSON.stringify({ ok: true, mode: apply ? "apply" : "dry-run", siteId, pagesChecked: MYDREAMSHOOTS_P0_COPY_SLUGS.length, changedPages: changes.map((change) => change.slug), field: "LivePage.contentJson" }, null, 2));
} finally {
  await prisma.$disconnect();
}
