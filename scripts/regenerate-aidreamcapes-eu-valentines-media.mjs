#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes_xby";
const PAGE_PATH = "/ai-save-the-date/valentines-day";
const PUBLIC_BASE = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/save-the-date/valentines-day-4k-vendor-v1";
const LOCAL_BASE = path.resolve("public", PUBLIC_BASE.slice(1));
const APPLY = process.argv.includes("--apply");

assertDatabaseTarget({ expectedTarget: "local" });

const assets = [
  {
    filename: "hero-valentines-day-save-the-date-city-couple.jpg",
    alt: "Couple fiancé en tenue de soirée élégante devant les lumières d'une ville au bord de l'eau.",
    caption: "Couple adulte en tenue de soirée sur une promenade au bord de l'eau pour une vidéo Save the Date de Saint-Valentin."
  },
  {
    filename: "hero-valentines-day-save-the-date-couple-candlelight.jpg",
    alt: "Couple fiancé partageant un moment intime à la lumière des bougies pendant un dîner de Saint-Valentin.",
    caption: "Portrait rapproché d'un couple adulte pendant un dîner romantique aux bougies et aux roses rouges."
  },
  {
    filename: "hero-valentines-day-save-the-date-proposal.jpg",
    alt: "Demande en mariage entourée de roses et de lumières chaudes pour une annonce de date de mariage de Saint-Valentin.",
    caption: "Demande en mariage entre adultes dans un jardin de roses éclairé par des guirlandes au crépuscule."
  },
  {
    filename: "valentines-day-save-the-date-beach-couple.jpg",
    alt: "Couple enlacé sur une plage au coucher du soleil pour une annonce romantique de date de mariage.",
    caption: "Couple adulte enlacé face à la mer pendant une séance photo de mariage au coucher du soleil."
  },
  {
    filename: "valentines-day-save-the-date-candlelight-dinner.jpg",
    alt: "Couple fiancé trinquant au champagne et entouré de roses rouges lors d'un dîner aux chandelles.",
    caption: "Couple adulte trinquant à une table avec verres, bougies et roses rouges."
  },
  {
    filename: "valentines-day-save-the-date-celebration-hug.jpg",
    alt: "Couple heureux s'enlaçant sous des lumières chaleureuses après avoir annoncé la date du mariage.",
    caption: "Couple adulte célébrant et s'enlaçant sous des lumières chaudes après l'annonce de la date du mariage."
  },
  {
    filename: "valentines-day-save-the-date-couple-planning.jpg",
    alt: "Couple consultant ensemble ses préparatifs de mariage devant un ordinateur portable dans une ambiance chaleureuse de Saint-Valentin.",
    caption: "Couple adulte consultant des idées de mariage et une séquence vidéo sur un ordinateur près d'une rose."
  },
  {
    filename: "valentines-day-save-the-date-beach-walk.jpg",
    alt: "Couple marchant main dans la main sur une plage au coucher du soleil près d'un cœur dessiné dans le sable.",
    caption: "Couple adulte marchant au bord de la mer près d'un cœur dessiné dans le sable."
  },
  {
    filename: "valentines-day-save-the-date-heart-bokeh-couple.jpg",
    alt: "Couple en tenue de soirée entouré de lumières en forme de cœur floutées pour une annonce de mariage.",
    caption: "Couple adulte en tenue de soirée sur une terrasse nocturne avec des lumières en forme de cœur doucement floutées."
  },
  {
    filename: "valentines-day-save-the-date-invitation-envelope.jpg",
    alt: "Couple tenant une enveloppe fermée scellée d'un cœur rouge pour annoncer la date du mariage.",
    caption: "Couple adulte tenant une enveloppe ivoire avec un sceau en forme de cœur rouge sur une table de papeterie."
  },
  {
    filename: "valentines-day-save-the-date-rose-garden-couple.jpg",
    alt: "Couple près d'une allée de roses éclairée par des lanternes pour une date de mariage romantique.",
    caption: "Couple adulte près d'une allée de roses et de lanternes pour la conclusion d'une histoire de Saint-Valentin."
  }
].map((asset) => ({
  ...asset,
  src: `${PUBLIC_BASE}/${asset.filename}`,
  storageKey: `${PUBLIC_BASE.slice(1)}/${asset.filename}`,
  width: 3840,
  height: 2160,
  format: "JPEG",
  loading: asset.filename === "hero-valentines-day-save-the-date-city-couple.jpg" ? "eager" : "lazy",
  fetchPriority: asset.filename === "hero-valentines-day-save-the-date-city-couple.jpg" ? "high" : "auto"
}));

const assetByFilename = new Map(assets.map((asset) => [asset.filename, asset]));
const filenameFromUrl = (value) => {
  if (typeof value !== "string") return "";
  return value.split("?")[0].split("#")[0].split("/").at(-1) || "";
};

function patchImageObjects(value) {
  if (Array.isArray(value)) return value.map(patchImageObjects);
  if (!value || typeof value !== "object") return value;

  const next = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, patchImageObjects(entry)]));
  const asset = assetByFilename.get(filenameFromUrl(next.imageUrl))
    ?? assets.find((candidate) => candidate.alt === next.alt || candidate.alt === next.imageAlt);
  if (!asset) return next;
  return {
    ...next,
    imageUrl: asset.src,
    imageOriginalUrl: asset.src,
    imageAlt: asset.alt,
    alt: asset.alt,
    imageWidth: asset.width,
    imageHeight: asset.height,
    imageLoading: asset.loading,
    imageFetchPriority: asset.fetchPriority
  };
}

function patchPageJson(value) {
  const next = patchImageObjects(structuredClone(value || {}));
  if (Array.isArray(next.mediaManifest)) {
    next.mediaManifest = next.mediaManifest.map((item) => {
      const asset = assetByFilename.get(item.filename) || assetByFilename.get(filenameFromUrl(item.src));
      return asset
        ? {
            ...item,
            src: asset.src,
            alt: asset.alt,
            alt_text: asset.alt,
            width: asset.width,
            height: asset.height,
            format: asset.format,
            loading: asset.loading,
            fetchpriority: asset.fetchPriority,
            source: "AI-generated 4K editorial photograph"
          }
        : item;
    });
  }
  if (next.seo && typeof next.seo === "object") {
    const hero = assetByFilename.get("hero-valentines-day-save-the-date-city-couple.jpg");
    next.seo = { ...next.seo, ogImage: hero.src };
  }
  return next;
}

for (const asset of assets) {
  const filePath = path.join(LOCAL_BASE, asset.filename);
  if (!fs.existsSync(filePath)) throw new Error(`Missing generated 4K asset: ${filePath}`);
}

const prisma = new PrismaClient();
try {
  const page = await prisma.themePage.findUnique({
    where: { siteId_slug: { siteId: SITE_ID, slug: PAGE_PATH } },
    select: { id: true, title: true, draftJson: true, publishedJson: true }
  });
  if (!page) throw new Error(`Theme page not found: ${SITE_ID}${PAGE_PATH}`);

  const nextDraft = patchPageJson(page.draftJson);
  const nextPublished = patchPageJson(page.publishedJson && Object.keys(page.publishedJson).length ? page.publishedJson : page.draftJson);
  const settings = await prisma.themeSettings.findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true } });
  const patchNavigation = (value) => {
    if (Array.isArray(value)) return value.map(patchNavigation);
    if (!value || typeof value !== "object") return value;
    const next = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, patchNavigation(entry)]));
    if (next.href === PAGE_PATH) {
      const hero = assetByFilename.get("hero-valentines-day-save-the-date-city-couple.jpg");
      return hero ? { ...next, imageUrl: hero.src, imageAlt: hero.alt } : next;
    }
    return next;
  };
  const nextSettingsDraft = settings ? patchNavigation(structuredClone(settings.draftJson)) : null;
  const nextSettingsPublished = settings ? patchNavigation(structuredClone(settings.publishedJson)) : null;
  const changedImageCount = assets.filter((asset) => JSON.stringify(page.draftJson).includes(asset.filename) && !JSON.stringify(page.draftJson).includes(asset.src)).length;

  if (APPLY) {
    await prisma.$transaction(async (tx) => {
      for (const asset of assets) {
        await tx.mediaAsset.upsert({
          where: { siteId_storageKey: { siteId: SITE_ID, storageKey: asset.storageKey } },
          create: {
            id: `media_${SITE_ID}_valentines_4k_vendor_v1_${asset.filename.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}`,
            siteId: SITE_ID,
            label: asset.filename,
            storageKey: asset.storageKey,
            mimeType: "image/jpeg",
            usageType: "theme",
            sourceType: "save-the-date-valentines-day-vendor-api-gpt-image-2-4k-v1",
            previewUrl: asset.src,
            originUrl: asset.src,
            altText: asset.alt,
            notes: asset.caption
          },
          update: {
            label: asset.filename,
            previewUrl: asset.src,
            originUrl: asset.src,
            altText: asset.alt,
            notes: asset.caption
          }
        });
      }
      await tx.themePage.update({
        where: { id: page.id },
        data: { draftJson: nextDraft, publishedJson: nextPublished }
      });
      await tx.livePage.updateMany({
        where: { siteId: SITE_ID, slug: PAGE_PATH },
        data: { contentJson: nextPublished }
      });
      if (settings && nextSettingsDraft && nextSettingsPublished) {
        await tx.themeSettings.update({
          where: { siteId: SITE_ID },
          data: { draftJson: nextSettingsDraft, publishedJson: nextSettingsPublished }
        });
      }
    });
  }

  console.log(JSON.stringify({
    ok: true,
    siteId: SITE_ID,
    pagePath: PAGE_PATH,
    mode: APPLY ? "applied" : "dry-run",
    assets: assets.map(({ filename, src, width, height, alt }) => ({ filename, src, width, height, alt })),
    changedImageCount,
    publication: "live draft projection reads the updated ThemePage draftJson"
  }, null, 2));
} finally {
  await prisma.$disconnect();
}
