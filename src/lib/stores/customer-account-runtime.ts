import "server-only";
import { prisma } from "@/lib/prisma";
import type { PublicCustomer, ThemeRuntimeData } from "@/lib/types";

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

export async function getCustomerAccountSummaryRuntimeRelational({
  customer,
  siteId
}: {
  customer: PublicCustomer;
  siteId: string;
}): Promise<ThemeRuntimeData> {
  const [subscriptions, orders, jobs, albums, ledger] = await Promise.all([
    prisma.subscription.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 2
    }),
    prisma.order.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 12
    }),
    prisma.generationJob.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      take: 12
    }),
    prisma.album.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { updatedAt: "desc" },
      take: 12
    }),
    prisma.creditLedger.findMany({
      where: { siteId, customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 16
    })
  ]);

  return {
    customer,
    jobs: jobs.map((job) => ({
      id: job.id,
      aiAppId: job.aiAppId,
      status: job.status as ThemeRuntimeData["jobs"][number]["status"],
      creditsReserved: job.creditsReserved,
      createdAt: iso(job.createdAt),
      updatedAt: iso(job.updatedAt),
      requestJson: job.requestJson && typeof job.requestJson === "object" && !Array.isArray(job.requestJson)
        ? job.requestJson as Record<string, unknown>
        : undefined,
      resultJson: job.resultJson && typeof job.resultJson === "object" && !Array.isArray(job.resultJson)
        ? job.resultJson as Record<string, unknown>
        : undefined
    })),
    assets: [],
    albums: albums.map((album) => ({
      id: album.id,
      title: album.title,
      sourceJobId: album.sourceJobId ?? undefined,
      creativePackId: album.creativePackId ?? undefined,
      status: album.status as ThemeRuntimeData["albums"][number]["status"],
      outputCount: album.outputCount,
      coverAssetId: album.coverAssetId ?? undefined,
      createdAt: iso(album.createdAt),
      updatedAt: iso(album.updatedAt)
    })),
    ledger: ledger.map((entry) => ({
      id: entry.id,
      amount: entry.amount,
      type: entry.type as ThemeRuntimeData["ledger"][number]["type"],
      createdAt: iso(entry.createdAt)
    })),
    subscriptions: subscriptions.map((subscription) => ({
      id: subscription.id,
      productId: subscription.productId,
      priceId: subscription.priceId,
      status: subscription.status as NonNullable<ThemeRuntimeData["subscriptions"]>[number]["status"],
      currentPeriodEnd: iso(subscription.currentPeriodEnd),
      creditsPerCycle: subscription.creditsPerCycle,
      createdAt: iso(subscription.createdAt)
    })),
    orders: orders.map((order) => ({
      id: order.id,
      status: order.status as NonNullable<ThemeRuntimeData["orders"]>[number]["status"],
      amountCents: order.amountCents,
      currency: order.currency,
      credits: order.credits,
      sourceId: order.sourceId,
      createdAt: iso(order.createdAt)
    })),
    customerModels: []
  };
}
