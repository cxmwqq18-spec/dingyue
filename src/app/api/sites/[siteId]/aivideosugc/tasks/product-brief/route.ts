import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { previewProductBrief } from "@/lib/aidreamcapes-workspace/product-brief";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ siteId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;

    const body = await jsonBody(request);
    const preview = await previewProductBrief(body.url);
    return workspaceResponse({ ok: true, preview });
  } catch (error) {
    return workspaceFailure(error);
  }
}
