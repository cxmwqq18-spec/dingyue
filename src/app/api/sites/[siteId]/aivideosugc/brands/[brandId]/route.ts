import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { getBrand, updateBrand } from "@/lib/aidreamcapes-workspace/brands";
import { requestRevisionValue } from "@/lib/aidreamcapes-workspace/team-brand-core";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; brandId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, brandId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ brand: await getBrand(siteId, brandId, auth.current.customer.id) });
  } catch (error) { return developerFailure(error); }
}

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const { siteId, brandId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await developerJsonBody(request);
    return developerResponse({ brand: await updateBrand(siteId, brandId, auth.current.customer.id, { name: body.name, profile: body.profile, revision: requestRevisionValue(request, body) }) });
  } catch (error) { return developerFailure(error); }
}
