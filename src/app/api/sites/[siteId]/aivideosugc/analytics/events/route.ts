import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { importProviderMetrics } from "@/lib/aidreamcapes-workspace/analytics";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await developerJsonBody(request);
    const result = await importProviderMetrics(siteId, auth.current.customer.id, body);
    return developerResponse(result, 201);
  } catch (error) {
    return developerFailure(error);
  }
}
