"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
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

type CheckoutLocale = "en" | "es";

type CheckoutCopy = {
  errors: Record<string, string>;
  fallbackError: string;
  currentAccount: string;
  currentBalance: string;
  selectedPlan: string;
  credits: string;
  signInNotice: string;
  checkoutComplete: string;
  creditsAdded: string;
  order: string;
  paymentsNotReady: string;
  paymentSetupNote: string;
  processingCheckout: string;
  completeCheckout: string;
  processing: string;
  signInToContinue: string;
  backToPricing: string;
  footnote: string;
};

const checkoutCopy: Record<CheckoutLocale, CheckoutCopy> = {
  en: {
    errors: {
    customer_login_required: "Sign in to your customer account before checkout.",
    connect_not_ready: "Payments are not ready. This site is not connected to live checkout yet, so credits cannot be added from this cart.",
    payment_provider_not_enabled_for_customer: "Payments are not ready. Live checkout is not enabled for this plan yet, so credits cannot be added from this cart.",
    payment_provider_not_ready: "Payments are not ready. This site's payment setup needs to be completed first.",
    price_not_found_for_site: "This plan price does not exist or does not belong to this site.",
    price_has_no_credits: "This price does not include any credits to grant.",
    product_not_active: "This plan is not active."
    },
    fallbackError: "Checkout could not be completed.",
    currentAccount: "Current account",
    currentBalance: "Current balance",
    selectedPlan: "Selected plan",
    credits: "credits",
    signInNotice: "Sign in to a customer account first. Credits are added to that account after checkout is completed.",
    checkoutComplete: "Checkout complete.",
    creditsAdded: "credits have been added.",
    order: "Order",
    paymentsNotReady: "Payments are not ready",
    paymentSetupNote: "Credits are granted only after a real payment confirmation. Please try again after payment setup is complete.",
    processingCheckout: "Processing checkout",
    completeCheckout: "Complete checkout",
    processing: "Processing",
    signInToContinue: "Sign in to continue",
    backToPricing: "Back to pricing",
    footnote: "Complete checkout securely to add credits after payment confirmation. Your order, subscription, and credit history stay available in your account."
  },
  es: {
    errors: {
      customer_login_required: "Inicia sesion con tu cuenta de cliente antes del pago.",
      connect_not_ready: "Los pagos aun no estan listos. Esta tienda no esta conectada al pago en vivo, por eso no se pueden anadir creditos desde el carrito.",
      payment_provider_not_enabled_for_customer: "Los pagos aun no estan listos. El pago en vivo no esta activado para este plan.",
      payment_provider_not_ready: "Los pagos aun no estan listos. Falta completar la configuracion de pago de esta tienda.",
      price_not_found_for_site: "Este precio no existe o no pertenece a esta tienda.",
      price_has_no_credits: "Este precio no incluye creditos.",
      product_not_active: "Este plan no esta activo."
    },
    fallbackError: "No se pudo completar el pago.",
    currentAccount: "Cuenta actual",
    currentBalance: "Saldo actual",
    selectedPlan: "Plan seleccionado",
    credits: "creditos",
    signInNotice: "Inicia sesion con una cuenta de cliente. Los creditos se anaden a esa cuenta despues del pago.",
    checkoutComplete: "Pago completado.",
    creditsAdded: "creditos anadidos.",
    order: "Pedido",
    paymentsNotReady: "Los pagos aun no estan listos",
    paymentSetupNote: "Los creditos solo se conceden despues de una confirmacion real de pago. Intentalo de nuevo cuando la configuracion de pago este completa.",
    processingCheckout: "Procesando pago",
    completeCheckout: "Completar pago",
    processing: "Procesando",
    signInToContinue: "Iniciar sesion para continuar",
    backToPricing: "Volver a precios",
    footnote: "Completa el pago de forma segura para anadir creditos despues de la confirmacion. Tu pedido, suscripcion e historial de creditos quedan en tu cuenta."
  }
};

function errorMessage(code?: string, locale: CheckoutLocale = "en") {
  return checkoutCopy[locale].errors[code ?? ""] ?? code ?? checkoutCopy[locale].fallbackError;
}

function isPaymentReadinessError(code?: string) {
  return code === "connect_not_ready" || code === "payment_provider_not_enabled_for_customer" || code === "payment_provider_not_ready";
}

export function CartCheckoutPanel({
  siteId,
  customer,
  selectedPriceId,
  selectedCredits,
  selectedAmountLabel,
  returnHref,
  loginHref,
  locale = "en"
}: {
  siteId: string;
  customer?: PublicCustomer;
  selectedPriceId?: string;
  selectedCredits: number;
  selectedAmountLabel: string;
  returnHref: string;
  loginHref: string;
  locale?: CheckoutLocale;
}) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CheckoutResult | undefined>();
  const [intentId] = useState(() => `cart_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`);
  const currentBalance = result?.customer?.balance.available ?? customer?.balance.available;
  const canSubmit = Boolean(customer?.id && selectedPriceId && !busy);
  const copy = checkoutCopy[locale];

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
	            <span className="text-white/64">{copy.currentAccount}</span>
	            <span className="max-w-[180px] truncate font-medium">{customer.email}</span>
	          </div>
	          <div className="mt-3 flex items-center justify-between gap-3">
	            <span className="text-white/64">{copy.currentBalance}</span>
	            <span>{currentBalance ?? 0} {copy.credits}</span>
	          </div>
	          <div className="mt-3 flex items-center justify-between gap-3">
	            <span className="text-white/64">{copy.selectedPlan}</span>
	            <span>{selectedCredits} {copy.credits} / {selectedAmountLabel}</span>
	          </div>
	        </div>
	      ) : (
	        <div className="rounded-[1rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
	          {copy.signInNotice}
	        </div>
	      )}

      {result?.ok && result.order ? (
        <div className="rounded-[1rem] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-50">
          <div className="flex items-start gap-2">
	            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
	            <div>
	              <p className="font-semibold">{copy.checkoutComplete} {result.grantedCredits ?? selectedCredits} {copy.creditsAdded}</p>
	              <p className="mt-1 font-mono text-xs text-emerald-100/80">{copy.order} {result.order.id}</p>
	            </div>
	          </div>
        </div>
      ) : result?.error ? (
        <div className="rounded-[1rem] border border-amber-300/25 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          <div className="flex items-start gap-2">
	            {isPaymentReadinessError(result.error) ? <AlertTriangle className="mt-1 h-4 w-4 shrink-0" strokeWidth={1.8} /> : null}
	            <div>
	              {isPaymentReadinessError(result.error) ? <p className="font-semibold">{copy.paymentsNotReady}</p> : null}
	              <p>{errorMessage(result.error, locale)}</p>
	              <p className="mt-1 text-xs text-amber-100/70">
	                {copy.paymentSetupNote}
	              </p>
            </div>
          </div>
        </div>
      ) : null}

      {customer ? (
	        <button
	          aria-label={busy ? copy.processingCheckout : copy.completeCheckout}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          disabled={!canSubmit}
          onClick={submitCheckout}
          type="button"
        >
          <Loader2 aria-hidden="true" className={busy ? "h-4 w-4 animate-spin" : "hidden h-4 w-4"} strokeWidth={1.8} />
          <ShieldCheck aria-hidden="true" className={busy ? "hidden h-4 w-4" : "h-4 w-4"} strokeWidth={1.8} />
	          <span aria-hidden={!busy} className={busy ? "" : "hidden"}>
	            {copy.processing}
	          </span>
	          <span aria-hidden={busy} className={busy ? "hidden" : ""}>
	            {copy.completeCheckout}
	          </span>
        </button>
	      ) : (
	        <Link className="inline-flex w-full justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-950" href={loginHref}>
	          {copy.signInToContinue}
	        </Link>
	      )}

	      <Link className="inline-flex w-full justify-center rounded-full border border-white/12 px-4 py-3 text-sm font-medium text-white/86" href={returnHref}>
	        {copy.backToPricing}
	      </Link>
	      <p className="text-xs leading-5 text-white/48">
	        {copy.footnote}
	      </p>
    </div>
  );
}
