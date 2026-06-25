"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import { customerJsonHeaders } from "@/lib/client-csrf";
import type { Order, PublicCustomer, Subscription } from "@/lib/types";

type CheckoutResult = {
  ok?: boolean;
  error?: string;
  checkoutStatus?: string;
  mode?: string;
  customer?: PublicCustomer;
  order?: Order;
  subscription?: Subscription;
  grantedCredits?: number;
  checkoutUrl?: string;
  note?: string;
};

function errorMessage(code?: string) {
  return {
    customer_login_required: "Sign in to your customer account before checkout.",
    connect_not_ready: "This site is not connected to live payments yet, so customer credit top-ups cannot complete automatically.",
    payment_provider_not_enabled_for_customer: "Live payments are not enabled yet, so customer credits will not be granted automatically.",
    payment_provider_not_ready: "This site's payment setup is not ready yet.",
    price_not_found_for_site: "This plan price does not exist or does not belong to this site.",
    price_has_no_credits: "This price does not include any credits to grant.",
    product_not_active: "This plan is not active."
  }[code ?? ""] ?? code ?? "Checkout could not be completed.";
}

export function CartCheckoutPanel({
  siteId,
  customer,
  selectedPriceId,
  selectedCredits,
  selectedAmountLabel,
  returnHref,
  loginHref
}: {
  siteId: string;
  customer?: PublicCustomer;
  selectedPriceId?: string;
  selectedCredits: number;
  selectedAmountLabel: string;
  returnHref: string;
  loginHref: string;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckoutResult | undefined>();
  const [intentId] = useState(() => `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
  const currentBalance = result?.customer?.balance.available ?? customer?.balance.available;
  const canSubmit = Boolean(customer?.id && selectedPriceId && !busy);

  async function submitCheckout() {
    if (!customer?.id || !selectedPriceId) return;
    setBusy(true);
    setResult(undefined);
    const response = await fetch(`/api/sites/${siteId}/checkout/subscription`, {
      method: "POST",
      headers: customerJsonHeaders(siteId),
      body: JSON.stringify({ customerId: customer.id, priceId: selectedPriceId, intentId })
    });
    const payload = (await response.json().catch(() => ({}))) as CheckoutResult;
    setBusy(false);
    setResult(payload);
    if (!response.ok && !payload.error) {
      setResult({ error: "checkout_request_failed" });
    }
  }

  return (
    <div className="mt-6 grid gap-3">
      {customer ? (
        <div className="rounded-[1rem] border border-white/10 bg-white/[0.05] p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/64">Current account</span>
            <span className="max-w-[180px] truncate font-medium">{customer.email}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-white/64">Current balance</span>
            <span>{currentBalance ?? 0} credits</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-white/64">This top-up</span>
            <span>{selectedCredits} credits / {selectedAmountLabel}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-[1rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          Sign in to a customer account first. Credits are added to that account after checkout is completed.
        </div>
      )}

      {result?.ok && result.order ? (
        <div className="rounded-[1rem] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-50">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <div>
              <p className="font-semibold">Top-up complete. {result.grantedCredits ?? selectedCredits} credits have been added.</p>
              <p className="mt-1 font-mono text-xs text-emerald-100/80">Order {result.order.id}</p>
            </div>
          </div>
        </div>
      ) : result?.error ? (
        <div className="rounded-[1rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          {errorMessage(result.error)}
          {result.checkoutUrl ? <span className="block pt-1 text-xs text-amber-100/70">When live payments are connected, this flow will redirect to checkout. Credits are not granted early.</span> : null}
        </div>
      ) : null}

      {customer ? (
        <button
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          disabled={!canSubmit}
          onClick={submitCheckout}
          type="button"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : <ShieldCheck className="h-4 w-4" strokeWidth={1.8} />}
          {busy ? "Processing" : "Complete top-up"}
        </button>
      ) : (
        <Link className="inline-flex w-full justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-950" href={loginHref}>
          Sign in to continue
        </Link>
      )}

      <Link className="inline-flex w-full justify-center rounded-full border border-white/12 px-4 py-3 text-sm font-medium text-white/86" href={returnHref}>
        Back to pricing
      </Link>
      <p className="text-xs leading-5 text-white/48">
        Demo admin customers can complete checkout without live payment while still writing real orders, subscriptions, and credit ledger entries. Regular customers will not receive credits until live payments are connected.
      </p>
    </div>
  );
}
