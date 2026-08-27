#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const applyDb = process.argv.includes("--db");
const snapshotArgument = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
const snapshotPath = path.resolve(
  snapshotArgument || "releases/remote-snapshots/mydreamshoots-production-current-2026-08-27-v128.json"
);

const imageAltByFile = {
  "avatar-nora-gpt2.png": "Creator profile portrait with personal styling.",
  "beauty-portrait-gpt2.png": "Soft studio beauty portrait with polished styling.",
  "cliffside-holiday-v1.png": "Cliffside travel portrait in bright destination light.",
  "cyberpunk-solo-city-v1.png": "Neon city cyberpunk portrait with futuristic styling.",
  "editorial-headshot-gpt2.png": "Editorial headshot portrait with polished studio lighting.",
  "flow-before-upload.png": "Source photo upload step before creating an album.",
  "flow-private-album-workspace.png": "Private album workspace with finished result cards.",
  "hairstyle-preview-v1.png": "Hairstyle preview portrait with polished hair direction.",
  "headshot-lifestyle-v1.png": "Lifestyle headshot with natural creator framing.",
  "hero-credit-studio-card.png": "Credit studio card showing package and album options.",
  "hero-package-wall.png": "Homepage wall showing multiple portrait outcomes.",
  "holiday-card-gpt2.png": "Holiday card style portrait with seasonal styling.",
  "holiday-portrait-v1.png": "Seasonal portrait with polished social styling.",
  "mafia-noir-single-v1.png": "Noir character portrait with dramatic lighting.",
  "nature-adventure-solo-v1.png": "Outdoor adventure portrait in a natural landscape.",
  "pricing-credits-visual.png": "Pricing credit visual with plan and checkout details.",
  "upscaler-utility-v1.png": "Enhanced image preview with crisp detail.",
  "worldcup-banner-cover.png": "Wide football supporter banner with stadium lights.",
  "worldcup-fan-poster.png": "Football fan poster artwork with stadium lighting.",
  "worldcup-friend-fan-photos.png": "Friends in football fan outfits celebrating together.",
  "worldcup-match-day-avatar.png": "Square match-day football fan avatar portrait.",
  "worldcup-social-story.png": "Vertical football fan story layout for mobile sharing.",
  "worldcup-stadium-portrait.png": "Football supporter portrait in stadium match light."
};

const altReplacementByFile = {
  "ai-mothers-day-phone-photo.jpg": "Phone capturing a Mother's Day breakfast moment with mother and daughter.",
  "hero-ai-mothers-day-gift-breakfast.jpg": "Mother's Day breakfast still life with flowers, gift box, card, pastries, and coffee."
};

const replacementByTitle = new Map([
  ["Create headshot from selfies", "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png"],
  ["AI headshots for LinkedIn, resumes, and founder profiles.", "/assets/dreamshoot/generated/20260618/headshot-lifestyle-v1.png"]
]);

function basename(value) {
  return String(value || "").split("?")[0].split("#")[0].split("/").filter(Boolean).at(-1) || "";
}

function walk(value, counters) {
  if (Array.isArray(value)) {
    value.forEach((item) => walk(item, counters));
    return;
  }
  if (!value || typeof value !== "object") return;

  const settings = value.settings;
  if (settings && typeof settings === "object") {
    const title = String(settings.title || "");
    const label = String(settings.label || "");
    if (replacementByTitle.has(title)) {
      settings.imageUrl = replacementByTitle.get(title);
      counters.themeImages += 1;
    } else if (title === "Pick a finished outcome" && label === "Photo packages") {
      settings.imageUrl = "/assets/dreamshoot/generated/20260622-homepage-unique/hero-package-wall.png";
      counters.themeImages += 1;
    } else if (title === "Turn package results into motion" && label === "AI video") {
      settings.imageUrl = "/assets/dreamshoot/generated/20260622-homepage-unique/hero-grid-video.png";
      counters.themeImages += 1;
    }
  }

  if (value.siteId === "site_dreamshoot" && typeof value.mimeType === "string" && value.mimeType.startsWith("image/")) {
    const file = basename(value.storageKey);
    const alt = altReplacementByFile[file] || (!String(value.altText || "").trim() ? imageAltByFile[file] : "");
    if (alt) {
      value.altText = alt;
      counters.mediaAlts += 1;
    } else if (!String(value.altText || "").trim()) {
      throw new Error(`No alt mapping for ${value.storageKey || value.id}`);
    }
  }

  Object.entries(value).forEach(([key, item]) => {
    if (key !== "settings") walk(item, counters);
  });
}

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const counters = { categoryCovers: 0, mediaAlts: 0, themeImages: 0 };
walk(snapshot, counters);
const activePacks = new Map((snapshot.creativePacks || [])
  .filter((pack) => pack.siteId === "site_dreamshoot" && pack.status === "active")
  .map((pack) => [pack.categoryId, pack]));
for (const category of snapshot.creativePackCategories || []) {
  const pack = activePacks.get(category.id);
  if (!pack || category.imageUrl === pack.imageUrl) continue;
  category.imageUrl = pack.imageUrl;
  counters.categoryCovers += 1;
}
const remainingEmptyImageAlts = (snapshot.mediaAssets || []).filter((asset) =>
  asset.siteId === "site_dreamshoot" && String(asset.mimeType || "").startsWith("image/") && !String(asset.altText || "").trim()
).length;
if (remainingEmptyImageAlts) throw new Error(`${remainingEmptyImageAlts} site_dreamshoot image assets still have empty altText`);
fs.writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
if (applyDb) {
  assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const mediaAssets = (snapshot.mediaAssets || []).filter((asset) => asset.siteId === "site_dreamshoot" && String(asset.mimeType || "").startsWith("image/") && String(asset.altText || "").trim());
    const categories = (snapshot.creativePackCategories || []).filter((category) => category.siteId === "site_dreamshoot" && category.imageUrl);
    await prisma.$transaction(async (tx) => {
      for (const asset of mediaAssets) {
        await tx.mediaAsset.updateMany({ where: { siteId: "site_dreamshoot", storageKey: asset.storageKey }, data: { altText: asset.altText } });
      }
      for (const category of categories) {
        const pack = activePacks.get(category.id);
        if (!pack) continue;
        await tx.creativePackCategory.updateMany({ where: { siteId: "site_dreamshoot", slug: category.slug }, data: { imageUrl: category.imageUrl } });
      }
    }, { timeout: 180_000 });
  } finally {
    await prisma.$disconnect();
  }
}
console.log(JSON.stringify({ ok: true, snapshotPath, appliedDb: applyDb, ...counters, remainingEmptyImageAlts }, null, 2));
