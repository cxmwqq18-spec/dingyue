import { NextResponse } from "next/server";
import { StoreError } from "@/lib/server-store";
import { recordStripeWebhookRelational } from "@/lib/stores/billing-store";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => ({}))) as {
    id?: string;
    type?: string;
    account?: string;
    data?: {
      object?: {
        id?: string;
        subscription?: string;
        metadata?: { siteId?: string; customerId?: string; priceId?: string; orderId?: string; creditsGranted?: string };
      };
    };
  };
  try {
    const result = await recordStripeWebhookRelational(payload);
    return NextResponse.json({
      received: true,
      providerEventId: payload.id,
      siteId: result.siteId,
      eventType: payload.type,
      idempotent: true,
      alreadyProcessed: result.alreadyProcessed,
      paymentEvent: result.event,
      order: result.order ?? null,
      subscription: result.subscription ?? null,
      ledgerAction: result.ledger ?? null,
      fulfillmentAction: result.alreadyProcessed ? "skipped" : result.ledger ? "credits_granted" : "event_recorded_without_credit_grant",
      note: "Dev mode persists webhook idempotently. Production must verify Stripe signature before this step."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "webhook_record_failed" }, { status });
  }
}
