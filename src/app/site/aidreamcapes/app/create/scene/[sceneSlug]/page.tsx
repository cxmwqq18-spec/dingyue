import { aidreamcapesWorkspaceMetadata } from "@/lib/aidreamcapes-workspace/page";
import { renderAidreamcapesSceneCreatePage } from "@/lib/aidreamcapes-guest-workspace";

export const metadata = aidreamcapesWorkspaceMetadata;
export const dynamic = "force-dynamic";

export default async function AidreamcapesSceneCreatePage({ params }: {
  params: Promise<{ sceneSlug: string }>;
}) {
  const { sceneSlug } = await params;
  return renderAidreamcapesSceneCreatePage({ sceneRouteSlug: sceneSlug, routeSlug: "aidreamcapes" });
}
