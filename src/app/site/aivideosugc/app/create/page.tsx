import { aidreamcapesWorkspaceEntry, aidreamcapesWorkspaceMetadata, renderAidreamcapesWorkspace } from "@/lib/aidreamcapes-workspace/page";
import { legacyCreateHrefToStatic } from "@/lib/aidreamcapes-workspace/static-routes";
import { permanentRedirect } from "next/navigation";

export const metadata = aidreamcapesWorkspaceMetadata;
export const dynamic = "force-dynamic";

export default async function AIVideosUGCCreatePage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  // Legacy query links are permanent redirects to their fixed paths.
  if (Object.keys(query).length) {
    const staticPath = legacyCreateHrefToStatic(`/app/create?${new URLSearchParams(Object.entries(query).flatMap(([k, v]) => Array.isArray(v) ? v.map((item) => [k, String(item)] as [string, string]) : [[k, String(v)]]))}`);
    if (staticPath) permanentRedirect(`/site/aivideosugc${staticPath}`);
  }
  const entry = aidreamcapesWorkspaceEntry(query);
  return renderAidreamcapesWorkspace({ routeSlug: "aivideosugc", ...entry, initialView: entry.initialView ?? "agent" });
}
