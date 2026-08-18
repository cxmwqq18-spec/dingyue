#!/usr/bin/env node
import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";
import path from "node:path";
import createJiti from "jiti";

const sourceRoot = path.join(process.cwd(), "src");
const require = createRequire(import.meta.url);
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only") return path.join(sourceRoot, "lib/storefront-context/types.ts");
  const resolvedRequest = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : request;
  return originalResolveFilename.call(this, resolvedRequest, ...args);
};

const jiti = createJiti(import.meta.url);
const { storefrontSitemapUrlForHost } = jiti("../src/lib/seo-indexing.ts");
const { internalPolicyPathToPublicPath, publicPolicyPathToInternalPath } = jiti("../src/lib/site-route-canonical.ts");

assert.equal(storefrontSitemapUrlForHost("aidreamshoots.eu"), "https://aidreamshoots.eu/sitemap.xml");
assert.equal(storefrontSitemapUrlForHost("www.aidreamshoots.eu"), "https://aidreamshoots.eu/sitemap.xml");
assert.equal(storefrontSitemapUrlForHost("aidreamcapes.eu"), "https://aidreamcapes.eu/sitemap.xml");
assert.equal(storefrontSitemapUrlForHost("www.aidreamcapes.eu"), "https://aidreamcapes.eu/sitemap.xml");
assert.equal(storefrontSitemapUrlForHost("unknown.example"), undefined, "unknown hosts must not inherit another site's sitemap");

assert.equal(publicPolicyPathToInternalPath("/privacy"), "/policies/privacy");
assert.equal(publicPolicyPathToInternalPath("/policies/privacy-policy"), "/policies/privacy");
assert.equal(internalPolicyPathToPublicPath("/policies/privacy"), "/privacy");
assert.equal(internalPolicyPathToPublicPath("/policies/terms-of-service"), "/terms");

console.log("SEO architecture contract smoke passed");
