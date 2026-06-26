"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  pageInfo?: {
    take: number;
    nextOrderCursor?: string;
    nextSubscriptionCursor?: string;
    nextLedgerCursor?: string;
    nextPaymentEventCursor?: string;
  };
  error?: string;
};

type TabCache = {
  data: OrdersPagePayload | null;
  error: string | null;
  loading: boolean;
  loadingMore: boolean;
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
  tabItems: Array<{ key: OrdersTab; label: string; badge: string; hint: string }>;
};

function emptyOrdersPayload(): OrdersPagePayload {
  return {
    customers: [],
    orders: [],
    subscriptions: [],
    ledger: [],
    jobs: [],
    paymentEvents: [],
    pageInfo: { take: 0 }
  };
}

function createInitialTabCache(): Record<OrdersTab, TabCache> {
  return {
    overview: { data: emptyOrdersPayload(), error: null, loading: false, loadingMore: false },
    orders: { data: null, error: null, loading: false, loadingMore: false },
    subscriptions: { data: null, error: null, loading: false, loadingMore: false },
    ledger: { data: null, error: null, loading: false, loadingMore: false },
    events: { data: null, error: null, loading: false, loadingMore: false }
  };
}

function mergeCustomers(current: CustomerLookup[], next: CustomerLookup[]) {
  const byId = new Map(current.map((customer) => [customer.id, customer]));
  for (const customer of next) byId.set(customer.id, customer);
  return Array.from(byId.values());
}

function mergeById<T extends { id: string }>(current: T[], next: T[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of next) byId.set(item.id, item);
  return Array.from(byId.values());
}

function appendPayload(current: OrdersPagePayload | null, next: OrdersPagePayload): OrdersPagePayload {
  if (!current) return next;
  return {
    ...next,
    customers: mergeCustomers(current.customers, next.customers),
    orders: mergeById(current.orders, next.orders),
    subscriptions: mergeById(current.subscriptions, next.subscriptions),
    ledger: mergeById(current.ledger, next.ledger),
    jobs: mergeById(current.jobs, next.jobs),
    paymentEvents: mergeById(current.paymentEvents, next.paymentEvents)
  };
}

function nextCursorForTab(tab: OrdersTab, payload: OrdersPagePayload | null): string | undefined {
  if (tab === "orders") return payload?.pageInfo?.nextOrderCursor;
  if (tab === "subscriptions") return payload?.pageInfo?.nextSubscriptionCursor;
  if (tab === "ledger") return payload?.pageInfo?.nextLedgerCursor;
  if (tab === "events") return payload?.pageInfo?.nextPaymentEventCursor;
  return undefined;
}

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
  siteId,
  tabItems
}: OrdersPageClientProps) {
  const [selectedTab, setSelectedTab] = useState<OrdersTab>(activeTab);
  const [tabCache, setTabCache] = useState<Record<OrdersTab, TabCache>>(() => createInitialTabCache());
  const activeRequestRef = useRef<AbortController | null>(null);
  const tabCacheRef = useRef(tabCache);

  useEffect(() => {
    tabCacheRef.current = tabCache;
  }, [tabCache]);

  useEffect(() => {
    setSelectedTab(activeTab);
  }, [activeTab]);

  const loadTab = useCallback(async (tab: OrdersTab, options?: { append?: boolean; cursor?: string }) => {
    if (tab === "overview") return;
    activeRequestRef.current?.abort();
    const controller = new AbortController();
    activeRequestRef.current = controller;
    const append = options?.append ?? false;
    const params = new URLSearchParams({ tab });
    if (options?.cursor) params.set("cursor", options.cursor);
    setTabCache((current) => ({
      ...current,
      [tab]: {
        ...current[tab],
        error: null,
        loading: append ? current[tab].loading : true,
        loadingMore: append
      }
    }));
    try {
      const response = await fetchAdminJson<OrdersPagePayload>(`/api/sites/${siteId}/admin/orders-page?${params.toString()}`, { init: { signal: controller.signal } });
      const result = response.data;
      if (controller.signal.aborted) return;
      if (!response.ok) {
        setTabCache((current) => ({
          ...current,
          [tab]: {
            ...current[tab],
            error: result.error ?? "订单数据加载失败。",
            loading: false,
            loadingMore: false
          }
        }));
        return;
      }
      setTabCache((current) => ({
        ...current,
        [tab]: {
          data: append ? appendPayload(current[tab].data, result) : result,
          error: null,
          loading: false,
          loadingMore: false
        }
      }));
    } catch (error) {
      if (controller.signal.aborted) return;
      setTabCache((current) => ({
        ...current,
        [tab]: {
          ...current[tab],
          error: error instanceof Error ? error.message : "订单数据加载失败。",
          loading: false,
          loadingMore: false
        }
      }));
    } finally {
      if (activeRequestRef.current === controller) activeRequestRef.current = null;
    }
  }, [siteId]);

  useEffect(() => {
    const selectedCache = tabCacheRef.current[selectedTab];
    if (selectedTab === "overview" || selectedCache.data || selectedCache.loading) return;
    void loadTab(selectedTab);
  }, [loadTab, selectedTab]);

  useEffect(() => {
    return () => {
      activeRequestRef.current?.abort();
    };
  }, []);

  const selectedCache = tabCache[selectedTab];
  const payload = selectedCache.data;
  const nextCursor = nextCursorForTab(selectedTab, payload);

  const derived = useMemo(() => {
    const orders = payload?.orders ?? [];
    const subscriptions = payload?.subscriptions ?? [];
    return {
      activeSubscriptions: payload ? subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trialing").length : initialCounts.activeSubscriptions,
      ledgerCount: payload?.ledger.length ?? initialCounts.ledgerCount,
      orderCount: selectedTab === "overview" ? initialCounts.orderCount : payload?.orders.length ?? initialCounts.orderCount,
      paymentEventCount: payload?.paymentEvents.length ?? initialCounts.paymentEventCount,
      refundedOrders: orders.filter((order) => order.status === "refunded").length,
      subscriptionsCount: selectedTab === "overview" ? initialCounts.subscriptionCount : payload?.subscriptions.length ?? initialCounts.subscriptionCount,
      unsettledOrders: orders.filter((order) => order.status === "created" || order.status === "checkout_started")
    };
  }, [initialCounts, payload, selectedTab]);

  const selectTab = useCallback((tab: OrdersTab) => {
    if (tab !== selectedTab) activeRequestRef.current?.abort();
    setSelectedTab(tab);
  }, [selectedTab]);

  return (
    <div className="grid gap-5">
      <div className="rounded-[8px] border border-[var(--admin-border-soft)] bg-white p-2 shadow-[0_12px_24px_-30px_rgba(15,23,42,0.14)]">
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="订单工作台栏目">
          {tabItems.map((item) => {
            const selected = item.key === selectedTab;
            return (
              <button
                aria-selected={selected}
                className={`inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-[8px] border px-3 text-[12px] font-medium transition ${
                  selected
                    ? "border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white shadow-[0_14px_24px_-18px_rgba(27,119,243,0.42)]"
                    : "border-[var(--admin-border-soft)] bg-white text-[var(--admin-muted)] hover:border-[var(--admin-accent-soft)] hover:text-[var(--admin-accent)]"
                }`}
                key={item.key}
                onClick={() => selectTab(item.key)}
                role="tab"
                type="button"
              >
                <span>{item.label}</span>
                <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[10px] ${selected ? "border-white/20 bg-white/15 text-white" : "border-[var(--admin-border-soft)] bg-[var(--admin-panel)] text-[#8a94a6]"}`}>
                  {item.badge}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-[12px] leading-5 text-[#667085]">{tabItems.find((item) => item.key === selectedTab)?.hint}</p>
      </div>

      {selectedCache.error ? (
        <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {selectedCache.error}
        </div>
      ) : null}

      {!payload && !selectedCache.error ? <OrdersPageSkeleton /> : null}

      {payload && selectedTab === "overview" ? (
        <div className="grid gap-5">
          <ErpStatGrid
            items={[
              { label: "收入", value: money(initialCounts.revenue, currency), detail: `${initialCounts.paidOrders}/${initialCounts.orderCount} 已支付或已发放`, icon: ReceiptText, tone: initialCounts.paidOrders ? "good" : "neutral" },
              { label: "订单", value: String(initialCounts.orderCount), detail: "进入订单记录查看待完成收银台", icon: CreditCard, tone: initialCounts.orderCount ? "good" : "neutral" },
              { label: "订阅", value: String(initialCounts.activeSubscriptions), detail: "生效中或试用中", icon: WalletCards, tone: initialCounts.activeSubscriptions ? "good" : "neutral" },
              { label: "额度", value: String(initialCounts.ledgerCount), detail: `${initialCounts.availableCredits} 可用 / ${initialCounts.reservedCredits} 预扣`, icon: Database, tone: initialCounts.reservedCredits ? "warn" : "good" },
              { label: "事件", value: String(initialCounts.paymentEventCount), detail: "支付确认幂等记录", icon: Activity, tone: initialCounts.paymentEventCount ? "good" : "warn" }
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

      {payload && selectedTab === "orders" ? (
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
          {nextCursor ? (
            <LoadMoreButton loading={selectedCache.loadingMore} onClick={() => loadTab(selectedTab, { append: true, cursor: nextCursor })} />
          ) : null}
        </ErpSection>
      ) : null}

      {payload && selectedTab === "subscriptions" ? (
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
          {nextCursor ? (
            <LoadMoreButton loading={selectedCache.loadingMore} onClick={() => loadTab(selectedTab, { append: true, cursor: nextCursor })} />
          ) : null}
        </ErpSection>
      ) : null}

      {payload && selectedTab === "ledger" ? (
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
          {nextCursor ? (
            <LoadMoreButton loading={selectedCache.loadingMore} onClick={() => loadTab(selectedTab, { append: true, cursor: nextCursor })} />
          ) : null}
        </ErpSection>
      ) : null}

      {payload && selectedTab === "events" ? (
        <ErpSection
          description="支付事件是支付确认的入站证据。它用于确认事件是否到达、是否重复、是否已经驱动订单和额度记录更新。"
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
          {nextCursor ? (
            <LoadMoreButton loading={selectedCache.loadingMore} onClick={() => loadTab(selectedTab, { append: true, cursor: nextCursor })} />
          ) : null}
        </ErpSection>
      ) : null}
    </div>
  );
}

function LoadMoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="mt-4 flex justify-center">
      <button
        className="admin_btn inline-flex min-h-[34px] items-center justify-center px-4"
        disabled={loading}
        onClick={onClick}
        type="button"
      >
        {loading ? "加载中..." : "加载更多"}
      </button>
    </div>
  );
}
