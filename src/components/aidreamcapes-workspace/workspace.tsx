"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Captions, Check, CheckCircle2, Clapperboard, Download, FileVideo, Gift, Headphones, Home, ImageIcon, Layers3, Library, Lightbulb, Loader2, LockKeyhole, Menu, MessageSquare, Moon, PanelLeftClose, PhoneCall, Play, Plus, RotateCcw, Search, Sparkles, Sun, Trash2, UnlockKeyhole, Upload, UserRound, Video, WandSparkles, X } from "lucide-react";
import type { ActorAsset, RefKind, SceneField, SceneSchema, StoryboardShot, TaskInput, WorkspaceCatalog, WorkspaceTask as BaseWorkspaceTask } from "@/lib/aidreamcapes-workspace/types";
import { WORKSPACE_PROMPT_MAX_LENGTH } from "@/lib/aidreamcapes-workspace/types";
import { WORKSPACE_THEME_STORAGE_KEY } from "@/lib/aidreamcapes-workspace/login";
import { customerJsonHeaders, csrfHeader } from "@/lib/client-csrf";
import { CustomerAccountMenu } from "@/components/storefront/customer-account-menu";
import { prepareCustomerImageUploadFile } from "@/lib/client-image-upload";
import styles from "./workspace.module.css";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
import { confirmedBriefFromSnapshot, type ConfirmedProductBrief, type ImportedProductAsset, type ProductBriefSnapshotLike } from "./product-url-import";
import type { WorkspaceImageTool } from "./image-tool-picker";
import { BatchDraftDialog, type BatchDraftItem } from "./batch-draft-dialog";
import { startWorkspacePolling } from "./polling";
import { HomeComposer, type HomeComposerTab, type HomeComposerVideoSelection } from "./home-composer";
import { FileDropZone, fileKind, moveItem, reorderHandlers, takePasteFiles } from "./file-dnd";
import { aidreamcapesCreateIntentFromSearchParams } from "@/lib/aidreamcapes-create-intent";
import { workspaceHandoffFromSearchParams, type WorkspaceHandoff } from "@/lib/aidreamcapes-workspace/handoff";
import { type WorkspacePreset, type WorkspaceTemplateGallery, type WorkspaceTemplateOption } from "@/lib/aidreamcapes-workspace/preset-contract";
import { staticCreateSearchFromPath, staticViewHref } from "@/lib/aidreamcapes-workspace/static-routes";
import { WorkspaceEntryBehavior } from "./entry-behavior";
import { LibraryTaskCard, type LibraryCardMedia } from "./library-task-card";
import { LibraryReferenceReel, type LibraryReelItem } from "./library-reference-reel";
import { WorkspaceSelect } from "./workspace-select";
import { entryCookieName, readWorkspaceEntry } from "@/lib/aidreamcapes-workspace/entry-transfer";
import { deriveTaskStatus, taskStatusInFlight, type DerivedTaskStatus } from "@/lib/aidreamcapes-workspace/task-status";
const EmbeddedInspirations = dynamic(() => import("./inspirations-embedded").then(module => module.EmbeddedInspirations), { loading: () => <p role="status">Loading inspirations…</p> });
const WorkspaceHelpDialog = dynamic(() => import("./help-dialog").then(module => module.WorkspaceHelpDialog));
const ProductUrlImport = dynamic(() => import("./product-url-import").then(module => module.ProductUrlImport), { loading: () => <p role="status">Loading product import…</p> });
const MusicTrackPicker = dynamic(() => import("./music-track-picker").then(module => module.MusicTrackPicker), { loading: () => <p role="status">Loading music…</p> });

const TwinWorkbench = dynamic(() => import("./twin-workbench").then((module) => module.TwinWorkbench), { loading: () => <p role="status">Loading personal profiles…</p> });
const AdCloneWorkbench = dynamic(() => import("./ad-clone-workbench").then((module) => module.AdCloneWorkbench), { loading: () => <p role="status">Loading ad references…</p> });
const AnalyticsWorkbench = dynamic(() => import("./analytics-workbench").then((module) => module.AnalyticsWorkbench), { loading: () => <p role="status">Loading performance reports…</p> });
const AgentChatWorkbench = dynamic(() => import("./agent-chat-workbench").then((module) => module.AgentChatWorkbench), { loading: () => <p role="status">Loading AI assistant…</p> });
const SubtitleWorkbench = dynamic(() => import("./subtitle-workbench").then((module) => module.SubtitleWorkbench), { loading: () => <p role="status">Loading subtitle studio…</p> });
type SubtitleActiveJob = import("./subtitle-workbench").SubtitleActiveJob;
const SUBTITLE_JOB_STORAGE_KEY = "aidreamcapes-subtitle-job";
const TeamBrandWorkbench = dynamic(() => import("./team-brand-workbench").then((module) => module.TeamBrandWorkbench), { loading: () => <p role="status">Loading teams and brands…</p> });
const DeveloperWorkbench = dynamic(() => import("./developer-workbench").then((module) => module.DeveloperWorkbench), { loading: () => <p role="status">Loading developer settings…</p> });
const VideoPostEditor = dynamic(() => import("./video-post-editor").then((module) => module.VideoPostEditor), { loading: () => <p role="status">Loading video editor…</p> });
const MusicCatalogPicker = dynamic(() => import("./music-catalog-picker").then((module) => module.MusicCatalogPicker), { loading: () => <p role="status">Loading licensed music…</p> });

import { WORKSPACE_MODULES, isWorkspaceView, workspaceViewHref, type WorkspaceView } from "@/lib/aidreamcapes-workspace/navigation";
import { WORKSPACE_ASPECTS } from "@/lib/aidreamcapes-workspace/catalogs";
import { modelSupportsWorkspaceDuration } from "@/lib/aidreamcapes-workspace/capabilities";
import { subtitleOpErrorText, subtitleOpLabel } from "@/lib/aidreamcapes-workspace/subtitle-ops";
import { WorkspaceTools, ProductVideoPage, UrlToVideoPage, BatchDraftPage, workspaceModuleIcons, type ProductImportRecord, type ProductInlineRun } from "./module-pages";
import { useImageDraft } from "./use-image-draft";
export type { WorkspaceView } from "@/lib/aidreamcapes-workspace/navigation";

type View = WorkspaceView;
type WorkspaceTask = BaseWorkspaceTask & { operation?: { action: string; state: "pending" | "run" | "done" | "fail" | "cancelled"; error?: string } };
type ComposerProduct = ImportedProductAsset & { confirmedBrief?: ConfirmedProductBrief };
type ComposerPreset = { title?: string; aspect?: TaskInput["options"]["aspect"]; duration?: TaskInput["options"]["duration"]; resolution?: string; modelId?: string; referenceUrls?: string[]; referenceVideos?: string[]; referenceAudios?: string[] };
type Step = "input" | "storyboard" | "render" | "delivery";
type Action = "storyboard" | "reroll" | "rewrite" | "generate_shot" | "restore_version" | "render" | "resume" | "compose_shot";
type ActionQuote = { available: boolean; credits: number | null; currency: "credits"; quoteToken?: string; expiresAt?: string; revision?: number; reason?: string };
/** 生成确认载荷里的商品资料：确认简报去掉 candidateImages 后的形状（服务端会再规范化）。 */
type PendingProductBrief = Omit<ConfirmedProductBrief, "candidateImages">;
type ImageResult = { jobs: { id: string; status: string; creditsReserved: number; createdAt?: string }[]; assets: { id: string; jobId?: string; label: string; previewUrl: string; downloadUrl?: string }[] };

type GuestDraftHandoff = {
  version: 1;
  savedAt: number;
  view: "agent" | "batch";
  tab?: HomeComposerTab;
  prompt: string;
  title: string;
  sceneId: string;
  batchSceneId: string;
  quickStartSceneId: string;
  aspect: string;
  duration: number;
  modelId: string;
};

function guestDraftHandoffKey(siteId: string): string {
  return `aidreamcapes:guest-video-draft:${encodeURIComponent(siteId)}`;
}
export interface AidreamcapesWorkspaceProps {
  siteId: string;
  basePath: string;
  customer?: { id: string; name: string; email: string; balance?: number } | null;
  csrfToken?: string;
  initialCatalog?: WorkspaceCatalog;
  initialView?: WorkspaceView;
  initialTaskId?: string;
  initialSceneId?: SceneSchema["id"];
  initialProductUrl?: string;
  loginPath?: string;
  accountPath?: string;
  logoutPath?: string;
  supportPath?: string;
  presenterStudioEnabled?: boolean;
  initialImageTool?: WorkspaceImageTool;
  initialActorId?: string;
  initialPreset?: WorkspacePreset;
  initialHandoff?: WorkspaceHandoff;
  initialTemplateGallery?: WorkspaceTemplateGallery;
  initialInspirations?: import("@/lib/aidreamcapes-inspirations-types").InspirationPage;
}

const derivedStatusLabels: Record<DerivedTaskStatus, string> = { cancelled: "Cancelled", completed: "Completed", rendering: "Rendering", generating: "Generating", planning: "Planning", failed: "Needs attention", ready: "Ready to render", draft: "Draft" };

function taskStatusLabel(task: WorkspaceTask): string {
  const view = deriveTaskStatus(task);
  if (view.status === "rendering" && task.input.direct) return "Finishing";
  if (view.status === "ready" && !task.input.direct) return "Storyboard ready";
  return derivedStatusLabels[view.status];
}
const refLabels: Record<RefKind, string> = { actor: "Avatar", product: "Product", texture: "Detail", composite: "Avatar + product" };
const steps: { id: Step; label: string }[] = [{ id: "input", label: "Details" }, { id: "storyboard", label: "Storyboard" }, { id: "render", label: "Render" }, { id: "delivery", label: "Delivery" }];
const renderLabels = { confirm: "Confirm selected clips", concat: "Assemble your video", subtitles: "Add captions", audio: "Finish audio" };

function defaultInput(scene: SceneSchema): TaskInput {
  return { images: {}, fields: {}, options: { duration: 15, aspect: "9:16", style: scene.styleDefault, language: "en", subtitle: false, subtitleStyle: "classic" } };
}
function downloadText(filename: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function mediaFileName(url: string, fallback: string): string {
  try {
    const name = decodeURIComponent(url.split(/[?#]/)[0].split("/").pop() || "");
    return /\.[a-z0-9]{2,4}$/i.test(name) ? name : fallback;
  } catch { return fallback; }
}
function imageEntries(task: WorkspaceTask, scene?: SceneSchema): { kind: RefKind; url: string; label: string }[] {
  return (scene?.sections.flatMap((section) => section.fields) ?? []).flatMap((field) => field.type === "images" && field.refKind ? (task.input.images[field.id] ?? []).map((url) => ({ kind: field.refKind!, url, label: field.label })) : []);
}
/**
 * Every frame a library card can show: the finished video first, then one
 * entry per reference image, in the order the task stored them.
 */
function taskMedia(task: WorkspaceTask, scene?: SceneSchema): LibraryCardMedia[] {
  const refs = imageEntries(task, scene);
  const fallback = refs.length ? [] : Object.entries(task.input.images).flatMap(([key, urls]) => urls.map((url) => ({ kind: "product" as RefKind, url, label: key })));
  const seen = new Set<string>();
  const media: LibraryCardMedia[] = [];
  if (task.video?.finalUrl && !task.video.stale) {
    // A fresh final render already contains every finished clip, so keep only
    // the finished video instead of repeating each shot clip as a second entry.
    media.push({ kind: "video", url: task.video.finalUrl, label: "Video" });
    seen.add(task.video.finalUrl);
  } else {
    // Clips the provider already finished are the customer's video assets even
    // before the final film is rendered, so the library has to show them.
    for (const shot of task.storyboard?.shots ?? []) {
      const version = shot.versions?.find((item) => item.vid === shot.curVer) ?? shot.versions?.at(-1);
      if (!version?.clipUrl || version.status !== "done" || seen.has(version.clipUrl)) continue;
      seen.add(version.clipUrl);
      media.push({ kind: "video", url: version.clipUrl, label: task.input.direct ? "Video" : `Shot ${media.filter((item) => item.kind === "video").length + 1}` });
    }
    if (task.video?.finalUrl) {
      // A stale final render predates the current clips, so both stay viewable.
      media.push({ kind: "video", url: task.video.finalUrl, label: "Video" });
      seen.add(task.video.finalUrl);
    }
  }
  for (const ref of [...refs, ...fallback]) {
    if (!ref.url || seen.has(ref.url)) continue;
    seen.add(ref.url);
    media.push({ kind: "image", url: ref.url, label: refLabels[ref.kind] ?? ref.label });
  }
  return media;
}
/**
 * Card copy comes from the customer's own brief, so it can carry block
 * headings from a long brief. Keep the first readable sentence and drop the
 * structural labels.
 */
function cardDescription(value: string): string {
  const text = value.replace(/【[^】]*】/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  const firstSentence = text.match(/^.{40,}?[.!?](?=\s|$)/)?.[0] ?? text;
  const trimmed = firstSentence.trim();
  return trimmed.length > 170 ? `${trimmed.slice(0, 167).trimEnd()}…` : trimmed;
}
/** Creation date+time in the visitor's clock. The server may format it in a
 * different timezone, so the rendered dd carries suppressHydrationWarning and
 * the browser settles it after hydration. */
function shortDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date);
}
function taskProductBriefSnapshot(brief: ConfirmedProductBrief): NonNullable<WorkspaceTask["productBrief"]> {
  const field = <T,>(value: { value: T; sourceUrl: string; sourceLabel: string; confidence: "high" | "medium" | "low" } | null) => value ? {
    value: value.value, sourceUrl: value.sourceUrl, sourceLabel: value.sourceLabel, confidence: value.confidence, userConfirmed: true as const,
  } : null;
  return {
    sourceUrl: brief.sourceUrl, fetchedPageUrl: brief.fetchedPageUrl,
    title: field(brief.title), description: field(brief.description),
    possiblePrice: brief.possiblePrice ? {
      amount: brief.possiblePrice.value.amount, ...(brief.possiblePrice.value.currency ? { currency: brief.possiblePrice.value.currency } : {}),
      sourceUrl: brief.possiblePrice.sourceUrl, sourceLabel: brief.possiblePrice.sourceLabel,
      confidence: brief.possiblePrice.confidence, userConfirmed: false,
    } : null,
    userConfirmed: true, confirmedAt: new Date(brief.customerConfirmedAt).toISOString(),
  };
}

export function AidreamcapesWorkspace({ siteId, basePath, customer, csrfToken, initialCatalog, initialView = "home", initialTaskId, initialSceneId, initialProductUrl, loginPath, accountPath, logoutPath, supportPath, presenterStudioEnabled = false, initialImageTool = "custom", initialActorId, initialPreset, initialHandoff, initialTemplateGallery, initialInspirations }: AidreamcapesWorkspaceProps) {
  const api = `/api/sites/${encodeURIComponent(siteId)}/aivideosugc`;
  const loginHref = loginPath ?? `${basePath}/login?next=${encodeURIComponent(`${basePath}/app`)}`;
  const accountHref = accountPath ?? `${basePath}/account`;
  const loginForCloneView = (targetView: "twin" | "clone") => {
    const target = new URL(loginHref, "https://workspace.invalid");
    target.searchParams.set("next", `${basePath}/app/create?view=${targetView}`);
    return `${target.pathname}${target.search}${target.hash}`;
  };
  const [entryProductUrl, setEntryProductUrl] = useState(initialProductUrl);
  const [catalog, setCatalog] = useState<WorkspaceCatalog | undefined>(initialCatalog);
  const [view, setView] = useState<View>(initialView);
  const [task, setTask] = useState<WorkspaceTask | null>(null);
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  // Subtitle burn-in jobs are tracked here so polling and the progress pill
  // survive view switches; a refresh resumes from sessionStorage for 30 minutes.
  const [subtitleJob, setSubtitleJob] = useState<SubtitleActiveJob | null>(null);
  const [subtitleNotice, setSubtitleNotice] = useState("");
  const [subtitleElapsed, setSubtitleElapsed] = useState(0);
  // Library list paging: the first page loads eagerly, further pages append
  // while the customer scrolls towards the end of the grid.
  const [tasksHasMore, setTasksHasMore] = useState(false);
  const [tasksLoadingMore, setTasksLoadingMore] = useState(false);
  // Rows already consumed from the server. The library polls merge refreshed
  // head-window tasks into `tasks`, so the array length drifts — paging must
  // advance on a stable cursor instead of the live list length, or a merge
  // that reorders rows makes the same offset repeat and scrolling stalls.
  const tasksOffsetRef = useRef(0);
  const librarySentinelRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState<Step>("input");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!initialCatalog || Boolean(customer && initialTaskId));
  const [message, setMessage] = useState("");
  const [batchNotice, setBatchNotice] = useState("");
  const [saveStatus, setSaveStatus] = useState("All changes saved");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(false);
  // Persist the theme per browser (anonymous visitors included). The read runs
  // in a layout effect so the stored choice applies before the first paint
  // after hydration; writing happens on every change. The isomorphic variant
  // keeps SSR quiet — during server render the read is a no-op anyway.
  useIsomorphicLayoutEffect(() => {
    try { if (window.localStorage.getItem(WORKSPACE_THEME_STORAGE_KEY) === "dark") setDark(true); } catch { /* storage may be unavailable */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(WORKSPACE_THEME_STORAGE_KEY, dark ? "dark" : "light"); } catch { /* storage may be unavailable */ }
  }, [dark]);
  const [modal, setModal] = useState<"guide" | "support" | "actors" | "product" | "templates" | "promptOptimizer" | null>(null);
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState(initialHandoff?.category && initialTemplateGallery?.categories.some((item) => item.id === initialHandoff.category) ? initialHandoff.category : "all");
  const [templateSearch, setTemplateSearch] = useState("");
  const closeModal = useCallback(() => setModal(null), []);
  // Composer prompt entries all funnel through here so no code path — typing,
  // templates, suggestions, restored handoffs — can exceed the limit even when
  // the DOM maxLength is bypassed programmatically.
  const handleComposerPrompt = useCallback((value: string) => setPrompt(value.slice(0, WORKSPACE_PROMPT_MAX_LENGTH)), []);
  const [prompt, setPrompt] = useState(initialPreset?.kind === "video" ? initialPreset.prompt : initialHandoff?.prompt ?? "");
  // Wan3.0 提示词优化：视频工作台类型选择 + 优化任务状态（提交/轮询/结果）。
  const [composerVideoType, setComposerVideoType] = useState<string>("general");
  const [promptOptimizer, setPromptOptimizer] = useState<{ status: "submitting" | "polling" | "succeeded" | "failed"; sourcePrompt: string; optimizedPrompt?: string; error?: string } | null>(null);
  const promptOptimizing = Boolean(promptOptimizer && (promptOptimizer.status === "submitting" || promptOptimizer.status === "polling"));
  const [selectedSceneId, setSelectedSceneId] = useState(initialSceneId ?? "");
  const [quickStartSceneId, setQuickStartSceneId] = useState<SceneSchema["id"] | "">(initialCatalog?.scenes.find((scene) => scene.id === initialSceneId)?.id ?? "");
  const [draftReferenceUrls, setDraftReferenceUrls] = useState<string[]>([]);
  const [composerTab, setComposerTab] = useState<HomeComposerTab>(initialPreset?.kind === "video" ? "AI Video" : "AI Video Agent");
  const [composerDuration, setComposerDuration] = useState<TaskInput["options"]["duration"]>(initialPreset?.duration ?? initialHandoff?.duration ?? 15);
  const [composerAspect, setComposerAspect] = useState<TaskInput["options"]["aspect"]>(initialPreset?.aspect ?? initialHandoff?.aspect ?? "9:16");
  const [composerModel, setComposerModel] = useState("");
  const [composerResolution, setComposerResolution] = useState("");
  const [composerQuote, setComposerQuote] = useState<{ available: boolean; credits?: number } | null>(null);
  const [pendingGenerate, setPendingGenerate] = useState<{ scene: SceneSchema; input: TaskInput; title: string; productBrief?: PendingProductBrief; source?: { sourcePage: string; presetId: string; sourceUpdatedAt: string }; surface: "composer" | "agent" | "product"; quote?: ActionQuote } | null>(null);
  const [pendingAvatarSubmit, setPendingAvatarSubmit] = useState<{ quote: { available: boolean; credits?: number; reason?: string } } | null>(null);
  const [messageAction, setMessageAction] = useState(false);
  // 生成流程的阶段播报用中性样式；默认 error 保持既有错误横幅外观不变。
  const [messageKind, setMessageKind] = useState<"info" | "error">("error");
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const detailTask = detailTaskId ? tasks.find((item) => item.taskId === detailTaskId) : undefined;
  // The home composer creates one direct clip. Its quote already covers the
  // selected duration, so do not multiply a 30s quote by two 15s units.
  const composerCreditsNote = composerQuote?.available && composerQuote.credits != null ? `Estimated cost: ${composerQuote.credits} credits` : undefined;
  const [composerActorId, setComposerActorId] = useState("");
  const [composerProducts, setComposerProducts] = useState<ComposerProduct[]>([]);
  const [confirmedProductBriefs, setConfirmedProductBriefs] = useState<ConfirmedProductBrief[]>([]);
  // Product Links: persisted import history plus the inline generation run
  // started from this page (the page never hands off to another module).
  const [productImports, setProductImports] = useState<ProductImportRecord[]>([]);
  const [productImportsLoading, setProductImportsLoading] = useState(false);
  const [inlineRun, setInlineRun] = useState<ProductInlineRun | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSceneId, setBatchSceneId] = useState(initialSceneId ?? "");
  const [composerTitle, setComposerTitle] = useState(initialPreset?.title ?? "");
  const [presets, setPresets] = useState<{ photo?: WorkspacePreset; video?: WorkspacePreset }>(() => (initialPreset ? { [initialPreset.kind]: initialPreset } : {}));
  // Photo and video templates live in separate modules. Each module keeps its
  // own template so a video template never appears in the image workspace.
  const templateModuleKind: "photo" | "video" = view === "images" ? "photo" : view === "home" && composerTab === "AI Image" ? "photo" : "video";
  const activePreset = presets[templateModuleKind];
  const [libraryFilter, setLibraryFilter] = useState<string>(initialHandoff?.filter ?? "all");
  const [actorSearch, setActorSearch] = useState("");
  const [actorGenderFilter, setActorGenderFilter] = useState<"all" | "female" | "male">("all");
  const [avatarSelectionId, setAvatarSelectionId] = useState(initialActorId ?? "");
  const [avatarScript, setAvatarScript] = useState("");
  const [avatarProductImages, setAvatarProductImages] = useState<string[]>([]);
  const [avatarModelId, setAvatarModelId] = useState("");
  const [avatarAspect, setAvatarAspect] = useState<TaskInput["options"]["aspect"]>("9:16");
  const [avatarDuration, setAvatarDuration] = useState<TaskInput["options"]["duration"]>(15);
  const [avatarResolution, setAvatarResolution] = useState("");
  const [avatarLanguage, setAvatarLanguage] = useState<TaskInput["options"]["language"]>("en");
  const [creatingActor, setCreatingActor] = useState(false);
  const [actorDraft, setActorDraft] = useState({ name: "", gender: "female" as "female" | "male", ageRange: "25-30", imageUrl: "", languages: ["en"] as TaskInput["options"]["language"][] });
  const [quotes, setQuotes] = useState<Record<string, ActionQuote>>({});
  const [imageInput, setImageInput] = useState<{ prompt: string; assetUrls: string[]; aspect: TaskInput["options"]["aspect"]; toolId: WorkspaceImageTool }>({ prompt: initialPreset?.kind === "photo" ? initialPreset.prompt : initialView === "images" ? initialHandoff?.prompt ?? "" : "", assetUrls: initialPreset?.kind === "photo" ? (initialPreset.referenceImageUrls ?? []).slice(0, 4) : [], aspect: initialPreset?.kind === "photo" ? initialPreset.aspect : initialView === "images" ? initialHandoff?.aspect ?? "1:1" : "1:1", toolId: initialPreset?.kind === "photo" ? initialPreset.imageTool : initialImageTool });
  useImageDraft(siteId, customer?.id, imageInput, setImageInput, initialPreset?.kind === "photo" || (initialView === "images" && Boolean(initialHandoff?.prompt)));
  const [imageQuote, setImageQuote] = useState<ActionQuote | null>(null);
  const [imageResults, setImageResults] = useState<ImageResult>({ jobs: [], assets: [] });
  const [balance, setBalance] = useState(customer?.balance);
  const [tagDrafts, setTagDrafts] = useState<Record<string, string>>({});
  const [videoReferenceUrls, setVideoReferenceUrls] = useState<string[]>(initialPreset?.kind === "video" ? (initialPreset.referenceImageUrls ?? []).slice(0, 4) : []);
  const [videoReferenceFiles, setVideoReferenceFiles] = useState<string[]>(initialPreset?.kind === "video" ? (initialPreset.referenceVideoUrls ?? []).slice(0, 4) : []);
  const [audioReferenceFiles, setAudioReferenceFiles] = useState<string[]>([]);
  useEffect(() => {
    if (composerTab === "AI Image") { setComposerQuote(null); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      request<{ quote: { available: boolean; credits?: number } }>("/generation-quote", {
        method: "POST",
        body: JSON.stringify({ direct: true, modelId: composerModel || undefined, duration: composerDuration, aspect: composerAspect, resolution: composerResolution || undefined, imageInputCount: composerTab === "AI Video" ? videoReferenceUrls.length : composerProducts.length, videoInputCount: composerTab === "AI Video" ? videoReferenceFiles.length : 0, audioInputCount: composerTab === "AI Video" ? audioReferenceFiles.length : 0 })
      }).then((result) => { if (!cancelled) setComposerQuote(result.quote); }).catch(() => { if (!cancelled) setComposerQuote(null); });
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [composerTab, composerModel, composerDuration, composerAspect, composerResolution, videoReferenceUrls.length, videoReferenceFiles.length, audioReferenceFiles.length, composerProducts.length]);
  const [presetSceneId, setPresetSceneId] = useState(initialPreset?.sceneId);
  const currentRef = useRef<WorkspaceTask | null>(null);
  const savedRef = useRef<WorkspaceTask | null>(null);
  const pendingProductBrief = useRef<{ taskId: string; payload: ConfirmedProductBrief } | null>(null);
  const editSerial = useRef(0);
  const dirty = useRef(false);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const privateModalRef = useRef<HTMLElement>(null);
  const navigationSerial = useRef(0);
  const customerId = customer?.id;
  const visibleView = useRef(view);
  visibleView.current = view;
  const scene = catalog?.scenes.find((item) => item.id === task?.sceneId);
  const selectedScene = catalog?.scenes.find((item) => item.id === selectedSceneId);
  // Product Links page embeds the creation form for this scene; customers never
  // leave the module to finish a video.
  const productCreateScene = catalog?.scenes.find((item) => item.id === "process_demo") ?? catalog?.scenes[0];
  const actor = catalog?.actors.find((item) => item.actorId === task?.input.actorId);
  const avatarSelection = catalog?.actors.find((item) => item.actorId === avatarSelectionId);
  const avatarModels = catalog?.models.filter((item) => item.available && item.nativeSpeech && item.audioReference && item.referenceImageMax > 0) ?? [];
  const avatarImageFieldMax = catalog?.scenes.find((item) => item.id === "presenter_showcase")?.sections.flatMap((section) => section.fields).find((field) => field.id === "productImages")?.max ?? 4;
  const avatarUserImageMax = Math.max(0, avatarImageFieldMax - 1);
  const avatarModel = avatarModels.find((item) => item.id === avatarModelId) ?? avatarModels[0];
  const avatarModelUnavailable = Boolean(catalog?.models.some((item) => item.available) && !avatarModels.length);
  const avatarAspects = avatarModel?.aspects ?? [...WORKSPACE_ASPECTS];
  const avatarDurations = avatarModel
    ? (catalog?.durations.filter((item) => modelSupportsWorkspaceDuration(avatarModel, item.value)).map((item) => item.value) ?? [])
    : catalog?.durations.map((item) => item.value) ?? [6, 10, 15, 30];
  const avatarLanguageOptions = catalog?.languages.filter((language) => (avatarSelection?.voice.languages ?? [avatarSelection?.voice.language]).includes(language.value)) ?? [];
  const selectedAvatarAspect = avatarAspects.includes(avatarAspect) ? avatarAspect : avatarAspects[0] ?? "9:16";
  const selectedAvatarDuration = avatarDurations.includes(avatarDuration) ? avatarDuration : avatarDurations[0] ?? 15;
  const avatarResolutions = avatarModel?.resolutions ?? [];
  const selectedAvatarResolution = avatarResolutions.includes(avatarResolution) ? avatarResolution : avatarResolutions[0] ?? "";
  const selectedAvatarLanguage = avatarLanguageOptions.some((item) => item.value === avatarLanguage) ? avatarLanguage : avatarLanguageOptions[0]?.value ?? avatarSelection?.voice.language ?? "en";
  const operationActive = task?.operation?.state === "pending" || task?.operation?.state === "run";
  const clipsProcessing = task?.storyboard?.shots.some((shot) => shot.genStatus === "run" || shot.compositeStatus === "run");
  const directTask = Boolean(task?.input.direct);
  const directFinalUrl = directTask ? task?.video?.finalUrl : undefined;
  const directShotFailure = directTask ? task?.storyboard?.shots.find((shot) => shot.genStatus === "fail") : undefined;
  const directFailure = directTask && !directFinalUrl && !operationActive
    ? task?.operation?.state === "fail"
      ? task.operation.error ?? task.error
      : task?.status === "failed"
        ? task.error ?? directShotFailure?.error
        : task?.video?.status === "fail"
          ? task.video.error ?? directShotFailure?.error
          : directShotFailure?.error
    : undefined;
  const directStalled = directTask && !directFinalUrl && !operationActive && !clipsProcessing && !directFailure;
  const editingDisabled = busy || Boolean(operationActive) || Boolean(clipsProcessing);
  const working = busy || Boolean(operationActive) || loading;

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    const response = await fetch(`${api}${path}`, { ...init, credentials: "same-origin", cache: "no-store", headers: { ...customerJsonHeaders(siteId), ...(csrfToken ? { "x-csrf-token": csrfToken } : {}), ...init.headers } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 409 && result.error === "revision_conflict") throw new Error("This task changed in another window. Reload it from Library before continuing.");
      if (response.status === 401) throw new Error("Please log in to save and generate your video.");
      throw new Error(result.message || humanError(result.error) || "We couldn't complete this request. Please try again.");
    }
    return result as T;
  }, [api, csrfToken, siteId]);

  const fetchProductImports = useCallback(async () => {
    if (!customerId) return;
    setProductImportsLoading(true);
    try {
      // product-imports is customer-scoped, not part of the workspace API.
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customerId)}/product-imports?limit=20`, { credentials: "same-origin", cache: "no-store", headers: customerJsonHeaders(siteId) });
      if (response.ok) {
        const parsed = await response.json().catch(() => null) as { ok?: boolean; imports?: ProductImportRecord[] } | null;
        if (parsed?.ok && Array.isArray(parsed.imports)) setProductImports(parsed.imports);
      }
    } finally { setProductImportsLoading(false); }
  }, [customerId, siteId]);

  useEffect(() => {
    if (customerId && view === "product") void fetchProductImports();
  }, [customerId, view, fetchProductImports]);

  function continueToLoginWithDraft() {
    let saved = false;
    try {
      const handoff: GuestDraftHandoff = {
        version: 1,
        savedAt: Date.now(),
        view: view === "batch" ? "batch" : "agent",
        tab: view === "images" ? "AI Image" : view === "video" ? "AI Video" : view === "agent" ? "AI Video Agent" : composerTab,
        prompt: prompt.slice(0, WORKSPACE_PROMPT_MAX_LENGTH),
        title: composerTitle.slice(0, 160),
        sceneId: selectedSceneId,
        batchSceneId,
        quickStartSceneId,
        aspect: composerAspect,
        duration: composerDuration,
        modelId: composerModel.slice(0, 2048),
      };
      window.sessionStorage.setItem(guestDraftHandoffKey(siteId), JSON.stringify(handoff));
      saved = true;
    } catch {
      // Keep login usable when browser storage is unavailable.
    }
    window.location.assign(currentLoginHref(saved));
  }

  function currentLoginHref(resumeDraft = false): string {
    const target = new URL(loginHref, window.location.origin);
    const returnTo = new URL(`${window.location.pathname}${window.location.search}`, window.location.origin);
    if (resumeDraft) returnTo.searchParams.set("resumeDraft", "1");
    target.searchParams.set("next", `${returnTo.pathname}${returnTo.search}${returnTo.hash}`);
    return `${target.pathname}${target.search}${target.hash}`;
  }

  const acceptTask = useCallback((next: WorkspaceTask, display = true) => {
    currentRef.current = next; savedRef.current = next; dirty.current = false;
    if (display) setTask(next);
    setSaveStatus("All changes saved");
    setTasks((items) => [next, ...items.filter((item) => item.taskId !== next.taskId)]);
  }, []);

  const onSubtitleJobStarted = useCallback((job: SubtitleActiveJob) => {
    setSubtitleJob(job);
    setSubtitleNotice("");
    try { window.sessionStorage.setItem(SUBTITLE_JOB_STORAGE_KEY, JSON.stringify(job)); } catch { /* storage may be unavailable */ }
  }, []);

  // Merge a refreshed task into the library list without disturbing the agent view.
  const mergeTask = useCallback((next: WorkspaceTask) => {
    setTasks((items) => items.some((item) => item.taskId === next.taskId)
      ? items.map((item) => (item.taskId === next.taskId ? next : item))
      : items);
    if (currentRef.current?.taskId === next.taskId) acceptTask(next, visibleView.current === "agent");
  }, [acceptTask]);

  // Resume a burn-in started earlier in this tab (page refresh keeps the pill running).
  useEffect(() => {
    if (!customerId) return;
    try {
      const raw = window.sessionStorage.getItem(SUBTITLE_JOB_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SubtitleActiveJob;
      if (parsed?.jobId && parsed?.taskId && Date.now() - parsed.startedAt < 30 * 60 * 1000) setSubtitleJob(parsed);
      else window.sessionStorage.removeItem(SUBTITLE_JOB_STORAGE_KEY);
    } catch { /* ignore malformed storage */ }
  }, [customerId]);

  // Poll the burn-in job wherever the customer is in the workspace; completion
  // refreshes the library entry automatically.
  useEffect(() => {
    if (!subtitleJob || !customerId) return;
    let cancelled = false;
    let polling = false;
    const poll = async () => {
      if (cancelled || polling) return;
      polling = true;
      try {
        const result = await request<{ job: { id: string; status: string; result: { linesCount?: number } | null; error: unknown } }>(`/subtitle-ops/${encodeURIComponent(subtitleJob.jobId)}`);
        if (cancelled) return;
        if (result.job.status === "succeeded") {
          const finished = subtitleJob;
          setSubtitleJob(null);
          try { window.sessionStorage.removeItem(SUBTITLE_JOB_STORAGE_KEY); } catch { /* ignore */ }
          const updated = await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(finished.taskId)}`);
          if (cancelled) return;
          mergeTask(updated.task);
          setSubtitleNotice(`“${finished.taskTitle}” now has a new version with ${result.job.result?.linesCount ?? "fresh"} subtitles. The original version is still there.`);
        } else if (result.job.status === "failed") {
          setSubtitleJob(null);
          try { window.sessionStorage.removeItem(SUBTITLE_JOB_STORAGE_KEY); } catch { /* ignore */ }
          setSubtitleNotice(subtitleOpErrorText(result.job.error));
        }
      } catch {
        // Transient network failures keep polling until the job reports a terminal state.
      } finally {
        polling = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 2500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [subtitleJob, customerId, request, mergeTask]);

  useEffect(() => {
    if (!subtitleJob) { setSubtitleElapsed(0); return; }
    const tick = () => setSubtitleElapsed(Math.round((Date.now() - subtitleJob.startedAt) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [subtitleJob]);

  const persist = useCallback(async () => {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
    const execute = async () => {
      const current = currentRef.current;
      if (!current || !dirty.current) return;
      if (!current.title.trim()) throw new Error("Enter a video title to save your changes.");
      const serial = editSerial.current;
      setSaveStatus("Saving…");
      const saved = savedRef.current;
      const pendingBrief = pendingProductBrief.current?.taskId === current.taskId ? pendingProductBrief.current : null;
      const patch = {
        revision: saved?.revision ?? current.revision,
        ...(current.title !== saved?.title ? { title: current.title } : {}),
        ...(JSON.stringify(current.input) !== JSON.stringify(saved?.input) ? { input: current.input } : {}),
        ...(pendingBrief ? { productBrief: pendingBrief.payload } : JSON.stringify(current.productBrief) !== JSON.stringify(saved?.productBrief) ? { productBrief: current.productBrief } : {}),
        ...(current.storyboard && JSON.stringify(current.storyboard) !== JSON.stringify(saved?.storyboard) ? { storyboard: current.storyboard } : {})
      };
      if (Object.keys(patch).length === 1 && saved) { acceptTask(saved, visibleView.current === "agent"); return; }
      const result = await request<{ task: WorkspaceTask }>(`/tasks/${current.taskId}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (pendingBrief && pendingProductBrief.current === pendingBrief) pendingProductBrief.current = null;
      if (currentRef.current?.taskId !== current.taskId) return;
      savedRef.current = result.task;
      if (serial === editSerial.current) acceptTask(result.task, visibleView.current === "agent");
      else {
        currentRef.current = currentRef.current ? { ...currentRef.current, revision: result.task.revision } : null;
        if (visibleView.current === "agent") setTask(currentRef.current);
        setSaveStatus("Saving…");
      }
    };
    const pending = queue.current.catch(() => {}).then(execute);
    queue.current = pending;
    try { await pending; } catch (error) { setSaveStatus("Not saved — retry below"); setMessage(error instanceof Error ? error.message : "Unable to save your changes."); throw error; }
  }, [acceptTask, request]);

  const editTask = useCallback((update: (current: WorkspaceTask) => WorkspaceTask) => {
    if (!currentRef.current) return;
    const next = update(currentRef.current);
    currentRef.current = next; dirty.current = true; editSerial.current += 1;
    setTask(next); setSaveStatus("Unsaved changes");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void persist().catch(() => {}); }, 650);
  }, [persist]);

  const entryEffectsDoneRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const navigation = navigationSerial.current;
    const active = () => !controller.signal.aborted && navigation === navigationSerial.current;
    const staticPathParams = staticCreateSearchFromPath(window.location.pathname);
    const params = new URLSearchParams(window.location.search);
    if (staticPathParams) {
      staticPathParams.forEach((value, key) => { if (!params.has(key)) params.set(key, value); });
    }
    const createIntent = aidreamcapesCreateIntentFromSearchParams(params);
    const handoff = workspaceHandoffFromSearchParams(params);
    const resumingGuestDraft = params.get("resumeDraft") === "1";
    const queryView = params.get("view");
    const hasHandoffInput = Boolean(handoff.prompt || createIntent || handoff.scene);
    const requestedView = isWorkspaceView(queryView) ? queryView : initialView;
    const handoffView = requestedView === "home" && hasHandoffInput
      ? initialView === "home" ? "agent" : initialView : requestedView;
    const entryView = initialPreset ? initialPreset.kind === "photo" ? "images" : "video" : handoffView;
    const taskId = initialTaskId ?? params.get("task");
    // Entry handoff (view, stored inputs, URL canonicalization) belongs to the
    // page load that carried it. Re-runs of this effect — a customer signing
    // in, catalog refreshes — must not drag the visitor back to the entry view
    // or rewrite the URL of a view they navigated to since.
    const runEntryEffects = !entryEffectsDoneRef.current;
    if (runEntryEffects) entryEffectsDoneRef.current = true;
    if (runEntryEffects && !initialPreset && !resumingGuestDraft && !taskId) {
      const entryPrompt = handoff.prompt ?? createIntent?.prompt;
      if (entryPrompt) setPrompt(entryPrompt);
      if (handoff.aspect) setComposerAspect(handoff.aspect);
      if (handoff.duration) setComposerDuration(handoff.duration);
      const entryScene = initialCatalog?.scenes.find((item) => item.id === handoff.scene);
      if (entryScene) {
        setQuickStartSceneId(entryScene.id);
        setBatchSceneId(entryScene.id);
        if (entryView === "agent") setSelectedSceneId(entryScene.id);
      }
      if (entryView === "images" || createIntent?.kind === "photo") {
        setImageInput((current) => ({ ...current, ...(entryPrompt ? { prompt: entryPrompt } : {}), ...(handoff.aspect ? { aspect: handoff.aspect } : {}) }));
      }
    }
    if (runEntryEffects && entryView === "library" && handoff.filter) setLibraryFilter(handoff.filter);
    if (runEntryEffects) setView(entryView);
    if (runEntryEffects && !taskId && !resumingGuestDraft) {
      // Initial SSR consumed the bounded cookie. Long free-form inputs use
      // this tab's storage, never a URL parameter or a public data fetch.
      try {
        const stored = readWorkspaceEntry(sessionStorage.getItem(entryCookieName(entryView)) ?? undefined, entryView);
        if (stored) {
          const input = workspaceHandoffFromSearchParams(new URLSearchParams(stored.query));
          if (input.prompt) {
            if (entryView === "images") setImageInput(current => ({ ...current, prompt: input.prompt! }));
            else setPrompt(input.prompt);
          }
          const intent = aidreamcapesCreateIntentFromSearchParams(new URLSearchParams(stored.query));
          if (intent?.kind === "video" && intent.productUrl) setEntryProductUrl(intent.productUrl);
          sessionStorage.removeItem(entryCookieName(entryView));
        }
      } catch { /* The SSR transfer remains usable when tab storage is blocked. */ }
      document.cookie = `${entryCookieName(entryView)}=; Path=${basePath}/app/create; Max-Age=0; SameSite=Lax`;
      const canonical = new URL(window.location.href);
      canonical.pathname = staticViewHref(basePath, entryView);
      canonical.search = ""; canonical.hash = "";
      window.history.replaceState(window.history.state, "", canonical);
    }
    if (runEntryEffects && customerId && !taskId && params.get("resumeDraft") === "1" && initialCatalog) {
      params.delete("resumeDraft");
      const restoredUrl = `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}${window.location.hash}`;
      window.history.replaceState(window.history.state, "", restoredUrl);
      try {
        const raw = window.sessionStorage.getItem(guestDraftHandoffKey(siteId));
        if (raw) {
          const handoff = JSON.parse(raw) as Partial<GuestDraftHandoff>;
          window.sessionStorage.removeItem(guestDraftHandoffKey(siteId));
          const age = Date.now() - Number(handoff.savedAt);
          const fresh = handoff.version === 1 && Number.isFinite(handoff.savedAt) && age >= 0 && age < 30 * 60 * 1000;
          if (fresh) {
            if (handoff.tab === "AI Video Agent" || handoff.tab === "AI Video" || handoff.tab === "AI Image") setComposerTab(handoff.tab);
            if (typeof handoff.prompt === "string" && handoff.prompt.length <= WORKSPACE_PROMPT_MAX_LENGTH) setPrompt(handoff.prompt);
            if (typeof handoff.title === "string" && handoff.title.length <= 160) setComposerTitle(handoff.title);
            if (typeof handoff.aspect === "string" && WORKSPACE_ASPECTS.includes(handoff.aspect as TaskInput["options"]["aspect"])) setComposerAspect(handoff.aspect as TaskInput["options"]["aspect"]);
            if ([6, 10, 15, 30].includes(Number(handoff.duration))) setComposerDuration(Number(handoff.duration) as TaskInput["options"]["duration"]);
            if (typeof handoff.modelId === "string" && handoff.modelId.length <= 2048 && initialCatalog?.models.some((item) => item.id === handoff.modelId)) setComposerModel(handoff.modelId);
            if (handoff.view === "batch" && typeof handoff.batchSceneId === "string" && initialCatalog?.scenes.some((item) => item.id === handoff.batchSceneId)) {
              setBatchSceneId(handoff.batchSceneId);
              setView("batch");
              setMessage("Your batch draft details were restored. Please add your product photos again.");
            } else if (typeof handoff.sceneId === "string" && initialCatalog?.scenes.some((item) => item.id === handoff.sceneId)) {
              setSelectedSceneId(handoff.sceneId);
              setView("agent");
              setStep("input");
              setMessage("Your video details were restored. Please upload your product photos again.");
            }
            const quickStartScene = typeof handoff.quickStartSceneId === "string" ? initialCatalog?.scenes.find((item) => item.id === handoff.quickStartSceneId) : undefined;
            if (quickStartScene) setQuickStartSceneId(quickStartScene.id);
          }
        }
      } catch {
        // Ignore expired or malformed browser-only handoff data.
      }
    }
    // Both SSR and /catalog include the customer's actors. Task details do not need
    // the complete Library payload before they can be displayed.
    const loads: Promise<unknown>[] = [];
    if (!initialCatalog) {
      loads.push(request<{ catalog: WorkspaceCatalog }>("/catalog", { signal: controller.signal }).then((result) => { if (!controller.signal.aborted) setCatalog(result.catalog); }));
    }
    if (customerId && taskId) {
      setLoading(true);
      loads.push(request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}`, { signal: controller.signal }).then((result) => {
        if (active()) {
          acceptTask(result.task); setView("agent");
          const requestedStep = steps.some((item) => item.id === params.get("step")) ? params.get("step") as Step : "input";
          setStep(result.task.input.direct
            ? result.task.video?.finalUrl ? "delivery" : "input"
            : requestedStep);
        }
      }));
    } else if (customerId && (entryView === "library" || entryView === "home" || entryView === "subtitles")) {
      setLoading(true);
      loads.push(request<{ tasks: WorkspaceTask[]; hasMore?: boolean }>("/tasks?limit=20&offset=0", { signal: controller.signal }).then((result) => { if (active()) { setTasks(result.tasks); setTasksHasMore(Boolean(result.hasMore)); tasksOffsetRef.current = result.tasks.length; } }));
    }
    void Promise.allSettled(loads).then((results) => {
      if (!active()) return;
      const failed = results.find((result) => result.status === "rejected");
      if (failed?.status === "rejected") setMessage(failed.reason instanceof Error ? failed.reason.message : "Couldn't load your workspace.");
      setLoading(false);
    });
    return () => controller.abort();
  }, [acceptTask, customerId, initialCatalog, initialTaskId, initialView, initialPreset, request, siteId]);

  const taskRunning = Boolean(operationActive || task?.status === "rendering" || clipsProcessing);
  const taskId = task?.taskId;
  useEffect(() => {
    if (!taskId || !customerId || !taskRunning) return;
    return startWorkspacePolling(async (signal) => {
      if (dirty.current || busy) return;
      const revision = currentRef.current?.revision;
      try {
        const result = await request<{ task: WorkspaceTask }>(`/tasks/${taskId}`, { signal });
        if (!signal.aborted && !dirty.current && currentRef.current?.taskId === taskId && currentRef.current.revision === revision) acceptTask(result.task);
      } catch (error) { if (!signal.aborted) setMessage((error as Error).message); }
    }, 3500);
  }, [acceptTask, busy, customerId, request, taskId, taskRunning]);

  useEffect(() => {
    const current = currentRef.current;
    if (!current?.storyboard || dirty.current || !customerId || taskRunning || view !== "agent" || step !== "storyboard") return;
    const controller = new AbortController();
    const actions = current.storyboard.shots.flatMap((shot) => (["generate_shot", ...(scene?.needsActor ? ["compose_shot"] : [])]).map((action) => ({ shotId: shot.shotId, action })));
    void Promise.allSettled(actions.map(async ({ shotId, action }) => {
      const result = await request<{ quote: ActionQuote }>(`/tasks/${current.taskId}/quote?action=${action}&shotId=${encodeURIComponent(shotId)}`, { signal: controller.signal });
      return { key: `${current.taskId}:${shotId}:${action}`, quote: result.quote };
    })).then((results) => { if (!controller.signal.aborted) setQuotes((values) => { const next = { ...values }; results.forEach((result) => { if (result.status === "fulfilled") next[result.value.key] = result.value.quote; }); return next; }); });
    return () => controller.abort();
  }, [customerId, request, scene?.needsActor, step, task?.revision, task?.taskId, taskRunning, view]);

  useEffect(() => {
    if (view !== "images" || !customer || (imageInput.toolId === "custom" && !imageInput.prompt.trim()) || !imageInput.assetUrls.length) { setImageQuote(null); return; }
    let cancelled = false;
    setImageQuote(null);
    const timer = setTimeout(() => {
      void request<{ quote: ActionQuote }>("/images/quote", { method: "POST", body: JSON.stringify(imageInput) }).then((result) => { if (!cancelled) setImageQuote(result.quote); }).catch((error) => { if (!cancelled) setImageQuote({ available: false, credits: null, currency: "credits", reason: error.message }); });
    }, 650);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [customer, imageInput, request, view]);

  useEffect(() => {
    if (view !== "images" || !customerId) return;
    return startWorkspacePolling(async (signal) => {
      try {
        const result = await request<ImageResult>("/images", { signal });
        if (!signal.aborted) setImageResults(result);
      } catch (error) { if (!signal.aborted) setMessage((error as Error).message); }
    }, 5000, true);
  }, [customerId, request, view]);

  // Keep the library live while a clip is still with the provider, so a
  // finished or rejected shot leaves "Working" without a manual reload.
  const libraryInFlight = view === "library" && tasks.some((item) =>
    item.operation?.state === "pending" || item.operation?.state === "run" ||
    (item.storyboard?.shots ?? []).some((shot) =>
      Boolean(shot.compositeGenerationJobId) && (shot.compositeStatus === "run" || shot.compositeStatus === "pending") ||
      (shot.versions ?? []).some((version) => Boolean(version.generationJobId) && (version.status === "run" || version.status === "pending"))
    )
  );
  useEffect(() => {
    if (!customerId || !libraryInFlight) return;
    return startWorkspacePolling(async (signal) => {
      try {
        // The poll refreshes the loaded head window; tasks from appended
        // scroll pages are kept so paging and live updates compose.
        const result = await request<{ tasks: WorkspaceTask[] }>("/tasks", { signal });
        if (!signal.aborted) setTasks((current) => {
          const refreshedIds = new Set(result.tasks.map((item) => item.taskId));
          return [...result.tasks.map((item) => {
            const saved = current.find((entry) => entry.taskId === item.taskId);
            return saved && saved.revision > item.revision ? saved : item;
          }), ...current.filter((entry) => !refreshedIds.has(entry.taskId))];
        });
      } catch { /* Library refresh should not interrupt browsing. */ }
    }, 4000);
  }, [customerId, libraryInFlight, request]);

  const loadMoreTasks = useCallback(async () => {
    if (!customerId || !tasksHasMore || tasksLoadingMore || loading) return;
    setTasksLoadingMore(true);
    try {
      const offset = tasksOffsetRef.current;
      const result = await request<{ tasks: WorkspaceTask[]; hasMore?: boolean }>(`/tasks?limit=20&offset=${offset}`);
      tasksOffsetRef.current = offset + result.tasks.length;
      setTasks((current) => {
        const known = new Set(current.map((entry) => entry.taskId));
        return [...current, ...result.tasks.filter((item) => !known.has(item.taskId))];
      });
      setTasksHasMore(Boolean(result.hasMore));
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setTasksLoadingMore(false);
    }
  }, [customerId, loading, request, tasksHasMore, tasksLoadingMore]);

  // Infinite scroll: load the next page when the customer approaches the end
  // of the library grid. The observer reconnects whenever a page settles
  // (loading flag flips back), and the cursor keeps paging moving even when
  // the 4-second poll reshuffles the head of the list.
  useEffect(() => {
    if (view !== "library" || !tasksHasMore || tasksLoadingMore) return;
    const sentinel = librarySentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) void loadMoreTasks();
    }, { rootMargin: "800px 0px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreTasks, tasksHasMore, tasksLoadingMore, view]);

  useEffect(() => {
    if (!customerId) return;
    return startWorkspacePolling(async (signal) => {
      try {
        const result = await request<{ customerBalance: { balance: number; reserved: number } | null }>("/balance", { signal });
        if (!signal.aborted && result.customerBalance) setBalance(result.customerBalance.balance - result.customerBalance.reserved);
      } catch { /* Balance refresh should not interrupt the current workflow. */ }
    }, 4000, customer?.balance == null);
  }, [customerId, customer?.balance, request]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  useEffect(() => {
    if (modal !== "actors" && modal !== "product" && modal !== "templates") return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    privateModalRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Close dialog"]')?.focus();
    const handle = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeModal(); return; }
      if (event.key !== "Tab") return;
      const controls = Array.from(privateModalRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), audio[controls], [tabindex="0"]') ?? []);
      const first = controls[0]; const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", handle);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", handle); if (previous?.isConnected) previous.focus(); };
  }, [closeModal, modal]);

  function updateUrl(nextTask: WorkspaceTask | null, nextStep: Step = "input", nextView: View = nextTask ? "agent" : view) {
    const url = new URL(window.location.href);
    if (nextTask) {
      url.pathname = `${basePath}/app/create`;
      url.search = new URLSearchParams({ task: nextTask.taskId, step: nextStep }).toString();
    } else {
      // Fixed view paths keep the address bar free of query state.
      url.pathname = staticViewHref(basePath, nextView);
      url.search = "";
      url.hash = "";
    }
    window.history.replaceState(window.history.state, "", url);
  }

  async function navigate(next: View) {
    if (next === "images" && composerProducts.length) setImageInput((current) => current.assetUrls.length ? current : { ...current, assetUrls: composerProducts.map((asset) => asset.previewUrl).slice(0, 4) });
    const navigation = ++navigationSerial.current;
    visibleView.current = next;
    setView(next); setMobileOpen(false); setMessage(""); window.scrollTo({ top: 0 }); setLoading(false);
    // Keep the editor refs until the queued save succeeds. The module can render
    // immediately while failed edits remain recoverable in the original editor.
    if (next !== "agent") { setTask(null); updateUrl(null, "input", next); }
    else {
      // Menu navigation to Text to Video must always land on the initial
      // compact composer. The scene-guided stepped form is only for explicit
      // scene entry (template picker, quick start, product import, deep links).
      if (!currentRef.current) {
        setSelectedSceneId("");
        const url = new URL(window.location.href);
        if (url.searchParams.has("scene")) { url.searchParams.delete("scene"); window.history.replaceState(window.history.state, "", url); }
      }
      setTask(currentRef.current); updateUrl(currentRef.current, step, next);
    }
    const save = persist().then(() => {
      if (navigation === navigationSerial.current && next !== "agent") {
        currentRef.current = null; savedRef.current = null;
      }
    }).catch(() => {
      if (navigation !== navigationSerial.current || !currentRef.current) return;
      visibleView.current = "agent";
      setView("agent"); setTask(currentRef.current); setLoading(false);
      updateUrl(currentRef.current, step, "agent");
    });
    if (next === "library" && customerId) {
      setLoading(true);
      try {
        // Reload everything the customer has already paged through, so the
        // accumulated list stays complete when they return — and re-arm
        // paging: without this, a client-side navigation used to leave
        // tasksHasMore false and the sentinel never rendered again.
        const result = await request<{ tasks: WorkspaceTask[]; hasMore?: boolean }>(`/tasks?limit=${Math.max(tasksOffsetRef.current, 20)}&offset=0`);
        if (navigation === navigationSerial.current) {
          setTasks((current) => {
            const refreshedIds = new Set(result.tasks.map((item) => item.taskId));
            return [...result.tasks.map((item) => {
              const saved = current.find((entry) => entry.taskId === item.taskId);
              return saved && saved.revision > item.revision ? saved : item;
            }), ...current.filter((entry) => !refreshedIds.has(entry.taskId))];
          });
          setTasksHasMore(Boolean(result.hasMore));
          tasksOffsetRef.current = result.tasks.length;
        }
      } catch (error) { if (navigation === navigationSerial.current) setMessage((error as Error).message); }
      finally { if (navigation === navigationSerial.current) setLoading(false); }
    }
    await save;
  }

  function composerInput(selected: SceneSchema, preset?: ComposerPreset): TaskInput {
    const input = defaultInput(selected);
    if (selected.needsActor && composerActorId) input.actorId = composerActorId;
    input.options.duration = preset?.duration ?? composerDuration; input.options.aspect = preset?.aspect ?? composerAspect;
    const resolution = preset?.resolution ?? composerResolution;
    if (resolution) input.options.resolution = resolution;
    if (preset?.referenceVideos?.length) input.referenceVideos = preset.referenceVideos;
    if (preset?.referenceAudios?.length) input.referenceAudios = preset.referenceAudios;
    input.options.subtitle = selected.needsActor && Boolean(catalog?.subtitles?.available);
    const modelId = preset?.modelId ?? composerModel;
    if (modelId) input.modelId = modelId;
    const imageField = selected.sections.flatMap((section) => section.fields).find((field) => field.type === "images" && field.required);
    const referenceUrls = preset?.referenceUrls ?? composerProducts.map((asset) => asset.previewUrl);
    // Direct mode sends every uploaded reference. The provider capability (not
    // the scene's four-photo storyboard guideline) sets the ceiling here.
    const imageLimit = catalog?.imageReferenceMax ?? imageField?.max ?? 4;
    if (imageField && referenceUrls.length) input.images[imageField.id] = referenceUrls.slice(0, imageLimit);
    const requiredText = selected.sections.flatMap((section) => section.fields).find((field) => field.required && (field.type === "text" || field.type === "textarea"));
    if (prompt.trim() && requiredText) input.fields[requiredText.id] = prompt.trim();
    // Direct mode ignores scene fields for generation, so keeping the prompt in
    // the required field only satisfies draft validation; it is never sent as
    // product facts. The creative direction is the complete provider prompt.
    input.direct = true;
    input.creativeDirection = prompt.trim();
    return input;
  }

  async function selectScene(selected: SceneSchema, preset?: ComposerPreset) {
    try { await persist(); } catch { return; }
    setQuickStartSceneId("");
    currentRef.current = null; savedRef.current = null;
    setSelectedSceneId(selected.id);
    setDraftReferenceUrls(preset?.referenceUrls ?? composerProducts.map((asset) => asset.previewUrl));
    if (preset?.duration) setComposerDuration(preset.duration);
    if (preset?.aspect) setComposerAspect(preset.aspect);
    if (preset?.modelId) setComposerModel(preset.modelId);
    setComposerTitle(preset?.title ?? activePreset?.title ?? ((view === "product" || view === "videoLink") && composerTitle ? composerTitle : selected.name));
    setMessage("");
    setTask(null);
    setStep("input");
    setView("agent");
    visibleView.current = "agent";
    updateUrl(null, "input", "agent");
    window.history.replaceState({ ...window.history.state, scene: selected.id }, "");
  }

  /**
   * 场景表单提交（文字转视频 / 产品链接共用）：校验 → 取生成预报价 → 弹出
   * 确认框；确认后建稿并自动生成，全程停留在当前模块页，不再跳去编辑器。
   */
  async function saveSceneDraft(scene: SceneSchema, surface: "agent" | "product") {
    const selected = scene;
    const input = composerInput(selected, { aspect: composerAspect, duration: composerDuration, modelId: composerModel, referenceUrls: draftReferenceUrls });
    const fields = selected.sections.flatMap((section) => section.fields);
    const requiredImage = fields.find((field) => field.type === "images" && field.required);
    const requiredText = fields.find((field) => field.required && (field.type === "text" || field.type === "textarea"));
    if (!requiredImage || !(input.images[requiredImage.id]?.length)) { setMessage("Add at least one product photo before saving this draft."); return; }
    const draftDescription = activePreset?.kind === "video" ? input.creativeDirection : requiredText ? input.fields[requiredText.id] : "";
    if (!String(draftDescription ?? "").trim()) { setMessage("Describe your video in one sentence before saving this draft."); return; }
    if (!customer) { continueToLoginWithDraft(); return; }
    setBusy(true); setMessage("");
    try {
      const selectedProductBrief = [...composerProducts].reverse().find((asset) => asset.confirmedBrief && Object.values(input.images).some((urls) => urls.includes(asset.previewUrl)))?.confirmedBrief;
      const productBrief = selectedProductBrief ? {
        sourceUrl: selectedProductBrief.sourceUrl,
        fetchedPageUrl: selectedProductBrief.fetchedPageUrl,
        title: selectedProductBrief.title,
        description: selectedProductBrief.description,
        possiblePrice: selectedProductBrief.possiblePrice,
        selectionConfirmed: selectedProductBrief.selectionConfirmed,
        priceConfirmed: selectedProductBrief.priceConfirmed,
        reviewRequired: selectedProductBrief.reviewRequired,
        customerConfirmedAt: selectedProductBrief.customerConfirmedAt,
      } : undefined;
      const source = activePreset?.kind === "video" ? { sourcePage: activePreset.sourcePage, presetId: activePreset.presetId, sourceUpdatedAt: activePreset.sourceUpdatedAt } : undefined;
      const quoted = await request<{ quote: ActionQuote }>("/generation-quote", { method: "POST", body: JSON.stringify({ direct: true, modelId: input.modelId || undefined, duration: input.options.duration, aspect: input.options.aspect, resolution: input.options.resolution || undefined, imageInputCount: draftReferenceUrls.length }) });
      setPendingGenerate({ scene: selected, input, title: composerTitle.trim() || selected.name, productBrief, source, surface, quote: quoted.quote });
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  /**
   * 场景创建表单（文字转视频与产品链接页共用）：产品图片条 + 一句话描述 +
   * Create video。agent 面带返回按钮整页渲染；product 面内嵌在产品链接页。
   */
  function sceneCreateForm(scene: SceneSchema, surface: "agent" | "product") {
    const imageLimit = scene.sections.flatMap((section) => section.fields).find((field) => field.type === "images" && field.required)?.max ?? 4;
    return <>
      {surface === "agent" && <div className={styles.pageTitle}><button className={styles.linkButton} onClick={() => { setSelectedSceneId(""); setDraftReferenceUrls([]); updateUrl(null, "input", "agent"); const url = new URL(window.location.href); url.searchParams.delete("scene"); window.history.replaceState(window.history.state, "", url); }}><ArrowLeft size={15} /><span>Back to Text to Video</span></button><h1>{scene.name}</h1><p>Add the product photos and a short brief for this scene. Confirm to create the video task and start generation right here.</p></div>}
      <section className={`${styles.formSection} ${styles.videoDraftForm}`}>
        <h2>1. Add your product and idea</h2>
        <p>Start with at least one clear product photo and a short description. You can adjust the prompt and photos before generating.</p>
        <div className={styles.fields}>
          <div className={styles.field}>
            <div className={styles.sectionHead}><span className={styles.fieldLabel}>Product photos</span><button type="button" className={styles.linkButton} disabled={working} onClick={() => setModal("product")}>Import product details</button></div>
            <FileDropZone className={`${styles.imageStrip} ${styles.draftImageStrip}`} activeClassName={styles.dropActive} disabled={working || !customer} onFiles={importDraftReferenceFiles}>
              <div className={styles.draftReferenceColumn}>
                {draftReferenceUrls.length < imageLimit ? <label className={`${styles.upload} ${styles.draftPhotoUpload}`}><Upload size={19} /><span>{busy ? "Uploading…" : "Add photo"}</span><input aria-label="Upload product photos" accept="image/*" type="file" multiple disabled={working || !customer} onChange={(event) => { void uploadDraftReferences(event.target.files); event.target.value = ""; }} /></label> : <div className={`${styles.upload} ${styles.draftPhotoUpload} ${styles.draftPhotoLimit}`} aria-hidden="true"><ImageIcon size={19} /><span>Photo limit</span></div>}
                <span className={styles.draftReferenceCount} aria-label={`Product photos: ${draftReferenceUrls.length} of ${imageLimit}`}>{`${draftReferenceUrls.length} / ${imageLimit} photos`}</span>
              </div>
              {draftReferenceUrls.map((url, index) => <div className={`${styles.imageSlot} ${styles.draftPhotoSlot}`} key={`${url}-${index}`} {...reorderHandlers(index, working, moveDraftReference)}><img loading="lazy" decoding="async" src={url} alt={`Product photo ${index + 1}`} /><button type="button" className={styles.removeImage} disabled={working} aria-label={`Remove product photo ${index + 1}`} onClick={() => setDraftReferenceUrls((items) => items.filter((_, position) => position !== index))}><X size={12} /></button></div>)}
            </FileDropZone>
            {!customer && <span className={styles.help}>Log in to upload photos and save this draft.</span>}
          </div>
          <label className={styles.field}><span className={styles.fieldLabel}>Describe your video in one sentence</span><textarea className={styles.input} value={prompt} maxLength={WORKSPACE_PROMPT_MAX_LENGTH} onPaste={(event) => {
            const files = takePasteFiles(event);
            if (!files.length || !customer) return;
            event.preventDefault();
            importDraftReferenceFiles(files);
          }} onChange={(event) => setPrompt(event.target.value)} placeholder="What should viewers notice about your product?" /><span className={styles.help}>{prompt.length} / {WORKSPACE_PROMPT_MAX_LENGTH} characters</span></label>
        </div>
        {scene.needsActor && <p className={styles.help} style={{ marginTop: 16 }}>You can choose a presenter after saving the draft.</p>}
        {surface !== "product" && importedBriefNotice()}
        {/* Same control row as the home composer's footer: the draft honours
        the shared composer state, so a choice made here carries everywhere. */}
        <div className={styles.parameterGrid} style={{ marginTop: 18 }}>
          <div className={styles.field}><span className={styles.fieldLabel}>Video model</span><WorkspaceSelect ariaLabel="Video model" disabled={busy} value={composerModel || activeModel?.id || ""} options={editorModelOptions} onChange={(value) => setComposerModel(value)} placeholder="No model connected" /></div>
          <div className={styles.field}><span className={styles.fieldLabel}>Duration</span><WorkspaceSelect ariaLabel="Video duration" disabled={busy} value={String(composerDuration)} options={editorDurationOptions} onChange={(value) => setComposerDuration(Number(value) as TaskInput["options"]["duration"])} /></div>
          <div className={styles.field}><span className={styles.fieldLabel}>Aspect ratio</span><WorkspaceSelect ariaLabel="Aspect ratio" disabled={busy} value={composerAspect} options={editorAspectOptions} onChange={(value) => setComposerAspect(value as TaskInput["options"]["aspect"])} /></div>
          {composerModelResolutions.length > 0 && <div className={styles.field}><span className={styles.fieldLabel}>Resolution</span><WorkspaceSelect ariaLabel="Video resolution" disabled={busy} value={composerResolution || composerModelResolutions[0]} options={composerModelResolutions.map((value) => ({ value, label: value }))} onChange={(value) => setComposerResolution(value)} /></div>}
        </div>
        <div className={styles.footerActions}>
          {composerQuote?.available && composerQuote.credits != null && <span className={styles.help} role="status">Estimated cost: {composerQuote.credits} credits</span>}
          <button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => void saveSceneDraft(scene, surface)}>{busy ? <Loader2 size={16} className={styles.spin} /> : <Check size={16} />}<span>Create video</span></button>
        </div>
        <p className={styles.help}>We'll generate your video from this prompt and your photos, then save it to your Library.</p>
      </section>
      {surface === "agent" && canBrowseTemplates && templatePickerCallout()}
    </>;
  }

  async function uploadDraftReferences(files: FileList | File[] | null) {
    if (!files?.length) return;
    if (!customer) { continueToLoginWithDraft(); return; }
    const imageField = selectedScene?.sections.flatMap((section) => section.fields).find((field) => field.type === "images" && field.required);
    const limit = imageField?.max ?? 4;
    const available = Math.max(0, limit - draftReferenceUrls.length);
    if (!available) return;
    setBusy(true); setMessage("");
    try {
      for (const file of Array.from(files).slice(0, available)) {
        const asset = await uploadAsset(file);
        setDraftReferenceUrls((items) => [...items, asset.previewUrl].slice(0, limit));
        setComposerProducts((items) => [...items.filter((item) => item.previewUrl !== asset.previewUrl), asset].slice(-4));
      }
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function createBatch(items: BatchDraftItem[]) {
    if (!customer) { continueToLoginWithDraft(); return; }
    setBusy(true); setMessage(""); setBatchNotice("");
    try {
      const result = await request<{ tasks: WorkspaceTask[]; failed: { index: number; error: string }[] }>("/tasks/batch", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ items }),
      });
      setTasks((current) => [...result.tasks, ...current.filter((item) => !result.tasks.some((created) => created.taskId === item.taskId))]);
      setBatchOpen(false);
      setView("library"); setLibraryFilter("all"); setMobileOpen(false); updateUrl(null, "input", "library");
      if (result.failed.length) setBatchNotice(`${result.tasks.length} drafts created. ${result.failed.length} couldn't be created.`);
      else setBatchNotice(`${result.tasks.length} ${result.tasks.length === 1 ? "draft" : "drafts"} created and saved to your Library.`);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function openTask(item: Pick<WorkspaceTask, "taskId">) {
    setBusy(true); setMessage("");
    try {
      await persist();
      const result = await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(item.taskId)}`);
      acceptTask(result.task); setView("agent");
      const nextStep = result.task.input.direct
        ? result.task.video?.finalUrl ? "delivery" : "input"
        : result.task.video?.finalUrl ? "delivery" : result.task.storyboard ? "storyboard" : "input";
      setStep(nextStep); updateUrl(result.task, nextStep);
    }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function startNewVideo() {
    await persist().catch(() => {});
    currentRef.current = null; savedRef.current = null; dirty.current = false;
    visibleView.current = "agent";
    setTask(null); setStep("input"); setView("agent"); setMessage(""); setMessageAction(false);
    updateUrl(null, "input", "agent");
  }

  async function retryTaskRender(taskId: string) {
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const current = (await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}`)).task;
      await dispatchActionOrFollowServer(taskId, { revision: current.revision, action: "render" }, (t) =>
        t.status === "rendering" || Boolean(t.video && (t.video.status === "run" || t.video.finalUrl)));
      setMessage("Finishing your video…");
      const finalTask = await pollTaskUntil(taskId, (next) => Boolean(next.video?.finalUrl) || next.video?.status === "fail", 600000);
      void refreshBalanceSoon();
      if (finalTask.video?.status === "fail") throw new Error(finalTask.video.error ? humanError(finalTask.video.error) : "The video could not be finished.");
      setMessage(`Your video “${finalTask.title}” is ready — find it in your Library.`);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function retryDirectTask() {
    if (!task || busy) return;
    setBusy(true); setMessage("");
    try {
      const current = (await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(task.taskId)}`)).task;
      const shot = current.storyboard?.shots[0];
      const version = shot?.versions.find((item) => item.vid === shot.curVer) ?? shot?.versions.at(-1);
      if (shot && version?.clipUrl && version.status === "done") {
        await request(`/tasks/${encodeURIComponent(task.taskId)}/actions`, { method: "POST", body: JSON.stringify({ revision: current.revision, action: "render" }) });
        setMessage("Finishing your video…");
        const finalTask = await pollTaskUntil(task.taskId, (next) => Boolean(next.video?.finalUrl) || next.video?.status === "fail", 600000);
        if (finalTask.video?.status === "fail") throw new Error(finalTask.video.error ? humanError(finalTask.video.error) : "The video could not be finished.");
        setMessage(`Your video “${finalTask.title}” is ready — find it in your Library.`);
        return;
      }
      await autoRunVideoTask(task.taskId);
    } catch (error) { setMessage((error as Error).message); }
    finally { setBusy(false); }
  }

  async function runAction(action: Action, extra: { shotId?: string; versionId?: string; language?: string } = {}) {
    if (!task || busy || (operationActive && action !== "resume")) return;
    setBusy(true); setMessage("");
    try {
      await persist();
      const current = savedRef.current!;
      let quoteToken: string | undefined;
      if (action === "generate_shot" || action === "compose_shot") {
        const key = `${current.taskId}:${extra.shotId}:${action}`;
        const result = await request<{ quote: ActionQuote }>(`/tasks/${current.taskId}/quote?action=${action}&shotId=${encodeURIComponent(extra.shotId ?? "")}`);
        const previous = quotes[key];
        setQuotes((values) => ({ ...values, [key]: result.quote }));
        if (!result.quote.available) throw new Error(humanError(result.quote.reason) || "Generation isn't available with these settings.");
        if (!previous?.available || previous.credits !== result.quote.credits) {
          setMessage(`The current price is ${result.quote.credits} credits. Review the updated price and click Generate again.`);
          return;
        }
        quoteToken = result.quote.quoteToken;
      }
      const result = await request<{ task: WorkspaceTask }>(`/tasks/${current.taskId}/actions`, { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ revision: current.revision, action, ...extra, ...(quoteToken ? { quoteToken } : {}) }) });
      acceptTask(result.task);
      const nextStep = action === "storyboard" || action === "reroll" ? "storyboard" : action === "render" ? result.task.video?.finalUrl ? "delivery" : "render" : step;
      setStep(nextStep); updateUrl(result.task, nextStep);
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function removeTask(item: WorkspaceTask) {
    if (!window.confirm(`Delete “${item.title}”? This permanently removes this task from your library.`)) return;
    setBusy(true);
    try { await request(`/tasks/${item.taskId}`, { method: "DELETE", headers: { "If-Match": String(item.revision) } }); setTasks((items) => items.filter((entry) => entry.taskId !== item.taskId)); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function uploadAsset(file: File): Promise<ImportedProductAsset> {
    if (!customer) throw new Error("Please log in to upload your images.");
    const prepared = await prepareCustomerImageUploadFile(file);
    const body = new FormData(); body.append("file", prepared.file); body.append("label", file.name.replace(/\.[^.]+$/, "")); body.append("role", "input");
    const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customer.id)}/assets`, { method: "POST", credentials: "same-origin", headers: { ...csrfHeader(`customer_csrf_${siteId}`), ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) }, body });
    const result = await response.json();
    if (!response.ok || !result.asset?.previewUrl) throw new Error(result.message || humanError(result.error) || "Your image could not be uploaded.");
    return result.asset as ImportedProductAsset;
  }

  async function upload(file: File): Promise<string> { return (await uploadAsset(file)).previewUrl; }

  async function uploadField(field: SceneField, files: FileList | File[] | null) {
    if (!files?.length || !task) return;
    setBusy(true); setMessage("");
    try {
      const available = Math.max(0, (field.max ?? 4) - (currentRef.current?.input.images[field.id]?.length ?? 0));
      for (const file of Array.from(files).slice(0, available)) {
        const url = await upload(file);
        editTask((current) => ({ ...current, input: { ...current.input, images: { ...current.input.images, [field.id]: [...(current.input.images[field.id] ?? []), url] } } }));
      }
      await persist();
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function uploadActor(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    try { const url = await upload(file); setActorDraft((current) => ({ ...current, imageUrl: url })); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function uploadAvatarProduct(file: File | undefined) {
    if (!file) return;
    if (!customer) { window.location.assign(currentLoginHref()); return; }
    setBusy(true); setMessage("");
    try {
      const asset = await uploadAsset(file);
      setAvatarProductImages((current) => [...current, asset.previewUrl].slice(0, 4));
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  /** 主持人视频共用的校验与入参构建：生成与「Save as draft」两条路径走同一份输入。 */
  function prepareAvatarGeneration(): { input: TaskInput; title: string } | null {
    if (!customer) { window.location.assign(currentLoginHref()); return null; }
    const selectedActor = catalog?.actors.find((item) => item.actorId === avatarSelectionId);
    const presenterScene = catalog?.scenes.find((item) => item.id === "presenter_showcase");
    if (!selectedActor || !presenterScene) { setMessage("Choose a presenter before continuing."); return null; }
    if (!avatarProductImages.length) { setMessage("Add at least one product photo before continuing."); return null; }
    if (!avatarScript.trim()) { setMessage("Add a script or key talking points before continuing."); return null; }
    if (avatarModelUnavailable) { setMessage("No connected video model currently supports presenter speech."); return null; }

    const input = defaultInput(presenterScene);
    input.actorId = selectedActor.actorId;
    // Direct mode submits one clip straight to the upstream video model: the
    // script is the verbatim prompt. The actor portrait rides through
    // input.actorId (first reference slot upstream) and the voice sample
    // through referenceAudios. Product references stay customer-owned uploads
    // only: the ownership check rejects site catalog URLs inside the list.
    input.images.productImages = avatarProductImages.slice(0, avatarImageFieldMax);
    if (selectedActor.voice.refAudio) input.referenceAudios = [selectedActor.voice.refAudio];
    input.fields.sellingPoints = avatarScript.trim();
    input.creativeDirection = avatarScript.trim();
    input.direct = true;
    input.options.aspect = selectedAvatarAspect as TaskInput["options"]["aspect"];
    input.options.duration = selectedAvatarDuration as TaskInput["options"]["duration"];
    if (selectedAvatarResolution) input.options.resolution = selectedAvatarResolution;
    input.options.language = selectedAvatarLanguage;
    input.options.subtitle = Boolean(catalog?.subtitles?.available);
    if (avatarModel) input.modelId = avatarModel.id;
    return { input, title: `${selectedActor.name} video` };
  }

  function clearAvatarComposer() {
    setAvatarScript(""); setAvatarProductImages([]); setAvatarSelectionId("");
  }

  /** 确认后直接提交上游生成：direct 单镜头直出，任务即时进入生成状态。 */
  async function createAvatarGeneration() {
    const prepared = prepareAvatarGeneration();
    if (!prepared) return;
    setBusy(true); setMessage("");
    try {
      const result = await request<{ task: WorkspaceTask }>("/tasks", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ sceneId: "presenter_showcase", input: prepared.input, title: prepared.title }),
      });
      setTasks((current) => [result.task, ...current.filter((item) => item.taskId !== result.task.taskId)]);
      void refreshBalanceSoon();
      clearAvatarComposer();
      setInlineRun({ taskId: result.task.taskId, title: result.task.title, status: "Preparing your video…", state: "running" });
      setMessage(`Generating “${result.task.title}” — progress is shown below and in your Library.`);
      setMessageKind("info");
      setMessageAction(true);
      window.scrollTo({ top: 0 });
      await autoRunVideoTask(result.task.taskId);
    } catch (error) { setMessage((error as Error).message); setMessageKind("error"); } finally { setBusy(false); }
  }

  /** 确认弹窗中的「Save as draft」：只保存主持人视频的脚本与设置，不触发生成。 */
  async function saveAvatarDraft() {
    const prepared = prepareAvatarGeneration();
    if (!prepared) return;
    setBusy(true); setMessage("");
    try {
      const result = await request<{ task: WorkspaceTask }>("/tasks", {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ sceneId: "presenter_showcase", input: prepared.input, title: prepared.title }),
      });
      setTasks((current) => [result.task, ...current.filter((item) => item.taskId !== result.task.taskId)]);
      clearAvatarComposer();
      setMessage(`Saved “${result.task.title}” to your Library as a draft. Open it anytime to review and generate.`);
      setMessageKind("info");
      setMessageAction(true);
    } catch (error) { setMessage((error as Error).message); setMessageKind("error"); } finally { setBusy(false); }
  }

  /** 提交前弹出费用确认：报价口径与图生视频一致（direct 直出 + 参考图/音频计数）。 */
  async function openAvatarSubmitConfirm() {
    if (!customer) { window.location.assign(currentLoginHref()); return; }
    const selectedActor = catalog?.actors.find((item) => item.actorId === avatarSelectionId);
    if (!selectedActor) { setMessage("Choose a presenter before continuing."); return; }
    if (!avatarProductImages.length) { setMessage("Add at least one product photo before continuing."); return; }
    if (!avatarScript.trim()) { setMessage("Add a script or key talking points before continuing."); return; }
    if (avatarModelUnavailable) { setMessage("No connected video model currently supports presenter speech."); return; }
    setBusy(true); setMessage("");
    try {
      const result = await request<{ quote: { available: boolean; credits?: number; reason?: string } }>("/generation-quote", {
        method: "POST",
        body: JSON.stringify({
          direct: true,
          modelId: avatarModel?.id || undefined,
          duration: selectedAvatarDuration,
          aspect: selectedAvatarAspect,
          resolution: selectedAvatarResolution || undefined,
          imageInputCount: Math.min(avatarImageFieldMax, avatarProductImages.length + 1),
          audioInputCount: selectedActor.voice.refAudio ? 1 : 0
        })
      });
      setPendingAvatarSubmit({ quote: result.quote });
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function createActor(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await request<{ actor: ActorAsset }>("/actors", { method: "POST", body: JSON.stringify(actorDraft) });
      setCatalog((current) => current ? { ...current, actors: [...current.actors, result.actor] } : current);
      if (task) updateInput((input) => ({ ...input, actorId: result.actor.actorId }));
      else if (presenterStudioEnabled) setAvatarSelectionId(result.actor.actorId);
      setCreatingActor(false); setActorDraft({ name: "", gender: "female", ageRange: "25-30", imageUrl: "", languages: ["en"] });
      if (task || (presenterStudioEnabled && modal === "actors")) setModal(null);
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function deleteActor(actor: ActorAsset) {
    if (!window.confirm(`Delete “${actor.name}” from your avatars?`)) return;
    setBusy(true); setMessage("");
    try { await request(`/actors/${encodeURIComponent(actor.actorId)}`, { method: "DELETE" }); setCatalog((current) => current ? { ...current, actors: current.actors.filter((item) => item.actorId !== actor.actorId) } : current); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function uploadImageReference(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    try { const url = await upload(file); setImageInput((current) => ({ ...current, assetUrls: [...current.assetUrls, url].slice(0, 4) })); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  async function uploadVideoReference(file: File) {
    setBusy(true); setMessage("");
    try { const url = await upload(file); setVideoReferenceUrls((current) => [...current, url].slice(0, 4)); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  /** 参考视频/音频走工作台专用上传接口（顾客资产同一存储链路）。 */
  async function uploadReferenceFile(file: File, kind: "video" | "audio") {
    setBusy(true); setMessage("");
    try {
      const body = new FormData(); body.append("file", file);
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/aivideosugc/reference-upload`, { method: "POST", credentials: "same-origin", headers: { ...csrfHeader(`customer_csrf_${siteId}`), ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) }, body });
      const result = await response.json();
      if (!response.ok || !result.asset?.url) throw new Error(result.message || humanError(result.error) || "Your file could not be uploaded.");
      (kind === "video" ? setVideoReferenceFiles : setAudioReferenceFiles)((current) => [...current, result.asset.url].slice(0, 4));
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  /** 拖拽/粘贴导入：把图片文件加入草稿参考图（尊重场景上限）。 */
  function importDraftReferenceFiles(files: File[]) {
    void uploadDraftReferences(files.filter((file) => fileKind(file) === "image"));
  }

  function moveDraftReference(from: number, to: number) {
    setDraftReferenceUrls((current) => moveItem(current, from, to));
  }

  /** 拖拽/粘贴导入：把图片文件加入演讲者工作台的产品参考图。 */
  function importAvatarProductFiles(files: File[]) {
    for (const file of files) {
      if (fileKind(file) !== "image") continue;
      if (avatarProductImages.length >= avatarUserImageMax) break;
      void uploadAvatarProduct(file);
    }
  }

  // 演讲者工作台整页接受图片粘贴（上传区复制 Ctrl+V 即贴入）。可编辑元素
  // 保留原生粘贴；脚本框自己的 onPaste 已把图片转给上传器。
  useEffect(() => {
    if (view !== "actors" || !presenterStudioEnabled || !customer) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []).filter((file) => fileKind(file) === "image");
      if (!files.length) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      event.preventDefault();
      importAvatarProductFiles(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  function moveAvatarProductImage(from: number, to: number) {
    setAvatarProductImages((current) => moveItem(current, from, to));
  }

  /** 拖拽/粘贴导入：把图片文件加入任务字段图片列表。 */
  function importTaskFieldImages(field: SceneField, files: File[]) {
    void uploadField(field, files.filter((file) => fileKind(file) === "image"));
  }

  /** 把任务的提交表单回填到首页作曲家门，用户可再编辑；重新提交会创建一个新视频。 */
  function prefillFromTask(item: WorkspaceTask) {
    setDetailTaskId(null);
    // Presenter tasks go back to the AI actor studio with every previous
    // setting restored, so regenerating is one click away.
    const presenterActor = item.sceneId === "presenter_showcase" && item.input.actorId && presenterStudioEnabled
      ? catalog?.actors.find((entry) => entry.actorId === item.input.actorId)
      : undefined;
    if (presenterActor) {
      setAvatarSelectionId(presenterActor.actorId);
      setAvatarProductImages((item.input.images.productImages ?? []).filter((url) => url !== presenterActor.imageUrl));
      setAvatarScript(String(item.input.creativeDirection ?? (typeof item.input.fields.sellingPoints === "string" ? item.input.fields.sellingPoints : "")).trim());
      if (item.input.modelId) setAvatarModelId(item.input.modelId);
      setAvatarAspect(item.input.options.aspect);
      setAvatarDuration(item.input.options.duration);
      setAvatarResolution(item.input.options.resolution ?? "");
      setAvatarLanguage(item.input.options.language);
      setMessageAction(false);
      setMessage(`Your previous ${presenterActor.name} video settings are loaded. Adjust anything, then generate.`);
      void navigate("actors");
      return;
    }
    setComposerTab(item.sceneId === "text_to_video" ? "AI Video Agent" : "AI Video");
    setPrompt(String(item.input.fields.description ?? item.input.creativeDirection ?? Object.values(item.input.fields).find((value) => typeof value === "string" && value.trim()) ?? ""));
    if (item.input.modelId) setComposerModel(item.input.modelId);
    setComposerAspect(item.input.options.aspect);
    setComposerDuration(item.input.options.duration);
    setComposerResolution(item.input.options.resolution ?? "");
    setVideoReferenceUrls(Object.values(item.input.images).flat());
    setVideoReferenceFiles(item.input.referenceVideos ?? []);
    setAudioReferenceFiles(item.input.referenceAudios ?? []);
    setComposerTitle("");
    setMessageAction(false);
    setMessage("Your previous settings are loaded. Adjust anything, then generate to create a new video.");
    void navigate("home");
  }

  function continueHomeComposer(tab: HomeComposerTab, selection: HomeComposerVideoSelection) {
    // 一切生成入口都要求已登录：未登录时先把当前表单存为游客草稿，再跳转登录。
    if (!customer) { continueToLoginWithDraft(); return; }
    if (tab === "AI Image") { void navigate("images"); return; }
    setComposerModel(selection.modelId ?? ""); setComposerAspect(selection.aspect); setComposerDuration(selection.duration);
    if (selection.resolution) setComposerResolution(selection.resolution);
    void openGenerateConfirm(tab, selection);
  }

  /**
   * Wan3.0 提示词优化：把作曲家当前的描述与视频类型/参数交给后端，按 skill 的
   * 七段结构渲染成可直接粘贴的中文提示词。后端是异步 job（实测 40-80 秒），
   * 这里提交后每 3 秒轮询一次，结果在弹层里展示，采用后写回作曲家输入框。
   */
  async function optimizeCurrentPrompt(overrideSource?: string) {
    const source = (overrideSource ?? prompt).trim();
    if (!source) return;
    if (!customer) { continueToLoginWithDraft(); return; }
    if (promptOptimizing) return;
    setPromptOptimizer({ status: "submitting", sourcePrompt: source });
    setModal("promptOptimizer");
    // The confirmed product brief rides along so the optimized prompt states
    // real product facts (name, materials, sizes, price) instead of guesses.
    const briefSource = composerProducts.find((item) => item.confirmedBrief)?.confirmedBrief;
    const productBrief = briefSource ? {
      title: briefSource.title?.value,
      description: briefSource.description?.value,
      price: briefSource.possiblePrice?.value,
      variants: briefSource.variants?.value?.map((variant) => [variant.label, variant.price ? `${variant.price}${variant.currency ? ` ${variant.currency}` : ""}` : ""].filter(Boolean).join(" · ")).filter(Boolean)
    } : undefined;
    try {
      const accepted = await request<{ jobId: string }>("/prompt-optimizations", {
        method: "POST",
        body: JSON.stringify({
          prompt: source,
          videoTypeId: composerVideoType,
          durationSeconds: composerDuration,
          aspectRatio: composerAspect,
          resolution: composerResolution || (catalog?.models.find((model) => model.id === composerModel) ?? activeModel)?.resolutions?.[0] || undefined,
          referenceUrls: composerTab === "AI Video" ? videoReferenceUrls : [],
          productBrief
        }),
        headers: { "Idempotency-Key": crypto.randomUUID() }
      });
      setPromptOptimizer({ status: "polling", sourcePrompt: source });
      for (let attempt = 0; attempt < 100; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const { job } = await request<{ job: { status: "queued" | "running" | "succeeded" | "failed"; result?: { optimizedPrompt: string }; error?: { message?: string } | null } }>(`/prompt-optimizations/${accepted.jobId}`);
        if (job.status === "succeeded" && job.result?.optimizedPrompt) {
          setPromptOptimizer({ status: "succeeded", sourcePrompt: source, optimizedPrompt: job.result.optimizedPrompt });
          return;
        }
        if (job.status === "failed") {
          setPromptOptimizer({ status: "failed", sourcePrompt: source, error: job.error?.message || "Prompt optimization failed. Please adjust the prompt and try again." });
          return;
        }
      }
      setPromptOptimizer({ status: "failed", sourcePrompt: source, error: "Prompt optimization timed out. Please try again." });
    } catch (error) {
      setPromptOptimizer((current) => current ? { ...current, status: "failed", error: (error as Error).message } : null);
    }
  }

  /** 采用优化结果：写回作曲家输入框（仍可手改），并关闭弹层。 */
  function adoptOptimizedPrompt() {
    if (promptOptimizer?.status === "succeeded" && promptOptimizer.optimizedPrompt) setPrompt(promptOptimizer.optimizedPrompt);
    setModal(null);
  }

  /** 优化弹层里的重试：用同一份原文重新发起（新幂等键）。 */
  function retryPromptOptimization() {
    const source = promptOptimizer?.sourcePrompt ?? "";
    if (!source) return;
    setPromptOptimizer(null);
    void optimizeCurrentPrompt(source);
  }

  /** 组建生成入参并弹出二次确认（展示预计积分），确认后才真正创建任务。 */
  async function openGenerateConfirm(tab: HomeComposerTab, selection: HomeComposerVideoSelection) {
    const sceneId = tab === "AI Video" ? (activePreset?.kind === "video" ? presetSceneId : quickStartSceneId || "process_demo") : "text_to_video";
    const selected = catalog?.scenes.find((item) => item.id === sceneId);
    if (!selected) return;
    const referenceUrls = tab === "AI Video" ? videoReferenceUrls : [];
    const referenceVideos = tab === "AI Video" ? videoReferenceFiles : [];
    const referenceAudios = tab === "AI Video" ? audioReferenceFiles : [];
    if (!customer) { continueToLoginWithDraft(); return; }
    setBusy(true); setMessage("");
    try {
      const input = composerInput(selected, { ...selection, referenceUrls, referenceVideos, referenceAudios });
      if (selected.id === "text_to_video") input.fields.description = prompt.trim();
      const requiredText = selected.sections.flatMap((section) => section.fields).find((field) => field.required && (field.type === "text" || field.type === "textarea"));
      if (requiredText && selected.id !== "text_to_video" && !String(input.fields[requiredText.id] ?? "").trim() && prompt.trim()) input.fields[requiredText.id] = prompt.trim();
      setPendingGenerate({ scene: selected, input, title: composerTitle.trim() || selected.name, surface: "composer" });
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  /** 确认后：建稿并自动规划分镜、逐镜生成、合成成片，全程停留在当前页。 */
  async function runConfirmedGeneration() {
    const pending = pendingGenerate;
    if (!pending || !customer) return;
    setPendingGenerate(null); setBusy(true); setMessage("");
    try {
      const result = await request<{ task: WorkspaceTask }>("/tasks", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ sceneId: pending.scene.id, input: pending.input, title: pending.title, ...(pending.productBrief ? { productBrief: pending.productBrief } : {}), ...(pending.source ? { preset: pending.source } : {}) }) });
      setTasks((current) => [result.task, ...current.filter((item) => item.taskId !== result.task.taskId)]);
      void refreshBalanceSoon();
      if (pending.surface === "composer") {
        setPrompt(""); setVideoReferenceUrls([]); setVideoReferenceFiles([]); setAudioReferenceFiles([]); setComposerProducts([]); setComposerTitle("");
      } else {
        // 场景表单提交（文字转视频/产品链接）：清空表单并停留在当前模块页。
        setSelectedSceneId(""); setDraftReferenceUrls([]); setComposerProducts([]); setVideoReferenceUrls([]); setVideoReferenceFiles([]); setAudioReferenceFiles([]); setComposerTitle(""); setPrompt(""); setPresets((current) => ({ ...current, video: undefined })); setPresetSceneId(undefined);
        const url = new URL(window.location.href);
        if (url.searchParams.has("scene")) { url.searchParams.delete("scene"); window.history.replaceState(window.history.state, "", url); }
      }
      if (pending.surface === "composer") setInlineRun(null);
      if (pending.surface !== "composer") setInlineRun({ taskId: result.task.taskId, title: result.task.title, status: "Starting…", state: "running" });
      setMessage(`Draft saved. Generating “${result.task.title}” — you can keep working here; progress is in your Library.`);
      setMessageKind("info");
      setMessageAction(true);
      await autoRunVideoTask(result.task.taskId);
    } catch (error) {
      setMessage((error as Error).message);
      setMessageKind("error");
      setInlineRun((current) => current ? { ...current, state: "failed", status: (error as Error).message } : current);
    } finally { setBusy(false); }
  }

  /**
   * 确认弹窗中的「Save as draft」：只创建草稿任务（与生成同一条 POST /tasks），
   * 不触发分镜/生成/合成；表单随保存清空，横幅提供 Library 入口。
   */
  async function saveConfirmedDraft() {
    const pending = pendingGenerate;
    if (!pending || !customer) return;
    setPendingGenerate(null); setBusy(true); setMessage("");
    try {
      const result = await request<{ task: WorkspaceTask }>("/tasks", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ sceneId: pending.scene.id, input: pending.input, title: pending.title, ...(pending.productBrief ? { productBrief: pending.productBrief } : {}), ...(pending.source ? { preset: pending.source } : {}) }) });
      setTasks((current) => [result.task, ...current.filter((item) => item.taskId !== result.task.taskId)]);
      if (pending.surface === "composer") {
        setPrompt(""); setVideoReferenceUrls([]); setVideoReferenceFiles([]); setAudioReferenceFiles([]); setComposerProducts([]); setComposerTitle(""); setInlineRun(null);
      } else {
        setSelectedSceneId(""); setDraftReferenceUrls([]); setComposerProducts([]); setVideoReferenceUrls([]); setVideoReferenceFiles([]); setAudioReferenceFiles([]); setComposerTitle(""); setPrompt(""); setPresets((current) => ({ ...current, video: undefined })); setPresetSceneId(undefined);
        const url = new URL(window.location.href);
        if (url.searchParams.has("scene")) { url.searchParams.delete("scene"); window.history.replaceState(window.history.state, "", url); }
      }
      setMessage(`Saved “${result.task.title}” to your Library as a draft. Open it anytime to review and generate.`);
      setMessageKind("info");
      setMessageAction(true);
    } catch (error) {
      setMessage((error as Error).message);
      setMessageKind("error");
    } finally { setBusy(false); }
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  /** 生成阶段播报：顶部横幅 + 本页内嵌进度卡同步更新。 */
  function announceRun(text: string) {
    setMessage(text);
    setMessageKind("info");
    setInlineRun((current) => current ? { ...current, status: text } : current);
  }

  /** 确认生成/任务终态后立刻拉一次余额，不等下一个轮询周期。 */
  async function refreshBalanceSoon() {
    try {
      const result = await request<{ customerBalance: { balance: number; reserved: number } | null }>("/balance");
      if (result.customerBalance) setBalance(result.customerBalance.balance - result.customerBalance.reserved);
    } catch { /* The 4s balance poll will catch up. */ }
  }

  async function pollTaskUntil(taskId: string, ready: (task: WorkspaceTask) => boolean, timeoutMs = 600000): Promise<WorkspaceTask> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const { task } = await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}`);
      if (ready(task)) return task;
      if (task.error) throw new Error(humanError(task.error) || task.error);
      if (Date.now() > deadline) throw new Error("Generation is taking longer than expected. Follow progress in your Library.");
      await sleep(3000);
    }
  }

  // The server advances direct tasks on its own now (post-storyboard dispatch
  // and post-settlement stitching). A 409 task_busy/shot_busy/revision_conflict
  // usually means the server already started this step — recheck and keep
  // polling instead of failing the run.
  async function dispatchActionOrFollowServer(taskId: string, body: Record<string, unknown>, alreadyMoving: (task: WorkspaceTask) => boolean) {
    try {
      return await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}/actions`, { method: "POST", body: JSON.stringify(body) });
    } catch (error) {
      const current = (await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}`)).task;
      if (alreadyMoving(current)) return { task: current };
      throw error;
    }
  }

  async function autoRunVideoTask(taskId: string) {
    try {
      let current = (await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}`)).task;
      if (!current.storyboard?.shots.length) {
        await request(`/tasks/${encodeURIComponent(taskId)}/actions`, { method: "POST", body: JSON.stringify({ revision: current.revision, action: "storyboard" }) });
        announceRun(current.input.direct ? "Preparing your video…" : "Planning your storyboard…");
        current = await pollTaskUntil(taskId, (task) => Boolean(task.storyboard?.shots.length));
      }
      for (const shot of current.storyboard!.shots) {
        // The quote endpoint returns { quote }; treating the envelope as the
        // quote silently skipped dispatch for every direct task.
        const { quote } = await request<{ quote: ActionQuote }>(`/tasks/${encodeURIComponent(taskId)}/quote?action=generate_shot&shotId=${encodeURIComponent(shot.shotId)}`);
        if (!quote.available) throw new Error(humanError(quote.reason) || "Generation isn't available with these settings.");
        await dispatchActionOrFollowServer(taskId, { revision: (await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}`)).task.revision, action: "generate_shot", shotId: shot.shotId, quoteToken: quote.quoteToken }, (t) =>
          Boolean(t.operation && ["pending", "run"].includes(t.operation.state)) ||
          t.storyboard?.shots.some((s) => s.shotId === shot.shotId && s.genStatus === "run") || false);
        announceRun(current.input.direct ? "Generating your video…" : `Generating shot ${(current.storyboard!.shots.indexOf(shot) + 1)} / ${current.storyboard!.shots.length}…`);
        current = await pollTaskUntil(taskId, (task) => task.operation?.state === "done" || task.operation?.state === "fail", current.input.direct ? 2_700_000 : 420_000);
        void refreshBalanceSoon();
        if (current.operation?.state === "fail") throw new Error(current.operation.error ? humanError(current.operation.error) : "A shot failed to generate. Open the video in your Library to retry.");
      }
      const fresh = await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}`);
      await dispatchActionOrFollowServer(taskId, { revision: fresh.task.revision, action: "render" }, (t) =>
        t.status === "rendering" || Boolean(t.video && (t.video.status === "run" || t.video.finalUrl)));
      announceRun(fresh.task.input.direct ? "Finishing your video…" : "Stitching your final video…");
      const finalTask = await pollTaskUntil(taskId, (task) => Boolean(task.video?.finalUrl) || task.video?.status === "fail", 600000);
      void refreshBalanceSoon();
      announceRun(`Your video “${finalTask.title}” is ready — find it in your Library.`);
      setInlineRun((current) => current && current.taskId === taskId ? { ...current, state: "ready", status: `Your video “${finalTask.title}” is ready.`, videoUrl: finalTask.video?.finalUrl } : current);
    } catch (error) {
      // A tracking hiccup after a successful submit (transient request failure
      // while polling/dispatching) must not claim the generation failed: the
      // upstream job keeps running. Re-read the task and report its real state.
      let taskStillGenerating = false;
      try {
        const latest = await request<{ task: WorkspaceTask }>(`/tasks/${encodeURIComponent(taskId)}`);
        const t = latest.task;
        taskStillGenerating = t.operation?.state === "run" || t.operation?.state === "pending" ||
          Boolean(t.storyboard?.shots.some((shot) => shot.genStatus === "run")) ||
          t.status === "rendering" || Boolean(t.video && (t.video.status === "run" || !t.video.finalUrl && t.video.status !== "fail"));
      } catch { /* fall back to the original error when even the re-read fails */ }
      if (taskStillGenerating) {
        const soft = "We lost track of progress on this screen, but your video is still generating — follow it in your Library.";
        setMessage(soft);
        setMessageKind("info");
        setInlineRun((current) => current && current.taskId === taskId ? { ...current, state: "running", status: soft } : current);
      } else {
        setMessage((error as Error).message);
        setMessageKind("error");
        setInlineRun((current) => current && current.taskId === taskId ? { ...current, state: "failed", status: (error as Error).message } : current);
      }
    }
  }

  function fillQuickStart(item: NonNullable<WorkspaceCatalog["quickStarts"]>[number]) {
    const suggestion = item.label.trim();
    setQuickStartSceneId(item.sceneId);
    setComposerTab("AI Video Agent");
    setPrompt(`Use “${suggestion}” as the direction for a video featuring my product. Keep product details accurate and based on confirmed facts, then end with a clear call to action.`);
    if (item.aspect) setComposerAspect(item.aspect);
    if (item.duration) setComposerDuration(item.duration);
    window.requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('[aria-label="Describe your video idea"]')?.focus());
  }

  async function generateImage() {
    if (!customer) { window.location.assign(currentLoginHref()); return; }
    setBusy(true); setMessage("");
    try {
      const quoted = await request<{ quote: ActionQuote }>("/images/quote", { method: "POST", body: JSON.stringify(imageInput) });
      if (!quoted.quote.available) throw new Error(humanError(quoted.quote.reason));
      if (!imageQuote?.available || imageQuote.credits !== quoted.quote.credits) { setImageQuote(quoted.quote); setMessage(`The current price is ${quoted.quote.credits} credits. Review it and click Generate again.`); return; }
      const result = await request<{ job: ImageResult["jobs"][number]; customerBalance?: number }>("/images", { method: "POST", headers: { "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify({ ...imageInput, quoteToken: quoted.quote.quoteToken }) });
      setImageResults((current) => ({ ...current, jobs: [result.job, ...current.jobs.filter((job) => job.id !== result.job.id)] }));
      if (result.customerBalance != null) setBalance(result.customerBalance);
    } catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  function importProduct(asset: ImportedProductAsset, title?: string, brief?: ConfirmedProductBrief) {
    if (brief) setConfirmedProductBriefs((items) => [...items, brief].slice(-10));
    if (task && scene) {
      const field = scene.sections.flatMap((section) => section.fields).find((field) => field.type === "images" && field.refKind === "product");
      if (brief) pendingProductBrief.current = { taskId: task.taskId, payload: brief };
      editTask((current) => ({
        ...current,
        ...(title ? { title: title.slice(0, 120) } : {}),
        ...(brief ? { productBrief: taskProductBriefSnapshot(brief) } : {}),
        ...(field ? { input: { ...current.input, images: { ...current.input.images, [field.id]: [...(current.input.images[field.id] ?? []), asset.previewUrl].slice(0, field.max ?? 4) } } } : {}),
      }));
    } else if (view === "images" || (view === "home" && composerTab === "AI Image")) {
      setImageInput((current) => ({ ...current, assetUrls: [...current.assetUrls, asset.previewUrl].slice(0, 4) }));
    } else {
      // Confirming a preview REPLACES the previous product selection: the
      // composer works on one product at a time and the library keeps the
      // history, so a fresh confirm overwrites instead of accumulating.
      setComposerProducts([brief ? { ...asset, confirmedBrief: brief } : asset]);
      if (selectedSceneId || view === "product" || view === "videoLink") setDraftReferenceUrls([asset.previewUrl]);
      if (title) setComposerTitle(title.slice(0, 120));
    }
    setModal(null);
    if (customerId) void fetchProductImports();
  }

  /** 产品链接历史：点击一条记录，把它回填成当前创建表单的产品。 */
  function backfillProductImport(record: ProductImportRecord) {
    if (!record.previewUrl) { setMessage("This product's photo is no longer available. Import the link again."); return; }
    let brief: ConfirmedProductBrief | undefined;
    try { brief = confirmedBriefFromSnapshot(record.brief as ProductBriefSnapshotLike); } catch { brief = undefined; }
    const restored: ComposerProduct = { id: record.assetId, previewUrl: record.previewUrl, ...(record.title ? { label: record.title } : {}), ...(brief ? { confirmedBrief: brief } : {}) };
    // Backfilling from the library also replaces the current selection.
    setComposerProducts([restored]);
    setDraftReferenceUrls([record.previewUrl]);
    if (record.title) setComposerTitle(record.title.slice(0, 120));
    setMessage("");
    window.requestAnimationFrame(() => document.querySelector("section[aria-label='Create your video']")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  /** 产品链接历史：从库里移除一条记录（软删除）。 */
  async function deleteProductImport(importId: string) {
    if (!customerId) return;
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(siteId)}/customers/${encodeURIComponent(customerId)}/product-imports/${encodeURIComponent(importId)}`, {
        method: "DELETE",
        credentials: "same-origin",
        cache: "no-store",
        headers: { ...customerJsonHeaders(siteId), ...(csrfToken ? { "x-csrf-token": csrfToken } : {}) }
      });
      if (response.ok) setProductImports((items) => items.filter((item) => item.id !== importId));
      else setMessage("Could not remove this product. Try again.");
    } catch { setMessage("Could not remove this product. Try again."); }
  }

  function importedBriefNotice() {
    const brief = confirmedProductBriefs[confirmedProductBriefs.length - 1];
    const savedBrief = task?.productBrief;
    if (!brief && !savedBrief) return null;
    const title = brief?.title?.value ?? savedBrief?.title?.value;
    const description = brief?.description?.value ?? savedBrief?.description?.value;
    const priceAmount = brief?.possiblePrice?.value.amount ?? savedBrief?.possiblePrice?.amount;
    const priceCurrency = brief?.possiblePrice?.value.currency ?? savedBrief?.possiblePrice?.currency;
    const priceSourceLabel = brief?.possiblePrice?.sourceLabel ?? savedBrief?.possiblePrice?.sourceLabel;
    const sourceUrl = brief?.fetchedPageUrl ?? savedBrief?.fetchedPageUrl;
    return <div className={styles.notice} role="status">
      <strong>Product page details saved for review.</strong>
      {title && <p><span>Product name: </span>{title}</p>}
      {description && <p>{description}</p>}
      {priceAmount && <p><span>Possible price · unconfirmed: </span><span>{priceCurrency ? `${priceCurrency} ` : ""}</span><span>{priceAmount}</span>{priceSourceLabel && <><span> · from </span><span>{priceSourceLabel}</span></>}<span>.</span></p>}
      {sourceUrl && <p><span>Source: </span><a href={sourceUrl} target="_blank" rel="noreferrer">{sourceUrl}</a></p>}
    </div>;
  }

  async function uploadProduct(file: File | undefined) {
    if (!file) return;
    setBusy(true); setMessage("");
    try { importProduct(await uploadAsset(file)); }
    catch (error) { setMessage((error as Error).message); } finally { setBusy(false); }
  }

  function updateInput(update: (input: TaskInput) => TaskInput) {
    editTask((current) => ({ ...current, input: update(current.input) }));
  }
  function editShot(shotId: string, patch: Partial<StoryboardShot>) {
    editTask((current) => ({ ...current, storyboard: current.storyboard ? { ...current.storyboard, source: "user_edited", shots: current.storyboard.shots.map((shot) => shot.shotId === shotId ? { ...shot, ...patch } : shot) } : undefined }));
  }
  function reorderShot(shotId: string, direction: -1 | 1) {
    editTask((current) => {
      if (!current.storyboard) return current;
      const shots = [...current.storyboard.shots]; const from = shots.findIndex((item) => item.shotId === shotId); const to = from + direction;
      if (to < 0 || to >= shots.length) return current;
      [shots[from], shots[to]] = [shots[to], shots[from]];
      let start = 0;
      return { ...current, storyboard: { ...current.storyboard, source: "user_edited", shots: shots.map((shot) => { const updated = { ...shot, start, end: start + shot.duration }; start += shot.duration; return updated; }) } };
    });
  }

  async function logout() {
    try { await persist(); } catch { return; }
    setBusy(true);
    try {
      const response = await fetch(logoutPath ?? `/api/sites/${siteId}/auth/logout`, { method: "POST", credentials: "same-origin", headers: customerJsonHeaders(siteId) });
      if (!response.ok) throw new Error("Couldn't sign out. Please try again.");
      window.location.assign(loginHref);
    } catch (error) { setMessage((error as Error).message); setBusy(false); }
  }

  const moduleIcons = { ...workspaceModuleIcons, home: Home, tools: Layers3, library: Library, inspirations: Lightbulb, analytics: Clapperboard, teams: UserRound, developer: LockKeyhole, twin: WandSparkles, clone: FileVideo, chat: MessageSquare, subtitles: Captions };
  const navGroup = (group: "main" | "create" | "explore") => WORKSPACE_MODULES.filter((item) => item.group === group).map((item) => {
    const Icon = moduleIcons[item.id as keyof typeof moduleIcons];
    return <a key={item.id} href={workspaceViewHref(basePath, item.id)} className={`${styles.navitem} ${view === item.id ? styles.active : ""}`} aria-current={view === item.id ? "page" : undefined} aria-disabled={busy} onClick={(event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); if (!busy) void navigate(item.id);
    }}><Icon size={21} strokeWidth={1.8} /><span>{item.title}</span>{item.status && <small className={`${styles.planned} ${item.status === "simulation" ? styles.simulation : ""}`}>{item.status === "simulation" ? "Simulation" : "Planned"}</small>}</a>;
  });
  const sceneOptions = (catalog?.scenes ?? []).map((item) => ({ value: item.id, label: item.name }));
  const editorModelOptions = (catalog?.models ?? []).map((model) => ({ value: model.id, label: displayModel(model.model), disabled: !model.available || Boolean(scene?.needsActor && !model.nativeSpeech) }));
  const editorDurationOptions = (catalog?.durations ?? []).map((item) => ({ value: String(item.value), label: item.credits != null ? `${item.label} · ${item.credits} credits` : item.label }));
  const editorAspectOptions = (catalog?.aspects ?? []).map((item) => ({ value: item, label: item }));
  const editorStyleOptions = (scene?.styleOptions ?? []).map((item) => ({ value: item.value, label: item.label }));
  const editorLanguageOptions = (catalog?.languages ?? []).map((item) => ({ value: item.value, label: item.label }));
  const activeModel = catalog?.models.find((model) => model.available) ?? catalog?.models[0];
  const selectedModel = catalog?.models.find((model) => model.id === (task?.input.modelId || composerModel)) ?? activeModel;
  const composerModelResolutions = (catalog?.models.find((model) => model.id === composerModel) ?? activeModel)?.resolutions ?? [];
  const durationCapability = catalog?.durations.find((duration) => duration.value === task?.input.options.duration);
  const batchScene = catalog?.scenes.find((item) => item.id === batchSceneId) ?? catalog?.scenes[0];
  const actorSpeechSupported = !scene?.needsActor || Boolean(selectedModel?.nativeSpeech);
  const canGenerate = !task?.sourceAnalysis?.synthetic && Boolean(durationCapability?.generationAvailable && selectedModel?.available && actorSpeechSupported);
  const canBrowseTemplates = presenterStudioEnabled && Boolean(initialTemplateGallery?.options.length) && !task && ["home", "video", "images", "agent"].includes(view);
  const templateHandoffConsumed = useRef(false);
  useEffect(() => {
    if (!canBrowseTemplates || templateHandoffConsumed.current) return;
    const url = new URL(window.location.href);
    const staticParams = staticCreateSearchFromPath(window.location.pathname);
    if (staticParams) staticParams.forEach((value, key) => { if (!url.searchParams.has(key)) url.searchParams.set(key, value); });
    if (url.searchParams.get("templates") !== "1" && !initialHandoff?.templates) return;
    templateHandoffConsumed.current = true;
    const handoff = initialHandoff?.templates ? initialHandoff : workspaceHandoffFromSearchParams(url.searchParams);
    if (handoff.kind && initialTemplateGallery?.options.some((item) => item.kind === handoff.kind) && handoff.kind !== templateModuleKind) {
      // The gallery follows the module, so a handoff for the other module
      // opens that module instead of mixing both template kinds.
      if (handoff.kind === "photo") { setView("images"); setComposerTab("AI Image"); }
      else { setView("video"); setComposerTab("AI Video"); }
      setTemplateCategoryFilter("all");
    } else if (handoff.category && initialTemplateGallery?.categories.some((item) => item.id === handoff.category)) {
      setTemplateCategoryFilter(handoff.category);
    }
    setModal("templates");
    url.searchParams.delete("templates");
    window.history.replaceState(window.history.state, "", url);
  }, [canBrowseTemplates, initialTemplateGallery, initialHandoff, templateModuleKind]);
  // The gallery is scoped to the module: the image workspace only offers
  // photo templates and the video workspaces only offer video templates.
  const templateCategories = (initialTemplateGallery?.categories ?? []).filter((category) => category.id === templateModuleKind);
  const visibleTemplates = (initialTemplateGallery?.options ?? []).filter((item) => {
    if (item.kind !== templateModuleKind) return false;
    if (templateCategoryFilter !== "all" && !item.categoryIds.includes(templateCategoryFilter)) return false;
    const query = templateSearch.trim().toLocaleLowerCase();
    return !query || item.title.toLocaleLowerCase().includes(query) || item.prompt.toLocaleLowerCase().includes(query);
  });
  useEffect(() => {
    if (templateCategoryFilter !== "all" && !templateCategories.some((category) => category.id === templateCategoryFilter)) {
      setTemplateCategoryFilter("all");
    }
  }, [templateCategories, templateCategoryFilter]);

  // The library list and the reference reel above it share one filtered set,
  // so a reel frame always belongs to a card that is visible right below.
  // Buckets match what each card badge shows: failed cards surface their error
  // notice, in-progress cards are actively generating, completed cards have a
  // final video, and cancelled cards only appear under "All videos".
  const libraryCardBucket = (item: WorkspaceTask): "active" | "failed" | "completed" | "cancelled" => {
    const view = deriveTaskStatus(item);
    if (view.status === "completed") return "completed";
    if (view.status === "cancelled") return "cancelled";
    if (view.status === "failed") return "failed";
    return "active";
  };
  const libraryItems = tasks.filter((item) => {
    if (libraryFilter === "all") return true;
    const bucket = libraryCardBucket(item);
    return bucket === (libraryFilter === "draft" ? "active" : libraryFilter);
  });
  const libraryMedia = new Map(libraryItems.map((item) => [item.taskId, taskMedia(item, catalog?.scenes.find((entry) => entry.id === item.sceneId))]));
  const libraryReelItems: LibraryReelItem[] = libraryItems.flatMap((item) => {
    const media = libraryMedia.get(item.taskId) ?? [];
    const images = media.filter((entry) => entry.kind === "image");
    return images.map((entry, index) => ({
      id: `${item.taskId}:${index}:${entry.url}`,
      taskId: item.taskId,
      title: item.title,
      url: entry.url,
      label: entry.label,
      count: images.length
    }));
  });

  // Keep text beside icons/conditional children in host elements: browser
  // translation replaces bare Text nodes that React would otherwise remove.
  return <div className={`${styles.workspace} ${collapsed ? styles.collapsed : ""} ${mobileOpen ? styles.mobileOpen : ""} ${dark ? styles.dark : ""}`} translate="yes">
    <WorkspaceEntryBehavior />
    {mobileOpen && <button className={styles.closeOverlay} onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    <aside className={styles.sidebar} aria-label="Workspace navigation">
      <a className={styles.brand} href={basePath || "/"} aria-label="AIVideosUGC storefront"><img className={styles.brandLogo} src="/assets/sites/site_aidreamcapes/brand/aivideosugc-icon-64.png?v=20261011ugc" alt="" width={36} height={36} /><span>AIVideosUGC</span></a>
      <div className={styles.navScroll}>
        {navGroup("main")}
        <div className={styles.navdivider} /><div className={styles.navlabel}>CREATE</div>{navGroup("create")}
        <div className={styles.navdivider} /><div className={styles.navlabel}>EXPLORE</div>{navGroup("explore")}
      </div>
      <div className={styles.navfooter}>{customer && <a className={styles.navitem} href={accountHref}><UserRound size={22} strokeWidth={1.8} /><span>My account</span></a>}<button className={styles.navitem} onClick={() => setModal("support")}><Headphones size={22} strokeWidth={1.8} /><span>Support</span></button></div>
    </aside>
    <div className={styles.body}>
      <header className={styles.toolbar}>
        <div className={styles.toolbarLeft}><button className={`${styles.iconButton} ${styles.mobileMenu}`} onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu size={23} /></button><button className={`${styles.iconButton} ${styles.desktopMenu}`} onClick={() => { if (window.innerWidth <= 760) setMobileOpen(true); else setCollapsed(!collapsed); }} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}><PanelLeftClose size={23} /></button><button className={styles.pillButton} onClick={() => setModal("guide")}><Play size={15} fill="currentColor" /><span>Watch Tutorial</span></button>{canBrowseTemplates && <button type="button" className={`${styles.button} ${styles.primary} ${styles.templateToolbarButton}`} onClick={() => setModal("templates")} aria-label="Choose a template"><Clapperboard size={15} /><span>Choose template</span></button>}</div>
        <div className={styles.toolbarRight}>{balance != null && <span className={styles.balance}><span>{balance.toLocaleString()}</span><span> credits</span></span>}<button className={`${styles.button} ${styles.primary}`} onClick={() => setModal("support")} aria-label="Book a Call"><PhoneCall size={16} /><span className={styles.toolbarCallLabel}>Book a Call</span></button><button className={styles.iconButton} onClick={() => setDark(!dark)} aria-label={dark ? "Use light theme" : "Use dark theme"}>{dark ? <Moon size={21} /> : <Sun size={21} />}</button>{customer ? <CustomerAccountMenu accountHref={accountHref} creditsHref={`${accountHref}#account-credits`} customer={{ balance: { available: balance ?? customer.balance }, email: customer.email, name: customer.name }} onSignOut={logout} receiptsHref={`${accountHref}#account-purchases`} siteId={siteId} surface="workspace" tone={dark ? "dark" : "light"} /> : <a className={styles.button} href={loginHref} onClick={(event) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault();
          if (["home", "video", "images", "agent", "batch"].includes(view)) continueToLoginWithDraft();
          else window.location.assign(currentLoginHref());
        }}>Log In</a>}</div>
      </header>
      <main className={`${styles.main} ${view === "home" || view === "agent" || view === "video" || view === "images" ? styles.composerMain : ""} ${view === "actors" && presenterStudioEnabled ? styles.creatorMain : ""} ${view === "subtitles" ? styles.studioMain : ""}`}>
        {message && <div className={`${styles.notice} ${messageKind === "error" ? styles.error : ""}`} role="alert"><span>{message}</span>{messageAction && <button className={styles.linkButton} onClick={() => { setMessageAction(false); void navigate("library"); }}><span>View in Library </span><ArrowRight size={14} /></button>}{saveStatus.startsWith("Not saved") && <button className={styles.linkButton} onClick={() => void persist().catch(() => {})}>Retry saving</button>}<button className={styles.iconButton} onClick={() => { setMessage(""); setMessageAction(false); }} aria-label="Dismiss message"><X size={15} /></button></div>}
        {inlineRun && <section className={styles.panel} aria-live="polite">
          <h2>{inlineRun.state === "ready" ? "Your video is ready" : inlineRun.state === "failed" ? "Generation stopped" : "Generating your video"}</h2>
          <p className={styles.help} style={{ margin: "4px 0 0" }}>{inlineRun.title} · {inlineRun.status}</p>
          <div className={styles.footerActions}>
            {inlineRun.state === "ready" && inlineRun.videoUrl && <a className={`${styles.button} ${styles.primary}`} href={inlineRun.videoUrl} download><Download size={16} /><span>Download video</span></a>}
            <button className={styles.linkButton} onClick={() => { setInlineRun(null); void navigate("library"); }}><span>Open Library </span><ArrowRight size={15} /></button>
          </div>
        </section>}
        {batchNotice && <div className={styles.notice} role="status"><span>{batchNotice}</span><button className={styles.iconButton} onClick={() => setBatchNotice("")} aria-label="Dismiss batch result"><X size={15} /></button></div>}
        {subtitleJob && view !== "subtitles" && (
          <div className={styles.subtitleJobPill} role="status">
            <Loader2 size={14} className={styles.spin} aria-hidden />
            <span>{subtitleOpLabel(subtitleJob.opId)} for “{subtitleJob.taskTitle}” · {subtitleElapsed}s — you can keep working meanwhile.</span>
            <button type="button" onClick={() => void navigate("subtitles")}>Open Subtitle Studio <ArrowRight size={13} /></button>
          </div>
        )}
        {((view === "home" || view === "video" || view === "images" || view === "agent") && (task ? task.sourceTemplate : activePreset)) && renderTemplate((task ? task.sourceTemplate : activePreset)!)}
        {view === "home" && <>
          <div className={styles.greeting}><h1>{customer?.name ? `Hello, ${customer.name.split(" ")[0]}` : "Good Evening"}</h1><p><span>Let’s turn your ideas into video </span><Sparkles size={20} /></p></div>
          <HomeComposer
            tab={composerTab} onTabChange={setComposerTab} prompt={prompt} onPromptChange={handleComposerPrompt}
            catalog={catalog} modelId={composerModel} onModelChange={setComposerModel}
            aspect={composerAspect} onAspectChange={setComposerAspect} duration={composerDuration} onDurationChange={setComposerDuration}
            resolution={composerResolution} onResolutionChange={setComposerResolution} creditsNote={composerCreditsNote}
            videoReferenceUrls={videoReferenceUrls} onVideoReferenceUpload={(file) => void uploadVideoReference(file)}
            onVideoReferenceMove={(from, to) => setVideoReferenceUrls((current) => moveItem(current, from, to))}
            videoReferenceFiles={videoReferenceFiles} onVideoFileUpload={(file) => void uploadReferenceFile(file, "video")} onVideoFileRemove={(index) => setVideoReferenceFiles((current) => current.filter((_, i) => i !== index))} onVideoFileMove={(from, to) => setVideoReferenceFiles((current) => moveItem(current, from, to))}
            audioReferenceFiles={audioReferenceFiles} onAudioFileUpload={(file) => void uploadReferenceFile(file, "audio")} onAudioFileRemove={(index) => setAudioReferenceFiles((current) => current.filter((_, i) => i !== index))} onAudioFileMove={(from, to) => setAudioReferenceFiles((current) => moveItem(current, from, to))}
            onVideoReferenceRemove={(index) => setVideoReferenceUrls((current) => current.filter((_, position) => position !== index))}
            imageInput={imageInput} onImageInputChange={setImageInput} onImageReferenceUpload={(file) => void uploadImageReference(file)}
            onImageReferenceRemove={(index) => setImageInput((current) => ({ ...current, assetUrls: current.assetUrls.filter((_, position) => position !== index) }))} onImageReferenceMove={(from, to) => setImageInput((current) => ({ ...current, assetUrls: moveItem(current.assetUrls, from, to) }))}
            onContinue={continueHomeComposer} onLogin={() => continueToLoginWithDraft()} disabled={working} canUpload={Boolean(customer)} loginHref={loginHref}
            videoTypeId={composerVideoType} onVideoTypeChange={setComposerVideoType}
            onOptimizePrompt={() => void optimizeCurrentPrompt()} promptOptimizing={promptOptimizing}
          />
          {importedBriefNotice()}
          <div className={styles.quickPrompts}>{(catalog?.quickStarts ?? catalog?.scenes.map((item) => ({ label: item.name, sceneId: item.id, aspect: undefined, duration: undefined })) ?? []).map((item, index) => <button type="button" key={`${item.sceneId}-${index}`} className={styles.quick} disabled={working} onClick={() => fillQuickStart(item)}><Sparkles size={12} /><span>{item.label}</span></button>)}</div>
          {canBrowseTemplates && templatePickerCallout()}
          <section className={styles.section}><div className={styles.sectionHead}><h2>Tools</h2><button className={styles.linkButton} onClick={() => void navigate("tools")}><span>See All</span><ArrowRight size={15} /></button></div><WorkspaceTools disabled={working} onNavigate={(next) => void navigate(next)} /></section>
          <section className={styles.section} id="aivideosugc-models"><div className={styles.sectionHead}><h2>AI Models</h2><button className={styles.linkButton} onClick={() => void navigate("agent")}><span>Create a video </span><ArrowRight size={15} /></button></div>{catalog?.models.length ? <div className={styles.models}>{catalog.models.map((model, index) => <div key={model.id} className={styles.model}><div className={styles.modelTop}>{Boolean(initialTemplateGallery?.options.length) && <img loading="lazy" decoding="async" src={initialTemplateGallery!.options[index % initialTemplateGallery!.options.length].previewUrl} alt="Product reference example" />}<span className={styles.modelExample}>REFERENCE EXAMPLE</span><div className={styles.modelOverlay}><h3>{displayModel(model.model)}</h3><span className={styles.badge}>{model.available ? "Available" : "Not available"}</span></div></div><p>{model.available ? `${model.durations.join(" / ")}s · ${model.aspects.join(" / ")}${model.nativeSpeech ? " · Native audio" : ""}` : humanError(model.reason) || "This model is not connected yet."}</p></div>)}</div> : <div className={styles.empty}><Clapperboard size={28} /><h3>{loading ? "Loading models…" : "No video model is connected"}</h3><p>You can save a draft once you log in. Generation needs an available model.</p></div>}</section>
          {customer && tasks.length > 0 && <section className={styles.section}><div className={styles.sectionHead}><h2>Recent videos</h2><button className={styles.linkButton} onClick={() => void navigate("library")}><span>View Library </span><ArrowRight size={15} /></button></div>{renderTaskCards(tasks.slice(0, 3))}</section>}
        </>}

        {view === "tools" && <><div className={styles.pageTitle}><h1>All Tools</h1><p>Choose a workspace tool. Each tool is also available from the left menu.</p></div><WorkspaceTools all disabled={working} onNavigate={(next) => void navigate(next)} /></>}
        {view === "inspirations" && <EmbeddedInspirations initialPage={initialInspirations} endpoint={`${api}/inspirations`} basePath={basePath} />}
        {view === "videoLink" && <UrlToVideoPage siteId={siteId} customerId={customer?.id} csrfToken={csrfToken} loginHref={loginHref} initialUrl={entryProductUrl} onImported={importProduct} products={composerProducts} disabled={working} onCreate={() => { const selected = catalog?.scenes.find((item) => item.id === "process_demo"); if (selected) selectScene(selected); }} />}
        {view === "product" && <ProductVideoPage siteId={siteId} customerId={customer?.id} csrfToken={csrfToken} loginHref={loginHref} initialUrl={entryProductUrl} onImported={importProduct} disabled={working} imports={productImports} importsLoading={productImportsLoading} onBackfill={backfillProductImport} onDeleteImport={(importId) => void deleteProductImport(importId)} createSlot={productCreateScene ? sceneCreateForm(productCreateScene, "product") : null} />}
        {view === "batch" && <BatchDraftPage />}
        {view === "video" && <><div className={styles.pageTitle}><h1>AI Video</h1><p>Describe your video and add reference photos, then review the saved draft before generation.</p></div>
          <HomeComposer
            tab="AI Video" showTabs={false} onTabChange={setComposerTab} prompt={prompt} onPromptChange={handleComposerPrompt}
            catalog={catalog} modelId={composerModel} onModelChange={setComposerModel}
            aspect={composerAspect} onAspectChange={setComposerAspect} duration={composerDuration} onDurationChange={setComposerDuration}
            resolution={composerResolution} onResolutionChange={setComposerResolution} creditsNote={composerCreditsNote}
            videoReferenceUrls={videoReferenceUrls} onVideoReferenceUpload={(file) => void uploadVideoReference(file)}
            onVideoReferenceMove={(from, to) => setVideoReferenceUrls((current) => moveItem(current, from, to))}
            videoReferenceFiles={videoReferenceFiles} onVideoFileUpload={(file) => void uploadReferenceFile(file, "video")} onVideoFileRemove={(index) => setVideoReferenceFiles((current) => current.filter((_, i) => i !== index))} onVideoFileMove={(from, to) => setVideoReferenceFiles((current) => moveItem(current, from, to))}
            audioReferenceFiles={audioReferenceFiles} onAudioFileUpload={(file) => void uploadReferenceFile(file, "audio")} onAudioFileRemove={(index) => setAudioReferenceFiles((current) => current.filter((_, i) => i !== index))} onAudioFileMove={(from, to) => setAudioReferenceFiles((current) => moveItem(current, from, to))}
            onVideoReferenceRemove={(index) => setVideoReferenceUrls((current) => current.filter((_, position) => position !== index))}
            imageInput={imageInput} onImageInputChange={setImageInput} onImageReferenceUpload={(file) => void uploadImageReference(file)}
            onImageReferenceRemove={(index) => setImageInput((current) => ({ ...current, assetUrls: current.assetUrls.filter((_, position) => position !== index) }))} onImageReferenceMove={(from, to) => setImageInput((current) => ({ ...current, assetUrls: moveItem(current.assetUrls, from, to) }))}
            onContinue={continueHomeComposer} onLogin={() => continueToLoginWithDraft()} disabled={working} canUpload={Boolean(customer)} loginHref={loginHref}
            videoTypeId={composerVideoType} onVideoTypeChange={setComposerVideoType}
            onOptimizePrompt={() => void optimizeCurrentPrompt()} promptOptimizing={promptOptimizing}
          />
          {canBrowseTemplates && templatePickerCallout()}
        </>}

        {view === "agent" && !task && !selectedScene && <>
          <div className={styles.pageTitle}><h1>Text to Video</h1><p>Turn a written idea and product details into a finished video. Add your prompt and photos, and we'll generate the video and save it to your Library.</p></div>
          {loading && <div className={styles.empty}><Loader2 size={24} className={styles.spin} /><span>Loading your workspace…</span></div>}
          <HomeComposer
            tab="AI Video Agent" showTabs={false} onTabChange={setComposerTab} prompt={prompt} onPromptChange={handleComposerPrompt}
            catalog={catalog} modelId={composerModel} onModelChange={setComposerModel}
            aspect={composerAspect} onAspectChange={setComposerAspect} duration={composerDuration} onDurationChange={setComposerDuration}
            resolution={composerResolution} onResolutionChange={setComposerResolution} creditsNote={composerCreditsNote}
            videoReferenceUrls={videoReferenceUrls} onVideoReferenceUpload={(file) => void uploadVideoReference(file)}
            onVideoReferenceMove={(from, to) => setVideoReferenceUrls((current) => moveItem(current, from, to))}
            videoReferenceFiles={videoReferenceFiles} onVideoFileUpload={(file) => void uploadReferenceFile(file, "video")} onVideoFileRemove={(index) => setVideoReferenceFiles((current) => current.filter((_, i) => i !== index))} onVideoFileMove={(from, to) => setVideoReferenceFiles((current) => moveItem(current, from, to))}
            audioReferenceFiles={audioReferenceFiles} onAudioFileUpload={(file) => void uploadReferenceFile(file, "audio")} onAudioFileRemove={(index) => setAudioReferenceFiles((current) => current.filter((_, i) => i !== index))} onAudioFileMove={(from, to) => setAudioReferenceFiles((current) => moveItem(current, from, to))}
            onVideoReferenceRemove={(index) => setVideoReferenceUrls((current) => current.filter((_, position) => position !== index))}
            imageInput={imageInput} onImageInputChange={setImageInput} onImageReferenceUpload={(file) => void uploadImageReference(file)}
            onImageReferenceRemove={(index) => setImageInput((current) => ({ ...current, assetUrls: current.assetUrls.filter((_, position) => position !== index) }))} onImageReferenceMove={(from, to) => setImageInput((current) => ({ ...current, assetUrls: moveItem(current.assetUrls, from, to) }))}
            onContinue={continueHomeComposer} onLogin={() => continueToLoginWithDraft()} disabled={working} canUpload={Boolean(customer)} loginHref={loginHref}
            videoTypeId={composerVideoType} onVideoTypeChange={setComposerVideoType}
            onOptimizePrompt={() => void optimizeCurrentPrompt()} promptOptimizing={promptOptimizing}
          />
          {importedBriefNotice()}
          {canBrowseTemplates && templatePickerCallout()}
        </>}

        {view === "agent" && !task && selectedScene && sceneCreateForm(selectedScene, "agent")}

        {view === "agent" && task && <>
          <div className={styles.editorHeader}><button className={styles.iconButton} aria-label="Back to library" onClick={() => void navigate("library")}><ArrowLeft size={21} /></button><input className={styles.titleInput} aria-label="Video title" value={task.title} maxLength={120} disabled={editingDisabled} onChange={(event) => editTask((current) => ({ ...current, title: event.target.value }))} /><span className={styles.saveStatus} role="status">{saveStatus}</span><span className={styles.badge}>{taskStatusLabel(task)}</span></div>
          {!directTask && <div className={styles.steps}>{steps.map((item, index) => <button key={item.id} className={`${styles.step} ${step === item.id ? styles.selected : ""}`} disabled={item.id !== "input" && !task.storyboard} onClick={() => { setStep(item.id); updateUrl(task, item.id); }}><span className={styles.stepNumber}>{index + 1}</span><span>{item.label}</span></button>)}</div>}
          {clipsProcessing && !operationActive && <div className={styles.notice} role="status">{directTask ? "Your video is processing. You can return from Library when it is ready. Editing is paused to protect your selected inputs." : "Your clips are processing. You can return from Library when they are ready. Editing is paused to protect your selected inputs."}</div>}
          {operationActive && <div className={styles.notice} role="status"><Loader2 size={16} className={styles.spin} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} /><span>{task.operation?.action === "render" ? "Rendering your video…" : task.operation?.action === "compose_shot" ? "Preparing your presenter reference…" : task.operation?.action === "generate_shot" ? (directTask ? "Submitting your video…" : "Submitting your clip generation…") : task.operation?.action === "restore_version" ? "Restoring your selected version…" : (directTask ? "Preparing your video…" : "Preparing your storyboard…")}</span><span> Your progress is saved. You can return from Library.</span></div>}
          {(task.error || task.operation?.error) && !directTask && <div className={`${styles.notice} ${styles.error}`} role="alert"><span>{humanError(task.operation?.error || task.error)}</span>{task.operation?.error === "operation_interrupted" && task.operation.state !== "fail" && <button className={styles.linkButton} disabled={busy} onClick={() => void runAction("resume")}>Resume saved action</button>}</div>}
          {task.sourceAnalysis && <section className={styles.notice} aria-label="Ad reference structure"><strong>Ad reference structure</strong><p>{task.sourceAnalysis.synthetic ? "This draft uses a simulated analysis. You can edit and save it; generation is unavailable." : "This draft uses your reviewed ad structure and your own product details."}</p><details><summary>View reference structure</summary><ul>{task.sourceAnalysis.segments.map((segment, index) => <li key={index}><span>{`${segment.start}–${segment.end}s · ${segment.role}: `}</span><span>{segment.visual}</span></li>)}</ul></details></section>}
          {step === "input" && directTask && <section className={styles.panel}>
            <div className={styles.sectionHead}><div><h2>{directFinalUrl ? "Your video is ready" : directFailure || directStalled ? "Let's try that again" : "Creating your video"}</h2><p className={styles.help}>{directFinalUrl ? "Download your video or create another one from a new prompt." : directFailure ? "The last attempt didn't finish. You can try again with the same prompt and photos." : directStalled ? "This video isn't generating right now. Try again to continue where it stopped." : "Your prompt and photos are with the video provider. You can leave this page and return from your Library."}</p></div>{!directFinalUrl && !directFailure && !directStalled && <span className={styles.badge}>{task.operation?.action === "render" ? "Finishing" : "Generating"}</span>}</div>
            {directFinalUrl ? <><video className={styles.video} src={directFinalUrl} controls playsInline preload="metadata" aria-label="Finished video" /><div className={styles.row}><a className={`${styles.button} ${styles.primary}`} href={directFinalUrl} download><Download size={16} /><span>Download video</span></a><button className={styles.button} onClick={() => setStep("delivery")}><Play size={16} /><span>View video</span></button></div><div className={styles.notice}><span>Generated videos are kept for 15 days, then automatically deleted. Download the ones you want to keep.</span></div></> : directFailure || directStalled ? <div className={`${styles.notice} ${styles.error}`} role="alert"><span>{humanError(directFailure || "Video generation stopped before completion.")}</span></div> : <div className={styles.notice} role="status"><Loader2 size={16} className={styles.spin} style={{ display: "inline", verticalAlign: "middle", marginRight: 8 }} /><span>{task.operation?.action === "render" ? "Finishing your video…" : "Generating your video…"}</span></div>}
            <div className={styles.footerActions}>
              {(directFailure || directStalled) && <button className={`${styles.button} ${styles.primary}`} disabled={busy} onClick={() => void retryDirectTask()}>{busy ? <Loader2 size={16} className={styles.spin} /> : <RotateCcw size={16} />}<span>Try again</span></button>}
              {directFinalUrl && <button className={styles.button} onClick={() => void startNewVideo()}><Plus size={16} /><span>Create another video</span></button>}
              <button className={styles.button} onClick={() => void navigate("library")}><Library size={16} /><span>Back to Library</span></button>
            </div>
          </section>}
          {step === "input" && !directTask && <>
            {scene?.sections.map((section) => {
              const productField = section.fields.find((field) => field.type === "images" && field.required);
              const promptField = section.fields.find((field) => field.required && (field.type === "text" || field.type === "textarea"));
              if (!productField && !promptField) return null;
              return <section key={section.id} className={styles.formSection}><h2>Product and video idea</h2><div className={styles.fields}>{productField && renderField(productField)}{promptField && <label className={styles.field}><span className={styles.fieldLabel}>Describe your video in one sentence</span><textarea className={styles.input} aria-label="Describe your video in one sentence" disabled={editingDisabled} value={String(task.input.fields[promptField.id] ?? "")} maxLength={promptField.max ?? WORKSPACE_PROMPT_MAX_LENGTH} onChange={(event) => updateInput((input) => ({ ...input, fields: { ...input.fields, [promptField.id]: event.target.value } }))} placeholder="What should viewers notice about your product?" /><span className={styles.help}>One clear sentence is enough. You can add more details below.</span></label>}</div></section>;
            })}
            {importedBriefNotice()}
            <details className={styles.advanced}><summary>More details and settings</summary>
            {task.sourceTemplate && <label className={`${styles.formSection} ${styles.field}`}><span className={styles.fieldLabel}>Additional visual direction</span><textarea className={styles.input} aria-label="Additional visual direction" maxLength={WORKSPACE_PROMPT_MAX_LENGTH} disabled={editingDisabled} value={task.input.creativeDirection ?? task.sourceTemplate.prompt} onChange={(event) => editTask((current) => ({ ...current, input: { ...current.input, creativeDirection: event.target.value } }))} /><span className={styles.help}>Optional: add notes about the look or action.</span></label>}
            {scene?.sections.map((section) => {
              const optionalFields = section.fields.filter((field) => !field.required);
              return optionalFields.length ? <section key={section.id} className={styles.formSection}><h2>{section.label} (optional)</h2><div className={styles.fields}>{optionalFields.map((field) => renderField(field))}</div></section> : null;
            })}
          {scene?.needsActor && <section className={styles.formSection}><div className={styles.sectionHead}><div><h2>Your presenter</h2><p className={styles.help}>One avatar and its voice throughout your video.</p></div><button className={styles.button} disabled={editingDisabled} onClick={() => setModal("actors")}><UserRound size={16} /><span>{actor ? "Change avatar" : "Choose avatar"}</span></button></div>{actor ? <div className={styles.row}><img loading="lazy" decoding="async" src={actor.imageUrl} alt={actor.name} width={64} height={70} style={{ objectFit: "contain", borderRadius: 8 }} /><div><strong>{actor.name}</strong><p className={styles.help}><span>{actor.voice.label || "Voice profile"}</span><span> · </span><span>{languageLabel(actor.voice.language)}</span></p>{actor.voice.refAudio && <audio src={actor.voice.refAudio} controls preload="none" aria-label={`${actor.name} voice sample`} style={{ height: 30, maxWidth: 220 }} />}</div></div> : <p className={styles.help}>Choose a presenter to continue. The presenter card includes its voice profile.</p>}</section>}
            <section className={styles.formSection}><h2>Video settings</h2><p>Choose the format, language and style for this video.</p>{catalog?.billing && <div className={styles.notice}><span>{catalog.billing.creditsPerShot}</span><span> credits per generated clip. Your total depends on how many clips and new versions you generate.</span></div>}<div className={styles.parameterGrid}><div className={styles.field}><span className={styles.fieldLabel}>Video model</span><WorkspaceSelect ariaLabel="Video model" disabled={editingDisabled} value={task.input.modelId || activeModel?.id || ""} options={editorModelOptions} onChange={(value) => updateInput((input) => ({ ...input, modelId: value }))} placeholder="No model connected" /></div><div className={styles.field}><span className={styles.fieldLabel}>Duration</span><WorkspaceSelect ariaLabel="Duration" disabled={editingDisabled} value={String(task.input.options.duration)} options={editorDurationOptions} onChange={(value) => updateInput((input) => ({ ...input, options: { ...input.options, duration: Number(value) as TaskInput["options"]["duration"] } }))} /></div><div className={styles.field}><span className={styles.fieldLabel}>Aspect ratio</span><WorkspaceSelect ariaLabel="Aspect ratio" disabled={editingDisabled} value={task.input.options.aspect} options={editorAspectOptions} onChange={(value) => updateInput((input) => ({ ...input, options: { ...input.options, aspect: value as TaskInput["options"]["aspect"] } }))} /></div><div className={styles.field}><span className={styles.fieldLabel}>Style</span><WorkspaceSelect ariaLabel="Style" disabled={editingDisabled} value={task.input.options.style} options={editorStyleOptions} onChange={(value) => updateInput((input) => ({ ...input, options: { ...input.options, style: value } }))} /></div><div className={styles.field}><span className={styles.fieldLabel}>Language</span><WorkspaceSelect ariaLabel="Language" disabled={editingDisabled} value={task.input.options.language} options={editorLanguageOptions} onChange={(value) => updateInput((input) => ({ ...input, options: { ...input.options, language: value as TaskInput["options"]["language"] } }))} /></div><label className={styles.field}><span className={styles.fieldLabel}>Captions</span><select className={styles.input} disabled={editingDisabled || !scene?.needsActor} value={String(task.input.options.subtitle)} onChange={(event) => updateInput((input) => ({ ...input, options: { ...input.options, subtitle: event.target.value === "true" } }))}><option value="false">Without captions</option><option value="true" disabled={catalog?.subtitles?.available === false}>With captions</option></select>{!scene?.needsActor ? <span className={styles.help}>This scene has no spoken dialogue.</span> : catalog?.subtitles?.available === false ? <span className={styles.help}>Captions are not available for this connection yet.</span> : null}</label>{task.input.options.subtitle && scene?.needsActor && <label className={styles.field}><span className={styles.fieldLabel}>Caption style</span><select className={styles.input} disabled={editingDisabled} value={task.input.options.subtitleStyle ?? "classic"} onChange={(event) => updateInput((input) => ({ ...input, options: { ...input.options, subtitleStyle: event.target.value as TaskInput["options"]["subtitleStyle"] } }))}><option value="classic">Classic</option><option value="bold">Bold</option><option value="minimal">Minimal</option></select></label>}</div>{catalog?.durations.find((item) => item.value === task.input.options.duration)?.reason && <div className={styles.notice}>{catalog.durations.find((item) => item.value === task.input.options.duration)?.reason ? humanError(catalog.durations.find((item) => item.value === task.input.options.duration)?.reason) : ""}</div>}{scene?.needsActor && !actorSpeechSupported && <div className={styles.notice}>{humanError("native_audio_required")}</div>}</section>
            <MusicTrackPicker siteId={siteId} selectedUrl={task.input.musicUrl} onSelect={(musicUrl) => updateInput((input) => ({ ...input, musicUrl }))} csrfToken={csrfToken} disabled={editingDisabled} />
            {customer && <MusicCatalogPicker siteId={siteId} task={task} csrfToken={csrfToken} disabled={editingDisabled || dirty.current} onTaskUpdated={(next) => { if (currentRef.current?.taskId === next.taskId) acceptTask(next); }} />}
            </details>
            {task.storyboardStale && <div className={styles.notice}>Your details have changed. Review the existing storyboard or generate a new draft. Locked shots will be kept.</div>}
            <div className={styles.footerActions}>{task.storyboard && <button className={styles.button} disabled={editingDisabled} onClick={() => { setStep("storyboard"); updateUrl(task, "storyboard"); }}>View storyboard</button>}<button className={`${styles.button} ${styles.primary}`} disabled={editingDisabled || Boolean(task.sourceAnalysis?.synthetic)} onClick={() => void runAction(task.storyboard ? "reroll" : "storyboard")}>{busy ? <Loader2 size={16} className={styles.spin} /> : <Sparkles size={16} />}<span>{task.storyboard ? "Refresh storyboard" : "Generate storyboard"}</span></button></div>
          </>}

          {step === "storyboard" && !directTask && <>
            <div className={styles.sectionHead}><div><h2>Your storyboard</h2><p className={styles.help}>Edit and generate each shot, then choose the versions you want to keep.</p></div><button className={styles.button} disabled={editingDisabled} onClick={() => void runAction("reroll")}><RotateCcw size={15} /><span>New draft</span></button></div>
            {task.storyboardStale && <div className={styles.notice}>Your details changed after this storyboard was created. Refresh the draft to apply them; locked shots stay in place.</div>}
            {task.storyboard?.lang !== task.input.options.language && <div className={styles.notice}><span>Your video language is now </span><span>{languageLabel(task.input.options.language)}</span><span>. Your dialogue has been kept as written.</span><button className={styles.linkButton} disabled={editingDisabled} onClick={() => void runAction("rewrite", { language: task.input.options.language })}>Rewrite dialogue</button></div>}
            {actor && <div className={styles.notice}><UserRound size={16} style={{ display: "inline", verticalAlign: "middle", marginRight: 6 }} /><span>{actor.name}</span><span> · The same presenter and voice for all shots </span><button className={styles.linkButton} onClick={() => setModal("actors")}>Change avatar for entire video</button></div>}
            {task.storyboard?.shots.map((shot, index) => renderShot(shot, index))}
            {catalog?.billing && <div className={styles.notice}><span>Each shot generation uses </span><span>{catalog.billing.creditsPerShot}</span><span> credits. A new version is a separate generation.</span></div>}
            <div className={styles.notice}><span>Generated videos are kept for 15 days, then automatically deleted. Download the ones you want to keep.</span></div><div className={styles.footerActions}><button className={styles.button} onClick={() => setStep("input")}><ArrowLeft size={15} /><span>Edit details</span></button><button className={`${styles.button} ${styles.primary}`} disabled={working} onClick={() => { setStep("render"); updateUrl(task, "render"); }}><span>Review & render </span><ArrowRight size={15} /></button></div>
          </>}

          {step === "render" && !directTask && <section className={styles.panel}><h2>Render your video</h2><p className={styles.help}>Your selected shot versions will be assembled into one video.</p><div className={styles.sourceList}>{task.storyboard?.shots.map((shot, index) => { const version = shot.versions.find((item) => item.vid === shot.curVer); return <div key={shot.shotId} className={styles.sourceRow}><span><span>Shot </span><span>{index + 1}</span><span> · </span><span>{shot.duration}</span><span>s</span></span><span className={styles.badge}>{version?.status === "done" && version.clipUrl ? `Version ${shot.versions.findIndex((item) => item.vid === shot.curVer) + 1} ready` : "Generate this shot first"}</span></div>; })}</div><div className={styles.renderSteps}>{(task.video?.steps ?? [{ id: "confirm", status: "pending" }, { id: "concat", status: "pending" }, { id: "subtitles", status: "pending" }, { id: "audio", status: "pending" }]).map((item) => <div key={item.id} className={styles.renderStep}>{item.status === "done" ? <CheckCircle2 size={22} /> : item.status === "run" ? <Loader2 size={22} className={styles.spin} /> : <Clapperboard size={22} />}<div><h3>{renderLabels[item.id]}</h3><p>{(item.reason ? humanError(item.reason) : "") || (item.status === "run" ? "Working… You can leave and return from Library." : item.status === "done" ? "Complete" : item.status === "skipped" ? "Not required for this video" : item.status === "fail" ? "This step needs attention" : "Ready when your clips are confirmed")}</p></div></div>)}</div>{task.video?.error && <div className={`${styles.notice} ${styles.error}`}>{humanError(task.video.error)}</div>}<div className={styles.footerActions}><button className={styles.button} onClick={() => setStep("storyboard")}>Back to shots</button>{task.video?.finalUrl && <button className={styles.button} onClick={() => setStep("delivery")}>View video</button>}<button className={`${styles.button} ${styles.primary}`} disabled={working || Boolean(clipsProcessing) || task.status === "rendering"} onClick={() => void runAction("render")}>{task.status === "rendering" ? <Loader2 size={16} className={styles.spin} /> : <Clapperboard size={16} />}<span>{task.video?.status === "fail" ? "Retry render" : task.video?.finalUrl ? "Render updated video" : "Render video"}</span></button></div></section>}

          {step === "delivery" && directTask && <section className={styles.panel}>
            <div className={styles.sectionHead}><div><h2>Your video</h2><p className={styles.help}>{directFinalUrl ? "Your video is ready to download." : "Your video is still being prepared."}</p></div></div>
            {directFinalUrl ? <><video className={styles.video} src={directFinalUrl} controls playsInline preload="metadata" aria-label="Finished video" /><div className={styles.row}><a className={`${styles.button} ${styles.primary}`} href={directFinalUrl} download><Download size={16} /><span>Download video</span></a><button className={styles.button} onClick={() => void startNewVideo()}><Plus size={16} /><span>Create another video</span></button><button className={styles.button} onClick={() => setStep("input")}><ArrowLeft size={16} /><span>Back to progress</span></button></div></> : <div className={styles.empty}><Video size={32} /><h3>Your video isn't ready yet</h3><p>{directFailure ? humanError(directFailure) : "Generation is still in progress."}</p><button className={styles.button} onClick={() => setStep("input")}><ArrowLeft size={16} /><span>Back to progress</span></button></div>}
          </section>}
          {step === "delivery" && !directTask && <section className={styles.panel}><h2>Your finished video</h2>{task.video?.finalUrl ? <><video className={styles.video} src={task.video.finalUrl} controls playsInline preload="metadata" aria-label="Finished video" />{task.video.stale && <div className={styles.notice}>Your storyboard changed after this video was rendered. Render again to include your edits.</div>}<div className={styles.row}><a className={`${styles.button} ${styles.primary}`} href={task.video.finalUrl} download><Download size={16} /><span>Download video</span></a><button className={styles.button} onClick={() => setStep("storyboard")}>Edit storyboard</button></div><h3 style={{ marginTop: 25 }}>Shot sources</h3><div className={styles.sourceList}>{task.video.clips.map((clip, index) => { const source = [task.storyboard, ...task.storyboardHistory].flatMap((board) => board?.shots ?? []).find((item) => item.shotId === clip.shotId && item.versions.some((version) => version.vid === clip.vid)); return <div key={clip.shotId} className={styles.sourceRow}><span><span>Shot </span><span>{index + 1}</span></span><span><span>Version </span><span>{(source?.versions.findIndex((item) => item.vid === clip.vid) ?? -1) + 1}</span></span><a className={styles.linkButton} href={clip.clipUrl} download><Download size={14} /><span>Clip</span></a></div>; })}</div><details><summary className={styles.help} style={{ cursor: "pointer" }}>Export script and captions</summary><div className={styles.row} style={{ marginTop: 15, flexWrap: "wrap" }}><button className={styles.button} onClick={() => downloadText(`${task.title}-script.txt`, task.video?.clips.map((clip, index) => { const source = [task.storyboard, ...task.storyboardHistory].flatMap((board) => board?.shots ?? []).find((shot) => shot.shotId === clip.shotId && shot.versions.some((version) => version.vid === clip.vid)); const version = source?.versions.find((version) => version.vid === clip.vid); return `Shot ${index + 1}\n${version?.visual ?? ""}\n${version?.voiceover ?? ""}`; }).join("\n\n") ?? "")}><Download size={15} /><span>Script</span></button><button className={styles.button} onClick={() => downloadText(`${task.title}-prompts.json`, JSON.stringify(task.video?.clips.map((clip) => { const source = [task.storyboard, ...task.storyboardHistory].flatMap((board) => board?.shots ?? []).find((shot) => shot.shotId === clip.shotId && shot.versions.some((version) => version.vid === clip.vid)); const version = source?.versions.find((version) => version.vid === clip.vid); return { shot: clip.shotId, prompt: version?.prompt, references: version?.refImgs }; }), null, 2), "application/json")}><Download size={15} /><span>Prompts</span></button>{task.video.subtitleUrl && <a className={styles.button} href={task.video.subtitleUrl} download><Download size={15} /><span>Captions</span></a>}</div></details></> : <div className={styles.empty}><Video size={32} /><h3>Your video isn't ready yet</h3><p>Generate your shots and render your video to see it here.</p><button className={styles.button} onClick={() => setStep("render")}>Go to render</button></div>}</section>}
        </>}

        {view === "agent" && step === "delivery" && !directTask && customer && task?.video?.status === "done" && <VideoPostEditor siteId={siteId} task={task} csrfToken={csrfToken} disabled={editingDisabled || dirty.current} onTaskUpdated={(next) => { if (currentRef.current?.taskId === next.taskId) acceptTask(next); }} />}

        {view === "analytics" && (customer ? <AnalyticsWorkbench siteId={siteId} csrfToken={csrfToken} disabled={working} /> : <section className={styles.panel}><h1>Performance</h1><p>Log in to import and compare your advertising results.</p><a className={styles.button} href={`${basePath}/login?next=${encodeURIComponent(workspaceViewHref(basePath, "analytics"))}`}>Log in</a></section>)}
        {view === "chat" && (customer ? <AgentChatWorkbench siteId={siteId} csrfToken={csrfToken} /> : <section className={styles.panel}><h1>AI Assistant</h1><p>Log in to chat with your AI assistant.</p><a className={styles.button} href={`${basePath}/login?next=${encodeURIComponent(workspaceViewHref(basePath, "chat"))}`}>Log in</a></section>)}
        {view === "subtitles" && subtitleNotice && <div className={styles.notice} role="status"><span>{subtitleNotice}</span><button className={styles.iconButton} onClick={() => setSubtitleNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}
        {view === "subtitles" && (customer ? <SubtitleWorkbench siteId={siteId} csrfToken={csrfToken} activeJob={subtitleJob} onJobStarted={onSubtitleJobStarted} /> : <section className={styles.panel}><h1>Subtitle Studio</h1><p>Log in to add subtitles to your finished videos.</p><a className={styles.button} href={`${basePath}/login?next=${encodeURIComponent(workspaceViewHref(basePath, "subtitles"))}`}>Log in</a></section>)}

        {view === "teams" && <TeamBrandWorkbench siteId={siteId} customerId={customer?.id ?? ""} csrfToken={csrfToken} disabled={working} />}

        {view === "developer" && (customer ? <DeveloperWorkbench siteId={siteId} customerId={customer.id} csrfToken={csrfToken} disabled={working} /> : <section className={styles.panel}><h1>Developer access</h1><p>Log in to manage API keys and webhook endpoints for your workspace.</p><a className={styles.button} href={`${basePath}/login?next=${encodeURIComponent(workspaceViewHref(basePath, "developer"))}`}>Log in</a></section>)}

        {view === "library" && <>
          <div className={styles.sectionHead}>
            <div className={styles.pageTitle}><h1>Your Library</h1><p>Pick up where you left off or download a finished video.</p></div>
            <button className={`${styles.button} ${styles.primary}`} onClick={() => void navigate("agent")}><Plus size={16} /><span>New video</span></button>
          </div>
          {customer && libraryItems.length > 0 && <div className={styles.notice}><span>Generated videos are kept for 15 days, then automatically deleted. Download the ones you want to keep.</span></div>}
          {customer && !loading && libraryReelItems.length > 0 && <LibraryReferenceReel items={libraryReelItems} onOpen={setDetailTaskId} />}
          <div className={styles.choices} style={{ marginBottom: 20 }}>{["all", "active", "failed", "completed"].map((filter) => <button key={filter} className={`${styles.choice} ${libraryFilter === filter ? styles.selected : ""}`} onClick={() => setLibraryFilter(filter)}>{filter === "all" ? "All videos" : filter === "active" ? "In progress" : filter === "failed" ? "Failed" : "Completed"}</button>)}</div>
          {!customer
            ? <div className={styles.empty}><Library size={30} /><h3>Your videos belong here</h3><p>Log in to see your private video library.</p><a href={loginHref} className={`${styles.button} ${styles.primary}`}>Log In</a></div>
            : loading
              ? <div className={styles.empty}><Loader2 className={styles.spin} size={25} /><span>Loading your videos…</span></div>
              : libraryItems.length
                ? renderTaskCards(libraryItems)
                : <div className={styles.empty}><FileVideo size={32} /><h3>No videos here yet</h3><p>Open Text to Video, add a product photo and a short description, then save a draft.</p><button className={styles.button} onClick={() => void navigate("agent")}>Create a video</button></div>}
          {view === "library" && tasksHasMore && <div ref={librarySentinelRef} aria-hidden="true" className={styles.loadMoreSentinel} />}
          {tasksLoadingMore && <div className={styles.empty} role="status"><Loader2 className={styles.spin} size={22} /><span>Loading more videos…</span></div>}
        </>}

        {view === "actors" && presenterStudioEnabled && <>
          <div className={styles.creatorHeading}>
            <div><span className={styles.creatorEyebrow}>PRESENTER STUDIO</span><h1>Create a video with an AI presenter</h1><p>Choose a presenter, add your product photo and share the message you want them to cover.</p></div>
            {customer && <span className={styles.creatorDraftHint}>Your work saves as a draft first</span>}
          </div>
          <div className={styles.creatorStudio}>
            <section className={styles.creatorLeft} aria-label="Presenter and product">
              <div className={styles.creatorProduct}>
                <div className={styles.creatorProductHeading}><div><span className={styles.creatorLabel}>PRODUCT REFERENCES</span><p>Add a clear photo of the product in your video.</p></div><span>{avatarProductImages.length} / {avatarUserImageMax}</span></div>
                <FileDropZone className={styles.creatorProductGrid} activeClassName={styles.dropActive} disabled={!customer || working} onFiles={importAvatarProductFiles}>
                  {avatarProductImages.length < avatarUserImageMax && <label className={`${styles.creatorUpload} ${!customer || working ? styles.creatorUploadDisabled : ""}`}><Upload size={21} /><strong>{busy ? "Uploading…" : "Add product photo"}</strong><span>{`PNG or JPG · drag & drop or paste anywhere · up to ${avatarUserImageMax} photo${avatarUserImageMax === 1 ? "" : "s"}`}</span><input type="file" accept="image/*" disabled={working || !customer} aria-label="Upload product photo" onChange={(event) => { void uploadAvatarProduct(event.target.files?.[0]); event.target.value = ""; }} /></label>}
                  {avatarProductImages.map((url, index) => <div className={styles.creatorProductImage} key={`${url}-${index}`} {...reorderHandlers(index, working, moveAvatarProductImage)}><img src={url} alt={`Product reference ${index + 1}`} /><button className={styles.removeImage} disabled={working} aria-label={`Remove product reference ${index + 1}`} onClick={() => setAvatarProductImages((current) => current.filter((_, position) => position !== index))}><X size={12} /></button></div>)}
                </FileDropZone>
                {!customer && <a className={styles.creatorLogin} href={loginHref}>Log in to upload a product photo</a>}
              </div>
              <div className={styles.creatorPortrait}>
                {avatarSelection ? <img src={avatarSelection.imageUrl} alt={avatarSelection.name} /> : <div className={styles.creatorPortraitEmpty}><UserRound size={42} /><strong>Choose a presenter</strong><span>Preview your selected presenter here</span></div>}
                {avatarSelection && <span className={styles.creatorPortraitTag}><span className={styles.creatorStatusDot} />Presenter selected</span>}
              </div>
              <div className={styles.creatorSelection}>
                <div><span className={styles.creatorLabel}>PRESENTER</span><h2>{avatarSelection?.name ?? "No presenter selected"}</h2>{avatarSelection && <p><span>{avatarSelection.genderLabel ?? (avatarSelection.gender === "female" ? "Women" : "Men")}</span><span> · </span><span>{avatarSelection.ageRange}</span></p>}</div>
                <button className={styles.button} disabled={working} onClick={() => { setActorSearch(""); setActorGenderFilter("all"); setModal("actors"); }}><UserRound size={16} /><span>{avatarSelection ? "Change" : "Choose presenter"}</span></button>
              </div>
              {avatarSelection?.voice.refAudio && <div className={styles.creatorVoice}><span><span className={styles.creatorLabel}>VOICE PROFILE</span><strong>{avatarSelection.voice.label || "Presenter voice"}</strong></span><audio controls preload="none" src={avatarSelection.voice.refAudio} aria-label={`${avatarSelection.name} voice sample`} /></div>}
            </section>

            <section className={styles.creatorEditor} aria-label="Video script and settings">
              <div className={styles.creatorEditorHeader}><div><span className={styles.creatorLabel}>SCRIPT & TALKING POINTS</span><span className={styles.creatorHelp}><span>Edit the exact dialogue in your storyboard before generation.</span></span></div><span className={styles.creatorTab}><span className={styles.creatorTabDot} />Script</span></div>
              <label className={styles.creatorScriptField}>
                <span className={styles.srOnly}>Script and key talking points</span>
                <textarea value={avatarScript} maxLength={5000} disabled={working} onPaste={(event) => {
                  const files = takePasteFiles(event);
                  if (!files.length || !customer || working) return;
                  event.preventDefault();
                  importAvatarProductFiles(files);
                }} onChange={(event) => setAvatarScript(event.target.value)} placeholder="Write a product script or list verified points for the presenter to cover…" />
              </label>
              <div className={styles.creatorScriptFooter}><span>Keep claims accurate and based on your product details.</span><span>{avatarScript.length} / 5000</span></div>
              {avatarModelUnavailable && <div className={`${styles.notice} ${styles.creatorModelNotice}`}>Presenter video needs a model that supports image references and audio input together. No connected model supports that yet.</div>}
              {!avatarModels.length && !avatarModelUnavailable && <div className={`${styles.notice} ${styles.creatorModelNotice}`}>No presenter-ready video model is available right now. You can save your setup as a draft and return later.</div>}
              <div className={styles.creatorSettings}>
                <label className={styles.creatorSetting}><span>Video model</span><select className={styles.input} value={avatarModel?.id ?? ""} disabled={working || !avatarModels.length} onChange={(event) => setAvatarModelId(event.target.value)}>{!avatarModels.length && <option value="">Unavailable</option>}{avatarModels.map((model) => <option key={model.id} value={model.id}>{displayModel(model.model)}</option>)}</select></label>
                <label className={styles.creatorSetting}><span>Format</span><select className={styles.input} value={selectedAvatarAspect} disabled={working || !avatarAspects.length} onChange={(event) => setAvatarAspect(event.target.value as TaskInput["options"]["aspect"])}>{avatarAspects.map((aspect) => <option key={aspect}>{aspect}</option>)}</select></label>
                <label className={styles.creatorSetting}><span>Duration</span><select className={styles.input} value={selectedAvatarDuration} disabled={working || !avatarDurations.length} onChange={(event) => setAvatarDuration(Number(event.target.value) as TaskInput["options"]["duration"])}>{avatarDurations.map((duration) => <option key={duration} value={duration}>{duration} seconds</option>)}</select></label>
                <label className={styles.creatorSetting}><span>Resolution</span><select className={styles.input} value={selectedAvatarResolution} disabled={working || !avatarResolutions.length} onChange={(event) => setAvatarResolution(event.target.value)}>{!avatarResolutions.length ? <option value="">Unavailable</option> : avatarResolutions.map((resolution) => <option key={resolution} value={resolution}>{resolution}</option>)}</select></label>
                {avatarSelection && <label className={styles.creatorSetting}><span>Language</span><select className={styles.input} value={selectedAvatarLanguage} disabled={working || !avatarLanguageOptions.length} onChange={(event) => setAvatarLanguage(event.target.value as TaskInput["options"]["language"])}>{avatarLanguageOptions.map((language) => <option key={language.value} value={language.value}>{language.label}</option>)}</select></label>}
              </div>
              <div className={styles.creatorActions}>
                <span>{avatarModel ? `${avatarModel.durations.join(" / ")}s · ${avatarModel.aspects.join(" / ")} · ${(avatarModel.resolutions[0] ?? "").toUpperCase() || "720p"}` : "Save a draft now; generation depends on model availability"}</span>
                {customer ? <button className={`${styles.button} ${styles.primary}`} disabled={working || !avatarSelection || !avatarProductImages.length || !avatarScript.trim() || avatarModelUnavailable || Boolean(avatarModel && (!avatarAspects.length || !avatarDurations.length))} onClick={() => void openAvatarSubmitConfirm()}><span>{busy ? "Checking cost…" : "Generate video"}</span>{busy ? <Loader2 size={16} className={styles.spin} /> : <ArrowRight size={16} />}</button> : <a className={`${styles.button} ${styles.primary}`} href={loginHref}><span>Log in to continue</span><ArrowRight size={16} /></a>}
              </div>
              <p className={styles.creatorSaveNote}>Confirming submits the video for generation right away — you will see the estimated cost first, and progress appears below and in your Library.</p>
            </section>
          </div>
        </>}
        {view === "actors" && !presenterStudioEnabled && <><div className={styles.pageTitle}><h1>AI Avatars</h1><p>Each avatar has its own attached voice profile.</p></div>{renderActors(false)}<div className={styles.footerActions}><button className={`${styles.button} ${styles.primary}`} onClick={() => void navigate("agent")}><span>Create an avatar video </span><ArrowRight size={15} /></button></div></>}
        {view === "images" && <>
          <div className={styles.pageTitle}>
            <h1>AI Image</h1>
            <p>Create product visuals from your own reference photos.</p>
          </div>
          <HomeComposer
            tab="AI Image" showTabs={false} onTabChange={setComposerTab} prompt={prompt} onPromptChange={handleComposerPrompt}
            catalog={catalog} modelId={composerModel} onModelChange={setComposerModel}
            aspect={composerAspect} onAspectChange={setComposerAspect} duration={composerDuration} onDurationChange={setComposerDuration}
            resolution={composerResolution} onResolutionChange={setComposerResolution} creditsNote={composerCreditsNote}
            videoReferenceUrls={videoReferenceUrls} onVideoReferenceUpload={(file) => void uploadVideoReference(file)}
            onVideoReferenceMove={(from, to) => setVideoReferenceUrls((current) => moveItem(current, from, to))}
            videoReferenceFiles={videoReferenceFiles} onVideoFileUpload={(file) => void uploadReferenceFile(file, "video")} onVideoFileRemove={(index) => setVideoReferenceFiles((current) => current.filter((_, i) => i !== index))} onVideoFileMove={(from, to) => setVideoReferenceFiles((current) => moveItem(current, from, to))}
            audioReferenceFiles={audioReferenceFiles} onAudioFileUpload={(file) => void uploadReferenceFile(file, "audio")} onAudioFileRemove={(index) => setAudioReferenceFiles((current) => current.filter((_, i) => i !== index))} onAudioFileMove={(from, to) => setAudioReferenceFiles((current) => moveItem(current, from, to))}
            onVideoReferenceRemove={(index) => setVideoReferenceUrls((current) => current.filter((_, position) => position !== index))}
            imageInput={imageInput} onImageInputChange={setImageInput} onImageReferenceUpload={(file) => void uploadImageReference(file)}
            onImageReferenceRemove={(index) => setImageInput((current) => ({ ...current, assetUrls: current.assetUrls.filter((_, position) => position !== index) }))} onImageReferenceMove={(from, to) => setImageInput((current) => ({ ...current, assetUrls: moveItem(current.assetUrls, from, to) }))}
            onImageGenerate={() => void generateImage()} imageGenerateDisabled={!customer || !imageQuote?.available}
            onContinue={continueHomeComposer} onLogin={() => continueToLoginWithDraft()} disabled={busy} canUpload={Boolean(customer)} loginHref={loginHref}
          />
          {canBrowseTemplates && templatePickerCallout()}
          {customer && <p className={styles.help} style={{ margin: "12px 0 0" }}>
            {!imageInput.assetUrls.length ? "Add a product reference photo to see the price." : imageInput.toolId === "custom" && !imageInput.prompt.trim() ? "Describe your image to see the current price." : imageQuote?.available ? `This generation costs ${imageQuote.credits} credits.` : imageQuote ? humanError(imageQuote.reason) : "Checking the current price…"}
          </p>}
          {customer && <section className={styles.section}>
            <h2>Your images</h2>
            <div className={styles.taskGrid} style={{ marginTop: 16 }}>
              {imageResults.assets.map((asset) => <article key={asset.id} className={styles.taskCard}>
                <div className={styles.taskCover}><img loading="lazy" decoding="async" src={asset.previewUrl} alt={asset.label || "Generated image"} /></div>
                <div className={styles.taskContent}>
                  <h3>{asset.label || "Generated image"}</h3>
                  <a href={asset.downloadUrl || asset.previewUrl} download className={styles.linkButton}><Download size={15} /><span>Download</span></a>
                </div>
              </article>)}
              {imageResults.jobs.filter((job) => !imageResults.assets.some((asset) => asset.jobId === job.id)).map((job) => <article key={job.id} className={styles.taskCard}>
                <div className={styles.taskCover}>{["queued", "running", "pending", "processing"].includes(job.status) ? <Loader2 size={28} className={styles.spin} /> : <ImageIcon size={30} />}</div>
                <div className={styles.taskContent}>
                  <h3>{["failed", "error", "cancelled"].includes(job.status) ? "Image generation did not complete" : ["completed", "succeeded"].includes(job.status) ? "Image ready — loading your result" : "Generating your image…"}</h3>
                  <p><span>{job.creditsReserved}</span><span> credits reserved</span></p>
                </div>
              </article>)}
            </div>
            {!imageResults.jobs.length && !imageResults.assets.length && <div className={styles.empty} style={{ marginTop: 16 }}>
              <ImageIcon size={32} /><h3>Your images will appear here</h3><p>Add a product reference and description above. Saved images will appear here.</p>
            </div>}
          </section>}
        </>}
        {view === "twin" && <TwinWorkbench siteId={siteId} customerId={customer?.id} csrfToken={csrfToken} loginHref={loginForCloneView("twin")} onUseActor={(actorId) => {
          void (async () => {
            try {
              const result = await request<{ catalog: WorkspaceCatalog }>("/catalog");
              if (!actorId.startsWith("custom-") || !result.catalog.actors.some((item) => item.actorId === actorId)) throw new Error("This personal presenter is no longer available.");
              setCatalog(result.catalog); setAvatarSelectionId(actorId); await navigate("actors");
            } catch (error) { setMessage(error instanceof Error ? error.message : "Couldn't open your presenter."); }
          })();
        }} />}
        {view === "clone" && <AdCloneWorkbench siteId={siteId} customerId={customer?.id} csrfToken={csrfToken} loginHref={loginForCloneView("clone")} onOpenTask={(taskId) => { void openTask({ taskId }); }} />}
        {view === "rewards" && <><div className={styles.pageTitle}><h1>Refer & Earn</h1></div><div className={styles.empty}><Gift size={33} /><h3>A referral program is not active yet</h3><p>Find your video projects in Library.</p><button className={styles.button} onClick={() => void navigate("library")}>Open Library</button></div></>}
      </main>
    </div>
    {(modal === "guide" || modal === "support") && <WorkspaceHelpDialog kind={modal} onClose={closeModal} supportHref={supportPath ?? `${basePath}/contact-us`} accountHref={customer ? accountHref : undefined} />}
    {modal === "templates" && renderTemplatePickerDialog()}
    {detailTask && (() => {
      // Actor tasks list the presenter portrait first as the model reference,
      // then the product photos; other image kinds keep generic captions.
      const detailActor = detailTask.input.actorId ? catalog?.actors.find((entry) => entry.actorId === detailTask.input.actorId) : undefined;
      const productRefs = detailTask.input.images.productImages ?? [];
      const referenceImageList = [
        ...(detailActor?.imageUrl && !productRefs.includes(detailActor.imageUrl) ? [{ url: detailActor.imageUrl, label: "Model reference" }] : []),
        ...productRefs.map((url, index) => ({ url, label: detailActor ? `Product reference ${index + 1}` : `Reference ${index + 1}` })),
        ...Object.entries(detailTask.input.images).filter(([field]) => field !== "productImages").flatMap(([, urls]) => (urls as string[]).map((url) => ({ url, label: "Reference" })))
      ];
      const description = String(detailTask.input.fields.description ?? detailTask.input.creativeDirection ?? Object.values(detailTask.input.fields).find((value) => typeof value === "string" && value.trim()) ?? "").trim();
      const model = catalog?.models.find((entry) => entry.id === detailTask.input.modelId)?.label;
      const detailView = deriveTaskStatus(detailTask);
      const running = taskStatusInFlight(detailView);
      const failureCode = detailView.status === "failed" ? detailView.failureCode : undefined;
      const failed = Boolean(failureCode);
      const completed = detailView.status === "completed";
      const statusWord = taskStatusLabel(detailTask);
      const statusClass = failed ? styles.detailStatusIconFail : running ? styles.detailStatusIconRun : completed ? styles.detailStatusIconDone : styles.detailStatusIconDraft;
      const finalUrl = detailTask.video?.finalUrl;
      const referenceVideos = detailTask.input.referenceVideos ?? [];
      const referenceAudios = detailTask.input.referenceAudios ?? [];
      const shotClips = (detailTask.storyboard?.shots ?? []).flatMap((shot, index) => {
        const version = shot.versions?.find((item) => item.vid === shot.curVer) ?? shot.versions?.at(-1);
        return version?.clipUrl && version.status === "done" ? [{ key: shot.shotId, label: `Shot ${index + 1}`, url: version.clipUrl }] : [];
      });
      return <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) setDetailTaskId(null); }}><section className={`${styles.modal} ${styles.detailModal}`} role="dialog" aria-modal="true" aria-label="Generation details">
        <div className={styles.detailHead}>
          <span className={`${styles.detailStatusIcon} ${statusClass}`} aria-hidden="true">{failed ? <X size={19} /> : running ? <Loader2 className={styles.spin} size={19} /> : completed ? <Check size={19} /> : <FileVideo size={18} />}</span>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, display: "flex", alignItems: "center", gap: 10 }}>{detailTask.title}<span style={{ fontSize: 13, fontWeight: 500, color: failed ? "#dc2626" : running ? "#7c3aed" : completed ? "#16a34a" : "#6b7280" }}>{statusWord}{running ? "…" : ""}</span></h2>
            <p className={styles.detailSubtitle}>{failed ? humanError(failureCode) : "View the full details of this generation."}</p>
          </div>
          <button className={styles.iconButton} onClick={() => setDetailTaskId(null)} aria-label="Close dialog"><X size={23} /></button>
        </div>
        <div className={styles.detailGrid}>
          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}><span className={styles.detailBar} />Result</p>
              {finalUrl ? <video controls preload="metadata" src={finalUrl} className={styles.detailVideo} /> : <div className={`${styles.detailPlaceholder} ${failed ? styles.detailPlaceholderFail : ""}`}>{running ? <><Loader2 className={styles.spin} size={22} /><span>Generation in progress…</span></> : failed ? <><X size={22} /><span>Generation failed</span><span className={styles.detailFailReason}>{humanError(failureCode)}</span></> : <><FileVideo size={22} /><span>No video yet</span></>}</div>}
              {finalUrl && <a className={styles.button} style={{ marginTop: 10 }} href={finalUrl} download><Download size={15} /><span>Download</span></a>}
            </div>
            {!detailTask.input.direct && shotClips.length > 0 && <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}><span className={styles.detailBar} />Generated clips</p>
              <div className={styles.detailMediaGrid}>{shotClips.map((clip) => <figure key={clip.key} className={styles.detailMediaItem}><video controls preload="metadata" playsInline src={clip.url} /><figcaption><span>{clip.label}</span><a href={clip.url} download><Download size={13} /><span>Download</span></a></figcaption></figure>)}</div>
            </div>}
            {description && <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}><span className={styles.detailBar} />Your description</p>
              <p className={styles.detailPrompt}>{description}</p>
            </div>}
            {referenceImageList.length > 0 && <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}><span className={styles.detailBar} />Reference images</p>
              <div className={styles.detailImages}>{referenceImageList.map((entry, index) => <figure key={`${entry.url}-${index}`} className={styles.detailRefItem}><img loading="lazy" decoding="async" src={entry.url} alt={entry.label} /><figcaption>{entry.label}</figcaption></figure>)}</div>
            </div>}
            {referenceVideos.length > 0 && <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}><span className={styles.detailBar} />Reference videos</p>
              <div className={styles.detailMediaGrid}>{referenceVideos.map((url, index) => <figure key={`${url}-${index}`} className={styles.detailMediaItem}>
                <video controls preload="metadata" src={url} aria-label={`Reference video ${index + 1}`} />
                <figcaption title={mediaFileName(url, `Video ${index + 1}`)}>{mediaFileName(url, `Video ${index + 1}`)}</figcaption>
              </figure>)}</div>
            </div>}
            {referenceAudios.length > 0 && <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}><span className={styles.detailBar} />Reference audio</p>
              <div className={styles.detailAudioList}>{referenceAudios.map((url, index) => <div key={`${url}-${index}`} className={styles.detailAudioItem}>
                <span className={styles.detailAudioName} title={mediaFileName(url, `Audio ${index + 1}`)}><Headphones size={13} aria-hidden="true" /><span>{mediaFileName(url, `Audio ${index + 1}`)}</span></span>
                <audio controls preload="none" src={url} aria-label={`Reference audio ${index + 1}`} />
              </div>)}</div>
            </div>}
          </div>
          <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}><span className={styles.detailBar} />Basic info</p>
              <dl className={styles.detailKv}>
                <dt>Type</dt><dd>Video</dd>
                <dt>Created</dt><dd>{new Date(detailTask.createdAt).toLocaleString()}</dd>
                <dt>Model</dt><dd>{model ?? "—"}</dd>
                <dt>Status</dt><dd>{statusWord}</dd>
              </dl>
            </div>
            <div className={styles.detailSection}>
              <p className={styles.detailSectionLabel}><span className={styles.detailBar} />Submitted parameters</p>
              <div className={styles.detailChips}>
                <span className={styles.detailChip}>Duration<strong>{detailTask.input.options.duration}s</strong></span>
                <span className={styles.detailChip}>Aspect<strong>{detailTask.input.options.aspect}</strong></span>
                {detailTask.input.options.resolution && <span className={styles.detailChip}>Resolution<strong>{detailTask.input.options.resolution}</strong></span>}
                <span className={styles.detailChip}>Reference images<strong>{referenceImageList.length}</strong></span>
                {referenceVideos.length > 0 && <span className={styles.detailChip}>Reference videos<strong>{referenceVideos.length}</strong></span>}
                {referenceAudios.length > 0 && <span className={styles.detailChip}>Reference audio<strong>{referenceAudios.length}</strong></span>}
              </div>
            </div>
          </div>
        </div>
        <div className={styles.detailFooter}>
          {detailView.status === "failed" && detailView.failureStage === "render" && shotClips.length > 0 && <button type="button" className={styles.button} disabled={busy} onClick={() => void retryTaskRender(detailTask.taskId)}><Clapperboard size={15} /><span>Retry render</span></button>}
          <button type="button" className={`${styles.button} ${styles.primary}`} disabled={running} title={running ? "This video is being generated. Wait for it to finish before regenerating." : undefined} onClick={() => prefillFromTask(detailTask)}><RotateCcw size={15} /><span>{running ? "Generating…" : "Regenerate"}</span></button>
        </div>
      </section></div>;
    })()}
    {pendingGenerate && (() => { const model = catalog?.models.find((item) => item.id === pendingGenerate.input.modelId); const options = [model?.label, `${pendingGenerate.input.options.duration}s`, pendingGenerate.input.options.aspect, pendingGenerate.input.options.resolution].filter(Boolean).join(" · "); const pendingQuote = pendingGenerate.quote ?? composerQuote; const credits = pendingQuote?.available && pendingQuote.credits != null ? pendingQuote.credits : undefined; const direct = Boolean(pendingGenerate.input.direct); const totalCredits = credits; return <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) setPendingGenerate(null); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Confirm generation" style={{ maxWidth: 470 }}>
      <div className={styles.modalHeader}><h2>Confirm generation</h2><button className={styles.iconButton} onClick={() => setPendingGenerate(null)} aria-label="Close dialog"><X size={23} /></button></div>
      <p className={styles.help} style={{ marginTop: 0 }}>{pendingGenerate.scene.name}</p>
      <p className={styles.help}>{options || "\u00a0"}</p>
      <p className={styles.help} style={{ fontWeight: 600, color: "var(--ink)" }}>{totalCredits != null ? `Estimated cost: ${totalCredits} credits` : "Credits will be confirmed at checkout."}{balance != null ? ` · Balance: ${balance} credits` : ""}</p>
      {totalCredits != null && <p className={styles.help}>{direct ? `This ${pendingGenerate.input.options.duration}s video is generated as one clip. ` : ""}Credits are held when you confirm and returned automatically if generation fails.</p>}
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
        <button type="button" className={styles.button} onClick={() => setPendingGenerate(null)}>Cancel</button>
        <button type="button" className={styles.button} disabled={busy} onClick={() => void saveConfirmedDraft()}>Save as draft</button>
        <button type="button" className={styles.button} style={{ background: "#7c3aed", borderColor: "#7c3aed", color: "#fff" }} disabled={busy || (totalCredits != null && balance != null && balance < totalCredits)} onClick={() => void runConfirmedGeneration()}>Generate now</button>
      </div>
    </section></div>; })()}
    {pendingAvatarSubmit && (() => {
      const quote = pendingAvatarSubmit.quote;
      const credits = quote.available && quote.credits != null ? quote.credits : undefined;
      const options = [avatarModel?.label, `${selectedAvatarDuration}s`, selectedAvatarAspect, selectedAvatarResolution].filter(Boolean).join(" · ");
      return <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) setPendingAvatarSubmit(null); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Confirm video submission" style={{ maxWidth: 470 }}>
        <div className={styles.modalHeader}><h2>Confirm video submission</h2><button className={styles.iconButton} onClick={() => setPendingAvatarSubmit(null)} aria-label="Close dialog"><X size={23} /></button></div>
        <p className={styles.help} style={{ marginTop: 0 }}>{avatarSelection ? `${avatarSelection.name} · Presenter video` : "Presenter video"}</p>
        <p className={styles.help}>{options || "\u00a0"}</p>
        {!quote.available ? <p className={styles.help} style={{ fontWeight: 600, color: "#b91c1c" }}>{humanError(quote.reason) || "Generation isn't available with these settings."}</p>
          : <p className={styles.help} style={{ fontWeight: 600, color: "var(--ink)" }}>{credits != null ? `Estimated cost: ${credits} credits` : "Credits will be confirmed at checkout."}{balance != null ? ` · Balance: ${balance} credits` : ""}</p>}
        {quote.available && credits != null && <p className={styles.help}>Priced the same as image-to-video for now. Credits are held when a shot generates and returned automatically if generation fails.</p>}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className={styles.button} onClick={() => setPendingAvatarSubmit(null)}>Cancel</button>
          <button type="button" className={styles.button} disabled={busy} onClick={() => { setPendingAvatarSubmit(null); void saveAvatarDraft(); }}>Save as draft</button>
          <button type="button" className={styles.button} style={{ background: "#7c3aed", borderColor: "#7c3aed", color: "#fff" }} disabled={busy || !quote.available || (credits != null && balance != null && balance < credits)} onClick={() => { setPendingAvatarSubmit(null); void createAvatarGeneration(); }}>Generate now</button>
        </div>
      </section></div>;
    })()}
    {modal === "product" && <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section ref={privateModalRef} className={styles.modal} role="dialog" aria-modal="true" aria-label="Add your product"><div className={styles.modalHeader}><h2>Add your product</h2><button className={styles.iconButton} onClick={closeModal} aria-label="Close dialog"><X size={23} /></button></div>{customer && <div className={styles.field} style={{ marginBottom: 18 }}><span className={styles.fieldLabel}>Product photo</span><FileDropZone activeClassName={styles.dropActive} disabled={busy} onFiles={(files) => { const image = files.find((file) => fileKind(file) === "image"); if (image) void uploadProduct(image); }}><label className={styles.upload} style={{ width: 106 }}><Upload size={21} /><span>{busy ? "Uploading…" : "Add a product photo"}</span><input type="file" accept="image/*" disabled={busy} aria-label="Upload product photo" onChange={(event) => { void uploadProduct(event.target.files?.[0]); event.target.value = ""; }} /></label></FileDropZone></div>}<p className={styles.help} style={{ margin: "0 0 10px" }}>Or import product details from a product page</p><ProductUrlImport siteId={siteId} customerId={customer?.id} csrfToken={csrfToken} loginHref={loginHref} onImported={importProduct} />{message && <div className={`${styles.notice} ${styles.error}`} role="alert">{message}</div>}</section></div>}
    {modal === "actors" && <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section ref={privateModalRef} className={`${styles.modal} ${presenterStudioEnabled ? styles.actorPickerModal : ""}`} role="dialog" aria-modal="true" aria-label="Choose a presenter"><div className={styles.modalHeader}><div><h2>{presenterStudioEnabled ? "Choose a presenter" : "Choose your avatar"}</h2>{presenterStudioEnabled && <p className={styles.help}>Preview voice profiles and choose who appears in your video.</p>}</div><button className={styles.iconButton} onClick={closeModal} aria-label="Close dialog"><X size={23} /></button></div>{message && <div className={`${styles.notice} ${styles.error}`} role="alert">{message}</div>}{renderActors(Boolean(task) || (presenterStudioEnabled && view === "actors"))}{!task && (!presenterStudioEnabled || view !== "actors") && <div className={styles.notice}>Choose a video scene first to select the presenter for your saved task.</div>}</section></div>}
    {modal === "promptOptimizer" && <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-label="Optimize prompt">
      <div className={styles.modalHeader}><h2>Optimize prompt</h2><button className={styles.iconButton} onClick={closeModal} aria-label="Close dialog"><X size={23} /></button></div>
      <p className={styles.help}>Rewrites your description into a Wan3.0-ready e-commerce video prompt using the selected video type and references. This usually takes about a minute.</p>
      {promptOptimizer && <>
        <div className={styles.field}><span className={styles.fieldLabel}>Original</span><p className={styles.help} style={{ whiteSpace: "pre-wrap", maxHeight: "18dvh", overflowY: "auto" }}>{promptOptimizer.sourcePrompt}</p></div>
        {promptOptimizer.status === "succeeded" && promptOptimizer.optimizedPrompt && <>
          <div className={styles.field}><span className={styles.fieldLabel}>Optimized (Wan3.0 · 7-section)</span><p className={styles.help} style={{ whiteSpace: "pre-wrap", maxHeight: "40dvh", overflowY: "auto", color: "inherit" }}>{promptOptimizer.optimizedPrompt}</p></div>
          <div className={styles.footerActions}>
            <button type="button" className={styles.linkButton} onClick={retryPromptOptimization}>Optimize again</button>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={adoptOptimizedPrompt}><Check size={16} /><span>Use this prompt</span></button>
          </div>
        </>}
        {promptOptimizer.status === "failed" && <>
          <div className={`${styles.notice} ${styles.error}`} role="alert">{promptOptimizer.error || "Prompt optimization failed."}</div>
          <div className={styles.footerActions}>
            <button type="button" className={styles.linkButton} onClick={closeModal}>Close</button>
            <button type="button" className={`${styles.button} ${styles.primary}`} onClick={retryPromptOptimization}><WandSparkles size={15} /><span>Try again</span></button>
          </div>
        </>}
        {(promptOptimizer.status === "submitting" || promptOptimizer.status === "polling") && <div className={styles.notice} role="status"><Loader2 size={15} className={styles.spin} /> Optimizing… you can keep this open, it usually finishes within a minute.</div>}
      </>}
    </section></div>}
    {batchScene && <BatchDraftDialog open={batchOpen} initialSceneId={batchScene.id} initialInput={composerInput(batchScene)} scenes={catalog?.scenes.map((item) => ({ id: item.id, label: item.name })) ?? []} disabled={busy} onClose={() => setBatchOpen(false)} onSubmit={(items) => void createBatch(items)} />}

  </div>;

  function selectTemplate(option: WorkspaceTemplateOption) {
    // Every asset the template was built from opens in the composer's
    // reference slots; its finished example video never does.
    const referenceImages = (option.referenceImageUrls ?? []).slice(0, 4);
    const referenceVideos = (option.referenceVideoUrls ?? []).slice(0, 4);
    if (option.kind === "video") {
      setView("video");
      setComposerTab("AI Video");
      setPrompt(option.prompt);
      setComposerAspect(option.aspect);
      setComposerDuration(option.duration);
      setVideoReferenceUrls(referenceImages);
      setVideoReferenceFiles(referenceVideos);
    } else {
      setView("images");
      setComposerTab("AI Image");
      setImageInput((current) => ({ ...current, prompt: option.prompt, aspect: option.aspect, toolId: option.imageTool, assetUrls: referenceImages }));
    }
    setPresets((current) => ({ ...current, [option.kind]: option }));
    setPresetSceneId(option.sceneId);
    setSelectedSceneId(option.sceneId);
    setComposerTitle(option.title);
    setMessage("");
    const url = new URL(window.location.href);
    url.pathname = staticViewHref(basePath, option.kind === "photo" ? "images" : "video");
    url.search = "";
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
    setModal(null);
    const main = document.querySelector<HTMLElement>(`main.${styles.main}`);
    window.requestAnimationFrame(() => main?.scrollTo({ top: 0, behavior: "smooth" }));
  }

  function renderTemplatePickerDialog() {
    return <div className={styles.modalOverlay} onClick={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section ref={privateModalRef} className={`${styles.modal} ${styles.templateGalleryModal}`} role="dialog" aria-modal="true" aria-label="Choose a product template">
      <div className={styles.modalHeader}><div><h2>Choose a product template</h2><p className={styles.help}>Pick a scene from the storefront gallery to fill your workspace prompt.</p></div><button className={styles.iconButton} onClick={closeModal} aria-label="Close dialog"><X size={23} /></button></div>
      <label className={styles.templateSearch}><Search size={18} /><input type="search" value={templateSearch} onChange={(event) => setTemplateSearch(event.target.value)} aria-label="Search templates" placeholder="Search templates" /></label>
      <div className={styles.templateFilters} role="group" aria-label="Template type">
        <span className={styles.templateScopeLabel}>{templateModuleKind === "photo" ? "Photo templates" : "Video templates"}</span>
      </div>
      {templateCategories.length > 0 && <div className={styles.templateCategories} role="group" aria-label="Template category">
        <button type="button" aria-pressed={templateCategoryFilter === "all"} className={templateCategoryFilter === "all" ? styles.templateFilterActive : ""} onClick={() => setTemplateCategoryFilter("all")}>All categories</button>
        {templateCategories.map((category) => <button type="button" key={category.id} aria-pressed={templateCategoryFilter === category.id} className={templateCategoryFilter === category.id ? styles.templateFilterActive : ""} onClick={() => setTemplateCategoryFilter(category.id)}>{category.label}</button>)}
      </div>}
      <p className={styles.templateResultCount} aria-live="polite">{visibleTemplates.length} {visibleTemplates.length === 1 ? "template" : "templates"}</p>
      {visibleTemplates.length ? <div className={styles.templateGalleryGrid}>{visibleTemplates.map((option) => <button type="button" key={option.presetId} className={`${styles.templateGalleryCard} ${activePreset?.presetId === option.presetId ? styles.templateGalleryCardSelected : ""}`} onClick={() => selectTemplate(option)} aria-label={`Use ${option.title}`}>
        {/* This is the public preview already used by the homepage picker. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={option.previewUrl} alt={option.imageAlt} />
        <span className={styles.templateGalleryCardCopy}><span className={styles.templateGalleryCardMeta}>{option.categoryIds.slice(0, 2).map((categoryId) => { const category = templateCategories.find((item) => item.id === categoryId); return category ? <small key={category.id}>{category.label}</small> : null; })}</span><strong>{option.title}</strong><span className={styles.templateGalleryCardAction}>{activePreset?.presetId === option.presetId ? <><Check size={15} /> Selected</> : <>Use this template <ArrowRight size={15} /></>}</span></span>
      </button>)}</div> : <div className={styles.templateGalleryEmpty}><Clapperboard size={26} /><p>No templates match your search.</p></div>}
    </section></div>;
  }

  function renderTemplate(preset: WorkspacePreset) {
    const video = preset.kind === "video";
    const selectedScene = task?.sceneId ?? (view === "agent" && selectedSceneId ? selectedSceneId : presetSceneId ?? preset.sceneId);
    return <section className={styles.templateSummary} data-testid="workspace-template" aria-label="Selected template">
      {/* A style preview is not a customer product or a generation reference. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.templatePreview} src={preset.previewUrl} alt={preset.title} decoding="async" />
      <div className={styles.templateCopy}><span className={styles.badge}>{video ? "Video template" : "Image template"}</span><h2>{preset.title}</h2><p>Use this style with your own product photos and details.</p>
        {video && !task && presenterStudioEnabled && <div className={styles.templateScene}><span>Video scene</span><strong>{catalog?.scenes.find((item) => item.id === selectedScene)?.name ?? selectedScene}</strong></div>}
        {video && !task && !presenterStudioEnabled && <div className={styles.templateScene}><span>Video scene</span><WorkspaceSelect
          ariaLabel="Video scene"
          value={selectedScene}
          disabled={working}
          options={sceneOptions}
          onChange={(value) => {
            const nextScene = value as WorkspacePreset["sceneId"]; setPresetSceneId(nextScene);
            if (view === "agent" && selectedSceneId) { setSelectedSceneId(nextScene); window.history.replaceState({ ...window.history.state, scene: nextScene }, ""); }
          }}
        /></div>}
        {video && task && <p>{catalog?.scenes.find((item) => item.id === selectedScene)?.name}</p>}
      </div>
      {!task && <button className={styles.iconButton} disabled={working} aria-label="Remove template" onClick={() => {
        setPresets((current) => ({ ...current, [preset.kind]: undefined })); setPresetSceneId(undefined); setComposerTitle(""); setPrompt("");
        setVideoReferenceUrls([]); setVideoReferenceFiles([]); setAudioReferenceFiles([]); setComposerProducts([]);
        if (!video) setImageInput((current) => ({ ...current, prompt: "", assetUrls: [], toolId: "custom" }));
        const url = new URL(window.location.href); url.pathname = staticViewHref(basePath, view);
        url.search = ""; url.hash = "";
        window.history.replaceState(window.history.state, "", url);
      }}><X size={18} /></button>}
    </section>;
  }

  function templatePickerCallout() {
    return <section className={styles.templatePickerCallout} aria-label="Product templates">
      <div className={styles.templatePickerMessage}>
        <span className={styles.templatePickerIcon}><Clapperboard size={20} /></span>
        <span className={styles.templatePickerText}><strong>Start with a ready-made scene</strong><span>Choose a template from the storefront scene gallery.</span></span>
      </div>
      <button type="button" className={`${styles.button} ${styles.primary} ${styles.templatePickerButton}`} onClick={() => setModal("templates")}><Clapperboard size={16} /><span>Choose a template</span><ArrowRight size={15} /></button>
    </section>;
  }

  async function startAvatarVideo(item: ActorAsset) {
    const presenter = catalog?.scenes.find((entry) => entry.needsActor);
    if (!presenter) return;
    try { await persist(); } catch { return; }
    setComposerActorId(item.actorId);
    await selectScene(presenter, { title: `${item.name} product video` });
    setModal(null);
  }

  function languageLabel(language: string) { return catalog?.languages.find((item) => item.value === language)?.label ?? language; }
  function renderTaskCards(items: WorkspaceTask[]) {
    return <div className={styles.taskGrid}>{items.map((item) => {
      const scene = catalog?.scenes.find((entry) => entry.id === item.sceneId);
      const model = catalog?.models.find((entry) => entry.id === item.input.modelId)?.label;
      const description = cardDescription(String(item.input.fields.description ?? item.input.creativeDirection ?? Object.values(item.input.fields).find((value) => typeof value === "string" && value.trim()) ?? ""));
      // A presenter-showcase task also carries the host portrait: surface it in
      // the reference row (count + thumbnail) next to the product photos.
      const needsActor = Boolean(scene?.needsActor);
      const actorPortrait = needsActor && item.input.actorId
        ? catalog?.actors.find((entry) => entry.actorId === item.input.actorId)?.imageUrl
        : undefined;
      const referenceThumbs = [
        ...(actorPortrait ? [{ src: actorPortrait, label: "Host" }] : []),
        ...(item.input.images.productImages ?? []).slice(0, 2).map((src) => ({ src, label: "Product" }))
      ];
      const references = [
        ...(needsActor && actorPortrait ? ["1 host"] : []),
        item.input.images.productImages?.length ? `${item.input.images.productImages.length} photos` : "",
        ...(item.input.referenceVideos?.length ? [`${item.input.referenceVideos.length} videos`] : []),
        ...(item.input.referenceAudios?.length ? [`${item.input.referenceAudios.length} audio`] : [])
      ].filter(Boolean).join(" · ");
      const statusView = deriveTaskStatus(item);
      const itemRunning = taskStatusInFlight(statusView);
      const failureCode = statusView.status === "failed" ? statusView.failureCode : undefined;
      const failureReason = failureCode ? humanError(failureCode) : "";
      // A direct task can stop between the storyboard and the paid clip when
      // the browser leaves mid-flow. The server has no error in that case, so
      // the card must still say why nothing is happening instead of showing a
      // silent "Ready to render" state.
      const directWaiting = item.input.direct && statusView.status === "ready"
        && (item.storyboard?.shots.length ?? 0) > 0
        && item.storyboard!.shots.every((shot) => shot.genStatus === "pending");
      const cardNotice = failureReason || (directWaiting ? "Generation hasn't started for this video. Open it and tap Try again." : "");
      const badgeLabel = taskStatusLabel(item);
      const statusTone = itemRunning ? "progress" as const : failureReason ? "error" as const : statusView.status === "completed" ? "done" as const : "idle" as const;
      return <LibraryTaskCard
        key={item.taskId}
        title={item.title}
        statusLabel={badgeLabel}
        statusTone={statusTone}
        failureReason={cardNotice || undefined}
        description={description || undefined}
        sceneName={scene?.name}
        modelLabel={model}
        createdAtLabel={shortDate(item.createdAt)}
        duration={item.input.options.duration}
        aspect={item.input.options.aspect}
        resolution={item.input.options.resolution}
        referenceSummary={references || undefined}
        referenceThumbs={referenceThumbs}
        media={libraryMedia.get(item.taskId) ?? taskMedia(item, scene)}
        disabled={busy || itemRunning}
        openDisabled={busy}
        onOpen={() => setDetailTaskId(item.taskId)}
        onDelete={() => void removeTask(item)}
      />;
    })}</div>;
  }

  function renderActors(selectable: boolean) {
    const allActors = catalog?.actors ?? [];
    const genderCounts = {
      all: allActors.length,
      female: allActors.filter((item) => item.gender === "female").length,
      male: allActors.filter((item) => item.gender === "male").length
    };
    const matches = (item: ActorAsset) => (actorGenderFilter === "all" || item.gender === actorGenderFilter)
      && (!actorSearch.trim() || [item.name, item.ageRange, item.genderLabel, item.scene, item.style, item.description, item.talent, item.voice.label].filter(Boolean).join(" ").toLowerCase().includes(actorSearch.trim().toLowerCase()));
    const builtIn = catalog?.actors.filter((item) => !item.actorId.startsWith("custom-") && matches(item)) ?? [];
    const custom = catalog?.actors.filter((item) => item.actorId.startsWith("custom-") && matches(item)) ?? [];
    const group = (items: ActorAsset[]) => <div className={styles.actorGrid}>{items.map((item) => {
      const selected = task ? task.input.actorId === item.actorId : avatarSelectionId === item.actorId;
      return <article key={item.actorId} className={`${styles.actor} ${selected ? styles.selected : ""}`}><img loading="lazy" decoding="async" src={item.imageUrl} alt={item.name} /><div className={styles.actorContent}><strong>{item.name}</strong><p><span>{item.genderLabel ?? (item.gender === "female" ? "Women" : "Men")}</span><span> · </span><span>{item.ageRange}</span></p><p><span>{item.scene}</span><span>{item.style ? ` · ${item.style}` : ""}</span></p>{item.description && <p>{item.description}</p>}{item.talent && <p className={styles.actorTalent}>{item.talent}</p>}<p className={styles.actorVoice}><Headphones size={13} /><span>{item.voice.label || "Voice profile"}</span></p>{item.sampleLine && <blockquote className={styles.actorLine}><span>“</span><span>{item.sampleLine}</span><span>”</span></blockquote>}{item.voice.refAudio && <audio controls preload="none" src={item.voice.refAudio} aria-label={`${item.name} voice sample`} />}{!selectable && <button className={styles.button} style={{ width: "100%", marginTop: 10 }} disabled={working} onClick={() => void startAvatarVideo(item)}><Video size={15} /><span>Use in a video</span></button>}{selectable && <button className={styles.button} style={{ width: "100%", marginTop: 10 }} disabled={editingDisabled} onClick={() => { if (task) updateInput((input) => ({ ...input, actorId: item.actorId })); else setAvatarSelectionId(item.actorId); setAvatarLanguage(item.voice.language); setModal(null); }}>{selected ? <Check size={15} /> : <Plus size={15} />}<span>{selected ? "Selected" : "Use this presenter"}</span></button>}{item.actorId.startsWith("custom-") && <button className={styles.linkButton} disabled={working} onClick={() => void deleteActor(item)}><Trash2 size={13} /><span>Delete avatar</span></button>}</div></article>;
    })}</div>;
    return <>
      <div className={styles.sectionHead}><h3><span>Available avatars · </span><span>{builtIn.length}</span></h3></div>
      <div className={styles.choices} role="group" aria-label="Filter avatars by gender" style={{ marginBottom: 14 }}>
        {(["all", "female", "male"] as const).map((gender) => <button key={gender} type="button" aria-pressed={actorGenderFilter === gender} className={`${styles.choice} ${actorGenderFilter === gender ? styles.selected : ""}`} onClick={() => setActorGenderFilter(gender)}><span>{gender === "all" ? "All" : gender === "female" ? "Women" : "Men"}</span><span> · </span><span>{genderCounts[gender]}</span></button>)}
      </div>
      <label className={styles.actorSearch}><Search size={16} /><span className={styles.srOnly}>Search actors</span><input value={actorSearch} onChange={(event) => setActorSearch(event.target.value)} placeholder="Search by name, character or scene" /></label>{builtIn.length ? group(builtIn) : <p className={styles.help}>{actorSearch ? "No actors match this search and gender." : "No preset avatars match this gender."}</p>}
      <div className={styles.sectionHead} style={{ marginTop: 24 }}><h3>My avatars</h3>{customer ? <button className={styles.button} disabled={working} onClick={() => setCreatingActor(!creatingActor)}><Plus size={15} /><span>Use my own</span></button> : <a className={styles.button} href={loginHref}>Log in to add an avatar</a>}</div>
      {custom.length ? group(custom) : <p className={styles.help}>{actorSearch || actorGenderFilter !== "all" ? "No avatars match this search and gender." : "Add a clear portrait to use your own presenter."}</p>}
      {creatingActor && customer && <form className={styles.formSection} style={{ marginTop: 18 }} onSubmit={(event) => void createActor(event)}><h2>Create your avatar</h2><p>Add a clear face photo. Its voice profile will stay with this avatar.</p><div className={styles.fields}>
        <div className={styles.field}><span className={styles.fieldLabel}>Portrait photo</span><FileDropZone className={styles.imageStrip} activeClassName={styles.dropActive} disabled={busy} onFiles={(files) => { const image = files.find((file) => fileKind(file) === "image"); if (image) void uploadActor(image); }}><label className={styles.upload}><Upload size={20} /><span>{busy ? "Uploading…" : actorDraft.imageUrl ? "Replace portrait" : "Add portrait"}</span><input type="file" accept="image/*" disabled={busy} aria-label="Upload avatar portrait" onChange={(event) => { void uploadActor(event.target.files?.[0]); event.target.value = ""; }} /></label>{actorDraft.imageUrl && <div className={styles.imageSlot}><img loading="lazy" decoding="async" src={actorDraft.imageUrl} alt="Your avatar portrait" /></div>}</FileDropZone></div>
        <label className={styles.field}><span className={styles.fieldLabel}>Name</span><input className={styles.input} required maxLength={80} disabled={busy} value={actorDraft.name} onChange={(event) => setActorDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        <div className={styles.parameterGrid}><label className={styles.field}><span className={styles.fieldLabel}>Gender</span><select className={styles.input} value={actorDraft.gender} disabled={busy} onChange={(event) => setActorDraft((current) => ({ ...current, gender: event.target.value as "female" | "male" }))}><option value="female">Female</option><option value="male">Male</option></select></label><label className={styles.field}><span className={styles.fieldLabel}>Age range</span><select className={styles.input} disabled={busy} value={actorDraft.ageRange} onChange={(event) => setActorDraft((current) => ({ ...current, ageRange: event.target.value }))}>{["18-24", "25-30", "30-35", "35-45", "45-55", "55-65", "65-75"].map((value) => <option key={value}>{value}</option>)}</select></label></div>
        <div className={styles.field}><span className={styles.fieldLabel}>Languages</span><div className={styles.choices}>{catalog?.languages.map((language) => <button key={language.value} type="button" disabled={busy} className={`${styles.choice} ${actorDraft.languages.includes(language.value) ? styles.selected : ""}`} onClick={() => setActorDraft((current) => ({ ...current, languages: current.languages.includes(language.value) ? current.languages.filter((item) => item !== language.value) : [...current.languages, language.value] }))}>{language.label}</button>)}</div></div>
        <p className={styles.help}>A voice profile guides the tone. This connection does not guarantee an exact voice clone.</p>
      </div><div className={styles.footerActions}><button className={styles.button} type="button" disabled={busy} onClick={() => setCreatingActor(false)}>Cancel</button><button className={`${styles.button} ${styles.primary}`} type="submit" disabled={busy || !actorDraft.imageUrl || !actorDraft.languages.length}>{busy ? "Saving…" : "Save avatar"}</button></div></form>}
    </>;
  }

  function renderField(field: SceneField) {
    if (!task) return null;
    const value = task.input.fields[field.id] ?? "";
    const setValue = (next: string | string[]) => updateInput((input) => ({ ...input, fields: { ...input.fields, [field.id]: next } }));
    return <div key={field.id} className={styles.field}><span className={styles.fieldLabel}><span>{field.label}</span>{field.required && <span className={styles.required}>*</span>}</span><p className={styles.help}>{field.hint}</p>{field.type === "images" ? <FileDropZone className={styles.imageStrip} activeClassName={styles.dropActive} disabled={working || editingDisabled} onFiles={(files) => importTaskFieldImages(field, files)}>{(task.input.images[field.id] ?? []).map((url, index) => <div key={`${url}-${index}`} className={styles.imageSlot} {...reorderHandlers(index, working || editingDisabled, (from, to) => updateInput((input) => ({ ...input, images: { ...input.images, [field.id]: moveItem(input.images[field.id] ?? [], from, to) } })))}><img loading="lazy" decoding="async" src={url} alt={`${field.label} ${index + 1}`} /><span className={styles.badge}>{index + 1}</span><button className={styles.removeImage} disabled={working} aria-label={`Remove ${field.label} ${index + 1}`} onClick={() => updateInput((input) => ({ ...input, images: { ...input.images, [field.id]: input.images[field.id].filter((_, current) => current !== index) } }))}><X size={12} /></button><p>{field.refKind ? refLabels[field.refKind] : field.label}</p></div>)}{(task.input.images[field.id]?.length ?? 0) < (field.max ?? 4) && <label className={styles.upload}><Upload size={21} /><span>{busy ? "Uploading…" : "Add image"}</span><input aria-label={`Upload ${field.label}`} accept="image/*" type="file" multiple disabled={editingDisabled} onChange={(event) => { void uploadField(field, event.target.files); event.target.value = ""; }} /></label>}</FileDropZone> : field.type === "textarea" ? <><textarea className={styles.input} aria-label={field.label} disabled={editingDisabled} value={String(value)} maxLength={field.max ?? WORKSPACE_PROMPT_MAX_LENGTH} onChange={(event) => setValue(event.target.value)} /><span className={styles.help}><span>{String(value).length}</span><span>{field.max ? ` / ${field.max}` : ""}</span><span> characters</span></span></> : field.type === "select" ? <select className={styles.input} aria-label={field.label} disabled={editingDisabled} value={String(value)} onChange={(event) => setValue(event.target.value)}><option value="">Choose an option</option>{field.options?.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select> : field.type === "tags" ? <><div className={styles.choices}>{field.options?.map((option) => { const selected = Array.isArray(value) && value.includes(option.value); return <button key={option.value} className={`${styles.choice} ${selected ? styles.selected : ""}`} disabled={editingDisabled} onClick={() => setValue(selected ? (value as string[]).filter((item) => item !== option.value) : [...(Array.isArray(value) ? value : []), option.value])}>{option.label}</button>; })}</div><input className={styles.input} aria-label={`${field.label} custom tags`} disabled={editingDisabled} value={tagDrafts[`${task.taskId}:${field.id}`] ?? (Array.isArray(value) ? value.filter((item) => !field.options?.some((option) => option.value === item)).join(", ") : "")} placeholder="Add your own, separated by commas" onChange={(event) => { setTagDrafts((current) => ({ ...current, [`${task.taskId}:${field.id}`]: event.target.value })); setValue([...(Array.isArray(value) ? value.filter((item) => field.options?.some((option) => option.value === item)) : []), ...event.target.value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean)]); }} /></> : <input className={styles.input} aria-label={field.label} disabled={editingDisabled} value={String(value)} maxLength={field.max ?? 2000} onChange={(event) => setValue(event.target.value)} />}</div>;
  }

  function renderShot(shot: StoryboardShot, index: number) {
    if (!task) return null;
    const version = shot.versions.find((item) => item.vid === shot.curVer);
    const clipQuote = quotes[`${task.taskId}:${shot.shotId}:generate_shot`];
    const compositionQuote = quotes[`${task.taskId}:${shot.shotId}:compose_shot`];
    const refs = imageEntries(task, scene);
    const shotActor = catalog?.actors.find((item) => item.actorId === shot.actorId) ?? actor;
    const availableKinds = [...new Set(refs.map((item) => item.kind))];
    const cjk = ["zh", "ja", "ko"].includes(task.input.options.language);
    const count = cjk ? Array.from(shot.voiceover.replace(/\s/g, "")).length : shot.voiceover.trim().split(/\s+/).filter(Boolean).length;
    return <article key={shot.shotId} className={styles.shot}>
      <header className={styles.shotHeader}><div className={styles.row}><h3><span>Shot </span><span>{index + 1}</span></h3><span className={styles.help}><span>{shot.start}</span><span>s–</span><span>{shot.end}</span><span>s</span></span><span className={styles.badge}>{shot.genStatus === "run" ? "Generating" : shot.genStatus === "done" ? "Ready" : shot.genStatus === "fail" ? "Failed" : shot.genStatus === "expired" ? "Expired" : "Not generated"}</span></div><div className={styles.shotActions}><button className={styles.iconButton} disabled={editingDisabled || index === 0} onClick={() => reorderShot(shot.shotId, -1)} aria-label={`Move shot ${index + 1} up`}><ArrowUp size={16} /></button><button className={styles.iconButton} disabled={editingDisabled || index === (task.storyboard?.shots.length ?? 0) - 1} onClick={() => reorderShot(shot.shotId, 1)} aria-label={`Move shot ${index + 1} down`}><ArrowDown size={16} /></button><button className={styles.iconButton} disabled={editingDisabled} onClick={() => editShot(shot.shotId, { locked: !shot.locked })} aria-label={shot.locked ? `Unlock shot ${index + 1}` : `Lock shot ${index + 1}`} title="Locked shots are kept when making a new storyboard draft">{shot.locked ? <LockKeyhole size={16} /> : <UnlockKeyhole size={16} />}</button></div></header>
      <div className={styles.shotBody}><div className={styles.shotFields}><label className={styles.field}><span className={styles.fieldLabel}>What happens in this shot</span><textarea className={styles.input} disabled={editingDisabled} value={shot.visual} maxLength={4000} onChange={(event) => editShot(shot.shotId, { visual: event.target.value })} /></label>{scene?.needsActor && <label className={styles.field}><span className={styles.fieldLabel}>Dialogue</span><textarea className={styles.input} disabled={editingDisabled} value={shot.voiceover} maxLength={2000} onChange={(event) => editShot(shot.shotId, { voiceover: event.target.value })} /><span className={styles.help}><span>{count}</span> <span>{cjk ? "characters" : "words"}</span><span> · </span><span>{languageLabel(task.input.options.language)}</span></span></label>}<div className={styles.field}><span className={styles.fieldLabel}>Reference images</span><p className={styles.help}>Changes here affect this shot only.</p><div className={styles.imageStrip}>{shot.refKinds.map((kind, refIndex) => {
        const url = shot.refImgs[kind] || (kind === "actor" ? shotActor?.imageUrl : refs.find((item) => item.kind === kind)?.url);
        return <div key={kind} className={styles.imageSlot}>{url ? <img loading="lazy" decoding="async" src={url} alt={kind === "actor" ? shotActor?.name || "Selected avatar" : `${refLabels[kind]} reference`} /> : <div className={styles.upload}>{refLabels[kind]}</div>}<span className={styles.badge}>{refIndex + 1}</span><button className={styles.removeImage} disabled={editingDisabled || kind === "actor" || kind === "composite" || shot.refKinds.length <= 1} title={kind === "actor" ? "The presenter reference keeps your avatar consistent" : kind === "composite" ? "This combined reference is prepared for generation" : shot.refKinds.length <= 1 ? "Keep at least one reference image" : "Remove this reference"} aria-label={`Remove ${refLabels[kind]} reference`} onClick={() => { const imgs = { ...shot.refImgs }; delete imgs[kind]; editShot(shot.shotId, { refKinds: shot.refKinds.filter((item) => item !== kind), refImgs: imgs }); }}><X size={12} /></button><p>{kind === "actor" ? shotActor?.name || "Avatar" : refLabels[kind]}</p>{kind !== "composite" && kind !== "actor" && <select className={styles.input} style={{ padding: 4, fontSize: 11, minHeight: 27 }} aria-label={`Change ${refLabels[kind]} reference for shot ${index + 1}`} disabled={editingDisabled} value={url ?? ""} onChange={(event) => editShot(shot.shotId, { refImgs: { ...shot.refImgs, [kind]: event.target.value } })}>{refs.filter((item) => item.kind === kind).map((item, i) => <option key={`${item.url}-${i}`} value={item.url}>Image {i + 1}</option>)}</select>}{kind === "actor" && <button className={styles.linkButton} style={{ fontSize: 10 }} onClick={() => setModal("actors")}>Change avatar (all shots)</button>}</div>;
      })}</div><div className={styles.choices}>{availableKinds.filter((kind) => !shot.refKinds.includes(kind)).map((kind) => <button key={kind} className={styles.choice} disabled={editingDisabled} onClick={() => editShot(shot.shotId, { refKinds: [...shot.refKinds, kind], refImgs: { ...shot.refImgs, [kind]: refs.find((item) => item.kind === kind)?.url } })}><Plus size={12} style={{ display: "inline", marginRight: 4 }} /><span>{refLabels[kind]}</span></button>)}</div></div><div className={styles.parameterGrid}>{(["firstFrame", "lastFrame"] as const).map((key) => <label key={key} className={styles.field}><span className={styles.fieldLabel}>{key === "firstFrame" ? "First frame" : "Last frame"}</span><select className={styles.input} disabled={editingDisabled || (key === "firstFrame" ? !selectedModel?.firstFrame : !selectedModel?.lastFrame)} title={key === "firstFrame" && !selectedModel?.firstFrame || key === "lastFrame" && !selectedModel?.lastFrame ? "The selected model does not support this frame setting" : undefined} value={shot[key] ?? ""} onChange={(event) => editShot(shot.shotId, { [key]: event.target.value || undefined })}><option value="">Let the model decide</option>{refs.map((item, i) => <option key={`${item.url}-${i}`} value={item.url}>{item.label} {i + 1}</option>)}</select></label>)}</div></div><div className={styles.shotAside}><div className={styles.clipPreview}>{version?.clipUrl && version.status === "done" ? <video src={version.clipUrl} controls preload="metadata" playsInline aria-label={`Shot ${index + 1} preview`} /> : <>{shot.genStatus === "run" ? <Loader2 size={34} className={styles.spin} /> : <Video size={34} />}<span>{shot.genStatus === "run" ? "Generating your shot…" : shot.genStatus === "expired" ? "This clip expired and was removed. Generate the shot again." : "Your clip will appear here"}</span></>}</div>{scene?.needsActor && <div className={styles.field}><p className={styles.help}>{shot.compositeStatus === "run" ? "Preparing the presenter with your product…" : shot.refImgs.composite ? "Your presenter reference is ready." : "Prepare one image of your presenter with the product before generating this shot."}</p><button className={styles.button} disabled={working || shot.compositeStatus === "run" || shot.genStatus === "run" || !compositionQuote?.available} title={!compositionQuote?.available ? humanError(compositionQuote?.reason || catalog?.composition?.reason || "workspace_composition_unavailable") : undefined} onClick={() => void runAction("compose_shot", { shotId: shot.shotId })}>{shot.compositeStatus === "run" ? <Loader2 size={15} className={styles.spin} /> : <ImageIcon size={15} />}<span>{shot.refImgs.composite ? "Prepare another reference" : "Prepare presenter reference"}</span><span>{compositionQuote?.credits != null ? ` · ${compositionQuote.credits} credits` : ""}</span></button>{!compositionQuote?.available && <p className={styles.help}>{humanError(compositionQuote?.reason || catalog?.composition?.reason || "workspace_composition_unavailable")}</p>}</div>}{shot.error && <p className={`${styles.notice} ${styles.error}`}>{humanError(shot.error)}</p>}{(!canGenerate || !clipQuote?.available) && <p className={styles.help}>{humanError(clipQuote?.reason || durationCapability?.reason || "workspace_quote_required")}</p>}<button className={`${styles.button} ${styles.primary}`} disabled={working || shot.genStatus === "run" || shot.compositeStatus === "run" || !canGenerate || !clipQuote?.available || Boolean(scene?.needsActor && !shot.refImgs.composite)} title={!clipQuote?.available || !canGenerate ? humanError(clipQuote?.reason || durationCapability?.reason || "workspace_video_provider_unavailable") : undefined} onClick={() => void runAction("generate_shot", { shotId: shot.shotId })}>{shot.genStatus === "run" ? <Loader2 size={15} className={styles.spin} /> : <Sparkles size={15} />}<span>{shot.genStatus === "fail" ? "Retry this shot" : version?.clipUrl ? "Generate another version" : "Generate this shot"}</span><span>{clipQuote?.credits != null ? ` · ${clipQuote.credits} credits` : ""}</span></button>{shot.versions.length > 0 && <label className={styles.field}><span className={styles.help}>Selected version — restores its details</span><select className={styles.input} value={shot.curVer ?? ""} disabled={editingDisabled} onChange={(event) => void runAction("restore_version", { shotId: shot.shotId, versionId: event.target.value })}><option value="" disabled>Choose a version</option>{shot.versions.map((item, i) => <option key={item.vid} value={item.vid}>Version {i + 1} · {new Date(item.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {item.status === "done" ? "Ready" : item.status === "fail" ? "Failed" : item.status === "expired" ? "Expired" : "Draft"}</option>)}</select></label>}</div></div>
      <details className={styles.shotFooter}><summary>View current shot prompt</summary><pre>{saveStatus === "All changes saved" ? shot.prompt : "Save your changes to refresh this prompt."}</pre></details>
    </article>;
  }
}

function upstreamProviderMessage(code: string): string {
  const start = code.indexOf("{");
  if (start < 0) return "";
  try {
    const parsed = JSON.parse(code.slice(start)) as { error?: { message?: unknown }; message?: unknown };
    const message = typeof parsed.error?.message === "string" ? parsed.error.message : typeof parsed.message === "string" ? parsed.message : "";
    return message.replace(/\s+/g, " ").trim().slice(0, 180);
  } catch { return ""; }
}
function humanError(code?: string) {
  if (!code) return "";
  if (code === "workspace_ffprobe_unavailable") return "The final assembly step hit a temporary server issue. Your generated clips are saved and no credits were charged for the assembly — open the task and retry the render.";
  if (code === "workspace_render_failed") return "The final assembly didn't finish. Your generated clips are saved — open the task and retry the render.";
  if (code.includes("local_worker_restarted") || code.includes("local_worker_recovered")) return "Generation was interrupted by a server restart. Please try again.";
  if (code === "workspace_clip_retention_expired") return "This clip was deleted after its 15-day retention period ended. Generate the shot again to create a new version.";
  if (/ai_provider_[a-z_]*timeout/.test(code)) return "The video provider did not respond in time. Please retry this shot.";
  if (code.startsWith("ai_provider_video_create_failed")) {
    const detail = upstreamProviderMessage(code);
    return detail ? `The video provider rejected this shot: ${detail}` : "The video provider rejected this shot. Please retry.";
  }
  if (code.startsWith("ai_provider_video_scene_image")) {
    const detail = upstreamProviderMessage(code);
    return detail ? `The reference image could not be prepared: ${detail}` : "The reference image could not be prepared for this shot.";
  }
  if (code.startsWith("ai_provider_video")) {
    const detail = upstreamProviderMessage(code);
    return detail ? `The video provider failed on this shot: ${detail}` : "The video provider failed on this shot. Please retry.";
  }
  const messages: Record<string, string> = {
    workspace_clone_analysis_mock_only: "This draft uses a simulated reference analysis. You can edit and save it, but generation is unavailable.",
    workspace_template_changed: "This template changed after you opened it. Reopen the card to use its latest version.",
    workspace_template_not_found: "This template is no longer available. Choose another card.",
    workspace_template_request_invalid: "This template link is invalid. Reopen the card from the website.",
    ai_provider_disabled: "This model is currently disabled.",
    billing_configuration_required: "Video pricing is being configured. You can save and edit your draft; paid generation will be available once pricing is confirmed.",
    composition_unavailable: "Presenter reference generation is not connected yet.",
    quote_required: "Checking the current generation price…",
    quote_expired: "Your price quote expired. Please refresh the price and try again.",
    quote_price_changed: "The generation price changed. Review the updated price before continuing.",
    pricing_configuration_mismatch: "The configured video price does not match the published credit amount. Generation is paused until pricing is aligned.",
    shot_busy: "This shot is still processing. Wait for it to finish before trying again.",
    task_busy: "Your video is still processing. Wait for the current action to finish.",
    storyboard_stale: "Your details changed. Refresh the storyboard before generating or rendering.",
    required_field_missing: "Complete the required details and add your product photos before generating.",
    actor_selection_required: "Choose an avatar before generating your storyboard.",
    actor_language_unsupported: "The chosen avatar does not support this language. Choose another avatar or language.",
    actor_identity_required: "Complete the avatar name, gender and age range.",
    actor_voice_not_in_pool: "Choose a voice profile that matches the avatar's gender.",
    actor_language_required: "Select at least one language for your avatar.",
    actor_in_use: "This avatar is used by a saved video. Remove those tasks before deleting it.",
    storyboard_provider_unavailable: "Script generation is not connected yet. Your details are saved.",
    missing_required_prompt_input: "Generation was stopped before it reached the provider because a required field was missing. Retry the generation.",
    worker_dispatch_failed: "The video request could not be sent to the generation service. Please retry.",
    dispatch_outcome_unknown: "The generation service did not confirm the request. Check your Library before retrying.",
    dispatch_finished: "This request was already sent to the generation service.",
    provider_reference_limit: "Too many reference images for the selected model. Remove one or two and retry.",
    actor_product_composite_stale: "Your source photos changed after the presenter reference was prepared. Prepare it again.",
    video_theme_binding_required: "The video theme is not connected. Contact support before generating.",
    video_theme_binding_invalid: "The video theme is unavailable. Contact support before generating.",
    shot_duration_unsupported: "The selected model cannot generate a clip this long. Choose another model or duration.",
    storyboard_response_empty: "Your storyboard came back empty. Please retry.",
    storyboard_provider_failed: "Your storyboard could not be generated. Your details are saved; please retry.",
    storyboard_response_invalid: "The generated storyboard needs another attempt. Please retry.",
    storyboard_unverified_claim: "The generated script contained claims beyond your supplied product facts. Please retry or clarify your details.",
    actor_product_composite_required: "Prepare the presenter reference before generating this shot.",
    native_speech_unsupported: "Choose a video model that supports spoken audio for this scene.",
    voiceover_too_long: "Shorten this shot's dialogue so it fits the shot duration.",
    language_rewrite_required: "Rewrite or edit the dialogue to match the selected video language.",
    subtitles_not_available: "Verified caption timing is not available. Try rendering without captions.",
    speech_timing_provider_required: "Caption timing is not connected yet. Render without captions to continue.",
    speech_timing_provider_unavailable: "The caption timing service is not available right now. Render without captions to continue.",
    keyframe_transport_unsupported: "The current model connection does not support independent first or last frames.",
    audio_reference_transport_unsupported: "The current model connection does not support a voice reference.",
    shot_not_ready: "Generate and confirm every shot before rendering.",
    shot_version_stale: "This shot was edited after its clip was generated. Choose a matching version or generate it again.",
    generation_app_missing: "Generation is not connected to this workspace yet.",
    actor_required: "Choose an avatar before generating this storyboard.", scene_not_found: "This video scene is no longer available.", operation_interrupted: "Your last action was interrupted. Resume it to continue from your saved progress.", workspace_video_provider_unavailable: "No video provider is currently available for this workspace.", generation_unavailable: "This video format is not available for generation yet.", provider_unavailable: "No video model is connected for this request.", model_unavailable: "The selected video model is unavailable.", pricing_unconfigured: "Pricing for this duration has not been configured yet.", insufficient_credits: "You don't have enough credits for this generation.", credits_insufficient: "You don't have enough credits for this generation.", revision_conflict: "This task changed in another window. Reload it from Library.", clips_not_ready: "Generate and confirm every shot before rendering.", missing_required_field: "Complete the required details before generating.", storyboard_required: "Generate a storyboard before continuing.", native_audio_required: "This scene requires a video model that supports spoken audio.", speech_timing_unverified: "Caption timing is not available for these clips yet. Retry without captions or use a model with timed audio.", asset_not_owned: "Choose an image uploaded to your own account.", not_authenticated: "Log in to save and generate a video.", rendering_in_progress: "Your video is already rendering. You can return from Library.", first_frame_unsupported: "The selected model doesn't support a first-frame image.", last_frame_unsupported: "The selected model doesn't support a last-frame image.",
    invalid_action: "This action isn't available for the current state of your video. Refresh it from Library.",
    invalid_title: "Give this video a name before saving.",
    task_title_invalid: "Give this video a valid name.",
    invalid_input: "Some details are missing or invalid. Review them and try again.",
    input_invalid: "Some details are missing or invalid. Review them and try again.",
    invalid_json: "The request could not be read. Refresh the page and try again.",
    idempotency_conflict: "This request was already submitted. Refresh the video from Library to see its latest state.",
    operation_not_cancellable: "This step can no longer be cancelled.",
    operation_superseded: "A newer step replaced this one. Refresh the video from Library.",
    shot_not_found: "This shot is no longer part of the storyboard. Refresh the video and try again.",
    invalid_shot_id: "This shot is no longer part of the storyboard. Refresh the video and try again.",
    version_not_found: "That clip version is no longer available.",
    quote_invalid: "Your price quote is no longer valid. Refresh the price and try again.",
    quote_changed: "Your details changed after the price was quoted. Review the updated price and try again.",
    price_quote_changed: "The generation price changed. Review the updated price before continuing.",
    render_failed: "Your video could not be stitched. Open it from your Library and try again.",
    generation_not_found: "This generation is no longer available. Open the video in your Library and retry.",
    video_processing_failed: "The generation service hit a problem while processing this video. Please retry.",
    video_not_ready: "This video isn't finished yet. Wait for generation to complete.",
    database_readonly: "Saving is temporarily unavailable. Please try again in a few minutes.",
    site_not_found: "This video isn't available on your account.",
    site_mismatch: "This video isn't available on your account.",
    site_not_allowed: "This video isn't available on your account.",
    customer_login_required: "Log in to continue.",
    customer_site_mismatch: "This video isn't available on your account.",
    scene_invalid: "This video scene is no longer available.",
    scene_has_no_actor: "Choose an avatar for this scene before generating.",
    scene_has_no_voiceover: "This scene needs dialogue for the selected model. Add a script or choose another model.",
    voiceover_required: "Add dialogue for this scene or choose a model without spoken audio.",
    actor_not_found: "This avatar is no longer available. Choose another one.",
    actor_incomplete: "Complete the avatar profile before using it.",
    actor_change_requires_storyboard: "Changing the avatar requires a fresh storyboard. Generate it again.",
    actor_product_references_required: "Add your product photos before preparing the presenter reference.",
    actor_voice_snapshot_missing: "Re-select the avatar so its voice is prepared, then generate again.",
    actor_voice_snapshot_invalid: "The avatar's voice preparation is out of date. Re-select the avatar and generate again.",
    actor_voice_snapshot_actor_mismatch: "The prepared voice doesn't match the selected avatar. Re-select the avatar and generate again.",
    duration_invalid: "Choose a supported video length and try again.",
    aspect_invalid: "Choose a supported video format and try again.",
    resolution_invalid: "Choose a supported video quality and try again.",
    resolution_unsupported: "The selected model doesn't support this video quality. Pick another one.",
    creative_direction_required: "Describe your video idea before generating.",
    creative_direction_invalid: "Adjust your video description and try again.",
    language_invalid: "Choose a supported language and try again.",
    language_input_mismatch: "The dialogue doesn't match the selected video language. Rewrite or edit it.",
    images_invalid: "Re-check the photos you attached and try again.",
    reference_missing: "Add the required photos before generating.",
    reference_not_owned: "Choose images uploaded to your own account.",
    reference_not_in_task: "One of the selected references isn't part of this video anymore. Re-select it and try again.",
    reference_order_invalid: "Reorder your reference photos and try again.",
    reference_file_invalid: "That file can't be used as a reference. Try another image or clip.",
    reference_file_required: "Add the required reference file before generating.",
    reference_file_too_large: "That file is too large. Use a smaller file.",
    reference_file_type_unsupported: "That file type isn't supported. Try another image or clip.",
    reference_kind_invalid: "That reference type isn't supported for this field.",
    video_reference_unsupported: "The selected model doesn't support video references. Remove the reference clip or pick another model.",
    audio_reference_unsupported: "The selected model doesn't support voice references. Remove the audio reference or pick another model.",
    composite_generation_required: "Prepare the presenter reference before generating this shot.",
    composition_provider_unavailable: "Presenter reference generation isn't available right now. Please try again.",
    native_audio_missing: "The generated clip has no audible speech. Retry the shot.",
    native_audio_silent: "The generated clip's speech is silent. Retry the shot.",
    generated_speech_differs_from_script: "The spoken audio didn't match the script. Retry the shot.",
    speech_timing_failed: "Caption timing failed for this clip. Render without captions or retry.",
    speech_timing_invalid: "Caption timing isn't valid for this clip. Render without captions.",
    caption_data_missing: "Caption data is missing. Render without captions or retry the shot.",
    caption_line_invalid: "One caption line is invalid. Edit your captions and try again.",
    caption_lines_invalid: "The caption text is invalid. Edit your captions and try again.",
    caption_patch_invalid: "That caption edit isn't valid. Re-check it and try again.",
    caption_timing_invalid: "Caption timings are invalid. Edit your captions and try again.",
    caption_render_stale: "Your captions changed after the video was prepared. Render again.",
    subtitle_invalid: "The subtitle text is invalid. Edit it and try again.",
    subtitle_style_invalid: "That subtitle style isn't available. Pick another one.",
    subtitle_timing_invalid: "Subtitle timings are invalid. Edit them and try again.",
    subtitle_crosses_shot: "A subtitle crosses a shot boundary. Shorten it and try again.",
    clip_not_owned: "A source clip is no longer available. Re-select it before rendering.",
    clip_media_invalid: "A source clip can't be used anymore. Re-select it before rendering.",
    clip_duration_too_short: "A source clip is too short for the timeline. Re-select it.",
    final_duration_mismatch: "The stitched video doesn't match the planned length. Render again.",
    timeline_discontinuous: "The timeline has a gap. Reorder your clips and try again.",
    timeline_duration_mismatch: "The timeline doesn't match the planned length. Adjust your clips and try again.",
    locked_timeline_duration_conflict: "The locked timeline length conflicts with your clips. Adjust them and try again.",
    ffmpeg_unavailable: "Video stitching is temporarily unavailable. Please try again shortly.",
    output_missing: "The finished file is temporarily unavailable. Please render again.",
    output_unavailable: "The finished file is temporarily unavailable. Please render again.",
    output_stale: "This render used outdated sources. Render again with the latest clips.",
    output_not_found: "The finished file is no longer available. Render again.",
    music_file_required: "Add a music file first.",
    music_file_too_large: "That music file is too large. Use a smaller file.",
    music_file_type_unsupported: "That music file type isn't supported. Try another audio file.",
    music_file_invalid: "That music file can't be used. Try another file.",
    music_not_owned: "Choose music uploaded to your own account.",
    music_asset_not_owned: "Choose music uploaded to your own account.",
    music_license_required: "Confirm the music license before using this track.",
    music_license_changed: "The license for this track changed. Review it before using the track.",
    music_ads_license_required: "Advertising use needs a confirmed license for this track.",
    music_source_missing: "The selected music is no longer available. Choose another track.",
    music_source_conflict: "Another change to the music is in progress. Refresh and try again.",
    music_url_invalid: "That music link isn't valid. Check it and try again.",
    music_track_not_found: "This track is no longer available. Choose another one.",
    music_usage_invalid: "This track can't be used in this video. Choose another one.",
    music_generation_not_configured: "Music generation isn't connected yet.",
    music_generation_not_ready: "Your music is still being generated. Wait a moment and try again.",
    music_generation_prompt_invalid: "Describe the music you want in a short prompt and try again.",
    music_generation_duration_invalid: "Choose a supported music length and try again.",
    music_generation_job_not_found: "This music request is no longer available. Start it again.",
    music_generation_task_not_owned: "This music request isn't on your account.",
    request_too_large: "That upload is too large. Use a smaller file.",
    product_brief_confirmation_required: "Confirm the imported product details before generating.",
    product_brief_invalid: "The imported product details are incomplete. Re-import the product page.",
    storyboard_facts_invalid: "The generated script didn't pass fact checks against your product details. Retry or clarify your details.",
    shot_count_invalid: "The storyboard came back with an unexpected structure. Please retry.",
    quote_secret_required: "Generation pricing is temporarily unavailable. Please try again shortly."
  };
  return messages[code] ?? messages[code.replace(/^workspace_/, "")] ?? (code.includes("_") ? "This request couldn't be completed with the current settings. Review your details and try again." : code);
}

function displayModel(model: string) {
  const normalized = model.toLowerCase();
  if (normalized.includes("grok")) return normalized.includes("video") ? "Grok Video" : normalized.includes("1.5") ? "Grok Imagine 1.5" : "Grok Imagine";
  if (normalized.includes("seedance")) return "Seedance";
  if (normalized.includes("gemini")) return "Gemini Video";
  if (normalized.includes("veo")) return "Veo";
  if (normalized.includes("wan")) return "Wan Video";
  if (normalized.includes("kling")) return "Kling Video";
  if (normalized.includes("sora")) return "Sora";
  return "Video model";
}
