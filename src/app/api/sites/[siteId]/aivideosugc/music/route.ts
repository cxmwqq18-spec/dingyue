import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
import { customerAssetStorageKey, deleteCustomerAssetFileShared, writeCustomerAssetFileShared } from "@/lib/customer-asset-storage";
import { createAssetUploadRelational, getCustomerAssetsRelational } from "@/lib/stores/asset-store";
import { workspaceAssetHasMedia } from "@/lib/aidreamcapes-workspace/asset-contracts";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };
const MAX_BYTES = 20 * 1024 * 1024;
const MIME_TYPES = new Set(["audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"]);
const EXTENSIONS: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm", "audio/aac": "aac", "audio/flac": "flac" };
function hasAudioSignature(bytes: Buffer, mime: string) {
  if (mime === "audio/mpeg") return bytes.subarray(0, 3).toString() === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (mime === "audio/mp4") return bytes.subarray(4, 8).toString() === "ftyp";
  if (mime === "audio/wav" || mime === "audio/x-wav") return bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WAVE";
  if (mime === "audio/ogg") return bytes.subarray(0, 4).toString() === "OggS";
  if (mime === "audio/webm") return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (mime === "audio/flac") return bytes.subarray(0, 4).toString() === "fLaC";
  if (mime === "audio/aac") return bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
  return false;
}
export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    const { assets } = await getCustomerAssetsRelational({ siteId, customerId: auth.current.customer.id, roles: ["input"], take: 500 });
    const tracks = assets.filter((asset) => workspaceAssetHasMedia(asset, { siteId, customerId: auth.current.customer.id, kind: "music" })).map((asset) => ({
      id: asset.id, name: asset.label, mimeType: asset.mimeType,
      url: `/api/sites/${siteId}/customers/${auth.current.customer.id}/assets/${asset.id}/download`
    }));
    return workspaceResponse({ tracks });
  } catch (error) { return workspaceFailure(error); }
}
export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response;
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_BYTES + 128 * 1024) throw new WorkspaceError("music_file_too_large", 413);
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File) || value.size < 1) throw new WorkspaceError("music_file_required");
    if (value.size > MAX_BYTES) throw new WorkspaceError("music_file_too_large", 413);
    const mimeType = value.type.toLowerCase().split(";")[0].trim();
    if (!MIME_TYPES.has(mimeType)) throw new WorkspaceError("music_file_type_unsupported");
    const bytes = Buffer.from(await value.arrayBuffer());
    if (bytes.length !== value.size || !hasAudioSignature(bytes, mimeType)) throw new WorkspaceError("music_file_invalid");
    const customerId = auth.current.customer.id;
    const storageKey = customerAssetStorageKey({ siteId, customerId, fileName: `${randomUUID()}.${EXTENSIONS[mimeType]}` });
    await writeCustomerAssetFileShared({ storageKey, bytes, mimeType, purpose: "input" });
    try {
      const { asset } = await createAssetUploadRelational({ siteId, customerId, label: (value.name.replace(/\.[^.]+$/, "").trim() || "Audio track").slice(0, 160), mimeType, role: "input", storageKey, subjectRole: "aivideosugc_music" });
      return workspaceResponse({ track: { id: asset.id, name: asset.label, mimeType: asset.mimeType, size: bytes.length, url: `/api/sites/${siteId}/customers/${customerId}/assets/${asset.id}/download` } }, 201);
    } catch (error) {
      await deleteCustomerAssetFileShared(storageKey).catch(() => undefined);
      throw error;
    }
  } catch (error) { return workspaceFailure(error); }
}
