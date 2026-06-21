import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPage } from "@/lib/data";
import { readPlatformState } from "@/lib/server-store";
import { renderCustomerWorkspacePage } from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  const page = site?.pages.find((item) => item.slug === "/app/jobs/progress");
  return site && page ? metadataForThemePage(site, page) : {};
}

export default async function CustomerJobProgressPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  return renderCustomerWorkspacePage({ site, slug: "/app/jobs/progress", routeMode: "path" });
}
