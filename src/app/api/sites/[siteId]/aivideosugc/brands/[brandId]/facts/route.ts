import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerJsonBody, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { createBrandFact, listBrandFacts } from "@/lib/aidreamcapes-workspace/brands";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; brandId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, brandId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ facts: await listBrandFacts(siteId, brandId, auth.current.customer.id) });
  } catch (error) { return developerFailure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, brandId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    return developerResponse({ fact: await createBrandFact(siteId, brandId, auth.current.customer.id, await developerJsonBody(request)) }, 201);
  } catch (error) { return developerFailure(error); }
}
