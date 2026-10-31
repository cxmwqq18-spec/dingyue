// Repoints LivePage rows at the slug-named actor portraits produced by
// scripts/rename-aivideosugc-actor-portraits.mjs. Reads the URL pair manifest
// that script wrote, string-replaces every occurrence in each row's
// contentJson (src, srcSet and any other field carrying the portrait URLs),
// backs up every touched row, then updates it. Idempotent: rows already using
// the new URLs are skipped.
//
// Usage (dry run by default; --apply writes):
//   DATABASE_URL=... node apply-aivideosugc-actor-portrait-urls.mjs <pairs.json> [--apply]

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const pairsFile = process.argv[2];
if (!pairsFile || !fs.existsSync(pairsFile)) {
  console.error("usage: node apply-aivideosugc-actor-portrait-urls.mjs <pairs.json> [--apply]");
  process.exit(1);
}
const SITE_ID = "site_aidreamcapes";
const { pairs } = JSON.parse(fs.readFileSync(pairsFile, "utf8"));
if (!pairs?.length) throw new Error("no pairs in the manifest");
// The longest "from" first so no pair is shadowed by a prefix of another.
const ordered = [...pairs].sort((left, right) => right.from.length - left.from.length);
console.log(`url pairs: ${ordered.length}`);

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw`
  SELECT "id", "slug", "contentJson"::text AS json
  FROM "LivePage"
  WHERE "siteId" = ${SITE_ID} AND "contentJson"::text LIKE '%/ai-image-generation/actors/ac1-actor-card-%'
`;
console.log(`rows still referencing the catalog filenames: ${rows.length}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join("backups", `actor-portrait-rename-${stamp}`);
let touched = 0;
for (const row of rows) {
  let json = row.json;
  let hits = 0;
  for (const pair of ordered) {
    while (json.includes(pair.from)) {
      json = json.replace(pair.from, pair.to);
      hits += 1;
    }
  }
  if (!hits) continue;
  touched += 1;
  console.log(`${row.slug}: ${hits} url(s) repointed`);
  if (apply) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, `${row.slug.replaceAll("/", "_")}.json`), row.json);
    await prisma.livePage.update({ where: { id: row.id }, data: { contentJson: JSON.parse(json) } });
  }
}
console.log(`\n${touched} row(s) ${apply ? "updated" : "would be updated (dry run — pass --apply)"}`);
if (apply) console.log(`backups written to ${backupDir}`);
await prisma.$disconnect();
