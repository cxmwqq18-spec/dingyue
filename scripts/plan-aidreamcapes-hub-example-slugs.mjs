#!/usr/bin/env node
// Read-only plan for the five visible /ai-video-generation hub examples.
//
// These example cards use scene-based addresses:
//   /ai-video-generation/a-spoken-ad-with-a-person-on-camera
// while the card title is "Bottle Ad With a Person". This plan moves each card
// to the label address and records the retired scene address as a
// `publicAliases` entry on the same card, so the old URL answers with a 308.
//
// The script never writes content, a publication, or a snapshot. It reads
// current LivePage rows for site_aidreamcapes and emits one reviewed manifest.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertAllowedSite,
  assertDatabaseTarget,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const CONTRACT = "aidreamcapes-hub-example-slug-normalization-2026-10-22-v1";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });
const writeManifest = hasArgument("--write-manifest");
const outPath = path.resolve(
  process.cwd(),
  argumentValue("--out") || `scripts/manifests/aidreamcapes-hub-example-slugs-${target}-2026-10-22.json`
);
const PAGE_SLUG = "/ai-video-generation";
const TARGETS = [
  { oldSlug: "a-spoken-ad-with-a-person-on-camera", label: "Bottle Ad With a Person", newSlug: "bottle-ad-with-a-person" },
  { oldSlug: "the-same-product-walkthrough", label: "Bento Box Walkthrough", newSlug: "bento-box-walkthrough" },
  { oldSlug: "a-showcase-in-a-real-room", label: "Perfume Bottle in a Room", newSlug: "perfume-bottle-in-a-room" },
  { oldSlug: "an-actor-matched-to-the-buyer", label: "An Avatar Holds the Shaker", newSlug: "an-avatar-holds-the-shaker" },
  { oldSlug: "a-clip-sized-for-the-feed", label: "Sneaker Photo for the Feed", newSlug: "sneaker-photo-for-the-feed" }
];

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
function slugify(value) {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function labelOf(card) {
  if (typeof card?.title === "string") return card.title.trim();
  if (typeof card?.label === "string") return card.label.trim();
  return "";
}
function imageSrcOf(card) {
  if (typeof card?.image === "string") return card.image;
  const src = record(card?.image)?.src;
  return typeof src === "string" ? src : "";
}
function aliasesOf(card) {
  return Array.isArray(card?.publicAliases)
    ? [...new Set(card.publicAliases.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]
    : [];
}
function detailPath(kind, slug) {
  return `/${kind === "photo" ? "ai-image-generation" : "ai-video-generation"}/${slug}`;
}
function walkCards(node, pathName, visit) {
  if (Array.isArray(node)) {
    node.forEach((value, index) => walkCards(value, `${pathName}[${index}]`, visit));
    return;
  }
  if (!record(node)) return;
  visit(node, pathName);
  for (const [key, value] of Object.entries(node)) {
    walkCards(value, pathName ? `${pathName}.${key}` : key, visit);
  }
}

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    orderBy: { id: "asc" },
    select: {
      id: true,
      siteId: true,
      slug: true,
      title: true,
      pageType: true,
      templateKey: true,
      contentJson: true,
      updatedAt: true
    }
  });
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);
  const page = rows.find((row) => row.slug === PAGE_SLUG);
  assert(page, `LivePage ${PAGE_SLUG} is missing.`);
  const livePageSlugs = new Set(rows.map((row) => row.slug));
  const ownedSlugs = new Map();
  const aliasOwners = new Map();
  for (const row of rows) {
    walkCards(row.contentJson, "", (card, jsonPath) => {
      const slug = typeof card.publicSlug === "string" ? card.publicSlug.trim() : "";
      if (slug) {
        const list = ownedSlugs.get(slug) ?? [];
        list.push({ page: row.slug, jsonPath });
        ownedSlugs.set(slug, list);
      }
      for (const alias of aliasesOf(card)) {
        const list = aliasOwners.get(alias) ?? [];
        list.push({ page: row.slug, jsonPath });
        aliasOwners.set(alias, list);
      }
    });
  }

  const problems = [];
  const skipped = [];
  const cards = [];
  const expected = new Map(TARGETS.map((entry) => [entry.oldSlug, entry]));
  const found = new Set();
  const examples = record(record(page.contentJson?.sections?.v2_main?.settings?.data)?.examples);
  const groups = Array.isArray(examples?.groups) ? examples.groups : [];
  groups.forEach((group, groupIndex) => {
    const items = Array.isArray(record(group)?.items) ? group.items : [];
    items.forEach((item, itemIndex) => {
      const card = record(item);
      const slug = typeof card?.publicSlug === "string" ? card.publicSlug.trim() : "";
      if (!expected.has(slug)) return;
      found.add(slug);
      const plan = expected.get(slug);
      const label = labelOf(card);
      const newSlug = slugify(label);
      const jsonPath = `sections.v2_main.settings.data.examples.groups[${groupIndex}].items[${itemIndex}]`;
      if (label !== plan.label) problems.push(`${slug}: label changed from "${plan.label}" to "${label}"`);
      if (newSlug !== plan.newSlug) problems.push(`${slug}: label slug changed from ${plan.newSlug} to ${newSlug}`);
      if (card.kind !== "scene") problems.push(`${slug}: kind is ${String(card.kind)}, expected scene`);
      const currentAliases = aliasesOf(card);
      const afterAliases = [...new Set([...currentAliases, slug])];
      const targetHolders = (ownedSlugs.get(newSlug) ?? []).filter((holder) => !(holder.page === PAGE_SLUG && holder.jsonPath === jsonPath));
      if (targetHolders.length) {
        problems.push(`${slug}: target ${newSlug} is owned by ${targetHolders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`);
      }
      const targetAliasHolders = aliasOwners.get(newSlug) ?? [];
      if (targetAliasHolders.length) {
        problems.push(`${slug}: target ${newSlug} is an alias on ${targetAliasHolders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`);
      }
      if (livePageSlugs.has(detailPath("video", newSlug))) problems.push(`${slug}: target ${detailPath("video", newSlug)} is a LivePage path`);
      const oldOwners = ownedSlugs.get(slug) ?? [];
      if (oldOwners.length !== 1 || oldOwners[0].page !== PAGE_SLUG || oldOwners[0].jsonPath !== jsonPath) {
        problems.push(`${slug}: retired address is not owned by exactly this example card`);
      }
      cards.push({
        source: "examples",
        jsonPath,
        kind: "video",
        label,
        imageSrc: imageSrcOf(card),
        beforeSlug: slug,
        afterSlug: newSlug,
        beforeAliases: currentAliases.length ? currentAliases : null,
        afterAliases,
        oldPath: detailPath("video", slug),
        newPath: detailPath("video", newSlug)
      });
    });
  });
  for (const plan of TARGETS) {
    if (!found.has(plan.oldSlug)) problems.push(`${plan.oldSlug}: example card is missing from ${PAGE_SLUG}`);
  }
  if (cards.length !== TARGETS.length) problems.push(`expected ${TARGETS.length} example cards, found ${cards.length}`);

  if (!problems.length) {
    const allAfter = cards.every((card) => {
      const value = (() => {
        const steps = card.jsonPath.replace(/\[(\d+)\]/g, ".$1").split(".");
        let node = page.contentJson;
        for (const step of steps) node = node?.[step];
        return record(node);
      })();
      return value?.publicSlug === card.afterSlug
        && JSON.stringify(aliasesOf(value)) === JSON.stringify(card.afterAliases);
    });
    if (allAfter) {
      skipped.push({ page: PAGE_SLUG, slug: cards.map((card) => card.afterSlug).join(", "), reason: "already applied" });
      cards.length = 0;
    }
  }

  const pages = cards.length ? [{
    id: page.id,
    slug: page.slug,
    title: page.title,
    pageType: page.pageType,
    templateKey: page.templateKey,
    baseHash: hash({
      id: page.id,
      siteId: page.siteId,
      slug: page.slug,
      title: page.title,
      pageType: page.pageType,
      templateKey: page.templateKey,
      contentJson: page.contentJson,
      updatedAt: page.updatedAt
    }),
    label: "Hub examples",
    kind: "video",
    oldSlug: null,
    targetSlug: null,
    cards: cards.sort((a, b) => a.jsonPath.localeCompare(b.jsonPath))
  }] : [];
  const addresses = pages.flatMap((entry) => entry.cards.map((card) => ({
    oldPath: card.oldPath,
    newPath: card.newPath,
    page: entry.slug,
    label: card.label,
    kind: card.kind,
    source: card.source
  })));
  const body = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    approvedPages: [PAGE_SLUG],
    excludedPages: [],
    pages,
    skipped,
    addresses
  };
  const manifest = {
    ok: problems.length === 0,
    mode: "plan",
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    owner: "LivePage.contentJson",
    rules: {
      slugRule: "slugify(examples item title)",
      aliasRule: "the retired scene address becomes a publicAliases entry on the same card",
      scopeRule: "only the five visible hub examples on /ai-video-generation",
      rollback: "the manifest is the field-level inverse: beforeSlug and beforeAliases restore the scene address"
    },
    summary: {
      livePageRowsScanned: rows.length,
      approvedPages: 1,
      plannedPages: pages.length,
      plannedCards: pages.reduce((total, entry) => total + entry.cards.length, 0),
      plannedAddresses: addresses.length,
      skipped: skipped.length,
      problems: problems.length
    },
    problems,
    ...body,
    planHash: hash(body)
  };
  if (writeManifest) {
    assert(problems.length === 0, `Refusing to write a manifest with ${problems.length} problem(s):\n${problems.join("\n")}`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    ok: manifest.ok,
    mode: "plan",
    target,
    siteId: SITE_ID,
    summary: manifest.summary,
    planned: pages.flatMap((entry) => entry.cards.map((card) => ({ page: entry.slug, label: card.label, from: card.beforeSlug, to: card.afterSlug, path: card.jsonPath }))),
    skipped,
    problems,
    planHash: manifest.planHash,
    manifest: writeManifest ? path.relative(process.cwd(), outPath) : null
  }, null, 2));
  if (problems.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: "plan",
    target,
    siteId: SITE_ID,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
