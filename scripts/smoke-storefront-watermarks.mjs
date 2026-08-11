#!/usr/bin/env node
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import {
  STOREFRONT_WATERMARK_VERSION,
  readWatermarkMarker,
  watermarkMediaFile
} from "./lib/storefront-watermark.mjs";

const execFileAsync = promisify(execFile);
const repoRoot = process.cwd();
let sharpLoader;
const sharpImageExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function read(relativePath) {
  return fs.readFile(path.join(repoRoot, relativePath), "utf8");
}

async function runFfmpeg(args, options = {}) {
  assert(ffmpegPath, "ffmpeg-static should be available for storefront watermark smoke");
  await execFileAsync(ffmpegPath, args, { timeout: 60_000, maxBuffer: 1024 * 1024, ...options });
}

async function runFfmpegBuffer(args, options = {}) {
  assert(ffmpegPath, "ffmpeg-static should be available for storefront watermark smoke");
  const result = await execFileAsync(ffmpegPath, args, {
    encoding: "buffer",
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
    ...options
  });
  return Buffer.isBuffer(result.stdout) ? result.stdout : Buffer.from(result.stdout ?? "");
}

async function loadSharp() {
  if (process.env.STOREFRONT_WATERMARK_DISABLE_SHARP === "1") {
    sharpLoader = null;
    return sharpLoader;
  }
  if (sharpLoader !== undefined) return sharpLoader;
  try {
    const moduleName = "sharp";
    const mod = await import(moduleName);
    const sharp = mod.default ?? mod;
    sharp.cache(false);
    sharpLoader = sharp;
  } catch {
    sharpLoader = null;
  }
  return sharpLoader;
}

async function mediaDimensions(filePath) {
  const sharp = sharpImageExtensions.has(path.extname(filePath).toLowerCase()) ? await loadSharp() : null;
  if (sharp) {
    const metadata = await sharp(filePath).metadata();
    return { width: Number(metadata.width ?? 0), height: Number(metadata.height ?? 0) };
  }
  let output = "";
  try {
    await runFfmpeg(["-hide_banner", "-i", filePath]);
  } catch (error) {
    output = [
      typeof error.stdout === "string" ? error.stdout : "",
      typeof error.stderr === "string" ? error.stderr : ""
    ].join("\n");
  }
  const match = output.match(/Video:\s[^,\n]+(?:,[^,\n]+)*,\s*(\d{2,5})x(\d{2,5})[\s,]/);
  return { width: Number(match?.[1] ?? 0), height: Number(match?.[2] ?? 0) };
}

async function createSolidImage(filePath, { width, height, color }) {
  const sharp = await loadSharp();
  if (sharp) {
    await sharp({
      create: {
        width,
        height,
        channels: 3,
        background: color
      }
    }).png().toFile(filePath);
    return;
  }
  const ffmpegColor = String(color).replace(/^#/, "0x");
  await runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `color=c=${ffmpegColor}:s=${width}x${height}:d=1`,
    "-frames:v",
    "1",
    filePath
  ]);
}

async function cropAbsDiff(leftPath, rightPath, crop) {
  const sharp = await loadSharp();
  const left = sharp
    ? await sharp(leftPath).extract(crop).removeAlpha().raw().toBuffer()
    : await runFfmpegBuffer([
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      leftPath,
      "-vf",
      `crop=${crop.width}:${crop.height}:${crop.left}:${crop.top},format=rgb24`,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-"
    ], { maxBuffer: crop.width * crop.height * 3 + 1024 });
  const right = sharp
    ? await sharp(rightPath).extract(crop).removeAlpha().raw().toBuffer()
    : await runFfmpegBuffer([
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      rightPath,
      "-vf",
      `crop=${crop.width}:${crop.height}:${crop.left}:${crop.top},format=rgb24`,
      "-frames:v",
      "1",
      "-f",
      "rawvideo",
      "-"
    ], { maxBuffer: crop.width * crop.height * 3 + 1024 });
  assert(left.length === right.length, "comparison crops should have the same byte length");
  let sum = 0;
  for (let index = 0; index < left.length; index += 1) {
    sum += Math.abs(left[index] - right[index]);
  }
  return sum / left.length;
}

async function smokeImageWatermark(tempDir) {
  const original = path.join(tempDir, "image-original.png");
  const watermarked = path.join(tempDir, "image-watermarked.png");
  await createSolidImage(original, { width: 640, height: 480, color: "#182235" });
  await fs.copyFile(original, watermarked);

  const result = await watermarkMediaFile(watermarked, "myDreamshoots.com", { force: true });
  const originalMeta = await mediaDimensions(original);
  const watermarkedMeta = await mediaDimensions(watermarked);
  assert(result.changed, "image watermark should modify the file");
  assert(originalMeta.width === watermarkedMeta.width && originalMeta.height === watermarkedMeta.height, "image watermark should keep dimensions unchanged");
  const diff = await cropAbsDiff(original, watermarked, { left: 430, top: 440, width: 190, height: 30 });
  assert(diff > 0.2, `image subtle watermark should change the bottom-right pixels, diff=${diff.toFixed(2)}`);
  const second = await watermarkMediaFile(watermarked, "myDreamshoots.com");
  assert(second.skipped, "current image watermark marker should prevent repeated overlays");
  const marker = readWatermarkMarker(watermarked);
  assert(marker?.version === STOREFRONT_WATERMARK_VERSION && marker.text === "myDreamshoots.com" && marker.opacity === 0.3, "image watermark marker should record version, text, and opacity");
}

async function smokeVideoWatermark(tempDir) {
  const original = path.join(tempDir, "video-original.mp4");
  const watermarked = path.join(tempDir, "video-watermarked.mp4");
  const originalFrame = path.join(tempDir, "video-original-frame.jpg");
  const watermarkedFrame = path.join(tempDir, "video-watermarked-frame.jpg");
  await runFfmpeg([
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    "color=c=0x223344:s=320x240:d=1:r=12",
    "-an",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    original
  ]);
  await fs.copyFile(original, watermarked);
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-ss", "0.1", "-i", original, "-frames:v", "1", "-q:v", "3", originalFrame]);
  const result = await watermarkMediaFile(watermarked, "Aidreamcapes.com", { force: true });
  assert(result.changed, "video watermark should modify the file");
  const dimensions = await mediaDimensions(watermarked);
  assert(dimensions.width === 320 && dimensions.height === 240, `video watermark should keep dimensions unchanged, got ${dimensions.width}x${dimensions.height}`);
  await runFfmpeg(["-hide_banner", "-loglevel", "error", "-y", "-ss", "0.1", "-i", watermarked, "-frames:v", "1", "-q:v", "3", watermarkedFrame]);
  const diff = await cropAbsDiff(originalFrame, watermarkedFrame, { left: 185, top: 210, width: 125, height: 22 });
  assert(diff > 0.2, `video subtle watermark should change the bottom-right pixels, diff=${diff.toFixed(2)}`);
  const second = await watermarkMediaFile(watermarked, "Aidreamcapes.com");
  assert(second.skipped, "current video watermark marker should prevent repeated overlays");
  const marker = readWatermarkMarker(watermarked);
  assert(marker?.version === STOREFRONT_WATERMARK_VERSION && marker.text === "Aidreamcapes.com" && marker.opacity === 0.3, "video watermark marker should record version, text, and opacity");
}

async function smokeRouteContracts() {
  const customerAssetStorage = await read("src/lib/customer-asset-storage.ts");
  assert(!customerAssetStorage.includes("ensureCustomerOutputAssetWatermark"), "customer asset reads should no longer auto-watermark output assets");
  assert(customerAssetStorage.includes("writeCustomerAssetFileShared("), "customer asset shared writes should still support uploads and generated outputs");

  const assetStore = await read("src/lib/stores/asset-store.ts");
  assert(assetStore.includes('asset.role === "output"') && assetStore.includes("download?preview=1"), "output previews should route through the customer download endpoint");
  assert(assetStore.includes("`/api/local-assets/${storageKey}`"), "source/input previews should still use local asset previews");

  const downloadRoute = await read("src/app/api/sites/[siteId]/customers/[customerId]/assets/[assetId]/download/route.ts");
  assert(downloadRoute.includes('searchParams.get("preview") === "1"'), "download route should support inline preview");
  assert(downloadRoute.includes('searchParams.get("poster") === "1"'), "download route should support video posters");
  assert(downloadRoute.includes('"Accept-Ranges"'), "download route should support video byte ranges");
  assert(downloadRoute.includes("generateVideoPosterBytes"), "download route should use the clean video poster helper");
  assert(!downloadRoute.includes("ensureCustomerOutputAssetWatermark"), "download route should not auto-watermark customer assets");

  const localAssetsRoute = await read("src/app/api/local-assets/[...path]/route.ts");
  assert(!localAssetsRoute.includes("ensureCustomerOutputAssetWatermark"), "direct local asset access should not auto-upgrade to watermarked media");

  const publicWatermark = await read("src/lib/storefront-public-media-watermark.ts");
  assert(publicWatermark.includes("batchWatermarkSitePublicMedia"), "public media batch watermark helper should exist");
  assert(publicWatermark.includes("site_dreamshoot"), "public media plans should cover MyDreamShoots");
  assert(publicWatermark.includes("site_aidreamcapes"), "public media plans should cover AIdreamcapes");
  assert(publicWatermark.includes("public/assets/dreamshoot"), "public media batch should target MyDreamShoots public assets");
  assert(publicWatermark.includes("public/assets/sites/site_aidreamcapes"), "public media batch should target AIdreamcapes public assets");

  const storefrontWatermarkScript = await read("scripts/lib/storefront-watermark.mjs");
  assert(storefrontWatermarkScript.includes("/public/assets/sites/site_aidreamcapes_eu/"), "CLI watermark helper should cover Aidreamcapes EU public assets");
  assert(storefrontWatermarkScript.includes("/public/assets/sites/site_mydreamshoots_xby/"), "CLI watermark helper should cover AIdreamshoots EU public assets");

  const storefrontBatchScript = await read("scripts/apply-storefront-watermarks.mjs");
  assert(storefrontBatchScript.includes("public/assets/sites/site_aidreamcapes/fan-holiday-theme"), "CLI batch should include Aidreamcapes theme assets");
  assert(storefrontBatchScript.includes("public/assets/sites/site_aidreamshoots"), "CLI batch should include AIdreamshoots public assets");

  const storefrontWatermarkUrl = await read("src/lib/storefront-public-watermark-url.ts");
  assert(storefrontWatermarkUrl.includes("20260811watermark30sync2"), "shared public watermark URL helper should use the current cache-buster");
  assert(storefrontWatermarkUrl.includes("params.set(\"wm\""), "shared public watermark URL helper should append the wm query");

  const jobCreateForm = await read("src/components/app/job-create-form.tsx");
  assert(jobCreateForm.includes("withStorefrontPublicWatermarkUrl(selectedPack?.imageUrl)"), "workspace selected package image should use the public watermark URL helper");
  assert(jobCreateForm.includes("withStorefrontPublicWatermarkUrl(pack.imageUrl)"), "workspace package cards should use the public watermark URL helper");

  const siteStore = await read("src/lib/stores/site-store.ts");
  assert(siteStore.includes("watermarkedCreativePackForWorkspace") && siteStore.includes("navigationData.creativePacks.map(watermarkedCreativePackForWorkspace)"), "workspace bootstrap should watermark creative pack media URLs");
  assert(siteStore.includes("watermarkedVideoThemeForWorkspace") && siteStore.includes("videoThemes.map(watermarkedVideoThemeForWorkspace)"), "workspace bootstrap should watermark video theme media URLs");

  const adminRoute = await read("src/app/api/sites/[siteId]/admin/media-watermark/route.ts");
  assert(adminRoute.includes("batchWatermarkSitePublicMedia"), "admin media watermark route should call the batch helper");
  assert(adminRoute.includes("requireSiteMutation"), "admin media watermark route should require a site mutation guard");

  const themeMediaPanel = await read("src/components/admin/theme-media-panel.tsx");
  assert(themeMediaPanel.includes("/admin/media-watermark"), "theme media panel should expose the refresh action");
  assert(themeMediaPanel.includes("刷新展示水印"), "theme media panel should label the public watermark refresh action");

  const mediaWatermark = await read("src/lib/media-watermark.ts");
  assert(mediaWatermark.includes("accessSync") && mediaWatermark.includes('path.join(process.cwd(), "node_modules", "ffmpeg-static"'), "media watermark ffmpeg lookup should survive Next route vendor chunk rewrites");
  assert(mediaWatermark.includes("Next can rewrite ffmpeg-static"), "media watermark lookup should document the Next vendor chunk fallback");

  const workspaceShell = await read("src/components/storefront/customer-workspace-shell.tsx");
  assert(!workspaceShell.includes('if (asset.role === "output" && asset.storageKey)'), "workspace output previews should not be forced back to raw local storage URLs");
}

async function main() {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "storefront-watermark-smoke-"));
  try {
    await smokeImageWatermark(tempDir);
    await smokeVideoWatermark(tempDir);
    await smokeRouteContracts();
    console.log(JSON.stringify({ ok: true, tempDir }, null, 2));
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
