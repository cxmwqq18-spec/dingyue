import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { inviteExistingCustomer, listTeamInvites } from "@/lib/aidreamcapes-workspace/teams";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; teamId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, teamId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ invites: await listTeamInvites(siteId, teamId, auth.current.customer.id) });
  } catch (error) { return developerFailure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, teamId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await developerJsonBody(request);
    if (typeof body.customerId !== "string") throw Object.assign(new Error("team_invite_customer_required"), { status: 400 });
    return developerResponse({ invite: await inviteExistingCustomer(siteId, teamId, auth.current.customer.id, body.customerId, body.role) }, 201);
  } catch (error) { return developerFailure(error); }
}
