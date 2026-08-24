#!/usr/bin/env node
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.env.SEASONAL_SOURCE_ROOT || "/tmp/mydreamshoots-seasonal-packages.83JYeu";
const mothersFathersRoot = process.env.SEASONAL_MOTHERS_FATHERS_SOURCE_ROOT || "/tmp/mothers-fathers-packages.eaALdG";
const packages = [
  ["wedding-ceremony", "ai-wedding-ceremony-photo-video", "/ai-video-generation/wedding-ceremony", root],
  ["thanksgiving", "ai-thanksgiving-photo-and-video-final", "/holidays-events/thanksgiving", root],
  ["christmas", "ai-christmas-photo-and-video-final", "/holidays-events/christmas", root],
  ["new-year", "ai-new-year-photo-and-video-final", "/holidays-events/new-year", root],
  ["mothers-day", "ai-mothers-day-photo-and-video-final", "/holidays-events/mothers-day", mothersFathersRoot],
  ["fathers-day", "ai-fathers-day-photo-and-video-final", "/holidays-events/fathers-day", mothersFathersRoot]
];

function csvRows(file) {
  return fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "").trim().split(/\r?\n/).map((line) => {
    const values = [];
    let value = "";
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === "," && !quoted) { values.push(value); value = ""; }
      else value += char;
    }
    values.push(value);
    return values.map((item) => item.trim().replace(/^"|"$/g, ""));
  }).filter((row) => row.some(Boolean));
}

function seo(file) {
  return Object.fromEntries(csvRows(file).slice(1).map(([key, value]) => [key.toLowerCase().replace(/[^a-z0-9]+/g, "_"), value.trim()]));
}

function structureOrder(file) {
  return fs.readFileSync(file, "utf8").split(/\r?\n/).map((line) => line.match(/^\s*\d+\.\s+(.+?)(?:\s+—.*)?$/)?.[1]?.trim()).filter(Boolean)
    .filter((value) => !/^(global|breadcrumb|responsive behavior|footer|visual direction)/i.test(value));
}

const results = [];
for (const [key, directory, route, packageRoot] of packages) {
  const dir = path.join(packageRoot, directory);
  assert(fs.existsSync(dir), `${key}: source directory missing`);
  for (const file of ["01_page_copy_final.md", "02_page_structure_final.md", "06_seo_config.csv", "10_internal_link_plan.csv", "11_image_manifest_and_alt.csv", "SHA256SUMS.txt"]) assert(fs.existsSync(path.join(dir, file)), `${key}: missing ${file}`);
  const config = seo(path.join(dir, "06_seo_config.csv"));
  assert(config.title && config.meta_description && config.h1 && config.canonical, `${key}: incomplete SEO config`);
  assert.equal(config.canonical, `https://www.mydreamshoots.com${route}`, `${key}: canonical mismatch`);
  const manifestRows = csvRows(path.join(dir, "11_image_manifest_and_alt.csv"));
  const headers = manifestRows.shift().map((item) => item.toLowerCase().replace(/[^a-z0-9]+/g, "_"));
  const manifest = manifestRows.map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""])));
  assert.equal(manifest.length, 11, `${key}: image count`);
  const checksums = new Map(fs.readFileSync(path.join(dir, "SHA256SUMS.txt"), "utf8").split(/\r?\n/).map((line) => line.match(/^([a-f0-9]{64})\s+(.+)$/)).filter(Boolean).map((match) => [match[2], match[1]]));
  for (const row of manifest) {
    const filename = row.filename;
    const imagePath = path.join(dir, "images", filename);
    assert(fs.existsSync(imagePath), `${key}: missing ${filename}`);
    assert(row.alt_text || row.alt, `${key}: missing alt for ${filename}`);
    const metadata = await sharp(imagePath).metadata();
    assert.equal(metadata.width, 1600, `${key}: ${filename} width`);
    assert.equal(metadata.height, 1000, `${key}: ${filename} height`);
    const digest = crypto.createHash("sha256").update(fs.readFileSync(imagePath)).digest("hex");
    assert.equal(digest, checksums.get(`images/${filename}`), `${key}: checksum ${filename}`);
  }
  assert(structureOrder(path.join(dir, "02_page_structure_final.md")).length >= 8, `${key}: structure outline too short`);
  results.push({ key, route, media: manifest.length, structureItems: structureOrder(path.join(dir, "02_page_structure_final.md")).length });
}
console.log(JSON.stringify({ ok: true, sourceRoot: root, packages: results }, null, 2));
