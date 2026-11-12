#!/usr/bin/env node
// AIVideosUGC stale price-copy migration — 2026-11-12.
// Companion to the credit reprice (runtime + display scripts). The /pricing
// page was repriced, but ~180 other public rows still quote the retired
// subscription model ($24.50/$35/$63 per month, "Premium" tier) and the old
// consumption ladder (photo 24 credits; 6s/10s/15s/30s videos 24/40/60/120).
// This pass rewrites every affected string to the live model:
//   one-time packages (Starter $24/200, Pro $59/500, Studio $129/1,200),
//   photo 1 credit, 15s video 20 credits, 30s video 40 credits.
// The workspace sells 15s/30s only, so 6s/10s ladder copy is rewritten to the
// real ladder; example-output spec chips ("1:1 video · 6 s · 24 credits")
// become "15 s · 20 credits" (OutputCard renders a static poster only, no
// real asset contradicts the new duration). Video step chips collapse to the
// entry video price (20 credits); photo chips become 1 credit.
// A hard gate fails the run if any stale token survives on any row.
//   dry run:  node scripts/apply-aivideosugc-stale-price-copy-2026-11-12.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-stale-price-copy-2026-11-12.mjs --target=local --apply
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE = "site_aidreamcapes";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument("--confirm=aivideosugc-stale-price-copy-2026-11-12") });
if (apply && target === "production") assert(hasArgument("--confirm=aivideosugc-stale-price-copy-2026-11-12"), "Production update requires --confirm=aivideosugc-stale-price-copy-2026-11-12");

// Exact fragment rewrites, applied before the generic fallbacks. Longest/most
// specific first is not required (each is an exact substring), but entries are
// ordered so multi-fact sentences are rewritten before their sub-fragments.
const FRAGMENTS = [
  // Subscription model → one-time packages.
  ["Plans from $24.50 a month", "Packages from $24 for one month"],
  ["Plans start at $24.50", "Packages start at $24"],
  ["Plans are Starter at $24.50", "Packages are Starter at $24"],
  ["Plans run from $24.50 a month", "Packages run from $24 for one month"],
  ["A monthly plan from $24.50, instead of a creator fee", "A one-time package from $24, instead of a creator fee"],
  ["On a monthly plan, each new ad spends credits you see first", "Every package is a one-time purchase, and each new ad spends credits you see first"],
  ["You pay monthly credits instead of per-video creator fees", "You pay one-time package credits instead of per-video creator fees"],
  ["uses credits on a paid plan", "uses credits on a package"],
  ["credits for $24.50 per month", "credits for $24 for one month"],
  ["The pricing row lists every monthly plan", "The pricing page lists every package"],
  ["includes 200 credits for $24.50, Pro includes 300 for $35, and Premium includes 600 for $63 each month", "includes 200 credits at $24 for one month, Pro includes 500 at $59, and Studio includes 1,200 at $129"],
  ["$24.50 a month for 200 credits", "$24 for one month with 200 credits"],
  ["$24.50 monthly for 200 credits", "$24 for one month with 200 credits"],
  ["$24.50 for 200 credits", "$24 for one month with 200 credits"],
  ["$24.50 a month", "$24 for one month"],
  ["$24.50 monthly", "$24 for one month"],
  ["$24.50", "$24"],
  ["$35 for 300 credits", "$59 for 500 credits"],
  ["$35 for 300", "$59 for 500"],
  ["$63 for 600 credits", "$129 for 1,200 credits"],
  ["$63 for 600", "$129 for 1,200"],
  ["300 for $35", "500 for $59"],
  ["600 for $63", "1,200 for $129"],
  // Retired "Premium" plan name → Studio.
  ["Premium", "Studio"],
  // Old video ladder → 15s 20 / 30s 40.
  ["Photos cost 24 credits; videos cost 24 to 120 credits, depending on length", "A photo costs 1 credit; a 15-second video costs 20 and a 30-second video 40"],
  ["Videos cost 24 to 120 credits, depending on length", "Videos cost 20 or 40 credits depending on length"],
  ["videos cost 24 to 120 credits, depending on length", "videos cost 20 or 40 credits depending on length"],
  ["24 credits for 6 seconds, 40 for 10, 60 for 15, and 120 for 30", "20 credits for 15 seconds and 40 for 30"],
  ["24 credits for 6 seconds, 40 for 10, 60 for 15, or 120 for 30", "20 credits for 15 seconds or 40 for 30"],
  ["24 credits for 6 seconds up to 120 for 30 seconds", "20 credits for 15 seconds up to 40 for 30 seconds"],
  ["24 credits for 6 seconds", "20 credits for 15 seconds"],
  ["from 24 credits for a 6-second clip", "from 20 credits for a 15-second clip"],
  ["from 24 credits for 6 seconds", "from 20 credits for 15 seconds"],
  ["6 seconds costs 24, 10 costs 40, 15 costs 60, and 30 costs 120", "15 seconds costs 20 and 30 seconds costs 40"],
  ["A 6-second video costs 24 credits, 10 seconds costs 40, 15 costs 60, and 30 costs 120", "A 15-second video costs 20 credits and a 30-second video costs 40"],
  ["A 6-second video is 24 credits, 10 seconds is 40, 15 is 60, and 30 is 120", "A 15-second video is 20 credits, and 30 seconds is 40"],
  ["A 6-second clip is 24 credits, 10 seconds is 40, 15 is 60, and 30 is 120", "A 15-second clip is 20 credits, and 30 seconds is 40"],
  ["A 6-second video is 24, 10 seconds is 40, 15 is 60, and 30 is 120", "A 15-second video is 20, and 30 seconds is 40"],
  ["A 6-second video uses 24 credits", "A 15-second video uses 20 credits"],
  ["A 6-second home video uses 24 credits", "A 15-second home video uses 20 credits"],
  ["A 6-second Reel uses 24 credits", "A 15-second Reel uses 20 credits"],
  ["10, 15, and 30 seconds use 40, 60, and 120", "and a 30-second video uses 40"],
  ["A 6-second clip is 24 credits", "A 15-second clip is 20 credits"],
  ["A 6-second video costs 24 credits", "A 15-second video costs 20 credits"],
  ["A 6-second ad is 24 credits", "A 15-second ad is 20 credits"],
  ["6, 10, 15, or 30 second", "15 or 30 second"],
  ["6, 10, 15, or 30 seconds", "15 or 30 seconds"],
  ["6, 10, 15 or 30 seconds", "15 or 30 seconds"],
  ["6, 10, 15, and 30 second videos use 24, 40, 60, and 120", "15 second videos use 20 and 30 second videos use 40"],
  ["24, 40, 60, or 120 credits", "20 or 40 credits"],
  ["24, 40, 60 or 120 credits", "20 or 40 credits"],
  ["24, 40, 60, or 120", "20 or 40"],
  ["24, 40, 60, and 120", "20 and 40"],
  ["24 to 120 credits", "20 or 40 credits"],
  ["6 seconds 24 credits, 10s 40, 15s 60, 30s 120", "15s 20 credits, 30s 40"],
  ["Six seconds fits one motion. Ten fits a short demo. Fifteen fits a simple sequence. Thirty fits a longer one.", "Fifteen seconds fits a simple sequence and thirty fits a longer one."],
  ["Teaser and reveal work at 6-10s (24-40 credits); the closer look at 15s (60 credits)", "Teaser and reveal fit in a 15-second cut (20 credits); the closer look at 30 (40 credits)"],
  ["the teaser and the reveal work at 6 or 10 seconds — 24 or 40 credits; the closer look has room at 15 — 60 credits", "the teaser and the reveal fit in a 15-second cut — 20 credits; the closer look has room at 30 — 40 credits"],
  ["A 15-second ad costs the same as three product photos", "A 15-second ad costs the same as 20 product photos"],
  ["24-credit", "1-credit"],
  // Duration-capability claims tied to price or workflow specs: the workspace
  // sells 15s/30s only, and the real example assets on the detail pages are
  // 15s/30s renders (food-video.mp4 ffprobes at 15.07s), so 6s/10s example
  // specs are rewritten to the 15s entry config. Homepage "10-second loop"
  // specs are kept: the pfTikTokUnbox/pfFacebookOffer/pfInstagramReel assets
  // are genuinely 10-second renders (videos.*.duration = 10).
  ["The teaser and the reveal work at 6 or 10 seconds — 24 or 40 credits; the closer look has room at 15 — 60 credits.", "The teaser and the reveal fit in a 15-second cut — 20 credits; the closer look has room at 30 — 40 credits."],
  ["The teaser and the reveal work at 6 or 10 seconds — 24 or 20 credits; the closer look has room at 15 — 20 credits.", "The teaser and the reveal fit in a 15-second cut — 20 credits; the closer look has room at 30 — 40 credits."],
  ["Use 6 or 10 seconds for a quick ad, or 15 or 30 seconds when you need more detail", "Use 15 seconds for a quick ad, or 30 seconds when you need more detail"],
  ["A 10-second TikTok ad spends", "A 15-second TikTok ad spends"],
  ["a 10-second step from the photos", "a 15-second step from the photos"],
  ["· 6–30 s", "· 15–30 s"],
  ["· 6-30 s", "· 15-30 s"],
  // Spec chips and photo tokens (safe after the ladder fragments above).
  ["Square photo · 24 credits", "Square photo · 1 credit"],
  ["40 credits", "20 credits"],
  ["60 credits", "20 credits"],
  ["120 credits", "40 credits"],
  ["24 credits", "1 credit"],
  ["24 credit", "1 credit"]
];

const STALE_PRICE_TOKENS = ["$24.50", "$35 for 300", "$63 for 600", "24 credits", "40 credits", "60 credits", "120 credits", "Premium", "24, 40", "24 to 120", "40, 60"];
const STALE_DURATION_TOKENS = ["6-second", "6 seconds", "10-second", "10 seconds", "6 s ·", "10 s ·", "6-10s"];

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function rewrite(text, rowMode) {
  let out = text;
  // Example-output spec chips: "1:1 video · 6 s · 24 credits" → "15 s · 20 credits".
  out = out.replace(/(\d+) s · (24|40|60|120) credits/g, (m, s, c) => {
    const seconds = Number(s);
    const dur = seconds >= 15 ? seconds : 15;
    const cost = dur >= 30 ? 40 : 20;
    return `${dur} s · ${cost} credits`;
  });
  for (const [from, to] of FRAGMENTS) out = out.split(from).join(to);
  // Example workflow option values (["Length","6 seconds"], chips "10 seconds")
  // — exact standalone values only, so sentence copy is untouched here.
  if (out === "6 seconds" || out === "10 seconds") return "15 seconds";
  return out;
}
function walkFix(value, rowMode, changed) {
  if (typeof value === "string") {
    const next = rewrite(value, rowMode);
    if (next !== value) changed.count += 1;
    return next;
  }
  if (Array.isArray(value)) return value.map((item) => walkFix(item, rowMode, changed));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = walkFix(item, rowMode, changed);
    // Example-output duration data (V2VisualOutput.length) — clamp retired
    // 6s/10s example durations to the 15s entry config; only for objects that
    // carry a spec chip (static showcase cards), never media descriptors.
    if ("length" in out && "spec" in out && typeof out.length === "number" && out.length > 0 && out.length < 15) out.length = 15;
    return out;
  }
  return value;
}
function findCreditsChips(value, mode, hits) {
  if (Array.isArray(value)) { value.forEach((item) => findCreditsChips(item, mode, hits)); return; }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      const nextMode = key === "mode" && (item === "photo" || item === "video") ? item : mode;
      if (key === "credits" && typeof item === "string" && /^(24|40|60|120) credits$/.test(item)) {
        hits.push({ mode: nextMode ?? mode, value: item });
      }
      findCreditsChips(item, nextMode, hits);
    }
  }
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({ where: { siteId: SITE }, select: { id: true, slug: true, contentJson: true } });
  assert(rows.length > 100, `Unexpectedly few rows (${rows.length}); aborting.`);
  const plans = [];
  for (const row of rows) {
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const data = contentJson.sections?.v2_main?.settings?.data;
    const rowMode = typeof data?.visual?.steps?.mode === "string" ? data.visual.steps.mode : undefined;
    // Structured chip fix first: steps.credits must match the row's own mode
    // (photo rows → 1 credit, video rows → the entry video price 20 credits),
    // so the later blanket string pass cannot relabel a video chip as a photo.
    const chips = [];
    if (data?.visual) findCreditsChips(data.visual, rowMode, chips);
    for (const chip of chips) {
      const target0 = chip.mode === "photo" ? "1 credit" : chip.mode === "video" ? "20 credits" : null;
      assert(target0, `Row ${row.slug} has a credits chip without a known mode: ${chip.value}`);
      chip.value = target0;
    }
    const changed = { count: 0 };
    const next = walkFix(contentJson, rowMode, changed);
    if (changed.count > 0 || chips.length > 0) plans.push({ row, next, chips: chips.length, strings: changed.count });
  }
  console.log(`[stale-price-copy] target=${target} rows to update: ${plans.length}`);
  for (const p of plans.slice(0, 40)) console.log(`  ${p.row.slug} strings=${p.strings} chips=${p.chips} next-hash=${hash(p.next).slice(0, 12)}`);
  if (plans.length > 40) console.log(`  … and ${plans.length - 40} more rows`);

  if (!apply) {
    console.log("[stale-price-copy] dry run — no writes.");
  } else {
    for (const p of plans) {
      await db.livePage.update({ where: { id: p.row.id }, data: { contentJson: p.next } });
      const readback = await db.livePage.findUnique({ where: { id: p.row.id }, select: { contentJson: true } });
      assert.equal(hash(readback.contentJson), hash(p.next), `Readback hash mismatch on ${p.row.slug}.`);
    }
    console.log(`[stale-price-copy] applied ${plans.length} rows; readback verified.`);
  }

  // Hard gate: no stale price token may survive anywhere on the site.
  const after = await db.livePage.findMany({ where: { siteId: SITE }, select: { slug: true, contentJson: true } });
  const offenders = [];
  const durationWarnings = [];
  for (const row of after) {
    const s = JSON.stringify(row.contentJson);
    for (const token of STALE_PRICE_TOKENS) {
      if (s.includes(token)) offenders.push(`${row.slug} :: ${token}`);
    }
    for (const token of STALE_DURATION_TOKENS) {
      if (s.includes(token)) durationWarnings.push(`${row.slug} :: ${token}`);
    }
  }
  if (offenders.length) {
    console.error(`[stale-price-copy] GATE FAILED — stale price tokens remain:\n${[...new Set(offenders)].join("\n")}`);
    process.exitCode = 1;
  } else {
    console.log("[stale-price-copy] gate passed: no stale price tokens on any row.");
  }
  if (durationWarnings.length) {
    console.warn(`[stale-price-copy] duration mentions left for the editorial follow-up (${new Set(durationWarnings).size}):\n${[...new Set(durationWarnings)].slice(0, 20).join("\n")}`);
  }
} finally {
  await db.$disconnect();
}
