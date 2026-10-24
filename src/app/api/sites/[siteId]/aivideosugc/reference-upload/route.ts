import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
import { customerAssetStorageKey, writeCustomerAssetFileShared, deleteCustomerAssetFileShared } from "@/lib/customer-asset-storage";
import { createAssetUploadRelational } from "@/lib/stores/asset-store";

const MAX_BYTES: Record<string, number> = { image: 10 * 1024 * 1024, video: 100 * 1024 * 1024, audio: 20 * 1024 * 1024 };
const MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "video/mp4", "video/quicktime", "video/webm",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/x-wav", "audio/ogg", "audio/webm", "audio/aac", "audio/flac"
]);
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
  "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg", "audio/webm": "webm", "audio/aac": "aac", "audio/flac": "flac"
};

function kindOf(mimeType: string): "image" | "video" | "audio" | undefined {
  return mimeType.startsWith("image/") ? "image" : mimeType.startsWith("video/") ? "video" : mimeType.startsWith("audio/") ? "audio" : undefined;
}

/** 工作台作曲家的参考素材上传（图片/视频/音频），与顾客资产同一存储链路。 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response;
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File) || value.size < 1) throw new WorkspaceError("workspace_reference_file_required");
    const mimeType = value.type.toLowerCase().split(";")[0].trim();
    const kind = kindOf(mimeType);
    if (!kind || !MIME_TYPES.has(mimeType)) throw new WorkspaceError("workspace_reference_file_type_unsupported", 415);
    if (declaredLength > MAX_BYTES[kind] + 128 * 1024 || value.size > MAX_BYTES[kind]) throw new WorkspaceError("workspace_reference_file_too_large", 413);
    const bytes = Buffer.from(await value.arrayBuffer());
    if (bytes.length !== value.size) throw new WorkspaceError("workspace_reference_file_invalid");
    const customerId = auth.current.customer.id;
    const storageKey = customerAssetStorageKey({ siteId, customerId, fileName: `${randomUUID()}.${EXTENSIONS[mimeType]}` });
    await writeCustomerAssetFileShared({ storageKey, bytes, mimeType, purpose: "input" });
    try {
      const { asset } = await createAssetUploadRelational({ siteId, customerId, label: (value.name.replace(/\.[^.]+$/, "").trim() || "Reference").slice(0, 160), mimeType, role: "input", storageKey, subjectRole: "aivideosugc_reference" });
      return workspaceResponse({ asset: { id: asset.id, url: `/api/sites/${siteId}/customers/${customerId}/assets/${asset.id}/download`, mimeType, size: bytes.length } }, 201);
    } catch (error) {
      await deleteCustomerAssetFileShared(storageKey).catch(() => undefined);
      throw error;
    }
  } catch (error) { return workspaceFailure(error); }
}
