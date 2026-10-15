import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { chromium } from "playwright";

// Fully intercepted component harness: no app server, database, port changes,
// provider, billing, or external requests. Fixtures persist across page reloads.
const require = createRequire(import.meta.url);
const compiled = require("next/dist/compiled/webpack/webpack"); compiled.init();
const root = process.cwd();
const output = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-twin-ui-"));
const sourceRoot = "src/components/aidreamcapes-workspace";
for (const file of ["twin-client.ts", "twin-workbench.tsx"]) {
  const source = fs.readFileSync(path.join(sourceRoot, file), "utf8").replace('"@/lib/client-csrf"', '"./csrf"').replace('"./twin-workbench.module.css"', '"./styles"');
  fs.writeFileSync(path.join(output, file.replace(/\.tsx?$/, ".js")), ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText);
}
fs.writeFileSync(path.join(output, "csrf.js"), ts.transpileModule(fs.readFileSync("src/lib/client-csrf.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
fs.writeFileSync(path.join(output, "styles.js"), "export default new Proxy({}, {get: (_, key) => 'tw-' + String(key)});");
fs.writeFileSync(path.join(output, "entry.js"), `import React from 'react'; import {createRoot} from 'react-dom/client'; import {TwinWorkbench} from './twin-workbench'; window.usedActors=[]; createRoot(document.getElementById('root')).render(React.createElement(TwinWorkbench,{siteId:'site_aidreamcapes',customerId:location.search.includes('guest')?undefined:'fixture-customer',csrfToken:location.search.includes('no-token')?undefined:'fixture-csrf',loginHref:'/login?next=%2Fapp%3Fview%3Dtwin',onUseActor:id=>window.usedActors.push(id)}));`);
await new Promise((resolve, reject) => compiled.webpack({ mode: "development", devtool: false, entry: path.join(output, "entry.js"), output: { path: output, filename: "bundle.js" }, resolve: { modules: [path.join(root, "node_modules")] } }, (error, stats) => error || stats.hasErrors() ? reject(error || new Error(stats.toString())) : resolve()));
const css = fs.readFileSync(`${sourceRoot}/twin-workbench.module.css`, "utf8").replace(/\.([a-zA-Z][\w-]*)/g, ".tw-$1");
const html = `<html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f3f4f6;font-family:Arial}button,input,select{font:inherit}h1,h2,h3,p{margin:0}${css}</style></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>`;
const image = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="76" height="90"><rect width="76" height="90" fill="#c7b9e8"/></svg>')}`;
const audio = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
let actors = [], consents = [], jobs = [];
let assets = [{ id: "portrait-owned", label: "My portrait", mimeType: "image/jpeg", previewUrl: image, kind: "image", role: "input", previewStatus: "ready" }, { id: "audio-owned", label: "My recording", mimeType: "audio/wav", previewUrl: audio, kind: "audio", role: "input", previewStatus: "ready" }, { id: "audio-output", label: "Generated output", mimeType: "audio/wav", previewUrl: audio, kind: "audio", role: "output" }, { id: "audio-missing", label: "Unreadable audio", mimeType: "audio/wav", previewUrl: audio, kind: "audio", role: "input", previewStatus: "loading" }];
let mode = "ok", mutationCount = 0, queueCount = 0;
const external = [], unexpected = [], errors = [], calls = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
page.on("pageerror", error => errors.push(error.message));
await context.route("**/*", async route => {
  const request = route.request(); const url = new URL(request.url());
  if (url.hostname !== "twin.fixture") { external.push(request.url()); return route.abort(); }
  if (url.pathname === "/bundle.js") return route.fulfill({ contentType: "application/javascript", body: fs.readFileSync(path.join(output, "bundle.js"), "utf8") });
  if (!url.pathname.startsWith("/api/")) return route.fulfill({ contentType: "text/html", body: html });
  const method = request.method(); const endpoint = url.pathname.split("/aivideosugc")[1];
  calls.push([method, endpoint]);
  const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  if (method !== "GET") { mutationCount++; assert.equal(request.headers()["x-csrf-token"], "fixture-csrf"); }
  if (mode === "schema" && endpoint === "/clones/jobs") return respond({ error: "clone_schema_required" }, 503);
  if (method === "GET") {
    if (endpoint === "/clones") return respond({ productionReady: false, mockAvailable: true, voiceTwin: { state: mode === "provider" ? "not_configured" : "mock_only", available: false }, components: { database: { available: true } } });
    if (endpoint === "/actors") return respond({ actors });
    if (endpoint === "/clones/assets") return respond({ assets: mode === "empty" ? [] : assets });
    if (endpoint === "/clones/jobs") return respond({ jobs });
    if (endpoint === "/clones/consents") return respond({ consents });
  }
  if (method === "POST" && endpoint === "/clones/assets") {
    assert.match(request.postData() || "", /voice_twin/);
    const asset = { id: "uploaded-audio", label: "New recording", mimeType: "audio/wav", previewUrl: audio, kind: "audio" }; assets.push(asset); return respond({ asset });
  }
  if (method === "POST" && url.pathname.includes("/customers/") && url.pathname.endsWith("/assets")) {
    assert.match(request.postData() || "", /image\/jpeg/);
    const asset = { id: "uploaded-portrait", label: "New portrait", mimeType: "image/jpeg", previewUrl: image, role: "input", previewStatus: "ready" }; assets.push(asset); return respond({ asset });
  }
  const body = request.postData()?.startsWith("{") ? request.postDataJSON() : {};
  if (method === "POST" && endpoint === "/actors") {
    assert.equal(body.imageUrl, image); assert.equal(body.refAudio, audio);
    const actor = { actorId: `custom-${actors.length + 1}`, name: body.name, imageUrl: image, voice: { refAudio: audio, voiceId: "mock:fixture" } }; actors.push(actor); return respond({ actor }, 201);
  }
  if (method === "DELETE" && endpoint?.startsWith("/actors/")) { actors = actors.filter(actor => !endpoint.endsWith(actor.actorId)); return respond({ ok: true }); }
  if (method === "POST" && endpoint === "/clones/consents") {
    assert.equal(body.rightsConfirmed, true); assert.equal(body.scope, "voice_twin"); assert.ok(body.actorId.startsWith("custom-"));
    const consent = { id: `consent-${consents.length + 1}`, actorId: body.actorId, workflow: "voice_twin", sourceAssetId: "audio-owned", revision: 1, status: "granted" }; consents.push(consent); return respond({ consent }, 201);
  }
  if (method === "POST" && endpoint === "/clones/voice-twins/queue") {
    queueCount++; assert.match(request.headers()["idempotency-key"], /^twin-ui:/);
    if (mode === "queue-fail") return respond({ error: "request_failed" }, 500);
    await new Promise(resolve => setTimeout(resolve, 60));
    const consent = consents.find(item => item.id === body.consentId); assert.equal(body.consentRevision, consent.revision);
    const job = { id: `job-${jobs.length + 1}`, actorId: consent.actorId, consentId: consent.id, consentRevision: consent.revision, workflow: "voice_twin", status: "queued", revision: 1, capabilityState: "mock_only", createdAt: new Date().toISOString() }; jobs.push(job); return respond({ job }, 202);
  }
  const jobMatch = endpoint?.match(/^\/clones\/jobs\/([^/]+)(?:\/(.+))?$/);
  if (jobMatch) {
    const job = jobs.find(item => item.id === jobMatch[1]); assert.ok(job); assert.equal(request.headers()["if-match"], String(job.revision));
    if (mode === "conflict") return respond({ error: "revision_conflict" }, 409);
    const action = jobMatch[2];
    if (action === "bind-actor") { assert.equal(body.mockMode, true); return respond({ actor: actors.find(item => item.actorId === body.actorId) }); }
    if (action === "retry") { assert.equal(body.mockMode, true); const next = { ...job, id: `job-${jobs.length + 1}`, status: "queued", revision: 1 }; jobs.push(next); return respond({ job: next }); }
    job.revision++; job.status = method === "DELETE" ? "deleted" : action === "cancel" ? "cancelled" : "mock_complete";
    return respond({ job });
  }
  if (endpoint?.startsWith("/clones/consents/") && method === "PATCH") {
    const consent = consents.find(item => endpoint.endsWith(item.id)); assert.equal(request.headers()["if-match"], String(consent.revision)); consent.revision++; consent.status = "revoked"; return respond({ consent });
  }
  unexpected.push([method, endpoint]); return respond({ error: "unexpected_fixture_request" }, 500);
});
const open = async (query = "") => { await page.goto(`https://twin.fixture/${query}`); await page.getByRole("heading", { name: "AI Twin", exact: true }).waitFor(); };
const ready = () => page.getByText("Simulation workspace", { exact: true }).waitFor();
const fill = async () => {
  await page.getByLabel("Presenter name", { exact: true }).fill("My studio twin");
  await page.getByRole("button", { name: "My portrait", exact: true }).click();
  await page.getByRole("button", { name: "My recording WAV", exact: true }).click();
  await page.getByRole("checkbox").nth(0).check(); await page.getByRole("checkbox").nth(1).check();
};
try {
  await open("?guest");
  assert.match(await page.getByRole("link", { name: "Log in to continue" }).getAttribute("href"), /next=.*view%3Dtwin/);
  assert.equal(calls.length, 0); assert.equal(mutationCount, 0);
  mode = "empty"; await open(); await ready();
  assert.equal(await page.getByRole("button", { name: "My recording WAV", exact: true }).count(), 0);
  assert.equal(await page.getByRole("button", { name: "Save & queue simulation" }).isDisabled(), true);
  mode = "provider"; await open(); await page.getByText("Voice training is unavailable here. Refresh to check availability; saved profiles are kept.").waitFor();
  assert.equal(await page.getByRole("button", { name: "Save & queue simulation" }).isDisabled(), true);
  mode = "schema"; await open(); await page.getByRole("alert").waitFor();
  assert.match(await page.getByRole("alert").innerText(), /storage is not set up/);
  assert.equal(await page.getByRole("button", { name: "Save & queue simulation" }).isDisabled(), true);
  mode = "ok"; await page.getByRole("button", { name: "Refresh", exact: true }).click(); await ready();
  assert.equal(await page.getByText("Your next on-screen self starts here").count(), 1);
  assert.equal(await page.getByRole("button", { name: /Generated output/ }).count(), 0);
  assert.equal(await page.getByRole("button", { name: /Unreadable audio/ }).count(), 0);
  await fill();
  await page.getByRole("button", { name: "Save & queue simulation" }).evaluate(button => { button.click(); button.click(); });
  await page.getByText("Simulation queued", { exact: true }).waitFor(); assert.equal(queueCount, 1); assert.equal(actors.length, 1); assert.equal(consents.length, 1);
  // Translation may wrap text nodes; all changing labels have stable host spans.
  await page.getByText("Simulation queued", { exact: true }).evaluate(node => { node.innerHTML = "<font>Simulation queued</font>"; });
  await page.getByRole("button", { name: "Run simulation", exact: true }).click(); await page.getByText("Simulation complete · no voice trained", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Link simulation to presenter" }).click(); await page.getByRole("status").filter({ hasText: "Simulation linked" }).waitFor();
  await page.getByRole("button", { name: "Use portrait presenter" }).click(); assert.deepEqual(await page.evaluate(() => window.usedActors), ["custom-1"]);
  await page.reload(); await ready(); assert.equal(await page.getByText("Simulation complete · no voice trained", { exact: true }).count(), 1);
  await page.getByRole("button", { name: "Retry simulation" }).click(); await page.getByText("Simulation queued", { exact: true }).waitFor();
  mode = "conflict"; await page.getByRole("button", { name: "Cancel request" }).click(); await page.getByRole("alert").filter({ hasText: "another window" }).waitFor();
  mode = "ok"; await page.getByRole("button", { name: "Refresh", exact: true }).click(); await ready();
  await page.getByRole("button", { name: "Cancel request" }).click(); await page.getByText("Cancelled", { exact: true }).waitFor();
  page.on("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Revoke permission" }).first().click(); await page.getByRole("status").filter({ hasText: "Permission revoked" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Retry simulation" }).count(), 0);
  await page.getByRole("button", { name: "Delete request" }).first().click(); await page.getByRole("status").filter({ hasText: "Request deleted" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Queue simulation", exact: true }).count(), 0);
  // Failure after consent preserves permission and recovers without re-creating an actor.
  await page.getByLabel("Personal presenter", { exact: true }).selectOption("custom-1");
  await page.getByRole("checkbox").nth(0).check(); await page.getByRole("checkbox").nth(1).check();
  mode = "queue-fail"; await page.getByRole("button", { name: "Save & queue simulation" }).click(); await page.getByRole("alert").waitFor();
  assert.equal(actors.length, 1); assert.equal(await page.getByRole("button", { name: "Queue simulation", exact: true }).count(), 1);
  mode = "ok"; await page.getByRole("button", { name: "Queue simulation", exact: true }).click(); await page.getByText("Simulation queued", { exact: true }).waitFor();
  await page.getByLabel("Personal presenter", { exact: true }).selectOption("");
  await page.getByLabel("Upload a voice recording", { exact: true }).setInputFiles({ name: "voice.wav", mimeType: "audio/wav", buffer: Buffer.from("fixture-wave") });
  await page.getByRole("button", { name: "New recording WAV", exact: true }).waitFor({ state: "attached" });
  await page.getByLabel("Upload a portrait photo", { exact: true }).setInputFiles({ name: "portrait.jpg", mimeType: "image/jpeg", buffer: Buffer.from("fixture-jpeg") });
  await page.getByRole("button", { name: "New portrait", exact: true }).waitFor({ state: "attached" });
  await open("?no-token"); await ready(); await fill(); const before = mutationCount;
  await page.getByRole("button", { name: "Save & queue simulation" }).click(); await page.getByRole("alert").filter({ hasText: "security token" }).waitFor(); assert.equal(mutationCount, before);
  await open(); await ready();
  for (const width of [1120, 390, 320]) {
    await page.setViewportSize({ width, height: 920 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `no overflow at ${width}`);
    await page.screenshot({ path: path.join(output, `twin-${width}.png`), fullPage: true });
  }
  await page.getByRole("button", { name: "Delete personal presenter My studio twin" }).click();
  await page.getByRole("status").filter({ hasText: "Personal presenter deleted" }).waitFor(); assert.equal(actors.length, 0);
  assert.deepEqual(errors, []); assert.deepEqual(external, []); assert.deepEqual(unexpected, []);
  console.log(`PASS TwinWorkbench: guest/auth/CSRF, unavailable schema, owned media selection/upload, consent, explicit mock completion/binding, concurrency, reload persistence, conflict recovery, cancel/retry/revoke/delete, partial failure recovery, mobile 320/390 and desktop. No external/provider/billing requests. Screenshots: ${output}`);
} catch (error) {
  console.error({ calls, jobs, errors, text: await page.locator("body").innerText() });
  throw error;
} finally { await browser.close(); }
