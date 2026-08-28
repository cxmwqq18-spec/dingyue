"use client";

import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Film, ImagePlus, Monitor, Search, Send, Sparkles, X } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import type { PublicCustomer, VideoTheme, VideoThemeCategory, VideoThemeExample } from "@/lib/types";
import {
  AUTO_VIDEO_MODEL_FAMILY,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_RESOLUTION,
  CUSTOMER_VIDEO_FRAME_LIMIT,
  normalizeVideoDurationSecondsForFrameCount,
  trimVideoFrameSelection,
  videoDurationCreditCostForModelFamilies,
  videoDurationOptionsForFrameCount,
  type VideoDurationSeconds,
  type VideoResolution
} from "@/lib/video-frame-config";
import {
  isGeminiVideoFrameMimeType
} from "@/lib/video-provider-policy";

type SubscriptionStatus = "loading" | "active" | "required" | "admin";
type VideoAspectRatio = "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
type CreatedVideoJobFeedback = {
  customerBalance?: PublicCustomer["balance"];
};
export type VideoRetryDraft = {
  key: string;
  sourceJobId: string;
  frameAssetIds: string[];
  videoThemeId?: string;
  promptNote?: string;
  durationSeconds?: number;
  videoModelFamily?: string;
  aspectRatio?: string;
  resolution?: string;
  restoreMessage?: string;
};
type SelectedVideoFrameInfo = {
  id: string;
  label?: string;
  mimeType?: string;
};
type VideoPromptRiskMessage = {
  id: string;
  severity: "block" | "warn";
  message: string;
};

const VIDEO_ASPECT_OPTIONS: Array<{ id: VideoAspectRatio; label: string; shape: string }> = [
  { id: "16:9", label: "16:9", shape: "aspect-[16/9] w-7" },
  { id: "4:3", label: "4:3", shape: "aspect-[4/3] w-6" },
  { id: "1:1", label: "1:1", shape: "aspect-square w-5" },
  { id: "3:4", label: "3:4", shape: "aspect-[3/4] h-6" },
  { id: "9:16", label: "9:16", shape: "aspect-[9/16] h-7" }
];

const VIDEO_RESOLUTION_OPTIONS: Array<{ id: VideoResolution; label: string }> = [
  { id: DEFAULT_VIDEO_RESOLUTION, label: "720P" }
];

const PROMPT_DIRECTED_VIDEO_THEME_SLUG = "prompt-directed-motion";
const VIDEO_PROMPT_MAX_LENGTH = 5000;
const VIDEO_PROMPT_TEMPLATE = [
  "Step 1: Describe the main subject or product. Include what should stay consistent from uploaded frame images.",
  "",
  "Step 2: Set the scene and visual style. Mention location, lighting, mood, aspect ratio, and whether it should feel like UGC, cinematic, travel, or product video.",
  "",
  "Step 3: Define the motion. Explain the first 0-3 second hook, the main action, camera movement, and the final frame.",
  "",
  "Step 4: Add audio and safety constraints. Include dialogue, ambient sound, and what to avoid: extra people, warped hands, product drift, text, watermarks, or unsafe content."
].join("\n");

function vt(spanish: boolean, english: string, spanishText: string) {
  return spanish ? spanishText : english;
}

function defaultVideoTheme(themes: VideoTheme[]): VideoTheme | undefined {
  return themes.find((theme) => theme.slug === PROMPT_DIRECTED_VIDEO_THEME_SLUG) ??
    themes.find((theme) => theme.slug === "cinematic-portrait-motion") ??
    themes.find((theme) => theme.category?.slug === "portrait-motion") ??
    themes[0];
}

function errorText(error: string | undefined, status: number, spanish: boolean) {
  if (status === 401 || error === "customer_login_required") return vt(spanish, "Please sign in again before generating video.", "Vuelve a iniciar sesion antes de generar video.");
  if (status === 403 || error?.includes("csrf")) return vt(spanish, "Your secure session expired. Refresh the page, then try again.", "Tu sesion segura expiro. Actualiza la pagina e intentalo de nuevo.");
  if (error === "subscription_required") return vt(spanish, "Choose a subscription or use enough credits before generating video.", "Elige una suscripcion o usa creditos suficientes antes de generar video.");
  if (error === "insufficient_credits") return vt(spanish, "Not enough credits for this video theme.", "No hay creditos suficientes para este tema de video.");
  if (error === "video_theme_required") return vt(spanish, "Video presets are still loading. Try again in a moment.", "Los ajustes de video aun se estan cargando. Intentalo en un momento.");
  if (error === "ai_app_not_enabled_for_site") return vt(spanish, "Video generation is not enabled for this site right now. Provider access is being updated. No credits were reserved.", "La generacion de video no esta habilitada para este sitio ahora. Se esta actualizando el acceso del proveedor. No se reservaron creditos.");
  if (error === "video_frames_required" || error === "video_prompt_required") return vt(spanish, "Describe the video or select at least one frame image.", "Describe el video o selecciona al menos una imagen de fotograma.");
  if (error === "video_frame_selection_required") return vt(spanish, "Your prompt refers to uploaded images. Select frame images on the left before generating image-to-video.", "Tu prompt menciona imagenes subidas. Selecciona fotogramas a la izquierda antes de generar imagen a video.");
  if (error === "too_many_video_frames") return vt(spanish, "This theme allows fewer frame images.", "Este tema permite menos imagenes de fotograma.");
  if (error === "too_many_video_frames_for_provider") return vt(spanish, "This video preset allows fewer frame images. Remove extra frames and try again.", "Este ajuste de video permite menos fotogramas. Quita fotogramas extra e intentalo de nuevo.");
  if (error === "video_frame_asset_required") return vt(spanish, "Use images uploaded in the video frame area before generating.", "Usa imagenes subidas en el area de fotogramas antes de generar.");
  if (error === "unsupported_video_frame_type") return vt(spanish, "Video references need JPG or PNG frame images.", "Las referencias de video necesitan fotogramas JPG o PNG.");
  if (error === "video_public_asset_url_required") return vt(spanish, "Video generation needs a public asset URL so the provider can read the selected frame images.", "La generacion de video necesita una URL publica de recursos para que el proveedor lea los fotogramas seleccionados.");
  if (error === "video_provider_temporarily_unavailable" || error === "no_video_ai_provider_configured") return vt(spanish, "Video generation is not available right now. Provider access is being updated. No credits were reserved.", "La generacion de video no esta disponible ahora. Se esta actualizando el acceso del proveedor. No se reservaron creditos.");
  if (error === "missing_required_prompt_input") return vt(spanish, "Complete the required prompt details before generating video.", "Completa los detalles requeridos del prompt antes de generar video.");
  if (status === 409) return vt(spanish, "Another request is already running. Check the All tab before starting a new one.", "Ya hay otra solicitud en ejecucion. Revisa la pestana Todo antes de iniciar otra.");
  return vt(spanish, "Video generation could not start. Please check the frame images and try again.", "No se pudo iniciar el video. Revisa las imagenes e intentalo de nuevo.");
}

function isCsrfError(error: string | undefined, status: number) {
  return status === 403 && (error === "csrf_token_required" || error === "csrf_token_mismatch" || Boolean(error?.includes("csrf")));
}

function videoDurationCostForCandidateFamilies(
  theme: Pick<VideoTheme, "creditCost" | "modelPricing">,
  seconds: unknown,
  modelFamilies?: VideoTheme["providerModelFamilies"]
): number {
  if (modelFamilies && !modelFamilies.length) return 0;
  return videoDurationCreditCostForModelFamilies(theme.creditCost, seconds, modelFamilies, theme.modelPricing);
}

function newVideoSubmitIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `video_${crypto.randomUUID()}`;
  return `video_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function isVideoAspectRatio(value: string | undefined): value is VideoAspectRatio {
  return VIDEO_ASPECT_OPTIONS.some((option) => option.id === value);
}

function isVideoResolution(value: string | undefined): value is VideoResolution {
  return VIDEO_RESOLUTION_OPTIONS.some((option) => option.id === value);
}

const NEGATED_PROMPT_CUE_PATTERN = /\b(avoid|without|no|not|never|exclude|remove|do not|don't|dont)\b|evita|sin|\u907f\u514d|\u4e0d\u8981|\u4e0d\u9700\u8981|\u4e0d\u51fa\u73b0|\u65e0|\u6ca1\u6709|\u6392\u9664/i;
const PEOPLE_REFERENCE_PROMPT_PATTERN = /\b(baby|infant|toddler|child|children|kid|kids|minor|boy|girl|person|people|human|face|portrait|selfie|man|woman|family|couple)\b|bebe|nino|nina|persona|retrato|familia|pareja|\u5a74\u513f|\u5b9d\u5b9d|\u5c0f\u5b69|\u5b69\u5b50|\u513f\u7ae5|\u672a\u6210\u5e74|\u7537\u5b69|\u5973\u5b69|\u4eba\u50cf|\u771f\u4eba|\u8138|\u5bb6\u4eba|\u5bb6\u5ead|\u60c5\u4fa3/gi;
const MINOR_PROMPT_PATTERN = /\b(baby|infant|toddler|child|children|kid|kids|minor|underage|boy|girl)\b|bebe|nino|nina|menor|\u5a74\u513f|\u5b9d\u5b9d|\u5c0f\u5b69|\u5b69\u5b50|\u513f\u7ae5|\u672a\u6210\u5e74|\u7537\u5b69|\u5973\u5b69|\u5e7c\u513f/gi;
const UNSAFE_CONTENT_PROMPT_PATTERN = /\b(nude|nudity|nsfw|porn|sexual|erotic|lingerie|underwear|violence|violent|blood|bloody|gore|weapon|gun|knife|self-harm|suicide|hate|illegal)\b|\u88f8\u9732|\u88f8\u4f53|\u8272\u60c5|\u6027\u611f|\u66b4\u529b|\u8840\u8165|\u6b66\u5668|\u67aa|\u5200|\u81ea\u6b8b|\u81ea\u6740|\u4ec7\u6068|\u8fdd\u6cd5/gi;
const RIGHTS_PROMPT_PATTERN = /\b(celebrity|public figure|famous actor|famous singer|copyright|trademark|branded character|anime character|game character|comic character|logo|watermark|large text|text-heavy|subtitle|caption)\b|\u540d\u4eba|\u516c\u4f17\u4eba\u7269|\u660e\u661f|\u7248\u6743|\u5546\u6807|\u52a8\u6f2b\u89d2\u8272|\u6e38\u620f\u89d2\u8272|\u6f2b\u753b\u89d2\u8272|\u6807\u5fd7|\u6c34\u5370|\u5927\u6bb5\u6587\u5b57|\u5b57\u5e55/gi;
const POSITIVE_PROMPT_CUE_AFTER_NEGATION_PATTERN = /\b(add|include|show|display|with|featuring|using|create|make|generate|turn into|transform into)\b|agrega|incluye|muestra|con|\u6dfb\u52a0|\u5305\u542b|\u51fa\u73b0|\u663e\u793a|\u751f\u6210|\u4f7f\u7528/i;

function promptClauseNegatesMatch(clauseBeforeMatch: string) {
  const negationMatcher = new RegExp(NEGATED_PROMPT_CUE_PATTERN.source, "gi");
  const matches = Array.from(clauseBeforeMatch.matchAll(negationMatcher));
  const lastNegation = matches.at(-1);
  if (!lastNegation) return false;
  const afterNegation = clauseBeforeMatch.slice((lastNegation.index ?? 0) + lastNegation[0].length);
  return !POSITIVE_PROMPT_CUE_AFTER_NEGATION_PATTERN.test(afterNegation);
}

function promptHasNonNegatedMatch(value: string, pattern: RegExp) {
  const text = value.toLowerCase();
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags);
  for (const match of text.matchAll(matcher)) {
    const start = match.index ?? 0;
    const before = text.slice(Math.max(0, start - 96), start);
    const clauseBeforeMatch = before.split(/[.!?\n;\u3002\uff01\uff1f\uff1b]/).pop() ?? before;
    if (!promptClauseNegatesMatch(clauseBeforeMatch)) return true;
  }
  return false;
}

function promptSuggestsPeopleReference(value: string) {
  return promptHasNonNegatedMatch(value, PEOPLE_REFERENCE_PROMPT_PATTERN);
}

function videoAspectOrientation(aspectRatio: VideoAspectRatio): "landscape" | "portrait" | "square" {
  const [width, height] = aspectRatio.split(":").map((part) => Number(part));
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "square";
}

function promptMentionedAspectRatios(value: string) {
  const matches: string[] = [];
  const matcher = /\b(\d{1,2}\s*:\s*\d{1,2})\b/g;
  for (const match of value.matchAll(matcher)) {
    const start = match.index ?? 0;
    const before = value.slice(Math.max(0, start - 96), start);
    const clauseBeforeMatch = before.split(/[.!?\n;\u3002\uff01\uff1f\uff1b]/).pop() ?? before;
    if (promptClauseNegatesMatch(clauseBeforeMatch)) continue;
    matches.push(match[1].replace(/\s+/g, ""));
  }
  return Array.from(new Set(matches));
}

function promptFormatConflictMessage(params: {
  aspectRatio: VideoAspectRatio;
  prompt: string;
  spanish: boolean;
}): string {
  const selectedOrientation = videoAspectOrientation(params.aspectRatio);
  const mentionsLandscape = promptHasNonNegatedMatch(params.prompt, /\b(horizontal|landscape|wide|widescreen)\b|\u6a2a\u5c4f|\u6a2a\u7248/gi);
  const mentionsPortrait = promptHasNonNegatedMatch(params.prompt, /\b(vertical|portrait)\b|\u7ad6\u5c4f|\u7ad6\u7248/gi);
  const mentionedRatios = promptMentionedAspectRatios(params.prompt).filter((ratio) => ratio !== params.aspectRatio);
  const ratioConflict = mentionedRatios[0];
  const orientationConflict =
    (selectedOrientation === "portrait" && mentionsLandscape) ||
    (selectedOrientation === "landscape" && mentionsPortrait);
  if (!ratioConflict && !orientationConflict) return "";
  const conflictLabel = ratioConflict
    ? vt(params.spanish, ` ${ratioConflict}`, ` ${ratioConflict}`)
    : mentionsLandscape
      ? vt(params.spanish, " horizontal/landscape", " horizontal/paisaje")
      : vt(params.spanish, " vertical/portrait", " vertical/retrato");
  return vt(
    params.spanish,
    `Your prompt mentions${conflictLabel}, but the selected video format is ${params.aspectRatio}. The selected format will be sent to the provider; switch the aspect ratio or edit the prompt if needed.`,
    `Tu prompt menciona${conflictLabel}, pero el formato seleccionado es ${params.aspectRatio}. El formato seleccionado se enviara al proveedor; cambia la relacion de aspecto o edita el prompt si hace falta.`
  );
}

function videoPromptRequiresFrameImages(prompt: string): boolean {
  const text = prompt.trim().toLowerCase();
  if (!text) return false;
  return /\u4e0a\u4f20.{0,12}(\u56fe\u7247|\u7167\u7247|\u56fe\u50cf|\u7d20\u6750|\u53c2\u8003\u56fe)|\u6839\u636e.{0,12}(\u56fe\u7247|\u7167\u7247|\u56fe\u50cf|\u7d20\u6750|\u53c2\u8003\u56fe)|\u8fd9(\u5f20|\u4e2a|\u4e9b).{0,8}(\u56fe\u7247|\u7167\u7247|\u56fe\u50cf|\u7d20\u6750|\u53c2\u8003\u56fe)|\u56fe\u4e2d|\u7167\u7247\u4e2d|uploaded.{0,24}(image|photo|frame|picture)|selected.{0,24}(image|photo|frame|picture)|reference.{0,24}(image|photo|frame|picture)|source.{0,24}(image|photo|frame|picture)/i.test(text);
}

function videoPromptRiskMessages(params: {
  aspectRatio: VideoAspectRatio;
  prompt: string;
  selectedFrameCount: number;
  spanish: boolean;
}): VideoPromptRiskMessage[] {
  const prompt = params.prompt.trim();
  if (!prompt) return [];
  const messages: VideoPromptRiskMessage[] = [];
  if (videoPromptRequiresFrameImages(prompt) && params.selectedFrameCount < 1) {
    messages.push({
      id: "missing_prompt_referenced_frames",
      severity: "block",
      message: vt(
        params.spanish,
        "Your prompt says to use uploaded, selected, source, or reference images, but no frame image is selected. Select frame images on the left, or remove that image-reference wording.",
        "Tu prompt menciona imagenes subidas, seleccionadas, de origen o de referencia, pero no hay fotogramas seleccionados. Selecciona fotogramas a la izquierda o elimina esa referencia del prompt."
      )
    });
  }
  const formatConflictMessage = promptFormatConflictMessage({
    aspectRatio: params.aspectRatio,
    prompt,
    spanish: params.spanish
  });
  if (formatConflictMessage) {
    messages.push({
      id: "prompt_format_conflict",
      severity: "warn",
      message: formatConflictMessage
    });
  }
  if (params.selectedFrameCount > 0 && promptSuggestsPeopleReference(prompt)) {
    messages.push({
      id: "people_reference",
      severity: "warn",
      message: vt(
        params.spanish,
        "Video providers may reject real or recognizable people in frame references. Product, object, landscape, pet, fictional, or stylized references are usually easier to process.",
        "Los proveedores de video pueden rechazar personas reales o reconocibles en referencias. Productos, objetos, paisajes, mascotas o referencias ficticias/estilizadas suelen procesarse mejor."
      )
    });
  }
  if (promptHasNonNegatedMatch(prompt, MINOR_PROMPT_PATTERN)) {
    messages.push({
      id: "minor_policy_risk",
      severity: "warn",
      message: vt(
        params.spanish,
        "Risk: providers often reject prompts involving children, babies, or minors. Use adult-only, fictional/stylized, or non-person references where possible.",
        "Riesgo: los proveedores suelen rechazar prompts con ninos, bebes o menores. Usa referencias solo de adultos, ficticias/estilizadas o sin personas cuando sea posible."
      )
    });
  }
  if (promptHasNonNegatedMatch(prompt, UNSAFE_CONTENT_PROMPT_PATTERN)) {
    messages.push({
      id: "unsafe_content_policy_risk",
      severity: "warn",
      message: vt(
        params.spanish,
        "Risk: sexual content, nudity, violence, weapons, gore, self-harm, hate, or illegal activity may be rejected. Remove those details before submitting.",
        "Riesgo: contenido sexual, desnudez, violencia, armas, sangre, autolesion, odio o actividad ilegal puede rechazarse. Quita esos detalles antes de enviar."
      )
    });
  }
  if (promptHasNonNegatedMatch(prompt, RIGHTS_PROMPT_PATTERN)) {
    messages.push({
      id: "rights_policy_risk",
      severity: "warn",
      message: vt(
        params.spanish,
        "Risk: celebrities, public figures, copyrighted characters, logos, watermarks, subtitles, or heavy visible text may be rejected. Use original, rights-safe references.",
        "Riesgo: celebridades, figuras publicas, personajes con copyright, logos, marcas de agua, subtitulos o mucho texto visible pueden rechazarse. Usa referencias originales y seguras por derechos."
      )
    });
  }
  return messages.slice(0, 4);
}

function isPromptFrameReferenceBlockingMessage(value: string) {
  return value.startsWith("Your prompt says to use uploaded") || value.startsWith("Tu prompt menciona imagenes subidas");
}

export function CustomerVideoWorkspace({
  customer,
  initialThemes = [],
  videoThemeCategories = [],
  onGenerationFailed,
  onGenerationStarted,
  onJobCreated,
  onPrepareVideoFrames,
  onOpenFrameManager,
  onRetryDraftApplied,
  readyFrameIds,
  retryDraft,
  selectedFrames = [],
  selectedFrameIds,
  setSelectedFrameIds,
  siteId,
  spanish = false,
  submissionPending = false,
  subscriptionStatus
}: {
  customer: PublicCustomer;
  siteId: string;
  subscriptionStatus: SubscriptionStatus;
  initialThemes?: VideoTheme[];
  videoThemeCategories?: VideoThemeCategory[];
  spanish?: boolean;
  submissionPending?: boolean;
  readyFrameIds?: string[];
  selectedFrameIds: string[];
  setSelectedFrameIds: Dispatch<SetStateAction<string[]>>;
  onGenerationFailed?: (message: string) => void;
  onGenerationStarted?: () => void;
  onJobCreated: (jobId: string, feedback?: CreatedVideoJobFeedback) => void;
  onPrepareVideoFrames?: (assetIds: string[]) => Promise<string[]>;
  onOpenFrameManager: () => void;
  onRetryDraftApplied?: () => void;
  retryDraft?: VideoRetryDraft | null;
  selectedFrames?: SelectedVideoFrameInfo[];
}) {
  const [themes, setThemes] = useState<VideoTheme[]>(() => initialThemes);
  const [selectedThemeId, setSelectedThemeId] = useState(() => defaultVideoTheme(initialThemes)?.id || "");
  const [selectedDurationSeconds, setSelectedDurationSeconds] = useState<VideoDurationSeconds>(DEFAULT_VIDEO_DURATION_SECONDS);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [selectedResolution, setSelectedResolution] = useState<VideoResolution>(DEFAULT_VIDEO_RESOLUTION);
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [promptNote, setPromptNote] = useState("");
  const [selectedThemeExampleId, setSelectedThemeExampleId] = useState("");
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [themePickerCategoryId, setThemePickerCategoryId] = useState("");
  const [themePickerThemeId, setThemePickerThemeId] = useState("");
  const [themePickerExampleId, setThemePickerExampleId] = useState("");
  const [themePickerPrompt, setThemePickerPrompt] = useState("");
  const [themePickerSearch, setThemePickerSearch] = useState("");
  const [expandedThemeCategoryIds, setExpandedThemeCategoryIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [themeReloadKey, setThemeReloadKey] = useState(0);
  const [textToVideoConfirmArmed, setTextToVideoConfirmArmed] = useState(false);
  const [textToVideoConfirmOpen, setTextToVideoConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const appliedRetryDraftKeyRef = useRef<string | null>(null);
  const retryDurationThemeIdRef = useRef<string | null>(null);
  const submitAttemptRef = useRef<{ fingerprint: string; idempotencyKey: string } | null>(null);

  useEffect(() => {
    if (!initialThemes.length) return;
    setThemes((current) => current.length ? current : initialThemes);
    setSelectedThemeId((current) => current || defaultVideoTheme(initialThemes)?.id || "");
  }, [initialThemes]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadThemes() {
      try {
        const response = await fetch(`/api/sites/${siteId}/video-themes?includeCategories=1&pageSize=100`, {
          cache: "no-store",
          signal: controller.signal
        });
        const payload = (await response.json().catch(() => ({}))) as {
          themes?: VideoTheme[];
        };
        if (!response.ok) throw new Error("video_themes_unavailable");
        const nextThemes = payload.themes ?? [];
        if (nextThemes.length) {
          setThemes(nextThemes);
          setSelectedThemeId((current) => {
            if (!current || !nextThemes.some((theme) => theme.id === current)) return defaultVideoTheme(nextThemes)?.id || current || "";
            return current;
          });
        }
        if (!nextThemes.length) {
          setMessage((current) => initialThemes.length ? current : vt(spanish, "No active video presets are available yet.", "Aun no hay ajustes de video activos."));
        }
      } catch {
        if (!controller.signal.aborted) {
          setMessage((current) => initialThemes.length ? current : vt(spanish, "Video presets could not load. Refresh this page and try again.", "No se pudieron cargar los ajustes de video. Actualiza la pagina e intentalo de nuevo."));
        }
      }
    }
    void loadThemes();
    return () => controller.abort();
  }, [initialThemes.length, siteId, spanish, themeReloadKey]);

  const selectedTheme = themes.find((theme) => theme.id === selectedThemeId) ?? defaultVideoTheme(themes);
  const configuredThemeCategories = videoThemeCategories.filter((category) => category.status === "active");
  const fallbackThemeCategories = Array.from(new Map(themes.filter((theme) => theme.category).map((theme) => [theme.category!.id, theme.category!])).values());
  const allThemeCategories = configuredThemeCategories.length ? configuredThemeCategories : fallbackThemeCategories;
  const themeCategoryById = useMemo(() => new Map(allThemeCategories.map((category) => [category.id, category])), [allThemeCategories]);
  const rootThemeCategories = allThemeCategories.filter((category) => !category.parentId).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  const childThemeCategories = allThemeCategories.filter((category) => Boolean(category.parentId)).sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
  const selectedThemeCategory = selectedTheme?.category
    ? themeCategoryById.get(selectedTheme.category.id) ?? selectedTheme.category
    : undefined;
  const pickerCategory = themeCategoryById.get(themePickerCategoryId) ?? selectedThemeCategory ?? rootThemeCategories[0];
  const pickerRootCategory = pickerCategory?.parentId ? themeCategoryById.get(pickerCategory.parentId) ?? pickerCategory : pickerCategory;
  const pickerSearch = themePickerSearch.trim().toLowerCase();
  const pickerThemes = useMemo(() => themes.filter((theme) => {
    const category = theme.category;
    const root = category?.parentId ? themeCategoryById.get(category.parentId) : category;
    const haystack = [theme.name, theme.headline, theme.description, category?.label, root?.label].filter(Boolean).join(" ").toLowerCase();
    // Searching is global across the taxonomy. Without a query, keep the selected root/child scope.
    if (pickerSearch) return haystack.includes(pickerSearch);
    return !pickerCategory || pickerCategory.id === root?.id || pickerCategory.id === category?.id;
  }), [pickerCategory, pickerSearch, themeCategoryById, themes]);
  const pickerTheme = pickerThemes.find((theme) => theme.id === themePickerThemeId) ?? (pickerSearch ? undefined : pickerThemes[0]);
  const pickerExamples = pickerTheme?.examples?.length ? pickerTheme.examples : pickerTheme ? [{
    id: `fallback-${pickerTheme.id}`,
    siteId: pickerTheme.siteId,
    themeId: pickerTheme.id,
    name: `${pickerTheme.name} reference`,
    description: pickerTheme.description,
    imageUrl: pickerTheme.imageUrl,
    galleryImages: pickerTheme.galleryImages,
    prompt: pickerTheme.prompt,
    status: "active" as const,
    sortOrder: 0,
    createdAt: pickerTheme.createdAt
  }] : [];
  const pickerExample = pickerExamples.find((example) => example.id === themePickerExampleId) ?? pickerExamples[0];
  const selectedThemeExample = selectedTheme?.examples?.find((example) => example.id === selectedThemeExampleId);
  const maxFrames = CUSTOMER_VIDEO_FRAME_LIMIT;
  const selectedProviderModelFamilies = selectedFrameIds.length
    ? selectedTheme?.imageToVideoProviderModelFamilies
    : selectedTheme?.textToVideoProviderModelFamilies;
  const selectedPricingModelFamilies = selectedProviderModelFamilies ?? selectedTheme?.providerModelFamilies;
  const availableDurationOptions = videoDurationOptionsForFrameCount(
    selectedFrameIds.length,
    AUTO_VIDEO_MODEL_FAMILY
  );
  const effectiveDurationSeconds = normalizeVideoDurationSecondsForFrameCount(
    selectedDurationSeconds,
    selectedFrameIds.length,
    selectedTheme?.durationSeconds,
    AUTO_VIDEO_MODEL_FAMILY
  );
  const providerFrameLimitMessage = maxFrames > 1
    ? vt(spanish, `Selected frames are treated as ordered reference images for image-to-video.`, `Los fotogramas seleccionados se tratan como imagenes de referencia ordenadas para imagen a video.`)
    : "";
  const selectedCreditCost = selectedTheme
    ? selectedPricingModelFamilies
      ? videoDurationCostForCandidateFamilies(selectedTheme, effectiveDurationSeconds, selectedPricingModelFamilies)
      : videoDurationCostForCandidateFamilies(selectedTheme, effectiveDurationSeconds)
    : 0;
  const hasCreditsForSelectedVideo = selectedCreditCost > 0 && selectedCreditCost <= customer.balance.available;
  const generationFrameIds = readyFrameIds ?? selectedFrameIds;
  let submitFrameIds = generationFrameIds;
  const hasPendingFrameUploads = generationFrameIds.length !== selectedFrameIds.length;
  const trimmedPromptNote = promptNote.trim();
  const hasReadyFrameInput = generationFrameIds.length > 0;
  const hasSelectedFrameInput = selectedFrameIds.length > 0;
  const isTextToVideo = selectedFrameIds.length === 0;
  const selectedFrameInfoById = new Map(selectedFrames.map((frame) => [frame.id, frame]));
  const unsupportedVideoFrames = generationFrameIds
    .map((assetId) => selectedFrameInfoById.get(assetId))
    .filter((frame): frame is SelectedVideoFrameInfo => {
      if (!frame) return false;
      return !isGeminiVideoFrameMimeType(frame.mimeType);
    });
  const unsupportedVideoFrameMessage = unsupportedVideoFrames.length
    ? vt(
        spanish,
        `${unsupportedVideoFrames.length === 1 ? "This selected frame will" : "These selected frames will"} be converted to JPG before generation.`,
        `${unsupportedVideoFrames.length === 1 ? "Este fotograma seleccionado se convertira" : "Estos fotogramas seleccionados se convertiran"} a JPG antes de generar.`
      )
    : "";
  const needsTextToVideoConfirmation = isTextToVideo && trimmedPromptNote.length > 0;
  const textToVideoConfirmationMessage = vt(
    spanish,
    "No frame images are selected. This will run as text-to-video and follow only your written prompt. Select frame images on the left for image-to-video, or continue only if you want a prompt-only result.",
    "No hay fotogramas seleccionados. Esto se ejecutara como texto a video y seguira solo tu prompt escrito. Selecciona fotogramas a la izquierda para imagen a video, o continua solo si quieres un resultado solo con prompt."
  );
  const promptRiskMessages = videoPromptRiskMessages({
    aspectRatio: selectedAspectRatio,
    prompt: trimmedPromptNote,
    selectedFrameCount: selectedFrameIds.length,
    spanish
  });
  const blockingPromptRisk = promptRiskMessages.find((risk) => risk.severity === "block");
  const blockingPromptRiskMessage = blockingPromptRisk?.message ?? "";
  const isSubmitting = pending || submissionPending;
  const generateButtonLabel = isSubmitting
    ? vt(spanish, "Starting", "Iniciando")
    : textToVideoConfirmArmed && needsTextToVideoConfirmation
      ? vt(spanish, "Generate text-to-video", "Generar texto a video")
      : vt(spanish, "Generate video", "Generar video");
  const canGenerateCurrentVideo = hasSelectedFrameInput || hasReadyFrameInput || trimmedPromptNote.length > 0;

  useEffect(() => {
    if (!retryDraft || appliedRetryDraftKeyRef.current === retryDraft.key) return;
    const restoredTheme = retryDraft.videoThemeId
      ? themes.find((theme) => theme.id === retryDraft.videoThemeId)
      : undefined;
    const restoredThemeId = restoredTheme?.id ?? retryDraft.videoThemeId;
    const restoredMaxFrames = CUSTOMER_VIDEO_FRAME_LIMIT;
    const restoredFrameIds = trimVideoFrameSelection(retryDraft.frameAssetIds, restoredMaxFrames);
    setSelectedFrameIds(restoredFrameIds);
    if (restoredThemeId) setSelectedThemeId(restoredThemeId);
    setSelectedDurationSeconds(normalizeVideoDurationSecondsForFrameCount(
      retryDraft.durationSeconds,
      restoredFrameIds.length,
      undefined,
      AUTO_VIDEO_MODEL_FAMILY
    ));
    if (retryDraft.durationSeconds !== undefined && restoredThemeId) retryDurationThemeIdRef.current = restoredThemeId;
    if (isVideoAspectRatio(retryDraft.aspectRatio)) setSelectedAspectRatio(retryDraft.aspectRatio);
    if (isVideoResolution(retryDraft.resolution)) setSelectedResolution(retryDraft.resolution);
    setPromptNote(retryDraft.promptNote ?? "");
    setFormatPanelOpen(false);
    setMessage(retryDraft.restoreMessage ?? vt(spanish, "Previous video request restored. Review it, then generate again.", "Solicitud de video anterior restaurada. Revisala y vuelve a generar."));
    appliedRetryDraftKeyRef.current = retryDraft.key;
    onRetryDraftApplied?.();
  }, [onRetryDraftApplied, retryDraft, setSelectedFrameIds, spanish, themes]);

  useEffect(() => {
    if (!selectedTheme) return;
    if (retryDurationThemeIdRef.current === selectedTheme.id) {
      retryDurationThemeIdRef.current = null;
      return;
    }
    setSelectedDurationSeconds(normalizeVideoDurationSecondsForFrameCount(
      selectedDurationSeconds,
      selectedFrameIds.length,
      selectedTheme.durationSeconds,
      AUTO_VIDEO_MODEL_FAMILY
    ));
  }, [selectedDurationSeconds, selectedFrameIds.length, selectedTheme]);

  useEffect(() => {
    if (selectedFrameIds.length > maxFrames) setSelectedFrameIds((current) => trimVideoFrameSelection(current, maxFrames));
  }, [maxFrames, selectedFrameIds.length, setSelectedFrameIds]);

  useEffect(() => {
    if (needsTextToVideoConfirmation) return;
    setTextToVideoConfirmArmed(false);
    setTextToVideoConfirmOpen(false);
    setMessage((current) => current === textToVideoConfirmationMessage ? "" : current);
  }, [needsTextToVideoConfirmation, textToVideoConfirmationMessage]);

  useEffect(() => {
    if (blockingPromptRiskMessage) return;
    setMessage((current) => isPromptFrameReferenceBlockingMessage(current) ? "" : current);
  }, [blockingPromptRiskMessage]);

  useEffect(() => {
    if (selectedDurationSeconds !== effectiveDurationSeconds) {
      setSelectedDurationSeconds(effectiveDurationSeconds);
    }
  }, [effectiveDurationSeconds, selectedDurationSeconds]);

  function chooseFrameImagesForVideo() {
    setTextToVideoConfirmOpen(false);
    setTextToVideoConfirmArmed(false);
    setMessage(vt(spanish, "Select frame images on the left, then generate image-to-video.", "Selecciona fotogramas a la izquierda y luego genera imagen a video."));
    onOpenFrameManager();
  }

  function applyVideoPromptTemplate() {
    setPromptNote(VIDEO_PROMPT_TEMPLATE);
    setTextToVideoConfirmArmed(false);
    setTextToVideoConfirmOpen(false);
    setMessage("Template added. Edit each step, then generate your video.");
  }

  function openThemePicker() {
    const category = selectedThemeCategory ?? rootThemeCategories[0];
    const theme = selectedTheme ?? themes[0];
    const example = selectedThemeExample ?? theme?.examples?.[0];
    setThemePickerCategoryId(category?.id ?? "");
    setThemePickerThemeId(theme?.id ?? "");
    setThemePickerExampleId(example?.id ?? "");
    setThemePickerPrompt(example?.prompt ?? theme?.prompt ?? "");
    setThemePickerSearch("");
    const rootId = category?.parentId ?? category?.id;
    setExpandedThemeCategoryIds(rootId ? [rootId] : []);
    setThemePickerOpen(true);
  }

  function choosePickerTheme(theme: VideoTheme) {
    const example = theme.examples?.[0];
    if (theme.category) {
      setThemePickerCategoryId(theme.category.id);
      const rootId = theme.category.parentId ?? theme.category.id;
      setExpandedThemeCategoryIds((current) => current.includes(rootId) ? current : [...current, rootId]);
    }
    setThemePickerThemeId(theme.id);
    setThemePickerExampleId(example?.id ?? "");
    setThemePickerPrompt(example?.prompt ?? theme.prompt);
  }

  function choosePickerCategory(category: VideoThemeCategory) {
    setThemePickerCategoryId(category.id);
    const firstTheme = themes.find((theme) => {
      if (category.parentId) return theme.category?.id === category.id;
      return theme.category?.id === category.id || theme.category?.parentId === category.id;
    });
    if (firstTheme) choosePickerTheme(firstTheme);
  }

  function choosePickerExample(example: VideoThemeExample) {
    setThemePickerExampleId(example.id);
    setThemePickerPrompt(example.prompt);
  }

  function confirmThemePicker() {
    if (!pickerTheme) return;
    const persistedExample = pickerTheme.examples?.find((example) => example.id === pickerExample?.id);
    setSelectedThemeId(pickerTheme.id);
    // Synthetic compatibility cards are UI-only and must not be submitted as persisted IDs.
    setSelectedThemeExampleId(persistedExample?.id ?? "");
    setPromptNote(themePickerPrompt.trim());
    setThemePickerOpen(false);
    setMessage(vt(spanish, `Applied ${pickerTheme.name}${pickerExample ? ` / ${pickerExample.name}` : ""}. You can continue editing the prompt.`, `Se aplico ${pickerTheme.name}${pickerExample ? ` / ${pickerExample.name}` : ""}. Puedes seguir editando el prompt.`));
  }

  async function generateVideo(options: { confirmedTextToVideo?: boolean } = {}) {
    if (isSubmitting) return;
    if (!selectedTheme) {
      setThemeReloadKey((current) => current + 1);
      setMessage(vt(spanish, "Video presets are still loading. Try again in a moment.", "Los ajustes de video aun se estan cargando. Intentalo en un momento."));
      return;
    }
    if (!selectedFrameIds.length && !trimmedPromptNote) {
      setMessage(vt(spanish, "Describe the video you want, or select frame images on the left for image-to-video.", "Describe el video que quieres o selecciona fotogramas a la izquierda para imagen a video."));
      return;
    }
    if (blockingPromptRisk) {
      setTextToVideoConfirmArmed(false);
      setTextToVideoConfirmOpen(false);
      setMessage(blockingPromptRisk.message);
      return;
    }
    if (selectedFrameIds.length && (hasPendingFrameUploads || !generationFrameIds.length)) {
      setMessage(vt(spanish, "Frame uploads are still finishing. Generate after every selected frame is ready.", "Las subidas de fotogramas aun estan terminando. Genera cuando todos los fotogramas seleccionados esten listos."));
      return;
    }
    if (unsupportedVideoFrames.length) {
      if (!onPrepareVideoFrames) {
        setMessage(vt(spanish, "This selected frame is not ready for video. Re-upload it as JPG or PNG.", "Este fotograma no esta listo para video. Vuelve a subirlo como JPG o PNG."));
        return;
      }
      setPending(true);
      setMessage(vt(spanish, "Preparing the selected frame images for video...", "Preparando los fotogramas seleccionados para video..."));
      try {
        const normalizedFrameIds = await onPrepareVideoFrames(generationFrameIds);
        if (normalizedFrameIds.length !== generationFrameIds.length || normalizedFrameIds.some((assetId) => !assetId)) {
          throw new Error("video_frame_conversion_failed");
        }
        submitFrameIds = normalizedFrameIds;
        setSelectedFrameIds(normalizedFrameIds);
      } catch {
        setPending(false);
        setMessage(vt(spanish, "The selected frame could not be converted for video. Re-upload it as JPG or PNG.", "No se pudo convertir el fotograma para video. Vuelve a subirlo como JPG o PNG."));
        return;
      }
      setPending(false);
    }
    if (needsTextToVideoConfirmation && !options.confirmedTextToVideo) {
      setTextToVideoConfirmArmed(true);
      setTextToVideoConfirmOpen(true);
      setMessage(textToVideoConfirmationMessage);
      return;
    }
    if (subscriptionStatus === "loading") {
      setMessage(vt(spanish, "We are still checking your subscription. Try again in a moment.", "Aun estamos revisando tu suscripcion. Intentalo en un momento."));
      return;
    }
    if (subscriptionStatus === "required" && !hasCreditsForSelectedVideo) {
      setMessage(vt(spanish, "Choose a subscription or add enough credits before generating video.", "Elige una suscripcion o anade creditos suficientes antes de generar video."));
      return;
    }
    if (selectedCreditCost > customer.balance.available && subscriptionStatus !== "admin") {
      setMessage(vt(spanish, `This duration needs ${selectedCreditCost} credits, but ${customer.balance.available} are available.`, `Esta duracion necesita ${selectedCreditCost} creditos, pero hay ${customer.balance.available} disponibles.`));
      return;
    }
    setTextToVideoConfirmOpen(false);
    setPending(true);
    setMessage(vt(spanish, "Creating your video request and reserving credits...", "Creando tu solicitud de video y reservando creditos..."));
    onGenerationStarted?.();
    const requestBody = {
      customerId: customer.id,
      aiAppSlug: "video_generator",
      params: {
        mode: "video",
        outputType: "video",
        videoModelFamily: AUTO_VIDEO_MODEL_FAMILY,
        modelFamily: AUTO_VIDEO_MODEL_FAMILY,
        videoThemeId: selectedTheme.id,
        videoThemeExampleId: selectedThemeExampleId || undefined,
        videoThemeSlug: selectedTheme.slug,
        videoThemeCategorySlug: selectedThemeCategory?.slug,
        videoThemeCategoryLabel: selectedThemeCategory?.label,
        videoTheme: {
          id: selectedTheme.id,
          exampleId: selectedThemeExampleId || undefined,
          exampleName: selectedThemeExample?.name,
          slug: selectedTheme.slug,
          name: selectedTheme.name,
          categorySlug: selectedThemeCategory?.slug,
          categoryLabel: selectedThemeCategory?.label
        },
        duration: String(effectiveDurationSeconds),
        videoDuration: String(effectiveDurationSeconds),
        durationSeconds: effectiveDurationSeconds,
        videoDurationSeconds: effectiveDurationSeconds,
        aspect_ratio: selectedAspectRatio,
        aspectRatio: selectedAspectRatio,
        resolution: selectedResolution,
        estimatedCreditCost: selectedCreditCost,
        assetIds: submitFrameIds,
        fields: {
          mode: "video",
          outputType: "video",
          videoInputMode: submitFrameIds.length ? "image_to_video" : "text_to_video",
          videoModelFamily: AUTO_VIDEO_MODEL_FAMILY,
          modelFamily: AUTO_VIDEO_MODEL_FAMILY,
          videoThemeId: selectedTheme.id,
          videoThemeExampleId: selectedThemeExampleId || undefined,
          videoThemeSlug: selectedTheme.slug,
          videoThemeCategorySlug: selectedThemeCategory?.slug,
          videoThemeCategoryLabel: selectedThemeCategory?.label,
          videoThemeName: selectedTheme.name,
          videoThemeExampleName: selectedThemeExample?.name,
          videoThemePrompt: selectedTheme.prompt,
          frameAssetIds: submitFrameIds,
          duration: String(effectiveDurationSeconds),
          videoDuration: String(effectiveDurationSeconds),
          durationSeconds: effectiveDurationSeconds,
          videoDurationSeconds: effectiveDurationSeconds,
          aspect_ratio: selectedAspectRatio,
          aspectRatio: selectedAspectRatio,
          resolution: selectedResolution,
          estimatedCreditCost: selectedCreditCost,
          promptNote: trimmedPromptNote
        }
      }
    };
    const requestFingerprint = JSON.stringify(requestBody);
    const previousAttempt = submitAttemptRef.current;
    const idempotencyKey = previousAttempt?.fingerprint === requestFingerprint
      ? previousAttempt.idempotencyKey
      : newVideoSubmitIdempotencyKey();
    submitAttemptRef.current = { fingerprint: requestFingerprint, idempotencyKey };
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    const submitRequest = () => fetch(`/api/sites/${siteId}/ai/jobs`, {
      method: "POST",
      headers: customerJsonHeaders(siteId, { "Idempotency-Key": idempotencyKey }),
      signal: controller.signal,
      body: JSON.stringify({ ...requestBody, idempotencyKey })
    });
    let response: Response;
    let result: { job?: { id: string }; customerBalance?: PublicCustomer["balance"]; error?: string; reused?: boolean };
    try {
      response = await submitRequest();
      result = (await response.json().catch(() => ({}))) as typeof result;
      if (isCsrfError(result.error, response.status)) {
        await fetch(`/api/sites/${siteId}/customer/runtime?profile=workspace&refresh=csrf-${Date.now()}`, { cache: "no-store" }).catch(() => null);
        response = await submitRequest();
        result = (await response.json().catch(() => ({}))) as typeof result;
      }
    } catch (error) {
      window.clearTimeout(timeout);
      setPending(false);
      const nextMessage = error instanceof DOMException && error.name === "AbortError"
        ? vt(spanish, "Video request creation is taking longer than expected. Refresh the workspace before retrying so an already-started request can appear first.", "La creacion del video esta tardando mas de lo esperado. Actualiza el espacio de trabajo antes de reintentar para que aparezca primero una solicitud ya iniciada.")
        : vt(spanish, "The network failed while starting this video. Please check the connection and try again.", "La red fallo al iniciar este video. Revisa la conexion e intentalo de nuevo.");
      setMessage(nextMessage);
      onGenerationFailed?.(nextMessage);
      return;
    }
    window.clearTimeout(timeout);
    setPending(false);
    if (result.job?.id) {
      // Worker dispatch can fail after the job is created; show that job instead of a duplicate creation-failed card.
      submitAttemptRef.current = null;
      window.dispatchEvent(new CustomEvent("customer-assets:updated"));
      onJobCreated(result.job.id, { customerBalance: result.customerBalance });
      return;
    }
    if (!result.job?.id) {
      submitAttemptRef.current = null;
      const nextMessage = errorText(result.error, response.status, spanish);
      setMessage(nextMessage);
      onGenerationFailed?.(nextMessage);
      return;
    }
  }

  return (
    <section className="scroll-mt-28 overflow-hidden rounded-[22px] border border-white/10 bg-[#0c0f16] shadow-[0_28px_90px_-60px_rgba(0,0,0,0.92)]" id="step-video">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#182435] text-[#31d4ff]">
            <Film className="h-5 w-5" strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="text-base font-semibold">{vt(spanish, "Create an AI video clip", "Crear un clip de video con IA")}</h2>
            <p className="mt-1 text-xs text-white/50">
              {vt(spanish, "Use frame images for image-to-video, or leave them empty and describe a text-to-video clip.", "Usa fotogramas para imagen a video, o dejalos vacios y describe un clip de texto a video.")}
            </p>
          </div>
        </div>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/58">
          {customer.balance.available} {vt(spanish, "credits", "creditos")}
        </span>
      </div>

      <div className="p-4 xl:p-5" id="video-step-generate">
        <div className="rounded-[20px] border border-white/10 bg-[#11151d] p-4 shadow-[0_22px_70px_-55px_rgba(49,212,255,0.62)] sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{vt(spanish, "Agent video composer", "Compositor de video")}</p>
              <h3 className="mt-2 text-xl font-semibold">{vt(spanish, "Describe the clip you want", "Describe el clip que quieres")}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/56">
                {vt(spanish, "Use selected frames when you want image-to-video, or write a standalone prompt when you want text-to-video.", "Usa fotogramas seleccionados para imagen a video, o escribe un prompt independiente para texto a video.")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                aria-label="Choose a video theme"
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#ff9d42]/35 bg-[#ff9d42]/10 px-3 text-xs font-semibold text-[#ffd9b0] transition hover:border-[#ff9d42]/60 hover:bg-[#ff9d42]/16 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#ff9d42]/45"
                onClick={openThemePicker}
                type="button"
              >
                <Film className="h-3.5 w-3.5" strokeWidth={1.9} />
                {vt(spanish, "Choose theme", "Elegir tema")}
              </button>
              <button
                aria-label="Use video prompt template"
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#31d4ff]/30 bg-[#31d4ff]/10 px-3 text-xs font-semibold text-[#d8f7ff] transition hover:border-[#31d4ff]/55 hover:bg-[#31d4ff]/16 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#31d4ff]/45"
                onClick={applyVideoPromptTemplate}
                type="button"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
                Use template
              </button>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/62">
                {selectedFrameIds.length}/{maxFrames} {vt(spanish, "frames", "fotogramas")}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[#31d4ff]/20 bg-[#31d4ff]/10 p-4 text-[#d8f7ff]">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#31d4ff]" strokeWidth={1.9} />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5">
                {vt(spanish, "Video uses the best available provider automatically. Upload JPG or PNG frame images only when you want the clip to follow references; leave frames empty for text-to-video.", "El video usa automaticamente el mejor proveedor disponible. Sube fotogramas JPG o PNG solo cuando quieras que el clip siga referencias; deja los fotogramas vacios para texto a video.")}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#d8f7ff]/72">
                {vt(spanish, "Keep prompts and uploads provider-ready: avoid minors, nudity, celebrity or public figures, copyrighted characters, violence, hate, illegal activity, weapons, self-harm, sensitive documents, watermarks, large text, blurry images, or private images.", "Manten prompts y subidas listos para proveedores: evita menores, desnudez, celebridades o figuras publicas, personajes con copyright, violencia, odio, actividad ilegal, armas, autolesion, documentos sensibles, marcas de agua, mucho texto, imagenes borrosas o imagenes privadas.")}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-white/10 bg-[#1a1d24] p-3 sm:p-4">
            <label className="block">
              <span className="sr-only">{vt(spanish, "Video direction", "Direccion de video")}</span>
              <textarea
                className="min-h-[156px] w-full resize-y rounded-[14px] border border-transparent bg-transparent px-2 py-2 text-base leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-[#31d4ff]/55 focus:bg-black/14 sm:min-h-[172px]"
                maxLength={VIDEO_PROMPT_MAX_LENGTH}
                onChange={(event) => {
                  setPromptNote(event.target.value);
                  setTextToVideoConfirmArmed(false);
                  setTextToVideoConfirmOpen(false);
                  setMessage((current) =>
                    current === textToVideoConfirmationMessage ||
                    isPromptFrameReferenceBlockingMessage(current) ||
                    promptRiskMessages.some((risk) => risk.message === current)
                      ? ""
                      : current
                  );
                }}
                placeholder={vt(
                  spanish,
                  `Describe the video. Add frame images on the left when you want the clip to follow uploaded subjects; leave frames empty for text-to-video.`,
                  `Describe el video. Agrega fotogramas a la izquierda si quieres que el clip siga sujetos subidos; dejalos vacios para texto a video.`
                )}
                value={promptNote}
              />
            </label>
            {selectedTheme && (selectedThemeExample || selectedThemeCategory) ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/58">
                <span className="font-semibold uppercase tracking-[0.13em] text-white/36">{vt(spanish, "Theme reference", "Referencia de tema")}</span>
                {selectedThemeCategory?.label ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{selectedThemeCategory.label}</span> : null}
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{selectedTheme.name}</span>
                {selectedThemeExample?.name ? <span className="rounded-full border border-[#31d4ff]/25 bg-[#31d4ff]/10 px-2.5 py-1 text-[#bcefff]">{selectedThemeExample.name}</span> : null}
              </div>
            ) : null}
            {promptRiskMessages.length ? (
              <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-amber-300/18 bg-amber-300/[0.08] p-3 text-amber-50">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" strokeWidth={1.9} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/82">{vt(spanish, "Prompt check", "Revision del prompt")}</p>
                  <div className="mt-1 grid gap-1">
                    {promptRiskMessages.map((risk) => (
                      <p className={`text-xs leading-5 ${risk.severity === "block" ? "font-semibold text-red-200" : "text-amber-50/76"}`} key={risk.id}>
                        {risk.message}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-[#31d4ff]/30 bg-[#31d4ff]/10 px-3 text-xs font-semibold text-[#31d4ff]">
                  <Film className="h-4 w-4" strokeWidth={1.8} />
                  {isTextToVideo ? vt(spanish, "Text to video", "Texto a video") : vt(spanish, "Image to video", "Imagen a video")}
                </span>
                <span className="inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/66">
                  <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                  {selectedTheme ? vt(spanish, "Auto motion", "Movimiento automatico") : vt(spanish, "Loading preset", "Cargando ajuste")}
                </span>
                <span className="inline-flex min-h-9 items-center rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/66">
                  {selectedFrameIds.length}/{maxFrames} {vt(spanish, "selected", "seleccionados")}
                </span>
                <div className="relative">
                  <button
                    aria-expanded={formatPanelOpen}
                    className="inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/66 transition hover:bg-white/[0.08] hover:text-white"
                    onClick={() => setFormatPanelOpen((open) => !open)}
                    type="button"
                  >
                    <Monitor className="h-4 w-4" strokeWidth={1.8} />
                    {`${selectedAspectRatio} · ${selectedResolution.toUpperCase()}`}
                    <ChevronDown className={`h-3.5 w-3.5 transition ${formatPanelOpen ? "rotate-180" : ""}`} strokeWidth={1.8} />
                  </button>
                  {formatPanelOpen ? (
                    <div className="absolute left-0 top-11 z-20 w-[310px] rounded-[16px] border border-white/10 bg-[#1b1f27] p-3 shadow-[0_24px_70px_-34px_rgba(0,0,0,0.95)]">
                      <p className="px-1 text-[11px] font-semibold text-white/36">{vt(spanish, "Aspect ratio", "Relacion")}</p>
                      <div className="mt-2 grid grid-cols-5 gap-1 rounded-[12px] bg-white/[0.035] p-1">
                        {VIDEO_ASPECT_OPTIONS.map((option) => {
                          const selected = selectedAspectRatio === option.id;
                          return (
                            <button
                              className={`grid min-h-16 place-items-center rounded-[10px] px-2 text-xs font-semibold transition ${selected ? "bg-white/[0.08] text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white"}`}
                              key={option.id}
                              onClick={() => setSelectedAspectRatio(option.id)}
                              type="button"
                            >
                              <span className={`inline-block rounded-[3px] border ${option.shape} ${selected ? "border-[#31d4ff]" : "border-white/68"}`} />
                              <span>{option.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-4 px-1 text-[11px] font-semibold text-white/36">{vt(spanish, "Resolution", "Resolucion")}</p>
                      <div className="mt-2 grid grid-cols-1 gap-1 rounded-[12px] bg-white/[0.035] p-1">
                        {VIDEO_RESOLUTION_OPTIONS.map((option) => {
                          const selected = selectedResolution === option.id;
                          return (
                            <button
                              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-3 text-sm font-semibold transition ${selected ? "bg-white/[0.1] text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white"}`}
                              key={option.id}
                              onClick={() => {
                                setSelectedResolution(option.id);
                                setFormatPanelOpen(false);
                              }}
                              type="button"
                            >
                              {option.label}
                              {selected ? <Check className="h-3.5 w-3.5 text-[#31d4ff]" strokeWidth={2} /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="inline-flex rounded-[10px] border border-white/10 bg-black/16 p-1">
                  {availableDurationOptions.map((option) => {
                    const selected = effectiveDurationSeconds === option.seconds;
                    const cost = selectedTheme
                      ? selectedPricingModelFamilies
                        ? videoDurationCostForCandidateFamilies(selectedTheme, option.seconds, selectedPricingModelFamilies)
                        : videoDurationCostForCandidateFamilies(selectedTheme, option.seconds)
                      : 0;
                    return (
                      <button
                        className={`min-h-7 rounded-[8px] px-3 text-xs font-semibold transition ${selected ? "bg-white text-[#101114]" : "text-white/56 hover:bg-white/[0.08] hover:text-white"}`}
                        key={option.seconds}
                        onClick={() => setSelectedDurationSeconds(option.seconds)}
                        title={`${cost} ${vt(spanish, "credits", "creditos")}`}
                        type="button"
                      >
                        {option.seconds}s
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 lg:justify-end">
                <span className="text-xs font-semibold text-white/52">
                  {selectedCreditCost} {vt(spanish, "credits", "creditos")}
                </span>
                <button
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#2f6fed] px-5 text-sm font-semibold text-white transition hover:bg-[#4380ff] disabled:cursor-not-allowed disabled:opacity-45 sm:min-w-40"
                  disabled={isSubmitting || !canGenerateCurrentVideo}
                  onClick={() => void generateVideo()}
                  type="button"
                >
                  <Send className="h-4 w-4" strokeWidth={1.8} />
                  {generateButtonLabel}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.42fr)]">
            <div className="rounded-[16px] border border-white/10 bg-black/16 p-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/44">{vt(spanish, "Frame order", "Orden de fotogramas")}</p>
                <p className="mt-1 text-sm text-white/62">
                  {hasPendingFrameUploads
                    ? vt(spanish, "Some selected frame uploads are still finishing.", "Algunos fotogramas seleccionados aun se estan subiendo.")
                    : selectedFrameIds.length
                      ? vt(spanish, "The selected frames on the left will drive the clip sequence.", "Los fotogramas seleccionados a la izquierda guiaran la secuencia.")
                      : vt(spanish, "No frames selected. This request will run as text-to-video and follow only your written prompt.", "No hay fotogramas seleccionados. Esta solicitud se ejecutara como texto a video y seguira solo tu prompt escrito.")}
                </p>
                {providerFrameLimitMessage && selectedFrameIds.length ? <p className="mt-2 text-xs leading-5 text-[#31d4ff]">{providerFrameLimitMessage}</p> : null}
                {unsupportedVideoFrameMessage ? <p className="mt-2 text-xs font-semibold leading-5 text-amber-200">{unsupportedVideoFrameMessage}</p> : null}
              </div>
            </div>

            <div className="rounded-[16px] border border-white/10 bg-black/16 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/44">{vt(spanish, "Generation setup", "Configuracion")}</p>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-white/62">
                <p>{vt(spanish, "Preset", "Ajuste")}: <span className="font-semibold text-white">{selectedTheme ? vt(spanish, "Automatic motion", "Movimiento automatico") : vt(spanish, "Loading", "Cargando")}</span></p>
                <p>{vt(spanish, "Format", "Formato")}: <span className="font-semibold text-white">{selectedAspectRatio} · {selectedResolution.toUpperCase()}</span></p>
                <p>{vt(spanish, "Duration", "Duracion")}: <span className="font-semibold text-white">{effectiveDurationSeconds}s</span></p>
                <p>{vt(spanish, "Cost", "Costo")}: <span className="font-semibold text-white">{selectedCreditCost}</span></p>
              </div>
            </div>
          </div>

          <p className="mt-3 min-h-5 text-xs font-semibold leading-5 text-red-400" role="status">{message}</p>
        </div>
      </div>
      {textToVideoConfirmOpen ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/78 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="text-to-video-confirm-title">
          <div className="w-full max-w-lg overflow-hidden rounded-[22px] border border-white/14 bg-[#111720] text-white shadow-[0_30px_100px_-36px_rgba(0,0,0,0.96)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-amber-300/30 bg-amber-300/12 text-amber-200">
                  <AlertTriangle className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/80">{vt(spanish, "Frame check", "Revision de fotogramas")}</p>
                  <h3 className="mt-1 text-xl font-semibold" id="text-to-video-confirm-title">{vt(spanish, "No frame images selected", "No hay fotogramas seleccionados")}</h3>
                </div>
              </div>
              <button
                aria-label={vt(spanish, "Close text-to-video warning", "Cerrar aviso de texto a video")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 text-white/62 transition hover:bg-white/[0.08] hover:text-white"
                onClick={() => {
                  setTextToVideoConfirmArmed(false);
                  setTextToVideoConfirmOpen(false);
                }}
                type="button"
              >
                <X className="h-4 w-4" strokeWidth={1.9} />
              </button>
            </div>
            <div className="p-5">
              <p className="text-sm leading-6 text-white/72">{textToVideoConfirmationMessage}</p>
              <p className="mt-3 rounded-[14px] border border-amber-300/18 bg-amber-300/10 p-3 text-sm font-semibold leading-6 text-amber-100">
                {vt(spanish, "Uploaded images on the left will not guide this clip unless you select them first.", "Las imagenes subidas a la izquierda no guiaran este clip a menos que las selecciones primero.")}
              </p>
              <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/14 px-5 text-sm font-semibold text-white/78 transition hover:bg-white/[0.08] hover:text-white"
                  onClick={chooseFrameImagesForVideo}
                  type="button"
                >
                  <ImagePlus className="h-4 w-4" strokeWidth={1.9} />
                  {vt(spanish, "Select frame images", "Seleccionar fotogramas")}
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#2f6fed] px-5 text-sm font-semibold text-white transition hover:bg-[#4380ff] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSubmitting}
                  onClick={() => {
                    setTextToVideoConfirmArmed(true);
                    setTextToVideoConfirmOpen(false);
                    void generateVideo({ confirmedTextToVideo: true });
                  }}
                  type="button"
                >
                  <Send className="h-4 w-4" strokeWidth={1.8} />
                  {vt(spanish, "Continue text-to-video", "Continuar texto a video")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {themePickerOpen ? (
        <div className="fixed inset-0 z-[125] grid place-items-center bg-black/78 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="video-theme-picker-title">
          <div className="flex max-h-[calc(100dvh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[22px] border border-white/14 bg-[#0d1118] text-white shadow-[0_30px_100px_-36px_rgba(0,0,0,0.96)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{vt(spanish, "Video themes", "Temas de video")}</p>
                <h3 className="mt-1 text-xl font-semibold" id="video-theme-picker-title">{vt(spanish, "Choose a theme and reference case", "Elige un tema y un caso de referencia")}</h3>
                <p className="mt-1 text-sm text-white/52">{vt(spanish, "Browse every active category, then edit the provider-ready prompt before applying it.", "Explora todas las categorias activas y edita el prompt antes de aplicarlo.")}</p>
              </div>
              <button aria-label={vt(spanish, "Close theme picker", "Cerrar selector de temas")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 text-white/62 transition hover:bg-white/[0.08] hover:text-white" onClick={() => setThemePickerOpen(false)} type="button"><X className="h-4 w-4" strokeWidth={1.9} /></button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-[220px_minmax(0,0.9fr)_minmax(320px,1.1fr)]">
              <div className="self-start rounded-[16px] border border-white/10 bg-black/16 p-2">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Categories", "Categorias")}</p>
                <div className="grid gap-1">
                  {rootThemeCategories.map((root) => {
                    const children = childThemeCategories.filter((category) => category.parentId === root.id);
                    const rootThemes = themes.filter((theme) => theme.category?.id === root.id || theme.category?.parentId === root.id);
                    const expanded = expandedThemeCategoryIds.includes(root.id) || Boolean(pickerSearch);
                    return <div key={root.id}>
                      <button className={`flex w-full items-center justify-between rounded-[10px] px-3 py-2.5 text-left text-sm font-semibold transition ${pickerRootCategory?.id === root.id ? "bg-[#31d4ff]/12 text-[#bcefff]" : "text-white/62 hover:bg-white/[0.06] hover:text-white"}`} onClick={() => { choosePickerCategory(root); setExpandedThemeCategoryIds((current) => current.includes(root.id) ? current.filter((id) => id !== root.id) : [...current, root.id]); }} type="button">
                        <span className="flex min-w-0 items-center gap-2"><ChevronRight className={`h-3.5 w-3.5 shrink-0 transition ${expanded ? "rotate-90" : ""}`} strokeWidth={2} /><span className="truncate">{root.label}</span></span><span className="text-xs text-white/35">{rootThemes.length}</span>
                      </button>
                      {expanded ? <div className="ml-5 grid gap-1 border-l border-white/10 pl-2">
                        {children.map((child) => {
                          const count = themes.filter((theme) => theme.category?.id === child.id).length;
                          return <button className={`flex items-center justify-between rounded-[8px] px-2.5 py-2 text-left text-xs font-semibold transition ${pickerCategory?.id === child.id ? "bg-[#31d4ff]/10 text-[#bcefff]" : "text-white/52 hover:bg-white/[0.06] hover:text-white"}`} key={child.id} onClick={() => choosePickerCategory(child)} type="button"><span className="truncate">{child.label}</span><span className="text-[11px] text-white/30">{count}</span></button>;
                        })}
                      </div> : null}
                    </div>;
                  })}
                </div>
              </div>
              <div className="self-start rounded-[16px] border border-white/10 bg-black/16 p-3">
                <div className="flex items-center gap-2 rounded-[10px] border border-white/10 bg-[#080b10] px-3 py-2"><Search className="h-4 w-4 shrink-0 text-white/35" strokeWidth={1.8} /><input aria-label={vt(spanish, "Search video themes", "Buscar temas de video")} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/30" onChange={(event) => setThemePickerSearch(event.target.value)} placeholder={vt(spanish, "Search categories or themes", "Buscar categorias o temas")} value={themePickerSearch} /></div>
                <p className="px-2 pb-2 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{pickerRootCategory?.label ?? vt(spanish, "Themes", "Temas")}{pickerCategory?.parentId && pickerCategory.id !== pickerRootCategory?.id ? ` / ${pickerCategory.label}` : ""}</p>
                <div className="grid gap-2">
                  {pickerThemes.map((theme) => <button className={`flex items-center gap-3 rounded-[12px] border px-3 py-3 text-left transition ${pickerTheme?.id === theme.id ? "border-[#31d4ff]/45 bg-[#31d4ff]/10" : "border-white/8 bg-white/[0.025] hover:border-white/20"}`} key={theme.id} onClick={() => choosePickerTheme(theme)} type="button">{theme.imageUrl ? <img alt="" className="h-12 w-16 rounded-[8px] object-cover" src={theme.imageUrl} /> : <span className="grid h-12 w-16 place-items-center rounded-[8px] bg-white/[0.06]"><Film className="h-5 w-5 text-[#31d4ff]" /></span>}<span className="min-w-0"><span className="block truncate text-sm font-semibold">{theme.name}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-white/45">{theme.description}</span></span></button>)}
                  {!pickerThemes.length ? <p className="rounded-[10px] border border-dashed border-white/10 p-5 text-sm text-white/45">{vt(spanish, "No themes match this search.", "No hay temas que coincidan con la busqueda.")}</p> : null}
                </div>
              </div>
              <div className="self-start rounded-[16px] border border-white/10 bg-black/16 p-4">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Reference cases", "Casos de referencia")}</p><h4 className="mt-1 text-lg font-semibold">{pickerTheme?.name ?? vt(spanish, "Select a theme", "Selecciona un tema")}</h4></div><span className="text-xs text-white/40">{pickerExamples.length} {vt(spanish, "cases", "casos")}</span></div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">{pickerExamples.map((example) => <button className={`rounded-[12px] border p-3 text-left transition ${pickerExample?.id === example.id ? "border-[#31d4ff]/45 bg-[#31d4ff]/10" : "border-white/8 bg-white/[0.025] hover:border-white/20"}`} key={example.id} onClick={() => choosePickerExample(example)} type="button">{example.imageUrl ? <img alt="" className="mb-2 aspect-video w-full rounded-[8px] object-cover" src={example.imageUrl} /> : null}<span className="block text-sm font-semibold">{example.name}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-white/45">{example.description}</span></button>)}</div>
                <label className="mt-4 block"><span className="text-xs font-semibold uppercase tracking-[0.13em] text-white/40">{vt(spanish, "Editable prompt", "Prompt editable")}</span><textarea className="mt-2 min-h-[220px] w-full resize-y rounded-[12px] border border-white/10 bg-[#080b10] p-3 text-xs leading-6 text-white/78 outline-none focus:border-[#31d4ff]/45" onChange={(event) => setThemePickerPrompt(event.target.value)} value={themePickerPrompt} /></label>
              </div>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end"><button className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-semibold text-white/72 hover:bg-white/[0.08] hover:text-white" onClick={() => setThemePickerOpen(false)} type="button">{vt(spanish, "Cancel", "Cancelar")}</button><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#2f6fed] px-5 text-sm font-semibold text-white hover:bg-[#4380ff] disabled:opacity-45" disabled={!pickerTheme || !themePickerPrompt.trim()} onClick={confirmThemePicker} type="button"><Check className="h-4 w-4" strokeWidth={2} />{vt(spanish, "Apply theme", "Aplicar tema")}</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
