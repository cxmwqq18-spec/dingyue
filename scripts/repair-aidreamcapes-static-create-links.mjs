#!/usr/bin/env node
// Forward-only migration: replace dynamic /app/create?param links in Aidreamcapes
// LivePage content with fixed static paths (/app/create/<view>, /tool/..., /demo/...),
// and /templates?type= with /templates/<type>. Site-scoped, idempotent.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertDatabaseTarget,
  assertNonProductionWriteTarget,
  buildTunneledDatabaseUrl,
  hasArgument,
} from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const CONFIRMATION = "site_aidreamcapes-static-create-links";
const target = argumentValue("--target") ?? "local";
const apply = hasArgument("--apply");

// Reuse the exact static route rules shipped to the app.
const wsSource = path.join(process.cwd(), "src/lib/aidreamcapes-workspace");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "static-create-links-"));
const scopedRequire = createRequire(path.join(temp, "entry.cjs"));
const transpile = (name) => ts.transpileModule(fs.readFileSync(path.join(wsSource, `${name}.ts`), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const compile = (name, localRequire = scopedRequire) => {
  const mod = { exports: {} };
  new Function("require", "module", "exports", transpile(name))(localRequire, mod, mod.exports);
  return mod.exports;
};
const localRequireShim = (id) => {
  if (id === "./navigation") return compile("navigation", localRequireShim);
  if (id === "./types") return { AIVIDEOSUGC_SITE_ID: "site_aidreamcapes" };
  return scopedRequire(id);
};
const staticRoutes = compile("static-routes", localRequireShim);

assert(["local", "production"].includes(target), `Unsupported database target: ${target}`);
if (target === "production") {
  if (process.env.DATABASE_TARGET !== "production" || process.env.DINGYUE_ENV !== "production") {
    assert(process.env.REMOTE_DB_DATABASE_URL, "Production update requires REMOTE_DB_DATABASE_URL.");
    process.env.DATABASE_URL = buildTunneledDatabaseUrl(process.env.REMOTE_DB_DATABASE_URL, { host: "127.0.0.1", port: 15432 });
    process.env.DATABASE_TARGET = "production";
    process.env.DINGYUE_ENV = "production";
  }
  const confirmed = argumentValue("--confirm") === CONFIRMATION;
  assertDatabaseTarget({ expectedTarget: "production", requireProductionConfirmation: apply, productionConfirmed: confirmed });
  if (apply) assert(confirmed, `Use --confirm=${CONFIRMATION}.`);
} else {
  assertDatabaseTarget({ expectedTarget: "local" });
  if (apply) assertNonProductionWriteTarget();
}

const db = new PrismaClient();

function rewriteHref(value) {
  if (typeof value !== "string") return value;
  let url;
  try { url = new URL(value, "https://www.aivideosugc.com"); } catch { return value; }
  if (!["www.aivideosugc.com", "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"].includes(url.hostname)) return value;
  const origin = url.hostname === "www.aivideosugc.com" ? "" : `https://${url.hostname}`;

  if (url.pathname === "/templates") {
    const type = url.searchParams.get("type");
    if (type === "video" || type === "photo") return `${origin}/templates/${type}`;
    return value;
  }
  if (url.pathname !== "/app/create") return value;
  const staticPath = staticRoutes.legacyCreateHrefToStatic(`${url.pathname}${url.search}`);
  if (!staticPath) return value;
  return `${origin}${staticPath}${url.hash}`;
}

function rewriteStrings(node) {
  if (typeof node === "string") return rewriteHref(node);
  if (Array.isArray(node)) return node.map(rewriteStrings);
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, rewriteStrings(item)]));
  return node;
}

function collectPresetHrefs(pages) {
  const map = new Map();
  for (const page of pages) {
    const sections = page.contentJson?.sections;
    const order = Array.isArray(page.contentJson?.sectionsOrder) ? page.contentJson.sectionsOrder : Object.keys(sections ?? {});
    for (const sectionId of order) {
      const cards = sections?.[sectionId]?.settings?.data?.visual?.picker?.cards;
      if (!Array.isArray(cards)) continue;
      for (const card of cards) {
        if (!card?.publicSlug || card.kind !== "video" && card.kind !== "photo") continue;
        const prefix = card.kind === "photo" ? "/ai-image-generation/" : "/ai-video-generation/";
        const id = staticPresetIdShim(card);
        if (id) map.set(id, `${prefix}${card.publicSlug}`);
      }
    }
  }
  return map;
}
// Preset ids come from pickerPresetId in preset-contract (three FNV-style hashes).
function staticPresetIdShim(card) {
  const value = JSON.stringify([card.kind, card.image?.src, card.label]);
  const hash = (seed) => {
    let result = seed;
    for (let index = 0; index < value.length; index += 1) {
      result = Math.imul(result ^ value.charCodeAt(index), 0x01000193);
    }
    return (result >>> 0).toString(16).padStart(8, "0");
  };
  return `p_${hash(0x811c9dc5)}${hash(0x9e3779b9)}${hash(0x85ebca6b)}`;
}
// Stale preset ids left behind by earlier content edits. Resolve them to the
// current fixed scene routes instead of leaving dead ?preset= deep links.
const STALE_PRESET_LINKS = new Map([
  ["p_478c5ab331794cffbc0f8ec5", "/ai-video-generation/canvas-tote-product-detail"],
  ["p_43c1d572fa0aa2ae10c9a24c", "/ai-video-generation/stemless-earbud-product-detail"],
  ["p_a9ed07c0861e4fb4943eb55e", "/ai-video-generation/shirt-steamer-ugc"],
  ["p_28417aaeff615b1a5bf82e58", "/ai-video-generation/cardigan-turn-reel"],
]);
function rewritePresetLinks(node, presetHrefs) {
  if (typeof node === "string") {
    if (!node.includes("preset=p_")) return node;
    try {
      const url = new URL(node, "https://www.aivideosugc.com");
      if (url.pathname !== "/app/create") return node;
      const id = url.searchParams.get("preset");
      const target = (id && presetHrefs.get(id)) || (id && STALE_PRESET_LINKS.get(id));
      return target ? `${target}${url.hash}` : node;
    } catch { return node; }
  }
  if (Array.isArray(node)) return node.map((item) => rewritePresetLinks(item, presetHrefs));
  if (node && typeof node === "object") return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, rewritePresetLinks(item, presetHrefs)]));
  return node;
}

const report = { target, mode: apply ? "apply" : "plan", changedPages: [], unchangedPages: 0, totalRewrites: 0 };
try {
  const pages = await db.livePage.findMany({
    where: { siteId: SITE_ID },
    select: { id: true, slug: true, updatedAt: true, contentJson: true },
  });
  assert(pages.length > 0, `No LivePage rows for ${SITE_ID}`);
  const presetHrefs = collectPresetHrefs(pages);
  for (const page of pages) {
    const before = JSON.stringify(page.contentJson);
    const nextContent = rewritePresetLinks(rewriteStrings(page.contentJson), presetHrefs);
    const after = JSON.stringify(nextContent);
    if (after === before) { report.unchangedPages++; continue; }
    const changes = [];
    const walkDiff = (a, b, at) => {
      if (typeof a === "string" && a !== b) changes.push({ from: a, to: b });
      else if (Array.isArray(a)) a.forEach((item, i) => walkDiff(item, b?.[i], `${at}[${i}]`));
      else if (a && typeof a === "object") Object.keys(a).forEach((key) => walkDiff(a[key], b?.[key], `${at}.${key}`));
    };
    walkDiff(page.contentJson, nextContent, "$");
    report.changedPages.push({ id: page.id, slug: page.slug, rewrites: changes.length, changes });
    report.totalRewrites += changes.length;
    if (apply) {
      await db.livePage.update({ where: { id: page.id }, data: { contentJson: nextContent } });
    }
  }
  console.log(JSON.stringify(report, null, 1));
  if (!apply) console.error(`[plan] ${report.totalRewrites} links across ${report.changedPages.length} pages; rerun with --apply to write.`);
  else console.error(`[apply] ${report.totalRewrites} links rewritten across ${report.changedPages.length} pages.`);
} finally {
  await db.$disconnect();
}
