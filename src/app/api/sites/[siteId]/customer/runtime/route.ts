import { NextResponse } from "next/server";
import { getCurrentCustomerForSite } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { createServerTtlCache } from "@/lib/server-ttl-cache";
import { getThemeRuntimeForCustomer } from "@/lib/server-store";
import { customerSessionCookie } from "@/lib/session";
import { readStorefrontCustomerRuntimeStateForSiteFromDatabase } from "@/lib/storefront-state";
import { toCustomerSessionRelational, toPublicCustomerRelational } from "@/lib/stores/prisma-mappers";
import { cookies } from "next/headers";
import type { CustomerSession, PublicCustomer, ThemeRuntimeData } from "@/lib/types";
import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const customerRuntimeCache = createServerTtlCache(
  "customer-runtime-api",
  Number(process.env.STOREFRONT_CUSTOMER_RUNTIME_API_TTL_MS ?? 30_000)
);

function emptyRuntime(): ThemeRuntimeData {
  return {
    jobs: [],
    assets: [],
    albums: [],
    ledger: [],
    subscriptions: [],
    orders: [],
    customerModels: []
  };
}

type CustomerRuntimeSection = "summary" | "plan" | "orders" | "jobs" | "albums" | "credits";
type RuntimeSubscription = NonNullable<ThemeRuntimeData["subscriptions"]>[number];
type RuntimeOrder = NonNullable<ThemeRuntimeData["orders"]>[number];
type RuntimeJob = ThemeRuntimeData["jobs"][number];
type RuntimeAlbum = ThemeRuntimeData["albums"][number];
type RuntimeLedgerEntry = ThemeRuntimeData["ledger"][number];
type AccountCurrentCustomer = { customer: PublicCustomer; session: CustomerSession; sessionId: string };

function normalizeSection(value: string | null): CustomerRuntimeSection {
  if (value === "plan" || value === "orders" || value === "jobs" || value === "albums" || value === "credits") return value;
  return "summary";
}

function sectionRuntime(runtime: ThemeRuntimeData, section: CustomerRuntimeSection): ThemeRuntimeData {
  const base = emptyRuntime();
  if (section === "plan") {
    return {
      ...base,
      customer: runtime.customer,
      subscriptions: runtime.subscriptions ?? []
    };
  }
  if (section === "orders") {
    return {
      ...base,
      orders: runtime.orders ?? [],
      jobs: runtime.jobs ?? []
    };
  }
  if (section === "jobs") {
    return {
      ...base,
      jobs: runtime.jobs ?? [],
      assets: runtime.assets ?? [],
      albums: runtime.albums ?? []
    };
  }
  if (section === "albums") {
    return {
      ...base,
      albums: runtime.albums ?? [],
      assets: runtime.assets ?? [],
      ledger: runtime.ledger ?? []
    };
  }
  if (section === "credits") {
    return {
      ...base,
      customer: runtime.customer,
      ledger: runtime.ledger ?? []
    };
  }
  return runtime;
}

function trimRuntime(runtime: ThemeRuntimeData, profile: string, section: CustomerRuntimeSection): ThemeRuntimeData {
  if (profile === "workspace") {
    return {
      ...runtime,
      jobs: (runtime.jobs ?? []).slice(0, 8),
      assets: (runtime.assets ?? []).slice(0, 24),
      albums: (runtime.albums ?? []).slice(0, 8),
      ledger: (runtime.ledger ?? []).slice(0, 12),
      subscriptions: (runtime.subscriptions ?? []).slice(0, 4),
      orders: (runtime.orders ?? []).slice(0, 6),
      customerModels: (runtime.customerModels ?? []).slice(0, 4)
    };
  }
  const trimmed = {
    ...runtime,
    jobs: (runtime.jobs ?? []).slice(0, 12),
    assets: (runtime.assets ?? []).slice(0, 24),
    albums: (runtime.albums ?? []).slice(0, 12),
    ledger: (runtime.ledger ?? []).slice(0, 16),
    subscriptions: (runtime.subscriptions ?? []).slice(0, 6),
    orders: (runtime.orders ?? []).slice(0, 12),
    customerModels: (runtime.customerModels ?? []).slice(0, 8)
  };
  return profile === "account" ? sectionRuntime(trimmed, section) : trimmed;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

async function readAccountSectionRuntime({
  customer,
  section,
  siteId
}: {
  customer: NonNullable<Awaited<ReturnType<typeof getCurrentCustomerForSite>>>["customer"];
  section: CustomerRuntimeSection;
  siteId: string;
}): Promise<ThemeRuntimeData> {
  const base = emptyRuntime();
  if (section === "plan") {
    const subscriptions = await prisma.subscription.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 2
    });
    return {
      ...base,
      customer,
      subscriptions: subscriptions.map((subscription) => ({
        id: subscription.id,
        productId: subscription.productId,
        priceId: subscription.priceId,
        status: subscription.status as RuntimeSubscription["status"],
        currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
        creditsPerCycle: subscription.creditsPerCycle,
        createdAt: subscription.createdAt.toISOString()
      }))
    };
  }
  if (section === "orders") {
    const orders = await prisma.order.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 12
    });
    return {
      ...base,
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status as RuntimeOrder["status"],
        amountCents: order.amountCents,
        currency: order.currency,
        credits: order.credits,
        sourceId: order.sourceId,
        createdAt: order.createdAt.toISOString()
      }))
    };
  }
  if (section === "jobs") {
    const jobs = await prisma.generationJob.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      take: 12
    });
    return {
      ...base,
      jobs: jobs.map((job) => ({
        id: job.id,
        aiAppId: job.aiAppId,
        status: job.status as RuntimeJob["status"],
        creditsReserved: job.creditsReserved,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
        requestJson: job.requestJson && typeof job.requestJson === "object" && !Array.isArray(job.requestJson)
          ? job.requestJson as Record<string, unknown>
          : undefined
      }))
    };
  }
  if (section === "albums") {
    const [albums, ledger] = await Promise.all([
      prisma.album.findMany({
        where: { siteId, customerId: customer.id },
        orderBy: { updatedAt: "desc" },
        take: 12
      }),
      prisma.creditLedger.findMany({
        where: { siteId, customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 4
      })
    ]);
    return {
      ...base,
      albums: albums.map((album) => ({
        id: album.id,
        title: album.title,
        sourceJobId: album.sourceJobId ?? undefined,
        creativePackId: album.creativePackId ?? undefined,
        status: album.status as RuntimeAlbum["status"],
        outputCount: album.outputCount,
        coverAssetId: album.coverAssetId ?? undefined,
        createdAt: album.createdAt.toISOString(),
        updatedAt: album.updatedAt.toISOString()
      })),
      ledger: ledger.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        type: entry.type as RuntimeLedgerEntry["type"],
        createdAt: entry.createdAt.toISOString()
      }))
    };
  }
  if (section === "credits") {
    const ledger = await prisma.creditLedger.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 16
    });
    return {
      ...base,
      customer,
      ledger: ledger.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        type: entry.type as RuntimeLedgerEntry["type"],
        createdAt: iso(entry.createdAt)
      }))
    };
  }
  return {
    ...base,
    customer
  };
}

function accountSectionInclude(section: CustomerRuntimeSection) {
  const customerBase = {
    balance: true
  };
  if (section === "plan") {
    return {
      customer: {
        include: {
          ...customerBase,
          subscriptions: { orderBy: { createdAt: "desc" as const }, take: 2 }
        }
      }
    };
  }
  if (section === "orders") {
    return {
      customer: {
        include: {
          ...customerBase,
          orders: { orderBy: { createdAt: "desc" as const }, take: 12 }
        }
      }
    };
  }
  if (section === "jobs") {
    return {
      customer: {
        include: {
          ...customerBase,
          jobs: { orderBy: { updatedAt: "desc" as const }, take: 12 }
        }
      }
    };
  }
  if (section === "albums") {
    return {
      customer: {
        include: {
          ...customerBase,
          albums: { orderBy: { updatedAt: "desc" as const }, take: 12 },
          ledger: { orderBy: { createdAt: "desc" as const }, take: 4 }
        }
      }
    };
  }
  if (section === "credits") {
    return {
      customer: {
        include: {
          ...customerBase,
          ledger: { orderBy: { createdAt: "desc" as const }, take: 16 }
        }
      }
    };
  }
  return { customer: { include: customerBase } };
}

async function readAccountSectionRuntimeForSession({
  section,
  sessionId,
  siteId
}: {
  section: CustomerRuntimeSection;
  sessionId: string;
  siteId: string;
}): Promise<{ current: AccountCurrentCustomer; runtime: ThemeRuntimeData } | undefined> {
  const session = await prisma.customerSession.findFirst({
    where: {
      id: sessionId,
      siteId,
      expiresAt: { gt: new Date() }
    },
    include: accountSectionInclude(section)
  });
  if (!session?.customer) return undefined;
  const customer = toPublicCustomerRelational(session.customer as Record<string, unknown>);
  const current = {
    customer,
    session: toCustomerSessionRelational(session as Record<string, unknown>),
    sessionId: session.id
  };
  const base = emptyRuntime();
  const customerRecord = session.customer as {
    albums?: Array<RuntimeAlbum & { createdAt: Date | string; updatedAt: Date | string }>;
    jobs?: Array<RuntimeJob & { createdAt: Date | string; updatedAt: Date | string; requestJson?: unknown }>;
    ledger?: Array<RuntimeLedgerEntry & { createdAt: Date | string }>;
    orders?: Array<RuntimeOrder & { createdAt: Date | string }>;
    subscriptions?: Array<RuntimeSubscription & { createdAt: Date | string; currentPeriodEnd: Date | string }>;
  };

  if (section === "plan") {
    return {
      current,
      runtime: {
        ...base,
        customer,
        subscriptions: (customerRecord.subscriptions ?? []).map((subscription) => ({
          id: subscription.id,
          productId: subscription.productId,
          priceId: subscription.priceId,
          status: subscription.status as RuntimeSubscription["status"],
          currentPeriodEnd: iso(subscription.currentPeriodEnd),
          creditsPerCycle: subscription.creditsPerCycle,
          createdAt: iso(subscription.createdAt)
        }))
      }
    };
  }
  if (section === "orders") {
    return {
      current,
      runtime: {
        ...base,
        orders: (customerRecord.orders ?? []).map((order) => ({
          id: order.id,
          status: order.status as RuntimeOrder["status"],
          amountCents: order.amountCents,
          currency: order.currency,
          credits: order.credits,
          sourceId: order.sourceId,
          createdAt: iso(order.createdAt)
        }))
      }
    };
  }
  if (section === "jobs") {
    return {
      current,
      runtime: {
        ...base,
        jobs: (customerRecord.jobs ?? []).map((job) => ({
          id: job.id,
          aiAppId: job.aiAppId,
          status: job.status as RuntimeJob["status"],
          creditsReserved: job.creditsReserved,
          createdAt: iso(job.createdAt),
          updatedAt: iso(job.updatedAt),
          requestJson: job.requestJson && typeof job.requestJson === "object" && !Array.isArray(job.requestJson)
            ? job.requestJson as Record<string, unknown>
            : undefined
        }))
      }
    };
  }
  if (section === "albums") {
    return {
      current,
      runtime: {
        ...base,
        albums: (customerRecord.albums ?? []).map((album) => ({
          id: album.id,
          title: album.title,
          sourceJobId: album.sourceJobId ?? undefined,
          creativePackId: album.creativePackId ?? undefined,
          status: album.status as RuntimeAlbum["status"],
          outputCount: album.outputCount,
          coverAssetId: album.coverAssetId ?? undefined,
          createdAt: iso(album.createdAt),
          updatedAt: iso(album.updatedAt)
        })),
        ledger: (customerRecord.ledger ?? []).map((entry) => ({
          id: entry.id,
          amount: entry.amount,
          type: entry.type as RuntimeLedgerEntry["type"],
          createdAt: iso(entry.createdAt)
        }))
      }
    };
  }
  if (section === "credits") {
    return {
      current,
      runtime: {
        ...base,
        customer,
        ledger: (customerRecord.ledger ?? []).map((entry) => ({
          id: entry.id,
          amount: entry.amount,
          type: entry.type as RuntimeLedgerEntry["type"],
          createdAt: iso(entry.createdAt)
        }))
      }
    };
  }
  return {
    current,
    runtime: {
      ...base,
      customer
    }
  };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ siteId: string }> }) {
  const { siteId } = await params;
  const sessionId = (await cookies()).get(customerSessionCookie(siteId))?.value;
  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "customer_login_required", runtime: emptyRuntime() }, { status: 401 });
  }

  const profile = new URL(request.url).searchParams.get("profile") ?? "account";
  const section = normalizeSection(new URL(request.url).searchParams.get("section"));
  const normalizedProfile = profile === "workspace" ? "workspace" : profile === "account" ? "account" : "full";
  const result = await customerRuntimeCache.get(
    `${siteId}:${sessionId}:${normalizedProfile}:${section}`,
    async (): Promise<{ customer: NonNullable<Awaited<ReturnType<typeof getCurrentCustomerForSite>>>["customer"]; runtime: ThemeRuntimeData } | undefined> => {
      if (normalizedProfile === "account") {
        const accountRuntime = await readAccountSectionRuntimeForSession({ section, sessionId, siteId });
        if (!accountRuntime) return undefined;
        return {
          customer: accountRuntime.current.customer,
          runtime: accountRuntime.runtime
        };
      }
      const current = await getCurrentCustomerForSite(siteId);
      if (!current) return undefined;
      const state = await readStorefrontCustomerRuntimeStateForSiteFromDatabase({
        siteId,
        sessionId: current.sessionId,
        profile: normalizedProfile
      });
      if (!state) return undefined;
      return {
        customer: current.customer,
        runtime: trimRuntime(getThemeRuntimeForCustomer(state, siteId, current.customer.id), normalizedProfile, section)
      };
    },
    normalizedProfile === "workspace" ? 8_000 : normalizedProfile === "account" ? 30_000 : 12_000
  );
  if (!result) {
    return NextResponse.json({ ok: false, error: "customer_runtime_unavailable", runtime: emptyRuntime() }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    runtime: {
      ...result.runtime,
      customer: result.customer
    }
  }, {
    headers: { "Cache-Control": "private, max-age=20" }
  });
}
