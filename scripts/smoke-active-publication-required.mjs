#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";

const repoRoot = process.cwd();
const sourceRoot = path.join(repoRoot, "src");
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

try {
  const { createPublishedSiteSnapshot } = createJiti(import.meta.url)("../src/lib/storefront-context/snapshot.ts");
  const historical = {
    id: "historical_publication",
    siteId: "site_dreamshoot",
    version: 1,
    snapshot: {}
  };
  const site = {
    id: "site_dreamshoot",
    primaryDomain: "www.mydreamshoots.com",
    latestHistoricalPublication: historical,
    activePublication: undefined
  };
  assert.throws(
    () => createPublishedSiteSnapshot({ sites: [site] }, site),
    /published_snapshot_active_publication_required/
  );
  console.log(JSON.stringify({ ok: true, rule: "active-publication-required" }, null, 2));
} finally {
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
