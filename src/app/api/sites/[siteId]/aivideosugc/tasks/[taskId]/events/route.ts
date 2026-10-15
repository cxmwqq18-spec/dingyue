import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getTask, publicTask } from "@/lib/aidreamcapes-workspace/store";
import { refreshTask } from "@/lib/aidreamcapes-workspace/runner";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string; taskId: string }> }) {
  try {
    const { siteId, taskId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    let task = await getTask(siteId, auth.current.customer.id, taskId);
    const encoder = new TextEncoder(); const start = Date.now(); let cancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        let revision = -1;
        try {
          while (!cancelled && !request.signal.aborted && Date.now() - start < 50_000) {
            task = await refreshTask(await getTask(siteId, auth.current.customer.id, taskId));
            if (task.revision !== revision) { controller.enqueue(encoder.encode(`id: ${task.revision}\nevent: task\ndata: ${JSON.stringify({ task: publicTask(task) })}\n\n`)); revision = task.revision; }
            else controller.enqueue(encoder.encode(": heartbeat\n\n"));
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch { if (!cancelled && !request.signal.aborted) controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "progress_read_failed" })}\n\n`)); }
        finally { if (!cancelled) controller.close(); }
      },
      cancel() { cancelled = true; }
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "private, no-store", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
  } catch (error) { return workspaceFailure(error); }
}
