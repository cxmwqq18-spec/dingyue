import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPlatformAdminBySessionFromState, readPlatformState } from "@/lib/server-store";
import { platformSessionCookie } from "@/lib/session";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const state = readPlatformState();
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  if (!getPlatformAdminBySessionFromState(state, sessionId)) {
    return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
  }
  const site = state.sites.find((item) => item.id === siteId);
  if (!site) {
    return NextResponse.json({ error: "site_not_found" }, { status: 404 });
  }
  return NextResponse.json({
    siteId: site.id,
    stripeAccountId: site.connect.stripeAccountId,
    onboardingUrl: `https://connect.stripe.com/setup/e/${site.connect.stripeAccountId}`,
    mode: "connect_direct_charges",
    note: "Production should create this URL with Stripe accountLinks.create."
  });
}
