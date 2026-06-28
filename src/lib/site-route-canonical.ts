import { permanentRedirect, redirect } from "next/navigation";
import { canonicalSiteSlug, cleanHost, isPlatformHost, publicSiteSlug } from "@/lib/domain-routing";

function isCanonicalPublicHost(host: string | null | undefined): boolean {
  const value = cleanHost(host);
  return Boolean(value && !isPlatformHost(value) && value !== "localhost" && value !== "127.0.0.1" && !value.endsWith(".localhost"));
}

export function redirectLegacySiteSlug(siteSlug: string, pathname = ""): string {
  const publicSlug = publicSiteSlug(siteSlug);
  if (publicSlug !== siteSlug) {
    const normalizedPath = !pathname || pathname === "/" ? "" : pathname.startsWith("/") ? pathname : `/${pathname}`;
    redirect(`/site/${publicSlug}${normalizedPath}`);
  }
  return publicSlug;
}

export function shortPolicyPath(pathname: string): string {
  const requestedPath = !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
  return requestedPath === "/policies/privacy" || requestedPath === "/privacy-policy" ? "/privacy" :
    requestedPath === "/policies/terms" || requestedPath === "/terms-of-service" ? "/terms" :
    requestedPath === "/policies/cookies" || requestedPath === "/cookie-policy" ? "/cookies" :
    requestedPath === "/policies/refunds" || requestedPath === "/policies/refund" || requestedPath === "/refund-policy" ? "/refunds" :
    requestedPath === "/policies/content" || requestedPath === "/content-policy" ? "/content" :
    requestedPath === "/policies/shipping" || requestedPath === "/shipping-policy" || requestedPath === "/delivery-policy" ? "/shipping" :
    requestedPath;
}

export function policyPageSlug(pathname: string): string {
  const requestedPath = !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
  return requestedPath === "/privacy" || requestedPath === "/privacy-policy" ? "/policies/privacy" :
    requestedPath === "/terms" || requestedPath === "/terms-of-service" ? "/policies/terms" :
    requestedPath === "/cookies" || requestedPath === "/cookie-policy" ? "/policies/cookies" :
    requestedPath === "/refunds" || requestedPath === "/refund-policy" || requestedPath === "/policies/refund" ? "/policies/refunds" :
    requestedPath === "/content" || requestedPath === "/content-policy" ? "/policies/content" :
    requestedPath === "/shipping" || requestedPath === "/shipping-policy" || requestedPath === "/delivery-policy" ? "/policies/shipping" :
    requestedPath;
}

export function redirectPublicSitePathToCanonicalHost({
  host,
  pathname,
  siteSlug
}: {
  host: string | null | undefined;
  pathname?: string;
  siteSlug: string;
}): string {
  const publicSlug = redirectLegacySiteSlug(siteSlug, pathname);
  if (isCanonicalPublicHost(host)) {
    const requestedPath = !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
    const normalizedSiteSlug = canonicalSiteSlug(publicSlug);
    const sitePrefix = `/site/${publicSlug}`;
    const canonicalSitePrefix = `/site/${normalizedSiteSlug}`;
    if (requestedPath === sitePrefix || requestedPath === `${sitePrefix}/` || requestedPath === canonicalSitePrefix || requestedPath === `${canonicalSitePrefix}/`) {
      permanentRedirect("/");
    }
    const normalizedPath = shortPolicyPath(requestedPath);
    permanentRedirect(normalizedPath);
  }
  return publicSlug;
}
