import { aidreamcapesWorkspaceEntry, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { AidreamcapesInspirationsPage } from "@/components/storefront/aidreamcapes-inspirations-page";
import { AidreamcapesMediaDetailPage } from "@/components/storefront/aidreamcapes-v2/media-detail";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";
import { resolveWorkspacePublicScenePreset, resolveWorkspaceScenePreset, resolveWorkspaceLegacyTemplatePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import { workspaceMediaRoutePath } from "@/lib/aidreamcapes-workspace/preset-contract";
import { MEDIA_DETAIL_PUBLIC_ORIGIN, mediaDetailDescription, mediaDetailTitle, type MediaDetailKind } from "@/lib/aidreamcapes-workspace/media-detail";
import { loadAidreamcapesChrome, resolveMediaDetail } from "@/lib/aidreamcapes-workspace/media-detail.server";
import type { AidreamcapesV2Navigation } from "@/lib/types";
import { inspirationExampleLinks } from "@/lib/aidreamcapes-inspirations-types";
import {
  AIDREAMCAPES_INSPIRATIONS_SITE_SLUG,
  getAidreamcapesInspirationCards
} from "@/lib/aidreamcapes-inspirations";

/** Site-relative links gain the path-mode prefix; assets and absolute URLs do not. */
function publicResolvers(basePath: string) {
  const href = (value: string) => {
    if (!value) return basePath || "/";
    if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.startsWith("#")) return value;
    if (basePath && value.startsWith(`${basePath}/`)) return value;
    return value.startsWith("/") ? `${basePath}${value}` : value;
  };
  return { href, asset: (value: string) => value };
}

// Server-side entry points for Aidreamcapes workspace and inspiration
// routes. Guests receive the complete workspace shell and public catalog; task,
// asset, account, and generation operations remain customer-authenticated.

type GuestRouteQuery = Record<string, string | string[] | undefined>;

export async function renderAidreamcapesCreatePage({ query = {}, siteSlug }: {
  query?: GuestRouteQuery;
  siteSlug: string;
}) {
  const entry = aidreamcapesWorkspaceEntry(query);
  const resolvedPreset = !entry.taskId && !entry.presetRequest && typeof query.tool === "string" && typeof query.template === "string"
    ? await resolveWorkspaceLegacyTemplatePreset(query.tool, query.template) : undefined;
  return renderAidreamcapesWorkspace({
    resolvedPreset,
    routeSlug: siteSlug === "aivideosugc" ? "aivideosugc" : "aidreamcapes",
    ...entry,
    initialView: entry.initialView ?? "agent"
  });
}

export async function renderAidreamcapesSceneCreatePage({ sceneRouteSlug, routeSlug = "aidreamcapes" }: {
  sceneRouteSlug: string;
  routeSlug?: "aivideosugc" | "aidreamcapes";
}) {
  const preset = await resolveWorkspaceScenePreset(AIVIDEOSUGC_SITE_ID, sceneRouteSlug);
  if (!preset) notFound();
  const mediaPath = workspaceMediaRoutePath(preset.kind, preset.publicSlug);
  if (mediaPath) {
    const headerStore = await headers();
    const host = (headerStore.get("x-forwarded-host") ?? headerStore.get("host") ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
    const hostMode = ["www.aivideosugc.com", "aivideosugc.com", "www.aidreamcapes.com", "aidreamcapes.com"].includes(host);
    permanentRedirect(`${hostMode ? "" : `/site/${routeSlug}`}${mediaPath}`);
  }
  return renderAidreamcapesWorkspace({
    routeSlug,
    resolvedPreset: preset,
    sceneRouteSlug,
    initialView: preset.kind === "photo" ? "images" : "agent"
  });
}

export function renderAidreamcapesResolvedScenePage({ kind, preset, routeSlug = "aidreamcapes" }: {
  kind: "photo" | "video";
  preset: NonNullable<Awaited<ReturnType<typeof resolveWorkspacePublicScenePreset>>>;
  routeSlug?: "aivideosugc" | "aidreamcapes";
}) {
  return renderAidreamcapesWorkspace({
    routeSlug,
    resolvedPreset: preset,
    sceneRoutePath: `/${kind === "photo" ? "ai-image-generation" : "ai-video-generation"}/${preset.publicSlug}`,
    initialView: kind === "photo" ? "images" : "agent"
  });
}

export async function renderAidreamcapesPublicSceneCreatePage({ kind, publicSlug, routeSlug = "aidreamcapes" }: {
  kind: "photo" | "video";
  publicSlug: string;
  routeSlug?: "aivideosugc" | "aidreamcapes";
}) {
  const preset = await resolveWorkspacePublicScenePreset(AIVIDEOSUGC_SITE_ID, kind, publicSlug);
  if (!preset) notFound();
  return renderAidreamcapesResolvedScenePage({ kind, preset, routeSlug });
}

/**
 * Public media detail page: the card's own page, rendered from its current
 * LivePage row. The workspace is reachable only through the page CTA.
 */
export async function renderAidreamcapesMediaDetailPage({ kind, slug, basePath = "", detail: provided }: {
  kind: MediaDetailKind;
  slug: string;
  basePath?: string;
  detail?: Awaited<ReturnType<typeof resolveMediaDetail>>;
}) {
  const [detail, chrome] = await Promise.all([provided ? Promise.resolve(provided) : resolveMediaDetail(kind, slug), loadAidreamcapesChrome()]);
  if (!detail || !chrome) notFound();
  return (
    <AidreamcapesMediaDetailPage
      detail={detail}
      navigation={chrome.navigation as AidreamcapesV2Navigation}
      r={publicResolvers(basePath)}
    />
  );
}

/** Metadata for a public media detail page; derived cards are not indexed yet. */
export async function aidreamcapesMediaDetailMetadata({ kind, slug }: {
  kind: MediaDetailKind;
  slug: string;
  basePath?: string;
}): Promise<Metadata | undefined> {
  const detail = await resolveMediaDetail(kind, slug);
  if (!detail) return undefined;
  const title = mediaDetailTitle(detail.card);
  const canonical = `${MEDIA_DETAIL_PUBLIC_ORIGIN}${detail.path}`;
  return {
    title: `${title} | AIVideosUGC`,
    description: mediaDetailDescription(detail.card),
    alternates: { canonical },
    robots: { index: false, follow: true },
    openGraph: {
      type: detail.kind === "video" ? "video.other" : "website",
      title,
      description: mediaDetailDescription(detail.card),
      url: canonical,
      images: [{ url: new URL(detail.card.image.src, MEDIA_DETAIL_PUBLIC_ORIGIN).href, alt: detail.card.image.alt || title }],
    },
  };
}

export async function renderAidreamcapesInspirationsPage({ siteSlug, basePath = "", query = {} }: {
  query?: GuestRouteQuery;
  siteSlug: string;
  basePath?: string;
}) {
  if (siteSlug !== AIDREAMCAPES_INSPIRATIONS_SITE_SLUG) notFound();
  const cards = await getAidreamcapesInspirationCards();
  const kind = query.kind === "video" || query.kind === "photo" ? query.kind : "all";
  return <AidreamcapesInspirationsPage
    cards={cards.map((card) => ({
      id: card.id,
      label: card.label,
      imageSrc: card.imageSrc,
      imageAlt: card.imageAlt,
      pageTitle: card.pageTitle,
      kind: card.kind,
      description: card.description,
      category: card.category,
      ...inspirationExampleLinks(card, basePath),
    }))}
    basePath={basePath}
    initialKind={kind}
    initialCategory={typeof query.category === "string" ? query.category : "All"}
    initialQuery={typeof query.q === "string" ? query.q.slice(0, 180) : ""}
  />;
}
