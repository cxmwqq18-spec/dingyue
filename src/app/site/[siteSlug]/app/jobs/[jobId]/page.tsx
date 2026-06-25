import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { renderCustomerJobDetailPage } from "@/lib/storefront-render";
import { customerSessionCookie } from "@/lib/session";
import { metadataForThemePage } from "@/lib/theme/seo";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

const jobDetailSlug = "/app/jobs/detail";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; jobId: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, jobDetailSlug);
  const site = state?.sites[0];
  const page =
    site?.pages.find((item) => item.slug === jobDetailSlug || item.pageType === "job_detail") ??
    site?.pages.find((item) => item.slug === "/app/jobs/progress");
  return site && page ? metadataForThemePage(site, page) : {};
}

export default async function JobDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; jobId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, jobId } = await params;
  redirectLegacySiteSlug(siteSlug, `/app/jobs/${jobId}`);
  const query = searchParams ? await searchParams : {};
  const publicState = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, jobDetailSlug);
  const publicSite = publicState?.sites[0];
  if (!publicSite) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(publicSite.id))?.value;
  if (!sessionId) redirect(`/site/${publicSiteSlug(publicSite.slug)}/login`);
  return renderCustomerJobDetailPage({ site: publicSite, jobId, query, routeMode: "path" });
}
