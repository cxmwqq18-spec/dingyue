#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import createJiti from "jiti";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const originalResolveFilename = Module._resolveFilename;
const originalLoad = Module._load;
Module._load = function load(request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
Module._resolveFilename = function resolveFilename(request, ...args) {
  if (request === "server-only")
    return path.join(sourceRoot, "lib/storefront-context/types.ts");
  let resolved = request.startsWith("@/")
    ? path.join(sourceRoot, request.slice(2))
    : request;
  if (request.startsWith("@/") && fs.existsSync(`${resolved}.ts`))
    resolved = `${resolved}.ts`;
  return originalResolveFilename.call(this, resolved, ...args);
};

const jiti = createJiti(import.meta.url);
const { resolveMydreamshootsPageTdk } = jiti("../src/lib/mydreamshoots-tdk.ts");

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function pagePath(page) {
  const seo = page.publishedJson?.seo ?? {};
  return clean(seo.canonicalPath) || clean(seo.canonical) || clean(page.slug);
}

function duplicateGroups(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    const value = clean(row[field]);
    const paths = groups.get(value) ?? [];
    paths.push(row.path);
    groups.set(value, paths);
  }
  return [...groups.entries()]
    .filter(([value, paths]) => !value || paths.length > 1)
    .map(([value, paths]) => ({ value: value || "<empty>", paths }));
}

const state = await readPlatformStateFromSql();
const site = state.sites.find(
  (candidate) => candidate.id === "site_dreamshoot",
);
assert.ok(site, "site_dreamshoot must exist in PostgreSQL platform state");
const snapshot = site.activePublication?.snapshot;
assert.ok(
  snapshot && Array.isArray(snapshot.pages),
  "myDreamshoots requires an active publication snapshot",
);

const redirectPaths = new Set(
  (snapshot.publishedRoutes ?? [])
    .filter((route) => route.disposition === "redirect")
    .map((route) => clean(route.aliasPath))
    .filter(Boolean),
);
const rowsByPath = new Map();
const add = (path, raw, source) => {
  if (!path || redirectPaths.has(path)) return;
  const tdk = resolveMydreamshootsPageTdk(site, path, raw);
  rowsByPath.set(path, { path, source, ...tdk });
};

for (const page of snapshot.pages) {
  const seo = page.publishedJson?.seo ?? {};
  add(
    pagePath(page),
    {
      title: seo.title ?? page.title,
      description: seo.description,
      keywords: seo.keywords,
    },
    "page",
  );
}
for (const entity of snapshot.publishedPageEntities ?? []) {
  if (entity.status === "redirect") continue;
  // Page entities are what dynamic directory routes render at request time.
  add(entity.canonicalPath, entity.metadata ?? {}, "page-entity");
}

const rows = [...rowsByPath.values()].sort((left, right) =>
  left.path.localeCompare(right.path),
);
assert.ok(
  rows.length > 0,
  "at least one published MyDreamshoots page must be checked",
);
const failures = {
  title: duplicateGroups(rows, "title"),
  description: duplicateGroups(rows, "description"),
  keywords: duplicateGroups(rows, "keywords"),
};
if (Object.values(failures).some((groups) => groups.length > 0)) {
  console.error(
    JSON.stringify({ ok: false, checkedPages: rows.length, failures }, null, 2),
  );
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify(
      {
        ok: true,
        checkedPages: rows.length,
        fields: ["title", "description", "keywords"],
      },
      null,
      2,
    ),
  );
}
