import { CreditCard, Globe2, ShieldCheck, Users } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuditFeedPanel } from "@/components/admin/audit-feed-panel";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { SiteAdminsPanel } from "@/components/admin/site-admins-panel";
import { SiteSettingsEditor } from "@/components/admin/site-settings-editor";
import { OpsCard } from "@/components/ui";
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

function siteStatusLabel(status: string) {
  return {
    active: "已启用",
    draft: "草稿",
    suspended: "已暂停"
  }[status] ?? status;
}

function connectStatusLabel(status: string) {
  return {
    not_started: "未开始",
    pending: "待开通",
    enabled: "已开通",
    restricted: "受限"
  }[status] ?? status;
}

function readyLabel(ready: boolean) {
  return ready ? "已就绪" : "待配置";
}

function gatewayStatusLabel(status?: string) {
  return {
    active: "已启用",
    paused: "已暂停",
    missing: "未配置"
  }[status ?? "missing"] ?? status ?? "未配置";
}

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
        { label: "设置收款" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="billing and settings"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="收款、域名、管理员、AI 网关、安全审计和上线阻断条件集中在这里，点击设置收款后能直接处理收款与站点配置。"
      title="设置收款"
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
                  { label: "站点状态", value: siteStatusLabel(data.site.status), tone: data.site.status === "active" ? "good" : "warn" },
                  { label: "主域名", value: data.site.primaryDomain, tone: data.site.primaryDomain ? "good" : "warn" },
                  { label: "Stripe 收款", value: readyLabel(data.site.connect.chargesEnabled), tone: data.site.connect.chargesEnabled ? "good" : "warn" },
                  { label: "主题发布", value: `${data.publications.length} 个版本`, tone: data.publications.length > 0 ? "good" : "warn" },
                  { label: "AI 网关", value: gatewayStatusLabel(data.gateway?.status), tone: data.gateway?.status === "active" ? "good" : "warn" }
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
            { label: "域名", value: String(data.domains.length), detail: `${data.domains.filter((domain) => domain.status === "active").length} 个已生效域名`, icon: Globe2, tone: data.domains.length ? "good" : "warn" },
            { label: "收款", value: connectStatusLabel(data.site.connect.status), detail: data.site.connect.stripeAccountId, icon: CreditCard, tone: data.site.connect.chargesEnabled ? "good" : "warn" },
            { label: "管理员", value: String(siteAdmins.length), detail: "本站后台账号", icon: Users, tone: siteAdmins.length ? "good" : "warn" },
            { label: "审计", value: String(data.auditLogs.length), detail: "敏感操作记录", icon: ShieldCheck, tone: data.auditLogs.length ? "good" : "neutral" }
          ]}
        />

        <ErpSection
          action={<ErpToolbarAction href={modulePath(data.site, "/admin/media")} label="媒体库" />}
          description="站点名称、品牌、域名和 Stripe Connect 都应在本站后台直接维护，而不是只看静态状态表。"
          eyebrow="billing settings"
          title="设置收款与站点资料"
        >
          <ErpToolbar>
            <div className="flex flex-wrap gap-3">
              <ErpToolbarField label="站点" value={data.site.name} />
              <ErpToolbarField label="主域名" value={data.site.primaryDomain} />
              <ErpToolbarField label="Connect" value={connectStatusLabel(data.site.connect.status)} />
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
            <AuditFeedPanel items={data.feed} />
          </ErpSection>
        </div>
      </div>
    </AdminShell>
  );
}
