import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CustomerAccountShell } from "@/components/storefront/customer-account-shell";
import { publicSiteSlug } from "@/lib/domain-routing";
import { customerSessionCookie } from "@/lib/session";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getCustomerWorkspaceBootstrapRelational } from "@/lib/stores/site-store";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Account" };
}

export default async function CustomerAccountPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const publicSlug = publicSiteSlug(siteSlug);
  const bootstrap = await getCustomerWorkspaceBootstrapRelational(siteSlug);
  if (!bootstrap) notFound();

  const sessionId = (await cookies()).get(customerSessionCookie(bootstrap.site.id))?.value;
  if (!sessionId) redirect(`/site/${publicSlug}/login`);
  const current = await getCustomerBySessionRelational({ siteId: bootstrap.site.id, sessionId });
  if (!current) redirect(`/site/${publicSlug}/login`);

  return <CustomerAccountShell customer={current.customer} site={bootstrap.site} />;
}
