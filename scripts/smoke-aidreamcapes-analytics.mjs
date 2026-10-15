import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Module from "node:module";
import { createRequire } from "node:module";
import ts from "typescript";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-analytics-"));
const source = path.join(process.cwd(), "src/lib/aidreamcapes-workspace");
const transpile = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
for (const name of ["types", "analytics"]) {
  const output = ts.transpileModule(fs.readFileSync(path.join(source, `${name}.ts`), "utf8"), transpile).outputText;
  fs.writeFileSync(path.join(temp, `${name}.js`), output);
}
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, parent, isMain);
};
let analytics;
try {
  analytics = createRequire(path.join(temp, "entry.cjs"))("./analytics.js");
} finally {
  Module._load = originalLoad;
  fs.rmSync(temp, { recursive: true, force: true });
}
const { buildAnalyticsSummary, currencyMinorUnitScale, parseAnalyticsWindow, parseSpendMinorUnits, validateMetricsImport } = analytics;

const NOW = new Date("2026-10-14T12:00:00.000Z");
const WINDOW = parseAnalyticsWindow(
  { from: "2026-10-01", to: "2026-10-14", currency: "USD" },
  NOW
);

function importPayload(overrides = {}) {
  return {
    provider: "meta_ads",
    providerAccountId: "acct_17",
    records: [{
      providerRecordId: "row_001",
      creativeId: "creative_17",
      creativeName: "Autumn video",
      date: "2026-10-14",
      currency: "USD",
      spend: "12.34",
      impressions: 100,
      clicks: 7,
      conversions: 2
    }],
    ...overrides
  };
}

function expectWorkspaceError(action, code) {
  assert.throws(action, (error) => error?.code === code, code);
}

const validImport = validateMetricsImport(importPayload(), NOW);
assert.equal(validImport.provider, "meta_ads");
assert.equal(validImport.teamId, null);
assert.equal(validImport.records[0].spendMinorUnits, "1234");
assert.equal(validImport.records[0].clicks, "7");

assert.equal(parseSpendMinorUnits("12.345", "KWD"), "12345");
assert.equal(parseSpendMinorUnits("1200", "JPY"), "1200");
assert.equal(currencyMinorUnitScale("JPY"), 0);
assert.equal(currencyMinorUnitScale("KWD"), 3);
expectWorkspaceError(() => parseSpendMinorUnits("1.001", "USD"), "analytics_spend_precision_invalid");
expectWorkspaceError(() => parseSpendMinorUnits("-1.00", "USD"), "analytics_spend_invalid");
expectWorkspaceError(() => parseSpendMinorUnits(1.25, "USD"), "analytics_spend_invalid");
expectWorkspaceError(() => currencyMinorUnitScale("ZZZ"), "analytics_currency_invalid");

expectWorkspaceError(() => validateMetricsImport(importPayload({
  records: [{ ...importPayload().records[0], clicks: 101 }]
}), NOW), "analytics_clicks_exceed_impressions");
expectWorkspaceError(() => validateMetricsImport(importPayload({
  records: [{ ...importPayload().records[0], currency: "usd" }]
}), NOW), "analytics_currency_invalid");
expectWorkspaceError(() => validateMetricsImport(importPayload({
  records: [{ ...importPayload().records[0], date: "2026-10-15" }]
}), NOW), "analytics_metric_date_future");
expectWorkspaceError(() => validateMetricsImport(importPayload({
  ownerCustomerId: "other-customer"
}), NOW), "analytics_import_fields_invalid");
expectWorkspaceError(() => validateMetricsImport(importPayload({
  provider: "unconfigured_provider"
}), NOW), "analytics_provider_invalid");
expectWorkspaceError(() => validateMetricsImport(importPayload({
  records: [
    importPayload().records[0],
    { ...importPayload().records[0], creativeId: "creative_18" }
  ]
}), NOW), "analytics_duplicate_provider_record_id");

expectWorkspaceError(() => parseAnalyticsWindow({
  from: "2026-10-15", to: "2026-10-14", currency: "USD"
}, NOW), "analytics_window_invalid");
expectWorkspaceError(() => parseAnalyticsWindow({
  from: "2025-10-13", to: "2026-10-14", currency: "USD"
}, NOW), "analytics_window_too_large");
expectWorkspaceError(() => parseAnalyticsWindow({
  from: "2026-10-01", to: "2026-10-14", currency: "ZZZ"
}, NOW), "analytics_currency_invalid");

const metricFixtures = [
  { siteId: "site_aidreamcapes", ownerCustomerId: "owner_a", teamId: "team_a", provider: "meta_ads", providerAccountId: "acct_1", creativeId: "creative_z", creativeName: "Zed", date: "2026-10-13", currency: "USD", spend: "1234", impressions: "1000", clicks: "50", conversions: "5", importedAt: "2026-10-14T10:00:00.000Z" },
  { siteId: "site_aidreamcapes", ownerCustomerId: "owner_a", teamId: "team_a", provider: "meta_ads", providerAccountId: "acct_1", creativeId: "creative_z", creativeName: "Zed", date: "2026-10-14", currency: "USD", spend: "766", impressions: "1000", clicks: "50", conversions: "5", importedAt: "2026-10-14T11:00:00.000Z" },
  { siteId: "site_aidreamcapes", ownerCustomerId: "owner_a", teamId: "team_a", provider: "google_ads", providerAccountId: "acct_2", creativeId: "creative_a", creativeName: "Aye", date: "2026-10-12", currency: "USD", spend: "2500", impressions: "500", clicks: "50", conversions: "5", importedAt: "2026-10-13T09:00:00.000Z" },
  { siteId: "site_aidreamcapes", ownerCustomerId: "owner_a", teamId: null, provider: "meta_ads", providerAccountId: "acct_1", creativeId: "private_creative", creativeName: "Personal", date: "2026-10-14", currency: "USD", spend: "99999", impressions: "1", clicks: "0", conversions: "0", importedAt: "2026-10-14T11:00:00.000Z" },
  { siteId: "site_aidreamcapes", ownerCustomerId: "owner_b", teamId: "team_b", provider: "meta_ads", providerAccountId: "acct_1", creativeId: "other_owner", creativeName: "Other owner", date: "2026-10-14", currency: "USD", spend: "88888", impressions: "1", clicks: "0", conversions: "0", importedAt: "2026-10-14T11:00:00.000Z" },
  { siteId: "site_aidreamcapes", ownerCustomerId: "owner_a", teamId: "team_other", provider: "meta_ads", providerAccountId: "acct_1", creativeId: "other_team", creativeName: "Other team", date: "2026-10-14", currency: "USD", spend: "77777", impressions: "1", clicks: "0", conversions: "0", importedAt: "2026-10-14T11:00:00.000Z" },
  { siteId: "site_dreamshoot", ownerCustomerId: "owner_a", teamId: "team_a", provider: "meta_ads", providerAccountId: "acct_1", creativeId: "other_site", creativeName: "Other site", date: "2026-10-14", currency: "USD", spend: "66666", impressions: "1", clicks: "0", conversions: "0", importedAt: "2026-10-14T11:00:00.000Z" },
  { siteId: "site_aidreamcapes", ownerCustomerId: "owner_a", teamId: "team_a", provider: "meta_ads", providerAccountId: "acct_1", creativeId: "out_of_range", creativeName: "Old", date: "2026-09-30", currency: "USD", spend: "55555", impressions: "1", clicks: "0", conversions: "0", importedAt: "2026-10-14T11:00:00.000Z" },
  { siteId: "site_aidreamcapes", ownerCustomerId: "owner_a", teamId: "team_a", provider: "meta_ads", providerAccountId: "acct_1", creativeId: "other_currency", creativeName: "Euro", date: "2026-10-14", currency: "EUR", spend: "44444", impressions: "1", clicks: "0", conversions: "0", importedAt: "2026-10-14T11:00:00.000Z" }
];

const requestedScope = { siteId: "site_aidreamcapes", ownerCustomerId: "owner_a", teamId: "team_a" };
const scopedEvents = metricFixtures.filter((row) =>
  row.siteId === requestedScope.siteId &&
  row.ownerCustomerId === requestedScope.ownerCustomerId &&
  row.teamId === requestedScope.teamId &&
  row.date >= WINDOW.from &&
  row.date <= WINDOW.to &&
  row.currency === WINDOW.currency
);
assert.deepEqual(scopedEvents.map((row) => row.creativeId).sort(), ["creative_a", "creative_z", "creative_z"]);

function aggregateFixtures(events) {
  const groups = new Map();
  for (const event of events) {
    const key = [event.provider, event.providerAccountId, event.creativeId].join("\0");
    const group = groups.get(key) ?? {
      provider: event.provider,
      providerAccountId: event.providerAccountId,
      creativeId: event.creativeId,
      creativeName: event.creativeName,
      spend: 0n,
      impressions: 0n,
      clicks: 0n,
      conversions: 0n,
      recordCount: 0,
      latestImportAt: event.importedAt
    };
    group.spend += BigInt(event.spend);
    group.impressions += BigInt(event.impressions);
    group.clicks += BigInt(event.clicks);
    group.conversions += BigInt(event.conversions);
    group.recordCount += 1;
    group.latestImportAt = group.latestImportAt > event.importedAt ? group.latestImportAt : event.importedAt;
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => ({
    provider: group.provider,
    providerAccountId: group.providerAccountId,
    creativeId: group.creativeId,
    creativeName: group.creativeName,
    spendMinorUnits: group.spend.toString(),
    impressions: group.impressions.toString(),
    clicks: group.clicks.toString(),
    conversions: group.conversions.toString(),
    recordCount: String(group.recordCount),
    latestImportAt: group.latestImportAt
  }));
}

const groups = aggregateFixtures(scopedEvents);
const summary = buildAnalyticsSummary(groups, WINDOW, NOW);
assert.equal(summary.dataAvailable, true);
assert.deepEqual(summary.metrics, {
  spend: "45.00",
  spendMinorUnits: "4500",
  impressions: "2500",
  clicks: "150",
  conversions: "15",
  ctr: 6,
  cpa: "3.00",
  currency: "USD",
  currencyMinorUnitScale: 2
});
assert.deepEqual(summary.creatives.map((row) => row.creativeId), ["creative_a", "creative_z"]);
assert.equal(summary.creatives[1].metrics.spend, "20.00");
assert.equal(summary.creatives[1].metrics.ctr, 5);
assert.equal(summary.creatives[1].metrics.cpa, "2.00");
assert.equal(summary.source.origin, "customer_supplied_provider_report");
assert.equal(summary.source.recordCount, "3");
assert.equal(summary.freshness.latestImportAt, "2026-10-14T11:00:00.000Z");
assert.equal(summary.freshness.ageSeconds, 3600);
assert.deepEqual(
  buildAnalyticsSummary([...groups].reverse(), WINDOW, NOW),
  summary
);

const empty = buildAnalyticsSummary([], WINDOW, NOW);
assert.equal(empty.dataAvailable, false);
assert.equal(empty.emptyState.code, "no_provider_metrics");
assert.equal(empty.metrics, null);
assert.deepEqual(empty.creatives, []);
assert.equal(empty.source.type, "none");
assert.equal(empty.freshness, null);

const analyticsSource = await readFile(new URL("../src/lib/aidreamcapes-workspace/analytics.ts", import.meta.url), "utf8");
const readRoute = await readFile(new URL("../src/app/api/sites/[siteId]/aivideosugc/analytics/route.ts", import.meta.url), "utf8");
const eventRoute = await readFile(new URL("../src/app/api/sites/[siteId]/aivideosugc/analytics/events/route.ts", import.meta.url), "utf8");
assert.match(analyticsSource, /metric\."siteId" = \$1 AND metric\."ownerCustomerId" = \$2/);
assert.match(analyticsSource, /metric\."teamId" = \$3 AND EXISTS/);
assert.match(analyticsSource, /metric\."metricDate" >= \$4::date AND metric\."metricDate" <= \$5::date AND metric\."currency" = \$6/);
assert.match(readRoute, /workspaceAuth\(request, siteId\)/);
assert.match(eventRoute, /workspaceAuth\(request, siteId, true\)/);
assert.doesNotMatch(analyticsSource + readRoute + eventRoute, /\bfetch\s*\(|\bcharge(?:Credit|Customer)?\s*\(|CreditLedger/);

console.log("Aidreamcapes analytics validation, isolation fixtures, currency math, empty state, and comparison ordering passed.");
