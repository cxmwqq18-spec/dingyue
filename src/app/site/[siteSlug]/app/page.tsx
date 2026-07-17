import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import { storefrontPathForRouteMode, storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  return { title: isSpanishStorefrontRequestIdentity(siteSlug) ? "Espacio privado" : "Workspace", robots: { index: false, follow: false } };
}

export default async function CustomerWorkspacePage({
  params
}: {
  params: Promise<{ siteSlug: string }>;
}) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, siteSlug);
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/app",
    siteSlug
  });
  redirect(storefrontPathForRouteMode(publicSlug, "/app/create", routeMode));
}
