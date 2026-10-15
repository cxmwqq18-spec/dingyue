import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { getBatchGroup } from "@/lib/aidreamcapes-workspace/batch";
import { workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { publicTask } from "@/lib/aidreamcapes-workspace/store";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; batchId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, batchId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const snapshot = await getBatchGroup({ siteId, customerId: auth.current.customer.id, batchId });
    return workspaceResponse({ batch: snapshot.batch, tasks: snapshot.tasks.map(task => ({ ...publicTask(task), batch: task.batch })) });
  } catch (error) {
    return workspaceFailure(error);
  }
}
