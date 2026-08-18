import { permanentRedirect, redirect } from "next/navigation";
import { canonicalSiteSlug, cleanHost, isPlatformHost, publicSiteSlug } from "@/lib/domain-routing";
import { usesAiGenerationPublicSlug } from "@/lib/storefront-context/capabilities";

function isCanonicalPublicHost(host: string | null | undefined): boolean {
  const value = cleanHost(host);
  return Boolean(value && !isPlatformHost(value) && value !== "localhost" && value !== "127.0.0.1" && !value.endsWith(".localhost"));
}

function normalizedPathname(pathname: string): string {
  return !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
}

const POLICY_PUBLIC_TO_INTERNAL = new Map<string, string>([
  ["/privacy", "/policies/privacy"], ["/privacy-policy", "/policies/privacy"], ["/policies/privacy", "/policies/privacy"], ["/policies/privacy-policy", "/policies/privacy"],
  ["/terms", "/policies/terms"], ["/terms-of-service", "/policies/terms"], ["/policies/terms", "/policies/terms"], ["/policies/terms-of-service", "/policies/terms"],
  ["/cookies", "/policies/cookies"], ["/cookie-policy", "/policies/cookies"], ["/policies/cookies", "/policies/cookies"], ["/policies/cookie-policy", "/policies/cookies"],
  ["/refunds", "/policies/refunds"], ["/refund-policy", "/policies/refunds"], ["/policies/refunds", "/policies/refunds"], ["/policies/refund", "/policies/refunds"],
  ["/content", "/policies/content"], ["/content-policy", "/policies/content"], ["/policies/content", "/policies/content"],
  ["/shipping", "/policies/shipping"], ["/shipping-policy", "/policies/shipping"], ["/delivery-policy", "/policies/shipping"], ["/policies/shipping", "/policies/shipping"], ["/policies/delivery", "/policies/shipping"], ["/policies/delivery-policy", "/policies/shipping"],
  ["/children-privacy", "/policies/children-privacy"], ["/children-privacy-policy", "/policies/children-privacy"], ["/childrens-privacy", "/policies/children-privacy"], ["/policies/children-privacy", "/policies/children-privacy"], ["/policies/children", "/policies/children-privacy"], ["/policies/children-privacy-policy", "/policies/children-privacy"], ["/policies/childrens-privacy", "/policies/children-privacy"],
  ["/state-privacy", "/policies/state-privacy"], ["/state-privacy-rights", "/policies/state-privacy"], ["/california-privacy", "/policies/state-privacy"], ["/ccpa", "/policies/state-privacy"], ["/policies/state-privacy", "/policies/state-privacy"], ["/policies/state-privacy-rights", "/policies/state-privacy"], ["/policies/california-privacy", "/policies/state-privacy"], ["/policies/ccpa", "/policies/state-privacy"]
]);

const POLICY_INTERNAL_TO_PUBLIC = new Map<string, string>([
  ["/policies/privacy", "/privacy"], ["/policies/privacy-policy", "/privacy"], ["/privacy", "/privacy"], ["/privacy-policy", "/privacy"],
  ["/policies/terms", "/terms"], ["/policies/terms-of-service", "/terms"], ["/terms", "/terms"], ["/terms-of-service", "/terms"],
  ["/policies/cookies", "/cookies"], ["/policies/cookie-policy", "/cookies"], ["/cookies", "/cookies"], ["/cookie-policy", "/cookies"],
  ["/policies/refunds", "/refunds"], ["/policies/refund", "/refunds"], ["/refunds", "/refunds"], ["/refund-policy", "/refunds"],
  ["/policies/content", "/content"], ["/content", "/content"], ["/content-policy", "/content"],
  ["/policies/shipping", "/shipping"], ["/policies/delivery", "/shipping"], ["/policies/delivery-policy", "/shipping"], ["/shipping", "/shipping"], ["/shipping-policy", "/shipping"], ["/delivery-policy", "/shipping"],
  ["/policies/children-privacy", "/children-privacy"], ["/policies/children", "/children-privacy"], ["/policies/children-privacy-policy", "/children-privacy"], ["/policies/childrens-privacy", "/children-privacy"], ["/children-privacy", "/children-privacy"], ["/children-privacy-policy", "/children-privacy"], ["/childrens-privacy", "/children-privacy"],
  ["/policies/state-privacy", "/state-privacy"], ["/policies/state-privacy-rights", "/state-privacy"], ["/policies/california-privacy", "/state-privacy"], ["/policies/ccpa", "/state-privacy"], ["/state-privacy", "/state-privacy"], ["/state-privacy-rights", "/state-privacy"], ["/california-privacy", "/state-privacy"], ["/ccpa", "/state-privacy"]
]);

/** Public policy URLs are the only URLs exposed to search engines and users. */
export function publicPolicyPathToInternalPath(pathname: string): string {
  const requestedPath = normalizedPathname(pathname);
  return POLICY_PUBLIC_TO_INTERNAL.get(requestedPath) ?? requestedPath;
}

/** Internal policy routes are implementation paths and must map back to public URLs. */
export function internalPolicyPathToPublicPath(pathname: string): string {
  const requestedPath = normalizedPathname(pathname);
  return POLICY_INTERNAL_TO_PUBLIC.get(requestedPath) ?? requestedPath;
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
  return internalPolicyPathToPublicPath(pathname);
}

export function policyPageSlug(pathname: string): string {
  return publicPolicyPathToInternalPath(pathname);
}

export function publicContentPageSlug(pathname: string): string {
  const requestedPath = !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (requestedPath === "/faq" || requestedPath === "/help") return "/faq";
  if (requestedPath === "/how-it-works") return "/workflow";
  return policyPageSlug(requestedPath);
}

const LEGACY_PUBLIC_PATH_REDIRECTS: Record<string, string> = {
  "/help": "/faq",
  "/how-it-works": "/workflow",
  "/about": "/about-us",
  "/contact": "/contact-us",
  "/privacy-policy": "/privacy",
  "/policies/privacy": "/privacy",
  "/policies/privacy-policy": "/privacy",
  "/terms-of-service": "/terms",
  "/policies/terms": "/terms",
  "/policies/terms-of-service": "/terms",
  "/cookie-policy": "/cookies",
  "/policies/cookies": "/cookies",
  "/policies/cookie-policy": "/cookies",
  "/refund-policy": "/refunds",
  "/policies/refund": "/refunds",
  "/policies/refunds": "/refunds",
  "/content-policy": "/content",
  "/policies/content": "/content",
  "/shipping-policy": "/shipping",
  "/delivery-policy": "/shipping",
  "/policies/shipping": "/shipping",
  "/policies/delivery": "/shipping",
  "/policies/delivery-policy": "/shipping",
  "/children-privacy-policy": "/children-privacy",
  "/childrens-privacy": "/children-privacy",
  "/policies/children-privacy": "/children-privacy",
  "/policies/children": "/children-privacy",
  "/policies/children-privacy-policy": "/children-privacy",
  "/policies/childrens-privacy": "/children-privacy",
  "/state-privacy-rights": "/state-privacy",
  "/california-privacy": "/state-privacy",
  "/ccpa": "/state-privacy",
  "/policies/state-privacy": "/state-privacy",
  "/policies/state-privacy-rights": "/state-privacy",
  "/policies/california-privacy": "/state-privacy",
  "/policies/ccpa": "/state-privacy"
};

export function legacyPublicPathTarget(pathname: string, fallbackCollectionPath = "/collections"): string | undefined {
  const normalized = normalizedPathname(pathname);
  if (normalized === "/examples" || normalized === "/packages") return fallbackCollectionPath;
  return LEGACY_PUBLIC_PATH_REDIRECTS[normalized];
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
    const pairedStorePath = usesAiGenerationPublicSlug(publicSlug)
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
