import { MailCheck } from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { SiteEmailPanel } from "@/components/admin/site-email-panel";
import { OpsCard } from "@/components/ui";
import { domainFromEmail, resendEmailConfigStatusForSettings, resolveResendSettingsForSite } from "@/lib/resend-email";
import {
  getSiteAdminData,
  modulePath,
  siteAdminAccount,
  siteAdminModuleLinks,
  siteAdminNav,
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
  const data = await getSiteAdminData(siteSlug, { include: ["email"], summary: false, take: 0 });
  const emailState = data.emailState;
  const selected = resolveResendSettingsForSite(emailState, data.site.id);
  const config = resendEmailConfigStatusForSettings(selected);
  const local = senderLocalPart(config.fromEmail || "verify@example.com");
  const candidateFromEmail = `${local}@${data.site.primaryDomain}`.toLowerCase();
  const candidateDomain = domainFromEmail(candidateFromEmail);
  const localDomain = isLocalDomain(candidateDomain);
  const blockingReasons = [
    !config.apiKeyConfigured ? "missing_resend_api_key" : "",
    !config.fromConfigured ? "missing_resend_from_email" : "",
    config.usingTestingSender ? "resend_testing_sender" : "",
    localDomain ? "local_domain_not_verifiable" : ""
  ].filter(Boolean);
  const initialStatus = {
    config: {
      ...config,
      id: selected.id,
      label: selected.label
    },
    domainStatus: localDomain ? "local" : config.apiKeyConfigured && config.fromConfigured && !config.usingTestingSender ? "unchecked" : "not_checked",
    candidateFromEmail,
    candidateDomain,
    readyForProduction: false,
    blockingReasons,
    resendDomain: undefined
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
      eyebrow="site email"
      moduleLinks={siteAdminModuleLinks}
      nav={siteAdminNav(data.site, data)}
      siteSlug={data.site.slug}
      stats={siteAdminStats(data)}
      subtitle="维护本站 Resend 发信参数，并发送单封验证码测试。测试邮件能到达目标邮箱即视为通过。"
      title="邮件管理"
      titleBadge={initialStatus.readyForProduction ? "ready" : "setup"}
      workspace={siteAdminWorkspace(data, "email workspace")}
      rightRail={null}
    >
      <div className="grid gap-5">
        <SiteEmailPanel initialStatus={initialStatus} siteId={data.site.id} siteName={data.site.name} />
        <OpsCard className="p-5">
          <div className="flex flex-wrap items-start gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[8px] border border-slate-200 bg-white text-[#1b77f3]">
              <MailCheck className="h-4 w-4" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">email scope</p>
              <h2 className="mt-2 text-lg font-semibold">单站边界</h2>
              <div className="mt-4 grid gap-3 text-[12px] leading-6 text-slate-500 md:grid-cols-2">
                <div className="break-words rounded-[8px] border border-slate-200 bg-white p-3 [overflow-wrap:anywhere]">
                  这里保存的 Resend 参数只绑定当前站点，不会改动其他站点的邮件配置。
                </div>
                <div className="break-words rounded-[8px] border border-slate-200 bg-white p-3 [overflow-wrap:anywhere]">
                  From Email 必须使用本站主域名或已绑定域名，避免跨站发信串域名。
                </div>
              </div>
            </div>
          </div>
        </OpsCard>
      </div>
    </AdminShell>
  );
}
