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
    customer_login_required: "请先登录客户账号，再继续结账。",
    connect_not_ready: "当前站点还没有接入真实支付，普通客户暂时不能自动完成充值。",
    payment_provider_not_enabled_for_customer: "真实支付接口还未接入，普通客户不会自动入账。",
    payment_provider_not_ready: "当前站点收款配置还未就绪。",
    price_not_found_for_site: "当前套餐价格不存在或不属于本站。",
    price_has_no_credits: "当前价格没有配置可发放积分。",
    product_not_active: "当前套餐未启用。"
  }[code ?? ""] ?? code ?? "结账处理失败。";
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
            <span className="text-white/64">当前账号</span>
            <span className="max-w-[180px] truncate font-medium">{customer.email}</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-white/64">当前余额</span>
            <span>{currentBalance ?? 0} 点</span>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-white/64">本次充值</span>
            <span>{selectedCredits} 点 / {selectedAmountLabel}</span>
          </div>
        </div>
      ) : (
        <div className="rounded-[1rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          需要先登录客户账号，结账完成后积分会写入该账号的真实余额。
        </div>
      )}

      {result?.ok && result.order ? (
        <div className="rounded-[1rem] border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-50">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
            <div>
              <p className="font-semibold">充值已完成，{result.grantedCredits ?? selectedCredits} 点已到账。</p>
              <p className="mt-1 font-mono text-xs text-emerald-100/80">订单 {result.order.id}</p>
            </div>
          </div>
        </div>
      ) : result?.error ? (
        <div className="rounded-[1rem] border border-amber-300/20 bg-amber-300/10 p-4 text-sm leading-6 text-amber-50">
          {errorMessage(result.error)}
          {result.checkoutUrl ? <span className="block pt-1 text-xs text-amber-100/70">未来接入真实支付后会跳转到收银台；当前不会提前发放积分。</span> : null}
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
          {busy ? "正在处理" : "完成充值流程"}
        </button>
      ) : (
        <Link className="inline-flex w-full justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-950" href={loginHref}>
          登录后继续
        </Link>
      )}

      <Link className="inline-flex w-full justify-center rounded-full border border-white/12 px-4 py-3 text-sm font-medium text-white/86" href={returnHref}>
        返回定价页面
      </Link>
      <p className="text-xs leading-5 text-white/48">
        管理员客户会跳过在线支付并写入真实订单、订阅和积分账本；普通客户在支付接口接入前不会自动入账。
      </p>
    </div>
  );
}
