import "server-only";
import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma, runPrismaWriteWithReconnect } from "@/lib/prisma";
import { normalizePlatformAiProviderType, platformProviderTypeForAppType, type PlatformAiProviderType } from "@/lib/ai-provider-type";
import { customerAssetFileExists, hasRemoteCustomerAssetReadSource } from "@/lib/customer-asset-storage";
import type { AiProviderConfig, AiWorkflowConfig, AiWorkflowField, CreditLedgerEntry, Customer, GenerationEntryPoint, GenerationJob, SiteAiApp } from "@/lib/types";
import { generatedOutputCopy, generationThemeLabel } from "@/lib/generation-output-labels";
import { StoreError } from "@/lib/server-store";
import { addAuditLogRelational, mapCreditLedger, mapCustomer, mapGenerationJob, mapSiteAiApp } from "@/lib/stores/prisma-mappers";
import { AUTO_VIDEO_MODEL_FAMILY, CUSTOMER_VIDEO_FRAME_LIMIT, normalizeVideoDurationSecondsForFrameCount, normalizeVideoFrameLimit, normalizeVideoModelPreference, normalizeVideoResolution, videoDurationCreditCost, videoDurationCreditCostForModelFamilies, videoResolutionCreditCost, type VideoModelPreference } from "@/lib/video-frame-config";
import { videoProviderAvailability } from "@/lib/video-provider-availability";
import { videoProviderMatchesModelPreference, videoProviderModelFamilyForProvider } from "@/lib/video-provider-family";
import { configuredVideoProviderFrameLimit, effectiveVideoFrameLimit } from "@/lib/video-provider-limits";
import { firstVideoTrialAppliesToProvider, providerCreditsForRequest, selectBillingProvider } from "@/lib/ai-provider-billing";
import { consumeFirstVideoOfferTx } from "@/lib/stores/first-video-offer-store";
import { isGeminiVideoFrameMimeType, type VideoProviderFailure } from "@/lib/video-provider-policy";
import { videoProviderCreateTimeoutMs, videoProviderWorkerTimeoutMs } from "@/lib/video-provider-timeouts";
import type { WorkerOutputSlot } from "@/lib/worker";

type Tx = Prisma.TransactionClient;
type JobSubscriptionBypass = {
  enabled: boolean;
  reason: "site_admin";
  siteAdminId?: string;
};
const jobStoreTimeoutMs = Math.max(5000, Number(process.env.AI_JOB_STORE_TIMEOUT_MS ?? "60000") || 60000);
const jobStoreTransactionOptions = { timeout: jobStoreTimeoutMs, maxWait: Math.min(5000, jobStoreTimeoutMs) };
const DEFAULT_MAX_SOURCE_ASSETS = 15;
const LEGACY_WORKFLOW_MAX_SOURCE_ASSETS = 4;
const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];
const MIN_ACTIVE_JOB_STALE_MS = 5 * 60_000;

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
}

async function withJobStoreTimeout<T>(operation: Promise<T>, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new StoreError(message, 504)), jobStoreTimeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function toPrismaJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function mergeResultTiming(previousResult: Record<string, unknown>, timing?: Record<string, string>): Record<string, string> | undefined {
  const previousTiming = previousResult.timing && typeof previousResult.timing === "object" && !Array.isArray(previousResult.timing)
    ? previousResult.timing as Record<string, unknown>
    : {};
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(previousTiming)) {
    if (typeof value === "string" && value) merged[key] = value;
  }
  for (const [key, value] of Object.entries(timing ?? {})) {
    if (typeof value === "string" && value) merged[key] = value;
  }
  return Object.keys(merged).length ? merged : undefined;
}

function replaceStorageKeyInResultRecords(value: unknown, params: { originalStorageKey: string; storageKey: string; mimeType: string; updatedAt: string }): { value: unknown; changed: boolean } {
  if (!Array.isArray(value)) return { value, changed: false };
  let changed = false;
  const next = value.map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    if (record.storageKey !== params.originalStorageKey) return entry;
    changed = true;
    return {
      ...record,
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      originalStorageKey: params.originalStorageKey,
      optimizedAt: params.updatedAt,
      updatedAt: typeof record.updatedAt === "string" ? record.updatedAt : params.updatedAt
    };
  });
  return { value: next, changed };
}

function resultString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function settledOutputStage(outputs: Array<{ storageKey: string; mimeType?: string }>): string {
  return outputs.some((output) => output.mimeType?.startsWith("video/"))
    ? "video_result_received"
    : "provider_response_received";
}

function settledOutputSlots(
  previousResult: Record<string, unknown>,
  outputs: Array<{ storageKey: string; mimeType?: string }>,
  params: {
    outputSlots?: WorkerOutputSlot[];
    providerTaskId?: string;
    settledAt: string;
  }
): WorkerOutputSlot[] | undefined {
  const hasVideoOutputs = outputs.some((output) => output.mimeType?.startsWith("video/"));
  if (!hasVideoOutputs && !params.outputSlots?.length) return undefined;
  const slotsByIndex = new Map<number, WorkerOutputSlot>();
  const previousSlots = Array.isArray(previousResult.outputSlots)
    ? previousResult.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  for (const slot of previousSlots) {
    const index = Number(slot.index);
    if (!Number.isFinite(index) || index < 1) continue;
    slotsByIndex.set(Math.trunc(index), slot as unknown as WorkerOutputSlot);
  }
  for (const slot of params.outputSlots ?? []) {
    if (!Number.isFinite(slot.index) || slot.index < 1) continue;
    const index = Math.trunc(slot.index);
    slotsByIndex.set(index, {
      ...(slotsByIndex.get(index) ?? { index }),
      ...slot,
      index,
      updatedAt: slot.updatedAt ?? params.settledAt
    });
  }
  outputs.forEach((output, outputIndex) => {
    const index = outputIndex + 1;
    const previous = slotsByIndex.get(index);
    slotsByIndex.set(index, {
      ...(previous ?? { index }),
      index,
      status: "succeeded",
      stage: output.mimeType?.startsWith("video/") ? "video_result_received" : "provider_response_received",
      progress: 100,
      storageKey: output.storageKey,
      mimeType: output.mimeType,
      error: "",
      providerTaskId: params.providerTaskId ?? previous?.providerTaskId,
      updatedAt: params.settledAt
    });
  });
  return Array.from(slotsByIndex.values()).sort((left, right) => left.index - right.index);
}

function settledLastWorkerStage(previousResult: Record<string, unknown>, params: { status: "succeeded" | "failed"; outputs: Array<{ storageKey: string; mimeType?: string }> }): string {
  if (params.status === "succeeded" && params.outputs.length) return settledOutputStage(params.outputs);
  return typeof previousResult.lastWorkerStage === "string" ? previousResult.lastWorkerStage : params.status;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
    .join(",")}}`;
}

export function generationRequestHash(params: { aiAppSlug: string; requestJson?: Record<string, unknown> }): string {
  return crypto
    .createHash("sha256")
    .update(stableJson({
      aiAppSlug: params.aiAppSlug,
      requestJson: params.requestJson ?? {}
    }))
    .digest("hex");
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === code);
}

async function lockCustomerGenerationSubmit(tx: Tx, params: { siteId: string; customerId: string }): Promise<void> {
  // Keep the blocking lock out of the result set; Prisma cannot deserialize Postgres `void` columns.
  await tx.$queryRaw<{ locked: boolean }[]>`
    WITH lock_customer_generation AS (
      SELECT pg_advisory_xact_lock(hashtext(${`generation:${params.siteId}`}), hashtext(${params.customerId}))
    )
    SELECT true AS locked FROM lock_customer_generation
  `;
}

function cleanRerunRequest(value: Prisma.JsonValue): Record<string, unknown> {
  const request = value && typeof value === "object" && !Array.isArray(value) ? { ...(value as Record<string, unknown>) } : {};
  delete request.lastWorkerStatus;
  delete request.lastWorkerStage;
  return request;
}

function jsonObject<T>(value: Prisma.JsonValue | null | undefined): T | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return JSON.parse(JSON.stringify(value)) as T;
}

function defaultWorkflowConfig(siteAiApp: { aiApp: { name: string; description: string; parameterSchema: Prisma.JsonValue } }): AiWorkflowConfig {
  const parameterSchema = Array.isArray(siteAiApp.aiApp.parameterSchema)
    ? siteAiApp.aiApp.parameterSchema as Array<{ id: string; label: string; type: "text" | "select"; options?: string[] }>
    : [];
  const fields: AiWorkflowField[] = parameterSchema.map((field) => field.type === "select"
    ? {
        id: field.id,
        label: field.label,
        type: "select",
        required: true,
        options: (field.options ?? []).map((option) => ({ label: option, value: option })),
        default: field.options?.[0] ?? ""
      }
    : {
        id: field.id,
        label: field.label,
        type: "text",
        required: true,
        default: ""
      });
  return {
    version: 1,
    flowName: siteAiApp.aiApp.name,
    description: siteAiApp.aiApp.description,
    submitLabel: "Start generation",
    promptTemplate: "Create a private image generation for {{flowName}} using {{fields}} and the selected source photos.",
    steps: [
      { id: "source_photos", title: "Select source photos", kind: "asset_select", assetRules: { min: 1, max: DEFAULT_MAX_SOURCE_ASSETS, roles: ["input"], accept: ["image/*"], required: true } },
      { id: "generation_options", title: "Set generation options", kind: "fields", fields },
      { id: "review_request", title: "Review request", kind: "review" }
    ]
  };
}

function workflowFields(workflow: AiWorkflowConfig): AiWorkflowField[] {
  return workflow.steps.flatMap((step) => step.kind === "fields" ? step.fields ?? [] : []);
}

function assetRules(workflow: AiWorkflowConfig) {
  return workflow.steps.find((step) => step.kind === "asset_select")?.assetRules ?? { min: 1, max: DEFAULT_MAX_SOURCE_ASSETS };
}

function maxAssetsForWorkflow(workflow: AiWorkflowConfig): number {
  const configuredMax = assetRules(workflow).max;
  if (!configuredMax || configuredMax <= 0 || configuredMax === LEGACY_WORKFLOW_MAX_SOURCE_ASSETS) {
    return DEFAULT_MAX_SOURCE_ASSETS;
  }
  return Math.min(configuredMax, DEFAULT_MAX_SOURCE_ASSETS);
}

function isThemeModeRequest(requestJson?: Record<string, unknown>): boolean {
  return requestJson?.mode === "theme" || typeof requestJson?.creativePackId === "string";
}

function isWorkspaceJobRequest(value: unknown): boolean {
  return Boolean(jsonObject<Record<string, unknown>>(value as Prisma.JsonValue | null | undefined)?.workspace);
}

function isVideoModeRequest(requestJson?: Record<string, unknown>): boolean {
  const fields = fieldRecord(requestJson);
  return requestJson?.mode === "video" ||
    requestJson?.outputType === "video" ||
    typeof requestJson?.videoThemeId === "string" ||
    fields.mode === "video" ||
    fields.outputType === "video" ||
    typeof fields.videoThemeId === "string";
}

function videoProviderTaskIdFromResult(jobResult?: Record<string, unknown>): string | undefined {
  if (typeof jobResult?.providerTaskId === "string" && jobResult.providerTaskId.trim()) return jobResult.providerTaskId;
  const outputSlots = Array.isArray(jobResult?.outputSlots)
    ? jobResult.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  for (const slot of outputSlots) {
    if (typeof slot.providerTaskId === "string" && slot.providerTaskId.trim()) return slot.providerTaskId;
  }
  return undefined;
}

function runningVideoProviderStageWithoutTaskId(jobResult: Record<string, unknown> | undefined, stages: readonly string[]): boolean {
  if (videoProviderTaskIdFromResult(jobResult)) return false;
  if (jobResult?.lastWorkerStatus !== "running") return false;
  if (typeof jobResult.lastWorkerStage === "string" && stages.includes(jobResult.lastWorkerStage)) return true;
  const outputSlots = Array.isArray(jobResult.outputSlots)
    ? jobResult.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  return outputSlots.some((slot) => slot.status === "running" && typeof slot.stage === "string" && stages.includes(slot.stage));
}

function videoProviderCreateStartedWithoutTaskId(jobResult?: Record<string, unknown>): boolean {
  return runningVideoProviderStageWithoutTaskId(jobResult, ["video_provider_create_started"]);
}

function videoProviderRequestStartedWithoutTaskId(jobResult?: Record<string, unknown>): boolean {
  return runningVideoProviderStageWithoutTaskId(jobResult, [
    "video_provider_request_started",
    "video_reference_format_ready"
  ]);
}

const VIDEO_PROVIDER_PROGRESS_STALL_MIN_MS = 5 * 60_000;

function videoProviderProgressStallMs(): number {
  const configured = Number(process.env.AI_VIDEO_PROVIDER_PROGRESS_STALL_MS ?? "");
  if (Number.isFinite(configured) && configured > 0) return Math.max(VIDEO_PROVIDER_PROGRESS_STALL_MIN_MS, Math.trunc(configured));
  return 15 * 60_000;
}

/**
 * Newest progress heartbeat across running provider slots (ms since the last
 * one), or 0 when no running slot reports a timestamp. The stale sweep uses
 * this so a silent provider cannot hold a customer's reserved credits until
 * the full worker timeout (24h by default) elapses.
 */
function videoProviderProgressSilentMs(jobResult?: Record<string, unknown>): number {
  const slots = Array.isArray(jobResult?.outputSlots)
    ? (jobResult.outputSlots as unknown[]).filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  const runningUpdatedAt = slots
    .filter((slot) => slot.status === "running" && typeof slot.updatedAt === "string")
    .map((slot) => Date.parse(slot.updatedAt as string))
    .filter((time) => Number.isFinite(time));
  if (!runningUpdatedAt.length) return 0;
  return Math.max(0, Date.now() - Math.max(...runningUpdatedAt));
}

function videoProviderCreateOrphanStaleMs(timeoutMs: number): number {
  const configured = Number(process.env.AI_VIDEO_PROVIDER_CREATE_STALE_MS ?? "");
  if (Number.isFinite(configured) && configured > 0) return Math.max(MIN_ACTIVE_JOB_STALE_MS, Math.trunc(configured));
  const videoCreateTimeoutMs = videoProviderCreateTimeoutMs();
  return Math.max(MIN_ACTIVE_JOB_STALE_MS, Math.min(videoCreateTimeoutMs, timeoutMs) + 2 * 60_000);
}

function videoProviderRequestOrphanStaleMs(timeoutMs: number): number {
  const configured = Number(process.env.AI_VIDEO_PROVIDER_REQUEST_STALE_MS ?? "");
  if (Number.isFinite(configured) && configured > 0) return Math.max(MIN_ACTIVE_JOB_STALE_MS, Math.trunc(configured));
  return videoProviderCreateOrphanStaleMs(timeoutMs);
}

function activeJobStaleMs(jobRequest?: Record<string, unknown>, jobResult?: Record<string, unknown>): number {
  const genericStaleMs = Math.max(MIN_ACTIVE_JOB_STALE_MS, Number(process.env.AI_JOB_ACTIVE_STALE_MS ?? "480000") || 480_000);
  if (!isVideoModeRequest(jobRequest)) return genericStaleMs;
  const videoWorkerTimeoutMs = videoProviderWorkerTimeoutMs();
  const videoCreateTimeoutMs = videoProviderCreateTimeoutMs();
  if (videoProviderCreateStartedWithoutTaskId(jobResult)) return videoProviderCreateOrphanStaleMs(videoWorkerTimeoutMs);
  if (videoProviderRequestStartedWithoutTaskId(jobResult)) return videoProviderRequestOrphanStaleMs(videoWorkerTimeoutMs);
  const configuredVideoStaleMs = Number(process.env.AI_VIDEO_JOB_ACTIVE_STALE_MS ?? "");
  const defaultVideoStaleMs = videoWorkerTimeoutMs + videoCreateTimeoutMs + 5 * 60_000;
  return Math.max(
    genericStaleMs,
    defaultVideoStaleMs,
    Number.isFinite(configuredVideoStaleMs) && configuredVideoStaleMs > 0 ? Math.trunc(configuredVideoStaleMs) : 0
  );
}

function resultStringRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" && entry.trim()) result[key] = entry;
  }
  return Object.keys(result).length ? result : undefined;
}

function deliveredVideoResultFromActiveJob(job: Pick<Prisma.GenerationJobGetPayload<object>, "requestJson" | "resultJson">): {
  outputs: Array<{ storageKey: string; mimeType?: string }>;
  outputSlots: WorkerOutputSlot[];
  providerTaskId?: string;
  timing?: Record<string, string>;
} | undefined {
  const jobRequest = jsonObject<Record<string, unknown>>(job.requestJson) ?? {};
  if (!isVideoModeRequest(jobRequest) && !jobRequest.videoTheme) return undefined;
  const previousResult = jsonObject<Record<string, unknown>>(job.resultJson) ?? {};
  const slots = Array.isArray(previousResult.outputSlots)
    ? previousResult.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  const deliveredSlots: WorkerOutputSlot[] = [];
  for (const slot of slots) {
    const index = Number(slot.index);
    const storageKey = resultString(slot.storageKey);
    const mimeType = resultString(slot.mimeType);
    if (slot.status !== "succeeded") continue;
    if (!Number.isFinite(index) || index < 1) continue;
    if (!storageKey || !mimeType.startsWith("video/")) continue;
    if (!customerAssetFileExists(storageKey) && !hasRemoteCustomerAssetReadSource()) continue;
    deliveredSlots.push({
      ...(slot as unknown as WorkerOutputSlot),
      index: Math.trunc(index),
      status: "succeeded",
      stage: resultString(slot.stage) || "video_result_received",
      progress: 100,
      storageKey,
      mimeType,
      error: "",
      providerTaskId: resultString(slot.providerTaskId) || undefined,
      updatedAt: resultString(slot.updatedAt) || new Date().toISOString()
    });
  }
  if (!deliveredSlots.length) return undefined;
  deliveredSlots.sort((left, right) => left.index - right.index);
  const billing = jobRequest.billing && typeof jobRequest.billing === "object" && !Array.isArray(jobRequest.billing)
    ? jobRequest.billing as Record<string, unknown>
    : {};
  const requestedOutputs = Math.max(1, Math.trunc(Number(billing.outputCount) || 1));
  if (deliveredSlots.length < requestedOutputs) return undefined;
  const selectedSlots = deliveredSlots.slice(0, requestedOutputs);
  return {
    outputs: selectedSlots.map((slot) => ({ storageKey: slot.storageKey!, mimeType: slot.mimeType })),
    outputSlots: selectedSlots,
    providerTaskId: videoProviderTaskIdFromResult(previousResult),
    timing: resultStringRecord(previousResult.timing)
  };
}

function isThemeManagedField(field: AiWorkflowField): boolean {
  const id = field.id.toLowerCase().replace(/[_-]/g, "");
  const label = field.label.toLowerCase();
  return id === "style" || id === "prompt" || id === "outputcount" || label.includes("style");
}

function normalizePromptInputs(requestJson?: Record<string, unknown>): Record<string, string | number | boolean> {
  const fields = requestJson?.fields;
  if (fields && typeof fields === "object" && !Array.isArray(fields)) {
    return Object.fromEntries(
      Object.entries(fields as Record<string, unknown>).filter((entry): entry is [string, string | number | boolean] =>
        typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"
      )
    );
  }
  return Object.fromEntries(
    Object.entries(requestJson ?? {}).filter((entry): entry is [string, string | number | boolean] =>
      typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean"
    )
  );
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function requestedAssetIdsForRequest(requestJson: Record<string, unknown> | undefined, videoMode: boolean): string[] {
  const fields = fieldRecord(requestJson);
  const primaryAssetIds = stringArray(fields.primaryAssetIds ?? requestJson?.primaryAssetIds);
  const partnerAssetIds = stringArray(fields.partnerAssetIds ?? requestJson?.partnerAssetIds);
  return Array.from(new Set([
    ...stringArray(requestJson?.assetIds),
    ...(videoMode ? stringArray(fields.frameAssetIds) : [...primaryAssetIds, ...partnerAssetIds])
  ]));
}

function requestedOutputCount(requestJson?: Record<string, unknown>): number {
  const fields = fieldRecord(requestJson);
  const raw = Number(fields.outputCount ?? requestJson?.outputCount ?? 1);
  if (!Number.isFinite(raw) || raw <= 0) return 1;
  return Math.max(1, Math.min(Math.trunc(raw), 20));
}

function fieldRecord(requestJson?: Record<string, unknown>): Record<string, unknown> {
  const fields = requestJson?.fields;
  return fields && typeof fields === "object" && !Array.isArray(fields) ? fields as Record<string, unknown> : {};
}

function imageCoupleSourceGroupsMissing(requestJson: Record<string, unknown> | undefined, videoMode: boolean): boolean {
  if (videoMode) return false;
  const fields = fieldRecord(requestJson);
  const trainingMode = String(fields.trainingMode ?? requestJson?.trainingMode ?? "").toLowerCase();
  if (trainingMode !== "couple") return false;
  const primaryAssetIds = stringArray(fields.primaryAssetIds ?? requestJson?.primaryAssetIds);
  const partnerAssetIds = stringArray(fields.partnerAssetIds ?? requestJson?.partnerAssetIds);
  return primaryAssetIds.length < 1 || partnerAssetIds.length < 1;
}

function subjectCompositionInstruction(requestJson: Record<string, unknown> | undefined, requestedAssetIds: string[]): string {
  const fields = fieldRecord(requestJson);
  const packageAudience = String(fields.packageAudience ?? requestJson?.packageAudience ?? "").toLowerCase();
  const trainingMode = String(fields.trainingMode ?? requestJson?.trainingMode ?? "").toLowerCase();
  const primaryAssetIds = stringArray(fields.primaryAssetIds ?? requestJson?.primaryAssetIds);
  const partnerAssetIds = stringArray(fields.partnerAssetIds ?? requestJson?.partnerAssetIds);
  const wantsTwoPeople =
    packageAudience === "both" ||
    packageAudience.includes("both") ||
    trainingMode === "couple" ||
    partnerAssetIds.length > 0;

  if (wantsTwoPeople) {
    const subjectSource = primaryAssetIds.length && partnerAssetIds.length
      ? "Use the primary selected photos and partner selected photos as separate source groups. Preserve every clear adult person visible across those groups instead of limiting the output to one person per group."
      : "Use the selected source photos as references for a natural group when multiple clear people are visible.";
    return [
      "Subject requirement: the final image must show all clear adult people from the selected source photos together in the same frame.",
      subjectSource,
      "Keep all selected reference groups represented. Do not let one uploaded image supply the whole final group.",
      "If the primary selected photo shows two clear people and the partner selected photo shows one clear person, the final travel photo should show three adults together.",
      "Do not create a solo portrait, single-person crop, collage, split panel, or contact sheet."
    ].join(" ");
  }

  if (packageAudience === "partner") {
    return "Subject requirement: focus the final image on the partner subject from the selected partner photos when available. Do not add extra people unless requested.";
  }

  if (requestedAssetIds.length > 1) {
    return "Subject requirement: use the selected source photos as references for one coherent primary subject unless the request explicitly asks for two people.";
  }

  return "Subject requirement: create one final portrait of the primary subject.";
}

type GenerationCreativePack = Pick<Prisma.CreativePackGetPayload<object>, "id" | "name" | "headline" | "category" | "aiAppSlug" | "prompt" | "creditCost" | "outputCount">;
type GenerationVideoTheme = Pick<Prisma.VideoThemeGetPayload<object>, "id" | "categoryId" | "slug" | "name" | "headline" | "description" | "prompt" | "creditCost" | "modelPricing" | "durationSeconds" | "maxFrames" | "imageUrl"> & {
  category?: { slug: string; label: string } | null;
};

function safeCreativePrompt(value: string): string {
  return value
    .replace(/create a coherent \d+[- ]image package[^.]*\./gi, "Create one standalone image for this package slot.")
    .replace(/create a coherent [a-z]+[- ]image package[^.]*\./gi, "Create one standalone image for this package slot.")
    .replace(/\b\d+[- ]image package\b/gi, "single-image package slot")
    .replace(/\bfull set\b/gi, "single package slot")
    .replace(/varied poses, camera distances, and compositions/gi, "one clear pose, one camera distance, and one composition")
    .replace(/no collage unless[^.]*\./gi, "No collage, no grid, no contact sheet, no split panels.")
    .replace(/keeps? the subject recognizable[^.]*\./gi, "Use the uploaded image only as a broad style, pose, color, and composition reference, without recreating or verifying any real person's identity.")
    .replace(/key facial features/gi, "general portrait styling")
    .replace(/overall identity/gi, "overall mood")
    .replace(/identity consistency/gi, "style consistency")
    .replace(/recognizable identity/gi, "coherent styling");
}

function defaultCreativePrompt(creativePack?: GenerationCreativePack | null): string {
  if (!creativePack) return "";
  if (creativePack.prompt?.trim()) return safeCreativePrompt(creativePack.prompt.trim());
  if (creativePack.category === "anime-avatar") {
    return "Use the uploaded image only as a broad style, pose, color, and composition reference. Create an original anime-inspired avatar with expressive eyes, polished digital illustration finish, tasteful outfit styling, vibrant but controlled color palette, high-detail linework, and soft shading. Do not recreate or verify any real person's identity.";
  }
  return "";
}

function defaultVideoThemePrompt(videoTheme?: GenerationVideoTheme | null): string {
  return videoTheme?.prompt?.trim() ?? "";
}

function videoPromptText(requestJson: Record<string, unknown> | undefined): string {
  const fields = fieldRecord(requestJson);
  const fieldPrompt = typeof fields.promptNote === "string" && fields.promptNote.trim()
    ? fields.promptNote.trim()
    : typeof fields.prompt === "string" && fields.prompt.trim()
      ? fields.prompt.trim()
      : "";
  if (fieldPrompt) return fieldPrompt;
  if (typeof requestJson?.promptNote === "string" && requestJson.promptNote.trim()) return requestJson.promptNote.trim();
  if (typeof requestJson?.prompt === "string" && requestJson.prompt.trim()) return requestJson.prompt.trim();
  return "";
}

function requestedVideoModelPreference(requestJson: Record<string, unknown> | undefined): VideoModelPreference {
  const fields = fieldRecord(requestJson);
  return normalizeVideoModelPreference(
    fields.videoModelFamily ??
    fields.modelFamily ??
    requestJson?.videoModelFamily ??
    requestJson?.modelFamily,
    AUTO_VIDEO_MODEL_FAMILY
  );
}

function videoPromptRequiresFrameImages(prompt: string): boolean {
  const text = prompt.trim().toLowerCase();
  if (!text) return false;
  return /上传.{0,12}(图片|照片|图像|素材|参考图)|根据.{0,12}(图片|照片|图像|素材|参考图)|这(张|个|些).{0,8}(图片|照片|图像|素材|参考图)|图中|照片中|uploaded.{0,24}(image|photo|frame|picture)|selected.{0,24}(image|photo|frame|picture)|reference.{0,24}(image|photo|frame|picture)|source.{0,24}(image|photo|frame|picture)/i.test(text);
}

function isRenderablePromptField(key: string) {
  return ![
    "assetIds",
    "creativePackId",
    "creativePackName",
    "creativePackPrompt",
    "customerModelId",
    "customerModelLabel",
    "packageAudience",
    "packagePrompt",
    "partnerAssetIds",
    "primaryAssetIds",
    "promptBuilder",
    "outputCount",
    "rerunOf",
    "rerunBy",
    "toolPresetId",
    "toolPresetTitle",
    "trainingMode",
    "userDirection",
    "videoThemeId",
    "videoThemeExampleId",
    "videoThemeSlug",
    "videoThemeName",
    "videoThemeExampleName",
    "videoThemeCategoryLabel",
    "videoThemePrompt",
    "videoModelFamily",
    "modelFamily",
    "modelOverride",
    "frameAssetIds"
  ].includes(key);
}

function textField(fields: Record<string, unknown>, key: string): string {
  const value = fields[key];
  return typeof value === "string" ? value.trim() : "";
}

function imageCreativeDirectionInstruction(requestJson: Record<string, unknown> | undefined): string {
  const fields = fieldRecord(requestJson);
  const userDirection = textField(fields, "userDirection") || textField(fields, "packagePrompt");
  const promptBuilder = textField(fields, "promptBuilder");
  const modelLabel = textField(fields, "customerModelLabel");
  const audience = textField(fields, "packageAudience");
  return [
    userDirection ? `User creative direction: ${userDirection}` : "",
    promptBuilder ? `Shot planning cues: ${promptBuilder}. Use these as camera, scene, lighting, and finish guidance, not as visible text.` : "",
    modelLabel ? `Customer model/reference label: ${modelLabel}.` : "",
    audience ? `Audience intent: ${audience}.` : "",
    "Image prompt structure: combine the selected package theme, source-photo references, user direction, and shot cues into one coherent photorealistic image.",
    "Photography requirements: clear subject hierarchy, believable camera perspective, natural skin texture, sharp facial detail where faces are visible, controlled background depth, realistic hands and limbs, clean composition.",
    "Output constraints: one finished image only; no text, captions, watermarks, UI, split panels, collages, contact sheets, or duplicate faces."
  ].filter(Boolean).join("\n");
}

function renderPrompt(template: string | undefined, context: { flowName: string; fields: Record<string, string | number | boolean>; assetCount: number; themeName?: string; themePrompt?: string }): string {
  const fieldText = Object.entries(context.fields)
    .filter(([key]) => isRenderablePromptField(key))
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join("; ");
  const source = template?.trim() || "Create {{flowName}} using {{fields}} with {{assetCount}} selected source photos.";
  return source
    .replaceAll("{{flowName}}", context.flowName)
    .replaceAll("{{fields}}", fieldText)
    .replaceAll("{{assetCount}}", String(context.assetCount))
    .replaceAll("{{themeName}}", context.themeName ?? "")
    .replaceAll("{{themePrompt}}", context.themePrompt ?? "");
}

function resolveGenerationRequest(params: {
  requestJson?: Record<string, unknown>;
  siteAiApp: Prisma.SiteAiAppGetPayload<{ include: { aiApp: true } }>;
  requestedAssetIds: string[];
  creativePack?: GenerationCreativePack | null;
  videoTheme?: GenerationVideoTheme | null;
}) {
  const workflow = jsonObject<AiWorkflowConfig>(params.siteAiApp.workflowConfig) ?? defaultWorkflowConfig(params.siteAiApp);
  const provider = jsonObject<AiProviderConfig>(params.siteAiApp.providerConfig) ?? { mode: "platform_fallback", fallbackEnabled: true };
  const themeMode = isThemeModeRequest(params.requestJson);
  const videoMode = isVideoModeRequest(params.requestJson) || Boolean(params.videoTheme);
  const fields = normalizePromptInputs(params.requestJson);
  const missingField = workflowFields(workflow).find((field) =>
    field.required &&
    !((themeMode || videoMode) && isThemeManagedField(field)) &&
    (fields[field.id] === undefined || fields[field.id] === "")
  );
  if (missingField) throw new StoreError("missing_required_prompt_input", 400);
  const rules = assetRules(workflow);
  const minAssets = videoMode ? 0 : rules.min ?? 1;
  const maxAssets = videoMode ? CUSTOMER_VIDEO_FRAME_LIMIT : maxAssetsForWorkflow(workflow);
  if (params.requestedAssetIds.length < minAssets) throw new StoreError("not_enough_source_assets", 400);
  if (params.requestedAssetIds.length > maxAssets) throw new StoreError("too_many_source_assets", 400);
  const flowName = workflow.flowName ?? params.siteAiApp.aiApp.name;
  const themePrompt = params.videoTheme ? defaultVideoThemePrompt(params.videoTheme) : defaultCreativePrompt(params.creativePack);
  const basePrompt = renderPrompt(workflow.promptTemplate, {
    flowName,
    fields,
    assetCount: params.requestedAssetIds.length,
    themeName: params.videoTheme?.name ?? params.creativePack?.name,
    themePrompt
  });
  const subjectInstruction = subjectCompositionInstruction(params.requestJson, params.requestedAssetIds);
  const videoUserPrompt = params.videoTheme ? videoPromptText(params.requestJson) : "";
  const videoFrameInstruction = params.videoTheme && params.requestedAssetIds.length
    ? `Selected video frame asset IDs: ${params.requestedAssetIds.join(", ")}`
    : "";
  const videoReferenceContract = "";
  const videoSkillPackQuality = "";
  const videoFormatSummary = params.videoTheme
    ? [
        fields.durationSeconds || fields.videoDurationSeconds || fields.duration ? `Duration: ${String(fields.durationSeconds || fields.videoDurationSeconds || fields.duration)}s` : "",
        fields.aspectRatio || fields.aspect_ratio ? `Aspect ratio: ${String(fields.aspectRatio || fields.aspect_ratio)}` : "",
        fields.resolution ? `Resolution: ${String(fields.resolution)}` : ""
      ].filter(Boolean).join("; ")
    : "";
  const imageCreativeDirection = params.videoTheme ? "" : imageCreativeDirectionInstruction(params.requestJson);
  const directPromptJob = (params.requestJson?.workspace as { direct?: boolean } | undefined)?.direct === true;
  const renderedPrompt = params.videoTheme
    ? directPromptJob
      ? videoUserPrompt
      : [
          videoUserPrompt,
          videoFrameInstruction,
          `Selected video theme: ${params.videoTheme.name}`,
          params.videoTheme.category?.label ? `Video category: ${params.videoTheme.category.label}` : "",
          videoFormatSummary
        ].filter(Boolean).join("\n\n")
    : themePrompt
      ? `${basePrompt}\n\n${subjectInstruction}\n\n${imageCreativeDirection}\n\nSelected creative theme: ${params.creativePack?.name ?? "Creative theme"}\nTheme prompt: ${themePrompt}`
      : `${basePrompt}\n\n${subjectInstruction}\n\n${imageCreativeDirection}`;
  return {
    fields,
    workflow,
    provider,
    prompt: {
      template: workflow.promptTemplate ?? "",
      inputs: fields,
      rendered: renderedPrompt,
      negativePrompt: workflow.negativePrompt ?? "",
      themeName: params.videoTheme?.name ?? params.creativePack?.name ?? "",
      themePrompt,
      subjectInstruction,
      imageCreativeDirection,
      videoFrameInstruction,
      videoReferenceContract,
      videoSkillPackQuality
    }
  };
}

function platformFallbackProviderConfig(provider: AiProviderConfig): AiProviderConfig {
  return {
    mode: "platform_fallback",
    fallbackEnabled: true,
    ...(provider.modelType ? { modelType: provider.modelType } : {})
  };
}

function providerRecordIsRunnable(provider: {
  enabled?: boolean | null;
  aiUrl?: string | null;
  apiKey?: string | null;
  modelType?: string | null;
}) {
  return provider.enabled !== false &&
    Boolean(provider.aiUrl?.trim()) &&
    Boolean(provider.apiKey?.trim()) &&
    Boolean(provider.modelType?.trim());
}

/**
 * 计算模型级价格；返回 null 表示本次请求没有命中开启 priceEnabled 的通道，
 * 调用方应回落到主题价/应用价。trialApplied 标记专享价确实生效（同一次
 * 报价/扣费口径必须一致，见 createGenerationJobInTx 的 offer 消费）。
 */
async function resolveModelPricedCreditsForJob(
  tx: Tx,
  params: {
    requestJson?: Record<string, unknown>;
    siteAiApp: Prisma.SiteAiAppGetPayload<{ include: { aiApp: true } }>;
    requestedAssetIds: string[];
    audioAssetIds: string[];
    videoTheme?: GenerationVideoTheme | null;
    durationSeconds?: number | null;
    resolution?: string | null;
    outputCount: number;
    firstVideoTrial?: boolean;
  }
): Promise<{ credits: number | null; trialApplied: boolean }> {
  const providerType = platformProviderTypeForAppType(params.siteAiApp.aiApp.appType);
  const selection = jsonObject<Record<string, unknown>>(params.requestJson?.providerSelection as Prisma.JsonValue | undefined);
  const fields = jsonObject<Record<string, unknown>>(params.requestJson?.fields as Prisma.JsonValue | undefined);
  const modelOverride = typeof params.requestJson?.modelOverride === "string"
    ? params.requestJson.modelOverride
    : typeof fields?.modelOverride === "string"
      ? fields.modelOverride
      : "";
  const selectionProviderId = typeof selection?.providerId === "string" ? selection.providerId : "";

  const providers = await tx.platformAiProvider.findMany({
    where: { enabled: true, providerType },
    select: {
      id: true,
      label: true,
      aiUrl: true,
      apiKey: true,
      modelType: true,
      providerType: true,
      enabled: true,
      priority: true,
      preferred: true,
      videoModelFamily: true,
      priceEnabled: true,
      priceCredits: true,
      priceVideoDurations: true,
      priceVideoResolutions: true,
      priceImageQualities: true,
      priceImageResolutions: true,
      priceImageInput: true,
      priceVideoInputPerSecond: true,
      priceAudioInput: true,
      priceAudioInputPerSecond: true
    },
    orderBy: [{ priority: "asc" }, { preferred: "desc" }]
  });
  if (!providers.some((provider) => provider.priceEnabled)) return { credits: null, trialApplied: false };

  const family = typeof params.requestJson?.videoModelFamily === "string"
    ? params.requestJson.videoModelFamily
    : typeof fields?.videoModelFamily === "string"
      ? fields.videoModelFamily
      : undefined;

  const billingProvider = selectionProviderId
    ? providers.find((provider) => provider.id === selectionProviderId) ?? null
    : selectBillingProvider({ providers, providerType, modelOverride, modelFamily: family });
  if (!billingProvider?.priceEnabled) return { credits: null, trialApplied: false };

  // 输入模态计费：按客户实际提供的素材类型统计。
  // 素材表不持久化时长，视频/音频的按秒计费只统计明确传入时长的输入，
  // 未提供时长时按条数计费，避免凭空估算出错的价格。
  let imageInputCount = 0;
  let videoInputSeconds = 0;
  let videoInputCount = 0;
  let audioInputCount = 0;
  let audioInputSeconds = 0;
  const inputDurations = jsonObject<Record<string, unknown>>(params.requestJson?.inputDurations as Prisma.JsonValue | undefined);
  if (params.requestedAssetIds.length || params.audioAssetIds.length) {
    const assets = await tx.assetUpload.findMany({
      where: { id: { in: [...params.requestedAssetIds, ...params.audioAssetIds] }, siteId: params.siteAiApp.siteId, deletedAt: null },
      select: { id: true, mimeType: true }
    });
    for (const asset of assets) {
      const mimeType = (asset.mimeType ?? "").toLowerCase();
      const durationSeconds = Number(inputDurations?.[asset.id]);
      if (mimeType.startsWith("image/")) imageInputCount += 1;
      else if (mimeType.startsWith("video/")) {
        videoInputCount += 1;
        if (Number.isFinite(durationSeconds) && durationSeconds > 0) videoInputSeconds += Math.trunc(durationSeconds);
      } else if (mimeType.startsWith("audio/")) {
        audioInputCount += 1;
        if (Number.isFinite(durationSeconds) && durationSeconds > 0) audioInputSeconds += Math.trunc(durationSeconds);
      }
    }
  }

  const breakdown = providerCreditsForRequest(billingProvider, {
    capabilityType: providerType,
    durationSeconds: params.durationSeconds ?? null,
    resolution: params.resolution ?? null,
    quality: typeof fields?.quality === "string" ? fields.quality : null,
    imageInputCount,
    videoInputCount,
    videoInputSeconds,
    audioInputCount,
    audioInputSeconds,
    outputCount: 1,
    trialOffer: Boolean(params.firstVideoTrial)
  });
  // 与 resolveAiProviderPrice 的生效条件保持一致：trialOffer 只有在命中
  // 专享通道的 15s 视频档时才真正折扣（provider 作用域在 providerCreditsForRequest 内再校验）。
  const trialApplied = Boolean(params.firstVideoTrial) && providerType === "video" && params.durationSeconds === 15 && firstVideoTrialAppliesToProvider(billingProvider?.id);
  return { credits: breakdown ? breakdown.unitCredits : null, trialApplied };
}

async function normalizeProviderSelectionForAvailability(
  tx: Tx,
  params: { provider: AiProviderConfig; providerType: PlatformAiProviderType }
) {
  if (params.provider.mode === "platform_fallback" || !params.provider.providerId) return params.provider;
  const provider = await tx.platformAiProvider.findUnique({
    where: { id: params.provider.providerId },
    select: {
      providerType: true,
      enabled: true,
      aiUrl: true,
      apiKey: true,
      modelType: true
    }
  });
  if (!provider) {
    if (params.provider.mode === "preferred_provider") return platformFallbackProviderConfig(params.provider);
    throw new StoreError("ai_provider_not_found", 404);
  }
  if (normalizePlatformAiProviderType(provider.providerType) !== params.providerType) {
    throw new StoreError("ai_provider_type_mismatch", 400);
  }
  if (!providerRecordIsRunnable(provider)) {
    if (params.provider.mode === "preferred_provider") return platformFallbackProviderConfig(params.provider);
    throw new StoreError(provider.enabled === false ? "ai_provider_disabled" : "ai_provider_not_configured", 503);
  }
  return params.provider;
}

async function lockGenerationJobForUpdate(tx: Tx, params: { jobId: string; siteId: string }) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "GenerationJob"
    WHERE "id" = ${params.jobId} AND "siteId" = ${params.siteId}
    FOR UPDATE
  `;
  if (!rows[0]) throw new StoreError("job_not_found", 404);
}

async function lockCustomerCreditBalanceForUpdate(tx: Tx, siteId: string, customerId: string) {
  await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "CreditBalance"
    WHERE "siteId" = ${siteId} AND "customerId" = ${customerId}
    FOR UPDATE
  `;
}

async function readCustomerForUpdate(tx: Tx, siteId: string, customerId: string) {
  const customer = await tx.customer.findFirst({ where: { id: customerId, siteId }, include: { balance: true } });
  if (!customer) throw new StoreError("customer_not_found_for_site", 404);
  if (!customer.balance) {
    await tx.creditBalance.create({ data: { id: uid("bal"), siteId, customerId, balance: 0, reserved: 0 } });
    return tx.customer.findFirstOrThrow({ where: { id: customerId, siteId }, include: { balance: true } });
  }
  return customer;
}

async function reserveCreditsForJob(tx: Tx, job: { id: string; siteId: string; customerId: string; creditsReserved: number }) {
  let ledger = await tx.creditLedger.findFirst({
    where: { siteId: job.siteId, customerId: job.customerId, type: "reserve", sourceId: job.id }
  });
  if (ledger) return { ledger, reserved: false };
  const updated = await tx.creditBalance.updateMany({
    where: { siteId: job.siteId, customerId: job.customerId, balance: { gte: job.creditsReserved } },
    data: { balance: { decrement: job.creditsReserved }, reserved: { increment: job.creditsReserved } }
  });
  if (updated.count !== 1) throw new StoreError("insufficient_credits", 402);
  ledger = await tx.creditLedger.create({
    data: {
      id: uid("led"),
      siteId: job.siteId,
      customerId: job.customerId,
      amount: -job.creditsReserved,
      type: "reserve",
      sourceType: "generation_job",
      sourceId: job.id
    }
  });
  return { ledger, reserved: true };
}

const TASK_HOLD_SOURCE_TYPE = "workspace_task_hold";

/** 任务冻结台账全部条目（基础冻结 + top-up + 释放）；amount 正=释放，负=冻结。 */
async function taskHoldLedgerTx(tx: Tx, params: { siteId: string; customerId: string; taskId: string }) {
  return tx.creditLedger.findMany({
    where: {
      siteId: params.siteId,
      customerId: params.customerId,
      sourceType: TASK_HOLD_SOURCE_TYPE,
      OR: [{ sourceId: params.taskId }, { sourceId: { startsWith: `${params.taskId}:` } }]
    },
    select: { amount: true, type: true }
  });
}

async function taskHoldRemainingTx(tx: Tx, params: { siteId: string; customerId: string; taskId: string }) {
  const rows = await taskHoldLedgerTx(tx, params);
  const remaining = rows.reduce((sum, row) => sum - row.amount, 0);
  return Math.max(0, remaining);
}

/**
 * 任务级积分冻结：在工作台首次运行（确认生成）时一次性冻结整个任务的预计成本，
 * 之后每个镜头派发时从该冻结额转入对应 job 的预留（见 createGenerationJobInTx），
 * 任务到达终态（完成/取消/删除）后释放剩余冻结额。失败路径的退款仍走 job 预留本身。
 * 幂等：同任务重复调用只在冻结额不足（含队列中止后被释放）时补足差额（top-up）。
 * 金额与占用在同一事务内，余额行锁保证并发重复调用串行化；冻结记录使用一次性
 * sourceId，任务被释放后再次运行也能重新冻结，不会被旧记录的唯一索引挡住。
 */
export async function reserveWorkspaceTaskHoldTx(tx: Tx, params: { siteId: string; customerId: string; taskId: string; credits: number }) {
  if (!Number.isSafeInteger(params.credits) || params.credits < 0) throw new StoreError("pricing_unconfigured", 422);
  if (params.credits === 0) return { holdCredits: 0, remaining: await taskHoldRemainingTx(tx, params), added: 0 };
  // 先取余额行锁再读台账，保证并发重复运行按客户串行化，读到最新的冻结剩余额。
  await lockCustomerCreditBalanceForUpdate(tx, params.siteId, params.customerId);
  const remaining = await taskHoldRemainingTx(tx, params);
  if (remaining >= params.credits) return { holdCredits: remaining, remaining, added: 0 };
  const topUp = params.credits - remaining;
  const customer = await readCustomerForUpdate(tx, params.siteId, params.customerId);
  const available = customer.balance?.balance ?? 0;
  if (available < topUp) throw new StoreError("insufficient_credits", 402);
  await tx.creditBalance.update({
    where: { id: customer.balance!.id },
    data: { balance: { decrement: topUp }, reserved: { increment: topUp } }
  });
  await tx.creditLedger.create({
    data: {
      id: uid("led"),
      siteId: params.siteId,
      customerId: params.customerId,
      amount: -topUp,
      type: "reserve",
      sourceType: TASK_HOLD_SOURCE_TYPE,
      sourceId: `${params.taskId}:hold:${uid("led")}`
    }
  });
  // 并发安全：同客户的 CreditBalance FOR UPDATE 行锁先于写入获取（见
  // lockCustomerCreditBalanceForUpdate），余额读写与 ledger 插入按客户串行化，
  // 不会出现重复冻结；异常唯一冲突时整体事务回滚，余额保持不变。
  return { holdCredits: remaining + topUp, remaining: remaining + topUp, added: topUp };
}

/** 从任务冻结额中释放 amount（自动按剩余额截断，幂等键 ref），返回实际释放数。 */
export async function releaseWorkspaceTaskHoldTx(tx: Tx, params: { siteId: string; customerId: string; taskId: string; amount: number; ref: string }) {
  if (!Number.isSafeInteger(params.amount) || params.amount <= 0) return 0;
  // 先取余额行锁再判断幂等键与剩余额，防止并发释放读到过期剩余额造成双重释放。
  await lockCustomerCreditBalanceForUpdate(tx, params.siteId, params.customerId);
  const sourceId = `${params.taskId}:${params.ref}`;
  const existing = await tx.creditLedger.findFirst({
    where: { siteId: params.siteId, customerId: params.customerId, type: "release", sourceType: TASK_HOLD_SOURCE_TYPE, sourceId }
  });
  if (existing) return 0;
  const remaining = await taskHoldRemainingTx(tx, params);
  if (remaining <= 0) return 0;
  const customer = await tx.customer.findFirst({ where: { id: params.customerId, siteId: params.siteId }, include: { balance: true } });
  const reserved = customer?.balance?.reserved ?? 0;
  const amount = Math.max(0, Math.min(params.amount, remaining, reserved));
  if (amount <= 0) return 0;
  if (!customer?.balance) throw new StoreError("customer_not_found_for_site", 404);
  await tx.creditBalance.update({
    where: { id: customer.balance.id },
    data: { balance: { increment: amount }, reserved: { decrement: amount } }
  });
  await tx.creditLedger.create({
    data: {
      id: uid("led"),
      siteId: params.siteId,
      customerId: params.customerId,
      amount,
      type: "release",
      sourceType: TASK_HOLD_SOURCE_TYPE,
      sourceId
    }
  });
  return amount;
}

/** 任务终态后释放剩余冻结额（幂等）；失败时调用方按 best-effort 记录日志。可限制只释放本次新增的冻结额。 */
export async function releaseWorkspaceTaskHoldRelational(params: { siteId: string; customerId: string; taskId: string; ref: string; amount?: number }) {
  return prisma.$transaction(async (tx) => {
    await lockCustomerCreditBalanceForUpdate(tx, params.siteId, params.customerId);
    const remaining = await taskHoldRemainingTx(tx, params);
    const amount = Math.min(params.amount ?? remaining, remaining);
    if (amount <= 0) return 0;
    return releaseWorkspaceTaskHoldTx(tx, { siteId: params.siteId, customerId: params.customerId, taskId: params.taskId, ref: params.ref, amount });
  }, jobStoreTransactionOptions);
}

/** 确认生成时冻结整个任务的预计成本（幂等，不足时补足差额）。 */
export async function reserveWorkspaceTaskHoldRelational(params: { siteId: string; customerId: string; taskId: string; credits: number }) {
  return prisma.$transaction(async (tx) => reserveWorkspaceTaskHoldTx(tx, params), jobStoreTransactionOptions);
}

async function releaseStaleActiveJobs(tx: Tx, params: { siteId: string; customerId: string; jobId?: string; forceVideoCreateTimeout?: boolean }) {
  const nowMs = Date.now();
  const staleBefore = new Date(nowMs - MIN_ACTIVE_JOB_STALE_MS);
  const forceTargetedVideoCreate = params.forceVideoCreateTimeout === true && Boolean(params.jobId);
  const staleJobs = await tx.generationJob.findMany({
    where: {
      ...(params.jobId ? { id: params.jobId } : {}),
      siteId: params.siteId,
      customerId: params.customerId,
      status: { in: ["queued", "running"] },
      ...(forceTargetedVideoCreate ? {} : { updatedAt: { lt: staleBefore } })
    }
  });
  const releasedJobIds: string[] = [];
  for (const candidate of staleJobs) {
    // Serialize a stale release with settlement/progress updates for the same
    // job. Without this lock a late result can consume or release the same
    // reservation a second time.
    await lockGenerationJobForUpdate(tx, { jobId: candidate.id, siteId: params.siteId });
    const job = await tx.generationJob.findFirst({
      where: { id: candidate.id, siteId: params.siteId, customerId: params.customerId }
    });
    if (!job || (job.status !== "queued" && job.status !== "running")) continue;
    const jobRequest = jsonObject<Record<string, unknown>>(job.requestJson) ?? {};
    const previousResult = jsonObject<Record<string, unknown>>(job.resultJson) ?? {};
    const staleMs = activeJobStaleMs(jobRequest, previousResult);
    const isVideoCreateOrphan = videoProviderCreateStartedWithoutTaskId(previousResult);
    const isVideoRequestOrphan = !isVideoCreateOrphan && videoProviderRequestStartedWithoutTaskId(previousResult);
    const forceVideoTaskTimeout = params.forceVideoCreateTimeout === true && (isVideoCreateOrphan || isVideoRequestOrphan);
    // A video job whose provider stopped sending progress is treated as expired even
    // while the (much longer) worker timeout would still cover it; without this a
    // silent provider holds the customer's reserved credits for up to 24h.
    const progressSilentMs = videoProviderProgressSilentMs(previousResult);
    const progressStalled = progressSilentMs >= videoProviderProgressStallMs();
    if (!forceVideoTaskTimeout && !progressStalled && job.updatedAt.getTime() > nowMs - staleMs) continue;
    await lockCustomerCreditBalanceForUpdate(tx, job.siteId, job.customerId);
    const customer = await readCustomerForUpdate(tx, job.siteId, job.customerId);
    const reserveLedger = await tx.creditLedger.findFirst({
      where: { siteId: job.siteId, customerId: job.customerId, type: "reserve", sourceId: job.id }
    });
    const jobReserved = reserveLedger
      ? Math.max(0, -reserveLedger.amount)
      : Math.max(0, job.creditsReserved);
    const availableReserved = Math.max(0, customer.balance?.reserved ?? 0);
    const reserved = Math.max(0, Math.min(jobReserved, availableReserved));
    const reservedShortfall = Math.max(0, jobReserved - reserved);
    if (reservedShortfall > 0) {
      console.error("stale_generation_release_reserved_shortfall", {
        siteId: job.siteId,
        customerId: job.customerId,
        jobId: job.id,
        jobReserved,
        availableReserved,
        creditsReleased: reserved,
        reservedShortfall
      });
    }
    const previousSlots = Array.isArray(previousResult.outputSlots)
      ? previousResult.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
      : [];
    const now = new Date().toISOString();
    const expirationStage = isVideoCreateOrphan
      ? "video_provider_create_timeout"
      : isVideoRequestOrphan
      ? "video_provider_request_timeout"
      : progressStalled
      ? "video_provider_progress_stall"
      : "generation_job_expired";
    const expirationError = isVideoCreateOrphan
      ? "ai_provider_video_create_timeout_watchdog"
      : isVideoRequestOrphan
      ? "ai_provider_video_request_timeout_watchdog"
      : progressStalled
      ? "ai_provider_video_progress_stall_watchdog"
      : "generation_job_expired";
    const failedSlots = (previousSlots.length ? previousSlots : [{ index: 1 }]).map((slot, index) => ({
      ...slot,
      index: Number.isFinite(Number(slot.index)) ? Number(slot.index) : index + 1,
      status: "failed",
      stage: expirationStage,
      error: typeof slot.error === "string" && slot.error.trim() ? slot.error : expirationError,
      updatedAt: now
    }));
    const billing = jobRequest.billing && typeof jobRequest.billing === "object" && !Array.isArray(jobRequest.billing)
      ? jobRequest.billing as Record<string, unknown>
      : {};
    const requestedOutputs = Math.max(1, Math.trunc(Number(billing.outputCount) || failedSlots.length || 1));
    const unitCreditCost = Math.max(0, Math.trunc(Number(billing.unitCreditCost) || Math.ceil(job.creditsReserved / requestedOutputs)));
    if (reserved > 0) {
      const updated = await tx.creditBalance.updateMany({
        where: { id: customer.balance!.id, reserved: { gte: reserved } },
        data: { balance: { increment: reserved }, reserved: { decrement: reserved } }
      });
      if (updated.count !== 1) throw new StoreError("reserved_credits_not_available", 409);
      await tx.creditLedger.create({
        data: {
          id: uid("led"),
          siteId: job.siteId,
          customerId: job.customerId,
          amount: reserved,
          type: "release",
          sourceType: "generation_job",
          sourceId: job.id
        }
      });
    }
    await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        resultJson: toPrismaJson({
          ...previousResult,
          requestId: typeof previousResult.requestId === "string" ? previousResult.requestId : `stale:${job.id}`,
          lastWorkerStatus: "failed",
          lastWorkerStage: expirationStage,
          outputSlots: failedSlots,
          error: expirationError,
          outputs: [],
          billingSettlement: {
            requestedOutputs,
            deliveredOutputs: 0,
            unitCreditCost,
            creditsReserved: job.creditsReserved,
            creditsConsumed: 0,
            creditsReleased: reserved,
            ...(reservedShortfall > 0 ? { creditsReleaseShortfall: reservedShortfall, reconciliationRequired: "reserved_credit_pool_shortfall" } : {})
          },
          settledAt: now
        })
      }
    });
    releasedJobIds.push(job.id);
  }
  return releasedJobIds;
}

export async function reconcileDeliveredVideoGenerationJobsRelational(params: {
  siteId: string;
  customerId: string;
  jobId?: string;
  limit?: number;
}): Promise<{ settledJobIds: string[] }> {
  const jobs = await withJobStoreTimeout(prisma.generationJob.findMany({
    where: {
      ...(params.jobId ? { id: params.jobId } : {}),
      siteId: params.siteId,
      customerId: params.customerId,
      status: { in: ["queued", "running"] }
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: Math.max(1, Math.min(Math.trunc(params.limit ?? 20), 100))
  }), "delivered_video_job_lookup_timeout");
  const settledJobIds: string[] = [];
  for (const job of jobs) {
    const delivered = deliveredVideoResultFromActiveJob(job);
    if (!delivered) continue;
    const previousResult = jsonObject<Record<string, unknown>>(job.resultJson) ?? {};
    const settledAt = new Date().toISOString();
    const result = await settleGenerationJobRelational({
      jobId: job.id,
      siteId: job.siteId,
      requestId: resultString(previousResult.requestId) || `video-result-reconcile:${job.id}`,
      status: "succeeded",
      outputs: delivered.outputs,
      outputSlots: delivered.outputSlots,
      timing: {
        ...(delivered.timing ?? {}),
        resultReconciledAt: settledAt
      },
      recovery: {
        source: "delivered_video_slot_reconciliation",
        providerTaskId: delivered.providerTaskId,
        recoveredAt: settledAt
      }
    });
    if (!result.alreadyProcessed) settledJobIds.push(job.id);
  }
  return { settledJobIds };
}

export async function releaseStaleActiveGenerationJobsRelational(params: { siteId: string; customerId: string }): Promise<void> {
  await reconcileDeliveredVideoGenerationJobsRelational(params);
  await withJobStoreTimeout(prisma.$transaction(async (tx) => {
    await releaseStaleActiveJobs(tx, params);
  }, jobStoreTransactionOptions), "stale_job_release_timeout");
}

export async function releaseStaleActiveGenerationJobRelational(params: { siteId: string; customerId: string; jobId: string; forceVideoCreateTimeout?: boolean }): Promise<boolean> {
  const releasedJobIds = await withJobStoreTimeout(prisma.$transaction(async (tx) => {
    return releaseStaleActiveJobs(tx, params);
  }, jobStoreTransactionOptions), "stale_job_release_timeout");
  return releasedJobIds.includes(params.jobId);
}

function terminatedOutputSlots(params: {
  previousResult: Record<string, unknown>;
  requestedOutputs: number;
  terminatedAt: string;
}) {
  const previousSlots = Array.isArray(params.previousResult.outputSlots)
    ? params.previousResult.outputSlots.filter((slot): slot is Record<string, unknown> => Boolean(slot) && typeof slot === "object" && !Array.isArray(slot))
    : [];
  const sourceSlots = previousSlots.length
    ? previousSlots
    : Array.from({ length: params.requestedOutputs }, (_, index) => ({ index: index + 1 }));
  return sourceSlots.map((slot, index) => {
    const next: Record<string, unknown> = { ...slot };
    delete next.storageKey;
    delete next.mimeType;
    return {
      ...next,
      index: Number.isFinite(Number(slot.index)) ? Number(slot.index) : index + 1,
      status: "failed",
      stage: "admin_terminated",
      error: "Generation was terminated by a site administrator.",
      updatedAt: params.terminatedAt
    };
  });
}

export async function terminateGenerationJobRelational(params: {
  jobId: string;
  siteId: string;
  actorId: string;
  reason?: string;
  localWorkerAbort?: boolean;
}): Promise<{ job: GenerationJob; ledger?: CreditLedgerEntry; customer: Customer }> {
  return runPrismaWriteWithReconnect(() => withJobStoreTimeout(prisma.$transaction(async (tx) => {
    await lockGenerationJobForUpdate(tx, { jobId: params.jobId, siteId: params.siteId });
    const job = await tx.generationJob.findFirst({ where: { id: params.jobId, siteId: params.siteId } });
    if (!job) throw new StoreError("job_not_found", 404);
    if (job.status !== "queued" && job.status !== "running") {
      throw new StoreError("generation_job_not_active", 409);
    }
    await lockCustomerCreditBalanceForUpdate(tx, job.siteId, job.customerId);
    const _customer = await readCustomerForUpdate(tx, job.siteId, job.customerId);
    const previousResult = jsonObject<Record<string, unknown>>(job.resultJson) ?? {};
    const requestJson = jsonObject<Record<string, unknown>>(job.requestJson) ?? {};
    const billing = requestJson.billing && typeof requestJson.billing === "object" && !Array.isArray(requestJson.billing)
      ? requestJson.billing as Record<string, unknown>
      : {};
    const requestedOutputs = Math.max(
      1,
      Math.trunc(Number(billing.outputCount) || requestedOutputCount(requestJson) || 1)
    );
    const terminatedAt = new Date().toISOString();
    const releaseAmount = Math.max(0, job.creditsReserved);
    let ledger: Prisma.CreditLedgerGetPayload<object> | undefined;
    if (releaseAmount > 0) {
      const updated = await tx.creditBalance.updateMany({
        where: { siteId: job.siteId, customerId: job.customerId, reserved: { gte: releaseAmount } },
        data: { balance: { increment: releaseAmount }, reserved: { decrement: releaseAmount } }
      });
      if (updated.count !== 1) throw new StoreError("reserved_credits_not_available", 409);
      ledger = await tx.creditLedger.create({
        data: {
          id: uid("led"),
          siteId: job.siteId,
          customerId: job.customerId,
          amount: releaseAmount,
          type: "release",
          sourceType: "generation_job",
          sourceId: job.id
        }
      });
    }
    const resultJson = {
      ...previousResult,
      requestId: typeof previousResult.requestId === "string" && previousResult.requestId
        ? previousResult.requestId
        : `admin:${job.id}`,
      lastWorkerStatus: "failed",
      lastWorkerStage: "admin_terminated",
      lastWorkerProgress: 0,
      outputs: [],
      outputSlots: terminatedOutputSlots({ previousResult, requestedOutputs, terminatedAt }),
      error: "generation_job_terminated_by_admin",
      billingSettlement: {
        requestedOutputs,
        deliveredOutputs: 0,
        unitCreditCost: Math.max(0, Math.trunc(Number(billing.unitCreditCost) || Math.ceil(job.creditsReserved / requestedOutputs))),
        creditsReserved: job.creditsReserved,
        creditsConsumed: 0,
        creditsReleased: releaseAmount
      },
      termination: {
        actorId: params.actorId,
        reason: params.reason?.trim() || "site_admin_terminated",
        terminatedAt,
        localWorkerAbort: params.localWorkerAbort === true
      },
      settledAt: terminatedAt
    };
    const updatedJob = await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        resultJson: toPrismaJson(resultJson)
      }
    });
    await addAuditLogRelational(tx, {
      siteId: job.siteId,
      actorType: "site_admin",
      actorId: params.actorId,
      action: "generation_job_terminated",
      targetType: "generation_job",
      targetId: job.id,
      metadata: {
        customerId: job.customerId,
        creditsReleased: releaseAmount,
        localWorkerAbort: params.localWorkerAbort === true,
        reason: params.reason?.trim() || "site_admin_terminated",
        previousStatus: job.status
      }
    }, { syncPlatformState: false });
    const updatedCustomer = await tx.customer.findFirstOrThrow({ where: { id: job.customerId, siteId: job.siteId }, include: { balance: true } });
    return {
      job: mapGenerationJob(updatedJob),
      ledger: ledger ? mapCreditLedger(ledger) : undefined,
      customer: mapCustomer(updatedCustomer)
    };
  }, jobStoreTransactionOptions), "job_terminate_timeout"), {
    label: "generation job terminate"
  });
}

async function createGenerationJobInTx(tx: Tx, params: {
  siteId: string;
  customerId: string;
  aiAppSlug: string;
  requestJson?: Record<string, unknown>;
  subscriptionBypass?: JobSubscriptionBypass;
  entryPoint?: GenerationEntryPoint;
  idempotencyKey?: string;
  requestHash?: string;
  skipProviderAvailabilityCheck?: boolean;
  reserveFromTaskHold?: { taskId: string };
  firstVideoTrial?: boolean;
}) {
  await lockCustomerGenerationSubmit(tx, { siteId: params.siteId, customerId: params.customerId });
  const customer = await readCustomerForUpdate(tx, params.siteId, params.customerId);
  if (customer.status === "past_due") throw new StoreError("customer_past_due", 402);
  if (customer.status === "blocked") throw new StoreError("customer_blocked", 403);
  const hasSubscriptionBypass = params.subscriptionBypass?.enabled === true;
  const activeSubscription = hasSubscriptionBypass
    ? { id: "site_admin_bypass" }
    : await tx.subscription.findFirst({
        where: {
          siteId: params.siteId,
          customerId: params.customerId,
          status: { in: ACTIVE_SUBSCRIPTION_STATUSES },
          currentPeriodEnd: { gt: new Date() }
        },
        select: { id: true }
      });
  const siteAiApp = await tx.siteAiApp.findFirst({
    where: { siteId: params.siteId, enabled: true, aiApp: { slug: params.aiAppSlug } },
    include: { aiApp: true }
  });
  if (!siteAiApp) throw new StoreError("ai_app_not_enabled_for_site", 404);
  const idempotencyKey = params.idempotencyKey?.trim() || undefined;
  const requestHash = idempotencyKey ? params.requestHash || generationRequestHash({ aiAppSlug: params.aiAppSlug, requestJson: params.requestJson }) : undefined;
  if (idempotencyKey) {
    const existing = await tx.generationJob.findFirst({
      where: { siteId: params.siteId, customerId: params.customerId, idempotencyKey },
      orderBy: { createdAt: "desc" }
    });
    if (existing) {
      const existingHash = typeof (existing as { requestHash?: string | null }).requestHash === "string" ? (existing as { requestHash?: string }).requestHash : undefined;
      if (existingHash && existingHash !== requestHash) throw new StoreError("idempotency_key_conflict", 409);
      return { job: existing, siteAiApp, customer, reused: true as const };
    }
  }
  await releaseStaleActiveJobs(tx, { siteId: params.siteId, customerId: params.customerId });
  // The single active job guard protects the legacy storefront forms, where one
  // request owns the composer. Aidreamcapes workspace jobs are independent
  // library tasks with their own per-task operation lock, so a creator may send
  // several drafts upstream at once; they still may never stack on a legacy job.
  const activeJobs = await tx.generationJob.findMany({
    where: { siteId: params.siteId, customerId: params.customerId, status: { in: ["queued", "running"] } },
    select: { id: true, requestJson: true },
    take: 50
  });
  const incomingWorkspaceJob = isWorkspaceJobRequest(params.requestJson);
  const blockedActiveJob = activeJobs.find((job) => !(incomingWorkspaceJob && isWorkspaceJobRequest(job.requestJson)));
  if (blockedActiveJob) throw new StoreError("generation_job_already_running", 409);

  const fields = fieldRecord(params.requestJson);
  const rawVideoThemeId = typeof params.requestJson?.videoThemeId === "string"
    ? params.requestJson.videoThemeId
    : typeof fields.videoThemeId === "string"
      ? fields.videoThemeId
      : undefined;
  const rawVideoThemeSlug = typeof params.requestJson?.videoThemeSlug === "string"
    ? params.requestJson.videoThemeSlug
    : typeof fields.videoThemeSlug === "string"
      ? fields.videoThemeSlug
      : undefined;
  const rawVideoThemeExampleId = typeof params.requestJson?.videoThemeExampleId === "string"
    ? params.requestJson.videoThemeExampleId
    : typeof fields.videoThemeExampleId === "string"
      ? fields.videoThemeExampleId
      : undefined;
  const videoMode = isVideoModeRequest(params.requestJson) || params.aiAppSlug === "video_generator";
  const requestedAssetIds = requestedAssetIdsForRequest(params.requestJson, videoMode);
  const requestedModelPreference = videoMode ? requestedVideoModelPreference(params.requestJson) : undefined;
  if (videoMode && params.aiAppSlug !== "video_generator") throw new StoreError("video_theme_tool_mismatch", 400);
  if (videoMode && !rawVideoThemeId && !rawVideoThemeSlug) throw new StoreError("video_theme_required", 400);
  if (imageCoupleSourceGroupsMissing(params.requestJson, videoMode)) throw new StoreError("couple_source_groups_required", 400);
  const videoTheme = rawVideoThemeId || rawVideoThemeSlug
    ? await tx.videoTheme.findFirst({
        where: {
          siteId: params.siteId,
          status: "active",
          OR: [
            ...(rawVideoThemeId ? [{ id: rawVideoThemeId }] : []),
            ...(rawVideoThemeSlug ? [{ slug: rawVideoThemeSlug }] : [])
          ]
        },
        select: {
          id: true,
          categoryId: true,
          slug: true,
          name: true,
          headline: true,
          description: true,
          prompt: true,
          creditCost: true,
          modelPricing: true,
          durationSeconds: true,
          maxFrames: true,
          imageUrl: true,
          category: { select: { slug: true, label: true } }
        }
      })
    : null;
  if (videoMode && !videoTheme) throw new StoreError("video_theme_not_found_for_site", 404);
  const videoThemeExample = videoTheme && rawVideoThemeExampleId
    ? await tx.videoThemeExample.findFirst({
        where: { id: rawVideoThemeExampleId, siteId: params.siteId, themeId: videoTheme.id, status: "active" },
        select: { id: true, name: true, prompt: true }
      })
    : null;
  if (rawVideoThemeExampleId && !videoThemeExample) throw new StoreError("video_theme_example_not_found_for_site", 404);
  let videoProviderMaxFrames: number | undefined;
  let effectiveVideoMaxFrames: number | undefined;
  let videoCandidateModelFamilies: ReturnType<typeof videoProviderModelFamilyForProvider>[] = [];
  if (videoTheme) {
    const videoProviders = await tx.platformAiProvider.findMany({
      where: { enabled: true, providerType: "video" },
      select: { id: true, label: true, aiUrl: true, apiKey: true, modelType: true, providerType: true, enabled: true, maxImagesPerRequest: true, priority: true, preferred: true },
      orderBy: [{ priority: "asc" }, { preferred: "desc" }]
    });
    const modelPreferenceVideoProviders = videoProviders.filter((provider) =>
      videoProviderMatchesModelPreference(provider, requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY)
    );
    videoCandidateModelFamilies = Array.from(new Set(modelPreferenceVideoProviders.map(videoProviderModelFamilyForProvider)));
    videoProviderMaxFrames = configuredVideoProviderFrameLimit(modelPreferenceVideoProviders);
    effectiveVideoMaxFrames = effectiveVideoFrameLimit(modelPreferenceVideoProviders, videoTheme.maxFrames);
    const maxFrames = effectiveVideoMaxFrames;
    if (requestedModelPreference === "gemini" && requestedAssetIds.length < 1) throw new StoreError("video_frame_selection_required", 400);
    if (requestedAssetIds.length < 1 && !videoPromptText(params.requestJson)) throw new StoreError("video_prompt_required", 400);
    if (requestedAssetIds.length < 1 && videoPromptRequiresFrameImages(videoPromptText(params.requestJson))) {
      throw new StoreError("video_frame_selection_required", 400);
    }
    if (!params.skipProviderAvailabilityCheck) {
      const availability = videoProviderAvailability(modelPreferenceVideoProviders, { referenceAssetCount: requestedAssetIds.length });
      if (!availability.ok) throw new StoreError(availability.error, 503);
      videoCandidateModelFamilies = Array.from(new Set(
        availability.runnableProviders
          .map((diagnostic) => modelPreferenceVideoProviders.find((provider) => provider.id === diagnostic.id))
          .filter((provider): provider is typeof modelPreferenceVideoProviders[number] => Boolean(provider))
          .map(videoProviderModelFamilyForProvider)
      ));
    }
    if (requestedAssetIds.length > maxFrames) throw new StoreError("too_many_video_frames_for_provider", 400);
  }

  const creativePackId = !videoTheme && typeof params.requestJson?.creativePackId === "string" ? params.requestJson.creativePackId : undefined;
  const creativePack = creativePackId
    ? await tx.creativePack.findFirst({
        where: { id: creativePackId, siteId: params.siteId, status: "active" },
        select: {
          id: true,
          name: true,
          headline: true,
          category: true,
          aiAppSlug: true,
          prompt: true,
          creditCost: true,
          outputCount: true
        }
      })
    : null;
  if (creativePackId && !creativePack) throw new StoreError("creative_pack_not_found_for_site", 404);
  if (creativePack && creativePack.aiAppSlug !== params.aiAppSlug) throw new StoreError("creative_pack_tool_mismatch", 400);
  // Direct workspace jobs send the selected provider tier (15 or 30) as one
  // clip. The shared duration list stays 6/10/15 for every other flow.
  const directWorkspaceJob = Boolean((params.requestJson?.workspace as { direct?: boolean } | undefined)?.direct);
  const requestedVideoDurationSeconds = videoTheme
    ? normalizeVideoDurationSecondsForFrameCount(
        fields.durationSeconds ??
        fields.videoDurationSeconds ??
        fields.duration ??
        fields.videoDuration ??
        params.requestJson?.durationSeconds ??
        params.requestJson?.videoDurationSeconds ??
        params.requestJson?.duration ??
        params.requestJson?.videoDuration,
        requestedAssetIds.length,
        videoTheme.durationSeconds,
        requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY,
        directWorkspaceJob ? [15, 30] : undefined
      )
    : undefined;
  const requestedVideoResolution = videoTheme
    ? normalizeVideoResolution(fields.resolution ?? params.requestJson?.resolution)
    : undefined;
  const outputCount = videoTheme ? 1 : isThemeModeRequest(params.requestJson) ? requestedOutputCount(params.requestJson) : 1;

  // 模型级计价：只有显式开启 priceEnabled 的通道才接管价格，否则沿用主题价/应用价。
  // 报价与扣费必须走同一函数（src/lib/ai-provider-billing.ts），否则工作台会 409。
  const modelPriced = await resolveModelPricedCreditsForJob(tx, {
    requestJson: params.requestJson,
    siteAiApp,
    requestedAssetIds,
    audioAssetIds: stringArray(params.requestJson?.audioAssetIds),
    videoTheme,
    durationSeconds: requestedVideoDurationSeconds,
    resolution: requestedVideoResolution,
    outputCount,
    firstVideoTrial: params.firstVideoTrial
  });
  const modelPricedCredits = modelPriced.credits;

  const durationCreditCost = modelPricedCredits ?? (videoTheme
    ? (requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY) === AUTO_VIDEO_MODEL_FAMILY
      ? videoDurationCreditCostForModelFamilies(videoTheme.creditCost, requestedVideoDurationSeconds, videoCandidateModelFamilies, videoTheme.modelPricing)
      : videoDurationCreditCost(videoTheme.creditCost, requestedVideoDurationSeconds, requestedModelPreference, videoTheme.modelPricing)
    : creativePack?.creditCost ?? siteAiApp.creditCost);
  const unitCreditCost = modelPricedCredits !== null && modelPricedCredits !== undefined
    ? modelPricedCredits
    : videoTheme
      ? videoResolutionCreditCost(durationCreditCost, requestedVideoResolution)
      : durationCreditCost;
  const billableCredits = unitCreditCost * outputCount;
  const creditsReserved = billableCredits;
  const hasPaidCreditRequest = creditsReserved > 0;
  if (!hasSubscriptionBypass && !activeSubscription && !hasPaidCreditRequest) throw new StoreError("subscription_required", 402);
  if ((customer.balance?.balance ?? 0) < creditsReserved) throw new StoreError("insufficient_credits", 402);

  const resolvedRequest = resolveGenerationRequest({ requestJson: params.requestJson, siteAiApp, requestedAssetIds, creativePack, videoTheme });
  const resolvedProviderSelection = await normalizeProviderSelectionForAvailability(tx, {
    provider: resolvedRequest.provider,
    providerType: platformProviderTypeForAppType(siteAiApp.aiApp.appType)
  });
  const videoProviderSelection = videoTheme
    ? {
        ...resolvedProviderSelection,
        videoModelFamily: requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY
      }
    : resolvedProviderSelection;
  if (requestedAssetIds.length) {
    const validAssets = await tx.assetUpload.findMany({
      where: { id: { in: requestedAssetIds }, siteId: params.siteId, customerId: params.customerId, deletedAt: null },
      select: { id: true, mimeType: true, role: true, subjectRole: true }
    });
    const validAssetIds = new Set(validAssets.map((asset) => asset.id));
    const invalidAssetId = requestedAssetIds.find((assetId) => !validAssetIds.has(assetId));
    if (invalidAssetId) throw new StoreError("asset_not_found_for_customer", 404);
    if (videoTheme) {
      const invalidVideoFrameAsset = validAssets.find((asset) => asset.role !== "input" || !asset.mimeType.startsWith("image/"));
      if (invalidVideoFrameAsset) throw new StoreError("video_frame_asset_required", 400);
      if (((requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY) === AUTO_VIDEO_MODEL_FAMILY || requestedModelPreference === "gemini") && validAssets.some((asset) => !isGeminiVideoFrameMimeType(asset.mimeType))) {
        throw new StoreError("unsupported_video_frame_type", 400);
      }
    }
    // 站点后台按工具维护的参考素材数量上限（参考视频 / 参考音频）。
    const workflowConfig = jsonObject<AiWorkflowConfig>(siteAiApp.workflowConfig) ?? defaultWorkflowConfig(siteAiApp);
    const typeLimits = assetRules(workflowConfig).typeLimits;
    for (const [pattern, limit] of Object.entries(typeLimits ?? {})) {
      if (!limit) continue;
      const prefix = pattern.replace(/\/\*$/, "/");
      const count = validAssets.filter((asset) => asset.mimeType.startsWith(prefix)).length;
      if (limit.max !== undefined && count > limit.max) throw new StoreError("too_many_reference_assets", 400);
      if (limit.min !== undefined && count < limit.min) throw new StoreError("not_enough_reference_assets", 400);
    }
  }
  const resolvedFields = videoTheme
    ? {
        ...resolvedRequest.fields,
        mode: "video",
        outputType: "video",
        videoThemeId: videoTheme.id,
        videoThemeExampleId: videoThemeExample?.id,
        videoThemeSlug: videoTheme.slug,
        videoThemeName: videoTheme.name,
        videoThemeExampleName: videoThemeExample?.name,
        videoThemeCategoryLabel: videoTheme.category?.label,
        // A direct workspace prompt is the whole prompt. Injecting the theme's
        // sample script would contradict the customer's product and scene.
        ...(directWorkspaceJob ? {} : { videoThemePrompt: videoTheme.prompt }),
        videoModelFamily: requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY,
        modelFamily: requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY,
        frameAssetIds: requestedAssetIds,
        duration: String(requestedVideoDurationSeconds),
        videoDuration: String(requestedVideoDurationSeconds),
        durationSeconds: requestedVideoDurationSeconds,
        videoDurationSeconds: requestedVideoDurationSeconds,
        resolution: requestedVideoResolution,
        baseCreditCost: videoTheme.creditCost,
        modelPricing: videoTheme.modelPricing,
        selectedCreditCost: unitCreditCost,
        themeMaxFrames: normalizeVideoFrameLimit(videoTheme.maxFrames),
        providerMaxFrames: videoProviderMaxFrames,
        effectiveMaxFrames: effectiveVideoMaxFrames,
        maxFrames: effectiveVideoMaxFrames ?? normalizeVideoFrameLimit(videoTheme.maxFrames)
      }
    : resolvedRequest.fields;

  const job = await tx.generationJob.create({
    data: {
      id: uid("job"),
      siteId: params.siteId,
      customerId: params.customerId,
      aiAppId: siteAiApp.aiApp.id,
      status: "queued",
      creditsReserved,
      entryPoint: params.entryPoint ?? "customer_workspace",
      idempotencyKey,
      requestHash,
      requestJson: toPrismaJson({
        ...(params.requestJson ?? {}),
        assetIds: requestedAssetIds,
        ...(videoTheme
          ? {
              mode: "video",
              outputType: "video",
              videoThemeId: videoTheme.id,
              videoThemeSlug: videoTheme.slug,
              videoModelFamily: requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY,
              modelFamily: requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY,
              duration: String(requestedVideoDurationSeconds),
              videoDuration: String(requestedVideoDurationSeconds),
              durationSeconds: requestedVideoDurationSeconds,
              videoDurationSeconds: requestedVideoDurationSeconds,
              resolution: requestedVideoResolution,
              assetIds: requestedAssetIds
            }
          : {}),
        fields: resolvedFields,
        billing: {
          unitCreditCost,
          outputCount,
          creditsReserved,
          billableCredits,
          ...(hasSubscriptionBypass
            ? {
                subscriptionBypass: {
                  reason: params.subscriptionBypass?.reason ?? "site_admin",
                  siteAdminId: params.subscriptionBypass?.siteAdminId
                }
              }
            : {})
        },
        worker: siteAiApp.routeKey,
        flow: {
          version: resolvedRequest.workflow.version,
          flowName: resolvedRequest.workflow.flowName ?? siteAiApp.aiApp.name,
          aiAppSlug: params.aiAppSlug,
          siteAiAppId: siteAiApp.id,
          routeKey: siteAiApp.routeKey
        },
        flowSnapshot: resolvedRequest.workflow,
        creativePack: creativePack
          ? {
              id: creativePack.id,
              name: creativePack.name,
              headline: creativePack.headline,
              category: creativePack.category,
              aiAppSlug: creativePack.aiAppSlug,
              prompt: creativePack.prompt ?? "",
              creditCost: creativePack.creditCost,
              outputCount: creativePack.outputCount
            }
          : undefined,
        videoTheme: videoTheme
          ? {
              id: videoTheme.id,
              slug: videoTheme.slug,
              name: videoTheme.name,
              headline: videoTheme.headline,
              description: videoTheme.description,
              categoryId: videoTheme.categoryId,
              categorySlug: videoTheme.category?.slug ?? "",
              categoryLabel: videoTheme.category?.label ?? "",
              prompt: videoTheme.prompt,
              creditCost: videoTheme.creditCost,
              modelPricing: videoTheme.modelPricing,
              selectedCreditCost: unitCreditCost,
              selectedModelFamily: requestedModelPreference ?? AUTO_VIDEO_MODEL_FAMILY,
              durationSeconds: videoTheme.durationSeconds,
              selectedDurationSeconds: requestedVideoDurationSeconds,
              themeMaxFrames: normalizeVideoFrameLimit(videoTheme.maxFrames),
              providerMaxFrames: videoProviderMaxFrames,
              effectiveMaxFrames: effectiveVideoMaxFrames,
              maxFrames: effectiveVideoMaxFrames ?? normalizeVideoFrameLimit(videoTheme.maxFrames),
              imageUrl: videoTheme.imageUrl ?? ""
            }
          : undefined,
        prompt: resolvedRequest.prompt,
        providerSelection: videoProviderSelection
      })
    }
  });
  let ledger: Awaited<ReturnType<typeof reserveCreditsForJob>>["ledger"] | undefined;
  if (creditsReserved > 0) {
    // 工作台任务在“确认生成”时已整任务冻结积分（workspace_task_hold）。
    // 派发镜头时在同事务内先把本镜头金额从任务冻结额转出，再走常规 job 预留，
    // 净余额变动为零；冻结余额不足时按剩余额转出，差额由常规预留覆盖。
    if (params.reserveFromTaskHold) {
      await releaseWorkspaceTaskHoldTx(tx, {
        siteId: params.siteId,
        customerId: params.customerId,
        taskId: params.reserveFromTaskHold.taskId,
        amount: creditsReserved,
        ref: job.id
      });
    }
    const reserve = await reserveCreditsForJob(tx, job);
    ledger = reserve.ledger;
    // 首条视频专享价：本次扣费确实按 8 积分档生效时，同事务把 offer 置为 consumed。
    // 唯一 customerId 保证并发下单条 job 消费成功，失败方按正常价重报价（409）。
    // P0 简化：后续 job 失败不回滚 consumed——积分退款兜底损失，offer 不重新开放。
    if (reserve.reserved && params.firstVideoTrial && modelPriced.trialApplied) {
      const consumed = await consumeFirstVideoOfferTx(tx, { siteId: params.siteId, customerId: params.customerId });
      if (!consumed) throw new StoreError("workspace_price_quote_changed", 409);
    }
  }
  const updatedCustomer = await tx.customer.findFirstOrThrow({ where: { id: params.customerId, siteId: params.siteId }, include: { balance: true } });
  return { job, siteAiApp, ledger, customer: updatedCustomer, reused: false as const };
}

export async function createGenerationJobRelational(params: {
  siteId: string;
  customerId: string;
  aiAppSlug: string;
  requestJson?: Record<string, unknown>;
  subscriptionBypass?: JobSubscriptionBypass;
  entryPoint?: GenerationEntryPoint;
  idempotencyKey?: string;
  requestHash?: string;
  skipProviderAvailabilityCheck?: boolean;
  reserveFromTaskHold?: { taskId: string };
  firstVideoTrial?: boolean;
}): Promise<{ job: GenerationJob; siteAiApp: SiteAiApp; ledger?: CreditLedgerEntry; customer: Customer; reused: boolean }> {
  try {
    await reconcileDeliveredVideoGenerationJobsRelational({
      siteId: params.siteId,
      customerId: params.customerId
    });
    return await withJobStoreTimeout(prisma.$transaction(async (tx) => {
      const result = await createGenerationJobInTx(tx, params);
      return {
        job: mapGenerationJob(result.job),
        siteAiApp: mapSiteAiApp(result.siteAiApp),
        ledger: result.ledger ? mapCreditLedger(result.ledger) : undefined,
        customer: mapCustomer(result.customer),
        reused: result.reused
      };
    }, jobStoreTransactionOptions), "job_create_timeout");
  } catch (error) {
    const idempotencyKey = params.idempotencyKey?.trim();
    if (!idempotencyKey || !isPrismaErrorCode(error, "P2002")) throw error;
    const existing = await prisma.generationJob.findFirst({
      where: { siteId: params.siteId, customerId: params.customerId, idempotencyKey },
      orderBy: { createdAt: "desc" }
    });
    if (!existing) throw error;
    const requestHash = params.requestHash || generationRequestHash({ aiAppSlug: params.aiAppSlug, requestJson: params.requestJson });
    if (existing.requestHash && existing.requestHash !== requestHash) throw new StoreError("idempotency_key_conflict", 409);
    const siteAiApp = await prisma.siteAiApp.findFirst({
      where: { siteId: existing.siteId, aiAppId: existing.aiAppId },
      include: { aiApp: true }
    });
    if (!siteAiApp) throw new StoreError("ai_app_not_enabled_for_site", 404);
    const customer = await prisma.customer.findFirstOrThrow({ where: { id: existing.customerId, siteId: existing.siteId }, include: { balance: true } });
    return {
      job: mapGenerationJob(existing),
      siteAiApp: mapSiteAiApp(siteAiApp),
      customer: mapCustomer(customer),
      reused: true
    };
  }
}

export async function getGenerationJobForCustomerRelational(params: {
  siteId: string;
  customerId: string;
  jobId: string;
}): Promise<{ job: GenerationJob }> {
  const job = await prisma.generationJob.findFirst({
    where: { id: params.jobId, siteId: params.siteId, customerId: params.customerId }
  });
  if (!job) throw new StoreError("job_not_found", 404);
  return { job: mapGenerationJob(job) };
}

export async function listRecoverableQueuedGenerationJobsRelational(params: {
  siteId?: string;
  olderThanMs: number;
  limit: number;
}): Promise<Array<{ job: GenerationJob; siteAiApp: SiteAiApp }>> {
  const updatedBefore = new Date(Date.now() - Math.max(30_000, params.olderThanMs));
  const jobs = await prisma.generationJob.findMany({
    where: {
      ...(params.siteId ? { siteId: params.siteId } : {}),
      status: "queued",
      updatedAt: { lt: updatedBefore }
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: Math.max(1, Math.min(Math.trunc(params.limit), 100))
  });
  const results: Array<{ job: GenerationJob; siteAiApp: SiteAiApp }> = [];
  for (const job of jobs) {
    const siteAiApp = await prisma.siteAiApp.findFirst({
      where: { siteId: job.siteId, aiAppId: job.aiAppId, enabled: true },
      include: { aiApp: true }
    });
    if (!siteAiApp) continue;
    results.push({ job: mapGenerationJob(job), siteAiApp: mapSiteAiApp(siteAiApp) });
  }
  return results;
}

export async function updateGenerationJobStatusRelational(params: {
  jobId: string;
  siteId: string;
  requestId: string;
  status: string;
  stage?: string;
  progress?: number;
  outputSlots?: WorkerOutputSlot[];
  timing?: Record<string, string>;
}): Promise<{ job: GenerationJob; alreadyFinal: boolean }> {
  return runPrismaWriteWithReconnect(() => withJobStoreTimeout(prisma.$transaction(async (tx) => {
    await lockGenerationJobForUpdate(tx, { jobId: params.jobId, siteId: params.siteId });
    const job = await tx.generationJob.findFirst({ where: { id: params.jobId, siteId: params.siteId } });
    if (!job) throw new StoreError("job_not_found", 404);
    const alreadyFinal = job.status === "succeeded" || job.status === "failed" || job.status === "refunded";
    if (alreadyFinal) return { job: mapGenerationJob(job), alreadyFinal };
    const previousResult = (job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson) ? job.resultJson : {}) as Record<string, unknown>;
    const previousSlots = Array.isArray(previousResult.outputSlots) ? previousResult.outputSlots : [];
    const slotsByIndex = new Map<number, WorkerOutputSlot>();
    for (const slot of previousSlots) {
      if (!slot || typeof slot !== "object" || Array.isArray(slot)) continue;
      const record = slot as WorkerOutputSlot;
      if (Number.isFinite(record.index)) slotsByIndex.set(record.index, record);
    }
    const now = new Date().toISOString();
    for (const slot of params.outputSlots ?? []) {
      if (!Number.isFinite(slot.index)) continue;
      slotsByIndex.set(slot.index, {
        ...(slotsByIndex.get(slot.index) ?? {}),
        ...slot,
        updatedAt: slot.updatedAt ?? now
      });
    }
    const timing = mergeResultTiming(previousResult, params.timing);
    const resultJson = {
      ...previousResult,
      lastWorkerStatus: params.status,
      lastWorkerStage: params.stage ?? "worker_update",
      ...(Number.isFinite(Number(params.progress))
        ? { lastWorkerProgress: Math.max(0, Math.min(100, Number(params.progress))) }
        : {}),
      requestId: params.requestId,
      ...(timing ? { timing } : {}),
      outputSlots: Array.from(slotsByIndex.values()).sort((left, right) => left.index - right.index)
    };
    const updatedJob = await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: !alreadyFinal && params.status === "running" ? "running" : undefined,
        resultJson: toPrismaJson(resultJson)
      }
    });
    return { job: mapGenerationJob(updatedJob), alreadyFinal };
  }, jobStoreTransactionOptions), "job_status_update_timeout"), {
    label: "generation job status update"
  });
}

export async function settleGenerationJobRelational(params: {
  jobId: string;
  siteId: string;
  requestId: string;
  status: "succeeded" | "failed";
  outputs?: Array<{ storageKey: string; mimeType?: string }>;
  outputSlots?: WorkerOutputSlot[];
  providerTrace?: Array<{ provider: string; attempts: number }>;
  costTrace?: { estimatedCostUsd?: number; providerCreditCost?: number; providerCurrency?: string; providerErrors?: Array<{ provider: string; error: string }>; providerFailure?: VideoProviderFailure; referenceFrameCount?: number; requestedReferenceFrameCount?: number; providerReferenceLimit?: number };
  providerFailure?: VideoProviderFailure;
  error?: string;
  timing?: Record<string, string>;
  recovery?: { source?: string; providerTaskId?: string; resultUrl?: string; recoveredAt?: string };
}): Promise<{ job: GenerationJob; ledger?: CreditLedgerEntry; alreadyProcessed: boolean; customer: Customer }> {
  return runPrismaWriteWithReconnect(() => withJobStoreTimeout(prisma.$transaction(async (tx) => {
    await lockGenerationJobForUpdate(tx, { jobId: params.jobId, siteId: params.siteId });
    const job = await tx.generationJob.findFirst({ where: { id: params.jobId, siteId: params.siteId } });
    if (!job) throw new StoreError("job_not_found", 404);
    await lockCustomerCreditBalanceForUpdate(tx, job.siteId, job.customerId);
    const customer = await readCustomerForUpdate(tx, job.siteId, job.customerId);
    const previousResult = (job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson) ? job.resultJson : {}) as Record<string, unknown>;
    const outputs = params.outputs ?? [];
    const settledAt = new Date().toISOString();
    const timing = mergeResultTiming(previousResult, { ...params.timing, settledAt });
    const alreadyProcessed = job.status === "succeeded" || job.status === "failed" || job.status === "refunded";
    const requestJson = job.requestJson && typeof job.requestJson === "object" && !Array.isArray(job.requestJson)
      ? job.requestJson as Record<string, unknown>
      : {};
    const canRecoverExpiredSuccess = alreadyProcessed &&
      job.status === "failed" &&
      params.status === "succeeded" &&
      outputs.length > 0 &&
      (
        previousResult.error === "generation_job_expired" ||
        Boolean(params.recovery && isVideoModeRequest(requestJson))
      );
    if (alreadyProcessed && !canRecoverExpiredSuccess) return { job: mapGenerationJob(job), alreadyProcessed, customer: mapCustomer(customer) };

    const billing = requestJson.billing && typeof requestJson.billing === "object" && !Array.isArray(requestJson.billing)
      ? requestJson.billing as Record<string, unknown>
      : {};
    const requestedOutputs = Math.max(1, Math.trunc(Number(billing.outputCount) || outputs.length || 1));
    const unitCreditCost = Math.max(0, Math.trunc(Number(billing.unitCreditCost) || Math.ceil(job.creditsReserved / requestedOutputs)));
    const deliveredOutputs = params.status === "succeeded" ? outputs.length : 0;
    const previousBilling = previousResult.billingSettlement && typeof previousResult.billingSettlement === "object" && !Array.isArray(previousResult.billingSettlement)
      ? previousResult.billingSettlement as Record<string, unknown>
      : {};
    const consumeAmount = canRecoverExpiredSuccess ? 0 : Math.min(job.creditsReserved, deliveredOutputs * unitCreditCost);
    const releaseAmount = canRecoverExpiredSuccess
      ? Math.max(0, Math.trunc(Number(previousBilling.creditsReleased) || job.creditsReserved))
      : Math.max(0, job.creditsReserved - consumeAmount);
    let ledger: Prisma.CreditLedgerGetPayload<object> | undefined;
    if (!canRecoverExpiredSuccess && job.creditsReserved > 0 && params.status === "succeeded" && consumeAmount > 0) {
      const updated = await tx.creditBalance.updateMany({
        where: { siteId: job.siteId, customerId: job.customerId, reserved: { gte: job.creditsReserved } },
        data: {
          reserved: { decrement: job.creditsReserved },
          ...(releaseAmount > 0 ? { balance: { increment: releaseAmount } } : {})
        }
      });
      if (updated.count !== 1) throw new StoreError("reserved_credits_not_available", 409);
      ledger = await tx.creditLedger.create({
        data: {
          id: uid("led"),
          siteId: job.siteId,
          customerId: job.customerId,
          amount: -consumeAmount,
          type: "consume",
          sourceType: "generation_job",
          sourceId: job.id
        }
      });
      if (releaseAmount > 0) {
        await tx.creditLedger.create({
          data: {
            id: uid("led"),
            siteId: job.siteId,
            customerId: job.customerId,
            amount: releaseAmount,
            type: "release",
            sourceType: "generation_job",
            sourceId: job.id
          }
        });
      }
    } else if (!canRecoverExpiredSuccess && job.creditsReserved > 0) {
      const updated = await tx.creditBalance.updateMany({
        where: { siteId: job.siteId, customerId: job.customerId, reserved: { gte: job.creditsReserved } },
        data: { balance: { increment: job.creditsReserved }, reserved: { decrement: job.creditsReserved } }
      });
      if (updated.count !== 1) throw new StoreError("reserved_credits_not_available", 409);
      ledger = await tx.creditLedger.create({
        data: {
          id: uid("led"),
          siteId: job.siteId,
          customerId: job.customerId,
          amount: job.creditsReserved,
          type: "release",
          sourceType: "generation_job",
          sourceId: job.id
        }
      });
    }
    const updatedJob = await tx.generationJob.update({
      where: { id: job.id },
      data: {
        status: params.status,
        resultJson: toPrismaJson({
          ...previousResult,
          requestId: params.requestId,
          lastWorkerStatus: params.status,
          lastWorkerStage: settledLastWorkerStage(previousResult, { status: params.status, outputs }),
          outputs,
          outputSlots: settledOutputSlots(previousResult, outputs, {
            outputSlots: params.outputSlots,
            providerTaskId: params.recovery?.providerTaskId,
            settledAt
          }) ?? previousResult.outputSlots,
          billingSettlement: {
            requestedOutputs,
            deliveredOutputs,
            unitCreditCost,
            creditsReserved: job.creditsReserved,
            creditsConsumed: consumeAmount,
            creditsReleased: releaseAmount
          },
          providerTrace: params.providerTrace ?? [],
          costTrace: params.costTrace ?? {},
          providerFailure: params.providerFailure ?? params.costTrace?.providerFailure ?? null,
          ...(params.recovery
            ? {
                providerTaskId: params.recovery.providerTaskId ?? previousResult.providerTaskId,
                providerRecovery: {
                  source: resultString(params.recovery.source) || "video_provider_result_recovery",
                  providerTaskId: resultString(params.recovery.providerTaskId) || undefined,
                  resultUrl: resultString(params.recovery.resultUrl) || undefined,
                  previousStatus: job.status,
                  previousError: resultString(previousResult.error) || undefined,
                  recoveredAt: params.recovery.recoveredAt ?? settledAt
                }
              }
            : {}),
          error: params.error ?? null,
          ...(timing ? { timing } : {}),
          settledAt
        })
      }
    });
    if (params.status === "succeeded") {
      await upsertAlbumForSettledJob(tx, updatedJob, outputs);
    }
    const updatedCustomer = await tx.customer.findFirstOrThrow({ where: { id: job.customerId, siteId: job.siteId }, include: { balance: true } });
    return { job: mapGenerationJob(updatedJob), ledger: ledger ? mapCreditLedger(ledger) : undefined, alreadyProcessed: false, customer: mapCustomer(updatedCustomer) };
  }, jobStoreTransactionOptions), "job_result_update_timeout"), {
    label: "generation job result update"
  });
}

export async function replaceSettledGenerationOutputStorageKeyRelational(params: {
  jobId: string;
  siteId: string;
  customerId: string;
  originalStorageKey: string;
  storageKey: string;
  mimeType: string;
  timing?: Record<string, string>;
}): Promise<{ job?: GenerationJob; updated: boolean }> {
  return runPrismaWriteWithReconnect(() => withJobStoreTimeout(prisma.$transaction(async (tx) => {
    const job = await tx.generationJob.findFirst({ where: { id: params.jobId, siteId: params.siteId, customerId: params.customerId } });
    if (!job) throw new StoreError("job_not_found", 404);
    if (job.status !== "succeeded") return { job: mapGenerationJob(job), updated: false };
    const previousResult = (job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson) ? job.resultJson : {}) as Record<string, unknown>;
    const updatedAt = new Date().toISOString();
    const outputs = replaceStorageKeyInResultRecords(previousResult.outputs, {
      originalStorageKey: params.originalStorageKey,
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      updatedAt
    });
    const outputSlots = replaceStorageKeyInResultRecords(previousResult.outputSlots, {
      originalStorageKey: params.originalStorageKey,
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      updatedAt
    });
    const assetResult = await tx.assetUpload.updateMany({
      where: {
        siteId: params.siteId,
        customerId: params.customerId,
        jobId: params.jobId,
        storageKey: params.originalStorageKey
      },
      data: {
        storageKey: params.storageKey,
        mimeType: params.mimeType
      }
    });
    const changed = outputs.changed || outputSlots.changed || assetResult.count > 0;
    if (!changed) return { job: mapGenerationJob(job), updated: false };
    const timing = mergeResultTiming(previousResult, params.timing);
    const updatedJob = await tx.generationJob.update({
      where: { id: job.id },
      data: {
        resultJson: toPrismaJson({
          ...previousResult,
          ...(outputs.changed ? { outputs: outputs.value } : {}),
          ...(outputSlots.changed ? { outputSlots: outputSlots.value } : {}),
          ...(timing ? { timing } : {}),
          videoOptimization: {
            originalStorageKey: params.originalStorageKey,
            storageKey: params.storageKey,
            mimeType: params.mimeType,
            updatedAt
          }
        })
      }
    });
    return { job: mapGenerationJob(updatedJob), updated: true };
  }, jobStoreTransactionOptions), "job_video_output_replace_timeout"), {
    label: "generation job video output replacement"
  });
}

async function upsertAlbumForSettledJob(
  tx: Tx,
  job: Prisma.GenerationJobGetPayload<object>,
  outputs: Array<{ storageKey: string; mimeType?: string }>
) {
  const assetIds: string[] = [];
  const mappedJob = mapGenerationJob(job);
  const runNumber = await generationOutputRunNumberForSettledJob(tx, job, mappedJob);
  for (const [index, output] of outputs.entries()) {
    const existing = await tx.assetUpload.findFirst({
      where: { siteId: job.siteId, customerId: job.customerId, jobId: job.id, storageKey: output.storageKey }
    });
    if (existing) {
      assetIds.push(existing.id);
      continue;
    }
    const outputCopy = generatedOutputCopy({ imageIndex: index + 1, job: mappedJob, runNumber });
    const mediaKind = output.mimeType?.startsWith("video/") ? "AI-generated video" : "AI-generated image";
    const altText = [mediaKind, outputCopy.title, outputCopy.description].filter(Boolean).join(": ");
    const asset = await tx.assetUpload.create({
      data: {
        id: uid("asset"),
        siteId: job.siteId,
        customerId: job.customerId,
        jobId: job.id,
        label: outputCopy.title,
        storageKey: output.storageKey,
        mimeType: output.mimeType ?? "image/webp",
        role: "output",
        visibility: "private",
        reviewStatus: "approved",
        validationReport: toPrismaJson({ altText })
      }
    });
    assetIds.push(asset.id);
  }
  const packId = typeof (job.requestJson as Record<string, unknown>)?.creativePackId === "string"
    ? ((job.requestJson as Record<string, unknown>).creativePackId as string)
    : undefined;
  const jobRequest = job.requestJson && typeof job.requestJson === "object" && !Array.isArray(job.requestJson)
    ? job.requestJson as Record<string, unknown>
    : {};
  const albumTitle = isVideoModeRequest(jobRequest) || Boolean(jobRequest.videoTheme) ? "Generated video" : "Generated album";
  const existingAlbum = await tx.album.findFirst({ where: { siteId: job.siteId, sourceJobId: job.id } });
  if (existingAlbum) {
    await tx.album.update({
      where: { id: existingAlbum.id },
      data: {
        status: "ready",
        outputCount: outputs.length || existingAlbum.outputCount,
        coverAssetId: assetIds[0] ?? existingAlbum.coverAssetId
      }
    });
    return;
  }
  await tx.album.create({
    data: {
      id: uid("album"),
      siteId: job.siteId,
      customerId: job.customerId,
      title: albumTitle,
      sourceJobId: job.id,
      creativePackId: packId,
      status: "ready",
      outputCount: outputs.length,
      coverAssetId: assetIds[0]
    }
  });
}

function textRequestValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function outputRunNumberFilters(job: GenerationJob): Prisma.GenerationJobWhereInput[] {
  const mode = textRequestValue(job.requestJson.mode);
  const themeLabel = generationThemeLabel(job);
  const filters: Prisma.GenerationJobWhereInput[] = [];
  if (mode) filters.push({ requestJson: { path: ["mode"], equals: mode } });
  if (themeLabel) {
    filters.push(
      { requestJson: { path: ["fields", "videoThemeName"], equals: themeLabel } },
      { requestJson: { path: ["videoTheme", "name"], equals: themeLabel } },
      { requestJson: { path: ["fields", "creativePackName"], equals: themeLabel } },
      { requestJson: { path: ["creativePack", "name"], equals: themeLabel } },
      { requestJson: { path: ["prompt", "themeName"], equals: themeLabel } },
      { requestJson: { path: ["fields", "packageName"], equals: themeLabel } },
      { requestJson: { path: ["fields", "toolPresetTitle"], equals: themeLabel } }
    );
  }
  return filters;
}

async function generationOutputRunNumberForSettledJob(
  tx: Tx,
  job: Prisma.GenerationJobGetPayload<object>,
  mappedJob: GenerationJob
): Promise<number> {
  const filters = outputRunNumberFilters(mappedJob);
  return tx.generationJob.count({
    where: {
      siteId: job.siteId,
      customerId: job.customerId,
      createdAt: { lte: job.createdAt },
      ...(filters.length ? { OR: filters } : {})
    }
  });
}

export async function rerunGenerationJobRelational(params: {
  siteId: string;
  jobId: string;
  customerId?: string;
  actor?: string;
  idempotencyKey?: string;
  requireVideo?: boolean;
  skipProviderAvailabilityCheck?: boolean;
}): Promise<{ sourceJob: GenerationJob; job: GenerationJob; siteAiApp: SiteAiApp; ledger?: CreditLedgerEntry; customer: Customer; reused: boolean }> {
  return withJobStoreTimeout(prisma.$transaction(async (tx) => {
    const sourceJob = await tx.generationJob.findFirst({
      where: {
        id: params.jobId,
        siteId: params.siteId,
        ...(params.customerId ? { customerId: params.customerId } : {})
      }
    });
    if (!sourceJob) throw new StoreError("job_not_found", 404);
    if (sourceJob.status !== "failed" && sourceJob.status !== "refunded") {
      throw new StoreError("only_failed_or_refunded_jobs_can_be_rerun", 409);
    }
    const aiApp = await tx.aiApp.findUnique({ where: { id: sourceJob.aiAppId } });
    if (!aiApp) throw new StoreError("ai_app_not_found", 404);
    const rerunRequest = {
      ...cleanRerunRequest(sourceJob.requestJson),
      rerunOf: sourceJob.id,
      rerunBy: params.actor ?? (params.customerId ? "customer" : "site_admin_demo")
    };
    if (params.requireVideo && aiApp.slug !== "video_generator" && !isVideoModeRequest(rerunRequest)) {
      throw new StoreError("only_video_jobs_can_be_retried", 409);
    }
    const rerun = await createGenerationJobInTx(tx, {
      siteId: params.siteId,
      customerId: sourceJob.customerId,
      aiAppSlug: aiApp.slug,
      entryPoint: "rerun",
      requestJson: rerunRequest,
      idempotencyKey: params.idempotencyKey,
      skipProviderAvailabilityCheck: params.skipProviderAvailabilityCheck
    });
    return {
      sourceJob: mapGenerationJob(sourceJob),
      job: mapGenerationJob(rerun.job),
      siteAiApp: mapSiteAiApp(rerun.siteAiApp),
      ledger: rerun.ledger ? mapCreditLedger(rerun.ledger) : undefined,
      customer: mapCustomer(rerun.customer),
      reused: rerun.reused
    };
  }, jobStoreTransactionOptions), "job_rerun_timeout");
}
