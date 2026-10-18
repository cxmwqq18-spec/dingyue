import { renderAidreamcapesPublicSceneCreatePage } from "@/lib/aidreamcapes-guest-workspace";
import { aidreamcapesWorkspaceMetadata } from "@/lib/aidreamcapes-workspace/page";

export const metadata = aidreamcapesWorkspaceMetadata;
export const dynamic = "force-dynamic";

export default async function AidreamcapesVideoScenePage({ params }: {
  params: Promise<{ sceneSlug: string }>;
}) {
  const { sceneSlug } = await params;
  return renderAidreamcapesPublicSceneCreatePage({ kind: "video", publicSlug: sceneSlug, routeSlug: "aidreamcapes" });
}
