import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { PrismaClient } from "@prisma/client";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

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

const { storefrontCardImageAlt, storefrontMeaningfulAlt, storefrontSourceImageAlt, storefrontVideoPosterAlt } = mediaAltExports;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const blockedPattern = /\b(?:visual reference|source reference|gallery image|gallery example|package gallery|image\s+\d+|for browsing|for review|storefront browsing|package gallery example|gallery scene example|package showcase frame|package cover frame|featured package scene|related package scene|private gallery visual frame|private storefront gallery|private gallery workflow|private AI album workflow|visual frame|detailed storefront visual|storefront visual showing|finished gallery example|private AI photo example|private AI photo package|how to plan this|mydreamshoots|mydreamshoots\.com|aidreamshoots|aidreamcapes|AI-generated video poster)\b/i;
const pathOrFilePattern = /https?:\/\/|\/assets\/|(?:^|\s)sites\/|(?:^|\s)[\w./-]+\.(?:png|jpe?g|webp|avif|svg)(?:\?\S+)?/i;
const repeatedPhrasePattern = /\b([a-z][a-z'-]*(?:\s+[a-z][a-z'-]*){1,3})\s+\1\b/i;
const productionDirectionPattern = /\b(?:scene\s*\d+|framing|facial crop|half-body pose|group framing|environmental view|detail crop|vertical framing|cinematic contrast|album-cover crop|event lighting|studio light|window light|ambient light|rim light|editorial light|front light|visual reference|source reference)\b/i;
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
  assert(!productionDirectionPattern.test(alt), `${context} includes production direction: ${alt}`);
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
  virtualTryOnAlt === "Virtual Try-On portrait.",
  `Virtual Try-On fallback should use a concise subject description: ${virtualTryOnAlt}`
);

const editByPromptAlt = storefrontCardImageAlt({
  brand: "MyDreamShoots",
  category: "edit-by-prompt",
  description: "",
  imageUrl: "/assets/dreamshoot/generated/pack-covers/social-cards/social-cards-cover.webp",
  locale: "en",
  meta: "AI Image Generation",
  role: "card",
  title: "Edit By Prompt"
});
assert(
  editByPromptAlt === "Social profile portrait.",
  `Edit By Prompt must use a subject-based alt without production language: ${editByPromptAlt}`
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

assert(
  storefrontSourceImageAlt({ imageUrl: "/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-garden-couple.jpg" })
    === "Bride and groom holding a floral wedding invitation in a garden at golden hour.",
  "wedding invitation garden image must have its own canonical alt"
);
assert(
  storefrontSourceImageAlt({ imageUrl: "/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-couple-reviewing.jpg" })
    === "Bride and groom reviewing wedding invitation cards at a candlelit reception table.",
  "wedding invitation review image must have its own canonical alt"
);

const prisma = new PrismaClient();
const state = await readPlatformStateFromSql(prisma);
const myDreamShootsPacks = (state.creativePacks ?? []).filter((pack) => pack.siteId === "site_dreamshoot" && pack.status === "active");
const myDreamShootsAssets = (state.mediaAssets ?? []).filter((asset) => asset.siteId === "site_dreamshoot");
const altByImage = new Map();
let galleryCount = 0;

for (const pack of myDreamShootsPacks) {
  const images = [pack.imageUrl, ...(Array.isArray(pack.galleryImages) ? pack.galleryImages : [])]
    .filter((imageUrl) => typeof imageUrl === "string" && imageUrl.trim());
  const alts = Array.isArray(pack.galleryImageAlts) ? pack.galleryImageAlts : [];
  const hasCoverAlt = alts.length === images.length;
  const hasGalleryOnlyAlts = alts.length === images.length - 1;
  assert(hasCoverAlt || hasGalleryOnlyAlts, `${pack.id} cover/gallery images and alts must have compatible lengths`);
  images.forEach((imageUrl, index) => {
    if (hasGalleryOnlyAlts && index === 0) return;
    galleryCount += 1;
    const alt = String(alts[hasCoverAlt ? index : index - 1] ?? "").trim();
    const identity = imageIdentity(imageUrl);
    assertCleanAlt(alt, `${pack.id} ${index === 0 ? "cover" : `gallery alt ${index}`}`);
    const existing = altByImage.get(identity);
    if (existing) {
      assert(normalizeAlt(existing) === normalizeAlt(alt), `same image URL must keep the same alt: ${identity}`);
      return;
    }
    altByImage.set(identity, alt);
  });
}

assert(myDreamShootsPacks.length > 0, "expected active MyDreamShoots creative packs");
assert(galleryCount > 0, "expected MyDreamShoots cover/gallery alts");
assert(myDreamShootsAssets.length > 0, "expected MyDreamShoots media assets");
for (const asset of myDreamShootsAssets) {
  assertCleanAlt(String(asset.altText ?? ""), `media asset ${asset.id}`);
}

console.log(JSON.stringify({
  ok: true,
  samples,
  virtualTryOnAlt,
  editByPromptAlt,
  myDreamShoots: {
    creativePacks: myDreamShootsPacks.length,
    galleryAlts: galleryCount,
    uniqueGalleryImages: altByImage.size,
    mediaAssets: myDreamShootsAssets.length
  }
}, null, 2));
await prisma.$disconnect();
