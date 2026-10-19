import { permanentRedirect } from "next/navigation";
import { PUBLIC_SCENE_SLUG_RE } from "@/lib/aidreamcapes-workspace/preset-contract";

export const dynamic = "force-dynamic";

export default async function AidreamcapesVideoSceneRedirectPage({ params }: {
  params: Promise<{ sceneSlug: string }>;
}) {
  const { sceneSlug } = await params;
  if (PUBLIC_SCENE_SLUG_RE.test(sceneSlug)) permanentRedirect(`/site/aidreamcapes/ai-video-generation/${sceneSlug}`);
  permanentRedirect("/site/aidreamcapes/ai-video-generation");
}
