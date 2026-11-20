import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import type { AidreamcapesV2Navigation } from "@/lib/types";
import { AidreamcapesV2Shell } from "@/components/storefront/aidreamcapes-v2/shell";
import { aidreamcapesV2Company } from "@/components/storefront/aidreamcapes-v2/company";
import { aidreamcapesV2ThemeCssHref } from "@/components/storefront/aidreamcapes-v2/styles";
import {
  AidreamcapesCheckoutSelector,
  CHECKOUT_PAYMENT_CHANNELS,
  type CheckoutPackView,
  type CheckoutTierView
} from "@/components/storefront/aidreamcapes-v2/checkout-selector";
import { loadAidreamcapesChrome } from "@/lib/aidreamcapes-workspace/media-detail.server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { isPublicPriceFact } from "@/lib/storefront-context/facts";
import { prisma } from "@/lib/prisma";
import { AIVIDEOSUGC_SITE_ID } from "@/lib/aidreamcapes-workspace/types";

/** The private plan-confirmation and checkout page. Pricing buttons land here
 * with the chosen plan in the address, the shopper confirms the term, and a
 * signed-in account continues into the hosted payment page. Guests get the
 * same summary plus a log-in handoff; nothing about the plan is hidden behind
 * client fetches — every option and its purchasable price ships in the ones
 * server-rendered payload and tab switches are client state. */

type CheckoutTierTerm = {
  price?: string;
  strike?: string;
  perMonth?: string;
  savingsLabel?: string;
  periodLabel?: string;
};

type CheckoutTier = {
  id: string;
  name: string;
  who?: string;
  badge?: string;
  features?: string[];
  creditsPerMonth: number;
  terms: Record<string, CheckoutTierTerm>;
};

type CheckoutPack = {
  id: string;
  name: string;
  note?: string;
  price: string;
  credits: number;
  popular?: boolean;
};

type PricingSettingsData = {
  tiers?: CheckoutTier[];
  packs?: CheckoutPack[];
  creditSchedule?: { photoCredits?: number; fifteenSecondVideoCredits?: number };
};

const TERM_LABELS: Record<string, string> = { "1": "1 month", "6": "6 months", "12": "12 months" };

function parseAmountToCents(label: string | undefined): number | undefined {
  if (typeof label !== "string") return undefined;
  const match = label.replace(/,/g, "").match(/^\$?(\d+(?:\.\d{1,2})?)$/);
  if (!match) return undefined;
  return Math.round(Number.parseFloat(match[1]) * 100);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function numberField(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const CHECKOUT_FAQ = [
  {
    q: "What happens to credits I do not use?",
    a: "Package credits are delivered monthly and expire at the end of each month of your term. Credits from a one-time credit pack stay valid for 24 months. When a job fails, its credits return to your balance on their own."
  },
  {
    q: "Can I move to a larger package later?",
    a: "Switch to a bigger package from your account page. You pay only the difference for the rest of your term, and your unused credits carry over. Email support@aivideosugc.com if you need help."
  },
  {
    q: "Does the purchase renew on its own?",
    a: "No. Every package and credit pack is one payment with no auto-renewal. When a term ends, you choose whether to buy again."
  }
];

const CHECKOUT_FAQ_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: CHECKOUT_FAQ.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a }
  }))
});

export function aidreamcapesCheckoutMetadata(): Metadata {
  return {
    title: "Checkout | AIVideosUGC",
    description: "Confirm your AIVideosUGC credit package or credit pack and continue to payment.",
    robots: { index: false, follow: false }
  };
}

/** One relational pass over the sellable products: every verified one-time
 * price is indexed by the plan term or credit pack it settles, so the checkout
 * selector can resolve any option client-side without another query. */
async function purchasablePriceIndex(): Promise<{ tierTerm: Map<string, string>; pack: Map<string, string> }> {
  const products = await prisma.product.findMany({
    where: { siteId: AIVIDEOSUGC_SITE_ID, status: "active" },
    include: { prices: { where: { status: "active" } } }
  });
  const tierTerm = new Map<string, string>();
  const pack = new Map<string, string>();
  for (const product of products) {
    const metadata = record(product.metadata);
    const planId = str(metadata.planId);
    const packId = str(metadata.packId);
    if (!planId && !packId) continue;
    for (const price of product.prices) {
      if (price.interval !== "one_time") continue;
      if (!isPublicPriceFact(price)) continue;
      if (planId) tierTerm.set(`${planId}:${price.amountCents}`, price.id);
      if (packId) pack.set(`${packId}:${price.amountCents}`, price.id);
    }
  }
  return { tierTerm, pack };
}

export async function AidreamcapesCheckoutPage({
  plan,
  term,
  pack,
  basePath = ""
  }: {
  plan?: string;
  term?: string;
  pack?: string;
  basePath?: string;
}) {
  const [chrome, customer, pricingPage, priceIndex] = await Promise.all([
    loadAidreamcapesChrome(),
    getCurrentCustomerForSite(AIVIDEOSUGC_SITE_ID),
    prisma.livePage.findUnique({
      where: { siteId_slug: { siteId: AIVIDEOSUGC_SITE_ID, slug: "/pricing" } },
      select: { contentJson: true }
    }),
    purchasablePriceIndex()
  ]);
  if (!chrome) notFound();
  const settings = record(record(record(record(pricingPage?.contentJson).sections).v2_main).settings).data as PricingSettingsData | undefined;
  const tiers = Array.isArray(settings?.tiers) ? settings.tiers : [];
  const packs = Array.isArray(settings?.packs) ? settings.packs : [];
  const photoCredits = numberField(settings?.creditSchedule?.photoCredits, 1);
  const videoCredits = numberField(settings?.creditSchedule?.fifteenSecondVideoCredits, 20);

  const termKeysOf = (item: CheckoutTier): string[] =>
    Object.keys(item.terms ?? {})
      .filter((key) => TERM_LABELS[key])
      .sort((a, b) => Number(a) - Number(b));

  const tierViews: CheckoutTierView[] = tiers.map((item) => ({
    id: item.id,
    name: item.name,
    who: item.who,
    badge: item.badge,
    features: Array.isArray(item.features) ? item.features : [],
    creditsPerMonth: numberField(item.creditsPerMonth, 0),
    terms: termKeysOf(item).map((key) => {
      const quote = item.terms[key] ?? {};
      const cents = parseAmountToCents(str(quote.price));
      return {
        key,
        label: TERM_LABELS[key],
        price: str(quote.price),
        strike: str(quote.strike) || undefined,
        perMonth: str(quote.perMonth) || undefined,
        savingsLabel: str(quote.savingsLabel) || undefined,
        periodLabel: str(quote.periodLabel) || undefined,
        priceId: cents ? priceIndex.tierTerm.get(`${item.id}:${cents}`) : undefined
      };
    })
  }));

  const packViews: CheckoutPackView[] = packs.map((item) => {
    const cents = parseAmountToCents(item.price);
    return {
      id: item.id,
      name: item.name,
      note: item.note,
      price: item.price,
      credits: numberField(item.credits, 0),
      popular: Boolean(item.popular),
      priceId: cents ? priceIndex.pack.get(`${item.id}:${cents}`) : undefined
    };
  });

  const packItem = pack ? packViews.find((item) => item.id === pack) : undefined;
  const tierView = !packItem && plan ? tierViews.find((item) => item.id === plan) : undefined;
  if (!packItem && !tierView) redirect(`${basePath}/pricing`);
  const initial = packItem
    ? ({ kind: "pack", packId: packItem.id } as const)
    : ({
        kind: "tier",
        tierId: tierView!.id,
        termKey: term && ["1", "6", "12"].includes(term) && tierView!.terms.some((item) => item.key === term)
          ? term
          : tierView!.terms[0]?.key ?? "1"
      } as const);

  const company = aidreamcapesV2Company(chrome.identity);
  const headerAccount = customer ? { href: `${basePath}/account`, label: "My account" } : undefined;
  const headerCustomer = customer
    ? { balance: customer.customer.balance, email: customer.customer.email, name: customer.customer.name, profile: customer.customer.profile }
    : undefined;

  return (
    <AidreamcapesV2Shell
      articles={chrome.articles}
      articlesTitle={chrome.articlesTitle}
      company={company}
      headerAccount={headerAccount}
      headerCustomer={headerCustomer}
      navigation={chrome.navigation as AidreamcapesV2Navigation}
      r={{ asset: (value: string) => value, href: (value: string) => value, copy: {} }}
      siteId={AIVIDEOSUGC_SITE_ID}
    >
      <link rel="stylesheet" href={aidreamcapesV2ThemeCssHref()} precedence="high" />
      <style>{ACO_CSS}</style>
      <div className="aco">
        <AidreamcapesCheckoutSelector
          basePath={basePath}
          channels={CHECKOUT_PAYMENT_CHANNELS}
          customer={customer ? {
            id: customer.customer.id,
            email: customer.customer.email,
            availableCredits: customer.customer.balance?.available ?? 0
          } : undefined}
          initial={initial}
          packs={packViews}
          photoCredits={photoCredits}
          siteId={AIVIDEOSUGC_SITE_ID}
          tiers={tierViews}
          videoCredits={videoCredits}
        />

        <section className="aco-faq">
          <span className="aco-kicker">Before you pay</span>
          <h2>The questions we get at checkout.</h2>
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: CHECKOUT_FAQ_JSON_LD }} />
          {CHECKOUT_FAQ.map((item, index) => (
            <details key={item.q} open={index === 0}><summary>{item.q}</summary><p>{item.a}</p></details>
          ))}
        </section>
      </div>
    </AidreamcapesV2Shell>
  );
}

/** Route entry for /checkout on the AIVideosUGC storefront (both catch-alls). */
export async function renderAidreamcapesCheckoutPage({ plan, term, pack, basePath = "" }: { plan?: string; term?: string; pack?: string; basePath?: string }) {
  return <AidreamcapesCheckoutPage plan={plan} term={term} pack={pack} basePath={basePath} />;
}

const ACO_CSS = `
.aco { --aco-ink: #f5f5f7; --aco-ink-2: #b8b8c2; --aco-ink-3: #8a8a96; --aco-line: rgba(255,255,255,.10); --aco-line-2: rgba(255,255,255,.18);
  --aco-grad: linear-gradient(90deg,#8b5cf6,#ec4899 55%,#3b82f6); font-family: inherit; line-height: 1.6; padding-bottom: 56px; }
.aco *, .aco *::before, .aco *::after { box-sizing: border-box; }
.aco a { color: inherit; text-decoration: none; }
.aco section { max-width: 1080px; margin: 0 auto; padding-left: 24px; padding-right: 24px; }
.aco .aco-hero { padding-top: 56px; padding-bottom: 8px; }
.aco .aco-eyebrow { display: inline-flex; align-items: center; font-size: 12px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: var(--aco-ink-3); }
.aco h1 { margin: 18px 0 0; font-size: clamp(30px, 3.8vw, 44px); line-height: 1.08; font-weight: 600; letter-spacing: -.028em; }
.aco .aco-lead { margin: 18px 0 0; font-size: 15.5px; line-height: 1.7; color: var(--aco-ink-2); max-width: 640px; }
.aco .aco-grid { display: grid; grid-template-columns: minmax(0,1.25fr) minmax(0,.95fr); gap: 20px; margin-top: 36px; }
.aco .aco-summary, .aco .aco-payment { border: 1px solid var(--aco-line-2); border-radius: 20px; padding: 26px 26px 24px;
  background: linear-gradient(160deg,rgba(255,255,255,.045),rgba(255,255,255,.015) 48%),var(--card, rgba(255,255,255,.03)); }
.aco .aco-product-switch { display: grid; gap: 8px; margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid var(--aco-line); }
.aco .aco-switch-group { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.aco .aco-switch-label { font-size: 11px; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; color: var(--aco-ink-3); margin-right: 4px; }
.aco .aco-switch { border: 1px solid var(--aco-line-2); border-radius: 999px; padding: 8px 15px; font: inherit; font-size: 13px; font-weight: 650; color: var(--aco-ink-2); background: transparent; cursor: pointer; transition: border-color .2s, color .2s; }
.aco .aco-switch:hover { border-color: rgba(255,255,255,.34); color: var(--aco-ink); }
.aco .aco-switch.is-active { background: rgba(139,92,246,.22); border-color: rgba(168,85,247,.72); color: #ddd0ff; }
.aco .aco-summary-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.aco .aco-summary-head h2 { margin: 0; font-size: 22px; line-height: 1.2; font-weight: 650; letter-spacing: -.02em; }
.aco .aco-badge { border: 1px solid rgba(196,181,253,.3); border-radius: 999px; background: var(--aco-grad); padding: 4px 12px;
  color: #fff; font-size: 10.5px; font-weight: 800; letter-spacing: .06em; white-space: nowrap; }
.aco .aco-who { margin: 10px 0 0; color: var(--aco-ink-2); font-size: 13.5px; line-height: 1.55; }
.aco .aco-terms { display: flex; gap: 4px; padding: 5px; border: 1px solid var(--aco-line-2); border-radius: 999px;
  background: rgba(0,0,0,.28); margin: 20px auto 0; width: max-content; max-width: 100%; flex-wrap: wrap; }
.aco .aco-terms button { min-width: 112px; border: 0; border-radius: 999px; background: transparent; padding: 10px 18px;
  color: var(--aco-ink-2); font: inherit; font-size: 13.5px; font-weight: 650; text-align: center; cursor: pointer; }
.aco .aco-terms button.is-active { background: var(--aco-grad); color: #fff; box-shadow: 0 6px 22px rgba(139,92,246,.22); }
.aco .aco-amount { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-top: 20px; }
.aco .aco-amount strong { font-size: clamp(30px,3vw,40px); line-height: 1; font-weight: 750; letter-spacing: -.045em; }
.aco .aco-amount .aco-strike { color: var(--aco-ink-3); font-size: 15px; text-decoration: line-through; }
.aco .aco-amount .aco-per { color: var(--aco-ink-2); font-size: 13.5px; }
.aco .aco-equiv { margin: 8px 0 0; color: var(--aco-ink-3); font-size: 12.5px; }
.aco .aco-savings { align-self: flex-start; margin-top: 9px; border-radius: 999px; background: rgba(16,185,129,.15);
  padding: 4px 9px; color: #8cf0c5; font-size: 11px; font-weight: 700; }
.aco .aco-credits { margin: 16px 0 0; border-top: 1px solid var(--aco-line); padding-top: 14px; color: var(--aco-ink); font-size: 16px; font-weight: 700; }
.aco .aco-credits span { display: block; margin-top: 3px; color: var(--aco-ink-3); font-size: 12px; font-weight: 500; }
.aco .aco-usage { margin-top: 12px; border: 1px solid var(--aco-line-2); border-radius: 14px; background: rgba(255,255,255,.025); padding: 13px 14px; }
.aco .aco-usage-title { margin: 0; color: var(--aco-ink-2); font-size: 11px; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
.aco .aco-usage-grid { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; gap: 8px; margin-top: 10px; }
.aco .aco-usage-grid strong { font-size: 20px; line-height: 1.1; letter-spacing: -.03em; }
.aco .aco-usage-grid span { color: var(--aco-ink-2); font-size: 11px; }
.aco .aco-usage-grid .aco-or { color: var(--aco-ink-3); font-size: 11px; }
.aco .aco-features-title { margin: 16px 0 0; color: var(--aco-ink); font-size: 13px; font-weight: 750; }
.aco .aco-features { display: grid; gap: 10px; margin: 12px 0 0; padding: 0; list-style: none; color: var(--aco-ink-2); font-size: 13px; line-height: 1.5; }
.aco .aco-features li { position: relative; padding-left: 22px; }
.aco .aco-features li:before { position: absolute; left: 1px; top: 0; color: #a78bfa; content: "\\2713"; font-weight: 800; }
.aco .aco-trust { display: flex; align-items: center; gap: 8px; margin: 22px 0 0; padding-top: 14px; border-top: 1px solid var(--aco-line);
  color: var(--aco-ink-3); font-size: 12.5px; }
.aco .aco-trust svg { width: 14px; height: 14px; flex: 0 0 auto; }
.aco .aco-payment-head { display: flex; align-items: center; gap: 10px; }
.aco .aco-payment-head h2 { margin: 0; font-size: 18px; font-weight: 650; }
.aco .aco-payment-head svg { width: 18px; height: 18px; color: #d8b4fe; }
.aco .aco-order-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 18px;
  border: 1px solid var(--aco-line); border-radius: 12px; background: rgba(0,0,0,.25); padding: 13px 15px; font-size: 14px; }
.aco .aco-order-line span { color: var(--aco-ink-2); }
.aco .aco-order-line strong { font-size: 16px; font-weight: 750; }
.aco .aco-methods { margin-top: 14px; border: 1px solid var(--aco-line); border-radius: 14px; background: rgba(255,255,255,.025); padding: 14px 16px; }
.aco .aco-methods-title { margin: 0; color: var(--aco-ink-2); font-size: 11px; font-weight: 750; letter-spacing: .09em; text-transform: uppercase; }
.aco .aco-channel { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.aco .aco-channel-select { -webkit-appearance: none; appearance: none; border: 1px solid var(--aco-line-2); border-radius: 10px;
  background-color: rgba(0,0,0,.35); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%238a8a96' d='M5 6 0 0h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 11px center; color: var(--aco-ink); font: inherit; font-size: 12.5px; font-weight: 650;
  padding: 9px 30px 9px 12px; cursor: pointer; }
.aco .aco-channel-select:hover { border-color: rgba(255,255,255,.34); }
.aco .aco-channel-detail { margin: 8px 0 0; color: var(--aco-ink-3); font-size: 12px; }
.aco .aco-methods-note { margin: 12px 0 0; font-size: 12.5px; line-height: 1.55; color: var(--aco-ink-2); }
.aco .aco-methods-note b { color: var(--aco-ink); }
.aco .aco-methods-trust { display: flex; align-items: center; gap: 7px; margin: 10px 0 0; font-size: 11.5px; color: var(--aco-ink-3); }
.aco .aco-methods-trust svg { flex: 0 0 auto; }
.aco .aco-account-lines { margin-top: 14px; display: grid; gap: 8px; font-size: 13px; }
.aco .aco-account-lines div { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.aco .aco-account-lines span { color: var(--aco-ink-3); }
.aco .aco-account-lines b { font-weight: 600; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.aco .aco-pay-action { margin-top: 18px; }
.aco .aco-btn-primary { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
  background: var(--aco-grad); color: #fff; font-weight: 650; font-size: 14.5px; border: 0; border-radius: 12px;
  padding: 15px 24px; cursor: pointer; transition: transform .2s, box-shadow .2s; box-shadow: 0 14px 40px -16px rgba(139,92,246,.65); }
.aco .aco-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 20px 48px -16px rgba(236,72,153,.6); }
.aco .aco-btn-primary:disabled { cursor: wait; opacity: .8; transform: none; }
.aco .aco-btn-primary svg { width: 15px; height: 15px; }
.aco .aco-hidden { display: none; }
.aco .aco-spin { animation: aco-rotate 1s linear infinite; }
@keyframes aco-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.aco .aco-pay-failure { margin: 12px 0 0; border: 1px solid rgba(251,191,36,.25); border-radius: 12px;
  background: rgba(251,191,36,.08); padding: 12px 14px; font-size: 13px; line-height: 1.55; color: #fde68a; }
.aco .aco-login, .aco .aco-pending { margin-top: 18px; border: 1px solid var(--aco-line-2); border-radius: 16px;
  background: rgba(0,0,0,.28); padding: 22px; }
.aco .aco-login h3, .aco .aco-pending h3 { margin: 0 0 10px; font-size: 17px; font-weight: 650; }
.aco .aco-login p, .aco .aco-pending p { margin: 0 0 10px; font-size: 13.5px; color: var(--aco-ink-2); line-height: 1.6; }
.aco .aco-login .aco-btn-primary { margin-top: 6px; }
.aco .aco-login-hint { color: var(--aco-ink-3); font-size: 12px; }
.aco .aco-btn-ghost { display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
  border: 1px solid var(--aco-line-2); color: var(--aco-ink); font: inherit; font-weight: 600; font-size: 13.5px; border-radius: 12px;
  padding: 13px 20px; cursor: pointer; background: transparent; transition: border-color .2s; margin-top: 8px; }
.aco .aco-btn-ghost:hover { border-color: rgba(255,255,255,.34); }
.aco .aco-back { display: inline-flex; align-items: center; justify-content: center; margin-top: 14px;
  color: var(--aco-ink-3); font-size: 13px; }
.aco .aco-back:hover { color: var(--aco-ink-2); }
.aco .aco-faq { margin-top: 64px; border-top: 1px solid var(--aco-line); padding-top: 48px; max-width: 820px; }
.aco .aco-kicker { font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #d8b4fe; }
.aco .aco-faq h2 { margin: 12px 0 0; font-size: clamp(22px,2.6vw,30px); font-weight: 600; letter-spacing: -.02em; }
.aco .aco-faq details { border: 1px solid var(--aco-line); border-radius: 14px; background: rgba(255,255,255,.025); margin-top: 14px; overflow: hidden; }
.aco .aco-faq summary { cursor: pointer; list-style: none; padding: 16px 20px; font-weight: 600; font-size: 14.5px; display: flex; justify-content: space-between; align-items: center; }
.aco .aco-faq summary::-webkit-details-marker { display: none; }
.aco .aco-faq summary::after { content: "+"; color: var(--aco-ink-3); font-size: 17px; }
.aco .aco-faq details[open] summary::after { content: "\\2212"; color: #d8b4fe; }
.aco .aco-faq details p { margin: 0; padding: 0 20px 18px; color: var(--aco-ink-2); font-size: 13.5px; line-height: 1.65; }
@media (max-width: 900px) {
  .aco .aco-grid { grid-template-columns: 1fr; }
  .aco .aco-hero { padding-top: 40px; }
  .aco .aco-terms { border-radius: 18px; }
}
`;
