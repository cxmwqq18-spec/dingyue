#!/usr/bin/env node

// Add the four source-parity marketing/editorial entities that were present in
// the source inventory but missing from the EU sitemap projection. The copy is
// intentionally authored per locale and uses target-owned poster media.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const SOURCE_SITE_ID = "site_dreamshoot";
const TARGETS = Object.freeze([
  { siteId: "site_aidreamcapes_xby", origin: "https://aidreamcapes.eu", locale: "fr", brand: "Aidreamcapes", assetRoot: "/assets/sites/site_aidreamcapes_eu/" },
  { siteId: "site_mydreamshoots_xby", origin: "https://aidreamshoots.eu", locale: "es", brand: "Aidreamshoots", assetRoot: "/assets/sites/site_aidreamshoots/" }
]);
const APPLY_LOCAL = process.argv.includes("--apply-local");
const REPORT_ROOT = path.resolve(".tmp", "eu-source-parity-pages");

const POSTS = Object.freeze([
  {
    slug: "/blog/cinematic-video-guide",
    key: "cinematic-video",
    fr: {
      title: "Guide de la vidéo cinématographique IA : ambiance, plans et mouvement",
      summary: "Planifiez une vidéo cinématographique IA avec une scène claire, quelques plans lisibles, une lumière cohérente et une vérification attentive.",
      imageAlt: "Scène de vidéo cinématographique préparée avec une composition et une lumière cohérentes.",
      body: "<p>Une bonne vidéo cinématographique commence par une intention de scène claire : qui est présent, ce qui change et ce que le public doit ressentir. Décrivez d’abord le sujet, puis choisissez une courte suite de plans, une direction de lumière et un mouvement de caméra facile à vérifier.</p><h2>Construire une scène lisible</h2><p>Commencez par un plan d’ouverture, un moment d’action et une conclusion. Gardez les personnages, les accessoires et la direction de la lumière stables afin de repérer facilement les détails à corriger.</p><h2>Vérifier avant de partager</h2><p>Regardez la vidéo à vitesse normale, puis arrêtez-vous sur les visages, les mains, les ombres, les reflets, les textes et les logos. Une ambiance générée ne doit pas être présentée comme la preuve d’un événement, d’un lieu ou d’une recommandation réelle.</p><p><a href=\"/ai-video-generation/cinematic-video\">Découvrir le thème Vidéo cinématographique</a> et consulter le coût et le flux actuellement publiés.</p>",
      relatedLabel: "Ouvrir Vidéo cinématographique"
    },
    es: {
      title: "Guía de vídeo cinematográfico con IA: ambiente, planos y movimiento",
      summary: "Planifica un vídeo cinematográfico con una escena clara, pocos planos legibles, luz coherente y una revisión cuidadosa.",
      imageAlt: "Escena de vídeo cinematográfico preparada con composición y luz coherentes.",
      body: "<p>Un buen vídeo cinematográfico empieza con una intención clara: quién aparece, qué cambia y qué debe entender o sentir la audiencia. Define el sujeto, crea una secuencia breve de planos y elige una dirección de luz y cámara que puedas revisar.</p><h2>Crear una escena fácil de seguir</h2><p>Empieza con una apertura, un momento de acción y un cierre. Mantén estables los personajes, los objetos y la dirección de la luz para detectar mejor los detalles que necesitan corrección.</p><h2>Revisar antes de compartir</h2><p>Mira el vídeo a velocidad normal y después pausa en rostros, manos, sombras, reflejos, textos y logotipos. Una atmósfera generada no debe presentarse como prueba de un evento, lugar o recomendación real.</p><p><a href=\"/ai-video-generation/cinematic-video\">Descubre el tema Vídeo cinematográfico</a> y revisa el flujo y el coste publicados.</p>",
      relatedLabel: "Abrir Vídeo cinematográfico"
    }
  },
  {
    slug: "/blog/motion-generator-video-guide",
    key: "motion-generator",
    fr: {
      title: "Guide du générateur de mouvement IA : animer une photo",
      summary: "Transformez une image autorisée en courte vidéo en choisissant un seul mouvement principal et en contrôlant la continuité.",
      imageAlt: "Image source préparée pour un mouvement vidéo IA contrôlé.",
      body: "<p>Le générateur de mouvement convient lorsqu’une image fixe approuvée doit gagner un mouvement précis : léger déplacement de caméra, rotation maîtrisée ou mouvement discret de l’environnement. Commencez par décider ce qui doit rester reconnaissable.</p><h2>Choisir un mouvement principal</h2><p>Décrivez le sujet, le mouvement dominant, le comportement de la caméra et le rythme. Évitez de demander en même temps un changement de pose, de vêtement, de décor et de lumière : chaque variation rend la continuité plus difficile à vérifier.</p><h2>Comparer avec l’image source</h2><p>Vérifiez le visage, les mains, les cheveux, les contours du produit, les lignes d’arrière-plan, les reflets, le cadrage et le sens du mouvement. Gardez le résultat privé tant que l’autorisation et la qualité ne sont pas confirmées.</p><p><a href=\"/ai-video-generation/motion-generator\">Voir le générateur de mouvement</a> pour consulter le flux en vigueur.</p>",
      relatedLabel: "Ouvrir le générateur de mouvement"
    },
    es: {
      title: "Guía del generador de movimiento con IA: anima una foto",
      summary: "Convierte una imagen autorizada en un vídeo corto eligiendo un movimiento principal y revisando la continuidad.",
      imageAlt: "Imagen de origen preparada para un movimiento de vídeo IA controlado.",
      body: "<p>El generador de movimiento es útil cuando una imagen aprobada necesita un movimiento concreto: un desplazamiento suave de cámara, un giro controlado o un cambio ambiental discreto. Primero decide qué debe seguir siendo reconocible.</p><h2>Elegir un movimiento principal</h2><p>Describe el sujeto, el movimiento dominante, el comportamiento de la cámara y el ritmo. No combines en el primer intento cambios grandes de pose, ropa, escenario y luz, porque la continuidad será más difícil de revisar.</p><h2>Comparar con la imagen original</h2><p>Comprueba el rostro, las manos, el cabello, los bordes del producto, las líneas del fondo, los reflejos, el encuadre y la dirección del movimiento. Mantén el resultado privado hasta confirmar los permisos y la calidad.</p><p><a href=\"/ai-video-generation/motion-generator\">Ver el generador de movimiento</a> para consultar el flujo vigente.</p>",
      relatedLabel: "Abrir generador de movimiento"
    }
  },
  {
    slug: "/blog/talking-photo-video-guide",
    key: "talking-photo",
    fr: {
      title: "Vidéo de photo parlante : portrait, texte et vérification",
      summary: "Préparez un portrait clair, un message court et une vérification humaine avant de partager une photo parlante IA.",
      imageAlt: "Portrait source préparé pour une vidéo de photo parlante.",
      body: "<p>Une photo parlante fonctionne mieux avec un portrait clair et un message court qu’une personne représentée pourrait réellement approuver. Utilisez uniquement une image dont vous détenez les droits ou l’autorisation d’animation.</p><h2>Préparer le portrait et le texte</h2><p>Choisissez un visage visible, une lumière régulière et un cadrage simple. Écrivez une seule idée avec des phrases courtes et vérifiez les noms, les dates et les affirmations avant de lancer la génération.</p><h2>Contrôler le résultat</h2><p>Comparez le visage avec la source au début, au milieu et à la fin. Écoutez ou lisez le message, puis vérifiez la bouche, les yeux, les cheveux, le cadrage et l’arrière-plan. Une animation ne doit pas créer une déclaration ou une recommandation qu’une personne n’a pas autorisée.</p><p><a href=\"/ai-video-generation/talking-photo\">Découvrir Photo parlante</a> pour consulter le flux actuellement publié.</p>",
      relatedLabel: "Ouvrir Photo parlante"
    },
    es: {
      title: "Vídeos de fotos parlantes: retrato, guion y revisión",
      summary: "Prepara un retrato claro, un mensaje breve y una revisión humana antes de compartir una foto parlante con IA.",
      imageAlt: "Retrato de origen preparado para un vídeo de foto parlante.",
      body: "<p>Una foto parlante funciona mejor con un retrato claro y un mensaje breve que la persona representada pueda aprobar. Utiliza solo una imagen que poseas o tengas permiso para animar.</p><h2>Preparar el retrato y el guion</h2><p>Elige un rostro visible, luz uniforme y un encuadre sencillo. Escribe una sola idea con frases cortas y verifica nombres, fechas y afirmaciones antes de generar.</p><h2>Revisar el resultado</h2><p>Compara el rostro con la fuente al principio, en el centro y al final. Escucha o lee el mensaje y comprueba boca, ojos, cabello, encuadre y fondo. Una animación no debe inventar una declaración o recomendación que la persona no haya autorizado.</p><p><a href=\"/ai-video-generation/talking-photo\">Descubre Foto parlante</a> para consultar el flujo publicado.</p>",
      relatedLabel: "Abrir Foto parlante"
    }
  }
]);

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function postFor(target, post) {
  const copy = post[target.locale];
  const imageSlug = post.key === "motion-generator" ? "cinematic-video" : post.key;
  const imageUrl = `${target.assetRoot}visuals/${imageSlug}/${imageSlug}-poster.jpg`;
  return {
    seo: {
      title: `${copy.title} | ${target.brand}`,
      description: copy.summary,
      canonicalPath: post.slug,
      canonical: `${target.origin}${post.slug}`,
      ogImage: imageUrl,
      robots: { index: true, follow: true }
    },
    version: 1,
    pageType: "article",
    sections: {
      blog_detail_1: {
        type: "blog_article",
        blocks: [],
        settings: {
          title: copy.title,
          body: copy.body,
          summary: copy.summary,
          imageUrl,
          imageAlt: copy.imageAlt,
          author: `${target.brand} editorial team`,
          authorType: "Organization",
          authorUrl: "/about-us",
          eyebrow: target.locale === "fr" ? "Guide" : "Guía",
          tags: target.locale === "fr" ? "Vidéo IA|Guide|Révision privée" : "Vídeo IA|Guía|Revisión privada",
          primaryHref: `/ai-video-generation/${post.key}`,
          primaryCta: copy.relatedLabel,
          relatedLinks: [{ href: `/ai-video-generation/${post.key}`, label: copy.relatedLabel }, { href: "/pricing", label: target.locale === "fr" ? "Voir les tarifs" : "Ver precios" }],
          publishedAt: "2026-09-27",
          updatedAt: "2026-09-27",
          reviewedAt: "2026-09-27",
          readMinutes: "5"
        }
      }
    },
    sectionsOrder: ["blog_detail_1"]
  };
}

function rowId(siteId, slug, suffix) {
  return `${siteId}_source_parity_${slug.slice(6).replace(/[^a-z0-9]+/gi, "_")}_${suffix}`;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY_LOCAL) assertNonProductionWriteTarget();
  const prisma = new PrismaClient();
  try {
    const sourceRows = await prisma.livePage.findMany({ where: { siteId: SOURCE_SITE_ID, slug: { in: POSTS.map((post) => post.slug) } }, select: { slug: true } });
    assert.equal(sourceRows.length, POSTS.length, "Source relational blog rows must exist before target parity repair.");
    const report = { ok: true, mode: APPLY_LOCAL ? "apply-local" : "dry-run", sourceWrites: 0, targets: [] };
    const backup = { targets: [] };
    for (const target of TARGETS) {
      const existingLive = await prisma.livePage.findMany({ where: { siteId: target.siteId, slug: { in: POSTS.map((post) => post.slug) } } });
      const existingTheme = await prisma.themePage.findMany({ where: { siteId: target.siteId, slug: { in: POSTS.map((post) => post.slug) } } });
      const liveBySlug = new Map(existingLive.map((row) => [row.slug, row]));
      const themeBySlug = new Map(existingTheme.map((row) => [row.slug, row]));
      const changes = POSTS.map((post) => {
        const contentJson = postFor(target, post);
        return { post, contentJson, live: liveBySlug.get(post.slug), theme: themeBySlug.get(post.slug) };
      });
      report.targets.push({ siteId: target.siteId, locale: target.locale, pages: changes.map(({ post, live, theme }) => ({ slug: post.slug, live: Boolean(live), theme: Boolean(theme) })) });
      backup.targets.push({ siteId: target.siteId, live: existingLive, theme: existingTheme });
      if (!APPLY_LOCAL) continue;
      await prisma.$transaction(async (tx) => {
        for (const { post, contentJson, live, theme } of changes) {
          const title = contentJson.sections.blog_detail_1.settings.title;
          if (live) await tx.livePage.update({ where: { id: live.id }, data: { title, pageType: "article", contentJson } });
          else await tx.livePage.create({ data: { id: rowId(target.siteId, post.slug, "live"), siteId: target.siteId, pageType: "article", templateKey: "blog-article", slug: post.slug, title, contentJson } });
          if (theme) await tx.themePage.update({ where: { id: theme.id }, data: { title, pageType: "article", templateKey: "blog-article", draftJson: contentJson, publishedJson: contentJson } });
          else await tx.themePage.create({ data: { id: rowId(target.siteId, post.slug, "theme"), siteId: target.siteId, pageType: "article", templateKey: "blog-article", slug: post.slug, title, draftJson: contentJson, publishedJson: contentJson } });
        }
      }, { maxWait: 20_000, timeout: 60_000 });
    }
    let backupPath;
    if (APPLY_LOCAL) {
      backupPath = path.join(REPORT_ROOT, `backup-before-source-parity-pages-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
      writeJson(backupPath, backup);
      report.backupPath = backupPath;
    }
    const reportPath = path.join(REPORT_ROOT, `report-source-parity-pages-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
    writeJson(reportPath, report);
    console.log(JSON.stringify({ ...report, reportPath }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
