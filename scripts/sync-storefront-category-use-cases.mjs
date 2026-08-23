#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql, writePlatformStateToSql } from "./lib/platform-state-sql.mjs";

const repoRoot = process.cwd();
const useCaseProfilesPath = path.join(repoRoot, "src", "lib", "photo-package-use-case-profiles.json");
const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const updateDb = args.has("--db");
const targetSiteIds = new Set(["site_dreamshoot", "site_aidreamcapes"]);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function normalizeSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .replace(/^collections\//, "")
    .replace(/^pack-dreamshoot-/, "")
    .replace(/^dreamshoot-/, "")
    .replace(/^ai-/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const dreamshootPackAliases = {
  headshots: "professional-headshots",
  professional: "professional-headshots",
  "professional-headshot": "professional-headshots",
  "work-headshots": "professional-headshots",
  creator: "creator-portraits",
  "creator-portrait": "creator-portraits",
  worldcup: "world-cup-fan-photos",
  "world-cup": "world-cup-fan-photos",
  "fan-photos": "world-cup-fan-photos",
  gala: "gala-photos",
  noir: "mafia",
  outdoor: "nature",
  "outdoor-portraits": "nature",
  travel: "outdoor-creator-scenes",
  "travel-scene-pack": "outdoor-creator-scenes",
  "travel-scenes": "outdoor-creator-scenes",
  "try-on": "virtual-try-on",
  outfit: "virtual-try-on",
  fashion: "fashion-editorial",
  product: "product-style",
  social: "social-cards",
  wedding: "wedding-portraits",
  "wedding-photos": "wedding-portraits",
  indian: "indian-wedding",
  cultural: "indian-wedding",
  valentine: "valentine-photos",
  "engagement-photos": "engagement",
  christmas: "christmas-photos",
  "christmas-photo": "christmas-photos",
  xmas: "christmas-photos",
  thanksgiving: "thanksgiving-group-photos",
  "thanksgiving-photos": "thanksgiving-group-photos",
  halloween: "halloween-party-photos",
  "halloween-photos": "halloween-party-photos",
  "video-add-ons": "ai-video-add-ons",
  "ai-video": "ai-video-add-ons",
  upscaler: "magic-upscaler",
  "image-upscaler": "magic-upscaler"
};

const aidreamcapesAliases = {
  "fan-scene": "fan-scene-albums",
  "fan-scenes": "fan-scene-albums",
  fan: "fan-scene-albums",
  "game-day": "game-day-group-photos",
  sports: "game-day-group-photos",
  premiere: "premiere-style-portraits",
  "premiere-style": "premiere-style-portraits",
  christmas: "christmas-group-albums",
  thanksgiving: "thanksgiving-memory-sets",
  halloween: "halloween-party-portraits",
  seasonal: "seasonal-celebration-photos",
  celebration: "seasonal-celebration-photos"
};

function lookup(map, value, aliases = {}) {
  const slug = normalizeSlug(value);
  if (!slug) return undefined;
  return map[slug] ?? map[aliases[slug]];
}

function packDescriptionForProfile(profile) {
  const bestFor = profile.bestFor.slice(0, 4).join("; ");
  return [
    profile.detailIntro,
    profile.whatCreates,
    bestFor ? `Best for ${bestFor}.` : "",
    profile.safetyNote ?? ""
  ].filter(Boolean).join(" ");
}

function aidreamcapesPackHeadline(pack, profile) {
  const useCases = profile.tags.slice(0, 2).join(" and ");
  return useCases ? `${pack.name} for ${useCases}` : `${pack.name} for private occasion albums`;
}

function aidreamcapesPackDescription(pack, profile) {
  const bestFor = profile.bestFor.slice(0, 4).join("; ");
  return [
    `${pack.name} helps create ${profile.metaLabel.toLowerCase()} for ${bestFor}.`,
    profile.whatCreates,
    profile.safetyNote ?? ""
  ].filter(Boolean).join(" ");
}

function applyFieldUpdate(record, fields, changes, targetType) {
  for (const [field, value] of Object.entries(fields)) {
    if (typeof value !== "string" || !value.trim()) continue;
    if (record[field] === value) continue;
    changes.push({
      targetType,
      id: record.id,
      siteId: record.siteId,
      field,
      before: record[field],
      after: value
    });
    record[field] = value;
  }
}

function profileForDreamshootCategory(category, categoryProfiles) {
  return lookup(categoryProfiles, category.slug, dreamshootPackAliases);
}

function profileForDreamshootPack(pack, categoryProfiles, categoryById) {
  const category = categoryById.get(pack.categoryId);
  return lookup(categoryProfiles, category?.slug, dreamshootPackAliases)
    ?? lookup(categoryProfiles, pack.category, dreamshootPackAliases)
    ?? lookup(categoryProfiles, pack.name, dreamshootPackAliases)
    ?? lookup(categoryProfiles, pack.id, dreamshootPackAliases);
}

function profileForAidreamcapesCategory(category, categoryProfiles) {
  return lookup(categoryProfiles, category.slug, aidreamcapesAliases);
}

function profileForAidreamcapesPack(pack, categoryProfiles, categoryById) {
  const category = categoryById.get(pack.categoryId);
  return lookup(categoryProfiles, category?.slug, aidreamcapesAliases)
    ?? lookup(categoryProfiles, pack.category, aidreamcapesAliases);
}

async function updateDatabase(changes) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const categoryUpdates = new Map();
    const packUpdates = new Map();
    for (const change of changes) {
      const map = change.targetType === "CreativePackCategory" ? categoryUpdates : packUpdates;
      const current = map.get(change.id) ?? {};
      current[change.field] = change.after;
      map.set(change.id, current);
    }
    for (const [id, data] of categoryUpdates) {
      await prisma.creativePackCategory.update({ where: { id }, data });
    }
    for (const [id, data] of packUpdates) {
      await prisma.creativePack.update({ where: { id }, data });
    }
  } finally {
    await prisma.$disconnect();
  }
}

const state = await readPlatformStateFromSql();
const useCaseProfiles = readJson(useCaseProfilesPath);
const dreamshootCategoryProfiles = useCaseProfiles.mydreamshootsCategories ?? {};
const aidreamcapesCategoryProfiles = useCaseProfiles.aidreamcapesCategories ?? {};
const categories = state.creativePackCategories ?? [];
const packs = state.creativePacks ?? [];
const categoryById = new Map(categories.map((category) => [category.id, category]));
const changes = [];

for (const category of categories) {
  if (!targetSiteIds.has(category.siteId) || category.status !== "active") continue;
  const profile = category.siteId === "site_dreamshoot"
    ? profileForDreamshootCategory(category, dreamshootCategoryProfiles)
    : profileForAidreamcapesCategory(category, aidreamcapesCategoryProfiles);
  if (!profile) continue;
  applyFieldUpdate(category, {
    description: profile.cardDescription,
    heroTitle: profile.headline,
    heroSubtitle: profile.detailIntro
  }, changes, "CreativePackCategory");
}

for (const pack of packs) {
  if (!targetSiteIds.has(pack.siteId) || pack.status !== "active") continue;
  if (pack.siteId === "site_dreamshoot") {
    const profile = profileForDreamshootPack(pack, dreamshootCategoryProfiles, categoryById);
    if (!profile) continue;
    applyFieldUpdate(pack, {
      headline: profile.headline,
      description: packDescriptionForProfile(profile)
    }, changes, "CreativePack");
    continue;
  }

  const profile = profileForAidreamcapesPack(pack, aidreamcapesCategoryProfiles, categoryById);
  if (!profile) continue;
  applyFieldUpdate(pack, {
    headline: aidreamcapesPackHeadline(pack, profile),
    description: aidreamcapesPackDescription(pack, profile)
  }, changes, "CreativePack");
}

if (!dryRun) {
  await writePlatformStateToSql(state);
}

if (updateDb && changes.length && !dryRun) {
  await updateDatabase(changes);
}

const byTarget = changes.reduce((acc, change) => {
  const key = `${change.siteId}:${change.targetType}`;
  acc[key] = (acc[key] ?? 0) + 1;
  return acc;
}, {});

console.log(JSON.stringify({
  dryRun,
  updateDb,
  changedFields: changes.length,
  changedRecords: new Set(changes.map((change) => `${change.targetType}:${change.id}`)).size,
  byTarget
}, null, 2));
