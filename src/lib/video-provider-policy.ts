import type { VideoProviderProtocol } from "@/lib/video-provider-family";

export type VideoModelFamily = "grok" | "gemini";

export type VideoProviderFailureCode =
  | "real_person_reference_unsupported"
  | "minor_reference_unsupported"
  | "sexual_content_unsupported"
  | "violent_content_unsupported"
  | "rights_or_public_figure_unsupported"
  | "text_logo_watermark_unsupported"
  | "frame_url_unreadable"
  | "unsupported_frame_format"
  | "provider_rejected_reference";

export type VideoProviderFailure = {
  providerFamily?: VideoModelFamily;
  providerProtocol?: VideoProviderProtocol;
  code: VideoProviderFailureCode;
  customerMessage: string;
};

export const GEMINI_VIDEO_FRAME_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const GEMINI_VIDEO_FRAME_ACCEPT = "image/jpeg,image/png,.jpg,.jpeg,.png";

const videoProviderFailureCodes = new Set<VideoProviderFailureCode>([
  "real_person_reference_unsupported",
  "minor_reference_unsupported",
  "sexual_content_unsupported",
  "violent_content_unsupported",
  "rights_or_public_figure_unsupported",
  "text_logo_watermark_unsupported",
  "frame_url_unreadable",
  "unsupported_frame_format",
  "provider_rejected_reference"
]);

function textValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function stringFromUnknown(value: unknown, depth = 0): string {
  if (typeof value === "string") return value.trim();
  if (value instanceof Error) return value.message.trim();
  if (Array.isArray(value)) {
    return value.map((item) => stringFromUnknown(item, depth + 1)).filter(Boolean).join(" ");
  }
  const record = depth < 3 ? recordValue(value) : undefined;
  if (!record) return "";
  return [
    record.error,
    record.message,
    record.detail,
    record.msg,
    record.reason,
    record.code,
    record.status,
    record.data
  ].map((item) => stringFromUnknown(item, depth + 1)).filter(Boolean).join(" ");
}

export function isVideoProviderUpstreamUnavailableError(value: unknown): boolean {
  const lower = stringFromUnknown(value).toLowerCase();
  return Boolean(lower) && /upstream_error|服务暂时不可用|稍后重试|temporarily unavailable|try again later|service unavailable/.test(lower);
}

function providerFailureCodeFromMessage(message: string): VideoProviderFailureCode | undefined {
  const lower = message.toLowerCase();
  if (!message) return undefined;
  if (isVideoProviderUpstreamUnavailableError(message)) return undefined;
  if (/未成年|儿童|小孩|婴儿|幼儿|minor|underage|child|children|baby|infant/.test(lower)) return "minor_reference_unsupported";
  if (/色情|裸露|裸体|sexual|nudity|nude|nsfw|porn/.test(lower)) return "sexual_content_unsupported";
  if (/暴力|血腥|violence|violent|gore|bloody|weapon|self[-\s]?harm|suicide/.test(lower)) return "violent_content_unsupported";
  if (/名人|公众人物|版权|角色|celebrity|public figure|copyright|trademark|character|ip right/.test(lower)) return "rights_or_public_figure_unsupported";
  if (/水印|标志|logo|watermark|text-heavy|large text|caption|subtitle/.test(lower)) return "text_logo_watermark_unsupported";
  if (/无法读取|读取失败|不可访问|私有|image_url|image url|fetch|read|reachable|public url|private url|could not reach|could not access/.test(lower)) return "frame_url_unreadable";
  if (/格式|解码|文件类型|mime|format|decode|unsupported image|invalid image|svg|gif|webp|heic|heif|bmp|tiff/.test(lower)) return "unsupported_frame_format";
  if (/真实人物|真人|真实人像|real\s*(person|people|human)|recognizable\s*(person|people|human)|actual\s*(person|people|human)|selfie/.test(lower)) return "real_person_reference_unsupported";
  if (/(person|people|human|face|portrait)/.test(lower) && /(not support|unsupported|cannot|can't|rejected|policy|safety)/.test(lower)) return "real_person_reference_unsupported";
  if (/ai_provider_video_failed|content policy|safety|policy|reject|rejected|unsupported|not support|cannot use|can't use|不支持|拒绝|违规|安全/.test(lower)) return "provider_rejected_reference";
  return undefined;
}

function normalizedProviderProtocol(value: unknown): VideoProviderProtocol | undefined {
  return value === "lk888-media" || value === "openai-videos" || value === "huitu-openapi" || value === "tokengo-media" ? value : undefined;
}

function normalizedProviderFamily(value: unknown): VideoModelFamily | undefined {
  return value === "gemini" || value === "grok" ? value : undefined;
}

export function isGeminiVideoFrameMimeType(value: unknown): boolean {
  const mimeType = textValue(value).split(";")[0]?.toLowerCase();
  return GEMINI_VIDEO_FRAME_ALLOWED_MIME_TYPES.some((allowed) => allowed === mimeType);
}

export function geminiVideoFrameMimeTypeForUpload(file: { name?: string; type?: string }): "image/jpeg" | "image/png" | undefined {
  const mimeType = textValue(file.type).split(";")[0]?.toLowerCase();
  if (mimeType === "image/jpeg" || mimeType === "image/png") return mimeType;
  if (mimeType && mimeType !== "application/octet-stream") return undefined;
  const name = textValue(file.name).toLowerCase();
  if (/\.(jpe?g)$/.test(name)) return "image/jpeg";
  if (/\.png$/.test(name)) return "image/png";
  return undefined;
}

export function isGeminiVideoFrameUploadFile(file: { name?: string; type?: string }): boolean {
  return Boolean(geminiVideoFrameMimeTypeForUpload(file));
}

export function geminiVideoFrameRequirementMessage(spanish = false): string {
  return spanish
    ? "El video Gemini necesita al menos un fotograma."
    : "Gemini video needs at least one frame image.";
}

export function geminiVideoFrameUploadTypeMessage(spanish = false): string {
  return spanish
    ? "Usa archivos JPG o PNG para fotogramas de video Gemini."
    : "Use JPG or PNG frame images for Gemini video.";
}

export function geminiVideoFramePolicyWarningMessage(spanish = false): string {
  return spanish
    ? "Gemini puede rechazar imagenes de referencia con personas reales o reconocibles. Las referencias ficticias/estilizadas pueden enviarse, pero pueden fallar en la revision del proveedor."
    : "Gemini may reject reference images with real or recognizable people. Fictional or stylized references can be submitted, but may still fail provider review.";
}

export function geminiVideoFramePolicyDetailMessage(spanish = false): string {
  return spanish
    ? "Usa JPG o PNG. Evita menores, desnudez, celebridades o figuras publicas, personajes de anime/juegos/comics que puedan tener copyright, violencia, odio, actividad ilegal, armas, autolesion, documentos sensibles, marcas de agua, mucho texto e imagenes borrosas o privadas."
    : "Use JPG or PNG. Avoid minors, nudity, celebrity or public figures, anime/game/comic characters that may be copyrighted, violence, hate, illegal activity, weapons, self-harm, sensitive documents, watermarks, large text, blurry images, or private images.";
}

export function grokVideoFrameGuidanceMessage(spanish = false): string {
  return spanish
    ? "Grok admite texto a video o imagen a video. Sube fotogramas JPG o PNG solo cuando quieras que el clip siga referencias; deja los fotogramas vacios para un prompt solo de texto."
    : "Grok supports text-to-video or image-to-video. Upload JPG or PNG frame images only when you want the clip to follow references; leave frames empty for a text-only prompt.";
}

export function grokVideoFrameGuidanceDetailMessage(spanish = false): string {
  return spanish
    ? "Evita prompts y cargas inseguras o sensibles por derechos: menores, desnudez, celebridades o figuras publicas, personajes con copyright, violencia, odio, actividad ilegal, armas, autolesion, documentos sensibles, marcas de agua, mucho texto, imagenes borrosas o imagenes privadas. Si tu prompt menciona imagenes subidas, seleccionadas, de origen o de referencia, selecciona fotogramas antes de generar."
    : "Avoid unsafe or rights-sensitive prompts and uploads: minors, nudity, celebrity or public figures, copyrighted characters, violence, hate, illegal activity, weapons, self-harm, sensitive documents, watermarks, large text, blurry images, or private images. If your prompt mentions uploaded, selected, source, or reference images, select frame images before generating.";
}

export function videoProviderFailureCustomerMessage(failure: VideoProviderFailure | VideoProviderFailureCode, spanish = false): string {
  const code = typeof failure === "string" ? failure : failure.code;
  const providerFamily = typeof failure === "string" ? undefined : failure.providerFamily;
  if (code === "real_person_reference_unsupported") {
    return spanish
      ? "Gemini no puede usar imagenes de referencia que contengan personas reales o reconocibles. Elige una referencia sin personas reales e intentalo de nuevo."
      : "Gemini cannot use reference images that contain real or recognizable people. Choose a non-real-person reference and try again.";
  }
  if (code === "minor_reference_unsupported") {
    return spanish
      ? "El proveedor de video no puede usar referencias con menores o ninos. Elige otra imagen e intentalo de nuevo."
      : "The video provider cannot use references with children or minors. Choose another image and try again.";
  }
  if (code === "sexual_content_unsupported") {
    return spanish
      ? "El proveedor de video rechazo la referencia por contenido sexual o desnudez. Usa una imagen segura e intentalo de nuevo."
      : "The video provider rejected the reference for sexual content or nudity. Use a safe image and try again.";
  }
  if (code === "violent_content_unsupported") {
    return spanish
      ? "El proveedor de video rechazo la referencia por violencia, sangre, armas o autolesion. Usa otra imagen e intentalo de nuevo."
      : "The video provider rejected the reference for violence, gore, weapons, or self-harm. Use another image and try again.";
  }
  if (code === "rights_or_public_figure_unsupported") {
    return spanish
      ? "El proveedor de video rechazo la referencia por derechos, celebridades, figuras publicas o personajes con copyright. Usa otra imagen e intentalo de nuevo."
      : "The video provider rejected the reference because it may involve rights, celebrities, public figures, or copyrighted characters. Use another image and try again.";
  }
  if (code === "text_logo_watermark_unsupported") {
    return spanish
      ? "El proveedor de video no pudo usar esta referencia con texto, logo o marca de agua visible. Sube una imagen mas limpia e intentalo de nuevo."
      : "The video provider could not use this reference with visible text, logos, or watermarks. Upload a cleaner image and try again.";
  }
  if (code === "frame_url_unreadable") {
    return spanish
      ? "El proveedor de video no pudo leer los fotogramas seleccionados. Usa imagenes subidas correctamente y vuelve a intentar."
      : "The video provider could not read the selected frame images. Use properly uploaded images and try again.";
  }
  if (code === "unsupported_frame_format") {
    return spanish
      ? "El proveedor de video no pudo procesar el formato de la imagen. Usa JPG o PNG e intentalo de nuevo."
      : "The video provider could not process that image format. Use JPG or PNG and try again.";
  }
  if (providerFamily === "gemini") {
    return spanish
      ? "Gemini rechazo la referencia durante la revision de seguridad. Usa una imagen JPG/PNG simple de un producto, objeto, paisaje, mascota o referencia original no sensible; evita personas reales, menores, desnudez, violencia y personajes de anime/juegos/comics que puedan tener copyright."
      : "Gemini rejected the reference during safety review. Use a simple JPG/PNG product, object, landscape, pet, or original non-sensitive reference; avoid real people, minors, nudity, violence, and anime/game/comic characters that may be copyrighted.";
  }
  return spanish
    ? "El proveedor de video rechazo la referencia. Revisa la imagen, elige otra referencia segura e intentalo de nuevo."
    : "The video provider rejected the reference image. Review the image, choose another safe reference, and try again.";
}

export function parseVideoProviderFailure(value: unknown): VideoProviderFailure | undefined {
  const record = recordValue(value);
  const code = textValue(record?.code);
  if (!videoProviderFailureCodes.has(code as VideoProviderFailureCode)) return undefined;
  const providerFamily = normalizedProviderFamily(record?.providerFamily);
  const providerProtocol = normalizedProviderProtocol(record?.providerProtocol);
  return {
    ...(providerFamily ? { providerFamily } : {}),
    ...(providerProtocol ? { providerProtocol } : {}),
    code: code as VideoProviderFailureCode,
    customerMessage: videoProviderFailureCustomerMessage(code as VideoProviderFailureCode)
  };
}

export function normalizeVideoProviderFailure(params: {
  error?: unknown;
  message?: unknown;
  providerFamily?: unknown;
  providerProtocol?: unknown;
}): VideoProviderFailure | undefined {
  const rawMessage = [params.message, params.error].map((item) => stringFromUnknown(item)).filter(Boolean).join(" ");
  const code = providerFailureCodeFromMessage(rawMessage);
  if (!code) return undefined;
  const providerFamily = normalizedProviderFamily(params.providerFamily);
  const providerProtocol = normalizedProviderProtocol(params.providerProtocol);
  return {
    ...(providerFamily ? { providerFamily } : {}),
    ...(providerProtocol ? { providerProtocol } : {}),
    code,
    customerMessage: videoProviderFailureCustomerMessage(code)
  };
}

export function attachVideoProviderFailure<T extends Error>(error: T, failure: VideoProviderFailure | undefined): T {
  if (failure) {
    (error as T & { providerFailure?: VideoProviderFailure }).providerFailure = failure;
  }
  return error;
}

export function videoProviderFailureFromError(
  error: unknown,
  context: { providerFamily?: unknown; providerProtocol?: unknown } = {}
): VideoProviderFailure | undefined {
  const attached = recordValue(error)?.providerFailure;
  return parseVideoProviderFailure(attached) ?? normalizeVideoProviderFailure({ error, ...context });
}
