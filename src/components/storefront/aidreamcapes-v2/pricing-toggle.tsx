"use client";

import { useMemo, useState } from "react";

export type AidreamcapesPricingCard = {
  id: string;
  name: string;
  summary: string;
  badgeLabel?: string;
  features: string[];
  prices: Partial<Record<"month" | "year", {
    amount: string;
    period: string;
    credits: string;
    outputEstimate?: {
      photos: number;
      fifteenSecondVideos: number;
      note: string;
      period: "month" | "year";
    };
    equivalentMonthly?: string;
    savingsLabel?: string;
    checkoutEnabled: boolean;
    checkoutHref: string;
  }>>;
};

export function AidreamcapesPricingToggle({ plans, labels }: { plans: AidreamcapesPricingCard[]; labels?: Record<string, string> }) {
  const label = (value: string, fallback = value) => labels?.[value] ?? fallback;
  const interpolate = (key: string, fallback: string, values: Record<string, string>) => {
    const template = labels?.[key] ?? fallback;
    return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
  };
  const availablePeriods = useMemo(() => ( ["month", "year"] as const).filter((period) => plans.some((plan) => plan.prices[period])), [plans]);
  const [period, setPeriod] = useState<"month" | "year">(availablePeriods.includes("month") ? "month" : "year");
  const visiblePlans = plans.filter((plan) => plan.prices[period]);

  if (!visiblePlans.length) {
    return <p className="v2-pricing-empty">{label("Subscription plans are being updated. Please check back soon.")}</p>;
  }

  return (
    <div className="v2-pricing-content" data-active-billing-period={period}>
      {availablePeriods.length > 1 ? (
        <div aria-label={label("Billing period")} className="v2-pricing-periods" role="group">
          {availablePeriods.map((value) => (
            <button
              aria-pressed={period === value}
              className={period === value ? "is-active" : ""}
              key={value}
              onClick={() => setPeriod(value)}
              type="button"
            >
              {label(value === "month" ? "Monthly" : "Yearly")}
            </button>
          ))}
        </div>
      ) : null}
      <div className="v2-pricing-grid">
        {visiblePlans.map((plan) => {
          const price = plan.prices[period];
          if (!price) return null;
          return (
            <article className={`v2-pricing-card${plan.badgeLabel ? " is-featured" : ""}`} key={plan.id}>
              {plan.badgeLabel ? <span className="v2-pricing-badge">{plan.badgeLabel}</span> : null}
              <h3>{plan.name}</h3>
              <p className="v2-pricing-summary">{plan.summary}</p>
              <div className="v2-pricing-amount">
                <strong>{price.amount}</strong>
                <span> / {label(price.period)}</span>
              </div>
              {price.equivalentMonthly ? <p className="v2-pricing-equivalent">{interpolate("equivalentYearly", "{amount} / month, billed yearly", { amount: price.equivalentMonthly })}</p> : null}
              {price.savingsLabel ? <span className="v2-pricing-savings">{price.savingsLabel}</span> : null}
              <p className="v2-pricing-credits">{price.credits}</p>
              {price.outputEstimate ? (
                <div className="v2-pricing-usage">
                  <p className="v2-pricing-usage-title">{label(price.outputEstimate.period === "year" ? "yearlyOutput" : "monthlyOutput", `Approximate ${price.outputEstimate.period === "year" ? "yearly" : "monthly"} output`)}</p>
                  <div className="v2-pricing-usage-grid">
                    <div className="v2-pricing-usage-option">
                      <strong>~{price.outputEstimate.photos}</strong>
                      <span>{label("product photos")}</span>
                    </div>
                    <span className="v2-pricing-usage-or">{label("or")}</span>
                    <div className="v2-pricing-usage-option">
                      <strong>~{price.outputEstimate.fifteenSecondVideos}</strong>
                      <span>{label("15-second videos")}</span>
                    </div>
                  </div>
                </div>
              ) : null}
              {plan.features.length ? <p className="v2-pricing-features-title">{label("Plan details")}</p> : null}
              {plan.features.length ? <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : null}
              {price.checkoutEnabled ? (
                <a className="v2-pricing-cta" href={price.checkoutHref}>{interpolate("choosePlan", "Choose {plan}", { plan: plan.name })}</a>
              ) : (
                <button aria-disabled="true" className="v2-pricing-cta is-disabled" disabled type="button">{label("Checkout coming soon")}</button>
              )}
            </article>
          );
        })}
      </div>
      {visiblePlans[0]?.prices[period]?.outputEstimate?.note ? (
        <p className="v2-pricing-estimate-note">{visiblePlans[0].prices[period].outputEstimate.note}</p>
      ) : null}
      {visiblePlans.some((plan) => !plan.prices[period]?.checkoutEnabled) ? (
        <p className="v2-pricing-note">{label("Subscription checkout is not currently available.")}</p>
      ) : null}
    </div>
  );
}
