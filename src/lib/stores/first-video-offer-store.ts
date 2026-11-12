import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * First-video $1 trial offer (site_aidreamcapes): one row per customer.
 * status "purchased" gates the starter workspace view and the discounted 15s
 * quote; status "consumed" archives it. The customerId unique constraint makes
 * offer creation and consumption single-shot per customer.
 */

export type FirstVideoOfferRow = {
  id: string;
  siteId: string;
  customerId: string;
  status: string;
  orderId: string | null;
  purchasedAt: Date;
  consumedAt: Date | null;
};

type Tx = Prisma.TransactionClient;

/** True while the customer still holds an unused first-video offer. */
export async function purchasedFirstVideoOfferExists(siteId: string, customerId: string): Promise<boolean> {
  const row = await prisma.firstVideoOffer.findFirst({
    where: { siteId, customerId, status: "purchased" },
    select: { id: true }
  });
  return Boolean(row);
}

/**
 * Eligibility for buying the offer: never paid anything (no fulfilled paid
 * order, no live paid subscription) and no offer row yet.
 */
export async function firstVideoOfferPurchaseEligibility(siteId: string, customerId: string): Promise<{ eligible: boolean; reason?: string }> {
  const [paidOrder, liveSubscription, existingOffer] = await Promise.all([
    prisma.order.findFirst({ where: { siteId, customerId, amountCents: { gt: 0 }, status: "fulfilled" }, select: { id: true } }),
    prisma.subscription.findFirst({ where: { siteId, customerId, status: { in: ["active", "trialing", "past_due"] } }, select: { id: true } }),
    prisma.firstVideoOffer.findFirst({ where: { siteId, customerId }, select: { id: true } })
  ]);
  if (existingOffer) return { eligible: false, reason: "first_video_offer_exists" };
  if (paidOrder) return { eligible: false, reason: "first_video_offer_existing_customer" };
  if (liveSubscription) return { eligible: false, reason: "first_video_offer_existing_customer" };
  return { eligible: true };
}

/** Consume inside the job-creation transaction; false when another job won the race. */
export async function consumeFirstVideoOfferTx(tx: Tx, params: { siteId: string; customerId: string }): Promise<boolean> {
  const updated = await tx.firstVideoOffer.updateMany({
    where: { siteId: params.siteId, customerId: params.customerId, status: "purchased" },
    data: { status: "consumed", consumedAt: new Date() }
  });
  return updated.count === 1;
}

/** Webhook fulfillment: create the offer once; an existing row is never overwritten. */
export async function createFirstVideoOfferTx(tx: Tx, params: { siteId: string; customerId: string; orderId?: string | null }): Promise<boolean> {
  const inserted = await tx.firstVideoOffer.createMany({
    data: [{
      id: `fvo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      siteId: params.siteId,
      customerId: params.customerId,
      status: "purchased",
      ...(params.orderId ? { orderId: params.orderId } : {})
    }],
    skipDuplicates: true
  });
  return inserted.count === 1;
}
