import "server-only";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { createAssetUploadRelational, getCustomerAssetsRelational, getCustomerAssetRelational, readCustomerAssetFileByStorageKey, toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import { customerAssetStorageKey, deleteCustomerAssetFileShared, writeCustomerAssetFileShared } from "@/lib/customer-asset-storage";
import { AIVIDEOSUGC_SITE_ID, WorkspaceError } from "./types";
import { assertWorkspaceSite } from "./catalogs";

type Workflow = "voice_twin" | "ad_reference";
export type CloneMediaInfo = { kind: "audio" | "video"; mimeType: string; extension: string; durationSeconds: number; hasAudio: boolean; width?: number; height?: number };
const execute = promisify(execFile);
const INPUT_FORMATS = "mov,mp4,m4a,3gp,3g2,mj2,mp3,wav,flac,ogg,aac,matroska,webm";
let activeMediaOperations = 0;
export const CLONE_MEDIA_LIMITS = { voiceBytes: 20 * 1024 * 1024, videoBytes: 100 * 1024 * 1024, voiceSeconds: 300, videoSeconds: 180, maxPixels: 3840 * 2160 } as const;
const audioFormats = [{ format: "wav", mime: "audio/wav", ext: "wav" }, { format: "mp3", mime: "audio/mpeg", ext: "mp3" }, { format: "flac", mime: "audio/flac", ext: "flac" }, { format: "ogg", mime: "audio/ogg", ext: "ogg" }, { format: "aac", mime: "audio/aac", ext: "aac" }, { format: "mov", mime: "audio/mp4", ext: "m4a" }, { format: "matroska", mime: "audio/webm", ext: "webm" }];

async function tool(binary: "ffprobe" | "ffmpeg", args: string[]) {
  const executable = process.env[binary === "ffprobe" ? "AIVIDEOSUGC_FFPROBE_BIN" : "AIVIDEOSUGC_FFMPEG_BIN"]?.trim() || binary;
  try { return await execute(executable, args, { timeout: binary === "ffprobe" ? 15_000 : 45_000, maxBuffer: 1024 * 1024 }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new WorkspaceError(`clone_${binary}_unavailable`, 503);
    throw new WorkspaceError("clone_media_invalid", 422);
  }
}

async function withSource<T>(bytes: Buffer, callback: (file: string, directory: string) => Promise<T>): Promise<T> {
  if (activeMediaOperations >= 2) throw new WorkspaceError("clone_media_busy", 429);
  activeMediaOperations += 1;
  let directory: string | undefined;
  try {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), "aidreamcapes-clone-"));
    const source = path.join(directory, "source.bin");
    await fs.writeFile(source, bytes, { mode: 0o600 });
    return await callback(source, directory);
  } finally { try { if (directory) await fs.rm(directory, { recursive: true, force: true }); } finally { activeMediaOperations -= 1; } }
}

export async function inspectCloneMedia(bytes: Buffer, workflow: Workflow): Promise<CloneMediaInfo> {
  const maximum = workflow === "voice_twin" ? CLONE_MEDIA_LIMITS.voiceBytes : CLONE_MEDIA_LIMITS.videoBytes;
  if (!bytes.length || bytes.length > maximum) throw new WorkspaceError("clone_media_size_invalid", 413);
  return withSource(bytes, async (source) => {
    const probe = await tool("ffprobe", ["-v", "error", "-protocol_whitelist", "file,pipe", "-format_whitelist", INPUT_FORMATS, "-show_streams", "-show_format", "-of", "json", source]);
    let media: { streams?: { codec_type?: string; width?: number; height?: number; disposition?: { attached_pic?: number } }[]; format?: { duration?: string; format_name?: string } };
    try { media = JSON.parse(probe.stdout); } catch { throw new WorkspaceError("clone_media_invalid", 422); }
    const durationSeconds = Number(media.format?.duration);
    const hasAudio = Boolean(media.streams?.some((stream) => stream.codec_type === "audio"));
    const video = media.streams?.find((stream) => stream.codec_type === "video" && !stream.disposition?.attached_pic);
    const format = (media.format?.format_name ?? "").split(",");
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > (workflow === "voice_twin" ? CLONE_MEDIA_LIMITS.voiceSeconds : CLONE_MEDIA_LIMITS.videoSeconds)) throw new WorkspaceError("clone_media_duration_invalid", 422);
    if (workflow === "voice_twin") {
      const audio = audioFormats.find((item) => format.includes(item.format));
      if (!hasAudio || video || !audio) throw new WorkspaceError("clone_audio_source_required", 422);
      return { kind: "audio", mimeType: audio.mime, extension: audio.ext, durationSeconds, hasAudio };
    }
    // Container detection is from bytes, never the client-supplied file extension.
    if (!video || !format.includes("mp4") || !video.width || !video.height || video.width * video.height > CLONE_MEDIA_LIMITS.maxPixels) throw new WorkspaceError("clone_mp4_source_required", 422);
    return { kind: "video", mimeType: "video/mp4", extension: "mp4", durationSeconds, hasAudio, width: video.width, height: video.height };
  });
}

/** Bounded local preparation. This does not transcribe or invent an analysis. */
export async function prepareCloneReferenceMedia(bytes: Buffer, workflow: Workflow) {
  const media = await inspectCloneMedia(bytes, workflow);
  return withSource(bytes, async (source, directory) => {
    let audioWav: Buffer | undefined;
    if (media.hasAudio) {
      const output = path.join(directory, "voice.wav");
      await tool("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe", "-format_whitelist", INPUT_FORMATS, "-i", source, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", output]);
      audioWav = await fs.readFile(output);
    }
    const frames: { seconds: number; jpeg: Buffer }[] = [];
    if (workflow === "ad_reference") {
      // At most three bounded thumbnails. A worker can later request its own
      // provider-specific sampling strategy without loading all frames at once.
      for (const fraction of [0.1, 0.5, 0.9]) {
        const seconds = Math.max(0, media.durationSeconds * fraction);
        const output = path.join(directory, `frame-${frames.length}.jpg`);
        await tool("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-protocol_whitelist", "file,pipe", "-format_whitelist", INPUT_FORMATS, "-ss", String(seconds), "-i", source, "-frames:v", "1", "-vf", "scale=640:640:force_original_aspect_ratio=decrease", output]);
        frames.push({ seconds, jpeg: await fs.readFile(output) });
      }
    }
    return { media, audioWav, frames, transcript: null, modelRequests: 0 as const };
  });
}

function writable() {
  if ([process.env.DATABASE_TARGET, process.env.DINGYUE_ENV].some((value) => value?.trim().toLowerCase() === "remote-readonly")) throw new WorkspaceError("workspace_database_readonly", 403);
}

export async function listCloneSourceAssets(siteId: string, customerId: string) {
  assertWorkspaceSite(siteId);
  // Cover the customer's whole upload history (not just the 100 newest rows):
  // portrait tagging and picker filters must see older uploads even when many
  // recent video/audio assets push them out of a small window.
  const { assets } = await getCustomerAssetsRelational({ siteId, customerId, take: 400, roles: ["input", "training_input", "output"] });
  return assets.filter((asset) => asset.siteId === AIVIDEOSUGC_SITE_ID && asset.customerId === customerId && !asset.deletedAt && /^(audio\/|image\/|video\/mp4$)/.test(asset.mimeType))
    .map((asset) => { const view = toThemeRuntimeAssetRelational(asset); return { id: asset.id, label: asset.label, mimeType: asset.mimeType, role: asset.role, previewStatus: view.previewStatus, previewUrl: view.previewUrl, kind: asset.mimeType.startsWith("audio/") ? "audio" as const : asset.mimeType.startsWith("video/") ? "video" as const : "image" as const }; });
}

export async function uploadCloneSourceAsset(siteId: string, customerId: string, workflow: Workflow, bytes: Buffer, filename: string) {
  assertWorkspaceSite(siteId); writable();
  const media = await inspectCloneMedia(bytes, workflow);
  const label = filename.replace(/[\u0000-\u001f\u007f]/g, "").split(/[\\/]/).pop()?.slice(0, 150).trim() || (workflow === "voice_twin" ? "Voice reference" : "Ad reference");
  const storageKey = customerAssetStorageKey({ siteId, customerId, fileName: `clone-${randomUUID()}.${media.extension}` });
  await writeCustomerAssetFileShared({ storageKey, bytes, mimeType: media.mimeType, purpose: "input" });
  try {
    const { asset } = await createAssetUploadRelational({ siteId, customerId, label, mimeType: media.mimeType, role: "input", subjectRole: workflow === "voice_twin" ? "clone_voice_source" : "clone_ad_source", storageKey });
    const view = toThemeRuntimeAssetRelational(asset);
    return { asset: { id: asset.id, label: asset.label, mimeType: asset.mimeType, role: asset.role, previewStatus: view.previewStatus, previewUrl: view.previewUrl, kind: media.kind }, media };
  } catch (error) { await deleteCustomerAssetFileShared(storageKey).catch(() => {}); throw error; }
}

export async function prepareOwnedCloneSource(siteId: string, customerId: string, sourceAssetId: string, workflow: Workflow) {
  assertWorkspaceSite(siteId);
  const { asset } = await getCustomerAssetRelational({ siteId, customerId, assetId: sourceAssetId });
  if (asset.siteId !== AIVIDEOSUGC_SITE_ID || asset.customerId !== customerId || asset.deletedAt) throw new WorkspaceError("clone_source_asset_not_owned", 403);
  const input = await readCustomerAssetFileByStorageKey({ siteId, customerId, asset });
  return prepareCloneReferenceMedia(input.bytes, workflow);
}
