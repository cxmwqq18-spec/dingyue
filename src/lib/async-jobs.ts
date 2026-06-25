import "server-only";

import crypto from "crypto";
import fs from "fs";
import path from "path";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AsyncJobKind = "resend_domain_verify" | "cloudflare_dns" | "ai_provider_test" | (string & {});
export type AsyncJobStatus = "queued" | "running" | "succeeded" | "failed";

export type AsyncJobError = {
  message: string;
  code?: string;
  status?: number;
};

export type AsyncJobRecord<Result = unknown, Metadata extends Record<string, unknown> = Record<string, unknown>> = {
  id: string;
  kind: AsyncJobKind;
  status: AsyncJobStatus;
  actorId?: string;
  metadata: Metadata;
  result?: Result;
  error?: AsyncJobError;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  expiresAt: string;
};

export type AsyncJobSnapshot<Result = unknown, Metadata extends Record<string, unknown> = Record<string, unknown>> =
  AsyncJobRecord<Result, Metadata>;

type AsyncJobRunner<Result> = (context: {
  jobId: string;
  signal: AbortSignal;
  update: (patch: { metadata?: Record<string, unknown> }) => Promise<AsyncJobSnapshot<Result>>;
}) => Promise<Result>;

type CreateAsyncJobParams<Result> = {
  kind: AsyncJobKind;
  actorId?: string;
  metadata?: Record<string, unknown>;
  ttlMs?: number;
  run: AsyncJobRunner<Result>;
};

type AsyncJobStore = {
  loaded: boolean;
  jobs: Map<string, AsyncJobRecord>;
  controllers: Map<string, AbortController>;
};

type PersistedJobsFile = {
  jobs?: AsyncJobRecord[];
};

const globalKey = "__dingyue_async_jobs__";
const defaultTtlMs = 1000 * 60 * 60;
const maxJobs = Math.max(20, Number(process.env.ASYNC_JOBS_MAX_RECORDS ?? "500") || 500);
const persistenceMode = process.env.ASYNC_JOBS_PERSISTENCE ?? "memory";
const dbTimeoutMs = Math.max(250, Number(process.env.ASYNC_JOBS_DB_TIMEOUT_MS ?? "1200") || 1200);
const persistenceFile = process.env.ASYNC_JOBS_FILE
  ? path.resolve(process.env.ASYNC_JOBS_FILE)
  : path.join(process.cwd(), "data", "async-jobs.json");

function store(): AsyncJobStore {
  const globalWithStore = globalThis as typeof globalThis & { [globalKey]?: AsyncJobStore };
  if (!globalWithStore[globalKey]) {
    globalWithStore[globalKey] = { loaded: false, jobs: new Map(), controllers: new Map() };
  }
  const value = globalWithStore[globalKey];
  if (!value.loaded) loadPersistedJobs(value);
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

function cloneJob<Job extends AsyncJobRecord>(job: Job): Job {
  return JSON.parse(JSON.stringify(job)) as Job;
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function jsonRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function iso(value: Date | string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value instanceof Date ? value.toISOString() : value;
}

function rowToJob(row: Prisma.PlatformAsyncJobGetPayload<object>): AsyncJobSnapshot {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status as AsyncJobStatus,
    actorId: row.actorId ?? undefined,
    metadata: jsonRecord(row.metadata) ?? {},
    result: row.result === null ? undefined : row.result,
    error: jsonRecord(row.error) as AsyncJobError | undefined,
    createdAt: iso(row.createdAt) ?? nowIso(),
    updatedAt: iso(row.updatedAt) ?? nowIso(),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    expiresAt: iso(row.expiresAt) ?? nowIso()
  };
}

function rememberJob(job: AsyncJobRecord, target = store()): AsyncJobSnapshot {
  target.jobs.set(job.id, job);
  pruneExpiredJobs(target);
  persistJobs(target);
  return cloneJob(job);
}

async function withDbTimeout<T>(operation: Promise<T>, fallback: T): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), dbTimeoutMs);
      })
    ]);
  } catch {
    return fallback;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function createJobInDatabase(job: AsyncJobRecord): Promise<AsyncJobSnapshot | undefined> {
  return withDbTimeout(
    prisma.platformAsyncJob
      .create({
        data: {
          id: job.id,
          kind: job.kind,
          status: job.status,
          actorId: job.actorId,
          metadata: toPrismaJson(job.metadata),
          result: job.result === undefined ? undefined : toPrismaJson(job.result),
          error: job.error === undefined ? undefined : toPrismaJson(job.error),
          createdAt: new Date(job.createdAt),
          updatedAt: new Date(job.updatedAt),
          startedAt: job.startedAt ? new Date(job.startedAt) : undefined,
          finishedAt: job.finishedAt ? new Date(job.finishedAt) : undefined,
          expiresAt: new Date(job.expiresAt)
        }
      })
      .then(rowToJob),
    undefined
  );
}

async function patchJobInDatabase<Result>(
  jobId: string,
  patch: Partial<AsyncJobRecord<Result>>
): Promise<AsyncJobSnapshot<Result> | undefined> {
  return withDbTimeout(
    (async () => {
      const current = await prisma.platformAsyncJob.findUnique({ where: { id: jobId } });
      if (!current) return undefined;
      const currentJob = rowToJob(current);
      const metadata = { ...currentJob.metadata, ...(patch.metadata ?? {}) };
      const updated = await prisma.platformAsyncJob.update({
        where: { id: jobId },
        data: {
          status: patch.status,
          actorId: patch.actorId,
          metadata: patch.metadata ? toPrismaJson(metadata) : undefined,
          result: patch.result === undefined ? undefined : toPrismaJson(patch.result),
          error: patch.error === undefined ? undefined : toPrismaJson(patch.error),
          startedAt: patch.startedAt ? new Date(patch.startedAt) : undefined,
          finishedAt: patch.finishedAt ? new Date(patch.finishedAt) : undefined,
          expiresAt: patch.expiresAt ? new Date(patch.expiresAt) : undefined
        }
      });
      return rowToJob(updated) as AsyncJobSnapshot<Result>;
    })(),
    undefined
  );
}

function normalizeError(error: unknown): AsyncJobError {
  if (error instanceof Error) {
    const maybeStatus = "status" in error && typeof error.status === "number" ? error.status : undefined;
    const maybeCode = "code" in error && typeof error.code === "string" ? error.code : undefined;
    return { message: error.message || "async_job_failed", code: maybeCode, status: maybeStatus };
  }
  return { message: typeof error === "string" ? error : "async_job_failed" };
}

function shouldPersistToFile(): boolean {
  return persistenceMode === "file";
}

function loadPersistedJobs(target: AsyncJobStore): void {
  target.loaded = true;
  if (!shouldPersistToFile()) return;
  try {
    const parsed = JSON.parse(fs.readFileSync(persistenceFile, "utf8")) as PersistedJobsFile;
    for (const job of parsed.jobs ?? []) {
      if (!job?.id || !job.kind || !job.status) continue;
      target.jobs.set(job.id, {
        ...job,
        status: job.status === "queued" || job.status === "running" ? "failed" : job.status,
        error:
          job.status === "queued" || job.status === "running"
            ? { message: "async_job_interrupted" }
            : job.error
      });
    }
    pruneExpiredJobs(target);
  } catch {
    // The async job file is an optional cache, not a source of truth for platform state.
  }
}

function persistJobs(target = store()): void {
  if (!shouldPersistToFile()) return;
  try {
    fs.mkdirSync(path.dirname(persistenceFile), { recursive: true });
    const payload: PersistedJobsFile = { jobs: Array.from(target.jobs.values()).map(cloneJob) };
    const tempFile = `${persistenceFile}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, `${JSON.stringify(payload, null, 2)}\n`);
    fs.renameSync(tempFile, persistenceFile);
  } catch {
    // Persistence is deliberately best-effort so third-party operations are not blocked by disk issues.
  }
}

function pruneExpiredJobs(target = store()): void {
  const now = Date.now();
  for (const [jobId, job] of target.jobs) {
    if (new Date(job.expiresAt).getTime() <= now) {
      target.jobs.delete(jobId);
      target.controllers.get(jobId)?.abort();
      target.controllers.delete(jobId);
    }
  }
  if (target.jobs.size <= maxJobs) return;
  const removable = Array.from(target.jobs.values())
    .filter((job) => job.status === "succeeded" || job.status === "failed")
    .sort((left, right) => new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime());
  for (const job of removable) {
    if (target.jobs.size <= maxJobs) break;
    target.jobs.delete(job.id);
  }
}

function saveJob(job: AsyncJobRecord, target = store()): AsyncJobSnapshot {
  return rememberJob(job, target);
}

function createJobId(kind: AsyncJobKind): string {
  const safeKind = kind.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "").toLowerCase() || "job";
  return `aj_${safeKind}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

async function patchAsyncJob<Result>(jobId: string, patch: Partial<AsyncJobRecord<Result>>): Promise<AsyncJobSnapshot<Result>> {
  const dbJob = await patchJobInDatabase<Result>(jobId, patch);
  if (dbJob) {
    rememberJob(dbJob as AsyncJobRecord);
    return dbJob;
  }
  const current = store().jobs.get(jobId);
  if (!current) throw new Error("async_job_not_found");
  const next = {
    ...current,
    ...patch,
    metadata: {
      ...current.metadata,
      ...(patch.metadata ?? {})
    },
    updatedAt: nowIso()
  } as AsyncJobRecord<Result>;
  return saveJob(next) as AsyncJobSnapshot<Result>;
}

async function runAsyncJob<Result>(jobId: string, runner: AsyncJobRunner<Result>): Promise<void> {
  const currentStore = store();
  const controller = currentStore.controllers.get(jobId);
  if (!controller) return;
  await patchAsyncJob(jobId, { status: "running", startedAt: nowIso() });
  try {
    const result = await runner({
      jobId,
      signal: controller.signal,
      update: (patch) => patchAsyncJob<Result>(jobId, patch)
    });
    await patchAsyncJob(jobId, { status: "succeeded", result, finishedAt: nowIso() });
  } catch (error) {
    await patchAsyncJob(jobId, { status: "failed", error: normalizeError(error), finishedAt: nowIso() });
  } finally {
    currentStore.controllers.delete(jobId);
  }
}

export async function createAsyncJob<Result = unknown>(params: CreateAsyncJobParams<Result>): Promise<AsyncJobSnapshot<Result>> {
  const currentStore = store();
  pruneExpiredJobs(currentStore);
  const createdAt = nowIso();
  const ttlMs = Math.max(1000, params.ttlMs ?? defaultTtlMs);
  const job: AsyncJobRecord<Result> = {
    id: createJobId(params.kind),
    kind: params.kind,
    status: "queued",
    actorId: params.actorId,
    metadata: params.metadata ?? {},
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Date.now() + ttlMs).toISOString()
  };
  const controller = new AbortController();
  currentStore.controllers.set(job.id, controller);
  const persistedJob = await createJobInDatabase(job);
  rememberJob((persistedJob as AsyncJobRecord<Result> | undefined) ?? job, currentStore);
  queueMicrotask(() => {
    void runAsyncJob(job.id, params.run);
  });
  return cloneJob(((persistedJob as AsyncJobRecord<Result> | undefined) ?? job));
}

export async function getAsyncJob(jobId: string): Promise<AsyncJobSnapshot | undefined> {
  pruneExpiredJobs();
  const localJob = store().jobs.get(jobId);
  const dbJob = await withDbTimeout(
    prisma.platformAsyncJob
      .findFirst({ where: { id: jobId, expiresAt: { gt: new Date() } } })
      .then((row) => (row ? rowToJob(row) : undefined)),
    undefined
  );
  if (dbJob) {
    rememberJob(dbJob as AsyncJobRecord);
    return dbJob;
  }
  return localJob ? cloneJob(localJob) : undefined;
}

export async function listAsyncJobs(filters: { actorId?: string; kind?: AsyncJobKind; limit?: number } = {}): Promise<AsyncJobSnapshot[]> {
  pruneExpiredJobs();
  const limit = Math.max(1, Math.min(filters.limit ?? 50, 200));
  const dbJobs = await withDbTimeout(
    prisma.platformAsyncJob
      .findMany({
        where: {
          actorId: filters.actorId,
          kind: filters.kind,
          expiresAt: { gt: new Date() }
        },
        orderBy: { createdAt: "desc" },
        take: limit
      })
      .then((rows) => rows.map(rowToJob)),
    undefined
  );
  if (dbJobs) {
    for (const job of dbJobs) rememberJob(job as AsyncJobRecord);
    return dbJobs;
  }
  return Array.from(store().jobs.values())
    .filter((job) => !filters.actorId || job.actorId === filters.actorId)
    .filter((job) => !filters.kind || job.kind === filters.kind)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit)
    .map(cloneJob);
}

export async function cancelAsyncJob(jobId: string): Promise<AsyncJobSnapshot | undefined> {
  const currentStore = store();
  const job = (await getAsyncJob(jobId)) ?? currentStore.jobs.get(jobId);
  if (!job) return undefined;
  if (job.status === "succeeded" || job.status === "failed") return cloneJob(job);
  currentStore.controllers.get(jobId)?.abort();
  currentStore.controllers.delete(jobId);
  return patchAsyncJob(jobId, {
    ...job,
    status: "failed",
    error: { message: "async_job_cancelled" },
    finishedAt: nowIso()
  });
}

export function toAsyncJobAcceptedPayload(job: AsyncJobSnapshot): {
  ok: true;
  accepted: true;
  jobId: string;
  job: AsyncJobSnapshot;
} {
  return {
    ok: true,
    accepted: true,
    jobId: job.id,
    job
  };
}
