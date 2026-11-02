/**
 * Aidreamcapes video-detail categorization fixes (2026-11-02, rev4 three-source
 * verified plan, see docs/video-detail-categorization-plan-20261101.md):
 *
 *   1. placement-fix  — 76 reviewed publicSlug placements are wrong per the
 *      three-source check (honest product in the picture/prompt vs the tag).
 *      Rewritten on EVERY card copy that publishes the slug and on every card
 *      copy that aliases it (detailAliasOf), because the detail page unions
 *      placement across all copies of the same media asset.
 *   2. label-fix      — 8 pages whose slug/label claims a product the picture
 *      does not show (sale-campaign-key-visual template family). Only the
 *      rendered card label gains an honest title; slugs and URLs stay.
 *   3. picker-remove  — the two app demo alias cards on the /ai-video-generation
 *      hub picker duplicate videos that are canonical on
 *      /ai-video-generation/video-ads; removing the hub copies leaves the
 *      video-ads cards as the single owning row (zero URL impact; alias cards
 *      are never detail owners and never sitemap entries).
 *   4. picker-add     — option B review decision: the 22 template demo videos
 *      (fashion-try-on-reel 11, beauty-routine 7, food-video 4) get alias
 *      reference cards on /ai-video-generation/image-to-video so the
 *      image-to-video tool page shows a fuller demo gallery. Alias cards
 *      (detailAliasOf, no publicSlug) keep the single-owner rule that the
 *      sitemap and the detail resolver require.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const here = path.dirname(fileURLToPath(import.meta.url));
const assignmentsPath = path.resolve(here, "../../docs/media-categorization-assignments-20261101.json");

function facetList(ids) {
  return ids
    .filter((id) => typeof id === "string" && id.includes("/"))
    .map((id) => `/${id}`)
    .sort();
}

function baseTargetMap() {
  const doc = JSON.parse(fs.readFileSync(assignmentsPath, "utf8"));
  assert.equal(doc.rev >= 4, true, "assignments doc must be rev4 or newer");
  const map = new Map();
  for (const entry of doc.assignments) {
    if (entry.change === "placement-fix" && entry.placement_after?.length) {
      map.set(entry.slug, facetList(entry.placement_after));
    }
  }
  // Rounds 1-4 corrections but with the occasions context explicitly
  // re-checked against the picture: this page's bag visual has no holiday
  // element, so holidays must be dropped here (gift box slug is misleading).
  map.set("gift-box-ready-for-a-black-friday-offer", [
    "/industries/jewelry-accessories",
    "/occasions/black-friday",
    "/occasions/sale-discount"
  ]);
  return map;
}

/** Every reviewed placement fix: slug -> exact sorted placement[] after state. */
export const PLACEMENT_FIXES = baseTargetMap();

/**
 * Reviewed honest labels for the 8 sale-wall pages whose slug is made up.
 * Rendered titles change; slugs, routes and aliases stay untouched.
 */
export const LABEL_FIXES = new Map([
  ["lunch-box-on-the-last-day", "Navy Baseball Cap on Wooden Table"],
  ["suitcase-with-room-for-the-offer", "White Leather Sneaker Studio"],
  ["tote-with-space-for-the-offer", "Beige Knit Top Studio Portrait"],
  ["wallet-unboxing-with-offer-space", "White Sneakers With Denim, On-Foot"],
  ["cardigan-ready-for-season-end", "Cream Wool Coat Street Look"],
  ["sandals-tried-on-at-the-market", "White Sneaker on Green Backdrop"],
  ["running-shoes-before-the-jog", "Navy Baseball Cap, White Studio"],
  ["gift-box-ready-for-a-black-friday-offer", "Brown Leather Duffel"]
]);

/**
 * Hub picker alias cards that duplicate videos owned by video-ads: removal is
 * keyed by (detailAliasOf + kind video + has video) on this page only.
 */
export const TOOL_UNIQUENESS = {
  hubPage: "/ai-video-generation",
  aliasTargets: ["lifestyle-app-recommendation", "streamer-reaction-app"]
};

/**
 * Option B review decision: alias reference cards for every template demo video
 * that publishes a publicSlug on these three demo pages.
 */
export const TEMPLATE_REFERENCE_ADDITIONS = {
  targetPage: "/ai-video-generation/image-to-video",
  sourcePages: [
    "/ai-video-generation/fashion-try-on-reel",
    "/ai-video-generation/beauty-routine",
    "/ai-video-generation/food-video"
  ]
};
