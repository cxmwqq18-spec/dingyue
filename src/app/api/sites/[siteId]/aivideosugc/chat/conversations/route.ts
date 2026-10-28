import { type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure, jsonBody } from "@/lib/aidreamcapes-workspace/api";
import { createConversation, listConversations } from "@/lib/aidreamcapes-workspace/agent-chat";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    return workspaceResponse({ conversations: await listConversations(auth.current.customer.id) });
  } catch (error) { return workspaceFailure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    const body = await jsonBody(request).catch(() => ({}) as Record<string, unknown>);
    return workspaceResponse({ conversation: await createConversation(auth.current.customer.id, typeof body.title === "string" ? body.title : undefined) });
  } catch (error) { return workspaceFailure(error); }
}
