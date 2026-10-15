import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { deleteActor } from "@/lib/aidreamcapes-workspace/store";
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ siteId: string; actorId: string }> }) {
  try { const { siteId, actorId } = await params; const auth = await workspaceAuth(request, siteId, true); if (!auth.ok) return auth.response; await deleteActor(siteId, auth.current.customer.id, actorId); return workspaceResponse({ ok: true }); }
  catch (error) { return workspaceFailure(error); }
}
