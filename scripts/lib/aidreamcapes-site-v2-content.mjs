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

// 301 map for retired v1 URLs. Shared with src/middleware.ts through this JSON file.
export const SITE_V2_REDIRECTS = JSON.parse(fs.readFileSync(path.join(process.cwd(), "src", "lib", "aidreamcapes-site-v2-redirects.json"), "utf8"));

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
const img = (key) => `${ASSET_ROOT}/${key}.webp`;

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
  return { master, images, content };
}

function buildModel(source) {
  const { master, images, content } = source;
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
  return { pages, byId, content, images, ind, plat, occ, cards, cardByKey };
}

function imageRef(model, key, alt) {
  const meta = model.images[key];
  assert.ok(meta, `unknown image ${key}`);
  return { src: img(key), alt, width: meta.w, height: meta.h };
}
function cardRef(model, key) {
  const card = model.cardByKey[key];
  assert.ok(card, `unknown card ${key}`);
  return {
    key, name: card.name, line: LINES[key], kind: card.kind, href: model.byId[card.pageId].url,
    image: imageRef(model, card.img, `${card.name} example`),
    tags: [...card.ind.map((slug) => model.ind[slug]), ...card.plat.map((slug) => model.plat[slug])],
    industries: card.ind, platforms: card.plat
  };
}
function toolRef(model, id) {
  const page = model.byId[id];
  return { id, label: page.label, description: TOOL_DESC[id] ?? "", href: page.url, image: imageRef(model, page.img, "") };
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
      hero: { image: imageRef(model, "watch", "White smartwatch product photo used as the starting image"), output: imageRef(model, "watchugc", "Creator holding the same white smartwatch toward the camera"),
        versions: [0, 1, 2].map((i) => imageRef(model, `var${i}`, "")), videoHref: appHref({ tool: "video-ads", template: "creator", size: "9:16", length: "15", prompt: TEMPLATE_PROMPTS.creator }, true),
        photoHref: appHref({ tool_id: "image_generator", tool: "white-background", template: "white", prompt: TEMPLATE_PROMPTS.white }, false) },
      make: { title: c.make_title, lead: c.make_lead, video: VIDEO_TOOLS.map((id) => toolRef(model, id)), photo: PHOTO_TOOLS.map((id) => toolRef(model, id)) },
      templates: { title: c.templates_title, lead: c.templates_lead, cards: HOME_FEATURED.map((key) => cardRef(model, key)), total: model.cards.length },
      platforms: { title: c.platforms_title, items: Object.entries(model.plat).map(([slug, label]) => ({ label, href: model.byId[`plat-${slug}`].url, spec: (model.content[`plat-${slug}`].specs || [["", ""]])[0][1] })) },
      steps: c.steps, compare: c.compare, plans: PLANS,
      examples: { image: imageRef(model, "watch", "Smartwatch product photo"), output: imageRef(model, "watchugc", "Creator holding the smartwatch in a vertical video ad"),
        versions: [0, 1, 2].map((i) => imageRef(model, `var${i}`, `Smartwatch opening version ${"ABC"[i]}`)),
        bottle: imageRef(model, "bottle", "Green water bottle in a living room scene"), bottleAd: imageRef(model, "feedbottle", "Same water bottle in a sunlit feed ad") }
    };
  }
  if (t === "hub") {
    return { ...base, intro: c.intro, benefits: c.benefits, steps: c.steps, tools: VIDEO_TOOLS.map((id) => toolRef(model, id)),
      cards: CARD_ORDER.filter((key) => model.cardByKey[key].kind === "video").map((key) => cardRef(model, key)),
      heroCards: ["creator", "unbox", "beauty"].map((key) => cardRef(model, key)), appHref: appHref({ tool: "video-ads", size: "9:16", length: "15" }, true) };
  }
  if (t === "tool" || t === "hub-tool") {
    const rel = (TOOL_REL[page.id] || []).map((key) => cardRef(model, key));
    const video = page.group === "video";
    const siblings = (video ? VIDEO_TOOLS : PHOTO_TOOLS).filter((id) => id !== page.id).map((id) => toolRef(model, id));
    return { ...base, group: page.group, intro: c.intro, benefits: c.benefits, steps: c.steps, uses: c.uses || [],
      maker: { options: (c.maker?.options || []).slice(0, 3), cta: c.maker?.cta || (video ? "Make my video" : "Make my photos"), href: toolAppHref(page, rel[0]?.key), urlInput: page.id === "url-to-video" },
      specs: video ? [["Sizes", "9:16 · 1:1 · 16:9"], ["Length", "6, 10 or 15 seconds"], ["You start with", page.id === "url-to-video" ? "A product page link" : "1 product photo"], ["Cost", "Shown before you start"]]
        : [["Size", "Square by default"], ["You upload", "1 product photo"], ["You get", "A new product photo"], ["Cost", "Shown before you start"]],
      hero: page.id === "white-background" ? { single: imageRef(model, "p_white", "Running shoe on a pure white background") }
        : page.id === "spokesperson-videos" ? { single: imageRef(model, "presenter", "AI-generated presenter holding a skincare bottle") }
        : { cards: rel.slice(0, 3) },
      templates: rel, siblings: page.id === "photo-hub" ? [] : siblings, photoTools: page.id === "photo-hub" ? PHOTO_TOOLS.slice(1).map((id) => toolRef(model, id)) : [] };
  }
  if (t === "template") {
    const key = page.id.slice(4);
    const tool = model.byId[page.made_with];
    const sameKind = model.cards.filter((card) => card.key !== key && card.kind === page.group);
    let more = sameKind.filter((card) => card.ind.some((x) => page.industries.includes(x)) || card.plat.some((x) => page.platforms.includes(x))).map((card) => card.key).slice(0, 4);
    more = more.concat(sameKind.map((card) => card.key).filter((k) => !more.includes(k))).slice(0, 4);
    return { ...base, kind: page.group, intro: c.intro, tip: c.tip, steps: c.steps, ideas: c.ideas || [],
      image: imageRef(model, page.img, `${page.label} example`),
      maker: { options: (c.maker?.options || [["Template", page.label], ["Output", page.output]]).slice(0, 3), cta: c.maker?.cta || "Use this template", href: toolAppHref(tool, key) },
      specs: [["Output", page.output], ["Best for", page.platforms.map((x) => model.plat[x]).join(", ") || "Your website"], ["Popular with", page.industries.map((x) => model.ind[x]).join(", ") || "Any brand"], ["Made with", tool.label]],
      madeWith: { label: tool.label, href: tool.url }, more: more.map((k) => cardRef(model, k)) };
  }
  if (t === "industry" || t === "platform" || t === "occasion") {
    const slug = page.id.split("-").slice(1).join("-");
    const field = { industry: "ind", platform: "plat", occasion: "occ" }[t];
    const keys = model.cards.filter((card) => card[field].includes(slug)).map((card) => card.key);
    const tools = (t === "industry" ? IND_TOOLS[slug] : t === "platform" ? PLAT_TOOLS[slug] : ["video-ads", "social-ad-photos", "unboxing-videos"]) || [];
    const paramKey = { industry: "industry", platform: "platform", occasion: "occasion" }[t];
    return { ...base, kind: t, intro: c.intro, ideas: c.ideas || [], specs: c.specs || [], tips: c.tips || [], plan: c.plan || [],
      cards: keys.map((key) => cardRef(model, key)), heroCards: keys.slice(0, 3).map((key) => cardRef(model, key)), tools: tools.map((id) => toolRef(model, id)),
      appHref: appHref({ [paramKey]: slug, ...(t === "platform" && ["tiktok", "youtube-shorts", "instagram"].includes(slug) ? { size: "9:16", length: "15" } : {}) }, t === "platform" && ["tiktok", "youtube-shorts"].includes(slug)) };
  }
  if (t === "index") {
    const out = { ...base, intro: c.intro };
    if (page.id === "templates") {
      out.cards = model.cards.map((card) => cardRef(model, card.key));
      out.filters = { types: [["video", "Video"], ["photo", "Photo"]], industries: Object.entries(model.ind), platforms: Object.entries(model.plat) };
    } else if (page.id === "industries" || page.id === "platforms") {
      const prefix = page.id === "industries" ? "ind-" : "plat-";
      out.items = model.pages.filter((p) => p.id.startsWith(prefix)).map((p) => ({ label: p.label, href: p.url, text: (model.content[p.id].lead || "").slice(0, 140), image: imageRef(model, p.img, "") }));
    } else {
      out.articles = model.pages.filter((p) => p.section === page.id).map((p) => ({ title: model.content[p.id].h1, summary: model.content[p.id].summary || "", minutes: model.content[p.id].read_minutes || 5, href: p.url, image: imageRef(model, p.img, "") }));
    }
    return out;
  }
  if (t === "article") {
    return { ...base, section: page.section, minutes: c.read_minutes || 5, image: imageRef(model, page.img, page.label), sections: c.sections || [], checklist: c.checklist || [],
      related: (c.related || []).filter((id) => model.byId[id]).map((id) => ({ label: model.byId[id].label, href: model.byId[id].url, text: (model.content[id].lead || "").slice(0, 110) })) };
  }
  if (t === "pricing") return { ...base, intro: c.intro || [], credits: c.credits_explained || [], plans: PLANS };
  if (t === "faq") return { ...base, image: imageRef(model, page.img, c.h1) };
  if (t === "contact") return { ...base, image: imageRef(model, page.img, c.h1), intro: c.intro || [], topics: c.topics || [], email: "support@aidreamcapes.com" };
  if (t === "about") return { ...base, image: imageRef(model, page.img, c.h1), sections: c.sections || [] };
  if (t === "trust") return { ...base, image: imageRef(model, page.img, c.h1), sections: c.sections || [] };
  if (t === "ai-info") return { ...base, summary: c.summary, facts: c.facts, notOffered: c.not_offered, describe: c.describe, llmsText: buildLlmsText(model) };
  if (t === "examples") {
    return { ...base, intro: c.intro || [], cases: c.cases || [], cards: CARD_ORDER.map((key) => cardRef(model, key)),
      flows: payloadFor(model, model.byId.home).examples };
  }
  throw new Error(`unsupported page type ${t}`);
}

function jsonLdFor(model, page, c, payload) {
  const org = { "@type": "Organization", "@id": `${BASE}/#organization`, name: "Aidreamcapes", url: `${BASE}/` };
  const graph = [org];
  if (page.id === "home") graph.push({ "@type": "WebSite", "@id": `${BASE}/#website`, name: "Aidreamcapes", url: `${BASE}/`, inLanguage: "en", publisher: { "@id": `${BASE}/#organization` } });
  else graph.push({ "@type": "BreadcrumbList", itemListElement: payload.breadcrumbs.map((crumb, index) => ({ "@type": "ListItem", position: index + 1, name: crumb.label, item: `${BASE}${crumb.href === "/" ? "/" : crumb.href}` })) });
  const webpageType = { hub: "CollectionPage", index: "CollectionPage", industry: "CollectionPage", platform: "CollectionPage", occasion: "CollectionPage", examples: "CollectionPage", contact: "ContactPage", about: "AboutPage" }[page.type] || "WebPage";
  if (page.type === "article") {
    graph.push({ "@type": page.section === "blog" ? "BlogPosting" : "Article", headline: c.h1, description: c.description, image: `${BASE}${img(page.img)}`, author: { "@id": `${BASE}/#organization` }, publisher: { "@id": `${BASE}/#organization` }, datePublished: "2026-10-02", dateModified: "2026-10-02", mainEntityOfPage: canonical(page), inLanguage: "en" });
  } else {
    graph.push({ "@type": webpageType, "@id": `${canonical(page)}#webpage`, url: canonical(page), name: c.title, description: c.description, inLanguage: "en", isPartOf: { "@id": `${BASE}/#website` } });
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
    const payload = payloadFor(model, page);
    const ogImage = imageRef(model, page.img, c.h1);
    const robots = page.noindex ? { index: false, follow: true } : { index: true, follow: true, maxImagePreview: "large" };
    const seo = {
      title: c.title, description: c.description, keywords: (c.secondary_keywords || []).join(", "), primaryKeyword: page.primary_keyword,
      canonicalPath: page.url, canonical: canonical(page), robots, index: !page.noindex,
      ogImage: ogImage.src, ogImageAlt: ogImage.alt, twitterDescription: c.description,
      jsonLd: jsonLdFor(model, page, c, payload)
    };
    const media = [];
    const pushMedia = (ref) => { if (ref?.src && ref.alt && !media.some((item) => item.src === ref.src)) media.push(ref); };
    pushMedia(ogImage);
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
  const tool = (id) => link(id, { description: TOOL_DESC[id], image: img(model.byId[id].img) });
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
        group("Platforms & help", [...Object.keys(model.plat).map((slug) => `plat-${slug}`), "pricing", "faq", "contact", "about", "trust", "blog", "guides"])
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
  const slugs = new Set(build.pages.map((page) => page.slug));
  for (const [from, to] of build.redirects) {
    if (slugs.has(from)) errors.push(`redirect source is a live page: ${from}`);
    if (!slugs.has(to) && to !== "/ai-video-generation" && to !== "/ai-image-generation") errors.push(`redirect target missing: ${to}`);
  }
  return errors;
}
