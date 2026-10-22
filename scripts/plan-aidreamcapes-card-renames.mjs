#!/usr/bin/env node
// Read-only plan for the remaining Aidreamcapes detail-address cleanups.
//
// Three classes of leftovers are covered:
//
// 1. Three template cards whose bare label slug is already the live template
//    landing page path (`/ai-video-generation/beauty-routine`,
//    `/ai-video-generation/how-to-video`,
//    `/ai-video-generation/spark-ads-style-video`). The detail route resolves
//    before the LivePage route, so a card can never own its own page path.
//    The visible card name is therefore extended so the detail address ends
//    with the card name again, and the retired address becomes a
//    `publicAliases` entry on the same card.
//
// 2. Two homepage picker cards that carry the same name as a hub card
//    (`trousers-fold-demo-home`, `tinted-balm-vanity-reel-home`). They are
//    different media (different image, prompt and creation tool), so they stay
//    separate scenes and get their own visible names.
//
// 3. One workspace case with apostrophe drift
//    (`court-gear-from-the-player-s-view`). The label keeps its apostrophe; the
//    stored slug drops it the way a reader expects, and the retired address
//    becomes a `publicAliases` entry on the canonical scene card so it still
//    answers 308 in one hop.
//
// The plan never touches `publicSlug` ownership rules, sitemap entries,
// navigation, publications or snapshots, and it never writes MyDreamShoots.
//
// Usage:
//   node --env-file=.env scripts/plan-aidreamcapes-card-renames.mjs --target=production --write-manifest
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const CONTRACT = "aidreamcapes-card-rename-2026-10-22-v1";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const writeManifest = hasArgument("--write-manifest");
const outPath = path.resolve(
  process.cwd(),
  argumentValue("--out") || `scripts/manifests/aidreamcapes-card-renames-${target}-2026-10-22.json`
);

const MEDIA_ROOTS = { photo: "ai-image-generation", video: "ai-video-generation" };

/** Reviewed decisions. Each entry is one card pair on one page. */
const RENAMES = [
  {
    page: "/ai-video-generation/beauty-routine",
    kind: "video",
    copies: ["templateDefinition", "picker"],
    from: { label: "Beauty Routine", slug: "beauty-routine-beauty-routine" },
    to: { label: "Beauty Routine Video", slug: "beauty-routine-video" },
    reason: "The bare slug is the live template landing page path, so the visible card name carries the detail address."
  },
  {
    page: "/ai-video-generation/how-to-video",
    kind: "video",
    copies: ["templateDefinition", "picker"],
    from: { label: "How-To Video", slug: "how-to-video-how-to-video" },
    to: { label: "How-To Product Video", slug: "how-to-product-video" },
    reason: "The bare slug is the live template landing page path, so the visible card name carries the detail address."
  },
  {
    page: "/ai-video-generation/spark-ads-style-video",
    kind: "video",
    copies: ["templateDefinition", "picker"],
    from: { label: "Spark Ads Style Video", slug: "spark-ads-style-video-spark-ads-style-video" },
    to: { label: "TikTok Spark Ad Video", slug: "tiktok-spark-ad-video" },
    reason: "The bare slug is the live template landing page path, so the visible card name carries the detail address."
  },
  {
    page: "/",
    kind: "video",
    copies: ["picker"],
    from: { label: "Trousers Fold Demo", slug: "trousers-fold-demo-home" },
    to: { label: "Folded Trousers Detail", slug: "folded-trousers-detail" },
    reason: "The homepage card is a different scene from the hub card of the same name, so it carries its own name."
  },
  {
    page: "/",
    kind: "video",
    copies: ["picker"],
    from: { label: "Tinted Balm Vanity Reel", slug: "tinted-balm-vanity-reel-home" },
    to: { label: "Tinted Balm Detail", slug: "tinted-balm-detail" },
    reason: "The homepage card is a different scene from the hub card of the same name, so it carries its own name."
  },
  {
    page: "/ai-image-generation/colorway-variations",
    kind: "video",
    copies: ["workspaceCases"],
    from: { label: "Court Gear from the Player's View", slug: "court-gear-from-the-player-s-view" },
    to: { label: "Court Gear from the Player's View", slug: "court-gear-from-the-players-view" },
    // The canonical scene card takes the retired address instead, so exactly
    // one card lists the alias and the redirect stays unambiguous.
    selfAlias: false,
    reason: "The stored slug turned the apostrophe into a hyphen; the address now reads like the card name."
  }
];

/** Cards that only take over a retired address so it keeps answering 308. */
const ALIAS_ADDITIONS = [
  {
    page: "/ai-video-generation/video-ads",
    kind: "video",
    copies: ["picker"],
    match: { label: "First-Person Discovery: Court Gear", slug: "first-person-discovery-court-gear" },
    addAlias: "court-gear-from-the-player-s-view",
    address: {
      oldPath: "/ai-video-generation/court-gear-from-the-player-s-view",
      newPath: "/ai-video-generation/first-person-discovery-court-gear"
    },
    reason: "The retired apostrophe address keeps one 308 hop to the canonical scene."
  }
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
function labelOf(card) {
  if (typeof card?.label === "string") return card.label.trim();
  if (typeof card?.title === "string") return card.title.trim();
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
    ? card.publicAliases.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim())
    : [];
}
function detailPath(kind, slug) {
  return `/${MEDIA_ROOTS[kind]}/${slug}`;
}
function sectionCards(row) {
  const content = record(row.contentJson);
  const sections = record(content?.sections);
  const out = [];
  for (const [sectionId, sectionValue] of Object.entries(sections ?? {})) {
    const section = record(sectionValue);
    if (section?.type !== "aidreamcapes_v2_page") continue;
    const data = record(record(section.settings)?.data);
    if (!data) continue;
    if (record(data.templateDefinition?.card)) {
      out.push({ source: "templateDefinition", jsonPath: `sections.${sectionId}.settings.data.templateDefinition.card`, card: data.templateDefinition.card });
    }
    if (Array.isArray(data.visual?.picker?.cards)) {
      data.visual.picker.cards.forEach((card, index) => {
        if (!record(card)) return;
        out.push({ source: "picker", jsonPath: `sections.${sectionId}.settings.data.visual.picker.cards[${index}]`, card });
      });
    }
    if (Array.isArray(data.workspaceCases)) {
      data.workspaceCases.forEach((card, index) => {
        if (!record(card)) return;
        out.push({ source: "workspaceCases", jsonPath: `sections.${sectionId}.settings.data.workspaceCases[${index}]`, card });
      });
    }
  }
  return out;
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

assertDatabaseTarget({ expectedTarget: target });

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
  const cardsByPage = new Map();
  const ownedSlugs = new Map();
  const aliasOwners = new Map();
  for (const row of rows) {
    const cards = sectionCards(row);
    cardsByPage.set(row.slug, cards);
    for (const entry of cards) {
      const slug = typeof entry.card.publicSlug === "string" ? entry.card.publicSlug.trim() : "";
      if (slug) {
        const list = ownedSlugs.get(slug) ?? [];
        list.push({ page: row.slug, jsonPath: entry.jsonPath });
        ownedSlugs.set(slug, list);
      }
      for (const alias of aliasesOf(entry.card)) {
        const list = aliasOwners.get(alias) ?? [];
        list.push({ page: row.slug, jsonPath: entry.jsonPath });
        aliasOwners.set(alias, list);
      }
    }
  }

  const problems = [];
  const skipped = [];
  const pages = [];
  const addresses = [];
  const plannedTargetSlugs = new Map();
  // Slugs this plan releases, so an alias can take over an address that the
  // same plan renames away.
  const releasedSlugs = new Map();

  function addPage(row, cards, extra) {
    const existing = pages.find((page) => page.slug === row.slug);
    if (existing) {
      existing.cards.push(...cards);
      return existing;
    }
    const page = {
      id: row.id,
      slug: row.slug,
      title: row.title,
      pageType: row.pageType,
      templateKey: row.templateKey,
      baseHash: pageHash(row),
      ...extra,
      cards
    };
    pages.push(page);
    return page;
  }

  for (const rename of RENAMES) {
    const row = bySlug.get(rename.page);
    if (!row) {
      problems.push(`${rename.page}: LivePage is missing`);
      continue;
    }
    const pageCards = cardsByPage.get(rename.page) ?? [];
    const matches = pageCards.filter((entry) =>
      rename.copies.includes(entry.source)
      && (entry.card.publicSlug ?? "").trim() === rename.from.slug
      && labelOf(entry.card) === rename.from.label
    );
    const slugHolders = pageCards.filter((entry) => (entry.card.publicSlug ?? "").trim() === rename.from.slug);
    if (matches.length !== rename.copies.length) {
      problems.push(`${rename.page}: expected ${rename.copies.length} copy/copies of ${rename.from.slug}, found ${matches.length}`);
      continue;
    }
    if (slugHolders.length !== matches.length) {
      problems.push(`${rename.page}: ${rename.from.slug} is held by ${slugHolders.length} card(s), expected ${matches.length}`);
      continue;
    }
    for (const entry of matches) {
      if (kindOf(entry.card) !== rename.kind) {
        problems.push(`${rename.page} ${entry.jsonPath}: kind is ${String(kindOf(entry.card))}, expected ${rename.kind}`);
      }
    }
    const targetSlug = rename.to.slug;
    const targetHolders = (ownedSlugs.get(targetSlug) ?? []).filter((holder) => holder.page !== rename.page);
    if (targetHolders.length) {
      problems.push(`${rename.page}: target slug ${targetSlug} is already owned by ${targetHolders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`);
      continue;
    }
    if ((aliasOwners.get(targetSlug) ?? []).length) {
      problems.push(`${rename.page}: target slug ${targetSlug} is already an alias`);
      continue;
    }
    if (livePageSlugs.has(detailPath(rename.kind, targetSlug))) {
      problems.push(`${rename.page}: target ${detailPath(rename.kind, targetSlug)} collides with a LivePage path`);
      continue;
    }
    if (plannedTargetSlugs.has(targetSlug)) {
      problems.push(`${rename.page}: target slug ${targetSlug} is already planned by ${plannedTargetSlugs.get(targetSlug)}`);
      continue;
    }
    const oldHolders = ownedSlugs.get(rename.from.slug) ?? [];
    if (oldHolders.length !== matches.length || oldHolders.some((holder) => holder.page !== rename.page)) {
      problems.push(`${rename.page}: retired slug ${rename.from.slug} is not owned by exactly the reviewed cards on one page`);
      continue;
    }
    plannedTargetSlugs.set(targetSlug, rename.page);
    const released = releasedSlugs.get(rename.from.slug) ?? new Set();
    for (const entry of matches) released.add(`${rename.page}|${entry.jsonPath}`);
    releasedSlugs.set(rename.from.slug, released);

    const cards = matches.map((entry) => {
      const currentAliases = aliasesOf(entry.card);
      const afterAliases = rename.from.slug === targetSlug || rename.selfAlias === false
        ? currentAliases
        : [...new Set([...currentAliases, rename.from.slug])];
      return {
        source: entry.source,
        jsonPath: entry.jsonPath,
        kind: kindOf(entry.card),
        label: labelOf(entry.card),
        beforeLabel: labelOf(entry.card),
        afterLabel: rename.to.label,
        imageSrc: imageSrcOf(entry.card),
        beforeSlug: rename.from.slug,
        afterSlug: targetSlug,
        beforeAliases: currentAliases.length ? currentAliases : null,
        afterAliases: afterAliases.length ? afterAliases : null,
        oldPath: detailPath(rename.kind, rename.from.slug),
        newPath: detailPath(rename.kind, targetSlug),
        reason: rename.reason
      };
    });
    addPage(row, cards, {
      label: rename.from.label,
      kind: rename.kind,
      oldSlug: rename.from.slug,
      targetSlug
    });
    addresses.push({
      oldPath: detailPath(rename.kind, rename.from.slug),
      newPath: detailPath(rename.kind, targetSlug),
      page: rename.page,
      label: rename.from.label,
      kind: rename.kind,
      source: cards[0].source
    });
  }

  for (const addition of ALIAS_ADDITIONS) {
    const row = bySlug.get(addition.page);
    if (!row) {
      problems.push(`${addition.page}: LivePage is missing`);
      continue;
    }
    const pageCards = cardsByPage.get(addition.page) ?? [];
    const matches = pageCards.filter((entry) =>
      addition.copies.includes(entry.source)
      && (entry.card.publicSlug ?? "").trim() === addition.match.slug
      && labelOf(entry.card) === addition.match.label
    );
    if (matches.length !== addition.copies.length) {
      problems.push(`${addition.page}: expected ${addition.copies.length} copy/copies of ${addition.match.slug}, found ${matches.length}`);
      continue;
    }
    if (livePageSlugs.has(detailPath(addition.kind, addition.addAlias))) {
      problems.push(`${addition.page}: retired address ${detailPath(addition.kind, addition.addAlias)} collides with a LivePage path`);
      continue;
    }
    if ((ownedSlugs.get(addition.addAlias) ?? []).length) {
      const released = releasedSlugs.get(addition.addAlias) ?? new Set();
      const stillOwned = (ownedSlugs.get(addition.addAlias) ?? [])
        .filter((holder) => !released.has(`${holder.page}|${holder.jsonPath}`));
      if (stillOwned.length) {
        problems.push(`${addition.page}: retired address ${addition.addAlias} is still owned by ${stillOwned.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}; the alias would be ignored`);
        continue;
      }
    }
    const cards = matches.map((entry) => {
      const currentAliases = aliasesOf(entry.card);
      const afterAliases = [...new Set([...currentAliases, addition.addAlias])];
      return {
        source: entry.source,
        jsonPath: entry.jsonPath,
        kind: kindOf(entry.card),
        label: labelOf(entry.card),
        imageSrc: imageSrcOf(entry.card),
        beforeSlug: addition.match.slug,
        afterSlug: addition.match.slug,
        beforeAliases: currentAliases.length ? currentAliases : null,
        afterAliases,
        oldPath: addition.address.oldPath,
        newPath: addition.address.newPath,
        reason: addition.reason
      };
    });
    addPage(row, cards, {
      label: addition.match.label,
      kind: addition.kind,
      oldSlug: addition.addAlias,
      targetSlug: addition.match.slug
    });
    addresses.push({
      oldPath: addition.address.oldPath,
      newPath: addition.address.newPath,
      page: addition.page,
      label: addition.match.label,
      kind: addition.kind,
      source: cards[0].source
    });
  }

  // An alias must resolve to exactly one card, otherwise the runtime refuses
  // the redirect and the retired address would fall through.
  const aliasTargets = new Map();
  for (const page of pages) {
    for (const card of page.cards) {
      const added = (card.afterAliases ?? []).filter((alias) => !(card.beforeAliases ?? []).includes(alias));
      for (const alias of added) {
        const set = aliasTargets.get(alias) ?? new Set();
        set.add(card.afterSlug);
        aliasTargets.set(alias, set);
      }
    }
  }
  for (const [alias, targets] of aliasTargets) {
    if (targets.size !== 1) {
      problems.push(`alias ${alias} would resolve to ${targets.size} cards (${[...targets].join(", ")}); the redirect would be refused`);
    }
    const otherOwners = (aliasOwners.get(alias) ?? [])
      .filter((holder) => !releasedSlugs.get(alias)?.has(`${holder.page}|${holder.jsonPath}`));
    if (otherOwners.length) {
      problems.push(`alias ${alias} is already listed by ${otherOwners.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`);
    }
  }

  pages.sort((a, b) => a.slug.localeCompare(b.slug));
  const uniqueAddresses = [...new Map(addresses.map((address) => [address.oldPath, address])).values()]
    .sort((a, b) => a.oldPath.localeCompare(b.oldPath));

  const body = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    approvedPages: [...new Set([...RENAMES, ...ALIAS_ADDITIONS].map((entry) => entry.page))].sort(),
    excludedPages: [],
    pages,
    skipped,
    addresses: uniqueAddresses
  };
  const manifest = {
    ok: problems.length === 0,
    mode: "plan",
    ...body,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    owner: "LivePage.contentJson",
    rules: {
      labelRule: "the visible card name ends the detail address; the landing page keeps its own path",
      aliasRule: "the retired address becomes a publicAliases entry on the same card, so it answers 308 in one hop",
      apostropheRule: "an apostrophe in a card name is dropped in the address instead of becoming a hyphen",
      rollback: "the manifest is the field-level inverse: beforeSlug, beforeLabel and beforeAliases restore the retired address"
    },
    summary: {
      livePageRowsScanned: rows.length,
      plannedPages: pages.length,
      plannedCards: pages.reduce((total, page) => total + page.cards.length, 0),
      plannedAddresses: uniqueAddresses.length,
      problems: problems.length
    },
    problems,
    planHash: hash(body)
  };

  if (writeManifest) {
    assert(problems.length === 0, `Refusing to write a manifest with ${problems.length} problem(s):\n${problems.join("\n")}`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    ok: manifest.ok,
    contract: CONTRACT,
    target,
    planHash: manifest.planHash,
    outPath: writeManifest ? outPath : null,
    summary: manifest.summary,
    problems,
    addresses: uniqueAddresses,
    pages: pages.map((page) => ({
      slug: page.slug,
      targetSlug: page.targetSlug,
      cards: page.cards.map((card) => ({
        source: card.source,
        jsonPath: card.jsonPath,
        label: card.label,
        afterLabel: card.afterLabel,
        beforeSlug: card.beforeSlug,
        afterSlug: card.afterSlug,
        afterAliases: card.afterAliases
      }))
    }))
  }, null, 2));
  if (problems.length) process.exitCode = 1;
} finally {
  await db.$disconnect();
}
