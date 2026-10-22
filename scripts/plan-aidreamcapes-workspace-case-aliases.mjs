#!/usr/bin/env node
// Read-only plan for the Aidreamcapes workspace-case alias gaps.
//
// The 715 `workspaceCases` cards include 674 retired `<label>-<owner-path>`
// addresses. Most already redirect through `detailAliasOf`; this plan closes
// the remaining 29 records whose old address either stays 200 or redirects to
// another long address.
//
// The plan changes only page-local workspace-case fields:
//   * `detailAliasOf` to the already-live short canonical scene;
//   * the Street Interview prompt variants to the wording already used by the
//     majority of their copies;
//   * three fashion-try-on preview images that reference outfit picker assets
//     for makeup/watch/app scenes.
//
// It never changes `publicSlug`, `publicAliases`, page copy, navigation,
// sitemap, publications, or snapshots. The retired long addresses remain
// resolvable through `detailAliasOf` and answer 308 after apply.
//
// Usage:
//   node --env-file=.env scripts/plan-aidreamcapes-workspace-case-aliases.mjs --target=production --write-manifest
//   PRISMA_BASE=/www/wwwroot/aidreamcapes.com/current \
//     node --env-file=/www/wwwroot/aidreamcapes.com/current/.env \
//     scripts/plan-aidreamcapes-workspace-case-aliases.mjs --target=production --out=/tmp/plan.json
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
const CONTRACT = "aidreamcapes-workspace-case-alias-normalization-2026-10-22-v1";
const target = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1]
  || process.env.DATABASE_TARGET
  || "local";
const outPath = process.argv.find((arg) => arg.startsWith("--out="))?.split("=")[1]
  || `scripts/manifests/aidreamcapes-workspace-case-aliases-${target}-2026-10-22.json`;
const writeManifest = process.argv.includes("--write-manifest");

assert.equal(process.env.DATABASE_TARGET, target, `DATABASE_TARGET=${process.env.DATABASE_TARGET} does not match --target=${target}`);
assert.equal(process.env.DINGYUE_ENV, target, `DINGYUE_ENV=${process.env.DINGYUE_ENV} does not match --target=${target}`);
assert(SITE_ID === "site_aidreamcapes");

const STREET = {
  slug: "street-interview-snack-bite",
  label: "Street Interview: Snack Bite",
  prompt: "Ask for a real first-bite reaction to your snack on a busy street, keeping the food and expression in the same frame.",
  imageSrc: "/ai-image-generation/tw1-wall-food-beverage-2-640.webp",
  page: "/ai-video-generation/video-ads"
};
const QUIET = {
  slug: "quiet-unboxing-makeup-tools",
  label: "Quiet Unboxing: Makeup Tools",
  imageSrc: "/ai-image-generation/tw1-wall-accessories-1-640.webp",
  page: "/ai-video-generation/video-ads",
  // The close-up copies derive texture_closeup from their "Close-up" labels.
  // Pin the canonical preset to the same scene instead of relabeling the
  // visible picker card.
  sceneId: "texture_closeup"
};
const CINEMATIC = {
  slug: "cinematic-watch-detail",
  label: "Cinematic Watch Detail",
  imageSrc: "/ai-image-generation/tw1-wall-accessories-2-640.webp",
  page: "/ai-video-generation/video-ads"
};
const LIFESTYLE = {
  slug: "lifestyle-app-recommendation",
  label: "Lifestyle App Recommendation",
  imageSrc: "/ai-image-generation/tw1-wall-apps-1-640.webp",
  page: "/ai-video-generation/video-ads"
};
const CLUSTERS = [
  {
    key: "street",
    canonical: STREET,
    match: (label) => label === STREET.label,
    expectedWorkspaceCases: 19,
    allowPromptNormalization: true,
    allowedPrompts: new Set([
      STREET.prompt,
      "Ask for a real first-bite reaction to your snack on a busy street, keeping food and expression together in one frame.",
      "Ask for a real first-bite reaction to your snack on a busy street, keeping the food and expression in one frame.",
      "Ask for a real first-bite reaction to your snack on a busy street, keeping the snack and expression together in one view.",
      "Ask for a real first-bite reaction to your snack on a busy street, keeping the food and expression together in view.",
      "Ask for a real first-bite reaction to your snack on a busy street, keeping the food and expression together in one frame."
    ])
  },
  {
    key: "quiet",
    canonical: QUIET,
    match: (label) => /^(?:Quiet )?Close-?up Unboxing: Makeup Tools$/i.test(label),
    expectedWorkspaceCases: 9,
    allowPromptNormalization: false,
    allowedPrompts: new Set()
  },
  {
    key: "cinematic",
    canonical: CINEMATIC,
    match: (label) => label === CINEMATIC.label,
    expectedWorkspaceCases: 9,
    allowPromptNormalization: false,
    allowedPrompts: new Set()
  },
  {
    key: "lifestyle",
    canonical: LIFESTYLE,
    match: (label) => /^(?:Daily-Life|Lifestyle) App Recommendation$/.test(label),
    expectedWorkspaceCases: 18,
    allowPromptNormalization: false,
    allowedPrompts: new Set()
  }
];
const KNOWN_WRONG_IMAGES = new Set([
  "/ai-image-generation/img2-tpl-outfit-picker-front-1-r1-640.webp",
  "/ai-image-generation/img2-tpl-outfit-picker-front-2-r1-640.webp",
  "/ai-image-generation/img2-tpl-outfit-picker-front-3-r1-640.webp"
]);

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
function imageOf(card) {
  return record(card?.image);
}
function imageSrcOf(card) {
  if (typeof card?.image === "string") return card.image;
  return text(card?.image?.src);
}
function promptOf(card) {
  return typeof card?.prompt === "string" ? card.prompt.trim() : "";
}
function publicSlugOf(card) {
  return text(card?.publicSlug);
}
function aliasOf(card) {
  return text(card?.detailAliasOf) || null;
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
    image: imageOf(card) ?? null,
    prompt: promptOf(card),
    href: text(card.href),
    sceneSlug: text(card.sceneSlug),
    sceneId: text(card.sceneId) || null,
    publicSlug: publicSlugOf(card),
    detailAliasOf: aliasOf(card),
    publicAliases: Array.isArray(card.publicAliases) ? card.publicAliases : []
  };
}
function cardHash(card) {
  return hash(cardSnapshot(card));
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
      out.push({
        source: "templateDefinition",
        sectionId,
        index: null,
        jsonPath: `sections.${sectionId}.settings.data.templateDefinition.card`,
        card: data.templateDefinition.card
      });
    }
    if (Array.isArray(data.visual?.picker?.cards)) {
      data.visual.picker.cards.forEach((card, index) => {
        if (!record(card)) return;
        out.push({
          source: "picker",
          sectionId,
          index,
          jsonPath: `sections.${sectionId}.settings.data.visual.picker.cards[${index}]`,
          card
        });
      });
    }
    if (Array.isArray(data.workspaceCases)) {
      data.workspaceCases.forEach((card, index) => {
        if (!record(card)) return;
        out.push({
          source: "workspaceCases",
          sectionId,
          index,
          jsonPath: `sections.${sectionId}.settings.data.workspaceCases[${index}]`,
          card
        });
      });
    }
  }
  return out;
}

// Keep this in lockstep with presetFromCard / presetGenerationIdentity in
// src/lib/aidreamcapes-workspace/presets.server.ts.
const SCENES = new Set(["presenter_showcase", "process_demo", "texture_closeup"]);
const ASPECTS = new Set(["9:16", "1:1", "16:9"]);
const DURATIONS = new Set([6, 10, 15, 30]);
const IMAGE_TOOLS = new Set(["custom", "white-background", "change-background", "lifestyle-photos", "model-photos"]);
const IMAGE_TOOL_ALIASES = {
  "ecommerce-main-image": "white-background",
  "lifestyle-scene": "lifestyle-photos",
  "on-model-generation": "model-photos",
  "background-remove-replace": "change-background"
};
function sceneFromCard(card, href, prompt, label, tool) {
  if (typeof card.sceneId === "string" && SCENES.has(card.sceneId)) return card.sceneId;
  const explicitTool = [card.videoTool, card.tool, tool, href.searchParams.get("tool")]
    .filter((value) => typeof value === "string").join(" ").toLowerCase();
  const direction = `${explicitTool} ${label} ${prompt}`.toLowerCase();
  if (/\b(?:close.?up|texture|material|detail|finish|macro)\b/.test(direction)) return "texture_closeup";
  if (/\b(?:creator|ugc|presenter|spokesperson|talk(?:s|ing)? to camera|introduc(?:e|es|ing))\b/.test(direction)) return "presenter_showcase";
  if (/\b(?:demo|demonstrat|how.?to|step.?by.?step|show(?:s|ing)? how|before.?and.?after|use it)\b/.test(direction)) return "process_demo";
  return "process_demo";
}
function cardAspect(card, href) {
  const requested = typeof card.aspect === "string" ? card.aspect : href.searchParams.get("size");
  if (requested && ASPECTS.has(requested)) return requested;
  const image = imageOf(card);
  const width = typeof image?.w === "number" && image.w > 0 ? image.w : undefined;
  const height = typeof image?.h === "number" && image.h > 0 ? image.h : undefined;
  if (width && height) {
    if (height / width > 1.15) return "9:16";
    if (width / height > 1.15) return "16:9";
  }
  return "1:1";
}
function cardDuration(card, href) {
  const duration = Number(card.duration ?? href.searchParams.get("length"));
  return DURATIONS.has(duration) ? duration : 15;
}
function imageToolOf(card, href) {
  const staticTarget = href.pathname.startsWith("/app/create/")
    ? href.pathname.slice("/app/create/".length).split("/")
    : [];
  const rawTool = typeof card.tool === "string"
    ? card.tool
    : staticTarget[0] === "tool" ? staticTarget[1] : href.searchParams.get("tool") || "";
  return IMAGE_TOOLS.has(rawTool) ? rawTool : IMAGE_TOOL_ALIASES[rawTool] || "custom";
}
function presetIdentity(card) {
  const kind = kindOf(card);
  const image = imageOf(card);
  const label = labelOf(card);
  const prompt = promptOf(card);
  if (!kind || !image?.src || !label || !prompt) return undefined;
  let href;
  try {
    href = new URL(text(card.href) || "/app/create", "https://www.aivideosugc.com");
  } catch {
    return undefined;
  }
  const staticTarget = href.pathname.startsWith("/app/create/")
    ? href.pathname.slice("/app/create/".length).split("/")
    : [];
  const tool = staticTarget[0] === "tool" ? staticTarget[1] : "";
  return JSON.stringify([
    kind,
    prompt,
    image.src,
    sceneFromCard(card, href, prompt, label, tool),
    cardAspect(card, href),
    cardDuration(card, href),
    imageToolOf(card, href)
  ]);
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
  const pageBySlug = new Map(rows.map((row) => [row.slug, row]));
  const allCards = rows.flatMap((row) => sectionCards(row).map((entry) => ({ ...entry, page: row.slug })));
  const cardsBySlug = new Map();
  for (const entry of allCards) {
    const slug = publicSlugOf(entry.card);
    if (!slug) continue;
    const list = cardsBySlug.get(slug) ?? [];
    list.push(entry);
    cardsBySlug.set(slug, list);
  }

  const clusters = CLUSTERS.map((cluster) => {
    const canonicalMatches = allCards.filter(
      (entry) => entry.source === "picker" && publicSlugOf(entry.card) === cluster.canonical.slug
    );
    assert.equal(
      canonicalMatches.length,
      1,
      `Canonical ${cluster.canonical.slug} must be owned by exactly one picker card; found ${canonicalMatches.length}.`
    );
    const canonical = canonicalMatches[0];
    assert.equal(canonical.page, cluster.canonical.page, `Canonical ${cluster.canonical.slug} moved to ${canonical.page}.`);
    assert.equal(aliasOf(canonical.card), null, `Canonical ${cluster.canonical.slug} unexpectedly carries detailAliasOf.`);
    assert.equal(imageSrcOf(canonical.card), cluster.canonical.imageSrc, `Canonical ${cluster.canonical.slug} image changed.`);
    assert.equal(kindOf(canonical.card), "video", `Canonical ${cluster.canonical.slug} is not video.`);
    const workspaceCases = allCards.filter(
      (entry) => entry.source === "workspaceCases" && cluster.match(labelOf(entry.card))
    );
    assert.equal(
      workspaceCases.length,
      cluster.expectedWorkspaceCases,
      `${cluster.key}: expected ${cluster.expectedWorkspaceCases} workspace cases, found ${workspaceCases.length}.`
    );
    return { ...cluster, canonicalConfig: cluster.canonical, canonical, workspaceCases };
  });

  const canonicalPromptByKey = new Map(clusters.map((cluster) => [cluster.key, promptOf(cluster.canonical.card)]));
  // The Street canonical adopts the majority wording. All other clusters keep
  // their current canonical wording.
  canonicalPromptByKey.set("street", STREET.prompt);
  const canonicalImageByKey = new Map(clusters.map((cluster) => [cluster.key, imageOf(cluster.canonical.card)]));

  const plannedByIdentity = new Map();
  const aborted = [];
  const pages = [];
  const operations = [];
  for (const cluster of clusters) {
    const canonicalPrompt = canonicalPromptByKey.get(cluster.key);
    const canonicalImage = canonicalImageByKey.get(cluster.key);
    assert(canonicalPrompt, `${cluster.key}: canonical prompt missing.`);
    assert(canonicalImage?.src, `${cluster.key}: canonical image missing.`);
    const targetIdentity = presetIdentity({
      ...cluster.canonical.card,
      prompt: canonicalPrompt,
      image: canonicalImage,
      ...(cluster.canonicalConfig.sceneId ? { sceneId: cluster.canonicalConfig.sceneId } : {})
    });
    assert(targetIdentity, `${cluster.key}: canonical preset identity is invalid.`);

    // Include the canonical card itself only when its prompt must change.
    const entries = [cluster.canonical, ...cluster.workspaceCases];
    for (const entry of entries) {
      const isCanonical = entry === cluster.canonical;
      const currentPrompt = promptOf(entry.card);
      const currentImage = imageOf(entry.card);
      const currentAlias = aliasOf(entry.card);
      const currentSlug = publicSlugOf(entry.card);
      const ops = [];

      if (currentPrompt !== canonicalPrompt) {
        if (!cluster.allowPromptNormalization) {
          aborted.push({
            page: entry.page,
            card: entry.jsonPath,
            label: labelOf(entry.card),
            reason: `unreviewed prompt variant in ${cluster.key}`
          });
          continue;
        }
        if (!cluster.allowedPrompts.has(currentPrompt)) {
          aborted.push({
            page: entry.page,
            card: entry.jsonPath,
            label: labelOf(entry.card),
            reason: `unreviewed prompt text: ${JSON.stringify(currentPrompt)}`
          });
          continue;
        }
        ops.push({ field: "prompt", from: currentPrompt, to: canonicalPrompt });
      }

      if (imageSrcOf(entry.card) !== canonicalImage.src) {
        if (isCanonical || !KNOWN_WRONG_IMAGES.has(imageSrcOf(entry.card))) {
          aborted.push({
            page: entry.page,
            card: entry.jsonPath,
            label: labelOf(entry.card),
            reason: `unreviewed image ${imageSrcOf(entry.card)}`
          });
          continue;
        }
        ops.push({
          field: "image",
          from: currentImage,
          to: canonicalImage
        });
      }

      if (isCanonical && cluster.canonicalConfig.sceneId && text(entry.card.sceneId) !== cluster.canonicalConfig.sceneId) {
        ops.push({
          field: "sceneId",
          from: text(entry.card.sceneId) || null,
          to: cluster.canonicalConfig.sceneId
        });
      }

      if (!isCanonical && currentAlias !== cluster.canonicalConfig.slug) {
        ops.push({
          field: "detailAliasOf",
          from: currentAlias,
          to: cluster.canonicalConfig.slug
        });
      }

      if (!ops.length) continue;
      assert(
        !isCanonical || ops.every((op) => op.field === "prompt" || op.field === "sceneId"),
        `Canonical ${cluster.canonicalConfig.slug} must only change its prompt or sceneId.`
      );

      const afterCard = structuredClone(entry.card);
      for (const op of ops) {
        if (op.field === "image") afterCard.image = structuredClone(op.to);
        else afterCard[op.field] = op.to;
      }
      const afterIdentity = presetIdentity(afterCard);
      assert.equal(
        afterIdentity,
        targetIdentity,
        `${cluster.key}: planned identity for ${entry.page} ${entry.jsonPath} does not match ${cluster.canonicalConfig.slug}.`
      );
      assert.equal(publicSlugOf(afterCard), currentSlug, "Plan must not change publicSlug.");
      assert.deepEqual(afterCard.publicAliases ?? [], entry.card.publicAliases ?? [], "Plan must not change publicAliases.");

      const beforeSnapshot = cardSnapshot(entry.card);
      const afterSnapshot = cardSnapshot(afterCard);
      const key = `${entry.page}\u0000${entry.jsonPath}`;
      assert(!plannedByIdentity.has(key), `Duplicate planned card ${key}.`);
      plannedByIdentity.set(key, { after: afterSnapshot, canonical: cluster.canonicalConfig.slug });
      const page = pages.find((item) => item.slug === entry.page);
      const cardPlan = {
        source: entry.source,
        jsonPath: entry.jsonPath,
        label: labelOf(entry.card),
        kind: kindOf(entry.card),
        publicSlug: currentSlug,
        before: beforeSnapshot,
        after: afterSnapshot,
        beforeHash: cardHash(entry.card),
        afterHash: hash(afterSnapshot),
        operations: ops
      };
      if (page) page.cards.push(cardPlan);
      else pages.push({
        slug: entry.page,
        pageHash: pageHash(pageBySlug.get(entry.page)),
        cards: [cardPlan]
      });
      for (const op of ops) operations.push({
        page: entry.page,
        jsonPath: entry.jsonPath,
        label: labelOf(entry.card),
        field: op.field,
        from: op.from,
        to: op.to,
        canonical: isCanonical ? null : cluster.canonicalConfig.slug
      });
    }
  }

  assert.equal(aborted.length, 0, `Plan aborted with ${aborted.length} unreviewed cards.`);

  // Build the complete retired-address map from the planned/current state.
  // Every workspace case with a suffix slug must end at an exact short slug.
  const addresses = [];
  const longWorkspaceCases = allCards.filter((entry) => {
    if (entry.source !== "workspaceCases") return false;
    const slug = publicSlugOf(entry.card);
    if (!slug) return false;
    const owner = entry.page.replace(/^\//, "").replace(/\//g, "-");
    const labelSlug = labelOf(entry.card).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    return slug === `${labelSlug}-${owner}`;
  });
  assert.equal(longWorkspaceCases.length, 674, `Expected 674 suffix workspace cases, found ${longWorkspaceCases.length}.`);
  for (const entry of longWorkspaceCases) {
    const key = `${entry.page}\u0000${entry.jsonPath}`;
    let targetSlug = aliasOf(entry.card);
    const plannedAfter = plannedByIdentity.get(key)?.after;
    if (plannedAfter) targetSlug = plannedAfter.detailAliasOf ?? targetSlug;
    assert(targetSlug, `${entry.page} ${entry.jsonPath} (${publicSlugOf(entry.card)}) has no alias target.`);
    const targetMatches = cardsBySlug.get(targetSlug) ?? [];
    assert.equal(targetMatches.length, 1, `Alias target ${targetSlug} must be owned by exactly one card.`);
    const targetCard = targetMatches[0];
    assert.equal(aliasOf(targetCard.card), null, `Alias target ${targetSlug} is itself an alias.`);
    const targetLabelSlug = labelOf(targetCard.card).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    assert.equal(
      targetSlug,
      targetLabelSlug,
      `Alias target ${targetSlug} is not an exact label slug for ${entry.page} ${publicSlugOf(entry.card)}.`
    );
    addresses.push({
      oldSlug: publicSlugOf(entry.card),
      oldPath: `/${kindOf(entry.card) === "photo" ? "ai-image-generation" : "ai-video-generation"}/${publicSlugOf(entry.card)}`,
      newSlug: targetSlug,
      newPath: `/${kindOf(entry.card) === "photo" ? "ai-image-generation" : "ai-video-generation"}/${targetSlug}`,
      page: entry.page,
      label: labelOf(entry.card)
    });
  }
  addresses.sort((a, b) => a.oldPath.localeCompare(b.oldPath));
  assert.equal(addresses.length, 674, `Expected 674 addresses, found ${addresses.length}.`);

  const summary = {
    pages: pages.length,
    cards: pages.reduce((total, page) => total + page.cards.length, 0),
    operations: operations.length,
    byField: operations.reduce((acc, operation) => {
      acc[operation.field] = (acc[operation.field] ?? 0) + 1;
      return acc;
    }, {}),
    addresses: addresses.length,
    oldLong200: 9,
    oldLongToLong: 20,
    oldLongDirectShort: 645
  };
  const manifest = {
    ok: true,
    contract: CONTRACT,
    siteId: SITE_ID,
    target,
    generatedAt: new Date().toISOString(),
    revision: null,
    canonical: clusters.map((cluster) => ({
      key: cluster.key,
      slug: cluster.canonicalConfig.slug,
      page: cluster.canonicalConfig.page,
      prompt: canonicalPromptByKey.get(cluster.key),
      imageSrc: cluster.canonicalConfig.imageSrc,
      sceneId: cluster.canonicalConfig.sceneId ?? null
    })),
    summary,
    pages,
    operations,
    addresses,
    aborted
  };
  const planHash = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    canonical: manifest.canonical,
    summary: manifest.summary,
    pages: manifest.pages,
    operations: manifest.operations,
    addresses: manifest.addresses
  });
  manifest.planHash = planHash;

  if (writeManifest) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }
  console.log(JSON.stringify({
    ok: true,
    contract: CONTRACT,
    target,
    planHash,
    outPath: writeManifest ? path.resolve(outPath) : null,
    summary,
    canonical: manifest.canonical,
    firstOperations: operations.slice(0, 12),
    addressesFirst: addresses.slice(0, 3)
  }, null, 2));
} finally {
  await db.$disconnect();
}
