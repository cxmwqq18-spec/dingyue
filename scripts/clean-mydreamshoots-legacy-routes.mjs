#!/usr/bin/env node
import "./load-runtime-env.mjs";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const CONFIRM_TOKEN = "clean-mydreamshoots-legacy-routes";
const ALLOWED_SITE_IDS = new Set(["site_dreamshoot", "site_grownstride_test"]);
const TARGET_DOMAINS = ["mydreamshoots.com", "www.mydreamshoots.com", "test.grownstride.com"];
const MYDREAMSHOOTS_VIDEO_TOOL_SLUGS = [
  "talking-photo",
  "cinematic-video",
  "tiktok-video",
  "instagram-reels",
  "social-media-video",
  "youtube-video",
  "story-video",
  "meme-video",
  "product-video",
  "product-ad-video",
  "promo-video",
  "ugc-ad-video",
  "video-ad",
  "brand-video",
  "music-video",
  "fashion-video",
  "food-video"
];
const transactionTimeoutMs = Number(process.env.ROUTE_CLEANUP_TRANSACTION_TIMEOUT_MS ?? 600000);
const RELATIVE_COLLECTIONS_RE = /(^|[\s"'=([{>:])\/collections(?=\/|[?#"'`<>)\]|&\s.,;:!]|$)/g;
const ROUTE_BOUNDARY = String.raw`(?=\/|[?#"'` + "`" + String.raw`<>)\]|&\s.,;:!]|$)`;
const RELATIVE_TOOLS_ROOT_RE = /(^|[\s"'=([{>:])\/tools(?=[?#"'`<>)\]|&\s.,;:!]|$)/g;
const ROOT_ROUTE_BOUNDARY = String.raw`(?=[?#"'` + "`" + String.raw`<>)\]|&\s.,;:!]|$)`;
const VIDEO_TOOL_SLUG_PATTERN = MYDREAMSHOOTS_VIDEO_TOOL_SLUGS.join("|");
const RELATIVE_VIDEO_TOOLS_RE = new RegExp(
  `(^|[\\s"'=([{>:])\\/tools\\/(${VIDEO_TOOL_SLUG_PATTERN})${ROUTE_BOUNDARY}`,
  "gi"
);
const ABSOLUTE_COLLECTIONS_RES = TARGET_DOMAINS.map((domain) => {
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(https?:\\/\\/${escaped})\\/collections${ROUTE_BOUNDARY}`, "gi");
});
const ABSOLUTE_TOOLS_ROOT_RES = TARGET_DOMAINS.map((domain) => {
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(https?:\\/\\/${escaped})\\/tools${ROOT_ROUTE_BOUNDARY}`, "gi");
});
const ABSOLUTE_VIDEO_TOOLS_RES = TARGET_DOMAINS.map((domain) => {
  const escaped = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(https?:\\/\\/${escaped})\\/tools\\/(${VIDEO_TOOL_SLUG_PATTERN})${ROUTE_BOUNDARY}`, "gi");
});

const SITE_ARRAY_KEYS = [
  "sites",
  "siteDomains",
  "products",
  "creativePacks",
  "mediaAssets",
  "siteThemes",
  "themeCopies",
  "themePublications",
  "creativePackCategories",
  "toolCategories",
  "toolMenuItems",
  "videoThemeCategories",
  "videoThemes",
  "siteAiApps",
  "aiGatewayGroups"
];

const DB_SPECS = [
  { label: "Site", delegate: "site", where: (siteId) => ({ id: siteId }), stringFields: ["name", "slug", "primaryDomain"], jsonFields: ["branding"] },
  { label: "ThemeSettings", delegate: "themeSettings", where: (siteId) => ({ siteId }), jsonFields: ["draftJson", "publishedJson"] },
  { label: "ThemePage", delegate: "themePage", where: (siteId) => ({ siteId }), stringFields: ["slug", "title"], jsonFields: ["draftJson", "publishedJson", "draftMeta"] },
  { label: "ThemePublication", delegate: "themePublication", where: (siteId) => ({ siteId }), jsonFields: ["snapshot"] },
  { label: "SiteTheme", delegate: "siteTheme", where: (siteId) => ({ siteId }), stringFields: ["name", "themeId", "themeKey", "source", "createdBy"], jsonFields: ["templates", "settings"] },
  { label: "ThemeCopy", delegate: "themeCopy", where: (siteId) => ({ siteId }), stringFields: ["name", "themeKey", "source", "createdBy"], jsonFields: ["templates", "settings"] },
  { label: "ToolCategory", delegate: "toolCategory", where: (siteId) => ({ siteId }), stringFields: ["slug", "label", "description", "icon"] },
  { label: "ToolMenuItem", delegate: "toolMenuItem", where: (siteId) => ({ siteId }), stringFields: ["slug", "title", "description", "badge", "icon", "imageUrl", "href"], jsonFields: ["detailJson"] },
  { label: "CreativePackCategory", delegate: "creativePackCategory", where: (siteId) => ({ siteId }), stringFields: ["slug", "label", "description", "heroTitle", "heroSubtitle", "icon", "imageUrl"] },
  { label: "CreativePack", delegate: "creativePack", where: (siteId) => ({ siteId }), stringFields: ["name", "headline", "description", "prompt", "category", "aiAppSlug", "imageUrl"], jsonFields: ["galleryImages", "galleryImageAlts"] },
  { label: "VideoThemeCategory", delegate: "videoThemeCategory", where: (siteId) => ({ siteId }), stringFields: ["slug", "label", "description", "imageUrl"] },
  { label: "VideoTheme", delegate: "videoTheme", where: (siteId) => ({ siteId }), stringFields: ["slug", "name", "headline", "description", "prompt", "status", "imageUrl"], jsonFields: ["modelPricing", "galleryImages"] },
  { label: "MediaAsset", delegate: "mediaAsset", where: (siteId) => ({ siteId }), stringFields: ["label", "storageKey", "previewUrl", "originUrl", "altText", "notes"] },
  { label: "Product", delegate: "product", where: (siteId) => ({ siteId }), stringFields: ["name", "type", "status"] },
  { label: "Price", delegate: "price", where: (siteId) => ({ siteId }), stringFields: ["label", "currency", "interval", "stripePriceId"], jsonFields: ["metadata"] },
  { label: "SiteAiApp", delegate: "siteAiApp", where: (siteId) => ({ siteId }), stringFields: ["routeKey"], jsonFields: ["workflowConfig", "providerConfig"] },
  { label: "AiGatewayGroup", delegate: "aiGatewayGroup", where: (siteId) => ({ siteId }), stringFields: ["name", "status", "accountPoolMode", "unavailableReason"] }
];

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const raw = arg.slice(2);
    const equals = raw.indexOf("=");
    if (equals !== -1) {
      args[raw.slice(0, equals)] = raw.slice(equals + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next && !next.startsWith("--")) {
      args[raw] = next;
      index += 1;
    } else {
      args[raw] = true;
    }
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/clean-mydreamshoots-legacy-routes.mjs --site-id=site_dreamshoot --db --dry-run",
    "  node scripts/clean-mydreamshoots-legacy-routes.mjs --site-id=site_dreamshoot --db --apply --confirm clean-mydreamshoots-legacy-routes",
    "  node scripts/clean-mydreamshoots-legacy-routes.mjs --site-id=site_dreamshoot --file=data/platform-state.json --dry-run"
  ].join("\n");
}

function assertOptions(args) {
  const siteId = args["site-id"];
  if (!ALLOWED_SITE_IDS.has(siteId)) {
    throw new Error(`Unsupported or missing --site-id. Allowed: ${Array.from(ALLOWED_SITE_IDS).join(", ")}\n${usage()}`);
  }

  const dbMode = Boolean(args.db);
  const fileMode = typeof args.file === "string";
  if (dbMode === fileMode) throw new Error(`Choose exactly one of --db or --file=<path>.\n${usage()}`);

  const apply = Boolean(args.apply);
  const dryRun = Boolean(args["dry-run"]) || !apply;
  if (apply && args.confirm !== CONFIRM_TOKEN) {
    throw new Error(`Refusing to write. Re-run with --confirm ${CONFIRM_TOKEN}`);
  }
  if (apply && args["dry-run"]) throw new Error("Use either --dry-run or --apply, not both.");

  return {
    siteId,
    mode: dbMode ? "db" : "file",
    file: fileMode ? path.resolve(String(args.file)) : undefined,
    dryRun,
    apply,
    backupDir: path.resolve(String(args["backup-dir"] ?? "tmp/legacy-route-cleanup-backups"))
  };
}

function rewriteRouteString(value) {
  let next = value;
  for (const re of ABSOLUTE_COLLECTIONS_RES) {
    next = next.replace(re, "$1/ai-image-generation");
  }
  for (const re of ABSOLUTE_TOOLS_ROOT_RES) {
    next = next.replace(re, "$1/ai-video-generation");
  }
  for (const re of ABSOLUTE_VIDEO_TOOLS_RES) {
    next = next.replace(re, "$1/ai-video-generation/$2");
  }
  next = next.replace(RELATIVE_COLLECTIONS_RE, "$1/ai-image-generation");
  next = next.replace(RELATIVE_TOOLS_ROOT_RE, "$1/ai-video-generation");
  next = next.replace(RELATIVE_VIDEO_TOOLS_RE, "$1/ai-video-generation/$2");
  return next;
}

function countLegacyInString(value) {
  let count = 0;
  for (const re of ABSOLUTE_COLLECTIONS_RES) {
    re.lastIndex = 0;
    while (re.exec(value)) count += 1;
  }
  for (const re of ABSOLUTE_TOOLS_ROOT_RES) {
    re.lastIndex = 0;
    while (re.exec(value)) count += 1;
  }
  for (const re of ABSOLUTE_VIDEO_TOOLS_RES) {
    re.lastIndex = 0;
    while (re.exec(value)) count += 1;
  }
  RELATIVE_COLLECTIONS_RE.lastIndex = 0;
  while (RELATIVE_COLLECTIONS_RE.exec(value)) count += 1;
  RELATIVE_TOOLS_ROOT_RE.lastIndex = 0;
  while (RELATIVE_TOOLS_ROOT_RE.exec(value)) count += 1;
  RELATIVE_VIDEO_TOOLS_RE.lastIndex = 0;
  while (RELATIVE_VIDEO_TOOLS_RE.exec(value)) count += 1;
  return count;
}

function rewriteValue(value) {
  if (typeof value === "string") return rewriteRouteString(value);
  if (Array.isArray(value)) return value.map((item) => rewriteValue(item));
  if (!value || typeof value !== "object") return value;

  const next = {};
  for (const [key, child] of Object.entries(value)) {
    next[key] = rewriteValue(child);
  }
  return next;
}

function countLegacy(value) {
  if (typeof value === "string") return countLegacyInString(value);
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countLegacy(item), 0);
  if (!value || typeof value !== "object") return 0;
  return Object.values(value).reduce((sum, child) => sum + countLegacy(child), 0);
}

function collectExamples(value, pathParts = [], examples = [], limit = 12) {
  if (examples.length >= limit) return examples;
  if (typeof value === "string") {
    const count = countLegacyInString(value);
    if (count > 0) {
      examples.push({
        path: pathParts.join("."),
        occurrences: count,
        sample: value.length > 180 ? `${value.slice(0, 177)}...` : value
      });
    }
    return examples;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length && examples.length < limit; index += 1) {
      collectExamples(value[index], [...pathParts, String(index)], examples, limit);
    }
    return examples;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (examples.length >= limit) break;
      collectExamples(child, [...pathParts, key], examples, limit);
    }
  }
  return examples;
}

function changed(left, right) {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function recordId(row) {
  return typeof row?.id === "string" ? row.id : String(row?.siteId ?? "unknown");
}

function uniqueWhere(row) {
  if (typeof row?.id === "string") return { id: row.id };
  if (typeof row?.siteId === "string") return { siteId: row.siteId };
  throw new Error("Cannot build unique where for row without id or siteId.");
}

function buildUpdatedData(row, spec) {
  const data = {};
  for (const field of spec.stringFields ?? []) {
    if (typeof row[field] !== "string") continue;
    const next = rewriteRouteString(row[field]);
    if (next !== row[field]) data[field] = next;
  }
  for (const field of spec.jsonFields ?? []) {
    if (row[field] == null) continue;
    const next = rewriteValue(row[field]);
    if (changed(row[field], next)) data[field] = next;
  }
  return data;
}

function clearStateCaches(rootDir) {
  const cacheFiles = [
    path.join(rootDir, ".next", "cache", "platform-state-postgres.json"),
    path.join(rootDir, ".next-build", "cache", "platform-state-postgres.json")
  ];
  const cleared = [];
  for (const cacheFile of cacheFiles) {
    if (fs.existsSync(cacheFile)) {
      fs.rmSync(cacheFile, { force: true });
      cleared.push(cacheFile);
    }
  }
  return cleared;
}

function rewriteStateForSite(state, siteId) {
  const next = rewriteValueForStateClone(state);
  let scanned = 0;
  let changedRows = 0;
  let occurrencesBefore = 0;
  let occurrencesAfter = 0;
  const samples = [];

  function processArray(key, idField) {
    if (!Array.isArray(next[key])) return;
    next[key] = next[key].map((row) => {
      const matchesSite = idField === "id" ? row?.id === siteId : row?.siteId === siteId;
      if (!matchesSite) return row;
      scanned += 1;
      const rewritten = rewriteValue(row);
      const before = countLegacy(row);
      const after = countLegacy(rewritten);
      occurrencesBefore += before;
      occurrencesAfter += after;
      if (before > 0 && samples.length < 12) {
        samples.push(...collectExamples(row, [key, recordId(row)], [], 12 - samples.length));
      }
      if (changed(row, rewritten)) changedRows += 1;
      return rewritten;
    });
  }

  for (const key of SITE_ARRAY_KEYS) {
    processArray(key, key === "sites" ? "id" : "siteId");
  }

  return {
    state: next,
    summary: {
      label: "PlatformStateFile",
      scanned,
      changedRows,
      occurrencesBefore,
      occurrencesAfter,
      samples
    }
  };
}

function rewriteValueForStateClone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function backupRows(rowsByLabel, backupDir, siteId) {
  fs.mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(backupDir, `${siteId}-legacy-route-cleanup-${timestamp}.json`);
  fs.writeFileSync(backupPath, JSON.stringify({ siteId, createdAt: new Date().toISOString(), rowsByLabel }, null, 2));
  return backupPath;
}

async function processDb(options) {
  const prisma = new PrismaClient();
  const rowsByLabel = {};
  const tables = [];
  let backupPath;

  try {
    for (const spec of DB_SPECS) {
      const delegate = prisma[spec.delegate];
      if (!delegate) throw new Error(`Missing Prisma delegate ${spec.delegate}`);
      const rows = await delegate.findMany({ where: spec.where(options.siteId) });
      rowsByLabel[spec.label] = rows;

      const table = {
        label: spec.label,
        scanned: rows.length,
        changedRows: 0,
        occurrencesBefore: 0,
        occurrencesAfter: 0,
        samples: []
      };

      for (const row of rows) {
        const data = buildUpdatedData(row, spec);
        const rowValue = {};
        const nextValue = {};
        for (const field of [...(spec.stringFields ?? []), ...(spec.jsonFields ?? [])]) {
          rowValue[field] = row[field];
          nextValue[field] = Object.prototype.hasOwnProperty.call(data, field) ? data[field] : row[field];
        }
        const before = countLegacy(rowValue);
        const after = countLegacy(nextValue);
        table.occurrencesBefore += before;
        table.occurrencesAfter += after;
        if (Object.keys(data).length > 0) table.changedRows += 1;
        if (before > 0 && table.samples.length < 12) {
          table.samples.push(...collectExamples(rowValue, [spec.label, recordId(row)], [], 12 - table.samples.length));
        }
      }
      tables.push(table);
    }

    const documents = await prisma.platformStateDocument.findMany();
    const documentTable = {
      label: "PlatformStateDocument",
      scanned: documents.length,
      changedRows: 0,
      occurrencesBefore: 0,
      occurrencesAfter: 0,
      samples: []
    };
    rowsByLabel.PlatformStateDocument = documents;

    const rewrittenDocuments = documents.map((document) => {
      const result = rewriteStateForSite(document.state, options.siteId);
      documentTable.occurrencesBefore += result.summary.occurrencesBefore;
      documentTable.occurrencesAfter += result.summary.occurrencesAfter;
      if (changed(document.state, result.state)) documentTable.changedRows += 1;
      if (result.summary.samples.length && documentTable.samples.length < 12) {
        documentTable.samples.push(...result.summary.samples.slice(0, 12 - documentTable.samples.length));
      }
      return { document, state: result.state };
    });
    tables.push(documentTable);

    if (options.apply) {
      backupPath = await backupRows(rowsByLabel, options.backupDir, options.siteId);
      const timeout = Number.isFinite(transactionTimeoutMs) && transactionTimeoutMs > 0 ? transactionTimeoutMs : 600000;
      await prisma.$transaction(async (tx) => {
        for (const spec of DB_SPECS) {
          const rows = rowsByLabel[spec.label] ?? [];
          for (const row of rows) {
            const data = buildUpdatedData(row, spec);
            if (!Object.keys(data).length) continue;
            await tx[spec.delegate].update({ where: uniqueWhere(row), data });
          }
        }
        for (const { document, state } of rewrittenDocuments) {
          if (!changed(document.state, state)) continue;
          await tx.platformStateDocument.update({ where: { id: document.id }, data: { state } });
        }
      }, { timeout });
    }

    const clearedCaches = options.apply ? clearStateCaches(process.cwd()) : [];
    return { tables, backupPath, clearedCaches };
  } finally {
    await prisma.$disconnect();
  }
}

async function processFile(options) {
  const raw = fs.readFileSync(options.file, "utf8");
  const state = JSON.parse(raw);
  const { state: next, summary } = rewriteStateForSite(state, options.siteId);
  let backupPath;
  if (options.apply && changed(state, next)) {
    fs.mkdirSync(options.backupDir, { recursive: true });
    backupPath = path.join(options.backupDir, `${options.siteId}-platform-state-${Date.now()}.json`);
    fs.writeFileSync(backupPath, raw);
    fs.writeFileSync(options.file, `${JSON.stringify(next, null, 2)}\n`);
  }
  return { tables: [summary], backupPath, clearedCaches: [] };
}

function totals(tables) {
  return tables.reduce(
    (summary, table) => ({
      scannedRows: summary.scannedRows + table.scanned,
      changedRows: summary.changedRows + table.changedRows,
      occurrencesBefore: summary.occurrencesBefore + table.occurrencesBefore,
      occurrencesAfter: summary.occurrencesAfter + table.occurrencesAfter
    }),
    { scannedRows: 0, changedRows: 0, occurrencesBefore: 0, occurrencesAfter: 0 }
  );
}

async function main() {
  const options = assertOptions(parseArgs(process.argv.slice(2)));
  const result = options.mode === "db" ? await processDb(options) : await processFile(options);
  const summary = {
    ok: result.tables.every((table) => table.occurrencesAfter === 0),
    siteId: options.siteId,
    mode: options.mode,
    dryRun: options.dryRun,
    writeEnabled: options.apply,
    replacements: {
      relative: [
        "/collections -> /ai-image-generation",
        "exact /tools -> /ai-video-generation",
        "/tools/{video-slug} -> /ai-video-generation/{video-slug}"
      ],
      absoluteDomains: TARGET_DOMAINS
    },
    totals: totals(result.tables),
    backupPath: result.backupPath,
    clearedCaches: result.clearedCaches,
    tables: result.tables
  };
  console.log(JSON.stringify(summary, null, 2));
  if (!summary.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
