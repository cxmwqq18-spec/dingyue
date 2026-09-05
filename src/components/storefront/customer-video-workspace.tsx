"use client";

import { type Dispatch, type ReactNode, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Film, ImagePlus, Monitor, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import { DreamshootShowcasePreviewClient as DreamshootShowcasePreview } from "@/components/storefront/dreamshoot-showcase-preview-client";
import type { PublicCustomer, VideoTheme, VideoThemeCategory, VideoThemeExample } from "@/lib/types";
import {
  DEFAULT_VIDEO_PROMPT_PERSONA_ID,
  VIDEO_PROMPT_PERSONAS,
  type VideoPromptPersonaId
} from "@/lib/video-prompt-personas";
import {
  VIDEO_PROMPT_OPTIMIZATION_ASPECT_RATIOS,
  VIDEO_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH,
  type VideoPromptOptimizationAspectRatio
} from "@/lib/video-prompt-optimization-contract";
import { requestVideoPromptOptimization, type VideoPromptOptimizationRequestBody } from "@/lib/video-prompt-optimization-client";
import type { VideoPromptOptimizationResult } from "@/lib/video-prompt-optimizer";
import {
  AUTO_VIDEO_MODEL_FAMILY,
  DEFAULT_VIDEO_DURATION_SECONDS,
  DEFAULT_VIDEO_RESOLUTION,
  CUSTOMER_VIDEO_FRAME_LIMIT,
  VIDEO_RESOLUTIONS,
  normalizeVideoDurationSecondsForFrameCount,
  trimVideoFrameSelection,
  videoDurationCreditCostForModelFamilies,
  videoResolutionCreditCost,
  videoDurationOptionsForFrameCount,
  type VideoDurationSeconds,
  type VideoResolution
} from "@/lib/video-frame-config";
import {
  isGeminiVideoFrameMimeType
} from "@/lib/video-provider-policy";
import { videoThemePromptForEditor } from "@/lib/video-prompt-format";

type SubscriptionStatus = "loading" | "active" | "required" | "admin";
type VideoAspectRatio = VideoPromptOptimizationAspectRatio;
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
type VideoPromptOptimizationPreview = {
  sourcePrompt: string;
  contextSignature: string;
  result: VideoPromptOptimizationResult;
};
type PersistedVideoPromptOptimization = {
  sourcePrompt: string;
  contextSignature: string;
  idempotencyKey: string;
  body: VideoPromptOptimizationRequestBody;
};

function isVideoMediaSource(src: string): boolean {
  return /\.(?:mp4|webm|mov|m4v)(?:[?#]|$)/i.test(src) || /^data:video\//i.test(src);
}

function preferredThemeMediaSource(media: Pick<VideoTheme, "imageUrl" | "galleryImages"> | Pick<VideoThemeExample, "imageUrl" | "galleryImages">): { src?: string; posterSrc?: string } {
  const posterSrc = typeof media.imageUrl === "string" && media.imageUrl.trim() ? media.imageUrl.trim() : undefined;
  const videoSrc = media.galleryImages?.find((candidate) => typeof candidate === "string" && isVideoMediaSource(candidate.trim()))?.trim();
  return { src: videoSrc || posterSrc || media.galleryImages?.[0], posterSrc };
}

function ThemeMedia({
  src,
  posterSrc,
  className,
  alt = "",
  preview = false,
  previewTitle,
  previewMeta
}: {
  src?: string;
  posterSrc?: string;
  className: string;
  alt?: string;
  preview?: boolean;
  previewTitle?: string;
  previewMeta?: string;
}) {
  const normalizedSrc = typeof src === "string" ? src.trim() : "";
  const normalizedPosterSrc = typeof posterSrc === "string" ? posterSrc.trim() : "";
  const [retryingSrc, setRetryingSrc] = useState("");
  const [failedSrc, setFailedSrc] = useState("");
  const shouldShowFallback = !normalizedSrc || failedSrc === normalizedSrc;

  useEffect(() => {
    setRetryingSrc("");
    setFailedSrc("");
  }, [normalizedSrc]);

  if (shouldShowFallback && isVideoMediaSource(normalizedSrc) && normalizedPosterSrc && normalizedPosterSrc !== normalizedSrc) {
    return <ThemeMedia alt={alt} className={className} preview={preview} previewMeta={previewMeta} previewTitle={previewTitle} src={normalizedPosterSrc} />;
  }
  if (shouldShowFallback) {
    return <div className={`${className} grid place-items-center bg-white/[0.05]`} aria-hidden="true"><Film className="h-5 w-5 text-[#31d4ff]/65" /></div>;
  }
  if (isVideoMediaSource(normalizedSrc)) {
    return <video
      aria-label={alt || undefined}
      autoPlay
      className={className}
      data-dreamshoot-preview-meta={preview ? previewMeta : undefined}
      data-dreamshoot-preview-poster={preview ? normalizedPosterSrc : undefined}
      data-dreamshoot-preview-src={preview ? normalizedSrc : undefined}
      data-dreamshoot-preview-title={preview ? (previewTitle || alt || "Video preview") : undefined}
      data-dreamshoot-showcase-preview={preview ? "video" : undefined}
      loop
      muted
      onError={() => {
        if (!retryingSrc) {
          const separator = normalizedSrc.includes("?") ? "&" : "?";
          setRetryingSrc(`${normalizedSrc}${separator}media_retry=1`);
          return;
        }
        setFailedSrc(normalizedSrc);
      }}
      playsInline
      poster={normalizedPosterSrc || undefined}
      preload="metadata"
      src={retryingSrc || normalizedSrc}
    />;
  }
  const imageSrc = retryingSrc || normalizedSrc;
  return <img
    alt={alt}
    className={className}
    data-dreamshoot-preview-meta={preview ? previewMeta : undefined}
    data-dreamshoot-preview-src={preview ? normalizedSrc : undefined}
    data-dreamshoot-preview-title={preview ? (previewTitle || alt || "Image preview") : undefined}
    data-dreamshoot-showcase-preview={preview ? "image" : undefined}
    onError={() => {
      if (retryingSrc) {
        setFailedSrc(normalizedSrc);
        return;
      }
      const separator = normalizedSrc.includes("?") ? "&" : "?";
      setRetryingSrc(`${normalizedSrc}${separator}media_retry=1`);
    }}
    src={imageSrc}
  />;
}

const VIDEO_ASPECT_SHAPES: Record<VideoAspectRatio, string> = {
  "16:9": "aspect-[16/9] w-7",
  "4:3": "aspect-[4/3] w-6",
  "1:1": "aspect-square w-5",
  "3:4": "aspect-[3/4] h-6",
  "9:16": "aspect-[9/16] h-7"
};
const VIDEO_ASPECT_OPTIONS: Array<{ id: VideoAspectRatio; label: string; shape: string }> = VIDEO_PROMPT_OPTIMIZATION_ASPECT_RATIOS.map((id) => ({
  id,
  label: id,
  shape: VIDEO_ASPECT_SHAPES[id]
}));

const VIDEO_RESOLUTION_OPTIONS: Array<{ id: VideoResolution; label: string; note: string }> = [
  { id: VIDEO_RESOLUTIONS[0], label: "480P", note: "Standard" },
  { id: DEFAULT_VIDEO_RESOLUTION, label: "720P", note: "HD" },
  { id: VIDEO_RESOLUTIONS[2], label: "1080P", note: "Full HD" }
];

const PROMPT_DIRECTED_VIDEO_THEME_SLUG = "prompt-directed-motion";
const AI_VIDEO_PICKER_CATEGORY_SLUGS = new Set([
  "core-ai-creation",
  "social-creator",
  "marketing-commerce",
  "creative-lifestyle",
  "professional-business"
]);
const VIDEO_PROMPT_MAX_LENGTH = VIDEO_PROMPT_OPTIMIZATION_MAX_PROMPT_LENGTH;
const VIDEO_PROMPT_TEMPLATE = [
  "1. Subject: Describe the person or product, and what should stay the same in your reference images.",
  "",
  "2. Scene and look: Mention the location, lighting, mood, shape, and whether it should feel creator-led, cinematic, like travel footage, or like a product video.",
  "",
  "3. Movement: Describe the opening action, the main movement, the camera move, and how the video should end.",
  "",
  "4. Sound and boundaries: Include dialogue or ambient sound, and what to avoid, such as extra people, warped hands, product changes, text, watermarks, or unsafe content."
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

function displayVideoStyleName(theme: Pick<VideoTheme, "slug" | "name">): string {
  return theme.slug === PROMPT_DIRECTED_VIDEO_THEME_SLUG ? "Guided Motion" : theme.name;
}

function errorText(error: string | undefined, status: number, spanish: boolean) {
  if (status === 401 || error === "customer_login_required") return vt(spanish, "Please sign in again before generating video.", "Vuelve a iniciar sesion antes de generar video.");
  if (status === 403 || error?.includes("csrf")) return vt(spanish, "Your secure session expired. Refresh the page, then try again.", "Tu sesion segura expiro. Actualiza la pagina e intentalo de nuevo.");
  if (error === "subscription_required") return vt(spanish, "Choose a subscription or use enough credits before generating video.", "Elige una suscripcion o usa creditos suficientes antes de generar video.");
  if (error === "insufficient_credits") return vt(spanish, "Not enough credits for this video theme.", "No hay creditos suficientes para este tema de video.");
  if (error === "video_theme_required") return vt(spanish, "Video styles are still loading. Try again in a moment.", "Los estilos de video aun se estan cargando. Intentalo en un momento.");
  if (error === "ai_app_not_enabled_for_site") return vt(spanish, "Video creation is not available right now. No credits were reserved.", "La creacion de video no esta disponible ahora. No se reservaron creditos.");
  if (error === "video_frames_required" || error === "video_prompt_required") return vt(spanish, "Describe the video or select at least one reference image.", "Describe el video o selecciona al menos una imagen de referencia.");
  if (error === "video_frame_selection_required") return vt(spanish, "Your description refers to uploaded images. Select reference images on the left before creating the video.", "Tu descripcion menciona imagenes subidas. Selecciona imagenes de referencia a la izquierda antes de crear el video.");
  if (error === "too_many_video_frames") return vt(spanish, "This style allows fewer reference images.", "Este estilo permite menos imagenes de referencia.");
  if (error === "too_many_video_frames_for_provider") return vt(spanish, "This style allows fewer reference images. Remove some images and try again.", "Este estilo permite menos imagenes de referencia. Quita algunas imagenes e intentalo de nuevo.");
  if (error === "video_frame_asset_required") return vt(spanish, "Upload or select reference images before creating the video.", "Sube o selecciona imagenes de referencia antes de crear el video.");
  if (error === "unsupported_video_frame_type") return vt(spanish, "Video references need JPG or PNG images.", "Las referencias de video necesitan imagenes JPG o PNG.");
  if (error === "video_public_asset_url_required") return vt(spanish, "The selected reference images could not be read. Re-upload them and try again.", "No se pudieron leer las imagenes de referencia seleccionadas. Vuelve a subirlas e intentalo de nuevo.");
  if (error === "video_provider_temporarily_unavailable" || error === "no_video_ai_provider_configured") return vt(spanish, "Video creation is not available right now. No credits were reserved.", "La creacion de video no esta disponible ahora. No se reservaron creditos.");
  if (error === "missing_required_prompt_input") return vt(spanish, "Complete the required description before creating the video.", "Completa la descripcion necesaria antes de crear el video.");
  if (status === 409) return vt(spanish, "Another request is already running. Check All before starting a new one.", "Ya hay otra solicitud en ejecucion. Revisa Todo antes de iniciar otra.");
  return vt(spanish, "We could not create the video. Check your description and reference images, then try again.", "No pudimos crear el video. Revisa la descripcion y las imagenes de referencia e intentalo de nuevo.");
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

function videoCreditCostForOutput(
  theme: Pick<VideoTheme, "creditCost" | "modelPricing">,
  seconds: unknown,
  resolution: VideoResolution,
  modelFamilies?: VideoTheme["providerModelFamilies"]
): number {
  return videoResolutionCreditCost(videoDurationCostForCandidateFamilies(theme, seconds, modelFamilies), resolution);
}

function newVideoSubmitIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `video_${crypto.randomUUID()}`;
  return `video_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function newPromptOptimizationIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return `video_prompt_${crypto.randomUUID()}`;
  return `video_prompt_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function promptOptimizationStorageKey(siteId: string, customerId: string) {
  return `dingyue:video-prompt-optimization:${siteId}:${customerId}`;
}

function promptOptimizationErrorText(error: string | undefined, status: number, spanish: boolean, retryAfter?: number) {
  if (status === 401 || error === "customer_login_required") {
    return vt(spanish, "Please sign in again before improving the description.", "Vuelve a iniciar sesion antes de mejorar la descripcion.");
  }
  if (status === 403 || error?.includes("csrf")) {
    return vt(spanish, "Your secure session expired. Refresh the page, then try again.", "Tu sesion segura expiro. Actualiza la pagina e intentalo de nuevo.");
  }
  if (error === "video_prompt_optimization_limit_reached") {
    const hours = retryAfter ? Math.max(1, Math.ceil(retryAfter / 3600)) : undefined;
    return vt(
      spanish,
      hours ? `You have used the 10 free optimizations available in 24 hours. Try again in about ${hours} hour${hours === 1 ? "" : "s"}.` : "You have used the 10 free optimizations available in 24 hours. Try again later.",
      hours ? `Has usado las 10 optimizaciones gratuitas disponibles en 24 horas. Intentalo de nuevo en unas ${hours} hora${hours === 1 ? "" : "s"}.` : "Has usado las 10 optimizaciones gratuitas disponibles en 24 horas. Intentalo de nuevo mas tarde."
    );
  }
  if (status === 429 || error === "rate_limited") {
    return vt(spanish, "Too many improvement requests were sent at once. Wait a moment, then try again.", "Se enviaron demasiadas solicitudes de mejora a la vez. Espera un momento e intentalo de nuevo.");
  }
  if (error === "text_provider_not_configured") {
    return vt(spanish, "Description improvements are temporarily unavailable. Try again later.", "Las mejoras de descripcion no estan disponibles temporalmente. Intentalo mas tarde.");
  }
  if (error === "video_prompt_optimization_timeout") {
    return vt(spanish, "The description update is taking longer than expected. Your original description is unchanged.", "La mejora de la descripcion esta tardando mas de lo esperado. Tu descripcion original no ha cambiado.");
  }
  if (error === "video_prompt_optimization_wrong_language") {
    return vt(spanish, "The updated description was not returned in the expected language. Your original description is unchanged.", "La descripcion actualizada no se devolvio en el idioma esperado. Tu descripcion original no ha cambiado.");
  }
  if (error === "video_prompt_optimization_setting_conflict" || error === "video_prompt_optimization_settings_missing") {
    return vt(spanish, "The updated description included conflicting video settings. Your original description is unchanged.", "La descripcion actualizada incluyo ajustes de video incompatibles. Tu descripcion original no ha cambiado.");
  }
  if (error === "video_prompt_optimization_facts_missing") {
    return vt(spanish, "The updated description did not preserve every requested detail. Your original description is unchanged.", "La descripcion actualizada no conservo todos los detalles solicitados. Tu descripcion original no ha cambiado.");
  }
  if (error === "video_prompt_optimization_unverified_claim" || error === "video_prompt_optimization_unverified_numeric_claim" || error === "video_prompt_optimization_unverified_reference_content" || error === "video_prompt_optimization_safety_failed") {
    return vt(spanish, "The updated description included an unsafe or unverified claim. Your original description is unchanged.", "La descripcion actualizada incluyo una afirmacion insegura o no verificada. Tu descripcion original no ha cambiado.");
  }
  if (error === "video_prompt_optimization_invalid_json" || error === "video_prompt_optimization_empty_response" || error === "video_prompt_optimization_invalid_result") {
    return vt(spanish, "The description update returned an invalid response. Your original description is unchanged.", "La mejora de la descripcion devolvio una respuesta invalida. Tu descripcion original no ha cambiado.");
  }
  return vt(spanish, "The description could not be improved. Your original description is unchanged.", "No se pudo mejorar la descripcion. Tu descripcion original no ha cambiado.");
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
    `Your description mentions${conflictLabel}, but the selected video format is ${params.aspectRatio}. Switch the format or edit the description if needed.`,
    `Tu descripcion menciona${conflictLabel}, pero el formato seleccionado es ${params.aspectRatio}. Cambia el formato o edita la descripcion si hace falta.`
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
        "Your description asks to use uploaded or reference images, but none are selected. Select reference images on the left, or remove that image reference.",
        "Tu descripcion pide usar imagenes subidas o de referencia, pero no hay ninguna seleccionada. Selecciona imagenes de referencia a la izquierda o elimina esa referencia."
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
        "The video service may reject reference images with real or recognizable people. Product, object, landscape, pet, fictional, or stylized references are usually easier to process.",
        "El servicio de video puede rechazar imagenes de referencia con personas reales o reconocibles. Los productos, objetos, paisajes, mascotas y referencias ficticias o estilizadas suelen procesarse mejor."
      )
    });
  }
  if (promptHasNonNegatedMatch(prompt, MINOR_PROMPT_PATTERN)) {
    messages.push({
      id: "minor_policy_risk",
      severity: "warn",
      message: vt(
        params.spanish,
        "Risk: the video service may reject descriptions involving children, babies, or minors. Use adult-only, fictional/stylized, or non-person references where possible.",
        "Riesgo: el servicio de video puede rechazar descripciones con ninos, bebes o menores. Usa referencias solo de adultos, ficticias o estilizadas, o sin personas cuando sea posible."
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
        "Risk: celebrities, public figures, copyrighted characters, logos, watermarks, subtitles, or heavy visible text may be rejected. Use original references you have permission to use.",
        "Riesgo: celebridades, figuras publicas, personajes con copyright, logos, marcas de agua, subtitulos o mucho texto visible pueden rechazarse. Usa referencias originales que tengas permiso para utilizar."
      )
    });
  }
  return messages.slice(0, 4);
}

function isPromptFrameReferenceBlockingMessage(value: string) {
  return value.startsWith("Your description asks to use uploaded") || value.startsWith("Tu descripcion pide usar imagenes subidas");
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
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);
  const [expandedThemeCategoryIds, setExpandedThemeCategoryIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [themeReloadKey, setThemeReloadKey] = useState(0);
  const [textToVideoConfirmArmed, setTextToVideoConfirmArmed] = useState(false);
  const [textToVideoConfirmOpen, setTextToVideoConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [selectedPromptPersonaId, setSelectedPromptPersonaId] = useState<VideoPromptPersonaId>(DEFAULT_VIDEO_PROMPT_PERSONA_ID);
  const [promptOptimizationPending, setPromptOptimizationPending] = useState(false);
  const [promptOptimizationPreview, setPromptOptimizationPreview] = useState<VideoPromptOptimizationPreview | null>(null);
  const [promptOptimizationError, setPromptOptimizationError] = useState("");
  const [appliedPromptOptimization, setAppliedPromptOptimization] = useState<{ undoPrompt: string; contextSignature: string } | null>(null);
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
          setMessage((current) => initialThemes.length ? current : vt(spanish, "No active video styles are available yet.", "Aun no hay estilos de video activos."));
        }
      } catch {
        if (!controller.signal.aborted) {
          setMessage((current) => initialThemes.length ? current : vt(spanish, "Video styles could not load. Refresh this page and try again.", "No se pudieron cargar los estilos de video. Actualiza la pagina e intentalo de nuevo."));
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
  const themeCategoriesByParent = useMemo(() => {
    const grouped = new Map<string, VideoThemeCategory[]>();
    for (const category of allThemeCategories) {
      const parentId = category.parentId ?? "";
      const current = grouped.get(parentId) ?? [];
      current.push(category);
      grouped.set(parentId, current);
    }
    for (const categories of grouped.values()) {
      categories.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label));
    }
    return grouped;
  }, [allThemeCategories]);
  const themesByCategory = useMemo(() => {
    const grouped = new Map<string, VideoTheme[]>();
    for (const theme of themes) {
      if (!theme.category?.id) continue;
      const current = grouped.get(theme.category.id) ?? [];
      current.push(theme);
      grouped.set(theme.category.id, current);
    }
    for (const categoryThemes of grouped.values()) {
      categoryThemes.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
    return grouped;
  }, [themes]);
  const rootThemeCategories = themeCategoriesByParent.get("") ?? [];
  const aiVideoGenerationRoot: VideoThemeCategory = {
    id: "picker-ai-video-generation",
    siteId,
    slug: "ai-video-generation",
    label: "AI Video Generation",
    description: "Browse every AI video workflow and theme.",
    sortOrder: -1,
    status: "active",
    createdAt: ""
  };
  const aiVideoPickerCategories = rootThemeCategories.filter((category) => AI_VIDEO_PICKER_CATEGORY_SLUGS.has(category.slug));
  const pickerRootThemeCategories = [
    aiVideoGenerationRoot,
    ...rootThemeCategories.filter((category) => category.slug === "save-the-date")
  ];
  const aiVideoChildCategories = aiVideoPickerCategories;
  const categoryDepthById = useMemo(() => {
    const depths = new Map<string, number>();
    const depthFor = (categoryId: string, seen = new Set<string>()): number => {
      if (depths.has(categoryId)) return depths.get(categoryId)!;
      if (seen.has(categoryId)) return 0;
      const category = themeCategoryById.get(categoryId);
      if (!category?.parentId || !themeCategoryById.has(category.parentId)) {
        depths.set(categoryId, 0);
        return 0;
      }
      const depth = depthFor(category.parentId, new Set([...seen, categoryId])) + 1;
      depths.set(categoryId, depth);
      return depth;
    };
    for (const category of allThemeCategories) depthFor(category.id);
    return depths;
  }, [allThemeCategories, themeCategoryById]);
  const selectedThemeCategory = selectedTheme?.category
    ? themeCategoryById.get(selectedTheme.category.id) ?? selectedTheme.category
    : undefined;
  const pickerCategory = themePickerCategoryId === aiVideoGenerationRoot.id
    ? aiVideoGenerationRoot
    : themeCategoryById.get(themePickerCategoryId) ?? selectedThemeCategory ?? rootThemeCategories[0];
  const pickerTheme = themes.find((theme) => theme.id === themePickerThemeId) ?? selectedTheme;
  const pickerExamples = pickerTheme?.examples?.length ? pickerTheme.examples : pickerTheme ? [{
    id: `fallback-${pickerTheme.id}`,
    siteId: pickerTheme.siteId,
    themeId: pickerTheme.id,
    name: `${displayVideoStyleName(pickerTheme)} reference`,
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
    ? vt(spanish, `Selected reference images are used in the order shown for image-to-video.`, `Las imagenes de referencia seleccionadas se usan en el orden mostrado para crear el video.`)
    : "";
  const selectedCreditCost = selectedTheme
    ? selectedPricingModelFamilies
      ? videoCreditCostForOutput(selectedTheme, effectiveDurationSeconds, selectedResolution, selectedPricingModelFamilies)
      : videoCreditCostForOutput(selectedTheme, effectiveDurationSeconds, selectedResolution)
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
        `${unsupportedVideoFrames.length === 1 ? "This selected reference image will" : "These selected reference images will"} be converted to JPG before creation.`,
        `${unsupportedVideoFrames.length === 1 ? "Esta imagen de referencia seleccionada se convertira" : "Estas imagenes de referencia seleccionadas se convertiran"} a JPG antes de crear el video.`
      )
    : "";
  const needsTextToVideoConfirmation = isTextToVideo && trimmedPromptNote.length > 0;
  const textToVideoConfirmationMessage = vt(
    spanish,
    "No reference images are selected. The video will follow your description only. Select reference images on the left to guide the video, or continue if a description-only result is what you want.",
    "No hay imagenes de referencia seleccionadas. El video seguira solo tu descripcion. Selecciona imagenes de referencia a la izquierda para guiar el video o continua si quieres un resultado basado solo en la descripcion."
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
  const promptOptimizationContextSignature = `${selectedTheme?.id ?? ""}:${selectedFrameIds.length}:${effectiveDurationSeconds}:${selectedAspectRatio}:${selectedResolution}`;
  const promptOptimizationContextChanged = Boolean(
    appliedPromptOptimization && appliedPromptOptimization.contextSignature !== promptOptimizationContextSignature
  );
  const canOptimizePrompt = Boolean(
    trimmedPromptNote && selectedTheme && !isSubmitting && !promptOptimizationPending && !hasPendingFrameUploads
  );
  const generateButtonLabel = isSubmitting
    ? vt(spanish, "Creating…", "Creando…")
    : textToVideoConfirmArmed && needsTextToVideoConfirmation
      ? vt(spanish, "Create from description", "Crear desde la descripcion")
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
    setAppliedPromptOptimization(null);
    setPromptOptimizationPreview(null);
    setFormatPanelOpen(false);
    setMessage(retryDraft.restoreMessage ?? vt(spanish, "Previous video request restored. Review it, then create it again.", "Solicitud de video anterior restaurada. Revisala y vuelve a crearla."));
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
    setMessage(vt(spanish, "Select reference images on the left, then create the video.", "Selecciona imagenes de referencia a la izquierda y luego crea el video."));
    onOpenFrameManager();
  }

  function applyVideoPromptTemplate() {
    setPromptNote(VIDEO_PROMPT_TEMPLATE);
    setAppliedPromptOptimization(null);
    setPromptOptimizationPreview(null);
    setTextToVideoConfirmArmed(false);
    setTextToVideoConfirmOpen(false);
    setMessage(vt(spanish, "Template added. Edit each section, then create your video.", "Plantilla agregada. Edita cada seccion y luego crea tu video."));
  }

  function openThemePicker() {
    const category = selectedThemeCategory ?? rootThemeCategories[0];
    const theme = selectedTheme ?? themes[0];
    const example = selectedThemeExample ?? theme?.examples?.[0];
    setThemePickerCategoryId(category?.id ?? "");
    setThemePickerThemeId(theme?.id ?? "");
    setThemePickerExampleId(example?.id ?? "");
    setThemePickerPrompt(videoThemePromptForEditor(example?.prompt ?? theme?.prompt ?? ""));
    const expandedCategories = allThemeCategories
      .filter((item) => (categoryDepthById.get(item.id) ?? 0) <= 1)
      .map((item) => item.id);
    expandedCategories.push(aiVideoGenerationRoot.id);
    setExpandedCategoryIds(expandedCategories);
    setExpandedThemeCategoryIds([]);
    setThemePickerOpen(true);
  }

  function choosePickerTheme(theme: VideoTheme) {
    const example = theme.examples?.[0];
    if (theme.category) {
      setThemePickerCategoryId(theme.category.id);
      const ancestors: string[] = [];
      let current: VideoThemeCategory | undefined = theme.category;
      while (current) {
        ancestors.push(current.id);
        current = current.parentId ? themeCategoryById.get(current.parentId) : undefined;
      }
      setExpandedCategoryIds((expanded) => Array.from(new Set([...expanded, ...ancestors])));
    }
    setThemePickerThemeId(theme.id);
    setThemePickerExampleId(example?.id ?? "");
    setThemePickerPrompt(videoThemePromptForEditor(example?.prompt ?? theme.prompt));
  }

  function choosePickerCategory(category: VideoThemeCategory) {
    setThemePickerCategoryId(category.id);
    setThemePickerThemeId("");
    setThemePickerExampleId("");
    setThemePickerPrompt("");
    setExpandedCategoryIds((current) => current.includes(category.id) ? current : [...current, category.id]);
  }

  function choosePickerExample(example: VideoThemeExample) {
    setThemePickerExampleId(example.id);
    setThemePickerPrompt(videoThemePromptForEditor(example.prompt));
  }

  function confirmThemePicker() {
    if (!pickerTheme) return;
    const persistedExample = pickerTheme.examples?.find((example) => example.id === pickerExample?.id);
    setSelectedThemeId(pickerTheme.id);
    // Synthetic compatibility cards are UI-only and must not be submitted as persisted IDs.
    setSelectedThemeExampleId(persistedExample?.id ?? "");
    setPromptNote(themePickerPrompt.trim());
    setAppliedPromptOptimization(null);
    setPromptOptimizationPreview(null);
    setThemePickerOpen(false);
    setMessage(vt(spanish, `Applied ${displayVideoStyleName(pickerTheme)}${pickerExample ? ` / ${pickerExample.name}` : ""}. You can continue editing the description.`, `Se aplico ${displayVideoStyleName(pickerTheme)}${pickerExample ? ` / ${pickerExample.name}` : ""}. Puedes seguir editando la descripcion.`));
  }

  function themeCountForCategory(categoryId: string, seen = new Set<string>()): number {
    if (seen.has(categoryId)) return 0;
    const nextSeen = new Set([...seen, categoryId]);
    const directCount = themesByCategory.get(categoryId)?.length ?? 0;
    const children = categoryId === aiVideoGenerationRoot.id ? aiVideoChildCategories : (themeCategoriesByParent.get(categoryId) ?? []);
    const childCount = children.reduce((total, child) => total + themeCountForCategory(child.id, nextSeen), 0);
    return directCount + childCount;
  }

  function themesForCategory(categoryId: string, seen = new Set<string>()): VideoTheme[] {
    if (seen.has(categoryId)) return [];
    const nextSeen = new Set([...seen, categoryId]);
    const directThemes = themesByCategory.get(categoryId) ?? [];
    const childThemes = (themeCategoriesByParent.get(categoryId) ?? []).flatMap((child) => themesForCategory(child.id, nextSeen));
    return Array.from(new Map([...directThemes, ...childThemes].map((theme) => [theme.id, theme])).values()).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  function themeCategoryPath(theme: VideoTheme): string[] {
    const path: string[] = [];
    let category = theme.category ? themeCategoryById.get(theme.category.id) ?? theme.category : undefined;
    while (category) {
      path.unshift(category.label);
      category = category.parentId ? themeCategoryById.get(category.parentId) : undefined;
    }
    if (path.length && path[0] !== "AI Video Generation" && path[0] !== "Save the Date") {
      path.unshift("AI Video Generation");
    }
    return path;
  }

  function renderThemeCategory(category: VideoThemeCategory, depth = 0): ReactNode {
    const children = category.id === aiVideoGenerationRoot.id
      ? aiVideoChildCategories
      : category.slug === "save-the-date"
        ? (themeCategoriesByParent.get(category.id) ?? [])
        : [];
    const categoryThemes = children.length ? [] : themesForCategory(category.id);
    const hasExpandableContent = children.length > 0 || categoryThemes.length > 0;
    const categoryExpanded = expandedCategoryIds.includes(category.id);
    const themesExpanded = expandedThemeCategoryIds.includes(category.id);
    const hasChildren = children.length > 0;
    const contentExpanded = hasChildren ? categoryExpanded : themesExpanded;
    const categoryIsSelected = pickerCategory?.id === category.id;
    const categoryCount = themeCountForCategory(category.id);
    const categoryLabel = categoryCount > 0 ? `${category.label} ${categoryCount}` : category.label;
    const categoryAction = hasExpandableContent ? (contentExpanded ? "Collapse" : "Expand") : "Select";
    const toggleCategoryContent = () => {
      if (!hasExpandableContent) {
        choosePickerCategory(category);
        return;
      }
      if (hasChildren) {
        setExpandedCategoryIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id]);
      } else {
        setExpandedThemeCategoryIds((current) => current.includes(category.id) ? current.filter((id) => id !== category.id) : [...current, category.id]);
      }
    };
    return (
      <div key={category.id}>
        <div style={{ paddingLeft: `${Math.min(depth, 5) * 12}px` }}>
          <button
            aria-label={`${categoryAction} ${categoryLabel}`}
            aria-expanded={hasExpandableContent ? contentExpanded : undefined}
            className={`flex min-w-0 w-full items-center rounded-[10px] py-1 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#31d4ff]/45 ${categoryIsSelected ? "bg-[#31d4ff]/12 text-[#bcefff]" : "text-white/68 hover:bg-white/[0.06] hover:text-white"}`}
            onClick={toggleCategoryContent}
            type="button"
          >
            <span aria-hidden="true" className={`grid h-8 w-8 shrink-0 place-items-center text-white/45 ${hasExpandableContent ? "" : "invisible"}`}>
              <ChevronRight className={`h-3.5 w-3.5 transition ${contentExpanded ? "rotate-90" : ""}`} strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1 truncate px-1">{category.label}</span>
            <span className="ml-2 shrink-0 text-xs text-white/35">{themeCountForCategory(category.id)}</span>
            <span aria-hidden="true" className="w-2 shrink-0" />
          </button>
        </div>
        {contentExpanded ? (
          <div className="grid gap-1 border-l border-white/10" style={{ marginLeft: `${Math.min(depth, 5) * 12 + 19}px` }}>
            {children.map((child) => renderThemeCategory(child, depth + 1))}
            {categoryThemes.length > 0 && themesExpanded ? (
              <div className="mt-1 grid gap-1 px-1">
                {categoryThemes.map((theme) => (
                  <button
                    className={`flex items-center gap-2 rounded-[9px] px-2 py-2 text-left text-sm transition ${pickerTheme?.id === theme.id ? "bg-[#31d4ff]/14 text-[#d8f7ff]" : "text-white/58 hover:bg-white/[0.06] hover:text-white"}`}
                    key={theme.id}
                    onClick={() => choosePickerTheme(theme)}
                    type="button"
                  >
                    <ThemeMedia className="h-8 w-11 shrink-0 rounded-[5px] object-cover" src={theme.imageUrl} />
                    <span className="min-w-0 truncate">{theme.name}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  async function optimizeCurrentVideoPrompt(
    sourcePrompt = trimmedPromptNote,
    persistedRequest?: PersistedVideoPromptOptimization
  ) {
    const normalizedSource = sourcePrompt.trim();
    if (!normalizedSource || (!selectedTheme && !persistedRequest) || isSubmitting || promptOptimizationPending) return;
    if (!persistedRequest && hasPendingFrameUploads) {
      setPromptOptimizationError(vt(spanish, "Wait for the selected reference images to finish uploading before improving the description.", "Espera a que terminen de subir las imagenes de referencia seleccionadas antes de mejorar la descripcion."));
      return;
    }

    const requestedPersonaId = persistedRequest?.body.personaId ?? selectedPromptPersonaId;
    const requestedLocale: "en" | "es" = persistedRequest?.body.locale ?? (spanish ? "es" : "en");
    const requestedContextSignature = persistedRequest?.contextSignature ?? promptOptimizationContextSignature;
    const idempotencyKey = persistedRequest?.idempotencyKey ?? newPromptOptimizationIdempotencyKey();
    const requestBody: VideoPromptOptimizationRequestBody = persistedRequest?.body ?? {
      customerId: customer.id,
      prompt: normalizedSource,
      personaId: requestedPersonaId,
      locale: requestedLocale,
      videoThemeId: selectedTheme!.id,
      frameAssetIds: selectedFrameIds,
      durationSeconds: effectiveDurationSeconds,
      aspectRatio: selectedAspectRatio,
      resolution: selectedResolution
    };
    const storageKey = promptOptimizationStorageKey(siteId, customer.id);
    if (!persistedRequest) {
      try {
        window.localStorage.setItem(storageKey, JSON.stringify({
          sourcePrompt: normalizedSource,
          contextSignature: requestedContextSignature,
          idempotencyKey,
          body: requestBody
        } satisfies PersistedVideoPromptOptimization));
      } catch {
        // Storage can be disabled; the in-page overlay still prevents duplicate clicks.
      }
    }

    setPromptOptimizationPending(true);
    setPromptOptimizationError("");
    setMessage("");
    try {
      const result = await requestVideoPromptOptimization({
        siteId,
        body: requestBody,
        idempotencyKey,
        headers: () => customerJsonHeaders(siteId),
        refreshCsrf: async () => {
          await fetch(`/api/sites/${siteId}/customer/runtime?profile=workspace&refresh=csrf-${Date.now()}`, { cache: "no-store" }).catch(() => null);
        }
      });
      setPromptOptimizationPreview({ sourcePrompt: normalizedSource, contextSignature: requestedContextSignature, result });
      setPromptOptimizationError("");
    } catch (error) {
      const failure = error as Error & { status?: number; retryAfter?: number };
      const errorMessage = promptOptimizationErrorText(failure.message, failure.status ?? 0, spanish, failure.retryAfter);
      setPromptOptimizationError(errorMessage);
      setMessage(errorMessage);
    } finally {
      setPromptOptimizationPending(false);
      try {
        const stored = window.localStorage.getItem(storageKey);
        if (!stored || (JSON.parse(stored) as Partial<PersistedVideoPromptOptimization>).idempotencyKey === idempotencyKey) {
          window.localStorage.removeItem(storageKey);
        }
      } catch {
        // Ignore storage cleanup failures.
      }
    }
  }

  useEffect(() => {
    if (!selectedTheme || promptOptimizationPending) return;
    try {
      const raw = window.localStorage.getItem(promptOptimizationStorageKey(siteId, customer.id));
      if (!raw) return;
      const persisted = JSON.parse(raw) as PersistedVideoPromptOptimization;
      if (!persisted?.sourcePrompt || !persisted?.idempotencyKey || !persisted?.body) return;
      void optimizeCurrentVideoPrompt(persisted.sourcePrompt, persisted);
    } catch {
      window.localStorage.removeItem(promptOptimizationStorageKey(siteId, customer.id));
    }
    // The function intentionally captures the current editor state; the persisted request supplies its own immutable payload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer.id, promptOptimizationPending, selectedTheme, siteId]);

  function applyPromptOptimization() {
    if (!promptOptimizationPreview) return;
    setPromptNote(promptOptimizationPreview.result.optimizedPrompt);
    setAppliedPromptOptimization({
      undoPrompt: promptOptimizationPreview.sourcePrompt,
      contextSignature: promptOptimizationPreview.contextSignature
    });
    setPromptOptimizationPreview(null);
    setPromptOptimizationError("");
    setTextToVideoConfirmArmed(false);
    setTextToVideoConfirmOpen(false);
    setMessage(vt(spanish, "Improved description applied. Video creation has not started and no credits were used.", "Descripcion mejorada aplicada. La creacion de video no ha comenzado y no se usaron creditos."));
  }

  function undoPromptOptimization() {
    if (!appliedPromptOptimization) return;
    setPromptNote(appliedPromptOptimization.undoPrompt);
    setAppliedPromptOptimization(null);
    setPromptOptimizationError("");
    setMessage(vt(spanish, "The previous description has been restored.", "Se restauro la descripcion anterior."));
  }

  async function generateVideo(options: { confirmedTextToVideo?: boolean } = {}) {
    if (isSubmitting || promptOptimizationPending) return;
    if (!selectedTheme) {
      setThemeReloadKey((current) => current + 1);
      setMessage(vt(spanish, "Video styles are still loading. Try again in a moment.", "Los estilos de video aun se estan cargando. Intentalo en un momento."));
      return;
    }
    if (!selectedFrameIds.length && !trimmedPromptNote) {
      setMessage(vt(spanish, "Describe the video you want, or select reference images on the left to guide it.", "Describe el video que quieres o selecciona imagenes de referencia a la izquierda para guiarlo."));
      return;
    }
    if (blockingPromptRisk) {
      setTextToVideoConfirmArmed(false);
      setTextToVideoConfirmOpen(false);
      setMessage(blockingPromptRisk.message);
      return;
    }
    if (selectedFrameIds.length && (hasPendingFrameUploads || !generationFrameIds.length)) {
      setMessage(vt(spanish, "Reference image uploads are still finishing. Create the video after every selected image is ready.", "Las imagenes de referencia aun se estan subiendo. Crea el video cuando todas esten listas."));
      return;
    }
    if (unsupportedVideoFrames.length) {
      if (!onPrepareVideoFrames) {
        setMessage(vt(spanish, "This selected reference image is not ready. Re-upload it as JPG or PNG.", "Esta imagen de referencia no esta lista. Vuelve a subirla como JPG o PNG."));
        return;
      }
      setPending(true);
      setMessage(vt(spanish, "Preparing the selected reference images…", "Preparando las imagenes de referencia seleccionadas…"));
      try {
        const normalizedFrameIds = await onPrepareVideoFrames(generationFrameIds);
        if (normalizedFrameIds.length !== generationFrameIds.length || normalizedFrameIds.some((assetId) => !assetId)) {
          throw new Error("video_frame_conversion_failed");
        }
        submitFrameIds = normalizedFrameIds;
        setSelectedFrameIds(normalizedFrameIds);
      } catch {
        setPending(false);
        setMessage(vt(spanish, "The selected reference image could not be prepared. Re-upload it as JPG or PNG.", "No se pudo preparar la imagen de referencia. Vuelve a subirla como JPG o PNG."));
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
    setMessage(vt(spanish, "Creating your video and reserving credits…", "Creando tu video y reservando creditos…"));
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
          videoThemeName: displayVideoStyleName(selectedTheme),
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
            <h2 className="text-base font-semibold">{vt(spanish, "Create a video clip", "Crear un clip de video")}</h2>
            <p className="mt-1 text-xs text-white/50">
              {vt(spanish, "Use reference images to guide the clip, or leave them empty and describe the video you want.", "Usa imagenes de referencia para guiar el clip o dejalas vacias y describe el video que quieres.")}
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
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{vt(spanish, "Video creation", "Creacion de video")}</p>
              <h3 className="mt-2 text-xl font-semibold">{vt(spanish, "Describe the video you want", "Describe el video que quieres")}</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/56">
                {vt(spanish, "Use selected reference images to guide the video, or write a description when you want to create from text alone.", "Usa imagenes de referencia seleccionadas para guiar el video o escribe una descripcion si quieres crearlo solo con texto.")}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                aria-label={vt(spanish, "Choose a video style", "Elegir un estilo de video")}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#ff9d42]/35 bg-[#ff9d42]/10 px-3 text-xs font-semibold text-[#ffd9b0] transition hover:border-[#ff9d42]/60 hover:bg-[#ff9d42]/16 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#ff9d42]/45"
                onClick={openThemePicker}
                type="button"
              >
                <Film className="h-3.5 w-3.5" strokeWidth={1.9} />
                {vt(spanish, "Choose style", "Elegir estilo")}
              </button>
              <button
                aria-label={vt(spanish, "Use a video description template", "Usar una plantilla de descripcion de video")}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#31d4ff]/30 bg-[#31d4ff]/10 px-3 text-xs font-semibold text-[#d8f7ff] transition hover:border-[#31d4ff]/55 hover:bg-[#31d4ff]/16 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#31d4ff]/45"
                onClick={applyVideoPromptTemplate}
                type="button"
              >
                <Sparkles className="h-3.5 w-3.5" strokeWidth={1.9} />
                {vt(spanish, "Use template", "Usar plantilla")}
              </button>
              <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/62">
                {selectedFrameIds.length}/{maxFrames} {vt(spanish, "reference images", "imagenes de referencia")}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-[16px] border border-[#31d4ff]/20 bg-[#31d4ff]/10 p-4 text-[#d8f7ff]">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#31d4ff]" strokeWidth={1.9} />
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-5">
                {vt(spanish, "We choose the best available video service automatically. Upload JPG or PNG reference images when you want the clip to follow them; leave them empty to create from your description alone.", "Elegimos automaticamente el mejor servicio de video disponible. Sube imagenes de referencia JPG o PNG cuando quieras que el clip las siga; dejalas vacias para crear solo con tu descripcion.")}
              </p>
              <p className="mt-1 text-xs leading-5 text-[#d8f7ff]/72">
                {vt(spanish, "For the best results, use clear images and descriptions. Avoid minors, nudity, celebrity or public figures, copyrighted characters, violence, hate, illegal activity, weapons, self-harm, sensitive documents, watermarks, large text, blurry images, or private images.", "Para obtener mejores resultados, usa imagenes y descripciones claras. Evita menores, desnudez, celebridades o figuras publicas, personajes con copyright, violencia, odio, actividad ilegal, armas, autolesion, documentos sensibles, marcas de agua, mucho texto, imagenes borrosas o imagenes privadas.")}
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-white/10 bg-[#1a1d24] p-3 sm:p-4">
            <div className="mb-3 border-b border-white/10 pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{vt(spanish, "Creative direction", "Direccion creativa")}</p>
                  <p className="mt-1 text-xs text-white/42">{vt(spanish, "Choose a direction, then select Improve description.", "Elige una direccion y luego selecciona Mejorar descripcion.")}</p>
                </div>
                <button
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[#7c4dff] px-4 text-xs font-semibold text-white transition hover:bg-[#8c63ff] disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={!canOptimizePrompt}
                  onClick={() => void optimizeCurrentVideoPrompt()}
                  type="button"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${promptOptimizationPending ? "animate-pulse" : ""}`} strokeWidth={1.9} />
                  {promptOptimizationPending
                    ? vt(spanish, "Improving…", "Mejorando…")
                    : vt(spanish, "Improve description", "Mejorar descripcion")}
                </button>
              </div>
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label={vt(spanish, "Creative directions", "Direcciones creativas")}>
                {VIDEO_PROMPT_PERSONAS.map((persona) => {
                  const selected = persona.id === selectedPromptPersonaId;
                  return (
                    <button
                      aria-pressed={selected}
                      className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition ${selected ? "border-[#9b7bff]/65 bg-[#7c4dff]/22 text-[#e8e0ff]" : "border-white/10 bg-white/[0.035] text-white/58 hover:border-white/22 hover:text-white"}`}
                      disabled={promptOptimizationPending}
                      key={persona.id}
                      onClick={() => setSelectedPromptPersonaId(persona.id)}
                      type="button"
                    >
                      {persona.labels[spanish ? "es" : "en"]}
                    </button>
                  );
                })}
              </div>
              {hasPendingFrameUploads && trimmedPromptNote ? (
                <p className="mt-2 text-xs text-amber-200/80">{vt(spanish, "Description improvements will be available after the selected reference images finish uploading.", "Las mejoras de descripcion estaran disponibles cuando terminen de subir las imagenes de referencia seleccionadas.")}</p>
              ) : null}
              {promptOptimizationError ? <p className="mt-2 text-xs font-semibold leading-5 text-red-300" role="status">{promptOptimizationError}</p> : null}
            </div>
            <label className="block">
              <span className="sr-only">{vt(spanish, "Video description", "Descripcion de video")}</span>
              <textarea
                className="min-h-[156px] w-full resize-y rounded-[14px] border border-transparent bg-transparent px-2 py-2 text-base leading-7 text-white outline-none transition placeholder:text-white/28 focus:border-[#31d4ff]/55 focus:bg-black/14 sm:min-h-[172px]"
                maxLength={VIDEO_PROMPT_MAX_LENGTH}
                onChange={(event) => {
                  setPromptNote(event.target.value);
                  setAppliedPromptOptimization(null);
                  setPromptOptimizationError("");
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
                  `Describe the video. Add reference images on the left when you want the clip to follow them; leave them empty to create from your description alone.`,
                  `Describe el video. Agrega imagenes de referencia a la izquierda cuando quieras que el clip las siga; dejalas vacias para crear solo con tu descripcion.`
                )}
                value={promptNote}
              />
            </label>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-white/36">{promptNote.length} / {VIDEO_PROMPT_MAX_LENGTH}</span>
              {appliedPromptOptimization ? (
                <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-semibold ${promptOptimizationContextChanged ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"}`}>
                  {promptOptimizationContextChanged
                    ? vt(spanish, "Video settings changed, improve again if needed", "La configuracion cambio; mejora de nuevo si hace falta")
                    : vt(spanish, "Description improved", "Descripcion mejorada")}
                  <button className="inline-flex items-center gap-1 text-white underline decoration-white/35 underline-offset-2" onClick={undoPromptOptimization} type="button">
                    <RotateCcw className="h-3 w-3" strokeWidth={2} />
                    {vt(spanish, "Undo", "Deshacer")}
                  </button>
                </span>
              ) : null}
            </div>
            {selectedTheme && (selectedThemeExample || selectedThemeCategory) ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/58">
                <span className="font-semibold uppercase tracking-[0.13em] text-white/36">{vt(spanish, "Style reference", "Referencia de estilo")}</span>
                {selectedThemeCategory?.label ? <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{selectedThemeCategory.label}</span> : null}
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">{displayVideoStyleName(selectedTheme)}</span>
                {selectedThemeExample?.name ? <span className="rounded-full border border-[#31d4ff]/25 bg-[#31d4ff]/10 px-2.5 py-1 text-[#bcefff]">{selectedThemeExample.name}</span> : null}
              </div>
            ) : null}
            {promptRiskMessages.length ? (
              <div className="mt-3 flex items-start gap-2 rounded-[12px] border border-amber-300/18 bg-amber-300/[0.08] p-3 text-amber-50">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" strokeWidth={1.9} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-200/82">{vt(spanish, "Description check", "Revision de la descripcion")}</p>
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
                  {isTextToVideo ? vt(spanish, "Description only", "Solo descripcion") : vt(spanish, "Image to video", "Imagen a video")}
                </span>
                <span className="inline-flex min-h-9 items-center gap-2 rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/66">
                  <Sparkles className="h-4 w-4" strokeWidth={1.8} />
                  {selectedTheme ? vt(spanish, "Automatic movement", "Movimiento automatico") : vt(spanish, "Loading style", "Cargando estilo")}
                </span>
                <span className="inline-flex min-h-9 items-center rounded-[10px] border border-white/10 bg-white/[0.04] px-3 text-xs font-semibold text-white/66">
                  {selectedFrameIds.length}/{maxFrames} {vt(spanish, "selected", "seleccionadas")}
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
                      <p className="px-1 text-[11px] font-semibold text-white/36">{vt(spanish, "Shape", "Formato")}</p>
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
                      <p className="mt-4 px-1 text-[11px] font-semibold text-white/36">{vt(spanish, "Quality", "Calidad")}</p>
                      <div className="mt-2 grid grid-cols-1 gap-1 rounded-[12px] bg-white/[0.035] p-1">
                        {VIDEO_RESOLUTION_OPTIONS.map((option) => {
                          const selected = selectedResolution === option.id;
                          const cost = selectedTheme
                            ? selectedPricingModelFamilies
                              ? videoCreditCostForOutput(selectedTheme, effectiveDurationSeconds, option.id, selectedPricingModelFamilies)
                              : videoCreditCostForOutput(selectedTheme, effectiveDurationSeconds, option.id)
                            : 0;
                          return (
                            <button
                              className={`flex min-h-12 items-center justify-between rounded-[10px] px-3 text-left transition ${selected ? "bg-white/[0.1] text-white" : "text-white/58 hover:bg-white/[0.06] hover:text-white"}`}
                              key={option.id}
                              onClick={() => {
                                setSelectedResolution(option.id);
                                setFormatPanelOpen(false);
                              }}
                              type="button"
                            >
                              <span><span className="block text-sm font-semibold">{option.label}</span><span className="block text-[11px] text-white/42">{option.note}</span></span>
                              <span className="inline-flex items-center gap-2 text-xs font-semibold"><span>{cost} {vt(spanish, "credits", "creditos")}</span>{selected ? <Check className="h-3.5 w-3.5 text-[#31d4ff]" strokeWidth={2} /> : null}</span>
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
                        ? videoCreditCostForOutput(selectedTheme, option.seconds, selectedResolution, selectedPricingModelFamilies)
                        : videoCreditCostForOutput(selectedTheme, option.seconds, selectedResolution)
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
                  disabled={isSubmitting || promptOptimizationPending || !canGenerateCurrentVideo}
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
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/44">{vt(spanish, "Reference image order", "Orden de imagenes de referencia")}</p>
                <p className="mt-1 text-sm text-white/62">
                  {hasPendingFrameUploads
                    ? vt(spanish, "Some selected reference images are still uploading.", "Algunas imagenes de referencia seleccionadas aun se estan subiendo.")
                    : selectedFrameIds.length
                      ? vt(spanish, "The selected reference images on the left will guide the clip in this order.", "Las imagenes de referencia seleccionadas a la izquierda guiaran el clip en este orden.")
                      : vt(spanish, "No reference images selected. This video will follow only your written description.", "No hay imagenes de referencia seleccionadas. Este video seguira solo tu descripcion escrita.")}
                </p>
                {providerFrameLimitMessage && selectedFrameIds.length ? <p className="mt-2 text-xs leading-5 text-[#31d4ff]">{providerFrameLimitMessage}</p> : null}
                {unsupportedVideoFrameMessage ? <p className="mt-2 text-xs font-semibold leading-5 text-amber-200">{unsupportedVideoFrameMessage}</p> : null}
              </div>
            </div>

            <div className="rounded-[16px] border border-white/10 bg-black/16 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/44">{vt(spanish, "Video settings", "Ajustes de video")}</p>
              <div className="mt-3 grid gap-2 text-sm leading-6 text-white/62">
                <p>{vt(spanish, "Style", "Estilo")}: <span className="font-semibold text-white">{selectedTheme ? vt(spanish, "Automatic movement", "Movimiento automatico") : vt(spanish, "Loading", "Cargando")}</span></p>
                <p>{vt(spanish, "Format", "Formato")}: <span className="font-semibold text-white">{selectedAspectRatio} · {selectedResolution.toUpperCase()}</span></p>
                <p>{vt(spanish, "Duration", "Duracion")}: <span className="font-semibold text-white">{effectiveDurationSeconds}s</span></p>
                <p>{vt(spanish, "Cost", "Costo")}: <span className="font-semibold text-white">{selectedCreditCost}</span></p>
              </div>
            </div>
          </div>

          <p className="mt-3 min-h-5 text-xs font-semibold leading-5 text-red-400" role="status">{message}</p>
        </div>
      </div>
      {promptOptimizationPending ? (
        <div className="fixed inset-0 z-[140] grid place-items-center bg-black/72 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="prompt-optimization-progress-title">
          <div className="w-full max-w-md rounded-[22px] border border-[#9b7bff]/35 bg-[#111720] p-7 text-center text-white shadow-[0_30px_100px_-36px_rgba(0,0,0,0.96)]">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#9b7bff]/45 bg-[#7c4dff]/18">
              <Sparkles className="h-7 w-7 animate-pulse text-[#d8ceff]" strokeWidth={1.7} />
            </div>
            <h3 className="mt-5 text-xl font-semibold" id="prompt-optimization-progress-title">{vt(spanish, "Improving your description", "Mejorando tu descripcion")}</h3>
            <p className="mt-2 text-sm leading-6 text-white/62">{vt(spanish, "The AI director is preparing a clearer version. This usually takes a few seconds; please keep this page open.", "El director de IA esta preparando una version mas clara. Normalmente tarda unos segundos; manten esta pagina abierta.")}</p>
            <div className="mt-5 flex items-center justify-center gap-2 text-xs font-semibold text-[#d8ceff]" role="status" aria-live="polite">
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#b8a5ff] [animation-delay:-0.2s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#b8a5ff] [animation-delay:-0.1s]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-[#b8a5ff]" />
              {vt(spanish, "Working…", "Trabajando…")}
            </div>
            <p className="mt-4 text-[11px] text-white/38">{vt(spanish, "This window stays open until the update is complete. You do not need to select Improve description again.", "Esta ventana permanecera abierta hasta completar la mejora. No necesitas seleccionar Mejorar descripcion otra vez.")}</p>
          </div>
        </div>
      ) : null}
      {promptOptimizationPreview ? (
        <div className="fixed inset-0 z-[130] grid place-items-center bg-black/78 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="prompt-optimization-preview-title">
          <div className="flex max-h-[min(90dvh,880px)] w-full max-w-5xl flex-col overflow-hidden rounded-[22px] border border-white/14 bg-[#111720] text-white shadow-[0_30px_100px_-36px_rgba(0,0,0,0.96)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#b8a5ff]">{vt(spanish, "AI description improvement", "Mejora de descripcion con IA")}</p>
            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-100">{vt(spanish, "Free", "Gratis")}</span>
                </div>
                <h3 className="mt-1 text-xl font-semibold" id="prompt-optimization-preview-title">{vt(spanish, "Review before applying", "Revisa antes de aplicar")}</h3>
                <p className="mt-1 text-sm text-white/50">{vt(spanish, "Nothing changes until you apply this version. Video creation will not start.", "Nada cambia hasta que apliques esta version. La creacion de video no comenzara.")}</p>
              </div>
              <button
                aria-label={vt(spanish, "Close description preview", "Cerrar vista previa de descripcion")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 text-white/62 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                disabled={promptOptimizationPending}
                onClick={() => {
                  setPromptOptimizationPreview(null);
                  setPromptOptimizationError("");
                }}
                type="button"
              >
                <X className="h-4 w-4" strokeWidth={1.9} />
              </button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 lg:grid-cols-2">
              <div className="rounded-[16px] border border-white/10 bg-black/18 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/44">{vt(spanish, "Original description", "Descripcion original")}</p>
                  <span className="text-[11px] text-white/32">{promptOptimizationPreview.sourcePrompt.length}</span>
                </div>
                <p className="mt-3 max-h-[46dvh] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-white/66">{promptOptimizationPreview.sourcePrompt}</p>
              </div>
              <div className="rounded-[16px] border border-[#9b7bff]/30 bg-[#7c4dff]/10 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d8ceff]">{vt(spanish, "Improved description", "Descripcion mejorada")}</p>
                  <span className="text-[11px] text-white/40">{promptOptimizationPreview.result.optimizedPrompt.length}</span>
                </div>
                <p className="mt-3 max-h-[46dvh] overflow-y-auto whitespace-pre-wrap text-sm leading-7 text-white/82">{promptOptimizationPreview.result.optimizedPrompt}</p>
              </div>
              {promptOptimizationError ? <p className="lg:col-span-2 rounded-[12px] border border-red-300/20 bg-red-300/10 p-3 text-sm font-semibold text-red-100" role="status">{promptOptimizationError}</p> : null}
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-end">
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-semibold text-white/72 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                disabled={promptOptimizationPending}
                onClick={() => {
                  setPromptOptimizationPreview(null);
                  setPromptOptimizationError("");
                }}
                type="button"
              >
                {vt(spanish, "Cancel", "Cancelar")}
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#9b7bff]/45 bg-[#7c4dff]/12 px-5 text-sm font-semibold text-[#e5ddff] transition hover:bg-[#7c4dff]/22 disabled:opacity-40"
                disabled={promptOptimizationPending}
                onClick={() => void optimizeCurrentVideoPrompt(promptOptimizationPreview.sourcePrompt)}
                type="button"
              >
                <RotateCcw className={`h-4 w-4 ${promptOptimizationPending ? "animate-spin" : ""}`} strokeWidth={1.9} />
                {promptOptimizationPending ? vt(spanish, "Regenerating…", "Regenerando…") : vt(spanish, "Regenerate", "Regenerar")}
              </button>
              <button
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#7c4dff] px-5 text-sm font-semibold text-white transition hover:bg-[#8c63ff] disabled:opacity-40"
                disabled={promptOptimizationPending}
                onClick={applyPromptOptimization}
                type="button"
              >
                <Check className="h-4 w-4" strokeWidth={2} />
                {vt(spanish, "Apply improved description", "Aplicar descripcion mejorada")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {textToVideoConfirmOpen ? (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/78 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="text-to-video-confirm-title">
          <div className="w-full max-w-lg overflow-hidden rounded-[22px] border border-white/14 bg-[#111720] text-white shadow-[0_30px_100px_-36px_rgba(0,0,0,0.96)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] border border-amber-300/30 bg-amber-300/12 text-amber-200">
                  <AlertTriangle className="h-5 w-5" strokeWidth={1.9} />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-200/80">{vt(spanish, "Reference image check", "Revision de imagenes de referencia")}</p>
                  <h3 className="mt-1 text-xl font-semibold" id="text-to-video-confirm-title">{vt(spanish, "No reference images selected", "No hay imagenes de referencia seleccionadas")}</h3>
                </div>
              </div>
              <button
                aria-label={vt(spanish, "Close description-only warning", "Cerrar aviso de solo descripcion")}
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
                  {vt(spanish, "Select reference images", "Seleccionar imagenes de referencia")}
                </button>
                <button
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#2f6fed] px-5 text-sm font-semibold text-white transition hover:bg-[#4380ff] disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isSubmitting || promptOptimizationPending}
                  onClick={() => {
                    setTextToVideoConfirmArmed(true);
                    setTextToVideoConfirmOpen(false);
                    void generateVideo({ confirmedTextToVideo: true });
                  }}
                  type="button"
                >
                  <Send className="h-4 w-4" strokeWidth={1.8} />
                  {vt(spanish, "Create from description", "Crear desde la descripcion")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {themePickerOpen ? (
        <div className="fixed inset-0 z-[125] grid place-items-center bg-black/78 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="video-theme-picker-title">
          <div className="flex h-[min(92dvh,980px)] max-h-[calc(100dvh-2rem)] w-[min(96vw,1800px)] max-w-none flex-col overflow-hidden rounded-[22px] border border-white/14 bg-[#0d1118] text-white shadow-[0_30px_100px_-36px_rgba(0,0,0,0.96)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#31d4ff]">{vt(spanish, "Video themes", "Temas de video")}</p>
                <h3 className="mt-1 text-xl font-semibold" id="video-theme-picker-title">{vt(spanish, "Choose a theme and reference case", "Elige un tema y un caso de referencia")}</h3>
                <p className="mt-1 text-sm text-white/52">{vt(spanish, "Browse every active category, then edit the video description before applying it.", "Explora todas las categorias activas y edita la descripcion del video antes de aplicarla.")}</p>
              </div>
              <button aria-label={vt(spanish, "Close theme picker", "Cerrar selector de temas")} className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 text-white/62 transition hover:bg-white/[0.08] hover:text-white" onClick={() => setThemePickerOpen(false)} type="button"><X className="h-4 w-4" strokeWidth={1.9} /></button>
            </div>
            <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-5 lg:grid-cols-[minmax(280px,0.34fr)_minmax(0,1fr)]">
              <div className="min-h-0 overflow-y-auto rounded-[16px] border border-white/10 bg-black/16 p-3">
                <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Categories", "Categorias")}</p>
                <div className="grid gap-1">
                  {pickerRootThemeCategories.map((root) => renderThemeCategory(root))}
                  {!rootThemeCategories.length ? <p className="rounded-[10px] border border-dashed border-white/10 p-5 text-sm text-white/45">{vt(spanish, "No active theme categories are available.", "No hay categorias de temas activas disponibles.")}</p> : null}
                </div>
              </div>
              <DreamshootShowcasePreview className="contents">
              <div className="min-h-0 overflow-y-auto rounded-[16px] border border-white/10 bg-black/16 p-5">
                {pickerTheme ? <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Style details", "Detalles del estilo")}</p><h4 className="mt-1 text-2xl font-semibold">{displayVideoStyleName(pickerTheme)}</h4><p className="mt-2 max-w-2xl text-sm leading-6 text-white/58">{pickerTheme.headline}</p><p className="mt-2 text-xs text-[#8bdfff]">{themeCategoryPath(pickerTheme).join(" / ")}</p></div>
                    <span className="text-xs text-white/40">{pickerExamples.length} {vt(spanish, "reference cases", "casos de referencia")}</span>
                  </div>
                  <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(220px,0.44fr)_minmax(0,1fr)]">
                    <ThemeMedia alt={pickerTheme.name} className="aspect-[4/3] w-full max-h-[260px] rounded-[12px] object-cover" preview previewMeta={pickerTheme.description} previewTitle={pickerTheme.name} src={pickerTheme.imageUrl} />
                    <div><p className="text-sm leading-7 text-white/72">{pickerTheme.description}</p><div className="mt-4 grid max-w-[520px] grid-cols-2 gap-2 text-xs">{[[vt(spanish, "Credits", "Creditos"), pickerTheme.creditCost], [vt(spanish, "Video settings", "Ajustes de video"), `${effectiveDurationSeconds}s · ${selectedAspectRatio} · ${selectedResolution.toUpperCase()}`], [vt(spanish, "Reference image limit", "Limite de imagenes de referencia"), pickerTheme.effectiveMaxFrames ?? pickerTheme.maxFrames], [vt(spanish, "Works with", "Funciona con"), pickerTheme.imageToVideoProviderModelFamilies?.length ? vt(spanish, "Reference images + description", "Imagenes de referencia + descripcion") : vt(spanish, "Description only", "Solo descripcion")]].map(([label, value]) => <div className="rounded-[10px] border border-white/8 bg-white/[0.03] px-3 py-2.5 text-center" key={String(label)}><span className="block text-[11px] text-white/35">{label}</span><strong className="mt-1 block text-white">{value}</strong></div>)}</div></div>
                  </div>
                  <div className="mt-6 grid gap-4 lg:grid-cols-2"><div className="rounded-[12px] border border-white/8 bg-white/[0.025] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Best for", "Ideal para")}</p><p className="mt-2 text-sm leading-6 text-white/65">{pickerTheme.headline} {vt(spanish, "Use a clear subject, one focal action, and a controlled camera move for the most consistent result.", "Usa un sujeto claro, una accion principal y un movimiento de camara controlado para obtener un resultado consistente.")}</p></div><div className="rounded-[12px] border border-white/8 bg-white/[0.025] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Production notes", "Notas de produccion")}</p><p className="mt-2 text-sm leading-6 text-white/65">{vt(spanish, "Keep the reference image sharp and well lit. Avoid extra subjects, heavy text, logos, watermarks, or sudden scene changes.", "Manten la imagen de referencia nitida y bien iluminada. Evita sujetos adicionales, mucho texto, logotipos, marcas de agua o cambios bruscos de escena.")}</p></div></div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-[12px] border border-white/8 bg-white/[0.025] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Visual focus", "Enfoque visual")}</p><p className="mt-2 text-sm leading-6 text-white/65">{pickerTheme.headline}</p></div><div className="rounded-[12px] border border-white/8 bg-white/[0.025] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Recommended input", "Entrada recomendada")}</p><p className="mt-2 text-sm leading-6 text-white/65">{pickerTheme.imageToVideoProviderModelFamilies?.length ? vt(spanish, "A sharp JPG or PNG reference image with one clear subject.", "Una imagen de referencia JPG o PNG nitida con un sujeto claro.") : vt(spanish, "A concise written description with one focal action.", "Una descripcion escrita concisa con una accion principal.")}</p></div><div className="rounded-[12px] border border-white/8 bg-white/[0.025] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Video format", "Formato de video")}</p><p className="mt-2 text-sm leading-6 text-white/65">{effectiveDurationSeconds}s · {selectedAspectRatio} · {selectedResolution.toUpperCase()}<span className="mt-1 block text-xs text-white/38">{vt(spanish, "The video settings you choose here determine the final format.", "Los ajustes de video que elijas aqui determinan el formato final.")}</span></p></div></div>
                  <div className="mt-6"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "Reference cases", "Casos de referencia")}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{pickerExamples.map((example) => <button className={`rounded-[12px] border p-3 text-left transition ${pickerExample?.id === example.id ? "border-[#31d4ff]/45 bg-[#31d4ff]/10" : "border-white/8 bg-white/[0.025] hover:border-white/20"}`} key={example.id} onClick={(event) => { if (event.target instanceof Element && event.target.closest("[data-dreamshoot-showcase-preview]")) return; choosePickerExample(example); }} type="button"><ThemeMedia alt={example.name} className="mb-2 aspect-video w-full rounded-[8px] object-cover" preview previewMeta={example.description} previewTitle={example.name} {...preferredThemeMediaSource(example)} /><span className="block text-sm font-semibold">{example.name}</span><span className="mt-1 block line-clamp-2 text-xs leading-5 text-white/45">{example.description}</span></button>)}</div></div>
                  {pickerTheme.galleryImages?.length ? <div className="mt-6"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/38">{vt(spanish, "More visual references", "Mas referencias visuales")}</p><div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">{pickerTheme.galleryImages.slice(0, 4).map((imageUrl) => <ThemeMedia alt={vt(spanish, "Visual reference", "Referencia visual")} className="aspect-video w-full rounded-[9px] object-cover" key={imageUrl} posterSrc={pickerTheme.imageUrl} preview previewMeta={pickerTheme.name} previewTitle={pickerTheme.name} src={imageUrl} />)}</div></div> : null}
                  <label className="mt-6 block border-t border-white/10 pt-5"><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold uppercase tracking-[0.13em] text-white/40">{vt(spanish, "Video description", "Descripcion del video")}</span><span className="text-[11px] text-white/35">{themePickerPrompt.length} / 5000</span></div><p className="mt-1 text-xs leading-5 text-white/38">{pickerTheme.imageUrl ? vt(spanish, "This ready-to-use scene follows the cover's people, objects, setting, and light. Replace bracketed details only when needed.", "Esta escena lista para usar sigue las personas, objetos, entorno y luz de la portada. Sustituye los detalles entre corchetes solo cuando sea necesario.") : vt(spanish, "This style follows your uploaded reference image or written description without borrowing another style's content.", "Este estilo sigue tu imagen de referencia subida o tu descripcion escrita sin tomar contenido de otro estilo.")}</p><textarea className="mt-2 min-h-[150px] w-full resize-y rounded-[12px] border border-white/10 bg-[#080b10] p-3 text-sm leading-6 text-white/78 outline-none focus:border-[#31d4ff]/45" onChange={(event) => setThemePickerPrompt(event.target.value)} value={themePickerPrompt} /></label>
                </> : <div className="grid min-h-[520px] place-items-center text-center"><div><Film className="mx-auto h-10 w-10 text-white/25" /><p className="mt-3 text-sm font-semibold text-white/58">{vt(spanish, "Select a theme from the directory", "Selecciona un tema del directorio")}</p><p className="mt-1 text-xs text-white/38">{vt(spanish, "Expand a category, then open its themes.", "Expande una categoria y abre sus temas.")}</p></div></div>}
              </div>
              </DreamshootShowcasePreview>
            </div>
            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end"><button className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/14 px-5 text-sm font-semibold text-white/72 hover:bg-white/[0.08] hover:text-white" onClick={() => setThemePickerOpen(false)} type="button">{vt(spanish, "Cancel", "Cancelar")}</button><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-[#2f6fed] px-5 text-sm font-semibold text-white hover:bg-[#4380ff] disabled:opacity-45" disabled={!pickerTheme || !themePickerPrompt.trim()} onClick={confirmThemePicker} type="button"><Check className="h-4 w-4" strokeWidth={2} />{vt(spanish, "Apply style", "Aplicar estilo")}</button></div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
