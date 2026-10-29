import type { NextRequest } from "next/server";
import { AsyncJobRollingLimitError, createAsyncJob, getAsyncJobByIdempotency, type AsyncJobSnapshot } from "@/lib/async-jobs";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { prisma } from "@/lib/prisma";
import { getTask } from "@/lib/aidreamcapes-workspace/store";
import { isSubtitleOpId, parseSubtitleOpSettings, type SubtitleOpId } from "@/lib/aidreamcapes-workspace/subtitle-ops";
import { assertSubtitleOpTask, runSubtitleOp, type SubtitleOpJobResult } from "@/lib/aidreamcapes-workspace/subtitle-ops.server";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string }> };

const JOB_KIND = "aivideosugc_subtitle_op";
const QUOTA_WINDOW_MS = 24 * 60 * 60 * 1000;
const QUOTA_MAX_JOBS = 10;

type SubtitleOpJob = AsyncJobSnapshot<SubtitleOpJobResult>;

function acceptedJob(job: SubtitleOpJob) {
  return {
    ok: true,
    job: { id: job.id, status: job.status, result: job.result, error: job.error, createdAt: job.createdAt, updatedAt: job.updatedAt }
  };
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    if (!/^[a-zA-Z0-9_-]{1,180}$/.test(taskId)) throw new WorkspaceError("task_id_invalid", 400);
    const customerId = auth.current.customer.id;

    const body = await jsonBody(request);
    if (Object.keys(body).some((key) => key !== "opId" && key !== "settings") || !isSubtitleOpId(body.opId)) {
      throw new WorkspaceError("workspace_subtitle_op_invalid", 422);
    }
    const opId = body.opId as SubtitleOpId;
    const settings = parseSubtitleOpSettings(body.settings);

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) throw new WorkspaceError("workspace_subtitle_op_idempotency_invalid", 400);

    // Fail fast before the text model is called: the task must be a completed,
    // idle video owned by the current customer.
    const task = await getTask(siteId, customerId, taskId);
    assertSubtitleOpTask(task, { siteId, customerId, taskId });

    const scopedIdempotencyKey = `${siteId}:${customerId}:${taskId}:${opId}:${idempotencyKey}`;
    const existingJob = await getAsyncJobByIdempotency({ kind: JOB_KIND, actorId: customerId, idempotencyKey: scopedIdempotencyKey });
    if (existingJob) return workspaceResponse(acceptedJob(existingJob as SubtitleOpJob), 202);

    // Single flight per task: one burn-in at a time keeps revision CAS safe and
    // lets another click or view resume the very same job instead of stacking
    // conflicting renders.
    const inflightRows = await prisma.platformAsyncJob.findMany({
      where: { kind: JOB_KIND, actorId: customerId, status: { in: ["queued", "running"] } },
      orderBy: { createdAt: "desc" },
      take: 20
    });
    const inflight = inflightRows.find((row) => (row.metadata as Record<string, unknown> | null)?.taskId === taskId);
    if (inflight) {
      return workspaceResponse({
        ok: true,
        job: { id: inflight.id, status: inflight.status, result: inflight.result ?? null, error: inflight.error ?? null, createdAt: inflight.createdAt, updatedAt: inflight.updatedAt }
      }, 202);
    }

    const job = await createAsyncJob<SubtitleOpJobResult>({
      kind: JOB_KIND,
      actorId: customerId,
      idempotencyKey: scopedIdempotencyKey,
      metadata: { siteId, customerId, taskId, opId, settings },
      rollingLimit: { windowMs: QUOTA_WINDOW_MS, maxJobs: QUOTA_MAX_JOBS },
      run: () => runSubtitleOp({ siteId, customerId, taskId, opId, settings })
    });
    return workspaceResponse(acceptedJob(job), 202);
  } catch (error) {
    if (error instanceof AsyncJobRollingLimitError) {
      return workspaceResponse({ error: "workspace_subtitle_op_limit_reached", retryAfter: error.retryAfterSeconds }, 429);
    }
    return workspaceFailure(error);
  }
}
