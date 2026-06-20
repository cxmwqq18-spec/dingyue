import Link from "next/link";
import { CreditCard, Database, ReceiptText, WalletCards } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { OrdersWorkbenchClient } from "@/components/admin/orders-workbench-client";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { OpsCard, StatusPill } from "@/components/ui";
import { money } from "@/lib/ops";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminCommandActions,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminQuickActions,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function OrdersPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug);
  const unsettledOrders = data.orders.filter((order) => order.status === "created" || order.status === "checkout_started");
  const paymentEvents = data.state.paymentEvents.filter((event) => event.siteId === data.site.id);

  return (
    <AdminShell
      activeModuleCode="orders"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看前台定价", href: modulePath(data.site, "/pricing") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "订单与订阅" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="orders and subscriptions"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="订单、订阅、Stripe webhook 入账和 credits 账本按站点隔离查看。Checkout 跳回不提前发放 credits，只以 webhook/账本为准。"
      title="订单与订阅"
      titleBadge={String(data.orders.length)}
      workspace={siteAdminWorkspace(data, "order workspace")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">settlement</p>
            <h2 className="mt-2 text-lg font-semibold">支付闭环</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "Stripe Connect", value: data.site.connect.chargesEnabled ? "ready" : "setup", tone: data.site.connect.chargesEnabled ? "good" : "warn" },
                  { label: "Payment events", value: String(paymentEvents.length), tone: paymentEvents.length ? "good" : "warn" },
                  { label: "Ledger rows", value: String(data.ledger.length), tone: data.ledger.length ? "good" : "warn" },
                  { label: "Reserved credits", value: String(data.reservedCredits), tone: data.reservedCredits === 0 ? "good" : "warn" }
                ]}
              />
            </div>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">customer portal</p>
            <h2 className="mt-2 text-lg font-semibold">订阅管理入口</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">真实上线时这里应接 Stripe Customer Portal，并继续把 portal 返回后的状态交给 webhook 幂等更新。</p>
            <Link className="mt-5 inline-flex w-full justify-center rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700" href={modulePath(data.site, "/admin/settings")}>
              检查收款设置
            </Link>
          </OpsCard>
        </>
      }
    >
      <div className="grid gap-5">
        <ErpStatGrid
          items={[
            { label: "revenue", value: money(data.revenue, data.site.currency), detail: `${data.paidOrders}/${data.orders.length} paid or fulfilled`, icon: ReceiptText, tone: data.paidOrders ? "good" : "neutral" },
            { label: "orders", value: String(data.orders.length), detail: `${unsettledOrders.length} checkout records pending`, icon: CreditCard, tone: unsettledOrders.length ? "warn" : "good" },
            { label: "subscriptions", value: String(data.activeSubscriptions), detail: "active or trialing", icon: WalletCards, tone: data.activeSubscriptions ? "good" : "neutral" },
            { label: "credits", value: String(data.ledger.length), detail: `${data.availableCredits} available / ${data.reservedCredits} reserved`, icon: Database, tone: data.reservedCredits ? "warn" : "good" }
          ]}
        />

        <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/pricing")} label="查看前台定价" />}
            description="Checkout 订单、一次性 credit pack 和支付状态统一在这里查看。"
            eyebrow="order list"
            title="订单记录"
          >
            <ErpToolbar>
              <div className="flex flex-wrap gap-3">
                <ErpToolbarField label="订单数" value={String(data.orders.length)} />
                <ErpToolbarField label="待付款" value={String(unsettledOrders.length)} />
                <ErpToolbarField label="支付事件" value={String(paymentEvents.length)} />
              </div>
            </ErpToolbar>
            <div className="mt-5">
              <OrdersWorkbenchClient
                customers={data.customers}
                orders={data.orders}
                paymentEvents={paymentEvents}
                siteId={data.site.id}
                subscriptions={data.subscriptions}
              />
            </div>
          </ErpSection>
        </div>

        <ErpSection
          description="credits 账本是不可变流水。payment events 先入幂等表，再影响客户余额。"
          eyebrow="ledger and events"
          title="Credits 账本与支付事件"
        >
          <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[0.35fr_0.25fr_1fr_0.48fr]">
                <span>类型</span>
                <span>数量</span>
                <span>来源</span>
                <span>时间</span>
              </div>
              {data.ledger.slice(0, 12).map((entry) => (
                <div className="grid gap-3 border-b border-slate-100 px-4 py-3 text-sm last:border-b-0 md:grid-cols-[0.35fr_0.25fr_1fr_0.48fr]" key={entry.id}>
                  <span className="font-medium text-slate-900">{entry.type}</span>
                  <span className="font-mono text-slate-900">{entry.amount}</span>
                  <span className="truncate font-mono text-xs text-slate-500">{entry.sourceType}:{entry.sourceId}</span>
                  <span className="font-mono text-xs text-slate-400">{new Date(entry.createdAt).toLocaleDateString("en-US")}</span>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">payment events</p>
              </div>
              {paymentEvents.length ? paymentEvents.slice(0, 8).map((event) => (
                <div className="border-b border-slate-100 p-4 text-sm last:border-b-0" key={event.id}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate font-medium text-slate-900">{event.eventType}</p>
                    <StatusPill label={event.provider} tone="neutral" />
                  </div>
                  <p className="mt-1 truncate font-mono text-xs text-slate-500">{event.providerEventId}</p>
                </div>
              )) : <div className="p-5 text-sm text-slate-500">No payment events recorded yet.</div>}
            </div>
          </div>
        </ErpSection>
      </div>
    </AdminShell>
  );
}
