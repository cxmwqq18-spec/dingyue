import type { ThemePageJson, ThemeSettings } from "@/lib/types";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";

export async function saveThemeSettingsDraft(siteId: string, draftJson: ThemeSettings) {
  const response = await fetch(`/api/sites/${siteId}/theme/settings/draft`, {
    method: "PUT",
    headers: siteAdminJsonHeaders(siteId),
    body: JSON.stringify({ draftJson })
  });
  return response.ok;
}

export async function saveThemePageDraft(siteId: string, pageId: string, draftJson: ThemePageJson) {
  const response = await fetch(`/api/sites/${siteId}/theme/pages/${pageId}/draft`, {
    method: "PUT",
    headers: siteAdminJsonHeaders(siteId),
    body: JSON.stringify({ draftJson })
  });
  return response.ok;
}

export async function saveAllThemePageDrafts(siteId: string, drafts: Array<{ pageId: string; draftJson: ThemePageJson }>) {
  const results = await Promise.all(
    drafts.map((item) => saveThemePageDraft(siteId, item.pageId, item.draftJson))
  );
  return results.every(Boolean);
}

export async function publishThemePageDraft(siteId: string, pageId: string, actor = "site_admin_demo") {
  const response = await fetch(`/api/sites/${siteId}/theme/pages/${pageId}/publish`, {
    method: "POST",
    headers: siteAdminJsonHeaders(siteId),
    body: JSON.stringify({ actor })
  });
  if (!response.ok) return null;
  return (await response.json()) as { publishedVersion?: number };
}

export async function rollbackThemePageDraft(siteId: string, pageId: string) {
  const response = await fetch(`/api/sites/${siteId}/theme/pages/${pageId}/rollback`, { method: "POST", headers: siteAdminJsonHeaders(siteId) });
  return response.ok;
}

export async function resetThemeDraftFromActive(siteId: string, actor = "site_admin_demo") {
  const response = await fetch(`/api/sites/${siteId}/theme/reset-draft`, {
    method: "POST",
    headers: siteAdminJsonHeaders(siteId),
    body: JSON.stringify({ actor })
  });
  if (!response.ok) return null;
  return (await response.json()) as { sourceVersion?: number };
}
