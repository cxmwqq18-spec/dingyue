import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { developerFailure, developerResponse, developerJsonBody } from "@/lib/aidreamcapes-workspace/developer-http";
import { createWebhookSubscription, listWebhookSubscriptions } from "@/lib/aidreamcapes-workspace/webhooks";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ siteId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    return developerResponse({ subscriptions: await listWebhookSubscriptions(siteId, auth.current.customer.id) });
  } catch (error) { return developerFailure(error); }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId, true);
    if (!auth.ok) return auth.response;
    const body = await developerJsonBody(request);
    const created = await createWebhookSubscription(siteId, auth.current.customer.id, body.url, body.events);
    return developerResponse({ subscription: created.subscription, secret: created.oneTimeSecret, secretShownOnce: true }, 201);
  } catch (error) { return developerFailure(error); }
}
