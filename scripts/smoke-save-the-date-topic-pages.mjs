#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import "./load-runtime-env.mjs";

const SITE_ID = "site_dreamshoot";
const indexablePaths = [
  "/ai-save-the-date/valentines-day",
  "/ai-save-the-date/engagement",
  "/ai-save-the-date/proposal",
  "/ai-save-the-date/save-the-date",
  "/ai-save-the-date/wedding-ceremony",
  "/ai-save-the-date/christmas",
  "/ai-save-the-date/halloween",
  "/ai-save-the-date/thanksgiving",
  "/ai-save-the-date/new-year",
  "/ai-save-the-date/easter",
  "/ai-save-the-date/mothers-day",
  "/ai-save-the-date/fathers-day"
];
const retiredPath = "/ai-save-the-date/wedding-anniversary";
const expectedPages = [
  { path: "/ai-save-the-date/engagement", key: "engagement", media: 11, faq: 7, sections: ["hero", "intent", "workflow-creates", "story-structures", "workflow", "scene-directions", "quality", "boundaries", "publishing", "faq", "final-cta"] },
  { path: "/ai-save-the-date/proposal", key: "proposal", media: 10, faq: 8, sections: ["hero", "definition", "use-cases", "story-flow", "workflow", "source-media", "accuracy", "faq", "final-cta"] },
  { path: "/ai-save-the-date/save-the-date", key: "save_date", media: 11, faq: 8, sections: ["hero", "definition", "use-cases", "workflow", "scene-ideas", "quality", "formats", "boundaries", "faq", "final-cta"] },
  { path: "/ai-save-the-date/wedding-ceremony", key: "wedding_ceremony", media: 11, faq: 9, sections: ["hero", "definition", "reasons", "sources", "workflow", "scene-ideas", "quality", "boundaries", "responsibility", "faq", "final-cta"] },
  { path: "/ai-save-the-date/easter", key: "easter", media: 11, faq: 8, sections: ["hero", "definition", "use-cases", "quality", "workflow", "scene-ideas", "formats", "family-match", "faq", "final-cta"] },
  { path: "/ai-save-the-date/mothers-day", key: "mothers_day", media: 11, faq: 8, sections: ["hero", "definition", "use-cases", "quality", "workflow", "scene-ideas", "formats", "family-match", "faq", "final-cta"] },
  { path: "/ai-save-the-date/fathers-day", key: "fathers_day", media: 11, faq: 6, sections: ["hero", "definition", "scene-ideas", "quality", "workflow", "use-cases", "gallery", "faq", "final-cta"] }
];

const prisma = new PrismaClient();
const [pageRows, mediaAssets] = await Promise.all([
  prisma.themePage.findMany({
    where: { siteId: SITE_ID, slug: { in: [...indexablePaths, retiredPath] } },
    select: { id: true, slug: true, draftJson: true, publishedJson: true }
  }),
  prisma.mediaAsset.findMany({
    where: { siteId: SITE_ID },
    select: { storageKey: true, altText: true }
  })
]);
await prisma.$disconnect();

const pageByPath = new Map(pageRows.map((page) => [page.slug, page]));
const internalCopyPattern = /\b(?:keyword ownership|search intent|query ownership|indexation|do not index|before launch|product evidence|same query|page owns|landing-page hero)\b/i;
for (const canonicalPath of indexablePaths) {
  const page = pageByPath.get(canonicalPath);
  assert(page, `${canonicalPath}: missing relational ThemePage`);
  const json = page.draftJson;
  assert.equal(json?.seo?.canonicalPath, canonicalPath, `${canonicalPath}: canonical path`);
  assert.equal(json?.seo?.index, true, `${canonicalPath}: page SEO indexability`);
  assert.equal(json?.seo?.robots?.index, true, `${canonicalPath}: robots indexability`);
  assert.equal(json?.seo?.robots?.follow, true, `${canonicalPath}: robots follow`);
  assert(json?.seo?.title && json?.seo?.description && json?.seo?.keywords, `${canonicalPath}: complete TDK`);
  assert.doesNotMatch(JSON.stringify(json), internalCopyPattern, `${canonicalPath}: internal authoring copy`);
}

for (const page of pageRows) {
  assert.deepEqual(page.draftJson, page.publishedJson, `${page.slug}: public draft/published projection drift`);
}

const retired = pageByPath.get(retiredPath)?.draftJson;
assert(retired, `${retiredPath}: missing relational ThemePage`);
assert.equal(retired.seo?.index, false, `${retiredPath}: retired route must remain noindex`);
assert.equal(retired.seo?.robots?.index, false, `${retiredPath}: retired route robots`);
assert.match(String(retired.seo?.title ?? ""), /anniversary/i, `${retiredPath}: title identity`);

for (const expected of expectedPages) {
  const json = pageByPath.get(expected.path)?.draftJson;
  assert(json, `${expected.path}: missing relational page data`);
  assert.deepEqual(json.contentContract?.requiredSections, expected.sections, `${expected.path}: section contract`);
  assert.deepEqual(json.sectionsOrder, expected.sections.map((id) => `${expected.key}_${id.replace(/-/g, "_")}`), `${expected.path}: section order`);
  assert(json.sectionsOrder.every((id) => json.sections[id]), `${expected.path}: ordered sections`);
  assert.equal(json.sectionsOrder.length, json.contentContract?.sectionTypes?.length, `${expected.path}: section type count`);
  assert(json.sectionsOrder.every((id, index) => json.sections[id].type === json.contentContract.sectionTypes[index]), `${expected.path}: section types`);
  const faq = json.sectionsOrder.map((id) => json.sections[id]).find((section) => section?.type === "faq");
  assert.equal(faq?.blocks?.length, expected.faq, `${expected.path}: FAQ count`);
  assert.equal(json.mediaManifest?.length, expected.media, `${expected.path}: media count`);
  assert.equal(new Set(json.mediaManifest.map((item) => item.src)).size, expected.media, `${expected.path}: unique media paths`);
  assert(json.mediaManifest.every((item) => mediaAssets.some((asset) => asset.storageKey === item.src && asset.altText === item.alt)), `${expected.path}: relational media ownership`);
}

const engagementManifest = pageByPath.get("/ai-save-the-date/engagement").draftJson.mediaManifest;
const saveDateManifest = pageByPath.get("/ai-save-the-date/save-the-date").draftJson.mediaManifest;
const binaryHash = (asset) => {
  const file = path.join(process.cwd(), "public", asset.src.replace(/^\/+/, ""));
  assert(fs.existsSync(file), `missing tracked engagement media: ${asset.src}`);
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
};
const channelSpread = async (asset) => {
  const file = path.join(process.cwd(), "public", asset.src.replace(/^\/+/, ""));
  const stats = await sharp(file).stats();
  const means = stats.channels.slice(0, 3).map((channel) => channel.mean);
  return Math.max(...means) - Math.min(...means);
};
const engagementHashes = engagementManifest.map(binaryHash);
const saveDateHashes = new Set(saveDateManifest.map(binaryHash));
assert.equal(new Set(engagementHashes).size, engagementManifest.length, "engagement media must be byte-distinct");
assert(engagementHashes.every((hash) => !saveDateHashes.has(hash)), "engagement media must not duplicate Save the Date media");

const expectedImageMappings = [
  ["/ai-save-the-date/christmas", "christmas_video_ideas", ["hero-ai-christmas-family-gift.jpg", "ai-christmas-photo-capture.jpg", "ai-christmas-gift-wrapping.jpg", "ai-christmas-couple-market-lights.jpg"]],
  ["/ai-save-the-date/easter", "easter_scene_ideas", ["hero-ai-mothers-day-family-breakfast.jpg", "hero-ai-mothers-day-garden-portrait.jpg", "hero-ai-mothers-day-gift-breakfast.jpg", "ai-mothers-day-brunch-table.jpg", "ai-mothers-day-family-baking.jpg", "ai-mothers-day-gift-still-life.jpg", "ai-mothers-day-phone-photo.jpg", "ai-mothers-day-family-toast.jpg", "ai-mothers-day-cozy-living-room.jpg", "ai-mothers-day-pet-portrait.jpg", "ai-mothers-day-spring-walk.jpg"]],
  ["/ai-save-the-date/wedding-ceremony", "wedding_ceremony_reasons", ["hero-ai-wedding-ceremony-recessional.jpg", "hero-ai-wedding-ceremony-vows.jpg", "wedding-ceremony-beach-processional.jpg", "wedding-ceremony-church-atmosphere.jpg", "wedding-ceremony-guests-reaction.jpg", "wedding-ceremony-bouquet-detail.jpg"]],
  ["/ai-save-the-date/wedding-ceremony", "wedding_ceremony_workflow", ["wedding-ceremony-beach-processional.jpg", "hero-ai-wedding-ceremony-vows.jpg", "wedding-ceremony-ring-exchange.jpg", "wedding-ceremony-church-atmosphere.jpg"]]
];
for (const [pagePath, sectionId, filenames] of expectedImageMappings) {
  const section = pageByPath.get(pagePath).draftJson.sections[sectionId];
  assert.equal(section.blocks.length, filenames.length, `${pagePath}: ${sectionId} block count`);
  section.blocks.forEach((block, index) => assert.equal(block.settings?.imageUrl?.split("/").pop(), filenames[index], `${pagePath}: ${sectionId} image mapping ${index + 1}`));
}

const weddingCeremonyPage = pageByPath.get("/ai-save-the-date/wedding-ceremony");
assert(weddingCeremonyPage, "/ai-save-the-date/wedding-ceremony: missing page for color spread checks");
const weddingCeremonyColorFailures = [];
for (const asset of weddingCeremonyPage.mediaManifest || []) {
  const spread = await channelSpread(asset);
  if (spread < 5) weddingCeremonyColorFailures.push({ src: asset.src, spread: Number(spread.toFixed(2)) });
}
assert.equal(weddingCeremonyColorFailures.length, 0, `/ai-save-the-date/wedding-ceremony: grayscale media must not surface: ${JSON.stringify(weddingCeremonyColorFailures)}`);

console.log(JSON.stringify({
  siteId: SITE_ID,
  source: "ThemePage.draftJson + MediaAsset",
  indexablePageCount: indexablePaths.length,
  checkedContracts: expectedPages.length
}, null, 2));
