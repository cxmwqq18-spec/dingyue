import { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { previewPublishing } from "@/lib/aidreamcapes-workspace/publishing";

type Context = { params: Promise<{ siteId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    return developerResponse(await previewPublishing(siteId, auth.current.customer.id, await developerJsonBody(request)));
  } catch (error) { return developerFailure(error); }
}
