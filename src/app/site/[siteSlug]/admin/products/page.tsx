import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErpInfoList } from "@/components/admin/erp-primitives";
import { ProductsPageClient } from "@/components/admin/products-page-client";
import { OpsCard, StatusPill } from "@/components/ui";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function ProductsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });

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
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="统一维护付费价格、Credit 包和 AI 拍摄包。页面先打开，商品与拍摄包数据随后加载。"
      title="商品中心"
      titleBadge={String(data.productCount)}
      workspace={siteAdminWorkspace(data, "product workspace")}
      rightRailMode="stacked"
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">上线检查</p>
            <h2 className="mt-2 text-lg font-semibold">付费上线状态</h2>
            <div className="mt-4 rounded-[12px] border border-zinc-200 bg-white p-4">
              <StatusPill label={data.site.connect.chargesEnabled ? "收款账户可用" : "收款配置待完成"} tone={data.site.connect.chargesEnabled ? "good" : "warn"} />
              <p className="mt-3 text-sm leading-6 text-zinc-600">
                商品与价格加载后会显示具体付费套餐状态；这里保留站点收款账户检查。
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
                items={[
                  { label: "商品总数", value: String(data.productCount), tone: data.productCount ? "good" : "warn" },
                  { label: "有效商品", value: String(data.activeProducts), tone: data.activeProducts ? "good" : "warn" },
                  { label: "真实价格", value: String(data.totalPrices), tone: data.totalPrices ? "good" : "warn" }
                ]}
              />
            </div>
          </OpsCard>
        </>
      }
      eyebrow="store commerce"
    >
      <ProductsPageClient
        siteId={data.site.id}
        siteSlug={data.site.slug}
      />
    </AdminShell>
  );
}
