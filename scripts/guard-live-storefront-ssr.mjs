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
const publicRuntimeLoader = publicRuntime.slice(
  publicRuntime.indexOf("async function loadStorefrontPublicRuntimeState"),
  publicRuntime.indexOf("export const getStorefrontRuntimeStateByHost")
);

assert.notEqual(publicRuntimeLoader.length, 0, "public runtime guard must locate the loader source");

assert.doesNotMatch(publicRuntime, /prisma\.(sitePublishedState|themePublication|activeThemePublication|themePublishApproval)/, "public runtime must not query retired snapshot tables");
assert.doesNotMatch(publicRuntime, /STOREFRONT_PUBLIC_CACHE_TTL_MS \?\? 120_000/, "public runtime must not use a cross-request content TTL");
assert.match(publicRuntime, /prisma\.\$transaction\(async \(tx\)/, "public runtime must read its bundle in one transaction");
assert.match(publicRuntimeLoader, /livePages/, "public runtime must select LivePage rows");
assert.match(publicRuntimeLoader, /tx\.livePage\.findMany/, "public runtime navigation completion must read LivePage rows");
assert.doesNotMatch(publicRuntimeLoader, /tx\.themePage|\bpages\s*:/, "public runtime must not query or fall back to ThemePage rows");
assert.match(publicRuntime, /draftJson: page\.contentJson/, "public site shells must expose LivePage content through the compatibility shape");
assert.doesNotMatch(publicSnapshot, /currentPublishedState|currentPublishedContentHash|currentPublishedRevision/, "live projection must not require current state");
assert.match(context, /createPublishedSiteSnapshot\(/, "context must compile the live projection from the database bundle");
assert.match(context, /export async function loadLiveStorefrontBundle/, "public SSR must expose one canonical live bundle loader");
assert.match(context, /livePages: \{ orderBy: \{ slug: "asc" \} \}/, "canonical public context must select LivePage rows");
assert.match(context, /draftJson: page\.contentJson/, "canonical public context must map LivePage content");
assert.doesNotMatch(context, /\bpages:\s*\{ orderBy:|themePage\./, "canonical public context must not query ThemePage rows");
assert.doesNotMatch(context, /publishedContextCache|PUBLISHED_CONTEXT_MAX_TTL_MS/, "context must not cache public content");

console.log(JSON.stringify({ ok: true, contract: "live-storefront-ssr" }));
