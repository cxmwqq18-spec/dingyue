import "server-only";

import { canonicalSeoDirectoryPathForSite, getDreamshootPublicSeoPageMetadataForSite, withSeoDirectorySeo, type SeoDirectoryKind } from "@/lib/dreamshoot-seo-content";
import { createPublishedSiteSnapshot, resolvePublishedSeoEntity, resolvePublishedStorefrontContext, type PublishedSiteSnapshot } from "@/lib/storefront-context";
import { canonicalUrlForSite, normalizeCanonicalPath } from "@/lib/storefront-context/seo-projection";
import { isPrimaryMydreamshootsSite } from "@/lib/storefront-context/capabilities";
import { metadataForSingleThemePage } from "@/lib/theme/seo";
import { isAidreamcapesImageThemePath } from "@/lib/aidreamcapes-image-theme-routes";
import { AIDREAMCAPES_EU_THEME_SLUGS, aidreamcapesEuSeoContent } from "@/lib/aidreamcapes-eu-seo-content";
import type { CreativePack, PlatformState, Product, Site, ThemePage } from "@/lib/types";

function canonicalMetadataPath(site: Site, value: unknown, fallback = "/"): string {
  const normalized = normalizeCanonicalPath(value, fallback);
  return /^\/(?:collections|ai-image-generation)(?:\/|$)/i.test(normalized)
    ? canonicalSeoDirectoryPathForSite(site, "collection", normalized)
    : normalized;
}

function isAidreamcapesEuImageThemePath(site: Site, value: unknown): boolean {
  if (site.id !== "site_aidreamcapes_xby") return false;
  const normalized = normalizeCanonicalPath(value, "");
  const parts = normalized.split("/").filter(Boolean);
  return parts.length === 2 && parts[0] === "ai-image-generation" && AIDREAMCAPES_EU_THEME_SLUGS.includes(parts[1]);
}

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
  const isAidreamcapesEuSaveTheDatePage = snapshot.site.id === "site_aidreamcapes_xby" && snapshotPage.slug.startsWith("/ai-save-the-date/");
  const isAidreamcapesEuImagePage = isAidreamcapesEuImageThemePath(snapshot.site, path) || isAidreamcapesEuImageThemePath(snapshot.site, snapshotPage.slug);
  const targetPageSeo = snapshot.site.id === "site_mydreamshoots_xby" ||
    ((snapshot.site.id === "site_aidreamcapes" || snapshot.site.id === "site_aidreamcapes_xby") &&
      (isAidreamcapesImageThemePath(snapshot.site.slug, snapshotPage.slug) || isAidreamcapesEuSaveTheDatePage || isAidreamcapesEuImagePage))
    ? snapshotPage.publishedJson.seo
    : undefined;
  const metadataPath = canonicalMetadataPath(
    snapshot.site,
    path === page.slug ? context.seo.canonicalPath : path,
    snapshotPage.slug
  );
  const publicRouteSeo = snapshot.site.id === "site_mydreamshoots_xby"
    ? getDreamshootPublicSeoPageMetadataForSite(snapshot.site, metadataPath)
    : undefined;
  const metadataContext = {
    ...context,
    seo: {
      ...context.seo,
      canonicalPath: metadataPath,
      // Derive the absolute URL from the normalized path. Stored canonical
      // strings can lag behind a route migration or point at the wrong host.
      canonicalUrl: canonicalUrlForSite(snapshot.site, metadataPath),
      ...(publicRouteSeo?.title?.trim()
        ? { title: publicRouteSeo.title.trim() }
        : targetPageSeo?.title?.trim() ? { title: targetPageSeo.title.trim() } : {}),
      ...(publicRouteSeo?.description?.trim()
        ? { description: publicRouteSeo.description.trim() }
        : targetPageSeo?.description?.trim() ? { description: targetPageSeo.description.trim() } : {}),
      ...(publicRouteSeo?.keywords?.trim()
        ? { keywords: publicRouteSeo.keywords.trim() }
        : targetPageSeo?.keywords?.trim() ? { keywords: targetPageSeo.keywords.trim() } : {})
    }
  };
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
    ? snapshot.pages.find((candidate) =>
        canonicalMetadataPath(publishedSite, candidate.slug, candidate.slug) === projectionPath ||
        canonicalMetadataPath(publishedSite, candidate.publishedJson?.seo?.canonicalPath, candidate.slug) === projectionPath
      )
    : undefined;
  const euVideoTargetPage = publishedSite.id === "site_aidreamcapes_xby" && kind === "tool" && snapshot
    ? snapshot.pages.find((candidate) => candidate.slug === projectionPath || candidate.publishedJson?.seo?.canonicalPath === projectionPath)
    : undefined;
  const seoSourcePage = spanishTargetPage ?? euVideoTargetPage ?? publishedBasePage;
  // Dedicated video topic pages own their SEO in LivePage.contentJson. Resolve
  // that first so they never require a generic tool-directory seed.
  const pageJsonWithDirectorySeo = spanishTargetPage || euVideoTargetPage
    ? seoSourcePage.publishedJson
    : withSeoDirectorySeo(publishedBasePage.publishedJson, kind, directorySlug, publishedSite);
  const resolved = (isPrimaryMydreamshootsSite(publishedSite) || publishedSite.id === "site_aidreamcapes_xby" || publishedSite.id === "site_mydreamshoots_xby") && snapshot
    ? resolvePublishedSeoEntity(snapshot, projectionPath)
    : undefined;
  const route = resolved?.route && (resolved.route.routeKind === "ai-image-theme-leaf" || resolved.route.routeKind === "ai-video-topic-leaf")
    ? resolved.route
    : undefined;
  const pageEntity = resolved?.pageEntity;
  const pageMedia = resolved?.pageMedia;
  const euPack = publishedSite.id === "site_aidreamcapes_xby" && kind === "collection"
    ? creativePacks.find((pack) => pack.siteId === publishedSite.id && [pack.categoryRecord?.slug, pack.category, pack.name]
        .filter(Boolean)
        .some((value) => String(value).trim().toLowerCase() === directorySlug.trim().toLowerCase()))
    : undefined;
  const euCoverImage = euPack?.imageUrl?.trim() || undefined;
  const isAidreamcapesEuCollection = publishedSite.id === "site_aidreamcapes_xby" && kind === "collection";
  const euSeoContent = isAidreamcapesEuCollection ? aidreamcapesEuSeoContent(directorySlug) : undefined;
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
          // EU theme pages own their cover in CreativePack. The generic page
          // media projection can still point at the legacy shared headshot,
          // so never let it overwrite a theme-specific EU cover.
          ogImage: isAidreamcapesEuCollection
            ? euCoverImage
            : pageMedia?.status === "ready" ? pageMedia.primaryImage : euCoverImage
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
  const euDirectoryPageJson = isAidreamcapesEuCollection
    ? {
        ...publishedBasePage.publishedJson,
        seo: {
          ...pageJsonWithDirectorySeo.seo,
          ...(euSeoContent ? {
            title: euSeoContent.title,
            description: euSeoContent.description,
            keywords: euSeoContent.keywords,
            ogImageAlt: `Illustration de ${euSeoContent.label.toLowerCase()} pour Aidreamcapes.`
          } : {}),
          canonicalPath: path ?? projectionPath,
          canonical: path ?? projectionPath,
          index: true,
          follow: true,
          robots: { index: true, follow: true, maxImagePreview: "large" as const },
          // Do not inherit the root directory's shared/default image on an
          // EU leaf page. Its CreativePack cover is the page's OG source.
          ogImage: euCoverImage,
          twitterImage: euCoverImage
        }
      }
    : directoryPageJson;
  const resolvedPage = {
    ...seoSourcePage,
    publishedJson: euDirectoryPageJson
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
