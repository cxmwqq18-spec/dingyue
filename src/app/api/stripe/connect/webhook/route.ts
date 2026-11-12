import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { StoreError } from "@/lib/server-store";
import { recordStripeWebhookRelational } from "@/lib/stores/billing-store";

// Replay window for the Stripe-Signature timestamp (Stripe's own default).
const SIGNATURE_TOLERANCE_SECONDS = 300;
let missingSecretWarned = false;

type StripeSignatureHeader = { timestamp: number; signatures: string[] };

function parseStripeSignatureHeader(header: string | null): StripeSignatureHeader | undefined {
  if (!header) return undefined;
  let timestamp: number | undefined;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [key, ...rest] = part.trim().split("=");
    const value = rest.join("=").trim();
    if (!key || !value) continue;
    if (key === "t") timestamp = Number(value);
    else if (key === "v1") signatures.push(value);
  }
  if (timestamp === undefined || !Number.isFinite(timestamp) || !signatures.length) return undefined;
  return { timestamp, signatures };
}

/** Handwritten Stripe signature check (no stripe npm package): HMAC-SHA256 over `${t}.${rawBody}`. */
function verifyStripeSignature(rawBody: string, header: string | null, secret: string, nowSeconds: number): boolean {
  const parsed = parseStripeSignatureHeader(header);
  if (!parsed) return false;
  if (nowSeconds - parsed.timestamp < 0 || nowSeconds - parsed.timestamp >= SIGNATURE_TOLERANCE_SECONDS) return false;
  const expected = createHmac("sha256", secret).update(`${parsed.timestamp}.${rawBody}`).digest();
  return parsed.signatures.some((candidate) => {
    const actual = Buffer.from(candidate, "utf8");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
}

export async function POST(request: Request) {
  // Signature verification needs the untouched body, so keep the raw text and
  // parse JSON from it instead of letting request.json() consume the stream.
  const rawBody = await request.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    // Existing payments must not break before ops configures the secret.
    if (!missingSecretWarned) {
      missingSecretWarned = true;
      console.warn("[stripe-connect-webhook] STRIPE_WEBHOOK_SECRET is not set; accepting unverified webhooks. configure STRIPE_WEBHOOK_SECRET to enforce");
    }
  } else if (!verifyStripeSignature(rawBody, request.headers.get("stripe-signature"), webhookSecret, Math.floor(Date.now() / 1000))) {
    return NextResponse.json({ error: "invalid_stripe_signature" }, { status: 400 });
  }
  let payload: {
    id?: string;
    type?: string;
    account?: string;
    data?: {
      object?: {
        id?: string;
        subscription?: string;
        metadata?: { siteId?: string; customerId?: string; priceId?: string; orderId?: string; creditsGranted?: string; kind?: string };
      };
    };
  };
  try {
    payload = JSON.parse(rawBody || "{}");
  } catch {
    return NextResponse.json({ error: "invalid_webhook_payload" }, { status: 400 });
  }
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
      note: "Webhook persisted idempotently after Stripe signature verification."
    });
  } catch (error) {
    const status = error instanceof StoreError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "webhook_record_failed" }, { status });
  }
}
