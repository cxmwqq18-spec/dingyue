"use client";

// One-time credit-package cards with the 1/6/12-month term switch. Shared by
// the /pricing page body and the homepage pricing block. Presentation-only:
// every number and label arrives through SSR props and nothing is fetched.
// Without JavaScript the 1-month packages render server-side and the lookup
// table below the cards still carries every term's price.
import { useState } from "react";
import { workspaceEntryTarget } from "@/lib/aidreamcapes-workspace/entry-transfer";
import type { V2CreditSchedule, V2PricingTerm, V2PricingTier } from "./types";

// Full stylesheet for the package pricing presentation (cards, term switch,
// lookup tables, credit packs and the centered prose sections). Rendered once
// wherever package cards appear.
export const pricingPageCss = `
.adc2 .v2-pp-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;max-width:960px;margin:0 auto 6px}
.adc2 .v2-pp-step{border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.02);padding:14px 16px}
.adc2 .v2-pp-step b{display:block;font-size:13px;margin-bottom:4px}
.adc2 .v2-pp-step b i{font-style:normal;color:#a78bfa;font-weight:800;margin-right:6px}
.adc2 .v2-pp-step span{display:block;font-size:12.5px;color:var(--ink-2);line-height:1.55}
.adc2 .v2-pp-periods{display:flex;gap:4px;padding:5px;border:1px solid var(--line-2);border-radius:999px;background:var(--card);margin:24px auto 0;width:max-content}
.adc2 .v2-pp-periods button{min-width:128px;border:0;border-radius:999px;background:transparent;padding:10px 18px;color:var(--ink-2);font-size:14px;font-weight:650;cursor:pointer;display:flex;align-items:center;gap:8px;justify-content:center}
.adc2 .v2-pp-periods button.is-active{background:var(--grad);color:#fff;box-shadow:0 6px 22px rgba(139,92,246,.22)}
.adc2 .v2-pp-save-tag{font-size:10.5px;font-weight:800;background:rgba(255,255,255,.18);border-radius:999px;padding:1px 7px}
.adc2 .v2-pp-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:26px}
.adc2 .v2-pp-card{position:relative;display:flex;flex-direction:column;overflow:hidden;border:1px solid var(--line-2);border-radius:20px;background:linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.015) 48%),var(--card);padding:27px 25px 24px;box-shadow:0 18px 48px rgba(0,0,0,.22)}
.adc2 .v2-pp-card.is-featured{border-color:rgba(168,85,247,.72);box-shadow:0 20px 56px rgba(91,33,182,.2),inset 0 1px rgba(255,255,255,.08)}
.adc2 .v2-pp-badge{align-self:flex-start;margin-bottom:12px;border:1px solid rgba(196,181,253,.3);border-radius:999px;background:rgba(139,92,246,.16);padding:4px 10px;color:#ddd0ff;font-size:11px;font-weight:700}
.adc2 .v2-pp-card h3{font-size:22px;line-height:1.2;margin:0}
.adc2 .v2-pp-who{min-height:44px;margin:10px 0 0;color:var(--ink-2);font-size:13.5px;line-height:1.55}
.adc2 .v2-pp-amount{display:flex;flex-wrap:wrap;align-items:baseline;gap:7px;margin-top:20px}
.adc2 .v2-pp-amount strong{font-size:clamp(30px,3vw,41px);line-height:1;font-weight:750;letter-spacing:-.045em}
.adc2 .v2-pp-amount .per{color:var(--ink-2);font-size:13.5px}
.adc2 .v2-pp-amount .strike{color:var(--ink-3);font-size:15px;text-decoration:line-through}
.adc2 .v2-pp-equiv{margin:8px 0 0;color:var(--ink-3);font-size:12.5px}
.adc2 .v2-pp-savings{align-self:flex-start;margin-top:9px;border-radius:999px;background:rgba(16,185,129,.15);padding:4px 9px;color:#8cf0c5;font-size:11px;font-weight:700}
.adc2 .v2-pp-credits{margin-top:16px;border-top:1px solid var(--line);padding-top:15px;color:var(--ink);font-size:16px;font-weight:700}
.adc2 .v2-pp-credits span{display:block;margin-top:3px;color:var(--ink-3);font-size:12px;font-weight:500}
.adc2 .v2-pp-usage{margin-top:12px;border:1px solid var(--line-2);border-radius:14px;background:rgba(255,255,255,.025);padding:13px 14px}
.adc2 .v2-pp-usage .t{margin:0;color:var(--ink-2);font-size:11px;font-weight:750;letter-spacing:.09em;text-transform:uppercase}
.adc2 .v2-pp-ugrid{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-top:10px}
.adc2 .v2-pp-ugrid strong{font-size:20px;line-height:1.1;letter-spacing:-.03em}
.adc2 .v2-pp-ugrid span{color:var(--ink-2);font-size:11px}
.adc2 .v2-pp-ugrid .or{color:var(--ink-3);font-size:11px}
.adc2 .v2-pp-feat-t{margin:16px 0 0;color:var(--ink);font-size:13px;font-weight:750}
.adc2 .v2-pp-card ul{display:grid;gap:10px;margin:13px 0 22px;padding:0;list-style:none;color:var(--ink-2);font-size:13px;line-height:1.5}
.adc2 .v2-pp-card li{position:relative;padding-left:22px}
.adc2 .v2-pp-card li:before{position:absolute;left:1px;top:0;color:#a78bfa;content:"\\2713";font-weight:800}
.adc2 .v2-pp-cta{display:flex;min-height:47px;align-items:center;justify-content:center;margin-top:auto;border:1px solid rgba(255,255,255,.82);border-radius:11px;background:transparent;color:var(--ink);font-size:14px;font-weight:700;text-decoration:none}
.adc2 .v2-pp-card.is-featured .v2-pp-cta{border-color:transparent;background:var(--grad)}
.adc2 .v2-pp-matrix{max-width:560px;margin:26px auto 0;border:1px solid var(--line-2);border-radius:14px;background:var(--card);padding:16px 18px;font-size:13px}
.adc2 .v2-pp-matrix .t{margin:0 0 10px;font-size:11px;font-weight:750;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-2);text-align:center}
.adc2 .v2-pp-matrix table{width:100%;border-collapse:collapse}
.adc2 .v2-pp-matrix th{font-size:11.5px;color:var(--ink-3);font-weight:650;padding:5px 6px;text-align:right}
.adc2 .v2-pp-matrix th:first-child{text-align:left}
.adc2 .v2-pp-matrix td{padding:6px;border-top:1px solid var(--line);text-align:right;color:var(--ink-2)}
.adc2 .v2-pp-matrix td:first-child{text-align:left;color:var(--ink);font-weight:650}
.adc2 .v2-pp-matrix td.hit{color:#8cf0c5;font-weight:700}
.adc2 .v2-pp-matrix .note{margin:10px 0 0;font-size:11.5px;color:var(--ink-3);text-align:center}
.adc2 .v2-pp-packs-h{margin:54px 0 6px;text-align:center}
.adc2 .v2-pp-packs-h h3{font-size:26px;letter-spacing:-.02em;margin:0 0 6px;font-weight:750}
.adc2 .v2-pp-packs-h p{color:var(--ink-2);margin:0 auto;font-size:14px;max-width:640px}
.adc2 .v2-pp-mytier{display:flex;align-items:center;gap:8px;justify-content:center;margin-top:16px;font-size:13px;color:var(--ink-2);flex-wrap:wrap}
.adc2 .v2-pp-mytier .opts{display:inline-flex;gap:4px;padding:4px;border:1px solid var(--line-2);border-radius:999px;background:var(--card)}
.adc2 .v2-pp-mytier button{border:0;border-radius:999px;background:transparent;padding:6px 14px;color:var(--ink-2);font-size:12.5px;font-weight:650;cursor:pointer}
.adc2 .v2-pp-mytier button.is-on{background:rgba(139,92,246,.22);color:#ddd0ff}
.adc2 .v2-pp-packs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:20px}
.adc2 .v2-pp-pack{border:1px solid var(--line-2);border-radius:20px;background:var(--card);padding:24px;display:flex;flex-direction:column;position:relative}
.adc2 .v2-pp-pack .pc{font-size:15px;font-weight:750}
.adc2 .v2-pp-pack .pp{display:flex;align-items:baseline;gap:8px;margin-top:14px;flex-wrap:wrap}
.adc2 .v2-pp-pack .pp strong{font-size:32px;letter-spacing:-.04em;font-weight:750}
.adc2 .v2-pp-pack .pp .strike{color:var(--ink-3);font-size:15px;text-decoration:line-through}
.adc2 .v2-pp-pack .rate{margin-top:8px;color:var(--ink-3);font-size:12px}
.adc2 .v2-pp-pack .disc{display:inline-block;margin-left:auto;border-radius:999px;background:rgba(16,185,129,.15);padding:3px 9px;color:#8cf0c5;font-size:11px;font-weight:700}
.adc2 .v2-pp-pack .pnote{margin-top:10px;color:var(--ink-2);font-size:12.5px;line-height:1.55}
.adc2 .v2-pp-pack .cta2{margin-top:16px;display:flex;min-height:44px;align-items:center;justify-content:center;border:1px solid var(--line-2);border-radius:11px;color:var(--ink);font-size:13.5px;font-weight:700;text-decoration:none}
.adc2 .v2-pp-pack.is-hot{border-color:rgba(168,85,247,.72)}
.adc2 .v2-pp-pop{position:absolute;top:-11px;left:50%;transform:translateX(-50%);background:var(--grad);color:#fff;font-size:10.5px;font-weight:800;letter-spacing:.06em;border-radius:999px;padding:4px 12px;white-space:nowrap}
.adc2 .v2-pp-terms{margin-top:30px;color:var(--ink-3);font-size:12.5px;text-align:center;line-height:1.7}
.adc2 .v2-pp-terms span{display:block}
/* Centered prose scope for the /pricing supporting sections (credits intro,
 * per-job costs, FAQ). Scoped to .v2-pp-center so no other page is affected. */
.adc2 .v2-pp-center .sec-head{margin-left:auto;margin-right:auto;text-align:center;align-items:center}
.adc2 .v2-pp-center .intro{max-width:780px;margin:0 auto;text-align:center}
.adc2 .v2-pp-center .faq{grid-template-columns:minmax(0,1fr);max-width:820px;margin:0 auto}
.adc2 .v2-pp-center .faq .sec-head{text-align:center;align-items:center;margin-bottom:28px}
.adc2 .v2-pp-center .specs{max-width:900px;margin:0 auto}
.adc2 .v2-pp-center .meta-line{text-align:center}
@media(max-width:900px){.adc2 .v2-pp-grid,.adc2 .v2-pp-packs,.adc2 .v2-pp-steps{grid-template-columns:minmax(0,1fr)}.adc2 .v2-pp-periods{flex-wrap:wrap;border-radius:18px}}
`;

const TERMS: V2PricingTerm[] = ["1", "6", "12"];
export const PRICING_TERM_LABEL: Record<V2PricingTerm, string> = { "1": "1 month", "6": "6 months", "12": "12 months" };
const TERM_SAVE_TAG: Record<V2PricingTerm, string> = { "1": "", "6": "save up to 10%", "12": "save up to 26%" };

/** Same workspace-entry handoff as the server's WorkspaceEntryLink: the inert
 * selection travels in a data attribute, never in the URL. */
export function EntryCta({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  const target = workspaceEntryTarget(href);
  return (
    <a
      className={className}
      data-workspace-entry={target.transfer ? JSON.stringify(target.transfer) : undefined}
      href={target.href}
    >
      {children}
    </a>
  );
}

export function AidreamcapesPackageCards({
  tiers,
  creditSchedule
}: {
  tiers: V2PricingTier[];
  creditSchedule: V2CreditSchedule;
}) {
  const [term, setTerm] = useState<V2PricingTerm>("1");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pricingPageCss }} />
      {tiers.some((tier) => Object.keys(tier.terms).length > 1) ? (
        <div aria-label="Package term" className="v2-pp-periods" role="group">
          {TERMS.map((value) => (
            <button aria-pressed={term === value} className={term === value ? "is-active" : ""} key={value} onClick={() => setTerm(value)} type="button">
              {PRICING_TERM_LABEL[value]}
              {TERM_SAVE_TAG[value] ? <span className="v2-pp-save-tag">{TERM_SAVE_TAG[value]}</span> : null}
            </button>
          ))}
        </div>
      ) : null}
      <div className="v2-pp-grid">
        {tiers.map((tier) => {
          const price = tier.terms[term];
          if (!price) return null;
          const photos = Math.floor(tier.creditsPerMonth / creditSchedule.photoCredits);
          const videos = Math.floor(tier.creditsPerMonth / creditSchedule.fifteenSecondVideoCredits);
          return (
            <article className={`v2-pp-card${tier.badge ? " is-featured" : ""}`} key={tier.id}>
              {tier.badge ? <span className="v2-pp-badge">{tier.badge}</span> : null}
              <h3>{tier.name}</h3>
              <p className="v2-pp-who">{tier.who}</p>
              <div className="v2-pp-amount">
                {price.strike ? <span className="strike">{price.strike}</span> : null}
                <strong>{price.price}</strong>
                <span className="per">{price.periodLabel}</span>
              </div>
              {price.perMonth ? <p className="v2-pp-equiv">{price.perMonth} / month, billed once</p> : null}
              {price.savingsLabel ? <span className="v2-pp-savings">{price.savingsLabel}</span> : null}
              <p className="v2-pp-credits">
                {tier.creditsPerMonth.toLocaleString("en-US")} credits / month
                <span>delivered monthly · one payment, no auto-renewal</span>
              </p>
              <div className="v2-pp-usage">
                <p className="t">Approximate monthly output</p>
                <div className="v2-pp-ugrid">
                  <div><strong>~{photos}</strong><br /><span>product photos</span></div>
                  <span className="or">or</span>
                  <div><strong>~{videos}</strong><br /><span>15-second videos</span></div>
                </div>
              </div>
              {tier.features.length ? <p className="v2-pp-feat-t">Plan details</p> : null}
              {tier.features.length ? <ul>{tier.features.map((feature) => <li key={feature}>{feature}</li>)}</ul> : null}
              <EntryCta className="v2-pp-cta" href={tier.ctaHref}>Get {tier.name}</EntryCta>
            </article>
          );
        })}
      </div>
    </>
  );
}
