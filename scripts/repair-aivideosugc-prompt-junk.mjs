// Removes document-pipeline junk from public card prompts on site_aidreamcapes.
//
// The batch prompt documents appended their own report apparatus after the
// real generation prompt: a reference-image list entry ("参考图：NN_<hash>_参考图.png",
// sometimes with a trailing "NN / TikTok 视频记录") and sometimes whole appendix
// sections ("附录 A / 待匹配视频清单 …", "Appendix C / …"). None of that is prompt
// copy — the real prompt always ends with its negative-prompt block — so the
// repair truncates each affected string at the earliest junk marker and keeps
// everything before it.
//
// Usage (dry run by default; --apply writes, with a JSON backup per row):
//   DATABASE_URL=... node repair-aivideosugc-prompt-junk.mjs [--apply]

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const SITE_ID = "site_aidreamcapes";
// Earliest of these markers starts the report apparatus; the catalog filename
// shape makes the first alternative impossible in legitimate prompt copy.
const JUNK_MARKER = /参考图：\d+_[0-9a-f]+_参考图\.png|附录\s?[A-C]/;
const CONTAINS_JUNK = /_参考图\.png|附录\s?[A-C]/;
const CJK = /[\u4e00-\u9fff\u3000-\u303f]/;

const prisma = new PrismaClient();

function repairString(value) {
  if (!CONTAINS_JUNK.test(value)) return { value, changed: false };
  const match = JUNK_MARKER.exec(value);
  if (!match) return { value, changed: false };
  return { value: value.slice(0, match.index).replace(/\s+$/, ""), changed: true };
}

function walk(node, stats) {
  if (Array.isArray(node)) return node.map((entry) => walk(entry, stats));
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(Object.entries(node).map(([key, entry]) => {
    if (typeof entry === "string") {
      if (key === "prompt") {
        const repaired = repairString(entry);
        if (repaired.changed) {
          stats.repaired += 1;
          stats.samples.push({ before: entry.slice(-90), after: repaired.value.slice(-90) });
          return [key, repaired.value];
        }
        if (CJK.test(entry)) stats.cjkRemaining.push(entry.slice(-140));
        return [key, entry];
      }
      if (CONTAINS_JUNK.test(entry)) {
        const repaired = repairString(entry);
        if (repaired.changed) {
          stats.repairedOther += 1;
          stats.otherFields.add(key);
          return [key, repaired.value];
        }
      }
      return [key, entry];
    }
    return [key, walk(entry, stats)];
  }));
}

const rows = await prisma.$queryRaw`
  SELECT "id", "slug", "contentJson"::text AS json
  FROM "LivePage"
  WHERE "siteId" = ${SITE_ID} AND "contentJson"::text LIKE '%_参考图.png%'
`;
console.log(`rows containing the junk marker: ${rows.length}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join("backups", `prompt-junk-${stamp}`);
let touched = 0;
for (const row of rows) {
  const original = JSON.parse(row.json);
  const stats = { repaired: 0, repairedOther: 0, samples: [], cjkRemaining: [], otherFields: new Set() };
  const repaired = walk(original, stats);
  if (!stats.repaired && !stats.repairedOther) continue;
  touched += 1;
  console.log(`\n${row.slug}: ${stats.repaired} prompt(s)${stats.repairedOther ? ` + ${stats.repairedOther} other field(s) (${[...stats.otherFields].join(", ")})` : ""}`);
  for (const sample of stats.samples.slice(0, 2)) {
    console.log(`  BEFORE …${JSON.stringify(sample.before)}`);
    console.log(`  AFTER  …${JSON.stringify(sample.after)}`);
  }
  if (stats.cjkRemaining.length) {
    console.log(`  still contains CJK: ${stats.cjkRemaining.length}`);
    for (const sample of stats.cjkRemaining.slice(0, 2)) console.log(`  CJK SAMPLE …${JSON.stringify(sample)}`);
  }
  if (apply) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, `${row.slug.replaceAll("/", "_")}.json`), row.json);
    await prisma.livePage.update({ where: { id: row.id }, data: { contentJson: repaired } });
  }
}

console.log(`\n${touched} row(s) ${apply ? "updated" : "would be updated (dry run — pass --apply)"}`);
if (apply) console.log(`backups written to ${backupDir}`);
await prisma.$disconnect();
