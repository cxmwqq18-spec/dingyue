#!/usr/bin/env node
// Generate width variants for the /templates example-gallery media
// (docs/aivideosugc-templates-page-performance-plan.md P0).
//
// The gallery's first 20 cards are video posters: the LCP element is one of
// them, and the served source files are full-size reference JPEGs. This
// script walks the SSR gallery pagination (?page=N) the way a visitor — and
// the media integrity audit — do, collects every published poster and photo
// image URL from the real markup, and writes WebP width variants next to the
// generated index format the v2 storefront already reads:
//
//   <out-root>/assets/sites/site_aidreamcapes/v2-responsive/<source folder>/<name>--<width>.webp
//   <out-root>/aidreamcapes-gallery-variants-report.json        (full report)
//   <out-root>/aidreamcapes-gallery-variants-manifest-delta.json (mergeable index)
//
// The delta is merged into src/lib/aidreamcapes-v2-responsive-image-manifest.json
// by the same script run on the checkout host:
//
//   node scripts/generate-aidreamcapes-gallery-poster-variants.mjs --merge-delta=<path> --out-root=.
//
// Server run (the media lives on the release host):
//   node scripts/generate-aidreamcapes-gallery-poster-variants.mjs \
//     --base=https://www.aivideosugc.com --pin=127.0.0.1 --out-root=/tmp/gallery-variants --apply
//
// Without --apply the script only reports. It never writes other storefronts.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const sharp = require("sharp");

const TARGET_WIDTHS = [320, 640, 960];
const VARIANT_URL_PREFIX = "/assets/sites/site_aidreamcapes/v2-responsive";
const IMAGE_EXTENSIONS = /\.(?:jpe?g|png|webp|avif)$/i;
const SOURCE_PAGE = "/templates";
const MAX_PAGES = 200;
const BATCH = 6;

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const found = args.find(arg => arg.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : fallback;
};
const baseArg = value("--base", "http://127.0.0.1:3000");
const pin = value("--pin");
const outRoot = path.resolve(value("--out-root", "."));
const apply = args.includes("--apply");
const mergeDeltaPath = args.find(arg => arg.startsWith("--merge-delta="));
const REPORT_PATH = path.join(outRoot, "aidreamcapes-gallery-variants-report.json");
const DELTA_PATH = path.join(outRoot, "aidreamcapes-gallery-variants-manifest-delta.json");

const base = new URL(baseArg);
const isTls = base.protocol === "https:";
const requestPort = Number(base.port) || (isTls ? 443 : 80);

// SSR + media requests go through the release host's own TLS endpoint with the
// public hostname pinned to it (the same way curl --resolve does), so the
// shared media tree cannot be fetched cross-host by accident.
async function request(pathname, headers = {}) {
  if (pin) {
    if (!isTls) throw new Error("--pin supports https bases only");
    const https = await import("node:https");
    return new Promise((resolve, reject) => {
      const req = https.request({
        host: pin,
        port: requestPort,
        servername: base.hostname,
        path: pathname,
        method: "GET",
        headers: { host: base.host, ...headers },
        rejectUnauthorized: false
      }, (res) => resolve(res));
      req.on("error", reject);
      req.end();
    });
  }
  const response = await fetch(`${base.origin}${pathname}`, { headers });
  return { statusCode: response.status, headers: new Map(response.headers.entries()), on: (event, handler) => (event === "data"
    ? response.body?.on("data", handler)
    : response.body?.on(event, handler)), destroyBody: () => response.body?.cancel() };
}

async function fetchText(pathname) {
  const response = await request(pathname);
  if (response.statusCode !== 200) throw new Error(`GET ${pathname} -> ${response.statusCode}`);
  const chunks = [];
  response.on("data", (chunk) => chunks.push(chunk));
  await new Promise((resolve, reject) => {
    response.on("end", resolve);
    response.on("error", reject);
  });
  return Buffer.concat(chunks).toString("utf8");
}

async function fetchBuffer(pathname) {
  const response = await request(pathname, { "user-agent": "gallery-variant-generator/1" });
  if (response.statusCode !== 200) return { ok: false, status: response.statusCode };
  const chunks = [];
  response.on("data", (chunk) => chunks.push(chunk));
  await new Promise((resolve, reject) => {
    response.on("end", resolve);
    response.on("error", reject);
  });
  return { ok: true, buffer: Buffer.concat(chunks) };
}

function cleanUrl(raw) {
  const value = raw.replace(/&amp;/g, "&").trim();
  return value ? value.split(/[?#]/)[0] : undefined;
}

/** Collect card media from one SSR gallery page, plus the pager's next link. */
function parseGalleryPage(html) {
  const posters = [...html.matchAll(/<video[^>]*\sposter="([^"]+)"/g)].map((match) => cleanUrl(match[1]));
  const photos = [...html.matchAll(/<article[^>]*data-media-slug="[^"]*"[\s\S]*?<a class="ti" href="[^"]+">\s*<img[^>]*\ssrc="([^"]+)"/g)].map((match) => cleanUrl(match[1]));
  const nextAnchor = [...html.matchAll(/<a\b([^>]*)>/g)].find(([, attrs]) => /\brel="next"/.test(attrs ?? ""));
  const next = nextAnchor ? cleanUrl(/\bhref="([^"]+)"/.exec(nextAnchor[1])?.[1] ?? "") : undefined;
  return { posters, photos, next };
}

function variantUrl(sourceUrl, width) {
  const name = path.basename(sourceUrl);
  const folder = sourceUrl.slice(0, sourceUrl.length - name.length);
  const rename = name.replace(/(\.[^.]+)$/, `--${width}$1`).replace(/(\.[^.]+)\.webp$/, "");
  return {
    url: `${VARIANT_URL_PREFIX}${folder}${rename}.webp`,
    diskPath: path.join(outRoot, VARIANT_URL_PREFIX.slice(1), folder, `${rename}.webp`)
  };
}

async function processBatch(sources, report, apply, perSource) {
  for (let index = 0; index < sources.length; index += BATCH) {
    await Promise.all(sources.slice(index, index + BATCH).map((source) => perSource(source, report, apply)));
  }
}

async function main() {
  if (mergeDeltaPath) return mergeDelta();

  const report = {
    generatedAt: new Date().toISOString(),
    base: baseArg,
    pin: pin || undefined,
    mode: apply ? "apply" : "dry-run",
    pagesWalked: 0,
    sources: 0,
    missing: [],
    skipped: [],
    variants: 0,
    bytesOriginal: 0,
    bytesVariants: 0
  };

  // Walk the pagination chain exactly like an auditor: every page contributes
  // its own cards, then rel="next" decides the next URL.
  const posters = new Set();
  const photos = new Set();
  let nextPath = `${SOURCE_PAGE}?page=1`;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const html = await fetchText(nextPath);
    report.pagesWalked += 1;
    const parsed = parseGalleryPage(html);
    for (const item of parsed.posters) posters.add(item);
    for (const item of parsed.photos) photos.add(item);
    if (!parsed.next) break;
    nextPath = parsed.next.startsWith("http") ? new URL(parsed.next).pathname + new URL(parsed.next).search : parsed.next;
  }
  const sources = [...posters, ...photos];
  report.sources = sources.length;
  if (posters.size + photos.size === 0) throw new Error(`no gallery media found on ${nextPath}; check --base and --pin`);

  async function processSource(source, report, apply) {
    if (!IMAGE_EXTENSIONS.test(source)) {
      report.skipped.push({ source, reason: "not an image extension" });
      return;
    }
    const fetched = await fetchBuffer(source);
    if (!fetched.ok) {
      report.missing.push({ source, status: fetched.status });
      return;
    }
    const metadata = await sharp(fetched.buffer).metadata();
    const sourceWidth = metadata.width ?? 0;
    const sourceHeight = metadata.height ?? 0;
    report.bytesOriginal += fetched.buffer.length;
    if (!sourceWidth || !sourceHeight) {
      report.skipped.push({ source, reason: "no intrinsic dimensions" });
      return;
    }
    const widths = TARGET_WIDTHS.filter((width) => width < sourceWidth);
    const variants = [];
    if (!widths.length) {
      report.skipped.push({ source, reason: `source is ${sourceWidth}px wide` });
      report.delta[source] = { original: source, width: sourceWidth, height: sourceHeight, variants };
      return;
    }
    for (const width of widths) {
      const target = variantUrl(source, width);
      if (apply) {
        fs.mkdirSync(path.dirname(target.diskPath), { recursive: true });
        const output = await sharp(fetched.buffer).rotate().resize({ width, fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80, effort: 4, smartSubsample: true }).toBuffer();
        fs.writeFileSync(target.diskPath, output);
        report.bytesVariants += output.length;
      }
      variants.push({ width, url: target.url });
      report.variants += 1;
    }
    report.delta[source] = { original: source, width: sourceWidth, height: sourceHeight, variants };
  }

  report.delta = {};
  for (let index = 0; index < sources.length; index += BATCH) {
    await Promise.all(sources.slice(index, index + BATCH).map((source) => processSource(source, report, apply)));
  }

  fs.mkdirSync(outRoot, { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(DELTA_PATH, `${JSON.stringify(Object.fromEntries(Object.entries(report.delta).sort()), null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    mode: report.mode,
    pagesWalked: report.pagesWalked,
    sources: report.sources,
    posters: posters.size,
    photos: photos.size,
    variants: report.variants,
    bytesOriginal: report.bytesOriginal,
    bytesVariants: apply ? report.bytesVariants : 0,
    reportPath: REPORT_PATH,
    deltaPath: DELTA_PATH
  }, null, 2));
}

/** Merge a produced index delta into the store checkout's variant index. */
function mergeDelta() {
  const delta = JSON.parse(fs.readFileSync(mergeDeltaPath, "utf8"));
  const manifestPath = path.resolve(outRoot, "src/lib/aidreamcapes-v2-responsive-image-manifest.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const before = Object.keys(manifest).length;
  for (const [source, entry] of Object.entries(delta)) {
    manifest[source] = entry;
  }
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ ok: true, merged: Object.keys(delta).length, indexBefore: before, indexAfter: Object.keys(manifest).length, manifestPath }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
