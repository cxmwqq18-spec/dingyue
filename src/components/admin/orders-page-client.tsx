"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, CreditCard, Database, ReceiptText, WalletCards } from "lucide-react";
import { fetchAdminJson } from "@/components/admin/admin-api-client";
import { BillingEventsTables } from "@/components/admin/billing-events-tables";
import { OrdersWorkbenchClient } from "@/components/admin/orders-workbench-client";
import { ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { money } from "@/lib/ops";
import type { CreditLedgerEntry, GenerationJob, Order, PaymentEvent, Subscription } from "@/lib/types";

type CustomerLookup = { id: string; email: string };
type OrdersTab = "overview" | "orders" | "subscriptions" | "ledger" | "events";

type OrdersPagePayload = {
  customers: CustomerLookup[];
  orders: Order[];
  subscriptions: Subscription[];
  ledger: CreditLedgerEntry[];
  jobs: GenerationJob[];
  paymentEvents: PaymentEvent[];
  error?: string;
};

type OrdersPageClientProps = {
  activeTab: OrdersTab;
  currency: string;
  initialCounts: {
    activeSubscriptions: number;
    availableCredits: number;
    ledgerCount: number;
    orderCount: number;
    paidOrders: number;
    paymentEventCount: number;
    reservedCredits: number;
    revenue: number;
    subscriptionCount: number;
  };
  pricingHref: string;
  siteId: string;
};

function OrdersPageSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5" key={index}>
            <div className="h-3 w-24 animate-pulse rounded bg-[#e8edf5]" />
            <div className="mt-8 h-8 w-20 animate-pulse rounded bg-[#e8edf5]" />
            <div className="mt-4 h-3 w-36 animate-pulse rounded bg-[#eef2f7]" />
          </div>
        ))}
      </div>
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-5">
        <div className="h-5 w-36 animate-pulse rounded bg-[#e8edf5]" />
        <div className="mt-5 h-44 w-full animate-pulse rounded bg-[#eef2f7]" />
      </div>
    </div>
  );
}

export function OrdersPageClient({
  activeTab,
  currency,
  initialCounts,
  pricingHref,
  siteId
}: OrdersPageClientProps) {
  const [payload, setPayload] = useState<OrdersPagePayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function loadOrdersPage() {
      if (activeTab === "overview") {
        setError(null);
        setPayload({
          customers: [],
          orders: [],
          subscriptions: [],
          ledger: [],
          jobs: [],
          paymentEvents: []
        });
        return;
      }
      try {
        setError(null);
        setPayload(null);
        const response = await fetchAdminJson<OrdersPagePayload>(`/api/sites/${siteId}/admin/orders-page?tab=${activeTab}`, { init: { signal: controller.signal } });
        const result = response.data;
        if (!active) return;
        if (!response.ok) {
          setError(result.error ?? "订单数据加载失败。");
          return;
        }
        setPayload(result);
      } catch (error) {
        if (!active || controller.signal.aborted) return;
        setError(error instanceof Error ? error.message : "订单数据加载失败。");
      }
    }
    void loadOrdersPage();
    return () => {
      active = false;
      controller.abort();
    };
  }, [activeTab, siteId]);

  const derived = useMemo(() => {
    const orders = payload?.orders ?? [];
    const subscriptions = payload?.subscriptions ?? [];
    return {
      activeSubscriptions: payload ? subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trialing").length : initialCounts.activeSubscriptions,
      ledgerCount: payload?.ledger.length ?? initialCounts.ledgerCount,
      orderCount: activeTab === "overview" ? initialCounts.orderCount : payload?.orders.length ?? initialCounts.orderCount,
      paymentEventCount: payload?.paymentEvents.length ?? initialCounts.paymentEventCount,
      refundedOrders: orders.filter((order) => order.status === "refunded").length,
      subscriptionsCount: activeTab === "overview" ? initialCounts.subscriptionCount : payload?.subscriptions.length ?? initialCounts.subscriptionCount,
      unsettledOrders: orders.filter((order) => order.status === "created" || order.status === "checkout_started")
    };
  }, [activeTab, initialCounts, payload]);

  if (error) {
    return (
      <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!payload) {
    return <OrdersPageSkeleton />;
  }

  return (
    <div className="grid gap-5">
      {activeTab === "overview" ? (
        <div className="grid gap-5">
          <ErpStatGrid
            items={[
              { label: "收入", value: money(initialCounts.revenue, currency), detail: `${initialCounts.paidOrders}/${initialCounts.orderCount} 已支付或已发放`, icon: ReceiptText, tone: initialCounts.paidOrders ? "good" : "neutral" },
              { label: "订单", value: String(initialCounts.orderCount), detail: "进入订单记录查看待完成收银台", icon: CreditCard, tone: initialCounts.orderCount ? "good" : "neutral" },
              { label: "订阅", value: String(initialCounts.activeSubscriptions), detail: "生效中或试用中", icon: WalletCards, tone: initialCounts.activeSubscriptions ? "good" : "neutral" },
              { label: "额度", value: String(initialCounts.ledgerCount), detail: `${initialCounts.availableCredits} 可用 / ${initialCounts.reservedCredits} 预扣`, icon: Database, tone: initialCounts.reservedCredits ? "warn" : "good" },
              { label: "事件", value: String(initialCounts.paymentEventCount), detail: "Stripe webhook 幂等记录", icon: Activity, tone: initialCounts.paymentEventCount ? "good" : "warn" }
            ]}
            columns={5}
          />

          <ErpSection
            description="订单域不要把所有数据混成一张表。先用总览判断是否异常，再分别进入订单、订阅、额度账本、支付事件四个明细栏目。"
            eyebrow="总览说明"
            title="订单工作台结构"
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "订单记录", value: `${derived.unsettledOrders.length} 待完成`, detail: "查看 Checkout、一次性额度包、退款和发放状态。" },
                { label: "订阅记录", value: `${initialCounts.activeSubscriptions} 生效`, detail: "查看顾客持续套餐、周期结束时间和订阅状态。" },
                { label: "额度账本", value: `${initialCounts.availableCredits} 可用`, detail: "查看积分增加、预扣、扣减、释放和人工调整来源。" },
                { label: "支付事件", value: `${initialCounts.paymentEventCount} 事件`, detail: "查看 webhook 是否到达、是否幂等处理、是否关联到账本。" }
              ].map((item) => (
                <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-3" key={item.label}>
                  <p className="text-[12px] font-medium text-[#475467]">{item.label}</p>
                  <p className="mt-2 font-mono text-[22px] leading-7 text-[var(--admin-text)]">{item.value}</p>
                  <p className="mt-1 text-[11px] leading-5 text-[#8a94a6]">{item.detail}</p>
                </div>
              ))}
            </div>
          </ErpSection>
        </div>
      ) : null}

      {activeTab === "orders" ? (
        <ErpSection
          action={<ErpToolbarAction href={pricingHref} label="查看前台定价" />}
          description="Checkout 订单、一次性额度包和支付状态统一在这里查看。"
          eyebrow="订单列表"
          title="订单记录"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="订单数" value={String(derived.orderCount)} />
              <ErpToolbarField label="待付款" value={String(derived.unsettledOrders.length)} />
              <ErpToolbarField label="退款订单" value={String(derived.refundedOrders)} />
            </div>
          </ErpToolbar>
          <div className="mt-5">
            <OrdersWorkbenchClient
              customers={payload.customers}
              orders={payload.orders}
              paymentEvents={[]}
              siteId={siteId}
              subscriptions={[]}
              mode="orders"
            />
          </div>
        </ErpSection>
      ) : null}

      {activeTab === "subscriptions" ? (
        <ErpSection
          action={<ErpToolbarAction href={pricingHref} label="查看套餐定价" />}
          description="订阅是顾客持续套餐权益，和单次支付事件不是同一种记录。这里重点看套餐、Stripe 订阅号、周期结束和生效状态。"
          eyebrow="订阅列表"
          title="订阅记录"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="订阅数" value={String(derived.subscriptionsCount)} />
              <ErpToolbarField label="生效中" value={String(derived.activeSubscriptions)} />
              <ErpToolbarField label="支付事件" value={String(initialCounts.paymentEventCount)} />
            </div>
          </ErpToolbar>
          <div className="mt-5">
            <OrdersWorkbenchClient
              customers={payload.customers}
              orders={[]}
              paymentEvents={[]}
              siteId={siteId}
              subscriptions={payload.subscriptions}
              mode="subscriptions"
            />
          </div>
        </ErpSection>
      ) : null}

      {activeTab === "ledger" ? (
        <ErpSection
          description="额度账本是不可以随意覆盖的积分流水。每一条都应该能说明为什么余额增加、预扣、扣减或释放。"
          eyebrow="额度流水"
          title="额度账本"
        >
          <ErpToolbar className="mb-5">
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="账本记录" value={String(derived.ledgerCount)} />
              <ErpToolbarField label="可用额度" value={String(initialCounts.availableCredits)} />
              <ErpToolbarField label="预扣额度" value={String(initialCounts.reservedCredits)} />
            </div>
          </ErpToolbar>
          <BillingEventsTables
            customers={payload.customers}
            jobs={payload.jobs}
            ledger={payload.ledger}
            orders={payload.orders}
            paymentEvents={payload.paymentEvents}
            mode="ledger"
          />
        </ErpSection>
      ) : null}

      {activeTab === "events" ? (
        <ErpSection
          description="支付事件是 Stripe webhook 的入站证据。它用于确认事件是否到达、是否重复、是否已经驱动订单和额度账本更新。"
          eyebrow="支付回调"
          title="支付事件"
        >
          <ErpToolbar className="mb-5">
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="事件总数" value={String(derived.paymentEventCount)} />
              <ErpToolbarField label="订单记录" value={String(initialCounts.orderCount)} />
              <ErpToolbarField label="账本记录" value={String(initialCounts.ledgerCount)} />
            </div>
          </ErpToolbar>
          <BillingEventsTables
            customers={payload.customers}
            jobs={payload.jobs}
            ledger={payload.ledger}
            orders={payload.orders}
            paymentEvents={payload.paymentEvents}
            mode="events"
          />
        </ErpSection>
      ) : null}
    </div>
  );
}
