#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const repoRoot = process.cwd();
const galleryRoot = path.join(repoRoot, "public", "assets", "dreamshoot", "generated", "pack-galleries", "cannes");
const files = Array.from({ length: 12 }, (_, index) => path.join(galleryRoot, `cannes-${String(index + 1).padStart(2, "0")}.webp`));
const repairSource = fs.readFileSync(path.join(repoRoot, "scripts", "repair-mydreamshoots-detail-media-ownership.mjs"), "utf8");
const rendererSource = fs.readFileSync(path.join(repoRoot, "src", "components", "theme-renderer.tsx"), "utf8");
assert.ok(!repairSource.includes(".tint("), "media repair must not tint public images into monochrome");
assert.ok(rendererSource.includes("pair=20260830colorfix1"), "pack gallery URLs must use the color-fix cache version");

async function colorPixelRatio(filePath) {
  const { data, info } = await sharp(filePath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  let coloredPixels = 0;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset];
    const green = data[offset + 1];
    const blue = data[offset + 2];
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 12) coloredPixels += 1;
  }
  return coloredPixels / (info.width * info.height);
}

const spreads = [];
for (const filePath of files) {
  assert.ok(fs.existsSync(filePath), `missing Cannes gallery asset: ${filePath}`);
  spreads.push({ file: path.basename(filePath), colorPixelRatio: await colorPixelRatio(filePath) });
}

const grayscale = spreads.filter(({ colorPixelRatio }) => colorPixelRatio < 0.1);
assert.equal(grayscale.length, 0, "Cannes gallery assets must retain color channels");
console.log(JSON.stringify({ ok: true, checked: spreads.length, grayscale: 0, spreads }, null, 2));
