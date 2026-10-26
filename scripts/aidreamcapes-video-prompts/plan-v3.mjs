#!/usr/bin/env node
// Build the Wan3.0 field-level manifest for AIVideosUGC video detail prompts.
//
// This is the v3 planner. It never touches the database and it never invents
// content: every prompt is compiled from the card's own stored text (label,
// image alternative text and the original direction), with the structure of
// the Wan3.0 creator manual and the beats of the ecommerce/UGC prompt skill.
//
// Scope: every video card that can render a public detail page, including the
// alias owner cards, because an alias page renders its own card whenever the
// redirect does not apply.
//
// Usage:
//   DATABASE_TARGET=local node scripts/aidreamcapes-video-prompts/plan-v3.mjs
//   DATABASE_TARGET=local node scripts/aidreamcapes-video-prompts/plan-v3.mjs --out=<path>

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { productFacts } from "./facts.mjs";
import {
  PROMPT_SPEC_VERSION,
  PROMPT_FORMAT,
  MODEL,
  ASPECT,
  MAX_LENGTH,
  TRACK_DURATION,
  composePromptV3,
  clampPrompt
} from "./spec-v3.mjs";
import { classifyTrack } from "./compile.mjs";
import { argumentValue } from "../lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const args = process.argv.slice(2);
const OUT = args.find((arg) => arg.startsWith("--out="))?.slice("--out=".length)
  ?? "scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22-v3.json";

// The frozen pre-rewrite copy of every card, so the plan stays reproducible and
// idempotent once the rewrite has been applied.
const SOURCE = argumentValue("--source") || "scripts/manifests/aidreamcapes-video-detail-prompts-source-2026-10-22.json";
const sourceCards = fs.existsSync(SOURCE)
  ? new Map(JSON.parse(fs.readFileSync(SOURCE, "utf8")).cards.map((card) => [card.slug, card]))
  : new Map();

const prisma = new PrismaClient();
const record = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : undefined);
const str = (v) => (typeof v === "string" && v.trim() ? v : undefined);
const mediaKindOf = (v) => (v === "photo" ? "photo" : v === "video" || v === "clip" || v === "scene" ? "video" : undefined);
const sha = (value) => crypto.createHash("sha256").update(String(value ?? "")).digest("hex");

/** Every card shape the storefront can publish, with its exact location. */
function cardLocations(contentJson) {
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) ? content.sectionsOrder : [];
  const found = [];
  for (const sectionId of order) {
    const section = record(sections?.[sectionId]);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    const push = (card, pointer) => {
      if (card && typeof card === "object" && !Array.isArray(card)) found.push({ card, sectionId, pointer });
    };
    const definition = record(data?.templateDefinition);
    if (record(definition?.card)) push(definition.card, ["templateDefinition", "card"]);
    const picker = record(record(data?.visual)?.picker);
    if (picker && Array.isArray(picker.cards)) {
      picker.cards.forEach((card, index) => push(card, ["visual", "picker", "cards", index]));
    }
    if (Array.isArray(data?.workspaceCases)) {
      data.workspaceCases.forEach((card, index) => push(card, ["workspaceCases", index]));
    }
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

// --- Validator for the Wan3.0 block structure -------------------------------
const BLOCKS = ["Reference", "Overall Style", "Action Logic", "Camera", "Sound", "Continuity", "Negative"];
const BEAT = /^【(\d+\.\d)-(\d+\.\d)s \| [^】]+】/gm;

function validatePrompt(prompt, duration) {
  const errors = [];
  if (!prompt.trim()) return { valid: false, errors: ["Prompt is empty."] };
  if (prompt.length > 4000) errors.push(`Prompt exceeds 4000 characters (${prompt.length}).`);
  if (/[\u4e00-\u9fff]/.test(prompt)) errors.push("Prompt must be English only.");
  if (/@Image|@Video/.test(prompt)) errors.push("Prompt must not use @Image/@Video syntax.");
  if (/caption|subtitle|lower third|on-screen text/i.test(prompt)) errors.push("Prompt must not decide captions or subtitles.");
  for (const name of BLOCKS) if (!prompt.includes(`【${name}】`)) errors.push(`Missing 【${name}】 block.`);
  const beats = [...prompt.matchAll(BEAT)].map((match) => ({ from: Number(match[1]), to: Number(match[2]) }));
  if (beats.length < 4) errors.push(`Expected at least four timed beats, found ${beats.length}.`);
  if (beats.length) {
    if (beats[0].from !== 0) errors.push(`First beat must start at 0.0s (${beats[0].from}).`);
    if (Math.abs(beats[beats.length - 1].to - duration) > 0.01) errors.push(`Last beat must end at ${duration}.0s (${beats[beats.length - 1].to}).`);
    for (let index = 1; index < beats.length; index += 1) {
      if (Math.abs(beats[index].from - beats[index - 1].to) > 0.01) errors.push(`Gap between beat ${index} and ${index + 1}.`);
    }
  }
  const lastBlockAt = prompt.lastIndexOf("【");
  if (!prompt.slice(lastBlockAt).startsWith("【Negative】")) errors.push("【Negative】 must be the last block.");
  if (!/[.!?]"?$/.test(prompt.trim().slice(-3)) && !prompt.trim().endsWith(".")) errors.push("Prompt must end with a sentence.");
  return { valid: errors.length === 0, errors };
}

// --- Build ------------------------------------------------------------------
const pages = await prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" }, select: { slug: true, contentJson: true } });
const owners = new Map();
const firstCard = new Map();
for (const page of pages) {
  for (const { card, sectionId, pointer } of cardLocations(page.contentJson)) {
    const slug = str(card.publicSlug);
    if (!slug) continue;
    if (mediaKindOf(card.kind) !== "video") continue;
    if (!owners.has(slug)) owners.set(slug, new Set());
    owners.get(slug).add(page.slug);
    if (!firstCard.has(slug)) firstCard.set(slug, { page: page.slug, sectionId, pointer, card });
  }
}

const cards = [];
const skipped = { multiOwner: [], photoOnly: [] };
for (const [slug, pageSlugs] of owners) {
  if (pageSlugs.size !== 1) {
    skipped.multiOwner.push({ slug, owners: [...pageSlugs] });
    continue;
  }
  const entry = firstCard.get(slug);
  const { card } = entry;
  const source = sourceCards.get(slug);
  const facts = productFacts({
    slug,
    label: source?.label ?? str(card.label) ?? slug,
    alt: source?.alt ?? str(card.image?.alt) ?? "",
    prompt: source?.prompt ?? str(card.prompt) ?? ""
  });
  const track = classifyTrack({ label: source?.label ?? card.label, alt: facts.scene, prompt: source?.prompt ?? card.prompt });
  const duration = TRACK_DURATION[track] ?? 15;
  const prompt = clampPrompt(composePromptV3({ track, facts }));
  const validation = validatePrompt(prompt, duration);

  // The compare-and-set value is the card as it is stored now; the frozen
  // source stays the compile input, so an online edit still wins.
  const fromPrompt = str(card.prompt) ?? null;
  const fromAspect = str(card.aspect) ?? null;
  const fromDuration = card.duration ?? null;

  const ops = [];
  if (fromPrompt !== prompt) ops.push({ field: "prompt", fromSha: sha(fromPrompt), fromLength: String(fromPrompt ?? "").length, toSha: sha(prompt), toLength: prompt.length });
  if (fromAspect !== ASPECT) ops.push({ field: "aspect", from: fromAspect, to: ASPECT });
  if (Number(fromDuration) !== duration) ops.push({ field: "duration", from: fromDuration, to: duration });

  cards.push({
    slug,
    ownerPage: entry.page,
    sectionId: entry.sectionId,
    pointer: entry.pointer,
    label: source?.label ?? str(card.label) ?? slug,
    track,
    duration,
    isAlias: Boolean(str(card.detailAliasOf)),
    aliasOf: str(card.detailAliasOf) ?? null,
    facts: {
      product: facts.product,
      subject: facts.subject,
      verb: facts.verb,
      setting: facts.setting,
      settingShort: facts.settingShort,
      trait: facts.trait
    },
    ops,
    promptLength: prompt.length,
    validation
  });
}
cards.sort((a, b) => a.slug.localeCompare(b.slug));

const trackCounts = {};
for (const card of cards) trackCounts[card.track] = (trackCounts[card.track] ?? 0) + 1;
const invalid = cards.filter((card) => !card.validation.valid);
const long = cards.filter((card) => card.promptLength > MAX_LENGTH);

const manifest = {
  specVersion: PROMPT_SPEC_VERSION,
  promptFormat: PROMPT_FORMAT,
  siteId: SITE_ID,
  generatedAt: new Date().toISOString(),
  model: MODEL,
  aspect: ASPECT,
  trackDuration: TRACK_DURATION,
  sourcePath: SOURCE,
  targetRule: "The applier recompiles the target prompt from the frozen source with this spec version, and writes it only when the digest matches toSha.",
  contract: [
    "Every prompt uses the Wan3.0 block structure: opening sentence, reference binding, 【】 blocks, timed beats, 【Camera】, 【Sound】, 【Continuity】 and 【Negative】 last.",
    "Beats follow the ecommerce/UGC skill: 电商展示轨 远景陈列 → 正面特写 → 手入画翻背面 → 使用 → 卖点 → 收尾; UGC 钩子 → 演示 → 证据 → 收口; 品牌 氛围 → 使用瞬间 → 材质微距 → 定格.",
    "The voice track carries the five spoken lines of the skill (hook, point, demo, evidence, close); captions and subtitles stay a workspace switch and a human decision, so no prompt mentions them.",
    "Reference images are described by role in plain English; the platform forbids @Image/@Video syntax.",
    "Only the prompt, aspect and duration fields of the named card change. No page, navigation, SEO or media row is touched.",
    "Every operation is a compare-and-set: the applier skips a card whose stored value no longer matches the recorded digest, so an online edit wins."
  ],
  summary: {
    detailCards: cards.length,
    canonicalOwnerCards: cards.filter((card) => !card.isAlias).length,
    aliasOwnerCards: cards.filter((card) => card.isAlias).length,
    multiOwnerSkipped: skipped.multiOwner.length,
    trackCounts,
    promptsChanged: cards.filter((card) => card.ops.some((op) => op.field === "prompt")).length,
    aspectChanged: cards.filter((card) => card.ops.some((op) => op.field === "aspect")).length,
    durationChanged: cards.filter((card) => card.ops.some((op) => op.field === "duration")).length,
    invalidPrompts: invalid.length,
    overLength: long.length,
    maxPromptLength: Math.max(...cards.map((card) => card.promptLength)),
    minPromptLength: Math.min(...cards.map((card) => card.promptLength))
  },
  cards,
  skipped
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify(manifest.summary, null, 2));
if (invalid.length) {
  for (const card of invalid.slice(0, 10)) console.log("invalid:", card.slug, card.validation.errors.join(" | "));
}
console.log("manifest:", OUT);
await prisma.$disconnect();
