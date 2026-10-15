import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { getTeam, updateTeam } from "@/lib/aidreamcapes-workspace/teams";
import { requestRevisionValue } from "@/lib/aidreamcapes-workspace/team-brand-core";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; teamId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, teamId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ team: await getTeam(siteId, teamId, auth.current.customer.id) });
  } catch (error) { return developerFailure(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { siteId, teamId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await developerJsonBody(request);
    return developerResponse({ team: await updateTeam(siteId, teamId, auth.current.customer.id, { name: body.name, revision: requestRevisionValue(request, body) }) });
  } catch (error) { return developerFailure(error); }
}
