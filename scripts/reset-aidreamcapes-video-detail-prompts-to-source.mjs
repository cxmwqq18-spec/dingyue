#!/usr/bin/env node
// Restore the AIVideosUGC video detail cards to the frozen source copy.
//
// This is the field level inverse of the prompt rewrite. It exists so a local
// database can be put back into the published state before the rewrite is
// planned and applied again, and so the compare-and-set values in the plan
// describe the state the storefront is actually published in.
//
// The tool never runs against production: assertNonProductionWriteTarget
// refuses a production or remote target. It writes only the prompt, aspect
// and duration fields of the cards named in the frozen source.
//
// Usage:
//   DATABASE_URL=... DATABASE_TARGET=local DINGYUE_ENV=local \
//     node scripts/reset-aidreamcapes-video-detail-prompts-to-source.mjs --apply

import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import { argumentValue, hasArgument, assertAllowedSite, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const SOURCE = argumentValue("--source") || "scripts/manifests/aidreamcapes-video-detail-prompts-source-2026-10-22.json";
const APPLY = hasArgument("--apply");
const ONLY = (argumentValue("--only") || "").split(",").map((value) => value.trim()).filter(Boolean);

assertAllowedSite(SITE_ID);
if (APPLY) assertNonProductionWriteTarget(process.env);

const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
if (source.siteId !== SITE_ID) throw new Error(`Source site ${source.siteId} is not ${SITE_ID}.`);

const prisma = new PrismaClient();
const record = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : undefined);

function cardLocations(contentJson) {
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  const found = [];
  for (const sectionId of order) {
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    const push = (card, pointer) => { if (card && typeof card === "object" && !Array.isArray(card)) found.push({ card, sectionId, pointer }); };
    const definition = record(data?.templateDefinition);
    if (record(definition?.card)) push(definition.card, ["templateDefinition", "card"]);
    const picker = record(record(data?.visual)?.picker);
    if (picker && Array.isArray(picker.cards)) picker.cards.forEach((card, index) => push(card, ["visual", "picker", "cards", index]));
    if (Array.isArray(data?.workspaceCases)) data.workspaceCases.forEach((card, index) => push(card, ["workspaceCases", index]));
    const examples = record(data?.examples);
    if (examples && Array.isArray(examples.groups)) {
      examples.groups.forEach((group, groupIndex) => {
        const items = record(group)?.items;
        if (Array.isArray(items)) items.forEach((card, index) => push(card, ["examples", "groups", groupIndex, "items", index]));
      });
    }
  }
  return found;
}

const pages = await prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" }, select: { slug: true, contentJson: true } });
const locations = new Map();
for (const page of pages) {
  for (const { card, sectionId, pointer } of cardLocations(page.contentJson)) {
    const slug = typeof card?.publicSlug === "string" ? card.publicSlug : undefined;
    if (!slug) continue;
    if (!locations.has(slug)) locations.set(slug, { page: page.slug, contentJson: page.contentJson, sectionId, pointer });
  }
}

/** Read a card out of a page by its recorded pointer. */
function readCard(contentJson, sectionId, pointer) {
  let node = record(record(contentJson)?.sections?.[sectionId])?.settings?.data;
  for (const step of pointer) {
    node = node?.[step];
    if (node === undefined || node === null) return undefined;
  }
  return record(node);
}

const report = { restored: [], unchanged: [], missing: [] };
const writes = [];
for (const card of source.cards) {
  if (ONLY.length && !ONLY.includes(card.slug)) continue;
  const location = locations.get(card.slug);
  if (!location) {
    report.missing.push({ slug: card.slug, reason: "no card with this slug in the site" });
    continue;
  }
  const values = {
    prompt: card.prompt ? card.prompt : null,
    aspect: card.aspect ? card.aspect : null,
    duration: card.duration === "" || card.duration === undefined || card.duration === null ? null : card.duration
  };
  const current = readCard(location.contentJson, location.sectionId, location.pointer) ?? {};
  const changed = Object.entries(values).filter(([field, value]) => {
    const stored = current[field] ?? null;
    return (stored === null ? null : String(stored)) !== (value === null ? null : String(value));
  });
  if (!changed.length) {
    report.unchanged.push({ slug: card.slug });
    continue;
  }
  if (!APPLY) {
    report.restored.push({ slug: card.slug, fields: changed.map(([field]) => field), mode: "dry-run" });
    continue;
  }
  writes.push({ ...location, slug: card.slug, values });
}

if (APPLY && writes.length) {
  // One write per page: the card changes of a page are applied in memory and
  // the page row is stored once, so a large reset stays inside one short
  // transaction instead of one round trip per card.
  const byPage = new Map();
  for (const write of writes) {
    const list = byPage.get(write.page) ?? [];
    list.push(write);
    byPage.set(write.page, list);
  }
  for (const [pageSlug, pageWrites] of byPage) {
    await prisma.$transaction(async (tx) => {
      const page = await tx.livePage.findUnique({
        where: { siteId_slug: { siteId: SITE_ID, slug: pageSlug } },
        select: { contentJson: true }
      });
      const content = JSON.parse(JSON.stringify(page?.contentJson ?? {}));
      for (const write of pageWrites) {
        const section = record(content?.sections?.[write.sectionId]);
        let node = section?.settings?.data;
        for (const step of write.pointer) {
          node = node?.[step];
          if (node === undefined || node === null) throw new Error(`pointer lost ${step} for ${write.slug}`);
        }
        for (const [field, value] of Object.entries(write.values)) {
          if (value === null) delete node[field];
          else node[field] = value;
        }
        report.restored.push({ slug: write.slug, fields: Object.keys(write.values), mode: "written" });
      }
      await tx.livePage.update({
        where: { siteId_slug: { siteId: SITE_ID, slug: pageSlug } },
        data: { contentJson: content }
      });
    }, { timeout: 60_000 });
  }
}

console.log(JSON.stringify({
  mode: APPLY ? "apply" : "dry-run",
  source: SOURCE,
  site: SITE_ID,
  restored: report.restored.length,
  unchanged: report.unchanged.length,
  missing: report.missing.length,
  missingDetail: report.missing.slice(0, 8)
}, null, 2));
await prisma.$disconnect();
