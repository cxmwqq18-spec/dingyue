import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { listTeamMembers } from "@/lib/aidreamcapes-workspace/teams";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; teamId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, teamId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ members: await listTeamMembers(siteId, teamId, auth.current.customer.id) });
  } catch (error) { return developerFailure(error); }
}
