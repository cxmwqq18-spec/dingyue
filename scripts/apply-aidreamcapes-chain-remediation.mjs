// Apply a reviewed field manifest to current Aidreamcapes rows only. No imports,
// snapshots, page generation, deletion, or cross-store update is supported.
import fs from "node:fs";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertDatabaseTarget, hasArgument } from "./lib/database-target.mjs";

const manifestPath = argumentValue("--manifest");
assert(manifestPath, "--manifest is required");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const target = argumentValue("--target") || "local", apply = hasArgument("--apply");
assert.equal(manifest.contract, "aidreamcapes-chain-fields-v1");
assert.equal(manifest.siteId, "site_aidreamcapes");
assert.equal(manifest.target, target);
assert(["local", "production"].includes(target));
assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: apply,
  productionConfirmed: argumentValue("--confirm") === "aidreamcapes-chain-production" });
const hash = (v) => crypto.createHash("sha256").update(JSON.stringify(v)).digest("hex");
assert.equal(hash({ contract: manifest.contract, siteId: manifest.siteId, target, operations: manifest.operations }), manifest.planHash);
if (apply) {
  assert.equal(argumentValue("--base-hash"), manifest.planHash, "Explicit reviewed plan hash is required");
  assert.equal(argumentValue("--confirm"), `aidreamcapes-chain-${target}`);
}
const parts = (pointer) => pointer.slice(1).split("/").map((s) => s.replaceAll("~1", "/").replaceAll("~0", "~"));
const read = (content, pointer) => parts(pointer).reduce((value, key) => value?.[key], content);
function field(content, pointer) {
  const keys = parts(pointer), key = keys.pop(), parent = keys.reduce((value, part) => value?.[part], content);
  return { parent, key, exists: Boolean(parent && Object.hasOwn(parent, key)), value: parent?.[key] };
}
for (const op of manifest.operations) {
  assert(op.path.startsWith("/") && !parts(op.path).some((part) => ["__proto__", "constructor", "prototype"].includes(part)));
  const alias = /^\/sections\/[^/]+\/settings\/data\/(?:visual\/picker\/cards\/\d+|workspaceCases\/\d+|examples\/groups\/\d+\/items\/\d+)\/detailAliasOf$/.test(op.path);
  assert(alias || op.path.endsWith("/href"), `Unapproved field ${op.path}`);
  if (alias) { assert(/^[a-z0-9][a-z0-9-]{0,119}$/.test(op.after)); assert.equal(op.guards.length, 2); }
  else assert(/^\/(?!\/)|^https:\/\/www\.aivideosugc\.com\//.test(op.after));
}
const db = new PrismaClient();
try {
  const report = await db.$transaction(async (tx) => {
    if (apply) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('aidreamcapes-chain-fields-v1'))`;
      const trigger = await tx.$queryRaw`SELECT tgname FROM pg_trigger WHERE tgrelid = 'public."LivePage"'::regclass AND tgname = 'SiteContentRevision_LivePage' AND tgenabled != 'D'`;
      assert.equal(trigger.length, 1, "Revision trigger required");
    }
    const protectedHash = async () => hash(await tx.livePage.findMany({ where: { siteId: "site_dreamshoot" }, orderBy: { id: "asc" }, select: { id: true, contentJson: true, updatedAt: true } }));
    const revision = async () => (await tx.$queryRaw`SELECT revision::text FROM "SiteContentRevision" WHERE "siteId" = 'site_aidreamcapes'`)[0]?.revision || "0";
    const protectedBefore = await protectedHash(), revisionBefore = await revision();
    const rows = await tx.livePage.findMany({ where: { siteId: "site_aidreamcapes" }, select: { id: true, slug: true, contentJson: true, updatedAt: true } });
    const byId = new Map(rows.map((row) => [row.id, row])), patches = new Map(), conflicts = [], skipped = [], applied = [], inverse = [];
    const duplicates = new Set();
    for (const op of manifest.operations) {
      const identity = `${op.pageId}:${op.path}`;
      assert(!duplicates.has(identity), `Duplicate manifest field ${identity}`); duplicates.add(identity);
      const row = byId.get(op.pageId), current = row && field(row.contentJson, op.path);
      if (!row || row.slug !== op.pageSlug || !current?.parent) { conflicts.push({ page: op.pageSlug, path: op.path, reason: "owner-or-parent-changed" }); continue; }
      if (current.exists && hash(current.value) === hash(op.after)) { skipped.push({ page: row.slug, path: op.path }); continue; }
      if (current.exists !== op.before.exists || current.exists && hash(current.value) !== hash(op.before.value)
        || op.guards.some((guard) => !byId.has(guard.pageId) || hash(read(byId.get(guard.pageId).contentJson, guard.path)) !== guard.hash)) {
        conflicts.push({ page: row.slug, path: op.path, reason: "online-field-or-generation-edited" }); continue;
      }
      const patch = patches.get(row.id) || { row, next: structuredClone(row.contentJson), operations: [] };
      const destination = field(patch.next, op.path); destination.parent[destination.key] = structuredClone(op.after);
      patch.operations.push(op); patches.set(row.id, patch);
    }
    for (const patch of patches.values()) {
      if (apply) {
        const result = await tx.livePage.updateMany({ where: { id: patch.row.id, siteId: "site_aidreamcapes", updatedAt: patch.row.updatedAt }, data: { contentJson: patch.next } });
        assert.equal(result.count, 1, `Concurrent edit to ${patch.row.slug}; transaction aborted`);
        const readback = await tx.livePage.findFirstOrThrow({ where: { id: patch.row.id, siteId: "site_aidreamcapes" }, select: { contentJson: true } });
        assert.equal(hash(readback.contentJson), hash(patch.next));
      }
      for (const op of patch.operations) {
        applied.push({ page: patch.row.slug, path: op.path, after: op.after });
        inverse.push({ pageId: op.pageId, pageSlug: op.pageSlug, path: op.path, expected: op.after, restore: op.before });
      }
    }
    const revisionAfter = await revision(), protectedAfter = await protectedHash();
    assert.equal(protectedBefore, protectedAfter, "Protected store changed");
    if (apply) assert.equal(BigInt(revisionAfter) - BigInt(revisionBefore), BigInt(patches.size));
    return { ok: conflicts.length === 0, mode: apply ? "apply" : "dry-run", siteId: "site_aidreamcapes", target, planHash: manifest.planHash,
      pages: patches.size, fields: applied.length, revisionBefore, revisionAfter, myDreamShootsUnchanged: true, conflicts, skipped, applied, inverse,
      completedAt: new Date().toISOString() };
  }, { timeout: 120000 });
  const out = argumentValue("--report") || manifestPath.replace(/\.json$/, apply ? "-apply.json" : "-dry-run.json");
  fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ...report, applied: report.applied.length, inverse: report.inverse.length, report: out }, null, 2));
  if (report.conflicts.length) process.exitCode = 2;
} finally { await db.$disconnect(); }
