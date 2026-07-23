import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { readPathModePublicMetadataState } from "@/lib/storefront-local-state";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { publicSiteSlug } from "@/lib/domain-routing";
import { storefrontPathForRouteMode, storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";

const jobDetailSlug = "/app/jobs/detail";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; jobId: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readPathModePublicMetadataState(siteSlug, jobDetailSlug);
  const site = state?.sites[0];
  const page =
    site?.pages.find((item) => item.slug === jobDetailSlug || item.pageType === "job_detail") ??
    site?.pages.find((item) => item.slug === "/app/jobs/progress");
  return {
    ...(site && page ? metadataForSingleThemePage(site, page) : {}),
    robots: { index: false, follow: false }
  };
}

export default async function JobDetailPage({
  params,
  searchParams: _searchParams
}: {
  params: Promise<{ siteSlug: string; jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, jobId } = await params;
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, siteSlug);
  redirect(`${storefrontPathForRouteMode(publicSiteSlug(siteSlug), "/app", routeMode)}?job_status=workspace&job_id=${encodeURIComponent(jobId)}`);
}
