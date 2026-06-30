import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase,
  readStorefrontPlatformState
} from "@/lib/storefront-state";
import { renderCustomerWorkspacePage } from "@/lib/storefront-render";
import { customerSessionCookie } from "@/lib/session";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import type { PlatformState } from "@/lib/types";

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

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = await readStorefrontPublicPageMetadataStateBySlugFromDatabase(siteSlug, "/app/jobs/progress");
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/app/jobs/progress");
  return {
    ...(site && page ? metadataForSingleThemePage(site, page) : {}),
    robots: { index: false, follow: false }
  };
}

export default async function CustomerJobProgressPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/app/jobs/progress",
    siteSlug
  });
  const publicState = await readPublicRuntimeStateBySlugWithFallback(publicSlug, "/app/jobs/progress");
  const publicSite = publicState?.sites[0];
  if (!publicSite) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(publicSite.id))?.value;
  if (!sessionId) redirect(`/site/${publicSiteSlug(publicSite.slug)}/login`);
  return renderCustomerWorkspacePage({ site: publicSite, slug: "/app/jobs/progress", routeMode: "path" });
}
