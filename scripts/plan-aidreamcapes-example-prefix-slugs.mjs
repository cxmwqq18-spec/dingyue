#!/usr/bin/env node
// Read-only plan for the 17 non-linked example cards whose addresses repeat
// the owner page leaf before the card title, e.g.
//   /ai-image-generation/sale-campaign-key-visual-suitcase-with-room-for-the-offer
// The card title is the address base:
//   /ai-image-generation/suitcase-with-room-for-the-offer
// The retired long slug becomes a `publicAliases` entry on the same card.
//
// These cards are data-only on the four sale/occasion pages and are not linked
// from any sitemap page. The script never writes content, a publication, or a
// snapshot; it emits one reviewed manifest for the generic detail-slug apply.
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
const CONTRACT = "aidreamcapes-example-prefix-slug-normalization-2026-10-22-v1";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });
const writeManifest = hasArgument("--write-manifest");
const outPath = path.resolve(
  process.cwd(),
  argumentValue("--out") || `scripts/manifests/aidreamcapes-example-prefix-slugs-${target}-2026-10-22.json`
);
const PAGE_COUNTS = new Map([
  ["/ai-image-generation/sale-campaign-key-visual", 7],
  ["/occasions/black-friday", 3],
  ["/occasions/holidays", 3],
  ["/occasions/sale-discount", 4]
]);
const MEDIA_ROOTS = { photo: "ai-image-generation", video: "ai-video-generation" };

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
function pageLeaf(slug) {
  return String(slug).split("/").filter(Boolean).pop() || "";
}
function labelOf(card) {
  if (typeof card?.title === "string") return card.title.trim();
  if (typeof card?.label === "string") return card.label.trim();
  return "";
}
function kindOf(card) {
  if (card?.kind === "photo") return "photo";
  if (card?.kind === "video" || card?.kind === "clip" || card?.kind === "scene") return "video";
  return undefined;
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
  return `/${MEDIA_ROOTS[kind]}/${slug}`;
}
function pageSections(contentJson) {
  const sections = record(record(contentJson)?.sections);
  const order = Array.isArray(contentJson?.sectionsOrder) && contentJson.sectionsOrder.length
    ? [...new Set([...contentJson.sectionsOrder, ...Object.keys(sections ?? {})])]
    : Object.keys(sections ?? {});
  return order
    .map((sectionId) => ({ sectionId, section: record(sections?.[sectionId]) }))
    .filter((entry) => entry.section?.type === "aidreamcapes_v2_page")
    .map((entry) => ({ sectionId: entry.sectionId, data: record(record(entry.section.settings)?.data) }))
    .filter((entry) => entry.data);
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
  const pages = [];
  const allAddresses = [];
  for (const [pageSlug, expectedCount] of PAGE_COUNTS) {
    const row = rows.find((entry) => entry.slug === pageSlug);
    if (!row) {
      problems.push(`${pageSlug}: LivePage is missing`);
      continue;
    }
    const cards = [];
    let foundCount = 0;
    for (const { sectionId, data } of pageSections(row.contentJson)) {
      const groups = Array.isArray(record(data.examples)?.groups) ? data.examples.groups : [];
      groups.forEach((group, groupIndex) => {
        const items = Array.isArray(record(group)?.items) ? group.items : [];
        items.forEach((item, itemIndex) => {
          const card = record(item);
          const oldSlug = typeof card?.publicSlug === "string" ? card.publicSlug.trim() : "";
          if (!oldSlug) return;
          const label = labelOf(card);
          const targetSlug = slugify(label);
          const prefix = `${pageLeaf(pageSlug)}-`;
          const jsonPath = `sections.${sectionId}.settings.data.examples.groups[${groupIndex}].items[${itemIndex}]`;
          if (oldSlug === targetSlug) {
            if (aliasesOf(card).includes(`${prefix}${targetSlug}`)) {
              foundCount += 1;
              skipped.push({ page: pageSlug, card: jsonPath, slug: oldSlug, reason: "already applied" });
            }
            return;
          }
          if (!oldSlug.startsWith(prefix)) return;
          foundCount += 1;
          const kind = kindOf(card);
          if (!kind) {
            problems.push(`${pageSlug}${jsonPath}: card has no supported kind`);
            return;
          }
          if (oldSlug !== `${prefix}${targetSlug}`) {
            problems.push(`${pageSlug}${jsonPath}: ${oldSlug} is not the expected ${prefix}${targetSlug}`);
            return;
          }
          const currentAliases = aliasesOf(card);
          const afterAliases = [...new Set([...currentAliases, oldSlug])];
          const targetHolders = (ownedSlugs.get(targetSlug) ?? []).filter(
            (holder) => !(holder.page === pageSlug && holder.jsonPath === jsonPath)
          );
          if (targetHolders.length) {
            problems.push(`${pageSlug}${jsonPath}: target ${targetSlug} is owned by ${targetHolders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`);
            return;
          }
          const targetAliasHolders = aliasOwners.get(targetSlug) ?? [];
          if (targetAliasHolders.length) {
            problems.push(`${pageSlug}${jsonPath}: target ${targetSlug} is an alias on ${targetAliasHolders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`);
            return;
          }
          if (livePageSlugs.has(detailPath(kind, targetSlug))) {
            problems.push(`${pageSlug}${jsonPath}: target ${detailPath(kind, targetSlug)} is a LivePage path`);
            return;
          }
          const oldOwners = ownedSlugs.get(oldSlug) ?? [];
          if (oldOwners.length !== 1 || oldOwners[0].page !== pageSlug || oldOwners[0].jsonPath !== jsonPath) {
            problems.push(`${pageSlug}${jsonPath}: retired address is not owned by exactly this card`);
            return;
          }
          cards.push({
            source: "examples",
            jsonPath,
            kind,
            label,
            imageSrc: imageSrcOf(card),
            beforeSlug: oldSlug,
            afterSlug: targetSlug,
            beforeAliases: currentAliases.length ? currentAliases : null,
            afterAliases,
            oldPath: detailPath(kind, oldSlug),
            newPath: detailPath(kind, targetSlug)
          });
        });
      });
    }
    if (foundCount !== expectedCount) {
      problems.push(`${pageSlug}: expected ${expectedCount} prefix example cards, found ${foundCount}`);
    }
    if (!cards.length) continue;
    pages.push({
      id: row.id,
      slug: row.slug,
      title: row.title,
      pageType: row.pageType,
      templateKey: row.templateKey,
      baseHash: hash({
        id: row.id,
        siteId: row.siteId,
        slug: row.slug,
        title: row.title,
        pageType: row.pageType,
        templateKey: row.templateKey,
        contentJson: row.contentJson,
        updatedAt: row.updatedAt
      }),
      label: "Sale and occasion examples",
      kind: null,
      oldSlug: null,
      targetSlug: null,
      cards: cards.sort((a, b) => a.jsonPath.localeCompare(b.jsonPath))
    });
    allAddresses.push(...cards.map((card) => ({
      oldPath: card.oldPath,
      newPath: card.newPath,
      page: pageSlug,
      label: card.label,
      kind: card.kind,
      source: card.source
    })));
  }

  const body = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    approvedPages: [...PAGE_COUNTS.keys()],
    excludedPages: [],
    pages,
    skipped,
    addresses: allAddresses
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
      slugRule: "slugify(examples item title); remove the owner-page leaf prefix",
      aliasRule: "the retired <page-leaf>-<title> address becomes a publicAliases entry on the same card",
      scopeRule: "the four sale/occasion pages only; no visible anchor changes",
      rollback: "the manifest is the field-level inverse: beforeSlug and beforeAliases restore the retired address"
    },
    summary: {
      livePageRowsScanned: rows.length,
      approvedPages: PAGE_COUNTS.size,
      plannedPages: pages.length,
      plannedCards: pages.reduce((total, entry) => total + entry.cards.length, 0),
      plannedAddresses: allAddresses.length,
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
    planned: pages.flatMap((entry) => entry.cards.map((card) => ({ page: entry.slug, from: card.beforeSlug, to: card.afterSlug, path: card.jsonPath }))),
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
