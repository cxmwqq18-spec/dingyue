import "server-only";

import { createServerTtlCache } from "@/lib/server-ttl-cache";

export const customersPageCache = createServerTtlCache(
  "site-admin-customers-page",
  Number(process.env.SITE_ADMIN_CUSTOMERS_PAGE_CACHE_TTL_MS ?? 15_000)
);

export function invalidateAdminCustomersPageCache(siteId: string): void {
  customersPageCache.clear(`${siteId}:customers`);
  customersPageCache.clear(`${siteId}:all`);
}
