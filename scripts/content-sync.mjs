#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import { argumentValue, assertAllowedSite, assertDatabaseTarget, hasArgument, parseDatabaseUrl } from "./lib/database-target.mjs";

const mode = argumentValue("--mode") || "plan";
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "";
const siteId = assertAllowedSite(argumentValue("--site-id") || (target === "production" ? "site_dreamshoot" : "site_grownstride_test"));
const sourceSiteId = assertAllowedSite(argumentValue("--source-site") || (target === "test" ? "site_dreamshoot" : siteId));
const sourceTarget = argumentValue("--source-target") || (target === "local" ? "local" : "");
const sourceUrl = argumentValue("--source-url") || process.env.SOURCE_DATABASE_URL || (sourceTarget === "local" ? process.env.DATABASE_URL : "");
const targetUrl = argumentValue("--target-url") || process.env.DATABASE_URL;
const manifestTarget = argumentValue("--for-target") || target;
const outPath = path.resolve(argumentValue("--out") || path.join("releases", "manifests", `${siteId}-content-${Date.now()}.json`));
const manifestPath = argumentValue("--manifest");
const reportArgument = argumentValue("--report");
const scopeArgument = argumentValue("--scope-file");
const codeCommit = process.env.GIT_COMMIT_SHA || execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();

const entitySpecs = {
  theme_page: { model: "themePage", key: "id", lookup: ["id", "slug"], json: ["draftJson"], fields: ["id", "siteId", "pageType", "templateKey", "slug", "title", "draftJson"] },
  live_page: { model: "livePage", key: "id", lookup: ["id", "slug"], json: ["contentJson"], fields: ["id", "siteId", "slug", "title", "contentJson"] },
  theme_settings: { model: "themeSettings", key: "siteId", lookup: ["siteId"], json: ["draftJson"], fields: ["id", "siteId", "draftJson"] },
  storefront_profile: { model: "storefrontProfile", key: "siteId", lookup: ["siteId"], json: ["draftJson"], fields: ["id", "siteId", "draftJson"] },
  creative_pack: { model: "creativePack", key: "id", lookup: ["id"], fields: ["id", "siteId", "name", "headline", "description", "category", "categoryId", "aiAppSlug", "status", "creditCost", "outputCount", "trainingRequired", "imageUrl", "galleryImages", "galleryImageAlts"] },
  media_asset: { model: "mediaAsset", key: "storageKey", lookup: ["storageKey", "id"], fields: ["id", "siteId", "label", "storageKey", "usageType", "sourceType", "altText", "previewUrl", "originUrl", "mimeType", "notes"] },
  tool_category: { model: "toolCategory", key: "slug", lookup: ["slug"], fields: ["id", "siteId", "slug", "label", "description", "icon", "sortOrder", "status"] },
  tool_menu_item: { model: "toolMenuItem", key: "slug", lookup: ["slug"], fields: ["id", "siteId", "slug", "title", "description", "href", "icon", "sortOrder", "status", "detailJson"] },
  video_theme_category: { model: "videoThemeCategory", key: "slug", lookup: ["slug"], fields: ["id", "siteId", "slug", "label", "description", "sortOrder", "status"] },
  video_theme: { model: "videoTheme", key: "slug", lookup: ["slug"], fields: ["id", "siteId", "categoryId", "slug", "name", "headline", "description", "prompt", "status", "creditCost", "modelPricing", "durationSeconds", "maxFrames", "generationCount", "sortOrder", "imageUrl", "galleryImages"] },
  product: { model: "product", key: "id", lookup: ["id"], fields: ["id", "siteId", "name", "type", "status", "metadata"] },
  price: { model: "price", key: "id", lookup: ["id"], fields: ["id", "siteId", "productId", "label", "amountCents", "currency", "interval", "creditsGranted", "metadata", "status", "effectiveFrom", "effectiveTo"] }
};
const forbidden = /customer|order|payment|subscription|credit|ledger|generation|upload|album|session|secret|password|token|api.?key|private/i;
const protectedSpecs = [
  ["customer", "customer"], ["customerSession", "customerSession"], ["subscription", "subscription"], ["order", "order"],
  ["paymentEvent", "paymentEvent"], ["creditBalance", "creditBalance"], ["creditLedger", "creditLedger"],
  ["generationJob", "generationJob"], ["customerModel", "customerModel"], ["assetUpload", "assetUpload"], ["album", "album"]
];

function fail(message) { throw new Error(message); }
function readScope() {
  if (!scopeArgument) return undefined;
  const file = path.resolve(scopeArgument);
  if (!fs.existsSync(file)) fail(`Content scope not found: ${file}`);
  const scope = JSON.parse(fs.readFileSync(file, "utf8"));
  if (scope?.formatVersion !== 1 || !scope.entities || typeof scope.entities !== "object") fail("Invalid content scope v1.");
  for (const [type, entry] of Object.entries(scope.entities)) {
    if (!entitySpecs[type] || !Array.isArray(entry?.keys) || !entry.keys.length) fail(`Invalid content scope entity: ${type}`);
    if (entry.fieldPaths && (!Array.isArray(entry.fieldPaths) || entry.fieldPaths.some((value) => typeof value !== "string" || !value.includes("/")))) fail(`Invalid content scope field paths: ${type}`);
  }
  if (scope.deletions !== undefined) {
    if (!Array.isArray(scope.deletions)) fail("Invalid content scope deletions.");
    for (const deletion of scope.deletions) {
      if (deletion?.entityType !== "live_page" || !Array.isArray(deletion.keys) || !deletion.keys.length) fail("Only explicit live_page deletions are supported in content scopes.");
    }
  }
  return scope;
}
function clone(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
function stable(value) {
  if (value === undefined) return "undefined";
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
}
function hash(value) { return crypto.createHash("sha256").update(stable(value)).digest("hex"); }
function display(value) {
  if (value === undefined) return "(不存在)";
  const text = JSON.stringify(value);
  return text.length > 1200 ? `${text.slice(0, 1197)}...` : text;
}
function markdownCell(value) { return display(value).replaceAll("|", "\\|").replaceAll("\n", " "); }
function reportPathFor(file, suffix = "") {
  return path.resolve(reportArgument || file.replace(/\.json$/i, `${suffix}.md`));
}
function writeReport(file, title, metadata, rows) {
  const lines = [`# ${title}`, "", ...Object.entries(metadata).map(([key, value]) => `- **${key}**: ${markdownCell(value)}`), "", "| # | 实体 | 记录 | 字段路径 | 操作 | 旧值 | 新值 | baseHash | 结果 |", "|---:|---|---|---|---|---|---|---|---|"];
  rows.forEach((row, index) => lines.push(`| ${index + 1} | ${markdownCell(row.entityType)} | ${markdownCell(row.entityKey)} | ${markdownCell(`${row.field ?? "record"}${row.fieldPath ?? "/"}`)} | ${markdownCell(row.operation ?? "delete")} | ${markdownCell(row.previousValue)} | ${markdownCell(row.value)} | ${markdownCell(row.baseHash || "") } | ${markdownCell(row.result || "planned")} |`));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join("\n")}\n`);
  return file;
}
function clean(value, key = "") {
  if (forbidden.test(key) && key !== "creditCost" && key !== "sectionsOrder") return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => clean(item)).filter((item) => item !== undefined);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([child, item]) => [child, clean(item, child)]).filter(([, item]) => item !== undefined));
  }
  return value;
}
function pointerParts(pointer) {
  if (pointer === "/" || pointer === "") return [];
  if (!pointer.startsWith("/")) fail(`Invalid JSON pointer: ${pointer}`);
  return pointer.slice(1).split("/").map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}
function getPointer(value, pointer) {
  let current = value;
  for (const part of pointerParts(pointer)) current = current == null ? undefined : current[part];
  return current;
}
function setPointer(value, pointer, nextValue, remove = false) {
  const parts = pointerParts(pointer);
  if (!parts.length) return remove ? undefined : clone(nextValue);
  const root = value && typeof value === "object" && !Array.isArray(value) ? clone(value) : {};
  let current = root;
  parts.slice(0, -1).forEach((part) => {
    if (!current[part] || typeof current[part] !== "object") current[part] = {};
    current = current[part];
  });
  const last = parts.at(-1);
  if (remove) {
    if (Array.isArray(current)) current.splice(Number(last), 1);
    else delete current[last];
  } else current[last] = clone(nextValue);
  return root;
}
function ensureTarget() {
  if (!target) fail("--target=test|production is required.");
  if (argumentValue("--target-url")) {
    if (!hasArgument("--bridge")) fail("A custom target URL requires --bridge.");
    if (target === "production" && !hasArgument("--confirm-production")) fail("Production content operations require --confirm-production.");
    const parsed = parseDatabaseUrl(targetUrl);
    if (parsed.port === 15433 || parsed.database === "dingyue_local") fail("The target cannot be the isolated local database.");
  } else {
    assertDatabaseTarget({ expectedTarget: target, requireProductionConfirmation: target === "production", productionConfirmed: hasArgument("--confirm-production") });
  }
  if (target === "production" && !["site_dreamshoot", "site_aidreamcapes_xby"].includes(siteId)) fail("Production content must target an approved production site.");
  if (target === "test" && siteId !== "site_grownstride_test") fail("Test content must target site_grownstride_test.");
}
function ensureSource() {
  if (mode === "plan" && target !== "local" && !sourceUrl) fail("Planning against test/production requires --source-url pointing to the isolated local database.");
  if (mode === "plan" && sourceTarget && sourceTarget !== "local") fail("Content source must be the isolated local target.");
}
function db(url) { return new PrismaClient({ datasources: { db: { url } } }); }
function modelDelegate(client, spec) { return client[spec.model]; }
function identity(row, spec) { return String(row[spec.key] ?? row.id ?? row.slug ?? ""); }
function publicRow(row, spec) {
  const next = {};
  for (const field of spec.fields) {
    const value = clean(row[field], field);
    if (value !== undefined) next[field] = value;
  }
  return next;
}
async function readRows(client, spec, requestedSiteId = siteId) {
  const delegate = modelDelegate(client, spec);
  if (!delegate) fail(`Unsupported Prisma model ${spec.model}.`);
  return delegate.findMany({ where: { siteId: requestedSiteId }, orderBy: { id: "asc" } });
}
async function readAll(client, requestedSiteId = siteId) {
  const result = {};
  for (const [type, spec] of Object.entries(entitySpecs)) result[type] = await readRows(client, spec, requestedSiteId);
  return result;
}
function leafPaths(value, prefix = "") {
  if (Array.isArray(value)) {
    if (!value.length) return [prefix || "/"];
    return value.flatMap((child, index) => leafPaths(child, `${prefix}/${index}`));
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (!entries.length) return [prefix || "/"];
    return entries.flatMap(([key, child]) => leafPaths(child, `${prefix}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`));
  }
  return [prefix || "/"];
}
function rowOperations(sourceRow, targetRow, type, spec, baselineMap) {
  const source = publicRow(sourceRow, spec);
  const targetRowPublic = targetRow ? publicRow(targetRow, spec) : undefined;
  const asset = type === "media_asset" ? publicAssetDescriptor(sourceRow) : undefined;
  if (!targetRow) return [{ entityType: type, entityKey: identity(sourceRow, spec), field: "record", fieldPath: "/", operation: "upsert", baseHash: null, value: source, ...(asset ? { asset } : {}) }];
  const operations = [];
  for (const field of spec.fields.filter((name) => name !== "id" && name !== "siteId")) {
    if (spec.json?.includes(field)) {
      const paths = [...new Set([...leafPaths(source[field]), ...leafPaths(targetRowPublic[field])])];
      for (const fieldPath of paths) {
        const nextValue = getPointer(source[field], fieldPath);
        const currentValue = getPointer(targetRowPublic[field], fieldPath);
        if (hash(nextValue) === hash(currentValue)) continue;
        const baseline = baselineMap.get(`${type}|${identity(sourceRow, spec)}|${field}|${fieldPath}`);
        operations.push({ entityType: type, entityKey: identity(sourceRow, spec), field, fieldPath, operation: nextValue === undefined ? "delete" : "upsert", baseHash: baseline?.valueHash ?? hash(currentValue), previousValue: currentValue, ...(nextValue === undefined ? {} : { value: nextValue }), ...(asset ? { asset } : {}) });
      }
    } else if (hash(source[field]) !== hash(targetRowPublic[field])) {
      const fieldPath = `/${field}`;
      const baseline = baselineMap.get(`${type}|${identity(sourceRow, spec)}|record|${fieldPath}`);
      operations.push({ entityType: type, entityKey: identity(sourceRow, spec), field: "record", fieldPath, operation: "upsert", baseHash: baseline?.valueHash ?? hash(targetRowPublic[field]), previousValue: targetRowPublic[field], value: source[field], ...(asset ? { asset } : {}) });
    }
  }
  return operations;
}
function scopedRowOperations(sourceRow, targetRow, type, spec, baselineMap, scope) {
  if (!scope) return rowOperations(sourceRow, targetRow, type, spec, baselineMap);
  const entry = scope.entities[type];
  if (!entry) return [];
  const lookupValues = new Set([...spec.lookup, spec.key, "id", "slug", "siteId", "storageKey"].map((key) => String(sourceRow[key] ?? "")).filter(Boolean));
  if (!entry.keys.some((key) => lookupValues.has(String(key)))) return [];
  const operations = rowOperations(sourceRow, targetRow, type, spec, baselineMap);
  if (!entry.fieldPaths?.length) return operations;
  const allowed = new Set(entry.fieldPaths);
  return operations.filter((operation) => {
    const path = `${operation.field}${operation.fieldPath}`;
    return [...allowed].some((candidate) => path === candidate || path.startsWith(`${candidate}/`));
  });
}
function publicAssetDescriptor(row) {
  for (const value of [row.previewUrl, row.originUrl, row.storageKey]) {
    if (typeof value !== "string" || !value.startsWith("/")) continue;
    const relative = value.replace(/^\/+/, "");
    const file = path.resolve("public", relative);
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
    execFileSync("git", ["ls-files", "--error-unmatch", path.relative(process.cwd(), file)], { stdio: "ignore" });
    return { path: `public/${relative}`, checksum: crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex") };
  }
  return undefined;
}
function verifyAsset(operation) {
  if (!operation.asset) return;
  if (!/^public\/[A-Za-z0-9._/-]+$/.test(operation.asset.path) || !/^[0-9a-f]{64}$/.test(operation.asset.checksum)) fail("Invalid public asset descriptor.");
  const file = path.resolve(operation.asset.path);
  if (!file.startsWith(`${path.resolve("public")}${path.sep}`) || !fs.existsSync(file)) fail(`Public asset is missing: ${operation.asset.path}`);
  const checksum = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  if (checksum !== operation.asset.checksum) fail(`Public asset checksum mismatch: ${operation.asset.path}`);
}
function forbiddenOperation(operation) {
  if (operation.entityType === "theme_page" && operation.field === "draftJson" && operation.fieldPath === "/sectionsOrder") return false;
  if (operation.entityType === "live_page" && operation.field === "contentJson" && [
    "contentJson/sections/ai_video_topic_landing_1/settings/content/",
    "contentJson/sections/talking_photo_landing_1/settings/content/",
    "contentJson/sections/creators_intro_1/",
    "contentJson/sections/creators_fit_1/",
    "contentJson/sections/partner_form_1/",
    "contentJson/sections/partner_expectations_1/",
    "contentJson/sections/trust_1/",
    "contentJson/sectionsOrder"
  ].some((prefix) => `${operation.field}${operation.fieldPath}`.startsWith(prefix))) return false;
  return forbidden.test(`${operation.entityType}:${operation.field}:${operation.fieldPath}`);
}
function baselineFields(type, row, spec) {
  const value = publicRow(row, spec);
  const entityKey = identity(row, spec);
  return spec.fields.filter((field) => field !== "id" && field !== "siteId").flatMap((field) => {
    const paths = spec.json?.includes(field) ? leafPaths(value[field]) : [`/${field}`];
    return paths.map((fieldPath) => ({
      entityType: type,
      entityKey,
      fieldPath: spec.json?.includes(field) ? `${field}${fieldPath}` : `record${fieldPath}`,
      valueHash: hash(spec.json?.includes(field) ? getPointer(value[field], fieldPath) : value[field])
    }));
  });
}
async function baseline() {
  ensureTarget();
  const client = db(targetUrl);
  try {
    const rows = await readAll(client);
    const data = [];
    for (const [type, spec] of Object.entries(entitySpecs)) {
      for (const row of rows[type]) {
        for (const field of baselineFields(type, row, spec)) data.push({ id: `baseline_${crypto.randomBytes(12).toString("hex")}`, target, siteId, ...field });
      }
    }
    await client.contentSyncBaseline.deleteMany({ where: { target, siteId } });
    if (data.length) await client.contentSyncBaseline.createMany({ data });
    console.log(JSON.stringify({ ok: true, mode: "baseline", target, siteId, fields: data.length }, null, 2));
  } finally { await client.$disconnect(); }
}
async function plan() {
  ensureTarget();
  ensureSource();
  const scope = readScope();
  const source = db(sourceUrl); const destination = db(targetUrl);
  try {
    // Keep tunnel-backed production reads sequential. A single SSH forward may
    // reject multiple simultaneous Prisma connection handshakes even though
    // each individual relational query is healthy.
    const sourceRows = await readAll(source, sourceSiteId);
    const targetRows = await readAll(destination, siteId);
    const baselines = await destination.contentSyncBaseline.findMany({ where: { target, siteId } });
    const baselineMap = new Map(baselines.map((row) => [`${row.entityType}|${row.entityKey}|${row.fieldPath.split("/")[0]}|/${row.fieldPath.split("/").slice(1).join("/")}`, row]));
    const operations = [];
    for (const [type, spec] of Object.entries(entitySpecs)) {
      const targetByLookup = new Map(targetRows[type].flatMap((row) => spec.lookup.map((key) => [String(row[key] ?? ""), row])).filter(([key]) => key));
      for (const sourceRow of sourceRows[type]) {
        const targetRow = spec.lookup.map((key) => targetByLookup.get(String(sourceRow[key] ?? ""))).find(Boolean);
        operations.push(...scopedRowOperations(sourceRow, targetRow, type, spec, baselineMap, scope));
      }
    }
    const deletions = [];
    for (const deletion of scope?.deletions ?? []) {
      const spec = entitySpecs[deletion.entityType];
      const targetRowsForType = targetRows[deletion.entityType] ?? [];
      for (const key of deletion.keys) {
        const current = targetRowsForType.find((row) => spec.lookup.some((lookupKey) => String(row[lookupKey] ?? "") === String(key)));
        deletions.push({ entityType: deletion.entityType, entityKey: current ? identity(current, spec) : String(key), operation: "delete", baseHash: current ? hash(publicRow(current, spec)) : null, ...(current ? { previousValue: publicRow(current, spec) } : {}), reason: deletion.reason || "explicit_scope_deletion" });
      }
    }
    const manifest = { formatVersion: 2, releaseId: argumentValue("--release-id") || `content-${Date.now()}`, codeCommit, target: manifestTarget, sourceTarget: "local", sourceSiteId, siteId, createdAt: new Date().toISOString(), operations, deletions, ...(scopeArgument ? { scopeFile: path.relative(process.cwd(), path.resolve(scopeArgument)) } : {}) };
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
    const reportPath = writeReport(reportPathFor(outPath), "公开内容字段增量计划", { 目标: target, 站点: siteId, 来源站点: sourceSiteId, codeCommit, 生成时间: manifest.createdAt, 字段操作数: operations.length, 显式删除数: deletions.length }, [...operations, ...deletions]);
    console.log(JSON.stringify({ ok: true, mode: "plan", target, siteId, outPath, reportPath, operations: operations.length, deletions: deletions.length }, null, 2));
  } finally { await source.$disconnect(); await destination.$disconnect(); }
}
function readManifest() {
  const file = path.resolve(manifestPath || outPath);
  if (!fs.existsSync(file)) fail(`Manifest not found: ${file}`);
  const manifest = JSON.parse(fs.readFileSync(file, "utf8"));
  if (manifest.formatVersion !== 2 || manifest.siteId !== siteId || manifest.target !== target || manifest.sourceTarget !== "local" || !manifest.sourceSiteId || !Array.isArray(manifest.operations) || !Array.isArray(manifest.deletions)) fail("Invalid content manifest v2.");
  if (!/^[0-9a-f]{40}$/i.test(manifest.codeCommit)) fail("Content manifest must pin a full code commit SHA.");
  if (target !== "local" && argumentValue("--deployed-commit") !== manifest.codeCommit) fail("--deployed-commit must match manifest.codeCommit.");
  if (manifest.target === "production" && !["site_dreamshoot", "site_aidreamcapes_xby"].includes(manifest.siteId)) fail("Production manifest site mismatch.");
  if (manifest.target === "test" && manifest.siteId !== "site_grownstride_test") fail("Test manifest site mismatch.");
  return manifest;
}
async function protectedFingerprint(client) {
  const output = {};
  for (const [key, model] of protectedSpecs) {
    const delegate = client[model];
    // Hash the complete protected rows in memory. The values never enter the
    // manifest or baseline; this only detects an accidental business-data write.
    const rows = await delegate.findMany({ where: { siteId }, orderBy: { id: "asc" } });
    output[key] = { count: rows.length, hash: hash(rows) };
  }
  return output;
}
function dateFieldsFor(model) { return new Set(["createdAt", "updatedAt", "effectiveFrom", "effectiveTo"]); }
function prepared(value, model, key) { return dateFieldsFor(model).has(key) && value ? new Date(value) : clone(value); }
async function apply() {
  ensureTarget();
  if (!hasArgument("--apply")) fail("Content apply is dry-run by default. Add --apply.");
  const manifest = readManifest();
  if (manifest.deletions.length && !hasArgument("--confirm-deletions")) fail("Explicit deletions require --confirm-deletions.");
  const client = db(targetUrl);
  const report = { applied: [], conflicts: [], skipped: [], deletions: [] };
  try {
    await client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Site" WHERE "id" = ${siteId} FOR UPDATE`;
      const before = await protectedFingerprint(tx);
      const rowsByType = new Map();
      const operationTypes = new Set([...manifest.operations, ...manifest.deletions].map((item) => item.entityType));
      for (const entityType of operationTypes) {
        const spec = entitySpecs[entityType];
        if (!spec) fail(`Unsupported public content operation: ${entityType}`);
        rowsByType.set(entityType, await modelDelegate(tx, spec).findMany({ where: { siteId } }));
      }
      for (const operation of manifest.operations) {
        verifyAsset(operation);
        const spec = entitySpecs[operation.entityType];
        if (!spec || forbiddenOperation(operation)) fail(`Unsupported public content operation: ${operation.entityType}`);
        const delegate = modelDelegate(tx, spec);
        const currentRows = rowsByType.get(operation.entityType);
        const current = currentRows.find((row) => spec.lookup.some((key) => String(row[key] ?? "") === String(operation.entityKey)));
        if (operation.field === "record" && operation.fieldPath === "/" && !current) {
          const value = clean(operation.value);
          if (!value || (value.siteId !== siteId && value.siteId !== sourceSiteId)) fail("New public records must belong to the declared source or target site.");
          value.siteId = siteId;
          const create = Object.fromEntries(spec.fields.filter((field) => value[field] !== undefined).map((field) => [field, prepared(value[field], spec.model, field)]));
          if (spec.json?.includes("draftJson") && create.draftJson !== undefined) create.publishedJson = clone(create.draftJson);
          const created = await delegate.create({ data: create });
          for (const field of baselineFields(operation.entityType, created, spec)) {
            await tx.contentSyncBaseline.upsert({
              where: { target_siteId_entityType_entityKey_fieldPath: { target, siteId, entityType: field.entityType, entityKey: field.entityKey, fieldPath: field.fieldPath } },
              create: { id: `baseline_${crypto.randomBytes(12).toString("hex")}`, target, siteId, ...field },
              update: { valueHash: field.valueHash }
            });
          }
          currentRows.push(created);
          report.applied.push(operation);
          continue;
        }
        if (!current) { report.skipped.push({ ...operation, reason: "entity_missing" }); continue; }
        const currentRecord = publicRow(current, spec);
        const currentValue = operation.field === "record" ? getPointer(currentRecord, operation.fieldPath) : getPointer(current[operation.field], operation.fieldPath);
        if (operation.baseHash && hash(currentValue) !== operation.baseHash) { report.conflicts.push({ ...operation, reason: "online_value_changed" }); continue; }
        if (operation.field === "record") {
          const field = operation.fieldPath.slice(1);
          if (!spec.fields.includes(field) || field === "id" || field === "siteId") fail(`Field is not writable: ${operation.entityType}.${field}`);
          const nextValue = prepared(operation.value, spec.model, field);
          await delegate.update({ where: { id: current.id }, data: { [field]: nextValue } });
          current[field] = nextValue;
        } else {
          if (!spec.json?.includes(operation.field)) fail(`JSON field is not writable: ${operation.entityType}.${operation.field}`);
          const nextJson = setPointer(current[operation.field], operation.fieldPath, operation.value, operation.operation === "delete");
          const data = { [operation.field]: nextJson };
          if (spec.json.includes("draftJson")) data.publishedJson = nextJson;
          await delegate.update({ where: { id: current.id }, data });
          current[operation.field] = nextJson;
          if (data.publishedJson !== undefined) current.publishedJson = nextJson;
        }
        report.applied.push(operation);
        await tx.contentSyncBaseline.upsert({ where: { target_siteId_entityType_entityKey_fieldPath: { target, siteId, entityType: operation.entityType, entityKey: operation.entityKey, fieldPath: `${operation.field}${operation.fieldPath}` } }, create: { id: `baseline_${crypto.randomBytes(12).toString("hex")}`, target, siteId, entityType: operation.entityType, entityKey: operation.entityKey, fieldPath: `${operation.field}${operation.fieldPath}`, valueHash: hash(operation.value) }, update: { valueHash: hash(operation.value) } });
      }
      for (const deletion of manifest.deletions) {
        const spec = entitySpecs[deletion.entityType];
        if (!spec || !["live_page", "theme_page", "creative_pack", "media_asset", "tool_category", "tool_menu_item", "video_theme_category", "video_theme"].includes(deletion.entityType)) fail(`Deletion is not allowed for ${deletion.entityType}.`);
        const delegate = modelDelegate(tx, spec);
        const currentRows = rowsByType.get(deletion.entityType);
        const current = currentRows.find((row) => spec.lookup.some((key) => String(row[key] ?? "") === String(deletion.entityKey)));
        if (!current) { report.skipped.push({ ...deletion, reason: "entity_missing_idempotent" }); continue; }
        const currentHash = hash(publicRow(current, spec));
        if (deletion.baseHash && deletion.baseHash !== currentHash) { report.conflicts.push({ ...deletion, reason: "online_value_changed" }); continue; }
        await delegate.delete({ where: { id: current.id } });
        currentRows.splice(currentRows.indexOf(current), 1);
        await tx.contentSyncBaseline.deleteMany({ where: { target, siteId, entityType: deletion.entityType, entityKey: deletion.entityKey } });
        report.deletions.push(deletion);
      }
      const after = await protectedFingerprint(tx);
      if (hash(before) !== hash(after)) fail("Protected business data changed during content apply; transaction rolled back.");
    }, { timeout: 600000, maxWait: 20000 });
    // Public SSR reads draftJson directly; there is no publication refresh step.
    const reportRows = [
      ...report.applied.map((row) => ({ ...row, result: "applied" })),
      ...report.conflicts.map((row) => ({ ...row, result: `conflict:${row.reason}` })),
      ...report.skipped.map((row) => ({ ...row, result: `skipped:${row.reason}` })),
      ...report.deletions.map((row) => ({ ...row, operation: "delete", result: "deleted" }))
    ];
    const manifestFile = path.resolve(manifestPath || outPath);
    const reportFile = writeReport(reportPathFor(manifestFile, ".apply"), "公开内容字段增量执行报告", { 目标: target, 站点: siteId, manifest: manifestFile, codeCommit: manifest.codeCommit, 执行时间: new Date().toISOString(), 已应用: report.applied.length, 冲突: report.conflicts.length, 跳过: report.skipped.length, 删除: report.deletions.length }, reportRows);
    console.log(JSON.stringify({ ok: true, mode: "apply", target, siteId, reportPath: reportFile, report }, null, 2));
  } finally { await client.$disconnect(); }
}

if (mode === "baseline") await baseline();
else if (mode === "plan") await plan();
else if (mode === "apply") await apply();
else fail("Usage: content-sync --mode=baseline|plan|apply");
