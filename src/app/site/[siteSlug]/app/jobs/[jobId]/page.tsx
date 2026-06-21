import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import { readPlatformState } from "@/lib/server-store";
import { renderCustomerJobDetailPage } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";

const jobDetailSlug = "/app/jobs/detail";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string; jobId: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  const page = site?.pages.find((item) => item.slug === jobDetailSlug || item.pageType === "job_detail");
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
  const query = searchParams ? await searchParams : {};
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  return renderCustomerJobDetailPage({ site, jobId, query, routeMode: "path" });
}
