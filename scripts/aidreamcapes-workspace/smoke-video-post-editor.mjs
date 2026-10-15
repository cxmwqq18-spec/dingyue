import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright";
import ts from "typescript";
import webpackPackage from "next/dist/compiled/webpack/webpack.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(import.meta.url);
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aidreamcapes-post-editor-"));
const component = path.join(root, "src/components/aidreamcapes-workspace/video-post-editor.tsx");
const stylesheet = fs.readFileSync(path.join(root, "src/components/aidreamcapes-workspace/video-post-editor.module.css"), "utf8");
const names = [...new Set([...stylesheet.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((match) => match[1]))];
const classes = Object.fromEntries(names.map((name) => [name, `vpe-${name}`]));
const css = stylesheet.replace(/\.([a-zA-Z][\w-]*)/g, (_match, name) => `.${classes[name] || name}`);
const taskId = "post-editor-fixture";
const siteId = "site_aidreamcapes";
const outputUrl = `/api/sites/${siteId}/aivideosugc/tasks/${taskId}/output?kind=video`;
const now = new Date().toISOString();
const clips = ["shot-a", "shot-b"].map((shotId, index) => ({ shotId, vid: `version-${index}`, clipUrl: `/api/sites/${siteId}/aivideosugc/tasks/${taskId}/output?kind=clip&shotId=${shotId}&versionId=version-${index}` }));
const fixture = {
  taskId, siteId, customerId: "offline-fixture", sceneId: "process_demo", title: "Post edit fixture", status: "completed", createdAt: now, updatedAt: now, revision: 1,
  input: { images: {}, fields: {}, options: { duration: 10, aspect: "9:16", style: "natural", language: "en", subtitle: true, subtitleStyle: "classic" } },
  storyboard: { shots: clips.map((clip) => ({ shotId: clip.shotId, duration: 5, versions: [{ vid: clip.vid, status: "done", clipUrl: clip.clipUrl, duration: 5 }], curVer: clip.vid })) },
  storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [],
  video: { renderId: "render-original", status: "done", stale: false, clips, captionLines: [{ start: 0, end: 1.5, text: "First caption" }, { start: 5, end: 6.5, text: "Second caption" }], finalUrl: outputUrl, subtitleUrl: outputUrl.replace("kind=video", "kind=subtitles"), steps: [], storyboardHash: "fixture", createdAt: now },
};
let task = structuredClone(fixture);
let editSettings = { clips: clips.map((clip) => ({ shotId: clip.shotId, inPoint: 0, outPoint: 5, speed: 1 })), order: clips.map((clip) => clip.shotId), subtitleStyle: "classic", overlay: { text: "", cta: "" }, audio: { nativeGain: 1, musicGain: 0, mixMusic: false } };
let forcedConflict = false;
let forcedRenderFailure = false;
let slowNextEdit = false;
const secondTask = structuredClone(fixture);
secondTask.taskId = "post-editor-second";
secondTask.video.renderId = "second-render";
secondTask.video.captionLines = [{ start: 0, end: 1.5, text: "Second task caption" }];
const calls = [];
const forbidden = [];
const errors = [];
let browser;

function assertServerEditContracts() {
  class WorkspaceError extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } }
  const types = { AIVIDEOSUGC_SITE_ID: siteId, WorkspaceError };
  function load(name) {
    const file = path.join(root, `src/lib/aidreamcapes-workspace/${name}.ts`);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const fixtureModule = { exports: {} };
    const scopedRequire = (id) => {
      if (id === "server-only") return {};
      if (id === "./types") return types;
      if (id === "./media-render") return { readClip() { throw new Error("Unexpected media read."); }, readTaskMusic() { throw new Error("Unexpected music read."); } };
      if (id === "./music-catalog") return { assertTaskMusicSelectionRights() { throw new Error("Unexpected rights read."); } };
      if (id === "./stability") return { isWorkspaceStabilityMockMode: () => true };
      if (id === "./mock-runtime") return { readMockShotClip() { throw new Error("Unexpected clip read."); } };
      return require(id);
    };
    new Function("require", "module", "exports", source)(scopedRequire, fixtureModule, fixtureModule.exports);
    return fixtureModule.exports;
  }
  const { compileVideoEdit } = load("editor");
  const { readCaptionLines, updateCaptionLines } = load("captions");
  const compiled = compileVideoEdit(fixture, { subtitleStyle: "bold", clips: [{ shotId: "shot-a", inPoint: 0.5, outPoint: 5, speed: 1.5 }] });
  assert.equal(compiled.settings.subtitleStyle, "bold");
  assert.equal(compiled.duration, 8);
  assert.throws(() => compileVideoEdit(fixture, { subtitleStyle: "unknown" }), /workspace_edit_subtitle_style_invalid/);
  const edited = structuredClone(fixture);
  edited.videoHistory.push(structuredClone(edited.video));
  edited.video = { ...edited.video, renderId: "edit-fixture", sourceRenderId: "render-original", editDuration: compiled.duration, editSettings: compiled.settings };
  assert.equal(compileVideoEdit(edited, {}).settings.subtitleStyle, "bold", "Caption style survives edit readback.");
  assert.equal(readCaptionLines(edited).lines.length, 2);
  assert.throws(() => updateCaptionLines(edited, [{ start: 0, end: 1, text: "Valid" }, { start: 7.5, end: 8.1, text: "Beyond edited duration" }], edited.revision), /workspace_caption_timing_invalid/);
}

function writeHarness() {
  const loader = path.join(temp, "typescript-loader.cjs");
  fs.writeFileSync(loader, `const ts = require(${JSON.stringify(require.resolve("typescript"))}); module.exports = function(source) { return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText; };`);
  const cssLoader = path.join(temp, "css-loader.cjs");
  fs.writeFileSync(cssLoader, `module.exports = function() { return 'module.exports = ' + ${JSON.stringify(JSON.stringify(classes))}; };`);
  const entry = path.join(temp, "entry.tsx");
  fs.writeFileSync(entry, `import React, { useState } from "react"; import { createRoot } from "react-dom/client"; import { VideoPostEditor } from ${JSON.stringify(component)};
    function App() { const [task, setTask] = useState(window.__fixtureTask); window.__setTask = setTask; return <VideoPostEditor siteId="site_aidreamcapes" task={task} csrfToken="offline-csrf" onTaskUpdated={setTask} />; }
    createRoot(document.getElementById("app")).render(<App />);`);
  return { loader, cssLoader, entry };
}

async function bundle() {
  const { loader, cssLoader, entry } = writeHarness();
  webpackPackage.init();
  await new Promise((resolve, reject) => webpackPackage.webpack({ mode: "development", target: "web", devtool: false, context: root, entry, output: { path: temp, filename: "editor.bundle.js" }, resolve: { extensions: [".tsx", ".ts", ".js"], modules: [path.join(root, "node_modules")], alias: { "@": path.join(root, "src") } }, module: { rules: [{ test: /\.tsx?$/, use: [loader] }, { test: /\.module\.css$/, use: [cssLoader] }] } }, (error, stats) => {
    if (error || stats?.hasErrors()) reject(error || new Error(stats?.toString({ all: false, errors: true })));
    else resolve();
  }));
}

function json(route, body, status = 200) { return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }); }

async function mockRoute(route) {
  const request = route.request();
  const url = new URL(request.url());
  if (url.origin !== "http://localhost") { forbidden.push(request.url()); return route.abort(); }
  if (url.pathname === "/") return route.fulfill({ status: 200, contentType: "text/html", body: `<html><head><style>*{box-sizing:border-box}body{margin:0;padding:18px;background:#f3f4f6;font-family:Arial,sans-serif}${css}</style></head><body><div id="app"></div></body></html>` });
  if (url.pathname.endsWith("/output")) return route.fulfill({ status: 200, contentType: "video/mp4", body: "" });
  const secondBase = `/api/sites/${siteId}/aivideosugc/tasks/${secondTask.taskId}`;
  if (url.pathname.startsWith(secondBase)) {
    const suffix = url.pathname.slice(secondBase.length);
    if (request.method() === "GET" && suffix === "/edit") return json(route, { revision: secondTask.revision, renderId: secondTask.video.renderId, sourceRenderId: secondTask.video.renderId, settings: { ...editSettings, overlay: { text: "Second task", cta: "" } }, duration: 10, aspect: "9:16" });
    if (request.method() === "GET" && suffix === "/captions") return json(route, { revision: secondTask.revision, renderId: secondTask.video.renderId, lines: secondTask.video.captionLines, edited: false });
    if (request.method() === "GET" && suffix === "") return json(route, { task: secondTask });
    forbidden.push(`${request.method()} ${suffix}`); return route.abort();
  }
  const base = `/api/sites/${siteId}/aivideosugc/tasks/${taskId}`;
  if (!url.pathname.startsWith(base)) { forbidden.push(url.pathname); return route.abort(); }
  const suffix = url.pathname.slice(base.length);
  const method = request.method();
  calls.push(`${method} ${suffix}`);
  if (method === "GET" && suffix === "") return json(route, { task: structuredClone(task) });
  if (method === "GET" && suffix === "/edit") {
    if (slowNextEdit) { slowNextEdit = false; await new Promise((resolve) => setTimeout(resolve, 250)); }
    return json(route, { taskId, revision: task.revision, renderId: task.video.renderId, sourceRenderId: "render-original", settings: editSettings, duration: task.video.editDuration ?? 10, aspect: "9:16" });
  }
  if (method === "GET" && suffix === "/captions") return json(route, { taskId, revision: task.revision, renderId: task.video.renderId, lines: task.captionEdits?.lines ?? task.video.captionLines, edited: Boolean(task.captionEdits) });
  if (method === "PATCH" && ["/captions", "/edit"].includes(suffix)) {
    const body = request.postDataJSON();
    assert.equal(request.headers()["x-csrf-token"], "offline-csrf");
    assert.equal(Number(request.headers()["if-match"]), body.revision);
    if (forcedConflict || body.revision !== task.revision) { forcedConflict = false; task.revision++; return json(route, { error: "revision_conflict" }, 409); }
    if (suffix === "/captions") {
      assert(Array.isArray(body.lines));
      task.captionEdits = { renderId: task.video.renderId, lines: body.lines, updatedAt: now };
      task.revision++;
      return json(route, { taskId, revision: task.revision, renderId: task.video.renderId, lines: body.lines, edited: true });
    }
    if (forcedRenderFailure) { forcedRenderFailure = false; return json(route, { error: "workspace_video_processing_failed" }, 502); }
    assert.equal(body.edits.subtitleStyle, "bold");
    assert.equal(body.edits.order[0], "shot-b");
    assert.equal(body.edits.overlay.cta, "Shop now");
    assert.equal(body.edits.audio.nativeGain, 1.25);
    assert.equal(body.edits.clips.find((clip) => clip.shotId === "shot-b")?.speed, 1.5);
    task.videoHistory.push(structuredClone(task.video));
    task.video = { ...task.video, renderId: "render-edited", editDuration: 7.333, editSettings: body.edits, sourceRenderId: "render-original", captionLines: task.captionEdits?.lines ?? task.video.captionLines };
    task.captionEdits = undefined;
    editSettings = body.edits;
    task.revision++;
    return json(route, { taskId, revision: task.revision, renderId: task.video.renderId, settings: editSettings, priorRenderIds: ["render-original"] });
  }
  forbidden.push(`${method} ${suffix}`); return route.abort();
}

try {
  assertServerEditContracts();
  await bundle();
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1120, height: 900 } });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/*", mockRoute);
  await page.addInitScript((value) => { window.__fixtureTask = value; }, fixture);
  await page.goto("http://localhost", { waitUntil: "domcontentloaded" });
  await page.addScriptTag({ path: path.join(temp, "editor.bundle.js") });
  await page.getByRole("heading", { name: "Fine-tune your video" }).waitFor();
  await page.getByLabel("Caption 1 text").waitFor();
  await page.getByLabel("Caption 2 start").fill("1");
  assert.equal(await page.getByRole("button", { name: "Save captions" }).isDisabled(), true, "Overlapping cue rejected before request.");
  await page.getByLabel("Caption 2 start").fill("5");
  await page.getByLabel("Caption 1 text").fill("Corrected opening");
  await page.getByRole("button", { name: "Save captions" }).click();
  await page.getByText("Caption corrections saved.", { exact: false }).waitFor();
  assert.equal(task.captionEdits.lines[0].text, "Corrected opening");
  await page.getByLabel("Caption style").selectOption("bold");
  await page.getByRole("button", { name: "Move clip 2 earlier" }).click();
  await page.getByLabel("Clip 1 in").fill("0.5");
  await page.getByLabel("Clip 1 speed").fill("1.5");
  await page.getByLabel("Call to action").fill("Shop now");
  await page.getByLabel("Original audio gain").fill("1.25");
  await page.getByRole("button", { name: "Render new version" }).click();
  await page.getByText("New version rendered.", { exact: false }).waitFor();
  assert.equal(task.videoHistory.length, 1);
  assert.equal(task.video.editSettings.subtitleStyle, "bold");
  assert.equal(await page.getByText("1 earlier version").count(), 1);
  forcedConflict = true;
  await page.getByLabel("Caption 1 text").fill("Conflict attempt");
  await page.getByRole("button", { name: "Save captions" }).click();
  await page.getByRole("button", { name: "Reload latest" }).waitFor();
  assert.equal(await page.getByRole("button", { name: "Render new version" }).isDisabled(), true);
  await page.getByRole("button", { name: "Reload latest" }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Caption 1 text"]')?.value === "Corrected opening");
  assert.equal(await page.getByLabel("Caption 1 text").inputValue(), "Corrected opening");
  forcedRenderFailure = true;
  await page.getByLabel("On-screen text").fill("A new headline");
  await page.getByRole("button", { name: "Render new version" }).click();
  await page.getByText("The local video renderer is unavailable.", { exact: false }).waitFor();
  assert.equal(task.videoHistory.length, 1, "Render failure leaves current version intact.");
  await page.evaluate((value) => window.__setTask(value), secondTask);
  await page.waitForFunction(() => document.querySelector('[aria-label="Caption 1 text"]')?.value === "Second task caption");
  const editCallsBeforeSwitch = calls.filter((call) => call === "GET /edit").length;
  slowNextEdit = true;
  await page.evaluate((value) => window.__setTask(value), structuredClone(task));
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("First task edit GET did not start.")), 2000);
    const check = () => calls.filter((call) => call === "GET /edit").length > editCallsBeforeSwitch ? (clearTimeout(timeout), resolve()) : setTimeout(check, 10);
    check();
  });
  await page.evaluate((value) => window.__setTask(value), secondTask);
  await page.waitForFunction(() => document.querySelector('[aria-label="Caption 1 text"]')?.value === "Second task caption");
  await page.waitForTimeout(300);
  assert.equal(await page.getByLabel("On-screen text").inputValue(), "Second task", "Stale task request did not replace the second task draft.");
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "390px layout has no horizontal overflow.");
  assert.equal(await page.getByRole("button", { name: "Render new version" }).isVisible(), true);
  if (process.env.AIVIDEOSUGC_POST_EDITOR_SCREENSHOT) await page.screenshot({ path: process.env.AIVIDEOSUGC_POST_EDITOR_SCREENSHOT, fullPage: true });
  assert.deepEqual(forbidden, [], "No unexpected or external request.");
  assert.deepEqual(errors, [], "No uncaught browser error.");
  assert(calls.includes("PATCH /captions") && calls.includes("PATCH /edit") && calls.includes("GET "), "Actual component exercised both APIs and full task readback.");
  console.log("PASS VideoPostEditor: server style round trip and edited caption bounds; actual React Playwright caption save, render, failure, revision reload, task switch, 390px layout, full task readback; zero external/provider/ledger requests.");
} finally {
  await browser?.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
