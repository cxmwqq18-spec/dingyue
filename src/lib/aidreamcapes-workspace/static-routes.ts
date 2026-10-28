// Static, bookmark-safe routes for Aidreamcapes workspace entry points.
// Public pages must never link to /app/create with query parameters; known
// intents live at fixed path segments instead:
//   /app/create/<view>                     fixed workspace view
//   /app/create/tool/<tool>[/<template>]   start a tool/template
//   /app/create/demo/<slug>                curated demo prompt
// Free-form customer input (typed prompts, product URLs, post-login task
// continuation) is not part of this scheme and never appears in public links.
import { isWorkspaceView, WORKSPACE_VIEWS, workspaceViewSegment, WORKSPACE_VIEW_SEGMENTS, type WorkspaceView } from "./navigation";
import { canonicalWorkspaceTool } from "./tool-aliases";

export type StaticCreateTarget =
  | { kind: "view"; view: WorkspaceView }
  | { kind: "tool"; tool: string; template?: string }
  | { kind: "demo"; slug: string }
  | { kind: "templates"; category?: string }
  | { kind: "library"; filter: string };

export const TEMPLATE_CATEGORY_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
export const LIBRARY_FILTERS = new Set(["all", "completed", "draft", "active", "failed"]);

const TOOL_SEGMENT_RE = /^[a-z0-9][a-z0-9-]{0,60}$/;
const TEMPLATE_SEGMENT_RE = /^[a-z0-9][a-z0-9-]{0,40}$/;
const DEMO_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;

// Individual tools use /app/create/<tool>. Group membership validates old
// prefixed links before redirecting them to the short canonical path.
// "url-to-video" is not listed: it is the fixed segment of the URL to Video
// module view, so /app/create/url-to-video must resolve as a view, not a tool.
const VIDEO_GROUP_TOOLS = new Set(["image-to-video", "video-ads", "product-video", "before-after-video", "spokesperson-video", "unboxing-videos"]);
const IMAGE_GROUP_TOOLS = new Set(["custom", "photo-hub", "white-background", "lifestyle-photos", "model-photos", "change-background", "social-ad-photos"]);

export function workspaceToolGroup(tool: string): "video" | "image" | undefined {
  const canonical = canonicalWorkspaceTool(tool);
  if (VIDEO_GROUP_TOOLS.has(canonical)) return "video";
  if (IMAGE_GROUP_TOOLS.has(canonical)) return "image";
  return undefined;
}

function groupViewForSegment(segment: string): WorkspaceView | undefined {
  const entry = Object.entries(WORKSPACE_VIEW_SEGMENTS).find(([, candidate]) => candidate === segment);
  return entry?.[0] as WorkspaceView | undefined;
}

export type StaticDemo = {
  slug: string;
  view: WorkspaceView;
  prompt: string;
  scene?: "presenter_showcase" | "process_demo" | "texture_closeup" | "text_to_video";
  aspect?: "9:16" | "1:1" | "16:9";
  duration?: 6 | 10 | 15 | 30;
  tool?: string;
};

export const STATIC_DEMOS: StaticDemo[] = [
  {
    slug: "product-demonstration",
    view: "agent",
    prompt: "Create a product demonstration using my uploaded product photo. Show the product clearly, explain one useful feature using the details I provide, and end with a clear next step.",
    scene: "process_demo", aspect: "9:16", duration: 15,
  },
  {
    slug: "new-product-intro",
    view: "agent",
    prompt: "Introduce my new product with a clear opening, one main product benefit supported by the details I provide, and a short invitation to learn more.",
    scene: "process_demo", aspect: "9:16", duration: 15,
  },
  {
    slug: "product-closeup",
    view: "agent",
    prompt: "Show close-up views of my product, including the packaging and visible details. Keep the product recognizable from my reference photo and use a clean, focused presentation.",
    scene: "texture_closeup", aspect: "9:16", duration: 15,
  },
  {
    slug: "serum-15s-video",
    view: "video",
    prompt: "Create a 15-second video for this serum.",
    aspect: "9:16", duration: 15,
  },
  {
    slug: "skincare-presenter-intro",
    view: "video",
    prompt: "Create a natural AI presenter introduction to my skincare serum. Show the bottle and dropper, use only the product details I provide, and end with an invitation to learn more.",
    scene: "presenter_showcase", aspect: "9:16", duration: 15,
  },
  {
    slug: "skincare-presenter-agent",
    view: "agent",
    prompt: "Create a natural AI presenter introduction to my skincare serum. Show the bottle and dropper, use only the product details I provide, and end with an invitation to learn more.",
    scene: "presenter_showcase", aspect: "9:16", duration: 15,
  },
  {
    slug: "fragrance-presenter",
    view: "video",
    prompt: "Create a relaxed presenter video introducing my home fragrance product. Use my own product photo, show the packaging clearly and describe only the details I provide.",
    scene: "presenter_showcase", aspect: "9:16", duration: 15,
  },
  {
    slug: "mug-car-morning",
    view: "images",
    prompt: "Show my insulated travel mug in a parked car as part of a relaxed morning routine. Keep the mug shape and color consistent with my own uploaded product photo.",
    aspect: "1:1", tool: "lifestyle-photos",
  },
  {
    slug: "clean-reference-photo",
    view: "images",
    prompt: "Create a clean product photo using my own reference image. Keep the product shape and color consistent, use soft natural lighting, and place the product in a simple everyday setting.",
    aspect: "1:1", tool: "custom",
  },
  {
    slug: "everyday-setting-photo",
    view: "images",
    prompt: "Place my product in a simple everyday setting with soft natural lighting. Keep its shape and color consistent with my uploaded reference photo.",
    aspect: "1:1", tool: "lifestyle-photos",
  },
  {
    slug: "white-background-product",
    view: "images",
    prompt: "Show my product clearly on a clean white background. Keep the shape, color and visible details consistent with my uploaded reference photo.",
    aspect: "1:1", tool: "white-background",
  },
  {
    slug: "closeup-product-detail",
    view: "images",
    prompt: "Create a clear close-up product image that emphasizes the visible details of my uploaded product photo without changing the product design.",
    aspect: "1:1", tool: "custom",
  },
  {
    slug: "vertical-social-product",
    view: "images",
    prompt: "Create a vertical product image for a social post. Give the product a clear visual focus and leave room around it for a short message.",
    aspect: "9:16", tool: "custom",
  },
  {
    slug: "square-product-image",
    view: "images",
    prompt: "Create a square product image using my own uploaded product photo. Keep the product details clear and consistent.",
    aspect: "1:1", tool: "custom",
  },
  {
    slug: "square-product-page",
    view: "images",
    prompt: "Create a square product photo for my product page. Use a clean background, clear lighting and a close view of the product details. Keep the product consistent with my reference photo.",
    aspect: "1:1", tool: "white-background",
  },
];

const demoBySlug = new Map(STATIC_DEMOS.map((demo) => [demo.slug, demo]));

export function staticDemoForHref(href: string): { slug: string } | undefined {
  try {
    const url = new URL(href, "https://www.aivideosugc.com");
    if (url.pathname !== "/app/create" || !url.searchParams.get("prompt")) return undefined;
    const view = url.searchParams.get("view") ?? "";
    // Batch duplicates of the curated agent demos land on the same agent view.
    const normalizedView = view === "batch" ? "agent" : view === "home" ? "video" : view;
    const prompt = url.searchParams.get("prompt");
    // Match on the curated (view, prompt) pair; the registry supplies the
    // canonical scene/aspect/duration/tool regardless of link variants.
    const demo = STATIC_DEMOS.find((candidate) => candidate.view === normalizedView && candidate.prompt === prompt);
    return demo ? { slug: demo.slug } : undefined;
  } catch {
    return undefined;
  }
}

/** Parse fixed segments after /app/create. Returns undefined for non-static or reserved (scene/jobs) routes. */
export function parseStaticCreateSegments(segments: string[]): StaticCreateTarget | undefined {
  if (segments.length < 1 || segments.length > 3) return undefined;
  const [first, second, third] = segments;
  if (first === "scene" || first === "jobs") return undefined;
  const groupView = groupViewForSegment(first);
  if (groupView && segments.length >= 2) {
    // The text-to-video storyboard and the URL to Video importer are module
    // views, not tools: they live under ai-video-generation/.
    if (second === "text-to-video" && segments.length === 2 && groupView === "video") return { kind: "view", view: "agent" };
    if (second === "url-to-video" && segments.length === 2 && groupView === "video") return { kind: "view", view: "videoLink" };
    // Tool routes filed under their public directory: the tool must belong to it.
    if (!TOOL_SEGMENT_RE.test(second) || workspaceToolGroup(second) !== (groupView === "images" ? "image" : "video")) return undefined;
    if (segments.length === 2) return { kind: "tool", tool: canonicalWorkspaceTool(second) };
    if (TEMPLATE_SEGMENT_RE.test(third)) return { kind: "tool", tool: canonicalWorkspaceTool(second), template: third };
    return undefined;
  }
  if (workspaceToolGroup(first) && segments.length <= 2 && (!second || TEMPLATE_SEGMENT_RE.test(second))) {
    return { kind: "tool", tool: canonicalWorkspaceTool(first), ...(second ? { template: second } : {}) };
  }
  if (segments.length === 1) {
    if (groupView) return { kind: "view", view: groupView };
    return isWorkspaceView(first) ? { kind: "view", view: first } : undefined;
  }
  if (first === "tool" && segments.length >= 2 && TOOL_SEGMENT_RE.test(second)) {
    if (segments.length === 2) return { kind: "tool", tool: canonicalWorkspaceTool(second) };
    if (TEMPLATE_SEGMENT_RE.test(third)) return { kind: "tool", tool: canonicalWorkspaceTool(second), template: third };
    return undefined;
  }
  if (first === "demo" && segments.length === 2 && DEMO_SLUG_RE.test(second) && demoBySlug.has(second)) {
    return { kind: "demo", slug: second };
  }
  if (first === "templates" && (segments.length === 1 || (segments.length === 2 && TEMPLATE_CATEGORY_RE.test(second)))) {
    return { kind: "templates", ...(segments.length === 2 ? { category: second } : {}) };
  }
  if (first === "library" && segments.length === 2 && LIBRARY_FILTERS.has(second)) {
    return { kind: "library", filter: second };
  }
  return undefined;
}

/** Query-object equivalent understood by aidreamcapesWorkspaceEntry. */
export function staticCreateQuery(target: StaticCreateTarget): Record<string, string> {
  if (target.kind === "view") return { view: target.view };
  if (target.kind === "demo") {
    const demo = demoBySlug.get(target.slug);
    if (!demo) return {};
    const query: Record<string, string> = { view: demo.view, prompt: demo.prompt };
    if (demo.scene) query.scene = demo.scene;
    if (demo.aspect) query.aspect = demo.aspect;
    if (demo.duration !== undefined) query.duration = String(demo.duration);
    if (demo.tool) query.tool = demo.tool;
    if (demo.view === "images") query.tool_id = "image_generator";
    return query;
  }
  if (target.kind === "templates") return { view: "home", templates: "1", ...(target.category ? { category: target.category } : {}) };
  if (target.kind === "library") return { view: "library", filter: target.filter };
  // Tool routes: image tools carry tool_id; video tools open the video panel.
  const imageTools = new Set(["custom", "change-background", "white-background", "model-photos", "lifestyle-photos", "photo-hub", "social-ad-photos"]);
  const tool = canonicalWorkspaceTool(target.tool);
  const query: Record<string, string> = { tool };
  if (imageTools.has(tool)) query.tool_id = "image_generator";
  if (target.template) query.template = target.template;
  return query;
}

export function staticViewHref(basePath: string, view: WorkspaceView): string {
  return `${basePath}/app/create/${workspaceViewSegment(view)}`;
}

export function staticToolHref(basePath: string, tool: string, template?: string): string | undefined {
  const canonical = canonicalWorkspaceTool(tool);
  if (!TOOL_SEGMENT_RE.test(canonical)) return undefined;
  if (template && !TEMPLATE_SEGMENT_RE.test(template)) return undefined;
  const group = workspaceToolGroup(canonical);
  if (!group) return undefined;
  return `${basePath}/app/create/${canonical}${template ? `/${template}` : ""}`;
}

/**
 * Superseded fixed workspace paths redirect to their canonical short path.
 * Returns the path
 * (without the /app/create prefix context) or undefined when the segments are
 * not a legacy form.
 */
export function legacyStaticCreateRedirect(segments: string[]): string | undefined {
  const [first, second, third] = segments;
  const target = parseStaticCreateSegments(segments);
  // Legacy case URLs still render their selection once; the workspace replaces
  // the address with its module URL after consuming it. New SSR links already
  // point directly to that module and carry selection outside the URL.
  if (target && target.kind !== "view" && target.kind !== "library") {
    // The old tool alias for text-to-video is not a case URL; it has a direct
    // module equivalent and must not keep a tool-shaped address.
    if (first === "tool" && second === "text-to-video" && segments.length === 2) return `/app/create/${WORKSPACE_VIEW_SEGMENTS.agent}`;
    return undefined;
  }
  if (["ai-video-generation", "ai-image-generation"].includes(first) && second && segments.length <= 3) {
    if (first === "ai-video-generation" && second === "text-to-video" && segments.length === 2) return "/app/create/text-to-video";
    const group = workspaceToolGroup(second);
    if (group === (first === "ai-video-generation" ? "video" : "image")) return staticToolHref("", second, third);
  }
  if (segments.length === 1) {
    if (first === "video") return `/app/create/${WORKSPACE_VIEW_SEGMENTS.video}`;
    if (first === "images") return `/app/create/${WORKSPACE_VIEW_SEGMENTS.images}`;
    if (first === "actors") return `/app/create/${WORKSPACE_VIEW_SEGMENTS.actors}`;
    if (first === "product") return `/app/create/${WORKSPACE_VIEW_SEGMENTS.product}`;
    if (first === "agent") return `/app/create/${WORKSPACE_VIEW_SEGMENTS.agent}`;
    return undefined;
  }
  if (first === "tool" && segments.length <= 3 && TOOL_SEGMENT_RE.test(second ?? "")) {
    if (second === "text-to-video" && segments.length === 2) return `/app/create/${WORKSPACE_VIEW_SEGMENTS.agent}`;
    const group = workspaceToolGroup(second ?? "");
    if (!group) return undefined;
    if (segments.length === 3 && !TEMPLATE_SEGMENT_RE.test(third ?? "")) return undefined;
    return `${staticToolHref("", second ?? "", segments.length === 3 ? third : undefined)}`;
  }
  return undefined;
}

export function staticDemoHref(basePath: string, slug: string): string | undefined {
  if (!demoBySlug.has(slug)) return undefined;
  return `${basePath}/app/create/demo/${slug}`;
}

/**
 * Map a legacy /app/create query URL to its fixed path. Only links whose
 * entire state is staticizable are redirected; task continuation, login
 * returns, product URLs, filters and arbitrary prompts keep their query.
 */
export function legacyCreateHrefToStatic(href: string): string | undefined {
  let url: URL;
  try { url = new URL(href, "https://www.aivideosugc.com"); } catch { return undefined; }
  if (url.pathname !== "/app/create") return undefined;
  const params = url.searchParams;
  const keys = [...params.keys()].sort();
  if (!keys.length) return "/app/create";
  const kept = new Set(["view", "tool", "tool_id", "template", "prompt", "scene", "aspect", "duration", "plan", "nextHash", "templates", "category", "filter", "videoMode", "size", "length"]);
  if (keys.some((key) => !kept.has(key))) return undefined;
  // Legacy video modes renamed before the static route work. `product-video`
  // is also the canonical tool id now, so it maps to itself.
  const legacyVideoMode: Record<string, string> = { "ugc-ad": "video-ads", "product-video": "product-video" };
  if (params.get("videoMode")) {
    if (keys.length !== 1) return undefined;
    const tool = legacyVideoMode[params.get("videoMode") ?? ""];
    return tool ? staticToolHref("", tool) : undefined;
  }
  if (params.get("prompt")) {
    const demo = staticDemoForHref(href);
    if (demo) return `/app/create/demo/${demo.slug}`;
    // Free-form form submissions retain their input while landing directly in
    // the matching editor. They must never activate the Home module.
    const view = params.get("view");
    const targetView: WorkspaceView = params.get("tool_id") === "image_generator" || view === "images" ? "images"
      : view === "home" || view === "agent" || !params.get("tool") ? "agent"
      : params.get("tool") === "url-to-video" ? "videoLink" : "video";
    const path = staticViewHref("", targetView);
    const extras = new URLSearchParams(params);
    extras.delete("view");
    return `${path}?${extras}`;
  }
  if (params.get("plan")) return "/app/create";
  const view = params.get("view");
  if (params.get("templates") === "1" && (!view || view === "home")) {
    const category = params.get("category");
    if (!category) return "/app/create/templates";
    return TEMPLATE_CATEGORY_RE.test(category) ? `/app/create/templates/${category}` : undefined;
  }
  if (view === "library" && keys.length === 2 && params.get("filter") && LIBRARY_FILTERS.has(params.get("filter") ?? "")) {
    return `/app/create/library/${params.get("filter")}`;
  }
  const tool = params.get("tool");
  const toolId = params.get("tool_id");
  const template = params.get("template");
  if (tool || toolId) {
    if (params.get("nextHash") && !template) return undefined;
    if (view && !isWorkspaceView(view)) return undefined;
    const target = staticToolHref("", tool ?? "", template ?? undefined)
      ?? (tool === "text-to-video" && !template ? `/app/create/${WORKSPACE_VIEW_SEGMENTS.agent}` : undefined)
      ?? (tool === "url-to-video" && !template ? staticViewHref("", "videoLink") : undefined)
      ?? (toolId && !tool ? `/app/create/${WORKSPACE_VIEW_SEGMENTS.images}` : undefined);
    if (!target) return undefined;
    // Format preselection (size/length) stays in the query; the path carries
    // only the canonical tool, like the product-URL handoff keeps its state.
    const extras = new URLSearchParams();
    for (const key of ["size", "length"]) if (params.get(key)) extras.set(key, params.get(key) ?? "");
    return target + (extras.toString() ? `?${extras.toString()}` : "");
  }
  if (view && keys.length === 1 && isWorkspaceView(view)) {
    if (view === "product") return `/app/create/${WORKSPACE_VIEW_SEGMENTS.product}`;
    return `/app/create/${workspaceViewSegment(view)}`;
  }
  return undefined;
}

/** Convert a fixed workspace path to the same intent params the client uses from search. */
export function staticCreateSearchFromPath(pathname: string): URLSearchParams | null {
  const match = pathname.match(/^(?:\/site\/(?:aidreamcapes|aivideosugc))?\/app\/create\/(.+)$/);
  if (!match) return null;
  const segments = decodeURIComponent(match[1]).split("/").filter(Boolean);
  const target = parseStaticCreateSegments(segments);
  if (!target) return null;
  return new URLSearchParams(staticCreateQuery(target));
}

export { WORKSPACE_VIEWS };
