import type {
  AiGatewayGroup,
  Album,
  AssetUpload,
  AuditLogEntry,
  CreativePack,
  CreditLedgerEntry,
  Customer,
  CustomerModel,
  GenerationJob,
  MediaAsset,
  Order,
  Product,
  Site,
  SiteAiApp,
  SiteDomain,
  Subscription,
  ThemePublication
} from "@/lib/types";

export function money(amountCents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    maximumFractionDigits: amountCents % 100 === 0 ? 0 : 2
  }).format(amountCents / 100);
}

export function percent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function siteRevenue(orders: Order[]): number {
  return orders
    .filter((order) => order.status === "paid" || order.status === "fulfilled")
    .reduce((sum, order) => sum + order.amountCents, 0);
}

export function siteReservedCredits(customers: Customer[]): number {
  return customers.reduce((sum, customer) => sum + customer.balance.reserved, 0);
}

export function siteAvailableCredits(customers: Customer[]): number {
  return customers.reduce((sum, customer) => sum + customer.balance.available, 0);
}

export function siteHealthScore({
  site,
  customers,
  jobs,
  gateway,
  publications
}: {
  site: Site;
  customers: Customer[];
  jobs: GenerationJob[];
  gateway?: AiGatewayGroup;
  publications: ThemePublication[];
}): number {
  const connect = site.connect.chargesEnabled ? 24 : 8;
  const customer = customers.length > 0 ? 18 : 6;
  const failedJobs = jobs.filter((job) => job.status === "failed" || job.status === "refunded").length;
  const jobScore = jobs.length === 0 ? 12 : Math.max(8, 24 - failedJobs * 4);
  const gatewayScore = gateway?.status === "active" ? 18 : 6;
  const themeScore = publications.length > 0 ? 16 : 8;
  return Math.min(100, connect + customer + jobScore + gatewayScore + themeScore);
}

export function latestActivity(
  auditLogs: AuditLogEntry[],
  jobs: GenerationJob[],
  orders: Order[],
  limit = 6
): Array<{ id: string; label: string; detail: string; at: string; tone: "good" | "warn" | "bad" | "neutral" }> {
  const audit = auditLogs.map((entry) => ({
    id: entry.id,
    label: entry.action.replace(/_/g, " "),
    detail: `${entry.targetType}:${entry.targetId}`,
    at: entry.createdAt,
    tone: "neutral" as const
  }));
  const jobEvents = jobs.map((job) => ({
    id: job.id,
    label: `job ${job.status}`,
    detail: job.aiAppId,
    at: job.updatedAt,
    tone: job.status === "succeeded" ? ("good" as const) : job.status === "failed" || job.status === "refunded" ? ("bad" as const) : ("warn" as const)
  }));
  const orderEvents = orders.map((order) => ({
    id: order.id,
    label: `order ${order.status}`,
    detail: money(order.amountCents, order.currency),
    at: order.createdAt,
    tone: order.status === "paid" || order.status === "fulfilled" ? ("good" as const) : order.status === "refunded" ? ("bad" as const) : ("warn" as const)
  }));
  return [...audit, ...jobEvents, ...orderEvents].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

export function siteDemoSnapshot({
  site,
  domains,
  admins,
  customers,
  products,
  subscriptions,
  orders,
  jobs,
  ledger,
  apps,
  gateway,
  packs,
  media,
  publications,
  assets,
  customerModels = [],
  albums = []
}: {
  site: Site;
  domains: SiteDomain[];
  admins: Array<{ email: string }>;
  customers: Customer[];
  products: Product[];
  subscriptions: Subscription[];
  orders: Order[];
  jobs: GenerationJob[];
  ledger: CreditLedgerEntry[];
  apps: SiteAiApp[];
  gateway?: AiGatewayGroup;
  packs: CreativePack[];
  media: MediaAsset[];
  publications: ThemePublication[];
  assets: AssetUpload[];
  customerModels?: CustomerModel[];
  albums?: Album[];
}) {
  const activeSubscriptions = subscriptions.filter((subscription) => subscription.status === "active" || subscription.status === "trialing").length;
  const failedJobs = jobs.filter((job) => job.status === "failed" || job.status === "refunded").length;
  const activePacks = packs.filter((pack) => pack.status === "active").length;
  return {
    site,
    ownerEmail: admins[0]?.email ?? "not assigned",
    domains,
    customerCount: customers.length,
    activeSubscriptions,
    revenueCents: siteRevenue(orders),
    availableCredits: siteAvailableCredits(customers),
    reservedCredits: siteReservedCredits(customers),
    productCount: products.length,
    jobCount: jobs.length,
    failedJobs,
    ledgerCount: ledger.length,
    appCount: apps.length,
    enabledAppCount: apps.filter((app) => app.enabled).length,
    gateway,
    activePacks,
    mediaCount: media.length,
    assetCount: assets.length,
    readyModelCount: customerModels.filter((model) => model.status === "ready").length,
    modelCount: customerModels.length,
    readyAlbumCount: albums.filter((album) => album.status === "ready").length,
    albumCount: albums.length,
    publicationCount: publications.length,
    healthScore: siteHealthScore({ site, customers, jobs, gateway, publications })
  };
}
