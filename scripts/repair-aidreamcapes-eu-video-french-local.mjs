#!/usr/bin/env node

// Local-only French copy repair for the EU public video-topic pages. It keeps
// provider media and route structure intact, and only rewrites customer-facing
// strings in the published content snapshot.
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
const BACKUP_ROOT = path.resolve(".tmp", "aidreamcapes-eu-video-french-copy");

const LABELS = {
  "brand-video": "vidéo de marque", "cinematic-video": "vidéo cinématographique", "explainer-video": "vidéo explicative", "fashion-video": "vidéo de mode", "food-video": "vidéo culinaire", "how-to-video": "vidéo tutorielle", "instagram-reels": "vidéo pour Instagram Reels", "meme-video": "vidéo humoristique", "music-video": "clip musical", "pet-video": "vidéo avec animal", "product-ad-video": "publicité produit", "product-video": "vidéo produit", "promo-video": "vidéo promotionnelle", "social-media-video": "vidéo pour les réseaux sociaux", "story-video": "vidéo narrative", "talking-head-video": "vidéo face caméra", "talking-photo": "photo parlante", "tiktok-video": "vidéo TikTok", "ugc-ad-video": "publicité UGC", "video-ad": "publicité vidéo", "youtube-video": "vidéo YouTube", "image-to-video": "image vers vidéo", "text-to-video": "texte vers vidéo", "motion-generator": "animation de photo"
};

const SEO_OVERRIDES = {
  "brand-video": ["Vidéo de marque avec l’IA | Aidreamcapes", "Créez une vidéo de marque avec l’IA pour présenter une histoire, une offre et des valeurs dans une séquence claire à vérifier avant publication.", "vidéo de marque IA, storytelling de marque, présentation entreprise"],
  "cinematic-video": ["Vidéo cinématographique avec l’IA | Aidreamcapes", "Créez une vidéo cinématographique avec l’IA pour installer une ambiance, une lumière et un mouvement cohérents dans vos récits visuels.", "vidéo cinématographique IA, scène immersive, récit visuel"],
  "explainer-video": ["Vidéo explicative avec l’IA | Aidreamcapes", "Expliquez un produit, un service ou une idée avec une vidéo créée avec l’IA, structurée en étapes simples et relue avant diffusion.", "vidéo explicative IA, démonstration produit, tutoriel vidéo"],
  "fashion-video": ["Vidéo de mode avec l’IA | Aidreamcapes", "Présentez une silhouette, une matière et une direction mode dans une vidéo créée avec l’IA, adaptée à vos contenus éditoriaux et sociaux.", "vidéo de mode IA, campagne mode, présentation silhouette"],
  "food-video": ["Vidéo culinaire avec l’IA | Aidreamcapes", "Mettez en scène une recette, un plat ou une expérience culinaire avec une vidéo créée avec l’IA, claire et adaptée au canal choisi.", "vidéo culinaire IA, vidéo recette, contenu gastronomique"],
  "how-to-video": ["Vidéo tutorielle avec l’IA | Aidreamcapes", "Montrez une méthode ou un geste avec une vidéo tutorielle créée avec l’IA, organisée en étapes faciles à comprendre et à partager.", "vidéo tutorielle IA, guide vidéo, démonstration étape par étape"],
  "instagram-reels": ["Vidéo Instagram Reels avec l’IA | Aidreamcapes", "Préparez une vidéo verticale avec l’IA pour Instagram Reels, avec une accroche lisible, un rythme court et un appel à l’action vérifiable.", "vidéo Instagram Reels IA, vidéo verticale, contenu social"],
  "meme-video": ["Vidéo humoristique avec l’IA | Aidreamcapes", "Créez une vidéo humoristique avec l’IA autour d’une situation et d’une chute faciles à comprendre, sans reprendre de contenu protégé sans autorisation.", "vidéo humoristique IA, vidéo meme, contenu social créatif"],
  "music-video": ["Clip musical créé avec l’IA | Aidreamcapes", "Associez une direction visuelle au rythme d’un morceau dans un clip musical créé avec l’IA, avec une continuité relue avant le partage.", "clip musical IA, vidéo musicale, direction visuelle"],
  "pet-video": ["Vidéo avec animal créée avec l’IA | Aidreamcapes", "Racontez un moment complice avec un animal dans une vidéo créée avec l’IA, en contrôlant les proportions, les mouvements et les droits d’utilisation.", "vidéo animal IA, vidéo chien, vidéo chat"],
  "product-ad-video": ["Publicité produit avec l’IA | Aidreamcapes", "Présentez un produit avec une vidéo publicitaire créée avec l’IA, un bénéfice compréhensible et un appel à l’action adapté à votre campagne.", "publicité produit IA, annonce vidéo, campagne e-commerce"],
  "product-video": ["Vidéo produit créée avec l’IA | Aidreamcapes", "Montrez un produit, son usage et ses détails dans une vidéo créée avec l’IA, avec un cadrage cohérent et des informations vérifiées.", "vidéo produit IA, démonstration produit, présentation e-commerce"],
  "promo-video": ["Vidéo promotionnelle avec l’IA | Aidreamcapes", "Mettez en avant une offre, un lancement ou une nouveauté avec une vidéo promotionnelle créée avec l’IA et relue avant publication.", "vidéo promotionnelle IA, vidéo lancement, contenu commercial"],
  "social-media-video": ["Vidéo pour les réseaux sociaux avec l’IA", "Préparez un contenu vidéo pour les réseaux sociaux avec l’IA, adapté au format, au public et au message que vous souhaitez partager.", "vidéo réseaux sociaux IA, contenu social, vidéo courte"],
  "story-video": ["Vidéo narrative avec l’IA | Aidreamcapes", "Transformez une idée en vidéo narrative avec l’IA, en organisant les personnages, les actions et les transitions dans une séquence cohérente.", "vidéo narrative IA, récit visuel, histoire vidéo"],
  "talking-head-video": ["Vidéo face caméra avec l’IA | Aidreamcapes", "Présentez un message face caméra avec l’IA, un rythme naturel et une structure facile à relire pour vos contenus de communication.", "vidéo face caméra IA, présentation vidéo, message créateur"],
  "talking-photo": ["Photo parlante avec l’IA | Aidreamcapes", "Animez un portrait autorisé avec l’IA pour créer une courte vidéo parlante, puis vérifiez le message, le visage et le contexte avant le partage.", "photo parlante IA, portrait animé, vidéo depuis une photo"],
  "tiktok-video": ["Vidéo TikTok créée avec l’IA | Aidreamcapes", "Composez une vidéo verticale pour TikTok avec l’IA, une accroche claire et un rythme adapté à votre public avant de la publier.", "vidéo TikTok IA, vidéo verticale, contenu créateur"],
  "ugc-ad-video": ["Publicité UGC créée avec l’IA | Aidreamcapes", "Présentez un témoignage ou une démonstration dans une publicité UGC créée avec l’IA, avec un message authentique et vérifiable.", "publicité UGC IA, témoignage vidéo, annonce créateur"],
  "video-ad": ["Publicité vidéo avec l’IA | Aidreamcapes", "Testez une accroche, une preuve et un appel à l’action dans une publicité vidéo créée avec l’IA, avant de vérifier chaque information de campagne.", "publicité vidéo IA, accroche publicitaire, campagne vidéo"],
  "youtube-video": ["Vidéo YouTube créée avec l’IA | Aidreamcapes", "Structurez une vidéo YouTube créée avec l’IA autour d’une introduction claire, d’un contenu utile et d’une conclusion relue avant publication.", "vidéo YouTube IA, contenu vidéo, scénario YouTube"],
  "image-to-video": ["Image vers vidéo avec l’IA | Aidreamcapes", "Animez une image source autorisée avec l’IA dans une courte séquence au mouvement contrôlé, puis vérifiez le résultat avant le partage.", "image vers vidéo IA, animation photo, vidéo depuis une image"],
  "text-to-video": ["Texte vers vidéo avec l’IA | Aidreamcapes", "Transformez une consigne écrite en séquence visuelle avec l’IA, puis vérifiez les personnages, les mouvements, le texte et le contexte.", "texte vers vidéo IA, création vidéo, scène générée"],
  "motion-generator": ["Animation de photo avec l’IA | Aidreamcapes", "Animez une photo source autorisée avec l’IA et un mouvement contrôlé, puis vérifiez le cadrage, les proportions et la cohérence du résultat.", "animation photo IA, mouvement image, photo animée"]
};

const COPY_KEYS = /^(?:title|body|intro|description|question|answer|label|eyebrow|cta|primaryCta|secondaryCta|rightsCopy|availabilityNote|imageNote|caption|microcopy|expertTip|leftTitle|rightTitle|useTitle|avoidTitle|problem|script|noteLabel|noteBody|exampleLabel|exampleBody|scenarioLabel|name|subtitle|headline|support|value|text|tip|title)$/i;
const IMAGE_KEYS = /^(?:src|poster|imageUrl|imageOriginalUrl|posterUrl|thumbnail|thumbnailUrl|cover|coverUrl|heroImage|backgroundImage|beforeImage|resultImageUrl)$/i;
const ALT_KEYS = /^(?:alt|imageAlt|ogImageAlt|twitterImageAlt)$/i;
const ASSET = /^(?:https?:|\/|data:)/i;
const MIXED = /\b(?:the|and|with|from|for|your|you|create|creating|generated|customer|private|workspace|story|stories|video|brand|product|campaign|platform|buyer|example|guidance|supporting|scene|scenes|shot|shots|owner|pet|fashion|music|food|team|founder|launch|review|check|first|final|whole|world|natural|approved|reference|happy|family|gift|christmas|easter|spring|proposal|wedding|anniversary|mother|father|day|photo|photos|image|images|text|prompt|script|question|answer|help|pricing|account|login|cart|search|about|contact|terms|privacy|refund|cookies|shipping|children|state|policy|content|delivery|start|open|view|choose|use|make|turn|add|show|include|before|after|result|quality|details|detail|format|social|media|meme|tiktok|youtube|instagram|reels|ugc|ad|ads|headline|caption|label|title|description|cover|gallery|portrait|professional|headshot|travel|holiday|night|urban|street|style|magic|motion|yes|sharp|avoid|close|wide|angle|selfie|distort|facial|focused|short|scripts|easier|pacing|pronunciation|speeches|looks|unnatural|commercially|commercial|depends|publishing|another|person|voice|necessary|authorization|viewers|mistake|authentic|recording|context|reshoot|message|hooks|production|writing|pasting|polished|marketing|copy|speaking|spoken|sentences|clauses|pauses|listener|wait|resolve|batch|generation|feature|lets|test|versions|once|thought|force|long|breath|empty|welcome|audience|already|knows|why|stay|problem|promise|next|idea|run|out|lose|point|reading|shorten|cannot|record|birthday|today|wish|screen|available|film|thank|being|there|needed|forget|congratulations|thinking|camera|type|exact|deliver|commercially|subject|useful|describe|write|put|own|have|need|read|work|working|ensure|source|material|content|generated|generate|image|photo|video|picture|scene|light|lighting|background|face|faces|body|hands|person|people|group|couple|woman|man|child|dog|cat|place|simple|clear|different|theme|themes|style|styles|portrait|portraits|mood|warm|cool|bright|dark|color|colors|premium|I\b)/i;

function clone(value) { return structuredClone(value); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function slugOf(pathname) { return pathname.split("/").filter(Boolean).at(-1) ?? ""; }
function sha(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function labelFor(slug) { return LABELS[slug] ?? "vidéo avec l’IA"; }
function pluralTopic(slug) { return `${labelFor(slug)}s`; }
function altFor(slug, index = 0) {
  const label = labelFor(slug);
  const endings = ["dans une scène éditoriale", "présentée dans un cadre créatif", "avec un cadrage clair et une lumière maîtrisée", "dans une composition adaptée au thème", "illustrée par une scène cohérente"];
  return `${label[0].toUpperCase()}${label.slice(1)} ${endings[index % endings.length]}.`;
}
function fallbackCopy(key, slug, index = 0) {
  const label = labelFor(slug);
  if (/alt/i.test(key)) return altFor(slug, index);
  if (/question/i.test(key)) return `Comment créer ${label} ?`;
  if (/^(?:cta|primaryCta|secondaryCta)$/i.test(key)) return `Créer ${label}`;
  if (/eyebrow|label/i.test(key)) return `${label} avec l’IA`;
  if (/title|headline/i.test(key)) return `Créer ${label} avec l’IA`;
  if (/problem/i.test(key)) return `Définissez l’objectif, le public et le ton avant de créer la séquence.`;
  if (/script/i.test(key)) return `Préparez un message court, clair et facile à relire.`;
  return `Utilisez des sources autorisées, vérifiez les détails et conservez le résultat dans votre espace privé.`;
}
function sectionCopy(key, slug, index = 0) {
  const label = labelFor(slug);
  const topic = label.toLowerCase();
  if (/faq/i.test(key)) return `Questions fréquentes sur ${topic}`;
  if (/hero/i.test(key)) return `Créer ${label} avec l’IA`;
  if (/step|workflow/i.test(key)) return ["Importer votre source", "Définir l’intention", "Composer la séquence", "Relire avant le partage", "Préparer la version finale"][index] ?? `Étape ${index + 1}`;
  if (/trust/i.test(key)) return ["Sources autorisées", "Message vérifié", "Résultat relu", "Partage responsable"][index] ?? "Vérification du résultat";
  if (/value/i.test(key)) return ["Une direction plus claire", "Un résultat plus cohérent", "Un contenu plus facile à relire", "Une création réutilisable"][index] ?? `Avantage de ${topic}`;
  if (/guidance|foundation|sourcePhoto|script/i.test(key)) return ["Définir le sujet", "Choisir le cadrage", "Régler le rythme", "Vérifier la lumière", "Relire le résultat"][index] ?? `Conseil pour ${topic}`;
  if (/title|headline/i.test(key)) return `Créer ${label} avec l’IA`;
  if (/eyebrow|label/i.test(key)) return `${label} avec l’IA`;
  return `Préparez ${label} avec une intention claire, puis vérifiez chaque détail avant le partage.`;
}
function faqFor(slug) {
  const label = labelFor(slug);
  return [
    [`Qu’est-ce que ${label} avec l’IA ?`, `${label[0].toUpperCase()}${label.slice(1)} transforme une idée ou une source autorisée en séquence visuelle, avec un objectif clair et un résultat à vérifier.`],
    ["Quelles sources puis-je utiliser ?", "Utilisez uniquement des images, des vidéos, des voix et des éléments pour lesquels vous détenez les droits ou l’autorisation nécessaire."],
    ["Comment préparer une bonne consigne ?", "Décrivez le sujet, l’action, le cadrage, la lumière, l’ambiance et le format attendu avec des phrases courtes et précises."],
    ["Puis-je adapter le résultat aux réseaux sociaux ?", "Oui. Choisissez un cadrage adapté au téléphone, gardez le message lisible et vérifiez le rendu sur le canal prévu avant la publication."],
    ["Comment vérifier une création avant le partage ?", "Relisez les visages, les mains, les objets, les noms, le texte et le rythme. Corrigez toute information qui pourrait être ambiguë ou trompeuse."],
    ["Que se passe-t-il si le résultat ne convient pas ?", "Comparez le résultat à votre intention, simplifiez la consigne ou choisissez une autre source autorisée avant de lancer une nouvelle création."]
  ];
}
function cleanContent(value, slug, key = "", index = 0) {
  if (Array.isArray(value)) {
    return value.map((item, itemIndex) => cleanContent(item, slug, key, itemIndex));
  }
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") return value;
    if (IMAGE_KEYS.test(key) && ASSET.test(value)) return value;
    if (ALT_KEYS.test(key) && (MIXED.test(value) || value.length < 20)) return altFor(slug, index);
    if (COPY_KEYS.test(key) && MIXED.test(value)) return fallbackCopy(key, slug, index);
    return value;
  }
  const next = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    next[childKey] = cleanContent(childValue, slug, childKey, index);
  }
  return next;
}
function replaceKnownContent(content, slug) {
  const next = clone(content);
  const section = Object.values(next.sections ?? {}).find((candidate) => candidate?.type === "ai_video_topic_landing" || candidate?.type === "talking_photo_landing");
  if (section?.settings?.content && typeof section.settings.content === "object") {
    const c = cleanContent(section.settings.content, slug);
    const seo = SEO_OVERRIDES[slug] ?? [`${labelFor(slug)[0].toUpperCase()}${labelFor(slug).slice(1)} avec l’IA | Aidreamcapes`, `Créez ${labelFor(slug)} avec l’IA avec une direction claire et un résultat vérifié avant le partage.`, `${labelFor(slug)} IA, création vidéo, contenu visuel`];
    c.seo = { ...(c.seo ?? {}), title: seo[0], description: seo[1], keywords: seo[2], canonicalPath: `/ai-video-generation/${slug}` };
    if (c.hero) {
      c.hero.eyebrow = `${labelFor(slug)} avec l’IA`;
      c.hero.title = `Créer ${labelFor(slug)} avec l’IA`;
      c.hero.body = `Préparez ${labelFor(slug)} avec une intention claire, puis vérifiez chaque détail avant le partage.`;
      c.hero.primaryCta = `Créer ${labelFor(slug)}`;
      c.hero.secondaryCta = "Voir le parcours de création";
      c.hero.availabilityNote = "Les options, le format et le coût en crédits sont affichés avant la création.";
      c.hero.rightsCopy = "Utilisez uniquement des sources dont vous détenez les droits ou l’autorisation nécessaire.";
      c.hero.imageNote = altFor(slug, 0);
      if (c.hero.image) c.hero.image.alt = altFor(slug, 0);
      if (Array.isArray(c.hero.images)) c.hero.images = c.hero.images.map((item, i) => ({ ...item, alt: altFor(slug, i) }));
      if (c.hero.video) c.hero.video.label = `Exemple de ${labelFor(slug)}`;
    }
    if (c.useCases) {
      c.useCases.eyebrow = `Usages de ${labelFor(slug)}`;
      c.useCases.title = `Des usages concrets pour ${labelFor(slug)}`;
      c.useCases.intro = `Choisissez une direction claire, puis vérifiez chaque image et chaque étape dans son contexte.`;
      c.useCases.items = (c.useCases.items ?? []).map((item, i) => ({ ...item, scenarioLabel: "Besoin du client", title: ["Présenter une idée clairement", "Créer une ouverture personnelle", "Mettre en valeur un produit", "Raconter une histoire courte", "Préparer un contenu social", "Partager un moment important"][i] ?? `Usage de ${labelFor(slug)}`, problem: "Définissez le message et le public avant de choisir le format.", body: `Construisez ${labelFor(slug)} autour d’un sujet précis, d’une action lisible et d’un résultat adapté au canal choisi.`, cta: `Créer ${labelFor(slug)}`, ...(item.image ? { image: { ...item.image, alt: altFor(slug, i) } } : {}) }));
    }
    if (c.foundation) {
      c.foundation.eyebrow = "Préparer la création";
      c.foundation.title = `Définir l’intention de ${labelFor(slug)}`;
      c.foundation.intro = "Un brief précis aide à garder le sujet, le geste, le cadrage et le contexte cohérents.";
      c.foundation.leftTitle = "À privilégier";
      c.foundation.leftItems = ["Un sujet facilement identifiable", "Une action simple et progressive", "Une lumière cohérente", "Un texte ajouté après vérification"];
      c.foundation.rightTitle = "À éviter";
      c.foundation.rightItems = ["Les images floues ou surchargées", "Les consignes contradictoires", "Les logos ou affirmations non autorisés", "Les informations impossibles à vérifier"];
      c.foundation.expertLabel = "Conseil expert";
      c.foundation.expertTip = `Commencez par une version courte de ${labelFor(slug)}, puis vérifiez le rendu avant d’ajouter des détails.`;
      if (Array.isArray(c.foundation.cards)) c.foundation.cards = c.foundation.cards.map((item, i) => ({ ...item, title: sectionCopy("foundation", slug, i), body: `Choisissez ce paramètre en fonction de l’objectif de ${labelFor(slug)}.` }));
    }
    if (c.guidance) {
      c.guidance.eyebrow = "Conseils de direction";
      c.guidance.title = `Construire ${labelFor(slug)} avec précision`;
      c.guidance.intro = "Décrivez les éléments essentiels et laissez suffisamment d’espace pour un mouvement naturel.";
      c.guidance.cards = (c.guidance.cards ?? []).map((item, i) => ({ ...item, title: sectionCopy("guidance", slug, i), body: `Précisez ce choix pour garder ${labelFor(slug)} cohérente du premier au dernier plan.` }));
    }
    if (c.steps) {
      c.steps.eyebrow = "Parcours de création";
      c.steps.title = `Créer ${labelFor(slug)} en quelques étapes`;
      c.steps.cta = `Commencer ${labelFor(slug)}`;
      c.steps.items = (c.steps.items ?? []).map((item, i) => ({ ...item, title: ["Importer une source autorisée", "Décrire le résultat", "Choisir le format", "Relire la création", "Préparer le partage"][i] ?? `Étape ${i + 1}`, body: ["Choisissez une image ou une vidéo nette dont l’usage est autorisé.", "Décrivez le sujet, l’action, l’ambiance et le cadrage avec des mots simples.", "Sélectionnez un format adapté au téléphone, au site ou à la présentation.", "Contrôlez les visages, les mains, les objets, le texte et le rythme.", "Ajoutez votre message final et vérifiez la version destinée au public."][i] ?? "Vérifiez le résultat avant de poursuivre." }));
    }
    if (c.value) {
      c.value.eyebrow = "Pourquoi une direction précise aide";
      c.value.title = `Mieux cadrer ${labelFor(slug)}`;
      c.value.intro = "Une intention bien définie rend le résultat plus facile à comparer, à corriger et à réutiliser.";
      c.value.items = (c.value.items ?? []).map((item, i) => ({ ...item, title: sectionCopy("value", slug, i), body: `Une consigne claire facilite la vérification de ${labelFor(slug)}.` }));
    }
    if (c.trust) {
      c.trust.eyebrow = "Vérification avant diffusion";
      c.trust.title = "Relire chaque résultat avant diffusion";
      c.trust.body = "Utilisez des sources autorisées et contrôlez la cohérence visuelle, les droits et les informations affichées.";
      c.trust.items = (c.trust.items ?? []).map((item, i) => ({ ...item, title: ["Source autorisée", "Message exact", "Cohérence visuelle", "Contexte transparent", "Partage responsable"][i] ?? "Résultat vérifié", body: "Relisez ce point avant de télécharger ou de publier la création." }));
    }
    if (c.faq) {
      c.faq.eyebrow = "FAQ de la création vidéo";
      c.faq.title = `Questions fréquentes sur ${labelFor(slug)}`;
      c.faq.items = faqFor(slug).map(([question, answer]) => ({ question, answer }));
    }
    if (c.finalCta) {
      c.finalCta.eyebrow = "Créer avec l’IA";
      c.finalCta.title = `Donner une forme claire à ${labelFor(slug)}`;
      c.finalCta.body = `Préparez votre source, choisissez une direction pour ${labelFor(slug)} et relisez le résultat avant de le partager.`;
      c.finalCta.cta = `Créer ${labelFor(slug)}`;
      c.finalCta.microcopy = "Les sources doivent être autorisées et le résultat doit être vérifié avant diffusion.";
    }
    section.settings.content = c;
  }
  // Legacy event pages still use the generic FAQ and ai_tool_entry sections.
  for (const [sectionId, rawSection] of Object.entries(next.sections ?? {})) {
    if (!rawSection || typeof rawSection !== "object") continue;
    const section = rawSection;
    const settings = { ...(section.settings ?? {}) };
    const type = String(section.type ?? "");
    if (type === "faq") {
      settings.title = `Questions fréquentes sur ${labelFor(slug)}`;
      section.blocks = faqFor(slug).map(([question, answer], i) => ({ id: `${slug}-faq-${i + 1}`, type: "faq_item", settings: { question, answer } }));
    }
    if (type === "ai_tool_entry") {
      settings.eyebrow = `${labelFor(slug)} avec l’IA`;
      settings.title = `Créer ${labelFor(slug)} avec l’IA`;
      settings.subtitle = `Préparez ${labelFor(slug)} avec des sources autorisées, puis vérifiez chaque détail avant le partage.`;
      settings.description = settings.subtitle;
      settings.ctaLabel = `Créer ${labelFor(slug)}`;
      settings.imageAlt = altFor(slug, 0);
    }
    if (type === "rich_text") {
      settings.title = `Conseils pour ${labelFor(slug)}`;
      settings.intro = `Choisissez une direction claire pour ${labelFor(slug)} et relisez le résultat avant la publication.`;
      settings.body = settings.intro;
    }
    section.settings = settings;
    next.sections[sectionId] = section;
  }
  const seo = SEO_OVERRIDES[slug] ?? [`${labelFor(slug)[0].toUpperCase()}${labelFor(slug).slice(1)} avec l’IA | Aidreamcapes`, `Créez ${labelFor(slug)} avec l’IA avec une direction claire et un résultat vérifié avant le partage.`, `${labelFor(slug)} IA, création vidéo, contenu visuel`];
  const sourceSeo = next.seo && typeof next.seo === "object" ? next.seo : {};
  next.seo = { ...sourceSeo, index: true, follow: true, title: seo[0], description: seo[1], keywords: seo[2], canonical: `${DOMAIN}/ai-video-generation/${slug}`, canonicalPath: `/ai-video-generation/${slug}`, robots: { index: true, follow: true, maxImagePreview: "large" }, ...(sourceSeo.ogImage ? { ogImage: sourceSeo.ogImage, twitterImage: sourceSeo.ogImage } : {}) };
  if (next.seo.ogImageAlt) next.seo.ogImageAlt = altFor(slug, 0);
  if (next.seo.ogTitle) next.seo.ogTitle = seo[0];
  if (next.seo.ogDescription) next.seo.ogDescription = seo[1];
  if (next.seo.twitterTitle) next.seo.twitterTitle = seo[0];
  if (next.seo.twitterDescription) next.seo.twitterDescription = seo[1];
  return next;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const [site, livePages, themePages] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID, slug: { startsWith: "/ai-video-generation/" } }, orderBy: { slug: "asc" } })
    ]);
    assert(site?.slug === "aidreamcapes-eu" && site.primaryDomain === "aidreamcapes.eu", "Unexpected target site");
    const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
    const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
    const rows = [];
    for (const slug of [...new Set([...liveBySlug.keys(), ...themeBySlug.keys()])].sort()) {
      const shortSlug = slugOf(slug);
      if (!LABELS[shortSlug]) continue;
      const live = liveBySlug.get(slug); const theme = themeBySlug.get(slug);
      const source = live?.contentJson ?? theme?.publishedJson ?? theme?.draftJson;
      if (!source) continue;
      const nextJson = replaceKnownContent(source, shortSlug);
      rows.push({ slug, shortSlug, live, theme, nextJson, sourceHash: sha(JSON.stringify(source)), nextHash: sha(JSON.stringify(nextJson)) });
    }
    assert(rows.length === Object.keys(LABELS).length, `Expected ${Object.keys(LABELS).length} EU video topic pages, found ${rows.length}`);
    const report = { ok: true, mode: apply ? "apply-local" : "dry-run", siteId: SITE_ID, pages: rows.length, changedLivePages: rows.filter((row) => row.live && JSON.stringify(row.live.contentJson) !== JSON.stringify(row.nextJson)).length, changedThemePages: rows.filter((row) => row.theme && (JSON.stringify(row.theme.publishedJson) !== JSON.stringify(row.nextJson) || JSON.stringify(row.theme.draftJson) !== JSON.stringify(row.nextJson))).length, providerCalls: 0, oldResourcesDeleted: 0 };
    if (apply) {
      const backupPath = path.join(BACKUP_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, { livePages: livePages.map((row) => ({ id: row.id, slug: row.slug, title: row.title, contentJson: row.contentJson })), themePages: themePages.map((row) => ({ id: row.id, slug: row.slug, title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson })) });
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const title = row.nextJson.seo.title;
          if (row.live && JSON.stringify(row.live.contentJson) !== JSON.stringify(row.nextJson)) await tx.livePage.update({ where: { id: row.live.id }, data: { title, contentJson: row.nextJson } });
          if (row.theme && (JSON.stringify(row.theme.publishedJson) !== JSON.stringify(row.nextJson) || JSON.stringify(row.theme.draftJson) !== JSON.stringify(row.nextJson))) await tx.themePage.update({ where: { id: row.theme.id }, data: { title, draftJson: row.nextJson, publishedJson: row.nextJson } });
        }
      }, { maxWait: 20_000, timeout: 120_000 });
      report.backupPath = backupPath;
    }
    const reportPath = path.join(BACKUP_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`); writeJson(reportPath, report); console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally { await prisma.$disconnect(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
