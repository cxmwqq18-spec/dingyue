const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";

async function request(path, { method = "GET", body, cookie, headers = {}, allowFailure = false } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { cookie } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual"
  });
  const json = await response.clone().json().catch(() => ({}));
  if (!allowFailure && !response.ok) throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  return { response, json, text: () => response.text() };
}

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
  if (!match?.[1]) throw new Error(`missing ${name} cookie`);
  return match[1];
}

function cookiesFrom(response, names) {
  return names.map((name) => cookieFrom(response, name)).join("; ");
}

function cookieValue(cookie, name) {
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

const anonymous = await request("/api/platform/cloudflare", { allowFailure: true });
if (anonymous.response.status !== 401 || anonymous.json.error !== "platform_login_required") {
  throw new Error(`cloudflare API did not require auth: ${anonymous.response.status} ${JSON.stringify(anonymous.json)}`);
}

const login = await request("/api/platform/auth/login", {
  method: "POST",
  body: { email: "platform@local.test", password: "platform123" }
});
const cookie = cookiesFrom(login.response, ["platform_session", "platform_csrf"]);
const csrfToken = cookieValue(cookie, "platform_csrf");

const page = await request("/platform?module=cloudflare", { cookie });
const html = await page.response.text();
for (const marker of ["Cloudflare", "Account ID", "API Token", "账号列表"]) {
  if (!html.includes(marker)) throw new Error(`cloudflare page missing marker: ${marker}`);
}

const status = await request("/api/platform/cloudflare", { cookie });
if (!status.json.ok || !status.json.summary || !Array.isArray(status.json.accounts)) {
  throw new Error(`cloudflare payload incomplete: ${JSON.stringify(status.json)}`);
}

const missingCsrf = await request("/api/platform/cloudflare", {
  method: "PUT",
  cookie,
  body: { label: "Smoke CF", email: "cf@example.com", accountId: "cf_account_smoke", apiToken: "cf_token_smoke" },
  allowFailure: true
});
if (missingCsrf.response.status !== 403 || missingCsrf.json.error !== "csrf_token_required") {
  throw new Error(`cloudflare PUT did not require csrf: ${missingCsrf.response.status} ${JSON.stringify(missingCsrf.json)}`);
}

const saved = await request("/api/platform/cloudflare", {
  method: "PUT",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { label: "Smoke CF", email: "cf@example.com", accountId: "cf_account_smoke", apiToken: "cf_token_smoke", makeCurrent: true }
});
const account = saved.json.accounts.find((item) => item.id === saved.json.currentAccountId);
if (!account?.isCurrent || !account.status.apiTokenConfigured || account.status.apiTokenPreview !== "cf_tok...moke") {
  throw new Error(`cloudflare account save/mask failed: ${JSON.stringify(saved.json)}`);
}

const second = await request("/api/platform/cloudflare", {
  method: "PUT",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { label: "Smoke CF Backup", email: "cf-backup@example.com", accountId: "cf_account_smoke_backup", apiToken: "cf_token_smoke_backup", makeCurrent: false }
});
const backup = second.json.accounts.find((item) => item.accountId === "cf_account_smoke_backup");
if (!backup || second.json.currentAccountId !== account.id) {
  throw new Error(`cloudflare backup account save failed: ${JSON.stringify(second.json)}`);
}

const switched = await request("/api/platform/cloudflare", {
  method: "POST",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { accountId: backup.id, action: "set_current" }
});
if (switched.json.currentAccountId !== backup.id || !switched.json.accounts.find((item) => item.id === backup.id)?.isCurrent) {
  throw new Error(`cloudflare set current failed: ${JSON.stringify(switched.json)}`);
}

const cleared = await request("/api/platform/cloudflare", {
  method: "POST",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { accountId: backup.id, action: "clear_current" }
});
if (cleared.json.currentAccountId || cleared.json.accounts.some((item) => item.isCurrent)) {
  throw new Error(`cloudflare clear current failed: ${JSON.stringify(cleared.json)}`);
}

const deletedBackup = await request("/api/platform/cloudflare", {
  method: "DELETE",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { accountId: backup.id }
});
if (deletedBackup.json.accounts.some((item) => item.id === backup.id)) {
  throw new Error(`cloudflare delete backup failed: ${JSON.stringify(deletedBackup.json)}`);
}

const restored = await request("/api/platform/cloudflare", {
  method: "POST",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { accountId: account.id, action: "set_current" }
});
if (restored.json.currentAccountId !== account.id) {
  throw new Error(`cloudflare restore current failed: ${JSON.stringify(restored.json)}`);
}

const deletedCurrent = await request("/api/platform/cloudflare", {
  method: "DELETE",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { accountId: account.id }
});
if (deletedCurrent.json.currentAccountId === account.id || deletedCurrent.json.accounts.some((item) => item.id === account.id)) {
  throw new Error(`cloudflare delete current failed: ${JSON.stringify(deletedCurrent.json)}`);
}

console.log(JSON.stringify({ ok: true, currentAccountId: deletedCurrent.json.currentAccountId, totalAccounts: deletedCurrent.json.summary.totalAccounts }, null, 2));
