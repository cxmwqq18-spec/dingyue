import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

// Offline contract smoke for the subtitle-completion operations:
// hardcoded instruction -> text model plan -> caption draft -> burn-in render
// -> committed task version, plus the POST/GET route guards.

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "aivideosugc-subtitle-ops-"));
const previousFetch = globalThis.fetch;
let externalRequestCount = 0;
globalThis.fetch = async (input) => {
  const value = typeof input === "string" || input instanceof URL ? String(input) : input.url;
  const url = new URL(value, "http://localhost");
  if (["localhost", "127.0.0.1", "::1"].includes(url.hostname)) return new Response(null, { status: 204 });
  externalRequestCount++;
  throw new Error(`External request blocked by subtitle-ops smoke: ${url.origin}`);
};

const root = process.cwd();
const workspaceRoot = path.join(root, "src/lib/aidreamcapes-workspace");
const nativeRequire = createRequire(path.join(root, "package.json"));
const moduleCache = new Map();
const store = new Map();
let storeWriteCount = 0;
let removeEditedRenderCalls = 0;
let failNextRender = false;
let failSaveTimes = 0;
const renderCalls = [];
const prismaQueries = [];
const platformInflightRows = [];
const decisionCalls = [];
let decisionOverride;

const clone = (value) => structuredClone(value);
// The retry logic identifies conflicts via `instanceof WorkspaceError`, so fixtures throw the real class.
let WorkspaceErrorClass;
const error = (code, status = 400, details) => {
  if (!WorkspaceErrorClass) WorkspaceErrorClass = loadWorkspace("types").WorkspaceError;
  return new WorkspaceErrorClass(code, status, details);
};

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
    if (failSaveTimes > 0) {
      failSaveTimes--;
      throw error("revision_conflict", 409);
    }
    const saved = { ...clone(task), revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
    store.set(task.taskId, saved);
    storeWriteCount++;
    return clone(saved);
  }
};

const providerStub = {
  async structuredDecision(system, data) {
    decisionCalls.push({ system, data });
    if (decisionOverride) return typeof decisionOverride === "function" ? decisionOverride(system, data) : decisionOverride;
    return { style: "bold", lines: [{ start: 0, end: 3, text: "Meet the Aurora lamp." }, { start: 3, end: 6, text: "Dimmable and rechargeable." }] };
  }
};

const editorStub = {
  compileVideoEdit(task, patch) {
    return { patch, sourceRenderId: task.video.renderId, settings: { ...patch } };
  },
  async renderEditedVideo(task, compiled) {
    const renderId = `edit-${renderCalls.length + 1}`;
    renderCalls.push({ taskId: task.taskId, renderId, style: compiled.settings.subtitleStyle, patch: compiled.patch, stagedDraft: Boolean(task.captionEdits), draftRenderId: task.captionEdits?.renderId });
    if (failNextRender) {
      failNextRender = false;
      throw error("workspace_video_processing_failed", 502);
    }
    return {
      ...clone(task.video),
      renderId,
      sourceRenderId: task.video.renderId,
      status: "done",
      finalUrl: "/output?kind=video",
      subtitleUrl: "/output?kind=subtitles",
      captionLines: clone(task.captionEdits.lines),
      stale: false
    };
  },
  async removeEditedRender() { removeEditedRenderCalls++; }
};

const jobStore = new Map();
class FakeRollingLimitError extends Error {
  constructor(retryAfterSeconds) { super("rolling limit"); this.retryAfterSeconds = retryAfterSeconds; }
}
const asyncJobsStub = {
  AsyncJobRollingLimitError: FakeRollingLimitError,
  async getAsyncJobByIdempotency(params) { return jobStore.get(params.idempotencyKey); },
  async createAsyncJob(params) {
    const running = [...jobStore.values()].filter((job) => job.actorId === params.actorId && job.status !== "failed");
    if (running.length >= 1) throw new FakeRollingLimitError(3600);
    const job = { id: `job-${jobStore.size + 1}`, kind: params.kind, actorId: params.actorId, idempotencyKey: params.idempotencyKey, metadata: params.metadata, status: "queued", result: null, error: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    jobStore.set(params.idempotencyKey, job);
    try {
      job.result = await params.run({ jobId: job.id, signal: new AbortController().signal, update: async () => job });
      job.status = "succeeded";
    } catch (caught) {
      job.status = "failed";
      job.error = caught.code || caught.message;
    }
    return job;
  },
  async getAsyncJob(id) { return [...jobStore.values()].find((job) => job.id === id); }
};

const authStub = {
  async workspaceAuth(request, siteId, mutation = false) {
    void mutation;
    if (siteId !== "site_aidreamcapes") return { ok: false, response: Response.json({ error: "workspace_site_not_found" }, { status: 404 }) };
    const customerId = request.headers.get("x-fixture-customer");
    if (!customerId) return { ok: false, response: Response.json({ error: "customer_login_required" }, { status: 401 }) };
    return { ok: true, current: { customer: { id: customerId } } };
  }
};

const apiStub = {
  workspaceResponse(value, status = 200) { return Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } }); },
  workspaceFailure(caught) { return Response.json({ error: caught?.code || "workspace_request_failed" }, { status: caught?.status || 500 }); },
  async jsonBody(request) { return JSON.parse(await request.text()); }
};

const prismaStub = {
  prisma: {
    platformAsyncJob: {
      async findMany(query) {
        prismaQueries.push(query);
        return platformInflightRows.filter((row) =>
          row.kind === query.where.kind
          && row.actorId === query.where.actorId
          && query.where.status.in.includes(row.status));
      }
    }
  }
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
    if (id === "./store") return persistentStore;
    if (id === "./provider") return providerStub;
    if (id === "./editor") return editorStub;
    if (id.startsWith("./")) return loadWorkspace(id.slice(2).replace(/\.ts$/, ""));
    if (id === "@/lib/prisma") return { prisma: {} };
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

function loadRoute(filename, extraStubs = {}) {
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), transpileOptions).outputText;
  const fixtureModule = { exports: {} };
  const workspaceStubs = {
    "@/lib/aidreamcapes-workspace/auth": authStub,
    "@/lib/aidreamcapes-workspace/api": apiStub,
    "@/lib/aidreamcapes-workspace/store": persistentStore,
    "@/lib/aidreamcapes-workspace/subtitle-ops": loadWorkspace("subtitle-ops"),
    "@/lib/aidreamcapes-workspace/subtitle-ops.server": loadWorkspace("subtitle-ops.server"),
    "@/lib/aidreamcapes-workspace/types": loadWorkspace("types"),
    "@/lib/async-jobs": asyncJobsStub,
    "@/lib/prisma": prismaStub,
    ...extraStubs
  };
  const scopedRequire = (id) => {
    if (id === "server-only") return {};
    if (workspaceStubs[id]) return workspaceStubs[id];
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

function request(url, method, customerId, body, extraHeaders = {}) {
  const headers = new Headers({ "content-type": "application/json", ...extraHeaders });
  if (customerId) headers.set("x-fixture-customer", customerId);
  const value = new Request(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  Object.defineProperty(value, "nextUrl", { value: new URL(url) });
  return value;
}

function buildTask(overrides = {}) {
  return {
    taskId: "task_subtitle_fixture",
    siteId: "site_aidreamcapes",
    customerId: "customer_subtitle_owner",
    sceneId: "presenter_showcase",
    title: "Aurora lamp launch",
    status: "completed",
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T00:00:00.000Z",
    revision: 7,
    storyboardStale: false,
    input: {
      images: {},
      fields: { product_name: "Aurora Lamp", key_features: ["Dimmable", "Rechargeable"] },
      options: { duration: 6, aspect: "9:16", style: "clean", language: "en", subtitle: false }
    },
    storyboard: {
      scenePlan: { strategy: "single", scenes: ["presenter_showcase"], mainScene: "presenter_showcase", reason: "fixture" },
      lang: "en",
      source: "auto",
      shots: [{ shotId: "shot-1", visual: "The lamp glows on a desk.", voiceover: "Meet Aurora.", start: 0, end: 6, duration: 6, versions: [{ vid: "v1", status: "done", duration: 6, clipUrl: "clips/v1.mp4" }], genStatus: "done" }],
      colorGrade: "neutral",
      musicGenre: "ambient",
      version: "1"
    },
    storyboardHistory: [],
    revisions: [],
    video: {
      renderId: "render-base",
      storyboardHash: "hash-1",
      clips: [{ shotId: "shot-1", vid: "v1", clipUrl: "clips/v1.mp4" }],
      status: "done",
      steps: [],
      finalUrl: "/output?kind=video",
      stale: false,
      createdAt: "2026-10-29T00:00:00.000Z"
    },
    videoHistory: [],
    ...overrides
  };
}

const postRoutePath = path.join(root, "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/subtitle-ops/route.ts");
const jobRoutePath = path.join(root, "src/app/api/sites/[siteId]/aivideosugc/subtitle-ops/[jobId]/route.ts");

try {
  const subtitleOpsServer = loadWorkspace("subtitle-ops.server");
  const subtitleOps = loadWorkspace("subtitle-ops");

  // Catalog stays public copy only: no instruction text may leak to the client bundle.
  for (const op of subtitleOps.SUBTITLE_OPS) {
    assert.deepEqual(Object.keys(op).sort(), ["id", "label", "summary"]);
    assert(!op.summary.toLowerCase().includes("json"), "Catalog copy must not carry model contract text");
  }
  assert.equal(subtitleOps.SUBTITLE_OPS.length, 3);

  const owner = "customer_subtitle_owner";
  const stranger = "customer_subtitle_other";

  // 1. Happy path on a video without existing captions.
  const task = buildTask();
  store.set(task.taskId, clone(task));
  const committed = await subtitleOpsServer.runSubtitleOp({ siteId: task.siteId, customerId: owner, taskId: task.taskId, opId: "captions_polish" });
  assert.equal(decisionCalls.length, 1);
  assert.match(decisionCalls[0].system, /subtitle completion planner/, "The hardcoded instruction stays in the system prompt");
  assert.match(decisionCalls[0].system, /generate subtitles/i);
  assert.equal(decisionCalls[0].data.operation, "captions_polish");
  assert.equal(decisionCalls[0].data.durationSeconds, 6);
  assert.equal(decisionCalls[0].data.language.code, "en");
  assert.equal(decisionCalls[0].data.spokenLines, undefined, "A video without captions plans from shots and script");
  assert.equal(renderCalls[0].style, "bold");
  assert.equal(renderCalls[0].stagedDraft, true);
  assert.equal(renderCalls[0].draftRenderId, "render-base", "The plan is staged against the current render");
  const saved = store.get(task.taskId);
  assert.equal(saved.revision, 8);
  assert.equal(saved.video.renderId, committed.renderId);
  assert.equal(saved.video.captionLines.length, 2);
  assert.equal(saved.videoHistory[0].renderId, "render-base", "The original version is kept in history");
  assert.equal(saved.captionEdits, undefined, "The staged draft is consumed by the burn-in");
  assert.equal(saved.subtitleCompletion.length, 1);
  assert.equal(saved.subtitleCompletion[0].opId, "captions_polish");
  assert.equal(saved.subtitleCompletion[0].renderId, committed.renderId);
  assert.equal(saved.revisions.at(-1).field, "subtitleOp:captions_polish");
  assert.deepEqual(Object.keys(committed).sort(), ["finalUrl", "linesCount", "opId", "priorRenderIds", "renderId", "revision", "style", "taskId"]);
  assert.equal(committed.priorRenderIds.includes("render-base"), true);

  // 2. Unusable model plans never touch the store.
  const baselineWrites = storeWriteCount;
  const baselineRenders = renderCalls.length;
  decisionOverride = { style: "neon", lines: [{ start: 0, end: 3, text: "Broken style." }] };
  await assert.rejects(
    () => subtitleOpsServer.runSubtitleOp({ siteId: task.siteId, customerId: owner, taskId: task.taskId, opId: "promo_lines" }),
    (caught) => caught.code === "workspace_subtitle_op_plan_invalid"
  );
  decisionOverride = { style: "bold", lines: [{ start: 0, end: 4, text: "First." }, { start: 3, end: 6, text: "Overlapping." }] };
  await assert.rejects(
    () => subtitleOpsServer.runSubtitleOp({ siteId: task.siteId, customerId: owner, taskId: task.taskId, opId: "promo_lines" }),
    (caught) => caught.code === "workspace_caption_timing_invalid"
  );
  decisionOverride = undefined;
  assert.equal(storeWriteCount, baselineWrites, "Invalid plans do not write");
  assert.equal(renderCalls.length, baselineRenders, "Invalid plans do not render");

  // 2b. Customer style overrides reach the render pipeline and win over the plan.
  const styledRenders = renderCalls.length;
  const styled = await subtitleOpsServer.runSubtitleOp({
    siteId: task.siteId, customerId: owner, taskId: task.taskId, opId: "captions_polish",
    settings: { style: "classic", size: "large", position: "top", color: "yellow", backdrop: "none" }
  });
  const styledCall = renderCalls[renderCalls.length - 1];
  assert.equal(styled.style, "classic", "The customer style overrides the plan style");
  assert.equal(styledCall.style, "classic");
  assert.equal(styledCall.patch.subtitleSize, "large");
  assert.equal(styledCall.patch.subtitlePosition, "top");
  assert.equal(styledCall.patch.subtitleColor, "yellow");
  assert.equal(styledCall.patch.subtitleBackdrop, "none");
  assert.equal(renderCalls.length, styledRenders + 1);

  // 2c. Settings parsing is a strict whitelist.
  assert.deepEqual(subtitleOps.parseSubtitleOpSettings(undefined), {});
  assert.deepEqual(subtitleOps.parseSubtitleOpSettings(null), {});
  assert.deepEqual(subtitleOps.parseSubtitleOpSettings({ size: "large" }), { size: "large" });
  for (const bad of [{ size: "huge" }, { style: "neon" }, { evil: 1 }, "nope", ["bottom"]]) {
    assert.throws(() => subtitleOps.parseSubtitleOpSettings(bad), (caught) => caught.code === "workspace_subtitle_op_settings_invalid");
  }

  // 3. One save conflict retries against the fresh revision and succeeds; the superseded render is removed.
  const retriesBaselineRenders = renderCalls.length;
  failSaveTimes = 1;
  const retried = await subtitleOpsServer.runSubtitleOp({ siteId: task.siteId, customerId: owner, taskId: task.taskId, opId: "captions_polish" });
  assert.equal(retried.renderId.startsWith("edit-"), true);
  assert.equal(renderCalls.length, retriesBaselineRenders + 2, "The burn-in repeats once after the conflict");
  assert.equal(renderCalls[renderCalls.length - 2].renderId !== renderCalls[renderCalls.length - 1].renderId, true, "The retry renders a fresh cut");
  assert.equal(store.get(task.taskId).video.renderId, retried.renderId);
  assert.equal(removeEditedRenderCalls, 1, "The superseded render from the failed attempt is removed");

  // 3b. Two consecutive conflicts still fail and leave every uncommitted render cleaned up.
  const failedBaselineRenders = renderCalls.length;
  const failedBaselineCleanup = removeEditedRenderCalls;
  failSaveTimes = 2;
  await assert.rejects(
    () => subtitleOpsServer.runSubtitleOp({ siteId: task.siteId, customerId: owner, taskId: task.taskId, opId: "marketing_copy" }),
    (caught) => caught.code === "revision_conflict"
  );
  assert.equal(renderCalls.length, failedBaselineRenders + 2);
  assert.equal(removeEditedRenderCalls, failedBaselineCleanup + 2, "Both uncommitted renders are removed");
  assert.equal(store.get(task.taskId).video.renderId, retried.renderId, "The task keeps its committed version");

  // 4. Route guards.
  const postRoute = loadRoute(postRoutePath);
  const context = (taskId) => ({ params: Promise.resolve({ siteId: "site_aidreamcapes", taskId }) });
  const post = (customerId, body, extraHeaders = {}, taskId = task.taskId) => postRoute.POST(request("http://localhost/x", "POST", customerId, body, extraHeaders), context(taskId));

  const unknownOp = await post(owner, { opId: "make_it_viral" });
  assert.equal(unknownOp.status, 422);
  assert.equal((await unknownOp.json()).error, "workspace_subtitle_op_invalid");

  const noKey = await post(owner, { opId: "promo_lines" });
  assert.equal(noKey.status, 400);

  const foreign = await post(stranger, { opId: "promo_lines" }, { "idempotency-key": "key-foreign" });
  assert.equal(foreign.status, 404);

  const badSettings = await post(owner, { opId: "promo_lines", settings: { size: "huge" } }, { "idempotency-key": "key-bad-settings" });
  assert.equal(badSettings.status, 422);
  assert.equal((await badSettings.json()).error, "workspace_subtitle_op_settings_invalid");

  const unknownSetting = await post(owner, { opId: "promo_lines", settings: { evil: 1 } }, { "idempotency-key": "key-unknown-setting" });
  assert.equal(unknownSetting.status, 422);

  store.set("task_subtitle_draft", clone(buildTask({ taskId: "task_subtitle_draft", status: "draft" })));
  const draft = await post(owner, { opId: "promo_lines" }, { "idempotency-key": "key-draft" }, "task_subtitle_draft");
  assert.equal(draft.status, 409);
  assert.equal((await draft.json()).error, "workspace_subtitle_op_not_ready");

  store.set("task_subtitle_busy", clone(buildTask({ taskId: "task_subtitle_busy", operation: { action: "render", state: "run" } })));
  const busy = await post(owner, { opId: "promo_lines" }, { "idempotency-key": "key-busy" }, "task_subtitle_busy");
  assert.equal(busy.status, 409);
  assert.equal((await busy.json()).error, "task_busy");

  // 5. Successful POST commits the burned version; the same idempotency key replays it.
  const accepted = await post(owner, { opId: "promo_lines", settings: { size: "small", position: "middle" } }, { "idempotency-key": "key-promo-1" });
  assert.equal(accepted.status, 202);
  const acceptedBody = await accepted.json();
  assert.equal(acceptedBody.ok, true);
  assert.equal(acceptedBody.job.status, "succeeded");
  assert.equal(acceptedBody.job.result.opId, "promo_lines");
  const acceptedCall = renderCalls[renderCalls.length - 1];
  assert.equal(acceptedCall.patch.subtitleSize, "small", "Settings from the request body reach the render pipeline");
  assert.equal(acceptedCall.patch.subtitlePosition, "middle");
  assert.equal(acceptedCall.patch.subtitleStyle, "bold", "Unspecified dimensions stay on the AI plan");
  const promoTask = store.get(task.taskId);
  assert.equal(promoTask.video.renderId, acceptedBody.job.result.renderId);
  assert.equal(promoTask.videoHistory.some((entry) => entry.renderId === committed.renderId), true, "Each operation version is preserved");

  const replay = await post(owner, { opId: "promo_lines" }, { "idempotency-key": "key-promo-1" });
  assert.equal(replay.status, 202);
  assert.equal((await replay.json()).job.id, acceptedBody.job.id, "Idempotent replay returns the original job");

  // 6. The per-customer rolling limit rejects extra operations.
  const limited = await post(owner, { opId: "marketing_copy" }, { "idempotency-key": "key-copy-1" });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error, "workspace_subtitle_op_limit_reached");

  // 6b. Single flight per task: a queued/running job for the same task is replayed
  // instead of stacking a second conflicting burn-in, even past the rolling limit.
  const now = new Date().toISOString();
  platformInflightRows.push({
    id: "job-inflight-1", kind: "aivideosugc_subtitle_op", actorId: owner, status: "running",
    metadata: { taskId: task.taskId, customerId: owner, opId: "captions_polish" },
    result: null, error: null, createdAt: now, updatedAt: now
  });
  const jobsBefore = jobStore.size;
  const rendersBefore = renderCalls.length;
  const replayedInflight = await post(owner, { opId: "captions_polish" }, { "idempotency-key": "key-inflight" });
  assert.equal(replayedInflight.status, 202);
  const inflightBody = await replayedInflight.json();
  assert.equal(inflightBody.job.id, "job-inflight-1", "The inflight job is replayed");
  assert.equal(jobStore.size, jobsBefore, "No new job is stacked on the inflight one");
  assert.equal(renderCalls.length, rendersBefore, "No render is started for a replayed inflight job");
  assert.equal(prismaQueries.at(-1).where.status.in.includes("running"), true, "The inflight lookup covers queued and running jobs");

  // An inflight job on another task does not block a new operation.
  store.set("task_subtitle_other", clone(buildTask({ taskId: "task_subtitle_other" })));
  const otherTaskInflight = await post(owner, { opId: "marketing_copy" }, { "idempotency-key": "key-inflight-other" }, "task_subtitle_other");
  assert.equal(otherTaskInflight.status, 429, "A different task still goes through the rolling limit");
  assert.equal(jobStore.size, jobsBefore);

  platformInflightRows.length = 0;
  const afterInflightCleared = await post(owner, { opId: "marketing_copy" }, { "idempotency-key": "key-inflight-cleared" }, "task_subtitle_other");
  assert.equal(afterInflightCleared.status, 429, "Without an inflight job the rolling limit applies again");

  // 7. Job status endpoint is owner-scoped.
  const jobRoute = loadRoute(jobRoutePath);
  const jobContext = (jobId) => ({ params: Promise.resolve({ siteId: "site_aidreamcapes", jobId }) });
  const ownerJob = await jobRoute.GET(request("http://localhost/x", "GET", owner), jobContext(acceptedBody.job.id));
  assert.equal(ownerJob.status, 200);
  assert.equal((await ownerJob.json()).job.id, acceptedBody.job.id);
  const strangerJob = await jobRoute.GET(request("http://localhost/x", "GET", stranger), jobContext(acceptedBody.job.id));
  assert.equal(strangerJob.status, 404);
  const missingJob = await jobRoute.GET(request("http://localhost/x", "GET", owner), jobContext("job-does-not-exist"));
  assert.equal(missingJob.status, 404);

  assert.equal(externalRequestCount, 0, "No external HTTP request was attempted");
  console.log("PASS: hardcoded instruction stays server-side; plan validation, burn-in commit, history, cleanup and route guards all hold.");
  console.log(`COUNTS: ${JSON.stringify({ decisionCalls: decisionCalls.length, renderCalls: renderCalls.length, storeWriteCount, removeEditedRenderCalls, externalRequestCount })}`);
} finally {
  globalThis.fetch = previousFetch;
  fs.rmSync(temp, { recursive: true, force: true });
}
