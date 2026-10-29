import type { NextRequest } from "next/server";
import { AsyncJobRollingLimitError, createAsyncJob, getAsyncJobByIdempotency, type AsyncJobSnapshot } from "@/lib/async-jobs";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { getTask } from "@/lib/aidreamcapes-workspace/store";
import { isSubtitleOpId, type SubtitleOpId } from "@/lib/aidreamcapes-workspace/subtitle-ops";
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
    if (Object.keys(body).some((key) => key !== "opId") || !isSubtitleOpId(body.opId)) {
      throw new WorkspaceError("workspace_subtitle_op_invalid", 422);
    }
    const opId = body.opId as SubtitleOpId;

    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) throw new WorkspaceError("workspace_subtitle_op_idempotency_invalid", 400);

    // Fail fast before the text model is called: the task must be a completed,
    // idle video owned by the current customer.
    const task = await getTask(siteId, customerId, taskId);
    assertSubtitleOpTask(task, { siteId, customerId, taskId });

    const scopedIdempotencyKey = `${siteId}:${customerId}:${taskId}:${opId}:${idempotencyKey}`;
    const existingJob = await getAsyncJobByIdempotency({ kind: JOB_KIND, actorId: customerId, idempotencyKey: scopedIdempotencyKey });
    if (existingJob) return workspaceResponse(acceptedJob(existingJob as SubtitleOpJob), 202);

    const job = await createAsyncJob<SubtitleOpJobResult>({
      kind: JOB_KIND,
      actorId: customerId,
      idempotencyKey: scopedIdempotencyKey,
      metadata: { siteId, customerId, taskId, opId },
      rollingLimit: { windowMs: QUOTA_WINDOW_MS, maxJobs: QUOTA_MAX_JOBS },
      run: () => runSubtitleOp({ siteId, customerId, taskId, opId })
    });
    return workspaceResponse(acceptedJob(job), 202);
  } catch (error) {
    if (error instanceof AsyncJobRollingLimitError) {
      return workspaceResponse({ error: "workspace_subtitle_op_limit_reached", retryAfter: error.retryAfterSeconds }, 429);
    }
    return workspaceFailure(error);
  }
}
