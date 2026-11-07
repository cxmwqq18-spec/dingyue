// One-shot content patch (2026-11-07): add the Partner Program entry to the
// "Platforms & help" footer group of the aidreamcapes published navigation.
// Guarded jsonb update: the WHERE re-asserts that the group exists and does
// not already contain /partners, so a rerun or concurrent edit matches nothing.
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const applying = process.argv.includes("--apply");
const confirmed = process.argv.includes("--confirm=footer-partner-link");
if (applying) assert(confirmed, "Production content changes require --apply --confirm=footer-partner-link");

const db = new PrismaClient();
const SITE = "site_aidreamcapes";
const ITEM = { label: "Partner Program", href: "/partners" };

const rows = await db.$queryRaw`
  SELECT id,
         "contentJson"->'siteNavigation'->'footer'->'groups' AS groups
  FROM "LivePage"
  WHERE "siteId" = ${SITE} AND slug = '/'
  LIMIT 1`;
assert.equal(rows.length, 1, "home LivePage row not found");
const groups = rows[0].groups;
assert.equal(Array.isArray(groups), true, "footer groups missing");

const target = groups.findIndex((g) => g.label === "Platforms & help");
assert.ok(target >= 0, "Platforms & help group not found");
const already = groups[target].items.some((item) => item.href === "/partners");
console.log("group:", groups[target].label, "| items:", groups[target].items.length, "| /partners present:", already);
if (already) {
  console.log("nothing to do");
} else {
  const backup = { pageId: rows[0].id, path: "$.siteNavigation.footer.groups", groupLabel: groups[target].label, itemsBefore: groups[target].items };
  fs.mkdirSync("scripts/manifests", { recursive: true });
  fs.writeFileSync("scripts/manifests/footer-partner-link-20261107.json", JSON.stringify({ date: "2026-11-07", ...backup }, null, 2));
  console.log("manifest written (items before)");
  if (!applying) {
    console.log("DRY-RUN OK — rerun with --apply --confirm=footer-partner-link");
  } else {
    const before = await db.$queryRaw`SELECT "revision" FROM "SiteContentRevision" WHERE "siteId" = ${SITE} LIMIT 1`;
    const updated = await db.$executeRaw`
      UPDATE "LivePage"
      SET "contentJson" = jsonb_set(
        "contentJson",
        '{siteNavigation,footer,groups}',
        (
          SELECT jsonb_agg(CASE WHEN (g->>'label') = 'Platforms & help'
                 THEN jsonb_set(g, '{items}', (g->'items') || ${JSON.stringify([ITEM])}::jsonb)
                 ELSE g END)
          FROM jsonb_array_elements("contentJson"->'siteNavigation'->'footer'->'groups') AS g
        )
      )
      WHERE id = ${pageId()}
        AND "contentJson" @> '{"siteNavigation":{"footer":{"groups":[{"label":"Platforms & help"}]}}}'
        AND NOT "contentJson" @> '{"siteNavigation":{"footer":{"groups":[{"items":[{"href":"/partners"}]}]}}}'`;
    const after = await db.$queryRaw`SELECT "revision" FROM "SiteContentRevision" WHERE "siteId" = ${SITE} LIMIT 1`;
    console.log("updated rows:", updated, "| revision before/after:", String(before[0]?.revision), String(after[0]?.revision));
  }
}

function pageId() {
  return rows[0].id;
}

await db.$disconnect();
