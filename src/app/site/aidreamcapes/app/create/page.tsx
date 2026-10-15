import { aidreamcapesWorkspaceEntry, aidreamcapesWorkspaceMetadata, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { redirect } from "next/navigation";

export const metadata = aidreamcapesWorkspaceMetadata;
export const dynamic = "force-dynamic";

export default async function AidreamcapesCreatePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  if (query.view === "inspirations") redirect("/site/aidreamcapes/app/inspirations");
  const entry = aidreamcapesWorkspaceEntry(query);
  return renderAidreamcapesWorkspace({ routeSlug: "aidreamcapes", ...entry, initialView: entry.initialView ?? "agent" });
}
