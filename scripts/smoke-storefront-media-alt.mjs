import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const repoRoot = process.cwd();

const mediaAltSource = fs.readFileSync(path.join(repoRoot, "src/lib/storefront-media-alt.ts"), "utf8");
const compiled = ts.transpileModule(mediaAltSource, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022
  }
}).outputText;
const mediaAltExports = {};
vm.runInNewContext(compiled, {
  exports: mediaAltExports,
  require: (id) => {
    if (id === "@/lib/spanish-storefronts") {
      return { isSpanishStorefrontSite: (site) => /(?:aidreamshoots|aidreamcapes)\.eu/i.test(String(site?.primaryDomain ?? "")) };
    }
    if (id === "@/lib/storefront-context/capabilities") {
      return {
        isAidreamcapesSite: (site) => ["site_aidreamcapes", "site_aidreamcapes_xby"].includes(String(site?.id ?? ""))
          || ["aidreamcapes", "aidreamcapes-eu"].includes(String(site?.slug ?? "").trim().toLowerCase())
      };
    }
    throw new Error(`Unexpected module import in smoke: ${id}`);
  }
});

const { storefrontCardImageAlt, storefrontMeaningfulAlt, storefrontVideoPosterAlt } = mediaAltExports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const blockedPattern = /\b(?:visual reference|source reference|gallery image|gallery example|package gallery|image\s+\d+|for browsing|for review|storefront browsing|package gallery example|gallery scene example|package showcase frame|package cover frame|featured package scene|related package scene|private gallery visual frame|private storefront gallery|private gallery workflow|private AI album workflow|visual frame|detailed storefront visual|storefront visual showing|finished gallery example|private AI photo example|private AI photo package|how to plan this|mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes|AI-generated video poster)\b/i;
const pathOrFilePattern = /https?:\/\/|\/assets\/|(?:^|\s)sites\/|(?:^|\s)[\w./-]+\.(?:png|jpe?g|webp|avif|svg)(?:\?\S+)?/i;
const repeatedPhrasePattern = /\b([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){1,3})\s+\1\b/i;
const stopWords = new Set(["a", "an", "and", "for", "in", "of", "on", "the", "to", "with"]);

function normalizeAlt(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function altTokens(value) {
  return new Set(normalizeAlt(value).split(" ").filter((token) => token.length > 2 && !stopWords.has(token)));
}

function altSimilarity(left, right) {
  const leftTokens = altTokens(left);
  const rightTokens = altTokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  let intersection = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) intersection += 1;
  }
  return intersection / (leftTokens.size + rightTokens.size - intersection);
}

function imageIdentity(value) {
  return String(value ?? "").trim().split("#")[0].split("?")[0];
}

function assertCleanAlt(alt, context) {
  assert(typeof alt === "string" && alt.trim(), `${context} is empty`);
  assert(!blockedPattern.test(alt), `${context} uses blocked template copy: ${alt}`);
  assert(!pathOrFilePattern.test(alt), `${context} includes a path, URL, or filename: ${alt}`);
  assert(!repeatedPhrasePattern.test(alt), `${context} repeats a phrase: ${alt}`);
}

const samples = [
  storefrontCardImageAlt({
    brand: "MyDreamShoots",
    category: "professional-headshots",
    description: "professional AI headshot with clean studio lighting",
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/professional-headshots/professional-headshots-03.webp",
    index: 2,
    locale: "en",
    meta: "AI Headshots",
    role: "gallery",
    title: "Professional Headshots"
  }),
  storefrontCardImageAlt({
    brand: "MyDreamShoots",
    category: "world-cup-fan-photos",
    description: "Football supporter portrait with green and yellow stadium flags, World Cup Fan Photos package gallery example for myDreamshoots.",
    imageAlts: [
      "Football supporter portrait with green and yellow stadium flags, World Cup Fan Photos package gallery example for myDreamshoots."
    ],
    imageUrl: "/assets/dreamshoot/generated/pack-galleries/world-cup-fan-photos/world-cup-fan-photos-01.webp",
    index: 0,
    locale: "en",
    meta: "Fan Photos",
    role: "gallery",
    title: "World Cup Fan Photos"
  }),
  storefrontCardImageAlt({
    brand: "MyDreamShoots",
    category: "background-remover",
    description: "clean product portrait on a transparent background",
    imageUrl: "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-product.webp",
    index: 5,
    locale: "en",
    meta: "Tools",
    role: "card",
    title: "Background Remover"
  }),
  storefrontCardImageAlt({
    brand: "AIdreamshoots",
    category: "retratos-profesionales",
    description: "retrato profesional con luz de estudio",
    imageUrl: "/assets/sites/site_aidreamshoots/creative-packs/pack-galleries/creator-portraits/creator-portraits-02.webp",
    index: 1,
    locale: "es",
    meta: "Perfiles",
    role: "gallery",
    title: "Retratos Profesionales"
  }),
  storefrontVideoPosterAlt({
    brand: "MyDreamShoots",
    locale: "en",
    meta: "a refined moving portrait from customer frames",
    title: "Cinematic Portrait Motion"
  })
];

for (const alt of samples) {
  assert(alt.length <= 118, `alt is too long: ${alt}`);
  assertCleanAlt(alt, "sample alt");
  assert((alt.match(/\b(?:AI|photo|gallery|package|preview|portrait|video|MyDreamShoots)\b/gi) ?? []).length <= 4, `alt has dense repeated SEO terms: ${alt}`);
}

const virtualTryOnAlt = storefrontCardImageAlt({
  brand: "MyDreamShoots",
  category: "virtual-try-on",
  description: "",
  imageUrl: "/assets/dreamshoot/generated/pack-galleries/virtual-try-on/virtual-try-on-08.webp",
  index: 15,
  locale: "en",
  meta: "AI Fashion",
  role: "gallery",
  title: "Virtual Try-On"
});
assert(
  /^Beauty portrait with editorial lighting(?:, .+)?\.$/.test(virtualTryOnAlt),
  `Virtual Try-On fallback should keep the real scene description: ${virtualTryOnAlt}`
);

assert(
  storefrontMeaningfulAlt("professional AI headshot with clean studio lighting, close portrait with clear facial detail, Professional Headshots package gallery example for myDreamshoots.") === "",
  "legacy stored MyDreamShoots gallery alt should be rejected"
);

assert(
  storefrontMeaningfulAlt("Photo AI hero image showing a private gallery workflow for MyDreamShoots.") === "",
  "stored tool hero workflow alt should be rejected"
);

assert(
  storefrontMeaningfulAlt("AI creator workflow result with polished studio presentation, detailed storefront visual showing the subject, setting, and intended gallery use, AI Video Add-ons: how to plan this myDreamshoots photo package category for myDreamshoots.") === "",
  "long stored category SEO alt should be rejected"
);

assert(
  storefrontMeaningfulAlt("Football fan portrait in a stadium.") === "Football fan portrait in a stadium",
  "short natural alt should be accepted"
);

assert(
  storefrontMeaningfulAlt("Beauty portrait with editorial lighting, virtual try on 08 gallery image 16 visual reference.") === "",
  "visual-reference and image-index suffixes should be rejected"
);

const state = JSON.parse(fs.readFileSync(path.join(repoRoot, "data/platform-state.json"), "utf8"));
const myDreamShootsPacks = (state.creativePacks ?? []).filter((pack) => pack.siteId === "site_dreamshoot");
const myDreamShootsAssets = (state.mediaAssets ?? []).filter((asset) => asset.siteId === "site_dreamshoot");
const altByImage = new Map();
const acceptedAlts = [];
let galleryCount = 0;

for (const pack of myDreamShootsPacks) {
  const images = [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])]
    .filter((imageUrl) => typeof imageUrl === "string" && imageUrl.trim());
  const alts = Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts : [];
  assert(images.length === alts.length, `${pack.id} cover/gallery images and alts must have equal lengths`);
  images.forEach((imageUrl, index) => {
    galleryCount += 1;
    const alt = String(alts[index] ?? "").trim();
    const identity = imageIdentity(imageUrl);
    assertCleanAlt(alt, `${pack.id} ${index === 0 ? "cover" : `gallery alt ${index}`}`);
    const existing = altByImage.get(identity);
    if (existing) {
      assert(normalizeAlt(existing) === normalizeAlt(alt), `same image URL must keep the same alt: ${identity}`);
      return;
    }
    assert(!acceptedAlts.some((item) => item.normalized === normalizeAlt(alt)), `different image URLs must not share an alt: ${identity}`);
    assert(!acceptedAlts.some((item) => altSimilarity(item.alt, alt) >= 0.82), `different image URLs have near-duplicate alts: ${identity}`);
    altByImage.set(identity, alt);
    acceptedAlts.push({ alt, normalized: normalizeAlt(alt) });
  });
}

assert(myDreamShootsPacks.length === 38, `expected 38 MyDreamShoots creative packs, found ${myDreamShootsPacks.length}`);
assert(galleryCount === 494, `expected 494 MyDreamShoots cover/gallery alts, found ${galleryCount}`);
assert(myDreamShootsAssets.length === 23, `expected 23 MyDreamShoots media assets, found ${myDreamShootsAssets.length}`);
for (const asset of myDreamShootsAssets) {
  assertCleanAlt(String(asset.altText ?? ""), `media asset ${asset.id}`);
}

console.log(JSON.stringify({
  ok: true,
  samples,
  virtualTryOnAlt,
  myDreamShoots: {
    creativePacks: myDreamShootsPacks.length,
    galleryAlts: galleryCount,
    uniqueGalleryImages: altByImage.size,
    mediaAssets: myDreamShootsAssets.length
  }
}, null, 2));
