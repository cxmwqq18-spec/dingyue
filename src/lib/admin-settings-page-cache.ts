import "server-only";

import { createServerTtlCache } from "@/lib/server-ttl-cache";

export const settingsPageCache = createServerTtlCache(
  "site-admin-settings-page",
  Number(process.env.SITE_ADMIN_SETTINGS_PAGE_CACHE_TTL_MS ?? 15_000)
);

export function invalidateAdminSettingsPageCache(siteId: string): void {
  settingsPageCache.clear(`${siteId}:core`);
  settingsPageCache.clear(`${siteId}:audit`);
  settingsPageCache.clear(`${siteId}:domains`);
  settingsPageCache.clear(`${siteId}:admins`);
  settingsPageCache.clear(`${siteId}:gateway`);
}
