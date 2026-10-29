/**
 * The workspace login is the site-root `/login` route. Returning to a specific
 * tool uses the `view` query, never a path prefix: the workspace is served from
 * the domain root (www.aivideosugc.com), so prefixed shapes like
 * `/site/aidreamcapes/app/create` or a partially stripped `routeRoot` produced
 * corrupted `next` targets such as `/app/create/teams/app/create?view=teams`.
 */
export function workspaceLoginHref(view: string): string {
  return `/login?next=${encodeURIComponent(`/app/create?view=${encodeURIComponent(view)}`)}`;
}

export const WORKSPACE_THEME_STORAGE_KEY = "aivideosugc-workspace-theme";
