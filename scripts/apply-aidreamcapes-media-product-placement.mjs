#!/usr/bin/env node
// Field-level apply for Aidreamcapes product placement.
//
// The plan manifest is the review artifact. This script:
//   1. verifies the manifest hash;
//   2. re-reads every canonical LivePage row and verifies its base hash;
//   3. writes only the canonical card's `placement` field with updatedAt CAS;
//   4. reads the page back, advances/checks SiteContentRevision, and verifies
//      MyDreamShoots public content did not change.
//
// Dry-run is the default. Apply requires both the reviewed plan hash and the
// explicit confirmation phrase:
//   node scripts/apply-aidreamcapes-media-product-placement.mjs \
//     --target=local \
//     --apply \
//     --confirm=aidreamcapes-media-product-placement \
//     --base-hash=<planHash>
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertDatabaseTarget,
  assertAllowedSite,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const DEFAULT_MANIFEST = "scripts/manifests/aidreamcapes-media-product-placement-local-2026-10-21.json";
const CONTRACT = "aidreamcapes-media-product-placement-2026-10-21-v1";
const CONFIRMATION = "aidreamcapes-media-product-placement";
const PRODUCTION_CONFIRMATION = "aidreamcapes-media-product-placement-production";
const PLACEMENT_PATTERN = /^\/(industries|platforms|occasions)\/[a-z0-9][a-z0-9-]*$/;
const manifestPath = path.resolve(process.cwd(), argumentValue("--manifest") || DEFAULT_MANIFEST);
const apply = hasArgument("--apply");
const reportPath = path.resolve(
  process.cwd(),
  argumentValue("--report") ||
    "scripts/manifests/aidreamcapes-media-product-placement-local-2026-10-21-apply-report.json"
);

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function list(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim())
    : [];
}

function mediaKind(value) {
  if (value === "photo") return "photo";
  if (value === "video" || value === "clip" || value === "scene") return "video";
  return undefined;
}

function normalizedMediaSrc(value) {
  const src = text(value);
  if (!src) return undefined;
  return src.split(/[?#]/, 1)[0];
}

function mediaOf(card) {
  const image = record(card.image);
  const video = record(card.video);
  const poster = record(video?.poster);
  const videoSrc = normalizedMediaSrc(video?.src);
  const imageSrc = normalizedMediaSrc(image?.src);
  const posterSrc = normalizedMediaSrc(poster?.src);
  if (videoSrc) return { mediaType: "video", mediaSrc: videoSrc, stillSrc: imageSrc ?? posterSrc };
  if (imageSrc) return { mediaType: "image", mediaSrc: imageSrc };
  if (posterSrc) return { mediaType: "video", mediaSrc: posterSrc };
  return undefined;
}

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

function pointerParts(pointer) {
  assert(pointer.startsWith("/"), `Expected a JSON pointer, received ${pointer}.`);
  return pointer
    .slice(1)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
}

function getPointer(root, parts) {
  let current = root;
  for (const part of parts) {
    assert(current !== null && current !== undefined, `Missing pointer segment ${part}.`);
    current = current[part];
  }
  return current;
}

function setPointer(root, parts, value) {
  assert(parts.length > 0, "Cannot replace the document root.");
  const parent = getPointer(root, parts.slice(0, -1));
  assert(parent !== null && typeof parent === "object", `Pointer parent is not an object: ${parts.join("/")}`);
  parent[parts.at(-1)] = structuredClone(value);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function diffPaths(before, after, pointer = "", output = []) {
  if (hash(before) === hash(after)) return output;
  const beforeObject = record(before);
  const afterObject = record(after);
  if (beforeObject && afterObject) {
    for (const key of uniqueSorted([...Object.keys(beforeObject), ...Object.keys(afterObject)])) {
      diffPaths(beforeObject[key], afterObject[key], `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`, output);
    }
    return output;
  }
  if (
    Array.isArray(before) &&
    Array.isArray(after) &&
    before.length === after.length &&
    before.every((value) => record(value)) &&
    after.every((value) => record(value))
  ) {
    for (let index = 0; index < before.length; index += 1) {
      diffPaths(before[index], after[index], `${pointer}/${index}`, output);
    }
    return output;
  }
  output.push(pointer || "/");
  return output;
}

function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.ok, true, "Manifest is not an ok plan.");
  assert.equal(manifest.contract, CONTRACT, `Manifest contract must be ${CONTRACT}.`);
  assert.equal(manifest.siteId, SITE_ID, "Manifest must be scoped to site_aidreamcapes.");
  assert(Array.isArray(manifest.pages) && manifest.pages.length > 0, "Manifest has no pages.");
  assert(Array.isArray(manifest.items) && manifest.items.length > 0, "Manifest has no items.");
  assert.equal(manifest.summary?.products, manifest.items.length, "Manifest product count is inconsistent.");
  const recomputedPlanHash = hash({
    contract: manifest.contract,
    siteId: manifest.siteId,
    target: manifest.target,
    pages: manifest.pages,
    items: manifest.items
  });
  assert.equal(recomputedPlanHash, manifest.planHash, "Manifest content does not match its plan hash.");
  for (const page of manifest.pages) {
    assert.equal(typeof page.id, "string");
    assert.equal(typeof page.slug, "string");
    assert.equal(typeof page.baseHash, "string");
    assert(Number.isInteger(page.items) && page.items > 0, `Page ${page.slug} has no items.`);
  }
  for (const item of manifest.items) {
    assert.equal(typeof item.productKey, "string");
    assert.equal(typeof item.pageId, "string");
    assert.equal(typeof item.canonicalPublicSlug, "string");
    assert.equal(typeof item.fieldPath, "string");
    assert(Array.isArray(item.beforePlacement), `Item ${item.productKey} has no beforePlacement.`);
    assert(Array.isArray(item.placement) && item.placement.length > 0, `Item ${item.productKey} has no placement.`);
    for (const value of item.placement) assert(PLACEMENT_PATTERN.test(value), `Item ${item.productKey} has invalid placement ${value}.`);
    for (const value of item.beforePlacement) assert(PLACEMENT_PATTERN.test(value), `Item ${item.productKey} has invalid beforePlacement ${value}.`);
    assert.equal(pointerParts(item.fieldPath).at(-1), "placement", `Item ${item.productKey} fieldPath must point at placement.`);
  }
  return manifest;
}

function validateCard(content, item) {
  const card = getPointer(content, pointerParts(item.fieldPath).slice(0, -1));
  assert(record(card), `Product ${item.productKey}: canonical card is missing at ${item.fieldPath}.`);
  assert.equal(card.publicSlug, item.canonicalPublicSlug, `Product ${item.productKey}: canonical publicSlug changed.`);
  assert.equal(text(card.label) ?? text(card.title), item.expectedLabel, `Product ${item.productKey}: canonical label changed.`);
  assert.equal(mediaKind(card.kind), item.expectedKind, `Product ${item.productKey}: canonical kind changed.`);
  const media = mediaOf(card);
  assert(media, `Product ${item.productKey}: canonical media is missing.`);
  assert.equal(media.mediaType, item.expectedMediaType, `Product ${item.productKey}: canonical media type changed.`);
  assert.equal(media.mediaSrc, item.expectedMediaSrc, `Product ${item.productKey}: canonical media source changed.`);
  const before = uniqueSorted(list(card.placement));
  assert(sameStringArray(before, item.beforePlacement), `Product ${item.productKey}: canonical placement changed since planning.`);
  if (before.length && !sameStringArray(before, item.placement)) {
    throw new Error(
      `Product ${item.productKey}: current placement [${before.join(", ")}] conflicts with planned [${item.placement.join(", ")}]. Online edits win; stop and replan.`
    );
  }
  return card;
}

async function protectedMyDreamShootsHash(client) {
  const [pages, settings, profile] = await Promise.all([
    client.livePage.findMany({
      where: { siteId: "site_dreamshoot" },
      orderBy: { id: "asc" },
      select: { id: true, contentJson: true, updatedAt: true }
    }),
    client.themeSettings.findUnique({
      where: { siteId: "site_dreamshoot" },
      select: { draftJson: true, publishedJson: true }
    }),
    client.storefrontProfile.findUnique({
      where: { siteId: "site_dreamshoot" },
      select: { publishedJson: true }
    })
  ]);
  return hash({ pages, settings, profile });
}

const manifest = readManifest();
const target = argumentValue("--target") || manifest.target || "local";
assert.equal(manifest.target, target, `Manifest target ${manifest.target} does not match requested target ${target}.`);
const expectedConfirmation = target === "production" ? PRODUCTION_CONFIRMATION : CONFIRMATION;
if (apply) {
  assert.equal(argumentValue("--confirm"), expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert.equal(argumentValue("--base-hash"), manifest.planHash, "Apply requires --base-hash equal to the reviewed plan manifest hash.");
}
assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: target === "production",
  productionConfirmed: argumentValue("--confirm") === PRODUCTION_CONFIRMATION
});

const db = new PrismaClient({ errorFormat: "minimal" });
try {
  const pageIds = uniqueSorted(manifest.pages.map((page) => page.id));
  const rows = await db.livePage.findMany({
    where: { siteId: SITE_ID, id: { in: pageIds } },
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
  assert.equal(rows.length, pageIds.length, "One or more canonical pages disappeared since planning.");
  const rowsById = new Map(rows.map((row) => [row.id, row]));
  for (const page of manifest.pages) {
    const row = rowsById.get(page.id);
    assert(row, `Canonical page ${page.id} disappeared.`);
    assert.equal(row.slug, page.slug, `Canonical page ${page.id} changed slug.`);
    assert.equal(pageHash(row), page.baseHash, `Canonical page ${page.slug} changed since planning. Replan before applying.`);
  }

  const manifestsByPage = new Map();
  for (const item of manifest.items) {
    const page = manifest.pages.find((candidate) => candidate.id === item.pageId);
    assert(page, `Item ${item.productKey} references unknown page ${item.pageId}.`);
    const items = manifestsByPage.get(item.pageId) ?? [];
    items.push(item);
    manifestsByPage.set(item.pageId, items);
  }
  assert.equal(
    [...manifestsByPage.values()].reduce((total, items) => total + items.length, 0),
    manifest.items.length,
    "Manifest item/page assignment is inconsistent."
  );

  const pageUpdates = [];
  const allOperations = [];
  for (const page of manifest.pages) {
    const row = rowsById.get(page.id);
    const items = manifestsByPage.get(page.id) ?? [];
    assert.equal(items.length, page.items, `Page ${page.slug}: manifest item count changed.`);
    const next = structuredClone(row.contentJson);
    const operations = [];
    for (const item of items) {
      validateCard(row.contentJson, item);
      if (item.alreadyApplied) continue;
      const parts = pointerParts(item.fieldPath);
      setPointer(next, parts, item.placement);
      const updatedCard = getPointer(next, parts.slice(0, -1));
      assert(sameStringArray(uniqueSorted(list(updatedCard.placement)), item.placement), `Product ${item.productKey}: placement write did not verify.`);
      operations.push({
        productKey: item.productKey,
        publicSlug: item.canonicalPublicSlug,
        label: item.expectedLabel,
        fieldPath: item.fieldPath,
        before: item.beforePlacement,
        after: item.placement
      });
    }
    if (!operations.length) continue;
    const changedPaths = diffPaths(row.contentJson, next);
    const expectedPaths = new Set(operations.map((operation) => operation.fieldPath));
    for (const changedPath of changedPaths) {
      assert(expectedPaths.has(changedPath), `Page ${page.slug}: unexpected changed field ${changedPath}.`);
    }
    assert.equal(changedPaths.length, expectedPaths.size, `Page ${page.slug}: expected ${expectedPaths.size} placement changes, found ${changedPaths.length}.`);
    pageUpdates.push({ page, row, next, nextHash: hash(next), operations });
    allOperations.push(...operations);
  }

  const summary = {
    ok: true,
    mode: apply ? "apply" : "dry-run",
    contract: manifest.contract,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    manifest: path.relative(process.cwd(), manifestPath),
    products: manifest.items.length,
    pagesToUpdate: pageUpdates.length,
    fieldsToUpdate: allOperations.length,
    skippedAlreadyApplied: manifest.items.filter((item) => item.alreadyApplied).length,
    reviews: manifest.items.filter((item) => item.reviewNote).length,
    pages: pageUpdates.map((update) => ({
      slug: update.page.slug,
      fields: update.operations.length,
      products: update.operations.map((operation) => operation.publicSlug)
    }))
  };

  if (!apply || !allOperations.length) {
    console.log(JSON.stringify({
      ...summary,
      noop: apply && !allOperations.length,
      operations: allOperations
    }, null, 2));
  } else {
    const [revisionRelation] = await db.$queryRaw`SELECT to_regclass('public."SiteContentRevision"')::text AS relation`;
    assert(revisionRelation?.relation, "SiteContentRevision table is missing; refusing to write without derived-state revision.");
    const [revisionTrigger] = await db.$queryRaw`
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'public."LivePage"'::regclass
        AND tgname = 'SiteContentRevision_LivePage'
      LIMIT 1
    `;
    assert(revisionTrigger?.tgname, "SiteContentRevision_LivePage trigger is missing; refusing to write without derived-state revision.");

    const report = await db.$transaction(async (tx) => {
      const protectedBefore = await protectedMyDreamShootsHash(tx);
      const readRevision = async () => {
        const rows = await tx.$queryRaw`
          SELECT "revision"::text AS revision
          FROM "SiteContentRevision"
          WHERE "siteId" = ${SITE_ID}
          LIMIT 1
        `;
        return BigInt(rows[0]?.revision ?? "0");
      };
      const revisionBefore = await readRevision();
      const applied = [];

      for (const update of pageUpdates) {
        const current = await tx.livePage.findFirst({
          where: { id: update.page.id, siteId: SITE_ID },
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
        assert(current, `Page ${update.page.slug} disappeared during apply.`);
        assert.equal(pageHash(current), update.page.baseHash, `Page ${update.page.slug} changed after validation; aborting apply.`);
        const result = await tx.livePage.updateMany({
          where: { id: update.page.id, siteId: SITE_ID, updatedAt: current.updatedAt },
          data: { contentJson: update.next }
        });
        assert.equal(result.count, 1, `Page ${update.page.slug}: concurrent edit detected; aborting apply.`);
        const readback = await tx.livePage.findFirstOrThrow({
          where: { id: update.page.id, siteId: SITE_ID },
          select: { contentJson: true, updatedAt: true }
        });
        assert.equal(hash(readback.contentJson), update.nextHash, `Page ${update.page.slug}: content readback hash mismatch.`);
        for (const operation of update.operations) {
          const card = getPointer(readback.contentJson, pointerParts(operation.fieldPath).slice(0, -1));
          assert(sameStringArray(uniqueSorted(list(card.placement)), operation.after), `Page ${update.page.slug}: ${operation.productKey} placement readback mismatch.`);
        }
        applied.push({
          slug: update.page.slug,
          pageId: update.page.id,
          fields: update.operations.length,
          contentHash: update.nextHash,
          updatedAt: readback.updatedAt
        });
      }

      const revisionAfter = await readRevision();
      assert(revisionAfter > revisionBefore, `SiteContentRevision did not advance (${revisionBefore} -> ${revisionAfter}).`);
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the Aidreamcapes placement apply.");
      const [derivedRelation] = await tx.$queryRaw`
        SELECT to_regclass('public."SitePublishedState"')::text AS relation
      `;
      const derivedState = derivedRelation?.relation
        ? (await tx.$queryRaw`
            SELECT "revision"::text AS revision, "contentHash"
            FROM "SitePublishedState"
            WHERE "siteId" = ${SITE_ID}
            LIMIT 1
          `)[0] ?? null
        : null;
      return {
        ok: true,
        siteId: SITE_ID,
        target,
        planHash: manifest.planHash,
        owner: "LivePage.contentJson",
        applied,
        fieldsApplied: applied.reduce((total, page) => total + page.fields, 0),
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        revisionDelta: (revisionAfter - revisionBefore).toString(),
        protectedMyDreamShootsHashBefore: protectedBefore,
        protectedMyDreamShootsHashAfter: protectedAfter,
        myDreamShootsChanged: protectedAfter !== protectedBefore,
        derivedStateReadOnly: derivedState ? {
          revision: derivedState.revision.toString(),
          contentHash: derivedState.contentHash
        } : null,
        snapshotOrPublicationWritten: false,
        historicalStateActivated: false
      };
    }, { isolationLevel: "Serializable", timeout: 180000 });

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ ...summary, report }, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      ...summary,
      revisionBefore: report.revisionBefore,
      revisionAfter: report.revisionAfter,
      revisionDelta: report.revisionDelta,
      myDreamShootsChanged: report.myDreamShootsChanged,
      report: path.relative(process.cwd(), reportPath),
      operations: allOperations
    }, null, 2));
  }
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: apply ? "apply" : "dry-run",
    target,
    siteId: SITE_ID,
    planHash: manifest?.planHash,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
