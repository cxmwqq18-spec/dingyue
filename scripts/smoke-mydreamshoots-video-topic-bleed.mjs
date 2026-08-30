#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const root = process.cwd();
const cleanRoot = path.join(root, "public/assets/dreamshoot/generated/video-topic-clean");
const legacyPattern = /\/assets\/dreamshoot\/(?:tiktok-video|instagram-reels|social-media-video|story-video)\//;
const topics = ["tiktok-video", "instagram-reels", "social-media-video", "story-video"];
const prisma = new PrismaClient();

try {
  const pages = await prisma.themePage.findMany({ where: { siteId, slug: { startsWith: "/ai-video-generation/" } }, select: { slug: true, draftJson: true } });
  const themes = await prisma.videoTheme.findMany({ where: { siteId, slug: { in: topics } }, select: { slug: true, imageUrl: true, galleryImages: true } });
  const references = [...pages.flatMap((page) => JSON.stringify(page.draftJson).match(/\/assets\/dreamshoot\/[^" ]+/g) ?? []), ...themes.flatMap((theme) => [theme.imageUrl, ...(theme.galleryImages ?? [])])];
  assert.equal(references.some((url) => legacyPattern.test(url)), false, "video topic pages and directory themes must not reference legacy blurred assets");

  const files = [];
  for (const topic of topics) {
    const directory = path.join(cleanRoot, topic);
    assert.equal(fs.existsSync(directory), true, `missing_clean_topic_directory:${topic}`);
    for (const file of fs.readdirSync(directory).filter((name) => name.endsWith(".webp"))) {
      const metadata = await sharp(path.join(directory, file)).metadata();
      assert.equal(`${metadata.width}x${metadata.height}`, "1600x900", `clean media must use a sharp 16:9 frame: ${topic}/${file}`);
      files.push(`${topic}/${file}`);
    }
  }
  assert.ok(files.length >= 35, `expected all legacy topic assets to have clean derivatives, found ${files.length}`);
  console.log(JSON.stringify({ ok: true, topics: topics.length, cleanMedia: files.length, legacyReferences: 0 }, null, 2));
} finally {
  await prisma.$disconnect();
}
