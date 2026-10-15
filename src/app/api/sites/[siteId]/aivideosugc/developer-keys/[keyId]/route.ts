import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { revokeDeveloperKey } from "@/lib/aidreamcapes-workspace/developer-api";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; keyId: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { siteId, keyId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    await revokeDeveloperKey(siteId, auth.current.customer.id, keyId);
    return developerResponse({ ok: true });
  } catch (error) { return developerFailure(error); }
}
