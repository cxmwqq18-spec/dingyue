const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3010";
const host = process.env.SMOKE_HOST || "";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 15000);
const slowMs = Number(process.env.SMOKE_SLOW_MS || 1000);
const repeat = Number(process.env.SMOKE_REPEAT || 1);

const defaultEndpoints = [
  ["GET", "/"],
  ["GET", "/platform"],
  ["GET", "/platform/login"],
  ["GET", "/api/platform/state"],
  ["GET", "/api/platform/sites"],
  ["GET", "/api/platform/cloudflare"],
  ["GET", "/api/platform/email"],
  ["GET", "/site/dreamshoot"],
  ["GET", "/site/dreamshoot/admin/login"],
  ["GET", "/site/dreamshoot/pricing"]
];

function parseEndpoint(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return ["GET", parts[0]];
  return [parts[0].toUpperCase(), parts[1]];
}

const endpoints = (process.env.SMOKE_ENDPOINTS || "")
  .split(",")
  .map(parseEndpoint)
  .filter(Boolean);

const targets = endpoints.length ? endpoints : defaultEndpoints;

async function timeRequest(method, pathname, index) {
  const url = new URL(pathname, base).toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        ...(host ? { host } : {}),
        "x-smoke-latency": "true"
      }
    });
    const body = await response.text().catch(() => "");
    return {
      ok: true,
      index,
      method,
      path: pathname,
      status: response.status,
      ms: Math.round(performance.now() - started),
      bytes: body.length,
      location: response.headers.get("location") || "",
      server: response.headers.get("server") || "",
      cfRay: response.headers.get("cf-ray") || ""
    };
  } catch (error) {
    return {
      ok: false,
      index,
      method,
      path: pathname,
      status: 0,
      ms: Math.round(performance.now() - started),
      error: error?.cause?.code || error?.code || error?.name || "fetch_failed",
      message: String(error?.message ?? error)
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

const results = [];
for (let round = 1; round <= repeat; round += 1) {
  for (const [method, pathname] of targets) {
    results.push(await timeRequest(method, pathname, round));
  }
}

const grouped = new Map();
for (const result of results) {
  const key = `${result.method} ${result.path}`;
  const current = grouped.get(key) || [];
  current.push(result);
  grouped.set(key, current);
}

const summary = [...grouped.entries()].map(([key, items]) => {
  const times = items.map((item) => item.ms);
  const failures = items.filter((item) => !item.ok);
  const statuses = [...new Set(items.map((item) => item.status))].join(",");
  return {
    target: key,
    ok: failures.length === 0,
    statuses,
    minMs: Math.min(...times),
    p50Ms: percentile(times, 50),
    p95Ms: percentile(times, 95),
    maxMs: Math.max(...times),
    slow: Math.max(...times) >= slowMs,
    failures: failures.map((item) => ({ error: item.error, message: item.message }))
  };
}).sort((a, b) => b.maxMs - a.maxMs);

const report = {
  ok: summary.every((item) => item.ok),
  generatedAt: new Date().toISOString(),
  base,
  host: host || undefined,
  repeat,
  timeoutMs,
  slowMs,
  slowTargets: summary.filter((item) => item.slow),
  summary,
  samples: results
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) process.exit(1);
