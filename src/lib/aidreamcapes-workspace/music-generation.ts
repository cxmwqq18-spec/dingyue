import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { assertWorkspaceSite, getTask } from "./store";
import { WorkspaceError } from "./types";
import { writeMusicGenerationFixture } from "./music-generation-fixture";
import {
  assertMusicGenerationAttachable,
  assertMusicGenerationMockEnabled,
  musicGenerationCapabilities,
  musicGenerationRequestHash,
  publicMusicGenerationJob,
  replayMusicGenerationIdempotentJob,
  transitionMusicGenerationJob,
  validateMusicGenerationRequest,
  type MusicGenerationJob,
  type MusicGenerationRequest,
} from "./music-generation-core";

type MusicGenerationRow = Omit<MusicGenerationJob, "createdAt" | "updatedAt" | "queuedAt" | "completedAt" | "cancelledAt"> & {
  createdAt: Date | string;
  updatedAt: Date | string;
  queuedAt: Date | string;
  completedAt: Date | string | null;
  cancelledAt: Date | string | null;
};

function iso(value: Date | string | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function jobView(row: MusicGenerationRow): MusicGenerationJob {
  return {
    ...row,
    createdAt: iso(row.createdAt)!,
    updatedAt: iso(row.updatedAt)!,
    queuedAt: iso(row.queuedAt)!,
    completedAt: iso(row.completedAt),
    cancelledAt: iso(row.cancelledAt),
  };
}

function assertWritable() {
  if ([process.env.DATABASE_TARGET, process.env.DINGYUE_ENV].some((value) => value?.trim().toLowerCase() === "remote-readonly")) {
    throw new WorkspaceError("workspace_database_readonly", 403);
  }
}

function validId(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,180}$/.test(value)) throw new WorkspaceError(code);
}

export function getMusicGenerationCapabilities(siteId: string) {
  assertWorkspaceSite(siteId);
  return musicGenerationCapabilities();
}

export async function queueMusicGenerationJob(
  siteId: string,
  customerId: string,
  body: Record<string, unknown>,
  idempotencyHeader?: string | null,
): Promise<{ job: ReturnType<typeof publicMusicGenerationJob>; created: boolean }> {
  assertWorkspaceSite(siteId);
  assertWritable();
  assertMusicGenerationMockEnabled();
  const request: MusicGenerationRequest = validateMusicGenerationRequest(body, idempotencyHeader);
  const task = await getTask(siteId, customerId, request.taskId);
  if (task.siteId !== siteId || task.customerId !== customerId || task.taskId !== request.taskId) {
    throw new WorkspaceError("music_generation_task_not_owned", 403);
  }
  if (task.revision !== request.taskRevision) throw new WorkspaceError("revision_conflict", 409);
  const requestHash = musicGenerationRequestHash(request);

  const prior = await prisma.$queryRaw<MusicGenerationRow[]>`
    SELECT * FROM "AidreamcapesMusicGenerationJob"
    WHERE "siteId" = ${"site_aidreamcapes"} AND "customerId" = ${customerId} AND "idempotencyKey" = ${request.idempotencyKey}
    LIMIT 1`;
  if (prior[0]) {
    const replay = replayMusicGenerationIdempotentJob(jobView(prior[0]), requestHash)!;
    return { job: publicMusicGenerationJob(replay.job), created: false };
  }

  const id = randomUUID();
  const rows = await prisma.$queryRaw<MusicGenerationRow[]>`
    INSERT INTO "AidreamcapesMusicGenerationJob" (
      "id", "siteId", "customerId", "taskId", "taskRevision", "idempotencyKey", "requestHash",
      "prompt", "durationSeconds", "tempoBpm", "status", "revision", "capabilityState", "rightsStatus", "testOnly"
    )
    SELECT ${id}, 'site_aidreamcapes', c."id", t."id", ${request.taskRevision}, ${request.idempotencyKey}, ${requestHash},
      ${request.prompt}, ${request.durationSeconds}, ${request.tempoBpm}, 'queued', 1, 'mock_only', 'unlicensed', TRUE
    FROM "Customer" c
    JOIN "AidreamcapesVideoTask" t ON t."customerId" = c."id" AND t."siteId" = 'site_aidreamcapes'
    WHERE c."id" = ${customerId} AND c."siteId" = 'site_aidreamcapes'
      AND t."id" = ${request.taskId} AND t."revision" = ${request.taskRevision}
    ON CONFLICT ("siteId", "customerId", "idempotencyKey") DO NOTHING
    RETURNING *`;
  if (rows[0]) return { job: publicMusicGenerationJob(jobView(rows[0])), created: true };

  const raced = await prisma.$queryRaw<MusicGenerationRow[]>`
    SELECT * FROM "AidreamcapesMusicGenerationJob"
    WHERE "siteId" = 'site_aidreamcapes' AND "customerId" = ${customerId} AND "idempotencyKey" = ${request.idempotencyKey}
    LIMIT 1`;
  if (raced[0]) {
    const replay = replayMusicGenerationIdempotentJob(jobView(raced[0]), requestHash)!;
    return { job: publicMusicGenerationJob(replay.job), created: false };
  }
  throw new WorkspaceError("revision_conflict", 409);
}

async function getOwnedMusicGenerationJob(siteId: string, customerId: string, jobId: string): Promise<MusicGenerationJob> {
  assertWorkspaceSite(siteId);
  validId(jobId, "music_generation_job_id_invalid");
  const rows = await prisma.$queryRaw<MusicGenerationRow[]>`
    SELECT * FROM "AidreamcapesMusicGenerationJob"
    WHERE "id" = ${jobId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${customerId}
    LIMIT 1`;
  if (!rows[0]) throw new WorkspaceError("music_generation_job_not_found", 404);
  return jobView(rows[0]);
}

export async function getMusicGenerationJob(siteId: string, customerId: string, jobId: string) {
  return publicMusicGenerationJob(await getOwnedMusicGenerationJob(siteId, customerId, jobId));
}

export async function listMusicGenerationJobs(siteId: string, customerId: string) {
  assertWorkspaceSite(siteId);
  const rows = await prisma.$queryRaw<MusicGenerationRow[]>`
    SELECT * FROM "AidreamcapesMusicGenerationJob"
    WHERE "siteId" = 'site_aidreamcapes' AND "customerId" = ${customerId}
    ORDER BY "createdAt" DESC LIMIT 100`;
  return rows.map((row) => publicMusicGenerationJob(jobView(row)));
}

export async function runMusicGenerationJobMock(siteId: string, customerId: string, jobId: string, expectedRevision: number) {
  assertWorkspaceSite(siteId);
  assertWritable();
  assertMusicGenerationMockEnabled();
  const job = await getOwnedMusicGenerationJob(siteId, customerId, jobId);
  if (job.revision !== expectedRevision) throw new WorkspaceError("revision_conflict", 409);
  const task = await getTask(siteId, customerId, job.taskId);
  if (task.siteId !== siteId || task.customerId !== customerId || task.taskId !== job.taskId) throw new WorkspaceError("music_generation_task_not_owned", 403);
  if (task.revision !== job.taskRevision) throw new WorkspaceError("revision_conflict", 409);

  const key = await writeMusicGenerationFixture(job);
  const next = transitionMusicGenerationJob(job, "run_mock", expectedRevision, new Date().toISOString(), key);
  const rows = await prisma.$queryRaw<MusicGenerationRow[]>`
    UPDATE "AidreamcapesMusicGenerationJob" SET "status" = 'mock_complete', "revision" = "revision" + 1,
      "fixtureKey" = ${key}, "completedAt" = now(), "updatedAt" = now()
    WHERE "id" = ${jobId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${customerId}
      AND "revision" = ${expectedRevision} AND "status" = 'queued'
      AND EXISTS (
        SELECT 1 FROM "AidreamcapesVideoTask" t WHERE t."id" = ${job.taskId} AND t."siteId" = 'site_aidreamcapes'
          AND t."customerId" = ${customerId} AND t."revision" = ${job.taskRevision}
      )
    RETURNING *`;
  if (!rows[0]) throw new WorkspaceError("revision_conflict", 409);
  if (next.revision !== rows[0].revision) throw new WorkspaceError("revision_conflict", 409);
  return publicMusicGenerationJob(jobView(rows[0]));
}

export async function cancelMusicGenerationJob(siteId: string, customerId: string, jobId: string, expectedRevision: number) {
  assertWorkspaceSite(siteId);
  assertWritable();
  const job = await getOwnedMusicGenerationJob(siteId, customerId, jobId);
  const next = transitionMusicGenerationJob(job, "cancel", expectedRevision);
  const rows = await prisma.$queryRaw<MusicGenerationRow[]>`
    UPDATE "AidreamcapesMusicGenerationJob" SET "status" = 'cancelled', "revision" = "revision" + 1,
      "cancelledAt" = ${next.cancelledAt}, "updatedAt" = now()
    WHERE "id" = ${jobId} AND "siteId" = 'site_aidreamcapes' AND "customerId" = ${customerId}
      AND "revision" = ${expectedRevision} AND "status" = 'queued'
    RETURNING *`;
  if (!rows[0]) throw new WorkspaceError("revision_conflict", 409);
  return publicMusicGenerationJob(jobView(rows[0]));
}

export async function assertMusicGenerationJobCannotAttach(siteId: string, customerId: string, jobId: string, expectedRevision: number): Promise<never> {
  const job = await getOwnedMusicGenerationJob(siteId, customerId, jobId);
  const task = await getTask(siteId, customerId, job.taskId);
  if (task.siteId !== siteId || task.customerId !== customerId || task.taskId !== job.taskId) {
    throw new WorkspaceError("music_generation_task_not_owned", 403);
  }
  return assertMusicGenerationAttachable(job, task, expectedRevision);
}
