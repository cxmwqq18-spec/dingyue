#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const publicRuntime = read("src/lib/stores/site-store.ts");
const publicSnapshot = read("src/lib/storefront-context/snapshot.ts");
const context = read("src/lib/storefront-context/index.ts");

assert.doesNotMatch(publicRuntime, /prisma\.(sitePublishedState|themePublication|activeThemePublication|themePublishApproval)/, "public runtime must not query retired snapshot tables");
assert.doesNotMatch(publicRuntime, /STOREFRONT_PUBLIC_CACHE_TTL_MS \?\? 120_000/, "public runtime must not use a cross-request content TTL");
assert.match(publicRuntime, /prisma\.\$transaction\(async \(tx\)/, "public runtime must read its bundle in one transaction");
assert.match(publicRuntime, /draftJson: \(page as \{ draftJson\?: unknown \}\)\.draftJson/, "public site shells must expose draftJson");
assert.doesNotMatch(publicSnapshot, /currentPublishedState|currentPublishedContentHash|currentPublishedRevision/, "live projection must not require current state");
assert.match(context, /createPublishedSiteSnapshot\(/, "context must compile the live projection from the database bundle");
assert.match(context, /export async function loadLiveStorefrontBundle/, "public SSR must expose one canonical live bundle loader");
assert.doesNotMatch(context, /publishedContextCache|PUBLISHED_CONTEXT_MAX_TTL_MS/, "context must not cache public content");

console.log(JSON.stringify({ ok: true, contract: "live-storefront-ssr" }));
