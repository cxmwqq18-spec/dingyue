const base = process.env.SITE_ADMIN_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3210";
const siteId = process.env.SITE_ADMIN_SITE_ID ?? "site_dreamshoot";
const username = process.env.SITE_ADMIN_USER ?? "owner@mydreamshoots.localhost";
const password = process.env.SITE_ADMIN_PASSWORD ?? "dreamshoot123";
const timeoutMs = Number(process.env.SITE_ADMIN_API_TIMEOUT_MS ?? 12_000);
const slowMs = Number(process.env.SITE_ADMIN_API_SLOW_MS ?? 1_500);
const repeat = Math.max(1, Math.floor(Number(process.env.SITE_ADMIN_API_REPEAT ?? 2)));

const targets = [
  { name: "orders overview", path: `/api/sites/${siteId}/admin/orders-page?tab=overview` },
  { name: "customers", path: `/api/sites/${siteId}/admin/customers-page` },
  { name: "products", path: `/api/sites/${siteId}/admin/products-page` },
  { name: "ai summary", path: `/api/sites/${siteId}/admin/ai-page?detail=summary` },
  { name: "content summary", path: `/api/sites/${siteId}/admin/content-page` },
  { name: "settings", path: `/api/sites/${siteId}/admin/settings-page` }
];

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
  if (!match?.[1]) throw new Error(`missing ${name} cookie`);
  return match[1];
}

async function loginSiteAdmin() {
  const response = await fetch(`${base}/api/sites/${siteId}/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: username, password }),
    redirect: "manual",
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`site_admin_login_failed:${siteId}:${response.status}`);
  const csrfName = `site_admin_csrf_${siteId}`;
  return [cookieFrom(response, `site_admin_session_${siteId}`), cookieFrom(response, csrfName)].join("; ");
}

async function timedGet(target, cookie, round) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${base}${target.path}`, {
      method: "GET",
      headers: {
        cookie,
        "x-smoke-site-admin-api": "true"
      },
      cache: "no-store",
      signal: controller.signal
    });
    const text = await response.text().catch(() => "");
    return {
      ok: response.ok,
      round,
      name: target.name,
      path: target.path,
      status: response.status,
      ms: Math.round(performance.now() - started),
      bytes: text.length,
      sample: response.ok ? undefined : text.slice(0, 160)
    };
  } catch (error) {
    return {
      ok: false,
      round,
      name: target.name,
      path: target.path,
      status: 0,
      ms: Math.round(performance.now() - started),
      bytes: 0,
      error: error?.name || "fetch_failed",
      sample: String(error?.message ?? error).slice(0, 160)
    };
  } finally {
    clearTimeout(timeout);
  }
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

const cookie = await loginSiteAdmin();
const samples = [];
for (let round = 1; round <= repeat; round += 1) {
  for (const target of targets) {
    samples.push(await timedGet(target, cookie, round));
  }
}

const summary = targets.map((target) => {
  const items = samples.filter((sample) => sample.path === target.path);
  const times = items.map((item) => item.ms);
  const failures = items.filter((item) => !item.ok);
  return {
    name: target.name,
    path: target.path,
    ok: failures.length === 0,
    statuses: [...new Set(items.map((item) => item.status))].join(","),
    minMs: Math.min(...times),
    p50Ms: percentile(times, 50),
    p95Ms: percentile(times, 95),
    maxMs: Math.max(...times),
    bytes: Math.max(...items.map((item) => item.bytes)),
    slow: Math.max(...times) >= slowMs,
    failures: failures.map((item) => ({ status: item.status, error: item.error, sample: item.sample }))
  };
}).sort((left, right) => right.maxMs - left.maxMs);

const report = {
  ok: summary.every((item) => item.ok),
  generatedAt: new Date().toISOString(),
  base,
  siteId,
  repeat,
  timeoutMs,
  slowMs,
  slowTargets: summary.filter((item) => item.slow),
  summary,
  samples
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
