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
  const metadata = metadataForSingleThemePage(snapshot.site, snapshotPage, context);
  const existingOther = (metadata.other ?? {}) as Record<string, string | number | (string | number)[]>;
  return {
    ...metadata,
    other: {
      ...existingOther,
      "storefront-current-revision": context.revisions.snapshotRevision ?? "unpublished",
      "storefront-facts-revision": context.revisions.factsRevision,
      "storefront-snapshot-hash": context.revisions.snapshotRevision ?? "unpublished",
      "storefront-build": context.revisions.buildId
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
  const projectionPath = path ?? (kind === "collection" ? `/ai-image-generation/${directorySlug}` : `/ai-video-generation/${directorySlug}`);
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
          ...publishedBasePage.publishedJson.seo,
          title: pageEntity.metadata.title,
          description: pageEntity.metadata.description,
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
            ...publishedBasePage.publishedJson.seo,
            canonicalPath: path ?? `/ai-image-generation/${directorySlug}`,
            canonical: path ?? `/ai-image-generation/${directorySlug}`,
            index: false,
            follow: true,
            robots: { index: false, follow: true },
            ogImage: undefined
          }
        }
      : withSeoDirectorySeo(publishedBasePage.publishedJson, kind, directorySlug, publishedSite);
  const resolvedPage = {
    ...publishedBasePage,
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
