"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, Film, GripVertical, Heart, ImagePlus, LayoutGrid, Pencil, Play, RotateCcw, Trash2, Upload, X, UserRound, Users } from "lucide-react";
import { AssetsPanel } from "@/components/app/assets-panel";
import { invalidateCustomerAssets } from "@/components/app/customer-assets-client-cache";
import { JobCreateForm, type JobCreateRetryDraft } from "@/components/app/job-create-form";
import { CustomerShellHeader } from "@/components/storefront/customer-shell-header";
import { StorefrontNavigationFeedback } from "@/components/storefront/navigation-feedback";
import { CustomerAssetDownloadButton } from "@/components/storefront/customer-asset-download-button";
import { CustomerVideoWorkspace, type VideoRetryDraft } from "@/components/storefront/customer-video-workspace";
import { csrfHeader, customerJsonHeaders } from "@/lib/client-csrf";
import { sampleUploadFeedbackCount } from "@/lib/customer-workspace-sample-selection";
import {
  canPrepareCustomerVideoFrameUploadFile,
  customerImageUploadErrorMessage,
  prepareCustomerImageUploadFile,
  prepareCustomerVideoFrameUploadFile
} from "@/lib/client-image-upload";
import { shouldShowAssetOnSurface } from "@/lib/customer-asset-resource-agent";
import { generatedOutputCopy } from "@/lib/generation-output-labels";
import { isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import type { CreativePack, CreativePackCategory, PublicCustomer, Site, SiteAiApp, ThemeRuntimeAsset, ThemeRuntimeData, ToolMenuItem, VideoTheme } from "@/lib/types";
import { CUSTOMER_VIDEO_FRAME_LIMIT, trimVideoFrameSelection } from "@/lib/video-frame-config";
import {
  isGeminiVideoFrameMimeType,
  isVideoProviderUpstreamUnavailableError,
  normalizeVideoProviderFailure,
  parseVideoProviderFailure,
  videoProviderFailureCustomerMessage,
  type VideoProviderFailure
} from "@/lib/video-provider-policy";

type CustomerWorkspaceSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
export type CustomerWorkspacePanel = "overview" | "create" | "upload" | "video";
type WorkspaceResourceTab = "all" | "recent" | "favorites" | "try-on" | "packages";
type VideoWorkspaceTab = "generate" | "videos";
type CreatedWorkspaceJobFeedback = {
  customerBalance?: PublicCustomer["balance"];
};
type WorkspaceAnchor = "step-upload" | "step-create" | "step-video" | "source-photos" | "review-request" | "video-workspace-videos" | "resources-videos" | `resources-${WorkspaceResourceTab}`;

function newGenerationRetryIdempotencyKey(kind: "image" | "video", sourceJobId: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `${kind}_retry_${sourceJobId}_${crypto.randomUUID()}`;
  return `${kind}_retry_${sourceJobId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function newImageRetryIdempotencyKey(sourceJobId: string) {
  return newGenerationRetryIdempotencyKey("image", sourceJobId);
}

function newVideoRetryIdempotencyKey(sourceJobId: string) {
  return newGenerationRetryIdempotencyKey("video", sourceJobId);
}
type WorkspaceCreateMode = "theme" | "tool";
type WorkspaceSubscriptionStatus = "loading" | "active" | "required" | "admin";
type SampleTarget = "primary" | "partner";
type LocalUploadStatus = "uploading" | "ready" | "failed";
type SampleAsset = ThemeRuntimeAsset & {
  localStatus?: LocalUploadStatus;
  localTarget?: SampleTarget;
};
type VideoFrameAsset = ThemeRuntimeAsset & {
  localStatus?: LocalUploadStatus;
};
type WorkspaceRuntimeState =
  | { status: "idle"; runtime?: undefined; error?: undefined }
  | { status: "loading"; refreshKey: number; runtime?: ThemeRuntimeData; error?: undefined }
  | { status: "ready"; refreshKey: number; runtime: ThemeRuntimeData; error?: undefined }
  | { status: "error"; refreshKey: number; runtime?: ThemeRuntimeData; error: string };
type OutputCopyJob = {
  id: string;
  createdAt: string;
  requestJson?: Record<string, unknown>;
};
const myDreamShootsDisplayName = "myᕲreamshoots";
const VIDEO_FRAME_UPLOAD_LIMIT = CUSTOMER_VIDEO_FRAME_LIMIT;
const LOCALLY_CREATED_VIDEO_FRAME_KEEPALIVE_MS = 120_000;
const VIDEO_PREVIEW_INTERSECTION_MARGIN = "160px";
type RuntimeJob = ThemeRuntimeData["jobs"][number];

type RuntimeOutputSlot = {
  index: number;
  status: "queued" | "running" | "succeeded" | "failed";
  stage?: string;
  progress?: number;
  storageKey?: string;
  previewUrl?: string;
  mimeType?: string;
  error?: string;
  referenceFrameCount?: number;
  requestedReferenceFrameCount?: number;
  providerReferenceLimit?: number;
  providerFailure?: VideoProviderFailure;
  updatedAt?: string;
};

type VideoTimingBreakdownRow = {
  key: string;
  label: string;
  seconds: number;
  active?: boolean;
};

type VideoTimingBreakdown = {
  hasDetailedTiming: boolean;
  rows: VideoTimingBreakdownRow[];
  totalSeconds?: number;
  fallbackNotice?: string;
};

type LiveJobPatch = {
  status?: RuntimeJob["status"];
  stage?: string;
  progress?: number;
  outputSlots?: RuntimeOutputSlot[];
  error?: string;
  timing?: Record<string, string>;
  updatedAt?: string;
};

type CustomerJobEventPayload = {
  type?: unknown;
  jobId?: unknown;
  status?: unknown;
  stage?: unknown;
  progress?: unknown;
  outputSlots?: unknown;
  error?: unknown;
  timing?: unknown;
  eventKind?: unknown;
  updatedAt?: unknown;
};

type WorkspaceOutputRecord = {
  key: string;
  index?: number;
  storageKey?: string;
  previewUrl?: string;
  mimeType?: string;
};

function isSpanishXbyWorkspaceSite(site: CustomerWorkspaceSite): boolean {
  return isSpanishStorefrontSite(site);
}

function t(spanish: boolean, english: string, spanishText: string): string {
  return spanish ? spanishText : english;
}

function uploadLabelFor(file: File, index: number, fallback: string) {
  return file.name.replace(/\.[^.]+$/, "") || `${fallback} ${index + 1}`;
}

function outputCopyJob(job: ThemeRuntimeData["jobs"][number] | undefined): OutputCopyJob | undefined {
  if (!job) return undefined;
  return {
    id: job.id,
    createdAt: job.createdAt,
    ...(job.requestJson ? { requestJson: job.requestJson } : {})
  };
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function runtimeJobStatusFromEvent(value: unknown): RuntimeJob["status"] | undefined {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "refunded"
    ? value
    : undefined;
}

function runtimeOutputSlotStatusFromEvent(value: unknown): RuntimeOutputSlot["status"] | undefined {
  return value === "queued" || value === "running" || value === "succeeded" || value === "failed"
    ? value
    : undefined;
}

function normalizedProgressValue(value: unknown): number | undefined {
  const progress = Number(value);
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : undefined;
}

function runtimeTimingFromEvent(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const timing: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry) timing[key] = entry;
  }
  return Object.keys(timing).length ? timing : undefined;
}

function monotonicRuntimeProgress(previous: number | undefined, next: number | undefined, status?: RuntimeJob["status"] | RuntimeOutputSlot["status"]): number | undefined {
  if (status === "succeeded" || status === "failed" || status === "refunded") return 100;
  if (next === undefined) return previous;
  if (previous === undefined) return next;
  return Math.max(previous, next);
}

function runtimeOutputSlotsFromEvent(value: unknown): RuntimeOutputSlot[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const slots = value
    .map((entry): RuntimeOutputSlot | undefined => {
      const record = recordValue(entry);
      const index = Number(record.index);
      const status = runtimeOutputSlotStatusFromEvent(record.status);
      if (!Number.isFinite(index) || index < 1 || !status) return undefined;
      const slot: RuntimeOutputSlot = {
        index: Math.trunc(index),
        status
      };
      if (typeof record.stage === "string") slot.stage = record.stage;
      const progress = normalizedProgressValue(record.progress);
      if (progress !== undefined) slot.progress = progress;
      if (typeof record.storageKey === "string") slot.storageKey = record.storageKey;
      if (typeof record.previewUrl === "string") slot.previewUrl = record.previewUrl;
      if (typeof record.mimeType === "string") slot.mimeType = record.mimeType;
      if (typeof record.error === "string") slot.error = record.error;
      if (Number.isFinite(Number(record.referenceFrameCount))) slot.referenceFrameCount = Math.max(0, Math.trunc(Number(record.referenceFrameCount)));
      if (Number.isFinite(Number(record.requestedReferenceFrameCount))) slot.requestedReferenceFrameCount = Math.max(0, Math.trunc(Number(record.requestedReferenceFrameCount)));
      if (Number.isFinite(Number(record.providerReferenceLimit))) slot.providerReferenceLimit = Math.max(0, Math.trunc(Number(record.providerReferenceLimit)));
      const providerFailure = parseVideoProviderFailure(record.providerFailure);
      if (providerFailure) slot.providerFailure = providerFailure;
      if (typeof record.updatedAt === "string") slot.updatedAt = record.updatedAt;
      return slot;
    })
    .filter((slot): slot is RuntimeOutputSlot => Boolean(slot));
  return slots.length ? slots : undefined;
}

function mergeRuntimeOutputSlots(previous: unknown, patch: RuntimeOutputSlot[]): RuntimeOutputSlot[] {
  const slotsByIndex = new Map<number, RuntimeOutputSlot>();
  for (const slot of runtimeOutputSlotsFromEvent(previous) ?? []) {
    slotsByIndex.set(slot.index, slot);
  }
  for (const slot of patch) {
    const previousSlot = slotsByIndex.get(slot.index);
    const progress = monotonicRuntimeProgress(previousSlot?.progress, slot.progress, slot.status);
    slotsByIndex.set(slot.index, {
      ...(previousSlot ?? {}),
      ...slot,
      ...(progress !== undefined ? { progress } : {})
    });
  }
  return Array.from(slotsByIndex.values()).sort((left, right) => left.index - right.index);
}

function applyLiveJobPatch(job: RuntimeJob, patch: LiveJobPatch): RuntimeJob {
  const previousResult = recordValue(job.resultJson);
  const outputSlots = patch.outputSlots ? mergeRuntimeOutputSlots(previousResult.outputSlots, patch.outputSlots) : undefined;
  const timing = patch.timing
    ? { ...(runtimeTimingFromEvent(previousResult.timing) ?? {}), ...patch.timing }
    : undefined;
  const previousProgress = normalizedProgressValue(previousResult.lastWorkerProgress);
  const progress = monotonicRuntimeProgress(previousProgress, patch.progress, patch.status);
  return {
    ...job,
    status: patch.status ?? job.status,
    updatedAt: patch.updatedAt ?? job.updatedAt,
    resultJson: {
      ...previousResult,
      ...(patch.status ? { lastWorkerStatus: patch.status } : {}),
      ...(patch.stage ? { lastWorkerStage: patch.stage } : {}),
      ...(progress !== undefined ? { lastWorkerProgress: progress } : {}),
      ...(outputSlots ? { outputSlots } : {}),
      ...(patch.error ? { error: patch.error } : {}),
      ...(timing ? { timing } : {})
    }
  };
}

function slotStatusFromRuntimeJobStatus(status: RuntimeJob["status"] | undefined): RuntimeOutputSlot["status"] {
  if (status === "queued" || status === "running" || status === "succeeded" || status === "failed") return status;
  return "running";
}

function runtimeJobFromLivePatch(jobId: string, patch: LiveJobPatch): RuntimeJob {
  const updatedAt = patch.updatedAt ?? new Date().toISOString();
  const status = patch.status ?? "running";
  const slotStatus = slotStatusFromRuntimeJobStatus(status);
  return applyLiveJobPatch({
    id: jobId,
    aiAppId: "video_generator",
    status,
    creditsReserved: 0,
    createdAt: updatedAt,
    updatedAt,
    requestJson: {
      mode: "video",
      outputType: "video",
      fields: {
        mode: "video",
        outputType: "video",
        videoThemeName: "Prompt Directed Motion"
      },
      billing: { outputCount: 1 }
    },
    resultJson: {
      lastWorkerStatus: status,
      ...(patch.stage ? { lastWorkerStage: patch.stage } : {}),
      ...(patch.progress !== undefined ? { lastWorkerProgress: patch.progress } : {}),
      outputSlots: patch.outputSlots ?? [{
        index: 1,
        status: slotStatus,
        ...(patch.stage ? { stage: patch.stage } : {}),
        ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
        ...(patch.error ? { error: patch.error } : {}),
        mimeType: "video/mp4",
        updatedAt
      }]
    }
  }, patch);
}

function hasActiveWorkspaceSubscription(subscriptions: ThemeRuntimeData["subscriptions"] | undefined): boolean {
  const now = Date.now();
  return (subscriptions ?? []).some((subscription) => {
    if (subscription.status !== "active" && subscription.status !== "trialing") return false;
    return new Date(subscription.currentPeriodEnd).getTime() > now;
  });
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function jobFields(job: RuntimeJob): Record<string, unknown> {
  return recordValue(job.requestJson?.fields);
}

function jobResult(job: RuntimeJob): Record<string, unknown> {
  return recordValue(job.resultJson);
}

function videoJobFrameIds(job: Pick<RuntimeJob, "requestJson"> | OutputCopyJob | undefined): string[] {
  const fields = recordValue(job?.requestJson?.fields);
  return Array.from(new Set([
    ...stringArray(fields.frameAssetIds),
    ...stringArray(job?.requestJson?.assetIds)
  ]));
}

function videoJobPromptText(job: Pick<RuntimeJob, "requestJson"> | OutputCopyJob | undefined): string {
  const request = recordValue(job?.requestJson);
  const fields = recordValue(request.fields);
  return stringRequestValue(fields.promptNote, fields.prompt, request.promptNote, request.prompt) ?? "";
}

function videoPromptRequiresFrameImages(prompt: string): boolean {
  const text = prompt.trim().toLowerCase();
  if (!text) return false;
  return /\u4e0a\u4f20.{0,12}(\u56fe\u7247|\u7167\u7247|\u56fe\u50cf|\u7d20\u6750|\u53c2\u8003\u56fe)|\u6839\u636e.{0,12}(\u56fe\u7247|\u7167\u7247|\u56fe\u50cf|\u7d20\u6750|\u53c2\u8003\u56fe)|\u8fd9(\u5f20|\u4e2a|\u4e9b).{0,8}(\u56fe\u7247|\u7167\u7247|\u56fe\u50cf|\u7d20\u6750|\u53c2\u8003\u56fe)|\u56fe\u4e2d|\u7167\u7247\u4e2d|uploaded.{0,24}(image|photo|frame|picture)|selected.{0,24}(image|photo|frame|picture)|reference.{0,24}(image|photo|frame|picture)|source.{0,24}(image|photo|frame|picture)/i.test(text);
}

function videoJobMissingRequiredFrames(job: RuntimeJob): boolean {
  return isVideoRuntimeJob(job) && !videoJobFrameIds(job).length && videoPromptRequiresFrameImages(videoJobPromptText(job));
}

function dateMs(value: unknown): number | undefined {
  if (!(typeof value === "string" || value instanceof Date)) return undefined;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

function elapsedSeconds(startMs: number | undefined, endMs: number | undefined): number | undefined {
  if (startMs === undefined || endMs === undefined || endMs < startMs) return undefined;
  return (endMs - startMs) / 1000;
}

function formatWorkspaceDuration(seconds: number | undefined): string {
  if (seconds === undefined) return "";
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 1) return "<1s";
  if (rounded < 60) return `${rounded}s`;
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (minutes < 60) return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const minuteRemainder = minutes % 60;
  return minuteRemainder ? `${hours}h ${minuteRemainder}m` : `${hours}h`;
}

function workspaceVideoTimingBreakdown(job: RuntimeJob, spanish = false, nowMs = Date.now()): VideoTimingBreakdown {
  const result = jobResult(job);
  const timing = recordValue(result.timing);
  const hasDetailedTiming = Object.keys(timing).length > 0;
  const createdMs = dateMs(job.createdAt);
  const updatedMs = dateMs(job.updatedAt);
  const workerAcceptedMs = dateMs(timing.workerAcceptedAt);
  const referencePreparedMs = dateMs(timing.referencePreparedAt);
  const providerTaskCreatedMs = dateMs(timing.providerTaskCreatedAt);
  const providerCompletedMs = dateMs(timing.providerCompletedAt);
  const downloadedMs = dateMs(timing.downloadedAt);
  const storedMs = dateMs(timing.storedAt);
  const settledMs = dateMs(timing.settledAt);
  const optimizedStoredMs = dateMs(timing.optimizedStoredAt);
  const active = job.status === "queued" || job.status === "running";
  const terminalMs = settledMs ?? storedMs ?? downloadedMs ?? providerCompletedMs ?? (active ? nowMs : updatedMs);
  const incompleteStageEndMs = active ? nowMs : terminalMs;
  const totalSeconds = elapsedSeconds(createdMs, terminalMs);

  if (!hasDetailedTiming) {
    return {
      hasDetailedTiming,
      rows: [],
      totalSeconds,
      fallbackNotice: t(spanish, "Timing details are available for newer video requests.", "Los detalles de tiempo estan disponibles para solicitudes de video mas recientes.")
    };
  }

  const rows: VideoTimingBreakdownRow[] = [];
  const addRow = (key: string, label: string, startMs: number | undefined, endMs: number | undefined, rowActive = false) => {
    const seconds = elapsedSeconds(startMs, endMs);
    if (seconds === undefined) return;
    rows.push({ key, label, seconds, ...(rowActive ? { active: true } : {}) });
  };

  addRow(
    "submit_to_worker",
    t(spanish, "Submit to worker", "Enviar al worker"),
    createdMs,
    workerAcceptedMs ?? (!workerAcceptedMs ? incompleteStageEndMs : undefined),
    active && !workerAcceptedMs
  );
  addRow(
    "prepare_references",
    t(spanish, "Prepare references", "Preparar referencias"),
    workerAcceptedMs,
    referencePreparedMs ?? (workerAcceptedMs && !referencePreparedMs ? incompleteStageEndMs : undefined),
    active && Boolean(workerAcceptedMs) && !referencePreparedMs
  );
  addRow(
    "create_provider_task",
    t(spanish, "Create provider task", "Crear tarea del proveedor"),
    referencePreparedMs,
    providerTaskCreatedMs ?? (referencePreparedMs && !providerTaskCreatedMs ? incompleteStageEndMs : undefined),
    active && Boolean(referencePreparedMs) && !providerTaskCreatedMs
  );
  addRow(
    "provider_generation",
    t(spanish, "Provider generation", "Generacion del proveedor"),
    providerTaskCreatedMs,
    providerCompletedMs ?? (providerTaskCreatedMs ? incompleteStageEndMs : undefined),
    active && Boolean(providerTaskCreatedMs) && !providerCompletedMs
  );
  addRow(
    "download_result",
    t(spanish, "Download result", "Descargar resultado"),
    providerCompletedMs,
    downloadedMs ?? (providerCompletedMs && !downloadedMs ? incompleteStageEndMs : undefined),
    active && Boolean(providerCompletedMs) && !downloadedMs
  );
  addRow(
    "save_and_settle",
    t(spanish, "Save and settle", "Guardar y cerrar"),
    downloadedMs,
    settledMs ?? storedMs ?? (downloadedMs ? incompleteStageEndMs : undefined),
    active && Boolean(downloadedMs) && !storedMs && !settledMs
  );
  addRow(
    "background_optimization",
    t(spanish, "Background optimization", "Optimizacion en segundo plano"),
    settledMs ?? storedMs,
    optimizedStoredMs
  );

  return { hasDetailedTiming, rows, totalSeconds };
}

function stringRequestValue(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function numberRequestValue(...values: unknown[]): number | undefined {
  for (const value of values) {
    const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function canDirectRetryVideoJob(job: RuntimeJob, failure?: VideoProviderFailure): boolean {
  if (!isVideoRuntimeJob(job)) return false;
  if (!failure) return true;
  return failure.code === "frame_url_unreadable";
}

function videoRetryDraftFromJob(job: RuntimeJob): Omit<VideoRetryDraft, "key"> | undefined {
  if (!isVideoRuntimeJob(job)) return undefined;
  const request = recordValue(job.requestJson);
  const fields = recordValue(request.fields);
  const frameAssetIds = videoJobFrameIds(job);
  if (!frameAssetIds.length) return undefined;
  return {
    sourceJobId: job.id,
    frameAssetIds,
    videoThemeId: stringRequestValue(fields.videoThemeId, request.videoThemeId),
    videoModelFamily: stringRequestValue(fields.videoModelFamily, fields.modelFamily, request.videoModelFamily, request.modelFamily),
    promptNote: stringRequestValue(fields.promptNote, request.promptNote),
    durationSeconds: numberRequestValue(
      fields.durationSeconds,
      fields.videoDurationSeconds,
      fields.videoDuration,
      fields.duration,
      request.durationSeconds,
      request.videoDurationSeconds,
      request.videoDuration,
      request.duration
    ),
    aspectRatio: stringRequestValue(fields.aspectRatio, fields.aspect_ratio, request.aspectRatio, request.aspect_ratio),
    resolution: stringRequestValue(fields.resolution, request.resolution)
  };
}

function primitiveRetryFormValues(fields: Record<string, unknown>): Record<string, string | number | boolean> {
  const values: Record<string, string | number | boolean> = {};
  Object.entries(fields).forEach(([key, value]) => {
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") values[key] = value;
  });
  return values;
}

function packageAudienceFromRequestValue(value: unknown): JobCreateRetryDraft["packageAudience"] {
  return value === "self" || value === "partner" || value === "both" ? value : undefined;
}

function imageRetryDraftFromJob(job: RuntimeJob): Omit<JobCreateRetryDraft, "key"> | undefined {
  if (isVideoRuntimeJob(job)) return undefined;
  const request = recordValue(job.requestJson);
  const fields = recordValue(request.fields);
  const billing = recordValue(request.billing);
  const creativePackSnapshot = recordValue(request.creativePack);
  const mode = stringRequestValue(request.mode, fields.mode) === "tool" || Boolean(stringRequestValue(fields.toolPresetId, request.toolPresetId))
    ? "tool"
    : "theme";
  const requestPrimaryIds = stringArray(fields.primaryAssetIds).length
    ? stringArray(fields.primaryAssetIds)
    : stringArray(request.primaryAssetIds);
  const partnerAssetIds = stringArray(fields.partnerAssetIds).length
    ? stringArray(fields.partnerAssetIds)
    : stringArray(request.partnerAssetIds);
  const primaryAssetIds = requestPrimaryIds.length || partnerAssetIds.length
    ? requestPrimaryIds
    : stringArray(request.assetIds);
  const outputCount = numberRequestValue(fields.outputCount, request.outputCount, billing.outputCount);
  const prompt = mode === "tool"
    ? stringRequestValue(fields.prompt, request.prompt, fields.packagePrompt, fields.userDirection)
    : stringRequestValue(fields.packagePrompt, fields.userDirection, request.packagePrompt, fields.prompt, request.prompt);
  return {
    mode,
    creativePackId: stringRequestValue(request.creativePackId, fields.creativePackId, creativePackSnapshot.id),
    toolId: stringRequestValue(fields.toolPresetId, request.toolPresetId),
    primaryAssetIds,
    partnerAssetIds,
    ...(outputCount !== undefined ? { outputCount } : {}),
    ...(prompt !== undefined ? { prompt } : {}),
    formValues: primitiveRetryFormValues(fields),
    customerModelId: stringRequestValue(request.customerModelId, fields.customerModelId),
    packageAudience: packageAudienceFromRequestValue(fields.packageAudience)
  };
}

function workspaceJobTitle(job: RuntimeJob, spanish = false): string {
  const fields = jobFields(job);
  const title = fields.videoThemeName ?? fields.creativePackName ?? fields.packageName ?? fields.toolName ?? fields.prompt;
  return typeof title === "string" && title.trim() ? title.trim().slice(0, 80) : isVideoRuntimeJob(job) ? t(spanish, "AI video request", "Solicitud de video IA") : t(spanish, "AI photo request", "Solicitud de fotos IA");
}

function workspaceJobStageLabel(job: RuntimeJob, spanish = false, slots?: RuntimeOutputSlot[]): string {
  const stage = jobResult(job).lastWorkerStage;
  const isVideoRequest = isVideoRuntimeJob(job);
  const effectiveStatus = workspaceJobEffectiveStatus(job, slots);
  if (effectiveStatus === "failed") return t(spanish, "Generation failed", "Generacion fallida");
  if (effectiveStatus === "succeeded") return isVideoRequest ? t(spanish, "Video delivered", "Video entregado") : t(spanish, "Images delivered", "Imagenes entregadas");
  if (stage === "local_worker_started") return t(spanish, "Preparing the generator", "Preparando el generador");
  if (stage === "local_video_worker_started") return t(spanish, "Preparing the video generator", "Preparando el generador de video");
  if (stage === "source_images_ready") return t(spanish, "Reading selected photos", "Leyendo fotos seleccionadas");
  if (stage === "provider_request_started") return t(spanish, "Generating images", "Generando imagenes");
  if (stage === "video_provider_request_started" || stage === "video_task_created") return t(spanish, "Generating video", "Generando video");
  if (typeof stage === "string" && stage.startsWith("video_provider_running")) return t(spanish, "Generating video", "Generando video");
  if (stage === "video_result_received") return t(spanish, "Saving generated video", "Guardando video generado");
  if (stage === "provider_response_received") return t(spanish, "Saving generated images", "Guardando imagenes generadas");
  if (effectiveStatus === "queued") return t(spanish, "Waiting in queue", "En cola");
  if (effectiveStatus === "running") return isVideoRequest ? t(spanish, "Generating video", "Generando video") : t(spanish, "Generating images", "Generando imagenes");
  return t(spanish, "Request updated", "Solicitud actualizada");
}

function workspaceJobProviderFailure(job: RuntimeJob, slots?: RuntimeOutputSlot[]): VideoProviderFailure | undefined {
  const result = jobResult(job);
  const resultFailure = parseVideoProviderFailure(result.providerFailure);
  if (resultFailure) return resultFailure;
  const slotFailure = slots?.map((slot) => slot.providerFailure).find((failure): failure is VideoProviderFailure => Boolean(failure));
  if (slotFailure) return slotFailure;
  const resultError = typeof result.error === "string" ? result.error : "";
  const slotError = slots?.find((slot) => slot.status === "failed" && slot.error)?.error ?? "";
  return normalizeVideoProviderFailure({ error: resultError || slotError });
}

function workspaceJobProviderFailureBody(failure: VideoProviderFailure, spanish = false): string {
  const reason = videoProviderFailureCustomerMessage(failure, spanish);
  return spanish
    ? `${reason} Los creditos se devolvieron automaticamente.`
    : `${reason} Credits were returned automatically.`;
}

function workspaceJobBody(job: RuntimeJob, spanish = false, slots?: RuntimeOutputSlot[]): string {
  const result = jobResult(job);
  const effectiveStatus = workspaceJobEffectiveStatus(job, slots);
  if (videoJobMissingRequiredFrames(job)) {
    return t(spanish, "This video request did not include selected frame images, so it cannot be trusted as a reference-based result. Start a new video after selecting frame images on the left.", "Esta solicitud de video no incluyo fotogramas seleccionados, por lo que no debe usarse como resultado basado en referencias. Crea un video nuevo despues de seleccionar fotogramas a la izquierda.");
  }
  if (effectiveStatus === "failed") {
    const slotError = slots?.find((slot) => slot.status === "failed" && slot.error)?.error;
    const error = typeof result.error === "string" && result.error ? result.error : slotError ?? "";
    const lowerError = error.toLowerCase();
    const isVideoRequest = isVideoRuntimeJob(job);
    if (isVideoRequest && (error.includes("ai_provider_video_request_timeout") || error.includes("video_provider_request_timeout"))) return t(spanish, "The video request stalled before the provider returned a task id. Credits were returned automatically; refresh the workspace, then retry after a short wait.", "La solicitud de video se quedo detenida antes de que el proveedor devolviera un id de tarea. Los creditos se devolvieron automaticamente; actualiza el espacio y reintenta despues de una breve espera.");
    if (isVideoRequest && (error.includes("ai_provider_video_create_timeout") || error.includes("video_provider_create_timeout"))) return t(spanish, "The video provider did not return a task after the create request timed out. Credits were returned automatically; retry after a short wait or use another healthy video provider.", "El proveedor de video no devolvio una tarea antes de agotar el tiempo de creacion. Los creditos se devolvieron automaticamente; reintenta despues de una breve espera o usa otro proveedor disponible.");
    if (error.includes("generation_job_expired")) return isVideoRequest
      ? t(spanish, "The video generator was interrupted before it returned a result. Credits were returned automatically, and you can retry from the same workspace.", "El generador de video se interrumpio antes de devolver un resultado. Los creditos se devolvieron automaticamente y puedes reintentar desde el mismo espacio.")
      : t(spanish, "The generator was interrupted before it returned a result. Credits were returned automatically, and you can retry from the same workspace.", "El generador se interrumpio antes de devolver un resultado. Los creditos se devolvieron automaticamente y puedes reintentar desde el mismo espacio.");
    if (isVideoRequest && (error.includes("ai_provider_video_content_unverified") || error.includes("ai_provider_video_reference_channel_unreliable") || error.includes("video_provider_temporarily_unavailable") || error.includes("no_video_ai_provider_configured"))) {
      return t(spanish, "Video generation is temporarily unavailable while provider access is being updated. Credits were returned automatically, and you can retry once video access is restored.", "La generacion de video no esta disponible temporalmente mientras se actualiza el acceso del proveedor. Los creditos se devolvieron automaticamente y podras reintentar cuando se restaure el acceso de video.");
    }
    if (isVideoRequest && isVideoProviderUpstreamUnavailableError(error)) {
      return t(spanish, "The video provider is temporarily unavailable upstream. Credits were returned automatically; retry after provider access recovers.", "El proveedor de video no esta disponible temporalmente en upstream. Los creditos se devolvieron automaticamente; reintenta cuando se recupere el acceso.");
    }
    if (!isVideoRequest && isImageProviderError(error)) {
      if (error.includes("no_image_ai_provider_configured")) {
        return t(spanish, "Image generation is temporarily unavailable while provider access is being updated. Credits were returned automatically, and you can retry once image access is restored.", "La generacion de imagenes no esta disponible temporalmente mientras se actualiza el acceso del proveedor. Los creditos se devolvieron automaticamente y podras reintentar cuando se restaure el acceso.");
      }
      if (isProviderTemporarilyUnavailableError(error)) {
        return t(spanish, "The image provider is temporarily unavailable upstream. Credits were returned automatically; retry after provider access recovers.", "El proveedor de imagenes no esta disponible temporalmente en upstream. Los creditos se devolvieron automaticamente; reintenta cuando se recupere el acceso.");
      }
      if (error.includes("ai_provider_image_edit_failed_404")) {
        return t(spanish, "The selected image provider endpoint rejected this request. Credits were returned automatically; retry after provider configuration is updated.", "El endpoint del proveedor de imagenes rechazo esta solicitud. Los creditos se devolvieron automaticamente; reintenta cuando se actualice la configuracion.");
      }
      return t(spanish, "The image provider could not finish this image. Credits were returned automatically, and you can retry after a short wait.", "El proveedor de imagenes no pudo terminar esta imagen. Los creditos se devolvieron automaticamente y puedes reintentar despues de una breve espera.");
    }
    if (error.includes("ai_provider_video_frame_public_urls_required") || error.includes("video_public_asset_url_required")) return t(spanish, "The video provider could not reach the selected frame images through a public URL. Credits were returned automatically; retry after the workspace is opened on its public domain or a public asset base URL is configured.", "El proveedor de video no pudo leer los fotogramas mediante una URL publica. Los creditos se devolvieron automaticamente; reintenta cuando el sitio este en su dominio publico o tenga configurada una URL publica de recursos.");
    if (isVideoRequest && (error.includes("ai_provider_video_create_failed_524") || error.includes("ai_provider_video_create_failed_504"))) return t(spanish, "The video provider timed out while creating the video task. The starter image was created correctly, credits were returned automatically, and you can retry after the provider recovers.", "El proveedor de video agoto el tiempo al crear la tarea. La imagen inicial se creo correctamente, los creditos se devolvieron automaticamente y puedes reintentar cuando el proveedor se recupere.");
    if (isVideoRequest && (lowerError.includes("econnreset") || lowerError.includes("fetch failed") || lowerError.includes("socket") || lowerError.includes("terminated"))) return t(spanish, "The video provider connection was interrupted before it returned a video. Credits were returned automatically, and you can retry after a short wait.", "La conexion con el proveedor de video se interrumpio antes de devolver el video. Los creditos se devolvieron automaticamente y puedes reintentar despues de una breve espera.");
    const providerFailure = isVideoRequest ? workspaceJobProviderFailure(job, slots) : undefined;
    if (providerFailure) return workspaceJobProviderFailureBody(providerFailure, spanish);
    if (isVideoRequest && error.includes("ai_provider_video_failed")) return t(spanish, "The video provider could not finish this video. Credits were returned automatically, and you can retry after a short wait.", "El proveedor de video no pudo terminar este video. Los creditos se devolvieron automaticamente y puedes reintentar despues de una breve espera.");
    if (error.includes("timeout") || error.includes("UND_ERR_CONNECT_TIMEOUT")) return isVideoRequest
      ? t(spanish, "The video provider did not respond in time. Credits were returned automatically, and you can retry after a short wait.", "El proveedor de video no respondio a tiempo. Los creditos se devolvieron automaticamente y puedes reintentar despues de una breve espera.")
      : t(spanish, "The image provider did not respond in time. Credits were returned automatically, and you can retry after a short wait.", "El proveedor de imagenes no respondio a tiempo. Los creditos se devolvieron automaticamente y puedes reintentar despues de una breve espera.");
    if (error.includes("fetch failed")) return t(spanish, "The image provider connection failed before it returned images. Credits were returned automatically, and you can retry.", "La conexion con el proveedor fallo antes de devolver imagenes. Los creditos se devolvieron automaticamente y puedes reintentar.");
    return t(spanish, "The generator could not finish this request. Credits were returned automatically, and you can retry from the same workspace.", "El generador no pudo terminar esta solicitud. Los creditos se devolvieron automaticamente y puedes reintentar desde el mismo espacio.");
  }
  if (result.lastWorkerStage === "provider_request_started") {
    const elapsedMs = Date.now() - new Date(job.updatedAt).getTime();
    if (elapsedMs > 4 * 60_000) return t(spanish, "The image model is taking longer than expected. If it does not return soon, credits will be released automatically and you can retry.", "El modelo esta tardando mas de lo esperado. Si no responde pronto, los creditos se liberaran automaticamente y podras reintentar.");
    return t(spanish, "Your selected photos and prompt are with the image model. This is usually the longest step.", "Tus fotos seleccionadas e instrucciones estan con el modelo. Este suele ser el paso mas largo.");
  }
  if (result.lastWorkerStage === "source_images_ready") return t(spanish, "Your selected photos are being prepared for generation.", "Tus fotos seleccionadas se estan preparando para generar.");
  if (effectiveStatus === "queued") return t(spanish, "Credits are held and this request is waiting for the generator.", "Los creditos estan reservados y la solicitud espera al generador.");
  return t(spanish, "The workspace updates when the generator sends progress.", "El espacio se actualiza cuando el generador envia progreso.");
}

function requestedJobOutputCount(job: RuntimeJob): number {
  const billing = recordValue(job.requestJson?.billing);
  const fields = jobFields(job);
  const raw = billing.outputCount ?? fields.outputCount ?? job.requestJson?.outputCount;
  const count = Number(raw);
  return Number.isFinite(count) && count > 0 ? Math.max(1, Math.trunc(count)) : 1;
}

function workspaceJobOutputSlots(job: RuntimeJob, outputAssets: ThemeRuntimeAsset[]): RuntimeOutputSlot[] {
  const result = jobResult(job);
  const rawSlots = Array.isArray(result.outputSlots) ? result.outputSlots : [];
  const jobProgress = Number.isFinite(Number(result.lastWorkerProgress))
    ? Math.max(0, Math.min(100, Number(result.lastWorkerProgress)))
    : undefined;
  const slotsByIndex = new Map<number, RuntimeOutputSlot>();
  for (const rawSlot of rawSlots) {
    if (!rawSlot || typeof rawSlot !== "object" || Array.isArray(rawSlot)) continue;
    const record = rawSlot as Record<string, unknown>;
    const index = Number(record.index);
    const status = record.status === "succeeded" || record.status === "failed" || record.status === "running" || record.status === "queued"
      ? record.status
      : "queued";
    if (!Number.isFinite(index) || index < 1) continue;
    slotsByIndex.set(Math.trunc(index), {
      index: Math.trunc(index),
      status,
      stage: typeof record.stage === "string" ? record.stage : undefined,
      progress: Number.isFinite(Number(record.progress))
        ? Math.max(0, Math.min(100, Number(record.progress)))
        : index === 1
          ? jobProgress
          : undefined,
      storageKey: typeof record.storageKey === "string" ? record.storageKey : undefined,
      previewUrl: typeof record.previewUrl === "string" ? record.previewUrl : undefined,
      mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
      error: typeof record.error === "string" ? record.error : undefined,
      referenceFrameCount: Number.isFinite(Number(record.referenceFrameCount)) ? Math.max(0, Math.trunc(Number(record.referenceFrameCount))) : undefined,
      requestedReferenceFrameCount: Number.isFinite(Number(record.requestedReferenceFrameCount)) ? Math.max(0, Math.trunc(Number(record.requestedReferenceFrameCount))) : undefined,
      providerReferenceLimit: Number.isFinite(Number(record.providerReferenceLimit)) ? Math.max(0, Math.trunc(Number(record.providerReferenceLimit))) : undefined,
      providerFailure: parseVideoProviderFailure(record.providerFailure),
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : undefined
    });
  }
  const rawOutputs = Array.isArray(result.outputs) ? result.outputs : [];
  const slotIndexByStorageKey = new Map<string, number>();
  slotsByIndex.forEach((slot) => {
    if (slot.storageKey) slotIndexByStorageKey.set(normalizedWorkspaceStorageKey(slot.storageKey), slot.index);
  });
  const outputRecords: WorkspaceOutputRecord[] = [];
  const seenOutputKeys = new Set<string>();
  const appendOutputRecord = (record: Omit<WorkspaceOutputRecord, "key">) => {
    const key = record.storageKey ? normalizedWorkspaceStorageKey(record.storageKey) : record.previewUrl?.trim();
    if (!key || seenOutputKeys.has(key)) return;
    seenOutputKeys.add(key);
    outputRecords.push({ ...record, key });
  };
  rawOutputs.forEach((rawOutput) => {
    if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) return;
    const record = rawOutput as Record<string, unknown>;
    if (typeof record.storageKey !== "string" || !record.storageKey.trim()) return;
    const outputRecordIndex = Number(record.index);
    appendOutputRecord({
      index: Number.isFinite(outputRecordIndex) && outputRecordIndex > 0 ? Math.trunc(outputRecordIndex) : undefined,
      storageKey: record.storageKey,
      mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined
    });
  });
  outputAssets.forEach((asset, outputIndex) => {
    appendOutputRecord({
      index: outputIndex + 1,
      storageKey: asset.storageKey,
      previewUrl: asset.previewUrl,
      mimeType: asset.mimeType
    });
  });
  outputRecords.forEach((outputRecord, outputIndex) => {
    const matchedIndex = outputRecord.storageKey ? slotIndexByStorageKey.get(normalizedWorkspaceStorageKey(outputRecord.storageKey)) : undefined;
    const fallbackIndex = Array.from({ length: Math.max(requestedJobOutputCount(job), slotsByIndex.size, outputRecords.length) }, (_, itemIndex) => itemIndex + 1)
      .find((candidate) => {
        const existingSlot = slotsByIndex.get(candidate);
        if (!existingSlot) return true;
        if (existingSlot.status === "failed") return false;
        if (!existingSlot.storageKey || !outputRecord.storageKey) return true;
        return normalizedWorkspaceStorageKey(existingSlot.storageKey) === normalizedWorkspaceStorageKey(outputRecord.storageKey);
      });
    const index = matchedIndex ??
      outputRecord.index ??
      (rawSlots.length ? fallbackIndex : undefined) ??
      outputIndex + 1;
    slotsByIndex.set(index, {
      ...(slotsByIndex.get(index) ?? { index }),
      index,
      status: "succeeded",
      stage: "provider_response_received",
      storageKey: outputRecord.storageKey ?? slotsByIndex.get(index)?.storageKey,
      previewUrl: outputRecord.previewUrl ?? slotsByIndex.get(index)?.previewUrl,
      mimeType: outputRecord.mimeType ?? slotsByIndex.get(index)?.mimeType,
      updatedAt: slotsByIndex.get(index)?.updatedAt
    });
  });
  const deliveredCount = Math.max(outputRecords.length, outputAssets.length);
  const total = Math.max(requestedJobOutputCount(job), slotsByIndex.size, deliveredCount);
  return Array.from({ length: total }, (_, itemIndex) => {
    const index = itemIndex + 1;
    return slotsByIndex.get(index) ?? {
      index,
      status: index <= deliveredCount
        ? "succeeded"
        : job.status === "succeeded"
          ? "succeeded"
          : job.status === "failed"
          ? "failed"
          : job.status === "running"
            ? "running"
            : "queued"
    };
  });
}

function workspaceJobEffectiveStatus(job: RuntimeJob, slots?: RuntimeOutputSlot[]): RuntimeJob["status"] | "partial" {
  if (videoJobMissingRequiredFrames(job)) return "failed";
  if (job.status === "succeeded" || job.status === "failed") return job.status;
  const outputSlots = slots ?? workspaceJobOutputSlots(job, []);
  if (outputSlots.length > 0 && outputSlots.every((slot) => slot.status === "succeeded")) return "succeeded";
  if (outputSlots.length > 0 && outputSlots.every((slot) => slot.status === "failed")) return "failed";
  if (outputSlots.some((slot) => slot.status === "succeeded") && outputSlots.some((slot) => slot.status === "failed")) return "partial";
  return job.status;
}

function slotLabel(slot: RuntimeOutputSlot, spanish = false): string {
  if (slot.status === "succeeded") return t(spanish, "Delivered", "Entregado");
  if (slot.status === "failed") return t(spanish, "Failed", "Fallido");
  if (slot.status === "running") return t(spanish, "Generating", "Generando");
  return t(spanish, "Queued", "En cola");
}

function progressFromSlotStage(stage: string | undefined): number | undefined {
  if (!stage) return undefined;
  const match = stage.match(/^video_provider_running[_:-]?(\d+(?:\.\d+)?)$/i);
  if (!match) return undefined;
  const progress = Number(match[1]);
  return Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : undefined;
}

function workspaceSlotProgress(slot: RuntimeOutputSlot): number | undefined {
  if (slot.status === "succeeded" || slot.status === "failed") return 100;
  if (typeof slot.progress === "number" && Number.isFinite(slot.progress)) {
    return Math.max(0, Math.min(100, slot.progress));
  }
  const providerProgress = progressFromSlotStage(slot.stage);
  if (providerProgress !== undefined) return providerProgress;
  return undefined;
}

function workspaceSlotProgressText(slot: RuntimeOutputSlot, spanish = false): string {
  if (slot.status === "succeeded") return t(spanish, "Output ready", "Resultado listo");
  if (slot.status === "failed") return t(spanish, "Needs retry", "Necesita reintento");
  if (slot.stage === "video_result_received") return t(spanish, "Saving video", "Guardando video");
  if (slot.stage === "provider_response_received") return t(spanish, "Saving output", "Guardando resultado");
  if (slot.stage === "video_task_created") return t(spanish, "Video task created", "Tarea de video creada");
  if (slot.stage === "video_provider_create_started") return t(spanish, "Submitting video task", "Enviando tarea de video");
  if (typeof slot.stage === "string" && slot.stage.startsWith("video_provider_running")) return t(spanish, "Generating video", "Generando video");
  if (slot.stage === "video_scene_image_generation_started") return t(spanish, "Preparing starter image", "Preparando imagen inicial");
  if (slot.stage === "video_provider_request_started") return t(spanish, "Generating video", "Generando video");
  if (slot.stage === "provider_request_started") return t(spanish, "Generating output", "Generando resultado");
  if (slot.stage === "source_images_ready") return t(spanish, "Preparing photos", "Preparando fotos");
  if (slot.stage === "local_video_worker_started") return t(spanish, "Preparing video request", "Preparando solicitud de video");
  if (slot.stage === "local_worker_started") return t(spanish, "Preparing request", "Preparando solicitud");
  if (slot.status === "running") return t(spanish, "Generating output", "Generando resultado");
  return t(spanish, "Waiting for this slot", "Esperando este resultado");
}

function workspaceSlotSummary(slots: RuntimeOutputSlot[], spanish = false): string {
  const delivered = slots.filter((slot) => slot.status === "succeeded").length;
  const failed = slots.filter((slot) => slot.status === "failed").length;
  const pending = slots.length - delivered - failed;
  const parts = [spanish ? `${delivered} de ${slots.length} entregados` : `${delivered} of ${slots.length} delivered`];
  if (pending > 0) parts.push(spanish ? `${pending} pendientes` : `${pending} pending`);
  if (failed > 0) parts.push(spanish ? `${failed} fallidos` : `${failed} failed`);
  return parts.join(" · ");
}

function workspaceJobSlotStageLabel(job: RuntimeJob, slots: RuntimeOutputSlot[], spanish = false): string {
  if (slots.length <= 1) return workspaceJobStageLabel(job, spanish, slots);
  const delivered = slots.filter((slot) => slot.status === "succeeded").length;
  const failed = slots.filter((slot) => slot.status === "failed").length;
  const pending = slots.length - delivered - failed;
  if (delivered === slots.length) return t(spanish, "Images delivered", "Imagenes entregadas");
  if (failed > 0 && delivered > 0) return t(spanish, "Some images need attention", "Algunas imagenes requieren atencion");
  if (failed > 0 && pending === 0) return t(spanish, "Generation failed", "Generacion fallida");
  if (delivered > 0 && pending > 0) return t(spanish, "More images are still generating", "Aun se generan mas imagenes");
  if (pending > 0) return t(spanish, "Images are generating", "Las imagenes se estan generando");
  return workspaceJobStageLabel(job, spanish, slots);
}

function workspaceJobStatusBadge(job: RuntimeJob, slots: RuntimeOutputSlot[]): string {
  const effectiveStatus = workspaceJobEffectiveStatus(job, slots);
  const delivered = slots.filter((slot) => slot.status === "succeeded").length;
  const failed = slots.filter((slot) => slot.status === "failed").length;
  const pending = slots.length - delivered - failed;
  if (effectiveStatus === "failed") return "failed";
  if (slots.length > 1 && delivered > 0 && failed > 0) return "partial";
  if (slots.length > 1 && delivered > 0 && pending > 0) return "partial";
  return effectiveStatus;
}

function normalizedWorkspaceStorageKey(storageKey: string): string {
  return storageKey.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "");
}

function workspaceStoragePreviewUrl(storageKey: string): string {
  if (storageKey.startsWith("/")) return storageKey;
  return `/api/local-assets/${normalizedWorkspaceStorageKey(storageKey)}`;
}

function workspaceAssetPreviewUrl(asset: Pick<ThemeRuntimeAsset, "previewUrl" | "storageKey" | "role">): string {
  return asset.previewUrl;
}

function assetPreviewIsLoading(asset: Pick<ThemeRuntimeAsset, "previewStatus"> & { localStatus?: LocalUploadStatus }): boolean {
  return asset.localStatus === "uploading" || asset.previewStatus === "loading";
}

function videoFrameAssetReadyForGeneration(asset: Pick<ThemeRuntimeAsset, "id"> & { localStatus?: LocalUploadStatus }): boolean {
  return !asset.id.startsWith("local:") && asset.localStatus !== "uploading" && asset.localStatus !== "failed";
}

function videoFrameAssetSelectable(asset: Pick<ThemeRuntimeAsset, "id"> & { localStatus?: LocalUploadStatus }): boolean {
  return videoFrameAssetReadyForGeneration(asset);
}

function shouldRenderSourceSample(asset: Pick<ThemeRuntimeAsset, "id" | "previewStatus"> & { localStatus?: LocalUploadStatus }): boolean {
  if (asset.localStatus === "failed") return true;
  if (asset.id.startsWith("local:") || asset.localStatus === "uploading") return true;
  return !assetPreviewIsLoading(asset);
}

function isVideoFrameCandidateAsset(asset: Pick<ThemeRuntimeAsset, "mimeType" | "role" | "subjectRole">): boolean {
  return asset.mimeType.startsWith("image/") && asset.role === "input" && asset.subjectRole === "video_frame";
}

function isSampleCandidateAsset(asset: Pick<ThemeRuntimeAsset, "role" | "subjectRole">): boolean {
  return (asset.role === "input" || asset.role === "training_input") && asset.subjectRole !== "video_frame" && asset.subjectRole !== "video_scene_reference";
}

function workspaceJobTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

function isSameLocalDay(value: string, reference: Date): boolean {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  return date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate();
}

function isVideoAsset(asset: Pick<ThemeRuntimeAsset, "mimeType">): boolean {
  return asset.mimeType.startsWith("video/");
}

function workspaceVideoPosterUrl(src: string): string {
  return `${src}${src.includes("?") ? "&" : "?"}poster=1`;
}

function workspaceVideoPlaybackUrl(src: string): string {
  return src;
}

function WorkspaceVideoPreviewButton({
  compact = false,
  disabled,
  fallbackPosterSrc,
  label,
  loadPreview = true,
  mediaKey,
  onOpen,
  renderLoading,
  src,
  spanish
}: {
  compact?: boolean;
  disabled?: boolean;
  fallbackPosterSrc?: string;
  label: string;
  loadPreview?: boolean;
  mediaKey: string;
  onOpen?: () => void;
  renderLoading: (compact?: boolean) => ReactNode;
  src: string;
  spanish: boolean;
}) {
  const rootRef = useRef<HTMLButtonElement | null>(null);
  const posterSrc = useMemo(() => workspaceVideoPosterUrl(src), [src]);
  const [shouldLoad, setShouldLoad] = useState(!loadPreview);
  const [posterLoaded, setPosterLoaded] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const [fallbackPosterFailed, setFallbackPosterFailed] = useState(false);

  useEffect(() => {
    setShouldLoad(!loadPreview);
    setPosterLoaded(false);
    setPosterFailed(false);
    setFallbackPosterFailed(false);
  }, [fallbackPosterSrc, loadPreview, mediaKey, src]);

  useEffect(() => {
    if (!loadPreview || shouldLoad) return;
    const element = rootRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: VIDEO_PREVIEW_INTERSECTION_MARGIN }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [loadPreview, shouldLoad]);

  useEffect(() => {
    if (!shouldLoad || !fallbackPosterSrc || posterFailed) return;
    const controller = new AbortController();
    fetch(posterSrc, {
      cache: "no-store",
      credentials: "same-origin",
      method: "HEAD",
      signal: controller.signal
    })
      .then((response) => {
        if (response.headers.get("x-asset-placeholder") === "loading") setPosterFailed(true);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [fallbackPosterSrc, posterFailed, posterSrc, shouldLoad]);

  const showFallbackPoster = shouldLoad && Boolean(fallbackPosterSrc) && !fallbackPosterFailed && (!posterLoaded || posterFailed);
  const showPosterImage = shouldLoad && !posterFailed;

  return (
    <button
      aria-label={label}
      className="group/video relative block w-full bg-black text-left disabled:cursor-default"
      disabled={disabled}
      onClick={onOpen}
      ref={rootRef}
      type="button"
    >
      <div className="relative aspect-video w-full overflow-hidden bg-[#080c12]">
        {showFallbackPoster ? (
          <img
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-contain opacity-82"
            decoding="async"
            loading="lazy"
            onError={() => setFallbackPosterFailed(true)}
            src={fallbackPosterSrc}
          />
        ) : null}
        {!posterLoaded && !showFallbackPoster ? (
          renderLoading(compact)
        ) : null}
        {showPosterImage ? (
          <img
            alt={label}
            className={`absolute inset-0 h-full w-full object-contain transition duration-300 ${posterLoaded ? "opacity-100" : "opacity-0"}`}
            data-media-key={mediaKey}
            decoding="async"
            loading="lazy"
            onError={() => setPosterFailed(true)}
            onLoad={() => setPosterLoaded(true)}
            src={posterSrc}
          />
        ) : null}
      </div>
      {!disabled ? (
        <span className={`absolute ${compact ? "bottom-2 left-2 px-2.5 py-1 text-[10px]" : "bottom-3 left-3 px-3 py-1.5 text-[11px]"} inline-flex items-center gap-1.5 rounded-full border border-white/18 bg-black/56 font-semibold text-white backdrop-blur transition group-hover/video:bg-white/14`}>
          <Eye className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={1.8} />
          {t(spanish, "Open preview", "Abrir vista previa")}
        </span>
      ) : null}
    </button>
  );
}

function WorkspaceVideoPreviewPlayer({
  label,
  posterSrc,
  src,
  spanish
}: {
  label: string;
  posterSrc: string;
  src: string;
  spanish: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
  }, [src]);

  return (
    <div className="relative inline-block max-w-full">
      <video
        aria-label={label}
        className="max-h-[82vh] max-w-full object-contain"
        controls
        playsInline
        poster={posterSrc}
        preload="metadata"
        ref={videoRef}
        src={src}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
      />
      {!isPlaying ? (
        <button
          aria-label={t(spanish, "Play video preview", "Reproducir vista previa de video")}
          className="absolute inset-x-0 top-0 bottom-14 grid cursor-pointer place-items-center bg-transparent text-white transition hover:bg-white/[0.04]"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            const video = videoRef.current;
            if (!video) return;
            void video.play().catch(() => {});
          }}
          type="button"
        >
          <span className="grid h-16 w-16 place-items-center rounded-full border border-white/16 bg-black/50 text-white backdrop-blur transition hover:bg-black/65">
            <Play className="ml-1 h-7 w-7" strokeWidth={1.8} />
          </span>
        </button>
      ) : null}
    </div>
  );
}

function mediaLabel(value: string | undefined): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function generatedAssetLabel(asset: ThemeRuntimeAsset, copy: { title?: string; description?: string } | undefined): string {
  const storedAlt = mediaLabel(asset.altText);
  if (storedAlt) return storedAlt;
  const mediaType = isVideoAsset(asset) ? "AI-generated video" : "AI-generated image";
  const title = mediaLabel(copy?.title) || mediaLabel(asset.label);
  const description = mediaLabel(copy?.description);
  return [mediaType, title, description].filter(Boolean).join(": ");
}

function uploadedSampleLabel(asset: Pick<ThemeRuntimeAsset, "altText" | "label">, target?: SampleTarget): string {
  const storedAlt = mediaLabel(asset.altText);
  if (storedAlt) return storedAlt;
  const role = target === "partner" ? "partner sample photo" : target === "primary" ? "primary sample photo" : "uploaded sample photo";
  return `Customer ${role}: ${mediaLabel(asset.label) || "reference image"}`;
}

function videoFrameLabel(asset: Pick<ThemeRuntimeAsset, "altText" | "label">, index?: number): string {
  const storedAlt = mediaLabel(asset.altText);
  if (storedAlt) return storedAlt;
  const frame = typeof index === "number" ? ` ${index + 1}` : "";
  return `Uploaded video frame${frame}: ${mediaLabel(asset.label) || "reference image"}`;
}

function isVideoRuntimeJob(job: RuntimeJob): boolean {
  const fields = jobFields(job);
  const values = [
    job.requestJson?.mode,
    job.requestJson?.outputType,
    job.requestJson?.videoThemeId,
    fields.mode,
    fields.outputType,
    fields.videoThemeId,
    fields.videoThemeName,
    fields.toolPresetId,
    fields.toolPresetTitle
  ];
  return values
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
    .includes("video");
}

function isImageProviderError(error: string): boolean {
  return error.includes("ai_provider_image_") || error.includes("no_image_ai_provider_configured");
}

function isProviderTemporarilyUnavailableError(error: string): boolean {
  const lowerError = error.toLowerCase();
  return /upstream_error|temporarily unavailable|service unavailable|try again later|failed_502|failed_503|failed_504|failed_524|\u670d\u52a1\u6682\u65f6\u4e0d\u53ef\u7528|\u7a0d\u540e\u91cd\u8bd5/.test(lowerError);
}

function workspaceGenerationErrorText(error: string, spanish = false, providerFailure?: VideoProviderFailure, isVideoRequest = false): string {
  const lowerError = error.toLowerCase();
  if (!isVideoRequest && isImageProviderError(error)) {
    if (error.includes("no_image_ai_provider_configured")) {
      return t(spanish, "Image generation is temporarily unavailable while provider access is being updated.", "La generacion de imagenes no esta disponible temporalmente mientras se actualiza el acceso del proveedor.");
    }
    if (isProviderTemporarilyUnavailableError(error)) {
      return t(spanish, "The image provider is temporarily unavailable upstream.", "El proveedor de imagenes no esta disponible temporalmente en upstream.");
    }
    if (error.includes("ai_provider_image_edit_failed_404")) {
      return t(spanish, "The selected image provider endpoint rejected this request.", "El endpoint del proveedor de imagenes rechazo esta solicitud.");
    }
    if (lowerError.includes("timeout") || lowerError.includes("und_err_connect_timeout")) {
      return t(spanish, "The image provider did not respond in time.", "El proveedor de imagenes no respondio a tiempo.");
    }
    if (lowerError.includes("fetch failed") || lowerError.includes("socket") || lowerError.includes("econnreset") || lowerError.includes("terminated")) {
      return t(spanish, "The image provider connection was interrupted.", "La conexion con el proveedor de imagenes se interrumpio.");
    }
    return t(spanish, "The image provider could not finish this image.", "El proveedor de imagenes no pudo terminar esta imagen.");
  }
  if (isVideoRequest && isVideoProviderUpstreamUnavailableError(error)) {
    return t(spanish, "The video provider is temporarily unavailable upstream.", "El proveedor de video no esta disponible temporalmente en upstream.");
  }
  const normalizedFailure = isVideoRequest ? providerFailure ?? normalizeVideoProviderFailure({ error }) : undefined;
  if (normalizedFailure) return videoProviderFailureCustomerMessage(normalizedFailure, spanish);
  if (isVideoRequest && (error.includes("ai_provider_video_frame_public_urls_required") || error.includes("video_public_asset_url_required"))) {
    return t(spanish, "Frame images need a public URL before the video provider can read them.", "Los fotogramas necesitan una URL publica antes de que el proveedor de video pueda leerlos.");
  }
  if (isVideoRequest && (error.includes("ai_provider_video_content_unverified") || error.includes("ai_provider_video_reference_channel_unreliable") || error.includes("video_provider_temporarily_unavailable") || error.includes("no_video_ai_provider_configured"))) {
    return t(spanish, "Video generation is temporarily unavailable while provider access is being updated.", "La generacion de video no esta disponible temporalmente mientras se actualiza el acceso del proveedor.");
  }
  if (isVideoRequest && (error.includes("ai_provider_video_create_failed_524") || error.includes("ai_provider_video_create_failed_504"))) {
    return t(spanish, "The video provider timed out while creating the video task.", "El proveedor de video agoto el tiempo al crear la tarea.");
  }
  if (isVideoRequest && (lowerError.includes("econnreset") || lowerError.includes("fetch failed") || lowerError.includes("socket") || lowerError.includes("terminated"))) {
    return t(spanish, "The video provider connection was interrupted.", "La conexion con el proveedor de video se interrumpio.");
  }
  if (isVideoRequest && error.includes("ai_provider_video_failed")) {
    return t(spanish, "The video provider could not finish this video.", "El proveedor de video no pudo terminar este video.");
  }
  return error;
}

function useWorkspaceRuntime(siteId: string, refreshKey = 0, enabled = true): WorkspaceRuntimeState {
  const [state, setState] = useState<WorkspaceRuntimeState>(() => enabled ? { status: "loading", refreshKey } : { status: "idle" });
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setState((current) => current.status === "ready" || current.status === "loading" ? current : { status: "idle" });
      return;
    }
    const controller = new AbortController();
    const requestSequence = ++requestSequenceRef.current;
    const refreshParam = refreshKey > 0 ? `&refresh=${refreshKey}` : "";
    setState((current) => ({
      status: "loading",
      refreshKey,
      ...(current.runtime ? { runtime: current.runtime } : {})
    }));
    fetch(`/api/sites/${siteId}/customer/runtime?profile=workspace${refreshParam}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; runtime?: ThemeRuntimeData; error?: string };
        if (!response.ok || !data.ok || !data.runtime) throw new Error(data.error || "workspace_runtime_unavailable");
        if (controller.signal.aborted || requestSequence !== requestSequenceRef.current) return;
        setState({ status: "ready", refreshKey, runtime: data.runtime });
      })
      .catch((error) => {
        if (controller.signal.aborted || requestSequence !== requestSequenceRef.current) return;
        setState((current) => ({
          status: "error",
          refreshKey,
          ...(current.runtime ? { runtime: current.runtime } : {}),
          error: error instanceof Error ? error.message : "workspace_runtime_unavailable"
        }));
      });

    return () => controller.abort();
  }, [enabled, siteId, refreshKey]);

  return state;
}

function workspaceRuntimeNeedsInitialRefresh(runtime?: ThemeRuntimeData): boolean {
  if (!runtime) return true;
  return !runtime.jobs.length &&
    !runtime.assets.length &&
    !runtime.albums.length &&
    !runtime.ledger.length &&
    !(runtime.subscriptions?.length) &&
    !(runtime.orders?.length) &&
    !(runtime.customerModels?.length);
}

function WorkspaceInlineLoading({ label }: { label: string }) {
  return (
    <div aria-busy="true" className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm text-white/64" role="status">
      <div className="h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] rounded-full bg-[#31d4ff]" />
      </div>
      <p className="mt-3">{label}</p>
    </div>
  );
}

type StudioConsoleSectionId = "generate" | "try-on" | "video" | "background" | "model";

const studioConsoleSections: Array<{ id: StudioConsoleSectionId; label: string; panel: CustomerWorkspacePanel; anchor: WorkspaceAnchor }> = [
  { id: "video", label: "Image to Video", panel: "video", anchor: "step-video" },
  { id: "model", label: "Create New AI Model", panel: "create", anchor: "source-photos" }
];

const studioGenderOptions = [
  { id: "man", label: "Man", icon: UserRound },
  { id: "woman", label: "Woman", icon: Users },
  { id: "nonbinary", label: "N-Bi", icon: UserRound }
];

function studioConsoleLabel(id: StudioConsoleSectionId, spanish: boolean): string {
  const labels: Record<StudioConsoleSectionId, string> = {
    generate: t(spanish, "Generate Image", "Generar imagen"),
    "try-on": t(spanish, "Try-On", "Probador virtual"),
    video: t(spanish, "Image to Video", "Imagen a video"),
    background: t(spanish, "Change Background", "Cambiar fondo"),
    model: t(spanish, "Create New AI Model", "Crear nuevo modelo IA")
  };
  return labels[id];
}

function studioGenderLabel(id: string, spanish: boolean): string {
  if (id === "man") return t(spanish, "Man", "Hombre");
  if (id === "woman") return t(spanish, "Woman", "Mujer");
  return t(spanish, "N-Bi", "N-Bi");
}

export function CustomerWorkspaceShell({
  site,
  customer,
  assets,
  siteAiApps,
  creativePackCategories = [],
  creativePacks,
  initialCreativePackId,
  initialToolId,
  initialRuntime,
  initialPanel = "overview",
  toolMenuItems = [],
  videoThemes = []
}: {
  site: CustomerWorkspaceSite;
  customer: PublicCustomer;
  assets: ThemeRuntimeAsset[];
  siteAiApps: SiteAiApp[];
  creativePackCategories?: CreativePackCategory[];
  creativePacks: CreativePack[];
  initialCreativePackId?: string;
  initialToolId?: string;
  initialRuntime?: ThemeRuntimeData;
  initialPanel?: CustomerWorkspacePanel;
  toolMenuItems?: ToolMenuItem[];
  videoThemes?: VideoTheme[];
}) {
  const searchParams = useSearchParams();
  const spanishXby = isSpanishXbyWorkspaceSite(site);
  const initialRuntimeNeedsRefresh = workspaceRuntimeNeedsInitialRefresh(initialRuntime);
  const [runtimeRefreshKey, setRuntimeRefreshKey] = useState(0);
  const [runtimeFetchEnabled, setRuntimeFetchEnabled] = useState(() => initialRuntimeNeedsRefresh);
  const runtimeState = useWorkspaceRuntime(site.id, runtimeRefreshKey, runtimeFetchEnabled);
  const hideEmptyInitialRuntime = initialRuntimeNeedsRefresh && !runtimeState.runtime &&
    (runtimeState.status === "idle" || runtimeState.status === "loading" || runtimeState.status === "error");
  const runtime = runtimeState.runtime ?? (hideEmptyInitialRuntime ? undefined : initialRuntime);
  const [currentCustomerBalance, setCurrentCustomerBalance] = useState<PublicCustomer["balance"]>(() => customer.balance);
  const workspaceCustomer = useMemo(() => ({ ...customer, balance: currentCustomerBalance }), [currentCustomerBalance, customer]);
  const [runtimeAssets, setRuntimeAssets] = useState<ThemeRuntimeAsset[]>(() => initialRuntime?.assets ?? assets);
  const hydratedAssets = runtimeAssets;
  const [liveJobUpdates, setLiveJobUpdates] = useState<Record<string, LiveJobPatch>>({});
  const baseRecentJobs = runtime?.jobs ?? [];
  const recentJobs = useMemo(
    () => {
      const patchedJobs = baseRecentJobs.map((job) => {
        const patch = liveJobUpdates[job.id];
        return patch ? applyLiveJobPatch(job, patch) : job;
      });
      const patchedJobIds = new Set(patchedJobs.map((job) => job.id));
      const liveOnlyJobs = Object.entries(liveJobUpdates)
        .filter(([jobId]) => !patchedJobIds.has(jobId))
        .map(([jobId, patch]) => runtimeJobFromLivePatch(jobId, patch));
      return [...patchedJobs, ...liveOnlyJobs]
        .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
    },
    [baseRecentJobs, liveJobUpdates]
  );
  const customerModels = runtime?.customerModels ?? [];
  const adminSubscriptionBypass = runtime?.adminAccess?.canBypassBilling === true;
  const subscriptionStatus: WorkspaceSubscriptionStatus = adminSubscriptionBypass
    ? "admin"
    : runtime
      ? hasActiveWorkspaceSubscription(runtime.subscriptions) ? "active" : "required"
      : "loading";
  const isAidreamcapes = /aidreamcapes/i.test(`${site.slug} ${site.name} ${site.primaryDomain} ${site.branding.logoText}`);
  const [activePanel, setActivePanel] = useState<CustomerWorkspacePanel>(initialPanel);
  const [resourceTab, setResourceTab] = useState<WorkspaceResourceTab>("all");
  const [preferredCreateMode, setPreferredCreateMode] = useState<WorkspaceCreateMode>("theme");
  const [preferredCreateModeRequest, setPreferredCreateModeRequest] = useState(0);
  const [appliedOperationContext, setAppliedOperationContext] = useState<{ action?: string; note?: string; source?: string }>({});
  const [activeStudioSection, setActiveStudioSection] = useState<StudioConsoleSectionId | null>(initialPanel === "video" ? "video" : "model");
  const [studioModelName, setStudioModelName] = useState("");
  const [studioTrainingMode, setStudioTrainingMode] = useState<"single" | "couple">(isAidreamcapes ? "single" : "couple");
  const [primaryGender, setPrimaryGender] = useState("nonbinary");
  const [partnerGender, setPartnerGender] = useState("nonbinary");
  const [selectedPreviewAssetId, setSelectedPreviewAssetId] = useState<string | null>(null);
  const [sampleAssets, setSampleAssets] = useState<SampleAsset[]>(() => hydratedAssets.filter(isSampleCandidateAsset));
  const [primarySampleIds, setPrimarySampleIds] = useState<string[]>([]);
  const [partnerSampleIds, setPartnerSampleIds] = useState<string[]>([]);
  const [videoFrameAssets, setVideoFrameAssets] = useState<VideoFrameAsset[]>(() => hydratedAssets.filter(isVideoFrameCandidateAsset));
  const [selectedVideoFrameIds, setSelectedVideoFrameIds] = useState<string[]>([]);
  const [draggedVideoFrameId, setDraggedVideoFrameId] = useState<string | null>(null);
  const [uploadingVideoFrames, setUploadingVideoFrames] = useState(false);
  const [videoFrameMessage, setVideoFrameMessage] = useState(() => t(spanishXby, `Choose up to ${VIDEO_FRAME_UPLOAD_LIMIT} image files. WebP and other browser-readable images are converted to video-ready JPG or PNG before upload.`, `Elige hasta ${VIDEO_FRAME_UPLOAD_LIMIT} archivos de imagen. WebP y otras imagenes legibles por el navegador se convierten a JPG o PNG listo para video antes de subir.`));
  const [videoWorkspaceTab, setVideoWorkspaceTab] = useState<VideoWorkspaceTab>("generate");
  const [retryVideoDraft, setRetryVideoDraft] = useState<VideoRetryDraft | null>(null);
  const [retryImageDraft, setRetryImageDraft] = useState<JobCreateRetryDraft | null>(null);
  const [preferredToolId, setPreferredToolId] = useState<string | undefined>(undefined);
  const [uploadingSampleTarget, setUploadingSampleTarget] = useState<SampleTarget | null>(null);
  const [sampleUploadMessage, setSampleUploadMessage] = useState(() => t(spanishXby, "Upload samples to preview them here before generation.", "Sube muestras para verlas aqui antes de generar."));
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const [runtimeRefreshMessage, setRuntimeRefreshMessage] = useState("");
  const [manualRefreshPending, setManualRefreshPending] = useState(false);
  const [manualRefreshKey, setManualRefreshKey] = useState<number | null>(null);
  const eventRefreshKeyRef = useRef<number | null>(null);
  const pendingEventRefreshRef = useRef(false);
  const eventRefreshTimerRef = useRef<number | undefined>(undefined);
  const foregroundRefreshAtRef = useRef(Date.now());
  const runtimeLoadingRef = useRef(false);
  const runtimeAutoRefreshAllowedRef = useRef(false);
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);
  const [pendingCreatedVideoJobId, setPendingCreatedVideoJobId] = useState<string | null>(null);
  const [videoSubmissionPending, setVideoSubmissionPending] = useState(false);
  const [videoCreationFailureMessage, setVideoCreationFailureMessage] = useState("");
  const [videoCreationFailureAtMs, setVideoCreationFailureAtMs] = useState<number | null>(null);
  const [retryingVideoJobId, setRetryingVideoJobId] = useState<string | null>(null);
  const [retryingImageJobId, setRetryingImageJobId] = useState<string | null>(null);
  const [previewSampleId, setPreviewSampleId] = useState<string | null>(null);
  const [deletingSampleId, setDeletingSampleId] = useState<string | null>(null);
  const [sampleDeleteConfirm, setSampleDeleteConfirm] = useState<{ assets: SampleAsset[]; label: string } | null>(null);
  const videoFrameUploadInputRef = useRef<HTMLInputElement | null>(null);
  const deletedVideoFrameIdsRef = useRef<Set<string>>(new Set());
  const locallyCreatedVideoFrameIdsRef = useRef<Map<string, number>>(new Map());
  const videoFrameBlobUrlsRef = useRef<Set<string>>(new Set());
  const sampleUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSampleTargetRef = useRef<SampleTarget>("primary");
  const sampleBlobUrlsRef = useRef<Set<string>>(new Set());
  const restoredSampleSelectionRef = useRef(false);
  const syncedInitialSamplesRef = useRef(false);
  const sampleSelectionStorageKey = useMemo(() => `dreamshoot:workspace:${site.id}:${customer.id}:sample-selection:v2`, [customer.id, site.id]);
  const tabItems: Array<{ id: WorkspaceResourceTab; label: string }> = useMemo(
    () => [
      { id: "all", label: t(spanishXby, "All", "Todo") },
      { id: "recent", label: t(spanishXby, "Recent", "Reciente") },
      { id: "favorites", label: t(spanishXby, "Favorites", "Favoritos") },
      { id: "packages", label: t(spanishXby, "Pick Package", "Elegir paquete") }
    ],
    [spanishXby]
  );
  const videoTabItems: Array<{ id: VideoWorkspaceTab; label: string }> = useMemo(
    () => [
      { id: "generate", label: t(spanishXby, "Input", "Entrada") },
      { id: "videos", label: t(spanishXby, "Video results", "Resultados") }
    ],
    [spanishXby]
  );
  const galleryAssets = hydratedAssets.filter((asset) => shouldShowAssetOnSurface(asset, "workspace-gallery"));
  const sourceAssets = sampleAssets.filter(shouldRenderSourceSample);
  const readySourceAssets = sourceAssets.filter((asset) => !asset.id.startsWith("local:") && !assetPreviewIsLoading(asset) && asset.localStatus !== "failed");
  const readyPrimarySampleIds = primarySampleIds.filter((id) => readySourceAssets.some((asset) => asset.id === id));
  const readyPartnerSampleIds = partnerSampleIds.filter((id) => readySourceAssets.some((asset) => asset.id === id));
  const hasRequiredStudioSamples = studioTrainingMode === "couple"
    ? readyPrimarySampleIds.length > 0 && readyPartnerSampleIds.length > 0
    : readyPrimarySampleIds.length > 0;
  const studioSampleRequirementMessage = studioTrainingMode === "couple"
    ? t(spanishXby, "Couple mode requires at least one selected photo in both Your Samples and Partner Samples.", "El modo pareja requiere al menos una foto seleccionada en Tus muestras y Muestras de la pareja.")
    : t(spanishXby, "Select at least one sample before training.", "Selecciona al menos una muestra antes de entrenar.");
  const previewSamples = sourceAssets.filter((asset) => asset.localStatus !== "failed");
  const previewSampleIndex = previewSampleId ? previewSamples.findIndex((asset) => asset.id === previewSampleId) : -1;
  const previewSample = previewSampleIndex >= 0 ? previewSamples[previewSampleIndex] : undefined;
  const readyVideoFrameAssets = useMemo(() => videoFrameAssets.filter((asset) => asset.localStatus !== "failed"), [videoFrameAssets]);
  const readyVideoFrameAssetById = useMemo(() => new Map(readyVideoFrameAssets.map((asset) => [asset.id, asset])), [readyVideoFrameAssets]);
  const selectedVideoFrames = useMemo(
    () => selectedVideoFrameIds
      .map((assetId) => readyVideoFrameAssetById.get(assetId))
      .filter((asset): asset is VideoFrameAsset => Boolean(asset)),
    [readyVideoFrameAssetById, selectedVideoFrameIds]
  );
  const readySelectedVideoFrameIds = useMemo(
    () => selectedVideoFrames
      .filter(videoFrameAssetReadyForGeneration)
      .map((asset) => asset.id),
    [selectedVideoFrames]
  );
  const maxVideoFrameCount = VIDEO_FRAME_UPLOAD_LIMIT;
  const resourceStatusJobs = recentJobs.filter((job) => !isVideoRuntimeJob(job));
  const videoRuntimeJobs = recentJobs.filter(isVideoRuntimeJob);
  const latestSucceededVideoJob = videoRuntimeJobs.find((job) => workspaceJobEffectiveStatus(job) === "succeeded");
  const latestSucceededVideoJobUpdatedMs = latestSucceededVideoJob
    ? dateMs(latestSucceededVideoJob.updatedAt) ?? dateMs(latestSucceededVideoJob.createdAt) ?? 0
    : 0;
  const currentVideoRuntimeJobs = latestSucceededVideoJob
    ? videoRuntimeJobs.filter((job) => {
        const status = workspaceJobEffectiveStatus(job);
        if (status !== "failed" && status !== "partial") return true;
        const jobUpdatedMs = dateMs(job.updatedAt) ?? dateMs(job.createdAt) ?? 0;
        return jobUpdatedMs > latestSucceededVideoJobUpdatedMs;
      })
    : videoRuntimeJobs;
  const pendingCreatedVideoJob = pendingCreatedVideoJobId ? videoRuntimeJobs.find((job) => job.id === pendingCreatedVideoJobId) : undefined;
  const resourceJobStatuses = resourceStatusJobs.map((job) => workspaceJobEffectiveStatus(job));
  const videoJobStatuses = currentVideoRuntimeJobs.map((job) => workspaceJobEffectiveStatus(job));
  const activeJobs = resourceJobStatuses.filter((status) => status === "queued" || status === "running").length;
  const failedJobs = resourceJobStatuses.filter((status) => status === "failed" || status === "partial").length;
  const activeVideoJobs = videoJobStatuses.filter((status) => status === "queued" || status === "running").length;
  const failedVideoJobs = videoJobStatuses.filter((status) => status === "failed" || status === "partial").length;
  const runtimeIsLoading = runtimeState.status === "loading";
  const waitingForCreatedVideoJob = Boolean(pendingCreatedVideoJobId && !pendingCreatedVideoJob && runtimeState.status !== "error");
  const showVideoCreationFailure = Boolean(videoCreationFailureMessage);
  const runtimeInitialLoadFailed = initialRuntimeNeedsRefresh && runtimeState.status === "error" && !runtimeState.runtime;
  const runtimeIsInitializing = !workspaceNotice && !focusedJobId && !runtime && (runtimeState.status === "idle" || (runtimeState.status === "loading" && runtimeState.refreshKey === 0) || runtimeInitialLoadFailed);
  const completedRuntimeRefreshKey = runtimeState.status === "ready" || runtimeState.status === "error" ? runtimeState.refreshKey : null;
  const runtimeAutoRefreshAllowed = runtimeIsInitializing || waitingForCreatedVideoJob || activeJobs > 0 || activeVideoJobs > 0;
  const runtimeRefreshUiPending = manualRefreshPending || (runtimeIsLoading && runtimeAutoRefreshAllowed);
  const resourceTitleByTab: Record<WorkspaceResourceTab, string> = {
    all: t(spanishXby, "All assets", "Todos los recursos"),
    recent: t(spanishXby, "Recent generations", "Generaciones recientes"),
    favorites: t(spanishXby, "Favorite selections", "Favoritos guardados"),
    "try-on": t(spanishXby, "Try-on results", "Resultados de probador"),
    packages: t(spanishXby, "Available packages", "Paquetes disponibles")
  };

  useEffect(() => {
    setCurrentCustomerBalance(customer.balance);
  }, [customer.balance]);

  const applyCreatedJobFeedback = (feedback?: CreatedWorkspaceJobFeedback) => {
    if (feedback?.customerBalance) setCurrentCustomerBalance(feedback.customerBalance);
  };

  function clearQueuedEventRefresh() {
    if (eventRefreshTimerRef.current !== undefined) {
      window.clearTimeout(eventRefreshTimerRef.current);
      eventRefreshTimerRef.current = undefined;
    }
    pendingEventRefreshRef.current = false;
    eventRefreshKeyRef.current = null;
  }

  function applyLiveJobEventPatch(eventJobId: string, patch: LiveJobPatch) {
    setLiveJobUpdates((current) => ({
      ...current,
      [eventJobId]: (() => {
        const previousPatch = current[eventJobId];
        const progress = monotonicRuntimeProgress(previousPatch?.progress, patch.progress, patch.status);
        const timing = patch.timing
          ? { ...(previousPatch?.timing ?? {}), ...patch.timing }
          : undefined;
        return {
          ...previousPatch,
          ...(patch.status ? { status: patch.status } : {}),
          ...(patch.stage ? { stage: patch.stage } : {}),
          ...(progress !== undefined ? { progress } : {}),
          ...(patch.outputSlots ? { outputSlots: mergeRuntimeOutputSlots(previousPatch?.outputSlots, patch.outputSlots) } : {}),
          ...(patch.error ? { error: patch.error } : {}),
          ...(timing ? { timing } : {}),
          ...(patch.updatedAt ? { updatedAt: patch.updatedAt } : {})
        };
      })()
    }));
  }

  function queueWorkspaceRuntimeRefresh(reason: "manual" | "final-event" | "create" | "resume") {
    if (reason === "resume" && !runtimeAutoRefreshAllowedRef.current) return;
    setRuntimeFetchEnabled(true);
    if (reason === "manual") {
      setManualRefreshPending(true);
      setRuntimeRefreshMessage("");
    }
    if (reason === "final-event") {
      if (eventRefreshTimerRef.current !== undefined) return;
      eventRefreshTimerRef.current = window.setTimeout(() => {
        eventRefreshTimerRef.current = undefined;
        if (runtimeLoadingRef.current) {
          pendingEventRefreshRef.current = true;
          return;
        }
        setRuntimeRefreshKey((current) => {
          const next = current + 1;
          eventRefreshKeyRef.current = next;
          return next;
        });
      }, 300);
      return;
    }
    if (runtimeLoadingRef.current) {
      if (reason === "manual") {
        setRuntimeRefreshKey((current) => {
          const next = current + 1;
          setManualRefreshKey(next);
          return next;
        });
        return;
      }
      if (reason === "create") {
        setRuntimeRefreshKey((current) => current + 1);
        return;
      }
      pendingEventRefreshRef.current = true;
      return;
    }
    setRuntimeRefreshKey((current) => {
      const next = current + 1;
      if (reason === "manual") setManualRefreshKey(next);
      return next;
    });
  }

  useEffect(() => {
    if (runtimeFetchEnabled || activePanel !== "video" || videoFrameAssets.length) return;
    setRuntimeFetchEnabled(true);
  }, [activePanel, runtimeFetchEnabled, videoFrameAssets.length]);

  useEffect(() => {
    if (runtimeFetchEnabled || !initialRuntimeNeedsRefresh) return;
    const startRuntimeFetch = () => setRuntimeFetchEnabled(true);
    let idleId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === "function") {
        idleId = window.requestIdleCallback(startRuntimeFetch, { timeout: 1200 });
        return;
      }
      startRuntimeFetch();
    }, 120);
    return () => {
      window.clearTimeout(timeoutId);
      if (idleId !== undefined && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleId);
    };
  }, [initialRuntimeNeedsRefresh, runtimeFetchEnabled]);

  useEffect(() => {
    runtimeLoadingRef.current = runtimeState.status === "loading";
  }, [runtimeState.status]);

  useEffect(() => {
    runtimeAutoRefreshAllowedRef.current = runtimeAutoRefreshAllowed;
  }, [runtimeAutoRefreshAllowed]);

  useEffect(() => {
    if (runtimeState.status === "ready") setLiveJobUpdates({});
  }, [completedRuntimeRefreshKey, runtimeState.status]);

  useEffect(() => () => {
    if (eventRefreshTimerRef.current !== undefined) window.clearTimeout(eventRefreshTimerRef.current);
  }, []);

  useEffect(() => {
    const refreshWhenForegrounded = () => {
      if (document.hidden) return;
      const now = Date.now();
      if (now - foregroundRefreshAtRef.current < 8_000) return;
      foregroundRefreshAtRef.current = now;
      queueWorkspaceRuntimeRefresh("resume");
    };
    window.addEventListener("focus", refreshWhenForegrounded);
    document.addEventListener("visibilitychange", refreshWhenForegrounded);
    return () => {
      window.removeEventListener("focus", refreshWhenForegrounded);
      document.removeEventListener("visibilitychange", refreshWhenForegrounded);
    };
  }, []);

  useEffect(() => {
    if (!pendingCreatedVideoJobId) return;
    if (pendingCreatedVideoJob || runtimeState.status === "error") setPendingCreatedVideoJobId(null);
  }, [pendingCreatedVideoJob, pendingCreatedVideoJobId, runtimeState.status]);

  useEffect(() => {
    const jobStatus = searchParams.get("job_status");
    if (jobStatus !== "unavailable" && jobStatus !== "workspace") return;
    const jobId = searchParams.get("job_id");
    setFocusedJobId(jobId);
    setWorkspaceNotice(
      jobStatus === "workspace"
        ? t(spanishXby, "Request status is shown in your workspace. The list has been refreshed so you can review the latest generation result.", "El estado de la solicitud se muestra en tu espacio privado. La lista se actualizo para revisar el resultado mas reciente.")
        : jobId
          ? t(spanishXby, "That request is still syncing or is no longer available from this session. Your workspace has been refreshed so you can review the latest request status.", "Esa solicitud sigue sincronizando o ya no esta disponible en esta sesion. Tu espacio se actualizo para revisar el estado mas reciente.")
          : t(spanishXby, "That request is still syncing or is no longer available from this session. Your workspace has been refreshed.", "Esa solicitud sigue sincronizando o ya no esta disponible en esta sesion. Tu espacio se actualizo.")
    );
    setRuntimeFetchEnabled(true);
    setRuntimeRefreshKey((current) => current + 1);
    setActivePanel("overview");
    setResourceTab("all");
    window.setTimeout(() => {
      document.getElementById("resources-all")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.EventSource === "undefined") return;
    const events = new EventSource(`/api/sites/${site.id}/customer/job-events`);
    const refreshFromJobEvent = (event: MessageEvent<string>) => {
      const payload = (() => {
        try {
          return JSON.parse(event.data) as CustomerJobEventPayload;
        } catch {
          return {};
        }
      })();
      if (typeof payload.jobId !== "string") return;
      const eventJobId = payload.jobId;
      const status = runtimeJobStatusFromEvent(payload.status);
      const progress = normalizedProgressValue(payload.progress);
      const outputSlots = runtimeOutputSlotsFromEvent(payload.outputSlots);
      const stage = typeof payload.stage === "string" ? payload.stage : undefined;
      const error = typeof payload.error === "string" ? payload.error : undefined;
      const timing = runtimeTimingFromEvent(payload.timing);
      const updatedAt = typeof payload.updatedAt === "string" ? payload.updatedAt : new Date().toISOString();
      const finalEvent = payload.eventKind === "final" || payload.type === "result" || status === "succeeded" || status === "failed";
      setFocusedJobId((current) => current ?? eventJobId);
      applyLiveJobEventPatch(eventJobId, {
        ...(status ? { status } : {}),
        ...(stage ? { stage } : {}),
        ...(progress !== undefined ? { progress } : {}),
        ...(outputSlots ? { outputSlots } : {}),
        ...(error ? { error } : {}),
        ...(timing ? { timing } : {}),
        updatedAt
      });
      if (!finalEvent) {
        setRuntimeRefreshMessage(
          progress !== undefined
            ? t(spanishXby, `Generator progress received (${Math.round(progress)}%).`, `Progreso del generador recibido (${Math.round(progress)}%).`)
            : t(spanishXby, "Generator progress received.", "Progreso del generador recibido.")
        );
        return;
      }
      clearQueuedEventRefresh();
      queueWorkspaceRuntimeRefresh("final-event");
      setRuntimeRefreshMessage(spanishXby ? `Generador finalizado ${workspaceJobTime(updatedAt)}` : `Generator finished ${workspaceJobTime(updatedAt)}`);
    };
    events.addEventListener("job", refreshFromJobEvent);
    events.addEventListener("error", () => {
      setRuntimeRefreshMessage(t(spanishXby, "Live updates are reconnecting.", "Las actualizaciones en vivo se estan reconectando."));
    });
    return () => {
      events.removeEventListener("job", refreshFromJobEvent);
      events.close();
    };
  }, [site.id, spanishXby]);

  useEffect(() => {
    if (!manualRefreshPending || manualRefreshKey === null || completedRuntimeRefreshKey !== manualRefreshKey) return;
    if (runtimeState.status === "ready") {
      setManualRefreshPending(false);
      setManualRefreshKey(null);
      setRuntimeRefreshMessage(spanishXby ? `Ultima revision ${workspaceJobTime(new Date().toISOString())}` : `Last checked ${workspaceJobTime(new Date().toISOString())}`);
    }
    if (runtimeState.status === "error") {
      setManualRefreshPending(false);
      setManualRefreshKey(null);
      setRuntimeRefreshMessage(t(spanishXby, "Status refresh failed. Try again.", "No se pudo actualizar el estado. Intentalo de nuevo."));
    }
  }, [completedRuntimeRefreshKey, manualRefreshKey, manualRefreshPending, runtimeState.status]);
  useEffect(() => {
    const eventRefreshKey = eventRefreshKeyRef.current;
    if (eventRefreshKey !== null && completedRuntimeRefreshKey === eventRefreshKey) {
      eventRefreshKeyRef.current = null;
      if (runtimeState.status === "ready") {
        setRuntimeRefreshMessage(spanishXby ? `Actualizado por callback del generador ${workspaceJobTime(new Date().toISOString())}` : `Updated from generator callback ${workspaceJobTime(new Date().toISOString())}`);
      }
      if (runtimeState.status === "error") {
        setRuntimeRefreshMessage(t(spanishXby, "Generator callback received, but workspace refresh failed. Use Check now.", "Callback recibido, pero fallo la actualizacion. Usa Revisar ahora."));
      }
    }
    if ((runtimeState.status === "ready" || runtimeState.status === "error") && pendingEventRefreshRef.current) {
      pendingEventRefreshRef.current = false;
      setRuntimeFetchEnabled(true);
      setRuntimeRefreshKey((current) => {
        const next = current + 1;
        eventRefreshKeyRef.current = next;
        return next;
      });
    }
  }, [completedRuntimeRefreshKey, runtimeState.status]);
  useEffect(() => {
    const nextAssets = runtime?.assets ?? initialRuntime?.assets ?? assets;
    setRuntimeAssets((current) => {
      if (!runtime?.assets && runtimeState.status === "loading" && current.length) return current;
      const nextAssetIds = new Set(nextAssets.map((asset) => asset.id));
      nextAssetIds.forEach((assetId) => locallyCreatedVideoFrameIdsRef.current.delete(assetId));
      const now = Date.now();
      const protectedVideoFrames = current.filter((asset) => {
        const keepUntil = locallyCreatedVideoFrameIdsRef.current.get(asset.id);
        if (keepUntil === undefined) return false;
        if (keepUntil <= now || deletedVideoFrameIdsRef.current.has(asset.id)) {
          locallyCreatedVideoFrameIdsRef.current.delete(asset.id);
          return false;
        }
        return isVideoFrameCandidateAsset(asset) && !nextAssetIds.has(asset.id);
      });
      if (!protectedVideoFrames.length) return nextAssets;
      const protectedIds = new Set(protectedVideoFrames.map((asset) => asset.id));
      return [
        ...protectedVideoFrames,
        ...nextAssets.filter((asset) => !protectedIds.has(asset.id))
      ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    });
  }, [assets, initialRuntime?.assets, runtime?.assets, runtimeState.status]);
  useEffect(() => {
    const hydratedFrameAssets = hydratedAssets.filter((asset) => isVideoFrameCandidateAsset(asset) && !deletedVideoFrameIdsRef.current.has(asset.id));
    const hydratedFrameIds = new Set(hydratedFrameAssets.map((asset) => asset.id));
    setVideoFrameAssets((current) => {
      const byId = new Map<string, VideoFrameAsset>();
      current.forEach((asset) => {
        if (deletedVideoFrameIdsRef.current.has(asset.id)) return;
        const localOnly = asset.id.startsWith("local:") || asset.localStatus === "uploading" || asset.localStatus === "failed";
        if (localOnly || hydratedFrameIds.has(asset.id)) byId.set(asset.id, asset);
      });
      hydratedFrameAssets.forEach((asset) => byId.set(asset.id, asset));
      return Array.from(byId.values())
        .filter((asset) => isVideoFrameCandidateAsset(asset) && !deletedVideoFrameIdsRef.current.has(asset.id))
        .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    });
  }, [hydratedAssets]);
  useEffect(() => {
    const availableFrameIds = new Set(readyVideoFrameAssets.map((asset) => asset.id));
    setSelectedVideoFrameIds((current) => {
      const next = trimVideoFrameSelection(current.filter((id) => availableFrameIds.has(id)), maxVideoFrameCount);
      return next.length === current.length && next.every((id, index) => id === current[index]) ? current : next;
    });
  }, [maxVideoFrameCount, readyVideoFrameAssets]);
  const videoResourceAssets = galleryAssets.filter(isVideoAsset);
  const videoWorkspaceSummary = runtimeIsInitializing
    ? t(spanishXby, "Loading video workspace", "Cargando espacio de video")
    : waitingForCreatedVideoJob
    ? t(spanishXby, "New video request created · refreshing status", "Nueva solicitud de video creada · actualizando estado")
    : spanishXby
      ? `${activeVideoJobs} trabajos activos · ${failedVideoJobs} requieren atencion · ${videoResourceAssets.length} videos generados`
      : `${activeVideoJobs} active jobs · ${failedVideoJobs} need attention · ${videoResourceAssets.length} generated videos`;
  const imageResourceAssets = galleryAssets.filter((asset) => !isVideoAsset(asset));
  const allResourceAssets = imageResourceAssets;
  const tryOnJobIds = new Set(
    recentJobs
      .filter((job) => JSON.stringify(job.requestJson ?? {}).toLowerCase().includes("try-on"))
      .map((job) => job.id)
  );
  const todayResourceAssets = imageResourceAssets.filter((asset) => isSameLocalDay(asset.createdAt, new Date()));
  const visibleResourceAssets =
    resourceTab === "all"
      ? allResourceAssets
      : resourceTab === "try-on"
        ? imageResourceAssets.filter((asset) => asset.jobId ? tryOnJobIds.has(asset.jobId) : false)
      : resourceTab === "recent"
        ? todayResourceAssets
      : resourceTab === "favorites"
        ? imageResourceAssets.filter((asset) => asset.isFavorite)
        : allResourceAssets;
  const outputCopyJobs = useMemo(() => recentJobs.map(outputCopyJob).filter((job): job is OutputCopyJob => Boolean(job)), [recentJobs]);
  const jobById = useMemo(() => new Map(outputCopyJobs.map((job) => [job.id, job])), [outputCopyJobs]);
  const assetById = useMemo(() => new Map(hydratedAssets.map((asset) => [asset.id, asset])), [hydratedAssets]);
  const outputAssetsByJobId = useMemo(() => {
    const assetsByJobId = new Map<string, ThemeRuntimeAsset[]>();
    galleryAssets.forEach((asset) => {
      if (!asset.jobId) return;
      assetsByJobId.set(asset.jobId, [...(assetsByJobId.get(asset.jobId) ?? []), asset]);
    });
    return assetsByJobId;
  }, [galleryAssets]);
  const outputPreviewUrlByStorageKey = useMemo(() => {
    const urls = new Map<string, string>();
    galleryAssets.forEach((asset) => {
      if (!asset.storageKey) return;
      urls.set(normalizedWorkspaceStorageKey(asset.storageKey), workspaceAssetPreviewUrl(asset));
    });
    return urls;
  }, [galleryAssets]);
  const workspaceSlotPreviewUrl = (storageKey: string) =>
    outputPreviewUrlByStorageKey.get(normalizedWorkspaceStorageKey(storageKey)) ?? workspaceStoragePreviewUrl(storageKey);
  const sourceSamplePreviewUrl = (asset: Pick<ThemeRuntimeAsset, "id" | "previewUrl" | "storageKey"> & { localStatus?: LocalUploadStatus }) =>
    asset.id.startsWith("local:") || asset.localStatus === "uploading"
      ? asset.previewUrl
      : asset.storageKey
        ? workspaceStoragePreviewUrl(asset.storageKey)
        : asset.previewUrl;
  function renderVideoPreviewLoading(compact = false) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#080c12]">
        <div className={`grid place-items-center rounded-full border border-cyan-300/24 bg-cyan-300/10 text-cyan-100/86 ${compact ? "h-11 w-11" : "h-14 w-14"}`}>
          <Film className={compact ? "h-5 w-5" : "h-6 w-6"} strokeWidth={1.8} />
        </div>
      </div>
    );
  }
  function renderVideoPreviewButton(params: {
    mediaKey: string;
    label: string;
    src: string;
    fallbackPosterSrc?: string;
    compact?: boolean;
    disabled?: boolean;
    onOpen?: () => void;
  }) {
    return (
      <WorkspaceVideoPreviewButton
        compact={params.compact}
        disabled={params.disabled}
        fallbackPosterSrc={params.fallbackPosterSrc}
        label={params.label}
        mediaKey={params.mediaKey}
        onOpen={params.onOpen}
        renderLoading={renderVideoPreviewLoading}
        spanish={spanishXby}
        src={params.src}
      />
    );
  }
  function renderFrameImagePreview(params: {
    asset: VideoFrameAsset;
    alt: string;
    className: string;
    compact?: boolean;
  }) {
    const loading = assetPreviewIsLoading(params.asset);
    if (params.asset.localStatus === "uploading" && params.asset.previewUrl) {
      const statusLabel = t(spanishXby, "Uploading", "Subiendo");
      return (
        <div
          aria-label={`${params.alt}. ${statusLabel}`}
          className={`${params.className} relative overflow-hidden bg-[#08131d]`}
          role="img"
          title={statusLabel}
        >
          <img alt={params.alt} className="h-full w-full object-cover opacity-72" decoding="async" src={params.asset.previewUrl} />
          <span className="absolute inset-x-1.5 bottom-1.5 rounded-full border border-white/15 bg-black/62 px-2 py-1 text-center text-[10px] font-semibold text-white">
            {statusLabel}
          </span>
        </div>
      );
    }
    if (!loading) {
      return <img alt={params.alt} className={params.className} decoding="async" loading="lazy" src={params.asset.previewUrl} />;
    }
    const statusLabel = params.asset.localStatus === "uploading"
      ? t(spanishXby, "Uploading preview", "Subiendo vista previa")
      : t(spanishXby, "Preparing preview", "Preparando vista previa");
    const compact = params.compact === true;
    return (
      <div
        aria-label={`${params.alt}. ${statusLabel}`}
        className={`${params.className} grid place-items-center bg-[#08131d] text-[#31d4ff]`}
        role="img"
        title={statusLabel}
      >
        <span className="grid justify-items-center gap-1.5">
          <span className={`${compact ? "h-4 w-4" : "h-6 w-6"} rounded-full border-2 border-[#31d4ff]/24 border-t-[#31d4ff] animate-spin`} />
          {compact ? null : <span className="max-w-[92%] truncate text-[10px] font-semibold text-cyan-100/86">{statusLabel}</span>}
        </span>
      </div>
    );
  }
  const visibleStatusJobs = useMemo(() => {
    const scopedJobs = recentJobs.filter((job) => !isVideoRuntimeJob(job));
    const focusedJob = focusedJobId ? scopedJobs.find((job) => job.id === focusedJobId) : undefined;
    if (focusedJob) return [focusedJob];
    const activeJob = scopedJobs.find((job) => {
      const status = workspaceJobEffectiveStatus(job);
      return status === "queued" || status === "running";
    });
    return [activeJob ?? scopedJobs[0]].filter((job): job is RuntimeJob => Boolean(job));
  }, [focusedJobId, recentJobs]);
  const visibleVideoStatusJobs = useMemo(() => {
    if (focusedJobId) {
      const focusedJob = videoRuntimeJobs.find((job) => job.id === focusedJobId);
      if (focusedJob) {
        const status = workspaceJobEffectiveStatus(focusedJob);
        if (status === "queued" || status === "running" || status === "succeeded" || status === "failed" || status === "partial") return [focusedJob];
      }
      if (pendingCreatedVideoJobId === focusedJobId) return [];
    }
    const activeJob = currentVideoRuntimeJobs.find((job) => {
      const status = workspaceJobEffectiveStatus(job);
      return status === "queued" || status === "running";
    });
    if (activeJob) return [activeJob];
    const attentionJob = currentVideoRuntimeJobs.find((job) => {
      const status = workspaceJobEffectiveStatus(job);
      return status === "failed" || status === "partial";
    });
    if (attentionJob) return [attentionJob];
    const latestSucceededJob = videoRuntimeJobs.find((job) => workspaceJobEffectiveStatus(job) === "succeeded");
    return latestSucceededJob ? [latestSucceededJob] : [];
  }, [currentVideoRuntimeJobs, focusedJobId, pendingCreatedVideoJobId, videoRuntimeJobs]);
  const hasVideoJobAfterCreationFailure = Boolean(videoCreationFailureAtMs && videoRuntimeJobs.some((job) => {
    const jobCreatedMs = dateMs(job.createdAt) ?? dateMs(job.updatedAt) ?? 0;
    return jobCreatedMs >= videoCreationFailureAtMs - 90_000;
  }));
  const showVideoCreationFailureCard = showVideoCreationFailure && !hasVideoJobAfterCreationFailure;
  const visibleVideoProgressJobs = showVideoCreationFailureCard ? [] : visibleVideoStatusJobs;
  useEffect(() => {
    if (!videoCreationFailureMessage || !hasVideoJobAfterCreationFailure) return;
    setVideoCreationFailureMessage("");
    setVideoCreationFailureAtMs(null);
    setWorkspaceNotice((current) => {
      if (
        current?.startsWith("The video request could not be created.") ||
        current?.startsWith("No se pudo crear la solicitud de video.")
      ) return "";
      return current;
    });
  }, [hasVideoJobAfterCreationFailure, videoCreationFailureMessage]);
  const outputIndexByAssetId = useMemo(() => {
    const counts = new Map<string, number>();
    return new Map(galleryAssets.map((asset) => {
      const jobKey = asset.jobId ?? asset.id;
      const next = (counts.get(jobKey) ?? 0) + 1;
      counts.set(jobKey, next);
      return [asset.id, next] as const;
    }));
  }, [galleryAssets]);
  const outputCopyForAsset = (asset: ThemeRuntimeAsset) => generatedOutputCopy({
    asset,
    imageIndex: outputIndexByAssetId.get(asset.id) ?? 1,
    job: asset.jobId ? jobById.get(asset.jobId) : undefined,
    jobs: outputCopyJobs
  });
  function outputAssetForSlot(slotStorageKey: string, outputAssets: ThemeRuntimeAsset[]) {
    return outputAssets.find((asset) => asset.storageKey && normalizedWorkspaceStorageKey(asset.storageKey) === normalizedWorkspaceStorageKey(slotStorageKey));
  }
  function slotPreviewAssetFor(job: RuntimeJob, slot: RuntimeOutputSlot, outputAssets: ThemeRuntimeAsset[], fallbackLabel?: string): ThemeRuntimeAsset | undefined {
    const slotStorageKey = slot.storageKey;
    if ((!slotStorageKey && !slot.previewUrl) || !slot.mimeType?.startsWith("video/")) return undefined;
    const existingAsset = slotStorageKey ? outputAssetForSlot(slotStorageKey, outputAssets) : undefined;
    if (existingAsset) return existingAsset;
    const label = fallbackLabel ?? `${workspaceJobTitle(job, false)} video ${slot.index}`;
    const normalizedSlotKey = slotStorageKey ? normalizedWorkspaceStorageKey(slotStorageKey) : `preview-url-${job.id}-${slot.index}`;
    return {
      id: `slot:${normalizedSlotKey}`,
      jobId: job.id,
      previewUrl: slotStorageKey ? workspaceSlotPreviewUrl(slotStorageKey) : slot.previewUrl!,
      storageKey: slotStorageKey,
      mimeType: slot.mimeType ?? "video/mp4",
      role: "output",
      reviewStatus: "approved",
      label,
      altText: label,
      createdAt: slot.updatedAt ?? job.updatedAt ?? job.createdAt
    };
  }
  const videoPreviewableAssetsById = new Map(videoResourceAssets.map((asset) => [asset.id, asset] as const));
  videoRuntimeJobs.forEach((job) => {
    const outputAssets = outputAssetsByJobId.get(job.id) ?? [];
    workspaceJobOutputSlots(job, outputAssets).forEach((slot) => {
      const slotAsset = slotPreviewAssetFor(job, slot, outputAssets);
      if (slotAsset && !videoPreviewableAssetsById.has(slotAsset.id)) videoPreviewableAssetsById.set(slotAsset.id, slotAsset);
    });
  });
  const videoPreviewableAssets = Array.from(videoPreviewableAssetsById.values());
  const previewableAssets = activePanel === "video" ? videoPreviewableAssets : visibleResourceAssets;
  const selectedPreviewIndex = selectedPreviewAssetId ? previewableAssets.findIndex((asset) => asset.id === selectedPreviewAssetId) : -1;
  const selectedPreviewAsset = selectedPreviewIndex >= 0 ? previewableAssets[selectedPreviewIndex] : undefined;
  const selectedPreviewCopy = selectedPreviewAsset ? outputCopyForAsset(selectedPreviewAsset) : undefined;
  const selectedPreviewLabel = selectedPreviewAsset ? generatedAssetLabel(selectedPreviewAsset, selectedPreviewCopy) : "";
  function fallbackVideoPosterForJob(jobId?: string): string | undefined {
    if (!jobId) return undefined;
    const job = videoRuntimeJobs.find((item) => item.id === jobId);
    const frameId = videoJobFrameIds(job)[0];
    const frameAsset = frameId ? assetById.get(frameId) : undefined;
    return frameAsset?.previewUrl;
  }
  function renderResourceAssetCard(asset: ThemeRuntimeAsset) {
    const outputCopy = outputCopyForAsset(asset);
    const assetLabel = generatedAssetLabel(asset, outputCopy);
    const video = isVideoAsset(asset);
    const previewUrl = workspaceAssetPreviewUrl(asset);
    return (
      <div className="group grid h-full min-h-[390px] overflow-hidden rounded-[12px] border border-white/8 bg-[#0d1118] transition hover:border-white/20" key={asset.id}>
        <div className="relative self-start">
          {video ? (
            <div className="relative">
              {renderVideoPreviewButton({
                mediaKey: `asset:${asset.id}`,
                label: assetLabel,
                src: previewUrl,
                fallbackPosterSrc: fallbackVideoPosterForJob(asset.jobId),
                onOpen: () => setSelectedPreviewAssetId(asset.id)
              })}
            </div>
          ) : (
            <button className="block w-full text-left" onClick={() => setSelectedPreviewAssetId(asset.id)} type="button">
              <img alt={assetLabel} className="aspect-[4/5] w-full object-cover transition duration-200 group-hover:scale-[1.03]" decoding="async" loading="lazy" src={previewUrl} />
            </button>
          )}
          <button
            aria-label={asset.isFavorite ? t(spanishXby, "Remove from favorites", "Quitar de favoritos") : t(spanishXby, "Add to favorites", "Anadir a favoritos")}
            className={`absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition ${
              asset.isFavorite ? "border-[#ff7ab8]/55 bg-[#ff4aa2]/90 text-white" : "border-white/18 bg-black/46 text-white/72 hover:bg-white/12 hover:text-white"
            }`}
            onClick={(event) => {
              event.stopPropagation();
              void toggleAssetFavorite(asset);
            }}
            type="button"
          >
            <Heart className={`h-4 w-4 ${asset.isFavorite ? "fill-current" : ""}`} strokeWidth={1.8} />
          </button>
        </div>
        <div className="grid min-h-[138px] grid-rows-[1fr_auto] gap-2 p-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" title={outputCopy.title}>{outputCopy.title}</p>
            {video && outputCopy.tags.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {outputCopy.tags.map((tag) => (
                  <span className="max-w-full truncate rounded-full border border-[#31d4ff]/22 bg-[#31d4ff]/10 px-2.5 py-1 text-[10px] font-semibold text-cyan-100/86" key={tag} title={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-white/42" title={outputCopy.description}>{outputCopy.description}</p>
          </div>
          <CustomerAssetDownloadButton
            assetId={asset.id}
            className="inline-flex h-10 w-full items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-60"
            customerId={customer.id}
            label={t(spanishXby, "Download", "Descargar")}
            siteId={site.id}
          />
        </div>
      </div>
    );
  }
  const showUploadStep = activePanel === "upload";
  const showCreateStep = activePanel === "create";
  const showVideoStep = activePanel === "video";
  const showReviewStep = activePanel === "overview";
  function scrollToWorkspaceAnchor(anchor: WorkspaceAnchor) {
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", `#${anchor}`);
    window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function choosePanel(panel: CustomerWorkspacePanel, anchor: WorkspaceAnchor) {
    setActivePanel(panel);
    if (panel === "video") setActiveStudioSection("video");
    if (panel === "create" && anchor === "source-photos") setActiveStudioSection("model");
    scrollToWorkspaceAnchor(anchor);
  }

  function chooseResourceTab(tab: WorkspaceResourceTab) {
    setActivePanel("overview");
    setResourceTab(tab);
    scrollToWorkspaceAnchor(`resources-${tab}`);
  }

  function chooseVideoWorkspaceTab(tab: VideoWorkspaceTab) {
    setVideoWorkspaceTab(tab);
    setActivePanel("video");
    setActiveStudioSection("video");
    if (typeof window === "undefined") return;
    const anchor = tab === "generate" ? "video-step-generate" : "video-workspace-videos";
    window.history.replaceState(null, "", `#${anchor}`);
    window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function videoRetryRequestErrorMessage(error: string | undefined, status: number) {
    if (status === 401 || error === "customer_login_required") return t(spanishXby, "Please sign in again before retrying this video.", "Vuelve a iniciar sesion antes de reintentar este video.");
    if (status === 403 || error?.includes("csrf")) return t(spanishXby, "Your secure session expired. Refresh the page, then retry this video.", "Tu sesion segura expiro. Actualiza la pagina y reintenta este video.");
    if (error === "insufficient_credits") return t(spanishXby, "Not enough credits to retry this video.", "No hay creditos suficientes para reintentar este video.");
    if (error === "generation_job_already_running") return t(spanishXby, "Another request is already running. Wait for it to finish before retrying.", "Ya hay otra solicitud en ejecucion. Espera a que termine antes de reintentar.");
    if (error === "only_failed_or_refunded_jobs_can_be_rerun") return t(spanishXby, "Only failed video requests can be retried.", "Solo se pueden reintentar solicitudes de video fallidas.");
    if (error === "only_video_jobs_can_be_retried") return t(spanishXby, "Only video requests can be retried here.", "Solo se pueden reintentar solicitudes de video aqui.");
    if (status === 409) return t(spanishXby, "This video cannot be retried right now. Refresh the workspace and check its latest status.", "Este video no se puede reintentar ahora. Actualiza el espacio y revisa su estado mas reciente.");
    return t(spanishXby, "We could not start a retry for this video. Refresh the workspace and try again.", "No pudimos iniciar el reintento de este video. Actualiza el espacio e intentalo de nuevo.");
  }

  async function retryVideoJob(job: RuntimeJob) {
    if (retryingVideoJobId) return;
    const slots = workspaceJobOutputSlots(job, outputAssetsByJobId.get(job.id) ?? []);
    const providerFailure = workspaceJobProviderFailure(job, slots);
    if (!canDirectRetryVideoJob(job, providerFailure)) {
      setRuntimeRefreshMessage(t(spanishXby, "This video needs adjusted inputs before retrying. Use Edit and retry to review the setup first.", "Este video necesita ajustar entradas antes de reintentar. Usa Editar y reintentar para revisar la configuracion primero."));
      return;
    }
    const idempotencyKey = newVideoRetryIdempotencyKey(job.id);
    setRetryingVideoJobId(job.id);
    setVideoSubmissionPending(true);
    setRetryVideoDraft(null);
    setFocusedJobId(job.id);
    setPendingCreatedVideoJobId(`video-retry:${job.id}:${Date.now()}`);
    setRuntimeRefreshMessage("");
    setWorkspaceNotice(t(spanishXby, "Retrying this failed video request. A new request will appear here as soon as it is accepted.", "Reintentando esta solicitud de video fallida. Una nueva solicitud aparecera aqui en cuanto se acepte."));
    chooseVideoWorkspaceTab("videos");
    try {
      const response = await fetch(`/api/sites/${site.id}/ai/jobs/${job.id}/retry`, {
        method: "POST",
        headers: customerJsonHeaders(site.id, { "Idempotency-Key": idempotencyKey }),
        body: JSON.stringify({ customerId: customer.id, idempotencyKey })
      });
      const result = (await response.json().catch(() => ({}))) as {
        job?: { id: string };
        customerBalance?: PublicCustomer["balance"];
        error?: string;
        reused?: boolean;
      };
      if (!response.ok || !result.job) {
        const message = videoRetryRequestErrorMessage(result.error, response.status);
        setVideoSubmissionPending(false);
        setPendingCreatedVideoJobId(null);
        setWorkspaceNotice(t(spanishXby, `The video retry could not be created. ${message}`, `No se pudo crear el reintento de video. ${message}`));
        return;
      }
      showVideoJobStatus(result.job.id, { customerBalance: result.customerBalance });
    } catch {
      setVideoSubmissionPending(false);
      setPendingCreatedVideoJobId(null);
      setWorkspaceNotice(t(spanishXby, "The network failed while starting this retry. Check the connection and try again.", "La red fallo al iniciar este reintento. Revisa la conexion e intentalo de nuevo."));
    } finally {
      setRetryingVideoJobId(null);
    }
  }

  function editAndRetryVideoJob(job: RuntimeJob) {
    const draft = videoRetryDraftFromJob(job);
    if (!draft) {
      setRuntimeRefreshMessage(t(spanishXby, "This failed video request cannot be restored because its frame selection is missing.", "No se puede restaurar esta solicitud porque falta su seleccion de fotogramas."));
      chooseVideoWorkspaceTab("generate");
      return;
    }
    const availableFrameIds = new Set(
      readyVideoFrameAssets
        .filter(videoFrameAssetReadyForGeneration)
        .map((asset) => asset.id)
    );
    const restoredFrameCount = draft.frameAssetIds.filter((assetId) => availableFrameIds.has(assetId)).length;
    const missingFrameCount = Math.max(0, draft.frameAssetIds.length - restoredFrameCount);
    setRetryVideoDraft({ ...draft, key: `${job.id}:${Date.now()}` });
    setFocusedJobId(job.id);
    setWorkspaceNotice(t(
      spanishXby,
      "Previous failed video request restored. Review the form, then submit it again when ready.",
      "Solicitud de video fallida restaurada. Revisa el formulario y vuelve a enviarlo cuando este listo."
    ));
    setVideoFrameMessage(missingFrameCount > 0
      ? t(
          spanishXby,
          `Restored ${restoredFrameCount} of ${draft.frameAssetIds.length} frame images. Upload or select replacements for the missing frames before generating.`,
          `Se restauraron ${restoredFrameCount} de ${draft.frameAssetIds.length} fotogramas. Sube o elige reemplazos antes de generar.`
        )
      : t(
          spanishXby,
          `Restored ${restoredFrameCount} video frame image${restoredFrameCount === 1 ? "" : "s"} in the previous order.`,
          `Se restauraron ${restoredFrameCount} fotograma${restoredFrameCount === 1 ? "" : "s"} en el orden anterior.`
        ));
    chooseVideoWorkspaceTab("generate");
  }

  function imageRetryRequestErrorMessage(error: string | undefined, status: number) {
    if (status === 401 || error === "customer_login_required") return t(spanishXby, "Please sign in again before retrying this image request.", "Vuelve a iniciar sesion antes de reintentar esta solicitud de imagen.");
    if (status === 403 || error?.includes("csrf")) return t(spanishXby, "Your secure session expired. Refresh the page, then retry this image request.", "Tu sesion segura expiro. Actualiza la pagina y reintenta esta solicitud.");
    if (error === "insufficient_credits") return t(spanishXby, "Not enough credits to retry this image request.", "No hay creditos suficientes para reintentar esta solicitud de imagen.");
    if (error === "couple_source_groups_required") return t(spanishXby, "Couple mode needs one saved photo in both Your Samples and Partner Samples. Use Edit and retry to choose both groups.", "El modo pareja necesita una foto guardada en Tus muestras y Muestras de la pareja. Usa Editar y reintentar para elegir ambos grupos.");
    if (error === "asset_not_found_for_customer" || error === "not_enough_source_assets") return t(spanishXby, "One or more saved source photos are no longer available. Use Edit and retry to choose replacements.", "Una o mas fotos fuente guardadas ya no estan disponibles. Usa Editar y reintentar para elegir reemplazos.");
    if (error === "missing_required_prompt_input") return t(spanishXby, "This request is missing a required field. Use Edit and retry to review the setup.", "A esta solicitud le falta un campo obligatorio. Usa Editar y reintentar para revisar la configuracion.");
    if (error === "only_failed_or_refunded_jobs_can_be_rerun") return t(spanishXby, "Only failed image requests can be retried.", "Solo se pueden reintentar solicitudes de imagen fallidas.");
    if (error === "generation_job_already_running") return t(spanishXby, "Another request is already running. Wait for it to finish before retrying.", "Ya hay otra solicitud en ejecucion. Espera a que termine antes de reintentar.");
    if (status === 409) return t(spanishXby, "This image request cannot be retried right now. Refresh the workspace and check its latest status.", "Esta solicitud de imagen no se puede reintentar ahora. Actualiza el espacio y revisa su estado mas reciente.");
    return t(spanishXby, "We could not start a retry for this image request. Refresh the workspace and try again.", "No pudimos iniciar el reintento de esta solicitud de imagen. Actualiza el espacio e intentalo de nuevo.");
  }

  async function retryImageJob(job: RuntimeJob) {
    if (retryingImageJobId) return;
    if (job.status !== "failed" && job.status !== "refunded") {
      setRuntimeRefreshMessage(t(spanishXby, "Wait until this request reaches a final failed state before retrying.", "Espera a que esta solicitud llegue a un estado fallido final antes de reintentar."));
      return;
    }
    const idempotencyKey = newImageRetryIdempotencyKey(job.id);
    setRetryingImageJobId(job.id);
    setRetryImageDraft(null);
    setFocusedJobId(job.id);
    setRuntimeFetchEnabled(true);
    setRuntimeRefreshMessage("");
    setWorkspaceNotice(t(spanishXby, "Retrying this failed image request. A new request will appear here as soon as it is accepted.", "Reintentando esta solicitud de imagen fallida. Una nueva solicitud aparecera aqui en cuanto se acepte."));
    chooseResourceTab("all");
    try {
      const response = await fetch(`/api/sites/${site.id}/ai/jobs/${job.id}/retry`, {
        method: "POST",
        headers: customerJsonHeaders(site.id, { "Idempotency-Key": idempotencyKey }),
        body: JSON.stringify({ customerId: customer.id, idempotencyKey })
      });
      const result = (await response.json().catch(() => ({}))) as {
        job?: { id: string };
        customerBalance?: PublicCustomer["balance"];
        error?: string;
        reused?: boolean;
      };
      if (!response.ok || !result.job) {
        const message = imageRetryRequestErrorMessage(result.error, response.status);
        setWorkspaceNotice(t(spanishXby, `The image retry could not be created. ${message}`, `No se pudo crear el reintento de imagen. ${message}`));
        return;
      }
      showJobStatus(result.job.id, "all", { customerBalance: result.customerBalance });
    } catch {
      setWorkspaceNotice(t(spanishXby, "The network failed while starting this image retry. Check the connection and try again.", "La red fallo al iniciar este reintento de imagen. Revisa la conexion e intentalo de nuevo."));
    } finally {
      setRetryingImageJobId(null);
    }
  }

  function editAndRetryImageJob(job: RuntimeJob) {
    if (job.status !== "failed" && job.status !== "refunded") {
      setRuntimeRefreshMessage(t(spanishXby, "Wait until this request reaches a final failed state before editing a retry.", "Espera a que esta solicitud llegue a un estado fallido final antes de editar un reintento."));
      return;
    }
    const draft = imageRetryDraftFromJob(job);
    if (!draft) {
      setRuntimeRefreshMessage(t(spanishXby, "This failed image request cannot be restored. Pick a package and start again.", "No se puede restaurar esta solicitud de imagen. Elige un paquete y vuelve a empezar."));
      setPreferredToolId(undefined);
      setPreferredCreateMode("theme");
      setPreferredCreateModeRequest((current) => current + 1);
      choosePanel("create", "step-create");
      return;
    }
    const availableAssetIds = new Set(readySourceAssets.map((asset) => asset.id));
    const originalAssetIds = Array.from(new Set([...(draft.primaryAssetIds ?? []), ...(draft.partnerAssetIds ?? [])]));
    const restoredPrimaryIds = (draft.primaryAssetIds ?? [])
      .filter((assetId) => availableAssetIds.has(assetId))
      .slice(0, 15);
    const restoredPrimarySet = new Set(restoredPrimaryIds);
    const restoredPartnerIds = (draft.partnerAssetIds ?? [])
      .filter((assetId) => availableAssetIds.has(assetId) && !restoredPrimarySet.has(assetId))
      .slice(0, 15);
    const restoredAssetCount = new Set([...restoredPrimaryIds, ...restoredPartnerIds]).size;
    const missingAssetCount = Math.max(0, originalAssetIds.length - restoredAssetCount);
    const draftKey = `${job.id}:${Date.now()}`;

    setRetryImageDraft({ ...draft, key: draftKey, primaryAssetIds: restoredPrimaryIds, partnerAssetIds: restoredPartnerIds });
    setFocusedJobId(job.id);
    setPrimarySampleIds(restoredPrimaryIds);
    setPartnerSampleIds(restoredPartnerIds);
    const draftTrainingMode = draft.formValues?.trainingMode;
    if (draftTrainingMode === "single" || draftTrainingMode === "couple") {
      setStudioTrainingMode(draftTrainingMode);
    } else if (restoredPartnerIds.length) {
      setStudioTrainingMode("couple");
    }
    setPreferredCreateMode(draft.mode);
    setPreferredToolId(draft.mode === "tool" ? draft.toolId : undefined);
    setPreferredCreateModeRequest((current) => current + 1);
    setAppliedOperationContext({});
    setWorkspaceNotice(t(
      spanishXby,
      "Previous failed image request restored. Review the form, adjust anything needed, then submit it again when ready.",
      "Solicitud de imagen fallida restaurada. Revisa el formulario, ajusta lo necesario y vuelve a enviarla cuando este lista."
    ));
    setSampleUploadMessage(missingAssetCount > 0
      ? t(
          spanishXby,
          `Restored ${restoredAssetCount} of ${originalAssetIds.length} source photo${originalAssetIds.length === 1 ? "" : "s"}. Upload or select replacements before generating.`,
          `Se restauraron ${restoredAssetCount} de ${originalAssetIds.length} foto${originalAssetIds.length === 1 ? "" : "s"} fuente. Sube o elige reemplazos antes de generar.`
        )
      : t(
          spanishXby,
          `Restored ${restoredAssetCount} source photo${restoredAssetCount === 1 ? "" : "s"} from the failed request.`,
          `Se restauraron ${restoredAssetCount} foto${restoredAssetCount === 1 ? "" : "s"} fuente de la solicitud fallida.`
        ));
    choosePanel("create", "step-create");
  }

  function focusVideoFrameManager() {
    setActivePanel("video");
    setActiveStudioSection("video");
    scrollToWorkspaceAnchor("step-video");
  }

  function chooseStudioConsoleSection(section: typeof studioConsoleSections[number]) {
    setActiveStudioSection(section.id);
    if (section.id === "video") {
      chooseVideoWorkspaceTab("generate");
      return;
    }
    if (section.id === "generate") {
      setPreferredToolId(undefined);
      setPreferredCreateMode("theme");
      setPreferredCreateModeRequest((current) => current + 1);
      setAppliedOperationContext({ action: studioConsoleLabel(section.id, spanishXby), source: studioConsoleLabel(section.id, spanishXby) });
      choosePanel("create", "step-create");
      return;
    }
    if (section.id === "try-on" || section.id === "background") {
      setPreferredToolId(section.id === "background" ? "background-changer" : "virtual-try-on");
      setPreferredCreateMode("tool");
      setPreferredCreateModeRequest((current) => current + 1);
      setAppliedOperationContext({ action: studioConsoleLabel(section.id, spanishXby), source: studioConsoleLabel(section.id, spanishXby) });
      choosePanel("create", "step-create");
      return;
    }
    if (section.id === "model") {
      setPreferredToolId(undefined);
      setPreferredCreateMode("theme");
      setPreferredCreateModeRequest((current) => current + 1);
      setAppliedOperationContext({ action: studioConsoleLabel(section.id, spanishXby), source: studioConsoleLabel(section.id, spanishXby) });
      choosePanel("create", "source-photos");
      return;
    }
    choosePanel(section.panel, section.anchor);
  }

  function handleStudioConsoleSectionClick(section: typeof studioConsoleSections[number], expanded: boolean) {
    if (expanded) {
      setActiveStudioSection(null);
      return;
    }
    chooseStudioConsoleSection(section);
  }

  function requestWorkspaceRefresh() {
    queueWorkspaceRuntimeRefresh("manual");
  }

  async function toggleAssetFavorite(asset: ThemeRuntimeAsset) {
    const nextFavorite = !asset.isFavorite;
    const nextFavoriteAt = nextFavorite ? new Date().toISOString() : undefined;
    setRuntimeAssets((current) => current.map((item) => item.id === asset.id ? { ...item, isFavorite: nextFavorite, favoriteAt: nextFavoriteAt } : item));
    const response = await fetch(`/api/sites/${site.id}/customers/${customer.id}/assets/${asset.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeader(`customer_csrf_${site.id}`)
      },
      body: JSON.stringify({ isFavorite: nextFavorite })
    });
    const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
    if (!response.ok || !result.asset) {
      setRuntimeAssets((current) => current.map((item) => item.id === asset.id ? asset : item));
      setRuntimeRefreshMessage(t(spanishXby, "Favorite update failed. Try again.", "No se pudo actualizar el favorito. Intentalo de nuevo."));
      return;
    }
    setRuntimeAssets((current) => current.map((item) => item.id === result.asset!.id ? result.asset! : item));
    setSelectedPreviewAssetId((current) => current === result.asset!.id ? result.asset!.id : current);
  }

  function toggleVideoFrame(asset: VideoFrameAsset) {
    if (!videoFrameAssetSelectable(asset)) return;
    setSelectedVideoFrameIds((current) => {
      if (current.includes(asset.id)) return current.filter((id) => id !== asset.id);
      if (current.length >= maxVideoFrameCount) {
        setVideoFrameMessage(t(spanishXby, `Use up to ${maxVideoFrameCount} frame images for one video.`, `Usa hasta ${maxVideoFrameCount} fotogramas para un video.`));
        return current;
      }
      return [...current, asset.id];
    });
  }

  function moveVideoFrame(assetId: string, direction: -1 | 1) {
    setSelectedVideoFrameIds((current) => {
      const index = current.indexOf(assetId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function dropVideoFrame(targetId: string) {
    if (!draggedVideoFrameId || draggedVideoFrameId === targetId) return;
    setSelectedVideoFrameIds((current) => {
      const sourceIndex = current.indexOf(draggedVideoFrameId);
      const targetIndex = current.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [item] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
    setDraggedVideoFrameId(null);
  }

  function releaseVideoFramePreviewUrl(asset: Pick<VideoFrameAsset, "previewUrl">) {
    if (!videoFrameBlobUrlsRef.current.delete(asset.previewUrl)) return;
    URL.revokeObjectURL(asset.previewUrl);
  }

  function replaceVideoFrameAsset(localId: string, nextAsset: ThemeRuntimeAsset) {
    const readyAsset: VideoFrameAsset = { ...nextAsset, subjectRole: "video_frame", role: "input", localStatus: "ready" };
    locallyCreatedVideoFrameIdsRef.current.set(readyAsset.id, Date.now() + LOCALLY_CREATED_VIDEO_FRAME_KEEPALIVE_MS);
    setVideoFrameAssets((current) => {
      let replaced = false;
      const next = current.map((asset) => {
        if (asset.id !== localId) return asset;
        replaced = true;
        releaseVideoFramePreviewUrl(asset);
        return readyAsset;
      });
      return replaced ? next : [readyAsset, ...current.filter((asset) => asset.id !== readyAsset.id)];
    });
    setRuntimeAssets((current) => [
      readyAsset,
      ...current.filter((asset) => asset.id !== localId && asset.id !== readyAsset.id)
    ]);
    setSelectedVideoFrameIds((current) => trimVideoFrameSelection(Array.from(new Set(current.map((assetId) => assetId === localId ? nextAsset.id : assetId))), maxVideoFrameCount));
  }

  async function prepareVideoFramesForGeneration(assetIds: string[]): Promise<string[]> {
    const assetById = new Map(videoFrameAssets.map((asset) => [asset.id, asset]));
    const normalizedIds = [...assetIds];
    let convertedCount = 0;
    for (const [index, assetId] of assetIds.entries()) {
      const asset = assetById.get(assetId);
      if (!asset || isGeminiVideoFrameMimeType(asset.mimeType)) continue;
      const response = await fetch(`/api/sites/${site.id}/customers/${customer.id}/assets`, {
        method: "POST",
        headers: customerJsonHeaders(site.id),
        body: JSON.stringify({
          sourceAssetId: asset.id,
          label: asset.label,
          role: "input",
          subjectRole: "video_frame"
        })
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
      if (!response.ok || !result.asset || !isGeminiVideoFrameMimeType(result.asset.mimeType)) {
        throw new Error(result.error || "video_frame_conversion_failed");
      }
      replaceVideoFrameAsset(asset.id, result.asset);
      normalizedIds[index] = result.asset.id;
      convertedCount += 1;
    }
    if (convertedCount) {
      setVideoFrameMessage(t(
        spanishXby,
        `${convertedCount} selected frame${convertedCount === 1 ? "" : "s"} converted to JPG and ready for video.`,
        `${convertedCount} fotograma${convertedCount === 1 ? "" : "s"} seleccionado${convertedCount === 1 ? "" : "s"} convertido${convertedCount === 1 ? "" : "s"} a JPG y listo${convertedCount === 1 ? "" : "s"} para video.`
      ));
      invalidateCustomerAssets(site.id, customer.id);
      window.dispatchEvent(new CustomEvent("customer-assets:updated"));
    }
    return normalizedIds;
  }

  async function uploadVideoFrameFiles(files: FileList | null) {
    const selectedFiles = Array.from(files ?? []);
    const imageFiles = selectedFiles.filter(canPrepareCustomerVideoFrameUploadFile);
    const unsupportedCount = selectedFiles.length - imageFiles.length;
    if (!imageFiles.length) {
      setVideoFrameMessage(selectedFiles.length ? t(spanishXby, "Choose a browser-readable image file for video. GIF and SVG files cannot be converted to video-ready JPG or PNG.", "Elige una imagen legible por el navegador para video. Los archivos GIF y SVG no se pueden convertir a JPG o PNG listo para video.") : t(spanishXby, "Choose one or more image files before uploading.", "Elige uno o mas archivos de imagen antes de subir."));
      return;
    }
    const uploadFiles = imageFiles.slice(0, maxVideoFrameCount);
    const skippedCount = imageFiles.length - uploadFiles.length;
    const now = Date.now();
    const optimisticAssets: VideoFrameAsset[] = uploadFiles.map((file, index) => ({
      id: `local:video:${now}:${index}`,
      label: uploadLabelFor(file, index, t(spanishXby, "video frame", "fotograma")),
      previewUrl: URL.createObjectURL(file),
      mimeType: file.type.toLowerCase().split(";")[0] === "image/png" ? "image/png" : "image/jpeg",
      role: "input",
      subjectRole: "video_frame",
      reviewStatus: "approved",
      createdAt: new Date(now + index).toISOString(),
      localStatus: "uploading"
    }));
    optimisticAssets.forEach((asset) => videoFrameBlobUrlsRef.current.add(asset.previewUrl));
    setVideoFrameAssets((current) => [
      ...optimisticAssets,
      ...current.filter((asset) => !optimisticAssets.some((created) => created.id === asset.id))
    ]);
    setRuntimeAssets((current) => [
      ...optimisticAssets,
      ...current.filter((asset) => !optimisticAssets.some((created) => created.id === asset.id))
    ]);
    setSelectedVideoFrameIds((current) => trimVideoFrameSelection(Array.from(new Set([...current, ...optimisticAssets.map((asset) => asset.id)])), maxVideoFrameCount));
    setUploadingVideoFrames(true);
    setVideoFrameMessage(spanishXby ? `Subiendo ${uploadFiles.length} fotograma${uploadFiles.length === 1 ? "" : "s"}...` : `Uploading ${uploadFiles.length} frame image${uploadFiles.length === 1 ? "" : "s"}...`);
    const createdAssets: ThemeRuntimeAsset[] = [];
    let convertedCount = 0;
    for (const [index, file] of uploadFiles.entries()) {
      const optimisticAsset = optimisticAssets[index];
      let preparedUpload;
      try {
        preparedUpload = await prepareCustomerVideoFrameUploadFile(file);
      } catch {
        setVideoFrameAssets((current) => current.map((asset) => asset.id === optimisticAsset.id ? { ...asset, localStatus: "failed" } : asset));
        setRuntimeAssets((current) => current.map((asset) => asset.id === optimisticAsset.id ? { ...asset, localStatus: "failed" } : asset));
        setSelectedVideoFrameIds((current) => current.filter((assetId) => assetId !== optimisticAsset.id));
        setUploadingVideoFrames(false);
        setVideoFrameMessage(t(spanishXby, `${file.name} could not be converted for video. Try exporting it as JPG or PNG, then upload again.`, `${file.name} no se pudo convertir para video. Exportala como JPG o PNG y vuelve a subirla.`));
        return;
      }
      if (preparedUpload.converted) convertedCount += 1;
      const formData = new FormData();
      formData.append("file", preparedUpload.file);
      formData.append("label", uploadLabelFor(file, index, t(spanishXby, "video frame", "fotograma")));
      formData.append("role", "input");
      formData.append("subjectRole", "video_frame");
      const response = await fetch(`/api/sites/${site.id}/customers/${customer.id}/assets`, {
        method: "POST",
        headers: csrfHeader(`customer_csrf_${site.id}`),
        body: formData
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
      if (!response.ok || !result.asset) {
        setVideoFrameAssets((current) => current.map((asset) => asset.id === optimisticAsset.id ? { ...asset, localStatus: "failed" } : asset));
        setRuntimeAssets((current) => current.map((asset) => asset.id === optimisticAsset.id ? { ...asset, localStatus: "failed" } : asset));
        setSelectedVideoFrameIds((current) => current.filter((assetId) => assetId !== optimisticAsset.id));
        setUploadingVideoFrames(false);
        setVideoFrameMessage(customerImageUploadErrorMessage(file.name, result.error, spanishXby));
        return;
      }
      deletedVideoFrameIdsRef.current.delete(result.asset.id);
      createdAssets.push({ ...result.asset, subjectRole: "video_frame", role: "input" });
      replaceVideoFrameAsset(optimisticAsset.id, result.asset);
    }
    const limitNotice = skippedCount > 0
      ? t(spanishXby, ` Only the first ${maxVideoFrameCount} images were uploaded.`, ` Solo se subieron las primeras ${maxVideoFrameCount} imagenes.`)
      : "";
    const unsupportedNotice = unsupportedCount > 0
      ? t(spanishXby, ` ${unsupportedCount} unsupported file${unsupportedCount === 1 ? "" : "s"} skipped. GIF and SVG files cannot be converted to video-ready JPG or PNG.`, ` ${unsupportedCount} archivo${unsupportedCount === 1 ? "" : "s"} no compatible${unsupportedCount === 1 ? "" : "s"} omitido${unsupportedCount === 1 ? "" : "s"}. Los archivos GIF y SVG no se pueden convertir a JPG o PNG listo para video.`)
      : "";
    const convertedNotice = convertedCount > 0
      ? t(spanishXby, ` ${convertedCount} image${convertedCount === 1 ? "" : "s"} converted to video-ready JPG.`, ` ${convertedCount} imagen${convertedCount === 1 ? "" : "es"} convertida${convertedCount === 1 ? "" : "s"} a JPG listo para video.`)
      : "";
    setVideoFrameMessage(spanishXby
      ? `${createdAssets.length} fotograma${createdAssets.length === 1 ? "" : "s"} subido${createdAssets.length === 1 ? "" : "s"} y seleccionado${createdAssets.length === 1 ? "" : "s"}.${limitNotice}${convertedNotice}${unsupportedNotice}`
      : `${createdAssets.length} frame image${createdAssets.length === 1 ? "" : "s"} uploaded and selected.${limitNotice}${convertedNotice}${unsupportedNotice}`);
    setUploadingVideoFrames(false);
    invalidateCustomerAssets(site.id, customer.id);
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  async function deleteVideoFrame(asset: VideoFrameAsset) {
    if (asset.localStatus === "uploading") return;
    const confirmed = window.confirm(t(spanishXby, `Delete "${asset.label}" from video frame images?`, `Eliminar "${asset.label}" de los fotogramas de video?`));
    if (!confirmed) return;
    releaseVideoFramePreviewUrl(asset);
    deletedVideoFrameIdsRef.current.add(asset.id);
    locallyCreatedVideoFrameIdsRef.current.delete(asset.id);
    setSelectedVideoFrameIds((current) => current.filter((id) => id !== asset.id));
    setVideoFrameAssets((current) => current.filter((item) => item.id !== asset.id));
    setRuntimeAssets((current) => current.filter((item) => item.id !== asset.id));
    if (asset.id.startsWith("local:")) {
      setVideoFrameMessage(t(spanishXby, "Frame image removed.", "Fotograma eliminado."));
      return;
    }
    const response = await fetch(`/api/sites/${site.id}/customers/${customer.id}/assets/${asset.id}`, {
      method: "DELETE",
      headers: csrfHeader(`customer_csrf_${site.id}`)
    });
    if (!response.ok) {
      setVideoFrameMessage(t(spanishXby, "We could not delete that frame image. Refresh and try again.", "No pudimos eliminar ese fotograma. Actualiza e intentalo de nuevo."));
      setRuntimeRefreshKey((current) => current + 1);
      return;
    }
    setVideoFrameMessage(t(spanishXby, "Frame image deleted.", "Fotograma eliminado."));
    invalidateCustomerAssets(site.id, customer.id);
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  async function deleteSelectedVideoFrames() {
    const assetsToDelete = selectedVideoFrames.filter((asset) => asset.localStatus !== "uploading" && isVideoFrameCandidateAsset(asset));
    if (!assetsToDelete.length) return;
    const confirmed = window.confirm(t(
      spanishXby,
      `Delete ${assetsToDelete.length} selected video frame image${assetsToDelete.length === 1 ? "" : "s"}?`,
      `Eliminar ${assetsToDelete.length} fotograma${assetsToDelete.length === 1 ? "" : "s"} de video seleccionado${assetsToDelete.length === 1 ? "" : "s"}?`
    ));
    if (!confirmed) return;
    const deleteIds = assetsToDelete.map((asset) => asset.id);
    assetsToDelete.forEach((asset) => releaseVideoFramePreviewUrl(asset));
    deleteIds.forEach((assetId) => {
      deletedVideoFrameIdsRef.current.add(assetId);
      locallyCreatedVideoFrameIdsRef.current.delete(assetId);
    });
    setSelectedVideoFrameIds((current) => current.filter((id) => !deleteIds.includes(id)));
    setVideoFrameAssets((current) => current.filter((asset) => !deleteIds.includes(asset.id)));
    setRuntimeAssets((current) => current.filter((asset) => !deleteIds.includes(asset.id)));
    const persistedIds = deleteIds.filter((assetId) => !assetId.startsWith("local:"));
    if (!persistedIds.length) {
      setVideoFrameMessage(t(spanishXby, "Selected frame images deleted.", "Fotogramas seleccionados eliminados."));
      return;
    }
    const response = await fetch(`/api/sites/${site.id}/customers/${customer.id}/assets`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...csrfHeader(`customer_csrf_${site.id}`)
      },
      body: JSON.stringify({ assetIds: persistedIds })
    });
    if (!response.ok) {
      setVideoFrameMessage(t(spanishXby, "We could not delete every selected frame image. Refresh and try again.", "No pudimos eliminar todos los fotogramas seleccionados. Actualiza e intentalo de nuevo."));
      setRuntimeRefreshKey((current) => current + 1);
      return;
    }
    setVideoFrameMessage(t(spanishXby, "Selected frame images deleted.", "Fotogramas seleccionados eliminados."));
    invalidateCustomerAssets(site.id, customer.id);
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  function showJobStatus(jobId: string, nextResourceTab: WorkspaceResourceTab = "all", feedback?: CreatedWorkspaceJobFeedback) {
    applyCreatedJobFeedback(feedback);
    setRetryImageDraft(null);
    setFocusedJobId(jobId);
    setRuntimeFetchEnabled(true);
    setRuntimeRefreshKey((current) => current + 1);
    setWorkspaceNotice(t(spanishXby, `Request ${jobId} was created. Your workspace is refreshing so you can follow the latest status here.`, `Solicitud ${jobId} creada. Tu espacio se esta actualizando para seguir el estado aqui.`));
    setActivePanel("overview");
    setResourceTab(nextResourceTab);
    window.setTimeout(() => {
      document.getElementById(`resources-${nextResourceTab}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function showVideoJobSubmitting() {
    setVideoSubmissionPending(true);
    setVideoCreationFailureMessage("");
    setVideoCreationFailureAtMs(null);
    setRetryVideoDraft(null);
    setFocusedJobId(null);
    setPendingCreatedVideoJobId(`video-submission:${Date.now()}`);
    setRuntimeRefreshMessage("");
    setWorkspaceNotice(t(
      spanishXby,
      "Your video request is being created. This workspace will show its status as soon as the request is accepted.",
      "Tu solicitud de video se esta creando. Este espacio mostrara su estado en cuanto se acepte la solicitud."
    ));
    chooseVideoWorkspaceTab("videos");
  }

  function showVideoJobCreationFailed(message: string) {
    setVideoSubmissionPending(false);
    setVideoCreationFailureMessage(message);
    setVideoCreationFailureAtMs(Date.now());
    setPendingCreatedVideoJobId(null);
    setFocusedJobId(null);
    setWorkspaceNotice(t(
      spanishXby,
      `The video request could not be created. ${message}`,
      `No se pudo crear la solicitud de video. ${message}`
    ));
  }

  function showVideoJobStatus(jobId: string, feedback?: CreatedWorkspaceJobFeedback) {
    applyCreatedJobFeedback(feedback);
    setVideoCreationFailureMessage("");
    setVideoCreationFailureAtMs(null);
    setRetryVideoDraft(null);
    setFocusedJobId(jobId);
    setPendingCreatedVideoJobId(jobId);
    setVideoSubmissionPending(false);
    queueWorkspaceRuntimeRefresh("create");
    setWorkspaceNotice(t(spanishXby, `Video request ${jobId} was created. Your video workspace is refreshing so you can follow the latest status here.`, `Solicitud de video ${jobId} creada. Tu espacio de video se esta actualizando para seguir el estado aqui.`));
    chooseVideoWorkspaceTab("videos");
  }

  function showCurrentRequestReview() {
    setActivePanel("create");
    if (typeof window === "undefined") return;
    window.history.replaceState(null, "", "#review-current-request");
    window.setTimeout(() => {
      document.getElementById("review-current-request")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function openCreateUploadPicker(target: "primary" | "partner" = "primary") {
    setActivePanel("create");
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("customer-workspace:open-source-upload", { detail: { target } }));
      scrollToWorkspaceAnchor("source-photos");
    }, 120);
  }

  function openSidebarSamplePicker(target: SampleTarget) {
    pendingSampleTargetRef.current = target;
    sampleUploadInputRef.current?.click();
  }

  function mergeSamples(nextAssets: SampleAsset[]) {
    setSampleAssets((current) => {
      const byId = new Map(current.map((asset) => [asset.id, asset]));
      nextAssets.forEach((asset) => byId.set(asset.id, asset));
      return Array.from(byId.values()).sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    });
  }

  function sampleTargetFor(asset: SampleAsset): SampleTarget {
    if (asset.localTarget === "partner" || asset.subjectRole === "partner") return "partner";
    return "primary";
  }

  function groupSamplesFor(target: SampleTarget) {
    if (studioTrainingMode !== "couple") return sourceAssets;
    return sourceAssets.filter((asset) => {
      if (primarySampleIds.includes(asset.id)) return target === "primary";
      if (partnerSampleIds.includes(asset.id)) return target === "partner";
      if (!asset.subjectRole && !asset.localTarget) return target === "primary";
      return sampleTargetFor(asset) === target;
    });
  }

  function toggleSampleSelection(target: SampleTarget, asset: SampleAsset) {
    if (asset.localStatus === "uploading" || asset.localStatus === "failed") return;
    const updateIds = (current: string[]) => {
      if (current.includes(asset.id)) return current.filter((id) => id !== asset.id);
      if (current.length >= 15) {
        setSampleUploadMessage(t(spanishXby, "Use up to 15 selected samples per request.", "Usa hasta 15 muestras seleccionadas por solicitud."));
        return current;
      }
      return [asset.id, ...current];
    };
    if (target === "partner") {
      setPrimarySampleIds((current) => current.filter((id) => id !== asset.id));
      setPartnerSampleIds(updateIds);
    } else {
      setPartnerSampleIds((current) => current.filter((id) => id !== asset.id));
      setPrimarySampleIds(updateIds);
    }
  }

  function requestSampleDelete(assets: SampleAsset[], label: string) {
    const deletableAssets = assets.filter((asset) => asset.localStatus !== "uploading");
    if (!deletableAssets.length) return;
    setSampleDeleteConfirm({ assets: deletableAssets, label });
  }

  function removeSampleId(assetId: string) {
    setPrimarySampleIds((current) => current.filter((id) => id !== assetId));
    setPartnerSampleIds((current) => current.filter((id) => id !== assetId));
    if (previewSampleId === assetId) setPreviewSampleId(null);
  }

  function replaceSampleId(oldId: string, nextAsset: ThemeRuntimeAsset, target: SampleTarget) {
    setSampleAssets((current) => current.map((asset) => asset.id === oldId ? { ...nextAsset, localStatus: "ready", localTarget: target } : asset));
    const replaceIds = (ids: string[]) => ids.map((id) => id === oldId ? nextAsset.id : id);
    if (target === "partner") {
      setPartnerSampleIds((current) => Array.from(new Set(replaceIds(current))).slice(0, 15));
    } else {
      setPrimarySampleIds((current) => Array.from(new Set(replaceIds(current))).slice(0, 15));
    }
    if (previewSampleId === oldId) setPreviewSampleId(nextAsset.id);
  }

  async function syncCurrentSamples(keepAssetIds: string[]) {
    const response = await fetch(`/api/sites/${site.id}/customers/${customer.id}/assets`, {
      method: "PATCH",
      headers: {
        ...csrfHeader(`customer_csrf_${site.id}`),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: "keep_current_samples", keepAssetIds })
    });
    if (!response.ok) return;
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  async function deleteSamples(assets: SampleAsset[]) {
    const remoteIds = assets
      .filter((asset) => !asset.id.startsWith("local:") && asset.localStatus !== "uploading")
      .map((asset) => asset.id);
    const localIds = assets.filter((asset) => asset.id.startsWith("local:")).map((asset) => asset.id);
    if (!remoteIds.length && !localIds.length) return;
    remoteIds.forEach((assetId) => removeSampleId(assetId));
    localIds.forEach((assetId) => removeSampleId(assetId));
    setSampleAssets((current) => current.filter((item) => !remoteIds.includes(item.id) && !localIds.includes(item.id)));
    if (!remoteIds.length) return;
    setDeletingSampleId(remoteIds[0]);
    const response = await fetch(`/api/sites/${site.id}/customers/${customer.id}/assets`, {
      method: "DELETE",
      headers: {
        ...csrfHeader(`customer_csrf_${site.id}`),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ assetIds: remoteIds })
    });
    setDeletingSampleId(null);
    if (!response.ok) {
      setSampleUploadMessage(remoteIds.length === 1
        ? t(spanishXby, "We could not delete this sample. Please refresh and try again.", "No pudimos eliminar esta muestra. Actualiza e intentalo de nuevo.")
        : t(spanishXby, "We could not delete every selected sample. Please refresh and try again.", "No pudimos eliminar todas las muestras seleccionadas. Actualiza e intentalo de nuevo."));
      setRuntimeRefreshKey((current) => current + 1);
      return;
    }
    setSampleUploadMessage(remoteIds.length === 1 ? t(spanishXby, "Sample deleted.", "Muestra eliminada.") : spanishXby ? `${remoteIds.length} muestras eliminadas.` : `${remoteIds.length} samples deleted.`);
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  function moveSamplePreview(direction: -1 | 1) {
    if (!previewSamples.length) return;
    const currentIndex = previewSampleIndex >= 0 ? previewSampleIndex : 0;
    const nextIndex = (currentIndex + direction + previewSamples.length) % previewSamples.length;
    setPreviewSampleId(previewSamples[nextIndex].id);
  }

  async function deleteSample(asset: SampleAsset) {
    if (asset.localStatus === "uploading") return;
    requestSampleDelete([asset], asset.label || t(spanishXby, "sample", "muestra"));
  }

  async function uploadSidebarSamples(files: FileList | null) {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setSampleUploadMessage(t(spanishXby, "Choose one or more image files before uploading.", "Elige uno o mas archivos de imagen antes de subir."));
      return;
    }
    const target = pendingSampleTargetRef.current;
    setUploadingSampleTarget(target);
    setSampleUploadMessage(spanishXby ? `Subiendo ${imageFiles.length} muestra${imageFiles.length === 1 ? "" : "s"}...` : `Uploading ${imageFiles.length} sample${imageFiles.length === 1 ? "" : "s"}...`);
    const now = Date.now();
    const optimisticAssets: SampleAsset[] = imageFiles.map((file, index) => ({
      id: `local:${target}:${now}:${index}`,
      label: file.name.replace(/\.[^.]+$/, "") || (spanishXby ? `muestra ${index + 1}` : `sample ${index + 1}`),
      previewUrl: URL.createObjectURL(file),
      mimeType: file.type || "image/jpeg",
      role: "input",
      reviewStatus: "approved",
      createdAt: new Date(now + index).toISOString(),
      localStatus: "uploading",
      localTarget: target
    }));
    optimisticAssets.forEach((asset) => sampleBlobUrlsRef.current.add(asset.previewUrl));
    mergeSamples(optimisticAssets);
    const optimisticIds = optimisticAssets.map((asset) => asset.id);
    if (target === "partner") {
      setPartnerSampleIds((current) => Array.from(new Set([...optimisticIds, ...current])).slice(0, 15));
    } else {
      setPrimarySampleIds((current) => Array.from(new Set([...optimisticIds, ...current])).slice(0, 15));
    }
    const createdAssets: ThemeRuntimeAsset[] = [];
    for (const [index, file] of imageFiles.entries()) {
      const optimisticId = optimisticAssets[index].id;
      const preparedUpload = await prepareCustomerImageUploadFile(file);
      const formData = new FormData();
      formData.append("file", preparedUpload.file);
      formData.append("label", file.name.replace(/\.[^.]+$/, "") || (spanishXby ? `muestra ${index + 1}` : `sample ${index + 1}`));
      formData.append("role", "input");
      formData.append("subjectRole", target);
      const response = await fetch(`/api/sites/${site.id}/customers/${customer.id}/assets`, {
        method: "POST",
        headers: csrfHeader(`customer_csrf_${site.id}`),
        body: formData
      });
      const result = (await response.json().catch(() => ({}))) as { asset?: ThemeRuntimeAsset; error?: string };
      if (!response.ok || !result.asset) {
        setSampleAssets((current) => current.map((asset) => asset.id === optimisticId ? { ...asset, localStatus: "failed" } : asset));
        removeSampleId(optimisticId);
        setUploadingSampleTarget(null);
        setSampleUploadMessage(customerImageUploadErrorMessage(file.name, result.error, spanishXby));
        return;
      }
      createdAssets.push(result.asset);
      replaceSampleId(optimisticId, result.asset, target);
    }
    const createdIds = createdAssets.map((asset) => asset.id);
    const nextPrimaryIds = target === "partner" ? primarySampleIds : Array.from(new Set([...createdIds, ...primarySampleIds])).slice(0, 15);
    const nextPartnerIds = target === "partner" ? Array.from(new Set([...createdIds, ...partnerSampleIds])).slice(0, 15) : partnerSampleIds;
    if (target === "partner") {
      setPartnerSampleIds(nextPartnerIds);
    } else {
      setPrimarySampleIds(nextPrimaryIds);
    }
    const keepIds = Array.from(new Set([...nextPrimaryIds, ...nextPartnerIds])).slice(0, 30);
    void syncCurrentSamples(keepIds);
    const selectedSampleCount = sampleUploadFeedbackCount({
      createdAssetCount: createdAssets.length,
      primarySampleIds: nextPrimaryIds,
      partnerSampleIds: nextPartnerIds
    });
    setSampleUploadMessage(spanishXby ? `${selectedSampleCount} muestra${selectedSampleCount === 1 ? "" : "s"} subida${selectedSampleCount === 1 ? "" : "s"} y seleccionada${selectedSampleCount === 1 ? "" : "s"}.` : `${selectedSampleCount} sample${selectedSampleCount === 1 ? "" : "s"} uploaded and selected.`);
    setUploadingSampleTarget(null);
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  function movePreview(direction: -1 | 1) {
    if (!previewableAssets.length) return;
    const currentIndex = selectedPreviewIndex >= 0 ? selectedPreviewIndex : 0;
    const nextIndex = (currentIndex + direction + previewableAssets.length) % previewableAssets.length;
    setSelectedPreviewAssetId(previewableAssets[nextIndex].id);
  }

  function renderVideoFrameSidebar() {
    return (
      <div className="grid gap-3 pb-5" id="studio-console-video">
        <div className="rounded-[18px] border border-white/12 bg-[#0d1118] p-4 shadow-[0_24px_70px_-52px_rgba(0,0,0,0.95)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#173048] text-[#31d4ff] ring-1 ring-white/6">
                <Film className="h-5 w-5" strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#31d4ff]">
                  {t(spanishXby, "Step 01", "Paso 01")}
                </p>
                <p className="mt-1 text-sm font-semibold text-white">{t(spanishXby, "Video frame images", "Fotogramas de video")}</p>
              </div>
            </div>
            <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/58">
              {spanishXby ? `${selectedVideoFrameIds.length} de ${maxVideoFrameCount}` : `${selectedVideoFrameIds.length} of ${maxVideoFrameCount}`} {t(spanishXby, "selected", "seleccionados")}
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/56">
            {t(spanishXby, `Upload up to ${maxVideoFrameCount} images here. WebP and other browser-readable images are converted to video-ready JPG or PNG before upload. Only video frame uploads appear in this list, and new uploads are selected automatically.`, `Sube hasta ${maxVideoFrameCount} imagenes aqui. WebP y otras imagenes legibles por el navegador se convierten a JPG o PNG listo para video antes de subir. Solo aparecen fotogramas subidos para video y las nuevas subidas se seleccionan automaticamente.`)}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] bg-[#31d4ff] px-3 text-xs font-semibold text-[#041014] transition hover:bg-[#4adfff] disabled:cursor-wait disabled:opacity-55"
              disabled={uploadingVideoFrames}
              onClick={() => videoFrameUploadInputRef.current?.click()}
              type="button"
            >
              <Upload className="h-4 w-4" strokeWidth={1.8} />
              {uploadingVideoFrames ? t(spanishXby, "Uploading", "Subiendo") : t(spanishXby, "Upload", "Subir")}
            </button>
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[12px] border border-white/12 bg-white/[0.05] px-3 text-xs font-semibold text-white/84 transition hover:bg-white/[0.1] hover:text-white"
              onClick={() => chooseVideoWorkspaceTab("generate")}
              type="button"
            >
              {t(spanishXby, "Write prompt", "Escribir prompt")}
              <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
          <input
            accept="image/*,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.tif,.tiff"
            className="sr-only"
            multiple
            onChange={(event) => {
              void uploadVideoFrameFiles(event.target.files);
              event.target.value = "";
            }}
            ref={videoFrameUploadInputRef}
            type="file"
          />

          <div className="mt-4 rounded-[14px] border border-white/10 bg-black/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/52">{t(spanishXby, "Selected order", "Orden seleccionado")}</p>
              <button
                aria-label={t(spanishXby, "Clear selected video frames", "Limpiar fotogramas seleccionados")}
                className="grid h-7 w-7 place-items-center rounded-full border border-white/10 text-white/46 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                disabled={!selectedVideoFrameIds.length}
                onClick={() => setSelectedVideoFrameIds([])}
                type="button"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
              </button>
            </div>
            <div className="mt-3 grid gap-2">
              {selectedVideoFrames.length ? selectedVideoFrames.map((asset, index) => (
                <div
                  className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2 rounded-[11px] border border-white/10 bg-white/[0.035] p-2"
                  draggable
                  key={asset.id}
                  onDragEnd={() => setDraggedVideoFrameId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={() => setDraggedVideoFrameId(asset.id)}
                  onDrop={() => dropVideoFrame(asset.id)}
                >
                  <div className="relative aspect-square overflow-hidden rounded-[8px] bg-white/[0.06]">
                    {renderFrameImagePreview({
                      asset,
                      alt: videoFrameLabel(asset, index),
                      className: "h-full w-full object-cover",
                      compact: true
                    })}
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-[#31d4ff] px-1.5 py-0.5 text-[10px] font-bold text-[#041014]">
                      {index + 1}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-white">{asset.label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-white/42">{t(spanishXby, "Drag or use arrows", "Arrastra o usa flechas")}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <GripVertical className="h-4 w-4 text-white/32" strokeWidth={1.8} />
                    <button aria-label={t(spanishXby, "Move frame up", "Mover fotograma arriba")} className="grid h-8 w-8 place-items-center rounded-[8px] border border-white/10 text-white/64 hover:bg-white/[0.08] hover:text-white" onClick={() => moveVideoFrame(asset.id, -1)} type="button"><ArrowUp className="h-3.5 w-3.5" /></button>
                    <button aria-label={t(spanishXby, "Move frame down", "Mover fotograma abajo")} className="grid h-8 w-8 place-items-center rounded-[8px] border border-white/10 text-white/64 hover:bg-white/[0.08] hover:text-white" onClick={() => moveVideoFrame(asset.id, 1)} type="button"><ArrowDown className="h-3.5 w-3.5" /></button>
                    <button aria-label={t(spanishXby, "Remove frame", "Quitar fotograma")} className="grid h-8 w-8 place-items-center rounded-[8px] border border-white/10 text-white/58 hover:bg-rose-500/18 hover:text-rose-100" onClick={() => setSelectedVideoFrameIds((current) => current.filter((id) => id !== asset.id))} type="button">
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              )) : (
                <button
                  className="grid min-h-[96px] place-items-center rounded-[12px] border border-dashed border-white/18 bg-black/16 px-4 text-center text-xs leading-5 text-white/52 transition hover:border-[#31d4ff]/55 hover:text-white"
                  onClick={() => videoFrameUploadInputRef.current?.click()}
                  type="button"
                >
                  <span className="grid justify-items-center gap-2">
                    <ImagePlus className="h-5 w-5" strokeWidth={1.8} />
                    {t(spanishXby, "Upload frame images or select uploaded frames below.", "Sube fotogramas o selecciona fotogramas subidos abajo.")}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.14em] text-white/52">{t(spanishXby, "Uploaded video frames", "Fotogramas de video subidos")}</p>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  className="rounded-full border border-rose-200/16 px-2 py-1 text-[10px] font-semibold text-rose-100/70 transition hover:bg-rose-400/12 hover:text-rose-50 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={!selectedVideoFrames.length}
                  onClick={() => void deleteSelectedVideoFrames()}
                  type="button"
                >
                  {t(spanishXby, "Delete selected", "Eliminar seleccionados")}
                </button>
                <span className="text-[11px] text-white/38">{readyVideoFrameAssets.length}</span>
              </div>
            </div>
            <div className="grid max-h-[520px] grid-cols-2 gap-2 overflow-y-auto pr-1">
              {readyVideoFrameAssets.map((asset) => {
                const selected = selectedVideoFrameIds.includes(asset.id);
                const selectable = videoFrameAssetSelectable(asset);
                return (
                  <div className={`group/frame relative overflow-hidden rounded-[12px] border bg-black/30 transition ${selected ? "border-[#31d4ff] ring-2 ring-[#31d4ff]/30" : "border-white/10 hover:border-white/28"}`} key={asset.id}>
                    <button
                      aria-pressed={selected}
                      className="block w-full text-left disabled:cursor-not-allowed"
                      disabled={!selectable}
                      onClick={() => toggleVideoFrame(asset)}
                      title={selected ? t(spanishXby, "Selected for video", "Seleccionada para video") : t(spanishXby, "Select for video", "Seleccionar para video")}
                      type="button"
                    >
                      {renderFrameImagePreview({
                        asset,
                        alt: videoFrameLabel(asset),
                        className: `aspect-square w-full object-cover transition group-hover/frame:scale-[1.03] ${selected ? "brightness-105" : "opacity-76"}`
                      })}
                      <span className={`absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border shadow-[0_8px_22px_-14px_rgba(0,0,0,0.8)] ${selected ? "border-[#31d4ff] bg-[#31d4ff] text-[#051016]" : "border-white/45 bg-black/56 text-white"}`}>
                        {selected ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} /> : null}
                      </span>
                      <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/82 to-transparent px-2 pb-2 pt-7">
                        <span className="block truncate text-[11px] font-semibold text-white">{asset.label}</span>
                      </span>
                    </button>
                    <button
                      aria-label={`Delete ${asset.label}`}
                      className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full border border-white/16 bg-black/68 text-white/78 transition hover:border-rose-200/40 hover:bg-rose-500/32 hover:text-rose-50"
                      onClick={() => void deleteVideoFrame(asset)}
                      type="button"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                    </button>
                  </div>
                );
              })}
              {!readyVideoFrameAssets.length ? (
                <button
                  className="col-span-2 grid min-h-[112px] place-items-center rounded-[12px] border border-dashed border-white/18 bg-black/20 px-4 py-5 text-center text-xs leading-5 text-white/52 transition hover:border-[#31d4ff]/60 hover:text-white"
                  onClick={() => videoFrameUploadInputRef.current?.click()}
                  type="button"
                >
                  {t(spanishXby, "Upload video frame images to start. Generated photo results stay out of this list.", "Sube fotogramas de video para comenzar. Los resultados generados no aparecen en esta lista.")}
                </button>
              ) : null}
            </div>
          </div>

          <p className="mt-3 text-xs font-semibold leading-5 text-red-400" role="status">{videoFrameMessage}</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawAnchor = window.location.hash.replace("#", "");
    const anchor = rawAnchor as WorkspaceAnchor | "";
    if (!anchor) return;
    if (anchor === "step-upload") {
      setActivePanel("upload");
    }
    if (anchor === "source-photos") {
      setActivePanel("create");
    }
    if (anchor === "step-create") {
      setActivePanel("create");
    }
    if (anchor === "step-video") {
      setActivePanel("video");
      setActiveStudioSection("video");
    }
    if (rawAnchor === "video-step-themes" || rawAnchor === "video-step-generate") {
      setActivePanel("video");
      setActiveStudioSection("video");
      setVideoWorkspaceTab("generate");
      if (rawAnchor === "video-step-themes") window.history.replaceState(null, "", "#video-step-generate");
    }
    if (anchor === "video-workspace-videos" || anchor === "resources-videos") {
      setActivePanel("video");
      setActiveStudioSection("video");
      setVideoWorkspaceTab("videos");
    }
    if (anchor === "review-request") {
      setActivePanel("overview");
    }
    if (anchor.startsWith("resources-")) {
      const tab = anchor.replace("resources-", "") as WorkspaceResourceTab;
      if (tabItems.some((item) => item.id === tab)) {
        setActivePanel("overview");
        setResourceTab(tab);
      }
    }
    const scrollTarget = rawAnchor === "video-step-themes"
      ? "video-step-generate"
      : anchor === "resources-videos"
        ? "video-workspace-videos"
        : rawAnchor;
    window.setTimeout(() => document.getElementById(scrollTarget)?.scrollIntoView({ block: "start" }), 0);
  }, [tabItems]);

  useEffect(() => {
    const nextSamples = hydratedAssets.filter(isSampleCandidateAsset);
    if (nextSamples.length) mergeSamples(nextSamples);
  }, [hydratedAssets]);

  useEffect(() => {
    if (typeof window === "undefined" || restoredSampleSelectionRef.current) return;
    const availableIds = new Set(readySourceAssets.map((asset) => asset.id));
    if (!availableIds.size) return;
    const defaultPrimarySampleIds = () => readySourceAssets.filter((asset) => asset.subjectRole === "primary").map((asset) => asset.id).slice(0, 15);
    const defaultPartnerSampleIds = () => readySourceAssets.filter((asset) => asset.subjectRole === "partner").map((asset) => asset.id).slice(0, 15);

    let nextPrimaryIds: string[] = [];
    let nextPartnerIds: string[] = [];
    const saved = window.localStorage.getItem(sampleSelectionStorageKey);
    if (saved) {
      const parsed = recordValue((() => {
        try {
          return JSON.parse(saved) as unknown;
        } catch {
          return {};
        }
      })());
      nextPrimaryIds = stringArray(parsed.primarySampleIds).filter((id) => availableIds.has(id)).slice(0, 15);
      nextPartnerIds = stringArray(parsed.partnerSampleIds).filter((id) => availableIds.has(id)).slice(0, 15);
      const restoredPrimarySet = new Set(nextPrimaryIds);
      nextPartnerIds = nextPartnerIds.filter((id) => !restoredPrimarySet.has(id));
      if (parsed.studioTrainingMode === "single" || parsed.studioTrainingMode === "couple") setStudioTrainingMode(parsed.studioTrainingMode);
      if (typeof parsed.primaryGender === "string" && parsed.primaryGender) setPrimaryGender(parsed.primaryGender);
      if (typeof parsed.partnerGender === "string" && parsed.partnerGender) setPartnerGender(parsed.partnerGender);
      if (typeof parsed.studioModelName === "string") setStudioModelName(parsed.studioModelName);
    }

    if (!nextPrimaryIds.length) {
      nextPrimaryIds = defaultPrimarySampleIds();
    }
    if (!nextPartnerIds.length) {
      nextPartnerIds = defaultPartnerSampleIds();
    }

    if (!nextPrimaryIds.length && !nextPartnerIds.length) {
      const recentJobWithSources = recentJobs.find((job) => {
        const fields = jobFields(job);
        return stringArray(fields.primaryAssetIds).some((id) => availableIds.has(id)) || stringArray(fields.partnerAssetIds).some((id) => availableIds.has(id));
      });
      if (recentJobWithSources) {
        const fields = jobFields(recentJobWithSources);
        nextPrimaryIds = stringArray(fields.primaryAssetIds).filter((id) => availableIds.has(id)).slice(0, 15);
        nextPartnerIds = stringArray(fields.partnerAssetIds).filter((id) => availableIds.has(id)).slice(0, 15);
        const jobPrimarySet = new Set(nextPrimaryIds);
        nextPartnerIds = nextPartnerIds.filter((id) => !jobPrimarySet.has(id));
        if (fields.trainingMode === "single" || fields.trainingMode === "couple") setStudioTrainingMode(fields.trainingMode);
      }
    }

    if (!nextPrimaryIds.length && !nextPartnerIds.length && recentJobs.length && readySourceAssets.length) {
      nextPrimaryIds = readySourceAssets.slice(0, 1).map((asset) => asset.id);
      const latestTrainingMode = jobFields(recentJobs[0]).trainingMode;
      const shouldRestorePartner = studioTrainingMode === "couple" || latestTrainingMode === "couple";
      if (shouldRestorePartner) {
        nextPartnerIds = readySourceAssets.slice(1, 2).map((asset) => asset.id);
        setStudioTrainingMode("couple");
      }
    }

    if (nextPrimaryIds.length) setPrimarySampleIds(nextPrimaryIds);
    if (nextPartnerIds.length) setPartnerSampleIds(nextPartnerIds);
    restoredSampleSelectionRef.current = true;
  }, [readySourceAssets, recentJobs, sampleSelectionStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined" || !restoredSampleSelectionRef.current) return;
    const savedPrimaryIds = primarySampleIds.slice(0, 15);
    const savedPrimarySet = new Set(savedPrimaryIds);
    const savedPartnerIds = partnerSampleIds.filter((id) => !savedPrimarySet.has(id)).slice(0, 15);
    window.localStorage.setItem(sampleSelectionStorageKey, JSON.stringify({
      primarySampleIds: savedPrimaryIds,
      partnerSampleIds: savedPartnerIds,
      studioTrainingMode,
      primaryGender,
      partnerGender,
      studioModelName
    }));
  }, [partnerGender, partnerSampleIds, primaryGender, primarySampleIds, sampleSelectionStorageKey, studioModelName, studioTrainingMode]);

  useEffect(() => {
    if (syncedInitialSamplesRef.current || !restoredSampleSelectionRef.current || runtimeState.status !== "ready") return;
    const availableIds = new Set(readySourceAssets.map((asset) => asset.id));
    const keepIds = Array.from(new Set([...primarySampleIds, ...partnerSampleIds]))
      .filter((assetId) => availableIds.has(assetId) && !assetId.startsWith("local:"));
    if (!keepIds.length) return;
    syncedInitialSamplesRef.current = true;
    void syncCurrentSamples(keepIds);
  }, [partnerSampleIds, primarySampleIds, readySourceAssets, runtimeState.status]);

  useEffect(() => {
    const handleAssetsUpdated = () => {
      setRuntimeFetchEnabled(true);
      setRuntimeRefreshKey((current) => current + 1);
    };
    window.addEventListener("customer-assets:updated", handleAssetsUpdated);
    return () => window.removeEventListener("customer-assets:updated", handleAssetsUpdated);
  }, []);

  useEffect(() => () => {
    sampleBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    sampleBlobUrlsRef.current.clear();
    videoFrameBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    videoFrameBlobUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!selectedPreviewAssetId) return;
    if (!previewableAssets.some((asset) => asset.id === selectedPreviewAssetId)) {
      setSelectedPreviewAssetId(null);
    }
  }, [selectedPreviewAssetId, previewableAssets]);

  return (
    <div className="min-h-screen bg-[#07090d] font-sans text-white">
      <StorefrontNavigationFeedback />
      <CustomerShellHeader creativePackCategories={creativePackCategories} creativePacks={creativePacks} customer={workspaceCustomer} site={site} tone="dark" toolMenuItems={toolMenuItems} />

      <main className="grid min-h-[calc(100vh-97px)] border-t border-white/8 lg:grid-cols-[430px_minmax(0,1fr)] xl:grid-cols-[450px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#0b0c0f] px-3 py-4 lg:sticky lg:top-[98px] lg:h-[calc(100vh-98px)] lg:overflow-y-auto lg:border-b-0 lg:border-r xl:px-4">
          <div className="rounded-[16px] border border-white/10 bg-[#0f1116] p-4">
            <p className="text-sm font-semibold text-white/84">{customerModels[0]?.label ?? t(spanishXby, "No Model Selected", "Ningun modelo seleccionado")}</p>
            {customerModels[0] ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/46">
                <Heart className="h-3.5 w-3.5 fill-[#ff4aa2] text-[#ff4aa2]" strokeWidth={1.8} />
                {customerModels[0].status}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-white/46">{t(spanishXby, "Create a private model before package generation.", "Crea un modelo privado antes de generar un paquete.")}</p>
            )}
          </div>

          <nav className="mt-4 divide-y divide-white/8 border-y border-white/8" data-studio-console-sidebar="true">
            {studioConsoleSections.map((section) => {
              const expanded = activeStudioSection === section.id;
              return (
                <div key={section.id}>
                  <button
                    aria-controls={`studio-console-${section.id}`}
                    aria-expanded={expanded}
                    className="flex min-h-[58px] w-full items-center justify-between gap-3 px-1 py-4 text-left text-sm font-semibold text-white/82 transition hover:text-white"
                    onClick={() => handleStudioConsoleSectionClick(section, expanded)}
                    type="button"
                  >
                    <span>{studioConsoleLabel(section.id, spanishXby)}</span>
                    <ChevronDown className={`h-4 w-4 text-white/42 transition ${expanded ? "rotate-180 text-white/70" : ""}`} strokeWidth={1.8} />
                  </button>
                  {expanded ? (
                    section.id === "model" ? (
                      <div className="grid gap-4 pb-5" id={`studio-console-${section.id}`}>
                        <div className="rounded-[14px] border border-white/20 bg-[#111318] p-4">
                          <p className="text-sm font-semibold">{isAidreamcapes ? t(spanishXby, "Train Travel Model", "Entrenar modelo de viaje") : t(spanishXby, "Train Model", "Entrenar modelo")}</p>
                          <p className="mt-2 text-xs leading-5 text-white/58">
                            {t(spanishXby, "Add clear photos for each person when available. Each generation request needs at least 1 selected photo and can use up to 15 photos.", "Agrega fotos claras de cada persona cuando esten disponibles. Cada solicitud de generacion necesita al menos 1 foto seleccionada y puede usar hasta 15 fotos.")}
                          </p>
                          <div className="mt-4 flex items-center gap-3">
                            <span className="text-xs font-semibold text-white/70">{t(spanishXby, "Training Mode:", "Modo de entrenamiento:")}</span>
                            <div className="inline-grid grid-cols-2 overflow-hidden rounded-[12px] border border-white/10 bg-white/[0.04]">
                              {(["single", "couple"] as const).map((mode) => (
                                <button
                                  className={`px-4 py-2 text-xs font-semibold transition ${studioTrainingMode === mode ? "bg-[#3f5066] text-white" : "text-white/54 hover:bg-white/[0.05] hover:text-white"}`}
                                  key={mode}
                                  onClick={() => setStudioTrainingMode(mode)}
                                  type="button"
                                >
                                  {mode === "single" ? t(spanishXby, "Single", "Individual") : t(spanishXby, "Couple", "Pareja")}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 rounded-[14px] border border-white/12 bg-[#101216] p-4 text-sm font-semibold text-white">
                          <label htmlFor="studio-model-name">{t(spanishXby, "Name", "Nombre")}</label>
                          <span className="text-xs font-normal leading-5 text-white/52">{t(spanishXby, "Give your model a name so you can easily identify it later.", "Pon un nombre al modelo para identificarlo facilmente despues.")}</span>
                          <input
                            autoComplete="off"
                            className="relative z-10 rounded-[10px] border border-white/10 bg-[#05070b] px-3 py-3 text-sm font-normal text-white outline-none transition placeholder:text-white/32 focus:border-[#ff4aa2]/70"
                            id="studio-model-name"
                            onChange={(event) => setStudioModelName(event.target.value)}
                            placeholder={studioTrainingMode === "couple" ? t(spanishXby, "e.g. Natalie and Jack Photos", "p. ej. Fotos de Natalia y Jack") : t(spanishXby, "e.g. Natalie Photos", "p. ej. Fotos de Natalia")}
                            type="text"
                            value={studioModelName}
                          />
                        </div>

                        <div className="grid gap-3 rounded-[14px] border border-white/12 bg-[#101216] p-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-sm font-semibold">{studioTrainingMode === "couple" ? t(spanishXby, "Your Gender", "Tu genero") : t(spanishXby, "Subject Gender", "Genero del sujeto")}</p>
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {studioGenderOptions.map((option) => {
                                  const Icon = option.icon;
                                  const active = primaryGender === option.id;
                                  return (
                                    <button
                                      className={`grid min-h-[72px] place-items-center rounded-[12px] border px-2 py-2 text-xs font-semibold transition ${
                                        active ? "border-[#ff4aa2] bg-[#ff4aa2]/10 text-white" : "border-white/10 bg-black/20 text-white/54 hover:border-white/25 hover:text-white"
                                      }`}
                                      key={option.id}
                                      onClick={() => setPrimaryGender(option.id)}
                                      type="button"
                                    >
                                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                                      <span>{studioGenderLabel(option.id, spanishXby)}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {studioTrainingMode === "couple" ? (
                              <div>
                                <p className="text-sm font-semibold">{t(spanishXby, "Partner Gender", "Genero de la pareja")}</p>
                                <div className="mt-3 grid grid-cols-3 gap-2">
                                  {studioGenderOptions.map((option) => {
                                    const Icon = option.icon;
                                    const active = partnerGender === option.id;
                                    return (
                                      <button
                                        className={`grid min-h-[72px] place-items-center rounded-[12px] border px-2 py-2 text-xs font-semibold transition ${
                                          active ? "border-[#ff4aa2] bg-[#ff4aa2]/10 text-white" : "border-white/10 bg-black/20 text-white/54 hover:border-white/25 hover:text-white"
                                        }`}
                                        key={option.id}
                                        onClick={() => setPartnerGender(option.id)}
                                        type="button"
                                      >
                                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                                        <span>{studioGenderLabel(option.id, spanishXby)}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid gap-3 rounded-[14px] border border-white/12 bg-[#101216] p-4">
                          {(studioTrainingMode === "couple"
                            ? [
                                { id: "primary" as const, title: t(spanishXby, "Your Samples", "Tus muestras"), body: t(spanishXby, "Upload photos for the primary person.", "Sube fotos de la persona principal.") },
                                { id: "partner" as const, title: t(spanishXby, "Partner Samples", "Muestras de la pareja"), body: t(spanishXby, "Upload photos for the partner person.", "Sube fotos de la pareja.") }
                              ]
                            : [{ id: "primary" as const, title: t(spanishXby, "Your Samples", "Tus muestras"), body: t(spanishXby, "Upload photos for this private model.", "Sube fotos para este modelo privado.") }]
                          ).map((group) => {
                            const selectedIds = group.id === "partner" ? partnerSampleIds : primarySampleIds;
                            const groupAssets = groupSamplesFor(group.id);
                            const selectedGroupAssets = groupAssets.filter((asset) => selectedIds.includes(asset.id));
                            const remoteDeleting = selectedGroupAssets.some((asset) => deletingSampleId === asset.id);
                            return (
                              <div className="rounded-[12px] border border-white/10 bg-black/20 p-3" key={group.id}>
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold">{group.title}</p>
                                    <p className="mt-1 text-xs leading-5 text-white/52">
                                      {group.body} {spanishXby ? `${selectedIds.length} seleccionadas. Toca una foto para elegir muestras y elimina las seleccionadas si hace falta.` : `${selectedIds.length} selected. Tap a photo to choose samples, then delete selected if needed.`}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 gap-2">
                                    {groupAssets.length ? (
                                      <button
                                        className="rounded-[10px] border border-rose-300/25 bg-rose-500/12 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/18 disabled:cursor-wait disabled:opacity-55"
                                        disabled={remoteDeleting || !selectedGroupAssets.length}
                                        onClick={() => requestSampleDelete(selectedGroupAssets, group.title)}
                                        type="button"
                                      >
                                        {remoteDeleting ? t(spanishXby, "Deleting", "Eliminando") : selectedGroupAssets.length ? t(spanishXby, "Delete selected", "Eliminar seleccionadas") : t(spanishXby, "Select to delete", "Selecciona para eliminar")}
                                      </button>
                                    ) : null}
                                    <button
                                      className="rounded-[10px] border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                                      disabled={uploadingSampleTarget === group.id}
                                      onClick={() => openSidebarSamplePicker(group.id)}
                                      type="button"
                                    >
                                      {uploadingSampleTarget === group.id ? t(spanishXby, "Uploading", "Subiendo") : t(spanishXby, "Upload", "Subir")}
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2" role="list" aria-label={`${group.title} samples`}>
                                  {groupAssets.slice(0, 15).map((asset) => {
                                    const selected = selectedIds.includes(asset.id);
                                    const previewUnavailable = assetPreviewIsLoading(asset) && asset.localStatus !== "uploading";
                                    const selectable = !assetPreviewIsLoading(asset) && asset.localStatus !== "failed";
                                    return (
                                      <div
                                        className={`group/sample relative overflow-hidden rounded-[10px] border bg-black/30 transition ${
                                          selected ? "border-[#31d4ff] ring-2 ring-[#31d4ff]/35" : "border-white/10 hover:border-white/28"
                                        }`}
                                        key={`${group.id}_${asset.id}`}
                                        role="listitem"
                                      >
                                        <button
                                          aria-pressed={selected}
                                          className="block w-full text-left disabled:cursor-not-allowed"
                                          disabled={!selectable}
                                          onClick={() => toggleSampleSelection(group.id, asset)}
                                          title={selected ? t(spanishXby, "Selected for this request", "Seleccionada para esta solicitud") : t(spanishXby, "Select this sample", "Seleccionar esta muestra")}
                                          type="button"
                                        >
                                          <img alt={uploadedSampleLabel(asset, group.id)} className={`aspect-square w-full object-cover transition group-hover/sample:scale-[1.03] ${selected ? "brightness-105" : "opacity-72"}`} src={sourceSamplePreviewUrl(asset)} />
                                          <span className={`absolute left-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full border text-white shadow-[0_8px_22px_-14px_rgba(0,0,0,0.8)] ${
                                            selected ? "border-[#31d4ff] bg-[#31d4ff] text-[#051016]" : "border-white/45 bg-black/56"
                                          }`}>
                                            {selected ? <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} /> : null}
                                          </span>
                                        </button>
                                        <button
                                          aria-label={`Preview ${asset.label}`}
                                          className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full border border-white/25 bg-black/56 text-white/76 opacity-0 transition hover:bg-white/12 hover:text-white group-hover/sample:opacity-100"
                                          onClick={() => setPreviewSampleId(asset.id)}
                                          type="button"
                                        >
                                          <Eye className="h-3.5 w-3.5" strokeWidth={1.9} />
                                        </button>
                                        <span className={`absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                          selected ? "bg-[#31d4ff] text-[#041014]" : "bg-black/58 text-white/64"
                                        }`}>
                                          {selected ? t(spanishXby, "Selected", "Seleccionada") : t(spanishXby, "Tap to select", "Toca para seleccionar")}
                                        </span>
                                      {asset.localStatus === "uploading" ? (
                                        <span className="absolute inset-0 grid place-items-center bg-black/52 text-[11px] font-semibold text-white">{t(spanishXby, "Uploading", "Subiendo")}</span>
                                      ) : null}
                                      {asset.localStatus === "failed" ? (
                                        <span className="absolute inset-0 grid place-items-center bg-rose-950/70 px-2 text-center text-[11px] font-semibold text-white">{t(spanishXby, "Failed", "Fallida")}</span>
                                      ) : null}
                                      {previewUnavailable ? (
                                        <span className="absolute inset-0 grid place-items-center bg-black/68 px-2 text-center text-[11px] font-semibold text-white">{t(spanishXby, "Preview unavailable", "Vista previa no disponible")}</span>
                                      ) : null}
                                      </div>
                                    );
                                  })}
                                  {!groupAssets.length ? (
                                    <button
                                      className="col-span-3 grid min-h-[104px] place-items-center rounded-[12px] border border-dashed border-white/18 bg-black/20 px-4 py-5 text-center text-xs leading-5 text-white/52 transition hover:border-[#31d4ff]/60 hover:text-white"
                                      onClick={() => openSidebarSamplePicker(group.id)}
                                      type="button"
                                    >
                                      {t(spanishXby, "Click Upload to select image files.", "Haz clic en Subir para seleccionar archivos de imagen.")}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            );
                          })}
                          <input
                            accept="image/*"
                            className="sr-only"
                            multiple
                            onChange={(event) => {
                              void uploadSidebarSamples(event.target.files);
                              event.target.value = "";
                            }}
                            ref={sampleUploadInputRef}
                            type="file"
                          />
                          <p className="text-xs leading-5 text-white/46">{sampleUploadMessage}</p>
                          <button
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#4c55e8] px-4 py-3 text-xs font-semibold text-white transition hover:bg-[#5c66ff] disabled:cursor-not-allowed disabled:opacity-55"
                            disabled={!hasRequiredStudioSamples}
                            onClick={() => {
                              if (!hasRequiredStudioSamples) {
                                setSampleUploadMessage(studioSampleRequirementMessage);
                                return;
                              }
                              setAppliedOperationContext({
                                action: isAidreamcapes ? t(spanishXby, "Travel model training", "Entrenamiento de modelo de viaje") : t(spanishXby, "AI model training", "Entrenamiento de modelo IA"),
                                note: studioModelName.trim() || undefined,
                                source: t(spanishXby, "Create New AI Model", "Crear nuevo modelo IA")
                              });
                              setPreferredToolId(undefined);
                              setPreferredCreateMode("theme");
                              setPreferredCreateModeRequest((current) => current + 1);
                              choosePanel("create", "step-create");
                            }}
                            type="button"
                          >
                            {t(spanishXby, "Train Model", "Entrenar modelo")} ({studioTrainingMode === "couple" ? 100 : 50} {t(spanishXby, "credits", "creditos")})
                          </button>
                          {!hasRequiredStudioSamples ? (
                            <p className="text-xs leading-5 text-amber-100/72" role="status">{studioSampleRequirementMessage}</p>
                          ) : null}
                        </div>
                      </div>
                    ) : section.id === "video" ? renderVideoFrameSidebar() : (
                      <div className="grid gap-3 pb-5" id={`studio-console-${section.id}`}>
                        <div className="rounded-[14px] border border-white/12 bg-[#101216] p-4">
                          <p className="text-sm font-semibold">{section.label}</p>
                          <p className="mt-2 text-xs leading-5 text-white/52">
                            {t(spanishXby, "Use the main window to select a package or tool, then return here for model setup and sample maintenance.", "Usa la ventana principal para elegir un paquete o herramienta y vuelve aqui para configurar el modelo y mantener muestras.")}
                          </p>
                          <button
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/12 bg-white/[0.06] px-4 py-3 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                            onClick={() => chooseStudioConsoleSection(section)}
                            type="button"
                          >
                            {t(spanishXby, "Open workspace", "Abrir espacio")}
                            <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                          </button>
                        </div>
                      </div>
                    )
                  ) : null}
                </div>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0 bg-[#050506]">
          <div className="border-b border-white/10 px-5 py-4 xl:px-8">
            <div className="flex flex-wrap items-center gap-3">
              {showVideoStep ? videoTabItems.map((tab) => (
                <button
                  className={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-4 text-sm font-semibold transition ${
                    videoWorkspaceTab === tab.id
                      ? "bg-[#2f6fed] text-white"
                      : "bg-[#1d2633] text-white/62 hover:bg-[#283345] hover:text-white"
                  }`}
                  key={tab.id}
                  onClick={() => chooseVideoWorkspaceTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              )) : tabItems.map((tab) => (
                <button
                  className={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-4 text-sm font-semibold transition ${
                    resourceTab === tab.id && (activePanel === "overview" || tab.id === "packages")
                      ? "bg-[#2f6fed] text-white"
                      : "bg-[#1d2633] text-white/62 hover:bg-[#283345] hover:text-white"
                  }`}
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === "packages") {
                      setPreferredToolId(undefined);
                      setPreferredCreateMode("theme");
                      setPreferredCreateModeRequest((current) => current + 1);
                      setResourceTab("packages");
                      choosePanel("create", "step-create");
                      return;
                    }
                    chooseResourceTab(tab.id);
                  }}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm text-white/54">
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-semibold text-white/70">
                  {t(spanishXby, "Credits", "Creditos")}: {workspaceCustomer.balance.available}
                </span>
                <span>{showVideoStep ? t(spanishXby, "Image to video workspace", "Espacio de imagen a video") : resourceTitleByTab[resourceTab]}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-5 py-5 xl:px-8">
            {workspaceNotice ? (
              <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-amber-300/25 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-amber-50" role="status">
                <p className="max-w-3xl">{workspaceNotice}</p>
                <button
                  className="rounded-full border border-amber-100/20 px-3 py-1 text-xs font-semibold text-amber-50/80 transition hover:bg-amber-100/10 hover:text-amber-50"
                  onClick={() => setWorkspaceNotice("")}
                  type="button"
                >
                  {t(spanishXby, "Dismiss", "Cerrar")}
                </button>
              </div>
            ) : null}
            <div className="grid gap-5">
              {showUploadStep ? (
              <section className="scroll-mt-28 rounded-[22px] border border-white/10 bg-[#0c0f16] p-4 shadow-[0_24px_80px_-62px_rgba(0,0,0,0.92)] md:p-5" id="step-upload">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{t(spanishXby, "Step 01", "Paso 01")}</p>
                    <h2 className="mt-2 text-xl font-semibold">{t(spanishXby, "Upload selfies", "Subir selfies")}</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                      {t(spanishXby, "Upload private selfies or reference images for the selected AI request. These files stay in your signed-in workspace.", "Sube selfies privados o imagenes de referencia para la solicitud IA seleccionada. Estos archivos quedan en tu espacio privado con sesion iniciada.")}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/58">
                    {sourceAssets.length} {t(spanishXby, "private photos", "fotos privadas")}
                  </span>
                </div>
                {runtimeIsInitializing ? <WorkspaceInlineLoading label={t(spanishXby, "Loading your private uploads in this panel.", "Cargando tus subidas privadas en este panel.")} /> : null}
                {runtimeState.status === "error" ? (
                  <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.035] p-4 text-sm text-white/64">
                    {t(spanishXby, "Workspace activity could not load. You can refresh the page or open your account center.", "No se pudo cargar la actividad del espacio. Actualiza la pagina o abre tu cuenta.")}
                  </div>
                ) : null}
                <div className={runtimeIsInitializing ? "mt-4" : undefined}>
                  <AssetsPanel assets={hydratedAssets} customer={workspaceCustomer} onContinueToCreate={() => choosePanel("create", "step-create")} preferProvidedAssets siteId={site.id} tone="dark" />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-sm leading-6 text-white/58">
                    {sourceAssets.length
                      ? t(spanishXby, "Your private photos are ready. Continue to choose a package or tool.", "Tus fotos privadas estan listas. Continua para elegir un paquete o herramienta.")
                      : t(spanishXby, "Upload at least 1 private photo before choosing a package or tool.", "Sube al menos 1 foto privada antes de elegir un paquete o herramienta.")}
                  </p>
                  <button
                    className="rounded-full border border-white/12 bg-white px-5 py-2.5 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!sourceAssets.length}
                    onClick={() => choosePanel("create", "step-create")}
                    type="button"
                  >
                    {t(spanishXby, "Choose package or tool", "Elegir paquete o herramienta")}
                  </button>
                </div>
              </section>
              ) : null}

              {showVideoStep ? (
                <div aria-hidden={videoWorkspaceTab === "videos"} hidden={videoWorkspaceTab === "videos"}>
                  <CustomerVideoWorkspace
                    customer={workspaceCustomer}
                    onGenerationFailed={showVideoJobCreationFailed}
                    onGenerationStarted={showVideoJobSubmitting}
                    onJobCreated={showVideoJobStatus}
                    onPrepareVideoFrames={prepareVideoFramesForGeneration}
                    onOpenFrameManager={focusVideoFrameManager}
                    onRetryDraftApplied={() => setRetryVideoDraft(null)}
                    initialThemes={videoThemes}
                    readyFrameIds={readySelectedVideoFrameIds}
                    retryDraft={retryVideoDraft}
                    selectedFrames={selectedVideoFrames.map((asset) => ({ id: asset.id, label: asset.label, mimeType: asset.mimeType }))}
                    selectedFrameIds={selectedVideoFrameIds}
                    setSelectedFrameIds={setSelectedVideoFrameIds}
                    siteId={site.id}
                    spanish={spanishXby}
                    submissionPending={videoSubmissionPending}
                    subscriptionStatus={subscriptionStatus}
                  />
                </div>
              ) : null}

              {showVideoStep && videoWorkspaceTab === "videos" ? (
                <section className="scroll-mt-28 rounded-[22px] border border-white/10 bg-[#0c0f16] p-4 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.92)] md:p-5" id="video-workspace-videos">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{t(spanishXby, "Videos", "Videos")}</p>
                      <h2 className="mt-2 text-lg font-semibold">{t(spanishXby, "Generated video workspace", "Espacio de videos generados")}</h2>
                      <p className="mt-1 text-xs text-white/46">
                        {videoWorkspaceSummary}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="rounded-[8px] border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/66 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={runtimeRefreshUiPending}
                        onClick={requestWorkspaceRefresh}
                        type="button"
                      >
                        {runtimeRefreshUiPending ? t(spanishXby, "Refreshing...", "Actualizando...") : t(spanishXby, "Refresh status", "Actualizar estado")}
                      </button>
                      <button
                        className="rounded-[8px] bg-[#2f6fed] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4380ff]"
                        onClick={() => chooseVideoWorkspaceTab("generate")}
                        type="button"
                      >
                        {t(spanishXby, "Create video", "Crear video")}
                      </button>
                    </div>
                  </div>
                  <p className="min-h-5 pt-2 text-right text-xs text-white/40" role="status">
                    {runtimeRefreshMessage || (runtimeRefreshUiPending ? t(spanishXby, "Refreshing status...", "Actualizando estado...") : "")}
                  </p>

                  {runtimeIsInitializing && !videoResourceAssets.length ? (
                    <div className="py-5"><WorkspaceInlineLoading label={t(spanishXby, "Loading video workspace.", "Cargando espacio de video.")} /></div>
                  ) : null}
                  {runtimeInitialLoadFailed && !videoResourceAssets.length ? (
                    <div className="rounded-[12px] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50/82" role="status">
                      {t(spanishXby, "Workspace activity could not load from the database. Use Refresh status after the local database tunnel reconnects.", "No se pudo cargar la actividad del espacio desde la base de datos. Usa Actualizar estado despues de reconectar el tunel local.")}
                    </div>
                  ) : null}

                  {waitingForCreatedVideoJob || showVideoCreationFailureCard || visibleVideoProgressJobs.length ? (
                    <div className="grid gap-3 border-b border-white/8 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-white/80">{t(spanishXby, "Video request progress", "Progreso de video")}</p>
                        <button
                          className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/52 transition hover:bg-white/[0.07] hover:text-white/78 disabled:cursor-not-allowed disabled:opacity-45"
                          disabled={runtimeRefreshUiPending}
                          onClick={requestWorkspaceRefresh}
                          type="button"
                        >
                          {runtimeRefreshUiPending ? t(spanishXby, "Checking...", "Revisando...") : t(spanishXby, "Check now", "Revisar ahora")}
                        </button>
                      </div>
                      <div className="grid gap-3 lg:grid-cols-2">
                        {showVideoCreationFailureCard ? (
                          <div className="rounded-[14px] border border-rose-400/22 bg-rose-500/10 p-4" role="alert">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{t(spanishXby, "Video request was not created", "No se creo la solicitud de video")}</p>
                                <p className="mt-1 text-xs font-semibold text-rose-200">{t(spanishXby, "Start request failed", "No se pudo iniciar")}</p>
                              </div>
                              <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                                {t(spanishXby, "NOT STARTED", "NO INICIADO")}
                              </span>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-white/62">{videoCreationFailureMessage}</p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                className="rounded-full border border-white/16 px-3 py-1.5 text-xs font-semibold text-white/74 transition hover:bg-white/[0.08] hover:text-white"
                                onClick={() => chooseVideoWorkspaceTab("generate")}
                                type="button"
                              >
                                {t(spanishXby, "Back to setup", "Volver a configurar")}
                              </button>
                              <button
                                className="rounded-full border border-white/16 px-3 py-1.5 text-xs font-semibold text-white/74 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                                disabled={runtimeRefreshUiPending}
                                onClick={requestWorkspaceRefresh}
                                type="button"
                              >
                                {runtimeRefreshUiPending ? t(spanishXby, "Checking...", "Revisando...") : t(spanishXby, "Check now", "Revisar ahora")}
                              </button>
                            </div>
                          </div>
                        ) : null}
                        {waitingForCreatedVideoJob ? (
                          <div className="rounded-[14px] border border-amber-300/18 bg-amber-300/8 p-4" role="status">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white">{t(spanishXby, "Video request created", "Solicitud de video creada")}</p>
                                <p className="mt-1 text-xs font-semibold text-amber-100">{t(spanishXby, "Loading latest status", "Cargando estado actualizado")}</p>
                              </div>
                              <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                                {t(spanishXby, "SYNCING", "SINCRONIZANDO")}
                              </span>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-white/54">
                              {t(spanishXby, "The new video request is being loaded. Previous failed requests are hidden until the latest status arrives.", "La nueva solicitud de video se esta cargando. Las solicitudes fallidas anteriores se ocultan hasta que llegue el estado actualizado.")}
                            </p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              <div className="overflow-hidden rounded-[10px] border border-white/10 bg-white/[0.035]">
                                <div className="grid aspect-[4/3] place-items-center bg-black/18 px-3 text-center">
                                  <span className="text-xs font-semibold text-white/44">{t(spanishXby, "Refreshing video status", "Actualizando estado del video")}</span>
                                </div>
                                <div className="flex items-center justify-between gap-2 px-3 py-2">
                                  <span className="text-[11px] font-semibold text-white/74">{t(spanishXby, "Image 1", "Imagen 1")}</span>
                                  <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/48">
                                    {t(spanishXby, "Generating", "Generando")}
                                  </span>
                                </div>
                                <div className="px-3 pb-3">
                                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                    <div className="h-full w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite] rounded-full bg-[#31d4ff]" />
                                  </div>
                                  <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-white/38">
                                    <span className="truncate">{t(spanishXby, "Generating output", "Generando resultado")}</span>
                                    <span className="shrink-0">{t(spanishXby, "In progress", "En progreso")}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/38">
                              <span>{t(spanishXby, "0 of 1 delivered · 1 pending", "0 de 1 entregados · 1 pendiente")}</span>
                              <span>{t(spanishXby, "Waiting for status", "Esperando estado")}</span>
                            </div>
                          </div>
                        ) : visibleVideoProgressJobs.map((job) => {
                          const outputAssets = outputAssetsByJobId.get(job.id) ?? [];
                          const slots = workspaceJobOutputSlots(job, outputAssets);
                          const failed = job.status === "failed" || slots.some((slot) => slot.status === "failed");
                          const providerFailure = failed ? workspaceJobProviderFailure(job, slots) : undefined;
                          const retryDraft = failed ? videoRetryDraftFromJob(job) : undefined;
                          const directRetry = failed && canDirectRetryVideoJob(job, providerFailure);
                          const retryingThisJob = retryingVideoJobId === job.id;
                          const timingBreakdown = workspaceVideoTimingBreakdown(job, spanishXby);
                          return (
                            <div
                              className={`rounded-[14px] border p-4 ${
                                failed ? "border-rose-400/22 bg-rose-500/10" : "border-amber-300/18 bg-amber-300/8"
                              }`}
                              key={job.id}
                              role={failed ? "alert" : "status"}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white" title={workspaceJobTitle(job, spanishXby)}>{workspaceJobTitle(job, spanishXby)}</p>
                                  <p className={`mt-1 text-xs font-semibold ${failed ? "text-rose-200" : "text-amber-100"}`}>{workspaceJobSlotStageLabel(job, slots, spanishXby)}</p>
                                </div>
                                <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                                  {workspaceJobStatusBadge(job, slots)}
                                </span>
                              </div>
                              <p className="mt-3 text-xs leading-5 text-white/54">{workspaceJobBody(job, spanishXby, slots)}</p>
                              <div className="mt-3 border-t border-white/8 pt-3">
                                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-semibold text-white/58">
                                  <span>{t(spanishXby, "Time breakdown", "Desglose de tiempo")}</span>
                                  {timingBreakdown.totalSeconds !== undefined ? (
                                    <span>{t(spanishXby, "Total", "Total")} {formatWorkspaceDuration(timingBreakdown.totalSeconds)}</span>
                                  ) : null}
                                </div>
                                {timingBreakdown.hasDetailedTiming && timingBreakdown.rows.length ? (
                                  <div className="mt-2 grid gap-1.5 text-[10px] text-white/42 sm:grid-cols-2">
                                    {timingBreakdown.rows.map((row) => (
                                      <div className="flex min-w-0 items-center justify-between gap-2" key={row.key}>
                                        <span className="truncate">{row.label}</span>
                                        <span className={`shrink-0 font-semibold ${row.active ? "text-amber-100" : "text-white/56"}`}>
                                          {formatWorkspaceDuration(row.seconds)}{row.active ? ` ${t(spanishXby, "so far", "hasta ahora")}` : ""}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="mt-2 text-[10px] leading-4 text-white/38">{timingBreakdown.fallbackNotice}</p>
                                )}
                              </div>
                              {failed ? (
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <button
                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-rose-200/24 bg-rose-100/10 px-3 text-xs font-semibold text-rose-50 transition hover:bg-rose-100/16 disabled:cursor-not-allowed disabled:opacity-45"
                                    disabled={!directRetry || Boolean(retryingVideoJobId)}
                                    onClick={() => retryVideoJob(job)}
                                    title={directRetry
                                      ? t(spanishXby, "Create a new video request with the same saved inputs", "Crear una nueva solicitud de video con las mismas entradas guardadas")
                                      : t(spanishXby, "Review and adjust the inputs before retrying this failure", "Revisa y ajusta las entradas antes de reintentar este fallo")}
                                    type="button"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    {retryingThisJob ? t(spanishXby, "Retrying...", "Reintentando...") : t(spanishXby, "Retry video", "Reintentar video")}
                                  </button>
                                  <button
                                    className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 text-xs font-semibold text-white/72 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45"
                                    disabled={!retryDraft || Boolean(retryingVideoJobId)}
                                    onClick={() => editAndRetryVideoJob(job)}
                                    title={retryDraft
                                      ? t(spanishXby, "Restore the previous inputs so you can edit them and generate again", "Restaurar entradas anteriores para editarlas y volver a generar")
                                      : t(spanishXby, "This request no longer has saved frame inputs", "Esta solicitud ya no tiene fotogramas guardados")}
                                    type="button"
                                  >
                                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                                    {t(spanishXby, "Edit and retry", "Editar y reintentar")}
                                  </button>
                                </div>
                              ) : null}
                              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                {slots.map((slot) => {
                                  const slotSucceeded = slot.status === "succeeded";
                                  const slotFailed = slot.status === "failed";
                                  const slotVideo = slot.mimeType?.startsWith("video/");
                                  const slotStorageKey = slot.storageKey;
                                  const slotAsset = slotStorageKey ? outputAssetForSlot(slotStorageKey, outputAssets) : undefined;
                                  const slotAssetCopy = slotAsset ? outputCopyForAsset(slotAsset) : undefined;
                                  const slotMediaLabel = slotAsset
                                    ? generatedAssetLabel(slotAsset, slotAssetCopy)
                                    : `${workspaceJobTitle(job, false)} ${slotVideo ? "video" : "image"} ${slot.index}`;
                                  const slotPreviewAsset = slotPreviewAssetFor(job, slot, outputAssets, slotMediaLabel);
                                  const slotProgress = workspaceSlotProgress(slot);
                                  const slotFailure = slot.providerFailure ?? normalizeVideoProviderFailure({ error: slot.error });
                                  const slotErrorText = slot.error || slotFailure ? workspaceGenerationErrorText(slot.error ?? "", spanishXby, slotFailure, isVideoRuntimeJob(job)) : "";
                                  return (
                                    <div
                                      className={`overflow-hidden rounded-[10px] border ${
                                        slotSucceeded
                                          ? "border-emerald-300/24 bg-emerald-300/8"
                                          : slotFailed
                                            ? "border-rose-300/24 bg-rose-300/8"
                                            : "border-white/10 bg-white/[0.035]"
                                      }`}
                                      key={`${job.id}_${slot.index}`}
                                    >
                                      {slot.storageKey || slot.previewUrl ? (
                                        slotVideo ? (
                                          renderVideoPreviewButton({
                                            mediaKey: slot.storageKey ? `slot:${normalizedWorkspaceStorageKey(slot.storageKey)}` : `slot-preview:${job.id}:${slot.index}`,
                                            label: slotMediaLabel,
                                            src: slot.storageKey ? workspaceSlotPreviewUrl(slot.storageKey) : slot.previewUrl!,
                                            fallbackPosterSrc: fallbackVideoPosterForJob(job.id),
                                            compact: true,
                                            disabled: !slotPreviewAsset,
                                            onOpen: () => {
                                              if (slotPreviewAsset) setSelectedPreviewAssetId(slotPreviewAsset.id);
                                            }
                                          })
                                        ) : (
                                          <img
                                            alt={slotMediaLabel}
                                            className="aspect-[4/3] w-full object-cover"
                                            src={slot.storageKey ? workspaceSlotPreviewUrl(slot.storageKey) : slot.previewUrl!}
                                          />
                                        )
                                      ) : (
                                        <div className="grid aspect-[4/3] place-items-center bg-black/18 px-3 text-center">
                                          <span className={`text-xs font-semibold ${slotFailed ? "text-rose-100/72" : "text-white/44"}`}>
                                            {workspaceSlotProgressText(slot, spanishXby)}
                                          </span>
                                        </div>
                                      )}
                                      <div className="flex items-center justify-between gap-2 px-3 py-2">
                                        <span className="text-[11px] font-semibold text-white/74">{slotVideo ? "Video" : t(spanishXby, "Image", "Imagen")} {slot.index}</span>
                                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                                          slotSucceeded
                                            ? "bg-emerald-300/12 text-emerald-100"
                                            : slotFailed
                                              ? "bg-rose-300/12 text-rose-100"
                                              : "bg-white/8 text-white/48"
                                        }`}>
                                          {slotLabel(slot, spanishXby)}
                                        </span>
                                      </div>
                                      <div className="px-3 pb-3">
                                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                          <div
                                            className={`h-full rounded-full transition-all ${
                                              slotFailed
                                                ? "bg-rose-300"
                                                : slotSucceeded
                                                  ? "bg-emerald-300"
                                                  : `bg-[#31d4ff] ${slotProgress === undefined ? "w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite]" : ""}`
                                            }`}
                                            style={slotProgress === undefined ? undefined : { width: `${slotProgress}%` }}
                                          />
                                        </div>
                                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-white/38">
                                          <span className="truncate">{workspaceSlotProgressText(slot, spanishXby)}</span>
                                          <span className="shrink-0">
                                            {slotFailed
                                              ? t(spanishXby, "Stopped", "Detenido")
                                              : slotProgress === undefined
                                                ? t(spanishXby, "In progress", "En progreso")
                                                : `${slotProgress}%`}
                                          </span>
                                        </div>
                                        {slotFailed && slotErrorText ? (
                                          <p className="mt-1 truncate text-[10px] text-rose-100/50" title={slotErrorText}>{slotErrorText}</p>
                                        ) : null}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/38">
                                <span>{workspaceSlotSummary(slots, spanishXby)}</span>
                                <span>{t(spanishXby, "Updated", "Actualizado")} {workspaceJobTime(job.updatedAt)}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {videoResourceAssets.length ? (
                    <div className="grid auto-rows-fr gap-4 py-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                      {videoResourceAssets.slice(0, 16).map((asset) => renderResourceAssetCard(asset))}
                    </div>
                  ) : null}

                  {!videoResourceAssets.length && !runtimeIsInitializing && runtimeState.status !== "error" ? (
                    <div className="grid min-h-[360px] place-items-center rounded-[12px] border border-white/8 bg-black/18">
                      <div className="max-w-md text-center">
                        <p className="text-base font-semibold text-white/84">{t(spanishXby, "No generated videos yet", "Aun no hay videos generados")}</p>
                        <p className="mt-2 text-sm leading-6 text-white/42">{t(spanishXby, "Started video requests and finished MP4 files will appear in this tab.", "Las solicitudes de video y los MP4 terminados apareceran en esta pestana.")}</p>
                        <button
                          className="mt-5 rounded-[8px] bg-[#2f6fed] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4380ff]"
                          onClick={() => chooseVideoWorkspaceTab("generate")}
                          type="button"
                        >
                          {t(spanishXby, "Create video", "Crear video")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              ) : null}

              {showCreateStep ? (
              <section className="scroll-mt-28 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f16] shadow-[0_28px_90px_-60px_rgba(0,0,0,0.92)]" id="step-create">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[linear-gradient(135deg,#ff5ebd,#2f6fed)]">
                      <LayoutGrid className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h2 className="text-base font-semibold">{t(spanishXby, "Start your AI photoshoot", "Iniciar sesion de fotos IA")}</h2>
                      <p className="mt-1 text-xs text-white/50">{t(spanishXby, "Choose a package, upload selfies, confirm credits, then start your private request.", "Elige un paquete, sube selfies, confirma creditos e inicia tu solicitud privada.")}</p>
                    </div>
                  </div>
                  <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/58 sm:inline-flex">
                    {workspaceCustomer.balance.available} {t(spanishXby, "credits", "creditos")}
                  </span>
                </div>
                <div className="p-4 md:p-5">
                  <JobCreateForm
                    assets={hydratedAssets}
                    creativePackCategories={creativePackCategories}
                    creativePacks={creativePacks}
                    customer={workspaceCustomer}
                    customerModels={customerModels}
                    externalPartnerAssetIds={readyPartnerSampleIds}
                    externalPrimaryAssetIds={readyPrimarySampleIds}
                    externalSourceAssets={readySourceAssets}
                    initialCreativePackId={initialCreativePackId}
                    initialToolId={initialToolId}
                    operationContext={appliedOperationContext}
                    preferredMode={preferredCreateMode}
                    preferredModeRequest={preferredCreateModeRequest}
                    preferredToolId={preferredToolId}
                    retryDraft={retryImageDraft}
                    site={site}
                    siteAiApps={siteAiApps}
                    siteId={site.id}
                    siteSlug={site.slug}
                    subscriptionStatus={subscriptionStatus}
                    trainingMode={studioTrainingMode}
                    locale={spanishXby ? "es" : "en"}
                    onJobCreated={(jobId, feedback) => showJobStatus(jobId, "all", feedback)}
                    onContinueToSources={() => choosePanel("create", "source-photos")}
                    onOpenUploadManager={() => choosePanel("upload", "step-upload")}
                    onReviewCurrentRequest={showCurrentRequestReview}
                    onVideoToolSelected={(tool) => {
                      setAppliedOperationContext({ action: tool.title, source: t(spanishXby, "Tools", "Herramientas") });
                      setWorkspaceNotice(t(spanishXby, `${tool.title} opens in the Image to Video workspace.`, `${tool.title} se abre en el espacio Image to Video.`));
                      chooseVideoWorkspaceTab("generate");
                    }}
                    preferProvidedAssets
                    tone="dark"
                    toolMenuItems={toolMenuItems}
                  />
                </div>
              </section>
              ) : null}

              {showReviewStep ? (
            <section className="relative min-h-[620px] scroll-mt-28 rounded-[2px] bg-[#050506]" id="review-request">
              {tabItems.map((tab) => (
                <span aria-hidden="true" className="absolute -top-28" id={`resources-${tab.id}`} key={`anchor_${tab.id}`} />
              ))}
              <div className="flex min-h-[620px] flex-col">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/6 px-2 pb-4">
                  <div>
                    <h2 className="text-lg font-semibold">{resourceTitleByTab[resourceTab]}</h2>
                    <p className="mt-1 text-xs text-white/42">
                      {spanishXby ? `${activeJobs} trabajos activos · ${failedJobs} requieren atencion · ${visibleResourceAssets.length} recursos generados` : `${activeJobs} active jobs · ${failedJobs} need attention · ${visibleResourceAssets.length} generated items`}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-[8px] border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/66 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={runtimeRefreshUiPending}
                      onClick={requestWorkspaceRefresh}
                      type="button"
                    >
                      {runtimeRefreshUiPending ? t(spanishXby, "Refreshing...", "Actualizando...") : t(spanishXby, "Refresh status", "Actualizar estado")}
                    </button>
                    <button
                      className="rounded-[8px] bg-[#2f6fed] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4380ff]"
                      onClick={() => {
                        setPreferredToolId(undefined);
                        setPreferredCreateMode("theme");
                        setPreferredCreateModeRequest((current) => current + 1);
                        setResourceTab("packages");
                        choosePanel("create", "step-create");
                      }}
                      type="button"
                    >
                      {t(spanishXby, "Pick Package", "Elegir paquete")}
                    </button>
                  </div>
                </div>
                <p className="min-h-5 px-2 pt-2 text-right text-xs text-white/40" role="status">
                  {runtimeRefreshMessage || (runtimeRefreshUiPending ? t(spanishXby, "Refreshing status...", "Actualizando estado...") : "")}
                </p>

                {runtimeIsInitializing && !visibleResourceAssets.length ? (
                  <div className="p-5"><WorkspaceInlineLoading label={t(spanishXby, "Loading workspace resources.", "Cargando recursos del espacio.")} /></div>
                ) : null}

                {resourceTab === "all" && visibleStatusJobs.length ? (
                  <div className="grid gap-3 border-b border-white/6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white/80">{t(spanishXby, "Request progress", "Progreso de solicitud")}</p>
                      <button
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/52 transition hover:bg-white/[0.07] hover:text-white/78 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={runtimeRefreshUiPending}
                        onClick={requestWorkspaceRefresh}
                        type="button"
                      >
                        {runtimeRefreshUiPending ? t(spanishXby, "Checking...", "Revisando...") : t(spanishXby, "Check now", "Revisar ahora")}
                      </button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {visibleStatusJobs.map((job) => {
                        const outputAssets = outputAssetsByJobId.get(job.id) ?? [];
                        const slots = workspaceJobOutputSlots(job, outputAssets);
                        const failed = job.status === "failed" || slots.some((slot) => slot.status === "failed");
                        const rerunnable = job.status === "failed" || job.status === "refunded";
                        const retryDraft = failed && rerunnable ? imageRetryDraftFromJob(job) : undefined;
                        const retryingThisJob = retryingImageJobId === job.id;
                        return (
                          <div
                            className={`rounded-[14px] border p-4 ${
                              failed ? "border-rose-400/22 bg-rose-500/10" : "border-amber-300/18 bg-amber-300/8"
                            }`}
                            key={job.id}
                            role={failed ? "alert" : "status"}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-white" title={workspaceJobTitle(job, spanishXby)}>{workspaceJobTitle(job, spanishXby)}</p>
                                <p className={`mt-1 text-xs font-semibold ${failed ? "text-rose-200" : "text-amber-100"}`}>{workspaceJobSlotStageLabel(job, slots, spanishXby)}</p>
                              </div>
                              <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                                {workspaceJobStatusBadge(job, slots)}
                              </span>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-white/54">{workspaceJobBody(job, spanishXby, slots)}</p>
                            {failed ? (
                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-rose-200/24 bg-rose-100/10 px-3 text-xs font-semibold text-rose-50 transition hover:bg-rose-100/16 disabled:cursor-not-allowed disabled:opacity-45"
                                  disabled={!rerunnable || Boolean(retryingImageJobId)}
                                  onClick={() => retryImageJob(job)}
                                  title={rerunnable
                                    ? t(spanishXby, "Create a new image request with the same saved inputs", "Crear una nueva solicitud de imagen con las mismas entradas guardadas")
                                    : t(spanishXby, "Wait for the request to finish before retrying", "Espera a que la solicitud termine antes de reintentar")}
                                  type="button"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.8} />
                                  {retryingThisJob ? t(spanishXby, "Retrying...", "Reintentando...") : t(spanishXby, "Retry", "Reintentar")}
                                </button>
                                <button
                                  className="inline-flex min-h-9 items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.06] px-3 text-xs font-semibold text-white/72 transition hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-45"
                                  disabled={!retryDraft || !rerunnable || Boolean(retryingImageJobId)}
                                  onClick={() => editAndRetryImageJob(job)}
                                  title={retryDraft
                                    ? t(spanishXby, "Restore the previous inputs so you can edit them and generate again", "Restaurar entradas anteriores para editarlas y volver a generar")
                                    : t(spanishXby, "This request no longer has saved editable inputs", "Esta solicitud ya no tiene entradas editables guardadas")}
                                  type="button"
                                >
                                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.8} />
                                  {t(spanishXby, "Edit and retry", "Editar y reintentar")}
                                </button>
                              </div>
                            ) : null}
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {slots.map((slot) => {
                                const slotSucceeded = slot.status === "succeeded";
                                const slotFailed = slot.status === "failed";
                                const slotVideo = slot.mimeType?.startsWith("video/");
                                const slotStorageKey = slot.storageKey;
                                const slotAsset = slotStorageKey ? outputAssetForSlot(slotStorageKey, outputAssets) : undefined;
                                const slotAssetCopy = slotAsset ? outputCopyForAsset(slotAsset) : undefined;
                                const slotMediaLabel = slotAsset
                                  ? generatedAssetLabel(slotAsset, slotAssetCopy)
                                  : `${workspaceJobTitle(job, false)} ${slotVideo ? "video" : "image"} ${slot.index}`;
                                const slotPreviewAsset = slotPreviewAssetFor(job, slot, outputAssets, slotMediaLabel);
                                const slotProgress = workspaceSlotProgress(slot);
                                const slotFailure = slot.providerFailure ?? normalizeVideoProviderFailure({ error: slot.error });
                                const slotErrorText = slot.error || slotFailure ? workspaceGenerationErrorText(slot.error ?? "", spanishXby, slotFailure, isVideoRuntimeJob(job)) : "";
                                return (
                                  <div
                                    className={`overflow-hidden rounded-[10px] border ${
                                      slotSucceeded
                                        ? "border-emerald-300/24 bg-emerald-300/8"
                                        : slotFailed
                                          ? "border-rose-300/24 bg-rose-300/8"
                                          : "border-white/10 bg-white/[0.035]"
                                    }`}
                                    key={`${job.id}_${slot.index}`}
                                  >
                                    {slot.storageKey || slot.previewUrl ? (
                                      slotVideo ? (
                                        renderVideoPreviewButton({
                                          mediaKey: slot.storageKey ? `slot:${normalizedWorkspaceStorageKey(slot.storageKey)}` : `slot-preview:${job.id}:${slot.index}`,
                                          label: slotMediaLabel,
                                          src: slot.storageKey ? workspaceSlotPreviewUrl(slot.storageKey) : slot.previewUrl!,
                                          fallbackPosterSrc: fallbackVideoPosterForJob(job.id),
                                          compact: true,
                                          disabled: !slotPreviewAsset,
                                          onOpen: () => {
                                            if (slotPreviewAsset) setSelectedPreviewAssetId(slotPreviewAsset.id);
                                          }
                                        })
                                      ) : (
                                        <img
                                          alt={slotMediaLabel}
                                          className="aspect-[4/3] w-full object-cover"
                                          src={slot.storageKey ? workspaceSlotPreviewUrl(slot.storageKey) : slot.previewUrl!}
                                        />
                                      )
                                    ) : (
                                      <div className="grid aspect-[4/3] place-items-center bg-black/18 px-3 text-center">
                                        <span className={`text-xs font-semibold ${slotFailed ? "text-rose-100/72" : "text-white/44"}`}>
                                          {workspaceSlotProgressText(slot, spanishXby)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                                      <span className="text-[11px] font-semibold text-white/74">{slotVideo ? "Video" : t(spanishXby, "Image", "Imagen")} {slot.index}</span>
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                                        slotSucceeded
                                          ? "bg-emerald-300/12 text-emerald-100"
                                          : slotFailed
                                            ? "bg-rose-300/12 text-rose-100"
                                            : "bg-white/8 text-white/48"
                                      }`}>
                                        {slotLabel(slot, spanishXby)}
                                      </span>
                                    </div>
                                    <div className="px-3 pb-3">
                                      <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            slotFailed
                                              ? "bg-rose-300"
                                              : slotSucceeded
                                                ? "bg-emerald-300"
                                                : `bg-[#31d4ff] ${slotProgress === undefined ? "w-1/3 animate-[admin-progress_1.05s_ease-in-out_infinite]" : ""}`
                                          }`}
                                          style={slotProgress === undefined ? undefined : { width: `${slotProgress}%` }}
                                        />
                                      </div>
                                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-white/38">
                                        <span className="truncate">{workspaceSlotProgressText(slot, spanishXby)}</span>
                                        <span className="shrink-0">
                                          {slotFailed
                                            ? t(spanishXby, "Stopped", "Detenido")
                                            : slotProgress === undefined
                                              ? t(spanishXby, "In progress", "En progreso")
                                              : `${slotProgress}%`}
                                        </span>
                                      </div>
                                      {slotFailed && slotErrorText ? (
                                        <p className="mt-1 truncate text-[10px] text-rose-100/50" title={slotErrorText}>{slotErrorText}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/38">
                              <span>{workspaceSlotSummary(slots, spanishXby)}</span>
                              <span>{t(spanishXby, "Updated", "Actualizado")} {workspaceJobTime(job.updatedAt)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {visibleResourceAssets.length ? (
                  <div className="grid auto-rows-fr gap-4 py-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                    {visibleResourceAssets.slice(0, 16).map((asset) => renderResourceAssetCard(asset))}
                  </div>
                ) : null}

                {!visibleResourceAssets.length && !runtimeIsInitializing ? (
                  <div className="grid min-h-[460px] place-items-center rounded-[2px] border border-white/6 bg-[#050506]">
                    <div className="max-w-md text-center">
                      <p className="text-base font-semibold text-white/84">
                        {resourceTab === "favorites"
                          ? t(spanishXby, "No favorite images yet", "Aun no hay imagenes favoritas")
                          : resourceTab === "recent"
                            ? t(spanishXby, "No images generated today", "Hoy no hay imagenes generadas")
                              : t(spanishXby, "No generated images yet", "Aun no hay imagenes generadas")}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/42">
                        {resourceTab === "favorites"
                          ? t(spanishXby, "Use the heart button on generated images to collect them in Favorites.", "Usa el boton de corazon en las imagenes generadas para guardarlas en Favoritos.")
                          : resourceTab === "recent"
                            ? t(spanishXby, "Recent shows only outputs created today. Older images remain available in All assets.", "Reciente muestra solo resultados creados hoy. Las imagenes anteriores siguen en Todos los recursos.")
                              : t(spanishXby, "Upload source photos in the creation flow, pick a package, then finished outputs will appear here.", "Sube fotos fuente en el flujo de creacion, elige un paquete y los resultados terminados apareceran aqui.")}
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button
                          className="rounded-[8px] border border-white/12 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.1]"
                          onClick={() => choosePanel("create", "source-photos")}
                          type="button"
                        >
                          {t(spanishXby, "Upload samples", "Subir muestras")}
                        </button>
                        <button
                          className="rounded-[8px] bg-[#2f6fed] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4380ff]"
                          onClick={() => {
                            setPreferredToolId(undefined);
                            setPreferredCreateMode("theme");
                            setPreferredCreateModeRequest((current) => current + 1);
                            setResourceTab("packages");
                            choosePanel("create", "step-create");
                          }}
                          type="button"
                        >
                          {t(spanishXby, "Pick Package", "Elegir paquete")}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      {selectedPreviewAsset ? (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-black/82 p-4" role="dialog" aria-modal="true" aria-label={t(spanishXby, "Generated asset preview", "Vista previa de recurso generado")}>
          <div className="relative grid max-h-[92vh] w-full max-w-6xl gap-3 overflow-hidden rounded-[14px] border border-white/12 bg-[#07090d] p-3 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.95)] md:grid-cols-[minmax(0,1fr)_260px]">
            <button className="absolute right-4 top-4 z-10 rounded-full border border-white/12 bg-black/40 p-2 text-white transition hover:bg-white/10" onClick={() => setSelectedPreviewAssetId(null)} type="button">
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <div className="grid min-h-[52vh] place-items-center overflow-hidden rounded-[10px] bg-black">
              {isVideoAsset(selectedPreviewAsset) ? (
                <WorkspaceVideoPreviewPlayer
                  key={selectedPreviewAsset.id}
                  label={selectedPreviewLabel}
                  posterSrc={workspaceVideoPosterUrl(workspaceAssetPreviewUrl(selectedPreviewAsset))}
                  src={workspaceVideoPlaybackUrl(workspaceAssetPreviewUrl(selectedPreviewAsset))}
                  spanish={spanishXby}
                />
              ) : (
                <img alt={selectedPreviewLabel} className="max-h-[82vh] w-full object-contain" src={workspaceAssetPreviewUrl(selectedPreviewAsset)} />
              )}
            </div>
            <aside className="grid content-between gap-4 p-2 pr-10 md:pr-2">
              <div>
                <p className="text-xs font-semibold text-white/46">{isVideoAsset(selectedPreviewAsset) ? t(spanishXby, "Generated video", "Video generado") : t(spanishXby, "Generated output", "Resultado generado")}</p>
                <h3 className="mt-2 break-words text-lg font-semibold text-white">{selectedPreviewCopy?.title ?? selectedPreviewAsset.label}</h3>
                {selectedPreviewCopy?.description ? <p className="mt-2 text-sm leading-6 text-white/58">{selectedPreviewCopy.description}</p> : null}
                <p className="mt-2 text-xs text-white/46">{spanishXby ? `${selectedPreviewIndex + 1} de ${previewableAssets.length}` : `${selectedPreviewIndex + 1} of ${previewableAssets.length}`}</p>
              </div>
              <div className="grid gap-2">
                <div className="flex gap-2">
                  <button className="inline-flex h-10 flex-1 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.1]" onClick={() => movePreview(-1)} type="button">
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <button className="inline-flex h-10 flex-1 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.1]" onClick={() => movePreview(1)} type="button">
                    <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
                <button
                  className={`inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border px-3 text-xs font-semibold transition ${
                    selectedPreviewAsset.isFavorite
                      ? "border-[#ff7ab8]/50 bg-[#ff4aa2]/90 text-white hover:bg-[#ff62ae]"
                      : "border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                  }`}
                  onClick={() => void toggleAssetFavorite(selectedPreviewAsset)}
                  type="button"
                >
                  <Heart className={`h-4 w-4 ${selectedPreviewAsset.isFavorite ? "fill-current" : ""}`} strokeWidth={1.8} />
                  {selectedPreviewAsset.isFavorite ? t(spanishXby, "Remove favorite", "Quitar favorito") : t(spanishXby, "Add favorite", "Anadir favorito")}
                </button>
                <CustomerAssetDownloadButton
                  assetId={selectedPreviewAsset.id}
                  className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#2f6fed] px-3 text-xs font-semibold text-white transition hover:bg-[#4380ff] disabled:cursor-wait disabled:opacity-60"
                  customerId={customer.id}
                  label={t(spanishXby, "Download", "Descargar")}
                  siteId={site.id}
                />
              </div>
            </aside>
          </div>
        </div>
      ) : null}
      {sampleDeleteConfirm ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/78 p-4" role="dialog" aria-modal="true" aria-label={t(spanishXby, "Confirm sample deletion", "Confirmar eliminacion de muestra")}>
          <div className="w-full max-w-sm rounded-[16px] border border-white/14 bg-[#090b10] p-5 text-white shadow-[0_30px_100px_-42px_rgba(0,0,0,0.95)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200/70">{t(spanishXby, "Confirm delete", "Confirmar eliminacion")}</p>
            <h3 className="mt-2 text-lg font-semibold">
              {spanishXby
                ? `Eliminar ${sampleDeleteConfirm.assets.length === 1 ? "esta muestra" : `${sampleDeleteConfirm.assets.length} muestras`}?`
                : `Delete ${sampleDeleteConfirm.assets.length === 1 ? "this sample" : `${sampleDeleteConfirm.assets.length} samples`}?`}
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/58">
              {spanishXby
                ? `Esto elimina ${sampleDeleteConfirm.assets.length === 1 ? "la muestra seleccionada" : "las muestras seleccionadas"} de tu cuenta privada y de ${sampleDeleteConfirm.label}. No se puede deshacer.`
                : `This removes the selected sample${sampleDeleteConfirm.assets.length === 1 ? "" : "s"} from your private account and from ${sampleDeleteConfirm.label}. This cannot be undone.`}
            </p>
            <div className="mt-5 flex gap-2">
              <button
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                onClick={() => setSampleDeleteConfirm(null)}
                type="button"
              >
                {t(spanishXby, "Cancel", "Cancelar")}
              </button>
              <button
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-[10px] border border-rose-300/25 bg-rose-500/18 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/25"
                onClick={() => {
                  const assetsToDelete = sampleDeleteConfirm.assets;
                  setSampleDeleteConfirm(null);
                  void deleteSamples(assetsToDelete);
                }}
                type="button"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                {t(spanishXby, "Delete", "Eliminar")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {previewSample ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/84 p-4" role="dialog" aria-modal="true" aria-label={t(spanishXby, "Uploaded sample preview", "Vista previa de muestra subida")}>
          <div className="relative grid max-h-[92vh] w-full max-w-6xl gap-3 overflow-hidden rounded-[14px] border border-white/12 bg-[#07090d] p-3 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.95)] md:grid-cols-[minmax(0,1fr)_280px]">
            <button className="absolute right-4 top-4 z-10 rounded-full border border-white/12 bg-black/45 p-2 text-white transition hover:bg-white/10" onClick={() => setPreviewSampleId(null)} type="button">
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <div className="grid min-h-[52vh] place-items-center overflow-hidden rounded-[10px] bg-black">
              <img alt={uploadedSampleLabel(previewSample)} className="max-h-[82vh] w-full object-contain" src={sourceSamplePreviewUrl(previewSample)} />
            </div>
            <aside className="grid content-between gap-4 p-2 pr-10 md:pr-2">
              <div>
                <p className="text-xs font-semibold text-white/46">{t(spanishXby, "Uploaded sample", "Muestra subida")}</p>
                <h3 className="mt-2 break-words text-lg font-semibold text-white">{previewSample.label}</h3>
                <p className="mt-2 text-xs text-white/46">{spanishXby ? `${previewSampleIndex + 1} de ${previewSamples.length}` : `${previewSampleIndex + 1} of ${previewSamples.length}`}</p>
                {previewSample.localStatus === "uploading" ? <p className="mt-3 rounded-[8px] border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/64">{t(spanishXby, "Upload is still finishing. Preview is available now.", "La subida aun esta terminando. La vista previa ya esta disponible.")}</p> : null}
              </div>
              <div className="grid gap-2">
                <div className="flex gap-2">
                  <button className="inline-flex h-10 flex-1 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.1]" onClick={() => moveSamplePreview(-1)} type="button">
                    <ChevronLeft className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                  <button className="inline-flex h-10 flex-1 items-center justify-center rounded-[8px] border border-white/12 bg-white/[0.06] text-white hover:bg-white/[0.1]" onClick={() => moveSamplePreview(1)} type="button">
                    <ChevronRight className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-[8px] border border-rose-300/25 bg-rose-500/12 px-3 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/18 disabled:cursor-wait disabled:opacity-55"
                  disabled={deletingSampleId === previewSample.id || previewSample.localStatus === "uploading"}
                  onClick={() => void deleteSample(previewSample)}
                  type="button"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                  {deletingSampleId === previewSample.id ? t(spanishXby, "Deleting", "Eliminando") : t(spanishXby, "Delete sample", "Eliminar muestra")}
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
