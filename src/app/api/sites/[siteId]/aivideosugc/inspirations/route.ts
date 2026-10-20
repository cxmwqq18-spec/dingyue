import type { NextRequest } from "next/server";
import { assertWorkspaceSite } from "@/lib/aidreamcapes-workspace/store";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { getWorkspaceInspirationPage } from "@/lib/aidreamcapes-workspace/inspirations-page.server";
export const dynamic = "force-dynamic";

// Public example gallery used by the workspace's embedded Inspiration tab.
// Same relational source as the standalone /app/inspirations page.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    assertWorkspaceSite(siteId);
    const query = new URL(_request.url).searchParams;
    const basePath = query.get("basePath") ?? "";
    if (!["", "/site/aidreamcapes", "/site/aivideosugc"].includes(basePath)) return workspaceResponse({ error: "Invalid base path" }, 400);
    return workspaceResponse(await getWorkspaceInspirationPage({
      offset: Number(query.get("offset") ?? 0), kind: query.get("kind") ?? undefined,
      category: query.get("category") ?? undefined, q: query.get("q") ?? undefined, basePath
    }));
  } catch (error) {
    return workspaceFailure(error);
  }
}
