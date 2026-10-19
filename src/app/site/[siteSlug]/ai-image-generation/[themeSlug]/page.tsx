import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { findPage } from "@/lib/data";
import { isRenderableAidreamcapesImageThemePage } from "@/lib/aidreamcapes-image-theme-content";
import { parsePublicCollectionRouteForSite, publicCollectionRootPathForSite } from "@/lib/photo-package-taxonomy";
import { getSeoDirectoryContentForSite } from "@/lib/dreamshoot-seo-content";
import { readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { renderStorefrontPage } from "@/lib/storefront-render";
import { createPublishedSiteSnapshot, resolveEffectiveIndexability, resolvePublishedRouteDisposition } from "@/lib/storefront-context";
import { metadataForPublishedStorefrontDirectoryPage, metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { canResolveCollectionSlugForSite } from "@/lib/storefront-render";
import { storefrontPathForRouteMode, storefrontRouteModeForHeaders } from "@/lib/storefront-route-mode";
import { AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY, isAidreamshootsEngagementFrenchPage } from "@/lib/aidreamshoots-engagement-photo-french";
import { AIDREAMCAPES_IMAGE_THEME_ROOT_PATH, isAidreamcapesImageThemePath } from "@/lib/aidreamcapes-image-theme-routes";
import { canonicalAidreamcapesEuPublicPath, isAidreamcapesEuRetiredPublicPath } from "@/lib/aidreamcapes-eu-retired-routes";
import { isMydreamshootsTopicGroupActive, mydreamshootsImageTopicGroupForSlug } from "@/lib/mydreamshoots-topic-groups";
import { renderAidreamcapesResolvedScenePage } from "@/lib/aidreamcapes-guest-workspace";
import { resolveWorkspacePublicScenePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import { PUBLIC_SCENE_SLUG_RE } from "@/lib/aidreamcapes-workspace/preset-contract";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";

async function resolveAidreamcapesImageScene(siteSlug: string, themeSlug: string) {
  if (siteSlug !== "aidreamcapes" && siteSlug !== "aivideosugc") return undefined;
  if (!PUBLIC_SCENE_SLUG_RE.test(themeSlug)) return undefined;
  const preset = await resolveWorkspacePublicScenePreset(AIVIDEOSUGC_SITE_ID, "photo", themeSlug);
  return preset ? { preset, routeSlug: (siteSlug === "aivideosugc" ? "aivideosugc" : "aidreamcapes") as "aivideosugc" | "aidreamcapes" } : undefined;
}
import { isPrimaryMydreamshootsSlug } from "@/lib/storefront-context/capabilities";
import type { PlatformState, Site } from "@/lib/types";

type RouteParams = Promise<{ siteSlug: string; themeSlug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function loadMydreamshootsImageTopicGroup(siteSlug: string, group: NonNullable<ReturnType<typeof mydreamshootsImageTopicGroupForSlug>>) {
  if (!isPrimaryMydreamshootsSlug(siteSlug)) return undefined;
  const state = await readPathModePublicRuntimeState(siteSlug, group.path);
  const site = state?.sites[0];
  const page = site?.id === "site_dreamshoot" ? findPage(site, group.path) : undefined;
  if (!state || !site || !page || page.publishedJson.seo?.canonicalPath !== group.path || !isMydreamshootsTopicGroupActive(state, site.id, group)) return undefined;
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "platform-state" });
  if (resolvePublishedRouteDisposition(snapshot, group.path).kind !== "render") return undefined;
  if (!resolveEffectiveIndexability(snapshot, page).index) return undefined;
  return { state, site, page, snapshot };
}

async function loadImageThemeState(siteSlug: string, themeSlug: string): Promise<{ state: PlatformState; site: Site } | undefined> {
  const requestedPath = `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${themeSlug}`;
  if (isAidreamcapesEuRetiredPublicPath(siteSlug, requestedPath)) return undefined;
  if (isAidreamcapesImageThemePath(siteSlug, requestedPath)) {
    const state = await readPathModePublicRuntimeState(siteSlug, requestedPath);
    const site = state?.sites[0];
    const page = site ? findPage(site, requestedPath) : undefined;
    return state && site && page && isRenderableAidreamcapesImageThemePage(page)
      ? { state, site }
      : undefined;
  }
  const state = await readPathModePublicRuntimeState(siteSlug, "/ai-image-generation", themeSlug);
  const site = state?.sites[0];
  return state && site && canResolveCollectionSlugForSite(state, site, themeSlug) ? { state, site } : undefined;
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { siteSlug, themeSlug } = await params;
  const imageScene = await resolveAidreamcapesImageScene(siteSlug, themeSlug);
  if (imageScene) {
    return { title: "Workspace | AIVideosUGC", description: "Create, edit and download your product photos and videos.", robots: { index: false, follow: false } };
  }
  const group = mydreamshootsImageTopicGroupForSlug(themeSlug);
  if (group && isPrimaryMydreamshootsSlug(siteSlug)) {
    const loadedGroup = await loadMydreamshootsImageTopicGroup(siteSlug, group);
    if (!loadedGroup) return { robots: { index: false, follow: false } };
    return metadataForPublishedStorefrontPage({
      site: loadedGroup.site,
      page: loadedGroup.page,
      path: group.path,
      products: loadedGroup.state.products,
      creativePacks: loadedGroup.state.creativePacks,
      snapshot: loadedGroup.snapshot
    });
  }
  if (siteSlug === "aidreamcapes-eu" && canonicalAidreamcapesEuPublicPath(`${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${themeSlug}`) !== `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${themeSlug}`) return {};
  const loaded = await loadImageThemeState(siteSlug, themeSlug);
  if (!loaded) return isPrimaryMydreamshootsSlug(siteSlug) ? { robots: { index: false, follow: false } } : {};
  const { state, site } = loaded;
  const requestedPath = `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${themeSlug}`;
  if (isAidreamcapesImageThemePath(siteSlug, requestedPath)) {
    const page = findPage(site, requestedPath);
    return page && isRenderableAidreamcapesImageThemePage(page)
      ? metadataForPublishedStorefrontPage({
          site,
          page,
          path: requestedPath,
          products: state.products,
          creativePacks: state.creativePacks,
          snapshot: createPublishedSiteSnapshot(state, site, { source: "platform-state" })
        })
      : {};
  }
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", themeSlug]);
  if (!route?.collectionSlug) return {};
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "postgres" });
  const page = findPage(site, publicCollectionRootPathForSite(site)) ?? findPage(site, "/collections");
  if (!page) return {};
  const metadata = await metadataForPublishedStorefrontDirectoryPage({
    site,
    page,
    kind: "collection",
    directorySlug: route.collectionSlug,
    path: route.canonicalPath,
    products: state.products,
    creativePacks: state.creativePacks,
    snapshot
  });
  const directoryContent = getSeoDirectoryContentForSite(site, "collection", route.collectionSlug);
  const engagementPhotoMeta = route.collectionSlug === "engagement-photo" && isAidreamshootsEngagementFrenchPage(site, route.canonicalPath)
    ? AIDREAMSHOOTS_ENGAGEMENT_FRENCH_COPY
    : undefined;
  const engagementCanonical = engagementPhotoMeta ? `https://aidreamshoots.eu${engagementPhotoMeta.canonicalPath}` : undefined;
  const finalTitle = engagementPhotoMeta?.seoTitle ?? directoryContent.title;
  const finalDescription = engagementPhotoMeta?.seoDescription ?? directoryContent.description;
  return {
    ...metadata,
    title: finalTitle,
    description: finalDescription,
    ...(engagementPhotoMeta ? {
      keywords: engagementPhotoMeta.seoKeywords,
      alternates: {
        ...(metadata.alternates ?? {}),
        canonical: engagementCanonical
      }
    } : {}),
    openGraph: {
      ...(metadata.openGraph ?? {}),
      title: finalTitle,
      description: finalDescription,
      ...(engagementPhotoMeta ? { url: engagementCanonical, locale: "es_ES", type: "website" as const } : {})
    },
    twitter: {
      ...(metadata.twitter ?? {}),
      title: finalTitle,
      description: finalDescription
    }
  };
}

export default async function ImageThemePage({
  params,
  searchParams
}: {
  params: RouteParams;
  searchParams?: SearchParams;
}) {
  const resolved = await params;
  const requestedPath = `${AIDREAMCAPES_IMAGE_THEME_ROOT_PATH}/${resolved.themeSlug}`;
  const imageScene = await resolveAidreamcapesImageScene(resolved.siteSlug, resolved.themeSlug);
  if (imageScene) {
    return renderAidreamcapesResolvedScenePage({ kind: "photo", preset: imageScene.preset, routeSlug: imageScene.routeSlug });
  }
  const group = mydreamshootsImageTopicGroupForSlug(resolved.themeSlug);
  if (group && isPrimaryMydreamshootsSlug(resolved.siteSlug)) {
    const loadedGroup = await loadMydreamshootsImageTopicGroup(resolved.siteSlug, group);
    if (!loadedGroup) notFound();
    const routeMode = storefrontRouteModeForHeaders(await headers(), resolved.siteSlug);
    const query = searchParams ? await searchParams : {};
    return renderStorefrontPage({
      site: loadedGroup.site,
      slug: group.path,
      publicPath: group.path,
      query,
      routeMode,
      state: loadedGroup.state,
      deferCustomerRuntime: true
    });
  }
  if (resolved.siteSlug === "aidreamcapes-eu") {
    const canonicalEuPath = canonicalAidreamcapesEuPublicPath(requestedPath);
    if (canonicalEuPath !== requestedPath) {
      const routeMode = storefrontRouteModeForHeaders(await headers(), resolved.siteSlug);
      permanentRedirect(storefrontPathForRouteMode(resolved.siteSlug, canonicalEuPath, routeMode));
    }
  }
  const loaded = await loadImageThemeState(resolved.siteSlug, resolved.themeSlug);
  if (!loaded) notFound();
  const { state, site } = loaded;
  if (isAidreamcapesImageThemePath(resolved.siteSlug, requestedPath)) {
    const routeMode = storefrontRouteModeForHeaders(await headers(), resolved.siteSlug);
    if (!isRenderableAidreamcapesImageThemePage(findPage(site, requestedPath))) notFound();
    return renderStorefrontPage({
      site,
      slug: requestedPath,
      publicPath: requestedPath,
      routeMode,
      state,
      deferCustomerRuntime: true
    });
  }
  const route = parsePublicCollectionRouteForSite(site, ["ai-image-generation", resolved.themeSlug]);
  if (!route?.collectionSlug) notFound();
  const query = searchParams ? await searchParams : {};
  return renderStorefrontPage({
    site,
    // Keep the renderer's source page on the canonical collection root so the
    // focused route emits canonical JSON-LD for the requested theme.
    slug: publicCollectionRootPathForSite(site),
    publicPath: route.canonicalPath,
    query: { ...query, category: route.collectionSlug },
    routeMode: "path",
    state,
    deferCustomerRuntime: true
  });
}
