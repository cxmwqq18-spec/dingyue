import "server-only";

import { prisma } from "@/lib/prisma";

const configuredSites = new Set(
  String(process.env.STOREFRONT_SNAPSHOT_CACHE_SITES ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
);
const cacheAllSites = configuredSites.has("*");

/**
 * The revision-keyed public cache is opt-in per site. Other storefronts keep
 * the existing per-request read path unchanged until they are measured and
 * explicitly enabled.
 */
export function siteSnapshotCacheEnabled(siteId: string): boolean {
  return cacheAllSites || configuredSites.has(siteId);
}

/**
 * Host lookups do not know the site id before resolving it. When no site cache
 * is configured, skip that extra lookup entirely so other storefronts keep
 * their existing request path.
 */
export function siteSnapshotCacheAnyEnabled(): boolean {
  return cacheAllSites || configuredSites.size > 0;
}

function isMissingRevisionTable(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  const metaCode = (error as { meta?: { code?: string } } | null)?.meta?.code;
  return code === "P2021" || code === "42P01" || metaCode === "42P01";
}

/**
 * Reads the cheap per-site content revision that is maintained by database
 * triggers (see the SiteContentRevision migration). The probe runs once per
 * request and guarantees that a committed content write invalidates the
 * in-process cache on the next request.
 *
 * A missing table is only expected in local environments before the migration
 * is applied; in that case a LivePage timestamp/count probe keeps local
 * caching correct. Any other database error disables the cache for this
 * request instead of serving stale content.
 */
export async function readSiteContentRevision(siteId: string): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ revision: bigint }>>`
      SELECT "revision"
      FROM "SiteContentRevision"
      WHERE "siteId" = ${siteId}
      LIMIT 1
    `;
    if (rows.length > 0) return rows[0].revision.toString();
    return "0";
  } catch (error) {
    if (!isMissingRevisionTable(error)) return null;
  }

  try {
    const rows = await prisma.$queryRaw<Array<{ updatedAt: Date | null; pages: bigint }>>`
      SELECT max("updatedAt") AS "updatedAt", count(*) AS "pages"
      FROM "LivePage"
      WHERE "siteId" = ${siteId}
    `;
    const row = rows[0];
    return `fallback:${row?.pages?.toString() ?? "0"}:${row?.updatedAt?.toISOString() ?? "none"}`;
  } catch {
    return null;
  }
}
