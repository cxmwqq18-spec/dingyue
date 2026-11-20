import { Readable } from "node:stream";
import fs from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getTask } from "@/lib/aidreamcapes-workspace/store";
import { resolveWorkspaceOutput, workspaceRenderRoot, type WorkspaceOutputKind } from "@/lib/aidreamcapes-workspace/output";
import { resolveVideoPosterFile, resolveWebVideo } from "@/lib/media-web-transcode";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; taskId: string }> };

const previewCacheControl = "private, max-age=86400, immutable";

/**
 * Serve the cached sidecar directly from nginx when the internal prefix is
 * configured. Node then only authorizes the request; the file (and its range
 * requests) never passes through the app process.
 */
function renderXAccelResponse(filePath: string, contentType: string): Response | undefined {
  const configured = process.env.AIVIDEOSUGC_RENDER_X_ACCEL_PREFIX?.trim();
  if (!configured) return undefined;
  const root = workspaceRenderRoot();
  const relative = path.relative(root, filePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return undefined;
  const prefix = configured.endsWith("/") ? configured : `${configured}/`;
  return new Response(null, {
    headers: {
      "Content-Type": contentType,
      "Accept-Ranges": "bytes",
      "Cache-Control": previewCacheControl,
      "X-Robots-Tag": "noindex, nofollow",
      "X-Accel-Redirect": `${prefix}${relative.split(path.sep).map(encodeURIComponent).join("/")}`
    }
  });
}

async function streamFile(filePath: string, contentType: string, size: number, range: { start: number; end: number } | undefined, filename: string): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Disposition": `inline; filename="${filename}"`,
    "Accept-Ranges": "bytes",
    "Cache-Control": previewCacheControl,
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow"
  };
  if (range) {
    headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
    headers["Content-Length"] = String(range.end - range.start + 1);
  } else {
    headers["Content-Length"] = String(size);
  }
  const handle = await fs.open(filePath, "r");
  const stream = handle.createReadStream(range ? { start: range.start, end: range.end, autoClose: true } : { autoClose: true });
  return new Response(Readable.toWeb(stream) as ReadableStream<Uint8Array>, { status: range ? 206 : 200, headers });
}

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
    // `poster` and `web` are the library playback pair: a small JPEG first
    // frame and a 720p copy. `web` also applies to mock clips.
    const wantsPoster = request.nextUrl.searchParams.get("poster") === "1";
    const wantsWeb = request.nextUrl.searchParams.get("web") === "1";
    const allowedQuery = rawKind === "clip"
      ? new Set(["kind", "shotId", "versionId", "web"])
      : rawKind === "video" ? new Set(["kind", "renderId", "web", "poster"]) : new Set(["kind"]);
    if (request.nextUrl.searchParams.getAll("kind").length !== 1 ||
        ["poster", "web"].some((key) => request.nextUrl.searchParams.getAll(key).length > 1) ||
        [...request.nextUrl.searchParams.keys()].some((key) => !allowedQuery.has(key))) {
      throw new WorkspaceError("workspace_output_kind_invalid", 400);
    }
    const kind: WorkspaceOutputKind = rawKind;
    if ((wantsPoster && kind !== "video") || (wantsWeb && kind === "subtitles")) throw new WorkspaceError("workspace_output_kind_invalid", 400);
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

    // Library cards paint a cached poster and only fetch the 720p copy when the
    // customer presses play. Downloads keep using the untouched original below.
    if (wantsPoster) {
      await output.handle.close();
      const poster = await resolveVideoPosterFile(output.path);
      const accel = renderXAccelResponse(poster.filePath, "image/jpeg");
      if (accel) return accel;
      const bytes = await fs.readFile(poster.filePath);
      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(poster.size),
          "Cache-Control": previewCacheControl,
          "X-Content-Type-Options": "nosniff"
        }
      });
    }
    if (wantsWeb) {
      await output.handle.close();
      const web = await resolveWebVideo(output.path);
      const webRange = parseByteRange(request.headers.get("range"), web.size);
      if (webRange === "unsatisfiable") {
        return new Response(null, {
          status: 416,
          headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes */${web.size}`, "Cache-Control": previewCacheControl }
        });
      }
      const accel = renderXAccelResponse(web.filePath, "video/mp4");
      if (accel) return accel;
      return await streamFile(web.filePath, "video/mp4", web.size, webRange, `${output.filename.replace(/\.mp4$/i, "")}-preview.mp4`);
    }

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
