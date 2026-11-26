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
  | "duration_limit_exceeded"
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
  "duration_limit_exceeded",
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
  // Duration/spec caps often arrive wrapped in a generic "fail_to_fetch_task"
  // envelope. Classify them before the frame-URL wording below, or the user is
  // told to re-upload photos when the real fix is a shorter clip.
  if (/最高支持\s*\d+\s*秒|最长(?:支持)?\s*\d+\s*秒|请调短时长|调短时长|max(?:imum)?\s*(?:is\s*)?\d+\s*(?:seconds?|secs?|s)\b|supports? up to\s*\d+\s*(?:seconds?|secs?|s)\b|duration (?:limit|too long)|clip is too long/.test(lower)) {
    return "duration_limit_exceeded";
  }
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
    ? "El video con referencia necesita al menos un fotograma."
    : "Reference-based video needs at least one frame image.";
}

export function geminiVideoFrameUploadTypeMessage(spanish = false): string {
  return spanish
    ? "Usa archivos JPG o PNG para fotogramas de video."
    : "Use JPG or PNG images for video references.";
}

export function geminiVideoFramePolicyWarningMessage(spanish = false): string {
  return spanish
    ? "El servicio de video puede rechazar imagenes de referencia con personas reales o reconocibles. Las referencias ficticias o estilizadas pueden enviarse, pero aun pueden no pasar la revision."
    : "The video service may reject reference images with real or recognizable people. Fictional or stylized references can be submitted, but may still fail review.";
}

export function geminiVideoFramePolicyDetailMessage(spanish = false): string {
  return spanish
    ? "Usa JPG o PNG. Evita menores, desnudez, celebridades o figuras publicas, personajes de anime/juegos/comics que puedan tener copyright, violencia, odio, actividad ilegal, armas, autolesion, documentos sensibles, marcas de agua, mucho texto e imagenes borrosas o privadas."
    : "Use JPG or PNG. Avoid minors, nudity, celebrity or public figures, anime/game/comic characters that may be copyrighted, violence, hate, illegal activity, weapons, self-harm, sensitive documents, watermarks, large text, blurry images, or private images.";
}

export function grokVideoFrameGuidanceMessage(spanish = false): string {
  return spanish
    ? "El video puede crearse desde texto o desde imagenes de referencia. Sube imagenes JPG o PNG solo cuando quieras que el clip las siga; dejalas vacias para crear solo desde tu descripcion."
    : "Create the video from text or reference images. Upload JPG or PNG images when you want the clip to follow them; leave them empty to create from your description alone.";
}

export function grokVideoFrameGuidanceDetailMessage(spanish = false): string {
  return spanish
    ? "Evita descripciones e imagenes inseguras o sensibles por derechos: menores, desnudez, celebridades o figuras publicas, personajes con copyright, violencia, odio, actividad ilegal, armas, autolesion, documentos sensibles, marcas de agua, mucho texto, imagenes borrosas o privadas. Si tu descripcion menciona imagenes subidas o de referencia, selecciona imagenes de referencia antes de crear el video."
    : "Avoid unsafe or rights-sensitive descriptions and uploads: minors, nudity, celebrity or public figures, copyrighted characters, violence, hate, illegal activity, weapons, self-harm, sensitive documents, watermarks, large text, blurry images, or private images. If your description mentions uploaded or reference images, select reference images before creating the video.";
}

export function videoProviderFailureCustomerMessage(failure: VideoProviderFailure | VideoProviderFailureCode, spanish = false): string {
  const code = typeof failure === "string" ? failure : failure.code;
  const providerFamily = typeof failure === "string" ? undefined : failure.providerFamily;
  if (code === "real_person_reference_unsupported") {
    return spanish
      ? "La creacion de video no puede usar imagenes de referencia con personas reales o reconocibles. Elige otra imagen de referencia e intentalo de nuevo."
      : "Video creation cannot use reference images that contain real or recognizable people. Choose a different reference image and try again.";
  }
  if (code === "minor_reference_unsupported") {
    return spanish
      ? "La creacion de video no puede usar imagenes de referencia con menores o ninos. Elige otra imagen e intentalo de nuevo."
      : "Video creation cannot use reference images with children or minors. Choose another image and try again.";
  }
  if (code === "sexual_content_unsupported") {
    return spanish
      ? "Esta imagen de referencia contiene contenido sexual o desnudez y no se puede usar. Elige otra imagen e intentalo de nuevo."
      : "This reference image includes sexual content or nudity, so it cannot be used. Choose a different image and try again.";
  }
  if (code === "violent_content_unsupported") {
    return spanish
      ? "Esta imagen de referencia contiene violencia, sangre, armas o autolesion y no se puede usar. Elige otra imagen e intentalo de nuevo."
      : "This reference image includes violence, gore, weapons, or self-harm, so it cannot be used. Choose another image and try again.";
  }
  if (code === "rights_or_public_figure_unsupported") {
    return spanish
      ? "Esta imagen de referencia puede incluir una celebridad, figura publica, personaje protegido u otro problema de derechos. Elige otra imagen e intentalo de nuevo."
      : "This reference image may involve a celebrity, public figure, protected character, or other rights issue. Choose another image and try again.";
  }
  if (code === "text_logo_watermark_unsupported") {
    return spanish
      ? "Esta imagen de referencia tiene texto, logotipos o marcas de agua visibles. Sube una imagen mas limpia e intentalo de nuevo."
      : "This reference image has visible text, logos, or watermarks. Upload a cleaner image and try again.";
  }
  if (code === "duration_limit_exceeded") {
    return spanish
      ? "Este modelo solo admite un clip mas corto con esta duracion, resolucion y numero de fotos. Elige una duracion mas corta o menos fotos."
      : "This model supports a shorter clip with this duration, resolution, and photo count. Choose a shorter duration or fewer photos.";
  }
  if (code === "frame_url_unreadable") {
    return spanish
      ? "No se pudieron leer las imagenes de referencia seleccionadas. Vuelve a subirlas e intentalo de nuevo."
      : "The selected reference images could not be read. Re-upload them and try again.";
  }
  if (code === "unsupported_frame_format") {
    return spanish
      ? "Ese formato de imagen no se puede usar aqui. Sube una imagen JPG o PNG e intentalo de nuevo."
      : "That image format cannot be used here. Upload a JPG or PNG image and try again.";
  }
  if (providerFamily === "gemini") {
    return spanish
      ? "Esta imagen de referencia no paso la revision de seguridad. Usa una imagen JPG/PNG simple de un producto, objeto, paisaje, mascota u original no sensible; evita personas reales, menores, desnudez, violencia y personajes protegidos."
      : "This reference image could not pass the safety review. Use a simple JPG/PNG product, object, landscape, pet, or original non-sensitive image; avoid real people, minors, nudity, violence, and protected characters.";
  }
  return spanish
    ? "Esta imagen de referencia no se pudo usar. Revisala, elige otra imagen segura e intentalo de nuevo."
    : "This reference image could not be used. Review it, choose another safe image, and try again.";
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
