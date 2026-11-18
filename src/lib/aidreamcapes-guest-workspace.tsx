import { aidreamcapesWorkspaceEntry, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { AidreamcapesMediaDetailPage } from "@/components/storefront/aidreamcapes-v2/media-detail";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import type { Metadata } from "next";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";
import { resolveWorkspacePublicScenePreset, resolveWorkspaceScenePreset, resolveWorkspaceLegacyTemplatePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import { workspaceMediaRoutePath } from "@/lib/aidreamcapes-workspace/preset-contract";
import { MEDIA_DETAIL_PUBLIC_ORIGIN, mediaDetailDescription, mediaDetailTitle, type MediaDetailKind } from "@/lib/aidreamcapes-workspace/media-detail";
import { loadAidreamcapesChrome, resolveMediaDetail } from "@/lib/aidreamcapes-workspace/media-detail.server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { resolveMediaPlacements } from "@/lib/aidreamcapes-workspace/media-placement.server";
import type { AidreamcapesV2Navigation } from "@/lib/types";
import { aidreamcapesV2Company } from "@/components/storefront/aidreamcapes-v2/company";

/** Site-relative links gain the path-mode prefix; assets and absolute URLs do not. */
function publicResolvers(basePath: string) {
  // A host-mode store has no path prefix. "/" is the site root, not a prefix,
  // so it must never be prepended to another absolute path.
  const prefix = basePath === "/" ? "" : basePath;
  const href = (value: string) => {
    if (!value) return prefix || "/";
    if (/^(?:[a-z]+:|\/\/)/i.test(value) || value.startsWith("#")) return value;
    if (prefix && value.startsWith(`${prefix}/`)) return value;
    return value.startsWith("/") ? `${prefix}${value}` : value;
  };
  return { href, asset: (value: string) => value };
}

// Server-side entry points for Aidreamcapes workspace and inspiration
// routes. Guests receive the complete workspace shell and public catalog; task,
// asset, account, and generation operations remain customer-authenticated.

type GuestRouteQuery = Record<string, string | string[] | undefined>;

export async function renderAidreamcapesCreatePage({ query = {}, siteSlug, defaultView = "agent" }: {
  query?: GuestRouteQuery;
  siteSlug: string;
  // Plain workspace entries open the Home module; deep links keep their own view.
  defaultView?: "home" | "agent";
}) {
  const entry = aidreamcapesWorkspaceEntry(query);
  const resolvedPreset = !entry.taskId && !entry.presetRequest && typeof query.tool === "string" && typeof query.template === "string"
    ? await resolveWorkspaceLegacyTemplatePreset(query.tool, query.template) : undefined;
  return renderAidreamcapesWorkspace({
    resolvedPreset,
    routeSlug: siteSlug === "aivideosugc" ? "aivideosugc" : "aidreamcapes",
    ...entry,
    initialView: entry.initialView ?? defaultView
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
  const [detail, chrome, customer] = await Promise.all([
    provided ? Promise.resolve(provided) : resolveMediaDetail(kind, slug),
    loadAidreamcapesChrome(),
    getCurrentCustomerForSite(AIVIDEOSUGC_SITE_ID),
  ]);
  if (!detail || !chrome) notFound();
  if (detail.slug !== slug) permanentRedirect(`${basePath === "/" ? "" : basePath}${detail.path}`);
  const placements = await resolveMediaPlacements(detail);
  // Signed-in visitors get the same header account menu as the homepage;
  // signed-out visitors keep the static login and get-started actions.
  const prefix = basePath === "/" ? "" : basePath;
  const headerAccount = customer ? { href: `${prefix}/account`, label: "My account" } : undefined;
  const headerCustomer = customer
    ? {
        balance: customer.customer.balance,
        email: customer.customer.email,
        name: customer.customer.name,
        profile: customer.customer.profile
      }
    : undefined;
  return (
    <AidreamcapesMediaDetailPage
      detail={detail}
      headerAccount={headerAccount}
      headerCustomer={headerCustomer}
      navigation={chrome.navigation as AidreamcapesV2Navigation}
      r={publicResolvers(basePath)}
      siteId={AIVIDEOSUGC_SITE_ID}
      company={aidreamcapesV2Company(chrome.identity)}
      articles={chrome.articles}
      articlesTitle={chrome.articlesTitle}
      placements={placements}
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
    description: mediaDetailDescription(detail.card, detail.kind),
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      // A video-kind card whose video file is missing renders as a still
      // example (image hero, no player). Claiming video.other there made
      // Google keep a video record for a page with no video at all — the
      // "video URL: N/A" rows in the video indexing report. The claim follows
      // the actual file, so re-attaching the video restores it automatically.
      type: detail.kind === "video" && detail.card.video?.src ? "video.other" : "website",
      title,
      description: mediaDetailDescription(detail.card, detail.kind),
      url: canonical,
      images: [{ url: new URL(detail.card.image.src, MEDIA_DETAIL_PUBLIC_ORIGIN).href, alt: detail.card.image.alt || title }],
    },
  };
}

/** Keep live actor copy and indexing settings, replacing only the public URL. */
export function aidreamcapesActorPublicMetadata(metadata: Metadata, path: string): Metadata {
  const canonical = new URL(path, MEDIA_DETAIL_PUBLIC_ORIGIN).href;
  return {
    ...metadata,
    alternates: { ...metadata.alternates, canonical },
    openGraph: { ...metadata.openGraph, url: canonical },
  };
}
