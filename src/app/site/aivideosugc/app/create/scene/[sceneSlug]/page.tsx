import { permanentRedirect, notFound } from "next/navigation";
import { headers } from "next/headers";
import { aidreamcapesWorkspaceMetadata, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { resolveWorkspaceScenePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import { workspaceMediaRoutePath } from "@/lib/aidreamcapes-workspace/preset-contract";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";

export const metadata = aidreamcapesWorkspaceMetadata;
export const dynamic = "force-dynamic";

export default async function AIVideosUGCSceneCreatePage({ params }: {
  params: Promise<{ sceneSlug: string }>;
}) {
  const { sceneSlug } = await params;
  const preset = await resolveWorkspaceScenePreset(AIVIDEOSUGC_SITE_ID, sceneSlug);
  if (!preset) notFound();
  const mediaPath = workspaceMediaRoutePath(preset.kind, preset.publicSlug);
  if (mediaPath) {
    const requestHeaders = await headers();
    const host = (requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
    const hostMode = /(^|\.)(?:www\.)?(?:aivideosugc\.com|aidreamcapes\.com)$/.test(host) || host.endsWith(".localhost");
    permanentRedirect(`${hostMode ? "" : "/site/aivideosugc"}${mediaPath}`);
  }
  return renderAidreamcapesWorkspace({
    routeSlug: "aivideosugc",
    resolvedPreset: preset,
    sceneRouteSlug: sceneSlug,
    initialView: preset.kind === "photo" ? "images" : "agent",
  });
}
