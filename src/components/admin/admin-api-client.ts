"use client";

export type CachedJsonResponse<T> = {
  data: T;
  ok: boolean;
  status: number;
};

type FetchAdminJsonOptions = {
  init?: RequestInit;
  ttlMs?: number;
  timeoutMs?: number;
};

const defaultTtlMs = 15_000;
const jsonCache = new Map<string, { expiresAt: number; response: CachedJsonResponse<unknown> }>();
const inflightJsonRequests = new Map<string, Promise<CachedJsonResponse<unknown>>>();

function cacheKey(url: string, init?: RequestInit) {
  return `${(init?.method ?? "GET").toUpperCase()} ${url}`;
}

function siteAdminCachePrefixFromUrl(url: string) {
  const match = url.match(/\/api\/sites\/([^/]+)\//);
  return match?.[1] ? `/api/sites/${match[1]}/` : undefined;
}

async function readJsonResponse<T>(response: Response): Promise<CachedJsonResponse<T>> {
  const data = (await response.json().catch(() => ({}))) as T;
  return {
    data,
    ok: response.ok,
    status: response.status
  };
}

export async function fetchAdminJson<T>(url: string, options: FetchAdminJsonOptions = {}): Promise<CachedJsonResponse<T>> {
  const { init, ttlMs = defaultTtlMs, timeoutMs = 12_000 } = options;
  const method = (init?.method ?? "GET").toUpperCase();
  const key = cacheKey(url, init);
  const isGet = method === "GET";
  const upstreamSignal = init?.signal;
  const hasAbortSignal = Boolean(upstreamSignal);

  if (isGet && key) {
    const cached = jsonCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.response as CachedJsonResponse<T>;
    }

    const inflight = hasAbortSignal ? undefined : inflightJsonRequests.get(key);
    if (inflight) {
      return inflight as Promise<CachedJsonResponse<T>>;
    }
  }

  const timeoutController = typeof AbortController === "undefined" ? null : new AbortController();
  const timeoutId = timeoutController && timeoutMs > 0
    ? window.setTimeout(() => timeoutController.abort(), timeoutMs)
    : undefined;
  const signal = timeoutController
    ? mergeAbortSignals([upstreamSignal, timeoutController.signal].filter(Boolean) as AbortSignal[])
    : upstreamSignal;

  const request = fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    method,
    signal
  }).then((response) => readJsonResponse<T>(response)).finally(() => {
    if (timeoutId) window.clearTimeout(timeoutId);
  });

  if (!isGet) {
    const response = await request;
    if (response.ok) invalidateAdminJson(siteAdminCachePrefixFromUrl(url));
    return response;
  }

  if (!key) return request;

  if (!hasAbortSignal) {
    inflightJsonRequests.set(key, request as Promise<CachedJsonResponse<unknown>>);
  }
  try {
    const response = await request;
    if (response.ok && ttlMs > 0) {
      jsonCache.set(key, {
        expiresAt: Date.now() + ttlMs,
        response: response as CachedJsonResponse<unknown>
      });
    } else {
      jsonCache.delete(key);
    }
    return response;
  } finally {
    if (!hasAbortSignal) inflightJsonRequests.delete(key);
  }
}

export function invalidateAdminJson(prefix?: string) {
  if (!prefix) {
    jsonCache.clear();
    inflightJsonRequests.clear();
    return;
  }

  for (const key of jsonCache.keys()) {
    if (key.includes(prefix)) jsonCache.delete(key);
  }
  for (const key of inflightJsonRequests.keys()) {
    if (key.includes(prefix)) inflightJsonRequests.delete(key);
  }
}

function mergeAbortSignals(signals: AbortSignal[]): AbortSignal | undefined {
  if (!signals.length) return undefined;
  if (signals.length === 1) return signals[0];
  const controller = new AbortController();
  const abort = () => controller.abort();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}
