import { aidreamcapesWorkspaceEntry, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { AidreamcapesInspirationsPage } from "@/components/storefront/aidreamcapes-inspirations-page";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";
import { resolveWorkspacePublicScenePreset, resolveWorkspaceScenePreset, resolveWorkspaceLegacyTemplatePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import { workspaceMediaRoutePath } from "@/lib/aidreamcapes-workspace/preset-contract";
import { inspirationCreateHref, inspirationCreateTarget } from "@/lib/aidreamcapes-inspirations-types";
import {
  AIDREAMCAPES_INSPIRATIONS_SITE_SLUG,
  getAidreamcapesInspirationCards
} from "@/lib/aidreamcapes-inspirations";

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
      createHref: inspirationCreateHref(card, basePath), entry: inspirationCreateTarget(card, basePath).transfer,
    }))}
    basePath={basePath}
    initialKind={kind}
    initialCategory={typeof query.category === "string" ? query.category : "All"}
    initialQuery={typeof query.q === "string" ? query.q.slice(0, 180) : ""}
  />;
}
