import { permanentRedirect, redirect } from "next/navigation";
import { cleanHost, isPlatformHost, publicSiteSlug } from "@/lib/domain-routing";

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
    const normalizedPath = !pathname || pathname === "/" ? "/" : pathname.startsWith("/") ? pathname : `/${pathname}`;
    permanentRedirect(normalizedPath);
  }
  return publicSlug;
}
