#!/usr/bin/env node
// Plan the Aidreamcapes media-detail canonicalization: one detail page per
// product (same reference image + prompt/label).
//
// Every workspaceCase card copy of a product currently owns its own
// `publicSlug` (with a template-name suffix), so one product can own up to 19
// duplicate detail pages that no public surface links to. This plan keeps the
// shortest slug per product (tie-break: lexicographic) and generates field-level
// operations that remove `publicSlug` from every other copy. Card bodies,
// prompts, reference assets, and the workspace are untouched.
//
// Dry-run is the default and prints the summary. The reviewed manifest is the
// review artifact for scripts/apply-aidreamcapes-media-canonical.mjs.
//
//   node --env-file=.env.local scripts/plan-aidreamcapes-media-canonical.mjs --target=local
//   node --env-file=.env.production scripts/plan-aidreamcapes-media-canonical.mjs --target=production \
//     --manifest=scripts/manifests/aidreamcapes-media-canonical-production-2026-10-30.json
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-media-canonical-2026-10-30-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
assert.equal(target, process.env.DATABASE_TARGET, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
    || `scripts/manifests/aidreamcapes-media-canonical-${target}-2026-10-30.json`
);

function stable(value) {
  if (value === undefined) return '"<undefined>"';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}
function labelOf(card) {
  return text(card?.label) || text(card?.title);
}
function kindOf(card) {
  if (card?.kind === "photo") return "photo";
  if (card?.kind === "video" || card?.kind === "clip" || card?.kind === "scene") return "video";
  return undefined;
}
function imageSrcOf(card) {
  return text(card?.image?.src);
}
function publicSlugOf(card) {
  return text(card?.publicSlug);
}
function parseJsonPath(jsonPath) {
  const steps = [];
  for (const part of String(jsonPath).split(".")) {
    const match = part.match(/^([^[\]]+)((?:\[\d+\])*)$/);
    assert(match, `Unsupported manifest jsonPath segment "${part}" in ${jsonPath}.`);
    steps.push(match[1]);
    for (const index of match[2].matchAll(/\[(\d+)\]/g)) steps.push(Number(index[1]));
  }
  return steps;
}
function resolveCard(contentJson, jsonPath) {
  let node = contentJson;
  for (const step of parseJsonPath(jsonPath)) {
    if (node === null || node === undefined) return undefined;
    if (typeof step === "number") {
      if (!Array.isArray(node)) return undefined;
    } else if (typeof node !== "object" || Array.isArray(node)) {
      return undefined;
    }
    node = node[step];
  }
  return record(node) ? node : undefined;
}
function pageHash(row) {
  return hash({
    id: row.id,
    siteId: row.siteId,
    slug: row.slug,
    title: row.title,
    pageType: row.pageType,
    templateKey: row.templateKey,
    contentJson: row.contentJson,
    updatedAt: row.updatedAt
  });
}
function cardSnapshot(card) {
  return {
    label: labelOf(card),
    kind: kindOf(card),
    image: record(card?.image) ?? null,
    prompt: typeof card?.prompt === "string" ? card.prompt.trim() : "",
    href: text(card?.href),
    sceneSlug: text(card?.sceneSlug),
    sceneId: text(card?.sceneId) || null,
    publicSlug: publicSlugOf(card),
    detailAliasOf: text(card?.detailAliasOf) || null,
    publicAliases: Array.isArray(card?.publicAliases) ? card.publicAliases : []
  };
}
function cardHash(card) {
  return hash(cardSnapshot(card));
}
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,119}$/;

const db = new PrismaClient({ errorFormat: "minimal" });
// Large single-shot findMany calls (every contentJson row) die through the
// production SSH tunnel ("Server has closed the connection"), so rows are
// loaded in small cursor batches.
async function loadRows(client, select) {
  const rows = [];
  let cursor;
  for (;;) {
    const batch = await client.livePage.findMany({
      where: { siteId: SITE_ID },
      orderBy: { id: "asc" },
      take: 20,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select
    });
    rows.push(...batch);
    if (batch.length < 20) break;
    cursor = batch[batch.length - 1].id;
  }
  return rows;
}
try {
  const rows = await loadRows(db, {
    id: true,
    siteId: true,
    slug: true,
    title: true,
    pageType: true,
    templateKey: true,
    contentJson: true,
    updatedAt: true
  });
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);

  // Collect every workspaceCase card that owns a publicSlug.
  const slugOwners = new Map(); // slug -> [{ page, jsonPath, card }]
  const products = new Map(); // productKey -> { kind, label, imageSrc, slugs: Set, copies: [] }
  for (const row of rows) {
    const sections = record(record(row.contentJson)?.sections);
    for (const [sectionKey, sectionValue] of Object.entries(sections ?? {})) {
      assert(/^[A-Za-z0-9_-]+$/.test(sectionKey), `Section key "${sectionKey}" on ${row.slug} is not jsonPath-safe.`);
      const data = record(record(record(sectionValue)?.settings)?.data);
      if (!Array.isArray(data?.workspaceCases)) continue;
      data.workspaceCases.forEach((card, index) => {
        const recordCard = record(card);
        const slug = publicSlugOf(recordCard);
        if (!recordCard || !slug) return;
        assert(SLUG_PATTERN.test(slug), `Slug "${slug}" on ${row.slug} violates the public slug pattern.`);
        const jsonPath = `sections.${sectionKey}.settings.data.workspaceCases[${index}]`;
        const list = slugOwners.get(slug) ?? [];
        list.push({ page: row.slug, jsonPath, card: recordCard });
        slugOwners.set(slug, list);
        const key = [kindOf(recordCard), labelOf(recordCard), imageSrcOf(recordCard)].join("\u0000");
        assert(labelOf(recordCard) && imageSrcOf(recordCard) && kindOf(recordCard), `Card ${jsonPath} on ${row.slug} lacks label/image/kind.`);
        const product = products.get(key) ?? {
          kind: kindOf(recordCard),
          label: labelOf(recordCard),
          imageSrc: imageSrcOf(recordCard),
          slugs: new Set(),
          copies: []
        };
        product.slugs.add(slug);
        product.copies.push({ page: row.slug, jsonPath, slug });
        products.set(key, product);
      });
    }
  }

  // Canonical selection: shortest slug per product, tie-break lexicographic.
  // Every kept slug must be owned by exactly one page so the detail resolver's
  // `pages.length === 1` contract holds.
  const canonicalByProduct = new Map();
  for (const [key, product] of products) {
    const ordered = [...product.slugs].sort((a, b) => a.length - b.length || a.localeCompare(b));
    const canonical = ordered[0];
    const owners = slugOwners.get(canonical) ?? [];
    assert.equal(owners.length, 1, `Canonical slug "${canonical}" for product "${product.label}" is owned by ${owners.length} pages; refusing an ambiguous canonical.`);
    canonicalByProduct.set(key, canonical);
  }

  const operations = [];
  const canonicalRecords = [];
  for (const [key, product] of products) {
    const canonical = canonicalByProduct.get(key);
    canonicalRecords.push({
      label: product.label,
      kind: product.kind,
      imageSrc: product.imageSrc,
      publicSlug: canonical,
      ownerPage: (slugOwners.get(canonical) ?? [])[0]?.page ?? null
    });
    for (const copy of product.copies) {
      if (copy.slug === canonical) continue;
      operations.push(copy);
    }
  }
  canonicalRecords.sort((a, b) => a.publicSlug.localeCompare(b.publicSlug));
  operations.sort((a, b) => a.page.localeCompare(b.page) || a.jsonPath.localeCompare(b.jsonPath));

  // Group operations per page with before/after card states.
  const pageMap = new Map();
  for (const operation of operations) {
    const row = rows.find((entry) => entry.slug === operation.page);
    assert(row, `Operation page ${operation.page} disappeared.`);
    const card = resolveCard(row.contentJson, operation.jsonPath);
    assert.equal(publicSlugOf(card), operation.slug, `Card ${operation.jsonPath} on ${operation.page} no longer holds its planned slug.`);
    const nextCard = structuredClone(card);
    delete nextCard.publicSlug;
    const pageEntry = pageMap.get(operation.page) ?? {
      slug: operation.page,
      pageHash: pageHash(row),
      cards: []
    };
    pageEntry.cards.push({
      source: "workspaceCases",
      jsonPath: operation.jsonPath,
      label: labelOf(card),
      kind: kindOf(card),
      publicSlug: operation.slug,
      before: cardSnapshot(card),
      after: cardSnapshot(nextCard),
      beforeHash: cardHash(card),
      afterHash: cardHash(nextCard),
      operations: [{ field: "publicSlug", from: operation.slug, remove: true }]
    });
    pageMap.set(operation.page, pageEntry);
  }

  const afterSlugs = slugOwners.size - operations.length;
  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    rule: "keep the shortest publicSlug per (kind, label, image) product across workspaceCase cards; remove publicSlug from every other copy",
    summary: {
      products: products.size,
      productsWithDetailPage: canonicalByProduct.size,
      beforeSlugs: slugOwners.size,
      strippedSlugs: operations.length,
      afterSlugs,
      pages: pageMap.size
    },
    canonical: canonicalRecords,
    pages: [...pageMap.values()].sort((a, b) => a.slug.localeCompare(b.slug)),
    operations: [],
    addresses: []
  };
  manifest.planHash = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    canonical: manifest.canonical,
    summary: manifest.summary,
    pages: manifest.pages,
    operations: manifest.operations,
    addresses: manifest.addresses
  });

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    ok: true,
    mode: "plan",
    contract: CONTRACT,
    target,
    manifestPath,
    planHash: manifest.planHash,
    summary: manifest.summary,
    reminder: applyReminder()
  }, null, 2));

  function applyReminder() {
    return `Review the manifest, then apply with: --apply --confirm=site_aidreamcapes-media-canonical-${target} --base-hash=${manifest.planHash}`;
  }
} finally {
  await db.$disconnect();
}
