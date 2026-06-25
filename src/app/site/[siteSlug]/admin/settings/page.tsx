import { AdminShell } from "@/components/admin/admin-shell";
import { SettingsPageClient } from "@/components/admin/settings-page-client";
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

function siteStatusLabel(status: string) {
  return {
    active: "已启用",
    draft: "草稿",
    suspended: "已暂停"
  }[status] ?? status;
}

function readyLabel(ready: boolean) {
  return ready ? "已就绪" : "待配置";
}

export default async function SettingsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug, { include: [], summary: false, take: 0 });

  return (
    <AdminShell
      activeModuleCode="settings"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看前台", href: `/site/${data.site.slug}` }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "设置收款" }
      ]}
      brand={data.site.branding.logoText}
      eyebrow="billing and settings"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="收款、域名、管理员、AI 网关、安全审计和上线阻断条件集中在这里，点击设置收款后能直接处理收款与站点配置。"
      title="设置收款"
      titleBadge={data.site.connect.chargesEnabled ? "ready" : "setup"}
      workspace={siteAdminWorkspace(data, "settings workspace")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">launch blockers</p>
            <h2 className="mt-2 text-lg font-semibold">上线检查</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "站点状态", value: siteStatusLabel(data.site.status), tone: data.site.status === "active" ? "good" : "warn" },
                  { label: "主域名", value: data.site.primaryDomain, tone: data.site.primaryDomain ? "good" : "warn" },
                  { label: "Stripe 收款", value: readyLabel(data.site.connect.chargesEnabled), tone: data.site.connect.chargesEnabled ? "good" : "warn" },
                  { label: "主题发布", value: "加载后计算", tone: "neutral" },
                  { label: "AI 网关", value: "加载后检查", tone: "neutral" }
                ]}
              />
            </div>
          </OpsCard>
        </>
      }
    >
      <SettingsPageClient site={data.site} />
    </AdminShell>
  );
}
