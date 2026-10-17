import { existsSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const siteId = "site_aidreamcapes";
const pageIds = ["site_aidreamcapes_ai_twin", "site_aidreamcapes_text_to_video"];
const replacements = new Map([
  ["teams1-home-r1-ad--1280.webp", "img1-video-hub-hero-beauty-r1--640.webp"],
  ["teams1-home-aud5-r1--640.webp", "ac1-actor-card-beach-1-r1--640.webp"],
  ["teams1-home-r1-src--1280.webp", "im03-home-picker-bottle-r1--640.webp"],
  ["teams1-home-aud2-r1--1280.webp", "ac1-actor-card-home-1-r1--640.webp"],
  ["teams1-home-aud1-r1--1280.webp", "ac1-actor-card-studio-1-r1--640.webp"],
  ["k5-home-lipstick-vanity--640.webp", "im03-home-picker-lipstick-r1--640.webp"],
  ["fx18-social-picker-candle--640.webp", "f13-r10-occ-holidays-unboxing-candle--640.webp"],
  ["gen2guide-q15-shoes-case2-court-sneaker--640.webp", "q12-guide-product-photo-tips-shoe--640.webp"],
  ["teams1-home-aud3-r1.webp", "ac1-actor-card-office-1-r1--640.webp"],
  ["img3-home-earbuds-r1--640.webp", "im03-home-picker-earbuds-r1--640.webp"]
]);
function visit(value) {
  if (typeof value === "string") {
    let next = value;
    for (const [oldName, newName] of replacements) next = next.replace(oldName, newName);
    return next;
  }
  if (Array.isArray(value)) return value.map(visit);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visit(child)]));
}
function collectMissing(value, missing = new Set()) {
  if (typeof value === "string" && value.startsWith("/assets/")) {
    const local = path.join(process.cwd(), "public", value.replace(/^\//, ""));
    if (!existsSync(local)) missing.add(value);
  } else if (Array.isArray(value)) value.forEach((item) => collectMissing(item, missing));
  else if (value && typeof value === "object") Object.values(value).forEach((item) => collectMissing(item, missing));
  return missing;
}
try {
  const rows = await prisma.livePage.findMany({
    where: { id: { in: pageIds }, siteId },
    select: { id: true, siteId: true, slug: true, updatedAt: true, contentJson: true }
  });
  if (rows.length !== pageIds.length || rows.some((row) => !["/ai-twin", "/text-to-video"].includes(row.slug))) {
    throw new Error("Directory page ownership mismatch; refusing write.");
  }
  for (const row of rows) {
    if (row.contentJson?.contentContract?.sourceRevision !== "aidreamcapes-directory-pages-20261017-v1") {
      throw new Error("Page revision changed; refusing to overwrite online edits.");
    }
  }
  const changes = rows.map((row) => ({ ...row, next: visit(row.contentJson) }));
  const missing = [...new Set(changes.flatMap((row) => [...collectMissing(row.next)]))];
  if (missing.length) throw new Error("Replacement media missing from local public assets: " + missing.join(", "));
  await prisma.$transaction(async (tx) => {
    for (const row of changes) {
      const result = await tx.livePage.updateMany({
        where: { id: row.id, siteId, slug: row.slug, updatedAt: row.updatedAt },
        data: { contentJson: row.next }
      });
      if (result.count !== 1) throw new Error("LivePage changed during media correction; refusing further writes.");
    }
  }, { isolationLevel: "Serializable" });
  const after = await prisma.livePage.findMany({
    where: { id: { in: pageIds }, siteId },
    select: { id: true, slug: true, updatedAt: true, contentJson: true },
    orderBy: { slug: "asc" }
  });
  const afterMissing = [...new Set(after.flatMap((row) => [...collectMissing(row.contentJson)]))];
  if (afterMissing.length) throw new Error("Post-write asset readback failed: " + afterMissing.join(", "));
  console.log(JSON.stringify({ correctedPages: after.map((row) => ({ id: row.id, slug: row.slug, updatedAt: row.updatedAt })), mediaPathsExist: true, missingPaths: [] }, null, 2));
} finally {
  await prisma.$disconnect();
}
