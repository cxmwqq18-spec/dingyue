export type TwinAsset = { id: string; label: string; mimeType: string; role?: string; subjectRole?: string; previewUrl: string; previewStatus?: string };
export type TwinActor = { actorId: string; name: string; imageUrl: string; voice: { refAudio?: string; voiceId?: string } };
export type TwinConsent = { id: string; workflow: string; actorId: string | null; sourceAssetId: string; revision: number; status: string; expiresAt?: string | null };
export type TwinJob = { id: string; workflow: string; actorId: string | null; consentId: string; consentRevision: number; status: string; revision: number; capabilityState: string; createdAt: string; result?: Record<string, unknown> | null; error?: string };
export type TwinCapabilities = { productionReady?: boolean; mockAvailable?: boolean; voiceTwin?: { state: string; available: boolean; reason?: string }; components?: { database?: { available: boolean; state?: string } }; database?: { available: boolean; state?: string }; [key: string]: unknown };

export function twinError(code: string, status?: number): string {
  if (status === 401 || /login_required|not_authenticated/.test(code)) return "Your session has ended. Log in again to continue.";
  if (status === 409 || /revision_conflict/.test(code)) return "This profile changed in another window. Refresh to see the latest version before trying again.";
  if (/csrf/.test(code)) return "Your security token has expired. Reload this page before trying again.";
  if (/ffprobe|ffmpeg/.test(code)) return "Media checking is temporarily unavailable. Try again later or contact support; your saved profiles are kept.";
  if (/media_size/.test(code)) return "This recording is too large. Choose an audio file up to 20 MB.";
  if (/media_duration/.test(code)) return "Choose a recording longer than zero seconds and no longer than 5 minutes.";
  if (/media_invalid/.test(code)) return "This file could not be decoded. Try a playable WAV, MP3, M4A or FLAC recording.";
  if (/database|schema|storage_unavailable/.test(code)) return "AI Twin storage is not set up or is temporarily unavailable. Please try Refresh later; contact support if this continues.";
  if (status === 429) return "Too many requests. Wait a moment, then try again.";
  if (/consent.*(expired|revoked)/.test(code)) return "This permission is no longer active. Create a new request with your consent to continue.";
  if (/source|asset|audio|portrait/.test(code)) return "The selected media could not be used. Refresh and choose a readable file from your own uploads.";
  return "We could not complete this request. Your saved profiles are kept. Refresh and try again.";
}

export function twinStatus(job: TwinJob): string {
  if (job.status === "mock_complete") return "Simulation complete · no voice trained";
  if (job.status === "queued") return job.capabilityState === "mock_only" ? "Simulation queued" : "Queued";
  if (job.status === "running") return "Processing";
  if (job.status === "succeeded") return job.capabilityState === "mock_only" ? "Simulation complete · no voice trained" : "Processing complete";
  return ({ failed: "Request failed", cancelled: "Cancelled", deleted: "Deleted" } as Record<string, string>)[job.status] ?? "Status unavailable";
}

export function activeTwinConsent(consent: TwinConsent | undefined): boolean {
  return Boolean(consent?.status === "granted" && (!consent.expiresAt || Date.parse(consent.expiresAt) > Date.now()));
}

export function ownedTwinAssets(assets: TwinAsset[], kind: "image" | "audio"): TwinAsset[] {
  return assets.filter(asset => ["input", "training_input"].includes(asset.role ?? "input") && asset.mimeType.startsWith(`${kind}/`) && asset.previewUrl && asset.previewStatus !== "loading");
}

/** Portrait picker source. Assets uploaded through the AI Twin portrait
 * uploader are tagged subjectRole "twin_portrait" and are the real candidates;
 * older accounts that never used the tagged uploader keep seeing their general
 * image uploads so the picker never becomes mysteriously empty. */
export function preferredTwinPortraits(assets: TwinAsset[]): TwinAsset[] {
  const portraits = ownedTwinAssets(assets, "image");
  const dedicated = portraits.filter(asset => asset.subjectRole === "twin_portrait");
  return dedicated.length ? dedicated : portraits;
}
