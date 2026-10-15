import type { SceneId } from "./types";

export const WORKSPACE_VIEWS = ["home", "tools", "agent", "video", "images", "product", "actors", "batch", "library", "twin", "clone", "inspirations", "rewards"] as const;
export type WorkspaceView = typeof WORKSPACE_VIEWS[number];
export function isWorkspaceView(value: unknown): value is WorkspaceView {
  return typeof value === "string" && (WORKSPACE_VIEWS as readonly string[]).includes(value);
}

export const WORKSPACE_MODULES: { id: WorkspaceView; title: string; summary: string; group: "main" | "create" | "explore"; planned?: boolean }[] = [
  { id: "home", title: "Home", summary: "Start your next project.", group: "main" },
  { id: "tools", title: "All Tools", summary: "Find a tool for your next project.", group: "main" },
  { id: "library", title: "Library", summary: "Resume saved videos and download your results.", group: "main" },
  { id: "agent", title: "AI Video Agent", summary: "Describe a video and save a draft before editing or generating it.", group: "create" },
  { id: "video", title: "AI Video", summary: "Start a video from your own description and reference photos.", group: "create" },
  { id: "images", title: "AI Image", summary: "Create product images from your description and reference photos.", group: "create" },
  { id: "product", title: "URL to Video", summary: "Review a product page and use its confirmed details in a video draft.", group: "create" },
  { id: "actors", title: "AI Avatar", summary: "Browse presenters, preview voices or add your own portrait.", group: "create" },
  { id: "batch", title: "Batch Drafts", summary: "Create up to ten saved drafts from the same product setup.", group: "create" },
  { id: "inspirations", title: "Inspirations", summary: "Browse video and photo ideas, then use one in your own project.", group: "explore" },
  { id: "twin", title: "AI Twin", summary: "Personal digital twin creation is not available yet.", group: "explore", planned: true },
  { id: "clone", title: "Ad Clone", summary: "Ad analysis and cloning are not available yet.", group: "explore", planned: true },
];

export function workspaceViewHref(basePath: string, view: WorkspaceView): string {
  if (view === "inspirations") return "/site/aidreamcapes/app/inspirations";
  return `${basePath}/app/create?${new URLSearchParams({ view })}`;
}

export type WorkspaceQuickStart = { label: string; sceneId: SceneId; aspect?: "9:16" | "1:1" | "16:9"; duration?: 6 | 10 | 15 | 30 };
