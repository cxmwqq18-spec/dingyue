import fs from "node:fs";
import path from "node:path";

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

function readPage() {
  const statePath = path.join(process.cwd(), "data", "platform-state.json");
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  const site = state.sites.find((item) => item.id === "site_lumen");
  const page = site?.pages?.[0];
  if (!page) throw new Error("missing_seed_theme_page");
  return page;
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

const page = readPage();
const firstSave = await request(`/api/sites/site_lumen/theme/pages/${page.id}/draft`, {
  method: "PUT",
  cookie,
  csrf,
  body: { draftJson: mutateDraft(page, "initial-save") }
});
const v1 = firstSave.json.draftVersion;
if (!v1?.revision || !v1?.etag) throw new Error("first draft save did not return draftVersion");

const latest = readPage();
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

const publish = await request(`/api/sites/site_lumen/theme/pages/${page.id}/publish`, {
  method: "POST",
  cookie,
  csrf,
  body: { actor: "smoke_designer", expectedRevision: v2.revision, expectedEtag: v2.etag }
});
if (!publish.json.publishedVersion || !publish.json.draftVersion?.revision) {
  throw new Error("publish did not return publishedVersion and draftVersion");
}

const restore = await request("/api/sites/site_lumen/theme/publications/pub_site_lumen_v1/restore-draft", {
  method: "POST",
  cookie,
  csrf,
  body: {}
});
if (restore.json.liveMutated !== false) throw new Error("restore-draft must not mutate live publication");

console.log(JSON.stringify({ ok: true, staleConflict: 409, publishedVersion: publish.json.publishedVersion }, null, 2));
