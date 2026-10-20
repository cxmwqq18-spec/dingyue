#!/usr/bin/env node
// Apply reviewed JSON-pointer inverse operations to current Aidreamcapes rows.
// No generator, publication, snapshot, page creation or page deletion is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { assertDatabaseTarget } from "./lib/database-target.mjs";

const args = process.argv.slice(2);
const value = key => args.find(arg => arg.startsWith(`${key}=`))?.slice(key.length + 1);
const apply = args.includes("--apply");
const siteId = "site_aidreamcapes";
assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: value("--confirm") === "site_aidreamcapes-field-repair" });
const manifest = JSON.parse(fs.readFileSync(value("--manifest"), "utf8"));
assert.equal(manifest.siteId, siteId);
assert.equal(manifest.mode, "field-level-inverse");
assert.equal(manifest.historicalStateActivation, false);
assert.equal(fs.readFileSync(".deployed-commit", "utf8").trim(), manifest.runtimeCommit);
const stable = v => v instanceof Date ? v.toISOString() : Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
const hash = v => crypto.createHash("sha256").update(v === undefined ? "<undefined>" : JSON.stringify(stable(v))).digest("hex");
const parts = pointer => pointer.slice(1).split("/").map(k => k.replaceAll("~1", "/").replaceAll("~0", "~"));
function get(root, pointer) { return parts(pointer).reduce((v, k) => v?.[k], root); }
function put(root, op) {
  const keys = parts(op.path); let parent = root;
  for (const key of keys.slice(0, -1)) { assert(parent && typeof parent === "object" && Object.hasOwn(parent, key), `Missing parent: ${op.path}`); parent = parent[key]; }
  if (op.action === "delete") { assert(!Array.isArray(parent), "Array removals must use one guarded array field operation"); delete parent[keys.at(-1)]; }
  else parent[keys.at(-1)] = structuredClone(op.value);
}
for (const op of manifest.operations) {
  assert(["live_page", "navigation"].includes(op.entity));
  assert(op.path.startsWith("/") && op.path.length > 1 && !parts(op.path).some(k => ["__proto__", "constructor", "prototype"].includes(k)));
  assert(["set", "delete"].includes(op.action));
  if (op.entity === "navigation") assert.equal(op.path, "/aidreamcapesV2Navigation/menus");
  else assert.equal(op.field, "contentJson");
  assert.match(op.expectedHash, /^[a-f0-9]{64}$/);
}
const db = new PrismaClient();
try {
  const report = await db.$transaction(async tx => {
    const protectedRows = async () => {
      const pages = await tx.livePage.findMany({ where: { siteId: "site_dreamshoot" }, orderBy: { id: "asc" }, select: { id: true, slug: true, title: true, contentJson: true, updatedAt: true } });
      const media = await tx.mediaAsset.findMany({ where: { siteId: "site_dreamshoot" }, orderBy: { id: "asc" }, select: { id: true, updatedAt: true } });
      return { pages: hash(pages), media: hash(media) };
    };
    const protectedBefore = await protectedRows();
    const ids = [...new Set(manifest.operations.filter(op => op.entity === "live_page").map(op => op.id))];
    const rows = await tx.livePage.findMany({ where: { siteId, id: { in: ids } } });
    const settings = await tx.themeSettings.findUniqueOrThrow({ where: { siteId } });
    const changes = new Map(); const planned = []; const conflicts = []; const skipped = [];
    for (const op of manifest.operations) {
      const row = op.entity === "live_page" ? rows.find(r => r.id === op.id && r.slug === op.slug) : settings;
      assert(row, `Current relational owner missing: ${op.id}`);
      const key = `${op.entity}:${op.id}`;
      if (!changes.has(key)) changes.set(key, { row, entity: op.entity, next: structuredClone(op.entity === "live_page" ? row.contentJson : row.draftJson), pending: [] });
      const group = changes.get(key); const current = get(group.next, op.path);
      const summary = { entity: op.entity, id: op.id, slug: op.slug, path: op.path };
      if (hash(current) === hash(op.action === "delete" ? undefined : op.value)) { skipped.push(summary); continue; }
      if (hash(current) !== op.expectedHash) { conflicts.push(summary); continue; }
      put(group.next, op); group.pending.push(summary); planned.push(summary);
    }
    const revisions = [];
    for (const group of changes.values()) {
      if (!group.pending.length) continue;
      const { row, next, entity } = group;
      revisions.push({ id: row.id ?? siteId, slug: row.slug, before: hash(entity === "live_page" ? row.contentJson : row.draftJson), after: hash(next) });
      if (!apply) continue;
      const result = entity === "live_page"
        ? await tx.livePage.updateMany({ where: { siteId, id: row.id, slug: row.slug, updatedAt: row.updatedAt }, data: { contentJson: next } })
        : await tx.themeSettings.updateMany({ where: { siteId, updatedAt: row.updatedAt }, data: { draftJson: next } });
      assert.equal(result.count, 1, "Concurrent online edit; transaction refused to overwrite it");
      const readback = entity === "live_page"
        ? await tx.livePage.findFirstOrThrow({ where: { siteId, id: row.id }, select: { contentJson: true } })
        : await tx.themeSettings.findUniqueOrThrow({ where: { siteId }, select: { draftJson: true } });
      assert.equal(hash(entity === "live_page" ? readback.contentJson : readback.draftJson), hash(next));
    }
    const protectedAfter = await protectedRows(); assert.deepEqual(protectedAfter, protectedBefore);
    const [table] = await tx.$queryRaw`SELECT to_regclass('public."SitePublishedState"')::text AS name`;
    const derivedState = table.name ? await tx.sitePublishedState.findUnique({ where: { siteId }, select: { revision: true, contentHash: true } }) : null;
    return { ok: true, siteId, mode: apply ? "apply" : "plan", owner: "Current LivePage.contentJson and Aidreamcapes navigation draftJson fields", applied: apply ? planned : [], planned, conflicts, skipped, revisions, protectedBefore, protectedAfter, derivedState, derivedCacheConsumed: false, historicalStateActivated: false, createdPages: 0, deletedPages: 0 };
  }, { isolationLevel: "Serializable", timeout: 180000 });
  if (value("--report")) fs.writeFileSync(value("--report"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, mode: report.mode, planned: report.planned.length, applied: report.applied.length, conflicts: report.conflicts.length, pages: report.revisions.length, historicalStateActivated: false }));
} finally { await db.$disconnect(); }
