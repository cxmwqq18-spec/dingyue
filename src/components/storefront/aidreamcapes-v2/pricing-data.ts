import type { Price, Product } from "@/lib/types";
import { isPublicPriceFact } from "@/lib/storefront-context/facts";
import type { V2PricingCard } from "./types";

type PricingSiteFacts = {
  currency: string;
  connect?: { chargesEnabled?: boolean; payoutsEnabled?: boolean } | null;
};

type PricingResolvers = { href: (value: string) => string };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function formatPrice(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: amountCents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(amountCents / 100);
}

function formatCredits(credits: number): string {
  return new Intl.NumberFormat("en-US").format(credits);
}

function productOrder(name: string): number {
  const normalized = name.trim().toLowerCase();
  if (normalized === "starter") return 0;
  if (normalized === "pro") return 1;
  if (normalized === "premium") return 2;
  return 99;
}

function metadataNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

export function aidreamcapesPricingCards(
  products: Product[],
  site: PricingSiteFacts,
  r: PricingResolvers,
  now = new Date()
): V2PricingCard[] {
  const checkoutAccountReady = Boolean(site.connect?.chargesEnabled && site.connect?.payoutsEnabled);
  const subscriptions = products
    .filter((product) => product.siteId === "site_aidreamcapes" && product.status === "active" && product.type === "subscription")
    .sort((left, right) => productOrder(left.name) - productOrder(right.name) || left.name.localeCompare(right.name));

  return subscriptions.map((product) => {
    const metadata = record(product.metadata);
    const productPrices = product.prices.filter((price) =>
      price.siteId === "site_aidreamcapes" && price.productId === product.id && price.status !== "archived"
    );
    const monthlyPrice = productPrices.find((price) => price.interval === "month");
    const yearlyPrice = productPrices.find((price) => price.interval === "year");
    const outputEstimate = record(metadata.outputEstimate);
    const monthlyPhotos = metadataNumber(outputEstimate.photos);
    const monthlyVideos = metadataNumber(outputEstimate.fifteenSecondVideos);
    const features = Array.isArray(metadata.features)
      ? metadata.features.filter((feature): feature is string => typeof feature === "string" && Boolean(feature.trim()))
      : [];

    const priceFor = (price: Price | undefined, interval: "month" | "year") => {
      if (!price) return undefined;
      const checkoutEnabled = checkoutAccountReady && isPublicPriceFact(price, now, site.currency);
      const query = new URLSearchParams({ product: product.id, price: price.id });
      const monthlyComparable = interval === "year" ? Math.round(price.amountCents / 12) : undefined;
      const yearlySavings = interval === "year" && monthlyPrice?.amountCents
        ? Math.round((1 - price.amountCents / (monthlyPrice.amountCents * 12)) * 100)
        : 0;
      const outputScale = interval === "year" && monthlyPrice?.creditsGranted
        ? price.creditsGranted / monthlyPrice.creditsGranted
        : 1;
      return {
        amount: formatPrice(price.amountCents, price.currency),
        period: interval,
        credits: `${formatCredits(price.creditsGranted)} credits / ${interval}`,
        ...(monthlyPhotos && monthlyVideos && Number.isFinite(outputScale) && outputScale > 0
          ? { outputEstimate: {
            photos: Math.round(monthlyPhotos * outputScale),
            fifteenSecondVideos: Math.round(monthlyVideos * outputScale),
            note: typeof outputEstimate.note === "string" ? outputEstimate.note : "",
            period: interval
          } }
          : {}),
        ...(monthlyComparable ? { equivalentMonthly: formatPrice(monthlyComparable, price.currency) } : {}),
        ...(yearlySavings > 0 ? { savingsLabel: `Save ${yearlySavings}%` } : {}),
        checkoutEnabled,
        checkoutHref: r.href(`/cart?${query.toString()}`)
      };
    };

    return {
      id: product.id,
      name: product.name,
      summary: typeof metadata.summary === "string" ? metadata.summary : "",
      ...(typeof metadata.badgeLabel === "string" && metadata.badgeLabel.trim() ? { badgeLabel: metadata.badgeLabel } : {}),
      features,
      prices: {
        ...(monthlyPrice ? { month: priceFor(monthlyPrice, "month") } : {}),
        ...(yearlyPrice ? { year: priceFor(yearlyPrice, "year") } : {})
      }
    };
  });
}
