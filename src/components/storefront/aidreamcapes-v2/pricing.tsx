import { Section } from "./parts";
import { copyLabel, type V2Resolvers } from "./types";
import { AidreamcapesPricingToggle } from "./pricing-toggle";
import { AidreamcapesPackageCards } from "./package-cards";


const pricingCss = `
.adc2 .v2-pricing-content{display:grid;gap:28px}
.adc2 .v2-pricing-periods{justify-self:center;display:inline-flex;gap:4px;padding:5px;border:1px solid var(--line-2);border-radius:999px;background:var(--card)}
.adc2 .v2-pricing-periods button{min-width:112px;border:0;border-radius:999px;background:transparent;padding:10px 18px;color:var(--ink-2);font-size:14px;font-weight:650;cursor:pointer}
.adc2 .v2-pricing-periods button.is-active{background:var(--grad);color:#fff;box-shadow:0 6px 22px rgba(139,92,246,.22)}
.adc2 .v2-pricing-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));align-items:stretch;gap:18px}
.adc2 .v2-pricing-card{position:relative;display:flex;min-width:0;flex-direction:column;overflow:hidden;border:1px solid var(--line-2);border-radius:20px;background:linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.015) 48%),var(--card);padding:27px 25px 24px;box-shadow:0 18px 48px rgba(0,0,0,.22)}
.adc2 .v2-pricing-card.is-featured{border-color:rgba(168,85,247,.72);box-shadow:0 20px 56px rgba(91,33,182,.2),inset 0 1px rgba(255,255,255,.08)}
.adc2 .v2-pricing-card h3{font-size:22px;line-height:1.2}
.adc2 .v2-pricing-badge{align-self:flex-start;margin-bottom:12px;border:1px solid rgba(196,181,253,.3);border-radius:999px;background:rgba(139,92,246,.16);padding:4px 10px;color:#ddd0ff;font-size:11px;font-weight:700;letter-spacing:.02em}
.adc2 .v2-pricing-summary{min-height:48px;margin-top:10px!important;color:var(--ink-2);font-size:14px;line-height:1.55}
.adc2 .v2-pricing-amount{display:flex;flex-wrap:wrap;align-items:baseline;gap:5px;margin-top:23px}
.adc2 .v2-pricing-amount strong{font-size:clamp(32px,3vw,43px);line-height:1;font-weight:750;letter-spacing:-.045em}
.adc2 .v2-pricing-amount span{color:var(--ink-2);font-size:14px}
.adc2 .v2-pricing-equivalent{margin-top:9px!important;color:var(--ink-3);font-size:12px}
.adc2 .v2-pricing-savings{align-self:flex-start;margin-top:9px;border-radius:999px;background:rgba(16,185,129,.15);padding:4px 9px;color:#8cf0c5;font-size:11px;font-weight:700}
.adc2 .v2-pricing-credits{margin-top:18px!important;border-top:1px solid var(--line);padding-top:17px;color:var(--ink);font-size:16px;font-weight:700}
.adc2 .v2-pricing-usage{margin-top:16px;border:1px solid var(--line-2);border-radius:14px;background:rgba(255,255,255,.025);padding:14px}
.adc2 .v2-pricing-usage-title{margin:0!important;color:var(--ink-2);font-size:11px;font-weight:750;letter-spacing:.09em;text-transform:uppercase}
.adc2 .v2-pricing-usage-grid{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;margin-top:11px}
.adc2 .v2-pricing-usage-option{display:grid;gap:4px;min-width:0}
.adc2 .v2-pricing-usage-option strong{font-size:20px;line-height:1.1;color:var(--ink);letter-spacing:-.03em}
.adc2 .v2-pricing-usage-option span{color:var(--ink-2);font-size:11px;line-height:1.35}
.adc2 .v2-pricing-usage-or{color:var(--ink-3);font-size:11px}
.adc2 .v2-pricing-features-title{margin:18px 0 0!important;color:var(--ink);font-size:13px;font-weight:750}
.adc2 .v2-pricing-estimate-note{margin:0!important;color:var(--ink-3);font-size:12px;line-height:1.5;text-align:center}
.adc2 .v2-pricing-card ul{display:grid;gap:11px;margin:17px 0 24px;padding:0;list-style:none;color:var(--ink-2);font-size:13px;line-height:1.5}
.adc2 .v2-pricing-card li{position:relative;padding-left:22px}
.adc2 .v2-pricing-card li:before{position:absolute;left:1px;top:0;color:#a78bfa;content:"✓";font-weight:800}
.adc2 .v2-pricing-cta{display:flex;min-height:47px;align-items:center;justify-content:center;margin-top:auto;border:1px solid rgba(255,255,255,.82);border-radius:11px;background:transparent;padding:10px 14px;color:var(--ink);font-size:14px;font-weight:700;text-align:center}
.adc2 .v2-pricing-card.is-featured .v2-pricing-cta{border-color:transparent;background:var(--grad)}
.adc2 .v2-pricing-cta.is-disabled{border-color:var(--line-2);background:rgba(255,255,255,.035);color:var(--ink-3);cursor:not-allowed}
.adc2 .v2-pricing-card.is-featured .v2-pricing-cta.is-disabled{border-color:transparent;background:linear-gradient(90deg,rgba(139,92,246,.35),rgba(236,72,153,.25),rgba(59,130,246,.25));color:rgba(255,255,255,.62)}
.adc2 .v2-pricing-note,.adc2 .v2-pricing-empty{color:var(--ink-3);font-size:13px;line-height:1.6;text-align:center}
.adc2 .v2-pricing-empty{border:1px dashed var(--line-2);border-radius:16px;padding:28px 18px}
@media(max-width:900px){.adc2 .v2-pricing-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:620px){.adc2 .v2-pricing-grid{grid-template-columns:minmax(0,1fr);gap:14px}.adc2 .v2-pricing-card{padding:24px 21px 21px}.adc2 .v2-pricing-summary{min-height:0}.adc2 .v2-pricing-periods button{min-width:102px;padding:9px 14px}}
`;

export function AidreamcapesV2PricingSection({ r }: { r: V2Resolvers }) {
  const packages = r.pricingPackages?.tiers ?? [];
  if (packages.length) {
    return (
      <Section
        eyebrow={copyLabel(r, "Plans & Credits")}
        id="pricing"
        lead={copyLabel(r, "One-time credit packages for one, six, or twelve months — credits delivered monthly, no auto-renewal. Credit packs are open to everyone when a month runs short.")}
        title={copyLabel(r, "Pay Once, Create All Month")}
      >
        <AidreamcapesPackageCards
          creditSchedule={r.pricingPackages?.creditSchedule ?? { photoCredits: 24, fifteenSecondVideoCredits: 60 }}
          tiers={packages}
        />
      </Section>
    );
  }
  const plans = r.pricingPlans ?? [];
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: pricingCss }} />
      <Section
        eyebrow={copyLabel(r, "Plans")}
        id="pricing"
        lead={copyLabel(r, "Compare monthly and yearly credit plans. Each option shows its price and included credits for the selected billing period.")}
        title={copyLabel(r, "Plans for Your Next Campaign")}
      >
        <AidreamcapesPricingToggle labels={r.copy} plans={plans} />
      </Section>
    </>
  );
}
