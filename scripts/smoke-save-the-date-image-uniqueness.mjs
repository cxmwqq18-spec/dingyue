#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const syncSource = fs.readFileSync(path.join(repoRoot, "scripts/sync-save-the-date-topic-pages.mjs"), "utf8");
const videoSyncSource = fs.readFileSync(path.join(repoRoot, "scripts/sync-mydreamshoots-video-topic-pages.mjs"), "utf8");
const rendererSource = fs.readFileSync(path.join(repoRoot, "src/components/storefront/video-topic-landing.tsx"), "utf8");
const themeRendererSource = fs.readFileSync(path.join(repoRoot, "src/components/theme-renderer.tsx"), "utf8");
const failures = [];

if (/%\s*manifest\.length/.test(syncSource) || /const\s+image\s*=\s*\(index\)/.test(syncSource)) {
  failures.push("save_the_date_sync_must_not_cycle_manifest_images");
}
if (!/function\s+isolateVideoTopicImages/.test(videoSyncSource) || !/next\.gallery\.items\s*=\s*next\.gallery\.items\.filter/.test(videoSyncSource)) {
  failures.push("video_topic_sync_must_filter_duplicate_gallery_images");
}
if (!/image\?:\s*VideoTopicImage/.test(rendererSource) || !/item\.image\s*\?\s*\(/.test(rendererSource)) {
  failures.push("video_topic_renderer_must_support_text_only_use_cases");
}
const logoBarBlock = themeRendererSource.match(/if \(type === "logo_bar"\)[\s\S]*?\n  if \(type === "newsletter"\)/)?.[0] ?? "";
if (/<Link[\s\S]*?logo/.test(logoBarBlock) || /hrefFor\(site, blockValue\(block, "link"/.test(logoBarBlock)) {
  failures.push("logo_bar_items_must_not_be_clickable");
}

const packageDirs = [
  ["engagement", process.env.SAVE_THE_DATE_ENGAGEMENT_SOURCE_DIR || path.join(repoRoot, "scripts/fixtures/save-the-date/engagement")],
  ["proposal", process.env.SAVE_THE_DATE_PROPOSAL_SOURCE_DIR || path.join(repoRoot, "scripts/fixtures/save-the-date/proposal")],
  ["save-the-date", process.env.SAVE_THE_DATE_GENERIC_SOURCE_DIR || path.join(repoRoot, "scripts/fixtures/save-the-date/save-the-date")]
];
for (const [key, sourceDir] of packageDirs) {
  const manifestPath = path.join(sourceDir, "11_image_manifest_and_alt.csv");
  if (!fs.existsSync(manifestPath)) {
    failures.push(`${key}:missing_manifest`);
    continue;
  }
  const filenames = fs.readFileSync(manifestPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.split(",", 1)[0].replace(/^"|"$/g, "").trim())
    .filter(Boolean);
  if (new Set(filenames).size !== filenames.length) failures.push(`${key}:duplicate_manifest_filename`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, packages: packageDirs.map(([key]) => key) }));
