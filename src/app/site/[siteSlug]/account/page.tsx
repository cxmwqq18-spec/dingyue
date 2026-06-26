import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CustomerAccountClientPage } from "@/components/storefront/customer-bootstrap-client";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { publicSiteSlug } from "@/lib/domain-routing";
import { getCustomerWorkspaceSiteShellRelational, getSiteIdBySlugRelational } from "@/lib/stores/site-store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Account" };
}

export default async function CustomerAccountPage({
  params
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const siteId = await getSiteIdBySlugRelational(siteSlug);
  if (!siteId) redirect(`/site/${publicSiteSlug(siteSlug)}/login`);
  const [current, site] = await Promise.all([
    getCurrentCustomerForSite(siteId),
    getCustomerWorkspaceSiteShellRelational(siteSlug)
  ]);
  if (!current || !site) redirect(`/site/${publicSiteSlug(siteSlug)}/login`);
  return <CustomerAccountClientPage initialCustomer={current.customer} initialSite={site} siteSlug={publicSiteSlug(siteSlug)} />;
}
