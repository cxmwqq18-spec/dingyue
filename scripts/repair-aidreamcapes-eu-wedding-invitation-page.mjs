#!/usr/bin/env node
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const PAGE_PATH = "/ai-save-the-date/wedding-invitation";
const PAGE_TITLE = "Créer une vidéo d’invitation de mariage avec l’IA";
const SEO_TITLE = "Vidéo d’invitation de mariage avec l’IA | Aidreamcapes";
const SEO_DESCRIPTION = "Créez une vidéo d’invitation de mariage avec l’IA à partir de votre papeterie approuvée : noms, date, lieu et détails lisibles avant le partage.";
const SEO_KEYWORDS = "invitation de mariage vidéo IA, vidéo invitation mariage, révélation papeterie mariage, vidéo mariage pour invités, création vidéo à partir de photos";
const PUBLIC_BASE = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/vendor-api-gpt-image-2-4k-v1/wedding-invitation";
const LOCAL_BASE = path.resolve("public", PUBLIC_BASE.slice(1));
const MANIFEST = JSON.parse(await fsPromises.readFile(new URL("./data/aidreamcapes-eu-wedding-invitation-vendor-manifest.json", import.meta.url), "utf8"));
const APPLY = process.argv.includes("--apply");

assertDatabaseTarget({ expectedTarget: "local" });

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function assetItems() {
  return MANIFEST.assets.map(([filename, alt], index) => ({
    filename,
    src: PUBLIC_BASE + "/" + filename,
    storageKey: PUBLIC_BASE.slice(1) + "/" + filename,
    alt,
    caption: alt,
    role: index === 0 ? "hero" : "supporting",
    width: 3840,
    height: 2160,
    format: "JPEG",
    loading: index === 0 ? "eager" : "lazy",
    fetchPriority: index === 0 ? "high" : "auto",
    source: "AI-generated 4K editorial photograph via supplier API"
  }));
}

const ASSETS = assetItems();

function imageSettings(index) {
  const asset = ASSETS[index];
  if (!asset) throw new Error("unknown_wedding_invitation_asset:" + index);
  return {
    alt: asset.alt,
    imageAlt: asset.alt,
    imageUrl: asset.src,
    imageOriginalUrl: asset.src,
    imageWidth: asset.width,
    imageHeight: asset.height,
    imageLoading: asset.loading,
    imageFetchPriority: asset.fetchPriority
  };
}

function manifest() {
  return ASSETS.map((asset) => ({
    filename: asset.filename,
    src: asset.src,
    alt: asset.alt,
    alt_text: asset.alt,
    caption: asset.caption,
    role: asset.role,
    width: asset.width,
    height: asset.height,
    format: asset.format,
    loading: asset.loading,
    fetchPriority: asset.fetchPriority,
    fetchpriority: asset.fetchPriority,
    source: asset.source
  }));
}

function sceneCard(id, title, text, imageIndex) {
  return { id, type: "scene_card", settings: { title, text, ...imageSettings(imageIndex) } };
}

function step(id, number, title, text, imageIndex) {
  return { id, type: "step", settings: { number, title, text, ...imageSettings(imageIndex) } };
}

function qualityItem(id, text) {
  return { id, type: "quality_item", settings: { text } };
}

function formatItem(id, title, text, imageIndex) {
  return { id, type: "format", settings: { title, text, ...imageSettings(imageIndex) } };
}

function boundaryItem(id, title, text) {
  return { id, type: "boundary", settings: { title, text } };
}

function faqItem(id, question, answer) {
  return { id, type: "faq_item", settings: { question, answer } };
}

function buildPageJson() {
  const sectionsOrder = [
    "wedding_invitation_hero",
    "wedding_invitation_definition",
    "wedding_invitation_use_cases",
    "wedding_invitation_workflow",
    "wedding_invitation_scene_ideas",
    "wedding_invitation_quality",
    "wedding_invitation_formats",
    "wedding_invitation_boundaries",
    "wedding_invitation_faq",
    "wedding_invitation_final_cta"
  ];
  const sections = {
    wedding_invitation_hero: {
      type: "editorial_hero",
      settings: {
        anchor: "hero",
        title: PAGE_TITLE,
        intro: "Transformez votre papeterie approuvée en une courte vidéo d’invitation de mariage. Révélez l’enveloppe, la carte et la suite complète tout en gardant les noms, la date, le lieu et le texte final faciles à vérifier.",
        primaryCta: "Créer une vidéo d’invitation",
        primaryHref: "/app/create",
        secondaryCta: "Voir les idées de scènes",
        secondaryHref: "#use-cases",
        intentChips: ["Invitation de mariage", "Révélation de papeterie", "Noms et date vérifiés", "Partage avec les invités", "Photos vers vidéo"],
        ...imageSettings(0)
      },
      blocks: [
        { id: "wedding-invitation-hero-visual-1", type: "hero_visual", settings: imageSettings(0) },
        { id: "wedding-invitation-hero-visual-2", type: "hero_visual", settings: imageSettings(1) },
        { id: "wedding-invitation-hero-visual-3", type: "hero_visual", settings: imageSettings(2) }
      ]
    },
    wedding_invitation_definition: {
      type: "editorial_rich_text",
      settings: {
        anchor: "definition",
        title: "Une invitation lisible, de l’enveloppe à la suite complète.",
        intro: "Une vidéo d’invitation de mariage doit présenter les éléments que les invités doivent comprendre et conserver : le couple, la papeterie approuvée et les informations exactes de l’événement.",
        ...imageSettings(3)
      },
      blocks: [
        { id: "wedding-invitation-definition-1", type: "paragraph", settings: { text: "La vidéo peut montrer l’enveloppe, le carton principal, le faire-part complémentaire, le ruban et le sceau de cire dans un ordre naturel. Les détails réels doivent rester fidèles au modèle fourni." } },
        { id: "wedding-invitation-definition-2", type: "paragraph", settings: { text: "La date, le lieu, les horaires, le RSVP et les noms ne doivent pas être inventés par le modèle. Ajoutez le texte final dans une couche éditable, puis relisez chaque information avant l’envoi." } }
      ]
    },
    wedding_invitation_use_cases: {
      type: "editorial_scene_grid",
      settings: { anchor: "use-cases", title: "Des scènes pensées pour présenter chaque élément de l’invitation." },
      blocks: [
        sceneCard("wedding-invitation-use-case-1", "Révélation de la suite", "Présentez l’enveloppe, la carte, le carton complémentaire et les détails de finition dans une séquence claire.", 1),
        sceneCard("wedding-invitation-use-case-2", "Choix de papeterie", "Comparez les papiers, les couleurs et la mise en page avant de valider la version destinée aux invités.", 2),
        sceneCard("wedding-invitation-use-case-3", "Détail de la carte", "Utilisez un plan rapproché pour montrer le papier, l’impression, le gaufrage ou le ruban sans créer de texte illisible.", 3),
        sceneCard("wedding-invitation-use-case-4", "Partage numérique", "Préparez une version adaptée au mobile lorsque le lien RSVP et les informations de l’événement sont prêts.", 7),
        sceneCard("wedding-invitation-use-case-5", "Cohérence avec la réception", "Reprenez les fleurs, les matières et la palette de l’invitation dans une scène de table ou de lieu.", 5),
        sceneCard("wedding-invitation-use-case-6", "Préparation des enveloppes", "Terminez sur les enveloppes, les sceaux, les rubans et la composition complète avant l’envoi.", 9)
      ]
    },
    wedding_invitation_workflow: {
      type: "editorial_steps",
      settings: { anchor: "parcours", title: "Un parcours simple pour préserver les informations importantes.", ...imageSettings(4) },
      blocks: [
        step("wedding-invitation-step-1", 1, "Rassembler la source approuvée", "Importez la suite d’invitation et les photos que vous avez le droit d’utiliser.", 1),
        step("wedding-invitation-step-2", 2, "Vérifier les informations", "Préparez les noms, la date, le lieu, les horaires et les instructions RSVP exacts.", 4),
        step("wedding-invitation-step-3", 3, "Choisir l’ordre de révélation", "Décidez si la vidéo commence par l’enveloppe, la carte principale ou un détail de matière.", 9),
        step("wedding-invitation-step-4", 4, "Construire les scènes", "Séparez les plans de la papeterie, du couple, du lieu et de la suite complète pour faciliter la relecture.", 2),
        step("wedding-invitation-step-5", 5, "Ajouter le texte vérifié", "Placez les informations finales dans des calques éditables plutôt que de dépendre d’un texte généré dans l’image.", 7),
        step("wedding-invitation-step-6", 6, "Relire avant de partager", "Contrôlez chaque nom, date, adresse, lien, cadrage et dernière image avant de l’envoyer aux invités.", 10)
      ]
    },
    wedding_invitation_scene_ideas: {
      type: "editorial_scene_grid",
      settings: { anchor: "scene-ideas", title: "Huit directions visuelles pour une invitation de mariage." },
      blocks: [
        sceneCard("wedding-invitation-scene-1", "De l’enveloppe à la carte", "Ouvrez la séquence avec l’enveloppe, puis révélez la carte dans l’ordre de lecture attendu.", 3),
        sceneCard("wedding-invitation-scene-2", "Papier et impression", "Montrez la fibre du papier, l’encre, le gaufrage ou le foil avec une lumière douce et sans reflet excessif.", 4),
        sceneCard("wedding-invitation-scene-3", "Suite complète", "Concluez avec tous les éléments approuvés visibles et correctement disposés sur la table.", 10),
        sceneCard("wedding-invitation-scene-4", "Lecture à deux", "Un couple peut relire la carte ensemble avant de la partager avec les proches.", 1),
        sceneCard("wedding-invitation-scene-5", "Palette de réception", "Faites écho aux fleurs, au linge de table et aux bougies sans prétendre représenter un lieu réel.", 8),
        sceneCard("wedding-invitation-scene-6", "Avis d’une proche", "Une demoiselle d’honneur ou un proche peut relire l’ensemble avant l’impression et l’envoi.", 6),
        sceneCard("wedding-invitation-scene-7", "Version mobile", "Présentez la carte sur un téléphone en conservant un cadrage lisible et un espace suffisant autour des éléments.", 7),
        sceneCard("wedding-invitation-scene-8", "Préparation finale", "Vérifiez les rubans, les sceaux, les timbres et les marges avant de fermer les enveloppes.", 9)
      ]
    },
    wedding_invitation_quality: {
      type: "editorial_quality",
      settings: { anchor: "qualite", title: "Garder les personnes naturelles et les détails exacts." },
      blocks: [
        qualityItem("wedding-invitation-quality-1", "Identité — les personnes restent reconnaissables d’une scène à l’autre."),
        qualityItem("wedding-invitation-quality-2", "Visages — contrôlez les yeux, les cheveux, les dents, les oreilles et les contours."),
        qualityItem("wedding-invitation-quality-3", "Mains et papeterie — vérifiez les doigts, les bagues, les rubans, les sceaux et les points de contact."),
        qualityItem("wedding-invitation-quality-4", "Texte — ajoutez les noms, la date, le lieu et les liens dans des éléments éditables et relisez-les."),
        qualityItem("wedding-invitation-quality-5", "Droits — utilisez uniquement des créations et des photos que vous possédez ou êtes autorisé à partager."),
        qualityItem("wedding-invitation-quality-6", "Contexte — ne créez pas de fausse adresse, de faux horaire, de faux hôte ou de partenariat implicite.")
      ]
    },
    wedding_invitation_formats: {
      type: "editorial_formats",
      settings: { anchor: "formats", title: "Préparer le bon format pour chaque partage.", ...imageSettings(10) },
      blocks: [
        formatItem("wedding-invitation-format-1", "Version paysage pour le web", "Conservez la suite complète dans un cadre large adapté à une page de mariage ou à un lecteur vidéo.", 10),
        formatItem("wedding-invitation-format-2", "Version verticale pour mobile", "Recomposez la carte et les informations pour les interfaces mobiles sans écraser la composition originale.", 7),
        formatItem("wedding-invitation-format-3", "Version carrée pour les réseaux", "Utilisez un cadrage carré uniquement lorsque le canal le demande et vérifiez à nouveau la lisibilité.", 2)
      ]
    },
    wedding_invitation_boundaries: {
      type: "editorial_boundaries",
      settings: { anchor: "boundaries", title: "Une invitation de mariage a un objectif différent des thèmes voisins." },
      blocks: [
        boundaryItem("wedding-invitation-boundary-1", "Annonce de date", "Le Save the Date annonce principalement la date à retenir, sans reprendre toute la logistique de l’événement."),
        boundaryItem("wedding-invitation-boundary-2", "Cérémonie de mariage", "La cérémonie met l’accent sur les vœux, les alliances, l’allée, le baiser et les réactions des invités."),
        boundaryItem("wedding-invitation-boundary-3", "Invitation de mariage", "Cette page se concentre sur la papeterie approuvée, les informations exactes et la révélation destinée aux invités.")
      ]
    },
    wedding_invitation_faq: {
      type: "faq",
      settings: { anchor: "faq", title: "Questions fréquentes sur les vidéos d’invitation de mariage." },
      blocks: [
        faqItem("wedding-invitation-faq-1", "Que faut-il importer ?", "Importez une photo claire ou une création de la suite d’invitation approuvée, ainsi que les informations exactes de l’événement."),
        faqItem("wedding-invitation-faq-2", "Les noms et la date peuvent-ils être modifiés ?", "Ils doivent rester exactement ceux de la source approuvée. Relisez la version finale avant de la partager."),
        faqItem("wedding-invitation-faq-3", "Puis-je montrer la vidéo aux invités ?", "Oui, après avoir vérifié en privé la lisibilité des noms, de la date, du lieu, du RSVP et de chaque élément de la papeterie."),
        faqItem("wedding-invitation-faq-4", "Comment garder le texte lisible ?", "Ajoutez le texte final dans une couche éditable et prévoyez un dernier écran suffisamment long pour la lecture."),
        faqItem("wedding-invitation-faq-5", "Quelle scène doit ouvrir la vidéo ?", "Commencez par l’enveloppe, le couple ou un détail de papier selon l’histoire souhaitée, puis révélez la carte dans l’ordre de lecture."),
        faqItem("wedding-invitation-faq-6", "Puis-je utiliser une invitation numérique ?", "Oui, si vous possédez les droits nécessaires. Vérifiez le lien RSVP, l’affichage mobile et les détails avant l’envoi."),
        faqItem("wedding-invitation-faq-7", "La vidéo peut-elle reprendre le décor de la réception ?", "Elle peut reprendre une palette ou des matières comme inspiration, mais ne doit pas inventer un lieu, un horaire ou un prestataire réel."),
        faqItem("wedding-invitation-faq-8", "Que faut-il vérifier avant l’impression ?", "Relisez les noms, dates, adresses, horaires, instructions RSVP, marges, enveloppes, sceaux et liens sur la version finale.")
      ]
    },
    wedding_invitation_final_cta: {
      type: "editorial_cta",
      settings: {
        anchor: "final-cta",
        title: "Présenter chaque détail avec confiance.",
        intro: "Rassemblez votre suite approuvée, préparez les informations exactes et relisez la vidéo avant de l’envoyer à vos invités.",
        primaryCta: "Créer une vidéo d’invitation",
        primaryHref: "/app/create",
        secondaryCta: "Voir les idées de scènes",
        secondaryHref: "#use-cases"
      },
      blocks: []
    }
  };
  return {
    pageType: "standard-content",
    version: 1,
    sectionsOrder,
    sections,
    mediaManifest: manifest(),
    relatedLinks: [
      { label: "Comment ça marche", href: "/workflow" },
      { label: "Découvrir les thèmes Save the Date", href: "/best-save-the-date" },
      { label: "Voir la cérémonie de mariage", href: "/ai-save-the-date/wedding-ceremony" }
    ],
    contentContract: {
      schema: "editorial-page-v1",
      pageKey: "wedding_invitation",
      mediaCount: ASSETS.length,
      faqCount: 8,
      requiredSections: sectionsOrder.map((id) => sections[id].settings.anchor),
      sectionTypes: sectionsOrder.map((id) => sections[id].type),
      sourceRevision: "aidreamcapes-eu-wedding-invitation-vendor-20260915-v1"
    },
    seo: {
      title: SEO_TITLE,
      description: SEO_DESCRIPTION,
      keywords: SEO_KEYWORDS,
      canonicalPath: PAGE_PATH,
      canonical: "https://aidreamcapes.eu" + PAGE_PATH,
      index: true,
      follow: true,
      robots: { index: true, follow: true, maxImagePreview: "large" },
      ogImage: ASSETS[0].src,
      twitterImage: ASSETS[0].src,
      ogImageAlt: ASSETS[0].alt
    }
  };
}

function nonEmptyObject(value) {
  return Boolean(value && typeof value === "object" && Object.keys(value).length);
}

function navigationItem() {
  return {
    label: "Invitation de mariage",
    slug: "wedding-invitation",
    href: PAGE_PATH,
    status: "published",
    sortOrder: 5,
    description: SEO_DESCRIPTION,
    imageUrl: ASSETS[0].src,
    imageAlt: ASSETS[0].alt
  };
}

function patchNavigation(value) {
  const next = clone(value || {});
  const groups = Array.isArray(next.saveTheDateNavigation?.groups) ? next.saveTheDateNavigation.groups : [];
  let love = groups.find((group) => group.slug === "love-wedding");
  if (!love) {
    love = { label: "Amour et mariage", slug: "love-wedding", sortOrder: 1, items: [] };
    groups.unshift(love);
  }
  love.items = Array.isArray(love.items) ? love.items : [];
  const existing = love.items.find((item) => item.href === PAGE_PATH);
  if (existing) Object.assign(existing, navigationItem());
  else love.items.splice(Math.min(4, love.items.length), 0, navigationItem());
  next.saveTheDateNavigation = { ...(next.saveTheDateNavigation || {}), menuLabel: next.saveTheDateNavigation?.menuLabel || "Save the Date", groups };
  return next;
}

async function assertLocalAssets() {
  if (ASSETS.length !== 11) throw new Error("unexpected_wedding_invitation_asset_count:" + ASSETS.length);
  for (const asset of ASSETS) {
    const filePath = path.join(LOCAL_BASE, asset.filename);
    if (!fs.existsSync(filePath)) throw new Error("missing_wedding_invitation_asset:" + filePath);
    const metadata = await sharp(filePath).metadata();
    if (metadata.width !== asset.width || metadata.height !== asset.height) throw new Error("unexpected_wedding_invitation_dimensions:" + asset.filename + ":" + metadata.width + "x" + metadata.height);
  }
}

const pageJson = buildPageJson();
await assertLocalAssets();
const prisma = new PrismaClient();
try {
  const [settings, existingVideoTheme] = await Promise.all([
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } }),
    prisma.videoTheme.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "wedding-invitation" } }, select: { id: true } })
  ]);
  const draftBase = nonEmptyObject(settings?.draftJson) ? settings.draftJson : settings?.publishedJson;
  const publishedBase = nonEmptyObject(settings?.publishedJson) ? settings.publishedJson : settings?.draftJson;
  const nextDraftSettings = patchNavigation(draftBase);
  const nextPublishedSettings = patchNavigation(publishedBase);

  if (APPLY) {
    await prisma.$transaction(async (tx) => {
      await tx.themePage.upsert({
        where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_PATH } },
        create: { id: `page_${SITE_ID}_ai_save_the_date_wedding_invitation`, siteId: SITE_ID, pageType: "standard-content", templateKey: "save-the-date-editorial", slug: PAGE_PATH, title: PAGE_TITLE, draftJson: pageJson, publishedJson: pageJson },
        update: { pageType: "standard-content", templateKey: "save-the-date-editorial", title: PAGE_TITLE, draftJson: pageJson, publishedJson: pageJson }
      });
      await tx.livePage.upsert({
        where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_PATH } },
        create: { id: `live_${SITE_ID}_ai_save_the_date_wedding_invitation`, siteId: SITE_ID, pageType: "standard-content", templateKey: "save-the-date-editorial", slug: PAGE_PATH, title: PAGE_TITLE, contentJson: pageJson },
        update: { pageType: "standard-content", templateKey: "save-the-date-editorial", title: PAGE_TITLE, contentJson: pageJson }
      });
      for (const asset of ASSETS) {
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: SITE_ID, storageKey: asset.storageKey } },
          create: { id: `media_${SITE_ID}_wedding_invitation_vendor_${asset.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`, siteId: SITE_ID, label: asset.filename, storageKey: asset.storageKey, mimeType: "image/jpeg", usageType: "theme", sourceType: "save-the-date-wedding-invitation-vendor-api-gpt-image-2-4k-v1", previewUrl: asset.src, originUrl: asset.src, altText: asset.alt, notes: asset.caption },
          update: { label: asset.filename, mimeType: "image/jpeg", previewUrl: asset.src, originUrl: asset.src, altText: asset.alt, notes: asset.caption, sourceType: "save-the-date-wedding-invitation-vendor-api-gpt-image-2-4k-v1" }
        });
      }
      await tx.themeSettings.upsert({
        where: { siteId: SITE_ID },
        create: { id: `settings_${SITE_ID}`, siteId: SITE_ID, draftJson: nextDraftSettings, publishedJson: nextPublishedSettings },
        update: { draftJson: nextDraftSettings, publishedJson: nextPublishedSettings }
      });
      if (existingVideoTheme) {
        await tx.videoTheme.update({
          where: { id: existingVideoTheme.id },
          data: { name: "Invitation de mariage", headline: PAGE_TITLE, description: SEO_DESCRIPTION, imageUrl: ASSETS[0].src, galleryImages: ASSETS.slice(1).map((asset) => asset.src), status: "active" }
        });
      }
    }, { maxWait: 20_000, timeout: 120_000 });
  }

  const [themePage, livePage, freshSettings, freshVideoTheme] = await Promise.all([
    prisma.themePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_PATH } }, select: { id: true, slug: true, publishedJson: true } }),
    prisma.livePage.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_PATH } }, select: { id: true, slug: true, contentJson: true } }),
    prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { publishedJson: true } }),
    prisma.videoTheme.findUnique({ where: { siteId_slug: { siteId: SITE_ID, slug: "wedding-invitation" } }, select: { imageUrl: true, galleryImages: true } })
  ]);
  const readback = APPLY ? themePage?.publishedJson : pageJson;
  if (!readback?.seo || readback.seo.canonicalPath !== PAGE_PATH) throw new Error("wedding_invitation_seo_readback_failed");
  if (!Array.isArray(readback.mediaManifest) || readback.mediaManifest.length !== ASSETS.length) throw new Error("wedding_invitation_media_manifest_readback_failed");
  if (new Set(readback.mediaManifest.map((item) => item.src)).size !== ASSETS.length) throw new Error("wedding_invitation_media_manifest_duplicate");
  if (APPLY && (!themePage || !livePage)) throw new Error("wedding_invitation_page_readback_failed");
  const navigation = APPLY && freshSettings?.publishedJson?.saveTheDateNavigation
    ? freshSettings.publishedJson.saveTheDateNavigation
    : nextPublishedSettings.saveTheDateNavigation;
  const item = navigation.groups?.flatMap((group) => group.items || []).find((candidate) => candidate.href === PAGE_PATH);
  if (!item || item.status !== "published" || item.imageUrl !== ASSETS[0].src || item.imageAlt !== ASSETS[0].alt) throw new Error("wedding_invitation_navigation_readback_failed");
  if (APPLY && freshVideoTheme && (freshVideoTheme.imageUrl !== ASSETS[0].src || freshVideoTheme.galleryImages?.length !== 10)) throw new Error("wedding_invitation_video_theme_readback_failed");
  console.log(JSON.stringify({
    ok: true,
    mode: APPLY ? "applied-local" : "dry-run",
    siteId: SITE_ID,
    siteSlug: SITE_SLUG,
    pagePath: PAGE_PATH,
    pageType: "standard-content",
    title: PAGE_TITLE,
    canonical: pageJson.seo.canonical,
    mediaCount: ASSETS.length,
    mediaSize: "3840x2160",
    navigationItem: { label: item.label, href: item.href, status: item.status, imageUrl: item.imageUrl, imageAlt: item.imageAlt },
    themePageId: themePage?.id || null,
    livePageId: livePage?.id || null,
    videoThemeUpdated: Boolean(freshVideoTheme),
    publicationNote: "local public data updated; no production publication"
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
