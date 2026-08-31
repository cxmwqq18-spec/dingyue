import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { generateMetadata as generateCatchAllMetadata } from "../../[...path]/page";

type RouteParams = Promise<{ siteSlug: string; themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function catchAllParams(params: { siteSlug: string; themeSlug: string }) {
  return Promise.resolve({
    siteSlug: params.siteSlug,
    path: ["ai-image-generation", params.themeSlug]
  });
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const resolved = await params;
  return generateCatchAllMetadata({ params: catchAllParams(resolved) });
}

export default async function ImageThemePage({
  params,
  searchParams
}: {
  params: RouteParams;
  searchParams?: SearchParams;
}) {
  const resolved = await params;
  const state = await readPathModePublicRuntimeState(resolved.siteSlug, "/ai-image-generation", resolved.themeSlug);
  const site = state?.sites[0];
  if (!site) notFound();
  const query = searchParams ? await searchParams : {};
  return renderStorefrontPage({
    site,
    slug: "/ai-image-generation",
    publicPath: `/ai-image-generation/${resolved.themeSlug}`,
    query: { ...query, category: resolved.themeSlug },
    routeMode: "path",
    state,
    deferCustomerRuntime: true
  });
}
