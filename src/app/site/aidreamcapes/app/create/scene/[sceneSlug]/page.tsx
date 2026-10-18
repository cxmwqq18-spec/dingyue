import { notFound } from "next/navigation";
import { aidreamcapesWorkspaceMetadata, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { resolveWorkspaceScenePreset } from "@/lib/aidreamcapes-workspace/presets.server";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";

export const metadata = aidreamcapesWorkspaceMetadata;
export const dynamic = "force-dynamic";

export default async function AidreamcapesSceneCreatePage({ params }: {
  params: Promise<{ sceneSlug: string }>;
}) {
  const { sceneSlug } = await params;
  const preset = await resolveWorkspaceScenePreset(AIVIDEOSUGC_SITE_ID, sceneSlug);
  if (!preset) notFound();
  return renderAidreamcapesWorkspace({
    routeSlug: "aidreamcapes",
    resolvedPreset: preset,
    sceneRouteSlug: sceneSlug,
    initialView: preset.kind === "photo" ? "images" : "agent",
  });
}
