#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { argumentValue } from "./lib/database-target.mjs";

const siteId = "site_aidreamcapes";
const repoRoot = process.cwd();
const publicRoot = path.join(repoRoot, "public");
const inventoryPath = path.resolve(argumentValue("--inventory") || "releases/aidreamcapes-static-media-20261018/inventory-local.json");
const outputPath = path.resolve(argumentValue("--out") || "releases/aidreamcapes-static-media-20261018/static-url-map-local-candidates.json");
const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));

if (inventory.target !== "local" || inventory.siteId !== siteId) {
  throw new Error(`Expected a local ${siteId} inventory; received target=${inventory.target} siteId=${inventory.siteId}`);
}

const allowedHosts = new Set(["", "aivideosugc.com", "www.aivideosugc.com", "aidreamcapes.com", "www.aidreamcapes.com"]);
const mimeByExtension = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4"
};

function localSource(pathname) {
  if (!pathname.startsWith("/assets/sites/site_aidreamcapes/")) return undefined;
  const normalized = path.posix.normalize(pathname);
  if (normalized !== pathname || normalized.includes("..")) return undefined;
  const fullPath = path.resolve(publicRoot, `.${normalized}`);
  if (!fullPath.startsWith(`${publicRoot}${path.sep}`)) return undefined;
  return fullPath;
}

function contentTypeAndValidBytes(extension, bytes) {
  const mimeType = mimeByExtension[extension];
  if (!mimeType) return { mimeType: "application/octet-stream", valid: false, reason: "unsupported-extension" };
  let valid = false;
  if (extension === "webp") valid = bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  else if (extension === "jpg" || extension === "jpeg") valid = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
  else if (extension === "png") valid = bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  else if (extension === "avif") valid = bytes.subarray(4, 8).toString("ascii") === "ftyp" && bytes.subarray(8, 12).toString("ascii").startsWith("avif");
  else if (extension === "mp4") valid = bytes.subarray(4, 8).toString("ascii") === "ftyp";
  return { mimeType, valid, reason: valid ? undefined : "file-signature-mismatch" };
}

function prepare(pathname, host, query) {
  if (!allowedHosts.has(host)) return { status: "blocked", reason: "external-host" };
  const file = localSource(pathname);
  if (!file) return { status: "blocked", reason: pathname.startsWith("/assets/sites/site_aidreamcapes_eu/") ? "other-site-source" : "outside-aidreamcapes-static-root" };
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return { status: "blocked", reason: "local-source-missing" };
  const bytes = fs.readFileSync(file);
  const extension = path.posix.extname(pathname).slice(1).toLowerCase();
  const signature = contentTypeAndValidBytes(extension, bytes);
  if (!signature.valid) return { status: "blocked", reason: signature.reason, mimeType: signature.mimeType };
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const relative = pathname.slice("/assets/sites/site_aidreamcapes/".length);
  const extensionWithDot = path.posix.extname(relative);
  const stem = extensionWithDot ? relative.slice(0, -extensionWithDot.length) : relative;
  const targetUrl = `/assets/sites/site_aidreamcapes/public-media/${stem}--sha256-${sha256}${extensionWithDot}`;
  return {
    status: "ready-local-candidate",
    sourcePath: pathname,
    targetUrl,
    sha256,
    bytes: bytes.length,
    mimeType: signature.mimeType,
    sourceHasQuery: Boolean(query),
    sourceQueryKeys: query ? [...new Set([...new URLSearchParams(query).keys()])].sort() : []
  };
}

const livePageReferences = inventory.livePageReferences.map((row) => {
  const base = prepare(row.pathname, row.host, row.query);
  return {
    ...base,
    sourcePath: row.pathname,
    occurrenceCount: row.occurrenceCount,
    occurrences: row.occurrences
  };
});

const mediaAssetReferences = inventory.mediaAssetReferences.map((row) => {
  const base = prepare(row.pathname, row.host, row.query);
  return {
    ...base,
    sourcePath: row.pathname,
    assetId: row.assetId,
    field: row.field
  };
});

const summarize = (rows) => ({
  references: rows.length,
  ready: rows.filter((row) => row.status === "ready-local-candidate").length,
  blocked: rows.filter((row) => row.status !== "ready-local-candidate").length,
  reasons: Object.fromEntries([...new Set(rows.map((row) => row.reason).filter(Boolean))].map((reason) => [reason, rows.filter((row) => row.reason === reason).length]))
});

const result = {
  generatedAt: new Date().toISOString(),
  mode: "read-only-local-candidate-map",
  siteId,
  source: "current local PostgreSQL inventory and workspace public/ files; no copies or database writes",
  inventoryPath: path.relative(repoRoot, inventoryPath),
  summary: {
    livePageReferences: summarize(livePageReferences),
    uniqueLivePageSourcePaths: new Set(livePageReferences.map((row) => row.sourcePath)).size,
    livePageOccurrences: livePageReferences.reduce((sum, row) => sum + (row.occurrenceCount || 0), 0),
    mediaAssetReferences: summarize(mediaAssetReferences),
    uniqueTargetUrls: new Set([...livePageReferences, ...mediaAssetReferences].map((row) => row.targetUrl).filter(Boolean)).size
  },
  livePageReferences,
  mediaAssetReferences
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ written: path.relative(repoRoot, outputPath), ...result.summary }, null, 2));
