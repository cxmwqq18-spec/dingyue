import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  readStorefrontPublicPageMetadataStateBySlugFromDatabase,
  readStorefrontPublicRuntimeStateBySlugFromDatabase
} from "@/lib/storefront-state";
import { renderCustomerWorkspacePage } from "@/lib/storefront-render";
import { customerSessionCookie } from "@/lib/session";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { publicSiteSlug } from "@/lib/domain-routing";
import { redirectLegacySiteSlug } from "@/lib/site-route-canonical";

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
  redirectLegacySiteSlug(siteSlug, "/app/jobs/progress");
  const publicState = await readStorefrontPublicRuntimeStateBySlugFromDatabase(siteSlug, "/app/jobs/progress");
  const publicSite = publicState?.sites[0];
  if (!publicSite) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(publicSite.id))?.value;
  if (!sessionId) redirect(`/site/${publicSiteSlug(publicSite.slug)}/login`);
  return renderCustomerWorkspacePage({ site: publicSite, slug: "/app/jobs/progress", routeMode: "path" });
}
