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
  return requestedPath === "/policies/privacy" || requestedPath === "/policies/privacy-policy" || requestedPath === "/privacy-policy" ? "/privacy" :
    requestedPath === "/policies/terms" || requestedPath === "/policies/terms-of-service" || requestedPath === "/terms-of-service" ? "/terms" :
    requestedPath === "/policies/cookies" || requestedPath === "/policies/cookie-policy" || requestedPath === "/cookie-policy" ? "/cookies" :
    requestedPath === "/policies/refunds" || requestedPath === "/policies/refund" || requestedPath === "/refund-policy" ? "/refunds" :
    requestedPath === "/policies/content" || requestedPath === "/content-policy" ? "/content" :
    requestedPath === "/policies/shipping" || requestedPath === "/policies/delivery" || requestedPath === "/policies/delivery-policy" || requestedPath === "/shipping-policy" || requestedPath === "/delivery-policy" ? "/shipping" :
    requestedPath === "/policies/children-privacy" || requestedPath === "/policies/children" || requestedPath === "/policies/children-privacy-policy" || requestedPath === "/policies/childrens-privacy" || requestedPath === "/children-privacy-policy" || requestedPath === "/childrens-privacy" ? "/children-privacy" :
    requestedPath === "/policies/state-privacy" || requestedPath === "/policies/state-privacy-rights" || requestedPath === "/policies/california-privacy" || requestedPath === "/policies/ccpa" || requestedPath === "/state-privacy-rights" || requestedPath === "/california-privacy" || requestedPath === "/ccpa" ? "/state-privacy" :
    requestedPath;
}

export function policyPageSlug(pathname: string): string {
  const requestedPath = !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
  return requestedPath === "/privacy" || requestedPath === "/privacy-policy" || requestedPath === "/policies/privacy-policy" ? "/policies/privacy" :
    requestedPath === "/terms" || requestedPath === "/terms-of-service" || requestedPath === "/policies/terms-of-service" ? "/policies/terms" :
    requestedPath === "/cookies" || requestedPath === "/cookie-policy" || requestedPath === "/policies/cookie-policy" ? "/policies/cookies" :
    requestedPath === "/refunds" || requestedPath === "/refund-policy" || requestedPath === "/policies/refund" ? "/policies/refunds" :
    requestedPath === "/content" || requestedPath === "/content-policy" ? "/policies/content" :
    requestedPath === "/shipping" || requestedPath === "/shipping-policy" || requestedPath === "/delivery-policy" || requestedPath === "/policies/delivery" || requestedPath === "/policies/delivery-policy" ? "/policies/shipping" :
    requestedPath === "/children-privacy" || requestedPath === "/children-privacy-policy" || requestedPath === "/childrens-privacy" || requestedPath === "/policies/children" || requestedPath === "/policies/children-privacy-policy" || requestedPath === "/policies/childrens-privacy" ? "/policies/children-privacy" :
    requestedPath === "/state-privacy" || requestedPath === "/state-privacy-rights" || requestedPath === "/california-privacy" || requestedPath === "/ccpa" || requestedPath === "/policies/state-privacy-rights" || requestedPath === "/policies/california-privacy" || requestedPath === "/policies/ccpa" ? "/policies/state-privacy" :
    requestedPath;
}

export function publicContentPageSlug(pathname: string): string {
  const requestedPath = !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (requestedPath === "/faq" || requestedPath === "/help") return "/faq";
  if (requestedPath === "/how-it-works") return "/workflow";
  return policyPageSlug(requestedPath);
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
    const pairedStorePath = /mydreamshoots|dreamshoot|aidreamcapes/i.test(publicSlug)
      ? normalizedPath === "/help"
        ? "/faq"
        : normalizedPath === "/how-it-works" || normalizedPath === "/#workflow"
          ? "/workflow"
          : normalizedPath === "/#faq"
            ? "/faq"
            : normalizedPath
      : normalizedPath;
    permanentRedirect(pairedStorePath);
  }
  return publicSlug;
}
