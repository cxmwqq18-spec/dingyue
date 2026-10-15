import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { grantCloneConsent, listCloneConsents } from "@/lib/aidreamcapes-workspace/clones";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ consents: await listCloneConsents(siteId, auth.current.customer.id) });
  } catch (error) { return workspaceFailure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const consent = await grantCloneConsent(siteId, auth.current.customer.id, await jsonBody(request));
    return workspaceResponse({ consent }, 201);
  } catch (error) { return workspaceFailure(error); }
}
