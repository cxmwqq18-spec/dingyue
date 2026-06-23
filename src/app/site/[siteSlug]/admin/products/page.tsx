import Link from "next/link";
import { CheckCircle2, CreditCard, FileText, PackageCheck, Palette, ShoppingBag } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { CreativePackEditor } from "@/components/admin/creative-pack-editor";
import { PricingEditor } from "@/components/admin/pricing-editor";
import { OpsCard, StatusPill } from "@/components/ui";
import { canPublishPaidProducts } from "@/lib/billing";
import { money } from "@/lib/ops";
import {
  getSiteAdminData,
  moduleIcons,
  modulePath,
  siteAdminAccount,
  siteAdminCommandActions,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminQuickActions,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function ProductsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: ["products"] });
  const publishState = canPublishPaidProducts(data.site.connect.chargesEnabled, data.products);
  const subscriptionProducts = data.products.filter((product) => product.type === "subscription");
  const creditPacks = data.products.filter((product) => product.type === "credit_pack");
  const lowestPrice = data.products.flatMap((product) => product.prices).sort((left, right) => left.amountCents - right.amountCents)[0];
  const maintenanceModules = [
    {
      title: "价格套餐",
      href: "#pricing-center",
      icon: CreditCard,
      tone: "border-blue-200 bg-blue-50 text-blue-700",
      detail: "维护前台价格卡、结账金额、到账积分和主推套餐。"
    },
    {
      title: "拍摄包入口",
      href: "#creative-packs",
      icon: Palette,
      tone: "border-violet-200 bg-violet-50 text-violet-700",
      detail: "维护前台 AI 工具入口、消耗积分、输出数量和上下架状态。"
    },
    {
      title: "前台绑定检查",
      href: "#frontend-contract",
      icon: CheckCircle2,
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      detail: "核对前台定价页和生成入口是否读取后台真实数据。"
    }
  ];
  return (
    <AdminShell
      activeModuleCode="products"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "打开定价页", href: modulePath(data.site, "/pricing") }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "商品与套餐" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="统一维护付费价格、Credit 包和 AI 拍摄包。前台定价页、上传入口和生成表单都读取这里的数据。"
      title="商品中心"
      titleBadge={String(data.products.length)}
      workspace={siteAdminWorkspace(data, "product workspace")}
      rightRailMode="stacked"
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">上线检查</p>
            <h2 className="mt-2 text-lg font-semibold">付费上线状态</h2>
            <div className="mt-4 rounded-[12px] border border-zinc-200 bg-white p-4">
              <StatusPill label={publishState.ok ? "可发布付费套餐" : "付费套餐受阻"} tone={publishState.ok ? "good" : "warn"} />
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {publishState.ok ? "Stripe Connect 和 active product 已满足，定价页可以绑定真实套餐。" : publishState.reason}
              </p>
            </div>
            <Link className="mt-4 inline-flex w-full justify-center whitespace-nowrap rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white" href={modulePath(data.site, "/admin/design")}>
              去装修定价区块
            </Link>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">前台绑定</p>
            <h2 className="mt-2 text-lg font-semibold">价格区块绑定</h2>
            <div className="mt-4">
              <ErpInfoList
                items={data.products.map((product) => ({
                  label: product.name,
                  value: `${product.prices.length} / ${product.type}`,
                  tone: data.statusTone(product.status)
                }))}
              />
            </div>
          </OpsCard>
        </>
      }
      eyebrow="store commerce"
    >
      <div className="grid gap-5">
        <ErpStatGrid
          items={[
            { label: "商品", value: `${data.activeProducts}/${data.products.length}`, detail: `${data.totalPrices} 个真实价格`, icon: ShoppingBag, tone: data.activeProducts ? "good" : "warn" },
            { label: "订阅套餐", value: String(subscriptionProducts.length), detail: "按月收费商品", icon: CreditCard, tone: subscriptionProducts.length ? "good" : "neutral" },
            { label: "Credit 包", value: String(creditPacks.length), detail: "一次性充值积分包", icon: PackageCheck, tone: creditPacks.length ? "good" : "neutral" },
            { label: "拍摄包", value: `${data.activePacks}/${data.packs.length}`, detail: lowestPrice ? `入口价 ${money(lowestPrice.amountCents, lowestPrice.currency)}` : "未配置价格", icon: moduleIcons.packs, tone: data.activePacks ? "good" : "warn" }
          ]}
        />

        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/pricing")} label="打开定价页" primary />}
          description="先确认自己要维护哪个模块，再进入对应区域。页面下方每块都有具体操作说明，避免在长表单里误改数据。"
          eyebrow="操作手册"
          title="本页维护什么"
        >
          <div className="grid gap-3 lg:grid-cols-3">
            {maintenanceModules.map((module) => {
              const Icon = module.icon;
              return (
                <a className="rounded-[12px] border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200" href={module.href} key={module.href}>
                  <div className="flex items-start gap-3">
                    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border ${module.tone}`}>
                      <Icon className="h-5 w-5" strokeWidth={1.8} />
                    </span>
                    <div>
                      <h2 className="text-[15px] font-semibold text-slate-900">{module.title}</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-500">{module.detail}</p>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>

          <div className="mt-4 rounded-[12px] border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-600">
                <FileText className="h-4.5 w-4.5" strokeWidth={1.8} />
              </span>
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">推荐维护顺序</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  1. 先维护价格套餐，确认金额、周期和到账 Credits。 2. 再维护拍摄包入口，确认工具绑定和每次消耗。
                  3. 最后做前台绑定检查，打开定价页确认客户看到的价格和后台一致。
                </p>
              </div>
            </div>
          </div>
        </ErpSection>

        <div className="scroll-mt-24" id="pricing-center">
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/pricing")} label="打开定价页" primary />}
            description="维护真实收款价格：订阅、Credit 包、金额、周期、额度和主推标记。保存后会影响结账页和充值到账数据。"
            eyebrow="价格套餐"
            title="价格套餐"
          >
            <ErpToolbar>
              <div className="flex flex-wrap gap-3">
                <ErpToolbarField label="订阅套餐" value={String(subscriptionProducts.length)} />
                <ErpToolbarField label="Credit 包" value={String(creditPacks.length)} />
                <ErpToolbarField label="真实价格" value={String(data.totalPrices)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="装修定价区块" />
              </div>
            </ErpToolbar>
            <div className="mt-5">
              <PricingEditor products={data.products} siteId={data.site.id} />
            </div>
          </ErpSection>
        </div>

        <div className="scroll-mt-24" id="creative-packs">
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="前台装修" />}
            description="维护前台可见的 AI 服务入口：标题、分类、绑定工具、消耗积分、输出数量和上下架状态。"
            eyebrow="拍摄包入口"
            title="拍摄包入口"
          >
            <div className="mb-4 rounded-[12px] border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
              操作提示：拍摄包不是收款价格，它决定客户购买 Credits 后可以使用哪些 AI 生成入口，以及每次生成会消耗多少 Credits。
            </div>
            <CreativePackEditor packs={data.packs} siteAiApps={data.apps} siteId={data.site.id} />
          </ErpSection>
        </div>

        <div className="scroll-mt-24" id="frontend-contract">
          <ErpSection
            description="检查定价页和生成入口是否读取后台真实数据，避免前台手写价格或过期套餐。"
            eyebrow="前台绑定检查"
            title="前台绑定检查"
          >
            <div className="mb-4 rounded-[12px] border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800">
              检查方式：价格套餐保存后打开定价页；拍摄包保存后打开前台工具入口。前台显示金额、Credits、消耗积分必须和本页一致。
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {data.packs.map((pack) => (
                <div className="rounded-[12px] border border-slate-200 bg-slate-50 p-4" key={pack.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{pack.name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{pack.category}</p>
                    </div>
                    <StatusPill label={pack.status} tone={data.statusTone(pack.status)} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{pack.headline}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs text-slate-500">
                    <span className="whitespace-nowrap">{pack.creditCost} Credits</span>
                    <span className="whitespace-nowrap">{pack.outputCount} 张</span>
                    <span className="whitespace-nowrap">{pack.conversionRate.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </ErpSection>
        </div>
      </div>
    </AdminShell>
  );
}
