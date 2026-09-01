import { PricingBillingInteractive, type PricingBillingTableProps } from "@/components/storefront/pricing-billing-interactive";

export type { PricingBillingTableProps };

export function PricingBillingTable(props: PricingBillingTableProps) {
  return <PricingBillingInteractive {...props} />;
}
