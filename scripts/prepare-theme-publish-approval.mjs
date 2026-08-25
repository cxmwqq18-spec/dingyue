#!/usr/bin/env node
import createJiti from "jiti";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import "./load-runtime-env.mjs";

const siteId = process.env.SITE_ID?.trim() || process.argv[2]?.trim();
const approvedBy = process.env.APPROVED_BY?.trim() || process.argv[3]?.trim();
if (!siteId) throw new Error("SITE_ID is required");
if (!approvedBy) throw new Error("APPROVED_BY is required");

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
const { prepareDraftPublishManifestRelational, createThemePublishApprovalRelational } = createJiti(import.meta.url)("../src/lib/stores/theme-store.ts");
const manifest = await prepareDraftPublishManifestRelational(siteId);
const approval = await createThemePublishApprovalRelational({
  siteId,
  manifest,
  approvedBy,
  expiresAt: process.env.APPROVAL_EXPIRES_AT ? new Date(process.env.APPROVAL_EXPIRES_AT) : undefined
});

console.log(JSON.stringify({
  ok: true,
  siteId,
  approvalId: approval.id,
  approvedBy,
  manifestHash: manifest.manifestHash,
  itemCount: approval.items.length,
  expiresAt: approval.expiresAt
}, null, 2));
Module._resolveFilename = originalResolveFilename;
Module._load = originalLoad;
