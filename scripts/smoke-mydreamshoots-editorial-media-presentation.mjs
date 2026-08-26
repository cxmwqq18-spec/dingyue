#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const outputPath = path.join("/tmp", `mydreamshoots-editorial-media-${process.pid}.json`);

function channelSpread(filePath) {
  return sharp(filePath).stats().then((stats) => {
    const means = stats.channels.slice(0, 3).map((channel) => channel.mean);
    return Math.max(...means) - Math.min(...means);
  });
}

try {
  const renderer = fs.readFileSync(path.join(repoRoot, "src/components/theme-renderer.tsx"), "utf8");
  const preview = fs.readFileSync(path.join(repoRoot, "src/components/storefront/dreamshoot-showcase-preview.tsx"), "utf8");
  const videoTopicLanding = fs.readFileSync(path.join(repoRoot, "src/components/storefront/video-topic-landing.tsx"), "utf8");
  const editorialImageRenderer = renderer.match(/const imageFor = \(source:[\s\S]*?\n    };\n    const textBlock/)?.[0] || "";

  assert.match(editorialImageRenderer, /object-contain/, "standard editorial media must preserve the source frame");
  assert.doesNotMatch(editorialImageRenderer, /object-cover/, "standard editorial media must not crop the source frame");
  assert.match(preview, /^"use client";/, "preview behavior must run in the browser");
  assert.match(preview, /data-dreamshoot-preview-root/, "preview must scope nested media sections");
  assert.match(preview, /role="dialog"/, "preview must expose an accessible dialog");
  assert.match(preview, /object-contain/, "preview must render the complete source image");
  assert.match(videoTopicLanding, /import \{ DreamshootShowcasePreview \}/, "video topic pages must use the shared media preview");
  assert.match(videoTopicLanding, /<DreamshootShowcasePreview>[\s\S]*?<VideoTopicLanding/, "video topic images must be inside the shared preview scope");
  assert.match(renderer, /<DreamshootShowcasePreview className="contents">[\s\S]*?data-video-theme-card-image/, "video directory images must use the shared preview scope");

  execFileSync(process.execPath, ["scripts/sync-seasonal-theme-pages.mjs"], {
    cwd: repoRoot,
    env: { ...process.env, SEASONAL_BUILD_ONLY: "1", SEASONAL_BUILD_OUTPUT: outputPath, SEASONAL_KEYS: "wedding-ceremony" },
    stdio: "pipe"
  });
  const build = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  const page = build.pages[0]?.pageJson;
  const hero = page?.sections?.wedding_ceremony_hero;
  assert.ok(hero, "wedding ceremony editorial hero is required");
  assert.match(hero.settings.imageUrl, /hero-ai-wedding-ceremony-recessional\.jpg$/, "wedding hero must start with the color recessional image");
  assert.equal(page.seo.ogImage, hero.settings.imageUrl, "OG image must match the published wedding hero");
  assert.deepEqual(
    hero.blocks.map((block) => path.basename(block.settings.imageUrl)),
    ["hero-ai-wedding-ceremony-recessional.jpg", "wedding-ceremony-church-atmosphere.jpg", "wedding-ceremony-ring-exchange.jpg"],
    "wedding hero collage must use only color-qualified imagery"
  );
  const spreads = await Promise.all(hero.blocks.map((block) => channelSpread(path.join(repoRoot, "public", block.settings.imageUrl))));
  assert.ok(spreads.every((spread) => spread >= 20), `wedding hero images must not be grayscale: ${spreads.map((spread) => spread.toFixed(1)).join(", ")}`);
  console.log(JSON.stringify({ ok: true, hero: hero.settings.imageUrl, colorSpreads: spreads.map((spread) => Number(spread.toFixed(1))) }, null, 2));
} finally {
  fs.rmSync(outputPath, { force: true });
}
