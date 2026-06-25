import { adminPerfJson, createAdminPerfTracker } from "@/lib/admin-perf";
import { hasSiteAdminSession } from "@/lib/api-auth";
import { runDbTasks } from "@/lib/db-concurrency";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import {
  getSiteCustomersFromState,
  getSiteJobsFromState,
  getSiteLedgerFromState,
  getSiteOrdersFromState,
  getSiteSubscriptionsFromState,
  readPlatformState
} from "@/lib/server-store";
import { mapCreditLedger } from "@/lib/stores/prisma-mappers";
import type { GenerationJob, Order, PaymentEvent, PlatformState, Subscription } from "@/lib/types";

type CustomerLookup = { id: string; email: string };
type OrdersTab = "overview" | "orders" | "subscriptions" | "ledger" | "events";

const ordersPageCache = createServerTtlCache("site-admin-orders-page", Number(process.env.SITE_ADMIN_ORDERS_PAGE_CACHE_TTL_MS ?? 15_000));

function envInt(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

const adminListTake = envInt("SITE_ADMIN_LIST_TAKE", 50);
const siteAdminReadConcurrency = envInt("SITE_ADMIN_READ_CONCURRENCY", 4);

function normalizeOrdersTab(value: string | null): OrdersTab {
  if (value === "orders" || value === "subscriptions" || value === "ledger" || value === "events") return value;
  return "overview";
}

function normalizeTake(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return adminListTake;
  return Math.min(200, Math.max(10, Math.floor(parsed)));
}

function normalizeCursor(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function nextCursor<T extends { id: string }>(items: T[], take: number): string | undefined {
  return items.length >= take ? items[items.length - 1]?.id : undefined;
}

function mapOrderForAdmin(row: {
  id: string;
  siteId: string;
  customerId: string;
  status: string;
  amountCents: number;
  currency: string;
  credits: number;
  sourceId: string;
  createdAt: Date | string;
}): Order {
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

function mapLightGenerationJobForAdmin(row: {
  id: string;
  siteId: string;
  customerId: string;
  aiAppId: string;
  status: string;
  creditsReserved: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}): GenerationJob {
  return {
    id: row.id,
    siteId: row.siteId,
    customerId: row.customerId,
    aiAppId: row.aiAppId,
    status: row.status as GenerationJob["status"],
    creditsReserved: row.creditsReserved,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    requestJson: {},
    resultJson: undefined
  };
}

function mapLightPaymentEventForAdmin(row: {
  id: string;
  siteId: string;
  provider: string;
  providerEventId: string;
  eventType: string;
  processedAt: Date | string | null;
}): PaymentEvent {
  return {
    id: row.id,
    siteId: row.siteId,
    provider: "stripe",
    providerEventId: row.providerEventId,
    eventType: row.eventType,
    processedAt: row.processedAt instanceof Date ? row.processedAt.toISOString() : String(row.processedAt ?? new Date().toISOString()),
    payload: {}
  };
}

function legacyCollections(state: PlatformState, siteId: string, tab: OrdersTab, take: number) {
  const includeOrders = tab === "orders" || tab === "ledger" || tab === "overview";
  const includeSubscriptions = tab === "subscriptions" || tab === "overview";
  const includeLedger = tab === "ledger" || tab === "overview";
  const includeJobs = tab === "ledger";
  const includePaymentEvents = tab === "events" || tab === "overview";
  return {
    orders: includeOrders ? getSiteOrdersFromState(state, siteId).slice(0, take) : [],
    subscriptions: includeSubscriptions ? getSiteSubscriptionsFromState(state, siteId).slice(0, take) : [],
    ledger: includeLedger ? getSiteLedgerFromState(state, siteId).slice(0, take) : [],
    jobs: includeJobs ? getSiteJobsFromState(state, siteId).slice(0, take) : [],
    paymentEvents: includePaymentEvents ? state.paymentEvents.filter((event) => event.siteId === siteId).slice(0, take) : []
  };
}

async function customerLookups(siteId: string, customerIds: Iterable<string>, legacyState?: PlatformState): Promise<CustomerLookup[]> {
  const ids = Array.from(new Set([...customerIds].filter(Boolean)));
  if (!ids.length) return [];
  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const wanted = new Set(ids);
    return getSiteCustomersFromState(legacyState ?? readPlatformState(), siteId)
      .filter((customer) => wanted.has(customer.id))
      .map((customer) => ({ id: customer.id, email: customer.email }));
  }
  return prisma.customer.findMany({
    where: { siteId, id: { in: ids } },
    select: { id: true, email: true }
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const tab = normalizeOrdersTab(new URL(request.url).searchParams.get("tab"));
  const url = new URL(request.url);
  const take = normalizeTake(url.searchParams.get("take"));
  const cursor = normalizeCursor(url.searchParams.get("cursor"));
  const perf = createAdminPerfTracker("admin-orders-page", { siteId, tab, take, cursor: cursor ?? "" });
  if (!(await perf.measure("auth", () => hasSiteAdminSession(siteId)))) {
    return adminPerfJson(perf, { error: "site_admin_login_required" }, { status: 401 });
  }

  if (process.env.PERSISTENCE_BACKEND !== "postgres") {
    const legacyState = perf.measureSync("context", () => readPlatformState(), { source: "state" });
    const collections = legacyCollections(legacyState, siteId, tab, take);
    const customers = await perf.measure("db", () => customerLookups(
      siteId,
      [...collections.orders, ...collections.subscriptions, ...collections.ledger].map((item) => item.customerId),
      legacyState
    ), { phase: "customerLookups" });
    return adminPerfJson(perf, { ok: true, tab, customers, ...collections });
  }

  const includeOrders = tab === "orders" || tab === "ledger" || tab === "overview";
  const includeSubscriptions = tab === "subscriptions" || tab === "overview";
  const includeLedger = tab === "ledger" || tab === "overview";
  const includeJobs = tab === "ledger";
  const includePaymentEvents = tab === "events" || tab === "overview";

  const payload = await perf.measure("cache", () => ordersPageCache.get(`${tab}:${siteId}:${take}:${cursor ?? "first"}`, async () => {
    const [orders, subscriptions, ledger, jobs, paymentEvents] = await perf.measure("db", () => runDbTasks([
      includeOrders
        ? () => prisma.order.findMany({
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
            ...(cursor && tab === "orders" ? { cursor: { id: cursor }, skip: 1 } : {}),
            take
          })
        : () => Promise.resolve([]),
      includeSubscriptions
        ? () => prisma.subscription.findMany({
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
            ...(cursor && tab === "subscriptions" ? { cursor: { id: cursor }, skip: 1 } : {}),
            take
          })
        : () => Promise.resolve([]),
      includeLedger
        ? () => prisma.creditLedger.findMany({
            where: { siteId },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            ...(cursor && tab === "ledger" ? { cursor: { id: cursor }, skip: 1 } : {}),
            take
          })
        : () => Promise.resolve([]),
      includeJobs
        ? () => prisma.generationJob.findMany({
            where: { siteId },
            select: {
              id: true,
              siteId: true,
              customerId: true,
              aiAppId: true,
              status: true,
              creditsReserved: true,
              createdAt: true,
              updatedAt: true
            },
            orderBy: [{ createdAt: "desc" }, { id: "asc" }],
            take
          })
        : () => Promise.resolve([]),
      includePaymentEvents
        ? () => prisma.paymentEvent.findMany({
            where: { siteId },
            select: {
              id: true,
              siteId: true,
              provider: true,
              providerEventId: true,
              eventType: true,
              processedAt: true
            },
            orderBy: [{ processedAt: "desc" }, { id: "asc" }],
            ...(cursor && tab === "events" ? { cursor: { id: cursor }, skip: 1 } : {}),
            take
          })
        : () => Promise.resolve([])
    ], siteAdminReadConcurrency), { phase: "collections" });

    const mappedOrders = orders.map(mapOrderForAdmin);
    const mappedSubscriptions = subscriptions.map(mapSubscriptionForAdmin);
    const mappedLedger = ledger.map(mapCreditLedger);
    const customers = await perf.measure("db", () => customerLookups(
      siteId,
      [...mappedOrders, ...mappedSubscriptions, ...mappedLedger].map((item) => item.customerId)
    ), { phase: "customerLookups" });

    return {
      ok: true,
      tab,
      customers,
      orders: mappedOrders,
      subscriptions: mappedSubscriptions,
      ledger: mappedLedger,
      jobs: jobs.map(mapLightGenerationJobForAdmin),
      paymentEvents: paymentEvents.map(mapLightPaymentEventForAdmin),
      pageInfo: {
        take,
        nextOrderCursor: nextCursor(mappedOrders, take),
        nextSubscriptionCursor: nextCursor(mappedSubscriptions, take),
        nextLedgerCursor: nextCursor(mappedLedger, take),
        nextPaymentEventCursor: nextCursor(paymentEvents, take)
      }
    };
  }));

  if (!payload) {
    return adminPerfJson(perf, { error: "site_admin_data_unavailable" }, { status: 503 });
  }

  return adminPerfJson(perf, payload);
}
