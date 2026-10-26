#!/usr/bin/env node
// Readback: compare every planned card against what the database now stores.
//
//   DATABASE_URL=... node scripts/verify-aidreamcapes-video-detail-prompts-v3.mjs
//
// It checks the prompt digest, the aspect and the duration of each planned
// card, and reports the per track length split. Read only.

import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { argumentValue } from "./lib/database-target.mjs";

const MANIFEST = argumentValue("--manifest") || "scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22-v3.json";
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const SITE_ID = manifest.siteId;
const sha = (value) => crypto.createHash("sha256").update(String(value ?? "")).digest("hex");

const prisma = new PrismaClient();
const record = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : undefined);

const pages = await prisma.livePage.findMany({
  where: { siteId: SITE_ID },
  orderBy: { slug: "asc" },
  select: { slug: true, contentJson: true }
});
const pageBySlug = new Map(pages.map((page) => [page.slug, page.contentJson]));

function readCard(contentJson, sectionId, pointer) {
  const content = record(contentJson);
  let node = record(content?.sections?.[sectionId])?.settings?.data;
  for (const step of pointer) {
    if (node === undefined || node === null) return undefined;
    node = node[step];
  }
  return node;
}

const report = {
  mode: "readback",
  site: SITE_ID,
  cards: manifest.cards.length,
  promptMatches: 0,
  promptMismatch: [],
  aspectMatches: 0,
  aspectMismatch: [],
  durationMatches: 0,
  durationMismatch: [],
  missing: []
};
const durationByTrack = {};

for (const card of manifest.cards) {
  const content = pageBySlug.get(card.ownerPage);
  const stored = content ? readCard(content, card.sectionId, card.pointer) : undefined;
  if (!stored || String(stored.publicSlug ?? "") !== card.slug) {
    report.missing.push(card.slug);
    continue;
  }
  const promptOp = card.ops.find((op) => op.field === "prompt");
  const expectedSha = promptOp ? promptOp.toSha : sha(stored.prompt);
  if (sha(stored.prompt) === expectedSha) report.promptMatches += 1;
  else report.promptMismatch.push(card.slug);

  if ((stored.aspect ?? null) === manifest.aspect) report.aspectMatches += 1;
  else report.aspectMismatch.push({ slug: card.slug, stored: stored.aspect ?? null });

  if (Number(stored.duration) === Number(card.duration)) report.durationMatches += 1;
  else report.durationMismatch.push({ slug: card.slug, stored: stored.duration ?? null, planned: card.duration });

  const key = `${card.track}@${stored.duration}s`;
  durationByTrack[key] = (durationByTrack[key] ?? 0) + 1;
}

report.durationByTrack = durationByTrack;
report.ok = !report.promptMismatch.length && !report.aspectMismatch.length && !report.durationMismatch.length && !report.missing.length;
console.log(JSON.stringify(report, null, 2));
await prisma.$disconnect();
if (!report.ok) process.exitCode = 1;
