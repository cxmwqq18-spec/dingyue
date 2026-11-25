#!/usr/bin/env node
// AIVideosUGC — retire the "Fitness: Recovery Tip" example.
//
// The rendered clip shows a second product blob floating on the presenter's
// shoulders, so the owner asked for the example to come down. Three relational
// places carry it:
//   /ai-video-generation/spokesperson-video -> visual.picker.cards[*].publicSlug = fitness-recovery-tip
//   /                              -> visual.picker.cards[*].href = /ai-video-generation/fitness-recovery-tip
//   /                              -> brandToolsDemo.actorWall.rows[*][*].video = .../fitness-recovery-tip-p10.mp4
// The actor-wall tile leaves too: it plays the same clip as a preview.
// One blog article embeds the clip as a media block; that block is repointed
// at the surviving example instead of leaving a hole in the article.
//
// The address itself is NOT deleted: media-detail.server.ts now maps the slug
// to /ai-video-generation/exercise-mat-recovery-chat, so the detail URL and
// the /watch twin keep answering 308 (never 404), and the sitemap drops both
// entries because they are enumerated from the cards.
//
// Usage:
//   node scripts/retire-aivideosugc-fitness-recovery-tip-2026-11-25.mjs --target=local
//   node scripts/retire-aivideosugc-fitness-recovery-tip-2026-11-25.mjs --target=local --apply --confirm=<name>
//   node scripts/retire-aivideosugc-fitness-recovery-tip-2026-11-25.mjs --target=production --apply --confirm=<name>
import crypto from "node:crypto";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument, } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-retire-fitness-recovery-tip-2026-11-25";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-retire-fitness-recovery-tip-2026-11-25.json", import.meta.url);
const SLUG = "fitness-recovery-tip";
const DETAIL_HREF = `/ai-video-generation/${SLUG}`;
const TARGET_SLUG = "exercise-mat-recovery-chat";
const TARGET_HREF = `/ai-video-generation/${TARGET_SLUG}`;
const EMBED_BLOG_SLUG = "/blog/ai-generated-ugc-ads-platform-for-health-and-fitness";
const siteId = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });
if (apply && target === "production") assert(confirmed, `Production update requires --confirm=${CONFIRM_NAME}`);

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}
function pickerCards(contentJson) {
  const cards = contentJson?.sections?.v2_main?.settings?.data?.visual?.picker?.cards;
  return Array.isArray(cards) ? cards : undefined;
}
function referencesSlug(value) {
  let found = 0;
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node.publicSlug === SLUG) found += 1;
    if (node.href === DETAIL_HREF) found += 1;
    if (typeof node.video === "string" && node.video.includes(SLUG)) found += 1;
    if (Array.isArray(node.publicAliases) && node.publicAliases.includes(SLUG)) found += 1;
    Object.values(node).forEach(walk);
  };
  walk(value);
  return found;
}

const db = new PrismaClient();
try {
  const rows = await db.livePage.findMany({
    where: { siteId, slug: { in: ["/ai-video-generation/spokesperson-video", "/"] } },
    select: { id: true, slug: true, contentJson: true, updatedAt: true }
  });
  assert.equal(rows.length, 2, `Expected the two owning rows, found ${rows.length}.`);
  const removals = [];
  const updates = [];
  for (const row of rows) {
    const next = structuredClone(row.contentJson);
    const cards = pickerCards(next);
    assert(cards, `Picker cards missing on ${row.slug}.`);
    const kept = [];
    for (const card of cards) {
      const ownsIt = card?.publicSlug === SLUG || card?.href === DETAIL_HREF;
      if (ownsIt) removals.push({ rowSlug: row.slug, where: "visual.picker.cards", card });
      else kept.push(card);
    }
    next.sections.v2_main.settings.data.visual.picker.cards = kept;

    // The homepage actor wall plays the same clip as a 10-second preview.
    const rowsField = next.sections?.v2_main?.settings?.data?.brandToolsDemo?.actorWall?.rows;
    if (Array.isArray(rowsField) && rowsField.length === 2) {
      rowsField[1] = rowsField[1].filter((actor) => {
        if (typeof actor?.video === "string" && actor.video.includes(SLUG)) {
          removals.push({ rowSlug: row.slug, where: "brandToolsDemo.actorWall.rows[1]", card: actor });
          return false;
        }
        return true;
      });
    }

    updates.push({ row, next });
  }
  assert(removals.length > 0, "Nothing matched the retired slug; refusing a no-op.");

  // The health-and-fitness article embeds the clip as a media block. Repoint
  // it at the surviving example (video, poster and caption together) so the
  // article keeps its example and the retired asset stops being served.
  const embedRow = await db.livePage.findFirst({
    where: { siteId, slug: EMBED_BLOG_SLUG },
    select: { id: true, slug: true, contentJson: true, updatedAt: true }
  });
  assert(embedRow, `Article ${EMBED_BLOG_SLUG} is missing on ${target}.`);
  const embedNext = structuredClone(embedRow.contentJson);
  const embedSections = embedNext?.sections?.v2_main?.settings?.data?.sections;
  assert(Array.isArray(embedSections), "Article sections missing.");
  const repointed = [];
  for (const section of embedSections) {
    if (!Array.isArray(section?.blocks)) continue;
    for (const block of section.blocks) {
      const embedsClip = typeof block?.src === "string" && block.src.includes(SLUG);
      const linksDetail = block?.href === DETAIL_HREF;
      if (!embedsClip && !linksDetail) continue;
      assert.equal(block.src, `/ai-video-generation/${SLUG}.mp4`, "Unexpected embedded clip source.");
      assert.equal(block.href, DETAIL_HREF, "Unexpected embedded clip link.");
      assert.equal(block.label, "Watch the Fitness Recovery Tip example", "Unexpected embedded clip caption.");
      assert.equal(block.poster?.src, "/ai-image-generation/actors/caleb-640.webp", "Unexpected embedded clip poster.");
      repointed.push({ before: { src: block.src, href: block.href, label: block.label, poster: block.poster }, after: {
        src: `/ai-video-generation/${TARGET_SLUG}.mp4`,
        href: TARGET_HREF,
        label: "Watch the Exercise Mat Recovery Chat example",
        poster: {
          alt: "an adult East Asian woman with a straight black bob sits cross-legged on a park exercise mat with open hands.",
          src: "/ai-image-generation/actors/akio-640.webp",
          width: 640,
          height: 1138
        }
      } });
      block.src = `/ai-video-generation/${TARGET_SLUG}.mp4`;
      block.href = TARGET_HREF;
      block.label = "Watch the Exercise Mat Recovery Chat example";
      block.poster = {
        alt: "an adult East Asian woman with a straight black bob sits cross-legged on a park exercise mat with open hands.",
        src: "/ai-image-generation/actors/akio-640.webp",
        width: 640,
        height: 1138
      };
    }
  }
  assert.equal(repointed.length, 1, `Expected one embedded clip in ${EMBED_BLOG_SLUG}, found ${repointed.length}.`);
  updates.push({ row: embedRow, next: embedNext });

  // No other row may keep a reference to the retired slug (detail link, alias,
  // card, or preview clip). A targeted jsonpath lookup keeps this cheap over a
  // production tunnel; the two rows we own are checked on the new document.
  const otherOwners = await db.$queryRaw`
    SELECT "slug" FROM "LivePage"
    WHERE "siteId" = ${siteId}
      AND (
        jsonb_path_exists("contentJson", '$.**.publicSlug ? (@ == $slug)', jsonb_build_object('slug', ${SLUG}))
        OR jsonb_path_exists("contentJson", '$.**.href ? (@ == $href)', jsonb_build_object('href', ${DETAIL_HREF}))
        OR jsonb_path_exists("contentJson", '$.**.publicAliases[*] ? (@ == $slug)', jsonb_build_object('slug', ${SLUG}))
        OR "contentJson"::text LIKE ${`%${SLUG}%`}
      )
  `;
  const ownedSlugs = new Set(updates.map(({ row }) => row.slug));
  for (const candidate of otherOwners) {
    assert.ok(ownedSlugs.has(candidate.slug), `Retired slug is still referenced on ${candidate.slug}.`);
  }
  for (const { row, next } of updates) {
    assert.equal(referencesSlug(next), 0, `Retired slug still referenced on ${row.slug}.`);
  }

  const changed = updates.some(({ row, next }) => hash(next) !== hash(row.contentJson));
  if (apply && changed) {
    for (const { row, next } of updates) {
      const update = await db.livePage.updateMany({
        where: { id: row.id, siteId, slug: row.slug, updatedAt: row.updatedAt },
        data: { contentJson: next }
      });
      assert.equal(update.count, 1, `Row ${row.slug} changed during apply.`);
      const readback = await db.livePage.findUnique({
        where: { siteId_slug: { siteId, slug: row.slug } },
        select: { contentJson: true }
      });
      assert.equal(hash(readback?.contentJson), hash(next), `Readback mismatch on ${row.slug}.`);
    }
  }

  fs.mkdirSync(new URL("./manifests/", import.meta.url), { recursive: true });
  const manifest = {
    date: "2026-11-25",
    siteId,
    target,
    mode: apply ? "applied" : "plan",
    slug: SLUG,
    detailPath: DETAIL_HREF,
    redirectTarget: "/ai-video-generation/exercise-mat-recovery-chat",
    removedCards: removals,
    repointedEmbeds: repointed,
    rows: updates.map(({ row, next }) => ({ slug: row.slug, baseHash: hash(row.contentJson), nextHash: hash(next) })),
    changed,
    note: "Removes both relational cards for the retired fitness example. The detail and watch URLs 308 to a living fitness example; media files stay in place so already-indexed asset URLs keep answering 200."
  };
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({
    ok: true,
    mode: manifest.mode,
    target,
    changed,
    removed: removals.map((entry) => ({
      row: entry.rowSlug,
      where: entry.where,
      label: entry.card?.label ?? entry.card?.name,
      publicSlug: entry.card?.publicSlug,
      href: entry.card?.href,
      video: entry.card?.video
    })),
    manifest: MANIFEST_PATH.pathname
  }, null, 2));
} finally {
  await db.$disconnect();
}
