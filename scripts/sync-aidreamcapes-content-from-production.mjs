#!/usr/bin/env node
// Mirror reviewed Aidreamcapes public content from the production database into
// the local development database. Production is read-only here; the only writer
// is the local database.
//
// Why field level for pages: local development also carries work that is not
// deployed yet, so copying a whole row would replace the newer local copy of a
// field that production has not seen. The script copies only the named fields,
// compare-and-set on the local row, and stops when a row changed between the
// diff and the write.
//
// Usage:
//   node scripts/sync-aidreamcapes-content-from-production.mjs
//     Read-only drift report across pages, theme settings and storefront profile.
//   node scripts/sync-aidreamcapes-content-from-production.mjs --apply \
//     --confirm=site_aidreamcapes-local-sync --scope=livePage \
//     --field=siteNavigation --slug=/
//     Copy one field on one page into the local database.
//   node scripts/sync-aidreamcapes-content-from-production.mjs --apply \
//     --confirm=site_aidreamcapes-local-sync --scope=themeSettings
//     Copy the admin theme settings row into the local database.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { LOCAL_DATABASE } from "./lib/database-target.mjs";

const SITE_ID = "site_aidreamcapes";
const CONTRACT = "aidreamcapes-local-content-sync-2026-10-25-v2";
const ALL_SCOPES = ["livePage", "themeSettings", "storefrontProfile"];
const args = process.argv.slice(2);
const value = (key) => args.find((arg) => arg.startsWith(`${key}=`))?.slice(key.length + 1);
const list = (key) => args.filter((arg) => arg.startsWith(`${key}=`)).map((arg) => arg.slice(key.length + 1)).filter(Boolean);
const apply = args.includes("--apply");
const confirmation = value("--confirm");
const fields = list("--field");
const slugs = list("--slug");
const scopeArg = value("--scope") || "all";
const scopes = scopeArg === "all" ? ALL_SCOPES : scopeArg.split(",").map((s) => s.trim()).filter(Boolean);
const productionEnvPath = path.resolve(value("--production-env") || "/tmp/ac-prod-db.env");
const expectedConfirmation = "site_aidreamcapes-local-sync";
const stamp = new Date().toISOString().replace(/\.\d+Z$/, "").replace(/:/g, "").replace("T", "-");
const reportPath = path.resolve(value("--report") || `scripts/manifests/aidreamcapes-local-sync-${stamp}-report.json`);
const rollbackPath = path.resolve(value("--rollback") || `scripts/manifests/aidreamcapes-local-sync-${stamp}-rollback.json`);

for (const scope of scopes) assert(ALL_SCOPES.includes(scope), `Unknown --scope value: ${scope}`);

function loadEnv(file) {
  const env = {};
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return env;
}

function stable(v) {
  if (v === undefined) return '"<undefined>"';
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  return `{${Object.keys(v).sort().map((key) => `${JSON.stringify(key)}:${stable(v[key])}`).join(",")}}`;
}
const hash = (v) => crypto.createHash("sha256").update(stable(v)).digest("hex");

function getPath(source, dotted) {
  return dotted.split(".").reduce((node, key) => {
    if (node === null || node === undefined) return undefined;
    return Array.isArray(node) && /^\d+$/.test(key) ? node[Number(key)] : node[key];
  }, source);
}
function setPath(target, dotted, nextValue) {
  const keys = dotted.split(".");
  let node = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    const normalized = Array.isArray(node) && /^\d+$/.test(key) ? Number(key) : key;
    if (node[normalized] === null || typeof node[normalized] !== "object") {
      node[normalized] = /^\d+$/.test(keys[index + 1]) ? [] : {};
    }
    node = node[normalized];
  }
  const last = keys.at(-1);
  const normalized = Array.isArray(node) && /^\d+$/.test(last) ? Number(last) : last;
  if (nextValue === undefined) delete node[normalized];
  else node[normalized] = structuredClone(nextValue);
}

function differingFieldPaths(a, b, limit = 12) {
  const paths = [];
  const walk = (left, right, prefix = "") => {
    if (paths.length >= limit) return;
    if (left === right) return;
    if (typeof left !== typeof right || left === null || right === null || typeof left !== "object") {
      paths.push(prefix || "(root)");
      return;
    }
    if (Array.isArray(left) !== Array.isArray(right)) {
      paths.push(prefix || "(root)");
      return;
    }
    const keys = new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]);
    for (const key of keys) walk(left?.[key], right?.[key], prefix ? `${prefix}.${key}` : key);
  };
  walk(a, b);
  return paths;
}

const localEnv = loadEnv(path.resolve(".env.local"));
assert(fs.existsSync(productionEnvPath), `Production env file not found: ${productionEnvPath}`);
const localUrl = new URL(localEnv.DATABASE_URL);
assert.equal(localUrl.hostname, LOCAL_DATABASE.host, `Local database host must be ${LOCAL_DATABASE.host}`);
assert.equal(Number(localUrl.port), LOCAL_DATABASE.port, `Local database port must be ${LOCAL_DATABASE.port}`);
assert.equal(localEnv.DINGYUE_ENV, "local", "This script only writes the local database.");
assert.equal(localEnv.DATABASE_TARGET, "local", "This script only writes the local database.");
const remoteEnv = loadEnv(productionEnvPath);
assert.equal(new URL(remoteEnv.DATABASE_URL).port, "15432", "The production source must be the read-only SSH tunnel on port 15432.");

if (apply) {
  assert.equal(confirmation, expectedConfirmation, `Apply requires --confirm=${expectedConfirmation}.`);
  if (scopes.includes("livePage")) assert(fields.length > 0, "livePage apply requires at least one --field=<json.path>.");
}

const production = new PrismaClient({ datasources: { db: { url: remoteEnv.DATABASE_URL } } });
const local = new PrismaClient({ datasources: { db: { url: localEnv.DATABASE_URL } } });

async function revision(client) {
  const rows = await client.$queryRaw`
    SELECT "revision"::text AS revision FROM "SiteContentRevision" WHERE "siteId" = ${SITE_ID} LIMIT 1
  `;
  return BigInt(rows[0]?.revision ?? "0");
}

const report = {
  ok: true,
  mode: apply ? "apply" : "dry-run",
  contract: CONTRACT,
  siteId: SITE_ID,
  scopes: {}
};
const rollback = { ok: true, contract: CONTRACT, siteId: SITE_ID, mode: "local-rollback", generatedAt: new Date().toISOString(), rows: [] };

try {
  // ---------------------------------------------------------------- livePage --
  if (scopes.includes("livePage")) {
    const [productionRows, localRows] = await Promise.all([
      production.livePage.findMany({
        where: { siteId: SITE_ID },
        select: { id: true, slug: true, contentJson: true, updatedAt: true },
        orderBy: { slug: "asc" }
      }),
      local.livePage.findMany({
        where: { siteId: SITE_ID },
        select: { id: true, slug: true, contentJson: true, updatedAt: true },
        orderBy: { slug: "asc" }
      })
    ]);
    const productionBySlug = new Map(productionRows.map((row) => [row.slug, row]));
    const localBySlug = new Map(localRows.map((row) => [row.slug, row]));
    const changedSlugs = productionRows
      .filter((row) => localBySlug.has(row.slug) && hash(localBySlug.get(row.slug).contentJson) !== hash(row.contentJson))
      .map((row) => row.slug);
    const pageScope = {
      productionRows: productionRows.length,
      localRows: localRows.length,
      onlyInProduction: [...productionBySlug.keys()].filter((slug) => !localBySlug.has(slug)),
      onlyInLocal: [...localBySlug.keys()].filter((slug) => !productionBySlug.has(slug)),
      changedRows: changedSlugs
    };

    if (!apply) {
      // Name the fields that differ, so the operator can copy the reviewed ones
      // instead of replacing a row that local work already changed.
      pageScope.changedRowDetail = changedSlugs.slice(0, 30).map((slug) => ({
        slug,
        differingFields: differingFieldPaths(productionBySlug.get(slug).contentJson, localBySlug.get(slug).contentJson)
      }));
      report.scopes.livePage = pageScope;
    } else {
      const targets = slugs.length ? slugs : changedSlugs;
      pageScope.writes = [];
      for (const slug of targets) {
        assert(productionBySlug.has(slug), `Production has no LivePage for ${slug}.`);
        assert(localBySlug.has(slug), `Local has no LivePage for ${slug}; this script never creates rows.`);
        const productionRow = productionBySlug.get(slug);
        const localRow = localBySlug.get(slug);
        for (const field of fields) {
          const productionValue = getPath(productionRow.contentJson, field);
          const localValue = getPath(localRow.contentJson, field);
          if (hash(productionValue) === hash(localValue)) {
            pageScope.writes.push({ slug, field, state: "already equal" });
            continue;
          }
          const [before, updated] = await local.$transaction(async (tx) => {
            const revisionBefore = await revision(tx);
            const nextContent = structuredClone(localRow.contentJson ?? {});
            setPath(nextContent, field, productionValue);
            const result = await tx.livePage.updateMany({
              where: { id: localRow.id, updatedAt: localRow.updatedAt },
              data: { contentJson: nextContent }
            });
            assert.equal(result.count, 1, `${slug}: the local row changed while syncing; refusing to overwrite.`);
            const readback = await tx.livePage.findUniqueOrThrow({ where: { id: localRow.id }, select: { contentJson: true } });
            return [revisionBefore, readback];
          });
          assert.equal(hash(getPath(updated.contentJson, field)), hash(productionValue), `${slug}.${field}: local readback does not match production.`);
          const after = await revision(local);
          assert.equal(after, before + 1n, `${slug}: SiteContentRevision advanced by ${after - before}, expected 1.`);
          pageScope.writes.push({ slug, field, state: "copied", revisionBefore: before.toString(), revisionAfter: after.toString() });
          rollback.rows.push({ scope: "livePage", slug, field, before: localValue });
        }
      }
      report.scopes.livePage = pageScope;
    }
  }

  // ----------------------------------------------------- single-row tables --
  for (const scope of ["themeSettings", "storefrontProfile"]) {
    if (!scopes.includes(scope)) continue;
    const modelName = scope === "themeSettings" ? "themeSettings" : "storefrontProfile";
    const [productionRow, localRow] = await Promise.all([
      production[modelName].findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true, updatedAt: true } }),
      local[modelName].findUnique({ where: { siteId: SITE_ID }, select: { draftJson: true, publishedJson: true, updatedAt: true } })
    ]);
    const tableFields = ["draftJson", "publishedJson"];
    const differs = tableFields.some((field) => productionRow && hash(productionRow[field]) !== hash(localRow?.[field]));
    const tableScope = {
      productionPresent: Boolean(productionRow),
      localPresent: Boolean(localRow),
      productionUpdatedAt: productionRow?.updatedAt ?? null,
      localUpdatedAt: localRow?.updatedAt ?? null,
      differingFields: productionRow && localRow ? tableFields.filter((field) => hash(productionRow[field]) !== hash(localRow[field])) : [],
      differs
    };

    if (!apply || !differs) {
      report.scopes[scope] = tableScope;
      continue;
    }
    assert(productionRow, `Production has no ${scope} row; refusing to invent one locally.`);
    assert(localRow, `Local has no ${scope} row; this script never creates rows.`);
    const [before, updated] = await local.$transaction(async (tx) => {
      const revisionBefore = await revision(tx);
      const result = await tx[modelName].updateMany({
        where: { siteId: SITE_ID, updatedAt: localRow.updatedAt },
        data: { draftJson: productionRow.draftJson, publishedJson: productionRow.publishedJson }
      });
      assert.equal(result.count, 1, `${scope}: the local row changed while syncing; refusing to overwrite.`);
      const readback = await tx[modelName].findUniqueOrThrow({
        where: { siteId: SITE_ID },
        select: { draftJson: true, publishedJson: true }
      });
      return [revisionBefore, readback];
    });
    for (const field of tableFields) {
      assert.equal(hash(updated[field]), hash(productionRow[field]), `${scope}.${field}: local readback does not match production.`);
      rollback.rows.push({ scope, field, before: localRow[field] });
    }
    const after = await revision(local);
    assert.equal(after, before + 1n, `${scope}: SiteContentRevision advanced by ${after - before}, expected 1.`);
    report.scopes[scope] = {
      ...tableScope,
      state: "copied",
      revisionBefore: before.toString(),
      revisionAfter: after.toString()
    };
  }

  report.productionRevision = (await revision(production)).toString();
  report.localRevision = (await revision(local)).toString();

  if (apply) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    fs.mkdirSync(path.dirname(rollbackPath), { recursive: true });
    fs.writeFileSync(rollbackPath, `${JSON.stringify(rollback, null, 2)}\n`, "utf8");
    report.reportPath = reportPath;
    report.rollbackPath = rollbackPath;
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await Promise.all([production.$disconnect(), local.$disconnect()]);
}
