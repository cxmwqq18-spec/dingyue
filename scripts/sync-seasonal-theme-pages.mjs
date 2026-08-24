#!/usr/bin/env node
import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import { PrismaClient } from "@prisma/client";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
const sourcePackageRoot = process.env.SEASONAL_SOURCE_ROOT || "/tmp/mydreamshoots-seasonal-packages.83JYeu";
const mothersFathersSourceRoot = process.env.SEASONAL_MOTHERS_FATHERS_SOURCE_ROOT || "/tmp/mothers-fathers-packages.eaALdG";
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
const removedLegacyPaths = new Set([
  "/holidays-events/christmas",
  "/holidays-events/thanksgiving",
  "/holidays-events/new-year"
]);
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
    key: "mothers-day",
    displayName: "Mother's Day",
    sourceDir: process.env.SEASONAL_MOTHERS_DAY_SOURCE_DIR || path.join(mothersFathersSourceRoot, "ai-mothers-day-photo-and-video-final"),
    pagePath: "/holidays-events/mothers-day",
    pageKey: "mothers_day",
    tone: "mothers-day",
    seoOverrides: {
      title: "AI Mother's Day Photo & Video Generator | Family Content",
      description: "Create Mother's Day photos and videos with AI for family celebrations, gifts, brunch, heartfelt greetings, and spring lifestyle stories."
    },
    heroImage: "hero-ai-mothers-day-family-breakfast.jpg",
    explicitMapping: true,
    imageMap: {
      "Family Celebration Moments": "ai-mothers-day-family-toast.jpg",
      "Gifts and Flowers": "ai-mothers-day-gift-still-life.jpg",
      "Brunch and Breakfast": "ai-mothers-day-brunch-table.jpg",
      "Greeting Content": "hero-ai-mothers-day-gift-breakfast.jpg",
      "Spring Lifestyle Scenes": "ai-mothers-day-spring-walk.jpg",
      "Social Sharing": "ai-mothers-day-phone-photo.jpg",
      "Mother's Day family breakfast surprise": "hero-ai-mothers-day-family-breakfast.jpg",
      "Mother and daughter in a spring garden": "hero-ai-mothers-day-garden-portrait.jpg",
      "Gift-and-breakfast flat lay": "hero-ai-mothers-day-gift-breakfast.jpg",
      "Elegant Mother's Day brunch": "ai-mothers-day-brunch-table.jpg",
      "Family baking together": "ai-mothers-day-family-baking.jpg",
      "Flowers, jewelry, and gift still life": "ai-mothers-day-gift-still-life.jpg",
      "Smartphone-captured family moment": "ai-mothers-day-phone-photo.jpg",
      "Multi-generational Mother's Day toast": "ai-mothers-day-family-toast.jpg",
      "Cozy living room gift scene": "ai-mothers-day-cozy-living-room.jpg",
      "Pet-friendly Mother's Day portrait": "ai-mothers-day-pet-portrait.jpg",
      "Spring family walk with tulips": "ai-mothers-day-spring-walk.jpg",
      "Photo and Video Direction": "ai-mothers-day-spring-walk.jpg",
      "Family Photo Match": "ai-mothers-day-pet-portrait.jpg"
    },
    sections: [
      ["hero", "editorial_hero", "Hero"],
      ["definition", "editorial_rich_text", "What Is an AI Mother's Day Photo and Video Generator"],
      ["use-cases", "editorial_story_grid", "Use Cases"],
      ["quality", "editorial_quality", "What Makes Mother's Day Content Work"],
      ["workflow", "editorial_steps", "How It Works"],
      ["scene-ideas", "editorial_scene_grid", "Scene Ideas"],
      ["formats", "editorial_rich_text", "Photo and Video Direction"],
      ["family-match", "editorial_rich_text", "Family Photo Match"],
      ["faq", "faq", "FAQ"],
      ["final-cta", "editorial_cta", "Final CTA"]
    ]
  },
  {
    key: "fathers-day",
    displayName: "Father's Day",
    sourceDir: process.env.SEASONAL_FATHERS_DAY_SOURCE_DIR || path.join(mothersFathersSourceRoot, "ai-fathers-day-photo-and-video-final"),
    pagePath: "/holidays-events/fathers-day",
    pageKey: "fathers_day",
    tone: "fathers-day",
    seoOverrides: {
      title: "AI Father's Day Photo & Video Maker | Family Visuals",
      description: "Create Father's Day photos and videos with AI for family portraits, gifts, outdoor memories, dinners, and heartfelt appreciation."
    },
    heroImage: "hero-ai-fathers-day-family-portrait.jpg",
    explicitMapping: true,
    imageMap: {
      "Family portrait": "hero-ai-fathers-day-family-portrait.jpg",
      "Gift exchange and handmade card": "hero-ai-fathers-day-gift-moment.jpg",
      "Woodworking or hands-on activity": "ai-fathers-day-woodworking-bond.jpg",
      "Lakeside fishing": "ai-fathers-day-lakeside-fishing.jpg",
      "Baking together": "ai-fathers-day-baking-together.jpg",
      "Picnic in the park": "ai-fathers-day-picnic-park.jpg",
      "Gift flat lay": "ai-fathers-day-gift-flatlay.jpg",
      "Emotional letter or card moment": "ai-fathers-day-emotional-card.jpg",
      "Backyard barbecue or dinner toast": "ai-fathers-day-backyard-bbq.jpg",
      "Gallery dinner toast": "ai-fathers-day-family-dinner-toast.jpg"
    },
    sections: [
      ["hero", "editorial_hero", "Hero"],
      ["definition", "editorial_rich_text", "What is an AI Father’s Day photo and video maker"],
      ["scene-ideas", "editorial_scene_grid", "Scene ideas for Father’s Day photos and videos"],
      ["quality", "editorial_quality", "What makes Father’s Day content work"],
      ["workflow", "editorial_steps", "How it works"],
      ["use-cases", "editorial_story_grid", "Use cases"],
      ["gallery", "editorial_scene_grid", "Gallery"],
      ["faq", "faq", "FAQ"],
      ["final-cta", "editorial_cta", "Final CTA"]
    ]
  },
  {
    key: "halloween",
    displayName: "Halloween",
    sourceDir: process.env.SEASONAL_HALLOWEEN_SOURCE_DIR || path.join(sourcePackageRoot, "ai-halloween-photo-and-video-final"),
    pagePath: "/holidays-events/halloween",
    pageKey: "halloween",
    tone: "halloween",
    indexable: false,
    seoOverrides: {
      title: "AI Halloween Photo and Video Maker | Spooky Visuals",
      description: "Create Halloween photos and videos with AI-ready ideas for costumes, trick-or-treat moments, pets, pumpkins, haunted scenes, parties, and seasonal content."
    },
    heroImage: "hero-ai-halloween-costume-party.jpg",
    explicitMapping: true,
    imageMap: {
      "Costume party portrait": "hero-ai-halloween-costume-party.jpg",
      "Couple cosplay transformation": "hero-ai-halloween-couple-cosplay.jpg",
      "Pet costume portrait": "hero-ai-halloween-ghost-dog.jpg",
      "Trick-or-treat memory": "ai-halloween-trick-or-treat-vintage.jpg",
      "Pumpkin-face portrait": "ai-halloween-pumpkin-portrait.jpg",
      "Cute baby or family costume scene": "ai-halloween-baby-skeleton-costumes.jpg",
      "Haunted-house background": "ai-halloween-haunted-house-night.jpg",
      "Cinematic pumpkin night": "ai-halloween-pumpkin-wagon-night.jpg",
      "Neon Halloween party": "ai-halloween-neon-party-costumes.jpg",
      "Halloween profile photos and avatars": "ai-halloween-pumpkin-portrait.jpg",
      "social posts and seasonal content campaigns": "ai-halloween-neon-party-costumes.jpg",
      "couple and friend costume concepts": "hero-ai-halloween-couple-cosplay.jpg",
      "family trick-or-treat memories": "ai-halloween-bat-costume-child.jpg",
      "pet Halloween portraits": "ai-halloween-vampire-dog.jpg",
      "party invitations and event promos": "hero-ai-halloween-costume-party.jpg",
      "cinematic Halloween background concepts": "ai-halloween-haunted-house-night.jpg",
      "short-form Halloween video ideas": "ai-halloween-pumpkin-wagon-night.jpg",
      "Final CTA": "hero-ai-halloween-couple-cosplay.jpg"
    },
    sections: [
      ["hero", "editorial_hero", "Hero"],
      ["definition", "editorial_rich_text", "What is an AI Halloween photo and video maker"],
      ["scene-ideas", "editorial_scene_grid", "Scene ideas for Halloween photos and videos"],
      ["quality", "editorial_quality", "What makes Halloween creative convert"],
      ["workflow", "editorial_steps", "How it works"],
      ["use-cases", "editorial_scene_grid", "Use cases"],
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
  return blocks.map((item) => ({ title: item.title, text: paragraphs(item.lines).join(" "), items: listItems(item.lines) })).filter((item) => item.title && (item.text || item.items.length));
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
    const imagePath = path.join(config.sourceDir, "images", image.filename);
    if (!fs.existsSync(imagePath)) throw new Error(`${config.key}: missing image ${image.filename}`);
    const checksumFile = path.join(config.sourceDir, "SHA256SUMS.txt");
    if (fs.existsSync(checksumFile)) {
      const expected = read(checksumFile).split(/\r?\n/).map((line) => line.match(/^([a-f0-9]{64})\s+(.+)$/)).find((match) => match?.[2] === `images/${image.filename}`)?.[1];
      const actual = crypto.createHash("sha256").update(fs.readFileSync(imagePath)).digest("hex");
      if (!expected || expected !== actual) throw new Error(`${config.key}: checksum mismatch for ${image.filename}`);
    }
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

function firstLeadParagraph(markdown, fallback) {
  const beforeFirstSection = markdown.split(/^##\s+/m, 1)[0] || "";
  return firstParagraph(beforeFirstSection.split(/\r?\n/).filter((line) => !/^#\s+/.test(line)), fallback);
}

function mappedImage(config, images, key) {
  const filename = config.imageMap?.[key];
  if (!filename) throw new Error(`${config.key}: missing explicit image mapping for ${key}`);
  const image = images.find((candidate) => candidate.filename === filename);
  if (!image) throw new Error(`${config.key}: mapped image ${filename} is not in the manifest`);
  return image;
}

function mappedBlock(config, type, item, index, images, key = item.title || item) {
  const title = typeof item === "string" ? item : item.title;
  const text = typeof item === "string" ? item : item.text;
  return { id: `${config.key}-${type}-${index + 1}`, type, settings: { title: clean(title), text: clean(text), ...imageSettings(mappedImage(config, images, key)) } };
}

function sectionId(config, id) {
  return `${config.pageKey}_${id.replace(/-/g, "_")}`;
}

function buildHalloweenPage(config, markdown, sections, seo, images) {
  const heading = seo.h1 || markdown.match(/^#\s+(.+)$/m)?.[1] || "Create Halloween Photos and Videos with AI";
  const base = (id, title, sectionVariant) => ({ anchor: id, title, themeTone: config.tone, ...(sectionVariant ? { sectionVariant } : {}) });
  const data = {};
  const add = (id, type, settings, blocks = []) => { data[sectionId(config, id)] = { type, settings, blocks }; };
  const heroImage = mappedImage(config, images, "Costume party portrait");
  const heroVisuals = [
    heroImage,
    mappedImage(config, images, "Couple cosplay transformation"),
    mappedImage(config, images, "Pet costume portrait")
  ];
  const heroLines = sectionFor(sections, "Hero");
  const heroIntro = heroLines.length
    ? firstParagraph(heroLines, "Turn portraits, couple photos, family memories, and pet pictures into Halloween visual directions.")
    : firstLeadParagraph(markdown, "Turn portraits, couple photos, family memories, and pet pictures into Halloween visual directions.");
  add("hero", "editorial_hero", {
    ...base("hero", heading, "hero_collage"),
    eyebrow: seo.primary_keyword || "AI Halloween Photo and Video",
    title: heading,
    intro: heroIntro,
    support: "Use source material you own or have permission to use, then review faces, pets, costumes, text, and backgrounds before sharing.",
    primaryCta: "Create a Halloween look",
    primaryHref: "/app/create",
    secondaryCta: "Explore Scene Ideas",
    secondaryHref: "#scene-ideas",
    ...imageSettings(heroImage)
  }, heroVisuals.map((image, index) => ({ id: `${config.key}-hero-${index + 1}`, type: "hero_visual", settings: imageSettings(image) })));

  const definitionTitle = "What is an AI Halloween photo and video maker?";
  const definitionLines = sectionFor(sections, definitionTitle);
  const definitionParagraphs = paragraphs(definitionLines);
  add("definition", "editorial_rich_text", {
    ...base("definition", "What Is an AI Halloween Photo and Video Maker", "rich_text_list"),
    intro: definitionParagraphs[0] || "",
    ...imageSettings(mappedImage(config, images, "Costume party portrait"))
  }, listItems(definitionLines).map((text, index) => ({ id: `${config.key}-definition-${index + 1}`, type: "list_item", settings: { text } })));

  const sceneTitle = "Scene ideas for Halloween photos and videos";
  const sceneItems = headingBlocks(sectionFor(sections, sceneTitle));
  if (sceneItems.length !== 9) throw new Error(`${config.key}: expected nine scene ideas`);
  add("scene-ideas", "editorial_scene_grid", { ...base("scene-ideas", "Scene Ideas for Halloween Photos and Videos", "scene_cards") }, sceneItems.map((item, index) => mappedBlock(config, "scene", item, index, images)));

  const qualityTitle = "What makes Halloween creative convert?";
  const qualityLines = sectionFor(sections, qualityTitle);
  const qualityItems = listItems(qualityLines);
  if (qualityItems.length !== 6) throw new Error(`${config.key}: creative quality must preserve six bullets`);
  add("quality", "editorial_quality", { ...base("quality", "What Makes Halloween Creative Work", "principles_dark"), intro: paragraphs(qualityLines)[0] || "" }, qualityItems.map((text, index) => ({ id: `${config.key}-quality-${index + 1}`, type: "item", settings: { text } })));

  const workflowItems = listItems(sectionFor(sections, "How it works"));
  if (workflowItems.length !== 7) throw new Error(`${config.key}: expected seven workflow steps`);
  add("workflow", "editorial_steps", { ...base("workflow", "How It Works", "ember_workflow") }, workflowItems.map((text, index) => ({ id: `${config.key}-step-${index + 1}`, type: "step", settings: { number: index + 1, title: `Step ${index + 1}`, text } })));

  const useCaseItems = listItems(sectionFor(sections, "Use cases"));
  if (useCaseItems.length !== 8) throw new Error(`${config.key}: expected eight use cases`);
  add("use-cases", "editorial_scene_grid", { ...base("use-cases", "Use Cases", "use_case_cards") }, useCaseItems.map((title, index) => mappedBlock(config, "use_case", { title, text: title }, index, images, title)));

  const faqItems = headingBlocks(sectionFor(sections, "FAQ"));
  if (faqItems.length !== 6) throw new Error(`${config.key}: expected six FAQ items`);
  add("faq", "faq", base("faq", "FAQ"), faqItems.map((item, index) => ({ id: `${config.key}-faq-${index + 1}`, type: "faq_item", settings: { question: item.title, answer: item.text } })));
  add("final-cta", "editorial_cta", {
    ...base("final-cta", "Create Halloween Photos and Videos with AI"),
    intro: firstParagraph(sectionFor(sections, "Final CTA"), "Turn a portrait, couple photo, family memory, or pet picture into a Halloween visual people want to share."),
    primaryCta: "Create a Halloween look",
    primaryHref: "/app/create",
    secondaryCta: "Explore Seasonal Themes",
    secondaryHref: "/holidays-events/save-the-date",
    ...imageSettings(mappedImage(config, images, "Final CTA"))
  });

  const sectionIds = config.sections.map(([id]) => id);
  const sectionTypes = config.sections.map(([, type]) => type);
  const pageSeoIndexable = config.indexable !== false;
  return {
    pageType: "standard-content",
    version: 1,
    sectionsOrder: sectionIds.map((id) => sectionId(config, id)),
    contentContract: { schema: "editorial-page-v1", pageKey: config.pageKey, requiredSections: sectionIds, sectionTypes, faqCount: faqItems.length, mediaCount: images.length, sourceRevision: `${config.key}-package-20260824` },
    relatedLinks: [{ label: "How it works", href: "/workflow" }, { label: "Explore Save the Date themes", href: "/holidays-events/save-the-date" }],
    mediaManifest: images,
    seo: { title: config.seoOverrides?.title || seo.title, description: config.seoOverrides?.description || seo.meta_description, keywords: seo.secondary_keywords, canonicalPath: config.pagePath, canonical: seo.canonical || `https://www.mydreamshoots.com${config.pagePath}`, ogImage: images[0].src, index: pageSeoIndexable, follow: true, robots: { index: pageSeoIndexable, follow: true, maxImagePreview: "large" } },
    sections: data
  };
}

function buildMothersOrFathersPage(config, markdown, sections, seo, images) {
  const isMother = config.key === "mothers-day";
  const heading = seo.h1 || markdown.match(/^#\s+(.+)$/m)?.[1] || config.key;
  const themeLabel = config.displayName;
  const base = (id, title, sectionVariant) => ({ anchor: id, title, themeTone: config.tone, ...(sectionVariant ? { sectionVariant } : {}) });
  const data = {};
  const add = (id, type, settings, blocks = []) => { data[sectionId(config, id)] = { type, settings, blocks }; };
  const heroLines = sectionFor(sections, "Hero");
  const heroIntro = firstParagraph(heroLines, isMother ? "Turn heartfelt Mother's Day moments into photo and video content." : firstLeadParagraph(markdown, "Create warm Father’s Day visuals around real family moments."));
  const heroImage = mappedImage(config, images, config.heroImage === "hero-ai-mothers-day-family-breakfast.jpg" ? "Mother's Day family breakfast surprise" : "Family portrait");
  add("hero", "editorial_hero", { ...base("hero", heading, "hero_single"), eyebrow: seo.primary_keyword || `AI ${themeLabel}`, title: heading, intro: heroIntro, support: "Use only source material you own or have permission to use. Review the complete result before publishing.", primaryCta: isMother ? "Create Mother's Day Photos and Videos" : "Create Father's Day Photos & Videos", primaryHref: "/app/create", ...imageSettings(heroImage) }, [{ id: `${config.key}-hero-1`, type: "hero_visual", settings: imageSettings(heroImage) }]);

  if (isMother) {
    const definitionTitle = "What Is an AI Mother's Day Photo and Video Generator";
    add("definition", "editorial_rich_text", { ...base("definition", definitionTitle, "rich_text_image"), intro: firstParagraph(sectionFor(sections, definitionTitle), ""), ...imageSettings(mappedImage(config, images, "Mother's Day family breakfast surprise")) });
    const useCases = headingBlocks(sectionFor(sections, "Use Cases"));
    if (useCases.length !== 6) throw new Error(`${config.key}: expected 6 use-case cards`);
    add("use-cases", "editorial_story_grid", { ...base("use-cases", "Use Cases", "mapped_cards") }, useCases.map((item, index) => mappedBlock(config, "use_case", item, index, images)));
    const qualityGroups = headingBlocks(sectionFor(sections, "What Makes Mother's Day Content Work"));
    if (qualityGroups.length !== 2 || qualityGroups.some((item) => item.items.length !== 4)) throw new Error(`${config.key}: Do/Avoid groups must contain four bullets each`);
    add("quality", "editorial_quality", { ...base("quality", "What Makes Mother's Day Content Work", "guidance_groups"), intro: "Strong Mother's Day visuals make the occasion clear while keeping the emotional focus easy to read." }, qualityGroups.map((group, index) => ({ id: `${config.key}-guidance-${index + 1}`, type: "guidance_group", settings: { title: group.title, items: group.items } })));
    const steps = listItems(sectionFor(sections, "How It Works"));
    if (steps.length !== 6) throw new Error(`${config.key}: expected six workflow steps`);
    add("workflow", "editorial_steps", { ...base("workflow", "How It Works", "blush_workflow") }, steps.map((text, index) => ({ id: `${config.key}-step-${index + 1}`, type: "step", settings: { number: index + 1, title: `Step ${index + 1}`, text } })));
    const scenes = listItems(sectionFor(sections, "Scene Ideas"));
    if (scenes.length !== 11) throw new Error(`${config.key}: expected eleven scene ideas`);
    add("scene-ideas", "editorial_scene_grid", { ...base("scene-ideas", "Scene Ideas", "scene_cards") }, scenes.map((title, index) => mappedBlock(config, "scene", { title, text: title }, index, images)));
    for (const [id, title] of [["formats", "Photo and Video Direction"], ["family-match", "Family Photo Match"]]) {
      const lines = sectionFor(sections, title);
      add(id, "editorial_rich_text", { ...base(id, title, "rich_text_image"), intro: firstParagraph(lines, ""), ...imageSettings(mappedImage(config, images, title)) });
    }
    add("faq", "faq", base("faq", "FAQ"), headingBlocks(sectionFor(sections, "FAQ")).map((item, index) => ({ id: `${config.key}-faq-${index + 1}`, type: "faq_item", settings: { question: item.title, answer: item.text } })));
    add("final-cta", "editorial_cta", { ...base("final-cta", "Build Mother's Day Content Around Real Family Moments"), intro: firstParagraph(sectionFor(sections, "Final CTA"), "Create scenes for family celebration, flowers, brunch, gifts, or spring storytelling."), primaryCta: "Create Mother's Day Photos and Videos", primaryHref: "/app/create", secondaryCta: "Explore More Themes", secondaryHref: "/holidays-events/save-the-date", ...imageSettings(images[images.length - 1]) });
  } else {
    const definitionTitle = "What is an AI Father’s Day photo and video maker";
    const definitionLines = sectionFor(sections, definitionTitle);
    const definitionParagraphs = paragraphs(definitionLines);
    const definitionItems = listItems(definitionLines);
    if (definitionItems.length !== 6) throw new Error(`${config.key}: definition must preserve six content principles`);
    add("definition", "editorial_rich_text", { ...base("definition", definitionTitle, "rich_text_list"), intro: definitionParagraphs[0] || "" }, definitionItems.map((text, index) => ({ id: `${config.key}-definition-${index + 1}`, type: "list_item", settings: { text } })));
    const sceneItems = headingBlocks(sectionFor(sections, "Scene ideas for Father’s Day photos and videos"));
    if (sceneItems.length !== 9) throw new Error(`${config.key}: expected nine scene ideas`);
    add("scene-ideas", "editorial_scene_grid", { ...base("scene-ideas", "Scene Ideas for Father’s Day Photos and Videos", "scene_cards") }, sceneItems.map((item, index) => mappedBlock(config, "scene", item, index, images)));
    const qualityTitle = "What makes Father’s Day content work";
    const qualityLines = sectionFor(sections, qualityTitle);
    const qualityItems = listItems(qualityLines);
    if (qualityItems.length !== 4) throw new Error(`${config.key}: creative principles must preserve four bullets`);
    add("quality", "editorial_quality", { ...base("quality", "What Makes Father's Day Content Work", "principles_dark"), intro: paragraphs(qualityLines)[0] || "" }, qualityItems.map((text, index) => ({ id: `${config.key}-principle-${index + 1}`, type: "item", settings: { text } })));
    const steps = listItems(sectionFor(sections, "How it works"));
    if (steps.length !== 8) throw new Error(`${config.key}: expected eight workflow steps`);
    add("workflow", "editorial_steps", { ...base("workflow", "How It Works", "navy_workflow") }, steps.map((text, index) => ({ id: `${config.key}-step-${index + 1}`, type: "step", settings: { number: index + 1, title: `Step ${index + 1}`, text } })));
    const useCases = listItems(sectionFor(sections, "Use cases"));
    if (useCases.length !== 6) throw new Error(`${config.key}: expected six use cases`);
    const groupedUseCases = [
      ["Greetings and inspiration", useCases.slice(0, 2)],
      ["Gifts and appreciation", useCases.slice(2, 4)],
      ["Outdoor and family memories", useCases.slice(4, 5)],
      ["Dinner and barbecue celebrations", useCases.slice(5)]
    ];
    add("use-cases", "editorial_story_grid", { ...base("use-cases", "Use Cases", "text_cards") }, groupedUseCases.map(([title, items], index) => ({ id: `${config.key}-use-case-${index + 1}`, type: "text_card", settings: { title, text: items.join(" ") } })));
    add("gallery", "editorial_scene_grid", { ...base("gallery", "Gallery", "gallery") }, [{ id: `${config.key}-gallery-1`, type: "gallery_item", settings: { title: "Family dinner toast", text: "A warm shared-meal scene for Father’s Day celebration storytelling.", ...imageSettings(mappedImage(config, images, "Gallery dinner toast")) } }]);
    add("faq", "faq", base("faq", "FAQ"), headingBlocks(sectionFor(sections, "FAQ")).map((item, index) => ({ id: `${config.key}-faq-${index + 1}`, type: "faq_item", settings: { question: item.title, answer: item.text } })));
    add("final-cta", "editorial_cta", { ...base("final-cta", "Build Father’s Day Visuals Around Real Family Moments"), intro: firstParagraph(sectionFor(sections, "Final CTA"), "Build Father’s Day visuals around real family moments, warmth, and believable scenes."), primaryCta: "Create Father's Day Photos & Videos", primaryHref: "/app/create", secondaryCta: "Explore More Themes", secondaryHref: "/holidays-events/save-the-date", ...imageSettings(images[images.length - 1]) });
  }
  const sectionRows = config.sections;
  const sectionIds = sectionRows.map(([id]) => id);
  const sectionTypes = sectionRows.map(([, type]) => type);
  const faq = data[sectionId(config, "faq")];
  if (!faq?.blocks?.length) throw new Error(`${config.key}: FAQ is required`);
  const pageSeo = { title: config.seoOverrides.title, description: config.seoOverrides.description, keywords: seo.secondary_keywords, canonicalPath: config.pagePath, canonical: seo.canonical || `https://www.mydreamshoots.com${config.pagePath}`, ogImage: images[0].src, index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } };
  return { pageType: "standard-content", version: 1, sectionsOrder: sectionIds.map((id) => sectionId(config, id)), contentContract: { schema: "editorial-page-v1", pageKey: config.pageKey, requiredSections: sectionIds, sectionTypes, faqCount: faq.blocks.length, mediaCount: images.length, sourceRevision: `${config.key}-package-20260824` }, relatedLinks: [{ label: "How it works", href: "/workflow" }, { label: "Explore Save the Date themes", href: "/holidays-events/save-the-date" }], mediaManifest: images, seo: pageSeo, sections: data };
}

function buildPage(config) {
  for (const required of ["01_page_copy_final.md", "02_page_structure_final.md", "06_seo_config.csv", "11_image_manifest_and_alt.csv"]) {
    if (!fs.existsSync(path.join(config.sourceDir, required))) throw new Error(`${config.key}: missing ${required}`);
  }
  const markdown = read(path.join(config.sourceDir, "01_page_copy_final.md"));
  const sections = markdownSections(markdown);
  const seo = parseSeo(path.join(config.sourceDir, "06_seo_config.csv"));
  const images = parseManifest(config);
  if (config.key === "halloween") return buildHalloweenPage(config, markdown, sections, seo, images);
  if (config.explicitMapping) return buildMothersOrFathersPage(config, markdown, sections, seo, images);
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
    const themeLabel = config.displayName || config.key.replace(/-/g, " ");
    const title = sourceTitle === "Final CTA" ? (heading === seo.h1 ? `Create ${themeLabel} visuals with AI` : sourceTitle) : sourceTitle;
    const base = { anchor: id, title, themeTone: config.tone };
    if (id === "hero") {
      const heroLines = sectionFor(sections, "Hero");
      const heroIntro = firstParagraph(heroLines, seo.meta_description || seo.description || "Create a focused visual story from approved source material.");
      sectionData[`${config.pageKey}_${id.replace(/-/g, "_")}`] = {
        type,
        settings: { ...base, eyebrow: seo.primary_keyword || `AI ${themeLabel}`, title: heading, intro: heroIntro, support: "Use only source material you own or have permission to use. Review the complete result before publishing.", primaryCta: config.key === "wedding-ceremony" ? "Open Video Workspace" : `Create ${themeLabel} content`, primaryHref: "/app/create", secondaryCta: "Explore Scene Ideas", secondaryHref: "#scene-ideas", ...imageSettings(imageFor(0)) },
        blocks: images.slice(0, 3).map((image, heroIndex) => ({ id: `${config.key}-hero-${heroIndex + 1}`, type: "hero_visual", settings: imageSettings(image) }))
      };
      return;
    }
    if (id === "faq") {
      sectionData[`${config.pageKey}_faq`] = { type, settings: base, blocks: safeFaqItems.map((item) => ({ id: item.id, type: "faq_item", settings: { question: item.question, answer: item.answer } })) };
      return;
    }
    if (id === "final-cta") {
      sectionData[`${config.pageKey}_final_cta`] = { type, settings: { ...base, title: sourceTitle === "Final CTA" ? `Create ${themeLabel} visuals with AI` : sourceTitle, intro: firstParagraph(lines, seo.meta_description || "Start with a focused idea, review the result, and prepare the final crop for its intended channel."), primaryCta: config.key === "wedding-ceremony" ? "Open Video Workspace" : `Create ${themeLabel} content`, primaryHref: "/app/create", secondaryCta: "Explore More Themes", secondaryHref: "/holidays-events/save-the-date", ...imageSettings(imageFor(images.length - 1)) } };
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
      const qualityItems = list.length ? list : h3.map((item) => `${item.title}: ${item.text}`);
      sectionData[`${config.pageKey}_${id.replace(/-/g, "_")}`] = { type, settings: { ...base, intro: firstParagraph(lines, "") }, blocks: qualityItems.map((text, blockIndex) => ({ id: `${config.key}-${id}-${blockIndex + 1}`, type: "item", settings: { text } })) };
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
    seo: { title: config.seoOverrides?.title || seo.title, description: config.seoOverrides?.description || seo.meta_description || seo.meta_description, keywords: seo.secondary_keywords, canonicalPath: config.pagePath, canonical: seo.canonical || `https://www.mydreamshoots.com${config.pagePath}`, ogImage: images[0].src, index: true, follow: true, robots: { index: true, follow: true, maxImagePreview: "large" } },
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

if (process.env.SEASONAL_BUILD_ONLY === "1") {
  const output = process.env.SEASONAL_BUILD_OUTPUT || path.join(repoRoot, "releases/manifests/seasonal-theme-build.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), siteId, pages: pages.map(({ key, pagePath, pageKey, pageJson }) => ({ key, pagePath, pageKey, pageJson })) }, null, 2));
  console.log(JSON.stringify({ buildOnly: true, output, pages: pages.map(({ key, pagePath }) => ({ key, pagePath })) }, null, 2));
  process.exit(0);
}

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
    const existingItems = existingNavigation.groups.flatMap((group) => group.items || []).filter((item) => !removedLegacyPaths.has(item.href));
    const nextItems = pages.map((item, index) => ({ label: item.key === "wedding-ceremony" ? "Wedding Ceremony" : item.key.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), slug: item.key, href: item.pagePath, status: "published", sortOrder: index + 1 }));
    const merged = [...existingItems, ...nextItems].filter((item, index, values) => values.findIndex((candidate) => candidate.href === item.href) === index);
    const loveWedding = merged.filter((item) => ["/ai-save-the-date/valentines-day", "/holidays-events/engagement", "/holidays-events/proposal", "/holidays-events/save-the-date", "/ai-video-generation/wedding-ceremony"].includes(item.href)).map((item, index) => ({ ...item, sortOrder: index + 1 }));
    const seasonal = merged.filter((item) => ["/holidays-events/mothers-day", "/holidays-events/fathers-day", "/holidays-events/halloween"].includes(item.href)).map((item, index) => ({ ...item, sortOrder: index + 1 }));
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
