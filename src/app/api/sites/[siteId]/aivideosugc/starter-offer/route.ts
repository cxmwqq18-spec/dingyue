import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { prisma } from "@/lib/prisma";
import { isPublicPriceFact } from "@/lib/storefront-context";
import { firstVideoOfferPurchaseEligibility } from "@/lib/stores/first-video-offer-store";

export const dynamic = "force-dynamic";

/** Starter offer state for the workspace's First Video Offer view and home card. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const customerId = auth.current.customer.id;
    const offer = await prisma.firstVideoOffer.findFirst({
      where: { siteId, customerId },
      select: { status: true }
    });
    if (offer) {
      return workspaceResponse({ state: offer.status === "purchased" ? "purchased" : "consumed" });
    }
    const eligibility = await firstVideoOfferPurchaseEligibility(siteId, customerId);
    if (!eligibility.eligible) {
      return workspaceResponse({ state: "ineligible" });
    }
    const products = await prisma.product.findMany({
      where: { siteId, status: "active" },
      select: { metadata: true, prices: { select: { id: true, interval: true, status: true, amountCents: true, currency: true, stripePriceId: true, providerVerifiedAt: true, providerFingerprint: true, effectiveFrom: true, effectiveTo: true } } }
    });
    const site = await prisma.site.findUnique({ where: { id: siteId }, select: { currency: true } });
    const now = new Date();
    const trialPrice = products
      .filter((product) => (product.metadata as { kind?: string } | null)?.kind === "first_video_trial")
      .flatMap((product) => product.prices)
      .filter((price) => price.interval === "one_time" && isPublicPriceFact(price, now, site?.currency))
      .sort((left, right) => left.amountCents - right.amountCents)[0];
    return workspaceResponse({ state: "eligible", priceId: trialPrice?.id ?? null });
  } catch (error) { return workspaceFailure(error); }
}
