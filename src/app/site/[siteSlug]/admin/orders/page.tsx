import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { OrdersPageClient } from "@/components/admin/orders-page-client";
import { ErpInfoList } from "@/components/admin/erp-primitives";
import { OpsCard } from "@/components/ui";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

type OrdersTab = "overview" | "orders" | "subscriptions" | "ledger" | "events";

function normalizeOrdersTab(value?: string): OrdersTab {
  if (value === "orders" || value === "subscriptions" || value === "ledger" || value === "events") return value;
  return "overview";
}

export default async function OrdersPage({
  params,
  searchParams
}: {
  params: Promise<{ siteSlug: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { siteSlug } = await params;
  const activeTab = normalizeOrdersTab((await searchParams)?.tab);
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });
  const pricingHref = modulePath(data.site, "/pricing");
  const tabItems: Array<{ key: OrdersTab; label: string; badge: string; hint: string }> = [
    {
      key: "overview",
      label: "总览指标",
      badge: `${data.orderCount} 单`,
      hint: "先看收入、订单、订阅、额度和支付事件是否闭环，再进入具体列表排查。"
    },
    {
      key: "orders",
      label: "订单记录",
      badge: String(data.orderCount),
      hint: "订单记录表示一次 Checkout 或额度包购买请求，重点看金额、额度、状态和来源。"
    },
    {
      key: "subscriptions",
      label: "订阅记录",
      badge: String(data.subscriptionCount),
      hint: "订阅记录表示顾客持续生效的套餐权益，不等同于一次支付事件。"
    },
    {
      key: "ledger",
      label: "额度账本",
      badge: String(data.ledgerCount),
      hint: "额度账本是不可以随意覆盖的积分流水，用来追踪购买入账、生成预扣、扣减、释放和人工调整。"
    },
    {
      key: "events",
      label: "支付事件",
      badge: String(data.paymentEventCount),
      hint: "支付事件是支付确认的幂等记录，用来核对支付、退款、订阅变更是否已经被系统处理。"
    }
  ];

  return (
    <AdminShell
      activeModuleCode="orders"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看前台定价", href: pricingHref }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "订单与订阅" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="订单与订阅"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="订单、订阅、支付确认入账和额度记录按站点隔离查看。Checkout 跳回不提前发放额度，只以支付确认/记录为准。"
      title="订单与订阅"
      titleBadge={String(data.orderCount)}
      workspace={siteAdminWorkspace(data, "订单工作台")}
      rightRailMode="stacked"
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">支付结算</p>
            <h2 className="mt-2 text-lg font-semibold">支付闭环</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "Stripe Connect", value: data.site.connect.chargesEnabled ? "已就绪" : "待设置", tone: data.site.connect.chargesEnabled ? "good" : "warn" },
                  { label: "支付事件", value: String(data.paymentEventCount), tone: data.paymentEventCount ? "good" : "warn" },
                  { label: "账本记录", value: String(data.ledgerCount), tone: data.ledgerCount ? "good" : "warn" },
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
        <OrdersPageClient
          activeTab={activeTab}
          currency={data.site.currency}
          initialCounts={{
            activeSubscriptions: data.activeSubscriptions,
            availableCredits: data.availableCredits,
            ledgerCount: data.ledgerCount,
            orderCount: data.orderCount,
            paidOrders: data.paidOrders,
            paymentEventCount: data.paymentEventCount,
            reservedCredits: data.reservedCredits,
            revenue: data.revenue,
            subscriptionCount: data.subscriptionCount
          }}
          pricingHref={pricingHref}
          siteId={data.site.id}
          tabItems={tabItems}
        />
      </div>
    </AdminShell>
  );
}
