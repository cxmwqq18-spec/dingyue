#!/usr/bin/env node
// AIVideosUGC template-related apply — 2026-11-22.
// Completes the link-closure pass for the 15 template-layout tool pages: their
// pre-written relatedLinks render once blockOrder gains "related". Also gives
// the /industries hub's 19 industry card titles their display labels (they
// rendered as empty anchors). Per-row base-hash locking + --restore.
//   dry run:  node scripts/apply-aivideosugc-template-related-2026-11-22.mjs --target=production --write-bases=/tmp/bases.json
//   apply:    ... --apply --confirm=aivideosugc-template-related-2026-11-22 --bases-file=/tmp/bases.json
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const CONFIRM_NAME = "aivideosugc-template-related-2026-11-22";
const MANIFEST_PATH = new URL("./manifests/aivideosugc-template-related-2026-11-22.json", import.meta.url);
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
  const bases = {};
  const planned = [];
  for (const change of manifest.changes) {
    const row = await db.livePage.findFirst({ where: { siteId, slug: change.slug }, select: { id: true, contentJson: true } });
    assert(row, `Row ${change.slug} does not exist on ${target}.`);
    const next = JSON.parse(JSON.stringify(row.contentJson));
    const data = next.sections.v2_main.settings.data;
    bases[change.slug] = hash(row.contentJson);
    if (change.field === "blockOrder") {
      data.blockOrder = restore ? change.before : change.after;
    } else if (change.field === "itemLabels") {
      const labels = restore ? change.before : change.after;
      const byHref = new Map(labels.filter(l => l && l.href).map(l => [l.href, l.label]));
      assert(Array.isArray(data.items), `/industries items missing.`);
      for (const item of data.items) {
        if (!byHref.has(item.href)) continue;
        const label = byHref.get(item.href);
        if (restore && (label === null || label === undefined)) delete item.label;
        else if (label !== null && label !== undefined) item.label = label;
      }
    } else assert.fail(`Unknown field ${change.field}`);
    if (stable(next) !== stable(row.contentJson)) planned.push({ slug: change.slug, id: row.id, contentJson: next });
  }

  console.log(`[template-related] target=${target} site=${siteId} mode=${restore ? "restore" : "apply"}`);
  console.log(`[template-related] rows=${manifest.changes.length} toWrite=${planned.length}`);
  if (writeBasesPath) {
    fs.writeFileSync(writeBasesPath, JSON.stringify(bases, null, 1));
    console.log(`[template-related] bases written to ${writeBasesPath}`);
  }
  if (!apply) {
    console.log("[template-related] dry run — no writes. Production apply:");
    console.log(`[template-related]   --apply --confirm=${CONFIRM_NAME} --bases-file=<dry-run bases json>${restore ? " --restore" : ""}`);
  } else {
    const provided = JSON.parse(fs.readFileSync(basesPath, "utf8"));
    for (const item of planned) {
      assert.equal(provided[item.slug], bases[item.slug], `Base hash mismatch for ${item.slug}; rerun the dry run.`);
    }
    await db.$transaction(async (tx) => {
      for (const item of planned) {
        await tx.livePage.update({ where: { id: item.id }, data: { contentJson: item.contentJson } });
      }
    });
    let verified = 0;
    for (const change of manifest.changes) {
      const row = await db.livePage.findFirst({ where: { siteId, slug: change.slug }, select: { contentJson: true } });
      const data = row.contentJson.sections.v2_main.settings.data;
      if (change.field === "blockOrder") {
        assert.deepEqual(data.blockOrder, restore ? change.before : change.after, `Readback: ${change.slug} blockOrder.`);
      } else {
        for (const l of (restore ? change.before : change.after)) {
          const item = data.items.find(i => i.href === l.href);
          if (l.label === null || l.label === undefined) assert(!("label" in (item ?? {})), `Readback: ${l.href} label should be absent.`);
          else assert.equal(item?.label, l.label, `Readback: ${l.href} label.`);
        }
      }
      verified += 1;
    }
    console.log(`[template-related] applied; verified=${verified} readback rows.`);
  }
} finally {
  await db.$disconnect();
}
