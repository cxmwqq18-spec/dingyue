"use client";

import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Film, ImagePlus, Monitor, Send, Sparkles, X } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import type { PublicCustomer, VideoTheme } from "@/lib/types";
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  normalizeVideoDurationSecondsForFrameCount,
  normalizeVideoFrameLimit,
  trimVideoFrameSelection,
  videoDurationCreditCost,
  videoDurationOptionsForFrameCount,
  type VideoDurationSeconds
} from "@/lib/video-frame-config";

type SubscriptionStatus = "loading" | "active" | "required" | "admin";
type VideoAspectRatio = "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
type VideoResolution = "720p" | "480p";
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
  aspectRatio?: string;
  resolution?: string;
};

const VIDEO_ASPECT_OPTIONS: Array<{ id: VideoAspectRatio; label: string; shape: string }> = [
  { id: "16:9", label: "16:9", shape: "aspect-[16/9] w-7" },
  { id: "4:3", label: "4:3", shape: "aspect-[4/3] w-6" },
  { id: "1:1", label: "1:1", shape: "aspect-square w-5" },
  { id: "3:4", label: "3:4", shape: "aspect-[3/4] h-6" },
  { id: "9:16", label: "9:16", shape: "aspect-[9/16] h-7" }
];

const VIDEO_RESOLUTION_OPTIONS: Array<{ id: VideoResolution; label: string }> = [
  { id: "720p", label: "720P" },
  { id: "480p", label: "480P" }
];

const PROMPT_DIRECTED_VIDEO_THEME_SLUG = "prompt-directed-motion";

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
  if (error === "video_frames_required" || error === "video_prompt_required") return vt(spanish, "Describe the video or select at least one frame image.", "Describe el video o selecciona al menos una imagen de fotograma.");
  if (error === "video_frame_selection_required") return vt(spanish, "Your prompt refers to uploaded images. Select frame images on the left before generating image-to-video.", "Tu prompt menciona imagenes subidas. Selecciona fotogramas a la izquierda antes de generar imagen a video.");
  if (error === "too_many_video_frames") return vt(spanish, "This theme allows fewer frame images.", "Este tema permite menos imagenes de fotograma.");
  if (error === "too_many_video_frames_for_provider") return vt(spanish, "This video preset allows fewer frame images. Remove extra frames and try again.", "Este ajuste de video permite menos fotogramas. Quita fotogramas extra e intentalo de nuevo.");
  if (error === "video_frame_asset_required") return vt(spanish, "Use images uploaded in the video frame area before generating.", "Usa imagenes subidas en el area de fotogramas antes de generar.");
  if (error === "video_public_asset_url_required") return vt(spanish, "Video generation needs a public asset URL so the provider can read the selected frame images.", "La generacion de video necesita una URL publica de recursos para que el proveedor lea los fotogramas seleccionados.");
  if (status === 409) return vt(spanish, "Another request is already running. Check the All tab before starting a new one.", "Ya hay otra solicitud en ejecucion. Revisa la pestana Todo antes de iniciar otra.");
  return vt(spanish, "Video generation could not start. Please check the frame images and try again.", "No se pudo iniciar el video. Revisa las imagenes e intentalo de nuevo.");
}

function isCsrfError(error: string | undefined, status: number) {
  return status === 403 && (error === "csrf_token_required" || error === "csrf_token_mismatch" || Boolean(error?.includes("csrf")));
}

function isVideoAspectRatio(value: string | undefined): value is VideoAspectRatio {
  return VIDEO_ASPECT_OPTIONS.some((option) => option.id === value);
}

function isVideoResolution(value: string | undefined): value is VideoResolution {
  return VIDEO_RESOLUTION_OPTIONS.some((option) => option.id === value);
}

export function CustomerVideoWorkspace({
  customer,
  onJobCreated,
  onOpenFrameManager,
  onRetryDraftApplied,
  readyFrameIds,
  retryDraft,
  selectedFrameIds,
  setSelectedFrameIds,
  siteId,
  spanish = false,
  subscriptionStatus
}: {
  customer: PublicCustomer;
  siteId: string;
  subscriptionStatus: SubscriptionStatus;
  spanish?: boolean;
  readyFrameIds?: string[];
  selectedFrameIds: string[];
  setSelectedFrameIds: Dispatch<SetStateAction<string[]>>;
  onJobCreated: (jobId: string, feedback?: CreatedVideoJobFeedback) => void;
  onOpenFrameManager: () => void;
  onRetryDraftApplied?: () => void;
  retryDraft?: VideoRetryDraft | null;
}) {
  const [themes, setThemes] = useState<VideoTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [selectedDurationSeconds, setSelectedDurationSeconds] = useState<VideoDurationSeconds>(DEFAULT_VIDEO_DURATION_SECONDS);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [selectedResolution, setSelectedResolution] = useState<VideoResolution>("720p");
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [promptNote, setPromptNote] = useState("");
  const [message, setMessage] = useState("");
  const [textToVideoConfirmArmed, setTextToVideoConfirmArmed] = useState(false);
  const [textToVideoConfirmOpen, setTextToVideoConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const appliedRetryDraftKeyRef = useRef<string | null>(null);
  const retryDurationThemeIdRef = useRef<string | null>(null);

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
        setThemes(nextThemes);
        setSelectedThemeId((current) => current || defaultVideoTheme(nextThemes)?.id || "");
        if (!nextThemes.length) {
          setMessage(vt(spanish, "No active video presets are available yet.", "Aun no hay ajustes de video activos."));
        }
      } catch {
        if (!controller.signal.aborted) {
          setMessage(vt(spanish, "Video presets could not load. Refresh this page and try again.", "No se pudieron cargar los ajustes de video. Actualiza la pagina e intentalo de nuevo."));
        }
      }
    }
    void loadThemes();
    return () => controller.abort();
  }, [siteId, spanish]);

  const selectedTheme = themes.find((theme) => theme.id === selectedThemeId) ?? defaultVideoTheme(themes);
  const maxFrames = normalizeVideoFrameLimit(selectedTheme?.effectiveMaxFrames ?? selectedTheme?.maxFrames);
  const availableDurationOptions = videoDurationOptionsForFrameCount(selectedFrameIds.length);
  const effectiveDurationSeconds = normalizeVideoDurationSecondsForFrameCount(selectedDurationSeconds, selectedFrameIds.length);
  const providerFrameLimitMessage = maxFrames > 1
    ? vt(spanish, `Selected frames are treated as ordered reference images for image-to-video.`, `Los fotogramas seleccionados se tratan como imagenes de referencia ordenadas para imagen a video.`)
    : "";
  const selectedCreditCost = selectedTheme ? videoDurationCreditCost(selectedTheme.creditCost, effectiveDurationSeconds) : 0;
  const hasCreditsForSelectedVideo = selectedCreditCost > 0 && selectedCreditCost <= customer.balance.available;
  const generationFrameIds = readyFrameIds ?? selectedFrameIds;
  const hasPendingFrameUploads = generationFrameIds.length !== selectedFrameIds.length;
  const trimmedPromptNote = promptNote.trim();
  const hasReadyFrameInput = generationFrameIds.length > 0;
  const isTextToVideo = selectedFrameIds.length === 0;
  const needsTextToVideoConfirmation = isTextToVideo && trimmedPromptNote.length > 0;
  const textToVideoConfirmationMessage = vt(
    spanish,
    "No frame images are selected. This will run as text-to-video and follow only your written prompt. Select frame images on the left for image-to-video, or continue only if you want a prompt-only result.",
    "No hay fotogramas seleccionados. Esto se ejecutara como texto a video y seguira solo tu prompt escrito. Selecciona fotogramas a la izquierda para imagen a video, o continua solo si quieres un resultado solo con prompt."
  );
  const generateButtonLabel = pending
    ? vt(spanish, "Starting", "Iniciando")
    : textToVideoConfirmArmed && needsTextToVideoConfirmation
      ? vt(spanish, "Generate text-to-video", "Generar texto a video")
      : vt(spanish, "Generate video", "Generar video");
  const canGenerateCurrentVideo = Boolean(selectedTheme) && !hasPendingFrameUploads && (hasReadyFrameInput || trimmedPromptNote.length > 0);

  useEffect(() => {
    if (!retryDraft || appliedRetryDraftKeyRef.current === retryDraft.key) return;
    const restoredTheme = retryDraft.videoThemeId
      ? themes.find((theme) => theme.id === retryDraft.videoThemeId)
      : undefined;
    const restoredThemeId = restoredTheme?.id ?? retryDraft.videoThemeId;
    const restoredMaxFrames = normalizeVideoFrameLimit(restoredTheme?.effectiveMaxFrames ?? restoredTheme?.maxFrames);
    const restoredFrameIds = trimVideoFrameSelection(retryDraft.frameAssetIds, restoredMaxFrames);
    setSelectedFrameIds(restoredFrameIds);
    if (restoredThemeId) setSelectedThemeId(restoredThemeId);
    setSelectedDurationSeconds(normalizeVideoDurationSecondsForFrameCount(retryDraft.durationSeconds, restoredFrameIds.length));
    if (retryDraft.durationSeconds !== undefined && restoredThemeId) retryDurationThemeIdRef.current = restoredThemeId;
    if (isVideoAspectRatio(retryDraft.aspectRatio)) setSelectedAspectRatio(retryDraft.aspectRatio);
    if (isVideoResolution(retryDraft.resolution)) setSelectedResolution(retryDraft.resolution);
    setPromptNote(retryDraft.promptNote ?? "");
    setFormatPanelOpen(false);
    setMessage(vt(spanish, "Previous video request restored. Review it, then generate again.", "Solicitud de video anterior restaurada. Revisala y vuelve a generar."));
    appliedRetryDraftKeyRef.current = retryDraft.key;
    onRetryDraftApplied?.();
  }, [onRetryDraftApplied, retryDraft, setSelectedFrameIds, spanish, themes]);

  useEffect(() => {
    if (!selectedTheme) return;
    if (retryDurationThemeIdRef.current === selectedTheme.id) {
      retryDurationThemeIdRef.current = null;
      return;
    }
    setSelectedDurationSeconds(normalizeVideoDurationSecondsForFrameCount(selectedTheme.durationSeconds, selectedFrameIds.length));
  }, [selectedFrameIds.length, selectedTheme]);

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

  async function generateVideo(options: { confirmedTextToVideo?: boolean } = {}) {
    if (pending) return;
    if (subscriptionStatus === "loading") {
      setMessage(vt(spanish, "We are still checking your subscription. Try again in a moment.", "Aun estamos revisando tu suscripcion. Intentalo en un momento."));
      return;
    }
    if (subscriptionStatus === "required" && !hasCreditsForSelectedVideo) {
      setMessage(vt(spanish, "Choose a subscription or add enough credits before generating video.", "Elige una suscripcion o anade creditos suficientes antes de generar video."));
      return;
    }
    if (!selectedTheme) {
      setMessage(vt(spanish, "Video presets are still loading. Try again in a moment.", "Los ajustes de video aun se estan cargando. Intentalo en un momento."));
      return;
    }
    if (!selectedFrameIds.length && !trimmedPromptNote) {
      setMessage(vt(spanish, "Describe the video you want, or select frame images on the left for image-to-video.", "Describe el video que quieres o selecciona fotogramas a la izquierda para imagen a video."));
      return;
    }
    if (selectedFrameIds.length && (hasPendingFrameUploads || !generationFrameIds.length)) {
      setMessage(vt(spanish, "Frame uploads are still finishing. Generate after every selected frame is ready.", "Las subidas de fotogramas aun estan terminando. Genera cuando todos los fotogramas seleccionados esten listos."));
      return;
    }
    if (selectedCreditCost > customer.balance.available && subscriptionStatus !== "admin") {
      setMessage(vt(spanish, `This duration needs ${selectedCreditCost} credits, but ${customer.balance.available} are available.`, `Esta duracion necesita ${selectedCreditCost} creditos, pero hay ${customer.balance.available} disponibles.`));
      return;
    }
    if (needsTextToVideoConfirmation && !options.confirmedTextToVideo) {
      setTextToVideoConfirmArmed(true);
      setTextToVideoConfirmOpen(true);
      setMessage(textToVideoConfirmationMessage);
      return;
    }
    setTextToVideoConfirmOpen(false);
    setPending(true);
    setMessage(vt(spanish, "Creating your video request and reserving credits...", "Creando tu solicitud de video y reservando creditos..."));
    const requestBody = {
      customerId: customer.id,
      aiAppSlug: "video_generator",
      params: {
        mode: "video",
        outputType: "video",
        videoThemeId: selectedTheme.id,
        duration: String(effectiveDurationSeconds),
        videoDuration: String(effectiveDurationSeconds),
        durationSeconds: effectiveDurationSeconds,
        videoDurationSeconds: effectiveDurationSeconds,
        aspect_ratio: selectedAspectRatio,
        aspectRatio: selectedAspectRatio,
        resolution: selectedResolution,
        estimatedCreditCost: selectedCreditCost,
        assetIds: generationFrameIds,
        fields: {
          mode: "video",
          outputType: "video",
          videoInputMode: hasReadyFrameInput ? "image_to_video" : "text_to_video",
          videoThemeId: selectedTheme.id,
          videoThemeName: selectedTheme.name,
          videoThemePrompt: selectedTheme.prompt,
          frameAssetIds: generationFrameIds,
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
    const submitRequest = () => fetch(`/api/sites/${siteId}/ai/jobs`, {
      method: "POST",
      headers: customerJsonHeaders(siteId),
      body: JSON.stringify(requestBody)
    });
    let response = await submitRequest();
    let result = (await response.json().catch(() => ({}))) as { job?: { id: string }; customerBalance?: PublicCustomer["balance"]; error?: string };
    if (isCsrfError(result.error, response.status)) {
      await fetch(`/api/sites/${siteId}/customer/runtime?profile=workspace&refresh=csrf-${Date.now()}`, { cache: "no-store" }).catch(() => null);
      response = await submitRequest();
      result = (await response.json().catch(() => ({}))) as { job?: { id: string }; customerBalance?: PublicCustomer["balance"]; error?: string };
    }
    setPending(false);
    if (!response.ok || !result.job) {
      setMessage(errorText(result.error, response.status, spanish));
      return;
    }
    window.dispatchEvent(new CustomEvent("customer-assets:updated"));
    onJobCreated(result.job.id, { customerBalance: result.customerBalance });
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
            <p className="mt-1 text-xs text-white/50">{vt(spanish, "Use frame images for image-to-video, or leave them empty and describe a text-to-video clip.", "Usa fotogramas para imagen a video, o dejalos vacios y describe un clip de texto a video.")}</p>
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
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/62">
              {selectedFrameIds.length}/{maxFrames} {vt(spanish, "frames", "fotogramas")}
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-white/10 bg-[#1a1d24] p-3 sm:p-4">
            <label className="block">
              <span className="sr-only">{vt(spanish, "Video direction", "Direccion de video")}</span>
              <textarea
                className="min-h-[156px] w-full resize-none rounded-[14px] border border-transparent bg-transparent px-2 py-2 text-base leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-[#31d4ff]/55 focus:bg-black/14 sm:min-h-[172px]"
                maxLength={600}
                onChange={(event) => {
                  setPromptNote(event.target.value);
                  setTextToVideoConfirmArmed(false);
                  setTextToVideoConfirmOpen(false);
                  setMessage((current) => current === textToVideoConfirmationMessage ? "" : current);
                }}
                placeholder={vt(
                  spanish,
                  `Describe the video. Add frame images on the left when you want the clip to follow uploaded subjects; leave frames empty for text-to-video.`,
                  `Describe el video. Agrega fotogramas a la izquierda si quieres que el clip siga sujetos subidos; dejalos vacios para texto a video.`
                )}
                value={promptNote}
              />
            </label>

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
                    {selectedAspectRatio} · {selectedResolution.toUpperCase()}
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
                      <div className="mt-2 grid grid-cols-2 gap-1 rounded-[12px] bg-white/[0.035] p-1">
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
                    const cost = selectedTheme ? videoDurationCreditCost(selectedTheme.creditCost, option.seconds) : 0;
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
                  disabled={pending || !canGenerateCurrentVideo}
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
              </div>
            </div>

            <div className="rounded-[16px] border border-white/10 bg-black/16 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/44">{vt(spanish, "Generation setup", "Configuracion")}</p>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-white/62">
                <p>{vt(spanish, "Preset", "Ajuste")}: <span className="font-semibold text-white">{selectedTheme ? vt(spanish, "Automatic motion", "Movimiento automatico") : vt(spanish, "Loading", "Cargando")}</span></p>
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
                  disabled={pending}
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
    </section>
  );
}
