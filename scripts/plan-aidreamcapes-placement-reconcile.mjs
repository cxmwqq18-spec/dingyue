#!/usr/bin/env node
// Read-only plan for the rev5 placement reconcile (see
// scripts/lib/aidreamcapes-categorization-fix-targets-rev5.mjs for the rule).
//
// Walks every placement-carrying card copy on site_aidreamcapes, computes the
// reviewed final placement for each published slug (canonical reference,
// overridden by CANONICAL_TWEAKS; alias detail slugs mirror their
// detailAliasOf target), and emits a field-level manifest that rewrites every
// copy which still differs. No labels, removals, or additions are touched.
//
//   node --env-file=<env> scripts/plan-aidreamcapes-placement-reconcile.mjs --target=production
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { MEDIA_PLACEMENT_PATTERN } from "./lib/aidreamcapes-placement-vocabulary.mjs";
import { CANONICAL_TWEAKS, CONTRACT, CONFIRMATION } from "./lib/aidreamcapes-categorization-fix-targets-rev5.mjs";

const require = createRequire(
  process.env.PRISMA_BASE
    ? path.join(process.env.PRISMA_BASE, "package.json")
    : import.meta.url
);
const { PrismaClient } = require("@prisma/client");

const SITE_ID = "site_aidreamcapes";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
if (process.env.DINGYUE_ENV && process.env.DINGYUE_ENV !== target) {
  throw new Error(`DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}.`);
}
const manifestPath = path.resolve(
  process.cwd(),
  process.argv.find((arg) => arg.startsWith("--manifest="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-placement-reconcile-${target}-2026-11-02.json`
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
  return card?.kind === "photo" ? "photo"
    : (card?.kind === "video" || card?.kind === "clip" || card?.kind === "scene") ? "video"
      : typeof card?.kind === "string" ? card.kind : undefined;
}
function publicSlugOf(card) {
  return text(card?.publicSlug);
}
function aliasOf(card) {
  return text(card?.detailAliasOf) || null;
}
function placementOf(card) {
  return Array.isArray(card?.placement) ? card.placement.filter((value) => typeof value === "string" && value.trim()) : [];
}
function videoSrcOf(card) {
  return text(card?.video?.src);
}
function cardSnapshot(card) {
  return {
    label: labelOf(card),
    kind: kindOf(card),
    image: record(card?.image) ?? null,
    prompt: typeof card?.prompt === "string" ? card.prompt.trim() : "",
    href: text(card?.href),
    sceneSlug: text(card?.sceneSlug),
    publicSlug: publicSlugOf(card),
    detailAliasOf: aliasOf(card),
    chips: Array.isArray(card?.chips) ? card.chips.filter((chip) => typeof chip === "string" && chip.trim()) : [],
    placement: placementOf(card)
  };
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

const SHAPES = [
  ["picker", (data) => (Array.isArray(data?.visual?.picker?.cards) ? data.visual.picker.cards : [])],
  ["workspaceCases", (data) => (Array.isArray(data?.workspaceCases) ? data.workspaceCases : [])],
  ["exampleGallery", (data) => {
    const groups = data?.examples?.groups;
    return Array.isArray(groups)
      ? groups.flatMap((group, groupIndex) => (Array.isArray(group?.items) ? group.items.map((item, itemIndex) => ({ item, groupIndex, itemIndex })) : []))
      : [];
  }],
  ["templateCard", (data) => [data?.templateDefinition?.card].filter((card) => card && typeof card === "object")]
];
const jsonPathFor = (shape, sectionKey, index, extra) =>
  shape === "templateCard"
    ? `sections.${sectionKey}.settings.data.templateDefinition.card`
    : shape === "exampleGallery"
      ? `sections.${sectionKey}.settings.data.examples.groups[${extra.groupIndex}].items[${extra.itemIndex}]`
      : shape === "workspaceCases"
        ? `sections.${sectionKey}.settings.data.workspaceCases[${index}]`
        : `sections.${sectionKey}.settings.data.visual.picker.cards[${index}]`;
const cardsContainerFor = (sectionKey) =>
  `sections.${sectionKey}.settings.data.visual.picker.cards`;

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    orderBy: { id: "asc" },
    select: {
      id: true, siteId: true, slug: true, title: true, pageType: true,
      templateKey: true, contentJson: true, updatedAt: true
    }
  });
  assert(rows.length > 0, `No LivePage rows for ${SITE_ID}.`);
  console.log(`rows loaded: ${rows.length}`);

  const pages = new Map();
  const pageEntryOf = (slug) => {
    const row = rows.find((item) => item.slug === slug);
    assert(row, `LivePage ${slug} disappeared.`);
    const entry = pages.get(slug) ?? {
      slug,
      pageHash: pageHash(row),
      cardWrites: [],
      pickerRemovals: [],
      pickerAdditions: []
    };
    pages.set(slug, entry);
    return entry;
  };

  const copies = []; // { page, sectionKey, shape, jsonPath, card }
  for (const row of rows) {
    const sections = record(record(row.contentJson)?.sections);
    for (const [sectionKey, sectionValue] of Object.entries(sections ?? {})) {
      assert(/^[A-Za-z0-9_-]+$/.test(sectionKey), `Section key "${sectionKey}" on ${row.slug} is not jsonPath-safe.`);
      const data = record(record(record(sectionValue)?.settings)?.data);
      if (!data) continue;
      for (const [shape, cardsOf] of SHAPES) {
        cardsOf(data).forEach((entry, index) => {
          const card = shape === "exampleGallery" ? entry?.item : entry;
          const extra = shape === "exampleGallery" ? { groupIndex: entry?.groupIndex, itemIndex: entry?.itemIndex } : undefined;
          const recordCard = record(card);
          if (!recordCard) return;
          copies.push({
            page: row.slug,
            sectionKey,
            shape,
            jsonPath: jsonPathFor(shape, sectionKey, index, extra),
            card: recordCard
          });
        });
      }
    }
  }
  console.log(`card copies walked: ${copies.length}`);

  // ---------- reviewed final placement per published slug ----------
  // Canonical reference: the placement of the canonical copy (publicSlug set,
  // no detailAliasOf). All canonical copies of one slug must agree; the
  // reviewed CANONICAL_TWEAKS override the reference.
  const canonicalReference = new Map(); // slug -> { placement, page }
  for (const copy of copies) {
    const slug = publicSlugOf(copy.card);
    if (!slug || aliasOf(copy.card) || !placementOf(copy.card).length) continue;
    const seen = canonicalReference.get(slug);
    if (!seen) {
      canonicalReference.set(slug, { placement: [...placementOf(copy.card)].sort(), page: copy.page });
      continue;
    }
    assert.deepEqual(
      placementOf(copy.card).sort(),
      seen.placement,
      `Canonical copies of ${slug} disagree between ${seen.page} and ${copy.page}; resolve before planning.`
    );
  }
  const finalOf = (slug, seen = new Set()) => {
    assert(!seen.has(slug), `Alias placement cycle at ${slug}.`);
    seen.add(slug);
    if (CANONICAL_TWEAKS.has(slug)) return [...new Set(CANONICAL_TWEAKS.get(slug))].sort();
    const alias = aliasSlugs.get(slug);
    if (alias) return finalOf(alias.target, seen);
    const seenRef = canonicalReference.get(slug);
    return seenRef ? [...seenRef.placement] : null;
  };

  // Alias detail slugs mirror their detailAliasOf target.
  const aliasSlugs = new Map(); // aliasSlug -> { target, page }
  for (const copy of copies) {
    const slug = publicSlugOf(copy.card);
    const aliasTarget = aliasOf(copy.card);
    if (!slug || !aliasTarget) continue;
    const seen = aliasSlugs.get(slug);
    assert(!seen || seen.target === aliasTarget,
      `Alias slug ${slug} points at two targets (${seen?.target} / ${aliasTarget}).`);
    if (!seen) aliasSlugs.set(slug, { target: aliasTarget, page: copy.page });
  }
  for (const [slug, { target: aliasTarget, page }] of aliasSlugs) {
    assert(!CANONICAL_TWEAKS.has(slug), `Alias slug ${slug} must not carry its own tweak (${page}).`);
    assert(finalOf(aliasTarget), `Alias slug ${slug} (${page}) mirrors ${aliasTarget}, which has no reviewed placement.`);
  }

  // ---------- reconcile every placement-carrying copy ----------
  let rewritten = 0;
  for (const copy of copies) {
    const card = copy.card;
    const slug = publicSlugOf(card);
    if (!slug || !placementOf(card).length) continue;
    const final = finalOf(slug);
    assert(final, `Slug ${slug} on ${copy.page} carries placement but has no reviewed final reference.`);
    for (const value of final) {
      assert(MEDIA_PLACEMENT_PATTERN.test(value), `Refusing placement value "${value}" for ${slug}.`);
    }
    if (JSON.stringify([...placementOf(card)].sort()) === JSON.stringify(final)) continue;
    rewritten += 1;
    const entry = pageEntryOf(copy.page);
    const nextCard = structuredClone(card);
    nextCard.placement = final;
    entry.cardWrites.push({
      shape: copy.shape,
      jsonPath: copy.shape === "picker" ? null : copy.jsonPath,
      cardsContainer: copy.shape === "picker" ? cardsContainerFor(copy.sectionKey) : null,
      match: {
        publicSlug: slug,
        detailAliasOf: aliasOf(card),
        label: labelOf(card),
        beforeHash: hash(cardSnapshot(card))
      },
      label: labelOf(card),
      kind: kindOf(card),
      publicSlug: slug,
      detailAliasOf: aliasOf(card),
      before: cardSnapshot(card),
      after: cardSnapshot(nextCard),
      beforeHash: hash(cardSnapshot(card)),
      afterHash: hash(cardSnapshot(nextCard)),
      operations: [{ field: "placement", from: placementOf(card), set: final }]
    });
  }

  // ---------- post-state policing: identity groups must not mix subjects ----------
  // The detail/facet renderer merges card copies by media identity (video src,
  // else image src). After the reconcile, every copy of one slug carries the
  // same reviewed placement — so an identity group that still spans several
  // slugs must span slugs with IDENTICAL reviewed placements, otherwise the
  // merged product would show a mixed tag set on facet grids.
  const byIdentity = new Map();
  for (const copy of copies) {
    const card = copy.card;
    if (!publicSlugOf(card) || aliasOf(card)) continue;
    const videoSrc = videoSrcOf(card);
    const imageSrc = text(card?.image?.src) || text(card?.video?.poster?.src);
    const kind = kindOf(card);
    const key = videoSrc ? `${kind}|video|${videoSrc}` : imageSrc ? `${kind}|image|${imageSrc}` : null;
    if (!key) continue;
    const group = byIdentity.get(key) ?? [];
    group.push(publicSlugOf(card));
    byIdentity.set(key, group);
  }
  const violations = [];
  for (const [key, slugs] of byIdentity) {
    const unique = [...new Set(slugs)];
    if (unique.length < 2) continue;
    const finals = new Set(unique.map((slug) => JSON.stringify(finalOf(slug))));
    if (finals.size > 1) {
      violations.push({ identity: key, slugs: unique, finals: [...finals].map((value) => JSON.parse(value)) });
    }
  }
  assert.equal(violations.length, 0, `Identity groups mix different reviewed placements: ${JSON.stringify(violations.slice(0, 6))}`);

  const pageList = [...pages.values()]
    .filter((entry) => entry.cardWrites.length)
    .sort((a, b) => a.slug.localeCompare(b.slug));

  const summary = {
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    canonicalTweaks: CANONICAL_TWEAKS.size,
    aliasSlugsMirrored: aliasSlugs.size,
    cardsRewritten: rewritten,
    cardWrites: pageList.reduce((total, entry) => total + entry.cardWrites.length, 0),
    pages: pageList.length
  };
  const manifest = {
    ok: true,
    contract: CONTRACT,
    confirmation: CONFIRMATION[target],
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    rule: "placement reconcile: every copy of a published slug carries the reviewed placement of that slug; alias detail slugs mirror their detailAliasOf target",
    summary,
    pages: pageList,
    operations: [],
    addresses: []
  };
  manifest.planHash = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
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
    summary
  }, null, 2));
} finally {
  await db.$disconnect();
}
