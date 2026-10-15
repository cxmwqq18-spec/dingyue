import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const root = process.cwd();
const workspace = path.join(root, "src/lib/aidreamcapes-workspace");
const nativeRequire = createRequire(path.join(root, "package.json"));
const cache = new Map();
const options = { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } };
const forbiddenImports = new Set([
  "@/lib/generation-submit",
  "@/lib/stores/job-store",
  "./provider",
  "./dispatch",
  "./mock-runtime",
]);
let forbiddenCalls = 0;

function load(name) {
  if (cache.has(name)) return cache.get(name).exports;
  const filename = path.join(workspace, `${name}.ts`);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, options).outputText;
  const fixtureModule = { exports: {} };
  cache.set(name, fixtureModule);
  const scopedRequire = (id) => {
    if (forbiddenImports.has(id)) {
      forbiddenCalls++;
      throw new Error(`forbidden_feature_dependency:${id}`);
    }
    if (id.startsWith("./")) return load(id.slice(2).replace(/\.ts$/, ""));
    if (id === "server-only") return {};
    return nativeRequire(id);
  };
  new Function("require", "module", "exports", "__filename", "__dirname", output)(scopedRequire, fixtureModule, fixtureModule.exports, filename, path.dirname(filename));
  return fixtureModule.exports;
}

const catalog = load("catalogs");
const capabilities = load("capabilities");
const features = load("features");
const featureIds = ["output_4k", "video_extension", "actor_replacement", "advanced_shot_tools"];
const unavailableModels = [capabilities.toWorkspaceModelCapability({ id: "legacy", label: "Legacy", modelType: "legacy-video", maxImagesPerRequest: 8 })];
const enabledModels = [{
  id: "explicit-fixture", label: "Explicit fixture", model: "fixture", available: true,
  durations: [6, 10, 15], aspects: ["9:16", "1:1", "16:9"], nativeSpeech: false,
  audioReference: false, firstFrame: false, lastFrame: false, multiReference: true,
  features: { output4k: true, videoExtension: true, actorReplacement: true, advancedShotTools: true },
}];

function task(customerId = "customer-a", sceneId = "process_demo") {
  const input = catalog.defaultTaskInput(sceneId);
  if (sceneId === "presenter_showcase") input.actorId = "actor-current";
  return {
    taskId: "task-a", siteId: "site_aidreamcapes", customerId, sceneId, title: "Contract fixture",
    status: "storyboard_ready", createdAt: new Date(0).toISOString(), updatedAt: new Date(0).toISOString(), revision: 1,
    input, storyboard: { shots: [{ shotId: "shot-1", duration: 10 }] }, storyboardStale: false,
    storyboardHistory: [], revisions: [], videoHistory: [],
  };
}

function request(feature) {
  if (feature === "output_4k") return { feature, shotId: "shot-1", resolution: "4k" };
  if (feature === "video_extension") return { feature, shotId: "shot-1", extendBySeconds: 5 };
  if (feature === "actor_replacement") return { feature, shotId: "shot-1", replacementActorId: "actor-next" };
  return { feature, shotId: "shot-1", controls: { cameraMotion: "dolly_in", motionStrength: 0.5 } };
}

function codeOf(fn) {
  try { fn(); } catch (error) { return error.code; }
  throw new Error("expected_workspace_error");
}

for (const feature of featureIds) {
  assert.deepEqual(unavailableModels[0].features, { output4k: false, videoExtension: false, actorReplacement: false, advancedShotTools: false });
  assert.equal(features.workspaceFeatureCapabilityError(feature, unavailableModels), features.workspaceFeatureUnavailableError(feature));
  const body = request(feature);
  const target = task("customer-a", feature === "actor_replacement" ? "presenter_showcase" : "process_demo");
  const actors = feature === "actor_replacement" ? [{ actorId: "actor-current" }, { actorId: "actor-next" }] : [];
  assert.equal(codeOf(() => features.queueWorkspaceFeatureJob({ task: target, customerId: "customer-a", body, revision: 1, models: unavailableModels, actors })), features.workspaceFeatureUnavailableError(feature));
  assert.equal(target.featureJobs, undefined, "Unavailable capability requests cannot create jobs");
}

const invalidTask = task();
assert.equal(codeOf(() => features.parseWorkspaceFeatureRequest(invalidTask, { feature: "output_4k", shotId: "shot-1", resolution: "8k" })), "workspace_output_4k_request_invalid");
assert.equal(codeOf(() => features.parseWorkspaceFeatureRequest(invalidTask, { feature: "video_extension", shotId: "shot-1", extendBySeconds: 21 })), "workspace_video_extension_request_invalid");
assert.equal(codeOf(() => features.parseWorkspaceFeatureRequest(invalidTask, { feature: "advanced_shot_tools", shotId: "shot-1", controls: { lens: "fisheye" } })), "workspace_advanced_shot_tools_invalid");
assert.equal(codeOf(() => features.parseWorkspaceFeatureRequest(invalidTask, { feature: "output_4k", shotId: "shot-1", resolution: "4k", ignored: true })), "workspace_feature_request_invalid");
const actorTask = task("customer-a", "presenter_showcase");
assert.equal(codeOf(() => features.parseWorkspaceFeatureRequest(actorTask, request("actor_replacement"), [{ actorId: "actor-current" }])), "workspace_actor_selection_required");

for (const feature of featureIds) {
  const target = task();
  if (feature === "actor_replacement") target.sceneId = "presenter_showcase";
  const actors = feature === "actor_replacement" ? [{ actorId: "actor-current" }, { actorId: "actor-next" }] : [];
  const body = request(feature);
  const job = features.queueWorkspaceFeatureJob({ task: target, customerId: "customer-a", body, revision: 1, models: enabledModels, actors, idempotencyKey: `idem-${feature}` });
  assert.equal(job.feature, feature);
  assert.equal(job.status, "queued");
  assert.equal(job.customerId, "customer-a");
  assert.equal("result" in job, false, "Feature jobs never claim a generated result");
  assert.equal(target.revisions.at(-1).field, "feature_job");
  target.revision++;
  assert.equal(features.getWorkspaceFeatureJob(target, "customer-a", job.jobId), job);
  assert.equal(features.queueWorkspaceFeatureJob({ task: target, customerId: "customer-a", body, revision: 1, models: enabledModels, actors, idempotencyKey: `idem-${feature}` }), job, "Idempotent retries return the existing job");
  assert.equal(codeOf(() => features.getWorkspaceFeatureJob(target, "customer-b", job.jobId)), "task_not_found");
  assert.equal(codeOf(() => features.queueWorkspaceFeatureJob({ task: target, customerId: "customer-b", body, revision: target.revision, models: enabledModels, actors })), "task_not_found");
  assert.equal(codeOf(() => features.cancelWorkspaceFeatureJob({ task: target, customerId: "customer-a", jobId: job.jobId, revision: target.revision - 1 })), "revision_conflict");
  const cancelled = features.cancelWorkspaceFeatureJob({ task: target, customerId: "customer-a", jobId: job.jobId, revision: target.revision });
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.error, "workspace_feature_job_cancelled");
  assert.equal(target.revisions.at(-1).field, "feature_job_status");
  target.revision++;
  assert.equal(codeOf(() => features.cancelWorkspaceFeatureJob({ task: target, customerId: "customer-a", jobId: job.jobId, revision: target.revision })), "workspace_feature_job_not_cancellable");
}

assert.equal(codeOf(() => features.queueWorkspaceFeatureJob({ task: task(), customerId: "customer-a", body: request("output_4k"), revision: 2, models: enabledModels })), "revision_conflict");
assert.equal(forbiddenCalls, 0, "The feature service must not import provider dispatch, external generation, or ledger modules");
const serviceSource = fs.readFileSync(path.join(workspace, "features.ts"), "utf8");
assert.doesNotMatch(serviceSource, /\b(fetch|submitGenerationJob|dispatchWorkspaceJob|reserveMockCredits|settleMockCredits|refundMockCredits|publish)\s*\(/);
for (const route of [
  "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/features/route.ts",
  "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/features/[jobId]/route.ts",
  "src/app/api/sites/[siteId]/aivideosugc/tasks/[taskId]/features/[jobId]/cancel/route.ts",
]) {
  const source = fs.readFileSync(path.join(root, route), "utf8");
  assert.doesNotMatch(source, /\b(fetch|submitGenerationJob|dispatchWorkspaceJob|reserveMockCredits|settleMockCredits|refundMockCredits|publish)\s*\(/, `${route} must not call external, provider, ledger, or publishing operations`);
}

console.log("PASS: Aidreamcapes feature contracts cover disabled legacy rows, explicit enabled/disabled fixtures, strict validation, owner-scoped queue/read/cancel, revisions, idempotency, no generated output, and zero provider/external/ledger call paths.");
