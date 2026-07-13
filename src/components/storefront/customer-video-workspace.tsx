"use client";

import { type Dispatch, type SetStateAction, useEffect, useState } from "react";
import { Check, ChevronDown, Film, Monitor, Send, Sparkles } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import type { PublicCustomer, VideoTheme } from "@/lib/types";
import {
  DEFAULT_VIDEO_DURATION_SECONDS,
  VIDEO_DURATION_OPTIONS,
  normalizeVideoDurationSeconds,
  normalizeVideoFrameLimit,
  trimVideoFrameSelection,
  videoDurationCreditCost,
  type VideoDurationSeconds
} from "@/lib/video-frame-config";

type SubscriptionStatus = "loading" | "active" | "required" | "admin";
type VideoAspectRatio = "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
type VideoResolution = "720p" | "480p";
type CreatedVideoJobFeedback = {
  customerBalance?: PublicCustomer["balance"];
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
  if (error === "video_frames_required") return vt(spanish, "Select at least one frame image.", "Selecciona al menos una imagen de fotograma.");
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

export function CustomerVideoWorkspace({
  customer,
  onJobCreated,
  onOpenFrameManager,
  readyFrameIds,
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
}) {
  const [themes, setThemes] = useState<VideoTheme[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState("");
  const [selectedDurationSeconds, setSelectedDurationSeconds] = useState<VideoDurationSeconds>(DEFAULT_VIDEO_DURATION_SECONDS);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [selectedResolution, setSelectedResolution] = useState<VideoResolution>("720p");
  const [formatPanelOpen, setFormatPanelOpen] = useState(false);
  const [promptNote, setPromptNote] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

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
        setSelectedThemeId(defaultVideoTheme(nextThemes)?.id || "");
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
  const providerMaxFrames = selectedTheme?.providerMaxFrames ? normalizeVideoFrameLimit(selectedTheme.providerMaxFrames) : undefined;
  const providerFrameLimitMessage = providerMaxFrames && providerMaxFrames < maxFrames
    ? vt(spanish, `Selected frames are first composed into one AI starter scene before the video provider receives it.`, `Los fotogramas seleccionados se componen primero en una escena inicial de IA antes de enviarla al proveedor de video.`)
    : "";
  const selectedCreditCost = selectedTheme ? videoDurationCreditCost(selectedTheme.creditCost, selectedDurationSeconds) : 0;
  const hasCreditsForSelectedVideo = selectedCreditCost > 0 && selectedCreditCost <= customer.balance.available;
  const generationFrameIds = readyFrameIds ?? selectedFrameIds;
  const hasPendingFrameUploads = generationFrameIds.length !== selectedFrameIds.length;

  useEffect(() => {
    if (selectedTheme) setSelectedDurationSeconds(normalizeVideoDurationSeconds(selectedTheme.durationSeconds));
  }, [selectedTheme?.id, selectedTheme?.durationSeconds]);

  useEffect(() => {
    if (selectedFrameIds.length > maxFrames) setSelectedFrameIds((current) => trimVideoFrameSelection(current, maxFrames));
  }, [maxFrames, selectedFrameIds.length, setSelectedFrameIds]);

  async function generateVideo() {
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
    if (!selectedFrameIds.length) {
      setMessage(vt(spanish, "Select at least one frame image on the left.", "Selecciona al menos una imagen de fotograma a la izquierda."));
      onOpenFrameManager();
      return;
    }
    if (hasPendingFrameUploads || !generationFrameIds.length) {
      setMessage(vt(spanish, "Frame uploads are still finishing. Generate after every selected frame is ready.", "Las subidas de fotogramas aun estan terminando. Genera cuando todos los fotogramas seleccionados esten listos."));
      return;
    }
    if (selectedCreditCost > customer.balance.available && subscriptionStatus !== "admin") {
      setMessage(vt(spanish, `This duration needs ${selectedCreditCost} credits, but ${customer.balance.available} are available.`, `Esta duracion necesita ${selectedCreditCost} creditos, pero hay ${customer.balance.available} disponibles.`));
      return;
    }
    setPending(true);
    setMessage(vt(spanish, "Creating your video request and reserving credits...", "Creando tu solicitud de video y reservando creditos..."));
    const requestBody = {
      customerId: customer.id,
      aiAppSlug: "video_generator",
      params: {
        mode: "video",
        outputType: "video",
        videoThemeId: selectedTheme.id,
        duration: String(selectedDurationSeconds),
        videoDuration: String(selectedDurationSeconds),
        durationSeconds: selectedDurationSeconds,
        videoDurationSeconds: selectedDurationSeconds,
        aspect_ratio: selectedAspectRatio,
        aspectRatio: selectedAspectRatio,
        resolution: selectedResolution,
        estimatedCreditCost: selectedCreditCost,
        assetIds: generationFrameIds,
        fields: {
          mode: "video",
          outputType: "video",
          videoThemeId: selectedTheme.id,
          videoThemeName: selectedTheme.name,
          videoThemePrompt: selectedTheme.prompt,
          frameAssetIds: generationFrameIds,
          duration: String(selectedDurationSeconds),
          videoDuration: String(selectedDurationSeconds),
          durationSeconds: selectedDurationSeconds,
          videoDurationSeconds: selectedDurationSeconds,
          aspect_ratio: selectedAspectRatio,
          aspectRatio: selectedAspectRatio,
          resolution: selectedResolution,
          estimatedCreditCost: selectedCreditCost,
          promptNote: promptNote.trim()
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
            <h2 className="text-base font-semibold">{vt(spanish, "Create an image-to-video clip", "Crear un clip de imagen a video")}</h2>
            <p className="mt-1 text-xs text-white/50">{vt(spanish, "Manage frame images on the left, describe the motion here, then generate one private MP4.", "Gestiona los fotogramas a la izquierda, describe el movimiento aqui y genera un MP4 privado.")}</p>
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
                {vt(spanish, "Use the selected frame order, then add motion, mood, camera, or story direction in one place.", "Usa el orden de fotogramas seleccionado y agrega movimiento, ambiente, camara o direccion narrativa en un solo lugar.")}
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
                onChange={(event) => setPromptNote(event.target.value)}
                placeholder={vt(
                  spanish,
                  `Select up to ${maxFrames} frame image${maxFrames === 1 ? "" : "s"} on the left, then describe the motion. Example: keep both people smiling while the cart moves forward, with soft handheld camera movement and warm daylight.`,
                  `Selecciona hasta ${maxFrames} fotograma${maxFrames === 1 ? "" : "s"} a la izquierda y describe el movimiento. Ejemplo: conserva las sonrisas mientras el carrito avanza, con camara suave en mano y luz calida.`
                )}
                value={promptNote}
              />
            </label>

            <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-[#31d4ff]/30 bg-[#31d4ff]/10 px-3 text-xs font-semibold text-[#31d4ff]">
                  <Film className="h-4 w-4" strokeWidth={1.8} />
                  {vt(spanish, "Image to video", "Imagen a video")}
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
                  {VIDEO_DURATION_OPTIONS.map((option) => {
                    const selected = selectedDurationSeconds === option.seconds;
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
                  disabled={pending || !selectedTheme || !selectedFrameIds.length || hasPendingFrameUploads || !generationFrameIds.length}
                  onClick={() => void generateVideo()}
                  type="button"
                >
                  <Send className="h-4 w-4" strokeWidth={1.8} />
                  {pending ? vt(spanish, "Starting", "Iniciando") : vt(spanish, "Generate video", "Generar video")}
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
                      : vt(spanish, "Select frame images on the left to unlock generation.", "Selecciona fotogramas a la izquierda para habilitar la generacion.")}
                </p>
                {providerFrameLimitMessage ? <p className="mt-2 text-xs leading-5 text-[#31d4ff]">{providerFrameLimitMessage}</p> : null}
              </div>
            </div>

            <div className="rounded-[16px] border border-white/10 bg-black/16 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/44">{vt(spanish, "Generation setup", "Configuracion")}</p>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-white/62">
                <p>{vt(spanish, "Preset", "Ajuste")}: <span className="font-semibold text-white">{selectedTheme ? vt(spanish, "Automatic motion", "Movimiento automatico") : vt(spanish, "Loading", "Cargando")}</span></p>
                <p>{vt(spanish, "Duration", "Duracion")}: <span className="font-semibold text-white">{selectedDurationSeconds}s</span></p>
                <p>{vt(spanish, "Cost", "Costo")}: <span className="font-semibold text-white">{selectedCreditCost}</span></p>
              </div>
            </div>
          </div>

          <p className="mt-3 min-h-5 text-xs font-semibold leading-5 text-red-400" role="status">{message}</p>
        </div>
      </div>
    </section>
  );
}
