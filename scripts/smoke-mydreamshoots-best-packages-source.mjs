#!/usr/bin/env node
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const expectedTarget = String(process.env.DATABASE_TARGET || "local").trim().toLowerCase() === "remote-readonly" ? "remote-readonly" : "local";
assertDatabaseTarget({ expectedTarget });

const prisma = new PrismaClient();
try {
  const site = await prisma.site.findUnique({
    where: { id: "site_dreamshoot" },
    include: { pages: { where: { slug: "/best-packages" } } }
  });
  const page = site?.pages?.[0];
  assert.ok(page, "MyDreamShoots /best-packages source page is required");
  const blocks = Object.values(page.draftJson?.sections ?? {}).flatMap((section) => Array.isArray(section.blocks) ? section.blocks : []);
  const worldCup = blocks.filter((block) => /^seasonal_worldcup_[1-6]$/.test(block.id));
  assert.equal(worldCup.length, 6, "all six World Cup source cards must exist");
  assert.ok(worldCup.every((block) => block.settings?.collectionSlug === "soccer"), "all World Cup source cards must target soccer");
  console.log(JSON.stringify({ ok: true, source: expectedTarget, worldCupCards: worldCup.length, collectionSlug: "soccer" }, null, 2));
} finally {
  await prisma.$disconnect();
}
