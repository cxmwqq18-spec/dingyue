import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";

const root = process.cwd();
const workspaceRoot = path.join(root, "src/lib/aidreamcapes-workspace");
const nativeRequire = createRequire(path.join(root, "package.json"));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aivideosugc-mock-workflow-"));
const envKeys = ["AIVIDEOSUGC_STABILITY_MODE", "AIVIDEOSUGC_QUOTE_SECRET", "AIVIDEOSUGC_TEXT_PROVIDER_ID", "AIVIDEOSUGC_ASR_PROVIDER_ID", "AIVIDEOSUGC_RENDER_ROOT", "AIVIDEOSUGC_FFMPEG_BIN"];
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
process.env.AIVIDEOSUGC_STABILITY_MODE = "mock";
process.env.AIVIDEOSUGC_QUOTE_SECRET = "local-full-workflow-smoke-secret";
process.env.AIVIDEOSUGC_TEXT_PROVIDER_ID = "must-not-be-read";
process.env.AIVIDEOSUGC_ASR_PROVIDER_ID = "must-not-be-read";
process.env.AIVIDEOSUGC_RENDER_ROOT = path.join(temp, "renders");

let externalRequestCount = 0;
globalThis.fetch = async (input) => {
  const value = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const url = new URL(value, "http://localhost");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return new Response(null, { status: 204 });
  externalRequestCount++;
  throw new Error(`External request blocked by mock workflow smoke: ${url.origin}`);
};

const counters = {
  providerStoreCalls: 0,
  apiKeyReads: 0,
  prismaCalls: 0,
  assetStoreCalls: 0,
  realBillingStoreCalls: 0,
  generationSubmitCalls: 0,
  workerDispatchCalls: 0,
  customerCatalogCalls: 0,
};
const providerFixture = {
  id: "provider-canary", enabled: true, aiUrl: "https://provider.invalid/v1", modelType: "fixture-model",
  label: "must not be used", maxImagesPerRequest: 4, videoDurations: [6, 10, 15], videoAspectRatios: ["9:16"],
};
Object.defineProperty(providerFixture, "apiKey", { get() { counters.apiKeyReads++; return "must-not-be-read"; } });
const recordPrismaCall = () => { counters.prismaCalls++; throw new Error("Mock workflow reached Prisma"); };
const prisma = new Proxy({}, { get(_target, key) { return key === "$queryRaw" || key === "$executeRaw" ? recordPrismaCall : new Proxy({}, { get: () => recordPrismaCall }); } });
const providerStore = {
  async listPlatformAiProvidersRelational() { counters.providerStoreCalls++; return [providerFixture]; },
  async getPlatformAiProviderRelational() { counters.providerStoreCalls++; return providerFixture; },
};
const billingStore = {
  async submitGenerationJob() { counters.generationSubmitCalls++; counters.realBillingStoreCalls++; throw new Error("Real generation submission reached"); },
  async settleGenerationJobRelational() { counters.realBillingStoreCalls++; throw new Error("Real ledger settlement reached"); },
};
const worker = {
  async buildWorkerPayload() { counters.workerDispatchCalls++; throw new Error("Worker payload builder reached"); },
  async dispatchWorkerPayload() { counters.workerDispatchCalls++; throw new Error("Worker dispatch reached"); },
};
const assetStore = new Proxy({}, { get: () => async () => { counters.assetStoreCalls++; throw new Error("Shared customer asset store reached"); } });
const clone = (value) => structuredClone(value);
const store = new Map();
const fail = (code, status = 400, details) => Object.assign(new Error(code), { code, status, details });
const persistentStore = {
  assertWorkspaceSite(siteId) { if (siteId !== "site_aidreamcapes") throw fail("workspace_site_not_found", 404); },
  async getTask(siteId, customerId, taskId) {
    const current = store.get(taskId);
    if (!current || current.siteId !== siteId || current.customerId !== customerId) throw fail("task_not_found", 404);
    return clone(current);
  },
  async saveTask(task, expectedRevision) {
    const current = store.get(task.taskId);
    if (!current || current.siteId !== task.siteId || current.customerId !== task.customerId || current.revision !== expectedRevision) throw fail("revision_conflict", 409);
    const saved = { ...clone(task), revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    store.set(task.taskId, saved);
    return clone(saved);
  },
  async listTasks(siteId, customerId) { return [...store.values()].filter((task) => task.siteId === siteId && task.customerId === customerId).map(clone); },
  publicTask(task) {
    const { creationHash: _creationHash, ...copy } = clone(task);
    if (copy.operation) copy.operation = { action: copy.operation.action, state: copy.operation.state, error: copy.operation.error };
    return copy;
  },
};
const apiStub = {
  async catalogForCustomer() { counters.customerCatalogCalls++; return { actors: [] }; },
  workspaceResponse(value, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); },
  workspaceFailure(error) { return Response.json({ error: error?.code || "workspace_request_failed" }, { status: error?.status || 500 }); },
  async jsonBody(request) { return JSON.parse(await request.text()); },
  expectedRevision(request, body) {
    const header = request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', "");
    const revision = Number(header || body?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) throw fail("revision_required", 428);
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

const moduleCache = new Map();
const scheduledCallbacks = [];
const transpileOptions = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
function loadWorkspace(name) {
  const normalized = name.replace(/\.ts$/, "").replace(/\.json$/, "");
  if (moduleCache.has(normalized)) return moduleCache.get(normalized).exports;
  const filename = `${path.join(workspaceRoot, normalized)}${name.endsWith(".json") ? ".json" : ".ts"}`;
  if (name.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
  return loadFile(filename, `workspace:${normalized}`);
}
function loadFile(filename, cacheKey) {
  if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey).exports;
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  moduleCache.set(cacheKey, fixtureModule);
  const scopedRequire = (id) => {
    if (id === "./provider-catalog-read") return { listWorkspaceProviderRows: providerStore.listPlatformAiProvidersRelational, getWorkspaceProviderRow: providerStore.getPlatformAiProviderRelational };
    if (id === "server-only") return {};
    if (id === "next/server") return { after: (callback) => scheduledCallbacks.push(callback) };
    if (id === "./store" || id === "@/lib/aidreamcapes-workspace/store") return persistentStore;
    if ((id === "./api" && cacheKey === "workspace:runner") || id === "@/lib/aidreamcapes-workspace/api") return apiStub;
    if (id === "@/lib/aidreamcapes-workspace/auth") return authStub;
    if (id.startsWith("@/lib/aidreamcapes-workspace/")) return loadWorkspace(id.slice("@/lib/aidreamcapes-workspace/".length));
    if (id.startsWith("./")) return loadWorkspace(id.slice(2));
    if (id === "@/lib/prisma") return { prisma };
    if (id === "@/lib/stores/platform-store") return providerStore;
    if (id === "@/lib/stores/asset-store") return assetStore;
    if (id === "@/lib/customer-asset-storage") return { writeCustomerAssetFileShared: async () => { counters.assetStoreCalls++; throw new Error("Customer asset storage write reached"); } };
    if (id === "@/lib/generation-submit" || id === "@/lib/stores/job-store") return billingStore;
    if (id === "@/lib/worker") return { ...worker, resolveWorkerBaseUrls: () => ({}) };
    if (id === "@/lib/video-provider-availability") return { videoProviderAvailabilityReason: () => undefined };
    if (id === "@/lib/video-provider-family") return { videoProviderModelFamilyForProvider: () => "unknown" };
    if (id === "@/lib/video-frame-config") return { videoDurationCreditCost: () => 0, videoResolutionCreditCost: () => 0, normalizeVideoDurationSecondsForFrameCount: (duration) => duration };
    if (id === "@/lib/types") return {};
    if (id === "@/lib/session") return { publicUrlForRequest: () => new URL("http://localhost") };
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

function request(url, method, customerId, body, revision, idempotencyKey) {
  const headers = new Headers({ "x-fixture-customer": customerId });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (revision !== undefined) headers.set("if-match", `"${revision}"`);
  if (idempotencyKey) headers.set("idempotency-key", idempotencyKey);
  const value = new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  Object.defineProperty(value, "nextUrl", { value: new URL(url) });
  return value;
}
function balanceInvariant(snapshot) {
  assert.equal(snapshot.available + snapshot.reserved + snapshot.spent, snapshot.initial, "Mock credits always balance across available, reserved, and spent amounts");
}

try {
  const ffmpeg = nativeRequire("ffmpeg-static");
  if (typeof ffmpeg !== "string" || !ffmpeg) throw new Error("The mock workflow requires the bundled local ffmpeg-static binary.");
  const filters = execFileSync(ffmpeg, ["-hide_banner", "-filters"], { encoding: "utf8", timeout: 15_000 });
  assert.match(filters, /\bsubtitles\s+V->V\b/, "The bundled FFmpeg must provide the local libass subtitles filter.");
  process.env.AIVIDEOSUGC_FFMPEG_BIN = ffmpeg;

  const provider = loadWorkspace("provider");
  const catalogs = loadWorkspace("catalogs");
  const pipeline = loadWorkspace("pipeline");
  const runner = loadWorkspace("runner");
  const quote = loadWorkspace("quote");
  const runtime = loadWorkspace("mock-runtime");
  const mediaRender = loadWorkspace("media-render");
  const stability = loadWorkspace("stability");
  const assetContracts = loadWorkspace("asset-contracts");
  const productBriefSnapshot = loadWorkspace("product-brief-snapshot");
  const actors = provider.getWorkspaceActors();
  const actor = actors.find((entry) => entry.actorId === "indoor-1");
  assert(actor, "The deterministic built-in actor fixture is present");
  assert.equal(assetContracts.isBuiltinActorCatalogReference(actor.imageUrl, "image", actors), true);
  assert.equal(assetContracts.isBuiltinActorCatalogReference(actor.voice.refAudio, "audio", actors), true);

  const productBrief = productBriefSnapshot.normalizeConfirmedProductBrief({
    sourceUrl: "https://product.example.test/item", fetchedPageUrl: "https://product.example.test/item",
    title: { value: "Fixture moisturizer", sourceUrl: "https://product.example.test/item", sourceLabel: "Product page", confidence: "high", confirmed: false },
    description: { value: "A daily moisturizer for dry skin.", sourceUrl: "https://product.example.test/item", sourceLabel: "Product page", confidence: "high", confirmed: false },
    possiblePrice: null, selectionConfirmed: true, priceConfirmed: false, reviewRequired: true, customerConfirmedAt: "2026-10-14T00:00:00.000Z",
  });
  const newTask = (taskId, customerId) => {
    const input = catalogs.defaultTaskInput("presenter_showcase");
    const productAssetUrl = `/api/local-assets/sites/site_aidreamcapes/customers/${customerId}/assets/product_fixture.png`;
    const storageKey = assetContracts.customerAssetStorageKeyFromLocalUrl(productAssetUrl, { siteId: "site_aidreamcapes", customerId });
    assert.equal(storageKey, `sites/site_aidreamcapes/customers/${customerId}/assets/product_fixture.png`);
    const fixtureAsset = { id: "asset_product_fixture", siteId: "site_aidreamcapes", customerId, storageKey, mimeType: "image/png", role: "input" };
    assert.equal(assetContracts.workspaceAssetHasMedia(fixtureAsset, { siteId: "site_aidreamcapes", customerId, kind: "image" }), true);
    assert.equal(assetContracts.workspaceAssetHasMedia(fixtureAsset, { siteId: "site_aidreamcapes", customerId: "customer_other", kind: "image" }), false, "The fixture product reference is scoped to its owner");
    input.images.productImages = [productAssetUrl];
    input.fields.sellingPoints = "A daily moisturizer for dry skin.";
    input.fields.occasions = "At home";
    input.options.duration = 6;
    input.options.subtitle = true;
    input.options.subtitleStyle = "classic";
    input.actorId = actor.actorId;
    const now = "2026-10-14T00:00:00.000Z";
    const task = {
      taskId, siteId: "site_aidreamcapes", customerId, sceneId: "presenter_showcase", title: "Mock workflow fixture", status: "draft",
      createdAt: now, updatedAt: now, revision: 1, input, voiceSnapshot: pipeline.createActorVoiceSnapshot(actor), productBrief: clone(productBrief),
      storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [],
    };
    store.set(taskId, clone(task));
    return task;
  };
  const quoteForShot = (task) => quote.createQuote(task, "generate_shot", task.storyboard.shots[0].shotId);
  const outputRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/output/route.ts"), "route:output");
  const captionRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/captions/route.ts"), "route:captions");
  const libraryRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/route.ts"), "route:task");
  const actionsRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/actions/route.ts"), "route:actions");
  const base = "http://localhost/api/sites/site_aidreamcapes/aivideosugc/tasks";
  const outputGet = (task, customerId, kind, extras = "") => outputRoute.GET(request(`${base}/${task.taskId}/output?kind=${kind}${extras}`, "GET", customerId), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  const queueAction = async (task, action, body = {}, key) => {
    const response = await actionsRoute.POST(request(`${base}/${task.taskId}/actions`, "POST", task.customerId, { action, ...body }, task.revision, key), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
    assert.equal(response.status, 202, `The task action route should accept ${action}: ${JSON.stringify(await response.clone().json())}`);
    const queued = (await response.json()).task;
    const deferred = scheduledCallbacks.shift();
    assert.equal(typeof deferred, "function", "The action route schedules its durable runner callback");
    return { queued, deferred };
  };
  const progress = async (task, action, body = {}, key) => {
    const queued = await queueAction(task, action, body, key);
    await queued.deferred();
    return persistentStore.getTask(task.siteId, task.customerId, task.taskId);
  };

  let task = newTask("task_mock_lifecycle", "customer_mock_fixture");
  task = await progress(task, "storyboard");
  assert.equal(task.status, "storyboard_ready");
  assert.equal(task.storyboard.shots.length, 1);
  assert.equal(task.storyboard.shots[0].voiceover, "Take a look at this product.");
  assert(task.productBrief?.userConfirmed, "The confirmed product brief remains on the generated task snapshot");
  assert.equal(task.voiceSnapshot.actorId, actor.actorId, "The actor voice snapshot is carried through storyboarding");

  let shotQuote = await quoteForShot(task);
  assert.equal(shotQuote.available, true);
  assert.equal(shotQuote.credits, 24);
  let taskQuote = { quoteToken: shotQuote.quoteToken, shotId: task.storyboard.shots[0].shotId };
  task = await progress(task, "generate_shot", taskQuote, "generate-main-1");
  const firstShot = task.storyboard.shots[0];
  const firstVersion = firstShot.versions.find((version) => version.vid === firstShot.curVer);
  assert.equal(firstShot.genStatus, "done");
  assert.equal(firstVersion.status, "done");
  assert.equal(firstVersion.modelId, "aivideosugc-stability-mock");
  assert.equal(firstVersion.mock, true, "Synthetic shots carry an explicit mock tag");
  assert.equal(firstVersion.generationJobId, undefined, "Mock shot generation creates no provider job");
  assert.equal(task.operation.state, "done");
  let ledger = runtime.mockLedgerSnapshot(task.siteId, task.customerId);
  balanceInvariant(ledger);
  assert.deepEqual([ledger.available, ledger.reserved, ledger.spent], [976, 0, 24]);
  assert.equal(ledger.reservations[0].state, "settled");

  task = await progress(task, "render");
  assert.equal(task.status, "completed");
  assert.equal(task.video.status, "done");
  assert.equal(task.video.mock, true, "The rendered deliverables remain explicitly mock-tagged");
  assert.match(task.video.finalUrl, /\/output\?kind=video$/);
  assert.match(task.video.subtitleUrl, /\/output\?kind=subtitles$/);
  assert.match(task.video.clips[0].clipUrl, /\/output\?kind=clip&shotId=/);
  const firstRenderId = task.video.renderId;
  const firstRenderDirectory = path.join(process.env.AIVIDEOSUGC_RENDER_ROOT, task.siteId, task.customerId, task.taskId, firstRenderId);
  const previousSrt = fs.readFileSync(path.join(firstRenderDirectory, "subtitles.srt"), "utf8");
  assert(previousSrt.includes("Take a look at this product."));

  for (const kind of ["video", "subtitles", "clip"]) {
    const extras = kind === "clip" ? `&shotId=${encodeURIComponent(firstShot.shotId)}&versionId=${encodeURIComponent(firstVersion.vid)}` : "";
    const response = await outputGet(task, task.customerId, kind, extras);
    assert.equal(response.status, 200, `${kind} output should download through the authenticated route`);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length > 0, `${kind} output response has local bytes`);
    assert.equal(response.headers.get("content-length"), String(bytes.length));
    if (kind === "video" || kind === "clip") {
      assert.equal(response.headers.get("content-type"), "video/mp4");
      assert.match(response.headers.get("content-disposition"), kind === "video" ? /^inline;/ : /^attachment;/);
      assert(bytes.subarray(4, 8).toString("ascii").includes("ftyp"), `${kind} bytes are an MP4 container`);
    } else {
      assert.match(response.headers.get("content-type"), /^application\/x-subrip/);
      assert.match(response.headers.get("content-disposition"), /^attachment;/);
      assert(bytes.toString("utf8").includes("Take a look at this product."));
    }
  }
  const foreignOutput = await outputGet(task, "customer_other", "video");
  assert.equal(foreignOutput.status, 404, "Another customer cannot download this task's output");
  assert.equal((await foreignOutput.json()).error, "task_not_found");
  const traversalOutput = await outputGet(task, task.customerId, "clip", `&shotId=${encodeURIComponent("../outside")}&versionId=${encodeURIComponent(firstVersion.vid)}`);
  assert.equal(traversalOutput.status, 400);
  assert.equal((await traversalOutput.json()).error, "workspace_render_identifier_invalid");
  await assert.rejects(loadWorkspace("output").resolveWorkspaceOutput(task, "video"), (error) => error.code === "workspace_mock_output_unpublishable");

  const captionsGet = await captionRoute.GET(request(`${base}/${task.taskId}/captions`, "GET", task.customerId), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  assert.equal(captionsGet.status, 200);
  const generatedCaptions = await captionsGet.json();
  assert.equal(generatedCaptions.lines[0].text, "Take a look at this product.");
  const edits = [{ start: 0.5, end: 4.5, text: "Corrected local caption." }];
  const captionPatch = await captionRoute.PATCH(request(`${base}/${task.taskId}/captions`, "PATCH", task.customerId, { revision: task.revision, lines: edits }), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  assert.equal(captionPatch.status, 200);
  const edited = await captionPatch.json();
  assert.equal(edited.revision, task.revision + 1);
  const staleCaptionPatch = await captionRoute.PATCH(request(`${base}/${task.taskId}/captions`, "PATCH", task.customerId, { revision: task.revision, lines: edits }), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  assert.equal(staleCaptionPatch.status, 409);
  assert.equal((await staleCaptionPatch.json()).error, "revision_conflict");
  task = await persistentStore.getTask(task.siteId, task.customerId, task.taskId);
  task = await progress(task, "render");
  assert.notEqual(task.video.renderId, firstRenderId, "Confirmed caption edits create a new render version");
  assert.equal(task.videoHistory.at(-1).renderId, firstRenderId);
  const editedSrt = fs.readFileSync(mediaRender.resolveTaskRenderFile(task, "subtitles").path, "utf8");
  assert(editedSrt.includes("00:00:00,500 --> 00:00:04,500"));
  assert(editedSrt.includes("Corrected local caption."));
  assert.equal(fs.readFileSync(path.join(firstRenderDirectory, "subtitles.srt"), "utf8"), previousSrt, "The previous SRT remains intact");
  assert(fs.existsSync(path.join(firstRenderDirectory, "final.mp4")), "The previous MP4 remains intact");
  ledger = runtime.mockLedgerSnapshot(task.siteId, task.customerId);
  balanceInvariant(ledger);
  assert.deepEqual([ledger.available, ledger.reserved, ledger.spent], [976, 0, 24], "Renders and caption edits do not quote or charge credits");

  shotQuote = await quoteForShot(task);
  task = await progress(task, "generate_shot", { quoteToken: shotQuote.quoteToken, shotId: firstShot.shotId }, "generate-main-2");
  const secondVersionId = task.storyboard.shots[0].curVer;
  assert.notEqual(secondVersionId, firstVersion.vid);
  const staleOutput = await outputGet(task, task.customerId, "video");
  assert.equal(staleOutput.status, 409);
  assert.equal((await staleOutput.json()).error, "workspace_output_stale", "A previous render cannot be downloaded as current after changing the selected shot version");
  const libraryReload = await libraryRoute.GET(request(`${base}/${task.taskId}`, "GET", task.customerId), { params: Promise.resolve({ siteId: task.siteId, taskId: task.taskId }) });
  assert.equal(libraryReload.status, 200);
  let reloadedTask = (await libraryReload.json()).task;
  assert.equal(reloadedTask.taskId, task.taskId);
  assert.equal(reloadedTask.storyboard.shots[0].curVer, secondVersionId, "Library reload returns the persisted selected shot version");
  reloadedTask = await progress(reloadedTask, "restore_version", { shotId: firstShot.shotId, versionId: firstVersion.vid }, "restore-main-1");
  assert.equal(reloadedTask.storyboard.shots[0].curVer, firstVersion.vid, "Library restore selects the prior synthetic version");
  assert.equal(reloadedTask.storyboard.shots[0].versions.find((version) => version.vid === firstVersion.vid).mock, true);
  reloadedTask = await progress(reloadedTask, "render");
  assert.equal(reloadedTask.status, "completed");
  assert.equal(reloadedTask.video.clips[0].vid, firstVersion.vid);
  ledger = runtime.mockLedgerSnapshot(task.siteId, task.customerId);
  balanceInvariant(ledger);
  assert.deepEqual([ledger.available, ledger.reserved, ledger.spent], [952, 0, 48]);

  let retryTask = newTask("task_mock_retry", "customer_mock_retry");
  retryTask = await progress(retryTask, "storyboard");
  shotQuote = await quoteForShot(retryTask);
  const goodFfmpeg = process.env.AIVIDEOSUGC_FFMPEG_BIN;
  process.env.AIVIDEOSUGC_FFMPEG_BIN = path.join(temp, "missing-ffmpeg-binary");
  retryTask = await progress(retryTask, "generate_shot", { shotId: retryTask.storyboard.shots[0].shotId, quoteToken: shotQuote.quoteToken }, "generate-retry-fail");
  assert.equal(retryTask.operation.state, "fail");
  assert.equal(retryTask.operation.error, "workspace_mock_ffmpeg_unavailable");
  ledger = runtime.mockLedgerSnapshot(retryTask.siteId, retryTask.customerId);
  balanceInvariant(ledger);
  assert.deepEqual([ledger.available, ledger.reserved, ledger.spent], [1_000, 0, 0], "A failed synthetic generation refunds its local reservation");
  process.env.AIVIDEOSUGC_FFMPEG_BIN = goodFfmpeg;
  shotQuote = await quoteForShot(retryTask);
  retryTask = await progress(retryTask, "generate_shot", { quoteToken: shotQuote.quoteToken, shotId: retryTask.storyboard.shots[0].shotId }, "generate-retry-success");
  assert.equal(retryTask.storyboard.shots[0].genStatus, "done", "A new idempotency key retries the failed mock operation");
  ledger = runtime.mockLedgerSnapshot(retryTask.siteId, retryTask.customerId);
  balanceInvariant(ledger);
  assert.deepEqual([ledger.available, ledger.reserved, ledger.spent], [976, 0, 24]);
  assert.deepEqual(ledger.reservations.map((entry) => entry.state), ["refunded", "settled"]);

  let cancelTask = newTask("task_mock_cancel", "customer_mock_cancel");
  cancelTask = await progress(cancelTask, "storyboard");
  shotQuote = await quoteForShot(cancelTask);
  const pendingCancel = await queueAction(cancelTask, "generate_shot", { shotId: cancelTask.storyboard.shots[0].shotId, quoteToken: shotQuote.quoteToken }, "generate-cancel");
  assert.equal(runtime.mockLedgerSnapshot(cancelTask.siteId, cancelTask.customerId).reserved, 24);
  const persistedPendingCancel = await persistentStore.getTask(cancelTask.siteId, cancelTask.customerId, cancelTask.taskId);
  cancelTask = await runner.cancelPendingMockOperation(clone(persistedPendingCancel), persistedPendingCancel.revision);
  assert.equal(cancelTask.operation.error, "workspace_operation_cancelled");
  await pendingCancel.deferred();
  cancelTask = await persistentStore.getTask(cancelTask.siteId, cancelTask.customerId, cancelTask.taskId);
  assert.equal(cancelTask.operation.error, "workspace_operation_cancelled", "A cancelled queued callback does not dispatch");
  ledger = runtime.mockLedgerSnapshot(cancelTask.siteId, cancelTask.customerId);
  balanceInvariant(ledger);
  assert.deepEqual([ledger.available, ledger.reserved, ledger.spent], [1_000, 0, 0]);
  assert.equal(ledger.reservations[0].state, "cancelled");

  let composeGuardTask = newTask("task_mock_compose_guard", "customer_mock_guard");
  composeGuardTask = await progress(composeGuardTask, "storyboard");
  composeGuardTask.operation = { id: "compose-guard", action: "compose_shot", shotId: composeGuardTask.storyboard.shots[0].shotId, state: "pending", attempts: 0, quotedRevision: composeGuardTask.revision };
  store.set(composeGuardTask.taskId, clone(composeGuardTask));
  composeGuardTask = await runner.executeAction(clone(composeGuardTask), {});
  assert.equal(composeGuardTask.operation.error, "workspace_stability_mock_image_dispatch_disabled");
  assert.deepEqual([runtime.mockLedgerSnapshot(composeGuardTask.siteId, composeGuardTask.customerId).available,
    runtime.mockLedgerSnapshot(composeGuardTask.siteId, composeGuardTask.customerId).reserved,
    runtime.mockLedgerSnapshot(composeGuardTask.siteId, composeGuardTask.customerId).spent], [1_000, 0, 0], "Image composition never enters the mock credit ledger");

  const refreshGuardTask = clone(composeGuardTask);
  refreshGuardTask.operation = undefined;
  refreshGuardTask.storyboard.shots[0].genStatus = "run";
  refreshGuardTask.storyboard.shots[0].versions = [{ vid: "real-pending", status: "run", generationJobId: "must-not-query", clipUrl: undefined }];
  refreshGuardTask.storyboard.shots[0].curVer = "real-pending";
  store.set(refreshGuardTask.taskId, clone(refreshGuardTask));
  const refreshedGuardTask = await runner.refreshTask(refreshGuardTask);
  assert.equal(refreshedGuardTask.storyboard.shots[0].genStatus, "fail");
  assert.equal(refreshedGuardTask.storyboard.shots[0].error, "workspace_stability_mock_video_dispatch_disabled", "Mock refresh refuses old real provider jobs");

  const disabled = async (promise, operation) => assert.rejects(promise, (error) => error.code === "workspace_stability_mock_dispatch_disabled" && error.details?.operation === operation);
  await disabled(provider.submitShotGeneration({ siteId: "site_aidreamcapes" }), "video");
  await disabled(provider.submitActorProductComposite({ siteId: "site_aidreamcapes" }), "image");
  await assert.rejects(provider.workspaceAsrProvider(), (error) => error.code === "workspace_stability_mock_asr_provider_disabled");
  assert.throws(() => stability.assertWorkspaceExternalOperation("tts"), (error) => error.code === "workspace_stability_mock_dispatch_disabled" && error.details?.operation === "tts");
  const dispatch = loadWorkspace("dispatch");
  const fakeJob = { id: "mock-guard-job", siteId: "site_aidreamcapes", customerId: "customer_mock_fixture", status: "queued", requestJson: {} };
  await disabled(dispatch.dispatchWorkspaceJob({ siteId: fakeJob.siteId, customerId: fakeJob.customerId, job: fakeJob, baseUrls: {} }), "worker");
  await disabled(dispatch.claimWorkspaceDispatch({ siteId: fakeJob.siteId, customerId: fakeJob.customerId, jobId: fakeJob.id, requestId: "mock-claim" }), "ledger");
  await disabled(dispatch.recordWorkspaceDispatch({ siteId: fakeJob.siteId, customerId: fakeJob.customerId, jobId: fakeJob.id, claimId: "mock-claim", outcome: "rejected" }), "ledger");
  assert.deepEqual(await provider.quoteWorkspaceAction({ siteId: "site_aidreamcapes", action: "generate_image" }), { available: false, reason: "workspace_stability_mock_image_dispatch_disabled" });

  assert.equal(externalRequestCount, 0, "No network request escaped the fetch trap");
  assert.equal(counters.providerStoreCalls, 0, "Provider configuration stores were not read");
  assert.equal(counters.apiKeyReads, 0, "No provider API key property was accessed");
  assert.equal(counters.prismaCalls, 0, "No Prisma task, credit, or platform ledger call occurred; task persistence used the in-memory fixture store");
  assert.equal(counters.assetStoreCalls, 0, "Mock rendering did not read or write shared customer assets");
  assert.equal(counters.generationSubmitCalls, 0, "No provider generation job was submitted");
  assert.equal(counters.realBillingStoreCalls, 0, "No real billing or platform ledger function was called");
  assert.equal(counters.workerDispatchCalls, 0, "No worker payload or dispatch function was called");
  assert.equal(counters.customerCatalogCalls, 0, "Stability mock used the built-in actor snapshot and skipped the database-backed customer catalog");

  console.log("PASS: draft → storyboard with confirmed brief/actor snapshot → synthetic shot → local render → MP4/SRT/clip route downloads → caption edit/new render version → Library reload/restore.");
  console.log("PASS: in-memory mock quote/reserve/settle/refund/cancel invariants; failure refunds and retries; mock artifacts remain marked unpublishable.");
  console.log(`COUNTS: ${JSON.stringify({ externalRequestCount, ...counters })}`);
  console.log("LIMIT: The smoke intentionally replaces task persistence with an in-memory owner-scoped store; authenticated routes are exercised with fixture auth, so no local database is required or contacted.");
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  fs.rmSync(temp, { recursive: true, force: true });
}
