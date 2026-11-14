"use client";

import { useEffect, useState } from "react";

// First-visit promo popup for the pricing page (design: design/promo-popup-v1
// 方案 A, brand-fused). Shows once per 30 days per browser. Anonymous visitors
// and logged-in customers who are still $1-eligible see it; customers who
// already bought the offer, consumed it or are existing payers never do.
// All copy arrives through SSR props from the pricing page's contentJson —
// no resolvers cross the client boundary.

export type PricingPromoPopupData = {
  enabled?: boolean;
  kicker?: string;
  title?: string;
  sub?: string;
  price?: string;
  priceWas?: string;
  priceOff?: string;
  priceNote?: string;
  ctaLabel?: string;
  ctaHref?: string;
  altPre?: string;
  altTag?: string;
  altText?: string;
  altHref?: string;
  fine?: string;
};

const SEEN_KEY = "aivs_promo_seen";
const SEEN_DAYS = 30 * 24 * 60 * 60 * 1000;

export function AidreamcapesPricingPromoPopup(props: {
  siteId: string;
  data: PricingPromoPopupData;
  starterHref: string;
  creatorHref: string;
}) {
  const { siteId, data, starterHref, creatorHref } = props;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!data?.enabled) return;
    let cancelled = false;
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      if (seen && Date.now() - Number(seen) < SEEN_DAYS) return;
      fetch(`/api/sites/${siteId}/aivideosugc/starter-offer`, { credentials: "same-origin", cache: "no-store" })
        .then((res) => res.json().catch(() => null))
        .then((state) => {
          if (cancelled) return;
          // Anonymous visitors get the login-required error — they are new by
          // definition. Logged-in customers only see it while $1-eligible.
          const isNew = !state || state.error === "customer_login_required" || state.state === "eligible";
          if (isNew) {
            setVisible(true);
            localStorage.setItem(SEEN_KEY, String(Date.now()));
          }
        })
        .catch(() => {});
    } catch {}
    return () => { cancelled = true; };
  }, [data?.enabled, siteId]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setVisible(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible]);

  if (!visible || !data?.enabled) return null;

  const close = () => setVisible(false);

  return (
    <div
      className="apopup-overlay"
      onClick={close}
      role="presentation"
    >
      <div
        aria-label={data.kicker || "First video offer"}
        aria-modal="true"
        className="apopup"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button aria-label="Close" className="apopup-x" onClick={close} type="button">✕</button>
        {data.kicker ? (
          <span className="apopup-kicker"><span className="apopup-dot" />{data.kicker}</span>
        ) : null}
        {data.title ? <div className="apopup-title">{data.title}</div> : null}
        {data.sub ? <div className="apopup-sub">{data.sub}</div> : null}
        <div className="apopup-price-row">
          {data.price ? <span className="apopup-price">{data.price}</span> : null}
          {(data.priceWas || data.priceOff || data.priceNote) ? (
            <span className="apopup-price-meta">
              {data.priceWas ? <s>{data.priceWas}</s> : null}
              {data.priceOff ? <b>{data.priceOff}</b> : null}
              {data.priceNote ? <span>{data.priceNote}</span> : null}
            </span>
          ) : null}
        </div>
        {data.ctaLabel ? (
          <a className="apopup-cta" href={starterHref}>{data.ctaLabel}</a>
        ) : null}
        {(data.altPre || data.altTag) ? (
          <div className="apopup-alt">
            {data.altPre ? <span>{data.altPre} </span> : null}
            {data.altTag ? <b>{data.altTag}</b> : null}
            {data.altText ? <span> — </span> : null}
            {data.altHref ? <a href={creatorHref}>{data.altText ?? "learn more"} →</a> : null}
          </div>
        ) : null}
        {data.fine ? <div className="apopup-fine">{data.fine}</div> : null}
      </div>
    </div>
  );
}
