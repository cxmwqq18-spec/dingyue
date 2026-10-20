import { isWorkspaceView, type WorkspaceView } from "./navigation";
import type { SceneId, TaskInput } from "./types";

type SearchParamsLike = { get(name: string): string | null };
export type WorkspaceLibraryFilter = "all" | "draft" | "completed";

/** Form values only: links cannot supply private assets, actor IDs, tasks, or operations. */
export type WorkspaceHandoff = {
  view?: WorkspaceView;
  prompt?: string;
  aspect?: TaskInput["options"]["aspect"];
  duration?: TaskInput["options"]["duration"];
  scene?: SceneId;
  tool?: "custom" | "change-background" | "white-background" | "model-photos" | "lifestyle-photos" | "video-ads" | "spokesperson-videos" | "product-videos" | "before-after-videos" | "unboxing-videos" | "url-to-video";
  templates?: boolean;
  category?: string;
  kind?: "photo" | "video";
  filter?: WorkspaceLibraryFilter;
};

const aspects = ["9:16", "1:1", "16:9"] as const;
const durations = [15, 30] as const;
const scenes = ["presenter_showcase", "process_demo", "texture_closeup"] as const;
const tools = ["custom", "change-background", "white-background", "model-photos", "lifestyle-photos", "video-ads", "spokesperson-videos", "product-videos", "before-after-videos", "unboxing-videos", "url-to-video"] as const;

export function workspaceHandoffFromSearchParams(params: SearchParamsLike): WorkspaceHandoff {
  const view = params.get("view");
  const prompt = params.get("prompt")?.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim().slice(0, 2000);
  const aspect = aspects.find((value) => value === (params.get("aspect") ?? params.get("size")));
  const duration = durations.find((value) => String(value) === (params.get("duration") ?? params.get("length")));
  const scene = scenes.find((value) => value === params.get("scene"));
  const tool = tools.find((value) => value === params.get("tool"));
  const filter = params.get("filter");
  const kind = params.get("kind");
  const category = params.get("category");
  return {
    ...(isWorkspaceView(view) ? { view } : {}),
    ...(prompt ? { prompt } : {}),
    ...(aspect ? { aspect } : {}),
    ...(duration ? { duration } : {}),
    ...(scene ? { scene } : {}),
    ...(tool ? { tool } : {}),
    ...(params.get("templates") === "1" ? { templates: true } : {}),
    ...(category && /^[a-zA-Z0-9_-]{1,100}$/.test(category) ? { category } : {}),
    ...(kind === "photo" || kind === "video" ? { kind } : {}),
    ...(filter === "all" || filter === "draft" || filter === "completed" ? { filter } : {})
  };
}

/** Build an inert workspace entry URL for host or localhost storefront routing. */
export function workspaceHandoffHref(basePath: string, handoff: WorkspaceHandoff): string {
  const base = basePath.replace(/\/+$/, "");
  if (!["", "/site/aidreamcapes", "/site/aivideosugc"].includes(base)) throw new Error("Unsupported Aidreamcapes storefront base path");
  const raw = new URLSearchParams();
  for (const key of ["view", "prompt", "aspect", "duration", "scene", "tool", "category", "kind", "filter"] as const) {
    if (handoff[key] !== undefined) raw.set(key, String(handoff[key]));
  }
  if (handoff.templates) raw.set("templates", "1");
  const safe = workspaceHandoffFromSearchParams(raw);
  const query = new URLSearchParams();
  for (const key of ["view", "prompt", "aspect", "duration", "scene", "tool", "category", "kind", "filter"] as const) {
    if (safe[key] !== undefined) query.set(key, String(safe[key]));
  }
  if (safe.templates) query.set("templates", "1");
  // Existing image draft storage treats this as explicit input, so an old draft's
  // private references are not brought into a fresh public-page handoff.
  if (safe.view === "images") {
    query.set("tool_id", "image_generator");
    query.set("tool", safe.tool && ["custom", "change-background", "white-background", "model-photos", "lifestyle-photos"].includes(safe.tool) ? safe.tool : "custom");
  }
  return `${base}/app/create${query.size ? `?${query}` : ""}`;
}
