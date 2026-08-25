import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { renderStorefrontSectionNode } from "@/lib/storefront-render";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false }
};

function queryRecord(searchParams: Record<string, string | string[] | undefined>): Record<string, string | string[] | undefined> {
  const query: Record<string, string | string[] | undefined> = {};
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "pagePath" || key === "routeMode") return;
    query[key] = value;
  });
  return query;
}

export default async function StorefrontSectionPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; sectionId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-storefront-preview") !== "1") notFound();
  const [{ siteSlug, sectionId }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const rawPagePath = resolvedSearchParams.pagePath;
  const pagePath = typeof rawPagePath === "string" && rawPagePath ? rawPagePath : "/";
  const routeMode = resolvedSearchParams.routeMode === "host" ? "host" : "path";
  const section = await renderStorefrontSectionNode({
    siteSlug,
    slug: pagePath.startsWith("/") ? pagePath : `/${pagePath}`,
    sectionId,
    query: queryRecord(resolvedSearchParams),
    routeMode
  });
  if (!section) notFound();
  return section;
}
