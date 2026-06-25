import { NextResponse } from "next/server";
import { getCurrentPlatformAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(_request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    if (!(await getCurrentPlatformAdmin())) {
      return NextResponse.json({ error: "platform_login_required" }, { status: 401 });
    }
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { connect: true }
    });
    if (!site) {
      return NextResponse.json({ error: "site_not_found" }, { status: 404 });
    }
    const connect = site.connect ?? await prisma.stripeConnectAccount.upsert({
      where: { siteId: site.id },
      create: {
        id: `connect_${site.id}`,
        siteId: site.id,
        stripeAccountId: `acct_demo_${site.id}`,
        onboardingStatus: "pending",
        chargesEnabled: false,
        payoutsEnabled: false
      },
      update: {}
    });
    const stripeAccountId = connect.stripeAccountId;
    return NextResponse.json({
      siteId: site.id,
      stripeAccountId,
      connectStatus: connect.onboardingStatus,
      onboardingUrl: `https://connect.stripe.com/setup/e/${stripeAccountId}`,
      mode: "connect_direct_charges",
      note: "Production should create this URL with Stripe accountLinks.create."
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "connect_onboarding_link_failed" },
      { status: 500 }
    );
  }
}
