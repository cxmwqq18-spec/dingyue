import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { getMusicGenerationCapabilities } from "@/lib/aidreamcapes-workspace/music-generation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return workspaceResponse(getMusicGenerationCapabilities(siteId));
  } catch (error) {
    return workspaceFailure(error);
  }
}
