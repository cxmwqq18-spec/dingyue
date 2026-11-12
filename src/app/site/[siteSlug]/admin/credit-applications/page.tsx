import { AdminShell } from "@/components/admin/admin-shell";
import { CreditApplicationsPageClient } from "@/components/admin/credit-applications-page-client";
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

export default async function CreditApplicationsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });

  return (
    <AdminShell
      activeModuleCode="credit-applications"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看前台", href: `/site/${data.site.slug}` }}
      breadcrumbs={[
        { label: "店铺管理", href: `/site/${data.site.slug}/admin` },
        { label: "免费积分" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="创作者积分"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="按当前站点审核创作者免费积分申请，确认平台、粉丝档位和带话题的帖子证据后，批准即自动发放 credits。"
      title="免费积分申请"
      titleBadge="Free Credits"
      workspace={siteAdminWorkspace(data, "积分工作区")}
      rightRailMode="stacked"
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">发放边界</p>
            <h2 className="mt-2 text-lg font-semibold">档位与配额</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "发放档位", value: "20 / 40 / 60", tone: "good" },
                  { label: "单人终身上限", value: "60 credits", tone: "good" },
                  { label: "全站每月上限", value: "100 单", tone: "neutral" }
                ]}
              />
            </div>
          </OpsCard>

          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-clay">处理说明</p>
            <h2 className="mt-2 text-lg font-semibold">风控与流转</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              详情面板展示风险旗标和账号上下文（账号年龄、注册/提交 IP、同 /24 历史、生成与付费次数）。批准走账本幂等写入，重复批准不会重复发放。
            </p>
          </OpsCard>
        </>
      }
    >
      <CreditApplicationsPageClient siteId={data.site.id} />
    </AdminShell>
  );
}
