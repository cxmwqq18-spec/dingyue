import "server-only";

import { createServerTtlCache } from "@/lib/server-ttl-cache";

export const customerRuntimeApiCache = createServerTtlCache(
  "customer-runtime-api",
  Number(process.env.STOREFRONT_CUSTOMER_RUNTIME_API_TTL_MS ?? 30_000)
);

export const customerRuntimeSessionCache = createServerTtlCache(
  "customer-runtime-session",
  Number(process.env.STOREFRONT_CUSTOMER_RUNTIME_SESSION_TTL_MS ?? 30_000)
);

export function customerRuntimeApiCacheKey(params: {
  list?: string;
  page?: number;
  pageSize?: number;
  profile: string;
  refreshToken: string;
  section: string;
  sessionId: string;
  siteId: string;
}): string {
  return [
    params.siteId,
    params.sessionId,
    params.profile,
    params.section,
    params.list ?? "",
    params.page ?? "",
    params.pageSize ?? "",
    params.refreshToken
  ].join(":");
}

export function customerRuntimeSessionCacheKey(params: {
  sessionId: string;
  siteId: string;
}): string {
  return `${params.siteId}:${params.sessionId}`;
}

export function clearCustomerRuntimeApiCacheForSessions(siteId: string, sessionIds: string[]): void {
  for (const sessionId of new Set(sessionIds.filter(Boolean))) {
    customerRuntimeApiCache.clearPrefix(`${siteId}:${sessionId}:`);
    customerRuntimeSessionCache.clear(customerRuntimeSessionCacheKey({ siteId, sessionId }));
  }
}
