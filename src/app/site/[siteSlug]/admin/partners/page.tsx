import { AdminShell } from "@/components/admin/admin-shell";
import { PartnerApplicationsPageClient } from "@/components/admin/partner-applications-page-client";
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

export default async function PartnersPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });

  return (
    <AdminShell
      activeModuleCode="partners"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看前台", href: `/site/${data.site.slug}` }}
      breadcrumbs={[
        { label: "店铺管理", href: `/site/${data.site.slug}/admin` },
        { label: "推广合作者" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="推广合作"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="按当前站点审核推广合作者申请，确认渠道、受众、合作节奏和活动想法后再推进后续运营。"
      title="推广合作者"
      titleBadge="Applications"
      workspace={siteAdminWorkspace(data, "合作者工作区")}
      rightRailMode="stacked"
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">审核边界</p>
            <h2 className="mt-2 text-lg font-semibold">站点隔离</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "当前站点", value: data.site.slug, tone: "good" },
                  { label: "审核 API", value: "site scoped", tone: "good" },
                  { label: "状态范围", value: "4", tone: "neutral" }
                ]}
              />
            </div>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay">处理说明</p>
            <h2 className="mt-2 text-lg font-semibold">审核流转</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              支持待审核、已通过、已拒绝和已归档筛选。详情面板会把审核备注随状态更新一起提交，便于保留运营判断。
            </p>
          </OpsCard>
        </>
      }
    >
      <PartnerApplicationsPageClient siteId={data.site.id} />
    </AdminShell>
  );
}
