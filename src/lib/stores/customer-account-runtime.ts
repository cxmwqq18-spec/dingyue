import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { toAssetUploadRelational, toCustomerModelRelational, toPublicCustomerRelational } from "@/lib/stores/prisma-mappers";
import { toThemeRuntimeAssetRelational } from "@/lib/stores/asset-store";
import type { PublicCustomer, ThemeRuntimeData } from "@/lib/types";

export type CustomerAccountRuntimeSection =
  | "summary"
  | "overview"
  | "profile"
  | "security"
  | "subscription"
  | "plan"
  | "credits"
  | "purchases"
  | "orders"
  | "generation"
  | "jobs"
  | "downloads"
  | "albums"
  | "models";

type RuntimeSubscription = NonNullable<ThemeRuntimeData["subscriptions"]>[number];
type RuntimeOrder = NonNullable<ThemeRuntimeData["orders"]>[number];
type RuntimeJob = ThemeRuntimeData["jobs"][number];
type RuntimeAlbum = ThemeRuntimeData["albums"][number];
type RuntimeLedgerEntry = ThemeRuntimeData["ledger"][number];
type RuntimeCustomerModel = NonNullable<ThemeRuntimeData["customerModels"]>[number];
type RuntimeDownload = NonNullable<ThemeRuntimeData["downloads"]>[number];

const missingOptionalTableWarnings = new Set<string>();

function isMissingOptionalAccountTableError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2021") return false;
  const meta = error.meta && typeof error.meta === "object" ? error.meta as { table?: unknown } : undefined;
  const table = typeof meta?.table === "string" ? meta.table : "";
  return table.includes("CustomerProfile") || table.includes("CustomerAssetDownload") ||
    error.message.includes("CustomerProfile") || error.message.includes("CustomerAssetDownload");
}

function warnMissingOptionalTable(scope: string, error: unknown): void {
  if (missingOptionalTableWarnings.has(scope)) return;
  missingOptionalTableWarnings.add(scope);
  const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
  console.warn(`[customer-account-runtime] ${scope} fell back because an optional account table is missing: ${message}`);
}

function emptyRuntime(): ThemeRuntimeData {
  return {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    downloads: [],
    customerModels: []
  };
}

function iso(value: Date | string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  return value instanceof Date ? value.toISOString() : value;
}

function jsonRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function sourceLabel(entry: Pick<RuntimeLedgerEntry, "sourceType" | "sourceId">): string {
  if (entry.sourceType === "order") return "Checkout order";
  if (entry.sourceType === "subscription") return "Subscription renewal";
  if (entry.sourceType === "generation_job") return "AI generation";
  if (entry.sourceType === "signup_credit") return "Signup credit";
  if (entry.sourceType === "admin_adjustment") return "Support adjustment";
  return entry.sourceId || "Account activity";
}

function mapRuntimeJob(job: {
  id: string;
  aiAppId: string;
  status: string;
  creditsReserved: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  requestJson?: unknown;
  resultJson?: unknown;
}): RuntimeJob {
  return {
    id: job.id,
    aiAppId: job.aiAppId,
    status: job.status as RuntimeJob["status"],
    creditsReserved: job.creditsReserved,
    createdAt: iso(job.createdAt),
    updatedAt: iso(job.updatedAt),
    requestJson: jsonRecord(job.requestJson),
    resultJson: jsonRecord(job.resultJson)
  };
}

function mapRuntimeSubscription(subscription: {
  id: string;
  productId: string;
  priceId: string;
  status: string;
  currentPeriodStart?: Date | string | null;
  currentPeriodEnd: Date | string;
  creditsPerCycle: number;
  createdAt: Date | string;
  product?: { name?: string | null } | null;
  price?: { label?: string | null; interval?: string | null; amountCents?: number | null; currency?: string | null } | null;
}): RuntimeSubscription {
  return {
    id: subscription.id,
    productId: subscription.productId,
    priceId: subscription.priceId,
    productName: subscription.product?.name ?? undefined,
    priceLabel: subscription.price?.label ?? undefined,
    interval: subscription.price?.interval as RuntimeSubscription["interval"],
    amountCents: subscription.price?.amountCents ?? undefined,
    currency: subscription.price?.currency ?? undefined,
    status: subscription.status as RuntimeSubscription["status"],
    currentPeriodStart: subscription.currentPeriodStart ? iso(subscription.currentPeriodStart) : undefined,
    currentPeriodEnd: iso(subscription.currentPeriodEnd),
    creditsPerCycle: subscription.creditsPerCycle,
    createdAt: iso(subscription.createdAt)
  };
}

function mapRuntimeOrder(order: {
  id: string;
  status: string;
  amountCents: number;
  currency: string;
  credits: number;
  sourceId: string;
  createdAt: Date | string;
}): RuntimeOrder {
  return {
    id: order.id,
    status: order.status as RuntimeOrder["status"],
    amountCents: order.amountCents,
    currency: order.currency,
    credits: order.credits,
    sourceId: order.sourceId,
    createdAt: iso(order.createdAt)
  };
}

function mapRuntimeAlbum(album: {
  id: string;
  title: string;
  sourceJobId?: string | null;
  creativePackId?: string | null;
  status: string;
  outputCount: number;
  coverAssetId?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): RuntimeAlbum {
  return {
    id: album.id,
    title: album.title,
    sourceJobId: album.sourceJobId ?? undefined,
    creativePackId: album.creativePackId ?? undefined,
    status: album.status as RuntimeAlbum["status"],
    outputCount: album.outputCount,
    coverAssetId: album.coverAssetId ?? undefined,
    createdAt: iso(album.createdAt),
    updatedAt: iso(album.updatedAt)
  };
}

function mapRuntimeLedger(entry: {
  id: string;
  amount: number;
  type: string;
  sourceType: string;
  sourceId: string;
  createdAt: Date | string;
}): RuntimeLedgerEntry {
  const runtimeEntry = {
    id: entry.id,
    amount: entry.amount,
    type: entry.type as RuntimeLedgerEntry["type"],
    sourceType: entry.sourceType,
    sourceId: entry.sourceId,
    createdAt: iso(entry.createdAt)
  };
  return {
    ...runtimeEntry,
    sourceLabel: sourceLabel(runtimeEntry)
  };
}

function mapRuntimeCustomerModel(model: Record<string, unknown>): RuntimeCustomerModel {
  const mapped = toCustomerModelRelational(model);
  return {
    id: mapped.id,
    label: mapped.label,
    modelType: mapped.modelType,
    status: mapped.status,
    inputAssetCount: mapped.inputAssetCount,
    minInputAssets: mapped.minInputAssets,
    createdAt: mapped.createdAt,
    updatedAt: mapped.updatedAt
  };
}

function mapRuntimeDownload(download: {
  id: string;
  assetId: string;
  jobId?: string | null;
  albumId?: string | null;
  source: string;
  createdAt: Date | string;
  asset?: Record<string, unknown> | null;
}): RuntimeDownload {
  const asset = download.asset ? toThemeRuntimeAssetRelational(toAssetUploadRelational(download.asset)) : undefined;
  return {
    id: download.id,
    assetId: download.assetId,
    jobId: download.jobId ?? asset?.jobId,
    albumId: download.albumId ?? undefined,
    source: download.source,
    label: asset?.label ?? "Downloaded asset",
    previewUrl: asset?.previewUrl,
    downloadUrl: asset?.downloadUrl,
    mimeType: asset?.mimeType,
    createdAt: iso(download.createdAt)
  };
}

async function readCustomerRecordWithOptionalProfile(customer: PublicCustomer, siteId: string) {
  try {
    return await prisma.customer.findFirst({
      where: { id: customer.id, siteId },
      include: { balance: true, profile: { include: { avatarAsset: true } } }
    });
  } catch (error) {
    if (!isMissingOptionalAccountTableError(error)) throw error;
    warnMissingOptionalTable("customer profile lookup", error);
    return prisma.customer.findFirst({
      where: { id: customer.id, siteId },
      include: { balance: true }
    });
  }
}

async function readCustomerDownloadsWithOptionalTable(customer: PublicCustomer, siteId: string) {
  try {
    return await prisma.customerAssetDownload.findMany({
      where: { siteId, customerId: customer.id },
      include: { asset: true },
      orderBy: { createdAt: "desc" },
      take: 24
    });
  } catch (error) {
    if (!isMissingOptionalAccountTableError(error)) throw error;
    warnMissingOptionalTable("customer downloads lookup", error);
    return [];
  }
}

function sectionRuntime(runtime: ThemeRuntimeData, section: CustomerAccountRuntimeSection): ThemeRuntimeData {
  const base = emptyRuntime();
  if (section === "profile" || section === "security") {
    return {
      ...base,
      customer: runtime.customer,
      profile: runtime.profile,
      assets: runtime.assets.filter((asset) => asset.subjectRole === "profile_avatar")
    };
  }
  if (section === "subscription" || section === "plan") {
    return {
      ...base,
      customer: runtime.customer,
      subscriptions: runtime.subscriptions ?? [],
      orders: (runtime.orders ?? []).slice(0, 4)
    };
  }
  if (section === "credits") {
    return {
      ...base,
      customer: runtime.customer,
      ledger: runtime.ledger ?? []
    };
  }
  if (section === "purchases" || section === "orders") {
    return {
      ...base,
      orders: runtime.orders ?? [],
      ledger: (runtime.ledger ?? []).filter((entry) => entry.amount > 0)
    };
  }
  if (section === "generation" || section === "jobs") {
    return {
      ...base,
      jobs: runtime.jobs ?? [],
      albums: runtime.albums ?? []
    };
  }
  if (section === "downloads") {
    return {
      ...base,
      downloads: runtime.downloads ?? [],
      assets: runtime.assets ?? []
    };
  }
  if (section === "albums") {
    return {
      ...base,
      albums: runtime.albums ?? [],
      assets: runtime.assets ?? []
    };
  }
  if (section === "models") {
    return {
      ...base,
      customerModels: runtime.customerModels ?? [],
      assets: runtime.assets ?? []
    };
  }
  return runtime;
}

export function selectCustomerAccountRuntimeSection(runtime: ThemeRuntimeData, section: CustomerAccountRuntimeSection): ThemeRuntimeData {
  return sectionRuntime(runtime, section);
}

export async function getCustomerAccountSummaryRuntimeRelational({
  customer,
  siteId
}: {
  customer: PublicCustomer;
  siteId: string;
}): Promise<ThemeRuntimeData> {
  const [
    customerRecord,
    subscriptions,
    orders,
    jobs,
    albums,
    ledger,
    assets,
    downloads,
    customerModels
  ] = await Promise.all([
    readCustomerRecordWithOptionalProfile(customer, siteId),
    prisma.subscription.findMany({
      where: { siteId, customerId: customer.id },
      include: { product: true, price: true },
      orderBy: { createdAt: "desc" },
      take: 6
    }),
    prisma.order.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 16
    }),
    prisma.generationJob.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      take: 16
    }),
    prisma.album.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      take: 16
    }),
    prisma.creditLedger.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 24
    }),
    prisma.assetUpload.findMany({
      where: {
        siteId,
        customerId: customer.id,
        deletedAt: null,
        OR: [
          { subjectRole: "profile_avatar" },
          { role: "output" }
        ]
      },
      orderBy: { createdAt: "desc" },
      take: 48
    }),
    readCustomerDownloadsWithOptionalTable(customer, siteId),
    prisma.customerModel.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      take: 12
    })
  ]);

  const resolvedCustomer = customerRecord
    ? toPublicCustomerRelational(customerRecord as unknown as Record<string, unknown>)
    : customer;
  return {
    ...emptyRuntime(),
    customer: resolvedCustomer,
    profile: resolvedCustomer.profile,
    jobs: jobs.map(mapRuntimeJob),
    assets: assets.map((asset) => toThemeRuntimeAssetRelational(toAssetUploadRelational(asset as unknown as Record<string, unknown>))),
    albums: albums.map(mapRuntimeAlbum),
    ledger: ledger.map(mapRuntimeLedger),
    subscriptions: subscriptions.map(mapRuntimeSubscription),
    orders: orders.map(mapRuntimeOrder),
    downloads: downloads.map((download) => mapRuntimeDownload(download as unknown as Parameters<typeof mapRuntimeDownload>[0])),
    customerModels: customerModels.map((model) => mapRuntimeCustomerModel(model as unknown as Record<string, unknown>))
  };
}

export async function getCustomerAccountSectionRuntimeRelational({
  customer,
  section,
  siteId
}: {
  customer: PublicCustomer;
  section: CustomerAccountRuntimeSection;
  siteId: string;
}): Promise<ThemeRuntimeData> {
  return selectCustomerAccountRuntimeSection(
    await getCustomerAccountSummaryRuntimeRelational({ customer, siteId }),
    section
  );
}
