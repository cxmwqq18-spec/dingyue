import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { jsonBody, workspaceFailure, workspaceResponse } from "@/lib/aidreamcapes-workspace/api";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

function parseTikTokShareUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.length > 2048) throw new WorkspaceError("video_link_invalid");
  let url: URL;
  try { url = new URL(value.trim()); } catch { throw new WorkspaceError("video_link_invalid"); }
  const hosts = new Set(["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"]);
  if (url.protocol !== "https:" || url.username || url.password || url.port || !hosts.has(url.hostname.toLowerCase())) throw new WorkspaceError("video_link_invalid");
  const isShortHost = ["vm.tiktok.com", "vt.tiktok.com"].includes(url.hostname.toLowerCase());
  const isShortPath = isShortHost
    ? /^\/[A-Za-z0-9_-]{4,}\/?$/.test(url.pathname)
    : /^\/(?:t|v)\/[A-Za-z0-9_-]{4,}\/?$/.test(url.pathname);
  if (!isShortPath) throw new WorkspaceError("video_link_invalid");
  url.hash = "";
  return url.toString();
}

async function readBoundedText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) throw new WorkspaceError("video_link_resolution_failed", 422);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) throw new WorkspaceError("video_link_resolution_failed", 422);
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    if (siteId !== "site_aidreamcapes") throw new WorkspaceError("site_not_supported", 404);
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await jsonBody(request);
    const shareUrl = parseTikTokShareUrl(body.url);
    let response: Response;
    try {
      const endpoint = new URL("https://www.tiktok.com/oembed");
      endpoint.searchParams.set("url", shareUrl);
      response = await fetch(endpoint, {
        headers: { accept: "application/json" },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new WorkspaceError("video_link_resolution_failed", 422);
    }
    if (!response.ok || !response.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      throw new WorkspaceError("video_link_resolution_failed", 422);
    }
    const raw = await readBoundedText(response, 128 * 1024);
    let data: unknown;
    try { data = JSON.parse(raw); } catch { throw new WorkspaceError("video_link_resolution_failed", 422); }
    const html = data && typeof data === "object" && "html" in data && typeof data.html === "string" ? data.html : "";
    const videoId = html.match(/data-video-id\s*=\s*["'](\d{8,25})["']/i)?.[1]
      ?? html.match(/tiktok\.com\/embed\/v2\/(\d{8,25})/i)?.[1];
    if (!videoId) throw new WorkspaceError("video_link_resolution_failed", 422);
    return workspaceResponse({ videoId });
  } catch (error) {
    return workspaceFailure(error);
  }
}
