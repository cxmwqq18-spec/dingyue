#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(path.resolve("scripts/content-sync.mjs"), "utf8");
const deploy = fs.readFileSync(path.resolve("scripts/deploy-release.mjs"), "utf8");
const schema = fs.readFileSync(path.resolve("prisma/schema.prisma"), "utf8");
const migration = fs.readFileSync(path.resolve("prisma/migrations/20260828170000_add_content_sync_baselines/migration.sql"), "utf8");

for (const required of [
  "formatVersion: 2",
  "baseHash",
  "fieldPath",
  "confirm-deletions",
  '"theme_page", "creative_pack"',
  '"live_page", "theme_page"',
  "Protected business data changed during content apply",
  "contentSyncBaseline",
  "target_siteId_entityType_entityKey_fieldPath"
]) assert(source.includes(required), `content sync contract missing ${required}`);
for (const forbidden of ["PlatformStateDocument", "ThemePublication", "ActiveThemePublication", "snapshot"]) {
  assert(!source.includes(forbidden), `content sync must not depend on ${forbidden}`);
}
for (const required of ["fetch --prune origin main", "origin/main", "prisma migrate deploy", "deployed-commit", "systemctl restart"]) {
  assert(deploy.includes(required), `deploy contract missing ${required}`);
}
assert(!deploy.includes("prisma db push"), "deploy must never use prisma db push");
assert(schema.includes("model ContentSyncBaseline"), "schema must define hash-only baseline");
assert(migration.includes("CREATE TABLE \"ContentSyncBaseline\""), "migration must create baseline table");
assert(migration.includes("CREATE UNIQUE INDEX"), "baseline identity must be unique");
assert(source.includes("return value.flatMap((child, index) => leafPaths(child, `${prefix}/${index}`));"), "content sync must preserve scoped array item paths");

console.log(JSON.stringify({ ok: true, contract: "no-snapshot-incremental-content-sync", checks: 16 }, null, 2));
