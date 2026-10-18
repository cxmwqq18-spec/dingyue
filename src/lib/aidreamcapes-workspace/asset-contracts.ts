export type WorkspaceMediaKind = "image" | "audio" | "music" | "video";

export type WorkspaceAssetRecord = {
  id: string;
  siteId: string;
  customerId: string;
  storageKey: string;
  mimeType: string;
  role: string;
  subjectRole?: string | null;
  deletedAt?: unknown;
};

const IMAGE_EXTENSIONS: Record<string, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

const AUDIO_EXTENSIONS: Record<string, readonly string[]> = {
  "audio/mpeg": [".mp3"],
  "audio/mp4": [".m4a", ".mp4"],
  "audio/wav": [".wav"],
  "audio/x-wav": [".wav"],
  "audio/ogg": [".ogg"],
  "audio/webm": [".webm"],
  "audio/aac": [".aac"],
  "audio/flac": [".flac"],
};

const DOWNLOAD_QUERY_VALUES: Record<string, string> = {
  preview: "1",
  poster: "1",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeIdentifier(value: string): boolean {
  return /^[a-zA-Z0-9_-]{1,180}$/.test(value);
}

function normalizedStorageKey(storageKey: string): string | undefined {
  if (typeof storageKey !== "string" || !storageKey || storageKey.includes("\\") || /[%\u0000-\u001f\u007f]/.test(storageKey)) return undefined;
  const key = storageKey.startsWith("customer-assets/") ? storageKey.slice("customer-assets/".length) : storageKey;
  const parts = key.split("/");
  if (parts.some((part) => !part || part === "." || part === "..")) return undefined;
  return key;
}

export function workspaceAssetStorageKeyMatches(storageKey: string, expectedStorageKey: string): boolean {
  return normalizedStorageKey(storageKey) === expectedStorageKey;
}

export function workspaceAssetHasMedia(
  asset: WorkspaceAssetRecord,
  expected: { siteId: string; customerId: string; kind: WorkspaceMediaKind },
): boolean {
  if (!asset || asset.siteId !== expected.siteId || asset.customerId !== expected.customerId || asset.deletedAt) return false;
  if (!safeIdentifier(expected.siteId) || !safeIdentifier(expected.customerId) || !safeIdentifier(asset.id)) return false;

  const key = normalizedStorageKey(asset.storageKey);
  const prefix = `sites/${expected.siteId}/customers/${expected.customerId}/assets/`;
  if (!key?.startsWith(prefix)) return false;
  const fileName = key.slice(prefix.length);
  if (!fileName || fileName.includes("/") || fileName === "." || fileName === "..") return false;
  const extension = fileName.slice(fileName.lastIndexOf(".")).toLowerCase();
  if (!extension || extension === fileName.toLowerCase()) return false;

  const mimeType = asset.mimeType.toLowerCase().split(";")[0].trim();
  if (expected.kind === "image") {
    return ["input", "output"].includes(asset.role) && Boolean(IMAGE_EXTENSIONS[mimeType]?.includes(extension));
  }
  if (expected.kind === "video") {
    return asset.role === "output" && mimeType === "video/mp4" && extension === ".mp4";
  }
  if (expected.kind === "music") {
    return asset.role === "input" && asset.subjectRole === "aivideosugc_music" && Boolean(AUDIO_EXTENSIONS[mimeType]?.includes(extension));
  }
  return asset.role === "input" && Boolean(AUDIO_EXTENSIONS[mimeType]?.includes(extension));
}

export function customerAssetIdFromDownloadUrl(url: string, expected: { siteId: string; customerId: string }): string | undefined {
  if (typeof url !== "string" || !safeIdentifier(expected.siteId) || !safeIdentifier(expected.customerId)) return undefined;
  const prefix = `/api/sites/${escapeRegExp(expected.siteId)}/customers/${escapeRegExp(expected.customerId)}/assets/`;
  const match = new RegExp(`^${prefix}([a-zA-Z0-9_-]{1,180})/download(?:\\?([^#]*))?$`).exec(url);
  if (!match) return undefined;
  if (match[2] !== undefined) {
    if (!match[2]) return undefined;
    const query = new URLSearchParams(match[2]);
    const seen = new Set<string>();
    for (const [key, value] of query) {
      if (seen.has(key)) return undefined;
      seen.add(key);
      if (key === "token") {
        if (!/^[a-zA-Z0-9_-]{16,4096}$/.test(value)) return undefined;
      } else if (DOWNLOAD_QUERY_VALUES[key] !== value) return undefined;
    }
    if (seen.has("poster") && !seen.has("preview")) return undefined;
  }
  return match[1];
}

export function customerAssetStorageKeyFromLocalUrl(url: string, expected: { siteId: string; customerId: string }): string | undefined {
  if (typeof url !== "string" || !safeIdentifier(expected.siteId) || !safeIdentifier(expected.customerId)) return undefined;
  const prefix = `/api/local-assets/sites/${expected.siteId}/customers/${expected.customerId}/assets/`;
  if (!url.startsWith(prefix) || /[?#%\\\u0000-\u001f\u007f]/.test(url)) return undefined;
  const fileName = url.slice(prefix.length);
  if (!fileName || fileName.includes("/") || fileName === "." || fileName === "..") return undefined;
  return `sites/${expected.siteId}/customers/${expected.customerId}/assets/${fileName}`;
}

export function isBuiltinActorCatalogReference(
  url: string,
  kind: "image" | "audio",
  actors: Array<{ imageUrl?: string; voice?: { refAudio?: string } }>,
): boolean {
  if (typeof url !== "string") return false;
  const isCatalogPath = kind === "image"
    ? /^\/media\/site_aidreamcapes\/workspace\/actors\/library\/[a-z0-9-]+\.webp$/.test(url)
      || /^\/assets\/sites\/site_aidreamcapes\/site-v2\/guide\/[A-Za-z0-9_./@+-]+\.webp$/.test(url)
    : /^\/assets\/sites\/site_aidreamcapes\/workspace\/actors\/voices\/[a-z0-9-]+\.mp3$/.test(url);
  if (!isCatalogPath) return false;
  return actors.some((actor) => kind === "image" ? actor.imageUrl === url : actor.voice?.refAudio === url);
}
