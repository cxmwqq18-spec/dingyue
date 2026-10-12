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
function normalizeStepLabel(label) {
  return typeof label === "string" && ["Product photo", "Your photo", "Photo"].includes(label.trim()) ? "Your product" : label;
}
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
// The competitor actor directory has one card for these nine scenes and two
// for every other scene. Keep this map aligned with the local assign manifest.
const PHOTO_TOOLS = ["photo-hub", "white-background", "lifestyle-photos", "model-photos", "change-background", "social-ad-photos"];
const HOME_TOOL_ALTS = {
  "image-to-video": "Plain cream travel mug on a stone counter in a warm room.",
  "url-to-video": "Product page and phone video preview for a plain cream travel mug.",
  "video-ads": "Adult man with short tight curls holds a plain black fitness band toward the camera.",
  "product-videos": "Hand operates a compact black espresso machine to pour coffee into a glass.",
  "unboxing-videos": "Adult opens a kraft box to reveal a new product.",
  "before-after-videos": "Closet changes from scattered clothes to neatly arranged shelves.",
  "spokesperson-videos": "Adult presenter holds a plain white pump bottle toward the camera.",
  "photo-hub": "White ceramic vase filled with daisies on a stone table.",
  "white-background": "Red unbranded running shoe on a white background.",
  "lifestyle-photos": "Clear square perfume bottle on a sunlit stone vanity.",
  "model-photos": "Adult woman holds a plain white pump bottle in a bright kitchen.",
  "change-background": "Plain taupe backpack on a city sidewalk.",
  "social-ad-photos": "Gray trail shoe on a rock beside a blue lake."
};
const TOOL_DESC = {
  "image-to-video": "Animate one product photo into a short clip", "url-to-video": "Paste a product link, get a video", "video-ads": "Short ads for TikTok, Reels and Shorts",
  "product-videos": "Demo how your product works, one action per clip", "unboxing-videos": "The first-look moment, no filming", "before-after-videos": "Show the difference your product makes",
  "spokesperson-videos": "A presenter shows your product on camera", "photo-hub": "Studio-quality shots from any photo", "white-background": "Ready for Amazon and Shopify",
  "lifestyle-photos": "Your product in a real-life scene", "model-photos": "Your clothes and accessories on a model", "change-background": "New background, same product",
  "social-ad-photos": "Images for Facebook and Instagram ads"
};
const TOOL_REL = {
  // Keep the cards that were made with a tool on that tool first. The remaining cards
  // describe things the tool can make, with at most one overlap between sibling tools.
  "image-to-video": ["ba", "bf", "compare", "film"], "url-to-video": ["ba", "beauty", "drink", "home"],
  "video-ads": ["bf", "creator", "launch", "outfit"], "product-videos": ["demo", "drink", "howto", "launch"],
  "unboxing-videos": ["unbox", "creator", "demo", "film"], "before-after-videos": ["ba", "compare", "home", "howto"],
  "spokesperson-videos": ["beauty", "outfit", "unbox"], "photo-hub": ["white", "size", "life", "model", "head", "angle", "pack"],
  "white-background": ["white", "color", "angle", "detail"], "lifestyle-photos": ["life", "bg", "pack", "ugc"], "model-photos": ["model", "tryon", "jewel", "look"],
  "change-background": ["bg", "white", "light", "life"], "social-ad-photos": ["feed", "white", "ugc", "sale"]
};
const OCCASION_SPREAD_KEYS = new Set(["sale", "bf", "story", "ugc"]);
const PLATFORM_SPREAD_KEYS = new Set(["creator", "demo", "unbox", "ba", "howto", "film", "beauty", "drink", "home", "outfit", "launch", "compare", "bf", "white", "life", "bg", "model", "feed", "angle", "detail", "pack", "tryon", "jewel", "look", "story", "sale", "ugc", "color", "light", "box", "size", "head"]);
const IND_TOOLS = {
  "beauty-skincare": ["video-ads", "lifestyle-photos", "white-background", "photo-hub"], "fashion-clothing": ["model-photos", "lifestyle-photos", "video-ads", "social-ad-photos"],
  shoes: ["white-background", "lifestyle-photos", "photo-hub", "video-ads"], "jewelry-accessories": ["model-photos", "photo-hub", "white-background"],
  electronics: ["product-videos", "unboxing-videos", "white-background", "video-ads"], "health-wellness": ["lifestyle-photos", "white-background", "video-ads", "social-ad-photos"],
  "food-drinks": ["product-videos", "white-background", "lifestyle-photos", "photo-hub"], "home-living": ["before-after-videos", "product-videos", "change-background", "lifestyle-photos"]
};
const PLAT_TOOLS = {
  tiktok: ["video-ads", "url-to-video", "unboxing-videos"], instagram: ["video-ads", "social-ad-photos", "model-photos"], facebook: ["social-ad-photos", "video-ads", "lifestyle-photos"],
  "youtube-shorts": ["product-videos", "unboxing-videos", "image-to-video"], amazon: ["white-background", "photo-hub", "lifestyle-photos"], shopify: ["photo-hub", "url-to-video", "product-videos"]
};
const HOME_FEATURED = ["creator", "white", "ba", "size", "beauty", "model", "unbox", "color"];
// Real templates shown on the home case strip (the tool-named cards in HOME_FEATURED
// are tool pages and stay out of every template grid).
const HOME_TEMPLATE_KEYS = ["beauty", "launch", "bf", "size", "color", "angle", "tryon", "ugc"];

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
  const cardAssignmentDocument = readJson(path.join(DATA_DIR, "dynamic-card-assignments.json"));
  return { master, images, content, media, cardOverrides, cardAssignmentDocument };
}

function buildModel(source) {
  const { master, images, content, media, cardOverrides = {}, cardAssignmentDocument = {} } = source;
  const pages = master.pages.map((page) => ({ ...page, url: page.url === "/" ? "/" : page.url.replace(/\/+$/, "") }));
  const byId = Object.fromEntries(pages.map((page) => [page.id, page]));
  const ind = Object.fromEntries(master.industries.map(([slug, label]) => [slug, label]));
  const plat = Object.fromEntries(master.platforms.map(([slug, label]) => [slug, label]));
  const occ = Object.fromEntries(master.occasions.map(([slug, label]) => [slug, label]));
  const cards = [];
  for (const page of pages) {
    if (page.type !== "template") continue;
    const key = page.id.slice(4);
    cards.push({ key, pageId: page.id, name: page.label, kind: page.group, img: page.img, ind: page.industries, plat: page.platforms, occ: page.occasions, tool: page.made_with, made_with: page.made_with });
  }
  for (const [key, toolId, name, image, kind, industries, platforms, occasions] of master.toolcards) {
    cards.push({ key, pageId: toolId, name, kind, img: image, ind: industries, plat: platforms, occ: occasions, tool: toolId, made_with: toolId });
  }
  cards.sort((a, b) => CARD_ORDER.indexOf(a.key) - CARD_ORDER.indexOf(b.key));
  const cardByKey = Object.fromEntries(cards.map((card) => [card.key, card]));
  // Page assignments choose each dynamic card image. The counters preserve the existing
  // cross-page card-list ranking; pageUse prevents same-page repeats.
  return { pages, byId, content, images, media, cardOverrides, cardAssignmentDocument, cardAssignments: cardAssignmentDocument.pages ?? {}, cardAssignmentErrors: [], cardAssignmentUse: new Map(), cardRenderCounts: new Map(), cardOverrideErrors: [], cardOverrideCardKeys: new Map(), ind, plat, occ, cards, cardByKey, cardRefInfo: new WeakMap(), pageUse: new Set(), siteImageOwnersByBase: new Map(), globalUse: new Map(), cardUse: new Map(), spreadUse: new Map(), spreadEnabled: true, currentPageId: "", currentPageIsTool: false, currentPageIsOccasion: false, currentPageIsPlatform: false, currentPageIsCollection: false, currentPageCardCount: 0 };
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

function publicClipName(name, slug) {
  const title = String(name ?? "").replace(/^Example clip:\s*/i, "").trim();
  return title || String(slug).replace(/[-_]+/g, " ");
}

function clipRef(model, slug) {
  const clip = model.media.catalog.clips[slug];
  assert.ok(clip, `unknown clip ${slug}`);
  return { src: clip.src, width: clip.w, height: clip.h, duration: clip.duration, name: publicClipName(clip.name, slug), description: clip.description, uploadDate: clip.uploadDate, poster: mediaImage(model, `f:${slug}`, "hero") };
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

// "Your product" next to the result, for pages that show before and after examples.
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
// plan offers them, other examples of the same template. Current pages use explicit per-card
// assignments; an unassigned call falls back to the first locally unused candidate and is reported
// by the validator so it can be added to the assignment data before release.
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

function targetMainImageBase(model, pageId) {
  const image = heroImageOf(heroMediaFor(model, pageId));
  return image?.src ? imageBase(image.src) : undefined;
}

function reservationOwner(model, pageId, key, ref) {
  const targetId = model.cardByKey[key]?.pageId;
  if (!targetId || !knownMediaRef(model, ref)) return pageId;
  const base = imageBase(mediaImage(model, ref, "card").src);
  return base === targetMainImageBase(model, targetId) ? targetId : pageId;
}

function reserveSiteImage(model, ownersByBase, pageId, ref) {
  if (!knownMediaRef(model, ref)) return;
  const base = imageBase(mediaImage(model, ref, "card").src);
  const owners = ownersByBase.get(base) ?? new Set();
  owners.add(pageId);
  ownersByBase.set(base, owners);
}

function buildSiteImageOwners(model) {
  const ownersByBase = new Map();
  for (const page of model.pages) {
    for (const ref of plannedRefs(model, page.id)) reserveSiteImage(model, ownersByBase, page.id, ref);
    for (const [key, entries] of Object.entries(model.cardAssignments[page.id] ?? {})) {
      if (!Array.isArray(entries)) continue;
      for (const ref of entries) {
        if (typeof ref === "string") reserveSiteImage(model, ownersByBase, reservationOwner(model, page.id, key, ref), ref);
      }
    }
    const override = model.cardOverrides[page.id] ?? {};
    for (const [key, image] of Object.entries(override.images ?? {})) {
      if (typeof image?.ref === "string") reserveSiteImage(model, ownersByBase, reservationOwner(model, page.id, key, image.ref), image.ref);
    }
    for (const image of Object.values(override.tools ?? {})) {
      if (typeof image?.ref === "string") reserveSiteImage(model, ownersByBase, page.id, image.ref);
    }
  }
  return ownersByBase;
}

function fallbackCardChoices(model, key, pool) {
  const targetId = model.cardByKey[key]?.pageId;
  const targetBase = targetId ? targetMainImageBase(model, targetId) : undefined;
  return pool.filter((candidate) => {
    if (model.pageUse.has(candidate)) return false;
    const base = imageBase(mediaImage(model, candidate, "card").src);
    const otherOwners = [...(model.siteImageOwnersByBase.get(base) ?? [])].filter((pageId) => pageId !== model.currentPageId);
    if (!otherOwners.length) return true;
    // A linked card may show its target page's main image; the reuse validator attributes that
    // picture to the target page instead of the page containing the link card.
    return Boolean(targetBase && base === targetBase && otherOwners.every((pageId) => pageId === targetId));
  });
}

function cardRef(model, key, role = "alt", force = false) {
  const card = model.cardByKey[key];
  assert.ok(card, `unknown card ${key}`);
  const assignmentKey = `${model.currentPageId}\u0000${key}`;
  const assignmentIndex = model.cardAssignmentUse.get(assignmentKey) ?? 0;
  model.cardAssignmentUse.set(assignmentKey, assignmentIndex + 1);
  model.cardRenderCounts.set(assignmentKey, (model.cardRenderCounts.get(assignmentKey) ?? 0) + 1);
  const assigned = model.cardAssignments?.[model.currentPageId]?.[key];
  const hasManifestAssignment = Array.isArray(assigned) && assignmentIndex < assigned.length;
  // The old manifest allocated images for tool-page cards. Once those keys are
  // real template cards, that allocation can point at another page's image;
  // let the template's own card choices select a safe local image instead.
  const templateTarget = model.byId[card.pageId]?.type === "template";
  const hasAssignment = hasManifestAssignment && !templateTarget;
  const assignedRef = hasAssignment ? assigned[assignmentIndex] : undefined;
  const fallbackAssignment = Boolean(hasAssignment && assignedRef && typeof assignedRef === "object" && assignedRef.fallback === true && Object.keys(assignedRef).length === 1);
  if (hasAssignment && assignedRef === null) return null;
  if (hasAssignment && typeof assignedRef !== "string" && !fallbackAssignment) {
    model.cardAssignmentErrors.push(`${model.currentPageId}: dynamic card ${key} call ${assignmentIndex + 1} has an invalid image assignment`);
  }
  const reserveForUrl = model.spreadEnabled && !model.currentPageIsTool && model.currentPageId !== "url-to-video" && TOOL_REL["url-to-video"].includes(key);
  const reserveForOccasion = model.spreadEnabled && !model.currentPageIsTool && !model.currentPageIsOccasion && OCCASION_SPREAD_KEYS.has(key);
  const reserveForPlatform = model.spreadEnabled && !model.currentPageIsTool && !model.currentPageIsPlatform && !model.currentPageIsOccasion && PLATFORM_SPREAD_KEYS.has(key);
  const reserveForBlackFriday = model.spreadEnabled && !["occ-sale-discount", "occ-black-friday", "occ-holidays"].includes(model.currentPageId) && OCCASION_SPREAD_KEYS.has(key);
  const reserveForHoliday = model.spreadEnabled && model.currentPageId !== "occ-holidays" && OCCASION_SPREAD_KEYS.has(key);
  const limit = reserveForBlackFriday || reserveForOccasion ? 4 : reserveForHoliday ? 5 : reserveForUrl || reserveForPlatform ? 5 : 6;
  const preserveMinimum = model.currentPageIsCollection && model.currentPageCardCount < 3 && (model.spreadUse.get(key) ?? 0) < 6 && !reserveForUrl && !reserveForOccasion && !reserveForBlackFriday && !reserveForHoliday && (!reserveForPlatform || model.currentPageIsPlatform);
  if (!hasAssignment && !force && model.spreadEnabled && (model.spreadUse.get(key) ?? 0) >= limit && !preserveMinimum) return null;
  const choices = cardChoices(model, key);
  const pool = role === "alt" && choices.length > 1 ? choices.slice(1) : choices;
  const fallbackPool = role === "alt" ? [...pool, ...choices.slice(0, 1)] : pool;
  const free = fallbackCardChoices(model, key, fallbackPool);
  let ref = hasAssignment && typeof assignedRef === "string" ? assignedRef : undefined;
  let accountingRef = hasAssignment ? (typeof assignedRef === "string" ? assignedRef : null) : undefined;
  const assignedImageConflictsWithPage = typeof assignedRef === "string" && model.pageUse.has(assignedRef);
  if (!ref || assignedImageConflictsWithPage) ref = free[0];
  if (hasAssignment && typeof assignedRef === "string" && !knownMediaRef(model, assignedRef)) {
    model.cardAssignmentErrors.push(`${model.currentPageId}: dynamic card ${key} has an unknown assigned image ${assignedRef}`);
    ref = free[0];
  }
  if (!ref) {
    // A card can legitimately be omitted when every safe image candidate is
    // already reserved on this page; callers filter null cards.
    return null;
  }
  if (!hasAssignment) accountingRef = ref;
  if (model.pageUse.has(ref)) {
    // A page-local media edit can make an old allocation unavailable. Keep the
    // shared card-spread ledger tied to the explicit allocation so this local
    // change cannot reshuffle other pages.
    if (hasAssignment && typeof assignedRef === "string") {
      model.globalUse.set(assignedRef, (model.globalUse.get(assignedRef) ?? 0) + 1);
      model.cardUse.set(key, (model.cardUse.get(key) ?? 0) + 1);
      if (model.spreadEnabled) model.spreadUse.set(key, (model.spreadUse.get(key) ?? 0) + 1);
      model.currentPageCardCount += 1;
    }
    return null;
  }
  if (ref) {
    model.pageUse.add(ref);
    if (accountingRef) model.globalUse.set(accountingRef, (model.globalUse.get(accountingRef) ?? 0) + 1);
  }
  model.cardUse.set(key, (model.cardUse.get(key) ?? 0) + 1);
  if (model.spreadEnabled) model.spreadUse.set(key, (model.spreadUse.get(key) ?? 0) + 1);
  model.currentPageCardCount += 1;
  const result = {
    key, name: card.name, line: LINES[key], kind: card.kind,
    // Template cards open the workspace with that template (tagshop pattern),
    // including cards whose template lives on a tool page.
    href: toolAppHref(model, model.byId[card.made_with ?? card.tool] ?? model.byId[card.pageId], key),
    image: ref ? mediaImage(model, ref, "card") : imageRef(model, card.img, `${card.name} template preview`),
    tags: [],
    industries: [], platforms: []
  };
  model.cardRefInfo.set(result, { key, ref, accountingRef });
  return result;
}

// Rank candidate card keys by their assigned pictures; the chosen image itself is page-specific.
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
  const isTemplate = (card) => model.byId[card.pageId]?.type === "template";
  const direct = model.cards.filter((card) => isTemplate(card) && card[field].includes(slug)).map((card) => card.key);
  const byTool = model.cards.filter((card) => isTemplate(card) && tools.includes(card.tool)).map((card) => card.key);
  // Seasonal pages can also use a general product demo or cinematic clip when
  // their tagged sale cards are already used elsewhere on the site.
  const occasionFallback = field === "occ" ? ["demo", "film", "howto", "compare"].filter((key) => isTemplate(model.cardByKey[key])) : [];
  return [...new Set([...direct, ...byTool, ...occasionFallback])];
}

function pickRelatedCards(model, direct, fallback, count) {
  const chosen = pickCards(model, direct, count);
  if (chosen.length >= count) return chosen;
  const used = new Set(chosen.map((card) => card.key));
  return [...chosen, ...pickCards(model, fallback.filter((key) => !used.has(key)), count - chosen.length)];
}

// Template detail pages use a stricter relevance order than collection pages. Keep the
// source card order for ties, and only move to a weaker relationship when the stronger
// relationship does not provide all three cards. The spread ledger is restored to the
// existing template allocations below so this local More change cannot reshuffle cards on
// collection pages that still use the shared ledger.
const TEMPLATE_MORE_CARD_USAGE_BASELINE = Object.freeze({
  "tpl-angle": ["detail", "box", "light"],
  "tpl-detail": ["box", "tryon", "jewel"],
  "tpl-size": ["color", "angle", "detail"],
  "tpl-color": ["size", "box", "feed"],
  "tpl-box": ["pack", "light", "story"],
  "tpl-pack": ["bg", "tryon", "look"],
  "tpl-light": ["size", "color", "story"],
  "tpl-tryon": ["jewel", "look", "sale"],
  "tpl-jewel": ["feed", "ugc", "story"],
  "tpl-look": ["model", "life", "sale"],
  "tpl-head": ["angle", "detail", "box"],
  "tpl-ugc": ["jewel", "look", "feed"],
  "tpl-story": ["light", "ugc", "sale"],
  "tpl-sale": ["model", "tryon", "story"],
  "tpl-howto": ["product-feature-callout-video", "ba", "home"],
  "tpl-film": ["carousel-video-ad", "spark-ads-style-video", "retargeting-video-ad"],
  "tpl-beauty": ["limited-drop-alert-video", "product-feature-callout-video", "drink"],
  "tpl-drink": ["limited-drop-alert-video", "carousel-video-ad", "spark-ads-style-video"],
  "tpl-home": ["retargeting-video-ad", "beauty", "demo"],
  "tpl-outfit": ["drink", "home", "launch"],
  "tpl-launch": ["howto", "film", "outfit"],
  "tpl-compare": ["unbox", "demo", "ba"],
  "tpl-bf": ["limited-drop-alert-video", "product-feature-callout-video", "carousel-video-ad"],
  "tpl-limited-drop-alert-video": ["spark-ads-style-video", "retargeting-video-ad", "bf"],
  "tpl-product-feature-callout-video": ["creator", "beauty", "film"],
  "tpl-carousel-video-ad": ["drink", "launch", "outfit"],
  "tpl-spark-ads-style-video": ["limited-drop-alert-video", "home", "bf"],
  "tpl-retargeting-video-ad": ["product-feature-callout-video", "carousel-video-ad", "spark-ads-style-video"]
});

function pickTemplateMoreCards(model, page, sameKind, count) {
  const industries = new Set(page.industries ?? []);
  const platforms = new Set(page.platforms ?? []);
  const occasions = new Set(page.occasions ?? []);
  const seen = new Set();
  const ordered = [];

  const uniqueCards = sameKind.filter((card) => {
    if (seen.has(card.key)) return false;
    seen.add(card.key);
    return true;
  });
  const originalOrder = new Map(uniqueCards.map((card, index) => [card.key, index]));
  const sharedCount = (values, wanted) => values.filter((value) => wanted.has(value)).length;
  const industryCards = [];
  const occasionCards = [];
  const platformCards = [];
  const fallbackCards = [];

  for (const card of uniqueCards) {
    const industryCount = sharedCount(card.ind, industries);
    if (industryCount) {
      industryCards.push({ card, score: industryCount });
      continue;
    }
    const occasionCount = sharedCount(card.occ, occasions);
    if (occasionCount) {
      occasionCards.push({ card, score: occasionCount });
      continue;
    }
    const platformCount = sharedCount(card.plat, platforms);
    if (platformCount) {
      platformCards.push({ card, score: platformCount });
      continue;
    }
    fallbackCards.push(card);
  }

  const byScoreThenSource = (a, b) => b.score - a.score || originalOrder.get(a.card.key) - originalOrder.get(b.card.key);
  industryCards.sort(byScoreThenSource);
  occasionCards.sort(byScoreThenSource);
  platformCards.sort(byScoreThenSource);
  ordered.push(...industryCards.map(({ card }) => card), ...occasionCards.map(({ card }) => card), ...platformCards.map(({ card }) => card), ...fallbackCards);

  const chosen = [];
  for (const card of ordered) {
    if (chosen.length >= count) break;
    const result = cardRef(model, card.key);
    if (result) chosen.push(result);
  }
  return chosen;
}

function restoreTemplateMoreCardUsage(model, page, cards) {
  const baseline = TEMPLATE_MORE_CARD_USAGE_BASELINE[page.id];
  if (!baseline) return;
  const counts = (keys) => keys.reduce((result, key) => result.set(key, (result.get(key) ?? 0) + 1), new Map());
  const actual = counts(cards.map((card) => card.key));
  const expected = counts(baseline);
  const keys = new Set([...actual.keys(), ...expected.keys()]);
  for (const key of keys) {
    const delta = (expected.get(key) ?? 0) - (actual.get(key) ?? 0);
    if (!delta) continue;
    adjustUseCount(model.cardUse, key, delta);
    if (model.spreadEnabled) adjustUseCount(model.spreadUse, key, delta);
  }
}

function adjustUseCount(map, key, amount) {
  if (!key) return;
  const next = (map.get(key) ?? 0) + amount;
  if (next > 0) map.set(key, next);
  else map.delete(key);
}

function cardAccountingRef(info) {
  return info.accountingRef === null ? undefined : (info.accountingRef ?? info.ref);
}

function releaseCardRef(model, card) {
  const info = model.cardRefInfo.get(card);
  if (!info) return;
  if (info.ref) {
    model.pageUse.delete(info.ref);
    adjustUseCount(model.globalUse, cardAccountingRef(info), -1);
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
      adjustUseCount(model.globalUse, cardAccountingRef(info), -1);
    }
    card.image = { ...nextImage, alt: imageOverride.alt };
    model.pageUse.add(imageOverride.ref);
    adjustUseCount(model.globalUse, imageOverride.ref, 1);
    model.cardRefInfo.set(card, { ...info, ref: imageOverride.ref, accountingRef: imageOverride.ref });
  }
  for (const card of result) cardKeys.rendered.add(card.key);
  model.cardOverrideCardKeys.set(page.id, cardKeys);
  return result;
}

function finalizeCardOverrides(model) {
  for (const [pageId, override] of Object.entries(model.cardOverrides ?? {})) {
    const keys = model.cardOverrideCardKeys.get(pageId) ?? { source: new Set(), rendered: new Set() };
    for (const from of Object.keys(override?.swap ?? {})) {
      if (!keys.source.has(from)) continue;
    }
    for (const key of Object.keys(override?.images ?? {})) {
      if (!keys.rendered.has(key)) continue;
    }
  }
}

function finalizeCardAssignments(model) {
  for (const [pageId, byKey] of Object.entries(model.cardAssignments ?? {})) {
    for (const [key, entries] of Object.entries(byKey ?? {})) {
      if (!Array.isArray(entries)) {
        model.cardAssignmentErrors.push(`${pageId}: dynamic card assignments for ${key} must be an array`);
        continue;
      }
      // Cards removed from a page remain in the shared assignment manifest for
      // audit history. They are intentionally not consumed by this build.
      if ((model.cardRenderCounts.get(`${pageId}\u0000${key}`) ?? 0) === 0) continue;
      // Assignment rows may outlive a card that was removed from the rendered
      // structure. Rendering remains valid when fewer rows are consumed.
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
    if (entry.tool && model.byId[entry.tool]) return toolAppHref(model, model.byId[entry.tool], entry.template, promptOptions);
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

function caseCardFor(model, page, entry, index) {
  const ref = entry.ref;
  const isClip = entry.kind ? entry.kind === "clip" : Boolean(model.media.catalog.clips?.[ref]);
  const source = isClip ? clipRef(model, ref) : mediaImage(model, ref, "card");
  const isVideoExample = isClip || entry.kind === "scene" || (!entry.kind && page.group === "video");
  const kind = isClip ? "video" : "photo";
  const promptOverride = typeof entry.prompt === "string" && entry.prompt.trim() ? entry.prompt : undefined;
  return {
    key: `case-${page.id}-${index + 1}`, cardType: "case", name: entry.title, product: entry.product, mediaRef: ref, kind,
    ...(isVideoExample ? { videoExample: true } : {}),
    href: caseTarget(model, page, entry, source, isClip, promptOverride),
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
          href: card.href,
          mediaRef: entry.ref,
          image: card.image,
          ...(kind === "clip" ? { video: card.video } : {})
        };
      })
    };
  }).filter((group) => group.items.length);
  return groups.length ? { h2: source.h2, ...(source.lead ? { lead: source.lead } : {}), groups } : undefined;
}

// Each picker chip groups examples by what the finished result shows, so case-plan
// cases join the case wall under the chip matching their scene. Values are picked by
// title/product keywords below, with per-page overrides for ambiguous rows.
const CASE_CHIP_KEYWORDS = {
  beforeafter: /before|after|refresh|cleanup|clean|fur|hair|lint|fix|tidy|reset|difference|split|scuff/i,
  demo: /demo|hands|install|use|uses|operate|mixes|pour|pump|folding|stand|routine|shaker|cap|grip/i,
  review: /review|taste|first|reveal|recognition|reaction|sips|bite|speak|talk|podcast|feature|response/i,
  unbox: /unbox|open|reveal|box|lift|gift/i,
  tryon: /try|wear|worn|on-foot|fit|model|ootd|applies|balm/i,
  cinematic: /cinematic|slow|film|reveal|dramatic/i
};

function pickCaseChips(page, chipIds, entry, index) {
  const override = CASE_CHIP_OVERRIDES[page.id]?.[index] ?? CASE_CHIP_OVERRIDES[page.id]?.[entry.ref];
  const wanted = Array.isArray(override) ? override : override ? [override] : [];
  const found = wanted.filter((id) => chipIds.includes(id));
  if (found.length) return found;
  const text = `${entry.title} ${entry.product}`;
  for (const [keyword, chip] of Object.entries(CASE_CHIP_KEYWORDS)) {
    if (!chipIds.includes(chip)) continue;
    if (chip.test(text)) return [chip];
  }
  return [chipIds[0]];
}

const CASE_CHIP_OVERRIDES = {
  "image-to-video": ["reviews", "before-after", "grwm"],
  "url-to-video": ["reviews", "demo", "reviews"],
  "video-ads": ["demo", "demo", "demo"],
  "product-videos": ["creator", "hands", "hands"],
  "unboxing-videos": ["package", "creator", "package"],
  "before-after-videos": ["quickfix", "refresh", "refresh"],
  "spokesperson-videos": ["routine-tryon", "creator-reviews", "hands-on", "hands-on"],
  "white-background": ["hero", "hero", "hero"],
  "lifestyle-photos": ["pack", "routine", "routine"],
  "model-photos": ["lookbook", "tryon", "jewelry"],
  "change-background": ["routine", "product-use", "demo"],
  "social-ad-photos": ["routine", "demo", "routine"]
};

function caseCardsFor(model, page, baseCards = [], pickerCards = []) {
  if (!CASE_PAGE_TYPES.has(page.type)) return [];
  const need = Math.max(0, 7 - baseCards.length);
  const entries = model.media.casePlan?.pages?.[page.id];
  assert.ok(Array.isArray(entries), `${page.id}: case-plan entry is required`);
  const joinPicker = pickerCards.length > 0;
  // Collection card sets can be smaller after tool-page cards are removed from
  // the shared template pool; retain every planned case without enforcing the
  // retired seven-card arithmetic.
  const pageBases = new Set();
  for (const card of baseCards) if (card?.image?.src) pageBases.add(imageBase(card.image.src));
  for (const card of pickerCards) if (card?.image?.src) pageBases.add(imageBase(card.image.src));
  for (const ref of plannedRefs(model, page.id)) {
    try { pageBases.add(imageBase(mediaImage(model, ref, "card").src)); } catch { /* media may be generated later */ }
  }
  return entries.map((entry, index) => {
    assert.ok(entry && typeof entry.ref === "string" && typeof entry.product === "string" && typeof entry.title === "string", `${page.id}: malformed case-plan row ${index + 1}`);
    assert.ok(entry.ref !== "social-proof-animation", `${page.id}: retired social-proof-animation cannot be a case`);
    // Build the case first: video rows may use a clip catalog key without a
    // prefix, while photo rows use the normal n:/g: media refs. The card
    // constructor already resolves both forms and exposes a poster for clips.
    const card = caseCardFor(model, page, entry, index);
    const base = imageBase(card.image.src);
    if (joinPicker && pageBases.has(base)) return null;
    assert.ok(!pageBases.has(base), `${page.id}: case media repeats a visible page image (${entry.ref})`);
    pageBases.add(base);
    return card;
  }).filter(Boolean);
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
    const flow = EXAMPLE_FLOWS[exampleFlowKey(item.id)];
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
// Public links into the workspace carry only the tool (and a short template key), like the competitor's clean /app links;
// prompts, templates, sizes and lengths stay out of the address bar.
const APP_LINK_KEYS = new Set(["tool_id", "tool", "template"]);
function appHref(params, video) {
  const query = new URLSearchParams(Object.entries(params).filter(([key, value]) => value && APP_LINK_KEYS.has(key)));
  return `/app/create?${query.toString()}${video ? "#step-video" : ""}`;
}
function hrefWithPrompt(href) {
  return href;
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
function actorSeedancePrompt(actor) {
  return `Use the uploaded product image as context. In a ${actor.scene} setting, ${actor.talent} speaks to camera about the uploaded product and says: "${actor.line}" ${actor.action} Handheld front-camera selfie, eye-level chest-up framing, natural light and skin texture, casual creator delivery with slight natural sway. Sound: ${actor.ambient}; no music, text or logos.`;
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
  { name: "Starter", price: "$24.50", credits: "200", who: "For trying video ads and product photos.", features: ["Videos and photos", "All templates", "9:16, 1:1, 16:9, 4:3 and 3:4 video sizes", "No watermark"], popular: false },
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

// A maker can show one exact video length or a list of supported lengths. Only
// an exact value can safely prefill links without changing a page's promise.
function displayedMakerVideoLength(options) {
  const configured = Array.isArray(options) ? options.find(([label]) => String(label).toLowerCase() === "length")?.[1] : undefined;
  const matches = [...String(configured ?? "").matchAll(/\b(6|10|15|30)\b/g)].map((match) => match[1]);
  return matches.length === 1 ? matches[0] : undefined;
}

function visualLength(options, requested, pageId) {
  const configured = options.find(([label]) => String(label).toLowerCase() === "length")?.[1];
  const raw = requested ?? configured;
  const length = Number(String(raw ?? "15").match(/\d+/)?.[0] ?? 15);
  assert.ok(VISUAL_VIDEO_LENGTHS.includes(length), `${pageId}: visual video length must be 6, 10, or 15 seconds`);
  return length;
}

// Count of real template pages, excluding the nine dynamic cards whose target is a tool page.
function realTemplateCount(model) {
  return model.cards.filter((card) => model.byId[card.pageId]?.type === "template").length;
}

// The photo hub hero collage shows the first photo tools as cards, matching its picker.
function toolHeroCardsForHub(model, page, configured) {
  if (page.id !== "photo-hub") return undefined;
  if (Array.isArray(configured) && configured.length) {
    return configured.map((item, index) => {
      const image = mediaImage(model, String(item.ref), "card");
      return {
        key: `photo-hub-hero-${index + 1}`,
        name: String(item.name ?? "Product photo"),
        line: String(item.line ?? "Product photo for your store or ad"),
        kind: "photo",
        href: String(item.href ?? page.url),
        image,
        tags: [],
        industries: [],
        platforms: []
      };
    });
  }
  return applyCardOverrides(model, page, (TOOL_REL[page.id] || []).slice(0, 3).map((key) => cardRef(model, key, "primary")).filter(Boolean));
}

function visualImage(model, ref, kind) {
  assert.ok(typeof ref === "string" && ref.trim(), "visual media ref is required");
  const image = mediaImage(model, ref, "card");
  return { src: image.src, w: image.width, h: image.height, alt: image.alt, kind: kind ?? (ref.startsWith("f:") ? "video" : "photo") };
}

// Pages whose on-page case wall follows the tagshop pattern: the wall's "Explore More"
// button leads to the site-wide inspiration gallery instead of staying on the page maker.
const CASE_WALL_PAGES = new Set([
  "image-to-video", "url-to-video", "video-ads", "product-videos", "unboxing-videos", "before-after-videos",
  "spokesperson-videos", "white-background", "lifestyle-photos", "model-photos", "change-background", "social-ad-photos"
]);
const ACTOR_SCENE_PAGES = new Set(["product-videos", "unboxing-videos", "before-after-videos"]);

function sellerScenariosFor(model, page, source) {
  if (!source || typeof source !== "object" || !Array.isArray(source.items)) return undefined;
  const items = source.items.map((item, index) => {
    assert.ok(item && typeof item === "object", `${page.id}: seller scenario ${index + 1} must be an object`);
    const toolId = String(item.tool ?? "");
    const tool = model.byId[toolId];
    assert.ok(tool, `${page.id}: seller scenario ${index + 1} tool ${toolId} does not exist`);
    const ref = String(item.ref ?? "");
    assert.ok(ref, `${page.id}: seller scenario ${index + 1} needs a media ref`);
    return {
      audience: String(item.audience ?? ""),
      tool: tool.label,
      // Opens the workspace for that tool; a link back to a tool page (often
      // this very page) is not a next step for the reader.
      href: toolAppHref(model, tool),
      task: String(item.task ?? ""),
      image: mediaImage(model, ref, "card")
    };
  }).filter((item) => item.audience && item.task && item.image);
  if (!items.length) return undefined;
  return {
    title: String(source.title ?? "How sellers like you use these tools"),
    lead: String(source.lead ?? "Example seller scenes show where each workflow fits."),
    items
  };
}

function actorScenePickerFor(model, page) {
  const actorSource = model.content["ai-actors"]?.actor_visual ?? {};
  const copy = model.content[page.id]?.actor_scene_picker ?? {};
  const pageCta = copy.actor_picker?.cta;
  const cta = pageCta && typeof pageCta === "object" && typeof pageCta.prompt === "string" && pageCta.prompt.trim()
    ? { label: typeof pageCta.label === "string" && pageCta.label.trim() ? pageCta.label : String(copy.button ?? "Use this avatar and scene"), prompt: pageCta.prompt }
    : undefined;
  const configured = Array.isArray(actorSource.steps?.actor_cards) ? actorSource.steps.actor_cards : [];
  const byRef = new Map((model.content["ai-actors"]?.actor_cards ?? []).map((actor) => [actor.ref, actor]));
  const actors = configured.map((item, index) => {
    const ref = typeof item === "string" ? item : item?.ref;
    const actor = byRef.get(ref);
    assert.ok(actor, `${page.id}: actor scene picker actor ${ref ?? index + 1} does not exist`);
    return {
      id: actor.id,
      name: actor.name,
      scene: actor.scene,
      image: mediaImage(model, ref, "card"),
      promptTemplate: actorSeedancePrompt({ ...actor, scene: "{{scene}}" }),
      ...(index === 0 ? { selected: true } : {})
    };
  });
  const scenes = Array.isArray(model.content["ai-actors"]?.actor_scenes)
    ? model.content["ai-actors"].actor_scenes.map(String).filter(Boolean)
    : [];
  const size = displayedMakerVideoSize(model, page) ?? "9:16";
  return {
    title: String(copy.title ?? "Choose your avatar and scene"),
    lead: String(copy.lead ?? "Pick a presenter and setting, then carry both choices into the video workspace."),
    button: String(copy.button ?? "Use this avatar and scene"),
    tool: page.id,
    size,
    length: 10,
    actors,
    scenes,
    ...(cta ? { cta } : {})
  };
}

// A case card's pre-filled prompt. Pick up the prompt the case plan recorded when it has
// one, otherwise describe the finished scene from the case title and product so every
// wall card opens the workspace with a usable prompt.
function genericCasePrompt(model, page, card) {
  const explicit = typeof card.prompt === "string" ? card.prompt : "";
  if (explicit.trim()) return explicit;
  const product = card.product || card.label;
  const kind = card.kind === "video" || card.videoExample ? "video" : "photo";
  if (kind === "photo") return `Recreate the ${product} photo: use my uploaded product image and keep the product, its shape and colors exactly, with the same framing and setting.`;
  return `Recreate the ${product} scene: use my uploaded product image and keep its shape, colors and label area exactly, matching the ${page.label} result shown on this card. Handheld creator framing, natural light, no text or logos.`;
}

function caseDisplayLabel(value) {
  const words = String(value ?? "").trim().split(/\s+/u).filter(Boolean);
  if (words.length <= 6) return words.join(" ");
  return `${words.slice(0, 6).join(" ").replace(/[,:;]$/u, "")}`;
}

function visualFor(model, page, source, maker, group, buttonHref, content, extraCaseCards = []) {
  if (source == null) return undefined;
  assert.ok(source && typeof source === "object" && !Array.isArray(source), `${page.id}: visual must be an object`);
  const video = group === "video";
  const steps = source.steps && typeof source.steps === "object" ? source.steps : {};
  const stepMode = steps.mode ?? (video ? "video" : "photo");
  assert.ok(stepMode === "photo" || stepMode === "video", `${page.id}: visual step mode must be photo or video`);
  const configuredOptions = Array.isArray(maker?.options) ? maker.options.slice(0, 3) : [];
  const options = Array.isArray(steps.options) ? steps.options : (stepMode === "video" ? maker?.videoOptions : maker?.photoOptions) ?? configuredOptions;
  const displayedLength = stepMode === "video"
    ? (displayedMakerVideoLength(configuredOptions) ?? (configuredOptions.length ? undefined : displayedMakerVideoLength(options)))
    : undefined;
  const stepLength = stepMode === "video" ? visualLength(options, steps.length, page.id) : undefined;
  const stepCredits = stepMode === "video" ? JOB_CREDITS[`video${stepLength}`] : JOB_CREDITS.photo;
  const stepItems = Array.isArray(content.steps) ? content.steps : Array.isArray(steps.items) ? steps.items : [];
  const actorCards = Array.isArray(steps.actor_cards) ? steps.actor_cards.map((item, index) => {
    const ref = typeof item === "string" ? item : item?.ref;
    assert.ok(typeof ref === "string" && ref.trim(), `${page.id}: actor step card ${index + 1} needs a media ref`);
    const label = typeof item === "string" ? `Actor ${index + 1}` : String(item.label ?? `Actor ${index + 1}`);
    return { image: visualImage(model, ref, "video"), label, ...(item && typeof item === "object" && item.selected ? { selected: true } : {}) };
  }) : [];
  const pickerSource = source.picker && typeof source.picker === "object" ? source.picker : {};
  const picker = Array.isArray(pickerSource) ? {} : pickerSource;
  const pickerCards = Array.isArray(picker.cards) ? picker.cards : [];
  const chips = Array.isArray(pickerSource) ? pickerSource : Array.isArray(picker.chips) ? picker.chips : [];
  const pickerChipIds = chips.map((chip) => String(chip.id ?? ""));
  const buildPickerCard = (card) => {
        const cardKind = card.kind;
        assert.ok(cardKind === "photo" || cardKind === "video", `${page.id}: visual picker card kind must be photo or video`);
        const image = visualImage(model, card.ref, cardKind);
        const routeTool = card.videoTool ?? card.tool;
        const target = routeTool ? model.byId[routeTool] : undefined;
        assert.ok(!routeTool || target, `${page.id}: visual picker tool ${routeTool} does not exist`);
        const entry = { kind: cardKind === "video" ? "scene" : "photo" };
        // Picker cards are make-this examples on every page, hubs included: each
        // opens the workspace with its own prompt (as the competitor's
        // "Recreate what you love" cards do), never a generic tool page.
        const promptOverride = card.prompt || genericCasePrompt(model, page, card);
        const preserveHubToolLink = false;
        const href = preserveHubToolLink
          ? target.url
          : target
          ? target.group === "video"
            ? toolAppHref(model, target, card.template, { size: card.size ?? videoSizeForDimensions(image.w, image.h) ?? displayedMakerVideoSize(model, page), explicitSize: true, length: card.length ?? displayedLength ?? "15", promptOverride })
            : toolAppHref(model, target, card.template, { promptOverride })
          : caseTarget(model, page, entry, { width: image.w, height: image.h }, cardKind === "video", promptOverride);
        return { image, label: card.label ?? "", chips: Array.isArray(card.chips) ? card.chips.map(String) : [], href, prompt: String(card.prompt ?? genericCasePrompt(model, page, card) ?? ""), kind: cardKind, ...(card.tool ? { tool: card.tool } : {}) };
      };
  const pickerBuiltCards = pickerCards.map(buildPickerCard);
  // Case-plan cases join the on-page wall only when the source page defines a
  // picker. An intentionally empty picker means the competitor has no scene
  // gallery, so generated case cards must not silently repopulate it.
  for (const caseCard of pickerChipIds.length ? extraCaseCards : []) {
    // Keep the picker within the public wall's 8-16 card contract. The source
    // picker already contains curated examples; case-plan rows fill remaining
    // slots without making an overlong wall.
    if (pickerBuiltCards.length >= 16) break;
    const kind = caseCard.kind === "video" || caseCard.videoExample ? "video" : "photo";
    const prompt = genericCasePrompt(model, page, caseCard);
    const image = { src: caseCard.image.src, w: caseCard.image.width, h: caseCard.image.height, alt: caseCard.image.alt, kind };
    const href = caseTarget(model, page, { kind: kind === "video" ? "scene" : "photo" }, { width: image.w, height: image.h }, kind === "video", prompt);
    pickerBuiltCards.push({ image, label: caseDisplayLabel(caseCard.name), chips: pickCaseChips(page, pickerChipIds, caseCard, pickerBuiltCards.length), href, prompt, kind });
  }
  const pickerHref = CASE_WALL_PAGES.has(page.id) ? "/inspiration" : buttonHref;

  const overviewRows = Array.isArray(content.overview) ? content.overview : [];
  const overviewValue = overviewRows[0];
  const overview = typeof source.overview === "string" ? source.overview : typeof overviewValue === "string" ? overviewValue : overviewValue?.d ?? overviewValue?.p ?? content.intro?.[0] ?? "";
  const limits = content.limitations?.items ?? [];
  const visual = {
    strip: (Array.isArray(source.strip) ? source.strip : []).map((ref) => visualImage(model, ref)),
    ...(steps.source && steps.result ? { steps: {
      source: { ...visualImage(model, steps.source, "photo"), ...(steps.sourceAlt ? { alt: String(steps.sourceAlt) } : {}) },
      ...(steps.sourceTitle ? { sourceTitle: normalizeStepLabel(String(steps.sourceTitle)) } : {}),
      ...(steps.sourceHint ? { sourceHint: String(steps.sourceHint) } : {}),
      result: {
        ...visualImage(model, steps.result, stepMode === "video" ? "video" : "photo"),
        ...(steps.resultPosition ? { objectPosition: String(steps.resultPosition) } : {})
      },
      options,
      credits: `${stepCredits} credits`,
      ...(steps.prompt ? { prompt: String(steps.prompt) } : {}),
      mode: stepMode,
      items: stepItems.map((item) => ({ t: normalizeStepLabel(item.t ?? ""), d: item.d ?? "" })),
      ...(actorCards.length ? { actorCards } : {})
    } } : {}),
    picker: {
      title: picker.title ?? source.titles?.m3?.h2 ?? "",
      ...(picker.lead ? { lead: picker.lead } : {}),
      chips: chips.map((chip) => ({ id: String(chip.id ?? ""), label: String(chip.label ?? "") })),
      cards: pickerBuiltCards,
      button: picker.button ?? "",
      href: pickerHref
    },
    uses: (Array.isArray(source.uses) ? source.uses : []).map((item) => {
      const imageRef = item.img ?? item.ref;
      const image = visualImage(model, imageRef, video ? "video" : "photo");
      const rowImage = typeof item.img === "string" && item.img.trim()
        ? mediaImage(model, item.img, "gallery")
        : undefined;
      const prompt = typeof item.prompt === "string" && item.prompt.trim() ? item.prompt : undefined;
      const configuredHref = typeof item.href === "string" && item.href.trim() ? item.href : undefined;
      const href = prompt
        ? hrefWithPrompt(configuredHref ?? toolAppHref(model, page, undefined, { promptOverride: prompt }), prompt)
        : configuredHref;
      return {
        frame: item.frame,
        image,
        ...(rowImage ? { img: item.alt ? { ...rowImage, alt: String(item.alt) } : rowImage } : {}),
        ...(item.alt ? { alt: String(item.alt) } : {}),
        ...(item.frame === "split" ? { imageB: visualImage(model, item.ref_b, video ? "video" : "photo") } : {}),
        h: item.h ?? "", d: item.d ?? "",
        ...(href ? { href } : {}),
        ...(prompt ? { prompt } : {})
      };
    }),
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
      items: Array.isArray(source.after.items) ? source.after.items.map(String) : [],
      ...(source.after.mock && typeof source.after.mock === "object" ? { mock: source.after.mock } : {})
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

// Footer "Related links" block: 8-12 canonical public pages that match the
// page task. Suggestions are derived from the page type and its industry,
// platform, tool and template fields; content may provide an explicit list.
const RELATED_PAGE_TYPES = new Set(["tool", "hub-tool", "hub", "template", "industry", "platform", "occasion", "article"]);
const RELATED_INDEX_IDS = new Set(["templates", "industries", "platforms"]);

function isRelatedPage(model, page, id) {
  if (typeof id !== "string" || id === page.id) return false;
  const target = model.byId[id];
  if (!target || (!RELATED_PAGE_TYPES.has(target.type) && !RELATED_INDEX_IDS.has(id))) return false;
  return typeof target.url === "string" && target.url.startsWith("/") && !target.url.includes("#") && !target.url.includes("?");
}

function relatedLinkItem(model, id) {
  const page = model.byId[id];
  assert.ok(page, `related link target missing: ${id}`);
  return { label: page.label, href: page.url };
}

function relatedManualId(model, value) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return undefined;
  if (typeof value.id === "string") return value.id;
  if (typeof value.pageId === "string") return value.pageId;
  if (typeof value.href === "string") return model.pages.find((page) => page.url === value.href)?.id;
  return undefined;
}

function relatedManualItem(model, value) {
  const id = relatedManualId(model, value);
  if (!id) return undefined;
  const page = model.byId[id];
  return page ? { label: typeof value === "object" && typeof value.label === "string" ? value.label : page.label, href: page.url } : undefined;
}

function relatedPageIds(model, predicate) {
  return model.cards
    .filter((card) => model.byId[card.pageId]?.type === "template" && predicate(card, model.byId[card.pageId]))
    .map((card) => card.pageId);
}

function relatedSuggestionsFor(model, page) {
  const templateIds = (predicate) => relatedPageIds(model, predicate);
  const templateIdsForGroup = (group) => templateIds((_card, target) => target.group === group);
  const industryIdsForTool = (toolId) => Object.entries(IND_TOOLS)
    .filter(([, tools]) => tools.includes(toolId)).map(([slug]) => `ind-${slug}`);
  const platformIdsForTool = (toolId) => Object.entries(PLAT_TOOLS)
    .filter(([, tools]) => tools.includes(toolId)).map(([slug]) => `plat-${slug}`);
  const siblingTools = (group, id) => (group === "video" ? VIDEO_TOOLS : PHOTO_TOOLS).filter((toolId) => toolId !== id);
  const templatesForTool = (toolId) => (TOOL_REL[toolId] || [])
    .map((key) => model.cardByKey[key]?.pageId)
    .filter((id) => model.byId[id]?.type === "template");

  if (page.type === "home") {
    return [
      ...VIDEO_TOOLS.slice(0, 4), ...PHOTO_TOOLS.slice(1, 4),
      ...HOME_FEATURED.map((key) => model.cardByKey[key]?.pageId),
      ...VIDEO_TOOLS.slice(4), ...PHOTO_TOOLS.slice(4)
    ];
  }
  if (page.type === "hub" || page.type === "hub-tool") {
    const group = page.group === "video" ? "video" : "photo";
    const tools = (group === "video" ? VIDEO_TOOLS : PHOTO_TOOLS).filter((id) => id !== page.id);
    const templates = templateIdsForGroup(group);
    const platforms = group === "video" ? ["plat-tiktok", "plat-instagram", "plat-youtube-shorts"] : ["plat-amazon", "plat-shopify", "plat-instagram"];
    return [...tools, ...templates, ...platforms, ...Object.keys(IND_TOOLS).map((slug) => `ind-${slug}`)];
  }
  if (page.type === "tool") {
    return [
      ...siblingTools(page.group, page.id),
      ...templatesForTool(page.id),
      ...industryIdsForTool(page.id), ...platformIdsForTool(page.id),
      page.group === "video" ? "video-hub" : "photo-hub"
    ];
  }
  if (page.type === "template") {
    const sameKind = model.cards.filter((card) => card.pageId !== page.id && card.kind === page.group);
    const matching = sameKind
      .filter((card) => card.ind.some((id) => page.industries.includes(id)) || card.plat.some((id) => page.platforms.includes(id)) || card.occ.some((id) => (page.occasions ?? []).includes(id)))
      .map((card) => card.pageId);
    const fallback = sameKind.map((card) => card.pageId);
    return [
      page.made_with,
      ...matching, ...page.industries.map((slug) => `ind-${slug}`), ...page.platforms.map((slug) => `plat-${slug}`),
      ...(page.occasions ?? []).map((slug) => `occ-${slug}`),
      ...fallback,
      page.group === "video" ? "video-hub" : "photo-hub"
    ];
  }
  if (page.type === "industry" || page.type === "platform" || page.type === "occasion") {
    const slug = page.id.split("-").slice(1).join("-");
    const field = { industry: "ind", platform: "plat", occasion: "occ" }[page.type];
    const tools = (page.type === "industry" ? IND_TOOLS[slug] : page.type === "platform" ? PLAT_TOOLS[slug] : OCCASION_TOOLS) || [];
    const matchingTemplates = templateIds((card) => card[field]?.includes(slug));
    const relatedCollections = page.type === "industry"
      ? ["industries", ...Object.keys(IND_TOOLS).filter((id) => id !== slug).map((id) => `ind-${id}`)]
      : page.type === "platform"
        ? ["platforms", ...Object.keys(PLAT_TOOLS).filter((id) => id !== slug).map((id) => `plat-${id}`)]
        : ["templates", "photo-hub", "video-hub", ...OCCASION_IDS.filter((id) => id !== page.id)];
    return [...tools, ...matchingTemplates, ...relatedCollections,
      ...(page.type === "platform" ? Object.keys(IND_TOOLS).filter((id) => model.cards.some((card) => card.plat.includes(slug) && card.ind.includes(id))).map((id) => `ind-${id}`) : [])];
  }
  if (page.type === "index" && page.id === "industries") {
    return [
      ...model.pages.filter((item) => item.type === "tool" && ["photo", "video"].includes(item.group)).map((item) => item.id),
      "templates", "photo-hub", "video-hub"
    ];
  }
  if (page.type === "index" && page.id === "templates") {
    return [
      ...VIDEO_TOOLS.slice(0, 4), ...PHOTO_TOOLS.slice(1, 4),
      ...model.pages.filter((item) => item.type === "template").slice(0, 4).map((item) => item.id),
      "platforms", "industries"
    ];
  }
  if (page.type === "index" && page.id === "platforms") {
    return [
      ...Object.keys(PLAT_TOOLS).map((slug) => `plat-${slug}`),
      ...VIDEO_TOOLS.slice(0, 2), ...PHOTO_TOOLS.slice(1, 3), "templates", "industries"
    ];
  }
  return [];
}

function relatedLinksFor(model, page, suggested = relatedSuggestionsFor(model, page), target = 10) {
  const content = model.content[page.id] ?? {};
  const asked = Array.isArray(content.relatedLinks) ? content.relatedLinks : Array.isArray(content.related_links) ? content.related_links : null;
  // An explicit list is authoritative. It may contain ids or canonical link objects;
  // never append generated links to it.
  if (asked?.length) {
    const links = [];
    const seen = new Set();
    for (const value of asked) {
      const id = relatedManualId(model, value);
      if (id && isRelatedPage(model, page, id) && !seen.has(id)) {
        links.push(relatedManualItem(model, value));
        seen.add(id);
      }
    }
    return links.length ? links : undefined;
  }
  const ids = [];
  for (const id of suggested) {
    if (isRelatedPage(model, page, id) && !ids.includes(id)) ids.push(id);
    if (ids.length >= target) break;
  }
  if (ids.length < 8) return undefined;
  return ids.map((id) => relatedLinkItem(model, id));
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
    if ((group.templates ?? []).includes(card.key)) return true;
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
  industries: { title: "Make Content for Your Products", lead: "Upload one product photo and pick a template made for your category." },
  platforms: { title: "Make Ads for the Platforms You Sell On", lead: "Upload one product photo and pick the size for where your ad will run." },
  blog: { title: "Try It With Your Own Product", lead: "Upload one product photo and turn it into a video ad or store-ready photos." },
  guides: { title: "Put the Guides Into Practice", lead: "Upload one product photo and try what you just read." }
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
  ebike: "video-ads", bottle: "social-ad-photos", "travel-mug": "lifestyle-photos", necklace: "model-photos", "linen-tote": "social-ad-photos", "fluted-vase": "lifestyle-photos",
  "leather-wallet": "model-photos", "running-shoe": "lifestyle-photos", sunscreen: "model-photos", sunglasses: "lifestyle-photos", coffee: "lifestyle-photos", candle: "lifestyle-photos",
  phonecase: "lifestyle-photos", yogamat: "lifestyle-photos", hotsauce: "social-ad-photos"
};

// "Where to Go Next" links on the simple pages, so each one leads on to the pages a
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
    ["Product Photo Tips", "/guides/product-photo-tips", "How to take a photo that gives good results."],
    ["Contact Support", "/contact-us", "Email us if your question isn't answered here."],
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
    ["Contact Support", "/contact-us", "Questions about a plan or a charge."]
  ],
  trust: [
    ["Privacy Policy", "/privacy", "What we collect and how long we keep it."],
    ["Content Policy", "/content", "What you can and can't upload."],
    ["Refund Policy", "/refunds", "How refund reviews and credit returns work."],
    ["Contact Support", "/contact-us", "Report a problem with a result."],
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
// Benefits lists share the same item shape as steps; pass their descriptions through
// the same automatic linker so internal links resolve the same way on every layout.
function benefitsList(model, page, items) {
  // Benefits can carry page-owned image rows as well as icon cards. Resolve refs here
  // so the standard benefits section can render image-led competitor use cases before steps.
  return imageItemsFor(model, page, autoLinkPage(model, page, [], [items]).groups[0]);
}

const IMAGE_ITEM_FRAMES = new Set(["phone", "browser", "none"]);

// More-section and audience cards may opt into the image-led row treatment. Resolve
// their media references here so the public payload contains the same complete image
// shape as every other storefront image and never exposes an internal media ref.
function imageItemsFor(model, page, items) {
  return (items || []).map((item) => {
    const out = { ...item };
    if (typeof out.img === "string" && out.img.trim()) {
      const image = mediaImage(model, out.img, "gallery");
      out.img = typeof out.alt === "string" && out.alt.trim() ? { ...image, alt: out.alt } : image;
    }
    if (out.frame !== undefined && !IMAGE_ITEM_FRAMES.has(out.frame)) {
      assert.fail(`${page.id}: image item frame must be phone, browser or none`);
    }
    if (out.alt !== undefined && (typeof out.alt !== "string" || !out.alt.trim())) {
      assert.fail(`${page.id}: image item alt must be a non-empty string`);
    }
    return out;
  });
}

// Prose sections may carry one page-owned image after their paragraphs. Keep the
// source ref out of the public payload while preserving the section copy and links.
function proseSectionsFor(model, page, sections, label = "section") {
  assert.ok(Array.isArray(sections), `${page.id}: ${label}s must be an array`);
  return sections.map((section, index) => {
    assert.ok(section && typeof section === "object" && !Array.isArray(section), `${page.id}: ${label} ${index + 1} must be an object`);
    assert.ok(Array.isArray(section.paras), `${page.id}: ${label} ${index + 1} paragraphs must be an array`);
    const out = { ...section, paras: section.paras.map((para) => inlineLinks(model, para, page.id)) };
    if (section.img !== undefined) {
      assert.ok(typeof section.img === "string" && section.img.trim(), `${page.id}: ${label} ${index + 1} img must be a media ref`);
      const image = mediaImage(model, section.img, "gallery");
      out.img = typeof section.alt === "string" && section.alt.trim() ? { ...image, alt: section.alt } : image;
    }
    if (section.alt !== undefined) assert.ok(typeof section.alt === "string" && section.alt.trim(), `${page.id}: ${label} ${index + 1} alt must be a non-empty string`);
    return out;
  });
}

function articleSectionsFor(model, page, sections) {
  return proseSectionsFor(model, page, sections, "article section");
}

// Optional page-owned sections keep their stored shape; only the item descriptions run
// through the same automatic internal linker as benefit cards.
function moreSectionsFor(model, page, sections) {
  if (!Array.isArray(sections)) return undefined;
  const groups = sections.map((section) => Array.isArray(section?.items) ? section.items : []);
  const linked = autoLinkPage(model, page, [], groups).groups;
  return sections.map((section, index) => ({
    eyebrow: section.eyebrow ?? "",
    h2: section.h2,
    ...(section.lead ? { lead: section.lead } : {}),
    items: imageItemsFor(model, page, linked[index])
  }));
}

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
  ebike: [null, [["Your product", "n:guide:plat-youtube-shorts-size-portrait-ebike"], ["Video ad", "f:video-hub-h1-bike"]]],
  "travel-mug": ["lifestyle-scene", [["Your product", "source-input"], ["Sunny cafe", "example-01"], ["City bike", "example-03"]]],
  necklace: ["jewelry-positioning", [["Your product", "source-input"], ["Worn on a dark top", "example-01"], ["Pendant detail", "example-05"]]],
  "linen-tote": ["sale-campaign-key-visual", [["Your product", "source-input"], ["Worn outdoors", "example-02"], ["Snowy city", "example-05"]]],
  "fluted-vase": [null, [["Your product", "n:lipstick-pack"], ["On a vanity", "n:lipstick-vanity"], ["Shade swatch", "n:lipstick-swatch"]]],
  "leather-wallet": [null, [["Your product", "n:hoodie-pack"], ["Worn outdoors", "n:hoodie-street"], ["Flat lay", "n:hoodie-flatlay"]]],
  "running-shoe": [null, [["Your product", "n:handbag-pack"], ["Cafe table", "n:handbag-cafe"], ["Carried outdoors", "n:handbag-carry"]]],
  sunscreen: [null, [["Your product", "n:boots-pack"], ["On cobblestones", "n:boots-street"], ["By the door", "n:boots-doorway"]]],
  sunglasses: [null, [["Your product", "n:sunglasses-pack"], ["Cafe table", "n:sunglasses-cafe"], ["Worn outdoors", "n:sunglasses-worn"]]],
  coffee: [null, [["Your product", "n:coffee-pack"], ["Kitchen counter", "n:coffee-counter"], ["Breakfast table", "n:coffee-breakfast"]]],
  candle: [null, [["Your product", "n:candle-pack"], ["Living room", "n:candle-table"], ["Bath edge", "n:candle-bath"]]],
  phonecase: [null, [["Your product", "n:phonecase-pack"], ["On a desk", "n:phonecase-desk"], ["In a hand", "n:phonecase-hand"]]],
  yogamat: [null, [["Your product", "n:yogamat-pack"], ["Bright room", "n:yogamat-room"], ["In use", "n:yogamat-pose"]]],
  hotsauce: [null, [["Your product", "n:hotsauce-pack"], ["Over tacos", "n:hotsauce-tacos"], ["With fresh chilies", "n:hotsauce-peppers"]]]
};

// These aliases let older home-page data render while the public examples use the descriptive IDs.
const EXAMPLE_ID_ALIASES = { tote: "travel-mug", jacket: "linen-tote", lipstick: "fluted-vase", hoodie: "leather-wallet", handbag: "running-shoe", boots: "sunscreen" };
function exampleFlowKey(id) {
  return EXAMPLE_FLOWS[id] ? id : EXAMPLE_ID_ALIASES[id] ?? id;
}

function flowCta(model, id, item) {
  const tool = model.byId[FLOW_TOOL[exampleFlowKey(id)]];
  if (!tool) return {};
  const label = typeof item?.ctaLabel === "string" && item.ctaLabel.trim() ? item.ctaLabel : "Try this with your product";
  const prompt = typeof item?.ctaPrompt === "string" && item.ctaPrompt.trim() ? item.ctaPrompt : undefined;
  return { cta: { label, href: toolAppHref(model, tool, undefined, prompt ? { promptOverride: prompt } : {}) } };
}

function exampleFlow(model, item) {
  if (item.id === "bottle") {
    return { t: item.t, d: item.d, ...flowCta(model, item.id, item), steps: [
      { label: "Lifestyle photo", image: imageRef(model, "bottle", "Green water bottle in a living room scene") },
      { label: "Feed ad", image: imageRef(model, "feedbottle", "Same water bottle in a sunlit feed ad") }] };
  }
  const flow = EXAMPLE_FLOWS[exampleFlowKey(item.id)];
  assert.ok(flow, `unknown example flow ${item.id}`);
  return { t: item.t, d: item.d, ...flowCta(model, item.id, item), steps: flow[1].map(([label, file], index) => ({
    label: normalizeStepLabel(item.imageLabels?.[index] || label),
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

// A plain text definition block (title + paragraphs) placed right after the hero on tool pages.
function definitionFor(model, page, c) {
  const value = c.definition;
  if (!value || typeof value !== "object" || typeof value.title !== "string" || !value.title.trim()) return undefined;
  const paras = Array.isArray(value.paras) ? value.paras.filter((para) => typeof para === "string" && para.trim()) : [];
  if (!paras.length) return undefined;
  return { title: value.title, paras: paras.map((para) => inlineLinks(model, para, page.id)) };
}

// A three-column comparison table (row header, our column, competitor/traditional column).
function compareTableFor(model, page, c) {
  const value = c.compare_table;
  if (!value || typeof value !== "object" || typeof value.title !== "string" || !value.title.trim()) return undefined;
  if (!Array.isArray(value.columns) || value.columns.length !== 3) return undefined;
  const rows = Array.isArray(value.rows)
    ? value.rows.filter((row) => Array.isArray(row) && row.length === 3 && row.every((cell) => typeof cell === "string" && cell.trim()))
    : [];
  if (!rows.length) return undefined;
  return {
    title: value.title,
    ...(typeof value.lead === "string" && value.lead.trim() ? { lead: inlineLinks(model, value.lead, page.id) } : {}),
    columns: value.columns.map((column) => String(column)),
    rows: rows.map((row) => row.map((cell) => inlineLinks(model, cell, page.id)))
  };
}

// Linked card sections for directory/index pages (format and category blocks may carry page-owned images).
function textSectionsFor(model, page, c) {
  const value = c.text_sections;
  if (!Array.isArray(value)) return [];
  return value.map((section) => {
    const cards = imageItemsFor(model, page, (Array.isArray(section.cards) ? section.cards : []).map((card) => {
      const d = inlineLinks(model, String(card.d ?? ""), page.id);
      const out = { t: String(card.t ?? ""), d, ...(card.href ? { href: resolveSectionHref(model, page.id, card.href) } : {}) };
      if (typeof card.label === "string" && card.label.trim()) out.label = card.label;
      if (typeof card.img === "string" && card.img.trim()) out.img = card.img;
      if (typeof card.alt === "string" && card.alt.trim()) out.alt = card.alt;
      return out;
    })).filter((card) => card.t && card.d);
    return {
      eyebrow: String(section.eyebrow ?? ""),
      title: String(section.title ?? ""),
      ...(typeof section.lead === "string" && section.lead.trim() ? { lead: inlineLinks(model, section.lead, page.id) } : {}),
      cards
    };
  }).filter((section) => section.title && section.cards.length);
}

function resolveSectionHref(model, where, target) {
  const value = String(target ?? "");
  if (value.startsWith("page:")) {
    const page = model.byId[value.slice(5)];
    assert.ok(page, `${where}: link target ${value} not found`);
    return page.url;
  }
  const localPath = localPathFromAbsoluteUrl(value);
  const href = localPath ?? value;
  assert.ok(href && (model.pages.some((page) => page.url === href) || POLICY_PATHS.includes(href)), `${where}: link target ${value} not found`);
  return href;
}

// Blocks a page can list in `blockOrder` (same list as V2_BLOCK_IDS in the v2 component types).
const REASON_ICON_NAMES = new Set(["Coins", "Captions", "DollarSign", "Gauge", "Calendar", "Camera", "CircleCheck", "Clapperboard", "Clock", "Copy", "Crop", "Droplet", "Eye", "FileText", "Film", "Gem", "Hand", "House", "Image", "Images", "Languages", "Laptop", "Layers", "LayoutGrid", "Link", "MessageCircle", "Mic", "Music", "Package", "Palette", "PenLine", "Play", "Ratio", "RefreshCw", "Repeat", "Rocket", "Ruler", "Scissors", "Share2", "ShieldCheck", "Shirt", "Smartphone", "Sparkles", "Star", "Store", "Sun", "Tag", "Target", "Timer", "Type", "UserCheck", "UserRound", "Users", "Utensils", "WandSparkles", "Zap"]);
const BLOCK_IDS = new Set(["hero", "definition", "strip", "picker", "reasons", "steps", "benefits", "features", "audience", "uses", "examples",
  "seller_scenarios", "compare", "related", "trust", "reviews", "faq", "closing", "pricing", "templates", "platforms", "directory", "cta",
  "plan", "sizes", "input", "outputs", "after", "limitations", "tools"]);
// Layouts whose page renderer follows `blockOrder` (only when the page has visual data).
const BLOCK_ORDER_LAYOUTS = new Set(["home", "video-hub", "tool", "template", "collection", "index"]);
const isBlock = (value) => Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof value.h2 === "string" && value.h2.trim() && Array.isArray(value.items) && value.items.length);

// A page-owned card block (reasons, trust, reviews, platforms). Card text may carry inline
// links; a card picture is a media ref resolved like other image items.
function cardBlockFor(model, page, block, key) {
  assert.ok(isBlock(block), `${page.id}: ${key} needs an h2 and items`);
  const items = imageItemsFor(model, page, block.items.map((item) => {
    assert.ok(item && typeof item.t === "string" && item.t.trim() && typeof item.d === "string" && item.d.trim(), `${page.id}: ${key} item needs t and d`);
    const out = { ...item, d: inlineLinks(model, item.d, page.id) };
    if (typeof item.href === "string" && item.href.trim()) {
      out.href = resolveSectionHref(model, `${page.id} ${key}`, item.href.startsWith("/") || item.href.startsWith("page:") ? item.href : `page:${item.href}`);
    }
    return out;
  }));
  return { h2: block.h2, ...(typeof block.lead === "string" && block.lead.trim() ? { lead: block.lead } : {}), items };
}

function pageBlocksFor(model, page, c) {
  const asked = Array.isArray(c.relatedLinks) ? c.relatedLinks : Array.isArray(c.related_links) ? c.related_links : null;
  const relatedLinks = asked?.length && page.type !== "tool" && page.type !== "hub-tool" ? relatedLinksFor(model, page) : undefined;
  const definition = page.type !== "tool" && page.type !== "hub-tool" ? definitionFor(model, page, c) : undefined;
  const compareTable = page.type !== "tool" && page.type !== "hub-tool" ? compareTableFor(model, page, c) : undefined;
  const text = (value) => typeof value === "string" && value.trim() ? value : undefined;
  return {
    ...(Array.isArray(c.blockOrder) ? { blockOrder: c.blockOrder } : {}),
    ...(c.reasons !== undefined ? { reasons: cardBlockFor(model, page, c.reasons, "reasons") } : {}),
    ...(c.trust !== undefined ? { trust: cardBlockFor(model, page, c.trust, "trust") } : {}),
    ...(c.reviews !== undefined ? { reviews: cardBlockFor(model, page, c.reviews, "reviews") } : {}),
    ...(isBlock(c.platforms) ? { platformLinks: cardBlockFor(model, page, c.platforms, "platforms") } : {}),
    ...(c.closing !== undefined ? { closing: { h2: c.closing?.h2, paras: (Array.isArray(c.closing?.paras) ? c.closing.paras : []).map((para) => inlineLinks(model, para, page.id)) } } : {}),
    ...(text(c.related_h2) ? { relatedH2: c.related_h2 } : {}),
    ...(text(c.related_lead) ? { relatedLead: c.related_lead } : {}),
    ...(text(c.benefits_lead) ? { benefitsLead: c.benefits_lead } : {}),
    ...(text(c.compare_h2) ? { compareH2: c.compare_h2 } : {}),
    ...(text(c.gallery_h2) ? { galleryH2: c.gallery_h2 } : {}),
    ...(text(c.gallery_lead) ? { galleryLead: c.gallery_lead } : {}),
    ...(relatedLinks?.length ? { relatedLinks } : {}),
    ...(definition ? { definition } : {}),
    ...(compareTable ? { compareTable } : {})
  };
}

function payloadFor(model, page) {
  const c = model.content[page.id];
  const examples = exampleGalleryFor(model, page);
  const sellerScenarios = sellerScenariosFor(model, page, c.seller_scenarios);
  const base = {
    id: page.id, label: page.label, eyebrow: c.eyebrow || page.label, h1: c.h1, lead: c.lead,
    breadcrumbs: page.id === "home" ? [] : breadcrumbTrail(model, page),
    faq: (c.faq || []).map((item) => ({ q: item.q, a: inlineLinks(model, item.a, page.id) })),
    startNote: page.type === "pricing" ? START_NOTE_PLAIN : START_NOTE,
    ...(typeof c.cta_title === "string" ? { ctaTitle: c.cta_title } : {}),
    ...(typeof c.cta_lead === "string" ? { ctaLead: c.cta_lead } : {}),
    ...(typeof c.templates_lead === "string" ? { templatesLead: c.templates_lead } : {}),
    ...(typeof c.benefits_h2 === "string" && c.benefits_h2.trim() ? { benefitsH2: c.benefits_h2 } : {}),
    ...(typeof c.steps_h2 === "string" && c.steps_h2.trim() ? { stepsH2: c.steps_h2 } : {}),
    ...(typeof c.steps_lead === "string" && c.steps_lead.trim() ? { stepsLead: c.steps_lead } : {}),
    ...(typeof c.maker?.upload_title === "string" ? { maker: { uploadTitle: c.maker.upload_title } } : {}),
    ...(Array.isArray(c.more_sections) ? { more_sections: moreSectionsFor(model, page, c.more_sections) } : {}),
    ...(examples ? { examples } : {}),
    ...(sellerScenarios ? { sellerScenarios } : {}),
    ...enrichmentFor(model, page, c),
    ...pageBlocksFor(model, page, c)
  };
  const t = page.type;
  if (t === "home") {
    // Per the tagshop standard the home template strip shows only real templates, never
    // cards that are tool pages; pick 4 video and 4 photo templates.
    const homeFeaturedKeys = HOME_TEMPLATE_KEYS;
    const homeTemplateCards = applyCardOverrides(model, page, homeFeaturedKeys.map((key) => cardRef(model, key, "alt")).filter(Boolean));
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
        ...(model.media.plan.pages.home?.hero?.kind === "loop" ? {} : { output: mediaImage(model, "g:feed-ad-still/hero-output", "inset"), versions: ["n:guide:img2-home-hero-shoe-r2-a", "n:guide:img2-home-hero-shoe-r2-b", "n:guide:img2-home-hero-shoe-r2-c"].map((ref) => mediaImage(model, ref, "inset")) }),
        videoHref, photoHref },
      make: {
        title: c.make_title,
        lead: c.make_lead,
        video: VIDEO_TOOLS.map((id) => {
          const card = toolRef(model, id);
          return { ...card, image: { ...card.image, alt: HOME_TOOL_ALTS[id] } };
        }),
        photo: PHOTO_TOOLS.map((id) => {
          const card = toolRef(model, id);
          return { ...card, image: { ...card.image, alt: HOME_TOOL_ALTS[id] } };
        })
      },
      templates: { title: c.templates_title, lead: c.templates_lead, cards: homeTemplateCards, total: realTemplateCount(model) },
      platforms: { title: c.platforms_title, items: Object.entries(model.plat).map(([slug, label]) => ({ label, href: model.byId[`plat-${slug}`].url, spec: (model.content[`plat-${slug}`].specs || [["", ""]])[0][1] })) },
      steps: c.steps, compare: c.compare, plans: PLANS,
      ...(Array.isArray(c.benefits) ? { benefits: benefitsList(model, page, c.benefits) } : {}),
      relatedGroups: [
        { title: "Video tools", links: pageLinksFor(model, ["product-videos", "url-to-video", "image-to-video", "ai-actors", "spokesperson-videos"]) },
        { title: "Photo tools", links: pageLinksFor(model, ["white-background", "lifestyle-photos", "change-background", "model-photos"]) }
      ],
      ...(c.ugc ? { ugc: { ...c.ugc, paras: (c.ugc.paras || []).map((para) => inlineLinks(model, para, page.id)) } } : {}),
      ...(c.audience ? { audience: { ...c.audience, items: imageItemsFor(model, page, (c.audience.items || []).map((item) => ({ ...item, d: inlineLinks(model, item.d, page.id) }))) } } : {}),
      exampleGallery: examples,
      examples: { flows: (c.example_flows || []).map((item) => exampleFlow(model, item)) }
    };
  }
  if (t === "hub") {
    const linkedCopy = autoLinkPage(model, page, c.intro, [c.benefits]);
    const hubAppHref = appHref({ tool: "video-ads", size: "9:16", length: "15" }, true);
    const relatedGroups = [
      { title: "Video Templates", links: templateLinksFor(model, "video", 8) },
      { title: "Channels and Campaigns", links: pageLinksFor(model, ["plat-tiktok", "tpl-bf"]) }
    ];
    const maker = {
      options: c.maker?.options ?? [["Frame", "9:16 · 1:1 · 16:9"], ["Length", "6, 10, or 15 seconds"]],
      cta: c.maker?.cta ?? "Make my video",
      href: hubAppHref
    };
    const visual = visualFor(model, page, c.visual, maker, "video", hubAppHref, c);
    // The hub template walls show only real video templates, never the dynamic cards
    // whose target is a tool page.
    const heroKeys = ["beauty", "bf", "launch"];
    const isRealVideoTemplate = (key) => model.cardByKey[key]?.kind === "video" && model.byId[model.cardByKey[key]?.pageId]?.type === "template";
    return { ...base, intro: linkedCopy.intro, benefits: linkedCopy.groups[0], steps: c.steps, maker,
      tools: VIDEO_TOOLS.map((id) => toolRef(model, id, true, model.cardOverrides?.[page.id]?.tools?.[id])),
      heroCards: applyCardOverrides(model, page, heroKeys.filter(isRealVideoTemplate).map((key) => cardRef(model, key, "primary")).filter(Boolean)),
      cards: applyCardOverrides(model, page, CARD_ORDER.filter((key) => isRealVideoTemplate(key) && !heroKeys.includes(key)).map((key) => cardRef(model, key, "primary")).filter(Boolean)),
      appHref: hubAppHref,
      relatedGroups,
      ...(visual ? { visual } : {}) };
  }
  if (t === "tool" || t === "hub-tool") {
    const hub = page.id === "photo-hub";
    const hasHero = Boolean(model.media.plan.pages[page.id]?.hero);
    const video = page.group === "video";
    const siblings = (video ? VIDEO_TOOLS : PHOTO_TOOLS).filter((id) => id !== page.id).map((id) => toolRef(model, id, false));
    const industryIds = Object.entries(IND_TOOLS).filter(([, tools]) => tools.includes(page.id)).map(([slug]) => `ind-${slug}`).slice(0, 5);
    const platformIds = Object.entries(PLAT_TOOLS).filter(([, tools]) => tools.includes(page.id)).map(([slug]) => `plat-${slug}`).slice(0, 5);
    const names = (ids) => ids.map((id) => model.byId[id].label).join(", ");
    const linkedCopy = autoLinkPage(model, page, c.intro, [c.benefits, c.uses || []]);
    const makerOptions = (c.maker?.options || []).slice(0, 3);
    const makerLength = video ? displayedMakerVideoLength(makerOptions) : undefined;
    const makerPrompt = typeof c.maker?.prompt === "string" && c.maker.prompt.trim()
      ? c.maker.prompt
      : typeof c.cta_prompt === "string" && c.cta_prompt.trim()
        ? c.cta_prompt
        : page.id === "url-to-video" && typeof c.visual?.steps?.prompt === "string" && c.visual.steps.prompt.trim()
          ? c.visual.steps.prompt
          : undefined;
    const makerTemplate = page.id === "url-to-video" ? undefined : TOOL_REL[page.id]?.[0];
    const makerHref = typeof c.maker?.href === "string" && c.maker.href.trim()
      ? hrefWithPrompt(c.maker.href, makerPrompt)
      : toolAppHref(model, page, makerTemplate, { ...(makerLength ? { length: makerLength } : {}), ...(makerPrompt ? { promptOverride: makerPrompt } : {}) });
    const maker = { options: makerOptions, cta: c.maker?.cta || (video ? "Make my video" : "Make my photos"), href: makerHref, urlInput: page.id === "url-to-video", ...(makerPrompt ? { prompt: makerPrompt } : {}), ...(typeof c.maker?.upload_title === "string" ? { uploadTitle: c.maker.upload_title } : {}) };
    // Per the tagshop link standard, tool pages have no "Templates for X" grid: the
    // case wall is the visual picker, and the page ends with one related-tools block.
    const wallCases = hub ? [] : caseCardsFor(model, page, [], c.visual?.picker?.cards ?? []);
    const visual = visualFor(model, page, c.visual, maker, page.group, maker.href, c, hub ? [] : wallCases);
    const actorScenePicker = ACTOR_SCENE_PAGES.has(page.id) ? actorScenePickerFor(model, page) : undefined;
    const relatedGroups = hub ? [
      { title: "Photo templates", links: templateLinksFor(model, "photo", 4) },
      { title: "Browse industries", links: pageLinksFor(model, ["ind-beauty-skincare", "ind-shoes", "ind-food-drinks", "ind-home-living"]) },
      { title: "Browse platforms", links: pageLinksFor(model, ["plat-amazon", "plat-shopify"]) }
    ] : [];
    const relatedLinks = relatedLinksFor(model, page);
    const heroCards = page.id === "white-background" || page.id === "spokesperson-videos" ? null
      : hasHero ? [] : hub ? toolHeroCardsForHub(model, page, c.hero_cards) : [];
    // Optional page-owned text blocks (competitor parity): a definition block after the hero
    // and a vs-traditional comparison table. Both are text-only; visuals stay in the visual modules.
    const definition = definitionFor(model, page, c);
    const compareTable = compareTableFor(model, page, c);
    return { ...base, group: page.group, intro: linkedCopy.intro, benefits: imageItemsFor(model, page, linkedCopy.groups[0]), steps: c.steps, uses: linkedCopy.groups[1],
      maker,
      ...(relatedGroups.length ? { relatedGroups } : {}),
      ...(relatedLinks?.length ? { relatedLinks } : {}),
      ...(visual ? { visual } : {}),
      ...(actorScenePicker ? { actorScenePicker } : {}),
      specs: [
        ...(video ? [["Sizes", "9:16 · 1:1 · 16:9"], ["Length", "6, 10, 15 or 30 seconds"], ["You start with", page.id === "url-to-video" ? "A product page link" : "1 product photo"], ["Cost", "Shown before you start"]]
          : [["Size", "Square by default"], ["You upload", "1 product photo"], ["You get", "A new product photo"], ["Cost", "Shown before you start"]]),
        ...(platformIds.length ? [["Best for", names(platformIds), specLinks(model, platformIds)]] : []),
        ...(industryIds.length ? [["Popular with", names(industryIds), specLinks(model, industryIds)]] : []),
        ...(OCCASION_TOOLS.includes(page.id) ? [["Good for", names(OCCASION_IDS), specLinks(model, OCCASION_IDS)]] : [])
      ],
      hero: page.id === "white-background" ? { single: imageRef(model, "p_white", "Running shoe on a pure white background") }
        : page.id === "spokesperson-videos" ? { single: mediaImage(model, "n:guide:img2-spokesperson-hero-r1", "hero") }
        : page.id === "photo-hub" ? { cards: heroCards ?? [] }
        : heroCards,
      siblings: hub ? [] : siblings, photoTools: hub ? PHOTO_TOOLS.slice(1).map((id) => toolRef(model, id)) : [],
      ...(definition ? { definition } : {}),
      ...(compareTable ? { compareTable } : {}) };
  }
  if (t === "template") {
    const key = page.id.slice(4);
    const tool = model.byId[page.made_with];
    const platformIds = page.platforms.map((slug) => `plat-${slug}`);
    const industryIds = page.industries.map((slug) => `ind-${slug}`);
    const occasionIds = (page.occasions ?? []).map((slug) => `occ-${slug}`);
    const names = (ids) => ids.map((id) => model.byId[id].label).join(", ");
    const linkedCopy = autoLinkPage(model, page, c.intro, [c.ideas || []]);
    // Per the tagshop standard, template detail pages no longer show a "More templates"
    // sibling grid; their case-plan cases join the visual picker wall.
    const wallCases = caseCardsFor(model, page, [], c.visual?.picker?.cards ?? []);
    const makerOptions = (c.maker?.options || [["Template", page.label], ["Output", page.output]]).slice(0, 3);
    const makerLength = page.group === "video" ? displayedMakerVideoLength(makerOptions) : undefined;
    const maker = { options: makerOptions, cta: c.maker?.cta || "Use this template", href: toolAppHref(model, tool, key, makerLength ? { length: makerLength } : {}), ...(typeof c.maker?.upload_title === "string" ? { uploadTitle: c.maker.upload_title } : {}) };
    const visual = visualFor(model, page, c.visual, maker, page.group, maker.href, c, wallCases);
    return { ...base, kind: page.group, intro: linkedCopy.intro, tip: c.tip, steps: c.steps, ideas: linkedCopy.groups[0],
      image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, `${page.label} template preview`),
      ...(Array.isArray(c.benefits) ? { benefits: benefitsList(model, page, c.benefits) } : {}),
      maker,
      ...(visual ? { visual } : {}),
      specs: [
        ["Output", page.output],
        page.platforms.length ? ["Best for", names(platformIds), specLinks(model, platformIds)] : ["Best for", "Your website"],
        page.industries.length ? ["Popular with", names(industryIds), specLinks(model, industryIds)] : ["Popular with", "Any brand"],
        ["Made with", tool.label, specLinks(model, [tool.id])],
        ...(occasionIds.length ? [["Good for", names(occasionIds), specLinks(model, occasionIds)]] : [])
      ],
      madeWith: { label: tool.label, href: tool.url } };
  }
  if (t === "industry" || t === "platform" || t === "occasion") {
    const slug = page.id.split("-").slice(1).join("-");
    const field = { industry: "ind", platform: "plat", occasion: "occ" }[t];
    const tools = (t === "industry" ? IND_TOOLS[slug] : t === "platform" ? PLAT_TOOLS[slug] : OCCASION_TOOLS) || [];
    const direct = model.cards.filter((card) => model.byId[card.pageId]?.type === "template" && card[field].includes(slug)).map((card) => card.key);
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
      // A page can set its own hero options and button; otherwise it borrows the recommended tool's.
      const toolMaker = c.maker ?? model.content[visualTool.id]?.maker ?? {};
      visualMaker = {
        options: (toolMaker.options || []).slice(0, 3),
        cta: toolMaker.cta || (visualMode === "video" ? "Make my video" : "Make my photos"),
        href: collectionHref
      };
      visual = visualFor(model, page, c.visual, visualMaker, visualMode, collectionHref, c);
      assert.ok(!(t === "occasion" && (c.plan || []).length) || String(c.visual.titles?.plan?.h2 || "").trim(), `${page.id}: an occasion page with a plan needs visual.titles.plan.h2`);
    }
    return { ...base, kind: t, intro: linkedCopy.intro, ideas: linkedCopy.groups[0], specs: c.specs || [], tips: c.tips || [], plan: c.plan || [],
      cards: [...listed, ...caseCards], heroCards: collage,
      tools: tools.map((id) => {
        const imageOverride = model.cardOverrides?.[page.id]?.tools?.[id];
        return t === "industry"
          ? toolRef(model, id, Boolean(imageOverride?.ref), imageOverride)
          : toolRef(model, id, false);
      }),
      appHref: collectionHref,
      ...(visual ? { visual, maker: visualMaker } : {}),
      ...(Array.isArray(c.benefits) ? { benefits: benefitsList(model, page, c.benefits) } : {}),
      ...(typeof c.steps_h2 === "string" && c.steps_h2.trim() ? { steps: benefitsList(model, page, c.steps ?? []) } : {}) };
  }
  if (t === "index") {
    const directorySpecs = c.directory_specs && typeof c.directory_specs === "object" && Array.isArray(c.directory_specs.columns) && Array.isArray(c.directory_specs.rows)
      ? {
          title: String(c.directory_specs.title || "Format guide"),
          ...(typeof c.directory_specs.lead === "string" ? { lead: c.directory_specs.lead } : {}),
          columns: c.directory_specs.columns.map(String),
          rows: c.directory_specs.rows.map((row) => Array.isArray(row) ? row.map(String) : [])
        }
      : undefined;
    const directoryScenes = Array.isArray(c.directory_scenes)
      ? c.directory_scenes.map((item) => ({
          t: String(item.t || ""),
          d: inlineLinks(model, String(item.d || ""), page.id),
          ...(typeof item.href === "string" ? { href: item.href } : {}),
          ...(typeof item.image === "string" ? { image: mediaImage(model, item.image, "card") } : {})
        })).filter((item) => item.t && item.d)
      : [];
    const out = { ...base, intro: Array.isArray(c.intro) ? c.intro.map((para) => inlineLinks(model, para, page.id)) : c.intro,
      ...(INDEX_CTA[page.id] ? { cta: { ...INDEX_CTA[page.id], href: "/app/create" } } : {}),
      ...(directorySpecs ? { directorySpecs } : {}),
      ...(directoryScenes.length ? { directoryScenes } : {}),
      ...(Array.isArray(c.benefits) ? { benefits: benefitsList(model, page, c.benefits) } : {}),
      ...(typeof c.steps_h2 === "string" && c.steps_h2.trim() ? { steps: benefitsList(model, page, c.steps ?? []) } : {}) };
    // Text-only linked card blocks (competitor parity, e.g. format and category directories).
    const textSections = textSectionsFor(model, page, c);
    if (textSections.length) out.textSections = textSections;
    const visual = visualFor(model, page, c.visual, { photoOptions: HOME_PHOTO_OPTIONS }, "photo", "/app/create", c);
    if (visual) out.visual = visual;
    if (page.id === "ai-actors") {
      const spokespersonTool = model.byId["spokesperson-videos"];
      const actorVisual = visualFor(model, page, c.actor_visual, { videoOptions: [["Frame", "9:16 vertical"], ["Length", "10 seconds"], ["Template", "Actor-led product ad"]] }, "video", toolAppHref(model, spokespersonTool, undefined, { size: "9:16", explicitSize: true, length: "10" }), c);
      if (actorVisual) out.visual = actorVisual;
      out.actorScenes = c.actor_scenes;
      out.howTo = c.how_to;
      out.honesty = c.honesty;
      out.actors = c.actor_cards.map((actor) => ({
        id: actor.id,
        name: actor.name,
        style: actor.style,
        scene: actor.scene,
        age: actor.age,
        gender: actor.gender,
        use: actor.use,
        category: actor.category,
        image: (() => {
          const image = mediaImage(model, actor.ref, "card");
          return { ...image, alt: String(image.alt ?? "").replace(/\bplain plain\b/gi, "plain").replace(/\bplain pair of plain sunglasses\b/gi, "plain sunglasses").replace(/\ba plain over-ear headphones\b/gi, "a pair of plain over-ear headphones").replace(/\ba office\b/gi, "an office").replace(/\ba outdoor\b/gi, "an outdoor") };
        })(),
        href: toolAppHref(model, spokespersonTool, undefined, { size: "9:16", explicitSize: true, length: "10", promptOverride: actorSeedancePrompt(actor) })
      }));
      out.relatedGroups = [
        { title: "Formats for an actor-led ad", links: pageLinksFor(model, ["tpl-ugc", "tpl-howto", "tpl-film", "tpl-drink", "tpl-home", "tpl-outfit"]) },
        { title: "Ad sizes and testing", links: pageLinksFor(model, ["tpl-launch", "tpl-compare", "guide-ad-sizes-by-platform", "guide-first-tiktok-video-ad", "guide-testing-ad-versions", "blog-ai-video-review-checklist"]) }
      ];
      out.cta = { title: c.cta_title || "Create a product ad with an AI actor", lead: c.cta_lead || "Start with a product detail you can support and a short line for the presenter.", href: toolAppHref(model, spokespersonTool, undefined, { size: "9:16", explicitSize: true, length: "10" }) };
    } else if (page.id === "templates") {
      // The directory grid has its own optional filters. The shared template wall
      // lives in visual.picker and must never be used to tag or prune this grid.
      const chips = Array.isArray(c.visual?.directoryFilters?.chips) ? c.visual.directoryFilters.chips : [];
      const groups = c.visual?.directoryFilters?.templateGroups ?? {};
      // Per the tagshop standard the template library shows only real templates, never
      // the nine cards that are tool pages; cards open the workspace with that template.
      const cards = model.cards.filter((item) => model.byId[item.pageId]?.type === "template").map((item) => {
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
      if (page.id === "industries") {
        out.features = (c.features || []).map((entry) => ({ t: entry.t, d: inlineLinks(model, entry.d, page.id) }));
      }
    } else {
      out.articles = model.pages.filter((p) => p.section === page.id).map((p) => ({ title: model.content[p.id].h1, summary: model.content[p.id].summary || "", minutes: model.content[p.id].read_minutes || 5, href: p.url, image: pageCardImage(model, p.id) }));
    }
    return out;
  }
  if (t === "article") {
    return { ...base, section: page.section, minutes: c.read_minutes || 5, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, page.label),
      sections: articleSectionsFor(model, page, c.sections || []), checklist: c.checklist || [],
      related: articleRelatedFor(model, page), ...articleTry(model, page) };
  }
  if (t === "pricing") return { ...base, intro: c.intro || [], credits: c.credits_explained || [], costs: JOB_COST_ROWS, ...(c.teams ? { teams: c.teams } : {}), plans: PLANS, next: nextLinks(model, t) };
  if (t === "faq") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), next: nextLinks(model, t) };
  if (t === "contact") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), intro: c.intro || [], topics: c.topics || [], email: "support@aivideosugc.com", next: nextLinks(model, t) };
  if (t === "about") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), sections: proseSectionsFor(model, page, c.sections || [], "about section"), next: nextLinks(model, t) };
  if (t === "trust") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), sections: proseSectionsFor(model, page, c.sections || [], "trust section"), next: nextLinks(model, t) };
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
        steps: [...flow.steps, { label: "Video ad", tall: true, image: { ...bottleClip, alt: "Hands unscrew a sage-green bottle lid and pour water into its open mouth." } }],
        filterTags: filterMap[item.id] ?? []
      };
    });
    const relatedTemplates = [...templateLinksFor(model, "photo", 6), ...templateLinksFor(model, "video", 6)];
    const realTemplateKeys = CARD_ORDER.filter((key) => model.byId[model.cardByKey[key]?.pageId]?.type === "template");
    return { ...base, intro: c.intro || [], flows, relatedTemplates, cards: pickCards(model, realTemplateKeys, 12), ...(visual ? { visual } : {}),
      cta: { title: "Make This With Your Own Product", lead: "Upload one product photo and pick the look you liked.", href: "/app/create" } };
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
  // Visual guide pages render the three-step result as their primary example. Keep
  // social metadata and page structured data on that same result share image instead
  // of falling back to the legacy hero or the first strip card.
  const visualResult = payload.visual?.steps?.result;
  const primary = visualResult ? { src: ogImage.src, width: ogImage.width, height: ogImage.height } : (heroImageOf(hero) ?? (firstVisual ? { src: firstVisual.src, width: firstVisual.w, height: firstVisual.h } : ogImage));
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
  if (["tool", "hub-tool", "template", "hub", "industry", "platform", "occasion"].includes(page.type) && payload.steps?.length >= 2) {
    graph.push({ "@type": "HowTo", "@id": `${canonical(page)}#howto`, name: payload.stepsH2 || `How it works: ${page.label}`,
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
  model.siteImageOwnersByBase = buildSiteImageOwners(model);
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
    for (const item of payload.more_sections?.flatMap((section) => section.items ?? []) ?? []) pushMedia(item?.img);
    if (["article", "about", "trust"].includes(layoutFor(page))) for (const section of payload.sections ?? []) pushMedia(section?.img);
    for (const image of visualPayloadImages(payload.visual)) pushMedia({ src: image.src, alt: image.alt, width: image.w, height: image.h });
    // With a block order the page renders only the listed blocks, so a picture that lives only in
    // unlisted blocks is not on the page and must stay out of the sitemap.
    if (Array.isArray(payload.blockOrder) && payload.blockOrder.length) {
      const listed = new Set(["hero", ...payload.blockOrder]);
      const v = payload.visual ?? {};
      const groupItems = (examples) => (examples?.groups ?? []).flatMap((group) => (group.items ?? []).map((item) => item?.image));
      const cardImages = (block) => (block?.items ?? []).map((item) => item?.img);
      const parts = {
        hero: [heroMedia ? heroImageOf(heroMedia) : undefined, heroMedia?.before, ...(payload.heroCards ?? []).map((card) => card?.image)],
        strip: v.strip ?? [],
        picker: (v.picker?.cards ?? []).map((card) => card?.image),
        uses: (v.uses ?? []).flatMap((item) => [item?.image, item?.imageB]),
        input: (v.input ?? []).flatMap((item) => [item?.good, item?.bad]),
        outputs: (v.outputs ?? []).map((item) => item?.image),
        after: [v.after?.image],
        sizes: (v.sizes ?? []).map((item) => item?.image),
        steps: [v.steps?.source, v.steps?.result, ...(v.steps?.actorCards ?? []).map((card) => card?.image)],
        templates: [...(payload.cards ?? []), ...(payload.templates?.cards ?? [])].map((card) => card?.image),
        examples: [...(gallery?.images ?? []), ...(pairs ?? []).flatMap((pair) => [pair?.after, pair?.before]), ...groupItems(payload.examples), ...groupItems(payload.exampleGallery)],
        features: (payload.more_sections ?? []).flatMap((section) => (section.items ?? []).map((item) => item?.img)),
        reasons: cardImages(payload.reasons), trust: cardImages(payload.trust), reviews: cardImages(payload.reviews)
      };
      const srcs = (keep) => new Set(Object.entries(parts).filter(([id]) => listed.has(id) === keep).flatMap(([, images]) => images.map((image) => image?.src)).filter(Boolean));
      const shownSrc = srcs(true); const hiddenSrc = srcs(false);
      media.splice(0, media.length, ...media.filter((item) => !hiddenSrc.has(item.src) || shownSrc.has(item.src)));
    }
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
  finalizeCardAssignments(model);
  return { pages, navigation: buildNavigation(model), redirects: SITE_V2_REDIRECTS, llms: buildLlmsText(model), cardOverrideErrors: model.cardOverrideErrors, cardAssignmentErrors: model.cardAssignmentErrors };
}

function buildNavigation(model) {
  const link = (id, extra = {}) => ({ label: model.byId[id].label, href: model.byId[id].url, ...extra });
  const tool = (id) => link(id, { description: TOOL_DESC[id], image: toolPicture(model, id).src });
  const popular = (keys) => keys.map((key) => ({ label: model.cardByKey[key].name, href: model.byId[model.cardByKey[key].pageId].url, image: img(model.cardByKey[key].img) }));
  // Per the tagshop standard, menu popular lists feature only real templates, never tool pages.
  const group = (label, ids) => ({ label, items: ids.map((id) => link(id)) });
  const tplFirst = model.cards.filter((card) => card.pageId.startsWith("tpl-") && model.byId[card.pageId]?.type === "template").slice(0, 10).map((card) => card.pageId);
  return {
    version: 2,
    menus: [
      { label: "Video", groups: [{ label: "Make a video", items: [...VIDEO_TOOLS.map(tool), link("ai-actors", { description: "Pick from 24 presenters for your ad", image: mediaImage(model, "n:guide:q4-actor-theo", "inset").src })] }], popular: popular(["beauty", "bf", "launch"]), footerLink: { label: "Browse all video templates →", href: "/templates?type=video" } },
      { label: "Photo", groups: [{ label: "Make photos", items: PHOTO_TOOLS.map(tool) }], popular: popular(["size", "color", "angle"]), footerLink: { label: "Browse all photo templates →", href: "/templates?type=photo" } },
      { label: "Templates", groups: [group("By industry", Object.keys(model.ind).map((slug) => `ind-${slug}`)), group("By platform", Object.keys(model.plat).map((slug) => `plat-${slug}`)), group("By occasion", Object.keys(model.occ).map((slug) => `occ-${slug}`))], footerLink: { label: `See all ${realTemplateCount(model)} templates →`, href: "/templates" } },
      { label: "Resources", groups: [group("Learn and get help", ["examples", "guides", "blog", "faq", "glossary", "contact"])] }
    ],
    links: [{ label: "Pricing", href: "/pricing" }],
    actions: { login: { label: "Log in", href: "/login" }, getStarted: { label: "Get started", href: "/app/create" } },
    footer: {
      tagline: "AI video ads and product photos for online stores.",
      groups: [
        group("Video", ["video-hub", "ai-actors", ...VIDEO_TOOLS]),
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
  for (const card of visual.steps?.actorCards ?? []) images.push(card.image);
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
  const addImageItems = (items) => (items ?? []).forEach((item) => add(item?.img));
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
    else {
      addCards((data.heroCards ?? []).filter((card) => !(data.visual.picker?.cards ?? []).some((pick) => pick.image.src === card.image?.src)));
      const pickerImages = new Set((data.visual.picker?.cards ?? []).map((card) => card.image?.src).filter(Boolean));
      addExamples({ groups: (data.examples?.groups ?? []).map((group) => ({ ...group, items: (group.items ?? []).filter((item) => !pickerImages.has(item.image?.src)) })) });
    }
  }
  else if (layout === "tool") {
    if (data.id === "photo-hub" && data.visual) { addCards(data.hero?.cards); addExamples(data.examples); }
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
  else if (layout === "index") {
    addCards(data.cards);
    (data.items ?? []).forEach((item) => add(item.image));
    (data.articles ?? []).forEach((article) => add(article.image));
    (data.directoryScenes ?? []).forEach((item) => add(item.image));
  }
  else if (["article", "about", "trust"].includes(layout)) {
    add(data.image);
    for (const section of data.sections ?? []) add(section?.img);
  }
  else if (layout === "examples") { addFlows(data.flows); if (!data.visual) { addPairs(); addCards(data.cards); addExamples(); } }
  else add(data.image);
  for (const item of data.sellerScenarios?.items ?? []) add(item.image);
  for (const image of visualPayloadImages(data.visual)) add(image);
  addImageItems(data.more_sections?.flatMap((section) => section.items ?? []));
  addImageItems(data.audience?.items);
  for (const key of ["reasons", "trust", "reviews", "platformLinks"]) addImageItems(data[key]?.items);
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
      // Template cards now open the workspace directly with a `template` query
      // instead of the public template detail URL. Resolve that key so the
      // card's preview is counted with its template owner for image reuse.
      const queryTemplate = String(card.href ?? "").match(/[?&]template=([^&#]+)/)?.[1];
      const target = buildByUrl.get(card.href) ?? (queryTemplate ? pageById.get(`tpl-${decodeURIComponent(queryTemplate)}`) : undefined);
      if (!target || target.id === page.id) continue;
      const targetData = target.contentJson.sections.v2_main.settings.data;
      const representative = heroImageOf(targetData.heroMedia) ?? targetData.image ?? targetData.hero?.image;
      if (!representative?.src) continue;
      const base = imageBase(card.image.src);
      // A workspace template card is owned by the template even when its
      // curated preview is an alternate image rather than the detail hero.
      if (queryTemplate && target.id.startsWith("tpl-")) {
        const targets = targetsByImage.get(base) ?? new Set();
        targets.add(target.id);
        targetsByImage.set(base, targets);
        targetCardCounts.set(base, (targetCardCounts.get(base) ?? 0) + 1);
        targetCardExceptions.push({ image: base, sourcePage: page.id, targetPage: target.id });
        continue;
      }
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
  const validationModel = buildModel(validationSource);
  if (validationSource.cardAssignmentDocument?.version !== 1 || !validationSource.cardAssignmentDocument.pages || typeof validationSource.cardAssignmentDocument.pages !== "object" || Array.isArray(validationSource.cardAssignmentDocument.pages)) errors.push("dynamic card assignments are malformed (expected version 1 and a pages map)");
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
    } else if (params.get("tool_id") !== "image_generator") {
      errors.push(`${pageId}: photo card link must include image_generator (${label})`);
    }
    if (["prompt", "size", "length"].some((key) => params.has(key))) errors.push(`${pageId}: workspace link must carry only the tool (${label})`);
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
    const strip = Array.isArray(visual.strip) ? visual.strip : [];
    const uses = Array.isArray(visual.uses) ? visual.uses : [];
    const input = Array.isArray(visual.input) ? visual.input : [];
    const outputs = Array.isArray(visual.outputs) ? visual.outputs : [];
    const sizes = Array.isArray(visual.sizes) ? visual.sizes : [];
    const after = visual.after && typeof visual.after === "object" ? visual.after : null;
    const afterHasContent = Boolean(after && !Array.isArray(after) && Object.keys(after).length);
    const limitations = visual.limitations && typeof visual.limitations === "object" ? visual.limitations : null;
    const limitationItems = limitations && Array.isArray(limitations.items) ? limitations.items : [];
    if (!( ["home", "tool", "template", "collection", "video-hub", "index", "examples"].includes(layout))) errors.push(`${pageId}: visual is not supported on this layout`);
    if (strip.length && (strip.length < 6 || strip.length > 8)) errors.push(`${pageId}: visual strip must contain 6-8 images`);
    if (!isDirectory && (!Array.isArray(visual.steps?.items) || visual.steps.items.length !== 3)) errors.push(`${pageId}: visual steps must contain three copy rows`);
    else for (const [index, item] of (visual.steps?.items ?? []).entries()) if (wordCount(item.d) > 25) errors.push(`${pageId}: visual step ${index + 1} description exceeds 25 words`);
    const chips = Array.isArray(visual.picker?.chips) ? visual.picker.chips : [];
    const cards = Array.isArray(visual.picker?.cards) ? visual.picker.cards : [];
    const pickerPresent = chips.length > 0 || cards.length > 0;
    if (pickerPresent) {
      if (chips.length > 40) errors.push(`${pageId}: visual picker must contain at most 40 filters`);
      if (cards.length > 80) errors.push(`${pageId}: visual picker card count is outside the page range`);
      if (!isDirectory && !visual.picker?.title?.trim()) errors.push(`${pageId}: visual picker title and required button are missing`);
      if (!isDirectory && !visual.picker?.button?.trim()) errors.push(`${pageId}: visual picker title and required button are missing`);
      if (new Set(chips.map((chip) => chip.id)).size !== chips.length) errors.push(`${pageId}: visual picker filter ids must be unique`);
      const filterCount = (id) => {
        if (pageId === "templates") return cards.filter((card) => card.chips?.includes(id)).length;
        if (pageId === "industries" || pageId === "platforms") return (data.items ?? []).filter((item) => item.filterTags?.includes(id)).length;
        if (pageId === "examples") return (data.flows ?? []).filter((flow) => flow.filterTags?.includes(id)).length;
        return cards.filter((card) => card.chips?.includes(id)).length;
      };
      const wallPages = pageId === "templates" || pageId === "video-ads" || pageId.startsWith("tpl-");
      for (const chip of chips) {
        const minFilterCards = ["ai-actors", "spokesperson-videos"].includes(pageId) || (wallPages && chip.id === "kids-toy") ? 1 : 2;
        if (filterCount(chip.id) < minFilterCards) errors.push(`${pageId}: filter ${chip.id} has too few matching cards`);
      }
      for (const card of cards) {
        const labelWords = wordCount(card.label);
        if (labelWords < 2 || labelWords > 6) errors.push(`${pageId}: visual picker card labels must contain 2-6 words (${card.label})`);
        if (!Array.isArray(card.chips) || !card.chips.length || card.chips.some((id) => !chips.some((chip) => chip.id === id))) errors.push(`${pageId}: visual picker card has an unknown or missing filter (${card.label})`);
        if (card.tool) {
          const target = validationSource.master.pages.find((page) => page.id === card.tool);
          // Hub cards are make-this examples: they open the workspace on their own tool (no prompt in the link).
          const opensOwnTool = typeof card.href === "string" && card.href.startsWith("/app/create?") && new URLSearchParams(card.href.split("?")[1].split("#")[0]).get("tool") === card.tool && !/[?&]prompt=/.test(card.href);
          if (!isHub || !target || !opensOwnTool) errors.push(`${pageId}: tool card does not open the workspace on its matching tool (${card.label})`);
          if (pageId === "video-hub" && !VIDEO_TOOLS.includes(card.tool)) errors.push(`${pageId}: card links to a non-video tool (${card.tool})`);
          if (pageId === "photo-hub" && !PHOTO_TOOLS.slice(1).includes(card.tool)) errors.push(`${pageId}: card links to a non-photo tool (${card.tool})`);
          continue;
        }
        const params = searchParamsForHref(card.href);
        if (card.kind === "photo") {
          if (params.get("tool_id") !== "image_generator" || params.has("prompt")) errors.push(`${pageId}: photo picker link must use image_generator and carry no prompt (${card.label})`);
        } else {
          const expectedSize = videoSizeForDimensions(card.image.w, card.image.h);
          if (params.get("tool_id") === "image_generator") errors.push(`${pageId}: video picker link uses image_generator (${card.label})`);
          if (!expectedSize) errors.push(`${pageId}: video picker card must use a supported frame (${card.label})`);
          if (["prompt", "size", "length"].some((key) => params.has(key))) errors.push(`${pageId}: video picker link must carry only the tool (${card.label})`);
        }
      }
    }
    if (!isDirectory && uses.length && (uses.length < 2 || uses.length > 4)) errors.push(`${pageId}: visual uses must contain 2-4 rows`);
    const sourceUses = Array.isArray(source.uses) ? source.uses : [];
    for (const [index, sourceItem] of sourceUses.entries()) {
      const compiledItem = uses[index];
      if (sourceItem?.img !== undefined) {
        if (typeof sourceItem.img !== "string" || !sourceItem.img.trim()) errors.push(`${pageId}: visual use ${index + 1} img must be a media ref`);
        if (!compiledItem?.img?.src) errors.push(`${pageId}: visual use ${index + 1} img was not compiled`);
        if (sourceItem.frame !== undefined && !IMAGE_ITEM_FRAMES.has(sourceItem.frame)) errors.push(`${pageId}: visual use ${index + 1} frame must be phone, browser or none`);
        if (sourceItem.alt !== undefined && (typeof sourceItem.alt !== "string" || !sourceItem.alt.trim())) errors.push(`${pageId}: visual use ${index + 1} alt must be a non-empty string`);
      }
    }
    if (!isDirectory && input.length && (input.length < 2 || input.length > 4)) errors.push(`${pageId}: visual input guide must contain 2-4 pairs`);
    for (const item of input) {
      if (imageBase(item.good.src) === imageBase(item.bad.src) && !item.darkened) errors.push(`${pageId}: visual input good and bad photos must differ unless the bad image is intentionally darkened`);
      for (const label of [item.good_label, item.bad_label]) if (wordCount(label) < 3 || wordCount(label) > 12) errors.push(`${pageId}: visual input labels must contain 3-12 words (${label})`);
    }
    if (visual.steps && !(visual.steps.mode === "photo" || visual.steps.mode === "video")) errors.push(`${pageId}: visual steps need a photo or video mode`);
    if (visual.steps?.sourceTitle != null && (typeof visual.steps.sourceTitle !== "string" || !visual.steps.sourceTitle.trim() || visual.steps.sourceTitle.length > 60)) errors.push(`${pageId}: visual source title must be a non-empty string of at most 60 characters`);
    if (visual.steps?.sourceHint != null && (typeof visual.steps.sourceHint !== "string" || !visual.steps.sourceHint.trim() || visual.steps.sourceHint.length > 100)) errors.push(`${pageId}: visual source hint must be a non-empty string of at most 100 characters`);
    if (visual.steps && (typeof visual.steps.prompt !== "string" || !visual.steps.prompt.trim())) errors.push(`${pageId}: visual steps need an example prompt`);
    if (!isDirectory && outputs.length && (outputs.length < 2 || outputs.length > 4)) errors.push(`${pageId}: visual outputs must contain 2-4 cards`);
    if (isHub && afterHasContent && !after.image) errors.push(`${pageId}: visual hub must show the after-download module`);
    if (pageId === "video-hub" && strip.some((item) => item.kind !== "video" || Math.abs(item.w / item.h - 9 / 16) > 0.04)) errors.push(`${pageId}: overview strip must use actual 9:16 video frames`);
    if (pageId === "home" && sizes.length && (sizes.length < 3 || sizes.length > 4)) errors.push(`${pageId}: home visual sizes must contain 3-4 frames`);
    if (layout === "collection" && data.kind === "platform" && sizes.length && (sizes.length < 3 || sizes.length > 4)) errors.push(`${pageId}: platform visual sizes must contain 3-4 frames`);
    if (sizes.length && !(layout === "home" || (layout === "collection" && data.kind === "platform"))) errors.push(`${pageId}: visual sizes are only supported on home and platform pages`);
    if (["template", "collection"].includes(layout)) {
      const allowedFrames = new Set(["1:1", "9:16", "16:9"]);
      for (const item of outputs) if (!allowedFrames.has(item.frame)) errors.push(`${pageId}: visual output frame must be Square, 9:16 or 16:9 (${item.frame})`);
      for (const item of sizes) if (!allowedFrames.has(item.frame)) errors.push(`${pageId}: visual size frame must be Square, 9:16 or 16:9 (${item.frame})`);
    }
    if (after && Array.isArray(after.items) && after.items.length && (after.items.length < 2 || after.items.length > 3)) errors.push(`${pageId}: visual after-download list must contain 2-3 items`);
    if (limitationItems.length > 5) errors.push(`${pageId}: visual limitations must contain at most five items`);
    for (const item of limitationItems) if (wordCount(item.label) > 12) errors.push(`${pageId}: visual limitation exceeds 12 words (${item.label})`);
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
        { present: strip.length > 0, hasImage: strip.length > 0 },
        { present: Boolean(visual.steps), hasImage: Boolean(visual.steps?.source && visual.steps?.result) },
        { present: cards.length > 0, hasImage: cards.some((card) => card.image?.src) },
        { present: uses.length > 0, hasImage: uses.some((item) => item.image?.src) },
        { present: input.length > 0, hasImage: input.some((item) => item.good?.src && item.bad?.src) },
        { present: outputs.length > 0, hasImage: outputs.some((item) => item.image?.src) },
        { present: Boolean(after), hasImage: Boolean(after?.image?.src) }
      ].filter((module) => module.present);
      contentSections = modules.length;
      imageSections = modules.filter((module) => module.hasImage).length;
    } else if (isDirectory) {
      const directoryCards = pageId === "templates" ? data.cards : pageId === "examples" ? data.flows : data.items;
      const modules = [
        { present: strip.length > 0, hasImage: strip.length > 0 },
        { present: Boolean(visual.steps), hasImage: Boolean(visual.steps?.source && visual.steps?.result) },
        { present: Boolean(directoryCards?.length), hasImage: Boolean(directoryCards?.some((item) => item.image?.src || item.steps?.some((step) => step.image?.src) || item.media?.src || item.video?.src)) }
      ].filter((module) => module.present);
      contentSections = modules.length;
      imageSections = modules.filter((module) => module.hasImage).length;
    } else if (layout === "home") {
      const homeSections = [
        Boolean(data.make?.video?.length || data.make?.photo?.length),
        Boolean(visual.steps?.items?.length), cards.length > 0, sizes.length > 0,
        input.length > 0, outputs.length > 0, hasExamples,
        uses.length > 0, Boolean(data.templates?.cards?.length), Boolean(data.compare?.length)
      ];
      contentSections = homeSections.filter(Boolean).length;
      imageSections = contentSections - (data.compare?.length ? 1 : 0);
    } else if (["template", "collection"].includes(layout)) {
      const preservedSections = [layout === "template" ? Boolean(data.more?.length) : Boolean(data.cards?.length), Boolean(data.examples?.groups?.length)].filter(Boolean).length;
      const moduleSections = [strip.length > 0, Boolean(visual.steps?.items?.length), cards.length > 0, uses.length > 0, input.length > 0,
        outputs.length > 0, Boolean(after), sizes.length > 0].filter(Boolean).length;
      const planSection = layout === "collection" && data.kind === "occasion" && data.plan?.length ? 1 : 0;
      contentSections = moduleSections + preservedSections + planSection;
      imageSections = moduleSections + preservedSections;
    } else {
      const moduleSections = [strip.length > 0, Boolean(visual.steps?.items?.length), cards.length > 0, uses.length > 0, input.length > 0,
        outputs.length > 0, Boolean(after), sizes.length > 0].filter(Boolean).length;
      const overviewSection = visual.overview ? 1 : 0;
      contentSections = moduleSections + overviewSection + (limitationItems.length ? 1 : 0) + (hasExamples ? 1 : 0);
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
    if (page.id === "ai-actors") {
      const scenes = Array.isArray(data.actorScenes) ? data.actorScenes : [];
      const actors = Array.isArray(data.actors) ? data.actors : [];
      const expectedSceneCounts = {
        Indoor: 2, Home: 2, Outdoor: 2, "Living Room": 2, Studio: 2, Office: 2, Garden: 2,
        Gym: 2, Cafe: 2, Kitchen: 2, Podcast: 2, Fitness: 2, Beach: 2, Car: 2, Hospital: 2,
        Balcony: 2, Pet: 2, Shopping: 2, Sports: 2, "Study Room": 2, Classroom: 1, Terrace: 2,
        Bathroom: 1, Exercise: 2, Bedroom: 1, Garage: 1, Interview: 1, Pool: 1, Reporting: 1,
        Travel: 1, Yoga: 1
      };
      if (!scenes.length) errors.push("ai-actors: actor scenes are missing");
      if (actors.length !== 53) errors.push(`ai-actors: expected 53 actor cards, got ${actors.length}`);
      for (const scene of scenes) {
        const count = actors.filter((actor) => actor.scene === scene).length;
        const expected = expectedSceneCounts[scene] ?? 0;
        if (count !== expected) errors.push(`ai-actors: scene ${scene} must have ${expected} actor cards, got ${count}`);
      }
      if (new Set(actors.map((actor) => actor.name)).size !== actors.length) errors.push("ai-actors: actor names must be unique");
      for (const actor of actors) {
        if (!scenes.includes(actor.scene)) errors.push(`ai-actors: unknown scene on ${actor.name}`);
        if (!actor.image || !videoSizeForDimensions(actor.image.width, actor.image.height)) errors.push(`ai-actors: ${actor.name} portrait must use a supported video frame`);
        if (/\b(photo|clip|example)\b/i.test(`${actor.name} ${actor.style} ${actor.image?.alt ?? ""}`)) errors.push(`ai-actors: prohibited image label on ${actor.name}`);
        const params = searchParamsForHref(actor.href);
        if (params.get("tool") !== "spokesperson-videos" || params.has("prompt")) {
          errors.push(`ai-actors: ${actor.name} must link to the spokesperson workspace without a prompt`);
        }
      }
    }
    checkPhotoCardLines(data, page.id);
    const checkCaseLinks = (value) => {
      if (Array.isArray(value)) return value.forEach(checkCaseLinks);
      if (!value || typeof value !== "object") return;
      if (value.cardType === "case" && typeof value.href === "string") {
        checkCaseHref(page.id, value, value.kind === "video" || value.videoExample === true, value.key ?? "case card");
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
      if (!displayed || !VIDEO_SIZES.includes(displayed)) errors.push(`${page.id}: video maker has no supported displayed Size`);
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
      // Owner 2026-10-11: public pages mirror the competitor feature set ahead of the build, so feature mentions are allowed; result numbers stay banned.
      if (why === "voice claim" || why === "batch/auto/API claim") continue;
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
    if (["article", "about", "trust"].includes(pageMeta?.type)) {
      const sourceSections = sourceContent.sections;
      const compiledSections = data.sections;
      const sectionLabel = pageMeta.type === "article" ? "article section" : `${pageMeta.type} section`;
      if (sourceSections !== undefined && !Array.isArray(sourceSections)) errors.push(`${page.id}: ${sectionLabel}s must be an array`);
      else if (!Array.isArray(compiledSections)) errors.push(`${page.id}: ${sectionLabel}s were not compiled`);
      else for (const [index, sourceSection] of (sourceSections ?? []).entries()) {
        if (!sourceSection || typeof sourceSection !== "object" || Array.isArray(sourceSection)) {
          errors.push(`${page.id}: ${sectionLabel} ${index + 1} must be an object`);
          continue;
        }
        if (sourceSection.img !== undefined) {
          if (typeof sourceSection.img !== "string" || !sourceSection.img.trim() || !knownMediaRef(validationModel, sourceSection.img)) {
            errors.push(`${page.id}: ${sectionLabel} ${index + 1} img reference is missing or unknown`);
          }
          const image = compiledSections[index]?.img;
          if (!image || typeof image !== "object" || typeof image.src !== "string" || typeof image.alt !== "string" || !(Number(image.width) > 0) || !(Number(image.height) > 0)) {
            errors.push(`${page.id}: ${sectionLabel} ${index + 1} img was not compiled`);
          }
        }
        if (sourceSection.alt !== undefined && (typeof sourceSection.alt !== "string" || !sourceSection.alt.trim())) {
          errors.push(`${page.id}: ${sectionLabel} ${index + 1} alt must be a non-empty string`);
        }
      }
    }
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
    if (data.blockOrder !== undefined) {
      const layout = page.contentJson.sections.v2_main.settings.layout;
      const order = Array.isArray(data.blockOrder) ? data.blockOrder : [];
      if (!order.length) errors.push(`${page.id}: blockOrder must be a non-empty list`);
      if (!BLOCK_ORDER_LAYOUTS.has(layout) || !data.visual) errors.push(`${page.id}: blockOrder is only read by visual ${[...BLOCK_ORDER_LAYOUTS].join("/")} pages`);
      for (const id of order) if (!BLOCK_IDS.has(id)) errors.push(`${page.id}: blockOrder has unknown block ${id}`);
      if (new Set(order).size !== order.length) errors.push(`${page.id}: blockOrder lists a block twice`);
      if (order[0] !== "hero") errors.push(`${page.id}: blockOrder must start with hero`);
      if (!order.includes("faq")) errors.push(`${page.id}: blockOrder must include faq`);
      const has = { reasons: data.reasons, trust: data.trust, reviews: data.reviews, closing: data.closing, platforms: data.platformLinks, definition: layout === "home" ? data.ugc : layout === "video-hub" ? (data.definition ?? data.intro) : data.definition, compare: layout === "home" ? data.compare : data.compareTable, features: data.more_sections, audience: data.audience, seller_scenarios: data.sellerScenarios, benefits: data.benefits };
      for (const id of order) if (id in has && (has[id] === undefined || (Array.isArray(has[id]) && !has[id].length))) errors.push(`${page.id}: blockOrder lists ${id} but the page has no ${id} data`);
      if (["tool", "template", "collection"].includes(layout) && (data.faq?.length ?? 0) < 8) errors.push(`${page.id}: pages with blockOrder need at least 8 FAQs (has ${data.faq?.length ?? 0})`);
      if (order.includes("related") && data.relatedLinks?.length && data.relatedLinks.length !== 6) errors.push(`${page.id}: related links must list 6 pages (has ${data.relatedLinks.length})`);
    }
    for (const key of ["reasons", "trust", "reviews", "platformLinks"]) {
      const cards = data[key]?.items ?? [];
      const pictured = cards.filter((item) => item?.img?.src).length;
      if (pictured && pictured !== cards.length) errors.push(`${page.id}: ${key} cards must all have a picture or none (${pictured}/${cards.length})`);
    }
    // Reason cards without pictures show an icon tile (names match REASON_ICONS in parts.tsx).
    for (const item of data.reasons?.items ?? []) {
      if (!item?.img?.src && !REASON_ICON_NAMES.has(item?.icon)) errors.push(`${page.id}: reasons card "${item?.t}" needs an icon from the reason icon list (has ${item?.icon ?? "none"})`);
    }
    // Card counts follow the competitor block: reasons 3 to 6 cards, trust 3 to 6 rows.
    for (const [key, min, max] of [["reasons", 3, 6], ["trust", 3, 6]]) {
      const count = data[key]?.items?.length ?? 0;
      if (data[key] !== undefined && (count < min || count > max)) errors.push(`${page.id}: ${key} must have ${min} to ${max} cards (has ${count})`);
    }
    for (const item of data.reviews?.items ?? []) {
      if (typeof item.example !== "boolean" || typeof item.who !== "string" || !item.who.trim()) errors.push(`${page.id}: review card needs example true/false and who`);
      else if (!item.example && !(typeof item.source === "string" && item.source.trim())) errors.push(`${page.id}: a real review needs its source`);
    }
    if (data.closing !== undefined && (typeof data.closing?.h2 !== "string" || !data.closing.h2.trim() || !data.closing.paras?.length)) errors.push(`${page.id}: closing needs h2 and paras`);
    if (data.more_sections !== undefined) {
      const sections = data.more_sections;
      if (!Array.isArray(sections)) errors.push(`${page.id}: more_sections must be an array`);
      else for (const section of sections) {
        if (!section || typeof section.eyebrow !== "string" || typeof section.h2 !== "string" || !section.h2.trim()) errors.push(`${page.id}: invalid more_sections section shape`);
        else if (section.lead !== undefined && typeof section.lead !== "string") errors.push(`${page.id}: more_sections lead must be a string`);
        if (!Array.isArray(section?.items) || !section.items.length) errors.push(`${page.id}: more_sections section must list items`);
        else for (const item of section.items) {
          if (!item || typeof item.t !== "string" || typeof item.d !== "string") errors.push(`${page.id}: invalid more_sections item shape`);
          if (item?.frame !== undefined && !IMAGE_ITEM_FRAMES.has(item.frame)) errors.push(`${page.id}: more_sections item frame must be phone, browser or none`);
          if (item?.alt !== undefined && (typeof item.alt !== "string" || !item.alt.trim())) errors.push(`${page.id}: more_sections item alt must be a non-empty string`);
          if (item?.img !== undefined && (!item.img || typeof item.img !== "object" || typeof item.img.src !== "string" || typeof item.img.alt !== "string" || !(Number(item.img.width) > 0) || !(Number(item.img.height) > 0))) errors.push(`${page.id}: more_sections item img must be a compiled image`);
        }
      }
    }
    // Page-owned text-only parity blocks: definition, comparison table (tool pages)
    // and linked text card sections (directory pages). They never carry images.
    if (data.definition !== undefined) {
      const definition = data.definition;
      if (!definition || typeof definition.title !== "string" || !definition.title.trim() || !Array.isArray(definition.paras) || !definition.paras.length || definition.paras.some((para) => typeof para !== "string" || !para.trim())) errors.push(`${page.id}: invalid definition block shape`);
    }
    if (data.compareTable !== undefined) {
      const table = data.compareTable;
      if (!table || typeof table.title !== "string" || !table.title.trim() || !Array.isArray(table.columns) || table.columns.length !== 3 || !Array.isArray(table.rows) || !table.rows.length) errors.push(`${page.id}: invalid compareTable block shape`);
      else for (const row of table.rows) {
        if (!Array.isArray(row) || row.length !== 3 || row.some((cell) => typeof cell !== "string" || !cell.trim())) errors.push(`${page.id}: invalid compareTable row shape`);
      }
    }
    if (data.textSections !== undefined) {
      const sections = data.textSections;
      if (!Array.isArray(sections)) errors.push(`${page.id}: textSections must be an array`);
      else for (const section of sections) {
        if (!section || typeof section.eyebrow !== "string" || typeof section.title !== "string" || !section.title.trim() || !Array.isArray(section.cards) || !section.cards.length) errors.push(`${page.id}: invalid textSections section shape`);
        else for (const card of section.cards) {
          if (!card || typeof card.t !== "string" || !card.t.trim() || typeof card.d !== "string" || !card.d.trim()) errors.push(`${page.id}: invalid textSections card shape`);
          if (card.href !== undefined && typeof card.href !== "string") errors.push(`${page.id}: textSections card href must be a string`);
          if (card.img !== undefined && (!card.img || typeof card.img !== "object" || typeof card.img.src !== "string" || typeof card.img.alt !== "string" || !(Number(card.img.width) > 0) || !(Number(card.img.height) > 0))) errors.push(`${page.id}: textSections card img must be a compiled image`);
        }
      }
    }
    const validateImageItems = (items, label) => {
      if (!Array.isArray(items)) return;
      for (const item of items) {
        if (item?.frame !== undefined && !IMAGE_ITEM_FRAMES.has(item.frame)) errors.push(`${page.id}: ${label} item frame must be phone, browser or none`);
        if (item?.alt !== undefined && (typeof item.alt !== "string" || !item.alt.trim())) errors.push(`${page.id}: ${label} item alt must be a non-empty string`);
        if (item?.img !== undefined && (!item.img || typeof item.img !== "object" || typeof item.img.src !== "string" || typeof item.img.alt !== "string" || !(Number(item.img.width) > 0) || !(Number(item.img.height) > 0))) errors.push(`${page.id}: ${label} item img must be a compiled image`);
      }
    };
    validateImageItems(data.audience?.items, "audience");
    validateImageItems(data.benefits, "benefits");
    for (const item of Array.isArray(data.benefits) ? data.benefits : []) {
      if (item?.icon !== undefined && !["bolt", "layers", "target", "coins", "clock", "refresh", "globe", "shield", "sparkle", "check", "users", "play"].includes(item.icon)) errors.push(`${page.id}: benefits icon is not supported (${item.icon})`);
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
  for (const message of build.cardAssignmentErrors ?? []) errors.push(message);
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
      // The key has no pages, so a baseline image that spreads to another page still matches it.
      const added = current.pages.filter((page) => !entry.pages.includes(page));
      if (added.length) errors.push(`image reuse spread to pages outside baseline (${summary}; now also on ${added.join(", ")})`);
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
  // Tool and template-detail pages now use the visual picker as their case
  // wall; only collection pages retain the legacy mixed template/case card
  // area. Do not apply the old seven-card assertion to those picker pages.
  const caseLayouts = new Set(["collection"]);
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
    if (cards.length < 6 || cards.length > 8) errors.push(`${page.id}: case area has ${cards.length} cards (needs 6-8)`);
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
    for (const image of [main, data.heroMedia?.before, ...(data.gallery?.images ?? []), ...(data.pairs ?? []).flatMap((pair) => [pair.before, pair.after]), ...(data.sections ?? []).map((section) => section?.img), ...[...(data.examples?.groups ?? []), ...(data.exampleGallery?.groups ?? [])].flatMap((group) => (group.items ?? []).map((item) => item.image))].filter(Boolean)) {
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
    // RelatedLinks blocks are intentionally removed from public pages; article
    // reachability is now supplied by explicit topic links and article lists.
    if (count < 3) errors.push(`${page.id}: only ${count} pages link to this article (needs 3)`);
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
