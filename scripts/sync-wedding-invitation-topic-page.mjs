#!/usr/bin/env node
import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const sourceDir = path.resolve(process.env.WEDDING_INVITATION_SOURCE_DIR || "docs/design-packages/ai-wedding-invitation-maker-final");
const siteId = process.env.WEDDING_INVITATION_SITE_ID || "site_dreamshoot";
const pagePath = "/ai-save-the-date/wedding-invitation";
const apply = process.argv.includes("--apply");
const sourceRoot = path.join(repoRoot, "src");
const originalLoad = Module._load;
Module._load = function load(request, ...args) { if (request === "server-only") return {}; return originalLoad.call(this, request, ...args); };
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function resolve(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const aliased = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  const resolved = request.startsWith("@/") && !path.extname(aliased) ? `${aliased}.ts` : aliased;
  return originalResolve.call(this, resolved, ...args);
};

const read = (file) => fs.readFileSync(path.join(sourceDir, file), "utf8").replace(/^\uFEFF/, "");
const clean = (value) => String(value ?? "").replace(/`([^`]+)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\s+/g, " ").trim();
function csvRows(file) {
  return read(file).trim().split(/\r?\n/).map((line) => {
    const values = []; let current = ""; let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') { if (quoted && line[i + 1] === '"') { current += '"'; i += 1; } else quoted = !quoted; }
      else if (ch === "," && !quoted) { values.push(current); current = ""; } else current += ch;
    }
    values.push(current); return values.map((value) => value.trim().replace(/^"|"$/g, ""));
  }).filter((row) => row.some(Boolean));
}
function markdownSections(markdown) {
  const lines = markdown.split(/\r?\n/); const sections = new Map();
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^##\s+(.+)$/); if (!match) continue;
    const end = lines.findIndex((line, n) => n > i && /^##\s+/.test(line));
    sections.set(clean(match[1]).toLowerCase(), lines.slice(i + 1, end < 0 ? lines.length : end));
  }
  return sections;
}
function paragraphs(lines) {
  const out = []; let current = [];
  const flush = () => { const value = clean(current.join(" ")); if (value) out.push(value); current = []; };
  for (const line of lines) { if (!line.trim() || /^-{3,}$/.test(line.trim())) flush(); else if (/^(?:###|[-*]\s+|\d+[.)]\s+)/.test(line.trim())) flush(); else current.push(line.trim()); }
  flush(); return out;
}
function headingBlocks(lines) {
  const out = []; let current;
  for (const line of lines) { const match = line.match(/^###\s+(.+)$/); if (match) { if (current) out.push(current); current = { title: clean(match[1]), lines: [] }; } else if (current) current.lines.push(line); }
  if (current) out.push(current);
  return out.map((item) => ({ title: item.title, text: paragraphs(item.lines).join(" ") })).filter((item) => item.title && item.text);
}
function listItems(lines) { return lines.filter((line) => /^(?:[-*]|\d+[.)])\s+/.test(line.trim())).map((line) => clean(line.trim().replace(/^(?:[-*]|\d+[.)])\s+/, ""))).filter(Boolean); }
function section(key, type, title, intro, blocks = []) { return { type, settings: { anchor: key.replace(/_/g, "-"), title, ...(intro ? { intro } : {}) }, blocks }; }

const seoRows = Object.fromEntries(csvRows("06_seo_config.csv").slice(1).map(([key, value]) => [clean(key).toLowerCase().replace(/[^a-z0-9]+/g, "_"), clean(value)]));
const markdown = read("01_page_copy_final.md");
const content = markdownSections(markdown);
const copySection = (name) => content.get(name.toLowerCase()) || [];
const heroLines = copySection("Hero");
const heroHeading = seoRows.h1 || "Create a Personalized Wedding Invitation with AI";
const heroIntro = paragraphs(heroLines)[0] || seoRows.meta;
const manifestRows = csvRows("11_image_manifest_and_alt.csv");
const [, ...manifestData] = manifestRows;
const imageManifest = manifestData.map((row) => {
  const [filename, alt, caption, role] = row;
  const src = `/assets/dreamshoot/wedding-invitation/${filename}`;
  return { filename, src, alt: clean(alt), caption: clean(caption), role: /^hero/i.test(role) ? "hero" : "content", width: 1600, height: 1000, loading: /^hero/i.test(role) ? "eager" : "lazy", fetchPriority: /^hero/i.test(role) ? "high" : "auto" };
});
if (imageManifest.length !== 10 || new Set(imageManifest.map((item) => item.src)).size !== 10) throw new Error("Wedding Invitation image manifest must contain 10 unique images");
for (const image of imageManifest) if (!fs.existsSync(path.join(repoRoot, "public", image.src.slice(1)))) throw new Error(`Missing image: ${image.src}`);

const styleBlocks = headingBlocks(copySection("Invitation Styles and Use Cases"));
const doAvoid = listItems(copySection("What Makes a Wedding Invitation Work?")).map((text, index) => ({ id: `wedding-invitation-guidance-${index + 1}`, type: "guidance", settings: { text } }));
const flowBlocks = listItems(copySection("Invitation Creation Flow")).map((text, index) => { const [title, body] = text.split(" — "); return { id: `wedding-invitation-step-${index + 1}`, type: "step", settings: { number: index + 1, title: title || text, text: body || text } }; });
const faqBlocks = headingBlocks(copySection("FAQ")).map((item, index) => ({ id: `wedding-invitation-faq-${index + 1}`, type: "faq_item", settings: { question: item.title, answer: item.text } }));
if (faqBlocks.length !== 8) throw new Error(`Wedding Invitation FAQ must contain 8 items, got ${faqBlocks.length}`);

const sections = {
  wedding_invitation_hero: { type: "editorial_hero", settings: { anchor: "hero", eyebrow: seoRows.primary_keyword || "AI wedding invitation maker", title: heroHeading, intro: heroIntro, primaryCta: "Create Your Wedding Invitation", primaryHref: "/app/create", secondaryCta: "Explore Invitation Styles", secondaryHref: "#styles-use-cases", imageUrl: imageManifest[2].src, imageAlt: imageManifest[2].alt, imageWidth: 1600, imageHeight: 1000, imageLoading: "eager", imageFetchPriority: "high", themeTone: "wedding" }, blocks: imageManifest.slice(0, 3).map((image, index) => ({ id: `wedding-invitation-hero-${index + 1}`, type: "hero_visual", settings: { imageUrl: image.src, imageAlt: image.alt, imageWidth: 1600, imageHeight: 1000, imageLoading: "eager", imageFetchPriority: "high" } })) },
  wedding_invitation_what_is: section("what_is", "editorial_rich_text", "What Is an AI Wedding Invitation Maker?", paragraphs(copySection("What Is an AI Wedding Invitation Maker?"))[0], paragraphs(copySection("What Is an AI Wedding Invitation Maker?")).slice(1).map((text, i) => ({ id: `wedding-invitation-what-is-${i + 1}`, type: "paragraph", settings: { text } }))),
  wedding_invitation_styles_use_cases: section("styles_use_cases", "editorial_scene_grid", "Invitation Styles and Use Cases", "Choose a visual direction that supports the celebration and keeps guest information easy to scan.", styleBlocks.map((item, i) => ({ id: `wedding-invitation-style-${i + 1}`, type: "scene_card", settings: { title: item.title, text: item.text, imageUrl: imageManifest[(i + 3) % imageManifest.length].src, imageAlt: imageManifest[(i + 3) % imageManifest.length].alt } }))),
  wedding_invitation_what_works: section("what_works", "editorial_quality", "What Makes a Wedding Invitation Work?", "Keep the event details clear, editable, and easy for guests to verify.", doAvoid),
  wedding_invitation_creation_flow: section("creation_flow", "editorial_steps", "Invitation Creation Flow", "Move from the wedding direction to a reviewed, shareable invitation.", flowBlocks),
  wedding_invitation_information: section("information", "editorial_rich_text", "What Information Should a Wedding Invitation Include?", paragraphs(copySection("What Information Should a Wedding Invitation Include?"))[0]),
  wedding_invitation_vs_save_date: section("vs_save_date", "editorial_boundaries", "Wedding Invitation vs. Save the Date", paragraphs(copySection("Wedding Invitation vs. Save the Date"))[0], [{ id: "wedding-invitation-vs-save-date-1", type: "boundary", settings: { text: paragraphs(copySection("Wedding Invitation vs. Save the Date"))[0] } }]),
  wedding_invitation_accuracy: section("accuracy", "editorial_quality", "Accuracy and Editable Details", "Names, dates, venues, RSVP instructions, URLs, and contact information stay editable so they can be checked independently from the artwork.", [{ id: "wedding-invitation-accuracy-1", type: "quality_item", settings: { text: "Keep all event-critical details in editable fields and proofread them before sharing or printing." } }]),
  wedding_invitation_faq: { type: "faq", settings: { anchor: "faq", title: "Frequently Asked Questions" }, blocks: faqBlocks },
  wedding_invitation_final_cta: { type: "editorial_cta", settings: { anchor: "final-cta", title: "Create an Invitation That Feels Like the Wedding", intro: paragraphs(copySection("Final CTA"))[0], primaryCta: "Create Your Wedding Invitation", primaryHref: "/app/create", secondaryCta: "Explore Invitation Styles", secondaryHref: "#styles-use-cases", imageUrl: imageManifest[9].src, imageAlt: imageManifest[9].alt, imageWidth: 1600, imageHeight: 1000, themeTone: "wedding" } }
};
const sectionsOrder = Object.keys(sections);
const pageJson = { pageType: "standard-content", version: 1, sectionsOrder, contentContract: { schema: "editorial-page-v1", pageKey: "wedding_invitation", requiredSections: ["hero", "what-is", "styles-use-cases", "what-works", "creation-flow", "information", "vs-save-date", "accuracy", "faq", "final-cta"], sectionTypes: sectionsOrder.map((id) => sections[id].type), faqCount: faqBlocks.length, mediaCount: imageManifest.length, sourceRevision: "wedding-invitation-package-20260824" }, relatedLinks: [{ href: "/ai-save-the-date/save-the-date", label: "save the date ideas" }, { href: "/ai-save-the-date/engagement", label: "engagement announcement ideas" }, { href: "/ai-save-the-date/wedding-ceremony", label: "wedding ceremony ideas" }], mediaManifest: imageManifest, seo: { title: seoRows.title, description: seoRows.meta_description, keywords: seoRows.secondary_keywords, canonicalPath: pagePath, canonical: seoRows.canonical, ogImage: imageManifest[2].src, index: false, follow: true, robots: { index: false, follow: true, maxImagePreview: "large" } }, sections };

const jiti = createJiti(import.meta.url);
const { prepareDraftPublishManifestRelational } = jiti("../src/lib/stores/theme-store.ts");
const prisma = new PrismaClient();
try {
  const pageId = `page_${siteId}_holidays_events_wedding_invitation`;
  const settingsRecord = await prisma.themeSettings.findUnique({ where: { siteId } });
  const settings = structuredClone(settingsRecord?.draftJson || settingsRecord?.publishedJson || {});
  const navigation = settings.saveTheDateNavigation;
  if (navigation?.groups) for (const group of navigation.groups) for (const item of group.items || []) if (item.href === pagePath) Object.assign(item, { label: "Wedding Invitation", description: heroIntro, imageUrl: imageManifest[2].src, imageAlt: imageManifest[2].alt, status: "published" });
  if (apply) await prisma.$transaction(async (tx) => {
    await tx.themePage.upsert({ where: { siteId_slug: { siteId, slug: pagePath } }, create: { id: pageId, siteId, pageType: "standard-content", templateKey: "wedding-invitation-editorial", slug: pagePath, title: heroHeading, draftJson: pageJson, publishedJson: {} }, update: { pageType: "standard-content", templateKey: "wedding-invitation-editorial", title: heroHeading, draftJson: pageJson } });
    for (const image of imageManifest) await tx.mediaAsset.upsert({ where: { siteId_storageKey: { siteId, storageKey: image.src } }, create: { id: `media_${siteId}_wedding_invitation_${crypto.createHash("sha1").update(image.src).digest("hex").slice(0, 16)}`, siteId, label: image.filename, storageKey: image.src, mimeType: "image/jpeg", usageType: "theme", sourceType: "wedding-invitation-package", previewUrl: image.src, originUrl: image.src, altText: image.alt, notes: image.caption }, update: { altText: image.alt, notes: image.caption, previewUrl: image.src, originUrl: image.src } });
    if (navigation) await tx.themeSettings.update({ where: { siteId }, data: { draftJson: settings } });
  });
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  console.log(JSON.stringify({ ok: true, siteId, mode: apply ? "draft-only" : "dry-run", pagePath, pageKey: pageJson.contentContract.pageKey, h1: heroHeading, faqCount: faqBlocks.length, mediaCount: imageManifest.length, indexable: pageJson.seo.index, manifestHash: manifest.manifestHash, publicationRequired: true }, null, 2));
} finally { await prisma.$disconnect(); }
