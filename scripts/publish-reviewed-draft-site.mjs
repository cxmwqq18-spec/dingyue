#!/usr/bin/env node
import createJiti from "jiti";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import "./load-runtime-env.mjs";

throw new Error("公开内容人工审批发布已停用。线上保存即生效，请使用字段级增量内容同步。");

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
const { publishApprovedDraftSiteRelational } = createJiti(import.meta.url)("../src/lib/stores/theme-store.ts");

const siteId = process.env.SITE_ID?.trim() || process.argv[2]?.trim();
const actor = process.env.PUBLISH_ACTOR?.trim() || "publish:reviewed-draft-site";
const approvalId = process.env.APPROVAL_ID?.trim() || process.argv[3]?.trim();

if (!siteId) throw new Error("SITE_ID is required");
if (!approvalId) throw new Error("APPROVAL_ID is required; create and review a persisted approval first");
if (process.argv.includes("--snapshot") || process.argv.includes("--snapshot-file")) {
  throw new Error("This command never accepts a caller-provided snapshot");
}

const result = await publishApprovedDraftSiteRelational({ siteId, approvalId, actor });
console.log(JSON.stringify({
  ok: true,
  siteId,
  actor,
  publicationId: result.publication.id,
  publishedVersion: result.publishedVersion,
  snapshotHash: result.publication.snapshot.snapshotHash
}, null, 2));
Module._resolveFilename = originalResolveFilename;
Module._load = originalLoad;
