#!/usr/bin/env node
// AIVideosUGC content alignment apply — 2026-11-19 (from the storefront
// review of the same date). Four field-level repairs on current relational
// LivePage rows for site_aidreamcapes only; no snapshot import, no
// cross-store writes:
//   1. /guides/how-do-ai-image — the step text asks shoppers to call out a
//      mug "handle" the source photo does not show. The wording drops the
//      handle in both the visible step and the HowTo JSON-LD node.
//   2. / — three stored alts contain production-direction words ("camera",
//      "close-up") that the meaningful-alt filter blanks to alt=""; they are
//      rewritten to descriptive alt text that survives the filter.
//   3. /ai-video-generation/video-ads — the retired, image-only
//      creator-recommends-a-phone-app address (still indexed, its page claims
//      a 15s video it does not carry) becomes a publicAliases claim on the
//      lifestyle-app-recommendation card, the page built from the same
//      reference image that does carry the finished video. The old address
//      then 308s to that live page (single hop to 200).
//   4. /ai-image-generation/sale-campaign-key-visual — the crossed images on
//      the sale template cards swap back: the suitcase address shows the
//      suitcase scene, and the Sale Banner example shows the banner-layout
//      product photo with space for the offer.
//   dry run:  node scripts/apply-aivideosugc-content-alignment-2026-11-19.mjs --target=local
//   apply:   node scripts/apply-aivideosugc-content-alignment-2026-11-19.mjs --target=local --apply
//   production apply additionally requires the explicit confirm name and the
//   base hashes from a fresh production dry run.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-content-alignment-2026-11-19";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-content-alignment-2026-11-19.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") {
  assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);
}

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

/** Replace every exact string occurrence of `from` with `to`, walking plain
 * JSON. Returns the replacement count. */
function replaceExactStrings(value, from, to) {
  let count = 0;
  function walk(node) {
    if (typeof node === "string") {
      if (node === from) {
        count += 1;
        return to;
      }
      return node;
    }
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      for (const key of Object.keys(node)) node[key] = walk(node[key]);
      return node;
    }
    return node;
  }
  walk(value);
  return count;
}

/** Collect every publicAliases array entry across a contentJson object. */
function collectPublicAliases(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectPublicAliases(item, out);
    return out;
  }
  if (value && typeof value === "object") {
    for (const key of Object.keys(value)) {
      if (key === "publicAliases" && Array.isArray(value[key])) out.push(...value[key].filter((entry) => typeof entry === "string"));
      else collectPublicAliases(value[key], out);
    }
  }
  return out;
}

const db = new PrismaClient();
try {
  const rowSlugs = [
    manifest.guideHandleWording.slug,
    manifest.homeAltRewrites.slug,
    manifest.phoneAppAlias.ownerRowSlug,
    manifest.phoneAppAlias.removedCardOwnerRowSlug,
    manifest.saleCardImageSwap.ownerRowSlug
  ];
  const rows = await db.livePage.findMany({
    where: { siteId, slug: { in: rowSlugs } },
    select: { id: true, siteId: true, slug: true, contentJson: true, updatedAt: true }
  });
  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  for (const slug of rowSlugs) assert(bySlug.has(slug), `LivePage ${slug} does not exist on ${target}.`);

  const plans = {};
  const removedCards = [];

  // --- 1. Guide handle wording (visible step + HowTo JSON-LD) ---
  {
    const spec = manifest.guideHandleWording;
    const row = bySlug.get(spec.slug);
    if (argumentValue("--base-hash-guide")) {
      assert.equal(hash(row.contentJson), argumentValue("--base-hash-guide"), `${spec.slug} changed since the reviewed dry run; refusing to apply.`);
    }
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const replaced = replaceExactStrings(contentJson, spec.before, spec.after);
    if (replaced === 0) {
      assert(JSON.stringify(contentJson).includes(spec.after), "Guide wording in an unexpected state; neither before nor after copy present.");
      console.log(`[content-alignment] ${spec.slug}: handle wording already fixed; idempotent re-run.`);
    } else {
      assert(replaced >= 2, `Expected the handle wording in both the visible step and the HowTo JSON-LD; found ${replaced} exact occurrence(s) on ${target}. Inspect the row before applying.`);
      assert(!JSON.stringify(contentJson).includes("lid shape, and handle"), "Handle wording still present after replacement.");
      console.log(`[content-alignment] ${spec.slug}: handle wording replaced in ${replaced} location(s).`);
      plans[spec.slug] = contentJson;
    }
  }

  // --- 2. Homepage alt rewrites ---
  {
    const spec = manifest.homeAltRewrites;
    const row = bySlug.get(spec.slug);
    if (argumentValue("--base-hash-home")) {
      assert.equal(hash(row.contentJson), argumentValue("--base-hash-home"), `${spec.slug} changed since the reviewed dry run; refusing to apply.`);
    }
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    let anyAltRewritten = false;
    for (const item of spec.items) {
      const replaced = replaceExactStrings(contentJson, item.before, item.after);
      if (replaced === 0) {
        assert(JSON.stringify(contentJson).includes(item.after), `Alt for "${item.before.slice(0, 48)}…" in an unexpected state; neither before nor after copy present.`);
        console.log(`[content-alignment] ${spec.slug}: alt already rewritten -> "${item.after.slice(0, 56)}…"`);
        continue;
      }
      assert.equal(replaced, item.expectedOccurrences, `Alt rewrite for "${item.before.slice(0, 48)}…" matched ${replaced} occurrence(s); expected ${item.expectedOccurrences}. Inspect the row before applying.`);
      console.log(`[content-alignment] ${spec.slug}: alt rewritten in ${replaced} location(s) -> "${item.after.slice(0, 56)}…"`);
      anyAltRewritten = true;
    }
    assert(!JSON.stringify(contentJson).includes("holds up a fresh loaf to the camera"), "The bakery alt rewrite did not land.");
    assert(!JSON.stringify(contentJson).includes("explains it to the camera"), "The app-screen alt rewrite did not land.");
    assert(!JSON.stringify(contentJson).includes("Close-up of green wireless earbuds"), "The earbuds alt rewrite did not land.");
    if (anyAltRewritten) plans[spec.slug] = contentJson;
  }

  // --- 3. Phone-app retired address -> alias claim on the live target card ---
  {
    const spec = manifest.phoneAppAlias;
    const row = bySlug.get(spec.ownerRowSlug);
    if (argumentValue("--base-hash-videoads")) {
      assert.equal(hash(row.contentJson), argumentValue("--base-hash-videoads"), `${spec.ownerRowSlug} changed since the reviewed dry run; refusing to apply.`);
    }
    // Single-claimant guarantee: no row other than the target may declare
    // this alias, and after this change the target must be the only row
    // mentioning the slug (card removal below).
    const allRows = await db.livePage.findMany({ where: { siteId }, select: { slug: true, contentJson: true } });
    for (const other of allRows) {
      const aliases = collectPublicAliases(other.contentJson, []);
      if (other.slug === spec.ownerRowSlug) {
        assert(!aliases.filter((value) => value === spec.alias && aliases.indexOf(value) !== aliases.lastIndexOf(value)).length, "Double alias entry on the target row.");
      } else {
        assert(!aliases.includes(spec.alias), `Row ${other.slug} also claims ${spec.alias}; refusing a double claim.`);
      }
    }
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    let targetCard = null;
    let claimCount = 0;
    function walkCards(node) {
      if (Array.isArray(node)) {
        for (const item of node) walkCards(item);
        return;
      }
      if (node && typeof node === "object") {
        if (node.publicSlug === spec.targetCardSlug && Array.isArray(node.publicAliases)) {
          targetCard = node;
          claimCount += 1;
        }
        for (const key of Object.keys(node)) walkCards(node[key]);
      }
    }
    walkCards(contentJson);
    assert.equal(claimCount, 1, `Expected exactly one ${spec.targetCardSlug} card with a publicAliases array on ${spec.ownerRowSlug}; found ${claimCount}.`);
    assert(!targetCard.detailAliasOf, "The alias target must own its own detail page.");
    const aliasAlreadyPresent = targetCard.publicAliases.includes(spec.alias);
    if (!aliasAlreadyPresent) {
      targetCard.publicAliases.push(spec.alias);
      plans[spec.ownerRowSlug] = contentJson;
      console.log(`[content-alignment] ${spec.ownerRowSlug}: ${spec.retiredPath} -> /ai-video-generation/${spec.targetCardSlug} alias registered (single claim).`);
    } else {
      console.log(`[content-alignment] ${spec.ownerRowSlug}: alias ${spec.alias} already present; idempotent re-run.`);
    }

    // The shortcut card that still owns the retired slug leaves its row in
    // the same change; otherwise pagesOwningSlug finds two rows and the
    // resolution fails closed to a 404 instead of following the alias.
    const orgRow = bySlug.get(spec.removedCardOwnerRowSlug);
    if (argumentValue("--base-hash-homeorg")) {
      assert.equal(hash(orgRow.contentJson), argumentValue("--base-hash-homeorg"), `${spec.removedCardOwnerRowSlug} changed since the reviewed dry run; refusing to apply.`);
    }
    const orgJson = JSON.parse(JSON.stringify(orgRow.contentJson));
    const orgData = orgJson.sections?.v2_main?.settings?.data;
    assert(Array.isArray(orgData?.workspaceCases), "workspaceCases missing on the removed-card owner row.");
    const caseIndex = orgData.workspaceCases.findIndex((card) => card?.publicSlug === spec.alias);
    if (caseIndex >= 0) {
      const removedCard = orgData.workspaceCases.splice(caseIndex, 1)[0];
      assert(removedCard?.detailAliasOf === spec.targetCardSlug, `The removed card's detailAliasOf is ${JSON.stringify(removedCard?.detailAliasOf)}; expected the alias target. Wrong card.`);
      removedCards.push({ slug: spec.removedCardOwnerRowSlug, jsonPath: `sections.v2_main.settings.data.workspaceCases[${caseIndex}]`, card: removedCard });
      assert(!JSON.stringify(orgData.workspaceCases).includes(`"publicSlug":"${spec.alias}"`), "Another card still owns the retired slug on this row.");
      plans[spec.removedCardOwnerRowSlug] = orgJson;
      console.log(`[content-alignment] ${spec.removedCardOwnerRowSlug}: image-only shortcut card removed from workspaceCases (captured for restore).`);
    } else {
      assert(!JSON.stringify(orgData.workspaceCases).includes(`"publicSlug":"${spec.alias}"`), "The retired slug is still owned by an unexpected card shape.");
      console.log(`[content-alignment] ${spec.removedCardOwnerRowSlug}: shortcut card already absent; idempotent re-run.`);
    }
    if (aliasAlreadyPresent && caseIndex < 0) delete plans[spec.ownerRowSlug];
  }

  // --- 4. Sale template card image swap ---
  {
    const spec = manifest.saleCardImageSwap;
    const row = bySlug.get(spec.ownerRowSlug);
    if (argumentValue("--base-hash-salekv")) {
      assert.equal(hash(row.contentJson), argumentValue("--base-hash-salekv"), `${spec.ownerRowSlug} changed since the reviewed dry run; refusing to apply.`);
    }
    const contentJson = JSON.parse(JSON.stringify(row.contentJson));
    const data = contentJson.sections?.v2_main?.settings?.data;
    assert(data, "Sale template data shape changed.");
    const suitcaseCard = (data.examples?.groups ?? []).flatMap((group) => group.items ?? []).find((item) => item?.publicSlug === spec.suitcaseCard.publicSlug);
    assert(suitcaseCard, "Suitcase card missing from the examples groups.");
    const suitcaseAlreadySwapped = suitcaseCard.image?.src === spec.suitcaseCard.afterImage.src;
    // Categorization-era rows carry the rendered name in `label`; older local
    // rows carry it in `title`. Both shapes are accepted and both are written.
    const suitcaseTitleField = typeof suitcaseCard.title === "string" ? "title" : typeof suitcaseCard.label === "string" ? "label" : undefined;
    assert(suitcaseTitleField, "Suitcase card has neither a title nor a label field; unexpected card shape.");
    if (suitcaseAlreadySwapped) {
      assert((suitcaseCard.title ?? suitcaseCard.label) === spec.suitcaseCard.titleAfter, `Suitcase card name is ${JSON.stringify(suitcaseCard.title ?? suitcaseCard.label)} after a swap; unexpected.`);
      console.log("[content-alignment] sale template: suitcase card already swapped; idempotent re-run.");
    } else {
      assert(suitcaseCard.image?.src === spec.suitcaseCard.beforeImageSrc, `Suitcase card image is ${JSON.stringify(suitcaseCard.image?.src)}; expected the crossed sneaker photo. Re-run the dry run against this target.`);
      assert(spec.suitcaseCard.acceptedTitles.includes(suitcaseCard.title ?? suitcaseCard.label), `Suitcase card name is ${JSON.stringify(suitcaseCard.title ?? suitcaseCard.label)}; unexpected state. Re-run the dry run.`);
      suitcaseCard.image = { ...suitcaseCard.image, ...spec.suitcaseCard.afterImage };
      suitcaseCard[suitcaseTitleField] = spec.suitcaseCard.titleAfter;
      if (typeof suitcaseCard.mediaRef === "string") suitcaseCard.mediaRef = spec.suitcaseCard.afterMediaRef;
    }

    let saleBannerClaims = 0;
    let saleBannerAlreadySwapped = 0;
    function walkSaleBanner(node) {
      if (Array.isArray(node)) {
        for (const item of node) walkSaleBanner(item);
        return;
      }
      if (node && typeof node === "object") {
        if (node.publicSlug === spec.saleBannerCard.publicSlug) {
          if (node.image?.src === spec.saleBannerCard.afterImage.src) {
            saleBannerAlreadySwapped += 1;
          } else {
            assert(node.image?.src === spec.saleBannerCard.beforeImageSrc, `Sale Banner card image is ${JSON.stringify(node.image?.src)}; expected the crossed suitcase scene. Re-run the dry run against this target.`);
            node.image = { ...node.image, ...spec.saleBannerCard.afterImage };
          }
          saleBannerClaims += 1;
        }
        for (const key of Object.keys(node)) walkSaleBanner(node[key]);
      }
    }
    walkSaleBanner(data);
    assert.equal(saleBannerClaims, 2, `Expected both Sale Banner card copies (picker + templateDefinition) to be present; found ${saleBannerClaims}.`);
    assert(suitcaseCard.image.src === spec.suitcaseCard.afterImage.src, "The suitcase card must carry the suitcase scene after the swap.");
    if (suitcaseAlreadySwapped && saleBannerAlreadySwapped === 2) {
      console.log("[content-alignment] sale template: both cards already swapped; idempotent re-run.");
    } else {
      plans[spec.ownerRowSlug] = contentJson;
      console.log("[content-alignment] sale template: suitcase address now shows the suitcase scene; Sale Banner now shows the banner layout.");
    }
  }

  console.log(`[content-alignment] target=${target} site=${siteId}`);
  for (const [slug, contentJson] of Object.entries(plans)) {
    console.log(`[content-alignment] ${slug} base-hash=${hash(bySlug.get(slug).contentJson)} next-hash=${hash(contentJson)}`);
  }
  if (removedCards.length) {
    const removedPath = new URL("./manifests/aivideosugc-content-alignment-2026-11-19-removed.json", import.meta.url);
    console.log(`[content-alignment] removed cards captured for restore (${removedCards.length}):`);
    for (const entry of removedCards) console.log(`[content-alignment]   ${entry.slug} ${entry.jsonPath}`);
    if (apply) {
      fs.writeFileSync(removedPath, JSON.stringify({ siteId, removedAt: new Date().toISOString(), removedCards }, null, 2));
      console.log(`[content-alignment] wrote ${removedPath.pathname}`);
    }
  }
  if (!apply) {
    console.log("[content-alignment] dry run — no writes.");
    console.log("[content-alignment] production apply:");
    console.log("[content-alignment]   --apply --confirm=aivideosugc-content-alignment-2026-11-19 --base-hash-guide=<h> --base-hash-home=<h> --base-hash-videoads=<h> --base-hash-homeorg=<h> --base-hash-salekv=<h>");
  } else {
    for (const [slug, contentJson] of Object.entries(plans)) {
      const row = bySlug.get(slug);
      await db.livePage.update({ where: { id: row.id }, data: { contentJson } });
      const readback = await db.livePage.findUnique({ where: { id: row.id }, select: { contentJson: true, updatedAt: true } });
      assert.equal(hash(readback.contentJson), hash(contentJson), `Readback hash mismatch on ${slug}.`);
      console.log(`[content-alignment] applied ${slug}; readback verified; updatedAt=${readback.updatedAt.toISOString()}`);
    }
    // Readback spot checks mirroring the change contract.
    const guideData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.guideHandleWording.slug }, select: { contentJson: true } })).contentJson;
    assert(!JSON.stringify(guideData).includes("lid shape, and handle"), "Readback: handle wording still present in the guide.");
    const saleData = (await db.livePage.findFirst({ where: { siteId, slug: manifest.saleCardImageSwap.ownerRowSlug }, select: { contentJson: true } })).contentJson.sections.v2_main.settings.data;
    const suitcaseReadback = saleData.examples.groups.flatMap((group) => group.items ?? []).find((item) => item?.publicSlug === manifest.saleCardImageSwap.suitcaseCard.publicSlug);
    assert(suitcaseReadback.image.src === manifest.saleCardImageSwap.suitcaseCard.afterImage.src, "Readback: suitcase card image not swapped.");
    console.log("[content-alignment] readback verified on all rows.");
  }
} finally {
  await db.$disconnect();
}
