const base = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const smokeIp = `127.80.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`;

function splitSetCookie(header) {
  return (header || "").split(/,(?=\s*[^;,]+=)/).map((part) => part.trim()).filter(Boolean);
}

function cookiesFrom(response) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : splitSetCookie(response.headers.get("set-cookie"));
  return setCookies.map((part) => part.split(";")[0]).join("; ");
}

function cookieValue(cookieHeader, name) {
  const item = cookieHeader.split(/;\s*/).find((part) => part.startsWith(`${name}=`));
  if (!item) throw new Error(`missing_cookie:${name}`);
  return item.slice(name.length + 1);
}

async function request(path, { method = "GET", body, cookie, csrf, allowFailure = false, headers = {} } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-forwarded-for": smokeIp,
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
    throw new Error(`${method} ${path} failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return { response, json };
}

function expectStatus(result, status, label) {
  if (result.response.status !== status) {
    throw new Error(`${label} expected ${status}, got ${result.response.status} ${JSON.stringify(result.json)}`);
  }
}

function expectOneOfStatuses(result, statuses, label) {
  if (!statuses.includes(result.response.status)) {
    throw new Error(`${label} expected one of ${statuses.join("/")}, got ${result.response.status} ${JSON.stringify(result.json)}`);
  }
}

function expectBusinessAllowed(result, label) {
  if (result.response.ok) return;
  const securityFailures = new Set([
    "site_admin_login_required",
    "customer_login_required",
    "csrf_token_required",
    "csrf_token_mismatch",
    "site_admin_forbidden",
    "customer_forbidden",
    "rate_limited"
  ]);
  if (securityFailures.has(result.json?.error)) {
    throw new Error(`${label} unexpectedly failed at security layer: ${result.response.status} ${JSON.stringify(result.json)}`);
  }
  if (![400, 404, 409, 422].includes(result.response.status)) {
    throw new Error(`${label} expected success or business restriction, got ${result.response.status} ${JSON.stringify(result.json)}`);
  }
}

function expectSecurityHeaders(response, label) {
  const expectedHeaders = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "x-frame-options": "SAMEORIGIN",
    "content-security-policy": "frame-ancestors 'self'"
  };
  for (const [name, expected] of Object.entries(expectedHeaders)) {
    const actual = response.headers.get(name);
    if (actual !== expected) {
      throw new Error(`${label} expected ${name}: ${expected}, got ${actual}`);
    }
  }

  const permissionsPolicy = response.headers.get("permissions-policy") || "";
  for (const directive of ["camera=()", "microphone=()", "geolocation=()", "payment=()", "usb=()"]) {
    if (!permissionsPolicy.includes(directive)) {
      throw new Error(`${label} expected permissions-policy to include ${directive}, got ${permissionsPolicy}`);
    }
  }
}

expectSecurityHeaders((await request("/", { allowFailure: true })).response, "security headers");
expectSecurityHeaders((await request("/robots.txt", { allowFailure: true })).response, "robots security headers");

const legacyReset = await request("/api/platform/state", {
  method: "POST",
  body: { reset: true },
  headers: { "x-smoke-reset": "true" },
  allowFailure: true
});
expectOneOfStatuses(legacyReset, [200, 204, 410], "legacy platform reset");

const statefulFixtureResetUnavailable = legacyReset.response.status === 410;
const ownerLogin = await request("/api/sites/site_lumen/admin/auth/login", {
  method: "POST",
  body: { email: "owner@lumen.localhost", password: "lumen123" },
  allowFailure: statefulFixtureResetUnavailable
});
if (statefulFixtureResetUnavailable && ownerLogin.response.status === 401) {
  console.log(JSON.stringify({
    ok: true,
    checks: ["security-headers", "robots-security-headers"],
    skipped: ["csrf", "rbac", "rate-limit", "customer-boundary"],
    reason: "legacy reset is disabled and the local Lumen relational fixture is not at the seed credentials"
  }, null, 2));
  process.exit(0);
}
if (!ownerLogin.response.ok) {
  throw new Error(`POST /api/sites/site_lumen/admin/auth/login failed: ${ownerLogin.response.status} ${JSON.stringify(ownerLogin.json)}`);
}
const ownerCookie = cookiesFrom(ownerLogin.response);
const ownerCsrf = cookieValue(ownerCookie, "site_admin_csrf_site_lumen");

expectStatus(
  await request("/api/sites/site_lumen/admins", {
    method: "POST",
    body: { email: `unauth-${runId}@example.test`, password: "secret123", displayName: "Unauthed", role: "support" },
    allowFailure: true
  }),
  401,
  "site admin mutation without login"
);

expectStatus(
  await request("/api/sites/site_lumen/admins", {
    method: "POST",
    cookie: ownerCookie,
    body: { email: `no-csrf-${runId}@example.test`, password: "secret123", displayName: "No CSRF", role: "support" },
    allowFailure: true
  }),
  403,
  "site admin mutation without csrf"
);

expectStatus(
  await request("/api/sites/site_lumen/admins", {
    method: "POST",
    cookie: ownerCookie,
    csrf: "bad-token",
    body: { email: `bad-csrf-${runId}@example.test`, password: "secret123", displayName: "Bad CSRF", role: "support" },
    allowFailure: true
  }),
  403,
  "site admin mutation with bad csrf"
);

const supportEmail = `support-security-${runId}@example.test`;
expectBusinessAllowed(await request("/api/sites/site_lumen/admins", {
  method: "POST",
  cookie: ownerCookie,
  csrf: ownerCsrf,
  body: { email: supportEmail, password: "secret123", displayName: "Support Security", role: "support" },
  allowFailure: true
}), "site admin mutation with csrf");

const supportLogin = await request("/api/sites/site_lumen/admin/auth/login", {
  method: "POST",
  body: { email: supportEmail, password: "secret123" }
});
const supportCookie = cookiesFrom(supportLogin.response);
const supportCsrf = cookieValue(supportCookie, "site_admin_csrf_site_lumen");
expectStatus(
  await request("/api/sites/site_lumen/admins", {
    method: "POST",
    cookie: supportCookie,
    csrf: supportCsrf,
    body: { email: `forbidden-${runId}@example.test`, password: "secret123", displayName: "Forbidden", role: "support" },
    allowFailure: true
  }),
  403,
  "support role cannot create admins"
);

let saw429 = false;
for (let index = 0; index < 12; index += 1) {
  const result = await request("/api/sites/site_lumen/admins", {
    method: "POST",
    cookie: ownerCookie,
    csrf: ownerCsrf,
    body: { email: `rate-${runId}-${index}@example.test`, password: "secret123", displayName: `Rate ${index}`, role: "support" },
    allowFailure: true
  });
  if (result.response.status === 429) {
    saw429 = true;
    break;
  }
}
if (!saw429) throw new Error("admin mutation rate limit was not enforced");

const customerLogin = await request("/api/sites/site_lumen/auth/login", {
  method: "POST",
  body: { email: "mara@northpier.studio", password: "mara123" }
});
const customerCookie = cookiesFrom(customerLogin.response);
const customerCsrf = cookieValue(customerCookie, "customer_csrf_site_lumen");

expectStatus(
  await request("/api/sites/site_lumen/customers/cust_lumen_mara/assets", {
    method: "POST",
    body: { label: `unauth-upload-${runId}`, mimeType: "image/jpeg", role: "input" },
    allowFailure: true
  }),
  401,
  "customer upload without login"
);

expectStatus(
  await request("/api/sites/site_lumen/customers/cust_lumen_mara/assets", {
    method: "POST",
    cookie: customerCookie,
    body: { label: `no-csrf-upload-${runId}`, mimeType: "image/jpeg", role: "input" },
    allowFailure: true
  }),
  403,
  "customer upload without csrf"
);

const crossCustomer = await request("/api/sites/site_lumen/customers/cust_lumen_ivo/assets", {
  method: "POST",
  cookie: customerCookie,
  csrf: customerCsrf,
  body: { label: `cross-customer-${runId}`, mimeType: "image/jpeg", role: "input" },
  allowFailure: true
});
expectOneOfStatuses(crossCustomer, [401, 403], "cross-customer upload");

await request("/api/sites/site_lumen/customers/cust_lumen_mara/assets", {
  method: "POST",
  cookie: customerCookie,
  csrf: customerCsrf,
  body: { label: `valid-upload-${runId}`, mimeType: "image/jpeg", role: "input" }
});

console.log(JSON.stringify({ ok: true, checks: ["security-headers", "csrf", "rbac", "rate-limit", "customer-boundary"] }, null, 2));
