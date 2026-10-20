import type { Metadata } from "next";
import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import { renderCustomerWorkspacePageBySlug } from "@/lib/storefront-render";
import { legacyCreateHrefToStatic } from "@/lib/aidreamcapes-workspace/static-routes";
import { redirectPublicSitePathToCanonicalHost } from "@/lib/site-route-canonical";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import { storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  return { title: isSpanishStorefrontRequestIdentity(siteSlug) ? "Crear solicitud de fotos" : "Create photo request", robots: { index: false, follow: false } };
}

export default async function CustomerWorkspaceCreatePage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, siteSlug);
  const publicSlug = redirectPublicSitePathToCanonicalHost({
    host: headerStore.get("x-forwarded-host") ?? headerStore.get("host"),
    pathname: "/app/create",
    siteSlug
  });
  const query = searchParams ? await searchParams : {};
  const videoMode = Array.isArray(query.videoMode) ? query.videoMode[0] : query.videoMode;
  if (videoMode === "text-to-video" || videoMode === "image-to-video") notFound();
  // Legacy query links are permanent redirects to their fixed paths.
  if ((publicSlug === "aidreamcapes" || publicSlug === "aivideosugc") && Object.keys(query).length) {
    const staticPath = legacyCreateHrefToStatic(`/app/create?${new URLSearchParams(Object.entries(query).flatMap(([k, v]) => Array.isArray(v) ? v.map((item) => [k, String(item)] as [string, string]) : [[k, String(v)]]))}`);
    if (staticPath) permanentRedirect(`/site/${siteSlug}${staticPath}`);
  }
  return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug: "/app/create", query, routeMode });
}
