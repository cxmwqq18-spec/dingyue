import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getTask } from "@/lib/aidreamcapes-workspace/store";
import { createQuote, type PaidAction } from "@/lib/aidreamcapes-workspace/quote";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string; taskId: string }> }) {
  try {
    const { siteId, taskId } = await params; const auth = await workspaceAuth(request, siteId); if (!auth.ok) return auth.response;
    const action = request.nextUrl.searchParams.get("action") as PaidAction;
    if (!["generate_shot", "compose_shot"].includes(action)) return workspaceResponse({ error: "invalid_quote_action" }, 400);
    const shotId = request.nextUrl.searchParams.get("shotId") || undefined;
    const task = await getTask(siteId, auth.current.customer.id, taskId);
    if (!shotId || !task.storyboard?.shots.some(s => s.shotId === shotId)) return workspaceResponse({ error: "shot_not_found" }, 404);
    return workspaceResponse({ quote: await createQuote(task, action, shotId) });
  } catch (error) { return workspaceFailure(error); }
}
