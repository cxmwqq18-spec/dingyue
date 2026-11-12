"use client";

// Pricing page body for the one-time package + credit-pack model (design
// draft pricing-page-redesign-v3; approved for frontend rollout 2026-11-12).
// Presentation-only client component in the reviewed pricing-toggle category:
// every number, name and label arrives through SSR props from the page's
// LivePage content and the component never fetches anything. Without
// JavaScript the 1-month packages render first, and both lookup tables
// (package prices, pack discounts) carry every value in static HTML.
import { useState } from "react";
import { AidreamcapesPackageCards, EntryCta, PRICING_TERM_LABEL, pricingPageCss } from "./package-cards";
import type { V2CreditPack, V2CreditSchedule, V2PackDiscounts, V2PricingStep, V2PricingTerm, V2PricingTier } from "./types";

const TERMS: V2PricingTerm[] = ["1", "6", "12"];

function money(value: number): string {
  return `$${value % 1 === 0 ? value.toFixed(0) : value.toFixed(2)}`;
}

function priceNumber(price: string): number {
  return Number.parseFloat(price.replace(/[$,]/g, "")) || 0;
}

export function AidreamcapesPricingPage({
  tiers,
  packs,
  packDiscounts,
  steps,
  terms,
  creditSchedule
}: {
  tiers: V2PricingTier[];
  packs: V2CreditPack[];
  packDiscounts: V2PackDiscounts;
  steps: V2PricingStep[];
  terms: string[];
  creditSchedule: V2CreditSchedule;
}) {
  const [memberTier, setMemberTier] = useState<string>("none");
  const [memberTerm, setMemberTerm] = useState<V2PricingTerm>("1");

  const memberDiscount = packDiscounts[memberTier]?.[memberTerm] ?? 0;

  return (
    <div className="v2-pp-content">
      <style dangerouslySetInnerHTML={{ __html: pricingPageCss }} />
      {steps.length ? (
        <div className="v2-pp-steps">
          {steps.map((step, index) => (
            <div className="v2-pp-step" key={step.title}>
              <b><i>{index + 1}</i>{step.title}</b>
              <span>{step.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      <AidreamcapesPackageCards creditSchedule={creditSchedule} tiers={tiers} />

      <div aria-label="Package prices" className="v2-pp-matrix">
        <p className="t">Package prices at a glance</p>
        <table>
          <thead>
            <tr><th scope="col">Package</th>{TERMS.map((value) => <th key={value} scope="col">{PRICING_TERM_LABEL[value]}</th>)}</tr>
          </thead>
          <tbody>
            {tiers.map((tier) => (
              <tr key={tier.id}>
                <td>{tier.name}</td>
                {TERMS.map((value) => {
                  const price = tier.terms[value];
                  return <td key={value}>{price ? `${price.price}${price.perMonth ? ` (${price.perMonth}/mo)` : ""}` : "—"}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="note">Every term is a single payment. Longer terms cost less per month.</p>
      </div>

      <div className="v2-pp-packs-h">
        <h3>One-Time Credit Packs</h3>
        <p>Open to everyone, with or without a package. Valid for 24 months from purchase — no subscription attached.</p>
        <div className="v2-pp-mytier">
          Your package:
          <span className="opts" role="group">
            <button aria-pressed={memberTier === "none"} className={memberTier === "none" ? "is-on" : ""} onClick={() => setMemberTier("none")} type="button">None yet</button>
            {tiers.map((tier) => (
              <button aria-pressed={memberTier === tier.id} className={memberTier === tier.id ? "is-on" : ""} key={tier.id} onClick={() => setMemberTier(tier.id)} type="button">{tier.name}</button>
            ))}
          </span>
          term:
          <span className="opts" role="group">
            {TERMS.map((value) => (
              <button aria-pressed={memberTerm === value} className={memberTerm === value ? "is-on" : ""} key={value} onClick={() => setMemberTerm(value)} type="button">{PRICING_TERM_LABEL[value]}</button>
            ))}
          </span>
        </div>
        <div aria-label="Credit-pack discounts" className="v2-pp-matrix">
          <p className="t">Credit-pack discounts by package</p>
          <table>
            <thead>
              <tr><th scope="col">Package</th>{TERMS.map((value) => <th key={value} scope="col">{PRICING_TERM_LABEL[value]}</th>)}</tr>
            </thead>
            <tbody>
              {tiers.map((tier) => (
                <tr key={tier.id}>
                  <td>{tier.name}</td>
                  {TERMS.map((value) => {
                    const discount = packDiscounts[tier.id]?.[value] ?? 0;
                    const hit = tier.id === memberTier && value === memberTerm;
                    return <td className={hit ? "hit" : ""} key={value}>{discount ? `−${discount}%` : "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note">Longer terms and bigger packages unlock deeper pack discounts.</p>
        </div>
      </div>

      <div className="v2-pp-packs">
        {packs.map((pack) => {
          const discount = memberDiscount;
          const listPrice = priceNumber(pack.price);
          const finalPrice = discount ? listPrice * (1 - discount / 100) : listPrice;
          const perCredit = finalPrice / pack.credits;
          return (
            <div className={`v2-pp-pack${pack.popular ? " is-hot" : ""}`} key={pack.id}>
              {pack.popular ? <span className="v2-pp-pop">MOST POPULAR</span> : null}
              <span className="pc">{pack.name}</span>
              <div className="pp">
                {discount ? <span className="strike">{pack.price}</span> : null}
                <strong>{money(Math.round(finalPrice * 100) / 100)}</strong>
                {discount ? <span className="disc">{discount}% off</span> : null}
              </div>
              <p className="rate">{pack.credits.toLocaleString("en-US")} credits · ${perCredit.toFixed(3)} per credit</p>
              <p className="pnote">{pack.note}</p>
              <EntryCta className="cta2" href={pack.href ?? "/app/create"}>Buy {pack.credits.toLocaleString("en-US")} credits</EntryCta>
            </div>
          );
        })}
      </div>

      {terms.length ? (
        <p className="v2-pp-terms">
          {terms.map((line) => <span key={line}>{line}</span>)}
        </p>
      ) : null}
    </div>
  );
}
