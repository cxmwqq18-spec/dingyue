import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getTask } from "@/lib/aidreamcapes-workspace/store";
import { resolveWorkspaceOutput, type WorkspaceOutputKind } from "@/lib/aidreamcapes-workspace/output";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    if (!/^[a-zA-Z0-9_-]{1,180}$/.test(taskId)) throw new WorkspaceError("task_id_invalid", 400);

    const rawKind = request.nextUrl.searchParams.get("kind");
    if (rawKind !== "video" && rawKind !== "subtitles" && rawKind !== "clip") throw new WorkspaceError("workspace_output_kind_invalid", 400);
    const allowedQuery = rawKind === "clip" ? new Set(["kind", "shotId", "versionId"]) : new Set(["kind"]);
    if (request.nextUrl.searchParams.getAll("kind").length !== 1 || [...request.nextUrl.searchParams.keys()].some((key) => !allowedQuery.has(key))) {
      throw new WorkspaceError("workspace_output_kind_invalid", 400);
    }
    const kind: WorkspaceOutputKind = rawKind;
    const shotId = request.nextUrl.searchParams.get("shotId") || undefined;
    const versionId = request.nextUrl.searchParams.get("versionId") || undefined;
    if ((kind === "clip" && (!shotId || !versionId || request.nextUrl.searchParams.getAll("shotId").length !== 1 || request.nextUrl.searchParams.getAll("versionId").length !== 1)) ||
        (kind !== "clip" && (shotId !== undefined || versionId !== undefined))) throw new WorkspaceError("workspace_output_kind_invalid", 400);
    const task = await getTask(siteId, auth.current.customer.id, taskId);
    if (task.siteId !== siteId || task.taskId !== taskId || task.customerId !== auth.current.customer.id) {
      throw new WorkspaceError("task_not_found", 404);
    }

    const output = await resolveWorkspaceOutput(task, kind, { allowMockDownload: true, shotId, versionId });
    const stream = output.handle.createReadStream({ autoClose: true });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": output.contentType,
        "Content-Disposition": `${kind === "video" ? "inline" : "attachment"}; filename="${output.filename}"`,
        "Content-Length": String(output.size),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return workspaceFailure(error);
  }
}
