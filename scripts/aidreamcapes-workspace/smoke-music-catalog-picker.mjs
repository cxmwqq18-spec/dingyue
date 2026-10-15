#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const routeDir = path.join(process.cwd(), "src/app/smoke-aidreamcapes-music-picker");
const routeFile = path.join(routeDir, "page.tsx");
const nextEnvFile = path.join(process.cwd(), "next-env.d.ts");
const validatorFile = path.join(process.cwd(), ".next/types/validator.ts");
const nextEnvOriginal = await fs.readFile(nextEnvFile, "utf8").catch(() => null);
const validatorOriginal = await fs.readFile(validatorFile, "utf8").catch(() => null);
const port = Number(process.env.SMOKE_PORT ?? 3037);
const base = `http://127.0.0.1:${port}`;
await fs.mkdir(routeDir, { recursive: true });
await fs.writeFile(routeFile, `"use client";
import { MusicCatalogPicker } from "@/components/aidreamcapes-workspace/music-catalog-picker";
import type { WorkspaceTask } from "@/lib/aidreamcapes-workspace/types";
const task = { taskId: "task-smoke", siteId: "site_aidreamcapes", customerId: "customer-smoke", sceneId: "texture_closeup", title: "Smoke task", status: "draft", createdAt: "2026-01-01", updatedAt: "2026-01-01", revision: 7, input: { images: {}, fields: {}, options: { duration: 15, aspect: "9:16", style: "natural", language: "en", subtitle: false } }, storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [] } as WorkspaceTask;
export default function Page() { return <main style={{maxWidth: 900, margin: "30px auto", padding: 12}}><div data-testid="picker-normal"><MusicCatalogPicker siteId="site_aidreamcapes" task={task} csrfToken="csrf-smoke" onTaskUpdated={() => {}} /></div><div data-testid="picker-custom"><MusicCatalogPicker siteId="site_aidreamcapes" task={{...task, taskId: "task-custom", input: {...task.input, musicUrl: "/uploaded-audio"}}} onTaskUpdated={() => {}} /></div></main>; }
`);

const browser = await chromium.launch({ headless: true });
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: process.cwd(), stdio: "ignore", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } });
try {
  let ready = false;
  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (server.exitCode !== null) throw new Error(`Next smoke server exited with ${server.exitCode}`);
    try { const response = await fetch(base); if (response.ok) { ready = true; break; } } catch { /* server is starting */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Next smoke server did not become ready.");
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => console.error("browser page error:", error.message));
  page.on("console", (message) => { if (message.type() === "error") console.error("browser console:", message.text()); });
  const calls = [];
  const licensed = { id: "licensed-1", title: "Clear Dawn", artist: "Test Artist", genre: "ambient", moods: ["calm"], durationSeconds: 28, bpm: 90, demoOnly: false, licenseStatus: "licensed", license: { territories: ["US", "CA"], usageTypes: ["ads"], attributionRequired: true, attributionText: "Music by Test Artist" }, eligibleForRequestedUse: true, attributionText: "Music by Test Artist", previewUrl: "/api/sites/site_aidreamcapes/aivideosugc/music/catalog/licensed-1/preview" };
  const unlicensed = { ...licensed, id: "unlicensed-1", title: "Unlicensed Track", licenseStatus: "unlicensed", license: null, eligibleForRequestedUse: false, attributionText: undefined, previewUrl: null };
  const demo = { ...unlicensed, id: "demo-1", title: "Demo Fixture", demoOnly: true, notice: "Demo fixture only; no music license is represented." };
  let attachStatus = 200;
  await page.route("**/api/sites/site_aidreamcapes/aivideosugc/music/catalog**", async (route) => {
    const request = route.request(); calls.push({ url: request.url(), method: request.method(), headers: request.headers(), body: request.postData() });
    if (request.url().endsWith("/preview")) return route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.from("smoke audio") });
    if (request.method() === "POST") return route.fulfill({ status: attachStatus, contentType: "application/json", body: JSON.stringify(attachStatus === 200 ? { task: { taskId: "task-smoke", revision: 8 } } : { error: attachStatus === 409 ? "revision_conflict" : "music_source_conflict" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, tracks: [licensed, unlicensed, demo], page: { total: 3, take: 100, offset: 0 } }) });
  });
  const pageResponse = await page.goto(`${base}/smoke-aidreamcapes-music-picker`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (!pageResponse || pageResponse.status() !== 200) throw new Error(`Smoke harness route returned ${pageResponse?.status() ?? "no response"}: ${(await page.locator("body").innerText()).slice(0, 500)}`);
  await page.getByTestId("picker-normal").getByRole("heading", { name: "Choose a catalog track" }).waitFor();
  const picker = page.getByTestId("picker-normal");
  await picker.getByText("Licensed · eligible for ads").waitFor();
  await picker.getByText("Demo · not licensed").waitFor();
  await picker.getByText("Attribution required:").waitFor();
  assert.equal(await picker.getByRole("button", { name: "Add to task" }).nth(1).isDisabled(), true);
  const customPicker = page.getByTestId("picker-custom");
  await customPicker.getByText(/uploaded music selected/).waitFor();
  assert.equal(await customPicker.getByRole("button", { name: "Add to task" }).first().isDisabled(), true);
  assert.equal(calls.filter((call) => call.url.endsWith("/preview")).length, 0, "preview must not be fetched before user action");
  await picker.getByRole("searchbox", { name: "Search catalog" }).fill("unlicensed");
  await picker.getByText("Unlicensed Track").waitFor();
  assert.equal(await picker.locator("article").count(), 1, "search filter should narrow the list");
  await picker.getByRole("searchbox", { name: "Search catalog" }).fill("");
  await picker.getByLabel("Territory (ISO code)").fill("CA");
  await page.waitForTimeout(250);
  assert.ok(calls.some((call) => call.method === "GET" && call.url.includes("territory=CA")), "territory filter should be sent to catalog");
  await picker.getByLabel("Territory (ISO code)").fill("US");
  await page.waitForTimeout(250);
  await picker.getByRole("button", { name: "Preview" }).first().click();
  await page.locator("audio").waitFor();
  await picker.getByRole("button", { name: "Add to task" }).first().click();
  await picker.getByText("Clear Dawn is attached to this task.").waitFor();
  const attach = calls.find((call) => call.method === "POST");
  assert.ok(attach);
  assert.equal(attach.headers["if-match"], "7");
  assert.equal(attach.headers["x-csrf-token"], "csrf-smoke");
  assert.deepEqual(JSON.parse(attach.body), { taskId: "task-smoke", revision: 7, territory: "US", usage: "ads" });
  const catalogGet = calls.find((call) => call.method === "GET");
  assert.match(catalogGet.url, /territory=US/); assert.match(catalogGet.url, /usage=ads/);
  assert.equal(calls.some((call) => /generate|quote|reserve|billing|provider/i.test(call.url)), false, "no unsupported API requests");

  attachStatus = 409;
  await picker.getByRole("button", { name: "Add to task" }).first().click();
  await picker.getByRole("alert").getByText(/changed in another window/).waitFor();
  await page.setViewportSize({ width: 360, height: 780 });
  assert.equal(await page.locator("body").evaluate((element) => element.scrollWidth <= window.innerWidth), true, "picker should fit a mobile viewport");

  const guest = await context.newPage();
  await guest.route("**/api/sites/site_aidreamcapes/aivideosugc/music/catalog**", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: "workspace_auth_required" }) }));
  await guest.goto(`${base}/smoke-aidreamcapes-music-picker`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await guest.getByRole("alert").first().getByText(/Sign in to browse/).waitFor();
  await guest.close(); await context.close();
  console.log(JSON.stringify({ ok: true, catalogFilters: true, previewGating: true, attachRevisionAndCsrf: true, licensingAndAttribution: true, errorsAndGuest: true, mobile: true, unsupportedRequests: true }, null, 2));
} finally {
  await browser.close();
  server.kill("SIGTERM");
  await fs.rm(routeDir, { recursive: true, force: true });
  await fs.rm(path.join(process.cwd(), ".next/types/app/smoke-aidreamcapes-music-picker"), { recursive: true, force: true });
  if (nextEnvOriginal !== null) await fs.writeFile(nextEnvFile, nextEnvOriginal);
  if (validatorOriginal !== null) await fs.writeFile(validatorFile, validatorOriginal);
}
