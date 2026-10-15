import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { CLONE_MEDIA_LIMITS, listCloneSourceAssets, uploadCloneSourceAsset } from "@/lib/aidreamcapes-workspace/clone-media";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ assets: await listCloneSourceAssets(siteId, auth.current.customer.id), limits: CLONE_MEDIA_LIMITS });
  } catch (error) { return workspaceFailure(error); }
}

async function boundedForm(request: NextRequest) {
  const limit = CLONE_MEDIA_LIMITS.videoBytes + 64 * 1024;
  if (Number(request.headers.get("content-length") ?? 0) > limit) throw new WorkspaceError("clone_media_size_invalid", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WorkspaceError("clone_media_required");
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const chunk = await reader.read(); if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) { await reader.cancel(); throw new WorkspaceError("clone_media_size_invalid", 413); }
      chunks.push(chunk.value);
    }
    const bytes = Buffer.concat(chunks);
    return await new Response(bytes, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData();
  } catch (error) {
    if (error instanceof WorkspaceError) throw error;
    throw new WorkspaceError("clone_upload_form_invalid");
  } finally { reader.releaseLock(); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const form = await boundedForm(request);
    const workflow = form.get("workflow"); const file = form.get("file");
    if (workflow !== "voice_twin" && workflow !== "ad_reference") throw new WorkspaceError("clone_workflow_invalid");
    if (!(file instanceof File)) throw new WorkspaceError("clone_media_required");
    const result = await uploadCloneSourceAsset(siteId, auth.current.customer.id, workflow, Buffer.from(await file.arrayBuffer()), file.name);
    return workspaceResponse(result, 201);
  } catch (error) { return workspaceFailure(error); }
}
