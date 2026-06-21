import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Bot,
  Building2,
  CreditCard,
  LayoutDashboard,
  Link2,
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
import { PlatformBillingPanel } from "@/components/platform/platform-billing-panel";
import { PlatformSiteRegistryPanel } from "@/components/platform/platform-site-registry-panel";
import { PlatformSiteSettingsPanel } from "@/components/platform/platform-site-settings-panel";
import { SiteCreatePanel } from "@/components/platform/site-create-panel";
import { ProgressBar, StatusPill } from "@/components/ui";
import { platformAdminModules } from "@/lib/admin-menu";
import { publicSiteUrl } from "@/lib/domain-routing";
import { latestActivity, money, siteDemoSnapshot } from "@/lib/ops";
import {
  getPlatformAdminBySessionFromState,
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
import { platformSessionCookie } from "@/lib/session";

function toneFromScore(score: number): "good" | "warn" | "bad" {
  if (score >= 76) return "good";
  if (score >= 50) return "warn";
  return "bad";
}

type PlatformPageSearchParams = Promise<{ site?: string }>;

export default async function PlatformPage({
  searchParams
}: {
  searchParams?: PlatformPageSearchParams;
}) {
  const platformState = readPlatformState();
  const sessionId = (await cookies()).get(platformSessionCookie())?.value;
  const current = getPlatformAdminBySessionFromState(platformState, sessionId);
  if (!current) redirect("/platform/login");
  const query = searchParams ? await searchParams : undefined;

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
  const totalPublications = snapshots.reduce((sum, snapshot) => sum + snapshot.publicationCount, 0);
  const totalEnabledApps = snapshots.reduce((sum, snapshot) => sum + snapshot.enabledAppCount, 0);
  const totalApps = snapshots.reduce((sum, snapshot) => sum + snapshot.appCount, 0);
  const selectedSiteId = query?.site && snapshots.some((snapshot) => snapshot.site.id === query.site) ? query.site : snapshots[0]?.site.id;
  const selectedSnapshot = snapshots.find((snapshot) => snapshot.site.id === selectedSiteId) ?? snapshots[0];
  const selectedDomains = selectedSnapshot ? getSiteDomainsFromState(platformState, selectedSnapshot.site.id) : [];
  const selectedGateway = selectedSnapshot?.gateway;
  const selectedLaunchable = Boolean(selectedSnapshot?.site.connect.chargesEnabled && selectedSnapshot?.site.connect.payoutsEnabled);
  const selectedConnectLabel = selectedSnapshot
    ? `${selectedSnapshot.site.connect.status} / ${selectedSnapshot.site.connect.chargesEnabled ? "charges" : "blocked"}`
    : "-";

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
      action={{ label: "添加店铺", href: "#create-site" }}
      activeModuleCode="platform_overview"
      brand="DreamOps"
      breadcrumbs={[
        { label: "平台后台" },
        { label: "店铺管理" }
      ]}
      commandActions={[
        { label: "站点", href: "#sites", icon: Building2, badge: String(platformState.sites.length), tone: "good" },
        { label: "新建", href: "#create-site", icon: Sparkles, badge: "clone", tone: "good" },
        { label: "收款", href: "#billing", icon: CreditCard, badge: `${chargesReadySites}/${snapshots.length}`, tone: chargesReadySites === snapshots.length ? "good" : "warn" },
        { label: "网关", href: "#gateway", icon: Bot, badge: String(activeGateways), tone: activeGateways ? "good" : "warn" },
        { label: "审计", href: "#audit", icon: ShieldCheck, badge: String(platformActivity.length), tone: "neutral" }
      ]}
      eyebrow="平台总控"
      nav={[
        { label: "平台总览", href: "#overview", icon: LayoutDashboard, group: "Platform operations", badge: `${averageHealth}%` },
        { label: "店铺管理", href: "#sites", icon: Building2, group: "Tenant factory", badge: String(platformState.sites.length) },
        { label: "收款订阅", href: "#billing", icon: CreditCard, group: "Tenant factory", badge: `${chargesReadySites}/${snapshots.length}` },
        { label: "AI 网关", href: "#gateway", icon: Bot, group: "AI infrastructure", badge: String(activeGateways) },
        { label: "审计风控", href: "#audit", icon: ShieldCheck, group: "AI infrastructure" }
      ]}
      primaryModules={platformAdminModules}
      rightRail={
        <>
          <ErpSection description="这里只保留平台是否可继续开站、收款和发布的关键状态。" eyebrow="platform status" title="平台状态">
            <ErpInfoList
              items={[
                { label: "运营店铺", value: `${activeSites}/${snapshots.length}`, tone: activeSites === snapshots.length ? "good" : "warn" },
                { label: "Connect 就绪", value: `${chargesReadySites}/${snapshots.length}`, tone: chargesReadySites === snapshots.length ? "good" : "warn" },
                { label: "发布快照", value: String(totalPublications), tone: totalPublications > 0 ? "good" : "neutral" },
                { label: "AI 网关组", value: String(activeGateways), tone: activeGateways > 0 ? "good" : "warn" }
              ]}
            />
          </ErpSection>

          <ErpSection description="平台侧只看跨站最新动作，详细处理仍进对应站点后台。" eyebrow="activity stream" title="最近动态">
            <div className="overflow-hidden rounded-[8px] border border-[var(--admin-border-soft)] bg-white">
              {recentPlatformActivity.map((item, index) => (
                <div className={`px-3 py-3 text-[12px] ${index < recentPlatformActivity.length - 1 ? "border-b border-[var(--admin-border-soft)]" : ""}`} key={item.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[#475467]">{item.label}</span>
                    <StatusPill label={item.tone} tone={item.tone} />
                  </div>
                  <p className="mt-1 truncate font-mono text-[11px] text-[#8a94a6]">{item.detail}</p>
                </div>
              ))}
            </div>
          </ErpSection>
        </>
      }
      shellLabel="平台后台"
      headerStats={[
        { label: "店铺", value: String(platformState.sites.length), tone: activeSites ? "good" : "warn" },
        { label: "客户", value: String(totalCustomers), tone: "good" },
        { label: "订阅", value: String(totalSubscriptions), tone: totalSubscriptions ? "good" : "neutral" },
        { label: "收款", value: `${chargesReadySites}/${snapshots.length}`, tone: chargesReadySites === snapshots.length ? "good" : "warn" },
        { label: "健康度", value: `${averageHealth}%`, tone: toneFromScore(averageHealth) }
      ]}
      toolbarStats={[]}
      title="店铺管理"
      titleBadge={String(platformState.sites.length)}
    >
      <div className="sr-only" aria-hidden="true">
        Operate every DreamShoot-style AI studio from one control room. SaaS operating model. Tenant factory. Create a new client studio. Connect readiness. Recent platform activity.
      </div>

      <div className="grid gap-3" id="overview">
        <ErpToolbar>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarField label="运营店铺" value={`${activeSites}/${snapshots.length}`} />
            <ErpToolbarField label="收款就绪" value={`${chargesReadySites}/${snapshots.length}`} />
            <ErpToolbarField label="AI 网关" value={String(activeGateways)} />
            <ErpToolbarField label="发布快照" value={String(totalPublications)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ErpToolbarAction href="#create-site" label="添加店铺" primary />
            <ErpToolbarAction href="#billing" label="收款检查" />
            <ErpToolbarAction href="#audit" label="查看审计" />
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

        <ErpSection description="平台页核心就是店铺列表。先筛、再看状态、再进入单店后台处理。" eyebrow="tenant registry" title="店铺列表" id="sites">
          <PlatformSiteRegistryPanel snapshots={snapshots} />
        </ErpSection>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[0.95fr_1.05fr]">
        <ErpSection description="新建店铺仍是平台后台最核心的动作，后续可接主题复制和套餐复制。" eyebrow="tenant factory" title="添加店铺" id="create-site">
          <div>
            <SiteCreatePanel sites={platformState.sites} />
          </div>
        </ErpSection>

        <ErpSection description="这里只核查每个站点的 Connect、套餐数和收入概况，具体套餐维护进入单店。" eyebrow="billing readiness" title="收款订阅" id="billing">
          <PlatformBillingPanel snapshots={snapshots} />
        </ErpSection>
      </div>

      <ErpSection description="平台侧统一看各店的域名和 AI 网关策略，仍保留按站点分组，避免跨站配置混乱。" eyebrow="infra workbench" title="域名与网关工作台" id="gateway">
        {selectedSnapshot ? (
          <div className="grid gap-4">
            <ErpToolbar>
              <div className="flex flex-wrap gap-2">
                <ErpToolbarField label="当前店铺" value={selectedSnapshot.site.name} />
                <ErpToolbarField label="主域名" value={selectedSnapshot.site.primaryDomain} />
                <ErpToolbarField label="Connect" value={selectedConnectLabel} />
                <ErpToolbarField label="AI 网关" value={selectedGateway?.status ?? "none"} />
              </div>
              <div className="flex flex-wrap gap-2">
                <PlatformSiteAdminLink className="admin_btn inline-flex h-[34px] items-center justify-center px-3.5" label="进入后台" siteId={selectedSnapshot.site.id} />
                <Link className="admin_btn inline-flex h-[34px] items-center justify-center px-3.5" href={publicSiteUrl(selectedSnapshot.site)}>访问前台</Link>
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
                    href={`/platform?site=${encodeURIComponent(snapshot.site.id)}#gateway`}
                    key={`platform-workbench:${snapshot.site.id}`}
                  >
                    <span>{snapshot.site.name}</span>
                    <span className={`rounded-[999px] px-2 py-0.5 font-mono text-[10px] ${active ? "bg-white text-[#1b77f3]" : "bg-[var(--admin-panel)] text-[#98a2b3]"}`}>
                      {snapshot.site.connect.chargesEnabled ? "ready" : "setup"}
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
                  value: selectedLaunchable ? "READY" : "BLOCKED",
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
                <ErpSection description="平台在这里维护当前店铺主域名与别名。切换主域名后，前台站点入口和 host 解析一起变更。" eyebrow="domain registry" title="域名管理">
                  <DomainPanel domains={selectedDomains} siteId={selectedSnapshot.site.id} />
                </ErpSection>
                <ErpSection description="这里只保留店铺主记录和 Connect 上线条件，细节仍与站点后台共用同一份主数据。" eyebrow="site record" title="店铺主配置">
                  <PlatformSiteSettingsPanel compact site={selectedSnapshot.site} />
                </ErpSection>
              </div>

              <div className="grid gap-4">
                {selectedGateway ? (
                  <ErpSection description="平台控制当前店铺的 AI 网关白名单、额度和账号池模式。这里是跨站监管视角，不做主题和客户操作。" eyebrow="gateway policy" title="AI 网关策略">
                    <GatewayEditor group={selectedGateway} siteId={selectedSnapshot.site.id} />
                  </ErpSection>
                ) : (
                  <ErpSection description="当前店铺还没有分配 AI 网关组。" eyebrow="gateway policy" title="AI 网关策略">
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

      <ErpSection description="平台审计只保留跨站事件流，详细问题回到具体站点后台处理。" eyebrow="audit trail" title="审计风控" id="audit">
        <PlatformAuditPanel items={platformActivity} />
      </ErpSection>
    </AdminShell>
  );
}
