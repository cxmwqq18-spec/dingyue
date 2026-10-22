#!/usr/bin/env node
// Read-only coverage audit for the public SSR revision cache.
//
// The public storefront cache is revision-keyed: every request probes
// `SiteContentRevision` and drops its cached state when the revision moves.
// That is only safe if every table the public projection reads has a trigger
// that bumps the revision. A table that is read but not covered keeps serving
// stale content until the entry is evicted.
//
// This audit compares the tables the public projection actually reads against
// the triggers that exist in the database and reports the difference. It
// never writes.
//
// Usage:
//   node scripts/audit-aidreamcapes-cache-revision-coverage.mjs --target=local
//   node scripts/audit-aidreamcapes-cache-revision-coverage.mjs --target=production
//
// Exit code is non-zero when a table is read but has no trigger, so the
// script can gate a release or a cache-enablement decision.
import { PrismaClient } from "@prisma/client";
import "./load-runtime-env.mjs";
import {
  argumentValue,
  assertAllowedSite,
  assertDatabaseTarget,
  databaseTargetSummary,
  hasArgument
} from "./lib/database-target.mjs";

const SITE_ID = assertAllowedSite("site_aidreamcapes");
const target = argumentValue("--target") || process.env.DATABASE_TARGET || "local";
assertDatabaseTarget({ expectedTarget: target });

/**
 * Tables read by the public SSR projection.
 *
 * Source of truth is `loadStorefrontPublicRuntimeState` plus the select
 * shapes it uses in `src/lib/stores/site-store.ts`:
 *   publicRuntimeSiteSelect        -> Site, SiteDomain, ThemeSettings,
 *                                     StorefrontProfile, LivePage,
 *                                     StripeConnectAccount
 *   publicRuntimeSiteAiAppSelect   -> SiteAiApp, AiApp
 *   publicRuntimeMediaAssetSelect  -> MediaAsset
 *   product/price query            -> Product, Price
 *   creative pack queries          -> CreativePack, CreativePackCategory
 *   tool menu queries              -> ToolCategory, ToolMenuItem
 *   video theme queries            -> VideoTheme, VideoThemeCategory,
 *                                     VideoThemeExample
 *
 * `AiApp` is a global table with no `siteId`, so its trigger resolves the
 * referencing sites through `SiteAiApp` instead of reading a site column.
 */
const PUBLIC_PROJECTION_TABLES = [
  { table: "AiApp", scope: "global" },
  { table: "CreativePack", scope: "site" },
  { table: "CreativePackCategory", scope: "site" },
  { table: "LivePage", scope: "site" },
  { table: "MediaAsset", scope: "site" },
  { table: "Price", scope: "site" },
  { table: "Product", scope: "site" },
  { table: "Site", scope: "site", idColumn: "id" },
  { table: "SiteAiApp", scope: "site" },
  { table: "SiteDomain", scope: "site" },
  { table: "StorefrontProfile", scope: "site" },
  { table: "StripeConnectAccount", scope: "site" },
  { table: "ThemeSettings", scope: "site" },
  { table: "ToolCategory", scope: "site" },
  { table: "ToolMenuItem", scope: "site" },
  { table: "VideoTheme", scope: "site" },
  { table: "VideoThemeCategory", scope: "site" },
  { table: "VideoThemeExample", scope: "site" }
];

const TRIGGER_PREFIX = "SiteContentRevision_";

const prisma = new PrismaClient();

async function readTriggers() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT c.relname AS table_name, t.tgname AS trigger_name
       FROM pg_trigger t
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal
        AND t.tgname LIKE '${TRIGGER_PREFIX}%'
        AND n.nspname = 'public'`
  );
  return rows;
}

async function readRevision() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "revision", "updatedAt" FROM "SiteContentRevision" WHERE "siteId" = $1`,
    SITE_ID
  );
  return rows[0] ?? null;
}

try {
  const triggers = await readTriggers();
  const revision = await readRevision();

  const triggerByTable = new Map();
  for (const row of triggers) {
    const existing = triggerByTable.get(row.table_name) ?? [];
    existing.push(row.trigger_name);
    triggerByTable.set(row.table_name, existing);
  }

  const covered = [];
  const uncovered = [];
  for (const entry of PUBLIC_PROJECTION_TABLES) {
    const names = triggerByTable.get(entry.table) ?? [];
    if (names.length > 0) {
      covered.push({ table: entry.table, triggers: names });
    } else {
      uncovered.push({ table: entry.table, scope: entry.scope });
    }
  }

  const cacheSites = String(process.env.STOREFRONT_SNAPSHOT_CACHE_SITES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const cacheEnabledForSite = cacheSites.includes("*") || cacheSites.includes(SITE_ID);

  const result = {
    ok: uncovered.length === 0,
    target,
    siteId: SITE_ID,
    cacheEnabledForSite,
    cacheSites,
    revision: revision ? revision.revision.toString() : null,
    revisionUpdatedAt: revision ? revision.updatedAt : null,
    publicProjectionTableCount: PUBLIC_PROJECTION_TABLES.length,
    coveredTableCount: covered.length,
    uncoveredTableCount: uncovered.length,
    uncovered,
    covered
  };

  console.log(JSON.stringify(result, null, 2));

  if (uncovered.length > 0) {
    console.error(
      `[revision-coverage] ${uncovered.length} public projection table(s) have no ${TRIGGER_PREFIX} trigger: ` +
        uncovered.map((entry) => entry.table).join(", ")
    );
    if (cacheEnabledForSite) {
      console.error(
        "[revision-coverage] the revision cache is enabled for this site, so uncovered tables can serve stale content."
      );
    }
    process.exit(1);
  }
  if (!revision) {
    console.error(`[revision-coverage] no ${"SiteContentRevision"} row for ${SITE_ID}; the cache probe will fail closed.`);
    process.exit(1);
  }
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        target,
        error: error instanceof Error ? error.message : String(error),
        observed: databaseTargetSummary()
      },
      null,
      2
    )
  );
  process.exit(1);
} finally {
  await prisma.$disconnect();
}
