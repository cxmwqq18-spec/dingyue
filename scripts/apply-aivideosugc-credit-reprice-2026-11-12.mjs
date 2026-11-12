#!/usr/bin/env node
// AIVideosUGC credit reprice — runtime billing, 2026-11-12.
// Approved rate card (design/credit-reprice-and-geo-plan-2026-11-12.html):
//   photo 1 credit ($0.12, benchmark Topview ≈$0.10 / Photoroom $0.33)
//   15s video 20 credits ($2.40) · 30s video 40 credits ($4.80, vs Topview $6)
// Isolation (decision D3, option a): the legacy shared channel
// aiprov_mvjo1842_gt4f4c keeps its old rate card untouched as the platform
// fallback for other sites (site_dreamshoot video flow is dormant since
// 2026-08-14 and falls back by priority — the clone gets a worse priority so
// the fallback still hits the legacy row). Aidreamcapes jobs select the new
// dedicated channel explicitly (fixed_provider) and the workspace catalog
// filters the legacy row out of the model picker.
//   dry run:  node scripts/apply-aivideosugc-credit-reprice-2026-11-12.mjs --target=local
//   apply:    node scripts/apply-aivideosugc-credit-reprice-2026-11-12.mjs --target=local --apply
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const LEGACY_ID = "aiprov_mvjo1842_gt4f4c";
const LEGACY_RELAY_ID = "airelay_mvjo0xah_ndeshc";
const DEDICATED_ID = "aiprov_aivideosugc_wan1080";
const DEDICATED_RELAY_ID = "airelay_aivideosugc_wan1080";
const SITE = "site_aidreamcapes";
const NEW_RATES = { priceCredits: 40, priceVideoDurations: { 15: 20, 30: 40 } };

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: hasArgument("--confirm=aivideosugc-credit-reprice-2026-11-12") });
if (apply && target === "production") assert(hasArgument("--confirm=aivideosugc-credit-reprice-2026-11-12"), "Production update requires --confirm=aivideosugc-credit-reprice-2026-11-12");

const db = new PrismaClient();
try {
  // 1a. Dedicated relay row: the PlatformAiProvider unique constraint
  // (relayId, upstreamModelId) forbids a second provider on the same relay +
  // upstream model, so the dedicated channel gets its own relay row carrying
  // the identical upstream configuration. Dispatch reads aiUrl/apiKey from the
  // provider row itself; the relay copy is config-identical and only keeps the
  // admin linkage coherent.
  const legacyRelay = await db.platformAiRelay.findUnique({ where: { id: LEGACY_RELAY_ID } });
  assert(legacyRelay, `Legacy relay ${LEGACY_RELAY_ID} missing.`);
  assert.equal(legacyRelay.enabled, true, "Legacy relay disabled; investigate before applying.");
  const existingRelay = await db.platformAiRelay.findUnique({ where: { id: DEDICATED_RELAY_ID } });
  if (existingRelay) {
    assert.equal(existingRelay.baseUrl, legacyRelay.baseUrl, "Dedicated relay exists with a different baseUrl; investigate.");
    console.log(`[credit-reprice] dedicated relay ${DEDICATED_RELAY_ID} already present; no change.`);
  } else {
    if (!apply) {
      console.log(`[credit-reprice] would create dedicated relay ${DEDICATED_RELAY_ID} (baseUrl ${legacyRelay.baseUrl}, protocol ${legacyRelay.protocol})`);
    } else {
      await db.platformAiRelay.create({
        data: {
          id: DEDICATED_RELAY_ID,
          label: "AIVideosUGC wan-1080p relay",
          baseUrl: legacyRelay.baseUrl,
          apiKey: legacyRelay.apiKey,
          protocol: legacyRelay.protocol,
          enabled: true,
          updatedBy: "apply-aivideosugc-credit-reprice-2026-11-12"
        }
      });
      const relayReadback = await db.platformAiRelay.findUnique({ where: { id: DEDICATED_RELAY_ID } });
      assert(relayReadback && relayReadback.baseUrl === legacyRelay.baseUrl && relayReadback.enabled === true, "Dedicated relay readback failed.");
      console.log(`[credit-reprice] created dedicated relay ${DEDICATED_RELAY_ID}; readback verified.`);
    }
  }

  // 1b. Dedicated video channel: clone of the legacy row with the new rate card.
  const legacy = await db.platformAiProvider.findUnique({ where: { id: LEGACY_ID } });
  assert(legacy, `Legacy provider ${LEGACY_ID} missing.`);
  // CAS: refuse to run if the legacy row was already touched by someone else.
  assert.equal(legacy.priceEnabled, true, "Legacy provider priceEnabled changed; investigate before applying.");
  assert.deepEqual(legacy.priceVideoDurations, { 15: 30, 30: 60 }, "Legacy provider rate card changed; investigate before applying.");
  assert.equal(legacy.priority, 0, "Legacy provider priority changed; the fallback-isolation ordering would break.");

  const cloneData = {
    id: DEDICATED_ID,
    label: "Wan 2.6 1080p (AIVideosUGC)",
    aiUrl: legacy.aiUrl,
    apiKey: legacy.apiKey,
    modelType: legacy.modelType,
    providerType: legacy.providerType,
    // Worse priority + not preferred: the platform fallback (other sites) must
    // keep resolving to the legacy row first.
    priority: 50,
    preferred: false,
    enabled: true,
    supportsGenerationN: legacy.supportsGenerationN,
    supportsEditN: legacy.supportsEditN,
    maxImagesPerRequest: legacy.maxImagesPerRequest,
    maxVideoInputs: legacy.maxVideoInputs,
    maxAudioInputs: legacy.maxAudioInputs,
    imageAspectRatio: legacy.imageAspectRatio,
    imageResolution: legacy.imageResolution,
    imageQuality: legacy.imageQuality,
    imageOutputFormat: legacy.imageOutputFormat,
    apiProtocol: legacy.apiProtocol,
    videoModelFamily: legacy.videoModelFamily,
    videoDurations: [...legacy.videoDurations],
    videoAspectRatios: [...legacy.videoAspectRatios],
    videoResolutions: [...legacy.videoResolutions],
    videoNativeSpeech: legacy.videoNativeSpeech,
    relayId: DEDICATED_RELAY_ID,
    upstreamModelId: legacy.upstreamModelId,
    syncState: legacy.syncState,
    priceEnabled: true,
    priceCredits: NEW_RATES.priceCredits,
    priceVideoDurations: NEW_RATES.priceVideoDurations,
    priceVideoResolutions: legacy.priceVideoResolutions,
    priceImageQualities: legacy.priceImageQualities,
    priceImageResolutions: legacy.priceImageResolutions,
    priceImageInput: legacy.priceImageInput,
    priceVideoInput: legacy.priceVideoInput,
    priceVideoInputPerSecond: legacy.priceVideoInputPerSecond,
    priceAudioInput: legacy.priceAudioInput,
    priceAudioInputPerSecond: legacy.priceAudioInputPerSecond,
    updatedBy: "apply-aivideosugc-credit-reprice-2026-11-12"
  };

  const existing = await db.platformAiProvider.findUnique({ where: { id: DEDICATED_ID } });
  if (existing) {
    // Idempotent re-run: assert the dedicated row already carries the new rates.
    assert.equal(existing.priceCredits, NEW_RATES.priceCredits, "Dedicated channel exists with unexpected base price.");
    assert.deepEqual(existing.priceVideoDurations, NEW_RATES.priceVideoDurations, "Dedicated channel exists with unexpected duration matrix.");
    assert.equal(existing.enabled, true, "Dedicated channel exists but is disabled.");
    console.log(`[credit-reprice] dedicated channel ${DEDICATED_ID} already present with the new rates; no change.`);
  } else {
    if (!apply) {
      console.log(`[credit-reprice] would create dedicated channel ${DEDICATED_ID} (rates ${JSON.stringify(NEW_RATES)}, priority ${cloneData.priority}, label "${cloneData.label}")`);
    } else {
      await db.platformAiProvider.create({ data: cloneData });
      const readback = await db.platformAiProvider.findUnique({ where: { id: DEDICATED_ID } });
      assert(readback && readback.priceCredits === NEW_RATES.priceCredits && readback.enabled === true, "Dedicated channel readback failed.");
      assert.deepEqual(readback.priceVideoDurations, NEW_RATES.priceVideoDurations, "Dedicated channel readback rate card mismatch.");
      console.log(`[credit-reprice] created dedicated channel ${DEDICATED_ID}; readback verified.`);
    }
  }

  // 2. Photo + video app credit costs, scoped to site_aidreamcapes only.
  const appUpdates = [
    { slug: "image_generator", from: 24, to: 1, note: "photo → 1 credit ($0.12)" },
    { slug: "video_generator", from: 24, to: 20, note: "video fallback base → 20 credits (15s)" }
  ];
  for (const { slug, from, to, note } of appUpdates) {
    const rows = await db.siteAiApp.findMany({
      where: { siteId: SITE, enabled: true, aiApp: { slug } },
      select: { id: true, creditCost: true, aiAppId: true }
    });
    assert(rows.length === 1, `Expected exactly one enabled ${slug} app on ${SITE}, found ${rows.length}.`);
    const row = rows[0];
    if (row.creditCost === to) {
      console.log(`[credit-reprice] ${slug}.creditCost already ${to}; no change.`);
      continue;
    }
    assert.equal(row.creditCost, from, `${slug}.creditCost is ${row.creditCost}, expected ${from}; investigate before applying.`);
    if (!apply) {
      console.log(`[credit-reprice] would set ${slug}.creditCost ${from} → ${to} (${note})`);
    } else {
      await db.siteAiApp.update({ where: { id: row.id }, data: { creditCost: to } });
      const readback = await db.siteAiApp.findUnique({ where: { id: row.id }, select: { creditCost: true } });
      assert.equal(readback.creditCost, to, `${slug}.creditCost readback mismatch.`);
      console.log(`[credit-reprice] ${slug}.creditCost ${from} → ${to}; readback verified (${note}).`);
    }
  }

  // 3. Cross-store guard: the legacy row must be byte-identical to before.
  const legacyAfter = await db.platformAiProvider.findUnique({ where: { id: LEGACY_ID }, select: { priceCredits: true, priceVideoDurations: true, priority: true, preferred: true, enabled: true } });
  assert.deepEqual({ ...legacyAfter, priceVideoDurations: legacyAfter.priceVideoDurations }, { priceCredits: 60, priceVideoDurations: { 15: 30, 30: 60 }, priority: 0, preferred: true, enabled: true }, "Legacy shared channel was modified; cross-store isolation broken.");

  // 4. Other sites must not reference the dedicated channel (isolation).
  if (apply) {
    const foreignJobs = await db.generationJob.count({ where: { siteId: { not: SITE }, requestJson: { path: ["providerSelection", "providerId"], equals: DEDICATED_ID } } });
    assert.equal(foreignJobs, 0, "Another site already selected the dedicated channel.");
  }

  console.log(`[credit-reprice] target=${target} ${apply ? "APPLIED" : "dry run — no writes."}`);
} finally {
  await db.$disconnect();
}
