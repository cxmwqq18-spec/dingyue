"use client";

type CachedJsonResponse<T> = {
  data: T;
  ok: boolean;
  status: number;
};

type FetchAdminJsonOptions = {
  init?: RequestInit;
  ttlMs?: number;
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
  const { init, ttlMs = defaultTtlMs } = options;
  const method = (init?.method ?? "GET").toUpperCase();
  const key = cacheKey(url, init);

  if (method === "GET" && key) {
    const cached = jsonCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.response as CachedJsonResponse<T>;
    }

    const inflight = inflightJsonRequests.get(key);
    if (inflight) {
      return inflight as Promise<CachedJsonResponse<T>>;
    }
  }

  const requestInit =
    method === "GET" && key
      ? (() => {
          const { signal: _signal, ...cacheableInit } = init ?? {};
          return cacheableInit;
        })()
      : init;

  const request = fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...requestInit,
    method
  }).then((response) => readJsonResponse<T>(response));

  if (method !== "GET") {
    const response = await request;
    if (response.ok) invalidateAdminJson(siteAdminCachePrefixFromUrl(url));
    return response;
  }

  if (!key) return request;

  inflightJsonRequests.set(key, request as Promise<CachedJsonResponse<unknown>>);
  try {
    const response = await request;
    jsonCache.set(key, {
      expiresAt: Date.now() + ttlMs,
      response: response as CachedJsonResponse<unknown>
    });
    return response;
  } finally {
    inflightJsonRequests.delete(key);
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
