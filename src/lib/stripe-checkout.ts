import type { Customer, Order, Price } from "@/lib/types";

type StripeCheckoutParams = {
  siteId: string;
  siteSlug: string;
  customer: Customer;
  price: Price;
  order: Order;
  stripeAccountId: string;
  origin: string;
  mode: "subscription" | "payment";
  metadata: Record<string, string>;
};

export type StripeCheckoutResult = {
  id: string;
  url: string;
};

function isLiveStripePriceId(value?: string | null): value is string {
  return typeof value === "string" && /^price_[a-zA-Z0-9_]+$/.test(value.trim());
}

function stripeApiKey(): string | undefined {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  return key || undefined;
}

export function stripeCheckoutReadiness(params: { stripeAccountId?: string | null; stripePriceId?: string | null }): { ok: true } | { ok: false; reason: string } {
  if (!stripeApiKey()) return { ok: false, reason: "STRIPE_SECRET_KEY is not configured." };
  if (!params.stripeAccountId || !params.stripeAccountId.startsWith("acct_")) return { ok: false, reason: "A real Stripe connected account is required." };
  if (!isLiveStripePriceId(params.stripePriceId)) return { ok: false, reason: "The selected price must use a real Stripe price_ id." };
  return { ok: true };
}

export async function createStripeCheckoutSession(params: StripeCheckoutParams): Promise<StripeCheckoutResult> {
  const readiness = stripeCheckoutReadiness({
    stripeAccountId: params.stripeAccountId,
    stripePriceId: params.price.stripePriceId
  });
  if (!readiness.ok) throw new Error(readiness.reason);
  const apiKey = stripeApiKey();
  if (!apiKey || !params.price.stripePriceId) throw new Error("stripe_checkout_not_ready");

  const form = new URLSearchParams();
  form.set("mode", params.mode);
  form.set("line_items[0][price]", params.price.stripePriceId);
  form.set("line_items[0][quantity]", "1");
  form.set("customer_email", params.customer.email);
  form.set("client_reference_id", params.order.id);
  form.set("success_url", `${params.origin}/site/${params.siteSlug}/account?checkout=success&order=${params.order.id}`);
  form.set("cancel_url", `${params.origin}/site/${params.siteSlug}/cart?checkout=cancelled&order=${params.order.id}`);
  form.set("payment_intent_data[application_fee_amount]", "0");
  for (const [key, value] of Object.entries(params.metadata)) {
    form.set(`metadata[${key}]`, value);
    if (params.mode === "subscription") form.set(`subscription_data[metadata][${key}]`, value);
    if (params.mode === "payment") form.set(`payment_intent_data[metadata][${key}]`, value);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Account": params.stripeAccountId
    },
    body: form,
    cache: "no-store"
  });
  const payload = await response.json().catch(() => ({})) as { id?: string; url?: string; error?: { message?: string } };
  if (!response.ok || !payload.id || !payload.url) {
    throw new Error(payload.error?.message || "stripe_checkout_session_failed");
  }
  return { id: payload.id, url: payload.url };
}
