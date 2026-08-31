#!/usr/bin/env node
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply") && !hasArgument("--dry-run");
const productionConfirmed = hasArgument("--confirm-production") && argumentValue("--confirm") === "mydreamshoots-production-alt";
const replacements = new Map([
  ["Prompt-directed photo edit preview.", "AI photo editing preview."],
  ["Woman holding a food bowl for a tabby cat in a home setting, used as a feeding-routine visual reference without nutrition claims.", "Person feeding a tabby cat at home."]
]);
const pagePaths = ["/ai-image-generation", "/best-ai-image", "/ai-video-generation/pet-video"];

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed
});

function replaceExactAltValues(value, changes, inAltField = false) {
  if (Array.isArray(value)) return value.map((item) => replaceExactAltValues(item, changes, inAltField));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    const altField = inAltField || /alt/i.test(key);
    if (altField && typeof item === "string" && replacements.has(item)) {
      changes.push({ field: key, before: item, after: replacements.get(item) });
      return [key, replacements.get(item)];
    }
    return [key, replaceExactAltValues(item, changes, altField)];
  }));
}

const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({
    where: { siteId, slug: { in: pagePaths } },
    select: { id: true, slug: true, draftJson: true, publishedJson: true }
  });
  assert.equal(pages.length, pagePaths.length, "all affected MyDreamShoots pages must exist before media-alt repair");

  const updates = pages.map((page) => {
    const draftChanges = [];
    const publishedChanges = [];
    const draftJson = replaceExactAltValues(structuredClone(page.draftJson), draftChanges);
    const publishedJson = replaceExactAltValues(structuredClone(page.publishedJson), publishedChanges);
    return { ...page, draftJson, publishedJson, changes: [...draftChanges, ...publishedChanges] };
  });
  const remaining = updates.flatMap((page) => JSON.stringify({ draftJson: page.draftJson, publishedJson: page.publishedJson }).match(/Prompt-directed photo edit preview\.|feeding-routine visual reference/gi) ?? []);
  assert.equal(remaining.length, 0, "the targeted production-direction alt values must be absent after repair");

  if (apply) {
    await prisma.$transaction(async (tx) => {
      for (const page of updates.filter((page) => page.changes.length)) {
        await tx.themePage.update({ where: { id: page.id }, data: { draftJson: page.draftJson, publishedJson: page.publishedJson } });
      }
    });
  }

  console.log(JSON.stringify({
    ok: true,
    mode: apply ? "applied" : "dry-run",
    target,
    siteId,
    pages: updates.map((page) => ({ slug: page.slug, changes: page.changes }))
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
