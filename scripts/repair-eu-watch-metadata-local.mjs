#!/usr/bin/env node

// Bounded local repair for the eight EU watch records that were missing a
// complete current editorial metadata tuple. It only updates the two EU
// sites, never site_dreamshoot, and it does not read publication snapshots.
// Every write is preceded by a full target-table backup and can be previewed
// with the default dry-run mode.
import "./load-runtime-env.mjs";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget, assertNonProductionWriteTarget } from "./lib/database-target.mjs";

const TARGETS = Object.freeze({
  site_aidreamcapes_xby: {
    slug: "aidreamcapes-eu",
    domain: "aidreamcapes.eu",
    assetRoot: "/assets/sites/site_aidreamcapes_eu"
  },
  site_mydreamshoots_xby: {
    slug: "aidreamshoots",
    domain: "aidreamshoots.eu",
    assetRoot: "/assets/sites/site_aidreamshoots"
  }
});

const WATCH_MEDIA = Object.freeze({
  site_aidreamcapes_xby: [
    {
      video: "/assets/sites/site_aidreamcapes_eu/visuals/talking-photo/portrait-parlant.mp4",
      poster: "/assets/sites/site_aidreamcapes_eu/visuals/talking-photo/portrait-parlant-poster.jpg",
      title: "Comment fonctionne la création vidéo avec Aidreamcapes",
      description: "Découvrez le parcours Aidreamcapes pour importer des photos autorisées, choisir un flux de création et générer une vidéo IA dans votre espace privé.",
      durationSeconds: 15
    },
    {
      video: "/assets/sites/site_aidreamcapes_eu/homepage-showcase/videos/alpine-trail-motion.mp4",
      poster: "/assets/sites/site_aidreamcapes_eu/homepage-showcase/posters/alpine-trail-motion.webp",
      title: "Famille ouvrant ensemble un cadeau de Noël lumineux",
      description: "Une famille ouvre ensemble un cadeau de Noël lumineux à côté d’un arbre décoré et d’une cheminée.",
      durationSeconds: 6
    },
    {
      video: "/assets/sites/site_aidreamcapes_eu/visuals/cinematic-video/video-cinematographique.mp4",
      poster: "/assets/sites/site_aidreamcapes_eu/visuals/cinematic-video/video-cinematographique-poster.jpg",
      title: "Tutoriel de génération de vidéos IA avec Aidreamcapes",
      description: "Découvrez comment transformer des images sélectionnées en vidéo IA privée avec le flux image-vidéo d’Aidreamcapes.",
      durationSeconds: 15
    },
    {
      video: "/assets/sites/site_aidreamcapes_eu/homepage-showcase/videos/coastal-memory-clip.mp4",
      poster: "/assets/sites/site_aidreamcapes_eu/homepage-showcase/posters/coastal-memory-clip.webp",
      title: "Vidéo Save the Date de la Saint-Valentin créée avec l’IA",
      description: "Une annonce romantique Save the Date pour la Saint-Valentin, conçue pour les invitations, les messages et les publications sociales.",
      durationSeconds: 6
    }
  ],
  site_mydreamshoots_xby: [
    {
      video: "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/videos/aidreamshoots-ai-image-tutorial-20260814.mp4",
      oldVideo: "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/videos/AIdreamshoots-ai-image-tutorial-20260814.mp4",
      poster: "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/posters/aidreamshoots-ai-image-tutorial-20260814.jpg",
      oldPoster: "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/posters/AIdreamshoots-ai-image-tutorial-20260814.jpg",
      title: "Cómo funciona la creación de imágenes con IA en AIdreamshoots",
      description: "Descubre cómo subir fotos autorizadas, elegir un flujo de creación y generar resultados dentro de tu espacio privado.",
      durationSeconds: 61
    },
    {
      video: "/assets/sites/site_aidreamshoots/visuals/seasonal/christmas/christmas-hero-family-gift.mp4",
      poster: "/assets/sites/site_aidreamshoots/visuals/save-the-date/christmas/save-the-date-themes-vendor-no-crop-20260915-v1/christmas-01-christmas-family-gift.jpg",
      title: "Familia abriendo un brillante regalo de Navidad",
      description: "Una familia abre un brillante regalo de Navidad junto a un árbol decorado y una chimenea.",
      durationSeconds: 15
    },
    {
      video: "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/videos/aidreamshoots-ai-video-tutorial-20260814.mp4",
      oldVideo: "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/videos/AIdreamshoots-ai-video-tutorial-20260814.mp4",
      poster: "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/posters/aidreamshoots-ai-video-tutorial-20260814.jpg",
      oldPoster: "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/posters/AIdreamshoots-ai-video-tutorial-20260814.jpg",
      title: "Tutorial de generación de vídeos con IA en AIdreamshoots",
      description: "Aprende a convertir imágenes seleccionadas en un vídeo privado con IA desde el flujo de imagen a vídeo.",
      durationSeconds: 58
    },
    {
      video: "/assets/sites/site_aidreamshoots/visuals/save-the-date/valentines-day/valentines-day-save-the-date.mp4",
      poster: "/assets/sites/site_aidreamshoots/visuals/save-the-date/valentines-day/hero-valentines-day-save-the-date-city-couple.jpg",
      title: "Vídeo para guardar la fecha de San Valentín creado con IA",
      description: "Un anuncio romántico para guardar la fecha de San Valentín, preparado para invitaciones, mensajes y publicaciones sociales.",
      durationSeconds: 30
    }
  ]
});

const APPLY_LOCAL = process.argv.includes("--apply-local");
const REPORT_ROOT = path.resolve(".tmp", "eu-watch-metadata-repair");

function clone(value) {
  return value === undefined ? value : structuredClone(value);
}

function changed(before, after) {
  return JSON.stringify(before) !== JSON.stringify(after);
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function hashId(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 24);
}

function cleanPath(value) {
  return value.split(/[?#]/)[0];
}

function publicFile(siteId, pathname) {
  const target = TARGETS[siteId];
  const clean = cleanPath(pathname);
  assert(clean.startsWith(`${target.assetRoot}/`), `${siteId}: asset escaped target root: ${pathname}`);
  assert(!clean.includes("/mirror/"), `${siteId}: mirror media is not eligible for watch publication: ${pathname}`);
  const filePath = path.resolve("public", clean.slice(1));
  assert(fs.existsSync(filePath), `${siteId}: target-owned asset is missing: ${pathname}`);
  assert(fs.statSync(filePath).isFile(), `${siteId}: target-owned asset is not a file: ${pathname}`);
  return filePath;
}

function mediaAssetInput(siteId, pathname, alt, usageType) {
  const clean = cleanPath(pathname);
  publicFile(siteId, clean);
  const storageKey = clean.slice(1);
  const mimeType = /\.(?:mp4|webm)$/i.test(clean)
    ? `video/${clean.toLowerCase().endsWith(".webm") ? "webm" : "mp4"}`
    : clean.toLowerCase().endsWith(".png")
      ? "image/png"
      : clean.toLowerCase().endsWith(".avif")
        ? "image/avif"
        : clean.toLowerCase().endsWith(".jpg") || clean.toLowerCase().endsWith(".jpeg")
          ? "image/jpeg"
          : "image/webp";
  return {
    id: `media_${siteId}_watch_metadata_${hashId(storageKey)}`,
    siteId,
    label: path.basename(clean),
    storageKey,
    mimeType,
    usageType,
    sourceType: "eu-watch-metadata-local-v1",
    previewUrl: clean,
    originUrl: clean,
    altText: alt,
    notes: "Current target-owned watch metadata media; no source-site or mirror URL."
  };
}

function entryFor(siteId, videoUrl) {
  return (WATCH_MEDIA[siteId] ?? []).find((entry) => entry.video === videoUrl || entry.oldVideo === videoUrl);
}

function stringReplacements(siteId) {
  const entries = WATCH_MEDIA[siteId] ?? [];
  return new Map(entries.flatMap((entry) => [
    [entry.oldVideo, entry.video],
    [entry.oldPoster, entry.poster]
  ].filter(([from]) => Boolean(from))));
}

function rewriteJson(siteId, value, uploadDate, replacements = stringReplacements(siteId)) {
  if (typeof value === "string") return replacements.get(value) ?? value;
  if (Array.isArray(value)) return value.map((item) => rewriteJson(siteId, item, uploadDate, replacements));
  if (!value || typeof value !== "object") return value;

  const input = value;
  const output = Object.fromEntries(Object.entries(input).map(([key, child]) => [key, rewriteJson(siteId, child, uploadDate, replacements)]));
  const originalVideo = typeof input.videoUrl === "string" ? input.videoUrl : "";
  const entry = entryFor(siteId, originalVideo);
  if (entry) {
    output.videoUrl = entry.video;
    output.videoPosterUrl = entry.poster;
    if (typeof output.videoTitle !== "string" || !output.videoTitle.trim()) output.videoTitle = entry.title;
    if (typeof output.videoDescription !== "string" || !output.videoDescription.trim()) output.videoDescription = entry.description;
    if (!(Number(output.videoDurationSeconds) > 0)) output.videoDurationSeconds = entry.durationSeconds;
    if (typeof output.videoUploadDate !== "string" || !output.videoUploadDate.trim()) output.videoUploadDate = uploadDate;
  }
  return output;
}

function mediaDescription(siteId, entry) {
  return `${entry.title} (${TARGETS[siteId].domain})`;
}

async function main() {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (APPLY_LOCAL) assertNonProductionWriteTarget();

  const prisma = new PrismaClient();
  try {
    const [sites, livePages, themePages, themeSettings, videoThemes, mediaAssets] = await Promise.all([
      prisma.site.findMany({ where: { id: { in: Object.keys(TARGETS) } }, orderBy: { id: "asc" } }),
      prisma.livePage.findMany({ where: { siteId: { in: Object.keys(TARGETS) } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }] }),
      prisma.themePage.findMany({ where: { siteId: { in: Object.keys(TARGETS) } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }] }),
      prisma.themeSettings.findMany({ where: { siteId: { in: Object.keys(TARGETS) } }, orderBy: { siteId: "asc" } }),
      prisma.videoTheme.findMany({ where: { siteId: { in: Object.keys(TARGETS) } }, orderBy: [{ siteId: "asc" }, { slug: "asc" }] }),
      prisma.mediaAsset.findMany({ where: { siteId: { in: Object.keys(TARGETS) } }, orderBy: [{ siteId: "asc" }, { storageKey: "asc" }] })
    ]);

    assert.equal(sites.length, 2, "Expected exactly the two EU target sites.");
    for (const site of sites) {
      const target = TARGETS[site.id];
      assert(target, `Unexpected write target: ${site.id}`);
      assert.equal(site.slug, target.slug, `${site.id}: slug identity check failed.`);
      assert.equal(site.primaryDomain, target.domain, `${site.id}: domain identity check failed.`);
    }

    const siteById = new Map(sites.map((site) => [site.id, site]));
    const changesBySite = {};
    const liveUpdates = [];
    const themeUpdates = [];
    const settingsUpdates = [];
    for (const siteId of Object.keys(TARGETS)) {
      const site = siteById.get(siteId);
      const entries = WATCH_MEDIA[siteId];
      const siteLivePages = livePages.filter((row) => row.siteId === siteId);
      const siteThemePages = themePages.filter((row) => row.siteId === siteId);
      const siteSettings = themeSettings.find((row) => row.siteId === siteId);
      const replacement = stringReplacements(siteId);

      for (const row of siteLivePages) {
        const next = rewriteJson(siteId, row.contentJson, row.updatedAt.toISOString(), replacement);
        if (changed(row.contentJson, next)) liveUpdates.push({ row, next });
      }
      for (const row of siteThemePages) {
        const draftJson = rewriteJson(siteId, row.draftJson, row.updatedAt.toISOString(), replacement);
        const publishedJson = rewriteJson(siteId, row.publishedJson, row.updatedAt.toISOString(), replacement);
        if (changed(row.draftJson, draftJson) || changed(row.publishedJson, publishedJson)) themeUpdates.push({ row, draftJson, publishedJson });
      }
      if (siteSettings) {
        const draftJson = rewriteJson(siteId, siteSettings.draftJson, siteSettings.updatedAt.toISOString(), replacement);
        const publishedJson = rewriteJson(siteId, siteSettings.publishedJson, siteSettings.updatedAt.toISOString(), replacement);
        if (changed(siteSettings.draftJson, draftJson) || changed(siteSettings.publishedJson, publishedJson)) settingsUpdates.push({ row: siteSettings, draftJson, publishedJson });
      }
      changesBySite[siteId] = {
        domain: site.primaryDomain,
        livePagesChanged: liveUpdates.filter(({ row }) => row.siteId === siteId).map(({ row }) => row.slug),
        themePagesChanged: themeUpdates.filter(({ row }) => row.siteId === siteId).map(({ row }) => row.slug),
        themeSettingsChanged: settingsUpdates.some(({ row }) => row.siteId === siteId),
        watchRecords: entries.map(({ video, oldVideo, poster }) => ({ video, oldVideo: oldVideo ?? null, poster }))
      };
    }

    const mediaInputs = [];
    for (const siteId of Object.keys(TARGETS)) {
      for (const entry of WATCH_MEDIA[siteId]) {
        const alt = mediaDescription(siteId, entry);
        mediaInputs.push(mediaAssetInput(siteId, entry.video, alt, "watch-video"));
        mediaInputs.push(mediaAssetInput(siteId, entry.poster, alt, "watch-poster"));
      }
    }
    const uniqueMediaInputs = [...new Map(mediaInputs.map((asset) => [`${asset.siteId}:${asset.storageKey}`, asset])).values()];
    for (const asset of uniqueMediaInputs) {
      assert(Object.keys(TARGETS).includes(asset.siteId), `Media write escaped EU targets: ${asset.siteId}`);
      assert(!asset.storageKey.includes("/mirror/"), `Media write retained a mirror path: ${asset.storageKey}`);
    }

    const report = {
      ok: true,
      mode: APPLY_LOCAL ? "apply-local" : "dry-run",
      targetSites: Object.keys(TARGETS),
      sourceWrites: 0,
      livePagesChanged: liveUpdates.map(({ row }) => `${row.siteId}:${row.slug}`),
      themePagesChanged: themeUpdates.map(({ row }) => `${row.siteId}:${row.slug}`),
      themeSettingsChanged: settingsUpdates.map(({ row }) => row.siteId),
      mediaAssetsRegistered: uniqueMediaInputs.length,
      changesBySite
    };

    let backupPath;
    if (APPLY_LOCAL) {
      backupPath = path.join(REPORT_ROOT, `backup-before-eu-watch-metadata-${timestamp()}.json`);
      writeJson(backupPath, { sites, livePages, themePages, themeSettings, videoThemes, mediaAssets });
      await prisma.$transaction(async (tx) => {
        for (const { row, next } of liveUpdates) {
          assert(Object.keys(TARGETS).includes(row.siteId), `LivePage write escaped EU targets: ${row.siteId}`);
          await tx.livePage.update({ where: { id: row.id }, data: { contentJson: next } });
        }
        for (const { row, draftJson, publishedJson } of themeUpdates) {
          assert(Object.keys(TARGETS).includes(row.siteId), `ThemePage write escaped EU targets: ${row.siteId}`);
          await tx.themePage.update({ where: { id: row.id }, data: { draftJson, publishedJson } });
        }
        for (const { row, draftJson, publishedJson } of settingsUpdates) {
          assert(Object.keys(TARGETS).includes(row.siteId), `ThemeSettings write escaped EU targets: ${row.siteId}`);
          await tx.themeSettings.update({ where: { id: row.id }, data: { draftJson, publishedJson } });
        }
        for (const asset of uniqueMediaInputs) {
          await tx.mediaAsset.upsert({
            where: { siteId_storageKey: { siteId: asset.siteId, storageKey: asset.storageKey } },
            create: asset,
            update: {
              label: asset.label,
              mimeType: asset.mimeType,
              usageType: asset.usageType,
              sourceType: asset.sourceType,
              previewUrl: asset.previewUrl,
              originUrl: asset.originUrl,
              altText: asset.altText,
              notes: asset.notes
            }
          });
        }
      }, { maxWait: 20_000, timeout: 60_000 });
      report.backupPath = backupPath;
    }

    const reportPath = path.join(REPORT_ROOT, `report-eu-watch-metadata-${timestamp()}.json`);
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
