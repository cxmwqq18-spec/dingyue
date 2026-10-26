import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";
import { assertWorkspaceSite } from "./store";
import { buildWorkerPayload, dispatchWorkerPayload, type WorkerBaseUrls, type WorkerDispatchResult } from "@/lib/worker";
import { settleGenerationJobRelational } from "@/lib/stores/job-store";
import type { GenerationJob, SiteAiApp } from "@/lib/types";
import { assertWorkspaceExternalOperation } from "./stability";

export interface DispatchClaim {
  claimId: string; requestId: string; state: "pending" | "accepted" | "rejected" | "interrupted";
  claimedAt: string; expiresAt: string; error?: string;
}
export type DispatchAdmission = { state: "claimed"; claim: DispatchClaim; requestJson: Record<string, unknown> }
  | { state: "already_dispatched" | "in_progress" | "interrupted" | "finished"; status: string };

// A lease never grants a second dispatch. An expired/unknown outcome requires
// explicit reconciliation against the worker's stable requestId, not replay.
export async function claimWorkspaceDispatch(input: {
  siteId: string; customerId: string; jobId: string; requestId: string; requestJson?: Record<string, unknown>;
}): Promise<DispatchAdmission> {
  assertWorkspaceSite(input.siteId);
  assertWorkspaceExternalOperation("ledger");
  if (input.requestId !== `req_${input.jobId}`) throw new WorkspaceError("workspace_dispatch_request_mismatch", 400);
  if ([process.env.DATABASE_TARGET, process.env.DINGYUE_ENV].some(v => v === "remote-readonly")) throw new WorkspaceError("workspace_database_readonly", 403);
  const now = Date.now();
  const claim: DispatchClaim = { claimId: randomUUID(), requestId: input.requestId, state: "pending", claimedAt: new Date(now).toISOString(), expiresAt: new Date(now + 120_000).toISOString() };
  const prepared = input.requestJson ? JSON.stringify(input.requestJson) : null;
  const workspace = input.requestJson?.workspace && typeof input.requestJson.workspace === "object" ? JSON.stringify(input.requestJson.workspace) : "{}";
  const rows = await prisma.$queryRaw<{ requestJson: Record<string, unknown> }[]>`UPDATE "GenerationJob" SET "requestJson" = jsonb_set(COALESCE(${prepared}::jsonb, "requestJson"), '{workspace}', COALESCE("requestJson"->'workspace', '{}'::jsonb) || ${workspace}::jsonb || jsonb_build_object('dispatchClaim', ${JSON.stringify(claim)}::jsonb), true), "updatedAt" = now() WHERE "id" = ${input.jobId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${input.customerId} AND "status" = 'queued' AND ("requestJson"->'workspace'->'dispatchClaim') IS NULL AND COALESCE("requestJson"->'workspace'->>'dispatched', 'false') <> 'true' RETURNING "requestJson"`;
  if (rows[0]) return { state: "claimed", claim, requestJson: rows[0].requestJson };
  const job = await prisma.generationJob.findFirst({ where: { id: input.jobId, siteId: AIVIDEOSUGC_SITE_ID, customerId: input.customerId }, select: { status: true, requestJson: true } });
  if (!job) throw new WorkspaceError("workspace_generation_not_found", 404);
  const saved = job.requestJson as Record<string, unknown>; const metadata = saved.workspace as { dispatched?: boolean; dispatchClaim?: DispatchClaim } | undefined;
  if (metadata?.dispatched || metadata?.dispatchClaim?.state === "accepted" || job.status === "running" || job.status === "succeeded") return { state: "already_dispatched", status: job.status };
  if (job.status !== "queued" || metadata?.dispatchClaim?.state === "rejected") return { state: "finished", status: job.status };
  const pending = metadata?.dispatchClaim;
  if (!pending) throw new WorkspaceError("workspace_dispatch_state_invalid", 409);
  if (pending.state === "interrupted" || Date.parse(pending.expiresAt) <= now) {
    await prisma.$executeRaw`UPDATE "GenerationJob" SET "requestJson" = jsonb_set("requestJson", '{workspace,dispatchClaim,state}', '"interrupted"'::jsonb), "updatedAt" = now() WHERE "id" = ${input.jobId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${input.customerId} AND "requestJson"->'workspace'->'dispatchClaim'->>'claimId' = ${pending.claimId} AND "requestJson"->'workspace'->'dispatchClaim'->>'state' = 'pending'`;
    return { state: "interrupted", status: job.status };
  }
  return { state: "in_progress", status: job.status };
}

export async function recordWorkspaceDispatch(input: { siteId: string; customerId: string; jobId: string; claimId: string; outcome: "accepted" | "rejected" | "interrupted"; error?: string }) {
  assertWorkspaceSite(input.siteId);
  assertWorkspaceExternalOperation("ledger");
  const state = input.outcome;
  const count = await prisma.$executeRaw`UPDATE "GenerationJob" SET "requestJson" = CASE WHEN ${state} = 'interrupted' THEN jsonb_set("requestJson", '{workspace,dispatchClaim,state}', ${JSON.stringify(state)}::jsonb) ELSE jsonb_set(jsonb_set("requestJson", '{workspace,dispatchClaim,state}', ${JSON.stringify(state)}::jsonb), '{workspace,dispatched}', ${JSON.stringify(state === "accepted")}::jsonb) END, "updatedAt" = now() WHERE "id" = ${input.jobId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${input.customerId} AND "requestJson"->'workspace'->'dispatchClaim'->>'claimId' = ${input.claimId} AND "requestJson"->'workspace'->'dispatchClaim'->>'state' IN ('pending','interrupted')`;
  return count === 1;
}

export async function dispatchWorkspaceJob(input: {
  siteId: string; customerId: string; job: GenerationJob; siteAiApp?: SiteAiApp; baseUrls: WorkerBaseUrls;
  requestJson?: Record<string, unknown>; failureCode: string;
}): Promise<{ job: GenerationJob; admission: DispatchAdmission; workerDispatch: WorkerDispatchResult; note: string }> {
  assertWorkspaceSite(input.siteId);
  if (input.job.siteId !== input.siteId || input.job.customerId !== input.customerId) throw new WorkspaceError("workspace_generation_not_found", 404);
  assertWorkspaceExternalOperation("worker");
  let admission: DispatchAdmission;
  try {
    admission = await claimWorkspaceDispatch({ siteId: input.siteId, customerId: input.customerId, jobId: input.job.id,
      requestId: `req_${input.job.id}`, requestJson: input.requestJson });
  } catch (error) {
    // The claim is written before any provider call. If claiming throws, no
    // worker was dispatched by this request, so release the reservation now
    // instead of waiting for the stale-job watchdog.
    await settleGenerationJobRelational({
      siteId: input.siteId,
      jobId: input.job.id,
      requestId: `req_${input.job.id}`,
      status: "failed",
      error: input.failureCode
    }).catch((settleError) => {
      console.error("workspace_dispatch_claim_settle_failed", {
        siteId: input.siteId,
        jobId: input.job.id,
        error: error instanceof Error ? error.message : String(error),
        settleError: settleError instanceof Error ? settleError.message : String(settleError)
      });
    });
    throw error;
  }
  if (admission.state !== "claimed") {
    if (admission.state === "interrupted") throw new WorkspaceError("workspace_dispatch_outcome_unknown", 503);
    if (admission.state === "finished") throw new WorkspaceError("workspace_dispatch_finished", 409);
    return { job: input.job, admission, workerDispatch: { status: "skipped", error: admission.state }, note: "An existing dispatch owns this idempotent request." };
  }

  let outcomeRecorded = false;
  const failBeforeOrAtRejection = async (error: unknown) => {
    await recordWorkspaceDispatch({ siteId: input.siteId, customerId: input.customerId, jobId: input.job.id, claimId: admission.claim.claimId, outcome: "rejected", error: error instanceof Error ? error.message : input.failureCode }).catch(() => false);
    outcomeRecorded = true;
    await settleGenerationJobRelational({ siteId: input.siteId, jobId: input.job.id, requestId: admission.claim.requestId, status: "failed", error: input.failureCode });
  };

  try {
    if (!input.siteAiApp) throw new WorkspaceError("workspace_generation_app_missing", 503);
    const job = { ...input.job, requestJson: admission.requestJson };
    const payload = await buildWorkerPayload({ job, siteAiApp: input.siteAiApp, baseUrls: input.baseUrls });
    const workerDispatch = await dispatchWorkerPayload(payload);
    if (workerDispatch.status === "sent") {
      const recorded = await recordWorkspaceDispatch({ siteId: input.siteId, customerId: input.customerId, jobId: input.job.id, claimId: admission.claim.claimId, outcome: "accepted" }).catch(() => false);
      return { job, admission, workerDispatch, note: recorded ? "Provider dispatch accepted." : "Provider dispatch accepted; receipt update needs reconciliation." };
    }
    if (workerDispatch.status === "failed" && workerDispatch.statusCode === undefined) {
      await recordWorkspaceDispatch({ siteId: input.siteId, customerId: input.customerId, jobId: input.job.id, claimId: admission.claim.claimId, outcome: "interrupted", error: workerDispatch.error }).catch(() => false);
      outcomeRecorded = true;
      throw new WorkspaceError("workspace_dispatch_outcome_unknown", 503);
    }
    await failBeforeOrAtRejection(new Error(workerDispatch.error || input.failureCode));
    throw new WorkspaceError(input.failureCode, 503);
  } catch (error) {
    if (!outcomeRecorded) await failBeforeOrAtRejection(error);
    throw error;
  }
}
