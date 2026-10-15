import { aidreamcapesWorkspaceMetadata, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";

export const metadata = { ...aidreamcapesWorkspaceMetadata, title: "Inspirations | AIVideosUGC" };
export const dynamic = "force-dynamic";

export default async function AidreamcapesWorkspaceInspirationsPage() {
  return renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", initialView: "inspirations" });
}
