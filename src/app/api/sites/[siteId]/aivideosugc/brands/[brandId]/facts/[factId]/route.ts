import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { getBrandFact, updateBrandFact } from "@/lib/aidreamcapes-workspace/brands";
import { requestRevisionValue } from "@/lib/aidreamcapes-workspace/team-brand-core";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; brandId: string; factId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, brandId, factId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse(await getBrandFact(siteId, brandId, factId, auth.current.customer.id));
  } catch (error) { return developerFailure(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { siteId, brandId, factId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await developerJsonBody(request);
    const { revision: _revision, ...patch } = body;
    return developerResponse({ fact: await updateBrandFact(siteId, brandId, factId, auth.current.customer.id, requestRevisionValue(request, body), patch) });
  } catch (error) { return developerFailure(error); }
}
