import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody } from "@/lib/aidreamcapes-workspace/api";
import { WORKSPACE_DURATIONS } from "@/lib/aidreamcapes-workspace/catalogs";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";
import { quoteComposerGeneration } from "@/lib/aidreamcapes-workspace/provider";

/** 工作台作曲家的生成前积分预估（不创建任务）。 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await jsonBody(request) as { modelId?: string; duration?: number; aspect?: string; resolution?: string; imageInputCount?: number; videoInputCount?: number; audioInputCount?: number };
    const duration = Number(body.duration);
    if (!Number.isSafeInteger(duration) || !(WORKSPACE_DURATIONS as readonly number[]).includes(duration)) throw new WorkspaceError("invalid_options");
    const quote = await quoteComposerGeneration({
      siteId,
      modelId: typeof body.modelId === "string" ? body.modelId : undefined,
      duration,
      aspect: typeof body.aspect === "string" ? body.aspect : "9:16",
      resolution: typeof body.resolution === "string" ? body.resolution : undefined,
      imageInputCount: Number.isSafeInteger(body.imageInputCount) ? Math.max(0, Math.min(8, body.imageInputCount!)) : 0,
      videoInputCount: Number.isSafeInteger(body.videoInputCount) ? Math.max(0, Math.min(4, body.videoInputCount!)) : 0,
      audioInputCount: Number.isSafeInteger(body.audioInputCount) ? Math.max(0, Math.min(4, body.audioInputCount!)) : 0
    });
    return workspaceResponse({ quote });
  } catch (error) { return workspaceFailure(error); }
}
