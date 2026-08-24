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
Module._load = function load(request, ...args) { if (request === "server-only") return {}; return originalLoad.call(this, request, ...args); };
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased;
  return originalResolveFilename.call(this, resolved, ...args);
};

const siteId = process.env.SAVE_THE_DATE_SITE_ID || "site_dreamshoot";
const removedLegacyPaths = new Set([
  "/holidays-events/christmas",
  "/holidays-events/thanksgiving",
  "/holidays-events/new-year"
]);
const defaultSourceRoot = "/Users/a1/Downloads";
const packages = [
  { key: "engagement", sourceDir: process.env.SAVE_THE_DATE_ENGAGEMENT_SOURCE_DIR || path.join(defaultSourceRoot, "ai-save-the-date-engagement 3"), pagePath: "/holidays-events/engagement", pageKey: "engagement", structureLabels: ["hero", "intent clarification", "three video story structures", "how it works", "eight video scene directions", "video quality standards", "output formats", "page boundaries", "product evidence gate", "faq", "related video pages"], sectionIds: ["hero", "intent", "story-structures", "workflow", "scene-directions", "quality", "formats", "boundaries", "evidence", "faq", "final-cta"], sectionTypes: ["editorial_hero", "editorial_rich_text", "editorial_story_grid", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_formats", "editorial_boundaries", "editorial_evidence", "faq", "editorial_cta"], faqCount: 8, mediaCount: 11 },
  { key: "proposal", sourceDir: process.env.SAVE_THE_DATE_PROPOSAL_SOURCE_DIR || path.join(defaultSourceRoot, "ai-proposal-video-final"), pagePath: "/holidays-events/proposal", pageKey: "proposal", structureLabels: ["hero", "what is an ai proposal video", "proposal use cases", "proposal story flow", "how it works", "source-media guidance", "accuracy & responsibility", "faq", "final cta"], sectionIds: ["hero", "definition", "use-cases", "story-flow", "workflow", "source-media", "accuracy", "faq", "final-cta"], sectionTypes: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_story_flow", "editorial_steps", "editorial_quality", "editorial_quality", "faq", "editorial_cta"], faqCount: 8, mediaCount: 10 },
  { key: "save-the-date", sourceDir: process.env.SAVE_THE_DATE_GENERIC_SOURCE_DIR || path.join(defaultSourceRoot, "ai-save-the-date-video 2"), pagePath: "/holidays-events/save-the-date", pageKey: "save_date", structureLabels: ["hero", "what is an ai save the date video", "use cases", "how it works", "scene ideas", "quality standards", "output planning", "page boundaries", "evidence gate", "faq", "related pages"], sectionIds: ["hero", "definition", "use-cases", "workflow", "scene-ideas", "quality", "formats", "boundaries", "evidence", "faq", "final-cta"], sectionTypes: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_formats", "editorial_boundaries", "editorial_evidence", "faq", "editorial_cta"], faqCount: 8, mediaCount: 11 }
];

const read = (file) => fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const clean = (value) => String(value ?? "").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\s+/g, " ").trim();
const csvRows = (file) => read(file).trim().split(/\r?\n/).slice(1).map((line) => {
  const values = []; let current = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { values.push(current); current = ""; }
    else current += char;
  }
  values.push(current);
  return values.map((value) => value.trim().replace(/^"|"$/g, ""));
});
const csvTable = (file) => {
  const lines = read(file).trim().split(/\r?\n/);
  const headerLine = lines.shift() || "";
  const parseLine = (line) => {
    const values = []; let current = ""; let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') { if (quoted && line[index + 1] === '"') { current += '"'; index += 1; } else quoted = !quoted; }
      else if (char === "," && !quoted) { values.push(current); current = ""; }
      else current += char;
    }
    values.push(current);
    return values.map((value) => value.trim().replace(/^"|"$/g, ""));
  };
  const headers = parseLine(headerLine).map((value) => value.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return lines.filter((line) => line.trim()).map((line) => Object.fromEntries(parseLine(line).map((value, index) => [headers[index] || `column_${index}`, value])));
};
const seoRows = (file) => {
  const rows = csvRows(file);
  const header = read(file).split(/\r?\n/, 1)[0].toLowerCase();
  if (header.includes("field")) return Object.fromEntries(rows.map(([key, value]) => [clean(key).toLowerCase().replace(/\s+/g, "_"), clean(value)]));
  return Object.fromEntries(rows.map(([key, value]) => [clean(key).toLowerCase().replace(/\s+/g, "_"), clean(value)]));
};
const sectionLines = (lines, title) => {
  const index = lines.findIndex((line) => line.trim().toLowerCase() === `## ${title}`.toLowerCase());
  if (index < 0) return [];
  const end = lines.findIndex((line, candidate) => candidate > index && /^##\s+/.test(line));
  return lines.slice(index + 1, end < 0 ? lines.length : end);
};
const paragraphs = (lines) => {
  const out = []; let current = [];
  const flush = () => { const value = clean(current.join(" ")); if (value) out.push(value); current = []; };
  for (const line of lines) { if (!line.trim() || /^-{3,}$/.test(line.trim())) { flush(); continue; } if (/^(?:###|[-*]\s|\d+\.\s)/.test(line.trim())) { flush(); continue; } current.push(line.trim()); }
  flush(); return out;
};
const listItems = (lines) => lines.filter((line) => /^(?:[-*]|\d+\.)\s+/.test(line.trim())).map((line) => clean(line.trim().replace(/^(?:[-*]|\d+\.)\s+/, ""))).filter(Boolean);
const h3Blocks = (lines) => {
  const out = []; let current;
  for (const line of lines) { const match = line.match(/^###\s+(.+)$/); if (match) { if (current) out.push(current); current = { title: clean(match[1]), lines: [] }; } else if (current) current.lines.push(line); }
  if (current) out.push(current);
  return out.map((item) => ({ title: item.title, text: paragraphs(item.lines).join(" ") })).filter((item) => item.title && item.text);
};
const findHeadingSection = (lines, pattern) => {
  const heading = lines.find((line) => /^##\s+/.test(line) && pattern.test(line));
  return heading ? sectionLines(lines, heading.replace(/^##\s+/, "").trim()) : [];
};

function parseManifest(dir, key) {
  const rows = csvTable(path.join(dir, "11_image_manifest_and_alt.csv"));
  const images = rows.map((row) => {
    const filename = row.filename;
    const alt = row.alt_text || row.alt || row.column_2;
    const role = /^hero/i.test(row.scene_role || row.role || "") ? "hero" : "content";
    const dimensions = row.dimensions || "1600x1000";
    const [width, height] = dimensions.split("x").map(Number);
    return { filename, role, recommendedUsage: clean(row.recommended_usage || row.recommended_use || ""), alt: clean(alt), caption: clean(row.caption || ""), width: width || 1600, height: height || 1000, loading: role === "hero" ? "eager" : "lazy", fetchPriority: role === "hero" ? "high" : "auto", src: `/assets/dreamshoot/save-the-date/${key}/${filename}` };
  });
  if (images.length < 10 || new Set(images.map((item) => item.filename)).size !== images.length || images.some((item) => !item.alt || item.width !== 1600 || item.height !== 1000)) throw new Error(`${key}: invalid image manifest`);
  if (images.some((item) => !fs.existsSync(path.join(dir, "images", item.filename)))) throw new Error(`${key}: manifest references a missing image file`);
  return images;
}

function parseStructure(file, config) {
  const entries = read(file).split(/\r?\n/).map((line) => line.match(/^\s*\d+\.\s+(.+?)\s*$/)?.[1]).filter(Boolean);
  const renderEntries = entries.filter((entry) => !/^global header\b/i.test(entry));
  if (renderEntries.length !== config.sectionIds.length) throw new Error(`${config.key}: structure document has ${renderEntries.length} render sections, expected ${config.sectionIds.length}`);
  const normalized = renderEntries.map((entry) => clean(entry).split(/\s+[—-]\s+/)[0].toLowerCase());
  const expected = config.structureLabels.map((label) => label.toLowerCase());
  if (normalized.some((label, index) => !label.includes(expected[index]))) throw new Error(`${config.key}: structure order does not match package contract`);
  return renderEntries.map((title, index) => ({ id: config.sectionIds[index], title: clean(title) }));
}

function parsePackage(config) {
  for (const name of ["01_page_copy_final.md", "02_page_structure_final.md", "06_seo_config.csv", "10_internal_link_plan.csv", "11_image_manifest_and_alt.csv"]) if (!fs.existsSync(path.join(config.sourceDir, name))) throw new Error(`${config.key}: missing ${name}`);
  const copyLines = read(path.join(config.sourceDir, "01_page_copy_final.md")).split(/\r?\n/);
  const structurePlan = parseStructure(path.join(config.sourceDir, "02_page_structure_final.md"), config);
  const seo = seoRows(path.join(config.sourceDir, "06_seo_config.csv"));
  const manifest = parseManifest(config.sourceDir, config.key);
  if (manifest.length !== config.mediaCount) throw new Error(`${config.key}: manifest count ${manifest.length} does not match package contract ${config.mediaCount}`);
  const copyHeading = copyLines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").replace(/\s+[—-]\s+Final(?:\s+Page)?\s+Copy.*$/i, "").replace(/:\s*Final.*$/i, "").trim();
  const heading = seo.h1 || copyHeading || seo.title;
  const h2 = copyLines.filter((line) => /^##\s+/.test(line)).map((line) => clean(line.replace(/^##\s+/, "")));
  const find = (patterns) => findHeadingSection(copyLines, new RegExp(patterns, "i"));
  const heroSource = config.key === "proposal" ? sectionLines(copyLines, "Hero") : sectionLines(copyLines, "Hero copy");
  const heroIntro = paragraphs(heroSource)[0] || seo.meta_description;
  const h3 = (patterns) => h3Blocks(find(patterns));
  const faq = h3("FAQ").map((item, index) => ({ id: `${config.key}-faq-${index + 1}`, question: item.title, answer: item.text }));
  if (faq.length !== config.faqCount) throw new Error(`${config.key}: expected ${config.faqCount} FAQ items, got ${faq.length}`);
  const imageSettings = (image) => image ? ({ imageUrl: image.src, imageAlt: image.alt, imageWidth: image.width, imageHeight: image.height, imageLoading: image.loading, imageFetchPriority: image.fetchPriority }) : {};
  // Allocate each content asset at most once. The old modulo allocator restarted at
  // every section, so a valid manifest was rendered as the same image on many cards.
  const imageUseCount = manifest.map((_, index) => (index < 3 ? 1 : 0));
  const usedContentImages = new Set();
  const allocateImage = (sectionKey) => {
    const candidates = manifest
      .map((asset, index) => ({ asset, index }))
      .filter(({ index }) => index >= 3 && !usedContentImages.has(index))
      .sort((left, right) => imageUseCount[left.index] - imageUseCount[right.index] || left.index - right.index);
    const chosen = candidates[0];
    if (!chosen) return null;
    usedContentImages.add(chosen.index);
    imageUseCount[chosen.index] += 1;
    return chosen.asset;
  };
  const blocks = (items, type, settings = (item) => ({ title: item.title, text: item.text }), sectionKey = type) => items.map((item, index) => ({ id: `${config.key}-${type}-${index + 1}`, type, settings: { ...settings(item, index), ...imageSettings(allocateImage(sectionKey)) } }));
  const listSection = (id, type, title, source, blockType = "item") => ({ type, settings: { anchor: id, title }, blocks: blocks(listItems(source).map((text) => ({ title: text, text })), blockType, undefined, id) });
  const titleFor = (index, fallback) => structurePlan[index]?.title || h2[index] || fallback;
  const labelledCopy = (lines, label) => lines.find((line) => line.trim().toLowerCase().startsWith(`**${label.toLowerCase()}:**`))?.replace(/^\*\*[^:]+:\*\*\s*/, "").trim() || "";
  const heroPrimaryCta = labelledCopy(heroSource, "Primary CTA") || `Create ${heading}`;
  const heroSecondaryCta = labelledCopy(heroSource, "Secondary CTA") || "Explore the story ideas";
  const chipStart = heroSource.findIndex((line) => /intent chips/i.test(line));
  const intentChips = chipStart >= 0 ? listItems(heroSource.slice(chipStart + 1)).slice(0, 6) : [];
  const finalCtaSource = find("Final CTA copy|Final CTA")
    .map((line) => clean(line))
    .filter(Boolean);
  const finalCtaHeading = finalCtaSource.find((line) => /^\*\*Heading:/i.test(line))?.replace(/^\*\*Heading:\*\*\s*/i, "") || titleFor(config.sectionIds.length - 1, heading);
  const finalCtaBody = finalCtaSource.find((line) => /^\*\*Body:/i.test(line))?.replace(/^\*\*Body:\*\*\s*/i, "") || heroIntro;
  const finalCtaLabel = finalCtaSource.find((line) => /^\*\*CTA:/i.test(line))?.replace(/^\*\*CTA:\*\*\s*/i, "") || heroPrimaryCta;
  const story = h3(config.key === "proposal" ? "Proposal Video Use Cases" : config.key === "engagement" ? "Three engagement Save the Date video structures" : "Save the Date video use cases");
  const workflow = h3(config.key === "proposal" ? "How It Works" : config.key === "engagement" ? "How to make an engagement Save the Date video" : "How to make a Save the Date video");
  const formats = h3(config.key === "engagement" ? "Engagement Save the Date video formats" : "Output and placement planning");
  const qualitySource = find(config.key === "proposal" ? "Accuracy and Quality" : config.key === "engagement" ? "Video quality and identity standards" : "Image, identity, and publishing quality standards");
  const sceneSource = find(config.key === "proposal" ? "Scene Ideas" : config.key === "engagement" ? "Eight engagement video scene directions" : "Save the Date scene ideas");
  const boundariesSource = find(config.key === "engagement" ? "Engagement versus nearby video pages" : "Save the Date versus nearby wedding pages");
  const evidenceSource = find("First-party evidence|required before indexation|Evidence Gate");
  const sections = {};
  for (let index = 0; index < config.sectionIds.length; index += 1) {
    const id = config.sectionIds[index]; const type = config.sectionTypes[index]; const sectionId = `${config.pageKey}_${id.replace(/-/g, "_")}`;
    if (id === "hero") sections[sectionId] = { type, settings: { anchor: id, title: heading, intro: heroIntro, intentChips, primaryCta: heroPrimaryCta, primaryHref: "/app/create", secondaryCta: heroSecondaryCta, secondaryHref: `#${config.sectionIds[2]}`, ...imageSettings(manifest[0]) }, blocks: manifest.slice(0, 3).map((asset, index) => ({ id: `${config.key}-hero-visual-${index + 1}`, type: "hero_visual", settings: imageSettings(asset) })) };
    else if (id === "intent" || id === "definition") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "What this video page covers"), intro: paragraphs(find(config.key === "proposal" ? "What Is an AI Proposal Video" : config.key === "engagement" ? "What is an AI engagement" : "What is an AI Save the Date"))[0] || heroIntro, ...imageSettings(allocateImage(id)) }, blocks: paragraphs(find(config.key === "proposal" ? "What Is an AI Proposal Video" : config.key === "engagement" ? "What is an AI engagement" : "What is an AI Save the Date")).slice(1).map((text, n) => ({ id: `${config.key}-paragraph-${n + 1}`, type: "paragraph", settings: { text } })) };
    else if (id === "story-structures" || id === "story-flow") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Story structures") }, blocks: blocks(story, "story_card", undefined, id) };
    else if (id === "use-cases" || id === "scene-directions" || id === "scene-ideas") {
      const sceneItems = id === "use-cases" || config.key !== "save-the-date" ? (id === "use-cases" ? story : [{ title: "Scene direction", text: paragraphs(sceneSource).join(" ") }, ...listItems(sceneSource).map((text) => ({ title: text, text }))]) : listItems(sceneSource).map((text) => ({ title: text, text }));
      sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Scene ideas") }, blocks: blocks(sceneItems, "scene_card", undefined, id) };
    }
    else if (id === "workflow") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "How it works"), ...imageSettings(allocateImage(id)) }, blocks: blocks(workflow.length ? workflow : listItems(find("How to make|How It Works")).map((text) => ({ title: text, text })), "step", (item, n) => ({ number: n + 1, title: item.title, text: item.text }), id) };
    else if (id === "quality" || id === "accuracy") sections[sectionId] = { type: "editorial_quality", settings: { anchor: id, title: titleFor(index, "Quality and responsibility") }, blocks: listItems(qualitySource).map((text, n) => ({ id: `${config.key}-quality-${n + 1}`, type: "quality_item", settings: { text } })) };
    else if (id === "formats") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Output formats") }, blocks: blocks(formats, "format", undefined, id) };
    else if (id === "boundaries") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Page boundaries") }, blocks: listItems(boundariesSource).map((text, n) => ({ id: `${config.key}-boundary-${n + 1}`, type: "boundary", settings: { text } })) };
    else if (id === "source-media") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Source media guidance") }, blocks: listItems(find("How It Works|Source-Media Guidance")).map((text, n) => ({ id: `${config.key}-source-${n + 1}`, type: "guidance", settings: { text } })) };
    else if (id === "evidence") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Evidence and review") }, blocks: [{ id: `${config.key}-evidence-1`, type: "evidence", settings: { text: paragraphs(evidenceSource).join(" ") || listItems(evidenceSource).join(" ") } }] };
    else if (id === "faq") sections[sectionId] = { type, settings: { anchor: id, title: "Frequently Asked Questions" }, blocks: faq.map((item) => ({ id: item.id, type: "faq_item", settings: item })) };
    else if (id === "final-cta") sections[sectionId] = { type, settings: { anchor: id, title: finalCtaHeading, intro: finalCtaBody, primaryCta: finalCtaLabel, primaryHref: "/app/create", secondaryCta: heroSecondaryCta, secondaryHref: `#${config.sectionIds[Math.min(2, config.sectionIds.length - 1)]}`, ...imageSettings(allocateImage(id)) } };
  }
  const publishedLinkTargets = new Set([
    "/ai-save-the-date/valentines-day",
    "/holidays-events/engagement",
    "/holidays-events/proposal",
    "/holidays-events/save-the-date",
    "/workflow",
    "/best-packages",
    "/pricing"
  ]);
  const relatedLinks = csvRows(path.join(config.sourceDir, "10_internal_link_plan.csv"))
    .map((row) => ({ href: clean(row[1]), label: clean(row[2]) }))
    .filter((item) => item.href && item.label && publishedLinkTargets.has(item.href))
    .filter((item) => item.href !== config.pagePath)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index);
  return { ...config, heading, seo, manifest, structurePlan, sections, relatedLinks, pageJson: { pageType: "standard-content", version: 1, sectionsOrder: config.sectionIds.map((id) => `${config.pageKey}_${id.replace(/-/g, "_")}`), contentContract: { schema: "editorial-page-v1", pageKey: config.pageKey, requiredSections: config.sectionIds, sectionTypes: config.sectionTypes, faqCount: config.faqCount, mediaCount: config.mediaCount, sourceRevision: `${config.key}-plan-20260824` }, relatedLinks, mediaManifest: manifest, seo: { title: seo.title || seo.title_tag || seo.title, description: seo.meta_description || seo.meta_description, keywords: seo.secondary_keyword || seo.secondary_keywords, canonicalPath: config.pagePath, canonical: seo.canonical || `https://www.mydreamshoots.com${config.pagePath}`, ogImage: manifest[0].src, index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } }, sections } };
}

const jiti = createJiti(import.meta.url);
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { buildPublicationSnapshot, publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient();
try {
  const parsed = packages.map(parsePackage);
  for (const item of parsed) {
    const targetDir = path.join(repoRoot, "public/assets/dreamshoot/save-the-date", item.key);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const asset of item.manifest) {
      const targetPath = path.join(targetDir, asset.filename);
      fs.copyFileSync(path.join(item.sourceDir, "images", asset.filename), targetPath);
      fs.chmodSync(targetPath, 0o644);
    }
  }
  const siteRecord = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  if (!siteRecord) throw new Error(`Site not found: ${siteId}`);
  await prisma.$transaction(async (tx) => {
    const settings = siteRecord.settings?.draftJson || siteRecord.settings?.publishedJson || {};
    const groups = parsed.map((item, index) => ({ label: item.key === "save-the-date" ? "Save the Date" : item.key[0].toUpperCase() + item.key.slice(1), slug: item.key, sortOrder: index + 1, items: [{ label: item.key === "save-the-date" ? "Save the Date" : item.key[0].toUpperCase() + item.key.slice(1), slug: item.key, href: item.pagePath, status: "published", sortOrder: 1 }] }));
    const existingNavigation = settings.saveTheDateNavigation?.groups ?? [];
    const existingLoveItems = (existingNavigation.find((group) => group.slug === "love-wedding")?.items ?? []).filter((item) => !removedLegacyPaths.has(item.href));
    const loveItems = [...existingLoveItems.filter((item) => item.href === "/ai-save-the-date/valentines-day"), ...groups.flatMap((group) => group.items)]
      .filter((item, index, values) => values.findIndex((candidate) => candidate.href === item.href) === index);
    const preservedGroups = existingNavigation.filter((group) => group.slug !== "love-wedding");
    const nextSettings = { ...settings, saveTheDateNavigation: { menuLabel: settings.saveTheDateNavigation?.menuLabel || "Save the Date", groups: [{ label: "Love & Wedding", slug: "love-wedding", sortOrder: 1, items: loveItems.map((item, index) => ({ ...item, sortOrder: index + 1, status: "published" })) }, ...preservedGroups.map((group, index) => ({ ...group, sortOrder: index + 2 }))] } };
    await tx.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: nextSettings, publishedJson: nextSettings }, update: { draftJson: nextSettings, publishedJson: nextSettings } });
    for (const item of parsed) {
      const pageId = `page_${siteId}_${item.key.replace(/[^a-z0-9]+/gi, "_")}`;
      await tx.themePage.upsert({ where: { siteId_slug: { siteId, slug: item.pagePath } }, create: { id: pageId, siteId, pageType: "standard-content", templateKey: "save-the-date-editorial", slug: item.pagePath, title: item.heading, draftJson: item.pageJson, publishedJson: item.pageJson }, update: { pageType: "standard-content", templateKey: "save-the-date-editorial", title: item.heading, draftJson: item.pageJson, publishedJson: item.pageJson } });
      for (const asset of item.manifest) await tx.mediaAsset.upsert({ where: { siteId_storageKey: { siteId, storageKey: asset.src } }, create: { id: `media_${siteId}_${item.key}_${asset.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`, siteId, label: asset.filename, storageKey: asset.src, mimeType: "image/jpeg", usageType: "theme", sourceType: `save-the-date-${item.key}-source`, previewUrl: asset.src, originUrl: asset.src, altText: asset.alt, notes: asset.caption }, update: { altText: asset.alt, notes: asset.caption, previewUrl: asset.src, originUrl: asset.src } });
    }
  }, { maxWait: 20_000, timeout: 120_000 });
  const fresh = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  const site = toSite(fresh);
  const packs = await prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true } });
  const products = await prisma.product.findMany({ where: { siteId }, include: { prices: true } });
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products.map(mapProduct));
  const integrity = publicationSnapshotIntegrity(snapshot);
  if (integrity !== "valid") throw new Error(`Save the Date topic publication snapshot is invalid: ${integrity}`);
  await publishSeoSnapshotRelational({ siteId, snapshot, actor: "save-the-date-topic-sync", scope: { type: "site", pageIds: parsed.map((item) => `page_${siteId}_${item.key.replace(/[^a-z0-9]+/gi, "_")}`), includeThemeSettings: true, includeStorefrontProfile: false } });
  console.log(JSON.stringify({ siteId, pages: parsed.map((item) => ({ key: item.key, path: item.pagePath, media: item.manifest.length, faq: item.faqCount })), snapshotHash: snapshot.snapshotHash }, null, 2));
} finally { await prisma.$disconnect(); }
