import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import ts from "typescript";

const root = process.cwd();
class WorkspaceError extends Error { constructor(code, status = 400, details) { super(code); Object.assign(this, { code, status, details }); } }
let networkCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { networkCalls++; throw new Error("NETWORK_FORBIDDEN"); };
const modules = new Map();
let missing = false, serviceError = false, allowAuth = true, assetOwner = "owner", queries = [], taskWrites = 0, actorWrites = 0;
const now = "2026-10-15T00:00:00.000Z";
const consent = { id: "consent", siteId: "site_aidreamcapes", customerId: "owner", workflow: "ad_reference", scope: "ad_reference", sourceType: "customer_asset", sourceAssetId: "source", actorId: null, taskId: null, status: "granted", rightsConfirmed: true, revision: 1, expiresAt: null, revokedAt: null, grantedAt: now, createdAt: now, updatedAt: now };
const job = { id: "job", ...consent, consentId: "consent", consentRevision: 1, idempotencyKey: "old", requestHash: "x", status: "queued", capabilityState: "mock_only", revision: 1, result: null, queuedAt: now, completedAt: null, cancelledAt: null, deletedAt: null };
job.id = "job";
let task = { taskId: "draft", siteId: "site_aidreamcapes", customerId: "owner", status: "draft", revision: 1, productBrief: { userConfirmed: true, confirmedAt: now, title: { value: "My product", userConfirmed: true }, description: null, possiblePrice: null }, input: { fields: {} } };
let actor = { actorId: "custom-person", voice: { voiceId: "old", refAudio: "private-source" }, name: "Private person" };
const owner = "owner";
const prisma = {
  async $queryRaw(strings, ...values) {
    const sql = strings.join("?"); queries.push({ sql, values });
    if (sql.includes("to_regclass")) { if (serviceError) throw new Error("offline"); return [{ consent: missing ? null : "AidreamcapesCloneConsent", job: missing ? null : "AidreamcapesCloneJob", requiresTask: false }]; }
    assert.ok(values.includes("site_aidreamcapes"), `site predicate missing: ${sql}`);
    assert.ok(values.includes(owner) || values.includes("intruder"), `owner predicate missing: ${sql}`);
    if (values.includes("intruder")) return [];
    if (sql.includes("FOR UPDATE OF j, c")) return consent.status === "granted" && consent.revision === job.consentRevision && job.status === "mock_complete" ? [job] : [];
    if (sql.startsWith('UPDATE "AidreamcapesVideoTask"')) { task = JSON.parse(values[0]); taskWrites++; return [{ data: task }]; }
    if (sql.includes('FROM "AssetUpload"')) return [{ id: "source", siteId: "site_aidreamcapes", customerId: assetOwner, storageKey: `sites/site_aidreamcapes/customers/${assetOwner}/assets/source.${job.workflow === "voice_twin" ? "wav" : "mp4"}`, mimeType: job.workflow === "voice_twin" ? "audio/wav" : "video/mp4", role: "input", deletedAt: null }];
    if (sql.includes('FROM "AidreamcapesVideoTask"')) {
      if (sql.includes('ANY(')) return task.sourceAnalysis ? [{ id: task.taskId, jobId: task.sourceAnalysis.referenceAnalysisId }] : [];
      return [];
    }
    if (sql.includes('FROM "AidreamcapesWorkspaceActor"')) return [{ data: actor, siteId: "site_aidreamcapes", customerId: owner }];
    if (sql.includes('FROM "AidreamcapesCloneConsent"')) return [consent];
    if (sql.startsWith('INSERT INTO "AidreamcapesCloneJob"')) { const next = { ...job, id: values[0], status: "queued", revision: 1, idempotencyKey: values[10], requestHash: values[11] }; return [next]; }
    if (sql.startsWith('UPDATE "AidreamcapesCloneJob"')) { Object.assign(job, { status: values[0], revision: job.revision + 1, result: values[1] ? JSON.parse(values[1]) : null, completedAt: values[2], cancelledAt: values[3], deletedAt: values[4] }); return [job]; }
    if (sql.includes('FROM "AidreamcapesCloneJob"')) { if (sql.includes('"idempotencyKey"')) return values.includes(job.idempotencyKey) ? [job] : []; return [job]; }
    throw new Error(`Unexpected SQL ${sql}`);
  },
  async $executeRaw(strings, ...values) { assert.match(strings.join("?"), /UPDATE "AidreamcapesWorkspaceActor"/); assert.ok(values.includes(owner)); actor = JSON.parse(values[0]); actorWrites++; return 1; },
  async $transaction(run) { return run(prisma); },
};
function load(file) {
  const absolute = path.resolve(root, file);
  if (modules.has(absolute)) return modules.get(absolute).exports;
  const mod = new Module(absolute); mod.filename = absolute; mod.paths = Module._nodeModulePaths(path.dirname(absolute)); modules.set(absolute, mod);
  const native = mod.require.bind(mod);
  mod.require = specifier => {
    if (specifier === "server-only") return {};
    if (specifier === "@/lib/prisma") return { prisma };
    if (specifier.endsWith("/auth")) return { workspaceAuth: async () => allowAuth ? { ok: true, current: { customer: { id: owner } } } : { ok: false, response: { status: 401 } } };
    if (specifier.endsWith("/api")) return { workspaceResponse: value => value, workspaceFailure: error => ({ status: error.status, error: error.code }), jsonBody: async req => req.body, expectedRevision: req => Number(req.headers.get("if-match")) };
    if (specifier === "@/lib/stores/asset-store") return { getCustomerAssetsRelational: async () => ({ assets: [{ id: "source", siteId: "site_aidreamcapes", customerId: assetOwner, storageKey: `sites/site_aidreamcapes/customers/${assetOwner}/assets/source.${job.workflow === "voice_twin" ? "wav" : "mp4"}`, mimeType: job.workflow === "voice_twin" ? "audio/wav" : "video/mp4", role: "input" }] }), toThemeRuntimeAssetRelational: () => ({ previewUrl: "private-source" }) };
    if (specifier === "./store") return { assertWorkspaceSite: siteId => { if (siteId !== "site_aidreamcapes") throw new WorkspaceError("workspace_site_not_found", 404); }, getTask: async (_site, customer) => { if (customer !== owner) throw new WorkspaceError("task_not_found", 404); return structuredClone(task); } };
    if (specifier === "./types") return { WorkspaceError, AIVIDEOSUGC_SITE_ID: "site_aidreamcapes" };
    if (specifier.startsWith("@/")) return load(`src/${specifier.slice(2)}.ts`);
    if (specifier.startsWith(".")) return load(path.resolve(path.dirname(absolute), `${specifier}.ts`));
    if (/provider|billing|credit|charge|axios|undici/.test(specifier)) throw new Error(`Forbidden dependency ${specifier}`);
    return native(specifier);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, absolute);
  return mod.exports;
}
const clones = load("src/lib/aidreamcapes-workspace/clones.ts");
const runtime = load("src/lib/aidreamcapes-workspace/clone-runtime.ts");
const { CloneProviderAdapterError } = load("src/lib/aidreamcapes-workspace/clone-contract.ts");
const rejects = (run, code) => assert.rejects(run, error => error.code === code, code);
try {
  missing = true;
  assert.equal((await clones.getCloneCapabilities()).components.database.state, "missing_schema");
  await rejects(() => clones.listCloneJobs("site_aidreamcapes", owner), "clone_schema_required");
  missing = false; serviceError = true;
  assert.equal((await clones.getCloneCapabilities()).components.database.state, "service_error");
  serviceError = false;
  const caps = await clones.getCloneCapabilities();
  assert.equal(caps.components.database.available, true); assert.equal(caps.analysisBeforeTask, true);
  for (const [name, capability] of Object.entries(caps.components)) if (name !== "database") assert.equal(capability.available, false);
  await rejects(() => clones.getCloneJob("site_dreamshoot", owner, "job"), "workspace_site_not_found");
  await rejects(() => clones.getCloneJob("site_aidreamcapes", "intruder", "job"), "clone_job_not_found");
  const queued = await clones.queueCloneJob("site_aidreamcapes", owner, "ad_reference", { consentId: "consent", consentRevision: 1, idempotencyKey: "new" });
  assert.equal(queued.job.taskId, null, "analysis may precede a task");
  job.requestHash = clones.cloneRequestHash({ workflow: job.workflow, consentId: "consent", consentRevision: 1, taskId: null, sourceAssetId: "source", actorId: null });
  assert.equal((await clones.queueCloneJob("site_aidreamcapes", owner, "ad_reference", { consentId: "consent", consentRevision: 1, idempotencyKey: "old" })).created, false);
  await rejects(() => clones.runCloneJobMock("site_aidreamcapes", owner, "job", 7), "revision_conflict");
  assetOwner = "intruder";
  await rejects(() => clones.runCloneJobMock("site_aidreamcapes", owner, "job", 1), "clone_source_asset_not_owned");
  assetOwner = owner;
  await clones.runCloneJobMock("site_aidreamcapes", owner, "job", 1);
  const reloaded = await clones.getCloneJob("site_aidreamcapes", owner, "job");
  assert.equal(reloaded.result.analysis.synthetic, true); assert.deepEqual(reloaded.result.analysis.transcript, []);
  assert.equal(reloaded.result.provenance.consentId, "consent"); assert.equal(reloaded.result.output, null);
  const brief = structuredClone(task.productBrief);
  const attach = { mockMode: true, taskId: "draft", taskRevision: 1, confirmedProductFacts: true, analysisRevision: 1, segments: [{ start: 0, end: 8, role: "hook", visual: "My reviewed structure" }] };
  await rejects(() => clones.attachCloneJobDraft("site_aidreamcapes", owner, "job", 2, { ...attach, mockMode: false }), "clone_explicit_mock_required");
  await rejects(() => clones.attachCloneJobDraft("site_aidreamcapes", owner, "job", 2, { ...attach, segments: [{ start: 4, end: 2, role: "hook", visual: "bad" }] }), "clone_analysis_segments_invalid");
  const attached = await clones.attachCloneJobDraft("site_aidreamcapes", owner, "job", 2, attach);
  assert.deepEqual(attached.task.productBrief, brief); assert.equal(attached.sourceAnalysis.referenceAnalysisId, "job");
  assert.equal(attached.sourceAnalysis.userEdited, true); assert.equal(taskWrites, 1);
  assert.equal(attached.job.attachedTaskId, "draft");
  assert.equal((await clones.getCloneJob("site_aidreamcapes", owner, "job")).attachedTaskId, "draft", "saved association reloads without changing immutable job taskId");
  consent.status = "revoked";
  await rejects(() => clones.attachCloneJobDraft("site_aidreamcapes", owner, "job", 2, { ...attach, taskRevision: 2 }), "clone_consent_revoked");
  await rejects(() => clones.retryCloneJob("site_aidreamcapes", owner, "job", 2, { mockMode: true, idempotencyKey: "retry" }), "clone_consent_revoked");
  consent.status = "granted";
  await clones.retryCloneJob("site_aidreamcapes", owner, "job", 2, { mockMode: true, idempotencyKey: "retry" });
  job.workflow = consent.workflow = consent.scope = "voice_twin";
  job.status = "queued"; job.revision = 1; job.completedAt = null;
  await clones.runCloneJobMock("site_aidreamcapes", owner, "job", 1);
  const bound = await clones.bindCloneJobActor("site_aidreamcapes", owner, "job", 2, { mockMode: true, actorId: "custom-person" });
  assert.match(bound.voice.voiceId, /^mock:aidreamcapes:clone:/); assert.equal(bound.cloneBinding.productionReady, false); assert.equal(actorWrites, 1);
  await rejects(() => clones.bindCloneJobActor("site_aidreamcapes", owner, "job", 2, { mockMode: true, actorId: "builtin-actor" }), "clone_custom_actor_required");
  let allowed = true, submits = 0, polls = 0, cancels = 0;
  const authorize = async () => { if (!allowed) throw new WorkspaceError("clone_consent_revoked", 403); };
  const request = { siteId: "site_aidreamcapes", customerId: owner, jobId: "job", sourceAssetId: "source", consentId: "consent", consentRevision: 1, operation: "voice_twin", idempotencyKey: "fixture" };
  const adapter = { id: "fixture", mode: "fixture", capabilities: { voice_twin: true, ad_reference: true, proven: false }, submit: async () => { submits++; return { providerJobId: "upstream" }; }, poll: async () => { polls++; return { providerJobId: "upstream", sequence: 1, state: "succeeded", result: runtime.fixtureCloneOutput("voice_twin", "source") }; }, cancel: async () => { cancels++; }, verifyCallback: async () => { throw new WorkspaceError("clone_callback_unauthorized", 403); }, readResult: async () => runtime.fixtureCloneOutput("voice_twin", "source") };
  let execution = await runtime.submitCloneExecution(adapter, request, authorize, 0);
  assert.equal(execution.mode, "fixture");
  await rejects(() => runtime.submitCloneExecution({ ...adapter, mode: "real" }, request, authorize), "clone_provider_unavailable");
  await rejects(() => runtime.applyCloneEvent(execution, { providerJobId: "other", sequence: 1, state: "succeeded" }, 1, authorize), "clone_callback_job_mismatch");
  await rejects(() => runtime.applyCloneEvent(execution, { providerJobId: "upstream", sequence: 1, state: "succeeded", result: { sourceAssetId: "other" } }, 1, authorize, 1), "clone_provider_result_invalid");
  allowed = false;
  await rejects(() => runtime.pollCloneExecution(adapter, execution, authorize, 1), "clone_consent_revoked"); assert.equal(polls, 0);
  allowed = true;
  execution = await runtime.pollCloneExecution(adapter, execution, authorize, 1);
  assert.equal(execution.state, "succeeded"); assert.equal(execution.revision, 2);
  assert.deepEqual(await runtime.applyCloneEvent(execution, { providerJobId: "upstream", sequence: 1, state: "running" }, 2, authorize, 2), execution, "duplicate/out of order callback does not revive terminal execution");
  await rejects(() => runtime.applyCloneEvent(execution, { providerJobId: "upstream", sequence: 2, state: "running" }, 1, authorize), "revision_conflict");
  await rejects(() => runtime.receiveCloneCallback(adapter, execution, {}, "invalid", execution.revision, authorize, 1), "clone_callback_unauthorized");
  const running = await runtime.submitCloneExecution(adapter, request, authorize, 0);
  for (const failure of ["rate_limited", "upstream_unavailable", "invalid_media"]) {
    const failed = await runtime.pollCloneExecution({ ...adapter, poll: async () => { throw new CloneProviderAdapterError(failure); } }, running, authorize, 1);
    assert.equal(failed.state, "failed"); assert.equal(failed.failure, failure);
  }
  const readResult = await runtime.pollCloneExecution({ ...adapter, poll: async () => ({ providerJobId: "upstream", sequence: 1, state: "succeeded" }) }, running, authorize, 1);
  assert.equal(readResult.result.sourceAssetId, "source");
  const adExecution = { ...running, request: { ...request, operation: "ad_reference" } };
  const fixtureAnalysis = runtime.fixtureCloneOutput("ad_reference", "source");
  runtime.validateCloneProviderOutput(adExecution, fixtureAnalysis);
  assert.throws(() => runtime.validateCloneProviderOutput(adExecution, { ...fixtureAnalysis, analysis: { ...fixtureAnalysis.analysis, productFacts: ["unsupported claim"] } }), error => error.code === "clone_provider_result_invalid");
  assert.throws(() => runtime.validateCloneProviderOutput(adExecution, { ...fixtureAnalysis, analysis: { ...fixtureAnalysis.analysis, transcript: [{ start: 0, end: 1, text: "fabricated transcription" }] } }), error => error.code === "clone_provider_result_invalid");
  const timedOut = await runtime.pollCloneExecution(adapter, running, authorize, 300_001); assert.equal(timedOut.failure, "timeout");
  const cancelled = await runtime.cancelCloneExecution(adapter, running);
  assert.equal((await runtime.applyCloneEvent(cancelled, { providerJobId: "upstream", sequence: 5, state: "succeeded", result: runtime.fixtureCloneOutput("voice_twin", "source") }, cancelled.revision, authorize, 1)).state, "cancelled");
  assert.equal(cancels, 2); assert.equal(submits, 2);
  const routes = ["route.ts", "jobs/route.ts", "consents/route.ts", "voice-twins/queue/route.ts", "ad-references/queue/route.ts", "jobs/[jobId]/run-mock/route.ts", "jobs/[jobId]/cancel/route.ts", "jobs/[jobId]/retry/route.ts", "jobs/[jobId]/bind-actor/route.ts", "jobs/[jobId]/attach-draft/route.ts"];
  allowAuth = false;
  for (const route of routes) {
    const module = load(`src/app/api/sites/[siteId]/aivideosugc/clones/${route}`);
    const response = await (module.POST ?? module.GET)({ headers: new Headers({ "if-match": "2" }), body: {} }, { params: Promise.resolve({ siteId: "site_aidreamcapes", jobId: "job" }) });
    assert.equal(response.status, 401, route);
  }
  assert.equal(networkCalls, 0);
  console.log(`PASS clone runtime: schema diagnostics; taskless analysis; auth/owner/site; queue replay; mock save/reload; actor binding; edited draft provenance/fact separation; revocation/retries; callback ordering/revision/timeout/cancel; ${routes.length} unauthorized routes; zero network/real-provider/credit calls.`);
} finally { globalThis.fetch = originalFetch; }
