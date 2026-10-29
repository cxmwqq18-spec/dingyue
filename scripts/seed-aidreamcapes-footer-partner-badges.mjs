// Seed the Aidreamcapes homepage LivePage with the current footer friend-link
// badges (友链徽章) so the data-driven footer renders immediately after the
// feature ships. Mirrors the guarded write pattern of
// migrate-aidreamcapes-footer-social-links.mjs.
//
//   node scripts/seed-aidreamcapes-footer-partner-badges.mjs            (plan only)
//   node scripts/seed-aidreamcapes-footer-partner-badges.mjs --apply \
//     --confirm=site_aidreamcapes-footer-partner-badges
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";

const SITE_ID = "site_aidreamcapes";
const HOME_PAGE_ID = "site_aidreamcapes_home";
const CONFIRMATION = "site_aidreamcapes-footer-partner-badges";
const BADGES = [
  {
    key: "semilaunch",
    label: "SemiLaunch",
    href: "https://semilaunch.com",
    imageUrl: "https://semilaunch.com/assets/badge.png",
    imageHeight: 40
  }
];

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
if (apply) assert(args.has(`--confirm=${CONFIRMATION}`), `Add --confirm=${CONFIRMATION} to apply.`);

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hash(value) {
  return createHash("sha256").update(stable(value)).digest("hex");
}

function navigationWithoutPartnerBadges(contentJson) {
  const copy = structuredClone(contentJson);
  const navigation = copy?.siteNavigation;
  if (navigation?.footer) delete navigation.footer.partnerBadges;
  return copy;
}

const db = new PrismaClient();
try {
  const home = await db.livePage.findUnique({
    where: { id: HOME_PAGE_ID },
    select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
  });
  assert(home && home.siteId === SITE_ID && home.slug === "/", "Aidreamcapes home LivePage was not found.");

  const priorNavigation = home.contentJson?.siteNavigation;
  assert(priorNavigation?.footer && Array.isArray(priorNavigation.footer.groups), "Current home LivePage navigation footer is malformed.");
  const priorBadges = priorNavigation.footer.partnerBadges;
  if (Array.isArray(priorBadges) && priorBadges.length > 0) {
    assert.deepEqual(priorBadges, BADGES, "The current LivePage already has partner badges; refusing to overwrite online edits.");
    console.log(JSON.stringify({ result: "already-seeded", badges: priorBadges.length }, null, 2));
    process.exit(0);
  }

  const beforeHash = hash(navigationWithoutPartnerBadges(home.contentJson));
  const updatedContent = structuredClone(home.contentJson);
  updatedContent.siteNavigation.footer.partnerBadges = BADGES;
  const plan = {
    target: "production",
    siteId: SITE_ID,
    owner: `LivePage:${HOME_PAGE_ID}`,
    publicPath: home.slug,
    targetField: "contentJson.siteNavigation.footer.partnerBadges",
    targetUpdatedAt: home.updatedAt,
    badges: BADGES,
    nonTargetContentHash: beforeHash,
    mode: apply ? "apply" : "plan-only"
  };
  console.log(JSON.stringify(plan, null, 2));
  if (apply) {
    const result = await db.livePage.updateMany({
      where: { id: HOME_PAGE_ID, siteId: SITE_ID, slug: "/", updatedAt: home.updatedAt },
      data: { contentJson: updatedContent }
    });
    assert.equal(result.count, 1, "LivePage changed during seeding; no update was applied.");

    const readback = await db.livePage.findUnique({
      where: { id: HOME_PAGE_ID },
      select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
    });
    assert.deepEqual(readback.contentJson?.siteNavigation?.footer?.partnerBadges, BADGES, "LivePage partner badge readback failed.");
    assert.equal(hash(navigationWithoutPartnerBadges(readback.contentJson)), beforeHash, "A non-target LivePage field changed.");
    console.log(JSON.stringify({ result: "applied-and-read-back", siteId: readback.siteId, livePageId: readback.id, publicPath: readback.slug, updatedAt: readback.updatedAt, badgeCount: BADGES.length, nonTargetContentUnchanged: true }, null, 2));
  }
} finally {
  await db.$disconnect();
}
