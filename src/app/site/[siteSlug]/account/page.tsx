import type { Metadata } from "next";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import { renderCustomerWorkspacePageBySlug } from "@/lib/storefront-render";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  return { title: isSpanishStorefrontRequestIdentity(siteSlug) ? "Cuenta" : "Account", robots: { index: false, follow: false } };
}

export default async function CustomerAccountPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  return renderCustomerWorkspacePageBySlug({ siteSlug, slug: "/account", query, routeMode: "path" });
}
