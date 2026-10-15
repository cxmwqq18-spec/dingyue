import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { acceptTeamInvite } from "@/lib/aidreamcapes-workspace/teams";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; inviteId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, inviteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    return developerResponse(await acceptTeamInvite(siteId, inviteId, auth.current.customer.id));
  } catch (error) { return developerFailure(error); }
}
