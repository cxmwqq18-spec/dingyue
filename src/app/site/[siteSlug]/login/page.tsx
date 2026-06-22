import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getPage } from "@/lib/data";
import { getCustomerBySessionFromState, readPlatformState } from "@/lib/server-store";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { customerSessionCookie } from "@/lib/session";
import { metadataForThemePage } from "@/lib/theme/seo";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  const page = site?.pages.find((item) => item.slug === "/login");
  return site && page ? metadataForThemePage(site, page) : {};
}

export default async function SiteLoginPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { siteSlug } = await params;
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  const sessionId = (await cookies()).get(customerSessionCookie(site.id))?.value;
  if (getCustomerBySessionFromState(state, site.id, sessionId)) {
    redirect(`/site/${site.slug}/app`);
  }
  return renderStorefrontPage({ site, slug: "/login", query: await searchParams, routeMode: "path" });
}
