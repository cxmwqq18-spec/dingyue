export type AdminRoutePrefetchMatcher = string | RegExp | ((href: string) => boolean);

export type AdminRoutePrefetchPolicy = {
  allow?: AdminRoutePrefetchMatcher[];
  deny?: AdminRoutePrefetchMatcher[];
};

const heavyRouteMatchers: AdminRoutePrefetchMatcher[] = [
  /\/admin\/themes?(?:\/|$|\?)/,
  /\/admin\/media(?:\/|$|\?)/,
  /\/admin\/design\/publications(?:\/|$|\?)/,
  /\/admin\/publications?(?:\/|$|\?)/,
  /\/admin\/publish-history(?:\/|$|\?)/,
  /\/admin\/(?:[^?#/]+\/)*workbench(?:\/|$|\?)/,
  /[?&](?:tab|view|panel)=(?:themes?|media|publish-history|workbench)(?:&|$)/
];

export const adminRoutePrefetchDenyList = heavyRouteMatchers;

export function canPrefetchAdminRoute(href: string, policy: AdminRoutePrefetchPolicy = {}): boolean {
  if (!href || href.startsWith("#")) return false;
  if (matchesAny(href, [...heavyRouteMatchers, ...(policy.deny ?? [])])) return false;
  if (policy.allow?.length) return matchesAny(href, policy.allow);
  return true;
}

export function canBulkPrefetchAdminRoute(href: string, policy: AdminRoutePrefetchPolicy = {}): boolean {
  if (!policy.allow?.length) return false;
  return canPrefetchAdminRoute(href, policy);
}

function matchesAny(href: string, matchers: AdminRoutePrefetchMatcher[]) {
  return matchers.some((matcher) => {
    if (typeof matcher === "string") return href.includes(matcher);
    if (matcher instanceof RegExp) return matcher.test(href);
    return matcher(href);
  });
}
