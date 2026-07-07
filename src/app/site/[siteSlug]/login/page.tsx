import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { renderStorefrontLoginPage } from "@/lib/storefront-render";
import { readPathModePublicMetadataState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { customerSessionCookie } from "@/lib/session";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { metadataForDreamshootFallbackRoute } from "@/lib/dreamshoot-seo-content";
import { metadataForSingleThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readPathModePublicMetadataState(siteSlug, "/login");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/login");
  return site && page
    ? metadataForSingleThemePage(site, page)
    : metadataForDreamshootFallbackRoute(publicSiteSlug(siteSlug), "/login", {
        primaryDomain: site?.primaryDomain,
        ogImage: site?.themeSettings.publishedJson.seo?.defaultOgImage,
        siteName: site?.branding.logoText || site?.name
      });
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
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/login",
    siteSlug
  });
  const state = await readPathModePublicRuntimeState(publicSlug, "/login");
  const site = state?.sites[0];
  if (!state || !site) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const relationalCustomer = sessionId ? await getCustomerBySessionRelational({ siteId: site.id, sessionId }) : undefined;
  const query = await searchParams;
  const basePath = `/site/${publicSiteSlug(site.slug)}`;
  const nextPath = typeof query?.next === "string" && (query.next === basePath || query.next.startsWith(`${basePath}/`)) ? query.next : "";
  if (relationalCustomer) {
    redirect(nextPath || `${basePath}/app`);
  }
  return renderStorefrontLoginPage({ site, query, routeMode: "path", state });
}
