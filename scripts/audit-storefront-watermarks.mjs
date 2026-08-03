#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  DEFAULT_STOREFRONT_WATERMARK_OPACITY,
  STOREFRONT_WATERMARK_VERSION,
  readWatermarkMarker,
  watermarkTextForPublicPath
} from "./lib/storefront-watermark.mjs";

const rawArgs = process.argv.slice(2);
const args = new Map();
const flags = new Set();

for (let index = 0; index < rawArgs.length; index += 1) {
  const raw = rawArgs[index];
  if (!raw.startsWith("--")) continue;
  const [key, ...rest] = raw.slice(2).split("=");
  if (rest.length) {
    args.set(key, rest.join("="));
    continue;
  }
  const next = rawArgs[index + 1];
  if (next && !next.startsWith("--")) {
    args.set(key, next);
    index += 1;
  } else {
    flags.add(key);
  }
}

const repoRoot = path.resolve(String(args.get("root") ?? process.cwd()));
const diskOnly = flags.has("disk-only");
const liveOnly = flags.has("live-only");
const maxPages = Math.max(1, Number(args.get("max-pages") ?? 80));
const outputPath = String(args.get("output") ?? "").trim();
const expectedWatermark = {
  version: STOREFRONT_WATERMARK_VERSION,
  opacity: DEFAULT_STOREFRONT_WATERMARK_OPACITY
};
const mediaExtensions = new Set([".avif", ".jpeg", ".jpg", ".png", ".webp", ".m4v", ".mov", ".mp4", ".webm"]);
const diskRoots = [
  "public/assets/dreamshoot",
  "public/assets/sites/site_aidreamcapes",
  "public/assets/sites/site_aidreamcapes_eu",
  "public/assets/sites/site_aidreamcapes_xby",
  "public/assets/sites/site_aidreamshoots",
  "public/assets/sites/site_mydreamshoots_xby"
];
const liveStores = [
  { id: "mydreamshoots", origin: "https://www.mydreamshoots.com" },
  { id: "aidreamcapes", origin: "https://www.aidreamcapes.com" }
];

function isMediaFile(filePath) {
  return mediaExtensions.has(path.extname(filePath).toLowerCase());
}

function relativePath(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function isBrandAsset(filePath) {
  return filePath.replaceAll("\\", "/").includes("/brand/");
}

async function walk(root) {
  const result = [];
  const stat = await fs.stat(root).catch(() => null);
  if (!stat) return result;
  if (stat.isFile()) return isMediaFile(root) ? [root] : [];

  async function visit(current) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const filePath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await visit(filePath);
      } else if (entry.isFile() && isMediaFile(filePath) && !isBrandAsset(filePath)) {
        result.push(filePath);
      }
    }
  }

  await visit(root);
  return result;
}

async function auditDisk() {
  const files = [];
  for (const root of diskRoots) {
    files.push(...await walk(path.join(repoRoot, root)));
  }

  const issues = [];
  const byType = { image: 0, video: 0 };
  for (const filePath of files.sort()) {
    const ext = path.extname(filePath).toLowerCase();
    const type = mediaExtensions.has(ext) && [".m4v", ".mov", ".mp4", ".webm"].includes(ext) ? "video" : "image";
    byType[type] += 1;
    const expectedText = watermarkTextForPublicPath(filePath);
    const marker = readWatermarkMarker(filePath);
    const reasons = [];
    if (!expectedText) reasons.push("unmapped_storefront_path");
    if (!marker) {
      reasons.push("missing_marker");
    } else {
      if (marker.version !== expectedWatermark.version) reasons.push(`version:${marker.version}`);
      if (marker.text !== expectedText) reasons.push(`text:${marker.text}`);
      if (marker.opacity !== expectedWatermark.opacity) reasons.push(`opacity:${marker.opacity}`);
    }
    if (reasons.length) {
      issues.push({
        file: relativePath(filePath),
        type,
        expectedText,
        marker,
        reasons
      });
    }
  }

  return {
    scope: "disk",
    root: repoRoot,
    discovered: files.length,
    byType,
    expectedWatermark,
    issueCount: issues.length,
    issues
  };
}

function parseSitemapLocations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((match) => match[1].trim()).filter(Boolean);
}

async function livePageCandidates(origin) {
  const candidates = new Set([`${origin}/`, `${origin}/collections`]);
  try {
    const response = await fetch(`${origin}/sitemap.xml`);
    if (!response.ok) return [...candidates];
    const locations = parseSitemapLocations(await response.text());
    for (const location of locations) {
      const url = new URL(location);
      if (url.origin !== origin) continue;
      if (url.pathname.startsWith("/collections/")) candidates.add(url.href);
      if (candidates.size >= maxPages) break;
    }
  } catch {
    return [...candidates];
  }
  return [...candidates].slice(0, maxPages);
}

function unwrapMediaUrl(rawValue, pageUrl) {
  if (!rawValue) return null;
  try {
    const url = new URL(rawValue, pageUrl);
    if (url.pathname === "/_next/image") {
      const nested = url.searchParams.get("url");
      if (nested) return new URL(nested, pageUrl);
    }
    return url;
  } catch {
    return null;
  }
}

function isPublicMediaUrl(url) {
  return url.pathname.startsWith("/assets/") && !url.pathname.includes("/brand/");
}

async function collectLiveMedia(page, pageUrl, errors) {
  const refs = await page.evaluate(() => {
    const result = [];
    for (const img of Array.from(document.images)) {
      result.push({ kind: "image", src: img.currentSrc || img.src || "" });
    }
    for (const video of Array.from(document.querySelectorAll("video"))) {
      result.push({
        kind: "video",
        src: video.currentSrc || video.src || "",
        poster: video.poster || video.getAttribute("poster") || "",
        readyState: video.readyState,
        paused: video.paused,
        width: video.videoWidth,
        height: video.videoHeight
      });
      for (const source of Array.from(video.querySelectorAll("source"))) {
        result.push({ kind: "video-source", src: source.getAttribute("src") || "" });
      }
    }
    return result;
  });

  return refs.flatMap((ref) => {
    const candidates = [{ kind: ref.kind, src: ref.src }];
    if (ref.poster) candidates.push({ kind: "video-poster", src: ref.poster });
    return candidates.map((candidate) => {
      const url = unwrapMediaUrl(candidate.src, pageUrl);
      if (!url || !isPublicMediaUrl(url)) return null;
      const entry = {
        kind: candidate.kind,
        url: url.href,
        path: url.pathname,
        wm: url.searchParams.get("wm"),
        readyState: ref.readyState,
        paused: ref.paused,
        width: ref.width,
        height: ref.height
      };
      if (candidate.kind.startsWith("video") && !candidate.src) {
        errors.push({ page: pageUrl, kind: candidate.kind, reason: "missing_media_source" });
      }
      return entry;
    }).filter(Boolean);
  });
}

async function auditLive() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  const report = {
    scope: "live",
    expectedWatermark,
    stores: [],
    issueCount: 0,
    issues: []
  };

  try {
    for (const store of liveStores) {
      const pageCandidates = await livePageCandidates(store.origin);
      const storeReport = {
        id: store.id,
        pagesDiscovered: pageCandidates.length,
        pagesScanned: 0,
        mediaReferences: 0,
        uniqueMedia: 0,
        videos: 0,
        playableVideos: 0,
        missingWatermarkUrls: [],
        mediaRequestErrors: [],
        pageErrors: []
      };
      const mediaByUrl = new Map();
      const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      const responseErrors = [];
      page.on("response", (response) => {
        const url = unwrapMediaUrl(response.url(), page.url());
        if (!url || !isPublicMediaUrl(url)) return;
        if (response.status() >= 400) {
          responseErrors.push({ page: page.url(), url: url.href, status: response.status() });
        }
      });

      for (const pageUrl of pageCandidates) {
        try {
          await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
          await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => undefined);
          const height = await page.evaluate(() => document.body.scrollHeight);
          const steps = Math.min(16, Math.max(1, Math.ceil(height / 900)));
          for (let index = 0; index < steps; index += 1) {
            await page.evaluate((scrollY) => window.scrollTo(0, scrollY), index * 900);
            await page.waitForTimeout(350);
          }
          const refs = await collectLiveMedia(page, pageUrl, storeReport.pageErrors);
          storeReport.pagesScanned += 1;
          storeReport.mediaReferences += refs.length;
          for (const ref of refs) {
            const existing = mediaByUrl.get(ref.url);
            mediaByUrl.set(ref.url, existing ? { ...existing, ...ref } : ref);
          }
        } catch (error) {
          storeReport.pageErrors.push({
            page: pageUrl,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      await page.close();
      const media = [...mediaByUrl.values()];
      storeReport.uniqueMedia = media.length;
      storeReport.videos = media.filter((item) => item.kind.startsWith("video")).length;
      storeReport.playableVideos = media.filter((item) => item.kind === "video" && item.width > 0 && item.height > 0 && item.paused === false).length;
      storeReport.missingWatermarkUrls = media
        .filter((item) => item.wm !== "20260802subtlewatermark30")
        .map((item) => ({ kind: item.kind, url: item.url, wm: item.wm }));
      storeReport.mediaRequestErrors = responseErrors;
      report.stores.push(storeReport);
      report.issues.push(
        ...storeReport.missingWatermarkUrls.map((item) => ({ store: store.id, reason: "missing_or_wrong_wm_query", ...item })),
        ...storeReport.mediaRequestErrors.map((item) => ({ store: store.id, reason: "media_http_error", ...item })),
        ...storeReport.pageErrors.map((item) => ({ store: store.id, reason: "page_or_video_error", ...item }))
      );
    }
  } finally {
    await browser.close();
  }

  report.issueCount = report.issues.length;
  return report;
}

async function main() {
  const reports = [];
  if (!liveOnly) reports.push(await auditDisk());
  if (!diskOnly) reports.push(await auditLive());
  const report = {
    ok: reports.every((item) => item.issueCount === 0),
    generatedAt: new Date().toISOString(),
    expectedWatermark,
    reports
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    await fs.writeFile(path.resolve(repoRoot, outputPath), serialized);
  }
  console.log(serialized);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
