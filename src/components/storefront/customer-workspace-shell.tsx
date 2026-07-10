"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Eye, Heart, LayoutGrid, Trash2, X, UserRound, Users } from "lucide-react";
import { AssetsPanel } from "@/components/app/assets-panel";
import { JobCreateForm } from "@/components/app/job-create-form";
import { CustomerShellHeader } from "@/components/storefront/customer-shell-header";
import { CustomerRoutePrefetch } from "@/components/storefront/customer-route-prefetch";
import { StorefrontNavigationFeedback } from "@/components/storefront/navigation-feedback";
import { CustomerAssetDownloadButton } from "@/components/storefront/customer-asset-download-button";
import { csrfHeader } from "@/lib/client-csrf";
import { shouldShowAssetOnSurface } from "@/lib/customer-asset-resource-agent";
import { hostAwareSitePath } from "@/lib/domain-routing";
import { generatedOutputCopy } from "@/lib/generation-output-labels";
import type { CreativePack, PublicCustomer, Site, SiteAiApp, ThemeRuntimeAsset, ThemeRuntimeData } from "@/lib/types";

type CustomerWorkspaceSite = Pick<Site, "id" | "slug" | "name" | "branding" | "primaryDomain">;
export type CustomerWorkspacePanel = "overview" | "create" | "upload";
type WorkspaceResourceTab = "all" | "recent" | "favorites" | "try-on" | "videos" | "packages";
type WorkspaceAnchor = "step-upload" | "step-create" | "source-photos" | "review-request" | `resources-${WorkspaceResourceTab}`;
type WorkspaceCreateMode = "theme" | "tool";
type WorkspaceSubscriptionStatus = "loading" | "active" | "required" | "admin";
type SampleTarget = "primary" | "partner";
type SampleAsset = ThemeRuntimeAsset & {
  localStatus?: "uploading" | "ready" | "failed";
  localTarget?: SampleTarget;
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
type RuntimeJob = ThemeRuntimeData["jobs"][number];

type RuntimeOutputSlot = {
  index: number;
  status: "queued" | "running" | "succeeded" | "failed";
  stage?: string;
  storageKey?: string;
  previewUrl?: string;
  mimeType?: string;
  error?: string;
  updatedAt?: string;
};

type WorkspaceOutputRecord = {
  key: string;
  index?: number;
  storageKey?: string;
  previewUrl?: string;
  mimeType?: string;
};

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

function workspaceJobTitle(job: RuntimeJob): string {
  const fields = jobFields(job);
  const title = fields.creativePackName ?? fields.packageName ?? fields.toolName ?? fields.prompt;
  return typeof title === "string" && title.trim() ? title.trim().slice(0, 80) : "AI photo request";
}

function workspaceJobStageLabel(job: RuntimeJob): string {
  const stage = jobResult(job).lastWorkerStage;
  const fields = jobFields(job);
  const isVideoRequest = [fields.toolPresetId, fields.toolPresetTitle, job.requestJson?.outputType]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase()
    .includes("video");
  if (job.status === "failed") return "Generation failed";
  if (job.status === "succeeded") return isVideoRequest ? "Video delivered" : "Images delivered";
  if (stage === "local_worker_started") return "Preparing the generator";
  if (stage === "local_video_worker_started") return "Preparing the video generator";
  if (stage === "source_images_ready") return "Reading selected photos";
  if (stage === "provider_request_started") return "Generating images";
  if (stage === "video_provider_request_started" || stage === "video_task_created") return "Generating video";
  if (typeof stage === "string" && stage.startsWith("video_provider_running")) return "Generating video";
  if (stage === "video_result_received") return "Saving generated video";
  if (stage === "provider_response_received") return "Saving generated images";
  if (job.status === "queued") return "Waiting in queue";
  if (job.status === "running") return isVideoRequest ? "Generating video" : "Generating images";
  return "Request updated";
}

function workspaceJobBody(job: RuntimeJob): string {
  const result = jobResult(job);
  if (job.status === "failed") {
    const error = typeof result.error === "string" ? result.error : "";
    if (error.includes("timeout") || error.includes("UND_ERR_CONNECT_TIMEOUT")) return "The image provider did not respond in time. Credits were returned automatically, and you can retry after a short wait.";
    if (error.includes("fetch failed")) return "The image provider connection failed before it returned images. Credits were returned automatically, and you can retry.";
    return "The generator could not finish this request. Credits were returned automatically, and you can retry from the same workspace.";
  }
  if (result.lastWorkerStage === "provider_request_started") {
    const elapsedMs = Date.now() - new Date(job.updatedAt).getTime();
    if (elapsedMs > 4 * 60_000) return "The image model is taking longer than expected. If it does not return soon, credits will be released automatically and you can retry.";
    return "Your selected photos and prompt are with the image model. This is usually the longest step.";
  }
  if (result.lastWorkerStage === "source_images_ready") return "Your selected photos are being prepared for generation.";
  if (job.status === "queued") return "Credits are held and this request is waiting for the generator.";
  return "The workspace updates when the generator sends progress.";
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
      storageKey: typeof record.storageKey === "string" ? record.storageKey : undefined,
      mimeType: typeof record.mimeType === "string" ? record.mimeType : undefined,
      error: typeof record.error === "string" ? record.error : undefined,
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
        : job.status === "failed" || job.status === "succeeded"
          ? "failed"
          : job.status === "running"
            ? "running"
            : "queued"
    };
  });
}

function slotLabel(slot: RuntimeOutputSlot): string {
  if (slot.status === "succeeded") return "Delivered";
  if (slot.status === "failed") return "Failed";
  if (slot.status === "running") return "Generating";
  return "Queued";
}

function workspaceSlotProgress(slot: RuntimeOutputSlot): number {
  if (slot.status === "succeeded" || slot.status === "failed") return 100;
  if (slot.stage === "provider_response_received") return 88;
  if (slot.stage === "provider_request_started") return 62;
  if (slot.stage === "source_images_ready") return 42;
  if (slot.stage === "local_worker_started") return 25;
  if (slot.status === "running") return 35;
  return 8;
}

function workspaceSlotProgressText(slot: RuntimeOutputSlot): string {
  if (slot.status === "succeeded") return "Output ready";
  if (slot.status === "failed") return "Needs retry";
  if (slot.stage === "provider_response_received") return "Saving output";
  if (slot.stage === "provider_request_started") return "Generating output";
  if (slot.stage === "source_images_ready") return "Preparing photos";
  if (slot.stage === "local_worker_started") return "Preparing request";
  if (slot.status === "running") return "Generating output";
  return "Waiting for this slot";
}

function workspaceSlotSummary(slots: RuntimeOutputSlot[]): string {
  const delivered = slots.filter((slot) => slot.status === "succeeded").length;
  const failed = slots.filter((slot) => slot.status === "failed").length;
  const pending = slots.length - delivered - failed;
  const parts = [`${delivered} of ${slots.length} delivered`];
  if (pending > 0) parts.push(`${pending} pending`);
  if (failed > 0) parts.push(`${failed} failed`);
  return parts.join(" · ");
}

function workspaceJobSlotStageLabel(job: RuntimeJob, slots: RuntimeOutputSlot[]): string {
  if (slots.length <= 1) return workspaceJobStageLabel(job);
  const delivered = slots.filter((slot) => slot.status === "succeeded").length;
  const failed = slots.filter((slot) => slot.status === "failed").length;
  const pending = slots.length - delivered - failed;
  if (delivered === slots.length) return "Images delivered";
  if (failed > 0 && delivered > 0) return "Some images need attention";
  if (failed > 0 && pending === 0) return "Generation failed";
  if (delivered > 0 && pending > 0) return "More images are still generating";
  if (pending > 0) return "Images are generating";
  return workspaceJobStageLabel(job);
}

function workspaceJobStatusBadge(job: RuntimeJob, slots: RuntimeOutputSlot[]): string {
  const delivered = slots.filter((slot) => slot.status === "succeeded").length;
  const failed = slots.filter((slot) => slot.status === "failed").length;
  const pending = slots.length - delivered - failed;
  if (slots.length > 1 && failed === slots.length) return "failed";
  if (slots.length > 1 && delivered > 0 && failed > 0) return "partial";
  if (slots.length > 1 && delivered > 0 && pending > 0) return "partial";
  return job.status;
}

function normalizedWorkspaceStorageKey(storageKey: string): string {
  return storageKey.replace(/\\/g, "/").replace(/^\/+/, "").replace(/^customer-assets\//, "");
}

function workspaceStoragePreviewUrl(storageKey: string): string {
  if (storageKey.startsWith("/")) return storageKey;
  return `/api/local-assets/${normalizedWorkspaceStorageKey(storageKey)}`;
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

function useWorkspaceRuntime(siteId: string, refreshKey = 0, enabled = true): WorkspaceRuntimeState {
  const [state, setState] = useState<WorkspaceRuntimeState>(() => enabled ? { status: "loading", refreshKey } : { status: "idle" });

  useEffect(() => {
    if (!enabled) {
      setState((current) => current.status === "ready" || current.status === "loading" ? current : { status: "idle" });
      return;
    }
    const controller = new AbortController();
    const refreshParam = refreshKey > 0 ? `&refresh=${refreshKey}` : "";
    setState((current) => current.status === "ready" ? { status: "loading", refreshKey, runtime: current.runtime } : { status: "loading", refreshKey });
    fetch(`/api/sites/${siteId}/customer/runtime?profile=workspace${refreshParam}`, {
      cache: "no-store",
      credentials: "same-origin",
      signal: controller.signal
    })
      .then(async (response) => {
        const data = (await response.json().catch(() => ({}))) as { ok?: boolean; runtime?: ThemeRuntimeData; error?: string };
        if (!response.ok || !data.ok || !data.runtime) throw new Error(data.error || "workspace_runtime_unavailable");
        setState({ status: "ready", refreshKey, runtime: data.runtime });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
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
  { id: "generate", label: "Generate Image", panel: "create", anchor: "step-create" },
  { id: "try-on", label: "Try-On", panel: "create", anchor: "step-create" },
  { id: "video", label: "Image to Video", panel: "create", anchor: "step-create" },
  { id: "background", label: "Change Background", panel: "create", anchor: "step-create" },
  { id: "model", label: "Create New AI Model", panel: "create", anchor: "source-photos" }
];

const studioGenderOptions = [
  { id: "man", label: "Man", icon: UserRound },
  { id: "woman", label: "Woman", icon: Users },
  { id: "nonbinary", label: "N-Bi", icon: UserRound }
];

export function CustomerWorkspaceShell({
  site,
  customer,
  assets,
  siteAiApps,
  creativePacks,
  initialCreativePackId,
  initialToolId,
  initialRuntime,
  initialPanel = "overview"
}: {
  site: CustomerWorkspaceSite;
  customer: PublicCustomer;
  assets: ThemeRuntimeAsset[];
  siteAiApps: SiteAiApp[];
  creativePacks: CreativePack[];
  initialCreativePackId?: string;
  initialToolId?: string;
  initialRuntime?: ThemeRuntimeData;
  initialPanel?: CustomerWorkspacePanel;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathModeBasePath = pathname.match(/^\/site\/[^/]+/)?.[0];
  const basePath = pathModeBasePath ?? hostAwareSitePath(site, "/").replace(/\/$/, "");
  const prefetchPaths = useMemo(
    () => [basePath || "/", `${basePath}/collections`, `${basePath}/tools`, `${basePath}/pricing`, `${basePath}/#faq`, `${basePath}/app/create`],
    [basePath]
  );
  const [runtimeRefreshKey, setRuntimeRefreshKey] = useState(0);
  const [runtimeFetchEnabled, setRuntimeFetchEnabled] = useState(false);
  const runtimeState = useWorkspaceRuntime(site.id, runtimeRefreshKey, runtimeFetchEnabled);
  const runtime = runtimeState.runtime ?? initialRuntime;
  const [runtimeAssets, setRuntimeAssets] = useState<ThemeRuntimeAsset[]>(() => initialRuntime?.assets ?? assets);
  const hydratedAssets = runtimeAssets;
  const recentJobs = runtime?.jobs ?? [];
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
  const [activeStudioSection, setActiveStudioSection] = useState<StudioConsoleSectionId | null>("model");
  const [studioModelName, setStudioModelName] = useState("");
  const [studioTrainingMode, setStudioTrainingMode] = useState<"single" | "couple">(isAidreamcapes ? "single" : "couple");
  const [primaryGender, setPrimaryGender] = useState("nonbinary");
  const [partnerGender, setPartnerGender] = useState("nonbinary");
  const [selectedPreviewAssetId, setSelectedPreviewAssetId] = useState<string | null>(null);
  const [sampleAssets, setSampleAssets] = useState<SampleAsset[]>(() => hydratedAssets.filter((asset) => asset.role === "input" || asset.role === "training_input"));
  const [primarySampleIds, setPrimarySampleIds] = useState<string[]>([]);
  const [partnerSampleIds, setPartnerSampleIds] = useState<string[]>([]);
  const [uploadingSampleTarget, setUploadingSampleTarget] = useState<SampleTarget | null>(null);
  const [sampleUploadMessage, setSampleUploadMessage] = useState("Upload samples to preview them here before generation.");
  const [workspaceNotice, setWorkspaceNotice] = useState("");
  const [runtimeRefreshMessage, setRuntimeRefreshMessage] = useState("");
  const [manualRefreshPending, setManualRefreshPending] = useState(false);
  const [manualRefreshKey, setManualRefreshKey] = useState<number | null>(null);
  const eventRefreshKeyRef = useRef<number | null>(null);
  const [focusedJobId, setFocusedJobId] = useState<string | null>(null);
  const [previewSampleId, setPreviewSampleId] = useState<string | null>(null);
  const [deletingSampleId, setDeletingSampleId] = useState<string | null>(null);
  const [sampleDeleteConfirm, setSampleDeleteConfirm] = useState<{ assets: SampleAsset[]; label: string } | null>(null);
  const sampleUploadInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSampleTargetRef = useRef<SampleTarget>("primary");
  const sampleBlobUrlsRef = useRef<Set<string>>(new Set());
  const restoredSampleSelectionRef = useRef(false);
  const syncedInitialSamplesRef = useRef(false);
  const sampleSelectionStorageKey = useMemo(() => `dreamshoot:workspace:${site.id}:${customer.id}:sample-selection:v1`, [customer.id, site.id]);
  const tabItems: Array<{ id: WorkspaceResourceTab; label: string }> = useMemo(
    () => [
      { id: "all", label: "All" },
      { id: "recent", label: "Recent" },
      { id: "favorites", label: "Favorites" },
      { id: "try-on", label: "Try-on" },
      { id: "videos", label: "Videos" },
      { id: "packages", label: "Pick Package" }
    ],
    []
  );
  const galleryAssets = hydratedAssets.filter((asset) => shouldShowAssetOnSurface(asset, "workspace-gallery"));
  const sourceAssets = sampleAssets;
  const readySourceAssets = sourceAssets.filter((asset) => !asset.id.startsWith("local:") && asset.localStatus !== "uploading" && asset.localStatus !== "failed");
  const readyPrimarySampleIds = primarySampleIds.filter((id) => readySourceAssets.some((asset) => asset.id === id));
  const readyPartnerSampleIds = partnerSampleIds.filter((id) => readySourceAssets.some((asset) => asset.id === id));
  const previewSamples = sourceAssets.filter((asset) => asset.localStatus !== "failed");
  const previewSampleIndex = previewSampleId ? previewSamples.findIndex((asset) => asset.id === previewSampleId) : -1;
  const previewSample = previewSampleIndex >= 0 ? previewSamples[previewSampleIndex] : undefined;
  const activeJobs = recentJobs.filter((job) => job.status === "queued" || job.status === "running").length;
  const failedJobs = recentJobs.filter((job) => job.status === "failed").length;
  const runtimeIsLoading = runtimeState.status === "loading";
  const runtimeIsInitializing = !runtime && (runtimeState.status === "idle" || runtimeState.status === "loading");
  const completedRuntimeRefreshKey = runtimeState.status === "ready" || runtimeState.status === "error" ? runtimeState.refreshKey : null;
  const resourceTitleByTab: Record<WorkspaceResourceTab, string> = {
    all: "All assets",
    recent: "Recent generations",
    favorites: "Favorite selections",
    "try-on": "Try-on results",
    videos: "Video concepts",
    packages: "Available packages"
  };

  useEffect(() => {
    if (runtimeFetchEnabled) return;
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
  }, [runtimeFetchEnabled]);

  useEffect(() => {
    const jobStatus = searchParams.get("job_status");
    if (jobStatus !== "unavailable" && jobStatus !== "workspace") return;
    const jobId = searchParams.get("job_id");
    setFocusedJobId(jobId);
    setWorkspaceNotice(
      jobStatus === "workspace"
        ? "Request status is shown in your workspace. The list has been refreshed so you can review the latest generation result."
        : jobId
          ? "That request is still syncing or is no longer available from this session. Your workspace has been refreshed so you can review the latest request status."
          : "That request is still syncing or is no longer available from this session. Your workspace has been refreshed."
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
          return JSON.parse(event.data) as { jobId?: unknown; status?: unknown };
        } catch {
          return {};
        }
      })();
      if (typeof payload.jobId !== "string") return;
      const eventJobId = payload.jobId;
      setFocusedJobId((current) => current ?? eventJobId);
      setRuntimeFetchEnabled(true);
      setRuntimeRefreshMessage(
        payload.status === "succeeded" || payload.status === "failed"
          ? "Generator callback received. Refreshing workspace."
          : "Generator progress received. Refreshing workspace."
      );
      setRuntimeRefreshKey((current) => {
        const next = current + 1;
        eventRefreshKeyRef.current = next;
        return next;
      });
    };
    events.addEventListener("job", refreshFromJobEvent);
    return () => {
      events.removeEventListener("job", refreshFromJobEvent);
      events.close();
    };
  }, [site.id]);

  useEffect(() => {
    if (!manualRefreshPending || manualRefreshKey === null || completedRuntimeRefreshKey !== manualRefreshKey) return;
    if (runtimeState.status === "ready") {
      setManualRefreshPending(false);
      setManualRefreshKey(null);
      setRuntimeRefreshMessage(`Last checked ${workspaceJobTime(new Date().toISOString())}`);
    }
    if (runtimeState.status === "error") {
      setManualRefreshPending(false);
      setManualRefreshKey(null);
      setRuntimeRefreshMessage("Status refresh failed. Try again.");
    }
  }, [completedRuntimeRefreshKey, manualRefreshKey, manualRefreshPending, runtimeState.status]);
  useEffect(() => {
    const eventRefreshKey = eventRefreshKeyRef.current;
    if (eventRefreshKey === null || completedRuntimeRefreshKey !== eventRefreshKey) return;
    eventRefreshKeyRef.current = null;
    if (runtimeState.status === "ready") {
      setRuntimeRefreshMessage(`Updated from generator callback ${workspaceJobTime(new Date().toISOString())}`);
    }
    if (runtimeState.status === "error") {
      setRuntimeRefreshMessage("Generator callback received, but workspace refresh failed. Use Check now.");
    }
  }, [completedRuntimeRefreshKey, runtimeState.status]);
  useEffect(() => {
    setRuntimeAssets(runtime?.assets ?? initialRuntime?.assets ?? assets);
  }, [assets, initialRuntime?.assets, runtime?.assets]);
  const allResourceAssets = galleryAssets;
  const tryOnJobIds = new Set(
    recentJobs
      .filter((job) => JSON.stringify(job.requestJson ?? {}).toLowerCase().includes("try-on"))
      .map((job) => job.id)
  );
  const todayResourceAssets = galleryAssets.filter((asset) => isSameLocalDay(asset.createdAt, new Date()));
  const visibleResourceAssets =
    resourceTab === "all"
      ? allResourceAssets
      : resourceTab === "videos"
        ? galleryAssets.filter((asset) => asset.mimeType.startsWith("video/"))
      : resourceTab === "try-on"
        ? galleryAssets.filter((asset) => asset.jobId ? tryOnJobIds.has(asset.jobId) : false)
      : resourceTab === "recent"
        ? todayResourceAssets
      : resourceTab === "favorites"
        ? galleryAssets.filter((asset) => asset.isFavorite)
        : allResourceAssets;
  const selectedPreviewIndex = selectedPreviewAssetId ? Math.max(0, visibleResourceAssets.findIndex((asset) => asset.id === selectedPreviewAssetId)) : -1;
  const selectedPreviewAsset = selectedPreviewIndex >= 0 ? visibleResourceAssets[selectedPreviewIndex] : undefined;
  const outputCopyJobs = useMemo(() => recentJobs.map(outputCopyJob).filter((job): job is OutputCopyJob => Boolean(job)), [recentJobs]);
  const jobById = useMemo(() => new Map(outputCopyJobs.map((job) => [job.id, job])), [outputCopyJobs]);
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
      urls.set(normalizedWorkspaceStorageKey(asset.storageKey), asset.previewUrl);
    });
    return urls;
  }, [galleryAssets]);
  const workspaceSlotPreviewUrl = (storageKey: string) =>
    outputPreviewUrlByStorageKey.get(normalizedWorkspaceStorageKey(storageKey)) ?? workspaceStoragePreviewUrl(storageKey);
  const visibleStatusJobs = useMemo(() => {
    const focusedJob = focusedJobId ? recentJobs.find((job) => job.id === focusedJobId) : undefined;
    if (focusedJob) return [focusedJob];
    const activeJob = recentJobs.find((job) => job.status === "queued" || job.status === "running");
    return [activeJob ?? recentJobs[0]].filter((job): job is RuntimeJob => Boolean(job));
  }, [focusedJobId, recentJobs]);
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
  const selectedPreviewCopy = selectedPreviewAsset ? outputCopyForAsset(selectedPreviewAsset) : undefined;
  function renderResourceAssetCard(asset: ThemeRuntimeAsset) {
    const outputCopy = outputCopyForAsset(asset);
    const video = isVideoAsset(asset);
    return (
      <div className="group grid h-full min-h-[390px] overflow-hidden rounded-[12px] border border-white/8 bg-[#0d1118] transition hover:border-white/20" key={asset.id}>
        <div className="relative self-start">
          {video ? (
            <div className="relative">
              <video
                className="aspect-[4/5] w-full object-cover"
                controls
                muted
                playsInline
                preload="metadata"
                src={asset.previewUrl}
              />
              <button
                className="absolute bottom-3 left-3 rounded-full border border-white/18 bg-black/56 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur transition hover:bg-white/14"
                onClick={() => setSelectedPreviewAssetId(asset.id)}
                type="button"
              >
                Open preview
              </button>
            </div>
          ) : (
            <button className="block w-full text-left" onClick={() => setSelectedPreviewAssetId(asset.id)} type="button">
              <img alt={outputCopy.title} className="aspect-[4/5] w-full object-cover transition duration-200 group-hover:scale-[1.03]" src={asset.previewUrl} />
            </button>
          )}
          <button
            aria-label={asset.isFavorite ? "Remove from favorites" : "Add to favorites"}
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
            <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-xs leading-5 text-white/42" title={outputCopy.description}>{outputCopy.description}</p>
          </div>
          <CustomerAssetDownloadButton
            assetId={asset.id}
            className="inline-flex h-10 w-full items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1] disabled:cursor-wait disabled:opacity-60"
            customerId={customer.id}
            label="Download"
            siteId={site.id}
          />
        </div>
      </div>
    );
  }
  const showUploadStep = activePanel === "upload";
  const showCreateStep = activePanel === "create";
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
    scrollToWorkspaceAnchor(anchor);
  }

  function chooseResourceTab(tab: WorkspaceResourceTab) {
    setActivePanel("overview");
    setResourceTab(tab);
    scrollToWorkspaceAnchor(`resources-${tab}`);
  }

  function requestWorkspaceRefresh() {
    setRuntimeFetchEnabled(true);
    setManualRefreshPending(true);
    setRuntimeRefreshMessage("");
    setRuntimeRefreshKey((current) => {
      const next = current + 1;
      setManualRefreshKey(next);
      return next;
    });
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
      setRuntimeRefreshMessage("Favorite update failed. Try again.");
      return;
    }
    setRuntimeAssets((current) => current.map((item) => item.id === result.asset!.id ? result.asset! : item));
    setSelectedPreviewAssetId((current) => current === result.asset!.id ? result.asset!.id : current);
  }

  function showJobStatus(jobId: string) {
    setFocusedJobId(jobId);
    setRuntimeFetchEnabled(true);
    setRuntimeRefreshKey((current) => current + 1);
    setWorkspaceNotice(`Request ${jobId} was created. Your workspace is refreshing so you can follow the latest status here.`);
    setActivePanel("overview");
    setResourceTab("all");
    window.setTimeout(() => {
      document.getElementById("resources-all")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
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
    return sourceAssets.filter((asset) => sampleTargetFor(asset) === target || (target === "primary" && !asset.subjectRole && !asset.localTarget));
  }

  function toggleSampleSelection(target: SampleTarget, asset: SampleAsset) {
    if (asset.localStatus === "uploading" || asset.localStatus === "failed") return;
    const updateIds = (current: string[]) => {
      if (current.includes(asset.id)) return current.filter((id) => id !== asset.id);
      if (current.length >= 15) {
        setSampleUploadMessage("Use up to 15 selected samples per request.");
        return current;
      }
      return [asset.id, ...current];
    };
    if (target === "partner") {
      setPartnerSampleIds(updateIds);
    } else {
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
      setSampleUploadMessage(remoteIds.length === 1 ? "We could not delete this sample. Please refresh and try again." : "We could not delete every selected sample. Please refresh and try again.");
      setRuntimeRefreshKey((current) => current + 1);
      return;
    }
    setSampleUploadMessage(remoteIds.length === 1 ? "Sample deleted." : `${remoteIds.length} samples deleted.`);
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
    requestSampleDelete([asset], asset.label || "sample");
  }

  async function uploadSidebarSamples(files: FileList | null) {
    const imageFiles = Array.from(files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setSampleUploadMessage("Choose one or more image files before uploading.");
      return;
    }
    const target = pendingSampleTargetRef.current;
    setUploadingSampleTarget(target);
    setSampleUploadMessage(`Uploading ${imageFiles.length} sample${imageFiles.length === 1 ? "" : "s"}...`);
    const now = Date.now();
    const optimisticAssets: SampleAsset[] = imageFiles.map((file, index) => ({
      id: `local:${target}:${now}:${index}`,
      label: file.name.replace(/\.[^.]+$/, "") || `sample ${index + 1}`,
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
      const formData = new FormData();
      formData.append("file", file);
      formData.append("label", file.name.replace(/\.[^.]+$/, "") || `sample ${index + 1}`);
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
        setSampleUploadMessage(`We could not upload ${file.name}. Please try again.`);
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
    setSampleUploadMessage(`${createdAssets.length} sample${createdAssets.length === 1 ? "" : "s"} uploaded and selected.`);
    setUploadingSampleTarget(null);
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
  }

  function movePreview(direction: -1 | 1) {
    if (!visibleResourceAssets.length) return;
    const currentIndex = selectedPreviewIndex >= 0 ? selectedPreviewIndex : 0;
    const nextIndex = (currentIndex + direction + visibleResourceAssets.length) % visibleResourceAssets.length;
    setSelectedPreviewAssetId(visibleResourceAssets[nextIndex].id);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const anchor = window.location.hash.replace("#", "") as WorkspaceAnchor | "";
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
    window.setTimeout(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }), 0);
  }, [tabItems]);

  useEffect(() => {
    const nextSamples = hydratedAssets.filter((asset) => asset.role === "input" || asset.role === "training_input");
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
    window.localStorage.setItem(sampleSelectionStorageKey, JSON.stringify({
      primarySampleIds,
      partnerSampleIds,
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
      setRuntimeRefreshKey((current) => current + 1);
    };
    window.addEventListener("customer-assets:updated", handleAssetsUpdated);
    return () => window.removeEventListener("customer-assets:updated", handleAssetsUpdated);
  }, []);

  useEffect(() => () => {
    sampleBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    sampleBlobUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (!selectedPreviewAssetId) return;
    if (!visibleResourceAssets.some((asset) => asset.id === selectedPreviewAssetId)) {
      setSelectedPreviewAssetId(null);
    }
  }, [selectedPreviewAssetId, visibleResourceAssets]);

  return (
    <div className="min-h-screen bg-[#07090d] font-sans text-white">
      <CustomerRoutePrefetch paths={prefetchPaths} />
      <StorefrontNavigationFeedback />
      <CustomerShellHeader creativePacks={creativePacks} customer={customer} site={site} tone="dark" />

      <main className="grid min-h-[calc(100vh-97px)] border-t border-white/8 lg:grid-cols-[430px_minmax(0,1fr)] xl:grid-cols-[450px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-[#0b0c0f] px-3 py-4 lg:sticky lg:top-[98px] lg:h-[calc(100vh-98px)] lg:overflow-y-auto lg:border-b-0 lg:border-r xl:px-4">
          <div className="rounded-[16px] border border-white/10 bg-[#0f1116] p-4">
            <p className="text-sm font-semibold text-white/84">{customerModels[0]?.label ?? "No Model Selected"}</p>
            {customerModels[0] ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/46">
                <Heart className="h-3.5 w-3.5 fill-[#ff4aa2] text-[#ff4aa2]" strokeWidth={1.8} />
                {customerModels[0].status}
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-white/46">Create a private model before package generation.</p>
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
                    onClick={() => {
                      setActiveStudioSection((current) => current === section.id ? null : section.id);
                    }}
                    type="button"
                  >
                    <span>{section.label}</span>
                    <ChevronDown className={`h-4 w-4 text-white/42 transition ${expanded ? "rotate-180 text-white/70" : ""}`} strokeWidth={1.8} />
                  </button>
                  {expanded ? (
                    section.id === "model" ? (
                      <div className="grid gap-4 pb-5" id={`studio-console-${section.id}`}>
                        <div className="rounded-[14px] border border-white/20 bg-[#111318] p-4">
                          <p className="text-sm font-semibold">{isAidreamcapes ? "Train Travel Model" : "Train Model"}</p>
                          <p className="mt-2 text-xs leading-5 text-white/58">
                            Add clear photos for each person when available. You can continue without a minimum, and each request can use up to 15 photos.
                          </p>
                          <div className="mt-4 flex items-center gap-3">
                            <span className="text-xs font-semibold text-white/70">Training Mode:</span>
                            <div className="inline-grid grid-cols-2 overflow-hidden rounded-[12px] border border-white/10 bg-white/[0.04]">
                              {(["single", "couple"] as const).map((mode) => (
                                <button
                                  className={`px-4 py-2 text-xs font-semibold transition ${studioTrainingMode === mode ? "bg-[#3f5066] text-white" : "text-white/54 hover:bg-white/[0.05] hover:text-white"}`}
                                  key={mode}
                                  onClick={() => setStudioTrainingMode(mode)}
                                  type="button"
                                >
                                  {mode === "single" ? "Single" : "Couple"}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-2 rounded-[14px] border border-white/12 bg-[#101216] p-4 text-sm font-semibold text-white">
                          <label htmlFor="studio-model-name">Name</label>
                          <span className="text-xs font-normal leading-5 text-white/52">Give your model a name so you can easily identify it later.</span>
                          <input
                            autoComplete="off"
                            className="relative z-10 rounded-[10px] border border-white/10 bg-[#05070b] px-3 py-3 text-sm font-normal text-white outline-none transition placeholder:text-white/32 focus:border-[#ff4aa2]/70"
                            id="studio-model-name"
                            onChange={(event) => setStudioModelName(event.target.value)}
                            placeholder={studioTrainingMode === "couple" ? "e.g. Natalie and Jack Photos" : "e.g. Natalie Photos"}
                            type="text"
                            value={studioModelName}
                          />
                        </div>

                        <div className="grid gap-3 rounded-[14px] border border-white/12 bg-[#101216] p-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <p className="text-sm font-semibold">{studioTrainingMode === "couple" ? "Your Gender" : "Subject Gender"}</p>
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
                                      <span>{option.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {studioTrainingMode === "couple" ? (
                              <div>
                                <p className="text-sm font-semibold">Partner Gender</p>
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
                                        <span>{option.label}</span>
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
                                { id: "primary" as const, title: "Your Samples", body: "Upload photos for the primary person." },
                                { id: "partner" as const, title: "Partner Samples", body: "Upload photos for the partner person." }
                              ]
                            : [{ id: "primary" as const, title: "Your Samples", body: "Upload photos for this private model." }]
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
                                      {group.body} {selectedGroupAssets.length} selected. Tap a photo to choose samples, then delete selected if needed.
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
                                        {remoteDeleting ? "Deleting" : selectedGroupAssets.length ? "Delete selected" : "Select to delete"}
                                      </button>
                                    ) : null}
                                    <button
                                      className="rounded-[10px] border border-white/12 bg-white/[0.06] px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                                      disabled={uploadingSampleTarget === group.id}
                                      onClick={() => openSidebarSamplePicker(group.id)}
                                      type="button"
                                    >
                                      {uploadingSampleTarget === group.id ? "Uploading" : "Upload"}
                                    </button>
                                  </div>
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-2" role="list" aria-label={`${group.title} samples`}>
                                  {groupAssets.slice(0, 15).map((asset) => {
                                    const selected = selectedIds.includes(asset.id);
                                    const selectable = asset.localStatus !== "uploading" && asset.localStatus !== "failed";
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
                                          title={selected ? "Selected for this request" : "Select this sample"}
                                          type="button"
                                        >
                                          <img alt={asset.label} className={`aspect-square w-full object-cover transition group-hover/sample:scale-[1.03] ${selected ? "brightness-105" : "opacity-72"}`} src={asset.previewUrl} />
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
                                          {selected ? "Selected" : "Tap to select"}
                                        </span>
                                      {asset.localStatus === "uploading" ? (
                                        <span className="absolute inset-0 grid place-items-center bg-black/52 text-[11px] font-semibold text-white">Uploading</span>
                                      ) : null}
                                      {asset.localStatus === "failed" ? (
                                        <span className="absolute inset-0 grid place-items-center bg-rose-950/70 px-2 text-center text-[11px] font-semibold text-white">Failed</span>
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
                                      Click Upload to select image files.
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
                            disabled={!primarySampleIds.length && !partnerSampleIds.length}
                            onClick={() => {
                              setAppliedOperationContext({
                                action: isAidreamcapes ? "Travel model training" : "AI model training",
                                note: studioModelName.trim() || undefined,
                                source: "Create New AI Model"
                              });
                              setPreferredCreateMode("theme");
                              setPreferredCreateModeRequest((current) => current + 1);
                              choosePanel("create", "step-create");
                            }}
                            type="button"
                          >
                            Train Model ({studioTrainingMode === "couple" ? 100 : 50} credits)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-3 pb-5" id={`studio-console-${section.id}`}>
                        <div className="rounded-[14px] border border-white/12 bg-[#101216] p-4">
                          <p className="text-sm font-semibold">{section.label}</p>
                          <p className="mt-2 text-xs leading-5 text-white/52">
                            Use the main window to select a package or tool, then return here for model setup and sample maintenance.
                          </p>
                          <button
                            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-white/12 bg-white/[0.06] px-4 py-3 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
                            onClick={() => {
                              if (section.id === "video") setPreferredCreateMode("tool");
                              choosePanel(section.panel, section.anchor);
                            }}
                            type="button"
                          >
                            Open workspace
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
                  {tabItems.map((tab) => (
                <button
                  className={`inline-flex min-h-10 items-center justify-center rounded-[10px] px-4 text-sm font-semibold transition ${
                    resourceTab === tab.id && (activePanel === "overview" || tab.id === "packages")
                      ? "bg-[#2f6fed] text-white"
                      : "bg-[#1d2633] text-white/62 hover:bg-[#283345] hover:text-white"
                  }`}
                  key={tab.id}
                  onClick={() => {
                    if (tab.id === "packages") {
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
                  Credits: {customer.balance.available}
                </span>
                <span>{resourceTitleByTab[resourceTab]}</span>
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
                  Dismiss
                </button>
              </div>
            ) : null}
            <div className="grid gap-5">
              {showUploadStep ? (
              <section className="scroll-mt-28 rounded-[22px] border border-white/10 bg-[#0c0f16] p-4 shadow-[0_24px_80px_-62px_rgba(0,0,0,0.92)] md:p-5" id="step-upload">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">Step 01</p>
                    <h2 className="mt-2 text-xl font-semibold">Upload selfies</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">
                      Upload private selfies or reference images for the selected AI request. These files stay in your signed-in workspace.
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/58">
                    {sourceAssets.length} private photos
                  </span>
                </div>
                {runtimeIsInitializing ? <WorkspaceInlineLoading label="Loading your private uploads in this panel." /> : null}
                {runtimeState.status === "error" ? (
                  <div className="rounded-[18px] border border-dashed border-white/12 bg-white/[0.035] p-4 text-sm text-white/64">
                    Workspace activity could not load. You can refresh the page or open your account center.
                  </div>
                ) : null}
                <div className={runtimeIsInitializing ? "mt-4" : undefined}>
                  <AssetsPanel assets={hydratedAssets} customer={customer} onContinueToCreate={() => choosePanel("create", "step-create")} preferProvidedAssets siteId={site.id} tone="dark" />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-sm leading-6 text-white/58">
                    {sourceAssets.length ? "Your private photos are ready. Continue to choose a package or tool." : "You can continue without a minimum photo count, or upload samples for stronger results."}
                  </p>
                  <button
                    className="rounded-full border border-white/12 bg-white px-5 py-2.5 text-sm font-semibold text-[#101114] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45"
                    disabled={!sourceAssets.length}
                    onClick={() => choosePanel("create", "step-create")}
                    type="button"
                  >
                    Choose package or tool
                  </button>
                </div>
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
                      <h2 className="text-base font-semibold">Start your AI photoshoot</h2>
                      <p className="mt-1 text-xs text-white/50">Choose a package, upload selfies, confirm credits, then start your private request.</p>
                    </div>
                  </div>
                  <span className="hidden rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/58 sm:inline-flex">
                    {customer.balance.available} credits
                  </span>
                </div>
                <div className="p-4 md:p-5">
                  <JobCreateForm
                    assets={hydratedAssets}
                    creativePacks={creativePacks}
                    customer={customer}
                    customerModels={customerModels}
                    externalPartnerAssetIds={readyPartnerSampleIds}
                    externalPrimaryAssetIds={readyPrimarySampleIds}
                    externalSourceAssets={readySourceAssets}
                    initialCreativePackId={initialCreativePackId}
                    initialToolId={initialToolId}
                    operationContext={appliedOperationContext}
                    preferredMode={preferredCreateMode}
                    preferredModeRequest={preferredCreateModeRequest}
                    siteAiApps={siteAiApps}
                    siteId={site.id}
                    siteSlug={site.slug}
                    subscriptionStatus={subscriptionStatus}
                    trainingMode={studioTrainingMode}
                    onJobCreated={showJobStatus}
                    onContinueToSources={() => choosePanel("create", "source-photos")}
                    onOpenUploadManager={() => choosePanel("upload", "step-upload")}
                    onReviewCurrentRequest={showCurrentRequestReview}
                    preferProvidedAssets
                    tone="dark"
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
                    <p className="mt-1 text-xs text-white/42">{activeJobs} active jobs · {failedJobs} need attention · {visibleResourceAssets.length} generated items</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      className="rounded-[8px] border border-white/12 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white/66 hover:bg-white/[0.1] hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
                      disabled={runtimeIsLoading || manualRefreshPending}
                      onClick={requestWorkspaceRefresh}
                      type="button"
                    >
                      {runtimeIsLoading || manualRefreshPending ? "Refreshing..." : "Refresh status"}
                    </button>
                    <button
                      className="rounded-[8px] bg-[#2f6fed] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4380ff]"
                      onClick={() => {
                        setPreferredCreateMode("theme");
                        setPreferredCreateModeRequest((current) => current + 1);
                        setResourceTab("packages");
                        choosePanel("create", "step-create");
                      }}
                      type="button"
                    >
                      Pick Package
                    </button>
                  </div>
                </div>
                <p className="min-h-5 px-2 pt-2 text-right text-xs text-white/40" role="status">
                  {runtimeRefreshMessage || (runtimeIsLoading || manualRefreshPending ? "Refreshing status..." : "")}
                </p>

                {runtimeIsInitializing && !visibleResourceAssets.length ? (
                  <div className="p-5"><WorkspaceInlineLoading label="Loading workspace resources." /></div>
                ) : null}

                {resourceTab === "all" && visibleStatusJobs.length ? (
                  <div className="grid gap-3 border-b border-white/6 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-white/80">Request progress</p>
                      <button
                        className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/52 transition hover:bg-white/[0.07] hover:text-white/78 disabled:cursor-not-allowed disabled:opacity-45"
                        disabled={runtimeIsLoading || manualRefreshPending}
                        onClick={requestWorkspaceRefresh}
                        type="button"
                      >
                        {runtimeIsLoading || manualRefreshPending ? "Checking..." : "Check now"}
                      </button>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {visibleStatusJobs.map((job) => {
                        const outputAssets = outputAssetsByJobId.get(job.id) ?? [];
                        const slots = workspaceJobOutputSlots(job, outputAssets);
                        const failed = job.status === "failed" || slots.some((slot) => slot.status === "failed");
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
                                <p className="truncate text-sm font-semibold text-white" title={workspaceJobTitle(job)}>{workspaceJobTitle(job)}</p>
                                <p className={`mt-1 text-xs font-semibold ${failed ? "text-rose-200" : "text-amber-100"}`}>{workspaceJobSlotStageLabel(job, slots)}</p>
                              </div>
                              <span className="rounded-full border border-white/10 bg-black/22 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/60">
                                {workspaceJobStatusBadge(job, slots)}
                              </span>
                            </div>
                            <p className="mt-3 text-xs leading-5 text-white/54">{workspaceJobBody(job)}</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {slots.map((slot) => {
                                const slotSucceeded = slot.status === "succeeded";
                                const slotFailed = slot.status === "failed";
                                const slotVideo = slot.mimeType?.startsWith("video/");
                                const slotProgress = workspaceSlotProgress(slot);
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
                                    {slot.storageKey ? (
                                      slotVideo ? (
                                        <video
                                          className="aspect-[4/3] w-full object-cover"
                                          controls
                                          muted
                                          playsInline
                                          preload="metadata"
                                          src={slot.previewUrl ?? workspaceSlotPreviewUrl(slot.storageKey)}
                                        />
                                      ) : (
                                        <img
                                          alt={`Output ${slot.index}`}
                                          className="aspect-[4/3] w-full object-cover"
                                          src={slot.previewUrl ?? workspaceSlotPreviewUrl(slot.storageKey)}
                                        />
                                      )
                                    ) : (
                                      <div className="grid aspect-[4/3] place-items-center bg-black/18 px-3 text-center">
                                        <span className={`text-xs font-semibold ${slotFailed ? "text-rose-100/72" : "text-white/44"}`}>
                                          {workspaceSlotProgressText(slot)}
                                        </span>
                                      </div>
                                    )}
                                    <div className="flex items-center justify-between gap-2 px-3 py-2">
                                      <span className="text-[11px] font-semibold text-white/74">{slotVideo ? "Video" : "Image"} {slot.index}</span>
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
                                        slotSucceeded
                                          ? "bg-emerald-300/12 text-emerald-100"
                                          : slotFailed
                                            ? "bg-rose-300/12 text-rose-100"
                                            : "bg-white/8 text-white/48"
                                      }`}>
                                        {slotLabel(slot)}
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
                                                : "bg-[#31d4ff]"
                                          }`}
                                          style={{ width: `${slotProgress}%` }}
                                        />
                                      </div>
                                      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-white/38">
                                        <span className="truncate">{workspaceSlotProgressText(slot)}</span>
                                        <span className="shrink-0">{slotFailed ? "Stopped" : `${slotProgress}%`}</span>
                                      </div>
                                      {slotFailed && slot.error ? (
                                        <p className="mt-1 truncate text-[10px] text-rose-100/50" title={slot.error}>{slot.error}</p>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-white/38">
                              <span>{workspaceSlotSummary(slots)}</span>
                              <span>Updated {workspaceJobTime(job.updatedAt)}</span>
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
                          ? "No favorite images yet"
                          : resourceTab === "recent"
                            ? "No images generated today"
                            : resourceTab === "videos"
                              ? "No generated videos yet"
                              : "No generated images yet"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/42">
                        {resourceTab === "favorites"
                          ? "Use the heart button on generated images to collect them in Favorites."
                          : resourceTab === "recent"
                            ? "Recent shows only outputs created today. Older images remain available in All assets."
                            : resourceTab === "videos"
                              ? "Video outputs will appear here once a video request returns a video file."
                              : "Upload source photos in the creation flow, pick a package, then finished outputs will appear here."}
                      </p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button
                          className="rounded-[8px] border border-white/12 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white hover:bg-white/[0.1]"
                          onClick={() => choosePanel("create", "source-photos")}
                          type="button"
                        >
                          Upload samples
                        </button>
                        <button
                          className="rounded-[8px] bg-[#2f6fed] px-4 py-2 text-xs font-semibold text-white hover:bg-[#4380ff]"
                          onClick={() => {
                            setPreferredCreateMode("theme");
                            setPreferredCreateModeRequest((current) => current + 1);
                            setResourceTab("packages");
                            choosePanel("create", "step-create");
                          }}
                          type="button"
                        >
                          Pick Package
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              {selectedPreviewAsset ? (
                <div className="fixed inset-0 z-[90] grid place-items-center bg-black/82 p-4" role="dialog" aria-modal="true" aria-label="Generated asset preview">
                  <div className="relative grid max-h-[92vh] w-full max-w-6xl gap-3 overflow-hidden rounded-[14px] border border-white/12 bg-[#07090d] p-3 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.95)] md:grid-cols-[minmax(0,1fr)_260px]">
                    <button className="absolute right-4 top-4 z-10 rounded-full border border-white/12 bg-black/40 p-2 text-white transition hover:bg-white/10" onClick={() => setSelectedPreviewAssetId(null)} type="button">
                      <X className="h-4 w-4" strokeWidth={1.8} />
                    </button>
                    <div className="grid min-h-[52vh] place-items-center overflow-hidden rounded-[10px] bg-black">
                      {isVideoAsset(selectedPreviewAsset) ? (
                        <video className="max-h-[82vh] w-full object-contain" controls playsInline src={selectedPreviewAsset.previewUrl} />
                      ) : (
                        <img alt={selectedPreviewCopy?.title ?? selectedPreviewAsset.label} className="max-h-[82vh] w-full object-contain" src={selectedPreviewAsset.previewUrl} />
                      )}
                    </div>
                    <aside className="grid content-between gap-4 p-2 pr-10 md:pr-2">
                      <div>
                        <p className="text-xs font-semibold text-white/46">{isVideoAsset(selectedPreviewAsset) ? "Generated video" : "Generated output"}</p>
                        <h3 className="mt-2 break-words text-lg font-semibold text-white">{selectedPreviewCopy?.title ?? selectedPreviewAsset.label}</h3>
                        {selectedPreviewCopy?.description ? <p className="mt-2 text-sm leading-6 text-white/58">{selectedPreviewCopy.description}</p> : null}
                        <p className="mt-2 text-xs text-white/46">{selectedPreviewIndex + 1} of {visibleResourceAssets.length}</p>
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
                          {selectedPreviewAsset.isFavorite ? "Remove favorite" : "Add favorite"}
                        </button>
                        <CustomerAssetDownloadButton
                          assetId={selectedPreviewAsset.id}
                          className="inline-flex h-10 items-center justify-center rounded-[8px] bg-[#2f6fed] px-3 text-xs font-semibold text-white transition hover:bg-[#4380ff] disabled:cursor-wait disabled:opacity-60"
                          customerId={customer.id}
                          label="Download"
                          siteId={site.id}
                        />
                      </div>
                    </aside>
                  </div>
                </div>
              ) : null}
            </section>
              ) : null}
            </div>
          </div>
        </section>
      </main>
      {sampleDeleteConfirm ? (
        <div className="fixed inset-0 z-[110] grid place-items-center bg-black/78 p-4" role="dialog" aria-modal="true" aria-label="Confirm sample deletion">
          <div className="w-full max-w-sm rounded-[16px] border border-white/14 bg-[#090b10] p-5 text-white shadow-[0_30px_100px_-42px_rgba(0,0,0,0.95)]">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-200/70">Confirm delete</p>
            <h3 className="mt-2 text-lg font-semibold">
              Delete {sampleDeleteConfirm.assets.length === 1 ? "this sample" : `${sampleDeleteConfirm.assets.length} samples`}?
            </h3>
            <p className="mt-2 text-sm leading-6 text-white/58">
              This removes the selected sample{sampleDeleteConfirm.assets.length === 1 ? "" : "s"} from your private account and from {sampleDeleteConfirm.label}. This cannot be undone.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                className="inline-flex h-11 flex-1 items-center justify-center rounded-[10px] border border-white/12 bg-white/[0.06] px-4 text-sm font-semibold text-white transition hover:bg-white/[0.1]"
                onClick={() => setSampleDeleteConfirm(null)}
                type="button"
              >
                Cancel
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
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {previewSample ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-black/84 p-4" role="dialog" aria-modal="true" aria-label="Uploaded sample preview">
          <div className="relative grid max-h-[92vh] w-full max-w-6xl gap-3 overflow-hidden rounded-[14px] border border-white/12 bg-[#07090d] p-3 shadow-[0_30px_100px_-40px_rgba(0,0,0,0.95)] md:grid-cols-[minmax(0,1fr)_280px]">
            <button className="absolute right-4 top-4 z-10 rounded-full border border-white/12 bg-black/45 p-2 text-white transition hover:bg-white/10" onClick={() => setPreviewSampleId(null)} type="button">
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
            <div className="grid min-h-[52vh] place-items-center overflow-hidden rounded-[10px] bg-black">
              <img alt={previewSample.label} className="max-h-[82vh] w-full object-contain" src={previewSample.previewUrl} />
            </div>
            <aside className="grid content-between gap-4 p-2 pr-10 md:pr-2">
              <div>
                <p className="text-xs font-semibold text-white/46">Uploaded sample</p>
                <h3 className="mt-2 break-words text-lg font-semibold text-white">{previewSample.label}</h3>
                <p className="mt-2 text-xs text-white/46">{previewSampleIndex + 1} of {previewSamples.length}</p>
                {previewSample.localStatus === "uploading" ? <p className="mt-3 rounded-[8px] border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/64">Upload is still finishing. Preview is available now.</p> : null}
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
                  {deletingSampleId === previewSample.id ? "Deleting" : "Delete sample"}
                </button>
              </div>
            </aside>
          </div>
        </div>
      ) : null}
    </div>
  );
}
