#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = "site_dreamshoot";
const apply = process.argv.includes("--apply");
const target = process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });
if (apply && target !== "local") throw new Error("video topic bleed repair is local-database only");

const root = process.cwd();
const assetRoot = path.join(root, "public/assets/dreamshoot");
const legacyTopics = ["tiktok-video", "instagram-reels", "social-media-video", "story-video"];
const compositeFrame = { left: 36, top: 582, width: 1008, height: 756 };
const generatedSocialHero = "generated/video-topic-media/social-media-video/social-media-video-01.webp";
const generatedCompositeFrame = { left: 14, top: 154, width: 1572, height: 892 };

function cleanPath(topic, baseName) {
  return path.join(assetRoot, "generated/video-topic-clean", topic, `${baseName}.webp`);
}

function cleanUrl(topic, baseName) {
  return `/assets/dreamshoot/generated/video-topic-clean/${topic}/${baseName}.webp`;
}

async function writeCleanAsset(sourcePath, outputPath, frame) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  await sharp(sourcePath)
    .extract(frame)
    .resize(1600, 900, { fit: "cover", position: "centre" })
    .webp({ quality: 92 })
    .toFile(outputPath);
}

function replaceUrls(value, replacements) {
  if (typeof value === "string") return replacements.get(value.split(/[?#]/, 1)[0]) ?? value;
  if (Array.isArray(value)) return value.map((item) => replaceUrls(item, replacements));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceUrls(item, replacements)]));
}

const replacements = new Map();
for (const topic of legacyTopics) {
  const sourceDir = path.join(assetRoot, topic);
  if (!fs.existsSync(sourceDir)) continue;
  for (const file of fs.readdirSync(sourceDir).filter((name) => /\.(?:png|jpe?g|webp)$/i.test(name))) {
    const baseName = file.replace(/\.[^.]+$/, "");
    const sourcePath = path.join(sourceDir, file);
    const outputPath = cleanPath(topic, baseName);
    if (apply) await writeCleanAsset(sourcePath, outputPath, compositeFrame);
    const url = cleanUrl(topic, baseName);
    replacements.set(`/assets/dreamshoot/${topic}/${file}`, url);
    replacements.set(`/assets/dreamshoot/${topic}/${baseName}.png`, url);
    replacements.set(`/assets/dreamshoot/${topic}/${baseName}.webp`, url);
  }
}
if (fs.existsSync(path.join(assetRoot, generatedSocialHero))) {
  if (apply) await writeCleanAsset(path.join(assetRoot, generatedSocialHero), cleanPath("social-media-video", "social-media-video-01"), generatedCompositeFrame);
  replacements.set(`/assets/dreamshoot/${generatedSocialHero}`, cleanUrl("social-media-video", "social-media-video-01"));
}

const prisma = new PrismaClient();
try {
  const pages = await prisma.themePage.findMany({ where: { siteId, slug: { startsWith: "/ai-video-generation/" } }, select: { id: true, slug: true, draftJson: true } });
  const themes = await prisma.videoTheme.findMany({ where: { siteId }, select: { id: true, slug: true, imageUrl: true, galleryImages: true } });
  const changes = [];
  for (const page of pages) {
    const nextDraft = replaceUrls(page.draftJson, replacements);
    if (JSON.stringify(nextDraft) === JSON.stringify(page.draftJson)) continue;
    changes.push({ type: "ThemePage", slug: page.slug });
    if (apply) await prisma.themePage.update({ where: { id: page.id }, data: { draftJson: nextDraft } });
  }
  for (const theme of themes) {
    const imageUrl = replacements.get(theme.imageUrl?.split(/[?#]/, 1)[0]) ?? theme.imageUrl;
    const galleryImages = (theme.galleryImages ?? []).map((url) => replacements.get(url.split(/[?#]/, 1)[0]) ?? url);
    if (imageUrl === theme.imageUrl && JSON.stringify(galleryImages) === JSON.stringify(theme.galleryImages ?? [])) continue;
    changes.push({ type: "VideoTheme", slug: theme.slug });
    if (apply) await prisma.videoTheme.update({ where: { id: theme.id }, data: { imageUrl, galleryImages } });
  }
  console.log(JSON.stringify({ ok: true, mode: apply ? "applied" : "dry-run", replacementCount: replacements.size, changes }, null, 2));
} finally {
  await prisma.$disconnect();
}
