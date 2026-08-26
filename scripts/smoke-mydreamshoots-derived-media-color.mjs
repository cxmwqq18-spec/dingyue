#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";

const siteId = "site_dreamshoot";
const repoRoot = process.cwd();
const assetRoot = path.join(repoRoot, "public", "assets", "dreamshoot");
const prisma = new PrismaClient();

function localAssetPath(url) {
  const pathname = String(url ?? "").split(/[?#]/, 1)[0];
  if (!pathname.startsWith("/assets/dreamshoot/")) return "";
  return path.join(assetRoot, pathname.replace("/assets/dreamshoot/", ""));
}

function sourceFiles(slug) {
  const directory = path.join(assetRoot, slug);
  const seenBaseNames = new Set();
  return fs.readdirSync(directory)
    .filter((file) => /\.(?:png|jpe?g|webp)$/i.test(file))
    .sort()
    .filter((file) => {
      const baseName = file.replace(/\.[^.]+$/, "");
      if (seenBaseNames.has(baseName)) return false;
      seenBaseNames.add(baseName);
      return true;
    })
    .map((file) => path.join(directory, file));
}

async function channelSpread(filePath) {
  const stats = await sharp(filePath).stats();
  const means = stats.channels.slice(0, 3).map((channel) => channel.mean);
  return Math.max(...means) - Math.min(...means);
}

try {
  const repairSource = fs.readFileSync(path.join(repoRoot, "scripts", "repair-mydreamshoots-detail-media-ownership.mjs"), "utf8");
  const landingSource = fs.readFileSync(path.join(repoRoot, "src", "components", "storefront", "video-topic-landing.tsx"), "utf8");
  const directorySource = fs.readFileSync(path.join(repoRoot, "src", "components", "theme-renderer.tsx"), "utf8");
  assert.ok(repairSource.includes('fit: "contain"'), "derived media must preserve each source frame");
  assert.ok(!repairSource.includes('fit: "cover"'), "derived media must not crop source frames");
  assert.ok(!repairSource.includes(".tint("), "derived media must not tint images into monochrome");
  assert.ok(repairSource.includes("function embeddedFrameBounds"), "embedded sharp frames must be extracted from legacy blurred canvases");
  assert.ok(!landingSource.includes("object-cover"), "video topic media must not crop images in the browser");
  assert.ok(!landingSource.includes("portraitCropClass"), "video topic media must not apply an extra portrait crop");
  assert.ok(directorySource.includes('data-video-theme-card-image>'), "video theme directory must expose media frames for verification");
  assert.ok(!directorySource.includes('scale-[1.42] object-cover object-center transition duration-500 group-hover/theme:scale-[1.5]'), "video theme directory must not crop or zoom media");

  const themes = await prisma.videoTheme.findMany({
    where: { siteId, status: "active", imageUrl: { startsWith: "/assets/dreamshoot/generated/video-topic-media/" } },
    select: { slug: true, imageUrl: true, galleryImages: true }
  });
  const failures = [];
  let checked = 0;

  for (const theme of themes) {
    const source = sourceFiles(theme.slug);
    const outputUrls = [theme.imageUrl, ...(theme.galleryImages ?? [])].filter(Boolean);
    for (const [index, outputUrl] of outputUrls.entries()) {
      const outputPath = localAssetPath(outputUrl);
      const sourcePath = source[index];
      assert.ok(outputPath && fs.existsSync(outputPath), `missing_derived_media:${theme.slug}:${outputUrl}`);
      assert.ok(sourcePath && fs.existsSync(sourcePath), `missing_source_media:${theme.slug}:${index}`);
      const [sourceSpread, outputSpread] = await Promise.all([channelSpread(sourcePath), channelSpread(outputPath)]);
      checked += 1;
      if (sourceSpread >= 30 && outputSpread < 8) {
        failures.push(`${theme.slug}:${index + 1}:source=${sourceSpread.toFixed(1)}:output=${outputSpread.toFixed(1)}`);
      }
    }
  }

  assert.equal(failures.length, 0, "color source media must not be converted to grayscale derived output", { failures });
  console.log(JSON.stringify({ ok: true, siteId, themes: themes.length, checked, grayscaleRegressions: 0 }, null, 2));
} finally {
  await prisma.$disconnect();
}
