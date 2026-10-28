import { type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { deleteConversation, getConversationMessages } from "@/lib/aidreamcapes-workspace/agent-chat";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; conversationId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, conversationId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    return workspaceResponse({ messages: await getConversationMessages(auth.current.customer.id, conversationId) });
  } catch (error) { return workspaceFailure(error); }
}

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { siteId, conversationId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    await deleteConversation(auth.current.customer.id, conversationId);
    return workspaceResponse({ deleted: true });
  } catch (error) { return workspaceFailure(error); }
}
