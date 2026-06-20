import { CreditCard, Globe2, ShieldCheck, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { SiteAdminsPanel } from "@/components/admin/site-admins-panel";
import { SiteSettingsEditor } from "@/components/admin/site-settings-editor";
import { OpsCard, StatusPill } from "@/components/ui";
import { toPublicSiteAdmin } from "@/lib/server-store";
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

export default async function SettingsPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug);
  const siteAdmins = data.state.siteAdmins.filter((admin) => admin.siteId === data.site.id);
  const publicSiteAdmins = siteAdmins.map(toPublicSiteAdmin);

  return (
    <AdminShell
      activeModuleCode="settings"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看前台", href: `/site/${data.site.slug}` }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "站点设置" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="settings and guardrails"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="域名、Stripe Connect、管理员、AI 网关、安全审计和上线阻断条件集中在设置模块，避免后台配置分散。"
      title="站点设置"
      titleBadge={String(data.domains.length)}
      workspace={siteAdminWorkspace(data, "settings workspace")}
      rightRail={
        <>
          <OpsCard className="p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">launch blockers</p>
            <h2 className="mt-2 text-lg font-semibold">上线检查</h2>
            <div className="mt-4">
              <ErpInfoList
                items={[
                  { label: "Active site", value: data.site.status, tone: data.site.status === "active" ? "good" : "warn" },
                  { label: "Primary domain", value: data.site.primaryDomain, tone: data.site.primaryDomain ? "good" : "warn" },
                  { label: "Stripe charges", value: data.site.connect.chargesEnabled ? "enabled" : "disabled", tone: data.site.connect.chargesEnabled ? "good" : "warn" },
                  { label: "Theme publication", value: String(data.publications.length), tone: data.publications.length > 0 ? "good" : "warn" },
                  { label: "AI gateway", value: data.gateway?.status ?? "missing", tone: data.gateway?.status === "active" ? "good" : "warn" }
                ]}
              />
            </div>
          </OpsCard>
        </>
      }
    >
      <div className="grid gap-5">
        <ErpStatGrid
          items={[
            { label: "domains", value: String(data.domains.length), detail: `${data.domains.filter((domain) => domain.status === "active").length} active domains`, icon: Globe2, tone: data.domains.length ? "good" : "warn" },
            { label: "connect", value: data.site.connect.status, detail: data.site.connect.stripeAccountId, icon: CreditCard, tone: data.site.connect.chargesEnabled ? "good" : "warn" },
            { label: "admins", value: String(siteAdmins.length), detail: "site admin accounts", icon: Users, tone: siteAdmins.length ? "good" : "warn" },
            { label: "audit", value: String(data.auditLogs.length), detail: "site audit rows", icon: ShieldCheck, tone: data.auditLogs.length ? "good" : "neutral" }
          ]}
        />

        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/admin/media")} label="媒体库" />}
          description="站点名称、品牌、域名和 Stripe Connect 都应在本站后台直接维护，而不是只看静态状态表。"
          eyebrow="editable site record"
          title="站点配置中心"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="站点" value={data.site.name} />
              <ErpToolbarField label="主域名" value={data.site.primaryDomain} />
              <ErpToolbarField label="Connect" value={data.site.connect.status} />
              <ErpToolbarField label="币种" value={data.site.currency} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarAction href={modulePath(data.site, "/admin/products")} label="商品中心" />
              <ErpToolbarAction href={modulePath(data.site, "/admin/themes")} label="主题库" />
            </div>
          </ErpToolbar>
          <div className="mt-5">
            <SiteSettingsEditor domains={data.domains} site={data.site} />
          </div>
        </ErpSection>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <ErpSection
            description="后台账号只管理当前站点，角色范围不跨站。"
            eyebrow="admins"
            title="后台账号"
          >
            <SiteAdminsPanel admins={publicSiteAdmins} siteId={data.site.id} />
          </ErpSection>

          <ErpSection
            action={<ErpToolbarAction href={modulePath(data.site, "/admin/orders")} label="订单与订阅" />}
            description="平台侧敏感查看需要审计；单站后台这里保留本站近期敏感操作轨迹。"
            eyebrow="audit trail"
            title="敏感操作"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:grid-cols-[0.7fr_1fr_0.5fr]">
                <span>动作</span>
                <span>详情</span>
                <span>时间</span>
              </div>
              {data.feed.map((item) => (
                <div className="grid gap-3 border-b border-slate-100 px-4 py-4 text-sm last:border-b-0 md:grid-cols-[0.7fr_1fr_0.5fr]" key={item.id}>
                  <span className="font-medium text-slate-900">{item.label}</span>
                  <span className="truncate font-mono text-xs text-slate-500">{item.detail}</span>
                  <span className="font-mono text-xs text-slate-400">{new Date(item.at).toLocaleDateString("en-US")}</span>
                </div>
              ))}
            </div>
          </ErpSection>
        </div>
      </div>
    </AdminShell>
  );
}
