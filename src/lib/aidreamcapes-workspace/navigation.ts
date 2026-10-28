import type { SceneId } from "./types";

export const WORKSPACE_VIEWS = ["home", "tools", "agent", "video", "images", "product", "videoLink", "actors", "batch", "library", "twin", "clone", "inspirations", "analytics", "teams", "developer", "rewards"] as const;
export type WorkspaceView = typeof WORKSPACE_VIEWS[number];
export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return typeof value === "string" && (WORKSPACE_VIEWS as readonly string[]).includes(value);
}

export const WORKSPACE_MODULES: { id: WorkspaceView; title: string; summary: string; group: "main" | "create" | "explore"; status?: "planned" | "simulation" }[] = [
  { id: "home", title: "Home", summary: "Start your next project.", group: "main" },
  { id: "tools", title: "All Tools", summary: "Find a tool for your next project.", group: "main" },
  { id: "library", title: "Library", summary: "Resume saved videos and download your results.", group: "main" },
  { id: "agent", title: "Text to Video", summary: "Turn a written idea and product details into an editable video storyboard.", group: "create" },
  { id: "video", title: "AI Video", summary: "Start a video from your own description and reference photos.", group: "create" },
  { id: "images", title: "AI Image", summary: "Create product images from your description and reference photos.", group: "create" },
  { id: "videoLink", title: "URL to Video", summary: "Review a product page and use its confirmed details in a video draft.", group: "create" },
  { id: "product", title: "Product Links", summary: "Import product pages into your product library, then create videos without leaving the page.", group: "create" },
  { id: "actors", title: "AI Avatar", summary: "Browse presenters, preview voices or add your own portrait.", group: "create" },
  { id: "inspirations", title: "Inspirations", summary: "Browse video and photo ideas, then use one in your own project.", group: "explore" },
  { id: "twin", title: "AI Twin", summary: "Save a presenter profile and try the simulated workflow. Voice training is not connected.", group: "explore", status: "simulation" },
  { id: "clone", title: "Ad Clone", summary: "Edit a sample ad timeline in a simulation. Real video analysis is not connected.", group: "explore", status: "simulation" },
  { id: "analytics", title: "Performance", summary: "Import your advertising results and compare creative performance.", group: "explore" },
  { id: "teams", title: "Teams & Brands", summary: "Manage team access, brand profiles, and product facts you have reviewed.", group: "explore" },
  { id: "developer", title: "Developer access", summary: "Manage API keys and webhook endpoints for your workspace.", group: "explore" },
];

export function workspaceViewHref(basePath: string, view: WorkspaceView): string {
  return `${basePath}/app/create/${workspaceViewSegment(view)}`;
}

// Base editors keep their established segments. Individual tools use their
// own short segment directly below /app/create.
export const WORKSPACE_VIEW_SEGMENTS = {
  video: "ai-video-generation",
  images: "ai-image-generation",
  actors: "ai-actors",
  videoLink: "url-to-video",
  product: "product-links",
  agent: "text-to-video",
} as const;
export type WorkspaceViewSegment = keyof typeof WORKSPACE_VIEW_SEGMENTS;

export function workspaceViewSegment(view: WorkspaceView): string {
  return (WORKSPACE_VIEW_SEGMENTS as Record<string, string | undefined>)[view] ?? view;
}

export type WorkspaceQuickStart = { label: string; sceneId: SceneId; aspect?: "9:16" | "1:1" | "16:9"; duration?: 6 | 10 | 15 | 30 };
