import { type NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure, jsonBody } from "@/lib/aidreamcapes-workspace/api";
import { sendMessageStream } from "@/lib/aidreamcapes-workspace/agent-chat";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; conversationId: string }> };

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId, conversationId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    const body = await jsonBody(request);
    const stream = await sendMessageStream({ customerId: auth.current.customer.id, conversationId, content: String(body.content ?? ""), signal: request.signal });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no"
      }
    });
  } catch (error) { return workspaceFailure(error); }
}
