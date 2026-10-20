import { isWorkspaceView, type WorkspaceView } from "./navigation";
import { parseStaticCreateSegments, staticCreateQuery, staticViewHref, workspaceToolGroup } from "./static-routes";
import { workspaceHandoffFromSearchParams } from "./handoff";

export type WorkspaceEntryTransfer = {
  view: WorkspaceView;
  query: Record<string, string>;
  media?: { kind: "photo" | "video"; slug: string };
  scene?: string;
  expires: number;
};
const allowedKeys = new Set(["view", "prompt", "aspect", "duration", "scene", "tool", "tool_id", "template", "size", "length", "templates", "category", "kind", "filter", "source", "preset", "url", "actor"]);
export const entryCookieName = (view: WorkspaceView) => `adc_workspace_entry_${view}`;

/** Only inert public inputs can cross into a workspace; never tasks or assets. */
export function workspaceEntryTarget(href: string, mediaLink = false): { href: string; transfer?: WorkspaceEntryTransfer } {
  let url: URL;
  try { url = new URL(href, "https://www.aivideosugc.com"); } catch { return { href }; }
  if (!["www.aivideosugc.com", "aivideosugc.com", "aidreamcapes.com", "www.aidreamcapes.com", "localhost", "127.0.0.1"].includes(url.hostname)) return { href };
  const base = url.pathname.match(/^\/site\/(?:aidreamcapes|aivideosugc)(?=\/|$)/)?.[0] ?? "";
  const pathname = url.pathname.slice(base.length);
  const query: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (!allowedKeys.has(key)) return { href };
    query[key] = value.slice(0, key === "prompt" || key === "url" ? 2048 : 720);
  }
  let view: WorkspaceView | undefined;
  let media: WorkspaceEntryTransfer["media"];
  let scene: string | undefined;
  const mediaMatch = mediaLink ? pathname.match(/^\/(ai-image-generation|ai-video-generation)\/([a-z0-9-]{1,120})$/i) : null;
  if (mediaMatch) {
    media = { kind: mediaMatch[1] === "ai-image-generation" ? "photo" : "video", slug: mediaMatch[2] };
    view = media.kind === "photo" ? "images" : "video";
  } else if (pathname.startsWith("/app/create/scene/")) {
    scene = pathname.slice("/app/create/scene/".length);
    view = query.tool_id === "image_generator" ? "images" : "video";
  } else if (pathname === "/app/create" || pathname.startsWith("/app/create/")) {
    const target = parseStaticCreateSegments(pathname.slice("/app/create/".length).split("/"));
    if (pathname !== "/app/create" && !target) return { href };
    if (target) Object.assign(query, staticCreateQuery(target));
    const handoff = workspaceHandoffFromSearchParams(new URLSearchParams(query));
    view = isWorkspaceView(query.view) ? query.view : query.tool_id === "image_generator" || workspaceToolGroup(query.tool) === "image" ? "images" : query.tool === "url-to-video" ? "product" : query.tool ? "video" : "agent";
    if (view === "home" && (handoff.prompt || query.tool || query.templates)) view = query.templates ? "video" : "agent";
  }
  if (!view) return { href };
  const destination = staticViewHref(base, view);
  const hasInput = Object.keys(query).some(key => key !== "view") || media || scene;
  return { href: destination, ...(hasInput ? { transfer: { view, query, media, scene, expires: 0 } } : {}) };
}

export function readWorkspaceEntry(value: string | undefined, view: WorkspaceView): WorkspaceEntryTransfer | undefined {
  if (!value || value.length > 12000) return;
  try {
    const entry = JSON.parse(decodeURIComponent(value)) as WorkspaceEntryTransfer;
    if (entry.view !== view || !Number.isFinite(entry.expires) || entry.expires < Date.now() || entry.expires > Date.now() + 130000 || !entry.query || typeof entry.query !== "object" || Array.isArray(entry.query)) return;
    if (Object.entries(entry.query).some(([key, value]) => !allowedKeys.has(key) || typeof value !== "string" || value.length > 2048)) return;
    if (entry.media && (!["photo", "video"].includes(entry.media.kind) || typeof entry.media.slug !== "string" || !/^[a-z0-9-]{1,120}$/i.test(entry.media.slug))) return;
    if (entry.scene && (typeof entry.scene !== "string" || !/^[A-Za-z0-9_.-]{1,720}$/.test(entry.scene))) return;
    return entry;
  } catch { return; }
}
