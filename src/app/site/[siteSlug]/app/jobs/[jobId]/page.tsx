import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase,
  readStorefrontPlatformState
} from "@/lib/storefront-state";
import { renderCustomerJobDetailPage } from "@/lib/storefront-render";
import { customerSessionCookie } from "@/lib/session";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { getStorefrontCustomerJobDetailStateForSite } from "@/lib/stores/site-store";
import type { PlatformState } from "@/lib/types";

const jobDetailSlug = "/app/jobs/detail";

function stateWithSiteFirst(state: PlatformState, siteSlug: string): PlatformState | undefined {
  const canonicalSlug = publicSiteSlug(siteSlug);
  const site = state.sites.find((item) => publicSiteSlug(item.slug) === canonicalSlug || item.slug === siteSlug);
  if (!site) return undefined;
  return {
    ...state,
    sites: [site, ...state.sites.filter((item) => item.id !== site.id)]
  };
}

async function readPublicRuntimeStateBySlugWithFallback(siteSlug: string, pageSlug: string): Promise<PlatformState | undefined> {
  try {
    const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, pageSlug);
    if (state?.sites[0]) return state;
  } catch {
    // Keep path-mode customer routes usable when the local relational pool is saturated.
  }
  return stateWithSiteFirst(await readStorefrontPlatformState(), siteSlug);
}

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; jobId: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, jobDetailSlug);
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
  searchParams
}: {
  params: Promise<{ siteSlug: string; jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, jobId } = await params;
  const headerStore = await headers();
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: `/app/jobs/${jobId}`,
    siteSlug
  });
  const [query, publicState] = await Promise.all([
    searchParams ? searchParams : Promise.resolve({}),
    readPublicRuntimeStateBySlugWithFallback(publicSlug, jobDetailSlug)
  ]);
  const publicSite = publicState?.sites[0];
  if (!publicSite) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(publicSite.id))?.value;
  if (!sessionId) redirect(`/site/${publicSiteSlug(publicSite.slug)}/login`);
  const detailState = await getStorefrontCustomerJobDetailStateForSite({ siteId: publicSite.id, sessionId, jobId });
  if (!detailState) notFound();
  return renderCustomerJobDetailPage({ site: publicSite, jobId, query, routeMode: "path", state: detailState });
}
