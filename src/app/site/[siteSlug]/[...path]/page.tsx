import { redirectLegacyAidreamcapesTemplateDirectory } from "@/lib/aidreamcapes-template-directory-route";
import { aidreamcapesTemplateFilterMetadata, redirectAidreamcapesTemplateFilter, withAidreamcapesListingPageMetadata } from "@/lib/aidreamcapes-template-filter.server";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { findPage } from "@/lib/data";
import { imageThemeDetailContentFromPage } from "@/lib/aidreamcapes-image-theme-content";
import {
  readStorefrontPublicCollectionDetailStateBySlugFromDatabase,
  readStorefrontPublicPageMetadataStateByHostFromDatabase,
  readStorefrontPublicRuntimeStateByHostFromDatabase,
} from "@/lib/storefront-state";
import { canResolveCollectionSlugForSite, renderCustomerWorkspacePageBySlug, renderStorefrontPage, renderToolPage } from "@/lib/storefront-render";
import { preferLocalPathModeState, readPathModePublicMetadataState, readPathModePublicRuntimeState } from "@/lib/storefront-local-state";
import { metadataForPublishedStorefrontDirectoryPage, metadataForPublishedStorefrontPage } from "@/lib/storefront-metadata";
import { canonicalSeoDirectoryPathForSite } from "@/lib/dreamshoot-seo-content";
import { parsePublicCollectionRouteForSite, parsePublicVideoGenerationRouteForSite } from "@/lib/photo-package-taxonomy";
import { legacyPublicPathTarget, mydreamshootsLegacyBlogPathTarget, mydreamshootsLegacyPublicPathTarget, mydreamshootsLegacyVideoPathTarget, publicContentPageSlug } from "@/lib/site-route-canonical";
import { isMydreamshootsRetiredPublicPath } from "@/lib/mydreamshoots-legacy-public-redirects";
import { publicSiteSlug } from "@/lib/domain-routing";
import { isAidreamshootsStorefrontSite, isSpanishStorefrontSite } from "@/lib/spanish-storefronts";
import { storefrontPathForRouteMode, storefrontRouteModeForHeaders, type StorefrontRouteMode } from "@/lib/storefront-route-mode";
import { isPrimaryMydreamshootsSlug, usesAiGenerationPublicRoutes, usesAiGenerationPublicSlug } from "@/lib/storefront-context/capabilities";
import { aidreamcapesImageThemePathForRequest, isRetiredAidreamcapesPublicPath } from "@/lib/aidreamcapes-image-theme-routes";
import { canonicalAidreamcapesEuPublicPath, isAidreamcapesEuRetiredPublicPath } from "@/lib/aidreamcapes-eu-retired-routes";
import { canonicalUrlForSite, createPublishedSiteSnapshot, resolveEffectiveIndexability, resolvePublishedRedirectDisposition, resolvePublishedRouteDisposition } from "@/lib/storefront-context";
import { isMydreamshootsEditorialThemeRoute } from "@/lib/mydreamshoots-editorial-routes";
import { isMydreamshootsSaveDateTopicGroupPathRequest, isMydreamshootsTopicGroupActive, isMydreamshootsVideoTopicGroupPathRequest, mydreamshootsTopicGroupForPath } from "@/lib/mydreamshoots-topic-groups";
import { aidreamcapesLegacyVideoSaveTheDatePath, aidreamshootsLegacyVideoSaveTheDatePath, canonicalSaveTheDatePath, legacySaveTheDatePath, MYDREAMSHOOTS_WEDDING_INVITATION_PATH, MYDREAMSHOOTS_WEDDING_INVITATION_RETIRED_PATH, MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH } from "@/lib/save-the-date-routes";
import { dreamshootAiStudioTemplatesForSite } from "@/lib/theme/packages/dreamshoot-ai-studio";
import { renderAidreamcapesPartnerProgramPage } from "@/lib/aidreamcapes-partner-program";
import { aidreamcapesCheckoutMetadata, renderAidreamcapesCheckoutPage } from "@/lib/aidreamcapes-checkout-page";
import {
  aidreamcapesMediaDetailMetadata,
  aidreamcapesActorPublicMetadata,
  renderAidreamcapesCreatePage,
  renderAidreamcapesMediaDetailPage
} from "@/lib/aidreamcapes-guest-workspace";
import { actorFlatRedirectTarget, isActorDetailSegment, parseMediaDetailSegments } from "@/lib/aidreamcapes-workspace/media-detail";
import { resolveActorDetail, resolveMediaDetail, retiredMediaPageRedirect, aidreamcapesMissingPageRedirect } from "@/lib/aidreamcapes-workspace/media-detail.server";
import { PUBLIC_SCENE_SLUG_RE } from "@/lib/aidreamcapes-workspace/preset-contract";
import { legacyCreateHrefToStatic, legacyStaticCreateRedirect, parseStaticCreateSegments, staticCreateQuery } from "@/lib/aidreamcapes-workspace/static-routes";
import type { PlatformState, ThemePage } from "@/lib/types";

// AIVideosUGC is served as the aidreamcapes storefront; both names address the
// same site in path mode.
function isAidreamcapesPathModeSite(publicSite: string): boolean {
  return publicSite === "aidreamcapes" || publicSite === "aivideosugc";
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateViewport({ params }: { params: Promise<{ siteSlug: string; path: string[] }> }): Promise<Viewport> {
  const { siteSlug } = await params;
  const darkAidreamcapes = new Set(["aidreamcapes", "aidreamcapes-eu"]);
  return darkAidreamcapes.has(siteSlug.trim().toLowerCase())
    ? { colorScheme: "dark", themeColor: "#050505" }
    : {};
}

type HeaderReader = {
  get(name: string): string | null;
};

function publicHostCandidates(headers: HeaderReader): Array<string | null> {
  return [
    headers.get("x-forwarded-host"),
    headers.get("host")
  ];
}

async function readRoutePublicRuntimeState(
  headers: HeaderReader,
  routeMode: StorefrontRouteMode,
  publicSlug: string,
  pageSlug: string,
  contextSlug?: string
) {
  if (routeMode === "host") {
    for (const host of publicHostCandidates(headers)) {
      const state = await readStorefrontPublicRuntimeStateByHostFromDatabase(host, pageSlug, contextSlug);
      if (state?.sites[0]) return state;
    }
  }
  return readPathModePublicRuntimeState(publicSlug, pageSlug, contextSlug);
}

async function readRoutePublicMetadataState(
  headers: HeaderReader,
  routeMode: StorefrontRouteMode,
  publicSlug: string,
  pageSlug: string
) {
  if (routeMode === "host") {
    for (const host of publicHostCandidates(headers)) {
      const state = await readStorefrontPublicPageMetadataStateByHostFromDatabase(host, pageSlug);
      if (state?.sites[0]) return state;
    }
  }
  return readPathModePublicMetadataState(publicSlug, pageSlug);
}

function withAidreamcapesPromptGuidePage(state: PlatformState | undefined): PlatformState | undefined {
  const site = state?.sites[0];
  if (!state || !site || site.id !== "site_aidreamcapes" || findPage(site, "/prompt-guide")) return state;
  const pageJson = dreamshootAiStudioTemplatesForSite({
    id: site.id,
    slug: site.slug,
    name: site.name,
    primaryDomain: site.primaryDomain,
    branding: site.branding
  })["prompt-guide"];
  if (!pageJson) return state;
  const page: ThemePage = {
    id: `${site.id}_prompt-guide`,
    siteId: site.id,
    pageType: pageJson.pageType,
    templateKey: "prompt-guide",
    slug: "/prompt-guide",
    title: "Prompt Guide",
    draftJson: pageJson,
    publishedJson: pageJson
  };
  return {
    ...state,
    sites: state.sites.map((candidate) => candidate.id === site.id ? { ...candidate, pages: [...candidate.pages, page] } : candidate)
  };
}
const aidreamcapesLegacyBlogCategoryRedirects: Record<string, string> = {
  "fan-scene-albums": "/blog/private-fan-scene-album-photo-package-guide",
  "private-fan-scene-albums": "/blog/private-fan-scene-album-photo-package-guide",
  "backstage-meetup-portraits": "/blog/backstage-meetup-portraits-photo-package-guide",
  "supporter-photo-walls": "/blog/creator-supporter-photo-wall-photo-package-guide",
  "fan-keepsake-card-sets": "/blog/fan-keepsake-card-set-photo-package-guide",
  "game-day-group-photos": "/blog/game-day-group-portraits-photo-package-guide",
  "game-day-group-portraits": "/blog/game-day-group-portraits-photo-package-guide",
  "stadium-night-fan-sets": "/blog/stadium-night-fan-set-photo-package-guide",
  "watch-party-albums": "/blog/championship-watch-party-album-photo-package-guide",
  "premiere-style-portraits": "/blog/premiere-flash-portraits-photo-package-guide",
  "premiere-flash-portraits": "/blog/premiere-flash-portraits-photo-package-guide",
  "vip-arrival-photo-sets": "/blog/vip-arrival-photo-set-photo-package-guide",
  "award-night-keepsake-albums": "/blog/award-night-keepsake-album-photo-package-guide",
  "christmas-holiday-albums": "/blog/christmas-group-album-photo-package-guide",
  "christmas-group-albums": "/blog/christmas-group-album-photo-package-guide",
  "cozy-card-portrait-sets": "/blog/cozy-card-portrait-set-photo-package-guide",
  "winter-fan-greeting-albums": "/blog/winter-fan-greeting-album-photo-package-guide",
  "thanksgiving-memory-sets": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "thanksgiving-table-keepsakes": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "gratitude-group-portraits": "/blog/gratitude-group-portrait-album-photo-package-guide",
  "friendsgiving-memory-sets": "/blog/friendsgiving-memory-set-photo-package-guide",
  "halloween-party-portraits": "/blog/halloween-party-portrait-set-photo-package-guide",
  "halloween-party-portrait-sets": "/blog/halloween-party-portrait-set-photo-package-guide",
  "costume-cast-photo-albums": "/blog/costume-cast-photo-album-photo-package-guide",
  "seasonal-celebration-photos": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "birthday-fan-moment-sets": "/blog/birthday-fan-moment-set-photo-package-guide",
  "new-year-countdown-albums": "/blog/new-year-countdown-group-album-photo-package-guide"
};
const aidreamcapesLegacyBlogDirectRedirects: Record<string, string> = {
  "video-photo-package-guide": "/blog/motion-generator-video-guide",
  "fan-scene-photo-albums-guide": "/blog/private-fan-scene-album-photo-package-guide",
  "game-day-group-portraits-guide": "/blog/game-day-group-portraits-photo-package-guide",
  "premiere-style-photo-sets-guide": "/blog/premiere-flash-portraits-photo-package-guide",
  "holiday-memory-albums-guide": "/blog/christmas-group-album-photo-package-guide",
  "thanksgiving-keepsake-sets-category-guide": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "halloween-party-portraits-category-guide": "/blog/halloween-party-portrait-set-photo-package-guide",
  "seasonal-celebration-photos-category-guide": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "permission-safe-fan-scene-references": "/blog/family-occasion-portrait-album-photo-package-guide",
  "private-album-credit-planning": "/blog/private-fan-scene-album-photo-package-guide"
};
const aidreamcapesLegacyBlogToolRedirects: Record<string, string> = {
  "fan-scene-builders-guide": "/blog/private-fan-scene-album-photo-package-guide",
  "game-day-builders-guide": "/blog/game-day-group-portraits-photo-package-guide",
  "premiere-creator-tools-guide": "/blog/premiere-flash-portraits-photo-package-guide",
  "holiday-album-tools-guide": "/blog/christmas-group-album-photo-package-guide",
  "occasion-card-tools-guide": "/blog/seasonal-celebration-photo-set-photo-package-guide",
  "safety-prep-tools-guide": "/blog/family-occasion-portrait-album-photo-package-guide",
  "fan-scene-album-builder": "/blog/private-fan-scene-album-photo-package-guide",
  "backstage-meetup-scene-builder": "/blog/backstage-meetup-portraits-photo-package-guide",
  "supporter-photo-wall-maker": "/blog/creator-supporter-photo-wall-photo-package-guide",
  "fan-keepsake-card-maker": "/blog/fan-keepsake-card-set-photo-package-guide",
  "game-day-group-portrait-maker": "/blog/game-day-group-portraits-photo-package-guide",
  "stadium-night-fan-set-maker": "/blog/stadium-night-fan-set-photo-package-guide",
  "watch-party-album-builder": "/blog/championship-watch-party-album-photo-package-guide",
  "premiere-portrait-set-builder": "/blog/premiere-flash-portraits-photo-package-guide",
  "vip-arrival-photo-maker": "/blog/vip-arrival-photo-set-photo-package-guide",
  "award-night-album-studio": "/blog/award-night-keepsake-album-photo-package-guide",
  "new-year-countdown-album-maker": "/blog/new-year-countdown-group-album-photo-package-guide",
  "christmas-group-album-studio": "/blog/christmas-group-album-photo-package-guide",
  "cozy-card-portrait-maker": "/blog/cozy-card-portrait-set-photo-package-guide",
  "winter-fan-greeting-maker": "/blog/winter-fan-greeting-album-photo-package-guide",
  "thanksgiving-keepsake-set-maker": "/blog/thanksgiving-keepsake-table-set-photo-package-guide",
  "friendsgiving-memory-maker": "/blog/friendsgiving-memory-set-photo-package-guide",
  "halloween-party-portrait-maker": "/blog/halloween-party-portrait-set-photo-package-guide",
  "costume-cast-album-builder": "/blog/costume-cast-photo-album-photo-package-guide",
  "birthday-fan-moment-maker": "/blog/birthday-fan-moment-set-photo-package-guide",
};
const aidreamcapesLegacyBlogVideoRedirects: Record<string, string> = {
  "coastal-motion": "/blog/private-fan-scene-album-photo-package-guide",
  "memory-film": "/blog/private-fan-scene-album-photo-package-guide",
  "profile-travel": "/blog/private-fan-scene-album-photo-package-guide",
  "route-motion": "/blog/private-fan-scene-album-photo-package-guide"
};

function isSpanishXbyStorefrontSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }): boolean {
  return isSpanishStorefrontSite(site);
}

function isSpanishAIdreamshootsSlug(slug: string): boolean {
  return ["aidreamshoots", "aidreamshoots-eu", "mydreamshoots-xby"].includes(slug.trim().toLowerCase());
}

function aidreamcapesLegacyBlogRedirectPath(siteSlug: string, slug: string): string | undefined {
  if (siteSlug !== "aidreamcapes" || !slug.startsWith("/blog/")) return undefined;
  const articleSlug = slug.slice("/blog/".length).trim().toLowerCase();
  const directRedirect = aidreamcapesLegacyBlogDirectRedirects[articleSlug] ?? aidreamcapesLegacyBlogToolRedirects[articleSlug];
  if (directRedirect) return directRedirect;
  if (articleSlug.endsWith("-photo-package-guide")) {
    return aidreamcapesLegacyBlogCategoryRedirects[articleSlug.slice(0, -"-photo-package-guide".length)];
  }
  if (articleSlug.endsWith("-tool-guide")) {
    return aidreamcapesLegacyBlogToolRedirects[articleSlug.slice(0, -"-tool-guide".length)];
  }
  if (articleSlug.endsWith("-video-theme-guide")) {
    return aidreamcapesLegacyBlogVideoRedirects[articleSlug.slice(0, -"-video-theme-guide".length)];
  }
  return undefined;
}

function isDreamshootPartnerTemplateSite(site: { slug: string; name: string; primaryDomain?: string | null; branding: { logoText: string } }): boolean {
  return !isSpanishXbyStorefrontSite(site) && usesAiGenerationPublicRoutes({ id: "", slug: site.slug });
}

function isCollectionRouteRequest(path: string[]): boolean {
  return path[0] === "ai-image-generation" || path[0] === "collections";
}

function isVideoGenerationRouteRequest(siteSlug: string, path: string[]): boolean {
  return path[0] === "ai-video-generation" &&
    !isMydreamshootsEditorialThemeRoute(`/${path.join("/")}`) &&
    !isMydreamshootsVideoTopicGroupPathRequest(publicSiteSlug(siteSlug), path);
}

function weddingInvitationMetadata(): Metadata {
  const canonical = "https://www.mydreamshoots.com/ai-save-the-date/wedding-invitation";
  const title = "Wedding Invitation | myDreamshoots";
  const description = "Create a private wedding invitation reveal with readable names, dates, venue details, and paper texture.";
  const image = "https://www.mydreamshoots.com/assets/dreamshoot/wedding-invitation/hero-ai-wedding-invitation-couple-reviewing.jpg";
  return {
    title,
    description,
    alternates: { canonical },
    robots: { index: true, follow: true, "max-image-preview": "large" },
    openGraph: { title, description, url: canonical, siteName: "myDreamshoots", images: [{ url: image }] },
    twitter: { card: "summary_large_image", title, description, images: [image] }
  };
}

function canRenderPublishedPublicPath(
  snapshot: ReturnType<typeof createPublishedSiteSnapshot>,
  internalPath: string,
  requestedPath: string,
  site?: Parameters<typeof findPage>[0]
): boolean {
  const disposition = resolvePublishedRouteDisposition(snapshot, internalPath);
  if (disposition.kind === "render" || (disposition.kind === "redirect" && disposition.targetPath === requestedPath)) return true;
  if (requestedPath === MYDREAMSHOOTS_WEDDING_INVITATION_PATH && internalPath === MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH) {
    return site ? findPage(site, internalPath)?.pageType === "ai_tool" : false;
  }
  // Keep already-published standard-content pages reachable while an older
  // immutable publication is being replaced. The page itself is still
  // required to carry the requested canonical path; draft-only pages never
  // pass this compatibility check.
  const page = site ? findPage(site, internalPath) : undefined;
  return (page?.pageType === "standard-content" || page?.pageType === "content") && page.publishedJson?.seo?.canonicalPath === internalPath;
}

function isSpanishWeddingInvitationCompatibilitySite(siteSlug: string): boolean {
  return isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug)) || isSpanishAIdreamshootsSlug(publicSiteSlug(siteSlug));
}

function collectionRouteLookupSlug(path: string[]): string {
  if (path[0] === "ai-image-generation") return path[1] || "";
  if (path[0] === "collections") return path[1] || "";
  return "";
}

function searchParamsSuffix(query: Record<string, string | string[] | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (typeof value === "string") {
      params.set(key, value);
    }
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : "";
}

function fallbackCollectionRootPathForPublicSlug(publicSlug: string): string {
  // AIdreamshoots uses the shared AI image-generation root as its only
  // canonical collection family. `/collections` remains a redirect alias.
  if (publicSlug === "aidreamshoots" || publicSlug === "aidreamshoots-eu" || publicSlug === "mydreamshoots-xby") {
    return "/ai-image-generation";
  }
  return usesAiGenerationPublicSlug(publicSlug)
    ? "/ai-image-generation"
    : "/collections";
}

async function readCollectionRouteState(
  siteSlug: string,
  collectionCategory: string,
  headers?: HeaderReader,
  routeMode: StorefrontRouteMode = "path"
) {
  const collectionRootPageSlug = fallbackCollectionRootPathForPublicSlug(siteSlug);
  // MyDreamShoots leaf URLs render the shared published directory with a
  // focused category. The detail projection omits that directory page and
  // therefore cannot render the route shell.
  if (isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug))) {
    return readPathModePublicRuntimeState(siteSlug, collectionRootPageSlug, collectionCategory);
  }
  if (routeMode === "host" && headers) {
    const hostState = await readRoutePublicRuntimeState(
      headers,
      routeMode,
      siteSlug,
      collectionRootPageSlug,
      collectionCategory || undefined
    );
    if (hostState?.sites[0]) return hostState;
  }
  if (preferLocalPathModeState(siteSlug)) return readPathModePublicRuntimeState(siteSlug, collectionRootPageSlug);
  try {
    const detailState = await readStorefrontPublicCollectionDetailStateBySlugFromDatabase(siteSlug, collectionCategory);
    const detailSite = detailState?.sites[0];
    if (detailState && detailSite && canResolveCollectionSlugForSite(detailState, detailSite, collectionCategory)) return detailState;
  } catch {
    // Continue to the broader collections state or local JSON fallback.
  }
  return readPathModePublicRuntimeState(siteSlug, collectionRootPageSlug);
}

async function readVideoGenerationRouteState(siteSlug: string, videoSlug: string) {
  if (videoSlug) {
    const detailState = await readPathModePublicRuntimeState(siteSlug, `/ai-video-generation/${videoSlug}`);
    if (detailState) return isolateAidreamcapesVideoRouteState(siteSlug, detailState);
  }
  return isolateAidreamcapesVideoRouteState(siteSlug, await readPathModePublicRuntimeState(siteSlug, "/ai-video-generation"));
}

function isolateAidreamcapesVideoRouteState(siteSlug: string, state: Awaited<ReturnType<typeof readPathModePublicRuntimeState>>) {
  if (!state || publicSiteSlug(siteSlug) !== "aidreamcapes") return state;
  // The Aidreamcapes ZIP header owns its visible video IA. Detail routes do
  // not need the legacy relational video-theme catalogue, and excluding it
  // here prevents contaminated historical EU rows from entering metadata
  // RSC payloads. The .eu and all other storefronts keep their own state.
  return { ...state, videoThemeCategories: [], videoThemes: [] };
}

/** Public AIVideosUGC/Aidreamcapes hosts must not serve another storefront's
 * pages through the path-mode prefix. Local and platform hosts keep path mode
 * for previews. */
async function assertAidreamcapesPathModeSite(siteSlug: string): Promise<void> {
  const requestHeaders = await headers();
  const host = String(requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  const isAivideosugcHost = host === "www.aivideosugc.com" || host === "aivideosugc.com"
    || host === "www.aidreamcapes.com" || host === "aidreamcapes.com";
  if (isAivideosugcHost && !isAidreamcapesPathModeSite(publicSiteSlug(siteSlug))) notFound();
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ siteSlug: string; path: string[] }>; searchParams?: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const { siteSlug, path } = await params;
  await assertAidreamcapesPathModeSite(siteSlug);
  const metadataQuery = searchParams ? await searchParams : {};
  const hintedCollectionSlug = (await headers()).get("x-storefront-image-theme")?.trim();
  const requestedSlug = `/${path.join("/")}`;
  const pathModePublicSlug = publicSiteSlug(siteSlug);
  const filterMetadata = await aidreamcapesTemplateFilterMetadata(pathModePublicSlug, requestedSlug, metadataQuery);
  if (filterMetadata) return filterMetadata;
  if (isAidreamcapesPathModeSite(pathModePublicSlug) && requestedSlug === "/partners") {
    const title = "Partner Program | AIVideosUGC";
    const description = "Apply to the AIVideosUGC partner program — share AI UGC video ads with your audience. Manual review within 48 hours, Pro demo workspace, full creative kit.";
    return {
      title: { absolute: title },
      description,
      alternates: { canonical: "https://www.aivideosugc.com/partners" },
      robots: { index: true, follow: true, "max-image-preview": "large" },
      openGraph: {
        title,
        description,
        url: "https://www.aivideosugc.com/partners",
        images: [{
          url: "https://www.aivideosugc.com/ai-image-generation/partners-og-card-1200x630.png",
          width: 1200,
          height: 630,
          alt: "AIVideosUGC partner program share card: a phone on a tripod filming a product, with the partner program headline."
        }]
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ["https://www.aivideosugc.com/ai-image-generation/partners-og-card-1200x630.png"]
      }
    };
  }
  if (isAidreamcapesPathModeSite(pathModePublicSlug) && requestedSlug === "/checkout") {
    return aidreamcapesCheckoutMetadata();
  }
  const mediaDetail = isAidreamcapesPathModeSite(pathModePublicSlug) ? parseMediaDetailSegments(path) : undefined;
  if (mediaDetail) {
    // A current public card owns its detail page; the workspace is only
    // reachable from that page. Non-card slugs keep their published metadata.
    const mediaDetailMetadata = await aidreamcapesMediaDetailMetadata({ kind: mediaDetail.kind, slug: mediaDetail.slug });
    if (mediaDetailMetadata) return mediaDetailMetadata;
  }
  if (isAidreamcapesPathModeSite(pathModePublicSlug) && path[0] === "ai-actors") {
    // Legacy gendered actor addresses are permanent redirects to the flat page.
    if (path.length === 3 && (path[1] === "men" || path[1] === "women")) return {};
    if (path.length === 2 && isActorDetailSegment(path[1])) {
      const actor = await resolveActorDetail(path[1]);
      if (actor) {
        const flatPath = `/ai-actors/${actor.slug}`;
        const actorState = await readPathModePublicRuntimeState(pathModePublicSlug, actor.detailPageSlug);
        const actorSite = actorState?.sites[0];
        const actorPage = actorSite ? findPage(actorSite, actor.detailPageSlug) : undefined;
        if (actorState && actorSite && actorPage) {
          return aidreamcapesActorPublicMetadata(await metadataForPublishedStorefrontPage({
              site: actorSite,
              page: actorPage,
              path: actor.detailPageSlug,
              products: actorState.products,
              creativePacks: actorState.creativePacks,
              snapshot: createPublishedSiteSnapshot(actorState, actorSite, { source: "platform-state" })
            }), flatPath);
        }
      }
    }
  }
  if ((isMydreamshootsVideoTopicGroupPathRequest(publicSiteSlug(siteSlug), path) || isMydreamshootsSaveDateTopicGroupPathRequest(publicSiteSlug(siteSlug), path)) && !mydreamshootsTopicGroupForPath(requestedSlug)) {
    return { robots: { index: false, follow: false } };
  }
  const topicGroup = isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug)) ? mydreamshootsTopicGroupForPath(requestedSlug) : undefined;
  if (topicGroup) {
    const groupHeaders = await headers();
    const groupRouteMode = storefrontRouteModeForHeaders(groupHeaders, publicSiteSlug(siteSlug));
    const groupState = groupRouteMode === "host"
      ? await readRoutePublicRuntimeState(groupHeaders, groupRouteMode, publicSiteSlug(siteSlug), topicGroup.path)
      : await readPathModePublicRuntimeState(publicSiteSlug(siteSlug), topicGroup.path);
    const groupSite = groupState?.sites[0];
    const groupPage = groupSite ? findPage(groupSite, topicGroup.path) : undefined;
    if (!groupState || !groupSite || !groupPage || !isMydreamshootsTopicGroupActive(groupState, groupSite.id, topicGroup)) {
      return { robots: { index: false, follow: false } };
    }
    const groupSnapshot = createPublishedSiteSnapshot(groupState, groupSite, { source: "platform-state" });
    if (resolvePublishedRouteDisposition(groupSnapshot, topicGroup.path).kind !== "render" || !resolveEffectiveIndexability(groupSnapshot, groupPage).index) {
      return { robots: { index: false, follow: false } };
    }
    return metadataForPublishedStorefrontPage({
      site: groupSite,
      page: groupPage,
      path: topicGroup.path,
      products: groupState.products,
      creativePacks: groupState.creativePacks,
      snapshot: groupSnapshot
    });
  }
  const imageThemePath = aidreamcapesImageThemePathForRequest(publicSiteSlug(siteSlug), requestedSlug);
  if (imageThemePath) {
    const headerStore = await headers();
    const routeMode = storefrontRouteModeForHeaders(headerStore, publicSiteSlug(siteSlug));
    const detailState = routeMode === "host"
      ? await readRoutePublicRuntimeState(headerStore, routeMode, publicSiteSlug(siteSlug), imageThemePath)
      : await readPathModePublicRuntimeState(publicSiteSlug(siteSlug), imageThemePath);
    const detailSite = detailState?.sites[0];
    const detailPage = detailSite ? findPage(detailSite, imageThemePath) : undefined;
    return detailState && detailSite && detailPage && imageThemeDetailContentFromPage(detailPage)
      ? metadataForPublishedStorefrontPage({
          site: detailSite,
          page: detailPage,
          path: imageThemePath,
          products: detailState.products,
          creativePacks: detailState.creativePacks,
          snapshot: createPublishedSiteSnapshot(detailState, detailSite, { source: "platform-state" })
        })
      : {};
  }
  if (isRetiredAidreamcapesPublicPath(publicSiteSlug(siteSlug), requestedSlug)) {
    return { robots: { index: false, follow: false } };
  }
  if (isAidreamcapesEuRetiredPublicPath(publicSiteSlug(siteSlug), requestedSlug)) return { robots: { index: false, follow: false } };
  if (publicSiteSlug(siteSlug) === "aidreamcapes" || publicSiteSlug(siteSlug) === "aidreamcapes-eu") {
    const legacySaveTheDateTarget = aidreamcapesLegacyVideoSaveTheDatePath(requestedSlug);
    if (legacySaveTheDateTarget) return {};
  }
  if (isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug)) && mydreamshootsLegacyBlogPathTarget(requestedSlug)) return {};
  if (isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug)) && isMydreamshootsRetiredPublicPath(requestedSlug)) return {};
  const legacyPublicTarget = isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug)) ? mydreamshootsLegacyPublicPathTarget(requestedSlug) : undefined;
  if (isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug)) && requestedSlug === MYDREAMSHOOTS_WEDDING_INVITATION_PATH) return weddingInvitationMetadata();
  if (isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug)) && (requestedSlug === MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH || requestedSlug === MYDREAMSHOOTS_WEDDING_INVITATION_RETIRED_PATH)) return {};
  const canonicalRequestedSlug = isSpanishWeddingInvitationCompatibilitySite(siteSlug)
    ? canonicalSaveTheDatePath(legacyPublicTarget ?? requestedSlug)
    : requestedSlug;
  if (isPrimaryMydreamshootsSlug(publicSiteSlug(siteSlug)) && canonicalRequestedSlug === MYDREAMSHOOTS_WEDDING_INVITATION_PATH) return weddingInvitationMetadata();
  const legacyRequestedSlug = isSpanishWeddingInvitationCompatibilitySite(siteSlug)
    ? legacySaveTheDatePath(canonicalRequestedSlug)
    : undefined;
  const isCollectionRequest = isCollectionRouteRequest(path);
  const isVideoGenerationRequest = isVideoGenerationRouteRequest(siteSlug, path);
  const collectionRootPageSlug = fallbackCollectionRootPathForPublicSlug(siteSlug);
  const queryCollectionSlug = typeof metadataQuery.category === "string" ? metadataQuery.category : Array.isArray(metadataQuery.category) ? metadataQuery.category[0] : hintedCollectionSlug;
  const collectionPath = isCollectionRequest && path.length === 1 && queryCollectionSlug ? [...path, queryCollectionSlug] : path;
  const collectionLookupSlug = collectionRouteLookupSlug(collectionPath);
  const videoLookupSlug = isVideoGenerationRequest ? path[1] || "" : "";
  const slug = isCollectionRequest ? collectionRootPageSlug : isVideoGenerationRequest ? "/ai-video-generation" : publicContentPageSlug(canonicalRequestedSlug);
  if (slug === "/account") {
    return { title: isSpanishStorefrontSite({ slug: siteSlug, name: siteSlug, branding: { logoText: siteSlug } }) ? "Cuenta" : "Account", robots: { index: false, follow: false } };
  }
  if (slug === "/login" || slug === "/dashboard" || path[0] === "app") {
    return { title: isSpanishStorefrontSite({ slug: siteSlug, name: siteSlug, branding: { logoText: siteSlug } }) ? "Espacio privado" : "Private workspace", robots: { index: false, follow: false } };
  }
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, siteSlug);
  const isAidreamcapesPromptGuide = publicSiteSlug(siteSlug) === "aidreamcapes" && requestedSlug === "/prompt-guide";
  const metadataSourceSlug = isAidreamcapesPromptGuide
    ? "/workflow"
    : isSpanishWeddingInvitationCompatibilitySite(siteSlug) && canonicalRequestedSlug === MYDREAMSHOOTS_WEDDING_INVITATION_PATH
    ? MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH
    : slug;
  const loadedState = isVideoGenerationRequest
    ? routeMode === "host"
      ? await readRoutePublicRuntimeState(headerStore, routeMode, siteSlug, `/ai-video-generation/${videoLookupSlug || ""}`.replace(/\/$/, ""), videoLookupSlug || undefined)
      : await readVideoGenerationRouteState(siteSlug, videoLookupSlug)
    : isCollectionRequest && collectionLookupSlug
    ? routeMode === "host"
      ? await readRoutePublicRuntimeState(headerStore, routeMode, siteSlug, collectionRootPageSlug, collectionLookupSlug)
      : await readCollectionRouteState(siteSlug, collectionLookupSlug, headerStore, routeMode)
    : slug === "/ai-image-generation"
      ? routeMode === "host"
        ? await readRoutePublicRuntimeState(headerStore, routeMode, siteSlug, "/ai-image-generation")
        : await readPathModePublicRuntimeState(siteSlug, "/ai-image-generation")
      : await readRoutePublicMetadataState(headerStore, routeMode, siteSlug, metadataSourceSlug)
      || (legacyRequestedSlug ? await readRoutePublicMetadataState(headerStore, routeMode, siteSlug, legacyRequestedSlug) : undefined);
  const state = isAidreamcapesPromptGuide ? withAidreamcapesPromptGuidePage(loadedState) : loadedState;
  const site = state?.sites[0];
  if (!site) return {};
  const snapshot = createPublishedSiteSnapshot(state, site, { source: "platform-state" });
  const spanishAliasPath = site.id === "site_mydreamshoots_xby" && isVideoGenerationRequest
    ? aidreamshootsLegacyVideoSaveTheDatePath(`/ai-video-generation/${videoLookupSlug}`)
    : undefined;
  if (spanishAliasPath) {
    const aliasPath = spanishAliasPath;
    // A video alias request loads the legacy video route projection, which
    // intentionally does not include the newer Save the Date page row. Read
    // the canonical page projection before generating metadata so the alias
    // cannot fall through to a misleading 404/empty head.
    const aliasState = routeMode === "host"
      ? await readRoutePublicRuntimeState(headerStore, routeMode, siteSlug, aliasPath)
      : await readPathModePublicRuntimeState(siteSlug, aliasPath);
    const aliasSite = aliasState?.sites[0] ?? site;
    const page = findPage(aliasSite, aliasPath);
    return page
      ? metadataForPublishedStorefrontPage({
          site: aliasSite,
          page,
          path: aliasPath,
          products: aliasState?.products ?? state.products,
          creativePacks: aliasState?.creativePacks ?? state.creativePacks,
          snapshot: createPublishedSiteSnapshot(aliasState ?? state, aliasSite, { source: "platform-state" })
        })
      : {};
  }
  const videoGenerationRoute = isVideoGenerationRequest ? parsePublicVideoGenerationRouteForSite(site, path) : undefined;
  if (isVideoGenerationRequest) {
    if (!videoGenerationRoute) return {};
    if (videoGenerationRoute.itemSlug) {
      const disposition = resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath);
      if (disposition.kind !== "render") return {};
      const page = snapshot.pages.find((candidate) => candidate.id === disposition.pageId);
      return page ? await withAidreamcapesListingPageMetadata(await metadataForPublishedStorefrontDirectoryPage({
        site,
        page,
        kind: "tool",
        directorySlug: videoGenerationRoute.itemSlug,
        path: videoGenerationRoute.canonicalPath,
        products: state.products,
        creativePacks: state.creativePacks,
        snapshot
      }), pathModePublicSlug, requestedSlug, metadataQuery) : {};
    }
    if (resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath).kind !== "render") return {};
    const page = findPage(site, "/ai-video-generation");
    return page ? await withAidreamcapesListingPageMetadata(await metadataForPublishedStorefrontPage({ site, page, products: state.products, creativePacks: state.creativePacks, snapshot }), pathModePublicSlug, requestedSlug, metadataQuery) : {};
  }
  const collectionRoute = isCollectionRequest ? parsePublicCollectionRouteForSite(site, collectionPath) : undefined;
  if (isCollectionRequest && path.length === 2 && path[0] === "ai-image-generation" && isAidreamcapesPathModeSite(pathModePublicSlug)) {
    // Photo template pages share the collection prefix. Read the exact page
    // projection so an existing published page wins over the collection leaf.
    const photoPageSlug = `/${path.join("/")}`;
    const photoPageState = await readPathModePublicRuntimeState(pathModePublicSlug, photoPageSlug);
    const photoPageSite = photoPageState?.sites[0];
    const photoPage = photoPageSite ? findPage(photoPageSite, photoPageSlug) : undefined;
    if (photoPageState && photoPageSite && photoPage) {
      const photoPageSnapshot = createPublishedSiteSnapshot(photoPageState, photoPageSite, { source: "platform-state" });
      if (resolvePublishedRouteDisposition(photoPageSnapshot, photoPageSlug).kind === "render") {
        return metadataForPublishedStorefrontPage({
          site: photoPageSite,
          page: photoPage,
          path: photoPageSlug,
          products: photoPageState.products,
          creativePacks: photoPageState.creativePacks,
          snapshot: photoPageSnapshot
        });
      }
    }
  }
  if (isCollectionRequest) {
    if (!collectionRoute) return {};
    if (collectionRoute.collectionSlug && !isSpanishStorefrontSite(site)) {
      const disposition = resolvePublishedRouteDisposition(snapshot, collectionRoute.canonicalPath);
      const knownLeafRoute = snapshot.publishedRoutes.some((route) => route.disposition === "render" && route.routeKind === "ai-image-theme-leaf" && route.canonicalPath === collectionRoute.canonicalPath);
      if (disposition.kind !== "render" && !knownLeafRoute) return {};
    }
    if (collectionRoute.collectionSlug && !canResolveCollectionSlugForSite(state, site, collectionRoute.collectionSlug)) return {};
    if (resolvePublishedRouteDisposition(snapshot, collectionRootPageSlug).kind !== "render") return {};
    const page = findPage(site, collectionRootPageSlug) ?? findPage(site, "/collections");
    if (collectionRoute.collectionSlug && page) {
      const metadata = await metadataForPublishedStorefrontDirectoryPage({
        site,
        page,
        kind: "collection",
        directorySlug: collectionRoute.collectionSlug,
        path: collectionRoute.canonicalPath,
        products: state.products,
        creativePacks: state.creativePacks,
        snapshot
      });
      if (collectionRoute.collectionSlug === "engagement-photo") {
        const title = "AI Engagement Photos for Proposals & Announcements | myDreamshoots";
        const description = "Create proposal-inspired engagement portraits, announcement images, ring reveal scenes, and romantic couple story photos.";
        return {
          ...metadata,
          title,
          description,
          openGraph: {
            ...(metadata.openGraph ?? {}),
            title,
            description
          },
          twitter: {
            ...(metadata.twitter ?? {}),
            title,
            description
          }
        };
      }
      return metadata;
    }
    return page ? metadataForPublishedStorefrontPage({ site, page, products: state.products, creativePacks: state.creativePacks, snapshot }) : {};
  }
  const resolvedSlug = findPage(site, slug) ? slug : findPage(site, metadataSourceSlug) ? metadataSourceSlug : legacyRequestedSlug && findPage(site, legacyRequestedSlug) ? legacyRequestedSlug : slug;
  if (!canRenderPublishedPublicPath(snapshot, resolvedSlug, requestedSlug, site)) return {};
  const page = findPage(site, resolvedSlug);
  if (!page) return {};
  if (resolvedSlug !== slug && canonicalRequestedSlug !== requestedSlug) {
    const canonicalPage = { ...page, publishedJson: { ...page.publishedJson, seo: { ...page.publishedJson.seo, canonicalPath: canonicalRequestedSlug, canonical: canonicalUrlForSite(site, canonicalRequestedSlug) } } };
    return metadataForPublishedStorefrontPage({ site, page: canonicalPage, products: state.products, creativePacks: state.creativePacks, snapshot });
  }
  return await withAidreamcapesListingPageMetadata(await metadataForPublishedStorefrontPage({ site, page, products: state.products, creativePacks: state.creativePacks, snapshot }), pathModePublicSlug, requestedSlug, metadataQuery);
}

export default async function SiteCatchAllPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string; path: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { siteSlug, path } = await params;
  await assertAidreamcapesPathModeSite(siteSlug);
  const slug = `/${path.join("/")}`;
  const publicSlug = publicSiteSlug(siteSlug);
  const headerStore = await headers();
  const routeMode = storefrontRouteModeForHeaders(headerStore, publicSlug);
  const routeBasePath = routeMode === "path" ? `/site/${publicSlug}` : "";
  await redirectLegacyAidreamcapesTemplateDirectory(publicSlug, slug, routeBasePath);
  await redirectAidreamcapesTemplateFilter(publicSlug, slug, searchParams ? await searchParams : {}, routeBasePath);
  const routePath = (targetPath: string) => storefrontPathForRouteMode(publicSlug, targetPath, routeMode);
  if (slug === "/404") notFound();
  if (isAidreamcapesPathModeSite(publicSlug) && slug === "/partners") {
    const query = searchParams ? await searchParams : {};
    return renderAidreamcapesPartnerProgramPage({ success: query.partner === "success", creditsApplied: query.credits === "applied", creditsIssue: query.credits === "duplicate" ? "duplicate" : query.credits === "limited" ? "limited" : query.credits === "invalid" ? "invalid" : undefined, duplicate: query.partner === "duplicate", limited: query.partner === "limited", invalid: query.partner === "invalid" });
  }
  const mediaDetail = isAidreamcapesPathModeSite(publicSlug) ? parseMediaDetailSegments(path) : undefined;
  if (mediaDetail) {
    // Retired example addresses keep redirecting to their living page even
    // after their owning cards left the relational content.
    const retiredRedirect = retiredMediaPageRedirect(mediaDetail.kind, mediaDetail.slug);
    if (retiredRedirect) permanentRedirect(routePath(retiredRedirect));
    // A current public card owns its detail page. Unmatched slugs fall through
    // to the published content pages and collection routes below.
    const detail = await resolveMediaDetail(mediaDetail.kind, mediaDetail.slug);
    if (detail) {
      return renderAidreamcapesMediaDetailPage({
        kind: mediaDetail.kind,
        slug: mediaDetail.slug,
        basePath: routePath("/"),
        detail
      });
    }
  }
  // Actor detail pages are flat. Legacy gendered addresses redirect to the
  // actor's own name; the stored row renders at that flat public path.
  let actorRenderSlug: string | undefined;
  let actorPublicPath: string | undefined;
  if (isAidreamcapesPathModeSite(publicSlug) && path[0] === "ai-actors") {
    if (path.length === 3) {
      const target = actorFlatRedirectTarget(path);
      if (target) permanentRedirect(routePath(target));
    }
    if (path.length === 2 && isActorDetailSegment(path[1])) {
      const actor = await resolveActorDetail(path[1]);
      if (actor) {
        actorRenderSlug = actor.detailPageSlug;
        actorPublicPath = `/ai-actors/${actor.slug}`;
      }
    }
  }
  if ((isMydreamshootsVideoTopicGroupPathRequest(publicSlug, path) || isMydreamshootsSaveDateTopicGroupPathRequest(publicSlug, path)) && !mydreamshootsTopicGroupForPath(slug)) notFound();
  const imageThemePath = aidreamcapesImageThemePathForRequest(publicSlug, slug);
  if (imageThemePath) {
    const detailState = routeMode === "host"
      ? await readRoutePublicRuntimeState(headerStore, routeMode, publicSlug, imageThemePath)
      : await readPathModePublicRuntimeState(publicSlug, imageThemePath);
    const detailSite = detailState?.sites[0];
    const detailPage = detailSite ? findPage(detailSite, imageThemePath) : undefined;
    if (!detailState || !detailSite || !detailPage || !imageThemeDetailContentFromPage(detailPage)) notFound();
    return renderStorefrontPage({
      site: detailSite,
      slug: imageThemePath,
      publicPath: imageThemePath,
      query: searchParams ? await searchParams : {},
      routeMode,
      state: detailState,
      deferCustomerRuntime: true
    });
  }
  if (isAidreamcapesEuRetiredPublicPath(publicSlug, slug)) notFound();
  if (publicSlug === "aidreamcapes-eu") {
    const canonicalEuPath = canonicalAidreamcapesEuPublicPath(slug);
    if (canonicalEuPath !== slug) permanentRedirect(routePath(canonicalEuPath));
  }
  if (isRetiredAidreamcapesPublicPath(publicSlug, slug)) notFound();
  if (publicSlug === "aidreamcapes" || publicSlug === "aidreamcapes-eu") {
    const legacySaveTheDateTarget = aidreamcapesLegacyVideoSaveTheDatePath(slug);
    if (legacySaveTheDateTarget) permanentRedirect(routePath(legacySaveTheDateTarget));
  }
  if (publicSlug === "aidreamcapes") {
    // Retired paths in the v2 redirect map keep working; a live page row always
    // wins the address.
    const legacyPathTarget = await aidreamcapesMissingPageRedirect(slug);
    if (legacyPathTarget) permanentRedirect(routePath(legacyPathTarget));
  }
  const isSpanishAIdreamshoots = isSpanishAIdreamshootsSlug(publicSlug);
  if ((isPrimaryMydreamshootsSlug(publicSlug) || isSpanishAIdreamshoots) && ["/shipping", "/shipping-policy", "/delivery-policy", "/policies/shipping", "/policies/delivery", "/policies/delivery-policy"].includes(slug)) {
    permanentRedirect(routePath("/digital-delivery"));
  }
  if (isPrimaryMydreamshootsSlug(publicSlug) && isMydreamshootsRetiredPublicPath(slug)) notFound();
  const legacyBlogTarget = isPrimaryMydreamshootsSlug(publicSlug) ? mydreamshootsLegacyBlogPathTarget(slug) : undefined;
  if (legacyBlogTarget && legacyBlogTarget !== slug) permanentRedirect(routePath(legacyBlogTarget));
  const mydreamLegacyTarget = isPrimaryMydreamshootsSlug(publicSlug) ? mydreamshootsLegacyPublicPathTarget(slug) : undefined;
  if (isPrimaryMydreamshootsSlug(publicSlug) && (slug === MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH || slug === MYDREAMSHOOTS_WEDDING_INVITATION_RETIRED_PATH)) notFound();
  const legacyVideoTarget = mydreamshootsLegacyVideoPathTarget(slug);
  if (isPrimaryMydreamshootsSlug(publicSlug) && legacyVideoTarget) permanentRedirect(routePath(legacyVideoTarget));
  if (isPrimaryMydreamshootsSlug(publicSlug) && slug === "/ai-image-generation/profile-cards") {
    permanentRedirect(routePath("/ai-image-generation/avatar"));
  }
  if (isPrimaryMydreamshootsSlug(publicSlug) && slug === "/ai-image-generation/social-cards") {
    permanentRedirect(routePath("/ai-image-generation"));
  }
  if (isPrimaryMydreamshootsSlug(publicSlug) && (slug.startsWith("/holidays-events/") || slug === "/ai-video-generation/wedding-ceremony")) {
    const canonicalPath = canonicalSaveTheDatePath(slug);
    if (canonicalPath !== slug) permanentRedirect(routePath(canonicalPath));
  }
  const legacyAliasTarget = legacyPublicPathTarget(slug, fallbackCollectionRootPathForPublicSlug(publicSlug));
  if (legacyAliasTarget && (slug === "/engagement-photo" || slug === "/collections/engagement-photo" || slug === "/collections/headshot")) {
    permanentRedirect(routePath(legacyAliasTarget));
  }
  if (slug === "/help" && isSpanishAIdreamshootsSlug(publicSlug)) permanentRedirect(routePath("/faq"));
  if (slug === "/how-it-works" && isSpanishAIdreamshootsSlug(publicSlug)) permanentRedirect(routePath("/workflow"));
  const aidreamcapesBlogRedirect = aidreamcapesLegacyBlogRedirectPath(publicSlug, slug);
  if (aidreamcapesBlogRedirect && aidreamcapesBlogRedirect !== slug) permanentRedirect(routePath(aidreamcapesBlogRedirect));
  if (isAidreamcapesPathModeSite(publicSlug) && slug === "/checkout") {
    const query = searchParams ? await searchParams : {};
    const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
    const routeBasePath = routePath("/");
    return renderAidreamcapesCheckoutPage({ plan: first(query.plan), term: first(query.term), pack: first(query.pack), basePath: routeBasePath === "/" ? "" : routeBasePath });
  }
  if (slug === "/checkout") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams ? await searchParams : {})) {
      if (typeof value === "string") query.set(key, value);
      else if (Array.isArray(value)) {
        for (const item of value) query.append(key, item);
      }
    }
    redirect(`${routePath("/cart")}${query.size ? `?${query.toString()}` : ""}`);
  }
  if (slug === "/workspace") {
    const query = searchParams ? await searchParams : {};
    redirect(`${routePath("/app/create")}${searchParamsSuffix(query)}`);
  }
  if (slug === "/tool") {
    if (isPrimaryMydreamshootsSlug(publicSlug)) notFound();
    redirect(routePath("/tools"));
  }
  if ((publicSlug === "aidreamcapes" || publicSlug === "aidreamcapes-eu") && slug === "/collections") permanentRedirect(routePath("/ai-image-generation"));
  if (publicSlug === "aidreamcapes" && slug === "/tools") permanentRedirect(routePath("/ai-video-generation"));
  if (slug === "/dashboard") {
    redirect(routePath("/app/create"));
  }
  if (slug === "/account") {
    const query = searchParams ? await searchParams : {};
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug, query, routeMode });
  }
  if (path[0] === "app") {
    if (slug === "/app") redirect(routePath("/app/create"));
    let query = searchParams ? await searchParams : {};
    if ((publicSlug === "aidreamcapes" || publicSlug === "aivideosugc") && path[1] === "create") {
      // Legacy query links are permanent redirects to their fixed paths.
      if (slug === "/app/create" && Object.keys(query).length) {
        const staticPath = legacyCreateHrefToStatic(`/app/create?${new URLSearchParams(Object.entries(query).flatMap(([k, v]) => Array.isArray(v) ? v.map((item) => [k, String(item)] as [string, string]) : [[k, String(v)]]))}`);
        if (staticPath) permanentRedirect(routePath(staticPath));
      }
      if (path.length >= 3) {
        const legacyStaticPath = legacyStaticCreateRedirect(path.slice(2));
        if (legacyStaticPath) permanentRedirect(routePath(legacyStaticPath) + searchParamsSuffix(query));
        const staticTarget = parseStaticCreateSegments(path.slice(2));
        if (staticTarget) {
          query = { ...query, ...staticCreateQuery(staticTarget) };
          // Aidreamcapes uses one workspace for guests and signed-in customers.
          // The workspace renderer resolves the customer and authenticated catalog.
          return renderAidreamcapesCreatePage({ query, siteSlug: publicSlug });
        } else if (!["scene"].includes(path[2] ?? "")) notFound();
      }
    }
    const videoMode = Array.isArray(query.videoMode) ? query.videoMode[0] : query.videoMode;
    if (videoMode === "text-to-video" || videoMode === "image-to-video") notFound();
    return renderCustomerWorkspacePageBySlug({ siteSlug: publicSlug, slug, query, routeMode });
  }
  if (path[0] === "job" && path[1]) redirect(routePath(`/app/jobs/${path[1]}`));
  if (path[0] === "tools" && path[1] && (isPrimaryMydreamshootsSlug(publicSlug) || isAidreamshootsStorefrontSite({ slug: publicSlug }))) notFound();
  const isCollectionRequest = isCollectionRouteRequest(path);
  const isVideoGenerationRequest = isVideoGenerationRouteRequest(siteSlug, path);
  const collectionRootPageSlug = fallbackCollectionRootPathForPublicSlug(publicSlug);
  const collectionLookupSlug = collectionRouteLookupSlug(path);
  const videoLookupSlug = isVideoGenerationRequest ? path[1] || "" : "";
  const query = {
    ...(searchParams ? await searchParams : {}),
  };
  const legacyPathTarget = legacyPublicPathTarget(slug, collectionRootPageSlug);
  const pageSlug = isCollectionRequest ? collectionRootPageSlug : isVideoGenerationRequest ? "/ai-video-generation" : mydreamLegacyTarget ?? (legacyPathTarget ? publicContentPageSlug(legacyPathTarget) : publicContentPageSlug(canonicalSaveTheDatePath(slug)));
  const legacySaveDateSlug = isPrimaryMydreamshootsSlug(publicSlug) ? legacySaveTheDatePath(pageSlug) : undefined;
  const isAidreamcapesPromptGuide = publicSlug === "aidreamcapes" && slug === "/prompt-guide";
  const sourcePageSlug = actorRenderSlug ?? (isAidreamcapesPromptGuide
    ? "/workflow"
    : isSpanishWeddingInvitationCompatibilitySite(publicSlug) && slug === MYDREAMSHOOTS_WEDDING_INVITATION_PATH
    ? MYDREAMSHOOTS_WEDDING_INVITATION_SOURCE_PATH
    : pageSlug);
  // Photo template pages share the /ai-image-generation prefix with the
  // collection directory. Resolve the exact published page from its own
  // projection before the collection route can shadow it.
  if (isAidreamcapesPathModeSite(publicSlug) && path.length === 2 && path[0] === "ai-image-generation" && PUBLIC_SCENE_SLUG_RE.test(path[1])) {
    const photoPageSlug = `/${path.join("/")}`;
    const photoPageState = routeMode === "host"
      ? await readRoutePublicRuntimeState(headerStore, routeMode, publicSlug, photoPageSlug)
      : await readPathModePublicRuntimeState(publicSlug, photoPageSlug);
    const photoPageSite = photoPageState?.sites[0];
    const photoPage = photoPageSite ? findPage(photoPageSite, photoPageSlug) : undefined;
    if (photoPageState && photoPageSite && photoPage) {
      const photoPageSnapshot = createPublishedSiteSnapshot(photoPageState, photoPageSite, { source: "platform-state" });
      if (resolvePublishedRouteDisposition(photoPageSnapshot, photoPageSlug).kind === "render") {
        return renderStorefrontPage({
          site: photoPageSite,
          slug: photoPageSlug,
          publicPath: photoPageSlug,
          query,
          routeMode,
          state: photoPageState,
          deferCustomerRuntime: true
        });
      }
    }
  }
  const loadedState = isVideoGenerationRequest
    ? await readVideoGenerationRouteState(publicSlug, videoLookupSlug)
    : isCollectionRequest && collectionLookupSlug
    ? await readCollectionRouteState(publicSlug, collectionLookupSlug, headerStore, routeMode)
    : isAidreamcapesPromptGuide
      ? await readRoutePublicRuntimeState(headerStore, routeMode, publicSlug, "/workflow")
      : await readPathModePublicRuntimeState(publicSlug, sourcePageSlug)
      || (legacySaveDateSlug ? await readPathModePublicRuntimeState(publicSlug, legacySaveDateSlug) : undefined);
  const state = isAidreamcapesPromptGuide ? withAidreamcapesPromptGuidePage(loadedState) : loadedState;
  const publicSite = state?.sites[0];
  if (!state || !publicSite) notFound();
  const topicGroup = mydreamshootsTopicGroupForPath(slug);
  if (isPrimaryMydreamshootsSlug(publicSlug) && topicGroup && !isMydreamshootsTopicGroupActive(state, publicSite.id, topicGroup)) notFound();
  if (isPrimaryMydreamshootsSlug(publicSlug) && isVideoGenerationRequest && ["text-to-video", "image-to-video"].includes(path[1] ?? "")) {
    notFound();
  }
  const snapshot = createPublishedSiteSnapshot(state, publicSite, { source: "platform-state" });
  // The flat actor address has no published route row of its own; it renders
  // the stored actor page and must resolve before the published checks.
  if (actorRenderSlug && actorPublicPath) {
    return renderStorefrontPage({
      site: publicSite,
      slug: actorRenderSlug,
      publicPath: actorPublicPath,
      query,
      routeMode,
      state,
      deferCustomerRuntime: true
    });
  }
  // The Spanish storefront has a published standard-content page at the
  // canonical Save the Date URL. Only the primary myDreamshoots site needs
  // the legacy ai_tool compatibility projection.
  const spanishVideoAliasPath = isSpanishAIdreamshoots && isVideoGenerationRequest
    ? aidreamshootsLegacyVideoSaveTheDatePath(`/ai-video-generation/${videoLookupSlug}`)
    : undefined;
  if (spanishVideoAliasPath) {
    const aliasPath = spanishVideoAliasPath;
    // Seasonal video URLs are aliases of the Save the Date pages. They must
    // not render a second indexable document with a different canonical.
    permanentRedirect(routePath(aliasPath));
  }
  const publishedDisposition = resolvePublishedRouteDisposition(snapshot, slug);
  if (publishedDisposition.kind === "redirect" && publishedDisposition.targetPath) permanentRedirect(routePath(publishedDisposition.targetPath));
  const legacyTarget = legacyPublicPathTarget(slug, fallbackCollectionRootPathForPublicSlug(publicSlug));
  // Keep a published seasonal page canonical when it exists. The legacy
  // redirect is only a recovery path for publications that are missing the
  // old navigation URL, so a normal published route must still render 200.
  if (legacyTarget) {
    const disposition = resolvePublishedRedirectDisposition(snapshot, slug, legacyTarget);
    if (disposition.kind === "redirect" && disposition.targetPath) permanentRedirect(routePath(disposition.targetPath));
    notFound();
  }
  const videoGenerationRoute = isVideoGenerationRequest ? parsePublicVideoGenerationRouteForSite(publicSite, path) : undefined;
  if (isVideoGenerationRequest) {
    if (!videoGenerationRoute) notFound();
    if (videoGenerationRoute.itemSlug) {
      const disposition = resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath);
      const detailPage = disposition.kind === "render"
        ? snapshot.pages.find((candidate) => candidate.id === disposition.pageId)
        : undefined;
      if (!detailPage) notFound();
      return renderToolPage({
        site: publicSite,
        toolSlug: videoGenerationRoute.itemSlug,
        publicPath: videoGenerationRoute.canonicalPath,
        query,
        routeMode,
        state,
        resolvedPage: detailPage
      });
    }
    if (resolvePublishedRouteDisposition(snapshot, videoGenerationRoute.canonicalPath).kind !== "render") notFound();
    return renderStorefrontPage({ site: publicSite, slug: "/ai-video-generation", publicPath: videoGenerationRoute.canonicalPath, query, routeMode, state, deferCustomerRuntime: true });
  }
  const collectionRoute = isCollectionRequest ? parsePublicCollectionRouteForSite(publicSite, path) : undefined;
  if (isCollectionRequest && !collectionRoute) notFound();
  const collectionCategory = collectionRoute?.collectionSlug ?? "";
  const storefrontQuery = {
    ...query,
    ...(collectionCategory ? { category: collectionCategory } : {})
  };
  if (collectionRoute) {
    if (resolvePublishedRouteDisposition(snapshot, collectionRootPageSlug).kind !== "render") notFound();
    if (collectionRoute.collectionSlug && !isSpanishStorefrontSite(publicSite)) {
      const disposition = resolvePublishedRouteDisposition(snapshot, collectionRoute.canonicalPath);
      const knownLeafRoute = snapshot.publishedRoutes.some((route) => route.disposition === "render" && route.routeKind === "ai-image-theme-leaf" && route.canonicalPath === collectionRoute.canonicalPath);
      if (disposition.kind !== "render" && !knownLeafRoute) notFound();
    }
    const canonicalCollectionPath = canonicalSeoDirectoryPathForSite(publicSite, "collection", collectionRoute.collectionSlug);
    if (canonicalCollectionPath !== collectionRoute.canonicalPath || canonicalCollectionPath !== slug) {
      permanentRedirect(routePath(canonicalCollectionPath));
    }
  }
  if (collectionCategory && !canResolveCollectionSlugForSite(state, publicSite, collectionCategory)) notFound();
  // During the route migration the draft site may already have the canonical
  // slug while the immutable publication still stores its legacy slug. Pick
  // the published page that actually exists, then expose the canonical URL.
  const resolvedPageSlug = !isCollectionRequest && !findPage(snapshot.site, pageSlug) && sourcePageSlug && findPage(snapshot.site, sourcePageSlug)
    ? sourcePageSlug
    : pageSlug;
  if (!isCollectionRequest && !canRenderPublishedPublicPath(snapshot, resolvedPageSlug, slug, publicSite)) notFound();
  if (!isCollectionRequest && !findPage(publicSite, resolvedPageSlug) && resolvePublishedRouteDisposition(snapshot, resolvedPageSlug).kind !== "render") notFound();
  const publicPath = collectionRoute?.canonicalPath ?? (isPrimaryMydreamshootsSlug(publicSlug) && slug === "/digital-delivery" ? "/digital-delivery" : publicContentPageSlug(slug));
  return renderStorefrontPage({ site: publicSite, slug: resolvedPageSlug, publicPath: canonicalSaveTheDatePath(publicPath), query: storefrontQuery, routeMode, state, deferCustomerRuntime: resolvedPageSlug !== "/cart" });
}
