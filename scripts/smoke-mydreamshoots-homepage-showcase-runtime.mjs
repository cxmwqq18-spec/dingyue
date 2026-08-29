#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { assertDatabaseTarget } from "./lib/database-target.mjs";
import "./load-runtime-env.mjs";

assertDatabaseTarget({ expectedTarget: process.env.DATABASE_TARGET === "remote-readonly" ? "remote-readonly" : "local" });

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

const jiti = createJiti(import.meta.url);
try {
  const { getStorefrontPublicRuntimeStateForSite } = jiti("../src/lib/stores/site-store.ts");
  const { createPublishedSiteSnapshot } = jiti("../src/lib/storefront-context/snapshot.ts");
  const state = await getStorefrontPublicRuntimeStateForSite("site_dreamshoot", "/");
  assert(state?.sites?.[0], "MyDreamShoots public runtime state is required");
  const snapshot = createPublishedSiteSnapshot(state, state.sites[0], { source: "postgres" });
  const items = snapshot.publishedHomepageShowcases ?? [];
  const counts = items.reduce((result, item) => ({ ...result, [item.kind]: (result[item.kind] ?? 0) + 1 }), {});
  assert.equal(state.sites[0].pages.length > 2, true, "homepage projection must load public topic pages");
  assert.equal(counts.photo, 37, "homepage must retain all published photo showcase items");
  assert.ok((counts.video ?? 0) >= 8, "homepage must include published video showcase items");
  assert.ok((counts.save_the_date ?? 0) >= 1, "homepage must include published Save the Date showcase items");
  console.log(JSON.stringify({ ok: true, pages: state.sites[0].pages.length, counts, total: items.length }, null, 2));
} finally {
  Module._resolveFilename = originalResolveFilename;
  Module._load = originalLoad;
}
