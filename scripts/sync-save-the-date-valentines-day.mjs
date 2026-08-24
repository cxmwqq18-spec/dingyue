#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased;
  return originalResolveFilename.call(this, resolved, ...args);
};
const sourceDir = process.env.SAVE_THE_DATE_SOURCE_DIR || "/Users/a1/Downloads/ai-save-the-date-valentines-day 3";
const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const pagePath = "/ai-save-the-date/valentines-day";
const copyPath = path.join(sourceDir, "01_page_copy_final.md");
const structurePath = path.join(sourceDir, "02_page_structure_final.md");
const seoPath = path.join(sourceDir, "06_seo_config.csv");
const imageManifestPath = path.join(sourceDir, "11_image_manifest_and_alt.csv");
if (!fs.existsSync(copyPath) || !fs.existsSync(seoPath) || !fs.existsSync(imageManifestPath)) throw new Error(`Save the Date source package is incomplete: ${sourceDir}`);

const read = (file) => fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const csvRows = (file) => read(file).trim().split(/\r?\n/).slice(1).map((line) => {
  const values = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    }
    else if (char === "," && !quoted) { values.push(current); current = ""; }
    else current += char;
  }
  values.push(current);
  return values.map((value) => value.trim().replace(/^"|"$/g, ""));
});
const seo = Object.fromEntries(csvRows(seoPath).map(([key, value]) => [key, value]));
const manifest = csvRows(imageManifestPath).map(([filename, role, section, alt, caption, focusKeyword, width, height, format, loading, fetchpriority]) => ({ filename, role: /^hero/i.test(role) ? "hero" : "content", section, alt, caption, focusKeyword, width: Number(width) || 1600, height: Number(height) || 1000, format, loading: loading === "eager" ? "eager" : "lazy", fetchPriority: fetchpriority || "auto" }));
const markdown = read(copyPath);
const structure = read(structurePath);
const cleanInline = (value) => String(value ?? "")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/\*\*([^*]+)\*\*/g, "$1")
  .replace(/\*([^*]+)\*/g, "$1")
  .replace(/\s+/g, " ")
  .trim();
const structureRows = structure.split(/\r?\n/)
  .filter((line) => /^\|\s*\d+\s*\|/.test(line))
  .map((line) => line.split("|").slice(1, -1).map((cell) => cleanInline(cell)))
  .map(([order, componentId, headingLevel, headingText, image, intent]) => ({ order: Number(order), componentId, headingLevel, heading: headingText, image, intent }))
  .filter((row) => Number.isInteger(row.order) && row.componentId);
const requiredSectionIds = structureRows.map((row) => row.componentId);
const expectedSectionIds = ["hero", "positioning", "story-styles", "details", "workflow", "ideas", "formats", "checklist", "faq", "final-cta"];
if (structureRows.length !== expectedSectionIds.length || requiredSectionIds.some((id, index) => id !== expectedSectionIds[index]) || structureRows.some((row, index) => row.order !== index + 1 || !row.heading || !row.image)) {
  throw new Error("Save the Date page structure document is incomplete or out of order");
}
const structureById = new Map(structureRows.map((row) => [row.componentId, row]));
const sectionHeading = (id) => structureById.get(id)?.heading || id;
const lines = markdown.split(/\r?\n/);
const heading = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim() || seo.h1;
const sectionText = (title) => {
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start < 0) throw new Error(`Missing plan section: ${title}`);
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end);
};
const paragraphBlocks = (sourceLines) => {
  const blocks = [];
  let current = [];
  const flush = () => {
    const text = cleanInline(current.join(" "));
    if (text) blocks.push(text);
    current = [];
  };
  for (const line of sourceLines) {
    if (/^-{3,}$/.test(line.trim())) { flush(); continue; }
    if (!line.trim()) { flush(); continue; }
    if (/^(?:#|\*\*[^:]+:\*\*|-\s)/.test(line.trim())) { flush(); continue; }
    current.push(line.trim());
  }
  flush();
  return blocks;
};
const labelledValue = (sourceLines, label) => {
  const line = sourceLines.find((candidate) => candidate.trim().startsWith(`**${label}:**`));
  return line ? cleanInline(line.replace(`**${label}:**`, "")) : "";
};
const h3Blocks = (sourceLines) => {
  const blocks = [];
  let current;
  for (const line of sourceLines) {
    const headingMatch = line.match(/^###\s+(.+)$/);
    if (headingMatch) {
      if (current) blocks.push(current);
      current = { title: cleanInline(headingMatch[1]), lines: [] };
    } else if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks.map(({ title, lines: blockLines }) => ({ title, paragraphs: paragraphBlocks(blockLines) })).filter((item) => item.title && item.paragraphs.length);
};
const listItems = (sourceLines) => sourceLines.filter((line) => /^-\s+/.test(line.trim())).map((line) => cleanInline(line.replace(/^[-*]\s+/, ""))).filter(Boolean);
const detailItems = (sourceLines) => sourceLines.filter((line) => /^-\s+\*\*[^:]+:\*\*/.test(line.trim())).map((line) => {
  const match = line.trim().match(/^[-*]\s+\*\*([^:]+):\*\*\s*(.+)$/);
  return match ? { label: cleanInline(match[1]), text: cleanInline(match[2]) } : null;
}).filter(Boolean);
const sourceImages = manifest.map((item) => ({ ...item, src: `/assets/dreamshoot/save-the-date/valentines-day/${item.filename}` }));
const imageBy = (filename) => {
  const image = sourceImages.find((item) => item.filename === filename);
  if (!image) throw new Error(`Missing manifest image: ${filename}`);
  return image;
};
const imageSettings = (image) => ({ imageUrl: image.src, imageAlt: image.alt, imageWidth: image.width, imageHeight: image.height, imageLoading: image.loading, imageFetchPriority: image.fetchPriority });
const heroLines = sectionText("Hero");
const positioningLines = sectionText("Make Valentine's Day Part of the Wedding Announcement");
const storyLines = sectionText("Choose a Valentine Save the Date Story");
const detailsLines = sectionText("Build the Video Around the Details Guests Need");
const workflowLines = sectionText("Turn Couple Photos into a Romantic Save the Date Video");
const ideasLines = sectionText("Valentine's Day Save the Date Ideas");
const formatsLines = sectionText("Design for Email, Wedding Websites, and Social");
const checklistLines = sectionText("What to Check Before You Send It");
const faqLines = sectionText("Frequently Asked Questions");
const finalCtaLines = sectionText("Final CTA");
const heroIntro = paragraphBlocks(heroLines).find((item) => item.startsWith("Turn favorite couple photos")) || seo.meta_description;
const positioningParagraphs = paragraphBlocks(positioningLines).filter((item) => !item.startsWith("Suggested internal link:"));
const storyBlocks = h3Blocks(storyLines);
const workflowBlocks = h3Blocks(workflowLines);
const formatBlocks = h3Blocks(formatsLines);
const faqItems = h3Blocks(faqLines).map((item, index) => ({ id: `save-date-faq-${index + 1}`, question: item.title, answer: item.paragraphs.join(" ") }));
const detailBlocks = detailItems(detailsLines);
const ideaTexts = listItems(ideasLines).map((item) => {
  const match = item.match(/^([^:]+):\s*(.+)$/);
  return match ? { title: cleanInline(match[1]), text: cleanInline(match[2]) } : { title: item, text: "" };
});
const checklistBlocks = listItems(checklistLines).map((text, index) => ({ id: `save-date-check-${index + 1}`, type: "check_item", settings: { text } }));
const storyImageFiles = [
  "hero-valentines-day-save-the-date-couple-candlelight.jpg",
  "hero-valentines-day-save-the-date-proposal.jpg",
  "valentines-day-save-the-date-beach-couple.jpg"
];
const ideaImageFiles = [
  "valentines-day-save-the-date-rose-garden-couple.jpg",
  "valentines-day-save-the-date-heart-bokeh-couple.jpg",
  "valentines-day-save-the-date-candlelight-dinner.jpg",
  "hero-valentines-day-save-the-date-city-couple.jpg",
  "hero-valentines-day-save-the-date-proposal.jpg"
];
const formatImageFiles = [
  "valentines-day-save-the-date-beach-walk.jpg",
  "valentines-day-save-the-date-celebration-hug.jpg",
  "valentines-day-save-the-date-heart-bokeh-couple.jpg"
];
const detailImageFiles = [
  "valentines-day-save-the-date-candlelight-dinner.jpg",
  "valentines-day-save-the-date-invitation-envelope.jpg"
];
if (faqItems.length !== 6 || storyBlocks.length !== 3 || workflowBlocks.length !== 5 || detailBlocks.length !== 5 || formatBlocks.length !== 3 || ideaTexts.length !== 5 || checklistBlocks.length !== 8) {
  throw new Error(`Save the Date plan shape mismatch: faq=${faqItems.length}, story=${storyBlocks.length}, workflow=${workflowBlocks.length}, details=${detailBlocks.length}, formats=${formatBlocks.length}, ideas=${ideaTexts.length}, checklist=${checklistBlocks.length}`);
}
const noRawMarkdown = (value) => {
  const text = JSON.stringify(value);
  const match = text.match(/---|```|`[^`]+`|\[[^\]]+\]\([^)]*\)|(?:^|\\n)#{1,3}\s/m);
  if (match) throw new Error(`Structured Save the Date content still contains raw Markdown: ${match[0]}`);
};
const pageJson = {
  pageType: "standard-content",
  version: 1,
  sectionsOrder: requiredSectionIds.map((id) => `save_date_${id.replace(/-/g, "_")}`),
  contentContract: { schema: "editorial-page-v1", pageKey: "save_date", requiredSections: requiredSectionIds, sectionTypes: ["editorial_hero", "editorial_rich_text", "editorial_story_grid", "editorial_detail_list", "editorial_steps", "editorial_ideas", "editorial_formats", "editorial_checklist", "faq", "editorial_cta"], faqCount: 6, mediaCount: 11, sourceRevision: "plan-20260824" },
  relatedLinks: [{ label: "How it works", href: "/workflow" }, { label: "Best Packages", href: "/best-packages" }],
  mediaManifest: sourceImages,
  seo: { title: seo.title, description: seo.meta_description, keywords: seo.secondary_keywords, canonicalPath: pagePath, canonical: seo.canonical, ogImage: sourceImages[0]?.src, index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } },
  sections: {
    save_date_hero: { type: "editorial_hero", settings: { anchor: "hero", eyebrow: labelledValue(heroLines, "Eyebrow"), title: heading, intro: heroIntro, support: labelledValue(heroLines, "Support line"), primaryCta: labelledValue(heroLines, "Primary CTA"), primaryHref: "/app/create", secondaryCta: labelledValue(heroLines, "Secondary CTA"), secondaryHref: "#story-styles", ...imageSettings(imageBy("hero-valentines-day-save-the-date-city-couple.jpg")) }, blocks: [] },
    save_date_positioning: { type: "editorial_rich_text", settings: { anchor: "positioning", title: sectionHeading("positioning"), intro: positioningParagraphs[0] || "", ...imageSettings(imageBy("hero-valentines-day-save-the-date-couple-candlelight.jpg")) }, blocks: positioningParagraphs.slice(1).map((text, index) => ({ id: `save-date-positioning-${index + 1}`, type: "paragraph", settings: { text } })) },
    save_date_story_styles: { type: "editorial_story_grid", settings: { anchor: "story-styles", title: sectionHeading("story-styles") }, blocks: storyBlocks.map((item, index) => ({ id: `save-date-story-${index + 1}`, type: "story_card", settings: { title: item.title, text: item.paragraphs.join(" "), ...imageSettings(imageBy(storyImageFiles[index])) } })) },
    save_date_details: { type: "editorial_detail_list", settings: { anchor: "details", layout: "feature_list", title: sectionHeading("details"), intro: paragraphBlocks(detailsLines).find((item) => item.startsWith("A strong")) || "", ...imageSettings(imageBy(detailImageFiles[0])) }, blocks: detailBlocks.map((item, index) => ({ id: `save-date-detail-${index + 1}`, type: "detail_item", settings: { ...item, ...(detailImageFiles[index] ? imageSettings(imageBy(detailImageFiles[index])) : {}) } })) },
    save_date_workflow: { type: "editorial_steps", settings: { anchor: "workflow", title: sectionHeading("workflow"), ...imageSettings(imageBy("valentines-day-save-the-date-couple-planning.jpg")) }, blocks: workflowBlocks.map((item, index) => ({ id: `save-date-step-${index + 1}`, type: "step", settings: { number: index + 1, title: item.title.replace(/^\d+\.\s*/, ""), text: item.paragraphs.join(" ") } })) },
    save_date_ideas: { type: "editorial_ideas", settings: { anchor: "ideas", title: sectionHeading("ideas"), intro: paragraphBlocks(ideasLines).find((item) => item.startsWith("Match the visual")) || "" }, blocks: ideaTexts.map((item, index) => ({ id: `save-date-idea-${index + 1}`, type: "idea", settings: { title: item.title, text: item.text, ...(ideaImageFiles[index] ? imageSettings(imageBy(ideaImageFiles[index])) : {}) } })) },
    save_date_formats: { type: "editorial_formats", settings: { anchor: "formats", title: sectionHeading("formats") }, blocks: formatBlocks.map((item, index) => ({ id: `save-date-format-${index + 1}`, type: "format", settings: { title: item.title, text: item.paragraphs.join(" "), ...(formatImageFiles[index] ? imageSettings(imageBy(formatImageFiles[index])) : {}) } })) },
    save_date_checklist: { type: "editorial_checklist", settings: { anchor: "checklist", title: sectionHeading("checklist") }, blocks: checklistBlocks },
    save_date_faq: { type: "faq", settings: { anchor: "faq", title: sectionHeading("faq") }, blocks: faqItems.map((item) => ({ id: item.id, type: "faq_item", settings: { question: item.question, answer: item.answer } })) },
    save_date_final_cta: { type: "editorial_cta", settings: { anchor: "final-cta", title: sectionHeading("final-cta"), intro: paragraphBlocks(finalCtaLines).find((item) => item.startsWith("Build a concise")) || "", primaryCta: "Create Your Save the Date", primaryHref: "/app/create", secondaryCta: "View All Save the Date Styles", secondaryHref: "#story-styles", ...imageSettings(imageBy("valentines-day-save-the-date-rose-garden-couple.jpg")) }, blocks: [] }
  }
};
noRawMarkdown(pageJson);

const jiti = createJiti(import.meta.url);
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { buildPublicationSnapshot, publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient();
try {
  const siteRecord = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  if (!siteRecord) throw new Error(`Site not found: ${siteId}`);
  const pageId = `page_${siteId}_save_the_date_valentines_day`;
  await prisma.$transaction(async (tx) => {
    await tx.themePage.upsert({ where: { siteId_slug: { siteId, slug: pagePath } }, create: { id: pageId, siteId, pageType: "standard-content", templateKey: "save-the-date", slug: pagePath, title: heading, draftJson: pageJson, publishedJson: pageJson }, update: { pageType: "standard-content", templateKey: "save-the-date", title: heading, draftJson: pageJson, publishedJson: pageJson } });
    const settings = siteRecord.settings?.draftJson || siteRecord.settings?.publishedJson || {};
    const nextSettings = { ...settings, saveTheDateNavigation: { menuLabel: "Save the Date", groups: [{ label: "Love & Wedding", slug: "love-wedding", sortOrder: 1, items: [{ label: "Valentine's Day", slug: "valentines-day", href: pagePath, status: "published", sortOrder: 1 }] }] } };
    await tx.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: nextSettings, publishedJson: nextSettings }, update: { draftJson: nextSettings, publishedJson: nextSettings } });
    for (const item of sourceImages) await tx.mediaAsset.upsert({ where: { siteId_storageKey: { siteId, storageKey: item.src } }, create: { id: `media_${siteId}_save_date_${item.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`, siteId, label: item.filename, storageKey: item.src, mimeType: "image/jpeg", usageType: "theme", sourceType: "save-the-date-source", previewUrl: item.src, originUrl: item.src, altText: item.alt, notes: item.caption }, update: { altText: item.alt, notes: item.caption, previewUrl: item.src, originUrl: item.src } });
  }, { maxWait: 20_000, timeout: 120_000 });
  const fresh = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  const site = toSite(fresh);
  const packs = await prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true } });
  const products = await prisma.product.findMany({ where: { siteId }, include: { prices: true } });
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products.map(mapProduct));
  const integrity = publicationSnapshotIntegrity(snapshot);
  if (integrity !== "valid") throw new Error(`Save the Date publication snapshot is invalid before activation: ${integrity}`);
  await publishSeoSnapshotRelational({ siteId, snapshot, actor: "save-the-date-sync", scope: { type: "site", pageIds: [pageId], includeThemeSettings: true, includeStorefrontProfile: false } });
  console.log(JSON.stringify({ siteId, pagePath, mediaCount: sourceImages.length, faqCount: faqItems.length, snapshotHash: snapshot.snapshotHash }, null, 2));
} finally { await prisma.$disconnect(); }
