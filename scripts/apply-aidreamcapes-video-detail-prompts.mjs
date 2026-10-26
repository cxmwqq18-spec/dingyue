#!/usr/bin/env node
// Apply the AIVideosUGC video detail prompt manifest.
//
// The manifest is a field level plan. Every operation names the exact card,
// the exact field, the value that field had when the plan was built, and the
// new value. The applier writes an operation only while the stored value still
// matches the recorded one, so an online edit always wins.
//
// Scope rules:
//   - only site_aidreamcapes rows are read or written;
//   - only the prompt, aspect and duration fields of a named card change;
//   - no page, navigation, SEO, media or snapshot row is touched;
//   - the run is a dry report unless --apply is passed.
//
// Usage:
//   DATABASE_URL=... DATABASE_TARGET=local DINGYUE_ENV=local \
//     node scripts/apply-aidreamcapes-video-detail-prompts.mjs
//   ... --apply
//   ... --apply --manifest=<path>
//   ... --apply --only=<slug,slug>

import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { composePrompt } from "./aidreamcapes-video-prompts/spec.mjs";
import { composePromptV3, clampPrompt, PROMPT_FORMAT as V3_FORMAT } from "./aidreamcapes-video-prompts/spec-v3.mjs";
import { productFacts } from "./aidreamcapes-video-prompts/facts.mjs";
import { classifyTrack, cardScene, cardAction, cardPresenter } from "./aidreamcapes-video-prompts/compile.mjs";
import { argumentValue, hasArgument, assertAllowedSite, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const MANIFEST = argumentValue("--manifest") || "scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22.json";
const APPLY = hasArgument("--apply");
const ONLY = (argumentValue("--only") || "").split(",").map((value) => value.trim()).filter(Boolean);
const sha = (value) => crypto.createHash("sha256").update(String(value ?? "")).digest("hex");

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
if (manifest.siteId !== SITE_ID) throw new Error(`Manifest site ${manifest.siteId} is not ${SITE_ID}.`);
assertAllowedSite(manifest.siteId);
if (APPLY) assertNonProductionWriteTarget(process.env);

// The target prompt is recompiled from the frozen source, so the plan stays
// small and any drift between the plan and this run is caught by the digest.
const sourcePath = manifest.sourcePath || "scripts/manifests/aidreamcapes-video-detail-prompts-source-2026-10-22.json";
const sourceCards = fs.existsSync(sourcePath)
  ? new Map(JSON.parse(fs.readFileSync(sourcePath, "utf8")).cards.map((card) => [card.slug, card]))
  : new Map();

function compileTarget(card) {
  const source = sourceCards.get(card.slug);
  if (!source) return undefined;
  const sourceCard = {
    slug: card.slug,
    label: source.label ?? card.slug,
    alt: source.alt ?? "",
    prompt: source.prompt ?? "",
    image: source.image ?? "",
    imageW: source.imageW,
    imageH: source.imageH
  };
  if (manifest.promptFormat === V3_FORMAT) {
    // The v3 plan compiles the Wan3.0 block prompt from the card's own facts,
    // and each track keeps the length the skill gives it.
    const facts = productFacts(sourceCard);
    const track = card.track ?? classifyTrack(sourceCard);
    return clampPrompt(composePromptV3({ track, facts }));
  }
  const facts = sourceCard;
  const track = classifyTrack(facts);
  const scene = cardScene(facts);
  const action = cardAction(facts, scene, track);
  const presenter = cardPresenter(facts);
  const duration = Number(manifest.defaultDuration) > 0 ? Number(manifest.defaultDuration) : 30;
  return composePrompt({ track, scene, action, presenter, duration });
}

const prisma = new PrismaClient();
const record = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : undefined);

/** Read the card the manifest points at, with its current field values. */
function readCard(contentJson, sectionId, pointer) {
  const section = record(record(contentJson)?.sections?.[sectionId]);
  if (!section) return undefined;
  let node = section?.settings?.data;
  for (const step of pointer) {
    node = node?.[step];
    if (node === undefined || node === null) return undefined;
  }
  return record(node);
}

const pages = await prisma.livePage.findMany({
  where: { siteId: SITE_ID, slug: { in: [...new Set(manifest.cards.map((card) => card.ownerPage))] } },
  orderBy: { slug: "asc" },
  select: { slug: true, contentJson: true }
});
const bySlug = new Map(pages.map((page) => [page.slug, page]));

const report = { applied: [], skipped: [], unchanged: [], missing: [] };
const writes = [];

for (const card of manifest.cards) {
  if (ONLY.length && !ONLY.includes(card.slug)) continue;
  const page = bySlug.get(card.ownerPage);
  if (!page) {
    report.missing.push({ slug: card.slug, reason: "owner page not found" });
    continue;
  }
  const current = readCard(page.contentJson, card.sectionId, card.pointer);
  if (!current) {
    report.missing.push({ slug: card.slug, reason: "card not found at the recorded pointer" });
    continue;
  }
  if (String(current.publicSlug ?? "") !== card.slug) {
    report.missing.push({ slug: card.slug, reason: "the recorded pointer now holds another card" });
    continue;
  }
  const pending = [];
  for (const op of card.ops) {
    const stored = current[op.field] ?? null;
    let target = op.to;
    if (op.toSha !== undefined) {
      const compiled = compileTarget(card);
      if (!compiled) {
        report.skipped.push({ slug: card.slug, field: op.field, reason: "the frozen source has no entry for this card" });
        continue;
      }
      if (sha(compiled) !== op.toSha) {
        report.skipped.push({ slug: card.slug, field: op.field, reason: "the recompiled prompt does not match the planned digest" });
        continue;
      }
      target = compiled;
    }
    if (op.fromSha !== undefined) {
      // The plan stores the digest of the value it expects, so a card that
      // changed online is skipped instead of overwritten.
      if (sha(stored ?? "") !== op.fromSha) {
        report.skipped.push({ slug: card.slug, field: op.field, reason: "the stored value changed after the plan was built" });
        continue;
      }
    } else {
      const expected = op.from ?? null;
      const same = (stored === null || stored === undefined ? null : String(stored))
        === (expected === null ? null : String(expected));
      if (!same) {
        report.skipped.push({ slug: card.slug, field: op.field, reason: "the stored value changed after the plan was built" });
        continue;
      }
    }
    if (String(stored ?? "") === String(target ?? "")) {
      report.unchanged.push({ slug: card.slug, field: op.field });
      continue;
    }
    pending.push({ ...op, to: target });
  }
  if (!pending.length) continue;
  if (!APPLY) {
    report.applied.push({ slug: card.slug, fields: pending.map((op) => op.field), mode: "dry-run" });
    continue;
  }
  // The write happens in the database transaction below.
  writes.push({ slug: card.slug, page: card.ownerPage, sectionId: card.sectionId, pointer: card.pointer, ops: pending });
}

if (APPLY && writes.length) {
  // One write per page: the card changes of a page are applied in memory and
  // the page row is stored once, which keeps a large plan inside one short
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
        for (const op of write.ops) {
          if (op.to === null || op.to === undefined) delete node[op.field];
          else node[op.field] = op.to;
        }
        report.applied.push({ slug: write.slug, fields: write.ops.map((op) => op.field), mode: "written" });
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
  manifest: MANIFEST,
  site: SITE_ID,
  cards: manifest.cards.length,
  applied: report.applied.length,
  skipped: report.skipped.length,
  unchanged: report.unchanged.length,
  missing: report.missing.length,
  skippedDetail: report.skipped.slice(0, 10),
  missingDetail: report.missing.slice(0, 10)
}, null, 2));
await prisma.$disconnect();
