import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const workspaceRoot = path.join(root, "src/lib/aidreamcapes-workspace");
const nativeRequire = createRequire(path.join(root, "package.json"));
const originalMode = process.env.AIVIDEOSUGC_STABILITY_MODE;
const originalFetch = globalThis.fetch;
process.env.AIVIDEOSUGC_STABILITY_MODE = "mock";

let externalCalls = 0;
globalThis.fetch = async (input) => {
  externalCalls++;
  throw new Error(`Unexpected external request: ${String(input)}`);
};

const counters = { mockStoryboardCalls: 0, mockCreditCancels: 0, providerCalls: 0, realLedgerCalls: 0, workerCalls: 0 };
const clone = (value) => structuredClone(value);
const fail = (code, status = 400) => Object.assign(new Error(code), { code, status });
const taskRows = new Map();
const callbacks = [];
const fixtureStore = {
  assertWorkspaceSite(siteId) {
    if (siteId !== "site_aidreamcapes") throw fail("workspace_site_not_found", 404);
  },
  async getTask(siteId, customerId, taskId) {
    fixtureStore.assertWorkspaceSite(siteId);
    const row = taskRows.get(taskId);
    if (!row || row.siteId !== siteId || row.customerId !== customerId) throw fail("task_not_found", 404);
    return clone(row);
  },
  async saveTask(task, expectedRevision) {
    const current = taskRows.get(task.taskId);
    if (!current || current.siteId !== task.siteId || current.customerId !== task.customerId || current.revision !== expectedRevision ||
        (current.status === "cancelled" && task.status !== "cancelled")) throw fail("revision_conflict", 409);
    const saved = { ...clone(task), revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    taskRows.set(task.taskId, saved);
    return clone(saved);
  },
  async listTasks(siteId, customerId) {
    fixtureStore.assertWorkspaceSite(siteId);
    return [...taskRows.values()].filter((task) => task.siteId === siteId && task.customerId === customerId).map(clone);
  },
  publicTask(task) {
    const { creationHash: _creationHash, ...copy } = clone(task);
    if (copy.operation) copy.operation = { action: copy.operation.action, state: copy.operation.state, error: copy.operation.error };
    return copy;
  },
};

const apiStub = {
  workspaceResponse(value, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); },
  workspaceFailure(error) { return Response.json({ error: error?.code || "workspace_request_failed" }, { status: error?.status || 500 }); },
  async jsonBody(request) {
    try { const value = JSON.parse(await request.text()); return value && !Array.isArray(value) && typeof value === "object" ? value : {}; }
    catch { throw fail("invalid_json"); }
  },
  expectedRevision(request, body) {
    const header = request.headers.get("if-match")?.replace(/^W\//, "").replaceAll('"', "");
    const revision = Number(header || body?.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) throw fail("revision_required", 428);
    return revision;
  },
  async catalogForCustomer() { return { actors: [] }; },
};
const authStub = {
  async workspaceAuth(request, siteId) {
    if (siteId !== "site_aidreamcapes") return { ok: false, response: apiStub.workspaceResponse({ error: "workspace_site_not_found" }, 404) };
    const customerId = request.headers.get("x-fixture-customer");
    if (!customerId) return { ok: false, response: apiStub.workspaceResponse({ error: "customer_login_required" }, 401) };
    return { ok: true, current: { customer: { id: customerId } } };
  },
};

let releaseStoryboard;
let signalStoryboardStarted;
let holdStoryboard = false;
let storyboardGate = new Promise((resolve) => { releaseStoryboard = resolve; });
let storyboardStarted = new Promise((resolve) => { signalStoryboardStarted = resolve; });
const mockStoryboard = {
  scenePlan: { strategy: "single", scenes: ["product"], mainScene: "product", reason: "fixture" },
  lang: "en", source: "auto", shots: [], colorGrade: "natural", musicGenre: "none", version: "fixture",
};
const runnerProviders = {
  getWorkspaceActors() { return []; },
  async generateStoryboard() {
    counters.mockStoryboardCalls++;
    signalStoryboardStarted();
    if (holdStoryboard) await storyboardGate;
    return clone(mockStoryboard);
  },
  async submitShotGeneration() { counters.providerCalls++; throw new Error("Provider generation must not run in cancellation smoke"); },
  async refreshShotGeneration() { counters.providerCalls++; throw new Error("Provider refresh must not run in cancellation smoke"); },
  async submitActorProductComposite() { counters.providerCalls++; throw new Error("Provider composition must not run in cancellation smoke"); },
  async refreshCompositeGeneration() { counters.providerCalls++; throw new Error("Provider refresh must not run in cancellation smoke"); },
};
const runnerPipeline = {
  assertActorVoiceSnapshot() {},
  compileStoryboard({ storyboard }) { return clone(storyboard); },
};
const runnerCatalogs = { sceneSchema: () => ({ needsActor: false }) };
const mockRuntime = {
  cancelMockCredits() { counters.mockCreditCancels++; return { state: "cancelled" }; },
  createMockShotClip() { throw new Error("No mock clip should be generated by cancellation smoke"); },
  mockShotClipUrl() { throw new Error("No mock clip URL should be generated by cancellation smoke"); },
  refundMockCredits() { counters.mockCreditCancels++; return { state: "refunded" }; },
  reserveMockCredits() { counters.mockCreditCancels++; },
  settleMockCredits() { counters.mockCreditCancels++; },
};
const billingTripwire = {
  async submitGenerationJob() { counters.realLedgerCalls++; throw new Error("Real generation submission reached during cancellation"); },
  async settleGenerationJobRelational() { counters.realLedgerCalls++; throw new Error("Real ledger settlement reached during cancellation"); },
};
const moduleCache = new Map();
const transpileOptions = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
function loadWorkspace(name) {
  const normalized = name.replace(/\.ts$/, "").replace(/\.json$/, "");
  if (moduleCache.has(`workspace:${normalized}`)) return moduleCache.get(`workspace:${normalized}`).exports;
  const filename = `${path.join(workspaceRoot, normalized)}${name.endsWith(".json") ? ".json" : ".ts"}`;
  if (name.endsWith(".json")) return JSON.parse(fs.readFileSync(filename, "utf8"));
  return loadFile(filename, `workspace:${normalized}`);
}
function scopedRequire(id, cacheKey) {
  if (id === "server-only") return {};
  if (id === "next/server") return { after: (callback) => callbacks.push(callback) };
  if (id === "./store" || id === "@/lib/aidreamcapes-workspace/store") return fixtureStore;
  if (id === "./api" || id === "@/lib/aidreamcapes-workspace/api") return apiStub;
  if (id === "@/lib/aidreamcapes-workspace/auth") return authStub;
  if (id === "@/lib/aidreamcapes-workspace/runner") return loadWorkspace("runner");
  if (id === "./provider" && cacheKey === "workspace:runner") return runnerProviders;
  if (id === "./pipeline" && cacheKey === "workspace:runner") return runnerPipeline;
  if (id === "./catalogs" && cacheKey === "workspace:runner") return runnerCatalogs;
  if (id === "./mock-runtime" && cacheKey === "workspace:runner") return mockRuntime;
  if (id === "./stability" && cacheKey === "workspace:runner") return { isWorkspaceStabilityMockMode: () => process.env.AIVIDEOSUGC_STABILITY_MODE === "mock" };
  if (id === "./music-catalog" && cacheKey === "workspace:runner") return { assertTaskMusicSelectionRights: async () => undefined };
  if (id === "./media-render" && cacheKey === "workspace:runner") return { renderTaskVideo: async () => { throw new Error("Render must not run in cancellation smoke"); } };
  if (id === "./quote" && cacheKey === "workspace:runner") return { verifyQuote: async () => 0 };
  if (id === "@/lib/session") return { publicUrlForRequest: () => new URL("http://localhost") };
  if (id === "@/lib/worker") return {
    resolveWorkerBaseUrls: () => ({}),
    async buildWorkerPayload() { counters.workerCalls++; throw new Error("Worker payload builder reached during cancellation"); },
    async dispatchWorkerPayload() { counters.workerCalls++; throw new Error("Worker dispatch reached during cancellation"); },
  };
  if (id === "@/lib/generation-submit" || id === "@/lib/stores/job-store") return billingTripwire;
  if (id === "./types" || id === "@/lib/aidreamcapes-workspace/types") return loadWorkspace("types");
  if (id.startsWith("./")) return loadWorkspace(id.slice(2));
  if (id.startsWith("@/lib/aidreamcapes-workspace/")) return loadWorkspace(id.slice("@/lib/aidreamcapes-workspace/".length));
  return nativeRequire(id);
}
function loadFile(filename, cacheKey) {
  if (moduleCache.has(cacheKey)) return moduleCache.get(cacheKey).exports;
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  moduleCache.set(cacheKey, fixtureModule);
  new Function("require", "module", "exports", "__filename", "__dirname", output)(
    (id) => scopedRequire(id, cacheKey), fixtureModule, fixtureModule.exports, filename, path.dirname(filename),
  );
  return fixtureModule.exports;
}

function request(url, method, customerId, { revision, body, signal } = {}) {
  const headers = new Headers({ "x-fixture-customer": customerId });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (revision !== undefined) headers.set("if-match", `"${revision}"`);
  const value = new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal });
  Object.defineProperty(value, "nextUrl", { value: new URL(url) });
  return value;
}
function newTask(taskId, customerId, overrides = {}) {
  const now = "2026-10-14T00:00:00.000Z";
  const task = {
    taskId, siteId: "site_aidreamcapes", customerId, sceneId: "presenter_showcase", title: "Cancellation fixture", status: "draft",
    createdAt: now, updatedAt: now, revision: 1,
    input: { fields: {}, images: {}, options: { duration: 6, aspect: "9:16", style: "natural", language: "en", subtitle: false } },
    storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [], ...overrides,
  };
  taskRows.set(taskId, clone(task));
  return task;
}
function codeOf(promise, code) {
  return assert.rejects(promise, (error) => error?.code === code, `Expected ${code}`);
}
function eventTask(text) {
  const match = text.match(/data: (\{.*\})/);
  assert(match, `SSE task event was not found: ${text}`);
  return JSON.parse(match[1]).task;
}

async function checkActualStoreBoundary() {
  const originalStore = new Map();
  const queries = [];
  const prisma = {
    async $queryRaw(strings, ...values) {
      const sql = strings.join("?");
      queries.push({ sql, values });
      if (sql.includes("FROM \"AidreamcapesVideoTask\"") && sql.startsWith("SELECT")) {
        const [id, siteId, customerId] = values;
        const row = originalStore.get(id);
        return row && siteId === "site_aidreamcapes" && row.siteId === siteId && row.customerId === customerId ? [clone(row)] : [];
      }
      if (sql.startsWith("UPDATE \"AidreamcapesVideoTask\"")) {
        const [json, taskId, siteId, customerId, expectedRevision, nextStatus] = values;
        const row = originalStore.get(taskId);
        if (!row || row.siteId !== siteId || row.customerId !== customerId || row.revision !== expectedRevision ||
            (row.data.status === "cancelled" && nextStatus !== "cancelled")) return [];
        const saved = { ...row, data: JSON.parse(json), revision: row.revision + 1, updatedAt: new Date() };
        originalStore.set(taskId, saved);
        return [clone(saved)];
      }
      throw new Error(`Unexpected SQL in store fixture: ${sql}`);
    },
  };
  const storeRequire = (id) => {
    if (id === "server-only") return {};
    if (id === "@/lib/prisma") return { prisma };
    if (id === "./types") return loadWorkspace("types");
    if (id === "./pipeline") return { createActorVoiceSnapshot: () => undefined };
    return nativeRequire(id);
  };
  const filename = path.join(workspaceRoot, "store.ts");
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(storeRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  const store = fixtureModule.exports;
  const now = new Date("2026-10-14T00:00:00.000Z");
  const stored = { taskId: "task-store-fixture", siteId: "site_aidreamcapes", customerId: "customer-store-owner", revision: 4,
    createdAt: now, updatedAt: now, data: { taskId: "task-store-fixture", siteId: "site_aidreamcapes", customerId: "customer-store-owner", revision: 4, status: "draft" } };
  originalStore.set(stored.taskId, clone(stored));
  await store.getTask("site_aidreamcapes", "customer-store-owner", stored.taskId);
  await codeOf(store.getTask("site_aidreamcapes", "customer-other", stored.taskId), "task_not_found");
  await codeOf(store.getTask("site_dreamshoot", "customer-store-owner", stored.taskId), "workspace_site_not_found");
  assert.match(queries[0].sql, /"id" = \? AND "siteId" = \? AND "customerId" = \?/);
  assert.deepEqual(queries[0].values, [stored.taskId, "site_aidreamcapes", "customer-store-owner"]);
  const staleTask = { taskId: stored.taskId, siteId: stored.siteId, customerId: stored.customerId, revision: 5, status: "cancelled" };
  await codeOf(store.saveTask(staleTask, 3), "revision_conflict");
  const currentTask = { ...staleTask, revision: 4 };
  const saved = await store.saveTask(currentTask, 4);
  assert.equal(saved.revision, 5);
  const attemptToReactivate = { ...saved, status: "completed" };
  await codeOf(store.saveTask(attemptToReactivate, saved.revision), "revision_conflict");
  assert.equal(originalStore.get(stored.taskId).data.status, "cancelled", "The persisted cancellation status cannot be reactivated by a later task write");
}

try {
  const runner = loadWorkspace("runner");
  const actionsRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/actions/route.ts"), "route:actions");
  const cancelRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/cancel/route.ts"), "route:cancel");
  const taskRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/route.ts"), "route:task");
  const eventsRoute = loadFile(path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/events/route.ts"), "route:events");
  const base = "http://localhost/api/sites/site_aidreamcapes/aivideosugc/tasks";
  const params = (taskId, siteId = "site_aidreamcapes") => ({ params: Promise.resolve({ siteId, taskId }) });

  let task = newTask("task-queued-cancel", "customer-owner");
  const queuedResponse = await actionsRoute.POST(request(`${base}/${task.taskId}/actions`, "POST", task.customerId, { revision: task.revision, body: { action: "storyboard" } }), params(task.taskId));
  assert.equal(queuedResponse.status, 202, JSON.stringify(await queuedResponse.clone().json()));
  task = (await queuedResponse.json()).task;
  assert.equal(task.operation.state, "pending");
  const deferred = callbacks.shift();
  assert.equal(typeof deferred, "function");

  const controller = new AbortController();
  const eventResponse = await eventsRoute.GET(request(`${base}/${task.taskId}/events`, "GET", task.customerId, { signal: controller.signal }), params(task.taskId));
  const eventReader = eventResponse.body.getReader();
  const initialEvent = await eventReader.read();
  assert.equal(eventTask(new TextDecoder().decode(initialEvent.value)).operation.state, "pending");

  const staleCancel = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", task.customerId, { revision: task.revision - 1 }), params(task.taskId));
  assert.equal(staleCancel.status, 409);
  assert.equal((await staleCancel.json()).error, "revision_conflict");
  const unchanged = await fixtureStore.getTask(task.siteId, task.customerId, task.taskId);
  assert.equal(unchanged.operation.state, "pending", "A stale revision cannot cancel queued work");
  const cancelResponse = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", task.customerId, { revision: task.revision }), params(task.taskId));
  assert.equal(cancelResponse.status, 200);
  let cancelled = (await cancelResponse.json()).task;
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.operation.state, "cancelled");
  assert.equal(cancelled.revision, task.revision + 1);
  assert(cancelled.cancelledAt);
  const repeated = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", task.customerId, { revision: task.revision }), params(task.taskId));
  assert.equal(repeated.status, 200);
  assert.deepEqual((await repeated.json()).task, cancelled, "A repeated cancellation returns the same terminal record without another revision");
  const secondEvent = await eventReader.read();
  assert.equal(eventTask(new TextDecoder().decode(secondEvent.value)).status, "cancelled", "The task SSE stream publishes the terminal state on its revision event");
  controller.abort();
  await eventReader.cancel().catch(() => undefined);

  const readback = await taskRoute.GET(request(`${base}/${task.taskId}`, "GET", task.customerId), params(task.taskId));
  assert.equal(readback.status, 200);
  assert.equal((await readback.json()).task.status, "cancelled", "Customer task readback exposes the persisted cancellation state");
  const ownerIsolation = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", "customer-other", { revision: cancelled.revision }), params(task.taskId));
  assert.equal(ownerIsolation.status, 404);
  assert.equal((await ownerIsolation.json()).error, "task_not_found");
  const siteIsolation = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", task.customerId, { revision: cancelled.revision }), params(task.taskId, "site_dreamshoot"));
  assert.equal(siteIsolation.status, 404);
  assert.equal((await siteIsolation.json()).error, "workspace_site_not_found");
  await deferred();
  assert.equal(counters.mockStoryboardCalls, 0, "The queued runner re-reads cancelled state and does no work");

  task = newTask("task-mock-run-race", "customer-owner", { operation: { id: "mock-run", action: "storyboard", state: "pending", attempts: 0 } });
  holdStoryboard = true;
  storyboardGate = new Promise((resolve) => { releaseStoryboard = resolve; });
  storyboardStarted = new Promise((resolve) => { signalStoryboardStarted = resolve; });
  const runnerPromise = runner.executeAction(await fixtureStore.getTask(task.siteId, task.customerId, task.taskId), {});
  await storyboardStarted;
  const running = await fixtureStore.getTask(task.siteId, task.customerId, task.taskId);
  assert.equal(running.operation.state, "run");
  const runningCancel = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", task.customerId, { revision: running.revision }), params(task.taskId));
  assert.equal(runningCancel.status, 200, "A running mock-only operation can be cancelled");
  releaseStoryboard();
  const raced = await runnerPromise;
  assert.equal(raced.status, "cancelled", "The runner cannot overwrite a concurrent mock cancellation");
  assert.equal((await fixtureStore.getTask(task.siteId, task.customerId, task.taskId)).status, "cancelled");
  holdStoryboard = false;

  task = newTask("task-real-queued", "customer-owner", { operation: { id: "real-queued", action: "generate_shot", state: "pending", attempts: 0, expectedCredits: 24 } });
  process.env.AIVIDEOSUGC_STABILITY_MODE = "real";
  const realQueuedCancel = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", task.customerId, { revision: task.revision }), params(task.taskId));
  assert.equal(realQueuedCancel.status, 200, "Queued real work can be cancelled before the runner dispatches it");
  assert.equal((await realQueuedCancel.json()).task.status, "cancelled");

  task = newTask("task-real-dispatched", "customer-owner", { status: "rendering", operation: { id: "real-dispatched", action: "generate_shot", state: "run", attempts: 1 } });
  const dispatchedBefore = await fixtureStore.getTask(task.siteId, task.customerId, task.taskId);
  const dispatchedCancel = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", task.customerId, { revision: task.revision }), params(task.taskId));
  assert.equal(dispatchedCancel.status, 409);
  assert.equal((await dispatchedCancel.json()).error, "operation_not_cancellable", "An already-running real provider operation gets the stable refusal code");
  assert.deepEqual(await fixtureStore.getTask(task.siteId, task.customerId, task.taskId), dispatchedBefore, "A refused real cancellation leaves provider work state untouched");

  process.env.AIVIDEOSUGC_STABILITY_MODE = "mock";
  task = newTask("task-mock-credit-cancel", "customer-owner", { operation: { id: "mock-credit-op", action: "generate_shot", state: "pending", attempts: 0, expectedCredits: 24 } });
  const creditCancel = await cancelRoute.POST(request(`${base}/${task.taskId}/cancel`, "POST", task.customerId, { revision: task.revision }), params(task.taskId));
  assert.equal(creditCancel.status, 200);
  assert.equal(counters.mockCreditCancels, 1, "Mock-only cancellation releases only the local mock reservation");

  await checkActualStoreBoundary();
  const originalStatusSql = fs.readFileSync(path.join(root, "prisma/migrations/20261014130000_add_aidreamcapes_workspace_persistence/migration.sql"), "utf8");
  const cancellationMigration = fs.readFileSync(path.join(root, "prisma/migrations/20261014200000_add_aidreamcapes_video_task_cancelled_status/migration.sql"), "utf8");
  assert.match(originalStatusSql, /'draft', 'storyboard_ready', 'rendering', 'completed', 'failed'/, "The original migration history remains unchanged");
  assert.match(cancellationMigration, /AidreamcapesVideoTask_status_check/);
  assert.match(cancellationMigration, /'failed', 'cancelled'/);
  assert(!/Dreamshoot|site_dreamshoot/.test(cancellationMigration), "The additive status migration only alters Aidreamcapes task state");

  assert.equal(counters.providerCalls, 0, "No real provider generation or refresh call occurred");
  assert.equal(counters.realLedgerCalls, 0, "No platform or customer ledger call occurred");
  assert.equal(counters.workerCalls, 0, "No worker dispatch occurred");
  assert.equal(externalCalls, 0, "No external request occurred");
  console.log("PASS: owner/site-scoped task cancellation; revision CAS and idempotent repeat; queued and mock-run race behavior; terminal readback/SSE; real dispatched work refused.");
  console.log(`COUNTS: ${JSON.stringify({ externalCalls, ...counters })}`);
} finally {
  globalThis.fetch = originalFetch;
  if (originalMode === undefined) delete process.env.AIVIDEOSUGC_STABILITY_MODE;
  else process.env.AIVIDEOSUGC_STABILITY_MODE = originalMode;
}
