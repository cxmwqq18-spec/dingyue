import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerResponse } from "@/lib/aidreamcapes-workspace/developer-http";
import { disableWebhookSubscription } from "@/lib/aidreamcapes-workspace/webhooks";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string; subscriptionId: string }> };

export async function DELETE(request: NextRequest, { params }: Context) {
  try {
    const { siteId, subscriptionId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    await disableWebhookSubscription(siteId, auth.current.customer.id, subscriptionId);
    return developerResponse({ ok: true });
  } catch (error) { return developerFailure(error); }
}
