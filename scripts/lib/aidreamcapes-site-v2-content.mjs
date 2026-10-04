// Aidreamcapes.com v2 storefront content builder.
// Source of truth for copy: scripts/data/aidreamcapes-site-v2/{master.json,content/*.json}.
// Output: LivePage rows (contentJson) and the ThemeSettings v2 navigation for site_aidreamcapes only.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

export const AIDREAMCAPES_SITE_ID = "site_aidreamcapes";
export const SITE_V2_SOURCE_REVISION = "aidreamcapes-site-v2";
const BASE = "https://aidreamcapes.com";
const ASSET_ROOT = "/assets/sites/site_aidreamcapes/site-v2";
const DATA_DIR = path.join(process.cwd(), "scripts", "data", "aidreamcapes-site-v2");
const CREDITS_FAQ = {
  q: "How do credits work?",
  a: "You see the credit cost before you start. Credits are held when your job starts and used when it is delivered. If something fails, you get the credits back."
};

const LINES = {
  white: "Clean main photo for Amazon and Shopify", life: "Your product out in the real world", angle: "Front, side, back and top views",
  detail: "Show materials and finish up close", size: "Help shoppers see the real size", color: "Every color you sell, same style",
  box: "Show the full set or bundle", pack: "See your box or bag before printing", light: "Turn a flat photo into a studio shot",
  bg: "Same product, new setting", model: "Your product worn by a real-looking person", tryon: "See a piece worn before the shoot",
  jewel: "Necklaces, rings and earrings, worn", look: "Editorial photos for your collection", head: "Matching photos for your About page",
  feed: "Scroll-stopping image for social feeds", ugc: "Looks like a customer shared it", story: "Full-screen vertical image ad",
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
  story: "Vertical full-screen image of the product in a fitting scene.",
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
  "image-to-video": ["creator", "demo", "film", "unbox"], "url-to-video": ["creator", "unbox", "demo", "launch"], "video-ads": ["creator", "unbox", "ba", "beauty", "outfit", "drink"],
  "product-videos": ["demo", "howto", "compare", "film"], "unboxing-videos": ["unbox", "creator", "launch", "film"], "before-after-videos": ["ba", "home", "howto"],
  "spokesperson-videos": ["creator", "beauty"], "photo-hub": ["light", "angle", "detail", "white", "life", "size", "color", "box", "pack", "head"],
  "white-background": ["white", "angle", "detail", "color"], "lifestyle-photos": ["life", "bg", "ugc", "pack"], "model-photos": ["model", "tryon", "jewel", "look"],
  "change-background": ["bg", "white", "light", "life"], "social-ad-photos": ["feed", "story", "ugc", "sale"]
};
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
  const media = { catalog: readJson(path.join(DATA_DIR, "media-catalog.json")), plan: readJson(path.join(DATA_DIR, "media-plan.json")) };
  return { master, images, content, media };
}

function buildModel(source) {
  const { master, images, content, media } = source;
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
  return { pages, byId, content, images, media, ind, plat, occ, cards, cardByKey, pageUse: new Set(), globalUse: new Map(), cardUse: new Map() };
}

function imageRef(model, key, alt) {
  const meta = model.images[key];
  assert.ok(meta, `unknown image ${key}`);
  return { src: img(key), alt, width: meta.w, height: meta.h };
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
    const folder = kind === "f:" ? "frames" : "gen";
    const meta = catalog[kind === "f:" ? "frames" : "gen"][rest];
    assert.ok(meta, `unknown ${folder} image ${ref}`);
    return { meta, alt: meta.alt, variants: meta.variants ?? [], original: `${ASSET_ROOT}/${folder}/${rest}.webp`, variantUrl: (w) => `${ASSET_ROOT}/${folder}/${rest}--${w}.webp` };
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
const imageBase = (src) => String(src).replace(/\/_responsive\//, "/").replace(/--\d+(?=\.\w+$)/, "").replace(/\.\w+$/, "");

function cardChoices(model, key) {
  const primary = model.media.plan.cards[key];
  if (!primary) return [];
  const planned = model.media.plan.cardAlts?.[key] ?? [];
  const items = primary.startsWith("g:") ? model.media.catalog.galleries[primary.slice(2).split("/")[0]]?.items ?? {} : {};
  const tool = primary.startsWith("g:") ? primary.slice(2).split("/")[0] : "";
  const fromGallery = Object.entries(items).filter(([file, meta]) => /^(hero-output|example-\d+)$/.test(file) && meta.w >= meta.h).map(([file]) => `g:${tool}/${file}`);
  return [...new Set([primary, ...planned, ...fromGallery])];
}

function cardRef(model, key, role = "alt") {
  const card = model.cardByKey[key];
  assert.ok(card, `unknown card ${key}`);
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
  return {
    key, name: card.name, line: LINES[key], kind: card.kind, href: model.byId[card.pageId].url,
    image: ref ? mediaImage(model, ref, "card") : imageRef(model, card.img, `${card.name} example`),
    tags: [...card.ind.map((slug) => model.ind[slug]), ...card.plat.map((slug) => model.plat[slug])],
    industries: card.ind, platforms: card.plat
  };
}

// How much its freshest available picture has been used so far; cards whose pictures are all
// worn out come last, so lists lean on cards that can still show something new.
function pictureUse(model, key, role) {
  const choices = cardChoices(model, key);
  const pool = role === "alt" && choices.length > 1 ? choices.slice(1) : choices;
  const free = pool.filter((candidate) => !model.pageUse.has(candidate));
  return free.length ? Math.min(...free.map((candidate) => model.globalUse.get(candidate) ?? 0)) : Infinity;
}

// Up to `count` of the given cards, those with the freshest pictures first, listed in the usual order.
function pickCards(model, keys, count, role = "alt") {
  const ranked = [...keys].sort((a, b) => pictureUse(model, a, role) - pictureUse(model, b, role) || (model.cardUse.get(a) ?? 0) - (model.cardUse.get(b) ?? 0) || CARD_ORDER.indexOf(a) - CARD_ORDER.indexOf(b));
  const chosen = [];
  for (const key of ranked) {
    if (chosen.length >= count) break;
    const card = cardRef(model, key, role);
    if (card) chosen.push(card);
  }
  return chosen.sort((a, b) => CARD_ORDER.indexOf(a.key) - CARD_ORDER.indexOf(b.key));
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
function toolRef(model, id, withImage = true) {
  const page = model.byId[id];
  return { id, group: page.group, label: page.label, description: TOOL_DESC[id] ?? "", href: page.url, ...(withImage ? { image: { ...toolPicture(model, id), alt: "" } } : {}) };
}
function appHref(params, video) {
  const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value));
  return `/app/create?${query.toString()}${video ? "#step-video" : ""}`;
}
function toolAppHref(page, templateKey) {
  if (page.group === "video") {
    return appHref({ tool: page.id, template: templateKey, size: "9:16", length: "15", prompt: templateKey ? TEMPLATE_PROMPTS[templateKey] : "" }, true);
  }
  return appHref({ tool_id: "image_generator", tool: page.id, template: templateKey, prompt: templateKey ? TEMPLATE_PROMPTS[templateKey] : "" }, false);
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

const PLANS = [
  { name: "Starter", price: "$24.50", credits: "200", who: "For trying video ads and product photos.", features: ["Videos and photos", "All templates", "9:16, 1:1 and 16:9 video sizes", "No watermark"], popular: false },
  { name: "Pro", price: "$35", credits: "300", who: "For stores testing new ads every week.", features: ["Everything in Starter", "100 more credits than Starter", "Room for weekly ad testing"], popular: true },
  { name: "Premium", price: "$63", credits: "600", who: "For brands and agencies with many products.", features: ["Everything in Pro", "Twice the credits of Pro", "Most room for new products"], popular: false }
];

// "Where to go next" links on the simple pages, so each one leads on to the pages a
// visitor is most likely to need next.
const NEXT_LINKS = {
  about: [
    ["AI Video", "/ai-video-generation", "Turn product photos into short video ads."],
    ["Product Photos", "/ai-image-generation", "White background, lifestyle and model photos."],
    ["Templates", "/templates", "Ready-made ideas for every product and platform."],
    ["Trust and Safety", "/trust-and-safety", "How we handle your uploads and AI content."],
    ["Company Facts", "/ai-info", "The key facts about Aidreamcapes in one place."]
  ],
  faq: [
    ["Pricing", "/pricing", "Plans, credits and what each job costs."],
    ["Image to Video", "/ai-video-generation/image-to-video", "Start a video from one product photo."],
    ["Product photo tips", "/guides/product-photo-tips", "How to take a photo that gives good results."],
    ["Contact support", "/contact-us", "Email us if your question isn't answered here."]
  ],
  contact: [
    ["FAQ", "/faq", "Quick answers about credits, sizes and refunds."],
    ["Refund Policy", "/refunds", "When credits come back and how refund reviews work."],
    ["Pricing", "/pricing", "Plans and the credits each one includes."],
    ["Trust and Safety", "/trust-and-safety", "How we handle uploads and report problems."]
  ],
  pricing: [
    ["FAQ", "/faq", "More about credits, refunds and video lengths."],
    ["Templates", "/templates", "See what your credits can make."],
    ["Refund Policy", "/refunds", "How refund reviews and credit returns work."],
    ["Contact support", "/contact-us", "Questions about a plan or a charge."]
  ],
  trust: [
    ["Privacy Policy", "/privacy", "What we collect and how long we keep it."],
    ["Content Policy", "/content", "What you can and can't upload."],
    ["Refund Policy", "/refunds", "How refund reviews and credit returns work."],
    ["Contact support", "/contact-us", "Report a problem with a result."],
    ["Company Facts", "/ai-info", "The key facts about Aidreamcapes in one place."]
  ],
  "ai-info": [
    ["AI Video", "/ai-video-generation", "Video tools and templates for product ads."],
    ["Product Photos", "/ai-image-generation", "Photo tools for store listings and ads."],
    ["Pricing", "/pricing", "Plans, credits and what each job costs."],
    ["About Aidreamcapes", "/about-us", "Who we are and why we built it."]
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
function inlineLinks(model, value, where) {
  return value.replace(INLINE_LINK, (_, label, target) => {
    const href = target.startsWith("page:") ? model.byId[target.slice(5)]?.url : target;
    assert.ok(href && (model.pages.some((page) => page.url === href) || POLICY_PATHS.includes(href)), `${where}: link target ${target} not found`);
    return `[${label}](${href})`;
  });
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

function exampleFlow(model, item) {
  if (item.id === "watch") {
    return { t: item.t, d: item.d, steps: [
      { label: "Product photo", image: imageRef(model, "watch", "White smartwatch product photo used as the starting image") },
      { label: "Video ad · 9:16", image: imageRef(model, "watchugc", "Creator holding the same white smartwatch toward the camera") },
      ...[0, 1, 2].map((i) => ({ label: `Version ${"ABC"[i]}`, tall: true, image: imageRef(model, `var${i}`, `Smartwatch opening version ${"ABC"[i]}`) }))] };
  }
  if (item.id === "bottle") {
    return { t: item.t, d: item.d, steps: [
      { label: "Lifestyle photo", image: imageRef(model, "bottle", "Green water bottle in a living room scene") },
      { label: "Feed ad", image: imageRef(model, "feedbottle", "Same water bottle in a sunlit feed ad") }] };
  }
  const flow = EXAMPLE_FLOWS[item.id];
  assert.ok(flow, `unknown example flow ${item.id}`);
  return { t: item.t, d: item.d, steps: flow[1].map(([label, file]) => ({ label, image: mediaImage(model, flow[0] ? `g:${flow[0]}/${file}` : file, "gallery") })) };
}

function layoutFor(page) {
  return { home: "home", hub: "video-hub", "hub-tool": "tool", tool: "tool", template: "template", industry: "collection", platform: "collection", occasion: "collection",
    index: "index", article: "article", pricing: "pricing", faq: "faq", contact: "contact", about: "about", examples: "examples", trust: "trust", "ai-info": "ai-info" }[page.type];
}

function payloadFor(model, page) {
  const c = model.content[page.id];
  const base = {
    id: page.id, label: page.label, eyebrow: c.eyebrow || page.label, h1: c.h1, lead: c.lead,
    breadcrumbs: page.id === "home" ? [] : breadcrumbTrail(model, page),
    faq: (c.faq || []).map((item) => ({ q: item.q, a: item.a }))
  };
  const t = page.type;
  if (t === "home") {
    return { ...base,
      // `output` and `versions` belong to the picture layout used when the hero has no video; with the video reel they are not shown, so they stay out of the data.
      hero: { image: mediaImage(model, "g:feed-ad-still/source-input", "inset"),
        ...(model.media.plan.pages.home?.hero?.kind === "loop" ? {} : { output: imageRef(model, "watchugc", "Creator holding the same white smartwatch toward the camera"), versions: [0, 1, 2].map((i) => imageRef(model, `var${i}`, `Smartwatch opening version ${"ABC"[i]}`)) }),
        videoHref: appHref({ tool: "video-ads", template: "creator", size: "9:16", length: "15", prompt: TEMPLATE_PROMPTS.creator }, true),
        photoHref: appHref({ tool_id: "image_generator", tool: "white-background", template: "white", prompt: TEMPLATE_PROMPTS.white }, false) },
      make: { title: c.make_title, lead: c.make_lead, video: VIDEO_TOOLS.map((id) => toolRef(model, id)), photo: PHOTO_TOOLS.map((id) => toolRef(model, id)) },
      templates: { title: c.templates_title, lead: c.templates_lead, cards: HOME_FEATURED.map((key) => cardRef(model, key, key === "creator" ? "alt" : "primary")).filter(Boolean), total: model.cards.length },
      platforms: { title: c.platforms_title, items: Object.entries(model.plat).map(([slug, label]) => ({ label, href: model.byId[`plat-${slug}`].url, spec: (model.content[`plat-${slug}`].specs || [["", ""]])[0][1] })) },
      steps: c.steps, compare: c.compare, plans: PLANS,
      examples: { flows: (c.example_flows || []).map((item) => exampleFlow(model, item)) }
    };
  }
  if (t === "hub") {
    return { ...base, intro: c.intro, benefits: c.benefits, steps: c.steps, tools: VIDEO_TOOLS.map((id) => toolRef(model, id)),
      heroCards: ["creator", "unbox", "beauty"].map((key) => cardRef(model, key, "primary")).filter(Boolean),
      cards: CARD_ORDER.filter((key) => model.cardByKey[key].kind === "video" && !["creator", "unbox", "beauty"].includes(key)).map((key) => cardRef(model, key, "primary")).filter(Boolean),
      appHref: appHref({ tool: "video-ads", size: "9:16", length: "15" }, true),
      reading: readingFor(model, page) };
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
    return { ...base, group: page.group, intro: c.intro, benefits: c.benefits, steps: c.steps, uses: c.uses || [],
      maker: { options: (c.maker?.options || []).slice(0, 3), cta: c.maker?.cta || (video ? "Make my video" : "Make my photos"), href: toolAppHref(page, rel[0]?.key), urlInput: page.id === "url-to-video" },
      specs: [
        ...(video ? [["Sizes", "9:16 · 1:1 · 16:9"], ["Length", "6, 10 or 15 seconds"], ["You start with", page.id === "url-to-video" ? "A product page link" : "1 product photo"], ["Cost", "Shown before you start"]]
          : [["Size", "Square by default"], ["You upload", "1 product photo"], ["You get", "A new product photo"], ["Cost", "Shown before you start"]]),
        ...(platformIds.length ? [["Best for", names(platformIds), specLinks(model, platformIds)]] : []),
        ...(industryIds.length ? [["Popular with", names(industryIds), specLinks(model, industryIds)]] : [])
      ],
      hero: page.id === "white-background" ? { single: imageRef(model, "p_white", "Running shoe on a pure white background") }
        : page.id === "spokesperson-videos" ? { single: imageRef(model, "presenter", "AI-generated presenter holding a skincare bottle") }
        : hasHero ? {} : { cards: rel.slice(0, 3) },
      templates: hasHero ? rel : rel.slice(3), siblings: hub ? [] : siblings, photoTools: hub ? PHOTO_TOOLS.slice(1).map((id) => toolRef(model, id)) : [],
      reading: readingFor(model, page) };
  }
  if (t === "template") {
    const key = page.id.slice(4);
    const tool = model.byId[page.made_with];
    const sameKind = model.cards.filter((card) => card.key !== key && card.kind === page.group);
    let more = sameKind.filter((card) => card.ind.some((x) => page.industries.includes(x)) || card.plat.some((x) => page.platforms.includes(x))).map((card) => card.key);
    more = more.concat(sameKind.map((card) => card.key).filter((k) => !more.includes(k)));
    const platformIds = page.platforms.map((slug) => `plat-${slug}`);
    const industryIds = page.industries.map((slug) => `ind-${slug}`);
    const occasionIds = (page.occasions ?? []).map((slug) => `occ-${slug}`);
    const names = (ids) => ids.map((id) => model.byId[id].label).join(", ");
    return { ...base, kind: page.group, intro: c.intro, tip: c.tip, steps: c.steps, ideas: c.ideas || [],
      image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, `${page.label} example`),
      maker: { options: (c.maker?.options || [["Template", page.label], ["Output", page.output]]).slice(0, 3), cta: c.maker?.cta || "Use this template", href: toolAppHref(tool, key) },
      specs: [
        ["Output", page.output],
        page.platforms.length ? ["Best for", names(platformIds), specLinks(model, platformIds)] : ["Best for", "Your website"],
        page.industries.length ? ["Popular with", names(industryIds), specLinks(model, industryIds)] : ["Popular with", "Any brand"],
        ["Made with", tool.label, specLinks(model, [tool.id])],
        ...(occasionIds.length ? [["Good for", names(occasionIds), specLinks(model, occasionIds)]] : [])
      ],
      madeWith: { label: tool.label, href: tool.url }, more: pickCards(model, more, 3), reading: readingFor(model, page) };
  }
  if (t === "industry" || t === "platform" || t === "occasion") {
    const slug = page.id.split("-").slice(1).join("-");
    const field = { industry: "ind", platform: "plat", occasion: "occ" }[t];
    const keys = model.cards.filter((card) => card[field].includes(slug)).map((card) => card.key);
    const tools = (t === "industry" ? IND_TOOLS[slug] : t === "platform" ? PLAT_TOOLS[slug] : ["video-ads", "social-ad-photos", "unboxing-videos"]) || [];
    const hasHero = Boolean(model.media.plan.pages[page.id]?.hero);
    const collage = hasHero ? [] : pickCards(model, keys, 3);
    const listed = pickCards(model, keys.filter((key) => !collage.some((card) => card.key === key)), 6);
    const paramKey = { industry: "industry", platform: "platform", occasion: "occasion" }[t];
    return { ...base, kind: t, intro: c.intro, ideas: c.ideas || [], specs: c.specs || [], tips: c.tips || [], plan: c.plan || [],
      cards: listed, heroCards: collage, tools: tools.map((id) => toolRef(model, id, false)),
      appHref: appHref({ [paramKey]: slug, ...(t === "platform" && ["tiktok", "youtube-shorts", "instagram"].includes(slug) ? { size: "9:16", length: "15" } : {}) }, t === "platform" && ["tiktok", "youtube-shorts"].includes(slug)),
      reading: readingFor(model, page) };
  }
  if (t === "index") {
    const out = { ...base, intro: Array.isArray(c.intro) ? c.intro.map((para) => inlineLinks(model, para, page.id)) : c.intro };
    if (page.id === "templates") {
      out.cards = model.cards.map((card) => cardRef(model, card.key, "primary")).filter(Boolean);
      out.filters = { types: [["video", "Video"], ["photo", "Photo"]], industries: Object.entries(model.ind), platforms: Object.entries(model.plat) };
    } else if (page.id === "industries" || page.id === "platforms") {
      const prefix = page.id === "industries" ? "ind-" : "plat-";
      out.items = model.pages.filter((p) => p.id.startsWith(prefix)).map((p) => ({ label: p.label, href: p.url, text: model.content[p.id].card || snippet(model.content[p.id].lead, 140), image: pageCardImage(model, p.id) }));
    } else {
      out.articles = model.pages.filter((p) => p.section === page.id).map((p) => ({ title: model.content[p.id].h1, summary: model.content[p.id].summary || "", minutes: model.content[p.id].read_minutes || 5, href: p.url, image: pageCardImage(model, p.id) }));
    }
    return out;
  }
  if (t === "article") {
    return { ...base, section: page.section, minutes: c.read_minutes || 5, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, page.label),
      sections: (c.sections || []).map((section) => ({ ...section, paras: section.paras.map((para) => inlineLinks(model, para, page.id)) })), checklist: c.checklist || [],
      related: articleRelatedFor(model, page) };
  }
  if (t === "pricing") return { ...base, intro: c.intro || [], credits: c.credits_explained || [], plans: PLANS, next: nextLinks(model, t) };
  if (t === "faq") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), next: nextLinks(model, t) };
  if (t === "contact") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), intro: c.intro || [], topics: c.topics || [], email: "support@aidreamcapes.com", next: nextLinks(model, t) };
  if (t === "about") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), sections: c.sections || [], next: nextLinks(model, t) };
  if (t === "trust") return { ...base, image: heroImageOf(heroMediaFor(model, page.id)) ?? imageRef(model, page.img, c.h1), sections: c.sections || [], next: nextLinks(model, t) };
  if (t === "ai-info") return { ...base, summary: c.summary, facts: c.facts, notOffered: c.not_offered, describe: c.describe, llmsText: buildLlmsText(model), next: nextLinks(model, t) };
  if (t === "examples") {
    return { ...base, intro: c.intro || [], flows: (c.cases || []).map((item) => exampleFlow(model, item)), cards: pickCards(model, CARD_ORDER, 12) };
  }
  throw new Error(`unsupported page type ${t}`);
}

function jsonLdFor(model, page, c, payload, ogImage) {
  const org = { "@type": "Organization", "@id": `${BASE}/#organization`, name: "Aidreamcapes", url: `${BASE}/` };
  const graph = [org];
  if (page.id === "home") graph.push({ "@type": "WebSite", "@id": `${BASE}/#website`, name: "Aidreamcapes", url: `${BASE}/`, inLanguage: "en", publisher: { "@id": `${BASE}/#organization` } });
  else graph.push({ "@type": "BreadcrumbList", itemListElement: payload.breadcrumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.label, item: `${BASE}${crumb.href === "/" ? "/" : crumb.href}` })) });
  const absolute = (src) => `${BASE}${src}`;
  const primary = heroImageOf(payload.heroMedia) ?? ogImage;
  const videoNode = payload.heroMedia?.kind === "video" ? payload.heroMedia.video : undefined;
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
    graph.push({ "@type": "SoftwareApplication", name: `Aidreamcapes ${page.label}`, applicationCategory: "MultimediaApplication", operatingSystem: "Web", url: canonical(page), description: c.description, publisher: { "@id": `${BASE}/#organization` } });
  }
  if (page.type === "index" && payload.cards) graph.push({ "@type": "ItemList", itemListElement: payload.cards.map((card, index) => ({ "@type": "ListItem", position: index + 1, url: `${BASE}${card.href}` })) });
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
    model.pageUse = new Set(plannedRefs(model, page.id));
    const heroMedia = heroMediaFor(model, page.id);
    const gallery = galleryFor(model, page.id);
    const pairs = pairsFor(model, page.id);
    const payload = { ...payloadFor(model, page), ...(heroMedia ? { heroMedia } : {}), ...(gallery ? { gallery } : {}), ...(pairs ? { pairs } : {}) };
    const ogRef = model.media.plan.pages[page.id]?.og;
    const ogBase = ogRef ? mediaImage(model, ogRef, "og") : imageRef(model, page.img, c.h1);
    const ogImage = { src: ogBase.src, alt: ogBase.alt || heroImageOf(heroMedia)?.alt || c.h1, width: ogBase.width, height: ogBase.height };
    const robots = page.noindex ? { index: false, follow: true } : { index: true, follow: true, maxImagePreview: "large" };
    const seo = {
      title: c.title, description: c.description, keywords: (c.secondary_keywords || []).join(", "), primaryKeyword: page.primary_keyword,
      canonicalPath: page.url, canonical: canonical(page), robots, index: !page.noindex,
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
    const { pageType, templateKey } = livePageTypeFor(page);
    return {
      id: page.id, slug: page.url, title: c.h1, pageType, templateKey, status: page.status, noindex: Boolean(page.noindex),
      contentJson: {
        version: 2, pageType,
        sectionsOrder: ["v2_main"],
        sections: { v2_main: { type: "aidreamcapes_v2_page", settings: { layout: layoutFor(page), data: payload }, blocks: [] } },
        seo, mediaManifest: media,
        contentContract: { seoSource: "LivePage.contentJson", mediaSource: "LivePage.contentJson", sourceRevision: SITE_V2_SOURCE_REVISION }
      }
    };
  });
  return { pages, navigation: buildNavigation(model), redirects: SITE_V2_REDIRECTS, llms: buildLlmsText(model) };
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
      { label: "Resources", groups: [group("Learn and get help", ["examples", "guides", "blog", "faq", "contact"])] }
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
        group("Platforms & help", [...Object.keys(model.plat).map((slug) => `plat-${slug}`), "pricing", "faq", "contact", "about", "trust", "ai-info", "blog", "guides"])
      ],
      legal: [{ label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }, { label: "Refunds", href: "/refunds" }, { label: "Cookies", href: "/cookies" }],
      copyright: "© 2026 Aidreamcapes. All rights reserved."
    }
  };
}

function buildLlmsText(model) {
  const c = model.content["ai-info"];
  const lines = [
    "# Aidreamcapes", "", `> ${c.summary}`, "",
    ...c.facts.map(([k, v]) => `- ${k}: ${v}`), "",
    "## Not offered", ...c.not_offered.map((item) => `- ${item}`), "",
    "## Main pages",
    ...["video-hub", "photo-hub", ...VIDEO_TOOLS.filter((id) => !model.byId[id].noindex), ...PHOTO_TOOLS.slice(1), "templates", "pricing", "faq", "trust", "ai-info"].map((id) => `- [${model.byId[id].label}](${canonical(model.byId[id])}): ${model.content[id].description}`)
  ];
  return lines.join("\n") + "\n";
}

const BANNED = [
  [/\bbulk\b|\bbatch\b|auto(matically)? (rank|publish)|\bAPI\b(?! is not)/i, "batch/auto/API claim"],
  [/voice-?over(?!, lip| or)|lip[- ]?sync(?! or)|text[- ]to[- ]speech/i, "voice claim"],
  [/\b\d+x\b(?! (lens|zoom))|\d+% (more|cheaper|higher|faster|lower)|#1\b|trusted by|thousands of|best-in-class/i, "unprovable claim"],
  [/\btheme\b|\bworkflow\b|\bSEO\b|landing page|proof moment/i, "internal wording"]
];

// The pictures a page actually shows, in the order its layout draws them (mirrors the layouts in
// src/components/storefront/aidreamcapes-v2/page.tsx). Used to make sure no picture appears twice on a page.
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
  if (layout === "home") {
    add(data.hero.image);
    if (!addMedia(data.heroMedia)) { add(data.hero.output); (data.hero.versions ?? []).forEach(add); }
    addTools(data.make.video); addTools(data.make.photo); addCards(data.templates.cards); addFlows(data.examples.flows);
  } else if (layout === "video-hub") { addCards(data.heroCards); addTools(data.tools); addCards(data.cards); }
  else if (layout === "tool") {
    if (!addMedia(data.heroMedia)) { if (data.hero?.single) add(data.hero.single); else addCards(data.hero?.cards); }
    addGallery(); addPairs(); addTools(data.photoTools); addCards(data.templates); addTools(data.siblings);
  } else if (layout === "template") { if (!addMedia(data.heroMedia)) add(data.image); addGallery(); addCards(data.more); }
  else if (layout === "collection") { if (!addMedia(data.heroMedia)) addCards(data.heroCards); addGallery(); addCards(data.cards); addTools(data.tools); }
  else if (layout === "index") { addCards(data.cards); (data.items ?? []).forEach((item) => add(item.image)); (data.articles ?? []).forEach((article) => add(article.image)); }
  else if (layout === "article") add(data.image);
  else if (layout === "examples") { addFlows(data.flows); addPairs(); addCards(data.cards); }
  else add(data.image);
  return out;
}

export function validateSiteV2(build = buildSiteV2()) {
  const errors = [];
  const seen = { title: new Map(), description: new Map(), h1: new Map(), slug: new Map() };
  for (const page of build.pages) {
    const seo = page.contentJson.seo;
    if (seo.title.length > 60) errors.push(`${page.id}: title ${seo.title.length} > 60`);
    if (seo.description.length < 120 || seo.description.length > 160) errors.push(`${page.id}: description ${seo.description.length} not in 120-160`);
    for (const [key, value] of [["title", seo.title], ["description", seo.description], ["h1", page.title], ["slug", page.slug]]) {
      const norm = value.toLowerCase();
      if (seen[key].has(norm)) errors.push(`${page.id}: duplicate ${key} with ${seen[key].get(norm)}`);
      seen[key].set(norm, page.id);
    }
    const data = page.contentJson.sections.v2_main.settings.data;
    const visible = JSON.stringify(data).replace(/"(href|src|image|key|kind|industries|platforms|id|section|tool_id)":"[^"]*"/g, "");
    for (const [rx, why] of BANNED) {
      if (page.id === "ai-info" && why !== "internal wording") continue;
      if (rx.test(visible)) errors.push(`${page.id}: ${why}`);
    }
    const faq = data.faq || [];
    const ld = seo.jsonLd["@graph"].find((node) => node["@type"] === "FAQPage");
    if (faq.length && (!ld || ld.mainEntity.length !== faq.length)) errors.push(`${page.id}: FAQ JSON-LD mismatch`);
  }
  // Media: pages of these layouts show their own picture, every image has a proper
  // description, nothing comes from another store's folders, and no two pages share the
  // same main image.
  const needsMain = new Set(["tool", "template", "collection", "article", "faq", "contact", "about", "trust"]);
  const mainImages = new Map();
  for (const page of build.pages) {
    const { layout, data } = page.contentJson.sections.v2_main.settings;
    const main = heroImageOf(data.heroMedia);
    for (const image of [main, data.heroMedia?.before, ...(data.gallery?.images ?? []), ...(data.pairs ?? []).flatMap((pair) => [pair.before, pair.after])].filter(Boolean)) {
      if (!image.alt || image.alt.length < 12) errors.push(`${page.id}: image without a proper description (${image.src})`);
      if (/\bunbranded\b|\bplaceholder\b|\bprompt\b/i.test(image.alt)) errors.push(`${page.id}: internal wording in an image description (${image.alt})`);
      if (!image.src.startsWith("/assets/sites/site_aidreamcapes/")) errors.push(`${page.id}: image outside the Aidreamcapes asset folder (${image.src})`);
      if (/\/(dreamshoot|mirror|fan-holiday-theme|creative-packs)\//.test(image.src)) errors.push(`${page.id}: image from a retired or other-store folder (${image.src})`);
    }
    if (!main && needsMain.has(layout) && page.id !== "photo-hub" && !data.image) errors.push(`${page.id}: no main image`);
    if (main) {
      if (mainImages.has(main.src)) errors.push(`${page.id}: same main image as ${mainImages.get(main.src)}`);
      mainImages.set(main.src, page.id);
    }
  }
  // The opening paragraph names the page's topic: the words of its primary keyword appear in it.
  const plain = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  for (const page of build.pages) {
    const lead = plain(page.contentJson.sections.v2_main.settings.data.lead);
    const keyword = plain(page.contentJson.seo.primaryKeyword).split(" ").filter((word) => word.length > 2);
    const found = keyword.filter((word) => lead.includes(word.replace(/s$/, ""))).length;
    if (keyword.length && found / keyword.length < 0.75) errors.push(`${page.id}: opening paragraph does not name the topic "${page.contentJson.seo.primaryKeyword}"`);
  }
  // No picture appears twice on a page.
  for (const page of build.pages) {
    const { layout, data } = page.contentJson.sections.v2_main.settings;
    const seenImages = new Set();
    for (const src of renderedImages(layout, data)) {
      const key = imageBase(src);
      if (seenImages.has(key)) errors.push(`${page.id}: the picture ${key.split("/").slice(-2).join("/")} appears twice on the page`);
      seenImages.add(key);
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
    const target = href.split(/[?#]/)[0];
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
const sameValue = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

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
      else if (sameValue(current, from)) { next.seo[key] = to; result.applied.push(`seo.${key}`); }
      else result.conflicts.push(`seo.${key}`);
    } else if (kind === "field") {
      const [, id, type, key, from, to] = change;
      const section = sectionOf(id, type);
      const current = section?.settings?.[key];
      if (!section) result.conflicts.push(`${id}.${key} (section missing)`);
      else if (sameValue(current, to)) result.unchanged.push(`${id}.${key}`);
      else if (sameValue(current, from)) { section.settings[key] = to; result.applied.push(`${id}.${key}`); }
      else result.conflicts.push(`${id}.${key}`);
    } else if (kind === "block") {
      const [, id, type, index, key, from, to] = change;
      const block = sectionOf(id, type)?.blocks?.[index];
      const current = block?.settings?.[key];
      if (!block) result.conflicts.push(`${id}.blocks[${index}].${key} (block missing)`);
      else if (sameValue(current, to)) result.unchanged.push(`${id}.blocks[${index}].${key}`);
      else if (sameValue(current, from)) { block.settings[key] = to; result.applied.push(`${id}.blocks[${index}].${key}`); }
      else result.conflicts.push(`${id}.blocks[${index}].${key}`);
    } else if (kind === "replace") {
      // A change inside a longer text (such as a policy body): `from` and `to` are the exact words swapped.
      const [, id, type, key, from, to] = change;
      const section = sectionOf(id, type);
      const current = section?.settings?.[key];
      if (!section || typeof current !== "string") result.conflicts.push(`${id}.${key} (text missing)`);
      else if (current.includes(to) && !current.includes(from)) result.unchanged.push(`${id}.${key}`);
      else if (current.split(from).length === 2) { section.settings[key] = current.replace(from, () => to); result.applied.push(`${id}.${key}`); }
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
    else if (from.some((value) => sameValue(current, value))) { footer.settings[key] = to; result.applied.push(`footer.${key}`); }
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
    else if (from.some((value) => sameValue(next[key], value))) { next[key] = to; result.applied.push(key); }
    else result.conflicts.push(key);
  }
  return result;
}

export function applyProductPatch(metadata, patch) {
  const next = structuredClone(metadata ?? {});
  const result = { next, applied: [], unchanged: [], conflicts: [] };
  for (const key of Object.keys(patch.to)) {
    if (sameValue(next[key], patch.to[key])) result.unchanged.push(key);
    else if (sameValue(next[key], patch.from[key])) { next[key] = patch.to[key]; result.applied.push(key); }
    else result.conflicts.push(key);
  }
  return result;
}
