import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSiteByHostCandidatesFromState, isPlatformHost } from "@/lib/domain-routing";
import { getPage } from "@/lib/data";
import { readStorefrontPlatformState } from "@/lib/storefront-state";
import {
  renderCustomerJobDetailPage,
  renderCustomerWorkspacePage,
  renderStorefrontPage,
  renderToolPage,
  resolveToolPageForSite
} from "@/lib/storefront-render";
import { metadataForThemePage } from "@/lib/theme/seo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const { path } = await params;
  const state = readStorefrontPlatformState();
  const headerStore = await headers();
  const site = getSiteByHostCandidatesFromState(state, [headerStore.get("x-forwarded-host"), headerStore.get("host")]);
  if (!site) return {};
  const slug = `/${path.join("/")}`;
  if (path[0] === "tools" && path[1]) {
    const { page, matched } = resolveToolPageForSite(state, site, path[1]);
    if (!matched) return {};
    return metadataForThemePage(site, page);
  }
  const page = getPage(site, slug);
  const resolvedPage = page.slug === slug ? page : site.pages.find((item) => item.slug === "/404") ?? page;
  return metadataForThemePage(site, resolvedPage);
}

export default async function HostStorefrontCatchAllPage({
  params,
  searchParams
}: {
  params: Promise<{ path: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { path } = await params;
  const firstSegment = path[0] ?? "";
  if (firstSegment === "platform" || firstSegment === "site" || firstSegment === "api" || firstSegment === "_next") {
    notFound();
  }

  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (isPlatformHost(host)) redirect(`/platform/${path.join("/")}`);
  const state = readStorefrontPlatformState();
  const site = getSiteByHostCandidatesFromState(state, [headerStore.get("x-forwarded-host"), headerStore.get("host")]);
  if (!site) notFound();
  const query = searchParams ? await searchParams : {};
  if (firstSegment === "app") {
    if (path[1] === "jobs" && path[2] && path[2] !== "progress") {
      return renderCustomerJobDetailPage({ site, jobId: path[2], query, routeMode: "host", state });
    }
    return renderCustomerWorkspacePage({ site, slug: `/${path.join("/")}`, query, routeMode: "host", state });
  }
  if (firstSegment === "tools" && path[1]) {
    return renderToolPage({ site, toolSlug: path[1], query, routeMode: "host", state });
  }
  return renderStorefrontPage({ site, slug: `/${path.join("/")}`, query, routeMode: "host", state });
}
