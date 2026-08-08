#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import ffmpegPath from "ffmpeg-static";
import { PrismaClient } from "@prisma/client";
import {
  homepageShowcaseSection,
  localShowcaseImagePath,
  localShowcasePosterPath,
  localShowcaseVideoPath,
  publicShowcaseImagePath,
  publicShowcasePosterPath,
  publicShowcaseVideoPath,
  showcaseImageThemesForStore,
  showcaseStores,
  showcaseVideoPosterSlug
} from "./dreamshoot-homepage-showcase-data.mjs";

const repoRoot = process.cwd();
const statePath = path.join(repoRoot, "data", "platform-state.json");
const showcaseSectionId = "generation_showcase_1";
const workflowSectionId = "flow_bridge_1";
const CUSTOMER_VIDEO_FRAME_LIMIT = 7;
const obsoleteShowcaseRows = {
  site_dreamshoot: {
    categorySlugs: ["travel-story"],
    themeSlugs: ["travel-route-story"]
  }
};

const rawArgs = process.argv.slice(2);
const args = new Map();
const flags = new Set();
for (let index = 0; index < rawArgs.length; index += 1) {
  const rawArg = rawArgs[index];
  if (!rawArg.startsWith("--")) continue;
  const [key, ...rest] = rawArg.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
  } else {
    const next = rawArgs[index + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      index += 1;
    } else {
      flags.add(key);
    }
  }
}

const forceContentOverwrite = flags.has("force-content-overwrite") || ["1", "true", "yes"].includes(String(args.get("force-content-overwrite") ?? "").toLowerCase());
const dryRun = flags.has("dry-run") || !forceContentOverwrite;
const updateDb = flags.has("db");
const skipAssets = flags.has("skip-assets") || dryRun;
const forceAssets = flags.has("force-assets") || flags.has("force");
const allowStaticVideoFallback = flags.has("static-video-fallback") || flags.has("placeholder-assets");
const selectedStores = new Set(
  String(args.get("stores") ?? args.get("store") ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
);

function selectedShowcaseStores() {
  return showcaseStores.filter((store) =>
    !selectedStores.size ||
    selectedStores.has(store.key) ||
    selectedStores.has(store.siteSlug) ||
    selectedStores.has(store.siteId)
  );
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripVersion(value) {
  return String(value || "").split("?")[0];
}

function publicPathToLocalFile(publicPath) {
  const cleanPath = stripVersion(publicPath).replace(/^\/+/, "");
  return path.join(repoRoot, "public", cleanPath);
}

async function readState() {
  return JSON.parse(await fs.readFile(statePath, "utf8"));
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile() && stat.size > 0;
  } catch {
    return false;
  }
}

function packSlugTokens(pack) {
  return [
    pack.category,
    pack.categoryRecord?.slug,
    pack.categoryRecord?.parent?.slug,
    pack.name
  ].filter(Boolean).map(slugify);
}

function findSourcePack(store, state, index) {
  const packs = (state.creativePacks ?? []).filter((pack) => pack.siteId === store.siteId && pack.status === "active");
  const requestedSlug = slugify(store.imageSlugs[index] ?? store.imageSlugs[0]);
  return packs.find((pack) => packSlugTokens(pack).includes(requestedSlug)) ?? packs[index % Math.max(1, packs.length)];
}

function firstLocalImageForPack(pack) {
  const candidates = [
    ...(Array.isArray(pack?.galleryImages) ? pack.galleryImages : []),
    pack?.imageUrl
  ].filter(Boolean);
  for (const candidate of candidates) {
    const filePath = publicPathToLocalFile(candidate);
    if (filePath.startsWith(path.join(repoRoot, "public"))) return filePath;
  }
  return "";
}

async function copyPoster(sourceFile, posterFile) {
  await fs.mkdir(path.dirname(posterFile), { recursive: true });
  await fs.copyFile(sourceFile, posterFile);
}

async function runFfmpeg(argsForFfmpeg) {
  if (!ffmpegPath) throw new Error("ffmpeg_static_not_available");
  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, argsForFfmpeg, { stdio: ["ignore", "ignore", "pipe"] });
    let errorText = "";
    child.stderr.on("data", (chunk) => {
      errorText += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(errorText.slice(-1200) || `ffmpeg exited ${code}`));
      }
    });
  });
}

async function createMotionClip(posterFile, videoFile, durationSeconds) {
  await fs.mkdir(path.dirname(videoFile), { recursive: true });
  const duration = Math.max(3, Math.min(12, Number(durationSeconds) || 6));
  const fadeOutStart = Math.max(0, duration - 0.35).toFixed(2);
  await runFfmpeg([
    "-y",
    "-loop",
    "1",
    "-t",
    String(duration),
    "-i",
    posterFile,
    "-vf",
    `scale=960:960:force_original_aspect_ratio=increase,crop=960:960,fade=t=in:st=0:d=0.35,fade=t=out:st=${fadeOutStart}:d=0.35,format=yuv420p`,
    "-r",
    "25",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "22",
    "-movflags",
    "+faststart",
    videoFile
  ]);
}

async function prepareShowcaseAssets(store, state) {
  const images = [];
  for (const theme of showcaseImageThemesForStore(store)) {
    const imageFile = path.resolve(repoRoot, localShowcaseImagePath(store, theme.slug));
    const imageReady = await fileExists(imageFile);
    images.push({
      slug: theme.slug,
      ok: imageReady,
      image: publicShowcaseImagePath(store, theme.slug),
      ...(!imageReady ? { reason: "image_missing_run_generate_dreamshoot_homepage_images" } : {})
    });
  }

  const videos = [];
  for (const [index, theme] of store.videoThemes.entries()) {
    const posterSlug = showcaseVideoPosterSlug(store, theme, index);
    const dedicatedSourceFile = path.resolve(repoRoot, localShowcaseImagePath(store, posterSlug));
    const fallbackPack = findSourcePack(store, state, index);
    const fallbackSourceFile = firstLocalImageForPack(fallbackPack);
    const sourceFile = await fileExists(dedicatedSourceFile) ? dedicatedSourceFile : fallbackSourceFile;
    const posterFile = path.resolve(repoRoot, localShowcasePosterPath(store, theme.slug));
    const videoFile = path.resolve(repoRoot, localShowcaseVideoPath(store, theme.slug));
    const sourceReady = sourceFile ? await fileExists(sourceFile) : false;
    if (!sourceReady) {
      videos.push({ slug: theme.slug, ok: false, reason: "source_image_missing", posterSlug, sourceFile });
      continue;
    }
    if (forceAssets || !(await fileExists(posterFile))) {
      await copyPoster(sourceFile, posterFile);
    }
    let staticFallbackCreated = false;
    if ((forceAssets || !(await fileExists(videoFile))) && allowStaticVideoFallback) {
      await createMotionClip(posterFile, videoFile, theme.durationSeconds);
      staticFallbackCreated = true;
    }
    const videoReady = await fileExists(videoFile);
    videos.push({
      slug: theme.slug,
      ok: videoReady,
      posterSlug,
      poster: publicShowcasePosterPath(store, theme.slug),
      video: publicShowcaseVideoPath(store, theme.slug),
      ...(staticFallbackCreated ? { warning: "static_video_fallback_created" } : {}),
      ...(!videoReady ? { reason: "video_missing_run_generate_dreamshoot_homepage_videos" } : {})
    });
  }
  return { images, videos };
}

function categoryRowsForStore(store, state, now) {
  const existing = new Map(
    (state.videoThemeCategories ?? [])
      .filter((category) => category.siteId === store.siteId)
      .map((category) => [category.slug, category])
  );
  return store.videoCategories.map((category, index) => {
    const current = existing.get(category.slug);
    return {
      id: current?.id ?? `video_cat_${store.key}_${category.slug.replace(/[^a-z0-9]+/g, "_")}`,
      siteId: store.siteId,
      slug: category.slug,
      label: category.label,
      description: category.description,
      imageUrl: category.imageUrl ?? publicShowcasePosterPath(store, store.videoThemes[index % store.videoThemes.length].slug),
      sortOrder: index + 1,
      status: "active",
      createdAt: current?.createdAt ?? now
    };
  });
}

function videoThemeRowsForStore(store, categories, state, now) {
  const existing = new Map(
    (state.videoThemes ?? [])
      .filter((theme) => theme.siteId === store.siteId)
      .map((theme) => [theme.slug, theme])
  );
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  return store.videoThemes.map((theme) => {
    const current = existing.get(theme.slug);
    const category = categoryBySlug.get(theme.categorySlug);
    return {
      id: current?.id ?? `video_theme_${store.key}_${theme.slug.replace(/[^a-z0-9]+/g, "_")}`,
      siteId: store.siteId,
      categoryId: category?.id,
      category,
      slug: theme.slug,
      name: theme.name,
      headline: theme.headline,
      description: theme.description,
      prompt: theme.prompt,
      status: "active",
      creditCost: theme.creditCost,
      durationSeconds: theme.durationSeconds,
      maxFrames: CUSTOMER_VIDEO_FRAME_LIMIT,
      generationCount: current?.generationCount ?? 0,
      createdAt: current?.createdAt ?? now,
      imageUrl: publicShowcasePosterPath(store, theme.slug),
      galleryImages: [publicShowcaseVideoPath(store, theme.slug)]
    };
  });
}

function upsertRows(rows, incomingRows, keyForRow) {
  const nextByKey = new Map(rows.map((row) => [keyForRow(row), row]));
  for (const row of incomingRows) {
    nextByKey.set(keyForRow(row), row);
  }
  return Array.from(nextByKey.values());
}

function deactivateObsoleteShowcaseRows(state, store) {
  const obsolete = obsoleteShowcaseRows[store.siteId];
  if (!obsolete) return;
  const categorySlugs = new Set(obsolete.categorySlugs);
  const themeSlugs = new Set(obsolete.themeSlugs);
  state.videoThemeCategories = (state.videoThemeCategories ?? []).map((category) =>
    category.siteId === store.siteId && categorySlugs.has(category.slug)
      ? { ...category, status: "inactive" }
      : category
  );
  state.videoThemes = (state.videoThemes ?? []).map((theme) =>
    theme.siteId === store.siteId && themeSlugs.has(theme.slug)
      ? { ...theme, status: "inactive" }
      : theme
  );
}

function applyHomeShowcase(pageJson, store) {
  if (!pageJson?.sections || !Array.isArray(pageJson.sectionsOrder)) return false;
  const section = homepageShowcaseSection(store, 8, 8);
  pageJson.sections[showcaseSectionId] = section;

  const hadWorkflow = pageJson.sectionsOrder.includes(workflowSectionId);
  const baseOrder = pageJson.sectionsOrder.filter((id) => id !== showcaseSectionId && id !== workflowSectionId);
  const packageIndex = baseOrder.indexOf("package_catalog_1");
  const insertAt = packageIndex >= 0 ? packageIndex + 1 : Math.min(5, baseOrder.length);
  baseOrder.splice(insertAt, 0, showcaseSectionId);
  if (hadWorkflow) baseOrder.splice(insertAt + 1, 0, workflowSectionId);
  pageJson.sectionsOrder = baseOrder.filter((id) => Boolean(pageJson.sections[id]));
  return true;
}

function applyShowcaseToState(state, stores) {
  let pageUpdates = 0;
  let themeTemplateUpdates = 0;
  let publicationUpdates = 0;

  for (const store of stores) {
    const site = (state.sites ?? []).find((item) => item.id === store.siteId || item.slug === store.siteSlug);
    const homePage = site?.pages?.find((page) => page.slug === "/" || page.pageType === "home");
    if (homePage) {
      if (applyHomeShowcase(homePage.draftJson, store)) pageUpdates += 1;
      if (applyHomeShowcase(homePage.publishedJson, store)) pageUpdates += 1;
    }

    for (const theme of state.siteThemes ?? []) {
      if (theme.siteId !== store.siteId) continue;
      const indexTemplate = theme.templates?.index;
      if (!indexTemplate?.sections || !Array.isArray(indexTemplate.content_for_page)) continue;
      indexTemplate.sections[showcaseSectionId] = clone(homepageShowcaseSection(store, 8, 8));
      const hadWorkflow = indexTemplate.content_for_page.includes(workflowSectionId);
      const order = indexTemplate.content_for_page.filter((id) => id !== showcaseSectionId && id !== workflowSectionId);
      const packageIndex = order.indexOf("package_catalog_1");
      const insertAt = packageIndex >= 0 ? packageIndex + 1 : Math.min(5, order.length);
      order.splice(insertAt, 0, showcaseSectionId);
      if (hadWorkflow) order.splice(insertAt + 1, 0, workflowSectionId);
      indexTemplate.content_for_page = order.filter((id) => Boolean(indexTemplate.sections[id]));
      themeTemplateUpdates += 1;
    }

    for (const publication of state.themePublications ?? []) {
      if (publication.siteId !== store.siteId) continue;
      const homeSnapshot = publication.snapshot?.pages?.find((page) => page.slug === "/");
      if (homeSnapshot?.publishedJson && applyHomeShowcase(homeSnapshot.publishedJson, store)) {
        publicationUpdates += 1;
      }
    }
  }

  return { pageUpdates, themeTemplateUpdates, publicationUpdates };
}

async function updateDatabase(state, stores) {
  const prisma = new PrismaClient();
  const report = { categories: 0, themes: 0, pages: 0, siteThemes: 0, publications: 0 };
  try {
    for (const store of stores) {
      const categories = categoryRowsForStore(store, state, new Date().toISOString());
      const categoryIdBySlug = new Map();
      for (const category of categories) {
        const row = await prisma.videoThemeCategory.upsert({
          where: { siteId_slug: { siteId: store.siteId, slug: category.slug } },
          create: {
            id: category.id,
            siteId: store.siteId,
            slug: category.slug,
            label: category.label,
            description: category.description,
            imageUrl: category.imageUrl,
            sortOrder: category.sortOrder,
            status: "active"
          },
          update: {
            label: category.label,
            description: category.description,
            imageUrl: category.imageUrl,
            sortOrder: category.sortOrder,
            status: "active"
          }
        });
        categoryIdBySlug.set(category.slug, row.id);
        report.categories += 1;
      }

      for (const theme of store.videoThemes) {
        await prisma.videoTheme.upsert({
          where: { siteId_slug: { siteId: store.siteId, slug: theme.slug } },
          create: {
            id: `video_theme_${store.key}_${theme.slug.replace(/[^a-z0-9]+/g, "_")}`,
            siteId: store.siteId,
            categoryId: categoryIdBySlug.get(theme.categorySlug),
            slug: theme.slug,
            name: theme.name,
            headline: theme.headline,
            description: theme.description,
            prompt: theme.prompt,
            status: "active",
            creditCost: theme.creditCost,
            durationSeconds: theme.durationSeconds,
            maxFrames: CUSTOMER_VIDEO_FRAME_LIMIT,
            generationCount: 0,
            imageUrl: publicShowcasePosterPath(store, theme.slug),
            galleryImages: [publicShowcaseVideoPath(store, theme.slug)]
          },
          update: {
            categoryId: categoryIdBySlug.get(theme.categorySlug),
            name: theme.name,
            headline: theme.headline,
            description: theme.description,
            prompt: theme.prompt,
            status: "active",
            creditCost: theme.creditCost,
            durationSeconds: theme.durationSeconds,
            maxFrames: CUSTOMER_VIDEO_FRAME_LIMIT,
            imageUrl: publicShowcasePosterPath(store, theme.slug),
            galleryImages: [publicShowcaseVideoPath(store, theme.slug)]
          }
        });
        report.themes += 1;
      }

      const obsolete = obsoleteShowcaseRows[store.siteId];
      if (obsolete) {
        await prisma.videoThemeCategory.updateMany({
          where: { siteId: store.siteId, slug: { in: obsolete.categorySlugs } },
          data: { status: "inactive" }
        });
        await prisma.videoTheme.updateMany({
          where: { siteId: store.siteId, slug: { in: obsolete.themeSlugs } },
          data: { status: "inactive" }
        });
      }

      const homePage = (state.sites ?? [])
        .find((site) => site.id === store.siteId)
        ?.pages?.find((page) => page.slug === "/");
      if (homePage) {
        await prisma.themePage.updateMany({
          where: { siteId: store.siteId, slug: "/" },
          data: {
            draftJson: homePage.draftJson,
            publishedJson: homePage.publishedJson
          }
        });
        report.pages += 1;
      }

      const stateThemes = (state.siteThemes ?? []).filter((theme) => theme.siteId === store.siteId);
      for (const theme of stateThemes) {
        await prisma.siteTheme.updateMany({
          where: { siteId: store.siteId, themeId: theme.themeId },
          data: { templates: theme.templates }
        });
        report.siteThemes += 1;
      }

      const latestPublication = (state.themePublications ?? [])
        .filter((publication) => publication.siteId === store.siteId)
        .sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0];
      if (latestPublication) {
        await prisma.themePublication.updateMany({
          where: { siteId: store.siteId, version: latestPublication.version },
          data: { snapshot: latestPublication.snapshot }
        });
        report.publications += 1;
      }
    }
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const stores = selectedShowcaseStores();
  if (!stores.length) throw new Error("no_showcase_store_selected");

  const state = await readState();
  const assetReport = [];
  if (!skipAssets) {
    for (const store of stores) {
      assetReport.push({ store: store.key, assets: await prepareShowcaseAssets(store, state) });
    }
  }

  const now = new Date().toISOString();
  for (const store of stores) {
    const categories = categoryRowsForStore(store, state, now);
    const themes = videoThemeRowsForStore(store, categories, state, now);
    state.videoThemeCategories = upsertRows(state.videoThemeCategories ?? [], categories, (row) => `${row.siteId}:${row.slug}`);
    state.videoThemes = upsertRows(state.videoThemes ?? [], themes, (row) => `${row.siteId}:${row.slug}`);
    deactivateObsoleteShowcaseRows(state, store);
  }

  const sectionReport = applyShowcaseToState(state, stores);
  if (!dryRun) {
    await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`);
  }

  const dbReport = updateDb && !dryRun ? await updateDatabase(state, stores) : undefined;
  console.log(JSON.stringify({
    ok: true,
    dryRun,
    contentOverwriteGuard: {
      writeEnabled: !dryRun,
      requiredFlag: "--force-content-overwrite",
      dbRequested: updateDb,
      dbWriteEnabled: updateDb && !dryRun,
      note: dryRun
        ? "No files or database rows were overwritten. Re-run with --force-content-overwrite to write data/platform-state.json, and add --db to write Postgres."
        : "Content overwrite was explicitly enabled for this run."
    },
    stores: stores.map((store) => store.key),
    assets: assetReport,
    sections: sectionReport,
    db: dbReport ?? "skipped"
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
