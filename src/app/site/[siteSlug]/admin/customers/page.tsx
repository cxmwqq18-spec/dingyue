import { AdminShell } from "@/components/admin/admin-shell";
import { CustomersPageClient } from "@/components/admin/customers-page-client";
import { ErpInfoList } from "@/components/admin/erp-primitives";
import { OpsCard } from "@/components/ui";
import {
  getSiteAdminData,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
  siteAdminStats,
  siteAdminWorkspace
} from "../_lib/site-admin-context";

export default async function CustomersPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });

  return (
    <AdminShell
      activeModuleCode="customers"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看客户前台", href: `/site/${data.site.slug}/app` }}
      breadcrumbs={[
        { label: "店铺管理", href: `/site/${data.site.slug}/admin` },
        { label: "顾客管理" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="顾客体系"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="每个站点独立客户体系，同邮箱跨站不共享；这里管理客户状态、余额、模型训练、私有相册和素材交付。"
      title="顾客管理"
      titleBadge={String(data.customerCount)}
      workspace={siteAdminWorkspace(data, "顾客工作区")}
      rightRailMode="stacked"
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">站点隔离</p>
            <h2 className="mt-2 text-lg font-semibold">站点隔离检查</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "顾客", value: String(data.customerCount), tone: data.customerCount ? "good" : "warn" },
                  { label: "逾期顾客", value: "加载后计算", tone: "neutral" },
                  { label: "封禁顾客", value: "加载后计算", tone: "neutral" },
                  { label: "私有素材", value: String(data.inputAssetCount + data.generatedAssetCount), tone: "good" }
                ]}
              />
            </div>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay">交付状态</p>
            <h2 className="mt-2 text-lg font-semibold">相册交付状态</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "相册", value: String(data.albumCount), tone: data.albumCount ? "good" : "neutral" },
                  { label: "已就绪", value: String(data.readyAlbums), tone: data.readyAlbums ? "good" : "warn" },
                  { label: "客户模型", value: String(data.readyModels), tone: data.readyModels ? "good" : "warn" }
                ]}
              />
            </div>
          </OpsCard>
        </>
      }
    >
      <CustomersPageClient
        initialAlbumCount={data.albumCount}
        initialAvailableCredits={data.availableCredits}
        initialCustomerCount={data.customerCount}
        initialGeneratedAssetCount={data.generatedAssetCount}
        initialModelCount={data.customerModels.length}
        initialReadyAlbums={data.readyAlbums}
        initialReadyModels={data.readyModels}
        initialReservedCredits={data.reservedCredits}
        initialSignupCreditGrant={data.site.signupCreditGrant}
        siteId={data.site.id}
      />
    </AdminShell>
  );
}
