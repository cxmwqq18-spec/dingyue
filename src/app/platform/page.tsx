import { Suspense } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  Bot,
  Building2,
  Cloud,
  CreditCard,
  LayoutDashboard,
  Link2,
  MailCheck,
  ShieldCheck,
  Sparkles,
  Users
} from "lucide-react";
import { AdminShell } from "@/components/admin/admin-shell";
import { LogoutActionButton } from "@/components/auth/logout-action-button";
import { ErpInfoList, ErpSection, ErpStatGrid, ErpToolbar, ErpToolbarAction, ErpToolbarField } from "@/components/admin/erp-primitives";
import { DomainPanel } from "@/components/platform/domain-panel";
import { GatewayEditor } from "@/components/platform/gateway-editor";
import { PlatformSiteAdminLink } from "@/components/platform/platform-site-admin-link";
import { PlatformAuditPanel } from "@/components/platform/platform-audit-panel";
import { PlatformAiProviderPanel } from "@/components/platform/platform-ai-provider-panel";
import { PlatformBillingPanel } from "@/components/platform/platform-billing-panel";
import { PlatformCloudflarePanel } from "@/components/platform/platform-cloudflare-panel";
import { PlatformEmailPanel } from "@/components/platform/platform-email-panel";
import { PlatformSiteRegistryPanel } from "@/components/platform/platform-site-registry-panel";
import { SiteCreatePanel } from "@/components/platform/site-create-panel";
import { StatusPill } from "@/components/ui";
import { getCurrentPlatformAdmin } from "@/lib/api-auth";
import { platformAdminModules, type PlatformAdminModuleCode } from "@/lib/admin-menu";
import { siteAdminPathForHost } from "@/lib/domain-routing";
import { money } from "@/lib/ops";
import { domainFromEmail, resendEmailConfigStatusForSettings, resendEmailConfigStatusForSite, resolveResendSettingsForSite } from "@/lib/resend-email";
import {
  getPlatformActivityRelational,
  getPlatformAiProviderStatusRelational,
  getPlatformCloudflareOverviewRelational,
  getPlatformDashboardSummaryRelational,
  getPlatformEmailOverviewRelational,
  getPlatformGatewaySummaryRelational,
  type PlatformDashboardSnapshot
} from "@/lib/stores/platform-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function toneFromScore(score: number): "good" | "warn" | "bad" {
  if (score >= 76) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

type PlatformModuleParam = "overview" | "sites" | "billing" | "gateway" | "email" | "cloudflare" | "audit";
type PlatformPageSearchParams = Promise<{ site?: string; module?: string }>;
type PlatformGatewayGroup = NonNullable<PlatformDashboardSnapshot["gateway"]>;
type PlatformEmailOverviewPayload = Awaited<ReturnType<typeof getPlatformEmailOverviewRelational>>;
type PlatformCloudflareOverviewPayload = Awaited<ReturnType<typeof getPlatformCloudflareOverviewRelational>>;
type PlatformGatewayPayload = Awaited<ReturnType<typeof getPlatformGatewaySummaryRelational>>;
type PlatformModulePayload = PlatformEmailOverviewPayload | PlatformCloudflareOverviewPayload | PlatformGatewayPayload | Awaited<ReturnType<typeof getPlatformActivityRelational>> | undefined;
type PlatformAiProviderPayload = Awaited<ReturnType<typeof getPlatformAiProviderStatusRelational>>;

const platformModuleCodeByParam: Record<PlatformModuleParam, PlatformAdminModuleCode> = {
  overview: "platform_overview",
  sites: "sites",
  billing: "billing",
  gateway: "gateway",
  email: "email",
  cloudflare: "cloudflare",
  audit: "audit"
};

function platformModuleHref(module: PlatformModuleParam, siteId?: string): string {
  const params = new URLSearchParams({ module });
  if (siteId) params.set("site", siteId);
  return `/platform?${params.toString()}`;
}

function resolvePlatformModule(value: string | undefined): PlatformModuleParam {
  if (value === "sites" || value === "billing" || value === "gateway" || value === "email" || value === "cloudflare" || value === "audit") return value;
  return "overview";
}

function connectStatusLabel(status: string): string {
  if (status === "enabled") return "已启用";
  if (status === "pending") return "待处理";
  if (status === "restricted") return "受限";
  if (status === "not_started") return "未开始";
  if (status === "active") return "启用";
  return status || "-";
}

function isLocalEmailDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized.endsWith(".localhost");
}

function platformSiteRegistrySnapshots(snapshots: PlatformDashboardSnapshot[]) {
  return snapshots.map((snapshot) => ({
    site: {
      id: snapshot.site.id,
      name: snapshot.site.name,
      slug: snapshot.site.slug,
      primaryDomain: snapshot.site.primaryDomain,
      status: snapshot.site.status,
      connect: {
        chargesEnabled: snapshot.site.connect.chargesEnabled
      }
    },
    ownerEmail: snapshot.ownerEmail,
    domains: snapshot.domains.map((domain) => ({ id: domain.id })),
    customerCount: snapshot.customerCount,
    activeSubscriptions: snapshot.activeSubscriptions,
    revenueCents: snapshot.revenueCents,
    jobCount: snapshot.jobCount,
    enabledAppCount: snapshot.enabledAppCount,
    appCount: snapshot.appCount,
    publicationCount: snapshot.publicationCount,
    healthScore: snapshot.healthScore
  }));
}

function platformBillingSnapshots(snapshots: PlatformDashboardSnapshot[]) {
  return snapshots.map((snapshot) => ({
    site: {
      id: snapshot.site.id,
      name: snapshot.site.name,
      slug: snapshot.site.slug,
      primaryDomain: snapshot.site.primaryDomain,
      connect: {
        stripeAccountId: snapshot.site.connect.stripeAccountId,
        status: snapshot.site.connect.status,
        chargesEnabled: snapshot.site.connect.chargesEnabled,
        payoutsEnabled: snapshot.site.connect.payoutsEnabled
      }
    },
    productCount: snapshot.productCount,
    activeSubscriptions: snapshot.activeSubscriptions,
    customerCount: snapshot.customerCount,
    revenueCents: snapshot.revenueCents
  }));
}

function platformDomainsForSnapshots(snapshots: PlatformDashboardSnapshot[], siteDomains = snapshots.flatMap((snapshot) => snapshot.domains)) {
  return snapshots.flatMap((snapshot) => {
    const domainsForSite = siteDomains.filter((domain) => domain.siteId === snapshot.site.id);
    const normalizedDomains = domainsForSite.length
      ? domainsForSite
      : [{
          id: `${snapshot.site.id}:primary`,
          siteId: snapshot.site.id,
          domain: snapshot.site.primaryDomain,
          isPrimary: true,
          status: snapshot.site.status === "active" ? "active" as const : "pending" as const,
          allowedAiProviderIds: [],
          createdAt: new Date(0).toISOString()
        }];
    return normalizedDomains.map((domain) => ({
      ...domain,
      siteName: snapshot.site.name,
      siteSlug: snapshot.site.slug,
      sitePrimaryDomain: snapshot.site.primaryDomain
    }));
  });
}

function buildPlatformEmailStatus(platformOverview: PlatformEmailOverviewPayload | undefined) {
  const emailSettings = platformOverview?.platformEmailSettings;
  const emailState = {
    platformEmailSettings: emailSettings,
    platformEmailConfigs: platformOverview?.platformEmailConfigs ?? [],
    siteEmailConfigAssignments: platformOverview?.siteEmailConfigAssignments ?? []
  };
  const emailConfig = resendEmailConfigStatusForSettings(emailSettings);
  const resendDomains: Array<{ id?: string; name?: string; status?: string; region?: string; created_at?: string }> = [];
  const emailSiteRows = (platformOverview?.sites ?? []).map((site) => {
    const siteEmailConfig = resendEmailConfigStatusForSite(emailState, site.id);
    const selectedSettings = resolveResendSettingsForSite(emailState, site.id);
    const candidateFromEmail = (siteEmailConfig.fromEmail || `verify@${site.primaryDomain}`).trim().toLowerCase();
    const candidateDomain = domainFromEmail(candidateFromEmail);
    const localDomain = isLocalEmailDomain(candidateDomain);
    const blockingReasons = [
      !siteEmailConfig.apiKeyConfigured ? "missing_resend_api_key" : "",
      !siteEmailConfig.fromConfigured ? "missing_resend_from_email" : "",
      siteEmailConfig.usingTestingSender ? "resend_testing_sender" : "",
      localDomain ? "local_domain_not_verifiable" : ""
    ].filter(Boolean);
    return {
      site: {
        id: site.id,
        name: site.name,
        slug: site.slug,
        status: site.status,
        primaryDomain: site.primaryDomain,
        branding: site.branding
      },
      domains: (platformOverview?.siteDomains ?? []).filter((domain) => domain.siteId === site.id).map((domain) => ({
        id: domain.id,
        domain: domain.domain,
        isPrimary: domain.isPrimary,
        status: domain.status
      })),
      provider: "resend" as const,
      emailConfigId: selectedSettings.id,
      emailConfigLabel: selectedSettings.label,
      candidateFromEmail,
      candidateDomain,
      resendDomain: undefined,
      domainStatus: localDomain ? "local" as const : "unchecked" as const,
      readyForProduction: siteEmailConfig.apiKeyConfigured && siteEmailConfig.fromConfigured && !siteEmailConfig.usingTestingSender && !localDomain,
      blockingReasons,
      testResult: platformOverview?.emailTestResults?.[site.id]
    };
  });
  const estimatedEmailReady = emailConfig.apiKeyConfigured && emailConfig.fromConfigured && !emailConfig.usingTestingSender;
  const emailReadySites = emailSiteRows.filter((row) => row.readyForProduction).length;

  return {
    ok: true,
    config: emailConfig,
    domains: resendDomains,
    domainCheckError: undefined,
    senderDomain: undefined,
    blockingReasons: [
      !emailConfig.apiKeyConfigured ? "missing_resend_api_key" : "",
      !emailConfig.fromConfigured ? "missing_resend_from_email" : "",
      emailConfig.usingTestingSender ? "resend_testing_sender" : ""
    ].filter(Boolean),
    readyForProduction: estimatedEmailReady,
    summary: {
      totalSites: emailSiteRows.length,
      readySites: emailReadySites,
      blockedSites: emailSiteRows.length - emailReadySites,
      verifiedDomains: resendDomains.filter((domain) => domain.status === "verified").length
    },
    sites: emailSiteRows,
    note: "邮件配置以真实发送测试为准：点击测试并成功发送到目标邮箱，即视为该站点发信流程通过。"
  };
}

function buildPlatformCloudflareStatus(platformOverview: PlatformCloudflareOverviewPayload | undefined) {
  const cloudflareAccounts = platformOverview?.platformCloudflareAccounts ?? [];
  const currentCloudflareAccount = cloudflareAccounts.find((account) => account.id === platformOverview?.currentCloudflareAccountId) ?? cloudflareAccounts[0];
  return {
    ok: true,
    currentAccountId: currentCloudflareAccount?.id ?? "",
    accounts: cloudflareAccounts.map((account) => ({
      id: account.id,
      label: account.label,
      email: account.email,
      accountId: account.accountId,
      createdAt: account.createdAt,
      updatedAt: account.updatedAt ?? account.createdAt,
      updatedBy: account.updatedBy,
      isCurrent: account.id === currentCloudflareAccount?.id,
      status: {
        configured: Boolean(account.accountId?.trim() && account.apiToken?.trim()),
        accountIdConfigured: Boolean(account.accountId?.trim()),
        apiTokenConfigured: Boolean(account.apiToken?.trim()),
        apiTokenPreview: account.apiToken ? `${account.apiToken.slice(0, 6)}...${account.apiToken.slice(-4)}` : "",
        label: account.label,
        email: account.email,
        accountId: account.accountId
      }
    })),
    summary: {
      totalAccounts: cloudflareAccounts.length,
      configuredAccounts: cloudflareAccounts.filter((account) => account.accountId?.trim() && account.apiToken?.trim()).length,
      currentConfigured: Boolean(currentCloudflareAccount?.accountId?.trim() && currentCloudflareAccount?.apiToken?.trim())
    }
  };
}

function PlatformModuleLoading({ title = "模块数据加载中" }: { title?: string }) {
  return (
    <ErpSection description="左侧导航和顶部栏可继续使用，当前模块的数据会在这里局部更新。" eyebrow="loading" title={title}>
      <div className="grid gap-3">
        <div className="h-10 rounded-[8px] bg-[var(--admin-panel)]" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <div className="h-24 rounded-[8px] border border-[var(--admin-border-soft)] bg-[linear-gradient(90deg,#f8fafc_0%,#eef4ff_50%,#f8fafc_100%)]" key={item} />
          ))}
        </div>
      </div>
    </ErpSection>
  );
}

async function PlatformModuleContent({
  activeModule,
  querySiteId,
  shellSnapshots,
  aiProviderPayload,
  preloadedModulePayload
}: {
  activeModule: PlatformModuleParam;
  querySiteId?: string;
  shellSnapshots: PlatformDashboardSnapshot[];
  aiProviderPayload: PlatformAiProviderPayload;
  preloadedModulePayload?: PlatformModulePayload;
}) {
  const modulePayload = preloadedModulePayload ?? (
    activeModule === "gateway"
      ? await getPlatformGatewaySummaryRelational()
      : activeModule === "audit"
        ? await getPlatformActivityRelational(40)
        : activeModule === "email"
          ? await getPlatformEmailOverviewRelational()
          : activeModule === "cloudflare"
            ? await getPlatformCloudflareOverviewRelational()
            : undefined
  );
  const moduleSnapshots =
    modulePayload && !Array.isArray(modulePayload) && "snapshots" in modulePayload
      ? modulePayload.snapshots
      : undefined;
  const snapshots: PlatformDashboardSnapshot[] = moduleSnapshots ?? shellSnapshots;
  const platformSites = modulePayload && !Array.isArray(modulePayload) && "sites" in modulePayload
    ? modulePayload.sites
    : snapshots.map((snapshot) => snapshot.site);
  const platformSiteDomains = modulePayload && !Array.isArray(modulePayload) && "siteDomains" in modulePayload
    ? modulePayload.siteDomains
    : snapshots.flatMap((snapshot) => snapshot.domains);
  const platformActivity = activeModule === "audit" && Array.isArray(modulePayload) ? modulePayload : [];
  const recentPlatformActivity = platformActivity.slice(0, 6);
  const totalRevenue = snapshots.reduce((sum, snapshot) => sum + snapshot.revenueCents, 0);
  const totalCustomers = snapshots.reduce((sum, snapshot) => sum + snapshot.customerCount, 0);
  const totalSubscriptions = snapshots.reduce((sum, snapshot) => sum + snapshot.activeSubscriptions, 0);
  const totalJobs = snapshots.reduce((sum, snapshot) => sum + snapshot.jobCount, 0);
  const activeSites = snapshots.filter((snapshot) => snapshot.site.status === "active").length;
  const activeGateways = snapshots.map((snapshot) => snapshot.gateway).filter((group): group is PlatformGatewayGroup => Boolean(group)).filter((group) => group.status === "active").length;
  const chargesReadySites = snapshots.filter((snapshot) => snapshot.site.connect.chargesEnabled).length;
  const totalPublications = snapshots.reduce((sum, snapshot) => sum + snapshot.publicationCount, 0);
  const totalEnabledApps = snapshots.reduce((sum, snapshot) => sum + snapshot.enabledAppCount, 0);
  const totalApps = snapshots.reduce((sum, snapshot) => sum + snapshot.appCount, 0);
  const selectedSiteId = querySiteId && snapshots.some((snapshot) => snapshot.site.id === querySiteId) ? querySiteId : snapshots[0]?.site.id;
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.site.id === selectedSiteId) ?? snapshots[0];
  const selectedGateway = selectedSnapshot?.gateway;
  const platformDomains = platformDomainsForSnapshots(snapshots, platformSiteDomains);
  const { aiProviders, platformAiProviderStatus } = aiProviderPayload;

  if (activeModule === "overview") {
    return (
      <>
        <div className="sr-only" aria-hidden="true">
          Operate every DreamShoot-style AI studio from one control room. SaaS operating model. Tenant factory. Create a new client studio. Connect readiness. Recent platform activity.
        </div>
        <div className="grid gap-3">
          <ErpToolbar>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarField label="运营店铺" value={`${activeSites}/${snapshots.length}`} />
              <ErpToolbarField label="收款就绪" value={`${chargesReadySites}/${snapshots.length}`} />
              <ErpToolbarField label="AI 网关" value={String(activeGateways)} />
              <ErpToolbarField label="发布快照" value={String(totalPublications)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpToolbarAction href={platformModuleHref("sites")} label="添加店铺" primary />
              <ErpToolbarAction href={platformModuleHref("billing")} label="收款检查" />
              <ErpToolbarAction href={platformModuleHref("audit")} label="查看审计" />
            </div>
          </ErpToolbar>

          <ErpStatGrid
            items={[
              { label: "店铺总数", value: String(platformSites.length), detail: `${activeSites} 个运营中`, icon: Building2, tone: activeSites ? "good" : "warn" },
              { label: "客户总数", value: String(totalCustomers), detail: `${totalSubscriptions} 个有效订阅`, icon: Users, tone: totalCustomers ? "good" : "neutral" },
              { label: "跨站收入", value: money(totalRevenue), detail: "支付确认后的收入汇总", icon: CreditCard, tone: totalRevenue ? "good" : "neutral" },
              { label: "AI 任务", value: String(totalJobs), detail: `${totalEnabledApps}/${totalApps} 个工具已启用`, icon: Bot, tone: totalJobs ? "good" : "neutral" }
            ]}
            columns={4}
          />

          <ErpSection description="这里只保留平台是否可继续开站、收款和发布的关键状态，不展示站点工厂列表。" eyebrow="平台状态" title="平台状态">
            <ErpInfoList
              items={[
                { label: "运营店铺", value: `${activeSites}/${snapshots.length}`, tone: activeSites === snapshots.length ? "good" : "warn" },
                { label: "Connect 就绪", value: `${chargesReadySites}/${snapshots.length}`, tone: chargesReadySites === snapshots.length ? "good" : "warn" },
                { label: "发布快照", value: String(totalPublications), tone: totalPublications > 0 ? "good" : "neutral" },
                { label: "AI 网关组", value: String(activeGateways), tone: activeGateways > 0 ? "good" : "warn" }
              ]}
            />
          </ErpSection>

          <ErpSection description="平台侧只看跨站最新动作，详细处理仍进入对应模块或站点后台。" eyebrow="最近动态" title="最近动态">
            <div className="overflow-hidden rounded-[8px] border border-[var(--admin-border-soft)] bg-white">
              {recentPlatformActivity.map((item, index) => (
                <div className={`px-4 py-3 text-[12px] ${index < recentPlatformActivity.length - 1 ? "border-b border-[var(--admin-border-soft)]" : ""}`} key={item.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[#475467]">{item.label}</span>
                    <StatusPill label={item.tone} tone={item.tone} />
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[#8a94a6]">{item.detail}</p>
                </div>
              ))}
            </div>
          </ErpSection>
        </div>
      </>
    );
  }

  if (activeModule === "sites") {
    return (
      <div className="grid gap-3">
        <ErpSection description="新建店铺仍是平台后台最核心的动作，后续可接主题复制和套餐复制。" eyebrow="添加店铺" title="添加店铺">
          <SiteCreatePanel sites={platformSites} />
        </ErpSection>

        <ErpSection description="每个站点的数据独立展示，筛选后直接进入对应单店后台处理。" eyebrow="站点工厂" title="站点列表">
          <PlatformSiteRegistryPanel snapshots={platformSiteRegistrySnapshots(snapshots)} />
        </ErpSection>
      </div>
    );
  }

  if (activeModule === "billing") {
    return (
      <ErpSection description="这里只核查每个站点的 Connect、套餐数和收入概况，具体套餐维护进入单店。" eyebrow="收款订阅" title="收款订阅">
        <PlatformBillingPanel snapshots={platformBillingSnapshots(snapshots)} />
      </ErpSection>
    );
  }

  if (activeModule === "email") {
    return (
      <ErpSection description="统一配置 Resend 邮件服务，并跨站检测每个站点发件域名是否可用于验证码邮件。" eyebrow="邮件配置" title="邮件配置">
        <PlatformEmailPanel initialStatus={buildPlatformEmailStatus(modulePayload && !Array.isArray(modulePayload) && "platformEmailConfigs" in modulePayload && !("platformCloudflareAccounts" in modulePayload) ? modulePayload : undefined)} />
      </ErpSection>
    );
  }

  if (activeModule === "cloudflare") {
    return (
      <ErpSection description="统一维护 Cloudflare Account ID 与 API Token，用于平台 DNS 运维记录；邮箱发信域名可手动在 Cloudflare 完成 DNS 验证。" eyebrow="cloudflare" title="Cloudflare">
        <PlatformCloudflarePanel initialStatus={buildPlatformCloudflareStatus(modulePayload && !Array.isArray(modulePayload) && "platformCloudflareAccounts" in modulePayload ? modulePayload : undefined)} />
      </ErpSection>
    );
  }

  if (activeModule === "gateway") {
    return (
      <div className="grid gap-4">
        <ErpSection description="平台级 AI 供应商配置，供所有子站生图任务统一选择优先 provider，并在失败时按列表 fallback。" eyebrow="ai provider" title="AI 配置面板">
          <PlatformAiProviderPanel initialStatus={platformAiProviderStatus} />
        </ErpSection>

        <ErpSection description="AI 中转默认对所有站点域名可用；域名新增仍在站点工厂处理，这里只查看全平台使用范围和少量兜底策略。" eyebrow="域名与网关" title="域名与网关工作台">
          {selectedSnapshot ? (
            <div className="grid gap-4">
              <ErpToolbar>
                <div className="flex flex-wrap gap-2">
                  <ErpToolbarField label="站点数量" value={String(snapshots.length)} />
                  <ErpToolbarField label="域名记录" value={String(platformDomains.length)} />
                  <ErpToolbarField label="可用 AI URL" value={String(aiProviders.filter((provider) => provider.aiUrl).length)} />
                  <ErpToolbarField label="中转策略" value="全站可用" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <PlatformSiteAdminLink className="admin_btn inline-flex h-[34px] items-center justify-center px-3.5" label="进入后台" siteId={selectedSnapshot.site.id} />
                  <Link className="admin_btn inline-flex h-[34px] items-center justify-center px-3.5" href={`/site/${selectedSnapshot.site.slug}`}>访问前台</Link>
                </div>
              </ErpToolbar>

              <div className="flex flex-wrap gap-2">
                {snapshots.map((snapshot) => {
                  const active = snapshot.site.id === selectedSnapshot.site.id;
                  return (
                    <Link
                      className={`inline-flex h-[34px] items-center gap-2 rounded-[8px] border px-3 text-[12px] transition ${
                        active
                          ? "border-[#cddcff] bg-[#eef4ff] text-[#1b77f3]"
                          : "border-[var(--admin-border-soft)] bg-white text-[#667085] hover:border-[#d7dee8] hover:text-[var(--admin-text)]"
                      }`}
                      href={platformModuleHref("gateway", snapshot.site.id)}
                      key={`platform-workbench:${snapshot.site.id}`}
                    >
                      <span>{snapshot.site.name}</span>
                      <span className={`rounded-[999px] px-2 py-0.5 font-mono text-[10px] ${active ? "bg-white text-[#1b77f3]" : "bg-[var(--admin-panel)] text-[#98a2b3]"}`}>
                        {snapshot.site.connect.chargesEnabled ? "就绪" : "待配置"}
                      </span>
                    </Link>
                  );
                })}
              </div>

              <ErpStatGrid
                columns={4}
                items={[
                  {
                    label: "域名网站",
                    value: String(platformDomains.length),
                    detail: `${snapshots.length} 个站点统一接入`,
                    icon: Link2,
                    tone: platformDomains.length ? "good" : "warn"
                  },
                  {
                    label: "站点",
                    value: String(snapshots.length),
                    detail: "可在下方切换查看策略",
                    icon: Users,
                    tone: snapshots.length ? "good" : "neutral"
                  },
                  {
                    label: "AI 中转",
                    value: aiProviders.length ? "全站可用" : "未配置",
                    detail: `${aiProviders.filter((provider) => provider.aiUrl).length} 个 AI URL`,
                    icon: Bot,
                    tone: aiProviders.length ? "good" : "warn"
                  },
                  {
                    label: "当前策略站点",
                    value: selectedSnapshot.site.name,
                    detail: selectedGateway ? connectStatusLabel(selectedGateway.status) : "未配置",
                    icon: LayoutDashboard,
                    tone: selectedGateway ? "good" : "warn"
                  }
                ]}
              />

              <div className="grid gap-4">
                <ErpSection description="域名在站点工厂新增；AI URL 使用范围由平台供应商队列统一生效，不需要逐域名保存。" eyebrow="域名管理" title="域名 AI URL 使用范围">
                  <DomainPanel domains={platformDomains} providers={aiProviders} />
                </ErpSection>

                {selectedGateway ? (
                  <ErpSection description="当前只保留策略参数查看和兜底编辑；AI 中转已默认对所有站点域名可用。" eyebrow="网关策略" title={`AI 网关策略：${selectedSnapshot.site.name}`}>
                    <GatewayEditor group={selectedGateway} providers={aiProviders} siteId={selectedSnapshot.site.id} />
                  </ErpSection>
                ) : (
                  <ErpSection description="当前店铺还没有分配 AI 网关组。" eyebrow="网关策略" title="AI 网关策略">
                    <div className="rounded-[8px] border border-dashed border-[var(--admin-border-soft)] bg-[var(--admin-panel)] px-4 py-6 text-[13px] text-[var(--admin-muted)]">
                      先为这个店铺创建或启用 AI gateway group，再配置模型白名单和额度。
                    </div>
                  </ErpSection>
                )}
              </div>
            </div>
          ) : null}
        </ErpSection>
      </div>
    );
  }

  return (
    <ErpSection description="平台审计只保留跨站事件流，详细问题回到具体站点后台处理。" eyebrow="审计风控" title="审计风控">
      <PlatformAuditPanel items={platformActivity} />
    </ErpSection>
  );
}

export default async function PlatformPage({
  searchParams
}: {
  searchParams?: PlatformPageSearchParams;
}) {
  const [current, query, headerStore] = await Promise.all([
    getCurrentPlatformAdmin(),
    searchParams ? searchParams : Promise.resolve(undefined),
    headers()
  ]);
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const siteAdminPath = siteAdminPathForHost(host);
  if (siteAdminPath) redirect(siteAdminPath);
  if (!current) redirect("/platform/login");
  const activeModule = resolvePlatformModule(query?.module);

  const preloadedModulePayloadPromise =
    activeModule === "gateway"
      ? getPlatformGatewaySummaryRelational()
      : activeModule === "email"
        ? getPlatformEmailOverviewRelational()
        : activeModule === "cloudflare"
          ? getPlatformCloudflareOverviewRelational()
          : undefined;
  const shellSummaryPromise = activeModule === "gateway" && preloadedModulePayloadPromise
    ? Promise.all([preloadedModulePayloadPromise, getPlatformActivityRelational(6)]).then(([gatewaySummary, platformActivity]) => ({
        sites: "sites" in gatewaySummary ? gatewaySummary.sites : [],
        siteDomains: "siteDomains" in gatewaySummary ? gatewaySummary.siteDomains : [],
        aiGatewayGroupCount: "aiGatewayGroups" in gatewaySummary ? gatewaySummary.aiGatewayGroups.length : 0,
        snapshots: "snapshots" in gatewaySummary ? gatewaySummary.snapshots : [],
        platformActivity
      }))
    : getPlatformDashboardSummaryRelational();
  const [shellSummary, aiProviderPayload, preloadedModulePayload] = await Promise.all([
    shellSummaryPromise,
    getPlatformAiProviderStatusRelational(),
    preloadedModulePayloadPromise ?? Promise.resolve(undefined)
  ]);
  const shellSnapshots = shellSummary.snapshots;
  const totalCustomers = shellSnapshots.reduce((sum, snapshot) => sum + snapshot.customerCount, 0);
  const totalSubscriptions = shellSnapshots.reduce((sum, snapshot) => sum + snapshot.activeSubscriptions, 0);
  const activeSites = shellSnapshots.filter((snapshot) => snapshot.site.status === "active").length;
  const averageHealth = shellSnapshots.length
    ? Math.round(shellSnapshots.reduce((sum, snapshot) => sum + snapshot.healthScore, 0) / shellSnapshots.length)
    : 0;
  const chargesReadySites = shellSnapshots.filter((snapshot) => snapshot.site.connect.chargesEnabled).length;
  const { aiProviders, platformAiProviderStatus } = aiProviderPayload;
  const selectedSiteId = query?.site && shellSnapshots.some((snapshot) => snapshot.site.id === query.site) ? query.site : shellSnapshots[0]?.site.id;
  const selectedSnapshot = shellSnapshots.find((snapshot) => snapshot.site.id === selectedSiteId) ?? shellSnapshots[0];
  const activeModuleLabel = platformAdminModules.find((item) => item.code === platformModuleCodeByParam[activeModule])?.label ?? "平台总览";
  const activeTitleBadge = activeModule === "overview" ? undefined : activeModule === "sites" ? String(shellSummary.sites.length) : undefined;

  return (
    <AdminShell
      account={
        <div>
          <p className="text-[11px] text-white/35">平台账号</p>
          <p className="mt-2 truncate text-[12px] text-white/80">{current.platformAdmin.email}</p>
          <div className="mt-4">
            <LogoutActionButton endpoint="/api/platform/auth/logout" redirectTo="/platform/login" />
          </div>
        </div>
      }
      action={{ label: "添加店铺", href: platformModuleHref("sites") }}
      activeModuleCode={platformModuleCodeByParam[activeModule]}
      brand="DreamOps"
      breadcrumbs={[
        { label: "平台后台" },
        { label: activeModuleLabel }
      ]}
      commandActions={[
        { label: "站点", href: platformModuleHref("sites"), icon: Building2, badge: String(shellSummary.sites.length), tone: "good" },
        { label: "新建", href: platformModuleHref("sites"), icon: Sparkles, badge: "克隆", tone: "good" },
        { label: "收款", href: platformModuleHref("billing"), icon: CreditCard, badge: `${chargesReadySites}/${shellSnapshots.length}`, tone: chargesReadySites === shellSnapshots.length ? "good" : "warn" },
        { label: "网关", href: platformModuleHref("gateway", selectedSnapshot?.site.id), icon: Bot, badge: `${platformAiProviderStatus.summary.configuredProviders}/${aiProviders.length}`, tone: platformAiProviderStatus.summary.currentConfigured ? "good" : "warn" },
        { label: "邮件", href: platformModuleHref("email"), icon: MailCheck, badge: "配置", tone: "neutral" },
        { label: "CF", href: platformModuleHref("cloudflare"), icon: Cloud, badge: "DNS", tone: "neutral" },
        { label: "审计", href: platformModuleHref("audit"), icon: ShieldCheck, badge: String(shellSummary.platformActivity.length), tone: "neutral" }
      ]}
      eyebrow="平台后台"
      nav={[
        { label: "平台总览", href: platformModuleHref("overview"), icon: LayoutDashboard, group: "平台运营", badge: `${averageHealth}%` },
        { label: "店铺管理", href: platformModuleHref("sites"), icon: Building2, group: "站点工厂", badge: String(shellSummary.sites.length) },
        { label: "收款订阅", href: platformModuleHref("billing"), icon: CreditCard, group: "站点工厂", badge: `${chargesReadySites}/${shellSnapshots.length}` },
        { label: "AI 网关", href: platformModuleHref("gateway", selectedSnapshot?.site.id), icon: Bot, group: "AI 基础设施", badge: `${platformAiProviderStatus.summary.configuredProviders}/${aiProviders.length}` },
        { label: "邮件配置", href: platformModuleHref("email"), icon: MailCheck, group: "平台基础设施", badge: "配置" },
        { label: "Cloudflare", href: platformModuleHref("cloudflare"), icon: Cloud, group: "平台基础设施", badge: "DNS" },
        { label: "审计风控", href: platformModuleHref("audit"), icon: ShieldCheck, group: "AI 基础设施" }
      ]}
      primaryModules={platformAdminModules}
      rightRail={null}
      shellLabel="平台后台"
      headerStats={[
        { label: "店铺", value: String(shellSummary.sites.length), tone: activeSites ? "good" : "warn" },
        { label: "客户", value: String(totalCustomers), tone: "good" },
        { label: "订阅", value: String(totalSubscriptions), tone: totalSubscriptions ? "good" : "neutral" },
        { label: "收款", value: `${chargesReadySites}/${shellSnapshots.length}`, tone: chargesReadySites === shellSnapshots.length ? "good" : "warn" },
        { label: "健康度", value: `${averageHealth}%`, tone: toneFromScore(averageHealth) }
      ]}
      toolbarStats={[]}
      title={activeModuleLabel}
      titleBadge={activeTitleBadge}
    >
      <Suspense fallback={<PlatformModuleLoading title={`${activeModuleLabel}加载中`} />}>
        <PlatformModuleContent
          activeModule={activeModule}
          aiProviderPayload={aiProviderPayload}
          preloadedModulePayload={preloadedModulePayload}
          querySiteId={query?.site}
          shellSnapshots={shellSnapshots}
        />
      </Suspense>
    </AdminShell>
  );
}
