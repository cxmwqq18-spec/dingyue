import type { Metadata } from "next";
import { headers } from "next/headers";
import { renderCustomerWorkspacePageBySlug } from "@/lib/storefront-render";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  return { title: /(?:-xby|_xby)/i.test(siteSlug) ? "Crear solicitud de fotos" : "Create photo request", robots: { index: false, follow: false } };
}

export default async function CustomerWorkspaceCreatePage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/app/create",
    siteSlug
  });
  const query = searchParams ? await searchParams : {};
  return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug: "/app/create", query, routeMode: "path" });
}
