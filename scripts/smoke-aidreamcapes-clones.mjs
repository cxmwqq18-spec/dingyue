import assert from "node:assert/strict";
import fs from "node:fs";
import Module from "node:module";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const helperPath = path.join(root, "src/lib/aidreamcapes-workspace/clones.ts");
const helperSource = fs.readFileSync(helperPath, "utf8");
const compiled = ts.transpileModule(helperSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const helperModule = new Module(helperPath);
helperModule.filename = helperPath;
helperModule.paths = Module._nodeModulePaths(path.dirname(helperPath));
const nativeRequire = helperModule.require.bind(helperModule);
helperModule.require = (specifier) => {
  if (specifier === "server-only") return {};
  if (specifier === "@/lib/prisma") return { prisma: {} };
  if (specifier === "@/lib/stores/asset-store") return { getCustomerAssetsRelational: async () => ({ assets: [] }), toThemeRuntimeAssetRelational: () => ({ previewUrl: "" }) };
  if (specifier === "./asset-contracts") return { workspaceAssetHasMedia: () => true };
  if (specifier === "./store") return { assertWorkspaceSite() {}, getTask: async () => ({}) };
  if (specifier === "./clone-runtime") return { fixtureCloneOutput: (operation, sourceAssetId) => operation === "voice_twin" ? { sourceAssetId, voiceId: `mock:aidreamcapes:clone:${sourceAssetId}:v1` } : { sourceAssetId, analysis: { synthetic: true } } };
  if (specifier === "./types") return {
    AIVIDEOSUGC_SITE_ID: "site_aidreamcapes",
    WorkspaceError: class WorkspaceError extends Error { constructor(code, status = 400) { super(code); this.code = code; this.status = status; } },
  };
  return nativeRequire(specifier);
};
helperModule._compile(compiled, helperPath);
const {
  assertCustomVoiceActor,
  assertOwnedCloneAsset,
  cloneCapabilities,
  cloneRequestHash,
  makeMockCloneResult,
  replayCloneIdempotentJob,
  requireCloneConsent,
  transitionCloneJob,
} = helperModule.exports;

function expectCode(run, code) {
  assert.throws(run, (error) => error?.code === code, `expected ${code}`);
}

expectCode(() => requireCloneConsent(null, "voice_twin"), "clone_consent_required");
const grantedConsent = {
  id: "consent-1", siteId: "site_aidreamcapes", customerId: "customer-a", workflow: "voice_twin",
  sourceType: "customer_asset", sourceAssetId: "asset-a", actorId: null, taskId: null, scope: "voice_twin",
  rightsConfirmed: true, revision: 1, status: "granted", grantedAt: "2026-10-14T00:00:00.000Z",
  expiresAt: null, revokedAt: null, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
};
expectCode(() => requireCloneConsent({ ...grantedConsent, status: "revoked", revokedAt: "2026-10-14T01:00:00.000Z" }, "voice_twin"), "clone_consent_revoked");
expectCode(() => requireCloneConsent({ ...grantedConsent, expiresAt: "2026-10-14T00:00:01.000Z" }, "voice_twin", Date.parse("2026-10-14T00:00:02.000Z")), "clone_consent_expired");
expectCode(() => requireCloneConsent({ ...grantedConsent, expiresAt: "invalid-date" }, "voice_twin"), "clone_consent_expired");
expectCode(() => requireCloneConsent({ ...grantedConsent, rightsConfirmed: false }, "voice_twin"), "clone_rights_confirmation_required");
expectCode(() => requireCloneConsent(grantedConsent, "ad_reference"), "clone_consent_scope_mismatch");
assert.equal(requireCloneConsent(grantedConsent, "voice_twin", Date.parse("2026-10-14T00:00:01.000Z")).id, "consent-1");

expectCode(() => assertOwnedCloneAsset({ id: "asset-x", siteId: "site_aidreamcapes", customerId: "customer-b", storageKey: "key", mimeType: "audio/wav", role: "input" }, {
  siteId: "site_aidreamcapes", customerId: "customer-a", workflow: "voice_twin",
}), "clone_source_asset_not_owned");
expectCode(() => assertCustomVoiceActor("builtin-presenter-1", {}, {
  siteId: "site_aidreamcapes", customerId: "customer-a", rowSiteId: "site_aidreamcapes", rowCustomerId: "customer-a",
}), "clone_custom_actor_required");
expectCode(() => assertCustomVoiceActor("custom-actor-a", {}, {
  siteId: "site_aidreamcapes", customerId: "customer-a", rowSiteId: "site_aidreamcapes", rowCustomerId: "customer-b",
}), "clone_custom_actor_required");
assert.doesNotThrow(() => assertCustomVoiceActor("custom-actor-a", { actorId: "custom-actor-a" }, {
  siteId: "site_aidreamcapes", customerId: "customer-a", rowSiteId: "site_aidreamcapes", rowCustomerId: "customer-a",
}));

const queuedJob = {
  id: "job-1", siteId: "site_aidreamcapes", customerId: "customer-a", workflow: "ad_reference",
  sourceType: "customer_asset", sourceAssetId: "asset-ad", actorId: null, taskId: "task-a", consentId: "consent-ad",
  consentRevision: 1, idempotencyKey: "key-a", requestHash: "a".repeat(64), status: "queued", revision: 1,
  capabilityState: "mock_only", result: null, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
  queuedAt: "2026-10-14T00:00:00.000Z", completedAt: null, cancelledAt: null, deletedAt: null,
};
const completed = transitionCloneJob(queuedJob, "run_mock", "2026-10-14T01:00:00.000Z");
assert.equal(completed.status, "mock_complete");
assert.equal(completed.revision, 2);
assert.equal(completed.result.adapter, makeMockCloneResult("ad_reference", "asset-ad").adapter);
assert.equal(completed.result.provenance.jobId, queuedJob.id);
assert.equal(completed.result.analysis.synthetic, true);
assert.equal(completed.result.productionReady, false);
assert.equal(completed.result.remoteFetch, false);
assert.deepEqual(makeMockCloneResult("voice_twin", "asset-voice"), {
  adapter: "voice_twin_mock_trainer", capabilityState: "mock_only", productionReady: false,
  sourceAssetId: "asset-voice", output: null, mediaRead: false, note: "No audio was read or transformed.",
});
const cancelled = transitionCloneJob(queuedJob, "cancel", "2026-10-14T01:00:00.000Z");
assert.equal(cancelled.status, "cancelled");
const deleted = transitionCloneJob(completed, "delete", "2026-10-14T02:00:00.000Z");
assert.equal(deleted.status, "deleted");
assert.equal(deleted.sourceAssetId, "asset-ad");
assert.equal(deleted.taskId, "task-a");
assert.equal(deleted.consentId, "consent-ad");
assert.deepEqual(deleted.result, completed.result, "soft delete retains source/task/result audit");
const idempotentRequest = { workflow: "ad_reference", consentId: "consent-ad", consentRevision: 1, taskId: "task-a", sourceAssetId: "asset-ad", actorId: null };
assert.equal(cloneRequestHash(idempotentRequest), cloneRequestHash({ ...idempotentRequest }));
assert.notEqual(cloneRequestHash(idempotentRequest), cloneRequestHash({ ...idempotentRequest, taskId: "task-b" }));
assert.equal(replayCloneIdempotentJob({ ...queuedJob, requestHash: cloneRequestHash(idempotentRequest) }, cloneRequestHash(idempotentRequest)).created, false);
expectCode(() => replayCloneIdempotentJob(queuedJob, "b".repeat(64)), "idempotency_conflict");
assert.equal(cloneCapabilities().productionReady, false);
assert.equal(cloneCapabilities().externalRequests, false);
assert.equal(cloneCapabilities().billing, false);

const routeRoot = path.join(root, "src/app/api/sites/[siteId]/aivideosugc/clones");
const migration = fs.readFileSync(path.join(root, "prisma/migrations/20261014170000_add_aidreamcapes_clone_consent_jobs/migration.sql"), "utf8");
assert.equal((migration.match(/CHECK \("siteId" = 'site_aidreamcapes'\)/g) ?? []).length, 2, "both tables are constrained to Aidreamcapes");
assert.match(migration, /"customerId"\) REFERENCES "Customer"\("id"\)/);
assert.match(migration, /"customerId" = NEW\."customerId"/);
const routeFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.name.endsWith(".ts")) routeFiles.push(fullPath);
  }
};
walk(routeRoot);
assert.ok(routeFiles.length >= 8, "clone capability, consent, queue, status, cancel and mock routes exist");
for (const route of routeFiles) assert.match(fs.readFileSync(route, "utf8"), /workspaceAuth\(request, siteId/);
for (const route of routeFiles) assert.doesNotMatch(fs.readFileSync(route, "utf8"), /\b(fetch|axios|undici|http\.request|https\.request)\s*\(/i);
assert.doesNotMatch(helperSource, /\b(fetch|axios|undici|http\.request|https\.request)\s*\(/i);
assert.doesNotMatch(helperSource, /from ["'][^"']*(provider|billing|charge|credit)[^"']*["']/i);
assert.match(helperSource, /"siteId" = \$\{AIVIDEOSUGC_SITE_ID\} AND "customerId" = \$\{customerId\}/);

console.log("Aidreamcapes clone consent, ownership, mock lifecycle, audit retention, and zero external-call checks passed.");
