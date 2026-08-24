#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const sourcePackageRoot = process.env.SEASONAL_SOURCE_ROOT || "/tmp/mydreamshoots-seasonal-packages.83JYeu";
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

const siteId = process.env.SEASONAL_SITE_ID || "site_dreamshoot";
const configs = [
  {
    key: "wedding-ceremony",
    sourceDir: process.env.SEASONAL_WEDDING_SOURCE_DIR || path.join(sourcePackageRoot, "ai-wedding-ceremony-photo-video"),
    pagePath: "/ai-video-generation/wedding-ceremony",
    pageKey: "wedding_ceremony",
    tone: "wedding",
    sections: [
      ["hero", "editorial_hero", "Hero"],
      ["definition", "editorial_rich_text", "What Is an AI Wedding Ceremony Photo Video"],
      ["reasons", "editorial_story_grid", "Six Real Reasons to Build a Wedding Ceremony Video"],
      ["sources", "editorial_quality", "Start With Ceremony Source Photos the Model Can Read"],
      ["workflow", "editorial_steps", "Four Steps From Ceremony Photos to a Reviewable Story"],
      ["scene-ideas", "editorial_scene_grid", "Wedding Ceremony Scene Ideas"],
      ["quality", "editorial_quality", "Review the Ceremony, Not Just One Pretty Frame"],
      ["boundaries", "editorial_boundaries", "Wedding Ceremony vs Nearby Wedding Pages"],
      ["faq", "faq", "FAQ"],
      ["final-cta", "editorial_cta", "Final CTA"]
    ]
  },
  {
    key: "thanksgiving",
    sourceDir: process.env.SEASONAL_THANKSGIVING_SOURCE_DIR || path.join(sourcePackageRoot, "ai-thanksgiving-photo-and-video-final"),
    pagePath: "/holidays-events/thanksgiving",
    pageKey: "thanksgiving",
    tone: "thanksgiving",
    sections: [
      ["hero", "editorial_hero", "Hero"],
      ["definition", "editorial_rich_text", "What Is an AI Thanksgiving Photo and Video Generator"],
      ["use-cases", "editorial_scene_grid", "Use Cases"],
      ["quality", "editorial_quality", "Do / Avoid"],
      ["workflow", "editorial_steps", "How It Works"],
      ["scene-ideas", "editorial_scene_grid", "Scene Ideas"],
      ["formats", "editorial_formats", "Photo and Video Direction"],
      ["market", "editorial_rich_text", "North American Holiday Focus"],
      ["faq", "faq", "FAQ"],
      ["final-cta", "editorial_cta", "Final CTA"]
    ]
  },
  {
    key: "christmas",
    sourceDir: process.env.SEASONAL_CHRISTMAS_SOURCE_DIR || path.join(sourcePackageRoot, "ai-christmas-photo-and-video-final"),
    pagePath: "/holidays-events/christmas",
    pageKey: "christmas",
    tone: "christmas",
    sections: [
      ["hero", "editorial_hero", "Hero"],
      ["definition", "editorial_rich_text", "What Is AI Christmas Photo and Video Creation"],
      ["photo-ideas", "editorial_story_grid", "Christmas Photo Ideas"],
      ["video-ideas", "editorial_story_grid", "Christmas Video Ideas"],
      ["workflow", "editorial_steps", "How It Works"],
      ["scene-ideas", "editorial_scene_grid", "Christmas Scene Ideas"],
      ["quality", "editorial_quality", "What to Check Before Sharing AI Christmas Content"],
      ["formats", "editorial_rich_text", "Christmas Photo vs Christmas Video"],
      ["faq", "faq", "FAQ"],
      ["final-cta", "editorial_cta", "Build the Holiday Scene Around a Real Christmas Use Case"]
    ]
  },
  {
    key: "new-year",
    sourceDir: process.env.SEASONAL_NEW_YEAR_SOURCE_DIR || path.join(sourcePackageRoot, "ai-new-year-photo-and-video-final"),
    pagePath: "/holidays-events/new-year",
    pageKey: "new_year",
    tone: "new-year",
    sections: [
      ["hero", "editorial_hero", "Hero"],
      ["definition", "editorial_rich_text", "What is an AI New Year photo and video maker"],
      ["scene-ideas", "editorial_scene_grid", "Scene ideas for New Year photos and videos"],
      ["direction", "editorial_rich_text", "What makes New Year content work"],
      ["workflow", "editorial_steps", "How it works"],
      ["use-cases", "editorial_scene_grid", "Use cases"],
      ["quality", "editorial_quality", "What makes a New Year image usable on a website"],
      ["faq", "faq", "FAQ"],
      ["final-cta", "editorial_cta", "Final CTA"]
    ]
  }
];

const read = (file) => fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
const clean = (value) => String(value ?? "")
  .replace(/`([^`]+)`/g, "$1")
  .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
  .replace(/\*\*([^*]+)\*\*/g, "$1")
  .replace(/\*([^*]+)\*/g, "$1")
  .replace(/\s+/g, " ")
  .trim();

function csvRows(file) {
  return read(file).trim().split(/\r?\n/).map((line) => {
    const values = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"') {
        if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) { values.push(current); current = ""; }
      else current += char;
    }
    values.push(current);
    return values.map((value) => value.trim().replace(/^"|"$/g, ""));
  }).filter((row) => row.some(Boolean));
}

function csvObjects(file) {
  const rows = csvRows(file);
  const headers = rows.shift().map((value) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  return rows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
}

function markdownSections(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = new Map();
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^##\s+(.+)$/);
    if (!match) continue;
    const title = clean(match[1]);
    const end = lines.findIndex((line, candidate) => candidate > index && /^##\s+/.test(line));
    sections.set(title.toLowerCase(), lines.slice(index + 1, end < 0 ? lines.length : end));
  }
  return sections;
}

function paragraphs(lines) {
  const result = [];
  let current = [];
  const flush = () => { const value = clean(current.join(" ")); if (value) result.push(value); current = []; };
  for (const line of lines) {
    if (!line.trim() || /^-{3,}$/.test(line.trim())) { flush(); continue; }
    if (/^(?:###|[-*]\s+|\d+[.)]\s+)/.test(line.trim())) { flush(); continue; }
    current.push(line.trim());
  }
  flush();
  return result;
}

function listItems(lines) {
  return lines
    .filter((line) => /^(?:[-*]|\d+[.)])\s+/.test(line.trim()))
    .map((line) => clean(line.trim().replace(/^(?:[-*]|\d+[.)])\s+/, "")))
    .filter(Boolean);
}

function headingBlocks(lines) {
  const blocks = [];
  let current;
  for (const line of lines) {
    const match = line.match(/^###\s+(.+)$/);
    if (match) {
      if (current) blocks.push(current);
      current = { title: clean(match[1]), lines: [] };
    } else if (current) current.lines.push(line);
  }
  if (current) blocks.push(current);
  return blocks.map((item) => ({ title: item.title, text: paragraphs(item.lines).join(" ") })).filter((item) => item.title && item.text);
}

function sectionFor(sections, title) {
  const target = title.toLowerCase();
  const exact = sections.get(target);
  if (exact) return exact;
  const found = [...sections.entries()].find(([key]) => key.includes(target) || target.includes(key));
  return found?.[1] || [];
}

function parseSeo(file) {
  return Object.fromEntries(csvRows(file).slice(1).map(([key, value]) => [clean(key).toLowerCase().replace(/[^a-z0-9]+/g, "_"), clean(value)]));
}

function parseManifest(config) {
  const file = path.join(config.sourceDir, "11_image_manifest_and_alt.csv");
  const rows = csvObjects(file);
  const images = rows.map((row) => {
    const dimensions = String(row.dimensions || "1600x1000").replace("×", "x").split("x").map(Number);
    const role = /^hero/i.test(row.scene_role || row.role || "") ? "hero" : "content";
    const filename = row.filename;
    return {
      filename,
      role,
      alt: clean(row.alt_text || row.alt),
      caption: clean(row.caption),
      width: dimensions[0] || 1600,
      height: dimensions[1] || 1000,
      loading: role === "hero" ? "eager" : "lazy",
      fetchPriority: role === "hero" ? "high" : "auto",
      src: `/assets/dreamshoot/seasonal/${config.key}/${filename}`
    };
  });
  if (images.length !== 11 || images.some((image) => !image.filename || !image.alt || image.width !== 1600 || image.height !== 1000)) {
    throw new Error(`${config.key}: image manifest must contain 11 complete 1600x1000 images`);
  }
  for (const image of images) {
    if (!fs.existsSync(path.join(config.sourceDir, "images", image.filename))) throw new Error(`${config.key}: missing image ${image.filename}`);
  }
  return images;
}

function normalizeInternalPath(value) {
  const raw = clean(value);
  if (!raw) return "";
  try {
    return new URL(raw, "https://www.mydreamshoots.com").pathname.replace(/\/$/, "") || "/";
  } catch {
    return raw.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  }
}

function packageInternalLinks(config, availablePaths) {
  const file = path.join(config.sourceDir, "10_internal_link_plan.csv");
  if (!fs.existsSync(file)) return [];
  const rows = csvObjects(file);
  return rows.map((row) => {
    const href = normalizeInternalPath(row.destination || row.target_url || row.target || row.url);
    const label = clean(row.anchor_text || row.anchor || row.anchor_context || row.context);
    return { href, label };
  }).filter((item) => item.href && item.label && availablePaths.has(item.href))
    .filter((item, index, values) => values.findIndex((candidate) => candidate.href === item.href) === index)
    .slice(0, 6);
}

function imageSettings(image) {
  return { imageUrl: image.src, imageAlt: image.alt, imageWidth: image.width, imageHeight: image.height, imageLoading: image.loading, imageFetchPriority: image.fetchPriority };
}

function blockFromText(config, type, text, index, images, imageOffset = 0) {
  const value = typeof text === "string" ? text : text.text;
  const title = typeof text === "string" ? text.split(/\s+[—:-]\s+/)[0] : text.title;
  const image = images[(index + imageOffset) % images.length];
  return { id: `${config.key}-${type}-${index + 1}`, type, settings: { title: clean(title), text: clean(value), ...imageSettings(image) } };
}

function firstParagraph(lines, fallback) {
  return paragraphs(lines)[0] || fallback;
}

function buildPage(config) {
  for (const required of ["01_page_copy_final.md", "02_page_structure_final.md", "06_seo_config.csv", "11_image_manifest_and_alt.csv"]) {
    if (!fs.existsSync(path.join(config.sourceDir, required))) throw new Error(`${config.key}: missing ${required}`);
  }
  const markdown = read(path.join(config.sourceDir, "01_page_copy_final.md"));
  const sections = markdownSections(markdown);
  const seo = parseSeo(path.join(config.sourceDir, "06_seo_config.csv"));
  const images = parseManifest(config);
  const heading = seo.h1 || markdown.match(/^#\s+(.+)$/m)?.[1] || seo.title || config.key;
  const imageFor = (index) => images[index % images.length];
  const sectionRows = config.sections;
  const sectionIds = sectionRows.map(([id]) => id);
  const sectionTypes = sectionRows.map(([, type]) => type);
  const faqSource = sectionFor(sections, "faq");
  const faqItems = headingBlocks(faqSource).map((item, index) => ({ id: `${config.key}-faq-${index + 1}`, question: item.title, answer: item.text }));
  const safeFaqItems = faqItems.length >= 4 ? faqItems : [
    { id: `${config.key}-faq-1`, question: `What is ${heading.replace(/^Create\s+/i, "").replace(/\s+with AI$/i, "")}?`, answer: firstParagraph(sectionFor(sections, "What Is"), seo.meta_description || seo.meta_description || "Review the published page details before creating seasonal content.") },
    { id: `${config.key}-faq-2`, question: "What source images work best?", answer: "Use clear, well-lit images you own or have permission to use, with the main people, pets, or objects visible and easy to review." },
    { id: `${config.key}-faq-3`, question: "Can I prepare the result for social media?", answer: "Yes. Choose the destination before finalizing the crop, keep important text editable, and review every format before sharing." },
    { id: `${config.key}-faq-4`, question: "What should I check before sharing?", answer: "Review faces, hands, pets, objects, text, crop safety, source permissions, and any claims about the event or occasion." }
  ];

  const sectionData = {};
  sectionRows.forEach(([id, type, sourceTitle], index) => {
    const lines = sectionFor(sections, sourceTitle);
    const title = sourceTitle === "Final CTA" ? (heading === seo.h1 ? `Create ${config.key.replace(/-/g, " ")} visuals with AI` : sourceTitle) : sourceTitle;
    const base = { anchor: id, title, themeTone: config.tone };
    if (id === "hero") {
      const heroLines = sectionFor(sections, "Hero");
      const heroIntro = firstParagraph(heroLines, seo.meta_description || seo.description || "Create a focused visual story from approved source material.");
      sectionData[`${config.pageKey}_${id.replace(/-/g, "_")}`] = {
        type,
        settings: { ...base, eyebrow: seo.primary_keyword || `AI ${config.key.replace(/-/g, " ")}`, title: heading, intro: heroIntro, support: "Use only source material you own or have permission to use. Review the complete result before publishing.", primaryCta: config.key === "wedding-ceremony" ? "Open Video Workspace" : `Create ${config.key.replace(/-/g, " ")} content`, primaryHref: "/app/create", secondaryCta: "Explore Scene Ideas", secondaryHref: "#scene-ideas", ...imageSettings(imageFor(0)) },
        blocks: images.slice(0, 3).map((image, heroIndex) => ({ id: `${config.key}-hero-${heroIndex + 1}`, type: "hero_visual", settings: imageSettings(image) }))
      };
      return;
    }
    if (id === "faq") {
      sectionData[`${config.pageKey}_faq`] = { type, settings: base, blocks: safeFaqItems.map((item) => ({ id: item.id, type: "faq_item", settings: { question: item.question, answer: item.answer } })) };
      return;
    }
    if (id === "final-cta") {
      sectionData[`${config.pageKey}_final_cta`] = { type, settings: { ...base, title: sourceTitle === "Final CTA" ? `Create ${config.key.replace(/-/g, " ")} visuals with AI` : sourceTitle, intro: firstParagraph(lines, seo.meta_description || "Start with a focused idea, review the result, and prepare the final crop for its intended channel."), primaryCta: config.key === "wedding-ceremony" ? "Open Video Workspace" : `Create ${config.key.replace(/-/g, " ")} content`, primaryHref: "/app/create", secondaryCta: "Explore More Themes", secondaryHref: "/holidays-events/save-the-date", ...imageSettings(imageFor(images.length - 1)) } };
      return;
    }
    const h3 = headingBlocks(lines);
    const list = listItems(lines);
    const blocks = h3.length
      ? h3.map((item, blockIndex) => blockFromText(config, id, item, blockIndex, images, index + 1))
      : list.map((item, blockIndex) => blockFromText(config, id, item, blockIndex, images, index + 1));
    if (type === "editorial_steps") {
      const stepItems = h3.length ? h3 : list;
      sectionData[`${config.pageKey}_${id.replace(/-/g, "_")}`] = { type, settings: { ...base, ...imageSettings(imageFor(index + 1)) }, blocks: stepItems.map((item, blockIndex) => ({ ...blockFromText(config, "step", item, blockIndex, images, index + 1), settings: { ...blockFromText(config, "step", item, blockIndex, images, index + 1).settings, number: blockIndex + 1 } })) };
      return;
    }
    if (type === "editorial_rich_text") {
      sectionData[`${config.pageKey}_${id.replace(/-/g, "_")}`] = { type, settings: { ...base, intro: firstParagraph(lines, seo.meta_description || "") }, blocks: paragraphs(lines).slice(1).map((text, blockIndex) => ({ id: `${config.key}-${id}-paragraph-${blockIndex + 1}`, type: "paragraph", settings: { text } })) };
      return;
    }
    if (type === "editorial_quality" || type === "editorial_boundaries") {
      sectionData[`${config.pageKey}_${id.replace(/-/g, "_")}`] = { type, settings: { ...base, intro: firstParagraph(lines, "") }, blocks: list.map((text, blockIndex) => ({ id: `${config.key}-${id}-${blockIndex + 1}`, type: "item", settings: { text } })) };
      return;
    }
    sectionData[`${config.pageKey}_${id.replace(/-/g, "_")}`] = { type, settings: { ...base, intro: firstParagraph(lines, "") }, blocks };
  });

  const noRawMarkdown = JSON.stringify(sectionData);
  if (/---|```|`[^`]+`|\[[^\]]+\]\([^)]*\)/.test(noRawMarkdown)) throw new Error(`${config.key}: raw markdown remained in page JSON`);
  return {
    pageType: "standard-content",
    version: 1,
    sectionsOrder: sectionIds.map((id) => `${config.pageKey}_${id.replace(/-/g, "_")}`),
    contentContract: { schema: "editorial-page-v1", pageKey: config.pageKey, requiredSections: sectionIds, sectionTypes, faqCount: safeFaqItems.length, mediaCount: images.length, sourceRevision: `${config.key}-package-20260824` },
    relatedLinks: [{ label: "How it works", href: "/workflow" }, { label: "Explore Save the Date themes", href: "/holidays-events/save-the-date" }],
    mediaManifest: images,
    seo: { title: seo.title, description: seo.meta_description || seo.meta_description, keywords: seo.secondary_keywords, canonicalPath: config.pagePath, canonical: seo.canonical || `https://www.mydreamshoots.com${config.pagePath}`, ogImage: images[0].src, index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } },
    sections: sectionData
  };
}

function copyAssets(config, images) {
  const destination = path.join(repoRoot, "public/assets/dreamshoot/seasonal", config.key);
  fs.mkdirSync(destination, { recursive: true });
  for (const image of images) fs.copyFileSync(path.join(config.sourceDir, "images", image.filename), path.join(destination, image.filename));
}

const pages = configs.map((config) => {
  const pageJson = buildPage(config);
  copyAssets(config, pageJson.mediaManifest);
  return { ...config, pageJson, heading: pageJson.sections[pageJson.sectionsOrder[0]].settings.title };
});

const jiti = createJiti(import.meta.url);
const { toSite, mapProduct } = jiti("../src/lib/stores/prisma-mappers.ts");
const { buildPublicationSnapshot, publishSeoSnapshotRelational } = jiti("../src/lib/stores/theme-store.ts");
const { publicationSnapshotIntegrity } = jiti("../src/lib/publication-snapshot-integrity.ts");
const prisma = new PrismaClient();
try {
  const siteRecord = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  if (!siteRecord) throw new Error(`Site not found: ${siteId}`);
  const standardPagePaths = siteRecord.pages.filter((page) => page.pageType === "standard-content").map((page) => page.slug);
  const availablePaths = new Set([...standardPagePaths, ...configs.map((config) => config.pagePath), "/about-us", "/best-packages", "/best-ai-image", "/pricing", "/faq", "/workflow", "/holidays-events/save-the-date"]);
  for (const item of pages) {
    const planned = packageInternalLinks(item, availablePaths);
    const fallback = [
      { label: "How it works", href: "/workflow" },
      { label: "Explore Save the Date themes", href: "/holidays-events/save-the-date" }
    ];
    item.pageJson.relatedLinks = [...planned, ...fallback]
      .filter((link, index, links) => links.findIndex((candidate) => candidate.href === link.href) === index)
      .slice(0, 2);
  }
  const pageIds = [];
  await prisma.$transaction(async (tx) => {
    for (const item of pages) {
      const pageId = `page_${siteId}_${item.pageKey}`;
      pageIds.push(pageId);
      await tx.themePage.upsert({ where: { siteId_slug: { siteId, slug: item.pagePath } }, create: { id: pageId, siteId, pageType: "standard-content", templateKey: "seasonal-editorial", slug: item.pagePath, title: item.heading, draftJson: item.pageJson, publishedJson: item.pageJson }, update: { pageType: "standard-content", templateKey: "seasonal-editorial", title: item.heading, draftJson: item.pageJson, publishedJson: item.pageJson } });
      for (const image of item.pageJson.mediaManifest) {
        await tx.mediaAsset.upsert({ where: { siteId_storageKey: { siteId, storageKey: image.src } }, create: { id: `media_${siteId}_${item.pageKey}_${image.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`, siteId, label: image.filename, storageKey: image.src, mimeType: "image/jpeg", usageType: "theme", sourceType: `seasonal-${item.key}-source`, previewUrl: image.src, originUrl: image.src, altText: image.alt, notes: image.caption }, update: { altText: image.alt, notes: image.caption, previewUrl: image.src, originUrl: image.src } });
      }
    }
    const existingSettings = siteRecord.settings?.draftJson || siteRecord.settings?.publishedJson || {};
    const existingNavigation = existingSettings.saveTheDateNavigation || { menuLabel: "Save the Date", groups: [] };
    const existingItems = existingNavigation.groups.flatMap((group) => group.items || []);
    const nextItems = pages.map((item, index) => ({ label: item.key === "wedding-ceremony" ? "Wedding Ceremony" : item.key.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), slug: item.key, href: item.pagePath, status: "published", sortOrder: index + 1 }));
    const merged = [...existingItems, ...nextItems].filter((item, index, values) => values.findIndex((candidate) => candidate.href === item.href) === index);
    const loveWedding = merged.filter((item) => ["/ai-save-the-date/valentines-day", "/holidays-events/engagement", "/holidays-events/proposal", "/holidays-events/save-the-date", "/ai-video-generation/wedding-ceremony"].includes(item.href)).map((item, index) => ({ ...item, sortOrder: index + 1 }));
    const seasonal = merged.filter((item) => ["/holidays-events/thanksgiving", "/holidays-events/christmas", "/holidays-events/new-year"].includes(item.href)).map((item, index) => ({ ...item, sortOrder: index + 1 }));
    const nextSettings = { ...existingSettings, saveTheDateNavigation: { menuLabel: "Save the Date", groups: [{ label: "Love & Wedding", slug: "love-wedding", sortOrder: 1, items: loveWedding }, { label: "Seasonal Holidays", slug: "seasonal-holidays", sortOrder: 2, items: seasonal }] } };
    await tx.themeSettings.upsert({ where: { siteId }, create: { id: `settings_${siteId}`, siteId, draftJson: nextSettings, publishedJson: nextSettings }, update: { draftJson: nextSettings, publishedJson: nextSettings } });
  });
  const fresh = await prisma.site.findUnique({ where: { id: siteId }, include: { domains: true, pages: { orderBy: { slug: "asc" } }, settings: true, storefrontProfile: true, mediaAssets: true, activePublication: { include: { publication: true } }, publications: { orderBy: [{ version: "desc" }, { publishedAt: "desc" }], take: 1 }, connect: true } });
  const site = toSite(fresh);
  const packs = await prisma.creativePack.findMany({ where: { siteId }, include: { categoryRecord: true } });
  const products = await prisma.product.findMany({ where: { siteId }, include: { prices: true } });
  const snapshot = buildPublicationSnapshot(site, undefined, packs, products.map(mapProduct));
  const integrity = publicationSnapshotIntegrity(snapshot);
  if (integrity !== "valid") throw new Error(`Seasonal publication snapshot is invalid: ${integrity}`);
  await publishSeoSnapshotRelational({ siteId, snapshot, actor: "seasonal-theme-sync", scope: { type: "site", pageIds, includeThemeSettings: true, includeStorefrontProfile: false } });
  console.log(JSON.stringify({ siteId, pages: pages.map((item) => ({ key: item.key, path: item.pagePath, media: item.pageJson.mediaManifest.length, faq: item.pageJson.contentContract.faqCount })), snapshotHash: snapshot.snapshotHash }, null, 2));
} finally {
  await prisma.$disconnect();
}
