import type { ThemeDraftMeta, ThemePageJson, ThemeSettings } from "@/lib/types";
import { siteAdminJsonHeaders } from "@/lib/client-csrf";

export type DraftSaveResult = {
  ok: boolean;
  status: number;
  error?: string;
  draftVersion?: ThemeDraftMeta;
};

export type DraftBulkSaveResult = {
  ok: boolean;
  draftVersions: Record<string, ThemeDraftMeta>;
  errors: Array<{ pageId: string; status: number; error?: string }>;
};

export type PublishDraftResult = {
  ok: boolean;
  status: number;
  error?: string;
  publishedVersion?: number;
  draftVersion?: ThemeDraftMeta;
  pageDraftVersions?: Record<string, ThemeDraftMeta>;
  settingsDraftVersion?: ThemeDraftMeta;
};

function expectedPayload(expected?: ThemeDraftMeta) {
  return expected ? { expectedRevision: expected.revision, expectedEtag: expected.etag } : {};
}

async function jsonResult<T extends { error?: string }>(response: Response): Promise<T> {
  return (await response.json().catch(() => ({}))) as T;
}

export async function saveThemeSettingsDraft(siteId: string, draftJson: ThemeSettings, expected?: ThemeDraftMeta): Promise<DraftSaveResult> {
  const response = await fetch(`/api/sites/${siteId}/theme/settings/draft`, {
    method: "PUT",
    headers: siteAdminJsonHeaders(siteId),
    body: JSON.stringify({ draftJson, ...expectedPayload(expected) })
  });
  const json = await jsonResult<{ error?: string; draftVersion?: ThemeDraftMeta }>(response);
  return { ok: response.ok, status: response.status, error: json.error, draftVersion: json.draftVersion };
}

export async function saveThemePageDraft(siteId: string, pageId: string, draftJson: ThemePageJson, expected?: ThemeDraftMeta): Promise<DraftSaveResult> {
  const response = await fetch(`/api/sites/${siteId}/theme/pages/${pageId}/draft`, {
    method: "PUT",
    headers: siteAdminJsonHeaders(siteId),
    body: JSON.stringify({ draftJson, ...expectedPayload(expected) })
  });
  const json = await jsonResult<{ error?: string; draftVersion?: ThemeDraftMeta }>(response);
  return { ok: response.ok, status: response.status, error: json.error, draftVersion: json.draftVersion };
}

export async function saveAllThemePageDrafts(siteId: string, drafts: Array<{ pageId: string; draftJson: ThemePageJson; expected?: ThemeDraftMeta }>): Promise<DraftBulkSaveResult> {
  const results: Array<{ pageId: string; result: DraftSaveResult }> = [];
  for (const item of drafts) {
    results.push({ pageId: item.pageId, result: await saveThemePageDraft(siteId, item.pageId, item.draftJson, item.expected) });
  }
  return {
    ok: results.every((item) => item.result.ok),
    draftVersions: Object.fromEntries(
      results
        .filter((item): item is { pageId: string; result: DraftSaveResult & { draftVersion: ThemeDraftMeta } } => Boolean(item.result.draftVersion))
        .map((item) => [item.pageId, item.result.draftVersion])
    ),
    errors: results
      .filter((item) => !item.result.ok)
      .map((item) => ({ pageId: item.pageId, status: item.result.status, error: item.result.error }))
  };
}

export async function publishThemePageDraft(
  siteId: string,
  pageId: string,
  actor = "site_admin_demo",
  expected?: {
    pageVersions?: Record<string, ThemeDraftMeta | undefined>;
    settingsVersion?: ThemeDraftMeta;
    publishedVersion?: number;
  }
): Promise<PublishDraftResult> {
  const expectedPageVersions = expected?.pageVersions
    ? Object.fromEntries(
        Object.entries(expected.pageVersions)
          .filter((entry): entry is [string, ThemeDraftMeta] => Boolean(entry[1]))
          .map(([id, version]) => [id, { revision: version.revision, etag: version.etag }])
      )
    : undefined;
  const response = await fetch(`/api/sites/${siteId}/theme/pages/${pageId}/publish`, {
    method: "POST",
    headers: siteAdminJsonHeaders(siteId),
    body: JSON.stringify({
      actor,
      expectedPageVersions,
      expectedSettingsVersion: expected?.settingsVersion
        ? { revision: expected.settingsVersion.revision, etag: expected.settingsVersion.etag }
        : undefined,
      expectedPublishedVersion: expected?.publishedVersion
    })
  });
  const json = await jsonResult<Omit<PublishDraftResult, "ok" | "status">>(response);
  return { ok: response.ok, status: response.status, ...json };
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
  return (await response.json()) as { sourceVersion?: number; site?: import("@/lib/types").Site };
}
