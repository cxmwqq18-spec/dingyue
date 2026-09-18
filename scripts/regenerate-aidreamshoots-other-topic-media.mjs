#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

const repoRoot = process.cwd();
const args = parseArgs(process.argv.slice(2));
const mode = String(args.mode || "plan").toLowerCase();
const batchId = String(args.batch || "aidreamshoots-other-topics-20260914-v1");
const manifestPath = path.resolve(args.manifest || `.tmp/aidreamshoots-other-topic-regeneration/${batchId}/manifest.json`);
const outputRoot = path.resolve(`.tmp/aidreamshoots-other-topic-regeneration/${batchId}/outputs`);
const providerResultRoot = path.resolve(`releases/provider-results/aidreamshoots/other-topics/${batchId}`);
const finalRoot = path.resolve(`public/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}`);
const finalPublicRoot = `/assets/sites/site_aidreamshoots/generated/regenerated/${batchId}`;

const targetSiteId = "site_mydreamshoots_xby";
const targetSiteSlug = "aidreamshoots";
const targetDomain = "aidreamshoots.eu";
const providerId = String(args["provider-id"] || "aiprov_image4_mysub2api");
const imageModel = "gpt-image-2";
const providerApiPrefix = providerId === "aiprov_mu13l0rf_xtekhv" ? "/v1" : "";
const providerModelsPath = `${providerApiPrefix}/models`;
const providerImageGenerationsPath = `${providerApiPrefix}/images/generations`;
const isBumingProvider = providerId === "aiprov_mu13l0rf_xtekhv";
const providerImageRuntimeInvokePath = "/api/v1/model-runtime/invoke";
const providerImageRuntimeTaskPath = (taskId) => `/api/v1/model-runtime/tasks/${encodeURIComponent(taskId)}`;
const imageSize = isBumingProvider ? "4096x4096" : "1024x1024";
const imageResolution = isBumingProvider ? "4K" : "";
const imageQuality = isBumingProvider ? "high" : "medium";
const imageTimeoutMs = 300_000;
const maxPaidCreateAttempts = 180;
const maximumAllowedPaidCreateAttempts = 250;
const runtimeProviderKey = String(process.env.AIDREAMSHOOTS_IMAGE_PROVIDER_KEY || "").trim();
const generationConcurrency = 4;
const expectedConfirmation = "aidreamshoots-other-topic-regeneration";
const outputWidth = isBumingProvider ? 4096 : 1600;
const outputHeight = isBumingProvider ? 3072 : 1200;
const minimumCrossAHashDistance = 10;
const minimumCrossDHashDistance = 12;
const minimumCrossColorHashDistance = 24;

// These are the customer-facing topic detail pages highlighted in the supplied
// navigation screenshot. Motion Generator and Wedding Invitation are intentionally
// excluded because they are not part of that highlighted topic set.
const TARGET_TOPIC_SLUGS = [
  "brand-video",
  "cinematic-video",
  "explainer-video",
  "fashion-video",
  "food-video",
  "how-to-video",
  "instagram-reels",
  "meme-video",
  "music-video",
  "pet-video",
  "product-ad-video",
  "product-video",
  "promo-video",
  "social-media-video",
  "story-video",
  "talking-head-video",
  "tiktok-video",
  "ugc-ad-video",
  "video-ad",
  "youtube-video"
];

const IMAGE_VALUE_KEYS = new Set(["src", "poster", "imageUrl", "url"]);
const IMAGE_EXTENSION_PATTERN = /\.(?:avif|gif|jpe?g|png|webp)(?:[?#]|$)/i;
const VIDEO_PATTERN = /\.(?:mp4|webm|mov)(?:[?#]|$)/i;

const SCENE_DIRECTIONS = [
  {
    id: "direct-daylight-portrait",
    visual: "medium portrait at eye level in soft daylight, direct eye contact, calm open expression, clean negative space",
    altTail: "en un retrato medio con luz natural y mirada a cámara"
  },
  {
    id: "wide-environmental-story",
    visual: "wide environmental composition that clearly shows the setting, subject placed off-center with practical depth and natural movement",
    altTail: "en un encuadre amplio que muestra el entorno"
  },
  {
    id: "close-detail-action",
    visual: "close editorial frame focused on a meaningful hand action or material detail while keeping the main subject recognizable",
    altTail: "en un plano cercano que destaca una acción y su textura"
  },
  {
    id: "overhead-process",
    visual: "tasteful overhead or high-angle process composition with hands and arranged objects, clear hierarchy and no readable writing",
    altTail: "en una vista elevada de manos, objetos y proceso"
  },
  {
    id: "blue-hour-cinematic",
    visual: "blue-hour cinematic lighting balanced with one warm practical source, atmospheric depth, restrained contrast, premium film still",
    altTail: "con luz de hora azul y un punto cálido"
  },
  {
    id: "warm-documentary",
    visual: "warm documentary photograph with candid body language, gentle grain, tactile surroundings, and an authentic unposed moment",
    altTail: "en una escena documental cálida y natural"
  },
  {
    id: "graphic-color-block",
    visual: "contemporary editorial composition using bold but controlled color blocks, clean geometry, one clear focal subject, no graphic text",
    altTail: "con composición editorial geométrica y color intenso"
  },
  {
    id: "studio-commercial",
    visual: "polished commercial studio setup with softbox shaping, precise product or subject placement, refined shadows, and premium finish",
    altTail: "en un estudio comercial de luz suave y sombras cuidadas"
  },
  {
    id: "street-natural-light",
    visual: "natural-light street scene with believable movement, layered urban background, documentary lensing, and an uncluttered focal plane",
    altTail: "en una escena urbana con movimiento y fondo desenfocado"
  },
  {
    id: "intimate-interior",
    visual: "intimate interior scene with layered foreground and background, window light, warm textures, and a quiet narrative mood",
    altTail: "en un interior íntimo con luz de ventana y profundidad"
  },
  {
    id: "dynamic-diagonal",
    visual: "dynamic diagonal composition with a clear action line, lively but believable posture, modern lens perspective, and strong visual rhythm",
    altTail: "con líneas diagonales y una acción claramente visible"
  },
  {
    id: "minimal-neutral",
    visual: "minimal neutral studio with generous breathing room, restrained palette, crisp silhouette, and precise editorial balance",
    altTail: "en un estudio minimalista de tonos neutros"
  },
  {
    id: "textured-night",
    visual: "night scene with rich texture, controlled neon or practical light, atmospheric background separation, and cinematic restraint",
    altTail: "en una escena nocturna con textura y luz ambiental"
  },
  {
    id: "social-vertical",
    visual: "vertical-first creator framing with a natural handheld feel, direct readable face or object, layered practical background, no device UI",
    altTail: "en un encuadre vertical de creador con sujeto visible"
  },
  {
    id: "split-depth",
    visual: "layered foreground-middle-background composition with a clear visual reveal, cinematic depth, and one dominant subject",
    altTail: "con tres planos que crean profundidad y un punto focal"
  },
  {
    id: "pastel-editorial",
    visual: "soft pastel editorial palette with polished styling, gentle directional light, approachable expression, and quiet premium detail",
    altTail: "con paleta pastel, estilismo cuidado y luz suave"
  },
  {
    id: "bold-action-frame",
    visual: "bold action frame frozen at a believable moment, strong gesture, crisp subject separation, and energetic but safe editorial styling",
    altTail: "en un instante de acción con gesto claro y energía"
  },
  {
    id: "quiet-reflection",
    visual: "quiet reflective composition with soft side light, thoughtful posture, subtle environmental clues, and a cinematic stillness",
    altTail: "en una composición serena con luz lateral suave"
  }
];

const TOPIC_PROFILES = {
  "brand-video": {
    label: "vídeos de marca",
    visual: "fictional adult founders, makers, teammates, and customers expressing a brand story through authentic places, craft, community, and product context",
    altLead: "Persona adulta presentando una historia de marca",
    palette: "terracotta, ink blue, warm wood, and soft cream"
  },
  "cinematic-video": {
    label: "vídeos cinematográficos",
    visual: "fictional adult actors and creators in varied cinematic scenes such as a rainy alley, a quiet vehicle reveal, a live performance, a speculative interior, or a candlelit room",
    altLead: "Escena cinematográfica con una persona adulta",
    palette: "deep navy, amber, charcoal, and controlled jewel tones"
  },
  "explainer-video": {
    label: "vídeos explicativos",
    visual: "fictional adult educators, product specialists, analysts, and presenters explaining a concept with objects, abstract diagrams, or clean physical demonstrations",
    altLead: "Persona adulta explicando un concepto",
    palette: "teal, cobalt, cream, warm gray, and one coral accent"
  },
  "fashion-video": {
    label: "vídeos de moda",
    visual: "fictional adult fashion models, stylists, and designers in editorial studio, runway, street-style, fitting, fabric, and accessory moments; tasteful fully clothed styling",
    altLead: "Persona adulta mostrando una propuesta de moda",
    palette: "plum, black, ivory, cobalt, and muted blush"
  },
  "food-video": {
    label: "vídeos gastronómicos",
    visual: "fictional adult cooks, chefs, and food creators preparing, plating, serving, and tasting appealing food in a kitchen, studio, café, or restaurant setting",
    altLead: "Persona adulta preparando una escena gastronómica",
    palette: "saffron, tomato red, basil green, wood, and warm cream"
  },
  "how-to-video": {
    label: "vídeos tutoriales",
    visual: "fictional adult instructors demonstrating a safe practical process with tools, materials, hands-on steps, measured actions, or a clean software concept without readable screens",
    altLead: "Persona adulta mostrando un proceso paso a paso",
    palette: "cobalt, mint, light gray, natural wood, and orange accents"
  },
  "instagram-reels": {
    label: "Reels para Instagram",
    visual: "fictional adult creators making polished short-form social content in a studio, street, home, portfolio, announcement, or product-demo setting",
    altLead: "Creadora adulta preparando contenido para redes sociales",
    palette: "coral, lavender, electric blue, soft black, and daylight white"
  },
  "meme-video": {
    label: "vídeos de memes",
    visual: "fictional adult people and friendly pets in instantly readable everyday comedic situations, expressive but natural faces, playful timing, and no written joke or caption",
    altLead: "Persona adulta en una situación cotidiana con tono humorístico",
    palette: "sunny yellow, cyan, red, lilac, and neutral interiors"
  },
  "music-video": {
    label: "vídeos musicales",
    visual: "fictional adult vocalists, musicians, and performers in rehearsal rooms, intimate stages, studio sessions, practical sets, and expressive performance moments",
    altLead: "Músico adulto en una escena de interpretación",
    palette: "midnight blue, magenta, red, amber, and smoke gray"
  },
  "pet-video": {
    label: "vídeos de mascotas",
    visual: "adult pet owners with friendly dogs or cats in safe, joyful scenes such as a walk, grooming, training, play, feeding, or a calm home bond; no distressed animals",
    altLead: "Persona adulta junto a una mascota en una escena cotidiana",
    palette: "leaf green, sky blue, warm beige, amber, and soft coral"
  },
  "product-ad-video": {
    label: "anuncios de productos",
    visual: "fictional adult presenters and shoppers demonstrating unbranded everyday products in clean commercial contexts, showing a buyer problem, proof, benefit, comparison, or purchase moment",
    altLead: "Persona adulta presentando un producto sin marca",
    palette: "white, sage, cobalt, warm gray, and a single orange accent"
  },
  "product-video": {
    label: "vídeos de productos",
    visual: "unbranded consumer products such as a backpack, earbuds, coffee machine, smartwatch, shoes, or studio tools shown with an adult hand or presenter when useful; no labels or readable packaging",
    altLead: "Producto sin marca mostrado en una escena comercial",
    palette: "cream, graphite, sage, cobalt, and warm metallic accents"
  },
  "promo-video": {
    label: "vídeos promocionales",
    visual: "fictional adult presenters, creators, shoppers, and event participants communicating a launch, feature, sale, event, seasonal moment, or brand activation without readable promotional text",
    altLead: "Persona adulta comunicando una acción promocional",
    palette: "violet, coral, gold, midnight blue, and clean white"
  },
  "social-media-video": {
    label: "vídeos para redes sociales",
    visual: "fictional adult creators and small teams making varied social-first scenes: launch, transformation, behind the scenes, proof demo, event story, and announcement",
    altLead: "Creadora adulta preparando una escena para redes sociales",
    palette: "cobalt, coral, lilac, charcoal, and warm daylight"
  },
  "story-video": {
    label: "vídeos narrativos",
    visual: "fictional adult characters in a coherent but varied narrative world with archival rooms, journeys, turning points, community, craft, restoration, and a hopeful resolution",
    altLead: "Persona adulta dentro de una escena narrativa",
    palette: "olive, parchment, rust, midnight blue, and library amber"
  },
  "talking-head-video": {
    label: "vídeos con presentador",
    visual: "fictional adult presenters, founders, trainers, marketers, and educators delivering clear face-to-camera communication in office, home, studio, training, or social settings",
    altLead: "Presentador adulto hablando a cámara",
    palette: "navy, cream, sage, warm wood, and one violet accent"
  },
  "tiktok-video": {
    label: "vídeos para TikTok",
    visual: "fictional adult creators, teachers, speakers, founders, and presenters making energetic short-form scenes for hooks, lessons, storytime, events, product proof, or seasonal offers",
    altLead: "Creador adulto preparando un vídeo corto para TikTok",
    palette: "cobalt, coral, neon lilac, black, and warm skin tones"
  },
  "ugc-ad-video": {
    label: "anuncios UGC",
    visual: "fictional adult creators sharing honest unbranded product impressions, demonstrations, try-ons, unboxings, and conversations in believable home or studio settings",
    altLead: "Creadora adulta mostrando un producto sin marca",
    palette: "peach, sage, cream, cobalt, and soft household neutrals"
  },
  "video-ad": {
    label: "anuncios de vídeo",
    visual: "fictional adult creators, shoppers, editors, and presenters building placement-aware commercial scenes for ecommerce, social feeds, product studios, and campaign variants",
    altLead: "Persona adulta preparando una escena para un anuncio de vídeo",
    palette: "red, cobalt, black, white, and warm product neutrals"
  },
  "youtube-video": {
    label: "vídeos para YouTube",
    visual: "fictional adult hosts, teachers, interviewers, reviewers, and creators in long-form studio, tutorial, conversation, webinar, case-study, and series settings",
    altLead: "Presentador adulto preparando contenido para YouTube",
    palette: "deep blue, warm wood, coral, cream, and studio black"
  }
};

assert.equal(TARGET_TOPIC_SLUGS.length, 20, "The screenshot scope must contain twenty other topic pages.");
assert.equal(Object.keys(TOPIC_PROFILES).length, TARGET_TOPIC_SLUGS.length, "Every target topic needs a generation profile.");

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) continue;
    const raw = token.slice(2);
    const separator = raw.indexOf("=");
    if (separator >= 0) {
      result[raw.slice(0, separator)] = raw.slice(separator + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      result[raw] = next;
      index += 1;
    } else {
      result[raw] = "true";
    }
  }
  return result;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function stringValue(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeBaseUrl(value) {
  const trimmed = String(value || "").trim().replace(/\/+$/, "");
  const v1Match = trimmed.match(/^(.*?\/v1)(?:\/.*)?$/i);
  return v1Match?.[1] ?? `${trimmed}/v1`;
}

function assertAltText(altText) {
  assert(altText.length >= 30 && altText.length <= 150, `Alt text length is outside the recommended range: ${altText}`);
  assert(!/^(?:ejemplo|imagen|foto)\s+(?:visual\s+)?(?:[0-9]+|genéric|generad)/i.test(altText), `Generic alt text is not allowed: ${altText}`);
  assert(!/[<>\n\r]/.test(altText), `Alt text contains markup or a line break: ${altText}`);
}

function safeStem(value) {
  return String(value || "asset")
    .split(/[?#]/)[0]
    .split("/")
    .pop()
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 52) || "asset";
}

function imageKey(key, value) {
  return IMAGE_VALUE_KEYS.has(key) && typeof value === "string" && IMAGE_EXTENSION_PATTERN.test(value);
}

function collectImageRefs(value, parts = [], context = {}, output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectImageRefs(item, [...parts, String(index)], context, output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  const object = record(value);
  const nextContext = {
    title: stringValue(object?.title, context.title),
    body: stringValue(object?.body, context.body),
    label: stringValue(object?.label, context.label),
    problem: stringValue(object?.problem, context.problem),
    alt: stringValue(object?.alt, context.alt)
  };
  for (const [key, child] of Object.entries(value)) {
    if (imageKey(key, child)) {
      output.push({ key, path: [...parts, key].join("."), sourceUrl: child, currentAlt: stringValue(object?.alt), context: nextContext });
    }
    collectImageRefs(child, [...parts, key], nextContext, output);
  }
  return output;
}

function collectVideoRefs(value, parts = [], output = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectVideoRefs(item, [...parts, String(index)], output));
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, child] of Object.entries(value)) {
    if (typeof child === "string" && (key === "src" || key === "poster" || key === "url") && VIDEO_PATTERN.test(child)) {
      output.push({ path: [...parts, key].join("."), value: child });
    }
    collectVideoRefs(child, [...parts, key], output);
  }
  return output;
}

function uniqueImageRefs(content) {
  const seen = new Set();
  return collectImageRefs(content).filter((ref) => ref.key !== "poster").filter((ref) => {
    if (seen.has(ref.sourceUrl)) return false;
    seen.add(ref.sourceUrl);
    return true;
  });
}

function altTextFor(profile, direction, pageIndex, slotIndex) {
  const alt = `${profile.altLead} ${direction.altTail}, variación ${String(pageIndex + 1).padStart(2, "0")}-${String(slotIndex + 1).padStart(2, "0")}.`;
  assertAltText(alt);
  return alt;
}

function buildPrompt({ page, profile, direction, ref, pageIndex, slotIndex }) {
  const seo = record(page.seo) ?? {};
  const sourceCue = [ref.sourceUrl.split("/").pop(), ref.currentAlt, ref.context.title, ref.context.body, ref.context.problem, ref.context.label]
    .filter(Boolean)
    .join(" | ");
  return [
    "Create one original premium editorial photograph for the AIdreamshoots Spanish storefront.",
    `Topic theme anchor: ${page.anchor}. Topic intent: ${profile.label}.`,
    `Page route: ${page.slug}. Image slot ${slotIndex + 1} of ${page.totalImages}.`,
    "Current SEO context is semantic guidance only. Never render SEO words, labels, headings, captions, interface elements, or readable text in the image:",
    `SEO title: ${stringValue(seo.title)}`,
    `SEO description: ${stringValue(seo.description)}`,
    `SEO keywords: ${stringValue(seo.keywords)}`,
    `Current content cue from this slot: ${sourceCue || "topic detail image"}.`,
    `Topic visual anchor: ${profile.visual}.`,
    `Scene and style variation: ${direction.visual}.`,
    `Color direction: ${profile.palette}.`,
    "Use a fictional adult when a person appears. Keep the subject, face, hands, objects, and composition believable and easy to understand at storefront card size.",
    "No minors, celebrities, public figures, copied characters, nudity, sexualized posing, violence, gore, medical claims, logos, brands, watermarks, UI, subtitles, captions, signage, legible writing, or readable packaging labels.",
    "No collage, grid, split screen, contact sheet, border, numbered card, duplicated subject, or artificial frame. Fill the square canvas edge to edge; the result will be cropped to a 4:3 storefront card.",
    "The image must be visually distinct from every other slot through subject identity, scene, camera distance, lighting, palette, and composition while remaining faithful to this topic anchor."
  ].join("\n");
}

async function loadTargetPages(prisma) {
  const site = await prisma.site.findUnique({ where: { id: targetSiteId }, select: { id: true, slug: true, primaryDomain: true, name: true } });
  assert(site, `Missing target site: ${targetSiteId}`);
  assert.equal(site.slug, targetSiteSlug, "Target site slug mismatch.");
  assert.equal(site.primaryDomain, targetDomain, "Target site domain mismatch.");
  const pages = await prisma.livePage.findMany({
    where: { siteId: targetSiteId, slug: { in: TARGET_TOPIC_SLUGS.map((slug) => `/ai-video-generation/${slug}`) } },
    select: { id: true, siteId: true, slug: true, title: true, contentJson: true, updatedAt: true },
    orderBy: { slug: "asc" }
  });
  assert.equal(pages.length, TARGET_TOPIC_SLUGS.length, "Target topic page count changed.");
  const pageSnapshots = [];
  for (const page of pages) {
    const pageJson = record(page.contentJson);
    const sections = record(pageJson?.sections);
    const sectionKey = Object.keys(sections ?? {}).find((key) => sections[key]?.type === "ai_video_topic_landing");
    assert(sectionKey, `Missing topic landing section: ${page.slug}`);
    const section = record(sections[sectionKey]);
    const settings = record(section?.settings);
    const content = record(settings?.content);
    const seo = record(content?.seo);
    assert(content, `Missing topic content: ${page.slug}`);
    assert.equal(stringValue(settings?.anchor), page.slug.split("/").pop(), `Theme anchor mismatch: ${page.slug}`);
    assert(seo, `Missing current SEO context: ${page.slug}`);
    const allImageRefs = collectImageRefs(content);
    const refs = uniqueImageRefs(content);
    assert(refs.length > 0, `No image assets found: ${page.slug}`);
    const sourceUrls = new Set(refs.map((ref) => ref.sourceUrl));
    const heroSource = refs.find((ref) => ref.path === "hero.image.src") ?? refs[0];
    const imageAliases = allImageRefs
      .filter((ref) => ref.key === "poster" && !sourceUrls.has(ref.sourceUrl))
      .map((ref) => ({ sourceUrl: ref.sourceUrl, targetSourceUrl: heroSource.sourceUrl, path: ref.path }));
    const videoRefs = collectVideoRefs(content).filter((ref) => VIDEO_PATTERN.test(ref.value));
    pageSnapshots.push({ page, pageJson, sectionKey, section, settings, content, seo, anchor: stringValue(settings.anchor), refs, allImageRefs, imageAliases, videoRefs });
  }
  const themes = await prisma.videoTheme.findMany({
    where: { siteId: targetSiteId, slug: { in: TARGET_TOPIC_SLUGS } },
    select: { id: true, siteId: true, slug: true, name: true, imageUrl: true, galleryImages: true },
    orderBy: { slug: "asc" }
  });
  assert.equal(themes.length, TARGET_TOPIC_SLUGS.length, "Target VideoTheme count changed.");
  const themeBySlug = new Map(themes.map((theme) => [theme.slug, theme]));
  const globalUrls = new Set();
  for (const snapshot of pageSnapshots) for (const ref of snapshot.refs) globalUrls.add(ref.sourceUrl);
  return { site, pages: pageSnapshots, themeBySlug, themes, globalImageCount: globalUrls.size };
}

function buildPlan(snapshot) {
  const tasks = [];
  for (const [pageIndex, page] of snapshot.pages.entries()) {
    const slug = page.anchor;
    const profile = TOPIC_PROFILES[slug];
    assert(profile, `Missing topic profile: ${slug}`);
    for (const [slotIndex, ref] of page.refs.entries()) {
      const direction = SCENE_DIRECTIONS[slotIndex % SCENE_DIRECTIONS.length];
      const hashSeed = `${batchId}:${slug}:${ref.sourceUrl}:${slotIndex}`;
      const filename = `${slug}-${String(slotIndex + 1).padStart(2, "0")}-${safeStem(ref.sourceUrl)}-${sha256(hashSeed).slice(0, 10)}.webp`;
      const pageDescriptor = { ...page, slug: `/ai-video-generation/${slug}`, totalImages: page.refs.length };
      const outputRelative = path.posix.join("sites/site_aidreamshoots/generated/regenerated", batchId, slug, filename);
      tasks.push({
        id: `${slug}-${String(slotIndex + 1).padStart(2, "0")}`,
        pageSlug: pageDescriptor.slug,
        topicSlug: slug,
        pageIndex,
        slotIndex,
        sourceUrl: ref.sourceUrl,
        sourcePath: ref.path,
        beforeAlt: ref.currentAlt,
        context: ref.context,
        directionId: direction.id,
        direction: direction.visual,
        altText: altTextFor(profile, direction, pageIndex, slotIndex),
        prompt: buildPrompt({ page: pageDescriptor, profile, direction, ref, pageIndex, slotIndex }),
        filename,
        stageFile: path.join(outputRoot, slug, filename),
        finalFile: path.join(finalRoot, slug, filename),
        outputRelative,
        publicUrl: `${finalPublicRoot}/${slug}/${filename}`,
        status: "planned",
        outputHash: "",
        outputAHash: "",
        providerRequestId: "",
        error: ""
      });
    }
  }
  assert.equal(tasks.length, maxPaidCreateAttempts, `Expected exactly ${maxPaidCreateAttempts} unique image assets.`);
  assert.equal(new Set(tasks.map((task) => task.sourceUrl)).size, tasks.length, "Source image URLs must be unique across the scoped pages.");
  assert.equal(new Set(tasks.map((task) => task.prompt)).size, tasks.length, "Every image needs a unique prompt.");
  assert.equal(new Set(tasks.map((task) => task.filename)).size, tasks.length, "Every generated filename must be unique.");
  assert.equal(new Set(tasks.map((task) => task.altText)).size, tasks.length, "Every generated alt text must be unique.");
  return {
    schemaVersion: 1,
    kind: "aidreamshoots-other-topic-image-regeneration",
    mode: "planned",
    batchId,
    createdAt: new Date().toISOString(),
    targetSite: targetSiteId,
    targetSiteSlug,
    targetDomain,
    scope: "navigation-screenshot-highlighted-topic-detail-pages-excluding-talking-photo",
    topicSlugs: TARGET_TOPIC_SLUGS,
    imageCount: tasks.length,
    provider: {
      id: providerId,
      label: "image4",
      model: imageModel,
      endpoint: "",
      providerType: "image",
      size: imageSize,
      quality: imageQuality,
      generationConcurrency,
      maxPaidCreateAttempts,
      noAutomaticRetry: true,
      fallback: "disabled"
    },
    diversity: {
      strategy: "theme-anchor-plus-current-seo-context-plus-independent-scene-style-plus-global-multi-fingerprint-cross-image-gate",
      uniqueSourceImages: tasks.length,
      uniquePrompts: new Set(tasks.map((task) => task.prompt)).size,
      uniqueAltTexts: new Set(tasks.map((task) => task.altText)).size,
      minimumCrossAHashDistance,
      minimumCrossDHashDistance,
      minimumCrossColorHashDistance
    },
    safety: {
      userAuthorizedMaxPaidCreateAttempts: maxPaidCreateAttempts,
      paidCreateAttemptsHardCap: maxPaidCreateAttempts,
      noAutomaticRetry: true,
      noProviderFallback: true,
      ambiguousCreateStateStopsRun: true,
      videoSourcesWillRemainUnchanged: true,
      builtInCodexImageGeneration: false
    },
    before: {
      pages: snapshot.pages.map((page) => ({
        id: page.page.id,
        slug: page.page.slug,
        updatedAt: page.page.updatedAt,
        anchor: page.anchor,
        imageUrls: page.allImageRefs.map((ref) => ref.sourceUrl),
        imageAliases: page.imageAliases,
        videoRefs: page.videoRefs
      })),
      themes: snapshot.themes.map((theme) => ({ id: theme.id, slug: theme.slug, imageUrl: theme.imageUrl, galleryImages: theme.galleryImages }))
    },
    counts: {
      pages: snapshot.pages.length,
      uniqueImageAssets: tasks.length,
      uniqueImageReferences: snapshot.pages.reduce((count, page) => count + page.refs.length + page.imageAliases.length, 0),
      imageReferences: snapshot.pages.reduce((count, page) => count + page.allImageRefs.length, 0)
    },
    tasks
  };
}

function bitDistance(left, right) {
  let value = left ^ right;
  let distance = 0;
  while (value) {
    distance += Number(value & 1n);
    value >>= 1n;
  }
  return distance;
}

async function imageFingerprints(filePath) {
  const luminance = await sharp(filePath).resize(8, 8, { fit: "fill" }).grayscale().raw().toBuffer();
  const average = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
  let averageHash = 0n;
  luminance.forEach((value, index) => {
    if (value >= average) averageHash |= 1n << BigInt(index);
  });

  const gradient = await sharp(filePath).resize(9, 8, { fit: "fill" }).grayscale().raw().toBuffer();
  let differenceHash = 0n;
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const index = row * 9 + column;
      if (gradient[index] >= gradient[index + 1]) differenceHash |= 1n << BigInt(row * 8 + column);
    }
  }

  const color = await sharp(filePath).resize(8, 8, { fit: "fill" }).removeAlpha().raw().toBuffer();
  const channelAverages = [0, 0, 0];
  for (let index = 0; index < color.length; index += 3) {
    for (let channel = 0; channel < 3; channel += 1) channelAverages[channel] += color[index + channel];
  }
  for (let channel = 0; channel < 3; channel += 1) channelAverages[channel] /= 64;
  let colorHash = 0n;
  for (let pixel = 0; pixel < 64; pixel += 1) {
    const index = pixel * 3;
    for (let channel = 0; channel < 3; channel += 1) {
      if (color[index + channel] >= channelAverages[channel]) colorHash |= 1n << BigInt(pixel * 3 + channel);
    }
  }
  return { averageHash, differenceHash, colorHash };
}

async function evaluateDiversity(manifest) {
  const failures = [];
  const outputHashes = new Set();
  const fingerprints = [];
  for (const task of manifest.tasks) {
    assert(fs.existsSync(task.stageFile), `Missing staged image: ${task.stageFile}`);
    const buffer = fs.readFileSync(task.stageFile);
    task.outputHash = sha256(buffer);
    outputHashes.add(task.outputHash);
    fingerprints.push({ id: task.id, topicSlug: task.topicSlug, hashes: await imageFingerprints(task.stageFile) });
  }
  if (outputHashes.size !== manifest.tasks.length) failures.push(`duplicate_output_hashes=${manifest.tasks.length - outputHashes.size}`);

  let minAverageDistance = 64;
  let minDifferenceDistance = 64;
  let minColorDistance = 192;
  let closestAveragePair = null;
  let closestDifferencePair = null;
  let closestColorPair = null;
  const visuallyClosePairs = [];
  for (let left = 0; left < fingerprints.length; left += 1) {
    for (let right = left + 1; right < fingerprints.length; right += 1) {
      const averageDistance = bitDistance(fingerprints[left].hashes.averageHash, fingerprints[right].hashes.averageHash);
      const differenceDistance = bitDistance(fingerprints[left].hashes.differenceHash, fingerprints[right].hashes.differenceHash);
      const colorDistance = bitDistance(fingerprints[left].hashes.colorHash, fingerprints[right].hashes.colorHash);
      if (averageDistance < minAverageDistance) {
        minAverageDistance = averageDistance;
        closestAveragePair = [fingerprints[left].id, fingerprints[right].id];
      }
      if (differenceDistance < minDifferenceDistance) {
        minDifferenceDistance = differenceDistance;
        closestDifferencePair = [fingerprints[left].id, fingerprints[right].id];
      }
      if (colorDistance < minColorDistance) {
        minColorDistance = colorDistance;
        closestColorPair = [fingerprints[left].id, fingerprints[right].id];
      }
      if (averageDistance < minimumCrossAHashDistance && differenceDistance < minimumCrossDHashDistance && colorDistance < minimumCrossColorHashDistance) {
        visuallyClosePairs.push({
          pair: [fingerprints[left].id, fingerprints[right].id],
          topics: [fingerprints[left].topicSlug, fingerprints[right].topicSlug],
          averageDistance,
          differenceDistance,
          colorDistance
        });
      }
    }
  }
  if (visuallyClosePairs.length) failures.push(`cross_image_visual_similarity_pairs=${visuallyClosePairs.length}`);
  return {
    pass: failures.length === 0,
    minimumCrossAHashDistance,
    minimumCrossDHashDistance,
    minimumCrossColorHashDistance,
    actualMinimumCrossAHashDistance: minAverageDistance,
    actualMinimumCrossDHashDistance: minDifferenceDistance,
    actualMinimumCrossColorHashDistance: minColorDistance,
    closestAveragePair,
    closestDifferencePair,
    closestColorPair,
    visuallyClosePairs,
    uniqueOutputHashes: outputHashes.size,
    failures
  };
}

function imagePayload(body) {
  return body?.data?.[0]?.b64_json || body?.data?.[0]?.image_base64 || body?.output?.[0]?.b64_json || body?.output?.[0]?.image_base64 || body?.image_base64 || "";
}

function imageUrlPayload(body) {
  return body?.data?.[0]?.url || body?.output?.[0]?.url || body?.url || body?.image_url || "";
}

function redactedBody(body) {
  return JSON.parse(JSON.stringify(body, (key, value) => /(?:b64|base64)/i.test(key) && typeof value === "string" ? `[omitted:${value.length}]` : value));
}

async function fileExists(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

async function loadProvider() {
  const prisma = new PrismaClient();
  try {
    const provider = await prisma.platformAiProvider.findUnique({
      where: { id: providerId },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, preferred: true, maxImagesPerRequest: true }
    });
    assert(provider, `${providerId}: provider not found.`);
    assert.equal(provider.providerType, "image", "Configured provider must be an image provider.");
    assert.equal(provider.modelType, imageModel, `Configured provider model must be ${imageModel}.`);
    assert.equal(provider.enabled, true, "Configured provider is disabled.");
    const apiKey = runtimeProviderKey || provider.apiKey;
    assert(apiKey && provider.aiUrl, "Configured provider is missing credentials or URL.");
    assert(provider.maxImagesPerRequest >= 1, "Configured provider cannot accept image generation requests.");
    const baseUrl = isBumingProvider
      ? String(provider.aiUrl).trim().replace(/\/+$/, "").replace(/\/v1$/i, "")
      : normalizeBaseUrl(provider.aiUrl);
    return { ...provider, apiKey, keySource: runtimeProviderKey ? "runtime-override" : "database", baseUrl };
  } finally {
    await prisma.$disconnect();
  }
}

async function checkProviderReadOnly(provider) {
  const response = await fetch(`${provider.baseUrl}${providerModelsPath}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${provider.apiKey}` },
    signal: AbortSignal.timeout(30_000)
  });
  const body = await response.json().catch(() => ({}));
  const ids = Array.isArray(body?.data) ? body.data.map((item) => item?.id).filter(Boolean) : [];
  assert(response.ok, `Provider read-only model check failed with ${response.status}.`);
  assert(ids.includes(provider.modelType), `Provider model list does not expose ${provider.modelType}.`);
  return { status: response.status, modelCount: ids.length, modelAvailable: true };
}

async function downloadProviderImage(url, apiKey) {
  const response = await fetch(url, { method: "GET", headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(60_000) });
  assert(response.ok, `Provider image download failed with ${response.status}.`);
  return Buffer.from(await response.arrayBuffer());
}

async function transparentContentBounds(buffer) {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.hasAlpha || !metadata.width || !metadata.height) return null;
  const sampleWidth = 256;
  const sampleHeight = Math.max(1, Math.round(sampleWidth * metadata.height / metadata.width));
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .resize(sampleWidth, sampleHeight, { fit: "fill" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < 0 || (minX === 0 && minY === 0 && maxX === info.width - 1 && maxY === info.height - 1)) return null;
  const left = Math.max(0, Math.floor(minX * metadata.width / info.width));
  const top = Math.max(0, Math.floor(minY * metadata.height / info.height));
  const right = Math.min(metadata.width, Math.ceil((maxX + 1) * metadata.width / info.width));
  const bottom = Math.min(metadata.height, Math.ceil((maxY + 1) * metadata.height / info.height));
  const width = right - left;
  const height = bottom - top;
  return width >= 256 && height >= 256 ? { left, top, width, height } : null;
}

async function normalizeGeneratedImage(buffer, task) {
  const metadata = await sharp(buffer).metadata();
  assert((metadata.width ?? 0) >= 256 && (metadata.height ?? 0) >= 256, `Provider output is too small for ${task.id}.`);
  const bounds = await transparentContentBounds(buffer);
  fs.mkdirSync(path.dirname(task.stageFile), { recursive: true });
  const source = bounds ? sharp(buffer).extract(bounds) : sharp(buffer);
  await source
    .resize(outputWidth, outputHeight, { fit: "cover", position: "attention" })
    .webp({ quality: 92, smartSubsample: true })
    .toFile(task.stageFile);
  assert(await fileExists(task.stageFile), `Normalized image missing for ${task.id}.`);
}

function nestedString(value, keys, depth = 0) {
  if (depth > 6 || !value || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = nestedString(item, keys, depth + 1);
      if (found) return found;
    }
    return "";
  }
  for (const key of keys) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  for (const child of Object.values(value)) {
    const found = nestedString(child, keys, depth + 1);
    if (found) return found;
  }
  return "";
}

function bumingImagePayload(body) {
  return nestedString(body, ["b64_json", "image_base64"]);
}

function bumingImageUrlPayload(body) {
  return nestedString(body, ["original_url", "result_url", "output_url", "url", "image_url"]);
}

function bumingTaskIdPayload(body) {
  return nestedString(body, ["task_id", "taskId", "creation_task_id"]);
}

function bumingTaskStatusPayload(body) {
  return nestedString(body, ["status", "state", "task_status"]).toLowerCase();
}

async function resolveBumingImage(provider, body, taskId) {
  const immediateEncoded = bumingImagePayload(body);
  if (immediateEncoded) return Buffer.from(immediateEncoded, "base64");
  const immediateUrl = bumingImageUrlPayload(body);
  if (immediateUrl) return downloadProviderImage(immediateUrl, provider.apiKey);
  assert(taskId, "Buming image response did not include a task id or image result.");

  const startedAt = Date.now();
  let lastBody = {};
  while (Date.now() - startedAt < imageTimeoutMs) {
    const response = await fetch(`${provider.baseUrl}${providerImageRuntimeTaskPath(taskId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${provider.apiKey}` },
      signal: AbortSignal.timeout(Math.min(30_000, imageTimeoutMs))
    });
    lastBody = await response.json().catch(() => ({}));
    assert(response.ok, `Buming image task status failed with ${response.status}.`);
    const status = bumingTaskStatusPayload(lastBody);
    assert(!/^(failed|error|cancelled|canceled|rejected)$/.test(status), `Buming image task failed: ${nestedString(lastBody, ["error", "message"]) || status}.`);
    const encoded = bumingImagePayload(lastBody);
    if (encoded) return Buffer.from(encoded, "base64");
    const imageUrl = bumingImageUrlPayload(lastBody);
    if (imageUrl) return downloadProviderImage(imageUrl, provider.apiKey);
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error(`Buming image task timed out: ${taskId}; lastStatus=${bumingTaskStatusPayload(lastBody) || "unknown"}.`);
}

async function generateOne(task, provider, manifest) {
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Generation requires --confirm=${expectedConfirmation}.`);
  const idempotencyKey = `${expectedConfirmation}:${batchId}:${task.id}`;
  const clientRequestId = `${batchId}:${task.id}`;
  const startedAt = Date.now();
  let response;
  let body = {};
  let requestId = "";
  let providerTaskId = "";
  const endpoint = isBumingProvider
    ? `${provider.baseUrl}${providerImageRuntimeInvokePath}`
    : `${provider.baseUrl}${providerImageGenerationsPath}`;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        "Idempotency-Key": idempotencyKey,
        "X-Client-Request-Id": clientRequestId
      },
      body: JSON.stringify(isBumingProvider ? {
        modality: "image",
        model_id: provider.modelType,
        operation: "generate",
        params: {
          aspect_ratio: "1:1",
          count: 1,
          mode: "text-to-image",
          output_format: "png",
          prompt: task.prompt,
          quality: imageQuality,
          resolution: imageResolution
        }
      } : {
        model: provider.modelType,
        prompt: task.prompt,
        size: imageSize,
        quality: imageQuality,
        response_format: "b64_json"
      }),
      signal: AbortSignal.timeout(imageTimeoutMs)
    });
    body = await response.json().catch(() => ({}));
  } catch (error) {
    manifest.runtime.paidCreateAttempts += 1;
    if (task.status !== "ambiguous") manifest.runtime.ambiguous += 1;
    task.status = "ambiguous";
    task.error = error instanceof Error ? error.message : String(error);
    task.providerRequestId = "";
    writeJson(path.join(providerResultRoot, `${task.id}.json`), {
      batchId,
      taskId: task.id,
      providerId: provider.id,
      model: provider.modelType,
      endpoint,
      idempotencyKey,
      clientRequestId,
      elapsedMs: Date.now() - startedAt,
      error: task.error,
      retryPolicy: "no-retry"
    });
    throw new Error(`Ambiguous provider create state at ${task.id}; stopped without retry.`);
  }

  requestId = response.headers.get("x-request-id") || response.headers.get("request-id") || "";
  providerTaskId = isBumingProvider ? bumingTaskIdPayload(body) : "";
  manifest.runtime.paidCreateAttempts += 1;
  task.providerRequestId = providerTaskId || requestId;
  writeJson(path.join(providerResultRoot, `${task.id}.json`), {
    batchId,
    taskId: task.id,
    providerId: provider.id,
    providerLabel: provider.label,
    model: provider.modelType,
    endpoint,
    idempotencyKey,
    clientRequestId,
    requestId,
    providerTaskId,
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    response: redactedBody(body),
    retryPolicy: "no-retry"
  });
  if (!response.ok) {
    const ambiguous = response.status >= 500 || response.status === 429;
    task.error = `Provider create returned ${response.status}.`;
    if (ambiguous) {
      if (task.status !== "ambiguous") manifest.runtime.ambiguous += 1;
      task.status = "ambiguous";
      throw new Error(`${task.error} Provider state is ambiguous; stopped without retry.`);
    }
    manifest.runtime.failed += 1;
    task.status = "failed";
    throw new Error(`${task.error} Stopped without retry.`);
  }

  let imageBuffer;
  try {
    imageBuffer = isBumingProvider
      ? await resolveBumingImage(provider, body, providerTaskId)
      : (() => {
        const encoded = imagePayload(body);
        return encoded ? Promise.resolve(Buffer.from(encoded, "base64")) : downloadProviderImage(imageUrlPayload(body), provider.apiKey);
      })();
    imageBuffer = await imageBuffer;
    assert(imageBuffer.length > 0, `Provider returned an empty image for ${task.id}.`);
    await normalizeGeneratedImage(imageBuffer, task);
  } catch (error) {
    if (task.status !== "ambiguous") manifest.runtime.ambiguous += 1;
    task.status = "ambiguous";
    task.error = error instanceof Error ? error.message : String(error);
    writeJson(path.join(providerResultRoot, `${task.id}.json`), {
      batchId,
      taskId: task.id,
      providerId: provider.id,
      providerLabel: provider.label,
      model: provider.modelType,
      endpoint,
      idempotencyKey,
      clientRequestId,
      requestId,
      providerTaskId,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      response: redactedBody(body),
      resultError: task.error,
      retryPolicy: "no-retry"
    });
    throw new Error(`Ambiguous provider result state at ${task.id}; stopped without retry.`);
  }
  const wasAmbiguous = task.status === "ambiguous";
  task.status = "succeeded";
  if (wasAmbiguous) manifest.runtime.ambiguous = Math.max(0, manifest.runtime.ambiguous - 1);
  manifest.runtime.succeeded += 1;
  manifest.runtime.providerRequestIds.push({ taskId: task.id, requestId });
  return task;
}

async function generate(manifest) {
  const isResume = mode === "resume" || args.resume === "true";
  const retryFailedTasks = args["retry-failed"] === "true";
  const retryAmbiguousTasks = args["retry-ambiguous"] === "true";
  const providerSwitch = providerId !== manifest.provider?.id;
  const authorizedMaxPaidCreateAttempts = Number(args["max-paid-attempts"] || (isResume ? manifest.safety?.userAuthorizedMaxPaidCreateAttempts : maxPaidCreateAttempts));
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Generation requires --confirm=${expectedConfirmation}.`);
  assert(Number.isInteger(authorizedMaxPaidCreateAttempts) && authorizedMaxPaidCreateAttempts >= maxPaidCreateAttempts, `The paid image create cap must be an integer of at least ${maxPaidCreateAttempts}.`);
  assert(authorizedMaxPaidCreateAttempts <= maximumAllowedPaidCreateAttempts, `This script will not exceed the configured safety ceiling of ${maximumAllowedPaidCreateAttempts} paid image create attempts.`);
  assert(!retryFailedTasks && !retryAmbiguousTasks || runtimeProviderKey || providerSwitch, "Explicit failed/ambiguous task recovery requires a runtime provider key override or an explicitly selected alternate provider.");
  if (!isResume) assert.equal(Number(manifest.runtime?.paidCreateAttempts || 0), 0, "Paid creates already exist for this manifest; inspect/recover instead of generating again.");
  assert.equal(manifest.tasks.length, maxPaidCreateAttempts, `Manifest must contain exactly ${maxPaidCreateAttempts} image tasks.`);
  assert(manifest.runtime?.failed === 0 || isResume, "Failed provider tasks require an explicit resume/recovery run.");

  if (isResume) {
    assert(Number(manifest.runtime?.paidCreateAttempts || 0) > 0, "Resume requires a manifest with prior paid create attempts.");
    for (const task of manifest.tasks) {
      // The interrupted run persisted this known 502 as failed before the
      // ambiguity classification was tightened. Normalize it before the
      // single explicit idempotent recovery request below.
      if (task.status === "failed" && /\b502\b/.test(task.error || "")) {
        task.status = "ambiguous";
        task.error = "Provider create returned 502. Provider state is ambiguous; stopped without retry.";
        manifest.runtime.failed = Math.max(0, Number(manifest.runtime.failed || 0) - 1);
        manifest.runtime.ambiguous = Number(manifest.runtime.ambiguous || 0) + 1;
      }
      if ((task.status === "failed" && retryFailedTasks) || (task.status === "ambiguous" && retryAmbiguousTasks)) {
        task.status = "planned";
        task.error = "";
      }
    }
    // Counters represent the current task state, while paidCreateAttempts
    // remains the immutable count of provider POST attempts.
    manifest.runtime.succeeded = manifest.tasks.filter((task) => task.status === "succeeded").length;
    manifest.runtime.failed = manifest.tasks.filter((task) => task.status === "failed").length;
    manifest.runtime.ambiguous = manifest.tasks.filter((task) => task.status === "ambiguous").length;
  }

  if (isResume) {
    manifest.runtime.succeeded = manifest.tasks.filter((task) => task.status === "succeeded").length;
    manifest.runtime.failed = manifest.tasks.filter((task) => task.status === "failed").length;
    manifest.runtime.ambiguous = manifest.tasks.filter((task) => task.status === "ambiguous").length;
  }
  const recoveryTasks = manifest.tasks.filter((task) => task.status === "planned" && task.error === "" && ((retryFailedTasks || retryAmbiguousTasks) && task.providerRequestId));
  assert(recoveryTasks.length <= 1, "More than one ambiguous provider task requires a fresh operator review; no bulk retry is allowed.");
  if (!isResume) assert.equal(recoveryTasks.length, 0, "Ambiguous provider state requires an explicit resume/recovery run.");
  const recoveryTaskIds = new Set(recoveryTasks.map((task) => task.id));
  const pendingTasks = manifest.tasks.filter((task) => task.status === "planned" && !recoveryTaskIds.has(task.id));
  assert(Number(manifest.runtime?.paidCreateAttempts || 0) + recoveryTasks.length + pendingTasks.length <= authorizedMaxPaidCreateAttempts, `The remaining work would exceed the authorized cap of ${authorizedMaxPaidCreateAttempts} paid image create attempts.`);
  const provider = await loadProvider();
  const modelCheck = await checkProviderReadOnly(provider);
  manifest.provider = {
    ...manifest.provider,
    id: provider.id,
    label: provider.label,
    model: provider.modelType,
    endpoint: `${provider.baseUrl}${isBumingProvider ? providerImageRuntimeInvokePath : providerImageGenerationsPath}`,
    size: imageSize,
    quality: imageQuality,
    resolution: imageResolution || undefined,
    readOnlyModelCheck: modelCheck,
    maxPaidCreateAttempts: authorizedMaxPaidCreateAttempts
  };
  manifest.safety = {
    ...manifest.safety,
    userAuthorizedMaxPaidCreateAttempts: authorizedMaxPaidCreateAttempts,
    paidCreateAttemptsHardCap: authorizedMaxPaidCreateAttempts
  };
  if (!isResume) {
    manifest.runtime = {
      paidCreateAttempts: 0,
      succeeded: 0,
      failed: 0,
      ambiguous: 0,
      providerRequestIds: [],
      startedAt: new Date().toISOString(),
      concurrency: generationConcurrency,
      allowedMaxPaidCreateAttempts: authorizedMaxPaidCreateAttempts
    };
  } else {
    manifest.runtime.providerRequestIds = Array.isArray(manifest.runtime.providerRequestIds) ? manifest.runtime.providerRequestIds : [];
    manifest.runtime.concurrency = generationConcurrency;
    manifest.runtime.allowedMaxPaidCreateAttempts = authorizedMaxPaidCreateAttempts;
  }
  fs.mkdirSync(outputRoot, { recursive: true });
  fs.mkdirSync(providerResultRoot, { recursive: true });
  writeJson(manifestPath, manifest);
  console.log(JSON.stringify({
    operation: "paid-create-one-image-per-asset",
    endpoint: `${provider.baseUrl}${isBumingProvider ? providerImageRuntimeInvokePath : providerImageGenerationsPath}`,
    method: "POST",
    provider: provider.label,
    model: provider.modelType,
    size: imageSize,
    quality: imageQuality,
    resolution: imageResolution || null,
    plannedImageAssets: manifest.tasks.length,
    maxPaidCreateAttempts: authorizedMaxPaidCreateAttempts,
    resume: isResume,
    recoveryTaskIds: recoveryTasks.map((task) => task.id),
    retryFailedTasks,
    retryAmbiguousTasks,
    pendingTaskCount: pendingTasks.length,
    concurrency: generationConcurrency,
    retry: false,
    fallback: false,
    stopCondition: "stop launching work on first failed or ambiguous create; run global similarity gate before apply"
  }, null, 2));

  for (const task of recoveryTasks) {
    try {
      await generateOne(task, provider, manifest);
      writeJson(manifestPath, manifest);
      console.log(JSON.stringify({ recovered: true, completed: manifest.runtime.succeeded, total: manifest.tasks.length, taskId: task.id, requestId: task.providerRequestId || null }));
    } catch (error) {
      writeJson(manifestPath, manifest);
      throw error;
    }
  }

  let nextIndex = 0;
  let haltedError = null;
  const remainingTasks = manifest.tasks.filter((task) => task.status === "planned");
  const worker = async () => {
    while (!haltedError) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= remainingTasks.length) return;
      const task = remainingTasks[index];
      try {
        await generateOne(task, provider, manifest);
        writeJson(manifestPath, manifest);
        console.log(JSON.stringify({ completed: manifest.runtime.succeeded, total: manifest.tasks.length, taskId: task.id, requestId: task.providerRequestId || null }));
      } catch (error) {
        haltedError = error;
        writeJson(manifestPath, manifest);
        return;
      }
    }
  };
  await Promise.all(Array.from({ length: generationConcurrency }, () => worker()));
  manifest.runtime.completedAt = new Date().toISOString();
  writeJson(manifestPath, manifest);
  if (haltedError) throw haltedError;
  assert(manifest.runtime.paidCreateAttempts <= authorizedMaxPaidCreateAttempts, "Paid image create attempts exceeded the authorized cap.");
  assert.equal(manifest.runtime.succeeded, manifest.tasks.length, "Every image task must succeed before the similarity gate.");
  assert.equal(manifest.runtime.failed, 0, "Failed provider tasks block the similarity gate.");
  assert.equal(manifest.runtime.ambiguous, 0, "Ambiguous provider state blocks the similarity gate.");
  manifest.diversityResult = await evaluateDiversity(manifest);
  writeJson(manifestPath, manifest);
  assert(manifest.diversityResult.pass, `Cross-image similarity gate failed; no assets were applied: ${manifest.diversityResult.failures.join("; ")}`);
  console.log(JSON.stringify({ ok: true, paidCreateAttempts: manifest.runtime.paidCreateAttempts, generatedAssets: manifest.tasks.length, diversity: manifest.diversityResult, reportPath: manifestPath }, null, 2));
}

function rewriteContent(value, replacements) {
  if (Array.isArray(value)) return value.map((item) => rewriteContent(item, replacements));
  if (!value || typeof value !== "object") return replacements.get(value)?.publicUrl ?? value;
  const object = record(value);
  const sourceUrl = ["src", "poster", "imageUrl", "url"].map((key) => object?.[key]).find((candidate) => typeof candidate === "string" && replacements.has(candidate));
  const sourceReplacement = sourceUrl ? replacements.get(sourceUrl) : null;
  const next = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, rewriteContent(child, replacements)]));
  if (sourceReplacement) next.alt = sourceReplacement.altText;
  return next;
}

function replaceThemeGalleryImages(galleryImages, replacements) {
  if (!Array.isArray(galleryImages)) return galleryImages;
  return galleryImages.map((value) => replacements.get(value)?.publicUrl ?? value);
}

async function ensureFinalOutputs(manifest) {
  for (const task of manifest.tasks) {
    assert(await fileExists(task.stageFile), `Missing staged output: ${task.stageFile}`);
    fs.mkdirSync(path.dirname(task.finalFile), { recursive: true });
    if (fs.existsSync(task.finalFile)) {
      assert.equal(sha256(fs.readFileSync(task.finalFile)), sha256(fs.readFileSync(task.stageFile)), `Existing final output differs: ${task.finalFile}`);
    } else {
      fs.copyFileSync(task.stageFile, task.finalFile);
    }
  }
}

function replacementsFor(manifest) {
  const replacements = new Map(manifest.tasks.map((task) => [task.sourceUrl, { publicUrl: task.publicUrl, altText: task.altText }]));
  for (const task of manifest.tasks) {
    replacements.set(task.publicUrl, { publicUrl: task.publicUrl, altText: task.altText });
  }
  const tasksBySource = new Map(manifest.tasks.map((task) => [task.sourceUrl, task]));
  for (const alias of manifest.before.pages.flatMap((page) => page.imageAliases ?? [])) {
    const target = tasksBySource.get(alias.targetSourceUrl);
    assert(target, `Image alias target is missing from the generated task list: ${alias.targetSourceUrl}`);
    replacements.set(alias.sourceUrl, { publicUrl: target.publicUrl, altText: target.altText });
  }
  return replacements;
}

async function apply(manifest) {
  const authorizedMaxPaidCreateAttempts = Number(manifest.safety?.userAuthorizedMaxPaidCreateAttempts || maxPaidCreateAttempts);
  assert.equal(String(args.confirm || ""), expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert(manifest.runtime?.paidCreateAttempts >= manifest.runtime?.succeeded, "Paid create accounting is inconsistent.");
  assert(manifest.runtime?.paidCreateAttempts <= authorizedMaxPaidCreateAttempts, "Apply would use a manifest beyond the authorized paid image create cap.");
  assert.equal(manifest.runtime?.succeeded, manifest.tasks.length, "Every image task must succeed before apply.");
  assert.equal(manifest.runtime?.failed, 0, "Failed provider tasks block apply.");
  assert.equal(manifest.runtime?.ambiguous, 0, "Ambiguous provider state blocks apply.");
  assert.equal(manifest.diversityResult?.pass, true, "Cross-image similarity gate must pass before apply.");
  assertDatabaseTarget({ expectedTarget: "local" });
  assertNonProductionWriteTarget();
  const replacements = replacementsFor(manifest);
  const prisma = new PrismaClient();
  try {
    const current = await loadTargetPages(prisma);
    assert.equal(current.pages.length, manifest.before.pages.length, "Target page count changed after generation.");
    const beforeBySlug = new Map(manifest.before.pages.map((page) => [page.slug, page]));
    for (const page of current.pages) {
      const before = beforeBySlug.get(page.page.slug);
      assert(before, `Missing manifest snapshot for ${page.page.slug}`);
      const currentRefs = uniqueImageRefs(page.content).map((ref) => ref.sourceUrl);
      const alreadyApplied = currentRefs.length > 0 && currentRefs.every((url) => url.startsWith(`${finalPublicRoot}/`));
      if (!alreadyApplied) {
        assert.equal(new Date(page.page.updatedAt).getTime(), new Date(before.updatedAt).getTime(), `Page changed after planning: ${page.page.slug}`);
        const allowed = new Set([...before.imageUrls, ...currentRefs.filter((url) => replacements.has(url))]);
        assert(currentRefs.every((url) => allowed.has(url)), `Unexpected page image change after planning: ${page.page.slug}`);
      }
    }
    await ensureFinalOutputs(manifest);
    const updated = await prisma.$transaction(async (tx) => {
      for (const page of current.pages) {
        const pageJson = rewriteContent(page.pageJson, replacements);
        await tx.livePage.update({ where: { id: page.page.id }, data: { contentJson: pageJson } });
        const theme = current.themeBySlug.get(page.anchor);
        assert(theme, `Missing VideoTheme for ${page.anchor}`);
        const pageHeroTask = manifest.tasks.find((task) => task.topicSlug === page.anchor && task.slotIndex === 0);
        const themeImageUrl = replacements.get(theme.imageUrl)?.publicUrl
          ?? (String(theme.imageUrl || "").startsWith(`${finalPublicRoot}/`) ? theme.imageUrl : pageHeroTask?.publicUrl ?? theme.imageUrl);
        await tx.videoTheme.update({
          where: { id: theme.id },
          data: {
            imageUrl: themeImageUrl,
            galleryImages: replaceThemeGalleryImages(theme.galleryImages, replacements)
          }
        });
      }
      for (const task of manifest.tasks) {
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: targetSiteId, storageKey: task.outputRelative } },
          create: {
            id: `media_${targetSiteId}_${sha256(task.outputRelative).slice(0, 20)}`,
            siteId: targetSiteId,
            label: task.altText,
            storageKey: task.outputRelative,
            mimeType: "image/webp",
            usageType: "theme",
            sourceType: "ai-other-topic-regeneration",
            previewUrl: task.publicUrl,
            originUrl: task.publicUrl,
            altText: task.altText,
            notes: `Generated for ${task.pageSlug}; batch ${batchId}.`
          },
          update: {
            label: task.altText,
            mimeType: "image/webp",
            usageType: "theme",
            sourceType: "ai-other-topic-regeneration",
            previewUrl: task.publicUrl,
            originUrl: task.publicUrl,
            altText: task.altText,
            notes: `Generated for ${task.pageSlug}; batch ${batchId}.`
          }
        });
      }
      return { pages: current.pages.length, videoThemes: current.pages.length, mediaAssets: manifest.tasks.length };
    }, { timeout: 180_000 });

    const readback = await loadTargetPages(prisma);
    for (const page of readback.pages) {
      const refs = collectImageRefs(page.content);
      assert(refs.length > 0, `Readback has no images: ${page.page.slug}`);
      assert(refs.every((ref) => typeof ref.sourceUrl === "string" && ref.sourceUrl.startsWith(`${finalPublicRoot}/`)), `Readback contains an old image URL: ${page.page.slug}`);
      assert(refs.every((ref) => typeof ref.currentAlt === "string" && ref.currentAlt.length >= 30 && ref.currentAlt.length <= 150), `Readback contains invalid alt text: ${page.page.slug}`);
      const before = beforeBySlug.get(page.page.slug);
      assert.deepEqual(page.videoRefs, before.videoRefs, `Video source/poster changed: ${page.page.slug}`);
    }
    manifest.apply = { target: "local", appliedAt: new Date().toISOString(), finalRoot, updated };
    manifest.mode = "applied";
    writeJson(manifestPath, manifest);
    console.log(JSON.stringify({ ok: true, mode: "applied", batchId, targetSiteId, topics: TARGET_TOPIC_SLUGS.length, images: manifest.tasks.length, updated, manifestPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  assert(["plan", "generate", "resume", "apply"].includes(mode), `Unsupported mode: ${mode}`);
  assertDatabaseTarget({ expectedTarget: "local" });
  if (mode === "plan") {
    const prisma = new PrismaClient();
    try {
      const snapshot = await loadTargetPages(prisma);
      const manifest = buildPlan(snapshot);
      writeJson(manifestPath, manifest);
      console.log(JSON.stringify({ ok: true, mode, manifestPath, batchId, targetSiteId, pages: manifest.counts.pages, imageAssets: manifest.imageCount, imageReferences: manifest.counts.imageReferences, maxPaidCreateAttempts, provider: manifest.provider, topics: TARGET_TOPIC_SLUGS }, null, 2));
    } finally {
      await prisma.$disconnect();
    }
    return;
  }
  const manifest = readJson(manifestPath);
  assert.equal(manifest.batchId, batchId, "Manifest batch id mismatch.");
  if (mode === "generate" || mode === "resume") await generate(manifest);
  else await apply(manifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
