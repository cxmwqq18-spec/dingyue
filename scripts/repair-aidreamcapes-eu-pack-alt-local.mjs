#!/usr/bin/env node

import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-pack-alt-repair");
const EXPECTED_SLUGS = [
  "avatar", "background-changer", "background-remover", "bikini", "black-friday", "boudoir", "cannes", "christmas-photo", "color-correction", "cyberpunk", "edit-by-prompt", "engagement-photo", "gala-photo", "hairstyle-generator", "halloween-photo", "headshot", "holiday", "mafia", "magic-eraser", "motion-generator", "nightlife", "old-photo-restoration", "only-fans", "photo-enhancer", "portrait-photo", "portrait-retouch", "rich-lifestyle", "singles-awareness-day", "soccer", "social-cards", "street-style", "swimsuit", "thanksgiving-photo", "travel", "unblur-image", "urban", "valentines-photo", "virtual-try-on", "wedding-photo"
];

const LABELS = {
  avatar: "avatar professionnel", "background-changer": "changement d’arrière-plan", "background-remover": "suppression d’arrière-plan", bikini: "style balnéaire", "black-friday": "campagne Black Friday", boudoir: "portrait boudoir", cannes: "portrait de la Riviera", "christmas-photo": "photo de Noël", "color-correction": "correction des couleurs", cyberpunk: "portrait cyberpunk", "edit-by-prompt": "retouche avec une consigne", "engagement-photo": "photo de fiançailles", "gala-photo": "portrait de gala", "hairstyle-generator": "essai de coiffure", "halloween-photo": "photo d’Halloween", headshot: "portrait professionnel", holiday: "photo de fête saisonnière", mafia: "portrait noir de fiction", "magic-eraser": "retouche à la gomme magique", "motion-generator": "photo de mouvement", nightlife: "portrait de vie nocturne", "old-photo-restoration": "restauration de photo ancienne", "only-fans": "portrait de créateur adulte", "photo-enhancer": "photo améliorée", "portrait-photo": "portrait photo", "portrait-retouch": "retouche de portrait", "rich-lifestyle": "photo lifestyle premium", "singles-awareness-day": "portrait de célébration de soi", soccer: "photo de football", "social-cards": "visuel pour réseaux sociaux", "street-style": "photo street style", swimsuit: "photo en maillot de bain", "thanksgiving-photo": "photo de Thanksgiving", travel: "photo de voyage", "unblur-image": "photo rendue plus nette", urban: "portrait urbain", "valentines-photo": "photo de Saint-Valentin", "virtual-try-on": "essayage virtuel", "wedding-photo": "photo de mariage"
};

const TOKEN_MAP = new Map(Object.entries({
  adult: "adulte", adults: "adultes", analog: "analogique", arcade: "salle d’arcade", autumn: "automne", beach: "plage", bicycle: "vélo", botanical: "botanique", breakfast: "petit-déjeuner", brutalist: "brutaliste", cabin: "cabane", cafe: "café", candle: "bougie", coastal: "côtier", colorful: "coloré", couple: "couple", cove: "crique", creator: "créateur", dinner: "dîner", dog: "chien", evening: "soirée", fair: "fête foraine", family: "famille", forest: "forêt", garden: "jardin", greenhouse: "serre", hair: "cheveux", historic: "historique", indoor: "intérieur", lake: "lac", library: "bibliothèque", light: "lumière", loft: "loft", market: "marché", mediterranean: "méditerranéen", mirror: "miroir", mountain: "montagne", neon: "néon", night: "nuit", office: "bureau", outdoor: "extérieur", picnic: "pique-nique", rainy: "pluvieux", retro: "rétro", rooftop: "toit-terrasse", route: "route", seaside: "bord de mer", studio: "studio", street: "rue", summer: "été", sunset: "coucher de soleil", table: "table", train: "train", urban: "urbain", vintage: "vintage", window: "fenêtre", winter: "hiver", workshop: "atelier", calm: "calme", city: "ville", walk: "promenade", wind: "vent", cobalt: "cobalt", coral: "corail", piece: "pièce", wrapped: "enveloppée", letter: "lettre", jazz: "jazz", club: "club", carpet: "tapis", steps: "marches", red: "rouge", white: "blanc", silk: "soie", analogique: "analogique"
}));

const PACK_FILENAME_WORDS = new Set([
  "avatar", "background", "changer", "remover", "bikini", "black", "friday", "boudoir", "cannes", "christmas", "photo",
  "color", "correction", "cyberpunk", "edit", "prompt", "engagement", "gala", "hairstyle", "generator", "halloween", "headshot",
  "holiday", "mafia", "magic", "eraser", "motion", "nightlife", "old", "restoration", "only", "fans", "enhancer", "portrait",
  "retouch", "rich", "lifestyle", "singles", "awareness", "day", "soccer", "social", "cards", "street", "style", "swimsuit",
  "thanksgiving", "travel", "unblur", "urban", "valentines", "virtual", "try", "on", "wedding", "seasonal", "occasion", "gallery"
]);

const SCENES = [
  "un cadrage de portrait lisible dans un décor travaillé", "une scène en extérieur avec une lumière naturelle", "un moment spontané dans un lieu du quotidien", "un détail de tenue, de matière ou d’accessoire", "un portrait en trois-quarts avec le contexte visible", "une composition chaleureuse éclairée en douceur", "une scène urbaine aux lignes clairement reconnaissables", "un échange naturel entre le sujet et son environnement", "une ambiance de voyage ou d’évasion", "une pose éditoriale avec un arrière-plan distinct", "une scène de célébration aux couleurs du thème", "un portrait final pensé pour une galerie privée"
];

function parseApply() { return process.argv.includes("--apply") || process.argv.includes("--mode=apply"); }
function clone(value) { return structuredClone(value); }
function basename(value) { return path.basename(String(value || "").split(/[?#]/)[0]); }
function tokenDescription(value) {
  const file = basename(value);
  const stem = file.slice(0, Math.max(0, file.length - path.extname(file).length));
  const words = stem.toLowerCase().replace(/\b(?:cover|hero|slot|\d+)\b/g, " ").split(/[-_]+/).filter(Boolean);
  const translated = words.map((word) => {
    if (PACK_FILENAME_WORDS.has(word) || /^[a-f0-9]{6,}$/i.test(word)) return "";
    return TOKEN_MAP.get(word) || (word.length > 3 ? word : "");
  }).filter(Boolean);
  return translated.join(" ").replace(/\s+/g, " ").trim();
}
function isBadAlt(value) {
  const alt = String(value || "").trim();
  return !alt || /^image (?:illustrant|de couverture)/i.test(alt) || /\b(?:occasion|seasonal)\s+[a-f0-9]{6,}/i.test(alt) || /\b(?:polished|close|facial|representative|cover image|christmas photo|engagement photo)\b/i.test(alt) || /\b(?:the|with|and|ou a|dans a)\b/i.test(alt);
}
function fallbackAlt(slug, url, index, role) {
  const label = LABELS[slug] || "création visuelle";
  const descriptor = tokenDescription(url);
  const scene = role === "cover"
    ? (descriptor ? `une composition dans un décor ${descriptor}` : SCENES[0])
    : `${SCENES[index % SCENES.length]}${descriptor ? `, avec ${descriptor}` : ""}`;
  return `${label[0].toUpperCase()}${label.slice(1)} : ${scene}.`;
}
function uniqueAlt(value, used, slug, url, index, role) {
  let alt = String(value || "").trim();
  if (isBadAlt(alt)) alt = fallbackAlt(slug, url, index, role);
  if (used.has(alt.toLowerCase())) alt = `${alt.replace(/\.$/, "")}, vue ${index + 1}.`;
  used.add(alt.toLowerCase());
  return alt;
}
function writeJson(filePath, value) { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`); }

async function main() {
  const apply = parseApply();
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const categories = await prisma.creativePackCategory.findMany({ where: { siteId: SITE_ID, slug: { in: EXPECTED_SLUGS } }, select: { id: true, slug: true } });
    const packs = await prisma.creativePack.findMany({ where: { siteId: SITE_ID, status: "active", categoryId: { in: categories.map((category) => category.id) } } });
    const bySlug = new Map(categories.map((category) => [category.id, category.slug]));
    const changes = packs.map((pack) => {
      const slug = bySlug.get(pack.categoryId) || pack.category || pack.name.toLowerCase();
      const gallery = Array.isArray(pack.galleryImages) ? pack.galleryImages.filter((url) => typeof url === "string" && url.trim()) : [];
      assert.equal(gallery.length, 12, `${slug}: expected 12 gallery images, got ${gallery.length}`);
      const used = new Set();
      const coverAlt = uniqueAlt("", used, slug, pack.imageUrl, 0, "cover");
      const nextAlts = [
        coverAlt,
        ...gallery.map((url, index) => uniqueAlt("", used, slug, url, index, "gallery"))
      ];
      return { pack, slug, nextAlts };
    });
    const report = { ok: true, mode: apply ? "apply-local" : "dry-run", siteId: SITE_ID, expectedThemes: EXPECTED_SLUGS.length, foundPacks: changes.length, changedPacks: changes.filter(({ pack, nextAlts }) => JSON.stringify(pack.galleryImageAlts) !== JSON.stringify(nextAlts)).length, emptyAlts: changes.reduce((count, item) => count + item.nextAlts.filter((alt) => !alt.trim()).length, 0), altEntries: changes.reduce((count, item) => count + item.nextAlts.length, 0), note: "Cover plus gallery alt arrays were normalized for the EU active theme packs; no image provider call." };
    assert.equal(changes.length, EXPECTED_SLUGS.length, `Expected ${EXPECTED_SLUGS.length} active EU theme packs, got ${changes.length}`);
    if (apply) {
      const backupPath = path.join(REPORT_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, changes.map(({ pack }) => ({ id: pack.id, galleryImageAlts: pack.galleryImageAlts })));
      await prisma.$transaction(async (tx) => {
        for (const { pack, nextAlts } of changes) await tx.creativePack.update({ where: { id: pack.id }, data: { galleryImageAlts: nextAlts } });
      }, { maxWait: 20_000, timeout: 120_000 });
      report.backupPath = backupPath;
    }
    writeJson(path.join(REPORT_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), report);
    console.log(JSON.stringify(report, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
