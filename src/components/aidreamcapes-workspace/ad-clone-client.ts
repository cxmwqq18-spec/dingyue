import { customerJsonHeaders, csrfHeader } from "@/lib/client-csrf";

export type AdAsset = { id: string; label: string; mimeType: string; previewUrl?: string };
export type AdSegment = { role: "hook" | "body" | "cta"; start: number; end: number; visual: string };
export type AdAnalysis = { revision: number; synthetic?: boolean; segments: AdSegment[] };
export type AdJob = {
  id: string; workflow: string; sourceAssetId: string; consentId: string; consentRevision: number;
  status: string; revision: number; taskId?: string | null; attachedTaskId?: string | null; createdAt?: string;
  result?: { analysis?: AdAnalysis; sourceAssetId?: string; capabilityState?: string; mediaRead?: boolean; productionReady?: boolean } | null;
};
export type AdCapabilities = {
  adReference?: { available: boolean; state: string; reason?: string };
  components?: { database?: { available: boolean; state?: string; reason?: string } };
  mockAvailable?: boolean;
  analysisBeforeTask?: boolean;
  adUpload?: { available: boolean; maxBytes?: number };
};
export function adCloneError(code: string, status = 0): string {
  if (status === 401 || status === 403) return "Your session or authorization has expired. Sign in again and confirm access to this video.";
  if (status === 409) return "This item changed in another session. Reload saved analyses before trying again.";
  if (code === "clone_media_duration_invalid") return "This video is empty or exceeds the supported duration. Choose a shorter MP4.";
  if (code === "clone_media_invalid" || code === "clone_mp4_source_required") return "We couldn’t read a supported MP4 video from this file. Export it as MP4 and try again.";
  if (status === 413) return "This video is too large. Choose a smaller MP4.";
  if (/database|storage|table|schema|P2010/i.test(code)) return "Saved analyses are temporarily unavailable while storage is being prepared. Try reloading later.";
  if (/provider|adapter|unavailable|not_configured/i.test(code) || status === 503) return "Video analysis is currently unavailable. Your saved work can be reopened when the service returns.";
  if (/upload|unsupported|must_be/i.test(code) || status === 404) return "This video operation is not available yet. Choose an existing MP4 or try again later.";
  if (status === 429) return "Too many requests. Wait a moment before trying again.";
  return "We couldn’t complete that step. Check your connection and try again.";
}
export function adCloneClient(siteId: string, csrfToken?: string) {
  const root = `/api/sites/${encodeURIComponent(siteId)}/aivideosugc/clones`;
  return async function request<T>(path: string, options: { method?: string; body?: unknown; revision?: number; key?: string; signal?: AbortSignal; absolute?: boolean } = {}): Promise<T> {
    const multipart = options.body instanceof FormData;
    const response = await fetch(options.absolute ? path : `${root}${path}`, {
      method: options.method ?? "GET", credentials: "same-origin", cache: "no-store", signal: options.signal,
      headers: { ...(multipart ? csrfHeader(`customer_csrf_${siteId}`) : customerJsonHeaders(siteId)),
        ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        ...(options.revision ? { "if-match": String(options.revision) } : {}),
        ...(options.key ? { "idempotency-key": options.key } : {}) },
      body: options.body === undefined ? undefined : multipart ? options.body as FormData : JSON.stringify(options.body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(adCloneError(String(data.error ?? ""), response.status));
    return data as T;
  };
}

// Synthetic timelines stay explicitly labelled; real results require verified media reads.
export function validatedAdAnalysis(job: AdJob): AdAnalysis | null {
  const value = job.result?.analysis;
  if (job.result?.sourceAssetId !== job.sourceAssetId || (job.status === "mock_complete" && (job.result?.capabilityState !== "mock_only" || job.result?.productionReady !== false)) || !["succeeded", "mock_complete"].includes(job.status) || !value || (job.status === "mock_complete" ? value.synthetic !== true : job.result?.mediaRead !== true) || !Number.isSafeInteger(value.revision) || value.revision < 1 || !Array.isArray(value.segments) || !value.segments.length) return null;
  if (!value.segments.every(s => ["hook", "body", "cta"].includes(s.role) && Number.isFinite(s.start) && Number.isFinite(s.end) && s.start >= 0 && s.end > s.start && typeof s.visual === "string")) return null;
  return value;
}
