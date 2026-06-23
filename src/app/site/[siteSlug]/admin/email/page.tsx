import { MailCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { SiteEmailPanel } from "@/components/admin/site-email-panel";
import { OpsCard } from "@/components/ui";
import { domainFromEmail, listResendDomains, resendDomainMatchesSender, resendEmailConfigStatusForSettings, resolveResendSettingsForSite } from "@/lib/resend-email";
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

function isLocalDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized.endsWith(".localhost");
}

function senderLocalPart(email: string): string {
  const [local = "verify"] = email.split("@");
  return local.trim() || "verify";
}

export default async function SiteEmailPage({ params }: { params: Promise<{ siteSlug: string }> }) {
  const { siteSlug } = await params;
  const data = await getSiteAdminData(siteSlug);
  const emailState = {
    platformEmailSettings: data.state.platformEmailSettings,
    platformEmailConfigs: data.state.platformEmailConfigs,
    siteEmailConfigAssignments: data.state.siteEmailConfigAssignments
  };
  const selected = resolveResendSettingsForSite(emailState, data.site.id);
  const config = resendEmailConfigStatusForSettings(selected);
  const local = senderLocalPart(config.fromEmail || "verify@example.com");
  const candidateFromEmail = `${local}@${data.site.primaryDomain}`.toLowerCase();
  const candidateDomain = domainFromEmail(candidateFromEmail);
  let domains: Array<{ id?: string; name?: string; status?: string; region?: string }> = [];
  if (config.apiKeyConfigured) {
    try {
      domains = await listResendDomains(selected);
    } catch {
      domains = [];
    }
  }
  const resendDomain = domains.find((domain) => resendDomainMatchesSender(domain.name, candidateDomain));
  const verified = resendDomain?.status === "verified";
  const localDomain = isLocalDomain(candidateDomain);
  const blockingReasons = [
    !config.apiKeyConfigured ? "missing_resend_api_key" : "",
    !config.fromConfigured ? "missing_resend_from_email" : "",
    config.usingTestingSender ? "resend_testing_sender" : "",
    localDomain ? "local_domain_not_verifiable" : "",
    !localDomain && !resendDomain ? "sender_domain_not_found_in_resend" : "",
    resendDomain && !verified ? "sender_domain_not_verified" : ""
  ].filter(Boolean);
  const initialStatus = {
    config: {
      ...config,
      id: selected.id,
      label: selected.label
    },
    domainStatus: localDomain ? "local" : resendDomain?.status ?? "not_found",
    candidateFromEmail,
    candidateDomain,
    readyForProduction: config.apiKeyConfigured && !config.usingTestingSender && verified,
    blockingReasons,
    resendDomain
  };

  return (
    <AdminShell
      activeModuleCode="email"
      account={siteAdminAccount(data.site, data.current)}
      action={{ label: "查看前台", href: `/site/${data.site.slug}` }}
      breadcrumbs={[
        { label: "店铺管理", href: modulePath(data.site, "/admin") },
        { label: "邮件管理" }
      ]}
      brand={data.site.branding.logoText}
      commandActions={siteAdminCommandActions(data.site, data)}
      eyebrow="site email"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      quickActions={siteAdminQuickActions(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="维护本站 Resend 发信参数、检测 DNS 验证状态，并发送单封验证码测试。"
      title="邮件管理"
      titleBadge={initialStatus.readyForProduction ? "ready" : "setup"}
      workspace={siteAdminWorkspace(data, "email workspace")}
      rightRail={
        <OpsCard className="p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">email scope</p>
          <h2 className="mt-2 text-lg font-semibold">单站边界</h2>
          <div className="mt-4 grid gap-3 text-[12px] leading-5 text-slate-500">
            <div className="rounded-[8px] border border-slate-200 bg-white p-3">
              <MailCheck className="mb-2 h-4 w-4 text-[#1b77f3]" strokeWidth={1.8} />
              这里保存的 Resend 参数只绑定当前站点，不会改动其他站点的邮件配置。
            </div>
            <div className="rounded-[8px] border border-slate-200 bg-white p-3">
              From Email 必须使用本站主域名或已绑定域名，避免跨站发信串域名。
            </div>
          </div>
        </OpsCard>
      }
    >
      <SiteEmailPanel initialStatus={initialStatus} siteId={data.site.id} siteName={data.site.name} />
    </AdminShell>
  );
}
