import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSiteByHostCandidatesFromState } from "@/lib/domain-routing";
import { readStorefrontPublicRuntimeStateByHostFromDatabase } from "@/lib/storefront-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { generateMetadata as generateCatchAllMetadata } from "@/app/[...path]/page";

type Params = Promise<{ themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { themeSlug } = await params;
  return generateCatchAllMetadata({ params: Promise.resolve({ path: ["ai-image-generation", themeSlug] }) });
}

export default async function ImageThemePage({
  params,
  searchParams
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const { themeSlug } = await params;
  const headerStore = await headers();
  const hosts = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const state = await Promise.all(hosts.map((host) =>
    host ? readStorefrontPublicRuntimeStateByHostFromDatabase(host, "/ai-image-generation") : undefined
  )).then((states) => states.find(Boolean));
  if (!state) notFound();
  const site = getSiteByHostCandidatesFromState(state, hosts) ?? state.sites[0];
  if (!site) notFound();
  const query = searchParams ? await searchParams : {};
  return renderStorefrontPage({
    site,
    slug: "/ai-image-generation",
    publicPath: `/ai-image-generation/${themeSlug}`,
    query: { ...query, category: themeSlug },
    routeMode: "host",
    state,
    deferCustomerRuntime: true
  });
}
