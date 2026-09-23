import type { Metadata } from "next";
import { isSpanishStorefrontRequestIdentity } from "@/lib/spanish-storefronts";
import { publicSiteSlug } from "@/lib/domain-routing";
import { metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { renderCustomerWorkspacePageBySlug } from "@/lib/storefront-render";
import { readPathModePublicMetadataState } from "@/lib/storefront-local-state";
import { storefrontOriginalIconSet } from "@/lib/storefront-brand-assets";

export async function generateMetadata({ params }: { params: Promise<{ siteSlug: string }> }): Promise<Metadata> {
  const { siteSlug } = await params;
  const fallbackTitle = isSpanishStorefrontRequestIdentity(siteSlug) ? "Cuenta" : "Account";
  const fallbackIcons = storefrontOriginalIconSet({ id: "", slug: siteSlug, primaryDomain: "" });
  // Account is a private workspace route and is not required to have a
  // published public-page row. Resolve its brand metadata from the published
  // storefront home page instead of asking the database for /account.
  let state: Awaited<ReturnType<typeof readPathModePublicMetadataState>>;
  try {
    state = await readPathModePublicMetadataState(publicSiteSlug(siteSlug), "/");
  } catch {
    return { title: fallbackTitle, ...(fallbackIcons ? { icons: fallbackIcons } : {}), robots: { index: false, follow: false } };
  }
  const site = state?.sites[0];
  const page = site?.pages.find((item) => item.slug === "/");
  if (site && page) {
    const storefrontIcons = storefrontOriginalIconSet(site) ?? fallbackIcons;
    return {
      ...metadataForPublishedStorefrontPage({ site, page, products: state?.products, creativePacks: state?.creativePacks }),
      title: fallbackTitle,
      ...(storefrontIcons ? { icons: storefrontIcons } : {}),
      robots: { index: false, follow: false }
    };
  }
  return { title: fallbackTitle, ...(fallbackIcons ? { icons: fallbackIcons } : {}), robots: { index: false, follow: false } };
}

export default async function CustomerAccountPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug } = await params;
  const query = searchParams ? await searchParams : {};
  return renderCustomerWorkspacePageBySlug({ siteSlug, slug: "/account", query, routeMode: "path" });
}
