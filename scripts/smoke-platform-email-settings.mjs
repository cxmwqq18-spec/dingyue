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
  if (!allowFailure && !response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return { response, json };
}

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
  const cookie = match?.[1];
  if (!cookie || !cookie.includes("=")) throw new Error(`missing ${name} cookie`);
  return cookie;
}

function cookiesFrom(response, names) {
  return names.map((name) => cookieFrom(response, name)).join("; ");
}

function cookieValue(cookie, name) {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

const anonymous = await request("/api/platform/email", { allowFailure: true });
if (anonymous.response.status !== 401 || anonymous.json.error !== "platform_login_required") {
  throw new Error(`platform email API did not require auth: ${anonymous.response.status} ${JSON.stringify(anonymous.json)}`);
}

const login = await request("/api/platform/auth/login", {
  method: "POST",
  body: { email: "platform@local.test", password: "platform123" }
});
const platformCookie = cookiesFrom(login.response, ["platform_session", "platform_csrf"]);
const csrfToken = cookieValue(platformCookie, "platform_csrf");
if (!csrfToken) throw new Error("platform csrf cookie missing");

const page = await request("/platform?module=email", { cookie: platformCookie });
const html = await page.response.text();
for (const marker of ["邮件配置", "Resend", "跨站发送域名", "测试验证码邮件"]) {
  if (!html.includes(marker)) throw new Error(`platform email page missing marker: ${marker}`);
}

const status = await request("/api/platform/email", { cookie: platformCookie });
if (!status.json.ok || !status.json.config || !status.json.summary || !Array.isArray(status.json.sites)) {
  throw new Error(`platform email payload incomplete: ${JSON.stringify(status.json)}`);
}
if (status.json.config.apiKeyPreview && status.json.config.apiKeyPreview.startsWith("re_") && !status.json.config.apiKeyPreview.includes("...")) {
  throw new Error(`platform email leaked unmasked api key: ${status.json.config.apiKeyPreview}`);
}
if (status.json.summary.totalSites !== status.json.sites.length) {
  throw new Error(`platform email summary does not match sites: ${JSON.stringify(status.json.summary)}`);
}

const missingCsrf = await request("/api/platform/email", {
  method: "PUT",
  cookie: platformCookie,
  body: { fromEmail: "Verify <verify@example.com>", replyTo: "support@example.com" },
  allowFailure: true
});
if (missingCsrf.response.status !== 403 || missingCsrf.json.error !== "csrf_token_required") {
  throw new Error(`platform email PUT did not require csrf: ${missingCsrf.response.status} ${JSON.stringify(missingCsrf.json)}`);
}

const updated = await request("/api/platform/email", {
  method: "PUT",
  cookie: platformCookie,
  headers: { "x-csrf-token": csrfToken },
  body: {
    apiKey: "re_smoke_platform_email_key",
    fromEmail: "verify@lumen.localhost",
    replyTo: "support@lumen.localhost"
  }
});
if (!updated.json.config.apiKeyConfigured || updated.json.config.apiKeyPreview !== "re_smo..._key") {
  throw new Error(`platform email PUT did not save masked api key status: ${JSON.stringify(updated.json.config)}`);
}
const lumenRow = updated.json.sites.find((row) => row.site.id === "site_lumen");
if (!lumenRow || !lumenRow.blockingReasons.includes("local_domain_not_verifiable")) {
  throw new Error(`local site domain was not flagged as unverifiable: ${JSON.stringify(lumenRow)}`);
}

const invalidTest = await request("/api/platform/email", {
  method: "POST",
  cookie: platformCookie,
  headers: { "x-csrf-token": csrfToken },
  body: { to: "not-an-email", siteId: "site_lumen" },
  allowFailure: true
});
if (invalidTest.response.status !== 400 || invalidTest.json.error !== "invalid_email") {
  throw new Error(`platform email test did not validate email: ${invalidTest.response.status} ${JSON.stringify(invalidTest.json)}`);
}

const testSend = await request("/api/platform/email", {
  method: "POST",
  cookie: platformCookie,
  headers: { "x-csrf-token": csrfToken },
  body: { to: "platform-email-smoke@example.com", siteId: "site_lumen" },
  allowFailure: true
});
if (testSend.response.ok && !testSend.json.messageId) {
  throw new Error(`platform email test send succeeded without message id: ${JSON.stringify(testSend.json)}`);
}
if (!testSend.response.ok && !["email_provider_not_configured", "resend_domain_not_verified", "email_send_failed"].includes(testSend.json.error)) {
  throw new Error(`platform email test send returned unexpected error: ${testSend.response.status} ${JSON.stringify(testSend.json)}`);
}

console.log(JSON.stringify({
  ok: true,
  readySites: updated.json.summary.readySites,
  totalSites: updated.json.summary.totalSites,
  blockingReasons: lumenRow.blockingReasons
}, null, 2));
