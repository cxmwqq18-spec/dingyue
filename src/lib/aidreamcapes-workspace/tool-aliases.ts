// Public workspace links moved from plural tool names to singular names on
// 2026-10-22. The old names stay accepted as aliases so saved drafts, browser
// bookmarks and previously shared links keep opening the same editor.
export const WORKSPACE_TOOL_ALIASES: Readonly<Record<string, string>> = {
  "product-videos": "product-video",
  "before-after-videos": "before-after-video",
  "spokesperson-videos": "spokesperson-video"
};

/** Normalize a workspace tool id without rejecting legacy plural links. */
export function canonicalWorkspaceTool(tool: string): string {
  return WORKSPACE_TOOL_ALIASES[tool] ?? tool;
}
