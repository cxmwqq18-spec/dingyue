import type { Product } from "./types";

export function canPublishPaidProducts(chargesEnabled: boolean, products: Product[]): {
  ok: boolean;
  reason?: string;
} {
  if (!chargesEnabled) {
    return { ok: false, reason: "Stripe Connect onboarding is not complete for this site." };
  }
  const hasProduct = products.some((product) => product.status === "active" && product.prices.some((price) => price.status === "active" && price.providerVerifiedAt && price.providerFingerprint && /^price_/.test(price.stripePriceId)));
  if (!hasProduct) {
    return { ok: false, reason: "Create at least one active subscription or credit pack." };
  }
  return { ok: true };
}

export function buildCheckoutMetadata(siteId: string, customerId: string, priceId: string): Record<string, string> {
  return {
    siteId,
    customerId,
    priceId,
    fulfillment: "credits_ledger_grant"
  };
}
