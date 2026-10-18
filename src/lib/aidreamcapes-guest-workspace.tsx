import { aidreamcapesWorkspaceEntry, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { AidreamcapesInspirationsPage } from "@/components/storefront/aidreamcapes-inspirations-page";
import { headers } from "next/headers";
import { notFound, permanentRedirect } from "next/navigation";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";
import { resolveWorkspacePublicScenePreset, resolveWorkspaceScenePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import { workspaceMediaRoutePath } from "@/lib/aidreamcapes-workspace/preset-contract";
import {
  AIDREAMCAPES_INSPIRATIONS_SITE_ID,
  AIDREAMCAPES_INSPIRATIONS_SITE_SLUG,
  getAidreamcapesInspirationCards
} from "@/lib/aidreamcapes-inspirations";

// Server-side entry points for Aidreamcapes guest workspace and inspiration
// routes. Guests receive the complete workspace shell and public catalog; task,
// asset, account, and generation operations remain customer-authenticated.

type GuestRouteQuery = Record<string, string | string[] | undefined>;

export async function renderAidreamcapesGuestCreatePage({ query = {} }: {
  query?: GuestRouteQuery;
  siteSlug: string;
}) {
  const entry = aidreamcapesWorkspaceEntry(query);
  return renderAidreamcapesWorkspace({
    routeSlug: "aidreamcapes",
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

export async function renderAidreamcapesPublicSceneCreatePage({ kind, publicSlug, routeSlug = "aidreamcapes" }: {
  kind: "photo" | "video";
  publicSlug: string;
  routeSlug?: "aivideosugc" | "aidreamcapes";
}) {
  const preset = await resolveWorkspacePublicScenePreset(AIVIDEOSUGC_SITE_ID, kind, publicSlug);
  if (!preset) notFound();
  return renderAidreamcapesWorkspace({
    routeSlug,
    resolvedPreset: preset,
    sceneRoutePath: `/${kind === "photo" ? "images" : "videos"}/${publicSlug}`,
    initialView: kind === "photo" ? "images" : "agent"
  });
}

export async function renderAidreamcapesInspirationsPage({ siteSlug, basePath = "" }: {
  query?: GuestRouteQuery;
  siteSlug: string;
  basePath?: string;
}) {
  const cards = siteSlug === AIDREAMCAPES_INSPIRATIONS_SITE_SLUG ? await getAidreamcapesInspirationCards() : [];
  return <AidreamcapesInspirationsPage cards={cards} basePath={basePath} />;
}
