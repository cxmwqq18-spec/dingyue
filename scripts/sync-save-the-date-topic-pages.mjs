#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";

const p1Manifest = createJiti(import.meta.url)("../src/lib/mydreamshoots-seo-p1-manifest.ts");
const { stripMydreamshootsP1SeasonalDuplicateText } = p1Manifest;

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
const defaultSourceRoot = "/Users/a1/Downloads";
const navigationLabels = new Map([
  ["/ai-save-the-date/valentines-day", "Valentine's Day"],
  ["/ai-save-the-date/engagement", "Engagement"],
  ["/ai-save-the-date/proposal", "Proposal"],
  ["/ai-save-the-date/save-the-date", "Save the Date"],
  ["/ai-save-the-date/wedding-invitation", "Wedding Invitation"],
  ["/ai-save-the-date/wedding-ceremony", "Wedding Ceremony"],
  ["/ai-save-the-date/christmas", "Christmas"],
  ["/ai-save-the-date/halloween", "Halloween"],
  ["/ai-save-the-date/thanksgiving", "Thanksgiving"],
  ["/ai-save-the-date/new-year", "New Year"],
  ["/ai-save-the-date/mothers-day", "Mother's Day"],
  ["/ai-save-the-date/fathers-day", "Father's Day"]
]);
const packages = [
  { key: "engagement", sourceDir: process.env.SAVE_THE_DATE_ENGAGEMENT_SOURCE_DIR || path.join(defaultSourceRoot, "ai-save-the-date-engagement"), pagePath: "/ai-save-the-date/engagement", pageKey: "engagement", structureLabels: ["hero", "intent clarification", "what the workflow creates", "three engagement story structures", "how it works", "eight scene directions", "image selection and identity standards", "engagement versus adjacent pages", "publishing checklist", "product evidence block", "visible faq", "related pages and final cta"], sectionIds: ["hero", "intent", "workflow-creates", "story-structures", "workflow", "scene-directions", "quality", "boundaries", "publishing", "evidence", "faq", "final-cta"], sectionTypes: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_story_grid", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_boundaries", "editorial_checklist", "editorial_evidence", "faq", "editorial_cta"], faqCount: 7, mediaCount: 11 },
  { key: "proposal", sourceDir: process.env.SAVE_THE_DATE_PROPOSAL_SOURCE_DIR || path.join(defaultSourceRoot, "ai-proposal-video-final"), pagePath: "/ai-save-the-date/proposal", pageKey: "proposal", structureLabels: ["hero", "what is an ai proposal video", "proposal use cases", "proposal story flow", "how it works", "source-media guidance", "accuracy & responsibility", "faq", "final cta"], sectionIds: ["hero", "definition", "use-cases", "story-flow", "workflow", "source-media", "accuracy", "faq", "final-cta"], sectionTypes: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_story_flow", "editorial_steps", "editorial_quality", "editorial_quality", "faq", "editorial_cta"], faqCount: 8, mediaCount: 10, heroPrimaryCta: "Create Your Proposal Video" },
  { key: "save-the-date", sourceDir: process.env.SAVE_THE_DATE_GENERIC_SOURCE_DIR || path.join(repoRoot, "docs/design-packages/ai-save-the-date-video"), pagePath: "/ai-save-the-date/save-the-date", pageKey: "save_date", structureLabels: ["hero", "what is an ai save the date video", "use cases", "how it works", "scene ideas", "quality standards", "output planning", "page boundaries", "evidence gate", "faq", "related pages"], sectionIds: ["hero", "definition", "use-cases", "workflow", "scene-ideas", "quality", "formats", "boundaries", "evidence", "faq", "final-cta"], sectionTypes: ["editorial_hero", "editorial_rich_text", "editorial_scene_grid", "editorial_steps", "editorial_scene_grid", "editorial_quality", "editorial_formats", "editorial_boundaries", "editorial_evidence", "faq", "editorial_cta"], faqCount: 8, mediaCount: 11 }
];

const read = (file) => fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const pageForPath = (pages, pathName) => pages.find((page) => page.slug === pathName
  || page.draftJson?.seo?.canonicalPath === pathName
  || page.publishedJson?.seo?.canonicalPath === pathName);
const clean = (value) => String(value ?? "").replace(/`([^`]+)`/g, "$1").replace(/\[([^\]]+)\]\([^)]*\)/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\s+/g, " ").trim();
const customerText = (value) => clean(value)
  .replace(/The page should stay focused on video intent\. Couple photos are source material for the video, not the product being targeted by the SEO page\.?/gi, "This page focuses on creating an engagement video from couple photos. The photos are the starting point for the video, while formal invitation wording remains a separate step.")
  .replace(/The page should stay focused on Save the Date video intent\. Couple photos are source material, not a competing photo-product target\.?/gi, "This page focuses on creating a Save the Date video from approved couple photos and a confirmed wedding date.")
  .replace(/The page should stay focused on Save the Date video intent\.?/gi, "This page focuses on creating a Save the Date video from approved couple photos and a confirmed wedding date.")
  .replace(/SEO page/gi, "page")
  .replace(/SEO copy/gi, "text")
  .replace(/search intent/gi, "topic")
  .replace(/primary keyword/gi, "main topic")
  .replace(/indexation/gi, "publishing")
  .replace(/Evidence Gate/gi, "review checklist")
  .replace(/\b(?:The live page|The page|This page) should\b/gi, "This page")
  .replace(/\bSEO\/product goals\b/gi, "product goals")
  .split(/(?<=[.!?])\s+/)
  .filter((sentence) => !/current evidence|supplied taxonomy|publishing status|internally approved|\bpage should\b/i.test(sentence))
  .join(" ");

const saveDatePublicCopy = {
  heading: "Create an AI Save the Date Video",
  heroIntro: "Turn approved couple photos and a confirmed wedding date into a short Save the Date video concept. Keep the date as the main message, use personal scenes as supporting context, and verify names, date, location, and final typography before publishing.",
  primaryCta: "Create a Save the Date Video",
  secondaryCta: "Explore Scene Ideas",
  intentChips: ["Save the Date Video", "Wedding Date Announcement", "Couple Photos to Video", "Destination Wedding", "Identity + Date Review"],
  definitionTitle: "A date announcement first, a wedding invitation later.",
  definitionParagraphs: [
    "An AI Save the Date video is a short wedding-date announcement built around a confirmed date and approved couple visuals. Its main job is to help guests understand who is getting married and which date they should reserve.",
    "Engagement stories, proposal memories, rings, and locations can support the video. Formal RSVP, hosts, schedule, and venue logistics belong on the Wedding Invitation page."
  ],
  useCases: [
    ["Wedding website", "Use a landscape date reveal near the top of the site before travel and planning details."],
    ["Social announcement", "Plan a concise vertical or square edit with safe space around faces and date text."],
    ["Destination wedding", "Use scenic context when it supports the verified wedding story without inventing a real venue."],
    ["Family and friends", "A direct-to-camera or portrait-led version can feel personal for email and messaging."],
    ["From approved photos", "Use a small consistent set when the live product supports photo-to-video input."],
    ["Relationship story", "Add one or two familiar moments while keeping the confirmed date as the primary message."]
  ].map(([title, text]) => ({ title, text })),
  workflow: [
    ["Confirm the date", "Verify the wedding date before building a Save the Date version."],
    ["Select approved images", "Choose recognizable couple photos with enough room for responsive crops."],
    ["Choose one story structure", "Use a portrait, destination, or relationship beat that clearly leads to the date reveal."],
    ["Generate short scenes", "Separate portrait, walk, ring, destination, and closing frames for full-size review."],
    ["Add verified typography", "Keep names, date, location, URL, and invitation details in editable layers."],
    ["Review destination crops", "Check landscape, vertical, or square versions only where the live workflow supports them."]
  ].map(([title, text]) => ({ title, text })),
  scenes: [
    ["Planning together", "Review approved photos, names, confirmed date, wording, story order, and destination before publishing."],
    ["Personal city story", "A familiar-location walk adds relationship context without changing the page into an Engagement or Proposal page."],
    ["Destination mood", "Use scenic context for destination wedding inspiration while keeping real location claims separately verified."],
    ["Movement transition", "A walking shot can bridge the couple story and the final wedding-date announcement."],
    ["Ring detail", "Use only as supporting context; inspect fingers, jewelry geometry, reflections, and continuity at full size."],
    ["Proposal memory", "An optional backstory beat is fine; users looking for proposal storytelling can explore the Proposal page."],
    ["Milestone portrait", "A ring-reveal portrait can mark the relationship stage before the confirmed date becomes the main message."],
    ["Production planning", "Plan the final destination early so crops protect faces and verified date typography."]
  ].map(([title, text]) => ({ title, text })),
  quality: [
    "Identity — both people remain recognizable across scenes.",
    "Faces — inspect eyes, hairlines, teeth, ears, and facial edges at full resolution.",
    "Hands and jewelry — review fingers, nails, rings, earrings, shoulder straps, and contact points.",
    "Typography — add verified names, date, location, and URL in editable layers.",
    "Consent — use only images approved for the intended publishing context.",
    "Context — do not imply a real proposal, venue, customer story, or endorsement that did not occur."
  ],
  formats: [
    ["Landscape web version", "A wider frame works for website heroes and standard video players. Keep faces away from extreme edges so responsive crops remain possible."],
    ["Vertical social version", "Build a vertical composition intentionally when the live workflow supports it. Keep the couple and the date away from platform interface zones."],
    ["Square feed version", "Use a square version only where it improves placement. Reposition the crop and typography rather than shrinking the full landscape composition into the center."]
  ].map(([title, text]) => ({ title, text })),
  boundaries: [
    ["Engagement", "Engagement-led milestone and announcement storytelling."],
    ["Proposal", "The question, surprise, and proposal-specific story."],
    ["Wedding Invitation", "Formal wording, event logistics, and RSVP intent."]
  ].map(([title, text]) => ({ title, text })),
  faq: [
    ["What is an AI Save the Date video maker?", "It is a video-oriented workflow for turning approved couple visuals, a confirmed wedding date, and a short story plan into a Save the Date announcement. The date should stay clear and factual text should remain editable."],
    ["What should a Save the Date video include?", "At minimum, include a recognizable couple scene and the confirmed wedding date. Optional beats can include a favorite location, short relationship moment, ring detail, or direct message from the couple."],
    ["Can I make a Save the Date video from photos?", "Yes when the live product supports photo-to-video input and the people shown have approved the images for that use. Choose a small consistent set and review each generated scene before publishing."],
    ["Is a Save the Date video the same as a wedding invitation video?", "No. A Save the Date mainly asks guests to reserve a confirmed date. A wedding invitation carries formal venue, schedule, RSVP, host, and guest-facing information."],
    ["Can a proposal scene appear in a Save the Date video?", "Yes as a short backstory beat, but it should not dominate the page or final announcement. Users looking for proposal storytelling can explore the Proposal page."],
    ["How should I add the wedding date to AI-generated visuals?", "Add the verified date in an editable text or video layer after the visual is approved. Do not rely on generated text for names, dates, URLs, or event details."],
    ["Can I create a vertical Save the Date video for social media?", "Plan a vertical version when the live workflow supports it. Protect faces and date text from interface zones and review the final crop in the destination context."],
    ["What privacy checks should I make before using couple photos?", "Use approved photos, avoid unnecessary personal data, review the service's current storage and deletion practices, and do not upload sensitive images that are not required."]
  ].map(([question, answer], index) => ({ id: `save-the-date-faq-${index + 1}`, question, answer })),
  finalCtaHeading: "Make the date the main message.",
  finalCtaBody: "Confirm the wedding date, choose approved couple visuals, plan a short sequence, and complete a full identity and fact review before publishing.",
  finalCtaLabel: "Create a Save the Date Video"
};
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
  for (const line of lines) { if (!line.trim() || /^-{3,}$/.test(line.trim())) { flush(); continue; } if (/^#+\s+/.test(line.trim()) || /^(?:[-*]\s|\d+\.\s)/.test(line.trim())) { flush(); continue; } current.push(line.trim()); }
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
  const renderEntries = entries.filter((entry) => !/^shared site (?:header|footer)\b/i.test(entry) && !/^global header\b/i.test(entry));
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
  const titleFor = (index, fallback) => {
    const sourceTitle = structurePlan[index]?.title || h2[index] || fallback;
    if (config.key === "engagement") return [heading, "Announce the milestone before designing the invitation.", "What the workflow creates", "Choose one narrative before generating scenes.", "Build short scenes that are easy to review.", "Use concrete scenes instead of a generic romance montage.", "Keep the couple recognizable and the facts editable.", "Engagement is not the same query as every wedding page.", "Pre-publish review", "Product evidence required", "Questions couples ask before creating.", "Start with the couple, one clear message, and verified details."][index] || sourceTitle;
    if (config.key === "proposal") return [heading, "What Is an AI Proposal Video?", "Proposal Video Stories Built Around the Moment", "Setup → Build-Up → Proposal → Reaction → Close", "Six Practical Steps", "Use Existing Memories Without Turning the Page Into a Slideshow", "Review the Details Before Sharing", "Frequently Asked Questions", "Build the Proposal Video Around the Real Moment"][index] || sourceTitle;
    return sourceTitle;
  };
  const labelledCopy = (lines, label) => lines.find((line) => line.trim().toLowerCase().startsWith(`**${label.toLowerCase()}:**`))?.replace(/^\*\*[^:]+:\*\*\s*/, "").trim() || "";
  const heroPrimaryCta = labelledCopy(heroSource, "Primary CTA") || config.heroPrimaryCta || `Create ${heading}`;
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
  const proposalUseCases = config.key === "proposal"
    ? listItems(find("Proposal Video Use Cases")).map((text) => ({ title: text, text }))
    : [];
  const proposalStoryFlow = config.key === "proposal"
    ? [
      ["Setup", "Open with the location, context, and couple details before the proposal moment."],
      ["Build-up", "Use a short sequence that increases anticipation without inventing factual event details."],
      ["Proposal", "Hold on the central question and ring reveal as the story’s clear visual peak."],
      ["Reaction", "Give the answer, embrace, and authentic response enough screen time to read naturally."],
      ["Close", "Finish with a calm couple frame and editable message layer for the intended destination."]
    ].map(([title, text]) => ({ title, text }))
    : [];
  const workflow = h3(config.key === "proposal" ? "How It Works" : config.key === "engagement" ? "How to make an engagement Save the Date video" : "How to make a Save the Date video");
  const formats = h3(config.key === "engagement" ? "Engagement Save the Date video formats" : "Output and placement planning");
  const qualitySource = find(config.key === "proposal" ? "Accuracy and Quality" : config.key === "engagement" ? "Image selection standards|Video quality and identity standards" : "Image, identity, and publishing quality standards");
  const sceneSource = find(config.key === "proposal" ? "Scene Ideas" : config.key === "engagement" ? "Eight engagement video scene directions" : "Save the Date scene ideas");
  const boundariesSource = find(config.key === "engagement" ? "Engagement versus nearby video pages" : "Save the Date versus nearby wedding pages");
  const evidenceSource = find("First-party evidence|required before indexation|Evidence Gate");
  const sections = {};
  for (let index = 0; index < config.sectionIds.length; index += 1) {
    const id = config.sectionIds[index]; const type = config.sectionTypes[index]; const sectionId = `${config.pageKey}_${id.replace(/-/g, "_")}`;
    if (id === "hero") sections[sectionId] = { type, settings: { anchor: id, title: heading, intro: heroIntro, intentChips, primaryCta: heroPrimaryCta, primaryHref: "/app/create", secondaryCta: heroSecondaryCta, secondaryHref: `#${config.sectionIds[2]}`, ...imageSettings(manifest[0]) }, blocks: manifest.slice(0, 3).map((asset, index) => ({ id: `${config.key}-hero-visual-${index + 1}`, type: "hero_visual", settings: imageSettings(asset) })) };
    else if (id === "intent" || id === "definition") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "What this video page covers"), intro: paragraphs(find(config.key === "proposal" ? "What Is an AI Proposal Video" : config.key === "engagement" ? "What is an AI engagement" : "What is an AI Save the Date"))[0] || heroIntro, ...imageSettings(allocateImage(id)) }, blocks: paragraphs(find(config.key === "proposal" ? "What Is an AI Proposal Video" : config.key === "engagement" ? "What is an AI engagement" : "What is an AI Save the Date")).slice(1).map((text, n) => ({ id: `${config.key}-paragraph-${n + 1}`, type: "paragraph", settings: { text } })) };
    else if (id === "workflow-creates") {
      const createItems = listItems(find("What this page should help the couple create|What couples can create")).map((text) => ({ title: text, text }));
      sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "What the workflow creates") }, blocks: blocks(createItems, "scene_card", undefined, id) };
    }
    else if (id === "story-structures" || id === "story-flow") {
      const storyItems = id === "story-flow" && config.key === "proposal" ? proposalStoryFlow : story;
      const storyBlocks = blocks(storyItems, "story_card", undefined, id);
      if (config.key === "proposal" && id === "story-flow") {
        const storyAssets = [manifest[0], manifest[3], manifest[4], manifest[5], manifest[6]];
        storyBlocks.forEach((block, blockIndex) => { if (storyAssets[blockIndex]) block.settings = { ...block.settings, ...imageSettings(storyAssets[blockIndex]) }; });
      }
      sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Story structures") }, blocks: storyBlocks };
    }
    else if (id === "use-cases" || id === "scene-directions" || id === "scene-ideas") {
      const sceneItems = config.key === "proposal" && id === "use-cases"
        ? proposalUseCases
        : id === "use-cases" || config.key !== "save-the-date"
          ? (id === "use-cases" ? story : [{ title: "Scene direction", text: paragraphs(sceneSource).join(" ") }, ...listItems(sceneSource).map((text) => ({ title: text, text }))])
          : listItems(sceneSource).map((text) => ({ title: text, text }));
      const sceneBlocks = blocks(sceneItems, "scene_card", undefined, id);
      // The engagement design contract calls for eight concrete scene cards
      // with eight supporting visuals. Keep the introductory card text-only,
      // then map the eight non-hero assets to the eight scene directions in
      // the same order as the image manifest. These assets may also be reused
      // by the workflow/story sections; the page-level manifest remains the
      // canonical set of 11 unique media records.
      if (config.key === "engagement" && id === "scene-directions") {
        sceneBlocks.forEach((block, blockIndex) => {
          if (blockIndex === 0) return;
          const supportingAsset = manifest[blockIndex + 2];
          if (supportingAsset) block.settings = { ...block.settings, ...imageSettings(supportingAsset) };
        });
      }
      if (config.key === "save-the-date" && id === "scene-ideas") {
        sceneBlocks.forEach((block, blockIndex) => { const supportingAsset = manifest[blockIndex]; if (supportingAsset) block.settings = { ...block.settings, ...imageSettings(supportingAsset) }; });
      }
      if (config.key === "proposal" && id === "use-cases") {
        sceneBlocks.forEach((block, blockIndex) => { const supportingAsset = manifest[blockIndex + 3]; if (supportingAsset) block.settings = { ...block.settings, ...imageSettings(supportingAsset) }; });
      }
      sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Scene ideas") }, blocks: sceneBlocks };
    }
    else if (id === "workflow") {
      const workflowBlocks = blocks(workflow.length ? workflow : listItems(find("How to make|How It Works")).map((text) => ({ title: text, text })), "step", (item, n) => ({ number: n + 1, title: item.title, text: item.text }), id);
      const workflowAssets = config.key === "engagement" ? [manifest[5], manifest[5], manifest[6], manifest[3], manifest[10], manifest[10]] : config.key === "save-the-date" ? [manifest[3], manifest[3], manifest[7], manifest[8], manifest[10], manifest[10]] : [];
      workflowBlocks.forEach((block, blockIndex) => { const asset = workflowAssets[blockIndex]; if (asset) block.settings = { ...block.settings, ...imageSettings(asset) }; });
      sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "How it works"), ...(workflowAssets[0] ? imageSettings(workflowAssets[0]) : {}) }, blocks: workflowBlocks };
    }
    else if (id === "quality" || id === "accuracy") sections[sectionId] = { type: "editorial_quality", settings: { anchor: id, title: titleFor(index, "Quality and responsibility"), ...(config.key === "proposal" && id === "accuracy" ? imageSettings(manifest[9]) : {}) }, blocks: listItems(qualitySource).map((text, n) => ({ id: `${config.key}-quality-${n + 1}`, type: "quality_item", settings: { text } })) };
    else if (id === "formats") {
      const formatBlocks = blocks(formats, "format", undefined, id);
      const formatAssets = config.key === "engagement" ? [manifest[10], manifest[9], manifest[10]] : [manifest[10], manifest[6], manifest[9]];
      formatBlocks.forEach((block, blockIndex) => { const asset = formatAssets[blockIndex]; if (asset) block.settings = { ...block.settings, ...imageSettings(asset) }; });
      sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Output formats"), ...imageSettings(formatAssets[0]) }, blocks: formatBlocks };
    }
    else if (id === "boundaries") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Page boundaries") }, blocks: listItems(boundariesSource).map((text, n) => ({ id: `${config.key}-boundary-${n + 1}`, type: "boundary", settings: { text } })) };
    else if (id === "publishing") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Publishing checklist") }, blocks: listItems(find("Publishing checklist")).map((text, n) => ({ id: `${config.key}-publishing-${n + 1}`, type: "checklist_item", settings: { text } })) };
    else if (id === "source-media") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Source media guidance"), ...(config.key === "proposal" ? imageSettings(manifest[8]) : {}) }, blocks: listItems(find("How It Works|Source-Media Guidance")).map((text, n) => ({ id: `${config.key}-source-${n + 1}`, type: "guidance", settings: { text } })) };
    else if (id === "evidence") sections[sectionId] = { type, settings: { anchor: id, title: titleFor(index, "Evidence and review") }, blocks: [{ id: `${config.key}-evidence-1`, type: "evidence", settings: { text: paragraphs(evidenceSource).join(" ") || listItems(evidenceSource).join(" ") } }] };
    else if (id === "faq") sections[sectionId] = { type, settings: { anchor: id, title: "Frequently Asked Questions" }, blocks: faq.map((item) => ({ id: item.id, type: "faq_item", settings: item })) };
    else if (id === "final-cta") sections[sectionId] = { type, settings: { anchor: id, title: finalCtaHeading, intro: finalCtaBody, primaryCta: finalCtaLabel, primaryHref: "/app/create", secondaryCta: heroSecondaryCta, secondaryHref: `#${config.sectionIds[Math.min(2, config.sectionIds.length - 1)]}`, ...(config.key === "proposal" ? {} : imageSettings(allocateImage(id))) } };
  }

  if (config.key === "save-the-date") {
    // The Save the Date copy package intentionally mixes customer copy with
    // SEO and editorial notes. Apply the approved HTML prototype wording at
    // the final section boundary so no annotation can become visible copy.
    const section = (id) => sections[`${config.pageKey}_${id.replace(/-/g, "_")}`];
    const setBlockCopy = (id, items, limit = items.length) => {
      const target = section(id);
      if (!target) return;
      target.blocks = items.slice(0, limit).map((item, index) => ({
        ...(target.blocks?.[index] || { id: `${config.key}-${id}-${index + 1}`, type: "item", settings: {} }),
        settings: { ...(target.blocks?.[index]?.settings || {}), title: item.title, text: item.text }
      }));
    };
    const hero = section("hero");
    if (hero) hero.settings = { ...hero.settings, title: saveDatePublicCopy.heading, intro: saveDatePublicCopy.heroIntro, primaryCta: saveDatePublicCopy.primaryCta, secondaryCta: saveDatePublicCopy.secondaryCta, intentChips: saveDatePublicCopy.intentChips };
    const definition = section("definition");
    if (definition) {
      definition.settings = { ...definition.settings, title: saveDatePublicCopy.definitionTitle, intro: saveDatePublicCopy.definitionParagraphs[0] };
      definition.blocks = saveDatePublicCopy.definitionParagraphs.slice(1).map((text, index) => ({ id: `${config.key}-paragraph-${index + 1}`, type: "paragraph", settings: { text } }));
    }
    setBlockCopy("use-cases", saveDatePublicCopy.useCases);
    const useCases = section("use-cases");
    if (useCases) useCases.settings = { ...useCases.settings, title: "Build for the place guests will actually see it." };
    const workflowSection = section("workflow");
    if (workflowSection) {
      workflowSection.settings = { ...workflowSection.settings, title: "Make each scene easy to review before publishing." };
      setBlockCopy("workflow", saveDatePublicCopy.workflow);
      workflowSection.blocks = workflowSection.blocks.map((block, index) => ({ ...block, settings: { ...block.settings, ...saveDatePublicCopy.workflow[index], number: index + 1 } }));
    }
    const sceneSection = section("scene-ideas");
    if (sceneSection) {
      sceneSection.settings = { ...sceneSection.settings, title: "Use concrete visuals instead of a generic wedding montage." };
      sceneSection.blocks = saveDatePublicCopy.scenes.map((item, index) => ({
        ...(sceneSection.blocks?.[index] || { id: `${config.key}-scene_card-${index + 1}`, type: "scene_card", settings: {} }),
        settings: { ...(sceneSection.blocks?.[index]?.settings || {}), ...item, ...imageSettings(manifest[index + 3]) }
      }));
    }
    const quality = section("quality");
    if (quality) {
      quality.settings = { ...quality.settings, title: "Keep people believable and factual details editable." };
      quality.blocks = saveDatePublicCopy.quality.map((text, index) => ({ id: `${config.key}-quality-${index + 1}`, type: "quality_item", settings: { text } }));
    }
    setBlockCopy("formats", saveDatePublicCopy.formats);
    const formatsSection = section("formats");
    if (formatsSection) formatsSection.settings = { ...formatsSection.settings, title: "Output and placement planning" };
    const boundaries = section("boundaries");
    if (boundaries) {
      boundaries.settings = { ...boundaries.settings, title: "Save the Date owns the date announcement — not every wedding query." };
      boundaries.blocks = saveDatePublicCopy.boundaries.map((item, index) => ({ id: `${config.key}-boundary-${index + 1}`, type: "boundary", settings: item }));
    }
    const faqSection = section("faq");
    if (faqSection) {
      faqSection.settings = { ...faqSection.settings, title: "Questions couples ask before creating a Save the Date video." };
      faqSection.blocks = saveDatePublicCopy.faq.map((item) => ({ id: item.id, type: "faq_item", settings: { question: item.question, answer: item.answer } }));
    }
    const cta = section("final-cta");
    if (cta) cta.settings = { ...cta.settings, title: saveDatePublicCopy.finalCtaHeading, intro: saveDatePublicCopy.finalCtaBody, primaryCta: saveDatePublicCopy.finalCtaLabel, secondaryCta: saveDatePublicCopy.secondaryCta };
  }
  stripMydreamshootsP1SeasonalDuplicateText({ sections }, config.pagePath);
  const publishedLinkTargets = new Set([
    "/ai-save-the-date/valentines-day",
    "/ai-save-the-date/engagement",
    "/ai-save-the-date/proposal",
    "/ai-save-the-date/save-the-date",
    "/workflow",
    "/best-packages",
    "/pricing"
  ]);
  const relatedLinks = csvRows(path.join(config.sourceDir, "10_internal_link_plan.csv"))
    .map((row) => ({ href: clean(row[1]), label: clean(row[2]) }))
    .filter((item) => item.href && item.label && publishedLinkTargets.has(item.href))
    .filter((item) => item.href !== config.pagePath)
    .filter((item, index, items) => items.findIndex((candidate) => candidate.href === item.href) === index);
  const customerSections = JSON.parse(JSON.stringify(sections, (_key, value) => typeof value === "string" ? (config.key === "save-the-date" ? value : customerText(value)) : value));
  const indexable = true;
  return { ...config, heading, seo, manifest, structurePlan, sections: customerSections, relatedLinks, pageJson: { pageType: "standard-content", version: 1, sectionsOrder: config.sectionIds.map((id) => `${config.pageKey}_${id.replace(/-/g, "_")}`), contentContract: { schema: "editorial-page-v1", pageKey: config.pageKey, requiredSections: config.sectionIds, sectionTypes: config.sectionTypes, faqCount: config.faqCount, mediaCount: config.mediaCount, sourceRevision: `${config.key}-plan-20260824` }, relatedLinks, mediaManifest: manifest, seo: { title: seo.title || seo.title_tag || seo.title, description: seo.meta_description || seo.meta_description, keywords: seo.secondary_keyword || seo.secondary_keywords, canonicalPath: config.pagePath, canonical: seo.canonical || `https://www.mydreamshoots.com${config.pagePath}`, ogImage: manifest[0].src, index: indexable, follow: true, robots: { index: indexable, follow: true, maxImagePreview: "large" } }, sections: customerSections } };
}

const jiti = createJiti(import.meta.url);
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { buildPublicationSnapshot, prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient();
try {
  const parsed = packages.map(parsePackage);
  for (const item of parsed) {
    const targetDir = path.join(repoRoot, "public/assets/dreamshoot/save-the-date", item.key);
    fs.mkdirSync(targetDir, { recursive: true });
    for (const asset of item.manifest) {
      const targetPath = path.join(targetDir, asset.filename);
      const sourcePath = asset.src === "/assets/dreamshoot/generated/pack-galleries/wedding-portraits/wedding-portraits-01.webp"
        ? path.join(repoRoot, "public", asset.src.replace(/^\//, ""))
        : path.join(item.sourceDir, "images", asset.filename);
      fs.copyFileSync(sourcePath, targetPath);
      fs.chmodSync(targetPath, 0o644);
    }
  }
  const siteRecord = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, connect: true } });
  if (!siteRecord) throw new Error(`Site not found: ${siteId}`);
  await prisma.$transaction(async (tx) => {
    const settings = siteRecord.settings?.draftJson || siteRecord.settings?.publishedJson || {};
    // Keep the public menu contract aligned with the current editorial
    // catalogue: six Love & Wedding entries and six Seasonal Holidays entries.
    const loveNavigationPaths = [
      "/ai-save-the-date/valentines-day",
      "/ai-save-the-date/engagement",
      "/ai-save-the-date/proposal",
      "/ai-save-the-date/save-the-date",
      "/ai-save-the-date/wedding-invitation",
      "/ai-save-the-date/wedding-ceremony"
    ];
    const seasonalNavigationPaths = [
      "/ai-save-the-date/christmas",
      "/ai-save-the-date/halloween",
      "/ai-save-the-date/thanksgiving",
      "/ai-save-the-date/new-year",
      "/ai-save-the-date/mothers-day",
      "/ai-save-the-date/fathers-day"
    ];
    const navigationPaths = [...loveNavigationPaths, ...seasonalNavigationPaths];
    const parsedByPath = new Map(parsed.map((item) => [item.pagePath, item]));
    const navigationItem = (href, sortOrder) => {
      const parsedItem = parsedByPath.get(href);
      const page = pageForPath(siteRecord.pages, href);
      const json = parsedItem?.pageJson || page?.draftJson || page?.publishedJson;
      const hero = json?.sections?.[json.sectionsOrder?.[0]]?.settings || {};
      const media = json?.mediaManifest?.[0];
      const topic = Object.values(json?.sections || {}).find((section) => section?.type === "ai_video_topic_landing")?.settings?.content;
      const label = navigationLabels.get(href)
        || (parsedItem?.key === "save-the-date" ? "Save the Date" : undefined)
        || page?.title
        || href.split("/").filter(Boolean).pop()?.replace(/-/g, " ")
        || href;
      return {
        label,
        slug: href.split("/").filter(Boolean).pop() || href,
        href,
        status: "published",
        sortOrder,
        description: String(topic?.seo?.description || hero.intro || json?.seo?.description || "").trim(),
        imageUrl: String(hero.imageUrl || media?.src || topic?.hero?.image?.src || "").trim(),
        imageAlt: String(hero.imageAlt || media?.alt || topic?.hero?.image?.alt || "").trim()
      };
    };
    const groups = [{
      label: "Love & Wedding",
      slug: "love-wedding",
      sortOrder: 1,
      items: loveNavigationPaths.map((href, index) => navigationItem(href, index + 1))
    }, {
      label: "Seasonal Holidays",
      slug: "seasonal-holidays",
      sortOrder: 2,
      items: seasonalNavigationPaths.map((href, index) => navigationItem(href, index + 1))
    }];
    const nextSettings = { ...settings, saveTheDateNavigation: { menuLabel: settings.saveTheDateNavigation?.menuLabel || "Save the Date", groups } };
    await tx.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: nextSettings, publishedJson: {} }, update: { draftJson: nextSettings } });
    for (const item of parsed) {
      const pageId = `page_${siteId}_${item.key.replace(/[^a-z0-9]+/gi, "_")}`;
      await tx.themePage.upsert({ where: { siteId_slug: { siteId, slug: item.pagePath } }, create: { id: pageId, siteId, pageType: "standard-content", templateKey: "save-the-date-editorial", slug: item.pagePath, title: item.heading, draftJson: item.pageJson, publishedJson: {} }, update: { pageType: "standard-content", templateKey: "save-the-date-editorial", title: item.heading, draftJson: item.pageJson } });
      for (const asset of item.manifest) {
        const assetId = `media_${siteId}_${crypto.createHash("sha1").update(asset.src).digest("hex").slice(0, 16)}`;
        await tx.mediaAsset.upsert({ where: { siteId_storageKey: { siteId, storageKey: asset.src } }, create: { id: assetId, siteId, label: asset.filename, storageKey: asset.src, mimeType: "image/jpeg", usageType: "theme", sourceType: `save-the-date-${item.key}-source`, previewUrl: asset.src, originUrl: asset.src, altText: asset.alt, notes: asset.caption }, update: { altText: asset.alt, notes: asset.caption, previewUrl: asset.src, originUrl: asset.src } });
      }
    }
  }, { maxWait: 20_000, timeout: 120_000 });
  const fresh = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, connect: true } });
  const site = toSite(fresh);
  const packs = await prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true } });
  const products = await prisma.product.findMany({ where: { siteId }, include: { prices: true } });
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products.map(mapProduct));
  const integrity = publicationSnapshotIntegrity(snapshot);
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({ siteId, mode: "draft-only", pages: parsed.map((item) => ({ key: item.key, path: item.pagePath, media: item.manifest.length, faq: item.faqCount })), snapshotHash: snapshot.snapshotHash, manifestHash: manifest.manifestHash, snapshotIntegrity: integrity, publicationRequired: true }, null, 2));
} finally { await prisma.$disconnect(); }
