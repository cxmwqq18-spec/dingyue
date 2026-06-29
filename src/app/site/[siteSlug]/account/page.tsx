import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CustomerAccountClientPage } from "@/components/storefront/customer-bootstrap-client";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { getCustomerWorkspaceSiteShellRelational, getSiteIdBySlugRelational } from "@/lib/stores/site-store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Account", robots: { index: false, follow: false } };
}

export default async function CustomerAccountPage({
  params
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/account",
    siteSlug
  });
  const siteId = await getSiteIdBySlugRelational(publicSlug);
  if (!siteId) redirect(`/site/${publicSiteSlug(publicSlug)}/login`);
  const [current, site] = await Promise.all([
    getCurrentCustomerForSite(siteId),
    getCustomerWorkspaceSiteShellRelational(publicSlug)
  ]);
  if (!current || !site) redirect(`/site/${publicSiteSlug(publicSlug)}/login`);
  return <CustomerAccountClientPage initialCustomer={current.customer} initialSite={site} siteSlug={publicSiteSlug(publicSlug)} />;
}
