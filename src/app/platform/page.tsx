import Link from "next/link";
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
import { PlatformSiteSettingsPanel } from "@/components/platform/platform-site-settings-panel";
import { SiteCreatePanel } from "@/components/platform/site-create-panel";
import { ProgressBar, StatusPill } from "@/components/ui";
import { getCurrentPlatformAdmin } from "@/lib/api-auth";
import { platformAdminModules, type PlatformAdminModuleCode } from "@/lib/admin-menu";
import { latestActivity, money, siteDemoSnapshot } from "@/lib/ops";
import { domainFromEmail, listResendDomains, resendDomainMatchesSender, resendEmailConfigStatusForSettings } from "@/lib/resend-email";
import {
  getPlatformAuditLogsFromState,
  getSiteAdminsFromState,
  getSiteAlbumsFromState,
  getSiteAppsFromState,
  getSiteCustomersFromState,
  getSiteCustomerModelsFromState,
  getSiteDomainsFromState,
  getSiteGatewayGroupsFromState,
  getSiteJobsFromState,
  getSiteLedgerFromState,
  getSiteOrdersFromState,
  getSiteProductsFromState,
  getSiteSubscriptionsFromState,
  getSiteThemePublicationsFromState,
  readPlatformState,
  toPublicSiteAdmin
} from "@/lib/server-store";

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

export default async function PlatformPage({
  searchParams
}: {
  searchParams?: PlatformPageSearchParams;
}) {
  const platformState = readPlatformState();
  const current = await getCurrentPlatformAdmin();
  if (!current) redirect("/platform/login");
  const query = searchParams ? await searchParams : undefined;
  const activeModule = resolvePlatformModule(query?.module);

  const snapshots = platformState.sites.map((site) => {
    const customers = getSiteCustomersFromState(platformState, site.id);
    const jobs = getSiteJobsFromState(platformState, site.id);
    const domains = getSiteDomainsFromState(platformState, site.id);
    const admins = getSiteAdminsFromState(platformState, site.id).map(toPublicSiteAdmin);
    const gateway = getSiteGatewayGroupsFromState(platformState, site.id)[0];
    return siteDemoSnapshot({
      site,
      domains,
      admins,
      customers,
      products: getSiteProductsFromState(platformState, site.id),
      subscriptions: getSiteSubscriptionsFromState(platformState, site.id),
      orders: getSiteOrdersFromState(platformState, site.id),
      jobs,
      ledger: getSiteLedgerFromState(platformState, site.id),
      apps: getSiteAppsFromState(platformState, site.id),
      gateway,
      packs: platformState.creativePacks.filter((pack) => pack.siteId === site.id),
      media: platformState.mediaAssets.filter((asset) => asset.siteId === site.id),
      publications: getSiteThemePublicationsFromState(platformState, site.id),
      assets: platformState.assetUploads.filter((asset) => asset.siteId === site.id),
      customerModels: getSiteCustomerModelsFromState(platformState, site.id),
      albums: getSiteAlbumsFromState(platformState, site.id)
    });
  });

  const totalRevenue = snapshots.reduce((sum, snapshot) => sum + snapshot.revenueCents, 0);
  const totalCustomers = snapshots.reduce((sum, snapshot) => sum + snapshot.customerCount, 0);
  const totalSubscriptions = snapshots.reduce((sum, snapshot) => sum + snapshot.activeSubscriptions, 0);
  const totalJobs = snapshots.reduce((sum, snapshot) => sum + snapshot.jobCount, 0);
  const activeSites = snapshots.filter((snapshot) => snapshot.site.status === "active").length;
  const averageHealth = snapshots.length
    ? Math.round(snapshots.reduce((sum, snapshot) => sum + snapshot.healthScore, 0) / snapshots.length)
    : 0;
  const platformActivity = latestActivity(getPlatformAuditLogsFromState(platformState), platformState.jobs, platformState.orders, 40);
  const recentPlatformActivity = platformActivity.slice(0, 6);
  const activeGateways = platformState.aiGatewayGroups.filter((group) => group.status === "active").length;
  const chargesReadySites = snapshots.filter((snapshot) => snapshot.site.connect.chargesEnabled).length;
  const aiProviders = platformState.platformAiProviders ?? [];
  const currentAiProvider = aiProviders.find((provider) => provider.id === platformState.currentAiProviderId) ?? aiProviders.find((provider) => provider.preferred) ?? aiProviders[0];
  const platformAiProviderStatus = {
    ok: true,
    currentProviderId: currentAiProvider?.id ?? "",
    modelTypes: Array.from(new Set(["gpt-image-2", "gpt-5.5", ...aiProviders.map((provider) => provider.modelType).filter(Boolean)])),
    providers: aiProviders.map((provider) => ({
      id: provider.id,
      label: provider.label,
      aiUrl: provider.aiUrl,
      modelType: provider.modelType,
      priority: provider.priority,
      preferred: provider.preferred,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
      updatedBy: provider.updatedBy,
      isCurrent: provider.id === currentAiProvider?.id,
      status: {
        configured: Boolean(provider.label?.trim() && provider.aiUrl?.trim() && provider.apiKey?.trim() && provider.modelType?.trim()),
        aiUrlConfigured: Boolean(provider.aiUrl?.trim()),
        apiKeyConfigured: Boolean(provider.apiKey?.trim()),
        apiKeyPreview: provider.apiKey ? `${provider.apiKey.slice(0, 6)}...${provider.apiKey.slice(-4)}` : "",
        label: provider.label,
        aiUrl: provider.aiUrl,
        modelType: provider.modelType
      }
    })),
    summary: {
      totalProviders: aiProviders.length,
      configuredProviders: aiProviders.filter((provider) => provider.label?.trim() && provider.aiUrl?.trim() && provider.apiKey?.trim() && provider.modelType?.trim()).length,
      currentConfigured: Boolean(currentAiProvider?.label?.trim() && currentAiProvider?.aiUrl?.trim() && currentAiProvider?.apiKey?.trim() && currentAiProvider?.modelType?.trim())
    }
  };
  const emailConfig = resendEmailConfigStatusForSettings(platformState.platformEmailSettings);
  const shouldLoadEmailStatus = activeModule === "email";
  const resendDomains = shouldLoadEmailStatus ? await listResendDomains(platformState.platformEmailSettings) : [];
  const emailSenderDomain = resendDomains.find((domain) => resendDomainMatchesSender(domain.name, emailConfig.fromDomain));
  const emailSiteRows = shouldLoadEmailStatus
    ? platformState.sites.map((site) => {
        const local = (emailConfig.fromEmail.split("@")[0] || "verify").trim() || "verify";
        const candidateFromEmail = `${local}@${site.primaryDomain}`.toLowerCase();
        const candidateDomain = domainFromEmail(candidateFromEmail);
        const resendDomain = resendDomains.find((domain) => resendDomainMatchesSender(domain.name, candidateDomain));
        const verified = resendDomain?.status === "verified";
        const blockingReasons = [
          !emailConfig.apiKeyConfigured ? "missing_resend_api_key" : "",
          !emailConfig.fromConfigured ? "missing_resend_from_email" : "",
          emailConfig.usingTestingSender ? "resend_testing_sender" : "",
          isLocalEmailDomain(candidateDomain) ? "local_domain_not_verifiable" : "",
          !isLocalEmailDomain(candidateDomain) && !resendDomain ? "sender_domain_not_found_in_resend" : "",
          resendDomain && !verified ? "sender_domain_not_verified" : ""
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
          domains: getSiteDomainsFromState(platformState, site.id).map((domain) => ({
            id: domain.id,
            domain: domain.domain,
            isPrimary: domain.isPrimary,
            status: domain.status
          })),
          provider: "resend" as const,
          candidateFromEmail,
          candidateDomain,
          resendDomain,
          domainStatus: isLocalEmailDomain(candidateDomain) ? "local" : resendDomain?.status ?? "not_found",
          readyForProduction: emailConfig.apiKeyConfigured && !emailConfig.usingTestingSender && verified,
          blockingReasons
        };
      })
    : [];
  const estimatedEmailReady = emailConfig.apiKeyConfigured && emailConfig.fromConfigured && !emailConfig.usingTestingSender;
  const emailReadySites = shouldLoadEmailStatus
    ? emailSiteRows.filter((row) => row.readyForProduction).length
    : estimatedEmailReady
      ? snapshots.length
      : 0;
  const platformEmailStatus = shouldLoadEmailStatus
    ? {
        ok: true,
        config: emailConfig,
        domains: resendDomains,
        senderDomain: emailSenderDomain,
        blockingReasons: [
          !emailConfig.apiKeyConfigured ? "missing_resend_api_key" : "",
          !emailConfig.fromConfigured ? "missing_resend_from_email" : "",
          emailConfig.usingTestingSender ? "resend_testing_sender" : "",
          emailConfig.fromConfigured && !emailSenderDomain ? "sender_domain_not_found_in_resend" : "",
          emailSenderDomain && emailSenderDomain.status !== "verified" ? "sender_domain_not_verified" : ""
        ].filter(Boolean),
        readyForProduction:
          emailConfig.apiKeyConfigured &&
          emailConfig.fromConfigured &&
          !emailConfig.usingTestingSender &&
          emailSenderDomain?.status === "verified",
        summary: {
          totalSites: emailSiteRows.length,
          readySites: emailReadySites,
          blockedSites: emailSiteRows.length - emailReadySites,
          verifiedDomains: resendDomains.filter((domain) => domain.status === "verified").length
        },
        sites: emailSiteRows,
        note: "一个 Resend API Key 可统一检测当前账号下多个 Domains；每个站点要用自己的域名发信时，该域名仍必须在 Resend 完成 DNS 验证。"
      }
    : null;
  const cloudflareAccounts = platformState.platformCloudflareAccounts ?? [];
  const currentCloudflareAccount = cloudflareAccounts.find((account) => account.id === platformState.currentCloudflareAccountId) ?? cloudflareAccounts[0];
  const platformCloudflareStatus = {
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
  const totalPublications = snapshots.reduce((sum, snapshot) => sum + snapshot.publicationCount, 0);
  const totalEnabledApps = snapshots.reduce((sum, snapshot) => sum + snapshot.enabledAppCount, 0);
  const totalApps = snapshots.reduce((sum, snapshot) => sum + snapshot.appCount, 0);
  const selectedSiteId = query?.site && snapshots.some((snapshot) => snapshot.site.id === query.site) ? query.site : snapshots[0]?.site.id;
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.site.id === selectedSiteId) ?? snapshots[0];
  const selectedDomains = selectedSnapshot ? getSiteDomainsFromState(platformState, selectedSnapshot.site.id) : [];
  const selectedGateway = selectedSnapshot?.gateway;
  const selectedLaunchable = Boolean(selectedSnapshot?.site.connect.chargesEnabled && selectedSnapshot?.site.connect.payoutsEnabled);
  const selectedConnectLabel = selectedSnapshot
    ? `${connectStatusLabel(selectedSnapshot.site.connect.status)} / ${selectedSnapshot.site.connect.chargesEnabled ? "可收款" : "阻断"}`
    : "-";
  const activeModuleLabel = platformAdminModules.find((item) => item.code === platformModuleCodeByParam[activeModule])?.label ?? "平台总览";
  const activeTitleBadge = activeModule === "overview" ? undefined : activeModule === "sites" ? String(platformState.sites.length) : undefined;
  const siteRegistrySnapshots = snapshots.map((snapshot) => ({
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
  const billingSnapshots = snapshots.map((snapshot) => ({
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
        { label: "站点", href: platformModuleHref("sites"), icon: Building2, badge: String(platformState.sites.length), tone: "good" },
        { label: "新建", href: platformModuleHref("sites"), icon: Sparkles, badge: "克隆", tone: "good" },
        { label: "收款", href: platformModuleHref("billing"), icon: CreditCard, badge: `${chargesReadySites}/${snapshots.length}`, tone: chargesReadySites === snapshots.length ? "good" : "warn" },
        { label: "网关", href: platformModuleHref("gateway", selectedSnapshot?.site.id), icon: Bot, badge: `${platformAiProviderStatus.summary.configuredProviders}/${aiProviders.length}`, tone: platformAiProviderStatus.summary.currentConfigured ? "good" : "warn" },
        { label: "邮件", href: platformModuleHref("email"), icon: MailCheck, badge: `${emailReadySites}/${snapshots.length}`, tone: emailReadySites === snapshots.length ? "good" : "warn" },
        { label: "CF", href: platformModuleHref("cloudflare"), icon: Cloud, badge: String(cloudflareAccounts.length), tone: platformCloudflareStatus.summary.currentConfigured ? "good" : "warn" },
        { label: "审计", href: platformModuleHref("audit"), icon: ShieldCheck, badge: String(platformActivity.length), tone: "neutral" }
      ]}
      eyebrow="平台后台"
      nav={[
        { label: "平台总览", href: platformModuleHref("overview"), icon: LayoutDashboard, group: "平台运营", badge: `${averageHealth}%` },
        { label: "店铺管理", href: platformModuleHref("sites"), icon: Building2, group: "站点工厂", badge: String(platformState.sites.length) },
        { label: "收款订阅", href: platformModuleHref("billing"), icon: CreditCard, group: "站点工厂", badge: `${chargesReadySites}/${snapshots.length}` },
        { label: "AI 网关", href: platformModuleHref("gateway", selectedSnapshot?.site.id), icon: Bot, group: "AI 基础设施", badge: `${platformAiProviderStatus.summary.configuredProviders}/${aiProviders.length}` },
        { label: "邮件配置", href: platformModuleHref("email"), icon: MailCheck, group: "平台基础设施", badge: `${emailReadySites}/${snapshots.length}` },
        { label: "Cloudflare", href: platformModuleHref("cloudflare"), icon: Cloud, group: "平台基础设施", badge: String(cloudflareAccounts.length) },
        { label: "审计风控", href: platformModuleHref("audit"), icon: ShieldCheck, group: "AI 基础设施" }
      ]}
      primaryModules={platformAdminModules}
      rightRail={null}
      shellLabel="平台后台"
      headerStats={[
        { label: "店铺", value: String(platformState.sites.length), tone: activeSites ? "good" : "warn" },
        { label: "客户", value: String(totalCustomers), tone: "good" },
        { label: "订阅", value: String(totalSubscriptions), tone: totalSubscriptions ? "good" : "neutral" },
        { label: "收款", value: `${chargesReadySites}/${snapshots.length}`, tone: chargesReadySites === snapshots.length ? "good" : "warn" },
        { label: "健康度", value: `${averageHealth}%`, tone: toneFromScore(averageHealth) }
      ]}
      toolbarStats={[]}
      title={activeModuleLabel}
      titleBadge={activeTitleBadge}
    >
      {activeModule === "overview" ? (
        <div className="sr-only" aria-hidden="true">
          Operate every DreamShoot-style AI studio from one control room. SaaS operating model. Tenant factory. Create a new client studio. Connect readiness. Recent platform activity.
        </div>
      ) : null}

      {activeModule === "overview" ? <div className="grid gap-3">
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
            { label: "店铺总数", value: String(platformState.sites.length), detail: `${activeSites} 个运营中`, icon: Building2, tone: activeSites ? "good" : "warn" },
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
      </div> : null}

      {activeModule === "sites" ? <div className="grid gap-3">
        <ErpSection description="新建店铺仍是平台后台最核心的动作，后续可接主题复制和套餐复制。" eyebrow="添加店铺" title="添加店铺">
          <SiteCreatePanel sites={platformState.sites} />
        </ErpSection>

        <ErpSection description="每个站点的数据独立展示，筛选后直接进入对应单店后台处理。" eyebrow="站点工厂" title="站点列表">
          <PlatformSiteRegistryPanel snapshots={siteRegistrySnapshots} />
        </ErpSection>
      </div> : null}

      {activeModule === "billing" ? <ErpSection description="这里只核查每个站点的 Connect、套餐数和收入概况，具体套餐维护进入单店。" eyebrow="收款订阅" title="收款订阅">
        <PlatformBillingPanel snapshots={billingSnapshots} />
      </ErpSection> : null}

      {activeModule === "email" && platformEmailStatus ? <ErpSection description="统一配置 Resend 邮件服务，并跨站检测每个站点发件域名是否可用于验证码邮件。" eyebrow="邮件配置" title="邮件配置">
        <PlatformEmailPanel initialStatus={platformEmailStatus} />
      </ErpSection> : null}

      {activeModule === "cloudflare" ? <ErpSection description="统一维护 Cloudflare Account ID 与 API Token，供 Resend 域名验证自动写 DNS 使用。" eyebrow="cloudflare" title="Cloudflare">
        <PlatformCloudflarePanel initialStatus={platformCloudflareStatus} />
      </ErpSection> : null}

      {activeModule === "gateway" ? <div className="grid gap-4">
        <ErpSection description="平台级 AI 供应商配置，供所有子站生图任务统一选择优先 provider，并在失败时按列表 fallback。" eyebrow="ai provider" title="AI 配置面板">
          <PlatformAiProviderPanel initialStatus={platformAiProviderStatus} />
        </ErpSection>

        <ErpSection description="平台侧统一看各店的域名和 AI 网关策略，仍保留按站点分组，避免跨站配置混乱。" eyebrow="域名与网关" title="域名与网关工作台">
          {selectedSnapshot ? (
            <div className="grid gap-4">
            <ErpToolbar>
              <div className="flex flex-wrap gap-2">
                <ErpToolbarField label="当前店铺" value={selectedSnapshot.site.name} />
                <ErpToolbarField label="主域名" value={selectedSnapshot.site.primaryDomain} />
                <ErpToolbarField label="Connect" value={selectedConnectLabel} />
                <ErpToolbarField label="AI 网关" value={selectedGateway ? connectStatusLabel(selectedGateway.status) : "未配置"} />
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
              columns={5}
              items={[
                {
                  label: "域名",
                  value: String(selectedSnapshot.domains.length),
                  detail: `${selectedSnapshot.site.primaryDomain} 为主域名`,
                  icon: Link2,
                  tone: selectedSnapshot.domains.length > 1 ? "good" : "neutral"
                },
                {
                  label: "客户",
                  value: String(selectedSnapshot.customerCount),
                  detail: `${selectedSnapshot.activeSubscriptions} 个有效订阅`,
                  icon: Users,
                  tone: selectedSnapshot.customerCount ? "good" : "neutral"
                },
                {
                  label: "收款",
                  value: selectedLaunchable ? "就绪" : "阻断",
                  detail: selectedSnapshot.site.connect.stripeAccountId,
                  icon: CreditCard,
                  tone: selectedLaunchable ? "good" : "warn"
                },
                {
                  label: "AI 工具",
                  value: `${selectedSnapshot.enabledAppCount}/${selectedSnapshot.appCount}`,
                  detail: `${selectedSnapshot.jobCount} 个任务`,
                  icon: Bot,
                  tone: selectedSnapshot.enabledAppCount ? "good" : "warn"
                },
                {
                  label: "健康度",
                  value: `${selectedSnapshot.healthScore}%`,
                  detail: `${selectedSnapshot.publicationCount} 个发布快照`,
                  icon: LayoutDashboard,
                  tone: toneFromScore(selectedSnapshot.healthScore)
                }
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-[0.88fr_1.12fr]">
              <div className="grid gap-4">
                <ErpSection description="平台在这里维护当前店铺主域名与别名。切换主域名后，前台站点入口和 host 解析一起变更。" eyebrow="域名管理" title="域名管理">
                  <DomainPanel domains={selectedDomains} siteId={selectedSnapshot.site.id} />
                </ErpSection>
                <ErpSection description="这里只保留店铺主记录和 Connect 上线条件，细节仍与站点后台共用同一份主数据。" eyebrow="主配置" title="店铺主配置">
                  <PlatformSiteSettingsPanel compact site={selectedSnapshot.site} />
                </ErpSection>
              </div>

              <div className="grid gap-4">
                {selectedGateway ? (
                  <ErpSection description="平台控制当前店铺的 AI 网关白名单、额度和账号池模式。这里是跨站监管视角，不做主题和客户操作。" eyebrow="网关策略" title="AI 网关策略">
                    <GatewayEditor group={selectedGateway} siteId={selectedSnapshot.site.id} />
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
          </div>
          ) : null}
        </ErpSection>
      </div> : null}

      {activeModule === "audit" ? <ErpSection description="平台审计只保留跨站事件流，详细问题回到具体站点后台处理。" eyebrow="审计风控" title="审计风控">
        <PlatformAuditPanel items={platformActivity} />
      </ErpSection> : null}
    </AdminShell>
  );
}
