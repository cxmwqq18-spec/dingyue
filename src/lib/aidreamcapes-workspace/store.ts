import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { releaseWorkspaceTaskHoldRelational } from "@/lib/stores/job-store";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError, type WorkspaceTask, type TaskInput, type SceneId, type ActorAsset, type ProductBriefSnapshot } from "./types";
import { createActorVoiceSnapshot } from "./pipeline";
import type { WorkspacePreset } from "./preset-contract";

export interface TaskOperation {
  id: string; action: string; shotId?: string; versionId?: string; language?: string;
  state: "pending" | "run" | "done" | "fail" | "cancelled"; leaseUntil?: string; attempts: number; error?: string;
  quoteToken?: string; quotedRevision?: number; expectedCredits?: number;
}
export type StoredTask = WorkspaceTask & { operation?: TaskOperation; creationHash?: string };
type Row = { data: StoredTask; revision: number; createdAt: Date; updatedAt: Date };
function stripLegacyTaskVoiceSelection(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripLegacyTaskVoiceSelection);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== "vocalTimbre" && key !== "vocalRef")
    .map(([key, nested]) => [key, stripLegacyTaskVoiceSelection(nested)]));
}
function read(row: Row): StoredTask {
  // A role card now owns its voice profile. Drop the old task/shot-level voice
  // overrides when reading pre-migration JSON so they cannot surface or drift.
  const data = stripLegacyTaskVoiceSelection(row.data) as StoredTask;
  return { ...data, revision: row.revision, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}
export function assertWorkspaceSite(siteId: string) {
  if (siteId !== AIVIDEOSUGC_SITE_ID) throw new WorkspaceError("workspace_site_not_found", 404);
}
function assertWritable() {
  if ([process.env.DATABASE_TARGET, process.env.DINGYUE_ENV].some(value => value?.trim().toLowerCase() === "remote-readonly")) throw new WorkspaceError("workspace_database_readonly", 403);
}
export async function listTasks(siteId: string, customerId: string, options: { limit?: number; offset?: number; filter?: "subtitle_ready"; query?: string } = {}): Promise<StoredTask[]> {
  assertWorkspaceSite(siteId);
  const limit = Math.min(Math.max(Math.trunc(options.limit ?? 100), 1), 100);
  const offset = Math.max(Math.trunc(options.offset ?? 0), 0);
  // subtitle_ready keeps the Subtitle Studio pager meaningful: it pages over
  // the finished videos themselves instead of the whole task window, so the
  // studio shows the same complete set on every visit.
  const ready = options.filter === "subtitle_ready"
    ? Prisma.sql`AND "data"->'video'->>'status' = 'done' AND COALESCE("data"->'video'->>'finalUrl','') <> '' AND COALESCE("data"->'video'->>'stale','false') <> 'true'`
    : Prisma.sql``;
  const rawQuery = options.query?.trim();
  // Search matches the title and any prompt/brief text stored in the input.
  const search = rawQuery
    ? Prisma.sql`AND ("data"->>'title' ILIKE ${`%${rawQuery.replace(/([%_\\])/g, "\\$1")}%`} OR ("data"->'input')::text ILIKE ${`%${rawQuery.replace(/([%_\\])/g, "\\$1")}%`})`
    : Prisma.sql``;
  const rows = await prisma.$queryRaw<Row[]>`SELECT "data", "revision", "createdAt", "updatedAt" FROM "AidreamcapesVideoTask" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} ${ready} ${search} ORDER BY "updatedAt" DESC LIMIT ${limit} OFFSET ${offset}`;
  return rows.map(read);
}
export async function getTask(siteId: string, customerId: string, taskId: string): Promise<StoredTask> {
  assertWorkspaceSite(siteId);
  const rows = await prisma.$queryRaw<Row[]>`SELECT "data", "revision", "createdAt", "updatedAt" FROM "AidreamcapesVideoTask" WHERE "id" = ${taskId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}`;
  if (!rows[0]) throw new WorkspaceError("task_not_found", 404);
  return read(rows[0]);
}
export async function createTask(siteId: string, customerId: string, sceneId: SceneId, input: TaskInput, actors: ActorAsset[], title?: string, creationKey?: string, productBrief?: ProductBriefSnapshot, sourceTemplate?: WorkspacePreset): Promise<StoredTask> {
  assertWorkspaceSite(siteId);
  assertWritable();
  const now = new Date().toISOString();
  const taskId = creationKey ? `ugc-${createHash("sha256").update(`${siteId}:${customerId}:${creationKey}`).digest("hex")}` : randomUUID();
  const creationHash = createHash("sha256").update(JSON.stringify({ sceneId, input, title, productBrief, sourceTemplate })).digest("hex");
  const voiceSnapshot = input.actorId ? createActorVoiceSnapshot(actors.find((actor) => actor.actorId === input.actorId)) : undefined;
  const task: StoredTask = { taskId, siteId: AIVIDEOSUGC_SITE_ID, customerId, sceneId, creationHash,
    title: title?.trim().slice(0, 160) || "Untitled video", status: "draft", createdAt: now, updatedAt: now,
    revision: 1, input, voiceSnapshot, productBrief: productBrief ? structuredClone(productBrief) : undefined,
    sourceTemplate: sourceTemplate ? structuredClone(sourceTemplate) : undefined,
    storyboardStale: false, storyboardHistory: [], revisions: productBrief ? [{ at: now, field: "productBrief", before: null, after: structuredClone(productBrief) }] : [], videoHistory: [] };
  const rows = await prisma.$queryRaw<Row[]>`INSERT INTO "AidreamcapesVideoTask" ("id", "siteId", "customerId", "revision", "data") SELECT ${task.taskId}, ${AIVIDEOSUGC_SITE_ID}, ${customerId}, 1, ${JSON.stringify(task)}::jsonb FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} ON CONFLICT ("id") DO NOTHING RETURNING "data", "revision", "createdAt", "updatedAt"`;
  if (!rows[0]) {
    if (!creationKey) throw new WorkspaceError("customer_site_mismatch", 403);
    const existing = await getTask(siteId, customerId, taskId);
    if (existing.creationHash !== creationHash) throw new WorkspaceError("idempotency_conflict", 409);
    return existing;
  }
  return read(rows[0]);
}
export async function saveTask(task: StoredTask, expectedRevision: number): Promise<StoredTask> {
  assertWorkspaceSite(task.siteId);
  assertWritable();
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1) throw new WorkspaceError("revision_required", 428);
  const next = { ...task, revision: expectedRevision + 1, updatedAt: new Date().toISOString() };
  const rows = await prisma.$queryRaw<Row[]>`UPDATE "AidreamcapesVideoTask" SET "data" = ${JSON.stringify(next)}::jsonb, "revision" = "revision" + 1, "updatedAt" = now() WHERE "id" = ${task.taskId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${task.customerId} AND "revision" = ${expectedRevision} AND (COALESCE("data"->>'status', '') <> 'cancelled' OR ${next.status} = 'cancelled') RETURNING "data", "revision", "createdAt", "updatedAt"`;
  if (!rows[0]) throw new WorkspaceError("revision_conflict", 409);
  return read(rows[0]);
}
export async function deleteTask(task: StoredTask, expectedRevision: number): Promise<void> {
  assertWritable();
  if (task.operation?.state === "run" || task.operation?.state === "pending" || task.storyboard?.shots.some(s => s.genStatus === "run" || s.compositeStatus === "run")) throw new WorkspaceError("task_busy", 409);
  // 删除前释放任务剩余积分冻结额；释放成功但删除冲突时，后续终态钩子仍可释放，最多多退不少。
  try { await releaseWorkspaceTaskHoldRelational({ siteId: task.siteId, customerId: task.customerId, taskId: task.taskId, ref: "delete" }); }
  catch (error) { console.error("[aivideosugc-workspace] task hold release", error); }
  const count = await prisma.$executeRaw`DELETE FROM "AidreamcapesVideoTask" WHERE "id" = ${task.taskId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${task.customerId} AND "revision" = ${expectedRevision}`;
  if (!count) throw new WorkspaceError("revision_conflict", 409);
}
export function publicTask(task: StoredTask): WorkspaceTask & { operation?: Pick<TaskOperation, "action" | "state" | "error"> } {
  const { operation, creationHash: _creationHash, ...result } = task;
  const interrupted = operation?.state === "run" && Date.parse(operation.leaseUntil || "") <= Date.now();
  return operation ? { ...result, operation: { action: operation.action, state: operation.state, error: interrupted ? "operation_interrupted" : operation.error } } : result;
}

export async function listActors(siteId: string, customerId: string): Promise<ActorAsset[]> {
  assertWorkspaceSite(siteId);
  const rows = await prisma.$queryRaw<{ data: ActorAsset }[]>`SELECT "data" FROM "AidreamcapesWorkspaceActor" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} ORDER BY "createdAt" DESC LIMIT 100`;
  return rows.map(row => row.data);
}
export async function createActor(siteId: string, customerId: string, actor: ActorAsset): Promise<ActorAsset> {
  assertWorkspaceSite(siteId);
  assertWritable();
  const count = await prisma.$executeRaw`INSERT INTO "AidreamcapesWorkspaceActor" ("id", "siteId", "customerId", "data") SELECT ${actor.actorId}, ${AIVIDEOSUGC_SITE_ID}, ${customerId}, ${JSON.stringify(actor)}::jsonb FROM "Customer" WHERE "id" = ${customerId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID}`;
  if (!count) throw new WorkspaceError("customer_site_mismatch", 403);
  return actor;
}
export async function deleteActor(siteId: string, customerId: string, actorId: string): Promise<void> {
  assertWorkspaceSite(siteId);
  assertWritable();
  const used = await prisma.$queryRaw<{ id: string }[]>`SELECT "id" FROM "AidreamcapesVideoTask" WHERE "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId} AND ("data"->'input'->>'actorId' = ${actorId} OR "data"::text LIKE ${`%${actorId}%`}) LIMIT 1`;
  if (used.length) throw new WorkspaceError("actor_in_use", 409);
  const count = await prisma.$executeRaw`DELETE FROM "AidreamcapesWorkspaceActor" WHERE "id" = ${actorId} AND "siteId" = ${AIVIDEOSUGC_SITE_ID} AND "customerId" = ${customerId}`;
  if (!count) throw new WorkspaceError("actor_not_found", 404);
}
