#!/usr/bin/env node
// Print the Wan3.0 prompt a card would get, for review before any write.
//
//   node scripts/aidreamcapes-video-prompts/preview.mjs folding-bike-commute
//   node scripts/aidreamcapes-video-prompts/preview.mjs --track=ugc-action --limit=3
//
// Facts come from the frozen source copy, so the preview matches what the
// planner would compile for the same card.

import fs from "node:fs";
import { productFacts } from "./facts.mjs";
import { composePromptV3, clampPrompt, TRACK_DURATION } from "./spec-v3.mjs";
import { classifyTrack } from "./compile.mjs";

const SOURCE = "scripts/manifests/aidreamcapes-video-detail-prompts-source-2026-10-22.json";
const cards = JSON.parse(fs.readFileSync(SOURCE, "utf8")).cards;
const args = process.argv.slice(2);
const bySlug = new Map(cards.map((card) => [card.slug, card]));
const slugs = args.filter((arg) => !arg.startsWith("--"));
const trackArg = args.find((arg) => arg.startsWith("--track="))?.slice("--track=".length);
const limit = Number(args.find((arg) => arg.startsWith("--limit="))?.slice("--limit=".length) ?? 0);

const picked = slugs.length
  ? slugs.map((slug) => bySlug.get(slug)).filter(Boolean)
  : cards.filter((card) => !trackArg || classifyTrack(card) === trackArg).slice(0, limit || 3);

for (const card of picked) {
  const facts = productFacts(card);
  const track = classifyTrack(card);
  const raw = composePromptV3({ track, facts });
  const prompt = clampPrompt(raw);
  console.log("=".repeat(96));
  console.log(`${card.slug}  [${track}]  template ${TRACK_DURATION[track]}s  length ${prompt.length}${raw.length > prompt.length ? ` (clamped from ${raw.length})` : ""}`);
  console.log("facts:", JSON.stringify({ product: facts.product, colour: facts.colour, subject: facts.subject, verb: facts.verb, setting: facts.setting, settingShort: facts.settingShort, trait: facts.trait, person: facts.person }));
  console.log("-".repeat(96));
  console.log(prompt);
  console.log();
}
