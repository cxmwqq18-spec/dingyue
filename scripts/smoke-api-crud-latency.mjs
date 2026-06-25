const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3210";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 12000);
const slowMs = Number(process.env.SMOKE_SLOW_MS || 800);

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
  if (!match?.[1]) throw new Error(`missing ${name} cookie`);
  return match[1];
}

function cookieValue(cookie, name) {
  return cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function timedRequest(target) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${base}${target.path}`, {
      method: target.method,
      headers: {
        ...(target.body ? { "Content-Type": "application/json" } : {}),
        ...(target.cookie ? { cookie: target.cookie } : {}),
        ...(target.csrf ? { "x-csrf-token": target.csrf } : {}),
        "x-smoke-crud-latency": "true"
      },
      body: target.body ? JSON.stringify(target.body) : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal
    });
    const text = await response.text().catch(() => "");
    return {
      name: target.name,
      method: target.method,
      path: target.path,
      status: response.status,
      ok: target.expect?.includes(response.status) ?? response.status < 500,
      ms: Math.round(performance.now() - started),
      bytes: text.length,
      sample: text.slice(0, 160)
    };
  } catch (error) {
    return {
      name: target.name,
      method: target.method,
      path: target.path,
      status: 0,
      ok: false,
      ms: Math.round(performance.now() - started),
      error: error?.name || "fetch_failed",
      sample: String(error?.message ?? error).slice(0, 160)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function loginPlatform() {
  const response = await fetch(`${base}/api/platform/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "platform@local.test", password: "platform123" }),
    redirect: "manual"
  });
  if (!response.ok) throw new Error(`platform_login_failed:${response.status}`);
  const csrfCookie = cookieFrom(response, "platform_csrf");
  return {
    cookie: [cookieFrom(response, "platform_session"), csrfCookie].join("; "),
    csrf: cookieValue(csrfCookie, "platform_csrf")
  };
}

async function loginSiteAdmin(siteId, email, password) {
  const response = await fetch(`${base}/api/sites/${siteId}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual"
  });
  if (!response.ok) throw new Error(`site_admin_login_failed:${siteId}:${response.status}`);
  const csrfName = `site_admin_csrf_${siteId}`;
  const csrfCookie = cookieFrom(response, csrfName);
  return {
    cookie: [cookieFrom(response, `site_admin_session_${siteId}`), csrfCookie].join("; "),
    csrf: cookieValue(csrfCookie, csrfName)
  };
}

const platform = await loginPlatform();
const siteAdmin = await loginSiteAdmin("site_lumen", "owner@lumen.localhost", "lumen123");

const targets = [
  { name: "platform state snapshot", method: "GET", path: "/api/platform/state", expect: [200] },
  { name: "platform sites list", method: "GET", path: "/api/platform/sites", cookie: platform.cookie, expect: [200] },
  { name: "platform ai providers", method: "GET", path: "/api/platform/ai-providers", cookie: platform.cookie, expect: [200] },
  { name: "platform email", method: "GET", path: "/api/platform/email", cookie: platform.cookie, expect: [200] },
  { name: "platform cloudflare", method: "GET", path: "/api/platform/cloudflare", cookie: platform.cookie, expect: [200] },
  {
    name: "platform sites create validation",
    method: "POST",
    path: "/api/platform/sites",
    cookie: platform.cookie,
    csrf: platform.csrf,
    body: {},
    expect: [400]
  },
  {
    name: "platform ai provider validation",
    method: "PUT",
    path: "/api/platform/ai-providers",
    cookie: platform.cookie,
    csrf: platform.csrf,
    body: { label: "", aiUrl: "", modelType: "" },
    expect: [400]
  },
  {
    name: "platform cloudflare validation",
    method: "PUT",
    path: "/api/platform/cloudflare",
    cookie: platform.cookie,
    csrf: platform.csrf,
    body: { label: "", email: "bad", accountId: "" },
    expect: [400]
  },
  {
    name: "platform email test validation",
    method: "POST",
    path: "/api/platform/email",
    cookie: platform.cookie,
    csrf: platform.csrf,
    body: { to: "bad" },
    expect: [400]
  },
  { name: "site email", method: "GET", path: "/api/sites/site_lumen/email", cookie: siteAdmin.cookie, expect: [200] },
  { name: "site customers export", method: "GET", path: "/api/sites/site_lumen/customers/export", cookie: siteAdmin.cookie, expect: [200] },
  {
    name: "site customer status validation",
    method: "PATCH",
    path: "/api/sites/site_lumen/customers/cust_lumen_mara/status",
    cookie: siteAdmin.cookie,
    body: {},
    expect: [400]
  },
  {
    name: "site credits validation",
    method: "POST",
    path: "/api/sites/site_lumen/customers/cust_lumen_mara/credits/adjust",
    cookie: siteAdmin.cookie,
    csrf: siteAdmin.csrf,
    body: { amount: 0, reason: "" },
    expect: [400]
  },
  { name: "customer assets unauthenticated", method: "GET", path: "/api/sites/site_dreamshoot/customers/cust_dreamshoot_nora/assets?limit=25", expect: [401] },
  { name: "jobs head", method: "HEAD", path: "/api/sites/site_dreamshoot/ai/jobs", expect: [200] },
  { name: "jobs options", method: "OPTIONS", path: "/api/sites/site_dreamshoot/ai/jobs", expect: [204] }
];

const results = [];
for (const target of targets) {
  results.push(await timedRequest(target));
}

const sorted = [...results].sort((left, right) => right.ms - left.ms);
const report = {
  ok: results.every((result) => result.ok),
  generatedAt: new Date().toISOString(),
  base,
  timeoutMs,
  slowMs,
  slowTargets: sorted.filter((result) => result.ms >= slowMs),
  summary: sorted.map(({ sample, ...result }) => result)
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  const failures = results.filter((result) => !result.ok).map((result) => `${result.method} ${result.path} -> ${result.status}: ${result.sample}`);
  console.error(failures.join("\n"));
  process.exit(1);
}
