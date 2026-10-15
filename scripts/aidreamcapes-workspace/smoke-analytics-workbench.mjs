import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { chromium } from "playwright";

// Exercise the actual client component in an isolated browser fixture. All API
// requests are intercepted locally; this does not start the app or use a DB.
const require = createRequire(import.meta.url);
const compiledWebpack = require("next/dist/compiled/webpack/webpack");
compiledWebpack.init();
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-analytics-workbench-"));
const root = path.resolve("src/components/aidreamcapes-workspace");
const componentPath = path.join(root, "analytics-workbench.tsx");
const css = fs.readFileSync(path.join(root, "analytics-workbench.module.css"), "utf8");
const classNames = [...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]))];
const classes = Object.fromEntries(classNames.map((name) => [name, `aw-${name}`]));
const component = fs.readFileSync(componentPath, "utf8")
  .replace('"@/lib/client-csrf"', '"./csrf"')
  .replace('"./analytics-workbench.module.css"', '"./styles"');
fs.writeFileSync(path.join(folder, "analytics-workbench.js"), ts.transpileModule(component, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText);
fs.writeFileSync(path.join(folder, "styles.js"), `module.exports = ${JSON.stringify(classes)};`);
fs.writeFileSync(path.join(folder, "csrf.js"), `exports.customerJsonHeaders = (siteId) => ({ "Content-Type": "application/json", "x-csrf-token": "fixture-csrf", "x-fixture-site": siteId });`);
fs.writeFileSync(path.join(folder, "entry.js"), `
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const { AnalyticsWorkbench } = require("./analytics-workbench");
  createRoot(document.getElementById("root")).render(React.createElement(AnalyticsWorkbench, { siteId: "site_aidreamcapes", csrfToken: "fixture-csrf" }));
`);
await new Promise((resolve, reject) => compiledWebpack.webpack({
  mode: "development",
  devtool: false,
  entry: path.join(folder, "entry.js"),
  output: { path: folder, filename: "bundle.js" },
  resolve: { modules: [path.resolve("node_modules")] }
}, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString())) : resolve()));

const scopedCss = css.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => `.${classes[name] ?? name}`);
const html = `<html><head><meta charset="utf-8"><style>
  *{box-sizing:border-box}body{margin:0;padding:22px;background:#f2f2f5;color:#1d1b27;font-family:Arial,sans-serif}
  :root{--ink:#1d1b27;--muted:#71717d;--line:#e2e0e8;--surface:#fff;--canvas:#f4f3f6;--purple:#6840dc}
  ${scopedCss}
</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;

function summaryFixture(options = {}) {
  const rows = options.imported ? [
    { provider: "meta_ads", providerAccountId: "acct-01", creativeId: "creative-new", creativeName: "Newly imported creative", recordCount: "1", metrics: { spend: "12.34", impressions: "100", clicks: "7", conversions: "2", ctr: 7, cpa: "6.17", currency: "USD" } },
    { provider: "google_ads", providerAccountId: "acct-02", creativeId: "creative-spring", creativeName: "Spring launch", recordCount: "2", metrics: { spend: "32.66", impressions: "2400", clicks: "143", conversions: "13", ctr: 5.95, cpa: "2.51", currency: "USD" } }
  ] : [
    { provider: "google_ads", providerAccountId: "acct-02", creativeId: "creative-spring", creativeName: "Spring launch", recordCount: "2", metrics: { spend: "32.66", impressions: "2400", clicks: "143", conversions: "13", ctr: 5.95, cpa: "2.51", currency: "USD" } },
    { provider: "meta_ads", providerAccountId: "acct-01", creativeId: "creative-autumn", creativeName: "Autumn video", recordCount: "1", metrics: { spend: "12.34", impressions: "100", clicks: "7", conversions: "2", ctr: 7, cpa: "6.17", currency: "USD" } }
  ];
  return {
    dataAvailable: true,
    window: { from: "2026-10-01", to: "2026-10-15", currency: "USD", timezone: "UTC", inclusive: true },
    metrics: { spend: options.imported ? "45.00" : "45.00", impressions: "2500", clicks: "150", conversions: "15", ctr: 6, cpa: "3.00", currency: "USD" },
    creatives: rows,
    source: { type: "provider_import", origin: "customer_supplied_provider_report", recordCount: options.imported ? "4" : "3", providers: ["google_ads", "meta_ads"], accounts: 2 },
    freshness: { latestImportAt: "2026-10-15T10:00:00.000Z", ageSeconds: 300 }
  };
}

let mode = "ok";
let imported = false;
const calls = [];
const unexpected = [];
const external = [];
const pageErrors = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1180, height: 980 } });
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(error.message));
await page.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.hostname !== "analytics.fixture") { external.push(request.url()); return route.abort(); }
  if (url.pathname === "/bundle.js") return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(folder, "bundle.js"), "utf8") });
  if (!url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "text/html", body: html });
  const method = request.method();
  calls.push({ method, pathname: url.pathname, search: url.search });
  const summaryPath = "/api/sites/site_aidreamcapes/aivideosugc/analytics";
  const eventsPath = `${summaryPath}/events`;
  const reply = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (url.pathname === summaryPath && method === "GET") {
    const query = url.searchParams;
    assert.match(query.get("from") ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.match(query.get("to") ?? "", /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(query.get("currency"));
    assert.deepEqual([...query.keys()].sort(), ["currency", "from", "to"]);
    if (mode === "error") return reply({ error: "workspace_database_unavailable" }, 503);
    if (mode === "auth") return reply({ error: "customer_auth_required" }, 401);
    if (query.get("currency") === "EUR") return reply({ dataAvailable: false, window: { from: query.get("from"), to: query.get("to"), currency: "EUR", timezone: "UTC", inclusive: true }, metrics: null, creatives: [], source: { type: "none", recordCount: 0, providers: [], accounts: 0 }, freshness: null });
    return reply(summaryFixture({ imported }));
  }
  if (url.pathname === eventsPath && method === "POST") {
    assert.equal(request.headers()["x-csrf-token"], "fixture-csrf", "mutating import carries the CSRF token");
    const body = request.postDataJSON();
    assert.deepEqual(Object.keys(body).sort(), ["provider", "providerAccountId", "records"].sort());
    assert.equal(body.provider, "meta_ads");
    assert.ok(body.providerAccountId);
    assert.ok(Array.isArray(body.records) && body.records.length === 1);
    assert.deepEqual(Object.keys(body.records[0]).sort(), ["clicks", "conversions", "creativeId", "creativeName", "date", "currency", "impressions", "providerRecordId", "spend"].sort());
    imported = true;
    return reply({ importedCount: 1, duplicateCount: 0, origin: "customer_supplied_provider_report" }, 201);
  }
  unexpected.push(`${method} ${url.pathname}`);
  return reply({ error: "unexpected_fixture_request" }, 500);
});

try {
  await page.goto("https://analytics.fixture/site/aidreamcapes/app/create?view=analytics");
  await page.getByRole("heading", { name: "Ad performance", exact: true }).waitFor();
  await page.getByRole("heading", { name: "Spring launch", exact: true }).waitFor();
  assert.equal(await page.getByText("Customer imported", { exact: true }).count(), 1);
  assert.match(await page.getByText(/These numbers come from reports you import/).innerText(), /No advertising account is connected/);
  assert.equal(calls.length, 1, "initial load makes one summary request");

  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 3);
  const end = new Date();
  await page.getByLabel("Date from", { exact: true }).fill(start.toISOString().slice(0, 10));
  await page.getByLabel("Date to", { exact: true }).fill(end.toISOString().slice(0, 10));
  await page.getByLabel("Currency", { exact: true }).fill("eur");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.getByRole("heading", { name: "Your imported results will appear here", exact: true }).waitFor();
  assert.ok(calls.at(-1).search.includes("currency=EUR"));
  assert.ok(calls.at(-1).search.includes(`from=${start.toISOString().slice(0, 10)}`));
  assert.ok(calls.at(-1).search.includes(`to=${end.toISOString().slice(0, 10)}`));

  await page.getByLabel("Currency", { exact: true }).fill("USD");
  await page.getByRole("button", { name: "Apply filters", exact: true }).click();
  await page.getByRole("heading", { name: "Spring launch", exact: true }).waitFor();
  const beforeRefresh = calls.filter((call) => call.method === "GET").length;
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("heading", { name: "Spring launch", exact: true }).waitFor();
  assert.equal(calls.filter((call) => call.method === "GET").length, beforeRefresh + 1, "refresh reloads the current report once");

  await page.getByLabel("Account reference", { exact: true }).fill("acct-01");
  await page.getByLabel("Choose CSV report", { exact: true }).setInputFiles({
    name: "weekly-report.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(`providerRecordId,creativeId,creativeName,date,currency,spend,impressions,clicks,conversions\nrow-001,creative-new,Newly imported creative,${new Date().toISOString().slice(0, 10)},USD,12.34,100,7,2`)
  });
  await page.getByText("1 row ready to review", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Import report", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Imported 1 row." }).waitFor();
  await page.getByRole("heading", { name: "Newly imported creative", exact: true }).waitFor();
  assert.equal(calls.filter((call) => call.pathname.endsWith("/events")).length, 1);

  await page.getByRole("tab", { name: "JSON", exact: true }).click();
  const today = new Date().toISOString().slice(0, 10);
  const jsonPayload = { provider: "meta_ads", providerAccountId: "acct-json", records: [{ providerRecordId: "row-json", creativeId: "creative-json", creativeName: "JSON sample", date: today, currency: "USD", spend: "8.50", impressions: 200, clicks: 12, conversions: 1 }] };
  await page.getByLabel("Choose JSON report", { exact: true }).setInputFiles({ name: "report.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(jsonPayload)) });
  await page.getByText("1 report row · Meta Ads", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Import report", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Imported 1 row." }).waitFor();
  assert.equal(calls.filter((call) => call.pathname.endsWith("/events")).length, 2);

  await page.getByRole("tab", { name: "One row", exact: true }).click();
  await page.getByLabel("Account reference", { exact: true }).fill("acct-manual");
  await page.getByLabel("Report row ID", { exact: true }).fill("row-manual");
  await page.getByLabel("Creative ID", { exact: true }).fill("creative-manual");
  await page.getByLabel("Creative name", { exact: true }).fill("Hand entered result");
  await page.getByLabel("Spend", { exact: true }).fill("3.25");
  await page.getByLabel("Impressions", { exact: true }).fill("50");
  await page.getByLabel("Clicks", { exact: true }).fill("4");
  await page.getByLabel("Conversions", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Import this row", exact: true }).click();
  await page.getByRole("status").filter({ hasText: "Imported 1 row." }).waitFor();
  assert.equal(calls.filter((call) => call.pathname.endsWith("/events")).length, 3);

  mode = "error";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Saved reports are temporarily unavailable" }).waitFor();
  mode = "ok";
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("heading", { name: "Spring launch", exact: true }).waitFor();

  mode = "auth";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("link", { name: "Log in", exact: true }).waitFor();
  const loginHref = new URL(await page.getByRole("link", { name: "Log in", exact: true }).getAttribute("href"), "https://analytics.fixture");
  assert.equal(loginHref.pathname, "/site/aidreamcapes/login");
  assert.equal(loginHref.searchParams.get("next"), "/site/aidreamcapes/app/create?view=analytics");
  mode = "ok";
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await page.getByRole("heading", { name: "Spring launch", exact: true }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "390px layout does not overflow horizontally");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(external, [], "no external network requests");
  assert.deepEqual(unexpected, [], "only analytics summary GET and report import POST are requested");
  console.log(`PASS AnalyticsWorkbench actual browser component: summary, date/currency filters, refresh, CSV/JSON/manual import, CSRF, retryable error, guest login path, 390px fit, no unexpected network. GETs: ${calls.filter((call) => call.method === "GET").length}; imports: ${calls.filter((call) => call.method === "POST").length}.`);
} catch (error) {
  console.error({ calls, unexpected, external, body: await page.locator("body").innerText().catch(() => "") });
  throw error;
} finally {
  await browser.close();
  fs.rmSync(folder, { recursive: true, force: true });
}
