#!/usr/bin/env node
// Read-only plan for Aidreamcapes template-detail slug normalization.
//
// The template detail card and its picker copy currently repeat the owner
// page's leaf before the template name, e.g.
//   /ai-video-generation/black-friday-countdown-black-friday-video
// This plan moves the pair to the template's own short slug:
//   /ai-video-generation/black-friday-video
// The retired long slug becomes a `publicAliases` entry on both cards so the
// old address answers with a 308 to the canonical detail page.
//
// This script never writes content, a publication, or a snapshot. It reads
// current LivePage rows for site_aidreamcapes and emits one reviewed manifest.
//
// Usage:
//   node scripts/plan-aidreamcapes-template-detail-slugs.mjs --target=local
//   node scripts/plan-aidreamcapes-template-detail-slugs.mjs --target=local --write-manifest
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
const CONTRACT = "aidreamcapes-template-detail-slug-normalization-2026-10-22-v1";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });
const writeManifest = hasArgument("--write-manifest");
const outPath = path.resolve(
  process.cwd(),
  argumentValue("--out") || `scripts/manifests/aidreamcapes-template-detail-slugs-${target}-2026-10-22.json`
);

// The 15 template pages whose bare label slug is free. The three remaining
// template pages (beauty-routine, how-to-video, spark-ads-style-video) are
// deliberately excluded because their bare slug is already the live template
// page path and would shadow that indexable page.
const APPROVED_PAGES = [
  "/ai-image-generation/ugc-still-ad",
  "/ai-video-generation/black-friday-countdown",
  "/ai-video-generation/fashion-try-on-reel",
  "/ai-image-generation/packshot-multi-angle",
  "/ai-image-generation/sale-campaign-key-visual",
  "/ai-image-generation/virtual-try-on",
  "/ai-image-generation/professional-headshot",
  "/ai-image-generation/story-ad-vertical",
  "/ai-image-generation/colorway-variations",
  "/ai-image-generation/packaging-mockup",
  "/ai-video-generation/home-organization",
  "/ai-video-generation/promo-video",
  "/ai-video-generation/food-video",
  "/ai-video-generation/cinematic-video",
  "/ai-image-generation/jewelry-positioning"
];
const EXCLUDED_PAGES = [
  "/ai-video-generation/beauty-routine",
  "/ai-video-generation/how-to-video",
  "/ai-video-generation/spark-ads-style-video"
];
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
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
function pageLeaf(slug) {
  return String(slug).split("/").filter(Boolean).pop() || "";
}
function labelOf(card, definition) {
  for (const value of [card?.label, card?.title, definition?.name]) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}
function kindOf(card, definition) {
  for (const value of [card?.kind, definition?.kind]) {
    if (value === "photo") return "photo";
    if (value === "video" || value === "clip" || value === "scene") return "video";
  }
  return undefined;
}
function imageSrcOf(card) {
  const src = record(card?.image)?.src;
  return typeof src === "string" ? src : "";
}
function detailPath(kind, slug) {
  return `/${MEDIA_ROOTS[kind]}/${slug}`;
}
function aliasesOf(card) {
  return Array.isArray(card?.publicAliases)
    ? [...new Set(card.publicAliases.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))]
    : [];
}
function pageSections(contentJson) {
  const content = record(contentJson);
  const sections = record(content?.sections);
  const order = Array.isArray(content?.sectionsOrder) && content.sectionsOrder.length
    ? [...new Set([...content.sectionsOrder, ...Object.keys(sections ?? {})])]
    : Object.keys(sections ?? {});
  return order
    .map((sectionId) => ({ sectionId, section: record(sections?.[sectionId]) }))
    .filter((entry) => entry.section?.type === "aidreamcapes_v2_page")
    .map((entry) => ({
      sectionId: entry.sectionId,
      data: record(record(entry.section.settings)?.data)
    }))
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

  const bySlug = new Map(rows.map((row) => [row.slug, row]));
  const livePageSlugs = new Set(rows.map((row) => row.slug));
  const approved = new Set(APPROVED_PAGES);
  const excluded = new Set(EXCLUDED_PAGES);
  assert.equal(approved.size, APPROVED_PAGES.length, "Approved page list contains duplicates.");
  assert.equal(excluded.size, EXCLUDED_PAGES.length, "Excluded page list contains duplicates.");

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
      if (Array.isArray(card.publicAliases)) {
        for (const alias of card.publicAliases) {
          if (typeof alias !== "string" || !alias.trim()) continue;
          const list = aliasOwners.get(alias.trim()) ?? [];
          list.push({ page: row.slug, jsonPath });
          aliasOwners.set(alias.trim(), list);
        }
      }
    });
  }

  const problems = [];
  const skipped = [];
  const planned = [];
  const foundApproved = new Set();
  const seenTargets = new Map();

  for (const row of rows) {
    for (const { sectionId, data } of pageSections(row.contentJson)) {
      const definition = record(data.templateDefinition);
      const definitionCard = record(definition?.card);
      if (!definitionCard) continue;

      const jsonPath = `sections.${sectionId}.settings.data.templateDefinition.card`;
      const oldSlug = typeof definitionCard.publicSlug === "string" ? definitionCard.publicSlug.trim() : "";
      const label = labelOf(definitionCard, definition);
      const kind = kindOf(definitionCard, definition);
      const imageSrc = imageSrcOf(definitionCard);
      if (!oldSlug || !label || !kind) {
        problems.push(`${row.slug}: templateDefinition.card is missing publicSlug, label, or kind`);
        continue;
      }

      const cleanSlug = slugify(label);
      const expectedRetired = `${pageLeaf(row.slug)}-${cleanSlug}`;
      if (!approved.has(row.slug)) {
        const reason = excluded.has(row.slug)
          ? `bare slug ${cleanSlug} is already the live template page path`
          : "template page is outside the approved Phase 1 scope";
        skipped.push({
          page: row.slug,
          label,
          currentSlug: oldSlug,
          targetSlug: cleanSlug,
          reason
        });
        continue;
      }
      foundApproved.add(row.slug);

      if (oldSlug === cleanSlug) {
        const currentAliases = aliasesOf(definitionCard);
        skipped.push({
          page: row.slug,
          label,
          currentSlug: oldSlug,
          targetSlug: cleanSlug,
          reason: currentAliases.includes(expectedRetired)
            ? "already applied"
            : "card already carries the target slug but not the expected retired alias"
        });
        continue;
      }
      if (oldSlug !== expectedRetired) {
        problems.push(`${row.slug}: current slug ${oldSlug} is not the expected retired form ${expectedRetired}`);
        continue;
      }

      const picker = record(record(data.visual)?.picker);
      const pickerCards = Array.isArray(picker?.cards) ? picker.cards : [];
      const pickerMatches = [];
      pickerCards.forEach((value, index) => {
        const card = record(value);
        if (!card || card.publicSlug !== oldSlug) return;
        if (kindOf(card, definition) !== kind) return;
        pickerMatches.push({
          jsonPath: `sections.${sectionId}.settings.data.visual.picker.cards[${index}]`,
          card
        });
      });
      if (pickerMatches.length !== 1) {
        problems.push(`${row.slug}: expected exactly one picker copy of ${oldSlug}, found ${pickerMatches.length}`);
        continue;
      }

      const pairPaths = new Set([jsonPath, pickerMatches[0].jsonPath]);
      const holders = (ownedSlugs.get(cleanSlug) ?? []).filter(
        (holder) => !(holder.page === row.slug && pairPaths.has(holder.jsonPath))
      );
      if (holders.length) {
        problems.push(`${row.slug}: target slug ${cleanSlug} is already owned by ${holders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`);
        continue;
      }
      const aliasHolders = aliasOwners.get(cleanSlug) ?? [];
      if (aliasHolders.length) {
        problems.push(`${row.slug}: target slug ${cleanSlug} is already an alias on ${aliasHolders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`);
        continue;
      }
      if (livePageSlugs.has(detailPath(kind, cleanSlug))) {
        problems.push(`${row.slug}: target ${detailPath(kind, cleanSlug)} collides with a LivePage path`);
        continue;
      }
      if (seenTargets.has(cleanSlug)) {
        problems.push(`${row.slug}: target slug ${cleanSlug} is also planned by ${seenTargets.get(cleanSlug)}`);
        continue;
      }
      const oldHolders = ownedSlugs.get(oldSlug) ?? [];
      const oldHolderPaths = new Set(oldHolders.filter((holder) => holder.page === row.slug).map((holder) => holder.jsonPath));
      if (oldHolders.some((holder) => holder.page !== row.slug) || oldHolderPaths.size !== 2 || ![...pairPaths].every((pathName) => oldHolderPaths.has(pathName))) {
        problems.push(`${row.slug}: retired slug ${oldSlug} is not owned by exactly the template card and its picker copy on one page`);
        continue;
      }
      seenTargets.set(cleanSlug, row.slug);

      const cards = [
        { source: "templateDefinition", jsonPath, card: definitionCard },
        ...pickerMatches.map((match) => ({ source: "picker", jsonPath: match.jsonPath, card: match.card }))
      ].map((entry) => {
        const currentAliases = aliasesOf(entry.card);
        const afterAliases = [...new Set([...currentAliases, oldSlug])];
        return {
          source: entry.source,
          jsonPath: entry.jsonPath,
          kind: kindOf(entry.card, definition) ?? kind,
          label: labelOf(entry.card, definition) || label,
          imageSrc: imageSrcOf(entry.card),
          beforeSlug: oldSlug,
          afterSlug: cleanSlug,
          beforeAliases: currentAliases.length ? currentAliases : null,
          afterAliases,
          oldPath: detailPath(kind, oldSlug),
          newPath: detailPath(kind, cleanSlug)
        };
      });

      planned.push({
        page: {
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
          })
        },
        label,
        kind,
        oldSlug,
        targetSlug: cleanSlug,
        cards
      });
    }
  }

  for (const page of APPROVED_PAGES) {
    if (!foundApproved.has(page)) problems.push(`${page}: approved template page is missing from LivePage or has no templateDefinition.card`);
  }
  for (const page of EXCLUDED_PAGES) {
    if (!foundApproved.has(page) && !skipped.some((entry) => entry.page === page)) {
      problems.push(`${page}: excluded template page is missing from LivePage or has no templateDefinition.card`);
    }
  }

  const pages = [];
  for (const entry of planned) {
    const existing = pages.find((page) => page.slug === entry.page.slug);
    if (existing) problems.push(`${entry.page.slug}: multiple template definitions found`);
    pages.push({
      ...entry.page,
      label: entry.label,
      kind: entry.kind,
      oldSlug: entry.oldSlug,
      targetSlug: entry.targetSlug,
      cards: entry.cards
    });
  }
  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  skipped.sort((a, b) => a.page.localeCompare(b.page));
  const addresses = pages.flatMap((page) => page.cards.map((card) => ({
    oldPath: card.oldPath,
    newPath: card.newPath,
    page: page.slug,
    label: page.label,
    kind: page.kind,
    source: card.source
  })));
  // One address per pair, not one per card.
  const uniqueAddresses = [...new Map(addresses.map((address) => [address.oldPath, address])).values()]
    .sort((a, b) => a.oldPath.localeCompare(b.oldPath));

  const body = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    approvedPages: APPROVED_PAGES,
    excludedPages: EXCLUDED_PAGES,
    pages,
    skipped,
    addresses: uniqueAddresses
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
      slugRule: "slugify(templateDefinition.card.label)",
      aliasRule: "the retired <page-leaf>-<label> slug becomes a publicAliases entry on both the template card and its picker copy",
      pairRule: "both cards keep the same publicSlug and the old address resolves to one page with a 308",
      excludedRule: "beauty-routine, how-to-video, and spark-ads-style-video are excluded because the bare slug is already a LivePage path",
      rollback: "the manifest is the field-level inverse: beforeSlug and beforeAliases restore the retired address"
    },
    summary: {
      livePageRowsScanned: rows.length,
      approvedPages: APPROVED_PAGES.length,
      excludedPages: EXCLUDED_PAGES.length,
      plannedPages: pages.length,
      plannedCards: pages.reduce((total, page) => total + page.cards.length, 0),
      plannedAddresses: uniqueAddresses.length,
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
    planned: pages.map((page) => ({
      page: page.slug,
      label: page.label,
      from: page.oldSlug,
      to: page.targetSlug,
      cards: page.cards.length
    })),
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
