import Link from "next/link";
import { CreditCard, PackageCheck, Palette, ShoppingBag } from "lucide-react";
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
  const data = await getSiteAdminData(siteSlug);
  const publishState = canPublishPaidProducts(data.site.connect.chargesEnabled, data.products);
  const subscriptionProducts = data.products.filter((product) => product.type === "subscription");
  const creditPacks = data.products.filter((product) => product.type === "credit_pack");
  const lowestPrice = data.products.flatMap((product) => product.prices).sort((left, right) => left.amountCents - right.amountCents)[0];
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
      subtitle="订阅产品、credit pack、Stripe 价格和 DreamShoot 风格拍摄包必须在一个商品中心里管理，前台价格组件只读取这里的真实数据。"
      title="商品与套餐"
      titleBadge={String(data.products.length)}
      workspace={siteAdminWorkspace(data, "product workspace")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">publish guard</p>
            <h2 className="mt-2 text-lg font-semibold">付费上线状态</h2>
            <div className="mt-4 rounded-[12px] border border-zinc-200 bg-white p-4">
              <StatusPill label={publishState.ok ? "可发布付费套餐" : "付费套餐受阻"} tone={publishState.ok ? "good" : "warn"} />
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                {publishState.ok ? "Stripe Connect 和 active product 已满足，定价页可以绑定真实套餐。" : publishState.reason}
              </p>
            </div>
            <Link className="mt-4 inline-flex w-full justify-center rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white" href={modulePath(data.site, "/admin/design")}>
              去装修定价区块
            </Link>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">frontend binding</p>
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
            { label: "products", value: `${data.activeProducts}/${data.products.length}`, detail: `${data.totalPrices} Stripe-style prices`, icon: ShoppingBag, tone: data.activeProducts ? "good" : "warn" },
            { label: "subscriptions", value: String(subscriptionProducts.length), detail: "recurring offers", icon: CreditCard, tone: subscriptionProducts.length ? "good" : "neutral" },
            { label: "credit packs", value: String(creditPacks.length), detail: "one-time credit packs", icon: PackageCheck, tone: creditPacks.length ? "good" : "neutral" },
            { label: "creative packs", value: `${data.activePacks}/${data.packs.length}`, detail: lowestPrice ? `${money(lowestPrice.amountCents, lowestPrice.currency)} entry price` : "No price configured", icon: moduleIcons.packs, tone: data.activePacks ? "good" : "warn" }
          ]}
        />

        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/pricing")} label="打开定价页" primary />}
          description="订阅套餐和 credit pack 在这里维护。前台 pricing_table 只能读取这里的真实产品和真实价格。"
          eyebrow="product catalog"
          title="套餐与价格中心"
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

        <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/design")} label="前台装修" />}
            description="拍摄包用于 DreamShoot 类前台入口，绑定工具、credit 消耗和输出数量。"
            eyebrow="creative packs"
            title="AI 拍摄包"
          >
            <CreativePackEditor packs={data.packs} siteAiApps={data.apps} siteId={data.site.id} />
          </ErpSection>
          <ErpSection
            description="前台模块不允许手写和后台不一致的价格。定价区、上传区、生成表单都应从后台真实数据读取。"
            eyebrow="frontend contract"
            title="前台售卖约束"
          >
            <div className="grid gap-3">
              {data.packs.map((pack) => (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4" key={pack.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{pack.name}</p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">{pack.category}</p>
                    </div>
                    <StatusPill label={pack.status} tone={data.statusTone(pack.status)} />
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{pack.headline}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-xs text-slate-500">
                    <span>{pack.creditCost} cr</span>
                    <span>{pack.outputCount} photos</span>
                    <span>{pack.conversionRate.toFixed(1)}%</span>
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
