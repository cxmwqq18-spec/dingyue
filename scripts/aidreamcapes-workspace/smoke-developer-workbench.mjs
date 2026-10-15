import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { chromium } from "playwright";

// Browser-only component smoke. Every request is intercepted; no app, DB, or provider is used.
const require = createRequire(import.meta.url);
const webpack = require("next/dist/compiled/webpack/webpack");
webpack.init();
const folder = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-developer-workbench-"));
const sourceRoot = path.resolve("src/components/aidreamcapes-workspace");
const css = fs.readFileSync(path.join(sourceRoot, "developer-workbench.module.css"), "utf8");
const classNames = [...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]))];
const classes = Object.fromEntries(classNames.map((name) => [name, `dev-${name}`]));
const source = fs.readFileSync(path.join(sourceRoot, "developer-workbench.tsx"), "utf8")
  .replace('"@/lib/client-csrf"', '"./csrf"')
  .replace('"./developer-workbench.module.css"', '"./styles"');
fs.writeFileSync(path.join(folder, "developer-workbench.js"), ts.transpileModule(source, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
}).outputText);
fs.writeFileSync(path.join(folder, "styles.js"), `module.exports = ${JSON.stringify(classes)};`);
fs.writeFileSync(path.join(folder, "csrf.js"), `exports.customerJsonHeaders = (siteId) => ({ "Content-Type": "application/json", "x-csrf-token": "cookie-token", "x-fixture-site": siteId });`);
fs.writeFileSync(path.join(folder, "entry.js"), `
  const React = require("react");
  const { createRoot } = require("react-dom/client");
  const { DeveloperWorkbench } = require("./developer-workbench");
  createRoot(document.getElementById("root")).render(React.createElement(DeveloperWorkbench, {
    siteId: "site_aidreamcapes", customerId: "customer-1", csrfToken: "fixture-csrf"
  }));
`);
await new Promise((resolve, reject) => webpack.webpack({
  mode: "development", devtool: false, entry: path.join(folder, "entry.js"),
  output: { path: folder, filename: "bundle.js" },
  resolve: { modules: [path.resolve("node_modules")] }
}, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString())) : resolve()));

const scopedCss = css.replace(/\.([a-zA-Z][\w-]*)/g, (_, name) => `.${classes[name] ?? name}`);
const html = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;background:#f4f6f1}${scopedCss}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const keySecret = "adk_live_MOCK_ONLY_NEVER_SEND";
const webhookSecret = "whsec_MOCK_ONLY_NEVER_SEND";
const keys = [{ id: "key-0000-12345678", name: "Existing key", scopes: ["read"], createdAt: "2026-10-01T00:00:00Z", expiresAt: null, revokedAt: null, lastUsedAt: null }];
const hooks = [];
const calls = [];
const unexpected = [];
const external = [];
const pageErrors = [];
let denyKey = false;
let denyWebhook = false;
let denyDelete = false;
let sequence = 0;

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1160, height: 900 } });
const page = await context.newPage();
page.on("pageerror", (error) => pageErrors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
await page.route("**/*", async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  if (url.hostname !== "developer.fixture") { external.push(request.url()); return route.abort(); }
  if (url.pathname === "/bundle.js") return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(folder, "bundle.js")) });
  if (url.pathname === "/") return route.fulfill({ contentType: "text/html", body: html });
  const base = "/api/sites/site_aidreamcapes/aivideosugc";
  if (!url.pathname.startsWith(base)) { unexpected.push(`${request.method()} ${url.pathname}`); return route.fulfill({ status: 404, body: "{}" }); }
  const method = request.method();
  const suffix = url.pathname.slice(base.length);
  const body = request.postDataJSON?.() ?? null;
  calls.push({ method, suffix, headers: request.headers(), body });
  const json = (value, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(value) });
  if (method === "GET" && suffix === "/developer-keys") return json({ keys });
  if (method === "GET" && suffix === "/webhooks") return json({ subscriptions: hooks });
  if (method !== "GET" && request.headers()["x-csrf-token"] !== "fixture-csrf") return json({ error: "csrf_invalid" }, 403);
  if (method === "POST" && suffix === "/developer-keys") {
    if (denyKey) { denyKey = false; return json({ error: "customer_site_mismatch" }, 403); }
    const key = { id: `key-${++sequence}-a1b2c3d4`, name: body.name, scopes: body.scopes, createdAt: "2026-10-15T00:00:00Z", expiresAt: body.expiresAt ?? null, revokedAt: null, lastUsedAt: null };
    keys.unshift(key);
    return json({ key, secret: keySecret, secretShownOnce: true }, 201);
  }
  if (method === "POST" && suffix === "/webhooks") {
    if (denyWebhook) { denyWebhook = false; return json({ error: "webhook_target_private" }, 400); }
    const subscription = { id: `hook-${++sequence}-e5f6a7b8`, endpointUrl: body.url, events: body.events, createdAt: "2026-10-15T00:00:00Z", updatedAt: "2026-10-15T00:00:00Z", disabledAt: null };
    hooks.unshift(subscription);
    return json({ subscription, secret: webhookSecret, secretShownOnce: true }, 201);
  }
  if (method === "DELETE" && /^\/developer-keys\/[^/]+$/.test(suffix)) {
    if (denyDelete) { denyDelete = false; return json({ error: "customer_site_mismatch" }, 403); }
    const key = keys.find((item) => item.id === decodeURIComponent(suffix.split("/").at(-1)));
    if (!key) return json({ error: "developer_key_not_found" }, 404);
    key.revokedAt = "2026-10-15T01:00:00Z";
    return json({ ok: true });
  }
  if (method === "DELETE" && /^\/webhooks\/[^/]+$/.test(suffix)) {
    const hook = hooks.find((item) => item.id === decodeURIComponent(suffix.split("/").at(-1)));
    if (!hook) return json({ error: "webhook_subscription_not_found" }, 404);
    hook.disabledAt = "2026-10-15T01:00:00Z";
    return json({ ok: true });
  }
  unexpected.push(`${method} ${suffix}`);
  return json({ error: "unexpected" }, 404);
});

try {
  await page.goto("http://developer.fixture/");
  await page.getByText("Existing key").waitFor();
  assert.equal(await page.getByText("key-0000-12345678").count(), 0, "full identifier hidden");
  assert.match(await page.locator("code").first().innerText(), /12345678/, "only a masked identifier is visible");
  await page.getByText("Delivery history is not available in this workspace yet.").waitFor();
  await page.getByText("Idempotency-Key").waitFor();

  await page.getByLabel("Key name").fill("Build integration");
  await page.getByLabel("Read tasks").uncheck();
  await page.getByRole("button", { name: "Create API key" }).click();
  await page.getByRole("alert").filter({ hasText: "Select at least one access scope" }).waitFor();
  assert.equal(calls.filter((call) => call.method === "POST").length, 0);

  await page.getByLabel("Create draft tasks").check();
  await page.getByLabel("Expiry date").fill("2027-01-15");
  denyKey = true;
  await page.getByRole("button", { name: "Create API key" }).click();
  await page.getByRole("alert").filter({ hasText: "cannot make this change" }).waitFor();
  assert.equal(await page.getByText(keySecret).count(), 0);
  await page.getByRole("button", { name: "Create API key" }).click();
  await page.getByRole("region", { name: "New secret" }).getByText(keySecret).waitFor();
  const keyPost = calls.find((call) => call.method === "POST" && call.suffix === "/developer-keys" && call.body.name === "Build integration" && call.body.scopes.includes("write"));
  assert.deepEqual(keyPost.body, { name: "Build integration", scopes: ["write"], expiresAt: "2027-01-15T23:59:59.999Z" });
  assert.equal(keyPost.headers["x-csrf-token"], "fixture-csrf");
  assert.equal(keyPost.headers["x-fixture-site"], "site_aidreamcapes");
  await page.getByRole("button", { name: "I have saved it" }).click();
  assert.equal(await page.getByText(keySecret).count(), 0, "secret removed from DOM after close");
  await page.getByRole("button", { name: "Refresh" }).first().click();
  await page.getByText("Build integration").waitFor();
  assert.equal(await page.getByText(keySecret).count(), 0, "list never shows secret");
  assert.equal(await page.evaluate(() => localStorage.length), 0, "secret not persisted");

  await page.getByLabel("HTTPS endpoint").fill("https://hooks.example.com/aidreamcapes");
  denyWebhook = true;
  await page.getByRole("button", { name: "Add webhook endpoint" }).click();
  await page.getByRole("alert").filter({ hasText: "publicly reachable" }).waitFor();
  await page.getByRole("button", { name: "Add webhook endpoint" }).click();
  await page.getByRole("region", { name: "New secret" }).getByText(webhookSecret).waitFor();
  const hookPost = calls.find((call) => call.method === "POST" && call.suffix === "/webhooks" && call.body.url === "https://hooks.example.com/aidreamcapes");
  assert.deepEqual(hookPost.body, { url: "https://hooks.example.com/aidreamcapes", events: ["task.created"] });
  assert.equal(hookPost.headers["x-csrf-token"], "fixture-csrf");
  await page.getByRole("button", { name: "I have saved it" }).click();
  assert.equal(await page.getByText(webhookSecret).count(), 0);

  denyDelete = true;
  await page.getByRole("button", { name: "Revoke" }).first().click();
  await page.getByRole("alert").filter({ hasText: "cannot make this change" }).waitFor();
  await page.getByRole("button", { name: "Revoke" }).first().click();
  await page.getByText("Revoked", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Disable" }).click();
  await page.getByText("Disabled", { exact: true }).waitFor();

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "390px viewport fits");
  assert.deepEqual(pageErrors, []);
  assert.deepEqual(external, []);
  assert.deepEqual(unexpected, []);
  assert.equal(calls.some((call) => call.suffix.includes("deliveries")), false, "no delivery processing or history request");
  assert.equal(calls.some((call) => call.suffix.includes("developer/v1/tasks")), false, "no real task request");
  console.log(`PASS DeveloperWorkbench browser component: key create/list/revoke, expiry, scopes, idempotency guidance, webhook create/list/disable, absent delivery history, CSRF, denied actions, one-time secrets, 390px fit, no unexpected network. Requests: ${calls.length}.`);
} finally {
  await browser.close();
  fs.rmSync(folder, { recursive: true, force: true });
}
