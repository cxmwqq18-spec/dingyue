// Adds `video.previewSrc` to every contentJson video object whose source has
// a generated 10-second preview clip. The clip manifest (a plain JSON array
// of clip URLs, produced by the server-side ffmpeg batch) decides which
// sources get a preview; objects without a clip stay untouched, so the
// component's original-file fallback keeps working.
//
// Usage (dry run by default; --apply writes, with a JSON backup per row):
//   DATABASE_URL=... node apply-aivideosugc-preview-clips.mjs <clips.json> [--apply]

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const clipsFile = process.argv[2];
if (!clipsFile || !fs.existsSync(clipsFile)) {
  console.error("usage: node apply-aivideosugc-preview-clips.mjs <clips.json> [--apply]");
  process.exit(1);
}
const SITE_ID = "site_aidreamcapes";
const clips = JSON.parse(fs.readFileSync(clipsFile, "utf8"));
// source URL → clip URL: "<base>.mp4" ↔ "<base>-p10.mp4"
const previewBySource = new Map();
for (const clipUrl of clips) {
  previewBySource.set(clipUrl.replace(/-p10\.mp4$/, ".mp4"), clipUrl);
}
console.log(`clip manifest entries: ${previewBySource.size}`);

const prisma = new PrismaClient();
const rows = await prisma.$queryRaw`
  SELECT "id", "slug", "contentJson"::text AS json
  FROM "LivePage"
  WHERE "siteId" = ${SITE_ID} AND "contentJson"::text LIKE '%/ai-video-generation/%.mp4%'
`;
console.log(`candidate rows: ${rows.length}`);

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupDir = path.join("backups", `preview-clips-${stamp}`);
let touched = 0;
let annotated = 0;
for (const row of rows) {
  let rowHits = 0;
  const walk = (node) => {
    if (Array.isArray(node)) return node.map(walk);
    if (!node || typeof node !== "object") return node;
    const result = { ...node };
    for (const [key, value] of Object.entries(result)) {
      if (key === "src" && typeof value === "string" && /^\/ai-video-generation\/.+\.(?:m4v|mov|mp4|webm)$/.test(value)) {
        const previewUrl = previewBySource.get(`https://www.aivideosugc.com${value}`);
        if (previewUrl && result.previewSrc !== previewUrl) {
          result.previewSrc = previewUrl;
          rowHits += 1;
        }
        continue;
      }
      result[key] = walk(value);
    }
    return result;
  };
  const original = JSON.parse(row.json);
  const updated = walk(original);
  if (!rowHits) continue;
  touched += 1;
  annotated += rowHits;
  console.log(`${row.slug}: ${rowHits} video(s) annotated`);
  if (apply) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.writeFileSync(path.join(backupDir, `${row.slug.replaceAll("/", "_")}.json`), row.json);
    await prisma.livePage.update({ where: { id: row.id }, data: { contentJson: updated } });
  }
}
console.log(`\n${touched} row(s), ${annotated} video(s) ${apply ? "annotated" : "would be annotated (dry run — pass --apply)"}`);
if (apply) console.log(`backups written to ${backupDir}`);
await prisma.$disconnect();
