import "server-only";

import { withSeoDirectorySeo, type SeoDirectoryKind } from "@/lib/dreamshoot-seo-content";
import { createPublishedSiteSnapshot, resolvePublishedSeoEntity, resolvePublishedStorefrontContext, type PublishedSiteSnapshot } from "@/lib/storefront-context";
import { isPrimaryMydreamshootsSite } from "@/lib/storefront-context/capabilities";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import type { CreativePack, PlatformState, Product, Site, ThemePage } from "@/lib/types";

export async function metadataForPublishedStorefrontPage({
  site,
  page,
  path = page.slug,
  products = [],
  creativePacks = [],
  preferProvidedPageJson = false,
  snapshot: providedSnapshot
}: {
  site: Site;
  page: ThemePage;
  path?: string;
  products?: Product[];
  creativePacks?: CreativePack[];
  preferProvidedPageJson?: boolean;
  snapshot?: PublishedSiteSnapshot;
}) {
  const snapshot = providedSnapshot ?? createPublishedSiteSnapshot({
    sites: [site],
    products: products.filter((product) => product.siteId === site.id),
    creativePacks: creativePacks.filter((pack) => pack.siteId === site.id),
    mediaAssets: site.mediaAssets ?? [],
    publications: []
  } as unknown as PlatformState, site);
  const snapshotPage = preferProvidedPageJson
    ? page
    : snapshot.pages.find((candidate) => candidate.id === page.id) ?? page;
  const context = resolvePublishedStorefrontContext(snapshot, snapshotPage);
  // AIdreamshoots keeps its translated SEO in the target LivePage JSON. The
  // shared storefront context may still derive a generic title from an older
  // route projection (notably for policy pages), so prefer the target page's
  // explicit SEO fields for this site only. Other storefronts retain the
  // existing projection and metadata behavior.
  const targetPageSeo = snapshot.site.id === "site_mydreamshoots_xby" ? snapshotPage.publishedJson.seo : undefined;
  const metadataContext = targetPageSeo
    ? {
        ...context,
        seo: {
          ...context.seo,
          ...(targetPageSeo.title?.trim() ? { title: targetPageSeo.title.trim() } : {}),
          ...(targetPageSeo.description?.trim() ? { description: targetPageSeo.description.trim() } : {}),
          ...(targetPageSeo.keywords?.trim() ? { keywords: targetPageSeo.keywords.trim() } : {}),
          ...(targetPageSeo.canonicalPath?.trim()
            ? {
                canonicalPath: targetPageSeo.canonicalPath,
                canonicalUrl: `${snapshot.site.primaryDomain?.startsWith("http") ? snapshot.site.primaryDomain.replace(/\/$/, "") : `https://${snapshot.site.primaryDomain}`}${targetPageSeo.canonicalPath.startsWith("/") ? targetPageSeo.canonicalPath : `/${targetPageSeo.canonicalPath}`}`
              }
            : {})
        }
      }
    : context;
  const approvedDirectoryImage = isPrimaryMydreamshootsSite(snapshot.site) && snapshotPage.slug === "/ai-image-generation" &&
    context.publishedStandardPageMedia?.status === "ready"
    ? context.publishedStandardPageMedia.ogImage?.trim()
    : undefined;
  const configuredOgImage = context.seo.ogImage?.trim();
  const defaultOgImage = context.settings.seo?.defaultOgImage?.trim();
  const useApprovedDirectoryImage = Boolean(approvedDirectoryImage && (!configuredOgImage || configuredOgImage === defaultOgImage));
  return metadataForSingleThemePage(snapshot.site, snapshotPage, useApprovedDirectoryImage
    ? { ...metadataContext, seo: { ...metadataContext.seo, ogImage: approvedDirectoryImage } }
    : metadataContext
  );
}

export async function metadataForPublishedStorefrontDirectoryPage({
  site,
  page,
  kind,
  directorySlug,
  path,
  products = [],
  creativePacks = [],
  snapshot
}: {
  site: Site;
  page: ThemePage;
  kind: SeoDirectoryKind;
  directorySlug: string;
  path?: string;
  products?: Product[];
  creativePacks?: CreativePack[];
  snapshot?: PublishedSiteSnapshot;
}) {
  const publishedBasePage = snapshot?.pages.find((candidate) => candidate.id === page.id) ?? page;
  const publishedSite = snapshot?.site ?? site;
  const projectionPath = path ?? (kind === "collection" ? `/ai-image-generation/${directorySlug}` : `/ai-video-generation/${directorySlug}`);
  const spanishTargetPage = publishedSite.id === "site_mydreamshoots_xby" && snapshot
    ? snapshot.pages.find((candidate) => candidate.slug === projectionPath || candidate.publishedJson?.seo?.canonicalPath === projectionPath)
    : undefined;
  const seoSourcePage = spanishTargetPage ?? publishedBasePage;
  // Dedicated video topic pages own their SEO in LivePage.contentJson. Resolve
  // that first so they never require a generic tool-directory seed.
  const pageJsonWithDirectorySeo = spanishTargetPage
    ? spanishTargetPage.publishedJson
    : withSeoDirectorySeo(publishedBasePage.publishedJson, kind, directorySlug, publishedSite);
  const resolved = isPrimaryMydreamshootsSite(publishedSite) && snapshot
    ? resolvePublishedSeoEntity(snapshot, projectionPath)
    : undefined;
  const route = resolved?.route && (resolved.route.routeKind === "ai-image-theme-leaf" || resolved.route.routeKind === "ai-video-topic-leaf")
    ? resolved.route
    : undefined;
  const pageEntity = resolved?.pageEntity;
  const pageMedia = resolved?.pageMedia;
  const directoryPageJson = pageEntity
    ? {
        ...publishedBasePage.publishedJson,
        seo: {
          ...pageJsonWithDirectorySeo.seo,
          canonicalPath: pageEntity.canonicalPath,
          canonical: pageEntity.canonicalPath,
          index: pageEntity.indexable,
          follow: pageEntity.metadata.robots.follow,
          robots: pageEntity.metadata.robots,
          ogImage: pageMedia?.status === "ready" ? pageMedia.primaryImage : undefined
        }
      }
    : isPrimaryMydreamshootsSite(publishedSite) && (kind === "collection" || kind === "tool")
      ? {
          ...publishedBasePage.publishedJson,
          seo: {
            ...pageJsonWithDirectorySeo.seo,
            canonicalPath: path ?? `/ai-image-generation/${directorySlug}`,
            canonical: path ?? `/ai-image-generation/${directorySlug}`,
            index: false,
            follow: true,
            robots: { index: false, follow: true },
            ogImage: undefined
          }
        }
      : pageJsonWithDirectorySeo;
  const resolvedPage = {
    ...seoSourcePage,
    publishedJson: directoryPageJson
  };
  return metadataForPublishedStorefrontPage({
    site,
    page: resolvedPage,
    path: path ?? resolvedPage.publishedJson.seo?.canonicalPath ?? page.slug,
    products,
    creativePacks,
    preferProvidedPageJson: true,
    snapshot
  });
}
