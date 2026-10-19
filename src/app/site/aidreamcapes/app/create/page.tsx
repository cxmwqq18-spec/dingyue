import { aidreamcapesWorkspaceEntry, aidreamcapesWorkspaceMetadata, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";

export const metadata = aidreamcapesWorkspaceMetadata;
export const dynamic = "force-dynamic";

export default async function AidreamcapesCreatePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const entry = aidreamcapesWorkspaceEntry(query);
  return renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", ...entry, initialView: entry.initialView ?? "agent" });
}
