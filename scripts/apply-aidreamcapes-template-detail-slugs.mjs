#!/usr/bin/env node
// Field-level apply for reviewed Aidreamcapes detail-slug manifests.
//
// The reviewed manifest is the review artifact. This script:
//   1. verifies the manifest hash and the scoped target;
//   2. re-reads every affected LivePage row and verifies its base hash;
//   3. verifies every reviewed card still carries the reviewed label +
//      image.src + kind fingerprint;
//   4. writes only two fields per card - `publicSlug` and `publicAliases`;
//   5. verifies the old slug remains owned by exactly the same page, the new
//      slug is not owned by another page/card/alias, and no LivePage path
//      collides with the new address;
//   6. reads every row back, checks SiteContentRevision advanced once per
//      page, and verifies MyDreamShoots public content did not change.
//
// Dry-run is the default. Apply requires the reviewed plan hash and the
// explicit confirmation phrase:
//   node scripts/apply-aidreamcapes-template-detail-slugs.mjs --target=local
//   node scripts/apply-aidreamcapes-template-detail-slugs.mjs --target=local --apply \
//     --confirm=site_aidreamcapes-template-detail-slugs --base-hash=<planHash>
// Production additionally requires:
//   --target=production --confirm=site_aidreamcapes-template-detail-slugs-production
//
// A page whose pair already carries the planned slug and aliases is skipped,
// so an applied manifest can be replayed. A page whose pair is mixed or carries
// a different slug is never overwritten: the online edit wins and the run
// reports it.
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
const TEMPLATE_CONTRACT = "aidreamcapes-template-detail-slug-normalization-2026-10-22-v1";
const HUB_EXAMPLE_CONTRACT = "aidreamcapes-hub-example-slug-normalization-2026-10-22-v1";
const EXAMPLE_PREFIX_CONTRACT = "aidreamcapes-example-prefix-slug-normalization-2026-10-22-v1";
const SUPPORTED_CONTRACTS = new Set([TEMPLATE_CONTRACT, HUB_EXAMPLE_CONTRACT, EXAMPLE_PREFIX_CONTRACT]);
const REPORT_SLUGS = new Map([
  [TEMPLATE_CONTRACT, "template-detail-slugs"],
  [HUB_EXAMPLE_CONTRACT, "hub-example-slugs"],
  [EXAMPLE_PREFIX_CONTRACT, "example-prefix-slugs"]
]);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const confirmation = argumentValue("--confirm");
const baseHash = argumentValue("--base-hash");
const apply = hasArgument("--apply");
const expectedConfirmation = target === "production"
  ? "site_aidreamcapes-template-detail-slugs-production"
  : "site_aidreamcapes-template-detail-slugs";
const defaultManifestPath = path.resolve(
  process.cwd(),
  `scripts/manifests/aidreamcapes-template-detail-slugs-${target}-2026-10-22.json`
);
const manifestPath = argumentValue("--manifest")
  ? path.resolve(process.cwd(), argumentValue("--manifest"))
  : defaultManifestPath;

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
  const steps = parseJsonPath(jsonPath);
  let node = contentJson;
  for (const step of steps) {
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

assert(fs.existsSync(manifestPath), `Manifest not found: ${manifestPath}. Run the plan script first.`);
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert.equal(manifest.ok, true, "Manifest is not an ok plan.");
assert(SUPPORTED_CONTRACTS.has(manifest.contract), `Unsupported manifest contract: ${manifest.contract}.`);
const contract = manifest.contract;
assert.equal(manifest.siteId, SITE_ID, "Manifest must be scoped to site_aidreamcapes.");
assert.equal(manifest.target, target, `Manifest target ${manifest.target} does not match requested target ${target}.`);
const recomputed = hash({
  contract: manifest.contract,
  siteId: manifest.siteId,
  target: manifest.target,
  approvedPages: manifest.approvedPages,
  excludedPages: manifest.excludedPages,
  pages: manifest.pages,
  skipped: manifest.skipped,
  addresses: manifest.addresses
});
assert.equal(recomputed, manifest.planHash, "Manifest content does not match its plan hash.");

assertDatabaseTarget({
  expectedTarget: target,
  requireProductionConfirmation: apply && target === "production",
  productionConfirmed: confirmation === expectedConfirmation
});
if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  assert(baseHash, "Apply requires --base-hash=<manifest planHash>.");
  assert.equal(baseHash, manifest.planHash, "The reviewed plan hash does not match the manifest; re-run the plan and review it again.");
}

const db = new PrismaClient({ errorFormat: "minimal" });
const aborted = [];
const skipped = [];
const writes = [];
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
  const byId = new Map(rows.map((row) => [row.id, row]));
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

  const planned = [];
  const plannedTargetOwners = new Map();
  const plannedOldOwners = new Map();
  for (const page of manifest.pages ?? []) {
    for (const card of page.cards ?? []) {
      const targetOwner = plannedTargetOwners.get(card.afterSlug) ?? { page: page.slug, paths: new Set() };
      if (targetOwner.page !== page.slug) {
        aborted.push({ page: page.slug, reason: `target slug ${card.afterSlug} is planned by both ${targetOwner.page} and ${page.slug}` });
      }
      targetOwner.paths.add(card.jsonPath);
      plannedTargetOwners.set(card.afterSlug, targetOwner);

      const oldOwner = plannedOldOwners.get(card.beforeSlug) ?? { page: page.slug, paths: new Set() };
      if (oldOwner.page !== page.slug) {
        aborted.push({ page: page.slug, reason: `retired slug ${card.beforeSlug} is planned by both ${oldOwner.page} and ${page.slug}` });
      }
      oldOwner.paths.add(card.jsonPath);
      plannedOldOwners.set(card.beforeSlug, oldOwner);
    }
  }
  if (aborted.length) {
    console.log(JSON.stringify({
      ok: false,
      mode: apply ? "apply" : "dry-run",
      contract,
      siteId: SITE_ID,
      target,
      planHash: manifest.planHash,
      manifest: path.relative(process.cwd(), manifestPath),
      pagesPlanned: 0,
      cardsPlanned: 0,
      pagesAlreadyApplied: 0,
      aborted,
      skipped
    }, null, 2));
    process.exitCode = 1;
    await db.$disconnect();
    process.exit(1);
  }

  for (const page of manifest.pages ?? []) {
    const row = byId.get(page.id);
    if (!row) {
      aborted.push({ page: page.slug, reason: `LivePage ${page.id} no longer exists` });
      continue;
    }
    if (row.siteId !== SITE_ID) {
      aborted.push({ page: page.slug, reason: `LivePage belongs to ${row.siteId}, not ${SITE_ID}` });
      continue;
    }
    if (row.slug !== page.slug) {
      aborted.push({ page: page.slug, reason: `LivePage slug changed to ${row.slug}` });
      continue;
    }
    const pairPaths = new Set((page.cards ?? []).map((card) => card.jsonPath));
    if (pairPaths.size < 1) {
      aborted.push({ page: page.slug, reason: `expected at least one card path, found ${pairPaths.size}` });
      continue;
    }

    const states = [];
    let structurallyValid = true;
    for (const card of page.cards ?? []) {
      const value = resolveCard(row.contentJson, card.jsonPath);
      if (!value) {
        aborted.push({ page: page.slug, card: card.jsonPath, reason: "card path is missing" });
        structurallyValid = false;
        continue;
      }
      const label = labelOf(value);
      if (label !== card.label) {
        aborted.push({ page: page.slug, card: card.jsonPath, reason: `card label changed from "${card.label}" to "${label}"` });
        structurallyValid = false;
        continue;
      }
      const imageSrc = imageSrcOf(value);
      if (imageSrc !== card.imageSrc) {
        aborted.push({ page: page.slug, card: card.jsonPath, reason: `card image changed from ${card.imageSrc} to ${String(imageSrc)}` });
        structurallyValid = false;
        continue;
      }
      const kind = kindOf(value);
      if (kind !== card.kind) {
        aborted.push({ page: page.slug, card: card.jsonPath, reason: `card kind is ${String(kind)}, planned ${card.kind}` });
        structurallyValid = false;
        continue;
      }
      const existing = typeof value.publicSlug === "string" ? value.publicSlug.trim() : "";
      const existingAliases = aliasesOf(value);
      const beforeAliases = card.beforeAliases ?? [];
      const afterAliases = card.afterAliases ?? [];
      const state = existing === card.afterSlug && JSON.stringify(existingAliases) === JSON.stringify(afterAliases)
        ? "after"
        : existing === card.beforeSlug && JSON.stringify(existingAliases) === JSON.stringify(beforeAliases)
          ? "before"
          : "conflict";
      states.push({ card, state, existing, existingAliases });
      if (state === "conflict") {
        aborted.push({
          page: page.slug,
          card: card.jsonPath,
          reason: `card carries publicSlug "${existing}" with aliases ${JSON.stringify(existingAliases)}; online edit wins, refusing to overwrite`
        });
        structurallyValid = false;
      }
    }
    if (!structurallyValid) continue;

    if (states.every((entry) => entry.state === "after")) {
      skipped.push({
        page: page.slug,
        slug: page.targetSlug ?? page.cards.map((card) => card.afterSlug).join(", "),
        reason: "already applied"
      });
      continue;
    }
    if (!states.every((entry) => entry.state === "before")) {
      aborted.push({ page: page.slug, reason: "reviewed cards are mixed between before and after; refusing a partial rewrite" });
      continue;
    }

    let targetValid = true;
    for (const card of page.cards ?? []) {
      const target = card.afterSlug;
      const targetOwner = plannedTargetOwners.get(target);
      const allowedPaths = targetOwner?.paths ?? new Set([card.jsonPath]);
      const targetHolders = (ownedSlugs.get(target) ?? []).filter(
        (holder) => !(holder.page === page.slug && allowedPaths.has(holder.jsonPath))
      );
      if (targetHolders.length) {
        aborted.push({
          page: page.slug,
          card: card.jsonPath,
          reason: `target slug ${target} is already owned by ${targetHolders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`
        });
        targetValid = false;
        continue;
      }
      const targetAliasHolders = aliasOwners.get(target) ?? [];
      if (targetAliasHolders.length) {
        aborted.push({
          page: page.slug,
          card: card.jsonPath,
          reason: `target slug ${target} is already an alias on ${targetAliasHolders.map((holder) => `${holder.page}${holder.jsonPath}`).join(", ")}`
        });
        targetValid = false;
        continue;
      }
      if (livePageSlugs.has(detailPath(card.kind, target))) {
        aborted.push({ page: page.slug, card: card.jsonPath, reason: `target ${detailPath(card.kind, target)} collides with a LivePage path` });
        targetValid = false;
      }
    }
    if (!targetValid) continue;

    const oldPathsBySlug = new Map();
    for (const card of page.cards ?? []) {
      const paths = oldPathsBySlug.get(card.beforeSlug) ?? new Set();
      paths.add(card.jsonPath);
      oldPathsBySlug.set(card.beforeSlug, paths);
    }
    let oldValid = true;
    for (const [oldSlug, expectedPaths] of oldPathsBySlug) {
      const oldOwners = ownedSlugs.get(oldSlug) ?? [];
      const oldHolderPaths = new Set(oldOwners.filter((holder) => holder.page === page.slug).map((holder) => holder.jsonPath));
      if (oldOwners.some((holder) => holder.page !== page.slug) || oldHolderPaths.size !== expectedPaths.size || ![...expectedPaths].every((pathName) => oldHolderPaths.has(pathName))) {
        aborted.push({ page: page.slug, reason: `retired slug ${oldSlug} is not owned by exactly the reviewed cards on one page` });
        oldValid = false;
      }
    }
    if (!oldValid) continue;

    if (pageHash(row) !== page.baseHash) {
      aborted.push({ page: page.slug, reason: "LivePage changed since the reviewed plan (baseHash mismatch)" });
      continue;
    }

    const nextContentJson = structuredClone(row.contentJson ?? {});
    const pageWrites = [];
    for (const card of page.cards) {
      const value = resolveCard(nextContentJson, card.jsonPath);
      assert(value, `Card ${card.jsonPath} disappeared while preparing ${page.slug}.`);
      value.publicSlug = card.afterSlug;
      value.publicAliases = card.afterAliases;
      pageWrites.push({ card, value });
    }
    planned.push({ row, page, nextContentJson, pageWrites });
  }

  const summary = {
    ok: aborted.length === 0,
    mode: apply ? "apply" : "dry-run",
    contract,
    siteId: SITE_ID,
    target,
    planHash: manifest.planHash,
    manifest: path.relative(process.cwd(), manifestPath),
    pagesPlanned: planned.length,
    cardsPlanned: planned.reduce((total, entry) => total + entry.pageWrites.length, 0),
    pagesAlreadyApplied: skipped.length,
    aborted,
    skipped
  };

  if (!apply || !planned.length) {
    console.log(JSON.stringify({ ...summary, noop: apply && !planned.length }, null, 2));
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

    const reportSlug = REPORT_SLUGS.get(contract) ?? "detail-slugs";
    const reportPath = path.resolve(
      process.cwd(),
      argumentValue("--report") || `scripts/manifests/aidreamcapes-${reportSlug}-${target}-2026-10-22-apply-report.json`
    );
    const rollbackPath = path.resolve(
      process.cwd(),
      argumentValue("--rollback") || `scripts/manifests/aidreamcapes-${reportSlug}-${target}-2026-10-22-rollback.json`
    );
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
      for (const entry of planned) {
        const updated = await tx.livePage.updateMany({
          where: { id: entry.row.id, updatedAt: entry.row.updatedAt },
          data: { contentJson: entry.nextContentJson }
        });
        assert.equal(updated.count, 1, `LivePage ${entry.row.id} changed concurrently; refusing to overwrite.`);
        applied.push({ page: entry.page.slug, cards: entry.pageWrites.map((write) => write.card.jsonPath) });
      }
      for (const entry of planned) {
        const readback = await tx.livePage.findUniqueOrThrow({
          where: { id: entry.row.id },
          select: { slug: true, contentJson: true, updatedAt: true }
        });
        for (const { card } of entry.pageWrites) {
          const value = resolveCard(readback.contentJson, card.jsonPath);
          assert(value, `Card ${card.jsonPath} is missing after the write on ${entry.page.slug}.`);
          assert.equal(value.publicSlug, card.afterSlug, `Card ${card.jsonPath} did not read back with the planned slug.`);
          assert.deepEqual(aliasesOf(value), card.afterAliases, `Card ${card.jsonPath} did not read back with the planned aliases.`);
        }
      }
      const revisionAfter = await readRevision();
      assert.equal(
        revisionAfter,
        revisionBefore + BigInt(planned.length),
        `SiteContentRevision advanced by ${revisionAfter - revisionBefore}, expected ${planned.length}.`
      );
      const protectedAfter = await protectedMyDreamShootsHash(tx);
      assert.equal(protectedAfter, protectedBefore, "MyDreamShoots public content changed during the template detail slug apply.");
      const [derivedRelation] = await db.$queryRaw`
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
        fieldsApplied: planned.reduce((total, entry) => total + entry.pageWrites.length * 2, 0),
        revisionBefore: revisionBefore.toString(),
        revisionAfter: revisionAfter.toString(),
        revisionDelta: (revisionAfter - revisionBefore).toString(),
        protectedMyDreamShootsHashBefore: protectedBefore,
        protectedMyDreamShootsHashAfter: protectedAfter,
        myDreamShootsChanged: protectedAfter !== protectedBefore,
        derivedStateReadOnly: derivedState
          ? { revision: derivedState.revision.toString(), contentHash: derivedState.contentHash }
          : null,
        snapshotOrPublicationWritten: false,
        historicalStateActivated: false
      };
    }, { isolationLevel: "Serializable", timeout: 180000 });

    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify({ ...summary, report }, null, 2)}\n`, "utf8");
    const rollback = {
      contract: `${contract}-rollback`,
      siteId: SITE_ID,
      target,
      planHash: manifest.planHash,
      generatedAt: new Date().toISOString(),
      owner: "LivePage.contentJson",
      note: "Field-level inverse of this apply. Each operation restores the retired publicSlug and publicAliases of one card.",
      operations: planned.flatMap((entry) => entry.pageWrites.map(({ card }) => ({
        siteId: SITE_ID,
        pageId: entry.row.id,
        ownerPath: entry.page.slug,
        cardPath: card.jsonPath,
        source: card.source,
        kind: card.kind,
        label: card.label,
        imageSrc: card.imageSrc,
        beforeSlug: card.beforeSlug,
        beforeAliases: card.beforeAliases,
        afterSlug: card.afterSlug,
        afterAliases: card.afterAliases,
        oldPath: card.oldPath,
        newPath: card.newPath
      })))
    };
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({
      ...summary,
      revisionBefore: report.revisionBefore,
      revisionAfter: report.revisionAfter,
      revisionDelta: report.revisionDelta,
      myDreamShootsChanged: report.myDreamShootsChanged,
      report: path.relative(process.cwd(), reportPath),
      rollback: path.relative(process.cwd(), rollbackPath)
    }, null, 2));
  }
  if (aborted.length) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    mode: apply ? "apply" : "dry-run",
    target,
    siteId: SITE_ID,
    error: error instanceof Error ? error.message : String(error)
  }, null, 2));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
