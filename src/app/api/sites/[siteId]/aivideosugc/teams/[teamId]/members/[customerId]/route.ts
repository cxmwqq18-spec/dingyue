import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { removeTeamMember } from "@/lib/aidreamcapes-workspace/teams";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; teamId: string; customerId: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { siteId, teamId, customerId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    await removeTeamMember(siteId, teamId, auth.current.customer.id, customerId);
    return developerResponse({ ok: true });
  } catch (error) { return developerFailure(error); }
}
