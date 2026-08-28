#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import createJiti from "jiti";
import "./load-runtime-env.mjs";

throw new Error("审批式 current-state 发布已停用。公开内容保存即生效，请使用字段级增量内容同步。");

const target = process.env.DATABASE_TARGET?.trim() || "";
if (target !== "production" || process.env.DINGYUE_ENV?.trim() !== "production" || process.env.CONFIRM_PRODUCTION !== "1") {
  throw new Error("Current-state production publish requires DATABASE_TARGET=DINGYUE_ENV=production and CONFIRM_PRODUCTION=1.");
}
const required = ["SITE_ID", "APPROVAL_ID", "PUBLISH_ACTOR", "BACKUP_PATH", "BACKUP_SHA256", "BACKUP_BYTES", "BACKUP_READBACK_HASH"];
for (const key of required) if (!process.env[key]?.trim()) throw new Error(`${key} is required`);

const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};

const { publishCurrentStateRelational } = createJiti(import.meta.url)("../src/lib/stores/site-published-state.ts");
const { databaseIdentityFromUrl } = createJiti(import.meta.url)("../src/lib/current-state/backup-receipt.ts");
const now = new Date().toISOString();
const databaseIdentity = databaseIdentityFromUrl(process.env.DATABASE_URL);
const receipt = {
  target,
  databaseIdentity,
  backupPath: process.env.BACKUP_PATH.trim(),
  byteSize: Number(process.env.BACKUP_BYTES),
  sha256: process.env.BACKUP_SHA256.trim(),
  criticalReadbackHash: process.env.BACKUP_READBACK_HASH.trim(),
  createdAt: process.env.BACKUP_CREATED_AT?.trim() || now,
  archiveListVerifiedAt: process.env.BACKUP_ARCHIVE_LIST_VERIFIED_AT?.trim() || now,
  isolatedRestoreVerifiedAt: process.env.BACKUP_RESTORE_VERIFIED_AT?.trim() || now
};
const result = await publishCurrentStateRelational({
  siteId: process.env.SITE_ID.trim(),
  actor: process.env.PUBLISH_ACTOR.trim(),
  approvalId: process.env.APPROVAL_ID.trim(),
  target,
  databaseIdentity,
  verifiedBackupReceipt: receipt
});
console.log(JSON.stringify({
  ok: true,
  siteId: process.env.SITE_ID.trim(),
  approvalId: process.env.APPROVAL_ID.trim(),
  noOp: result.noOp,
  contentHash: result.state.contentHash,
  revision: result.state.revision,
  publishedBy: result.state.publishedBy,
  publishedAt: result.state.publishedAt,
  verifiedBackupReceipt: result.verifiedBackupReceipt
}, null, 2));
Module._resolveFilename = originalResolveFilename;
Module._load = originalLoad;
