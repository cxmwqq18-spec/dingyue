"use client";

import { useMemo, useState } from "react";

import type { V2PricingCard } from "./types";
export function AidreamcapesPricingToggle({ plans }: { plans: V2PricingCard[] }) {
  const availablePeriods = useMemo(() => ( ["month", "year"] as const).filter((period) => plans.some((plan) => plan.prices[period])), [plans]);
  const [period, setPeriod] = useState<"month" | "year">(availablePeriods.includes("month") ? "month" : "year");
  const visiblePlans = plans.filter((plan) => plan.prices[period]);

  if (!visiblePlans.length) {
    return <p className="v2-pricing-empty">Subscription plans are being updated. Please check back soon.</p>;
  }

  return (
    <div className="v2-pricing-content" data-active-billing-period={period}>
      {availablePeriods.length > 1 ? (
        <div aria-label="Billing period" className="v2-pricing-periods" role="group">
          {availablePeriods.map((value) => (
            <button
              aria-pressed={period === value}
              className={period === value ? "is-active" : ""}
              key={value}
              onClick={() => setPeriod(value)}
              type="button"
            >
              {value === "month" ? "Monthly" : "Yearly"}
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
                <span> / {price.period}</span>
              </div>
              {price.equivalentMonthly ? <p className="v2-pricing-equivalent">{price.equivalentMonthly} / month, billed yearly</p> : null}
              {price.savingsLabel ? <span className="v2-pricing-savings">{price.savingsLabel}</span> : null}
              <p className="v2-pricing-credits">{price.credits}</p>
              {price.outputEstimate ? (
                <div className="v2-pricing-usage">
                  <p className="v2-pricing-usage-title">Approximate {price.outputEstimate.period === "year" ? "yearly" : "monthly"} output</p>
                  <div className="v2-pricing-usage-grid">
                    <div className="v2-pricing-usage-option">
                      <strong>~{price.outputEstimate.photos}</strong>
                      <span>product photos</span>
                    </div>
                    <span className="v2-pricing-usage-or">or</span>
                    <div className="v2-pricing-usage-option">
                      <strong>~{price.outputEstimate.fifteenSecondVideos}</strong>
                      <span>15-second videos</span>
                    </div>
                  </div>
                </div>
              ) : null}
              {plan.features.length ? <p className="v2-pricing-features-title">Plan details</p> : null}
              {plan.features.length ? <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : null}
              {price.checkoutEnabled ? (
                <a className="v2-pricing-cta" href={price.checkoutHref}>Choose {plan.name}</a>
              ) : (
                <button aria-disabled="true" className="v2-pricing-cta is-disabled" disabled type="button">Checkout coming soon</button>
              )}
            </article>
          );
        })}
      </div>
      {visiblePlans[0]?.prices[period]?.outputEstimate?.note ? (
        <p className="v2-pricing-estimate-note">{visiblePlans[0].prices[period].outputEstimate.note}</p>
      ) : null}
      {visiblePlans.some((plan) => !plan.prices[period]?.checkoutEnabled) ? (
        <p className="v2-pricing-note">Subscription checkout is not currently available.</p>
      ) : null}
    </div>
  );
}
