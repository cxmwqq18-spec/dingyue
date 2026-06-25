import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSiteByHostCandidatesFromState, isPlatformHost } from "@/lib/domain-routing";
import { getPage } from "@/lib/data";
import {
  readStorefrontPlatformStateFromDatabase,
  readStorefrontPublicRuntimeStateByHostFromDatabase,
  readStorefrontRuntimeStateByHostFromDatabase
} from "@/lib/storefront-state";
import {
  renderCustomerJobDetailPage,
  renderCustomerWorkspacePage,
  renderStorefrontPage,
  renderToolPage,
  resolveToolPageForSite
} from "@/lib/storefront-render";
import { metadataForSeoDirectory } from "@/lib/dreamshoot-seo-content";
import { metadataForThemePage } from "@/lib/theme/seo";
import type { PlatformState } from "@/lib/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getHostRuntimeStateWithFallback(hosts: Array<string | null>): Promise<PlatformState | undefined> {
  return getHostRuntimeStateForModeWithFallback(hosts, "private");
}

async function getHostPublicRuntimeStateWithFallback(hosts: Array<string | null>, pageSlug?: string): Promise<PlatformState | undefined> {
  return getHostRuntimeStateForModeWithFallback(hosts, "public", pageSlug);
}

async function getHostRuntimeStateForModeWithFallback(hosts: Array<string | null>, mode: "public" | "private", pageSlug?: string): Promise<PlatformState | undefined> {
  try {
    for (const host of hosts) {
      const state = mode === "public"
        ? await readStorefrontPublicRuntimeStateByHostFromDatabase(host, pageSlug)
        : await readStorefrontRuntimeStateByHostFromDatabase(host);
      if (state) return state;
    }
  } catch {
    // Fall through to the full state reader for local or migrating databases.
  }
  const state = await readStorefrontPlatformStateFromDatabase();
  const site = getSiteByHostCandidatesFromState(state, hosts);
  return site ? state : undefined;
}

export async function generateMetadata({ params }: { params: Promise<{ path: string[] }> }): Promise<Metadata> {
  const [resolvedParams, headerStore] = await Promise.all([params, headers()]);
  const { path } = resolvedParams;
  const metadataPageSlug = path[0] === "collections" && path[1] ? "/collections" : path[0] === "tools" && path[1] ? `/tools/${path[1]}` : `/${path.join("/")}`;
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const state = await getHostPublicRuntimeStateWithFallback(hostCandidates, metadataPageSlug);
  if (!state) return {};
  const site = getSiteByHostCandidatesFromState(state, hostCandidates) ?? state.sites[0];
  if (!site) return {};
  const slug = `/${path.join("/")}`;
  if (path[0] === "tools" && path[1]) {
    const { matched } = resolveToolPageForSite(state, site, path[1]);
    if (!matched) return {};
    return metadataForSeoDirectory(site, "tool", path[1]);
  }
  if (path[0] === "collections" && path[1]) return metadataForSeoDirectory(site, "collection", path[1]);
  const page = getPage(site, slug);
  const resolvedPage = page.slug === slug ? page : site.pages.find((item) => item.slug === "/404") ?? page;
  if (path[0] === "dashboard") return { title: "Workspace" };
  return metadataForThemePage(site, resolvedPage);
}

export default async function HostStorefrontCatchAllPage({
  params,
  searchParams
}: {
  params: Promise<{ path: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ path }, headerStore] = await Promise.all([params, headers()]);
  const firstSegment = path[0] ?? "";
  if (firstSegment === "platform" || firstSegment === "site" || firstSegment === "api" || firstSegment === "_next") {
    notFound();
  }

  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  if (isPlatformHost(host)) redirect(`/platform/${path.join("/")}`);
  const hostCandidates = [headerStore.get("x-forwarded-host"), headerStore.get("host")];
  const needsPrivateRuntime = firstSegment === "app" || firstSegment === "dashboard";
  const publicPageSlug = firstSegment === "collections" && path[1] ? "/collections" : firstSegment === "tools" && path[1] ? `/tools/${path[1]}` : `/${path.join("/")}`;
  const state = needsPrivateRuntime
    ? await getHostRuntimeStateWithFallback(hostCandidates)
    : await getHostPublicRuntimeStateWithFallback(hostCandidates, publicPageSlug);
  if (!state) notFound();
  const site = getSiteByHostCandidatesFromState(state, hostCandidates) ?? state.sites[0];
  if (!site) notFound();
  const query = searchParams ? await searchParams : {};
  if (firstSegment === "app") {
    if (path[1] === "jobs" && path[2] && path[2] !== "progress") {
      return renderCustomerJobDetailPage({ site, jobId: path[2], query, routeMode: "host", state });
    }
    return renderCustomerWorkspacePage({ site, slug: `/${path.join("/")}`, query, routeMode: "host", state });
  }
  if (firstSegment === "dashboard") {
    return renderCustomerWorkspacePage({ site, slug: "/app", query, routeMode: "host", state });
  }
  if (firstSegment === "tools" && path[1]) {
    return renderToolPage({ site, toolSlug: path[1], query, routeMode: "host", state });
  }
  const collectionCategory = firstSegment === "collections" && path[1] ? path[1] : "";
  const storefrontQuery = collectionCategory ? { ...query, category: collectionCategory } : query;
  return renderStorefrontPage({
    site,
    slug: collectionCategory ? "/collections" : `/${path.join("/")}`,
    query: storefrontQuery,
    routeMode: "host",
    state
  });
}
