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

/**
 * Single-range byte-range parser. Video players must be able to seek, which
 * requires 206 Partial Content responses over the local render files.
 */
function parseByteRange(header: string | null, size: number): { start: number; end: number } | "unsatisfiable" | undefined {
  if (!header?.startsWith("bytes=") || size <= 0) return undefined;
  const range = header.slice("bytes=".length).split(",")[0]?.trim();
  if (!range || !range.includes("-")) return undefined;
  const [startValue, endValue] = range.split("-", 2);
  if (!startValue) {
    const suffixLength = Number(endValue);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "unsatisfiable";
    return { start: Math.max(size - Math.trunc(suffixLength), 0), end: size - 1 };
  }
  const start = Number(startValue);
  const end = endValue ? Number(endValue) : size - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "unsatisfiable";
  const normalizedStart = Math.trunc(start);
  const normalizedEnd = Math.min(Math.trunc(end), size - 1);
  if (normalizedStart < 0 || normalizedStart >= size || normalizedEnd < normalizedStart) return "unsatisfiable";
  return { start: normalizedStart, end: normalizedEnd };
}

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId, taskId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    if (!/^[a-zA-Z0-9_-]{1,180}$/.test(taskId)) throw new WorkspaceError("task_id_invalid", 400);

    const rawKind = request.nextUrl.searchParams.get("kind");
    if (rawKind !== "video" && rawKind !== "subtitles" && rawKind !== "clip") throw new WorkspaceError("workspace_output_kind_invalid", 400);
    const allowedQuery = rawKind === "clip" ? new Set(["kind", "shotId", "versionId"]) : rawKind === "video" ? new Set(["kind", "renderId"]) : new Set(["kind"]);
    if (request.nextUrl.searchParams.getAll("kind").length !== 1 || [...request.nextUrl.searchParams.keys()].some((key) => !allowedQuery.has(key))) {
      throw new WorkspaceError("workspace_output_kind_invalid", 400);
    }
    const kind: WorkspaceOutputKind = rawKind;
    const shotId = request.nextUrl.searchParams.get("shotId") || undefined;
    const versionId = request.nextUrl.searchParams.get("versionId") || undefined;
    const renderId = request.nextUrl.searchParams.get("renderId") || undefined;
    if ((kind === "clip" && (!shotId || !versionId || request.nextUrl.searchParams.getAll("shotId").length !== 1 || request.nextUrl.searchParams.getAll("versionId").length !== 1)) ||
        (kind !== "clip" && (shotId !== undefined || versionId !== undefined)) ||
        (renderId !== undefined && (!/^[a-zA-Z0-9_-]{1,180}$/.test(renderId) || request.nextUrl.searchParams.getAll("renderId").length !== 1 || kind !== "video"))) throw new WorkspaceError("workspace_output_kind_invalid", 400);
    const task = await getTask(siteId, auth.current.customer.id, taskId);
    if (task.siteId !== siteId || task.taskId !== taskId || task.customerId !== auth.current.customer.id) {
      throw new WorkspaceError("task_not_found", 404);
    }

    const output = await resolveWorkspaceOutput(task, kind, { allowMockDownload: true, shotId, versionId, renderId });
    const disposition = `${kind === "video" ? "inline" : "attachment"}; filename="${output.filename}"`;
    const range = parseByteRange(request.headers.get("range"), output.size);
    if (range === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${output.size}`, "Cache-Control": "private, no-store" }
      });
    }
    if (range) {
      const stream = output.handle.createReadStream({ start: range.start, end: range.end, autoClose: true });
      return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
        status: 206,
        headers: {
          "Content-Type": output.contentType,
          "Content-Disposition": disposition,
          "Content-Range": `bytes ${range.start}-${range.end}/${output.size}`,
          "Content-Length": String(range.end - range.start + 1),
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        }
      });
    }
    const stream = output.handle.createReadStream({ autoClose: true });
    return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, {
      headers: {
        "Content-Type": output.contentType,
        "Content-Disposition": disposition,
        "Content-Length": String(output.size),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return workspaceFailure(error);
  }
}
