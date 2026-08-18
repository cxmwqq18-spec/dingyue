import crypto from "node:crypto";

import type { Price } from "@/lib/types";

export type ProviderPriceSnapshot = {
  id: string;
  amountCents: number;
  currency: string;
  interval: Price["interval"];
  active?: boolean;
};

export interface StripePriceReadAdapter {
  retrievePrice(priceId: string): Promise<ProviderPriceSnapshot>;
}

export class FakeStripePriceAdapter implements StripePriceReadAdapter {
  private readonly snapshots: Map<string, ProviderPriceSnapshot>;
  retrieveCount = 0;

  constructor(snapshots: ProviderPriceSnapshot[] = []) {
    this.snapshots = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  }

  async retrievePrice(priceId: string): Promise<ProviderPriceSnapshot> {
    this.retrieveCount += 1;
    const snapshot = this.snapshots.get(priceId);
    if (!snapshot) throw new Error(`fake_stripe_price_not_found:${priceId}`);
    return snapshot;
  }
}

export const fakeStripePriceAdapter = new FakeStripePriceAdapter();

export function providerFingerprint(snapshot: ProviderPriceSnapshot): string {
  return crypto.createHash("sha256").update(JSON.stringify({
    id: snapshot.id,
    amountCents: snapshot.amountCents,
    currency: snapshot.currency.toLowerCase(),
    interval: snapshot.interval
  })).digest("hex");
}

export async function verifyPriceReadOnly(params: {
  price: Pick<Price, "stripePriceId" | "amountCents" | "currency" | "interval">;
  adapter?: StripePriceReadAdapter;
}): Promise<{ snapshot: ProviderPriceSnapshot; fingerprint: string }> {
  const stripePriceId = params.price.stripePriceId.trim();
  if (!/^price_[a-zA-Z0-9_]+$/.test(stripePriceId)) throw new Error("manual_price_not_publishable");
  const snapshot = await (params.adapter ?? fakeStripePriceAdapter).retrievePrice(stripePriceId);
  if (snapshot.id !== stripePriceId || snapshot.amountCents !== params.price.amountCents || snapshot.currency.toLowerCase() !== params.price.currency.toLowerCase() || snapshot.interval !== params.price.interval) {
    throw new Error("stripe_price_mismatch");
  }
  if (snapshot.active === false) throw new Error("stripe_price_inactive");
  return { snapshot, fingerprint: providerFingerprint(snapshot) };
}
