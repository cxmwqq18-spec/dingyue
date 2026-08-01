import type { GenerationJob, JobStatus } from "@/lib/types";

export type AdminProcessFilter = "active" | "terminated" | "failed" | "all";
export type AdminProcessKind = "image" | "video";

export type AdminProcessView = {
  id: string;
  siteId: string;
  customerId: string;
  aiAppId: string;
  alias: string;
  appName: string;
  canRecoverVideo: boolean;
  canTerminate: boolean;
  createdAt: string;
  creditsReserved: number;
  customerEmail: string;
  displayStatus: string;
  kind: AdminProcessKind;
  kindLabel: string;
  outputSlotSummary: string;
  progress?: number;
  providerTaskId?: string;
  runtimeMs: number;
  shortId: string;
  stage: string;
  stageLabel: string;
  status: JobStatus;
  terminated: boolean;
  terminationReason?: string;
  terminationActorId?: string;
  terminationAt?: string;
  tone: "good" | "warn" | "bad" | "neutral";
  updatedAt: string;
};

const jobStatusLabels: Record<JobStatus, string> = {
  queued: "排队中",
  running: "生成中",
  succeeded: "已完成",
  failed: "失败",
  refunded: "已退款"
};

const stageLabels: Record<string, string> = {
  admin_terminated: "管理员已终止",
  generation_job_expired: "任务已过期释放",
  video_provider_create_timeout: "视频供应商创建超时",
  local_worker_started: "本地 worker 已启动",
  local_video_worker_started: "视频 worker 已启动",
  provider_request_started: "已请求供应商",
  provider_response_received: "已收到输出",
  provider_slot_failed: "输出生成失败",
  source_images_ready: "素材已准备",
  video_provider_completed: "视频已完成",
  video_provider_failed: "视频供应商失败",
  video_provider_poll_retry: "视频轮询重试",
  video_provider_request_started: "视频请求已提交",
  video_provider_create_started: "正在提交视频任务",
  video_provider_running: "视频生成中",
  video_reference_format_ready: "视频参考图已准备",
  video_result_received: "视频结果已收到",
  video_scene_composition_started: "视频首帧合成中",
  video_task_created: "供应商任务已创建",
  worker_update: "worker 已更新"
};

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown): number | undefined {
  if (!Number.isFinite(Number(value))) return undefined;
  return Math.max(0, Math.min(100, Number(value)));
}

export function isTerminatedGenerationJob(job: Pick<GenerationJob, "resultJson" | "status">): boolean {
  const result = recordValue(job.resultJson);
  return job.status === "failed" &&
    (stringValue(result.error) === "generation_job_terminated_by_admin" || Boolean(recordValue(result.termination).terminatedAt));
}

export function generationProcessKind(job: Pick<GenerationJob, "requestJson">): AdminProcessKind {
  const request = recordValue(job.requestJson);
  const fields = recordValue(request.fields);
  const flow = recordValue(request.flow);
  const videoTheme = recordValue(request.videoTheme);
  const isVideo =
    stringValue(flow.aiAppSlug) === "video_generator" ||
    stringValue(request.mode) === "video" ||
    stringValue(request.outputType) === "video" ||
    stringValue(fields.mode) === "video" ||
    stringValue(fields.outputType) === "video" ||
    Boolean(videoTheme.id);
  return isVideo ? "video" : "image";
}

export function generationProcessDetailLabel(job: Pick<GenerationJob, "requestJson">, appName: string): string {
  const request = recordValue(job.requestJson);
  const fields = recordValue(request.fields);
  const flow = recordValue(request.flow);
  const creativePack = recordValue(request.creativePack);
  const videoTheme = recordValue(request.videoTheme);
  return (
    stringValue(videoTheme.name) ||
    stringValue(creativePack.name) ||
    stringValue(fields.creativePackName) ||
    stringValue(fields.videoThemeName) ||
    stringValue(flow.flowName) ||
    appName ||
    "AI 生成"
  );
}

export function providerTaskIdFromJobResult(resultJson?: Record<string, unknown>): string | undefined {
  const result = recordValue(resultJson);
  if (stringValue(result.providerTaskId)) return stringValue(result.providerTaskId);
  const slots = Array.isArray(result.outputSlots)
    ? result.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  for (const slot of slots) {
    const providerTaskId = stringValue(slot.providerTaskId);
    if (providerTaskId) return providerTaskId;
  }
  return undefined;
}

export function stageLabel(value: string): string {
  if (!value) return "等待 worker";
  const normalized = value.replace(/_\d+$/, "");
  return stageLabels[value] ?? stageLabels[normalized] ?? value.replace(/_/g, " ");
}

export function outputSlotSummaryFromJob(job: Pick<GenerationJob, "resultJson">): string {
  const result = recordValue(job.resultJson);
  const slots = Array.isArray(result.outputSlots)
    ? result.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  if (!slots.length) return "暂无输出槽";
  const counts = slots.reduce<{ failed: number; queued: number; running: number; succeeded: number }>(
    (summary, slot) => {
      const status = stringValue(slot.status);
      if (status === "succeeded") summary.succeeded += 1;
      if (status === "failed") summary.failed += 1;
      if (status === "running") summary.running += 1;
      if (status === "queued") summary.queued += 1;
      return summary;
    },
    { failed: 0, queued: 0, running: 0, succeeded: 0 }
  );
  return [
    `输出槽 ${slots.length}`,
    counts.succeeded ? `成功 ${counts.succeeded}` : "",
    counts.running ? `运行 ${counts.running}` : "",
    counts.queued ? `排队 ${counts.queued}` : "",
    counts.failed ? `失败 ${counts.failed}` : ""
  ].filter(Boolean).join(" / ");
}

export function progressFromJob(job: Pick<GenerationJob, "resultJson" | "status">): number | undefined {
  const result = recordValue(job.resultJson);
  const direct = numberValue(result.lastWorkerProgress);
  if (direct !== undefined) return direct;
  const slots = Array.isArray(result.outputSlots)
    ? result.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  const slotProgress = slots.map((slot) => numberValue(slot.progress)).filter((value): value is number => value !== undefined);
  if (slotProgress.length) return Math.round(slotProgress.reduce((sum, value) => sum + value, 0) / slotProgress.length);
  if (job.status === "succeeded") return 100;
  return undefined;
}

export function adminProcessViewFromJob(params: {
  aiAppName?: string;
  customerEmail?: string;
  job: GenerationJob;
  now?: number;
}): AdminProcessView {
  const now = params.now ?? Date.now();
  const result = recordValue(params.job.resultJson);
  const termination = recordValue(result.termination);
  const terminated = isTerminatedGenerationJob(params.job);
  const appName = params.aiAppName?.trim() || params.job.aiAppId;
  const kind = generationProcessKind(params.job);
  const detail = generationProcessDetailLabel(params.job, appName);
  const customerEmail = params.customerEmail?.trim() || params.job.customerId;
  const shortId = params.job.id.slice(-8);
  const stage = stringValue(result.lastWorkerStage) || (params.job.status === "queued" ? "queued" : params.job.status);
  const runtimeStart = Date.parse(params.job.createdAt);
  return {
    id: params.job.id,
    siteId: params.job.siteId,
    customerId: params.job.customerId,
    aiAppId: params.job.aiAppId,
    alias: `${kind === "video" ? "视频生成" : "图片生成"} · ${detail} · ${customerEmail} · ${shortId}`,
    appName,
    canRecoverVideo: kind === "video" && params.job.status === "failed" && !terminated,
    canTerminate: params.job.status === "queued" || params.job.status === "running",
    createdAt: params.job.createdAt,
    creditsReserved: params.job.creditsReserved,
    customerEmail,
    displayStatus: terminated ? "已终止" : jobStatusLabels[params.job.status] ?? params.job.status,
    kind,
    kindLabel: kind === "video" ? "视频" : "图片",
    outputSlotSummary: outputSlotSummaryFromJob(params.job),
    progress: progressFromJob(params.job),
    providerTaskId: providerTaskIdFromJobResult(params.job.resultJson),
    runtimeMs: Number.isFinite(runtimeStart) ? Math.max(0, now - runtimeStart) : 0,
    shortId,
    stage,
    stageLabel: terminated ? "管理员已终止" : stageLabel(stage),
    status: params.job.status,
    terminated,
    terminationReason: stringValue(termination.reason) || undefined,
    terminationActorId: stringValue(termination.actorId) || undefined,
    terminationAt: stringValue(termination.terminatedAt) || undefined,
    tone: terminated || params.job.status === "failed" || params.job.status === "refunded"
      ? "bad"
      : params.job.status === "queued" || params.job.status === "running"
      ? "warn"
      : params.job.status === "succeeded"
      ? "good"
      : "neutral",
    updatedAt: params.job.updatedAt
  };
}
