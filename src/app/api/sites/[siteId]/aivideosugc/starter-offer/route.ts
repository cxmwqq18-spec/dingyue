import type { NextRequest } from "next/server";
import { workspaceAuth } from "@/lib/aidreamcapes-workspace/auth";
import { workspaceResponse, workspaceFailure } from "@/lib/aidreamcapes-workspace/api";
import { prisma } from "@/lib/prisma";
import { isPublicPriceFact } from "@/lib/storefront-context";
import { firstVideoOfferPurchaseEligibility } from "@/lib/stores/first-video-offer-store";

export const dynamic = "force-dynamic";

type FreeCreditsState =
  | { state: "not_applied" }
  | { state: "pending"; appliedAt: string }
  | { state: "approved"; grantedCredits: number }
  | { state: "rejected" };

/**
 * Creator free-credits status for the starter page. Reuses the public
 * /partners#free-credits programme (CreditApplication: a video post with
 * #AIVideosUGC, hand review, 20-60 credits, one grant per creator) instead of
 * adding a second review pipeline.
 */
async function readFreeCreditsState(siteId: string, customerId: string): Promise<FreeCreditsState> {
  const applications = await prisma.creditApplication.findMany({
    where: { siteId, customerId },
    orderBy: { createdAt: "desc" },
    select: { status: true, grantCredits: true, createdAt: true }
  });
  const grantedCredits = applications
    .filter((application) => application.status === "approved")
    .reduce((total, application) => total + (application.grantCredits ?? 0), 0);
  if (grantedCredits > 0) return { state: "approved", grantedCredits };
  const pending = applications.find((application) => application.status === "pending");
  if (pending) return { state: "pending", appliedAt: pending.createdAt.toISOString() };
  if (applications.some((application) => application.status === "rejected")) return { state: "rejected" };
  return { state: "not_applied" };
}

/** Starter offer state for the workspace's First Video Offer view and home card. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  try {
    const { siteId } = await params;
    const auth = await workspaceAuth(request, siteId);
    if (!auth.ok) return auth.response;
    const customerId = auth.current.customer.id;
    const freeCredits = await readFreeCreditsState(siteId, customerId);
    const offer = await prisma.firstVideoOffer.findFirst({
      where: { siteId, customerId },
      select: { status: true }
    });
    if (offer) {
      return workspaceResponse({ state: offer.status === "purchased" ? "purchased" : "consumed", freeCredits });
    }
    const eligibility = await firstVideoOfferPurchaseEligibility(siteId, customerId);
    if (!eligibility.eligible) {
      return workspaceResponse({ state: "ineligible", freeCredits });
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
    return workspaceResponse({ state: "eligible", priceId: trialPrice?.id ?? null, freeCredits });
  } catch (error) { return workspaceFailure(error); }
}
