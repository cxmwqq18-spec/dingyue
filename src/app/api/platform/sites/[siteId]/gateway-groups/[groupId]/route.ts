import { NextRequest, NextResponse } from "next/server";
import { requirePlatformMutation } from "@/lib/api-auth";
import { StoreError } from "@/lib/server-store";
import { updateGatewayGroupRelational } from "@/lib/stores/site-store";
import type { AiGatewayGroup } from "@/lib/types";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string; groupId: string }> }
) {
  const { siteId, groupId } = await params;
  const guard = await requirePlatformMutation(request, { roles: ["super_admin", "ops"], key: `platform:gateway-group:${siteId}:${groupId}` });
  if (!guard.ok) return guard.response;

  const body = (await request.json().catch(() => ({}))) as Partial<AiGatewayGroup> & {
    modelAllowlist?: string[] | string;
    retryStatusCodes?: number[] | string;
  };

  const modelAllowlist = Array.isArray(body.modelAllowlist)
    ? body.modelAllowlist
    : String(body.modelAllowlist ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const retryStatusCodes = Array.isArray(body.retryStatusCodes)
    ? body.retryStatusCodes.map(Number)
    : String(body.retryStatusCodes ?? "")
        .split(",")
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isInteger(item));

  try {
    const result = await updateGatewayGroupRelational({
      siteId,
      groupId,
      status: body.status ?? "active",
      modelAllowlist,
      monthlyQuota: Number(body.monthlyQuota),
      retryStatusCodes,
      rateLimitPerMinute: Number(body.rateLimitPerMinute),
      accountPoolMode: body.accountPoolMode ?? "shared",
      unavailableReason: body.unavailableReason
    });
    return NextResponse.json({ ok: true, gatewayGroup: result.gatewayGroup });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "gateway_group_update_failed" }, { status });
  }
}
