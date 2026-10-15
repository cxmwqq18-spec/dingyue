import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getCustomerAssetsRelational, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { assertWorkspaceSite, getTask } from "./store";
import { fixtureCloneOutput } from "./clone-runtime";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type ActorAsset, type WorkspaceTask } from "./types";

export type CloneWorkflow = "voice_twin" | "ad_reference";
export type CloneStatus = "queued" | "mock_complete" | "cancelled" | "deleted";
export type CloneSourceType = "customer_asset" | "custom_actor";

export type CloneConsent = {
  id: string; siteId: string; customerId: string; workflow: CloneWorkflow; sourceType: CloneSourceType;
  sourceAssetId: string; actorId: string | null; taskId: string | null; scope: CloneWorkflow;
  rightsConfirmed: boolean; revision: number; status: "granted" | "revoked";
  grantedAt: string; expiresAt: string | null; revokedAt: string | null; createdAt: string; updatedAt: string;
};
export type CloneJob = {
  id: string; siteId: string; customerId: string; workflow: CloneWorkflow; sourceType: CloneSourceType;
  sourceAssetId: string; actorId: string | null; taskId: string | null; consentId: string; consentRevision: number;
  idempotencyKey: string; requestHash: string; status: CloneStatus; revision: number;
  attachedTaskId?: string | null;
  capabilityState: "mock_only"; result: Record<string, unknown> | null;
  createdAt: string; updatedAt: string; queuedAt: string; completedAt: string | null;
  cancelledAt: string | null; deletedAt: string | null;
};

type AssetRow = {
  id: string; siteId: string; customerId: string; storageKey: string; mimeType: string;
  role: string; subjectRole?: string | null; deletedAt?: unknown;
};
type ConsentRow = Omit<CloneConsent, "grantedAt" | "expiresAt" | "revokedAt" | "createdAt" | "updatedAt"> & {
  grantedAt: Date | string; expiresAt: Date | string | null; revokedAt: Date | string | null;
  createdAt: Date | string; updatedAt: Date | string;
};
type JobRow = Omit<CloneJob, "createdAt" | "updatedAt" | "queuedAt" | "completedAt" | "cancelledAt" | "deletedAt"> & {
  createdAt: Date | string; updatedAt: Date | string; queuedAt: Date | string;
  completedAt: Date | string | null; cancelledAt: Date | string | null; deletedAt: Date | string | null;
};
const VOICE_SOURCE_EXTENSIONS: Record<string, readonly string[]> = {
  "audio/mpeg": [".mp3"], "audio/mp4": [".m4a", ".mp4"], "audio/wav": [".wav"], "audio/x-wav": [".wav"],
  "audio/ogg": [".ogg"], "audio/webm": [".webm"], "audio/aac": [".aac"], "audio/flac": [".flac"],
};

function assetHasSafeOwnerPath(asset: AssetRow, siteId: string, customerId: string): boolean {
  const key = asset.storageKey.replace(/^customer-assets\//, "");
  const prefix = `sites/${siteId}/customers/${customerId}/assets/`;
  const filename = key.startsWith(prefix) ? key.slice(prefix.length) : "";
  return Boolean(filename) && !filename.includes("/") && filename !== "." && filename !== ".." &&
    !key.includes("\\") && !/[%\u0000-\u001f\u007f]/.test(key);
}
function isOwnedVoiceSource(asset: AssetRow, siteId: string, customerId: string): boolean {
  if (asset.siteId !== siteId || asset.customerId !== customerId || asset.deletedAt || !["input", "training_input"].includes(asset.role)) return false;
  const mime = asset.mimeType.toLowerCase().split(";")[0].trim();
  const extension = asset.storageKey.toLowerCase().slice(asset.storageKey.lastIndexOf("."));
  return assetHasSafeOwnerPath(asset, siteId, customerId) && Boolean(VOICE_SOURCE_EXTENSIONS[mime]?.includes(extension));
}

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
function consentView(row: ConsentRow): CloneConsent {
  return { ...row, grantedAt: iso(row.grantedAt)!, expiresAt: iso(row.expiresAt), revokedAt: iso(row.revokedAt), createdAt: iso(row.createdAt)!, updatedAt: iso(row.updatedAt)! };
}
function jobView(row: JobRow): CloneJob {
  return { ...row, createdAt: iso(row.createdAt)!, updatedAt: iso(row.updatedAt)!, queuedAt: iso(row.queuedAt)!, completedAt: iso(row.completedAt), cancelledAt: iso(row.cancelledAt), deletedAt: iso(row.deletedAt) };
}
function assertWritable() {
  if ([process.env.DATABASE_TARGET, process.env.DINGYUE_ENV].some(value => value?.trim().toLowerCase() === "remote-readonly")) {
    throw new WorkspaceError("workspace_database_readonly", 403);
  }
}
function validId(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,180}$/.test(value)) throw new WorkspaceError(code);
}
function validWorkflow(value: unknown): asserts value is CloneWorkflow {
  if (value !== "voice_twin" && value !== "ad_reference") throw new WorkspaceError("clone_workflow_invalid");
}
function validExpiry(value: unknown): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new WorkspaceError("clone_consent_expiry_invalid");
  const expiresAt = new Date(value);
  const now = Date.now();
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= now || expiresAt.getTime() > now + 366 * 24 * 60 * 60 * 1000) {
    throw new WorkspaceError("clone_consent_expiry_invalid");
  }
  return expiresAt;
}

export function requireCloneConsent(consent: CloneConsent | null | undefined, workflow: CloneWorkflow, now = Date.now()): CloneConsent {
  if (!consent) throw new WorkspaceError("clone_consent_required", 403);
  if (consent.workflow !== workflow || consent.scope !== workflow) throw new WorkspaceError("clone_consent_scope_mismatch", 403);
  if (consent.status !== "granted" || consent.revokedAt) throw new WorkspaceError("clone_consent_revoked", 403);
  if (!consent.rightsConfirmed) throw new WorkspaceError("clone_rights_confirmation_required", 403);
  if (consent.expiresAt) {
    const expiry = Date.parse(consent.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now) throw new WorkspaceError("clone_consent_expired", 403);
  }
  if (!Number.isSafeInteger(consent.revision) || consent.revision < 1) throw new WorkspaceError("clone_consent_revision_invalid", 409);
  return consent;
}

export function assertOwnedCloneAsset(
  asset: AssetRow,
  expected: { siteId: string; customerId: string; workflow: CloneWorkflow },
): void {
  if (asset.siteId !== expected.siteId || asset.customerId !== expected.customerId || asset.deletedAt) throw new WorkspaceError("clone_source_asset_not_owned", 403);
  if (expected.workflow === "voice_twin") {
    if (!isOwnedVoiceSource(asset, expected.siteId, expected.customerId)) {
      throw new WorkspaceError("clone_voice_source_invalid", 400);
    }
    return;
  }
  const key = asset.storageKey.replace(/^customer-assets\//, "");
  const prefix = `sites/${expected.siteId}/customers/${expected.customerId}/assets/`;
  const filename = key.startsWith(prefix) ? key.slice(prefix.length) : "";
  const mime = asset.mimeType.toLowerCase().split(";")[0].trim();
  if (!filename || filename.includes("/") || filename === "." || filename === ".." || key.includes("\\") ||
      /[%\u0000-\u001f\u007f]/.test(key) || !["input", "output"].includes(asset.role) ||
      mime !== "video/mp4" || !filename.toLowerCase().endsWith(".mp4")) {
    throw new WorkspaceError("clone_ad_reference_source_invalid", 400);
  }
}

export function assertCustomVoiceActor(actorId: string, actor: unknown, expected: { siteId: string; customerId: string; rowSiteId: string; rowCustomerId: string }): void {
  if (!actorId.startsWith("custom-") || actorId.length > 180 || expected.rowSiteId !== expected.siteId || expected.rowCustomerId !== expected.customerId || !actor || typeof actor !== "object") {
    throw new WorkspaceError("clone_custom_actor_required", 403);
  }
  if ((actor as { actorId?: unknown }).actorId !== actorId) throw new WorkspaceError("clone_custom_actor_required", 403);
}

export function makeMockCloneResult(workflow: CloneWorkflow, sourceAssetId: string): Record<string, unknown> {
  return workflow === "voice_twin"
    ? { adapter: "voice_twin_mock_trainer", capabilityState: "mock_only", productionReady: false, sourceAssetId, output: null, mediaRead: false, note: "No audio was read or transformed." }
    : { adapter: "ad_reference_mock_parser", capabilityState: "mock_only", productionReady: false, sourceAssetId, output: null, mediaRead: false, remoteFetch: false, note: "No media was read and no remote ad was fetched." };
}

export function cloneRequestHash(request: {
  workflow: CloneWorkflow; consentId: string; consentRevision: number; taskId: string | null;
  sourceAssetId: string; actorId: string | null;
}): string {
  return createHash("sha256").update(JSON.stringify(request)).digest("hex");
}

export function replayCloneIdempotentJob(existing: CloneJob | null | undefined, requestHash: string): { job: CloneJob; created: false } | null {
  if (!existing) return null;
  if (existing.requestHash !== requestHash) throw new WorkspaceError("idempotency_conflict", 409);
  return { job: existing, created: false };
}

export function transitionCloneJob(job: CloneJob, action: "run_mock" | "cancel" | "delete", now = new Date().toISOString()): CloneJob {
  if (job.status === "deleted") throw new WorkspaceError("clone_job_deleted", 409);
  if (action === "cancel") {
    if (job.status !== "queued") throw new WorkspaceError("clone_job_not_cancellable", 409);
    return { ...job, status: "cancelled", revision: job.revision + 1, cancelledAt: now, updatedAt: now };
  }
  if (action === "run_mock") {
    if (job.status !== "queued") throw new WorkspaceError("clone_job_not_runnable", 409);
    return { ...job, status: "mock_complete", revision: job.revision + 1, completedAt: now, updatedAt: now, result: { ...makeMockCloneResult(job.workflow, job.sourceAssetId), ...fixtureCloneOutput(job.workflow, job.sourceAssetId), provenance: { jobId: job.id, consentId: job.consentId, consentRevision: job.consentRevision, mode: "mock", mediaRead: false } } };
  }
  return { ...job, status: "deleted", revision: job.revision + 1, deletedAt: now, updatedAt: now };
}

async function getOwnedConsent(siteId: string, customerId: string, consentId: string): Promise<CloneConsent | null> {
  assertWorkspaceSite(siteId); await requireCloneSchema(); validId(consentId, "clone_consent_id_invalid");
  const rows = await prisma.$queryRaw<ConsentRow[]>`SELECT * FROM "AidreamcapesCloneConsent" WHERE "id" = ${consentId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}`;
  return rows[0] ? consentView(rows[0]) : null;
}
export async function getCloneConsent(siteId: string, customerId: string, consentId: string): Promise<CloneConsent> {
  const consent = await getOwnedConsent(siteId, customerId, consentId);
  if (!consent) throw new WorkspaceError("clone_consent_not_found", 404);
  return consent;
}
async function getOwnedJob(siteId: string, customerId: string, jobId: string): Promise<CloneJob> {
  assertWorkspaceSite(siteId); await requireCloneSchema(); validId(jobId, "clone_job_id_invalid");
  const rows = await prisma.$queryRaw<JobRow[]>`SELECT * FROM "AidreamcapesCloneJob" WHERE "id" = ${jobId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}`;
  if (!rows[0]) throw new WorkspaceError("clone_job_not_found", 404);
  return jobView(rows[0]);
}
async function getOwnedTask(siteId: string, customerId: string, taskId: string): Promise<WorkspaceTask> {
  validId(taskId, "clone_task_id_invalid");
  return getTask(siteId, customerId, taskId);
}
async function ownedAssets(siteId: string, customerId: string): Promise<AssetRow[]> {
  const { assets } = await getCustomerAssetsRelational({ siteId, customerId });
  return assets.filter(asset => asset.siteId === siteId && asset.customerId === customerId && !asset.deletedAt) as AssetRow[];
}
async function resolveSource(params: {
  siteId: string; customerId: string; workflow: CloneWorkflow; sourceAssetId?: unknown; actorId?: unknown;
}): Promise<{ sourceType: CloneSourceType; sourceAssetId: string; actorId: string | null }> {
  const assets = await ownedAssets(params.siteId, params.customerId);
  if (params.actorId !== undefined && params.actorId !== null && params.actorId !== "") {
    if (params.workflow !== "voice_twin") throw new WorkspaceError("clone_custom_actor_workflow_invalid", 400);
    validId(params.actorId, "clone_actor_id_invalid");
    const actorId = params.actorId;
    const rows = await prisma.$queryRaw<{ data: unknown; siteId: string; customerId: string }[]>`SELECT "data", "siteId", "customerId" FROM "AidreamcapesWorkspaceActor" WHERE "id" = ${actorId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${params.customerId}`;
    if (!rows[0]) throw new WorkspaceError("clone_custom_actor_required", 403);
    assertCustomVoiceActor(actorId, rows[0].data, { siteId: params.siteId, customerId: params.customerId, rowSiteId: rows[0].siteId, rowCustomerId: rows[0].customerId });
    const data = rows[0].data as { voice?: { refAudio?: unknown } };
    const audio = assets.find(asset => isOwnedVoiceSource(asset, params.siteId, params.customerId) &&
      typeof data?.voice?.refAudio === "string" && toThemeRuntimeAssetRelational(asset as unknown as Parameters<typeof toThemeRuntimeAssetRelational>[0]).previewUrl === data.voice.refAudio);
    if (!audio) throw new WorkspaceError("clone_voice_source_not_owned", 403);
    return { sourceType: "custom_actor", sourceAssetId: audio.id, actorId };
  }
  validId(params.sourceAssetId, "clone_source_asset_required");
  const asset = assets.find(item => item.id === params.sourceAssetId);
  if (!asset) throw new WorkspaceError("clone_source_asset_not_owned", 403);
  assertOwnedCloneAsset(asset, { siteId: params.siteId, customerId: params.customerId, workflow: params.workflow });
  return { sourceType: "customer_asset", sourceAssetId: asset.id, actorId: null };
}
async function validateTaskLink(siteId: string, customerId: string, workflow: CloneWorkflow, taskId: unknown): Promise<string | null> {
  if (taskId === undefined || taskId === null || taskId === "") {
    if (workflow === "ad_reference" && !(await cloneSchemaReadiness()).analysisBeforeTask) throw new WorkspaceError("clone_analysis_schema_upgrade_required", 503);
    return null;
  }
  const task = await getOwnedTask(siteId, customerId, String(taskId));
  if (task.siteId !== siteId || task.customerId !== customerId) throw new WorkspaceError("clone_task_not_owned", 403);
  return task.taskId;
}

export async function listCloneConsents(siteId: string, customerId: string): Promise<CloneConsent[]> {
  assertWorkspaceSite(siteId); await requireCloneSchema();
  const rows = await prisma.$queryRaw<ConsentRow[]>`SELECT * FROM "AidreamcapesCloneConsent" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} ORDER BY "createdAt" DESC LIMIT 100`;
  return rows.map(consentView);
}

export async function grantCloneConsent(siteId: string, customerId: string, body: Record<string, unknown>): Promise<CloneConsent> {
  assertWorkspaceSite(siteId); assertWritable(); await requireCloneSchema();
  validWorkflow(body.workflow);
  if (body.scope !== body.workflow) throw new WorkspaceError("clone_consent_scope_mismatch");
  if (body.rightsConfirmed !== true) throw new WorkspaceError("clone_rights_confirmation_required", 403);
  const expiresAt = validExpiry(body.expiresAt);
  const taskId = await validateTaskLink(siteId, customerId, body.workflow, body.taskId);
  const source = await resolveSource({ siteId, customerId, workflow: body.workflow, sourceAssetId: body.sourceAssetId, actorId: body.actorId });
  const id = randomUUID();
  const rows = await prisma.$queryRaw<ConsentRow[]>`INSERT INTO "AidreamcapesCloneConsent" ("id", "siteId", "customerId", "workflow", "sourceType", "sourceAssetId", "actorId", "taskId", "scope", "rightsConfirmed", "revision", "status", "grantedAt", "expiresAt") SELECT ${id}, ${AIVIDEOSUGC_SITE_ID}, ${customerId}, ${body.workflow}, ${source.sourceType}, ${source.sourceAssetId}, ${source.actorId}, ${taskId}, ${body.workflow}, true, 1, 'granted', now(), ${expiresAt} FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} RETURNING *`;
  if (!rows[0]) throw new WorkspaceError("customer_site_mismatch", 403);
  return consentView(rows[0]);
}

export async function revokeCloneConsent(siteId: string, customerId: string, consentId: string, revision: number): Promise<CloneConsent> {
  assertWorkspaceSite(siteId); assertWritable(); await requireCloneSchema();
  if (!Number.isSafeInteger(revision) || revision < 1) throw new WorkspaceError("revision_required", 428);
  const rows = await prisma.$queryRaw<ConsentRow[]>`UPDATE "AidreamcapesCloneConsent" SET "status" = 'revoked', "revokedAt" = now(), "revision" = "revision" + 1, "updatedAt" = now() WHERE "id" = ${consentId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "revision" = ${revision} AND "status" = 'granted' RETURNING *`;
  if (!rows[0]) {
    const existing = await getOwnedConsent(siteId, customerId, consentId);
    if (!existing) throw new WorkspaceError("clone_consent_not_found", 404);
    throw new WorkspaceError("revision_conflict", 409);
  }
  return consentView(rows[0]);
}

export async function queueCloneJob(siteId: string, customerId: string, workflow: CloneWorkflow, body: Record<string, unknown>, headerKey?: string | null): Promise<{ job: CloneJob; created: boolean }> {
  assertWorkspaceSite(siteId); assertWritable(); await requireCloneSchema();
  const consentId = body.consentId;
  validId(consentId, "clone_consent_id_invalid");
  const consent = requireCloneConsent(await getOwnedConsent(siteId, customerId, consentId), workflow);
  if (!Number.isSafeInteger(body.consentRevision) || body.consentRevision !== consent.revision) throw new WorkspaceError("revision_conflict", 409);
  const key = headerKey || body.idempotencyKey;
  if (typeof key !== "string" || !/^[a-zA-Z0-9._:-]{1,128}$/.test(key)) throw new WorkspaceError("idempotency_key_required");
  const taskId = await validateTaskLink(siteId, customerId, workflow, body.taskId ?? consent.taskId);
  if (taskId !== consent.taskId) throw new WorkspaceError("clone_task_link_mismatch", 409);
  const source = await resolveSource({ siteId, customerId, workflow, sourceAssetId: consent.sourceAssetId, actorId: consent.actorId ?? undefined });
  if (source.sourceType !== consent.sourceType || source.sourceAssetId !== consent.sourceAssetId || source.actorId !== consent.actorId) throw new WorkspaceError("clone_consent_source_mismatch", 403);
  const requestHash = cloneRequestHash({ workflow, consentId, consentRevision: consent.revision, taskId, sourceAssetId: source.sourceAssetId, actorId: source.actorId });
  const existing = await prisma.$queryRaw<JobRow[]>`SELECT * FROM "AidreamcapesCloneJob" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "idempotencyKey" = ${key}`;
  if (existing[0]) {
    const job = jobView(existing[0]);
    return replayCloneIdempotentJob(job, requestHash)!;
  }
  const id = randomUUID();
  const rows = await prisma.$queryRaw<JobRow[]>`INSERT INTO "AidreamcapesCloneJob" ("id", "siteId", "customerId", "workflow", "sourceType", "sourceAssetId", "actorId", "taskId", "consentId", "consentRevision", "idempotencyKey", "requestHash", "status", "revision", "capabilityState") SELECT ${id}, ${AIVIDEOSUGC_SITE_ID}, ${customerId}, ${workflow}, ${source.sourceType}, ${source.sourceAssetId}, ${source.actorId}, ${taskId}, ${consent.id}, ${consent.revision}, ${key}, ${requestHash}, 'queued', 1, 'mock_only' FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} ON CONFLICT ("siteId", "customerId", "idempotencyKey") DO NOTHING RETURNING *`;
  if (rows[0]) return { job: jobView(rows[0]), created: true };
  const raced = await prisma.$queryRaw<JobRow[]>`SELECT * FROM "AidreamcapesCloneJob" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "idempotencyKey" = ${key}`;
  if (!raced[0]) throw new WorkspaceError("customer_site_mismatch", 403);
  const job = jobView(raced[0]);
  return replayCloneIdempotentJob(job, requestHash)!;
}

export async function listCloneJobs(siteId: string, customerId: string): Promise<CloneJob[]> {
  assertWorkspaceSite(siteId); await requireCloneSchema();
  const rows = await prisma.$queryRaw<JobRow[]>`SELECT * FROM "AidreamcapesCloneJob" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} ORDER BY "createdAt" DESC LIMIT 100`;
  return addCloneTaskLinks(customerId, rows.map(jobView));
}
export async function getCloneJob(siteId: string, customerId: string, jobId: string): Promise<CloneJob> {
  const job = await getOwnedJob(siteId, customerId, jobId);
  return (await addCloneTaskLinks(customerId, [job]))[0];
}
async function addCloneTaskLinks(customerId: string, jobs: CloneJob[]): Promise<CloneJob[]> {
  if (!jobs.length) return jobs;
  const ids = jobs.map(job => job.id);
  const rows = await prisma.$queryRaw<{ id: string; jobId: string }[]>`SELECT "id", "data"->'sourceAnalysis'->>'referenceAnalysisId' AS "jobId" FROM "AidreamcapesVideoTask" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "data"->'sourceAnalysis'->>'referenceAnalysisId' = ANY(${ids}::text[]) ORDER BY "createdAt" ASC`;
  return jobs.map(job => ({ ...job, attachedTaskId: rows.find(row => row.jobId === job.id)?.id ?? null }));
}
async function updateJob(siteId: string, customerId: string, job: CloneJob, expectedRevision: number, next: CloneJob): Promise<CloneJob> {
  assertWritable();
  const resultJson = next.result === null ? null : JSON.stringify(next.result);
  const rows = await prisma.$queryRaw<JobRow[]>`UPDATE "AidreamcapesCloneJob" SET "status" = ${next.status}, "revision" = "revision" + 1, "result" = ${resultJson}::jsonb, "completedAt" = ${next.completedAt ? new Date(next.completedAt) : null}, "cancelledAt" = ${next.cancelledAt ? new Date(next.cancelledAt) : null}, "deletedAt" = ${next.deletedAt ? new Date(next.deletedAt) : null}, "updatedAt" = now() WHERE "id" = ${job.id} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "revision" = ${expectedRevision} RETURNING *`;
  if (!rows[0]) throw new WorkspaceError("revision_conflict", 409);
  return jobView(rows[0]);
}
export async function cancelCloneJob(siteId: string, customerId: string, jobId: string, revision: number): Promise<CloneJob> {
  const job = await getOwnedJob(siteId, customerId, jobId);
  if (job.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
  return updateJob(siteId, customerId, job, revision, transitionCloneJob(job, "cancel"));
}
export async function deleteCloneJob(siteId: string, customerId: string, jobId: string, revision: number): Promise<CloneJob> {
  const job = await getOwnedJob(siteId, customerId, jobId);
  if (job.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
  return updateJob(siteId, customerId, job, revision, transitionCloneJob(job, "delete"));
}
export async function runCloneJobMock(siteId: string, customerId: string, jobId: string, revision: number): Promise<CloneJob> {
  const job = await getOwnedJob(siteId, customerId, jobId);
  if (job.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
  const consent = requireCloneConsent(await getOwnedConsent(siteId, customerId, job.consentId), job.workflow);
  if (consent.revision !== job.consentRevision) throw new WorkspaceError("clone_consent_revision_conflict", 409);
  if (consent.sourceAssetId !== job.sourceAssetId || consent.actorId !== job.actorId) throw new WorkspaceError("clone_consent_source_mismatch", 403);
  if (job.taskId) await getOwnedTask(siteId, customerId, job.taskId);
  const source = await resolveSource({ siteId, customerId, workflow: job.workflow, sourceAssetId: job.sourceAssetId, actorId: job.actorId ?? undefined });
  if (source.sourceAssetId !== job.sourceAssetId || source.actorId !== job.actorId) throw new WorkspaceError("clone_consent_source_mismatch", 403);
  const next = transitionCloneJob(job, "run_mock");
  return updateJob(siteId, customerId, job, revision, next);
}

export type CloneSchemaReadiness = { available: boolean; state: "ready" | "missing_schema" | "service_error"; reason: string; analysisBeforeTask: boolean };
export async function cloneSchemaReadiness(): Promise<CloneSchemaReadiness> {
  try {
    const rows = await prisma.$queryRaw<{ consent: string | null; job: string | null; requiresTask: boolean; columnsReady: boolean; guardsReady: boolean }[]>`SELECT to_regclass('"AidreamcapesCloneConsent"')::text AS consent, to_regclass('"AidreamcapesCloneJob"')::text AS job, EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AidreamcapesCloneConsent_ad_task_check' AND conrelid = to_regclass('"AidreamcapesCloneConsent"')) AS "requiresTask",
      NOT EXISTS (SELECT required.name FROM unnest(ARRAY['id','siteId','customerId','workflow','sourceType','sourceAssetId','actorId','taskId','scope','rightsConfirmed','revision','status','grantedAt','expiresAt','revokedAt','createdAt','updatedAt']) AS required(name) WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('"AidreamcapesCloneConsent"') AND attname = required.name AND NOT attisdropped))
      AND NOT EXISTS (SELECT required.name FROM unnest(ARRAY['id','siteId','customerId','workflow','sourceType','sourceAssetId','actorId','taskId','consentId','consentRevision','idempotencyKey','requestHash','status','revision','capabilityState','result','createdAt','updatedAt','queuedAt','completedAt','cancelledAt','deletedAt']) AS required(name) WHERE NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = to_regclass('"AidreamcapesCloneJob"') AND attname = required.name AND NOT attisdropped)) AS "columnsReady",
      EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('"AidreamcapesCloneConsent"') AND tgname = 'aidreamcapes_clone_consent_guard' AND tgenabled <> 'D') AND EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('"AidreamcapesCloneJob"') AND tgname = 'aidreamcapes_clone_job_guard' AND tgenabled <> 'D') AS "guardsReady"`;
    const row = rows[0];
    if (!row?.consent || !row.job || row.columnsReady === false || row.guardsReady === false) return { available: false, state: "missing_schema", reason: "Clone tables, columns and owner guards require explicit installation.", analysisBeforeTask: false };
    return { available: true, state: "ready", reason: "Clone tables are installed.", analysisBeforeTask: !row.requiresTask };
  } catch { return { available: false, state: "service_error", reason: "Clone database diagnostics could not be read.", analysisBeforeTask: false }; }
}
async function requireCloneSchema() {
  const schema = await cloneSchemaReadiness();
  if (!schema.available) throw new WorkspaceError(schema.state === "missing_schema" ? "clone_schema_required" : "clone_database_unavailable", 503, schema);
}
export async function getCloneCapabilities() {
  const database = await cloneSchemaReadiness();
  return { ...cloneCapabilities(), components: { ...cloneCapabilities().components, database }, mockAvailable: database.available, analysisBeforeTask: database.analysisBeforeTask };
}
export function cloneCapabilities() {
  return {
    siteId: AIVIDEOSUGC_SITE_ID,
    productionReady: false,
    mockAvailable: false,
    components: {
      database: { available: false, state: "unchecked", reason: "Database diagnostics pending." },
      mediaRead: { available: false, state: "unverified", reason: "Media must pass explicit preparation checks; mock execution reads no media." },
      voiceClone: { available: false, state: "not_configured", reason: "No proven voice training adapter." },
      portrait: { available: false, state: "not_configured", reason: "No proven identity adapter." },
      lipSync: { available: false, state: "not_configured", reason: "No proven lip sync adapter." },
      asr: { available: false, state: "not_configured", reason: "No proven transcription adapter." },
      adAnalysis: { available: false, state: "not_configured", reason: "Only synthetic fixture analysis is available." },
      videoOutput: { available: false, state: "not_configured", reason: "No verified clone video output." },
    },
    voiceTwin: { state: "mock_only", available: false, reason: "No voice cloning adapter is configured." },
    adReference: { state: "mock_only", available: false, reason: "No ad parsing adapter is configured; remote references are not fetched." },
    externalRequests: false,
    billing: false,
  } as const;
}

/** Retry keeps immutable source/consent audit and uses a new idempotency key. */
export async function retryCloneJob(siteId: string, customerId: string, jobId: string, revision: number, body: Record<string, unknown>) {
  const job = await getOwnedJob(siteId, customerId, jobId);
  if (body.mockMode !== true) throw new WorkspaceError("clone_explicit_mock_required");
  if (job.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
  if (!["cancelled", "mock_complete"].includes(job.status)) throw new WorkspaceError("clone_job_not_retryable", 409);
  if (body.idempotencyKey === job.idempotencyKey) throw new WorkspaceError("clone_retry_new_key_required", 409);
  return queueCloneJob(siteId, customerId, job.workflow, { consentId: job.consentId, consentRevision: job.consentRevision, taskId: job.taskId, idempotencyKey: body.idempotencyKey });
}

async function reusableMockJob(siteId: string, customerId: string, jobId: string, revision: number, body: Record<string, unknown>, workflow: CloneWorkflow) {
  assertWorkspaceSite(siteId); assertWritable();
  if (body.mockMode !== true) throw new WorkspaceError("clone_explicit_mock_required");
  const job = await getOwnedJob(siteId, customerId, jobId);
  if (job.revision !== revision) throw new WorkspaceError("revision_conflict", 409);
  if (job.workflow !== workflow || job.status !== "mock_complete" || job.result?.capabilityState !== "mock_only" || job.result?.productionReady !== false || job.result.sourceAssetId !== job.sourceAssetId) throw new WorkspaceError("clone_result_not_reusable", 409);
  const consent = requireCloneConsent(await getOwnedConsent(siteId, customerId, job.consentId), workflow);
  if (consent.revision !== job.consentRevision) throw new WorkspaceError("clone_consent_revision_conflict", 409);
  await resolveSource({ siteId, customerId, workflow, sourceAssetId: job.sourceAssetId, actorId: job.actorId ?? undefined });
  return job;
}

/** Binding is fixture-only; it never marks a voice as ready for production. */
export async function bindCloneJobActor(siteId: string, customerId: string, jobId: string, revision: number, body: Record<string, unknown>) {
  const job = await reusableMockJob(siteId, customerId, jobId, revision, body, "voice_twin");
  validId(body.actorId, "clone_actor_id_invalid");
  const actorId = body.actorId;
  if (job.actorId && actorId !== job.actorId) throw new WorkspaceError("clone_consent_source_mismatch", 403);
  const voiceId = job.result?.voiceId;
  if (typeof voiceId !== "string" || !voiceId.startsWith("mock:aidreamcapes:clone:")) throw new WorkspaceError("clone_result_not_reusable", 409);
  const assets = await ownedAssets(siteId, customerId);
  const source = assets.find(asset => asset.id === job.sourceAssetId);
  if (!source) throw new WorkspaceError("clone_source_asset_not_owned", 403);
  assertOwnedCloneAsset(source, { siteId, customerId, workflow: "voice_twin" });
  return prisma.$transaction(async tx => {
    // Serialize with revoke/cancel/delete before writing a reusable result.
    const locked = await tx.$queryRaw<JobRow[]>`SELECT j.* FROM "AidreamcapesCloneJob" j JOIN "AidreamcapesCloneConsent" c ON c."id" = j."consentId" WHERE j."id" = ${job.id} AND j."siteId" = ${AIVIDEOSUGC_SITE_ID} AND j."customerId" = ${customerId} AND j."revision" = ${revision} AND j."status" = 'mock_complete' AND c."siteId" = ${AIVIDEOSUGC_SITE_ID} AND c."customerId" = ${customerId} AND c."status" = 'granted' AND c."revision" = j."consentRevision" AND (c."expiresAt" IS NULL OR c."expiresAt" > now()) FOR UPDATE OF j, c`;
    if (!locked[0]) throw new WorkspaceError("clone_result_no_longer_authorized", 409);
    const currentSources = await tx.$queryRaw<AssetRow[]>`SELECT "id", "siteId", "customerId", "storageKey", "mimeType", "role", "deletedAt" FROM "AssetUpload" WHERE "id" = ${job.sourceAssetId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "deletedAt" IS NULL FOR SHARE`;
    if (!currentSources[0]) throw new WorkspaceError("clone_source_asset_not_owned", 403);
    assertOwnedCloneAsset(currentSources[0], { siteId, customerId, workflow: job.workflow });
    const rows = await tx.$queryRaw<{ data: ActorAsset; siteId: string; customerId: string }[]>`SELECT "data", "siteId", "customerId" FROM "AidreamcapesWorkspaceActor" WHERE "id" = ${actorId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} FOR UPDATE`;
    const actor = rows[0];
    if (!actor) throw new WorkspaceError("clone_custom_actor_required", 403);
    assertCustomVoiceActor(actorId, actor.data, { siteId, customerId, rowSiteId: actor.siteId, rowCustomerId: actor.customerId });
    const next = { ...actor.data, voice: { ...actor.data.voice, voiceId, refAudio: toThemeRuntimeAssetRelational(currentSources[0] as unknown as Parameters<typeof toThemeRuntimeAssetRelational>[0]).previewUrl }, cloneBinding: { jobId, sourceAssetId: job.sourceAssetId, consentId: job.consentId, consentRevision: job.consentRevision, capabilityState: "mock_only", productionReady: false } };
    await tx.$executeRaw`UPDATE "AidreamcapesWorkspaceActor" SET "data" = ${JSON.stringify(next)}::jsonb WHERE "id" = ${actorId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}`;
    return next;
  });
}

/** The reference supplies structure only; product facts remain the reviewed task brief. */
export async function attachCloneJobDraft(siteId: string, customerId: string, jobId: string, revision: number, body: Record<string, unknown>) {
  const job = await reusableMockJob(siteId, customerId, jobId, revision, body, "ad_reference");
  validId(body.taskId, "clone_task_id_invalid");
  if (job.taskId && body.taskId !== job.taskId) throw new WorkspaceError("clone_task_link_mismatch", 409);
  if (!Number.isSafeInteger(body.taskRevision) || Number(body.taskRevision) < 1) throw new WorkspaceError("revision_required", 428);
  if (body.confirmedProductFacts !== true) throw new WorkspaceError("clone_confirmed_product_facts_required");
  const task = await getOwnedTask(siteId, customerId, body.taskId);
  if (task.revision !== body.taskRevision) throw new WorkspaceError("revision_conflict", 409);
  if (task.status !== "draft") throw new WorkspaceError("clone_target_draft_required", 409);
  if (!task.productBrief?.userConfirmed || !task.productBrief.confirmedAt || (!task.productBrief.title?.userConfirmed && !task.productBrief.description?.userConfirmed)) throw new WorkspaceError("clone_confirmed_product_facts_required");
  const analysis = job.result?.analysis as ReturnType<typeof fixtureCloneOutput>["analysis"];
  if (!analysis || analysis.synthetic !== true) throw new WorkspaceError("clone_result_not_reusable", 409);
  let segments = analysis.segments;
  if (body.segments !== undefined) {
    if (body.analysisRevision !== analysis.revision) throw new WorkspaceError("clone_analysis_revision_conflict", 409);
    if (!Array.isArray(body.segments) || !body.segments.length || body.segments.length > 30) throw new WorkspaceError("clone_analysis_segments_invalid");
    let previousEnd = 0;
    segments = body.segments.map((value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new WorkspaceError("clone_analysis_segments_invalid");
      const segment = value as Record<string, unknown>;
      if (typeof segment.start !== "number" || typeof segment.end !== "number" || !Number.isFinite(segment.start) || !Number.isFinite(segment.end) || segment.start < previousEnd || segment.end <= segment.start || segment.end > 600 || !["hook", "body", "cta"].includes(String(segment.role)) || typeof segment.visual !== "string" || !segment.visual.trim() || segment.visual.length > 2000) throw new WorkspaceError("clone_analysis_segments_invalid");
      previousEnd = segment.end;
      return { start: segment.start, end: segment.end, role: segment.role as "hook" | "body" | "cta", visual: segment.visual.trim() };
    });
  }
  const sourceAnalysis = { jobId: job.id, referenceAnalysisId: job.id, sourceAssetId: job.sourceAssetId, analysisRevision: analysis.revision, consentId: job.consentId, consentRevision: job.consentRevision, synthetic: true, capabilityState: "mock_only", segments, userEdited: body.segments !== undefined, transcript: analysis.transcript };
  return prisma.$transaction(async tx => {
    const locked = await tx.$queryRaw<JobRow[]>`SELECT j.* FROM "AidreamcapesCloneJob" j JOIN "AidreamcapesCloneConsent" c ON c."id" = j."consentId" WHERE j."id" = ${job.id} AND j."siteId" = ${AIVIDEOSUGC_SITE_ID} AND j."customerId" = ${customerId} AND j."revision" = ${revision} AND j."status" = 'mock_complete' AND c."siteId" = ${AIVIDEOSUGC_SITE_ID} AND c."customerId" = ${customerId} AND c."status" = 'granted' AND c."revision" = j."consentRevision" AND (c."expiresAt" IS NULL OR c."expiresAt" > now()) FOR UPDATE OF j, c`;
    if (!locked[0]) throw new WorkspaceError("clone_result_no_longer_authorized", 409);
    const currentSources = await tx.$queryRaw<AssetRow[]>`SELECT "id", "siteId", "customerId", "storageKey", "mimeType", "role", "deletedAt" FROM "AssetUpload" WHERE "id" = ${job.sourceAssetId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "deletedAt" IS NULL FOR SHARE`;
    if (!currentSources[0]) throw new WorkspaceError("clone_source_asset_not_owned", 403);
    assertOwnedCloneAsset(currentSources[0], { siteId, customerId, workflow: job.workflow });
    const attached = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AidreamcapesVideoTask" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "data"->'sourceAnalysis'->>'referenceAnalysisId' = ${job.id} AND "id" <> ${task.taskId} LIMIT 1`;
    if (attached[0]) throw new WorkspaceError("clone_analysis_already_attached", 409, { taskId: attached[0].id });
    const next = { ...task, sourceAnalysis, revision: task.revision + 1, storyboardStale: Boolean(task.storyboard), updatedAt: new Date().toISOString() };
    const rows = await tx.$queryRaw<{ data: typeof next }[]>`UPDATE "AidreamcapesVideoTask" SET "data" = ${JSON.stringify(next)}::jsonb, "revision" = "revision" + 1, "updatedAt" = now() WHERE "id" = ${task.taskId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "revision" = ${task.revision} AND "data"->>'status' = 'draft' AND COALESCE("data"->'operation'->>'state', '') NOT IN ('run', 'pending') RETURNING "data"`;
    if (!rows[0]) throw new WorkspaceError("revision_conflict", 409);
    return { task: rows[0].data, sourceAnalysis, attachedTaskId: task.taskId, job: { ...job, attachedTaskId: task.taskId } };
  });
}
