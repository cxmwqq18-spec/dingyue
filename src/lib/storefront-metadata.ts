import "server-only";

import { withSeoDirectorySeo, type SeoDirectoryKind } from "@/lib/dreamshoot-seo-content";
import { mydreamshootsPublishedRouteForSlug, resolveMydreamshootsPublishedPageMedia } from "@/lib/mydreamshoots-published-contract";
import { createPublishedSiteSnapshot, resolvePublishedStorefrontContext, type PublishedSiteSnapshot } from "@/lib/storefront-context";
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
    publications: site.latestPublication ? [site.latestPublication] : []
  } as unknown as PlatformState, site);
  const snapshotPage = preferProvidedPageJson
    ? page
    : snapshot.pages.find((candidate) => candidate.id === page.id) ?? page;
  const context = resolvePublishedStorefrontContext(snapshot, snapshotPage);
  const metadata = metadataForSingleThemePage(snapshot.site, snapshotPage, context);
  const existingOther = (metadata.other ?? {}) as Record<string, string | number | (string | number)[]>;
  return {
    ...metadata,
    other: {
      ...existingOther,
      "storefront-publication": context.revisions.publicationId ?? "unpublished",
      "storefront-facts-revision": context.revisions.factsRevision,
      "storefront-build": context.revisions.buildId,
      "storefront-snapshot-revision": context.revisions.snapshotRevision ?? "legacy",
      "storefront-route-revision": context.revisions.routeRevision ?? "legacy"
    }
  };
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
  const route = publishedSite.id === "site_dreamshoot" && kind === "collection"
    ? snapshot?.publishedRoutes.find((candidate) => candidate.canonicalSlug === directorySlug)
      ?? (!snapshot ? mydreamshootsPublishedRouteForSlug(directorySlug) : undefined)
    : undefined;
  const pageMedia = route
    ? snapshot?.publishedPageMedia.find((candidate) => candidate.pageEntityId === route.pageEntityId)
      ?? (!snapshot ? resolveMydreamshootsPublishedPageMedia(route, creativePacks) : undefined)
    : undefined;
  const pageCopy = route && snapshot
    ? snapshot.publishedPageCopy.find((candidate) => candidate.pageEntityId === route.pageEntityId)?.copy
    : undefined;
  const directoryPageJson = route && snapshot
    ? {
        ...publishedBasePage.publishedJson,
        seo: {
          ...publishedBasePage.publishedJson.seo,
          title: pageCopy?.seoTitle,
          description: pageCopy?.cardDescription,
          canonicalPath: route.canonicalPath,
          canonical: route.canonicalPath,
          index: route.indexable && pageMedia?.status === "ready",
          robots: { index: route.indexable && pageMedia?.status === "ready", follow: true }
        }
      }
    : withSeoDirectorySeo(publishedBasePage.publishedJson, kind, directorySlug, publishedSite);
  const resolvedPage = {
    ...publishedBasePage,
    publishedJson: {
      ...directoryPageJson,
      seo: {
        ...directoryPageJson.seo,
        ...(route
          ? { ogImage: pageMedia?.status === "ready" && pageMedia.primaryImage ? pageMedia.primaryImage : undefined }
          : {})
      }
    }
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
