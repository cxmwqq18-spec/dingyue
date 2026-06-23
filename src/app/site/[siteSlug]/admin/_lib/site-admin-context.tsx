import { cookies } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Boxes,
  CreditCard,
  Database,
  FileClock,
  FileText,
  GalleryVerticalEnd,
  ImageIcon,
  LayoutDashboard,
  Layers3,
  MailCheck,
  Palette,
  ReceiptText,
  SearchCode,
  Settings2,
  ShoppingBag,
  Users
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { LogoutActionButton } from "@/components/auth/logout-action-button";
import { siteAdminModuleLinks, type SiteAdminModuleCode } from "@/lib/admin-menu";
import {
  getPublicSiteCustomersFromState,
  getSiteAlbumsFromState,
  getSiteAppsFromState,
  getSiteAuditLogsFromState,
  getSiteCreativePacksFromState,
  getSiteCustomerModelsFromState,
  getSiteDomainsFromState,
  getSiteGatewayGroupsFromState,
  getSiteJobsFromState,
  getSiteLedgerFromState,
  getSiteMediaAssetsFromState,
  getSiteOrdersFromState,
  getSiteProductsFromState,
  getSiteSubscriptionsFromState,
  getSiteThemePublicationsFromState,
  getSiteCustomersFromState,
  readPlatformState
} from "@/lib/server-store";
import { getCurrentSiteAdmin } from "@/lib/api-auth";
import { latestActivity, siteAvailableCredits, siteHealthScore, siteReservedCredits, siteRevenue } from "@/lib/ops";
import type { PlatformState, Site, SiteAdminSession, SiteAdmin, JobStatus } from "@/lib/types";

export type AdminModuleCode = SiteAdminModuleCode;
export { siteAdminModuleLinks };

function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "active" || status === "enabled" || status === "succeeded" || status === "fulfilled" || status === "paid" || status === "ready") return "good";
  if (status === "failed" || status === "refunded" || status === "blocked" || status === "canceled") return "bad";
  if (status === "pending" || status === "draft" || status === "past_due" || status === "running" || status === "queued" || status === "processing") return "warn";
  return "neutral";
}

function jobCountByStatus(jobs: Array<{ status: JobStatus }>, status: JobStatus): number {
  return jobs.filter((job) => job.status === status).length;
}

function rate(numerator: number, denominator: number): string {
  if (!denominator) return "0.0%";
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}

export function modulePath(site: Site, path: string): string {
  return `/site/${site.slug}${path}`;
}

export function siteAdminAccount(site: Site, current: { siteAdmin: SiteAdmin; session: SiteAdminSession }): ReactNode {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.18em] text-stone-500">站点管理员</p>
      <p className="mt-2 truncate font-mono text-xs text-stone-200">{current.siteAdmin.email}</p>
      <div className="mt-4">
        <LogoutActionButton endpoint={`/api/sites/${site.id}/admin/auth/logout`} redirectTo={`/site/${site.slug}/admin/login`} tone="dark" />
      </div>
    </div>
  );
}

export function siteAdminNav(site: Site, data: SiteAdminData) {
  return [
    { label: "店铺总览", href: modulePath(site, "/admin"), icon: LayoutDashboard, group: "店铺运营", badge: `${data.healthScore}%` },
    { label: "视觉装修器", href: modulePath(site, "/admin/design"), icon: Palette, group: "前台与主题", badge: String(site.pages.length) },
    { label: "页面管理", href: modulePath(site, "/admin/design/pages"), icon: FileText, group: "前台与主题", badge: String(site.pages.length) },
    { label: "导航菜单", href: modulePath(site, "/admin/design/navigation"), icon: GalleryVerticalEnd, group: "前台与主题", badge: String(site.themeSettings.draftJson.navigation.headerLinks.length + site.themeSettings.draftJson.navigation.footerLinks.length) },
    { label: "SEO 设置", href: modulePath(site, "/admin/design/seo"), icon: SearchCode, group: "前台与主题", badge: site.themeSettings.draftJson.seo?.siteTitle ? "meta" : "setup" },
    { label: "主题库", href: modulePath(site, "/admin/themes"), icon: Layers3, group: "前台与主题", badge: String(data.publications.length) },
    { label: "素材库", href: modulePath(site, "/admin/media"), icon: ImageIcon, group: "前台与主题", badge: String(data.media.length) },
    { label: "发布历史", href: modulePath(site, "/admin/design/publications"), icon: FileClock, group: "前台与主题", badge: String(data.publications.length) },
    { label: "商品与套餐", href: modulePath(site, "/admin/products"), icon: ShoppingBag, group: "交易与客户", badge: `${data.activeProducts}/${data.products.length}` },
    { label: "订单与订阅", href: modulePath(site, "/admin/orders"), icon: ReceiptText, group: "交易与客户", badge: String(data.orders.length) },
    { label: "顾客管理", href: modulePath(site, "/admin/customers"), icon: Users, group: "交易与客户", badge: String(data.customers.length) },
    { label: "AI 工具", href: modulePath(site, "/admin/ai-tools"), icon: Bot, group: "AI 订阅", badge: `${data.activeAiApps}/${data.apps.length}` },
    { label: "内容运营", href: modulePath(site, "/admin/content"), icon: FileText, group: "运营内容", badge: String(data.contentPageCount) },
    { label: "邮件管理", href: modulePath(site, "/admin/email"), icon: MailCheck, group: "设置与安全", badge: data.emailReady ? "ready" : "setup" },
    { label: "站点设置", href: modulePath(site, "/admin/settings"), icon: Settings2, group: "设置与安全", badge: data.site.connect.chargesEnabled ? "ready" : "setup" }
  ];
}

export function siteAdminCommandActions(site: Site, data: SiteAdminData) {
  return [
    { label: "前台", href: modulePath(site, ""), icon: LayoutDashboard, badge: "在线", tone: "neutral" as const },
    { label: "装修", href: modulePath(site, "/admin/design"), icon: Palette, badge: String(site.pages.length), tone: data.publications.length ? "good" as const : "warn" as const },
    { label: "商品", href: modulePath(site, "/admin/products"), icon: ShoppingBag, badge: String(data.products.length), tone: data.activeProducts ? "good" as const : "warn" as const },
    { label: "订单", href: modulePath(site, "/admin/orders"), icon: ReceiptText, badge: String(data.orders.length), tone: data.orders.length ? "good" as const : "neutral" as const },
    { label: "AI", href: modulePath(site, "/admin/ai-tools"), icon: Bot, badge: String(data.openJobs), tone: data.failedJobs ? "bad" as const : data.openJobs ? "warn" as const : "good" as const }
  ];
}

export function siteAdminQuickActions(site: Site, data: SiteAdminData) {
  return [
    { label: "打开装修器", href: modulePath(site, "/admin/design"), icon: Palette, detail: "页面树、区块树、全局页眉页脚、预览、保存和发布。", tone: data.publications.length ? "good" as const : "warn" as const },
    { label: "商品套餐", href: modulePath(site, "/admin/products"), icon: ShoppingBag, detail: "订阅套餐、credit pack 和 DreamShoot 风格拍摄包。", tone: data.activeProducts ? "good" as const : "warn" as const },
    { label: "顾客会员", href: modulePath(site, "/admin/customers"), icon: Users, detail: "客户状态、余额、模型、私有相册和素材边界。", tone: data.customers.length ? "good" as const : "neutral" as const },
    { label: "AI 工具", href: modulePath(site, "/admin/ai-tools"), icon: Bot, detail: "工具启用、扣费、worker 路由、任务队列和重跑。", tone: data.activeAiApps ? "good" as const : "warn" as const }
  ];
}

export function siteAdminStats(data: SiteAdminData) {
  return [
    { label: "健康度", value: `${data.healthScore}%`, tone: data.healthScore >= 76 ? "good" as const : data.healthScore >= 50 ? "warn" as const : "bad" as const },
    { label: "顾客", value: String(data.customers.length), tone: data.customers.length ? "good" as const : "neutral" as const },
    { label: "商品", value: `${data.activeProducts}/${data.products.length}`, tone: data.activeProducts ? "good" as const : "warn" as const },
    { label: "订单", value: String(data.orders.length), tone: data.orders.length ? "good" as const : "neutral" as const },
    { label: "AI", value: `${data.activeAiApps}/${data.apps.length}`, tone: data.activeAiApps ? "good" as const : "warn" as const }
  ];
}

export function siteAdminWorkspace(data: SiteAdminData, label = "站点工作区") {
  return {
    label,
    name: data.site.name,
    meta: data.site.primaryDomain,
    statusLabel: data.site.connect.chargesEnabled && data.publications.length ? "可上线" : "待配置",
    statusTone: data.site.connect.chargesEnabled && data.publications.length ? "good" as const : "warn" as const
  };
}

export function AdminMetricTile({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral"
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "good" | "warn" | "bad" | "neutral";
}) {
  const iconTone = {
    good: "text-[#5cb85c]",
    warn: "text-[#ff5722]",
    bad: "text-[#df002f]",
    neutral: "text-[#999]"
  }[tone];
  return (
    <div className="border border-[#f0f0f0] bg-white p-3 shadow-[1px_3px_3px_#eee]">
      <div className="flex items-center justify-between gap-3">
        <Icon className={`h-4 w-4 ${iconTone}`} strokeWidth={1.8} />
        <span className="font-mono text-[10px] uppercase text-[#999]">{label}</span>
      </div>
      <p className="mt-3 font-mono text-[22px] leading-[24px] text-[#333]">{value}</p>
      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#999]">{detail}</p>
    </div>
  );
}

export function ModuleLinkCard({
  href,
  icon: Icon,
  title,
  detail,
  meta,
  className = ""
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  meta: string;
  className?: string;
}) {
  const [metric, items] = meta.split(" / ");
  return (
    <Link
      className={`site-overview-module-card group grid min-h-[178px] content-between rounded-[14px] border border-[var(--admin-border-soft)] bg-[linear-gradient(180deg,#ffffff_0%,#fbfcfe_100%)] p-4 shadow-[0_16px_34px_-32px_rgba(15,23,42,0.26)] transition hover:-translate-y-[1px] hover:border-[#c7daf8] hover:shadow-[0_24px_42px_-32px_rgba(27,119,243,0.22)] ${className}`}
      href={href}
    >
      <span className="min-w-0">
        <span className="flex items-start justify-between gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] border border-[var(--admin-border-soft)] bg-[var(--admin-panel)] text-[#667085] transition group-hover:border-[#bfd5fb] group-hover:bg-[#eef4ff] group-hover:text-[#1b77f3]">
          <Icon className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <span className="inline-flex h-[24px] shrink-0 items-center rounded-[999px] border border-[#d7dee8] bg-white px-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[#667085]">
            {metric}
          </span>
        </span>
        <span className="mt-4 block text-[15px] font-semibold tracking-[-0.01em] text-[var(--admin-text)]">{title}</span>
        <span className="mt-2 line-clamp-3 block text-[12px] leading-5 text-[#667085]">{detail}</span>
      </span>
      <span className="mt-4 block border-t border-[var(--admin-border-soft)] pt-3 font-mono text-[11px] text-[#98a2b3]">
        {items ?? meta}
      </span>
    </Link>
  );
}

export async function getSiteAdminData(siteSlug: string) {
  const state = readPlatformState();
  const site = state.sites.find((item) => item.slug === siteSlug);
  if (!site) notFound();
  await cookies();
  const current = await getCurrentSiteAdmin(site.id);
  if (!current) redirect(`/site/${site.slug}/admin/login`);

  const rawCustomers = getSiteCustomersFromState(state, site.id);
  const customers = getPublicSiteCustomersFromState(state, site.id);
  const products = getSiteProductsFromState(state, site.id);
  const jobs = getSiteJobsFromState(state, site.id);
  const ledger = getSiteLedgerFromState(state, site.id);
  const apps = getSiteAppsFromState(state, site.id);
  const orders = getSiteOrdersFromState(state, site.id);
  const subscriptions = getSiteSubscriptionsFromState(state, site.id);
  const packs = getSiteCreativePacksFromState(state, site.id);
  const media = getSiteMediaAssetsFromState(state, site.id);
  const publications = getSiteThemePublicationsFromState(state, site.id);
  const customerModels = getSiteCustomerModelsFromState(state, site.id);
  const albums = getSiteAlbumsFromState(state, site.id);
  const auditLogs = getSiteAuditLogsFromState(state, site.id);
  const domains = getSiteDomainsFromState(state, site.id);
  const gateways = getSiteGatewayGroupsFromState(state, site.id);
  const gateway = gateways[0];
  const generatedAssets = state.assetUploads.filter((asset) => asset.siteId === site.id && asset.role === "output" && !asset.deletedAt);
  const inputAssets = state.assetUploads.filter((asset) => asset.siteId === site.id && asset.role === "input" && !asset.deletedAt);
  const healthScore = siteHealthScore({ site, customers: rawCustomers, jobs, gateway, publications });
  const revenue = siteRevenue(orders);
  const paidOrders = orders.filter((order) => order.status === "paid" || order.status === "fulfilled").length;
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trialing").length;
  const activeProducts = products.filter((product) => product.status === "active").length;
  const totalPrices = products.reduce((sum, product) => sum + product.prices.length, 0);
  const activePacks = packs.filter((pack) => pack.status === "active").length;
  const draftPacks = packs.filter((pack) => pack.status === "draft").length;
  const activeAiApps = apps.filter((app) => app.enabled).length;
  const readyAlbums = albums.filter((album) => album.status === "ready").length;
  const readyModels = customerModels.filter((model) => model.status === "ready").length;
  const failedJobs = jobCountByStatus(jobs, "failed") + jobCountByStatus(jobs, "refunded");
  const openJobs = jobCountByStatus(jobs, "running") + jobCountByStatus(jobs, "queued");
  const completedJobs = jobCountByStatus(jobs, "succeeded");
  const contentPageCount = site.pages.filter((page) => ["policy", "faq", "blog", "help", "content"].some((type) => page.pageType.includes(type))).length;
  const dirtyPages = site.pages.filter((page) => JSON.stringify(page.draftJson) !== JSON.stringify(page.publishedJson)).length;
  const latestPublication = publications.at(-1);
  const feed = latestActivity(auditLogs, jobs, orders, 8);
  const emailAssignment = state.siteEmailConfigAssignments?.find((assignment) => assignment.siteId === site.id);
  const emailConfig = state.platformEmailConfigs?.find((config) => config.id === emailAssignment?.configId);
  const emailReady = Boolean(emailConfig?.apiKey?.trim() && emailConfig.fromEmail?.trim());

  return {
    state: state as PlatformState,
    site,
    current,
    rawCustomers,
    customers,
    products,
    jobs,
    ledger,
    apps,
    orders,
    subscriptions,
    packs,
    media,
    publications,
    customerModels,
    albums,
    auditLogs,
    domains,
    gateways,
    gateway,
    generatedAssets,
    inputAssets,
    healthScore,
    revenue,
    paidOrders,
    activeSubscriptions,
    activeProducts,
    totalPrices,
    activePacks,
    draftPacks,
    activeAiApps,
    readyAlbums,
    readyModels,
    failedJobs,
    openJobs,
    completedJobs,
    contentPageCount,
    dirtyPages,
    latestPublication,
    feed,
    emailReady,
    availableCredits: siteAvailableCredits(rawCustomers),
    reservedCredits: siteReservedCredits(rawCustomers),
    statusTone,
    rate
  };
}

export const moduleIcons = {
  overview: BarChart3,
  products: ShoppingBag,
  orders: ReceiptText,
  customers: Users,
  ai: Bot,
  content: FileText,
  settings: Settings2,
  credits: Database,
  activity: Activity,
  albums: GalleryVerticalEnd,
  packs: Boxes,
  payments: CreditCard
};

export type SiteAdminData = NonNullable<Awaited<ReturnType<typeof getSiteAdminData>>>;
