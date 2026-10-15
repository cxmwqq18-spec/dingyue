import { aidreamcapesWorkspaceMetadata, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";

export const metadata = aidreamcapesWorkspaceMetadata;
export const dynamic = "force-dynamic";

export default async function AIVideosUGCWorkspacePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const taskId = typeof query.task === "string" ? query.task : undefined;
  return renderAidreamcapesWorkspace({ routeSlug: "aivideosugc", taskId });
}
