"use client";

import { useMemo, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { StorefrontInstantLink } from "@/components/storefront/storefront-instant-link";

type BillingCycle = "month" | "year";

type PricingPlanPrice = {
  id: string;
  formattedAmount: string;
  formattedOriginalAmount: string;
  formattedEquivalentMonthly: string;
  periodLabel: string;
  planSubtitle: string;
  discountLabel: string;
  features: string[];
  featured: boolean;
  bestValue: boolean;
  badgeLabel: string;
  buttonLabel: string;
  cartHref: string;
};

type PricingPlan = {
  id: string;
  name: string;
  prices: Partial<Record<BillingCycle, PricingPlanPrice>>;
};

type PricingSidePanel = {
  eyebrow: string;
  title: string;
  body: string;
  items: Array<readonly [string, string]>;
};

export function PricingBillingTable({
  canShowBillingSwitch,
  initialBillingCycle,
  plans,
  sidePanels,
  aidreamcapes,
  locale = "en"
}: {
  canShowBillingSwitch: boolean;
  initialBillingCycle: BillingCycle;
  plans: PricingPlan[];
  sidePanels: Record<BillingCycle, PricingSidePanel>;
  aidreamcapes: boolean;
  locale?: "en" | "es";
}) {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(initialBillingCycle);
  const activeSidePanel = sidePanels[billingCycle] ?? sidePanels.month;
  const visiblePlans = useMemo(
    () => plans.map((plan) => ({ ...plan, price: plan.prices[billingCycle] ?? plan.prices.month ?? plan.prices.year })).filter((plan) => plan.price),
    [billingCycle, plans]
  );

  return (
    <>
      <div className="mt-7 flex flex-wrap gap-3">
        {canShowBillingSwitch ? (
          <div className="inline-grid grid-cols-2 rounded-[12px] border border-white/14 bg-white/[0.08] p-1 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.75)] backdrop-blur">
            {(["month", "year"] as const).map((cycle) => (
              <button
                aria-pressed={billingCycle === cycle}
                className={`inline-flex min-h-[44px] min-w-[132px] items-center justify-center rounded-[9px] px-5 text-sm font-semibold transition ${billingCycle === cycle ? "bg-white text-[#171514]" : "text-white/68 hover:text-white"}`}
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                type="button"
              >
                {cycle === "month" ? locale === "es" ? "Mensual" : "Monthly" : locale === "es" ? "Anual" : "Yearly"}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-8 grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid gap-4 lg:grid-cols-3">
          {visiblePlans.map(({ id, name, price }) => {
            if (!price) return null;
            const hasBadge = price.featured || price.bestValue;
            return (
              <div
                className={`relative flex h-full flex-col rounded-[12px] border ${price.featured || price.bestValue ? "border-[#c99152] bg-white text-[#171514] ring-1 ring-[#e9bf89]" : aidreamcapes ? "border-[#E3D3BE] bg-white text-[#171514]" : "border-white/12 bg-white text-[#171514]"} p-5 shadow-[0_28px_66px_-52px_rgba(70,46,24,0.24)]`}
                key={id}
              >
                {hasBadge ? (
                  <div className="absolute left-5 top-5 rounded-full bg-[#c99152] px-3 py-1.5 text-center text-[0.72rem] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_16px_34px_-24px_rgba(201,145,82,0.85)]">
                    {price.badgeLabel}
                  </div>
                ) : null}
                <p className={`${hasBadge ? "mt-12" : "mt-2"} text-[1.72rem] font-semibold leading-none tracking-[-0.03em] [font-family:var(--site-title-font)]`}>{name}</p>
                <p className="mt-2 min-h-[2.75rem] text-[0.92rem] text-[#6d665f]">{price.planSubtitle}</p>
                <div className="mt-6 flex items-end gap-2">
                  <p className="text-[2.65rem] font-semibold leading-none tracking-[-0.04em] [font-family:var(--site-title-font)]">{price.formattedAmount}</p>
                  <p className="pb-2 text-[0.88rem] text-[#7f786f]">{price.periodLabel}</p>
                </div>
                {billingCycle === "year" && price.formattedEquivalentMonthly ? (
                  <p className="mt-2 text-sm font-medium text-[#7f786f]">{locale === "es" ? `Equivale a ${price.formattedEquivalentMonthly} / mes` : `Equivalent to ${price.formattedEquivalentMonthly} / month`}</p>
                ) : null}
                {price.formattedOriginalAmount ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-[#8a837b] line-through">{price.formattedOriginalAmount}</span>
                    {price.discountLabel ? <span className="rounded-full bg-[#f4e0c7] px-2.5 py-1 text-[0.72rem] font-semibold text-[#8a5728]">{price.discountLabel}</span> : null}
                  </div>
                ) : null}
                <div className="mt-6 grid gap-2.5 text-[0.88rem] text-[#4f4944]">
                  {price.features.map((feature, index) => (
                    <div className="flex items-start gap-3" key={`${id}_${feature}_${index}`}>
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#b07b47]" strokeWidth={1.8} />
                      <span className="min-w-0 break-words">{feature}</span>
                    </div>
                  ))}
                </div>
                <StorefrontInstantLink className={`mt-6 inline-flex min-h-[48px] w-full items-center justify-center rounded-[10px] text-[0.95rem] font-semibold transition hover:-translate-y-0.5 ${price.featured ? "bg-[#c99152] text-white" : "bg-[#171514] text-white"}`} href={price.cartHref}>
                  {price.buttonLabel}
                </StorefrontInstantLink>
              </div>
            );
          })}
        </div>
        <div className="relative hidden min-h-[430px] min-w-0 xl:block">
          <div className={aidreamcapes ? "flex h-full min-w-0 flex-col gap-6 rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.72)] backdrop-blur" : "flex h-full min-w-0 flex-col gap-6 rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0.03)_100%)] p-6 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.72)] backdrop-blur"}>
            <div className="min-w-0">
              <p className="text-[0.74rem] font-semibold uppercase tracking-[0.18em] text-[#B86E36]">{activeSidePanel.eyebrow}</p>
              <h3 className="mt-3 max-w-full break-words text-[1.9rem] font-semibold leading-[1.02] tracking-[-0.03em] [font-family:var(--site-title-font)]">
                {activeSidePanel.title}
              </h3>
              <p className={aidreamcapes ? "mt-4 max-w-[26rem] break-words text-[0.94rem] leading-7 text-white/68" : "mt-4 max-w-[26rem] break-words text-[0.94rem] leading-7 text-white/68"}>
                {activeSidePanel.body}
              </p>
            </div>
            <div className="grid gap-3">
              {activeSidePanel.items.map(([label, detail]) => (
                <div className={aidreamcapes ? "min-w-0 rounded-[16px] border border-white/10 bg-white/[0.06] px-4 py-4" : "min-w-0 rounded-[16px] border border-white/10 bg-white/[0.06] px-4 py-4"} key={label}>
                  <p className={aidreamcapes ? "break-words text-sm font-semibold text-white" : "break-words text-sm font-semibold text-white"}>{label}</p>
                  <p className={aidreamcapes ? "mt-1 break-words text-sm leading-6 text-white/64" : "mt-1 break-words text-sm leading-6 text-white/64"}>{detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
