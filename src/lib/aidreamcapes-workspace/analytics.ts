import "server-only";
import { randomUUID } from "node:crypto";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";

export const ANALYTICS_PROVIDERS = [
  "meta_ads",
  "tiktok_ads",
  "google_ads",
  "youtube_ads",
  "pinterest_ads",
  "snapchat_ads"
] as const;

export type AnalyticsProvider = typeof ANALYTICS_PROVIDERS[number];
export type AnalyticsWindow = { from: string; to: string; currency: string };
export type AnalyticsScope = { ownerCustomerId: string; teamId: string | null };
export type ValidatedMetricRecord = {
  providerRecordId: string;
  creativeId: string;
  creativeName: string | null;
  metricDate: string;
  currency: string;
  spendMinorUnits: string;
  impressions: string;
  clicks: string;
  conversions: string;
};
export type ValidatedMetricsImport = {
  provider: AnalyticsProvider;
  providerAccountId: string;
  teamId: string | null;
  records: ValidatedMetricRecord[];
};

const DAY_MS = 86_400_000;
const MAX_SAFE_COUNT = BigInt(Number.MAX_SAFE_INTEGER);
const CURRENCY_SCALE_CACHE = new Map<string, number>();
const IMPORT_ROOT_KEYS = new Set(["provider", "providerAccountId", "teamId", "records"]);
const RECORD_KEYS = new Set([
  "providerRecordId", "creativeId", "creativeName", "date", "currency",
  "spend", "impressions", "clicks", "conversions"
]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("analytics_record_invalid", 400);
  return value as Record<string, unknown>;
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: Set<string>, errorCode: string): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new WorkspaceError(errorCode, 400);
}

function boundedId(value: unknown, code: string, max = 160): string {
  if (typeof value !== "string" || !new RegExp("^[A-Za-z0-9:._-]{1," + max + "}$").test(value)) {
    throw new WorkspaceError(code, 400);
  }
  return value;
}

export function parseIsoDate(value: unknown, code = "analytics_date_invalid"): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new WorkspaceError(code, 400);
  const parsed = new Date(value + "T00:00:00.000Z");
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new WorkspaceError(code, 400);
  return value;
}

export function currencyMinorUnitScale(currencyValue: unknown): number {
  if (typeof currencyValue !== "string" || !/^[A-Z]{3}$/.test(currencyValue)) {
    throw new WorkspaceError("analytics_currency_invalid", 400);
  }
  const cached = CURRENCY_SCALE_CACHE.get(currencyValue);
  if (cached !== undefined) return cached;
  try {
    const supported = (Intl as unknown as { supportedValuesOf?: (key: "currency") => string[] })
      .supportedValuesOf?.("currency");
    if (supported && !supported.includes(currencyValue)) throw new Error("currency");
    const scaleValue = new Intl.NumberFormat("en-US", { style: "currency", currency: currencyValue })
      .resolvedOptions().maximumFractionDigits;
    if (typeof scaleValue !== "number" || !Number.isInteger(scaleValue) || scaleValue < 0 || scaleValue > 3) {
      throw new Error("scale");
    }
    const scale = scaleValue;
    CURRENCY_SCALE_CACHE.set(currencyValue, scale);
    return scale;
  } catch {
    throw new WorkspaceError("analytics_currency_invalid", 400);
  }
}

export function parseSpendMinorUnits(value: unknown, currency: string): string {
  const scale = currencyMinorUnitScale(currency);
  const raw = value;
  if (typeof raw !== "string" || raw.length > 24 || !/^(?:0|[1-9]\d{0,14})(?:\.\d{1,3})?$/.test(raw)) {
    throw new WorkspaceError("analytics_spend_invalid", 400);
  }
  const [whole, fraction = ""] = raw.split(".");
  if (fraction.length > scale) throw new WorkspaceError("analytics_spend_precision_invalid", 400);
  const scaleFactor = BigInt(10) ** BigInt(scale);
  const paddedFraction = scale === 0 ? "" : (fraction + "000").slice(0, scale);
  const minor = BigInt(whole) * scaleFactor + BigInt(paddedFraction || "0");
  if (minor > BigInt("9000000000000000000")) throw new WorkspaceError("analytics_spend_invalid", 400);
  return minor.toString();
}

function parseCount(value: unknown, code: string): string {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) throw new WorkspaceError(code, 400);
    return String(value);
  }
  if (typeof value !== "string" || !/^(?:0|[1-9]\d{0,15})$/.test(value)) throw new WorkspaceError(code, 400);
  const parsed = BigInt(value);
  if (parsed > MAX_SAFE_COUNT) throw new WorkspaceError(code, 400);
  return parsed.toString();
}

function normalizeProvider(value: unknown): AnalyticsProvider {
  if (typeof value !== "string" || !ANALYTICS_PROVIDERS.includes(value as AnalyticsProvider)) {
    throw new WorkspaceError("analytics_provider_invalid", 400);
  }
  return value as AnalyticsProvider;
}

export function parseAnalyticsProvider(value: unknown): AnalyticsProvider {
  return normalizeProvider(value);
}

function normalizeMetricRecord(value: unknown, now: Date): ValidatedMetricRecord {
  const input = record(value);
  assertOnlyKeys(input, RECORD_KEYS, "analytics_metric_record_fields_invalid");
  const providerRecordId = boundedId(input.providerRecordId, "analytics_provider_record_id_invalid");
  const creativeId = boundedId(input.creativeId, "analytics_creative_id_invalid");
  const metricDate = parseIsoDate(input.date, "analytics_metric_date_invalid");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  if (metricDate > today) throw new WorkspaceError("analytics_metric_date_future", 400);
  if (input.creativeName !== undefined && input.creativeName !== null &&
      (typeof input.creativeName !== "string" || !input.creativeName.trim() || input.creativeName.trim().length > 160)) {
    throw new WorkspaceError("analytics_creative_name_invalid", 400);
  }
  const currency = typeof input.currency === "string" ? input.currency : "";
  currencyMinorUnitScale(currency);
  const spendMinorUnits = parseSpendMinorUnits(input.spend, currency);
  const impressions = parseCount(input.impressions, "analytics_impressions_invalid");
  const clicks = parseCount(input.clicks, "analytics_clicks_invalid");
  const conversions = parseCount(input.conversions, "analytics_conversions_invalid");
  if (BigInt(clicks) > BigInt(impressions)) throw new WorkspaceError("analytics_clicks_exceed_impressions", 400);
  return {
    providerRecordId,
    creativeId,
    creativeName: typeof input.creativeName === "string" ? input.creativeName.trim() : null,
    metricDate,
    currency,
    spendMinorUnits,
    impressions,
    clicks,
    conversions
  };
}

export function validateMetricsImport(value: unknown, now = new Date()): ValidatedMetricsImport {
  const input = record(value);
  assertOnlyKeys(input, IMPORT_ROOT_KEYS, "analytics_import_fields_invalid");
  const provider = normalizeProvider(input.provider);
  const providerAccountId = boundedId(input.providerAccountId, "analytics_provider_account_id_invalid", 128);
  const teamId = input.teamId === undefined || input.teamId === null || input.teamId === ""
    ? null
    : boundedId(input.teamId, "analytics_team_id_invalid");
  if (!Array.isArray(input.records) || input.records.length < 1 || input.records.length > 250) {
    throw new WorkspaceError("analytics_metric_records_invalid", 400, { maximum: 250 });
  }
  const records = input.records.map((item) => normalizeMetricRecord(item, now));
  const recordIds = new Set(records.map((item) => item.providerRecordId));
  if (recordIds.size !== records.length) throw new WorkspaceError("analytics_duplicate_provider_record_id", 400);
  return { provider, providerAccountId, teamId, records };
}

export function parseAnalyticsWindow(input: {
  from?: unknown;
  to?: unknown;
  currency?: unknown;
}, now = new Date()): AnalyticsWindow {
  if (input.from === undefined || input.to === undefined || input.currency === undefined) {
    throw new WorkspaceError("analytics_window_and_currency_required", 400);
  }
  const from = parseIsoDate(input.from, "analytics_window_invalid");
  const to = parseIsoDate(input.to, "analytics_window_invalid");
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
  if (from > to || to > today) throw new WorkspaceError("analytics_window_invalid", 400);
  const days = Math.floor((Date.parse(to + "T00:00:00.000Z") - Date.parse(from + "T00:00:00.000Z")) / DAY_MS) + 1;
  if (days > 366) throw new WorkspaceError("analytics_window_too_large", 400, { maximumDays: 366 });
  const currency = typeof input.currency === "string" ? input.currency : "";
  currencyMinorUnitScale(currency);
  return { from, to, currency };
}

type TeamAccessRow = { ownerCustomerId: string; role: "owner" | "admin" | "editor" | "viewer" };

export async function resolveAnalyticsScope(
  siteId: string,
  currentCustomerId: string,
  teamId: string | null,
  write: boolean
): Promise<AnalyticsScope> {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
  if (!teamId) return { ownerCustomerId: currentCustomerId, teamId: null };
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.$queryRawUnsafe<TeamAccessRow[]>(
    'SELECT t."ownerCustomerId", member."role" ' +
    'FROM "AidreamcapesTeam" t ' +
    'JOIN "AidreamcapesTeamMember" member ON member."teamId" = t."id" AND member."siteId" = t."siteId" AND member."ownerCustomerId" = t."ownerCustomerId" ' +
    'JOIN "Customer" actor ON actor."id" = member."customerId" AND actor."siteId" = $1 ' +
    'JOIN "Customer" owner ON owner."id" = t."ownerCustomerId" AND owner."siteId" = $1 ' +
    'WHERE t."id" = $2 AND t."siteId" = $1 AND member."customerId" = $3 LIMIT 1',
    AIVIDEOSUGC_SITE_ID, teamId, currentCustomerId
  );
  const team = rows[0];
  if (!team) throw new WorkspaceError("team_not_found", 404);
  if (write && team.role === "viewer") throw new WorkspaceError("team_permission_denied", 403);
  return { ownerCustomerId: team.ownerCustomerId, teamId };
}

type ExistingMetricRow = {
  providerRecordId: string;
  creativeId: string;
  creativeName: string | null;
  metricDate: Date | string;
  currency: string;
  spendMinorUnits: bigint | number | string;
  impressions: bigint | number | string;
  clicks: bigint | number | string;
  conversions: bigint | number | string;
};

function dbDate(value: Date | string): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
}

function metricMatchesRecord(row: ExistingMetricRow, value: ValidatedMetricRecord): boolean {
  return row.creativeId === value.creativeId &&
    row.creativeName === value.creativeName &&
    dbDate(row.metricDate) === value.metricDate &&
    row.currency.trim() === value.currency &&
    String(row.spendMinorUnits) === value.spendMinorUnits &&
    String(row.impressions) === value.impressions &&
    String(row.clicks) === value.clicks &&
    String(row.conversions) === value.conversions;
}

export async function importProviderMetrics(
  siteId: string,
  currentCustomerId: string,
  value: unknown
) {
  const normalized = validateMetricsImport(value);
  const scope = await resolveAnalyticsScope(siteId, currentCustomerId, normalized.teamId, true);
  const { prisma } = await import("@/lib/prisma");
  return prisma.$transaction(async (tx) => {
    const insertRecords = normalized.records.map((item) => ({
      id: randomUUID(),
      ...item
    }));
    const insertSql =
      'INSERT INTO "AidreamcapesCreativeMetric" ' +
      '("id", "siteId", "ownerCustomerId", "createdByCustomerId", "teamId", "provider", "providerAccountId", "providerRecordId", "creativeId", "creativeName", "metricDate", "currency", "spendMinorUnits", "impressions", "clicks", "conversions") ' +
      'SELECT m."id", $1, owner."id", importer."id", $4, $5, $6, m."providerRecordId", m."creativeId", m."creativeName", m."metricDate", m."currency", m."spendMinorUnits", m."impressions", m."clicks", m."conversions" ' +
      'FROM jsonb_to_recordset($7::jsonb) AS m("id" text, "providerRecordId" text, "creativeId" text, "creativeName" text, "metricDate" date, "currency" text, "spendMinorUnits" bigint, "impressions" bigint, "clicks" bigint, "conversions" bigint) ' +
      'JOIN "Customer" owner ON owner."id" = $2 AND owner."siteId" = $1 ' +
      'JOIN "Customer" importer ON importer."id" = $3 AND importer."siteId" = $1 ' +
      'ON CONFLICT DO NOTHING RETURNING "providerRecordId"';
    const inserted = await tx.$queryRawUnsafe<{ providerRecordId: string }[]>(
      insertSql,
      AIVIDEOSUGC_SITE_ID,
      scope.ownerCustomerId,
      currentCustomerId,
      scope.teamId,
      normalized.provider,
      normalized.providerAccountId,
      JSON.stringify(insertRecords)
    );
    const existing = await tx.$queryRawUnsafe<ExistingMetricRow[]>(
      'SELECT "providerRecordId", "creativeId", "creativeName", "metricDate", "currency", "spendMinorUnits", "impressions", "clicks", "conversions" ' +
      'FROM "AidreamcapesCreativeMetric" ' +
      'WHERE "siteId" = $1 AND "ownerCustomerId" = $2 AND "teamId" IS NOT DISTINCT FROM $3 ' +
      'AND "provider" = $4 AND "providerAccountId" = $5 AND "providerRecordId" = ANY($6::text[])',
      AIVIDEOSUGC_SITE_ID,
      scope.ownerCustomerId,
      scope.teamId,
      normalized.provider,
      normalized.providerAccountId,
      normalized.records.map((item) => item.providerRecordId)
    );
    const byRecordId = new Map(existing.map((item) => [item.providerRecordId, item]));
    for (const item of normalized.records) {
      const prior = byRecordId.get(item.providerRecordId);
      if (!prior) throw new WorkspaceError("analytics_metric_insert_failed", 409, { providerRecordId: item.providerRecordId });
      if (!metricMatchesRecord(prior, item)) {
        throw new WorkspaceError("analytics_provider_record_conflict", 409, { providerRecordId: item.providerRecordId });
      }
    }
    return {
      scope: { teamId: scope.teamId, ownerCustomerId: scope.ownerCustomerId },
      provider: normalized.provider,
      providerAccountId: normalized.providerAccountId,
      importedCount: inserted.length,
      duplicateCount: normalized.records.length - inserted.length,
      origin: "customer_supplied_provider_report"
    };
  });
}

export type AnalyticsAggregateRow = {
  provider: string;
  providerAccountId: string;
  creativeId: string;
  creativeName: string | null;
  spendMinorUnits: string;
  impressions: string;
  clicks: string;
  conversions: string;
  recordCount: string;
  latestImportAt: Date | string;
};

function formatMinorUnits(value: bigint, currency: string): string {
  const scale = currencyMinorUnitScale(currency);
  const factor = BigInt(10) ** BigInt(scale);
  const whole = value / factor;
  if (scale === 0) return whole.toString();
  return whole.toString() + "." + (value % factor).toString().padStart(scale, "0");
}

function roundedDivision(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / BigInt(2)) / denominator;
}

function metricsForTotals(totals: {
  spend: bigint;
  impressions: bigint;
  clicks: bigint;
  conversions: bigint;
}, currency: string) {
  const scale = currencyMinorUnitScale(currency);
  return {
    spend: formatMinorUnits(totals.spend, currency),
    spendMinorUnits: totals.spend.toString(),
    impressions: totals.impressions.toString(),
    clicks: totals.clicks.toString(),
    conversions: totals.conversions.toString(),
    ctr: totals.impressions === BigInt(0)
      ? null
      : Number(((totals.clicks * BigInt(1_000_000)) / totals.impressions)) / 10_000,
    cpa: totals.conversions === BigInt(0)
      ? null
      : formatMinorUnits(roundedDivision(totals.spend, totals.conversions), currency),
    currency,
    currencyMinorUnitScale: scale
  };
}

function summarizeRows(rows: AnalyticsAggregateRow[], currency: string) {
  const totals = rows.reduce((sum, row) => ({
    spend: sum.spend + BigInt(row.spendMinorUnits),
    impressions: sum.impressions + BigInt(row.impressions),
    clicks: sum.clicks + BigInt(row.clicks),
    conversions: sum.conversions + BigInt(row.conversions)
  }), { spend: BigInt(0), impressions: BigInt(0), clicks: BigInt(0), conversions: BigInt(0) });
  const creatives = [...rows]
    .sort((left, right) =>
      compareText(left.provider, right.provider) ||
      compareText(left.providerAccountId, right.providerAccountId) ||
      compareText(left.creativeId, right.creativeId)
    )
    .map((row) => ({
      provider: row.provider,
      providerAccountId: row.providerAccountId,
      creativeId: row.creativeId,
      creativeName: row.creativeName,
      recordCount: row.recordCount,
      metrics: metricsForTotals({
        spend: BigInt(row.spendMinorUnits),
        impressions: BigInt(row.impressions),
        clicks: BigInt(row.clicks),
        conversions: BigInt(row.conversions)
      }, currency)
    }));
  return { totals, creatives };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function buildAnalyticsSummary(
  rows: AnalyticsAggregateRow[],
  window: AnalyticsWindow,
  now = new Date()
) {
  if (rows.length === 0) {
    return {
      dataAvailable: false,
      emptyState: { code: "no_provider_metrics" },
      window: { ...window, timezone: "UTC", inclusive: true },
      metrics: null,
      creatives: [],
      source: { type: "none", recordCount: 0, providers: [], accounts: 0 },
      freshness: null
    };
  }
  const { totals, creatives } = summarizeRows(rows, window.currency);
  const latestImportMs = rows.reduce(
    (latest, row) => Math.max(latest, new Date(row.latestImportAt).getTime()),
    0
  );
  const providers = [...new Set(rows.map((row) => row.provider))].sort();
  const accounts = new Set(rows.map((row) => row.provider + "\0" + row.providerAccountId));
  const recordCount = rows.reduce((sum, row) => sum + BigInt(row.recordCount), BigInt(0)).toString();
  return {
    dataAvailable: true,
    emptyState: null,
    window: { ...window, timezone: "UTC", inclusive: true },
    metrics: metricsForTotals(totals, window.currency),
    creatives,
    source: {
      type: "provider_import",
      origin: "customer_supplied_provider_report",
      recordCount,
      providers,
      accounts: accounts.size
    },
    freshness: {
      latestImportAt: new Date(latestImportMs).toISOString(),
      ageSeconds: Math.max(0, Math.floor((now.getTime() - latestImportMs) / 1000))
    }
  };
}

export async function getAnalyticsSummary(
  siteId: string,
  currentCustomerId: string,
  scopeValue: { teamId: string | null; provider?: string | null },
  window: AnalyticsWindow
) {
  const scope = await resolveAnalyticsScope(siteId, currentCustomerId, scopeValue.teamId, false);
  const { prisma } = await import("@/lib/prisma");
  const providerFilter = "AND ($7::text IS NULL OR metric.\"provider\" = $7)";
  const teamFilter = scope.teamId === null
    ? 'metric."teamId" IS NULL AND metric."ownerCustomerId" = $8 AND $3::text IS NULL'
    : 'metric."teamId" = $3 AND EXISTS (' +
      'SELECT 1 FROM "AidreamcapesTeamMember" actor ' +
      'JOIN "Customer" actorCustomer ON actorCustomer."id" = actor."customerId" AND actorCustomer."siteId" = $1 ' +
      'WHERE actor."teamId" = metric."teamId" AND actor."siteId" = $1 AND actor."ownerCustomerId" = metric."ownerCustomerId" AND actor."customerId" = $8)';
  const rows = await prisma.$queryRawUnsafe<AnalyticsAggregateRow[]>(
    'SELECT metric."provider", metric."providerAccountId", metric."creativeId", MIN(metric."creativeName" COLLATE "C") AS "creativeName", ' +
    'SUM(metric."spendMinorUnits")::text AS "spendMinorUnits", SUM(metric."impressions")::text AS "impressions", ' +
    'SUM(metric."clicks")::text AS "clicks", SUM(metric."conversions")::text AS "conversions", ' +
    'COUNT(*)::text AS "recordCount", MAX(metric."importedAt") AS "latestImportAt" ' +
    'FROM "AidreamcapesCreativeMetric" metric ' +
    'WHERE metric."siteId" = $1 AND metric."ownerCustomerId" = $2 AND ' + teamFilter + ' ' +
    'AND metric."metricDate" >= $4::date AND metric."metricDate" <= $5::date AND metric."currency" = $6 ' +
    providerFilter + ' ' +
    'GROUP BY metric."provider", metric."providerAccountId", metric."creativeId" ' +
    'ORDER BY metric."provider" COLLATE "C" ASC, metric."providerAccountId" COLLATE "C" ASC, metric."creativeId" COLLATE "C" ASC',
    AIVIDEOSUGC_SITE_ID,
    scope.ownerCustomerId,
    scope.teamId,
    window.from,
    window.to,
    window.currency,
    scopeValue.provider ?? null,
    currentCustomerId
  );
  return buildAnalyticsSummary(rows, window);
}
