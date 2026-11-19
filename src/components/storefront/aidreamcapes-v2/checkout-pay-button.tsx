"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";

type CheckoutResponse = {
  ok?: boolean;
  error?: string;
  checkoutUrl?: string;
  checkoutStatus?: string;
  mode?: string;
};

const PAYMENT_READINESS_ERRORS = new Set(["price_not_public", "connect_not_ready", "payment_provider_not_enabled_for_customer", "payment_provider_not_ready"]);

/**
 * The private checkout page's pay action: posts the confirmed plan to the
 * existing checkout API and hands the browser to the provider's hosted payment
 * page. Readiness errors stay inline so the shopper never loses the summary.
 */
export function AidreamcapesCheckoutPayButton({ siteId, customerId, priceId }: { siteId: string; customerId: string; priceId: string }) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | undefined>();
  const [intentId] = useState(() => `pkg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);

  async function startPayment() {
    setBusy(true);
    setFailure(undefined);
    try {
      const response = await fetch(`/api/sites/${siteId}/checkout/subscription`, {
        method: "POST",
        headers: customerJsonHeaders(siteId),
        body: JSON.stringify({ customerId, priceId, intentId })
      });
      const payload = (await response.json().catch(() => ({}))) as CheckoutResponse;
      if (response.ok && payload.ok && payload.checkoutUrl) {
        window.location.assign(payload.checkoutUrl);
        return;
      }
      setFailure(payload.error ?? "checkout_request_failed");
      setBusy(false);
    } catch {
      setFailure("checkout_request_failed");
      setBusy(false);
    }
  }

  return (
    <div className="aco-pay-action">
      <button
        aria-label={busy ? "Opening the secure payment page…" : "Continue to payment"}
        className="aco-btn-primary"
        disabled={busy}
        onClick={startPayment}
        type="button"
      >
        <Loader2 aria-hidden="true" className={busy ? "aco-spin" : "aco-hidden"} strokeWidth={1.8} />
        <ShieldCheck aria-hidden="true" className={busy ? "aco-hidden" : ""} strokeWidth={1.8} />
        <span aria-hidden={!busy} className={busy ? "" : "aco-hidden"}>Opening the secure payment page…</span>
        <span aria-hidden={busy} className={busy ? "aco-hidden" : ""}>Continue to payment</span>
      </button>
      {failure ? (
        <p className="aco-pay-failure" role="alert">
          {PAYMENT_READINESS_ERRORS.has(failure)
            ? "Payments for this plan are still being activated. Email support@aivideosugc.com and we will complete the setup, or pick another plan today."
            : failure === "customer_login_required"
              ? "Your session ended. Log in again to finish the purchase."
              : "We could not open the payment page. Nothing was charged — try again in a moment."}
        </p>
      ) : null}
    </div>
  );
}
