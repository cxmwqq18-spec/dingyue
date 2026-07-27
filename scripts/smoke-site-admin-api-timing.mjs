const base = process.env.SITE_ADMIN_BASE_URL ?? process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3210";
const siteId = process.env.SITE_ADMIN_SITE_ID ?? "site_dreamshoot";
const username = process.env.SITE_ADMIN_USER ?? "owner@mydreamshoots.localhost";
const password = process.env.SITE_ADMIN_PASSWORD ?? "mydreamshoots123";
const timeoutMs = Number(process.env.SITE_ADMIN_API_TIMEOUT_MS ?? 12_000);
const loginTimeoutMs = Number(process.env.SITE_ADMIN_LOGIN_TIMEOUT_MS ?? timeoutMs);
const slowMs = Number(process.env.SITE_ADMIN_API_SLOW_MS ?? 1_500);
const repeat = Math.max(1, Math.floor(Number(process.env.SITE_ADMIN_API_REPEAT ?? 2)));

const targets = [
  { name: "orders overview", path: `/api/sites/${siteId}/admin/orders-page?tab=overview` },
  { name: "customers", path: `/api/sites/${siteId}/admin/customers-page` },
  { name: "products", path: `/api/sites/${siteId}/admin/products-page` },
  { name: "ai summary", path: `/api/sites/${siteId}/admin/ai-page?detail=summary` },
  { name: "content summary", path: `/api/sites/${siteId}/admin/content-page` },
  { name: "settings", path: `/api/sites/${siteId}/admin/settings-page` },
  { name: "publish preflight", path: `/api/sites/${siteId}/admin/publish-preflight` }
];

const sectionGroups = [
  {
    name: "orders tabs",
    first: "overview",
    sections: [
      { section: "overview", path: `/api/sites/${siteId}/admin/orders-page?tab=overview` },
      { section: "orders", path: `/api/sites/${siteId}/admin/orders-page?tab=orders&take=30` },
      { section: "subscriptions", path: `/api/sites/${siteId}/admin/orders-page?tab=subscriptions&take=30` },
      { section: "ledger", path: `/api/sites/${siteId}/admin/orders-page?tab=ledger&take=30` },
      { section: "events", path: `/api/sites/${siteId}/admin/orders-page?tab=events&take=30` }
    ]
  },
  {
    name: "customers sections",
    first: "customers",
    sections: [
      { section: "customers", path: `/api/sites/${siteId}/admin/customers-page?detail=customers` },
      { section: "models", path: `/api/sites/${siteId}/admin/customers-page?detail=models` },
      { section: "delivery", path: `/api/sites/${siteId}/admin/customers-page?detail=delivery` },
      { section: "assets", path: `/api/sites/${siteId}/admin/customers-page?detail=assets` }
    ]
  },
  {
    name: "ai sections",
    first: "summary",
    sections: [
      { section: "summary", path: `/api/sites/${siteId}/admin/ai-page?detail=summary` },
      { section: "jobs", path: `/api/sites/${siteId}/admin/ai-page?detail=jobs&take=30` }
    ]
  },
  {
    name: "content sections",
    first: "summary",
    sections: [
      { section: "summary", path: `/api/sites/${siteId}/admin/content-page` },
      { section: "editor", path: `/api/sites/${siteId}/admin/content-page?section=editor` }
    ]
  }
];

function cookieFrom(response, name) {
  const raw = response.headers.get("set-cookie") ?? "";
  const match = raw.match(new RegExp(`(?:^|,\\s*)(${name}=[^;]+)`));
  if (!match?.[1]) throw new Error(`missing ${name} cookie`);
  return match[1];
}

async function loginSiteAdmin() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), loginTimeoutMs);
  const started = performance.now();
  let response;
  try {
    response = await fetch(`${base}/api/sites/${siteId}/admin/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: username, password }),
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    return {
      ok: false,
      status: 0,
      ms: Math.round(performance.now() - started),
      error: error?.name || "fetch_failed",
      sample: String(error?.message ?? error).slice(0, 300)
    };
  } finally {
    clearTimeout(timeout);
  }
  const ms = Math.round(performance.now() - started);
  const serverTiming = response.headers.get("server-timing") || undefined;
  if (!response.ok) {
    const sample = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      ms,
      serverTiming,
      sample: sample.slice(0, 300)
    };
  }
  const csrfName = `site_admin_csrf_${siteId}`;
  let cookie;
  try {
    cookie = [cookieFrom(response, `site_admin_session_${siteId}`), cookieFrom(response, csrfName)].join("; ");
  } catch (error) {
    return {
      ok: false,
      status: response.status,
      ms,
      serverTiming,
      error: error instanceof Error ? error.message : "missing_login_cookie"
    };
  }
  return {
    ok: true,
    status: response.status,
    ms,
    serverTiming,
    cookie
  };
}

async function timedGet(target, cookie, round, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(`${base}${target.path}`, {
      method: "GET",
      headers: {
        cookie,
        "x-smoke-site-admin-api": "true",
        ...extraHeaders
      },
      cache: "no-store",
      signal: controller.signal
    });
    const text = await response.text().catch(() => "");
    const serverTiming = response.headers.get("server-timing") || undefined;
    return {
      ok: response.ok,
      round,
      name: target.name,
      path: target.path,
      status: response.status,
      ms: Math.round(performance.now() - started),
      serverTiming,
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

async function timedSection(section, cookie, round, groupName) {
  return timedGet({
    name: `${groupName}:${section.section}`,
    path: section.path
  }, cookie, round, {
    "x-smoke-site-admin-section": section.section,
    "x-smoke-site-admin-section-group": groupName
  });
}

async function timedSectionGroup(group, cookie, round) {
  const started = performance.now();
  const firstSection = group.sections.find((section) => section.section === group.first) ?? group.sections[0];
  const firstSample = await timedSection(firstSection, cookie, round, group.name);
  const remainingSections = group.sections.filter((section) => section !== firstSection);
  const remainingSamples = await Promise.all(remainingSections.map((section) => timedSection(section, cookie, round, group.name)));
  const samples = [firstSample, ...remainingSamples];
  const allSectionsMs = Math.round(performance.now() - started);
  return {
    ok: samples.every((sample) => sample.ok),
    round,
    name: group.name,
    firstSection: firstSection.section,
    firstSectionMs: firstSample.ms,
    allSectionsMs,
    deltaMs: Math.max(0, allSectionsMs - firstSample.ms),
    statuses: [...new Set(samples.map((sample) => sample.status))].join(","),
    bytes: samples.reduce((sum, sample) => sum + sample.bytes, 0),
    sections: samples.map((sample) => ({
      section: sample.name.slice(`${group.name}:`.length),
      path: sample.path,
      ok: sample.ok,
      status: sample.status,
      ms: sample.ms,
      serverTiming: sample.serverTiming,
      bytes: sample.bytes,
      error: sample.error,
      sample: sample.sample
    }))
  };
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
}

const login = await loginSiteAdmin();
if (!login.ok) {
  console.log(JSON.stringify({
    ok: false,
    generatedAt: new Date().toISOString(),
    base,
    siteId,
    repeat,
    timeoutMs,
    loginTimeoutMs,
    slowMs,
    login
  }, null, 2));
  process.exit(1);
}
const cookie = login.cookie;
const samples = [];
const sectionSamples = [];
for (let round = 1; round <= repeat; round += 1) {
  for (const target of targets) {
    samples.push(await timedGet(target, cookie, round));
  }
  for (const group of sectionGroups) {
    sectionSamples.push(await timedSectionGroup(group, cookie, round));
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
    serverTiming: items.map((item) => item.serverTiming).filter(Boolean),
    slow: Math.max(...times) >= slowMs,
    failures: failures.map((item) => ({ status: item.status, error: item.error, sample: item.sample }))
  };
}).sort((left, right) => right.maxMs - left.maxMs);

const sectionSummary = sectionGroups.map((group) => {
  const items = sectionSamples.filter((sample) => sample.name === group.name);
  const firstTimes = items.map((item) => item.firstSectionMs);
  const allTimes = items.map((item) => item.allSectionsMs);
  const failures = items.filter((item) => !item.ok);
  return {
    name: group.name,
    firstSection: group.first,
    ok: failures.length === 0,
    minFirstSectionMs: Math.min(...firstTimes),
    p50FirstSectionMs: percentile(firstTimes, 50),
    p95FirstSectionMs: percentile(firstTimes, 95),
    maxFirstSectionMs: Math.max(...firstTimes),
    minAllSectionsMs: Math.min(...allTimes),
    p50AllSectionsMs: percentile(allTimes, 50),
    p95AllSectionsMs: percentile(allTimes, 95),
    maxAllSectionsMs: Math.max(...allTimes),
    maxDeltaMs: Math.max(...items.map((item) => item.deltaMs)),
    slow: Math.max(...allTimes) >= slowMs,
    failures: failures.flatMap((item) => item.sections.filter((section) => !section.ok))
  };
}).sort((left, right) => right.maxAllSectionsMs - left.maxAllSectionsMs);

const report = {
  ok: summary.every((item) => item.ok) && sectionSummary.every((item) => item.ok),
  generatedAt: new Date().toISOString(),
  base,
  siteId,
  repeat,
  timeoutMs,
  loginTimeoutMs,
  slowMs,
  login: { status: login.status, ms: login.ms, serverTiming: login.serverTiming },
  slowTargets: summary.filter((item) => item.slow),
  slowSectionGroups: sectionSummary.filter((item) => item.slow),
  summary,
  sectionSummary,
  samples,
  sectionSamples
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
