#!/usr/bin/env node
// Build the field level manifest for AIVideosUGC video detail prompts.
//
// The manifest is the only thing this script writes. It never touches the
// database, and it never invents content: every prompt is compiled from the
// card's own stored prompt, image alternative text, label and chips.
//
// Scope: every video card that can render a public detail page. A slug is
// such a card when exactly one page owns it, and the card that page renders
// is the first card of that page with the slug. Alias cards count: their own
// page renders their own card whenever the alias redirect does not apply, so
// they need the same prompt as any other detail page.
//
// Usage:
//   DATABASE_URL=... node scripts/aidreamcapes-video-prompts/plan.mjs
//   DATABASE_URL=... node scripts/aidreamcapes-video-prompts/plan.mjs --out=<path>

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PROMPT_SPEC_VERSION, TRACK_WAN30, ASPECT, composePrompt, SECTIONS } from "./spec.mjs";
import { classifyTrack, cardScene, cardAction, cardPresenter, assetPlan, assetImagePrompt } from "./compile.mjs";
import { argumentValue } from "../lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const TARGET_DURATION = 30;
const outIndex = process.argv.slice(2).findIndex((arg) => arg.startsWith("--out="));
const OUT = outIndex >= 0
  ? process.argv.slice(2)[outIndex].slice("--out=".length)
  : "scripts/manifests/aidreamcapes-video-detail-prompts-local-2026-10-22.json";

// The frozen pre-rewrite copy of every card. The compiler reads it, so the
// plan stays reproducible and idempotent once the rewrite has been applied.
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

// --- The platform prompt validator, mirrored from src/lib/video-prompt-format.ts ---
const cameraMotion = /\b(push(?:[- ]?ins?)?|pull(?:[- ]?outs?)?|dolly|tracks?|tracking|moves?|slides?|gimbal|whip[- ]?pans?|pans?|tilts?|zooms?|orbits?|crane|handheld|static|locked[- ]?off|rack focus|arcs?|reveal|drift|push in)\b/i;
const lens = /\b(?:\d{1,3}\s*mm|wide[- ]?angle|telephoto|macro|anamorphic|lens)\b/i;
const environment = /\b(?:rain|wind|breeze|snow|steam|smoke|mist|heat|cold|warm|dust|crowd|traffic|water|sea|surf|air|room|studio|salon|café|restaurant|office|setting|movement|fabric|surfaces?|reflections?|shadows?|weather|neon|flicker|sunlight|sunset|light|lamp|fog|humidity|pressure|daylight|glow|haze|workplace|window|garden|kitchen|table|floor|wall|shelf|plant|fireplace|sky|waterfront|pavement|outdoor|background|slide|diagram|beach|meadow|mountain|place|spot|counter|sofa|desk|balcony|gym)\b/i;
const microAction = /\b(?:hand|hands|finger|fingers|breath|breathing|blink|eyes|gaze|jaw|lips|mouth|shoulder|shoulders|wrist|grip|swallow|posture|hair|fabric|paper|card|ring|tool|texture|steam|paw|paws|foot|feet|contact)\b/i;
const soundAnchor = /\b(?:sounds?|audio|music|ambience|hum|buzz|ventilation|whisper|voice|footsteps?|click|rustle|silence|echo|motif|reflection|chime|splash|tone|narration|dialogue|applause|laughter|breath|pencil|paper|chair|scissors|espresso|ceramic|glass|clock|engine|relay|surf|waves?|cap|ring|bark|meow|purr|chirp|jingle|paws?|tool|machine|keyboard|envelope|instrument|bell|cloth|fabric|water|wind|sizzle|chop|scrape|pour|room tone)\b/i;
const finalFrame = /\b(?:final (?:frame|image|shot)|ending (?:frame|image|shot)|ends? on|finish(?:es)? on|last frame)\b/i;
const actionVerb = /\b(?:moves?|turns?|walks?|runs?|reaches?|looks?|shifts?|rises?|raises?|falls?|opens?|closes?|leans?|dances?|speaks?|breathes?|drifts?|pans?|tilts?|zooms?|tracks?|shows?|reveals?|performs?|delivers?|demonstrates?|gives?|leads?|works?|lifts?|pours?|cuts?|holds?|nods?|smiles?|asks?|builds?|creates?|adds?|animates?|introduces?|guides?|explains?|prepares?|assembles?|presses?|wraps?|decorates?|exchanges?|passes?|counts?|finishes?|starts?|preserves?|focuses?|makes?|aligns?|settles?|traces?|executes?|uses?|touches?|receives?|completes?|tries?|changes?|acts?|hits?|warms?|sits?|rests?|returns?|brings?|drops?|fills?|keeps?|stays?)\b/i;
const unsafe = /\b(?:child porn|sexual(?:ized)? minor|underage (?:sex|nude|nudity)|explicit sexual content|graphic gore)\b/i;
const shotBlock = /Shot\s+\d+\s*\[\d+\.\d-\d+\.\ds\]/g;

function sectionBody(prompt, label) {
  const index = prompt.search(new RegExp(`^\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "im"));
  if (index < 0) return "";
  const start = prompt.indexOf(":", index) + 1;
  const rest = prompt.slice(start);
  const next = rest.search(/^\s*(?:Subject|Action|Scene|Camera|Lighting|Style|Sound|Duration|Continuity|Negative)\b[^\n]*:/im);
  return (next < 0 ? rest : rest.slice(0, next)).trim();
}

function validatePrompt(prompt) {
  const errors = [];
  if (!prompt.trim()) return { valid: false, errors: ["Prompt is required."] };
  if (prompt.length > 4000) errors.push(`Prompt must be 4000 characters or fewer (${prompt.length}).`);
  if (unsafe.test(prompt)) errors.push("Prompt contains disallowed safety content.");
  for (const label of SECTIONS) if (!sectionBody(prompt, label)) errors.push(`Missing ${label} section.`);
  const camera = sectionBody(prompt, "Camera / Shot / Lens");
  const action = sectionBody(prompt, "Action / Motion");
  const scene = sectionBodyBody(prompt, "Scene / Environment");
  const sound = sectionBody(prompt, "Sound / Audio");
  const continuity = sectionBody(prompt, "Continuity");
  const shots = prompt.match(shotBlock) ?? [];
  if (shots.length < 4) errors.push(`Action / Motion must carry a timed shot list (${shots.length}).`);
  if (action && !actionVerb.test(action)) errors.push("Action / Motion must describe a concrete first action.");
  if (camera && (!cameraMotion.test(camera) || !lens.test(camera))) errors.push("Camera / Shot / Lens must include camera movement and lens detail.");
  if (scene && !environment.test(scene)) errors.push("Scene / Environment must include a physical or environmental detail.");
  if (!microAction.test(prompt)) errors.push("Prompt must include a body micro-action or tactile detail.");
  if (sound && !soundAnchor.test(sound)) errors.push("Sound / Audio must include an audible anchor.");
  if (!finalFrame.test(`${continuity} ${prompt}`)) errors.push("Continuity must describe the final frame.");
  const negativeAt = prompt.indexOf("Negative Constraints:");
  const lastBlock = prompt.lastIndexOf("\n\n");
  if (negativeAt < 0 || negativeAt < lastBlock) errors.push("Negative Constraints must be the last block.");
  if (/caption|subtitle|on-screen text|lower third/i.test(prompt)) errors.push("Prompt must not decide captions or subtitles.");
  return { valid: errors.length === 0, errors };
}
function sectionBodyBody(prompt, label) { return sectionBody(prompt, label); }

// --- Build ---
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
  const facts = {
    slug,
    label: str(card.label) ?? str(card.title) ?? slug,
    alt: source?.alt ?? str(card.image?.alt) ?? "",
    prompt: source?.prompt ?? str(card.prompt) ?? "",
    image: str(card.image?.src) ?? "",
    imageW: card.image?.w,
    imageH: card.image?.h
  };
  const track = classifyTrack(facts);
  const scene = cardScene(facts);
  const action = cardAction(facts, scene, track);
  const presenter = cardPresenter(facts);
  // The template runtime is 30 seconds. The storefront offers 15 and 30,
  // and the Wan3.0 provider accepts both, so the prompt and the card use 30.
  const duration = TARGET_DURATION;
  const prompt = composePrompt({ track, scene, action, presenter, duration });
  const validation = validatePrompt(prompt);
  const fromPrompt = source ? (source.prompt ? source.prompt : null) : (str(card.prompt) ?? null);
  const fromAspect = source ? (source.aspect ? source.aspect : null) : (str(card.aspect) ?? null);
  const fromDuration = source
    ? (source.duration === "" || source.duration === undefined || source.duration === null ? null : source.duration)
    : (card.duration ?? null);
  const ops = [];
  // The target value is not stored as text. The applier recompiles it from
  // the frozen source and this spec version, and checks the digest, so the
  // plan stays small and any drift between plan and apply is caught.
  if (fromPrompt !== prompt) ops.push({ field: "prompt", fromSha: sha(fromPrompt), fromLength: String(fromPrompt ?? "").length, toSha: sha(prompt), toLength: prompt.length });
  if (fromAspect !== ASPECT) ops.push({ field: "aspect", from: fromAspect, to: ASPECT });
  if (Number(fromDuration) !== duration) ops.push({ field: "duration", from: fromDuration, to: duration });
  cards.push({
    slug,
    ownerPage: entry.page,
    sectionId: entry.sectionId,
    pointer: entry.pointer,
    label: facts.label,
    track,
    isAlias: Boolean(str(card.detailAliasOf)),
    aliasOf: str(card.detailAliasOf) ?? null,
    ops,
    promptLength: prompt.length,
    validation,
    assets: assetPlan(facts)
  });
}
cards.sort((a, b) => a.slug.localeCompare(b.slug));

const trackCounts = {};
for (const card of cards) trackCounts[card.track] = (trackCounts[card.track] ?? 0) + 1;
const invalid = cards.filter((card) => !card.validation.valid);

const manifest = {
  specVersion: PROMPT_SPEC_VERSION,
  siteId: SITE_ID,
  generatedAt: new Date().toISOString(),
  model: TRACK_WAN30,
  aspect: ASPECT,
  defaultDuration: TARGET_DURATION,
  promptFormat: "wan3.0-timed-shots",
  sourcePath: SOURCE,
  targetRule: "The applier recompiles the target prompt from the frozen source with this spec version, and writes it only when the digest matches toSha.",
  contract: [
    "Every prompt uses the platform sections and the Wan3.0 timed shot list, and Negative Constraints is always the last block.",
    "Captions, on-screen text and voiceover wording are not written: the workspace owns the subtitle switch and a human decides them later.",
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
    maxPromptLength: Math.max(...cards.map((card) => card.promptLength))
  },
  cards,
  skipped
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${JSON.stringify(manifest, null, 2)}\n`);

// The asset manifest is the image pipeline's input: one row per missing
// reference photo, with the target file name and the prompt template id.
const assetRows = [];
for (const card of cards) {
  for (const asset of card.assets) {
    if (asset.status === "existing") continue;
    assetRows.push({
      slug: card.slug,
      ownerPage: card.ownerPage,
      role: asset.role,
      file: asset.file,
      size: "640x1138",
      why: asset.why,
      phrase: asset.phrase,
      prompt: assetImagePrompt(asset.role, asset.phrase)
    });
  }
}
const assetManifest = {
  specVersion: PROMPT_SPEC_VERSION,
  siteId: SITE_ID,
  generatedAt: manifest.generatedAt,
  purpose: "Reference photo set each video detail page needs before its prompt can use a second angle or a material close-up.",
  contract: [
    "Every image is a 9:16 reference photo of the same generic product, so a model never has to invent a second product.",
    "The product stays unbranded: no readable text, no logo, no watermark, no price graphic.",
    "The image file must exist in /public before a card may reference the second angle in its prompt."
  ],
  summary: {
    cards: cards.length,
    assets: assetRows.length,
    byRole: assetRows.reduce((acc, row) => ({ ...acc, [row.role]: (acc[row.role] ?? 0) + 1 }), {})
  },
  assets: assetRows
};
const ASSET_OUT = OUT.replace(/\.json$/, "-assets.json");
fs.writeFileSync(ASSET_OUT, `${JSON.stringify(assetManifest, null, 2)}\n`);

console.log(JSON.stringify({ out: OUT, assetOut: ASSET_OUT, ...manifest.summary }, null, 2));
if (invalid.length) {
  console.log("\ninvalid prompts:");
  for (const card of invalid.slice(0, 12)) console.log("-", card.slug, card.track, card.validation.errors);
}
await prisma.$disconnect();
