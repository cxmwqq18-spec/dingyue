#!/usr/bin/env node
// End to end check: the workspace preset of one card, as the workspace resolves it.
//
//   DATABASE_URL=... node scripts/check-aidreamcapes-preset-duration.mjs <slug> [...]
//
// Prints the prompt length, the aspect, the duration and the tail of the prompt
// the workspace would prefill for that card. Read only.

import { PrismaClient } from "@prisma/client";
import { presetFromCard } from "../src/lib/aidreamcapes-workspace/presets.server.ts";

const prisma = new PrismaClient();
const slugs = process.argv.slice(2);
const record = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : undefined);

const pages = await prisma.livePage.findMany({
  where: { siteId: "site_aidreamcapes" },
  orderBy: { slug: "asc" },
  select: { slug: true, updatedAt: true, contentJson: true }
});

function cardsOf(contentJson) {
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  const found = [];
  for (const sectionId of order) {
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    const picker = record(record(data?.visual)?.picker);
    if (picker && Array.isArray(picker.cards)) found.push(...picker.cards);
    if (Array.isArray(data?.workspaceCases)) found.push(...data.workspaceCases);
    const examples = record(data?.examples);
    if (examples && Array.isArray(examples.groups)) {
      for (const group of examples.groups) {
        const items = record(group)?.items;
        if (Array.isArray(items)) found.push(...items);
      }
    }
  }
  return found;
}

for (const slug of slugs) {
  let hit;
  for (const page of pages) {
    const card = cardsOf(page.contentJson).find((value) => value?.publicSlug === slug);
    if (!card) continue;
    const preset = presetFromCard({ updatedAt: page.updatedAt }, page.slug, card);
    if (preset) hit = { page: page.slug, preset };
    break;
  }
  if (!hit) {
    console.log(`${slug}: no preset`);
    continue;
  }
  const prompt = String(hit.preset.prompt ?? "");
  console.log(JSON.stringify({
    slug,
    sourcePage: hit.page,
    aspect: hit.preset.aspect,
    duration: hit.preset.duration,
    promptLength: prompt.length,
    opensWith: prompt.slice(0, 92),
    endsWith: prompt.slice(-64),
    negativeIsLast: prompt.trimEnd().split("【").pop().startsWith("Negative】")
  }, null, 1));
}

await prisma.$disconnect();
