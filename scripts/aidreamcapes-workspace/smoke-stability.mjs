import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const workspace = path.join(process.cwd(), "src/lib/aidreamcapes-workspace");
const originalFetch = globalThis.fetch;
const originalEnv = new Map(["AIVIDEOSUGC_STABILITY_MODE", "AIVIDEOSUGC_QUOTE_SECRET", "AIVIDEOSUGC_TEXT_PROVIDER_ID", "AIVIDEOSUGC_ASR_PROVIDER_ID"].map((key) => [key, process.env[key]]));
process.env.AIVIDEOSUGC_STABILITY_MODE = "mock";
process.env.AIVIDEOSUGC_QUOTE_SECRET = "local-stability-smoke-secret";
process.env.AIVIDEOSUGC_TEXT_PROVIDER_ID = "must-not-be-read";
process.env.AIVIDEOSUGC_ASR_PROVIDER_ID = "must-not-be-read";

let externalRequestCount = 0;
globalThis.fetch = async (input) => {
  const value = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const url = new URL(value, "http://localhost");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return new Response(null, { status: 204 });
  externalRequestCount++;
  throw new Error(`External request blocked by stability smoke: ${url.origin}`);
};

const counters = {
  providerStoreCalls: 0,
  apiKeyReads: 0,
  prismaCalls: 0,
  realBillingStoreCalls: 0,
  generationSubmitCalls: 0,
  workerDispatchCalls: 0,
};
const providerFixture = {
  id: "provider-canary", enabled: true, aiUrl: "https://provider.invalid/v1", modelType: "fixture-model",
  label: "must not be used", maxImagesPerRequest: 4, videoDurations: [6, 10, 15], videoAspectRatios: ["9:16"],
};
Object.defineProperty(providerFixture, "apiKey", { get() { counters.apiKeyReads++; return "must-not-be-read"; } });

const recordStoreCall = () => {
  counters.prismaCalls++;
  counters.realBillingStoreCalls++;
  throw new Error("A real database or billing store was reached by the stability smoke");
};
const prisma = new Proxy({}, {
  get(_target, key) {
    if (key === "$queryRaw" || key === "$executeRaw") return recordStoreCall;
    return new Proxy({}, { get: () => recordStoreCall });
  },
});
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
const assetStore = new Proxy({}, { get: () => async () => { counters.prismaCalls++; throw new Error("Asset store reached"); } });

const nativeRequire = createRequire(path.join(process.cwd(), "package.json"));
const moduleCache = new Map();
const transpileOptions = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
function loadWorkspaceModule(name) {
  if (moduleCache.has(name)) return moduleCache.get(name).exports;
  if (name === "actors.json") return { actors: [] };
  const filename = path.join(workspace, `${name}.ts`);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  moduleCache.set(name, fixtureModule);
  const scopedRequire = (id) => {
    if (id === "./provider-catalog-read") return { listWorkspaceProviderRows: providerStore.listPlatformAiProvidersRelational, getWorkspaceProviderRow: providerStore.getPlatformAiProviderRelational };
    if (id === "server-only") return {};
    if (id.startsWith("./")) return loadWorkspaceModule(id.slice(2).replace(/\.json$/, ".json").replace(/\.ts$/, ""));
    if (id === "@/lib/prisma") return { prisma };
    if (id === "@/lib/stores/platform-store") return providerStore;
    if (id === "@/lib/stores/asset-store") return assetStore;
    if (id === "@/lib/customer-asset-storage") return { writeCustomerAssetFileShared: async () => { counters.prismaCalls++; throw new Error("Customer asset store reached"); } };
    if (id === "@/lib/generation-submit") return billingStore;
    if (id === "@/lib/stores/job-store") return billingStore;
    if (id === "@/lib/worker") return worker;
    if (id === "@/lib/video-provider-availability") return { videoProviderAvailabilityReason: () => undefined };
    if (id === "@/lib/video-provider-family") return { videoProviderModelFamilyForProvider: () => "unknown" };
    if (id === "@/lib/video-frame-config") return {
      videoDurationCreditCost: () => 0, videoResolutionCreditCost: () => 0,
      normalizeVideoDurationSecondsForFrameCount: (duration) => duration,
    };
    if (id === "@/lib/types") return {};
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

try {
  const catalogs = loadWorkspaceModule("catalogs");
  const provider = loadWorkspaceModule("provider");
  const dispatch = loadWorkspaceModule("dispatch");
  const mediaRender = loadWorkspaceModule("media-render");
  const quote = loadWorkspaceModule("quote");
  const stability = loadWorkspaceModule("stability");

  const input = catalogs.defaultTaskInput("process_demo");
  input.fields.steps = "Lift the lid\nPlace the supplied product";
  input.images.productImages = ["/api/local-assets/sites/site_aidreamcapes/customers/customer_fixture/assets/product.png"];
  const storyboardArgs = { siteId: "site_aidreamcapes", sceneId: "process_demo", input, actors: [] };
  const first = await provider.generateStoryboard(storyboardArgs);
  const second = await provider.generateStoryboard(storyboardArgs);
  const stableStoryboard = (value) => ({ ...value, shots: value.shots.map(({ shotId: _shotId, ...shot }) => shot) });
  assert.deepEqual(stableStoryboard(first), stableStoryboard(second), "Mock storyboard text and style decisions are deterministic");
  assert.equal(first.shots.length, 1);
  assert.equal(first.shots[0].visual, "Show the supplied product clearly.");
  assert.equal(first.shots[0].voiceover, "", "Non-presenter scene has no synthetic narration");

  const cuesA = await mediaRender.measuredSpeechCues("/missing/local-fixture.mp4", "Take a look at this product.", "en", 6);
  const cuesB = await mediaRender.measuredSpeechCues("/different/missing-fixture.mp4", "Take a look at this product.", "en", 6);
  assert.deepEqual(cuesA, [{ start: 0, end: 6, text: "Take a look at this product." }]);
  assert.deepEqual(cuesA, cuesB, "Mock ASR timing is deterministic and does not inspect media files");
  await assert.rejects(provider.workspaceAsrProvider(), (error) => error.code === "workspace_stability_mock_asr_provider_disabled");

  const catalog = await provider.getWorkspaceCatalog("site_aidreamcapes");
  assert.equal(catalog.subtitles.available, true);
  assert(catalog.models.every((model) => model.available === false));
  assert(catalog.durations.every((duration) => duration.generationAvailable === false));
  assert.equal(catalog.composition.available, false);

  const task = {
    taskId: "task-fixture", siteId: "site_aidreamcapes", customerId: "customer-fixture", sceneId: "process_demo",
    title: "Fixture task", status: "storyboard_ready", createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
    revision: 3, input, storyboard: first, storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [],
  };
  const generatedQuote = await quote.createQuote(task, "generate_shot", first.shots[0].shotId);
  assert.equal(generatedQuote.available, true);
  assert.equal(generatedQuote.credits, 60);
  assert.equal(await quote.verifyQuote(task, "generate_shot", first.shots[0].shotId, generatedQuote.quoteToken), 60);
  assert.deepEqual(await provider.quoteWorkspaceAction({ siteId: task.siteId, action: "generate_image", task }), {
    available: false, reason: "workspace_stability_mock_image_dispatch_disabled",
  });
  assert.deepEqual(await provider.quoteWorkspaceAction({ siteId: task.siteId, action: "compose_shot", task }), {
    available: false, reason: "workspace_stability_mock_image_dispatch_disabled",
  });

  const expectDisabled = async (promise, operation) => assert.rejects(promise, (error) =>
    error.code === "workspace_stability_mock_dispatch_disabled" && error.details?.operation === operation,
  `Expected ${operation} dispatch to be disabled`);
  await expectDisabled(provider.submitShotGeneration({ siteId: "site_aidreamcapes" }), "video");
  await expectDisabled(provider.submitActorProductComposite({ siteId: "site_aidreamcapes" }), "image");
  assert.throws(() => stability.assertWorkspaceExternalOperation("tts"), (error) =>
    error.code === "workspace_stability_mock_dispatch_disabled" && error.details?.operation === "tts");
  const job = { id: "job-fixture", siteId: task.siteId, customerId: task.customerId, status: "queued", requestJson: {} };
  await expectDisabled(dispatch.dispatchWorkspaceJob({ siteId: task.siteId, customerId: task.customerId, job, baseUrls: {} }), "worker");
  await expectDisabled(dispatch.claimWorkspaceDispatch({ siteId: task.siteId, customerId: task.customerId, jobId: job.id, requestId: `req_${job.id}` }), "ledger");
  await expectDisabled(dispatch.recordWorkspaceDispatch({ siteId: task.siteId, customerId: task.customerId, jobId: job.id, claimId: "claim-fixture", outcome: "rejected" }), "ledger");

  assert.equal(externalRequestCount, 0, "No external HTTP requests were attempted");
  assert.equal(counters.providerStoreCalls, 0, "Provider configuration stores were not read");
  assert.equal(counters.apiKeyReads, 0, "No provider API key property was read");
  assert.equal(counters.prismaCalls, 0, "No Prisma store call was made");
  assert.equal(counters.generationSubmitCalls, 0, "No generation job or credit reservation was submitted");
  assert.equal(counters.realBillingStoreCalls, 0, "No real billing or ledger store call was made");
  assert.equal(counters.workerDispatchCalls, 0, "No worker payload or dispatch function was called");

  console.log("PASS: deterministic mock storyboard and ASR; fake shot quote verified at 60 credits; video/image/TTS/worker/ledger real paths refused.");
  console.log(`COUNTS: ${JSON.stringify({ externalRequestCount, ...counters })}`);
} finally {
  globalThis.fetch = originalFetch;
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
