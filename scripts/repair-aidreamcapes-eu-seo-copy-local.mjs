#!/usr/bin/env node

// Local-only SEO copy and indexability repair for the Aidreamcapes EU
// storefront. This script changes only site_aidreamcapes_xby and makes no
// provider calls. LivePage is the public SSR source; ThemePage is kept in
// lockstep for the publication/admin compatibility layer.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const DOMAIN = "https://aidreamcapes.eu";
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-seo-copy-repair");
const PUBLIC_ROOT = path.resolve("public");
const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");

const SAVE = {
  "christmas": ["Vidéo de Noël avec l’IA | Aidreamcapes", "Créez une vidéo de Noël avec l’IA autour des cadeaux, des lumières et des souvenirs chaleureux à partager pendant les fêtes.", "vidéo de Noël avec IA, vidéo de vœux, cadeaux de Noël, souvenirs de fête"],
  "easter": ["Vidéo de Pâques avec l’IA | Aidreamcapes", "Créez une vidéo de Pâques avec l’IA autour du printemps, des couleurs et des décorations dans une scène de célébration destinée aux adultes.", "vidéo de Pâques avec IA, vidéo de printemps, décoration de Pâques, création saisonnière"],
  "engagement": ["Vidéo de fiançailles avec l’IA | Aidreamcapes", "Créez une vidéo de fiançailles avec l’IA pour présenter votre couple, votre annonce et vos souvenirs dans une séquence naturelle à partager.", "vidéo de fiançailles avec IA, annonce de fiançailles, vidéo de couple, bague de fiançailles"],
  "fathers-day": ["Vidéo pour la fête des pères avec l’IA", "Créez une vidéo pour la fête des pères avec l’IA autour d’un cadeau, d’une activité en plein air et d’un message de gratitude personnalisé.", "vidéo fête des pères IA, cadeau pour papa, souvenir familial, message de gratitude"],
  "halloween": ["Vidéo Halloween avec l’IA | Aidreamcapes", "Imaginez une vidéo Halloween avec l’IA : costumes adultes, citrouilles, décor mystérieux et fête créative sans contenu gore ni sujet mineur.", "vidéo Halloween avec IA, costumes adultes, décor de fête, citrouille créative"],
  "mothers-day": ["Vidéo pour la fête des mères avec l’IA", "Créez une vidéo pour la fête des mères avec l’IA autour des fleurs, d’un cadeau, d’un message et d’un souvenir familial personnalisé.", "vidéo fête des mères IA, cadeau personnalisé, fleurs, souvenir familial"],
  "new-year": ["Vidéo du Nouvel An avec l’IA | Aidreamcapes", "Créez une vidéo du Nouvel An avec l’IA autour du compte à rebours, des lumières, de la fête et de vos nouveaux projets à partager.", "vidéo du Nouvel An avec IA, compte à rebours, vœux, vidéo de fête"],
  "proposal": ["Vidéo de demande en mariage avec l’IA", "Imaginez une vidéo de demande en mariage avec l’IA : préparation, bague, question et réaction du couple dans une scène romantique cohérente.", "vidéo demande en mariage IA, surprise romantique, révélation de bague, vidéo de couple"],
  "save-the-date": ["Vidéo Save the Date avec l’IA | Aidreamcapes", "Créez une vidéo Save the Date avec l’IA pour annoncer une date, un couple et un lieu dans une invitation claire à partager avec vos proches.", "vidéo Save the Date IA, annonce mariage, date de mariage, invitation vidéo"],
  "thanksgiving": ["Vidéo de Thanksgiving avec l’IA", "Créez une vidéo de Thanksgiving avec l’IA autour du repas, de la gratitude et des retrouvailles dans une ambiance automnale chaleureuse.", "vidéo Thanksgiving IA, repas en famille, gratitude, vidéo Friendsgiving"],
  "valentines-day": ["Vidéo de Saint-Valentin avec l’IA | Aidreamcapes", "Créez une vidéo de Saint-Valentin avec l’IA pour raconter votre histoire, annoncer une date ou partager un dîner dans une scène romantique personnalisée.", "vidéo Saint-Valentin IA, vidéo romantique, annonce mariage, vidéo de couple"],
  "wedding-ceremony": ["Vidéo de cérémonie de mariage avec l’IA", "Créez une vidéo de cérémonie de mariage avec l’IA autour des vœux, des alliances, de l’allée et des émotions de votre journée.", "vidéo cérémonie mariage IA, vœux, alliances, souvenirs de mariage"],
  "wedding-invitation": ["Vidéo d’invitation de mariage avec l’IA", "Présentez votre papeterie et les informations du mariage dans une vidéo d’invitation créée avec l’IA, prête à relire avant le partage.", "vidéo invitation mariage IA, papeterie mariage, invitation vidéo, informations invités"]
};

const VIDEO_LABELS = {
  "brand-video": "Vidéo de marque", "cinematic-video": "Vidéo cinématographique", "explainer-video": "Vidéo explicative", "fashion-video": "Vidéo de mode", "food-video": "Vidéo culinaire", "how-to-video": "Vidéo tutorielle", "instagram-reels": "Reels Instagram", "meme-video": "Vidéo humoristique", "music-video": "Clip musical", "pet-video": "Vidéo avec animal", "product-ad-video": "Publicité produit", "product-video": "Vidéo produit", "promo-video": "Vidéo promotionnelle", "social-media-video": "Vidéo pour réseaux sociaux", "story-video": "Vidéo narrative", "talking-head-video": "Vidéo face caméra", "talking-photo": "Photo parlante", "tiktok-video": "Vidéo TikTok", "ugc-ad-video": "Publicité UGC", "video-ad": "Publicité vidéo", "youtube-video": "Vidéo YouTube",
  "image-to-video": "Image vers vidéo", "text-to-video": "Texte vers vidéo", "motion-generator": "Animation de photo",
  "christmas": "Vidéo de Noël animée", "engagement": "Vidéo de fiançailles animée", "fathers-day": "Vidéo fête des pères animée", "halloween": "Vidéo Halloween animée", "mothers-day": "Vidéo fête des mères animée", "new-year": "Vidéo du Nouvel An animée", "proposal": "Vidéo de demande en mariage animée", "save-the-date": "Vidéo Save the Date animée", "thanksgiving": "Vidéo de Thanksgiving animée", "valentines-day": "Vidéo de Saint-Valentin animée", "wedding-ceremony": "Vidéo de cérémonie animée", "wedding-invitation": "Vidéo d’invitation animée"
};

const VIDEO_INTENTS = {
  "brand-video": "raconter une histoire de marque, une origine et des valeurs vérifiables", "cinematic-video": "installer une ambiance cinématographique avec un mouvement lisible", "explainer-video": "expliquer un produit, un service ou une idée étape par étape", "fashion-video": "présenter une silhouette, une matière et une direction mode", "food-video": "mettre en scène une recette, un plat ou une expérience culinaire", "how-to-video": "montrer une méthode claire avec des étapes faciles à suivre", "instagram-reels": "adapter une idée courte au format vertical et au rythme des Reels", "meme-video": "construire une scène humoristique courte et compréhensible", "music-video": "associer une direction visuelle à un morceau et à son rythme", "pet-video": "raconter un moment complice avec un animal de compagnie", "product-ad-video": "présenter un produit avec un bénéfice et un appel à l’action", "product-video": "montrer un produit, son usage et ses détails importants", "promo-video": "mettre en avant une offre, un lancement ou une nouveauté", "social-media-video": "préparer un contenu clair pour les réseaux sociaux", "story-video": "transformer une idée en séquence narrative cohérente", "talking-head-video": "présenter un message face caméra avec un rythme naturel", "talking-photo": "animer une photo autorisée avec un message court et lisible", "tiktok-video": "composer une séquence verticale adaptée à TikTok", "ugc-ad-video": "présenter un témoignage ou une démonstration au ton authentique", "video-ad": "tester une accroche, une preuve et un appel à l’action publicitaire", "youtube-video": "structurer une vidéo destinée à YouTube", "image-to-video": "animer une image source autorisée avec un mouvement contrôlé", "text-to-video": "transformer une consigne écrite en séquence visuelle", "motion-generator": "animer une photo source autorisée avec un mouvement contrôlé"
};

const IMAGE_LABELS = {
  avatar: "Avatar professionnel", "background-changer": "Changer l’arrière-plan", "background-remover": "Suppression d’arrière-plan", bikini: "Bikini éditorial", "black-friday": "Visuels Black Friday", boudoir: "Portrait boudoir", cannes: "Portraits de Cannes et de la Riviera", "christmas-photo": "Photos de Noël", "color-correction": "Correction des couleurs", cyberpunk: "Portrait cyberpunk", "edit-by-prompt": "Retouche par consigne", "engagement-photo": "Photos de fiançailles", "gala-photo": "Photos de gala", "hairstyle-generator": "Essai de coiffure", "halloween-photo": "Photos d’Halloween adultes", headshot: "Portrait professionnel", holiday: "Photos de fêtes saisonnières", mafia: "Portrait noir de fiction", "magic-eraser": "Gomme magique", "motion-generator": "Mouvement sur photo", nightlife: "Photos de vie nocturne", "old-photo-restoration": "Restauration de photo ancienne", "only-fans": "Portrait de créateur adulte", "photo-enhancer": "Amélioration photo", "portrait-photo": "Portrait photo éditorial", "portrait-retouch": "Retouche de portrait", "rich-lifestyle": "Photo lifestyle premium", "singles-awareness-day": "Célébration de soi", soccer: "Photos de football", "social-cards": "Visuels pour réseaux sociaux", "street-style": "Photo street style", swimsuit: "Photo en maillot de bain", "thanksgiving-photo": "Photos de Thanksgiving", travel: "Photos de voyage", "unblur-image": "Netteté photo", urban: "Portrait urbain", "valentines-photo": "Photos de Saint-Valentin", "virtual-try-on": "Essayage virtuel", "wedding-photo": "Photos de mariage"
};

const GENERAL = {
  "/": ["Création photo et vidéo avec l’IA | Aidreamcapes", "Créez des portraits, séries photo et vidéos courtes avec vos propres images dans un espace privé, avec des crédits visibles et des galeries personnelles.", "générateur photo IA, générateur vidéo IA, portraits IA, galerie privée"],
  "/ai-image-generation": ["Packs photo IA privés | Aidreamcapes", "Découvrez des packs photo IA pour portraits, styles créatifs et souvenirs privés, avec un coût en crédits visible avant chaque création.", "packs photo IA, portraits IA, retouche photo, galerie privée"],
  "/ai-video-generation": ["Génération de vidéos avec l’IA | Aidreamcapes", "Explorez les thèmes de génération vidéo avec l’IA pour produits, réseaux sociaux, récits, créateurs et campagnes à vérifier avant publication.", "génération vidéo IA, vidéo produit, vidéo réseaux sociaux, vidéo créateur"],
  "/tools": ["Outils de création photo et vidéo IA | Aidreamcapes", "Choisissez un outil photo ou vidéo IA, préparez vos images source, vérifiez les crédits et examinez chaque résultat dans votre espace privé.", "outils photo IA, outils vidéo IA, création visuelle, espace privé"],
  "/about-us": ["À propos d’Aidreamcapes et de la création IA", "Découvrez Aidreamcapes, un espace de création photo et vidéo IA conçu pour transformer vos propres images en résultats privés et vérifiables.", "à propos Aidreamcapes, création photo IA, création vidéo IA"],
  "/contact-us": ["Contacter Aidreamcapes | Assistance création IA", "Contactez Aidreamcapes pour vos questions sur les comptes, crédits, importations, paiements, confidentialité et résultats photo ou vidéo.", "contacter Aidreamcapes, assistance photo IA, aide crédits"],
  "/workflow": ["Comment créer avec l’IA | Aidreamcapes", "Comprenez le parcours Aidreamcapes : importer des images autorisées, choisir un thème, vérifier les crédits et examiner votre galerie privée.", "fonctionnement création IA, workflow photo IA, workflow vidéo IA"],
  "/pricing": ["Tarifs et crédits photo vidéo IA | Aidreamcapes", "Comparez les formules et crédits Aidreamcapes pour créer des photos et vidéos IA dans un espace privé, avec les coûts affichés avant l’envoi.", "tarifs photo IA, crédits vidéo IA, formules Aidreamcapes"],
  "/faq": ["FAQ création photo et vidéo IA | Aidreamcapes", "Trouvez les réponses sur les images source, les thèmes, les crédits, les paiements, la confidentialité, les remboursements et les galeries privées.", "FAQ photo IA, FAQ vidéo IA, crédits, confidentialité"],
  "/partner-registration": ["Devenir partenaire Aidreamcapes | Création IA", "Inscrivez-vous au programme partenaire Aidreamcapes pour présenter des créations photo et vidéo IA dans un cadre clair, autorisé et vérifiable.", "partenaire Aidreamcapes, programme partenaire IA, création photo vidéo"],
  "/help": ["Aide création photo et vidéo IA | Aidreamcapes", "Consultez l’aide Aidreamcapes pour préparer vos images, choisir un thème, comprendre les crédits et retrouver vos résultats privés.", "aide photo IA, aide vidéo IA, assistance Aidreamcapes"],
  "/blog": ["Guides photo et vidéo IA | Aidreamcapes", "Lisez les guides Aidreamcapes sur les images source, les packs photo, les crédits, les galeries privées et la préparation de créations IA.", "guides photo IA, guides vidéo IA, conseils images source"],
  "/blog/video-photo-package-guide": ["Guide des compléments vidéo photo | Aidreamcapes", "Apprenez à préparer des images source, choisir une direction de mouvement et vérifier une courte vidéo dans une galerie privée.", "guide vidéo photo, mouvement sur image, galerie privée"],
  "/best-ai-image": ["Meilleurs outils photo IA | Aidreamcapes", "Comparez les thèmes photo IA Aidreamcapes pour portraits, retouches, styles, événements et images de campagne à conserver dans un espace privé.", "meilleur outil photo IA, thèmes photo IA, portraits IA"],
  "/best-ai-video": ["Meilleurs thèmes vidéo IA | Aidreamcapes", "Comparez les thèmes vidéo IA Aidreamcapes pour produits, créateurs, récits, réseaux sociaux et annonces avant de choisir votre direction.", "meilleur outil vidéo IA, thèmes vidéo IA, vidéo produit"],
  "/best-packages": ["Meilleurs packs photo IA | Aidreamcapes", "Trouvez un pack photo IA adapté à votre portrait, votre style ou votre occasion, puis vérifiez les crédits et les résultats dans votre galerie privée.", "meilleurs packs photo IA, packs portraits IA, galerie privée"],
  "/best-save-the-date": ["Meilleures idées Save the Date avec l’IA", "Découvrez des idées de vidéos Save the Date avec l’IA pour annoncer une date de mariage, un couple et un lieu avec un message lisible.", "idées Save the Date IA, annonce mariage, vidéo de couple"],
  "/collections": ["Collections de packs photo IA | Aidreamcapes", "Parcourez les collections de packs photo IA Aidreamcapes pour trouver un style adapté à vos images source et à votre projet privé.", "collections photo IA, packs photo, portraits IA"],
  "/creators-circle": ["Cercle des créateurs Aidreamcapes", "Découvrez le Cercle des créateurs pour préparer des campagnes photo IA, des contenus partageables et des collaborations dans un cadre clair.", "Cercle des créateurs, programme créateur IA, campagnes photo"],
  "/privacy": ["Politique de confidentialité | Aidreamcapes", "Lisez comment Aidreamcapes traite les comptes, images importées, créations IA, crédits, paiements et accès aux galeries privées.", "politique confidentialité Aidreamcapes, images IA, galerie privée"],
  "/terms": ["Conditions d’utilisation | Aidreamcapes", "Consultez les conditions applicables aux comptes, crédits, images source, créations photo et vidéo IA, remboursements et galeries privées.", "conditions Aidreamcapes, crédits IA, créations photo vidéo"],
  "/cookies": ["Politique relative aux cookies | Aidreamcapes", "Découvrez comment les cookies et le stockage du navigateur servent à la connexion, aux préférences, au paiement et à la sécurité du service.", "politique cookies Aidreamcapes, stockage navigateur, sécurité"],
  "/refunds": ["Politique de remboursement | Aidreamcapes", "Consultez les règles de remboursement pour les crédits, formules, paiements et demandes liées à un résultat ou à un échec technique.", "remboursement crédits IA, politique Aidreamcapes, paiement"],
  "/content": ["Politique de contenu | Aidreamcapes", "Consultez les règles applicables aux images source, aux droits d’utilisation, au consentement, à la modération et aux créations photo ou vidéo IA.", "politique de contenu IA, droits image, consentement"],
  "/digital-delivery": ["Politique de livraison numérique | Aidreamcapes", "Découvrez comment Aidreamcapes livre les crédits, créations photo et vidéo IA, téléchargements et accès aux galeries privées, sans produit physique.", "livraison numérique IA, téléchargement photo vidéo, galerie privée"],
  "/children-privacy": ["Confidentialité des mineurs | Aidreamcapes", "Consultez les informations Aidreamcapes relatives aux comptes, images de mineurs, demandes parentales et protection des données personnelles.", "confidentialité mineurs, images enfants, politique Aidreamcapes"],
  "/state-privacy": ["Droits de confidentialité des États | Aidreamcapes", "Consultez les informations sur les droits d’accès, de suppression, de correction et de retrait applicables aux demandes de confidentialité.", "droits confidentialité, suppression données, Aidreamcapes"]
};

const PRIVATE_PATHS = new Set(["/404", "/account", "/album", "/app", "/app/jobs/detail", "/app/jobs/progress", "/cart", "/login", "/search"]);
const ALIASES = new Map([
  ["/cookie-policy", "/cookies"], ["/privacy-policy", "/privacy"], ["/terms-of-service", "/terms"],
  ["/policies/cookies", "/cookies"], ["/policies/privacy", "/privacy"], ["/policies/terms", "/terms"],
  ["/policies/refunds", "/refunds"], ["/policies/content", "/content"], ["/policies/children-privacy", "/children-privacy"],
  ["/policies/state-privacy", "/state-privacy"], ["/policies/shipping", "/digital-delivery"],
  ["/ai-save-the-date/wedding-anniversary", "/ai-save-the-date/save-the-date"]
]);

function clone(value) { return structuredClone(value); }
function clean(value) { return String(value ?? "").replace(/\s+/g, " ").trim(); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`); }
function sha256(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function normalizePath(value) { const raw = clean(value).split(/[?#]/)[0] || "/"; return raw === "/" ? "/" : `/${raw.replace(/^\/+|\/+$/g, "")}`; }
function isAsset(value) { return typeof value === "string" && (/^https?:\/\//i.test(value) || value.startsWith("/") || /\.(?:jpe?g|png|webp|avif|svg|mp4|webm)(?:[?#]|$)/i.test(value)); }
function isImageKey(key) { return /^(?:src|image|imageUrl|imageOriginalUrl|imageAlt|alt|ogImage|ogImageAlt|twitterImage|poster|posterUrl|thumbnail|thumbnailUrl|cover|coverUrl|heroImage|backgroundImage|beforeImage|resultImageUrl)$/i.test(key); }
const NON_COPY_KEYS = new Set(["type", "pageType", "contentKey", "anchor", "id", "slug", "href", "url", "canonical", "canonicalPath", "role", "loading", "fetchPriority", "fit", "width", "height", "index", "follow", "outputCount", "creditCost", "duration", "format", "variant", "aspectRatio", "objectPosition"]);
function isCopyKey(key) {
  if (NON_COPY_KEYS.has(key)) return false;
  return /(?:title|headline|description|intro|body|text|question|answer|problem|script|caption|label|eyebrow|cta|microcopy|rights|availability|tip|note|name|summary|useTitle|avoidTitle|useItems|avoidItems|items|rules|leftTitle|rightTitle|expert|disclosure|benefit|scenario|example|title|alt)/i.test(key);
}
function stripQuery(value) { return clean(value).split(/[?#]/)[0]; }
function publicFile(value) {
  const pathname = stripQuery(value);
  if (!pathname.startsWith("/assets/")) return undefined;
  const target = path.resolve(PUBLIC_ROOT, pathname.slice(1));
  return target.startsWith(`${PUBLIC_ROOT}${path.sep}`) ? target : undefined;
}
function imageAltFor(slug, index) {
  const label = SAVE[slug]?.[0]?.replace(/\s*\|.*$/, "") || IMAGE_LABELS[slug] || VIDEO_LABELS[slug] || "Création visuelle";
  const scenes = ["portrait adulte dans une scène lumineuse", "couple adulte dans un décor thématique", "détail de décoration et de lumière", "moment partagé dans un cadre naturel", "composition éditoriale avec le contexte visible", "scène de célébration aux couleurs du thème", "portrait en extérieur au coucher du soleil", "décor intérieur chaleureux avec sujet principal", "vue rapprochée d’un geste ou d’un accessoire", "ambiance nocturne avec éclairage maîtrisé", "scène pensée pour une galerie privée", "portrait final avec arrière-plan distinct"];
  return `${label} : ${scenes[index % scenes.length]}.`;
}
function firstImage(value) {
  if (Array.isArray(value)) { for (const item of value) { const found = firstImage(item); if (found) return found; } return ""; }
  if (!value || typeof value !== "object") return "";
  for (const key of ["imageUrl", "src", "image", "ogImage", "coverUrl", "heroImage"]) {
    const item = value[key];
    if (typeof item === "string" && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(item)) return item;
    if (item && typeof item === "object") { const found = firstImage(item); if (found) return found; }
  }
  for (const item of Object.values(value)) { const found = firstImage(item); if (found) return found; }
  return "";
}
function pageImages(value, output = []) {
  if (Array.isArray(value)) { value.forEach((item) => pageImages(item, output)); return output; }
  if (!value || typeof value !== "object") return output;
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && isImageKey(key) && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(item)) output.push(item);
    else pageImages(item, output);
  }
  return output;
}
function hasResidualEnglish(value) {
  return /\b(?:the|and|with|from|for|your|you|create|creating|generated|customer|private|workspace|story|stories|video|brand|product|campaign|platform|buyer|example|examples|guidance|supporting|scene|scenes|shot|shots|owner|pet|fashion|music|food|culture|team|founder|launch|review|reviews|check|checking|keep|first|final|whole|world|natural|approved|reference|references|happy|family|gift|christmas|easter|spring|proposal|wedding|anniversary|mother|father|day|photo|photos|image|images|text|prompt|script|question|answer|help|pricing|account|login|cart|search|about|contact|terms|privacy|refund|cookies|shipping|children|state|policy|content|delivery|start|open|view|choose|use|make|turn|add|show|showing|include|before|after|result|results|quality|details|detail|format|formats|social|media|meme|tiktok|youtube|instagram|reels|ugc|ad|ads|headline|caption|label|title|description|cover|gallery|portrait|portraiture|professional|headshot|travel|holiday|night|urban|street|style|magic|eraser|enhance|upscale|restore|virtual|try-on|black|friday|bikini|boudoir|cannes|soccer|only|fans|singles|awareness|color|correction|background|changer|remover|engagement|gala|hairstyle|motion|yes|sharp|evenly|lit|heavily|filtered|avoid|extremely|close|wide|angle|selfie|distort|facial|proportions|focused|short|scripts|easier|pacing|pronunciation|dense|multi|paragraph|speeches|looks|unnatural|commercially|commercial|depends|actual|conditions|publishing|another|person|voice|necessary|authorization|viewers|reasonably|mistake|authentic|recording|appropriate|context|reshoot|message|multiple|hooks|investing|larger|production|common|writing|pasting|polished|marketing|copy|speaking|spoken|sentences|fewer|clauses|clearer|pauses|destination|most|important|noun|early|listener|wait|resolve|batch|generation|feature|lets|test|versions|once|commas|periods|thought|force|long|breath|empty|welcome|unless|audience|already|knows|why|stay|problem|promise|next|idea|run|out|lose|point|reading|shorten|cannot|record|birthday|today|wish|screen|available|film|thank|being|there|needed|forget|did|say|congratulations|thinking|camera|works|working|ensure|ensuring|independent|individual|below|described|fictional|minor|logo|logos|watermark|border|collage|panel|readable|writing|price|prices|button|buttons|website|web|app|interface|interfaces|faces|hands|body|bodies|inside|frame|framed|landscape|vertical|square|editorial|photography|photographic|mood|moods|keep|keeps|ensure|treatment|lights|soft|gentle|controlled|sharp|composed|composition|different|differences|topic|topics|available|authorized|authority|rights|right|consent|consented|safety|safe|privacy|share|shared|access|credits|cost|costs|payment|payments|support|email|send|sent|finish|finished|processing|pending|failed|failure|success|successful|error|errors|loading|loaded|showcase|galleries|album|albums|package|packages|theme|themes|category|categories|collection|collections|recommend|recommended|discover|discovering|explore|exploring|learn|understand|understanding|how|what|why|when|where|which|who|can|could|should|will|would|do|does|did|is|are|was|were|be|been|being|has|have|had|may|might|must|if|then|than|as|at|on|in|to|of|by|or|but|so|because|while|through|across|into|over|under|between|around|after|during|until|more|most|some|any|each|every|all|both|either|neither|other|others|same|such|own|very|just|also|too|only|even|still|here|there|now|today|last|next|new|old|high|low|long|short|large|small|full|half|close|wide|near|far|early|late|good|better|best|beautiful|warm|cool|bright|dark|red|blue|green|white|black|gold|golden|silver|neutral|clean|calm|cozy|classic|modern|luxury|premium|simple|easy|hard|clear|exact|accurate|accuracy|detailed|narrative|narratives|moment|moments|memory|memories|celebration|celebrations|event|events|occasion|occasions|holiday|holidays|season|seasonal|winter|summer|autumn|fall|new|year|valentine|valentines|halloween|thanksgiving|christmas|easter|mother|father|weddings|marriage|engagement|proposal|invitation|ceremony|save|date|fathers|mothers|love|romance|romantic|relationship|ring|rings|rose|roses|candle|candles|dinner|city|water|sunset|sunrise|garden|beach|family|families|friend|friends|gift|gifts|food|table|home|house|living|room|kitchen|office|school|work|business|market|street|road|mountain|lake|ocean|river|forest|park|travel|trip|journey|destination|portrait|portraits|face|faces|head|body|hands|dress|suit|shirt|camera|lens|light|lights|shadow|shadows|texture|material|style|styles|fashion|beauty|hair|hairstyle|makeup|skin|picture|pictures|movie|film|films|clip|clips|audio|music|voice|voices|sound|sounds|subtitles|copy|contents|post|posts|facebook|advertisement|advertising|company|companies|user|users|creator|creators|influencer|influencers|community|communities|brands|services|marketing|sales|shop|shopping|buy|buying|sell|selling|subscription|subscriptions|plan|plans|feature|features|tool|tools|workflow|workflows|process|processes|step|steps|guide|guides|tutorial|tutorials|tips|tip|notes|faqs|links|continue|previous|home|menu|link|select|download|edit|remove|change|generate|animate|animation|talking|try|on|original|used|usage|input|inputs|output|outputs|options|fixed|possible|provide|providing|recreate|recreation|upload|uploads|uploaded|customers|realistic|believable|adult|adults|group|couple|woman|man|child|dog|cat|place|simple|kind|ready|deliver|sharing|platforms|testimonial|demo|demonstration|offers|launches|content|contents|specific|identity|behavior|human|interaction|environment|props|intended|channel|visible|stay|coherent|location|floor|bed|bowl|toy|brush|clinic|sidewalk|direction|action|coverage|use|publishing|reason|announcement|offer|proof|timing|objective|stage|hook|placement|destination|crop|current|actual|controls|assume|scarcity|studio|common|characters|character|face|facial|expression|background|lighting|colorful|business|personal|personalized|person|people|different|opening|need|needs|specific|set|identity|behavior|human|interaction|environment|props|intended|channel|visible|stay|coherent|location|floor|bed|bowl|toy|brush|clinic|sidewalk|light|direction|action|coverage|fit|use|rights|publishing|audience|reason|announcement|offer|proof|timing|conditions|source|objective|stage|hook|placement|destination|crop|current|actual|controls|assume|feature|claim|scarcity|fact|audience|greeting|organization|organizing|writing|mistake|line|feature|several|angles|lightweight|layers|makeup|dense|speech|spoken|recording|serum|designed|hydration|rather|approving|authentic|source|material|benefits|buying|decision|opening|set|specific|stay|coherent|support|terms|policy|delivery|shipping|children|state|privacy|refund|cookies|contact|about|account|login|cart|search|pricing|help|question|answer|title|description|cover|gallery|alt|the|and|with|from|for|your|you|create|make|show|include|before|after)\b/i.test(value);
}
const MIXED_ALT_PATTERN = /\b(?:the|and|with|from|your|you|yes|sharp|evenly|lit|heavily|filtered|avoid|extremely|looks|commercial|depends|watch|full|rather|another|voice|rights|disclosure|message|short|scripts|pacing|pronunciation|dense|speeches|reshoot|hooks|investing|production|writing|mistake|polished|marketing|copy|speaking|spoken|sentences|fewer|clauses|pauses|listener|batch|feature|lets|versions|once|commas|periods|thought|force|long|breath|welcome|unless|audience|knows|stay|problem|promise|next|idea|run|out|lose|point|reading|shorten|cannot|record|screen|available|film|thank|being|needed|forget|did|say|congratulations|thinking|camera|type|exact|deliver|commercially|publishing|authentic|recording|necessary|authorization|viewers|reasonably|subject|useful|birthday|today|wish|describe|write|put|own|have|need|needs|say|read|show|looks|work|working|ensure|source|material|content|generated|create|creating|generate|generating|image|photo|video|picture|scene|light|lighting|background|face|faces|body|hands|person|people|group|couple|woman|man|child|dog|cat|place|simple|clear|different|theme|themes|style|styles|portrait|portraits|camera|lens|mood|warm|cool|bright|dark|color|colors|red|blue|green|white|black|gold|golden|silver|neutral|clean|calm|cozy|classic|modern|luxury|premium)\b|\bI\b/i;
function localizedFallback(key, topic) {
  const label = topic || "création visuelle";
  const lower = label.toLowerCase();
  const article = /^(?:vidéo|photo|animation|création|portrait|clip|publicité|reels)/i.test(lower) ? "une " : "";
  if (/^(?:title|headline|h1)$/i.test(key)) return /avec l’IA$/i.test(label) ? label : `${label} avec l’IA`;
  if (/question/i.test(key)) return `Comment créer ${article}${lower} ?`;
  if (/^(?:cta|primaryCta|secondaryCta|button|linkLabel)$/i.test(key)) return `Créer ${article}${lower}`;
  if (/^(?:eyebrow|label)$/i.test(key)) return label;
  if (/alt/i.test(key)) return imageAltFor(String(label).toLowerCase().replace(/\s+/g, "-"), 0);
  return `Créez ${article}${lower} à partir de sources autorisées, puis vérifiez chaque détail avant le partage.`;
}
function localize(value, topic, key = "", altByUrl = new Map(), currentUrl = "") {
  if (typeof value === "string") {
    if (isAsset(value) || /^https?:\/\//i.test(value)) return value;
    if (/^(?:alt|imageAlt|ogImageAlt)$/i.test(key) && currentUrl) return altByUrl.get(stripQuery(currentUrl)) || value;
    if (!isCopyKey(key)) return value;
    if (hasResidualEnglish(value)) return localizedFallback(key, topic);
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => localize(item, topic, key, altByUrl, currentUrl));
  if (!value || typeof value !== "object") return value;
  const object = value;
  const objectUrl = [object.src, object.imageUrl, object.imageOriginalUrl, object.poster, object.posterUrl].find((item) => typeof item === "string" && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(item)) || currentUrl;
  const next = {};
  for (const [childKey, childValue] of Object.entries(object)) next[childKey] = localize(childValue, topic, childKey, altByUrl, objectUrl);
  if (objectUrl) {
    const canonicalAlt = altByUrl.get(stripQuery(objectUrl));
    if (canonicalAlt) {
      if (Object.prototype.hasOwnProperty.call(next, "alt")) next.alt = canonicalAlt;
      if (Object.prototype.hasOwnProperty.call(next, "imageAlt")) next.imageAlt = canonicalAlt;
    }
  }
  return next;
}
function topicForPath(pagePath) {
  const segment = pagePath.split("/").filter(Boolean).at(-1) || "";
  if (pagePath.startsWith("/ai-save-the-date/")) return SAVE[segment]?.[0]?.replace(/\s*\|.*$/, "") || "Vidéo thématique";
  if (pagePath.startsWith("/ai-video-generation/")) return VIDEO_LABELS[segment] || "Vidéo avec l’IA";
  if (pagePath.startsWith("/ai-image-generation/")) return IMAGE_LABELS[segment] || "Création photo";
  return "Aidreamcapes";
}
function seoForPath(pagePath, currentSeo = {}) {
  const normalized = normalizePath(pagePath);
  const alias = ALIASES.get(normalized);
  const segment = normalized.split("/").filter(Boolean).at(-1) || "";
  let triple = GENERAL[normalized];
  if (normalized.startsWith("/ai-save-the-date/")) triple = SAVE[segment];
  if (normalized.startsWith("/ai-video-generation/")) {
    const label = VIDEO_LABELS[segment];
    if (label) {
      const intent = VIDEO_INTENTS[segment] || "préparer une séquence visuelle cohérente";
      triple = [`${label} avec l’IA | Aidreamcapes`, `Créez ${label.toLowerCase()} avec l’IA pour ${intent}, puis vérifiez les images, le texte et le rythme avant publication.`, `${label.toLowerCase()} avec IA, création vidéo, montage visuel, Aidreamcapes`];
    }
  }
  if (normalized.startsWith("/ai-image-generation/") && IMAGE_LABELS[segment]) {
    const label = IMAGE_LABELS[segment];
    triple = [`${label} avec l’IA | Aidreamcapes`, `Créez ${label.toLowerCase()} avec l’IA à partir de photos autorisées, dans un style adapté à votre projet et à votre galerie privée.`, `${label.toLowerCase()} IA, création photo, retouche image, Aidreamcapes`];
  }
  if (!triple) {
    const label = topicForPath(normalized);
    triple = [`${label} | Aidreamcapes`, `Découvrez ${label.toLowerCase()} avec l’IA dans un parcours privé, avec des sources autorisées, des crédits visibles et un résultat à vérifier.`, `${label.toLowerCase()} avec IA, Aidreamcapes`];
  }
  const [title, description, keywords] = triple;
  const indexable = !PRIVATE_PATHS.has(normalized) && !alias && normalized !== "/ai-save-the-date/wedding-anniversary";
  const canonicalPath = alias || normalized;
  const hero = clean(currentSeo.ogImage) && !/eu-regenerated/i.test(currentSeo.ogImage) ? currentSeo.ogImage : "";
  return {
    ...currentSeo,
    title: clean(title), description: clean(description), keywords: clean(keywords), canonicalPath,
    canonical: `${DOMAIN}${canonicalPath === "/" ? "/" : canonicalPath}`,
    index: indexable, follow: indexable,
    robots: { index: indexable, follow: indexable, maxImagePreview: "large" },
    ...(hero ? { ogImage: hero, twitterImage: hero } : {}),
    ogImageAlt: `Illustration de ${topicForPath(normalized).toLowerCase()} pour Aidreamcapes.`
  };
}
function normalizeHeadingLevels(json) {
  const next = clone(json);
  let found = false;
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== "object") return;
    for (const [key, item] of Object.entries(value)) {
      if (key === "headingLevel" && typeof item === "string") {
        if (!found && item.toLowerCase() === "h1") found = true;
        else if (item.toLowerCase() === "h1") value[key] = "h2";
      }
      visit(item);
    }
  };
  visit(next);
  return next;
}
function makeAltMap(pagePath, json) {
  const map = new Map();
  const existing = new Map();
  const collect = (value) => {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== "object") return;
    const url = [value.src, value.imageUrl, value.imageOriginalUrl, value.poster, value.posterUrl].find((item) => typeof item === "string" && /\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i.test(item));
    const alt = [value.alt, value.imageAlt, value.altText, value.alt_text].find((item) => typeof item === "string" && item.trim());
    const preserveCanonicalAssetAlt = /(?:image-pack-4k|vendor-api-gpt-image-2-4k-v1|valentines-day-4k-vendor-v1)/i.test(url);
    if (url && alt && (preserveCanonicalAssetAlt || !MIXED_ALT_PATTERN.test(alt)) && !existing.has(stripQuery(url))) existing.set(stripQuery(url), alt.trim());
    Object.values(value).forEach(collect);
  };
  collect(json);
  const urls = Array.from(new Set(pageImages(json).map(stripQuery)));
  urls.forEach((url, index) => map.set(url, existing.get(url) || imageAltFor(pagePath.split("/").filter(Boolean).at(-1) || "", index)));
  return map;
}
async function realDimensions(value) {
  const file = publicFile(value);
  if (!file || !fs.existsSync(file)) return undefined;
  try {
    const metadata = await sharp(file).metadata();
    return metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : undefined;
  } catch { return undefined; }
}
async function syncJson(pagePath, rawJson) {
  const source = clone(rawJson || {});
  const altByUrl = makeAltMap(pagePath, source);
  const localized = normalizeHeadingLevels(localize(source, topicForPath(pagePath), "", altByUrl));
  const seo = seoForPath(pagePath, localized.seo || {});
  localized.seo = seo;
  if (Object.prototype.hasOwnProperty.call(localized.seo, "ogTitle")) localized.seo.ogTitle = seo.title;
  if (Object.prototype.hasOwnProperty.call(localized.seo, "ogDescription")) localized.seo.ogDescription = seo.description;
  if (Object.prototype.hasOwnProperty.call(localized.seo, "twitterTitle")) localized.seo.twitterTitle = seo.title;
  if (Object.prototype.hasOwnProperty.call(localized.seo, "twitterDescription")) localized.seo.twitterDescription = seo.description;
  const hero = firstImage(localized) || seo.ogImage || "";
  if (!seo.ogImage && hero) { seo.ogImage = hero; seo.twitterImage = hero; }
  if (!seo.twitterImage && seo.ogImage) seo.twitterImage = seo.ogImage;
  if (Array.isArray(localized.mediaManifest)) {
    for (const [index, media] of localized.mediaManifest.entries()) {
      const base = stripQuery(media.src);
      if (altByUrl.has(base)) media.alt = altByUrl.get(base);
      const dimensions = await realDimensions(media.src);
      if (dimensions) { media.width = dimensions.width; media.height = dimensions.height; }
      if (index === 0) { media.role = "hero"; media.loading = "eager"; media.fetchPriority = "high"; }
    }
  }
  return localized;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const [site, livePages, themePages] = await Promise.all([
      prisma.site.findUnique({ where: { id: SITE_ID }, select: { id: true, slug: true, primaryDomain: true } }),
      prisma.livePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } }),
      prisma.themePage.findMany({ where: { siteId: SITE_ID }, orderBy: { slug: "asc" } })
    ]);
    assert(site && site.slug === "aidreamcapes-eu" && site.primaryDomain === "aidreamcapes.eu", "Unexpected target site");
    const liveBySlug = new Map(livePages.map((row) => [row.slug, row]));
    const changes = [];
    const allSlugs = new Set([...livePages.map((row) => row.slug), ...themePages.map((row) => row.slug)]);
    for (const slug of [...allSlugs].sort()) {
      const live = liveBySlug.get(slug);
      const theme = themePages.find((row) => row.slug === slug);
      const source = live?.contentJson ?? theme?.publishedJson ?? theme?.draftJson;
      if (!source) continue;
      const nextJson = await syncJson(slug, source);
      const nextTitle = seoForPath(slug, nextJson.seo).title;
      const change = { slug, liveId: live?.id, themeId: theme?.id, title: nextTitle, index: nextJson.seo.index !== false, sourceHash: sha256(JSON.stringify(source)), nextHash: sha256(JSON.stringify(nextJson)), liveChanged: Boolean(live && JSON.stringify(live.contentJson) !== JSON.stringify(nextJson)), themeChanged: Boolean(theme && (JSON.stringify(theme.publishedJson) !== JSON.stringify(nextJson) || JSON.stringify(theme.draftJson) !== JSON.stringify(nextJson))), nextJson };
      changes.push(change);
    }
    const report = {
      ok: true, mode: apply ? "apply-local" : "dry-run", siteId: SITE_ID, livePages: livePages.length, themePages: themePages.length,
      inspectedPages: changes.length, changedLivePages: changes.filter((item) => item.liveChanged).length, changedThemePages: changes.filter((item) => item.themeChanged).length,
      indexablePages: changes.filter((item) => item.index).length, noindexPages: changes.filter((item) => !item.index).length,
      providerCalls: 0, titles: changes.map(({ slug, title, index }) => ({ slug, title, index }))
    };
    if (apply) {
      const backupPath = path.join(REPORT_ROOT, `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, { livePages: livePages.map((row) => ({ id: row.id, slug: row.slug, title: row.title, contentJson: row.contentJson })), themePages: themePages.map((row) => ({ id: row.id, slug: row.slug, title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson })) });
      await prisma.$transaction(async (tx) => {
        for (const item of changes) {
          if (item.liveId && item.liveChanged) await tx.livePage.update({ where: { id: item.liveId }, data: { title: item.title, contentJson: item.nextJson } });
          if (item.themeId && item.themeChanged) await tx.themePage.update({ where: { id: item.themeId }, data: { title: item.title, draftJson: item.nextJson, publishedJson: item.nextJson } });
        }
      }, { maxWait: 20_000, timeout: 120_000 });
      report.backupPath = backupPath;
    }
    writeJson(path.join(REPORT_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), report);
    console.log(JSON.stringify(report, null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
