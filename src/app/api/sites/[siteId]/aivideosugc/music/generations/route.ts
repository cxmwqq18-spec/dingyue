import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import {
  getMusicGenerationCapabilities,
  listMusicGenerationJobs,
  queueMusicGenerationJob,
} from "@/lib/aidreamcapes-workspace/music-generation";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ jobs: await listMusicGenerationJobs(siteId, auth.current.customer.id) });
  } catch (error) {
    return workspaceFailure(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const result = await queueMusicGenerationJob(
      siteId,
      auth.current.customer.id,
      await jsonBody(request),
      request.headers.get("idempotency-key"),
    );
    return workspaceResponse({ ...result, capabilities: getMusicGenerationCapabilities(siteId) }, result.created ? 201 : 200);
  } catch (error) {
    return workspaceFailure(error);
  }
}
