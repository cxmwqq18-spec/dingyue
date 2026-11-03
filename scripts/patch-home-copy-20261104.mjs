// One-shot production content patch (2026-11-04): home page copy fixes.
//  1. seo.title brand spelling: "AivideosUGC" -> "AIVideosUGC"
//  2. drop the footer partnerBadges entry whose external badge image is
//     stripped by the content source policy, rendering an empty <img src="">.
// Guarded UPDATEs: the WHERE clauses re-assert the preconditions, so a row
// that changed underneath simply matches nothing instead of corrupting data.
// Backup manifest: scripts/manifests/home-copy-fix-20261104.json
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const applying = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm=home-copy-fix-20261104");
if (applying) assert(confirmed, "Production content changes require --apply --confirm=home-copy-fix-20261104");

const db = new PrismaClient();
const pageId = "site_aidreamcapes_home";
const CORRECT_TITLE = "AI UGC Video and Image Ads Generator | AIVideosUGC";

const rows = await db.$queryRaw`
  SELECT id, "contentJson"->'seo'->>'title' AS title,
         "contentJson"->'siteNavigation'->'footer'->'partnerBadges' AS badges
  FROM "LivePage" WHERE id = ${pageId} LIMIT 1`;
assert.equal(rows.length, 1, "home LivePage row not found");
const { title, badges } = rows[0];
console.log("before:", JSON.stringify({ title, badges }));

assert.equal(typeof title, "string", "seo.title is not a string");
if (!String(title).includes("AivideosUGC")) throw new Error("title precondition failed: no misspelled brand to fix");

const manifest = {
  date: "2026-11-04",
  pageId,
  changes: [{ path: "$.seo.title", from: title, to: CORRECT_TITLE }],
  removed: badges ? [{ path: "$.siteNavigation.footer.partnerBadges", value: badges }] : [],
};
fs.mkdirSync("scripts/manifests", { recursive: true });
fs.writeFileSync("scripts/manifests/home-copy-fix-20261104.json", JSON.stringify(manifest, null, 2));
console.log("manifest written (backup of original values)");

if (!applying) {
  console.log("DRY-RUN OK — rerun with --apply --confirm=home-copy-fix-20261104");
} else {
  const before = await db.$queryRaw`SELECT "revision" FROM "SiteContentRevision" WHERE "siteId" = 'site_aidreamcapes' LIMIT 1`;
  const titleUpdate = await db.$executeRaw`
    UPDATE "LivePage"
    SET "contentJson" = jsonb_set("contentJson", '{seo,title}', ${JSON.stringify(CORRECT_TITLE)}::jsonb)
    WHERE id = ${pageId} AND "contentJson"->'seo'->>'title' LIKE '%AivideosUGC%'`;
  const badgeUpdate = badges && badges[0]?.key === "semilaunch"
    ? await db.$executeRaw`
      UPDATE "LivePage"
      SET "contentJson" = "contentJson" #- '{siteNavigation,footer,partnerBadges,0}'
      WHERE id = ${pageId}
        AND "contentJson"->'siteNavigation'->'footer'->'partnerBadges'->0->>'key' = 'semilaunch'`
    : 0;
  const after = await db.$queryRaw`SELECT "revision" FROM "SiteContentRevision" WHERE "siteId" = 'site_aidreamcapes' LIMIT 1`;
  const check = await db.$queryRaw`
    SELECT "contentJson"->'seo'->>'title' AS title,
           "contentJson"->'siteNavigation'->'footer'->'partnerBadges' AS badges
    FROM "LivePage" WHERE id = ${pageId} LIMIT 1`;
  console.log("titleUpdate rows:", titleUpdate, "| badgeUpdate rows:", badgeUpdate);
  console.log("revision before/after:", JSON.stringify(before), JSON.stringify(after));
  console.log("after:", JSON.stringify(check[0]));
}

await db.$disconnect();
