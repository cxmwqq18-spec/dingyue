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
import { type AdminPerfTracker, createAdminPerfTracker } from "@/lib/admin-perf";
import { siteAdminModuleLinks, type SiteAdminModuleCode } from "@/lib/admin-menu";
import {
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
  toPublicCustomer,
  readPlatformState
} from "@/lib/server-store";
import { getCurrentSiteAdmin } from "@/lib/api-auth";
import { latestActivity, siteAvailableCredits, siteHealthScore, siteReservedCredits, siteRevenue } from "@/lib/ops";
import { prisma } from "@/lib/prisma";
import { listSiteCustomersRelational } from "@/lib/stores/customer-store";
import {
  listSiteAlbumsRelational,
  listSiteCustomerAssetsRelational,
  listSiteCustomerModelsRelational
} from "@/lib/stores/asset-store";
import { getSiteEmailConfigStateRelational } from "@/lib/stores/platform-store";
import {
  getSiteAdminContextRelationalState,
  getSiteBySlugForAdmin,
  getSiteContentBySlugForAdmin,
  getSiteShellBySlugForAdmin,
  type SiteAdminContextRelationalDailyOps,
  type SiteAdminContextRelationalState,
  type SiteAdminContextRelationalSummary
} from "@/lib/stores/site-store";
import {
  mapCreditLedger,
  mapGenerationJob,
  mapPaymentEvent,
  toCreativePack,
} from "@/lib/stores/prisma-mappers";
import { shouldFallbackRelationalRead, warnRelationalFallback } from "@/lib/stores/relational-fallback";
import type {
  Album,
  AssetUpload,
  CreativePack,
  CreditLedgerEntry,
  Customer,
  CustomerModel,
  GenerationJob,
  Order,
  PaymentEvent,
  PlatformState,
  Site,
  SiteAdminSession,
  SiteAdmin,
  Subscription,
  AiApp,
  ThemePublication
} from "@/lib/types";

export type SiteAdminDataInclude =
  | "state"
  | "overview"
  | "customers"
  | "products"
  | "orders"
  | "subscriptions"
  | "ledger"
  | "paymentEvents"
  | "customerLookups"
  | "billing"
  | "ai"
  | "content"
  | "media"
  | "themePages"
  | "themeSettings"
  | "themes"
  | "settings"
  | "email";

type SiteAdminDataOptions = {
  include?: SiteAdminDataInclude[];
  summary?: boolean | "light" | "full";
  take?: number;
};

type SiteAdminDataPerfOptions = SiteAdminDataOptions & {
  perf?: AdminPerfTracker;
};

type SiteCustomerAdminCollections = {
  rawCustomers: Customer[];
  packs: CreativePack[];
  customerModels: CustomerModel[];
  albums: Album[];
  customerAssets: AssetUpload[];
};

type SiteOrdersAdminCollections = {
  orders: Order[];
  subscriptions: Subscription[];
  ledger: CreditLedgerEntry[];
  jobs: GenerationJob[];
  paymentEvents: PaymentEvent[];
};

type CustomerLookup = { id: string; email: string };

type SiteOrdersAdminCollectionInclude = {
  orders?: boolean;
  subscriptions?: boolean;
  ledger?: boolean;
  jobs?: boolean;
  paymentEvents?: boolean;
};

type SiteAdminOverviewData = SiteAdminData & {
  orders: Order[];
  jobs: GenerationJob[];
};

const adminListTake = Number(process.env.SITE_ADMIN_LIST_TAKE ?? 200);
const adminActivityTake = Number(process.env.SITE_ADMIN_ACTIVITY_TAKE ?? 80);
const adminCustomerAssetTake = Number(process.env.SITE_ADMIN_CUSTOMER_ASSET_TAKE ?? 80);
const platformAiAppsCacheTtlMs = Number(process.env.SITE_ADMIN_PLATFORM_AI_APPS_CACHE_TTL_MS ?? 30_000);
let platformAiAppsCache: { cachedAt: number; apps: AiApp[] } | undefined;
const siteAdminShellCacheTtlMs = Number(process.env.SITE_ADMIN_SHELL_CACHE_TTL_MS ?? 8_000);

function emptyPlatformState(overrides: Partial<PlatformState> = {}): PlatformState {
  return {
    platformAdmins: [],
    platformSessions: [],
    sites: [],
    siteDomains: [],
    siteAdmins: [],
    siteAdminSessions: [],
    customers: [],
    customerSessions: [],
    products: [],
    subscriptions: [],
    orders: [],
    paymentEvents: [],
    aiApps: [],
    siteAiApps: [],
    aiGatewayGroups: [],
    creativePacks: [],
    mediaAssets: [],
    themePublications: [],
    siteThemes: [],
    themeCopies: [],
    customerModels: [],
    albums: [],
    auditLogs: [],
    jobs: [],
    assetUploads: [],
    ledger: [],
    ...overrides
  };
}

function mapAiAppForAdmin(row: {
  id: string;
  slug: string;
  name: string;
  description: string;
  appType: string;
  parameterSchema: unknown;
}): AiApp {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    appType: row.appType as AiApp["appType"],
    parameterSchema: Array.isArray(row.parameterSchema) ? row.parameterSchema as AiApp["parameterSchema"] : []
  };
}

export type AdminModuleCode = SiteAdminModuleCode;
export { siteAdminModuleLinks };

function statusTone(status: string): "good" | "warn" | "bad" | "neutral" {
  if (status === "active" || status === "enabled" || status === "succeeded" || status === "fulfilled" || status === "paid" || status === "ready") return "good";
  if (status === "failed" || status === "refunded" || status === "blocked" || status === "canceled") return "bad";
  if (status === "pending" || status === "draft" || status === "past_due" || status === "running" || status === "queued" || status === "processing") return "warn";
  return "neutral";
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
    { label: "装修总览", href: modulePath(site, "/admin/design"), icon: Palette, group: "前台与主题", badge: String(site.pages.length) },
    { label: "页面管理", href: modulePath(site, "/admin/design/pages"), icon: FileText, group: "前台与主题", badge: String(site.pages.length) },
    { label: "导航菜单", href: modulePath(site, "/admin/design/navigation"), icon: GalleryVerticalEnd, group: "前台与主题", badge: String(site.themeSettings.draftJson.navigation.headerLinks.length + site.themeSettings.draftJson.navigation.footerLinks.length) },
    { label: "SEO 设置", href: modulePath(site, "/admin/design/seo"), icon: SearchCode, group: "前台与主题", badge: site.themeSettings.draftJson.seo?.siteTitle ? "meta" : "setup" },
    { label: "主题库", href: modulePath(site, "/admin/themes"), icon: Layers3, group: "前台与主题", badge: String(data.publicationCount) },
    { label: "素材库", href: modulePath(site, "/admin/media"), icon: ImageIcon, group: "前台与主题", badge: String(data.mediaCount) },
    { label: "发布历史", href: modulePath(site, "/admin/design/publications"), icon: FileClock, group: "前台与主题", badge: String(data.publicationCount) },
    { label: "商品与套餐", href: modulePath(site, "/admin/products"), icon: ShoppingBag, group: "交易与客户", badge: `${data.activeProducts}/${data.productCount}` },
    { label: "订单与订阅", href: modulePath(site, "/admin/orders"), icon: ReceiptText, group: "交易与客户", badge: String(data.orderCount) },
    { label: "顾客管理", href: modulePath(site, "/admin/customers"), icon: Users, group: "交易与客户", badge: String(data.customerCount) },
    { label: "AI 工具", href: modulePath(site, "/admin/ai-tools"), icon: Bot, group: "AI 订阅", badge: `${data.activeAiApps}/${data.appCount}` },
    { label: "内容运营", href: modulePath(site, "/admin/content"), icon: FileText, group: "运营内容", badge: String(data.contentPageCount) },
    { label: "邮件管理", href: modulePath(site, "/admin/email"), icon: MailCheck, group: "设置与安全", badge: data.emailReady ? "ready" : "setup" },
    { label: "站点设置", href: modulePath(site, "/admin/settings"), icon: Settings2, group: "设置与安全", badge: data.site.connect.chargesEnabled ? "ready" : "setup" }
  ];
}

export function siteAdminCommandActions(site: Site, data: SiteAdminData) {
  return [
    { label: "前台", href: modulePath(site, ""), icon: LayoutDashboard, badge: "在线", tone: "neutral" as const },
    { label: "装修", href: modulePath(site, "/admin/design"), icon: Palette, badge: String(site.pages.length), tone: data.publicationCount ? "good" as const : "warn" as const },
    { label: "商品", href: modulePath(site, "/admin/products"), icon: ShoppingBag, badge: String(data.productCount), tone: data.activeProducts ? "good" as const : "warn" as const },
    { label: "订单", href: modulePath(site, "/admin/orders"), icon: ReceiptText, badge: String(data.orderCount), tone: data.orderCount ? "good" as const : "neutral" as const },
    { label: "AI", href: modulePath(site, "/admin/ai-tools"), icon: Bot, badge: String(data.openJobs), tone: data.failedJobs ? "bad" as const : data.openJobs ? "warn" as const : "good" as const }
  ];
}

export function siteAdminQuickActions(site: Site, data: SiteAdminData) {
  return [
    { label: "打开装修器", href: modulePath(site, "/admin/design/workbench"), icon: Palette, detail: "页面树、区块树、全局页眉页脚、预览、保存和发布。", tone: data.publicationCount ? "good" as const : "warn" as const },
    { label: "商品套餐", href: modulePath(site, "/admin/products"), icon: ShoppingBag, detail: "订阅套餐、credit pack 和 DreamShoot 风格拍摄包。", tone: data.activeProducts ? "good" as const : "warn" as const },
    { label: "顾客会员", href: modulePath(site, "/admin/customers"), icon: Users, detail: "客户状态、余额、模型、私有相册和素材边界。", tone: data.customerCount ? "good" as const : "neutral" as const },
    { label: "AI 工具", href: modulePath(site, "/admin/ai-tools"), icon: Bot, detail: "工具启用、扣费、worker 路由、任务队列和重跑。", tone: data.activeAiApps ? "good" as const : "warn" as const }
  ];
}

export function siteAdminStats(data: SiteAdminData) {
  return [
    { label: "健康度", value: `${data.healthScore}%`, tone: data.healthScore >= 76 ? "good" as const : data.healthScore >= 50 ? "warn" as const : "bad" as const, href: modulePath(data.site, "/admin") },
    { label: "顾客", value: String(data.customerCount), tone: data.customerCount ? "good" as const : "neutral" as const, href: modulePath(data.site, "/admin/customers") },
    { label: "商品", value: `${data.activeProducts}/${data.productCount}`, tone: data.activeProducts ? "good" as const : "warn" as const, href: modulePath(data.site, "/admin/products") },
    { label: "订单", value: String(data.orderCount), tone: data.orderCount ? "good" as const : "neutral" as const, href: modulePath(data.site, "/admin/orders") },
    { label: "AI", value: `${data.activeAiApps}/${data.appCount}`, tone: data.activeAiApps ? "good" as const : "warn" as const, href: modulePath(data.site, "/admin/ai-tools") }
  ];
}

export function siteAdminWorkspace(data: SiteAdminData, label = "站点工作区") {
  return {
    label,
    name: data.site.name,
    meta: data.site.primaryDomain,
    statusLabel: data.site.connect.chargesEnabled && data.publicationCount ? "可上线" : "待配置",
    statusTone: data.site.connect.chargesEnabled && data.publicationCount ? "good" as const : "warn" as const
  };
}

function getSiteCustomerAdminCollectionsFromState(state: PlatformState, siteId: string): SiteCustomerAdminCollections {
  return {
    rawCustomers: getSiteCustomersFromState(state, siteId),
    packs: getSiteCreativePacksFromState(state, siteId),
    customerModels: getSiteCustomerModelsFromState(state, siteId),
    albums: getSiteAlbumsFromState(state, siteId),
    customerAssets: state.assetUploads.filter((asset) => asset.siteId === siteId && !asset.deletedAt)
  };
}

async function getSiteCustomerAdminCollections(
  state: PlatformState,
  siteId: string,
  options: { includeAssets?: boolean } = {}
): Promise<SiteCustomerAdminCollections> {
  const fallback = () => getSiteCustomerAdminCollectionsFromState(state, siteId);
  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    return fallback();
  }

  try {
    const [customersResult, packs, customerModelsResult, albumsResult, customerAssetsResult] = await Promise.all([
      listSiteCustomersRelational(siteId),
      prisma.creativePack.findMany({
        where: { siteId },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }]
      }),
      listSiteCustomerModelsRelational(siteId),
      listSiteAlbumsRelational(siteId),
      options.includeAssets
        ? listSiteCustomerAssetsRelational({ siteId, take: adminCustomerAssetTake })
        : Promise.resolve({ assets: [] })
    ]);
    return {
      rawCustomers: customersResult.customers,
      packs: packs.map(toCreativePack),
      customerModels: customerModelsResult.models,
      albums: albumsResult.albums,
      customerAssets: customerAssetsResult.assets
    };
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("site admin customer collections", error);
    return fallback();
  }
}

function mapOrderForAdmin(row: { id: string; siteId: string; customerId: string; status: string; amountCents: number; currency: string; credits: number; sourceId: string; createdAt: Date | string }): Order {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    status: row.status as Order["status"],
    amountCents: row.amountCents,
    currency: row.currency,
    credits: row.credits,
    sourceId: row.sourceId,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
  };
}

function mapSubscriptionForAdmin(row: {
  id: string;
  siteId: string;
  customerId: string;
  productId: string;
  priceId: string;
  stripeSubscriptionId: string;
  status: string;
  currentPeriodEnd: Date | string;
  creditsPerCycle: number;
  createdAt: Date | string;
}): Subscription {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    productId: row.productId,
    priceId: row.priceId,
    stripeSubscriptionId: row.stripeSubscriptionId,
    status: row.status as Subscription["status"],
    currentPeriodEnd: row.currentPeriodEnd instanceof Date ? row.currentPeriodEnd.toISOString() : String(row.currentPeriodEnd),
    creditsPerCycle: row.creditsPerCycle,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)
  };
}

function syntheticOverviewOrder(
  site: Site,
  id: string,
  status: Order["status"],
  amountCents: number,
  createdAt: string
): Order {
  return {
    id,
    siteId: site.id,
    customerId: "",
    status,
    amountCents,
    currency: site.currency,
    credits: 0,
    sourceId: id,
    createdAt
  };
}

function syntheticOverviewJob(site: Site, id: string, status: GenerationJob["status"], createdAt: string): GenerationJob {
  return {
    id,
    siteId: site.id,
    customerId: "",
    aiAppId: "",
    status,
    creditsReserved: 0,
    createdAt,
    updatedAt: createdAt,
    requestJson: {},
    resultJson: undefined
  };
}

function dailyBucketAt(bucket: SiteAdminContextRelationalDailyOps): string {
  const value = new Date(bucket.day);
  if (!Number.isFinite(value.getTime())) return new Date().toISOString();
  value.setHours(12, 0, 0, 0);
  return value.toISOString();
}

function buildOverviewOrdersFromSummary(site: Site, summary: SiteAdminContextRelationalSummary | undefined, take: number): Order[] {
  if (!summary) return [];
  const orders: Order[] = [];
  const pushOrder = (order: Order) => {
    if (orders.length < take) orders.push(order);
  };
  for (const bucket of summary.sevenDayOps) {
    const createdAt = dailyBucketAt(bucket);
    for (let index = 0; index < bucket.paidOrderCount; index += 1) {
      pushOrder(syntheticOverviewOrder(site, `summary_order_paid_${bucket.day}_${index}`, "paid", index === 0 ? bucket.revenueCents : 0, createdAt));
    }
    for (let index = 0; index < bucket.pendingOrderCount; index += 1) {
      pushOrder(syntheticOverviewOrder(site, `summary_order_pending_${bucket.day}_${index}`, "created", 0, createdAt));
    }
    const otherOrderCount = Math.max(bucket.orderCount - bucket.paidOrderCount - bucket.pendingOrderCount, 0);
    for (let index = 0; index < otherOrderCount; index += 1) {
      pushOrder(syntheticOverviewOrder(site, `summary_order_other_${bucket.day}_${index}`, "expired", 0, createdAt));
    }
  }
  const outsideSevenDayMonthRevenue = Math.max(summary.monthRevenueCents - orders.reduce((sum, order) => sum + order.amountCents, 0), 0);
  const outsideSevenDayPaidOrders = Math.max(
    summary.monthPaidOrderCount - summary.sevenDayOps.reduce((sum, bucket) => sum + bucket.paidOrderCount, 0),
    0
  );
  for (let index = 0; index < outsideSevenDayPaidOrders; index += 1) {
    pushOrder(syntheticOverviewOrder(site, `summary_order_month_remainder_${index}`, "paid", index === 0 ? outsideSevenDayMonthRevenue : 0, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()));
  }
  const sevenDayPending = summary.sevenDayOps.reduce((sum, bucket) => sum + bucket.pendingOrderCount, 0);
  const olderMonthPending = Math.max(summary.monthPendingOrderCount - sevenDayPending, 0);
  for (let index = 0; index < olderMonthPending; index += 1) {
    pushOrder(syntheticOverviewOrder(site, `summary_order_pending_remainder_${index}`, "created", 0, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()));
  }
  const sevenDayOtherOrders = summary.sevenDayOps.reduce(
    (sum, bucket) => sum + Math.max(bucket.orderCount - bucket.paidOrderCount - bucket.pendingOrderCount, 0),
    0
  );
  const olderMonthOtherOrders = Math.max(
    summary.monthOrderCount - summary.monthPaidOrderCount - summary.monthPendingOrderCount - sevenDayOtherOrders,
    0
  );
  for (let index = 0; index < olderMonthOtherOrders; index += 1) {
    pushOrder(syntheticOverviewOrder(site, `summary_order_other_remainder_${index}`, "expired", 0, new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()));
  }
  const stalePending = Math.max(summary.pendingOrderCount - summary.monthPendingOrderCount, 0);
  for (let index = 0; index < stalePending; index += 1) {
    pushOrder(syntheticOverviewOrder(site, `summary_order_stale_pending_${index}`, "created", 0, new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString()));
  }
  return orders;
}

function buildOverviewJobsFromSummary(site: Site, summary: SiteAdminContextRelationalSummary | undefined, take: number): GenerationJob[] {
  if (!summary) return [];
  const jobs: GenerationJob[] = [];
  const pushJob = (job: GenerationJob) => {
    if (jobs.length < take) jobs.push(job);
  };
  for (const bucket of summary.sevenDayOps) {
    for (let index = 0; index < bucket.jobCount; index += 1) {
      pushJob(syntheticOverviewJob(site, `summary_job_${bucket.day}_${index}`, "succeeded", dailyBucketAt(bucket)));
    }
  }
  const sevenDayJobs = summary.sevenDayOps.reduce((sum, bucket) => sum + bucket.jobCount, 0);
  const olderMonthJobs = Math.max(summary.monthJobCount - sevenDayJobs, 0);
  for (let index = 0; index < olderMonthJobs; index += 1) {
    pushJob(syntheticOverviewJob(site, `summary_job_month_remainder_${index}`, "succeeded", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()));
  }
  const lastDay = summary.sevenDayOps.at(-1);
  const todayInBuckets = lastDay?.jobCount ?? 0;
  const todayRemainder = Math.max(summary.todayJobCount - todayInBuckets, 0);
  for (let index = 0; index < todayRemainder; index += 1) {
    pushJob(syntheticOverviewJob(site, `summary_job_today_remainder_${index}`, "succeeded", new Date().toISOString()));
  }
  return jobs;
}

async function getSiteOrdersAdminCollections(
  state: PlatformState,
  siteId: string,
  take = adminListTake,
  options: SiteOrdersAdminCollectionInclude = {}
): Promise<SiteOrdersAdminCollections> {
  const includeOrders = options.orders ?? true;
  const includeSubscriptions = options.subscriptions ?? true;
  const includeLedger = options.ledger ?? true;
  const includeJobs = options.jobs ?? true;
  const includePaymentEvents = options.paymentEvents ?? true;
  const fallback = (): SiteOrdersAdminCollections => ({
    orders: includeOrders ? getSiteOrdersFromState(state, siteId).slice(0, take) : [],
    subscriptions: includeSubscriptions ? getSiteSubscriptionsFromState(state, siteId).slice(0, take) : [],
    ledger: includeLedger ? getSiteLedgerFromState(state, siteId).slice(0, take) : [],
    jobs: includeJobs ? getSiteJobsFromState(state, siteId).slice(0, take) : [],
    paymentEvents: includePaymentEvents ? state.paymentEvents.filter((event) => event.siteId === siteId).slice(0, take) : []
  });
  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    return fallback();
  }

  try {
    const [orders, subscriptions, ledger, jobs, paymentEvents] = await Promise.all([
      includeOrders
        ? prisma.order.findMany({
            where: { siteId },
            select: {
              id: true,
              siteId: true,
              customerId: true,
              status: true,
              amountCents: true,
              currency: true,
              credits: true,
              sourceId: true,
              createdAt: true
            },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take
          })
        : Promise.resolve([]),
      includeSubscriptions
        ? prisma.subscription.findMany({
            where: { siteId },
            select: {
              id: true,
              siteId: true,
              customerId: true,
              productId: true,
              priceId: true,
              stripeSubscriptionId: true,
              status: true,
              currentPeriodEnd: true,
              creditsPerCycle: true,
              createdAt: true
            },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take
          })
        : Promise.resolve([]),
      includeLedger
        ? prisma.creditLedger.findMany({
            where: { siteId },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take
          })
        : Promise.resolve([]),
      includeJobs
        ? prisma.generationJob.findMany({
            where: { siteId },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take
          })
        : Promise.resolve([]),
      includePaymentEvents
        ? prisma.paymentEvent.findMany({
            where: { siteId },
            orderBy: [{ processedAt: "desc" }, { id: "asc" }],
            take
          })
        : Promise.resolve([])
    ]);
    return {
      orders: orders.map(mapOrderForAdmin),
      subscriptions: subscriptions.map(mapSubscriptionForAdmin),
      ledger: ledger.map(mapCreditLedger),
      jobs: jobs.map(mapGenerationJob),
      paymentEvents: paymentEvents.map(mapPaymentEvent)
    };
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("site admin orders", error);
    return fallback();
  }
}

async function getSiteCustomersForAdminShell(state: PlatformState, siteId: string): Promise<Customer[]> {
  const fallback = () => getSiteCustomersFromState(state, siteId);
  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    return fallback();
  }

  try {
    const result = await listSiteCustomersRelational(siteId);
    return result.customers;
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("site admin customers", error);
    return fallback();
  }
}

async function getCustomerLookupsForAdmin(
  state: PlatformState,
  siteId: string,
  customerIds: Iterable<string>
): Promise<CustomerLookup[]> {
  const ids = Array.from(new Set([...customerIds].filter(Boolean)));
  if (!ids.length) return [];
  const fallback = () => {
    const wanted = new Set(ids);
    return getSiteCustomersFromState(state, siteId)
      .filter((customer) => wanted.has(customer.id))
      .map((customer) => ({ id: customer.id, email: customer.email }));
  };
  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    return fallback();
  }

  try {
    return await prisma.customer.findMany({
      where: { siteId, id: { in: ids } },
      select: { id: true, email: true }
    });
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("site admin customer lookups", error);
    return fallback();
  }
}

async function getSiteCreativePacksForAdmin(state: PlatformState, siteId: string): Promise<CreativePack[]> {
  const fallback = () => getSiteCreativePacksFromState(state, siteId);
  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    return fallback();
  }

  try {
    const packs = await prisma.creativePack.findMany({
      where: { siteId },
      include: { categoryRecord: { include: { parent: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }]
    });
    return packs.map(toCreativePack);
  } catch (error) {
    if (!shouldFallbackRelationalRead(error)) throw error;
    warnRelationalFallback("site admin creative packs", error);
    return fallback();
  }
}

async function getPlatformAiAppsForAdmin(): Promise<AiApp[]> {
  if (platformAiAppsCache && Date.now() - platformAiAppsCache.cachedAt < platformAiAppsCacheTtlMs) {
    return platformAiAppsCache.apps;
  }
  const apps = await prisma.aiApp.findMany({ orderBy: [{ appType: "asc" }, { name: "asc" }] });
  const mapped = apps.map(mapAiAppForAdmin);
  platformAiAppsCache = { cachedAt: Date.now(), apps: mapped };
  return mapped;
}

async function getSiteEmailStateForAdmin(siteId: string) {
  return getSiteEmailConfigStateRelational(siteId);
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

async function computeSiteAdminDataRaw(siteSlug: string, options: SiteAdminDataPerfOptions = {}) {
  const perf = options.perf;
  const measure = <T,>(name: string, work: () => Promise<T>, detail?: Record<string, string | number | boolean | undefined>) =>
    perf ? perf.measure(name, work, detail) : work();
  const measureSync = <T,>(name: string, work: () => T, detail?: Record<string, string | number | boolean | undefined>) =>
    perf ? perf.measureSync(name, work, detail) : work();
  const include = new Set<SiteAdminDataInclude>(options.include ?? [
    "state",
    "customers",
    "products",
    "orders",
    "billing",
    "ai",
    "content",
    "media",
    "themes",
    "settings",
    "email"
  ]);
  const wants = (...keys: SiteAdminDataInclude[]) => keys.some((key) => include.has(key));
  const usePostgres = process.env.PERSISTENCE_BACKEND === "postgres";
  const useLiveAdminReads = process.env.SITE_ADMIN_LIVE_READS === "1" || usePostgres;
  const shouldLoadSummary = options.summary ?? true;
  const summaryMode = shouldLoadSummary === true ? (include.has("overview") ? "full" : "light") : shouldLoadSummary;
  const overviewRequest = include.has("overview") || (include.size === 2 && include.has("orders") && include.has("ai"));
  const overviewOnly = overviewRequest;
  const listTake = options.take ?? adminListTake;
  const legacyState = usePostgres ? undefined : measureSync("context", () => readPlatformState(), { source: "state" });
  const needsFullSitePages = wants("themes", "themePages");
  const needsContentSitePages = !needsFullSitePages && wants("content");
  const sitePromise = usePostgres
    ? needsFullSitePages
      ? getSiteBySlugForAdmin(siteSlug)
      : needsContentSitePages
      ? getSiteContentBySlugForAdmin(siteSlug)
      : getSiteShellBySlugForAdmin(siteSlug)
    : Promise.resolve(legacyState?.sites.find((item) => item.slug === siteSlug));
  const site = await measure("context", () => sitePromise, { source: usePostgres ? "postgres" : "state" });
  if (!site) notFound();

  const current = await measure("auth", () => getCurrentSiteAdmin(site.id));
  if (!current) redirect(`/site/${site.slug}/admin/login`);

  const needsFullCustomerCollections = wants("customers");
  const needsCustomerAssets = include.has("state") || needsFullCustomerCollections;
  const needsCustomerRows = wants("customers");
  const shouldLoadOrderRows = !overviewOnly && wants("orders", "subscriptions", "ledger", "paymentEvents", "billing");
  const shouldLoadOrderScopedJobs = !overviewOnly && wants("ledger", "billing") && !wants("ai", "settings", "overview");
  const shouldLoadJobRows = !overviewOnly && wants("ai");
  const shouldLoadLightJobs = !overviewOnly && wants("orders") && wants("ai") && !wants("settings");
  const relationalStatePromise: Promise<SiteAdminContextRelationalState> = useLiveAdminReads && usePostgres
    ? getSiteAdminContextRelationalState(site.id, {
        products: wants("products", "themes", "themePages"),
        jobs: shouldLoadJobRows,
        lightJobs: shouldLoadLightJobs,
        apps: !overviewOnly && wants("ai", "products", "themes", "themePages"),
        media: wants("media", "themes", "themePages"),
        publications: wants("themes"),
        auditLogs: wants("settings"),
        domains: wants("settings"),
        gateways: !overviewOnly && wants("ai", "settings"),
        siteAdmins: wants("customers", "settings"),
        summary: summaryMode,
        take: {
          jobs: Math.min(listTake, adminActivityTake),
          media: listTake,
          publications: Math.min(listTake, adminActivityTake),
          auditLogs: Math.min(listTake, adminActivityTake)
        }
      }).catch((error) => {
        if (!shouldFallbackRelationalRead(error)) throw error;
        warnRelationalFallback("site admin context", error);
        throw error;
      })
    : Promise.resolve({});
  const customerAdminCollectionsPromise = useLiveAdminReads && needsFullCustomerCollections
    ? getSiteCustomerAdminCollections(legacyState ?? emptyPlatformState(), site.id, { includeAssets: needsCustomerAssets })
    : legacyState
    ? Promise.resolve(getSiteCustomerAdminCollectionsFromState(legacyState, site.id))
    : Promise.resolve({ rawCustomers: [], packs: [], customerModels: [], albums: [], customerAssets: [] });
  const ordersAdminCollectionsPromise = useLiveAdminReads && shouldLoadOrderRows
    ? getSiteOrdersAdminCollections(legacyState ?? emptyPlatformState(), site.id, listTake, {
        orders: wants("orders", "billing") || wants("ledger"),
        subscriptions: wants("subscriptions", "billing"),
        ledger: wants("ledger", "billing"),
        jobs: shouldLoadOrderScopedJobs,
        paymentEvents: wants("paymentEvents", "billing")
      })
    : Promise.resolve(undefined);
  const [relationalState, customerAdminCollections, ordersAdminCollections] = await measure("db", () => Promise.all([
    relationalStatePromise,
    customerAdminCollectionsPromise,
    ordersAdminCollectionsPromise
  ]), { phase: "primary" });
  const summary = relationalState.summary;
  const rawCustomers = needsFullCustomerCollections
    ? customerAdminCollections.rawCustomers
    : useLiveAdminReads && needsCustomerRows
    ? await getSiteCustomersForAdminShell(legacyState ?? emptyPlatformState(), site.id)
    : legacyState
    ? getSiteCustomersFromState(legacyState, site.id)
    : [];
  const customers = wants("customers", "billing", "ai") ? rawCustomers.map(toPublicCustomer) : [];
  const products = wants("products", "themes", "themePages") ? relationalState.products ?? (legacyState ? getSiteProductsFromState(legacyState, site.id) : []) : [];
  const shellProducts = products;
  const overviewJobs = overviewOnly && usePostgres ? buildOverviewJobsFromSummary(site, summary, listTake) : [];
  const jobs = ordersAdminCollections?.jobs ?? (overviewJobs.length ? overviewJobs : wants("ai", "orders", "billing", "settings", "overview") ? relationalState.jobs ?? (legacyState ? getSiteJobsFromState(legacyState, site.id) : []) : []);
  const shellJobs = jobs;
  const ledger = ordersAdminCollections?.ledger ?? (wants("billing", "ledger") ? (legacyState ? getSiteLedgerFromState(legacyState, site.id) : []) : []);
  const apps = wants("ai", "products", "themes", "themePages") ? relationalState.apps ?? (legacyState ? getSiteAppsFromState(legacyState, site.id) : []) : [];
  const shellApps = apps;
  const overviewOrders = overviewOnly && usePostgres ? buildOverviewOrdersFromSummary(site, summary, listTake) : [];
  const orders = ordersAdminCollections?.orders ?? (overviewOrders.length ? overviewOrders : shouldLoadOrderRows ? (legacyState ? getSiteOrdersFromState(legacyState, site.id) : []) : []);
  const shellOrders = orders;
  const subscriptions = ordersAdminCollections?.subscriptions ?? (wants("subscriptions", "billing") ? (legacyState ? getSiteSubscriptionsFromState(legacyState, site.id) : []) : []);
  const paymentEvents = ordersAdminCollections?.paymentEvents ?? (wants("paymentEvents", "billing") && legacyState ? legacyState.paymentEvents.filter((event) => event.siteId === site.id) : []);
  const customerLookups = wants("customerLookups")
    ? await measure(
        "db",
        () =>
          getCustomerLookupsForAdmin(legacyState ?? emptyPlatformState(), site.id, [
            ...orders.map((order) => order.customerId),
            ...subscriptions.map((subscription) => subscription.customerId),
            ...ledger.map((entry) => entry.customerId)
          ]),
        { phase: "customerLookups" }
      )
    : customers.map((customer) => ({ id: customer.id, email: customer.email }));
  const packs = needsFullCustomerCollections
    ? customerAdminCollections.packs
    : useLiveAdminReads && wants("products", "themePages")
    ? await measure("db", () => getSiteCreativePacksForAdmin(legacyState ?? emptyPlatformState(), site.id), { phase: "creativePacks" })
    : wants("products", "themePages") && legacyState
    ? getSiteCreativePacksFromState(legacyState, site.id)
    : [];
  const media = wants("media", "themes", "themePages") ? relationalState.media ?? (legacyState ? getSiteMediaAssetsFromState(legacyState, site.id) : []) : [];
  const publications = wants("themes") ? relationalState.publications ?? (legacyState ? getSiteThemePublicationsFromState(legacyState, site.id) : []) : [];
  const shellPublications = publications;
  const customerModels = wants("customers") ? customerAdminCollections.customerModels : [];
  const albums = wants("customers") ? customerAdminCollections.albums : [];
  const auditLogs = wants("settings") ? relationalState.auditLogs ?? (legacyState ? getSiteAuditLogsFromState(legacyState, site.id) : []) : [];
  const domains = wants("settings") ? relationalState.domains ?? (legacyState ? getSiteDomainsFromState(legacyState, site.id) : []) : [];
  const gateways = wants("ai", "settings") ? relationalState.gateways ?? (legacyState ? getSiteGatewayGroupsFromState(legacyState, site.id) : []) : [];
  const shellGateways = gateways;
  const gateway = gateways[0] ?? shellGateways[0] ?? summary?.gateway;

  const generatedAssets: AssetUpload[] = [];
  const inputAssets: AssetUpload[] = [];
  const customerAssets: AssetUpload[] = [];
  if (wants("customers")) {
    for (const asset of customerAdminCollections.customerAssets) {
      customerAssets.push(asset);
      if (asset.role === "output") generatedAssets.push(asset);
      if (asset.role === "input") inputAssets.push(asset);
    }
  }

  let failedJobs = summary?.failedJobCount ?? 0;
  let openJobs = summary?.openJobCount ?? 0;
  let completedJobs = summary?.completedJobCount ?? 0;
  if (!summary) {
    for (const job of shellJobs) {
      if (job.status === "failed" || job.status === "refunded") failedJobs += 1;
      if (job.status === "running" || job.status === "queued") openJobs += 1;
      if (job.status === "succeeded") completedJobs += 1;
    }
  }

  const productCount = summary?.productCount ?? shellProducts.length;
  const orderCount = summary?.orderCount ?? shellOrders.length;
  const subscriptionCount = summary?.subscriptionCount ?? subscriptions.length;
  const ledgerCount = summary?.ledgerCount ?? ledger.length;
  const paymentEventCount = summary?.paymentEventCount ?? paymentEvents.length;
  const customerCount = summary?.customerCount ?? rawCustomers.length;
  const appCount = summary?.appCount ?? shellApps.length;
  const publicationCount = summary?.publicationCount ?? shellPublications.length;
  const mediaCount = summary?.mediaCount ?? (wants("media", "content", "themes") ? media.length : 0);
  const healthCustomers = summary && !rawCustomers.length && summary.customerCount > 0
    ? [{ balance: { available: summary.availableCredits, reserved: summary.reservedCredits } } as Customer]
    : rawCustomers;
  const healthJobs = summary && !shellJobs.length && summary.jobCount > 0
    ? [
        {
          id: "summary_job_health",
          siteId: site.id,
          customerId: "",
          aiAppId: "",
          status: summary.failedJobCount > 0 ? "failed" : "succeeded",
          creditsReserved: 0,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
          requestJson: {},
          resultJson: undefined
        } as GenerationJob
      ]
    : shellJobs;
  const healthPublications = summary && !shellPublications.length && summary.publicationCount > 0
    ? [{
        id: "summary_publication",
        siteId: site.id,
        version: 0,
        snapshot: { pages: [], themeSettings: site.themeSettings.publishedJson },
        publishedBy: "",
        publishedAt: new Date(0).toISOString()
      } as ThemePublication]
    : shellPublications;
  const healthScore = siteHealthScore({ site, customers: healthCustomers, jobs: healthJobs, gateway, publications: healthPublications });
  const revenue = siteRevenue(orders);
  const paidOrders = summary?.paidOrderCount ?? orders.filter((order) => order.status === "paid" || order.status === "fulfilled").length;
  const activeSubscriptions = summary?.activeSubscriptionCount ?? subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trialing").length;
  const activeProducts = summary?.activeProductCount ?? shellProducts.filter((product) => product.status === "active").length;
  const totalPrices = summary?.totalPriceCount ?? shellProducts.reduce((sum, product) => sum + product.prices.length, 0);
  const activePacks = summary?.activePackCount ?? packs.filter((pack) => pack.status === "active").length;
  const draftPacks = summary?.draftPackCount ?? packs.filter((pack) => pack.status === "draft").length;
  const activeAiApps = summary?.activeAppCount ?? shellApps.filter((app) => app.enabled).length;
  const readyAlbums = summary?.readyAlbumCount ?? albums.filter((album) => album.status === "ready").length;
  const readyModels = summary?.readyModelCount ?? customerModels.filter((model) => model.status === "ready").length;
  const albumCount = summary?.albumCount ?? albums.length;
  const inputAssetCount = summary?.inputAssetCount ?? inputAssets.length;
  const generatedAssetCount = summary?.generatedAssetCount ?? generatedAssets.length;
  const contentPageCount = site.pages.filter((page) => ["policy", "faq", "blog", "help", "content"].some((type) => page.pageType.includes(type))).length;
  const dirtyPages = summary?.dirtyPageCount ?? (wants("themes") ? site.pages.filter((page) => JSON.stringify(page.draftJson) !== JSON.stringify(page.publishedJson)).length : 0);
  const latestPublication = shellPublications.at(-1);
  const feed = wants("settings") ? latestActivity(auditLogs, jobs, orders, 8) : [];
  const emailState = wants("email") && usePostgres
    ? await measure("db", () => getSiteEmailStateForAdmin(site.id), { phase: "email" })
    : wants("email") && legacyState
    ? {
        platformEmailSettings: legacyState.platformEmailSettings,
        platformEmailConfigs: legacyState.platformEmailConfigs,
        siteEmailConfigAssignments: legacyState.siteEmailConfigAssignments
      }
    : undefined;
  const emailAssignment = emailState?.siteEmailConfigAssignments?.find((assignment) => assignment.siteId === site.id);
  const emailConfig = emailState?.platformEmailConfigs?.find((config) => config.id === emailAssignment?.configId);
  const emailReady = Boolean(emailConfig?.apiKey?.trim() && emailConfig.fromEmail?.trim());
  const siteAdmins = wants("customers", "settings")
    ? relationalState.siteAdmins ?? (legacyState ? legacyState.siteAdmins.filter((admin) => admin.siteId === site.id) : [])
    : [];
  const platformAiApps = !overviewOnly && wants("ai") && usePostgres
    ? await measure("db", () => getPlatformAiAppsForAdmin(), { phase: "platformAiApps" })
    : wants("ai") && legacyState
    ? legacyState.aiApps
    : [];
  const scopedState = emptyPlatformState({
    aiApps: platformAiApps,
    assetUploads: customerAssets,
    paymentEvents,
    siteAdmins,
    platformEmailSettings: emailState?.platformEmailSettings,
    platformEmailConfigs: emailState?.platformEmailConfigs,
    siteEmailConfigAssignments: emailState?.siteEmailConfigAssignments
  });

  const result = measureSync("transform", () => ({
    state: include.has("state") && legacyState ? (legacyState as PlatformState) : scopedState,
    site,
    current,
    rawCustomers,
    customers,
    customerLookups,
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
    customerAssets,
    paymentEvents,
    siteAdmins,
    platformAiApps,
    emailState,
    healthScore,
    revenue: summary?.revenueCents ?? revenue,
    paidOrders: summary?.paidOrderCount ?? paidOrders,
    activeSubscriptions: summary?.activeSubscriptionCount ?? activeSubscriptions,
    activeProducts,
    totalPrices,
    activePacks,
    draftPacks,
    activeAiApps,
    readyAlbums,
    readyModels,
    albumCount,
    inputAssetCount,
    generatedAssetCount,
    failedJobs,
    openJobs,
    completedJobs,
    contentPageCount,
    dirtyPages,
    latestPublication,
    feed,
    emailReady,
    productCount,
    orderCount,
    subscriptionCount,
    ledgerCount,
    paymentEventCount,
    customerCount,
    appCount,
    publicationCount,
    mediaCount,
    availableCredits: summary?.availableCredits ?? siteAvailableCredits(rawCustomers),
    reservedCredits: summary?.reservedCredits ?? siteReservedCredits(rawCustomers),
    statusTone,
    rate
  }));

  return result;
}

export async function getSiteAdminData(siteSlug: string, options: SiteAdminDataOptions = {}) {
  const perf = createAdminPerfTracker("getSiteAdminData", {
    siteSlug,
    include: [...(options.include ?? [])].sort().join(",") || "default",
    summary: typeof options.summary === "string" ? options.summary : options.summary === false ? "false" : "true",
    take: options.take
  });
  const includeKey = [...(options.include ?? [])].sort().join(",");
  const canUseShellCache = process.env.PERSISTENCE_BACKEND === "postgres"
    && options.summary === false
    && options.take === 0
    && includeKey === "";

  try {
    if (!canUseShellCache) {
      const data = await computeSiteAdminDataRaw(siteSlug, { ...options, perf });
      perf.finish({ cache: false });
      return data;
    }

    const cookieStore = await perf.measure("auth_context", () => cookies());
    const sessionSignature = cookieStore
      .getAll()
      .filter((cookie) => cookie.name.startsWith("site_admin_session_"))
      .map((cookie) => `${cookie.name}:${cookie.value}`)
      .sort()
      .join("|") || "anonymous";
    const cacheKey = `${siteSlug}:${sessionSignature}:shell`;
    const cached = siteAdminShellCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < siteAdminShellCacheTtlMs) {
      perf.mark("cache", 0, { hit: true });
      perf.finish({ cache: true });
      return cached.data;
    }

    perf.mark("cache", 0, { hit: false });
    const data = await computeSiteAdminDataRaw(siteSlug, { ...options, perf });
    siteAdminShellCache.set(cacheKey, { cachedAt: Date.now(), data });
    perf.finish({ cache: false });
    return data;
  } catch (error) {
    perf.finish({ error: error instanceof Error ? error.message : "unknown" });
    throw error;
  }
}

function assertSiteAdminOverviewData(data: SiteAdminData): asserts data is SiteAdminOverviewData {
  if (!Array.isArray(data.orders) || !Array.isArray(data.jobs)) {
    throw new Error("site_admin_overview_contract_failed");
  }
}

export async function getSiteAdminOverviewData(siteSlug: string, take = 60): Promise<SiteAdminOverviewData> {
  const data = await getSiteAdminData(siteSlug, { include: ["overview"], take });
  assertSiteAdminOverviewData(data);
  return data;
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

export type SiteAdminData = NonNullable<Awaited<ReturnType<typeof computeSiteAdminDataRaw>>>;

const siteAdminShellCache = new Map<string, { cachedAt: number; data: SiteAdminData }>();
