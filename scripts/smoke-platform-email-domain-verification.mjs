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
  return { response, json };
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

const login = await request("/api/platform/auth/login", {
  method: "POST",
  body: { email: "platform@local.test", password: "platform123" }
});
const cookie = cookiesFrom(login.response, ["platform_session", "platform_csrf"]);
const csrfToken = cookieValue(cookie, "platform_csrf");

await request("/api/platform/email", {
  method: "PUT",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { apiKey: "re_smoke_domain_key", fromEmail: "verify@smoke.example.com", replyTo: "support@smoke.example.com" }
});
await request("/api/platform/cloudflare", {
  method: "PUT",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { label: "Smoke CF", email: "cf@example.com", accountId: "cf_account_smoke", apiToken: "cf_token_smoke", makeCurrent: true }
});

const missingCsrf = await request("/api/platform/email/domains", {
  method: "POST",
  cookie,
  body: { domain: "smoke.example.com", autoDns: true, verify: true },
  allowFailure: true
});
if (missingCsrf.response.status !== 403 || missingCsrf.json.error !== "csrf_token_required") {
  throw new Error(`email domain provisioning did not require csrf: ${missingCsrf.response.status} ${JSON.stringify(missingCsrf.json)}`);
}

const local = await request("/api/platform/email/domains", {
  method: "POST",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { domain: "lumen.localhost", autoDns: true, verify: true },
  allowFailure: true
});
if (local.response.status !== 400 || local.json.error !== "local_domain_not_verifiable") {
  throw new Error(`local domain was not rejected: ${local.response.status} ${JSON.stringify(local.json)}`);
}

const provisioned = await request("/api/platform/email/domains", {
  method: "POST",
  cookie,
  headers: { "x-csrf-token": csrfToken },
  body: { domain: "smoke.example.com", autoDns: true, verify: true }
});
if (!provisioned.json.ok || !provisioned.json.resend?.domain?.id || !Array.isArray(provisioned.json.dnsRecords) || !provisioned.json.cloudflare?.changes?.length) {
  throw new Error(`email domain provisioning payload incomplete: ${JSON.stringify(provisioned.json)}`);
}
if (provisioned.json.dnsRecords.length < 3) {
  throw new Error(`expected resend dns records to be mapped: ${JSON.stringify(provisioned.json.dnsRecords)}`);
}
if (provisioned.json.resend.verificationStatus !== "verified") {
  throw new Error(`expected mock verification to return verified: ${JSON.stringify(provisioned.json.resend)}`);
}

console.log(JSON.stringify({
  ok: true,
  domain: provisioned.json.domain,
  records: provisioned.json.dnsRecords.length,
  changes: provisioned.json.cloudflare.changes.length,
  status: provisioned.json.resend.verificationStatus
}, null, 2));
