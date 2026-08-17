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

export type CustomerAccountRuntimeList =
  | "subscriptions"
  | "orders"
  | "ledger"
  | "jobs"
  | "downloads"
  | "albums"
  | "models"
  | "assets"
  | "avatars";

export type CustomerAccountPaginationParams = {
  list?: CustomerAccountRuntimeList;
  page?: number;
  pageSize?: number;
};

type RuntimeSubscription = NonNullable<ThemeRuntimeData["subscriptions"]>[number];
type RuntimeOrder = NonNullable<ThemeRuntimeData["orders"]>[number];
type RuntimeJob = ThemeRuntimeData["jobs"][number];
type RuntimeAlbum = ThemeRuntimeData["albums"][number];
type RuntimeLedgerEntry = ThemeRuntimeData["ledger"][number];
type RuntimeCustomerModel = NonNullable<ThemeRuntimeData["customerModels"]>[number];
type RuntimeDownload = NonNullable<ThemeRuntimeData["downloads"]>[number];
type AccountRuntimeMeasure = <T>(name: string, operation: () => Promise<T>) => Promise<T>;

const missingOptionalTableWarnings = new Set<string>();
const allowedPageSizes = new Set([10, 20, 50]);

const measureAccountRuntime: AccountRuntimeMeasure = (_name, operation) => operation();

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

function normalizedPage(value: number | undefined): number {
  if (!Number.isFinite(value ?? NaN)) return 1;
  return Math.max(1, Math.trunc(value ?? 1));
}

function normalizedPageSize(value: number | undefined): number {
  const pageSize = Number.isFinite(value ?? NaN) ? Math.trunc(value ?? 20) : 20;
  if (allowedPageSizes.has(pageSize)) return pageSize;
  return 20;
}

function paginationMeta(params: {
  list: CustomerAccountRuntimeList;
  page: number;
  pageSize: number;
  total: number;
}): NonNullable<ThemeRuntimeData["pagination"]> {
  const totalPages = Math.max(1, Math.ceil(params.total / params.pageSize));
  const page = Math.min(Math.max(1, params.page), totalPages);
  const firstItem = params.total === 0 ? 0 : (page - 1) * params.pageSize + 1;
  const lastItem = params.total === 0 ? 0 : Math.min(params.total, page * params.pageSize);
  return {
    list: params.list,
    page,
    pageSize: params.pageSize,
    total: params.total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
    firstItem,
    lastItem
  };
}

async function readPaginatedList<T>(params: {
  count: () => Promise<number>;
  list: CustomerAccountRuntimeList;
  measure?: AccountRuntimeMeasure;
  page?: number;
  pageSize?: number;
  rows: (skip: number, take: number) => Promise<T[]>;
}): Promise<{ pagination: NonNullable<ThemeRuntimeData["pagination"]>; rows: T[] }> {
  const measure = params.measure ?? measureAccountRuntime;
  const requestedPage = normalizedPage(params.page);
  const resolvedPageSize = normalizedPageSize(params.pageSize);
  const requestedSkip = (requestedPage - 1) * resolvedPageSize;
  const [total, requestedRows] = await Promise.all([
    measure("list-count", params.count),
    measure("list-rows", () => params.rows(requestedSkip, resolvedPageSize))
  ]);
  const pagination = paginationMeta({
    list: params.list,
    page: requestedPage,
    pageSize: resolvedPageSize,
    total
  });
  if (pagination.page !== requestedPage) {
    const correctedRows = await measure("list-rows-corrected", () => params.rows((pagination.page - 1) * pagination.pageSize, pagination.pageSize));
    return { pagination, rows: correctedRows };
  }
  return { pagination, rows: requestedRows };
}

function defaultListForSection(section: CustomerAccountRuntimeSection): CustomerAccountRuntimeList | undefined {
  if (section === "profile") return "avatars";
  if (section === "subscription" || section === "plan") return "subscriptions";
  if (section === "credits") return "ledger";
  if (section === "purchases" || section === "orders") return "orders";
  if (section === "generation" || section === "jobs") return "jobs";
  if (section === "downloads") return "downloads";
  if (section === "albums") return "albums";
  if (section === "models") return "models";
  return undefined;
}

function accountListForQuery(
  section: CustomerAccountRuntimeSection,
  list?: CustomerAccountRuntimeList
): CustomerAccountRuntimeList | undefined {
  if (list === "assets") return "assets";
  if (list === "avatars") return "avatars";
  if (list === "downloads") return "downloads";
  if (list === "orders") return "orders";
  if (list === "ledger") return "ledger";
  if (list === "jobs") return "jobs";
  if (list === "albums") return "albums";
  if (list === "models") return "models";
  if (list === "subscriptions") return "subscriptions";
  return defaultListForSection(section);
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
  const fileAvailable = asset?.previewStatus === "ready";
  return {
    id: download.id,
    assetId: download.assetId,
    jobId: download.jobId ?? asset?.jobId,
    albumId: download.albumId ?? undefined,
    source: download.source,
    label: asset?.label ?? "Downloaded asset",
    previewUrl: asset?.previewUrl,
    previewStatus: asset?.previewStatus,
    downloadUrl: fileAvailable ? asset?.downloadUrl : undefined,
    fileAvailable,
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 24
    });
  } catch (error) {
    if (!isMissingOptionalAccountTableError(error)) throw error;
    warnMissingOptionalTable("customer downloads lookup", error);
    return [];
  }
}

async function countCustomerDownloadsWithOptionalTable(customer: PublicCustomer, siteId: string): Promise<number> {
  try {
    return await prisma.customerAssetDownload.count({
      where: { siteId, customerId: customer.id }
    });
  } catch (error) {
    if (!isMissingOptionalAccountTableError(error)) throw error;
    warnMissingOptionalTable("customer downloads count", error);
    return 0;
  }
}

async function readCustomerDownloadsPageWithOptionalTable(params: {
  customer: PublicCustomer;
  measure?: AccountRuntimeMeasure;
  page: number;
  pageSize: number;
  siteId: string;
}) {
  return readPaginatedList({
    count: () => countCustomerDownloadsWithOptionalTable(params.customer, params.siteId),
    list: "downloads",
    measure: params.measure,
    page: params.page,
    pageSize: params.pageSize,
    rows: async (skip, take) => {
      try {
        return await prisma.customerAssetDownload.findMany({
          where: { siteId: params.siteId, customerId: params.customer.id },
          include: { asset: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          skip,
          take
        });
      } catch (error) {
        if (!isMissingOptionalAccountTableError(error)) throw error;
        warnMissingOptionalTable("customer downloads page", error);
        return [];
      }
    }
  }).then((result) => ({
    downloads: result.rows,
    pagination: result.pagination
  }));
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 6
    }),
    prisma.order.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 16
    }),
    prisma.generationJob.findMany({
      where: { siteId, customerId: customer.id },
      select: {
        id: true,
        aiAppId: true,
        status: true,
        creditsReserved: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 16
    }),
    prisma.album.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 16
    }),
    prisma.creditLedger.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 48
    }),
    readCustomerDownloadsWithOptionalTable(customer, siteId),
    prisma.customerModel.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
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
  list,
  measure,
  page,
  pageSize,
  section,
  siteId
}: {
  customer: PublicCustomer;
  list?: CustomerAccountRuntimeList;
  measure?: AccountRuntimeMeasure;
  page?: number;
  pageSize?: number;
  section: CustomerAccountRuntimeSection;
  siteId: string;
}): Promise<ThemeRuntimeData> {
  const runtimeList = accountListForQuery(section, list);
  if (!runtimeList || section === "summary" || section === "overview") {
    return selectCustomerAccountRuntimeSection(
      await getCustomerAccountSummaryRuntimeRelational({ customer, siteId }),
      section
    );
  }

  if (runtimeList === "downloads") {
    const pageResult = await readCustomerDownloadsPageWithOptionalTable({
      customer,
      measure,
      page: normalizedPage(page),
      pageSize: normalizedPageSize(pageSize),
      siteId
    });
    return {
      ...emptyRuntime(),
      customer,
      profile: customer.profile,
      downloads: pageResult.downloads.map((download) => mapRuntimeDownload(download as unknown as Parameters<typeof mapRuntimeDownload>[0])),
      pagination: pageResult.pagination
    };
  }

  const countWhere = {
    siteId,
    customerId: customer.id
  };

  if (runtimeList === "subscriptions") {
    const pageResult = await readPaginatedList({
      count: () => prisma.subscription.count({ where: countWhere }),
      list: runtimeList,
      measure,
      page,
      pageSize,
      rows: (skip, take) => prisma.subscription.findMany({
        where: countWhere,
        include: { product: true, price: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take
      })
    });
    return {
      ...emptyRuntime(),
      customer,
      profile: customer.profile,
      subscriptions: pageResult.rows.map(mapRuntimeSubscription),
      pagination: pageResult.pagination
    };
  }

  if (runtimeList === "orders") {
    const pageResult = await readPaginatedList({
      count: () => prisma.order.count({ where: countWhere }),
      list: runtimeList,
      measure,
      page,
      pageSize,
      rows: (skip, take) => prisma.order.findMany({
        where: countWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take
      })
    });
    return {
      ...emptyRuntime(),
      customer,
      profile: customer.profile,
      orders: pageResult.rows.map(mapRuntimeOrder),
      pagination: pageResult.pagination
    };
  }

  if (runtimeList === "ledger") {
    const pageResult = await readPaginatedList({
      count: () => prisma.creditLedger.count({ where: countWhere }),
      list: runtimeList,
      measure,
      page,
      pageSize,
      rows: (skip, take) => prisma.creditLedger.findMany({
        where: countWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take
      })
    });
    return {
      ...emptyRuntime(),
      customer,
      profile: customer.profile,
      ledger: pageResult.rows.map(mapRuntimeLedger),
      pagination: pageResult.pagination
    };
  }

  if (runtimeList === "jobs") {
    const pageResult = await readPaginatedList({
      count: () => prisma.generationJob.count({ where: countWhere }),
      list: runtimeList,
      measure,
      page,
      pageSize,
      rows: (skip, take) => prisma.generationJob.findMany({
        where: countWhere,
        select: {
          id: true,
          aiAppId: true,
          status: true,
          creditsReserved: true,
          createdAt: true,
          updatedAt: true
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take
      })
    });
    return {
      ...emptyRuntime(),
      customer,
      profile: customer.profile,
      jobs: pageResult.rows.map(mapRuntimeJob),
      pagination: pageResult.pagination
    };
  }

  if (runtimeList === "albums") {
    const pageResult = await readPaginatedList({
      count: () => prisma.album.count({ where: countWhere }),
      list: runtimeList,
      measure,
      page,
      pageSize,
      rows: (skip, take) => prisma.album.findMany({
        where: countWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take
      })
    });
    return {
      ...emptyRuntime(),
      customer,
      profile: customer.profile,
      albums: pageResult.rows.map(mapRuntimeAlbum),
      pagination: pageResult.pagination
    };
  }

  if (runtimeList === "models") {
    const pageResult = await readPaginatedList({
      count: () => prisma.customerModel.count({ where: countWhere }),
      list: runtimeList,
      measure,
      page,
      pageSize,
      rows: (skip, take) => prisma.customerModel.findMany({
        where: countWhere,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take
      })
    });
    return {
      ...emptyRuntime(),
      customer,
      profile: customer.profile,
      customerModels: pageResult.rows.map((model) => mapRuntimeCustomerModel(model as unknown as Record<string, unknown>)),
      pagination: pageResult.pagination
    };
  }

  const where = {
    ...countWhere,
    deletedAt: null,
    ...(runtimeList === "avatars"
      ? { subjectRole: "profile_avatar" }
      : { role: "output" })
  };
  const pageResult = await readPaginatedList({
    count: () => prisma.assetUpload.count({ where }),
    list: runtimeList,
    measure,
    page,
    pageSize,
    rows: (skip, take) => prisma.assetUpload.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take
    })
  });
  return {
    ...emptyRuntime(),
    customer,
    profile: customer.profile,
    assets: pageResult.rows.map((asset) => toThemeRuntimeAssetRelational(toAssetUploadRelational(asset as unknown as Record<string, unknown>))),
    pagination: pageResult.pagination
  };
}
