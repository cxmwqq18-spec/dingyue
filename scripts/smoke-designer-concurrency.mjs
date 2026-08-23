import fs from "node:fs";
import path from "node:path";
import { readPlatformStateFromSql } from "./lib/platform-state-sql.mjs";

const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";

function splitSetCookie(header) {
  return (header || "").split(/,(?=\s*[^;,]+=)/).map((part) => part.trim()).filter(Boolean);
}

function cookiesFrom(response) {
  return splitSetCookie(response.headers.get("set-cookie")).map((part) => part.split(";")[0]).join("; ");
}

function cookieValue(cookieHeader, name) {
  const item = cookieHeader.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  if (!item) throw new Error(`missing_cookie:${name}`);
  return item.slice(name.length + 1);
}

async function request(pathname, { method = "GET", body, cookie, csrf, allowFailure = false, headers = {} } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { "x-csrf-token": csrf } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const json = await response.clone().json().catch(() => ({}));
  if (!allowFailure && !response.ok) {
    throw new Error(`${method} ${pathname} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return { response, json };
}

async function readSite() {
  const state = await readPlatformStateFromSql();
  const site = state.sites.find((item) => item.id === "site_lumen");
  if (!site) throw new Error("missing_seed_site_lumen");
  return site;
}

async function readPage() {
  const site = await readSite();
  const page = site?.pages?.[0];
  if (!page) throw new Error("missing_seed_theme_page");
  return page;
}

function draftMetaFrom(value) {
  const draftMeta = value?.draftMeta ?? value?.draftJson?.draftMeta;
  if (draftMeta?.revision && draftMeta?.etag) return draftMeta;
  const revision = Math.max(1, Number(value?.draftJson?.version ?? 1));
  return { revision, etag: `W/"${revision}-legacy"` };
}

function publishedVersionFromSite(site) {
  return Math.max(1, ...(site?.pages ?? []).map((page) => Number(page?.publishedJson?.version ?? 1)));
}

function publishSnapshotPayload(site, actor) {
  return {
    actor,
    expectedPageVersions: Object.fromEntries((site?.pages ?? []).map((item) => [item.id, draftMetaFrom(item)])),
    expectedSettingsVersion: draftMetaFrom(site?.themeSettings),
    expectedPublishedVersion: publishedVersionFromSite(site)
  };
}

function mutateDraft(page, marker) {
  const draftJson = structuredClone(page.draftJson);
  draftJson.sections.__smoke_concurrency_marker = {
    type: "rich_text",
    settings: { heading: marker, body: marker }
  };
  if (!draftJson.sectionsOrder.includes("__smoke_concurrency_marker")) {
    draftJson.sectionsOrder = [...draftJson.sectionsOrder, "__smoke_concurrency_marker"];
  }
  return draftJson;
}

function mutateSettings(site, marker) {
  const draftJson = structuredClone(site.themeSettings.draftJson);
  draftJson.colors = { ...draftJson.colors, accent: marker };
  draftJson.seo = {
    siteTitle: `Lumen ${marker}`,
    siteDescription: "Concurrency smoke settings draft",
    titleTemplate: "%s | Lumen",
    robots: { index: true, follow: true },
    pages: {},
    ...(draftJson.seo ?? {})
  };
  draftJson.seo.siteTitle = `Lumen ${marker}`;
  return draftJson;
}

await request("/api/platform/state", {
  method: "POST",
  body: { reset: true },
  headers: { "x-smoke-reset": "true" }
});

const login = await request("/api/sites/site_lumen/admin/auth/login", {
  method: "POST",
  body: { email: "owner@lumen.localhost", password: "lumen123" }
});
const cookie = cookiesFrom(login.response);
const csrf = cookieValue(cookie, "site_admin_csrf_site_lumen");

const site = await readSite();
const settingsWithoutCsrf = await request(`/api/sites/site_lumen/theme/settings/draft`, {
  method: "PUT",
  cookie,
  body: { draftJson: mutateSettings(site, "#1d4ed8") },
  allowFailure: true
});
if (settingsWithoutCsrf.response.status !== 403) {
  throw new Error(`settings draft without CSRF expected 403, got ${settingsWithoutCsrf.response.status} ${JSON.stringify(settingsWithoutCsrf.json)}`);
}

const settingsWithoutVersion = await request(`/api/sites/site_lumen/theme/settings/draft`, {
  method: "PUT",
  cookie,
  csrf,
  body: { draftJson: mutateSettings(site, "#2563eb") },
  allowFailure: true
});
if (settingsWithoutVersion.response.status !== 428 || settingsWithoutVersion.json.error !== "theme_draft_version_required") {
  throw new Error(`settings draft without version expected 428 theme_draft_version_required, got ${settingsWithoutVersion.response.status} ${JSON.stringify(settingsWithoutVersion.json)}`);
}

const firstSettingsSave = await request(`/api/sites/site_lumen/theme/settings/draft`, {
  method: "PUT",
  cookie,
  csrf,
  body: {
    draftJson: mutateSettings(site, "#1d4ed8"),
    expectedRevision: draftMetaFrom(site.themeSettings).revision,
    expectedEtag: draftMetaFrom(site.themeSettings).etag
  }
});
const settingsV1 = firstSettingsSave.json.draftVersion;
if (!settingsV1?.revision || !settingsV1?.etag) throw new Error("settings draft save did not return draftVersion");

const settingsWinner = await request(`/api/sites/site_lumen/theme/settings/draft`, {
  method: "PUT",
  cookie,
  csrf,
  body: {
    draftJson: mutateSettings(site, "#047857"),
    expectedRevision: settingsV1.revision,
    expectedEtag: settingsV1.etag
  }
});
const settingsV2 = settingsWinner.json.draftVersion;
if (!settingsV2?.revision || settingsV2.revision <= settingsV1.revision) throw new Error("settings winner save did not advance draftVersion");

const settingsStale = await request(`/api/sites/site_lumen/theme/settings/draft`, {
  method: "PUT",
  cookie,
  csrf,
  body: {
    draftJson: mutateSettings(site, "#b91c1c"),
    expectedRevision: settingsV1.revision,
    expectedEtag: settingsV1.etag
  },
  allowFailure: true
});
if (settingsStale.response.status !== 409 || settingsStale.json.error !== "theme_draft_conflict") {
  throw new Error(`stale settings expected 409 theme_draft_conflict, got ${settingsStale.response.status} ${JSON.stringify(settingsStale.json)}`);
}

const page = await readPage();
const firstSave = await request(`/api/sites/site_lumen/theme/pages/${page.id}/draft`, {
  method: "PUT",
  cookie,
  csrf,
  body: { draftJson: mutateDraft(page, "initial-save") }
});
const v1 = firstSave.json.draftVersion;
if (!v1?.revision || !v1?.etag) throw new Error("first draft save did not return draftVersion");

const latest = await readPage();
const winner = await request(`/api/sites/site_lumen/theme/pages/${page.id}/draft`, {
  method: "PUT",
  cookie,
  csrf,
  body: {
    draftJson: mutateDraft(latest, "winner-save"),
    expectedRevision: v1.revision,
    expectedEtag: v1.etag
  }
});
const v2 = winner.json.draftVersion;
if (!v2?.revision || v2.revision <= v1.revision) throw new Error("winner save did not advance draftVersion");

const stale = await request(`/api/sites/site_lumen/theme/pages/${page.id}/draft`, {
  method: "PUT",
  cookie,
  csrf,
  body: {
    draftJson: mutateDraft(latest, "stale-save"),
    expectedRevision: v1.revision,
    expectedEtag: v1.etag
  },
  allowFailure: true
});
if (stale.response.status !== 409 || stale.json.error !== "theme_draft_conflict") {
  throw new Error(`stale draft expected 409 theme_draft_conflict, got ${stale.response.status} ${JSON.stringify(stale.json)}`);
}

const reviewedSite = await readSite();
const reviewedPublishedVersion = publishedVersionFromSite(reviewedSite);
const publishPayload = publishSnapshotPayload(reviewedSite, "smoke_designer");
publishPayload.expectedPageVersions[page.id] = { revision: v2.revision, etag: v2.etag };
publishPayload.expectedSettingsVersion = { revision: settingsV2.revision, etag: settingsV2.etag };
const publish = await request(`/api/sites/site_lumen/theme/pages/${page.id}/publish`, {
  method: "POST",
  cookie,
  csrf,
  body: publishPayload
});
if (!publish.json.publishedVersion || !publish.json.draftVersion?.revision) {
  throw new Error("publish did not return publishedVersion and draftVersion");
}

const stalePublish = await request(`/api/sites/site_lumen/theme/pages/${page.id}/publish`, {
  method: "POST",
  cookie,
  csrf,
  body: { actor: "smoke_designer", expectedPublishedVersion: reviewedPublishedVersion },
  allowFailure: true
});
if (stalePublish.response.status !== 409 || stalePublish.json.error !== "theme_publish_conflict") {
  throw new Error(`stale publish expected 409 theme_publish_conflict, got ${stalePublish.response.status} ${JSON.stringify(stalePublish.json)}`);
}

const restore = await request("/api/sites/site_lumen/theme/publications/pub_site_lumen_v1/restore-draft", {
  method: "POST",
  cookie,
  csrf,
  body: {}
});
if (restore.json.liveMutated !== false) throw new Error("restore-draft must not mutate live publication");

console.log(JSON.stringify({ ok: true, staleConflict: 409, settingsConflict: 409, publishConflict: 409, publishedVersion: publish.json.publishedVersion }, null, 2));
