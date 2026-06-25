import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { readStorefrontPublicRuntimeStateBySlugFromDatabase } from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { customerSessionCookie } from "@/lib/session";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Sign in" };
}

export default async function SiteLoginPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { siteSlug } = await params;
  redirectLegacySiteSlug(siteSlug, "/login");
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/login");
  const site = state?.sites[0];
  if (!state || !site) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  const relationalCustomer = sessionId ? await getCustomerBySessionRelational({ siteId: site.id, sessionId }) : undefined;
  if (relationalCustomer) {
    redirect(`/site/${publicSiteSlug(site.slug)}/app`);
  }
  return renderStorefrontPage({ site, slug: "/login", query: await searchParams, routeMode: "path", state });
}
