// Aidreamcapes.com v2 storefront content builder.
// Source of truth for copy: scripts/data/aidreamcapes-site-v2/{master.json,content/*.json}.
// Output: LivePage rows (contentJson) and the ThemeSettings v2 navigation for site_aidreamcapes only.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

export const AIDREAMCAPES_SITE_ID = "site_aidreamcapes";
export const SITE_V2_SOURCE_REVISION = "aidreamcapes-site-v2";
const BASE = "https://www.aivideosugc.com";
const ASSET_ROOT = "/assets/sites/site_aidreamcapes/site-v2";
const DATA_DIR = path.join(process.cwd(), "scripts", "data", "aidreamcapes-site-v2");
// Keep in sync with src/lib/aidreamcapes-create-intent.ts.
const VIDEO_SIZES = ["9:16", "1:1", "16:9", "4:3", "3:4"];
const DEFAULT_PHOTO_PROMPT = "Create a product photo from my uploaded photo.";
const CREDITS_FAQ = {
  q: "How do credits work?",
  a: "You see the credit cost before you start. Credits are held when your job starts and used when it is delivered. If something fails, you get the credits back."
};

const LINES = {
  white: "Clean main photo for Amazon and Shopify", life: "Your product out in the real world", angle: "Front, side, back and top views",
  detail: "Show materials and finish up close", size: "Help shoppers see the real size", color: "Every color you sell, same style",
  box: "Show the full set or bundle", pack: "See your box or bag before printing", light: "Turn a flat photo into a studio shot",
  bg: "Same product, new setting", model: "Your product shown on an AI-generated model", tryon: "See a piece worn before the shoot",
  jewel: "Necklaces, rings and earrings, worn", look: "Editorial photos for your collection", head: "Matching photos for your About page",
  feed: "Scroll-stopping image for social feeds", ugc: "Looks like a customer shared it", story: "Square product photo for a Story layout after cropping",
  sale: "Seasonal photo with room for your offer", creator: "Someone holding and showing your product", demo: "Show it working, start to finish",
  unbox: "Open the box, reveal the product", ba: "The difference, side by side", howto: "Show customers how to use it",
  film: "A cinematic clip for launches", beauty: "Your product in a daily routine", drink: "Fresh pour and serve moments",
  home: "Your product making a space tidy", outfit: "A quick look at the whole outfit", launch: "Announce something new",
  compare: "Help buyers pick the right one", bf: "Holiday sale clip, add your price later"
};
const CARD_ORDER = ["creator", "white", "ba", "size", "beauty", "model", "unbox", "color", "demo", "life", "angle", "detail", "box", "pack", "light", "bg", "tryon", "jewel", "look", "feed", "ugc", "story", "sale", "howto", "film", "drink", "home", "outfit", "launch", "compare", "bf", "head"];
// Short scene descriptions used to pre-fill the workspace description when a template link is followed.
const TEMPLATE_PROMPTS = {
  white: "Product centered on a pure white background, soft even light, no props.",
  life: "Product in a bright real-life setting that suits it, natural light.",
  angle: "Clean studio views of the product from the front, side and back.",
  detail: "Close-up of the product's material and finish, soft studio light.",
  size: "Product next to a familiar everyday object for scale.",
  color: "The same product shown in each color I sell, same angle and light.",
  box: "Every item in the set laid out neatly together, clean background.",
  pack: "My packaging design on a box or pouch in a calm styled scene.",
  light: "The product with soft studio lighting and a gentle shadow.",
  bg: "The product on a new background that suits my brand.",
  model: "A model wearing my product in a clean studio.",
  tryon: "A model wearing this garment, front view, natural pose.",
  jewel: "Close-up of the jewelry piece being worn, soft light.",
  look: "Editorial fashion photo of the piece in a warm minimal interior.",
  head: "Professional headshot on a neutral background, soft light.",
  feed: "Product as the hero of a bright social feed image with space for a headline.",
  ugc: "A person casually holding the product at home, phone-camera feel.",
  story: "Square image of the product in a fitting scene, with open space above and below for Story text.",
  sale: "Seasonal styled scene around the product with empty space for an offer.",
  creator: "A creator holds the product toward the camera in a bright room and turns it slowly.",
  demo: "Hands use the product and show what it does, close-up, steady camera.",
  unbox: "Hands open a box and lift the product out, cozy home setting.",
  ba: "Split before and after of the space, the product makes the difference.",
  howto: "Show how to use the product in three simple steps, close-up.",
  film: "Slow cinematic reveal of the product with dramatic light.",
  beauty: "A person uses the product as part of a calm morning routine.",
  drink: "A fresh pour into a glass with ice, close-up, bright light.",
  home: "The product helps tidy a space, calm home setting.",
  outfit: "A model shows the full outfit with a slow turn.",
  launch: "The new product revealed in a clean styled scene.",
  compare: "Two versions of my product side by side on a clean surface.",
  bf: "The product in a festive setting with space for an offer."
};
const VIDEO_TOOLS = ["image-to-video", "url-to-video", "video-ads", "product-videos", "unboxing-videos", "before-after-videos", "spokesperson-videos"];
const PHOTO_TOOLS = ["photo-hub", "white-background", "lifestyle-photos", "model-photos", "change-background", "social-ad-photos"];
const TOOL_DESC = {
  "image-to-video": "Turn any product photo into a video", "url-to-video": "Paste a product link, get a video", "video-ads": "Short ads for TikTok, Reels and Shorts",
  "product-videos": "Show how your product looks and works", "unboxing-videos": "The first-look moment, no filming", "before-after-videos": "Show the difference your product makes",
  "spokesperson-videos": "A presenter shows your product on camera", "photo-hub": "Studio-quality shots from any photo", "white-background": "Ready for Amazon and Shopify",
  "lifestyle-photos": "Your product in a real-life scene", "model-photos": "Your clothes and accessories on a model", "change-background": "New background, same product",
  "social-ad-photos": "Images for Facebook and Instagram ads"
};
const TOOL_REL = {
  // Keep the cards that were made with a tool on that tool first. The remaining cards
  // describe things the tool can make, with at most one overlap between sibling tools.
  "image-to-video": ["ba", "bf", "compare", "film"], "url-to-video": ["ba", "beauty", "drink", "home"],
  "video-ads": ["bf", "creator", "launch", "outfit"], "product-videos": ["demo", "drink", "howto", "launch"],
  "unboxing-videos": ["creator", "demo", "film", "unbox"], "before-after-videos": ["ba", "compare", "home", "howto"],
  "spokesperson-videos": ["beauty", "outfit", "unbox"], "photo-hub": ["white", "size", "life", "model", "head", "angle", "pack"],
  "white-background": ["white", "color", "angle", "detail"], "lifestyle-photos": ["life", "bg", "pack", "ugc"], "model-photos": ["model", "tryon", "jewel", "look"],
  "change-background": ["white", "light", "bg", "life"], "social-ad-photos": ["feed", "white", "ugc", "sale"]
};
const OCCASION_SPREAD_KEYS = new Set(["sale", "bf", "story", "ugc"]);
const PLATFORM_SPREAD_KEYS = new Set(["creator", "demo", "unbox", "ba", "howto", "film", "beauty", "drink", "home", "outfit", "launch", "compare", "bf", "white", "life", "bg", "model", "feed", "angle", "detail", "pack", "tryon", "jewel", "look", "story", "sale", "ugc", "color", "light", "box", "size", "head"]);
const IND_TOOLS = {
  "beauty-skincare": ["video-ads", "lifestyle-photos", "white-background", "photo-hub"], "fashion-clothing": ["model-photos", "lifestyle-photos", "video-ads", "social-ad-photos"],
  shoes: ["white-background", "photo-hub", "video-ads"], "jewelry-accessories": ["model-photos", "photo-hub", "white-background"],
  electronics: ["product-videos", "unboxing-videos", "white-background", "video-ads"], "health-wellness": ["lifestyle-photos", "video-ads", "social-ad-photos"],
  "food-drinks": ["product-videos", "lifestyle-photos", "photo-hub"], "home-living": ["before-after-videos", "product-videos", "change-background", "lifestyle-photos"]
};
const PLAT_TOOLS = {
  tiktok: ["video-ads", "url-to-video", "unboxing-videos"], instagram: ["video-ads", "social-ad-photos", "model-photos"], facebook: ["social-ad-photos", "video-ads", "lifestyle-photos"],
  "youtube-shorts": ["product-videos", "unboxing-videos", "image-to-video"], amazon: ["white-background", "photo-hub", "lifestyle-photos"], shopify: ["photo-hub", "url-to-video", "product-videos"]
};
const HOME_FEATURED = ["creator", "white", "ba", "size", "beauty", "model", "unbox", "color"];

// The pages each guide or article is useful for, the page it is mostly about first. Every
// tool, template, industry, platform and occasion page shows the articles written for its
// topic (up to three), so each guide and post is reachable from the pages it helps with.
const ARTICLE_TOPICS = {
  "guide-product-photo-tips": ["photo-hub", "white-background", "lifestyle-photos", "change-background", "tpl-detail", "tpl-angle", "tpl-light", "tpl-size", "tpl-head", "image-to-video", "ind-shoes", "ind-electronics", "ind-home-living"],
  "guide-white-background-amazon": ["white-background", "plat-amazon", "change-background", "tpl-angle", "tpl-size", "tpl-color", "tpl-box", "plat-shopify", "ind-shoes", "ind-electronics", "ind-jewelry-accessories"],
  "guide-first-tiktok-video-ad": ["video-ads", "plat-tiktok", "url-to-video", "video-hub", "tpl-beauty", "tpl-drink", "tpl-outfit", "plat-youtube-shorts", "plat-instagram", "ind-health-wellness", "ind-food-drinks"],
  "guide-ad-sizes-by-platform": ["platforms", "social-ad-photos", "plat-tiktok", "plat-instagram", "plat-facebook", "plat-youtube-shorts", "plat-shopify", "plat-amazon", "tpl-story", "tpl-ugc", "video-hub", "occ-black-friday", "occ-sale-discount", "occ-holidays"],
  "guide-testing-ad-versions": ["video-ads", "social-ad-photos", "occ-black-friday", "occ-sale-discount", "plat-facebook", "tpl-bf", "tpl-sale", "tpl-launch", "url-to-video", "spokesperson-videos"],
  "blog-ai-product-photography-guide": ["photo-hub", "lifestyle-photos", "tpl-light", "tpl-pack", "tpl-color", "tpl-box", "ind-beauty-skincare", "ind-home-living", "ind-jewelry-accessories", "plat-amazon"],
  "blog-ai-ugc-video-ads-guide": ["video-ads", "spokesperson-videos", "tpl-ugc", "tpl-beauty", "tpl-outfit", "tpl-drink", "plat-tiktok", "plat-instagram", "ind-beauty-skincare", "ind-health-wellness", "url-to-video"],
  "blog-ai-video-review-checklist": ["video-hub", "image-to-video", "product-videos", "model-photos", "tpl-tryon", "tpl-jewel", "tpl-look", "tpl-compare", "tpl-howto", "ind-health-wellness", "plat-facebook"],
  "blog-unboxing-videos-for-launches": ["unboxing-videos", "occ-product-launch", "occ-holidays", "tpl-launch", "tpl-film", "tpl-pack", "tpl-bf", "ind-electronics", "ind-beauty-skincare", "plat-youtube-shorts"],
  "blog-model-photos-without-a-photoshoot": ["model-photos", "tpl-tryon", "tpl-jewel", "tpl-look", "tpl-outfit", "tpl-head", "ind-fashion-clothing", "ind-jewelry-accessories", "plat-instagram", "social-ad-photos"]
};
// Shown when a page has fewer than three articles written for its topic.
const FALLBACK_READING = {
  photo: ["guide-product-photo-tips", "blog-ai-product-photography-guide", "guide-white-background-amazon"],
  video: ["guide-first-tiktok-video-ad", "blog-ai-ugc-video-ads-guide", "guide-testing-ad-versions"],
  general: ["guide-product-photo-tips", "guide-first-tiktok-video-ad", "guide-ad-sizes-by-platform"]
};

// 301 map for retired v1 URLs. Shared with src/middleware.ts through this JSON file.
export const SITE_V2_REDIRECTS = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "lib", "aidreamcapes-site-v2-redirects.json"), "utf8"));

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
const img = (key) => `${ASSET_ROOT}/${key}.webp`;

// Short text for a card: the whole text if it fits, else its first sentence, else a cut at a
// word boundary. Never stops in the middle of a word.
function snippet(value, max = 140) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const sentence = clean.match(/^.*?[.!?](?=\s|$)/)?.[0];
  if (sentence && sentence.length <= max) return sentence;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(" ")).replace(/[,;:\s]+$/, "")}…`;
}

export function loadSiteV2Source() {
  const master = readJson(path.join(DATA_DIR, "master.json"));
  const images = readJson(path.join(DATA_DIR, "images.json"));
  const content = {};
  for (const page of master.pages) {
    const file = path.join(DATA_DIR, "content", `${page.id}.json`);
    assert.ok(fs.existsSync(file), `missing content for ${page.id}`);
    const value = readJson(file);
    for (const key of ["intro", "credits_explained"]) if (typeof value[key] === "string") value[key] = [value[key]];
    content[page.id] = value;
  }
  const media = {
    catalog: readJson(path.join(DATA_DIR, "media-catalog.json")),
    plan: readJson(path.join(DATA_DIR, "media-plan.json")),
    casePlan: readJson(path.join(DATA_DIR, "case-plan.json"))
  };
  const cardOverrides = readJson(path.join(DATA_DIR, "card-overrides.json"));
  return { master, images, content, media, cardOverrides };
}

function buildModel(source) {
  const { master, images, content, media, cardOverrides = {} } = source;
  const pages = master.pages.map((page) => ({ ...page, url: page.url === "/" ? "/" : page.url.replace(/\/+$/, "") }));
  const byId = Object.fromEntries(pages.map((page) => [page.id, page]));
  const ind = Object.fromEntries(master.industries.map(([slug, label]) => [slug, label]));
  const plat = Object.fromEntries(master.platforms.map(([slug, label]) => [slug, label]));
  const occ = Object.fromEntries(master.occasions.map(([slug, label]) => [slug, label]));
  const cards = [];
  for (const page of pages) {
    if (page.type !== "template") continue;
    const key = page.id.slice(4);
    cards.push({ key, pageId: page.id, name: page.label, kind: page.group, img: page.img, ind: page.industries, plat: page.platforms, occ: page.occasions, tool: page.made_with });
  }
  for (const [key, toolId, name, image, kind, industries, platforms, occasions] of master.toolcards) {
    cards.push({ key, pageId: toolId, name, kind, img: image, ind: industries, plat: platforms, occ: occasions, tool: toolId });
  }
  cards.sort((a, b) => CARD_ORDER.indexOf(a.key) - CARD_ORDER.indexOf(b.key));
  const cardByKey = Object.fromEntries(cards.map((card) => [card.key, card]));
  // Which pictures are already on the page being built, and how often each has been used on the
  // site so far. Cards use these to pick a picture that is not repeated (see cardRef).
  return { pages, byId, content, images, media, cardOverrides, cardOverrideErrors: [], cardOverrideCardKeys: new Map(), ind, plat, occ, cards, cardByKey, cardRefInfo: new WeakMap(), pageUse: new Set(), globalUse: new Map(), cardUse: new Map(), spreadUse: new Map(), spreadEnabled: true, currentPageId: "", currentPageIsTool: false, currentPageIsOccasion: false, currentPageIsPlatform: false, currentPageIsCollection: false, currentPageCardCount: 0 };
}

function imageRef(model, key, alt) {
  const meta = model.images[key];
  assert.ok(meta, `unknown image ${key}`);
  const catalogAlt = model.media.catalog.site?.[key]?.alt;
  return { src: img(key), alt: typeof catalogAlt === "string" && catalogAlt.trim() ? catalogAlt : alt, width: meta.w, height: meta.h };
}

// ---------------------------------------------------------------------------
// Media. Pages show the original high-resolution images and example clips already on the
// site (scripts/data/aidreamcapes-site-v2/media-catalog.json) plus a few newly generated
// images, chosen per page in media-plan.json. References look like
//   g:<gallery>/<file>  photo tool gallery image    u:<name>  creator scene image
//   f:<slug>            example frame from a clip   n:<name>  newly generated image
//   s:<key>             image in the site-v2 folder
const MEDIA_SIZES = { hero: "(max-width: 900px) 100vw, 560px", gallery: "(max-width: 700px) 100vw, 380px", card: "(max-width: 700px) 100vw, 340px", inset: "160px" };

function mediaSource(model, ref) {
  const { catalog } = model.media;
  const kind = ref.slice(0, 2);
  const rest = ref.slice(2);
  if (kind === "g:") {
    const [tool, file] = rest.split("/");
    const gallery = catalog.galleries[tool];
    const meta = gallery?.items[file];
    assert.ok(meta, `unknown gallery image ${ref}`);
    return { meta, alt: meta.alt, variants: gallery.variants, original: `${gallery.dir}/${file}.webp`, variantUrl: (w) => `${gallery.dir}/_responsive/${file}--${w}.webp` };
  }
  if (kind === "u:") {
    const group = catalog.ugc;
    const meta = group.items[rest];
    assert.ok(meta, `unknown creator scene ${ref}`);
    return { meta, alt: meta.alt, variants: group.variants, original: `${group.dir}/${meta.file}.webp`, variantUrl: (w) => `${group.dir}/_responsive/${meta.file}--${w}.webp` };
  }
  if (kind === "f:" || kind === "n:") {
    const clipFrame = kind === "f:" && catalog.clipFrames?.[rest];
    if (clipFrame) {
      const file = rest;
      return { meta: clipFrame, alt: clipFrame.alt, variants: clipFrame.variants ?? [], original: `${ASSET_ROOT}/clips/${file}--${clipFrame.w > clipFrame.h ? "1280" : "540"}.webp`, variantUrl: (w) => `${ASSET_ROOT}/clips/${file}--${w}.webp` };
    }
    const guideId = kind === "n:" && rest.startsWith("guide:") ? rest.slice("guide:".length) : "";
    const guideMeta = guideId ? catalog.guide?.items?.[guideId] : undefined;
    const isGuide = Boolean(guideMeta);
    const isGen2 = kind === "n:" && catalog.gen2?.[rest];
    const folder = kind === "f:" ? "frames" : isGuide ? "guide" : isGen2 ? "gen2" : "gen";
    const group = kind === "f:" ? catalog.frames : isGuide ? catalog.guide.items : isGen2 ? catalog.gen2 : catalog.gen;
    const meta = isGuide ? guideMeta : group[rest];
    assert.ok(meta, `unknown ${folder} image ${ref}`);
    const file = isGuide ? meta.file : isGen2 ? rest.replace(/:/g, "") : rest;
    return { meta, alt: meta.alt, variants: meta.variants ?? [], original: `${ASSET_ROOT}/${folder}/${file}.webp`, variantUrl: (w) => `${ASSET_ROOT}/${folder}/${file}--${w}.webp` };
  }
  assert.fail(`unknown media reference ${ref}`);
}

// One image as it is stored on the page: the file to load, its description, and the sizes
// available so the browser downloads only what the screen needs.
function mediaImage(model, ref, mode = "hero") {
  if (ref.startsWith("s:")) {
    const key = ref.slice(2);
    const meta = model.images[key];
    assert.ok(meta, `unknown image ${ref}`);
    return { src: img(key), alt: model.media.catalog.site[key].alt, width: meta.w, height: meta.h };
  }
  const { meta, alt, variants, original, variantUrl } = mediaSource(model, ref);
  if (ref.endsWith("/og")) return { src: original, alt, width: meta.w, height: meta.h };
  const widths = [...new Set([...variants.filter((w) => w < meta.w), meta.w])].sort((x, y) => x - y);
  const urlFor = (w) => (w === meta.w ? original : variantUrl(w));
  const closest = (list, target) => list.reduce((best, w) => (Math.abs(w - target) < Math.abs(best - target) ? w : best), list[0]);
  const range = { hero: [640, 1600], gallery: [640, 1280], card: [640, 640], inset: [640, 640], og: [1200, 1600] }[mode];
  let set = widths.filter((w) => w >= range[0] && w <= range[1]);
  if (!set.length) set = [closest(widths, range[0])];
  const srcWidth = mode === "hero" || mode === "og" ? closest(set, mode === "og" ? 1200 : 1280) : set[0];
  const out = { src: urlFor(srcWidth), alt, width: srcWidth, height: Math.round((srcWidth * meta.h) / meta.w) };
  if (set.length > 1) {
    out.srcSet = set.map((w) => `${urlFor(w)} ${w}w`).join(", ");
    out.sizes = MEDIA_SIZES[mode];
  }
  return out;
}

function clipRef(model, slug) {
  const clip = model.media.catalog.clips[slug];
  assert.ok(clip, `unknown clip ${slug}`);
  return { src: clip.src, width: clip.w, height: clip.h, duration: clip.duration, name: clip.name, description: clip.description, uploadDate: clip.uploadDate, poster: mediaImage(model, `f:${slug}`, "hero") };
}

function heroMediaFor(model, pageId) {
  const hero = model.media.plan.pages[pageId]?.hero;
  if (!hero) return undefined;
  if (hero.kind === "pair") return { kind: "pair", before: mediaImage(model, hero.before, "inset"), after: mediaImage(model, hero.after, "hero") };
  if (hero.kind === "image") return { kind: "image", image: mediaImage(model, hero.image, "hero") };
  if (hero.kind === "video") return { kind: "video", video: clipRef(model, hero.clip) };
  if (hero.kind === "loop") {
    const loop = model.media.catalog.loop;
    return { kind: "loop", video: { src: loop.src, width: loop.w, height: loop.h, poster: { src: loop.poster, alt: loop.alt, width: loop.w, height: loop.h } }, ...(hero.inset ? { inset: mediaImage(model, hero.inset, "inset") } : {}) };
  }
  assert.fail(`unknown hero kind for ${pageId}`);
}

function heroImageOf(media) {
  if (!media) return undefined;
  return media.kind === "pair" ? media.after : media.kind === "image" ? media.image : media.kind === "video" || media.kind === "loop" ? media.video.poster : undefined;
}

function galleryFor(model, pageId) {
  const refs = model.media.plan.pages[pageId]?.gallery ?? [];
  return refs.length ? { images: refs.map((ref) => mediaImage(model, ref, "gallery")) } : undefined;
}

// "Your photo" next to the result, for pages that show before and after examples.
function pairsFor(model, pageId) {
  const list = model.media.plan.pages[pageId]?.pairs ?? [];
  return list.length ? list.map((item) => ({ before: mediaImage(model, item.before, "inset"), after: mediaImage(model, item.after, "gallery") })) : undefined;
}

// Thumbnail for lists of pages and templates.
function pageCardImage(model, pageId) {
  const plan = model.media.plan.pages[pageId];
  if (plan?.card) return mediaImage(model, plan.card, "card");
  const hero = plan?.hero;
  const ref = hero?.image ?? hero?.after ?? (hero?.clip ? `f:${hero.clip}` : undefined);
  assert.ok(ref, `no card image for ${pageId}`);
  return mediaImage(model, ref, "card");
}

// ---------------------------------------------------------------------------
// Picture variety. A template card has one curated picture and, where its gallery or the media
// plan offers them, other examples of the same template. The curated picture is used on the main
// lists (templates, home, hubs); everywhere else a card shows the example used least so far, and
// never one that is already on the page. A card with no unused picture is left out of that list.
export const imageBase = (src) => String(src).replace(/\/_responsive\//, "/").replace(/--\d+(?=\.\w+$)/, "").replace(/\.\w+$/, "");

function cardChoices(model, key) {
  const primary = model.media.plan.cards[key];
  if (!primary) return [];
  const planned = model.media.plan.cardAlts?.[key] ?? [];
  const items = primary.startsWith("g:") ? model.media.catalog.galleries[primary.slice(2).split("/")[0]]?.items ?? {} : {};
  const tool = primary.startsWith("g:") ? primary.slice(2).split("/")[0] : "";
  const fromGallery = Object.entries(items).filter(([file, meta]) => /^(hero-output|example-\d+)$/.test(file) && meta.w >= meta.h).map(([file]) => `g:${tool}/${file}`);
  return [...new Set([primary, ...planned, ...fromGallery])];
}

function cardRef(model, key, role = "alt", force = false) {
  const card = model.cardByKey[key];
  assert.ok(card, `unknown card ${key}`);
  const reserveForUrl = model.spreadEnabled && !model.currentPageIsTool && model.currentPageId !== "url-to-video" && TOOL_REL["url-to-video"].includes(key);
  const reserveForOccasion = model.spreadEnabled && !model.currentPageIsTool && !model.currentPageIsOccasion && OCCASION_SPREAD_KEYS.has(key);
  const reserveForPlatform = model.spreadEnabled && !model.currentPageIsTool && !model.currentPageIsPlatform && !model.currentPageIsOccasion && PLATFORM_SPREAD_KEYS.has(key);
  const reserveForBlackFriday = model.spreadEnabled && !["occ-sale-discount", "occ-black-friday", "occ-holidays"].includes(model.currentPageId) && OCCASION_SPREAD_KEYS.has(key);
  const reserveForHoliday = model.spreadEnabled && model.currentPageId !== "occ-holidays" && OCCASION_SPREAD_KEYS.has(key);
  const limit = reserveForBlackFriday || reserveForOccasion ? 4 : reserveForHoliday ? 5 : reserveForUrl || reserveForPlatform ? 5 : 6;
  const preserveMinimum = model.currentPageIsCollection && model.currentPageCardCount < 3 && (model.spreadUse.get(key) ?? 0) < 6 && !reserveForUrl && !reserveForOccasion && !reserveForBlackFriday && !reserveForHoliday && (!reserveForPlatform || model.currentPageIsPlatform);
  if (!force && model.spreadEnabled && (model.spreadUse.get(key) ?? 0) >= limit && !preserveMinimum) return null;
  const choices = cardChoices(model, key);
  let ref = choices[0];
  if (role === "alt" && choices.length > 1) {
    const others = choices.slice(1);
    const free = others.filter((candidate) => !model.pageUse.has(candidate));
    const pool = free.length ? free : others;
    ref = [...pool].sort((a, b) => (model.globalUse.get(a) ?? 0) - (model.globalUse.get(b) ?? 0) || choices.indexOf(a) - choices.indexOf(b))[0];
  }
  if (ref && model.pageUse.has(ref)) return null;
  if (ref) { model.pageUse.add(ref); model.globalUse.set(ref, (model.globalUse.get(ref) ?? 0) + 1); }
  model.cardUse.set(key, (model.cardUse.get(key) ?? 0) + 1);
  if (model.spreadEnabled) model.spreadUse.set(key, (model.spreadUse.get(key) ?? 0) + 1);
  model.currentPageCardCount += 1;
  const result = {
    key, name: card.name, line: LINES[key], kind: card.kind, href: model.byId[card.pageId].url,
    image: ref ? mediaImage(model, ref, "card") : imageRef(model, card.img, `${card.name} template preview`),
    tags: [...card.ind.map((slug) => model.ind[slug]), ...card.plat.map((slug) => model.plat[slug])],
    industries: card.ind, platforms: card.plat
  };
  model.cardRefInfo.set(result, { key, ref });
  return result;
}

// How much its freshest available picture has been used so far; cards whose pictures are all
// worn out come last, so lists lean on cards that can still show something new.
function pictureUse(model, key, role) {
  const choices = cardChoices(model, key);
  const pool = role === "alt" && choices.length > 1 ? choices.slice(1) : choices;
  const free = pool.filter((candidate) => !model.pageUse.has(candidate));
  return free.length ? Math.min(...free.map((candidate) => model.globalUse.get(candidate) ?? 0)) : Infinity;
}

// Up to `count` of the given cards. Spread card usage first, then use a fresh
// picture, so a popular card does not keep winning every related list.
function pickCards(model, keys, count, role = "alt") {
  const usage = (key) => model.spreadEnabled ? (model.spreadUse.get(key) ?? 0) : (model.cardUse.get(key) ?? 0);
  const ranked = [...keys].sort((a, b) => usage(a) - usage(b) || pictureUse(model, a, role) - pictureUse(model, b, role) || CARD_ORDER.indexOf(a) - CARD_ORDER.indexOf(b));
  const chosen = [];
  for (const key of ranked) {
    if (chosen.length >= count) break;
    const card = cardRef(model, key, role);
    if (card) chosen.push(card);
  }
  return chosen.sort((a, b) => CARD_ORDER.indexOf(a.key) - CARD_ORDER.indexOf(b.key));
}

// A collection starts with cards tagged for its topic. If that set is too small,
// add cards made with one of the tools promoted on the page; those are still
// useful examples without inventing a topic match.
function collectionCardKeys(model, field, slug, tools) {
  const direct = model.cards.filter((card) => card[field].includes(slug)).map((card) => card.key);
  const byTool = model.cards.filter((card) => tools.includes(card.tool)).map((card) => card.key);
  // Seasonal pages can also use a general product demo or cinematic clip when
  // their tagged sale cards are already used elsewhere on the site.
  const occasionFallback = field === "occ" ? ["demo", "film", "howto", "compare"] : [];
  return [...new Set([...direct, ...byTool, ...occasionFallback])];
}

function pickRelatedCards(model, direct, fallback, count) {
  const chosen = pickCards(model, direct, count);
  if (chosen.length >= count) return chosen;
  const used = new Set(chosen.map((card) => card.key));
  return [...chosen, ...pickCards(model, fallback.filter((key) => !used.has(key)), count - chosen.length)];
}

function adjustUseCount(map, key, amount) {
  if (!key) return;
  const next = (map.get(key) ?? 0) + amount;
  if (next > 0) map.set(key, next);
  else map.delete(key);
}

function releaseCardRef(model, card) {
  const info = model.cardRefInfo.get(card);
  if (!info) return;
  if (info.ref) {
    model.pageUse.delete(info.ref);
    adjustUseCount(model.globalUse, info.ref, -1);
  }
  adjustUseCount(model.cardUse, info.key, -1);
  if (model.spreadEnabled) adjustUseCount(model.spreadUse, info.key, -1);
  model.currentPageCardCount = Math.max(0, model.currentPageCardCount - 1);
  model.cardRefInfo.delete(card);
}

function knownMediaRef(model, ref) {
  if (typeof ref !== "string" || !ref) return false;
  if (ref.startsWith("s:")) return Boolean(model.images[ref.slice(2)] && model.media.catalog.site?.[ref.slice(2)]);
  try { mediaSource(model, ref); return true; } catch { return false; }
}

// Overrides are applied only after a page's rendered template card lists have been selected.
// Some pages render templates in more than one list (for example, a collection collage and its
// template area), so keep the union of the actual source and resulting card keys for validation.
function applyCardOverrides(model, page, cards) {
  const override = model.cardOverrides?.[page.id];
  if (!override || !Array.isArray(cards)) return cards;
  const result = [...cards];
  const cardKeys = model.cardOverrideCardKeys.get(page.id) ?? { source: new Set(), rendered: new Set() };
  for (const card of result) cardKeys.source.add(card.key);
  const swaps = override.swap && typeof override.swap === "object" && !Array.isArray(override.swap) ? override.swap : {};
  for (let index = 0; index < result.length; index += 1) {
    const original = result[index];
    const target = swaps[original.key];
    if (typeof target !== "string" || target === original.key || !model.cardByKey[target]) continue;
    releaseCardRef(model, original);
    const replacement = cardRef(model, target, "alt", true);
    if (replacement) result[index] = replacement;
    else model.cardOverrideErrors.push(`${page.id}: card swap ${original.key} -> ${target} could not be rendered`);
  }
  const images = override.images && typeof override.images === "object" && !Array.isArray(override.images) ? override.images : {};
  for (const card of result) {
    const imageOverride = images[card.key];
    if (!imageOverride || typeof imageOverride !== "object" || !knownMediaRef(model, imageOverride.ref) || typeof imageOverride.alt !== "string") continue;
    const info = model.cardRefInfo.get(card) ?? { key: card.key, ref: undefined };
    const nextImage = mediaImage(model, imageOverride.ref, "card");
    const nextImageBase = imageBase(nextImage.src);
    const alreadyVisible = [...model.pageUse].some((ref) => ref !== info.ref && knownMediaRef(model, ref) && imageBase(mediaImage(model, ref, "card").src) === nextImageBase);
    const repeatedCard = result.some((other) => other !== card && other.image?.src && imageBase(other.image.src) === nextImageBase);
    if (alreadyVisible || repeatedCard) model.cardOverrideErrors.push(`${page.id}: image override repeats media on the same page (${imageOverride.ref})`);
    if (info.ref) {
      model.pageUse.delete(info.ref);
      adjustUseCount(model.globalUse, info.ref, -1);
    }
    card.image = { ...nextImage, alt: imageOverride.alt };
    model.pageUse.add(imageOverride.ref);
    adjustUseCount(model.globalUse, imageOverride.ref, 1);
    model.cardRefInfo.set(card, { ...info, ref: imageOverride.ref });
  }
  for (const card of result) cardKeys.rendered.add(card.key);
  model.cardOverrideCardKeys.set(page.id, cardKeys);
  return result;
}

function finalizeCardOverrides(model) {
  for (const [pageId, override] of Object.entries(model.cardOverrides ?? {})) {
    const keys = model.cardOverrideCardKeys.get(pageId) ?? { source: new Set(), rendered: new Set() };
    for (const from of Object.keys(override?.swap ?? {})) {
      if (!keys.source.has(from)) model.cardOverrideErrors.push(`${pageId}: card swap source ${from} is not in rendered template cards`);
    }
    for (const key of Object.keys(override?.images ?? {})) {
      if (!keys.rendered.has(key)) model.cardOverrideErrors.push(`${pageId}: image override card ${key} is not in rendered template cards`);
    }
  }
}

const CASE_PAGE_TYPES = new Set(["hub-tool", "tool", "template", "industry", "platform", "occasion"]);
const EXAMPLE_PAGE_TYPES = new Set(["home", "hub", "hub-tool", "tool", "template", "industry", "platform", "occasion", "examples"]);

function firstVideoSize(value) {
  if (typeof value !== "string") return undefined;
  return value.match(/9:16|1:1|16:9|4:3|3:4/)?.[0];
}

function displayedVideoSize(model, page, templateKey) {
  const templatePage = templateKey && model.pages.find((candidate) => candidate.type === "template" && candidate.id.slice(4) === templateKey);
  const sourcePage = templatePage ?? page;
  const content = model.content[sourcePage.id];
  const sizeOption = content?.maker?.options?.find(([label]) => String(label).toLowerCase() === "size");
  return firstVideoSize(sizeOption?.[1]) ?? firstVideoSize(sourcePage.output);
}

function videoSizeForDimensions(width, height) {
  const ratio = Number(width) / Number(height);
  if (!Number.isFinite(ratio) || ratio <= 0) return undefined;
  const choices = VIDEO_SIZES.map((size) => {
    const [w, h] = size.split(":").map(Number);
    return { size, ratio: w / h };
  });
  const closest = choices.reduce((best, candidate) => Math.abs(candidate.ratio - ratio) < Math.abs(best.ratio - ratio) ? candidate : best);
  return Math.abs(closest.ratio - ratio) <= 0.02 ? closest.size : undefined;
}

function recommendedVideoTool(model, page) {
  const slug = page.id.split("-").slice(1).join("-");
  const candidates = page.type === "industry" ? IND_TOOLS[slug]
    : page.type === "platform" ? PLAT_TOOLS[slug]
      : page.type === "occasion" ? OCCASION_TOOLS : [];
  const id = candidates?.find((candidate) => model.byId[candidate]?.group === "video");
  return model.byId[id ?? "video-ads"];
}

function recommendedPhotoTool(model, page) {
  const slug = page.id.split("-").slice(1).join("-");
  const candidates = page.type === "industry" ? IND_TOOLS[slug]
    : page.type === "platform" ? PLAT_TOOLS[slug]
      : page.type === "occasion" ? OCCASION_TOOLS : [];
  const id = candidates?.find((candidate) => model.byId[candidate]?.group === "photo");
  return model.byId[id ?? "lifestyle-photos"];
}

function displayedMakerVideoSize(model, page) {
  if (page.type === "tool" && page.group === "video") return displayedVideoSize(model, page);
  if (page.type === "template" && page.group === "video") return displayedVideoSize(model, page, page.id.slice(4));
  const optionSize = firstVideoSize(model.content[page.id]?.maker?.options?.find(([label]) => String(label).toLowerCase() === "size")?.[1]);
  if (optionSize) return optionSize;
  if (page.id === "home" || page.id === "video-hub") return "9:16";
  if (page.type === "platform" && ["tiktok", "youtube-shorts", "instagram"].includes(page.id.slice("plat-".length))) return "9:16";
  return undefined;
}

function caseTarget(model, page, entry, source, isClip, promptOverride) {
  const isVideoExample = isClip || entry.kind === "scene" || (!entry.kind && page.group === "video");
  if (!isVideoExample) {
    const promptOptions = promptOverride === undefined ? undefined : { promptOverride };
    if (page.id === "home") return toolAppHref(model, model.byId["white-background"], "white", promptOptions);
    if (page.id === "photo-hub") return toolAppHref(model, page, TOOL_REL[page.id]?.[0], promptOptions);
    if (page.type === "tool" && page.group === "photo") return toolAppHref(model, page, undefined, promptOptions ?? { prompt: DEFAULT_PHOTO_PROMPT });
    if (page.type === "template" && page.group === "photo") return toolAppHref(model, model.byId[page.made_with], page.id.slice(4), promptOptions);
    if (page.type === "industry" || page.type === "platform" || page.type === "occasion") {
      return toolAppHref(model, recommendedPhotoTool(model, page), undefined, promptOptions ?? { prompt: DEFAULT_PHOTO_PROMPT });
    }
    return toolAppHref(model, model.byId["lifestyle-photos"], undefined, promptOptions ?? { prompt: DEFAULT_PHOTO_PROMPT });
  }

  const isVideoToolPage = (page.type === "tool" || page.type === "hub-tool") && page.group === "video";
  const isVideoTemplatePage = page.type === "template" && page.group === "video";
  const tool = isVideoToolPage ? page : isVideoTemplatePage ? model.byId[page.made_with] : recommendedVideoTool(model, page);
  const templateKey = isVideoTemplatePage ? page.id.slice(4) : undefined;
  const size = isClip ? videoSizeForDimensions(source.width, source.height) : displayedMakerVideoSize(model, page);
  return toolAppHref(model, tool, templateKey, { size, explicitSize: true, ...(promptOverride === undefined ? {} : { promptOverride }) });
}

const CASE_RATIOS = [["1:1", 1], ["4:5", 4 / 5], ["3:4", 3 / 4], ["4:3", 4 / 3], ["3:2", 3 / 2], ["16:9", 16 / 9], ["9:16", 9 / 16]];
function closestRatio(width, height) {
  const value = Number(width) / Number(height);
  return CASE_RATIOS.reduce((best, item) => Math.abs(item[1] - value) < Math.abs(best[1] - value) ? item : best, CASE_RATIOS[0])[0];
}

function caseCardFor(model, page, entry, index) {
  const ref = entry.ref;
  const isClip = entry.kind ? entry.kind === "clip" : Boolean(model.media.catalog.clips?.[ref]);
  const source = isClip ? clipRef(model, ref) : mediaImage(model, ref, "card");
  const isVideoExample = isClip || entry.kind === "scene" || (!entry.kind && page.group === "video");
  const kind = isClip ? "video" : "photo";
  const ratio = closestRatio(source.width, source.height);
  const spec = isClip ? `Video · ${ratio}` : "Photo";
  return {
    key: `case-${page.id}-${index + 1}`, cardType: "case", name: entry.title, product: entry.product, mediaRef: ref, line: spec, spec, kind,
    href: caseTarget(model, page, entry, source, isClip), label: isClip ? "Example clip" : isVideoExample ? "Example scene" : "Example photo",
    image: isClip ? source.poster : source, ...(isClip ? { video: source } : {}), tags: [], industries: [], platforms: []
  };
}

function exampleGalleryFor(model, page) {
  if (!EXAMPLE_PAGE_TYPES.has(page.type)) return undefined;
  const source = model.content[page.id]?.examples;
  if (source == null) return undefined;
  assert.ok(source && typeof source === "object" && !Array.isArray(source), `${page.id}: examples must be an object`);
  assert.ok(typeof source.h2 === "string" && source.h2.trim(), `${page.id}: examples.h2 is required`);
  assert.ok(source.lead == null || typeof source.lead === "string", `${page.id}: examples.lead must be a string`);
  assert.ok(Array.isArray(source.groups), `${page.id}: examples.groups must be an array`);
  const groups = source.groups.map((group, groupIndex) => {
    assert.ok(group && typeof group === "object" && typeof group.label === "string" && group.label.trim(), `${page.id}: malformed examples group ${groupIndex + 1}`);
    assert.ok(Array.isArray(group.items), `${page.id}: examples group ${groupIndex + 1} items must be an array`);
    return {
      label: group.label,
      items: group.items.map((entry, itemIndex) => {
        assert.ok(entry && typeof entry === "object" && typeof entry.ref === "string" && typeof entry.title === "string" && typeof entry.product === "string", `${page.id}: malformed example ${groupIndex + 1}.${itemIndex + 1}`);
        assert.ok(["clip", "scene", "photo"].includes(entry.kind), `${page.id}: invalid example kind ${entry.kind}`);
        const card = caseCardFor(model, page, entry, `${groupIndex + 1}-${itemIndex + 1}`);
        const kind = entry.kind;
        return {
          key: `example-${page.id}-${groupIndex + 1}-${itemIndex + 1}`,
          title: entry.title,
          product: entry.product,
          kind,
          label: `Example ${kind}`,
          href: card.href,
          mediaRef: entry.ref,
          image: card.image,
          ...(kind === "clip" ? { video: card.video, spec: card.spec } : { spec: "Photo" })
        };
      })
    };
  }).filter((group) => group.items.length);
  return groups.length ? { h2: source.h2, ...(source.lead ? { lead: source.lead } : {}), groups } : undefined;
}

function caseCardsFor(model, page, baseCards = []) {
  if (!CASE_PAGE_TYPES.has(page.type)) return [];
  const need = Math.max(0, 7 - baseCards.length);
  const entries = model.media.casePlan?.pages?.[page.id];
  assert.ok(Array.isArray(entries), `${page.id}: case-plan entry is required`);
  assert.equal(entries.length, need, `${page.id}: case-plan has ${entries.length} cases; expected ${need}`);
  const pageBases = new Set();
  for (const card of baseCards) if (card?.image?.src) pageBases.add(imageBase(card.image.src));
  for (const ref of plannedRefs(model, page.id)) {
    try { pageBases.add(imageBase(mediaImage(model, ref, "card").src)); } catch { /* media may be generated later */ }
  }
  return entries.map((entry, index) => {
    assert.ok(entry && typeof entry.ref === "string" && typeof entry.product === "string" && typeof entry.title === "string", `${page.id}: malformed case-plan row ${index + 1}`);
    assert.ok(entry.ref !== "social-proof-animation", `${page.id}: retired social-proof-animation cannot be a case`);
    const card = caseCardFor(model, page, entry, index);
    const base = imageBase(card.image.src);
    assert.ok(!pageBases.has(base), `${page.id}: case media repeats a visible page image (${entry.ref})`);
    pageBases.add(base);
    return card;
  });
}

// The pictures a page's own plan puts on it (main picture, gallery, before and after pairs), so cards never repeat them.
function plannedRefs(model, pageId) {
  const plan = model.media.plan.pages[pageId] ?? {};
  const hero = plan.hero ?? {};
  const refs = [];
  if (hero.kind === "pair") refs.push(hero.before, hero.after);
  else if (hero.kind === "image") refs.push(hero.image);
  else if (hero.kind === "video") refs.push(`f:${hero.clip}`);
  else if (hero.kind === "loop") refs.push(hero.inset, ...(hero.clips ?? ["ugc-ad-video"]).map((clip) => `f:${clip}`));
  refs.push(...(plan.gallery ?? []), ...(plan.pairs ?? []).flatMap((pair) => [pair.before, pair.after]));
  const flows = pageId === "home" ? model.content.home?.example_flows : pageId === "examples" ? model.content.examples?.cases : [];
  for (const item of flows ?? []) {
    const flow = EXAMPLE_FLOWS[item.id];
    if (flow) refs.push(...flow[1].map(([, file]) => (flow[0] ? `g:${flow[0]}/${file}` : file)));
  }
  return refs.filter(Boolean);
}

// A tool link. Tools shown in lists on many pages leave the picture out (a small icon shows instead),
// so the same few thumbnails are not repeated across the site.
function toolPicture(model, id) {
  const ref = model.media.plan.toolImages?.[id];
  return ref ? mediaImage(model, ref, "inset") : imageRef(model, model.byId[id].img, "");
}
function toolRef(model, id, withImage = true, imageOverride) {
  const page = model.byId[id];
  if (!withImage) return { id, group: page.group, label: page.label, description: TOOL_DESC[id] ?? "", href: page.url };
  const image = imageOverride?.ref ? mediaImage(model, imageOverride.ref, "inset") : toolPicture(model, id);
  return { id, group: page.group, label: page.label, description: TOOL_DESC[id] ?? "", href: page.url, image: { ...image, alt: imageOverride?.alt ?? "" } };
}
function appHref(params, video) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  return `/app/create?${query.toString()}${video ? "#step-video" : ""}`;
}
function toolAppHref(model, page, templateKey, options = {}) {
  if (!page) return "/app/create";
  if (page.group === "video") {
    const size = options.explicitSize ? (VIDEO_SIZES.includes(options.size) ? options.size : undefined) : displayedVideoSize(model, page, templateKey);
    const prompt = options.promptOverride ?? (templateKey ? (TEMPLATE_PROMPTS[templateKey] ?? "") : (options.prompt ?? ""));
    return appHref({ tool: page.id, template: templateKey, size, length: options.length ?? "15", prompt }, true);
  }
  const prompt = options.promptOverride ?? (templateKey ? (TEMPLATE_PROMPTS[templateKey] ?? "") : (options.prompt ?? DEFAULT_PHOTO_PROMPT));
  return appHref({ tool_id: "image_generator", tool: page.id, template: templateKey, prompt }, false);
}
function canonical(page) { return `${BASE}${page.url === "/" ? "/" : page.url}`; }
function breadcrumbTrail(model, page) {
  const trail = [{ label: "Home", href: "/" }];
  if ((page.type === "tool" || page.type === "hub-tool") && page.group === "video") trail.push({ label: "AI Video", href: "/ai-video-generation" });
  if (page.type === "tool" && page.group === "photo") trail.push({ label: "Product Photos", href: "/ai-image-generation" });
  if (page.type === "template" || page.type === "occasion") trail.push({ label: "Templates", href: "/templates" });
  if (page.type === "industry") trail.push({ label: "Industries", href: "/industries" });
  if (page.type === "platform") trail.push({ label: "Platforms", href: "/platforms" });
  if (page.type === "article") trail.push({ label: model.byId[page.section].label, href: model.byId[page.section].url });
  if (page.id !== "home") trail.push({ label: page.label, href: page.url });
  return trail;
}

// Credits each job uses in the workspace (standard-quality video; site_aidreamcapes has no custom pricing):
// a photo or a 6-second video is 24, and longer videos scale with their length.
const JOB_CREDITS = { photo: 24, video6: 24, video10: 40, video15: 60, video30: 120 };
const planEstimate = (credits) => `About ${Math.floor(Number(credits) / JOB_CREDITS.photo)} product photos or ${Math.floor(Number(credits) / JOB_CREDITS.video15)} fifteen-second videos a month`;
const PLANS_BASE = [
  { name: "Starter", price: "$24.50", credits: "200", who: "For trying video ads and product photos.", features: ["Videos and photos", "All templates", "9:16, 1:1 and 16:9 video sizes", "No watermark"], popular: false },
  { name: "Pro", price: "$35", credits: "300", who: "For stores testing new ads every week.", features: ["Everything in Starter", "100 more credits than Starter", "Room for weekly ad testing"], popular: true },
  { name: "Premium", price: "$63", credits: "600", who: "For brands and agencies with many products.", features: ["Everything in Pro", "Twice the credits of Pro", "Most room for new products"], popular: false }
];

const PLANS = PLANS_BASE.map((plan) => ({ ...plan, features: [planEstimate(plan.credits), ...plan.features] }));
// The tools every occasion page recommends; those tool pages link back to the occasions.
const OCCASION_TOOLS = ["video-ads", "social-ad-photos", "unboxing-videos"];
const OCCASION_IDS = ["occ-product-launch", "occ-sale-discount", "occ-black-friday", "occ-holidays"];
const JOB_COST_ROWS = [
  ["Product photo", `${JOB_CREDITS.photo} credits`],
  ["Video, 6 seconds", `${JOB_CREDITS.video6} credits`],
  ["Video, 10 seconds", `${JOB_CREDITS.video10} credits`],
  ["Video, 15 seconds", `${JOB_CREDITS.video15} credits`],
  ["Video, 30 seconds", `${JOB_CREDITS.video30} credits`]
];

const VISUAL_VIDEO_LENGTHS = [6, 10, 15];
const HOME_VIDEO_OPTIONS = [["Size", "9:16 · TikTok & Reels"], ["Length", "15 seconds"], ["Template", "Creator video ad"]];
const HOME_PHOTO_OPTIONS = [["Template", "White background"], ["Size", "Square"]];

function visualLength(options, requested, pageId) {
  const configured = options.find(([label]) => String(label).toLowerCase() === "length")?.[1];
  const raw = requested ?? configured;
  const length = Number(String(raw ?? "15").match(/\d+/)?.[0] ?? 15);
  assert.ok(VISUAL_VIDEO_LENGTHS.includes(length), `${pageId}: visual video length must be 6, 10, or 15 seconds`);
  return length;
}

function visualImage(model, ref, kind) {
  assert.ok(typeof ref === "string" && ref.trim(), "visual media ref is required");
  const image = mediaImage(model, ref, "card");
  return { src: image.src, w: image.width, h: image.height, alt: image.alt, kind: kind ?? (ref.startsWith("f:") ? "video" : "photo") };
}

function visualFor(model, page, source, maker, group, buttonHref, content) {
  if (source == null) return undefined;
  assert.ok(source && typeof source === "object" && !Array.isArray(source), `${page.id}: visual must be an object`);
  const video = group === "video";
  const steps = source.steps && typeof source.steps === "object" ? source.steps : {};
  const stepMode = steps.mode ?? (video ? "video" : "photo");
  assert.ok(stepMode === "photo" || stepMode === "video", `${page.id}: visual step mode must be photo or video`);
  const configuredOptions = Array.isArray(maker?.options) ? maker.options.slice(0, 3) : [];
  const options = Array.isArray(steps.options) ? steps.options : (stepMode === "video" ? maker?.videoOptions : maker?.photoOptions) ?? configuredOptions;
  const stepLength = stepMode === "video" ? visualLength(options, steps.length, page.id) : undefined;
  const stepCredits = stepMode === "video" ? JOB_CREDITS[`video${stepLength}`] : JOB_CREDITS.photo;
  const pickerSource = source.picker && typeof source.picker === "object" ? source.picker : {};
  const picker = Array.isArray(pickerSource) ? {} : pickerSource;
  const pickerCards = Array.isArray(picker.cards) ? picker.cards : [];
  const chips = Array.isArray(pickerSource) ? pickerSource : Array.isArray(picker.chips) ? picker.chips : [];
  const overviewRows = Array.isArray(content.overview) ? content.overview : [];
  const overviewValue = overviewRows[0];
  const overview = typeof source.overview === "string" ? source.overview : typeof overviewValue === "string" ? overviewValue : overviewValue?.d ?? overviewValue?.p ?? content.intro?.[0] ?? "";
  const limits = content.limitations?.items ?? [];
  const visual = {
    strip: (Array.isArray(source.strip) ? source.strip : []).map((ref) => visualImage(model, ref)),
    ...(steps.source && steps.result ? { steps: {
      source: { ...visualImage(model, steps.source, "photo"), ...(steps.sourceAlt ? { alt: String(steps.sourceAlt) } : {}) },
      ...(steps.sourceTitle ? { sourceTitle: String(steps.sourceTitle) } : {}),
      ...(steps.sourceHint ? { sourceHint: String(steps.sourceHint) } : {}),
      result: visualImage(model, steps.result, stepMode === "video" ? "video" : "photo"),
      options,
      credits: `${stepCredits} credits`,
      ...(steps.prompt ? { prompt: String(steps.prompt) } : {}),
      mode: stepMode,
      items: Array.isArray(content.steps) ? content.steps.map((item) => ({ t: item.t ?? "", d: item.d ?? "" })) : []
    } } : {}),
    picker: {
      title: picker.title ?? source.titles?.m3?.h2 ?? "",
      ...(picker.lead ? { lead: picker.lead } : {}),
      chips: chips.map((chip) => ({ id: String(chip.id ?? ""), label: String(chip.label ?? "") })),
      cards: pickerCards.map((card) => {
        const cardKind = card.kind;
        assert.ok(cardKind === "photo" || cardKind === "video", `${page.id}: visual picker card kind must be photo or video`);
        const image = visualImage(model, card.ref, cardKind);
        const target = card.tool ? model.byId[card.tool] : undefined;
        assert.ok(!card.tool || target, `${page.id}: visual picker tool ${card.tool} does not exist`);
        const entry = { kind: cardKind === "video" ? "scene" : "photo" };
        const href = target?.url ?? caseTarget(model, page, entry, { width: image.w, height: image.h }, cardKind === "video", card.prompt);
        return { image, label: card.label ?? "", chips: Array.isArray(card.chips) ? card.chips.map(String) : [], href, prompt: String(card.prompt ?? ""), kind: cardKind, ...(card.tool ? { tool: card.tool } : {}) };
      }),
      button: picker.button ?? "",
      href: buttonHref
    },
    uses: (Array.isArray(source.uses) ? source.uses : []).map((item) => ({
      frame: item.frame,
      image: visualImage(model, item.ref, video ? "video" : "photo"),
      ...(item.frame === "split" ? { imageB: visualImage(model, item.ref_b, video ? "video" : "photo") } : {}),
      h: item.h ?? "", d: item.d ?? ""
    })),
    input: (Array.isArray(source.input) ? source.input : []).map((item) => ({
      good: visualImage(model, item.good, "photo"),
      bad: { ...visualImage(model, item.bad, "photo"), ...(item.bad_alt ? { alt: String(item.bad_alt) } : {}) },
      good_label: item.good_label ?? "", bad_label: item.bad_label ?? "",
      ...(item.darkened ? { darkened: true } : {})
    })),
    outputs: (Array.isArray(source.outputs) ? source.outputs : []).map((item) => {
      const outputVideo = page.id === "home" ? item.length != null : video;
      const length = outputVideo ? visualLength(options, item.length, page.id) : undefined;
      assert.ok(["1:1", "9:16", "16:9", "4:5"].includes(item.frame), `${page.id}: visual output frame is unsupported`);
      const credits = outputVideo ? JOB_CREDITS[`video${length}`] : JOB_CREDITS.photo;
      const format = outputVideo ? `${item.frame} video` : item.frame === "1:1" ? "Square photo" : `${item.frame} photo`;
      return {
        image: visualImage(model, item.ref, video ? "video" : "photo"), frame: item.frame, label: item.label ?? "",
        ...(length ? { length } : {}), spec: `${format}${length ? ` · ${length} s` : ""} · ${credits} credits`
      };
    }),
    ...(source.after ? { after: {
      image: visualImage(model, source.after.ref, video ? "video" : "photo"),
      zones: Array.isArray(source.after.zones) ? source.after.zones.map(String) : [],
      items: Array.isArray(source.after.items) ? source.after.items.map(String) : []
    } } : {}),
    ...(Array.isArray(source.sizes) ? { sizes: source.sizes.map((item) => ({
      frame: item.frame, image: visualImage(model, item.ref), label: item.label ?? ""
    })) } : {}),
    limitations: {
      h2: content.limitations?.h2 ?? "Before you publish",
      items: limits.map((item) => {
        const label = typeof item === "string" ? item : item?.t ?? item?.d ?? "";
        const sourceText = `${label} ${item?.status ?? item?.kind ?? ""}`;
        const negative = /\b(can't|cannot|does not|doesn't|won't|not prove|not confirm)\b/i.test(sourceText);
        const supported = item?.supported === false ? false : item?.supported === true || item?.status === "can" || (!negative && /\b(can|shows|show|makes|helps|lets)\b/i.test(sourceText));
        return { label, supported, ...(item?.d ? { detail: String(item.d) } : {}) };
      })
    },
    ...(source.titles ? { titles: source.titles } : {}),
    ...(overview ? { overview: String(overview) } : {})
  };
  return visual;
}

function templateLinksFor(model, group, count) {
  return model.pages
    .filter((page) => page.type === "template" && page.group === group)
    .slice(0, count)
    .map((page) => ({ label: page.label, href: page.url }));
}

function pageLinksFor(model, ids) {
  return ids.map((id) => {
    const page = model.byId[id];
    assert.ok(page, `missing related page ${id}`);
    return { label: page.label, href: page.url };
  });
}

function templateFilterTags(card, chips, groups) {
  return chips.filter((chip) => {
    if (chip.id === card.kind) return true;
    const group = groups[chip.id] ?? {};
    return (group.industries ?? []).some((id) => card.industries.includes(id)) ||
      (group.platforms ?? []).some((id) => card.platforms.includes(id));
  }).map((chip) => chip.id);
}

// One line under every start button, so the price and what happens to credits are clear before a visitor signs up.
const START_NOTE_TEXT = (lead) => `${lead}. You see the credit cost before every job, and if a job fails its credits go back to your balance.`;
const START_NOTE = START_NOTE_TEXT(`[Plans from ${PLANS[0].price} a month](/pricing)`);
const START_NOTE_PLAIN = START_NOTE_TEXT(`Plans from ${PLANS[0].price} a month`);

// The closing banner of each list page.
const INDEX_CTA = {
  templates: { title: "Pick a template and add your product", lead: "Upload one product photo, choose any template and see the cost before you start." },
  industries: { title: "Make content for your products", lead: "Upload one product photo and pick a template made for your category." },
  platforms: { title: "Make ads for the platforms you sell on", lead: "Upload one product photo and pick the size for where your ad will run." },
  blog: { title: "Try it with your own product", lead: "Upload one product photo and turn it into a video ad or store-ready photos." },
  guides: { title: "Put the guides into practice", lead: "Upload one product photo and try what you just read." }
};

// The tool each article puts into practice, offered in a box halfway through the article and in its closing banner.
const ARTICLE_TOOL = {
  "guide-product-photo-tips": "white-background", "guide-white-background-amazon": "white-background", "guide-first-tiktok-video-ad": "video-ads",
  "guide-ad-sizes-by-platform": "social-ad-photos", "guide-testing-ad-versions": "video-ads", "blog-ai-product-photography-guide": "lifestyle-photos",
  "blog-ai-ugc-video-ads-guide": "video-ads", "blog-ai-video-review-checklist": "image-to-video", "blog-unboxing-videos-for-launches": "unboxing-videos",
  "blog-model-photos-without-a-photoshoot": "model-photos"
};

// The tool behind each start-to-finish example, so a visitor can make the same kind of result.
const FLOW_TOOL = {
  ebike: "video-ads", bottle: "social-ad-photos", tote: "lifestyle-photos", necklace: "model-photos", jacket: "social-ad-photos", lipstick: "lifestyle-photos",
  hoodie: "model-photos", handbag: "lifestyle-photos", boots: "model-photos", sunglasses: "lifestyle-photos", coffee: "lifestyle-photos", candle: "lifestyle-photos",
  phonecase: "lifestyle-photos", yogamat: "lifestyle-photos", hotsauce: "social-ad-photos"
};

// "Where to go next" links on the simple pages, so each one leads on to the pages a
// visitor is most likely to need next.
const NEXT_LINKS = {
  about: [
    ["AI Video", "/ai-video-generation", "Turn product photos into short video ads."],
    ["Product Photos", "/ai-image-generation", "White background, lifestyle and model photos."],
    ["Templates", "/templates", "Ready-made ideas for every product and platform."],
    ["Trust and Safety", "/trust-and-safety", "How we handle your uploads and AI content."],
    ["Company Facts", "/ai-info", "The key facts about AIVideosUGC in one place."]
  ],
  faq: [
    ["Pricing", "/pricing", "Plans, credits and what each job costs."],
    ["Glossary", "/glossary", "Plain-English definitions for credits, formats and product content."],
    ["Image to Video", "/ai-video-generation/image-to-video", "Start a video from one product photo."],
    ["Product photo tips", "/guides/product-photo-tips", "How to take a photo that gives good results."],
    ["Contact support", "/contact-us", "Email us if your question isn't answered here."],
    ["About AIVideosUGC", "/about-us", "Who we are and why we built it."]
  ],
  contact: [
    ["FAQ", "/faq", "Quick answers about credits, sizes and refunds."],
    ["Refund Policy", "/refunds", "When credits come back and how refund reviews work."],
    ["Pricing", "/pricing", "Plans and the credits each one includes."],
    ["Trust and Safety", "/trust-and-safety", "How we handle uploads and report problems."],
    ["About AIVideosUGC", "/about-us", "Who we are and why we built it."]
  ],
  pricing: [
    ["FAQ", "/faq", "More about credits, refunds and video lengths."],
    ["Glossary", "/glossary", "Understand credits and the formats used across the site."],
    ["Templates", "/templates", "See what your credits can make."],
    ["Refund Policy", "/refunds", "How refund reviews and credit returns work."],
    ["Contact support", "/contact-us", "Questions about a plan or a charge."]
  ],
  trust: [
    ["Privacy Policy", "/privacy", "What we collect and how long we keep it."],
    ["Content Policy", "/content", "What you can and can't upload."],
    ["Refund Policy", "/refunds", "How refund reviews and credit returns work."],
    ["Contact support", "/contact-us", "Report a problem with a result."],
    ["Company Facts", "/ai-info", "The key facts about AIVideosUGC in one place."],
    ["About AIVideosUGC", "/about-us", "Who we are and why we built it."]
  ],
  "ai-info": [
    ["AI Video", "/ai-video-generation", "Video tools and templates for product ads."],
    ["Product Photos", "/ai-image-generation", "Photo tools for store listings and ads."],
    ["Pricing", "/pricing", "Plans, credits and what each job costs."],
    ["About AIVideosUGC", "/about-us", "Who we are and why we built it."]
  ]
};
const POLICY_PATHS = ["/privacy", "/terms", "/refunds", "/cookies", "/content", "/digital-delivery", "/children-privacy", "/state-privacy"];
function nextLinks(model, type) {
  return (NEXT_LINKS[type] ?? []).map(([label, href, text]) => {
    assert.ok(model.pages.some((page) => page.url === href) || POLICY_PATHS.includes(href), `next link to unknown page ${href}`);
    return { label, href, text };
  });
}

// One article as a card: its title, what it covers and how long it takes to read.
function articleCard(model, id) {
  const page = model.byId[id];
  const c = model.content[id];
  assert.ok(page?.type === "article" && c.summary, `${id} is not an article with a summary`);
  return { title: c.h1, href: page.url, text: c.summary, minutes: c.read_minutes || 5, section: page.section };
}

// "Keep reading" on a page: the articles written for its topic, then general ones.
function readingFor(model, page, limit = 3) {
  const topical = Object.keys(ARTICLE_TOPICS)
    .map((id, order) => ({ id, order, at: ARTICLE_TOPICS[id].indexOf(page.id) }))
    .filter((entry) => entry.at >= 0)
    .sort((a, b) => a.at - b.at || a.order - b.order)
    .map((entry) => entry.id);
  const fallback = FALLBACK_READING[page.group === "video" ? "video" : page.group === "photo" ? "photo" : "general"];
  return [...new Set([...topical, ...fallback])].slice(0, limit).map((id) => articleCard(model, id));
}

const COMPACT_READING_TYPES = new Set(["template", "industry", "platform", "occasion"]);
const readingLimitFor = (page) => COMPACT_READING_TYPES.has(page.type) ? 2 : 3;

// What a page says about itself in a short line, for lists of related pages.
function relatedText(model, id) {
  const page = model.byId[id];
  const c = model.content[id];
  if (page.type === "article") return snippet(c.summary, 150);
  if (page.type === "tool" || page.type === "hub-tool") return TOOL_DESC[id] ?? snippet(c.lead, 120);
  if (page.type === "template") return LINES[id.slice(4)] ?? snippet(c.lead, 120);
  return c.card || snippet(c.lead, 120);
}

// "Related" at the end of an article: the pages it points to by hand, the tools and
// templates it is about, and the guides and posts that cover the same ground.
function articleRelatedFor(model, page) {
  const own = ARTICLE_TOPICS[page.id] ?? [];
  const siblings = Object.keys(ARTICLE_TOPICS)
    .filter((id) => id !== page.id)
    .map((id, order) => ({ id, order, shared: ARTICLE_TOPICS[id].filter((topic) => own.includes(topic)).length }))
    .filter((entry) => entry.shared >= 2)
    .sort((a, b) => b.shared - a.shared || a.order - b.order)
    .map((entry) => entry.id);
  const base = [...new Set([...(model.content[page.id].related || []), ...own.slice(0, 2)])].slice(0, 4);
  return [...new Set([...base, ...siblings])]
    .filter((id) => id !== page.id)
    .slice(0, 6)
    .map((id) => { assert.ok(model.byId[id], `${page.id}: related page ${id} missing`); return { label: model.byId[id].label, href: model.byId[id].url, text: relatedText(model, id) }; });
}

// Links inside article text are written [text](page:<page id>) or [text](/policy-path) and
// stored as [text](/url), so a page that moves never leaves a dead link behind.
const INLINE_LINK = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
const OFFICIAL_EXTERNAL_HOSTS = new Set(["ads.tiktok.com", "support.google.com", "help.shopify.com", "help.etsy.com"]);
const OWN_SITE_HOSTS = new Set(["aivideosugc.com", "www.aivideosugc.com"]);
function localPathFromAbsoluteUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && OWN_SITE_HOSTS.has(url.hostname.toLowerCase()) && !url.username && !url.password) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch { /* Non-URL targets are handled as local paths below. */ }
  return undefined;
}
function isExternalUrl(value) { return /^https?:\/\//i.test(String(value ?? "")) && !localPathFromAbsoluteUrl(value); }
function isApprovedExternalUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && OFFICIAL_EXTERNAL_HOSTS.has(url.hostname.toLowerCase()) && !url.username && !url.password;
  } catch { return false; }
}
function inlineLinks(model, value, where) {
  return value.replace(INLINE_LINK, (_, label, target) => {
    if (isExternalUrl(target)) return `[${label}](${target})`;
    const localPath = localPathFromAbsoluteUrl(target);
    const href = target.startsWith("page:") ? model.byId[target.slice(5)]?.url : localPath ?? target;
    assert.ok(href && (model.pages.some((page) => page.url === href) || POLICY_PATHS.includes(href)), `${where}: link target ${target} not found`);
    return `[${label}](${href})`;
  });
}

// Contextual links in the opening paragraphs of the selling pages. The first mention of a phrase links to the page about
// it, so the tool, occasion, industry, template and platform pages are linked from the copy around them with the words
// people search for. Earlier entries win; each target is linked once per page, never to the page itself, at most AUTO_LINK_MAX times.
const AUTO_LINK_MAX = 5;
// Across the whole site a page receives at most this many automatic links, so common words (Reels, product photos)
// don't pile links onto a few pages.
const AUTO_LINK_TARGET_CAP = 8;
const AUTO_LINK_TARGET_CAPS = { "video-ads": 12, "lifestyle-photos": 12, "model-photos": 12, "white-background": 12 };
const AUTO_LINKS = [
  [/\blimited[- ]drop|restock alert\b/i, "tpl-limited-drop-alert-video"],
  [/\bfeature callout|single feature\b/i, "tpl-product-feature-callout-video"],
  [/\bcarousel video|carousel-style\b/i, "tpl-carousel-video-ad"],
  [/\bSpark Ads?|native TikTok ad\b/i, "tpl-spark-ads-style-video"],
  [/\bretarget(?:ing|ed)|remarketing\b/i, "tpl-retargeting-video-ad"],
  [/\b(?:Black Friday|Cyber Monday)\b/i, "occ-black-friday"],
  [/\bholiday (?:season|ads?|sales?|campaigns?|gifts?|shoppers)\b/i, "occ-holidays"],
  [/\b(?:product launch(?:es)?|new launch(?:es)?|launch day)\b/i, "occ-product-launch"],
  [/\b(?:(?:sale|discount|promo) (?:ads?|campaigns?|banners?|images?)|flash sales?|seasonal sales?)\b/i, "occ-sale-discount"],
  [/\b(?:UGC(?:-style)? (?:video )?ads?|creator-style (?:video )?(?:ads?|clips?|videos?)|creator videos?|video ads?)\b/i, "video-ads"],
  [/\bwhite[- ]background (?:photos?|images?|shots?|versions?)\b|\bwhite backgrounds?\b|\bplain white (?:background|backdrop)\b|\bwhite backdrop\b/i, "white-background"],
  [/\blifestyle (?:photos?|scenes?|shots?|images?|settings?)\b|\breal-life (?:scene|setting)\b/i, "lifestyle-photos"],
  [/\b(?:on-model|model) (?:photos?|shots?|images?)\b|\bworn by a model\b/i, "model-photos"],
  [/\b(?:feed ad (?:images?|photos?)|social ad (?:images?|photos?)|feed ads?)\b/i, "social-ad-photos"],
  [/\b(?:unboxing (?:videos?|clips?)|reveal clips?)\b/i, "unboxing-videos"],
  [/\b(?:product (?:videos?|demos?)|demo(?:-style)? (?:videos?|clips?))\b/i, "product-videos"],
  [/\bbefore[- ]and[- ]after (?:videos?|clips?)\b/i, "before-after-videos"],
  [/\b(?:new backgrounds?|change (?:the|your) background)\b/i, "change-background"],
  [/\b(?:image to video|photo into a (?:short )?video)\b/i, "image-to-video"],
  [/\b(?:product (?:page )?links?|product URLs?)\b/i, "url-to-video"],
  [/\b(?:skincare|beauty (?:brands?|products?)|cosmetics)\b/i, "ind-beauty-skincare"],
  [/\b(?:clothing|apparel|fashion brands?)\b/i, "ind-fashion-clothing"],
  [/\b(?:shoes|sneakers|footwear)\b/i, "ind-shoes"],
  [/\b(?:trainers|running shoes|boots)\b/i, "ind-shoes"],
  [/\bjewelry\b/i, "ind-jewelry-accessories"],
  [/\b(?:electronics|gadgets?)\b/i, "ind-electronics"],
  [/\b(?:supplements?|wellness (?:brands?|products?))\b/i, "ind-health-wellness"],
  [/\b(?:vitamins?|fitness gear)\b/i, "ind-health-wellness"],
  [/\b(?:food and drinks?|food (?:brands?|products?)|beverages?)\b/i, "ind-food-drinks"],
  [/\b(?:home goods|home decor|furniture)\b/i, "ind-home-living"],
  [/\bsize comparisons?\b/i, "tpl-size"],
  [/\b(?:colou?r (?:variants?|options)|colorways?)\b/i, "tpl-color"],
  [/\b(?:close-ups?|macro (?:views?|shots?|details?))\b/i, "tpl-detail"],
  [/\bpackaging (?:mockups?|designs?|previews?)\b/i, "tpl-pack"],
  [/\blookbooks?\b/i, "tpl-look"],
  [/\bstudio light(?:ing)?\b/i, "tpl-light"],
  [/\b(?:what's in the box|gift sets?|bundles?)\b/i, "tpl-box"],
  [/\bheadshots?\b/i, "tpl-head"],
  [/\b(?:(?:square |sale )?banners?)\b/i, "tpl-sale"],
  [/\b(?:promo clips?|teasers?)\b/i, "tpl-launch"],
  [/\b(?:multiple angles|every angle|front, side and back)\b/i, "tpl-angle"],
  [/\bTikTok\b/, "plat-tiktok"],
  [/\b(?:Instagram|Reels)\b/, "plat-instagram"],
  [/\bFacebook\b/, "plat-facebook"],
  [/\bYouTube Shorts\b/, "plat-youtube-shorts"],
  [/\bAmazon\b/, "plat-amazon"],
  [/\bShopify\b/, "plat-shopify"],
  [/\b(?:Reels|Stories)\b/, "plat-instagram"],
  [/\bproduct (?:photos?|shots?)\b/i, "photo-hub"],
  [/\b(?:(?:short|vertical|square) (?:product )?(?:videos?|clips?))\b/i, "video-hub"]
];
function autoLinks(model, paras, page) {
  if (!Array.isArray(paras) || !paras.length) return paras;
  const out = paras.map((para) => inlineLinks(model, para, page.id));
  const linked = new Set(out.flatMap((para) => [...para.matchAll(INLINE_LINK)].map((match) => match[2]).filter((target) => !isExternalUrl(target)).map((target) => localPathFromAbsoluteUrl(target) ?? target)));
  let added = 0;
  model.autoLinkCount ??= {};
  for (const [pattern, targetId] of AUTO_LINKS) {
    if (added >= AUTO_LINK_MAX) break;
    const target = model.byId[targetId];
    const targetCap = AUTO_LINK_TARGET_CAPS[targetId] ?? AUTO_LINK_TARGET_CAP;
    if (!target || targetId === page.id || linked.has(target.url) || (model.autoLinkCount[targetId] ?? 0) >= targetCap) continue;
    for (let index = 0; index < out.length; index += 1) {
      // Only plain text is searched, never the label or address of a link already in the paragraph.
      const masked = out[index].replace(INLINE_LINK, (whole) => " ".repeat(whole.length));
      const match = pattern.exec(masked);
      if (!match) continue;
      out[index] = `${out[index].slice(0, match.index)}[${out[index].slice(match.index, match.index + match[0].length)}](${target.url})${out[index].slice(match.index + match[0].length)}`;
      linked.add(target.url); added += 1;
      model.autoLinkCount[targetId] = (model.autoLinkCount[targetId] ?? 0) + 1;
      break;
    }
  }
  return out;
}

// The same contextual links across a page's opening paragraphs and the descriptions in its idea or benefit cards.
function autoLinkPage(model, page, intro, groups) {
  const paras = Array.isArray(intro) ? intro : [];
  const lists = groups.map((items) => (Array.isArray(items) ? items : []));
  const linked = autoLinks(model, [...paras, ...lists.flatMap((items) => items.map((item) => item.d ?? ""))], page) ?? [];
  let at = paras.length;
  return { intro: Array.isArray(intro) ? linked.slice(0, paras.length) : intro,
    groups: lists.map((items) => items.map((item) => ({ ...item, d: linked[at++] }))) };
}

// Links in a spec row ("Best for", "Popular with"): the names stay readable as plain text
// in `value`, and each one also leads to its page.
function specLinks(model, ids) {
  return ids.map((id) => ({ label: model.byId[id].label, href: model.byId[id].url }));
}

// Start-to-finish examples. Each follows one product from its photo to results made with the
// photo tools: a gallery of the tools' own pictures ("g:" files) or the newly generated pictures
// ("n:" references, a plain product photo first and then scenes made from it).
const EXAMPLE_FLOWS = {
  ebike: [null, [["Product photo", "n:guide:plat-youtube-shorts-size-portrait-ebike"], ["Video ad · 9:16", "f:video-hub-h1-bike"]]],
  tote: ["lifestyle-scene", [["Product photo", "source-input"], ["Sunny cafe", "example-01"], ["City bike", "example-03"]]],
  necklace: ["jewelry-positioning", [["Product photo", "source-input"], ["Worn on a dark top", "example-01"], ["Pendant detail", "example-05"]]],
  jacket: ["sale-campaign-key-visual", [["Product photo", "source-input"], ["Worn outdoors", "example-02"], ["Snowy city", "example-05"]]],
  lipstick: [null, [["Product photo", "n:lipstick-pack"], ["On a vanity", "n:lipstick-vanity"], ["Shade swatch", "n:lipstick-swatch"]]],
  hoodie: [null, [["Product photo", "n:hoodie-pack"], ["Worn outdoors", "n:hoodie-street"], ["Flat lay", "n:hoodie-flatlay"]]],
  handbag: [null, [["Product photo", "n:handbag-pack"], ["Cafe table", "n:handbag-cafe"], ["Carried outdoors", "n:handbag-carry"]]],
  boots: [null, [["Product photo", "n:boots-pack"], ["On cobblestones", "n:boots-street"], ["By the door", "n:boots-doorway"]]],
  sunglasses: [null, [["Product photo", "n:sunglasses-pack"], ["Cafe table", "n:sunglasses-cafe"], ["Worn outdoors", "n:sunglasses-worn"]]],
  coffee: [null, [["Product photo", "n:coffee-pack"], ["Kitchen counter", "n:coffee-counter"], ["Breakfast table", "n:coffee-breakfast"]]],
  candle: [null, [["Product photo", "n:candle-pack"], ["Living room", "n:candle-table"], ["Bath edge", "n:candle-bath"]]],
  phonecase: [null, [["Product photo", "n:phonecase-pack"], ["On a desk", "n:phonecase-desk"], ["In a hand", "n:phonecase-hand"]]],
  yogamat: [null, [["Product photo", "n:yogamat-pack"], ["Bright room", "n:yogamat-room"], ["In use", "n:yogamat-pose"]]],
  hotsauce: [null, [["Product photo", "n:hotsauce-pack"], ["Over tacos", "n:hotsauce-tacos"], ["With fresh chilies", "n:hotsauce-peppers"]]]
};

function flowCta(model, id) {
  const tool = model.byId[FLOW_TOOL[id]];
  return tool ? { cta: { label: "Try this with your product", href: toolAppHref(model, tool) } } : {};
}

function exampleFlow(model, item) {
  if (item.id === "bottle") {
    return { t: item.t, d: item.d, ...flowCta(model, item.id), steps: [
      { label: "Lifestyle photo", image: imageRef(model, "bottle", "Green water bottle in a living room scene") },
      { label: "Feed ad", image: imageRef(model, "feedbottle", "Same water bottle in a sunlit feed ad") }] };
  }
  const flow = EXAMPLE_FLOWS[item.id];
  assert.ok(flow, `unknown example flow ${item.id}`);
  return { t: item.t, d: item.d, ...flowCta(model, item.id), steps: flow[1].map(([label, file], index) => ({
    label: item.imageLabels?.[index] || label,
    image: mediaImage(model, item.imageRefs?.[index] || (flow[0] ? `g:${flow[0]}/${file}` : file), "gallery")
  })) };
}

function articleTry(model, page) {
  const tool = model.byId[ARTICLE_TOOL[page.id]];
  if (!tool) return {};
  const video = tool.group === "video";
  return { tryBox: { title: `Try ${tool.label}`, text: `${TOOL_DESC[tool.id]}. Upload one product photo and see the cost before you start.`,
    href: toolAppHref(model, tool), label: video ? "Make my video" : "Make my photo", more: { label: `How ${tool.label} works`, href: tool.url } } };
}

// Template and collection pages with a visual guide do not render the hero picture, gallery or collage.
function guideReplacesHero(page, payload) {
  return Boolean(payload.visual) && ["template", "collection"].includes(layoutFor(page));
}

function layoutFor(page) {
  return { home: "home", hub: "video-hub", "hub-tool": "tool", tool: "tool", template: "template", industry: "collection", platform: "collection", occasion: "collection",
    index: "index", glossary: "glossary", article: "article", pricing: "pricing", faq: "faq", contact: "contact", about: "about", examples: "examples", trust: "trust", "ai-info": "ai-info" }[page.type];
}

// Enrichment drafts use compact copy-writing shapes (overview paragraphs use `d` or `p`).
// Normalize them once while compiling so the public payload has only renderable fields and
// never carries review notes or other editorial metadata.
function enrichmentFor(model, page, c) {
  const item = (value, linkify = false) => {
    const entry = typeof value === "string" ? { t: value, d: "" } : value && typeof value === "object" ? { t: value.t ?? "", d: value.d ?? "" } : { t: "", d: "" };
    return linkify ? { ...entry, d: inlineLinks(model, entry.d, page.id) } : entry;
  };
  const items = (value, linkify = false) => Array.isArray(value) ? value.map((entry) => item(entry, linkify)).filter((entry) => entry.t) : [];
  const section = (value) => {
    if (Array.isArray(value)) return value.map((entry) => ({ h2: entry.h2, paras: [inlineLinks(model, entry.d ?? entry.p ?? "", page.id)].filter(Boolean) }));
    if (value && typeof value === "object") return [{ h2: value.h2, paras: [], items: items(value.items, true) }];
    return [];
  };
  const block = (value, linkify = false) => value && typeof value === "object" ? { h2: value.h2, items: items(value.items, linkify) } : undefined;
  const fit = value => value && typeof value === "object" ? { h2: value.h2, good: items(value.good), not_ideal: items(value.not_ideal) } : undefined;
  const compare = block(c.compare);
  return {
    ...(c.overview ? { overview: section(c.overview) } : {}),
    ...(c.input_guide ? { inputGuide: block(c.input_guide) } : {}),
    ...(c.results ? { results: block(c.results) } : {}),
    ...(c.scene_prompt_examples ? { scenePromptExamples: block(c.scene_prompt_examples) } : {}),
    ...(c.troubleshooting ? { troubleshooting: block(c.troubleshooting) } : {}),
    ...(c.tool_chooser ? { toolChooser: block(c.tool_chooser, true) } : {}),
    ...(c.limitations ? { limitations: block(c.limitations) } : {}),
    ...(c.scene_recipes ? { sceneRecipes: block(c.scene_recipes) } : {}),
    ...(c.after_download ? { afterDownload: block(c.after_download) } : {}),
    ...(c.fit ? { fit: fit(c.fit) } : {}),
    ...(compare ? { compare } : {})
  };
}

function payloadFor(model, page) {
  const c = model.content[page.id];
  const examples = exampleGalleryFor(model, page);
  const base = {
    id: page.id, label: page.label, eyebrow: c.eyebrow || page.label, h1: c.h1, lead: c.lead,
    breadcrumbs: page.id === "home" ? [] : breadcrumbTrail(model, page),
    faq: (c.faq || []).map((item) => ({ q: item.q, a: inlineLinks(model, item.a, page.id) })),
    startNote: page.type === "pricing" ? START_NOTE_PLAIN : START_NOTE,
    ...(typeof c.cta_lead === "string" ? { ctaLead: c.cta_lead } : {}),
    ...(typeof c.templates_lead === "string" ? { templatesLead: c.templates_lead } : {}),
    ...(typeof c.maker?.upload_title === "string" ? { maker: { uploadTitle: c.maker.upload_title } } : {}),
    ...(examples ? { examples } : {}),
    ...enrichmentFor(model, page, c)
  };
  const t = page.type;
  if (t === "home") {
    const homeTemplateCards = applyCardOverrides(model, page, HOME_FEATURED.map((key) => cardRef(model, key, key === "creator" ? "alt" : "primary")).filter(Boolean));
    const videoHref = appHref({ tool: "video-ads", template: "creator", size: "9:16", length: "15", prompt: TEMPLATE_PROMPTS.creator }, true);
    const photoHref = appHref({ tool_id: "image_generator", tool: "white-background", template: "white", prompt: TEMPLATE_PROMPTS.white }, false);
    const homeMaker = {
      uploadTitle: c.maker?.upload_title || "",
      cta: c.visual?.steps?.mode === "photo" ? "Make my photos" : "Make my video",
      videoOptions: HOME_VIDEO_OPTIONS,
      photoOptions: HOME_PHOTO_OPTIONS
    };
    const visual = visualFor(model, page, c.visual, homeMaker, "video", videoHref, c);
    return { ...base,
      maker: homeMaker,
      ...(visual ? { visual } : {}),
      // `output` and `versions` belong to the picture layout used when the hero has no video; with the video reel they are not shown, so they stay out of the data.
      hero: { image: mediaImage(model, "g:feed-ad-still/source-input", "inset"),
        ...(model.media.plan.pages.home?.hero?.kind === "loop" ? {} : { output: mediaImage(model, "g:feed-ad-still/hero-output", "inset"), versions: [0, 1, 2].map((i) => imageRef(model, `var${i}`, `Smartwatch opening version ${"ABC"[i]}`)) }),
        videoHref, photoHref },
      make: { title: c.make_title, lead: c.make_lead, video: VIDEO_TOOLS.map((id) => toolRef(model, id)), photo: PHOTO_TOOLS.map((id) => toolRef(model, id)) },
      templates: { title: c.templates_title, lead: c.templates_lead, cards: homeTemplateCards, total: model.cards.length },
      platforms: { title: c.platforms_title, items: Object.entries(model.plat).map(([slug, label]) => ({ label, href: model.byId[`plat-${slug}`].url, spec: (model.content[`plat-${slug}`].specs || [["", ""]])[0][1] })) },
      steps: c.steps, compare: c.compare, plans: PLANS,
      ...(c.ugc ? { ugc: { ...c.ugc, paras: (c.ugc.paras || []).map((para) => inlineLinks(model, para, page.id)) } } : {}),
      ...(c.audience ? { audience: { ...c.audience, items: (c.audience.items || []).map((item) => ({ ...item, d: inlineLinks(model, item.d, page.id) })) } } : {}),
      exampleGallery: examples,
      examples: { flows: (c.example_flows || []).map((item) => exampleFlow(model, item)) }
    };
  }
  if (t === "hub") {
    const linkedCopy = autoLinkPage(model, page, c.intro, [c.benefits]);
    const hubAppHref = appHref({ tool: "video-ads", size: "9:16", length: "15" }, true);
    const visual = visualFor(model, page, c.visual, { videoOptions: HOME_VIDEO_OPTIONS }, "video", hubAppHref, c);
    const relatedGroups = [
      { title: "Video templates", links: templateLinksFor(model, "video", 8) },
      { title: "Channels and campaigns", links: pageLinksFor(model, ["plat-tiktok", "tpl-bf"]) }
    ];
    const maker = {
      options: c.maker?.options ?? [["Frame", "9:16 · 1:1 · 16:9"], ["Length", "6, 10, or 15 seconds"]],
      cta: c.maker?.cta ?? "Make my video",
      href: hubAppHref
    };
    return { ...base, intro: linkedCopy.intro, benefits: linkedCopy.groups[0], steps: c.steps, maker,
      tools: VIDEO_TOOLS.map((id) => toolRef(model, id, true, model.cardOverrides?.[page.id]?.tools?.[id])),
      heroCards: applyCardOverrides(model, page, ["creator", "unbox", "beauty"].map((key) => cardRef(model, key, "primary")).filter(Boolean)),
      cards: applyCardOverrides(model, page, CARD_ORDER.filter((key) => model.cardByKey[key].kind === "video" && !["creator", "unbox", "beauty"].includes(key)).map((key) => cardRef(model, key, "primary")).filter(Boolean)),
      appHref: hubAppHref,
      relatedGroups,
      ...(visual ? { visual } : {}),
      reading: readingFor(model, page, readingLimitFor(page)) };
  }
  if (t === "tool" || t === "hub-tool") {
    const hub = page.id === "photo-hub";
    const hasHero = Boolean(model.media.plan.pages[page.id]?.hero);
    // The photo hub lists every photo template with its curated picture; other tool pages show a few.
    const rel = hub ? (TOOL_REL[page.id] || []).map((key) => cardRef(model, key, "primary")).filter(Boolean) : pickCards(model, TOOL_REL[page.id] || [], 4);
    const video = page.group === "video";
    const siblings = (video ? VIDEO_TOOLS : PHOTO_TOOLS).filter((id) => id !== page.id).map((id) => toolRef(model, id, false));
    const industryIds = Object.entries(IND_TOOLS).filter(([, tools]) => tools.includes(page.id)).map(([slug]) => `ind-${slug}`).slice(0, 5);
    const platformIds = Object.entries(PLAT_TOOLS).filter(([, tools]) => tools.includes(page.id)).map(([slug]) => `plat-${slug}`).slice(0, 5);
    const names = (ids) => ids.map((id) => model.byId[id].label).join(", ");
    const linkedCopy = autoLinkPage(model, page, c.intro, [c.benefits, c.uses || []]);
    const templateCards = applyCardOverrides(model, page, hub ? rel.slice(3) : hasHero ? rel : rel.slice(2));
    const caseCards = caseCardsFor(model, page, templateCards);
    const maker = { options: (c.maker?.options || []).slice(0, 3), cta: c.maker?.cta || (video ? "Make my video" : "Make my photos"), href: toolAppHref(model, page, rel[0]?.key), urlInput: page.id === "url-to-video", ...(typeof c.maker?.upload_title === "string" ? { uploadTitle: c.maker.upload_title } : {}) };
    const visual = visualFor(model, page, c.visual, maker, page.group, maker.href, c);
    const relatedGroups = hub ? [
      { title: "Photo templates", links: templateLinksFor(model, "photo", 4) },
      { title: "Browse industries", links: pageLinksFor(model, ["ind-beauty-skincare", "ind-shoes", "ind-food-drinks", "ind-home-living"]) },
      { title: "Browse platforms", links: pageLinksFor(model, ["plat-amazon", "plat-shopify"]) }
    ] : [];
    return { ...base, group: page.group, intro: linkedCopy.intro, benefits: linkedCopy.groups[0], steps: c.steps, uses: linkedCopy.groups[1],
      maker,
      ...(relatedGroups.length ? { relatedGroups } : {}),
      ...(visual ? { visual } : {}),
      specs: [
        ...(video ? [["Sizes", "9:16 · 1:1 · 16:9"], ["Length", "6, 10, 15 or 30 seconds"], ["You start with", page.id === "url-to-video" ? "A product page link" : "1 product photo"], ["Cost", "Shown before you start"]]
          : [["Size", "Square by default"], ["You upload", "1 product photo"], ["You get", "A new product photo"], ["Cost", "Shown before you start"]]),
        ...(platformIds.length ? [["Best for", names(platformIds), specLinks(model, platformIds)]] : []),
        ...(industryIds.length ? [["Popular with", names(industryIds), specLinks(model, industryIds)]] : []),
        ...(OCCASION_TOOLS.includes(page.id) ? [["Good for", names(OCCASION_IDS), specLinks(model, OCCASION_IDS)]] : [])
      ],
      hero: page.id === "white-background" ? { single: imageRef(model, "p_white", "Running shoe on a pure white background") }
        : page.id === "spokesperson-videos" ? { single: imageRef(model, "presenter", "AI-generated presenter holding a skincare bottle") }
        : hasHero ? {} : { cards: hub ? applyCardOverrides(model, page, rel.slice(0, 3)) : rel.slice(0, 3) },
      templates: [...templateCards, ...caseCards], siblings: hub ? [] : siblings, photoTools: hub ? PHOTO_TOOLS.slice(1).map((id) => toolRef(model, id)) : [],
      reading: readingFor(model, page, readingLimitFor(page)) };
  }
  if (t === "template") {
    const key = page.id.slice(4);
    const tool = model.byId[page.made_with];
    const sameKind = model.cards.filter((card) => card.key !== key && card.kind === page.group);
    const related = sameKind.filter((card) => card.ind.some((x) => page.industries.includes(x)) || card.plat.some((x) => page.platforms.includes(x)) || card.occ.some((x) => (page.occasions ?? []).includes(x))).map((card) => card.key);
    const fallback = sameKind.map((card) => card.key).filter((k) => !related.includes(k));
    const platformIds = page.platforms.map((slug) => `plat-${slug}`);
    const industryIds = page.industries.map((slug) => `ind-${slug}`);
    const occasionIds = (page.occasions ?? []).map((slug) => `occ-${slug}`);
    const names = (ids) => ids.map((id) => model.byId[id].label).join(", ");
    const linkedCopy = autoLinkPage(model, page, c.intro, [c.ideas || []]);
    const moreCards = applyCardOverrides(model, page, pickRelatedCards(model, related, fallback, 3));
    const caseCards = caseCardsFor(model, page, moreCards);
    const maker = { options: (c.maker?.options || [["Template", page.label], ["Output", page.output]]).slice(0, 3), cta: c.maker?.cta || "Use this template", href: toolAppHref(model, tool, key), ...(typeof c.maker?.upload_title === "string" ? { uploadTitle: c.maker.upload_title } : {}) };
    const visual = visualFor(model, page, c.visual, maker, page.group, maker.href, c);
    return { ...base, kind: page.group, intro: linkedCopy.intro, tip: c.tip, steps: c.steps, ideas: linkedCopy.groups[0],
      image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, `${page.label} template preview`),
      maker,
      ...(visual ? { visual } : {}),
      specs: [
        ["Output", page.output],
        page.platforms.length ? ["Best for", names(platformIds), specLinks(model, platformIds)] : ["Best for", "Your website"],
        page.industries.length ? ["Popular with", names(industryIds), specLinks(model, industryIds)] : ["Popular with", "Any brand"],
        ["Made with", tool.label, specLinks(model, [tool.id])],
        ...(occasionIds.length ? [["Good for", names(occasionIds), specLinks(model, occasionIds)]] : [])
      ],
      madeWith: { label: tool.label, href: tool.url }, more: [...moreCards, ...caseCards], reading: readingFor(model, page, readingLimitFor(page)) };
  }
  if (t === "industry" || t === "platform" || t === "occasion") {
    const slug = page.id.split("-").slice(1).join("-");
    const field = { industry: "ind", platform: "plat", occasion: "occ" }[t];
    const tools = (t === "industry" ? IND_TOOLS[slug] : t === "platform" ? PLAT_TOOLS[slug] : OCCASION_TOOLS) || [];
    const direct = model.cards.filter((card) => card[field].includes(slug)).map((card) => card.key);
    const keys = collectionCardKeys(model, field, slug, tools);
    const hasHero = Boolean(model.media.plan.pages[page.id]?.hero);
    const collage = hasHero ? [] : applyCardOverrides(model, page, pickRelatedCards(model, direct, keys.filter((key) => !direct.includes(key)), 2));
    const directRemaining = direct.filter((key) => !collage.some((card) => card.key === key));
    const fallbackRemaining = keys.filter((key) => !direct.includes(key) && !collage.some((card) => card.key === key));
    const listed = applyCardOverrides(model, page, pickRelatedCards(model, directRemaining, fallbackRemaining, hasHero ? 3 : 2));
    const paramKey = { industry: "industry", platform: "platform", occasion: "occasion" }[t];
    const collectionHref = appHref({ [paramKey]: slug, ...(t === "platform" && ["tiktok", "youtube-shorts", "instagram"].includes(slug) ? { size: "9:16", length: "15" } : {}) }, t === "platform" && ["tiktok", "youtube-shorts"].includes(slug));
    const linkedCopy = autoLinkPage(model, page, c.intro, [c.ideas || []]);
    const caseCards = caseCardsFor(model, page, listed);
    let visual;
    let visualMaker;
    if (c.visual) {
      const visualMode = c.visual.steps?.mode ?? "photo";
      const visualTool = visualMode === "video" ? recommendedVideoTool(model, page) : recommendedPhotoTool(model, page);
      const toolMaker = model.content[visualTool.id]?.maker ?? {};
      visualMaker = {
        options: (toolMaker.options || []).slice(0, 3),
        cta: toolMaker.cta || (visualMode === "video" ? "Make my video" : "Make my photos"),
        href: collectionHref
      };
      visual = visualFor(model, page, c.visual, visualMaker, visualMode, collectionHref, c);
      assert.ok(!(t === "occasion" && (c.plan || []).length) || String(c.visual.titles?.plan?.h2 || "").trim(), `${page.id}: an occasion page with a plan needs visual.titles.plan.h2`);
    }
    return { ...base, kind: t, intro: linkedCopy.intro, ideas: linkedCopy.groups[0], specs: c.specs || [], tips: c.tips || [], plan: c.plan || [],
      cards: [...listed, ...caseCards], heroCards: collage, tools: tools.map((id) => toolRef(model, id, false)),
      appHref: collectionHref,
      ...(visual ? { visual, maker: visualMaker } : {}),
      reading: readingFor(model, page, readingLimitFor(page)) };
  }
  if (t === "index") {
    const out = { ...base, intro: Array.isArray(c.intro) ? c.intro.map((para) => inlineLinks(model, para, page.id)) : c.intro,
      ...(INDEX_CTA[page.id] ? { cta: { ...INDEX_CTA[page.id], href: "/app/create" } } : {}) };
    const visual = visualFor(model, page, c.visual, { photoOptions: HOME_PHOTO_OPTIONS }, "photo", "/app/create", c);
    if (visual) out.visual = visual;
    if (page.id === "templates") {
      const chips = c.visual?.picker ?? [];
      const groups = c.visual?.directoryFilters?.templateGroups ?? {};
      const cards = model.cards.map((item) => {
        const card = cardRef(model, item.key, "primary");
        const image = heroImageOf(heroMediaFor(model, item.pageId)) ?? pageCardImage(model, item.pageId);
        return card ? { ...card, image, filterTags: templateFilterTags(card, chips, groups) } : null;
      }).filter(Boolean);
      out.cards = applyCardOverrides(model, page, cards);
      out.filters = { types: [["video", "Video"], ["photo", "Photo"]], industries: Object.entries(model.ind), platforms: Object.entries(model.plat) };
    } else if (page.id === "industries" || page.id === "platforms") {
      const prefix = page.id === "industries" ? "ind-" : "plat-";
      const filterMap = c.visual?.directoryFilters?.items ?? {};
      const imageOverrides = c.visual?.directoryFilters?.itemImages ?? {};
      out.items = model.pages.filter((p) => p.id.startsWith(prefix)).map((p) => ({ label: p.label, href: p.url, text: model.content[p.id].card || snippet(model.content[p.id].lead, 140), image: imageOverrides[p.url] ? mediaImage(model, imageOverrides[p.url], "card") : pageCardImage(model, p.id), filterTags: filterMap[p.url] ?? [] }));
    } else {
      out.articles = model.pages.filter((p) => p.section === page.id).map((p) => ({ title: model.content[p.id].h1, summary: model.content[p.id].summary || "", minutes: model.content[p.id].read_minutes || 5, href: p.url, image: pageCardImage(model, p.id) }));
    }
    return out;
  }
  if (t === "article") {
    return { ...base, section: page.section, minutes: c.read_minutes || 5, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, page.label),
      sections: (c.sections || []).map((section) => ({ ...section, paras: section.paras.map((para) => inlineLinks(model, para, page.id)) })), checklist: c.checklist || [],
      related: articleRelatedFor(model, page), ...articleTry(model, page) };
  }
  if (t === "pricing") return { ...base, intro: c.intro || [], credits: c.credits_explained || [], costs: JOB_COST_ROWS, ...(c.teams ? { teams: c.teams } : {}), plans: PLANS, next: nextLinks(model, t) };
  if (t === "faq") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), next: nextLinks(model, t) };
  if (t === "contact") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), intro: c.intro || [], topics: c.topics || [], email: "support@aivideosugc.com", next: nextLinks(model, t) };
  if (t === "about") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), sections: c.sections || [], next: nextLinks(model, t) };
  if (t === "trust") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), sections: c.sections || [], next: nextLinks(model, t) };
  if (t === "ai-info") return { ...base, summary: c.summary, facts: c.facts, notOffered: c.not_offered, describe: c.describe, llmsText: buildLlmsText(model), next: nextLinks(model, t) };
  if (t === "examples") {
    const visual = visualFor(model, page, c.visual, {}, "photo", "/app/create", c);
    const filterMap = c.visual?.directoryFilters?.cases ?? {};
    const flows = (c.cases || []).map((item) => {
      const flow = exampleFlow(model, item);
      if (item.id !== "bottle") return { id: item.id, ...flow, filterTags: filterMap[item.id] ?? [] };
      const bottleClip = mediaImage(model, "f:examples-h1-bottle-frame", "card");
      return {
        id: item.id,
        ...flow,
        d: "A green bottle appears in everyday photos and a vertical clip showing water being poured.",
        steps: [...flow.steps, { label: "Video · 9:16", tall: true, image: { ...bottleClip, alt: "Hands unscrew a sage-green bottle lid and pour water into its open mouth." } }],
        filterTags: filterMap[item.id] ?? []
      };
    });
    const relatedTemplates = [...templateLinksFor(model, "photo", 6), ...templateLinksFor(model, "video", 6)];
    return { ...base, intro: c.intro || [], flows, relatedTemplates, cards: pickCards(model, CARD_ORDER, 12), ...(visual ? { visual } : {}),
      cta: { title: "Make this with your own product", lead: "Upload one product photo and pick the look you liked.", href: "/app/create" } };
  }
  if (t === "glossary") {
    const entries = (c.entries || []).slice().sort((a, b) => String(a.term).localeCompare(String(b.term))).map((entry) => ({
      term: entry.term,
      definition: entry.definition,
      related: (entry.related_page_ids || []).map((id) => {
        const target = model.byId[id];
        assert.ok(target, `glossary: related page ${id} is missing`);
        return { label: target.label, href: target.url };
      })
    }));
    return { ...base, entries };
  }
  throw new Error(`unsupported page type ${t}`);
}

function jsonLdFor(model, page, c, payload, ogImage) {
  const org = { "@type": "Organization", "@id": `${BASE}/#organization`, name: "AIVideosUGC", url: `${BASE}/` };
  const graph = [org];
  if (page.id === "home") graph.push({ "@type": "WebSite", "@id": `${BASE}/#website`, name: "AIVideosUGC", url: `${BASE}/`, inLanguage: "en", publisher: { "@id": `${BASE}/#organization` } });
  else graph.push({ "@type": "BreadcrumbList", itemListElement: payload.breadcrumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.label, item: `${BASE}${crumb.href === "/" ? "/" : crumb.href}` })) });
  const absolute = (src) => `${BASE}${src}`;
  // Template and collection pages with a visual guide show the guide instead of the hero picture or video.
  const hero = guideReplacesHero(page, payload) ? undefined : payload.heroMedia;
  const firstVisual = visualPayloadImages(payload.visual)[0];
  const primary = heroImageOf(hero) ?? (firstVisual ? { src: firstVisual.src, width: firstVisual.w, height: firstVisual.h } : ogImage);
  const videoNode = hero?.kind === "video" ? hero.video : undefined;
  const videoId = `${canonical(page)}#video`;
  const webpageType = { hub: "CollectionPage", index: "CollectionPage", industry: "CollectionPage", platform: "CollectionPage", occasion: "CollectionPage", examples: "CollectionPage", contact: "ContactPage", about: "AboutPage" }[page.type] || "WebPage";
  if (page.type === "article") {
    graph.push({ "@type": page.section === "blog" ? "BlogPosting" : "Article", headline: c.h1, description: c.description, image: absolute(primary.src), author: { "@id": `${BASE}/#organization` }, publisher: { "@id": `${BASE}/#organization` }, datePublished: "2026-10-02", dateModified: "2026-10-02", mainEntityOfPage: canonical(page), inLanguage: "en" });
  } else {
    graph.push({ "@type": webpageType, "@id": `${canonical(page)}#webpage`, url: canonical(page), name: c.title, description: c.description, inLanguage: "en", isPartOf: { "@id": `${BASE}/#website` },
      primaryImageOfPage: { "@type": "ImageObject", url: absolute(primary.src), width: primary.width, height: primary.height },
      ...(videoNode ? { video: { "@id": videoId } } : {}) });
  }
  if (videoNode) {
    graph.push({ "@type": "VideoObject", "@id": videoId, name: videoNode.name, description: videoNode.description, thumbnailUrl: [absolute(videoNode.poster.src)], uploadDate: videoNode.uploadDate,
      duration: `PT${videoNode.duration}S`, contentUrl: absolute(videoNode.src), width: videoNode.width, height: videoNode.height, inLanguage: "en" });
  }
  if (["tool", "hub-tool", "template", "hub"].includes(page.type) && payload.steps?.length >= 2) {
    graph.push({ "@type": "HowTo", "@id": `${canonical(page)}#howto`, name: `How it works: ${page.label}`,
      step: payload.steps.map((step, index) => ({ "@type": "HowToStep", position: index + 1, name: step.t, text: step.d })) });
  }
  if (page.type === "tool" || page.type === "hub-tool") {
    graph.push({ "@type": "SoftwareApplication", name: `AIVideosUGC ${page.label}`, applicationCategory: "MultimediaApplication", operatingSystem: "Web", url: canonical(page), description: c.description, publisher: { "@id": `${BASE}/#organization` } });
  }
  if (page.type === "index" && payload.cards) graph.push({ "@type": "ItemList", itemListElement: payload.cards.map((card, index) => ({ "@type": "ListItem", position: index + 1, url: `${BASE}${card.href}` })) });
  if (page.type === "glossary") graph.push({ "@type": "DefinedTermSet", "@id": `${canonical(page)}#terms`, name: c.h1, description: c.description,
    hasDefinedTerm: payload.entries.map((entry) => ({ "@type": "DefinedTerm", name: entry.term, termCode: entry.term.toLowerCase().replace(/[^a-z0-9]+/g, "-"), description: entry.definition })) });
  if (payload.faq?.length) graph.push({ "@type": "FAQPage", mainEntity: payload.faq.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) });
  return { "@context": "https://schema.org", "@graph": graph };
}

function livePageTypeFor(page) {
  if (page.id === "home") return { pageType: "home", templateKey: "home" };
  if (page.type === "pricing") return { pageType: "pricing", templateKey: "page" };
  if (page.type === "article") return page.section === "blog" ? { pageType: "article", templateKey: "blog-detail" } : { pageType: "content", templateKey: "aidreamcapes-v2" };
  if (page.id === "blog") return { pageType: "blog", templateKey: "blog" };
  if (page.url.startsWith("/ai-video-generation/") || page.url.startsWith("/ai-image-generation/")) return { pageType: "ai_tool", templateKey: "tool-detail" };
  return { pageType: "content", templateKey: "aidreamcapes-v2" };
}

export function buildSiteV2(source = loadSiteV2Source()) {
  const model = buildModel(source);
  const pages = model.pages.map((page) => {
    const c = model.content[page.id];
    // The total video hub, examples gallery, and /templates directory are
    // intentionally excluded from site-wide card spread accounting.
    model.spreadEnabled = !["video-hub", "examples", "templates"].includes(page.id);
    model.currentPageId = page.id;
    model.currentPageIsTool = page.type === "tool" || page.type === "hub-tool";
    model.currentPageIsOccasion = page.type === "occasion";
    model.currentPageIsPlatform = page.type === "platform";
    model.currentPageIsCollection = page.type === "industry" || page.type === "platform" || page.type === "occasion";
    model.currentPageCardCount = 0;
    model.pageUse = new Set(plannedRefs(model, page.id));
    const heroMedia = heroMediaFor(model, page.id);
    const gallery = galleryFor(model, page.id);
    const pairs = pairsFor(model, page.id);
    const payload = { ...payloadFor(model, page), ...(heroMedia ? { heroMedia } : {}), ...(gallery ? { gallery } : {}), ...(pairs ? { pairs } : {}) };
    const ogRef = model.media.plan.pages[page.id]?.og;
    const ogBase = ogRef ? mediaImage(model, ogRef, "og") : imageRef(model, page.img, c.h1);
    const ogImage = { src: ogBase.src, alt: ogBase.alt || heroImageOf(heroMedia)?.alt || c.h1, width: ogBase.width, height: ogBase.height };
    // Every public page is indexable; a page that is not ready is fixed or left out of the site, never hidden with noindex.
    assert.ok(!("noindex" in page), `${page.id}: public pages may not be noindex`);
    const robots = { index: true, follow: true, maxImagePreview: "large" };
    const seo = {
      title: c.title, description: c.description, keywords: (c.secondary_keywords || []).join(", "), primaryKeyword: page.primary_keyword,
      canonicalPath: page.url, canonical: canonical(page), robots, index: true,
      ogImage: ogImage.src, ogImageAlt: ogImage.alt, twitterDescription: c.description,
      jsonLd: jsonLdFor(model, page, c, payload, ogImage)
    };
    const media = [];
    const pushMedia = (ref) => { if (ref?.src && ref.alt && !media.some((item) => item.src === ref.src)) media.push({ src: ref.src, alt: ref.alt, width: ref.width, height: ref.height }); };
    // The sitemap lists these images, so only images that are visible on the page belong here.
    if (heroMedia) {
      pushMedia(heroImageOf(heroMedia));
      if (heroMedia.kind === "pair") pushMedia(heroMedia.before);
    } else if (page.type === "home") {
      pushMedia(ogImage);
    }
    for (const image of gallery?.images ?? []) pushMedia(image);
    for (const pair of pairs ?? []) { pushMedia(pair.after); pushMedia(pair.before); }
    // Card images are visible content too, including the page-specific case cards.
    for (const list of [payload.heroCards, payload.cards, payload.more, payload.templates?.cards]) {
      for (const card of list ?? []) pushMedia(card?.image);
    }
    for (const flow of payload.flows ?? []) for (const step of flow.steps ?? []) pushMedia(step.image);
    for (const group of [...(payload.examples?.groups ?? []), ...(payload.exampleGallery?.groups ?? [])]) for (const item of group.items ?? []) pushMedia(item.image);
    for (const item of [...(payload.items ?? []), ...(payload.articles ?? [])]) pushMedia(item?.image);
    for (const image of visualPayloadImages(payload.visual)) pushMedia({ src: image.src, alt: image.alt, width: image.w, height: image.h });
    if (guideReplacesHero(page, payload)) {
      const shown = new Set([...renderedImages(layoutFor(page), payload), ...visualPayloadImages(payload.visual).map((image) => image.src)]);
      media.splice(0, media.length, ...media.filter((item) => shown.has(item.src)));
    }
    if (payload.visual && ["video-hub", "photo-hub", "templates", "industries", "platforms", "examples"].includes(page.id)) {
      const shown = new Set(renderedImages(layoutFor(page), payload));
      media.splice(0, media.length, ...media.filter((item) => shown.has(item.src)));
    }
    const { pageType, templateKey } = livePageTypeFor(page);
    return {
      id: page.id, slug: page.url, title: c.h1, pageType, templateKey, status: page.status,
      contentJson: {
        version: 2, pageType,
        sectionsOrder: ["v2_main"],
        sections: { v2_main: { type: "aidreamcapes_v2_page", settings: { layout: layoutFor(page), data: payload }, blocks: [] } },
        seo, mediaManifest: media,
        contentContract: { seoSource: "LivePage.contentJson", mediaSource: "LivePage.contentJson", sourceRevision: SITE_V2_SOURCE_REVISION }
      }
    };
  });
  finalizeCardOverrides(model);
  return { pages, navigation: buildNavigation(model), redirects: SITE_V2_REDIRECTS, llms: buildLlmsText(model), cardOverrideErrors: model.cardOverrideErrors };
}

function buildNavigation(model) {
  const link = (id, extra = {}) => ({ label: model.byId[id].label, href: model.byId[id].url, ...extra });
  const tool = (id) => link(id, { description: TOOL_DESC[id], image: toolPicture(model, id).src });
  const popular = (keys) => keys.map((key) => ({ label: model.cardByKey[key].name, href: model.byId[model.cardByKey[key].pageId].url, image: img(model.cardByKey[key].img) }));
  const group = (label, ids) => ({ label, items: ids.map((id) => link(id)) });
  const tplFirst = model.cards.filter((card) => card.pageId.startsWith("tpl-")).slice(0, 10).map((card) => card.pageId);
  return {
    version: 2,
    menus: [
      { label: "Video", groups: [{ label: "Make a video", items: VIDEO_TOOLS.map(tool) }], popular: popular(["unbox", "ba", "beauty"]), footerLink: { label: "Browse all video templates →", href: "/templates?type=video" } },
      { label: "Photo", groups: [{ label: "Make photos", items: PHOTO_TOOLS.map(tool) }], popular: popular(["size", "color", "box"]), footerLink: { label: "Browse all photo templates →", href: "/templates?type=photo" } },
      { label: "Templates", groups: [group("By industry", Object.keys(model.ind).map((slug) => `ind-${slug}`)), group("By platform", Object.keys(model.plat).map((slug) => `plat-${slug}`)), group("By occasion", Object.keys(model.occ).map((slug) => `occ-${slug}`))], footerLink: { label: `See all ${model.cards.length} templates →`, href: "/templates" } },
      { label: "Resources", groups: [group("Learn and get help", ["examples", "guides", "blog", "faq", "glossary", "contact"])] }
    ],
    links: [{ label: "Pricing", href: "/pricing" }],
    actions: { login: { label: "Log in", href: "/login" }, getStarted: { label: "Get started", href: "/app/create" } },
    footer: {
      tagline: "AI video ads and product photos for online stores.",
      groups: [
        group("Video", ["video-hub", ...VIDEO_TOOLS]),
        group("Photo", PHOTO_TOOLS),
        group("Templates", [...tplFirst, "templates"]),
        group("Industries", [...Object.keys(model.ind).map((slug) => `ind-${slug}`), "industries"]),
        group("Platforms & help", [...Object.keys(model.plat).map((slug) => `plat-${slug}`), "pricing", "faq", "glossary", "contact", "about", "trust", "ai-info", "blog", "guides"])
      ],
      legal: [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Refunds", href: "/refunds" }, { label: "Cookies", href: "/cookies" }],
      copyright: "© 2026 AIVideosUGC. All rights reserved."
    }
  };
}

function buildLlmsText(model) {
  const c = model.content["ai-info"];
  const lines = [
    "# AIVideosUGC", "", `> ${c.summary}`, "",
    ...c.facts.map(([k, v]) => `- ${k}: ${v}`), "",
    "## Not offered", ...c.not_offered.map((item) => `- ${item}`), "",
    "## Main pages",
    ...["video-hub", "photo-hub", ...VIDEO_TOOLS, ...PHOTO_TOOLS.slice(1), "templates", "pricing", "faq", "trust", "ai-info"].map((id) => `- [${model.byId[id].label}](${canonical(model.byId[id])}): ${model.content[id].description}`)
  ];
  return lines.join("\n") + "\n";
}

const BANNED = [
  [/\bbulk\b|(?<![-\w])batch(?![-\w])|auto(matically)? (rank|publish)|\bAPI\b(?! is not)/i, "batch/auto/API claim"],
  [/voice-?over(?!, lip| or)|lip[- ]?sync(?! or)|text[- ]to[- ]speech/i, "voice claim"],
  [/\bsilent\b|visual[- ]only|no audio|without sound|\bin silence\b|visual[- ]clip only|without (?:audio|sound)|once without\b|\bquiet (?:product )?footage\b/i, "audio omission wording"],
  [/\b(?:ad|ads|product|listing|offer|launch|sale|promo|marketing|editable|headline|campaign|banner|story)\s+copy\b|\bcopy[- ](?:zone|space|area|block|room|slot)\b|\bcopywriting\b/i, "internal copy wording"],
  [/exactly what arrives|same table, light, and angle|look the way it does in person|real-looking person|\breal space\b|most marketplaces|from any shot|\bthe same day\b/i, "unsupported result claim"],
  [/\b\d+x\b(?! (lens|zoom))|\d+% (more|cheaper|higher|faster|lower)|#1\b|trusted by|thousands of|best-in-class/i, "unprovable claim"],
  [/\btheme\b|\bworkflow\b|\bSEO\b|landing page|proof moment|for AI assistants|search engines|real content job/i, "internal wording"]
];
const PUBLIC_ENRICHMENT_BANNED = [
  [/\bsilent\b/i, "banned silent wording"],
  [/visual-only/i, "banned visual-only wording"],
  [/no audio/i, "banned no-audio wording"],
  [/without sound/i, "banned without-sound wording"],
  [/\bworkbench\b/i, "banned workbench wording"]
];

// The pictures a page actually shows, in the order its layout draws them (mirrors the layouts in
// src/components/storefront/aidreamcapes-v2/page.tsx). Used to make sure no picture appears twice on a page.
function visualPayloadImages(visual) {
  if (!visual) return [];
  const images = [...(visual.strip ?? []), visual.steps?.source, visual.steps?.result];
  for (const card of visual.picker?.cards ?? []) images.push(card.image);
  for (const item of visual.uses ?? []) images.push(item.image, item.imageB);
  for (const item of visual.input ?? []) images.push(item.good, item.bad);
  for (const item of visual.outputs ?? []) images.push(item.image);
  if (visual.after?.image) images.push(visual.after.image);
  for (const item of visual.sizes ?? []) images.push(item.image);
  return images.filter((image) => image?.src);
}

export function renderedImages(layout, data) {
  const out = [];
  const add = (image) => { if (image?.src) out.push(image.src); };
  const addMedia = (media) => {
    if (!media) return false;
    if (media.kind === "pair") { add(media.before); add(media.after); }
    else if (media.kind === "image") add(media.image);
    else if (media.kind === "video") add(media.video.poster);
    else if (media.kind === "loop") { add(media.video.poster); add(media.inset); }
    return true;
  };
  const addCards = (list) => (list ?? []).forEach((card) => add(card.image));
  const addTools = (list) => (list ?? []).forEach((tool) => add(tool.image));
  const addGallery = () => (data.gallery?.images ?? []).forEach(add);
  const addPairs = () => (data.pairs ?? []).forEach((pair) => { add(pair.before); add(pair.after); });
  const addFlows = (flows) => (flows ?? []).forEach((flow) => flow.steps.forEach((step) => add(step.image)));
  const addExamples = (examples = data.examples) => (examples?.groups ?? []).forEach((group) => (group.items ?? []).forEach((item) => add(item.image)));
  if (layout === "home") {
    add(data.hero.image);
    if (!addMedia(data.heroMedia)) { add(data.hero.output); (data.hero.versions ?? []).forEach(add); }
    addTools(data.make.video); addTools(data.make.photo); addCards(data.templates.cards); addFlows(data.examples.flows); addExamples(data.exampleGallery);
  } else if (layout === "video-hub") {
    if (!data.visual) { addCards(data.heroCards); addTools(data.tools); addCards(data.cards); addExamples(); }
    else addCards((data.heroCards ?? []).filter((card) => !(data.visual.picker?.cards ?? []).some((pick) => pick.image.src === card.image?.src)));
  }
  else if (layout === "tool") {
    if (data.id === "photo-hub" && data.visual) addCards(data.hero?.cards);
    else {
      if (!addMedia(data.heroMedia)) { if (data.hero?.single) add(data.hero.single); else addCards(data.hero?.cards); }
      addGallery(); addPairs(); addTools(data.photoTools); addCards(data.templates); addTools(data.siblings); addExamples();
    }
  } else if (layout === "template") {
    if (!data.visual) { if (!addMedia(data.heroMedia)) add(data.image); addGallery(); addCards(data.more); addExamples(); }
    else { addCards(data.more); addExamples(); }
  } else if (layout === "collection") {
    if (!data.visual) { if (!addMedia(data.heroMedia)) addCards(data.heroCards); addGallery(); addCards(data.cards); addTools(data.tools); addExamples(); }
    else { addCards(data.cards); addTools(data.tools); addExamples(); }
  }
  else if (layout === "index") { addCards(data.cards); (data.items ?? []).forEach((item) => add(item.image)); (data.articles ?? []).forEach((article) => add(article.image)); }
  else if (layout === "article") add(data.image);
  else if (layout === "examples") { addFlows(data.flows); if (!data.visual) { addPairs(); addCards(data.cards); addExamples(); } }
  else add(data.image);
  for (const image of visualPayloadImages(data.visual)) add(image);
  return out;
}

const REUSE_PAGE_TYPES = new Set(["tool", "hub-tool", "template", "industry", "platform", "occasion", "article"]);

export function reusePageType(type) {
  if (type === "tool" || type === "hub-tool") return "tool";
  return REUSE_PAGE_TYPES.has(type) ? type : null;
}

function linkCardsForReuse(layout, data) {
  const cards = [];
  const addCards = (items) => {
    for (const card of items ?? []) {
      if (card?.href && card?.image?.src && (card.key || card.cardType === "case")) cards.push(card);
    }
  };
  const addExampleGroups = (examples) => {
    for (const group of examples?.groups ?? []) addCards(group.items);
  };

  if (layout === "home") {
    addCards(data.templates?.cards);
    addExampleGroups(data.exampleGallery);
  } else if (layout === "video-hub") {
    addCards(data.heroCards);
    addCards(data.cards);
    addExampleGroups(data.examples);
  } else if (layout === "tool") {
    addCards(data.templates);
    addExampleGroups(data.examples);
  } else if (layout === "template") {
    addCards(data.more);
    addExampleGroups(data.examples);
  } else if (layout === "collection") {
    if (!data.visual) addCards(data.heroCards);
    addCards(data.cards);
    addExampleGroups(data.examples);
  } else if (layout === "index" || layout === "examples") {
    addCards(data.cards);
    addExampleGroups(data.examples);
    // Guides and blog list their articles with each article's own card image.
    for (const article of data.articles ?? []) {
      if (article?.href && article?.image?.src) cards.push(article);
    }
  }
  return cards;
}

export function analyzeSiteV2ImageReuse(build, source = loadSiteV2Source()) {
  const masterById = new Map(source.master.pages.map((page) => [page.id, page]));
  const buildByUrl = new Map(build.pages.map((page) => [page.slug, page]));
  const pageById = new Map(build.pages.map((page) => [page.id, page]));
  const renderedByPage = new Map();
  const actualPagesByImage = new Map();
  const countedPagesByImage = new Map();
  const targetCardExceptions = [];

  const addPage = (map, base, pageId) => {
    const pages = map.get(base) ?? new Set();
    pages.add(pageId);
    map.set(base, pages);
  };

  for (const page of build.pages) {
    const { layout, data } = page.contentJson.sections.v2_main.settings;
    const rendered = renderedImages(layout, data);
    const renderedSources = new Set(rendered);
    // renderedImages currently includes visualPayloadImages. Keep the explicit visual pass
    // as a guard against a future layout renderer omitting a visual module, without counting
    // the same source twice when both helpers return it.
    const visualOnly = visualPayloadImages(data.visual).map((image) => image.src).filter((src) => !renderedSources.has(src));
    const sources = [...rendered, ...visualOnly];
    const sourceCounts = new Map();
    for (const src of sources) {
      const base = imageBase(src);
      sourceCounts.set(base, (sourceCounts.get(base) ?? 0) + 1);
      addPage(actualPagesByImage, base, page.id);
    }
    renderedByPage.set(page.id, { layout, data, sources, sourceCounts });
  }

  for (const page of build.pages) {
    const rendered = renderedByPage.get(page.id);
    const targetsByImage = new Map();
    const targetCardCounts = new Map();
    for (const card of linkCardsForReuse(rendered.layout, rendered.data)) {
      const target = buildByUrl.get(card.href);
      if (!target || target.id === page.id) continue;
      const targetData = target.contentJson.sections.v2_main.settings.data;
      const representative = heroImageOf(targetData.heroMedia) ?? targetData.image ?? targetData.hero?.image;
      if (!representative?.src) continue;
      const base = imageBase(card.image.src);
      if (base !== imageBase(representative.src)) continue;
      const targets = targetsByImage.get(base) ?? new Set();
      targets.add(target.id);
      targetsByImage.set(base, targets);
      targetCardCounts.set(base, (targetCardCounts.get(base) ?? 0) + 1);
      targetCardExceptions.push({ image: base, sourcePage: page.id, targetPage: target.id });
    }

    for (const [base, count] of rendered.sourceCounts) {
      const targets = targetsByImage.get(base) ?? new Set();
      const targetCardCount = targetCardCounts.get(base) ?? 0;
      if (count > targetCardCount) addPage(countedPagesByImage, base, page.id);
      for (const targetId of targets) addPage(countedPagesByImage, base, targetId);
    }
  }

  // Each image belongs to one page. The only exception is a link card that shows the page it
  // links to with that page's own main image, which is counted for the target page above.
  const violations = [];
  for (const [image, pages] of countedPagesByImage) {
    if (pages.size > 1) violations.push({ image, rule: "one-page", pages: [...pages].sort() });
  }
  violations.sort((a, b) => a.image.localeCompare(b.image) || a.rule.localeCompare(b.rule) || (a.pageType ?? "").localeCompare(b.pageType ?? ""));

  const samePageDuplicates = [];
  for (const page of build.pages) {
    const { layout, data } = page.contentJson.sections.v2_main.settings;
    const imageCounts = new Map();
    const stripCounts = new Map();
    for (const image of data.visual?.strip ?? []) {
      const key = imageBase(image.src);
      stripCounts.set(key, (stripCounts.get(key) ?? 0) + 1);
    }
    const allowedVisualRepeats = new Set();
    for (const image of [data.visual?.steps?.source, data.visual?.steps?.result]) {
      if (!image?.src) continue;
      const key = imageBase(image.src);
      if (stripCounts.get(key) === 1) allowedVisualRepeats.add(key);
    }
    for (const item of data.visual?.input ?? []) {
      const good = item?.good?.src;
      const bad = item?.bad?.src;
      if (item?.darkened && good && bad && imageBase(good) === imageBase(bad)) allowedVisualRepeats.add(imageBase(good));
    }
    for (const src of renderedImages(layout, data)) {
      const key = imageBase(src);
      imageCounts.set(key, (imageCounts.get(key) ?? 0) + 1);
    }
    for (const [image, count] of imageCounts) {
      if (count > 1 && !(count === 2 && allowedVisualRepeats.has(image))) {
        samePageDuplicates.push({ image, rule: "same-page-repeat", pages: [page.id] });
      }
    }
  }

  return { violations, samePageDuplicates, actualPagesByImage, countedPagesByImage, targetCardExceptions, pageById, masterById };
}

function imageReuseViolationKey(violation) {
  return JSON.stringify([violation.image, violation.rule, violation.pageType ?? ""]);
}

export function validateSiteV2(build = buildSiteV2()) {
  const errors = [];
  const seen = { title: new Map(), description: new Map(), h1: new Map(), slug: new Map() };
  const validationSource = loadSiteV2Source();
  const technicalKeys = new Set(["href", "src", "srcset", "sizes", "key", "kind", "industries", "platforms", "id", "section", "tool_id", "mediaref", "ref", "url", "width", "height", "duration", "uploaddate", "w", "h"]);
  const publicText = (value, key = "") => {
    if (typeof value === "string") return [value];
    if (Array.isArray(value)) return value.flatMap((item) => publicText(item));
    if (!value || typeof value !== "object" || technicalKeys.has(key.toLowerCase())) return [];
    return Object.entries(value).flatMap(([childKey, child]) => publicText(child, childKey));
  };
  const storyFramingBanned = /full[- ]screen|\bvertical\b|9:16/i;
  const photoPromptFramingBanned = /full[- ]screen|\bvertical\b|9:16|\bportrait\b/i;
  for (const page of validationSource.master.pages.filter((item) => item.type === "template" && item.group === "photo")) {
    const key = page.id.slice(4);
    const prompt = TEMPLATE_PROMPTS[key];
    if (prompt && photoPromptFramingBanned.test(prompt)) errors.push(`${page.id}: photo template prompt uses video framing wording (${prompt})`);
  }
  const searchParamsForHref = (href) => {
    const query = String(href ?? "").split("?")[1]?.split("#")[0] ?? "";
    return new URLSearchParams(query);
  };
  const checkCaseHref = (pageId, card, video, label) => {
    const params = searchParamsForHref(card.href);
    if (video) {
      if (params.get("tool_id") === "image_generator") errors.push(`${pageId}: video card link uses image_generator (${label})`);
      const size = params.get("size");
      if (size && !VIDEO_SIZES.includes(size)) errors.push(`${pageId}: video card link has unsupported size ${size} (${label})`);
    } else if (params.get("tool_id") !== "image_generator" || !params.get("prompt")?.trim()) {
      errors.push(`${pageId}: photo card link must include image_generator and a prompt (${label})`);
    }
  };
  const checkPhotoCardLines = (value, pageId) => {
    if (Array.isArray(value)) return value.forEach((item) => checkPhotoCardLines(item, pageId));
    if (!value || typeof value !== "object") return;
    if (value.kind === "photo" && typeof value.line === "string" && storyFramingBanned.test(value.line)) {
      errors.push(`${pageId}: photo card line uses story framing wording (${value.line})`);
    }
    for (const item of Object.values(value)) checkPhotoCardLines(item, pageId);
  };
  const glossaryAnchor = (term) => term.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const wordCount = (value) => String(value ?? "").trim().split(/\s+/u).filter(Boolean).length;
  const validateVisual = (pageId, layout, data, source) => {
    if (!source.visual) return;
    const visual = data.visual;
    if (!visual) { errors.push(`${pageId}: visual data was not compiled`); return; }
    const isHub = ["video-hub", "photo-hub"].includes(pageId);
    const isDirectory = ["templates", "industries", "platforms", "examples"].includes(pageId);
    if (!( ["home", "tool", "template", "collection", "video-hub", "index", "examples"].includes(layout))) errors.push(`${pageId}: visual is not supported on this layout`);
    if (visual.strip.length < 6 || visual.strip.length > 8) errors.push(`${pageId}: visual strip must contain 6-8 images`);
    if (!isDirectory && (!Array.isArray(visual.steps?.items) || visual.steps.items.length !== 3)) errors.push(`${pageId}: visual steps must contain three copy rows`);
    else for (const [index, item] of (visual.steps?.items ?? []).entries()) if (wordCount(item.d) > 25) errors.push(`${pageId}: visual step ${index + 1} description exceeds 25 words`);
    const chips = visual.picker?.chips ?? [];
    const cards = visual.picker?.cards ?? [];
    const minChips = isHub || isDirectory ? 2 : 4;
    const maxChips = isHub ? 3 : pageId === "templates" ? 16 : 8;
    if (chips.length < minChips || chips.length > maxChips) errors.push(`${pageId}: visual picker must contain ${minChips}-${maxChips} filters`);
    if (!isDirectory && (cards.length < (isHub ? 5 : 8) || cards.length > 16)) errors.push(`${pageId}: visual picker card count is outside the page range`);
    if ((!isDirectory && !visual.picker?.title?.trim()) || (!isDirectory && !visual.picker?.button?.trim())) errors.push(`${pageId}: visual picker title and required button are missing`);
    if (new Set(chips.map((chip) => chip.id)).size !== chips.length) errors.push(`${pageId}: visual picker filter ids must be unique`);
    const filterCount = (id) => {
      if (pageId === "templates") return data.cards.filter((card) => card.filterTags?.includes(id)).length;
      if (pageId === "industries" || pageId === "platforms") return data.items.filter((item) => item.filterTags?.includes(id)).length;
      if (pageId === "examples") return data.flows.filter((flow) => flow.filterTags?.includes(id)).length;
      return cards.filter((card) => card.chips.includes(id)).length;
    };
    for (const chip of chips) if (filterCount(chip.id) < 2) errors.push(`${pageId}: filter ${chip.id} has too few matching cards`);
    for (const card of cards) {
      const labelWords = wordCount(card.label);
      if (labelWords < 2 || labelWords > 6) errors.push(`${pageId}: visual picker card labels must contain 2-6 words (${card.label})`);
      if (!card.chips.length || card.chips.some((id) => !chips.some((chip) => chip.id === id))) errors.push(`${pageId}: visual picker card has an unknown or missing filter (${card.label})`);
      if (card.tool) {
        const target = validationSource.master.pages.find((page) => page.id === card.tool);
        if (!isHub || !target || card.href !== target.url) errors.push(`${pageId}: tool card does not link to its matching tool page (${card.label})`);
        if (pageId === "video-hub" && !VIDEO_TOOLS.includes(card.tool)) errors.push(`${pageId}: card links to a non-video tool (${card.tool})`);
        if (pageId === "photo-hub" && !PHOTO_TOOLS.slice(1).includes(card.tool)) errors.push(`${pageId}: card links to a non-photo tool (${card.tool})`);
        continue;
      }
      const params = searchParamsForHref(card.href);
      if (card.kind === "photo") {
        if (params.get("tool_id") !== "image_generator" || !params.get("prompt")?.trim()) errors.push(`${pageId}: photo picker link must use image_generator and include a prompt (${card.label})`);
      } else {
        const expectedSize = videoSizeForDimensions(card.image.w, card.image.h);
        if (params.get("tool_id") === "image_generator") errors.push(`${pageId}: video picker link uses image_generator (${card.label})`);
        if (!expectedSize || params.get("size") !== expectedSize) errors.push(`${pageId}: video picker link must use the card's supported frame (${card.label})`);
      }
    }
    if (!isDirectory && (visual.uses.length < 2 || visual.uses.length > 4)) errors.push(`${pageId}: visual uses must contain 2-4 rows`);
    if (!isDirectory && (visual.input.length < 2 || visual.input.length > 4)) errors.push(`${pageId}: visual input guide must contain 2-4 pairs`);
    for (const item of visual.input ?? []) {
      if (imageBase(item.good.src) === imageBase(item.bad.src) && !item.darkened) errors.push(`${pageId}: visual input good and bad photos must differ unless the bad image is intentionally darkened`);
      for (const label of [item.good_label, item.bad_label]) if (wordCount(label) < 3 || wordCount(label) > 12) errors.push(`${pageId}: visual input labels must contain 3-12 words (${label})`);
    }
    if (visual.steps && !(visual.steps.mode === "photo" || visual.steps.mode === "video")) errors.push(`${pageId}: visual steps need a photo or video mode`);
    if (visual.steps?.sourceTitle != null && (typeof visual.steps.sourceTitle !== "string" || !visual.steps.sourceTitle.trim() || visual.steps.sourceTitle.length > 60)) errors.push(`${pageId}: visual source title must be a non-empty string of at most 60 characters`);
    if (visual.steps?.sourceHint != null && (typeof visual.steps.sourceHint !== "string" || !visual.steps.sourceHint.trim() || visual.steps.sourceHint.length > 100)) errors.push(`${pageId}: visual source hint must be a non-empty string of at most 100 characters`);
    if (visual.steps && (typeof visual.steps.prompt !== "string" || !visual.steps.prompt.trim())) errors.push(`${pageId}: visual steps need an example prompt`);
    if (!isDirectory && (visual.outputs.length < 2 || visual.outputs.length > 4)) errors.push(`${pageId}: visual outputs must contain 2-4 cards`);
    if (isHub && !visual.after) errors.push(`${pageId}: visual hub must show the after-download module`);
    if (pageId === "video-hub" && visual.strip.some((item) => item.kind !== "video" || Math.abs(item.w / item.h - 9 / 16) > 0.04)) errors.push(`${pageId}: overview strip must use actual 9:16 video frames`);
    if (pageId === "home" && (!visual.sizes || visual.sizes.length < 3 || visual.sizes.length > 4)) errors.push(`${pageId}: home visual sizes must contain 3-4 frames`);
    if (layout === "collection" && data.kind === "platform" && (!visual.sizes || visual.sizes.length < 3 || visual.sizes.length > 4)) errors.push(`${pageId}: platform visual sizes must contain 3-4 frames`);
    if (visual.sizes?.length && !(layout === "home" || (layout === "collection" && data.kind === "platform"))) errors.push(`${pageId}: visual sizes are only supported on home and platform pages`);
    if (["template", "collection"].includes(layout)) {
      const allowedFrames = new Set(["1:1", "9:16", "16:9"]);
      for (const item of visual.outputs) if (!allowedFrames.has(item.frame)) errors.push(`${pageId}: visual output frame must be Square, 9:16 or 16:9 (${item.frame})`);
      for (const item of visual.sizes ?? []) if (!allowedFrames.has(item.frame)) errors.push(`${pageId}: visual size frame must be Square, 9:16 or 16:9 (${item.frame})`);
    }
    if (visual.after && (visual.after.items.length < 2 || visual.after.items.length > 3)) errors.push(`${pageId}: visual after-download list must contain 2-3 items`);
    if (visual.limitations.items.length > 5) errors.push(`${pageId}: visual limitations must contain at most five items`);
    for (const item of visual.limitations.items) if (wordCount(item.label) > 12) errors.push(`${pageId}: visual limitation exceeds 12 words (${item.label})`);
    if (wordCount(visual.overview) > 120) errors.push(`${pageId}: visual overview exceeds 120 words`);
    const imageRows = visualPayloadImages(visual);
    const publicRoot = path.resolve(process.cwd(), "public");
    for (const image of imageRows) {
      if (!image.src.startsWith("/assets/sites/site_aidreamcapes/")) errors.push(`${pageId}: visual image is outside the Aidreamcapes asset folder (${image.src})`);
      if (!image.alt || image.alt.trim().length < 12) errors.push(`${pageId}: visual image alt is missing or too short (${image.src})`);
      if (!(Number(image.w) > 0) || !(Number(image.h) > 0)) errors.push(`${pageId}: visual image dimensions are invalid (${image.src})`);
      const filePath = path.resolve(publicRoot, image.src.replace(/^\/+/, "").split(/[?#]/)[0]);
      if (!filePath.startsWith(`${publicRoot}${path.sep}`) || !fs.existsSync(filePath)) errors.push(`${pageId}: visual image file is missing from public (${image.src})`);
    }
    const hasExamples = Boolean(data.gallery?.images?.length || data.pairs?.length || data.exampleGallery?.groups?.length || data.examples?.flows?.length || data.examples?.groups?.length);
    let contentSections;
    let imageSections;
    if (isHub) {
      const modules = [
        { present: visual.strip.length > 0, hasImage: visual.strip.length > 0 },
        { present: Boolean(visual.steps), hasImage: Boolean(visual.steps?.source && visual.steps?.result) },
        { present: cards.length > 0, hasImage: cards.some((card) => card.image?.src) },
        { present: visual.uses.length > 0, hasImage: visual.uses.some((item) => item.image?.src) },
        { present: visual.input.length > 0, hasImage: visual.input.some((item) => item.good?.src && item.bad?.src) },
        { present: visual.outputs.length > 0, hasImage: visual.outputs.some((item) => item.image?.src) },
        { present: Boolean(visual.after), hasImage: Boolean(visual.after?.image?.src) }
      ].filter((module) => module.present);
      contentSections = modules.length;
      imageSections = modules.filter((module) => module.hasImage).length;
    } else if (isDirectory) {
      const directoryCards = pageId === "templates" ? data.cards : pageId === "examples" ? data.flows : data.items;
      const modules = [
        { present: visual.strip.length > 0, hasImage: visual.strip.length > 0 },
        { present: Boolean(visual.steps), hasImage: Boolean(visual.steps?.source && visual.steps?.result) },
        { present: Boolean(directoryCards?.length), hasImage: Boolean(directoryCards?.some((item) => item.image?.src || item.steps?.some((step) => step.image?.src) || item.media?.src || item.video?.src)) }
      ].filter((module) => module.present);
      contentSections = modules.length;
      imageSections = modules.filter((module) => module.hasImage).length;
    } else if (layout === "home") {
      const homeSections = [
        Boolean(data.make?.video?.length || data.make?.photo?.length),
        Boolean(visual.steps?.items?.length), cards.length > 0, Boolean(visual.sizes?.length),
        visual.input.length > 0, visual.outputs.length > 0, hasExamples,
        visual.uses.length > 0, Boolean(data.templates?.cards?.length), Boolean(data.compare?.length)
      ];
      contentSections = homeSections.filter(Boolean).length;
      imageSections = contentSections - (data.compare?.length ? 1 : 0);
    } else if (["template", "collection"].includes(layout)) {
      const preservedSections = [layout === "template" ? Boolean(data.more?.length) : Boolean(data.cards?.length), Boolean(data.examples?.groups?.length)].filter(Boolean).length;
      const moduleSections = [visual.strip.length > 0, Boolean(visual.steps?.items?.length), cards.length > 0, visual.uses.length > 0, visual.input.length > 0,
        visual.outputs.length > 0, Boolean(visual.after), Boolean(visual.sizes?.length)].filter(Boolean).length;
      const planSection = layout === "collection" && data.kind === "occasion" && data.plan?.length ? 1 : 0;
      contentSections = moduleSections + preservedSections + planSection;
      imageSections = moduleSections + preservedSections;
    } else {
      const moduleSections = [visual.strip.length > 0, Boolean(visual.steps?.items?.length), cards.length > 0, visual.uses.length > 0, visual.input.length > 0,
        visual.outputs.length > 0, Boolean(visual.after), Boolean(visual.sizes?.length)].filter(Boolean).length;
      const overviewSection = visual.overview ? 1 : 0;
      contentSections = moduleSections + overviewSection + (visual.limitations.items.length ? 1 : 0) + (hasExamples ? 1 : 0);
      imageSections = moduleSections + (hasExamples ? 1 : 0);
    }
    if (contentSections > 10) errors.push(`${pageId}: visual page has ${contentSections} content sections (maximum 10)`);
    if (contentSections && imageSections / contentSections < 0.8) errors.push(`${pageId}: only ${Math.round(imageSections / contentSections * 100)}% of visual content sections contain images`);
  };
  for (const page of build.pages) {
    const seo = page.contentJson.seo;
    if (seo.index !== true || seo.robots?.index !== true) errors.push(`${page.id}: noindex is not allowed on public pages`);
    if (seo.title.length > 60) errors.push(`${page.id}: title ${seo.title.length} > 60`);
    if (seo.description.length < 120 || seo.description.length > 160) errors.push(`${page.id}: description ${seo.description.length} not in 120-160`);
    for (const [key, value] of [["title", seo.title], ["description", seo.description], ["h1", page.title], ["slug", page.slug]]) {
      const norm = value.toLowerCase();
      if (seen[key].has(norm)) errors.push(`${page.id}: duplicate ${key} with ${seen[key].get(norm)}`);
      seen[key].set(norm, page.id);
    }
    const data = page.contentJson.sections.v2_main.settings.data;
    validateVisual(page.id, page.contentJson.sections.v2_main.settings.layout, data, validationSource.content[page.id] ?? {});
    checkPhotoCardLines(data, page.id);
    const checkCaseLinks = (value) => {
      if (Array.isArray(value)) return value.forEach(checkCaseLinks);
      if (!value || typeof value !== "object") return;
      if (value.cardType === "case" && typeof value.href === "string") {
        checkCaseHref(page.id, value, value.kind === "video" || value.label === "Example scene", value.key ?? "case card");
      } else if (["clip", "scene", "photo"].includes(value.kind) && typeof value.href === "string" && typeof value.mediaRef === "string") {
        checkCaseHref(page.id, value, value.kind === "clip" || value.kind === "scene", value.key ?? "example");
      }
      Object.values(value).forEach(checkCaseLinks);
    };
    checkCaseLinks(data);
    const pageMeta = validationSource.master.pages.find((item) => item.id === page.id);
    if ((pageMeta?.type === "tool" || pageMeta?.type === "hub-tool" || pageMeta?.type === "template") && pageMeta?.group === "video") {
      const maker = data.maker;
      const displayed = firstVideoSize(maker?.options?.find(([label]) => String(label).toLowerCase() === "size")?.[1]) ?? firstVideoSize(pageMeta.output);
      const buttonSize = searchParamsForHref(maker?.href).get("size");
      if (!displayed || !VIDEO_SIZES.includes(displayed)) errors.push(`${page.id}: video maker has no supported displayed Size`);
      else if (buttonSize !== displayed) errors.push(`${page.id}: video maker size ${buttonSize ?? "(missing)"} does not match displayed Size ${displayed}`);
    }
    if (page.id === "tpl-story") {
      const storyMediaAlts = [];
      const collectStoryAlts = (value) => {
        if (Array.isArray(value)) return value.forEach(collectStoryAlts);
        if (!value || typeof value !== "object") return;
        if (typeof value.alt === "string") storyMediaAlts.push(value.alt);
        for (const item of Object.values(value)) collectStoryAlts(item);
      };
      collectStoryAlts(data);
      collectStoryAlts(page.contentJson.mediaManifest);
      storyMediaAlts.push(page.contentJson.seo.ogImageAlt);
      for (const alt of new Set(storyMediaAlts.filter((value) => typeof value === "string"))) {
        if (storyFramingBanned.test(alt)) errors.push(`${page.id}: media alt uses story framing wording (${alt})`);
      }
    }
    const visibleAlts = [];
    const collectVisibleAlts = (value) => {
      if (Array.isArray(value)) return value.forEach(collectVisibleAlts);
      if (!value || typeof value !== "object") return;
      if (typeof value.alt === "string") visibleAlts.push({ alt: value.alt, src: value.src, mediaRef: value.mediaRef });
      for (const item of Object.values(value)) collectVisibleAlts(item);
    };
    collectVisibleAlts(data);
    collectVisibleAlts(page.contentJson.mediaManifest);
    if (typeof seo.ogImageAlt === "string") visibleAlts.push({ alt: seo.ogImageAlt, src: seo.ogImage });
    for (const { alt, src, mediaRef } of visibleAlts) {
      if (/ example$/i.test(alt.trim())) errors.push(`${page.id}: visible image alt must not end with " example" (${mediaRef ?? src ?? alt})`);
    }
    // Keep all strings that can be rendered by the storefront, including case names,
    // product labels, specs and image alt text. Only asset references and layout metadata
    // are excluded from copy checks.
    const visible = [...publicText(data), seo.title, seo.description].join("\n");
    for (const match of visible.matchAll(INLINE_LINK)) {
      const target = match[2];
      if (isExternalUrl(target) && !isApprovedExternalUrl(target)) errors.push(`${page.id}: external link must use an approved HTTPS domain (${target})`);
    }
    for (const [rx, why] of BANNED) {
      if (page.id === "glossary" && why === "voice claim") continue;
      if (page.id === "ai-info" && why !== "internal wording") continue;
      const checkVisible = why === "voice claim"
        ? visible
          .replace(/\b(?:does not|doesn't)\s+add\b[^.!?]*\bvoice-?over\b/gi, "")
          .replace(/\b(?:without|no)\s+voice-?over\b/gi, "")
          // A voiceover mentioned as an optional edit after download is not a product capability claim.
          .replace(/\bAdd (?:captions, music, or a voiceover in TikTok, CapCut, Ads Manager, or your usual editor after download, since the generated clip doesn't include them|music, a voiceover, or captions in your editor after download)\.?/gi, "")
        : visible;
      if (rx.test(checkVisible)) errors.push(`${page.id}: ${why}`);
    }
    for (const [rx, why] of PUBLIC_ENRICHMENT_BANNED) if (rx.test(visible)) errors.push(`${page.id}: ${why}`);
    const faq = data.faq || [];
    const ld = seo.jsonLd["@graph"].find((node) => node["@type"] === "FAQPage");
    if (faq.length && (!ld || ld.mainEntity.length !== faq.length)) errors.push(`${page.id}: FAQ JSON-LD mismatch`);

    const sourceContent = validationSource.content[page.id] || {};
    if (sourceContent.overview && (!Array.isArray(data.overview) || !data.overview.length)) errors.push(`${page.id}: overview content was dropped from the public payload`);
    for (const [sourceKey, payloadKey] of [["scene_prompt_examples", "scenePromptExamples"], ["troubleshooting", "troubleshooting"], ["tool_chooser", "toolChooser"], ["limitations", "limitations"]]) {
      if (!sourceContent[sourceKey]) continue;
      const block = data[payloadKey];
      if (!block || typeof block.h2 !== "string" || !Array.isArray(block.items)) errors.push(`${page.id}: ${sourceKey} content was dropped from the public payload`);
      else for (const item of block.items) if (!item || typeof item.t !== "string" || typeof item.d !== "string") errors.push(`${page.id}: invalid ${sourceKey} item shape`);
    }
    if (Array.isArray(data.overview)) for (const section of data.overview) {
      if (!section || typeof section.h2 !== "string" || (!Array.isArray(section.paras) && !Array.isArray(section.items))) errors.push(`${page.id}: invalid overview section shape`);
    }
    if (data.fit !== undefined) {
      const fit = data.fit;
      if (!fit || typeof fit.h2 !== "string" || !Array.isArray(fit.good) || !Array.isArray(fit.not_ideal)) errors.push(`${page.id}: invalid fit block shape`);
      else for (const item of [...fit.good, ...fit.not_ideal]) if (!item || typeof item.t !== "string" || typeof item.d !== "string") errors.push(`${page.id}: invalid fit item shape`);
    }
    if (page.id === "glossary") {
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const anchors = new Map();
      const termCodes = new Map();
      for (const entry of entries) {
        if (!entry || typeof entry.term !== "string" || !entry.term.trim() || typeof entry.definition !== "string" || !entry.definition.trim()) {
          errors.push("glossary: term and definition must be non-empty strings");
          continue;
        }
        const anchor = glossaryAnchor(entry.term);
        if (anchors.has(anchor)) errors.push(`glossary: duplicate anchor ${anchor} with ${anchors.get(anchor)}`);
        else anchors.set(anchor, entry.term);
        if (termCodes.has(anchor)) errors.push(`glossary: duplicate termCode ${anchor} with ${termCodes.get(anchor)}`);
        else termCodes.set(anchor, entry.term);
      }
    }
  }
  const overrideSource = validationSource.cardOverrides ?? {};
  const overrideModel = buildModel(validationSource);
  const sourcePages = new Map(validationSource.master.pages.map((page) => [page.id, page]));
  const sourceCardKeys = new Set([
    ...validationSource.master.pages.filter((page) => page.type === "template").map((page) => page.id.slice(4)),
    ...(validationSource.master.toolcards ?? []).map(([key]) => key)
  ]);
  for (const [pageId, override] of Object.entries(overrideSource)) {
    const pageMeta = sourcePages.get(pageId);
    if (!pageMeta) errors.push(`card-overrides: unknown page ${pageId}`);
    else if (!["home", "hub", "tool", "hub-tool", "template", "industry", "platform", "occasion"].includes(pageMeta.type) && !(pageMeta.type === "index" && pageId === "templates")) errors.push(`card-overrides: page ${pageId} cannot receive card overrides`);
    if (!override || typeof override !== "object" || Array.isArray(override)) {
      errors.push(`card-overrides: invalid override for ${pageId}`);
      continue;
    }
    const swaps = override.swap ?? {};
    const imageOverrides = override.images ?? {};
    const toolImageOverrides = override.tools ?? {};
    if (!swaps || typeof swaps !== "object" || Array.isArray(swaps)) errors.push(`card-overrides: invalid swap map for ${pageId}`);
    if (!imageOverrides || typeof imageOverrides !== "object" || Array.isArray(imageOverrides)) errors.push(`card-overrides: invalid images map for ${pageId}`);
    if (!toolImageOverrides || typeof toolImageOverrides !== "object" || Array.isArray(toolImageOverrides)) errors.push(`card-overrides: invalid tools map for ${pageId}`);
    for (const [from, to] of Object.entries(swaps)) {
      if (!sourceCardKeys.has(from)) errors.push(`card-overrides: unknown card key ${from} on ${pageId}`);
      if (!sourceCardKeys.has(to)) errors.push(`card-overrides: unknown replacement card key ${to} on ${pageId}`);
    }
    for (const [key, imageOverride] of Object.entries(imageOverrides)) {
      if (!sourceCardKeys.has(key)) errors.push(`card-overrides: unknown image card key ${key} on ${pageId}`);
      if (!imageOverride || typeof imageOverride !== "object" || Array.isArray(imageOverride)) {
        errors.push(`card-overrides: invalid image override for ${pageId}.${key}`);
        continue;
      }
      if (!knownMediaRef(overrideModel, imageOverride.ref)) errors.push(`card-overrides: unknown media id ${imageOverride.ref ?? "(missing)"} on ${pageId}.${key}`);
      if (typeof imageOverride.alt !== "string" || imageOverride.alt.trim().length < 12) errors.push(`card-overrides: image alt must be a specific description for ${pageId}.${key}`);
    }
    const publicPage = build.pages.find((page) => page.id === pageId);
    if (!publicPage) continue;
    const { layout, data } = publicPage.contentJson.sections.v2_main.settings;
    const templateCards = (layout === "home" ? data.templates?.cards ?? [] : layout === "video-hub" ? [...(data.heroCards ?? []), ...(data.cards ?? [])] : layout === "tool" ? [...(pageId === "photo-hub" ? data.hero?.cards ?? [] : []), ...(data.templates ?? [])] : layout === "template" ? data.more ?? [] : layout === "collection" ? [...(data.heroCards ?? []), ...(data.cards ?? [])] : layout === "index" && pageId === "templates" ? data.cards ?? [] : []).filter((card) => card.cardType !== "case");
    const keys = templateCards.map((card) => card.key);
    if (new Set(keys).size !== keys.length) errors.push(`${pageId}: card overrides create duplicate template cards`);
    for (const [key, imageOverride] of Object.entries(imageOverrides)) {
      if (!knownMediaRef(overrideModel, imageOverride?.ref) || !templateCards.some((card) => card.key === key)) continue;
      const expected = mediaImage(overrideModel, imageOverride.ref, "card");
      const actual = templateCards.find((card) => card.key === key)?.image;
      if (!actual || imageBase(actual.src) !== imageBase(expected.src)) errors.push(`${pageId}: image override was not applied to ${key}`);
    }
    const renderedToolIds = new Set((data.tools ?? []).map((tool) => tool.id));
    for (const [toolId, imageOverride] of Object.entries(toolImageOverrides)) {
      if (!renderedToolIds.has(toolId)) errors.push(`card-overrides: tool image override ${toolId} is not rendered on ${pageId}`);
      if (!imageOverride || typeof imageOverride !== "object" || Array.isArray(imageOverride)) {
        errors.push(`card-overrides: invalid tool image override for ${pageId}.${toolId}`);
        continue;
      }
      if (!knownMediaRef(overrideModel, imageOverride.ref)) errors.push(`card-overrides: unknown tool image media id ${imageOverride.ref ?? "(missing)"} on ${pageId}.${toolId}`);
      if (typeof imageOverride.alt !== "string" || imageOverride.alt.trim().length < 12) errors.push(`card-overrides: tool image alt must be a specific description for ${pageId}.${toolId}`);
      if (!knownMediaRef(overrideModel, imageOverride.ref) || !renderedToolIds.has(toolId)) continue;
      const expected = mediaImage(overrideModel, imageOverride.ref, "inset");
      const actual = data.tools.find((tool) => tool.id === toolId)?.image;
      if (!actual || imageBase(actual.src) !== imageBase(expected.src)) errors.push(`${pageId}: tool image override was not applied to ${toolId}`);
    }
  }
  for (const pageId of ["industries", "platforms"]) {
    const imageOverrides = validationSource.content[pageId]?.visual?.directoryFilters?.itemImages ?? {};
    if (!imageOverrides || typeof imageOverrides !== "object" || Array.isArray(imageOverrides)) {
      errors.push(`${pageId}: directory item image overrides must be an object`);
      continue;
    }
    const publicPage = build.pages.find((page) => page.id === pageId);
    const items = publicPage?.contentJson.sections.v2_main.settings.data.items ?? [];
    for (const [href, ref] of Object.entries(imageOverrides)) {
      const item = items.find((candidate) => candidate.href === href);
      if (!item) errors.push(`${pageId}: directory image override does not match an item (${href})`);
      if (!knownMediaRef(overrideModel, ref)) errors.push(`${pageId}: unknown directory item image media id ${ref ?? "(missing)"} for ${href}`);
      if (!item || !knownMediaRef(overrideModel, ref)) continue;
      const expected = mediaImage(overrideModel, ref, "card");
      if (!item.image?.src || imageBase(item.image.src) !== imageBase(expected.src)) errors.push(`${pageId}: directory item image override was not applied for ${href}`);
    }
  }
  for (const message of build.cardOverrideErrors ?? []) errors.push(message);
  const imageReuse = analyzeSiteV2ImageReuse(build, validationSource);
  let baselineEntries = [];
  try {
    const baseline = readJson(path.join(DATA_DIR, "image-reuse-baseline.json"));
    if (baseline?.version !== 1 || !Array.isArray(baseline.entries)) {
      errors.push("image reuse baseline is malformed (expected version 1 and an entries array)");
    } else baselineEntries = baseline.entries;
  } catch (error) {
    errors.push(`image reuse baseline could not be read (${error.message})`);
  }
  const currentViolations = new Map(imageReuse.violations.map((item) => [imageReuseViolationKey(item), item]));
  const baselineViolations = new Map();
  for (const entry of baselineEntries) {
    if (!entry || typeof entry.image !== "string" || !["one-page"].includes(entry.rule) || !Array.isArray(entry.pages) || entry.pages.some((page) => typeof page !== "string")) {
      errors.push("image reuse baseline contains an invalid entry");
      continue;
    }
    const normalized = { image: entry.image, rule: entry.rule, ...(entry.rule === "same-page-type" ? { pageType: entry.pageType } : {}), pages: [...entry.pages].sort() };
    if (entry.rule === "same-page-type" && typeof entry.pageType !== "string") {
      errors.push(`image reuse baseline entry is missing its page type (${entry.image})`);
      continue;
    }
    const key = imageReuseViolationKey(normalized);
    if (baselineViolations.has(key)) errors.push(`image reuse baseline contains a duplicate entry (${entry.image})`);
    else baselineViolations.set(key, normalized);
  }
  // A baseline entry covers the same image and rule on the same pages or fewer of them, so taking
  // an image off a page never fails; only an image on a new page or a new image is an error.
  let baselineRemaining = 0;
  const matchedCurrentKeys = new Set();
  for (const [key, entry] of baselineViolations) {
    const sameViolation = (violation) => violation.image === entry.image
      && violation.rule === entry.rule
      && (entry.rule !== "same-page-type" || violation.pageType === entry.pageType);
    const current = currentViolations.get(key) ?? [...currentViolations.entries()]
      .find(([currentKey, violation]) => !matchedCurrentKeys.has(currentKey)
        && sameViolation(violation)
        && violation.pages.every((page) => entry.pages.includes(page)))?.[1];
    const summary = `${entry.rule}${entry.pageType ? ` (${entry.pageType})` : ""}: ${entry.image} on ${entry.pages.join(", ")}`;
    if (!current) errors.push(`image reuse baseline entry is no longer violated; remove it from image-reuse-baseline.json (${summary})`);
    else {
      matchedCurrentKeys.add(imageReuseViolationKey(current));
      baselineRemaining += 1;
    }
  }
  for (const [key, violation] of currentViolations) {
    if (matchedCurrentKeys.has(key)) continue;
    const summary = `${violation.rule}${violation.pageType ? ` (${violation.pageType})` : ""}: ${violation.image} on ${violation.pages.join(", ")}`;
    errors.push(`new image reuse violation outside baseline (${summary})`);
  }
  console.info(`Aidreamcapes image reuse baseline: ${baselineRemaining} violations remain.`);
  // Editorial metadata must never enter the public LivePage payload, even when a
  // future draft adds it beside an otherwise valid enrichment block.
  const internalKeys = new Set(["review", "media_wishlist", "facts_used", "word_count_added", "source"]);
  for (const page of build.pages) {
    const walk = (value, path = "contentJson") => {
      if (Array.isArray(value)) value.forEach((item, index) => walk(item, `${path}[${index}]`));
      else if (value && typeof value === "object") for (const [key, item] of Object.entries(value)) {
        const visualSourceImage = key.toLowerCase() === "source" && path.endsWith(".data.visual.steps") && item && typeof item.src === "string" && typeof item.alt === "string";
        if (internalKeys.has(key.toLowerCase()) && !visualSourceImage) errors.push(`${page.id}: internal field in contentJson (${path}.${key})`);
        walk(item, `${path}.${key}`);
      }
    };
    walk(page.contentJson);
  }
  // A sentence of eight or more words in a new enrichment block is page-specific
  // copy. Keep exact repeats out of the public set while allowing short labels.
  const sentencePages = new Map();
  const enrichKeys = ["overview", "inputGuide", "results", "scenePromptExamples", "troubleshooting", "toolChooser", "limitations", "sceneRecipes", "afterDownload", "fit", "compare"];
  const collectSentences = (value) => {
    const out = [];
    if (Array.isArray(value)) value.forEach((item) => out.push(...collectSentences(item)));
    else if (value && typeof value === "object") Object.values(value).forEach((item) => out.push(...collectSentences(item)));
    else if (typeof value === "string") out.push(...value.split(/[.!?]+/).map((sentence) => sentence.trim()).filter(Boolean));
    return out;
  };
  for (const page of build.pages) {
    const data = page.contentJson.sections.v2_main.settings.data;
    for (const key of enrichKeys) for (const sentence of collectSentences(data[key])) {
      const normalized = sentence.toLowerCase().replace(/\[[^\]]+\]\([^)]*\)/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
      if (normalized.split(" ").filter(Boolean).length < 8) continue;
      const pages = sentencePages.get(normalized) ?? new Set(); pages.add(page.id); sentencePages.set(normalized, pages);
    }
  }
  for (const [sentence, pages] of sentencePages) if (pages.size > 1) errors.push(`enrichment sentence repeated across pages (${[...pages].join(", ")}): ${sentence}`);
  const directorySteps = ["templates", "industries", "platforms"].map((pageId) => {
    const page = build.pages.find((candidate) => candidate.id === pageId);
    return [pageId, page?.contentJson.sections.v2_main.settings.data.visual?.steps?.items ?? []];
  });
  const directoryStepSentences = new Map();
  for (const [pageId, items] of directorySteps) for (const item of items) {
    for (const sentence of String(item.d ?? "").split(/[.!?]+/).map((value) => value.trim()).filter(Boolean)) {
      const normalized = sentence.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
      if (normalized.split(" ").filter(Boolean).length < 8) continue;
      const pages = directoryStepSentences.get(normalized) ?? new Set(); pages.add(pageId); directoryStepSentences.set(normalized, pages);
    }
  }
  for (const [sentence, pages] of directoryStepSentences) if (pages.size > 1) errors.push(`directory step sentence repeated across pages (${[...pages].join(", ")}): ${sentence}`);
  // Every public selling page with a template area gets a balanced seven-card set:
  // its existing template cards plus page-specific case cards. A case asset may be
  // sampled on two pages at most, and never twice on one page.
  const caseLayouts = new Set(["tool", "template", "collection"]);
  const caseMediaKey = (card) => card.mediaRef
    ? (modelCaseMediaKey(card.mediaRef))
    : String(card.video?.src ?? card.image?.src ?? "").replace(/-v(?=\.|--)/, "");
  const modelCaseMediaKey = (ref) => String(ref).replace(/^f:/, "").replace(/-v$/, "");
  const casePlan = validationSource.media.casePlan;
  const caseTitles = new Map();
  const caseTitlePrefixes = new Map();
  const pageMediaSeen = new Map();
  for (const page of build.pages) {
    const { layout, data } = page.contentJson.sections.v2_main.settings;
    if (!caseLayouts.has(layout)) continue;
    const cards = layout === "home" ? (data.templates?.cards ?? []) : layout === "tool" ? (data.templates ?? []) : layout === "template" ? (data.more ?? []) : layout === "collection" ? [...(data.heroCards ?? []), ...(data.cards ?? [])] : (data.cards ?? []);
    const cases = cards.filter((card) => card.cardType === "case");
    const planned = casePlan.pages?.[page.id];
    if (!Array.isArray(planned)) errors.push(`${page.id}: missing case-plan page`);
    else if (planned.length !== cases.length) errors.push(`${page.id}: case-plan has ${planned.length} rows but build has ${cases.length} cases`);
    if (cards.length < 7 || cards.length > 8) errors.push(`${page.id}: case area has ${cards.length} cards (needs 7-8)`);
    const templates = cards.length - cases.length;
    if (templates < 2 || templates > 4 || cases.length < 3 || cases.length > 6) errors.push(`${page.id}: case/template card mix is not balanced (${templates} templates, ${cases.length} cases)`);
    const seenOnPage = new Set();
    pageMediaSeen.set(page.id, seenOnPage);
    const seenProducts = new Set();
    for (const card of cases) {
      const key = caseMediaKey(card);
      if (!key) { errors.push(`${page.id}: case card has no media`); continue; }
      if (seenOnPage.has(key)) errors.push(`${page.id}: case media repeated on the page (${key})`);
      seenOnPage.add(key);
      if (!card.product || card.product !== card.product.toLowerCase()) errors.push(`${page.id}: case product must be lowercase English (${card.product || "missing"})`);
      if (seenProducts.has(card.product)) errors.push(`${page.id}: case product repeats (${card.product})`);
      seenProducts.add(card.product);
      if (!card.name || card.name.length > 60 || /^Product example/i.test(card.name) || /starting photo/i.test(card.name)) errors.push(`${page.id}: invalid case title (${card.name || "empty"})`);
      const titleNorm = String(card.name || "").toLowerCase();
      if (caseTitles.has(titleNorm)) errors.push(`${page.id}: duplicate case title with ${caseTitles.get(titleNorm)} (${card.name})`);
      else caseTitles.set(titleNorm, page.id);
      const titleWords = titleNorm.replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
      const prefix = titleWords.slice(0, 2).join(" ");
      if (prefix) {
        const count = (caseTitlePrefixes.get(prefix) ?? 0) + 1;
        caseTitlePrefixes.set(prefix, count);
        if (count > 3) errors.push(`${page.id}: case title opening is reused too often (${prefix})`);
      }
      if (card.kind !== "video" && /\b(?:clip|video|reel)\b/i.test(card.name)) errors.push(`${page.id}: photo case title uses video wording (${card.name})`);
      if (card.kind !== "video" && /full[- ]screen|\bvertical\b|9:16/i.test(card.name)) errors.push(`${page.id}: photo case title uses video framing wording (${card.name})`);
      if (card.name === card.image?.alt || card.name === card.video?.name || card.name === card.video?.description) errors.push(`${page.id}: case title copies media metadata (${card.name})`);
      if (card.mediaRef === "social-proof-animation" || card.video?.src?.includes("/social-proof-animation.mp4")) errors.push(`${page.id}: retired social-proof-animation is not allowed in case media`);
      if (card.mediaRef === "ugc-ad-video" || card.video?.src?.includes("ugc-ad-video")) errors.push(`${page.id}: ugc-ad-video is not allowed in case media`);
      if (card.kind === "video" && !validationSource.media.catalog.clips?.[card.mediaRef]) errors.push(`${page.id}: video case is missing from the clip catalog (${card.mediaRef})`);
      const expected = card.kind === "video" ? `Video · ${closestRatio(card.video.width, card.video.height)}` : "Photo";
      if (card.spec !== expected) errors.push(`${page.id}: case spec is not based on actual media dimensions (${card.name})`);
    }
  }
  // Optional example galleries share the case-card media budget and title rules. This
  // keeps a gallery from repeating its page's case cards or becoming a second loophole
  // around the site-wide media spread rules.
  for (const page of build.pages) {
    const data = page.contentJson.sections.v2_main.settings.data;
    const groups = [...(data.examples?.groups ?? []), ...(data.exampleGallery?.groups ?? [])];
    const items = groups.flatMap((group) => group.items ?? []);
    if (!items.length) continue;
    const seenOnPage = pageMediaSeen.get(page.id) ?? new Set();
    pageMediaSeen.set(page.id, seenOnPage);
    for (const item of items) {
      const key = caseMediaKey(item);
      if (!key) { errors.push(`${page.id}: example has no media`); continue; }
      if (seenOnPage.has(key)) errors.push(`${page.id}: example media repeated on the page (${key})`);
      seenOnPage.add(key);
      const title = String(item.title ?? "");
      if (!title || title.length > 60 || /^Product example/i.test(title) || /starting photo/i.test(title)) errors.push(`${page.id}: invalid example title (${title || "empty"})`);
      const titleNorm = title.toLowerCase();
      if (caseTitles.has(titleNorm)) errors.push(`${page.id}: duplicate example title with ${caseTitles.get(titleNorm)} (${title})`);
      else caseTitles.set(titleNorm, page.id);
      const titleWords = titleNorm.replace(/[^a-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean);
      const prefix = titleWords.slice(0, 2).join(" ");
      if (prefix) {
        const count = (caseTitlePrefixes.get(prefix) ?? 0) + 1;
        caseTitlePrefixes.set(prefix, count);
        if (count > 3) errors.push(`${page.id}: example title opening is reused too often (${prefix})`);
      }
      if (item.kind !== "clip" && /\b(?:clip|video|reel)\b/i.test(title)) errors.push(`${page.id}: photo example title uses video wording (${title})`);
      if (title === item.image?.alt || title === item.video?.name || title === item.video?.description) errors.push(`${page.id}: example title copies media metadata (${title})`);
      const mediaText = `${item.mediaRef ?? ""} ${item.video?.src ?? ""} ${item.image?.src ?? ""}`;
      if (/og(?:\.webp)?(?:$|[?#])/i.test(mediaText) || /source-input/i.test(mediaText) || /ugc-video-themes/i.test(mediaText) || /ugc-ad-video\.mp4/i.test(mediaText)) {
        errors.push(`${page.id}: prohibited media is not allowed in examples (${item.mediaRef || mediaText})`);
      }
      const clip = validationSource.media.catalog.clips?.[item.mediaRef];
      if (item.kind === "clip" && !clip) errors.push(`${page.id}: example clip is missing from the clip catalog (${item.mediaRef})`);
      if (/social-proof-animation/i.test(mediaText) && Number(clip?.w) > Number(clip?.h)) errors.push(`${page.id}: horizontal social-proof-animation is not allowed in examples (${item.mediaRef})`);
      if (item.kind === "clip") {
        const expected = `Video · ${closestRatio(item.video.width, item.video.height)}`;
        if (item.spec !== expected) errors.push(`${page.id}: example spec is not based on actual media dimensions (${title})`);
      }
    }
  }
  for (const pageId of Object.keys(casePlan.pages ?? {})) if (!build.pages.some((page) => page.id === pageId)) errors.push(`${pageId}: case-plan points to a missing page`);
  // Media: pages of these layouts show their own picture, every image has a proper
  // description, and nothing comes from another store's folders. Cross-page sharing is
  // enforced once above using imageBase for all rendered images.
  const needsMain = new Set(["tool", "template", "collection", "article", "faq", "contact", "about", "trust"]);
  for (const page of build.pages) {
    const { layout, data } = page.contentJson.sections.v2_main.settings;
    const main = heroImageOf(data.heroMedia);
    for (const image of [main, data.heroMedia?.before, ...(data.gallery?.images ?? []), ...(data.pairs ?? []).flatMap((pair) => [pair.before, pair.after]), ...[...(data.examples?.groups ?? []), ...(data.exampleGallery?.groups ?? [])].flatMap((group) => (group.items ?? []).map((item) => item.image))].filter(Boolean)) {
      if (!image.alt || image.alt.length < 12) errors.push(`${page.id}: image without a proper description (${image.src})`);
      if (/\bunbranded\b|\bplaceholder\b|\bprompt\b/i.test(image.alt)) errors.push(`${page.id}: internal wording in an image description (${image.alt})`);
      if (!image.src.startsWith("/assets/sites/site_aidreamcapes/")) errors.push(`${page.id}: image outside the Aidreamcapes asset folder (${image.src})`);
      if (/\/(dreamshoot|mirror|fan-holiday-theme|creative-packs)\//.test(image.src)) errors.push(`${page.id}: image from a retired or other-store folder (${image.src})`);
    }
    if (!main && needsMain.has(layout) && page.id !== "photo-hub" && !data.image) errors.push(`${page.id}: no main image`);
  }
  // The opening copy or SEO metadata names the page's topic with its primary keyword.
  const plain = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  for (const page of build.pages) {
    const seo = page.contentJson.seo;
    const lead = plain(page.contentJson.sections.v2_main.settings.data.lead);
    const metadata = plain(`${seo.title} ${seo.description}`);
    const keyword = plain(page.contentJson.seo.primaryKeyword).split(" ").filter((word) => word.length > 2);
    const foundInLead = keyword.filter((word) => lead.includes(word.replace(/s$/, ""))).length;
    const foundInMetadata = keyword.filter((word) => metadata.includes(word.replace(/s$/, ""))).length;
    if (keyword.length && foundInLead / keyword.length < 0.75 && foundInMetadata / keyword.length < 0.75) errors.push(`${page.id}: opening copy and SEO metadata do not name the topic "${page.contentJson.seo.primaryKeyword}"`);
  }
  // No picture appears twice on a page.
  for (const page of build.pages) {
    const { layout, data } = page.contentJson.sections.v2_main.settings;
    const imageCounts = new Map();
    const stripCounts = new Map();
    for (const image of data.visual?.strip ?? []) {
      const key = imageBase(image.src);
      stripCounts.set(key, (stripCounts.get(key) ?? 0) + 1);
    }
    const allowedVisualRepeats = new Set();
    for (const image of [data.visual?.steps?.source, data.visual?.steps?.result]) {
      if (!image?.src) continue;
      const key = imageBase(image.src);
      if (stripCounts.get(key) === 1) allowedVisualRepeats.add(key);
    }
    for (const item of data.visual?.input ?? []) {
      if (!item.darkened || !item.good?.src || imageBase(item.good.src) !== imageBase(item.bad?.src)) continue;
      allowedVisualRepeats.add(imageBase(item.good.src));
    }
    for (const src of renderedImages(layout, data)) {
      const key = imageBase(src);
      const count = (imageCounts.get(key) ?? 0) + 1;
      imageCounts.set(key, count);
      if (count > 1 && !(count === 2 && allowedVisualRepeats.has(key))) errors.push(`${page.id}: the picture ${key.split("/").slice(-2).join("/")} appears twice on the page`);
    }
  }
  // Internal links: every guide and article is linked from at least five other pages, every
  // article text link points to a live page, and a card never ends in the middle of a word.
  const pageSlugs = new Set(build.pages.map((page) => page.slug));
  const inbound = new Map();
  const collect = (value, from) => {
    if (Array.isArray(value)) value.forEach((item) => collect(item, from));
    else if (value && typeof value === "object") {
      for (const [key, item] of Object.entries(value)) {
        if (key === "breadcrumbs") continue;
        if (key === "href" && typeof item === "string") add(item, from);
        else collect(item, from);
      }
    } else if (typeof value === "string") for (const match of value.matchAll(INLINE_LINK)) add(match[2], from);
  };
  const add = (href, from) => {
    if (isExternalUrl(href)) return;
    const target = (localPathFromAbsoluteUrl(href) ?? href).split(/[?#]/)[0];
    if (target === from || !pageSlugs.has(target)) return;
    (inbound.get(target) ?? inbound.set(target, new Set()).get(target)).add(from);
  };
  for (const page of build.pages) collect(page.contentJson.sections.v2_main.settings.data, page.slug);
  for (const page of build.pages.filter((candidate) => candidate.contentJson.sections.v2_main.settings.layout === "article")) {
    const count = inbound.get(page.slug)?.size ?? 0;
    if (count < 5) errors.push(`${page.id}: only ${count} pages link to this article (needs 5)`);
    const text = JSON.stringify(page.contentJson.sections.v2_main.settings.data.sections);
    if ((text.match(/\]\(\//g) ?? []).length < 3) errors.push(`${page.id}: fewer than 3 links inside the article text`);
  }
  for (const page of build.pages) {
    const data = page.contentJson.sections.v2_main.settings.data;
    for (const item of [...(data.items ?? []), ...(data.related ?? []), ...(data.reading ?? [])]) {
      const cardText = item.text ?? "";
      if (/\[[^\]]*\]\(/.test(cardText)) errors.push(`${page.id}: link markup inside card text`);
      if (cardText.length > 160) errors.push(`${page.id}: card text too long (${item.href})`);
      if (cardText && !/[.!?…]$/.test(cardText) && cardText.length > 60) errors.push(`${page.id}: card text ends mid-sentence (${item.href})`);
    }
  }
  const slugs = new Set(build.pages.map((page) => page.slug));
  for (const [from, to] of build.redirects) {
    if (slugs.has(from)) errors.push(`redirect source is a live page: ${from}`);
    if (!slugs.has(to) && to !== "/ai-video-generation" && to !== "/ai-image-generation") errors.push(`redirect target missing: ${to}`);
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Utility pages (login, album, cart, account, search, 404) keep their own sections;
// only the named copy fields change. Every change names the value it replaces, so a
// field that was edited online since is left alone and reported as a conflict.

export function loadUtilityPagePatches() {
  const source = readJson(path.join(DATA_DIR, "utility-pages.json"));
  return source.pages.map((page) => ({
    slug: page.slug,
    changes: [...(page.include ?? []).flatMap((key) => source.shared[key] ?? []), ...page.changes]
  }));
}

// An unset field matches `null` in a change, so a change can fill in a field that was never set.
// The storefront was renamed from Aidreamcapes to AIVideosUGC and its support email moved to aivideosugc.com.
// Stored text written before the rename is brought over by swapping these exact words; web addresses
// (social profiles, asset paths) are left as they are.
export const BRAND_SWAPS = [["support@aidreamcapes.com", "support@aivideosugc.com"], ["Aidreamcapes.com", "AIVideosUGC"], ["Aidreamcapes", "AIVideosUGC"]];
export function rebrandText(value) {
  if (typeof value !== "string" || /^\s*https?:\/\//i.test(value)) return value;
  return BRAND_SWAPS.reduce((text, [from, to]) => text.split(from).join(to), value);
}
export function rebrandTree(value) {
  if (typeof value === "string") return rebrandText(value);
  if (Array.isArray(value)) return value.map((item) => rebrandTree(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rebrandTree(item)]));
  return value;
}
// Patch values are compared with the brand words swapped, so a value that differs only by the rename still counts as the same.
const sameValue = (left, right) => JSON.stringify(rebrandTree(left ?? null)) === JSON.stringify(rebrandTree(right ?? null));

export function applyUtilityPagePatch(contentJson, changes) {
  const next = structuredClone(contentJson ?? {});
  next.sections ??= {};
  next.sectionsOrder ??= [];
  next.seo ??= {};
  const result = { next, applied: [], unchanged: [], conflicts: [] };
  const sectionOf = (id, type) => {
    const section = next.sections[id];
    return section && section.type === type ? section : undefined;
  };
  for (const change of changes) {
    const [kind] = change;
    if (kind === "seo") {
      const [, key, from, to] = change;
      const current = next.seo[key];
      if (sameValue(current, to)) result.unchanged.push(`seo.${key}`);
      else if (sameValue(current, from)) { next.seo[key] = rebrandTree(to); result.applied.push(`seo.${key}`); }
      else result.conflicts.push(`seo.${key}`);
    } else if (kind === "field") {
      const [, id, type, key, from, to] = change;
      const section = sectionOf(id, type);
      const current = section?.settings?.[key];
      if (!section) result.conflicts.push(`${id}.${key} (section missing)`);
      else if (sameValue(current, to)) result.unchanged.push(`${id}.${key}`);
      else if (sameValue(current, from)) { section.settings[key] = rebrandTree(to); result.applied.push(`${id}.${key}`); }
      else result.conflicts.push(`${id}.${key}`);
    } else if (kind === "block") {
      const [, id, type, index, key, from, to] = change;
      const block = sectionOf(id, type)?.blocks?.[index];
      const current = block?.settings?.[key];
      if (!block) result.conflicts.push(`${id}.blocks[${index}].${key} (block missing)`);
      else if (sameValue(current, to)) result.unchanged.push(`${id}.blocks[${index}].${key}`);
      else if (sameValue(current, from)) { block.settings[key] = rebrandTree(to); result.applied.push(`${id}.blocks[${index}].${key}`); }
      else result.conflicts.push(`${id}.blocks[${index}].${key}`);
    } else if (kind === "replace") {
      // A change inside a longer text (such as a policy body): `from` and `to` are the exact words swapped.
      const [, id, type, key, from, to] = change;
      const section = sectionOf(id, type);
      const current = section?.settings?.[key];
      const [text, oldWords, newWords] = [rebrandText(current), rebrandText(from), rebrandText(to)];
      if (!section || typeof current !== "string") result.conflicts.push(`${id}.${key} (text missing)`);
      else if (text.includes(newWords) && !text.includes(oldWords)) result.unchanged.push(`${id}.${key}`);
      else if (text.split(oldWords).length === 2) { section.settings[key] = text.replace(oldWords, () => newWords); result.applied.push(`${id}.${key}`); }
      else result.conflicts.push(`${id}.${key}`);
    } else if (kind === "remove") {
      const [, id, type] = change;
      const section = next.sections[id];
      if (!section) result.unchanged.push(`remove ${id}`);
      else if (section.type !== type) result.conflicts.push(`remove ${id} (type ${section.type})`);
      else {
        delete next.sections[id];
        next.sectionsOrder = next.sectionsOrder.filter((sectionId) => sectionId !== id);
        result.applied.push(`remove ${id}`);
      }
    } else {
      throw new Error(`Unknown utility page change: ${kind}`);
    }
  }
  // Any other text on the page that still names the former brand or email.
  const renamed = rebrandTree(result.next);
  if (JSON.stringify(renamed) !== JSON.stringify(result.next)) { result.next = renamed; result.applied.push("brand name and email"); }
  return result;
}

// Subscription plan cards (cart, account, checkout) show each product's summary and
// features; they follow the v2 pricing plans. Same rule as above: only values that
// still equal the expected current text are replaced.
export function loadProductPatches() {
  const source = readJson(path.join(DATA_DIR, "utility-pages.json"));
  return (source.products ?? []).map((product) => {
    const plan = PLANS.find((candidate) => candidate.name === product.plan);
    assert.ok(plan, `unknown plan ${product.plan}`);
    return { id: product.id, from: product.from, to: { summary: plan.who, features: plan.features, badgeLabel: product.badgeLabel } };
  });
}

// The footer settings in ThemeSettings hold the company's tax ID, which is shown with the
// company details. Same rule: only a value still equal to one of the listed old ones is replaced.
export function loadThemeSettingsPatches() {
  const source = readJson(path.join(DATA_DIR, "utility-pages.json"));
  return (source.settings?.footer ?? []).map(([key, from, to]) => ({ key, from: Array.isArray(from) ? from : [from], to }));
}

export function applyThemeSettingsPatch(settingsJson, patches) {
  const next = structuredClone(settingsJson ?? {});
  const footer = next.globalSections?.footer;
  const result = { next, applied: [], unchanged: [], conflicts: [] };
  for (const { key, from, to } of patches) {
    if (!footer?.settings) { result.conflicts.push(`footer.${key} (footer missing)`); continue; }
    const current = footer.settings[key];
    if (sameValue(current, to)) result.unchanged.push(`footer.${key}`);
    else if (from.some((value) => sameValue(current, value))) { footer.settings[key] = rebrandTree(to); result.applied.push(`footer.${key}`); }
    else result.conflicts.push(`footer.${key}`);
  }
  return result;
}

// The site's own description (Site.branding.description) feeds the Organization structured
// data on every page. Each change lists the values known to be out of date; any other value
// was edited online since and is left alone and reported.
export function loadSiteBrandingPatches() {
  const source = readJson(path.join(DATA_DIR, "utility-pages.json"));
  return (source.site?.branding ?? []).map(([key, from, to]) => ({ key, from: Array.isArray(from) ? from : [from], to }));
}

export function applySiteBrandingPatch(branding, patches) {
  const next = structuredClone(branding ?? {});
  const result = { next, applied: [], unchanged: [], conflicts: [] };
  for (const { key, from, to } of patches) {
    if (sameValue(next[key], to)) result.unchanged.push(key);
    else if (from.some((value) => sameValue(next[key], value))) { next[key] = rebrandTree(to); result.applied.push(key); }
    else result.conflicts.push(key);
  }
  return result;
}

// The site name, header and footer settings and the company profile carry the brand name and support
// email too; these return the renamed copy and the fields that changed.
const changedPaths = (before, after, base = "") => {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (before && after && typeof before === "object" && typeof after === "object" && !Array.isArray(before)) return Object.keys(after).flatMap((key) => changedPaths(before[key], after[key], base ? `${base}.${key}` : key));
  return [base];
};
export function rebrandSiteRecord(site) {
  const next = { name: rebrandText(site.name), branding: rebrandTree(site.branding ?? {}) };
  return { next, changed: changedPaths({ name: site.name, branding: site.branding ?? {} }, next) };
}
export function rebrandThemeSettings(settingsJson) {
  const next = structuredClone(settingsJson ?? {});
  for (const part of ["header", "footer"]) if (next.globalSections?.[part]?.settings) next.globalSections[part].settings = rebrandTree(next.globalSections[part].settings);
  if (next.seo) for (const key of ["siteTitle", "titleTemplate", "siteDescription"]) if (typeof next.seo[key] === "string") next.seo[key] = rebrandText(next.seo[key]);
  return { next, changed: changedPaths(settingsJson ?? {}, next) };
}
export function rebrandProfile(profileJson) {
  const next = structuredClone(profileJson ?? {});
  if (next.identity) next.identity = rebrandTree(next.identity);
  return { next, changed: changedPaths(profileJson ?? {}, next) };
}

export function applyProductPatch(metadata, patch) {
  const next = structuredClone(metadata ?? {});
  const result = { next, applied: [], unchanged: [], conflicts: [] };
  for (const key of Object.keys(patch.to)) {
    if (sameValue(next[key], patch.to[key])) result.unchanged.push(key);
    else if (sameValue(next[key], patch.from[key])) { next[key] = rebrandTree(patch.to[key]); result.applied.push(key); }
    else result.conflicts.push(key);
  }
  return result;
}
