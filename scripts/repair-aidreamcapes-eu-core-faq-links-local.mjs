#!/usr/bin/env node

// Local-only cleanup for Aidreamcapes EU core-page FAQ blocks and broken
// internal links. This deliberately touches only the EU storefront rows and
// never calls an image provider or deletes an asset.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const SITE_SLUG = "aidreamcapes-eu";
const DOMAIN = "aidreamcapes.eu";
const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");
const REPORT_ROOT = path.resolve(".tmp", "aidreamcapes-eu-core-faq-links-repair");

const DEAD_LINKS = new Set([
  "/aidreamcapes",
  "/@aidreamcapes",
  "/tools/seasonal-celebration-album-maker",
  "/collections/soccer",
  "/collections/christmas-photo",
  "/collections/thanksgiving-photo"
]);

// These image-theme links were retained in the EU homepage showcase after
// their old slugs stopped being published. Keep the cards, but point them at
// the currently published EU detail routes instead of leaving crawlable 404s.
const LEGACY_LINK_TARGETS = new Map([
  ["/ai-image-generation/engagement", "/ai-image-generation/engagement-photo"],
  ["/ai-image-generation/valentine-photos", "/ai-image-generation/valentines-photo"],
  ["/ai-image-generation/christmas-photos", "/ai-image-generation/christmas-photo"],
  ["/ai-image-generation/halloween-party-photos", "/ai-image-generation/halloween-photo"],
  ["/ai-image-generation/thanksgiving-group-photos", "/ai-image-generation/thanksgiving-photo"],
  ["/ai-image-generation/profile-cards", "/ai-image-generation/avatar"],
  ["/ai-image-generation/professional-headshots", "/ai-image-generation/professional"]
]);

const FAQS = {
  "/": [
    ["Qu’est-ce qu’Aidreamcapes ?", "Aidreamcapes est un espace privé pour créer des images et des vidéos avec l’IA à partir de sources que vous êtes autorisé à utiliser."],
    ["Comment préparer une création photo ou vidéo ?", "Choisissez un pack ou un thème, importez des sources nettes et autorisées, puis vérifiez le résultat dans votre espace avant de le partager."],
    ["Quelles sources puis-je importer ?", "Importez uniquement des photos, vidéos, textes et éléments dont vous détenez les droits ou l’autorisation des personnes représentées."],
    ["Comment fonctionnent les crédits ?", "Le coût en crédits est affiché avant la confirmation. Les crédits sont réservés au lancement du parcours selon le pack et la configuration de votre compte."],
    ["Où retrouver mes créations terminées ?", "Les créations terminées restent dans votre espace connecté et votre galerie privée afin que vous puissiez les relire et les télécharger."],
    ["Que vérifier avant de partager un résultat ?", "Relisez les visages, les mains, le texte, les dates, les droits d’utilisation et le cadrage mobile avant toute publication." ]
  ],
  "/ai-image-generation": [
    ["Quels packs photo IA puis-je choisir ?", "Les packs couvrent les portraits, les styles créatifs, les occasions et la retouche. Ouvrez une fiche pour vérifier son objectif, ses exemples et son coût."],
    ["Quelles sources fonctionnent le mieux ?", "Utilisez des photos nettes et bien éclairées, avec le sujet visible sous plusieurs angles. Évitez les captures, les petits recadrages et les visages masqués."],
    ["Comment lancer une création photo ?", "Sélectionnez un pack, importez vos sources autorisées, vérifiez les paramètres affichés, puis confirmez la demande depuis votre espace privé."],
    ["Les résultats sont-ils conservés dans un espace privé ?", "Oui. Les demandes et les créations sont associées à votre compte afin que vous puissiez les contrôler dans votre galerie privée."],
    ["Puis-je télécharger les résultats ?", "Oui, vous pouvez télécharger les créations terminées depuis votre galerie après avoir vérifié les détails importants et les droits d’utilisation."],
    ["Que vérifier avant de partager une image ?", "Contrôlez les visages, les mains, les contours, le texte ajouté, le cadrage et la conformité avec les règles du canal choisi."]
  ],
  "/ai-image-generation/headshot": [
    ["À quoi sert un portrait professionnel créé avec l’IA ?", "Ce thème prépare un portrait adulte adapté à un profil, une communauté ou un projet personnel, avec une lumière et un cadrage cohérents."],
    ["Quelles photos source choisir pour un portrait ?", "Choisissez des photos nettes où le visage est visible, bien éclairé et présenté sous quelques angles utiles. Évitez les filtres lourds et les captures d’écran."],
    ["Puis-je choisir une direction visuelle ?", "Oui. Définissez le style, le fond et le cadrage souhaités, puis vérifiez que la direction reste adaptée à votre usage avant de lancer la création."],
    ["Combien de crédits sont utilisés ?", "Le coût en crédits est affiché dans l’espace de création avant la confirmation de la demande."],
    ["Où retrouver mon portrait terminé ?", "Le portrait terminé est conservé dans votre galerie privée liée à votre compte, où vous pouvez le relire et le télécharger."],
    ["Que vérifier avant d’utiliser le portrait ?", "Vérifiez l’identité, les yeux, les mains, les contours, l’éclairage et le cadrage avant de l’utiliser sur un profil ou un support public."]
  ],
  "/best-ai-image": [
    ["Comment comparer les thèmes photo IA ?", "Comparez l’objectif, les exemples, le type de source demandé et le coût en crédits avant de choisir un thème correspondant à votre projet."],
    ["Quels thèmes conviennent aux portraits ?", "Les thèmes de portrait, d’avatar et de retouche conviennent aux profils et aux séries personnelles lorsque les sources et les droits sont vérifiés."],
    ["Puis-je créer des styles pour une occasion ?", "Oui. Les collections saisonnières, de voyage et d’événement proposent des directions adaptées à des projets précis et à des galeries privées."],
    ["Comment préparer mes images source ?", "Importez des images nettes et autorisées, avec un sujet identifiable. Évitez les petits recadrages, les filigranes et les personnes sans consentement."],
    ["Où retrouver les résultats ?", "Les résultats terminés sont regroupés dans votre espace connecté et votre galerie privée pour être contrôlés avant téléchargement."],
    ["Que vérifier avant la publication ?", "Relisez les détails du visage, des mains, du décor et du texte, puis contrôlez le cadrage sur mobile et les droits d’utilisation."]
  ],
  "/best-ai-video": [
    ["Quels types de vidéos IA puis-je créer ?", "Vous pouvez explorer des thèmes pour produits, créateurs, récits, réseaux sociaux et annonces, selon la direction publiée sur chaque fiche."],
    ["Comment choisir un thème vidéo ?", "Choisissez le thème selon votre objectif, la source disponible, le format souhaité et les vérifications à effectuer avant publication."],
    ["Comment préparer une vidéo avec l’IA ?", "Importez des sources autorisées, confirmez le thème et les paramètres visibles, puis relisez la séquence dans votre espace privé."],
    ["Comment sont utilisés les crédits ?", "Le coût en crédits est affiché avant la demande. Les crédits sont utilisés lorsque vous confirmez le parcours de génération."],
    ["Où retrouver les vidéos terminées ?", "Les vidéos disponibles sont conservées dans votre espace connecté afin que vous puissiez les regarder, les télécharger et les organiser."],
    ["Que vérifier avant de partager une vidéo ?", "Contrôlez le rythme, le son, les sous-titres, les visages, les éléments de marque et le cadrage sur le canal de destination."]
  ],
  "/best-packages": [
    ["Comment choisir le meilleur pack photo IA ?", "Comparez l’objectif, les exemples, le nombre de résultats et le coût en crédits, puis choisissez le pack le plus proche de votre projet."],
    ["Puis-je voir les exemples avant de créer ?", "Oui. Consultez les exemples et la description de chaque pack avant d’importer vos sources et de confirmer la demande."],
    ["Quelles photos source sont recommandées ?", "Utilisez des photos nettes, bien éclairées et autorisées, avec les sujets visibles. Évitez les captures, les petits recadrages et les visages masqués."],
    ["Comment fonctionnent les crédits ?", "Le coût en crédits est affiché avant la demande. Les crédits sont réservés au lancement selon le pack et la configuration du compte."],
    ["Où retrouver les créations terminées ?", "Les résultats sont regroupés dans votre espace connecté et votre galerie privée pour être relus puis téléchargés."],
    ["Que vérifier avant de partager une création ?", "Relisez les visages, les mains, les contours, le texte et les droits d’utilisation avant de diffuser le résultat."]
  ],
  "/faq": [
    ["Qu’est-ce qu’Aidreamcapes ?", "Aidreamcapes est un espace privé pour créer des images et des vidéos avec l’IA à partir de sources autorisées."],
    ["Comment importer des sources ?", "Importez des photos, vidéos et éléments dont vous détenez les droits ou l’autorisation, puis vérifiez les exigences du thème choisi."],
    ["Comment fonctionnent les crédits ?", "Le coût en crédits est affiché avant la confirmation. Les crédits sont utilisés selon le pack ou le parcours sélectionné."],
    ["Les créations restent-elles privées ?", "Les demandes et les résultats sont associés à votre compte et conservés dans votre espace privé, selon les règles du service."],
    ["Puis-je télécharger et partager mes résultats ?", "Oui, après avoir vérifié le résultat, les droits sur les sources, le consentement des personnes et les règles du canal de diffusion."],
    ["Que faire si une création échoue ?", "Conservez la référence de la demande et contactez l’assistance si le statut ou les crédits ne sont pas rétablis selon la politique applicable."]
  ],
  "/help": [
    ["Comment commencer une création ?", "Choisissez une collection, un pack ou un outil, importez des sources autorisées et suivez les instructions affichées dans votre espace."],
    ["Quelles images dois-je préparer ?", "Préparez des images nettes et bien éclairées dont vous contrôlez les droits. Évitez les captures d’écran, les petits recadrages et les filigranes."],
    ["Où voir le coût en crédits ?", "Le coût est affiché avant la confirmation de chaque demande afin que vous puissiez vérifier le parcours choisi."],
    ["Où retrouver mes résultats ?", "Les créations terminées apparaissent dans votre espace connecté et votre galerie privée, où vous pouvez les relire et les télécharger."],
    ["Comment corriger un résultat ?", "Relisez les détails et les paramètres avant une nouvelle demande. Pour un problème de statut ou de crédit, contactez l’assistance avec la référence du travail."],
    ["Que vérifier avant de partager ?", "Vérifiez les visages, les mains, le texte, les droits, le consentement et le cadrage du résultat sur le canal prévu."]
  ],
  "/pricing": [
    ["Que comprennent les formules Aidreamcapes ?", "Les formules donnent accès à un nombre de crédits et aux parcours compatibles avec votre compte. Consultez les détails actuels avant de choisir."],
    ["Quand les crédits sont-ils utilisés ?", "Les crédits sont utilisés lorsque vous confirmez une demande de génération. Le coût est affiché avant cette confirmation."],
    ["Le coût est-il affiché avant la création ?", "Oui. Le parcours affiche le coût et les paramètres essentiels avant que vous confirmiez la demande."],
    ["Puis-je utiliser mes créations pour mon activité ?", "Vous pouvez utiliser un résultat lorsque vous contrôlez les sources, les droits et les éléments intégrés, tout en respectant les règles du canal."],
    ["Où retrouver mes résultats ?", "Les créations terminées restent dans votre galerie privée liée au compte afin que vous puissiez les contrôler avant téléchargement."],
    ["Que se passe-t-il si une génération échoue ?", "Conservez la référence de la demande et contactez l’assistance si le statut ou les crédits ne sont pas rétablis selon la politique applicable."]
  ]
};

function clone(value) { return structuredClone(value); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}
function normalizedPath(value) {
  const raw = String(value ?? "").split(/[?#]/)[0].trim() || "/";
  return raw === "/" ? "/" : `/${raw.replace(/^\/+|\/+$/g, "")}`;
}
function normalizedEuPath(value) {
  return normalizedPath(value).replace(/^\/site\/aidreamcapes-eu(?=\/|$)/i, "") || "/";
}
function rewriteLegacyHref(value) {
  const target = LEGACY_LINK_TARGETS.get(normalizedEuPath(value));
  if (!target) return value;
  if (/^\/site\/aidreamcapes-eu(?:\/|$)/i.test(String(value))) return `/site/aidreamcapes-eu${target}`;
  return target;
}
function rewriteLegacyLinks(value) {
  let changed = false;
  const visit = (current) => {
    if (Array.isArray(current)) return current.map(visit);
    if (!current || typeof current !== "object") return current;
    const next = {};
    for (const [key, raw] of Object.entries(current)) {
      if (key === "href" && typeof raw === "string") {
        const rewritten = rewriteLegacyHref(raw);
        if (rewritten !== raw) changed = true;
        next[key] = rewritten;
      } else if (key === "items" && Array.isArray(raw)) {
        next[key] = raw.map((item) => {
          if (typeof item !== "string") return visit(item);
          const separator = item.indexOf("|");
          if (separator < 0) return item;
          const label = item.slice(0, separator);
          const href = item.slice(separator + 1);
          const rewritten = rewriteLegacyHref(href);
          if (rewritten !== href) changed = true;
          return `${label}|${rewritten}`;
        });
      } else {
        next[key] = visit(raw);
      }
    }
    return next;
  };
  return { value: visit(value), changed };
}
function replaceFaqSections(value, pagePath) {
  const next = clone(value);
  const faqItems = FAQS[pagePath];
  if (!faqItems) return { value: next, changed: false, faqSections: 0 };
  let changed = false;
  let faqSections = 0;
  for (const section of Object.values(next.sections ?? {})) {
    if (!section || section.type !== "faq") continue;
    faqSections += 1;
    const blocks = faqItems.map(([question, answer], index) => ({
      id: `${pagePath === "/" ? "home" : pagePath.slice(1).replaceAll("/", "_")}_faq_${index + 1}`,
      type: "faq_item",
      settings: { question, answer }
    }));
    if (JSON.stringify(section.blocks) !== JSON.stringify(blocks)) changed = true;
    section.blocks = blocks;
    section.settings = { ...(section.settings ?? {}), layout: section.settings?.layout || "visual_faq" };
  }
  return { value: next, changed, faqSections };
}
function removeDeadLinks(value) {
  let changed = false;
  const visit = (current) => {
    if (Array.isArray(current)) {
      const filtered = [];
      for (const item of current) {
        const visited = visit(item);
        if (visited !== undefined) filtered.push(visited);
        else changed = true;
      }
      return filtered;
    }
    if (!current || typeof current !== "object") {
      if (typeof current === "string" && DEAD_LINKS.has(normalizedPath(current))) {
        changed = true;
        return undefined;
      }
      return current;
    }
    if (typeof current.href === "string" && DEAD_LINKS.has(normalizedPath(current.href))) {
      changed = true;
      return undefined;
    }
    const next = {};
    for (const [key, raw] of Object.entries(current)) {
      if (key === "items" && Array.isArray(raw)) {
        const lines = raw.filter((item) => typeof item !== "string" || ![...DEAD_LINKS].some((href) => item.trim() === href || item.trim().endsWith(`|${href}`)));
        if (lines.length !== raw.length) changed = true;
        next[key] = lines.map(visit);
        continue;
      }
      next[key] = visit(raw);
    }
    return next;
  };
  return { value: visit(value), changed };
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
    assert(site?.id === SITE_ID && site.slug === SITE_SLUG && site.primaryDomain === DOMAIN, "Unexpected target site");
    const themeBySlug = new Map(themePages.map((row) => [row.slug, row]));
    const changes = [];
    for (const live of livePages) {
      const pagePath = normalizedPath(live.slug);
      const faq = replaceFaqSections(live.contentJson, pagePath);
      const rewritten = rewriteLegacyLinks(faq.value);
      const links = removeDeadLinks(rewritten.value);
      const nextJson = links.value;
      const theme = themeBySlug.get(live.slug);
      const themeChanged = Boolean(theme && (JSON.stringify(theme.draftJson) !== JSON.stringify(nextJson) || JSON.stringify(theme.publishedJson) !== JSON.stringify(nextJson)));
      const liveChanged = JSON.stringify(live.contentJson) !== JSON.stringify(nextJson);
      if (liveChanged || themeChanged) changes.push({ slug: live.slug, faqSections: faq.faqSections, faqChanged: faq.changed, linksChanged: links.changed, legacyLinksChanged: rewritten.changed, liveId: live.id, themeId: theme?.id, nextJson });
    }
    const report = {
      ok: true,
      mode: apply ? "apply-local" : "dry-run",
      siteId: SITE_ID,
      siteSlug: SITE_SLUG,
      domain: DOMAIN,
      changedPages: changes.map(({ slug, faqSections, faqChanged, linksChanged, legacyLinksChanged }) => ({ slug, faqSections, faqChanged, linksChanged, legacyLinksChanged })),
      changedCount: changes.length,
      providerCalls: 0,
      otherSitesTouched: false,
      assetsDeleted: 0
    };
    if (apply && changes.length) {
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = path.join(REPORT_ROOT, `backup-${stamp}.json`);
      writeJson(backupPath, {
        site: { id: site.id, slug: site.slug, primaryDomain: site.primaryDomain },
        livePages: changes.map((item) => livePages.find((row) => row.id === item.liveId)).filter(Boolean).map((row) => ({ id: row.id, slug: row.slug, title: row.title, contentJson: row.contentJson })),
        themePages: changes.map((item) => themePages.find((row) => row.id === item.themeId)).filter(Boolean).map((row) => ({ id: row.id, slug: row.slug, title: row.title, draftJson: row.draftJson, publishedJson: row.publishedJson }))
      });
      await prisma.$transaction(async (tx) => {
        for (const item of changes) {
          if (item.liveId) await tx.livePage.update({ where: { id: item.liveId }, data: { contentJson: item.nextJson } });
          if (item.themeId) await tx.themePage.update({ where: { id: item.themeId }, data: { draftJson: item.nextJson, publishedJson: item.nextJson } });
        }
      }, { maxWait: 20_000, timeout: 120_000 });
      report.backupPath = backupPath;
    }
    const reportPath = path.join(REPORT_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(reportPath, report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
