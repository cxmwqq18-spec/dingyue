import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { createTeam, listTeams } from "@/lib/aidreamcapes-workspace/teams";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ teams: await listTeams(siteId, auth.current.customer.id) });
  } catch (error) { return developerFailure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await developerJsonBody(request);
    return developerResponse({ team: await createTeam(siteId, auth.current.customer.id, body.name) }, 201);
  } catch (error) { return developerFailure(error); }
}
