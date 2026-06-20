"use client";

import { useMemo, useState } from "react";
import { downloadCsv } from "@/components/admin/export-utils";
import type { Order, PaymentEvent, PublicCustomer, Subscription } from "@/lib/types";

function formatMoney(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2
  }).format(amountCents / 100);
}

function toneClass(status: string) {
  if (status === "paid" || status === "fulfilled" || status === "active" || status === "trialing") return "tag_green";
  if (status === "created" || status === "checkout_started") return "tag_org";
  return "tag_gray";
}

export function OrdersWorkbenchClient({
  siteId,
  customers,
  orders,
  subscriptions,
  paymentEvents
}: {
  siteId: string;
  customers: PublicCustomer[];
  orders: Order[];
  subscriptions: Subscription[];
  paymentEvents: PaymentEvent[];
}) {
  const [orderStatus, setOrderStatus] = useState("");
  const [subscriptionStatus, setSubscriptionStatus] = useState("");
  const [query, setQuery] = useState("");

  const filteredOrders = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (orderStatus && order.status !== orderStatus) return false;
      if (!normalized) return true;
      const customer = customers.find((item) => item.id === order.customerId);
      return [
        customer?.email ?? "",
        order.customerId,
        order.sourceId,
        order.status,
        String(order.credits)
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [customers, orderStatus, orders, query]);

  const filteredSubscriptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return subscriptions.filter((subscription) => {
      if (subscriptionStatus && subscription.status !== subscriptionStatus) return false;
      if (!normalized) return true;
      const customer = customers.find((item) => item.id === subscription.customerId);
      return [
        customer?.email ?? "",
        subscription.customerId,
        subscription.stripeSubscriptionId,
        subscription.status
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized);
    });
  }, [customers, query, subscriptionStatus, subscriptions]);

  function reset() {
    setOrderStatus("");
    setSubscriptionStatus("");
    setQuery("");
  }

  function exportOrders() {
    downloadCsv(
      `${siteId}-orders.csv`,
      filteredOrders.map((order) => {
        const customer = customers.find((item) => item.id === order.customerId);
        return {
          orderId: order.id,
          customerEmail: customer?.email ?? order.customerId,
          status: order.status,
          amountCents: order.amountCents,
          currency: order.currency,
          credits: order.credits,
          sourceId: order.sourceId,
          createdAt: order.createdAt
        };
      }),
      ["orderId", "customerEmail", "status", "amountCents", "currency", "credits", "sourceId", "createdAt"]
    );
  }

  function exportSubscriptions() {
    downloadCsv(
      `${siteId}-subscriptions.csv`,
      filteredSubscriptions.map((subscription) => {
        const customer = customers.find((item) => item.id === subscription.customerId);
        return {
          subscriptionId: subscription.id,
          customerEmail: customer?.email ?? subscription.customerId,
          status: subscription.status,
          productId: subscription.productId,
          priceId: subscription.priceId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          currentPeriodEnd: subscription.currentPeriodEnd,
          creditsPerCycle: subscription.creditsPerCycle
        };
      }),
      [
        "subscriptionId",
        "customerEmail",
        "status",
        "productId",
        "priceId",
        "stripeSubscriptionId",
        "currentPeriodEnd",
        "creditsPerCycle"
      ]
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
      <div className="right_box border border-[#eee] bg-white p-4">
        <div className="search border border-[#f1f1f1] bg-[#fafafa] px-3 py-2">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <input
                className="inputtext min-w-[240px]"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索顾客、来源、订单状态"
                value={query}
              />
              <select className="selectmini min-w-[140px]" onChange={(event) => setOrderStatus(event.target.value)} value={orderStatus}>
                <option value="">全部订单状态</option>
                <option value="created">created</option>
                <option value="checkout_started">checkout_started</option>
                <option value="paid">paid</option>
                <option value="fulfilled">fulfilled</option>
                <option value="expired">expired</option>
                <option value="refunded">refunded</option>
              </select>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={reset} type="button">
                重置
              </button>
              <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={exportOrders} type="button">
                导出订单
              </button>
            </div>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[1fr_0.42fr_0.42fr_0.4fr]">
            <span>顾客 / 来源</span>
            <span>金额</span>
            <span>Credits</span>
            <span>状态</span>
          </div>
          {filteredOrders.map((order) => {
            const customer = customers.find((item) => item.id === order.customerId);
            return (
              <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_0.42fr_0.42fr_0.4fr]" key={order.id}>
                <span>
                  <span className="block font-medium text-slate-900">{customer?.email ?? order.customerId}</span>
                  <span className="font-mono text-xs text-slate-500">{order.sourceId}</span>
                </span>
                <span className="font-mono text-slate-900">{formatMoney(order.amountCents, order.currency)}</span>
                <span className="font-mono text-slate-500">{order.credits} cr</span>
                <span className={toneClass(order.status)}>{order.status}</span>
              </div>
            );
          })}
          {!filteredOrders.length ? <div className="p-5 text-sm text-slate-500">没有匹配的订单记录。</div> : null}
        </div>
      </div>

      <div className="right_box border border-[#eee] bg-white p-4">
        <div className="search border border-[#f1f1f1] bg-[#fafafa] px-3 py-2">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              <select className="selectmini min-w-[160px]" onChange={(event) => setSubscriptionStatus(event.target.value)} value={subscriptionStatus}>
                <option value="">全部订阅状态</option>
                <option value="trialing">trialing</option>
                <option value="active">active</option>
                <option value="past_due">past_due</option>
                <option value="canceled">canceled</option>
              </select>
              <span className="tag_gray">支付事件 {paymentEvents.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="admin_btn inline-flex h-[30px] items-center gap-1" onClick={exportSubscriptions} type="button">
                导出订阅
              </button>
            </div>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[1fr_0.7fr_0.42fr]">
            <span>顾客 / Stripe</span>
            <span>套餐</span>
            <span>状态</span>
          </div>
          {filteredSubscriptions.map((subscription) => (
            <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[1fr_0.7fr_0.42fr]" key={subscription.id}>
              <span>
                <span className="block font-medium text-slate-900">
                  {customers.find((item) => item.id === subscription.customerId)?.email ?? subscription.customerId}
                </span>
                <span className="font-mono text-xs text-slate-500">{subscription.stripeSubscriptionId}</span>
              </span>
              <span className="text-slate-600">{subscription.productId}</span>
              <span className={toneClass(subscription.status)}>{subscription.status}</span>
            </div>
          ))}
          {!filteredSubscriptions.length ? <div className="p-5 text-sm text-slate-500">没有匹配的订阅记录。</div> : null}
        </div>
      </div>
    </div>
  );
}
