#!/usr/bin/env node
// Media integrity audit for the AIVideosUGC /templates example gallery.
//
// Walks every public media detail card via the gallery pagination API, fetches
// each detail page, collects every rendered/reference media URL, and validates
// each unique asset with a Range request: HTTP status, container magic bytes
// (JPEG/PNG/GIF/WebP/MP4/WebM) and a minimum total size. Catches the failure
// modes HEAD checks miss: zero-byte files, truncated containers and origin
// files whose served size drifts between requests.
//
// Usage:
//   node scripts/audit-aivideosugc-media-integrity.mjs [--base-url https://www.aivideosugc.com] [--apply]
// Without --apply the script reports and exits non-zero on failures; --apply is
// accepted for CI symmetry (behaviour is read-only by nature).

const args = process.argv.slice(2);
const baseUrlArg = args.includes("--base-url") ? args[args.indexOf("--base-url") + 1] : process.env.AUDIT_BASE_URL || "http://127.0.0.1:3000";
const base = String(baseUrlArg).replace(/\/$/, "");
const GALLERY_PATH = "/api/aidreamcapes/gallery-cards";
const PAGE_BATCH = 6;
const ASSET_BATCH = 6;
const MIN_BYTES = 3000;

const failures = [];
const warnings = [];

function classify(contentType, bytes) {
  const b = bytes ?? [];
  const text = String.fromCharCode(...b.slice(0, 16));
  if (contentType.includes("jpeg")) return b[0] === 0xff && b[1] === 0xd8;
  if (contentType.includes("png")) return b[0] === 0x89 && b[1] === 0x50;
  if (contentType.includes("gif")) return b[0] === 0x47 && b[1] === 0x49;
  if (contentType.includes("webp")) return text.slice(8, 12) === "WEBP";
  if (contentType.includes("mp4")) return text.slice(4, 8) === "ftyp";
  if (contentType.includes("webm")) return b[0] === 0x1a && b[1] === 0x45;
  return true; // Unknown type: status/size checks still apply.
}

async function fetchGalleryEntries() {
  const entries = [];
  let offset = 0;
  for (;;) {
    const response = await fetch(`${base}${GALLERY_PATH}?offset=${offset}&limit=50`);
    if (!response.ok) throw new Error(`gallery API ${response.status} at offset ${offset}`);
    const body = await response.json();
    entries.push(...body.items);
    if (body.nextOffset == null || !body.items.length) return { entries, total: body.total };
    offset = body.nextOffset;
  }
}

async function fetchDetailMedia(href) {
  const response = await fetch(`${base}${href}`);
  if (!response.ok) return { status: response.status };
  const html = await response.text();
  const srcs = [...html.matchAll(/<img[^>]*\ssrc="([^"]+)"|<(?:video|source)[^>]*\ssrc="([^"]+)"/g)]
    .map((match) => match[1] || match[2])
    .filter((src) => src && !/^(data|blob):/.test(src));
  return { status: response.status, media: [...new Set(srcs)] };
}

async function checkAsset(src) {
  const url = src.startsWith("http") ? src : `${base}${src}`;
  const sizes = new Set();
  try {
    const ranged = await fetch(url, { headers: { Range: "bytes=0-48" } });
    const bytes = new Uint8Array(await ranged.arrayBuffer());
    const contentRange = ranged.headers.get("content-range");
    const total = contentRange ? Number(contentRange.split("/")[1]) : null;
    const contentType = ranged.headers.get("content-type") || "";
    if (!ranged.ok) return { src, problems: [`status ${ranged.status}`] };
    if (!classify(contentType, bytes)) return { src, problems: [`bad magic for ${contentType}`] };
    if (total !== null && total < MIN_BYTES) return { src, problems: [`total ${total}B < ${MIN_BYTES}B`] };
    sizes.add(total ?? -1);
  } catch (error) {
    return { src, problems: [`range request failed: ${String(error).slice(0, 60)}`] };
  }
  // Size drift between two full GETs means the CDN and origin disagree on the
  // file (observed live as 206-with-empty-body on one reference image).
  for (let round = 0; round < 2; round++) {
    try {
      const full = await fetch(url);
      await full.body?.cancel();
      if (!full.ok) return { src, problems: [`full GET status ${full.status}`] };
      const length = full.headers.get("content-length");
      if (length) sizes.add(Number(length));
    } catch (error) {
      warnings.push({ src, note: `full GET failed: ${String(error).slice(0, 60)}` });
    }
  }
  sizes.delete(-1);
  if (sizes.size > 1) return { src, problems: [`inconsistent sizes across requests: ${[...sizes].join(", ")}`] };
  return { src, problems: [] };
}

async function runBatched(list, size, worker) {
  const results = [];
  for (let index = 0; index < list.length; index += size) {
    results.push(...await Promise.all(list.slice(index, index + size).map(worker)));
  }
  return results;
}

const { entries, total } = await fetchGalleryEntries();
console.log(`gallery: ${entries.length}/${total} entries from ${base}`);

const pageResults = await runBatched(entries.map((entry) => entry.href), PAGE_BATCH, fetchDetailMedia);
const failedPages = pageResults.filter((result) => !result.media);
for (const failed of failedPages) failures.push({ kind: "detail-page", href: "(batched)", problem: `status ${failed.status}` });

const uniqueAssets = [...new Set(pageResults.flatMap((result) => result.media ?? []))];
console.log(`assets: ${uniqueAssets.length} unique across ${pageResults.length - failedPages.length} detail pages`);

const assetResults = await runBatched(uniqueAssets, ASSET_BATCH, checkAsset);
for (const result of assetResults) {
  if (result.problems.length) failures.push({ kind: "asset", href: result.src, problem: result.problems.join("; ") });
}

for (const warning of warnings) console.warn(`WARN ${warning.src}: ${warning.note}`);

if (failures.length) {
  console.error(`\nFAIL ${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  [${failure.kind}] ${failure.href}: ${failure.problem}`);
  process.exit(1);
}
console.log(`\nOK: ${pageResults.length} detail pages, ${uniqueAssets.length} assets, 0 failures${warnings.length ? `, ${warnings.length} warnings` : ""}`);
