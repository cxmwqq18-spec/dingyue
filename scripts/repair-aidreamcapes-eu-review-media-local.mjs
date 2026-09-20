#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import { assertAidreamcapesEuHomepageIntegrity } from "./lib/aidreamcapes-eu-homepage-integrity.mjs";

const siteId = "site_aidreamcapes_xby";
const siteSlug = "aidreamcapes-eu";
const homeSlug = "/";
const assetPrefix = "/assets/sites/site_aidreamcapes_eu/";
const assetVersion = "20260919eureviewheadshot1";
const expectedConfirmation = "aidreamcapes-eu-review-media-repair";
const backupRoot = path.resolve(".tmp", "aidreamcapes-eu-review-media-repair");

const reviewHeadshots = {
  review_ava: { shortId: "ava", altText: "Portrait d’Ava M. utilisé comme avatar de l’avis client" },
  review_lucas: { shortId: "lucas", altText: "Portrait de Lucas R. utilisé comme avatar de l’avis client" },
  review_mia: { shortId: "mia", altText: "Portrait de Mia C. utilisé comme avatar de l’avis client" },
  review_noah: { shortId: "noah", altText: "Portrait de Noah P. utilisé comme avatar de l’avis client" },
  review_chloe: { shortId: "chloe", altText: "Portrait de Chloe S. utilisé comme avatar de l’avis client" },
  review_eli: { shortId: "eli", altText: "Portrait d’Eli T. utilisé comme avatar de l’avis client" },
  review_jordan: { shortId: "jordan", altText: "Portrait de Jordan K. utilisé comme avatar de l’avis client" },
  review_riley: { shortId: "riley", altText: "Portrait de Riley W. utilisé comme avatar de l’avis client" }
};

const args = parseArgs(process.argv.slice(2));
const applyMode = args.apply === true || String(args.mode || "").toLowerCase() === "apply";

function parseArgs(list) {
  const result = {};
  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    if (!item.startsWith("--")) continue;
    const raw = item.slice(2);
    const equals = raw.indexOf("=");
    const key = raw.slice(0, equals >= 0 ? equals : undefined).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (equals >= 0) result[key] = raw.slice(equals + 1);
    else {
      const next = list[index + 1];
      if (!next || next.startsWith("--")) result[key] = true;
      else { result[key] = next; index += 1; }
    }
  }
  return result;
}

function stripQuery(value) {
  return String(value || "").split(/[?#]/)[0];
}

function cloneJson(value) {
  return structuredClone(value);
}

function avatarUrl(shortId) {
  return `${assetPrefix}generated/public-media/reviews/review-${shortId}-headshot.webp?v=${assetVersion}`;
}

function localPathForUrl(url) {
  const pathname = stripQuery(url);
  assert(pathname.startsWith(assetPrefix), `Expected a local EU asset URL, received ${url}`);
  const publicRoot = path.resolve("public");
  const filePath = path.resolve(publicRoot, pathname.slice(1));
  assert(filePath.startsWith(`${publicRoot}${path.sep}`), `Asset escaped public root: ${url}`);
  return filePath;
}

function storageKeyForUrl(url) {
  return stripQuery(url).replace(/^\/assets\//, "");
}

function proofBlocks(json) {
  return Array.isArray(json?.sections?.proof_1?.blocks) ? json.sections.proof_1.blocks : [];
}

function updateHomeJson(json, beforeById) {
  const next = cloneJson(json);
  const blocks = proofBlocks(next);
  for (const block of blocks) {
    const identity = reviewHeadshots[block.id];
    if (!identity) continue;
    assert(block.settings && typeof block.settings === "object", `${block.id}: missing review settings.`);
    assert(typeof block.settings.resultImageUrl === "string" && block.settings.resultImageUrl, `${block.id}: missing themed result image.`);
    beforeById[block.id] ??= block.settings.resultImageUrl;
    block.settings.avatarUrl = avatarUrl(identity.shortId);
  }
  return next;
}

async function validateAssets() {
  const rows = [];
  for (const [id, identity] of Object.entries(reviewHeadshots)) {
    const url = avatarUrl(identity.shortId);
    const filePath = localPathForUrl(url);
    assert(fs.existsSync(filePath), `${id}: missing headshot file ${filePath}`);
    const metadata = await sharp(filePath).metadata();
    assert.equal(metadata.width, 640, `${id}: headshot width must be 640.`);
    assert.equal(metadata.height, 640, `${id}: headshot height must be 640.`);
    rows.push({ id, url, filePath, storageKey: storageKeyForUrl(url) });
  }
  return rows;
}

function reviewParity(json, expectedResults = {}) {
  return proofBlocks(json)
    .filter((block) => reviewHeadshots[block.id])
    .map((block) => ({
      id: block.id,
      avatarUrl: block.settings?.avatarUrl,
      resultImageUrl: block.settings?.resultImageUrl,
      expectedAvatarUrl: avatarUrl(reviewHeadshots[block.id].shortId),
      resultUnchanged: expectedResults[block.id] === block.settings?.resultImageUrl,
      valid: block.settings?.avatarUrl === avatarUrl(reviewHeadshots[block.id].shortId)
        && expectedResults[block.id] === block.settings?.resultImageUrl
        && stripQuery(block.settings?.avatarUrl) !== stripQuery(block.settings?.resultImageUrl)
    }));
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (applyMode) {
    assert.equal(String(args.confirm || ""), expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
    assertNonProductionWriteTarget();
  }

  const assetRows = await validateAssets();
  const prisma = new PrismaClient();
  try {
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { id: true, slug: true, primaryDomain: true } });
    assert.deepEqual(site, { id: siteId, slug: siteSlug, primaryDomain: "aidreamcapes.eu" }, "Target site identity check failed.");

    const [livePage, themePage] = await Promise.all([
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId, slug: homeSlug } } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId, slug: homeSlug } } })
    ]);
    assert(livePage, "EU live homepage is missing.");
    assert(themePage, "EU theme homepage is missing.");

    const beforeResults = {};
    const nextLiveJson = updateHomeJson(livePage.contentJson, beforeResults);
    const nextThemeDraft = updateHomeJson(themePage.draftJson, beforeResults);
    const nextThemePublished = updateHomeJson(themePage.publishedJson, beforeResults);
    const beforeParity = reviewParity(livePage.contentJson, beforeResults);
    assert.equal(beforeParity.length, Object.keys(reviewHeadshots).length, "Live homepage does not contain all expected reviews.");
    const nextParity = reviewParity(nextLiveJson, beforeResults);
    assert.equal(nextParity.length, Object.keys(reviewHeadshots).length, "Updated live homepage does not contain all expected reviews.");
    assert(nextParity.every((item) => item.valid), "Review identity/result parity failed before apply.");

    const existingAssets = await prisma.mediaAsset.findMany({
      where: { siteId, storageKey: { in: assetRows.map((row) => row.storageKey) } },
      select: { id: true, storageKey: true, label: true, altText: true, previewUrl: true, originUrl: true }
    });
    const summary = {
      ok: true,
      mode: applyMode ? "apply" : "dry-run",
      target: { siteId, siteSlug, domain: site.primaryDomain },
      reviews: nextParity.length,
      independentHeadshots: assetRows.map(({ id, url }) => ({ id, url })),
      existingMediaAssets: existingAssets.length,
      resultImagesPreserved: nextParity.every((item) => item.resultUnchanged),
      allAvatarResultFilesDiffer: nextParity.every((item) => stripQuery(item.avatarUrl) !== stripQuery(item.resultImageUrl))
    };

    if (!applyMode) {
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    const backupPath = path.join(backupRoot, `${new Date().toISOString().replace(/[:.]/g, "-")}-backup.json`);
    fs.mkdirSync(backupRoot, { recursive: true });
    fs.writeFileSync(backupPath, `${JSON.stringify({
      createdAt: new Date().toISOString(),
      target: { siteId, siteSlug, database: "local" },
      livePage: { id: livePage.id, contentJson: livePage.contentJson },
      themePage: { id: themePage.id, draftJson: themePage.draftJson, publishedJson: themePage.publishedJson },
      mediaAssets: existingAssets
    }, null, 2)}\n`);

    await prisma.$transaction(async (tx) => {
      await tx.livePage.update({ where: { id: livePage.id }, data: { contentJson: nextLiveJson } });
      await tx.themePage.update({ where: { id: themePage.id }, data: { draftJson: nextThemeDraft, publishedJson: nextThemePublished } });
      for (const [id, identity] of Object.entries(reviewHeadshots)) {
        const url = avatarUrl(identity.shortId);
        const storageKey = storageKeyForUrl(url);
        const mediaId = `media_${siteId}_review_${identity.shortId}_headshot`;
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId, storageKey } },
          create: {
            id: mediaId,
            siteId,
            label: `${id} identity headshot`,
            storageKey,
            mimeType: "image/webp",
            usageType: "theme",
            sourceType: "aidreamcapes-eu-review-identity-headshot",
            previewUrl: url,
            originUrl: url,
            altText: identity.altText
          },
          update: {
            label: `${id} identity headshot`,
            mimeType: "image/webp",
            usageType: "theme",
            sourceType: "aidreamcapes-eu-review-identity-headshot",
            previewUrl: url,
            originUrl: url,
            altText: identity.altText
          }
        });
      }
      await assertAidreamcapesEuHomepageIntegrity(tx);
    }, { timeout: 30_000, maxWait: 10_000 });

    const [liveAfter, themeAfter] = await Promise.all([
      prisma.livePage.findUnique({ where: { id: livePage.id }, select: { contentJson: true } }),
      prisma.themePage.findUnique({ where: { id: themePage.id }, select: { draftJson: true, publishedJson: true } })
    ]);
    const readback = {
      live: reviewParity(liveAfter.contentJson, beforeResults),
      themeDraft: reviewParity(themeAfter.draftJson, beforeResults),
      themePublished: reviewParity(themeAfter.publishedJson, beforeResults)
    };
    assert(readback.live.every((item) => item.valid), "Live homepage readback parity failed.");
    assert(readback.themeDraft.every((item) => item.valid), "Theme draft readback parity failed.");
    assert(readback.themePublished.every((item) => item.valid), "Theme published readback parity failed.");
    console.log(JSON.stringify({ ...summary, appliedAt: new Date().toISOString(), backupPath, readback }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
