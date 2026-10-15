import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody, imageTask } from "@/lib/aidreamcapes-workspace/api";
import { createQuote } from "@/lib/aidreamcapes-workspace/quote";
export async function POST(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try { const { siteId } = await params; const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response; return workspaceResponse({ quote: await createQuote(await imageTask(auth.current.customer.id, await jsonBody(request)), "generate_image") }); }
  catch (error) { return workspaceFailure(error); }
}
