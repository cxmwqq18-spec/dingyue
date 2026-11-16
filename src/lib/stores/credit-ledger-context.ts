import "server-only";
import { prisma } from "@/lib/prisma";
import type { CreditEntryDetail, CreditEntryMedia, CreditEntryOutlineShot, GenerationDetail, LedgerGenerationStatus, LedgerType, ThemeRuntimeGenerationContext, ThemeRuntimeJob, ThemeRuntimeLedgerEntry } from "@/lib/types";

/**
 * The account ledger lists balance movements, so a generation charge reads as
 * "Credits used / AI generation" plus an internal id. Customers cannot tell
 * which video that charge paid for. This module joins those movements back to
 * the work they paid for — the workspace task (title, prompt, outline, and
 * finished film) or the generation job — and returns the fields the account
 * surfaces render.
 */

const TASK_HOLD_SOURCE_TYPE = "workspace_task_hold";
const JOB_SOURCE_TYPES = new Set(["generation_job", "job"]);
/** Workspace defaults that say nothing about the actual content. */
const GENERIC_TASK_TITLES = new Set(["product demo", "text to video", "image to video", "ugc ad video", "video"]);
const SUMMARY_LIMIT = 170;
const TITLE_LIMIT = 64;
const LANGUAGE_LABELS: Record<string, string> = { en: "English", zh: "Chinese", es: "Spanish", ja: "Japanese", ko: "Korean" };

type TaskShotVersion = {
  vid?: unknown;
  status?: unknown;
  clipUrl?: unknown;
};

type TaskShot = {
  shotId?: unknown;
  start?: unknown;
  end?: unknown;
  duration?: unknown;
  visual?: unknown;
  voiceover?: unknown;
  prompt?: unknown;
  camera?: unknown;
  framing?: unknown;
  lighting?: unknown;
  expression?: unknown;
  environment?: unknown;
  curVer?: unknown;
  refImgs?: unknown;
  versions?: TaskShotVersion[];
};

type TaskData = {
  title?: unknown;
  status?: unknown;
  sceneId?: unknown;
  input?: {
    fields?: Record<string, unknown>;
    images?: Record<string, unknown>;
    options?: { aspect?: unknown; duration?: unknown; resolution?: unknown; language?: unknown };
  };
  storyboard?: { shots?: TaskShot[] };
  video?: {
    stale?: unknown;
    finalUrl?: unknown;
    clips?: Array<{ clipUrl?: unknown; shotId?: unknown; vid?: unknown }>;
  };
};

type LedgerRow = {
  id: string;
  amount: number;
  type: string;
  sourceType: string;
  sourceId: string;
  createdAt: Date | string;
};

type GenerationJobRow = {
  id: string;
  status: string;
  creditsReserved: number;
  requestJson: unknown;
  resultJson: unknown;
};

type AssetRow = {
  id: string;
  customerId: string;
  jobId: string | null;
  mimeType: string;
  role: string;
  siteId: string;
  storageKey: string;
};

/** A ledger movement or generation request, reduced to what must be resolved. */
type GenerationTarget = { jobId?: string; taskId?: string };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringsOf(value: unknown): string[] {
  if (typeof value === "string") return [value.trim()].filter(Boolean);
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  return [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function assetMediaUrl(asset: Pick<AssetRow, "customerId" | "id" | "siteId">): string {
  return `/api/sites/${asset.siteId}/customers/${asset.customerId}/assets/${asset.id}/download`;
}

function assetMedia(asset: AssetRow, label: string): CreditEntryMedia {
  return { downloadUrl: assetMediaUrl(asset), label, url: `${assetMediaUrl(asset)}?preview=1` };
}

/** Task clips and renders already carry preview query strings; the same path
 * without those flags downloads the file. */
function previewMedia(url: string, label: string): CreditEntryMedia {
  const [path, query] = url.split("?", 2);
  const params = new URLSearchParams(query ?? "");
  params.delete("preview");
  params.delete("poster");
  const search = params.toString();
  return { downloadUrl: search ? `${path}?${search}` : path, label, url };
}

function summaryOf(value: string, limit = SUMMARY_LIMIT): string {
  const cleaned = value
    .replace(/【[^】]*】/g, " ")
    .replace(/参考图[:：][^\n]*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const sentence = cleaned.match(/^.{12,}?[.!?。！？](?=\s|$)/)?.[0] ?? cleaned;
  const trimmed = sentence.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1).trimEnd()}…` : trimmed;
}

function taskData(value: unknown): TaskData {
  return record(value) as TaskData;
}

function jobFields(job: GenerationJobRow): Record<string, unknown> {
  return record(record(job.requestJson).fields);
}

function jobTaskId(job: GenerationJobRow): string {
  return text(record(record(job.requestJson).workspace).taskId);
}

/** The brief the customer wrote; it also carries the shot outline when the
 * workspace has not expanded it into storyboard rows yet. */
function taskPrompt(data: TaskData): string {
  const steps = text(data.input?.fields?.steps);
  if (steps) return steps;
  const storedPrompt = text(data.storyboard?.shots?.[0]?.prompt);
  if (storedPrompt) return storedPrompt;
  return text(data.storyboard?.shots?.[0]?.visual);
}

function jobPrompt(job: GenerationJobRow): string {
  const rendered = text(record(record(job.requestJson).prompt).rendered);
  if (rendered) return rendered;
  return text(jobFields(job).promptNote);
}

/** Named titles identify the work directly; workspace defaults ("Product demo")
 * say nothing, so those fall back to the customer's own brief. */
function displayTitle(titles: Array<string | undefined>, prompt: string): string {
  for (const title of titles) {
    const value = text(title);
    if (!value || GENERIC_TASK_TITLES.has(value.toLowerCase())) continue;
    return value;
  }
  return summaryOf(prompt, TITLE_LIMIT);
}

function numberValue(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function shotTiming(shot: TaskShot): { start?: number; end?: number; duration?: number } | undefined {
  const start = Number(shot.start);
  const end = Number(shot.end);
  const declared = numberValue(shot.duration);
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return { duration: declared ?? end - start, end, start };
  }
  return declared ? { duration: declared, start: Number.isFinite(start) ? start : undefined } : undefined;
}

function taskDuration(data: TaskData): number | undefined {
  const shots = data.storyboard?.shots ?? [];
  const total = shots.reduce((sum, shot) => sum + (shotTiming(shot)?.duration ?? 0), 0);
  if (total > 0) return Math.round(total);
  return numberValue(data.input?.options?.duration);
}

/** Reference frames the customer attached, which identify the video at a
 * glance without decoding it. */
function taskImages(data: TaskData): string[] {
  const declared = Object.values(record(data.input?.images)).flatMap(stringsOf);
  const shotRefs = (data.storyboard?.shots ?? []).flatMap((shot) => Object.values(record(shot.refImgs)).flatMap(stringsOf));
  return unique([...declared, ...shotRefs]);
}

/** Shot id → rendered clip, preferring the video record over shot versions. */
function shotClipUrls(data: TaskData): Map<string, string> {
  const urls = new Map<string, string>();
  for (const shot of data.storyboard?.shots ?? []) {
    const shotId = text(shot.shotId);
    const versions = shot.versions ?? [];
    const current = versions.find((version) => text(version.vid) === text(shot.curVer)) ?? versions.at(-1);
    const clipUrl = text(current?.clipUrl);
    if (shotId && clipUrl) urls.set(shotId, clipUrl);
  }
  for (const clip of data.video?.clips ?? []) {
    const shotId = text(clip.shotId);
    const clipUrl = text(clip.clipUrl);
    if (shotId && clipUrl) urls.set(shotId, clipUrl);
  }
  return urls;
}

function taskOutline(data: TaskData): CreditEntryOutlineShot[] {
  const clips = shotClipUrls(data);
  return (data.storyboard?.shots ?? []).map((shot, index) => {
    const timing = shotTiming(shot);
    return {
      camera: text(shot.camera),
      clipUrl: clips.get(text(shot.shotId)),
      duration: timing?.duration,
      end: timing?.end,
      expression: text(shot.expression),
      framing: text(shot.framing),
      index: index + 1,
      lighting: text(shot.lighting),
      start: timing?.start,
      visual: text(shot.visual) || text(shot.prompt),
      voiceover: text(shot.voiceover)
    };
  });
}

function taskFinalVideo(data: TaskData): string | undefined {
  const finalUrl = text(data.video?.finalUrl);
  if (finalUrl && data.video?.stale !== true) return finalUrl;
  const clips = data.video?.clips ?? [];
  return clips.map((clip) => text(clip.clipUrl)).find(Boolean);
}

function taskStatus(value: unknown): LedgerGenerationStatus {
  const status = text(value);
  if (status === "completed") return "completed";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "draft") return "draft";
  return status ? "generating" : "unknown";
}

function jobStatus(value: unknown): LedgerGenerationStatus {
  const status = text(value);
  if (status === "succeeded") return "completed";
  if (status === "failed") return "failed";
  if (status === "cancelled") return "cancelled";
  if (status === "refunded") return "cancelled";
  return "generating";
}

/** A ledger movement points at either a workspace task or a generation job. */
function ledgerTarget(entry: Pick<LedgerRow, "sourceType" | "sourceId">): { jobId?: string; taskId?: string } {
  if (JOB_SOURCE_TYPES.has(entry.sourceType)) {
    const jobId = text(entry.sourceId);
    return jobId ? { jobId } : {};
  }
  if (entry.sourceType === TASK_HOLD_SOURCE_TYPE) {
    // Hold entries key on `${taskId}:${reference}`. The workspace also appends
    // the job that created the hold, which still identifies the generation
    // when the task row itself has been cleaned up.
    const segments = text(entry.sourceId).split(":").map((segment) => segment.trim()).filter(Boolean);
    const taskId = segments[0];
    const jobId = segments.slice(1).find((segment) => /^(job|gen)_/.test(segment));
    return {
      ...(taskId ? { taskId } : {}),
      ...(jobId ? { jobId } : {})
    };
  }
  return {};
}

function jobModelLabel(fields: Record<string, unknown>): string | undefined {
  return text(fields.videoThemeName) || text(fields.videoModelFamily) || text(fields.modelFamily) || undefined;
}

function jobAspectRatio(fields: Record<string, unknown>): string | undefined {
  return text(fields.aspectRatio) || text(fields.aspect) || undefined;
}

function jobDuration(fields: Record<string, unknown>): number | undefined {
  return numberValue(fields.durationSeconds) ?? numberValue(fields.videoDurationSeconds) ?? numberValue(fields.duration);
}

function jobKind(job: GenerationJobRow): "video" | "image" {
  const fields = jobFields(job);
  const mode = text(fields.mode) || text(record(job.requestJson).mode) || text(fields.outputType) || text(record(job.requestJson).outputType);
  return mode === "image" ? "image" : "video";
}

function resolveFromTask(task: { id: string; data: unknown }, job: GenerationJobRow | undefined): GenerationDetail {
  const data = taskData(task.data);
  const prompt = taskPrompt(data) || (job ? jobPrompt(job) : "");
  const images = taskImages(data);
  const outline = taskOutline(data);
  const finalVideoUrl = taskFinalVideo(data);
  const options = data.input?.options ?? {};
  return {
    aspectRatio: text(options.aspect) || undefined,
    clips: outline.flatMap((shot) => shot.clipUrl ? [previewMedia(shot.clipUrl, `Shot ${shot.index}`)] : []),
    durationSeconds: taskDuration(data),
    finalVideo: finalVideoUrl ? previewMedia(finalVideoUrl, "Finished video") : undefined,
    inputs: images.slice(0, 8).map((url, index) => previewMedia(url, `Reference ${index + 1}`)),
    jobId: job?.id,
    kind: job ? jobKind(job) : "video",
    language: LANGUAGE_LABELS[text(options.language)] ?? (text(options.language) || undefined),
    modelLabel: job ? jobModelLabel(jobFields(job)) : undefined,
    outline,
    primaryVideo: finalVideoUrl ? previewMedia(finalVideoUrl, "Finished video") : undefined,
    prompt,
    resolution: text(options.resolution) || undefined,
    shotCount: outline.length,
    // The job carries the billing outcome, so it wins when both rows exist and
    // the workspace task has not caught up yet.
    status: job ? jobStatus(job.status) : taskStatus(data.status),
    summary: summaryOf(prompt),
    taskId: task.id,
    thumbnailUrl: images[0],
    title: displayTitle([text(data.title)], prompt) || (job ? jobModelLabel(jobFields(job)) : undefined) || "AI video"
  };
}

/** Older jobs record their renders in resultJson instead of asset rows; the
 * files still live under the customer's asset prefix. */
function jobStoredOutputs(job: GenerationJobRow): Array<{ media: CreditEntryMedia; video: boolean }> {
  const outputs = record(job.resultJson).outputs;
  if (!Array.isArray(outputs)) return [];
  return outputs
    .map((value) => record(value))
    .map((output) => ({ mimeType: text(output.mimeType), storageKey: text(output.storageKey) }))
    .filter((output) => output.storageKey.startsWith("sites/"))
    .map((output, index) => {
      const path = `/api/local-assets/${output.storageKey}`;
      const video = output.mimeType.startsWith("video/");
      return {
        media: {
          downloadUrl: path,
          label: `${video ? "Finished video" : "Finished image"}${index > 0 ? ` ${index + 1}` : ""}`,
          url: `${path}?preview=1`
        },
        video
      };
    });
}

function resolveFromJob(job: GenerationJobRow, assets: AssetRow[]): GenerationDetail {
  const fields = jobFields(job);
  const prompt = jobPrompt(job);
  const videoAssets = assets.filter((asset) => asset.mimeType.startsWith("video/"));
  const imageAssets = assets.filter((asset) => asset.mimeType.startsWith("image/"));
  const outputVideo = videoAssets.find((asset) => asset.role === "output") ?? videoAssets[0];
  const outputImage = imageAssets.find((asset) => asset.role === "output") ?? imageAssets[0];
  const inputImages = imageAssets.filter((asset) => asset.role !== "output");
  const storedOutputs = jobStoredOutputs(job);
  const storedVideo = storedOutputs.find((output) => output.video)?.media;
  const storedImage = storedOutputs.find((output) => !output.video)?.media;
  const finalVideo = outputVideo ? assetMedia(outputVideo, "Finished file") : storedVideo;
  const kind = jobKind(job);
  const title = displayTitle([], prompt) || jobModelLabel(fields) || "AI video";
  return {
    aspectRatio: jobAspectRatio(fields),
    clips: [],
    durationSeconds: jobDuration(fields),
    finalVideo,
    inputs: inputImages.slice(0, 8).map((asset, index) => assetMedia(asset, `Reference ${index + 1}`)),
    jobId: job.id,
    kind,
    language: undefined,
    modelLabel: jobModelLabel(fields),
    outline: [],
    primaryVideo: finalVideo ?? (outputImage ? assetMedia(outputImage, "Finished image") : storedImage),
    prompt,
    resolution: text(fields.resolution) || undefined,
    shotCount: 0,
    status: jobStatus(job.status),
    summary: summaryOf(prompt),
    taskId: jobTaskId(job) || undefined,
    title,
    // Reference stills stand in for missing task data; a video poster would
    // require decoding the render for every ledger row.
    thumbnailUrl: inputImages[0]
      ? `${assetMediaUrl(inputImages[0])}?preview=1`
      : outputImage ? `${assetMediaUrl(outputImage)}?preview=1` : storedImage?.url,
  };
}

function targetKey(target: GenerationTarget): string {
  return target.jobId ? `job:${target.jobId}` : `task:${target.taskId ?? ""}`;
}

/** Resolve a page of generations in one pass: at most one job lookup, one task
 * lookup, and the assets needed for job-only generations. */
async function resolveGenerationTargets({
  owner,
  targets
}: {
  owner: { customerId: string; siteId: string };
  targets: GenerationTarget[];
}): Promise<Map<string, GenerationDetail>> {
  const details = new Map<string, GenerationDetail>();
  if (!targets.length) return details;

  const jobIds = new Set<string>();
  const directTaskIds = new Set<string>();
  for (const target of targets) {
    if (target.jobId) jobIds.add(target.jobId);
    if (target.taskId) directTaskIds.add(target.taskId);
  }

  const jobs: GenerationJobRow[] = jobIds.size
    ? await prisma.generationJob.findMany({
        select: { creditsReserved: true, id: true, requestJson: true, resultJson: true, status: true },
        where: { customerId: owner.customerId, id: { in: [...jobIds] }, siteId: owner.siteId }
      })
    : [];
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  for (const job of jobs) {
    const taskId = jobTaskId(job);
    if (taskId) directTaskIds.add(taskId);
  }

  const tasks = directTaskIds.size
    ? await prisma.aidreamcapesVideoTask.findMany({
        select: { data: true, id: true },
        where: { customerId: owner.customerId, id: { in: [...directTaskIds] }, siteId: owner.siteId }
      })
    : [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));

  const jobOnlyIds = jobs.filter((job) => {
    const taskId = jobTaskId(job);
    return !taskId || !tasksById.has(taskId);
  }).map((job) => job.id);
  const assets: AssetRow[] = jobOnlyIds.length
    ? await prisma.assetUpload.findMany({
        orderBy: { createdAt: "asc" },
        select: { customerId: true, id: true, jobId: true, mimeType: true, role: true, siteId: true, storageKey: true },
        where: { customerId: owner.customerId, deletedAt: null, jobId: { in: jobOnlyIds }, siteId: owner.siteId }
      })
    : [];
  const assetsByJob = new Map<string, AssetRow[]>();
  for (const asset of assets) {
    if (!asset.jobId) continue;
    assetsByJob.set(asset.jobId, [...(assetsByJob.get(asset.jobId) ?? []), asset]);
  }

  for (const target of targets) {
    const job = target.jobId ? jobsById.get(target.jobId) : undefined;
    const task = tasksById.get(target.taskId ?? "") ?? (job ? tasksById.get(jobTaskId(job)) : undefined);
    if (task) {
      details.set(targetKey(target), resolveFromTask(task, job));
    } else if (job) {
      details.set(targetKey(target), resolveFromJob(job, assetsByJob.get(job.id) ?? []));
    }
  }
  return details;
}

function contextOf(detail: GenerationDetail): ThemeRuntimeGenerationContext {
  return {
    aspectRatio: detail.aspectRatio,
    durationSeconds: detail.durationSeconds,
    jobId: detail.jobId,
    kind: detail.kind,
    modelLabel: detail.modelLabel,
    resolution: detail.resolution,
    shotCount: detail.shotCount || undefined,
    status: detail.status,
    summary: detail.summary || detail.title,
    taskId: detail.taskId,
    thumbnailUrl: detail.thumbnailUrl,
    title: detail.title,
    videoUrl: detail.finalVideo?.url ?? detail.primaryVideo?.url
  };
}

const EMPTY_DETAIL: GenerationDetail = {
  aspectRatio: undefined,
  clips: [],
  durationSeconds: undefined,
  finalVideo: undefined,
  inputs: [],
  kind: "video",
  modelLabel: undefined,
  outline: [],
  primaryVideo: undefined,
  prompt: "",
  resolution: undefined,
  shotCount: 0,
  status: "unknown",
  summary: "",
  title: ""
};

/** Attach the generation each movement paid for to the ledger entries. */
export async function enrichLedgerEntriesWithGeneration({
  customerId,
  entries,
  siteId
}: {
  customerId: string;
  entries: ThemeRuntimeLedgerEntry[];
  siteId: string;
}): Promise<ThemeRuntimeLedgerEntry[]> {
  if (!entries.length) return entries;
  const targets = entries.map((entry) => ledgerTarget(entry as LedgerRow));
  const details = await resolveGenerationTargets({ owner: { customerId, siteId }, targets });
  return entries.map((entry, index) => {
    const detail = details.get(targetKey(targets[index]));
    // Internal source ids stay server-side; the ledger renders the generation.
    const { sourceId: _sourceId, ...rest } = entry;
    return detail ? { ...rest, context: contextOf(detail) } : rest;
  });
}

/** Attach the same display fields to the account's generation list. */
export async function enrichJobsWithGeneration({
  customerId,
  jobs,
  siteId
}: {
  customerId: string;
  jobs: ThemeRuntimeJob[];
  siteId: string;
}): Promise<ThemeRuntimeJob[]> {
  if (!jobs.length) return jobs;
  const targets: GenerationTarget[] = jobs.map((job) => ({ jobId: job.id }));
  const details = await resolveGenerationTargets({ owner: { customerId, siteId }, targets });
  return jobs.map((job) => {
    const detail = details.get(targetKey({ jobId: job.id }));
    return detail ? { ...job, context: contextOf(detail) } : job;
  });
}

/** One generation resolved by id, for the detail sheet. */
export async function readGenerationDetail({
  customerId,
  jobId,
  siteId,
  taskId
}: {
  customerId: string;
  jobId?: string;
  siteId: string;
  taskId?: string;
}): Promise<GenerationDetail | undefined> {
  const target: GenerationTarget | undefined = jobId ? { jobId } : taskId ? { taskId } : undefined;
  if (!target) return undefined;
  const details = await resolveGenerationTargets({ owner: { customerId, siteId }, targets: [target] });
  return details.get(targetKey(target));
}

/** The credit entry detail sheet: what the movement paid for, its outline,
 * and the finished film. */
export async function readCreditEntryDetail({
  customerId,
  entryId,
  siteId
}: {
  customerId: string;
  entryId: string;
  siteId: string;
}): Promise<CreditEntryDetail | undefined> {
  const row = await prisma.creditLedger.findFirst({
    where: { customerId, id: entryId, siteId }
  });
  if (!row) return undefined;
  const entry: ThemeRuntimeLedgerEntry = {
    amount: row.amount,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    id: row.id,
    sourceId: row.sourceId,
    sourceType: row.sourceType,
    type: row.type as LedgerType
  };
  const detail = await readGenerationDetail({
    customerId,
    siteId,
    ...ledgerTarget(row as LedgerRow)
  });
  return { entry, ...(detail ?? EMPTY_DETAIL) };
}
