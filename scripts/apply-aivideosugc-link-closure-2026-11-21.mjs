#!/usr/bin/env node
// AIVideosUGC link-closure apply — 2026-11-21.
// Owner-approved internal-link closure pass: every category/directory page
// carries the Related Pages module forming a cycle without duplicates, two
// tool pages re-enable the module via blockOrder, and the five brand pages
// get Where-to-Go-Next links. Field-level, idempotent, site-scoped, with
// per-row base-hash optimistic locking and a --restore mode driven by the
// same manifest's before[] snapshots.
//   dry run:  node scripts/apply-aivideosugc-link-closure-2026-11-21.mjs --target=production
//   bases:    ... --write-bases=/tmp/link-closure-bases.json
//   apply:    ... --apply --confirm=aivideosugc-link-closure-2026-11-21 --bases-file=/tmp/link-closure-bases.json
//   restore:  ... --apply --restore --confirm=aivideosugc-link-closure-2026-11-21 --bases-file=/tmp/link-closure-bases.json
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-link-closure-2026-11-21";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-link-closure-2026-11-21.json", import.meta.url);
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
const siteId = assertAllowedSite(manifest.siteId);
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
const apply = hasArgument("--apply");
const restore = hasArgument("--restore");
const confirmed = hasArgument(`--confirm=${CONFIRM_NAME}`);
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply, productionConfirmed: confirmed });

function stable(value) {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) {
  return crypto.createHash("sha256").update(stable(value)).digest("hex");
}

const basesPath = argumentValue("--bases-file");
const writeBasesPath = argumentValue("--write-bases");
if (apply) assert(basesPath, "Apply requires --bases-file=<dry-run written bases json>.");

const db = new PrismaClient();
try {
  const rows = new Map();
  for (const change of manifest.changes) {
    const row = await db.livePage.findFirst({ where: { siteId, slug: change.slug }, select: { id: true, contentJson: true } });
    rows.set(change.slug, row);
  }

  const bases = {};
  const planned = [];
  let missing = 0;
  for (const change of manifest.changes) {
    const row = rows.get(change.slug);
    if (!row) {
      if (apply) assert.fail(`Row ${change.slug} does not exist on ${target}; refusing to apply.`);
      console.log(`[link-closure] MISSING ${change.slug} (dry run only)`);
      missing += 1;
      continue;
    }
    const next = JSON.parse(JSON.stringify(row.contentJson));
    const data = next.sections.v2_main.settings.data;
    bases[change.slug] = hash(row.contentJson);
    const targetValue = restore ? change.before : change.after;
    if (targetValue === null || targetValue === undefined) {
      delete data[change.field];
      if (change.field === "relatedLinks") delete data.relatedH2;
    } else {
      data[change.field] = JSON.parse(JSON.stringify(targetValue));
      if (change.field === "relatedLinks" && !restore && change.relatedH2 && change.before === null) {
        data.relatedH2 = change.relatedH2;
      }
      if (change.field === "relatedLinks" && restore) delete data.relatedH2;
    }
    if (stable(next) !== stable(row.contentJson)) planned.push({ slug: change.slug, id: row.id, contentJson: next });
  }

  console.log(`[link-closure] target=${target} site=${siteId} mode=${restore ? "restore" : "apply"}`);
  console.log(`[link-closure] rows=${manifest.changes.length} missing=${missing} toWrite=${planned.length}`);
  if (writeBasesPath) {
    fs.writeFileSync(writeBasesPath, JSON.stringify(bases, null, 1));
    console.log(`[link-closure] bases written to ${writeBasesPath}`);
  }
  if (!apply) {
    console.log("[link-closure] dry run — no writes. Production apply:");
    console.log(`[link-closure]   --apply --confirm=${CONFIRM_NAME} --bases-file=<dry-run bases json>${restore ? " --restore" : ""}`);
  } else {
    const provided = JSON.parse(fs.readFileSync(basesPath, "utf8"));
    for (const item of planned) {
      assert.equal(provided[item.slug], bases[item.slug], `Base hash mismatch for ${item.slug}: the row changed since the dry run; rerun the dry run.`);
    }
    await db.$transaction(async (tx) => {
      for (const item of planned) {
        await tx.livePage.update({ where: { id: item.id }, data: { contentJson: item.contentJson } });
      }
    });
    let verified = 0;
    for (const change of manifest.changes) {
      const row = await db.livePage.findFirst({ where: { siteId, slug: change.slug }, select: { contentJson: true } });
      assert(row, `Readback: ${change.slug} missing.`);
      const data = row.contentJson.sections.v2_main.settings.data;
      const targetValue = restore ? change.before : change.after;
      if (targetValue === null || targetValue === undefined) {
        assert(!(change.field in data) || stable(data[change.field]) === stable(targetValue), `Readback: ${change.slug} ${change.field} not restored.`);
      } else {
        assert(Array.isArray(data[change.field]), `Readback: ${change.slug} ${change.field} missing.`);
      }
      verified += 1;
    }
    console.log(`[link-closure] applied; verified=${verified} readback rows.`);
  }
} finally {
  await db.$disconnect();
}
