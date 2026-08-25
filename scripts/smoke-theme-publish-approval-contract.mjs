#!/usr/bin/env node
import assert from "node:assert/strict";
import "./load-runtime-env.mjs";
import { PrismaClient } from "@prisma/client";
import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";
import Module from "node:module";
import createJiti from "jiti";

const databaseUrl = process.env.DATABASE_URL?.trim();
assert.ok(databaseUrl, "DATABASE_URL is required");
const parsed = new URL(databaseUrl);
assert.ok(["localhost", "127.0.0.1", "::1"].includes(parsed.hostname), `refusing non-local database host: ${parsed.hostname}`);
assert.equal(parsed.port || "5432", "15433", "approval contract smoke must use local PostgreSQL");

const sourceRoot = path.resolve("src");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolved = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`)) return originalResolveFilename.call(this, `${resolved}.ts`, ...args);
  return originalResolveFilename.call(this, resolved, ...args);
};
const jiti = createJiti(import.meta.url);
const { prepareDraftPublishManifestRelational, createThemePublishApprovalRelational } = jiti("../src/lib/stores/theme-store.ts");
const prisma = new PrismaClient();
const siteId = "site_dreamshoot";
let approvalId;
try {
  const manifest = await prepareDraftPublishManifestRelational(siteId);
  const approval = await createThemePublishApprovalRelational({ siteId, manifest, approvedBy: "smoke:approval-contract", expiresAt: new Date(Date.now() + 60_000) });
  approvalId = approval.id;
  assert.equal(approval.status, "approved");
  assert.equal(approval.items.length, manifest.pageIds.length + (manifest.includeThemeSettings ? 1 : 0) + (manifest.includeStorefrontProfile ? 1 : 0));

  const expired = await prisma.themePublishApproval.create({
    data: { id: `${approval.id}_expired`, siteId, manifestHash: manifest.manifestHash, approvedBy: "smoke:approval-contract", expiresAt: new Date(Date.now() - 1), items: { create: approval.items.map((item, index) => ({ id: `${approval.id}_expired_item_${index}`, objectType: item.objectType, objectId: item.objectId, ownerId: item.ownerId, revision: item.revision, etag: item.etag, valueHash: item.valueHash })) } }
  });
  assert.ok(expired.expiresAt && expired.expiresAt < new Date());

  const [first, second] = await Promise.all([
    prisma.themePublishApproval.updateMany({ where: { id: approval.id, status: "approved", consumedAt: null }, data: { status: "consumed", consumedAt: new Date(), consumedPublicationId: `smoke_${approval.id}_1` } }),
    prisma.themePublishApproval.updateMany({ where: { id: approval.id, status: "approved", consumedAt: null }, data: { status: "consumed", consumedAt: new Date(), consumedPublicationId: `smoke_${approval.id}_2` } })
  ]);
  assert.equal(first.count + second.count, 1, "approval must be consumed exactly once under concurrency");
  console.log(JSON.stringify({ ok: true, approvalId, itemCount: approval.items.length, singleConsume: true, expiryChecked: true }, null, 2));
} finally {
  if (approvalId) await prisma.themePublishApproval.deleteMany({ where: { id: { startsWith: approvalId } } }).catch(() => {});
  await prisma.$disconnect();
  Module._resolveFilename = originalResolveFilename;
}
