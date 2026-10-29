import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createActorVoiceSnapshot } from "./pipeline";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type ActorAsset, type SceneId, type TaskInput } from "./types";
import type { StoredTask } from "./store";

export const MAX_BATCH_ITEMS = 10;
export const MAX_BATCH_CONCURRENCY = 3;
export type BatchItemStatus = "draft" | "queued" | "running" | "completed" | "failed" | "cancelled";
export interface BatchItemState {
  batchId: string; batchRevision: number; requestHash: string; index: number; total: number;
  status: BatchItemStatus; attempts: number; cancelRequested: boolean; error?: string;
  leaseUntil?: string; runToken?: string; updatedAt: string;
}
export type BatchTask = StoredTask & { batch: BatchItemState };
export interface BatchInputItem { sceneId: SceneId; input: TaskInput; title?: string }
export interface BatchSummary {
  batchId: string; revision: number; status: "draft" | "queued" | "running" | "cancelling" | "completed" | "partial" | "failed" | "cancelled";
  total: number; counts: Record<BatchItemStatus, number>; maxConcurrency: number;
}
export interface BatchSnapshot { batch: BatchSummary; tasks: BatchTask[] }

export interface BatchRepository {
  createAtomically(siteId: string, customerId: string, tasks: BatchTask[]): Promise<BatchTask[]>;
  listOwned(siteId: string, customerId: string, batchId: string): Promise<BatchTask[]>;
  updateOwned(args: { siteId: string; customerId: string; batchId: string; expectedRevision?: number }, update: (tasks: BatchTask[]) => BatchTask[]): Promise<BatchTask[]>;
  claimNext(siteId: string, customerId: string, batchId: string): Promise<BatchTask | undefined>;
  finishItem(args: { siteId: string; customerId: string; batchId: string; taskId: string; runToken: string; error?: string }): Promise<void>;
}

export type MockBatchRunner = (task: BatchTask) => Promise<void>;

function assertSite(siteId: string): void {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
}
function assertWritable(): void {
  if ([process.env.DATABASE_TARGET, process.env.DINGYUE_ENV].some(value => value?.trim().toLowerCase() === "remote-readonly")) {
    throw new WorkspaceError("workspace_database_readonly", 403);
  }
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, nested]) => [key, canonical(nested)]));
}
function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}
function taskIdFor(batchId: string, index: number): string {
  return `ugc-${hash([batchId, index])}`;
}
function cloneTasks(tasks: BatchTask[]): BatchTask[] {
  return structuredClone(tasks);
}
function assertBatch(tasks: BatchTask[], batchId?: string): BatchTask[] {
  if (!tasks.length) throw new WorkspaceError("workspace_batch_not_found", 404);
  const first = tasks[0]?.batch;
  if (!first) throw new WorkspaceError("workspace_batch_state_invalid", 409);
  const ordered = [...tasks].sort((a, b) => (a.batch?.index ?? -1) - (b.batch?.index ?? -1));
  if (!first || (batchId && first.batchId !== batchId) || ordered.length !== first.total ||
      ordered.some((task, index) => !task.batch || task.batch.batchId !== first.batchId || task.batch.total !== first.total ||
        task.batch.index !== index || task.batch.requestHash !== first.requestHash || task.batch.batchRevision !== first.batchRevision ||
        task.batch.cancelRequested !== first.cancelRequested)) {
    throw new WorkspaceError("workspace_batch_state_invalid", 409);
  }
  return ordered;
}
function summarize(tasks: BatchTask[]): BatchSummary {
  const ordered = assertBatch(tasks);
  const counts: Record<BatchItemStatus, number> = { draft: 0, queued: 0, running: 0, completed: 0, failed: 0, cancelled: 0 };
  ordered.forEach(task => counts[task.batch.status]++);
  const cancelRequested = ordered[0].batch.cancelRequested;
  let status: BatchSummary["status"];
  if (cancelRequested) status = counts.running ? "cancelling" : "cancelled";
  else if (counts.running) status = "running";
  else if (counts.queued) status = "queued";
  else if (counts.draft) status = "draft";
  else if (counts.failed && counts.completed) status = "partial";
  else if (counts.failed) status = "failed";
  else if (counts.cancelled) status = "cancelled";
  else status = "completed";
  return { batchId: ordered[0].batch.batchId, revision: ordered[0].batch.batchRevision, status,
    total: ordered.length, counts, maxConcurrency: MAX_BATCH_CONCURRENCY };
}
function snapshot(tasks: BatchTask[]): BatchSnapshot {
  const ordered = assertBatch(tasks);
  return { batch: summarize(ordered), tasks: ordered };
}
function batchIdFor(siteId: string, customerId: string, requestKey: string): string {
  return `batch-${hash([siteId, customerId, requestKey])}`;
}
function itemFailureCode(error: unknown): string {
  if (error instanceof WorkspaceError) return error.code;
  if (typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" && /^[a-z0-9_-]{1,100}$/i.test(error.code)) return error.code;
  return "mock_batch_item_failed";
}

export async function mockBatchRunner(_task: BatchTask): Promise<void> {
  // The batch runner is intentionally local and deterministic. It never submits a
  // provider job, dispatches a worker, reserves credits, or writes a ledger entry.
  await Promise.resolve();
}

export async function createBatchDrafts(args: {
  siteId: string; customerId: string; idempotencyKey: string; items: BatchInputItem[]; actors: ActorAsset[];
  repository?: BatchRepository;
  /** Caller-declared item ceiling. Defaults to MAX_BATCH_ITEMS; batch-submit raises it for bulk runs. */
  maxItems?: number;
}): Promise<BatchSnapshot> {
  assertSite(args.siteId);
  assertWritable();
  const maxItems = args.maxItems ?? MAX_BATCH_ITEMS;
  if (!args.customerId || !args.idempotencyKey || args.idempotencyKey.length > 200 || !Array.isArray(args.items) ||
      args.items.length < 1 || args.items.length > maxItems) throw new WorkspaceError("batch_items_invalid");
  const repository = args.repository ?? prismaBatchRepository;
  const batchId = batchIdFor(args.siteId, args.customerId, args.idempotencyKey);
  const requestHash = hash(args.items.map(item => ({ sceneId: item.sceneId, input: item.input, title: item.title })));
  const existing = await repository.listOwned(args.siteId, args.customerId, batchId);
  if (existing.length) {
    const group = assertBatch(existing, batchId);
    if (group.length !== args.items.length || group[0].batch.requestHash !== requestHash) throw new WorkspaceError("idempotency_conflict", 409);
    return snapshot(group);
  }

  const now = new Date().toISOString();
  const tasks = args.items.map((item, index): BatchTask => {
    const taskId = taskIdFor(batchId, index);
    const creationHash = hash({ sceneId: item.sceneId, input: item.input, title: item.title });
    const voiceSnapshot = item.input.actorId
      ? createActorVoiceSnapshot(args.actors.find(actor => actor.actorId === item.input.actorId))
      : undefined;
    return { taskId, siteId: AIVIDEOSUGC_SITE_ID, customerId: args.customerId, sceneId: item.sceneId, creationHash,
      title: item.title?.trim().slice(0, 160) || "Untitled video", status: "draft", createdAt: now, updatedAt: now, revision: 1,
      input: structuredClone(item.input), voiceSnapshot, storyboardStale: false, storyboardHistory: [], revisions: [], videoHistory: [],
      batch: { batchId, batchRevision: 1, requestHash, index, total: args.items.length, status: "draft", attempts: 0, cancelRequested: false, updatedAt: now } };
  });
  return snapshot(await repository.createAtomically(args.siteId, args.customerId, tasks));
}

export async function getBatchGroup(args: { siteId: string; customerId: string; batchId: string; repository?: BatchRepository }): Promise<BatchSnapshot> {
  assertSite(args.siteId);
  if (!args.customerId || !args.batchId) throw new WorkspaceError("workspace_batch_not_found", 404);
  const tasks = await (args.repository ?? prismaBatchRepository).listOwned(args.siteId, args.customerId, args.batchId);
  return snapshot(assertBatch(tasks, args.batchId));
}

export async function resumeBatch(args: {
  siteId: string; customerId: string; batchId: string; expectedRevision: number;
  repository?: BatchRepository; runner?: MockBatchRunner;
}): Promise<BatchSnapshot> {
  assertSite(args.siteId);
  assertWritable();
  const repository = args.repository ?? prismaBatchRepository;
  const baseRevision = args.expectedRevision;
  if (!Number.isSafeInteger(baseRevision) || baseRevision < 1) throw new WorkspaceError("revision_required", 428);
  // No production batch executor is wired. Preserve owner/revision errors,
  // then refuse before any state mutation instead of completing a no-op.
  if (!args.runner) {
    const existing = assertBatch(await repository.listOwned(args.siteId, args.customerId, args.batchId), args.batchId);
    if (existing[0].batch.batchRevision !== baseRevision) throw new WorkspaceError("revision_conflict", 409);
    throw new WorkspaceError("workspace_batch_execution_unavailable", 503);
  }
  const queued = await repository.updateOwned({ siteId: args.siteId, customerId: args.customerId, batchId: args.batchId, expectedRevision: baseRevision }, tasks => {
    const ordered = assertBatch(tasks, args.batchId);
    if (ordered[0].batch.cancelRequested) throw new WorkspaceError("batch_cancelled", 409);
    const now = Date.now();
    const resumable = ordered.some(task => task.batch.status === "draft" || task.batch.status === "queued" || task.batch.status === "failed" ||
      (task.batch.status === "running" && Date.parse(task.batch.leaseUntil ?? "") <= now));
    if (!resumable && !ordered.some(task => task.batch.status === "running")) throw new WorkspaceError("batch_not_resumable", 409);
    return ordered.map(task => {
      const expired = task.batch.status === "running" && Date.parse(task.batch.leaseUntil ?? "") <= now;
      if (task.batch.status === "draft" || task.batch.status === "failed" || expired) {
        task.batch.status = "queued"; task.batch.error = undefined; task.batch.leaseUntil = undefined; task.batch.runToken = undefined;
        task.batch.updatedAt = new Date(now).toISOString();
      }
      return task;
    });
  });
  assertBatch(queued, args.batchId);

  const runner = args.runner;
  const worker = async () => {
    while (true) {
      const task = await repository.claimNext(args.siteId, args.customerId, args.batchId);
      if (!task) return;
      const runToken = task.batch.runToken!;
      try {
        await runner(structuredClone(task));
        await repository.finishItem({ siteId: args.siteId, customerId: args.customerId, batchId: args.batchId, taskId: task.taskId, runToken });
      } catch (error) {
        await repository.finishItem({ siteId: args.siteId, customerId: args.customerId, batchId: args.batchId,
          taskId: task.taskId, runToken, error: itemFailureCode(error) });
      }
    }
  };
  await Promise.all(Array.from({ length: MAX_BATCH_CONCURRENCY }, () => worker()));
  const finalTasks = await repository.updateOwned({ siteId: args.siteId, customerId: args.customerId, batchId: args.batchId }, tasks => {
    const ordered = assertBatch(tasks, args.batchId);
    if (!ordered.some(task => ["queued", "running"].includes(task.batch.status)) && ordered[0].batch.batchRevision === baseRevision) {
      ordered.forEach(task => { task.batch.batchRevision = baseRevision + 1; task.batch.updatedAt = new Date().toISOString(); });
    }
    return ordered;
  });
  return snapshot(finalTasks);
}

export async function cancelBatch(args: {
  siteId: string; customerId: string; batchId: string; expectedRevision: number; repository?: BatchRepository;
}): Promise<BatchSnapshot> {
  assertSite(args.siteId);
  assertWritable();
  if (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 1) throw new WorkspaceError("revision_required", 428);
  const repository = args.repository ?? prismaBatchRepository;
  const tasks = await repository.updateOwned({ siteId: args.siteId, customerId: args.customerId, batchId: args.batchId,
    expectedRevision: args.expectedRevision }, current => {
    const ordered = assertBatch(current, args.batchId);
    if (ordered[0].batch.cancelRequested) return ordered;
    if (!ordered.some(task => ["draft", "queued", "running", "failed"].includes(task.batch.status))) throw new WorkspaceError("batch_not_cancellable", 409);
    const nextRevision = ordered[0].batch.batchRevision + 1;
    return ordered.map(task => {
      task.batch.batchRevision = nextRevision;
      task.batch.cancelRequested = true;
      if (task.batch.status === "draft" || task.batch.status === "queued") task.batch.status = "cancelled";
      task.batch.updatedAt = new Date().toISOString();
      return task;
    });
  });
  return snapshot(tasks);
}

interface BatchRow { id: string; data: BatchTask; revision: number; createdAt: Date; updatedAt: Date }
interface RawQueryClient { $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T> }
function readRows(rows: BatchRow[]): BatchTask[] {
  return rows.map(row => ({ ...row.data, revision: row.revision, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }));
}
function assertDbBatch(tasks: BatchTask[], batchId: string): BatchTask[] {
  const ordered = assertBatch(tasks, batchId);
  if (ordered.length !== ordered[0].batch.total) throw new WorkspaceError("batch_creation_incomplete", 409);
  return ordered;
}

async function selectBatchRows(client: RawQueryClient, siteId: string, customerId: string, batchId: string, lock = false): Promise<BatchRow[]> {
  if (lock) return client.$queryRaw<BatchRow[]>`SELECT "id", "data", "revision", "createdAt", "updatedAt" FROM "AidreamcapesVideoTask" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "data"->'batch'->>'batchId' = ${batchId} ORDER BY (("data"->'batch'->>'index')::int) FOR UPDATE`;
  return client.$queryRaw<BatchRow[]>`SELECT "id", "data", "revision", "createdAt", "updatedAt" FROM "AidreamcapesVideoTask" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND "data"->'batch'->>'batchId' = ${batchId} ORDER BY (("data"->'batch'->>'index')::int)`;
}

const prismaBatchRepository: BatchRepository = {
  async listOwned(siteId, customerId, batchId) {
    assertSite(siteId);
    const rows = await selectBatchRows(prisma, siteId, customerId, batchId);
    if (!rows.length) return [];
    return assertDbBatch(readRows(rows), batchId);
  },
  async createAtomically(siteId, customerId, tasks) {
    assertSite(siteId);
    assertWritable();
    if (!tasks.length) throw new WorkspaceError("batch_items_invalid");
    const batchId = tasks[0].batch.batchId;
    const payload = JSON.stringify(tasks.map(task => ({ id: task.taskId, data: task })));
    return prisma.$transaction(async tx => {
      await tx.$queryRaw<{ id: string }[]>`INSERT INTO "AidreamcapesVideoTask" ("id", "siteId", "customerId", "revision", "data") SELECT item.id, ${AIVIDEOSUGC_SITE_ID}, ${customerId}, 1, item.data FROM jsonb_to_recordset(${payload}::jsonb) AS item(id text, data jsonb) WHERE EXISTS (SELECT 1 FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID}) ON CONFLICT ("id") DO NOTHING RETURNING "id"`;
      const rows = await selectBatchRows(tx, siteId, customerId, batchId);
      if (!rows.length) throw new WorkspaceError("customer_site_mismatch", 403);
      const found = assertDbBatch(readRows(rows), batchId);
      if (found.length !== tasks.length || found[0].batch.requestHash !== tasks[0].batch.requestHash) throw new WorkspaceError("idempotency_conflict", 409);
      return found;
    });
  },
  async updateOwned(args, update) {
    assertSite(args.siteId);
    assertWritable();
    return prisma.$transaction(async tx => {
      const rows = await selectBatchRows(tx, args.siteId, args.customerId, args.batchId, true);
      const tasks = assertDbBatch(readRows(rows), args.batchId);
      const currentRevision = tasks[0].batch.batchRevision;
      if (args.expectedRevision !== undefined && currentRevision !== args.expectedRevision) throw new WorkspaceError("revision_conflict", 409);
      const updated = assertDbBatch(update(cloneTasks(tasks)), args.batchId);
      const now = new Date().toISOString();
      const result: BatchTask[] = [];
      for (const row of rows) {
        const task = updated.find(item => item.taskId === row.id);
        if (!task) throw new WorkspaceError("workspace_batch_state_invalid", 409);
        const nextRevision = row.revision + 1;
        const next = { ...task, revision: nextRevision, updatedAt: now };
        const saved = await tx.$queryRaw<BatchRow[]>`UPDATE "AidreamcapesVideoTask" SET "data" = ${JSON.stringify(next)}::jsonb, "revision" = "revision" + 1, "updatedAt" = now() WHERE "id" = ${row.id} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${args.customerId} AND "revision" = ${row.revision} RETURNING "id", "data", "revision", "createdAt", "updatedAt"`;
        if (!saved[0]) throw new WorkspaceError("revision_conflict", 409);
        result.push(...readRows(saved));
      }
      return assertDbBatch(result, args.batchId);
    });
  },
  async claimNext(siteId, customerId, batchId) {
    let claimedId: string | undefined;
    let runToken: string | undefined;
    await this.updateOwned({ siteId, customerId, batchId }, tasks => {
      const ordered = assertBatch(tasks, batchId);
      if (ordered[0].batch.cancelRequested || ordered.filter(task => task.batch.status === "running").length >= MAX_BATCH_CONCURRENCY) return ordered;
      const next = ordered.find(task => task.batch.status === "queued");
      if (!next) return ordered;
      claimedId = next.taskId; runToken = randomUUID();
      next.batch.status = "running"; next.batch.attempts++; next.batch.runToken = runToken;
      next.batch.leaseUntil = new Date(Date.now() + 5 * 60_000).toISOString(); next.batch.updatedAt = new Date().toISOString();
      return ordered;
    });
    if (!claimedId || !runToken) return undefined;
    const tasks = await this.listOwned(siteId, customerId, batchId);
    return tasks.find(task => task.taskId === claimedId && task.batch.runToken === runToken);
  },
  async finishItem(args) {
    await this.updateOwned({ siteId: args.siteId, customerId: args.customerId, batchId: args.batchId }, tasks => {
      const ordered = assertBatch(tasks, args.batchId);
      const task = ordered.find(item => item.taskId === args.taskId);
      if (!task || task.batch.status !== "running" || task.batch.runToken !== args.runToken) return ordered;
      task.batch.status = ordered[0].batch.cancelRequested ? "cancelled" : args.error ? "failed" : "completed";
      task.batch.error = task.batch.status === "failed" ? args.error : undefined;
      task.batch.runToken = undefined; task.batch.leaseUntil = undefined; task.batch.updatedAt = new Date().toISOString();
      return ordered;
    });
  }
};
