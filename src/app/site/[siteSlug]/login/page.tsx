import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { renderStorefrontLoginPage } from "@/lib/storefront-render";
import { readPathModePublicMetadataState } from "@/lib/storefront-local-state";
import { customerSessionCookie } from "@/lib/session";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { storefrontPathForRouteMode, storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readPathModePublicMetadataState(siteSlug, "/login");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/login");
  return site && page
    ? {
        ...metadataForPublishedStorefrontPage({ site, page, products: state?.products, creativePacks: state?.creativePacks }),
        robots: { index: false, follow: false }
      }
    : {};
}

export default async function SiteLoginPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ email?: string; error?: string; mode?: string; next?: string }>;
}) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, siteSlug);
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/login",
    siteSlug
  });
  const state = await readPathModePublicMetadataState(publicSlug, "/login");
  const site = state?.sites[0];
  if (!state || !site) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const relationalCustomer = sessionId ? await getCustomerBySessionRelational({ siteId: site.id, sessionId }) : undefined;
  const query = await searchParams;
  const basePath = storefrontPathForRouteMode(publicSiteSlug(site.slug), "/", routeMode).replace(/\/$/, "") || "/";
  const isSafeNextPath = typeof query?.next === "string" && (
    basePath === "/"
      ? query.next.startsWith("/") && !query.next.startsWith("//")
      : query.next === basePath || query.next.startsWith(`${basePath}/`)
  );
  const nextPath = isSafeNextPath ? query?.next ?? "" : "";
  if (relationalCustomer) {
    redirect(nextPath || storefrontPathForRouteMode(publicSiteSlug(site.slug), "/app/create", routeMode));
  }
  return renderStorefrontLoginPage({ site, query, routeMode });
}
