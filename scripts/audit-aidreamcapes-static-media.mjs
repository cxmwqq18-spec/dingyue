#!/usr/bin/env node

import "./load-runtime-env.mjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { argumentValue, assertDatabaseTarget } from "./lib/database-target.mjs";

const siteId = "site_aidreamcapes";
const target = argumentValue("--target") || "local";
assertDatabaseTarget({ expectedTarget: target });
if (target !== "local") {
  throw new Error("This first-pass inventory is read-only and currently supports --target=local only.");
}

const repoRoot = process.cwd();
const publicRoot = path.join(repoRoot, "public");
const outputPath = argumentValue("--out");
const prisma = new PrismaClient();
const mediaExtension = /(?:https?:\/\/|\/)[^\s"'<>()[\]{}]*?\.(?:avif|gif|jpe?g|m4a|m4v|mov|mp3|mp4|ogg|png|svg|wav|webm|webp)(?:\?[^\s"'<>()[\]{}]*)?/gi;
const privateAssetPath = /^\/api\/(?:local-assets\/|sites\/[^/]+\/customers\/[^/]+\/assets\/)/i;

function pointerSegment(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

function normalizeUrl(raw) {
  const value = String(raw ?? "").trim().replace(/[;,]+$/, "");
  if (!value || /^(?:data:|blob:|javascript:)/i.test(value)) return undefined;
  try {
    const url = new URL(value, "https://www.aidreamcapes.com");
    return {
      raw: value,
      host: value.startsWith("/") ? "" : url.hostname.toLowerCase(),
      pathname: decodeURIComponent(url.pathname),
      query: url.search,
      queryKeys: [...new Set([...url.searchParams.keys()].map((key) => key.toLowerCase()))].sort(),
      protocol: value.startsWith("/") ? "relative" : url.protocol.replace(":", "")
    };
  } catch {
    return undefined;
  }
}

function staticFilePath(url) {
  if (!url || !url.pathname.startsWith("/")) return undefined;
  const normalized = path.posix.normalize(url.pathname);
  if (normalized !== url.pathname || normalized.includes("..")) return undefined;
  const candidate = path.resolve(publicRoot, `.${normalized}`);
  if (!candidate.startsWith(`${publicRoot}${path.sep}`)) return undefined;
  return candidate;
}

function classifyUrl(normalized) {
  if (!normalized) return "unparseable";
  if (privateAssetPath.test(normalized.pathname)) return "private-api-reference";
  if (/^\/api\//i.test(normalized.pathname)) return "dynamic-api-reference";
  if (normalized.pathname.startsWith("/assets/") || normalized.pathname.startsWith("/site-media/")) return "static-path";
  return "other-path";
}

function mediaMatches(text) {
  const matches = [];
  for (const match of String(text).matchAll(mediaExtension)) {
    const candidate = match[0].replace(/[;,]+$/, "");
    if (candidate) matches.push(candidate);
  }
  for (const match of String(text).matchAll(/(?:https?:\/\/[^/\s"'<>]+)?\/api\/(?:local-assets\/|sites\/[^/]+\/customers\/[^/]+\/assets\/)[^\s"'<>()[\]{}]*/gi)) {
    const candidate = match[0].replace(/[;,]+$/, "");
    if (candidate) matches.push(candidate);
  }
  return [...new Set(matches)];
}

function collectPageReferences(value, pointer = "", page, grouped) {
  if (typeof value === "string") {
    for (const raw of mediaMatches(value)) {
      const normalized = normalizeUrl(raw);
      if (!normalized) continue;
      const key = raw;
      const item = grouped.get(key) ?? {
        url: raw,
        kind: classifyUrl(normalized),
        host: normalized.host,
        pathname: normalized.pathname,
        query: normalized.query,
        queryKeys: normalized.queryKeys,
        protocol: normalized.protocol,
        extension: path.posix.extname(normalized.pathname).slice(1).toLowerCase(),
        occurrences: []
      };
      item.occurrences.push({ pageId: page.id, slug: page.slug, pointer });
      grouped.set(key, item);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => collectPageReferences(entry, `${pointer}/${index}`, page, grouped));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value)) {
      collectPageReferences(entry, `${pointer}/${pointerSegment(key)}`, page, grouped);
    }
  }
}

function fileEvidence(item) {
  const normalized = normalizeUrl(item.url);
  const source = staticFilePath(normalized);
  if (!source || !fs.existsSync(source) || !fs.statSync(source).isFile()) {
    return { localMirror: "missing" };
  }
  const bytes = fs.readFileSync(source);
  return {
    localMirror: "present",
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex")
  };
}

function increment(map, key, amount = 1) {
  map[key] = (map[key] ?? 0) + amount;
}

try {
  const [pages, mediaAssets, privateAssets, otherAssets] = await Promise.all([
    prisma.livePage.findMany({
      where: { siteId },
      select: { id: true, slug: true, contentJson: true, updatedAt: true },
      orderBy: { slug: "asc" }
    }),
    prisma.mediaAsset.findMany({
      where: { siteId },
      select: { id: true, label: true, mimeType: true, usageType: true, previewUrl: true, originUrl: true },
      orderBy: { id: "asc" }
    }),
    prisma.assetUpload.count({ where: { siteId, visibility: "private", deletedAt: null } }),
    prisma.assetUpload.groupBy({ by: ["visibility"], where: { siteId, deletedAt: null }, _count: { _all: true } })
  ]);

  const pageReferences = new Map();
  for (const page of pages) collectPageReferences(page.contentJson, "", page, pageReferences);
  const pageItems = [...pageReferences.values()].map((item) => ({
    ...item,
    occurrenceCount: item.occurrences.length,
    ...fileEvidence(item)
  }));

  const mediaAssetItems = [];
  for (const asset of mediaAssets) {
    for (const field of ["previewUrl", "originUrl"]) {
      const url = asset[field];
      if (!url) continue;
      const normalized = normalizeUrl(url);
      const item = {
        assetId: asset.id,
        label: asset.label,
        mimeType: asset.mimeType,
        usageType: asset.usageType,
        field,
        url,
        kind: classifyUrl(normalized),
        host: normalized?.host ?? "",
        pathname: normalized?.pathname ?? "",
        query: normalized?.query ?? "",
        queryKeys: normalized?.queryKeys ?? [],
        extension: normalized ? path.posix.extname(normalized.pathname).slice(1).toLowerCase() : "",
        ...fileEvidence({ url })
      };
      mediaAssetItems.push(item);
    }
  }

  const occurrencesByKind = {};
  const uniqueUrlsByKind = {};
  const filesByAvailability = { present: 0, missing: 0 };
  const uniquePaths = new Set();
  for (const item of pageItems) {
    increment(occurrencesByKind, item.kind, item.occurrenceCount);
    increment(uniqueUrlsByKind, item.kind);
    if (item.localMirror === "present") filesByAvailability.present += 1;
    else filesByAvailability.missing += 1;
    uniquePaths.add(item.pathname);
  }

  const mediaAssetByState = { present: 0, missing: 0 };
  const mediaAssetByKind = {};
  for (const item of mediaAssetItems) {
    increment(mediaAssetByKind, item.kind);
    if (item.localMirror === "present") mediaAssetByState.present += 1;
    else mediaAssetByState.missing += 1;
  }

  const inventory = {
    generatedAt: new Date().toISOString(),
    target: "local",
    siteId,
    source: "PostgreSQL LivePage.contentJson and MediaAsset rows; local public/ mirror",
    summary: {
      livePages: pages.length,
      uniqueLivePageUrlStrings: pageItems.length,
      livePageOccurrences: pageItems.reduce((sum, item) => sum + item.occurrenceCount, 0),
      uniqueLivePagePathsIgnoringHostAndQuery: uniquePaths.size,
      livePageUrlKinds: { unique: uniqueUrlsByKind, occurrences: occurrencesByKind },
      localFileAvailability: filesByAvailability,
      siteMediaAssetRows: mediaAssets.length,
      nonemptyMediaAssetUrlFields: mediaAssetItems.length,
      mediaAssetUrlKinds: mediaAssetByKind,
      mediaAssetLocalFileAvailability: mediaAssetByState,
      privateActiveAssetUploads: privateAssets,
      activeAssetUploadsByVisibility: Object.fromEntries(otherAssets.map((row) => [row.visibility ?? "(null)", row._count._all]))
    },
    livePageReferences: pageItems,
    mediaAssetReferences: mediaAssetItems
  };

  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, `${JSON.stringify(inventory, null, 2)}\n`);
    console.log(JSON.stringify({ written: resolved, ...inventory.summary }, null, 2));
  } else {
    console.log(JSON.stringify(inventory, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
