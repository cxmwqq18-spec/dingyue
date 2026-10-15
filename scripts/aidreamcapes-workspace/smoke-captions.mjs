import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aivideosugc-captions-"));
const previousRenderRoot = process.env.AIVIDEOSUGC_RENDER_ROOT;
const previousFetch = globalThis.fetch;
const previousStabilityMode = process.env.AIVIDEOSUGC_STABILITY_MODE;
const previousFfmpegBin = process.env.AIVIDEOSUGC_FFMPEG_BIN;
process.env.AIVIDEOSUGC_RENDER_ROOT = path.join(temp, "renders");
let externalRequestCount = 0;
let asrProviderCalls = 0;
let billingQuoteCalls = 0;
globalThis.fetch = async (input) => {
  const value = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const url = new URL(value, "http://localhost");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return new Response(null, { status: 204 });
  externalRequestCount++;
  throw new Error(`External request blocked by caption smoke: ${url.origin}`);
};

const root = process.cwd();
const workspaceRoot = path.join(root, "src/lib/aidreamcapes-workspace");
const nativeRequire = createRequire(path.join(root, "package.json"));
const moduleCache = new Map();
const store = new Map();
let storeWriteCount = 0;
const clone = (value) => structuredClone(value);
const error = (code, status = 400, details) => Object.assign(new Error(code), { code, status, details });
const persistentStore = {
  async getTask(siteId, customerId, taskId) {
    if (siteId !== "site_aidreamcapes") throw error("workspace_site_not_found", 404);
    const current = store.get(taskId);
    if (!current || current.customerId !== customerId || current.siteId !== siteId) throw error("task_not_found", 404);
    return clone(current);
  },
  async saveTask(task, expectedRevision) {
    const current = store.get(task.taskId);
    if (!current || current.customerId !== task.customerId || current.revision !== expectedRevision) throw error("revision_conflict", 409);
    const saved = { ...clone(task), revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    store.set(task.taskId, saved);
    storeWriteCount++;
    return clone(saved);
  },
};
const apiStub = {
  async catalogForCustomer() { return { actors: [] }; },
  workspaceResponse(value, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); },
  workspaceFailure(caught) { return Response.json({ error: caught?.code || "workspace_request_failed" }, { status: caught?.status || 500 }); },
  async jsonBody(request) { return JSON.parse(await request.text()); },
  expectedRevision(request, body) {
    const header = request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', "");
    const revision = Number(header || body?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) throw error("revision_required", 428);
    return revision;
  },
};
const authStub = {
  async workspaceAuth(request, siteId) {
    if (siteId !== "site_aidreamcapes") return { ok: false, response: Response.json({ error: "workspace_site_not_found" }, { status: 404 }) };
    const customerId = request.headers.get("x-fixture-customer");
    if (!customerId) return { ok: false, response: Response.json({ error: "customer_auth_required" }, { status: 401 }) };
    return { ok: true, current: { customer: { id: customerId } } };
  },
};
const mediaAsset = { id: "asset_caption_fixture", siteId: "site_aidreamcapes", customerId: "customer_caption_owner", mimeType: "video/mp4", role: "output", storageKey: "sites/site_aidreamcapes/customers/customer_caption_owner/assets/caption-fixture.mp4" };
const assetStore = {
  async getCustomerAssetRelational(args) {
    assert.equal(args.siteId, mediaAsset.siteId);
    assert.equal(args.customerId, mediaAsset.customerId);
    assert.equal(args.assetId, mediaAsset.id);
    return { asset: mediaAsset };
  },
  async readCustomerAssetFileByStorageKey() { return { asset: mediaAsset, bytes: fs.readFileSync(path.join(temp, "fixture.mp4")), mimeType: mediaAsset.mimeType }; },
};

const transpileOptions = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
function loadWorkspace(name) {
  if (moduleCache.has(name)) return moduleCache.get(name).exports;
  const filename = path.join(workspaceRoot, `${name}.ts`);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  moduleCache.set(name, fixtureModule);
  const scopedRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "./provider") return { workspaceAsrProvider: async () => { asrProviderCalls++; throw new Error("Unexpected ASR provider call"); } };
    if (id === "./quote") return { verifyQuote: async () => { billingQuoteCalls++; throw new Error("Unexpected credit quote call"); } };
    if (id === "./store") return persistentStore;
    if (id === "./music-catalog") return { assertTaskMusicSelectionRights: async () => undefined };
    if (id === "./api") return apiStub;
    if (id.startsWith("./")) return loadWorkspace(id.slice(2).replace(/\.ts$/, ""));
    if (id === "@/lib/stores/asset-store") return assetStore;
    if (id === "@/lib/prisma") return { prisma: {} };
    if (id === "@/lib/worker") return {};
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

function loadCaptionsRoute() {
  const filename = path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/captions/route.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  const scopedRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "@/lib/aidreamcapes-workspace/auth") return authStub;
    if (id === "@/lib/aidreamcapes-workspace/api") return apiStub;
    if (id === "@/lib/aidreamcapes-workspace/store") return persistentStore;
    if (id === "@/lib/aidreamcapes-workspace/captions") return loadWorkspace("captions");
    if (id === "@/lib/aidreamcapes-workspace/types") return loadWorkspace("types");
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

function request(url, method, customerId, body, revision) {
  const headers = new Headers({ "x-fixture-customer": customerId });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (revision !== undefined) headers.set("if-match", `"${revision}"`);
  const value = new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  Object.defineProperty(value, "nextUrl", { value: new URL(url) });
  return value;
}

try {
  const fixture = path.join(temp, "fixture.mp4");
  const ffmpegStaticPath = nativeRequire("ffmpeg-static");
  if (typeof ffmpegStaticPath !== "string" || !ffmpegStaticPath) throw new Error("The caption smoke requires the bundled ffmpeg-static binary.");
  const availableFilters = execFileSync(ffmpegStaticPath, ["-hide_banner", "-filters"], { encoding: "utf8", timeout: 15_000 });
  assert.match(availableFilters, /\bsubtitles\s+V->V\b/, "The bundled FFmpeg must render subtitles with libass.");
  process.env.AIVIDEOSUGC_FFMPEG_BIN = ffmpegStaticPath;
  execFileSync(ffmpegStaticPath, ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=30", "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000", "-t", "6", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-y", fixture], { timeout: 30_000 });
  const mediaRender = loadWorkspace("media-render");
  const runner = loadWorkspace("runner");
  const route = loadCaptionsRoute();
  const outputUrl = (kind) => `/api/sites/site_aidreamcapes/aivideosugc/tasks/task_caption/output?kind=${kind}`;
  const clipUrl = `/api/sites/site_aidreamcapes/customers/${mediaAsset.customerId}/assets/${mediaAsset.id}/download?preview=1`;
  const input = { images: { productImages: ["/fixture/product.png"] }, fields: { steps: "Show the supplied product" }, options: { duration: 6, aspect: "9:16", style: "professional", language: "en", subtitle: true, subtitleStyle: "classic" } };
  const snapshot = { visual: "Show the product", voiceover: "Generated spoken words.", refKinds: ["product"], refImgs: { product: input.images.productImages[0] }, environment: "A simple product setting", start: 0, end: 6, duration: 6,
    camera: "static", framing: "medium", lighting: "professional", expression: "" };
  const version = { ...clone(snapshot), vid: "version_1", ts: "2026-10-14T00:00:00.000Z", prompt: "Fixture prompt", clipUrl, origin: "auto", status: "done", speechTimingVerified: false, inputSnapshot: clone(input) };
  const shot = { ...clone(snapshot), shotId: "shot_1", locked: false, genStatus: "done", curVer: version.vid, versions: [version], prompt: "Fixture prompt" };
  const task = { taskId: "task_caption", siteId: "site_aidreamcapes", customerId: mediaAsset.customerId, sceneId: "process_demo", title: "Caption fixture", status: "completed",
    createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z", revision: 10, input, storyboard: { scenePlan: { strategy: "single", scenes: ["A simple product setting"], mainScene: "A simple product setting", reason: "Fixture" }, lang: "en", source: "auto", shots: [shot], colorGrade: "professional", musicGenre: "none", version: "1" },
    storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [] };
  task.video = { renderId: "render_before_edit", storyboardHash: mediaRender.storyboardRenderHash(task), clips: [{ shotId: shot.shotId, vid: version.vid, clipUrl }], status: "done",
    steps: [{ id: "confirm", status: "done" }, { id: "concat", status: "done" }, { id: "subtitles", status: "done" }, { id: "audio", status: "done" }],
    finalUrl: outputUrl("video"), subtitleUrl: outputUrl("subtitles"), captionLines: [{ start: 0, end: 2, text: "Generated first caption." }, { start: 3, end: 5, text: "Generated second caption." }],
    stale: false, createdAt: "2026-10-14T00:00:00.000Z", completedAt: "2026-10-14T00:00:01.000Z" };
  store.set(task.taskId, clone(task));
  const missing = clone(task);
  missing.taskId = "task_missing_asr";
  missing.video.renderId = "render_missing_asr";
  delete missing.video.captionLines;
  store.set(missing.taskId, missing);

  const oldRenderDirectory = path.join(process.env.AIVIDEOSUGC_RENDER_ROOT, task.siteId, task.customerId, task.taskId, task.video.renderId);
  fs.mkdirSync(oldRenderDirectory, { recursive: true });
  fs.copyFileSync(fixture, path.join(oldRenderDirectory, "final.mp4"));
  const oldSrt = "1\n00:00:00,000 --> 00:00:02,000\nGenerated first caption.\n";
  fs.writeFileSync(path.join(oldRenderDirectory, "subtitles.srt"), oldSrt);

  const base = "http://localhost/api/sites/site_aidreamcapes/aivideosugc/tasks";
  const initialGet = await route.GET(request(`${base}/${task.taskId}/captions`, "GET", task.customerId), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  assert.equal(initialGet.status, 200);
  const initialBody = await initialGet.json();
  assert.equal(initialBody.revision, 10);
  assert.equal(initialBody.edited, false);
  assert.equal(initialBody.lines[0].text, "Generated first caption.");

  const staleGet = await route.GET(request(`${base}/${task.taskId}/captions?revision=9`, "GET", task.customerId), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  assert.equal(staleGet.status, 409);
  assert.equal((await staleGet.json()).error, "revision_conflict");
  const foreignGet = await route.GET(request(`${base}/${task.taskId}/captions`, "GET", "customer_other"), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  assert.equal(foreignGet.status, 404);
  assert.equal((await foreignGet.json()).error, "task_not_found");
  const missingGet = await route.GET(request(`${base}/${missing.taskId}/captions`, "GET", task.customerId), { params: Promise.resolve({ siteId: task.siteId, taskId: missing.taskId }) });
  assert.equal(missingGet.status, 409);
  assert.equal((await missingGet.json()).error, "workspace_caption_data_missing");

  const editedLines = [{ start: 0.5, end: 2.25, text: " Corrected first caption. " }, { start: 3.1, end: 5.75, text: "Corrected second caption." }];
  const patch = (customerId, revision, lines) => route.PATCH(request(`${base}/${task.taskId}/captions`, "PATCH", customerId, { revision, lines }), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  const edited = await patch(task.customerId, 10, editedLines);
  assert.equal(edited.status, 200);
  const editedBody = await edited.json();
  assert.equal(editedBody.revision, 11);
  assert.equal(editedBody.lines[0].text, "Corrected first caption.");
  assert.equal(store.get(task.taskId).video.captionLines[0].text, "Generated first caption.", "The existing completed render remains unchanged while edits are pending");
  assert.equal(store.get(task.taskId).captionEdits.renderId, task.video.renderId);
  assert.equal(storeWriteCount, 1);

  const foreignPatch = await patch("customer_other", 11, editedLines);
  assert.equal(foreignPatch.status, 404);
  assert.equal(storeWriteCount, 1, "A different customer cannot persist edits");
  const stalePatch = await patch(task.customerId, 10, editedLines);
  assert.equal(stalePatch.status, 409);
  assert.equal((await stalePatch.json()).error, "revision_conflict");
  const outOfRangePatch = await patch(task.customerId, 11, [{ start: 5, end: 6.1, text: "Beyond the video" }]);
  assert.equal(outOfRangePatch.status, 422);
  assert.equal((await outOfRangePatch.json()).error, "workspace_caption_timing_invalid");
  const negativeStartPatch = await patch(task.customerId, 11, [{ start: -0.001, end: 1, text: "Before the video" }]);
  assert.equal(negativeStartPatch.status, 422);
  assert.equal((await negativeStartPatch.json()).error, "workspace_caption_timing_invalid");
  const outOfOrderPatch = await patch(task.customerId, 11, [{ start: 3, end: 4, text: "Later line" }, { start: 1, end: 2, text: "Earlier line" }]);
  assert.equal(outOfOrderPatch.status, 422);
  assert.equal((await outOfOrderPatch.json()).error, "workspace_caption_timing_invalid");
  assert.equal(storeWriteCount, 1, "Invalid and stale edits do not write");

  const currentGet = await route.GET(request(`${base}/${task.taskId}/captions`, "GET", task.customerId, undefined, 11), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  assert.equal(currentGet.status, 200);
  assert.deepEqual((await currentGet.json()).lines, editedBody.lines);

  const queued = await runner.queueAction(clone(store.get(task.taskId)), { action: "render" }, 11);
  const completed = await runner.executeAction(queued, {});
  assert.equal(completed.status, "completed", JSON.stringify({ error: completed.error, operation: completed.operation, video: completed.video }));
  assert.equal(completed.video.status, "done");
  assert.notEqual(completed.video.renderId, task.video.renderId, "Caption edits produce a new render version");
  assert.equal(completed.video.captionLines[0].text, "Corrected first caption.");
  assert.equal(completed.videoHistory.at(-1).renderId, task.video.renderId);
  assert.equal(completed.videoHistory.at(-1).captionLines[0].text, "Generated first caption.");
  assert.equal(completed.captionEdits, undefined, "Successfully rendered corrections become part of the new render");
  assert(fs.existsSync(path.join(oldRenderDirectory, "final.mp4")), "The prior MP4 remains on disk");
  assert.equal(fs.readFileSync(path.join(oldRenderDirectory, "subtitles.srt"), "utf8"), oldSrt, "The prior SRT remains unchanged");

  const finalTask = store.get(task.taskId);
  const newSrt = fs.readFileSync(mediaRender.resolveTaskRenderFile(finalTask, "subtitles").path, "utf8");
  assert(newSrt.includes("00:00:00,500 --> 00:00:02,250"));
  assert(newSrt.includes("Corrected first caption."));
  assert(newSrt.includes("00:00:03,100 --> 00:00:05,750"));
  assert(newSrt.includes("Corrected second caption."));
  assert(fs.existsSync(mediaRender.resolveTaskRenderFile(finalTask, "video").path));
  assert.equal(asrProviderCalls, 0, "Confirmed caption edits bypass ASR providers during rerender");
  assert.equal(billingQuoteCalls, 0, "Rerender does not request a provider quote or credit charge");
  assert.equal(externalRequestCount, 0, "No external HTTP request was attempted");

  console.log("PASS: owner-scoped caption edits persist with revision guards; stale/out-of-range/out-of-order writes reject; rerender SRT uses corrected text and timecodes; prior render files and metadata remain versioned.");
  console.log("FFMPEG: local render pipeline used the bundled libass-enabled FFmpeg; captions were burned into the new video render.");
  console.log(`COUNTS: ${JSON.stringify({ externalRequestCount, asrProviderCalls, billingQuoteCalls, storeWriteCount, newRenderId: finalTask.video.renderId, priorRenderId: task.video.renderId })}`);
} finally {
  globalThis.fetch = previousFetch;
  if (previousRenderRoot === undefined) delete process.env.AIVIDEOSUGC_RENDER_ROOT;
  else process.env.AIVIDEOSUGC_RENDER_ROOT = previousRenderRoot;
  if (previousStabilityMode === undefined) delete process.env.AIVIDEOSUGC_STABILITY_MODE;
  else process.env.AIVIDEOSUGC_STABILITY_MODE = previousStabilityMode;
  if (previousFfmpegBin === undefined) delete process.env.AIVIDEOSUGC_FFMPEG_BIN;
  else process.env.AIVIDEOSUGC_FFMPEG_BIN = previousFfmpegBin;
  fs.rmSync(temp, { recursive: true, force: true });
}
