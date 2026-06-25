import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CustomerWorkspaceShell } from "@/components/storefront/customer-workspace-shell";
import { getCustomerBySessionRelational } from "@/lib/stores/customer-store";
import { getCustomerWorkspaceBootstrapRelational } from "@/lib/stores/site-store";
import { publicSiteSlug } from "@/lib/domain-routing";
import { customerSessionCookie } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Workspace" };
}

export default async function CustomerWorkspacePage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const publicSlug = publicSiteSlug(siteSlug);
  const bootstrap = await getCustomerWorkspaceBootstrapRelational(siteSlug);
  if (!bootstrap) notFound();

  const sessionId = (await cookies()).get(customerSessionCookie(bootstrap.site.id))?.value;
  if (!sessionId) redirect(`/site/${publicSlug}/login`);
  const current = await getCustomerBySessionRelational({ siteId: bootstrap.site.id, sessionId });
  if (!current) redirect(`/site/${publicSlug}/login`);

  const query = searchParams ? await searchParams : {};
  return (
    <CustomerWorkspaceShell
      assets={[]}
      creativePacks={bootstrap.creativePacks}
      customer={current.customer}
      initialCreativePackId={typeof query.pack === "string" ? query.pack : undefined}
      site={bootstrap.site}
      siteAiApps={bootstrap.siteAiApps}
    />
  );
}
