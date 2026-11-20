"use client";

import { useMemo, useState } from "react";
import { CreditCard, Lock } from "lucide-react";
import { AidreamcapesCheckoutPayButton } from "./checkout-pay-button";

/**
 * The checkout selector is client state on a private page: switching package,
 * term or credit pack swaps the summary and the payment panel in place. No
 * route navigation and no data request happens on a tab click — every option
 * and its purchasable price arrives in the server-rendered payload, which is
 * why the old link-based tabs (a full RSC round-trip per click) are gone.
 */

export type CheckoutTermView = {
  key: string;
  label: string;
  price?: string;
  strike?: string;
  perMonth?: string;
  savingsLabel?: string;
  periodLabel?: string;
  /** Present only when this term has a verified, publicly purchasable price. */
  priceId?: string;
};

export type CheckoutTierView = {
  id: string;
  name: string;
  who?: string;
  badge?: string;
  features: string[];
  creditsPerMonth: number;
  terms: CheckoutTermView[];
};

export type CheckoutPackView = {
  id: string;
  name: string;
  note?: string;
  price: string;
  credits: number;
  popular?: boolean;
  priceId?: string;
};

export type CheckoutCustomerView = {
  id: string;
  email: string;
  availableCredits: number;
};

export type CheckoutPaymentChannel = {
  id: string;
  label: string;
  detail: string;
  note: string;
  /** Only live channels are selectable; future channels appear disabled. */
  live: boolean;
};

export type CheckoutSelection = { kind: "tier"; tierId: string; termKey: string } | { kind: "pack"; packId: string };

export const CHECKOUT_PAYMENT_CHANNELS: CheckoutPaymentChannel[] = [
  {
    id: "stripe",
    label: "USD · Stripe",
    detail: "Card · Apple Pay · Google Pay",
    note: "Card payments run on Stripe. The secure payment window opens on Stripe's hosted checkout — your card details are entered there and never touch our servers.",
    live: true
  }
];

function termLabel(key: string): string {
  return key === "1" ? "1 month" : key === "6" ? "6 months" : key === "12" ? "12 months" : key;
}

export function AidreamcapesCheckoutSelector({
  basePath = "",
  channels,
  customer,
  initial,
  photoCredits,
  packs,
  siteId,
  tiers,
  videoCredits
}: {
  basePath?: string;
  channels: CheckoutPaymentChannel[];
  customer?: CheckoutCustomerView;
  initial: CheckoutSelection;
  photoCredits: number;
  packs: CheckoutPackView[];
  siteId: string;
  tiers: CheckoutTierView[];
  videoCredits: number;
}) {
  const [selection, setSelection] = useState<CheckoutSelection>(initial);
  const [channelId, setChannelId] = useState(() => channels.find((channel) => channel.live)?.id ?? channels[0]?.id ?? "stripe");
  const selectedChannel = channels.find((channel) => channel.id === channelId) ?? channels[0];

  const tier = selection.kind === "tier" ? tiers.find((item) => item.id === selection.tierId) : undefined;
  const tierTerm = tier && selection.kind === "tier"
    ? tier.terms.find((term) => term.key === selection.termKey) ?? tier.terms[0]
    : undefined;
  const pack = selection.kind === "pack" ? packs.find((item) => item.id === selection.packId) : undefined;

  const heading = selection.kind === "pack" ? "Confirm your credit pack" : "Confirm your plan";
  const lead = selection.kind === "pack"
    ? "Confirm the credit pack, then continue to the secure payment page. Credits land on your account after checkout."
    : "Confirm the package and term, then continue to the secure payment page. Credits are delivered to your account every month of your term.";

  const credits = selection.kind === "pack" ? pack?.credits ?? 0 : tier?.creditsPerMonth ?? 0;
  const amountLabel = selection.kind === "pack" ? pack?.price ?? "" : tierTerm?.price ?? "";
  const priceId = selection.kind === "pack" ? pack?.priceId : tierTerm?.priceId;
  const checkoutPath = selection.kind === "pack"
    ? `${basePath}/checkout?pack=${encodeURIComponent(selection.packId)}`
    : `${basePath}/checkout?plan=${encodeURIComponent(selection.tierId)}&term=${encodeURIComponent(selection.termKey)}`;
  const loginHref = `${basePath}/login?next=${encodeURIComponent(checkoutPath)}`;

  // Keep the address shareable without asking the router for a new render.
  function syncAddress(next: CheckoutSelection) {
    const path = next.kind === "pack"
      ? `${basePath}/checkout?pack=${encodeURIComponent(next.packId)}`
      : `${basePath}/checkout?plan=${encodeURIComponent(next.tierId)}&term=${encodeURIComponent(next.termKey)}`;
    window.history.replaceState(null, "", path);
  }

  function choose(next: CheckoutSelection) {
    setSelection(next);
    syncAddress(next);
  }

  const approxPhotos = Math.floor(credits / Math.max(1, photoCredits));
  const approxVideos = Math.floor(credits / Math.max(1, videoCredits));

  // The first term that is actually purchasable today, used for the switch
  // hint instead of promising whichever term happens to be listed.
  const purchasableTerm = useMemo(() => tier?.terms.find((term) => term.priceId), [tier]);

  return (
    <>
      <section className="aco-hero">
        <span className="aco-eyebrow">Plan &amp; checkout</span>
        <h1>{heading}</h1>
        <p className="aco-lead">{lead}</p>
      </section>

      <section className="aco-grid">
        <article className="aco-summary">
          <div aria-label="Choose your purchase" className="aco-product-switch" role="group">
            <div className="aco-switch-group">
              <span className="aco-switch-label">Packages</span>
              {tiers.map((item) => (
                <button
                  aria-pressed={selection.kind === "tier" && selection.tierId === item.id}
                  className={`aco-switch${selection.kind === "tier" && selection.tierId === item.id ? " is-active" : ""}`}
                  key={item.id}
                  onClick={() => choose({ kind: "tier", tierId: item.id, termKey: selection.kind === "tier" && item.terms.some((term) => term.key === selection.termKey) ? selection.termKey : item.terms[0]?.key ?? "1" })}
                  type="button"
                >
                  {item.name}
                </button>
              ))}
            </div>
            <div className="aco-switch-group">
              <span className="aco-switch-label">Credit packs</span>
              {packs.map((item) => (
                <button
                  aria-pressed={selection.kind === "pack" && selection.packId === item.id}
                  className={`aco-switch${selection.kind === "pack" && selection.packId === item.id ? " is-active" : ""}`}
                  key={item.id}
                  onClick={() => choose({ kind: "pack", packId: item.id })}
                  type="button"
                >
                  {item.credits.toLocaleString("en-US")} credits
                </button>
              ))}
            </div>
          </div>

          {selection.kind === "pack" && pack ? (
            <>
              <div className="aco-summary-head">
                <h2>{pack.name}</h2>
                {pack.popular ? <span className="aco-badge">Most popular</span> : null}
              </div>
              {pack.note ? <p className="aco-who">{pack.note}</p> : null}
              <div className="aco-amount">
                <strong>{pack.price}</strong>
                <span className="aco-per">one-time</span>
              </div>
              <p className="aco-credits">{pack.credits.toLocaleString("en-US")} credits<span>valid for 24 months</span></p>
            </>
          ) : tier ? (
            <>
              <div className="aco-summary-head">
                <h2>AIVideosUGC {tier.name}</h2>
                {tier.badge ? <span className="aco-badge">{tier.badge}</span> : null}
              </div>
              <p className="aco-who">{tier.who}</p>
              {tier.terms.length > 1 ? (
                <div aria-label="Package term" className="aco-terms" role="group">
                  {tier.terms.map((term) => (
                    <button
                      aria-pressed={term.key === tierTerm?.key}
                      className={term.key === tierTerm?.key ? "is-active" : ""}
                      key={term.key}
                      onClick={() => choose({ kind: "tier", tierId: tier.id, termKey: term.key })}
                      type="button"
                    >
                      {term.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="aco-amount">
                {tierTerm?.strike ? <span className="aco-strike">{tierTerm.strike}</span> : null}
                <strong>{amountLabel}</strong>
                <span className="aco-per">{tierTerm?.periodLabel ?? termLabel(tierTerm?.key ?? "1")}</span>
              </div>
              {tierTerm?.perMonth ? <p className="aco-equiv">{tierTerm.perMonth} / month, billed once</p> : null}
              {tierTerm?.savingsLabel ? <span className="aco-savings">{tierTerm.savingsLabel}</span> : null}
              <p className="aco-credits">{tier.creditsPerMonth.toLocaleString("en-US")} credits / month<span>delivered monthly · one payment, no auto-renewal</span></p>
              <div className="aco-usage">
                <p className="aco-usage-title">Approximate monthly output</p>
                <div className="aco-usage-grid">
                  <div><strong>~{approxPhotos.toLocaleString("en-US")}</strong><span>product photos</span></div>
                  <span className="aco-or">or</span>
                  <div><strong>~{approxVideos.toLocaleString("en-US")}</strong><span>15-second videos</span></div>
                </div>
              </div>
              {tier.features.length ? (
                <>
                  <p className="aco-features-title">Plan details</p>
                  <ul className="aco-features">
                    {tier.features.map((feature) => <li key={feature}>{feature}</li>)}
                  </ul>
                </>
              ) : null}
            </>
          ) : null}

          <p className="aco-trust">
            <Lock aria-hidden="true" /> One payment · No auto-renewal · A failed job returns its credits
          </p>
        </article>

        <article className="aco-payment">
          <div className="aco-payment-head">
            <CreditCard aria-hidden="true" />
            <h2>Payment</h2>
          </div>
          <div className="aco-order-line">
            <span>{selection.kind === "pack" ? pack?.name : `AIVideosUGC ${tier?.name ?? ""} · ${tierTerm?.label ?? ""}`}</span>
            <strong>{amountLabel}</strong>
          </div>
          <div className="aco-methods">
            <label className="aco-channel">
              <span className="aco-methods-title">Pay with</span>
              <select
                aria-label="Payment channel"
                className="aco-channel-select"
                onChange={(event) => setChannelId(event.target.value)}
                value={channelId}
              >
                {channels.map((channel) => (
                  <option disabled={!channel.live} key={channel.id} value={channel.id}>
                    {channel.label}{channel.live ? "" : " — coming soon"}
                  </option>
                ))}
              </select>
            </label>
            {selectedChannel ? <p className="aco-channel-detail">{selectedChannel.detail}</p> : null}
            {selectedChannel ? <p className="aco-methods-note">{selectedChannel.note}</p> : null}
            <p className="aco-methods-trust">
              <svg aria-hidden="true" fill="none" height="13" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="13"><rect height="11" rx="2" width="18" x="3" y="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              SSL-encrypted · PCI-compliant via Stripe · Support: support@aivideosugc.com
            </p>
          </div>

          {customer ? (
            <>
              <div className="aco-account-lines">
                <div><span>Account</span><b>{customer.email}</b></div>
                <div><span>Current balance</span><b>{customer.availableCredits.toLocaleString("en-US")} credits</b></div>
              </div>
              {priceId ? (
                <AidreamcapesCheckoutPayButton customerId={customer.id} key={priceId} priceId={priceId} siteId={siteId} />
              ) : (
                <div className="aco-pending" role="status">
                  <h3>Payments for this {selection.kind === "pack" ? "credit pack" : "term"} are not live yet</h3>
                  <p>Email <b>support@aivideosugc.com</b> and we will complete the setup with you, usually the same day.</p>
                  {selection.kind === "tier" && purchasableTerm && purchasableTerm.key !== tierTerm?.key ? (
                    <>
                      <p>The {purchasableTerm.label} term at {purchasableTerm.price} is ready to buy today.</p>
                      <button
                        className="aco-btn-ghost"
                        onClick={() => choose({ kind: "tier", tierId: selection.tierId, termKey: purchasableTerm.key })}
                        type="button"
                      >
                        Switch to the {purchasableTerm.label} term
                      </button>
                    </>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="aco-login" role="status">
              <h3>Log in to continue</h3>
              <p>Credits are delivered to your account after checkout, so the purchase needs a signed-in account.</p>
              <p className="aco-login-hint">No account yet? Registration takes about a minute.</p>
              <a className="aco-btn-primary" href={loginHref}>Log in and confirm</a>
            </div>
          )}

          <a className="aco-back" href={`${basePath}/pricing`}>← Back to pricing</a>
        </article>
      </section>
    </>
  );
}
