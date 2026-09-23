#!/usr/bin/env node

// Local-only, narrowly scoped restoration of the original How it works videos
// for the French and Spanish storefronts. This script updates only the videoUrl
// field of the named tutorial sections on the homepage and /workflow pages.
// It makes no provider calls, changes no layout or copy, and never writes a
// remote database. French tutorial files are copied into the French namespace;
// they must not be symlinks to another storefront's asset.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, assertNonProductionWriteTarget, buildTunneledDatabaseUrl } from "./lib/database-target.mjs";

const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const LOCAL_CONFIRMATION = "--confirm=restore-how-it-works-tutorial-videos-local";
const PRODUCTION_CONFIRMATION = "--confirm=restore-how-it-works-tutorial-videos-production";
const REPORT_ROOT = path.resolve(".tmp", "how-it-works-tutorial-video-restore");
const databaseUrl = target === "production"
  ? buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 })
  : process.env.DATABASE_URL;

const FRENCH_IMAGE_TUTORIAL = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-20260814.mp4";
const FRENCH_VIDEO_TUTORIAL = "/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-video-tutorial-20260814.mp4";
const SPANISH_IMAGE_TUTORIAL = "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/videos/AIdreamshoots-ai-image-tutorial-20260814.mp4";
const SPANISH_VIDEO_TUTORIAL = "/assets/sites/site_aidreamshoots/visuals/generated/homepage-showcase/videos/AIdreamshoots-ai-video-tutorial-20260814.mp4";

const FRENCH_ASSET_SOURCE = {
  [FRENCH_IMAGE_TUTORIAL]: "public/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-image-tutorial-20260814.mp4",
  [FRENCH_VIDEO_TUTORIAL]: "public/assets/sites/site_aidreamcapes_eu/mirror/aidreamcapes/dreamshoot/generated/homepage-showcase/videos/aidreamcapes-ai-video-tutorial-20260814.mp4"
};

const TARGETS = [
  {
    siteId: "site_aidreamcapes_xby",
    storefront: "French",
    slug: "/",
    videos: { tutorial_video_1: FRENCH_IMAGE_TUTORIAL }
  },
  {
    siteId: "site_aidreamcapes_xby",
    storefront: "French",
    slug: "/workflow",
    videos: {
      tutorial_video_1: FRENCH_IMAGE_TUTORIAL,
      tutorial_image_video_1: FRENCH_VIDEO_TUTORIAL
    }
  },
  {
    siteId: "site_mydreamshoots_xby",
    storefront: "Spanish",
    slug: "/",
    videos: { tutorial_video_1: SPANISH_IMAGE_TUTORIAL }
  },
  {
    siteId: "site_mydreamshoots_xby",
    storefront: "Spanish",
    slug: "/workflow",
    videos: {
      tutorial_video_1: SPANISH_IMAGE_TUTORIAL,
      tutorial_image_video_1: SPANISH_VIDEO_TUTORIAL
    }
  }
];

const apply = process.argv.includes("--apply") || process.argv.includes("--apply-local");
if (target === "local") {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) {
    assertNonProductionWriteTarget();
    if (!process.argv.includes(LOCAL_CONFIRMATION)) throw new Error(`Refusing to apply without ${LOCAL_CONFIRMATION}`);
  }
} else if (target === "production") {
  assertDatabaseTarget({
    expectedTarget: "production",
    env: { ...process.env, DATABASE_URL: databaseUrl },
    requireProductionConfirmation: apply,
    productionConfirmed: process.argv.includes(PRODUCTION_CONFIRMATION)
  });
  if (apply && !process.argv.includes(PRODUCTION_CONFIRMATION)) throw new Error(`Refusing to apply without ${PRODUCTION_CONFIRMATION}`);
} else {
  throw new Error(`Unsupported target ${target}; use --target=local or --target=production.`);
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function patchVideos(contentJson, videos, label) {
  const next = clone(contentJson);
  if (!next || typeof next !== "object") throw new Error(`Missing content JSON for ${label}`);
  if (!next.sections || typeof next.sections !== "object") throw new Error(`Missing sections for ${label}`);

  for (const [sectionId, videoUrl] of Object.entries(videos)) {
    const section = next.sections[sectionId];
    if (!section || typeof section !== "object") throw new Error(`Missing ${sectionId} for ${label}`);
    section.settings = { ...(section.settings ?? {}), videoUrl };
  }
  return next;
}

function getVideo(contentJson, sectionId) {
  return contentJson?.sections?.[sectionId]?.settings?.videoUrl ?? null;
}

function fileHash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function assetState(videoUrl) {
  const sourceRelative = FRENCH_ASSET_SOURCE[videoUrl];
  if (!sourceRelative) return null;

  const sourcePath = path.resolve(sourceRelative);
  const targetPath = path.resolve("public", videoUrl.replace(/^\/assets\//, "assets/"));
  const sourceExists = fs.existsSync(sourcePath);
  let targetStat = null;
  try {
    targetStat = fs.lstatSync(targetPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  const targetExists = Boolean(targetStat);
  const targetKind = targetStat?.isSymbolicLink() ? "symlink" : targetStat ? "file" : null;
  let targetRealPath = null;
  if (targetKind === "symlink") targetRealPath = fs.realpathSync(targetPath);
  const sourceHash = sourceExists ? fileHash(sourcePath) : null;
  const targetHash = targetKind === "file" ? fileHash(targetPath) : null;
  return {
    videoUrl,
    source: sourcePath,
    target: targetPath,
    sourceExists,
    targetExists,
    targetKind,
    targetRealPath,
    sourceHash,
    targetHash,
    targetMatchesSource: targetKind === "file" && targetHash === sourceHash
  };
}

function ensureFrenchAsset(videoUrl) {
  const state = assetState(videoUrl);
  if (!state || !state.sourceExists) throw new Error(`Missing source asset for ${videoUrl}`);
  if (state.targetKind === "file") {
    if (!state.targetMatchesSource) throw new Error(`Existing French tutorial asset does not match source: ${state.target}`);
    return { ...state, action: "kept" };
  }

  fs.mkdirSync(path.dirname(state.target), { recursive: true });
  if (state.targetKind && state.targetKind !== "symlink") throw new Error(`Unsupported existing French tutorial asset: ${state.target}`);
  const tempTarget = `${state.target}.tmp-${process.pid}-${Date.now()}`;
  try {
    fs.copyFileSync(state.source, tempTarget);
    fs.renameSync(tempTarget, state.target);
  } finally {
    if (fs.existsSync(tempTarget)) fs.unlinkSync(tempTarget);
  }
  return { ...assetState(videoUrl), action: state.targetKind === "symlink" ? "copied-over-symlink" : "copied" };
}

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
try {
  const pageRows = await Promise.all(TARGETS.map(async (target) => {
    const [live, theme] = await Promise.all([
      prisma.livePage.findUnique({ where: { siteId_slug: { siteId: target.siteId, slug: target.slug } } }),
      prisma.themePage.findUnique({ where: { siteId_slug: { siteId: target.siteId, slug: target.slug } } })
    ]);
    if (!live && !theme) throw new Error(`Missing ${target.siteId}:${target.slug}`);

    const nextLive = live ? patchVideos(live.contentJson, target.videos, `${target.siteId}:${target.slug}:LivePage`) : null;
    const nextDraft = theme ? patchVideos(theme.draftJson, target.videos, `${target.siteId}:${target.slug}:ThemePage.draftJson`) : null;
    const nextPublished = theme ? patchVideos(theme.publishedJson, target.videos, `${target.siteId}:${target.slug}:ThemePage.publishedJson`) : null;
    return { target, live, theme, nextLive, nextDraft, nextPublished };
  }));

  const changes = pageRows.flatMap(({ target, live, theme, nextLive, nextDraft, nextPublished }) => [
    ...(live && JSON.stringify(live.contentJson) !== JSON.stringify(nextLive) ? [{ model: "LivePage", storefront: target.storefront, siteId: target.siteId, slug: target.slug }] : []),
    ...(theme && JSON.stringify(theme.draftJson) !== JSON.stringify(nextDraft) ? [{ model: "ThemePage.draftJson", storefront: target.storefront, siteId: target.siteId, slug: target.slug }] : []),
    ...(theme && JSON.stringify(theme.publishedJson) !== JSON.stringify(nextPublished) ? [{ model: "ThemePage.publishedJson", storefront: target.storefront, siteId: target.siteId, slug: target.slug }] : [])
  ]);

  const frenchVideos = [...new Set(TARGETS.filter((target) => target.siteId === "site_aidreamcapes_xby").flatMap((target) => Object.values(target.videos)))];
  const assets = frenchVideos.map(assetState);
  for (const asset of assets) {
    if (!asset.sourceExists) throw new Error(`Missing source asset: ${asset.source}`);
  }

  const report = {
    ok: true,
    mode: apply ? `apply-${target}` : "dry-run",
    target,
    scope: TARGETS.map(({ siteId, slug, videos }) => ({ siteId, slug, videos })),
    changes,
    assets,
    providerCalls: 0,
    oldResourcesDeleted: 0,
    backup: null
  };

  if (apply) {
    const assetResults = target === "local"
      ? frenchVideos.map(ensureFrenchAsset)
      : assets.map((asset) => {
          if (!asset.targetExists || asset.targetKind !== "file" || !asset.targetMatchesSource) {
            throw new Error(`Production release requires dedicated French tutorial assets in the local release: ${asset.target}`);
          }
          return { ...asset, action: "verified" };
        });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupPath = path.join(REPORT_ROOT, `backup-${stamp}.json`);
    writeJson(backupPath, {
      livePages: pageRows.filter(({ live }) => live).map(({ live }) => ({ id: live.id, siteId: live.siteId, slug: live.slug, contentJson: live.contentJson })),
      themePages: pageRows.filter(({ theme }) => theme).map(({ theme }) => ({ id: theme.id, siteId: theme.siteId, slug: theme.slug, draftJson: theme.draftJson, publishedJson: theme.publishedJson }))
    });
    report.backup = backupPath;
    report.assets = assetResults;

    await prisma.$transaction(async (tx) => {
      for (const { live, theme, nextLive, nextDraft, nextPublished } of pageRows) {
        if (live) await tx.livePage.update({ where: { id: live.id }, data: { contentJson: nextLive } });
        if (theme) await tx.themePage.update({ where: { id: theme.id }, data: { draftJson: nextDraft, publishedJson: nextPublished } });
      }
    });
  }

  const readback = await Promise.all(TARGETS.map(async (target) => {
    const pageRow = pageRows.find(({ target: rowTarget }) => rowTarget.siteId === target.siteId && rowTarget.slug === target.slug);
    const [live, theme] = apply
      ? await Promise.all([
          prisma.livePage.findUnique({ where: { siteId_slug: { siteId: target.siteId, slug: target.slug } } }),
          prisma.themePage.findUnique({ where: { siteId_slug: { siteId: target.siteId, slug: target.slug } } })
        ])
      : [
          pageRow?.nextLive ? { contentJson: pageRow.nextLive } : null,
          pageRow?.nextDraft ? { draftJson: pageRow.nextDraft, publishedJson: pageRow.nextPublished } : null
        ];
    const values = [
      ...(live ? [{ source: "LivePage", videos: Object.fromEntries(Object.keys(target.videos).map((sectionId) => [sectionId, getVideo(live.contentJson, sectionId)])) }] : []),
      ...(theme ? [{ source: "ThemePage.draftJson", videos: Object.fromEntries(Object.keys(target.videos).map((sectionId) => [sectionId, getVideo(theme.draftJson, sectionId)])) }, { source: "ThemePage.publishedJson", videos: Object.fromEntries(Object.keys(target.videos).map((sectionId) => [sectionId, getVideo(theme.publishedJson, sectionId)])) }] : [])
    ];
    for (const row of values) {
      for (const [sectionId, expected] of Object.entries(target.videos)) {
        if (row.videos[sectionId] !== expected) throw new Error(`Readback mismatch for ${target.siteId}:${target.slug}:${row.source}:${sectionId}`);
      }
    }
    return { siteId: target.siteId, slug: target.slug, values };
  }));

  report.readback = readback;
  const reportPath = path.join(REPORT_ROOT, `report-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeJson(reportPath, report);
  console.log(JSON.stringify({ ...report, report: reportPath }, null, 2));
} finally {
  await prisma.$disconnect();
}
