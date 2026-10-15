import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import {
  getAnalyticsSummary,
  parseAnalyticsProvider,
  parseAnalyticsWindow
} from "@/lib/aidreamcapes-workspace/analytics";
import { developerFailure, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { WorkspaceError } from "@/lib/aidreamcapes-workspace/types";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

const ALLOWED_QUERY_KEYS = new Set(["from", "to", "currency", "teamId", "provider"]);

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const query = request.nextUrl.searchParams;
    if ([...query.keys()].some((key) => !ALLOWED_QUERY_KEYS.has(key)) ||
        [...ALLOWED_QUERY_KEYS].some((key) => query.getAll(key).length > 1)) {
      throw new WorkspaceError("analytics_query_invalid", 400);
    }
    const window = parseAnalyticsWindow({
      from: query.get("from") ?? undefined,
      to: query.get("to") ?? undefined,
      currency: query.get("currency") ?? undefined
    });
    const teamId = query.get("teamId");
    if (teamId !== null && (!teamId || teamId.length > 160 || !/^[A-Za-z0-9:._-]+$/.test(teamId))) {
      throw new WorkspaceError("analytics_team_id_invalid", 400);
    }
    const providerValue = query.get("provider");
    const provider = providerValue === null ? null : parseAnalyticsProvider(providerValue);
    const summary = await getAnalyticsSummary(siteId, auth.current.customer.id, { teamId, provider }, window);
    return developerResponse(summary);
  } catch (error) {
    return developerFailure(error);
  }
}
