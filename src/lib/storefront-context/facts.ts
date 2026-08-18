import type { Price, StorefrontProfileJson } from "@/lib/types";

type PriceFact = {
  status?: string | null;
  stripePriceId?: string | null;
  amountCents?: number | null;
  currency?: string | null;
  providerVerifiedAt?: string | Date | null;
  providerFingerprint?: string | null;
  interval?: string | null;
  effectiveFrom?: string | Date | null;
  effectiveTo?: string | Date | null;
};

function timestamp(value: string | Date | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function isPublicPriceFact(price: PriceFact, now = new Date(), expectedCurrency?: string): boolean {
  if (price.status !== "active") return false;
  if (!price.amountCents || price.amountCents <= 0) return false;
  if (!price.interval) return false;
  if (!/^price_[a-zA-Z0-9_]+$/.test(price.stripePriceId ?? "")) return false;
  if (!price.providerVerifiedAt || !price.providerFingerprint) return false;
  if (!price.currency) return false;
  if (expectedCurrency && price.currency.trim().toLowerCase() !== expectedCurrency.trim().toLowerCase()) return false;
  const current = now.getTime();
  const from = timestamp(price.effectiveFrom);
  const to = timestamp(price.effectiveTo);
  if (price.effectiveFrom && from === undefined) return false;
  if (price.effectiveTo && to === undefined) return false;
  return (from === undefined || from <= current) && (to === undefined || to > current);
}

export function missingStorefrontProfileFacts(profile: StorefrontProfileJson | undefined): string[] {
  const missing: string[] = [];
  if (!profile?.identity.legalName) missing.push("profile.identity.legalName");
  if (!profile?.identity.entityType) missing.push("profile.identity.entityType");
  const address = profile?.identity.address;
  if (!address?.line1 || !address.city || !address.region || !address.postalCode || !address.country) {
    missing.push("profile.identity.address");
  }
  if (!profile?.identity.supportEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.identity.supportEmail)) {
    missing.push("profile.identity.supportEmail");
  }
  if (profile?.policyFacts.usesCustomerMediaForTraining === undefined) missing.push("profile.policyFacts.usesCustomerMediaForTraining");
  if (!profile?.policyFacts.sourceMediaRetentionDays || profile.policyFacts.sourceMediaRetentionDays <= 0) missing.push("profile.policyFacts.sourceMediaRetentionDays");
  if (profile?.policyFacts.refundReviewRequired === undefined) missing.push("profile.policyFacts.refundReviewRequired");
  if (!profile?.policyFacts.refundWindowDays || profile.policyFacts.refundWindowDays <= 0) missing.push("profile.policyFacts.refundWindowDays");
  if (!profile?.policyFacts.effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(profile.policyFacts.effectiveDate)) missing.push("profile.policyFacts.effectiveDate");
  return missing;
}
