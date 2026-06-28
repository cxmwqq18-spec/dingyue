import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { redirectMismatchedSiteAdminSlugForHost } from "@/lib/domain-routing";

export default async function SiteAdminLayout({
  children,
  params
}: {
  children: ReactNode;
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const pathname = headerStore.get("x-invoke-path") ?? "/admin";
  const hostRedirect = redirectMismatchedSiteAdminSlugForHost(
    headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    siteSlug,
    pathname.startsWith(`/site/${siteSlug}/`) ? pathname.slice(`/site/${siteSlug}`.length) : "/admin"
  );
  if (hostRedirect) redirect(hostRedirect);
  return children;
}
