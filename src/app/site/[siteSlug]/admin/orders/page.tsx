import Link from "next/link";
import { CreditCard, Database, ReceiptText, WalletCards } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { BillingEventsTables } from "@/components/admin/billing-events-tables";
import { OrdersWorkbenchClient } from "@/components/admin/orders-workbench-client";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { OpsCard } from "@/components/ui";
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
      eyebrow="订单与订阅"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="订单、订阅、Stripe webhook 入账和额度账本按站点隔离查看。Checkout 跳回不提前发放额度，只以 webhook/账本为准。"
      title="订单与订阅"
      titleBadge={String(data.orders.length)}
      workspace={siteAdminWorkspace(data, "订单工作台")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">支付结算</p>
            <h2 className="mt-2 text-lg font-semibold">支付闭环</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "Stripe Connect", value: data.site.connect.chargesEnabled ? "已就绪" : "待设置", tone: data.site.connect.chargesEnabled ? "good" : "warn" },
                  { label: "支付事件", value: String(paymentEvents.length), tone: paymentEvents.length ? "good" : "warn" },
                  { label: "账本记录", value: String(data.ledger.length), tone: data.ledger.length ? "good" : "warn" },
                  { label: "预扣额度", value: String(data.reservedCredits), tone: data.reservedCredits === 0 ? "good" : "warn" }
                ]}
              />
            </div>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">订阅入口</p>
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
            { label: "收入", value: money(data.revenue, data.site.currency), detail: `${data.paidOrders}/${data.orders.length} 已支付或已发放`, icon: ReceiptText, tone: data.paidOrders ? "good" : "neutral" },
            { label: "订单", value: String(data.orders.length), detail: `${unsettledOrders.length} 条待完成收银台记录`, icon: CreditCard, tone: unsettledOrders.length ? "warn" : "good" },
            { label: "订阅", value: String(data.activeSubscriptions), detail: "生效中或试用中", icon: WalletCards, tone: data.activeSubscriptions ? "good" : "neutral" },
            { label: "额度", value: String(data.ledger.length), detail: `${data.availableCredits} 可用 / ${data.reservedCredits} 预扣`, icon: Database, tone: data.reservedCredits ? "warn" : "good" }
          ]}
        />

        <div className="grid gap-5">
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/pricing")} label="查看前台定价" />}
            description="Checkout 订单、一次性额度包和支付状态统一在这里查看。"
            eyebrow="订单列表"
            title="订单与订阅记录"
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
          description="额度账本是不可变流水。支付事件先入幂等表，再影响客户余额。"
          eyebrow="账本与事件"
          title="额度账本与支付事件"
        >
          <BillingEventsTables
            customers={data.customers}
            jobs={data.jobs}
            ledger={data.ledger}
            orders={data.orders}
            paymentEvents={paymentEvents}
          />
        </ErpSection>
      </div>
    </AdminShell>
  );
}
