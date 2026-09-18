#!/usr/bin/env node

// Rebuild the customer-facing French copy for the EU Save the Date pages.
// This is deliberately local-only: it never calls an image provider and never
// deletes an existing asset. Image references are constrained to the page's
// already verified manifest so a legacy theme cannot leak into the page.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const DOMAIN = "https://aidreamcapes.eu";
const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");
const BACKUP_ROOT = path.resolve(".tmp", "aidreamcapes-eu-save-date-french-copy");

const TOPICS = {
  christmas: { name: "Noël", noun: "une vidéo de Noël", tone: "christmas", subject: "les cadeaux, les lumières et les souvenirs de fête" },
  engagement: { name: "les fiançailles", noun: "une vidéo de fiançailles", tone: "wedding", subject: "le couple, la bague et l’annonce de votre engagement" },
  "fathers-day": { name: "la fête des pères", noun: "une vidéo pour la fête des pères", tone: "fathers-day", subject: "un cadeau, une activité partagée et un message de gratitude" },
  halloween: { name: "Halloween", noun: "une vidéo Halloween", tone: "halloween", subject: "les costumes adultes, les citrouilles et l’ambiance de la fête" },
  "mothers-day": { name: "la fête des mères", noun: "une vidéo pour la fête des mères", tone: "mothers-day", subject: "les fleurs, un cadeau et un souvenir familial" },
  "new-year": { name: "le Nouvel An", noun: "une vidéo du Nouvel An", tone: "new-year", subject: "le compte à rebours, les lumières et vos vœux" },
  proposal: { name: "la demande en mariage", noun: "une vidéo de demande en mariage", tone: "wedding", subject: "la préparation, la bague et la réaction du couple" },
  "save-the-date": { name: "Save the Date", noun: "une vidéo Save the Date", tone: "wedding", subject: "la date, le couple et le lieu de votre mariage" },
  thanksgiving: { name: "Thanksgiving", noun: "une vidéo de Thanksgiving", tone: "thanksgiving", subject: "le repas, la gratitude et les retrouvailles" },
  "valentines-day": { name: "la Saint-Valentin", noun: "une vidéo de Saint-Valentin", tone: "wedding", subject: "votre histoire, un dîner romantique et un moment à deux" },
  "wedding-ceremony": { name: "la cérémonie de mariage", noun: "une vidéo de cérémonie de mariage", tone: "wedding", subject: "l’allée, les vœux, les alliances et les émotions de la journée" },
  "wedding-invitation": { name: "l’invitation de mariage", noun: "une vidéo d’invitation de mariage", tone: "wedding", subject: "la papeterie, la date, le lieu et les informations utiles aux invités" }
};

const SAVE_SEO = {
  christmas: ["Vidéo de Noël avec l’IA | Aidreamcapes", "Créez une vidéo de Noël avec l’IA autour des cadeaux, des lumières et des souvenirs chaleureux à partager pendant les fêtes.", "vidéo de Noël avec IA, vidéo de vœux, cadeaux de Noël, souvenirs de fête"],
  engagement: ["Vidéo de fiançailles avec l’IA", "Créez une vidéo de fiançailles avec l’IA pour présenter votre couple, votre annonce et vos souvenirs dans une séquence naturelle à partager.", "vidéo de fiançailles avec IA, annonce de fiançailles, vidéo de couple, bague de fiançailles"],
  "fathers-day": ["Vidéo pour la fête des pères avec l’IA", "Créez une vidéo pour la fête des pères avec l’IA autour d’un cadeau, d’une activité en plein air et d’un message de gratitude personnalisé.", "vidéo fête des pères IA, cadeau pour papa, souvenir familial, message de gratitude"],
  halloween: ["Vidéo Halloween avec l’IA | Aidreamcapes", "Imaginez une vidéo Halloween avec l’IA autour des costumes adultes, des citrouilles et d’un décor mystérieux, sans contenu gore ni sujet mineur.", "vidéo Halloween avec IA, costumes adultes, décor de fête, citrouille créative"],
  "mothers-day": ["Vidéo pour la fête des mères avec l’IA", "Créez une vidéo pour la fête des mères avec l’IA autour des fleurs, d’un cadeau, d’un message et d’un souvenir familial personnalisé.", "vidéo fête des mères IA, cadeau personnalisé, fleurs, souvenir familial"],
  "new-year": ["Vidéo du Nouvel An avec l’IA | Aidreamcapes", "Créez une vidéo du Nouvel An avec l’IA autour du compte à rebours, des lumières, de la fête et de vos nouveaux projets à partager.", "vidéo du Nouvel An avec IA, compte à rebours, vœux, vidéo de fête"],
  proposal: ["Vidéo de demande en mariage avec l’IA", "Imaginez une vidéo de demande en mariage avec l’IA : préparation, bague, question et réaction du couple dans une scène romantique cohérente.", "vidéo demande en mariage IA, surprise romantique, révélation de bague, vidéo de couple"],
  "save-the-date": ["Vidéo Save the Date avec l’IA | Aidreamcapes", "Créez une vidéo Save the Date avec l’IA pour annoncer une date, un couple et un lieu dans une invitation claire à partager avec vos proches.", "vidéo Save the Date IA, annonce mariage, date de mariage, invitation vidéo"],
  thanksgiving: ["Vidéo de Thanksgiving avec l’IA", "Créez une vidéo de Thanksgiving avec l’IA autour du repas, de la gratitude et des retrouvailles dans une ambiance automnale chaleureuse.", "vidéo Thanksgiving IA, repas en famille, gratitude, vidéo Friendsgiving"],
  "valentines-day": ["Vidéo de Saint-Valentin avec l’IA | Aidreamcapes", "Créez une vidéo de Saint-Valentin avec l’IA pour raconter votre histoire, annoncer une date ou partager un dîner dans une scène romantique personnalisée.", "vidéo Saint-Valentin IA, vidéo romantique, annonce mariage, vidéo de couple"],
  "wedding-ceremony": ["Vidéo de cérémonie de mariage avec l’IA", "Créez une vidéo de cérémonie de mariage avec l’IA autour des vœux, des alliances, de l’allée et des émotions de votre journée.", "vidéo cérémonie mariage IA, vœux, alliances, souvenirs de mariage"],
  "wedding-invitation": ["Vidéo d’invitation de mariage avec l’IA", "Présentez votre papeterie et les informations du mariage dans une vidéo d’invitation créée avec l’IA, prête à relire avant le partage.", "vidéo invitation mariage IA, papeterie mariage, invitation vidéo, informations invités"]
};

const IMAGE_KEYS = /^(?:src|imageUrl|imageOriginalUrl|poster|posterUrl|thumbnail|thumbnailUrl|cover|coverUrl|heroImage|backgroundImage|beforeImage|resultImageUrl)$/i;
const ALT_KEYS = /^(?:alt|imageAlt|ogImageAlt|twitterImageAlt)$/i;
const IMAGE_VALUE = /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i;

function clone(value) { return structuredClone(value); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function stripQuery(value) { return clean(value).split(/[?#]/)[0]; }
function sha(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function topicFor(slug) { return TOPICS[slug.split("/").filter(Boolean).at(-1)] ?? TOPICS["save-the-date"]; }
function saveSlug(slug) { return slug.split("/").filter(Boolean).at(-1) ?? ""; }
function withArticle(value) { return /^(?:la |le |les |l’|l')/i.test(value) ? value : `la ${value}`; }

function sectionTitle(sectionKey, sectionType, topic) {
  const name = topic.name;
  if (/hero/i.test(sectionKey)) return `Créer ${topic.noun} avec l’IA`;
  if (/faq/i.test(sectionKey) || sectionType === "faq") return `Questions fréquentes sur ${name}`;
  if (/format/i.test(sectionKey)) return `Choisir le bon format pour ${name}`;
  if (/quality|boundar|evidence/i.test(sectionKey) || sectionType === "editorial_quality") return `Vérifier la qualité de ${name}`;
  if (/workflow|parcours/i.test(sectionKey) || sectionType === "editorial_steps") return `Créer ${topic.noun} en quelques étapes`;
  if (/final|cta/i.test(sectionKey) || sectionType === "editorial_cta") return `Donner une forme claire à ${name}`;
  if (/definition/i.test(sectionKey)) return `Comprendre ${topic.noun}`;
  if (/scene|idea|story|use.case|family|match|position|detail|checklist/i.test(sectionKey)) return `Idées et conseils pour ${name}`;
  return `Préparer ${topic.noun}`;
}

function sectionIntro(sectionKey, topic) {
  const name = topic.name.toLowerCase();
  if (/hero/i.test(sectionKey)) return `Composez ${topic.noun} avec l’IA autour de ${topic.subject}. Choisissez des images autorisées, une direction cohérente et un message facile à relire avant le partage.`;
  if (/quality|boundar|evidence/i.test(sectionKey)) return `Contrôlez les visages, les mains, les objets, le cadrage et le texte afin que ${name} reste naturel et compréhensible.`;
  if (/workflow/i.test(sectionKey)) return `Préparez vos sources, choisissez une direction visuelle, puis relisez chaque résultat avant de le partager.`;
  if (/format/i.test(sectionKey)) return `Adaptez le cadrage et la durée au canal choisi tout en gardant ${name} et votre message immédiatement lisibles.`;
  if (/definition/i.test(sectionKey)) return `${topic.noun} rassemble des images et des mouvements courts qui mettent en scène ${topic.subject}, dans une direction pensée pour votre histoire.`;
  if (/scene|idea|story|use.case|family|match|position|detail|checklist/i.test(sectionKey)) return `Associez un sujet clair, une ambiance cohérente et un texte éditable pour créer un contenu pertinent pour ${name}.`;
  return `Préparez ${topic.noun} avec des sources autorisées, puis vérifiez chaque détail avant le partage.`;
}

function blockTitle(sectionKey, sectionType, index, topic) {
  const name = topic.name;
  if (sectionType === "editorial_steps") return ["Choisir les sources", "Définir le message", "Composer les scènes", "Régler le rythme", "Relire le résultat", "Préparer le partage"][index] ?? `Étape ${index + 1}`;
  if (sectionType === "editorial_quality") return index === 0 ? `À privilégier pour ${name}` : index === 1 ? `À vérifier pour ${name}` : `Conseil de qualité pour ${name}`;
  if (sectionType === "editorial_detail_list") return ["Personnes", "Message", "Lieu", "Ambiance", "Partage"][index] ?? `Détail ${index + 1}`;
  if (/scene|idea/i.test(sectionKey)) return ["Ouverture personnelle", "Détail symbolique", "Moment partagé", "Transition douce", "Conclusion lisible", "Version mobile", "Souvenir choisi", "Scène principale", "Détail de saison", "Variante de partage", "Dernière image"][index] ?? `Idée de scène ${index + 1}`;
  if (/story|use.case|family/i.test(sectionKey)) return ["Un moment personnel", "Un détail qui raconte", "Une scène complice", "Une transition douce", "Une conclusion lisible", "Une variante de partage"][index] ?? `Usage ${index + 1}`;
  return index === 0 ? `Une direction claire pour ${name}` : `Une idée à personnaliser pour ${name}`;
}

function blockText(sectionKey, sectionType, index, topic) {
  const name = topic.name.toLowerCase();
  if (sectionType === "editorial_steps") return [
    `Sélectionnez des images nettes et autorisées qui présentent clairement ${name}.`,
    `Définissez les noms, la date, le lieu et le message à conserver dans des éléments éditables.`,
    `Ordonnez les plans du contexte vers le moment principal afin que l’histoire soit facile à suivre.`,
    `Harmonisez la lumière, les couleurs et les mouvements sans surcharger la scène de détails.`,
    `Relisez les visages, les mains, les objets, le cadrage et chaque information avant l’envoi.`,
    `Préparez le format adapté au site, au message ou au réseau social choisi.`
  ][index] ?? `Vérifiez la cohérence de ${name} avant de poursuivre.`;
  if (sectionType === "editorial_detail_list") return `Construisez ce choix visuel autour de ${name}, puis vérifiez que le résultat correspond à votre intention avant de le partager.`;
  if (sectionType === "editorial_checklist") return [
    `Les sources sont nettes et vous disposez des droits nécessaires.`,
    `La date, le lieu et les noms sont relus avant la publication.`,
    `Les visages, les mains et les accessoires restent cohérents.`,
    `Le cadrage reste lisible sur téléphone et ordinateur.`,
    `Le texte final est ajouté dans un calque ou un élément éditable.`,
    `La durée laisse le temps de comprendre le message.`,
    `Le rendu final correspond à l’occasion annoncée.`,
    `Les personnes représentées ont accepté l’usage prévu.`
  ][index] ?? `Vérifiez ce point avant le partage.`;
  if (/scene|idea|story|use.case|family/i.test(sectionKey)) return `Utilisez ${name} comme fil conducteur, gardez une action simple et laissez de l’espace au message final.`;
  return `Relisez ce détail dans son contexte afin de conserver une séquence naturelle et cohérente pour ${name}.`;
}

function faqItems(topic) {
  const name = topic.name;
  const noun = topic.noun;
  return [
    [`Qu’est-ce que ${noun} avec l’IA ?`, `${noun[0].toUpperCase()}${noun.slice(1)} met en scène ${topic.subject} à partir de sources autorisées, avec une direction visuelle adaptée à votre occasion.`],
    ["Quelles images source choisir ?", "Choisissez des images nettes, bien éclairées et centrées sur les personnes ou les objets importants. Évitez les captures d’écran, les petits recadrages et les visages masqués."],
    ["Puis-je ajouter un message personnalisé ?", "Oui. Ajoutez de préférence les noms, la date, le lieu et le message dans des éléments éditables après avoir validé le visuel."],
    ["Quel format convient au partage ?", "Utilisez un cadrage vertical pour le téléphone et les réseaux sociaux, ou un cadrage horizontal pour une invitation, une présentation ou un écran plus large."],
    ["Comment vérifier le résultat avant de le publier ?", "Relisez les visages, les mains, les accessoires, la date, le lieu et chaque mot visible. Contrôlez aussi la lecture sur mobile avant le partage."],
    [`Puis-je partager ${name} avec mes proches ?`, "Oui, si vous disposez des droits sur les images, si les personnes représentées ont accepté l’usage prévu et si le contenu respecte les règles du canal choisi."]
  ];
}

function isImageUrl(key, value) { return IMAGE_KEYS.test(key) && typeof value === "string" && IMAGE_VALUE.test(value); }

function rewriteMedia(value, manifest, altByUrl, state, key = "") {
  if (Array.isArray(value)) return value.map((item) => rewriteMedia(item, manifest, altByUrl, state, key));
  if (!value || typeof value !== "object") {
    if (isImageUrl(key, value)) {
      const base = stripQuery(value);
      const chosen = manifest.find((item) => stripQuery(item.src) === base) ?? manifest[state.cursor++ % manifest.length];
      return chosen.src;
    }
    return value;
  }
  const next = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    next[childKey] = rewriteMedia(childValue, manifest, altByUrl, state, childKey);
  }
  const imageValue = [next.imageUrl, next.src, next.poster, next.cover, next.thumbnail, next.heroImage].find((candidate) => typeof candidate === "string" && IMAGE_VALUE.test(candidate));
  const imageAlt = imageValue ? altByUrl.get(stripQuery(imageValue)) : undefined;
  if (imageAlt) {
    for (const childKey of Object.keys(next)) if (ALT_KEYS.test(childKey)) next[childKey] = imageAlt;
  }
  return next;
}

function rewriteCopy(value, pageSlug, topic, sectionKey = "", sectionType = "", blockIndex = 0) {
  if (Array.isArray(value)) return value.map((item, index) => rewriteCopy(item, pageSlug, topic, sectionKey, sectionType, index));
  if (!value || typeof value !== "object") return value;
  const next = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (key === "seo" || key === "mediaManifest") { next[key] = childValue; continue; }
    if (key === "sections" && childValue && typeof childValue === "object" && !Array.isArray(childValue)) {
      next[key] = Object.fromEntries(Object.entries(childValue).map(([id, section]) => [id, rewriteSection(section, id, pageSlug, topic)]));
      continue;
    }
    if (key === "contentContract" && childValue && typeof childValue === "object") {
      next[key] = { ...childValue, faqCount: 6, sourceRevision: "aidreamcapes-eu-french-seo-20260916" };
      continue;
    }
    if (key === "alt" || key === "imageAlt" || key === "ogImageAlt" || key === "twitterImageAlt") { next[key] = childValue; continue; }
    if (typeof childValue === "string" && /^(?:intro|support|subtitle|text|body|summary)$/i.test(key)) next[key] = blockText(sectionKey, sectionType, blockIndex, topic);
    else next[key] = rewriteCopy(childValue, pageSlug, topic, sectionKey, sectionType, blockIndex);
  }
  return next;
}

function rewriteSection(section, sectionKey, pageSlug, topic) {
  if (!section || typeof section !== "object") return section;
  const next = clone(section);
  const type = String(next.type ?? "");
  const settings = { ...(next.settings ?? {}) };
  if (Object.prototype.hasOwnProperty.call(settings, "title") || type === "faq") settings.title = sectionTitle(sectionKey, type, topic);
  if (Object.prototype.hasOwnProperty.call(settings, "intro")) settings.intro = sectionIntro(sectionKey, topic);
  if (Object.prototype.hasOwnProperty.call(settings, "support")) settings.support = `Utilisez uniquement des sources dont vous détenez les droits ou l’autorisation, puis vérifiez le résultat complet avant sa diffusion.`;
  if (Object.prototype.hasOwnProperty.call(settings, "eyebrow")) settings.eyebrow = `${topic.name} avec l’IA`;
  if (Object.prototype.hasOwnProperty.call(settings, "primaryCta")) settings.primaryCta = `Créer ${topic.noun}`;
  if (Object.prototype.hasOwnProperty.call(settings, "secondaryCta")) settings.secondaryCta = "Voir les idées de scènes";
  if (Object.prototype.hasOwnProperty.call(settings, "secondaryCta") && /final|cta/i.test(sectionKey)) settings.secondaryCta = "Explorer les autres thèmes";
  if (Object.prototype.hasOwnProperty.call(settings, "fullFaqLabel")) settings.fullFaqLabel = "Voir toutes les questions";
  if (Object.prototype.hasOwnProperty.call(settings, "themeTone")) settings.themeTone = topic.tone;
  if (type === "faq") {
    const items = faqItems(topic);
    settings.title = sectionTitle(sectionKey, type, topic);
    next.blocks = items.map(([question, answer], index) => ({ id: `${saveSlug(pageSlug)}-faq-${index + 1}`, type: "faq_item", settings: { question, answer } }));
  } else {
    next.blocks = Array.isArray(next.blocks)
      ? next.blocks.map((block, index) => {
          const item = { ...block, settings: { ...(block.settings ?? {}) } };
          if (Object.prototype.hasOwnProperty.call(item.settings, "title")) item.settings.title = blockTitle(sectionKey, type, index, topic);
          if (Object.prototype.hasOwnProperty.call(item.settings, "text")) item.settings.text = blockText(sectionKey, type, index, topic);
          if (Object.prototype.hasOwnProperty.call(item.settings, "body")) item.settings.body = blockText(sectionKey, type, index, topic);
          if (Object.prototype.hasOwnProperty.call(item.settings, "label")) item.settings.label = blockTitle(sectionKey, type, index, topic);
          if (Array.isArray(item.settings.items)) item.settings.items = item.settings.items.map((_, itemIndex) => blockText(sectionKey, type, itemIndex, topic));
          if (/^(?:mothers-day|fathers-day)-/.test(String(item.id ?? ""))) item.id = `${saveSlug(pageSlug)}-${type.replace(/[^a-z0-9]+/gi, "-")}-${index + 1}`;
          return item;
        })
      : next.blocks;
  }
  next.settings = settings;
  return next;
}

function buildSeo(pageSlug, sourceSeo, manifest, altByUrl, topic) {
  const slug = saveSlug(pageSlug);
  const [title, description, keywords] = SAVE_SEO[slug] ?? SAVE_SEO["save-the-date"];
  const hero = manifest[0]?.src ?? sourceSeo?.ogImage ?? "";
  const heroAlt = altByUrl.get(stripQuery(hero)) ?? "Image thématique de la page Aidreamcapes.";
  return {
    ...(sourceSeo && typeof sourceSeo === "object" ? sourceSeo : {}),
    index: true,
    follow: true,
    title,
    description,
    keywords,
    canonical: `${DOMAIN}${pageSlug}`,
    canonicalPath: pageSlug,
    robots: { index: true, follow: true, maxImagePreview: "large" },
    ogImage: hero,
    twitterImage: hero,
    ogImageAlt: heroAlt,
    twitterImageAlt: heroAlt
  };
}

function prepareJson(pageSlug, rawJson) {
  const source = clone(rawJson ?? {});
  const topic = TOPICS[saveSlug(pageSlug)];
  assert(topic, `Unsupported Save the Date slug: ${pageSlug}`);
  const sourceManifest = Array.isArray(source.mediaManifest) ? source.mediaManifest.filter((item) => item && typeof item.src === "string") : [];
  assert(sourceManifest.length > 0, `Missing media manifest: ${pageSlug}`);
  const manifest = sourceManifest.map((item, index) => ({
    ...item,
    width: 3840,
    height: 2160,
    format: "jpeg",
    alt: clean(item.alt) || `Image de ${topic.name.toLowerCase()} dans une scène éditoriale.`,
    role: index === 0 ? "hero" : item.role,
    loading: index === 0 ? "eager" : item.loading,
    fetchPriority: index === 0 ? "high" : item.fetchPriority
  }));
  const altByUrl = new Map(manifest.map((item) => [stripQuery(item.src), item.alt]));
  const copy = rewriteCopy(source, pageSlug, topic);
  copy.mediaManifest = manifest;
  copy.sections = Object.fromEntries(Object.entries(copy.sections ?? {}).map(([id, section]) => [id, rewriteSection(section, id, pageSlug, topic)]));
  copy.seo = buildSeo(pageSlug, source.seo, manifest, altByUrl, topic);
  const mediaState = { cursor: 0 };
  const withMedia = rewriteMedia(copy, manifest, altByUrl, mediaState);
  withMedia.mediaManifest = manifest;
  withMedia.seo = copy.seo;
  return withMedia;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const [site, livePages, themePages] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { startsWith: "/ai-save-the-date/" } }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { startsWith: "/ai-save-the-date/" } }, orderBy: { slug: "asc" } })
    ]);
    assert(site?.slug === "aidreamcapes-eu" && site.primaryDomain === "aidreamcapes.eu", "Unexpected target site");
    const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
    const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
    const rows = [];
    for (const slug of [...new Set([...liveBySlug.keys(), ...themeBySlug.keys()])].sort()) {
      const live = liveBySlug.get(slug);
      const theme = themeBySlug.get(slug);
      const source = live?.contentJson ?? theme?.publishedJson ?? theme?.draftJson;
      if (!source || !TOPICS[saveSlug(slug)]) continue;
      const nextJson = prepareJson(slug, source);
      rows.push({ slug, live, theme, nextJson, sourceHash: sha(JSON.stringify(source)), nextHash: sha(JSON.stringify(nextJson)) });
    }
    const report = {
      ok: true,
      mode: apply ? "apply-local" : "dry-run",
      siteId: SITE_ID,
      pages: rows.length,
      slugs: rows.map((row) => row.slug),
      changedLivePages: rows.filter((row) => row.live && JSON.stringify(row.live.contentJson) !== JSON.stringify(row.nextJson)).length,
      changedThemePages: rows.filter((row) => row.theme && (JSON.stringify(row.theme.publishedJson) !== JSON.stringify(row.nextJson) || JSON.stringify(row.theme.draftJson) !== JSON.stringify(row.nextJson))).length,
      providerCalls: 0,
      oldResourcesDeleted: 0
    };
    assert(rows.length === 12, `Expected 12 active customer-facing Save the Date pages; the retired Easter page and wedding-anniversary alias are excluded, found ${rows.length}`);
    if (apply) {
      const backupPath = path.join(BACKUP_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, {
        livePages: livePages.map((row) => ({ id: row.id, slug: row.slug, title: row.title, contentJson: row.contentJson })),
        themePages: themePages.map((row) => ({ id: row.id, slug: row.slug, title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson }))
      });
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const title = row.nextJson.seo.title;
          if (row.live && JSON.stringify(row.live.contentJson) !== JSON.stringify(row.nextJson)) await tx.livePage.update({ where: { id: row.live.id }, data: { title, contentJson: row.nextJson } });
          if (row.theme && (JSON.stringify(row.theme.publishedJson) !== JSON.stringify(row.nextJson) || JSON.stringify(row.theme.draftJson) !== JSON.stringify(row.nextJson))) await tx.themePage.update({ where: { id: row.theme.id }, data: { title, draftJson: row.nextJson, publishedJson: row.nextJson } });
        }
      }, { maxWait: 20_000, timeout: 120_000 });
      report.backupPath = backupPath;
    }
    const reportPath = path.join(BACKUP_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(reportPath, report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
