import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { expectedRevision, jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { getCloneConsent, revokeCloneConsent } from "@/lib/aidreamcapes-workspace/clones";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; consentId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, consentId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ consent: await getCloneConsent(siteId, auth.current.customer.id, consentId) });
  } catch (error) { return workspaceFailure(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { siteId, consentId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await jsonBody(request);
    if (body.action !== "revoke") throw new WorkspaceError("clone_consent_action_invalid");
    return workspaceResponse({ consent: await revokeCloneConsent(siteId, auth.current.customer.id, consentId, expectedRevision(request, body)) });
  } catch (error) { return workspaceFailure(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { siteId, consentId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    return workspaceResponse({ consent: await revokeCloneConsent(siteId, auth.current.customer.id, consentId, expectedRevision(request)) });
  } catch (error) { return workspaceFailure(error); }
}
